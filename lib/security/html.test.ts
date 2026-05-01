import { describe, expect, it } from "vitest";
import { sanitizeArticleHtml } from "@/lib/security/html";

describe("sanitizeArticleHtml", () => {
  it("removes executable markup and event handlers", () => {
    const html = sanitizeArticleHtml(`
      <article>
        <h2 onclick="alert(1)">Launch notes</h2>
        <p>Safe text<script>alert("xss")</script></p>
        <img src="https://example.com/image.jpg" onerror="alert(1)" style="position:fixed" />
      </article>
    `);

    expect(html).toContain("<h2>Launch notes</h2>");
    expect(html).toContain("<p>Safe text</p>");
    expect(html).toContain('src="https://example.com/image.jpg"');
    expect(html).not.toContain("script");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("style=");
  });

  it("blocks javascript URLs and hardens outbound links", () => {
    const html = sanitizeArticleHtml(`
      <p>
        <a href="javascript:alert(1)">bad</a>
        <a href="/story">story</a>
      </p>
    `, "https://example.com/feed/post");

    expect(html).toContain("<a>bad</a>");
    expect(html).toContain('href="https://example.com/story"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
    expect(html).not.toContain("javascript:");
  });
});
