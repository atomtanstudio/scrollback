# FeedSilo Promo Intro Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fresh Remotion promo intro video for FeedSilo with founder-calm voiceover timing, from-scratch visuals, and a self-hosted/open-source CTA.

**Architecture:** Create a new standalone `promo-video/` Remotion project and leave `demo-video/` untouched. Keep the promo script, timing, and scene metadata in JSON so copy revisions do not require hunting through animation code. Render the visual intro from React/CSS scenes that communicate FeedSilo's capture, search, and ownership workflow without copying existing Remotion files.

**Tech Stack:** Remotion 4, React 18, TypeScript, `@remotion/media`, Node.js scripts for content checks.

---

## File Structure

- Create: `promo-video/package.json` - standalone Remotion project scripts and dependencies.
- Create: `promo-video/tsconfig.json` - TypeScript config with JSON imports enabled.
- Create: `promo-video/remotion.config.ts` - Remotion render defaults.
- Create: `promo-video/README.md` - local usage, script, voiceover asset workflow, and render commands.
- Create: `promo-video/src/index.tsx` - Remotion root registration entrypoint.
- Create: `promo-video/src/Root.tsx` - composition registration for `FeedSiloPromoIntro`.
- Create: `promo-video/src/promoContent.json` - script lines, scene timing, captions, and CTA copy.
- Create: `promo-video/src/promoContent.ts` - typed accessors for the JSON content.
- Create: `promo-video/src/FeedSiloPromoIntro.tsx` - from-scratch video composition and animated scenes.
- Create: `promo-video/scripts/check-content.mjs` - content contract check for duration, copy, and banned terminology.
- Create: `promo-video/public/audio/.gitkeep` - keeps the audio directory in git before generated voiceover is added.
- Create after voice generation: `promo-video/public/audio/feedsilo-promo-voiceover.mp3` - generated cloned-voice narration.

Do not create, copy from, or modify files under `demo-video/`.

## Remotion Skill Notes

- Register the renderable video in `src/Root.tsx` with explicit `durationInFrames`, `fps`, `width`, and `height`.
- Reference generated voiceover through `staticFile()` and `<Audio />` from `@remotion/media`.
- Use `<Sequence premountFor={PROMO_FPS}>` for every timed scene so assets and React subtrees are ready before playback.
- Drive motion with `interpolate()` and `Easing.bezier(...)` over explicit frame ranges.
- Keep assets under `promo-video/public/`; the first version uses React/CSS visuals and only requires an audio asset for the final voiceover render.

---

### Task 1: Scaffold Fresh Remotion Project

**Files:**
- Create: `promo-video/package.json`
- Create: `promo-video/tsconfig.json`
- Create: `promo-video/remotion.config.ts`
- Create: `promo-video/src/index.tsx`
- Create: `promo-video/src/Root.tsx`
- Create: `promo-video/src/FeedSiloPromoIntro.tsx`
- Create: `promo-video/public/audio/.gitkeep`

- [ ] **Step 1: Create the project package**

Create `promo-video/package.json`:

```json
{
  "name": "feedsilo-promo-video",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "studio": "remotion studio src/index.tsx",
    "render": "remotion render src/index.tsx FeedSiloPromoIntro out/feedsilo-promo-intro.mp4",
    "render:voiceover": "remotion render src/index.tsx FeedSiloPromoIntro out/feedsilo-promo-intro-voiceover.mp4 --props '{\"voiceoverSrc\":\"audio/feedsilo-promo-voiceover.mp3\"}'",
    "still": "remotion still src/index.tsx FeedSiloPromoIntro out/preview.png --frame=300 --scale=0.5",
    "typecheck": "tsc --noEmit",
    "check:content": "node scripts/check-content.mjs",
    "verify": "npm run check:content && npm run typecheck && npm run still"
  },
  "dependencies": {
    "@remotion/media": "4.0.451",
    "remotion": "4.0.451",
    "react": "18.3.1",
    "react-dom": "18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.27",
    "@types/react-dom": "^18.3.7",
    "typescript": "^5.9.3"
  }
}
```

- [ ] **Step 2: Add TypeScript config**

Create `promo-video/tsconfig.json`:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["DOM", "ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "noEmit": true,
    "resolveJsonModule": true,
    "strict": true,
    "target": "ES2022",
    "types": ["remotion"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Add Remotion config**

Create `promo-video/remotion.config.ts`:

```ts
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setCodec("h264");
```

- [ ] **Step 4: Add the Remotion entrypoint**

Create `promo-video/src/index.tsx`:

```tsx
import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
```

- [ ] **Step 5: Add a minimal composition registration**

Create `promo-video/src/Root.tsx`:

```tsx
import { Composition } from "remotion";
import {
  FeedSiloPromoIntro,
  PROMO_DURATION_FRAMES,
  PROMO_FPS,
  PROMO_HEIGHT,
  PROMO_WIDTH,
} from "./FeedSiloPromoIntro";

export const RemotionRoot = () => {
  return (
    <Composition
      id="FeedSiloPromoIntro"
      component={FeedSiloPromoIntro}
      durationInFrames={PROMO_DURATION_FRAMES}
      fps={PROMO_FPS}
      width={PROMO_WIDTH}
      height={PROMO_HEIGHT}
      defaultProps={{ voiceoverSrc: null }}
    />
  );
};
```

- [ ] **Step 6: Add a temporary black-screen composition**

Create `promo-video/src/FeedSiloPromoIntro.tsx`:

```tsx
import { AbsoluteFill } from "remotion";

export const PROMO_FPS = 30;
export const PROMO_WIDTH = 1920;
export const PROMO_HEIGHT = 1080;
export const PROMO_DURATION_FRAMES = 1500;

export type FeedSiloPromoIntroProps = {
  voiceoverSrc?: string | null;
};

export const FeedSiloPromoIntro = (_props: FeedSiloPromoIntroProps) => {
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        background: "#080b0f",
        color: "#f8efe2",
        display: "flex",
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        justifyContent: "center",
      }}
    >
      FeedSilo Promo Intro
    </AbsoluteFill>
  );
};
```

- [ ] **Step 7: Keep the audio folder in git**

Create `promo-video/public/audio/.gitkeep` as an empty file.

- [ ] **Step 8: Install dependencies**

Run:

```bash
cd promo-video && npm install
```

Expected: `node_modules/` and `package-lock.json` are created under `promo-video/`.

- [ ] **Step 9: Verify the scaffold typechecks**

Run:

```bash
cd promo-video && npm run typecheck
```

Expected: TypeScript exits successfully with no errors.

- [ ] **Step 10: Commit the scaffold**

Run:

```bash
git add promo-video/package.json promo-video/package-lock.json promo-video/tsconfig.json promo-video/remotion.config.ts promo-video/src/index.tsx promo-video/src/Root.tsx promo-video/src/FeedSiloPromoIntro.tsx promo-video/public/audio/.gitkeep
git commit -m "feat: scaffold feedsilo promo video"
```

---

### Task 2: Add Script And Timing Data With Content Check

**Files:**
- Create: `promo-video/scripts/check-content.mjs`
- Create: `promo-video/src/promoContent.json`
- Create: `promo-video/src/promoContent.ts`
- Modify: `promo-video/package.json`

- [ ] **Step 1: Write the failing content check**

Create `promo-video/scripts/check-content.mjs`:

```js
import fs from "node:fs";
import path from "node:path";

const contentPath = path.join(process.cwd(), "src", "promoContent.json");
const raw = fs.readFileSync(contentPath, "utf8");
const content = JSON.parse(raw);

const failures = [];
const allCopy = [
  content.positioning,
  content.cta,
  ...content.voiceover,
  ...content.scenes.flatMap((scene) => [
    scene.eyebrow,
    scene.title,
    scene.caption,
    ...scene.labels,
  ]),
].join(" ");

const bannedTerm = ["sig", "nal"].join("");
const bannedTermPattern = new RegExp(`\\b${bannedTerm}\\b`, "i");

if (bannedTermPattern.test(allCopy)) {
  failures.push("Copy must avoid the banned launch-language term.");
}

if (content.fps !== 30) {
  failures.push(`Expected fps to be 30, received ${content.fps}.`);
}

const totalFrames = content.scenes.reduce(
  (sum, scene) => sum + scene.durationFrames,
  0,
);

if (totalFrames !== 1500) {
  failures.push(`Expected total duration to be 1500 frames, received ${totalFrames}.`);
}

if (content.voiceover.length !== 7) {
  failures.push(`Expected 7 voiceover lines, received ${content.voiceover.length}.`);
}

if (!content.cta.includes("Run it yourself")) {
  failures.push("CTA must include 'Run it yourself'.");
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Content check passed: 50s, founder-calm copy, no banned terms.");
```

- [ ] **Step 2: Run the check and verify it fails**

Run:

```bash
cd promo-video && npm run check:content
```

Expected: FAIL because `src/promoContent.json` does not exist yet.

- [ ] **Step 3: Add the promo content JSON**

Create `promo-video/src/promoContent.json`:

```json
{
  "fps": 30,
  "width": 1920,
  "height": 1080,
  "positioning": "An open-source, self-hosted archive for the parts of the internet worth keeping.",
  "cta": "Run it yourself, own your archive, and help shape where it goes next.",
  "voiceover": [
    "I built FeedSilo because I was tired of losing the good parts of the internet inside noisy feeds.",
    "Twitter especially can be exhausting: great ideas, useful threads, research, prompts, and articles, all mixed in with arguments, negativity, and the pressure to keep scrolling.",
    "FeedSilo is my way of saving the useful parts before they disappear back into the scroll.",
    "It lets you capture posts, threads, articles, RSS items, prompts, and media into a private library you control.",
    "Then you can search it by keyword or meaning, open the original context, filter by source or topic, and actually find the thing you saved.",
    "Today, FeedSilo is open source and self-hosted.",
    "Run it yourself, own your archive, and help shape where it goes next."
  ],
  "scenes": [
    {
      "id": "origin",
      "kind": "noise",
      "durationFrames": 210,
      "accent": "#d8b56d",
      "eyebrow": "Built from a real workflow",
      "title": "Too much good stuff disappears into the scroll.",
      "caption": "FeedSilo starts with a simple need: save useful ideas before they vanish.",
      "labels": ["Useful threads", "Research", "Prompts", "Articles"]
    },
    {
      "id": "scroll",
      "kind": "calm",
      "durationFrames": 240,
      "accent": "#6fc7b8",
      "eyebrow": "Less feed exhaustion",
      "title": "Keep what helps. Leave the rest behind.",
      "caption": "Great material should not require living inside a noisy timeline.",
      "labels": ["Arguments", "Negativity", "Pressure to scroll", "Lost bookmarks"]
    },
    {
      "id": "capture",
      "kind": "capture",
      "durationFrames": 300,
      "accent": "#8fb3ff",
      "eyebrow": "Capture once",
      "title": "Save posts, threads, articles, RSS, prompts, and media.",
      "caption": "Everything lands in one private library you control.",
      "labels": ["Posts", "Threads", "Articles", "RSS", "Prompts", "Media"]
    },
    {
      "id": "search",
      "kind": "search",
      "durationFrames": 450,
      "accent": "#b992ff",
      "eyebrow": "Find it later",
      "title": "Search by keyword or meaning.",
      "caption": "Bring back the original context, source, topic, and saved details.",
      "labels": ["Semantic search", "Keyword search", "Filters", "Original context"]
    },
    {
      "id": "ownership",
      "kind": "ownership",
      "durationFrames": 300,
      "accent": "#e78f78",
      "eyebrow": "Open source and self-hosted",
      "title": "Your archive should belong to you.",
      "caption": "Run it yourself, own the data, and help shape what comes next.",
      "labels": ["Self-hosted", "Exportable", "Open source", "Your database"]
    }
  ]
}
```

- [ ] **Step 4: Add typed content exports**

Create `promo-video/src/promoContent.ts`:

```ts
import rawContent from "./promoContent.json";

export type PromoSceneKind = "noise" | "calm" | "capture" | "search" | "ownership";

export type PromoScene = {
  id: string;
  kind: PromoSceneKind;
  durationFrames: number;
  accent: string;
  eyebrow: string;
  title: string;
  caption: string;
  labels: string[];
};

export type PromoContent = {
  fps: number;
  width: number;
  height: number;
  positioning: string;
  cta: string;
  voiceover: string[];
  scenes: PromoScene[];
};

export const promoContent = rawContent as PromoContent;

export const sceneStarts = promoContent.scenes.reduce<number[]>(
  (starts, scene, index) => {
    starts[index] =
      index === 0 ? 0 : starts[index - 1] + promoContent.scenes[index - 1].durationFrames;
    return starts;
  },
  [],
);

export const totalDurationFrames = promoContent.scenes.reduce(
  (sum, scene) => sum + scene.durationFrames,
  0,
);
```

- [ ] **Step 5: Run the content check and typecheck**

Run:

```bash
cd promo-video && npm run check:content && npm run typecheck
```

Expected: content check prints `Content check passed: 50s, founder-calm copy, no banned terms.` and TypeScript exits successfully.

- [ ] **Step 6: Commit the content contract**

Run:

```bash
git add promo-video/package.json promo-video/scripts/check-content.mjs promo-video/src/promoContent.json promo-video/src/promoContent.ts
git commit -m "feat: add feedsilo promo script content"
```

---

### Task 3: Build The From-Scratch Promo Composition

**Files:**
- Replace: `promo-video/src/FeedSiloPromoIntro.tsx`
- Modify: `promo-video/src/Root.tsx`

- [ ] **Step 1: Replace the temporary composition with the full animated video**

Replace `promo-video/src/FeedSiloPromoIntro.tsx` with:

```tsx
import { Audio } from "@remotion/media";
import type { CSSProperties } from "react";
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { promoContent, sceneStarts, totalDurationFrames, type PromoScene } from "./promoContent";

export const PROMO_FPS = promoContent.fps;
export const PROMO_WIDTH = promoContent.width;
export const PROMO_HEIGHT = promoContent.height;
export const PROMO_DURATION_FRAMES = totalDurationFrames;

export type FeedSiloPromoIntroProps = {
  voiceoverSrc?: string | null;
};

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

const ease = Easing.bezier(0.16, 1, 0.3, 1);

export const FeedSiloPromoIntro = ({
  voiceoverSrc = null,
}: FeedSiloPromoIntroProps) => {
  const frame = useCurrentFrame();
  const activeScene =
    promoContent.scenes.find((scene, index) => {
      const start = sceneStarts[index];
      return frame >= start && frame < start + scene.durationFrames;
    }) ?? promoContent.scenes[promoContent.scenes.length - 1];

  return (
    <AbsoluteFill style={styles.stage}>
      {voiceoverSrc ? (
        <Audio
          src={staticFile(voiceoverSrc)}
          volume={(audioFrame) =>
            interpolate(audioFrame, [0, 18, PROMO_DURATION_FRAMES - 24, PROMO_DURATION_FRAMES], [0, 1, 1, 0], clamp)
          }
        />
      ) : null}
      <Backdrop frame={frame} accent={activeScene.accent} />
      <Header frame={frame} accent={activeScene.accent} />
      {promoContent.scenes.map((scene, index) => (
        <Sequence
          key={scene.id}
          from={sceneStarts[index]}
          durationInFrames={scene.durationFrames}
          premountFor={PROMO_FPS}
        >
          <Scene scene={scene} />
        </Sequence>
      ))}
      <CaptionBar frame={frame} />
      <Progress frame={frame} accent={activeScene.accent} />
    </AbsoluteFill>
  );
};

const Header = ({ frame, accent }: { frame: number; accent: string }) => {
  const opacity = interpolate(frame, [0, 36], [0, 1], {
    ...clamp,
    easing: ease,
  });

  return (
    <div style={{ ...styles.header, opacity }}>
      <div style={styles.wordmark}>
        Feed<span style={{ color: accent }}>Silo</span>
      </div>
      <div style={styles.headerMeta}>Open source / Self-hosted / Searchable archive</div>
    </div>
  );
};

const Scene = ({ scene }: { scene: PromoScene }) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, 34], [0, 1], {
    ...clamp,
    easing: ease,
  });
  const exit = interpolate(frame, [scene.durationFrames - 26, scene.durationFrames], [0, 1], {
    ...clamp,
    easing: Easing.in(Easing.cubic),
  });
  const visible = enter * (1 - exit);
  const copyY = interpolate(enter, [0, 1], [34, 0]);
  const visualY = interpolate(enter, [0, 1], [48, 0]);

  return (
    <AbsoluteFill style={{ opacity: visible }}>
      <section style={{ ...styles.copy, transform: `translateY(${copyY}px)` }}>
        <div style={{ ...styles.eyebrow, color: scene.accent }}>{scene.eyebrow}</div>
        <h1 style={styles.title}>{scene.title}</h1>
        <p style={styles.caption}>{scene.caption}</p>
      </section>
      <section
        style={{
          ...styles.visualShell,
          borderColor: withAlpha(scene.accent, 0.42),
          boxShadow: `0 30px 90px ${withAlpha(scene.accent, 0.16)}, 0 40px 120px rgba(0,0,0,0.36)`,
          transform: `translateY(${visualY}px)`,
        }}
      >
        <Visual scene={scene} frame={frame} />
      </section>
    </AbsoluteFill>
  );
};

const Visual = ({ scene, frame }: { scene: PromoScene; frame: number }) => {
  if (scene.kind === "noise") {
    return <NoiseVisual scene={scene} frame={frame} />;
  }
  if (scene.kind === "calm") {
    return <CalmVisual scene={scene} frame={frame} />;
  }
  if (scene.kind === "capture") {
    return <CaptureVisual scene={scene} frame={frame} />;
  }
  if (scene.kind === "search") {
    return <SearchVisual scene={scene} frame={frame} />;
  }
  return <OwnershipVisual scene={scene} frame={frame} />;
};

const NoiseVisual = ({ scene, frame }: { scene: PromoScene; frame: number }) => {
  const chips = ["hot take", "argument", "useful thread", "research link", "doom scroll", "saved idea", "prompt", "article"];

  return (
    <div style={styles.noiseVisual}>
      {chips.map((chip, index) => {
        const x = 70 + (index % 4) * 210;
        const y = 96 + Math.floor(index / 4) * 190;
        const float = Math.sin((frame + index * 12) / 24) * 14;
        const useful = scene.labels.some((label) => chip.includes(label.toLowerCase().split(" ")[0]));
        return (
          <div
            key={chip}
            style={{
              ...styles.noiseChip,
              borderColor: useful ? withAlpha(scene.accent, 0.8) : "rgba(255,255,255,0.12)",
              color: useful ? "#fff8eb" : "rgba(255,255,255,0.46)",
              left: x,
              top: y + float,
            }}
          >
            {chip}
          </div>
        );
      })}
      <div style={{ ...styles.centerBadge, borderColor: withAlpha(scene.accent, 0.5) }}>
        Save what matters
      </div>
    </div>
  );
};

const CalmVisual = ({ scene, frame }: { scene: PromoScene; frame: number }) => {
  const slide = interpolate(frame, [0, scene.durationFrames], [0, -76], clamp);
  return (
    <div style={styles.calmVisual}>
      <div style={{ ...styles.timeline, transform: `translateY(${slide}px)` }}>
        {scene.labels.concat(["Useful thread", "Research note", "Saved article"]).map((label) => (
          <div key={label} style={styles.timelineRow}>
            <span style={styles.timelineDot} />
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div style={{ ...styles.libraryPanel, borderColor: withAlpha(scene.accent, 0.44) }}>
        <div style={styles.panelKicker}>FeedSilo Library</div>
        <div style={styles.panelTitle}>A calmer place to come back to.</div>
        <div style={styles.panelText}>No timeline pressure. No lost bookmarks. Just the material you chose to keep.</div>
      </div>
    </div>
  );
};

const CaptureVisual = ({ scene, frame }: { scene: PromoScene; frame: number }) => {
  const arrow = interpolate(frame, [34, 92], [0, 1], {
    ...clamp,
    easing: ease,
  });

  return (
    <div style={styles.captureVisual}>
      <div style={styles.browserCard}>
        <div style={styles.browserBar}>Browser extension</div>
        <button style={{ ...styles.captureButton, background: scene.accent }}>Capture</button>
        <div style={styles.captureList}>
          {scene.labels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      </div>
      <div style={styles.flowLine}>
        <div style={{ ...styles.flowArrow, width: `${arrow * 100}%`, background: scene.accent }} />
      </div>
      <div style={styles.archiveStack}>
        {["Thread", "Article", "Prompt", "Media"].map((label, index) => (
          <div key={label} style={{ ...styles.archiveCard, transform: `translateY(${index * 18}px)` }}>
            <strong>{label}</strong>
            <span>Saved with context</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const SearchVisual = ({ scene, frame }: { scene: PromoScene; frame: number }) => {
  const cursor = Math.floor(frame / 8) % 2 === 0 ? "|" : "";
  const query = "agent memory";
  const typed = query.slice(0, Math.min(query.length, Math.floor(frame / 6)));

  return (
    <div style={styles.searchVisual}>
      <div style={styles.searchBox}>{typed}{cursor}</div>
      <div style={styles.resultGrid}>
        {["Keyword match", "Meaning match", "Original source"].map((label, index) => (
          <div key={label} style={styles.resultCard}>
            <div style={{ ...styles.resultPill, background: withAlpha(scene.accent, 0.18), color: scene.accent }}>
              {label}
            </div>
            <h3>{index === 0 ? "Saved thread on durable memory" : index === 1 ? "Research note about retrieval" : "Article with implementation details"}</h3>
            <p>{index === 2 ? "Open the saved context and jump back to the source." : "Find the idea even when you do not remember the exact wording."}</p>
          </div>
        ))}
      </div>
      <div style={styles.filterRail}>
        {scene.labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  );
};

const OwnershipVisual = ({ scene }: { scene: PromoScene; frame: number }) => {
  return (
    <div style={styles.ownershipVisual}>
      <div style={styles.ownershipGrid}>
        {scene.labels.map((label) => (
          <div key={label} style={{ ...styles.ownershipTile, borderColor: withAlpha(scene.accent, 0.34) }}>
            <span style={{ ...styles.tileIcon, background: withAlpha(scene.accent, 0.2), color: scene.accent }}>
              {label.slice(0, 1)}
            </span>
            <strong>{label}</strong>
          </div>
        ))}
      </div>
      <div style={styles.ctaPanel}>
        <div style={styles.panelKicker}>github.com</div>
        <div style={styles.panelTitle}>Run it yourself.</div>
        <div style={styles.panelText}>Own the archive, inspect the code, and shape what comes next.</div>
      </div>
    </div>
  );
};

const CaptionBar = ({ frame }: { frame: number }) => {
  const activeLineIndex = Math.min(
    promoContent.voiceover.length - 1,
    Math.floor((frame / PROMO_DURATION_FRAMES) * promoContent.voiceover.length),
  );
  const opacity = interpolate(frame, [0, 24, PROMO_DURATION_FRAMES - 30, PROMO_DURATION_FRAMES], [0, 1, 1, 0], clamp);

  return (
    <div style={{ ...styles.captionBar, opacity }}>
      {promoContent.voiceover[activeLineIndex]}
    </div>
  );
};

const Progress = ({ frame, accent }: { frame: number; accent: string }) => {
  const width = interpolate(frame, [0, PROMO_DURATION_FRAMES], [0, 100], clamp);
  return (
    <div style={styles.progressTrack}>
      <div style={{ ...styles.progressBar, background: accent, width: `${width}%` }} />
    </div>
  );
};

const Backdrop = ({ frame, accent }: { frame: number; accent: string }) => {
  const sweep = interpolate(frame % 150, [0, 150], [-260, 2220], clamp);
  return (
    <AbsoluteFill>
      <div style={styles.baseWash} />
      <div style={styles.grid} />
      <div style={{ ...styles.sweep, background: accent, transform: `translateX(${sweep}px) rotate(14deg)` }} />
      <div style={styles.vignette} />
    </AbsoluteFill>
  );
};

const withAlpha = (hex: string, alpha: number) => {
  const clean = hex.replace("#", "");
  const value = parseInt(clean, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const styles: Record<string, CSSProperties> = {
  stage: {
    background: "#070a0d",
    color: "#f7efe3",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    overflow: "hidden",
  },
  baseWash: {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(122deg, #070a0d 0%, #10151a 48%, #16100d 100%)",
  },
  grid: {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
    backgroundSize: "60px 60px",
    maskImage: "linear-gradient(to bottom, transparent 0%, black 18%, black 84%, transparent 100%)",
  },
  sweep: {
    position: "absolute",
    top: -220,
    bottom: -220,
    width: 120,
    filter: "blur(66px)",
    opacity: 0.2,
  },
  vignette: {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(90deg, rgba(0,0,0,0.72), transparent 34%, transparent 70%, rgba(0,0,0,0.6))",
  },
  header: {
    alignItems: "center",
    display: "flex",
    justifyContent: "space-between",
    left: 58,
    position: "absolute",
    right: 58,
    top: 44,
    zIndex: 8,
  },
  wordmark: {
    fontSize: 42,
    fontWeight: 820,
    letterSpacing: 0,
  },
  headerMeta: {
    color: "rgba(247,239,227,0.66)",
    fontSize: 18,
    fontWeight: 650,
  },
  copy: {
    left: 76,
    position: "absolute",
    top: 178,
    width: 610,
    zIndex: 6,
  },
  eyebrow: {
    fontSize: 18,
    fontWeight: 800,
    letterSpacing: 3,
    marginBottom: 24,
    textTransform: "uppercase",
  },
  title: {
    color: "#fff8ec",
    fontSize: 66,
    fontWeight: 840,
    letterSpacing: 0,
    lineHeight: 1.02,
    margin: 0,
  },
  caption: {
    color: "rgba(247,239,227,0.74)",
    fontSize: 27,
    lineHeight: 1.5,
    marginTop: 26,
  },
  visualShell: {
    background: "rgba(12,16,20,0.88)",
    border: "1px solid",
    borderRadius: 28,
    bottom: 150,
    left: 760,
    overflow: "hidden",
    position: "absolute",
    right: 72,
    top: 160,
    zIndex: 5,
  },
  noiseVisual: {
    height: "100%",
    position: "relative",
  },
  noiseChip: {
    background: "rgba(255,255,255,0.055)",
    border: "1px solid",
    borderRadius: 999,
    fontSize: 23,
    fontWeight: 760,
    padding: "16px 22px",
    position: "absolute",
  },
  centerBadge: {
    background: "rgba(0,0,0,0.4)",
    border: "1px solid",
    borderRadius: 26,
    color: "#fff8ec",
    fontSize: 42,
    fontWeight: 820,
    left: "50%",
    padding: "28px 36px",
    position: "absolute",
    top: "50%",
    transform: "translate(-50%, -50%)",
  },
  calmVisual: {
    display: "grid",
    gap: 42,
    gridTemplateColumns: "0.85fr 1fr",
    height: "100%",
    padding: 54,
  },
  timeline: {
    display: "grid",
    gap: 18,
  },
  timelineRow: {
    alignItems: "center",
    background: "rgba(255,255,255,0.055)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 18,
    color: "rgba(255,248,236,0.72)",
    display: "flex",
    fontSize: 21,
    fontWeight: 700,
    gap: 14,
    padding: "18px 20px",
  },
  timelineDot: {
    background: "rgba(255,255,255,0.32)",
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  libraryPanel: {
    alignSelf: "center",
    background: "rgba(6,8,11,0.58)",
    border: "1px solid",
    borderRadius: 26,
    padding: 38,
  },
  panelKicker: {
    color: "rgba(255,248,236,0.52)",
    fontSize: 18,
    fontWeight: 800,
    letterSpacing: 2,
    marginBottom: 18,
    textTransform: "uppercase",
  },
  panelTitle: {
    color: "#fff8ec",
    fontSize: 44,
    fontWeight: 840,
    lineHeight: 1.08,
  },
  panelText: {
    color: "rgba(247,239,227,0.72)",
    fontSize: 24,
    lineHeight: 1.45,
    marginTop: 20,
  },
  captureVisual: {
    alignItems: "center",
    display: "grid",
    gap: 26,
    gridTemplateColumns: "1fr 160px 1fr",
    height: "100%",
    padding: 50,
  },
  browserCard: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.11)",
    borderRadius: 24,
    padding: 30,
  },
  browserBar: {
    color: "rgba(247,239,227,0.58)",
    fontSize: 18,
    fontWeight: 800,
    marginBottom: 26,
    textTransform: "uppercase",
  },
  captureButton: {
    border: 0,
    borderRadius: 16,
    color: "#071014",
    fontSize: 30,
    fontWeight: 840,
    padding: "20px 30px",
    width: "100%",
  },
  captureList: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 24,
  },
  flowLine: {
    background: "rgba(255,255,255,0.1)",
    borderRadius: 999,
    height: 8,
    overflow: "hidden",
  },
  flowArrow: {
    borderRadius: 999,
    height: "100%",
  },
  archiveStack: {
    height: 420,
    position: "relative",
  },
  archiveCard: {
    background: "rgba(8,10,13,0.82)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 22,
    boxShadow: "0 24px 70px rgba(0,0,0,0.28)",
    display: "grid",
    gap: 10,
    left: 0,
    padding: 26,
    position: "absolute",
    right: 0,
    top: 0,
  },
  searchVisual: {
    display: "grid",
    gap: 28,
    height: "100%",
    padding: 54,
  },
  searchBox: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.13)",
    borderRadius: 22,
    color: "#fff8ec",
    fontSize: 34,
    fontWeight: 760,
    padding: "24px 28px",
  },
  resultGrid: {
    display: "grid",
    gap: 22,
    gridTemplateColumns: "repeat(3, 1fr)",
  },
  resultCard: {
    background: "rgba(255,255,255,0.055)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 22,
    padding: 24,
  },
  resultPill: {
    borderRadius: 999,
    display: "inline-block",
    fontSize: 16,
    fontWeight: 820,
    marginBottom: 18,
    padding: "8px 12px",
  },
  filterRail: {
    alignItems: "center",
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
  },
  ownershipVisual: {
    display: "grid",
    gap: 34,
    gridTemplateColumns: "1fr 1fr",
    height: "100%",
    padding: 54,
  },
  ownershipGrid: {
    display: "grid",
    gap: 18,
    gridTemplateColumns: "1fr 1fr",
  },
  ownershipTile: {
    alignContent: "center",
    background: "rgba(255,255,255,0.055)",
    border: "1px solid",
    borderRadius: 22,
    display: "grid",
    gap: 18,
    justifyItems: "start",
    padding: 26,
  },
  tileIcon: {
    alignItems: "center",
    borderRadius: 16,
    display: "flex",
    fontSize: 28,
    fontWeight: 840,
    height: 58,
    justifyContent: "center",
    width: 58,
  },
  ctaPanel: {
    alignSelf: "center",
    background: "rgba(6,8,11,0.62)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 26,
    padding: 42,
  },
  captionBar: {
    background: "rgba(5,7,10,0.72)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 18,
    bottom: 52,
    color: "rgba(255,248,236,0.78)",
    fontSize: 20,
    left: 76,
    lineHeight: 1.35,
    padding: "16px 20px",
    position: "absolute",
    right: 76,
    zIndex: 9,
  },
  progressTrack: {
    background: "rgba(255,255,255,0.1)",
    bottom: 0,
    height: 6,
    left: 0,
    position: "absolute",
    right: 0,
    zIndex: 10,
  },
  progressBar: {
    height: "100%",
  },
};
```

- [ ] **Step 2: Run typecheck and fix any syntax errors**

Run:

```bash
cd promo-video && npm run typecheck
```

Expected: PASS. If TypeScript reports an error, fix the exact line and rerun this command before continuing.

- [ ] **Step 3: Render a still frame**

Run:

```bash
cd promo-video && npm run still
```

Expected: `promo-video/out/preview.png` is created and shows the "Keep what helps" or capture/search scene, depending on frame 300 timing. The frame must not be blank.

- [ ] **Step 4: Commit the composition**

Run:

```bash
git add promo-video/src/FeedSiloPromoIntro.tsx promo-video/src/Root.tsx promo-video/out/preview.png
git commit -m "feat: build feedsilo promo intro composition"
```

---

### Task 4: Add Usage Docs And Voiceover Workflow

**Files:**
- Create: `promo-video/README.md`

- [ ] **Step 1: Write project README**

Create `promo-video/README.md`:

```md
# FeedSilo Promo Intro Video

Fresh Remotion project for the FeedSilo 50-second promo intro.

This project does not reuse the existing `demo-video` Remotion files. It draws the intro scenes from scratch using React/CSS and keeps script timing in `src/promoContent.json`.

## Script

I built FeedSilo because I was tired of losing the good parts of the internet inside noisy feeds.

Twitter especially can be exhausting: great ideas, useful threads, research, prompts, and articles, all mixed in with arguments, negativity, and the pressure to keep scrolling.

FeedSilo is my way of saving the useful parts before they disappear back into the scroll.

It lets you capture posts, threads, articles, RSS items, prompts, and media into a private library you control.

Then you can search it by keyword or meaning, open the original context, filter by source or topic, and actually find the thing you saved.

Today, FeedSilo is open source and self-hosted.

Run it yourself, own your archive, and help shape where it goes next.

## Voiceover

Generate the cloned-voice narration from the script above and save it as:

```text
promo-video/public/audio/feedsilo-promo-voiceover.mp3
```

The default render works without audio for visual review. The voiceover render passes the audio file as a composition prop.

## Commands

```bash
npm install
npm run studio
npm run still
npm run render
npm run render:voiceover
npm run verify
```

The main output files are:

- `out/feedsilo-promo-intro.mp4`
- `out/feedsilo-promo-intro-voiceover.mp4`
- `out/preview.png`
```

- [ ] **Step 2: Run content and type checks**

Run:

```bash
cd promo-video && npm run check:content && npm run typecheck
```

Expected: both commands pass.

- [ ] **Step 3: Commit the README**

Run:

```bash
git add promo-video/README.md
git commit -m "docs: document feedsilo promo video workflow"
```

---

### Task 5: Add Generated Voiceover And Final Render

**Files:**
- Create: `promo-video/public/audio/feedsilo-promo-voiceover.mp3`
- Create: `promo-video/out/feedsilo-promo-intro-voiceover.mp4`

- [ ] **Step 1: Generate the cloned-voice audio**

Use the cloned voice tool with this exact script:

```text
I built FeedSilo because I was tired of losing the good parts of the internet inside noisy feeds.

Twitter especially can be exhausting: great ideas, useful threads, research, prompts, and articles, all mixed in with arguments, negativity, and the pressure to keep scrolling.

FeedSilo is my way of saving the useful parts before they disappear back into the scroll.

It lets you capture posts, threads, articles, RSS items, prompts, and media into a private library you control.

Then you can search it by keyword or meaning, open the original context, filter by source or topic, and actually find the thing you saved.

Today, FeedSilo is open source and self-hosted.

Run it yourself, own your archive, and help shape where it goes next.
```

Save the generated audio at:

```text
promo-video/public/audio/feedsilo-promo-voiceover.mp3
```

- [ ] **Step 2: Verify the audio file exists**

Run:

```bash
test -f promo-video/public/audio/feedsilo-promo-voiceover.mp3
```

Expected: command exits successfully with no output.

- [ ] **Step 3: Render the voiceover version**

Run:

```bash
cd promo-video && npm run render:voiceover
```

Expected: `promo-video/out/feedsilo-promo-intro-voiceover.mp4` is created.

- [ ] **Step 4: Render the silent visual review version**

Run:

```bash
cd promo-video && npm run render
```

Expected: `promo-video/out/feedsilo-promo-intro.mp4` is created.

- [ ] **Step 5: Run final verification**

Run:

```bash
cd promo-video && npm run verify
```

Expected: content check, TypeScript check, and still render all pass.

- [ ] **Step 6: Commit final video artifacts**

Run:

```bash
git add promo-video/public/audio/feedsilo-promo-voiceover.mp3 promo-video/out/feedsilo-promo-intro.mp4 promo-video/out/feedsilo-promo-intro-voiceover.mp4 promo-video/out/preview.png
git commit -m "feat: render feedsilo promo intro video"
```

---

## Self-Review Notes

- Spec coverage: The plan implements a 50-second founder-calm promo intro, avoids the banned launch-language term, keeps `demo-video/` untouched, includes capture/search/ownership beats, and supports generated cloned-voice narration.
- Current-feature honesty: The video claims capture, archive, search, filtering, source context, open source, and self-hosting. It does not claim automated discovery as a current feature.
- Verification: The plan includes content checks, TypeScript checks, still rendering, silent render, and voiceover render.
