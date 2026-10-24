/**
 * Asset preparation for /womans-day.
 *
 * Raw art is generated outside the repo (one painterly image per asset, on a flat
 * background). This script turns each raw PNG into a trimmed, alpha-cutout WebP
 * the page can layer: it flood-fills the flat background from the border, erodes
 * one pixel to kill the white/grey fringe, feathers the alpha, trims to content,
 * resizes, and encodes.
 *
 * Run after dropping new raws into `.tmp-agy/raw`:
 *   bun scripts/womans-day/process-assets.ts
 *   bun scripts/womans-day/process-assets.ts --only lotus
 */

import { mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import sharpImport from "sharp";

type SharpPipeline = {
  ensureAlpha(): SharpPipeline;
  raw(): SharpPipeline;
  toBuffer(options: { resolveWithObject: true }): Promise<{
    data: Buffer;
    info: { width: number; height: number; channels: number };
  }>;
  extract(region: { left: number; top: number; width: number; height: number }): SharpPipeline;
  resize(options: {
    width: number;
    height: number;
    fit: "inside";
    withoutEnlargement?: boolean;
  }): SharpPipeline;
  clone(): SharpPipeline;
  webp(options: { quality?: number; alphaQuality?: number; effort?: number }): SharpPipeline;
  png(): SharpPipeline;
  metadata(): Promise<{ width?: number; height?: number }>;
  toBuffer(options?: { resolveWithObject?: boolean }): Promise<Buffer>;
  toFile(file: string): Promise<unknown>;
};

// vinext stubs `sharp` as `unknown` for the app type space; this out-of-tree tooling
// script needs the real pipeline surface, so it carries the subset it actually uses.
const sharp = sharpImport as unknown as (input: unknown, options?: unknown) => SharpPipeline;

const ROOT = process.cwd();
const RAW_DIR = path.join(ROOT, ".tmp-agy", "raw");
const OUT_DIR = path.join(ROOT, "public", "womans-day");

type CutoutSpec = {
  kind: "cutout";
  /** Longest edge of the exported WebP. */
  size: number;
  /** Extra small variant for the flower wall (writes `<name>-sm.webp`). */
  small?: number;
  quality?: number;
  tolerance?: number;
  /** Erode this many pixels off the alpha edge before feathering. */
  erode?: number;
  /**
   * Trim to the opaque bbox (default true). Set FALSE to keep the full source canvas —
   * required for a SET of whole-state images (the parcel box) that must stay registered
   * to one another, since per-file trimming would shift each one differently.
   */
  trim?: boolean;
  /**
   * Crop to the BOTTOM `cropBottom` fraction of the source before cutting out. Used for the
   * garden ground art, whose usable soil band is only the bottom of a tall generated image.
   */
  cropBottom?: number;
};

type OpaqueSpec = {
  kind: "opaque";
  size: number;
  quality?: number;
  /** Optional focal crop before resize: [left, top, width, height]. */
  extract?: [number, number, number, number];
};

/**
 * Chroma-key: remove EVERY pixel near the key colour, not just the border flood fill. Used
 * for art whose SUBJECT contains near-white that must survive (the polaroid frame's white
 * card, generated on a flat teal ground): a border flood fill would leave the white card
 * alone but also fail to remove a teal pocket fully enclosed by the card. `key` is the flat
 * generated ground colour; `tolerance` is the squared-distance limit.
 */
type ChromaSpec = {
  kind: "chroma";
  size: number;
  /** The flat ground colour to remove, as [r, g, b]. */
  key: [number, number, number];
  tolerance?: number;
  /** Keep the full source canvas (default TRUE for registered art). */
  trim?: boolean;
  /** Crop to the BOTTOM `cropBottom` fraction of the source before keying. */
  cropBottom?: number;
};

type Spec = CutoutSpec | OpaqueSpec | ChromaSpec;

/**
 * Raw file (without extension, resolved case-insensitively) -> output path.
 * Output paths are relative to public/womans-day.
 */
const MANIFEST: Record<string, { out: string; spec: Spec }> = {
  // Flowers ---------------------------------------------------------------
  "lotus-head": { out: "flowers/lotus/head.webp", spec: { kind: "cutout", size: 512, small: 192 } },
  "rose-head": { out: "flowers/rose/head.webp", spec: { kind: "cutout", size: 512, small: 192 } },
  "peony-head": { out: "flowers/peony/head.webp", spec: { kind: "cutout", size: 512, small: 192 } },
  "lily-head": { out: "flowers/lily/head.webp", spec: { kind: "cutout", size: 512, small: 192 } },
  "sunflower-head": {
    out: "flowers/sunflower/head.webp",
    spec: { kind: "cutout", size: 512, small: 192 },
  },
  "tulip-head": { out: "flowers/tulip/head.webp", spec: { kind: "cutout", size: 512, small: 192 } },
  "daisy-head": { out: "flowers/daisy/head.webp", spec: { kind: "cutout", size: 512, small: 192 } },
  "lavender-head": {
    out: "flowers/lavender/head.webp",
    spec: { kind: "cutout", size: 512, small: 192 },
  },
  "iris-head": { out: "flowers/iris/head.webp", spec: { kind: "cutout", size: 512, small: 192 } },
  "camellia-head": {
    out: "flowers/camellia/head.webp",
    spec: { kind: "cutout", size: 512, small: 192 },
  },
  "ranunculus-head": {
    out: "flowers/ranunculus/head.webp",
    spec: { kind: "cutout", size: 512, small: 192 },
  },
  "orchid-head": {
    out: "flowers/orchid/head.webp",
    spec: { kind: "cutout", size: 512, small: 192 },
  },

  // Stems & fillers -------------------------------------------------------
  "stem-rose": { out: "flowers/stems/rose.webp", spec: { kind: "cutout", size: 1200 } },
  "stem-smooth": { out: "flowers/stems/smooth.webp", spec: { kind: "cutout", size: 1200 } },
  "stem-leafy": { out: "flowers/stems/leafy.webp", spec: { kind: "cutout", size: 1200 } },
  eucalyptus: { out: "flowers/stems/eucalyptus.webp", spec: { kind: "cutout", size: 1200 } },
  "babys-breath": { out: "flowers/stems/babys-breath.webp", spec: { kind: "cutout", size: 1200 } },
  fern: { out: "flowers/stems/fern.webp", spec: { kind: "cutout", size: 1200 } },

  // Loose petals ----------------------------------------------------------
  // Light-toned subjects (cream, blush, white blossoms) sit on a near-white ground; a
  // higher erode makes the halo *worse* (thin subject, blur remains) so they keep the
  // default. The faint rim on cream is invisible over the cream stage anyway.
  "petal-crimson": { out: "flowers/petals/crimson.webp", spec: { kind: "cutout", size: 220 } },
  "petal-blush": { out: "flowers/petals/blush.webp", spec: { kind: "cutout", size: 220 } },
  "petal-cream": { out: "flowers/petals/cream.webp", spec: { kind: "cutout", size: 220 } },
  "petal-dusty": { out: "flowers/petals/dusty.webp", spec: { kind: "cutout", size: 220 } },

  // Stickers --------------------------------------------------------------
  "torn-map": { out: "stickers/torn-map.webp", spec: { kind: "cutout", size: 720 } },
  "torn-news": { out: "stickers/torn-news.webp", spec: { kind: "cutout", size: 720 } },
  "washi-beige": { out: "stickers/washi-beige.webp", spec: { kind: "cutout", size: 640 } },
  "washi-pink": { out: "stickers/washi-pink.webp", spec: { kind: "cutout", size: 640 } },
  "washi-sage": { out: "stickers/washi-sage.webp", spec: { kind: "cutout", size: 640 } },
  "gold-star": { out: "stickers/gold-star.webp", spec: { kind: "cutout", size: 320 } },
  butterfly: { out: "stickers/butterfly.webp", spec: { kind: "cutout", size: 420 } },
  cherries: { out: "stickers/cherries.webp", spec: { kind: "cutout", size: 420 } },
  moon: { out: "stickers/moon.webp", spec: { kind: "cutout", size: 420 } },
  camera: { out: "stickers/camera.webp", spec: { kind: "cutout", size: 520 } },
  "wax-seal": { out: "stickers/wax-seal.webp", spec: { kind: "cutout", size: 260, erode: 7 } },
  "kraft-tag": { out: "stickers/kraft-tag.webp", spec: { kind: "cutout", size: 420 } },
  "label-strip": { out: "stickers/label-strip.webp", spec: { kind: "cutout", size: 720 } },
  "ribbon-bow": { out: "stickers/ribbon-bow.webp", spec: { kind: "cutout", size: 420 } },
  "pressed-leaf": { out: "stickers/pressed-leaf.webp", spec: { kind: "cutout", size: 360 } },
  "polaroid-study": { out: "stickers/polaroid-study.webp", spec: { kind: "cutout", size: 720 } },
  "polaroid-library": {
    out: "stickers/polaroid-library.webp",
    spec: { kind: "cutout", size: 720 },
  },
  "polaroid-sunrise": {
    out: "stickers/polaroid-sunrise.webp",
    spec: { kind: "cutout", size: 720 },
  },

  // Paper & scenes --------------------------------------------------------
  "paper-cream": { out: "paper/cream.webp", spec: { kind: "opaque", size: 1024 } },
  "paper-cover": { out: "paper/cover-cloth.webp", spec: { kind: "opaque", size: 1024 } },
  "letter-bg": { out: "paper/letter-bg.webp", spec: { kind: "opaque", size: 1400 } },
  "music-cover": { out: "paper/music-cover.webp", spec: { kind: "opaque", size: 640 } },
  "spiral-strip": { out: "paper/spiral.webp", spec: { kind: "cutout", size: 900 } },

  // Parcel ----------------------------------------------------------------
  // Whole-state art only (Plan 8 direction): the parcel is ONE painted object per beat,
  // derived from a single reference so both states share an identical canvas. They are
  // cut out (background → transparent) but `trim: false`, so the 1024×1024 canvas is kept
  // intact and the measured `FRONT_FACE`/`MOUTH` in `lib/womansDay/parcelGeometry.ts` stay
  // registered across both. `erode: 1` keeps the box edge crisp (the white ground
  // flood-fills cleanly, so it does not need the default 4). There is no separate
  // `flap`/`tape` piece; `box-body`/`box-interior` (Plan 8) and `box-untaped`/`box-tissue`
  // (Plan 11) are retired.
  "box-sealed": {
    out: "box/box-sealed.webp",
    spec: { kind: "cutout", size: 1024, trim: false, erode: 1 },
  },
  "box-open": {
    out: "box/box-open.webp",
    spec: { kind: "cutout", size: 1024, trim: false, erode: 1 },
  },

  // Wrapping & ribbon -----------------------------------------------------
  "wrap-kraft": { out: "wrap/kraft.webp", spec: { kind: "cutout", size: 1000 } },
  "wrap-blush": { out: "wrap/blush.webp", spec: { kind: "cutout", size: 1000 } },
  "wrap-sage": { out: "wrap/sage.webp", spec: { kind: "cutout", size: 1000 } },
  "wrap-linen": { out: "wrap/linen.webp", spec: { kind: "cutout", size: 1000 } },
  "bow-blush": { out: "wrap/bow-blush.webp", spec: { kind: "cutout", size: 460 } },
  "bow-cream": { out: "wrap/bow-cream.webp", spec: { kind: "cutout", size: 460 } },
  "bow-red": { out: "wrap/bow-red.webp", spec: { kind: "cutout", size: 460 } },
  "bow-sage": { out: "wrap/bow-sage.webp", spec: { kind: "cutout", size: 460 } },

  // Envelopes -------------------------------------------------------------
  "envelope-sealed": { out: "stickers/envelope-sealed.webp", spec: { kind: "cutout", size: 700 } },
  "envelope-open": { out: "stickers/envelope-open.webp", spec: { kind: "cutout", size: 900 } },

  // Garden spread (Plan 15 §6) --------------------------------------------
  // The two ground strips are wide and short; they keep their canvas horizontally so they
  // can sit edge to edge on the page (trim only vertically is not available, so they trim
  // then resize by the longest edge, which is the width).
  "garden-ground-back": {
    out: "garden/ground-back.webp",
    // The generated soil horizon sits in the bottom fifth of a tall image; crop to it so the
    // strip is a wide band that fills its box (Plan 15 §6).
    spec: { kind: "cutout", size: 2048, trim: false, cropBottom: 0.32 },
  },
  "garden-ground-front": {
    out: "garden/ground-front.webp",
    // The foreground grass sits in the lower half of the generated strip; crop so the band
    // fills its box and hides the stem bases.
    spec: {
      kind: "chroma",
      size: 2048,
      key: [111, 143, 151],
      tolerance: 70,
      trim: false,
      cropBottom: 0.55,
    },
  },
  "garden-leaf": { out: "garden/leaf.webp", spec: { kind: "cutout", size: 320 } },
  "garden-bud": { out: "garden/bud.webp", spec: { kind: "cutout", size: 240 } },
  "garden-crumb-1": { out: "garden/crumb-1.webp", spec: { kind: "cutout", size: 96 } },
  "garden-crumb-2": { out: "garden/crumb-2.webp", spec: { kind: "cutout", size: 96 } },
  "garden-crumb-3": { out: "garden/crumb-3.webp", spec: { kind: "cutout", size: 96 } },
  // The seed packet's label area is near-white and must survive: generated on a flat teal
  // ground and chroma-keyed.
  "garden-seed-packet": {
    out: "garden/seed-packet.webp",
    spec: { kind: "chroma", size: 420, key: [111, 143, 151], tolerance: 62 },
  },
  "garden-watering-can": { out: "garden/watering-can.webp", spec: { kind: "cutout", size: 420 } },
  "garden-cursor-seed": { out: "garden/cursor-seed.webp", spec: { kind: "cutout", size: 32 } },

  // Scratch polaroid (Plan 15 §6) -----------------------------------------
  // The frame's white card is the subject and must stay: generated on a flat teal ground
  // and chroma-keyed (the photo window is filled with the same teal so it becomes
  // transparent).
  "polaroid-frame": {
    out: "polaroid/frame.webp",
    spec: { kind: "chroma", size: 720, key: [111, 143, 151], tolerance: 62 },
  },
  "polaroid-empty-window": {
    out: "polaroid/empty-window.webp",
    spec: { kind: "opaque", size: 640 },
  },
  "polaroid-foil": { out: "polaroid/foil.webp", spec: { kind: "opaque", size: 1024 } },
  "polaroid-coin": { out: "polaroid/coin.webp", spec: { kind: "cutout", size: 260 } },
  "polaroid-sparkle": {
    out: "polaroid/sparkle.webp",
    spec: { kind: "chroma", size: 128, key: [111, 143, 151], tolerance: 62 },
  },
};

function dist2(r: number, g: number, b: number, br: number, bg: number, bb: number) {
  const dr = r - br;
  const dg = g - bg;
  const db = b - bb;
  return dr * dr + dg * dg + db * db;
}

async function cutout(input: string, output: string, spec: CutoutSpec) {
  let source: string | Buffer = input;
  if (spec.cropBottom && spec.cropBottom > 0 && spec.cropBottom < 1) {
    // Pre-crop to the bottom fraction of the source (a tall soil art with the usable band
    // only at the bottom), then cut that out.
    const meta = await sharp(input).metadata();
    const srcW = meta.width ?? 0;
    const srcH = meta.height ?? 0;
    const keepH = Math.max(1, Math.round(srcH * spec.cropBottom));
    source = await sharp(input)
      .extract({ left: 0, top: srcH - keepH, width: srcW, height: keepH })
      .png()
      .toBuffer();
  }
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const pixels = new Uint8ClampedArray(data);
  const alpha = new Uint8Array(width * height).fill(255);
  const mask = new Uint8Array(width * height);

  // Background colour = median of the four corner patches (the raws are painted
  // on a flat surface, but generated images are never exactly one value).
  const sample: Array<[number, number, number]> = [];
  const patch = 4;
  for (const [x0, y0] of [
    [0, 0],
    [width - patch, 0],
    [0, height - patch],
    [width - patch, height - patch],
  ] as const) {
    for (let y = y0; y < y0 + patch; y += 1) {
      for (let x = x0; x < x0 + patch; x += 1) {
        const i = (y * width + x) * channels;
        sample.push([pixels[i], pixels[i + 1], pixels[i + 2]]);
      }
    }
  }
  const median = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const br = median(sample.map(([r]) => r));
  const bg = median(sample.map(([, g]) => g));
  const bb = median(sample.map(([, b]) => b));

  const tolerance = spec.tolerance ?? 58;
  const limit = tolerance * tolerance;
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  const isBackground = (index: number) => {
    const i = index * channels;
    if (pixels[i + 3] === 0) return true;
    return dist2(pixels[i], pixels[i + 1], pixels[i + 2], br, bg, bb) <= limit;
  };

  const seed = (index: number) => {
    if (mask[index] || !isBackground(index)) return;
    mask[index] = 1;
    queue[tail++] = index;
  };

  for (let x = 0; x < width; x += 1) {
    seed(x);
    seed((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    seed(y * width);
    seed(y * width + width - 1);
  }

  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = (index / width) | 0;
    if (x > 0) seed(index - 1);
    if (x + 1 < width) seed(index + 1);
    if (y > 0) seed(index - width);
    if (y + 1 < height) seed(index + width);
  }

  // Erode the opaque region by `erode` pixels so the anti-aliased rim (and any
  // painted drop shadow that survived the flood) cannot leave a halo.
  const erode = spec.erode ?? 4;
  let edgeMask = mask;
  for (let pass = 0; pass < erode; pass += 1) {
    const next = Uint8Array.from(edgeMask);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x;
        if (edgeMask[index]) continue;
        if (
          (x > 0 && edgeMask[index - 1]) ||
          (x + 1 < width && edgeMask[index + 1]) ||
          (y > 0 && edgeMask[index - width]) ||
          (y + 1 < height && edgeMask[index + width])
        ) {
          next[index] = 1;
        }
      }
    }
    edgeMask = next;
  }

  for (let index = 0; index < alpha.length; index += 1) {
    if (edgeMask[index]) alpha[index] = 0;
  }

  // Two-pass box blur, radius 1, for a soft cut edge.
  const blurPass = (source: Uint8Array, horizontal: boolean) => {
    const next = Uint8Array.from(source);
    const step = horizontal ? 1 : width;
    const span = horizontal ? width : height;
    for (let line = 0; line < (horizontal ? height : width); line += 1) {
      const base = horizontal ? line * width : line;
      for (let i = 1; i + 1 < span; i += 1) {
        const index = base + i * step;
        next[index] = Math.round(
          (source[index - step] + source[index] * 2 + source[index + step]) / 4
        );
      }
    }
    return next;
  };
  let feathered = blurPass(blurPass(alpha, true), false);
  feathered = blurPass(feathered, false);

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      pixels[index * channels + 3] = feathered[index];
      if (feathered[index] > 12) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error(`No opaque content in ${input}`);

  // Trim to the content bbox by default; a registered SET (the parcel box) keeps the full
  // canvas so all members stay aligned.
  const trim = spec.trim ?? true;
  let crop = { left: 0, top: 0, width, height };
  if (trim) {
    const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.015);
    const left = Math.max(0, minX - pad);
    const top = Math.max(0, minY - pad);
    const right = Math.min(width - 1, maxX + pad);
    const bottom = Math.min(height - 1, maxY + pad);
    crop = { left, top, width: right - left + 1, height: bottom - top + 1 };
  }

  await mkdir(path.dirname(output), { recursive: true });
  const base = sharp(Buffer.from(pixels.buffer), { raw: { width, height, channels } })
    .extract(crop)
    .resize({ width: spec.size, height: spec.size, fit: "inside", withoutEnlargement: true });

  await base
    .clone()
    .webp({ quality: spec.quality ?? 82, alphaQuality: 92, effort: 5 })
    .toFile(output);

  if (spec.small) {
    const small = output.replace(/\.webp$/, "-sm.webp");
    await base
      .clone()
      .resize({ width: spec.small, height: spec.small, fit: "inside" })
      .webp({ quality: 76, alphaQuality: 90, effort: 5 })
      .toFile(small);
  }
  console.log(`cutout  ${path.relative(ROOT, output)}`);
}

async function chroma(input: string, output: string, spec: ChromaSpec) {
  let source: string | Buffer = input;
  if (spec.cropBottom && spec.cropBottom > 0 && spec.cropBottom < 1) {
    const meta = await sharp(input).metadata();
    const srcW = meta.width ?? 0;
    const srcH = meta.height ?? 0;
    const keepH = Math.max(1, Math.round(srcH * spec.cropBottom));
    source = await sharp(input)
      .extract({ left: 0, top: srcH - keepH, width: srcW, height: keepH })
      .png()
      .toBuffer();
  }
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const pixels = new Uint8ClampedArray(data);
  const [kr, kg, kb] = spec.key;
  const tolerance = spec.tolerance ?? 62;
  const limit = tolerance * tolerance;
  const alpha = new Uint8Array(width * height);

  for (let index = 0; index < width * height; index += 1) {
    const i = index * channels;
    // Remove EVERY pixel near the key colour, not only a border flood fill: the polaroid
    // card's photo window is filled with the same teal, so it becomes transparent while the
    // white card around it survives.
    alpha[index] = dist2(pixels[i], pixels[i + 1], pixels[i + 2], kr, kg, kb) <= limit ? 0 : 255;
  }

  // Soften the cut edge (same two-pass box blur as the cutout path).
  const blurPass = (source: Uint8Array, horizontal: boolean) => {
    const next = Uint8Array.from(source);
    const step = horizontal ? 1 : width;
    const span = horizontal ? width : height;
    for (let line = 0; line < (horizontal ? height : width); line += 1) {
      const base = horizontal ? line * width : line;
      for (let i = 1; i + 1 < span; i += 1) {
        const index = base + i * step;
        next[index] = Math.round(
          (source[index - step] + source[index] * 2 + source[index + step]) / 4
        );
      }
    }
    return next;
  };
  const feathered = blurPass(blurPass(alpha, true), false);

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      pixels[index * channels + 3] = feathered[index];
      if (feathered[index] > 12) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error(`No opaque content in ${input}`);

  const trim = spec.trim ?? true;
  let crop = { left: 0, top: 0, width, height };
  if (trim) {
    const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.015);
    const left = Math.max(0, minX - pad);
    const top = Math.max(0, minY - pad);
    const right = Math.min(width - 1, maxX + pad);
    const bottom = Math.min(height - 1, maxY + pad);
    crop = { left, top, width: right - left + 1, height: bottom - top + 1 };
  }

  await mkdir(path.dirname(output), { recursive: true });
  await sharp(Buffer.from(pixels.buffer), { raw: { width, height, channels } })
    .extract(crop)
    .resize({ width: spec.size, height: spec.size, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82, alphaQuality: 92, effort: 5 })
    .toFile(output);
  console.log(`chroma  ${path.relative(ROOT, output)}`);
}

async function opaque(input: string, output: string, spec: OpaqueSpec) {
  await mkdir(path.dirname(output), { recursive: true });
  let pipeline = sharp(input);
  if (spec.extract) {
    const [left, top, width, height] = spec.extract;
    pipeline = pipeline.extract({ left, top, width, height });
  }
  await pipeline
    .resize({ width: spec.size, height: spec.size, fit: "inside", withoutEnlargement: true })
    .webp({ quality: spec.quality ?? 80, effort: 5 })
    .toFile(output);
  console.log(`opaque  ${path.relative(ROOT, output)}`);
}

async function findRaw(name: string) {
  const entries = await readdir(RAW_DIR);
  const match = entries.find((entry) => entry.replace(/\.[^.]+$/, "") === name);
  return match ? path.join(RAW_DIR, match) : null;
}

async function main() {
  const onlyArg = process.argv.indexOf("--only");
  const only = onlyArg >= 0 ? process.argv[onlyArg + 1] : null;
  if (!(await stat(RAW_DIR).catch(() => null))) {
    console.log(`No raw directory at ${RAW_DIR}`);
    return;
  }
  for (const [name, { out, spec }] of Object.entries(MANIFEST)) {
    if (only && !name.includes(only)) continue;
    const input = await findRaw(name);
    if (!input) {
      console.log(`skip    ${name} (no raw file)`);
      continue;
    }
    const output = path.join(OUT_DIR, out);
    if (spec.kind === "cutout") await cutout(input, output, spec);
    else if (spec.kind === "chroma") await chroma(input, output, spec);
    else await opaque(input, output, spec);
  }
}

await main();
