import { describe, expect, test } from "bun:test";

import {
  PARCEL_NEXT,
  PARCEL_STEPS,
  PARCEL_STATUS,
  type ParcelStep,
} from "@/lib/womansDay/parcelMachine";

describe("parcel state machine", () => {
  test("three taps walk sealed → shake1 → shake2 → bloom, then stay at bloom", () => {
    let step: ParcelStep = "sealed";
    const visited: ParcelStep[] = [step];
    for (let i = 0; i < 6; i += 1) {
      step = PARCEL_NEXT[step];
      visited.push(step);
    }
    expect(visited).toEqual(["sealed", "shake1", "shake2", "bloom", "bloom", "bloom", "bloom"]);
  });

  test("bloom is terminal (a tap on an open box does nothing)", () => {
    expect(PARCEL_NEXT.bloom).toBe("bloom");
  });

  test("every step has a status line and is reachable", () => {
    for (const step of PARCEL_STEPS) {
      expect(typeof PARCEL_STATUS[step]).toBe("string");
      expect(PARCEL_STATUS[step].length).toBeGreaterThan(0);
    }
    expect(PARCEL_STEPS).toHaveLength(4);
  });

  test("there are exactly three interactive steps before bloom", () => {
    const interactive = PARCEL_STEPS.filter((step) => step !== "bloom");
    expect(interactive).toEqual(["sealed", "shake1", "shake2"]);
  });
});
