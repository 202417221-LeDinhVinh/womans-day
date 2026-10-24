import { describe, expect, test } from "bun:test";

import {
  GROUND_BAND,
  HEAD_TOP_MARGIN,
  MAX_PLANTED,
  MAX_STEM,
  MIN_STEM,
  baseYFor,
  growGarden,
  headWidthForDepth,
  parseGarden,
  plantAt,
  serializeGarden,
  zForDepth,
} from "@/lib/womansDay/garden";
import type { Planted } from "@/lib/womansDay/garden";

const band = GROUND_BAND;

function planted(overrides: Partial<Planted> = {}): Planted {
  return {
    key: "k1",
    id: "tulip",
    x: 50,
    depth: 0.5,
    headY: 50,
    tilt: 0,
    seed: 7,
    ...overrides,
  };
}

describe("plantAt", () => {
  test("a tap above the band grows a stem to the tapped head point", () => {
    const p = plantAt(40, 30, [], "tulip", band);
    expect(p.x).toBeCloseTo(40, 0);
    expect(p.headY).toBeLessThanOrEqual(30 + 0.01);
    // The stem is between the min and max length.
    const baseY = baseYFor(p.depth, band);
    expect(baseY - p.headY).toBeGreaterThanOrEqual(MIN_STEM * 100 - 0.01);
    expect(baseY - p.headY).toBeLessThanOrEqual(MAX_STEM * 100 + 0.01);
  });

  test("the head is never nearer the top than the top margin", () => {
    const p = plantAt(50, 1, [], "tulip", band);
    expect(p.headY).toBeGreaterThanOrEqual(HEAD_TOP_MARGIN * 100 - 0.01);
  });

  test("a tap inside the band places a short flower in front", () => {
    const p = plantAt(30, 95, [], "rose", band);
    expect(p.depth).toBeGreaterThan(0.5);
    const baseY = baseYFor(p.depth, band);
    expect(p.headY).toBeLessThan(baseY);
  });

  test("never refuses a tap: a crowded head is nudged to a free x", () => {
    const existing: Planted[] = [];
    for (let i = 0; i < 8; i += 1) {
      existing.push(planted({ key: `k${i}`, x: 50, headY: 30 }));
    }
    const p = plantAt(50, 30, existing, "tulip", band);
    expect(Math.abs(p.x - 50)).toBeGreaterThan(0.5);
  });

  test("depth drives head width and z", () => {
    expect(headWidthForDepth(1)).toBeGreaterThan(headWidthForDepth(0));
    expect(zForDepth(1)).toBeGreaterThan(zForDepth(0));
  });

  test("base y moves down the page with depth", () => {
    expect(baseYFor(1, band)).toBeGreaterThan(baseYFor(0, band));
  });
});

describe("growGarden", () => {
  test("grows until the cap", () => {
    let list: Planted[] = [];
    for (let i = 0; i < MAX_PLANTED; i += 1) {
      const result = growGarden(list, planted({ key: `k${i}` }));
      expect(result.wilted).toBeNull();
      list = result.next;
    }
    expect(list).toHaveLength(MAX_PLANTED);
  });

  test("past the cap the oldest flower wilts", () => {
    let list: Planted[] = [];
    for (let i = 0; i < MAX_PLANTED; i += 1)
      list = growGarden(list, planted({ key: `k${i}` })).next;
    const result = growGarden(list, planted({ key: "new" }));
    expect(result.wilted?.key).toBe("k0");
    expect(result.next).toHaveLength(MAX_PLANTED);
    expect(result.next[0].key).toBe("k1");
  });
});

describe("parseGarden / serializeGarden", () => {
  test("round-trips", () => {
    const list = [planted({ key: "a" }), planted({ key: "b", id: "rose" })];
    expect(parseGarden(serializeGarden(list))).toEqual(list);
  });

  test("drops malformed entries and unknown species", () => {
    const raw = JSON.stringify([
      { key: "a", id: "tulip", x: 10, depth: 0.2, headY: 40, tilt: 1, seed: 3 },
      { key: "b", id: "not-a-flower", x: 10, depth: 0.2, headY: 40, tilt: 1, seed: 3 },
      { key: "c", id: "tulip", x: "x", depth: 0.2, headY: 40, tilt: 1, seed: 3 },
      null,
    ]);
    const parsed = parseGarden(raw);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].key).toBe("a");
  });

  test("junk input yields an empty garden, never throws", () => {
    expect(parseGarden(null)).toEqual([]);
    expect(parseGarden("not json")).toEqual([]);
    expect(parseGarden("{}")).toEqual([]);
  });

  test("clamps values into range", () => {
    const raw = JSON.stringify([
      { key: "a", id: "tulip", x: 999, depth: 9, headY: -5, tilt: 90, seed: 1 },
    ]);
    const parsed = parseGarden(raw);
    expect(parsed[0].x).toBeLessThanOrEqual(96);
    expect(parsed[0].depth).toBeLessThanOrEqual(1);
    expect(parsed[0].headY).toBeGreaterThanOrEqual(0);
    expect(parsed[0].tilt).toBeLessThanOrEqual(8);
  });
});
