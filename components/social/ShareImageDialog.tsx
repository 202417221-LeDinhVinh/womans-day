"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Camera } from "lucide-react";

import PhotoStoryComposer from "@/components/social/PhotoStoryComposer";
import ShareActions from "@/components/social/ShareActions";
import { PillToggleGroup } from "@/components/ui/PillToggleGroup";
import {
  DEFAULT_CAPTURE_OPTIONS,
  elementToShareImage,
  type ShareCaptureOptions,
  type ShareCaptureTheme,
} from "@/components/social/shareCapture";
import { setShareRevealPreference, useShareRevealPreference } from "@/lib/shareRevealPreference";

// A share overlay for a DOM node already on the page (e.g. the review reader's
// question card). On open it rasterises `captureTargetId` to a PNG through the
// shared capture pipeline — the same off-screen clone, CSS-var overrides,
// capture-only reveal, and adaptive pixel ratio the one-click Copy button uses —
// then shows a live preview with Copy / Download / Share actions.
//
// Unlike the score-report ReportSharePanel (which mounts its own bespoke
// ShareCard off-screen), this dialog captures an existing element by id, so the
// caller keeps ownership of the card markup and the capture-only watermark
// layers travel with it.
//
// When the target card renders answer-reveal rows tagged with
// `data-share-reveal="chosen"` / `"correct"` (see `AnswerDetails`), this dialog
// also shows "Show chosen option" / "Show correct answer" checkboxes so a
// student can omit either from the exported image — e.g. to share a question
// with friends without giving away the answer. The choice is saved to
// localStorage (`lib/shareRevealPreference.ts`) and restored on the next share,
// for any question. Callers that never tag reveal rows are unaffected — the
// checkboxes only change what the capture stage strips, so a caller with no
// tagged rows renders identically either way; hide them via `showRevealToggle`.
//
// Export appearance (`showAppearanceToggle`): two INDEPENDENT controls over how
// the PNG is rendered.
//   * Theme — Light or Dark. Dark re-tints the card for the capture only, so the
//     same markup exports as light ink on a near-black backdrop (and the brand
//     mark swaps to `/brand/logo-white.svg`). The ring's gold duration scale keeps
//     the SAME direction in both themes — darker still means a longer session — the
//     dark variant only lifts its top stop enough to stay legible. LEFT/RIGHT
//     arrows flip the theme.
//   * Transparent — a toggle, not a third theme. It removes the BACKDROP (and the
//     background of panels tagged `data-share-overlay-transparent`, e.g. the
//     study-ring card's START/END/LONGEST boxes) while keeping the chosen theme's
//     FOREGROUND, so you pick "transparent + dark" for a story over a dark photo
//     and "transparent + light" for one over a light photo. The brand mark stays in
//     the export so the PNG remains attributable. The `T` key toggles it.
// The two axes are separate precisely because a transparent PNG has no backdrop
// of its own: its legibility depends on the surface it is dropped onto, which the
// app cannot know. Callers whose card tags nothing still get a transparent
// background, just with no panels to strip.
//
// Layout stability: the preview panel's height is reserved up front from the
// live target's own aspect ratio (measured synchronously on open, before the
// async capture resolves) via CSS `aspect-ratio`, and a pulsing skeleton fills
// it while `capture.kind === "capturing"`. Without this the panel would sit at
// its `min-h-[160px]` floor during capture and then jump to the real image's
// height the moment it resolves — a layout shift most noticeable on first
// open, when nothing has been captured yet.

type CaptureState =
  | { kind: "capturing" }
  | { kind: "ready"; blob: Blob; objectUrl: string }
  | { kind: "error"; message: string };
export default function ShareImageDialog({
  captureTargetId,
  captureOptions,
  fileName = "ronan-sat-question.png",
  shareTitle = "SAT question",
  showRevealToggle = false,
  showCountsToggle = false,
  showOverlayToggle = false,
  showPhotoStory = false,
  startInPhotoStory = false,
  onClose,
}: {
  captureTargetId: string;
  captureOptions?: Partial<ShareCaptureOptions>;
  fileName?: string;
  shareTitle?: string;
  // Show the "Show chosen option" / "Show correct answer" checkboxes. Only
  // meaningful when the captured card tags its reveal rows with
  // `data-share-reveal` (currently `AnswerDetails`, used by the review reader).
  showRevealToggle?: boolean;
  // Show the "Show response counts" checkbox. Only meaningful when the captured
  // card tags its per-option counts / voter chips with `data-share-counts`
  // (currently the live-session quiz card).
  showCountsToggle?: boolean;
  // Show the export-appearance controls: a Light/Dark theme switch (LEFT/RIGHT
  // arrow keys) plus an independent Transparent toggle (`T`). The theme axis works
  // for any card built from workbook tokens; the Transparent toggle additionally
  // strips panels tagged `data-share-overlay-transparent` (currently the
  // study-activity share card's stat boxes).
  showOverlayToggle?: boolean;
  // Adds the guided local-only camera/photo composer. The target is recaptured
  // as a transparent overlay, tinted from the selected photo, and combined into
  // one 9:16 PNG in the browser.
  showPhotoStory?: boolean;
  // Used by the development preview harness to open the photo guide directly.
  startInPhotoStory?: boolean;
  onClose: () => void;
}) {
  const [capture, setCapture] = useState<CaptureState>({ kind: "capturing" });
  const [theme, setTheme] = useState<ShareCaptureTheme>("light");
  const [transparent, setTransparent] = useState(false);
  const [photoStoryOpen, setPhotoStoryOpen] = useState(startInPhotoStory);
  // The captured card's own width/height ratio, measured synchronously from the
  // live (already-in-page) target the instant the dialog mounts — BEFORE the
  // async rasterise finishes. Reserving the preview's height from this ratio
  // (via CSS `aspect-ratio`) is what stops the dialog from collapsing to
  // `min-h-[160px]` while "Building image…"/the skeleton is showing and then
  // jumping taller the moment the real PNG loads. Read via a lazy initializer
  // (not an effect) so it's available for the very first render — no
  // 1-frame flash at the fallback height first.
  const [previewRatio] = useState<number | null>(() => {
    if (typeof document === "undefined") return null;
    const target = document.getElementById(captureTargetId);
    if (!(target instanceof HTMLElement)) return null;
    const rect = target.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 ? rect.width / rect.height : null;
  });
  const revealPreference = useShareRevealPreference();

  // Capture the target on mount, and re-capture whenever the reveal preference,
  // theme, or transparency changes so toggling a control updates the live preview
  // immediately. The card is already in the page DOM, so elementToShareImage
  // clones it onto an off-screen stage and rasterises there.
  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;

    const run = async () => {
      setCapture({ kind: "capturing" });
      const target = document.getElementById(captureTargetId);
      if (!(target instanceof HTMLElement)) {
        if (!cancelled) {
          setCapture({ kind: "error", message: "Could not find the card to share." });
        }
        return;
      }
      try {
        const image = await elementToShareImage(target, {
          ...DEFAULT_CAPTURE_OPTIONS,
          ...captureOptions,
          ...(showRevealToggle
            ? {
                hideChosenAnswer: !revealPreference.showChosenAnswer,
                hideCorrectAnswer: !revealPreference.showCorrectAnswer,
              }
            : null),
          ...(showCountsToggle ? { hideChoiceCounts: !revealPreference.showChoiceCounts } : null),
          ...(showOverlayToggle ? { theme, transparentOverlay: transparent } : null),
        });
        if (cancelled) {
          URL.revokeObjectURL(image.objectUrl);
          return;
        }
        createdUrl = image.objectUrl;
        setCapture({ kind: "ready", blob: image.blob, objectUrl: image.objectUrl });
      } catch {
        if (!cancelled) {
          setCapture({ kind: "error", message: "Could not build the share image." });
        }
      }
    };
    void run();

    return () => {
      cancelled = true;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [
    captureTargetId,
    captureOptions,
    showRevealToggle,
    showCountsToggle,
    showOverlayToggle,
    theme,
    transparent,
    revealPreference.showChosenAnswer,
    revealPreference.showCorrectAnswer,
    revealPreference.showChoiceCounts,
  ]);

  // Close on Escape; when the appearance controls are enabled, LEFT/RIGHT arrow
  // keys flip Light <-> Dark and `T` toggles Transparent (no modifier — this
  // dialog owns the whole overlay while it's open, so there's no other consumer
  // of those keys to conflict with).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopImmediatePropagation();
        if (photoStoryOpen) {
          setPhotoStoryOpen(false);
          return;
        }
        onClose();
        return;
      }
      if (photoStoryOpen) return;
      if (!showOverlayToggle) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.stopPropagation();
        event.preventDefault();
        setTheme((current) => (current === "light" ? "dark" : "light"));
        return;
      }
      if (event.key === "t" || event.key === "T") {
        event.stopPropagation();
        event.preventDefault();
        setTransparent((current) => !current);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose, photoStoryOpen, showOverlayToggle]);

  if (photoStoryOpen) {
    return (
      <PhotoStoryComposer
        captureTargetId={captureTargetId}
        captureOptions={captureOptions}
        fileName={fileName}
        shareTitle={shareTitle}
        onClose={() => setPhotoStoryOpen(false)}
      />
    );
  }

  // Deliberately NOT portalled to `document.body`. Rendering inside the host's
  // React AND DOM tree is what keeps it working under a modal that owns the page:
  // Radix's Dialog sets `body { pointer-events: none }`, traps focus by DOM
  // containment, and `aria-hidden`s everything outside its content — a body
  // portal would be click-dead and focus-hostile. The catch is that a
  // TRANSFORMED ancestor would capture this `position: fixed` overlay (and clip
  // it if that ancestor is `overflow-hidden`), so hosts must center their panels
  // without a transform — see the comment in `SessionHistoryDialog`.
  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-scrim/55 p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Share image"
      data-lenis-prevent
      onClick={(event) => {
        event.stopPropagation();
        onClose();
      }}
    >
      <div
        // A column capped to the viewport: the header, the option checkboxes and
        // the action row are `shrink-0` and the PREVIEW absorbs whatever height
        // is left. A tall portrait card (a passage question with four choices)
        // used to grow the panel past the window, and since the overlay centers
        // it, BOTH the "Share" header and the Copy/Download bar were clipped off
        // screen with nothing to scroll.
        className="relative flex max-h-[calc(100dvh-2.5rem)] w-full max-w-lg flex-col rounded-[var(--ui-radius)] border border-border bg-paper-bg p-5 shadow-[var(--ui-shadow-lg)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex shrink-0 items-center justify-between">
          <p className="text-[0.7rem] font-bold text-ink-fg/50">Share</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close share"
            className="workbook-press rounded-[var(--ui-radius)] p-1.5 text-ink-fg/50 transition-colors hover:text-ink-fg"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Preview — takes the leftover height (`min-h-0` so it can actually
            shrink inside the flex column) and scrolls if the card is still
            taller than the space available. `aspect-ratio` (from the live
            target's own on-page dimensions, measured on open) reserves the
            preview's footprint BEFORE the async capture resolves, so the panel
            never collapses to `min-h-[160px]` while "Building image…"/the
            skeleton is showing and then jumps taller once the real PNG loads.
            A checkerboard backdrop in transparent mode makes the PNG's
            transparency visible in the preview — a plain white/beige backdrop
            would make it look identical to the opaque export. The checkerboard is
            tinted to the CHOSEN THEME (dark squares for a dark export), because
            that is the kind of surface the transparent PNG is meant to be dropped
            onto: a light checkerboard behind light ink would show nothing at all
            and read as a failed capture. */}
        <div
          className="flex min-h-[160px] flex-1 items-center justify-center overflow-auto rounded-[var(--ui-radius)] border border-border p-3"
          style={{
            ...(transparent
              ? checkerboardStyle(theme)
              : {
                  backgroundColor:
                    theme === "dark" ? "rgba(28,25,23,0.35)" : "rgba(255,255,255,0.5)",
                }),
            ...(previewRatio ? { aspectRatio: previewRatio } : null),
          }}
        >
          {capture.kind === "ready" ? (
            <img
              src={capture.objectUrl}
              alt="Share preview"
              className="h-auto max-h-full w-full"
              style={{ objectFit: "contain" }}
            />
          ) : capture.kind === "error" ? (
            <p className="px-4 text-center text-sm text-ink-muted">{capture.message}</p>
          ) : (
            <div
              aria-hidden
              className="h-full w-full animate-pulse rounded-[var(--ui-radius-sm)] bg-ink-fg/10"
            />
          )}
        </div>

        {showOverlayToggle ? (
          <div className="mt-3 flex shrink-0 flex-wrap items-center justify-center gap-2">
            {/* Theme — which foreground/backdrop the export is tuned for. */}
            <PillToggleGroup
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
              value={theme}
              onChange={setTheme}
              ariaLabel="Export theme"
              layoutIdPrefix="share-image-theme"
            />

            {/* Transparency — an independent toggle, not a third theme: it drops
                the backdrop and keeps whichever foreground the theme selected. */}
            <button
              type="button"
              onClick={() => setTransparent((current) => !current)}
              aria-pressed={transparent}
              title="Toggle a transparent background (T)"
              className={`inline-flex items-center gap-2 rounded-[var(--ui-radius-sm)] px-3.5 py-1.5 text-xs font-medium transition ${
                transparent
                  ? "bg-brand-tint text-ink-fg"
                  : "bg-surface-white text-ink-muted hover:bg-border/40"
              }`}
            >
              <span
                aria-hidden
                className={`relative inline-block h-3.5 w-6 shrink-0 rounded-full transition-colors ${
                  transparent ? "bg-media-scrim" : "bg-border"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-surface-white transition-all ${
                    transparent ? "left-3" : "left-0.5"
                  }`}
                />
              </span>
              Transparent
            </button>
          </div>
        ) : null}

        {showRevealToggle || showCountsToggle ? (
          <div className="mt-3 flex shrink-0 flex-col gap-2">
            {showRevealToggle ? (
              <>
                <RevealCheckbox
                  label="Show chosen option"
                  checked={revealPreference.showChosenAnswer}
                  onChange={(checked) => setShareRevealPreference({ showChosenAnswer: checked })}
                />
                <RevealCheckbox
                  label="Show correct answer"
                  checked={revealPreference.showCorrectAnswer}
                  onChange={(checked) => setShareRevealPreference({ showCorrectAnswer: checked })}
                />
              </>
            ) : null}
            {showCountsToggle ? (
              <RevealCheckbox
                label="Show response counts"
                checked={revealPreference.showChoiceCounts}
                onChange={(checked) => setShareRevealPreference({ showChoiceCounts: checked })}
              />
            ) : null}
          </div>
        ) : null}

        {/* Actions */}
        <ShareActions
          blob={capture.kind === "ready" ? capture.blob : null}
          fileName={fileName}
          shareTitle={shareTitle}
          secondaryAction={
            showPhotoStory ? (
              <button
                type="button"
                onClick={() => setPhotoStoryOpen(true)}
                className="workbook-press flex h-11 flex-1 items-center justify-center gap-2 rounded-[var(--ui-radius)] border border-border bg-surface-white text-sm font-bold text-ink-fg transition-colors hover:bg-paper-bg"
              >
                <Camera aria-hidden data-icon="inline-start" />
                Photo story
              </button>
            ) : undefined
          }
        />
      </div>
    </div>
  );
}

/**
 * Backdrop for the preview when the export is transparent: a checkerboard, so the
 * absence of a background is visible rather than indistinguishable from an opaque
 * export.
 *
 * Tinted per theme because the transparent PNG's ink is theme-dependent — a light
 * checkerboard behind a dark export's light ink would show nothing and read as a
 * failed capture, so the dark theme gets a dark board.
 */
function checkerboardStyle(theme: ShareCaptureTheme): CSSProperties {
  const square = theme === "dark" ? "#3a3430" : "#d8d2c8";
  const base = theme === "dark" ? "#1a1614" : "#faf9f7";
  return {
    backgroundImage: [
      `linear-gradient(45deg, ${square} 25%, transparent 25%)`,
      `linear-gradient(-45deg, ${square} 25%, transparent 25%)`,
      `linear-gradient(45deg, transparent 75%, ${square} 75%)`,
      `linear-gradient(-45deg, transparent 75%, ${square} 75%)`,
    ].join(", "),
    backgroundSize: "16px 16px",
    backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
    backgroundColor: base,
  };
}

function RevealCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2.5 text-sm text-ink-fg">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-border accent-brand"
      />
      {label}
    </label>
  );
}
