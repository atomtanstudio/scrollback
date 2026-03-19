# Thread Fetch Reliability — Background Tab Approach

**Date:** 2026-03-19
**Status:** Approved
**Goal:** Reliably capture complete self-threads from the timeline without requiring the user to navigate to the individual tweet first, and without using the X API.

## Problem

When clicking Save on a tweet that's part of a thread in the timeline/feed, the extension only captures tweets that happen to be in the `tweetCache` (from intercepted API responses) or visible in the DOM. X's timeline API responses include inconsistent amounts of conversation context, so thread capture is unreliable — sometimes complete, sometimes partial.

## Approach: Background Tab Navigation

When a thread is detected, open the tweet's URL in a hidden background tab. X's frontend loads the full `TweetDetail` conversation. The existing `interceptor.js` (already injected on all X pages) catches the GraphQL response. The new tab's content script packages up the conversation data and relays it back to the original tab via `background.js` message passing.

This avoids X API costs entirely — it leverages X's own frontend to load conversation data, the same way a user would by clicking into a tweet.

## Trigger Conditions

A background fetch is triggered when Save is clicked and ANY of:

1. `conversation_id !== external_id` (tweet is a reply)
2. Cache already has 2+ tweets with the same `conversation_id`
3. Tweet is the root but has `reply_count > 0` and the author matches

**Self-thread filtering is unchanged:** The existing `isLikelySelfThreadEntry()` / `getCandidateSelfThreadItems()` logic filters the full conversation down to only the author's self-replies. Other participants' replies are discarded.

## Architecture

```
Original tab (Save click)
    → background.js: FETCH_THREAD { url }
        → chrome.tabs.create({ url, active: false })
        → New tab loads X's frontend
        → interceptor.js catches TweetDetail GraphQL response
        → content.js in new tab caches all conversation tweets
        → content.js → background.js: THREAD_DATA_READY { tweets[] }
        → background.js closes new tab
    → background.js → original tab: MERGE_CACHE { tweets[] }
    → Original tab merges into tweetCache
    → Re-runs getThreadSiblingsFromCache() (self-reply filter)
    → Captures complete self-thread via CAPTURE_BULK
```

## Changes by File

### `background.js`
- New `FETCH_THREAD` message handler:
  - Creates background tab (`active: false`) with tweet URL
  - Tracks pending fetches by originating tab ID
  - Listens for `THREAD_DATA_READY` from new tab
  - Forwards data as `MERGE_CACHE` to originating tab
  - Closes background tab
  - 8-second timeout → sends empty response for graceful fallback

### `content.js`
- **Save button handler** (currently lines 1042-1048):
  - After initial cache check, if thread suspected, send `FETCH_THREAD` to background.js
  - Wait for `MERGE_CACHE`, merge into local `tweetCache`
  - Re-run `getThreadSiblingsFromCache()` with existing self-reply filtering
  - Proceed with capture

- **New `MERGE_CACHE` listener:**
  - Receives tweet data array, inserts each into local `tweetCache`

- **Background tab detection:**
  - Detect when running as a background fetch (message from background.js)
  - Once `TweetDetail` response intercepted and cached, package tweets with matching `conversation_id`
  - Send `THREAD_DATA_READY` to background.js

### `interceptor.js`
No changes.

### `manifest.json`
No changes.

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Thread already fully cached | Skip background tab, capture immediately |
| Multiple rapid Save clicks on different threads | Each gets independent background tab, tracked by tab ID |
| X rate-limits or blocks background tab | 8-second timeout, fall back to partial capture |
| Tweet is not part of a thread | No background tab, current single-tweet flow unchanged |
| Background tab fails to load | Timeout catches it, falls back gracefully |

## Key Constraint

Only the **original author's self-replies** are captured. The background tab fetches the full conversation (all participants), but the existing filtering pipeline discards other people's replies. This preserves the intent of capturing threads where the author adds extra content/context to their initial tweet.
