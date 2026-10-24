"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/**
 * Small shared pieces for the scrapbook pages: painted stickers, washi strips, label
 * tape, and the paper background. Every visible decorative element is a painted WebP —
 * no emoji, no hand-coded flower SVG. Missing art (during the asset build-out) simply
 * hides itself instead of rendering a broken-image icon.
 */

/**
 * Decoded `<img>` bitmaps are held here for the page lifetime. Keeping the `Image`
 * objects referenced stops the browser evicting the decoded bitmaps, so a later
 * `<img src>` of the same URL paints from memory instead of re-decoding (the "reloads on
 * every scroll" the reader sees).
 */
const warmCache: HTMLImageElement[] = [];

function warmOne(src: string): Promise<void> {
  return new Promise((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      const done = () => resolve();
      if (typeof image.decode === "function") image.decode().then(done, done);
      else done();
    };
    image.onerror = () => resolve();
    image.src = src;
    warmCache.push(image);
  });
}

/**
 * Warm a single image (kept referenced so the decoded bitmap stays). Used by the
 * florist shelf to have a species' 512 px head ready before the click (hover usually
 * comes 100+ ms before the tap, enough for a ~50 KB file).
 */
export function warmImage(src: string): void {
  void warmOne(src);
}

/**
 * Decode the whole route image set up front so scrolling never waits on a decode.
 *
 * The CRITICAL set is decoded first (page + cover + wall + the reader's plate); the rest
 * run after an idle callback with a small concurrency cap so they never compete with fonts
 * or the first paint. Returns `criticalReady` for an optional loading affordance; scrolling
 * is never blocked on the deferred set.
 */
export function useWarmAssets(
  critical: readonly string[],
  deferred: readonly string[]
): { criticalReady: boolean } {
  const [criticalReady, setCriticalReady] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let cancelled = false;

    const runPool = async (sources: readonly string[], concurrency: number) => {
      let index = 0;
      const workers = Array.from({ length: Math.min(concurrency, sources.length) }, async () => {
        while (index < sources.length && !cancelled) {
          const src = sources[index];
          index += 1;
          await warmOne(src);
        }
      });
      await Promise.all(workers);
    };

    (async () => {
      await runPool(critical, 6);
      if (cancelled) return;
      setCriticalReady(true);

      const idle =
        typeof window !== "undefined" && "requestIdleCallback" in window
          ? (cb: () => void) =>
              (
                window as Window & { requestIdleCallback: (cb: () => void) => number }
              ).requestIdleCallback(cb)
          : (cb: () => void) => window.setTimeout(cb, 300);
      idle(() => {
        if (!cancelled) void runPool(deferred, 4);
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [critical, deferred]);

  return { criticalReady };
}

export function hideOnError(event: React.SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.style.visibility = "hidden";
}

export function Art({
  src,
  alt = "",
  className,
  style,
  draggable = false,
  interactive = false,
}: {
  src: string;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  draggable?: boolean;
  /** Opt in to pointer events. Decorative art is `pointer-events-none` by default so a
   *  drifting/animated layer can never flicker the cursor or steal a neighbouring
   *  control's click (see the audit: hover flicker + intercepted controls). */
  interactive?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      className={`${interactive ? "" : "pointer-events-none"} ${className ?? ""}`}
      style={style}
      draggable={draggable}
      onError={hideOnError}
      decoding="async"
    />
  );
}

/** Cream page stock + a faint edge shadow toward the spine. */
export function PaperSurface({
  className = "",
  style,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  return (
    <div
      className={`relative h-full w-full overflow-hidden bg-[#f2ebda] ${className}`}
      style={{
        backgroundImage: "url('/womans-day/paper/cream.webp')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Washi({
  tone = "beige",
  className = "",
  style,
  inline = false,
}: {
  tone?: "beige" | "pink" | "sage";
  className?: string;
  style?: CSSProperties;
  /** In-flow instead of absolutely positioned. */
  inline?: boolean;
}) {
  return (
    <Art
      src={`/womans-day/stickers/washi-${tone}.webp`}
      className={`pointer-events-none select-none ${inline ? "relative block" : "absolute"} ${className}`}
      style={style}
    />
  );
}

export function Sticker({
  name,
  className = "",
  style,
  inline = false,
}: {
  name: string;
  className?: string;
  style?: CSSProperties;
  /** In-flow instead of absolutely positioned. */
  inline?: boolean;
}) {
  return (
    <Art
      src={`/womans-day/stickers/${name}.webp`}
      className={`pointer-events-none ${inline ? "relative" : "absolute"} select-none ${className}`}
      style={style}
    />
  );
}

/**
 * Beige label-maker tape with real DOM text on top: serif, letter-spaced, warm ink. The
 * tape art is a blank strip so the copy stays crisp at any page size.
 *
 * Height comes from the CONTENT: the wrapper's inline `minHeight` is only a floor, and the
 * paragraph is in normal flow so a label that wraps to two lines grows the strip instead of
 * spilling past a fixed track (the mono "Ronan SAT · 20.10 …" line used to overflow).
 */
export function LabelQuote({
  children,
  className = "",
  style,
  tone = "serif",
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  tone?: "serif" | "mono";
}) {
  return (
    <div
      className={`pointer-events-none absolute flex select-none items-center justify-center ${className}`}
      style={style}
    >
      <img
        src="/womans-day/stickers/label-strip.webp"
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-fill"
        onError={hideOnError}
        draggable={false}
      />
      <p
        className={`relative z-10 w-full px-[6%] py-[1.6%] text-center leading-snug text-[#4a3d2c] ${
          tone === "mono"
            ? "wd-t-2xs whitespace-nowrap font-[family-name:var(--font-type)] tracking-[0.08em]"
            : "wd-t-sm font-[family-name:var(--font-book)] tracking-[0.06em] italic"
        }`}
      >
        {children}
      </p>
    </div>
  );
}

/** A small hand-drawn arrow. Decorative geometry, not botanical art. */
export function DoodleArrow({
  className = "",
  flip = false,
}: {
  className?: string;
  flip?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 60 70"
      className={className}
      aria-hidden
      style={{ transform: flip ? "scaleX(-1)" : undefined }}
      fill="none"
    >
      <path
        d="M8 4c14 6 22 14 28 24 6 9 9 18 10 28"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeDasharray="0.5 4.5"
      />
      <path
        d="M37 48c5 4 7 6 10 9M55 42c-2 5-4 10-8 15"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Highlighter swipe behind a line of text. Painted bookkeeping, not calligraphy. */
export function Highlighter({ children, color }: { children: ReactNode; color: string }) {
  return (
    <span className="relative inline">
      <span
        aria-hidden
        className="absolute inset-x-[-0.25em] bottom-[0.06em] top-[0.28em] -z-10 rounded-[2px] opacity-45"
        style={{ background: color }}
      />
      <span className="relative">{children}</span>
    </span>
  );
}
