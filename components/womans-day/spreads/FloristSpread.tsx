"use client";

import { memo, type Dispatch } from "react";

import type { BouquetAction, BouquetState } from "@/lib/womansDay/bouquetState";
import { MAX_BOUQUET, MAX_FILLERS } from "@/lib/womansDay/bouquetSlots";
import { newStemKey } from "@/lib/womansDay/bouquetState";
import {
  RIBBON_IDS,
  RIBBONS,
  WRAP_IDS,
  WRAPS,
  isFlowerId,
  ribbonSrc,
  type FillerId,
  type Flower,
  type FlowerId,
  type RibbonId,
  type StemId,
  type WrapId,
  wrapFrontSrc,
  wrapSrc,
} from "@/lib/womansDay/flowers";
import { playSound } from "@/lib/womansDay/sound";
import { BouquetCanvas } from "@/components/womans-day/BouquetCanvas";
import {
  BouquetShelf,
  FillerShelf,
  shelfCapacityLabel,
} from "@/components/womans-day/BouquetShelf";
import { PaperSurface, Sticker, Washi, warmImage } from "@/components/womans-day/paper";

const RIBBON_SWATCH: Record<RibbonId, string> = {
  blush: "#e3b7bd",
  cream: "#efe3c8",
  red: "#a83a3a",
  sage: "#a9b89a",
};

function useBouquetActions(
  bouquet: BouquetState,
  dispatch: Dispatch<BouquetAction>,
  onRemoved: () => void
) {
  function add(id: StemId) {
    if (isFlowerId(id)) {
      if (bouquet.items.length >= MAX_BOUQUET) return;
      playSound("stem");
      dispatch({ type: "add", id: id as FlowerId, key: newStemKey(id) });
      return;
    }
    if (bouquet.fillers.length >= MAX_FILLERS) return;
    playSound("stem");
    dispatch({ type: "addFiller", id: id as FillerId });
  }

  function remove(key: string) {
    playSound("stem");
    dispatch({ type: "remove", key });
    onRemoved();
  }

  function removeFiller(index: number) {
    playSound("stem");
    dispatch({ type: "removeFiller", index });
    onRemoved();
  }

  function transform(key: string, dx: number, dy: number, rot: number) {
    dispatch({ type: "transform", key, dx, dy, rot });
  }

  return { add, remove, removeFiller, transform };
}

function Swatch({
  label,
  background,
  selected,
  onSelect,
  onWarm,
}: {
  label: string;
  background: string;
  selected: boolean;
  onSelect: () => void;
  /** Warm the art behind this swatch on hover/focus, so selecting it never blanks. */
  onWarm?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      onPointerEnter={onWarm}
      onFocus={onWarm}
      onPointerDown={onWarm}
      aria-label={label}
      aria-pressed={selected}
      title={label}
      className={`relative flex h-[clamp(26px,2.9cqw,34px)] w-[clamp(26px,2.9cqw,34px)] cursor-pointer items-center justify-center rounded-full border shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)] transition-colors focus-visible:ring-2 focus-visible:ring-[#b0566b] ${
        selected
          ? "border-[#3b3128] ring-2 ring-[#3b3128]/70 ring-offset-2 ring-offset-[#f2ebda]"
          : "border-[#7a6350]/40 hover:ring-1 hover:ring-[#3b3128]/35 hover:ring-offset-2 hover:ring-offset-[#f2ebda]"
      }`}
      style={{ background }}
    >
      {selected ? (
        <svg viewBox="0 0 24 24" aria-hidden className="h-[1.5cqw] w-[1.5cqw] text-[#2e2620]">
          <path
            d="M5 12.5 10 17.5 19 7"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </button>
  );
}

function Controls({
  bouquet,
  dispatch,
  compact = false,
}: {
  bouquet: BouquetState;
  dispatch: Dispatch<BouquetAction>;
  compact?: boolean;
}) {
  const wrap = WRAPS.find((entry) => entry.id === bouquet.wrap);
  const ribbon = RIBBONS.find((entry) => entry.id === bouquet.ribbon);
  return (
    <div className={compact ? "w-full" : "mt-auto w-full"}>
      <div className="flex flex-wrap items-end justify-between gap-x-[4%] gap-y-[6px]">
        <div>
          <p className="wd-t-2xs font-[family-name:var(--font-type)] tracking-[0.12em] text-[#8a745c]">
            Wrap
          </p>
          <div className="mt-[0.6cqw] flex gap-[10px]">
            {WRAPS.map((entry) => (
              <Swatch
                key={entry.id}
                label={`${entry.name} wrapping paper`}
                background={entry.paper}
                selected={bouquet.wrap === entry.id}
                onSelect={() => dispatch({ type: "wrap", id: entry.id as WrapId })}
                onWarm={() => {
                  warmImage(wrapSrc(entry.id as WrapId));
                  warmImage(wrapFrontSrc(entry.id as WrapId));
                }}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="wd-t-2xs font-[family-name:var(--font-type)] tracking-[0.12em] text-[#8a745c]">
            Ribbon
          </p>
          <div className="mt-[0.6cqw] flex gap-[10px]">
            {RIBBONS.map((entry) => (
              <Swatch
                key={entry.id}
                label={`${entry.name} ribbon`}
                background={RIBBON_SWATCH[entry.id]}
                selected={bouquet.ribbon === entry.id}
                onSelect={() => dispatch({ type: "ribbon", id: entry.id as RibbonId })}
                onWarm={() => warmImage(ribbonSrc(entry.id as RibbonId))}
              />
            ))}
          </div>
        </div>
      </div>

      <p
        className="mt-[0.8cqw] wd-t-2xs font-[family-name:var(--font-book)] italic text-[#7b6350]"
        aria-live="polite"
      >
        {wrap
          ? `wrapped in ${wrap.name.toLowerCase()}, tied with the ${ribbon?.name.toLowerCase()} ribbon.`
          : null}
      </p>

      <div className="mt-[1cqw] flex items-center justify-between gap-3">
        <p className="wd-t-2xs font-[family-name:var(--font-type)] text-[#8a745c]">
          {bouquet.items.length} / {MAX_BOUQUET} stems
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => dispatch({ type: "shuffle" })}
            disabled={bouquet.items.length < 3}
            title={
              bouquet.items.length < 3
                ? "Add a third stem before rearranging."
                : "Rearrange the stems around the centre flower."
            }
            className="min-h-[32px] cursor-pointer border border-[#8a6a4c]/45 bg-[#f7f0df]/80 px-[clamp(12px,1.4cqw,22px)] py-[0.45cqw] wd-t-2xs font-[family-name:var(--font-type)] text-[#4c3a2b] transition-colors hover:bg-[#efe4cd] focus-visible:ring-2 focus-visible:ring-[#b0566b] disabled:cursor-not-allowed disabled:opacity-45"
          >
            Rearrange
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: "clear" })}
            disabled={bouquet.items.length === 0 && bouquet.fillers.length === 0}
            className="min-h-[32px] cursor-pointer border border-[#a8423f]/50 bg-[#f7ece4]/85 px-[clamp(12px,1.4cqw,22px)] py-[0.45cqw] wd-t-2xs font-[family-name:var(--font-type)] text-[#8a3b3b] transition-colors hover:bg-[#f0d9cd] focus-visible:ring-2 focus-visible:ring-[#b0566b] disabled:cursor-not-allowed disabled:opacity-45"
          >
            Clear bouquet
          </button>
        </div>
      </div>
    </div>
  );
}

function FloristShelfPageImpl({
  bouquet,
  dispatch,
  flower,
  onRemoved,
}: {
  bouquet: BouquetState;
  dispatch: Dispatch<BouquetAction>;
  flower: Flower;
  onRemoved: () => void;
}) {
  const { add } = useBouquetActions(bouquet, dispatch, onRemoved);
  const flowersFull = bouquet.items.length >= MAX_BOUQUET;
  const fillersFull = bouquet.fillers.length >= MAX_FILLERS;

  return (
    <PaperSurface>
      <div
        className="relative flex h-full flex-col px-[8%] pb-[7%] pt-[7%]"
        style={{ containerType: "inline-size" }}
      >
        <div className="flex items-baseline justify-between">
          <h2 className="font-[family-name:var(--font-book)] wd-t-h italic text-[#3b3128]">
            The florist&apos;s page
          </h2>
          <p className="font-[family-name:var(--font-type)] wd-t-2xs tracking-[0.14em] text-[#8a745c]">
            page 04
          </p>
        </div>
        <p className="mt-[1.4%] max-w-[92%] font-[family-name:var(--font-book)] wd-t-sm leading-snug text-[#5b4636]">
          Pick up to nine stems. Your {flower.name.toLowerCase()} is already in the middle; tap a
          flower in the bouquet to move or turn it.
        </p>

        <div className="mt-[3.6%]">
          <BouquetShelf onAdd={add} full={flowersFull} />
        </div>
        <FillerShelf
          onAdd={add}
          full={fillersFull}
          count={bouquet.fillers.length}
          max={MAX_FILLERS}
        />

        <div className="mt-auto flex items-end justify-between pt-[3%]">
          <p className="font-[family-name:var(--font-type)] wd-t-2xs leading-relaxed text-[#8a745c]">
            {shelfCapacityLabel(bouquet.items.length)}
          </p>
          <Sticker name="gold-star" inline className="w-[5%] -rotate-6 opacity-80" />
        </div>

        <Washi tone="beige" className="right-[4%] top-[3%] h-[3.4cqw] w-[16%] rotate-[6deg]" />
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 z-40 w-[7%] bg-gradient-to-l from-[#4d3a2b]/18 to-transparent" />
    </PaperSurface>
  );
}

function FloristBouquetPageImpl({
  bouquet,
  dispatch,
  flower,
  reduced,
  arrived = true,
  variant = "page",
  onRemoved,
  selectedKey = null,
  onSelect,
}: {
  bouquet: BouquetState;
  dispatch: Dispatch<BouquetAction>;
  flower: Flower;
  reduced: boolean;
  arrived?: boolean;
  variant?: "page" | "leaf";
  onRemoved: () => void;
  selectedKey?: string | null;
  onSelect?: (key: string | null) => void;
}) {
  const { remove, removeFiller, transform } = useBouquetActions(bouquet, dispatch, onRemoved);

  return (
    <PaperSurface>
      <div
        className="relative flex h-full flex-col px-[9%] pb-[6%] pt-[6.5%]"
        style={{ containerType: "inline-size" }}
      >
        <div className="flex items-baseline justify-between">
          <h2 className="font-[family-name:var(--font-book)] wd-t-h italic text-[#3b3128]">
            Your bouquet
          </h2>
          <p className="font-[family-name:var(--font-type)] wd-t-2xs text-[#8a745c]">
            wrapped in {WRAPS.find((wrap) => wrap.id === bouquet.wrap)?.name.toLowerCase()}
          </p>
        </div>

        <div className="relative mt-[1%] flex-1">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-full max-h-full" style={{ aspectRatio: "4 / 5" }}>
              <BouquetCanvas
                state={bouquet}
                onRemove={variant === "page" ? remove : undefined}
                onRemoveFiller={variant === "page" ? removeFiller : undefined}
                onTransform={variant === "page" ? transform : undefined}
                selectedKey={variant === "page" ? selectedKey : null}
                onSelect={variant === "page" ? onSelect : undefined}
                reduced={reduced}
                arrived={arrived}
                variant={variant}
              />
            </div>
          </div>
          {bouquet.items.length === 0 && bouquet.fillers.length === 0 && (
            <p className="pointer-events-none absolute left-1/2 top-1/2 z-[100] -translate-x-1/2 -translate-y-1/2 text-center font-[family-name:var(--font-note)] wd-t-sm text-[#34496b]/70">
              the paper is still empty
            </p>
          )}
        </div>

        <Controls bouquet={bouquet} dispatch={dispatch} />
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 z-40 w-[7%] bg-gradient-to-r from-[#4d3a2b]/18 to-transparent" />
    </PaperSurface>
  );
}

function FloristMobilePageImpl({
  bouquet,
  dispatch,
  flower,
  reduced,
  arrived = true,
  variant = "page",
  onRemoved,
  selectedKey = null,
  onSelect,
}: {
  bouquet: BouquetState;
  dispatch: Dispatch<BouquetAction>;
  flower: Flower;
  reduced: boolean;
  arrived?: boolean;
  variant?: "page" | "leaf";
  onRemoved: () => void;
  selectedKey?: string | null;
  onSelect?: (key: string | null) => void;
}) {
  const { add, remove, removeFiller, transform } = useBouquetActions(bouquet, dispatch, onRemoved);
  const flowersFull = bouquet.items.length >= MAX_BOUQUET;
  const fillersFull = bouquet.fillers.length >= MAX_FILLERS;

  return (
    <PaperSurface>
      <div
        className="relative flex h-full flex-col px-[6%] pb-[5%] pt-[6%]"
        style={{ containerType: "inline-size" }}
      >
        <div className="flex items-baseline justify-between">
          <h2 className="font-[family-name:var(--font-book)] wd-t-h italic text-[#3b3128]">
            The florist&apos;s page
          </h2>
          <p className="font-[family-name:var(--font-type)] wd-t-sm text-[#8a745c]">
            {bouquet.items.length} / {MAX_BOUQUET}
          </p>
        </div>

        <div className="relative mt-[1%] h-[44%]">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-full" style={{ aspectRatio: "4 / 5" }}>
              <BouquetCanvas
                state={bouquet}
                onRemove={variant === "page" ? remove : undefined}
                onRemoveFiller={variant === "page" ? removeFiller : undefined}
                onTransform={variant === "page" ? transform : undefined}
                selectedKey={variant === "page" ? selectedKey : null}
                onSelect={variant === "page" ? onSelect : undefined}
                reduced={reduced}
                arrived={arrived}
                variant={variant}
              />
            </div>
          </div>
          {bouquet.items.length === 0 && bouquet.fillers.length === 0 && (
            <p className="pointer-events-none absolute left-1/2 top-1/2 z-[100] -translate-x-1/2 -translate-y-1/2 text-center font-[family-name:var(--font-note)] wd-t-sm text-[#34496b]/70">
              the paper is still empty
            </p>
          )}
        </div>

        <Controls bouquet={bouquet} dispatch={dispatch} compact />

        <div className="mt-[2.5%] flex items-center justify-between">
          <p className="font-[family-name:var(--font-type)] wd-t-sm text-[#8a745c]">
            {shelfCapacityLabel(bouquet.items.length)}
          </p>
          <p className="font-[family-name:var(--font-note)] wd-t-sm text-[#34496b]/75">
            tap a flower to move or turn it
          </p>
        </div>
        <div className="mt-[2%]">
          <BouquetShelf onAdd={add} full={flowersFull} compact />
        </div>
        <div className="mt-[1.5%]">
          <FillerShelf
            onAdd={add}
            full={fillersFull}
            count={bouquet.fillers.length}
            max={MAX_FILLERS}
          />
        </div>
      </div>
    </PaperSurface>
  );
}

export const FloristShelfPage = memo(FloristShelfPageImpl);
export const FloristBouquetPage = memo(FloristBouquetPageImpl);
export const FloristMobilePage = memo(FloristMobilePageImpl);
