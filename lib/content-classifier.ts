/**
 * Content type classifier for captured items.
 *
 * Determines whether a tweet/post is a regular tweet, an AI image prompt,
 * or an AI video prompt based on body text + media presence.
 *
 * Key principle: bare tool name mentions are NOT enough. We require either:
 *   1. Strong prompt syntax (Midjourney --ar, /imagine, etc.)
 *   2. Tool name + generation context ("made with Kling", "Sora generated this")
 *   3. Tool name + prompt-sharing language ("prompt:", JSON with prompt keys)
 *   4. Technical generation parameters (CFG scale, seed, sampler, etc.)
 */

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
const ALL_TOOLS = [...ALL_IMAGE_TOOLS, ...ALL_VIDEO_TOOLS];

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

// --- Generation context phrases ---
// These must appear near a tool name to trigger classification

const GEN_CONTEXT_BEFORE = [
  "generated\\s+(?:with|using|by|in|via|on|from)",
  "created\\s+(?:with|using|by|in|via|on)",
  "made\\s+(?:with|using|by|in|via|on)",
  "built\\s+(?:with|using|by|in|via)",
  "rendered\\s+(?:with|using|by|in|via)",
  "produced\\s+(?:with|using|by|in|via)",
  "powered\\s+by",
  "prompt(?:ed)?\\s+(?:with|in|on|for|using)",
];

const GEN_CONTEXT_AFTER = [
  "generation",
  "generated\\s+(?:this|image|video|clip|art|photo|animation)",
  "prompt",
  "output",
  "render(?:ed)?",
  "result",
];

// Prompt-sharing language (standalone indicators when combined with media)
const PROMPT_SHARING_PATTERNS = [
  /\bprompt\s*:/i,
  /\b(?:image|video)\s+prompt\b/i,
  /\bhere(?:'s| is) (?:the|my) prompt\b/i,
  /\bprompt (?:I |i )used\b/i,
  /\bsharing (?:the|my) prompt\b/i,
  /\bai[\s-]?(?:generated|art|image|video|animation)\b/i,
  /\btext[\s-]?to[\s-]?(?:image|video)\b/i,
];

/**
 * Build a regex that matches: <generation context> ... <tool name>
 * or: <tool name> ... <generation context>
 * with up to ~60 chars between them (roughly same sentence).
 */
function buildContextualToolRegex(toolPatterns: string[], contextBefore: string[], contextAfter: string[]): RegExp[] {
  const toolGroup = toolPatterns.join("|");
  const beforeGroup = contextBefore.join("|");
  const afterGroup = contextAfter.join("|");

  return [
    // Context before tool: "generated with Midjourney"
    new RegExp(`(?:${beforeGroup})\\s+(?:${toolGroup})`, "i"),
    // Tool before context: "Midjourney generation", "Sora generated this"
    new RegExp(`\\b(?:${toolGroup})\\s+(?:${afterGroup})`, "i"),
  ];
}

const IMAGE_CONTEXTUAL = buildContextualToolRegex(ALL_IMAGE_TOOLS, GEN_CONTEXT_BEFORE, GEN_CONTEXT_AFTER);
const VIDEO_CONTEXTUAL = buildContextualToolRegex(ALL_VIDEO_TOOLS, GEN_CONTEXT_BEFORE, GEN_CONTEXT_AFTER);
const ANY_CONTEXTUAL = buildContextualToolRegex(ALL_TOOLS, GEN_CONTEXT_BEFORE, GEN_CONTEXT_AFTER);

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

  // --- Level 2: Tool name + generation context ---
  // Check video tools first (if has video media)
  if (hasVideo) {
    for (const re of VIDEO_CONTEXTUAL) {
      if (re.test(bodyText)) return "video_prompt";
    }
  }
  // Check image tools
  for (const re of IMAGE_CONTEXTUAL) {
    if (re.test(bodyText)) return "image_prompt";
  }
  // Any tool with generation context
  for (const re of ANY_CONTEXTUAL) {
    if (re.test(bodyText)) {
      return hasVideo ? "video_prompt" : "image_prompt";
    }
  }

  // --- Level 3: Prompt-sharing language + tool mention ---
  const hasPromptLanguage = PROMPT_SHARING_PATTERNS.some((p) => p.test(bodyText));
  if (hasPromptLanguage) {
    if (hasVideo && mentionsVideoTool(bodyText)) return "video_prompt";
    if (mentionsImageTool(bodyText)) return "image_prompt";
    if (mentionsVideoTool(bodyText)) return hasVideo ? "video_prompt" : "image_prompt";
  }

  // --- Level 4: Bare tool mentions are NOT enough ---
  // A tweet saying "I used Kling video animations" in a tutorial is NOT a video_prompt.
  // We intentionally do NOT match bare tool names without generation context.

  return "tweet";
}
