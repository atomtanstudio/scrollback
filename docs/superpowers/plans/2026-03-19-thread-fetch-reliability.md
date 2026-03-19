# Thread Fetch Reliability Implementation Plan

> **For Claude:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reliably capture complete self-threads from the timeline by opening a background tab to load the full conversation via X's own frontend, then merging the data back into the originating tab's cache.

**Architecture:** When Save is clicked on a tweet that appears to be part of a thread, `content.js` asks `background.js` to open the tweet URL in a hidden tab. The new tab's content script + interceptor load the full `TweetDetail` conversation, then relay the cached tweets back to the original tab via message passing. Existing self-thread filtering (`getCandidateSelfThreadItems` / `isLikelySelfThreadEntry`) applies unchanged — only the author's self-replies are captured.

**Tech Stack:** Chrome Extension (Manifest V3), vanilla JS, Chrome messaging APIs

**Spec:** `docs/superpowers/specs/2026-03-19-thread-fetch-reliability-design.md`

---

## Chunk 1: Background Tab Orchestration

> **Note:** No manifest changes needed — `chrome.tabs.create()` and `chrome.tabs.remove()` don't require the `tabs` permission in Manifest V3.

### Task 1: Add `FETCH_THREAD` handler to `background.js`

This is the orchestrator — it creates the background tab, waits for thread data, relays it back, and cleans up.

**Files:**
- Modify: `extension/background.js:1-24` (add to message listener)

- [ ] **Step 1: Add pending fetches tracker and FETCH_THREAD handler**

Add this at the top of `background.js` (after the opening comment, before the message listener):

```js
// Track pending thread fetches: backgroundTabId → { originTabId, conversationId, resolve, timer }
const pendingThreadFetches = new Map();
```

Add this case inside the existing `chrome.runtime.onMessage.addListener` callback, after the `CHECK_CONNECTION` block (before the closing `});`):

```js
if (message.type === 'FETCH_THREAD') {
  const originTabId = sender.tab?.id;
  if (!originTabId) {
    sendResponse({ success: false, tweets: [] });
    return;
  }
  handleFetchThread(message.url, message.conversationId, originTabId).then(sendResponse);
  return true;
}

if (message.type === 'THREAD_DATA_READY') {
  const bgTabId = sender.tab?.id;
  const pending = pendingThreadFetches.get(bgTabId);
  if (pending) {
    clearTimeout(pending.timer);
    pendingThreadFetches.delete(bgTabId);
    // Forward tweets to the originating tab
    chrome.tabs.sendMessage(pending.originTabId, {
      type: 'MERGE_CACHE',
      tweets: message.tweets || [],
    }).catch(() => {});
    // Close background tab
    chrome.tabs.remove(bgTabId).catch(() => {});
    pending.resolve({ success: true, tweets: message.tweets || [] });
  }
  return;
}
```

- [ ] **Step 2: Add `handleFetchThread` function**

Add this after the `handleCheckConnection` function at the bottom of `background.js`:

```js
async function handleFetchThread(url, conversationId, originTabId) {
  return new Promise((resolve) => {
    chrome.tabs.create({ url, active: false }, (tab) => {
      if (chrome.runtime.lastError || !tab?.id) {
        resolve({ success: false, tweets: [] });
        return;
      }

      const timer = setTimeout(() => {
        // Timeout — clean up and return empty
        pendingThreadFetches.delete(tab.id);
        chrome.tabs.remove(tab.id).catch(() => {});
        resolve({ success: false, tweets: [], timeout: true });
      }, 8000);

      pendingThreadFetches.set(tab.id, {
        originTabId,
        conversationId,
        resolve,
        timer,
      });

      // Tell the new tab it's a background fetch once it's ready
      chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
        if (tabId !== tab.id || changeInfo.status !== 'complete') return;
        chrome.tabs.onUpdated.removeListener(listener);
        chrome.tabs.sendMessage(tab.id, {
          type: 'BG_FETCH_INIT',
          conversationId,
        }).catch(() => {});
      });
    });
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add extension/background.js
git commit -m "feat(ext): add FETCH_THREAD handler for background tab orchestration"
```

---

### Task 2: Add background fetch listener to `content.js`

When the content script runs in a background tab, it needs to detect the `BG_FETCH_INIT` message and send back conversation data once the TweetDetail response has been intercepted.

**Files:**
- Modify: `extension/content.js` (add near top, after the `feedsilo-api-response` listener around line 22)

- [ ] **Step 1: Add background fetch state and listener**

Add this after line 22 (after the `feedsilo-api-response` event listener closing brace):

```js
// --- Background Tab Thread Fetch ---
// When this tab was opened by background.js to fetch a full thread,
// wait for conversation data to arrive in tweetCache, then send it back.
let bgFetchConversationId = null;
let bgFetchTimer = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'BG_FETCH_INIT' && message.conversationId) {
    bgFetchConversationId = message.conversationId;
    log('Background fetch mode — waiting for conversation', bgFetchConversationId);
    // Check if data is already cached (fast path)
    trySendThreadData();
    // Also poll briefly in case data arrives after init
    let checks = 0;
    bgFetchTimer = setInterval(() => {
      checks++;
      trySendThreadData();
      if (checks >= 15) { // 15 × 500ms = 7.5s max
        clearInterval(bgFetchTimer);
        bgFetchTimer = null;
        // Send whatever we have
        sendThreadData();
      }
    }, 500);
    return;
  }

  if (message.type === 'MERGE_CACHE' && message.tweets) {
    log('Merging', message.tweets.length, 'tweets from background fetch');
    for (const tweet of message.tweets) {
      if (tweet.external_id && !tweetCache.has(tweet.external_id)) {
        tweetCache.set(tweet.external_id, tweet);
      }
    }
    return;
  }
});

function trySendThreadData() {
  if (!bgFetchConversationId) return;
  // Count how many tweets we have for this conversation
  let count = 0;
  for (const [, data] of tweetCache) {
    if (data.conversation_id === bgFetchConversationId) count++;
  }
  // Need at least 2 tweets to consider the conversation loaded
  if (count >= 2) {
    clearInterval(bgFetchTimer);
    bgFetchTimer = null;
    sendThreadData();
  }
}

function sendThreadData() {
  if (!bgFetchConversationId) return;
  const tweets = [];
  for (const [, data] of tweetCache) {
    if (data.conversation_id === bgFetchConversationId) {
      tweets.push({ ...data });
    }
  }
  log('Sending', tweets.length, 'thread tweets back to originating tab');
  chrome.runtime.sendMessage({
    type: 'THREAD_DATA_READY',
    tweets,
  });
  bgFetchConversationId = null;
}
```

- [ ] **Step 2: Commit**

```bash
git add extension/content.js
git commit -m "feat(ext): add background fetch listener and MERGE_CACHE handler in content.js"
```

---

## Chunk 2: Save Button Thread Fetch Integration

### Task 3: Add thread detection helper

A function that determines whether a background fetch should be triggered for a given tweet.

**Files:**
- Modify: `extension/content.js` (add near thread detection functions, after `detectSelfThreadInCache` around line 741)

- [ ] **Step 1: Add `shouldFetchFullThread` function**

Add after line 741 (after `detectSelfThreadInCache`):

```js
function shouldFetchFullThread(data) {
  // Skip if this tab is a background fetch tab (opened by background.js)
  if (bgFetchConversationId) return false;

  const conversationId = data.conversation_id;
  const externalId = data.external_id;
  if (!conversationId) return false;

  // Condition 1: tweet is a reply in a conversation (conversation_id ≠ own id)
  if (conversationId !== externalId) return true;

  // Condition 2: cache already has 2+ tweets with this conversation_id
  let siblingCount = 0;
  for (const [, cached] of tweetCache) {
    if (cached.conversation_id === conversationId) {
      siblingCount++;
      if (siblingCount >= 2) return true;
    }
  }

  // Condition 3: root tweet with self-replies (reply_count > 0, same author)
  if (data.replies > 0) return true;

  return false;
}
```

- [ ] **Step 2: Commit**

```bash
git add extension/content.js
git commit -m "feat(ext): add shouldFetchFullThread detection helper"
```

---

### Task 4: Wire up Save button to use background fetch

Modify the Save button click handler to trigger a background tab fetch when a thread is suspected, wait for the data, then proceed with the existing capture flow.

**Files:**
- Modify: `extension/content.js:1042-1048` (Save button thread detection block)

- [ ] **Step 1: Replace the thread detection block in the Save handler**

Replace the current block (lines 1042-1048):

```js
      let threadItems = [];
      if (data.conversation_id && data.author_handle) {
        threadItems = getThreadSiblingsFromCache(data.conversation_id, data.author_handle);
      }
      if (threadItems.length < 2) {
        threadItems = await getThreadSiblingsFromDOM(tweet, data);
      }
```

With:

```js
      let threadItems = [];
      if (data.conversation_id && data.author_handle) {
        threadItems = getThreadSiblingsFromCache(data.conversation_id, data.author_handle);
      }

      // If thread looks incomplete, try fetching via background tab
      if (threadItems.length < 2 && shouldFetchFullThread(data)) {
        const tweetUrl = data.source_url || `https://x.com/i/web/status/${data.external_id}`;
        log('Fetching full thread via background tab:', tweetUrl);
        try {
          const result = await new Promise((resolve) => {
            chrome.runtime.sendMessage({
              type: 'FETCH_THREAD',
              url: tweetUrl,
              conversationId: data.conversation_id,
            }, (response) => {
              if (chrome.runtime.lastError) {
                log('FETCH_THREAD error:', chrome.runtime.lastError.message);
                resolve({ success: false, tweets: [] });
                return;
              }
              resolve(response || { success: false, tweets: [] });
            });
          });
          log('Background fetch returned', result.tweets?.length || 0, 'tweets, success:', result.success);
          // Merge tweets directly into local cache (don't rely on MERGE_CACHE timing)
          if (result.tweets?.length > 0) {
            for (const t of result.tweets) {
              if (t.external_id && !tweetCache.has(t.external_id)) {
                tweetCache.set(t.external_id, t);
              }
            }
          }
          // Re-check cache with merged data
          if (data.conversation_id && data.author_handle) {
            threadItems = getThreadSiblingsFromCache(data.conversation_id, data.author_handle);
          }
        } catch (err) {
          log('Background fetch failed:', err);
        }
      }

      // Final DOM fallback
      if (threadItems.length < 2) {
        threadItems = await getThreadSiblingsFromDOM(tweet, data);
      }
```

- [ ] **Step 2: Commit**

```bash
git add extension/content.js
git commit -m "feat(ext): wire Save button to fetch full threads via background tab"
```

---

### Task 5: Manual testing

**Files:** None (testing only)

- [ ] **Step 1: Load the updated extension**

1. Open `chrome://extensions`
2. Click "Load unpacked" → select the `extension/` directory (or reload if already loaded)
3. Verify no errors in the extension's service worker console

- [ ] **Step 2: Test single tweet (no thread) — should be unchanged**

1. Navigate to X timeline
2. Find a standalone tweet (no thread)
3. Click Save button
4. Verify: saves normally, no background tab flashes

- [ ] **Step 3: Test thread capture from timeline**

1. Find a thread in the timeline (author posted multiple tweets)
2. Click Save on the root tweet
3. Verify: brief background tab opens and closes, save button shows checkmark with count > 1
4. Check FeedSilo to confirm all self-thread tweets were captured

- [ ] **Step 4: Test thread that's already fully cached**

1. Click into a thread view (full conversation loads)
2. Go back to timeline
3. Click Save on that same thread
4. Verify: no background tab needed, captures from cache immediately

- [ ] **Step 5: Test timeout fallback**

1. Disconnect from internet briefly
2. Click Save on a thread tweet
3. Verify: after ~8 seconds, falls back and captures what's available (partial or single tweet)
4. No hanging UI — button shows result

- [ ] **Step 6: Commit final state**

```bash
git add -A
git commit -m "feat(ext): complete background tab thread fetch implementation"
```
