// ============================================================
// FeedSilo Extension - Content Script
// ============================================================

// --- Debug logging (set to true for development) ---
const DEBUG = false;
function log(...args) { if (DEBUG) console.log('FeedSilo:', ...args); }

// --- API Interceptor (receives data from interceptor.js in MAIN world) ---
// Cache of intercepted tweet data: Map<tweetId, tweetData>
log('content script loaded at', document.readyState);
const tweetCache = new Map();

// Listen for API responses forwarded from the MAIN world interceptor
document.addEventListener('feedsilo-api-response', (event) => {
  try {
    const data = JSON.parse(event.detail);
    extractTweetsFromApiResponse(data);
  } catch (e) {
    // Silently ignore parse errors
  }
});

function extractTweetsFromApiResponse(data) {
  // Recursively walk the response to find tweet objects
  if (!data || typeof data !== 'object') return;

  // Look for tweet_results or result objects with rest_id
  if (data.rest_id && data.legacy) {
    cacheTweetData(data);
    // Don't return — keep recursing for nested article content_state
  }

  // Check for tweet_results wrapper
  if (data.tweet_results?.result) {
    const result = data.tweet_results.result;
    // Handle __typename: "TweetWithVisibilityResults"
    const tweet = result.tweet || result;
    if (tweet.rest_id && tweet.legacy) {
      cacheTweetData(tweet);
    }
  }

  // Check for content_state anywhere in the response (article body)
  if (data.content_state?.blocks?.length > 0) {
    const { body: fullBody, imageUrls } = formatContentStateBlocks(data.content_state);
    if (fullBody.length > 200) {
      // Find the most recently cached article with a shorter body and update it
      let bestMatch = null;
      let bestTime = 0;
      for (const [id, cached] of tweetCache) {
        if (cached.source_type === 'article' && (cached._cachedAt || 0) > bestTime) {
          if (!cached.body_text || cached.body_text.length < fullBody.length) {
            bestMatch = { id, cached };
            bestTime = cached._cachedAt || 0;
          }
        }
      }
      if (bestMatch && (Date.now() - bestTime) < 60000) {
        bestMatch.cached.body_text = fullBody;
        for (const imgUrl of imageUrls) {
          if (!bestMatch.cached.media_urls.includes(imgUrl)) {
            bestMatch.cached.media_urls.push(imgUrl);
          }
        }
      }
    }
  }

  // Recurse into arrays and objects
  if (Array.isArray(data)) {
    data.forEach(item => extractTweetsFromApiResponse(item));
  } else {
    Object.values(data).forEach(value => {
      if (value && typeof value === 'object') {
        extractTweetsFromApiResponse(value);
      }
    });
  }
}

function formatContentStateBlocks(contentState) {
  // Convert Draft.js content_state blocks to markdown text + extract image URLs
  const blocks = contentState.blocks || [];
  const entityMap = contentState.entityMap || {};
  const bodyParts = [];
  const imageUrls = [];
  let codeBuffer = []; // Merge consecutive code-block lines

  // Log ALL blocks for debugging — compact format
  log(' content_state has', blocks.length, 'blocks,', Object.keys(entityMap).length, 'entities');
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const t = b.type || 'unstyled';
    const txt = (b.text || '').substring(0, 80);
    const dataKeys = Object.keys(b.data || {});
    const entityCount = (b.entityRanges || []).length;
    log(`block[${i}] type="${t}" text="${txt}" dataKeys=${JSON.stringify(dataKeys)} entities=${entityCount}`);
  }
  // X's entityMap uses { key, value: { type, data } } — build a lookup by entity.key
  // Standard Draft.js uses entityMap[N] = { type, data } directly
  const entityLookup = {};
  for (const [idx, entry] of Object.entries(entityMap)) {
    if (entry.value && entry.key !== undefined) {
      // X format: map by the entity's own .key, resolve to .value
      entityLookup[entry.key] = entry.value;
      log(`entityLookup[${entry.key}] (idx ${idx}) type="${entry.value.type}" data=`, JSON.stringify(entry.value.data || {}).substring(0, 300));
    } else {
      // Standard Draft.js format: use array index as key
      entityLookup[idx] = entry;
      log(`entityLookup[${idx}] type="${entry.type}" data=`, JSON.stringify(entry.data || {}).substring(0, 300));
    }
  }

  function flushCodeBuffer() {
    if (codeBuffer.length > 0) {
      bodyParts.push('```\n' + codeBuffer.join('\n') + '\n```');
      codeBuffer = [];
    }
  }

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const text = block.text || '';
    const type = block.type || 'unstyled';

    // Handle code blocks — both standard Draft.js and possible X custom types
    if (type === 'code-block' || type === 'code') {
      codeBuffer.push(text);
      continue;
    }
    // Flush code buffer when hitting a non-code block
    flushCodeBuffer();

    switch (type) {
      case 'header-one':
        bodyParts.push(`# ${text}`);
        break;
      case 'header-two':
        bodyParts.push(`## ${text}`);
        break;
      case 'header-three':
        bodyParts.push(`### ${text}`);
        break;
      case 'blockquote':
        bodyParts.push(`> ${text}`);
        break;
      case 'unordered-list-item':
        bodyParts.push(`- ${text}`);
        break;
      case 'ordered-list-item':
        bodyParts.push(`1. ${text}`);
        break;
      case 'atomic': {
        // Atomic blocks can contain images, code, embeds, dividers, etc.
        let handled = false;

        // Check entities for this block
        // X uses a nested format: entity = { key, value: { type, data, mutability } }
        // Standard Draft.js: entity = { type, data, mutability }
        if (block.entityRanges?.length > 0) {
          for (const range of block.entityRanges) {
            const entity = entityLookup[range.key];
            if (!entity) continue;
            const eType = (entity.type || '').toUpperCase();
            const eData = entity.data || {};

            if (eType === 'MARKDOWN') {
              // X stores code blocks and rich content as markdown in entity data
              const md = eData.markdown || '';
              if (md.trim()) { bodyParts.push(md.trim()); handled = true; }
            }
            else if (eType === 'DIVIDER') {
              // Section divider — render as markdown horizontal rule
              bodyParts.push('---');
              handled = true;
            }
            else if (eType === 'IMAGE' || eType === 'PHOTO' || eType === 'MEDIA' || eType === 'IMG') {
              const imgUrl = eData.src || eData.url || eData.media_url_https
                || eData.image || eData.original_url || eData.thumbnail;
              if (imgUrl) { imageUrls.push(imgUrl); handled = true; }
            }
            else if (eType === 'CODE' || eType === 'CODE-BLOCK' || eType === 'CODEBLOCK') {
              const code = eData.code || eData.content || eData.text || text;
              if (code) { bodyParts.push('```\n' + code + '\n```'); handled = true; }
            }
            // Any entity with image-like or markdown data fields
            else if (eData.src || eData.media_url_https) {
              imageUrls.push(eData.src || eData.media_url_https);
              handled = true;
            } else if (eData.markdown) {
              bodyParts.push(eData.markdown.trim());
              handled = true;
            }
          }
        }

        // Check block.data for images/code
        const blockData = block.data || {};
        if (!handled) {
          const imgUrl = blockData.src || blockData.media_url_https
            || blockData.image || blockData.original_url;
          if (imgUrl) { imageUrls.push(imgUrl); handled = true; }
          if (blockData.code || blockData.language) {
            const code = blockData.code || blockData.content || text;
            if (code) { bodyParts.push('```\n' + code + '\n```'); handled = true; }
          }
          if (blockData.markdown) {
            bodyParts.push(blockData.markdown.trim());
            handled = true;
          }
        }

        // Fallback: include any text content from unrecognized atomic blocks
        if (!handled && text.trim()) {
          bodyParts.push(text);
        }
        break;
      }
      default:
        // Catch-all: always include non-empty text, even for unknown block types
        if (text.trim()) bodyParts.push(text);
    }
  }
  // Flush any remaining code lines
  flushCodeBuffer();

  return { body: bodyParts.join('\n\n'), imageUrls };
}

// --- Source Type Detection ---
function detectSourceType(bodyText, mediaUrls, isArticle, isThread) {
  if (isArticle) return 'article';
  if (isThread) return 'thread';

  // Art prompt detection (only if tweet has media)
  if (mediaUrls.length > 0 && bodyText) {
    const text = bodyText.toLowerCase();

    // Midjourney patterns
    if (/--ar\s+\d+:\d+/.test(text) || /--v\s+[\d.]+/.test(text) ||
        /--style\s+\w+/.test(text) || /\/imagine\b/.test(text) ||
        /\bmidjourney\b/.test(text)) {
      return 'image_prompt';
    }

    // DALL-E
    if (/\bdall[-·\s]?e\b/i.test(bodyText)) return 'image_prompt';

    // Stable Diffusion / SDXL / ComfyUI
    if (/\bstable\s*diffusion\b/i.test(bodyText) || /\bsdxl\b/i.test(bodyText) ||
        /\bcomfyui\b/i.test(bodyText)) {
      return 'image_prompt';
    }

    // Flux
    if (/\bflux\b/i.test(bodyText) && /\b(pro|dev|schnell|1\.1)\b/i.test(bodyText)) {
      return 'image_prompt';
    }

    // Generic "generated with/using/by [tool]"
    if (/\b(generated|created|made)\s+(with|using|by|in)\s+(midjourney|dall-?e|stable.?diffusion|flux|leonardo|firefly)/i.test(bodyText)) {
      return 'image_prompt';
    }

    // Video generation tools
    if (/\b(sora|runway|pika|kling|hailuo|luma\s*dream\s*machine)\b/i.test(bodyText)) {
      const hasVideo = mediaUrls.some(u => u.includes('.mp4') || u.includes('video'));
      return hasVideo ? 'video_prompt' : 'image_prompt';
    }
  }

  return 'tweet';
}

function cacheTweetData(tweet) {
  const tweetId = tweet.rest_id;
  if (!tweetId) return;

  const legacy = tweet.legacy || {};
  const user = tweet.core?.user_results?.result?.legacy || {};
  const noteTweet = tweet.note_tweet?.note_tweet_results?.result;

  // Get avatar URL - upgrade to full size by removing _normal suffix
  const avatarRaw = user.profile_image_url_https || null;
  const avatarUrl = avatarRaw ? avatarRaw.replace('_normal.', '_400x400.') : null;

  // Detect X Articles (long-form content linked from tweets)
  let isArticle = false;
  let articleTitle = null;
  let articleBody = '';
  let articlePreview = '';
  const articleMediaUrls = []; // Images from article content (cover + inline)
  const artResult = tweet.article?.article_results?.result;
  if (artResult) {
    isArticle = true;
    articleTitle = artResult.title || null;
    articlePreview = artResult.preview_text || '';
    log(' Article detected for tweet', tweetId, '| title:', articleTitle, '| preview:', articlePreview?.substring(0, 60), '| has content_state:', !!artResult.content_state, '| keys:', Object.keys(artResult));

    // Log unexplored artResult fields for debugging
    if (artResult.media_entities) {
      log(' artResult.media_entities:', JSON.stringify(artResult.media_entities).substring(0, 1000));
    }
    if (artResult.metadata) {
      log(' artResult.metadata:', JSON.stringify(artResult.metadata).substring(0, 1000));
    }

    // Extract article cover image
    const coverUrl = artResult.cover_media?.media_info?.original_img_url
      || artResult.cover_media?.media_url_https;
    if (coverUrl) {
      articleMediaUrls.push(coverUrl);
      log(' Article cover image:', coverUrl);
    }

    // Extract images from artResult.media_entities (inline article images)
    if (artResult.media_entities) {
      const mediaEnts = Array.isArray(artResult.media_entities) ? artResult.media_entities : Object.values(artResult.media_entities);
      for (const me of mediaEnts) {
        const imgUrl = me?.media_info?.original_img_url || me?.media_url_https || me?.url;
        if (imgUrl && !articleMediaUrls.includes(imgUrl)) {
          articleMediaUrls.push(imgUrl);
          log(' Article inline image from media_entities:', imgUrl);
        }
      }
    }

    // Extract article body from Draft.js content_state
    if (artResult.content_state?.blocks?.length > 0) {
      const result = formatContentStateBlocks(artResult.content_state);
      articleBody = result.body;
      articleMediaUrls.push(...result.imageUrls);
      log(' Got full article body:', articleBody.length, 'chars from', artResult.content_state.blocks.length, 'blocks,', articleMediaUrls.length, 'images');
    }
  }

  // Extract media URLs with proper video support
  const mediaUrls = [];
  let hasUnresolvedVideo = false;
  // For articles, start with article-specific media (cover + inline images)
  if (isArticle && articleMediaUrls.length > 0) {
    mediaUrls.push(...articleMediaUrls);
  }
  const mediaEntries = legacy.extended_entities?.media || [];
  for (const m of mediaEntries) {
    if (m.type === 'video' || m.type === 'animated_gif') {
      const variants = m.video_info?.variants || [];
      const mp4s = variants.filter(v => v.content_type === 'video/mp4' && v.url);
      if (mp4s.length > 0) {
        mp4s.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
        mediaUrls.push(mp4s[0].url);
      } else {
        hasUnresolvedVideo = true;
      }
    } else {
      const url = m.media_url_https || m.media_url || '';
      // Avoid duplicate with article cover
      if (url && !mediaUrls.includes(url)) mediaUrls.push(url);
    }
  }

  // Determine body text: article body > article preview > note tweet > regular tweet text
  let bodyText = '';
  if (isArticle && articleBody) {
    bodyText = articleBody;
  } else if (isArticle && articlePreview) {
    bodyText = articlePreview;
  } else if (noteTweet?.text) {
    bodyText = noteTweet.text;
  } else {
    bodyText = legacy.full_text || '';
  }

  // Thread detection: conversation_id differs from tweet's own ID
  const conversationId = legacy.conversation_id || tweetId;
  const isThread = conversationId !== tweetId;

  const sourceType = detectSourceType(bodyText, mediaUrls, isArticle, isThread);

  tweetCache.set(tweetId, {
    external_id: tweetId,
    source_url: user.screen_name
      ? `https://x.com/${user.screen_name}/status/${tweetId}`
      : `https://x.com/i/web/status/${tweetId}`,
    source_type: sourceType,
    conversation_id: conversationId,
    author_handle: user.screen_name || null,
    author_display_name: user.name || null,
    author_avatar_url: avatarUrl,
    title: isArticle ? articleTitle : null,
    body_text: bodyText,
    posted_at: legacy.created_at ? new Date(legacy.created_at).toISOString() : null,
    media_urls: mediaUrls,
    _hasUnresolvedVideo: hasUnresolvedVideo,
    _cachedAt: Date.now(),
    likes: legacy.favorite_count || null,
    retweets: legacy.retweet_count || null,
    replies: legacy.reply_count || null,
    views: tweet.views?.count ? parseInt(tweet.views.count) : null,
  });
}


// --- DOM Extraction Fallback ---
function extractTweetFromDOM(tweetElement) {
  const statusLink = tweetElement.querySelector('a[href*="/status/"]');
  if (!statusLink) return null;

  const match = statusLink.href.match(/\/([^/]+)\/status\/(\d+)/);
  if (!match) return null;

  const authorHandle = match[1];
  const tweetId = match[2];

  // Check API cache first — video resolution happens in background.js
  if (tweetCache.has(tweetId)) {
    const cached = tweetCache.get(tweetId);
    // For articles with truncated body, try to get full content
    if (cached.source_type === 'article' && (!cached.body_text || cached.body_text.length < 500)) {
      const fullBody = extractArticleBodyFromDOM();
      if (fullBody && fullBody.length > (cached.body_text?.length || 0)) {
        cached.body_text = fullBody;
      }
    }
    // Return a clean copy without internal fields
    const data = { ...cached };
    delete data._hasUnresolvedVideo;
    delete data._cachedAt;
    return data;
  }

  // Fall back to DOM extraction
  const tweetTextEl = tweetElement.querySelector('[data-testid="tweetText"]');
  const bodyText = tweetTextEl ? tweetTextEl.innerText : '';

  // Extract display name
  const nameContainer = tweetElement.querySelector('[data-testid="User-Name"]');
  let displayName = null;
  if (nameContainer) {
    const spans = nameContainer.querySelectorAll('span');
    for (const span of spans) {
      const text = span.innerText.trim();
      if (text && !text.startsWith('@') && text.length > 0) {
        displayName = text;
        break;
      }
    }
  }

  // Extract avatar URL from the tweet's profile image
  let avatarUrl = null;
  const avatarImg = tweetElement.querySelector('[data-testid="Tweet-User-Avatar"] img');
  if (avatarImg?.src) {
    avatarUrl = avatarImg.src.replace('_normal.', '_400x400.');
  }

  // Extract media URLs
  const mediaUrls = [];
  tweetElement.querySelectorAll('[data-testid="tweetPhoto"] img').forEach(img => {
    if (img.src && !img.src.includes('emoji')) mediaUrls.push(img.src);
  });

  // For videos: grab poster as placeholder — background.js will resolve to actual mp4
  let hasVideo = false;
  tweetElement.querySelectorAll('[data-testid="videoPlayer"] video').forEach(vid => {
    hasVideo = true;
    if (vid.poster) mediaUrls.push(vid.poster);
  });

  return {
    external_id: tweetId,
    source_url: `https://x.com/${authorHandle}/status/${tweetId}`,
    source_type: 'tweet',
    conversation_id: null,
    author_handle: authorHandle,
    author_display_name: displayName,
    author_avatar_url: avatarUrl,
    body_text: bodyText,
    posted_at: null,
    media_urls: mediaUrls,
    _hasUnresolvedVideo: hasVideo,
    likes: null,
    retweets: null,
    replies: null,
    views: null,
  };
}


// --- Article Body DOM Extraction ---
function extractArticleBodyFromDOM() {
  // Try to extract full article content from the page DOM.
  // When viewing an X Article page, the article body is rendered in the DOM.
  const mainColumn = document.querySelector('[data-testid="primaryColumn"]');
  if (!mainColumn) return null;

  // Strategy 1: Look for article body container (X articles use specific containers)
  // The article content is typically rendered after the tweet's action bar
  const articleContainers = mainColumn.querySelectorAll(
    '[data-testid="article-body"], [data-testid="articleBody"], [role="article"]'
  );
  for (const container of articleContainers) {
    const text = extractTextFromContainer(container);
    if (text && text.length > 200) {
      log(' Found article body via container selector:', text.length, 'chars');
      return text;
    }
  }

  // Strategy 2: Look for rich text blocks in the main content area
  // X articles render paragraphs as individual div/span elements within a specific area
  // After the tweet element, look for long text content
  const tweets = mainColumn.querySelectorAll('article[data-testid="tweet"]');
  if (tweets.length > 0) {
    const firstTweet = tweets[0];
    // Look for text content AFTER the tweet that could be article body
    const tweetContainer = firstTweet.closest('[data-testid="cellInnerDiv"]');
    if (tweetContainer) {
      let sibling = tweetContainer.nextElementSibling;
      const paragraphs = [];
      while (sibling) {
        // Collect text from subsequent content cells
        const textEls = sibling.querySelectorAll('span, p, div[dir="auto"]');
        for (const el of textEls) {
          const text = el.innerText?.trim();
          // Only collect substantial text blocks (not UI elements)
          if (text && text.length > 20 && !el.closest('a[role="link"]') && !el.closest('[data-testid="User-Name"]')) {
            // Avoid duplicate text from parent/child elements
            if (!paragraphs.some(p => p.includes(text) || text.includes(p))) {
              paragraphs.push(text);
            }
          }
        }
        sibling = sibling.nextElementSibling;
      }
      if (paragraphs.length > 2) {
        const fullText = paragraphs.join('\n\n');
        if (fullText.length > 200) {
          log(' Found article body via sibling traversal:', fullText.length, 'chars,', paragraphs.length, 'paragraphs');
          return fullText;
        }
      }
    }
  }

  return null;
}

function extractTextFromContainer(container) {
  // Extract text content from a container, preserving paragraph structure
  const blocks = [];
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  let currentBlock = '';
  let node;
  while ((node = walker.nextNode())) {
    const text = node.textContent.trim();
    if (!text) {
      if (currentBlock) {
        blocks.push(currentBlock);
        currentBlock = '';
      }
      continue;
    }
    // Check if this is a block-level boundary
    const parent = node.parentElement;
    const display = window.getComputedStyle(parent).display;
    if (display === 'block' || parent.tagName === 'P' || parent.tagName === 'DIV') {
      if (currentBlock) blocks.push(currentBlock);
      currentBlock = text;
    } else {
      currentBlock += (currentBlock ? ' ' : '') + text;
    }
  }
  if (currentBlock) blocks.push(currentBlock);
  return blocks.filter(b => b.length > 5).join('\n\n');
}


// --- Per-Tweet Save Buttons ---
const BUTTON_ATTR = 'data-feedsilo-btn';

function injectSaveButtons() {
  const tweets = document.querySelectorAll('article[data-testid="tweet"]');

  tweets.forEach(tweet => {
    const actionBar = tweet.querySelector('div[role="group"]');
    if (!actionBar || actionBar.querySelector(`[${BUTTON_ATTR}]`)) return;

    const btn = document.createElement('button');
    btn.setAttribute(BUTTON_ATTR, 'true');
    btn.className = 'feedsilo-save-btn';
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`;
    btn.title = 'Save to FeedSilo';

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      btn.classList.add('saving');

      // Try to expand long tweets first
      const showMore = tweet.querySelector('[data-testid="tweet-text-show-more-link"]');
      if (showMore) {
        showMore.click();
        await new Promise(r => setTimeout(r, 800));
      }

      const data = await extractTweetFromDOM(tweet);
      if (!data) {
        btn.classList.remove('saving');
        btn.classList.add('error');
        return;
      }

      log(' sending capture data', JSON.stringify(data, null, 2));
      chrome.runtime.sendMessage({ type: 'CAPTURE_TWEET', data }, (response) => {
        log(' capture response', response);
        btn.classList.remove('saving');
        if (chrome.runtime.lastError) {
          console.error('FeedSilo: runtime error', chrome.runtime.lastError);
          btn.classList.add('error');
          setTimeout(() => resetButton(btn), 3000);
          return;
        }
        if (response?.success) {
          if (response.already_exists) {
            btn.classList.add('dupe');
            btn.innerHTML = 'DUPE';
            setTimeout(() => resetButton(btn), 3000);
          } else {
            btn.classList.add('saved');
            btn.innerHTML = '&#10003;';
          }
        } else {
          btn.classList.add('error');
          console.error('FeedSilo save failed:', response?.error);
          setTimeout(() => resetButton(btn), 3000);
        }
      });
    });

    actionBar.appendChild(btn);
  });
}

function resetButton(btn) {
  btn.className = 'feedsilo-save-btn';
  btn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`;
}

// --- DOM Initialization ---
// Since we run at document_start (to intercept fetch early), wait for DOM before touching it
function initDOM() {
  // Observe DOM for new tweets (X loads content dynamically)
  const observer = new MutationObserver(() => injectSaveButtons());
  observer.observe(document.body, { childList: true, subtree: true });
  injectSaveButtons(); // Initial injection
}

if (document.body) {
  initDOM();
} else {
  document.addEventListener('DOMContentLoaded', initDOM);
}


// --- Thread Detection ---
// Adapted from PromptSilo: skip reply tweets during bulk capture
function isThreadReply(tweetElement) {
  // Check for visual thread connector line
  const cell = tweetElement.closest('[data-testid="cellInnerDiv"]');
  if (!cell) return false;

  // Check for "Replying to" text
  const textContent = cell.textContent || '';
  if (/Replying to\s+@\w+/i.test(textContent)) return true;

  // Check for thread connector (thin vertical line)
  const connector = cell.querySelector('div[style*="width: 2px"]');
  if (connector) return true;

  return false;
}


// --- Bulk Capture ---
let isBulkCapturing = false;
let bulkStats = { total: 0, captured: 0, skipped: 0, errors: 0 };
const processedIds = new Set();

// Listen for bulk capture trigger from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_BULK_CAPTURE') {
    if (isBulkCapturing) {
      sendResponse({ started: false, reason: 'Already running' });
      return;
    }
    startBulkCapture();
    sendResponse({ started: true });
  }

  if (message.type === 'STOP_BULK_CAPTURE') {
    isBulkCapturing = false;
    sendResponse({ stopped: true });
  }
});

function createHUD() {
  const existing = document.getElementById('feedsilo-hud');
  if (existing) existing.remove();

  const hud = document.createElement('div');
  hud.id = 'feedsilo-hud';
  hud.innerHTML = `
    <div class="feedsilo-hud-header">
      <span>FeedSilo CAPTURE</span>
      <button id="feedsilo-hud-stop">STOP</button>
    </div>
    <div class="feedsilo-hud-stats">
      <div>SCANNED <span id="feedsilo-stat-total">0</span></div>
      <div class="stat-captured">CAPTURED <span id="feedsilo-stat-captured">0</span></div>
      <div class="stat-skipped">SKIPPED <span id="feedsilo-stat-skipped">0</span></div>
    </div>
  `;
  document.body.appendChild(hud);

  document.getElementById('feedsilo-hud-stop').addEventListener('click', () => {
    isBulkCapturing = false;
  });

  return hud;
}

function updateHUD() {
  const el = (id) => document.getElementById(id);
  const totalEl = el('feedsilo-stat-total');
  const capturedEl = el('feedsilo-stat-captured');
  const skippedEl = el('feedsilo-stat-skipped');
  if (totalEl) totalEl.textContent = bulkStats.total;
  if (capturedEl) capturedEl.textContent = bulkStats.captured;
  if (skippedEl) skippedEl.textContent = bulkStats.skipped;
}

async function startBulkCapture() {
  isBulkCapturing = true;
  bulkStats = { total: 0, captured: 0, skipped: 0, errors: 0 };
  processedIds.clear();

  const hud = createHUD();
  let unchangedScrollCount = 0;
  let lastScrollHeight = 0;

  while (isBulkCapturing) {
    // Collect all visible tweets
    const tweets = document.querySelectorAll('article[data-testid="tweet"]');
    const batch = [];

    for (const tweet of tweets) {
      const statusLink = tweet.querySelector('a[href*="/status/"]');
      if (!statusLink) continue;

      const match = statusLink.href.match(/\/status\/(\d+)/);
      if (!match) continue;

      const tweetId = match[1];

      // Skip already processed
      if (processedIds.has(tweetId)) continue;
      processedIds.add(tweetId);
      bulkStats.total++;

      // Skip thread replies
      if (isThreadReply(tweet)) {
        bulkStats.skipped++;
        updateHUD();
        continue;
      }

      // Try expanding long tweets
      const showMore = tweet.querySelector('[data-testid="tweet-text-show-more-link"]');
      if (showMore) {
        showMore.click();
        await new Promise(r => setTimeout(r, 500));
      }

      const data = await extractTweetFromDOM(tweet);
      if (data) {
        batch.push(data);
        // Visual feedback
        tweet.style.borderLeft = '3px solid #00ffc8';
      }
    }

    // Send batch to server
    if (batch.length > 0) {
      const response = await new Promise(resolve => {
        chrome.runtime.sendMessage({ type: 'CAPTURE_BULK', items: batch }, resolve);
      });

      if (response?.success) {
        bulkStats.captured += response.captured || 0;
        bulkStats.skipped += response.skipped || 0;
        bulkStats.errors += response.errors || 0;
      }
      updateHUD();
    }

    // Scroll down
    const currentHeight = document.body.scrollHeight;
    if (currentHeight === lastScrollHeight) {
      unchangedScrollCount++;
      if (unchangedScrollCount >= 15) {
        // End of feed reached
        break;
      }
    } else {
      unchangedScrollCount = 0;
    }
    lastScrollHeight = currentHeight;

    window.scrollBy({ top: 800, behavior: 'smooth' });
    await new Promise(r => setTimeout(r, 2000));
  }

  // Capture complete
  isBulkCapturing = false;
  const hudHeader = document.querySelector('.feedsilo-hud-header span');
  if (hudHeader) hudHeader.textContent = 'CAPTURE COMPLETE';
  const stopBtn = document.getElementById('feedsilo-hud-stop');
  if (stopBtn) {
    stopBtn.textContent = 'CLOSE';
    stopBtn.addEventListener('click', () => {
      document.getElementById('feedsilo-hud')?.remove();
    });
  }
}
