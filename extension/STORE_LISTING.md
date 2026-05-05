# Chrome Web Store Listing — Scrollback Capture

Use this content when filling out the Chrome Web Store developer dashboard.

---

## Name

Scrollback Capture

## Short Description (132 char max)

Capture X/Twitter posts, threads, media, and linked article cards to your self-hosted Scrollback archive.

## Detailed Description

Scrollback Capture lets you save X/Twitter posts, threads, media, and linked article metadata directly into your own Scrollback instance.

**One-Click Capture**
See a post worth saving? Click the Scrollback button that appears on X/Twitter posts to capture it instantly, including text, images, videos, GIFs, and linked article cards when available.

**Thread Capture**
When you capture a post that's part of a thread or conversation, Scrollback can save available thread context so you do not lose the surrounding discussion.

**Bulk Capture**
Open your Likes or Bookmarks page and capture everything at once. Scrollback Capture supports two bulk modes:
• Page scraping — captures tweets visible on the page as you scroll
• X API mode — uses your X API bearer token for faster, more reliable bulk capture

**Article Resolution**
Posts that link to articles are enriched with the article title, preview text, and link card image when X exposes that data.

**Self-Hosted & Private**
Your data goes to your Scrollback server and nowhere else. No analytics, no telemetry, no third-party data collection. You own your data.

**How It Works**
1. Install the extension
2. Enter your Scrollback server URL and pairing token in the popup
3. Navigate to x.com and start capturing

Scrollback is open source: https://github.com/atomtanstudio/scrollback

## Category

Productivity

## Language

English

---

## Permission Justifications

Use these when filling out the "Why do you need this permission?" fields in the developer dashboard.

### activeTab
Required to identify the current tab and send messages between the popup and the content script running on X/Twitter pages.

### storage
Required to persist user configuration (server URL, pairing token, bearer token) locally in the browser across sessions.

### alarms
Required to keep the Manifest V3 service worker alive during multi-tweet bulk capture operations, which can take several minutes to complete.

### scripting
Required to dynamically inject capture scripts into X/Twitter tabs when the user opens the extension popup or initiates a capture, ensuring the content script is active.

### Host permissions: x.com, twitter.com
Required to run content scripts on X/Twitter pages that read tweet content from the page and display the capture UI overlay.

### Host permission: cdn.syndication.twimg.com
Required to resolve media URLs (videos, GIFs) and article metadata (titles, preview text) from the Twitter syndication API for captured tweets.

### Optional host permissions (https://*/* and http://*/*)
The extension sends captured data to a user-configured Scrollback server URL. Since Scrollback is self-hosted, the server can be at any domain or local address. Permission is requested at runtime only when the user saves their server URL.

---

## Screenshot Suggestions

Capture these for your 1280x800 store screenshots:

1. **Popup connected** — Extension popup showing "Connected" status with server URL filled in
2. **Capture button on tweet** — A tweet on x.com with the Scrollback capture button visible
3. **Bulk capture in action** — The Likes/Bookmarks page with bulk capture running
4. **Saved item in Scrollback** — The Scrollback web UI showing a captured tweet with media

---

## Privacy Practices (Dashboard Checkboxes)

When filling out the "Privacy practices" tab:

- **Single purpose description**: "Captures X/Twitter posts, threads, media, and linked article cards and sends them to the user's self-hosted Scrollback server."
- Does the extension collect or transmit data to the developer? **No** — user-directed captured content is sent only to the user's configured Scrollback server.
- Does the extension use remote code? **No**
- Certify data use disclosures: **Yes**

Privacy policy URL: use the public URL for Scrollback's privacy policy before submission.
