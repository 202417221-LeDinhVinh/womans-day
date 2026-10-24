/**
 * Measured geometry of the `/womans-day` parcel box (Plan 8).
 *
 * The box is a SET of whole-state paintings of ONE reference (`box-sealed`), derived by
 * image editing so both share an identical 1024×1024 canvas:
 *   `box/box-sealed.webp`   closed, beige paper tape on the lid seam folding over the front
 *   `box/box-open.webp`     same box, flaps folded outward, dark empty interior
 * (The `box-untaped` and `tissue` states were retired in Plan 11.)
 * `ParcelBox` draws every state as `absolute inset-0 w-full h-full` inside a wrapper with
 * this art's aspect ratio, so a percentage of this file equals a percentage of the art.
 *
 * The numbers below were measured from the generated art, NOT eyeballed:
 *   - FRONT_FACE corners from `box-sealed.png` (1024×1024): cross-checked two ways — an
 *     independent silhouette scan (left edge x ≈ 104–111, leading bottom corner x ≈ 521,
 *     y ≈ 881, left edge divergence near y ≈ 713–718) and a vision read of the same image;
 *     both agree. The front face spans x ≈ 105–523, y ≈ 320 (top-left) to 881 (bottom-right).
 *   - MOUTH from `box-open.png` (1024×1024): vision read of the dark opening — centre x 515,
 *     front edge y 460, opening width 695 (the width includes the flaps; the bloom uses a
 *     narrower fraction of it, see `MOUTH.bloomWidthPercent`).
 *
 * Regenerating the art changes these numbers: re-measure and update this file.
 */

/** The shared art canvas, in pixels (both states are this size after processing). */
export const BOX_ART = { width: 1024, height: 1024 } as const;

/** A point as a percent of the art (x of width, y of height). */
export type ArtPoint = { x: number; y: number };

/**
 * The FRONT face of `box-sealed`, four corners as percents of the art, in order
 * top-left, top-right, bottom-right, bottom-left (the order `quadToMatrix3d` expects).
 */
export const FRONT_FACE: readonly ArtPoint[] = [
  { x: (105 / 1024) * 100, y: (320 / 1024) * 100 }, // top-left
  { x: (523 / 1024) * 100, y: (442 / 1024) * 100 }, // top-right
  { x: (523 / 1024) * 100, y: (880 / 1024) * 100 }, // bottom-right
  { x: (111 / 1024) * 100, y: (713 / 1024) * 100 }, // bottom-left
] as const;

/**
 * The open box's mouth (where flowers rise from and the glow sits), as percents of the art.
 * `frontEdgeY` is where the front wall meets the dark interior — nothing may be drawn below
 * it on the first frame of the bloom so flowers read as emerging from inside the box.
 */
export const MOUTH = {
  /** Horizontal centre of the opening, percent of art width. */
  centreX: (515 / 1024) * 100,
  /** The front edge of the dark opening, percent of art height. */
  frontEdgeY: (460 / 1024) * 100,
  /** Full dark-opening width, percent of art width (includes the folded flaps). */
  fullWidthPercent: (695 / 1024) * 100,
  /** The bloom fans over this fraction of the full opening width. */
  bloomWidthPercent: 46,
} as const;

/** A 2D source rectangle corner in local element pixels. */
type PxPoint = { x: number; y: number };

/**
 * The homography (4-point projective transform) that maps an ELEMENT of size
 * `width × height` (its local origin at its top-left, `transform-origin: 0 0`) onto the
 * destination quad, returned as a CSS `matrix3d(...)` string.
 *
 * `quad` is the DESTINATION in the SAME pixel units as `width`/`height`, in order
 * TL, TR, BR, BL. The caller positions the element so its untransformed top-left sits at
 * the quad's top-left (e.g. `left: quadLeftPct%; top: quadTopPct%` on the art box) and
 * gives it size `width × height`, then applies this matrix.
 *
 * Typical use for the shipping label: size the element to the front face's bounding box in
 * px, place it at that box's top-left, and apply `quadToMatrix3d(FRONT_FACE, boxW, boxH)` so
 * the rectangle is warped onto the measured face (the content is inset a few %).
 *
 * Implementation: standard rect→quad homography (Heckbert). The 3×3 matrix maps homogeneous
 * `(x, y, 1)` to `(X, Y, W)`; it is expanded to a 4×4 column-major `matrix3d` with the z
 * row/column from the identity, so the mapping lives entirely in the z=0 plane.
 */
export function quadToMatrix3d(quad: readonly ArtPoint[], width: number, height: number): string {
  if (quad.length !== 4) throw new Error("quadToMatrix3d: expected 4 corners");

  // Destination corners in the caller's pixel units.
  const [tl, tr, br, bl] = quad.map((p) => ({
    x: (p.x / 100) * width,
    y: (p.y / 100) * height,
  }));

  // Source corners of the element's own rect (local px, origin top-left).
  const src: PxPoint[] = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
  const dst = [tl, tr, br, bl];

  // Solve for the 8 homography coefficients h11..h32 with h33 = 1 (Heckbert's method).
  // For each correspondence:  X = (h11 x + h12 y + h13) / (h31 x + h32 y + 1)
  //                           Y = (h21 x + h22 y + h23) / (h31 x + h32 y + 1)
  const a: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i += 1) {
    const { x, y } = src[i];
    const { x: X, y: Y } = dst[i];
    a.push([x, y, 1, 0, 0, 0, -x * X, -y * X]);
    b.push(X);
    a.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]);
    b.push(Y);
  }
  const h = solve(a, b); // length 8

  // CSS `matrix3d` is COLUMN-major: m11,m21,m31,m41, m12,m22,m32,m42, ...
  // With z untouched, the 2-D homography sits in the (x,y,w) rows/cols. The full 4×4 is
  // [ h11 h12 0 h13 ; h21 h22 0 h23 ; 0 0 1 0 ; h31 h32 0 1 ] written column-major:
  const mat = [
    h[0],
    h[3],
    0,
    h[6], // column 1: m11 m21 m31 m41
    h[1],
    h[4],
    0,
    h[7], // column 2: m12 m22 m32 m42
    0,
    0,
    1,
    0, // column 3: m13 m23 m33 m43
    h[2],
    h[5],
    0,
    1, // column 4: m14 m24 m34 m44
  ];
  return `matrix3d(${mat.map((value) => Number(value.toFixed(8))).join(",")})`;
}

/**
 * Gaussian elimination with partial pivoting for an 8×8 system. Small and dependency-free;
 * the system is well-conditioned for a convex box face.
 */
function solve(a: number[][], b: number[]): number[] {
  const n = b.length;
  const M = a.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col += 1) {
    // Partial pivot.
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(M[row][col]) > Math.abs(M[pivot][col])) pivot = row;
    }
    if (Math.abs(M[pivot][col]) < 1e-12) throw new Error("quadToMatrix3d: degenerate quad");
    [M[col], M[pivot]] = [M[pivot], M[col]];
    // Normalise the pivot row.
    const pivotValue = M[col][col];
    for (let k = col; k <= n; k += 1) M[col][k] /= pivotValue;
    // Eliminate the column from every other row.
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = M[row][col];
      if (factor === 0) continue;
      for (let k = col; k <= n; k += 1) M[row][k] -= factor * M[col][k];
    }
  }
  return M.map((row) => row[n]);
}
