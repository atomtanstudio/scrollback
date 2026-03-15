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
  } catch {
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
// Comprehensive AI tool detection with context-aware matching.
// Bare tool name mentions are NOT enough — requires generation context.

const STRONG_PROMPT_PATTERNS = [
  /--ar\s+\d+:\d+/,
  /--v\s+[\d.]+/,
  /--style\s+\w+/,
  /--q\s+[\d.]+/,
  /--s\s+\d+/,
  /--c\s+\d+/,
  /--niji\b/,
  /\/imagine\b/,
  /\bcfg[\s_]?scale\b/i,
  /\bsampler[\s:]+\w*(euler|dpm|ddim|uni_pc|heun)/i,
  /\bdenoising[\s_]?strength\b/i,
  /\bnegative[\s_]?prompt\b/i,
  /\bcheckpoint[\s:]/i,
  /\blora[\s:]/i,
  /\bcontrolnet\b/i,
  /\btxt2img\b/i,
  /\bimg2img\b/i,
  /\btxt2vid\b/i,
  /\bimg2vid\b/i,
  /\bt2i\b/,
  /\bi2v\b/,
  /\bt2v\b/,
];

const IMAGE_TOOLS = [
  "midjourney", "dall-?e(?:\\s*[23])?", "stable\\s*diffusion", "sdxl", "sd3",
  "flux", "grok\\s*(?:imagine|aurora)", "aurora", "imagen(?:\\s*[234])?",
  "ideogram", "firefly", "reve\\s*image",
  "leonardo\\.?ai", "leonardo\\s+ai", "playground\\s*(?:ai|v[23])?",
  "nightcafe", "nano\\s*banana", "bing\\s*image\\s*creator", "seedream",
  "recraft", "krea(?:\\s*ai)?", "comfyui", "a1111", "automatic1111",
  "dreamstudio", "tensor\\.?art", "civitai",
];

const VIDEO_TOOLS = [
  "sora", "veo(?:\\s*[23])?", "runway(?:\\s*(?:gen-?[1234]|ml))?",
  "kling(?:\\s*(?:ai|[12]\\.[05]))?", "pika(?:\\s*(?:labs|[12]\\.[05]))?",
  "luma(?:\\s*(?:dream\\s*machine|ai|labs|ray2?))?", "dream\\s*machine",
  "hailuo(?:\\s*ai)?", "minimax(?:\\s*video)?", "seedance",
  "wan(?:\\s*2\\.[12])?", "hunyuan(?:\\s*video)?",
  "stable\\s*video(?:\\s*diffusion)?", "pixverse", "jimeng", "genmo",
  "mochi", "movie\\s*gen", "haiper", "animatediff", "cogvideo(?:x)?",
  "ltx\\s*(?:video|studio)", "domo\\s*ai", "viggle(?:\\s*ai)?",
];

const PROMPT_LANG = [
  /\bprompt\s*:/i,
  /\b(?:image|video)\s+prompt\b/i,
  /\bhere(?:'s| is) (?:the|my) prompt\b/i,
  /\bprompt (?:I |i )used\b/i,
  /\bsharing (?:the|my) prompt\b/i,
];
const ART_CUES = [
  /\bstyle\s+reference\b/i,
  /\bsref\s+club\b/i,
  /\bprompt\s+share\b/i,
  /\bprompt\s+template\b/i,
  /\bmade\s+with\b/i,
  /\bgenerated\s+with\b/i,
  /\bcreated\s+with\b/i,
  /\brendered\s+with\b/i,
  /\bremix(?:ed)?\b/i,
  /\bai\s+(?:art|video|image)\b/i,
  /\bworkflow\b/i,
  /\bshowcase\b/i,
  /\b--sref\b/i,
];
const NON_ART_CUES = [
  /\binfographic\b/i,
  /\bdashboard\b/i,
  /\binterface\b/i,
  /\bbrowser\b/i,
  /\bscreenshot\b/i,
  /\bwebsite\b/i,
  /\blanding page\b/i,
  /\bgithub\b/i,
  /\brepositor(?:y|ies)\b/i,
  /\brepo\b/i,
  /\bdocs?\b/i,
  /\bdocumentation\b/i,
  /\bcheatsheet\b/i,
  /\blogo concepts?\b/i,
  /\bclaude code\b/i,
  /\bopenclaw\b/i,
  /\bcloudflare\b/i,
  /\bskill(?:s)?\b/i,
  /\btask board\b/i,
  /\bstartup ideas\b/i,
];

function hasExplicitPromptSnippet(text) {
  const normalized = (text || '').replace(/\s+/g, ' ').trim();
  const directPatterns = [
    /(?:^|\b)(?:image|video)?\s*prompt\s*:\s*(.{20,400})/i,
    /\bhere(?:'s| is) (?:the|my) prompt\b[:\s-]*(.{20,400})/i,
    /\bprompt (?:i|I) used\b[:\s-]*(.{20,400})/i,
    /\bsharing (?:the|my) prompt\b[:\s-]*(.{20,400})/i,
  ];

  return directPatterns.some((pattern) => {
    const match = normalized.match(pattern);
    if (!match || !match[1]) return false;
    return match[1].trim().split(/\s+/).filter(Boolean).length >= 5;
  });
}

function hasArtGenerationContext(text, hasVideo) {
  const normalized = (text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return false;

  const imageGroup = IMAGE_TOOLS.join('|');
  const videoGroup = VIDEO_TOOLS.join('|');
  const hasImageTool = new RegExp(`\\b(?:${imageGroup})\\b`, 'i').test(normalized);
  const hasVideoTool = new RegExp(`\\b(?:${videoGroup})\\b`, 'i').test(normalized);
  const hasCue = ART_CUES.some((pattern) => pattern.test(normalized));

  if (/\b--sref\s+\d+/i.test(normalized)) return true;
  if (hasCue && (hasImageTool || hasVideoTool)) return true;
  if (hasVideo && hasVideoTool) return true;

  return false;
}

function looksLikeNonArtVisualContent(text) {
  const normalized = (text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return false;
  return NON_ART_CUES.some((pattern) => pattern.test(normalized));
}

function detectSourceType(bodyText, mediaUrls, isArticle, isThread) {
  if (isArticle) return 'article';
  if (isThread) return 'thread';
  if (mediaUrls.length === 0 || !bodyText) return 'tweet';

  const hasVideo = mediaUrls.some(u => u.includes('.mp4') || u.includes('video'));

  // Level 1: Strong prompt syntax (high confidence, no context needed)
  for (const pat of STRONG_PROMPT_PATTERNS) {
    if (pat.test(bodyText)) {
      return hasVideo ? 'video_prompt' : 'image_prompt';
    }
  }

  // Level 2: Explicit prompt-sharing
  const imageGroup = IMAGE_TOOLS.join('|');
  const videoGroup = VIDEO_TOOLS.join('|');
  if (hasExplicitPromptSnippet(bodyText)) {
    return (hasVideo || new RegExp(`\\b(?:${videoGroup})\\b`, 'i').test(bodyText))
      ? 'video_prompt'
      : 'image_prompt';
  }

  // Level 3: Prompt-sharing language + tool mention
  const hasPromptLang = PROMPT_LANG.some(p => p.test(bodyText));
  if (hasPromptLang) {
    if (hasVideo && new RegExp(`\\b(?:${videoGroup})\\b`, 'i').test(bodyText)) return 'video_prompt';
    if (new RegExp(`\\b(?:${imageGroup})\\b`, 'i').test(bodyText)) return 'image_prompt';
    if (new RegExp(`\\b(?:${videoGroup})\\b`, 'i').test(bodyText)) return hasVideo ? 'video_prompt' : 'image_prompt';
  }

  // Level 4: Art showcase context without prompt text.
  if (!looksLikeNonArtVisualContent(bodyText) && hasArtGenerationContext(bodyText, hasVideo)) {
    return (hasVideo || new RegExp(`\\b(?:${videoGroup})\\b`, 'i').test(bodyText))
      ? 'video_prompt'
      : 'image_prompt';
  }

  // Tool mentions alone are still not enough.
  return 'tweet';
}

function unwrapTweetResult(result) {
  if (!result || typeof result !== 'object') return null;
  if (result.rest_id && result.legacy) return result;
  if (result.tweet && result.tweet.rest_id && result.tweet.legacy) return result.tweet;
  if (result.result) return unwrapTweetResult(result.result);
  return null;
}

function appendMediaEntries(mediaEntries, mediaUrls) {
  let hasUnresolvedVideo = false;

  for (const m of mediaEntries || []) {
    if (m.type === 'video' || m.type === 'animated_gif') {
      const variants = m.video_info?.variants || [];
      const mp4s = variants.filter(v => v.content_type === 'video/mp4' && v.url);
      if (mp4s.length > 0) {
        mp4s.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
        if (!mediaUrls.includes(mp4s[0].url)) mediaUrls.push(mp4s[0].url);
      } else {
        hasUnresolvedVideo = true;
        if (m.media_url_https && !mediaUrls.includes(m.media_url_https)) {
          mediaUrls.push(m.media_url_https);
        }
      }
    } else {
      const url = m.media_url_https || m.media_url || '';
      if (url && !mediaUrls.includes(url)) mediaUrls.push(url);
    }
  }

  return hasUnresolvedVideo;
}

function cacheTweetData(tweet) {
  const tweetId = tweet.rest_id;
  if (!tweetId) return;

  const legacy = tweet.legacy || {};
  // User data can be nested differently depending on the API response shape
  const userResult = tweet.core?.user_results?.result;
  const user = userResult?.legacy
    || userResult?.result?.legacy  // wrapped in extra result
    || tweet.user?.legacy          // alternate path
    || {};
  // screen_name may also be at the top-level user_results (non-legacy path)
  const screenName = user.screen_name
    || userResult?.screen_name
    || userResult?.result?.screen_name
    || legacy.user_id_str && null  // can't resolve from just user_id
    || null;
  const noteTweet = tweet.note_tweet?.note_tweet_results?.result;
  const existingEntry = tweetCache.get(tweetId);

  // Get avatar URL - upgrade to full size by removing _normal suffix
  const avatarRaw = user.profile_image_url_https || null;
  const avatarUrl = avatarRaw ? avatarRaw.replace('_normal.', '_400x400.') : null;
  const replyToHandle = normalizeHandle(
    legacy.in_reply_to_screen_name || existingEntry?._replyToHandle || null
  ) || null;

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
  hasUnresolvedVideo = appendMediaEntries(legacy.extended_entities?.media || [], mediaUrls) || hasUnresolvedVideo;

  const quotedTweet = unwrapTweetResult(tweet.quoted_status_result) || unwrapTweetResult(tweet.quoted_tweet);
  if (quotedTweet) {
    hasUnresolvedVideo = appendMediaEntries(quotedTweet.legacy?.extended_entities?.media || [], mediaUrls) || hasUnresolvedVideo;
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
  // X API uses conversation_id_str (string), not conversation_id
  let conversationId = legacy.conversation_id_str || legacy.conversation_id || tweetId;
  // Preserve a good conversation_id from a previous cache hit — some API responses
  // return the same tweet without conversation_id_str, which would overwrite the good value
  if (conversationId === tweetId && existingEntry?.conversation_id && existingEntry.conversation_id !== tweetId) {
    conversationId = existingEntry.conversation_id;
  }
  const sourceType = detectSourceType(bodyText, mediaUrls, isArticle, false);

  // Preserve existing author info if this API response doesn't have it
  const finalScreenName = screenName || existingEntry?.author_handle || null;
  const finalDisplayName = user.name || existingEntry?.author_display_name || null;
  const finalAvatarUrl = avatarUrl || existingEntry?.author_avatar_url || null;

  tweetCache.set(tweetId, {
    external_id: tweetId,
    source_url: finalScreenName
      ? `https://x.com/${finalScreenName}/status/${tweetId}`
      : `https://x.com/i/web/status/${tweetId}`,
    source_type: sourceType,
    conversation_id: conversationId,
    author_handle: finalScreenName,
    author_display_name: finalDisplayName,
    author_avatar_url: finalAvatarUrl,
    title: isArticle ? articleTitle : null,
    body_text: bodyText,
    posted_at: legacy.created_at ? new Date(legacy.created_at).toISOString() : null,
    media_urls: mediaUrls,
    _hasUnresolvedVideo: hasUnresolvedVideo,
    _replyToHandle: replyToHandle,
    _cachedAt: Date.now(),
    likes: legacy.favorite_count || null,
    retweets: legacy.retweet_count || null,
    replies: legacy.reply_count || null,
    views: tweet.views?.count ? parseInt(tweet.views.count) : null,
  });

  // Detect self-threads: if 2+ tweets from the same author share a conversation_id,
  // mark ALL of them as "thread" (including the root tweet where conversation_id === tweet.id)
  detectSelfThreadInCache(conversationId);
}

function detectSelfThreadInCache(conversationId) {
  if (!conversationId) return;

  // Collect all cached tweets in this conversation
  const siblings = [];
  for (const [, data] of tweetCache) {
    if (data.conversation_id === conversationId) siblings.push(data);
  }
  if (siblings.length < 2) return;

  // Count tweets per author in this conversation
  const authorCounts = {};
  for (const s of siblings) {
    const author = (s.author_handle || '').toLowerCase();
    if (author && isLikelySelfThreadEntry(s, author, conversationId)) {
      authorCounts[author] = (authorCounts[author] || 0) + 1;
    }
  }

  // If any author has 2+ tweets in the same conversation, it's a self-thread
  for (const [author, count] of Object.entries(authorCounts)) {
    if (count >= 2) {
      for (const s of siblings) {
        if (isLikelySelfThreadEntry(s, author, conversationId)
            && (s.source_type === 'tweet' || s.source_type === 'image_prompt' || s.source_type === 'video_prompt')) {
          // Only upgrade to thread if it's not an article
          // Keep prompt classification if it was detected — just change the base type
          s.source_type = 'thread';
        }
      }
    }
  }
}

function normalizeHandle(handle) {
  return (handle || '').replace(/^@/, '').trim().toLowerCase();
}

function isLikelySelfThreadEntry(item, authorHandle, conversationId) {
  const author = normalizeHandle(authorHandle);
  if (!author) return false;
  if (normalizeHandle(item.author_handle) !== author) return false;

  const replyToHandle = normalizeHandle(item._replyToHandle);
  const itemConversationId = item.conversation_id || item.external_id || null;
  const rootConversationId = conversationId || itemConversationId;
  const isRootTweet = !!rootConversationId && item.external_id === rootConversationId;

  if (isRootTweet) return true;
  if (!replyToHandle || replyToHandle !== author) return false;
  if (!rootConversationId || !itemConversationId) return true;

  return itemConversationId === rootConversationId;
}

function stripInternalCaptureFields(item) {
  const clean = { ...item };
  delete clean._hasUnresolvedVideo;
  delete clean._cachedAt;
  delete clean._replyToHandle;
  return clean;
}


// --- DOM Extraction Fallback ---
function extractTweetFromDOM(tweetElement, options = {}) {
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
    // Backfill missing author info from DOM (API sometimes omits user data)
    if (!cached.author_handle || !cached.author_display_name || !cached.author_avatar_url) {
      const nameContainer = tweetElement.querySelector('[data-testid="User-Name"]');
      if (nameContainer) {
        if (!cached.author_handle) {
          const handleEl = nameContainer.querySelector('a[href*="/"]');
          if (handleEl) {
            const href = handleEl.getAttribute('href');
            const handleMatch = href?.match(/^\/([^/]+)/);
            if (handleMatch) cached.author_handle = handleMatch[1];
          }
        }
        if (!cached.author_display_name) {
          const spans = nameContainer.querySelectorAll('span');
          for (const span of spans) {
            const text = span.innerText.trim();
            if (text && !text.startsWith('@') && text.length > 0) {
              cached.author_display_name = text;
              break;
            }
          }
        }
      }
      if (!cached.author_avatar_url) {
        const avatarImg = tweetElement.querySelector('[data-testid="Tweet-User-Avatar"] img');
        if (avatarImg?.src) {
          cached.author_avatar_url = avatarImg.src.replace('_normal.', '_400x400.');
        }
      }
      // Fix source_url if it's the fallback /i/web/ format
      if (cached.author_handle && cached.source_url.includes('/i/web/status/')) {
        cached.source_url = `https://x.com/${cached.author_handle}/status/${cached.external_id}`;
      }
    }
    // Last-chance self-thread detection: re-check cache + DOM right before returning
    if (cached.source_type === 'tweet' || cached.source_type === 'image_prompt' || cached.source_type === 'video_prompt') {
      // Re-run cache-based detection (replies may have loaded since initial cache)
      detectSelfThreadInCache(cached.conversation_id);
      // If cache detection didn't upgrade, try DOM-based detection
      if (cached.source_type !== 'thread' && isSelfThreadOnPage(tweetElement)) {
        cached.source_type = 'thread';
      }
    }

    // Return a clean copy without internal fields
    return options.includeInternal ? { ...cached } : stripInternalCaptureFields(cached);
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

  // Check if this tweet is part of a self-thread via DOM signals
  const isThread = isSelfThreadOnPage(tweetElement);
  const sourceType = isThread ? 'thread' : detectSourceType(bodyText, mediaUrls, false, false);
  const replyToHandle = getReplyingToHandleFromTweetElement(tweetElement);

  return {
    external_id: tweetId,
    source_url: `https://x.com/${authorHandle}/status/${tweetId}`,
    source_type: sourceType,
    conversation_id: null,
    author_handle: authorHandle,
    author_display_name: displayName,
    author_avatar_url: avatarUrl,
    body_text: bodyText,
    posted_at: null,
    media_urls: mediaUrls,
    _hasUnresolvedVideo: hasVideo,
    _replyToHandle: replyToHandle,
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

      let threadItems = [];
      if (data.conversation_id && data.author_handle) {
        threadItems = getThreadSiblingsFromCache(data.conversation_id, data.author_handle);
      }
      if (threadItems.length < 2) {
        threadItems = await getThreadSiblingsFromDOM(tweet, data);
      }

      if (threadItems.length > 1) {
        const threadConversationId = threadItems[0].conversation_id || data.conversation_id || data.external_id;
        log(' Thread detected — saving', threadItems.length, 'tweets in conversation');
        chrome.runtime.sendMessage({ type: 'CAPTURE_BULK', items: threadItems }, (response) => {
          btn.classList.remove('saving');
          if (chrome.runtime.lastError) {
            console.error('FeedSilo: runtime error', chrome.runtime.lastError);
            btn.classList.add('error');
            setTimeout(() => resetButton(btn), 3000);
            return;
          }
          if (response?.success) {
            const total = (response.captured || 0) + (response.skipped || 0);
            btn.classList.add('saved');
            btn.innerHTML = `&#10003; ${total}`;
            // Mark all other thread tweets' save buttons as saved too
            markThreadButtonsSaved(threadConversationId, data.author_handle);
          } else {
            btn.classList.add('error');
            console.error('FeedSilo thread save failed:', response?.error);
            setTimeout(() => resetButton(btn), 3000);
          }
        });
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

// Collect all thread siblings from cache for a given conversation + author
function getThreadSiblingsFromCache(conversationId, authorHandle) {
  const author = normalizeHandle(authorHandle);
  const siblings = [];
  // First pass: find a sibling with full author info to use for backfill
  let refDisplayName = null;
  let refAvatarUrl = null;
  let refSourceUrl = null;
  for (const [, data] of tweetCache) {
    if (data.conversation_id !== conversationId) continue;
    if (data.author_display_name && !refDisplayName) refDisplayName = data.author_display_name;
    if (data.author_avatar_url && !refAvatarUrl) refAvatarUrl = data.author_avatar_url;
    if (data.source_url && !data.source_url.includes('/i/web/') && !refSourceUrl) refSourceUrl = data.source_url;
  }
  for (const [, data] of tweetCache) {
    if (data.conversation_id !== conversationId) continue;
    if (isLikelySelfThreadEntry(data, author, conversationId)) {
      // Backfill missing author info from reference sibling
      const clean = { ...data };
      if (!clean.author_handle && author) clean.author_handle = author;
      if (!clean.author_display_name && refDisplayName) clean.author_display_name = refDisplayName;
      if (!clean.author_avatar_url && refAvatarUrl) clean.author_avatar_url = refAvatarUrl;
      if (clean.source_url?.includes('/i/web/') && clean.author_handle) {
        clean.source_url = `https://x.com/${clean.author_handle}/status/${clean.external_id}`;
      }
      siblings.push(stripInternalCaptureFields(clean));
    }
  }
  // Sort by posted_at to maintain thread order (oldest first)
  siblings.sort((a, b) => {
    if (!a.posted_at || !b.posted_at) return 0;
    return new Date(a.posted_at).getTime() - new Date(b.posted_at).getTime();
  });
  return siblings;
}

function getAuthorHandleFromTweetElement(tweetElement) {
  if (!tweetElement) return null;
  const link = tweetElement.querySelector('a[href*="/status/"]');
  const match = link?.href.match(/\/([^/]+)\/status\//);
  return match ? normalizeHandle(match[1]) : null;
}

function getReplyingToHandleFromTweetElement(tweetElement) {
  const cell = tweetElement?.closest?.('[data-testid="cellInnerDiv"]') || tweetElement;
  const textContent = cell?.textContent || '';
  const match = textContent.match(/Replying to\s+@([A-Za-z0-9_]+)/i);
  return match ? normalizeHandle(match[1]) : null;
}

async function getThreadSiblingsFromDOM(tweetElement, seedData = null) {
  const authorHandle = normalizeHandle(seedData?.author_handle || getAuthorHandleFromTweetElement(tweetElement) || '');
  if (!authorHandle) return [];

  const seedConversationId = seedData?.conversation_id || seedData?.external_id || null;
  const visibleTweets = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
  const extracted = [];
  const seenIds = new Set();

  for (const visibleTweet of visibleTweets) {
    const item = await extractTweetFromDOM(visibleTweet, { includeInternal: true });
    if (!item || seenIds.has(item.external_id)) continue;
    seenIds.add(item.external_id);
    extracted.push(item);
  }

  const conversationId =
    extracted.find((item) => item.external_id === seedData?.external_id)?.conversation_id
    || extracted.find((item) => item.conversation_id === seedConversationId)?.conversation_id
    || seedConversationId
    || extracted[0]?.external_id
    || null;

  const threadItems = extracted
    .filter((item) => isLikelySelfThreadEntry(item, authorHandle, conversationId))
    .sort((a, b) => {
      if (!a.posted_at || !b.posted_at) return 0;
      return new Date(a.posted_at).getTime() - new Date(b.posted_at).getTime();
    });

  if (threadItems.length < 2) return [];

  return threadItems.map((item) => stripInternalCaptureFields({
    ...item,
    conversation_id: item.conversation_id || conversationId,
    source_type: item.source_type === 'article' ? item.source_type : 'thread',
  }));
}

// After saving a thread, mark all visible save buttons for those tweets as saved
function markThreadButtonsSaved(conversationId, authorHandle) {
  const author = normalizeHandle(authorHandle);
  const threadIds = new Set();
  for (const [id, data] of tweetCache) {
    if (isLikelySelfThreadEntry(data, author, conversationId)) {
      threadIds.add(id);
    }
  }

  document.querySelectorAll('article[data-testid="tweet"]').forEach(tweet => {
    const link = tweet.querySelector('a[href*="/status/"]');
    if (!link) return;
    const m = link.href.match(/\/status\/(\d+)/);
    if (!m || !threadIds.has(m[1])) return;
    const btn = tweet.querySelector(`[${BUTTON_ATTR}]`);
    if (btn && !btn.classList.contains('saved')) {
      btn.classList.remove('saving');
      btn.classList.add('saved');
      btn.innerHTML = '&#10003;';
    }
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

// Detect self-threads via DOM: checks if the current page shows multiple
// tweets from the same author connected in a thread (for fallback when cache misses)
function isSelfThreadOnPage(tweetElement) {
  const hasConnector = (el) => {
    const cell = el?.closest?.('[data-testid="cellInnerDiv"]');
    return !!cell?.querySelector('div[style*="width: 2px"]');
  };

  const authorHandle = getAuthorHandleFromTweetElement(tweetElement);
  if (!authorHandle) return false;

  const allTweets = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
  const index = allTweets.indexOf(tweetElement);
  if (index === -1) return false;

  const prevTweet = allTweets[index - 1] || null;
  const nextTweet = allTweets[index + 1] || null;
  const prevSameAuthor = getAuthorHandleFromTweetElement(prevTweet) === authorHandle;
  const nextSameAuthor = getAuthorHandleFromTweetElement(nextTweet) === authorHandle;

  if (!prevSameAuthor && !nextSameAuthor) return false;

  return (
    hasConnector(tweetElement) ||
    (prevSameAuthor && hasConnector(prevTweet)) ||
    (nextSameAuthor && hasConnector(nextTweet))
  );
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
    startBulkCapture(message.useApi || false);
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
      <div class="feedsilo-hud-title">
        <div class="feedsilo-hud-kicker">FeedSilo</div>
        <div class="feedsilo-hud-name">Capture run</div>
      </div>
      <button id="feedsilo-hud-stop">STOP</button>
    </div>
    <div class="feedsilo-hud-stats">
      <div>SCANNED <span id="feedsilo-stat-total">0</span></div>
      <div class="stat-captured">CAPTURED <span id="feedsilo-stat-captured">0</span></div>
      <div class="stat-skipped">SKIPPED <span id="feedsilo-stat-skipped">0</span></div>
      <div class="stat-errors" style="display:none">ERRORS <span id="feedsilo-stat-errors">0</span></div>
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
  const errorsEl = el('feedsilo-stat-errors');
  const errorsRow = errorsEl?.parentElement;
  if (totalEl) totalEl.textContent = bulkStats.total;
  if (capturedEl) capturedEl.textContent = bulkStats.captured;
  if (skippedEl) skippedEl.textContent = bulkStats.skipped;
  if (errorsEl) {
    errorsEl.textContent = bulkStats.errors;
    if (errorsRow) errorsRow.style.display = bulkStats.errors > 0 ? '' : 'none';
  }
}

async function startBulkCapture(useApi = false) {
  isBulkCapturing = true;
  bulkStats = { total: 0, captured: 0, skipped: 0, errors: 0 };
  processedIds.clear();

  createHUD();

  // Show API mode indicator in HUD
  if (useApi) {
    const header = document.querySelector('.feedsilo-hud-name');
    if (header) header.textContent = 'Capture run · API';
  }

  let unchangedScrollCount = 0;
  let lastScrollHeight = 0;

  while (isBulkCapturing) {
    // Collect all visible tweets
    const tweets = document.querySelectorAll('article[data-testid="tweet"]');
    const batch = [];        // DOM-extracted data (classic mode)
    const idBatch = [];      // Tweet IDs only (API mode)

    for (const tweet of tweets) {
      const statusLink = tweet.querySelector('a[href*="/status/"]');
      if (!statusLink) continue;

      const match = statusLink.href.match(/\/status\/(\d+)/);
      if (!match) continue;

      const tweetId = match[1];

      // Skip already processed
      if (processedIds.has(tweetId)) continue;
      processedIds.add(tweetId);

      // Skip thread replies (don't count in totals)
      if (isThreadReply(tweet)) continue;

      bulkStats.total++;

      if (useApi) {
        // API mode: just collect the tweet ID
        idBatch.push(tweetId);
        tweet.style.borderLeft = '3px solid #88aeb0';
      } else {
        // Classic mode: extract full data from DOM
        const showMore = tweet.querySelector('[data-testid="tweet-text-show-more-link"]');
        if (showMore) {
          showMore.click();
          await new Promise(r => setTimeout(r, 500));
        }

        const data = await extractTweetFromDOM(tweet);
        if (data) {
          batch.push(data);
          tweet.style.borderLeft = '3px solid #b89462';
        }
      }

      updateHUD();
    }

    // Send batch to server
    if (useApi && idBatch.length > 0) {
      // API mode: send tweet IDs for server-side X API fetch
      const response = await new Promise(resolve => {
        chrome.runtime.sendMessage({ type: 'CAPTURE_BULK_VIA_API', tweetIds: idBatch }, resolve);
      });

      if (response?.success) {
        bulkStats.captured += response.synced || 0;
        bulkStats.skipped += response.skipped || 0;
        bulkStats.errors += response.errors || 0;

        // DOM fallback for tweets the API couldn't fetch
        const missing = response.missingIds || [];
        if (missing.length > 0) {
          log('API missed', missing.length, 'tweets, trying DOM fallback');
          const fallbackBatch = [];
          const visibleTweets = document.querySelectorAll('article[data-testid="tweet"]');
          for (const tweet of visibleTweets) {
            const link = tweet.querySelector('a[href*="/status/"]');
            if (!link) continue;
            const m = link.href.match(/\/status\/(\d+)/);
            if (!m || !missing.includes(m[1])) continue;
            const showMore = tweet.querySelector('[data-testid="tweet-text-show-more-link"]');
            if (showMore) { showMore.click(); await new Promise(r => setTimeout(r, 500)); }
            const data = await extractTweetFromDOM(tweet);
            if (data) {
              fallbackBatch.push(data);
              tweet.style.borderLeft = '3px solid #d78181';
            }
          }
          if (fallbackBatch.length > 0) {
            const fbResponse = await new Promise(resolve => {
              chrome.runtime.sendMessage({ type: 'CAPTURE_BULK', items: fallbackBatch }, resolve);
            });
            if (fbResponse?.success) {
              bulkStats.captured += fbResponse.captured || 0;
              bulkStats.skipped += fbResponse.skipped || 0;
            }
          }
        }
      } else if (response?.error) {
        bulkStats.errors += idBatch.length;
        log('API bulk error:', response.error);
      }
      updateHUD();
    } else if (!useApi && batch.length > 0) {
      // Classic mode: send DOM-extracted data
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
  const hudHeader = document.querySelector('.feedsilo-hud-name');
  if (hudHeader) hudHeader.textContent = 'Capture complete';
  const stopBtn = document.getElementById('feedsilo-hud-stop');
  if (stopBtn) {
    stopBtn.textContent = 'CLOSE';
    stopBtn.addEventListener('click', () => {
      document.getElementById('feedsilo-hud')?.remove();
    });
  }
}
