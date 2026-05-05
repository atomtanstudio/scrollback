# Security Policy

Scrollback is self-hosted software. The project does not operate a hosted
content service and does not receive your archive data.

## Supported Versions

Security fixes are handled on the current `main` branch and the latest tagged
release.

## Reporting a Vulnerability

Please do not open a public issue for a suspected vulnerability until we have
had a chance to investigate.

To report a vulnerability, email the project maintainer or open a private
GitHub security advisory once the public repository is available. Include:

- Affected version or commit.
- A short description of the issue.
- Reproduction steps or proof of concept.
- Any relevant logs, screenshots, or deployment details.

We will acknowledge reports as soon as possible, investigate, and coordinate a
fix before public disclosure when the report is valid.

## Security Model

- Scrollback requires authentication for the app, settings, admin tools, media
  proxy routes, and user-scoped APIs.
- Browser extension capture uses per-user bearer tokens stored locally in the
  browser.
- First-run setup is protected by a setup token.
- RSS, article, media, and image fetches validate server-side URLs and block
  private, local, and reserved network targets.
- Stored article HTML is sanitized before rendering.
- Local databases, environment files, media folders, and generated setup tokens
  should not be committed.

## Operator Responsibilities

If you self-host Scrollback, you are responsible for:

- Keeping your server and dependencies patched.
- Protecting `AUTH_SECRET`, capture tokens, AI provider keys, database
  credentials, R2 credentials, and X API credentials.
- Using HTTPS for internet-facing deployments.
- Restricting database, Redis, object storage, and local media paths to the
  minimum network/file access needed by the app.
- Backing up your own archive data.
