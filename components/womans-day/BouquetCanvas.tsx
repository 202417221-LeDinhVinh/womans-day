"use client";

import { motion, AnimatePresence } from "framer-motion";
import { memo, useCallback, useEffect, useRef, useState } from "react";

import type { BouquetState } from "@/lib/womansDay/bouquetState";
import {
  BAND,
  DEFAULT_FILLERS,
  FILLER_ART,
  clampOffset,
  fillerZ,
  headWidthFor,
  headZ,
  layoutFillersFor,
  layoutForItems,
  OFFSET_ROT_RANGE,
  OFFSET_X_RANGE,
  OFFSET_Y_RANGE,
  stemFromBinding,
  wrapFitFor,
  type BouquetItem,
  type BouquetSlot,
} from "@/lib/womansDay/bouquetSlots";
import {
  headSrc,
  ribbonSrc,
  stemSrc,
  wrapFrontSrc,
  wrapSrc,
  type FillerId,
  type WrapId,
} from "@/lib/womansDay/flowers";
import { Art } from "@/components/womans-day/paper";

/** The wrap box as framer-motion animates it: percentages of the 4:5 canvas. */
type WrapBox = { left: string; top: string; width: string; height: string };

/**
 * The bouquet itself. Layer order is what sells it:
 *   wrap-back (full art) → greenery → stems → heads → wrap-front (LIP ONLY) → bow.
 *
 * The wrap is TWO layers: an opaque BACK (the whole painted cone, flap and all) behind the
 * flowers, and the FRONT LIP (`wrap/<id>-front.webp`, the cone below the rim) in FRONT of
 * them, so greenery shows through the opening and the lower ring of heads tucks behind the
 * paper instead of floating above it (Plan 12 §2).
 *
 * GEOMETRY (see `bouquetSlots.ts` for the measured cone constants):
 *   - every positioned layer is `absolute inset-0`, so its left/top percentages resolve
 *     against the 4:5 canvas;
 *   - each stem is a line from the binding point B to its head (atan2 angle, hypot length),
 *     pinned at B, so the stems visibly converge into the cone;
 *   - the wrap (back AND lip), B and the bow all come from ONE `wrapFitFor(count, fillers)`:
 *     a fixed-height box whose rim reproduces the line the layout was authored against and
 *     whose WIDTH is fitted to the lower ring (Plan 14). Nothing scales UNIFORMLY — a wider
 *     bunch stretches the art horizontally while the tip stays in the hand.
 */

function WrapLayer({
  wrap,
  front,
  box,
  glide,
}: {
  wrap: WrapId;
  front: boolean;
  box: WrapBox;
  glide: boolean;
}) {
  const src = front ? wrapFrontSrc(wrap) : wrapSrc(wrap);
  // Hold the displayed art until the newly chosen wrap has LOADED. Swapping the
  // `motion.img` key mid-crossfade with a not-yet-decoded file blanks the whole wrap for
  // a beat (the "wrap disappeared when choosing wrappers" report): the old art fades out
  // while the new one paints nothing during its fade-in. A hidden preload gates the swap,
  // so the crossfade only ever runs between two decoded images.
  const [shown, setShown] = useState(src);
  useEffect(() => {
    if (shown === src) return;
    let cancelled = false;
    const probe = new Image();
    probe.decoding = "async";
    const done = () => {
      if (!cancelled) setShown(src);
    };
    probe.onload = done;
    probe.onerror = done;
    probe.src = src;
    return () => {
      cancelled = true;
    };
  }, [src, shown]);
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute"
      initial={false}
      animate={box}
      transition={glide ? { duration: 0.35, ease: "easeOut" } : { duration: 0 }}
      style={{
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        zIndex: front ? BAND.wrapFront : BAND.wrapBack,
      }}
    >
      <AnimatePresence initial={false}>
        <motion.img
          key={shown}
          src={shown}
          alt=""
          draggable={false}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className={
            front
              ? "absolute inset-0 h-full w-full object-fill"
              : "absolute inset-0 h-full w-full object-fill brightness-[0.96]"
          }
        />
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * A stem from the binding point to `head`. The wrapper is `absolute inset-0`; the image is
 * pinned at B (bottom-centre of a zero-size anchor at B) and rotated about its bottom edge.
 */
function Stem({
  id,
  head,
  z,
  binding,
  enter,
  enterDelay,
}: {
  id: string;
  head: { x: number; y: number };
  z: number;
  binding: { x: number; y: number };
  /** True on a freshly picked flower's first mount: fade in with the head (0.12 s). */
  enter: boolean;
  enterDelay: number;
}) {
  const { angle, length } = stemFromBinding(head, binding);
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{ zIndex: z }}
      initial={enter ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={enter ? { duration: 0.12, delay: enterDelay } : { duration: 0 }}
    >
      <img
        src={stemSrc(id as never)}
        alt=""
        className="absolute object-contain opacity-95"
        style={{
          left: `${binding.x}%`,
          top: `${binding.y}%`,
          height: `${length + 10}cqh`,
          width: "auto",
          maxWidth: "none",
          transform: `translate(-50%, -100%) rotate(${angle}deg)`,
          transformOrigin: "50% 100%",
        }}
        draggable={false}
      />
    </motion.div>
  );
}

/**
 * One flower: the stem, the head anchor and the head. When `interactive`, the head is a real
 * `<button>` that SELECTS on click; dragging moves it, the wax-seal knob rotates it, the
 * wheel rotates a selected head, and the keyboard (arrows / [ / ]) nudges it. Live motion
 * rides MotionValues (no React state per frame); a single `onTransform` commits on release.
 */
function HeadItem({
  item,
  slot,
  index,
  enterDelay,
  size,
  z,
  binding,
  animateIn,
  glide,
  reduced,
  staticView,
  leaf,
  interactive,
  selected,
  onRemove,
  onTransform,
  onSelect,
}: {
  item: BouquetItem;
  slot: BouquetSlot;
  index: number;
  /** Entrance stagger: index-based on the bouquet's first entrance, 0 for later picks. */
  enterDelay: number;
  size: number;
  z: number;
  binding: { x: number; y: number };
  animateIn: boolean;
  glide: boolean;
  reduced: boolean;
  staticView: boolean;
  leaf: boolean;
  interactive: boolean;
  selected: boolean;
  onRemove?: (key: string) => void;
  onTransform?: (key: string, dx: number, dy: number, rot: number) => void;
  onSelect?: (key: string | null) => void;
}) {
  // Live pose: base = the committed slot (with offsets already applied). Dragging updates
  // `dx/dy/rot` locals; the stem re-aims from the live head point so it follows in real time.
  const [dx, setDx] = useState(0);
  const [dy, setDy] = useState(0);
  const [drot, setDrot] = useState(0);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{
    mode: "move" | "rotate";
    startX: number;
    startY: number;
    base: number;
  } | null>(null);

  const baseX = slot.x;
  const baseY = slot.y;
  const liveX = baseX + dx;
  const liveY = baseY + dy;
  const liveRot = slot.rotate + drot;

  useEffect(() => {
    if (!selected) return;
    // A wheel over a SELECTED head rotates it (page scroll is suppressed only then).
    const element = rootRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < 1) return;
      event.preventDefault();
      const step = event.deltaY > 0 ? 4 : -4;
      setDrot((value) => clampOffset(value + step, OFFSET_ROT_RANGE));
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [selected]);

  const commit = useCallback(
    (next: { dx: number; dy: number; rot: number }) => {
      onTransform?.(item.key, next.dx, next.dy, next.rot);
    },
    [item.key, onTransform]
  );

  const onHeadPointerDown = (event: React.PointerEvent) => {
    if (!interactive) return;
    event.stopPropagation();
    onSelect?.(item.key);
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    drag.current = { mode: "move", startX: event.clientX, startY: event.clientY, base: 0 };
  };

  const onHeadPointerMove = (event: React.PointerEvent) => {
    const state = drag.current;
    if (!state || state.mode !== "move") return;
    const canvas = rootRef.current?.parentElement?.getBoundingClientRect();
    if (!canvas) return;
    // Pixel delta → canvas %, relative to the canvas rect (width-% for x, height-% for y).
    setDx(clampOffset(((event.clientX - state.startX) / canvas.width) * 100, OFFSET_X_RANGE));
    setDy(clampOffset(((event.clientY - state.startY) / canvas.height) * 100, OFFSET_Y_RANGE));
  };

  const endDrag = (event: React.PointerEvent) => {
    const state = drag.current;
    drag.current = null;
    if (!state) return;
    (event.target as HTMLElement).releasePointerCapture?.(event.pointerId);
    if (state.mode === "move") commit({ dx, dy, rot: drot });
  };

  const onKnobPointerDown = (event: React.PointerEvent) => {
    if (!interactive) return;
    event.stopPropagation();
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    drag.current = { mode: "rotate", startX: event.clientX, startY: event.clientY, base: drot };
  };

  const onKnobPointerMove = (event: React.PointerEvent) => {
    const state = drag.current;
    if (!state || state.mode !== "rotate") return;
    const canvas = rootRef.current?.parentElement?.getBoundingClientRect();
    if (!canvas) return;
    const cx = canvas.left + (canvas.width * liveX) / 100;
    const cy = canvas.top + (canvas.height * liveY) / 100;
    const angle = (Math.atan2(event.clientY - cy, event.clientX - cx) * 180) / Math.PI + 90;
    // Snap softly to 0 within ±3°.
    const snapped = Math.abs(angle) < 3 ? 0 : angle;
    setDrot(clampOffset(snapped - slot.rotate, OFFSET_ROT_RANGE));
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!interactive) return;
    const step = event.shiftKey ? 4 : 1;
    let next: { dx: number; dy: number; rot: number } | null = null;
    if (event.key === "ArrowLeft")
      next = { dx: clampOffset(dx - step, OFFSET_X_RANGE), dy, rot: drot };
    else if (event.key === "ArrowRight")
      next = { dx: clampOffset(dx + step, OFFSET_X_RANGE), dy, rot: drot };
    else if (event.key === "ArrowUp")
      next = { dx, dy: clampOffset(dy - step, OFFSET_Y_RANGE), rot: drot };
    else if (event.key === "ArrowDown")
      next = { dx, dy: clampOffset(dy + step, OFFSET_Y_RANGE), rot: drot };
    else if (event.key === "[") next = { dx, dy, rot: clampOffset(drot - 5, OFFSET_ROT_RANGE) };
    else if (event.key === "]") next = { dx, dy, rot: clampOffset(drot + 5, OFFSET_ROT_RANGE) };
    else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      event.stopPropagation();
      onRemove?.(item.key);
      return;
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onSelect?.(null);
      return;
    }
    if (!next) return;
    event.preventDefault();
    event.stopPropagation();
    setDx(next.dx);
    setDy(next.dy);
    setDrot(next.rot);
    commit(next);
  };

  return (
    <div ref={rootRef} className="absolute inset-0" style={{ zIndex: selected ? 79 : z }}>
      <Stem
        id={item.id}
        head={{ x: liveX, y: liveY }}
        z={BAND.stems}
        binding={binding}
        enter={animateIn}
        enterDelay={enterDelay}
      />
      {/* ONE zero-size anchor at the slot point. The slot point is the head's
          BOTTOM-CENTRE (where its stem meets it) — never combine Tailwind `translate-*`
          utilities with an inline `transform` (Tailwind v4 composes them and the head
          shifts half a head left). The anchor's left/top animate on rearrange (glide,
          not teleport). */}
      <div
        className="absolute"
        style={{
          left: `${liveX}%`,
          top: `${liveY}%`,
          transition: drag.current
            ? undefined
            : glide
              ? "left 0.35s ease-out, top 0.35s ease-out"
              : undefined,
        }}
      >
        <div
          className={staticView || reduced || leaf ? "" : "wd-wobble"}
          style={{
            transformOrigin: "0 0",
            ["--wd-tilt" as string]: `${liveRot}deg`,
            animationDuration: `${8 + (index % 4)}s`,
          }}
        >
          <motion.div
            style={{ transformOrigin: "0 0" }}
            initial={animateIn ? { opacity: 0, y: 24, scale: 0.8, rotate: slot.rotate - 9 } : false}
            animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
            transition={{
              default: { type: "spring", stiffness: 250, damping: 18, delay: enterDelay },
              opacity: { duration: 0.12, delay: enterDelay },
            }}
          >
            <div
              ref={anchorRef}
              className="absolute left-0 top-0"
              style={{
                width: `${size}cqw`,
                height: `${size}cqw`,
                transform: `translate(-50%, -100%) scale(${selected ? 1.04 : 1})`,
                transition: "transform 0.16s ease-out",
              }}
            >
              {selected ? (
                <>
                  {/* Soft cream halo behind the head. */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{
                      width: "150%",
                      height: "150%",
                      background:
                        "radial-gradient(closest-side, rgba(244,236,216,0.55), rgba(244,236,216,0))",
                    }}
                  />
                  {/* Slowly rotating dashed ink circle. */}
                  <motion.div
                    aria-hidden
                    className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{ width: "132%", height: "132%" }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 24, ease: "linear", repeat: Infinity }}
                  >
                    <svg viewBox="0 0 100 100" className="h-full w-full">
                      <circle
                        cx="50"
                        cy="50"
                        r="48"
                        fill="none"
                        stroke="#5b4636"
                        strokeOpacity="0.55"
                        strokeWidth="1.5"
                        strokeDasharray="4 6"
                      />
                    </svg>
                  </motion.div>
                  {/* Dotted line + wax-seal rotate handle above the head. */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute left-1/2 top-0 h-[46%] w-px -translate-x-1/2 -translate-y-full"
                    style={{ borderLeft: "1.5px dotted #5b4636", opacity: 0.55 }}
                  />
                  <button
                    type="button"
                    onPointerDown={onKnobPointerDown}
                    onPointerMove={onKnobPointerMove}
                    onPointerUp={endDrag}
                    aria-label={`Turn the ${item.id.replace("-", " ")}`}
                    className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[130%] cursor-grab touch-none outline-none focus-visible:ring-2 focus-visible:ring-[#b0566b]"
                    style={{ width: "22px", height: "22px" }}
                  >
                    <Art
                      src="/womans-day/stickers/wax-seal.webp"
                      className="h-full w-full object-contain drop-shadow-[0_2px_3px_rgba(74,44,36,0.3)]"
                    />
                  </button>
                </>
              ) : null}

              <button
                type="button"
                aria-pressed={selected}
                aria-label={`${item.id.replace("-", " ")}${
                  selected ? " selected. Drag to move, use the knob to turn." : ""
                }`}
                onPointerDown={onHeadPointerDown}
                onPointerMove={onHeadPointerMove}
                onPointerUp={endDrag}
                onKeyDown={onKeyDown}
                className="absolute left-0 top-0 h-full w-full cursor-grab touch-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#b0566b]"
                style={{ zIndex: BAND.removeTargets + 2 }}
              >
                <img
                  src={headSrc(item.id)}
                  decoding="async"
                  alt={`A ${item.id} in the bouquet`}
                  className={`pointer-events-none h-full w-full object-contain ${
                    selected
                      ? "drop-shadow-[0_0.9cqw_1.1cqw_rgba(74,44,36,0.4)]"
                      : "drop-shadow-[0_0.6cqw_0.8cqw_rgba(74,44,36,0.28)]"
                  }`}
                  draggable={false}
                />
              </button>

              {/* A small "take out" paper tag on the selection (removal moved OFF the plain
                  click, which now selects). */}
              {selected && onRemove ? (
                <button
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => onRemove(item.key)}
                  className="absolute left-1/2 top-full mt-[2%] -translate-x-1/2 cursor-pointer border border-[#8a6a4c]/45 bg-[#f7f0df]/90 px-[0.5cqw] py-[0.15cqw] font-[family-name:var(--font-type)] text-[1.6cqw] text-[#4c3a2b] hover:bg-[#efe4cd]"
                  style={{ zIndex: BAND.removeTargets + 3 }}
                >
                  take out ×
                </button>
              ) : null}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function BouquetCanvasImpl({
  state,
  onRemove,
  onRemoveFiller,
  onTransform,
  selectedKey = null,
  onSelect,
  reduced,
  className = "",
  staticView = false,
  arrived = true,
  variant = "page",
}: {
  state: BouquetState;
  onRemove?: (key: string) => void;
  onRemoveFiller?: (index: number) => void;
  /** Commit a manual head offset (canvas-% / deg). */
  onTransform?: (key: string, dx: number, dy: number, rot: number) => void;
  /** Which head is selected (page variant only). */
  selectedKey?: string | null;
  onSelect?: (key: string | null) => void;
  reduced?: boolean;
  className?: string;
  /** Keepsake/letter use: no remove targets, no idle sway. */
  staticView?: boolean;
  /** True once the reader has come to rest on this spread; entry animations run then. */
  arrived?: boolean;
  /** "leaf" = static, motionless copy inside a turning leaf (pixel-identical to the base). */
  variant?: "page" | "leaf";
}) {
  const greenery: FillerId[] =
    state.fillers.length > 0
      ? state.fillers
      : (DEFAULT_FILLERS.slice(0, 3) as unknown as FillerId[]);

  const fit = wrapFitFor(state.items.length, greenery.length);
  const wrapBox: WrapBox = {
    left: `${fit.box.left}%`,
    top: `${fit.box.top}%`,
    width: `${fit.box.width}%`,
    height: `${fit.box.height}%`,
  };
  const headWidth = headWidthFor(state.items.length);
  const itemLayout = layoutForItems(state.items);
  const fillerLayout = layoutFillersFor(greenery.length, state.items.length);
  const binding = fit.binding;
  const leaf = variant === "leaf";
  const animateIn = !staticView && !leaf && arrived && !reduced;
  const glide = !staticView && !reduced && !leaf;
  const interactive = !staticView && !leaf && Boolean(onSelect);

  // Stagger only the bouquet's FIRST entrance: keys already shown (or picked after the
  // first entrance) enter with no delay, so a freshly picked flower never waits
  // index × 50 ms. Removing and re-adding mints a new key that still enters promptly;
  // rearrange keeps keys, so it glides instead of re-entering.
  const shownKeysRef = useRef<Set<string>>(new Set());
  const firstEntranceDoneRef = useRef(false);
  useEffect(() => {
    if (!animateIn) return;
    for (const item of state.items) shownKeysRef.current.add(item.key);
    firstEntranceDoneRef.current = true;
  });

  return (
    <div
      data-wd-interactive={leaf || staticView ? undefined : ""}
      className={`relative aspect-[4/5] w-full select-none ${className}`}
      style={{ containerType: "size" }}
      onClick={(event) => {
        // Clicking empty canvas deselects (a head's own pointerdown stops propagation).
        if (interactive && event.target === event.currentTarget) onSelect?.(null);
      }}
    >
      <WrapLayer wrap={state.wrap} front={false} box={wrapBox} glide={glide} />

      {greenery.slice(0, fillerLayout.length).map((id, index) => {
        const spray = fillerLayout[index];
        if (!spray) return null;
        const art = FILLER_ART[id];
        // ONE image per spray, bottom anchored a touch below the rim so its cut end is
        // hidden by the lip, rotated about its bottom centre. Right-side sprays mirror so
        // both sides curve outward.
        const z = fillerZ(index === 0 ? 12 : 8);
        return (
          <motion.div
            key={`filler-${index}-${id}`}
            className="absolute inset-0"
            initial={animateIn ? { opacity: 0, y: 18 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 20, delay: index * 0.04 }}
          >
            <div aria-hidden className="pointer-events-none absolute inset-0" style={{ zIndex: z }}>
              <img
                src={stemSrc(id)}
                alt=""
                className="absolute h-auto object-contain"
                style={{
                  left: `${spray.x}%`,
                  top: `${spray.y}%`,
                  height: `${spray.length}cqh`,
                  width: "auto",
                  maxWidth: "none",
                  transformOrigin: "50% 100%",
                  transform: `translate(-50%, -100%) rotate(${spray.angle}deg)${
                    spray.flip ? " scaleX(-1)" : ""
                  }`,
                }}
                draggable={false}
              />
            </div>
            {!staticView && !leaf && onRemoveFiller ? (
              // One remove target per spray, in the overlay band (above the heads and the
              // lip) and centred on the spray's visible part so it never sits on a head.
              <button
                type="button"
                onClick={() => onRemoveFiller(index)}
                aria-label={`Take the ${id.replace("-", " ")} out of the bouquet`}
                className="absolute h-[16cqw] w-[16cqw] -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#b0566b]"
                style={{
                  left: `${spray.x + Math.sin((spray.angle * Math.PI) / 180) * spray.length * 0.6 * 0.8}%`,
                  top: `${spray.y - Math.cos((spray.angle * Math.PI) / 180) * spray.length * 0.6}%`,
                  zIndex: BAND.removeTargets + (art.airy ? 1 : 0),
                }}
              />
            ) : null}
          </motion.div>
        );
      })}

      {state.items.map((item, index) => {
        const slot = itemLayout[index];
        if (!slot) return null;
        const size = headWidth * slot.scale;
        const z = headZ(slot.z);
        const selected = interactive && selectedKey === item.key;

        const shown = shownKeysRef.current.has(item.key);
        const enterDelay = !animateIn || shown || firstEntranceDoneRef.current ? 0 : index * 0.05;

        return (
          <HeadItem
            key={item.key}
            item={item}
            slot={slot}
            index={index}
            enterDelay={enterDelay}
            size={size}
            z={z}
            binding={binding}
            animateIn={animateIn}
            glide={glide}
            reduced={Boolean(reduced)}
            staticView={staticView}
            leaf={leaf}
            interactive={interactive}
            selected={selected}
            onRemove={onRemove}
            onTransform={onTransform}
            onSelect={onSelect}
          />
        );
      })}

      <WrapLayer wrap={state.wrap} front box={wrapBox} glide={glide} />

      <motion.div
        initial={animateIn ? { opacity: 0, scale: 0.85, y: 8 } : false}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: animateIn ? 0.15 : 0, type: "spring", stiffness: 220, damping: 18 }}
        className="pointer-events-none absolute left-1/2 -translate-x-1/2"
        style={{
          top: `${fit.bow.top}%`,
          width: `${fit.bow.width}%`,
          zIndex: BAND.ribbon,
        }}
      >
        <Art
          src={ribbonSrc(state.ribbon)}
          className="h-auto w-full drop-shadow-[0_0.3cqw_0.4cqw_rgba(80,45,35,0.22)]"
        />
      </motion.div>
    </div>
  );
}

export const BouquetCanvas = memo(BouquetCanvasImpl);
