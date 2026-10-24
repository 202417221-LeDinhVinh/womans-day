import {
  FILLERS,
  FLOWERS,
  HEAD_SIZES,
  PETALS,
  RIBBON_IDS,
  STEM_BY_FLOWER,
  WRAP_IDS,
  headSrc,
  petalSrc,
  ribbonSrc,
  wrapFrontSrc,
  wrapSrc,
} from "@/lib/womansDay/flowers";

/**
 * Every image the `/womans-day` route can show, as one list, so the route can warm the
 * whole set up front instead of fetching art in the middle of a scroll (the owner's
 * "it seems to fetch/reload every scroll").
 *
 * Built from the SAME helpers the components use (`headSrc`, `stemSrc`, wrap/ribbon
 * helpers, the sticker names) so it cannot drift; `assets.test.ts` additionally checks each
 * entry exists under `public/` and that no `/womans-day/...` literal in the components is
 * missing from this list.
 *
 * Not included: `og.jpg` (social card, not an in-page image), and the retired
 * `box/box-body` / `box/box-interior` (Plan 8), plus `box/box-untaped` / `box/tissue`
 * (Plan 11 — the parcel is now the two-state set `box-sealed` / `box-open`, no wrapper).
 */

const STEM_ARTS = ["rose", "smooth", "leafy"] as const;

/** Painted stickers, by manifest name (`/womans-day/stickers/<name>.webp`). */
export const STICKERS = [
  "butterfly",
  "camera",
  "cherries",
  "envelope-open",
  "envelope-sealed",
  "gold-star",
  "label-strip",
  "moon",
  "polaroid-library",
  "polaroid-study",
  "polaroid-sunrise",
  "pressed-leaf",
  "ribbon-bow",
  "torn-map",
  "torn-news",
  "washi-beige",
  "washi-pink",
  "washi-sage",
  "wax-seal",
] as const;

export type StickerName = (typeof STICKERS)[number];

/** Paper textures and the box pieces (opaque WebP / JPG). */
const PAPER = [
  "paper/cover-cloth",
  "paper/cream",
  "paper/grain",
  "paper/letter-bg",
  "paper/music-cover",
  "paper/spiral",
] as const;

const BOX = ["box/box-sealed", "box/box-open"] as const;

/** The garden spread's painted set (Plan 15 §6). */
const GARDEN = [
  "garden/ground-back",
  "garden/ground-front",
  "garden/leaf",
  "garden/bud",
  "garden/crumb-1",
  "garden/crumb-2",
  "garden/crumb-3",
  "garden/seed-packet",
  "garden/watering-can",
  "garden/cursor-seed",
] as const;

/** The scratch polaroid's painted set (Plan 15 §6). */
const POLAROID = [
  "polaroid/frame",
  "polaroid/empty-window",
  "polaroid/foil",
  "polaroid/coin",
  "polaroid/sparkle",
] as const;

/** Real portraits taped into the scrapbook collage (jpg, kept as-is). */
const SCRAPBOOK_PHOTOS = [
  "scrapbook/alysa-liu",
  "scrapbook/malala-yousafzai",
  "scrapbook/marie-curie",
] as const;

function flowerHeads(): string[] {
  return FLOWERS.flatMap((flower) => HEAD_SIZES.map((size) => headSrc(flower.id, size)));
}

function flowerStems(): string[] {
  // The three painted stems + the three greens' own stem art.
  return [
    ...STEM_ARTS.map((art) => `/womans-day/flowers/stems/${art}.webp`),
    ...FILLERS.map((filler) => `/womans-day/flowers/stems/${filler.id}.webp`),
  ];
}

function petals(): string[] {
  return PETALS.map((tone) => petalSrc(tone));
}

function wrapsAndBows(): string[] {
  return [
    ...WRAP_IDS.map((id) => wrapSrc(id)),
    ...WRAP_IDS.map((id) => wrapFrontSrc(id)),
    ...RIBBON_IDS.map((id) => ribbonSrc(id)),
  ];
}

function stickers(): string[] {
  return STICKERS.map((name) => `/womans-day/stickers/${name}.webp`);
}

/**
 * The critical, above-the-fold set: the cream paper, the cover, the wall heads and the
 * reader's own plate. Kept small (≈10-12 files) so it does not compete with the route
 * fonts on first paint.
 */
export function criticalImages(readerFlowerId: keyof typeof STEM_BY_FLOWER | null): string[] {
  return [
    "/womans-day/paper/cream.webp",
    "/womans-day/paper/cover-cloth.webp",
    "/womans-day/paper/spiral.webp",
    headSrc("lotus", 256),
    headSrc("rose", 256),
    headSrc("peony", 256),
    headSrc("ranunculus", 256),
    ...(readerFlowerId ? [headSrc(readerFlowerId, 512)] : []),
    "/womans-day/stickers/envelope-sealed.webp",
    "/womans-day/stickers/wax-seal.webp",
  ];
}

/** The non-critical set, loaded at idle after the critical set is decoded. */
export function deferredImages(): string[] {
  const all = WOMANS_DAY_IMAGES;
  const critical = new Set(criticalImages(null));
  return all.filter((src) => !critical.has(src));
}

/**
 * The florist-first tier: every species' 512 px bouquet head + the painted stems + all
 * wrap front/back art. `useWarmAssets` callers run these FIRST inside the deferred pool
 * so a picked flower's head is decoded before the click (the shelf only shows 256 px).
 * Always a subset of `WOMANS_DAY_IMAGES` (pinned by `assets.test.ts`).
 */
export function floristImages(): string[] {
  return Array.from(
    new Set<string>([
      ...FLOWERS.map((flower) => headSrc(flower.id, 512)),
      ...flowerStems(),
      ...WRAP_IDS.map((id) => wrapSrc(id)),
      ...WRAP_IDS.map((id) => wrapFrontSrc(id)),
    ])
  );
}

/** The full route image set. */
export const WOMANS_DAY_IMAGES: readonly string[] = Array.from(
  new Set<string>([
    ...PAPER.map((name) => `/womans-day/${name}.webp`),
    ...BOX.map((name) => `/womans-day/${name}.webp`),
    ...GARDEN.map((name) => `/womans-day/${name}.webp`),
    ...POLAROID.map((name) => `/womans-day/${name}.webp`),
    ...SCRAPBOOK_PHOTOS.map((name) => `/womans-day/${name}.jpg`),
    ...flowerHeads(),
    ...flowerStems(),
    ...petals(),
    ...wrapsAndBows(),
    ...stickers(),
  ])
);
