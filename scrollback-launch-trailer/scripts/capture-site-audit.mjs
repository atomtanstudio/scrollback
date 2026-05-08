import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const outDir = join(root, "scrollback-launch-trailer", "assets", "site-audit");
const require = createRequire("/Users/richgates/.npm/_npx/4243bb55c76b61c0/node_modules/puppeteer-core/package.json");
const puppeteer = require("puppeteer-core");

const executablePath = "/Users/richgates/Library/Caches/ms-playwright/chromium-1217/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const base = process.env.SCROLLBACK_CAPTURE_BASE_URL || "http://localhost:3000";
const loginEmail = process.env.SCROLLBACK_CAPTURE_EMAIL || "trailer@scrollback.local";
const loginPassword = process.env.SCROLLBACK_CAPTURE_PASSWORD || "scrollback-trailer-pass";

mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath,
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--font-render-hinting=none"],
});

const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1200, deviceScaleFactor: 2 });

const audit = [];

async function waitForApp() {
  await page.waitForNetworkIdle({ idleTime: 700, timeout: 18_000 }).catch(() => {});
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  await page.addStyleTag({
    content: `
      nextjs-portal,
      [data-nextjs-toast],
      [data-nextjs-dialog-overlay],
      [data-nextjs-build-error] { display: none !important; opacity: 0 !important; }
    `,
  }).catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 700));
}

async function login() {
  await page.goto(`${base}/login?callbackUrl=/`, { waitUntil: "domcontentloaded" });
  await waitForApp();
  await page.waitForSelector('input[name="email"]', { timeout: 15_000 });
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
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15_000 }).catch(() => {});
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
  const text = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").trim());
  const links = await page.evaluate(() =>
    Array.from(document.querySelectorAll("a[href]"))
      .map((link) => link.getAttribute("href"))
      .filter(Boolean)
      .slice(0, 30),
  );
  await page.screenshot({ path: join(outDir, name), fullPage: false, type: "png" });
  audit.push({ name, path, title: await page.title(), text: text.slice(0, 1600), links });
  console.log(`Captured ${name}`);
  return { text, links };
}

await login();

const home = await capture("01-library.png", "/");
const itemLinks = Array.from(new Set(home.links.filter((href) => href?.startsWith("/item/"))));

async function findDetail(predicate) {
  for (const href of itemLinks.slice(0, 36)) {
    await page.goto(`${base}${href}`, { waitUntil: "domcontentloaded" });
    await waitForApp();
    const text = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").trim());
    if (predicate(text)) return href;
  }
  return itemLinks[0] || "/";
}

const detailPath = await findDetail((text) => /Tags|AI Summary|Backfill Media|Read Original/i.test(text));

await capture("02-search-ai.png", "/?q=AI", async () => {
  await page.waitForFunction(() => /results|No results|items/i.test(document.body.innerText), { timeout: 10_000 }).catch(() => {});
});
await capture("03-articles.png", "/?type=article", async () => {
  await page.waitForFunction(() => /Articles/i.test(document.body.innerText), { timeout: 10_000 }).catch(() => {});
});
await capture("04-detail-context.png", detailPath, async () => {
  await page.waitForFunction(() => /Tags|Read Original|Backfill Media|Processing Capture/i.test(document.body.innerText), { timeout: 10_000 }).catch(() => {});
});
await capture("05-settings-data.png", "/settings", async () => {
  await page.waitForFunction(() => /Export JSON|Pinned Topics|Data/i.test(document.body.innerText), { timeout: 15_000 }).catch(() => {});
  await page.evaluate(() => {
    const dataHeading = Array.from(document.querySelectorAll("h2, h3, h4")).find((el) => el.textContent?.trim() === "Data");
    dataHeading?.scrollIntoView({ block: "center" });
  });
});
await capture("06-admin-items.png", "/admin", async () => {
  await page.waitForFunction(() => /Items|Add Item|total|matching/i.test(document.body.innerText), { timeout: 15_000 }).catch(() => {});
});
await capture("07-agent-search.png", "/agent-search", async () => {
  await page.waitForFunction(() => /Agent Search|Search captured knowledge|Database/i.test(document.body.innerText), { timeout: 15_000 }).catch(() => {});
  const inputSelector = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll("input"));
    const target =
      inputs.find((input) => /captured knowledge/i.test(input.getAttribute("placeholder") || "")) ||
      inputs.find((input) => input.type !== "hidden");
    if (!target) return null;
    target.setAttribute("data-audit-target", "agent-search-input");
    return '[data-audit-target="agent-search-input"]';
  });
  if (inputSelector) {
    await page.type(inputSelector, "AI workflow");
    await page.click('button[type="submit"]').catch(() => {});
  }
  await page.waitForFunction(() => /results|Search failed|hybrid|vector/i.test(document.body.innerText), { timeout: 20_000 }).catch(() => {});
});

writeFileSync(
  join(outDir, "site-audit.json"),
  JSON.stringify({ base, capturedAt: new Date().toISOString(), pages: audit }, null, 2),
);

await browser.close();
