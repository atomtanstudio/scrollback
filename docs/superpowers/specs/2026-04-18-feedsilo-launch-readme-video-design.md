# FeedSilo Launch README And Demo Video Design

Date: 2026-04-18

## Goal

Prepare FeedSilo for an open-source launch with two launch-critical assets:

- A top-notch README that makes the project feel trustworthy, understandable, and runnable.
- A founder-led demo video package that can be used on GitHub and in launch/social posts.

The work should make FeedSilo easier to evaluate quickly while preserving the depth technical users need before installing or contributing.

## Positioning

FeedSilo should launch as:

> An open-source, self-hosted signal archive for saving the useful internet into a private, searchable library.

The emotional hook is:

> Keep the signal. Leave the chaos.

The first adopter is an AI builder, technical founder, researcher, or power user who gets real value from fast-moving online sources but does not want knowledge trapped in noisy feeds, broken search, fragile bookmarks, or someone else's database.

FeedSilo should not launch as a clone or direct comparison to existing read-it-later tools. The story should stand on its own: this is a real workflow tool born from the need to preserve and rediscover high-signal material.

## Audience

Primary launch audience:

- AI builders and technical founders who use feeds, RSS, articles, and saved posts as research radar.
- Open-source and self-hosting users who value ownership, export, and local control.
- Developers who may contribute capture sources, integrations, deployment paths, or search workflows.

Secondary audience:

- Researchers, creators, and knowledge workers who save a lot of useful online material and need a durable archive.

Launch channels should prioritize GitHub plus X/Twitter first. Hacker News, Reddit, and other technical communities can be a second wave after the README, demo account, and video are strong.

## README Design

The README should replace the current concise project summary with a launch-grade document.

### Structure

1. Opening
   - FeedSilo name, concise tagline, and one-paragraph promise.
   - Short feature bullets: capture, archive, search, enrich, self-host, export.
   - Optional badges after content is stable.

2. Why FeedSilo Exists
   - Explain that useful online knowledge is scattered across feeds, posts, articles, RSS, and saved items.
   - Position FeedSilo as a durable home for material the user controls.
   - Keep the tone practical and product-focused.

3. What It Captures
   - Tweets/posts, threads, articles, RSS entries, AI image/video prompt posts, and media.
   - Clarify that X/Twitter capture is currently the most developed source through the browser extension.

4. Core Features
   - Browser extension capture.
   - Bulk capture.
   - Thread and article enrichment.
   - Rich media storage through local storage or Cloudflare R2.
   - Hybrid search with keyword and semantic modes.
   - AI summaries, tags, categories, translations, and prompt detection with Gemini.
   - Pinned topics and suggested filters.
   - RSS ingestion.
   - Export and read-only remote query API.
   - Admin, demo, and multi-user basics where relevant.

5. Quick Start
   - Recommended local path: `npm install`, `npm run dev`, then use the onboarding wizard.
   - Mention Node 22.
   - Explain SQLite, Supabase, and PostgreSQL options in human terms.

6. Browser Extension Setup
   - Load the unpacked extension locally.
   - Pair the extension with server URL and token.
   - Explain the capture button, bulk capture, and optional X API mode.

7. Configuration
   - Group environment variables by database, auth, AI, storage, X API, and search tuning.
   - Make required versus optional settings clearer than the current README.

8. Deployment
   - Explain self-hosting on a VPS or common app hosts.
   - Recommend PostgreSQL with pgvector for production.
   - Cover admin creation and startup behavior.

9. API And Export
   - Keep the README brief and link to `REMOTE_QUERY_API.md` for the complete reference.
   - Include one useful curl example.

10. Roadmap
   - Keep it short and optimistic.
   - Mention broader capture sources, smarter personal signal discovery, improved topic workflows, more integrations, and a hosted/cloud option.

11. Contributing And Development
   - Include scripts, tests, branch guidance, and good first areas.
   - Keep contribution guidance approachable for first-time project visitors.

12. Privacy And License
   - Emphasize self-hosting, no telemetry, user-controlled API keys, and user-controlled data.
   - Preserve MIT license.

## Video And Social Kit Design

The main video should be a 60-90 second founder-voice screen demo. It should work for GitHub README embedding, X/Twitter launch posts, and short product introductions.

### Style

- Real founder voice.
- Calm, credible, and specific.
- Real UI screen recording rather than AI-generated fake UI.
- Auto-zoomed interactions with Screen Studio or equivalent.
- Light title cards only where they help.
- Captions always included.
- Minimal music, if any, under narration.

### Primary Video Structure

1. 0-8s: Hook
   - Show the problem: useful online signal scattered across noisy feeds and weak search.
   - Voice direction: "The internet is full of useful signal, but too much of it is trapped inside feeds I don't want to live in."

2. 8-18s: Product Reveal
   - Show FeedSilo home with strong demo account data.
   - State that FeedSilo is an open-source, self-hosted signal archive.

3. 18-35s: Capture
   - Show the extension, capture button, and bulk capture concept.
   - Mention posts, threads, articles, RSS, and prompt/media captures.

4. 35-55s: Rediscover
   - Search for a memorable AI-builder topic.
   - Show results, filters, pinned topics, and a detail page with useful context.

5. 55-70s: Ownership
   - Show settings, export/API, and storage controls briefly.
   - Explain that data lives in the user's database with optional local or R2 media storage.

6. 70-90s: Open Source CTA
   - Show the GitHub repo/README.
   - End with an open-source call to run it, fork it, and help shape it.

### Deliverables

- Main 60-90 second voiceover script.
- Shot list with exact pages and actions to record.
- Screen Studio recording checklist.
- Caption/subtitle text.
- 3-5 short social post variants.
- A pinned launch thread/post outline.
- Optional AI image/video model prompts for transition/title-card visuals.
- Demo data curation plan for the existing demo account.

## Demo Account And Data

Use the existing demo account as the recording target once it has strong representative data.

The demo persona is an AI builder or technical founder building a durable personal signal archive. The visible library should feel curated rather than randomly bulk-loaded.

Recommended content lanes:

- AI engineering and agents.
- Open-source tooling.
- Product and design references.
- AI art and prompt examples.
- Research explainers.
- RSS posts from high-signal technical blogs.

Bulk capture can be used to add volume, but the visible first screen, searches, detail pages, and pinned topics should be intentionally curated. Avoid private, messy, or personally sensitive saves in the public demo.

## Browser Capture Workflow

The video process should use two passes.

### Pass 1: Browser Mock Capture

Codex should use browser automation and screenshot tooling to create a rough visual package:

- Open the demo account or local app in a browser.
- Capture stills of core screens: home feed, search, pinned topics, detail page, settings, extension setup, and GitHub README.
- Identify which screens already look strong.
- Identify demo-data gaps, such as weak search results, missing AI art cards, weak RSS examples, or uninteresting detail pages.
- Produce a shot-by-shot mock storyboard using real captures.

This pass gives the launch video a concrete visual target before more data is curated.

### Pass 2: Final Screen Recording

After the demo account is enriched:

- Record the final screen video with Screen Studio or equivalent.
- Use the approved script and shot list.
- Use the user's real voice for narration.
- Use real product screens for product UI.
- Export a main 16:9 version for GitHub/YouTube and cut social versions from the same source material.

## Scope Boundaries

This launch pass should not promise unavailable features as launch functionality. Future personal signal discovery, broader source support, and Readwise-like reading workflows belong in a concise roadmap, not in the main product claim.

The README should be detailed enough for self-hosters and contributors, while the video should stay emotionally clear and brief.

## Success Criteria

- A new visitor can understand what FeedSilo is in under 30 seconds.
- A technical visitor can determine how to run it locally in a few minutes.
- A self-hosting visitor can see the database, auth, storage, and AI requirements clearly.
- The demo video makes FeedSilo feel useful without requiring the viewer to read docs first.
- The video and README tell the same story: save the signal, search it later, own the library.
