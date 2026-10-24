"use client";

import { motion, useReducedMotion } from "framer-motion";
import { memo, useEffect, useRef } from "react";

import { headSrc, petalSrc, stemSrc, type PetalTone } from "@/lib/womansDay/flowers";
import {
  baseYFor,
  GROUND_BAND,
  headWidthForDepth,
  type Planted,
  zForDepth,
} from "@/lib/womansDay/garden";

/**
 * One planted flower (Plan 15 §2.3). The grow animation is the centrepiece: soil crumbs, a
 * stem that grows via `clipPath: inset(100% 0 0 0) → inset(0 0 0 0)`, two leaves unfurl, a
 * bud, then the bloom, then an idle wobble pivoting at the BASE.
 *
 * Only NEW plants animate (`fresh`), never a leaf copy or reduced motion (those render the
 * final pose). A module `useRef<Set<string>>` of already-animated keys stops a re-render or
 * a scroll frame from replaying the grow.
 */

const animatedKeys = new Set<string>();

const PETAL_TONES: PetalTone[] = ["blush", "dusty", "cream"];
const CRUMBS = ["crumb-1", "crumb-2", "crumb-3"];

function pseudo(seed: number, index: number): number {
  const x = Math.sin(seed * 12.9898 + index * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export const GardenPlant = memo(function GardenPlant({
  plant,
  fresh,
  variant = "page",
}: {
  plant: Planted;
  fresh: boolean;
  variant?: "page" | "leaf";
}) {
  const reduced = useReducedMotion();
  const shouldAnimate = fresh && variant === "page" && !reduced && !animatedKeys.has(plant.key);
  const animatedOnce = useRef(false);

  useEffect(() => {
    if (shouldAnimate && !animatedOnce.current) {
      animatedOnce.current = true;
      // Mark AFTER the animation would have started, so this plant never replays.
      const id = window.setTimeout(() => animatedKeys.add(plant.key), 100);
      return () => window.clearTimeout(id);
    }
  }, [shouldAnimate, plant.key]);

  const baseY = baseYFor(plant.depth, GROUND_BAND);
  const width = headWidthForDepth(plant.depth);
  const stemLen = Math.max(4, baseY - plant.headY);
  const z = zForDepth(plant.depth);
  const tilt = plant.tilt;
  const seed = plant.seed;

  const animate = shouldAnimate;
  const C = { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const };
  // Sizes are fractions of the measured ground box (`--gw` = width px, `--gh` = height px),
  // published by `GroundLayers`. `cqw`/`cqh` were unreliable inside this transformed subtree.
  const wpx = (pct: number) => `calc(var(--gw, 600px) * ${pct / 100})`;
  const hpx = (pct: number) => `calc(var(--gh, 750px) * ${pct / 100})`;

  return (
    // Anchored at the BASE (the point on the soil). The idle wobble pivots here.
    <div
      className={`pointer-events-none absolute select-none ${reduced ? "" : "wd-garden-wobble"}`}
      style={{
        left: `${plant.x}%`,
        top: `${baseY}%`,
        zIndex: z,
        transformOrigin: "50% 100%",
        animationDelay: `${pseudo(seed, 1) * -3}s`,
        animationDuration: `${7 + pseudo(seed, 2) * 2}s`,
      }}
    >
      <div className="relative" style={{ transform: `rotate(${tilt}deg)` }}>
        {/* Stem: grows from the base up. Drawn in a box pinned at the base. The clip-path
            animation rides a wrapper div; the `<img>` keeps the sizing. */}
        <motion.div
          className="absolute bottom-0 left-1/2 -translate-x-1/2"
          style={{ height: hpx(stemLen + 6) }}
          initial={
            animate ? { clipPath: "inset(100% 0 0 0)", scaleY: 0.9, rotate: tilt + 4 } : false
          }
          animate={{ clipPath: "inset(0% 0 0 0)", scaleY: 1, rotate: 0 }}
          transition={animate ? { ...C, delay: 0.06 } : { duration: 0 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={stemSrc(plant.id)}
            alt=""
            aria-hidden
            draggable={false}
            className="h-full w-auto max-w-none"
          />
        </motion.div>

        {/* Soil puff: crumbs fly out of the base on short arcs. */}
        {animate
          ? CRUMBS.map((crumb, index) => (
              <motion.div
                key={crumb}
                className="absolute bottom-0 left-1/2"
                style={{ width: wpx(6) }}
                initial={{ opacity: 0, x: 0, y: 0, rotate: 0 }}
                animate={{
                  opacity: [0, 1, 0],
                  x: (pseudo(seed, index + 3) * 2 - 1) * 6,
                  y: [0, -(1.5 + pseudo(seed, index + 5) * 3)],
                  rotate: (pseudo(seed, index + 7) * 2 - 1) * 90,
                }}
                transition={{ duration: 0.55, delay: index * 0.03, ease: "easeOut" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/womans-day/garden/${crumb}.webp`}
                  alt=""
                  aria-hidden
                  draggable={false}
                  className="h-auto w-full"
                />
              </motion.div>
            ))
          : null}

        {/* Bud at the tip, before the bloom. */}
        {animate ? (
          <motion.div
            className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ top: hpx(-stemLen), width: wpx(width * 0.4) }}
            initial={{ scale: 0.2, opacity: 0 }}
            animate={{ scale: [0.2, 1, 0.7], opacity: [0, 1, 0] }}
            transition={{ duration: 0.9, delay: 0.62, ease: "easeOut" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/womans-day/garden/bud.webp"
              alt=""
              aria-hidden
              draggable={false}
              className="h-auto w-full"
            />
          </motion.div>
        ) : null}

        {/* The head (the bloom) at the tip. A plain `<img>` carries the size (fram-motion on
            an `<img>` zeroed the `calc()` width); the animation rides a wrapper div. */}
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ top: hpx(-stemLen), width: wpx(width) }}
          initial={animate ? { scale: 0.35, rotate: -14, opacity: 0 } : false}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={
            animate
              ? {
                  type: "spring",
                  stiffness: 180,
                  damping: 14,
                  delay: 0.88,
                  opacity: { delay: 0.88, duration: 0.2 },
                }
              : { duration: 0 }
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={headSrc(plant.id, 512)}
            alt=""
            aria-hidden
            draggable={false}
            className="h-auto w-full"
          />
        </motion.div>

        {/* Two leaves unfurl at 35 % and 58 % of the stem. */}
        {animate
          ? [0.35, 0.58].map((at, index) => (
              <motion.div
                key={at}
                className="absolute left-1/2"
                style={{
                  bottom: hpx(stemLen * at),
                  width: wpx(width * 0.7),
                  transformOrigin: "0% 100%",
                  scaleX: index === 1 ? -1 : 1,
                }}
                initial={{ scale: 0, rotate: index === 1 ? 80 : -80, opacity: 0 }}
                animate={{ scale: [0, 1.08, 1], rotate: index === 1 ? -35 : 35, opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.3 + index * 0.14, ease: "easeOut" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/womans-day/garden/leaf.webp"
                  alt=""
                  aria-hidden
                  draggable={false}
                  className="h-auto w-full"
                />
              </motion.div>
            ))
          : null}

        {/* A few petals drift off at the bloom. */}
        {animate
          ? [0, 1, 2].map((index) => (
              <motion.div
                key={index}
                className="absolute left-1/2"
                style={{ top: hpx(-stemLen), width: wpx(4) }}
                initial={{ opacity: 0, x: 0, y: 0 }}
                animate={{
                  opacity: [0, 0.9, 0],
                  x: (pseudo(seed, index + 11) * 2 - 1) * 8,
                  y: [0, 4 + pseudo(seed, index + 13) * 5],
                  rotate: (pseudo(seed, index + 17) * 2 - 1) * 120,
                }}
                transition={{ duration: 1.1, delay: 1.1 + index * 0.08, ease: "easeOut" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={petalSrc(PETAL_TONES[(seed + index) % PETAL_TONES.length])}
                  alt=""
                  aria-hidden
                  draggable={false}
                  className="h-auto w-full"
                />
              </motion.div>
            ))
          : null}
      </div>
    </div>
  );
});
