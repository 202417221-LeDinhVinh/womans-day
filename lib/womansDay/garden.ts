/**
 * The garden spread's planting model (Plan 15 §2.2). Pure and tested: given a tap point on
 * the page and the flowers already planted, produce the next `Planted` entry. The geometry
 * is in page percentages so the same model drives the desktop right page, the mobile page
 * and a turning-leaf copy identically.
 *
 * Nothing here touches the DOM — the component maps a `Planted` to an anchor and a head.
 */

import { FLOWERS, type FlowerId } from "@/lib/womansDay/flowers";

export type Planted = {
  /** Unique per plant so a copy in a leaf and the base share identity. */
  key: string;
  id: FlowerId;
  /** Base x, % of page width (where the stem meets the soil). */
  x: number;
  /** 0 (back of the ground band) … 1 (front edge). Drives scale, z and base y. */
  depth: number;
  /** Head centre, % of page height. */
  headY: number;
  /** −8…8 deg, seeded. */
  tilt: number;
  /** Seeded: drives leaf side, sway phase and the crumb scatter. */
  seed: number;
};

/** The garden is capped; the oldest flower wilts past this. */
export const MAX_PLANTED = 18;

/** The ground band is the bottom fraction of the page (Plan 15 §2.1). */
export const GROUND_BAND = 0.24;

/** Stem length limits, as a fraction of page height (Plan 15 §2.2). */
export const MIN_STEM = 0.14;
export const MAX_STEM = 0.62;

/** Head centre y must stay at least this far from the top (fraction of page height). */
export const HEAD_TOP_MARGIN = 0.14;

/** localStorage key. */
export const GARDEN_STORAGE_KEY = "womans-day:garden";

let counter = 0;

/** A small deterministic PRNG so the same click produces the same flower. */
function seeded(seed: number): () => number {
  let state = (seed || 1) >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function nextPlantKey(id: FlowerId): string {
  counter += 1;
  return `${id}-${Date.now().toString(36)}-${counter.toString(36)}`;
}

/**
 * The base y (page height-%) for a plant at `depth`. The soil art's visible band is the
 * bottom ~20 % of a 24 % ground strip, so bases sit near the very bottom: depth 0 → ~86 %,
 * depth 1 → ~95 %. This keeps every stem base inside the painted soil (Plan 15 §2.3).
 */
export function baseYFor(depth: number, bandHeight: number): number {
  const groundTop = 100 - bandHeight * 100;
  const soilTop = groundTop + bandHeight * 100 * 0.4;
  return soilTop + Math.max(0, Math.min(1, depth)) * (100 - soilTop) * 0.75;
}

/** Head width (cqw) scaled by depth. */
export function headWidthForDepth(depth: number): number {
  return 15 + 7 * Math.max(0, Math.min(1, depth));
}

/** z-index so nearer plants overlap farther ones. */
export function zForDepth(depth: number): number {
  return Math.round(100 + depth * 100);
}

/**
 * Plant a flower at a tap point (page %, `cx`/`cy`). `bandHeight` is `GROUND_BAND` as a
 * fraction. The click above the band gives a stem to the tapped head point; a click inside
 * the band places a short flower front-of-band. The head is never nearer the top than
 * `HEAD_TOP_MARGIN`, and the stem length is clamped to `[MIN_STEM, MAX_STEM]`.
 *
 * A new plant too close to an existing head is nudged sideways to the nearest free x (a tap
 * is never refused).
 */
export function plantAt(
  cx: number,
  cy: number,
  existing: readonly Planted[],
  flowerId: FlowerId,
  bandHeight: number = GROUND_BAND
): Planted {
  const groundTop = 100 - bandHeight * 100;
  const seed = Math.floor(Math.abs(cx * 7.1 + cy * 13.3 + existing.length * 31.7) * 1000) + 1;
  const rand = seeded(seed);
  const x = Math.max(4, Math.min(96, cx));

  const insideBand = cy >= groundTop;
  const depth = insideBand
    ? Math.max(0.15, Math.min(1, (cy - groundTop) / (bandHeight * 100)))
    : 0.15 + rand() * 0.45;

  const baseY = baseYFor(depth, bandHeight);
  // Head y: above the band → the tapped point (clamped); inside the band → a default height
  // for the depth (a short flower in front).
  let headY = insideBand ? baseY - (18 + 22 * depth) : cy;
  headY = Math.max(HEAD_TOP_MARGIN * 100, Math.min(baseY - MIN_STEM * 100, headY));
  // Clamp the stem length.
  if (baseY - headY > MAX_STEM * 100) headY = baseY - MAX_STEM * 100;
  if (baseY - headY < MIN_STEM * 100) headY = baseY - MIN_STEM * 100;

  const tilt = (rand() * 2 - 1) * 8;
  const head = { x, headY };
  const placed = nudgeAway(head, existing, headWidthForDepth(depth));

  return {
    key: nextPlantKey(flowerId),
    id: flowerId,
    x: Math.max(4, Math.min(96, placed.x)),
    depth,
    headY: placed.headY,
    tilt,
    seed,
  };
}

/** Pixels-as-percent: minimum head separation is a fraction of the head width (cqw/2). */
const MIN_HEAD_GAP = 0.45;

/**
 * Nudge a head sideways until it is at least `MIN_HEAD_GAP × headWidth` from every existing
 * head at a similar height, scanning outward in small steps. Never refuses a tap.
 */
function nudgeAway(
  head: { x: number; headY: number },
  existing: readonly Planted[],
  headWidth: number
): { x: number; headY: number } {
  const minGap = MIN_HEAD_GAP * (headWidth / 2);
  const clashes = (x: number, y: number) =>
    existing.some(
      (plant) => Math.abs(plant.x - x) < minGap && Math.abs(plant.headY - y) < minGap * 1.2
    );
  if (!clashes(head.x, head.headY)) return head;
  for (let step = 1; step <= 24; step += 1) {
    const offset = step * (headWidth / 2);
    for (const candidate of [head.x - offset, head.x + offset]) {
      const x = Math.max(4, Math.min(96, candidate));
      if (!clashes(x, head.headY)) return { x, headY: head.headY };
    }
  }
  return head;
}

/**
 * The oldest flower wilts when the cap is exceeded: return the planted list grown by one and
 * trimmed to `MAX_PLANTED` (dropping from the FRONT — the oldest). The component plays the
 * wilt animation for the returned `wilted` key.
 */
export function growGarden(
  planted: readonly Planted[],
  plant: Planted
): { next: Planted[]; wilted: Planted | null } {
  const grown = [...planted, plant];
  if (grown.length <= MAX_PLANTED) return { next: grown, wilted: null };
  const [wilted, ...rest] = grown;
  return { next: rest, wilted };
}

/** Choose a deterministic flower for a plant (default = the reader's own is handled by the caller). */
export function surpriseFlower(seed: number): FlowerId {
  const rand = seeded(seed);
  return FLOWERS[Math.floor(rand() * FLOWERS.length)].id;
}

/** localStorage is untrusted: keep only well-formed entries. */
export function parseGarden(raw: string | null): Planted[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const known = new Set(FLOWERS.map((flower) => flower.id));
  const out: Planted[] = [];
  const keys = new Set<string>();
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    if (typeof record.id !== "string" || !known.has(record.id as FlowerId)) continue;
    const numbers = [record.x, record.depth, record.headY, record.tilt, record.seed];
    if (!numbers.every((value) => typeof value === "number" && Number.isFinite(value))) continue;
    const key =
      typeof record.key === "string" && record.key.length > 0 && record.key.length <= 80
        ? record.key
        : `garden-${out.length}`;
    if (keys.has(key)) continue;
    keys.add(key);
    out.push({
      key,
      id: record.id as FlowerId,
      x: Math.max(4, Math.min(96, record.x as number)),
      depth: Math.max(0, Math.min(1, record.depth as number)),
      headY: Math.max(0, Math.min(100, record.headY as number)),
      tilt: Math.max(-8, Math.min(8, record.tilt as number)),
      seed: record.seed as number,
    });
    if (out.length >= MAX_PLANTED) break;
  }
  return out;
}

export function serializeGarden(planted: readonly Planted[]): string {
  return JSON.stringify(planted);
}
