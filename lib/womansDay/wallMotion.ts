/**
 * Pure geometry for the flower wall (`components/womans-day/FlowerWall.tsx`).
 *
 * The wall is ~80 sprites on four elliptical rings. Scroll drives growth → full wall →
 * scatter. Every sprite's motion is a function of `progress` alone, so the maths lives here
 * (not in the component) and is unit-tested in `wallMotion.test.ts`.
 *
 * All coordinates are "viewport fraction from the centre": `x` is a fraction of `vw`, `y` a
 * fraction of `vh`. `(0, 0)` is the centre; `(±0.5, ±0.5)` the corners.
 *
 * Entrance and exit are mirror images: each sprite eases in over `ENTRY_WINDOW` progress
 * units (see §3 of `.claude/plans/womans-day-wall-exit.md`), and the exit uses the SAME
 * per-sprite window and the same `smoothstep` easing, in REVERSE ring order (inner ring
 * first, so the centre clears for the book). The exit INTERPOLATES to a precomputed
 * destination; no branch ever sets a coordinate directly (no snap — that was the "lag" the
 * owner saw when the whole wall teleported to the edge in one frame).
 */

import { FLOWERS } from "@/lib/womansDay/flowers";
import { SEGMENTS, clamp01, smoothstep } from "@/lib/womansDay/timeline";

export type WallSprite = {
  id: string;
  src: string;
  left: number;
  top: number;
  ring: number;
  angle: number;
  radius: number;
  rotate: number;
  scale: number;
  depth: number;
  delay: number;
  finalOpacity: number;
  size: number;
  z: number;
  /** Absolute progress at which this sprite's exit begins (see `exitStart`). */
  exitAt: number;
};

export type Exclusion = { hw: number; hh: number };

/**
 * Per-sprite entry window, in progress units. `appear` is
 * `smoothstep((g − delay) / ENTRY_WINDOW)` where `g` is scrubbed over
 * `bloomGrow.start → wallFull.end` (span 0.15), so each sprite eases in over ~0.039
 * progress. The exit reuses this exactly (Plan 11 §3.1) so the two cannot drift.
 */
export const ENTRY_WINDOW = 0.26 * (SEGMENTS.wallFull.end - SEGMENTS.bloomGrow.start);

/** Margin beyond the sprite's own half-size that an exit destination sits past. */
const EXIT_MARGIN = 0.6;

const RING_COUNTS = [6, 13, 23, 34] as const;
const RING_RADII = [0.2, 0.44, 0.71, 1] as const;

/**
 * The ring-ordered raw exit delay in `[0, 1]`: ring 0 (centre) leaves first, ring 3 last.
 * The sprite's own random delay only orders sprites WITHIN its ring band. `buildWall`
 * normalises this by the wall's maximum so the last sprite's window ends exactly on
 * `wallScatter.end`.
 */
function rawExitDelay(sprite: WallSprite): number {
  const ringCount = RING_COUNTS.length;
  const band = 1 / ringCount;
  const jitter = clamp01((sprite.delay - sprite.ring * 0.14) / 0.1);
  return clamp01((sprite.ring + jitter) * band);
}

/** Small deterministic PRNG. Fixed seed = fixed composition. */
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

/**
 * The book's exclusion box, as half-extents of the viewport (fraction of vw/vh), plus a
 * margin so heads clear the page edge.
 *
 * Desktop: the book is `min(86dvh, 92vw * 0.625)` tall at 16:10, i.e. ~86 % of the viewport
 * in both axes at the common laptop ratio, so its half-extents are ~0.43 wide × ~0.45 tall.
 * Mobile: a 3:4.4 page ~84dvh tall, ~0.57vw wide → half-extents ~0.34 vw / 0.48 vh. A little
 * margin on top keeps the settled heads OFF the pages after the scatter. This is only a
 * coarse box (we cannot read the live book rect from a MotionValue); `isolate` on the wall
 * root is the hard guarantee that the wall can never paint above the book.
 */
export function bookExclusion(mobile: boolean): Exclusion {
  return mobile ? { hw: 0.34, hh: 0.48 } : { hw: 0.43, hh: 0.45 };
}

export function buildWall(): WallSprite[] {
  const random = mulberry32(20102026);
  const sprites: WallSprite[] = [];

  RING_COUNTS.forEach((count, ring) => {
    const ringOffset = random() * Math.PI * 2;
    for (let index = 0; index < count; index += 1) {
      const angle = ringOffset + (index / count) * Math.PI * 2 + (random() - 0.5) * 0.18;
      const radius = RING_RADII[ring] * (0.88 + random() * 0.2);
      const flower = FLOWERS[Math.floor(random() * FLOWERS.length)];
      const size = 0.72 + random() * 0.5;
      sprites.push({
        id: `${flower.id}-${ring}-${index}`,
        src: `/womans-day/flowers/${flower.id}/head-sm.webp`,
        left: 50 + Math.cos(angle) * radius * 63,
        top: 50 + Math.sin(angle) * radius * 58,
        ring,
        angle,
        radius,
        rotate: (random() - 0.5) * 52,
        scale: 0.74 + random() * 0.56,
        depth: ring * 10 + index,
        delay: ring * 0.14 + random() * 0.1,
        finalOpacity: 0.28 + random() * 0.42,
        size,
        z: 10 + ring * 10 + Math.floor(random() * 9),
        exitAt: 0,
      });
    }
  });

  // Normalise the exit stagger so the wall's LAST sprite lands its window end exactly on
  // `wallScatter.end` (Plan 11 §3.2). The raw delay is relative and ring-ordered; scaling by
  // the wall's own maximum makes the outermost, latest sprite the one that closes the wall.
  const span = SEGMENTS.wallScatter.end - SEGMENTS.wallScatter.start;
  const usable = span - ENTRY_WINDOW;
  const rawMax = Math.max(...sprites.map((sprite) => rawExitDelay(sprite)));
  for (const sprite of sprites) {
    const fraction = rawMax > 0 ? rawExitDelay(sprite) / rawMax : 0;
    sprite.exitAt = SEGMENTS.wallScatter.start + fraction * usable;
  }

  return sprites;
}

/**
 * The full-wall position of a sprite (the pose at `appear = 1` and `exit = 0`), in
 * viewport fractions from the centre.
 */
export function settledPosition(sprite: WallSprite): { x: number; y: number } {
  return { x: (sprite.left - 50) / 100, y: (sprite.top - 50) / 100 };
}

/**
 * The ring-normalised exit delay in `[0, 1]`: ring 0 (centre) leaves first, ring 3 last.
 * Derived from the precomputed `sprite.exitAt` so the wall's last window ends exactly on
 * `wallScatter.end`.
 */
export function exitDelay(sprite: WallSprite): number {
  const usable = SEGMENTS.wallScatter.end - SEGMENTS.wallScatter.start - ENTRY_WINDOW;
  return usable > 0 ? (sprite.exitAt - SEGMENTS.wallScatter.start) / usable : 0;
}

/** Where the sprite's exit begins, in progress units. */
export function exitStart(sprite: WallSprite): number {
  return sprite.exitAt;
}

/**
 * The exit destination for a sprite: the point along its centre ray just outside the
 * exclusion box, plus `EXIT_MARGIN` × its own half-size (so the whole head clears the page)
 * and a small outward drift that is larger for the inner rings (whose settled points sit
 * close to the centre, so they must travel further to clear the book).
 *
 * Both quantities are measured along the SAME ray, so every sprite — inside or already
 * outside the box — ends strictly clear of it, and the motion is always continuous.
 *
 * The sprite's half-size is `sprite.size × 9.4vw / 2` in x and a comparable fraction in y
 * (`vw/vh` are treated as roughly square at the target ratios). Returns viewport fractions
 * from the centre.
 */
export function exitDestination(
  sprite: WallSprite,
  box: Exclusion
): { x: number; y: number; opacity: number } {
  const { x: baseX, y: baseY } = settledPosition(sprite);
  const radius = Math.hypot(baseX, baseY);
  const dirX = radius < 1e-6 ? Math.cos(sprite.angle) : baseX / radius;
  const dirY = radius < 1e-6 ? Math.sin(sprite.angle) : baseY / radius;

  // Half-size in viewport fraction: `clamp(46px, size * 9.4vw, size * 170px)`. Approximate
  // with the vw term (the clamps only bite at the extremes) and treat vw ≈ vh.
  const halfSize = (sprite.size * 9.4) / 100 / 2;
  const margin = halfSize * EXIT_MARGIN;

  // Radius along the ray at which it crosses the box boundary (Infinity if parallel).
  const tx = Math.abs(dirX) < 1e-6 ? Infinity : box.hw / Math.abs(dirX);
  const ty = Math.abs(dirY) < 1e-6 ? Infinity : box.hh / Math.abs(dirY);
  const boxRadius = Math.min(tx, ty);

  // Target radius along the ray. The box radius is the hard minimum (the point must clear
  // the book); the per-ring drift is a gentle extra outward push. Keeping the inner ring's
  // drift at zero bounds the total travel — and therefore the per-frame speed — so the exit
  // never reads as a jump (Plan 11 §5 continuity).
  const drift = 0.02 + (sprite.ring / (RING_COUNTS.length - 1)) * 0.03;
  const target = Math.max(radius, boxRadius) + margin + drift;

  const x = dirX * target;
  const y = dirY * target;

  // Sprites whose destination is still inside the viewport stay visible (they ring the
  // book); those that end off screen fade to 0 so nothing pops at the edge.
  const onScreen = Math.abs(x) < 0.62 && Math.abs(y) < 0.62;
  return { x, y, opacity: onScreen ? sprite.finalOpacity : 0 };
}

export type WallPose = {
  transform: string;
  opacity: number;
  exitDestination: { x: number; y: number; opacity: number };
};

/**
 * The eased exit progress for a sprite in `[0, 1]`: the same `smoothstep` easing and the
 * same per-sprite window (`ENTRY_WINDOW`) as the entrance, staggered across `wallScatter`
 * in reverse ring order.
 */
export function exitProgress(sprite: WallSprite, progress: number): number {
  return smoothstep(clamp01((progress - exitStart(sprite)) / ENTRY_WINDOW));
}

/**
 * The full pose of a sprite at a given `progress` (transform string + opacity), the single
 * source of truth for both the `transform` and `opacity` MotionValues.
 */
export function poseAt(
  sprite: WallSprite,
  progress: number,
  box: Exclusion,
  destination: { x: number; y: number; opacity: number } = exitDestination(sprite, box)
): WallPose {
  const g = clamp01(
    (progress - SEGMENTS.bloomGrow.start) / (SEGMENTS.wallFull.end - SEGMENTS.bloomGrow.start)
  );
  // `g` is normalised over the bloom→wall span, so the entry window here is the fraction
  // `0.26` of that span (= `ENTRY_WINDOW` expressed in progress units).
  const appear = smoothstep(clamp01((g - sprite.delay) / 0.26));
  const e = exitProgress(sprite, progress);

  const { x: settledX, y: settledY } = settledPosition(sprite);
  // Entrance grows the sprite out from 35 % of its settled distance; the exit interpolates
  // from the FULL settled position to the precomputed destination (never a direct write).
  const grownX = settledX * (0.35 + 0.65 * appear);
  const grownY = settledY * (0.35 + 0.65 * appear);
  const x = grownX + (destination.x - grownX) * e;
  const y = grownY + (destination.y - grownY) * e;

  const scale = sprite.scale * (0.4 + 0.6 * appear) * (1 - 0.15 * e);
  const rotate = sprite.rotate + e * (sprite.rotate > 0 ? 8 : -8);
  const opacity = appear * (1 - e * (1 - destination.opacity));

  return {
    transform: `translate3d(${(x * 100).toFixed(3)}vw, ${(y * 100).toFixed(
      3
    )}vh, 0) rotate(${rotate.toFixed(3)}deg) scale(${scale.toFixed(4)})`,
    opacity,
    exitDestination: destination,
  };
}
