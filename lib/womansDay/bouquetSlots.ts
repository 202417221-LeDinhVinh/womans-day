import type { FillerId, FlowerId } from "@/lib/womansDay/flowers";

/**
 * The bouquet arrangement, derived from the measured cone art.
 *
 * MEASUREMENTS (alpha silhouette of `public/womans-day/wrap/*.webp`, all four share one
 * silhouette within ~1 %; sizes recorded so this can be re-checked):
 *   kraft  396×903  bbox 370×876  mouth (widest row) at 21.8 % of the bbox height
 *   blush  330×883  bbox 304×856  ... 19.2 %
 *   sage   326×893  bbox 300×866  ... 19.6 %
 *   linen  335×896  bbox 309×868  ... 20.9 %
 * The cone is a tall triangle: ~20 % down is the OPENING (widest), tapering to a point at
 * the bottom. Drawn in `WrapLayer` as `object-contain` inside a box `inset-x-0
 * bottom-[-6%] h-[78%]` of the 4:5 canvas, so the drawn image height = 78 % of canvas
 * height and its width = 78 % × canvasH × (imgW/imgH) ≈ 43 % of canvas width, centred.
 *
 * RIM POLYLINE (Plan 12). The wrap is split into a BACK (the full art, drawn behind the
 * flowers) and a FRONT LIP (`wrap/<id>-front.webp`, drawn in front of them). The lip's top
 * edge is the front fold located on kraft and sage (vision read of the fold); stored here
 * as image-fraction points (x, y) of the trimmed art so `rimY()` and
 * `scripts/womans-day/make-wrap-lip.ts` cannot drift:
 *
 *   left corner (0.036, 0.216) → lowest front point (0.545, 0.315) → right corner (0.96, 0.216)
 *
 * Below it is paper; above it the tall back flap and the interior are visible, so greenery
 * and the lower ring of heads read as drawn IN FRONT of the back. The lower ring of heads
 * can now sit at the rim and be TUCKED behind the lip (their bottoms hidden) instead of
 * needing their whole height of free space above the rim — the missing ingredient for
 * "natural" and "not too far on top".
 *
 * Canvas model: percentages of the 4:5 canvas. `x` is width-%, `y` height-%. Because the
 * canvas is 4:5, 1 % of width = 0.8 % of height — every unit conversion uses that.
 */
export type BouquetSlot = {
  /** Head centre, percent of canvas WIDTH (x) / HEIGHT (y). */
  x: number;
  y: number;
  rotate: number;
  scale: number;
  z: number;
};

/** The cone image box as fractions of the canvas, matching `WrapLayer`'s natural height. */
export const CONE_BOX = { bottom: -0.06, height: 0.78 } as const;

/** Cone image aspect (width ÷ height) measured from the kraft art (396 / 903). */
export const CONE_ASPECT = 396 / 903;

/** Canvas aspect (width ÷ height) — the bouquet canvas is `aspect-[4/5]`. */
export const CANVAS_ASPECT = 4 / 5;

/** Drawn cone width as a percent of canvas WIDTH at the natural (unstretched) box. */
export function coneWidthPercent(): number {
  // image height (canvasH%) = 78; image width = 78 × (canvasH/canvasW) × CONE_ASPECT
  // canvasH/canvasW = 1/CANVAS_ASPECT = 1.25
  return CONE_BOX.height * 100 * (1 / CANVAS_ASPECT) * CONE_ASPECT;
}

/**
 * The wrap's vertical anchors, fixed for EVERY arrangement (Plan 14 §3, R3): the box keeps
 * its natural 78 % height with its bottom edge at canvas y = 106, so the cone tip stays in
 * the hand and the rim never jumps between counts. Only the WIDTH (a horizontal stretch)
 * changes with the bunch.
 */
const CONE_BOX_BOTTOM_Y = 100 - CONE_BOX.bottom * 100; // 106
const CONE_BOX_HEIGHT = CONE_BOX.height * 100; // 78

/**
 * The front-lip rim polyline in IMAGE-fraction coordinates (x, y of the trimmed art).
 * MUST stay in sync with `scripts/womans-day/make-wrap-lip.ts`.
 */
export const RIM_POLYLINE: ReadonlyArray<readonly [number, number]> = [
  [0.036, 0.216],
  [0.545, 0.315],
  [0.96, 0.216],
];

/** The lip's corner points in image-fraction coordinates (the mouth's left/right/y). */
export const MOUTH_FRAC = { left: 0.036, right: 0.96, y: 0.216 } as const;

/** Rim coordinate (image fraction x/y of the trimmed art) at the box's horizontal centre. */
export const RIM_CENTRE_FRAC = {
  x: (MOUTH_FRAC.left + MOUTH_FRAC.right) / 2,
  y: RIM_POLYLINE[1][1],
};

/** The cone's tip, as an image fraction of the box (the point of the wrapper). */
export const TIP_FRAC_Y = 1;

function rimImageFraction(fx: number): number {
  const [[ax, ay], [bx, by], [cx, cy]] = RIM_POLYLINE;
  if (fx <= bx) return ay + ((by - ay) * (fx - ax)) / (bx - ax);
  return by + ((cy - by) * (fx - bx)) / (cx - bx);
}

/**
 * The rim the LAYOUT is authored against: the front lip's top edge at canvas width-% `x`
 * for the natural (unstretched) box, as a canvas height-%. Every head and every spray base
 * is placed against this line (R6), and `wrapFitFor(...).rimY` reproduces the same rim
 * numerics once the box is drawn, so layout and render cannot disagree (R1).
 */
export function rimY(x: number): number {
  const coneWidth = coneWidthPercent();
  const left = 50 - coneWidth / 2;
  const fx = Math.max(0, Math.min(1, (x - left) / coneWidth));
  return 28 + rimImageFraction(fx) * CONE_BOX_HEIGHT; // 28 = box top at the natural box
}

/** The rim at the box centre — the line the layout is authored against. ≈ 51.9. */
export const RIM_Y = rimY(50);

/**
 * The drawn wrap as ONE geometry source (Plan 14). The back and the front lip share this
 * box EXACTLY; only the vertical anchors are fixed (R3) and the WIDTH is fitted to the
 * lower ring of heads (R2) within a horizontal stretch cap (R4).
 */
export type WrapFit = {
  /** Drawn wrap box in canvas-%: x = width-%, y = height-%. Back and lip share it. */
  box: { left: number; top: number; width: number; height: number };
  /** Top edge of the front lip at canvas x (height-%). Outside the mouth → +Infinity. */
  rimY: (x: number) => number;
  /** Binding point B on the axis, at image fraction `fy` of the box (the cone neck, R5). */
  binding: { x: number; y: number };
  /** The bow: drawn width (width-%) and its top edge (height-%). */
  bow: { width: number; top: number };
};

/**
 * How much wider than a head's own width the lower ring spills past the paper (R2): the
 * outermost lower-ring head CENTRE sits this fraction of a head inside the mouth edge, so
 * its outer half spills naturally over the lip.
 */
const MOUTH_SPILL = 0.6;

/**
 * The horizontal stretch limits (R4) of the painted cone. `naturalWidth` is the art's drawn
 * width at the fixed 78 % height (42.76 width-%); a bunch wider than the art stretches it
 * up to `STRETCH_MAX`, past which the outer heads just overhang more.
 */
const STRETCH_MIN = 0.9;
const STRETCH_MAX = 1.3;

/** Binding point B at this image-fraction y of the drawn box (R5) — well below the rim. */
const BINDING_FY = 0.42;

/** The bow's drawn width as a fraction of the cone's width at B (R5). */
const BOW_W_RATIO = 0.7;

/**
 * `wrapFitFor(headCount, fillerCount)` — the ONE source of the drawn wrap geometry.
 *
 * The layout places heads and greenery against `RIM_Y` at scale 1; this returns the box,
 * the drawn rim, B and the bow that keep that intent true at any count (Plan 14, R1–R6):
 *   - R1/R3: the box height and bottom are FIXED, so the drawn rim reproduces `RIM_Y` and
 *     the tip stays at y = 106 for every count.
 *   - R2: mouth width = var(mouthMin = 1.1 × w(1)) `max(mouthMin, lowerRingCentreSpan +
 *     MOUTH_SPILL × w × s̄)`, where the lower ring is rank 0 plus every head with
 *     `y ≥ focal.y − 0.25 h`.
 *   - R4: horizontal stretch `sx = drawnWidth / coneWidthPercent()` is clamped [0.9, 1.3].
 *   - R5: B sits at image fraction 0.42 of the box; bow width = 0.7 × the cone width at B.
 *
 * `fillerCount` is part of the signature for the caller's contract (greenery never widens the
 * wrap — R6 — so it does not affect the fit), hence the leading underscore.
 */
export function wrapFitFor(headCount: number, _fillerCount = 0): WrapFit {
  const count = Math.max(0, Math.min(MAX_BOUQUET, Math.floor(headCount)));
  const heads = count > 0 ? layoutFor(count) : [];
  const w = headWidthFor(Math.max(1, count));
  const h = w * HEAD_H_OVER_W;

  // The lower ring: rank 0 plus every head at or below the focal (within a quarter head).
  const focal = heads[0];
  const lowerRing =
    focal === undefined ? [] : heads.filter((slot, i) => i === 0 || slot.y >= focal.y - 0.25 * h);
  const mouth = (() => {
    if (lowerRing.length === 0) return 1.1 * w; // heads = 0 (greenery only): 1-head width
    // The lower-ring CENTRE span (head centre to head centre — no half-widths), plus one
    // spill of the outermost heads' own width so their outer halves lean over the paper.
    let minCentre = Infinity;
    let maxCentre = -Infinity;
    let minScale = 1;
    let maxScale = 1;
    for (const slot of lowerRing) {
      if (slot.x < minCentre) {
        minCentre = slot.x;
        minScale = slot.scale;
      }
      if (slot.x > maxCentre) {
        maxCentre = slot.x;
        maxScale = slot.scale;
      }
    }
    const span = maxCentre - minCentre; // lowerRingCentreSpan
    const outerScale = Math.max(minScale, maxScale);
    return span + MOUTH_SPILL * w * outerScale;
  })();
  const mouthMin = 1.1 * headWidthFor(1);
  const mouthWidth = Math.max(mouthMin, mouth);

  // R4: convert the mouth to a box width, then clamp the horizontal stretch.
  const mouthFrac = MOUTH_FRAC.right - MOUTH_FRAC.left; // 0.924
  const naturalWidth = coneWidthPercent();
  let width = mouthWidth / mouthFrac;
  const stretch = width / naturalWidth;
  if (stretch < STRETCH_MIN) width = naturalWidth * STRETCH_MIN;
  else if (stretch > STRETCH_MAX) width = naturalWidth * STRETCH_MAX;

  const boxLeft = 50 - width / 2;
  const height = CONE_BOX_HEIGHT;
  const top = CONE_BOX_BOTTOM_Y - height; // 28

  const box = { left: boxLeft, top, width, height };

  const rimYFit = (x: number): number => {
    const fx = (x - boxLeft) / width;
    if (fx < MOUTH_FRAC.left || fx > MOUTH_FRAC.right) return Infinity;
    return top + rimImageFraction(fx) * height;
  };

  const binding = { x: 50, y: top + BINDING_FY * height };

  // The cone silhouette is a triangle from the mouth row (image fraction MOUTH_FRAC.y, at
  // 0.924 × box width) to the tip (TIP_FRAC_Y, at 0 width). The width AT B (image fraction
  // BINDING_FY) is the triangle's width interpolated to B's height.
  const widthAtFy = (fy: number): number => {
    const mouthY = MOUTH_FRAC.y;
    const t = (fy - mouthY) / (TIP_FRAC_Y - mouthY); // 0 at the mouth row, 1 at the tip
    return width * mouthFrac * Math.max(0, 1 - t);
  };
  const bowWidth = Math.max(2, BOW_W_RATIO * widthAtFy(BINDING_FY));
  const bowTop = binding.y; // the ribbon is tied at B; `top` is the image's top edge
  const bow = { width: bowWidth, top: bowTop };

  return { box, rimY: rimYFit, binding, bow };
}

/**
 * Head size by count, in cqw (i.e. % of canvas width). A painted head is ~square, so its
 * height ≈ 0.8 × its width in canvas height-%. A full dome needs smaller heads or it
 * cannot fit the mouth; a lone flower is the largest. The owner rejected 15 cqw as "too
 * small" (Plan 10), so the floor is 21.
 */
const HEAD_WIDTH_BY_COUNT: Readonly<Record<number, number>> = {
  1: 34,
  2: 31,
  3: 29,
  4: 27,
  5: 26,
  6: 25,
  7: 24,
  8: 23,
  9: 22,
};

/** Head width (cqw) for a bouquet of `count` heads; non-increasing, floored at 21. */
export function headWidthFor(count: number): number {
  const clamped = Math.max(1, Math.min(9, Math.floor(count)));
  return Math.max(21, HEAD_WIDTH_BY_COUNT[clamped] ?? 21);
}

/** Head height in canvas height-% (a head's height ≈ 0.8 × its width in those units). */
const HEAD_H_OVER_W = CANVAS_ASPECT; // 0.8

/**
 * A head's authored position in DOME UNITS relative to the focal head (Plan 12 §3):
 *   u = x offset in head widths, v = rise in head heights (positive = up), s = scale.
 * Canvas position is `x = 50 + u·w`, `y = yF − v·h`. Rank 0 is the focal head (or, for a
 * two-flower bouquet, the first of the two). Mirrored heads are authored as exact ±u pairs,
 * so the table is symmetric and the dome reads straight on the axis for every count.
 *
 * The lowest ring has `v ≈ −0.1 … −0.3` so those heads sit at the rim and are tucked behind
 * the front lip, rather than needing free space above it.
 */
type DomeHead = readonly [u: number, v: number, s: number];

const DOME_TABLE: Readonly<Record<number, readonly DomeHead[]>> = {
  1: [[0, 0, 1]],
  2: [
    [-0.36, 0, 1],
    [0.36, 0, 0.96],
  ],
  3: [
    [0, 0.12, 1.04],
    [-0.56, 0.0, 0.95],
    [0.56, 0.0, 0.95],
  ],
  4: [
    [0, 0.2, 1.04],
    [-0.64, 0.0, 0.95],
    [0.64, 0.0, 0.95],
    [0, 0.95, 0.9],
  ],
  5: [
    [0, 0.25, 1.04],
    [-0.6, 0.02, 0.95],
    [0.6, 0.02, 0.95],
    [-0.48, 0.85, 0.92],
    [0.48, 0.85, 0.92],
  ],
  6: [
    [0, 0.1, 1.04],
    [0, 1.0, 0.9],
    [-0.7, 0.6, 0.93],
    [0.7, 0.6, 0.93],
    [-0.52, -0.08, 0.95],
    [0.52, -0.08, 0.95],
  ],
  7: [
    [0, 0.2, 1.04],
    [-0.58, 0.95, 0.9],
    [0.58, 0.95, 0.9],
    [-0.92, 0.35, 0.94],
    [0.92, 0.35, 0.94],
    [-0.5, -0.06, 0.94],
    [0.5, -0.06, 0.94],
  ],
  8: [
    [0, 0.25, 1.04],
    [0, 1.28, 0.86],
    [-0.72, 0.85, 0.9],
    [0.72, 0.85, 0.9],
    [-1.0, 0.3, 0.94],
    [1.0, 0.3, 0.94],
    [-0.52, -0.07, 0.93],
    [0.52, -0.07, 0.93],
  ],
  9: [
    [0, 0.25, 1.04],
    [-0.62, 1.0, 0.88],
    [0.62, 1.0, 0.88],
    [-1.02, 0.55, 0.92],
    [1.02, 0.55, 0.92],
    [-0.9, 0.1, 0.93],
    [0.9, 0.1, 0.93],
    [-0.44, -0.03, 0.92],
    [0.44, -0.03, 0.92],
  ],
};

/**
 * A deterministic per-"row" jitter (from a cheap hash of the row index, NOT the species) so
 * the dome does not read as stamped. A mirrored pair shares the same row jitter, so its y
 * matches and only the rotate sign flips — the dome stays exactly mirror-balanced.
 */
function rowJitter(row: number): { dy: number; dr: number } {
  let h = Math.imul(row + 1, 2654435761) >>> 0;
  h ^= h >>> 15;
  const a = (h % 1000) / 1000; // 0..1
  const b = ((h >>> 10) % 1000) / 1000;
  return { dy: (a * 2 - 1) * 1, dr: b * 2 - 1 };
}

/**
 * Build the authored dome for `count` heads (no depth assigned yet). Mirror pairs are
 * authored adjacently (left then right, same `u` magnitude) so the row index is shared and
 * the pair is an EXACT mirror in x/y/scale/|rotate|.
 */
function buildDome(count: number): BouquetSlot[] {
  const table = DOME_TABLE[count] ?? DOME_TABLE[1];
  const w = headWidthFor(count);
  const h = w * HEAD_H_OVER_W;
  // The focal centre sits just IN the mouth, only its lower ~28 % tucked behind the lip, so
  // it stays clearly visible while reading as rooted in the paper (not floating above).
  const yF = RIM_Y - 0.28 * h;
  // Keep the dome from spilling far past the paper: clamp the widest head's edge to ~1.25×
  // the mouth half-width, scaling all `u` by the same factor so the mirror symmetry holds.
  const mouthHalf = coneWidthPercent() / 2;
  const widestEdge = Math.max(...table.map(([u, s]) => Math.abs(u) * w + (w * s) / 2));
  const uScale = Math.min(1, (1.25 * mouthHalf) / Math.max(widestEdge, 0.001));
  const seenRow = new Map<string, number>();
  return table.map(([uRaw, v, s], rank) => {
    const u = uRaw * uScale;
    const rowKey = `${Math.round(v * 20)}`;
    if (!seenRow.has(rowKey)) seenRow.set(rowKey, seenRow.size);
    const row = seenRow.get(rowKey) as number;
    const { dy, dr } = rowJitter(row);
    const side = u < 0 ? -1 : 1;
    const isFocal = rank === 0;
    const axial = Math.abs(u) < 0.0001;
    return {
      x: 50 + u * w,
      y: yF - v * h + (isFocal ? 0 : dy),
      // Axial heads take a fixed tiny tilt (no mirrored jitter, so the axis stays exact).
      rotate: axial ? (isFocal ? 0 : 2) : side * (6 + 10 * Math.abs(u)) + side * dr * 3,
      scale: s,
      z: 0,
    };
  });
}

/**
 * Depth `z` from `y` (lower on the canvas = in front = higher z, strictly monotonic), with
 * the focal head raised one step above its ring so it never loses its face to a ring head.
 */
function assignDepth(slots: BouquetSlot[]): void {
  for (const slot of slots) slot.z = 30 + slot.y;
  if (slots.length > 0) {
    const maxZ = Math.max(...slots.map((slot) => slot.z));
    slots[0].z = maxZ + 1;
  }
}

/**
 * `BOUQUET_SLOTS[rank]` — the NOMINAL position of a rank for a full nine-head dome, for
 * the FALLBACK geometry (a rank whose count is not known). For rendering and cone sizing
 * always use `layoutFor(count)`, the balanced per-count layout.
 */
export const BOUQUET_SLOTS: readonly BouquetSlot[] = (() => {
  const slots = buildDome(9);
  assignDepth(slots);
  return slots;
})();

export const MAX_BOUQUET = BOUQUET_SLOTS.length; // 9

/** The rear/fallback head width, matching the full dome. */
export const HEAD_BASE_CQW = headWidthFor(MAX_BOUQUET); // 22

/**
 * The tucked rosette dome for a bouquet of `count` heads: one entry per rank, the focal
 * flower (rank 0) at the heart on the axis, a ring around it, the lowest outer heads
 * tucked behind the front lip. Mirror-symmetric about x = 50 for every count.
 */
export function layoutFor(count: number): BouquetSlot[] {
  const clamped = Math.max(0, Math.min(MAX_BOUQUET, Math.floor(count)));
  if (clamped === 0) return [];
  const slots = buildDome(clamped);
  assignDepth(slots);
  return slots;
}

/**
 * The ORDER of the given items, sorted by their stored rank (`slot`) ascending. The stored
 * ranks can have GAPS — `removeStem` leaves holes, a gift link or an older localStorage
 * bouquet may be sparse — but `layoutFor(count)` returns exactly `count` positions indexed
 * 0..count-1. Position an item by its index in this order instead, so the dome stays
 * balanced while the stored ranks are left untouched.
 */
export function rankOrder<T extends { slot: number }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.slot - b.slot);
}

/**
 * The balanced layout entry for each item, in the SAME order as `items`. Item `i` gets
 * `layoutFor(items.length)[i]` where `i` is the item's position among the sorted ranks, so
 * rank gaps never collapse the dome.
 */
export function layoutForItems<T extends { slot: number }>(items: readonly T[]): BouquetSlot[] {
  const layout = layoutFor(items.length);
  const order = rankOrder(items);
  return items.map((item) => {
    const index = order.indexOf(item);
    const base = layout[index] ?? layout[layout.length - 1] ?? BOUQUET_SLOTS[0];
    return applyOffset(base, item as { dx?: number; dy?: number; rot?: number });
  });
}

/**
 * Stem placement from the binding point to a head.
 *
 * Returns `{ angle, length }`: `angle` is the rotation (degrees) of a stem whose own zero
 * is straight up, and `length` is the distance from B to the head as a percent of canvas
 * HEIGHT. The horizontal delta is converted from width-% to height-% (×0.8) before the
 * angle is taken, so the stem actually points at its head.
 */
export function stemFromBinding(
  head: { x: number; y: number },
  binding: { x: number; y: number }
): { angle: number; length: number } {
  const dx = (head.x - binding.x) * CANVAS_ASPECT; // width-% → height-%
  const dy = binding.y - head.y; // both already height-%; positive = above B
  const angle = (Math.atan2(dx, dy) * 180) / Math.PI;
  const length = Math.hypot(dx, dy);
  return { angle, length };
}

/** The widest extent (canvas width-%) of a layout, INCLUDING head half-widths. */
export function domeWidth(slots: readonly BouquetSlot[], count: number): number {
  if (slots.length === 0) return 0;
  const w = headWidthFor(count);
  let minX = 100;
  let maxX = 0;
  for (const entry of slots) {
    const half = (w * entry.scale) / 2;
    if (entry.x - half < minX) minX = entry.x - half;
    if (entry.x + half > maxX) maxX = entry.x + half;
  }
  return maxX - minX;
}

/* ---------------------------------------------------------------------- *
 * Greenery — one mirrored spray per filler, placed in the dome's gaps
 * ---------------------------------------------------------------------- */

/**
 * Per-species spray art: the drawn height is `len` × the head height, so a fern (wide) and
 * eucalyptus (tall) size by their own shape; baby's breath is "airy" and may sit between
 * heads. `flipRight` mirrors the art on the right side so both sides curve outward.
 */
export const FILLER_ART: Readonly<Record<FillerId, { len: number; airy?: boolean }>> = {
  eucalyptus: { len: 3.4 },
  fern: { len: 3.0 },
  "babys-breath": { len: 2.5, airy: true },
};

/** A placed spray: canvas base point, rotation (deg, 0 = up) and drawn height (height-%). */
export type FillerPlacement = {
  /** Base (bottom, the cut end) of the spray, canvas-% (x width, y height). */
  x: number;
  y: number;
  /** Rotation in degrees (0 = straight up; positive = leaning right). */
  angle: number;
  /** Drawn height of the spray art, percent of canvas HEIGHT. */
  length: number;
  /** Mirror the art horizontally (right-side sprays curve outward). */
  flip: boolean;
};

/**
 * Composition templates, by filler count: each entry is a spray at a base x offset from 50
 * (width-%), a rotation (deg from vertical) and a `lift` (how far up the dome, as a
 * fraction of the dome height, the base is raised — 0 = at the rim). A single-entry plan is
 * axial; multi-entry plans are ordered left-to-right and mirrored by construction.
 */
const GREENERY_PLANS: Readonly<
  Record<number, ReadonlyArray<{ ax: number; ang: number; lift: number }>>
> = {
  1: [{ ax: 0, ang: 3, lift: 0.12 }],
  2: [
    { ax: -4, ang: -34, lift: 0.06 },
    { ax: 4, ang: 34, lift: 0.06 },
  ],
  3: [
    { ax: 0, ang: 3, lift: 0.18 },
    { ax: -5, ang: -38, lift: 0.06 },
    { ax: 5, ang: 38, lift: 0.06 },
  ],
  4: [
    { ax: -4, ang: -30, lift: 0.08 },
    { ax: 4, ang: 30, lift: 0.08 },
    { ax: -7.5, ang: -58, lift: 0.0 },
    { ax: 7.5, ang: 58, lift: 0.0 },
  ],
  5: [
    { ax: 0, ang: 3, lift: 0.2 },
    { ax: -4, ang: -32, lift: 0.08 },
    { ax: 4, ang: 32, lift: 0.08 },
    { ax: -8, ang: -60, lift: 0.0 },
    { ax: 8, ang: 60, lift: 0.0 },
  ],
};

/** Largest spray drawn height (canvas height-%) that keeps its tip comfortably on-canvas. */
const MAX_SPRAY_LENGTH = 46;
/** How far inside the canvas edge a spray tip must stay. */
const SPRAY_TIP_MARGIN = 3;

/**
 * Where each spray goes, derived from the flower dome. Sprays fan from inside the mouth
 * (base points on the rim between x ≈ 42–58, never at B) into the gaps of the dome
 * silhouette, symmetric in whole mirror pairs. `fillerCount` sprays are placed; `headCount`
 * sizes the dome they frame (a small dome → tighter angles, so sprays frame the head).
 */
export function layoutFillersFor(fillerCount: number, headCount = MAX_BOUQUET): FillerPlacement[] {
  const count = Math.max(0, Math.min(MAX_FILLERS, Math.floor(fillerCount)));
  if (count === 0) return [];
  const heads = Math.max(0, Math.min(MAX_BOUQUET, Math.floor(headCount)));
  const w = headWidthFor(Math.max(1, heads));
  const h = w * HEAD_H_OVER_W;
  const dome = heads > 0 ? layoutFor(heads) : [];
  const crownY = dome.length > 0 ? Math.min(...dome.map((slot) => slot.y)) : RIM_Y - 0.5 * h;
  const domeHeight = Math.max(2 * h, RIM_Y - crownY);
  const rim = RIM_Y;
  // A small dome → tighten the fan so the sprays frame the head instead of standing alone.
  const tighten = heads <= 2 ? 0.62 : heads <= 4 ? 0.85 : 1;

  const plan = GREENERY_PLANS[Math.max(1, Math.min(5, count))];
  return plan.slice(0, count).map(({ ax, ang, lift }) => {
    // Base sits on/just below the rim so the cut end is hidden by the lip; a taller crown
    // spray lifts its base up the dome so it peeks above the crown.
    const y = Math.min(rim + 0.5, rim - lift * domeHeight);
    const angle = ang * (Math.abs(ang) > 4 ? tighten : 1);
    const art = FILLER_ART[spraySpecies(ax, count)];
    // Clamp the length so the tip stays on-canvas and never towers above the canvas top.
    const x = 50 + ax;
    let length = art.len * h;
    // tip = (x + sin(angle)*length*asp, y - cos(angle)*length)
    const sinA = Math.sin((angle * Math.PI) / 180);
    const cosA = Math.cos((angle * Math.PI) / 180);
    if (sinA !== 0) {
      const roomX =
        sinA > 0
          ? (100 - SPRAY_TIP_MARGIN - x) / (sinA * CANVAS_ASPECT)
          : (SPRAY_TIP_MARGIN - x) / (sinA * CANVAS_ASPECT);
      length = Math.min(length, Math.abs(roomX));
    }
    if (cosA > 0) length = Math.min(length, (y - SPRAY_TIP_MARGIN) / cosA);
    length = Math.min(length, MAX_SPRAY_LENGTH);
    return {
      x,
      y,
      angle,
      length: Math.max(8, length),
      flip: ax > 0,
    };
  });
}

/** Default species by spray position when the caller does not name them (used for sizing). */
function spraySpecies(ax: number, count: number): FillerId {
  if (Math.abs(ax) < 1 && count >= 3) return "babys-breath";
  if (Math.abs(ax) > 6) return "fern";
  return "eucalyptus";
}

/** Fillers used when the reader has not picked any (they still want a full bouquet). */
export const DEFAULT_FILLERS = ["eucalyptus", "fern", "babys-breath"] as const;

/** The bouquet is flowers AND greenery; the greenery cap is the filler plans, the flower
 *  cap is the nine dome slots. */
export const MAX_FILLERS = 5;

/** Nominal greenery positions (fallback) — used only where a per-count layout is not
 *  available. `layoutFillersFor` is the real source. */
export const FILLER_SLOTS: readonly BouquetSlot[] = GREENERY_PLANS[3].map(({ ax, ang }) => ({
  x: 50 + ax,
  y: RIM_Y - 2,
  rotate: ang,
  scale: 1,
  z: 8,
}));

/**
 * Fixed depth BANDS for the bouquet layers. Every layer lives inside its band.
 *
 * The wrap is TWO layers: an opaque BACK (full art) behind the flowers, and the FRONT LIP
 * (`wrap/<id>-front.webp`) in FRONT of them, so heads and greenery draw between the paper
 * and the lower ring of heads tucks behind the lip. Order:
 *   wrap-back 0 · greenery 10–19 · stems 20–29 · heads 30–59 · wrap-front 60 ·
 *   remove buttons 80–85 · ribbon 90.
 */
export const BAND = {
  wrapBack: 0,
  greenery: 10,
  greenerySpan: 9,
  stems: 20,
  stemsSpan: 10,
  heads: 30,
  headsSpan: 29,
  wrapFront: 60,
  removeTargets: 80,
  removeTargetsSpan: 5,
  ribbon: 90,
} as const;

/** Map a slot's 0–70 `z` into the heads band (30–59). */
export function headZ(slotZ: number): number {
  const clamped = Math.max(0, Math.min(70, slotZ));
  return BAND.heads + Math.round((clamped / 70) * BAND.headsSpan);
}

/** Greenery slot `z` (0–12) into the greenery band (10–19). */
export function fillerZ(slotZ: number): number {
  const clamped = Math.max(0, Math.min(12, slotZ));
  return BAND.greenery + Math.round((clamped / 12) * BAND.greenerySpan);
}

export type BouquetItem = {
  /** Unique per stem instance so duplicates of one species stay distinguishable. */
  key: string;
  id: FlowerId;
  slot: number;
  /**
   * Optional manual nudge over the computed layout slot: head-centre offset (canvas
   * width-% / height-%) and extra rotation (deg). The layout stays the source of truth —
   * offsets ride on top, so adding/removing flowers still re-balances the dome while a
   * custom nudge survives. `shuffle` (Rearrange) and `clear` reset them.
   */
  dx?: number;
  dy?: number;
  rot?: number;
};

/** Clamp limits for a manual head offset (canvas-%). */
export const OFFSET_X_RANGE = 42; // head centre x stays within [8, 92]
export const OFFSET_Y_RANGE = 60; // head centre y stays within [8, …]; clamped per render
export const OFFSET_ROT_RANGE = 50;

/** Clamp a manual offset to the allowed ranges (finite numbers only). */
export function clampOffset(value: number, range: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-range, Math.min(range, value));
}

/**
 * Apply an item's manual offset to its layout slot. `x`/`y` are clamped so the head centre
 * stays inside the canvas (`x ∈ [8, 92]`, `y ∈ [8, RIM_Y + 6]`), `rotate` gains `rot`
 * clamped to ±50°. The layout slot's `scale`/`z` are unchanged.
 */
export function applyOffset(
  slot: BouquetSlot,
  offset: { dx?: number; dy?: number; rot?: number }
): BouquetSlot {
  if (!offset.dx && !offset.dy && !offset.rot) return slot;
  const x = Math.max(8, Math.min(92, slot.x + clampOffset(offset.dx ?? 0, OFFSET_X_RANGE)));
  const y = Math.max(8, Math.min(RIM_Y + 6, slot.y + clampOffset(offset.dy ?? 0, OFFSET_Y_RANGE)));
  const rotate = Math.max(
    -OFFSET_ROT_RANGE,
    Math.min(OFFSET_ROT_RANGE, slot.rotate + clampOffset(offset.rot ?? 0, OFFSET_ROT_RANGE))
  );
  return { ...slot, x, y, rotate };
}

/**
 * Pre-place the reader's own flower in the centre, then fill outwards in insertion
 * order. Used for the parcel reveal and for a gift bouquet arriving from a link.
 */
export function withCenter(items: readonly BouquetItem[], centerId: FlowerId): BouquetItem[] {
  if (items.length === 0) {
    return [{ key: `${centerId}-center`, id: centerId, slot: 0 }];
  }
  return [...items];
}

/** The next free slot index, filling the centre first then outward. */
export function nextFreeSlot(items: readonly BouquetItem[]): number | null {
  const used = new Set(items.map((item) => item.slot));
  for (let slot = 0; slot < MAX_BOUQUET; slot += 1) {
    if (!used.has(slot)) return slot;
  }
  return null;
}

export function addStem(items: readonly BouquetItem[], id: FlowerId, key: string): BouquetItem[] {
  const slot = nextFreeSlot(items);
  if (slot === null) return [...items];
  return [...items, { key, id, slot }];
}

export function removeStem(items: readonly BouquetItem[], key: string): BouquetItem[] {
  return items.filter((item) => item.key !== key);
}

/**
 * Deal the existing stems back into the slot order on EVERY press (Plan 12 §5).
 *
 * Slot 0 (the centre) is the reader's hashed flower and MUST stay put. The remaining items
 * are ordered by their CURRENT rank, then rotated over the sorted ranks:
 *   item at sorted index `i` gets rank `1 + ((i + offset) % (n − 1))`.
 * Because the rest are ordered by rank first (not by array order), consecutive presses
 * produce a different arrangement each time (cycle length n − 1) — the previous version
 * rebuilt `rest` in array order the reducer never changed, so press 2+ recomputed press 1.
 * Gapped ranks compact into `1..n-1`. Fewer than three stems cannot move without moving the
 * centre, so they are returned unchanged (the button is disabled for them, too).
 */
export function rearrange(items: readonly BouquetItem[], offset = 1): BouquetItem[] {
  if (items.length < 3) return [...items];
  const centre = items.find((item) => item.slot === 0) ?? rankOrder(items)[0];
  const rest = rankOrder(items).filter((item) => item !== centre);
  if (!centre || rest.length < 2) return [...items];
  const n = rest.length;
  const shift = ((offset % n) + n) % n || 1;
  return [
    { ...centre, dx: undefined, dy: undefined, rot: undefined },
    ...rest.map((item, index) => ({
      ...item,
      slot: 1 + ((index + shift) % n),
      dx: undefined,
      dy: undefined,
      rot: undefined,
    })),
  ];
}

export function addFiller(
  fillers: readonly FillerId[],
  id: FillerId,
  max: number = MAX_FILLERS
): FillerId[] {
  if (fillers.length >= max) return [...fillers];
  return [...fillers, id];
}

export function removeFiller(fillers: readonly FillerId[], index: number): FillerId[] {
  return fillers.filter((_, at) => at !== index);
}
