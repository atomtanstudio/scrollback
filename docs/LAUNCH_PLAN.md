# Scrollback Launch Plan

## Canonical Links

- App: `https://scrollback.atomtan.studio`
- Trailer: `https://scrollback.atomtan.studio/launch/scrollback-launch-trailer.mp4`
- Trailer poster: `https://scrollback.atomtan.studio/launch/scrollback-launch-trailer-poster.jpg`
- GitHub repository: `https://github.com/atomtanstudio/scrollback`

## Asset Checklist

- `public/launch/scrollback-launch-trailer.mp4` is the deployed trailer file.
- `public/launch/scrollback-launch-trailer-poster.jpg` is the sharing/poster image.
- `scrollback-launch-trailer/` contains the full editable HyperFrames production kit.
- `scrollback-launch-trailer/renders/scrollback-launch-trailer-command-center-glasscore-v4.mp4` is the selected final render.

## Pre-Post Checklist

- Run `npm run verify`.
- Deploy the latest `main` branch to the Hetzner VPS.
- Confirm DNS points `scrollback.atomtan.studio` at the VPS.
- Confirm HTTPS is active for `scrollback.atomtan.studio`.
- Open the app, trailer, poster, README, privacy policy, and release checklist from the public domain.

## Posting Order

1. GitHub release with the trailer URL and the self-hosting scope.
2. X post with the trailer, app URL, and one-line positioning.
3. LinkedIn post with the trailer, app URL, and privacy/self-hosting angle.
4. Hacker News or relevant builder community post after the public site is stable.
5. Follow-up thread showing the extension capture flow, RSS ingestion, search, and export API.

## Positioning

Scrollback is a self-hosted archive for X/Twitter saves, RSS, media, prompts, search, AI enrichment, and agent-native retrieval. The launch message should stay concrete: own the archive, search it locally, enrich it when desired, and expose it to tools without giving a hosted service the library.
