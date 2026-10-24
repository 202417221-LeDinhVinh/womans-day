"use client";

import { motion, useTransform, type MotionValue } from "framer-motion";
import { memo, useEffect, useRef, useState, type ReactNode } from "react";

import {
  LETTER_SPREAD,
  SEGMENTS,
  SPREAD,
  SPREAD_COUNT,
  TURNS,
  type TurnId,
} from "@/lib/womansDay/timeline";
import { Art } from "@/components/womans-day/paper";
import { TurningLeaf } from "@/components/womans-day/TurningLeaf";

/**
 * The book on the table.
 *
 * While a leaf is in the air the underlay is a HYBRID spread: the previous left page
 * stays put (the leaf's back lands on it) while the next right page is already revealed
 * beneath the lifting leaf. Swapping both sides at once would pop the left page out from
 * under the reader. At rest the leaf is unmounted and the base spread renders once.
 *
 * All interactive state lives in `WomansDayExperience`, so the same page can be rendered
 * into the leaf and into the base without losing parcel taps or bouquet edits.
 */

export type PageVariant = "page" | "leaf";
export type PageRenderer = (
  spread: number,
  side: "left" | "right",
  ctx: { variant: PageVariant; arrived: boolean }
) => ReactNode;

/**
 * The spread a leaf is lifting FROM and landing ON, derived from `TURNS` so a new spread
 * never needs a hand-maintained table here. The `back` turn lifts the florist right page
 * and lands the closed back cover.
 */
function previousSpreadFor(turn: TurnId): number {
  const index = TURNS.findIndex((entry) => entry.id === turn);
  if (index <= 0) return SPREAD.cover;
  return TURNS[index - 1].spreadAfter;
}

function nextSpreadFor(turn: TurnId): number {
  const found = TURNS.find((entry) => entry.id === turn);
  return found ? found.spreadAfter : SPREAD.cover;
}

function segmentFor(turn: TurnId | null) {
  const found = TURNS.find((entry) => entry.id === turn);
  return found ? found.segment : SEGMENTS.coverOpen;
}

function BlankPage() {
  return <div className="h-full w-full bg-[#f2ebda]" />;
}

function BackCoverPage() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#6b4a3a]">
      <Art
        src="/womans-day/paper/cover-cloth.webp"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-[#4a3128]/35" />
      <div className="relative flex h-full flex-col items-center justify-center px-[12%] text-center">
        <p className="font-[family-name:var(--font-type)] text-[1.05cqw] tracking-[0.28em] text-[#e8d8c4]/70">
          Ronan SAT · 20.10
        </p>
        <p className="mt-[6%] font-[family-name:var(--font-book)] text-[3.4cqw] italic leading-snug text-[#f4ead6]/90">
          Take the flowers with you.
        </p>
      </div>
    </div>
  );
}

function TextbookImpl({
  progress,
  reduced,
  mobile,
  spread,
  turn,
  letter,
  arrivedSpread,
  renderPage,
  onTurn,
}: {
  progress: MotionValue<number>;
  reduced: boolean;
  mobile: boolean;
  spread: number;
  turn: TurnId | null;
  letter: boolean;
  /** The spread the reader has settled on (null while a leaf is in the air). */
  arrivedSpread: number | null;
  renderPage: PageRenderer;
  /** Click a non-interactive page area to turn: −1 = back (left), +1 = forward (right). */
  onTurn: (dir: 1 | -1) => void;
}) {
  const page: PageRenderer = (index, side, ctx) => {
    if (index === SPREAD.back) return side === "left" || mobile ? <BackCoverPage /> : <BlankPage />;
    if (index > SPREAD.back) return null;
    return renderPage(index, side, ctx);
  };

  const arrived = (forSpread: number) => arrivedSpread === forSpread;
  const pageCtx = (forSpread: number): { variant: PageVariant; arrived: boolean } => ({
    variant: "page",
    arrived: arrived(forSpread),
  });
  const leafCtx: { variant: PageVariant; arrived: boolean } = { variant: "leaf", arrived: false };

  const riseProgress = useTransform(
    progress,
    [SEGMENTS.bookRise.start, SEGMENTS.bookRise.end],
    [0, 1],
    { clamp: true }
  );
  // Far enough below the stage that no part of the closed book peeks in before it rises.
  const rise = useTransform(riseProgress, (value) => `${(1 - value) * 108}dvh`);
  const scale = useTransform(riseProgress, (value) => 0.94 + value * 0.06);
  // The book stays FULLY OPAQUE for the whole of the back-cover turn and fades only
  // after the leaf has LANDED. An opacity < 1 on this wrapper (a grouping element)
  // flattens the descendant `preserve-3d`, forcing the whole book + leaf into an offscreen
  // surface every frame of the close (Plan 10 §B5/F6). The letter layer still fades in over
  // the book, then the book fades out under it over `bookExit` (Plan 16 Part B).
  const bookOpacity = useTransform(
    progress,
    [SEGMENTS.bookExit.start, SEGMENTS.bookExit.end],
    [1, 0],
    { clamp: true }
  );
  // Closed, only the cover (the right half) exists; the left board is transparent until
  // the cover swings open, and the book is recentred with `shift`. At the end the book
  // closes on the back cover (SPREAD.back): the RIGHT half goes transparent and the book is
  // recentred the other way. None of this uses a `clip-path`/`overflow` ancestor, because
  // either would flatten the 3-D perspective and crop the lifted half of the turning leaf at
  // the book edge (symptom 3). Instead the book body is TWO half-width "boards" whose
  // opacity is animated — a closed book shows one board and the other half is transparent,
  // never a painted cream overlay (Plan 9 §4/§5).
  //
  // ONE function-form transform drives `shift` across BOTH the cover-open (from −25 % to 0,
  // so the closed cover is centred) and the back-cover close (0 to +25 % over turn4, so the
  // closed back cover is centred). Array-form off the raw accelerated scroll value is
  // banned (see DESIGN.md), and the two segments have different directions, so a single
  // function is the clear form.
  const shift = useTransform(progress, (value) => {
    const open = SEGMENTS.coverOpen;
    if (value <= open.start) return "-25%";
    if (value <= open.end) {
      const t = (value - open.start) / (open.end - open.start);
      return `${-25 + 25 * t}%`;
    }
    const back = SEGMENTS.turnBack;
    if (value <= back.start) return "0%";
    if (value <= back.end) {
      const t = (value - back.start) / (back.end - back.start);
      return `${25 * t}%`;
    }
    return "25%";
  });
  // The ground shadow tracks the visible half of the book: full width when the book is
  // open, squeezed under the right half for the closed front cover and under the left half
  // for the closed back cover. It is a COMPOSITOR-only transform (`scaleX` + `x`) on a
  // fixed-geometry element with a pre-blurred radial gradient — animating `left`/`right`
  // (a layout property) plus a `blur-2xl` filter inside the moving book repainted a large
  // region every frame of the cover turn and turn 4 (Plan 10 §B5).
  const shadowTransform = useTransform(shift, (value) => {
    const f = Number.parseFloat(value) || 0;
    const k = Math.min(0.25, Math.abs(f)) / 0.25; // 0 open → 1 fully squeezed
    const scaleX = (84 - 50 * k) / 84;
    const translateX = ((f < 0 ? 1 : f > 0 ? -1 : 0) * (25 * k)) / 0.84;
    return `translateX(${translateX}%) scaleX(${scaleX})`;
  });
  // A closed book has NO ground shadow: beside a single closed cover a wide soft ellipse
  // reads as a faint page/"blank-page shadow" (the owner reported it on BOTH covers). The
  // shadow belongs to the OPEN book only, so it fades out while a cover is closed and back
  // in once both boards are shown.
  const groundShadowOpacity = useTransform(progress, (value) =>
    value >= SEGMENTS.coverOpen.end && value < SEGMENTS.turnBack.start ? 1 : 0
  );

  const turnSegment = segmentFor(turn);
  const turnT = useTransform(progress, [turnSegment.start, turnSegment.end], [0, 1], {
    clamp: true,
  });
  // The first and last turns swing a COVER over an empty half; a cast shadow there reads as
  // a ghost page (Plan 13). Only the middle turns cast a shadow.
  const coverTurn = turn === "cover" || turn === "back";
  const castShadow = useTransform(turnT, (value) =>
    turn && !coverTurn ? Math.sin(Math.PI * Math.max(0, Math.min(1, value))) * 0.42 : 0
  );

  // The boards are the blank-page risk: a bare board IS the blank page, so each one must
  // appear only at the instant a leaf LANDS on it and vanish the moment a leaf LIFTS off
  // it. Steps, not fades (Plan 9b):
  //   - LEFT board: hidden for the whole cover turn (the leaf's back face is the left page
  //     as it crosses), shown only once the cover has landed (progress ≥ coverOpen.end);
  //   - RIGHT board: shown until the back turn begins, hidden from turnBack.start (the whole
  //     right block lifts at the close, so the right half is empty from the first frame).
  const coverLanded = useTransform(progress, (value) => (value >= SEGMENTS.coverOpen.end ? 1 : 0));
  const backStarted = useTransform(progress, (value) => (value >= SEGMENTS.turnBack.start ? 1 : 0));
  const rightBoardOpacity = useTransform(backStarted, (value) => 1 - value);
  // The spiral spine is only real while BOTH boards are shown (an open book): after the
  // cover lands and before turn4 starts.
  const spineOpacity = useTransform(progress, (value) =>
    value >= SEGMENTS.coverOpen.end && value < SEGMENTS.turnBack.start ? 1 : 0
  );

  // At the letter the book has closed on the back cover (the letter is its backdrop): the
  // base spread becomes `SPREAD.back` so the left board + cloth back cover are shown.
  const backCoverBase = !turn && letter && spread === LETTER_SPREAD;
  const baseSpread = backCoverBase ? SPREAD.back : spread;
  const previousSpread = turn ? previousSpreadFor(turn) : spread;
  const nextSpread = turn ? nextSpreadFor(turn) : spread;
  const closed = spread === SPREAD.cover && !turn;

  // PRE-ARM the leaves adjacent to the current rest (Plan 10 §B1). Mounting 12 full page
  // copies on the exact frame a turn STARTS is the biggest visible hitch. Instead, while the
  // reader is resting, we mount the next turn forward and the previous turn back (at most
  // two) inside `requestIdleCallback`, hidden (`visibility: hidden`) and frozen at their
  // start pose (a leaf's transform is derived from `progress`, so an un-run leaf is already
  // flat at rest). When a turn begins its leaf is already mounted — making it visible is a
  // class flip, not a tree mount. Only the leaf whose id === `turn` is ever shown, so a wrong
  // arming set can never paint a visible wrong leaf.
  const [armed, setArmed] = useState<TurnId[]>([]);
  useEffect(() => {
    if (reduced) {
      setArmed([]);
      return;
    }
    if (turn) return; // keep the active leaf mounted; don't churn the rest
    const next = spread < TURNS.length ? TURNS[spread].id : null;
    const prev = spread >= 1 ? TURNS[spread - 1].id : null;
    const wanted = [turn, next, prev].filter((id): id is TurnId => id !== null);
    const unique = Array.from(new Set(wanted));
    let cancelled = false;
    const arm = () => {
      if (!cancelled) setArmed(unique);
    };
    const idle = (
      window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      }
    ).requestIdleCallback;
    if (idle) {
      const id = idle(arm, { timeout: 400 });
      return () => {
        cancelled = true;
        (window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(id);
      };
    }
    const timer = window.setTimeout(arm, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [reduced, turn, spread]);

  // While a turn is live, keep the armed leaves mounted too (the active turn's leaf is one of
  // them, so there is NO unmount on the turn frame — just a visibility flip). A turn that was
  // not armed in time is added so it still renders.
  const leafTurns: TurnId[] = turn ? Array.from(new Set<TurnId>([turn, ...armed])) : armed;

  // Click-to-turn. A pointerdown on a non-interactive area of a page records the point; a
  // pointerup within 6 px (a tap, not a drag/selection) turns the page on the half clicked.
  // Interactive islands opt out with `data-wd-interactive` (or a real control). Hovering a
  // non-interactive area lifts that page's outer bottom corner (a compositor-faded peel).
  const bookBoxRef = useRef<HTMLDivElement | null>(null);
  const down = useRef<{ x: number; y: number; dir: 1 | -1 } | null>(null);
  const [hoverCorner, setHoverCorner] = useState<"left" | "right" | null>(null);

  const isInteractive = (target: EventTarget | null): boolean => {
    const element = target as HTMLElement | null;
    if (!element || typeof element.closest !== "function") return false;
    return Boolean(
      element.closest(
        "button, a, input, textarea, select, label, [role=button], [contenteditable], [data-wd-interactive]"
      )
    );
  };

  const dirForPoint = (clientX: number): 1 | -1 => {
    const rect = bookBoxRef.current?.getBoundingClientRect();
    if (!rect) return 1;
    const fraction = (clientX - rect.left) / Math.max(rect.width, 1);
    if (mobile) return fraction < 0.32 ? -1 : 1;
    return fraction < 0.5 ? -1 : 1;
  };

  const onPointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0 || isInteractive(event.target)) {
      down.current = null;
      return;
    }
    down.current = { x: event.clientX, y: event.clientY, dir: dirForPoint(event.clientX) };
  };

  const onPointerUp = (event: React.PointerEvent) => {
    const start = down.current;
    down.current = null;
    if (!start || event.button !== 0 || isInteractive(event.target)) return;
    if (Math.abs(event.clientX - start.x) > 6 || Math.abs(event.clientY - start.y) > 6) return;
    if (window.getSelection()?.toString()) return;
    // A closed front cover only has the right half → forward; a closed back only the left →
    // back. `dirForPoint` already maps the click side; the spread guard handles the rest.
    onTurn(start.dir);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (mobile || event.pointerType !== "mouse" || turn) {
      setHoverCorner(null);
      return;
    }
    if (isInteractive(event.target)) {
      if (hoverCorner !== null) setHoverCorner(null);
      return;
    }
    const next = dirForPoint(event.clientX) === -1 ? "left" : "right";
    if (next !== hoverCorner) setHoverCorner(next);
  };

  const cornerHint = (side: "left" | "right") => {
    if (hoverCorner !== side || turn || letter) return null;
    // A 9 % corner peel: a triangle of the page's back folded over, bottom-outer corner.
    return (
      <motion.div
        aria-hidden
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="pointer-events-none absolute bottom-0 h-[9%] w-[9%]"
        style={{
          [side]: 0,
          transformOrigin: side === "left" ? "bottom left" : "bottom right",
          clipPath:
            side === "left"
              ? "polygon(0 0, 0 100%, 100% 100%)"
              : "polygon(100% 0, 0 100%, 100% 100%)",
          background:
            "linear-gradient(135deg, rgba(210,196,168,0) 40%, rgba(196,180,150,0.85) 62%, rgba(232,222,201,0.95) 100%)",
          boxShadow: "0 -1px 3px rgba(58,38,24,0.18)",
        }}
      />
    );
  };

  return (
    <motion.div
      style={{ opacity: bookOpacity }}
      className="relative flex h-full w-full items-center justify-center"
    >
      <motion.div style={{ perspective: 2400, x: mobile ? 0 : shift }} className="relative">
        <motion.div
          style={{ y: rise, scale, rotateX: 6, transformStyle: "preserve-3d" }}
          className="relative"
        >
          {/* The page box carries the book's size and its own clipping, so it can hold the
              static underlay. The turning leaf is rendered as its SIBLING (below), never
              inside `overflow-hidden`, because a clip/overflow ancestor flattens the 3-D
              perspective and crops the lifted half of the leaf at the book edge. On desktop
              the box itself is transparent: the painted body is TWO half-width boards (see
              below) so a closed book can show one half and leave the other transparent
              (Plan 9 §4/§5). Mobile is a single page, so it keeps the plain box body. */}
          <div
            ref={bookBoxRef}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerMove={onPointerMove}
            onPointerLeave={() => setHoverCorner(null)}
            className={`relative rounded-[0.45%] ${
              mobile
                ? "bg-[#d9cfba] shadow-[0_34px_80px_rgba(58,38,24,0.42),0_10px_22px_rgba(58,38,24,0.22)]"
                : ""
            }`}
            style={
              mobile
                ? { height: "min(84dvh, calc(92vw * 1.46))", aspectRatio: "3 / 4.4" }
                : { height: "min(86dvh, calc(92vw * 0.625))", aspectRatio: "16 / 10" }
            }
          >
            {/* The book BODY, split into two half-width boards. Each carries the paper
                colour and its own drop shadow, so the shadow only ever outlines the half
                that is actually shown. A closed front cover shows only the right board
                (left transparent); a closed back cover shows only the left board (right
                transparent). They sit behind the content, which has no background of its
                own, so the stage shows through the transparent half. */}
            {!mobile ? (
              <>
                <motion.div
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 left-0 w-1/2 rounded-l-[0.45%] bg-[#d9cfba]"
                  style={{ opacity: coverLanded }}
                />
                <motion.div
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 right-0 w-1/2 rounded-r-[0.45%] bg-[#d9cfba]"
                  style={{ opacity: rightBoardOpacity }}
                />
              </>
            ) : null}
            <div className="absolute inset-0 overflow-hidden rounded-[0.45%]">
              {/* Every spread's left and right slot is mounted ONCE and stays mounted for
                  the whole session; a turn changes only `visibility`. This is what stops
                  the "fetch/reload on every scroll": components (and their decoded
                  `<img>`s, sprung entries, timers) are never unmounted at a page turn, and
                  landing a leaf is a visibility flip, not a remount. Each slot is `isolate`
                  so nothing inside a page (bouquet heads up to z 79) can escape into the
                  book's stacking order. `visibility: hidden` keeps the layers decoded
                  (unlike `display: none` / `content-visibility`), which is the point. */}
              {Array.from({ length: SPREAD_COUNT }, (_, index) => {
                const sideVisible = (side: "left" | "right"): boolean => {
                  // A CLOSED book shows exactly ONE half, and the other half's slot is
                  // never visible — mirror rules for the two covers:
                  //   - closed FRONT cover (baseSpread 0): the LEFT half is empty; force its
                  //     slot hidden so no surface can ever paint a blank left page (Plan
                  //     9b follow-up — the back cover was fixed but the front was not).
                  //   - closed BACK cover (baseSpread SPREAD.back): the RIGHT endpaper
                  //     (`BlankPage`) is never shown on desktop, so no blank right page appears
                  //     at rest or under the landing leaf during the back turn (Plan 9 §5).
                  if (!mobile && baseSpread === SPREAD.cover && side === "left") return false;
                  if (!mobile && index === SPREAD.back && side === "right") return false;
                  if (reduced) return index === baseSpread || (mobile && index === baseSpread);
                  if (mobile) return index === baseSpread;
                  // Hybrid underlay during a turn: previous left stays, next right shows.
                  if (turn) {
                    return side === "left" ? index === previousSpread : index === nextSpread;
                  }
                  return index === baseSpread;
                };
                const anyVisible = sideVisible("left") || sideVisible("right");
                return (
                  <div
                    key={`slot-${index}`}
                    data-visible={anyVisible ? "true" : "false"}
                    className="absolute inset-0"
                    style={{ pointerEvents: anyVisible ? "auto" : "none" }}
                  >
                    {mobile ? (
                      <div
                        className="relative isolate h-full w-full"
                        style={{ visibility: sideVisible("right") ? "visible" : "hidden" }}
                      >
                        {page(index, "right", pageCtx(index))}
                      </div>
                    ) : (
                      <>
                        <div
                          className="absolute inset-y-0 left-0 isolate w-1/2 overflow-hidden"
                          style={{
                            visibility: sideVisible("left") ? "visible" : "hidden",
                          }}
                        >
                          {page(index, "left", pageCtx(index))}
                        </div>
                        <div
                          className="absolute inset-y-0 right-0 isolate w-1/2 overflow-hidden"
                          style={{
                            visibility: sideVisible("right") ? "visible" : "hidden",
                          }}
                        >
                          {page(index, "right", pageCtx(index))}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}

              {/* A cast shadow paints only on a half whose board is shown; on a closed cover's
                  empty half it reads as a ghost page (Plan 13). So the cover and back-cover
                  turns mount no shadow at all. */}
              {!mobile && !closed && !coverTurn ? (
                <>
                  <motion.div
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 left-0 w-1/2"
                    style={{
                      opacity: castShadow,
                      background:
                        "linear-gradient(to right, rgba(46,30,18,0.5), rgba(46,30,18,0.08) 55%, transparent)",
                    }}
                  />
                  <motion.div
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 right-0 w-1/2"
                    style={{
                      opacity: castShadow,
                      background:
                        "linear-gradient(to left, rgba(46,30,18,0.32), rgba(46,30,18,0.05) 45%, transparent)",
                    }}
                  />
                </>
              ) : null}

              {!reduced && !mobile ? (
                <motion.div
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 left-1/2 z-30 w-[2.6%] -translate-x-1/2"
                  style={{ opacity: spineOpacity }}
                >
                  <Art
                    src="/womans-day/paper/spiral.webp"
                    className="absolute inset-0 h-full w-full object-fill opacity-90"
                  />
                  <div className="absolute inset-y-[1%] left-[18%] flex w-[18%] flex-col justify-around">
                    {Array.from({ length: 16 }, (_, index) => (
                      <span
                        key={`l-${index}`}
                        className="block aspect-square w-full rounded-full bg-[#4a3527]/45 shadow-[inset_0_1px_1px_rgba(0,0,0,0.35)]"
                      />
                    ))}
                  </div>
                  <div className="absolute inset-y-[1%] right-[18%] flex w-[18%] flex-col justify-around">
                    {Array.from({ length: 16 }, (_, index) => (
                      <span
                        key={`r-${index}`}
                        className="block aspect-square w-full rounded-full bg-[#4a3527]/45 shadow-[inset_0_1px_1px_rgba(0,0,0,0.35)]"
                      />
                    ))}
                  </div>
                </motion.div>
              ) : null}
            </div>

            {/* Hover affordance: a page's OUTER bottom corner peels up when a fine pointer
                hovers a non-interactive area (compositor-only scale/opacity). Hidden during
                a turn, over interactive islands, and at the letter. */}
            {cornerHint("left")}
            {cornerHint("right")}
          </div>

          {/* The turning leaf: a sibling of the overflow-hidden page box (same rect,
              inside the preserve-3d book node), so its 3-D projection is never cropped.
              It is pure decoration: `pointer-events-none` on the wrapper AND `inert` on
              the subtree keep its face content (which is a copy of a real page) from
              being hit-tested or focused — `backface-visibility: hidden` does not remove
              an element from hit-testing, so without this a leaf mounted at rest would
              swallow every click on the right page (measured: it did). The adjacent leaves
              are pre-armed at rest (hidden); only the active turn's leaf is visible. */}
          {!reduced
            ? leafTurns.map((leafTurn) => {
                const visible = turn === leafTurn;
                // The front and back covers are hard boards: one rigid plane (no strip
                // seams, no curl) plus a painted board edge. Paper leaves keep the strip
                // chain so they curl, with a 1 px seam guard inside each face.
                const rigid = leafTurn === "cover" || leafTurn === "back";
                return (
                  <div
                    key={`leaf-${leafTurn}`}
                    inert
                    aria-hidden
                    className={
                      mobile
                        ? "pointer-events-none absolute inset-0 z-40"
                        : "pointer-events-none absolute inset-y-0 left-1/2 z-40 w-1/2"
                    }
                    style={{
                      transformStyle: "preserve-3d",
                      visibility: visible ? "visible" : "hidden",
                    }}
                  >
                    <TurningLeaf
                      progress={progress}
                      segment={segmentFor(leafTurn)}
                      strips={rigid ? 1 : mobile ? 4 : 6}
                      rigid={rigid}
                      front={page(previousSpreadFor(leafTurn), "right", leafCtx)}
                      back={mobile ? <BlankPage /> : page(nextSpreadFor(leafTurn), "left", leafCtx)}
                    />
                  </div>
                );
              })
            : null}

          {/* The ground shadow tracks the visible half of the book (compositor-only). Its
              blur is baked into the gradient so no `filter` runs during a turn. */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -bottom-[4%] left-[8%] h-[7%] w-[84%]"
            style={{
              opacity: groundShadowOpacity,
              transform: shadowTransform,
              background:
                "radial-gradient(50% 50% at 50% 50%, rgba(58,38,26,0.28), rgba(58,38,26,0.14) 55%, rgba(58,38,26,0) 78%)",
            }}
          />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

/**
 * Memoised so a state change in the experience (a parcel tap, a bouquet edit, a name
 * keystroke) does not re-render the whole book unless a prop it reads actually changed.
 * `renderPage` is stabilised with `useCallback` in the experience, so this holds (Plan 10 �B2).
 */
export const Textbook = memo(TextbookImpl);
