"use client";

import { motion } from "framer-motion";
import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

import { FLOWERS, type Flower, type FlowerId } from "@/lib/womansDay/flowers";
import { hashTag } from "@/lib/womansDay/flowerHash";
import { GROUND_BAND, MAX_PLANTED, surpriseFlower, type Planted } from "@/lib/womansDay/garden";
import type { PolaroidAction, PolaroidState } from "@/lib/womansDay/polaroidState";
import { FRAME_ART, WINDOW, CAPTION_TOP } from "@/lib/womansDay/polaroidGeometry";
import { Art, PaperSurface } from "@/components/womans-day/paper";
import { GardenPlant } from "@/components/womans-day/GardenPlant";
import { ScratchFoil } from "@/components/womans-day/ScratchFoil";

/**
 * The garden spread (Plan 15 §2): left page "You, in bloom" (the scratch polaroid), right
 * page the garden the reader plants. Both are authored on ONE layout shared by desktop and
 * mobile (mobile stacks them into a single page).
 */

const SEED_COUNT = 5;

/** The ground layer stack shared by every layout: back soil → flowers → front grass. */
function GroundLayers({
  planted,
  freshKeys,
  variant,
}: {
  planted: readonly Planted[];
  freshKeys: ReadonlySet<string>;
  variant: "page" | "leaf";
}) {
  // Container-query units (`cqw`/`cqh`) proved unreliable inside the transformed absolute
  // subtree of a planting (the head computed to 0 width), so the ground measures its own box
  // and publishes the pixel size as CSS vars the plants size against. `useLayoutEffect`
  // measures before paint so the first planted flower is already correctly sized.
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setSize((prev) =>
        Math.abs(prev.w - rect.width) < 0.5 && Math.abs(prev.h - rect.height) < 0.5
          ? prev
          : { w: rect.width, h: rect.height }
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="absolute inset-0 select-none"
      style={
        (size.w > 0 ? { "--gw": `${size.w}px`, "--gh": `${size.h}px` } : {}) as React.CSSProperties
      }
    >
      <Art
        src="/womans-day/garden/ground-back.webp"
        className="absolute inset-x-0 bottom-0 h-[24%] w-full object-fill"
      />
      {planted.map((plant) => (
        <GardenPlant
          key={plant.key}
          plant={plant}
          fresh={freshKeys.has(plant.key)}
          variant={variant}
        />
      ))}
      {/* The foreground grass draws OVER the stem bases, so a stem reads as growing out of
          the earth rather than starting on top of it. */}
      <Art
        src="/womans-day/garden/ground-front.webp"
        className="absolute inset-x-0 bottom-0 h-[14%] w-full object-fill"
      />
    </div>
  );
}

/** The import / foil / reveal controls for the polaroid, plus the frame art. */
function PolaroidCard({
  flower,
  polaroid,
  polaroidDispatch,
  onPickFile,
  onScratchSound,
  reduced,
  variant,
}: {
  flower: Flower;
  polaroid: PolaroidState;
  polaroidDispatch: React.Dispatch<PolaroidAction>;
  onPickFile?: () => void;
  onScratchSound?: () => void;
  reduced: boolean;
  variant: "page" | "leaf";
}) {
  const [progress, setProgress] = useState(0);
  const leaf = variant === "leaf";
  const hasPhoto = Boolean(polaroid.photoUrl);

  // Locked to the frame art's aspect ratio: the window/photo rects are percentages of
  // this box, so any stretch misaligns them with the frame's real opening and the photo
  // spills out as a rectangle. Height binds in practice; max-w is only a guard.
  return (
    <div
      className="relative mx-auto h-full max-h-full w-auto max-w-[92%] select-none"
      style={{ aspectRatio: `${FRAME_ART.width} / ${FRAME_ART.height}` }}
    >
      <div className="relative h-full w-full -rotate-[3deg]">
        <Art src="/womans-day/polaroid/frame.webp" className="h-full w-full object-contain" />

        {/* The photo window, positioned from the measured frame geometry. The frame art
            carries a dark inner rim right at the window edge; a slightly larger off-white
            mat (the card colour) sits just outside the window and masks it, so the frame
            reads as a clean off-white polaroid. */}
        <div
          aria-hidden
          className="absolute rounded-[1%]"
          style={{
            left: `${WINDOW.left - 1.5}%`,
            top: `${WINDOW.top - 1.5}%`,
            width: `${WINDOW.width + 3}%`,
            height: `${WINDOW.height + 3}%`,
            background: "#f4ecd8",
          }}
        />
        <div
          className="absolute select-none"
          style={{
            left: `${WINDOW.left}%`,
            top: `${WINDOW.top}%`,
            width: `${WINDOW.width}%`,
            height: `${WINDOW.height}%`,
          }}
        >
          {hasPhoto ? (
            <>
              {/* The photo, treated so any phone photo matches the painted page. It never
                  takes pointer input or selection: the foil canvas above it owns every
                  scratch drag, so a drag can never select/drag the picture instead. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={polaroid.photoUrl ?? ""}
                alt="You, in bloom"
                className="pointer-events-none absolute inset-0 h-full w-full object-cover select-none [-webkit-touch-callout:none]"
                style={{
                  filter: "sepia(0.14) saturate(0.9) contrast(0.95) brightness(1.03)",
                }}
                draggable={false}
              />
              <Art
                src="/womans-day/paper/grain.webp"
                className="absolute inset-0 h-full w-full object-cover opacity-[0.28] mix-blend-multiply"
              />
              <div
                aria-hidden
                className="absolute inset-0 mix-blend-multiply"
                style={{
                  background: "radial-gradient(closest-side, transparent 60%, rgba(58,38,24,0.18))",
                }}
              />
            </>
          ) : (
            <>
              <Art
                src="/womans-day/polaroid/empty-window.webp"
                className="absolute inset-0 h-full w-full object-cover"
              />
              {/* Tapping the empty window opens the picker too, like Add your photo. */}
              {!leaf && onPickFile ? (
                <button
                  type="button"
                  onClick={onPickFile}
                  aria-label="Add your photo"
                  className="absolute inset-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#b0566b]"
                />
              ) : null}
            </>
          )}

          {hasPhoto ? (
            <>
              <ScratchFoil
                interactive={!leaf}
                leafSnapshot={leaf ? polaroid.foilSnapshot : null}
                strokes={polaroid.strokes}
                playSound={leaf ? undefined : onScratchSound}
                onProgress={leaf ? undefined : setProgress}
                onReveal={leaf ? undefined : () => polaroidDispatch({ type: "reveal" })}
                onStrokesChange={
                  leaf ? undefined : (value) => polaroidDispatch({ type: "strokes", value })
                }
                onSnapshot={
                  leaf ? undefined : (value) => polaroidDispatch({ type: "foilSnapshot", value })
                }
              />
              {/* The coin scratcher, resting on the frame's bottom-right; it does an idle
                  zig-zag hint over the foil until the first stroke, then puts itself away
                  once the window is mostly scratched (page variant only). */}
              {!leaf && !polaroid.revealed ? (
                <motion.div
                  aria-hidden
                  className="pointer-events-none absolute"
                  style={{ right: "-6%", bottom: "2%", width: "16%" }}
                  animate={
                    progress > 0
                      ? { rotate: 20, x: 0, y: 0 }
                      : {
                          rotate: [20, 26, 18, 24, 20],
                          x: [0, -14, 10, -6, 0],
                          y: [0, -8, -2, -6, 0],
                        }
                  }
                  transition={
                    progress > 0
                      ? { duration: 0.4 }
                      : { duration: 0.9, repeat: Infinity, repeatDelay: 2.1, ease: "easeInOut" }
                  }
                >
                  <Art
                    src="/womans-day/polaroid/coin.webp"
                    className="h-auto w-full drop-shadow-[0_0.4cqw_0.5cqw_rgba(74,44,36,0.35)]"
                  />
                </motion.div>
              ) : null}
            </>
          ) : null}
        </div>

        {/* Bottom caption strip (editable). */}
        <div
          className="absolute inset-x-0"
          style={{ top: `${CAPTION_TOP}%`, height: `${100 - CAPTION_TOP - 4}%` }}
        >
          <input
            value={polaroid.caption}
            onChange={(event) => polaroidDispatch({ type: "caption", value: event.target.value })}
            disabled={leaf}
            maxLength={32}
            placeholder={`${flower.name}, in full bloom`}
            aria-label="Polaroid caption"
            className="h-full w-full bg-transparent px-[10%] text-center font-[family-name:var(--font-hand)] text-[1.7cqw] text-[#5b4a3a] caret-[#b0566b] outline-none placeholder:text-[#a89madd]"
            style={{ fontFamily: "var(--font-hand)" }}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Action row under the polaroid: upload / change / remove + re-scratch. It lives in normal
 * flow BELOW the card — the old `-bottom-[14%]` overlay hung outside the card and was
 * clipped by the page's `overflow-hidden`, so Change photo was unreachable and the frame's
 * bottom looked cut off. The box always renders (the leaf copy gets an invisible
 * placeholder) so the leaf stays pixel-identical to the page.
 */
function PolaroidFooter({
  hasPhoto,
  leaf,
  onPickFile,
  onRescratch,
  onRemove,
  className = "",
}: {
  hasPhoto: boolean;
  leaf: boolean;
  onPickFile?: () => void;
  onRescratch: () => void;
  onRemove: () => void;
  className?: string;
}) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center ${className}`}
      aria-hidden={leaf || undefined}
    >
      <div inert={leaf ? true : undefined} className={leaf ? "invisible" : undefined}>
        {!hasPhoto ? (
          <div className="flex flex-col items-center gap-[0.4cqw]">
            <button
              type="button"
              onClick={onPickFile}
              className="cursor-pointer px-1 py-1.5 font-[family-name:var(--font-type)] text-[15px] text-[#6c5744] underline decoration-dotted hover:text-[#b0566b]"
            >
              Add your photo
            </button>
            <p className="font-[family-name:var(--font-note)] text-[10px] text-[#34496b]/70">
              Your photo stays on this device. It is never uploaded.
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-1 whitespace-nowrap font-[family-name:var(--font-type)] text-[11px] text-[#6c5744]">
            <button
              type="button"
              onClick={onRescratch}
              className="cursor-pointer px-1 py-1.5 underline decoration-dotted hover:text-[#b0566b]"
            >
              Scratch again
            </button>
            <span aria-hidden>·</span>
            <button
              type="button"
              onClick={onPickFile}
              className="cursor-pointer px-1 py-1.5 underline decoration-dotted hover:text-[#b0566b]"
            >
              Change photo
            </button>
            <span aria-hidden>·</span>
            <button
              type="button"
              onClick={onRemove}
              className="cursor-pointer px-1 py-1.5 underline decoration-dotted hover:text-[#b0566b]"
            >
              Remove photo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** One painted seed packet in the tray. */
function SeedPacket({
  flower,
  selected,
  surprise,
  onSelect,
}: {
  flower: Flower | null;
  selected: boolean;
  surprise?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`relative flex w-full flex-col items-center transition-transform ${
        selected ? "-translate-y-[3%]" : ""
      } cursor-pointer`}
    >
      <div className="relative h-[6cqw] w-full">
        <Art src="/womans-day/garden/seed-packet.webp" className="h-full w-full object-contain" />
        {flower ? (
          <Art
            src={`/womans-day/flowers/${flower.id}/head-sm.webp`}
            className="absolute left-1/2 top-[26%] w-[42%] -translate-x-1/2 opacity-90 mix-blend-multiply"
          />
        ) : null}
        {surprise ? (
          <span className="absolute left-1/2 top-[22%] -translate-x-1/2 font-[family-name:var(--font-hand)] text-[2.4cqw] text-[#7a4a2b]">
            ?
          </span>
        ) : null}
      </div>
      <p className="mt-[0.2cqw] w-full truncate text-center font-[family-name:var(--font-type)] text-[1.05cqw] tracking-[0.02em] text-[#5f4b3a]">
        {surprise ? "surprise" : (flower?.name ?? "")}
      </p>
    </button>
  );
}

function GardenRightPageImpl({
  flower,
  planted,
  freshKeys,
  onPlant,
  onClear,
  variant,
}: {
  flower: Flower;
  planted: readonly Planted[];
  freshKeys: ReadonlySet<string>;
  onPlant: (cx: number, cy: number, id: FlowerId | null) => void;
  /** Empty the garden so the reader can redo the page (page variant only). */
  onClear?: () => void;
  variant: "page" | "leaf";
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [picker, setPicker] = useState<number>(SEED_COUNT); // default = surprise
  const leaf = variant === "leaf";

  // Deterministic packets: the reader's own first, then 3 picks by the name hash, then a
  // "surprise me" packet.
  const packets = useMemo(() => {
    const tag = hashTag(flower.name).charCodeAt(0);
    const picks: (Flower | null)[] = [flower];
    const pool = FLOWERS.filter((f) => f.id !== flower.id);
    for (let i = 0; i < 3; i += 1) {
      picks.push(pool[(tag + i * 7) % pool.length]);
    }
    picks.push(null); // surprise
    return picks;
  }, [flower]);

  const plantHere = useCallback(
    (clientX: number, clientY: number) => {
      const root = rootRef.current;
      if (!root) return;
      const rect = root.getBoundingClientRect();
      const cx = ((clientX - rect.left) / rect.width) * 100;
      const cy = ((clientY - rect.top) / rect.height) * 100;
      const packet = packets[picker];
      onPlant(cx, cy, packet ? packet.id : null);
    },
    [onPlant, packets, picker]
  );

  return (
    <PaperSurface>
      <div
        ref={rootRef}
        data-wd-interactive
        className="relative h-full w-full select-none"
        style={{ containerType: "size" }}
        onClick={(event) => {
          if (leaf) return;
          // Only plant when the click is on non-interactive page area. The root itself is
          // `data-wd-interactive` (to stop the page-turn handler), so exclude it: test the
          // real controls nested inside.
          const target = event.target as HTMLElement;
          if (target !== event.currentTarget && target.closest("button, input")) return;
          plantHere(event.clientX, event.clientY);
        }}
      >
        <div className="absolute left-[8%] top-[6%] max-w-[50%]">
          <h2 className="font-[family-name:var(--font-book)] wd-t-h italic text-[#3b3128]">
            A garden for you
          </h2>
          <p className="mt-[0.4cqw] font-[family-name:var(--font-note)] text-[#34496b]/75 wd-t-sm">
            tap anywhere — something will grow.
          </p>
          {!leaf && onClear ? (
            <button
              type="button"
              onClick={onClear}
              disabled={planted.length === 0}
              className="relative z-10 mt-[0.3cqw] cursor-pointer font-[family-name:var(--font-type)] wd-t-2xs text-[#6c5744] underline decoration-dotted hover:text-[#b0566b] disabled:cursor-default disabled:opacity-45 disabled:hover:text-[#6c5744]"
            >
              Clear garden
            </button>
          ) : null}
        </div>

        {/* Seed tray top-right. */}
        {!leaf ? (
          <div className="absolute right-[5%] top-[5%] w-[40%]">
            <div className="flex items-start justify-between gap-[0.5cqw]">
              {packets.map((packet, index) => (
                <div key={index} className="min-w-0 flex-1">
                  <SeedPacket
                    flower={packet}
                    surprise={packet === null}
                    selected={picker === index}
                    onSelect={() => setPicker(index)}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <GroundLayers planted={planted} freshKeys={freshKeys} variant={variant} />

        <Art
          src="/womans-day/garden/watering-can.webp"
          className="absolute bottom-[16%] left-[3%] w-[12%] -rotate-6 opacity-95"
        />
        <Art
          src="/womans-day/stickers/butterfly.webp"
          className="absolute right-[10%] top-[26%] w-[9%] rotate-6 opacity-90"
        />
      </div>
    </PaperSurface>
  );
}

function GardenLeftPageImpl({
  flower,
  polaroid,
  polaroidDispatch,
  onPickFile,
  onScratchSound,
  reduced,
  variant,
}: {
  flower: Flower;
  polaroid: PolaroidState;
  polaroidDispatch: React.Dispatch<PolaroidAction>;
  onPickFile?: () => void;
  onScratchSound?: () => void;
  reduced: boolean;
  variant: "page" | "leaf";
}) {
  return (
    <PaperSurface>
      <div className="relative flex h-full flex-col px-[8%] pb-[5%] pt-[4%]">
        <div className="flex items-baseline justify-between">
          <h2 className="font-[family-name:var(--font-book)] wd-t-lead italic text-[#3b3128]">
            You, in bloom
          </h2>
          <p className="font-[family-name:var(--font-type)] wd-t-2xs tracking-[0.14em] text-[#8a745c]">
            page 02 · 20.10
          </p>
        </div>
        <div className="relative mt-[2%] flex min-h-0 flex-1 justify-center">
          <PolaroidCard
            flower={flower}
            polaroid={polaroid}
            polaroidDispatch={polaroidDispatch}
            onPickFile={onPickFile}
            onScratchSound={onScratchSound}
            reduced={reduced}
            variant={variant}
          />
        </div>
        <PolaroidFooter
          hasPhoto={Boolean(polaroid.photoUrl)}
          leaf={variant === "leaf"}
          onPickFile={onPickFile}
          onRescratch={() => polaroidDispatch({ type: "refoil" })}
          onRemove={() => polaroidDispatch({ type: "photo", blob: null, url: null })}
          className="relative z-10 mt-[2%] min-h-[8%]"
        />
      </div>
    </PaperSurface>
  );
}

export const GardenLeftPage = memo(GardenLeftPageImpl);
export const GardenRightPage = memo(GardenRightPageImpl);
export const PolaroidPage = GardenLeftPage;
export const GardenPage = GardenRightPage;

/** Mobile: one page — the polaroid in the top ~46 %, the ground + garden in the bottom. */
function GardenMobilePageImpl({
  flower,
  planted,
  freshKeys,
  onPlant,
  onClear,
  polaroid,
  polaroidDispatch,
  onPickFile,
  onScratchSound,
  reduced,
  variant,
}: {
  flower: Flower;
  planted: readonly Planted[];
  freshKeys: ReadonlySet<string>;
  onPlant: (cx: number, cy: number, id: FlowerId | null) => void;
  /** Empty the garden so the reader can redo the page (page variant only). */
  onClear?: () => void;
  polaroid: PolaroidState;
  polaroidDispatch: React.Dispatch<PolaroidAction>;
  onPickFile?: () => void;
  onScratchSound?: () => void;
  reduced: boolean;
  variant: "page" | "leaf";
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const leaf = variant === "leaf";
  const plantHere = useCallback(
    (clientX: number, clientY: number) => {
      const root = rootRef.current;
      if (!root) return;
      const rect = root.getBoundingClientRect();
      onPlant(
        ((clientX - rect.left) / rect.width) * 100,
        ((clientY - rect.top) / rect.height) * 100,
        null
      );
    },
    [onPlant]
  );

  return (
    <PaperSurface>
      <div className="flex h-full flex-col px-[8%] pt-[5%]">
        <div className="flex items-baseline justify-between">
          <h2 className="font-[family-name:var(--font-book)] wd-t-lead italic text-[#3b3128]">
            You, in bloom
          </h2>
          <p className="font-[family-name:var(--font-type)] wd-t-2xs tracking-[0.12em] text-[#8a745c]">
            page 02 · 20.10
          </p>
        </div>
        <div className="mt-[2%] flex h-[42%] justify-center">
          <PolaroidCard
            flower={flower}
            polaroid={polaroid}
            polaroidDispatch={polaroidDispatch}
            onPickFile={onPickFile}
            onScratchSound={onScratchSound}
            reduced={reduced}
            variant={variant}
          />
        </div>
        <PolaroidFooter
          hasPhoto={Boolean(polaroid.photoUrl)}
          leaf={variant === "leaf"}
          onPickFile={onPickFile}
          onRescratch={() => polaroidDispatch({ type: "refoil" })}
          onRemove={() => polaroidDispatch({ type: "photo", blob: null, url: null })}
          className="mt-[2%]"
        />
        <div
          ref={rootRef}
          data-wd-interactive
          className="relative mt-[3%] min-h-0 flex-1 select-none"
          style={{ containerType: "size" }}
          onClick={(event) => {
            if (leaf) return;
            const target = event.target as HTMLElement;
            if (target !== event.currentTarget && target.closest("button, input")) return;
            plantHere(event.clientX, event.clientY);
          }}
        >
          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2">
            <p className="font-[family-name:var(--font-note)] wd-t-sm text-[#34496b]/75">
              tap anywhere — something will grow.
            </p>
            {!leaf && onClear ? (
              <button
                type="button"
                onClick={onClear}
                disabled={planted.length === 0}
                className="relative z-10 shrink-0 cursor-pointer font-[family-name:var(--font-type)] wd-t-2xs text-[#6c5744] underline decoration-dotted hover:text-[#b0566b] disabled:cursor-default disabled:opacity-45 disabled:hover:text-[#6c5744]"
              >
                Clear garden
              </button>
            ) : null}
          </div>
          <GroundLayers planted={planted} freshKeys={freshKeys} variant={variant} />
        </div>
      </div>
    </PaperSurface>
  );
}

export const GardenMobilePage = memo(GardenMobilePageImpl);
