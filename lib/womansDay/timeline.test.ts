import { describe, expect, test } from "bun:test";

import {
  LETTER_REST,
  REST_NUDGE,
  SCROLL_SCREENS,
  SEGMENTS,
  SPREAD,
  SPREAD_COUNT,
  TURNS,
  TURN_LANDED_EPSILON,
  clamp01,
  paperEase,
  progressToScrollTop,
  restProgress,
  sceneAt,
  scrub,
  settleTarget,
  smoothstep,
  spreadBefore,
  turnFor,
} from "@/lib/womansDay/timeline";

describe("scrub", () => {
  test("maps a segment to a clamped 0..1 local value", () => {
    const segment = { start: 0.2, end: 0.4 };
    expect(scrub(0.2, segment)).toBe(0);
    expect(scrub(0.3, segment)).toBeCloseTo(0.5, 10);
    expect(scrub(0.4, segment)).toBe(1);
    expect(scrub(0.1, segment)).toBe(0);
    expect(scrub(0.9, segment)).toBe(1);
  });

  test("treats an empty segment as a step", () => {
    expect(scrub(0.5, { start: 0.5, end: 0.5 })).toBe(1);
    expect(scrub(0.4, { start: 0.5, end: 0.5 })).toBe(0);
  });
});

describe("clamp01 / easing", () => {
  test("clamp01 bounds both ends", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(0.42)).toBe(0.42);
    expect(clamp01(2)).toBe(1);
  });

  test("smoothstep and paperEase are monotonic over the unit interval", () => {
    for (let i = 0; i < 100; i += 1) {
      const a = i / 100;
      const b = (i + 1) / 100;
      expect(smoothstep(a)).toBeLessThanOrEqual(smoothstep(b));
      expect(paperEase(a)).toBeLessThanOrEqual(paperEase(b));
    }
    expect(paperEase(0.5)).toBeCloseTo(0.5, 10);
    expect(paperEase(0)).toBe(0);
    expect(paperEase(1)).toBe(1);
  });
});

describe("sceneAt boundaries", () => {
  test("starts on the closed cover with no turn", () => {
    expect(sceneAt(0)).toEqual({ spread: 0, turn: null, letter: false });
  });

  test("a turn owns the half-open interval (start, end)", () => {
    const cover = SEGMENTS.coverOpen;
    // Exactly at `start` the leaf is flat (local t = 0): it is treated as unmounted so a
    // rest that lands on the boundary never leaves a hit-testable leaf over the page.
    expect(sceneAt(cover.start).turn).toBe(null);
    expect(sceneAt(cover.start + 0.004).turn).toBe("cover");
    expect(sceneAt((cover.start + cover.end) / 2).turn).toBe("cover");
    // At `end` the turn is over and the spread has landed.
    expect(sceneAt(cover.end).turn).toBe(null);
    expect(sceneAt(cover.end).spread).toBe(1);
  });

  test("the very edges of a turn report no leaf (the leaf is flat there)", () => {
    // A settle that lands at `end - ε` must not leave a leaf mounted over the rest.
    for (const turn of TURNS) {
      const { start, end } = turn.segment;
      const span = end - start;
      expect(sceneAt(end - span * TURN_LANDED_EPSILON * 0.5).turn).toBe(null);
      expect(sceneAt(start + span * TURN_LANDED_EPSILON * 0.5).turn).toBe(null);
      // ...but the turn is still live in the middle.
      expect(sceneAt((start + end) / 2).turn).toBe(turn.id);
    }
  });

  test("sceneAt(coverOpen.start).spread === 0", () => {
    expect(sceneAt(SEGMENTS.coverOpen.start).spread).toBe(SPREAD.cover);
  });

  test("at the START edge the spread is the PREVIOUS one, not the next (Plan 9b §5)", () => {
    // The leaf has not moved yet, so the base must remain the spread the previous turn
    // landed on. Returning `spreadAfter` showed the next spread's both halves under a
    // still-closed cover.
    for (let i = 0; i < TURNS.length; i += 1) {
      const turn = TURNS[i];
      const { start, end } = turn.segment;
      const span = end - start;
      const previous = spreadBefore(i);
      const atStart = sceneAt(start + span * TURN_LANDED_EPSILON * 0.5);
      expect(atStart.turn).toBe(null);
      expect(atStart.spread).toBe(previous);
      // The END edge still lands on the spread AFTER this turn.
      expect(sceneAt(end - span * TURN_LANDED_EPSILON * 0.5).spread).toBe(turn.spreadAfter);
    }
    // Explicitly: the cover turn's start edge is the closed cover (spread 0).
    expect(sceneAt(SEGMENTS.coverOpen.start).spread).toBe(SPREAD.cover);
    expect(sceneAt(SEGMENTS.turnPlate.start + 0.0000001).spread).toBe(SPREAD.plate);
  });

  test("while a leaf is turning the underlay is already the NEXT spread", () => {
    for (const turn of TURNS) {
      const mid = (turn.segment.start + turn.segment.end) / 2;
      expect(sceneAt(mid).spread).toBe(turn.spreadAfter);
      expect(sceneAt(mid).turn).toBe(turn.id);
    }
  });

  test("rests between turns stay on the finished spread", () => {
    // Derive a rest point from each consecutive pair of turns: the midpoint between one
    // turn's end and the next turn's start is by construction a rest (no leaf in the air).
    for (let i = 0; i < TURNS.length - 1; i += 1) {
      const after = TURNS[i].segment.end;
      const before = TURNS[i + 1].segment.start;
      const rest = (after + before) / 2;
      const scene = sceneAt(rest);
      expect(scene.turn).toBe(null);
      expect(scene.spread).toBe(TURNS[i].spreadAfter);
    }
    // And the track's endpoints.
    expect(sceneAt(0)).toEqual({ spread: 0, turn: null, letter: false });
    expect(sceneAt(1).turn).toBe(null);
    expect(sceneAt(1).spread).toBe(SPREAD.back);
  });

  test("letter is live from its reveal start onward", () => {
    expect(sceneAt(SEGMENTS.letterReveal.start - 0.001).letter).toBe(false);
    expect(sceneAt(SEGMENTS.letterReveal.start).letter).toBe(true);
    expect(sceneAt(1).letter).toBe(true);
  });

  test("the final spread is the closed back cover", () => {
    expect(sceneAt(SEGMENTS.turnBack.end).spread).toBe(SPREAD.back);
    expect(sceneAt(1).spread).toBe(SPREAD.back);
  });

  test("scene changes at most at every segment boundary across the track", () => {
    // No segment should be inverted or empty.
    for (const segment of Object.values(SEGMENTS)) {
      expect(segment.end).toBeGreaterThan(segment.start);
    }
    // The turns are ordered and non-overlapping.
    for (let i = 1; i < TURNS.length; i += 1) {
      expect(TURNS[i].segment.start).toBeGreaterThanOrEqual(TURNS[i - 1].segment.end);
    }
  });
});

describe("settleTarget", () => {
  test("returns null at rest positions", () => {
    expect(settleTarget(0)).toBeNull();
    expect(settleTarget(SEGMENTS.turnPlate.start)).toBeNull();
    expect(settleTarget(SEGMENTS.turnPlate.end)).toBeNull();
    expect(settleTarget(1)).toBeNull();
  });

  test("snaps to the nearer segment edge while mid-turn", () => {
    const { start, end } = SEGMENTS.turnScrapbook;
    const quarter = start + (end - start) * 0.25;
    const threeQuarter = start + (end - start) * 0.75;
    expect(settleTarget(quarter)).toBeCloseTo(start - REST_NUDGE, 10);
    expect(settleTarget(threeQuarter)).toBeCloseTo(end + REST_NUDGE, 10);
  });

  test("every settle target lands INSIDE the rest window, never on the boundary", () => {
    for (const turn of TURNS) {
      if (turn.id === "back") continue; // covered by the book-exit tests below
      const { start, end } = turn.segment;
      for (const p of [start + (end - start) * 0.25, start + (end - start) * 0.75]) {
        const target = settleTarget(p);
        expect(target).not.toBeNull();
        const scene = sceneAt(target as number);
        expect(scene.turn).toBe(null);
      }
    }
  });

  test("snaps strictly inside every turn segment", () => {
    for (const turn of TURNS) {
      if (turn.id === "back") continue; // covered by the book-exit tests below
      const { start, end } = turn.segment;
      const nearStart = start + (end - start) * 0.25;
      const nearEnd = start + (end - start) * 0.75;
      expect(settleTarget(nearStart)).toBeCloseTo(start - REST_NUDGE, 10);
      expect(settleTarget(nearEnd)).toBeCloseTo(end + REST_NUDGE, 10);
    }
  });

  test("the back turn settles onto the letter rest past the book fade (Plan 16 Part B)", () => {
    expect(SEGMENTS.bookExit.start).toBeGreaterThanOrEqual(SEGMENTS.turnBack.end);
    expect(SEGMENTS.bookExit.end).toBeLessThanOrEqual(SEGMENTS.letterReveal.end);
    expect(restProgress(SPREAD.back)).toBe(LETTER_REST);
    expect(LETTER_REST).toBeGreaterThanOrEqual(SEGMENTS.bookExit.end);
    expect(LETTER_REST).toBeGreaterThanOrEqual(SEGMENTS.letterReveal.end);
    const { start, end } = SEGMENTS.turnBack;
    expect(settleTarget(start + (end - start) * 0.75)).toBeCloseTo(LETTER_REST, 10);
    expect(settleTarget(end + 0.01)).toBeCloseTo(LETTER_REST, 10);
    // The exit window itself is not a rest: it settles forward onto the letter.
    expect(settleTarget((end + LETTER_REST) / 2)).toBeCloseTo(LETTER_REST, 10);
    expect(settleTarget(LETTER_REST)).toBeNull();
    expect(settleTarget(1)).toBeNull();
    expect(sceneAt(LETTER_REST)).toEqual({ spread: SPREAD.back, turn: null, letter: true });
    // Click-to-turn from the florist lands on the letter rest with the book gone.
    expect(turnFor(SPREAD.florist, 1)?.id).toBe("back");
    expect(restProgress(turnFor(SPREAD.florist, 1)?.spreadAfter ?? SPREAD.back)).toBe(LETTER_REST);
  });
});

describe("restProgress / turnFor (click-to-turn)", () => {
  test("restProgress returns a point with no live leaf for every spread", () => {
    for (let spread = 0; spread < SPREAD_COUNT; spread += 1) {
      const scene = sceneAt(restProgress(spread));
      expect(scene.turn).toBe(null);
      expect(scene.spread).toBe(spread);
    }
  });

  test("the cover rest sits just before coverOpen", () => {
    const p = restProgress(SPREAD.cover);
    expect(p).toBeCloseTo(SEGMENTS.coverOpen.start - REST_NUDGE, 10);
    expect(sceneAt(p).spread).toBe(SPREAD.cover);
  });

  test("turnFor forward walks the spreads in order; backward reverses", () => {
    let spread: number = SPREAD.cover;
    const seen: number[] = [spread];
    for (let guard = 0; guard < 10; guard += 1) {
      const turn = turnFor(spread, 1);
      if (!turn) break;
      spread = turn.spreadAfter;
      seen.push(spread);
    }
    expect(seen).toEqual([0, 1, 2, 3, 4, 5, 6]);

    spread = SPREAD.back;
    const back: number[] = [spread];
    for (let guard = 0; guard < 10; guard += 1) {
      if (spread === SPREAD.cover) break;
      const turn = turnFor(spread, -1);
      if (!turn) break;
      const index = TURNS.findIndex((entry) => entry.id === turn.id);
      spread = spreadBefore(index);
      back.push(spread);
    }
    expect(back).toEqual([6, 5, 4, 3, 2, 1, 0]);
  });

  test("turnFor forward from the back cover has nowhere to go", () => {
    expect(turnFor(SPREAD.back, 1)).toBe(null);
  });
});

describe("progressToScrollTop", () => {
  test("maps progress across the scrollable span", () => {
    expect(progressToScrollTop(0, 100, 9000, 900)).toBe(100);
    expect(progressToScrollTop(1, 100, 9000, 900)).toBe(100 + 9000 - 900);
    expect(progressToScrollTop(0.5, 100, 9000, 900)).toBe(100 + 0.5 * 8100);
  });

  test("clamps progress and never returns a negative span", () => {
    expect(progressToScrollTop(2, 50, 900, 900)).toBe(50);
    expect(progressToScrollTop(-1, 50, 900, 900)).toBe(50);
  });
});

describe("module invariants", () => {
  test("scroll screens is a positive integer", () => {
    expect(Number.isInteger(SCROLL_SCREENS)).toBe(true);
    expect(SCROLL_SCREENS).toBeGreaterThan(0);
  });

  test("every turn is reachable in order and ends within the track", () => {
    let previousEnd = 0;
    for (const turn of TURNS) {
      expect(turn.segment.start).toBeGreaterThanOrEqual(previousEnd);
      expect(turn.segment.end).toBeLessThanOrEqual(1);
      previousEnd = turn.segment.end;
    }
  });
});
