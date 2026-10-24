/**
 * Collage layout for the scrapbook spread, in page percentages.
 *
 * Absolute positioning from data (rather than hand-tuned Tailwind offsets) is what keeps
 * the page composed at every size: the book is 1100px wide on a laptop and ~350px on a
 * phone, and the taped polaroids, torn paper and label-tape quotes must keep their
 * relationships either way.
 *
 * For a `label`, `h` is a MINIMUM height (a floor) — the strip's real height comes from its
 * content, so a quote that wraps to two lines grows the tape instead of overflowing it.
 */

export type CollageBase = {
  /** Top-left corner, percent of the page. Negative values bleed off the edge. */
  x: number;
  y: number;
  /** Width, percent of the page. */
  w: number;
  rotate: number;
  z: number;
};

export type CollageItem =
  | (CollageBase & { kind: "sticker"; name: string })
  | (CollageBase & { kind: "washi"; tone: "beige" | "pink" | "sage" })
  | (CollageBase & { kind: "label"; text: string; h: number; tone?: "serif" | "mono" })
  | (CollageBase & { kind: "photo"; src: string; caption: string });

export const SCRAPBOOK_LEFT: readonly CollageItem[] = [
  { kind: "sticker", name: "torn-map", x: -9, y: 7, w: 48, rotate: -9, z: 3 },
  { kind: "sticker", name: "torn-news", x: 55, y: 9, w: 38, rotate: 7, z: 4 },
  {
    kind: "photo",
    src: "/womans-day/scrapbook/marie-curie.jpg",
    caption: "Marie Curie",
    x: 13,
    y: 20,
    w: 41,
    rotate: -4,
    z: 20,
  },
  { kind: "washi", tone: "beige", x: 24, y: 17, w: 18, rotate: -18, z: 26 },
  {
    kind: "photo",
    src: "/womans-day/scrapbook/malala-yousafzai.jpg",
    caption: "Malala Yousafzai",
    x: 56,
    y: 28,
    w: 34,
    rotate: 5,
    z: 22,
  },
  { kind: "washi", tone: "sage", x: 66, y: 25, w: 16, rotate: 12, z: 28 },
  { kind: "sticker", name: "gold-star", x: 8, y: 57, w: 7, rotate: -12, z: 30 },
  { kind: "sticker", name: "gold-star", x: 78, y: 17, w: 5, rotate: 18, z: 30 },
  { kind: "sticker", name: "pressed-leaf", x: 42, y: 62, w: 11, rotate: 24, z: 18 },
  {
    kind: "label",
    text: "“Nothing in life is to be feared, it is only to be understood. Now is the time to understand more, so that we may fear less.” — Marie Curie",
    x: 4,
    y: 76,
    w: 92,
    h: 11,
    rotate: -1.4,
    z: 40,
  },
  {
    kind: "label",
    text: "“One child, one teacher, one book, and one pen can change the world.” — Malala Yousafzai",
    x: 14,
    y: 90,
    w: 74,
    h: 8,
    rotate: 1.2,
    z: 39,
  },
] as const;

export const SCRAPBOOK_RIGHT: readonly CollageItem[] = [
  { kind: "sticker", name: "torn-map", x: 62, y: 62, w: 46, rotate: 9, z: 3 },
  {
    kind: "photo",
    src: "/womans-day/scrapbook/alysa-liu.jpg",
    caption: "Alysa Liu",
    x: 25,
    y: 13,
    w: 45,
    rotate: -3,
    z: 20,
  },
  { kind: "washi", tone: "pink", x: 42, y: 10, w: 17, rotate: -10, z: 26 },
  { kind: "sticker", name: "butterfly", x: 7, y: 22, w: 17, rotate: -14, z: 24 },
  { kind: "sticker", name: "ribbon-bow", x: 74, y: 4, w: 18, rotate: 8, z: 25 },
  { kind: "sticker", name: "moon", x: 10, y: 52, w: 14, rotate: -8, z: 15 },
  { kind: "sticker", name: "cherries", x: 78, y: 44, w: 16, rotate: 6, z: 16 },
  { kind: "washi", tone: "beige", x: 6, y: 44, w: 16, rotate: 24, z: 17 },
  {
    kind: "label",
    text: "“I love struggling, actually. It makes me feel alive.” — Alysa Liu",
    x: 10,
    y: 68,
    w: 80,
    h: 8,
    rotate: -1,
    z: 40,
  },
  {
    kind: "label",
    text: "Ronan SAT · 20.10",
    x: 26,
    y: 89,
    w: 48,
    h: 6,
    rotate: 1.6,
    z: 39,
    tone: "mono",
  },
] as const;
