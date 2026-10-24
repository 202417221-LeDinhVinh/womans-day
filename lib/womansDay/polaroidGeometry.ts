/**
 * Geometry for the scratch polaroid, measured from `public/womans-day/polaroid/frame.webp`
 * (Plan 15 §3.1) — nothing here is eyeballed. The frame is drawn `object-contain` inside a
 * box; the photo window and foil sit at these percentages of that box.
 *
 * Measured (`.tmp-agy/measure-frame.cjs`, the frame's own alpha): the transparent photo
 * window is a rectangle inset inside the opaque card, wider at the bottom (the classic
 * polaroid strip).
 */

/** The frame's own pixel size (for reference; components use the percentages). */
export const FRAME_ART = { width: 602, height: 720 } as const;

/** The photo window rectangle, as percentages of the frame box. */
export const WINDOW = { left: 8.64, top: 7.92, width: 82.56, height: 69.86 } as const;

/** The bottom caption strip starts just below the window. */
export const CAPTION_TOP = WINDOW.top + WINDOW.height; // ≈ 77.78

/**
 * Derived "mostly scratched" flag: this fraction of the window cleared. It NEVER removes
 * foil — the foil is a lottery ticket and keeps every unscratched speck. It only drives
 * the caption hint / the coin putting itself away.
 */
export const REVEAL_AT = 0.55;

/**
 * Pure coverage maths over an RGBA alpha channel (one byte per pixel at offset 3):
 * the fraction of pixels with alpha < 128. A fully opaque mask is 0, a fully erased one
 * is 1. Extracted so a unit test pins it (the foil once reported 100 % on a blank mask).
 */
export function coverageOf(alpha: Uint8ClampedArray): number {
  const pixels = alpha.length / 4;
  if (pixels === 0) return 0;
  let cleared = 0;
  for (let i = 3; i < alpha.length; i += 4) {
    if (alpha[i] < 128) cleared += 1;
  }
  return cleared / pixels;
}
