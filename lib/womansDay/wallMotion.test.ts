import { describe, expect, test } from "bun:test";

import { SEGMENTS } from "@/lib/womansDay/timeline";
import {
  ENTRY_WINDOW,
  bookExclusion,
  buildWall,
  exitDestination,
  exitProgress,
  exitStart,
  poseAt,
  type WallSprite,
} from "@/lib/womansDay/wallMotion";

const wall = buildWall();
const box = bookExclusion(false);

/** Parse the `translate3d(x vw, y vh, 0)` part of a pose back into fractions. */
function poseXY(sprite: WallSprite, progress: number): { x: number; y: number } {
  const { transform } = poseAt(sprite, progress, box);
  const match = /translate3d\((-?[\d.]+)vw,\s*(-?[\d.]+)vh/.exec(transform);
  if (!match) throw new Error(`unparsable transform: ${transform}`);
  return { x: Number(match[1]) / 100, y: Number(match[2]) / 100 };
}

describe("buildWall", () => {
  test("is deterministic and places 76 sprites on four rings", () => {
    const again = buildWall();
    expect(wall.length).toBe(76);
    expect(again.map((s) => s.id)).toEqual(wall.map((s) => s.id));
    expect(new Set(wall.map((s) => s.ring))).toEqual(new Set([0, 1, 2, 3]));
  });
});

describe("bookExclusion", () => {
  test("desktop is smaller than the viewport and mobile likewise", () => {
    const desktop = bookExclusion(false);
    const mobile = bookExclusion(true);
    for (const b of [desktop, mobile]) {
      expect(b.hw).toBeGreaterThan(0);
      expect(b.hh).toBeGreaterThan(0);
      expect(b.hw).toBeLessThan(0.5);
      expect(b.hh).toBeLessThan(0.5);
    }
    expect(desktop.hw).toBeLessThanOrEqual(0.43);
  });
});

describe("exit timing mirrors the entrance", () => {
  test("entry window is the same span the entrance eases over", () => {
    expect(ENTRY_WINDOW).toBeCloseTo(0.26 * (SEGMENTS.wallFull.end - SEGMENTS.bloomGrow.start), 10);
  });

  test("every sprite's exit window length equals the entry window length", () => {
    for (const sprite of wall) {
      const start = exitStart(sprite);
      const end = start + ENTRY_WINDOW;
      expect(end).toBeLessThanOrEqual(SEGMENTS.wallScatter.end + 1e-9);
      // exitProgress is 0 before the window and 1 after.
      expect(exitProgress(sprite, start - 0.001)).toBe(0);
      expect(exitProgress(sprite, end + 0.001)).toBe(1);
    }
  });

  test("ring 0 (inner) starts exiting before ring 3 (outer)", () => {
    const firstOf = (ring: number) => {
      const sprites = wall.filter((s) => s.ring === ring);
      return Math.min(...sprites.map(exitStart));
    };
    expect(firstOf(0)).toBeLessThan(firstOf(3));
    // Reverse order overall: rings leave in ascending ring order.
    expect(firstOf(1)).toBeLessThan(firstOf(2));
  });

  test("the last sprite's window ends exactly at wallScatter.end", () => {
    const latest = Math.max(...wall.map((s) => exitStart(s) + ENTRY_WINDOW));
    expect(latest).toBeCloseTo(SEGMENTS.wallScatter.end, 9);
  });
});

describe("continuity (no teleport)", () => {
  test("no step of 0.001 progress moves a sprite more than 4 % of the viewport", () => {
    const step = 0.001;
    for (let p = 0; p < 0.3; p += step) {
      for (const sprite of wall) {
        const a = poseXY(sprite, p);
        const b = poseXY(sprite, p + step);
        const dx = Math.abs(a.x - b.x);
        const dy = Math.abs(a.y - b.y);
        expect(dx).toBeLessThan(0.04);
        expect(dy).toBeLessThan(0.04);
      }
    }
  });

  test("the exit is no faster than the entrance (max step within 1.5x)", () => {
    const step = 0.0005;
    let entranceMax = 0;
    let exitMax = 0;
    for (const sprite of wall) {
      for (let p = 0; p < 0.26; p += step) {
        const a = poseXY(sprite, p);
        const b = poseXY(sprite, p + step);
        const move = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) * (0.001 / step);
        if (p < SEGMENTS.wallScatter.start) entranceMax = Math.max(entranceMax, move);
        else exitMax = Math.max(exitMax, move);
      }
    }
    expect(exitMax).toBeLessThanOrEqual(entranceMax * 1.5);
  });

  test("opacity is monotonic non-increasing once the exit begins", () => {
    const start = SEGMENTS.wallScatter.start;
    for (const sprite of wall) {
      let previous = poseAt(sprite, start, box).opacity;
      for (let p = start + 0.002; p <= SEGMENTS.wallScatter.end + 0.002; p += 0.002) {
        const current = poseAt(sprite, p, box).opacity;
        expect(current).toBeLessThanOrEqual(previous + 1e-9);
        previous = current;
      }
    }
  });
});

describe("every sprite ends clear of the book", () => {
  test("at wallScatter.end each sprite is outside the box or fully transparent", () => {
    for (const sprite of wall) {
      const pose = poseAt(sprite, SEGMENTS.wallScatter.end, box);
      const match = /translate3d\((-?[\d.]+)vw,\s*(-?[\d.]+)vh/.exec(pose.transform);
      const px = Number(match?.[1]) / 100;
      const py = Number(match?.[2]) / 100;
      const outside = Math.abs(px) >= box.hw || Math.abs(py) >= box.hh;
      expect(outside || pose.opacity <= 1e-6).toBe(true);
    }
  });

  test("destinations on screen keep a visible final opacity; off-screen ones fade to 0", () => {
    for (const sprite of wall) {
      const dest = exitDestination(sprite, box);
      const onScreen = Math.abs(dest.x) < 0.62 && Math.abs(dest.y) < 0.62;
      if (onScreen) expect(dest.opacity).toBe(sprite.finalOpacity);
      else expect(dest.opacity).toBe(0);
    }
  });
});
