"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Camera, ImagePlus, Palette, Sparkles, X } from "lucide-react";

import ShareActions from "@/components/social/ShareActions";
import {
  DEFAULT_CAPTURE_OPTIONS,
  elementToShareImage,
  type ShareCaptureOptions,
} from "@/components/social/shareCapture";
import {
  analyseStoryPhoto,
  buildStudyRingColorScale,
  clampStoryOverlayTransform,
  composePhotoStory,
  DEFAULT_STORY_ACCENT,
  DEFAULT_STORY_DIM_STRENGTH,
  DEFAULT_STORY_OVERLAY_TRANSFORM,
  DEFAULT_STORY_SHADOW_STRENGTH,
  MAX_STORY_DIM_STRENGTH,
  STORY_ACCENT_SWATCHES,
  STORY_DIM_SCALE_X,
  STORY_DIM_SCALE_Y,
  storyDimmerStyle,
  storyShadowFilter,
  themeForInkColor,
  trimTransparentPng,
  type StoryAccentId,
  type StoryOverlayTransform,
  type StoryPhotoAnalysis,
} from "@/lib/photoStory";

type RenderState =
  | { kind: "idle" }
  | { kind: "rendering" }
  | { kind: "ready"; blob: Blob }
  | { kind: "error"; message: string };

type OverlayState =
  | { kind: "idle" }
  | { kind: "rendering" }
  | { kind: "ready"; blob: Blob; objectUrl: string; aspect: number }
  | { kind: "error"; message: string };

type CameraStatus = { kind: "starting" } | { kind: "ready" } | { kind: "error"; message: string };

const MAX_PHOTO_BYTES = 30 * 1024 * 1024;
const MAX_CAMERA_EDGE = 1920;
const DEFAULT_TEXT_COLOR = "#ffffff";
const TEXT_COLOR_SWATCHES = ["#ffffff", "#1c1917", "#ffd0ad", "#e0592f"] as const;
// Delay the expensive clock capture until a preset selection settles.
const ACCENT_COMMIT_DELAY_MS = 220;

function waitForImage(objectUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("Could not prepare the study clock preview."));
    image.src = objectUrl;
  });
}

export default function PhotoStoryComposer({
  captureTargetId,
  captureOptions,
  fileName,
  shareTitle,
  onClose,
}: {
  captureTargetId: string;
  captureOptions?: Partial<ShareCaptureOptions>;
  fileName: string;
  shareTitle: string;
  onClose: () => void;
}) {
  const libraryInputRef = useRef<HTMLInputElement | null>(null);
  const photoPreviewUrlRef = useRef<string | null>(null);
  const overlayUrlRef = useRef<string | null>(null);
  const captureChainRef = useRef<Promise<void>>(Promise.resolve());
  const [cameraOpen, setCameraOpen] = useState(false);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [analysis, setAnalysis] = useState<StoryPhotoAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [accentChoice, setAccentChoice] = useState<StoryAccentId>("brand");
  const [textColor, setTextColor] = useState(DEFAULT_TEXT_COLOR);
  const [shadowStrength, setShadowStrength] = useState(DEFAULT_STORY_SHADOW_STRENGTH);
  const [dimStrength, setDimStrength] = useState(DEFAULT_STORY_DIM_STRENGTH);
  // Thickening the clone's strokes means a fresh rasterise, so this is a toggle
  // rather than a slider — a continuous control here would recapture on every
  // pointer move, which is the cost the colour picker had to be debounced out of.
  const [boldLines, setBoldLines] = useState(true);
  const [overlayTransform, setOverlayTransform] = useState<StoryOverlayTransform>(
    DEFAULT_STORY_OVERLAY_TRANSFORM
  );
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<OverlayState>({ kind: "idle" });
  const [render, setRender] = useState<RenderState>({ kind: "idle" });

  const accent =
    STORY_ACCENT_SWATCHES.find((swatch) => swatch.id === accentChoice)?.color ??
    DEFAULT_STORY_ACCENT;

  // What the capture effect actually reads. Trails `accent`/`textColor` by
  // ACCENT_COMMIT_DELAY_MS so a colour drag repaints the swatches at pointer speed
  // but rasterises once, when the student stops moving.
  const [committedColors, setCommittedColors] = useState({
    accent,
    textColor: DEFAULT_TEXT_COLOR,
  });

  useEffect(() => {
    if (committedColors.accent === accent && committedColors.textColor === textColor) return;
    const timeout = window.setTimeout(
      () => setCommittedColors({ accent, textColor }),
      ACCENT_COMMIT_DELAY_MS
    );
    return () => window.clearTimeout(timeout);
  }, [accent, committedColors, textColor]);

  const captureTheme = themeForInkColor(committedColors.textColor);

  const storyFileName = useMemo(() => {
    const stem = fileName.replace(/\.png$/i, "");
    return `${stem}-story.png`;
  }, [fileName]);

  const choosePhoto = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAnalysisError("Choose an image file.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setAnalysisError("Choose an image smaller than 30 MB.");
      return;
    }

    setAnalysisError(null);
    const previewUrl = URL.createObjectURL(file);
    if (photoPreviewUrlRef.current) URL.revokeObjectURL(photoPreviewUrlRef.current);
    photoPreviewUrlRef.current = previewUrl;
    setPhotoPreviewUrl(previewUrl);
    setPhoto(file);
    setAnalysis(null);
    setRender({ kind: "rendering" });
    try {
      const nextAnalysis = await analyseStoryPhoto(file);
      setAnalysis(nextAnalysis);
    } catch (error) {
      if (photoPreviewUrlRef.current === previewUrl) {
        URL.revokeObjectURL(previewUrl);
        photoPreviewUrlRef.current = null;
        setPhotoPreviewUrl(null);
      }
      setPhoto(null);
      setRender({ kind: "idle" });
      setAnalysisError(error instanceof Error ? error.message : "Could not read this photo.");
    }
  };

  useEffect(() => {
    return () => {
      if (photoPreviewUrlRef.current) URL.revokeObjectURL(photoPreviewUrlRef.current);
      if (overlayUrlRef.current) URL.revokeObjectURL(overlayUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (!photo || !analysis) return;
    let cancelled = false;

    const run = async () => {
      setOverlay((current) => (current.kind === "ready" ? current : { kind: "rendering" }));
      setRender((current) => (current.kind === "rendering" ? current : { kind: "rendering" }));
      const target = document.getElementById(captureTargetId);
      if (!(target instanceof HTMLElement)) {
        setOverlay((current) =>
          current.kind === "ready"
            ? current
            : { kind: "error", message: "Could not find the study clock." }
        );
        return;
      }

      try {
        const capturedOverlay = await elementToShareImage(target, {
          ...DEFAULT_CAPTURE_OPTIONS,
          ...captureOptions,
          minOutputWidth: 1800,
          padding: 0,
          pixelRatio: 3,
          shadow: false,
          theme: captureTheme,
          transparentOverlay: true,
          // The story canvas draws the Ronan SAT wordmark at a fixed corner
          // itself, so the captured overlay must not carry a second copy.
          omitBrandMark: true,
          boldOverlayLines: boldLines,
          foregroundColor: committedColors.textColor,
          studyRingColors: buildStudyRingColorScale(
            committedColors.accent,
            analysis.averageLuminance
          ),
        });
        let overlayBlob: Blob;
        try {
          overlayBlob = await trimTransparentPng(capturedOverlay.blob);
        } finally {
          URL.revokeObjectURL(capturedOverlay.objectUrl);
        }
        const nextObjectUrl = URL.createObjectURL(overlayBlob);
        let dimensions: { width: number; height: number };
        try {
          dimensions = await waitForImage(nextObjectUrl);
        } catch (error) {
          URL.revokeObjectURL(nextObjectUrl);
          throw error;
        }
        if (cancelled) {
          URL.revokeObjectURL(nextObjectUrl);
          return;
        }
        const previousUrl = overlayUrlRef.current;
        overlayUrlRef.current = nextObjectUrl;
        setOverlay({
          kind: "ready",
          blob: overlayBlob,
          objectUrl: nextObjectUrl,
          aspect: dimensions.height / dimensions.width,
        });
        if (previousUrl) {
          window.requestAnimationFrame(() => URL.revokeObjectURL(previousUrl));
        }
      } catch (error) {
        if (!cancelled) {
          setOverlay((current) =>
            current.kind === "ready"
              ? current
              : {
                  kind: "error",
                  message:
                    error instanceof Error ? error.message : "Could not capture the study clock.",
                }
          );
        }
      }
    };

    // A superseded capture cannot be aborted mid-flight, so run them strictly one
    // after another. Letting two 3x rasterise-plus-alpha-scan passes overlap is
    // what turns a colour change into a visible stall.
    captureChainRef.current = captureChainRef.current.then(run, run).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [
    analysis,
    boldLines,
    captureOptions,
    captureTargetId,
    captureTheme,
    committedColors.accent,
    committedColors.textColor,
    photo,
  ]);

  useEffect(() => {
    if (!photo || !analysis || overlay.kind !== "ready") return;
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      void composePhotoStory({
        photo,
        overlay: overlay.blob,
        transform: overlayTransform,
        shadowStrength,
        dimStrength,
      })
        .then((blob) => {
          if (!cancelled) setRender({ kind: "ready", blob });
        })
        .catch((error) => {
          if (!cancelled) {
            setRender({
              kind: "error",
              message: error instanceof Error ? error.message : "Could not build the photo story.",
            });
          }
        });
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [analysis, dimStrength, overlay, overlayTransform, photo, shadowStrength]);

  return (
    <div
      className="fixed inset-0 z-[160] flex items-center justify-center bg-scrim/45 p-0 sm:p-4"
      role="presentation"
      onClick={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-story-title"
        className="workbook-modal-card flex h-full max-h-full w-full max-w-5xl flex-col overflow-hidden sm:h-auto sm:max-h-[min(92vh,56rem)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-paper-bg px-5 py-4">
          <div>
            <h2
              id="photo-story-title"
              className="font-display text-xl font-semibold tracking-tight text-ink-fg"
            >
              Photo story
            </h2>
            <p className="mt-1 text-sm text-ink-muted">Your photo never leaves this browser.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close photo story"
            className="rounded-[var(--ui-radius-sm)] border border-border bg-surface-white p-2 workbook-press"
          >
            <X aria-hidden className="size-4" />
          </button>
        </header>

        <div className="workbook-scrollbar min-h-0 flex-1 overflow-y-auto bg-surface-white p-4 sm:p-6">
          {cameraOpen ? (
            <CameraCapturePanel
              onCapture={(file) => {
                setCameraOpen(false);
                void choosePhoto(file);
              }}
              onCancel={() => setCameraOpen(false)}
              onChoosePhoto={() => {
                setCameraOpen(false);
                libraryInputRef.current?.click();
              }}
            />
          ) : !photo ? (
            <div className="mx-auto flex min-h-[28rem] max-w-lg flex-col justify-center gap-5 py-6 sm:py-10">
              <div className="flex justify-center">
                <div className="flex size-14 items-center justify-center rounded-[var(--ui-radius-lg)] bg-brand-tint text-ink-fg">
                  <Camera aria-hidden className="size-7" />
                </div>
              </div>
              <div className="text-center">
                <h3 className="font-display text-2xl font-semibold text-ink-fg">
                  Make a story from your study time
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                  Choose a photo, place your study clock, then share a 9:16 story.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                <button
                  type="button"
                  onClick={() => setCameraOpen(true)}
                  className="workbook-button"
                >
                  <Camera aria-hidden data-icon="inline-start" />
                  Take photo
                </button>
                <button
                  type="button"
                  onClick={() => libraryInputRef.current?.click()}
                  className="workbook-button-secondary"
                >
                  <ImagePlus aria-hidden data-icon="inline-start" />
                  Choose photo
                </button>
              </div>
              {analysisError ? (
                <p role="alert" className="text-center text-sm text-accent-3">
                  {analysisError}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="grid min-h-0 gap-6 lg:grid-cols-[minmax(16rem,0.85fr)_minmax(20rem,1.15fr)]">
              <div className="flex flex-col items-center gap-3">
                <InteractiveStoryPreview
                  photoUrl={photoPreviewUrl}
                  overlay={overlay}
                  transform={overlayTransform}
                  shadowStrength={shadowStrength}
                  dimStrength={dimStrength}
                  onTransformChange={(nextTransform) => {
                    setOverlayTransform(nextTransform);
                    setRender({ kind: "rendering" });
                  }}
                />
                <p className="max-w-sm text-center text-xs leading-relaxed text-ink-muted">
                  Drag the clock to move it. Drag any corner of the frame to resize it.
                </p>
                {overlay.kind === "error" ? (
                  <p role="alert" className="max-w-sm text-center text-sm text-accent-3">
                    {overlay.message}
                  </p>
                ) : render.kind === "error" ? (
                  <p role="alert" className="max-w-sm text-center text-sm text-accent-3">
                    {render.message}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-4">
                <ControlGroup icon={<Sparkles aria-hidden />} title="Clock colour">
                  <p className="text-xs leading-relaxed text-ink-muted">
                    Choose a clock colour for your photo.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {STORY_ACCENT_SWATCHES.map((swatch) => {
                      const selected = accentChoice === swatch.id;
                      return (
                        <span
                          key={swatch.id}
                          className="flex size-11 shrink-0 items-center justify-center"
                        >
                          <button
                            type="button"
                            aria-label={`Use ${swatch.label.toLowerCase()} for the clock`}
                            aria-pressed={selected}
                            onClick={() => setAccentChoice(swatch.id)}
                            className={`size-8 rounded-full border border-ink-fg/25 shadow-sm workbook-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-fg focus-visible:ring-offset-2 focus-visible:ring-offset-paper-bg ${
                              selected
                                ? "ring-2 ring-ink-fg ring-offset-2 ring-offset-paper-bg"
                                : "hover:ring-2 hover:ring-border-strong hover:ring-offset-2 hover:ring-offset-paper-bg"
                            }`}
                            style={{ backgroundColor: swatch.color }}
                          />
                        </span>
                      );
                    })}
                  </div>
                </ControlGroup>

                <ControlGroup icon={<Palette aria-hidden />} title="Text colour">
                  <div className="flex flex-wrap items-center gap-2">
                    {TEXT_COLOR_SWATCHES.map((color, index) => (
                      <button
                        key={color}
                        type="button"
                        aria-label={`Use ${["white", "ink", "peach", "clay"][index]} for text`}
                        aria-pressed={textColor === color}
                        onClick={() => setTextColor(color)}
                        className={`size-8 rounded-full border workbook-press ${
                          textColor === color
                            ? "border-ink-fg ring-2 ring-primary ring-offset-2"
                            : "border-border-strong"
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>

                  <div className="mt-5 space-y-4 border-t border-border pt-4">
                    <StrengthSlider
                      id="photo-story-dim"
                      label="Dim the photo"
                      hint="Softens the photo behind the clock."
                      value={dimStrength}
                      max={MAX_STORY_DIM_STRENGTH}
                      onChange={setDimStrength}
                    />
                    <StrengthSlider
                      id="photo-story-shadow"
                      label="Shadow"
                      hint="Adds depth behind the clock and text."
                      value={shadowStrength}
                      max={1}
                      onChange={setShadowStrength}
                    />
                    <button
                      type="button"
                      role="switch"
                      aria-checked={boldLines}
                      onClick={() => setBoldLines((current) => !current)}
                      className="workbook-press flex w-full items-center justify-between gap-4 pt-0.5 text-left"
                    >
                      <span>
                        <span className="block text-sm font-semibold text-ink-fg">
                          Thicker lines and text
                        </span>
                        <span className="mt-0.5 block text-xs text-ink-muted">
                          Makes the clock easier to read on a busy photo.
                        </span>
                      </span>
                      <span
                        aria-hidden
                        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                          boldLines ? "bg-primary scheme-only-light" : "bg-border-strong"
                        }`}
                      >
                        <span
                          className={`absolute top-1 size-4 rounded-full bg-surface-white transition-transform ${
                            boldLines ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </span>
                    </button>
                  </div>
                </ControlGroup>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setCameraOpen(true)}
                    className="workbook-button-secondary"
                  >
                    <Camera aria-hidden data-icon="inline-start" />
                    Take another photo
                  </button>
                  <button
                    type="button"
                    onClick={() => libraryInputRef.current?.click()}
                    className="workbook-button-secondary"
                  >
                    <ImagePlus aria-hidden data-icon="inline-start" />
                    Choose another photo
                  </button>
                </div>

                <ShareActions
                  blob={render.kind === "ready" ? render.blob : null}
                  fileName={storyFileName}
                  shareTitle={shareTitle}
                />
              </div>
            </div>
          )}
        </div>

        <input
          ref={libraryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            void choosePhoto(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </section>
    </div>
  );
}

type ResizeCorner = {
  label: string;
  x: -1 | 1;
  y: -1 | 1;
  className: string;
};

const RESIZE_CORNERS: ResizeCorner[] = [
  { label: "top left", x: -1, y: -1, className: "-left-4 -top-4 cursor-nwse-resize" },
  { label: "top right", x: 1, y: -1, className: "-right-4 -top-4 cursor-nesw-resize" },
  { label: "bottom left", x: -1, y: 1, className: "-bottom-4 -left-4 cursor-nesw-resize" },
  { label: "bottom right", x: 1, y: 1, className: "-bottom-4 -right-4 cursor-nwse-resize" },
];

// Shared by the dimmer and shadow controls so the two cannot drift apart. Follows
// the repo's existing range-input pattern (gradient track + cross-browser thumb)
// from components/test/AmbientSoundControl.tsx.
function StrengthSlider({
  id,
  label,
  hint,
  value,
  max,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const filled = Math.round((value / max) * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold text-ink-fg">
          {label}
        </label>
        <span className="text-xs tabular-nums text-ink-muted">
          {value <= 0 ? "Off" : `${Math.round(value * 100)}%`}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>
      <input
        id={id}
        type="range"
        min={0}
        max={max}
        step={0.05}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-[var(--color-accent-2)] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--color-accent-2)]"
        style={{
          background: `linear-gradient(to right, var(--color-accent-2) 0%, var(--color-accent-2) ${filled}%, rgba(15,14,14,0.15) ${filled}%, rgba(15,14,14,0.15) 100%)`,
        }}
      />
    </div>
  );
}

function InteractiveStoryPreview({
  photoUrl,
  overlay,
  transform,
  shadowStrength,
  dimStrength,
  onTransformChange,
}: {
  photoUrl: string | null;
  overlay: OverlayState;
  transform: StoryOverlayTransform;
  shadowStrength: number;
  dimStrength: number;
  onTransformChange: (transform: StoryOverlayTransform) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [overlaySelected, setOverlaySelected] = useState(true);
  const interactionRef = useRef<
    | {
        kind: "move" | "resize";
        pointerId: number;
        startX: number;
        startY: number;
        transform: StoryOverlayTransform;
        corner?: ResizeCorner;
      }
    | undefined
  >(undefined);

  const overlayAspect = overlay.kind === "ready" ? overlay.aspect : 1;
  const visibleTransform = clampStoryOverlayTransform(transform, overlayAspect);

  const beginInteraction = (
    event: ReactPointerEvent<HTMLElement>,
    kind: "move" | "resize",
    corner?: ResizeCorner
  ) => {
    if (overlay.kind !== "ready" || !containerRef.current) return;
    event.preventDefault();
    containerRef.current.setPointerCapture(event.pointerId);
    interactionRef.current = {
      kind,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      transform: visibleTransform,
      corner,
    };
  };

  const finishInteraction = (pointerId: number) => {
    if (interactionRef.current?.pointerId !== pointerId) return;
    interactionRef.current = undefined;
    if (containerRef.current?.hasPointerCapture(pointerId)) {
      containerRef.current.releasePointerCapture(pointerId);
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current;
    const container = containerRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId || !container) return;
    const bounds = container.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;

    if (interaction.kind === "move") {
      onTransformChange(
        clampStoryOverlayTransform(
          {
            ...interaction.transform,
            centerX:
              interaction.transform.centerX + (event.clientX - interaction.startX) / bounds.width,
            centerY:
              interaction.transform.centerY + (event.clientY - interaction.startY) / bounds.height,
          },
          overlayAspect
        )
      );
      return;
    }

    const corner = interaction.corner;
    if (!corner) return;
    const startWidth = interaction.transform.widthRatio * bounds.width;
    const startHeight = startWidth * overlayAspect;
    const centerX = interaction.transform.centerX * bounds.width;
    const centerY = interaction.transform.centerY * bounds.height;
    const anchorX = centerX - (corner.x * startWidth) / 2;
    const anchorY = centerY - (corner.y * startHeight) / 2;
    const pointerX = event.clientX - bounds.left;
    const pointerY = event.clientY - bounds.top;
    const projectedWidth =
      (corner.x * (pointerX - anchorX) + corner.y * overlayAspect * (pointerY - anchorY)) /
      (1 + overlayAspect * overlayAspect);
    const widthRatio = clampStoryOverlayTransform(
      { centerX: 0.5, centerY: 0.5, widthRatio: projectedWidth / bounds.width },
      overlayAspect
    ).widthRatio;
    const nextWidth = widthRatio * bounds.width;
    const nextHeight = nextWidth * overlayAspect;

    onTransformChange(
      clampStoryOverlayTransform(
        {
          centerX: (anchorX + (corner.x * nextWidth) / 2) / bounds.width,
          centerY: (anchorY + (corner.y * nextHeight) / 2) / bounds.height,
          widthRatio,
        },
        overlayAspect
      )
    );
  };

  const handleMoveKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    const step = event.shiftKey ? 0.05 : 0.015;
    const delta = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }[event.key];
    if (!delta) return;
    event.preventDefault();
    onTransformChange(
      clampStoryOverlayTransform(
        {
          ...visibleTransform,
          centerX: visibleTransform.centerX + delta[0],
          centerY: visibleTransform.centerY + delta[1],
        },
        overlayAspect
      )
    );
  };

  const handleResizeKey = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const direction = ["ArrowUp", "ArrowRight", "+", "="].includes(event.key)
      ? 1
      : ["ArrowDown", "ArrowLeft", "-"].includes(event.key)
        ? -1
        : 0;
    if (!direction) return;
    event.preventDefault();
    event.stopPropagation();
    onTransformChange(
      clampStoryOverlayTransform(
        { ...visibleTransform, widthRatio: visibleTransform.widthRatio + direction * 0.04 },
        overlayAspect
      )
    );
  };

  return (
    <div
      ref={containerRef}
      className="relative aspect-[9/16] max-h-[65vh] w-full max-w-sm touch-none select-none overflow-hidden rounded-[var(--ui-radius-lg)] border border-border bg-ink-fg/10"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) setOverlaySelected(false);
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => finishInteraction(event.pointerId)}
      onPointerCancel={(event) => finishInteraction(event.pointerId)}
    >
      {photoUrl ? (
        <img
          src={photoUrl}
          alt="Selected story background"
          draggable={false}
          className="pointer-events-none absolute inset-0 size-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 animate-pulse bg-skeleton" />
      )}
      <div className="pointer-events-none absolute left-[5.9%] top-[3.3%] z-10 flex items-center gap-1.5 text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
        {}
        <img src="/brand/logo-white.svg" alt="" className="h-auto w-5" draggable={false} />
        <span className="text-xs font-bold uppercase tracking-tight">Ronan SAT</span>
      </div>

      {overlay.kind === "ready" ? (
        <>
          {/* The dimmer sits between the photo and the clock, sized to the ellipse the
              export fills rather than to the clock's own box, so its feathered edge is
              not clipped into a visible rectangle. Not interactive and not part of the
              selectable group, so dragging still hits the clock. */}
          {dimStrength > 0 ? (
            <div
              aria-hidden
              className="pointer-events-none absolute"
              style={{
                background: storyDimmerStyle(dimStrength),
                height: `${
                  visibleTransform.widthRatio * overlay.aspect * STORY_DIM_SCALE_Y * 100
                }%`,
                left: `${visibleTransform.centerX * 100}%`,
                top: `${visibleTransform.centerY * 100}%`,
                transform: "translate(-50%, -50%)",
                width: `${visibleTransform.widthRatio * STORY_DIM_SCALE_X * 100}%`,
              }}
            />
          ) : null}
          <div
            role="group"
            tabIndex={0}
            aria-label="Clock overlay. Drag to move it, or use the arrow keys."
            className={`absolute cursor-move touch-none rounded-[var(--ui-radius-sm)] border-2 outline-none ${
              overlaySelected
                ? "border-primary ring-primary/40 focus-visible:ring-4"
                : "border-transparent"
            }`}
            style={{
              aspectRatio: `${1 / overlay.aspect}`,
              left: `${visibleTransform.centerX * 100}%`,
              top: `${visibleTransform.centerY * 100}%`,
              transform: "translate(-50%, -50%)",
              width: `${visibleTransform.widthRatio * 100}%`,
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
              setOverlaySelected(true);
              beginInteraction(event, "move");
            }}
            onFocus={() => setOverlaySelected(true)}
            onKeyDown={handleMoveKey}
          >
            {}
            <img
              src={overlay.objectUrl}
              alt="Study clock overlay"
              draggable={false}
              className="pointer-events-none size-full object-contain"
              style={{ filter: storyShadowFilter(shadowStrength) }}
            />
            {overlaySelected
              ? RESIZE_CORNERS.map((corner) => (
                  <button
                    key={corner.label}
                    type="button"
                    aria-label={`Resize clock from ${corner.label}`}
                    className={`absolute z-20 flex size-8 items-center justify-center bg-transparent ${corner.className}`}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      beginInteraction(event, "resize", corner);
                    }}
                    onKeyDown={handleResizeKey}
                  >
                    <span
                      aria-hidden
                      className="size-3 rounded-[2px] border-2 border-primary bg-surface-white shadow-sm"
                    />
                  </button>
                ))
              : null}
          </div>
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-scrim/15 px-6 text-center text-sm font-semibold text-on-media">
          {overlay.kind === "error" ? "Clock preview unavailable" : "Preparing clock…"}
        </div>
      )}
    </div>
  );
}

function CameraCapturePanel({
  onCapture,
  onCancel,
  onChoosePhoto,
}: {
  onCapture: (file: File) => void;
  onCancel: () => void;
  onChoosePhoto: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<CameraStatus>({ kind: "starting" });

  useEffect(() => {
    let cancelled = false;
    const videoElement = videoRef.current;

    const stopCamera = () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };

    const startCamera = async () => {
      stopCamera();
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus({
          kind: "error",
          message: "Camera access requires a supported browser on HTTPS or localhost.",
        });
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" } },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoElement;
        if (!video) throw new Error("Camera preview is unavailable.");
        video.srcObject = stream;
        await video.play();
        if (!cancelled) setStatus({ kind: "ready" });
      } catch (error) {
        stopCamera();
        if (cancelled) return;
        const name = error instanceof DOMException ? error.name : "";
        setStatus({
          kind: "error",
          message:
            name === "NotAllowedError"
              ? "Allow camera access in your browser, then try again."
              : name === "NotFoundError"
                ? "No camera was found on this device."
                : "The camera could not be started. You can still choose a photo.",
        });
      }
    };

    void startCamera();
    return () => {
      cancelled = true;
      stopCamera();
      if (videoElement) videoElement.srcObject = null;
    };
  }, [attempt]);

  const captureFrame = async () => {
    const video = videoRef.current;
    if (!video || status.kind !== "ready" || video.videoWidth <= 0 || video.videoHeight <= 0) {
      setStatus({ kind: "error", message: "The camera is not ready yet. Try again." });
      return;
    }

    const scale = Math.min(1, MAX_CAMERA_EDGE / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      setStatus({ kind: "error", message: "This browser could not capture the camera frame." });
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92)
    );
    if (!blob) {
      setStatus({ kind: "error", message: "This browser could not save the camera frame." });
      return;
    }
    onCapture(
      new File([blob], `study-story-${Date.now()}.jpg`, {
        type: blob.type || "image/jpeg",
        lastModified: Date.now(),
      })
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 py-2">
      <div className="text-center">
        <h3 className="font-display text-2xl font-semibold text-ink-fg">Take a photo</h3>
        <p className="mt-2 text-sm text-ink-muted">
          Frame your desk, notes, or end-of-day view, then capture it here.
        </p>
      </div>

      <div className="relative mx-auto flex aspect-[4/3] max-h-[62vh] w-full items-center justify-center overflow-hidden rounded-[var(--ui-radius-lg)] bg-media-scrim">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          aria-label="Camera preview"
          className="size-full object-contain"
        />
        {status.kind === "starting" ? (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-on-media">
            Starting camera…
          </p>
        ) : null}
        {status.kind === "error" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-media-scrim px-6 text-center">
            <p role="alert" className="max-w-md text-sm text-on-media">
              {status.message}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setStatus({ kind: "starting" });
                  setAttempt((current) => current + 1);
                }}
                className="workbook-button"
              >
                Try camera again
              </button>
              <button type="button" onClick={onChoosePhoto} className="workbook-button-secondary">
                Choose photo
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
        <button type="button" onClick={onCancel} className="workbook-button-secondary">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void captureFrame()}
          disabled={status.kind !== "ready"}
          className="workbook-button disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Camera aria-hidden data-icon="inline-start" />
          Capture photo
        </button>
      </div>
    </div>
  );
}

function ControlGroup({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-border pb-4 last:border-b-0">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-fg">
        {icon ? <span className="[&>svg]:size-4">{icon}</span> : null}
        {title}
      </h3>
      {children}
    </section>
  );
}
