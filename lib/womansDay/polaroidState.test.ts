import { describe, expect, test } from "bun:test";

import {
  MAX_STROKE_POINTS,
  parsePolaroid,
  polaroidReducer,
  truncateStrokes,
  type PolaroidState,
} from "@/lib/womansDay/polaroidState";
import { REVEAL_AT, coverageOf } from "@/lib/womansDay/polaroidGeometry";

function state(overrides: Partial<PolaroidState> = {}): PolaroidState {
  return {
    blob: null,
    photoUrl: null,
    caption: "",
    revealed: false,
    strokes: [],
    foilSnapshot: null,
    ...overrides,
  };
}

describe("parsePolaroid (v2 storage)", () => {
  test("a v2 record returns caption + strokes", () => {
    const raw = JSON.stringify({ v: 2, caption: "hello", strokes: [[0.1, 0.2, 0.3, 0.4]] });
    expect(parsePolaroid(raw)).toEqual({ caption: "hello", strokes: [[0.1, 0.2, 0.3, 0.4]] });
  });

  test("an old { caption, revealed: true } record keeps the caption and drops revealed", () => {
    // Readers hit by the one-stroke auto-clear bug get their foil back.
    const raw = JSON.stringify({ caption: "kept", revealed: true });
    expect(parsePolaroid(raw)).toEqual({ caption: "kept", strokes: [] });
  });

  test("a record with the wrong version keeps the caption and drops strokes", () => {
    const raw = JSON.stringify({ v: 1, caption: "kept", strokes: [[0, 0, 1, 1]] });
    expect(parsePolaroid(raw)).toEqual({ caption: "kept", strokes: [] });
  });

  test("malformed strokes are dropped, valid ones kept", () => {
    const raw = JSON.stringify({
      v: 2,
      caption: "",
      strokes: [
        [0.1, 0.2, 0.3, 0.4],
        "nope",
        [0.5, NaN, 0.6, 0.7],
        [0.1, 1.5, 0.2, 0.3],
        [0.1, 0.2, 0.3],
        [0.1, 0.2, 0.3, 0.4, 0.5],
      ],
    });
    expect(parsePolaroid(raw)).toEqual({ caption: "", strokes: [[0.1, 0.2, 0.3, 0.4]] });
  });

  test("an over-cap record is truncated to the earliest strokes", () => {
    const big = Array.from({ length: 10 }, () => [0.1, 0.2, 0.3, 0.4]);
    const raw = JSON.stringify({ v: 2, caption: "", strokes: big });
    const parsed = parsePolaroid(raw);
    expect(parsed).not.toBeNull();
    const points = (parsed?.strokes ?? []).reduce((sum, s) => sum + s.length / 2, 0);
    expect(points).toBeLessThanOrEqual(MAX_STROKE_POINTS);
    // Earliest strokes survive.
    expect(parsed?.strokes[0]).toEqual([0.1, 0.2, 0.3, 0.4]);
  });

  test("garbage returns null", () => {
    expect(parsePolaroid(null)).toBeNull();
    expect(parsePolaroid("not json")).toBeNull();
    expect(parsePolaroid("42")).toBeNull();
  });
});

describe("polaroidReducer strokes", () => {
  test("strokes replaces the list", () => {
    const next = polaroidReducer(state(), { type: "strokes", value: [[0, 0, 1, 1]] });
    expect(next.strokes).toEqual([[0, 0, 1, 1]]);
  });

  test("photo and refoil reset strokes", () => {
    const scratched = state({ strokes: [[0, 0, 1, 1]], revealed: true });
    expect(polaroidReducer(scratched, { type: "photo", blob: null, url: null }).strokes).toEqual(
      []
    );
    expect(polaroidReducer(scratched, { type: "refoil" }).strokes).toEqual([]);
    expect(polaroidReducer(scratched, { type: "refoil" }).revealed).toBe(false);
  });

  test("truncateStrokes keeps the earliest strokes within the cap", () => {
    const strokes = [
      [0, 0, 0.1, 0.1],
      [0.2, 0.2, 0.3, 0.3],
      [0.4, 0.4, 0.5, 0.5],
    ];
    expect(truncateStrokes(strokes)).toEqual(strokes);
  });
});

describe("coverageOf (foil progress mask)", () => {
  test("a fully opaque mask is 0 — this assertion would have caught the blank-mask bug", () => {
    const alpha = new Uint8ClampedArray(48 * 48 * 4).fill(255);
    expect(coverageOf(alpha)).toBe(0);
  });

  test("a fully transparent mask is 1", () => {
    const alpha = new Uint8ClampedArray(48 * 48 * 4);
    expect(coverageOf(alpha)).toBe(1);
  });

  test("half cleared is 0.5 and the reveal threshold is reachable", () => {
    const alpha = new Uint8ClampedArray(48 * 48 * 4).fill(255);
    for (let i = 3; i < alpha.length / 2; i += 4) alpha[i] = 0;
    expect(coverageOf(alpha)).toBeCloseTo(0.5, 10);
    expect(REVEAL_AT).toBeGreaterThan(0);
    expect(REVEAL_AT).toBeLessThan(1);
  });
});
