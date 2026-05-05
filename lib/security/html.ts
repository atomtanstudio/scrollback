import { JSDOM } from "jsdom";

const ALLOWED_TAGS = new Set([
  "a",
  "article",
  "b",
  "blockquote",
  "br",
  "caption",
  "code",
  "div",
  "em",
  "figcaption",
  "figure",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "li",
  "mark",
  "ol",
  "p",
  "pre",
  "s",
  "section",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "time",
  "tr",
  "u",
  "ul",
]);

const DROP_WITH_CONTENT = new Set([
  "base",
  "button",
  "embed",
  "form",
  "iframe",
  "input",
  "link",
  "math",
  "meta",
  "noscript",
  "object",
  "script",
  "style",
  "svg",
  "textarea",
]);

const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

function isSafeIntegerAttribute(value: string): boolean {
  return /^\d{1,4}$/.test(value.trim());
}

function sanitizeId(value: string): string | null {
  const clean = value.trim().replace(/[^\w:.-]/g, "-").slice(0, 120);
  return clean || null;
}

function normalizeUrl(
  rawValue: string | null,
  baseUrl: string | undefined,
  allowedProtocols: Set<string>
): string | null {
  const value = rawValue?.trim();
  if (!value) return null;

  try {
    const url = baseUrl ? new URL(value, baseUrl) : new URL(value);
    if (!allowedProtocols.has(url.protocol)) return null;
    return url.href;
  } catch {
    return null;
  }
}

function removeUnsafeAttributes(element: Element, baseUrl?: string) {
  const tag = element.tagName.toLowerCase();

  for (const attr of Array.from(element.attributes)) {
    const name = attr.name.toLowerCase();
    const value = attr.value;
    element.removeAttribute(attr.name);

    if (tag === "a" && name === "href") {
      const href = normalizeUrl(value, baseUrl, new Set(["http:", "https:", "mailto:"]));
      if (href) {
        element.setAttribute("href", href);
        element.setAttribute("target", "_blank");
        element.setAttribute("rel", "noopener noreferrer nofollow");
      }
      continue;
    }

    if (tag === "a" && name === "title") {
      element.setAttribute("title", value.trim().slice(0, 240));
      continue;
    }

    if (tag === "img" && name === "src") {
      const src = normalizeUrl(value, baseUrl, new Set(["http:", "https:"]));
      if (src) {
        element.setAttribute("src", src);
        element.setAttribute("loading", "lazy");
        element.setAttribute("decoding", "async");
      }
      continue;
    }

    if (tag === "img" && (name === "alt" || name === "title")) {
      element.setAttribute(name, value.trim().slice(0, 240));
      continue;
    }

    if (tag === "img" && (name === "width" || name === "height") && isSafeIntegerAttribute(value)) {
      element.setAttribute(name, value.trim());
      continue;
    }

    if ((tag === "td" || tag === "th") && (name === "colspan" || name === "rowspan") && isSafeIntegerAttribute(value)) {
      element.setAttribute(name, value.trim());
      continue;
    }

    if (tag === "time" && name === "datetime") {
      element.setAttribute("datetime", value.trim().slice(0, 80));
      continue;
    }

    if (HEADING_TAGS.has(tag) && name === "id") {
      const id = sanitizeId(value);
      if (id) element.setAttribute("id", id);
    }
  }
}

function sanitizeChildren(parent: Node, baseUrl?: string) {
  for (const child of Array.from(parent.childNodes)) {
    if (child.nodeType === child.COMMENT_NODE) {
      child.parentNode?.removeChild(child);
      continue;
    }

    if (child.nodeType !== child.ELEMENT_NODE) {
      continue;
    }

    sanitizeElement(child as Element, baseUrl);
  }
}

function sanitizeElement(element: Element, baseUrl?: string) {
  const tag = element.tagName.toLowerCase();

  if (DROP_WITH_CONTENT.has(tag)) {
    element.remove();
    return;
  }

  if (!ALLOWED_TAGS.has(tag)) {
    sanitizeChildren(element, baseUrl);
    element.replaceWith(...Array.from(element.childNodes));
    return;
  }

  removeUnsafeAttributes(element, baseUrl);

  if (tag === "img" && !element.getAttribute("src")) {
    element.remove();
    return;
  }

  sanitizeChildren(element, baseUrl);
}

export function sanitizeArticleHtml(html: string | null | undefined, baseUrl?: string | null): string | null {
  if (!html?.trim()) return null;

  const documentUrl = baseUrl || "https://scrollback.invalid/";
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`, { url: documentUrl });
  sanitizeChildren(dom.window.document.body, baseUrl || undefined);
  const sanitized = dom.window.document.body.innerHTML.trim();
  return sanitized || null;
}
