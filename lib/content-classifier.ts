/**
 * Content type classifier for captured items.
 *
 * Determines whether a tweet/post is a regular tweet, an AI image prompt,
 * or an AI video prompt based on body text + media presence.
 *
 * Key principle: "generated with Tool X" is NOT the same as an actual prompt.
 * We only classify visual prompt posts when the post shows prompt syntax or
 * explicitly shares the prompt text.
 */

import { hasExplicitPromptSnippet } from "@/lib/visual-prompt";

// --- Tool name lists (keep alphabetical within tiers) ---

const IMAGE_TOOLS_TIER1 = [
  "midjourney",
  "dall-?e(?:\\s*[23])?",
  "stable\\s*diffusion",
  "sdxl",
  "sd3",
  "flux",
  "grok\\s*(?:imagine|aurora)",
  "aurora",        // xAI's image model
  "imagen(?:\\s*[234])?",
  "ideogram",
  "firefly",
  "reve\\s*image",
];

const IMAGE_TOOLS_TIER2 = [
  "leonardo\\.?ai",
  "leonardo\\s+ai",
  "playground\\s*(?:ai|v[23])?",
  "nightcafe",
  "nano\\s*banana",
  "bing\\s*image\\s*creator",
  "seedream",
  "recraft",
  "krea(?:\\s*ai)?",
  "comfyui",
  "a1111",
  "automatic1111",
  "dreamstudio",
  "tensor\\.?art",
  "civitai",
];

const VIDEO_TOOLS_TIER1 = [
  "sora",
  "veo(?:\\s*[23])?",
  "runway(?:\\s*(?:gen-?[1234]|ml))?",
  "kling(?:\\s*(?:ai|[12]\\.[05]))?",
  "pika(?:\\s*(?:labs|[12]\\.[05]))?",
  "luma(?:\\s*(?:dream\\s*machine|ai|labs|ray2?))?",
  "dream\\s*machine",
  "hailuo(?:\\s*ai)?",
  "minimax(?:\\s*video)?",
  "seedance",
  "wan(?:\\s*2\\.[12])?",
  "hunyuan(?:\\s*video)?",
];

const VIDEO_TOOLS_TIER2 = [
  "stable\\s*video(?:\\s*diffusion)?",
  "pixverse",
  "jimeng",
  "genmo",
  "mochi",           // Genmo's model
  "movie\\s*gen",
  "haiper",
  "animatediff",
  "cogvideo(?:x)?",
  "ltx\\s*(?:video|studio)",
  "domo\\s*ai",
  "viggle(?:\\s*ai)?",
];

// Combine for regex building
const ALL_IMAGE_TOOLS = [...IMAGE_TOOLS_TIER1, ...IMAGE_TOOLS_TIER2];
const ALL_VIDEO_TOOLS = [...VIDEO_TOOLS_TIER1, ...VIDEO_TOOLS_TIER2];
// --- Strong prompt syntax (high confidence, no context needed) ---

const STRONG_PROMPT_PATTERNS = [
  // Midjourney parameters
  /--ar\s+\d+:\d+/,
  /--v\s+[\d.]+/,
  /--style\s+\w+/,
  /--q\s+[\d.]+/,
  /--s\s+\d+/,        // --stylize
  /--c\s+\d+/,        // --chaos
  /--niji\b/,
  /\/imagine\b/,

  // SD/ComfyUI technical params
  /\bcfg[\s_]?scale\b/i,
  /\bsampler[\s:]+\w*(euler|dpm|ddim|uni_pc|heun)/i,
  /\bdenoising[\s_]?strength\b/i,
  /\bnegative[\s_]?prompt\b/i,
  /\bcheckpoint[\s:].*(?:model|safetensors|ckpt)/i,
  /\blora[\s:].*(?:weight|model|trigger|strength)/i,
  /\bcontrolnet\s+(?:model|preprocessor|canny|depth|openpose)/i,
  /\btxt2img\b/i,
  /\bimg2img\b/i,
  /\btxt2vid\b/i,
  /\bimg2vid\b/i,
  /\bt2i\b/,
  /\bi2v\b/,
  /\bt2v\b/,
];

// Prompt-sharing language (standalone indicators when combined with media)
const PROMPT_SHARING_PATTERNS = [
  /\bprompt\s*:/i,
  /\b(?:image|video)\s+prompt\b/i,
  /\bhere(?:'s| is) (?:the|my) prompt\b/i,
  /\bprompt (?:I |i )used\b/i,
  /\bsharing (?:the|my) prompt\b/i,
];

/**
 * Detect if text contains a tool name (bare mention — used only as a secondary signal).
 */
function mentionsImageTool(text: string): boolean {
  const re = new RegExp(`\\b(?:${ALL_IMAGE_TOOLS.join("|")})\\b`, "i");
  return re.test(text);
}

function mentionsVideoTool(text: string): boolean {
  const re = new RegExp(`\\b(?:${ALL_VIDEO_TOOLS.join("|")})\\b`, "i");
  return re.test(text);
}

export type SourceType = "tweet" | "thread" | "article" | "image_prompt" | "video_prompt";

/**
 * Classify a content item's source type.
 *
 * @param bodyText - The tweet/post body text
 * @param mediaUrls - Array of media URLs attached to the post
 * @param hasVideo - Whether any media is video (mp4, etc.)
 * @param isArticle - Whether this is an X Article
 * @param isThread - Whether this is a thread reply
 */
export function classifySourceType(
  bodyText: string,
  mediaUrls: string[],
  hasVideo: boolean,
  isArticle: boolean,
  isThread: boolean
): SourceType {
  if (isArticle) return "article";
  if (isThread) return "thread";

  // No media = always a tweet (prompts need visual output)
  if (mediaUrls.length === 0) return "tweet";
  if (!bodyText) return "tweet";

  // --- Level 1: Strong prompt syntax (high confidence) ---
  for (const pattern of STRONG_PROMPT_PATTERNS) {
    if (pattern.test(bodyText)) {
      // Determine image vs video based on media type
      return hasVideo ? "video_prompt" : "image_prompt";
    }
  }

  // --- Level 2: Explicit prompt-sharing ---
  if (hasExplicitPromptSnippet(bodyText)) {
    if (hasVideo || mentionsVideoTool(bodyText)) return "video_prompt";
    return "image_prompt";
  }

  // --- Level 3: Prompt-sharing language + tool mention ---
  const hasPromptLanguage = PROMPT_SHARING_PATTERNS.some((p) => p.test(bodyText));
  if (hasPromptLanguage) {
    if (hasVideo && mentionsVideoTool(bodyText)) return "video_prompt";
    if (mentionsImageTool(bodyText)) return "image_prompt";
    if (mentionsVideoTool(bodyText)) return hasVideo ? "video_prompt" : "image_prompt";
  }

  // --- Level 4: Tool mentions/showcase language are NOT enough ---
  // "Generated with Midjourney" or "made with Kling" without the actual prompt
  // is still just a tweet for this classifier.

  return "tweet";
}
