/**
 * Procedural paper stock and painted backgrounds for /womans-day.
 *
 * These are textures, not illustrations: paper fibre, cloth weave, grain, wire binding,
 * the blurred floral wash behind the letter and the share card. Painted flowers still
 * come from the image generator (see .tmp-agy / process-assets.ts).
 *
 *   bun scripts/womans-day/generate-textures.ts
 */

import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharpImport from "sharp";

type Pipeline = {
  ensureAlpha(alpha?: number): Pipeline;
  rotate(angle: number, options?: unknown): Pipeline;
  blur(sigma?: number): Pipeline;
  modulate(options: { brightness?: number; saturation?: number; hue?: number }): Pipeline;
  resize(width?: number, height?: number, options?: unknown): Pipeline;
  composite(
    layers: Array<{ input: Buffer | string; left?: number; top?: number; blend?: string }>
  ): Pipeline;
  png(): Pipeline;
  webp(options?: { quality?: number; effort?: number; alphaQuality?: number }): Pipeline;
  jpeg(options?: { quality?: number; chromaSubsampling?: string; mozjpeg?: boolean }): Pipeline;
  toFile(file: string): Promise<unknown>;
  toBuffer(): Promise<Buffer>;
};

const sharp = sharpImport as unknown as (input: unknown, options?: unknown) => Pipeline;

const ROOT = process.cwd();
const OUT = path.join(ROOT, "public", "womans-day");
const FLOWERS = path.join(OUT, "flowers");

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothGrid(random: () => number, columns: number, rows: number) {
  const values = new Float32Array((columns + 1) * (rows + 1));
  for (let index = 0; index < values.length; index += 1) values[index] = random();
  return (x: number, y: number) => {
    const gx = x * columns;
    const gy = y * rows;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const tx = gx - x0;
    const ty = gy - y0;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const at = (ix: number, iy: number) =>
      values[Math.min(rows, Math.max(0, iy)) * (columns + 1) + Math.min(columns, Math.max(0, ix))];
    const top = at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx;
    const bottom = at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx;
    return top * (1 - sy) + bottom * sy;
  };
}

function writeRaw(
  width: number,
  height: number,
  channels: 3 | 4,
  paint: (x: number, y: number) => [number, number, number, number?]
) {
  const data = Buffer.alloc(width * height * channels);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a = 255] = paint(x, y);
      const index = (y * width + x) * channels;
      data[index] = Math.max(0, Math.min(255, Math.round(r)));
      data[index + 1] = Math.max(0, Math.min(255, Math.round(g)));
      data[index + 2] = Math.max(0, Math.min(255, Math.round(b)));
      if (channels === 4) data[index + 3] = Math.max(0, Math.min(255, Math.round(a)));
    }
  }
  return { data, raw: { width, height, channels } };
}

async function cream() {
  const width = 1400;
  const height = 1800;
  const random = mulberry32(5);
  const mottle = smoothGrid(random, 9, 12);
  const second = smoothGrid(random, 27, 34);
  const { data, raw } = writeRaw(width, height, 3, (x, y) => {
    const u = x / width;
    const v = y / height;
    const stains = (mottle(u, v) - 0.5) * 11 + (second(u, v) - 0.5) * 5 + (random() - 0.5) * 3.2;
    const vignette = -8 * ((u - 0.5) ** 2 + (v - 0.5) ** 2) ** 1.4 * 2.2;
    const fibre = Math.sin(y * 0.42 + mottle(u, v) * 12) * 0.9;
    return [
      243 + stains + vignette + fibre,
      236 + stains + vignette + fibre,
      220 + stains + vignette + fibre * 0.6,
    ];
  });
  await sharp(data, { raw })
    .webp({ quality: 78, effort: 5 })
    .toFile(path.join(OUT, "paper", "cream.webp"));
  console.log("cream.webp");
}

async function cloth() {
  const width = 1200;
  const height = 1600;
  const random = mulberry32(9);
  const wear = smoothGrid(random, 7, 9);
  const { data, raw } = writeRaw(width, height, 3, (x, y) => {
    const u = x / width;
    const v = y / height;
    const weave = Math.sin(x * 1.9) * Math.sin(y * 1.9) * 7 + Math.sin(x * 0.31 + y * 0.22) * 3;
    const grain = (random() - 0.5) * 9;
    const worn = (wear(u, v) - 0.5) * 22;
    const edge = -18 * Math.max(Math.abs(u - 0.5), Math.abs(v - 0.5)) ** 2 * 2;
    const base = 112 + weave + grain + worn + edge;
    return [base + 12, base - 46, base - 60];
  });
  await sharp(data, { raw })
    .webp({ quality: 80, effort: 5 })
    .toFile(path.join(OUT, "paper", "cover-cloth.webp"));
  console.log("cover-cloth.webp");
}

async function grain() {
  const size = 280;
  const random = mulberry32(13);
  const { data, raw } = writeRaw(size, size, 3, () => {
    const value = 148 + (random() - 0.5) * 78;
    return [value + 2, value, value - 4];
  });
  await sharp(data, { raw })
    .webp({ quality: 72, effort: 5 })
    .toFile(path.join(OUT, "paper", "grain.webp"));
  console.log("grain.webp");
}

async function spiral() {
  const width = 160;
  const height = 1600;
  const coils = 16;
  const { data, raw } = writeRaw(width, height, 4, (x, y) => {
    const normalizedX = (x - width / 2) / 66;
    for (let coil = 0; coil < coils; coil += 1) {
      const centerY = ((coil + 0.5) * height) / coils;
      const normalizedY = (y - centerY) / 17;
      const distance = Math.sqrt(normalizedX ** 2 + normalizedY ** 2);
      if (distance > 0.82 && distance < 1.12) {
        const shine = Math.max(0, 1 - Math.abs(normalizedY) * 2.2);
        const value = 62 + shine * 88;
        return [value, value - 3, value - 6, 235 - shine * 40];
      }
      if (distance > 1.12 && distance < 1.3 && normalizedY > 0) {
        return [38, 30, 26, 80];
      }
    }
    return [0, 0, 0, 0];
  });
  await sharp(data, { raw })
    .webp({ quality: 82, effort: 5, alphaQuality: 90 })
    .toFile(path.join(OUT, "paper", "spiral.webp"));
  console.log("spiral.webp");
}

async function flowerLayer(name: string, size: number, alpha: number, sigma: number) {
  const resized = await sharp(path.join(FLOWERS, name, "head.webp"))
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const rawMask = writeRaw(size, size, 4, () => [255, 255, 255, alpha * 255]);
  const mask = await sharp(rawMask.data, { raw: rawMask.raw }).png().toBuffer();
  return sharp(resized)
    .composite([{ input: mask, blend: "dest-in" }])
    .blur(sigma)
    .png()
    .toBuffer();
}

function radialSvg(
  width: number,
  height: number,
  inner: string,
  outer: string,
  cx = "50%",
  cy = "50%"
) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <radialGradient id="g" cx="${cx}" cy="${cy}" r="72%">
          <stop offset="0" stop-color="${inner}"/>
          <stop offset="1" stop-color="${outer}"/>
        </radialGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#g)"/>
    </svg>`
  );
}

async function letterBackground() {
  const width = 1600;
  const height = 2000;
  const layers: Array<{ input: Buffer; left: number; top: number }> = [
    { input: await flowerLayer("peony", 1180, 0.31, 26), left: 760, top: -220 },
    { input: await flowerLayer("ranunculus", 960, 0.26, 22), left: -190, top: 1180 },
    { input: await flowerLayer("camellia", 760, 0.22, 20), left: 1060, top: 1120 },
    { input: await flowerLayer("rose", 820, 0.2, 24), left: -220, top: -140 },
    { input: await flowerLayer("orchid", 620, 0.14, 18), left: 640, top: 880 },
  ];

  const wash = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <radialGradient id="light" cx="50%" cy="18%" r="68%">
          <stop offset="0" stop-color="#fff8f0" stop-opacity="0.72"/>
          <stop offset="0.6" stop-color="#f6e3dc" stop-opacity="0.28"/>
          <stop offset="1" stop-color="#e9c3c1" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#light)"/>
    </svg>`
  );

  const random = mulberry32(17);
  const noise = writeRaw(width, height, 3, () => {
    const value = 210 + (random() - 0.5) * 70;
    return [value, value - 4, value - 10];
  });
  const noisePng = await sharp(noise.data, { raw: noise.raw }).png().toBuffer();

  await sharp(radialSvg(width, height, "#f6dedb", "#e3b3b4"))
    .composite([
      ...layers,
      { input: wash, left: 0, top: 0 },
      { input: noisePng, left: 0, top: 0, blend: "soft-light" },
    ])
    .webp({ quality: 78, effort: 5 })
    .toFile(path.join(OUT, "paper", "letter-bg.webp"));
  console.log("letter-bg.webp");
}

async function musicCover() {
  const size = 900;
  const label = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <rect x="54" y="58" width="268" height="136" rx="6" fill="#f4e7d2" fill-opacity="0.9"/>
      <rect x="70" y="74" width="236" height="104" rx="3" fill="none" stroke="#9c6b57" stroke-opacity="0.55" stroke-width="2"/>
      <circle cx="700" cy="770" r="92" fill="#3a241f" fill-opacity="0.26"/>
      <rect x="0" y="0" width="${size}" height="${size}" fill="#7b4438" fill-opacity="0.16"/>
    </svg>`
  );
  await sharp(radialSvg(size, size, "#c98b78", "#6c3b33", "42%", "38%"))
    .composite([
      { input: await flowerLayer("rose", 640, 0.88, 0.6), left: 320, top: 300 },
      { input: await flowerLayer("peony", 380, 0.35, 3), left: 560, top: -90 },
      { input: label, left: 0, top: 0 },
    ])
    .webp({ quality: 80, effort: 5 })
    .toFile(path.join(OUT, "paper", "music-cover.webp"));
  console.log("music-cover.webp");
}

async function og() {
  const width = 1200;
  const height = 630;
  const text = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="18"/>
        </filter>
      </defs>
      <text x="86" y="204" font-family="Georgia, 'Times New Roman', serif" font-size="34" letter-spacing="7" fill="#8a6a55">RONAN SAT WORKBOOK</text>
      <text x="82" y="330" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="104" fill="#5b3a34">Women's Day</text>
      <text x="86" y="404" font-family="Georgia, 'Times New Roman', serif" font-size="44" fill="#8a5f52">A bloom for you.</text>
      <rect x="86" y="448" width="250" height="3" rx="1.5" fill="#b07a6a"/>
      <text x="86" y="512" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="30" fill="#9c7a63">A small celebration, 20.10</text>
    </svg>`
  );
  await sharp(path.join(OUT, "paper", "cream.webp"))
    .resize(width, height, { fit: "cover" })
    .composite([
      { input: await flowerLayer("peony", 620, 0.92, 0.4), left: 560, top: 0 },
      { input: await flowerLayer("ranunculus", 380, 0.28, 8), left: 730, top: 236 },
      { input: text, left: 0, top: 0 },
    ])
    .jpeg({ quality: 84, mozjpeg: true })
    .toFile(path.join(OUT, "og.jpg"));
  console.log("og.jpg");
}

await mkdir(path.join(OUT, "paper"), { recursive: true });
await cream();
await cloth();
await grain();
await spiral();
await letterBackground();
await musicCover();
await og();
