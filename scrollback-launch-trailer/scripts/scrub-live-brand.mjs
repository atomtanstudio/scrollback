import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const require = createRequire(import.meta.url);
const sharp = require("sharp");

const groups = [
  {
    inputDir: join(root, "scrollback-launch-trailer", "assets", "screenshots-live"),
    outputDir: join(root, "scrollback-launch-trailer", "assets", "screenshots-live-clean"),
    files: [
      "01-live-capture-library.png",
      "02-live-search-results.png",
      "03-live-articles-filter.png",
      "04-live-detail-summary-tags.png",
      "05-live-detail-context.png",
      "06-live-settings-export.png",
    ],
  },
  {
    inputDir: join(root, "scrollback-launch-trailer", "assets", "site-audit"),
    outputDir: join(root, "scrollback-launch-trailer", "assets", "site-audit-clean"),
    files: [
      "01-library.png",
      "02-search-ai.png",
      "03-articles.png",
      "04-detail-context.png",
      "05-settings-data.png",
      "06-admin-items.png",
    ],
  },
];

function brandScrubSvg({ replaceSettingsText = false, replaceSidebarSupport = false } = {}) {
  return Buffer.from(`
    <svg width="3840" height="2400" viewBox="0 0 3840 2400" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fadeRight" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stop-color="#080c10" stop-opacity="1"/>
          <stop offset="0.78" stop-color="#080c10" stop-opacity="1"/>
          <stop offset="1" stop-color="#080c10" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="fadeDown" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#080c10" stop-opacity="1"/>
          <stop offset="0.72" stop-color="#080c10" stop-opacity="1"/>
          <stop offset="1" stop-color="#080c10" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <rect x="405" y="28" width="930" height="170" rx="0" fill="url(#fadeRight)"/>
      <rect x="405" y="28" width="760" height="212" rx="0" fill="url(#fadeDown)"/>
      <text x="430" y="126" font-family="Inter, Arial, sans-serif" font-size="68" font-weight="700" fill="#f7f5ef">scroll</text>
      <circle cx="622" cy="101" r="16" fill="#d8b16f"/>
      <text x="650" y="126" font-family="Inter, Arial, sans-serif" font-size="68" font-weight="700" fill="#f7f5ef">back</text>
      ${
        replaceSettingsText
          ? `<rect x="1888" y="216" width="1390" height="94" rx="0" fill="#101318" opacity="0.98"/>
      <text x="1938" y="273" font-family="Inter, Arial, sans-serif" font-size="31" font-weight="400" fill="#a9a095">Scrollback surfaces recurring capture themes as obvious interests bubble up.</text>`
          : ""
      }
      ${
        replaceSidebarSupport
          ? `<rect x="480" y="2060" width="650" height="84" rx="0" fill="#121417" opacity="0.98"/>
      <text x="514" y="2113" font-family="Inter, Arial, sans-serif" font-size="31" font-weight="400" fill="#a9a095">More from the maker of Scrollback</text>`
          : ""
      }
    </svg>
  `);
}

for (const group of groups) {
  mkdirSync(group.outputDir, { recursive: true });
  for (const file of group.files) {
    await sharp(join(group.inputDir, file))
      .composite([
        {
          input: brandScrubSvg({
            replaceSettingsText: file === "05-settings-data.png",
            replaceSidebarSupport: ["01-library.png", "02-search-ai.png", "03-articles.png"].includes(file),
          }),
          left: 0,
          top: 0,
        },
      ])
      .png({ compressionLevel: 9 })
      .toFile(join(group.outputDir, file));
    console.log(`Wrote ${join(group.outputDir, file)}`);
  }
}
