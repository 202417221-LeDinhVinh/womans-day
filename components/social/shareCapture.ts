// Shared DOM-to-PNG capture pipeline. Extracted from DiscussShareButton so both
// the one-click copy button and the ShareImageDialog rasterise a target element
// through the exact same path: an off-screen clone stage, workbook CSS-var
// overrides, capture-only reveal, and an adaptive pixel ratio for a crisp PNG.
//
// `html-to-image` is loaded with a runtime `import()` rather than a static one.
// It is a browser-only rasteriser (it walks the live DOM and paints to a canvas),
// but a static import from this module put it in the SSR module graph, so it was
// emitted into `.next/server/chunks/ssr` — bytes the vinext/Vite build bundles into the single
// Cloudflare Worker script that has a hard 10 MiB limit. Capture only ever runs
// from a click handler that already awaits, so deferring the module is free.

import { buildObfuscatedFontEmbedCss } from "@/lib/obfuscation/clientFontEmbed";
import { parseCssColor } from "@/lib/theme/resolveToken";

export type ShareImage = {
  blob: Blob;
  objectUrl: string;
};

const CAPTURE_PADDING = 18;

/**
 * Which colour scheme the exported PNG is tuned for.
 *
 * `light` is the historical behaviour: a paper backdrop with dark ink. `dark`
 * inverts the workbook tokens for the capture only, so the SAME card markup
 * exports as light ink on a dark backdrop — including swapping the brand mark for
 * `/brand/logo-white.svg`.
 *
 * This is orthogonal to `transparentOverlay`. Together they give the four
 * exports a student actually wants:
 *   light + opaque      → dark ink on paper (the classic card)
 *   dark  + opaque      → light ink on near-black
 *   light + transparent → dark ink, no backdrop — drop onto a LIGHT photo/story
 *   dark  + transparent → light ink, no backdrop — drop onto a DARK photo/story
 * The transparent variants are the point of the theme axis: with no backdrop of
 * its own, the export's legibility depends entirely on the surface it lands on,
 * so the foreground has to be pickable independently of the background.
 *
 * NOTE: a theme is NOT delivered by re-pointing CSS variables alone. The palette
 * is declared in `@theme inline`, so Tailwind bakes literal colours into every
 * utility class and a variable override cannot reach them — see the long comment
 * in `applyCaptureOverrides`.
 */
export type ShareCaptureTheme = "light" | "dark";

type ShareCapturePalette = {
  /** Stage/backdrop fill for an opaque export of this theme. */
  paperBg: string;
  /** Primary foreground (`--color-ink-fg`) — text, ring track, ticks. */
  inkFg: string;
  /** `r, g, b` of `inkFg`, for the `text-ink-fg/NN` opacity-class overrides. */
  inkRgb: string;
  /**
   * Secondary/muted foreground (`--color-ink-muted`).
   *
   * The dark value is lifted well above a literal inversion of the light one. On
   * paper, `#78716c` sits ~4.5:1 under the ink and reads as a calm caption; the same
   * relative step on a near-black card leaves STUDY TIME / TODAY / START / END /
   * LONGEST looking switched off rather than subordinate. Muted has to stay
   * legible first and quiet second.
   */
  inkMuted: string;
  /** Raised panel fill (`--color-surface-white`) — the card body. */
  surface: string;
  /** Hairline (`--color-border`) and its stronger step. */
  border: string;
  borderStrong: string;
  /** Brand wash (`--color-brand-tint`) behind selected chips. */
  brandTint: string;
  /**
   * The three stops of the study-ring duration scale
   * (`--color-study-ring-low/mid/high`).
   *
   * The light values mirror the committed tokens in `app/globals.css` exactly, so
   * an export cannot drift from the live dashboard ring. Both themes run the SAME
   * direction — pale gold -> brand gold -> deep bronze, so darker always means a
   * longer session. The dark palette only LIFTS the top stop far enough to stay
   * legible against a near-black backdrop. It does not invert the ramp:
   * "darker = more intense" is the whole point of the scale, and flipping it per
   * theme would mean the same image says opposite things depending on which variant
   * was exported.
   */
  studyRingLow: string;
  studyRingMid: string;
  studyRingHigh: string;
  /** Drop shadow under the cloned card when `shadow` is on. */
  cardShadow: string;
  /**
   * Multiplier applied to every low-alpha ink derivation (`text-ink-fg/40`,
   * `fill-ink-fg/40`, SVG `stroke-opacity`, …). 1 leaves the authored values alone.
   *
   * Exists because alpha does not translate between backdrops: `ink/25` is a quiet
   * tick on paper and effectively invisible on near-black. Scaling in one place
   * beats hand-tuning each usage, and keeps the authored light-theme values as the
   * single source of truth.
   */
  inkAlphaScale: number;
};

// Light = the committed workbook tokens (app/globals.css). Dark is a capture-only
// palette: the app itself has no dark theme, so these values exist ONLY inside the
// off-screen capture stage and are reverted when the capture finishes.
export const SHARE_CAPTURE_PALETTES: Record<ShareCaptureTheme, ShareCapturePalette> = {
  light: {
    paperBg: "#faf9f7",
    inkFg: "#1c1917",
    inkRgb: "28, 25, 23",
    inkMuted: "#78716c",
    surface: "#ffffff",
    border: "#e7e3dd",
    borderStrong: "#d8d2c8",
    brandTint: "#faf1de",
    studyRingLow: "#ecd28d",
    studyRingMid: "#e0b354",
    studyRingHigh: "#7a5310",
    cardShadow: "0 20px 40px rgba(28,25,23,0.12)",
    inkAlphaScale: 1,
  },
  dark: {
    paperBg: "#14110f",
    inkFg: "#f7f4ef",
    inkRgb: "247, 244, 239",
    inkMuted: "#dcd7cf",
    surface: "#1f1b18",
    border: "#3a3430",
    borderStrong: "#4d453f",
    brandTint: "#3a2f18",
    studyRingLow: "#ecd28d",
    studyRingMid: "#e0b354",
    // Lifted from the light theme's `#7a5310` so a long session still reads on a
    // near-black backdrop; the ramp direction stays pale -> brand -> deep.
    studyRingHigh: "#a8721a",
    cardShadow: "0 20px 40px rgba(0,0,0,0.45)",
    // Ticks/hour labels/captions need noticeably more alpha to read on near-black.
    inkAlphaScale: 2.2,
  },
};

export function getShareCapturePalette(theme: ShareCaptureTheme | undefined) {
  return SHARE_CAPTURE_PALETTES[theme ?? "light"];
}

/**
 * Backdrop the stage should paint for an OPAQUE export.
 *
 * A dark export ignores the caller's `backgroundColor` — that value is a
 * light-theme paper colour chosen per surface, and honouring it would put light
 * ink on a light backdrop. The dark palette owns its own backdrop instead.
 */
function resolveBackgroundColor(options: ShareCaptureOptions) {
  return options.theme === "dark" ? SHARE_CAPTURE_PALETTES.dark.paperBg : options.backgroundColor;
}

// Controls how the captured PNG is framed. Defaults reproduce the original
// Discuss card look (beige backdrop, neobrutalist offset shadow, padded).
// Callers like the review reader override these for a clean, frameless capture.
export type ShareCaptureOptions = {
  backgroundColor: string;
  padding: number;
  shadow: boolean;
  // Optional resolution multiplier for a sharper PNG. Falls back to the
  // device ratio (capped at 2) when unset. The effective ratio is never lower
  // than that fallback, so an override only ever increases sharpness.
  pixelRatio?: number;
  // Optional target minimum output width (device px). Small cards (e.g. a
  // ~950px no-passage question) look soft at a fixed ratio, so the effective
  // ratio is boosted until the exported PNG is at least this wide. Clamped by
  // MAX_PIXEL_RATIO and the 16384px canvas-dimension limit.
  minOutputWidth?: number;
  // When true, strips the "chosen option" reveal (the student's pick +
  // its correct/incorrect highlight and icon) from the exported image only —
  // the live review UI is untouched. Targets elements tagged
  // `data-share-reveal="chosen"` (see `AnswerDetails`).
  hideChosenAnswer?: boolean;
  // Same as `hideChosenAnswer`, but for the correct-answer reveal
  // (`data-share-reveal="correct"`).
  hideCorrectAnswer?: boolean;
  // Live-quiz exports: drop the per-option response counts and voter chips
  // (elements tagged `data-share-counts`) from the image, so a question can be
  // shared without publishing how the room answered.
  hideChoiceCounts?: boolean;
  // Overlay export mode (e.g. the study-activity share card): render the stage
  // with a FULLY TRANSPARENT background instead of `backgroundColor`, and strip
  // the background off any element tagged `data-share-overlay-transparent` (the
  // stat boxes, so they read as floating labels instead of opaque panels) —
  // producing a PNG a student can lay over their own wallpaper/story background,
  // the same idea as Strava's transparent activity-stat overlays.
  //
  // Independent of `theme`: transparency removes the BACKDROP, `theme` picks the
  // FOREGROUND. A transparent export is only legible if its ink contrasts with
  // whatever it is laid over, so pair `dark` with a dark target surface.
  transparentOverlay?: boolean;
  // Transparent overlays KEEP the in-card brand mark (elements tagged
  // `data-capture-overlay-omit`) by default, so a PNG a student lays over their own
  // photo/story stays attributable. The photo-story composer sets this true because
  // its canvas redraws the wordmark at a fixed corner itself — leaving the captured
  // copy in would double-brand. Only meaningful with `transparentOverlay`.
  omitBrandMark?: boolean;
  // Photo-story exports: thicken the overlay's thin geometry and raise its text
  // weights in the CLONE only. A hairline tick or a `font-medium` 10px label is
  // perfectly legible on the app's flat paper background, but laid over a
  // photograph of chairs and table edges those strokes get visually chopped up by
  // the lines behind them. Weight is the cheapest fix that does not change the
  // design: same layout, same colours, more ink per glyph. Only meaningful with
  // `transparentOverlay`, and off for the flat PNG share so the in-app card and
  // its plain export keep matching.
  boldOverlayLines?: boolean;
  // Colour scheme the export is tuned for — see `ShareCaptureTheme`. Defaults to
  // `light` (the historical behaviour) when unset, so existing callers are
  // unaffected.
  theme?: ShareCaptureTheme;
  // Optional caller-provided colour scale for the study clock. This is used by
  // the local photo-story composer after it samples the student's photo. The
  // values only re-point the ring's direct CSS-variable strokes inside the
  // off-screen capture stage; they never retheme the live dashboard.
  studyRingColors?: {
    low: string;
    mid: string;
    high: string;
  };
  // Optional foreground override for transparent overlays. Photo stories use
  // this to let the student recolour the clock's text, labels, and SVG ink
  // without changing the live dashboard card.
  foregroundColor?: string;
};

// Neutralizes a reveal row cloned into the capture stage: strips the
// correct/incorrect highlight classes back to the plain, unrevealed look and
// removes the CheckCircle/XCircle icon, instead of deleting the row outright
// (deleting would collapse the layout and could leak the answer by
// elimination in a 2-choice question).
function neutralizeShareReveal(root: HTMLElement, role: "chosen" | "correct") {
  // Some reveals cannot be neutralized by stripping color — a printed
  // "Correct answer: 7" line, or an SPR input holding the typed answer, IS the
  // answer. Those opt into removal instead.
  for (const el of Array.from(root.querySelectorAll(`[data-share-reveal-remove="${role}"]`))) {
    el.remove();
  }

  for (const el of Array.from(
    root.querySelectorAll<HTMLElement>(`[data-share-reveal="${role}"]`)
  )) {
    // Reset any inline color/background overrides applied by
    // `applyCaptureOverrides` before this element's classes are stripped.
    el.removeAttribute("style");
    for (const node of [el, ...Array.from(el.querySelectorAll<HTMLElement>("*"))]) {
      node.removeAttribute("style");
    }

    el.className = el.className
      .split(" ")
      .filter(
        (cls) =>
          !cls.includes("success") &&
          !cls.includes("accent-3") &&
          // A live-quiz row marks the viewer's own pick with the brand tint, so
          // that counts as a "chosen" reveal too.
          !cls.includes("brand") &&
          !cls.startsWith("ring")
      )
      .join(" ");
    // Re-apply a neutral border/background so the row still reads as a plain
    // answer option instead of an unstyled block.
    el.classList.add("border", "border-border", "bg-surface-white");

    for (const badge of Array.from(el.querySelectorAll<HTMLElement>("[class*='rounded-full']"))) {
      badge.className = badge.className
        .split(" ")
        .filter((cls) => !cls.includes("success") && !cls.includes("accent-3"))
        .join(" ");
      badge.classList.add("border", "border-border", "bg-surface-white", "text-ink-fg");
    }

    for (const icon of Array.from(el.querySelectorAll("svg"))) {
      icon.remove();
    }
  }
}

// html-to-image hard-caps a canvas at 16384px per side; stay just under it.
const CANVAS_DIMENSION_LIMIT = 16384;
// Guardrail so a small card can't request an absurd ratio (memory / clipboard).
const MAX_PIXEL_RATIO = 5;

export const DEFAULT_CAPTURE_OPTIONS: ShareCaptureOptions = {
  backgroundColor: "#faf9f7",
  padding: CAPTURE_PADDING,
  shadow: true,
};

function waitForFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

function applyCaptureOverrides(
  root: HTMLElement,
  backgroundColor: string,
  theme: ShareCaptureTheme = "light",
  studyRingColors?: ShareCaptureOptions["studyRingColors"],
  foregroundColor?: string
) {
  const basePalette = SHARE_CAPTURE_PALETTES[theme];
  // The resolver may hand back `rgb(...)` (it reads live tokens, not hex
  // literals), so parse any CSS colour — not just #rrggbb (C-4).
  const parsedForeground = foregroundColor?.trim() ? parseCssColor(foregroundColor.trim()) : null;
  const foregroundRgb = parsedForeground
    ? `${parsedForeground.r}, ${parsedForeground.g}, ${parsedForeground.b}`
    : null;
  // A story's labels must stay SUBORDINATE to its numbers. Flattening `inkMuted`
  // onto the chosen foreground painted "Start"/"End"/"Longest" at the same full
  // white as their values, which destroys the hierarchy the layout depends on — at
  // a glance the block read as six equal lines rather than three labelled metrics.
  // So the muted ink becomes the same colour at 75% alpha (the editorial-sports
  // convention is 70-80%), and `inkAlphaScale` stays 1 so nothing double-fades it.
  const palette: ShareCapturePalette = foregroundRgb
    ? {
        ...basePalette,
        inkFg: foregroundColor!,
        inkRgb: foregroundRgb,
        inkMuted: `rgba(${foregroundRgb}, 0.75)`,
        inkAlphaScale: 1,
      }
    : basePalette;
  const cleanups: Array<() => void> = [];

  const setStyle = (element: HTMLElement, property: string, value: string) => {
    const previousValue = element.style.getPropertyValue(property);
    const previousPriority = element.style.getPropertyPriority(property);
    element.style.setProperty(property, value);
    cleanups.push(() => {
      if (previousValue) {
        element.style.setProperty(property, previousValue, previousPriority);
      } else {
        element.style.removeProperty(property);
      }
    });
  };

  /**
   * Set a workbook token for the capture only.
   *
   * Scoped to the STAGE, never `document.documentElement`. The stage is an
   * ancestor of the cloned card, so the variables inherit down to everything being
   * rasterised — while the live page keeps its own values throughout.
   *
   * This used to write to `documentElement`, which restyled the WHOLE APP for the
   * duration of every capture. That was already wrong (a visible flicker on the
   * page behind the dialog) and became a hard bug once two controls could
   * re-trigger a capture: overlapping runs each record the CURRENT value as
   * "previous", so the second run's cleanup restores the first run's temporary
   * values and they stick — the live dashboard was left painted with the dark
   * export's surfaces on top of its own dark ink. Stage-scoping removes that whole
   * class of failure: nothing outside the off-screen stage is ever mutated, so
   * overlapping captures cannot interfere with each other or with the page.
   */
  const setToken = (name: string, value: string) => {
    setStyle(root, name, value);
  };

  setToken("--color-paper-bg", backgroundColor);
  setToken("--color-ink-fg", palette.inkFg);
  setToken("--color-ink-muted", palette.inkMuted);
  setToken("--color-surface-white", palette.surface);
  setToken("--color-border", palette.border);
  setToken("--color-border-strong", palette.borderStrong);
  setToken("--color-brand-tint", palette.brandTint);
  setToken("--color-primary", "#e0b354");
  setToken("--color-accent-1", "#ff82a9");
  setToken("--color-accent-2", "#4287ff");
  setToken("--color-accent-3", "#ff6b35");
  // Study-ring duration scale. Both themes keep the SAME direction (peach -> orange
  // -> deep, so darker = a longer session); the dark palette only lifts the top
  // stop enough to stay legible on a near-black backdrop. The ring only ever mixes
  // between these three tokens through `var()` (lib/studyRing.ts
  // `studyRingArcColor`), so — unlike the `@theme inline` utilities below —
  // re-pointing them here really does retune the whole scale.
  setToken("--color-study-ring-low", studyRingColors?.low ?? palette.studyRingLow);
  setToken("--color-study-ring-mid", studyRingColors?.mid ?? palette.studyRingMid);
  setToken("--color-study-ring-high", studyRingColors?.high ?? palette.studyRingHigh);

  for (const heading of root.querySelectorAll<HTMLElement>("[data-share-heading]")) {
    if (heading.textContent?.trim() === "Source Texts") {
      const previousText = heading.textContent;
      heading.textContent = "ronansat.com";
      cleanups.push(() => {
        heading.textContent = previousText;
      });
    }
  }

  for (const element of [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))]) {
    // `getAttribute("class")`, NOT `.className`: on an SVG element `className` is an
    // `SVGAnimatedString`, so the old `typeof === "string"` guard silently skipped
    // every SVG node — which is why the ring's cardinal hour labels (`<text
    // class="fill-ink-fg/40">`) stayed dark ink in the dark export while the
    // surrounding HTML retinted correctly.
    const className = element.getAttribute("class") ?? "";
    const classes = new Set(className.split(/\s+/));
    // Perceived contrast is not symmetric: the same alpha that reads as a quiet
    // hairline on paper disappears against near-black. `inkAlphaScale` lifts every
    // low-alpha ink derivation for the dark palette so ticks, hour labels and muted
    // captions stay legible instead of merging into the backdrop.
    const ink = (alpha: number) =>
      `rgba(${palette.inkRgb}, ${Math.min(1, alpha * palette.inkAlphaScale)})`;

    // ---------------------------------------------------------------------
    // WHY tokens are re-applied as INLINE styles here IN ADDITION to the
    // variable overrides above.
    //
    // `@theme inline` used to bake literals into every utility, so only inline
    // styles could retint a capture. The theme engine now emits `var()`
    // references (utilities resolve live from `color-scheme`), and the stage
    // sets its own `color-scheme` from the export theme — so the variables
    // above retint the clone by themselves. The explicit passes below remain
    // for what variables cannot express: opacity-modified ink (`/NN` fades need
    // the palette's `inkAlphaScale` lift on dark) and SVG presentation
    // attributes that never read CSS variables.
    //
    // The variables above are still needed: they DO reach every place that
    // references a token directly through `var()` rather than through a utility —
    // the ring's `stroke="var(--color-ink-fg)"` track and ticks, and its arc
    // colours, which are `color-mix()` expressions over `--color-study-ring-*`
    // (lib/studyRing.ts). Those resolve from the cascade at use time, so they
    // follow the stage's values.
    //
    // Utilities need this class-driven pass instead. Matching is on WHOLE class
    // tokens (the `classes` set), not substrings, because `text-ink-fg` is a
    // prefix of `text-ink-fg/70` and the two want different values.
    // ---------------------------------------------------------------------
    if (classes.has("text-ink-fg")) setStyle(element, "color", palette.inkFg);
    if (classes.has("text-ink-muted")) setStyle(element, "color", palette.inkMuted);
    if (classes.has("bg-surface-white")) setStyle(element, "background-color", palette.surface);
    if (classes.has("bg-paper-bg")) setStyle(element, "background-color", backgroundColor);
    if (classes.has("border-border")) setStyle(element, "border-color", palette.border);
    if (classes.has("border-border-strong"))
      setStyle(element, "border-color", palette.borderStrong);
    if (classes.has("fill-ink-fg/40")) setStyle(element, "fill", ink(0.4));

    // SVG presentation ATTRIBUTES carrying their own low alpha — the ring's hour
    // ticks (`stroke-opacity="0.25"`) and background track (`0.1`). Their colour is
    // `var(--color-ink-fg)`, so the token override above already flips them to light
    // ink, but the authored alpha was tuned against paper and leaves them almost
    // invisible on near-black. Scale the attribute by the same factor as the
    // class-driven ink so ticks and track brighten together with everything else.
    if (palette.inkAlphaScale !== 1) {
      for (const property of ["stroke-opacity", "fill-opacity"] as const) {
        const authored = Number(element.getAttribute(property));
        if (!Number.isFinite(authored) || authored <= 0 || authored >= 1) continue;
        setStyle(element, property, String(Math.min(1, authored * palette.inkAlphaScale)));
      }
    }

    // Opacity variants: flattened to concrete rgba (rather than left to the token)
    // for the same `@theme inline` reason, and derived from the ACTIVE palette so a
    // dark export does not keep light-theme ink.
    if (className.includes("text-ink-fg/70")) setStyle(element, "color", ink(0.7));
    if (className.includes("text-ink-fg/60")) setStyle(element, "color", ink(0.6));
    if (className.includes("text-ink-fg/55")) setStyle(element, "color", ink(0.55));
    if (className.includes("text-ink-fg/50")) setStyle(element, "color", ink(0.5));
    if (className.includes("text-ink-fg/40")) setStyle(element, "color", ink(0.4));
    if (className.includes("text-ink-fg/30")) setStyle(element, "color", ink(0.3));
    if (className.includes("border-ink-fg/10")) setStyle(element, "border-color", palette.border);
    if (className.includes("border-ink-fg/40"))
      setStyle(element, "border-color", palette.borderStrong);
    if (className.includes("bg-ink-fg/20")) setStyle(element, "background-color", ink(0.2));
    if (className.includes("bg-primary/20"))
      setStyle(element, "background-color", palette.brandTint);
  }

  return () => {
    for (const cleanup of cleanups.reverse()) cleanup();
  };
}

function getCaptureSize(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  return {
    height: Math.max(Math.ceil(element.scrollHeight || element.offsetHeight || rect.height), 1),
    width: Math.max(Math.ceil(rect.width || element.offsetWidth || element.scrollWidth), 1),
  };
}

function createCaptureStage(element: HTMLElement, options: ShareCaptureOptions) {
  const backgroundColor = resolveBackgroundColor(options);
  const palette = getShareCapturePalette(options.theme);
  const { width } = getCaptureSize(element);
  const clone = element.cloneNode(true) as HTMLElement;
  clone.removeAttribute("id");
  // Obfuscated payload (memory/0.3/267): the captured card usually sits INSIDE a
  // `[data-obf-font]` scope (ReviewObfuscatedScope / QuestionViewer root), and
  // attributes do NOT survive cloning from an ancestor — so without this the
  // clone loses the marker + `--obf-font-family` variable, the
  // `[data-obf-font] .reading-prose` rule stops matching, and the PUA text falls
  // back to the reading serif as tofu even with the faces embedded. Copy both
  // from the nearest scoped ancestor onto the clone.
  const obfuscatedScope = element.closest<HTMLElement>("[data-obf-font]");
  if (obfuscatedScope) {
    clone.setAttribute("data-obf-font", "");
    const family = obfuscatedScope.style.getPropertyValue("--obf-font-family");
    if (family) {
      clone.style.setProperty("--obf-font-family", family);
    }
  }
  // Drop live-only chrome that must never appear in the export: the share
  // trigger itself, the rule between two questions of a set, …
  for (const el of Array.from(clone.querySelectorAll("[data-capture-omit]"))) {
    el.remove();
  }
  // Reveal capture-only content that is hidden in the live UI, so it shows up
  // ONLY in the exported image. Elements opt in with `data-capture-only`; the
  // attribute value is the display to restore (defaults to "block"), and
  // `!important` beats the Tailwind `hidden` (display:none) utility.
  for (const el of Array.from(clone.querySelectorAll<HTMLElement>("[data-capture-only]"))) {
    el.style.setProperty("display", el.dataset.captureOnly || "block", "important");
  }
  // Expand scroll panes so their full content renders in the capture (instead
  // of being clipped to the live viewport height). With `height:auto` the flex
  // columns fall back to `align-items:stretch`, so a shorter column stretches to
  // the taller one — keeping a column separator (border) running to the very
  // bottom of the image.
  for (const el of Array.from(clone.querySelectorAll<HTMLElement>("[data-capture-expand]"))) {
    el.style.setProperty("height", "auto", "important");
    el.style.setProperty("max-height", "none", "important");
    el.style.setProperty("overflow", "visible", "important");
  }
  // Omit the chosen-option / correct-answer reveal from the exported image
  // only, per the caller's saved preference — done before
  // `applyCaptureOverrides` so the neutralized rows don't get re-colored by
  // the class-based overrides below.
  if (options.hideChosenAnswer) {
    neutralizeShareReveal(clone, "chosen");
  }
  if (options.hideCorrectAnswer) {
    neutralizeShareReveal(clone, "correct");
  }
  // Live-quiz counts / voter chips are plain extra content, so they are simply
  // dropped (no layout to preserve, unlike an answer row).
  if (options.hideChoiceCounts) {
    for (const el of Array.from(clone.querySelectorAll("[data-share-counts]"))) {
      el.remove();
    }
  }
  // Photo-story legibility: thicken thin geometry and raise text weights on the
  // clone. Ring strokes are multiplied rather than set to a constant so the
  // relationship between the track, the block arcs and the hour ticks survives —
  // a flat value would erase the deliberate 2:1 difference between the major and
  // minor hour ticks. The faint hour numerals get their opacity lifted instead of
  // their weight: at 11px, `fill-ink-fg/40` over a photograph is the first thing
  // to disappear, and more alpha buys more than more stroke.
  function emphasiseOverlayLines() {
    const ring = clone.querySelector<HTMLElement>("[data-share-overlay-ring]");
    if (ring) {
      for (const shape of Array.from(
        ring.querySelectorAll<SVGElement>("circle, line, path, rect")
      )) {
        const current = Number.parseFloat(
          shape.getAttribute("stroke-width") ?? shape.style.strokeWidth ?? ""
        );
        if (!Number.isFinite(current) || current <= 0) continue;
        // Hairlines need proportionally more help than the 13px ring band.
        const scale = current < 3 ? 1.75 : 1.16;
        shape.style.setProperty("stroke-width", `${(current * scale).toFixed(2)}`, "important");
      }
      for (const text of Array.from(ring.querySelectorAll<SVGElement>("text"))) {
        text.style.setProperty("fill-opacity", "0.82", "important");
        text.style.setProperty("font-weight", "700", "important");
      }
    }
    for (const element of Array.from(clone.querySelectorAll<HTMLElement>("*"))) {
      const classes = new Set(element.className?.toString?.().split(/\s+/) ?? []);
      if (classes.has("font-medium") || classes.has("font-semibold")) {
        element.style.setProperty("font-weight", "700", "important");
      } else if (classes.has("font-bold")) {
        element.style.setProperty("font-weight", "800", "important");
      }
    }
  }

  // Overlay export: strip the background off the captured card AND every element
  // tagged `data-share-overlay-transparent` (the START/END/LONGEST stat boxes) so
  // nothing paints an opaque panel over whatever the student lays this PNG on —
  // only the ring, text and icons stay visible.
  //
  // MUST run AFTER `applyCaptureOverrides`, not before. That pass sets a concrete
  // `background-color` on everything carrying `bg-surface-white` / `bg-paper-bg`
  // (needed because `@theme inline` bakes literals into utilities), and
  // `style.setProperty` REPLACES a declaration including its `!important` priority
  // — so running the strip first meant the theme pass quietly painted the card and
  // the stat boxes opaque again. Transparent mode looked like it only removed the
  // outer stage padding.
  function stripBackgroundsForOverlay() {
    for (const el of Array.from(
      clone.querySelectorAll<HTMLElement>(
        "[data-share-overlay-transparent], .bg-surface-white, .bg-paper-bg"
      )
    )) {
      el.style.setProperty("background-color", "transparent", "important");
      el.style.setProperty("background-image", "none", "important");
      el.style.setProperty("box-shadow", "none", "important");
    }
    // The brand mark is kept in a plain transparent export (so the PNG stays
    // attributable); only the photo-story composer asks for it to be dropped,
    // because its canvas draws the wordmark itself.
    if (options.omitBrandMark) {
      for (const el of Array.from(clone.querySelectorAll("[data-capture-overlay-omit]"))) {
        el.remove();
      }
    }
    clone.style.setProperty("padding", "0", "important");
    clone.style.setProperty("border-color", "transparent", "important");
    const ring = clone.querySelector<HTMLElement>("[data-share-overlay-ring]");
    const stats = clone.querySelector<HTMLElement>("[data-share-overlay-stats]");
    const legend = clone.querySelector<HTMLElement>("[data-share-overlay-legend]");
    ring?.style.setProperty("margin-top", "0", "important");
    stats?.style.setProperty("margin-top", "10px", "important");
    legend?.style.setProperty("margin-top", "8px", "important");
    clone.style.setProperty("background-color", "transparent", "important");
    clone.style.setProperty("background-image", "none", "important");
    clone.style.setProperty("box-shadow", "none", "important");
  }
  // Dark export: swap the brand mark for its light variant. `/brand/logo.svg`
  // draws the wordmark glyph in ink, which vanishes on a dark backdrop — and no
  // amount of CSS can recolour the inside of an `<img>`. `/brand/logo-white.svg`
  // is the existing light variation of the same mark, so this is a src swap on the
  // CLONE only (the live logo is untouched). `srcset` is dropped so the browser
  // cannot pick a descriptor still pointing at the ink version. Both the raw path
  // and the `/_next/image?url=` encoded form are handled, since which one Next
  // emits depends on whether the SVG goes through the optimizer.
  if (options.theme === "dark") {
    for (const img of Array.from(clone.querySelectorAll<HTMLImageElement>("img"))) {
      const src = img.getAttribute("src");
      if (!src) continue;
      const lightVariant = src
        .replace("%2Fbrand%2Flogo.svg", "%2Fbrand%2Flogo-white.svg")
        .replace("/brand/logo.svg", "/brand/logo-white.svg");
      if (lightVariant === src) continue;
      img.setAttribute("src", lightVariant);
      img.removeAttribute("srcset");
    }
  }
  clone.style.boxShadow = options.shadow ? palette.cardShadow : "none";
  clone.style.boxSizing = "border-box";
  clone.style.margin = "0";
  clone.style.maxHeight = "none";
  clone.style.overflow = "visible";
  clone.style.width = "100%";

  const stage = document.createElement("div");
  stage.setAttribute("aria-hidden", "true");
  // The export theme — never the viewer's (C10). The stage's own color-scheme
  // resolves every `light-dark()` token in the clone, so a light export from
  // a dark viewer is pixel-equal to one from a light viewer. A light stage is
  // a real light island (dark: variant and portals stay out).
  const stageTheme = options.theme ?? "light";
  stage.style.colorScheme = stageTheme === "dark" ? "dark" : "only light";
  if (stageTheme === "light") stage.setAttribute("data-theme-island", "");
  stage.style.background = options.transparentOverlay ? "transparent" : backgroundColor;
  stage.style.boxSizing = "border-box";
  stage.style.left = "0";
  stage.style.overflow = "visible";
  stage.style.padding = `${options.padding}px`;
  stage.style.pointerEvents = "none";
  stage.style.position = "fixed";
  stage.style.top = "0";
  stage.style.transform = "translateX(-200vw)";
  stage.style.width = `${width + options.padding * 2}px`;
  stage.style.zIndex = "0";

  stage.appendChild(clone);
  document.body.appendChild(stage);

  const cleanup = applyCaptureOverrides(
    stage,
    backgroundColor,
    options.theme,
    options.studyRingColors,
    options.foregroundColor
  );
  if (options.transparentOverlay) {
    stripBackgroundsForOverlay();
  }
  // After the strip, for the same reason the strip runs after `applyCaptureOverrides`:
  // `style.setProperty` replaces a declaration outright, so an earlier weight would
  // be overwritten by any later pass that touches the same property.
  if (options.boldOverlayLines) {
    emphasiseOverlayLines();
  }

  return { cleanup, stage };
}

export async function elementToShareImage(
  element: HTMLElement,
  options: ShareCaptureOptions
): Promise<ShareImage> {
  await document.fonts?.ready;
  await waitForFrame();

  // Obfuscated review payload (memory/0.3/267): the card's PUA text renders with a
  // FontFace-API-loaded family that html-to-image cannot discover (it embeds only
  // STYLESHEET @font-face rules), so without this the exported PNG is tofu. Build
  // data-URL @font-face rules for the active family and park them in <head> for
  // the duration of the capture; the embedder then inlines them like any other
  // webfont. No-op (and fails open) when the surface is not obfuscated.
  const obfuscatedFontCss = await buildObfuscatedFontEmbedCss();
  let obfuscatedFontStyle: HTMLStyleElement | null = null;
  if (obfuscatedFontCss) {
    obfuscatedFontStyle = document.createElement("style");
    obfuscatedFontStyle.setAttribute("data-obf-font-embed", "");
    obfuscatedFontStyle.textContent = obfuscatedFontCss;
    document.head.appendChild(obfuscatedFontStyle);
  }

  const { cleanup, stage } = createCaptureStage(element, options);

  try {
    await waitForFrame();
    const { height, width } = getCaptureSize(stage);
    // Base ratio: caller override or the device ratio (capped at 2).
    const baseRatio = Math.max(options.pixelRatio ?? 0, Math.min(window.devicePixelRatio || 1, 2));
    // Boost small cards up to the requested minimum output width.
    const widthDrivenRatio =
      options.minOutputWidth && width > 0 ? options.minOutputWidth / width : 0;
    // Never let either side exceed the canvas limit.
    const dimensionCap = Math.min(
      CANVAS_DIMENSION_LIMIT / Math.max(width, 1),
      CANVAS_DIMENSION_LIMIT / Math.max(height, 1)
    );
    const pixelRatio = Math.max(
      1,
      Math.min(Math.max(baseRatio, widthDrivenRatio), MAX_PIXEL_RATIO, dimensionCap)
    );
    const { toBlob } = await import("html-to-image");
    const blob = await toBlob(stage, {
      backgroundColor: options.transparentOverlay ? undefined : resolveBackgroundColor(options),
      cacheBust: true,
      height,
      canvasHeight: height,
      canvasWidth: width,
      pixelRatio,
      type: "image/png",
      width,
      style: {
        left: "0",
        maxHeight: "none",
        overflow: "visible",
        position: "relative",
        top: "0",
        transform: "none",
        zIndex: "0",
      },
    });

    if (!blob) {
      throw new Error("Could not render the share image.");
    }

    if (blob.type && blob.type !== "image/png") {
      throw new Error("The Discuss card renderer did not produce a PNG image.");
    }

    const pngBlob = blob.type === "image/png" ? blob : new Blob([blob], { type: "image/png" });
    return { blob: pngBlob, objectUrl: URL.createObjectURL(pngBlob) };
  } finally {
    obfuscatedFontStyle?.remove();
    cleanup();
    stage.remove();
  }
}

export async function copyShareImageToClipboard(image: ShareImage) {
  if (!("ClipboardItem" in window) || !navigator.clipboard?.write) {
    throw new Error("Image clipboard copy is not supported in this browser.");
  }

  window.getSelection()?.removeAllRanges();
  await navigator.clipboard.write([new ClipboardItem({ "image/png": image.blob })]);
}
