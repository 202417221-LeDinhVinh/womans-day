/**
 * One source of truth for every scroll-driven beat of the Women's Day page.
 *
 * The page is a single scroll track of `SCROLL_SCREENS` viewports. `progress` is the
 * normalized 0→1 position inside that track. Segments are named, and components derive
 * their local 0→1 value with `scrub(progress, SEGMENTS.turnGarden)`. Never hardcode these
 * numbers in a component.
 *
 * The segment table is AUTHORED IN SCROLL UNITS `u` (screens of physical scroll) and
 * converted to progress, so inserting a new beat only means editing the `u` numbers next
 * to their neighbours — no other value has to be re-tuned by hand.
 *
 * Rest gaps between the page turns are deliberate: they are the windows where a spread
 * is at rest (cover name label, parcel taps, bouquet building, the garden) and where the
 * settle logic lands when the reader stops scrolling.
 */

export type Segment = { readonly start: number; readonly end: number };

/**
 * Named spreads, in book order. `plate` is the chapter opener, `garden` the
 * plant-your-own-flower spread, `scrapbook` the collage, `mail` the parcel, `florist`
 * the bouquet builder, `back` the closed back cover (the letter's backdrop).
 */
export const SPREAD = {
  cover: 0,
  plate: 1,
  garden: 2,
  scrapbook: 3,
  mail: 4,
  florist: 5,
  back: 6,
} as const;

export type SpreadId = (typeof SPREAD)[keyof typeof SPREAD];

/** Total spread slots in the book, including the back cover. */
export const SPREAD_COUNT = 7;

/** The spread the book closes FROM (the last paper spread before the back cover). */
export const LETTER_SPREAD = SPREAD.florist;

/**
 * The segment table is written in scroll units `u` (screens of physical scroll). The track
 * is `U_TOTAL + 1` screens tall, so physical scroll = `progress × U_TOTAL` screens.
 */
const U_TOTAL = 9;
const seg = (a: number, b: number): Segment => ({ start: a / U_TOTAL, end: b / U_TOTAL });

export const SCROLL_SCREENS = U_TOTAL + 1; // 10

export const SEGMENTS = {
  /** The envelope appears and the first ring of heads grows in. */
  bloomGrow: seg(0.0, 0.72),
  /** The cluster expands into a full-bleed flower wall. */
  wallFull: seg(0.72, 1.2),
  /** The wall parts from the centre outward; petals start drifting. It ends WITH
   *  `bookRise` (2.0) so the flowers clear the stage at the same speed the book comes
   *  up — the old end (plus a `* 1.4` speed-up and a `/ 0.7` ramp in `FlowerWall`)
   *  scattered them out well before the book appeared. */
  wallScatter: seg(1.2, 2.0),
  /** The textbook rises into the cleared centre. */
  bookRise: seg(1.36, 2.0),
  /** Cover opens around the spiral. */
  coverOpen: seg(2.08, 2.64),
  /** Plate → garden. The garden rest (3.52 → 3.84) is when the reader plants flowers
   *  and scratches the polaroid. */
  turnPlate: seg(2.96, 3.52),
  /** Garden → scrapbook. */
  turnGarden: seg(3.84, 4.4),
  /** Scrapbook → mail. */
  turnScrapbook: seg(4.8, 5.36),
  /** Mail → florist (parcel). The mail rest (5.36 → 5.76) is the parcel's dwell: the
   *  reader must be able to tap through the unboxing several times. */
  turnMail: seg(5.76, 6.32),
  /** Florist → the book closes on the letter. The florist rest (6.32 → 6.72) is the
   *  bouquet builder. */
  turnBack: seg(6.72, 7.28),
  /** Pink envelope + music widget fade in over the closing book. */
  letterReveal: seg(6.8, 7.6),
  /** The closed back cover fades out AFTER the `back` leaf has LANDED (never during the
   *  turn — an opacity < 1 on the book wrapper flattens `preserve-3d`) and finishes
   *  before `letterReveal.end`, so no part of the book is ever visible over the letter. */
  bookExit: seg(7.28, 7.52),
} as const;

export type SegmentId = keyof typeof SEGMENTS;

/**
 * Ordered page turns. `cover` and `back` hinge differently from the middle leaves, and the
 * `back` turn is the one that lands the reader on the letter (it does NOT advance the
 * spread beyond the florist — the closed back cover is the letter's backdrop).
 */
export const TURNS = [
  { id: "cover", segment: SEGMENTS.coverOpen, spreadAfter: SPREAD.plate },
  { id: "plate", segment: SEGMENTS.turnPlate, spreadAfter: SPREAD.garden },
  { id: "garden", segment: SEGMENTS.turnGarden, spreadAfter: SPREAD.scrapbook },
  { id: "scrapbook", segment: SEGMENTS.turnScrapbook, spreadAfter: SPREAD.mail },
  { id: "mail", segment: SEGMENTS.turnMail, spreadAfter: SPREAD.florist },
  { id: "back", segment: SEGMENTS.turnBack, spreadAfter: SPREAD.back },
] as const;

export type TurnId = (typeof TURNS)[number]["id"];
export type Turn = (typeof TURNS)[number];

export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** Local 0→1 position inside a segment, clamped at both ends. */
export function scrub(progress: number, segment: Segment): number {
  const span = segment.end - segment.start;
  if (span <= 0) return progress >= segment.end ? 1 : 0;
  return clamp01((progress - segment.start) / span);
}

/** Smoothstep easing for anything that should start and finish gently. */
export function smoothstep(t: number): number {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

/**
 * Physical paper turn: starts slowly, flips decisively in the middle, settles at the end.
 * Slightly faster than smoothstep at the halfway mark so a half-turned leaf never feels
 * stuck.
 */
export function paperEase(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 2 * x * x : 1 - 2 * (1 - x) * (1 - x);
}

export type Scene = {
  /** The spread on the paper right now. 0 = closed cover, 5 = florist, 6 = closed back. */
  spread: number;
  /** The leaf that is mid-air, if any. */
  turn: TurnId | null;
  /** The letter layer owns the stage (it fades in under the closing book). */
  letter: boolean;
};

/**
 * A turn is only "live" while the leaf is meaningfully off the page. Once local progress
 * is within this epsilon of either end the leaf is effectively landed/flat, so it is
 * treated as unmounted. Without this a settle that lands at `end - ε` (Lenis/pixel
 * rounding) leaves an invisible-but-hit-testable leaf mounted over a resting spread,
 * intercepting every control on the right page.
 */
export const TURN_LANDED_EPSILON = 0.001;

/** The spread before a turn (the one the previous turn landed on, or the cover). */
export function spreadBefore(index: number): number {
  return index === 0 ? SPREAD.cover : TURNS[index - 1].spreadAfter;
}

/**
 * Which spread is on the table and whether a leaf is currently turning. Called once per
 * progress change but only stored in React state when the DISCRETE result changes.
 */
export function sceneAt(progress: number): Scene {
  const letter = progress >= SEGMENTS.letterReveal.start;

  for (let index = 0; index < TURNS.length; index += 1) {
    const turn = TURNS[index];
    const { start, end } = turn.segment;
    if (progress >= start && progress < end) {
      const span = end - start;
      const local = span > 0 ? (progress - start) / span : 1;
      // Treat the very edges of a turn as landed: the leaf is flat there, so no leaf is
      // mounted (and thus nothing decorative can intercept a click at rest). At the START
      // edge the leaf has not moved yet, so the scene is the spread BEFORE this turn — the
      // spread the previous turn landed on (0 for the cover), NOT `spreadAfter`. Returning
      // `spreadAfter` here briefly showed the NEXT spread's both halves under a still-closed
      // cover (Plan 9b §5).
      if (local >= 1 - TURN_LANDED_EPSILON) {
        return { spread: turn.spreadAfter, turn: null, letter };
      }
      if (local <= TURN_LANDED_EPSILON) {
        return { spread: spreadBefore(index), turn: null, letter };
      }
      return {
        // While a leaf is in the air the underlay already belongs to the NEXT spread.
        spread: turn.spreadAfter,
        turn: turn.id,
        letter,
      };
    }
  }

  let spread: number = SPREAD.cover;
  for (const turn of TURNS) {
    if (progress >= turn.segment.end) spread = turn.spreadAfter;
  }

  return { spread, turn: null, letter };
}

/**
 * Scroll target (in progress units) to snap to when the reader stops mid-turn, or null
 * when the current position is already a resting place.
 *
 * The target is nudged INTO the rest window rather than landing exactly on the boundary:
 * a settle that ends at `end - ε` (Lenis smoothing / sub-pixel rounding) would leave the
 * `sceneAt` half-open `[start, end)` test still reporting the turn, and a mounted leaf
 * over a resting spread. `REST_NUDGE` keeps the landing point strictly inside the rest
 * gap so the leaf unmounts on arrival. `sceneAt` also guards the edge (see
 * `TURN_LANDED_EPSILON`), so the two fixes are independent.
 */
export const REST_NUDGE = 0.002;

/**
 * The letter rest: past the `back` leaf landing AND past the book fade, inside the
 * letter reveal. The book is fully transparent here, so nothing of it sits over the letter.
 */
export const LETTER_REST = Math.min(1, SEGMENTS.letterReveal.end + REST_NUDGE);

export function settleTarget(progress: number): number | null {
  for (const turn of TURNS) {
    const { start, end } = turn.segment;
    if (progress > start && progress < end) {
      if (progress - start < end - progress) {
        // Snap back to the rest BEFORE this turn: land just before `start`.
        return Math.max(0, start - REST_NUDGE);
      }
      // Snap forward to the rest AFTER this turn: land just past `end` — except the
      // `back` turn, which lands on the letter rest past the book fade.
      if (turn.id === "back") return LETTER_REST;
      return Math.min(1, end + REST_NUDGE);
    }
  }
  // The exit window is not a rest: a reader stopped between the back-cover landing and
  // the letter rest settles forward onto the letter with the book gone.
  if (progress > SEGMENTS.turnBack.end && progress < LETTER_REST) return LETTER_REST;
  return null;
}

/**
 * The progress where a reader "is" while on a spread — the rest point used by click-to-turn
 * to land after a programmatic turn.
 *
 *  - spread 0 (closed cover): just before the cover turn `start` (i.e. before `coverOpen`).
 *  - spread k ≥ 1 (except the back cover): just past the turn that landed on it
 *    (`TURNS[k-1].segment.end + nudge`).
 *  - the closed back cover (`SPREAD.back`): the letter rest, past the book fade — the book
 *    is fully transparent there, so nothing of it sits over the letter.
 */
export function restProgress(spread: number): number {
  if (spread <= SPREAD.cover) return Math.max(0, SEGMENTS.coverOpen.start - REST_NUDGE);
  // The last spread (`back`) rests on the letter, past the book fade — never at the leaf
  // landing where the book is still opaque over the letter.
  if (spread === SPREAD.back) return LETTER_REST;
  const index = TURNS.findIndex((turn) => turn.spreadAfter === spread);
  if (index >= 0) return Math.min(1, TURNS[index].segment.end + REST_NUDGE);
  // Unknown spread: the letter rest.
  return LETTER_REST;
}

/** The turn a click should play to move from the current spread in direction `dir`. */
export function turnFor(from: number, dir: 1 | -1): Turn | null {
  if (dir === 1) {
    // Forward: the first turn whose spreadAfter is strictly greater than the current spread.
    for (const turn of TURNS) {
      if (turn.spreadAfter > from) return turn;
    }
    return null;
  }
  // Backward: the turn that LANDED on the current spread (its spreadAfter === from), or, from
  // the back cover / letter, the last turn.
  for (let i = TURNS.length - 1; i >= 0; i -= 1) {
    if (TURNS[i].spreadAfter === from) return TURNS[i];
  }
  return TURNS[TURNS.length - 1] ?? null;
}

/** Absolute document offset for a progress value inside the scroll track. */
export function progressToScrollTop(
  progress: number,
  trackTop: number,
  trackHeight: number,
  viewportHeight: number
): number {
  return trackTop + clamp01(progress) * Math.max(trackHeight - viewportHeight, 0);
}
