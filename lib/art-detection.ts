import { isLikelyVisualPromptText } from "@/lib/visual-prompt";

const IMAGE_TOOL_PATTERNS = [
  "midjourney",
  "dall-?e(?:\\s*[23])?",
  "stable\\s*diffusion",
  "sdxl",
  "sd3",
  "flux",
  "grok\\s*(?:imagine|aurora)",
  "aurora",
  "imagen(?:\\s*[234])?",
  "ideogram",
  "firefly",
  "reve\\s*image",
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

const VIDEO_TOOL_PATTERNS = [
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
  "stable\\s*video(?:\\s*diffusion)?",
  "pixverse",
  "jimeng",
  "genmo",
  "mochi",
  "movie\\s*gen",
  "haiper",
  "animatediff",
  "cogvideo(?:x)?",
  "ltx\\s*(?:video|studio)",
  "domo\\s*ai",
  "viggle(?:\\s*ai)?",
];

const ART_CUE_PATTERNS = [
  /\bstyle\s+reference\b/i,
  /\bsref\s+club\b/i,
  /\bprompt\s+share\b/i,
  /\bprompt\s+template\b/i,
  /\b(?:here(?:'s| is)|sharing)\s+(?:the|my)\s+prompt\b/i,
  /\bmade\s+with\b/i,
  /\bgenerated\s+with\b/i,
  /\bgenerated\s+in\b/i,
  /\bgenerated\s+using\b/i,
  /\bcreated\s+with\b/i,
  /\brendered\s+with\b/i,
  /\bedited\s+with\b/i,
  /\bremix(?:ed)?\b/i,
  /\bai\s+(?:art|video|image)\b/i,
  /\bimage-to-video\b/i,
  /\bimg2vid\b/i,
  /\bworkflow\b/i,
  /\bshowcase\b/i,
  /\b--sref\b/i,
];

const NON_ART_CONTENT_PATTERNS = [
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
  /\bdataset\b/i,
  /\bguides?\b/i,
  /\bthread by\b/i,
];

const PLACEHOLDER_PROMPT_PATTERNS = [
  /\bprompt in alt\b/i,
  /\bsee alt for prompt\b/i,
  /\bprompt in the comments\b/i,
  /\bprompt below\b/i,
  /\b10 prompts below\b/i,
];

const SREF_CONTEXT_PATTERNS = [
  /\bstyle\s+reference\b/i,
  /\bsref\b/i,
];

const PROMPT_SHARE_CONTEXT_PATTERNS = [
  /\bprompt\b/i,
  /\bjson prompt\b/i,
  /\bprompt drop\b/i,
  /\bcopy\s*(?:&|&amp;)\s*paste\b/i,
  /\bgrab it here\b/i,
];

const META_PROMPT_PATTERNS = [
  /\brole\b[:：]/i,
  /\btask\b[:：]/i,
  /\breconstruction-?grade json dataset\b/i,
  /\bsubject\(主題\)\s*\+\s*composition\(構図\)/i,
  /\bturn this transcript into a cheatsheet\b/i,
  /\b20 effective prompts\b/i,
];

const SYSTEM_FRAMEWORK_PROMPT_PATTERNS = [
  /\bsystem prompt\b/i,
  /\bcross-architecture\b/i,
  /\btranslation specialist\b/i,
  /\barchitectural_context\b/i,
  /\bsource_model\b/i,
  /\btarget_model\b/i,
  /\boperational_workflow\b/i,
  /\bsafety_reframing_strategy\b/i,
  /\bprompt_generation_rules\b/i,
  /\bresponse_template\b/i,
  /\boutput_formats\b/i,
  /\bidentity\s*:\s*\bname\b/i,
];

const NON_ART_PROMPT_TARGET_PATTERNS = [
  /\bwebsite\b/i,
  /\blogos?\b/i,
  /\bicons?\b/i,
  /\bcheatsheet\b/i,
  /\btranscript\b/i,
  /\bdataset\b/i,
];

const VISUAL_PROMPT_ACTION_PATTERN =
  /\b(?:faceswap|face swap|replace the face|transform|translate|translation|replace text|replace the japanese text|colori[sz]e|turn|generate|create|render|illustration to figure)\b/i;

const VISUAL_PROMPT_SUBJECT_PATTERN =
  /\b(?:portrait|photography|photo|image|woman|man|girl|boy|person|face|character|product|beach|scene|comic|manga|kitten|figure|dress|outfit)\b/i;

const VISUAL_PROMPT_STYLE_PATTERN =
  /\b(?:realistic|portrait photography|photography|photo grid|multi angle|pixel-?art|anime|cinematic|photorealistic|stylized|editorial|fashion)\b/i;

const GENERATED_VISUAL_MEDIA_PATTERNS = [
  /\bportrait\b/i,
  /\bwoman\b/i,
  /\bman\b/i,
  /\bperson\b/i,
  /\bcharacter\b/i,
  /\bpixel-?art\b/i,
  /\bfighting game\b/i,
  /\billustration\b/i,
  /\banime\b/i,
  /\bmanga\b/i,
  /\bcollage\b/i,
  /\bstylized\b/i,
  /\bphoto(?:graph)?s?\b/i,
  /\bscene\b/i,
  /\bcosplay\b/i,
  /\bkitten\b/i,
];

const STRUCTURED_VISUAL_OUTPUT_PATTERNS = [
  /\bheadshot\b/i,
  /\bselfie\b/i,
  /\bphotorealistic self(?:ie|ies)\b/i,
  /\bposter\b/i,
  /\bmagazine cover\b/i,
  /\btarget_style\b/i,
  /\bstyle_settings\b/i,
  /\bline-art\b/i,
  /\bwatercolor\b/i,
  /\bsumi-e\b/i,
  /\bfigure-render\b/i,
  /\bsubject_layer\b/i,
  /\btitle_layer\b/i,
  /\bbarcode\b/i,
  /\bwardrobe\b/i,
  /\bexpression\b/i,
  /\bbackground\b/i,
  /\blighting\b/i,
  /\bcamera system\b/i,
  /\brender output\b/i,
  /\banomaly\b/i,
  /\bprofessional attire\b/i,
  /\bframing_and_perspective\b/i,
  /\blighting_and_exposure\b/i,
  /\bcomputational_pipeline\b/i,
  /\bfailure_modes_active\b/i,
  /\blens_equiv_mm\b/i,
];

function normalize(text: string | null | undefined): string {
  return (text || "").replace(/\s+/g, " ").trim();
}

function buildToolRegex(patterns: string[]): RegExp {
  return new RegExp(`\\b(?:${patterns.join("|")})\\b`, "i");
}

const IMAGE_TOOL_REGEX = buildToolRegex(IMAGE_TOOL_PATTERNS);
const VIDEO_TOOL_REGEX = buildToolRegex(VIDEO_TOOL_PATTERNS);

export interface ArtEvidenceInput {
  title?: string | null;
  bodyText?: string | null;
  promptText?: string | null;
  promptType?: string | null;
  mediaAltText?: string | null;
  hasVideo?: boolean;
}

export function hasArtGenerationContext(text: string | null | undefined, hasVideo: boolean = false): boolean {
  const normalized = normalize(text);
  if (!normalized) return false;

  const hasImageTool = IMAGE_TOOL_REGEX.test(normalized);
  const hasVideoTool = VIDEO_TOOL_REGEX.test(normalized);
  const hasTool = hasImageTool || hasVideoTool;
  const hasCue = ART_CUE_PATTERNS.some((pattern) => pattern.test(normalized));

  if (/\b--sref\s+\d+/i.test(normalized)) return true;
  if (hasCue && hasTool) return true;
  if (hasVideo && hasVideoTool) return true;

  return false;
}

export function looksLikeNonArtVisualContent(text: string | null | undefined): boolean {
  const normalized = normalize(text);
  if (!normalized) return false;
  return NON_ART_CONTENT_PATTERNS.some((pattern) => pattern.test(normalized));
}

function looksLikeMetaPromptText(text: string | null | undefined): boolean {
  const normalized = normalize(text);
  if (!normalized) return false;
  return META_PROMPT_PATTERNS.some((pattern) => pattern.test(normalized));
}

function looksLikeSystemFrameworkPrompt(text: string | null | undefined): boolean {
  const normalized = normalize(text);
  if (!normalized) return false;
  return SYSTEM_FRAMEWORK_PROMPT_PATTERNS.some((pattern) => pattern.test(normalized));
}

function targetsNonArtOutput(text: string | null | undefined): boolean {
  const normalized = normalize(text);
  if (!normalized) return false;
  return NON_ART_PROMPT_TARGET_PATTERNS.some((pattern) => pattern.test(normalized));
}

function hasConcreteVisualPromptIntent(text: string | null | undefined): boolean {
  const normalized = normalize(text);
  if (!normalized) return false;
  const hasAction = VISUAL_PROMPT_ACTION_PATTERN.test(normalized);
  const hasSubject = VISUAL_PROMPT_SUBJECT_PATTERN.test(normalized);
  const hasStyleCue = VISUAL_PROMPT_STYLE_PATTERN.test(normalized);
  const longDescriptivePrompt = normalized.split(/\s+/).length >= 8;
  return hasSubject && (hasAction || hasStyleCue || longDescriptivePrompt);
}

function hasPromptShareContext(text: string | null | undefined): boolean {
  const normalized = normalize(text);
  if (!normalized) return false;
  return PROMPT_SHARE_CONTEXT_PATTERNS.some((pattern) => pattern.test(normalized));
}

function looksLikeArtMedia(text: string | null | undefined): boolean {
  const normalized = normalize(text);
  if (!normalized) return false;
  return GENERATED_VISUAL_MEDIA_PATTERNS.some((pattern) => pattern.test(normalized));
}

function hasStructuredVisualOutputSpec(text: string | null | undefined): boolean {
  const normalized = normalize(text);
  if (!normalized) return false;
  const matches = STRUCTURED_VISUAL_OUTPUT_PATTERNS.filter((pattern) =>
    pattern.test(normalized),
  ).length;
  return matches >= 2;
}

export function qualifiesAsArtCapture(input: ArtEvidenceInput): boolean {
  if (input.promptType === "text") return false;

  const title = normalize(input.title);
  const body = normalize(input.bodyText);
  const prompt = normalize(input.promptText);
  const mediaAlt = normalize(input.mediaAltText);
  const hasVideo = !!input.hasVideo;

  const combinedText = [title, body, prompt].filter(Boolean).join(" ");
  const nonArtSignals = looksLikeNonArtVisualContent([title, body, mediaAlt].filter(Boolean).join(" "));
  const placeholderPrompt = PLACEHOLDER_PROMPT_PATTERNS.some((pattern) => pattern.test(prompt));
  const urlOnlyPrompt = /^https?:\/\//i.test(prompt);
  const metaPrompt = looksLikeMetaPromptText(prompt);
  const systemFrameworkPrompt = looksLikeSystemFrameworkPrompt(prompt);
  const nonArtPromptTarget = targetsNonArtOutput(prompt);

  const strongPrompt = isLikelyVisualPromptText(prompt);
  const bareSrefPrompt = /^--sref\s+\d+/i.test(prompt);
  const concreteVisualPrompt = hasConcreteVisualPromptIntent(prompt);
  const contextualArt = hasArtGenerationContext(combinedText, hasVideo);
  const srefContext = SREF_CONTEXT_PATTERNS.some((pattern) =>
    pattern.test([title, body, mediaAlt].filter(Boolean).join(" ")),
  );
  const promptShareContext = hasPromptShareContext([title, body].filter(Boolean).join(" "));
  const artMedia = looksLikeArtMedia(mediaAlt);
  const structuredVisualSpec = hasStructuredVisualOutputSpec([title, body, prompt].join(" "));

  if ((metaPrompt || systemFrameworkPrompt) && !structuredVisualSpec) return false;
  if (concreteVisualPrompt && !nonArtPromptTarget) return true;
  if (structuredVisualSpec && !nonArtPromptTarget) return true;
  if (strongPrompt) return true;
  if (bareSrefPrompt && srefContext) return true;
  if (bareSrefPrompt) return contextualArt;
  if (promptShareContext && artMedia && !nonArtPromptTarget) return true;
  if (artMedia && contextualArt && !nonArtPromptTarget) return true;
  if ((placeholderPrompt || urlOnlyPrompt) && contextualArt && !nonArtSignals) return true;
  if (contextualArt && !nonArtSignals) return true;
  if (contextualArt && strongPrompt) return true;

  return false;
}
