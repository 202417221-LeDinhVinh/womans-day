"use client";

import { useCallback, useEffect, useRef } from "react";

import { REVEAL_AT, coverageOf } from "@/lib/womansDay/polaroidGeometry";
import type { ScratchStroke } from "@/lib/womansDay/polaroidState";

/**
 * The grey "scratch me" foil over the polaroid photo window (Plan 15 §3.3).
 *
 * One `<canvas>` paints the foil (the `polaroid/foil.webp` texture + embossed "scratch me"
 * copy) and erases with `destination-out`: a rough-edged round brush is stamped along the
 * pointer path. A small offscreen 48×48 mask mirrors every stamp so progress can be read
 * cheaply (the full-size canvas is never read). On pointerup the canvas is snapshotted
 * (`toBlob → data URL`) into experience state, so a turning leaf shows exactly what was on
 * the page.
 *
 * A lottery ticket, never auto-cleared (Plan 16 Part D): the canvas only loses what was
 * actually scratched. Scratching is a list of strokes in NORMALISED window coordinates,
 * owned by the caller (`strokes` + `onStrokesChange`) and persisted; `paintFoil()` replays
 * them, so a resize redraws exactly the same scratching instead of wiping it. The mask is
 * rebuilt opaque on every paint, so `readProgress()` measures real coverage.
 *
 * Input isolation: `touch-action: none`, `data-lenis-prevent`, `data-wd-interactive` — so
 * scratching never scrolls the page or turns the book.
 */

const MASK_SIZE = 48;
const BRUSH_FRACTION = 0.13;

function makeBrush(radius: number): HTMLCanvasElement {
  const size = Math.max(2, Math.round(radius * 2));
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  // A rough-edged round alpha brush built from noise. This is a TOOL mask, not artwork.
  const image = ctx.createImageData(size, size);
  const centre = size / 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - centre;
      const dy = y - centre;
      const dist = Math.sqrt(dx * dx + dy * dy) / centre;
      const noise = Math.abs((Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1);
      const rim = 1 - Math.max(0, dist - 0.7) * 3.3;
      const alpha = Math.max(0, Math.min(1, rim)) * (0.85 + noise * 0.15);
      const i = (y * size + x) * 4;
      image.data[i] = 255;
      image.data[i + 1] = 255;
      image.data[i + 2] = 255;
      image.data[i + 3] = Math.round(alpha * 255);
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

/**
 * Paint the full unscratched foil (texture + "scratch me" + shade + sparkles) onto a
 * canvas sized from its CSS box. Returns false when the box has no size yet — the caller
 * retries later instead of leaving a transparent canvas (which would show the photo).
 */
function paintFoilArt(canvas: HTMLCanvasElement, foil: HTMLImageElement | null): boolean {
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return false;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  const { width, height } = canvas;
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, width, height);

  if (foil && foil.complete && foil.naturalWidth) {
    const scale = Math.max(width / foil.naturalWidth, height / foil.naturalHeight);
    const w = foil.naturalWidth * scale;
    const h = foil.naturalHeight * scale;
    ctx.drawImage(foil, (width - w) / 2, (height - h) / 2, w, h);
  } else {
    ctx.fillStyle = "#a9aab0";
    ctx.fillRect(0, 0, width, height);
  }

  // The "scratch me" call is the point of the page: set in the readable label face
  // (not the hand font), large and dark enough to read on the grey foil, with a light
  // emboss offset so it still feels printed into the foil.
  const fontSize = Math.round(width * 0.19);
  ctx.font = `600 ${fontSize}px var(--font-type), sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const cx = width / 2;
  const cy = height / 2;
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText("scratch me", cx, cy + height * 0.014);
  ctx.fillStyle = "rgba(50,50,58,0.5)";
  ctx.fillText("scratch me", cx, cy - height * 0.01);
  ctx.fillStyle = "#3f3f47";
  ctx.fillText("scratch me", cx, cy + height * 0.004);

  // A soft inner shade at the edges (a scratch-off foil is slightly domed), not a hard
  // vector stroke which reads as app UI.
  const inner = ctx.createLinearGradient(0, 0, width, height);
  inner.addColorStop(0, "rgba(255,255,255,0.18)");
  inner.addColorStop(0.5, "rgba(255,255,255,0)");
  inner.addColorStop(1, "rgba(70,70,80,0.16)");
  ctx.fillStyle = inner;
  ctx.fillRect(0, 0, width, height);

  // A few tiny painted sparkles (allowed print-artefact geometry).
  const sparkles = [
    { x: width * 0.22, y: height * 0.3, s: width * 0.035 },
    { x: width * 0.78, y: height * 0.42, s: width * 0.028 },
    { x: width * 0.62, y: height * 0.74, s: width * 0.03 },
  ];
  ctx.fillStyle = "rgba(238,225,200,0.7)";
  for (const sp of sparkles) {
    ctx.beginPath();
    ctx.moveTo(sp.x, sp.y - sp.s);
    ctx.lineTo(sp.x + sp.s * 0.28, sp.y - sp.s * 0.28);
    ctx.lineTo(sp.x + sp.s, sp.y);
    ctx.lineTo(sp.x + sp.s * 0.28, sp.y + sp.s * 0.28);
    ctx.lineTo(sp.x, sp.y + sp.s);
    ctx.lineTo(sp.x - sp.s * 0.28, sp.y + sp.s * 0.28);
    ctx.lineTo(sp.x - sp.s, sp.y);
    ctx.lineTo(sp.x - sp.s * 0.28, sp.y - sp.s * 0.28);
    ctx.closePath();
    ctx.fill();
  }
  return true;
}

/**
 * The leaf copy's foil when there is no snapshot yet (photo picked but never scratched):
 * a static full foil, so the turning leaf never flashes the bare photo. Not interactive
 * and never erased.
 */
function StaticFoil() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const foilRef = useRef<HTMLImageElement | null>(null);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return false;
    return paintFoilArt(canvas, foilRef.current);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    let tries = 0;
    const attempt = () => {
      if (cancelled) return;
      // The leaf mounts mid-turn while layout settles; retry until the box has size
      // (bounded) instead of leaving a transparent canvas over the photo.
      if (!paint() && tries++ < 60) raf = requestAnimationFrame(attempt);
    };
    const image = new Image();
    image.src = "/womans-day/polaroid/foil.webp";
    const draw = () => {
      if (cancelled) return;
      foilRef.current = image;
      attempt();
    };
    if (image.complete) draw();
    else {
      image.onload = draw;
      image.onerror = draw;
    }
    const wrap = canvasRef.current?.parentElement;
    const observer = new ResizeObserver(() => paint());
    if (wrap) observer.observe(wrap);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [paint]);

  return <canvas ref={canvasRef} aria-hidden className="h-full w-full" />;
}

export function ScratchFoil({
  playSound,
  onProgress,
  onSnapshot,
  onReveal,
  leafSnapshot,
  strokes,
  onStrokesChange,
  interactive,
}: {
  /** Called once on the first stroke (the scratch loop starts). */
  playSound?: () => void;
  onProgress?: (fraction: number) => void;
  onSnapshot?: (dataUrl: string | null) => void;
  onReveal?: () => void;
  /** The leaf copy: show this data URL statically instead of a live canvas. */
  leafSnapshot?: string | null;
  /** Scratch strokes in normalised window coordinates (persisted by the caller). */
  strokes: ScratchStroke[];
  /** Committed on pointerup (not per move), in the same place as the snapshot. */
  onStrokesChange?: (strokes: ScratchStroke[]) => void;
  interactive: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const maskRef = useRef<HTMLCanvasElement | null>(null);
  const brushRef = useRef<HTMLCanvasElement | null>(null);
  const foilImageRef = useRef<HTMLImageElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  /** The stroke being drawn right now (normalised, flat). Committed on pointerup. */
  const currentStroke = useRef<ScratchStroke>([]);
  const progressTimer = useRef<number | undefined>(undefined);
  const lastVibrate = useRef(0);
  /** The strokes the canvas currently shows; repaint only when this drifts. */
  const paintedRef = useRef<ScratchStroke[] | null>(null);
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;
  const restoreSnapshotTaken = useRef(false);

  const maskFor = useCallback(() => {
    if (!maskRef.current) {
      const mask = document.createElement("canvas");
      mask.width = MASK_SIZE;
      mask.height = MASK_SIZE;
      maskRef.current = mask;
    }
    return maskRef.current;
  }, []);

  const brushFor = useCallback((diameter: number) => {
    const radius = Math.max(3, Math.round(diameter / 2));
    if (!brushRef.current || brushRef.current.width !== radius * 2) {
      brushRef.current = makeBrush(radius);
    }
    return brushRef.current;
  }, []);

  /** Erase one brush dot at canvas pixel (px, py). */
  const eraseAt = useCallback(
    (px: number, py: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      const brush = brushFor(canvas.width * BRUSH_FRACTION * 2);
      ctx.globalCompositeOperation = "destination-out";
      ctx.drawImage(brush, px - brush.width / 2, py - brush.height / 2);
      const mask = maskFor();
      const mctx = mask.getContext("2d");
      if (mctx) {
        mctx.globalCompositeOperation = "destination-out";
        mctx.beginPath();
        mctx.arc(
          (px / canvas.width) * MASK_SIZE,
          (py / canvas.height) * MASK_SIZE,
          (BRUSH_FRACTION * MASK_SIZE) / 2,
          0,
          Math.PI * 2
        );
        mctx.fill();
      }
    },
    [brushFor, maskFor]
  );

  /** Replay one normalised stroke (erase + interpolate, like the live stroke). */
  const replayStroke = useCallback(
    (stroke: ScratchStroke) => {
      const canvas = canvasRef.current;
      if (!canvas || stroke.length < 2) return;
      const pts: Array<{ x: number; y: number }> = [];
      for (let i = 0; i + 1 < stroke.length; i += 2) {
        pts.push({ x: stroke[i] * canvas.width, y: stroke[i + 1] * canvas.height });
      }
      if (pts.length === 1) {
        eraseAt(pts[0].x, pts[0].y);
        return;
      }
      const step = canvas.width * BRUSH_FRACTION * 2 * 0.18;
      for (let i = 1; i < pts.length; i += 1) {
        const dist = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        const steps = Math.max(1, Math.floor(dist / step));
        for (let s = 1; s <= steps; s += 1) {
          eraseAt(
            pts[i - 1].x + ((pts[i].x - pts[i - 1].x) * s) / steps,
            pts[i - 1].y + ((pts[i].y - pts[i - 1].y) * s) / steps
          );
        }
      }
    },
    [eraseAt]
  );

  const paintFoil = useCallback((): boolean => {
    const canvas = canvasRef.current;
    if (!canvas) return false;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    const { width, height } = canvas;
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, width, height);

    const foil = foilImageRef.current;
    if (foil && foil.complete && foil.naturalWidth) {
      const scale = Math.max(width / foil.naturalWidth, height / foil.naturalHeight);
      const w = foil.naturalWidth * scale;
      const h = foil.naturalHeight * scale;
      ctx.drawImage(foil, (width - w) / 2, (height - h) / 2, w, h);
    } else {
      ctx.fillStyle = "#a9aab0";
      ctx.fillRect(0, 0, width, height);
    }

    // The "scratch me" call is the point of the page: set in the readable label face
    // (not the hand font), large and dark enough to read on the grey foil, with a light
    // emboss offset so it still feels printed into the foil.
    const fontSize = Math.round(width * 0.19);
    ctx.font = `600 ${fontSize}px var(--font-type), sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const cx = width / 2;
    const cy = height / 2;
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillText("scratch me", cx, cy + height * 0.014);
    ctx.fillStyle = "rgba(50,50,58,0.5)";
    ctx.fillText("scratch me", cx, cy - height * 0.01);
    ctx.fillStyle = "#3f3f47";
    ctx.fillText("scratch me", cx, cy + height * 0.004);

    // A soft inner shade at the edges (a scratch-off foil is slightly domed), not a hard
    // vector stroke which reads as app UI.
    const inner = ctx.createLinearGradient(0, 0, width, height);
    inner.addColorStop(0, "rgba(255,255,255,0.18)");
    inner.addColorStop(0.5, "rgba(255,255,255,0)");
    inner.addColorStop(1, "rgba(70,70,80,0.16)");
    ctx.fillStyle = inner;
    ctx.fillRect(0, 0, width, height);

    // A few tiny painted sparkles (allowed print-artefact geometry).
    const sparkles = [
      { x: width * 0.22, y: height * 0.3, s: width * 0.035 },
      { x: width * 0.78, y: height * 0.42, s: width * 0.028 },
      { x: width * 0.62, y: height * 0.74, s: width * 0.03 },
    ];
    ctx.fillStyle = "rgba(238,225,200,0.7)";
    for (const sp of sparkles) {
      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y - sp.s);
      ctx.lineTo(sp.x + sp.s * 0.28, sp.y - sp.s * 0.28);
      ctx.lineTo(sp.x + sp.s, sp.y);
      ctx.lineTo(sp.x + sp.s * 0.28, sp.y + sp.s * 0.28);
      ctx.lineTo(sp.x, sp.y + sp.s);
      ctx.lineTo(sp.x - sp.s * 0.28, sp.y + sp.s * 0.28);
      ctx.lineTo(sp.x - sp.s, sp.y);
      ctx.lineTo(sp.x - sp.s * 0.28, sp.y - sp.s * 0.28);
      ctx.closePath();
      ctx.fill();
    }

    // The mask starts OPAQUE on every paint (a fresh canvas is transparent, which reads
    // as fully scratched), then replays exactly the committed strokes.
    const mask = maskFor();
    const mctx = mask.getContext("2d");
    if (mctx) {
      mctx.globalCompositeOperation = "source-over";
      mctx.fillStyle = "#000";
      mctx.fillRect(0, 0, MASK_SIZE, MASK_SIZE);
    }
    for (const stroke of strokesRef.current) replayStroke(stroke);
    paintedRef.current = strokesRef.current;
    return true;
  }, [maskFor, replayStroke]);

  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.src = "/womans-day/polaroid/foil.webp";
    const draw = () => {
      if (cancelled) return;
      foilImageRef.current = image;
      paintFoil();
    };
    if (image.complete) draw();
    else {
      image.onload = draw;
      image.onerror = draw;
    }
    return () => {
      cancelled = true;
    };
  }, [paintFoil]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const observer = new ResizeObserver(() => {
      // A resize WIPES the canvas bitmap; skip the repaint when the pixel size has not
      // changed so the live scratching is never lost.
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(rect.width * dpr));
      const h = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width === w && canvas.height === h) return;
      paintFoil();
    });
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [paintFoil]);

  useEffect(() => {
    // The leaf mounts mid-turn while layout settles: retry (bounded) until the box has
    // size instead of leaving a transparent canvas over the photo.
    let raf = 0;
    let tries = 0;
    let cancelled = false;
    const attempt = () => {
      if (cancelled) return;
      if (!paintFoil() && tries++ < 60) raf = requestAnimationFrame(attempt);
    };
    attempt();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [paintFoil]);

  // Restored strokes (from storage) arrive after the first paint: repaint once so the
  // same scratching shows, then snapshot the leaf copy.
  useEffect(() => {
    if (paintedRef.current !== strokes) paintFoil();
  }, [strokes, paintFoil]);

  const snapshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !onSnapshot) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const reader = new FileReader();
      reader.onload = () => onSnapshot(typeof reader.result === "string" ? reader.result : null);
      reader.readAsDataURL(blob);
    }, "image/png");
  }, [onSnapshot]);

  useEffect(() => {
    if (!interactive || strokes.length === 0 || restoreSnapshotTaken.current) return;
    restoreSnapshotTaken.current = true;
    snapshot();
  }, [interactive, strokes, snapshot]);

  const scheduleProgress = () => {
    if (progressTimer.current) return;
    progressTimer.current = window.setTimeout(() => {
      progressTimer.current = undefined;
      if (drawing.current) onProgress?.(readProgress());
    }, 120);
  };

  const readProgress = () => {
    const mask = maskFor();
    const mctx = mask.getContext("2d");
    if (!mctx) return 0;
    const data = mctx.getImageData(0, 0, MASK_SIZE, MASK_SIZE).data;
    return coverageOf(data);
  };

  const recordPoint = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    currentStroke.current.push(
      Math.round(((clientX - rect.left) / rect.width) * 1000) / 1000,
      Math.round(((clientY - rect.top) / rect.height) * 1000) / 1000
    );
  };

  const strokeTo = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * canvas.width;
    const py = ((clientY - rect.top) / rect.height) * canvas.height;
    if (last.current) {
      const step = canvas.width * BRUSH_FRACTION * 2 * 0.18;
      const dist = Math.hypot(px - last.current.x, py - last.current.y);
      const steps = Math.max(1, Math.floor(dist / step));
      for (let i = 1; i <= steps; i += 1) {
        eraseAt(
          last.current.x + ((px - last.current.x) * i) / steps,
          last.current.y + ((py - last.current.y) * i) / steps
        );
      }
    } else {
      eraseAt(px, py);
    }
    last.current = { x: px, y: py };
  };

  const onPointerDown = (event: React.PointerEvent) => {
    if (!interactive) return;
    drawing.current = true;
    last.current = null;
    currentStroke.current = [];
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    playSound?.();
    for (const e of coalesced(event)) {
      recordPoint(e.clientX, e.clientY);
      strokeTo(e.clientX, e.clientY);
    }
    scheduleProgress();
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!drawing.current || !interactive) return;
    for (const e of coalesced(event)) {
      recordPoint(e.clientX, e.clientY);
      strokeTo(e.clientX, e.clientY);
    }
    const now = performance.now();
    if (now - lastVibrate.current > 90) {
      lastVibrate.current = now;
      navigator.vibrate?.(4);
    }
    scheduleProgress();
  };

  const finish = (event: React.PointerEvent) => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    (event.target as HTMLElement).releasePointerCapture?.(event.pointerId);
    // Commit the stroke (persisted, replayed on resize) with the snapshot.
    if (currentStroke.current.length >= 2) {
      const next = [...strokesRef.current, currentStroke.current];
      paintedRef.current = next;
      onStrokesChange?.(next);
    }
    currentStroke.current = [];
    snapshot();
    const progress = readProgress();
    onProgress?.(progress);
    if (progress >= REVEAL_AT) onReveal?.();
  };

  // Non-interactive with no snapshot yet (photo picked but never scratched): show a
  // static full foil so the leaf never flashes the bare photo mid-turn.
  if (!interactive && !leafSnapshot) {
    return (
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{ touchAction: "none" }}
      >
        <StaticFoil />
      </div>
    );
  }

  return (
    <div
      ref={wrapRef}
      data-wd-interactive
      data-lenis-prevent
      className="absolute inset-0 overflow-hidden"
      style={{ touchAction: "none" }}
    >
      {interactive ? (
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finish}
          onPointerCancel={finish}
          onDragStart={(event) => event.preventDefault()}
          className="h-full w-full cursor-crosshair select-none"
          style={{ touchAction: "none" }}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={leafSnapshot ?? ""} alt="" aria-hidden className="h-full w-full object-cover" />
      )}
    </div>
  );
}

function coalesced(event: React.PointerEvent): Array<{ clientX: number; clientY: number }> {
  const native = event.nativeEvent;
  if (typeof native.getCoalescedEvents === "function") {
    const list = native.getCoalescedEvents();
    if (list.length > 0) return list.map((e) => ({ clientX: e.clientX, clientY: e.clientY }));
  }
  return [{ clientX: event.clientX, clientY: event.clientY }];
}
