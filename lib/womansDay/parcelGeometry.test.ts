import { describe, expect, test } from "bun:test";

import { BOX_ART, FRONT_FACE, MOUTH, quadToMatrix3d } from "@/lib/womansDay/parcelGeometry";

/** Apply a CSS `matrix3d(...)` string to a 2-D point (z = 0) with a perspective divide. */
function applyMatrix3d(matrix: string, x: number, y: number): { x: number; y: number } {
  const inner = matrix.slice(matrix.indexOf("(") + 1, matrix.lastIndexOf(")"));
  const m = inner.split(",").map((value) => Number(value));
  // Column-major: m[c*4 + r] is row r of column c.
  const X = m[0] * x + m[4] * y + m[8] * 0 + m[12];
  const Y = m[1] * x + m[5] * y + m[9] * 0 + m[13];
  const W = m[3] * x + m[7] * y + m[11] * 0 + m[15];
  return { x: X / W, y: Y / W };
}

describe("parcelGeometry constants", () => {
  test("the art canvas is square 1024 and the front face has four corners in range", () => {
    expect(BOX_ART.width).toBe(1024);
    expect(BOX_ART.height).toBe(1024);
    expect(FRONT_FACE).toHaveLength(4);
    for (const corner of FRONT_FACE) {
      expect(corner.x).toBeGreaterThan(0);
      expect(corner.x).toBeLessThan(100);
      expect(corner.y).toBeGreaterThan(0);
      expect(corner.y).toBeLessThan(100);
    }
  });

  test("the mouth sits above the front face's lower half and is centred", () => {
    expect(MOUTH.centreX).toBeGreaterThan(45);
    expect(MOUTH.centreX).toBeLessThan(55);
    expect(MOUTH.frontEdgeY).toBeGreaterThan(35);
    expect(MOUTH.frontEdgeY).toBeLessThan(55);
  });
});

describe("quadToMatrix3d", () => {
  test("maps the element's four corners onto the quad corners (within 0.5 %)", () => {
    const w = 640;
    const h = 480;
    const matrix = quadToMatrix3d(FRONT_FACE, w, h);

    // Destination corners in px (same units the function uses internally).
    const dst = FRONT_FACE.map((p) => ({ x: (p.x / 100) * w, y: (p.y / 100) * h }));
    const src = [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: h },
      { x: 0, y: h },
    ];

    for (let i = 0; i < 4; i += 1) {
      const got = applyMatrix3d(matrix, src[i].x, src[i].y);
      const errX = Math.abs(got.x - dst[i].x) / w;
      const errY = Math.abs(got.y - dst[i].y) / h;
      expect(errX).toBeLessThan(0.005);
      expect(errY).toBeLessThan(0.005);
    }
  });

  test("an axis-aligned rectangle maps to itself (no perspective distortion)", () => {
    const w = 200;
    const h = 100;
    // Destination quad identical to the element rect (percent of the same w/h box).
    const rect = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    const matrix = quadToMatrix3d(rect, w, h);
    const centre = applyMatrix3d(matrix, w / 2, h / 2);
    // The rect's centre (no distortion) stays at the centre of the w×h box.
    expect(centre.x).toBeCloseTo(w / 2, 3);
    expect(centre.y).toBeCloseTo(h / 2, 3);
  });

  test("rejects a quad that is not four corners", () => {
    expect(() => quadToMatrix3d([{ x: 0, y: 0 }], 10, 10)).toThrow();
  });
});
