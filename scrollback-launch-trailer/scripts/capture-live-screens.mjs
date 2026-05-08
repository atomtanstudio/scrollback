import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const outDir = join(root, "scrollback-launch-trailer", "assets", "screenshots-live");
const require = createRequire("/Users/richgates/.npm/_npx/4243bb55c76b61c0/node_modules/puppeteer-core/package.json");
const puppeteer = require("puppeteer-core");

const executablePath = "/Users/richgates/Library/Caches/ms-playwright/chromium-1217/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const base = process.env.SCROLLBACK_CAPTURE_BASE_URL || "http://localhost:3000";
const loginEmail = process.env.SCROLLBACK_CAPTURE_EMAIL || "trailer@scrollback.local";
const loginPassword = process.env.SCROLLBACK_CAPTURE_PASSWORD || "scrollback-trailer-pass";
const fillMode = process.env.SCROLLBACK_CAPTURE_FILL_MODE || "direct";

mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath,
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--font-render-hinting=none"],
});

const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1200, deviceScaleFactor: 2 });

async function waitForApp() {
  await page.waitForNetworkIdle({ idleTime: 600, timeout: 15_000 }).catch(() => {});
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  await page.addStyleTag({
    content: `
      nextjs-portal,
      [data-nextjs-toast],
      [data-nextjs-dialog-overlay],
      [data-nextjs-build-error] {
        display: none !important;
        opacity: 0 !important;
      }
    `,
  }).catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 500));
}

async function login() {
  await page.goto(`${base}/login?callbackUrl=/`, { waitUntil: "domcontentloaded" });
  await waitForApp();
  await page.waitForSelector('input[name="email"]', { timeout: 15_000 });
  if (fillMode === "type") {
    await page.click('input[name="email"]', { clickCount: 3 });
    await page.type('input[name="email"]', loginEmail);
    await page.click('input[name="password"]', { clickCount: 3 });
    await page.type('input[name="password"]', loginPassword);
  } else {
    await page.evaluate(
      ({ email, password }) => {
        for (const [name, value] of [
          ["email", email],
          ["password", password],
        ]) {
          const input = document.querySelector(`input[name="${name}"]`);
          input.value = value;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
      },
      { email: loginEmail, password: loginPassword },
    );
  }
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15_000 }).catch(() => {});
  await waitForApp();
  await page.waitForFunction(
    () => !/\/login(?:\?|$)/.test(window.location.pathname + window.location.search),
    { timeout: 15_000 },
  ).catch(() => {});
  await waitForApp();

  const state = await page.evaluate(() => ({
    url: window.location.href,
    text: document.body.innerText.replace(/\s+/g, " ").trim().slice(0, 500),
  }));

  if (/\/login(?:\?|$)/.test(new URL(state.url).pathname + new URL(state.url).search)) {
    throw new Error(`Login did not complete. Current page: ${state.url}. Text: ${state.text}`);
  }
}

async function capture(name, path, afterLoad) {
  await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded" });
  await waitForApp();
  if (afterLoad) await afterLoad();
  await waitForApp();
  await page.screenshot({ path: join(outDir, name), fullPage: false, type: "png" });
  console.log(`Captured ${name}`);
}

await login();

const discovery = await page.evaluate(async () => {
  const text = document.body.innerText;
  const links = Array.from(document.querySelectorAll('a[href^="/item/"]')).map((link) => ({
    href: link.getAttribute("href"),
    text: link.textContent?.replace(/\s+/g, " ").trim() || "",
  }));
  return { text, links };
});

const itemLinks = Array.from(new Set(discovery.links.map((link) => link.href).filter(Boolean)));

async function findDetail(predicate) {
  for (const href of itemLinks.slice(0, 24)) {
    await page.goto(`${base}${href}`, { waitUntil: "domcontentloaded" });
    await waitForApp();
    const text = await page.evaluate(() => document.body.innerText);
    if (predicate(text)) return href;
  }
  return itemLinks[0] || "/";
}

const taggedDetailPath = await findDetail((text) => text.includes("AI Summary") && text.includes("Tags"));
const mediaDetailPath = await findDetail((text) => /Backfill Media|Read Original|AI Summary|Tags/.test(text));

await capture("01-live-capture-library.png", "/");
await capture("02-live-search-results.png", "/?q=AI", async () => {
  await page.waitForFunction(() => /result|results|No results/i.test(document.body.innerText), { timeout: 10_000 }).catch(() => {});
});
await capture("03-live-articles-filter.png", "/?type=article", async () => {
  await page.waitForFunction(() => document.body.innerText.includes("Articles"), { timeout: 10_000 }).catch(() => {});
});
await capture("04-live-detail-summary-tags.png", taggedDetailPath, async () => {
  await page.waitForFunction(() => document.body.innerText.includes("AI Summary") || document.body.innerText.includes("Tags"), { timeout: 10_000 }).catch(() => {});
});
await capture("05-live-detail-context.png", mediaDetailPath);
await capture("06-live-settings-export.png", "/settings", async () => {
  await page.waitForFunction(() => document.body.innerText.includes("Export JSON"), { timeout: 15_000 }).catch(() => {});
  await page.evaluate(() => {
    const dataHeading = Array.from(document.querySelectorAll("h3, h4")).find((el) => el.textContent?.trim() === "Data");
    dataHeading?.scrollIntoView({ block: "center" });
  });
});

await browser.close();
