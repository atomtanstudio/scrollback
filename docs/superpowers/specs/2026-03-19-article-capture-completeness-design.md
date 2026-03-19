# Article Capture Completeness

**Date:** 2026-03-19
**Status:** Approved
**Goal:** Fix two article capture issues: truncated body from timeline, and missing embedded videos.

## Problem 1: Truncated Article Body from Timeline

X's timeline API only includes `preview_text` for articles, not the full `content_state` (Draft.js blocks). The full body only loads when navigating to the tweet/article page. Capturing from the timeline gives a short preview instead of the full article.

## Problem 2: Embedded Videos Not Captured

`formatContentStateBlocks()` handles IMAGE, CODE, MARKDOWN, and DIVIDER entity types in atomic blocks but has no handling for VIDEO, EMBED, or similar types. Videos in articles are silently skipped.

## Fix 1: Reuse Background Tab Fetch for Articles

Extend the background tab fetch mechanism (built for thread reliability) to also trigger for articles with truncated body. When `shouldFetchFullThread` (to be renamed `shouldFetchViaBackgroundTab`) detects an article with short body text (< 500 chars or just a t.co URL), it triggers a background tab fetch. X's frontend loads the full article `content_state`, the interceptor catches it, and the data merges back.

No new infrastructure needed — articles piggyback on the existing background tab flow.

### Trigger condition

`source_type === 'article'` AND (`body_text.length < 500` OR body is just a t.co URL)

## Fix 2: Video Entity Handling

Add video entity support to `formatContentStateBlocks()`:

- Match entity types: `VIDEO`, `MOVIE`, `EMBED`, `VIDEO_EMBED`, `IFRAME`
- Extract URL: `eData.url || eData.video_url || eData.src`
- Add URL to `mediaUrls` array (for R2 download via existing pipeline)
- Insert `[Video: url]` inline in body text at the correct position (preserves content ordering)
- Capture thumbnail/poster if available

Also update `artResult.media_entities` extraction to check for video types and extract video URLs (not just images).

## Changes by File

### `extension/content.js`
- Rename `shouldFetchFullThread` → `shouldFetchViaBackgroundTab`
- Add article truncation trigger condition
- Add VIDEO/EMBED entity handling in `formatContentStateBlocks()` atomic block case
- Update `artResult.media_entities` extraction to handle videos

### `extension/background.js`
No changes — existing FETCH_THREAD handler works as-is.

## Key Constraint

Videos go into `media_urls` for R2 download (existing pipeline handles this) AND get `[Video: url]` inline markers in body text for content positioning.
