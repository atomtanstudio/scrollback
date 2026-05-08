# Scrollback Launch Plan

## Launch Goal

Launch Scrollback at **9:00 AM Pacific on Tuesday, May 12, 2026**.

Definition of launched:

- The PR is merged and deployed.
- `https://scrollback.atomtan.studio` loads over HTTPS.
- The trailer URL opens publicly.
- The GitHub repository/release is public and accurate.
- The Product Hunt launch is live.
- Announcement posts go out within the same launch window.
- The first hour is monitored for broken links, setup issues, replies, and questions.

## Canonical Links

- App: `https://scrollback.atomtan.studio`
- Trailer: `https://scrollback.atomtan.studio/launch/scrollback-launch-trailer.mp4`
- Trailer poster: `https://scrollback.atomtan.studio/launch/scrollback-launch-trailer-poster.jpg`
- GitHub repository: `https://github.com/atomtanstudio/scrollback`
- Product Hunt: scheduled for Tuesday, May 12, 2026

## Asset Checklist

- `public/launch/scrollback-launch-trailer.mp4` is the deployed trailer file.
- `public/launch/scrollback-launch-trailer-poster.jpg` is the sharing/poster image.
- `scrollback-launch-trailer/` contains the full editable HyperFrames production kit.
- `scrollback-launch-trailer/renders/scrollback-launch-trailer-command-center-glasscore-v4.mp4` is the selected final render.
- `assets/product-hunt/gallery/*.png` contains the Product Hunt-ready gallery images.
- `assets/product-hunt/scrollback-product-hunt-thumbnail.png` contains the Product Hunt thumbnail upload.
- `assets/product-hunt/scrollback-product-hunt-thumbnail.svg` contains the Product Hunt thumbnail source.

## Pre-Post Checklist

- Run `npm run verify`.
- Run `npm audit --audit-level=moderate`.
- Deploy the latest `main` branch to the Hetzner VPS.
- Confirm DNS points `scrollback.atomtan.studio` at the VPS.
- Confirm HTTPS is active for `scrollback.atomtan.studio`.
- Open the app, trailer, poster, README, privacy policy, and release checklist from the public domain.
- Smoke-test first-run SQLite onboarding from the README.
- Capture one X/Twitter post with the browser extension.
- Confirm README language recommends X API mode for bulk Likes and Bookmarks.

## Simultaneous Posting Window

Target all public posts for **9:00-9:15 AM Pacific**. Prepare all drafts before 8:45 AM so launch is copy/paste and link-checking, not writing.

Launch channels:

- GitHub release: trailer URL, self-hosting scope, setup notes, known limitations.
- X/Twitter: trailer-first post with app URL and GitHub URL.
- Hacker News: concise "Show HN" post after the public URL and repository are verified.
- Reddit: targeted communities only, with a useful self-hosting/open-source framing rather than drive-by promotion.
- Relevant Discord/Slack communities, if any are already active: short post, trailer, GitHub, and what feedback would be useful.

Recommended posting order inside the 15-minute window:

1. Publish GitHub release.
2. Post X/Twitter with trailer.
3. Publish Product Hunt.
4. Submit Hacker News.
5. Post Reddit/community links.
6. Reply to early questions and pin/favorite the best launch post as the canonical thread.

## Launch Drafts Needed

- X/Twitter: short trailer post plus a 4-6 post follow-up thread.
- Hacker News: title and first comment with technical details and limitations.
- Reddit: one version for self-hosted/open-source audiences and one for AI/builder audiences.
- GitHub release notes: what it is, how to run it, known limitations, and safety note for X API bulk capture.

Drafts live in [`docs/launch-copy/`](launch-copy/).

## Positioning

Scrollback is a self-hosted archive for X/Twitter saves, RSS, media, prompts, search, AI enrichment, and agent-native retrieval. The launch message should stay concrete: own the archive, search it locally, enrich it when desired, and expose it to tools without giving a hosted service the library.

Account-safety wording for extension posts: one-click capture works without the X API, but the official X API bearer token or OAuth path is recommended for bulk importing Likes and Bookmarks.
