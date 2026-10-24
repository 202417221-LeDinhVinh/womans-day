/**
 * The twelve species of the Women's Day page, plus the greenery fillers.
 *
 * One list drives everything: the flower hash (`flowerHash.ts`), the backdrop wall
 * (`components/womans-day/FlowerWall.tsx`), the parcel, the florist shelf, the bouquet
 * slots (`bouquetSlots.ts`), the keepsake card and the gift link codec
 * (`giftLink.ts`). The ORDER IS PART OF THE CONTRACT: `flowerIndexForName()` returns an
 * index into this array, so appending is safe and reordering is a breaking change for
 * every link already sent.
 */

export const FLOWERS = [
  {
    id: "lotus",
    name: "Lotus",
    latin: "Nelumbo nucifera",
    meaning: "resilience",
    hue: "#c4566f",
    note: "20–30 petals · opens at first light",
    reading:
      "Some things bloom best in still water. The lotus spends its mornings in the mud and its afternoons in the sun, and it never once apologises for either. You have a habit of doing the same: showing up on the days that feel heavy, finishing the practice set you promised yourself, coming back the next morning. That is not luck. That is a root system.",
  },
  {
    id: "rose",
    name: "Pink rose",
    latin: "Rosa chinensis",
    meaning: "grace and gratitude",
    hue: "#b8324b",
    note: "thorns on the stem · petals in fives",
    reading:
      "Grace is not softness. A rose grows thorns on the way to its petals, then opens anyway, and we still call it beautiful. You have been learning that same negotiation: taking care of yourself and taking the exam seriously, at the same time, without letting either one swallow the other. Gratitude is what keeps the two from turning into a tug of war.",
  },
  {
    id: "peony",
    name: "Peony",
    latin: "Paeonia lactiflora",
    meaning: "honour and a bright future",
    hue: "#d06a86",
    note: "a whole spring of preparation · opens all at once",
    reading:
      "Peonies take their time. They spend a whole spring preparing, then open all at once, so generously that the stems bend under the weight. Honour is often like this: quiet, patient work that nobody claps for, followed by a season where everyone can suddenly see it. Your future is not late. It is still forming.",
  },
  {
    id: "lily",
    name: "White lily",
    latin: "Lilium candidum",
    meaning: "devotion and a pure heart",
    hue: "#b99c62",
    note: "fragrant · keeps its scent in any room",
    reading:
      "The lily keeps its scent. You can move it into any room and it changes the air instead of the other way around. Devotion looks like that: consistent, unhurried, unmistakably yours. You do not have to raise your voice to be taken seriously, and you never have.",
  },
  {
    id: "sunflower",
    name: "Sunflower",
    latin: "Helianthus annuus",
    meaning: "warmth",
    hue: "#c98a1e",
    note: "turns to face the available light",
    reading:
      "Sunflowers turn to face whatever light is available. That is not optimism; it is technique. On the days when motivation is thin, you have a habit of finding one small bright thing — a solved question, a friend at the next desk, a song — and turning toward it. Every room you study in is a little warmer because of that.",
  },
  {
    id: "tulip",
    name: "Tulip",
    latin: "Tulipa gesneriana",
    meaning: "quiet confidence",
    hue: "#c4553f",
    note: "does the difficult part underground",
    reading:
      "Tulips do the difficult part underground. In spring they come up without a rehearsal, closed and precise, and they open only when the light is right. Quiet confidence is not the absence of doubt. It is knowing you have done the work even on the days when nobody was watching you do it.",
  },
  {
    id: "daisy",
    name: "Daisy",
    latin: "Bellis perennis",
    meaning: "new beginnings",
    hue: "#c9a53f",
    note: "grows in the gaps · closes at night",
    reading:
      "Daisies grow in the gaps: between paving stones, at the edge of the field, anywhere there is a little light. New beginnings rarely arrive as a clean slate. They arrive as a small, stubborn decision to try again on an ordinary Tuesday, and then again on the Wednesday after it.",
  },
  {
    id: "lavender",
    name: "Lavender",
    latin: "Lavandula angustifolia",
    meaning: "calm focus under pressure",
    hue: "#7d6bb0",
    note: "small and many · a field is a whole mood",
    reading:
      "Lavender is small and many. A single stem is nothing much; a field of them is a whole mood. Calm under pressure is built the same way: one breathing exercise, one timed section, one honest break, repeated until it stops being a trick and becomes a place you can stand.",
  },
  {
    id: "iris",
    name: "Iris",
    latin: "Iris germanica",
    meaning: "wisdom and hope",
    hue: "#5d5fa8",
    note: "named for the messenger · arrives early",
    reading:
      "The iris is the messenger. It arrives early, holding colour while the rest of the garden is still deciding. Wisdom is not knowing every answer; it is knowing which question deserves your energy this week. Hope is the message you keep delivering to yourself while you find out.",
  },
  {
    id: "camellia",
    name: "Camellia",
    latin: "Camellia japonica",
    meaning: "admiration for excellence",
    hue: "#c2405a",
    note: "blooms in winter · perfect petals in a hard month",
    reading:
      "The camellia blooms in winter, when the garden has the least to offer, and it is admired for exactly that discipline. Excellence is not a lucky season. It is what you practise when the season refuses to cooperate — which, in an exam year, is most seasons.",
  },
  {
    id: "ranunculus",
    name: "Ranunculus",
    latin: "Ranunculus asiaticus",
    meaning: "radiant charm",
    hue: "#e0866f",
    note: "dozens of layers · nothing rushed",
    reading:
      "The ranunculus is made of layers — dozens of them, packed so tightly you cannot see where one ends and the next begins. That is charm, really: the accumulated layers of curiosity, humour and persistence that make you unmistakably yourself and nobody else.",
  },
  {
    id: "orchid",
    name: "Orchid",
    latin: "Phalaenopsis amabilis",
    meaning: "strength and refined beauty",
    hue: "#a3559b",
    note: "slow to bloom · holds for months",
    reading:
      "Orchids do not rush. Some take years to flower, then hold their bloom for months, sculpted and certain. Strength like that is not loud. It is patient, adaptive and quietly beautiful, which is exactly what keeps you standing when the calendar gets heavy.",
  },
] as const;

export type Flower = (typeof FLOWERS)[number];
export type FlowerId = Flower["id"];

/** Greenery that fills a bouquet out. Stems only — no head art. */
export const FILLERS = [
  { id: "eucalyptus", name: "Eucalyptus", latin: "Eucalyptus cinerea", hue: "#8ba58c" },
  { id: "babys-breath", name: "Baby's breath", latin: "Gypsophila paniculata", hue: "#cfc6b8" },
  { id: "fern", name: "Fern", latin: "Nephrolepis exaltata", hue: "#5f7d5c" },
] as const;

export type Filler = (typeof FILLERS)[number];
export type FillerId = Filler["id"];
export type StemId = FlowerId | FillerId;

export const FLOWER_IDS: readonly FlowerId[] = FLOWERS.map((flower) => flower.id);
export const STEM_IDS: readonly StemId[] = [...FLOWER_IDS, ...FILLERS.map((f) => f.id)];

const FLOWER_BY_ID = new Map<string, Flower>(FLOWERS.map((flower) => [flower.id, flower]));
const FILLER_BY_ID = new Map<string, Filler>(FILLERS.map((filler) => [filler.id, filler]));

export function isFlowerId(value: string): value is FlowerId {
  return FLOWER_BY_ID.has(value);
}

export function isStemId(value: string): value is StemId {
  return FLOWER_BY_ID.has(value) || FILLER_BY_ID.has(value);
}

export function getFlower(id: FlowerId): Flower {
  // Non-null: every FlowerId in the union comes from FLOWERS.
  return FLOWER_BY_ID.get(id) as Flower;
}

export function getFiller(id: FillerId): Filler {
  return FILLER_BY_ID.get(id) as Filler;
}

/** Display name for any stem id, fillers included. */
export function stemLabel(id: StemId): string {
  return FLOWER_BY_ID.get(id)?.name ?? FILLER_BY_ID.get(id)?.name ?? id;
}

export const HEAD_SIZES = [256, 512] as const;
export type HeadSize = (typeof HEAD_SIZES)[number];

/** Painted flower head, trimmed, transparent. 256 for the wall, 512 for pages. */
export function headSrc(id: FlowerId, size: HeadSize = 512): string {
  return size === 256
    ? `/womans-day/flowers/${id}/head-sm.webp`
    : `/womans-day/flowers/${id}/head.webp`;
}

/**
 * Side-view stem. Only three painted stems exist; every species borrows one by habit
 * (see `STEM_BY_FLOWER`), which keeps the art set small without making a bouquet of
 * twelve flowers look like twelve copies of one stem.
 */
export type StemArt = "rose" | "smooth" | "leafy";

export const STEM_BY_FLOWER: Record<FlowerId, StemArt> = {
  lotus: "smooth",
  rose: "rose",
  peony: "leafy",
  lily: "smooth",
  sunflower: "leafy",
  tulip: "smooth",
  daisy: "smooth",
  lavender: "leafy",
  iris: "smooth",
  camellia: "rose",
  ranunculus: "leafy",
  orchid: "smooth",
};

export function stemSrc(id: StemId): string {
  if (isFlowerId(id)) {
    return `/womans-day/flowers/stems/${STEM_BY_FLOWER[id]}.webp`;
  }
  return `/womans-day/flowers/stems/${id}.webp`;
}

/** Loose petals that drift behind the book. */
export const PETALS = ["crimson", "blush", "cream", "dusty"] as const;
export type PetalTone = (typeof PETALS)[number];

export function petalSrc(tone: PetalTone): string {
  return `/womans-day/flowers/petals/${tone}.webp`;
}

/** Wrapping paper for the bouquet. `front` is the cone that hides the stem ends. */
export const WRAPS = [
  { id: "kraft", name: "French kraft", paper: "#c99a63", tint: "#8a6535" },
  { id: "blush", name: "Blush rose", paper: "#e6b3bd", tint: "#a3666f" },
  { id: "sage", name: "Sage green", paper: "#b9c4a4", tint: "#6d7a58" },
  { id: "linen", name: "Linen cream", paper: "#e8dfc9", tint: "#9a8c6a" },
] as const;

export type Wrap = (typeof WRAPS)[number];
export type WrapId = Wrap["id"];
export const WRAP_IDS: readonly WrapId[] = WRAPS.map((wrap) => wrap.id);

export const RIBBONS = [
  { id: "blush", name: "Blush satin" },
  { id: "cream", name: "Cream satin" },
  { id: "red", name: "Deep red" },
  { id: "sage", name: "Sage" },
] as const;

export type Ribbon = (typeof RIBBONS)[number];
export type RibbonId = Ribbon["id"];
export const RIBBON_IDS: readonly RibbonId[] = RIBBONS.map((ribbon) => ribbon.id);

/**
 * One painted wrap cone per colour. It is drawn TWICE by the bouquet: the FULL art behind
 * the flowers (the back flap and interior), and the FRONT LIP (`<id>-front.webp`, the cone
 * below the rim — see `scripts/womans-day/make-wrap-lip.ts`) in front of them, so heads and
 * greenery sit between the two and the lower ring of heads tucks behind the lip.
 */
export function wrapSrc(id: WrapId): string {
  return `/womans-day/wrap/${id}.webp`;
}

/** The front-lip layer for a wrap (everything below the rim; above it is transparent). */
export function wrapFrontSrc(id: WrapId): string {
  return `/womans-day/wrap/${id}-front.webp`;
}

export function ribbonSrc(id: RibbonId): string {
  return `/womans-day/wrap/bow-${id}.webp`;
}

/** Celebration date, used in copy, the OG image and the keepsake card. */
export const WOMANS_DAY_LABEL = "Vietnamese Women's Day · 20 October";
export const WOMANS_DAY_SHORT = "20.10";
