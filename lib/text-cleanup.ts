const LEADING_ARTIFACTS_RE = /^[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200D\u2060\uFEFF\uFE0E\uFE0F]+/;
const TRAILING_ARTIFACTS_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200D\u2060\uFEFF\uFE0E\uFE0F]+$/;
const PREFIX_ORPHAN_VARIATION_RE = /(^|[\s([{'"“‘])[\uFE0E\uFE0F]+(?=\S)/g;
const SUFFIX_ORPHAN_VARIATION_RE = /[\uFE0E\uFE0F]+(?=[\s)\]}'"”’]|$)/g;

export function normalizeCapturedText(value: string | null | undefined): string {
  if (!value) return "";

  return value
    .replace(/\0/g, "")
    .replace(LEADING_ARTIFACTS_RE, "")
    .replace(TRAILING_ARTIFACTS_RE, "")
    .replace(PREFIX_ORPHAN_VARIATION_RE, "$1")
    .replace(SUFFIX_ORPHAN_VARIATION_RE, "");
}
