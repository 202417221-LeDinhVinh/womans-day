/**
 * Front-lip layer generator for the bouquet wrap.
 *
 * The four painted wraps (`public/womans-day/wrap/{kraft,blush,sage,linen}.webp`) each show
 * a paper cone whose tall BACK flap rises above the opening. The bouquet needs the cone in
 * two depth layers so heads and greenery can sit BETWEEN them:
 *
 *   - `wrap/<id>.webp`        the full art (back flap + interior + front cone), opaque,
 *                             drawn at the back, behind the flowers;
 *   - `wrap/<id>-front.webp`  the FRONT LIP only - the full art kept below the rim
 *                             polyline and erased above it (soft ~2 px edge), drawn in
 *                             FRONT of the flowers so the lower ring of heads tucks into
 *                             the paper.
 *
 * The rim polyline was measured from the alpha silhouette + a vision read of the fold on
 * kraft and sage (`RIM` below, image-fraction coordinates; the four wraps share one
 * silhouette within ~1 %). `bouquetSlots.ts` stores the same polyline as `RIM_POLYLINE` so
 * `rimY(x, coneScale)` and this generator cannot drift.
 *
 * Run: `bun scripts/womans-day/make-wrap-lip.ts`
 * Writes `public/womans-day/wrap/<id>-front.webp` (alpha WebP, same canvas as the source).
 */

import path from "node:path";
import sharpImport from "sharp";

type SharpPipeline = {
  ensureAlpha(): SharpPipeline;
  raw(): SharpPipeline;
  toBuffer(options: { resolveWithObject: true }): Promise<{
    data: Buffer;
    info: { width: number; height: number; channels: number };
  }>;
  webp(options: { quality?: number; alphaQuality?: number; effort?: number }): SharpPipeline;
  toFile(file: string): Promise<unknown>;
};

const sharp = sharpImport as unknown as (input: unknown, options?: unknown) => SharpPipeline;

const ROOT = process.cwd();
const WRAP_DIR = path.join(ROOT, "public", "womans-day", "wrap");
const IDS = ["kraft", "blush", "sage", "linen"] as const;

/**
 * Rim polyline in IMAGE-fraction coordinates (x, y of the trimmed art) - the top edge of
 * the front lip. MUST match `RIM_POLYLINE` in `lib/womansDay/bouquetSlots.ts`.
 */
const RIM: ReadonlyArray<{ x: number; y: number }> = [
  { x: 0.036, y: 0.216 },
  { x: 0.545, y: 0.315 },
  { x: 0.96, y: 0.216 },
];

/** Feather the cut by this many pixels so a tucked head never shows a hard line. */
const FEATHER = 2;

function rimYAt(fracX: number): number {
  const [a, b, c] = RIM;
  if (fracX <= b.x) {
    const t = (fracX - a.x) / (b.x - a.x);
    return a.y + (b.y - a.y) * t;
  }
  const t = (fracX - b.x) / (c.x - b.x);
  return b.y + (c.y - b.y) * t;
}

async function makeLip(id: string) {
  const input = path.join(WRAP_DIR, `${id}.webp`);
  const output = path.join(WRAP_DIR, `${id}-front.webp`);
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const pixels = new Uint8ClampedArray(data);

  for (let y = 0; y < height; y++) {
    const fy = y / (height - 1);
    for (let x = 0; x < width; x++) {
      const fx = x / (width - 1);
      const rim = rimYAt(fx);
      const ry = rim * (height - 1);
      const distance = y - ry; // >0 = below the rim (keep), <0 = above (erase)
      let factor: number;
      if (distance >= FEATHER) factor = 1;
      else if (distance <= -FEATHER) factor = 0;
      else factor = (distance + FEATHER) / (2 * FEATHER); // linear feather
      const aIndex = (y * width + x) * channels + 3;
      pixels[aIndex] = Math.round(pixels[aIndex] * factor);
    }
  }

  await sharp(Buffer.from(pixels.buffer), { raw: { width, height, channels } })
    .webp({ quality: 90, alphaQuality: 95, effort: 5 })
    .toFile(output);
  console.log(`lip  ${path.relative(ROOT, output)}  ${width}x${height}`);
}

for (const id of IDS) await makeLip(id);
