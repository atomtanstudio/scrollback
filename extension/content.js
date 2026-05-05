// ============================================================
// Scrollback Extension - Content Script
// ============================================================

{
if (!globalThis.__feedsiloContentInjected) {
  globalThis.__feedsiloContentInjected = true;

const { shouldHydrateCaptureData } = globalThis.FeedSiloExtension || {};
const contentBootstrappedLate = document.readyState !== 'loading';

// --- Debug logging (set to true for development) ---
const DEBUG = false;
function log(...args) { if (DEBUG) console.log('Scrollback:', ...args); }

// Merge source into target without overwriting non-null values with null
function mergeKeepNonNull(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] != null) {
      target[key] = source[key];
    } else if (!(key in target)) {
      target[key] = source[key];
    }
    // If source[key] is null but target[key] already has a value, skip
  }
  return target;
}

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

// --- Background Tab Thread Fetch ---
// When this tab was opened by background.js to fetch a full thread,
// wait for conversation data to arrive in tweetCache, then send it back.
let bgFetchConversationId = null;
let bgFetchTimer = null;
let lastBgFetchCount = 0;
let bgArticleDomAccumulator = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PING') {
    sendResponse({ ready: true });
    return;
  }

  if (message.type === 'BG_FETCH_INIT' && message.conversationId) {
    bgFetchConversationId = message.conversationId;
    lastBgFetchCount = 0;
    bgArticleDomAccumulator = createArticleDomAccumulator();
    log('Background fetch mode — waiting for conversation', bgFetchConversationId);
    runBackgroundFetchHarvest(message.expectedReplies).catch((error) => {
      log('Background fetch harvest failed:', error);
      sendThreadData();
    });
    // Also poll briefly in case data arrives after init
    let checks = 0;
    bgFetchTimer = setInterval(() => {
      checks++;
      trySendThreadData();
      if (checks >= 22) { // 22 × 500ms = 11s max
        clearInterval(bgFetchTimer);
        bgFetchTimer = null;
        // Send whatever we have
        sendThreadData();
      }
    }, 500);
    return;
  }

  if (message.type === 'MERGE_CACHE' && message.tweets) {
    log('Merging', message.tweets.length, 'tweets from background fetch');
    for (const tweet of message.tweets) {
      if (!tweet.external_id) continue;
      const existing = tweetCache.get(tweet.external_id);
      if (!existing) {
        tweetCache.set(tweet.external_id, tweet);
      } else if ((tweet.body_text || '').length > (existing.body_text || '').length) {
        mergeKeepNonNull(existing, tweet);
      }
    }
    return;
  }
});

function trySendThreadData() {
  if (!bgFetchConversationId) return;
  const hasArticle = Array.from(tweetCache.values()).some(
    data => data.conversation_id === bgFetchConversationId && data.source_type === 'article'
  );
  if (hasArticle && bgArticleDomAccumulator && !bgArticleDomAccumulator.done) {
    hydrateArticleCacheFromDOM();
    return;
  }
  // Count how many tweets we have for this conversation
  let count = 0;
  for (const [, data] of tweetCache) {
    if (data.conversation_id === bgFetchConversationId) count++;
  }
  // Wait for count to stabilize (same as last check) before sending,
  // to avoid sending partial data while X is still loading more tweets.
  // Threshold is 1 (not 2) because articles are single tweets — thread
  // filtering downstream still requires 2+ siblings from the same author.
  if (count >= 1 && count === lastBgFetchCount) {
    clearInterval(bgFetchTimer);
    bgFetchTimer = null;
    sendThreadData();
  }
  lastBgFetchCount = count;
}

function sendThreadData() {
  if (!bgFetchConversationId) return;
  hydrateArticleCacheFromDOM();
  const tweets = [];
  for (const [, data] of tweetCache) {
    if (data.conversation_id === bgFetchConversationId) {
      tweets.push({ ...data });
    }
  }
  log('Sending', tweets.length, 'thread tweets back to originating tab');
  chrome.runtime.sendMessage({
    type: 'THREAD_DATA_READY',
    tweets,
  });
  bgFetchConversationId = null;
  bgArticleDomAccumulator = null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runBackgroundFetchHarvest(expectedReplies = null) {
  await sleep(900);
  let stuckScrollCount = 0;

  for (let i = 0; i < 70; i++) {
    hydrateArticleCacheFromDOM();

    const height = document.documentElement.scrollHeight || document.body.scrollHeight || 0;
    const currentY = window.scrollY;
    const bottom = currentY + window.innerHeight >= height - 140;
    if (bottom) break;

    window.scrollBy({ top: Math.max(700, Math.floor(window.innerHeight * 0.78)), behavior: 'auto' });
    await sleep(450);

    if (Math.abs(window.scrollY - currentY) < 20) {
      stuckScrollCount++;
    } else {
      stuckScrollCount = 0;
    }
    if (stuckScrollCount >= 2) break;

    if (expectedReplies && getConversationCacheCount(bgFetchConversationId) >= expectedReplies + 1) {
      break;
    }
  }

  hydrateArticleCacheFromDOM();
  if (bgArticleDomAccumulator) {
    bgArticleDomAccumulator.done = true;
  }
  sendThreadData();
}

function getConversationCacheCount(conversationId) {
  let count = 0;
  for (const [, data] of tweetCache) {
    if (data.conversation_id === conversationId) count++;
  }
  return count;
}

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

function formatContentStateBlocks(contentState, mediaLookup = {}) {
  // Convert Draft.js content_state blocks to markdown text + extract media URLs
  // mediaLookup: { mediaId → { videoUrl, thumbnailUrl } } for resolving MEDIA entities
  const blocks = contentState.blocks || [];
  const entityMap = contentState.entityMap || {};
  const bodyParts = [];
  const imageUrls = [];
  const _debugEntityTypes = new Set(); // Track all entity types for diagnostics
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
            _debugEntityTypes.add(eType);

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
              // Check for video mediaItems first (X articles use MEDIA for both images and videos)
              // Video mediaItems have mediaCategory: "AmplifyVideo" and a mediaId reference
              const videoItem = (eData.mediaItems || []).find(
                mi => mi.mediaCategory === 'AmplifyVideo' && mi.mediaId
              );
              if (videoItem && mediaLookup[videoItem.mediaId]) {
                const resolved = mediaLookup[videoItem.mediaId];
                if (resolved.videoUrl) {
                  // Only insert body marker — video URL is already in media_urls
                  // via artResult.media_entities extraction (avoids duplicates)
                  bodyParts.push(`[Video: ${resolved.videoUrl}]`);
                  handled = true;
                }
              } else if (videoItem) {
                // Video mediaItem but no lookup entry — log for debugging
                log(' Unresolved video mediaItem:', videoItem.mediaId, '(not in mediaLookup)');
              }
              // Regular image handling
              if (!handled) {
                const imgUrl = eData.src || eData.url || eData.media_url_https
                  || eData.image || eData.original_url || eData.thumbnail;
                if (imgUrl) { imageUrls.push(imgUrl); handled = true; }
              }
            }
            else if (eType === 'VIDEO' || eType === 'MOVIE' || eType === 'EMBED'
                     || eType === 'VIDEO_EMBED' || eType === 'IFRAME') {
              const videoUrl = eData.url || eData.video_url || eData.src
                || eData.embed_url || eData.href;
              if (videoUrl) {
                imageUrls.push(videoUrl);
                bodyParts.push(`[Video: ${videoUrl}]`);
                handled = true;
              }
              const thumb = eData.thumbnail || eData.poster || eData.poster_image
                || eData.thumbnail_url || eData.preview_image;
              if (thumb && !imageUrls.includes(thumb)) {
                imageUrls.push(thumb);
              }
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

        // Check block.data for images/videos/code
        const blockData = block.data || {};
        if (!handled) {
          // Video in block.data
          const blockVideoUrl = blockData.video_url || blockData.embed_url;
          if (blockVideoUrl) {
            imageUrls.push(blockVideoUrl);
            bodyParts.push(`[Video: ${blockVideoUrl}]`);
            handled = true;
          }
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

  log(' formatContentStateBlocks entity types found:', [..._debugEntityTypes]);
  log(' formatContentStateBlocks imageUrls:', imageUrls);
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

const THREAD_CONTINUATION_PATTERNS = [
  /\bthread\b/i,
  /\b(?:continued?|continuing)\b/i,
  /\bmore below\b/i,
  /\bsee (?:below|thread|replies)\b/i,
  /\b(?:prompt|details?|breakdown|examples?|steps?|tutorial|context|part)\s+(?:below|in replies|in the replies)\b/i,
  /\bhere (?:are|is)\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(?:prompts?|examples?|steps?|templates?|ideas|frameworks?|workflows?|tricks|ways)\b/i,
  /\b\d+\s+(?:prompts?|examples?|steps?|templates?|ideas|frameworks?|workflows?|tricks|ways)\b/i,
  /\bin (?:the )?replies\b/i,
  /\bscroll down\b/i,
  /\b(?:1|one)\/\d+\b/i,
  /\(\s*(?:1|one)\s*\/\s*\d+\s*\)/i,
  /👇|⬇️|↓/,
];

const THREAD_REPLY_CONTINUATION_PATTERNS = [
  /^\s*(?:\d+\/\d+|\(\d+\/\d+\)|part\s+\d+|step\s+\d+)\b/i,
  /\b(?:next|continued?|continuing|more|part\s+\d+|step\s+\d+)\b/i,
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

function normalizeThreadText(text) {
  return (text || '')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/@\w+/g, ' ')
    .replace(/[#*_`>~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasThreadLeadCue(text) {
  const normalized = normalizeThreadText(text);
  if (!normalized) return false;
  return THREAD_CONTINUATION_PATTERNS.some((pattern) => pattern.test(normalized));
}

function isSubstantiveThreadReply(item) {
  const normalized = normalizeThreadText(item?.body_text || '');
  if (!normalized) return false;
  if (THREAD_REPLY_CONTINUATION_PATTERNS.some((pattern) => pattern.test(normalized))) return true;

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length >= 18) return true;
  if (normalized.length >= 110) return true;
  if (words.length >= 10 && /[.!?。！？]/.test(normalized)) return true;

  return false;
}

function hasPromptLikeContinuation(item) {
  const text = item?.body_text || '';
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return false;

  if (hasExplicitPromptSnippet(normalized)) return true;
  if (STRONG_PROMPT_PATTERNS.some((pattern) => pattern.test(normalized))) return true;
  if (PROMPT_LANG.some((pattern) => pattern.test(normalized))) return true;

  const hasVideoTool = new RegExp(`\\b(?:${VIDEO_TOOLS.join('|')})\\b`, 'i').test(normalized);
  const hasImageTool = new RegExp(`\\b(?:${IMAGE_TOOLS.join('|')})\\b`, 'i').test(normalized);
  if ((hasVideoTool || hasImageTool) && hasArtGenerationContext(normalized, hasVideoTool)) return true;

  return false;
}

function isHighValueSingleContinuation(item) {
  if (!item) return false;
  if (item.source_type === 'article') return false;
  if (item.source_type === 'image_prompt' || item.source_type === 'video_prompt') return true;
  if (hasPromptLikeContinuation(item)) return true;
  if ((item.media_urls || []).length > 0 && isSubstantiveThreadReply(item)) return true;
  return false;
}

function getRootTweetForConversation(items, conversationId) {
  const rootId = conversationId || items[0]?.external_id || null;
  return items.find((item) => item.external_id === rootId) || items[0] || null;
}

function getCandidateSelfThreadItems(items, authorHandle, conversationId) {
  const author = normalizeHandle(authorHandle);
  if (!author) return [];

  const rootConversationId = conversationId || items[0]?.conversation_id || items[0]?.external_id || null;
  const sameAuthorItems = items.filter((item) => {
    if (normalizeHandle(item.author_handle) !== author) return false;
    const itemConversationId = item.conversation_id || item.external_id || null;
    if (rootConversationId && itemConversationId && itemConversationId !== rootConversationId) return false;
    return true;
  });

  const authorTweetIds = new Set(sameAuthorItems.map((item) => item.external_id));
  const root = getRootTweetForConversation(sameAuthorItems, rootConversationId);
  const rootHasLeadCue = hasThreadLeadCue(root?.body_text || '');

  return sameAuthorItems.filter((item) => {
    if (isLikelySelfThreadEntry(item, author, rootConversationId)) return true;

    const replyToTweetId = item._replyToTweetId || null;
    if (replyToTweetId) return authorTweetIds.has(replyToTweetId);

    const itemConversationId = item.conversation_id || item.external_id || null;
    if (rootConversationId && itemConversationId && itemConversationId !== rootConversationId) return false;
    if (item.external_id === root?.external_id) return true;
    if (item._replyToHandle) return false;

    return isSubstantiveThreadReply(item) && (rootHasLeadCue || isHighValueSingleContinuation(item));
  });
}

function shouldTreatItemsAsThread(items, authorHandle, conversationId) {
  const candidates = getCandidateSelfThreadItems(items, authorHandle, conversationId);
  if (candidates.length < 2) return false;

  const root = getRootTweetForConversation(candidates, conversationId);
  if (!root || root.source_type === 'article') return false;

  const continuations = candidates.filter((item) => item.external_id !== root.external_id);
  const substantiveContinuations = continuations.filter((item) => isSubstantiveThreadReply(item));
  const highValueContinuations = continuations.filter((item) => isHighValueSingleContinuation(item));

  if (substantiveContinuations.length === 0 && highValueContinuations.length === 0) {
    // Visual showcase thread: verified self-replies that are image-only or near-image-only.
    // Common pattern: short teaser root tweet + series of image cards (e.g. gradient reveals,
    // design showcases) where each reply has media but no/minimal text.
    const mediaReplies = continuations.filter(item =>
      (item.media_urls || []).length > 0
      && isLikelySelfThreadEntry(item, authorHandle, conversationId)
    );
    if (mediaReplies.length >= 1 && mediaReplies.length === continuations.length) return true;
    return false;
  }
  if (hasThreadLeadCue(root.body_text || '')) return true;
  if (continuations.length === 1 && highValueContinuations.length === 1) return true;

  return substantiveContinuations.length >= 2;
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
  const replyToTweetId = legacy.in_reply_to_status_id_str || legacy.in_reply_to_status_id || existingEntry?._replyToTweetId || null;

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

    // Build mediaLookup from artResult.media_entities for resolving MEDIA entities
    // in content_state. Also extract standalone media URLs.
    const mediaLookup = {}; // mediaId → { videoUrl, thumbnailUrl }
    if (artResult.media_entities) {
      const mediaEnts = Array.isArray(artResult.media_entities) ? artResult.media_entities : Object.values(artResult.media_entities);
      for (const me of mediaEnts) {
        const mediaId = me?.media_id;
        const typeName = (me?.media_info?.__typename || '').toLowerCase();
        const isVideo = typeName.includes('video') || typeName.includes('gif');

        if (isVideo) {
          // Extract best mp4 URL from variants
          const variants = me?.media_info?.variants || [];
          const mp4s = variants.filter(v => v.content_type === 'video/mp4' && v.url);
          let videoUrl = null;
          if (mp4s.length > 0) {
            mp4s.sort((a, b) => (b.bit_rate || b.bitrate || 0) - (a.bit_rate || a.bitrate || 0));
            videoUrl = mp4s[0].url;
          }
          const thumbUrl = me?.media_info?.preview_image?.original_img_url || null;

          if (mediaId) {
            mediaLookup[mediaId] = { videoUrl, thumbnailUrl: thumbUrl };
            log(' mediaLookup[' + mediaId + '] =', videoUrl, 'thumb:', thumbUrl);
          }
          if (videoUrl && !articleMediaUrls.includes(videoUrl)) {
            articleMediaUrls.push(videoUrl);
            log(' Article video from media_entities:', videoUrl);
          }
          // Skip thumbnails — they're just preview frames, not standalone media
        } else {
          // Image entries
          const imgUrl = me?.media_info?.original_img_url || me?.media_url_https || me?.url;
          if (imgUrl && !articleMediaUrls.includes(imgUrl)) {
            articleMediaUrls.push(imgUrl);
            log(' Article inline image from media_entities:', imgUrl);
          }
        }
      }
    }

    // Extract article body from Draft.js content_state
    if (artResult.content_state?.blocks?.length > 0) {
      const result = formatContentStateBlocks(artResult.content_state, mediaLookup);
      articleBody = result.body;
      articleMediaUrls.push(...result.imageUrls);
      log(' Got full article body:', articleBody.length, 'chars from', artResult.content_state.blocks.length, 'blocks,', articleMediaUrls.length, 'images');
    }
  }

  // Extract media URLs with proper video support
  const mediaUrls = [];
  let hasUnresolvedVideo = false;
  // For articles, start with article-specific media (cover + inline media)
  if (isArticle && articleMediaUrls.length > 0) {
    // Deduplicate before adding
    const seen = new Set();
    for (const url of articleMediaUrls) {
      if (!seen.has(url)) { seen.add(url); mediaUrls.push(url); }
    }
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

  if (quotedTweet) {
    const quotedLegacy = quotedTweet.legacy || {};
    const quotedNote = quotedTweet.note_tweet?.note_tweet_results?.result;
    const quotedText = quotedNote?.text || quotedLegacy.full_text || '';
    const quotedUserResult = quotedTweet.core?.user_results?.result;
    const quotedUser = quotedUserResult?.legacy || quotedUserResult?.result?.legacy || quotedTweet.user?.legacy || {};
    const quotedHandle = quotedUser.screen_name
      || quotedUserResult?.screen_name
      || quotedUserResult?.result?.screen_name
      || null;
    if (quotedText && !bodyText.includes(quotedText)) {
      const quotedLabel = quotedHandle ? `Quoted post by @${quotedHandle}` : 'Quoted post';
      bodyText = [bodyText, `${quotedLabel}:\n${quotedText}`].filter(Boolean).join('\n\n');
    }
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
    _replyToTweetId: replyToTweetId,
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
  const authors = new Set();
  for (const s of siblings) {
    const author = (s.author_handle || '').toLowerCase();
    if (author) authors.add(author);
  }

  for (const author of authors) {
    if (!shouldTreatItemsAsThread(siblings, author, conversationId)) continue;
    for (const s of siblings) {
      if (isLikelySelfThreadEntry(s, author, conversationId)
          && (s.source_type === 'tweet' || s.source_type === 'image_prompt' || s.source_type === 'video_prompt')) {
        s.source_type = 'thread';
      }
    }
  }
}

function shouldFetchViaBackgroundTab(data, tweetElement) {
  // Skip if this tab is a background fetch tab (opened by background.js)
  if (bgFetchConversationId) return false;

  // Condition 0: article with truncated body — need full content_state
  if (data.source_type === 'article') {
    if (isArticleBodyIncomplete(data)) return true;
  }

  const conversationId = data.conversation_id;
  const externalId = data.external_id;

  if (conversationId) {
    // Condition 1: tweet is a reply in a conversation (conversation_id ≠ own id)
    if (conversationId !== externalId) return true;

    // Condition 2: cache already has 2+ tweets with this conversation_id
    let siblingCount = 0;
    for (const [, cached] of tweetCache) {
      if (cached.conversation_id === conversationId) {
        siblingCount++;
        if (siblingCount >= 2) return true;
      }
    }
  }

  // Condition 3: tweet has replies (from API cache)
  if (data.replies > 0) return true;

  // Condition 4: DOM signals — thread connector line or "Show this thread" visible
  // This catches cases where API data wasn't intercepted (conversation_id/replies null)
  if (tweetElement) {
    const cell = tweetElement.closest('[data-testid="cellInnerDiv"]');
    if (cell) {
      // Thread connector: a thin vertical line connecting tweets
      const connector = cell.querySelector('div[style*="width: 2px"]');
      if (connector) return true;
      // "Show this thread" link
      if (cell.textContent.includes('Show this thread')) return true;
    }
    // Also check the next sibling cell for a thread connector (root tweet with replies below)
    const nextCell = cell?.nextElementSibling;
    if (nextCell) {
      const nextConnector = nextCell.querySelector('div[style*="width: 2px"]');
      if (nextConnector) return true;
    }
  }

  return false;
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
  delete clean._replyToTweetId;
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
    const domBodyText = getTweetTextFromDOM(tweetElement);
    if (domBodyText && domBodyText.length > (cached.body_text?.length || 0)) {
      cached.body_text = domBodyText;
      if (cached.source_type !== 'article') {
        cached.source_type = detectSourceType(cached.body_text, cached.media_urls || [], false, false);
      }
    }
    // For articles with truncated body, try to get full content
    if (cached.source_type === 'article') {
      hydrateArticleDataFromDOM(cached);
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
    }

    // Return a clean copy without internal fields
    return options.includeInternal ? { ...cached } : stripInternalCaptureFields(cached);
  }

  // Fall back to DOM extraction
  const bodyText = getTweetTextFromDOM(tweetElement);

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

  const sourceType = detectSourceType(bodyText, mediaUrls, false, false);
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
    _replyToTweetId: null,
    likes: null,
    retweets: null,
    replies: null,
    views: null,
  };
}


// --- Article Body DOM Extraction ---
function createArticleDomAccumulator() {
  return {
    parts: [],
    mediaUrls: [],
    seenText: new Set(),
    seenMedia: new Set(),
    done: false,
  };
}

function normalizeDomText(value) {
  return (value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function normalizeDomMediaUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url, location.href);
    if (!parsed.hostname.includes('pbs.twimg.com') && !parsed.hostname.includes('video.twimg.com')) {
      return null;
    }
    if (parsed.hostname.includes('pbs.twimg.com') && !parsed.pathname.includes('/media/')) {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

function isElementVisible(el) {
  const rect = el.getBoundingClientRect();
  if (rect.width < 8 || rect.height < 8) return false;
  const style = window.getComputedStyle(el);
  return style.visibility !== 'hidden' && style.display !== 'none';
}

function isArticleElementNearViewport(el, rect = null) {
  const box = rect || el.getBoundingClientRect();
  if (box.width < 8 || box.height < 8) return false;
  const style = window.getComputedStyle(el);
  if (style.visibility === 'hidden' || style.display === 'none') return false;

  const margin = Math.max(260, Math.floor(window.innerHeight * 0.45));
  return box.bottom >= -margin && box.top <= window.innerHeight + margin;
}

function shouldSkipArticleTextElement(el, title) {
  if (!isElementVisible(el)) return true;
  if (el.closest('button, [role="button"], [data-testid="User-Name"], [data-testid="caret"], [data-testid="app-bar-close"]')) return true;
  if (el.closest('nav, header')) return true;

  const text = normalizeDomText(el.innerText || el.textContent || '');
  if (shouldSkipArticleTextValue(text, title)) return true;

  const childText = Array.from(el.children)
    .map(child => normalizeDomText(child.innerText || child.textContent || ''))
    .filter(childText => childText && childText.length >= Math.min(80, text.length * 0.7));
  return childText.some(childText => childText !== text && text.includes(childText));
}

function shouldSkipArticleTextValue(text, title) {
  if (!text || text.length < 10) return true;
  if (title && text === title) return true;
  if (/^(copy|post|reply|repost|like|likes|views|share|bookmark|read original article)$/i.test(text)) return true;
  if (/^\d+\s*(views?|likes?|replies?|reposts?)$/i.test(text)) return true;
  if (/^@\w{1,15}$/.test(text)) return true;
  if (/^\w{3}\s+\d{1,2},\s+\d{4}$/.test(text)) return true;
  if (/^(for you|following|subscribe|verified|show more|show this thread)$/i.test(text)) return true;
  return false;
}

function isArticleBodyIncomplete(data) {
  if (data?.source_type !== 'article') return false;
  const body = (data.body_text || '').trim();
  if (!body) return true;
  if (/^https?:\/\/t\.co\/\w+$/i.test(body)) return true;
  if (body.length < 2500) return true;
  return false;
}

function isGenericArticleTextElement(el) {
  return el.matches?.('div, span')
    && !el.matches?.('div[dir="auto"], span[dir="auto"], pre, code, p');
}

function shouldSkipGenericArticleTextElement(el) {
  if (!isGenericArticleTextElement(el)) return false;
  return Array.from(el.children).some((child) => {
    const childText = normalizeDomText(child.innerText || child.textContent || '');
    return childText.length >= 10;
  });
}

function addArticleTextPart(accumulator, text) {
  const normalized = normalizeDomText(text);
  if (!normalized || shouldSkipArticleTextValue(normalized, '')) return;
  const key = normalized.replace(/\s+/g, ' ').toLowerCase();
  if (accumulator.seenText.has(key)) return;
  if (normalized.length > 20 && accumulator.parts.some(part => !part.startsWith('[') && part.includes(normalized))) return;

  const previous = accumulator.parts[accumulator.parts.length - 1] || '';
  if (previous && !previous.startsWith('[') && normalized.includes(previous) && previous.length > 30) {
    accumulator.parts.pop();
  } else if (previous && !previous.startsWith('[') && previous.includes(normalized) && normalized.length > 30) {
    return;
  }

  accumulator.seenText.add(key);
  accumulator.parts.push(normalized);
}

function addArticleMediaPart(accumulator, url, type = 'Image') {
  const normalized = normalizeDomMediaUrl(url);
  if (!normalized || accumulator.seenMedia.has(normalized)) return;
  accumulator.seenMedia.add(normalized);
  accumulator.mediaUrls.push(normalized);
  accumulator.parts.push(`[${type}: ${normalized}]`);
}

function collectArticleDomSnapshot(accumulator, title = '') {
  const mainColumn = document.querySelector('[data-testid="primaryColumn"]');
  if (!mainColumn) return accumulator;

  const selector = [
    'img[src*="pbs.twimg.com/media"]',
    'video source[src*="video.twimg.com"]',
    'video[src*="video.twimg.com"]',
    'pre',
    'code',
    'div[dir="auto"]',
    'span[dir="auto"]',
    'p',
    'div',
    'span',
  ].join(',');

  const nodes = Array.from(mainColumn.querySelectorAll(selector));
  const candidates = [];
  nodes.forEach((node, index) => {
    const rect = node.getBoundingClientRect();
    if (!isArticleElementNearViewport(node, rect)) return;
    const sortTop = rect.top + window.scrollY;
    const sortLeft = rect.left + window.scrollX;

    if (node.matches?.('img[src*="pbs.twimg.com/media"]')) {
      candidates.push({ type: 'media', mediaType: 'Image', url: node.currentSrc || node.src, sortTop, sortLeft, index });
      return;
    }

    if (node.matches?.('video source[src*="video.twimg.com"]')) {
      candidates.push({ type: 'media', mediaType: 'Video', url: node.src, sortTop, sortLeft, index });
      return;
    }

    if (node.matches?.('video[src*="video.twimg.com"]')) {
      candidates.push({ type: 'media', mediaType: 'Video', url: node.currentSrc || node.src, sortTop, sortLeft, index });
      return;
    }

    if (shouldSkipArticleTextElement(node, title)) return;
    if (shouldSkipGenericArticleTextElement(node)) return;
    candidates.push({ type: 'text', text: node.innerText || node.textContent || '', sortTop, sortLeft, index });
  });

  candidates
    .sort((a, b) => a.sortTop - b.sortTop || a.sortLeft - b.sortLeft || a.index - b.index)
    .forEach((candidate) => {
      if (candidate.type === 'media') {
        addArticleMediaPart(accumulator, candidate.url, candidate.mediaType);
      } else {
        addArticleTextPart(accumulator, candidate.text);
      }
    });

  return accumulator;
}

function extractArticleBodyFromDOM(title = '') {
  const accumulator = collectArticleDomSnapshot(createArticleDomAccumulator(), title);
  const body = accumulator.parts.join('\n\n');
  return body.length > 200 ? { body, mediaUrls: accumulator.mediaUrls } : null;
}

function hydrateArticleDataFromDOM(data, accumulator = null) {
  const domArticle = accumulator
    ? { body: accumulator.parts.join('\n\n'), mediaUrls: accumulator.mediaUrls }
    : extractArticleBodyFromDOM(data.title || '');
  if (!domArticle || domArticle.body.length < 200) return false;

  const currentBodyLength = (data.body_text || '').length;
  const hasMoreBody = domArticle.body.length > currentBodyLength + 300;
  const hasMoreMedia = domArticle.mediaUrls.length > (data.media_urls || []).length;
  const shouldReplaceBody = hasMoreBody
    || (currentBodyLength < 700 && domArticle.body.length > currentBodyLength + 80);

  if (!hasMoreBody && !hasMoreMedia) return false;

  if (shouldReplaceBody) {
    data.body_text = domArticle.body;
  }

  const mediaUrls = data.media_urls || [];
  for (const url of domArticle.mediaUrls) {
    if (!mediaUrls.includes(url)) mediaUrls.push(url);
  }
  data.media_urls = mediaUrls;
  log(' Hydrated article from DOM:', data.body_text?.length || 0, 'chars,', data.media_urls.length, 'media');
  return true;
}

function hydrateArticleCacheFromDOM() {
  if (!bgFetchConversationId || !bgArticleDomAccumulator) return;
  collectArticleDomSnapshot(bgArticleDomAccumulator);
  for (const [, data] of tweetCache) {
    if (data.conversation_id === bgFetchConversationId && data.source_type === 'article') {
      hydrateArticleDataFromDOM(data, bgArticleDomAccumulator);
    }
  }
}

async function hydrateArticleDataFromDOMWithScroll(data, button = null) {
  const accumulator = createArticleDomAccumulator();
  const startY = window.scrollY;
  let stuckScrollCount = 0;

  for (let i = 0; i < 70; i++) {
    collectArticleDomSnapshot(accumulator, data.title || '');
    const height = document.documentElement.scrollHeight || document.body.scrollHeight || 0;
    const maxScroll = Math.max(1, height - window.innerHeight);
    const currentY = window.scrollY;
    const bottom = currentY + window.innerHeight >= height - 140;
    if (bottom) break;

    if (button) {
      const progress = Math.min(95, Math.max(5, Math.round((currentY / maxScroll) * 100)));
      button.title = `Capturing full X article… ${progress}%`;
    }

    window.scrollBy({ top: Math.max(700, Math.floor(window.innerHeight * 0.78)), behavior: 'auto' });
    await new Promise(resolve => setTimeout(resolve, 450));

    if (Math.abs(window.scrollY - currentY) < 20) {
      stuckScrollCount++;
    } else {
      stuckScrollCount = 0;
    }
    if (stuckScrollCount >= 2) break;
  }

  collectArticleDomSnapshot(accumulator, data.title || '');
  const hydrated = hydrateArticleDataFromDOM(data, accumulator);
  window.scrollTo({ top: startY, behavior: 'auto' });
  if (button) button.title = 'Save to Scrollback';
  return hydrated;
}

async function hydrateArticleCaptureIfUseful(data, button = null) {
  const bodyLengthBefore = (data.body_text || '').length;
  const mediaCountBefore = (data.media_urls || []).length;
  const isKnownArticle = data.source_type === 'article';
  const wasIncompleteArticle = isArticleBodyIncomplete(data);
  const likelyLongFormPage =
    isKnownArticle ||
    bodyLengthBefore > 1000 ||
    document.querySelectorAll('[data-testid="primaryColumn"] img[src*="pbs.twimg.com/media"]').length >= 2;

  if (!likelyLongFormPage) return false;

  const hydrated = await hydrateArticleDataFromDOMWithScroll(data, button);
  const bodyLengthAfter = (data.body_text || '').length;
  const mediaCountAfter = (data.media_urls || []).length;
  const foundSubstantialArticle =
    hydrated &&
    (
      bodyLengthAfter > bodyLengthBefore + 500 ||
      mediaCountAfter >= Math.max(2, mediaCountBefore + 1) ||
      (wasIncompleteArticle && !isArticleBodyIncomplete(data))
    );

  if (!foundSubstantialArticle) return false;

  data.source_type = 'article';
  if (!data.title || data.title === data.body_text?.slice(0, 100)) {
    const pageTitle = normalizeDomText(document.title || '').replace(/\s*\/\s*X$/, '');
    if (pageTitle) data.title = pageTitle;
  }
  return true;
}

function getLongFormArticleCandidate(items) {
  return (items || [])
    .filter(Boolean)
    .filter((item) => {
      const bodyLength = (item.body_text || '').length;
      const mediaCount = (item.media_urls || []).length;
      return item.source_type === 'article' || bodyLength > 1000 || mediaCount >= 2;
    })
    .sort((a, b) => (b.body_text || '').length - (a.body_text || '').length)[0] || null;
}

function promoteLongFormCandidate(target, candidate) {
  if (!candidate || candidate === target) return false;
  const targetBodyLength = (target.body_text || '').length;
  const candidateBodyLength = (candidate.body_text || '').length;

  if (candidateBodyLength > targetBodyLength) {
    target.body_text = candidate.body_text;
  }
  if ((!target.media_urls || target.media_urls.length === 0) && candidate.media_urls?.length) {
    target.media_urls = [...candidate.media_urls];
  } else if (candidate.media_urls?.length) {
    const mediaUrls = target.media_urls || [];
    for (const url of candidate.media_urls) {
      if (!mediaUrls.includes(url)) mediaUrls.push(url);
    }
    target.media_urls = mediaUrls;
  }
  if (!target.title && candidate.title) target.title = candidate.title;
  if (!target.posted_at && candidate.posted_at) target.posted_at = candidate.posted_at;
  return true;
}

async function expandTweetText(tweetElement, delay = 500) {
  const showMore = tweetElement?.querySelector?.('[data-testid="tweet-text-show-more-link"]');
  if (!showMore) return false;
  showMore.click();
  await new Promise((resolve) => setTimeout(resolve, delay));
  return true;
}

function getTweetTextFromDOM(tweetElement) {
  const tweetTextEl = tweetElement?.querySelector?.('[data-testid="tweetText"]');
  return tweetTextEl ? tweetTextEl.innerText : '';
}


// --- Per-Tweet Save Buttons ---
const BUTTON_ATTR = 'data-feedsilo-btn';

function injectSaveButtons() {
  const tweets = document.querySelectorAll('article[data-testid="tweet"]');

  tweets.forEach(tweet => {
    const actionBar = tweet.querySelector('div[role="group"]');
    if (!actionBar || actionBar.querySelector(`[${BUTTON_ATTR}]`)) return;

    const btnSlot = document.createElement('div');
    btnSlot.className = 'feedsilo-save-btn-slot';

    const btn = document.createElement('button');
    btn.setAttribute(BUTTON_ATTR, 'true');
    btn.className = 'feedsilo-save-btn';
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`;
    btn.title = 'Save to Scrollback';

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Check if extension context is still valid
      try {
        chrome.runtime.getURL('');
      } catch {
        btn.classList.add('error');
        btn.innerHTML = '⟳';
        btn.title = 'Extension updated — refresh this page';
        return;
      }

      btn.classList.add('saving');

      // Long X articles may need to scroll through a lot of virtualized content.
      const saveTimeout = setTimeout(() => {
        btn.classList.remove('saving');
        btn.classList.add('error');
        btn.title = 'Save timed out — try again';
        setTimeout(() => resetButton(btn), 5000);
      }, 60000);

      try {
      // Try to expand long tweets first
      await expandTweetText(tweet, 800);

      const data = await extractTweetFromDOM(tweet);
      if (!data) {
        btn.classList.remove('saving');
        btn.classList.add('error');
        return;
      }

      const hadCachedEntry = tweetCache.has(data.external_id);
      let threadItems = [];
      if (data.conversation_id && data.author_handle) {
        threadItems = getThreadSiblingsFromCache(data.conversation_id, data.author_handle);
      }
      const longFormCandidate = getLongFormArticleCandidate([data, ...threadItems]);
      if (longFormCandidate) {
        promoteLongFormCandidate(data, longFormCandidate);
      }
      let capturedAsArticle = await hydrateArticleCaptureIfUseful(data, btn);
      if (capturedAsArticle) {
        threadItems = [];
      }
      let articleLooksIncomplete = isArticleBodyIncomplete(data);

      const needsHydration = typeof shouldHydrateCaptureData === 'function'
        && shouldHydrateCaptureData({
          hasCachedEntry: hadCachedEntry,
          lateBootstrap: contentBootstrappedLate,
          data,
        });

      // If thread looks incomplete or article is truncated, try fetching via background tab
      // Always fetch via background tab if: no thread found yet, article is truncated,
      // or we found a partial thread but root tweet has more replies than we captured
      const threadLooksIncomplete = threadItems.length >= 2
        && data.replies != null && data.replies > threadItems.length;
      if ((!capturedAsArticle || articleLooksIncomplete)
          && (needsHydration || articleLooksIncomplete || shouldFetchViaBackgroundTab(data, tweet))
          && (needsHydration || threadItems.length < 2 || data.source_type === 'article' || threadLooksIncomplete)) {
        const tweetUrl = data.source_url || `https://x.com/i/web/status/${data.external_id}`;
        // Use conversation_id if available, fall back to external_id (root tweets have conv_id === ext_id)
        const fetchConversationId = data.conversation_id || data.external_id;
        log('Fetching full thread via background tab:', tweetUrl, 'conversation:', fetchConversationId, 'needsHydration:', needsHydration);
        try {
          const result = await new Promise((resolve) => {
            chrome.runtime.sendMessage({
              type: 'FETCH_THREAD',
              url: tweetUrl,
              conversationId: fetchConversationId,
            }, (response) => {
              if (chrome.runtime.lastError) {
                log('FETCH_THREAD error:', chrome.runtime.lastError.message);
                resolve({ success: false, tweets: [] });
                return;
              }
              resolve(response || { success: false, tweets: [] });
            });
          });
          log('Background fetch returned', result.tweets?.length || 0, 'tweets, success:', result.success);
          // Merge tweets into local cache — update existing entries if incoming
          // data has a longer body (e.g., full article replacing truncated preview)
          if (result.tweets?.length > 0) {
            for (const t of result.tweets) {
              if (!t.external_id) continue;
              const existing = tweetCache.get(t.external_id);
              if (!existing) {
                tweetCache.set(t.external_id, t);
              } else if ((t.body_text || '').length > (existing.body_text || '').length) {
                // Incoming data has more content — merge without overwriting non-null fields
                mergeKeepNonNull(existing, t);
              }
            }
          }
          // Update data from cache — the background tab may have fetched
          // a fuller version (e.g., full article body, conversation_id)
          if (tweetCache.has(data.external_id)) {
            const updated = tweetCache.get(data.external_id);
            log('Post-merge cache entry media_urls:', updated.media_urls);
            log('Post-merge cache entry body_text length:', updated.body_text?.length);
            mergeKeepNonNull(data, updated);
          }
          // Re-check cache with merged data — use fetchConversationId since
          // data.conversation_id may be null when tweet came from DOM extraction
          if (data.author_handle) {
            const convId = data.conversation_id || fetchConversationId;
            threadItems = getThreadSiblingsFromCache(convId, data.author_handle);
          }
          articleLooksIncomplete = isArticleBodyIncomplete(data);
        } catch (err) {
          log('Background fetch failed:', err);
        }
      }

      // Final DOM fallback
      if (!capturedAsArticle && threadItems.length < 2) {
        threadItems = await getThreadSiblingsFromDOM(tweet, data);
      }

      if (!capturedAsArticle && threadItems.length > 1) {
        // Assemble thread into a single item: combine body text and media
        // Sort oldest first. Use posted_at if available, fall back to external_id
        // (Twitter IDs are chronologically ordered — lower ID = earlier tweet)
        threadItems.sort((a, b) => {
          if (a.posted_at && b.posted_at) {
            return new Date(a.posted_at).getTime() - new Date(b.posted_at).getTime();
          }
          // Fall back to external_id comparison (numeric string, lower = older)
          return (a.external_id || '').localeCompare(b.external_id || '', undefined, { numeric: true });
        });

        // Resolve missing media for tweets with empty media_urls (e.g., link card images)
        const resolvePromises = threadItems
          .filter(item => (!item.media_urls || item.media_urls.length === 0) && item.external_id)
          .map(item => new Promise((resolve) => {
            chrome.runtime.sendMessage({
              type: 'RESOLVE_MEDIA',
              data: { external_id: item.external_id, media_urls: [] },
            }, (response) => {
              if (chrome.runtime.lastError) { resolve(); return; }
              if (response?.media_urls?.length > 0) {
                item.media_urls = response.media_urls;
                log('Resolved media for tweet', item.external_id, ':', response.media_urls);
              }
              resolve();
            });
          }));
        await Promise.all(resolvePromises);

        log('Thread assembly — sorted order:');
        for (let idx = 0; idx < threadItems.length; idx++) {
          const item = threadItems[idx];
          log(`  [${idx}] id=${item.external_id} posted_at=${item.posted_at} media=${(item.media_urls||[]).length} body="${(item.body_text||'').substring(0,50)}"`);
        }

        const conversationId = threadItems.find(item => item.conversation_id)?.conversation_id
          || data.conversation_id
          || data.external_id;
        const payloadItems = threadItems.map((item) => stripInternalCaptureFields({
          ...item,
          source_type: item.source_type === 'article' ? item.source_type : 'thread',
          conversation_id: item.conversation_id || conversationId,
        }));

        log(' Thread detected — saving', payloadItems.length, 'conversation posts');

        chrome.runtime.sendMessage({ type: 'CAPTURE_BULK', items: payloadItems }, (response) => {
          clearTimeout(saveTimeout);
          btn.classList.remove('saving');
          if (chrome.runtime.lastError) {
            console.error('Scrollback: runtime error', chrome.runtime.lastError);
            btn.classList.add('error');
            setTimeout(() => resetButton(btn), 3000);
            return;
          }
          if (response?.success) {
            const changed = (response.captured || 0) + (response.skipped || 0);
            if ((response.captured || 0) === 0 && (response.skipped || 0) > 0) {
              btn.classList.add('dupe');
              btn.innerHTML = 'DUPE';
              log('Thread already exists in DB (conversation_id:', conversationId, ')');
              setTimeout(() => resetButton(btn), 3000);
            } else {
              btn.classList.add('saved');
              btn.innerHTML = `&#10003; ${changed || payloadItems.length}`;
              // Mark all other thread tweets' save buttons as saved too
              markThreadButtonsSaved(conversationId, data.author_handle);
            }
          } else {
            btn.classList.add('error');
            console.error('Scrollback thread save failed:', response?.error);
            setTimeout(() => resetButton(btn), 3000);
          }
        });
        return;
      }

      log(' sending capture data', JSON.stringify(data, null, 2));
      chrome.runtime.sendMessage({ type: 'CAPTURE_TWEET', data }, (response) => {
        clearTimeout(saveTimeout);
        log(' capture response', response);
        btn.classList.remove('saving');
        if (chrome.runtime.lastError) {
          console.error('Scrollback: runtime error', chrome.runtime.lastError);
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
          console.error('Scrollback save failed:', response?.error);
          setTimeout(() => resetButton(btn), 3000);
        }
      });

      } catch (err) {
        clearTimeout(saveTimeout);
        // Handle extension context invalidated (extension reloaded/updated)
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('Extension context invalidated') || msg.includes('context invalidated')) {
          btn.classList.remove('saving');
          btn.classList.add('error');
          btn.innerHTML = '⟳';
          btn.title = 'Extension updated — refresh this page';
        } else {
          btn.classList.remove('saving');
          btn.classList.add('error');
          console.error('Scrollback capture error:', err);
          setTimeout(() => resetButton(btn), 3000);
        }
      }
    });

    btnSlot.appendChild(btn);
    actionBar.appendChild(btnSlot);
  });
}

// Collect all thread siblings from cache for a given conversation + author
function getThreadSiblingsFromCache(conversationId, authorHandle) {
  const author = normalizeHandle(authorHandle);
  const conversationItems = [];
  const siblings = [];
  // First pass: find a sibling with full author info to use for backfill
  let refDisplayName = null;
  let refAvatarUrl = null;
  let refSourceUrl = null;
  for (const [, data] of tweetCache) {
    if (data.conversation_id !== conversationId) continue;
    conversationItems.push(data);
    if (data.author_display_name && !refDisplayName) refDisplayName = data.author_display_name;
    if (data.author_avatar_url && !refAvatarUrl) refAvatarUrl = data.author_avatar_url;
    if (data.source_url && !data.source_url.includes('/i/web/') && !refSourceUrl) refSourceUrl = data.source_url;
  }
  log('getThreadSiblingsFromCache: conversationId=', conversationId, 'author=', author);
  log('  conversationItems:', conversationItems.length, 'total in cache for this conversation');

  // Backfill author_handle for tweets that are likely self-replies.
  // X's API often omits user data for conversation entries. A tweet is likely
  // a self-reply if: it replies to the thread author, shares conversation_id,
  // and body doesn't start with @ (which would indicate a reply from someone else).
  for (const item of conversationItems) {
    if (!item.author_handle && normalizeHandle(item._replyToHandle) === author) {
      const body = (item.body_text || '').trimStart();
      if (!body.startsWith('@')) {
        item.author_handle = author;
        log('  backfilled author for tweet', item.external_id, '→', author);
      }
    }
    log('  tweet', item.external_id, 'author=', item.author_handle, 'replyTo=', item._replyToHandle, 'convId=', item.conversation_id, 'body=', (item.body_text || '').substring(0, 60));
  }

  if (conversationItems.length < 2) {
    log('  fewer than two conversation items — not a thread');
    return [];
  }
  const likelySelfThread = shouldTreatItemsAsThread(conversationItems, author, conversationId);
  if (!likelySelfThread) {
    log('  no self-thread pattern detected; saving visible conversation replies anyway');
  }
  for (const [, data] of tweetCache) {
    if (data.conversation_id !== conversationId) continue;
    const clean = { ...data };
    if (!clean.author_handle && isLikelySelfThreadEntry(clean, author, conversationId) && author) {
      clean.author_handle = author;
    }
    if (!clean.author_display_name && normalizeHandle(clean.author_handle) === author && refDisplayName) {
      clean.author_display_name = refDisplayName;
    }
    if (!clean.author_avatar_url && normalizeHandle(clean.author_handle) === author && refAvatarUrl) {
      clean.author_avatar_url = refAvatarUrl;
    }
    if (clean.source_url?.includes('/i/web/') && clean.author_handle) {
      clean.source_url = `https://x.com/${clean.author_handle}/status/${clean.external_id}`;
    }
    // Mark conversation entries as thread so the app can group them together.
    if (clean.source_type !== 'article') {
      clean.source_type = 'thread';
    }
    log('  sibling', clean.external_id, 'author=', clean.author_handle, 'media_urls:', clean.media_urls, 'source_type:', clean.source_type);
    siblings.push(stripInternalCaptureFields(clean));
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
  for (const visibleTweet of visibleTweets) {
    await expandTweetText(visibleTweet);
  }
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
    .filter((item) => {
      if (!conversationId) return false;
      return item.conversation_id === conversationId || item.external_id === conversationId || item.external_id === seedData?.external_id;
    })
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
    if (data.conversation_id === conversationId || isLikelySelfThreadEntry(data, author, conversationId)) {
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

  // Watch for SPA navigation (X uses pushState/replaceState for client-side routing)
  // When the URL changes, re-inject save buttons after a short delay to let X render new content
  let lastUrl = location.href;
  const navigationObserver = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      log('SPA navigation detected:', lastUrl);
      // Re-inject after X renders the new page content
      setTimeout(() => injectSaveButtons(), 500);
      setTimeout(() => injectSaveButtons(), 1500);
      setTimeout(() => injectSaveButtons(), 3000);
    }
  });
  navigationObserver.observe(document.body, { childList: true, subtree: true });
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
        <div class="feedsilo-hud-kicker">Scrollback</div>
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

} // end content script
}
