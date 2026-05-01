# Chrome Web Store Listing — FeedSilo Capture

Use this content when filling out the Chrome Web Store developer dashboard.

---

## Name

FeedSilo Capture

## Short Description (132 char max)

Capture tweets, threads, and articles from X/Twitter to your self-hosted FeedSilo knowledge base.

## Detailed Description

FeedSilo Capture lets you save tweets, full threads, and linked articles from X (formerly Twitter) directly into your own FeedSilo instance — a self-hosted, searchable knowledge base.

**One-Click Capture**
See a tweet worth saving? Click the FeedSilo button that appears on every tweet to capture it instantly — including text, images, videos, GIFs, and linked articles.

**Full Thread Capture**
When you capture a tweet that's part of a conversation, FeedSilo automatically fetches and saves the entire thread so you never lose context.

**Bulk Capture**
Open your Likes or Bookmarks page and capture everything at once. FeedSilo Capture supports two bulk modes:
• Page scraping — captures tweets visible on the page as you scroll
• X API mode — uses your X API bearer token for faster, more reliable bulk capture

**Article Resolution**
Tweets that link to articles are enriched with the article title, preview text, and link card image — all saved alongside the tweet.

**Self-Hosted & Private**
Your data goes to your FeedSilo server and nowhere else. No analytics, no telemetry, no third-party data collection. You own your data.

**How It Works**
1. Install the extension
2. Enter your FeedSilo server URL and pairing token in the popup
3. Navigate to x.com and start capturing

FeedSilo is open source. Learn more at https://feedsilo.app

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
The extension sends captured data to a user-configured FeedSilo server URL. Since FeedSilo is self-hosted, the server can be at any domain or local address. Permission is requested at runtime only when the user saves their server URL.

---

## Screenshot Suggestions

Capture these for your 1280x800 store screenshots:

1. **Popup connected** — Extension popup showing "Connected" status with server URL filled in
2. **Capture button on tweet** — A tweet on x.com with the FeedSilo capture button visible
3. **Bulk capture in action** — The Likes/Bookmarks page with bulk capture running
4. **Saved item in FeedSilo** — The FeedSilo web UI showing a captured tweet with media

---

## Privacy Practices (Dashboard Checkboxes)

When filling out the "Privacy practices" tab:

- **Single purpose description**: "Captures tweets, threads, and articles from X/Twitter and sends them to the user's self-hosted FeedSilo server."
- Does the extension collect or transmit data to the developer? **No** — user-directed captured content is sent only to the user's configured FeedSilo server.
- Does the extension use remote code? **No**
- Certify data use disclosures: **Yes**

Privacy policy URL: https://feedsilo.app/privacy-policy
