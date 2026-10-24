"use client";

import { motion, useTransform, type MotionValue } from "framer-motion";
import type { ReactNode } from "react";

import { clamp01, paperEase, type Segment } from "@/lib/womansDay/timeline";

/**
 * A page that bends instead of swinging like a door.
 *
 * The leaf is a chain of N vertical strips. Strip 0 is the only one hinged at the spine
 * and carries the whole rotation; each nested strip adds a small relative bend, so the
 * free edge lags behind and the sheet curls. Every strip clips its own slice of a
 * full-page-size copy of the page, which is why the page content must be a pure render
 * (all interactive state lives in the experience above this component).
 *
 * Geometry: only strip 0 is `100/strips %` of the leaf; each nested strip sits at
 * `left: 100%` of its PARENT and is a plain `100%` wide, so the chain lays out edge to
 * edge across the leaf. Sizing every strip to `100/strips %` of its parent would shrink
 * each one by another factor (1/6 -> 1/36 -> 1/216 …) and leave the visible leaf a sliver
 * of a page while the face offsets sample the wrong slice.
 *
 * The back face is pre-rotated 180°, the standard two-sided card trick. Because the
 * strips land left of the spine in reverse index order, the back copy offsets its page
 * horizontally by `stripCount - 1 - index` so the left page still reads left-to-right.
 */

const BEND_DEGREES = 26;

export function TurningLeaf({
  progress,
  segment,
  front,
  back,
  strips,
  rigid = false,
  className = "",
}: {
  progress: MotionValue<number>;
  segment: Segment;
  front: ReactNode;
  back: ReactNode;
  strips: number;
  /**
   * A hard cover board: it swings as ONE plane (no bend/curl) and shows a painted edge for
   * the middle of the turn, because a board has real thickness. `strips` must be 1 for a
   * rigid leaf (the caller passes it) — a board does not bend.
   */
  rigid?: boolean;
  className?: string;
}) {
  const t = useTransform(progress, [segment.start, segment.end], [0, 1], { clamp: true });
  const base = useTransform(t, (value) => -180 * paperEase(value));
  // A board does not curl: constant 0 bend. Paper bends with a sine envelope peaking mid-turn.
  const bend = useTransform(t, (value) =>
    rigid ? 0 : Math.sin(Math.PI * clamp01(value)) * BEND_DEGREES
  );
  const light = useTransform(t, (value) => Math.sin(Math.PI * clamp01(value)));
  // The board edge only shows while the board is meaningfully off the page (the middle of
  // the swing); at either flat pose it would poke out of the book silhouette.
  const edge = useTransform(t, (value) => {
    const off = Math.sin(Math.PI * clamp01(value));
    return off > 0.05 ? Math.min(1, off * 2) : 0;
  });

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 ${className}`}
      style={{ perspective: "2200px", perspectiveOrigin: "0% 50%" }}
    >
      <Strip
        index={0}
        strips={strips}
        base={base}
        bend={bend}
        light={light}
        front={front}
        back={back}
        rigid={rigid}
        edge={edge}
      />
    </div>
  );
}

function Strip({
  index,
  strips,
  base,
  bend,
  light,
  front,
  back,
  rigid,
  edge,
}: {
  index: number;
  strips: number;
  base: MotionValue<number>;
  bend: MotionValue<number>;
  light: MotionValue<number>;
  front: ReactNode;
  back: ReactNode;
  rigid: boolean;
  edge: MotionValue<number>;
}) {
  // Every strip calls this hook; strip 0 simply uses `base` instead.
  const step = useTransform(bend, (value) => (strips > 1 ? value / (strips - 1) : 0));
  const angle = index === 0 ? base : step;

  return (
    <motion.div
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: index === 0 ? "0%" : "100%",
        width: index === 0 ? `${100 / strips}%` : "100%",
        transformOrigin: "left center",
        transformStyle: "preserve-3d",
        rotateY: angle,
        // Only the strip that carries the whole rotation needs to be promoted; promoting
        // every nested strip (which change little) just costs compositor memory.
        willChange: index === 0 ? "transform" : undefined,
      }}
    >
      <Face side="front" index={index} strips={strips} light={light} rigid={rigid}>
        {front}
      </Face>
      <Face side="back" index={index} strips={strips} light={light} rigid={rigid}>
        {back}
      </Face>

      {/* The board's real thickness: a thin cloth face at the free edge, rotated 90° about
          the leaf's right edge so it reads as the side of a hard cover for the middle of
          the swing. Only a rigid leaf mounts it. */}
      {rigid ? (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0"
          style={{
            width: "0.9%",
            opacity: edge,
            transformOrigin: "left center",
            transform: "rotateY(90deg)",
            background: "linear-gradient(to right, #4a3128, #6b4a3a)",
          }}
        />
      ) : null}

      {index + 1 < strips ? (
        <Strip
          index={index + 1}
          strips={strips}
          base={base}
          bend={bend}
          light={light}
          front={front}
          back={back}
          rigid={rigid}
          edge={edge}
        />
      ) : null}
    </motion.div>
  );
}

function Face({
  side,
  index,
  strips,
  light,
  rigid,
  children,
}: {
  side: "front" | "back";
  index: number;
  strips: number;
  light: MotionValue<number>;
  rigid: boolean;
  children: ReactNode;
}) {
  const isBack = side === "back";
  const offset = isBack ? -(strips - 1 - index) : -index;
  const shade = useTransform(light, (value) => value * 0.5);
  const specular = useTransform(light, (value) => value * 0.32);
  const last = index === strips - 1;

  return (
    // The CLIP box. On a paper leaf it overhangs 1 px past the strip's right edge (except
    // the last strip) so the two 3-D planes that meet at a seam overlap instead of leaving
    // an anti-aliased hairline of the stage showing through. The content/shade below are
    // positioned against an INNER box that is exactly the strip width, so `offset * 100%` /
    // `strips * 100%` stay correct. A rigid board has no seams (one strip), so no overhang.
    <div
      className="absolute inset-0 isolate overflow-hidden"
      style={{
        backfaceVisibility: "hidden",
        transform: isBack ? "rotateY(180deg)" : undefined,
        WebkitBackfaceVisibility: "hidden",
        width: !rigid && !last ? "calc(100% + 1px)" : "100%",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          height: "100%",
          // Inner box = the strip width exactly: `100% + 1px` minus the 1 px overhang.
          width: !rigid && !last ? "calc(100% - 1px)" : "100%",
          left: 0,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            height: "100%",
            width: `${strips * 100}%`,
            left: `${offset * 100}%`,
          }}
        >
          {children}
        </div>

        {/* The fold shading is a PAGE-wide gradient, not a per-strip one. It shares the
            full-page geometry (`strips * 100%` wide, offset into the same slice) as the
            content above, so the strips together form ONE continuous shading across the
            leaf. Sizing it to each strip (`inset-0`) would repeat the gradient N times and
            read as vertical shadow bars instead of an even fold. */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            top: 0,
            height: "100%",
            width: `${strips * 100}%`,
            left: `${offset * 100}%`,
            opacity: shade,
            background: isBack
              ? "linear-gradient(to left, rgba(58,40,24,0.42), rgba(255,252,244,0.10) 42%, rgba(58,40,24,0.22))"
              : "linear-gradient(to right, rgba(58,40,24,0.34), rgba(255,252,244,0.08) 50%, rgba(58,40,24,0.16))",
          }}
        />
        {!isBack && last ? (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-px bg-white/50"
            style={{ opacity: specular }}
          />
        ) : null}
      </div>
    </div>
  );
}
