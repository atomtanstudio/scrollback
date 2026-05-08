# Scrollback Release Checklist

Use this before tagging or publishing the open-source release.

## Code Readiness

- [ ] Merge the release branch into `dev`.
- [ ] Run `npm run verify`.
- [ ] Run `npm audit --audit-level=moderate`.
- [ ] Smoke-test a fresh first-run SQLite setup with `SCROLLBACK_SETUP_TOKEN`; follow the README's "SQLite Onboarding Smoke Test" and confirm login works.
- [ ] Capture one X/Twitter post with media through the extension.
- [ ] Add and sync one RSS feed.
- [ ] Export or query a saved item through the remote query API.

## Repository Readiness

- [ ] Rename or create the public GitHub repository for Scrollback.
- [ ] Confirm the local `origin` remote points to the public Scrollback repository.
- [ ] Confirm README links point to the public repository.
- [ ] Confirm `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`, and `CHANGELOG.md` are present.
- [ ] Confirm no tracked local artifacts, launch scratch files, or old project-name assets remain.
- [ ] Confirm the release branch is merged into `main`.
- [ ] Create a GitHub release/tag.

## Extension Readiness

- [ ] Reload the unpacked extension from `extension/` and test capture.
- [ ] Zip the extension folder for upload.
- [ ] Add Chrome Web Store screenshots.
- [ ] Add the public project URL in the store listing.
- [ ] Add the public privacy policy URL in the store listing.
- [ ] Review Chrome Web Store privacy practice answers.

## Launch Assets

- [ ] Confirm `public/launch/scrollback-launch-trailer.mp4` opens locally after `npm run dev`.
- [ ] Confirm `public/launch/scrollback-launch-trailer-poster.jpg` opens locally after `npm run dev`.
- [ ] Confirm the deployed trailer URL opens at `https://scrollback.atomtan.studio/launch/scrollback-launch-trailer.mp4`.
- [ ] Confirm the source trailer kit in `scrollback-launch-trailer/` is committed.
- [ ] Write the launch post with the project URL, scope, and known limitations.
