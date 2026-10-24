"use client";

import { memo, useMemo, useRef } from "react";
import { motion, useTransform, type MotionValue } from "framer-motion";

import { petalSrc, PETALS, type PetalTone } from "@/lib/womansDay/flowers";
import { SEGMENTS, scrub } from "@/lib/womansDay/timeline";
import {
  bookExclusion,
  buildWall,
  exitDestination,
  poseAt,
  type Exclusion,
  type WallPose,
  type WallSprite,
} from "@/lib/womansDay/wallMotion";
import { Art } from "@/components/womans-day/paper";

/**
 * The painted flower wall behind the book.
 *
 * ~80 sprites placed on four elliptical rings by a fixed seed, so the composition is the
 * same on every load (and could be server-rendered if we ever want a static poster).
 * Scroll drives growth → full wall → scatter. Individual sprites are motion components
 * but each only reads a MotionValue, so nothing re-renders React.
 */

function WallSpriteLayer({
  sprite,
  progress,
  exclusion,
}: {
  sprite: WallSprite;
  progress: MotionValue<number>;
  exclusion: Exclusion;
}) {
  // Everything is computed in "viewport fraction from centre" units: x is a fraction of
  // vw, y a fraction of vh (see `lib/womansDay/wallMotion.ts`).
  //
  // Plan 6 §5.1: ONE derived MotionValue produces the whole pose (a single
  // `translate3d(...) rotate(...) scale(...)` plus the opacity) instead of several
  // MotionValues that each re-evaluated `scrub`/`offset`. `progress` is monotonic during a
  // pass, so once the sprite has fully scattered the pose never changes again: the pose
  // short-circuits to the cached object and the DOM properties stop being written.
  //
  // Plan 11: the exit INTERPOLATES from the settled position to a precomputed destination
  // with the same per-sprite window and easing as the entrance. No branch sets a coordinate
  // directly, so nothing teleports (the old `s > 0.05` snap was the reported "lag").
  const settledAt = SEGMENTS.wallScatter.end;
  const destination = useMemo(() => exitDestination(sprite, exclusion), [sprite, exclusion]);
  const cache = useRef<WallPose | null>(null);

  const pose = (value: number): WallPose => {
    // After the scatter completes every sprite is frozen: return the cached pose so no
    // further value writes reach the DOM.
    if (value >= settledAt && cache.current) return cache.current;
    const computed = poseAt(sprite, value, exclusion, destination);
    if (value >= settledAt) cache.current = computed;
    return computed;
  };

  // One `pose()` per frame drives BOTH properties: the transform selector stores the last
  // pose and the opacity selector reuses it when the value has not changed.
  const transform = useTransform(progress, (value) => pose(value).transform);
  const opacity = useTransform(progress, (value) => pose(value).opacity);
  // `will-change: transform` only while the wall is actually animating (mount → scatter end
  // plus a small tail), so the browser is not asked to keep ~76 promoted layers for the
  // whole session and never demotes one mid-scatter (F3).
  const willChange = useTransform(progress, (value) =>
    value < SEGMENTS.wallScatter.end + 0.02 ? "transform" : "auto"
  );

  return (
    <motion.div
      className="absolute"
      style={{
        left: "50%",
        top: "50%",
        width: `clamp(46px, ${sprite.size * 9.4}vw, ${sprite.size * 170}px)`,
        marginLeft: `calc(clamp(46px, ${sprite.size * 9.4}vw, ${sprite.size * 170}px) / -2)`,
        marginTop: `calc(clamp(46px, ${sprite.size * 9.4}vw, ${sprite.size * 170}px) / -2)`,
        zIndex: sprite.z,
        opacity,
        transform,
        willChange,
      }}
    >
      {/* No CSS `drop-shadow` here: a filter forces the browser to re-rasterise every
          sprite while the wall animates. The painted head already carries its own soft
          edge; a single shared static shadow is not worth 76 filter layers (§5.1). */}
      <Art src={sprite.src} className="h-auto w-full" />
    </motion.div>
  );
}

type Petal = {
  tone: PetalTone;
  left: number;
  top: number;
  size: number;
  rotate: number;
  duration: number;
  delay: number;
  driftX: number;
  driftY: number;
  driftRotate: number;
};

/** Small deterministic PRNG for the drifting petals. Fixed seed = fixed composition. */
function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildPetals(): Petal[] {
  const random = mulberry32(20101987);
  return Array.from({ length: 34 }, (_, index) => {
    const edge = index % 3 !== 0;
    const left = edge
      ? random() < 0.5
        ? 2 + random() * 24
        : 74 + random() * 24
      : 12 + random() * 76;
    const top = 4 + random() * 92;
    return {
      tone: PETALS[Math.floor(random() * PETALS.length)],
      left,
      top,
      size: 12 + random() * 22,
      rotate: random() * 360,
      duration: 9 + random() * 9,
      delay: -random() * 12,
      driftX: (random() - 0.5) * 90,
      driftY: 24 + random() * 90,
      driftRotate: (random() - 0.5) * 90,
    };
  });
}

function FlowerWallImpl({
  progress,
  velocity,
  reduced,
  mobile,
}: {
  progress: MotionValue<number>;
  velocity: MotionValue<number>;
  reduced: boolean;
  mobile: boolean;
}) {
  const wall = useMemo(buildWall, []);
  const petals = useMemo(buildPetals, []);
  const exclusion = useMemo(() => bookExclusion(mobile), [mobile]);

  const petalX = useTransform(
    velocity,
    (value) => `${Math.max(-28, Math.min(28, value * -0.015))}px`
  );
  const petalY = useTransform(
    velocity,
    (value) => `${Math.max(-14, Math.min(14, Math.abs(value) * 0.01))}px`
  );
  const petalOpacity = useTransform(
    progress,
    (value) => 0.18 + scrub(value, SEGMENTS.wallScatter) * 0.6
  );

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 isolate overflow-hidden">
      <div className="absolute inset-0 bg-[#ece4d2]" />
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: "url('/womans-day/paper/grain.webp')",
          backgroundSize: "280px 280px",
          mixBlendMode: "multiply",
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_48%,rgba(249,240,224,0.65),transparent_72%)]" />

      {!reduced &&
        wall.map((sprite) => (
          <WallSpriteLayer
            key={sprite.id}
            sprite={sprite}
            progress={progress}
            exclusion={exclusion}
          />
        ))}

      {reduced && (
        <div className="absolute inset-0">
          {wall.slice(6).map((sprite) => (
            <div
              key={sprite.id}
              className="absolute"
              style={{
                left: `${sprite.left}%`,
                top: `${sprite.top}%`,
                width: `clamp(46px, ${sprite.size * 9.4}vw, ${sprite.size * 170}px)`,
                transform: `translate(-50%, -50%) rotate(${sprite.rotate}deg)`,
                opacity: sprite.finalOpacity,
              }}
            >
              <Art src={sprite.src} className="h-auto w-full" />
            </div>
          ))}
        </div>
      )}

      <motion.div
        className="absolute inset-0"
        style={reduced ? undefined : { x: petalX, y: petalY, opacity: petalOpacity }}
      >
        {petals.map((petal, index) => (
          <span
            key={index}
            className="absolute"
            style={{
              left: `${petal.left}%`,
              top: `${petal.top}%`,
              width: petal.size,
            }}
          >
            <span
              className={reduced ? "block" : "wd-petal-drift block"}
              style={
                {
                  ["--wd-petal-duration" as string]: `${petal.duration}s`,
                  ["--wd-petal-delay" as string]: `${petal.delay}s`,
                  ["--wd-petal-x" as string]: `${petal.driftX}px`,
                  ["--wd-petal-y" as string]: `${petal.driftY}px`,
                  ["--wd-petal-rotate" as string]: `${petal.driftRotate}deg`,
                  transform: `rotate(${petal.rotate}deg)`,
                } as React.CSSProperties
              }
            >
              <Art src={petalSrc(petal.tone)} className="h-auto w-full opacity-80" />
            </span>
          </span>
        ))}
      </motion.div>

      {/* Cream clearing behind the book keeps pages legible without hiding the wall. */}
      <div className="absolute inset-0 bg-[radial-gradient(52%_46%_at_50%_54%,rgba(248,240,226,0.78),rgba(248,240,226,0.28)_58%,transparent_74%)]" />
    </div>
  );
}

export const FlowerWall = memo(FlowerWallImpl);
