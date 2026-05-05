# TODOs

## Launch packaging checklist

**What:** Finish the small public-release artifacts around the Scrollback open-source launch.

**Why:** The codebase is now rebranded, but the launch still needs a clean project URL, screenshots, a short demo clip or launch image, and a final extension listing/privacy-policy pass.

**Context:** The old waitlist-rate-limit TODO is complete; `/api/waitlist` now has an in-memory IP rate limiter. This replacement TODO tracks the remaining release-facing polish.

**Depends on:** README/store listing copy, project URL, and visual assets.

## Pinned topics v2 for end users

**What:** Improve pinned topic management beyond the current sidebar/settings controls.

**Why:** The first pass now exposes pinned topics in the GUI, but it still needs a more polished end-user experience: better education, easier discovery, stronger auto-suggestions from capture behavior, and likely reorder/hide controls.

**Context:** Follow-up from the `Art -> pinned topic` refactor and subsequent suggested-topic work (2026-04-09). The long-term goal is for repeated capture behavior to surface obvious interests like cancer research, ADHD, etc. without making users manually manage taxonomy.

**Depends on:** Existing pinned topics API/UI. Future work should likely include reorder support, “why suggested” explanations, and stronger topic-interest heuristics.

## Thread capture mode options

**What:** Add a thread capture choice in the extension so users can choose between capturing the author’s self-thread only or the full conversation.

**Why:** Some X threads are intentionally split into self-replies for engagement, but other conversations are valuable because of the replies from multiple participants. Users should be able to choose which shape they want to save.

**Context:** Discussed on 2026-04-09 after the pinned-topic work. The likely UX is a lightweight prompt in the extension at capture time with options like `Just the author thread` and `Full conversation`.

**Depends on:** Extension capture flow updates in `extension/content.js` and likely some light server-side handling/testing for full-conversation thread assembly.
