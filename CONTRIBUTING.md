# Contributing to Scrollback

Thanks for taking an interest in Scrollback.

## Development Setup

Use Node 22.x:

```bash
nvm use 22
npm install
npm run doctor
npm run dev
```

Open `http://localhost:3000` and follow onboarding. First-run setup requires a
setup token. Set `SCROLLBACK_SETUP_TOKEN` yourself, or use the generated
`.scrollback-setup-token` file.

## Before Opening a Pull Request

Run:

```bash
npm run doctor
npm run lint
npm run typecheck
npm test
npm run build
```

For dependency changes, also run:

```bash
npm audit --audit-level=moderate
```

## Project Scope

Scrollback currently focuses on:

- X/Twitter capture through the browser extension.
- RSS/Atom ingestion through the web app.
- Search, reading, media storage, and optional AI enrichment for the saved
  archive.

Universal web clipping, mobile apps, and hosted cloud sync are intentionally out
of scope for the current open-source release.

## Code Guidelines

- Keep changes focused and consistent with existing patterns.
- Add tests for security-sensitive behavior, parsing, ingestion, and data
  ownership logic.
- Do not commit `.env`, `.env.local`, `scrollback.config.json`,
  `.scrollback-setup-token`, local database files, media files, screenshots, or
  generated build artifacts.
- Treat capture tokens, API keys, database URLs, and OAuth credentials as
  secrets.

## Security Issues

Please follow `SECURITY.md` for vulnerability reports.
