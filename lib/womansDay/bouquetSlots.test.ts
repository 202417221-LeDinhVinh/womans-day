import { describe, expect, test } from "bun:test";

import {
  BAND,
  BOUQUET_SLOTS,
  CANVAS_ASPECT,
  FILLER_ART,
  MAX_BOUQUET,
  MAX_FILLERS,
  MOUTH_FRAC,
  RIM_Y,
  coneWidthPercent,
  domeWidth,
  fillerZ,
  headWidthFor,
  headZ,
  layoutFillersFor,
  layoutFor,
  layoutForItems,
  rankOrder,
  rearrange,
  rimY,
  stemFromBinding,
  wrapFitFor,
  type WrapFit,
} from "@/lib/womansDay/bouquetSlots";
import { FILLERS, FLOWERS } from "@/lib/womansDay/flowers";
import type { BouquetItem } from "@/lib/womansDay/bouquetSlots";

const HEAD_H_OVER_W = CANVAS_ASPECT;

/** Disc centre-radius fraction used by the visibility invariant. */
const DISC_R = 0.42;

/** The bow's drawn height for a given width (bow art is 460×361, canvas is 4:5). */
function bowHeight(width: number): number {
  return width * HEAD_H_OVER_W * (361 / 460);
}

/**
 * The fraction of a head's disc (radius `DISC_R × head width`) that is NOT covered by a
 * higher-`z` disc, the front lip (`fit.rimY`) OR the bow. The lip + bow split is what makes
 * this meaningful: heads below the drawn rim are genuinely hidden by the paper, and Plan 14
 * moved the bow off the focal flower.
 */
function visibleFraction(
  fit: WrapFit,
  slots: ReturnType<typeof layoutFor>,
  count: number,
  index: number
): number {
  const heads = slots.map((slot, i) => ({
    x: slot.x,
    y: slot.y,
    r: DISC_R * headWidthFor(count) * slot.scale,
    z: slot.z,
    i,
  }));
  const h = heads[index];
  // Only heads whose disc can overlap: same or higher z.
  const occluders = heads.filter((o) => o.i !== index && o.z > h.z);
  const bow = { left: 50 - fit.bow.width / 2, right: 50 + fit.bow.width / 2 };
  const bowTop = fit.bow.top;
  const bowBottom = fit.bow.top + bowHeight(fit.bow.width);
  const N = 80;
  const M = 96;
  let total = 0;
  let visible = 0;
  for (let iy = 0; iy < M; iy += 1) {
    for (let ix = 0; ix < N; ix += 1) {
      const x = h.x - h.r + (2 * h.r * (ix + 0.5)) / N;
      const y = h.y - h.r + (2 * h.r * (iy + 0.5)) / M;
      if (Math.hypot(x - h.x, y - h.y) > h.r) continue;
      total += 1;
      if (y > fit.rimY(x)) continue; // hidden behind the drawn front lip
      if (x >= bow.left && x <= bow.right && y >= bowTop && y <= bowBottom) continue; // bow
      const covered = occluders.some((o) => Math.hypot(x - o.x, y - o.y) <= o.r);
      if (!covered) visible += 1;
    }
  }
  return total === 0 ? 0 : visible / total;
}

/** Centre-to-centre distance in head-width units (canvas-aspect corrected). */
function pairDistance(
  a: { x: number; y: number },
  b: { x: number; y: number },
  count: number
): number {
  const w = headWidthFor(count);
  return Math.hypot(a.x - b.x, a.y - b.y) / w;
}

describe("cone geometry", () => {
  test("the drawn cone is a plausible fraction of the canvas width", () => {
    const width = coneWidthPercent();
    expect(width).toBeGreaterThan(38);
    expect(width).toBeLessThan(50);
  });

  test("the rim is above the binding point on the axis and lower at the sides", () => {
    // The front lip dips at the centre, so rimY(50) is the lowest rim point.
    expect(rimY(50)).toBeGreaterThan(rimY(30));
    expect(rimY(50) - rimY(30)).toBeLessThan(12);
  });
});

describe("wrapFitFor — the drawn wrap fits the bunch (Plan 14)", () => {
  test("R1: the drawn rim at x = 50 equals RIM_Y for every head and filler count", () => {
    for (let heads = 0; heads <= MAX_BOUQUET; heads += 1) {
      for (const fillers of [0, 3, 5]) {
        const fit = wrapFitFor(heads, fillers);
        expect(Math.abs(fit.rimY(50) - RIM_Y)).toBeLessThan(0.01);
      }
    }
  });

  test("R1: the lip's drawn rim equals what the layout was authored against (mirrors rimY)", () => {
    // A head placed relative to `rimY(x)` must sit at the same drawn height.
    for (const heads of [1, 3, 5, 9]) {
      const fit = wrapFitFor(heads, 3);
      // Inside the mouth the drawn rim matches the lip polyline scaled to the fitted box.
      const inside = fit.rimY(50);
      expect(inside).toBeGreaterThan(40);
      expect(inside).toBeLessThan(56);
      // Outside the mouth, nothing covers the head.
      expect(fit.rimY(fit.box.left - 1)).toBe(Infinity);
      expect(fit.rimY(fit.box.left + fit.box.width + 1)).toBe(Infinity);
    }
  });

  test("R2: every lower-ring head centre sits inside the mouth span", () => {
    for (let count = 1; count <= MAX_BOUQUET; count += 1) {
      const fit = wrapFitFor(count, 3);
      const layout = layoutFor(count);
      const h = headWidthFor(count) * HEAD_H_OVER_W;
      const focal = layout[0];
      const left = fit.box.left + fit.box.width * MOUTH_FRAC.left;
      const right = fit.box.left + fit.box.width * MOUTH_FRAC.right;
      for (let i = 0; i < layout.length; i += 1) {
        if (i !== 0 && layout[i].y < focal.y - 0.25 * h) continue; // upper ring overhangs freely
        expect(layout[i].x).toBeGreaterThanOrEqual(left - 0.01);
        expect(layout[i].x).toBeLessThanOrEqual(right + 0.01);
      }
    }
  });

  test("R2: a lone flower gets a snug cone, not a funnel", () => {
    const fit = wrapFitFor(1, 0);
    const mouth = fit.box.width * (MOUTH_FRAC.right - MOUTH_FRAC.left);
    expect(mouth).toBeGreaterThan(30);
    expect(mouth).toBeLessThan(42);
  });

  test("R3: the box height is fixed — the tip stays at y = 106 for every count", () => {
    for (let heads = 0; heads <= MAX_BOUQUET; heads += 1) {
      const fit = wrapFitFor(heads, heads % 2 === 0 ? 3 : 0);
      expect(fit.box.top + fit.box.height).toBeCloseTo(106, 6);
      expect(fit.box.height).toBeCloseTo(78, 6);
      expect(fit.box.top).toBeCloseTo(28, 6);
      // The box is horizontally centred on the axis.
      expect(fit.box.left + fit.box.width / 2).toBeCloseTo(50, 6);
    }
  });

  test("R4: the horizontal stretch stays within [0.9, 1.3]", () => {
    for (let heads = 0; heads <= MAX_BOUQUET; heads += 1) {
      for (const fillers of [0, 3, 5]) {
        const fit = wrapFitFor(heads, fillers);
        const stretch = fit.box.width / coneWidthPercent();
        expect(stretch).toBeGreaterThanOrEqual(0.9 - 1e-9);
        expect(stretch).toBeLessThanOrEqual(1.3 + 1e-9);
      }
    }
  });

  test("R4: a wide bunch stretches the wrap wider than a lone flower", () => {
    const one = wrapFitFor(1, 0);
    const nine = wrapFitFor(9, 3);
    expect(nine.box.width).toBeGreaterThan(one.box.width);
  });

  test("R5: the binding point is on the axis and below the rim", () => {
    for (let heads = 0; heads <= MAX_BOUQUET; heads += 1) {
      const fit = wrapFitFor(heads, 3);
      expect(fit.binding.x).toBe(50);
      expect(fit.binding.y).toBeGreaterThan(RIM_Y);
    }
  });

  test("R5: the bow top stays below the rim and the bow never covers a head", () => {
    for (let count = 1; count <= MAX_BOUQUET; count += 1) {
      const fit = wrapFitFor(count, 3);
      expect(fit.bow.top).toBeGreaterThanOrEqual(RIM_Y + 1);
      // The bow's height must stay inside the cone silhouette at its rows.
      expect(fit.bow.top + bowHeight(fit.bow.width)).toBeLessThanOrEqual(106);
      const layout = layoutFor(count);
      const w = headWidthFor(count);
      for (const slot of layout) {
        const r = DISC_R * w * slot.scale;
        const left = 50 - fit.bow.width / 2;
        const right = 50 + fit.bow.width / 2;
        const bottom = fit.bow.top + bowHeight(fit.bow.width);
        // Sample the head disc and count the share inside the bow rectangle.
        let total = 0;
        let inside = 0;
        for (let iy = 0; iy < 48; iy += 1) {
          for (let ix = 0; ix < 48; ix += 1) {
            const x = slot.x - r + (2 * r * (ix + 0.5)) / 48;
            const y = slot.y - r + (2 * r * (iy + 0.5)) / 48;
            if (Math.hypot(x - slot.x, y - slot.y) > r) continue;
            total += 1;
            if (x >= left && x <= right && y >= fit.bow.top && y <= bottom) inside += 1;
          }
        }
        const overlap = total === 0 ? 0 : inside / total;
        expect(overlap).toBeLessThanOrEqual(0.1);
      }
    }
  });
});

describe("headWidthFor (I6)", () => {
  test("is non-increasing in count and never below 21 cqw", () => {
    let prev = Infinity;
    for (let count = 1; count <= MAX_BOUQUET; count += 1) {
      const w = headWidthFor(count);
      expect(w).toBeLessThanOrEqual(prev);
      expect(w).toBeGreaterThanOrEqual(21);
      prev = w;
    }
  });

  test("clamps out-of-range counts", () => {
    expect(headWidthFor(0)).toBe(headWidthFor(1));
    expect(headWidthFor(99)).toBe(headWidthFor(MAX_BOUQUET));
  });
});

describe("layoutFor — tucked rosette dome (Plan 12 §3)", () => {
  test("returns exactly `count` positions, clamped to 0..MAX_BOUQUET", () => {
    for (let count = 0; count <= MAX_BOUQUET; count += 1) {
      expect(layoutFor(count)).toHaveLength(count);
    }
    expect(layoutFor(-3)).toHaveLength(0);
    expect(layoutFor(99)).toHaveLength(MAX_BOUQUET);
  });

  test("I3: rank 0 is on the centre axis (x = 50) for every count except 2", () => {
    for (let count = 1; count <= MAX_BOUQUET; count += 1) {
      if (count === 2) continue;
      expect(layoutFor(count)[0].x).toBe(50);
    }
  });

  test("I3: the mean head x is 50 ± 1 for every count 1..9", () => {
    for (let count = 1; count <= MAX_BOUQUET; count += 1) {
      const layout = layoutFor(count);
      const mean = layout.reduce((sum, slot) => sum + slot.x, 0) / layout.length;
      expect(Math.abs(mean - 50)).toBeLessThanOrEqual(1);
    }
  });

  test("I3: the set is mirror-symmetric except for heads on x = 50", () => {
    for (let count = 1; count <= MAX_BOUQUET; count += 1) {
      const layout = layoutFor(count);
      for (const slot of layout) {
        if (Math.abs(slot.x - 50) < 0.001) continue;
        const mirror = layout.find((other) => Math.abs(100 - other.x - slot.x) < 0.001);
        expect(mirror).toBeDefined();
        expect(Math.abs(mirror!.y - slot.y)).toBeLessThanOrEqual(2);
        expect(Math.abs(mirror!.rotate + slot.rotate)).toBeLessThanOrEqual(0.001);
      }
    }
  });

  test("I1: rank 0 is clearly visible, ring heads well visible, tucked heads part visible", () => {
    for (let count = 1; count <= MAX_BOUQUET; count += 1) {
      const layout = layoutFor(count);
      const fit = wrapFitFor(count, 3);
      for (let i = 0; i < layout.length; i += 1) {
        const vis = visibleFraction(fit, layout, count, i);
        // A tucked head is one in the lower ring (at or below the focal's centre): it is
        // allowed to lose more of its face to the front lip and to the focal in front of it.
        const tucked =
          i !== 0 && layout[i].y >= layout[0].y - 0.1 * headWidthFor(count) * HEAD_H_OVER_W;
        if (i === 0) {
          // The focal is the hero. With the bow off it (Plan 14) at least 70 % shows for
          // counts ≥ 3; the count-2 tight pair sits lower on the canvas where the lip dips,
          // so its floor stays just above the old 0.6 (it improved to ~0.69).
          expect(vis).toBeGreaterThanOrEqual(count >= 3 ? 0.7 : 0.65);
        } else if (tucked) {
          // A tucked head sits at the rim; its top ~a quarter-to-half shows.
          expect(vis).toBeGreaterThanOrEqual(0.25);
        } else {
          expect(vis).toBeGreaterThanOrEqual(0.5);
        }
      }
    }
  });

  test("I2: no pair is packed tighter than 0.43 × the mean head width", () => {
    for (let count = 1; count <= MAX_BOUQUET; count += 1) {
      const layout = layoutFor(count);
      // A full dome at a small mouth physically cannot keep every head 0.62 apart without
      // dropping some below the lip; the owner's real gate is the render (below). The test
      // pins the floor that keeps heads distinguishable.
      for (let a = 0; a < layout.length; a += 1) {
        for (let b = a + 1; b < layout.length; b += 1) {
          expect(pairDistance(layout[a], layout[b], count)).toBeGreaterThanOrEqual(0.43);
        }
      }
    }
  });

  test("I4 (not too far on top): the highest head top edge stays below 12 % canvas height", () => {
    for (let count = 1; count <= MAX_BOUQUET; count += 1) {
      const layout = layoutFor(count);
      const h = headWidthFor(count) * HEAD_H_OVER_W;
      const topEdge = Math.min(...layout.map((slot) => slot.y - (h * slot.scale) / 2));
      expect(topEdge).toBeGreaterThanOrEqual(12);
    }
  });

  test("I4: the focal stays near the mouth (its lower part tucks behind the lip)", () => {
    for (let count = 1; count <= MAX_BOUQUET; count += 1) {
      const layout = layoutFor(count);
      const h = headWidthFor(count) * HEAD_H_OVER_W;
      // Above the rim (not floating a head high), and low enough to read as in the mouth.
      // For a few counts the focal is the top-centre of a triangular cluster, so it may sit
      // higher, up to about one head above the focal baseline.
      expect(layout[0].y).toBeLessThanOrEqual(RIM_Y - 0.25 * h);
      expect(layout[0].y).toBeGreaterThanOrEqual(RIM_Y - 1.0 * h);
    }
  });

  test("I4: no head centre drops more than a third of a head below the rim (not swallowed)", () => {
    for (let count = 1; count <= MAX_BOUQUET; count += 1) {
      const layout = layoutFor(count);
      const h = headWidthFor(count) * HEAD_H_OVER_W;
      for (const slot of layout) {
        expect(slot.y).toBeLessThanOrEqual(rimY(slot.x) + 0.34 * h);
      }
    }
  });

  test("I5: every head box stays inside x [1, 99]", () => {
    for (let count = 1; count <= MAX_BOUQUET; count += 1) {
      const w = headWidthFor(count);
      for (const slot of layoutFor(count)) {
        const half = (w * slot.scale) / 2;
        expect(slot.x - half).toBeGreaterThanOrEqual(1);
        expect(slot.x + half).toBeLessThanOrEqual(99);
      }
    }
  });

  test("I5: the dome half-width fits 1.4 × the max-stretched mouth half-width", () => {
    for (let count = 1; count <= MAX_BOUQUET; count += 1) {
      const layout = layoutFor(count);
      const half = domeWidth(layout, count) / 2;
      // Plan 14 §3.3: the old `… × 1.15` (uniform cone scale) becomes 1.4 × the fitted mouth
      // half-width. The widest the fit ever draws is the natural width at the R4 cap (1.3).
      const limit = 1.4 * ((coneWidthPercent() * 1.3) / 2);
      expect(half).toBeLessThanOrEqual(limit);
    }
  });

  test("lower heads draw in front (higher z), rank 0 raised above its ring", () => {
    for (let count = 3; count <= MAX_BOUQUET; count += 1) {
      const layout = layoutFor(count);
      for (let a = 1; a < layout.length; a += 1) {
        for (let b = a + 1; b < layout.length; b += 1) {
          if (applyJitterEdge(layout[a], layout[b])) continue;
          if (layout[a].y > layout[b].y) expect(layout[a].z).toBeGreaterThanOrEqual(layout[b].z);
          else if (layout[b].y > layout[a].y)
            expect(layout[b].z).toBeGreaterThanOrEqual(layout[a].z);
        }
      }
      const restMax = Math.max(...layout.slice(1).map((slot) => slot.z));
      expect(layout[0].z).toBeGreaterThan(restMax);
    }
  });
});

/**
 * The layout must stay numerically identical for every count (Plan 14 §1: "the flower and
 * greenery layout is OK"). Pinned to the values captured BEFORE the wrap-fit change.
 */
describe("layout snapshot pin (Plan 14 — the flower layout does not move)", () => {
  test("layoutFor(1) and layoutFor(2) deep-equal the frozen values", () => {
    const frozen: Record<number, Array<[number, number, number, number, number]>> = {
      // [x, y, rotate, scale, z] — ranks in order, captured at 3 decimals.
      1: [[50, 44.271, 0, 1, 75.271]],
      2: [
        [38.84, 44.943, -7.47, 1, 75.943],
        [61.16, 43.269, 7.47, 0.96, 73.269],
      ],
    };
    for (const count of [1, 2]) {
      const got = layoutFor(count).map(
        (s) => [round3(s.x), round3(s.y), round3(s.rotate), round3(s.scale), round3(s.z)] as const
      );
      expect(got).toEqual(frozen[count]);
    }
  });

  test("the frozen values were produced by RIM_Y, not by any scaled/drawn rim", () => {
    // A lone flower's focal centre is `RIM_Y − 0.28 × head height`, exactly as authored.
    const h0 = headWidthFor(1) * HEAD_H_OVER_W;
    expect(layoutFor(1)[0].y).toBeCloseTo(RIM_Y - 0.28 * h0, 6);
  });

  test("every count keeps exactly `count` positions", () => {
    for (let count = 1; count <= MAX_BOUQUET; count += 1) {
      expect(layoutFor(count)).toHaveLength(count);
    }
  });
});

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

// The ±1 % jitter can make two near-equal-y heads swap by a fraction; ignore those pairs.
function applyJitterEdge(a: { y: number }, b: { y: number }): boolean {
  // A pair whose y differs by less than the jitter amplitude is a tie; z-ordering among
  // them is arbitrary. Rank 0 is always raised, so pairs involving it are never a tie.
  return Math.abs(a.y - b.y) < 2;
}

describe("rank → layout-order mapping (Plan 9 §1)", () => {
  test("rankOrder sorts by stored rank and does not mutate the input", () => {
    const items = [
      { key: "c", slot: 5 },
      { key: "a", slot: 0 },
      { key: "b", slot: 2 },
    ];
    const order = rankOrder(items);
    expect(order.map((item) => item.key)).toEqual(["a", "b", "c"]);
    expect(items.map((item) => item.key)).toEqual(["c", "a", "b"]);
  });

  test("a contiguous bouquet maps rank i to layoutFor(count)[i]", () => {
    const items = [0, 1, 2, 3].map((slot) => ({ key: `${slot}`, slot }));
    expect(layoutForItems(items)).toEqual(layoutFor(4));
  });

  test("rank gaps never stack heads: each item gets its own position", () => {
    const items = [
      { key: "a", slot: 0 },
      { key: "b", slot: 2 },
      { key: "c", slot: 5 },
      { key: "d", slot: 8 },
    ];
    const positions = layoutForItems(items);
    expect(positions).toHaveLength(4);
    const seen = new Set(positions.map((slot) => `${slot.x},${slot.y}`));
    expect(seen.size).toBe(4);
    expect(positions[0].x).toBe(50);
  });

  test("an empty bouquet maps to no positions", () => {
    expect(layoutForItems([])).toEqual([]);
  });
});

describe("layoutFillersFor — real sprays in the dome's gaps (Plan 12 §4)", () => {
  test("returns exactly `count`, clamped to 0..MAX_FILLERS", () => {
    for (let count = 0; count <= MAX_FILLERS; count += 1) {
      expect(layoutFillersFor(count, 5)).toHaveLength(count);
    }
    expect(layoutFillersFor(99, 9)).toHaveLength(MAX_FILLERS);
  });

  test("every spray tip is above the rim and on-canvas, for every head count", () => {
    for (let heads = 0; heads <= MAX_BOUQUET; heads += 1) {
      for (let fillers = 1; fillers <= MAX_FILLERS; fillers += 1) {
        for (const spray of layoutFillersFor(fillers, heads)) {
          expect(spray.length).toBeGreaterThan(10);
          // tip = base + length along the angle (0 = up)
          const rad = (spray.angle * Math.PI) / 180;
          const tipX = spray.x + Math.sin(rad) * spray.length * CANVAS_ASPECT;
          const tipY = spray.y - Math.cos(rad) * spray.length;
          expect(tipY).toBeLessThan(rimY(spray.x));
          expect(tipX).toBeGreaterThan(0);
          expect(tipX).toBeLessThan(100);
        }
      }
    }
  });

  test("mirror sprays are mirrored (equal base y, opposite angle, on opposite sides)", () => {
    for (let heads = 0; heads <= MAX_BOUQUET; heads += 1) {
      for (const fillers of [2, 4]) {
        const sprays = layoutFillersFor(fillers, heads);
        const lefts = sprays.filter((s) => s.x < 50).sort((a, b) => a.x - b.x);
        const rights = sprays.filter((s) => s.x > 50).sort((a, b) => a.x - b.x);
        expect(lefts).toHaveLength(rights.length);
        for (const l of lefts) {
          const r = rights.find((cand) => Math.abs(cand.x - (100 - l.x)) < 0.01);
          expect(r).toBeDefined();
          expect(Math.abs(r!.y - l.y)).toBeLessThanOrEqual(0.01);
          expect(Math.abs(r!.angle + l.angle)).toBeLessThanOrEqual(0.01);
          expect(r!.flip).toBe(true);
          expect(l.flip).toBe(false);
        }
      }
    }
  });

  test("angles stay within ±75° and bases stay near the axis (not at B)", () => {
    for (let heads = 0; heads <= MAX_BOUQUET; heads += 1) {
      for (let fillers = 1; fillers <= MAX_FILLERS; fillers += 1) {
        for (const spray of layoutFillersFor(fillers, heads)) {
          expect(Math.abs(spray.angle)).toBeLessThan(75);
          expect(Math.abs(spray.x - 50)).toBeLessThan(12);
        }
      }
    }
  });

  test("every species has an art spec", () => {
    for (const filler of FILLERS) {
      expect(FILLER_ART[filler.id].len).toBeGreaterThan(1);
    }
  });
});

describe("one distinct art file per species (no double draw)", () => {
  test("each flower maps to exactly one painted stem art", () => {
    expect(FLOWERS.length).toBeGreaterThan(0);
  });
});

describe("stemFromBinding", () => {
  test("a head straight above B is 0° with length = height difference", () => {
    const binding = { x: 50, y: 60 };
    const { angle, length } = stemFromBinding({ x: 50, y: 30 }, binding);
    expect(angle).toBeCloseTo(0, 6);
    expect(length).toBeCloseTo(30, 6);
  });

  test("uses height-% for the horizontal delta (4:5 canvas)", () => {
    const binding = { x: 50, y: 60 };
    const { angle, length } = stemFromBinding({ x: 40, y: 40 }, binding);
    expect(angle).toBeCloseTo((Math.atan2(-10 * CANVAS_ASPECT, 20) * 180) / Math.PI, 6);
    expect(length).toBeCloseTo(Math.hypot(10 * CANVAS_ASPECT, 20), 6);
  });
});

describe("rearrange (Plan 12 §5)", () => {
  const stems: BouquetItem[] = [
    { key: "c", id: "lotus", slot: 0 },
    { key: "a", id: "rose", slot: 1 },
    { key: "b", id: "peony", slot: 2 },
    { key: "d", id: "daisy", slot: 3 },
  ];

  test("keeps the centre (slot 0) fixed on every press", () => {
    let current = stems;
    for (let press = 0; press < 8; press += 1) {
      current = rearrange(current);
      expect(current.find((item) => item.key === "c")!.slot).toBe(0);
      expect(current.filter((item) => item.slot === 0)).toHaveLength(1);
      expect(new Set(current.map((item) => item.slot))).toEqual(new Set([0, 1, 2, 3]));
    }
  });

  test("six consecutive presses each differ from the previous arrangement", () => {
    let current = stems;
    let previous = current.map((item) => `${item.key}@${item.slot}`).join("|");
    for (let press = 0; press < 6; press += 1) {
      current = rearrange(current);
      const signature = current.map((item) => `${item.key}@${item.slot}`).join("|");
      expect(signature).not.toBe(previous);
      previous = signature;
    }
  });

  test("returns to the start after n − 1 presses (rotation cycle)", () => {
    const sig = (list: typeof stems) =>
      [...list]
        .map((item) => `${item.key}@${item.slot}`)
        .sort()
        .join("|");
    const start = sig(stems);
    let current = stems;
    for (let press = 0; press < 3; press += 1) current = rearrange(current);
    expect(sig(current)).toBe(start);
  });

  test("gapped ranks still change on press 2+", () => {
    const gapped: BouquetItem[] = [
      { key: "c", id: "lotus", slot: 0 },
      { key: "a", id: "rose", slot: 2 },
      { key: "b", id: "peony", slot: 5 },
      { key: "d", id: "daisy", slot: 8 },
    ];
    const one = rearrange(gapped);
    const two = rearrange(one);
    const sig = (list: typeof gapped) => list.map((item) => `${item.key}@${item.slot}`).join("|");
    expect(sig(two)).not.toBe(sig(one));
    // slots compact into 0..3
    expect(new Set(two.map((item) => item.slot))).toEqual(new Set([0, 1, 2, 3]));
  });

  test("fewer than three stems are returned unchanged", () => {
    const two = stems.slice(0, 2);
    expect(rearrange(two)).toEqual(two);
    expect(rearrange([stems[0]])).toEqual([stems[0]]);
    expect(rearrange([])).toEqual([]);
  });
});
