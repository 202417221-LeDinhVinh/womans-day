"use client";

import { memo } from "react";

import { FILLERS, FLOWERS, headSrc, type FlowerId, type StemId } from "@/lib/womansDay/flowers";
import { MAX_BOUQUET } from "@/lib/womansDay/bouquetSlots";
import { Art, warmImage } from "@/components/womans-day/paper";

/**
 * The florist's shelf: twelve painted species and three greenery fillers, as seed-catalog
 * cards. Clicking a card plucks that stem into the bouquet (the pluck animation is the
 * card's own press response; the stem's arrival spring lives in `BouquetCanvas`).
 */

function FlowerCard({
  id,
  label,
  meaning,
  image,
  onAdd,
  disabled,
  compact = false,
}: {
  id: StemId;
  label: string;
  meaning: string;
  image: string;
  onAdd: (id: StemId) => void;
  disabled: boolean;
  compact?: boolean;
}) {
  // Hover/focus usually lands 100+ ms before the tap — enough to have the 512 px
  // bouquet head decoded before the click (the card itself only shows 256 px).
  const warmHead = () => warmImage(headSrc(id as FlowerId, 512));
  return (
    <button
      type="button"
      onClick={() => onAdd(id)}
      onPointerEnter={warmHead}
      onFocus={warmHead}
      onPointerDown={warmHead}
      disabled={disabled}
      aria-label={`Add ${label} to the bouquet`}
      className={`group relative flex cursor-pointer flex-col items-stretch overflow-hidden rounded-[0.25cqw] border border-[#9a8265]/35 bg-[#f7f0df]/80 text-left shadow-[0_0.15cqw_0.3cqw_rgba(70,50,32,0.08)] ring-inset transition-colors hover:border-[#b0566b]/70 hover:bg-[#f2e6cf] hover:ring-1 hover:ring-[#b0566b]/45 focus-visible:ring-2 focus-visible:ring-[#b0566b] disabled:cursor-not-allowed disabled:opacity-55 ${
        compact ? "min-w-[26cqw] flex-1" : ""
      }`}
    >
      <span className="relative block aspect-square w-full overflow-hidden bg-[radial-gradient(70%_70%_at_50%_40%,rgba(255,255,255,0.7),transparent_75%)]">
        <Art src={image} alt="" className="absolute inset-[8%] h-[84%] w-[84%] object-contain" />
      </span>
      <span className="block px-[5%] pb-[6%] text-center">
        <span className="block truncate wd-t-2xs font-[family-name:var(--font-book)] leading-tight text-[#3b3128]">
          {label}
        </span>
        <span className="mt-[0.15cqw] block truncate wd-t-2xs font-[family-name:var(--font-type)] tracking-[0.04em] text-[#8a745c]">
          {meaning}
        </span>
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute right-[4%] top-[4%] flex h-[1.8cqw] w-[1.8cqw] items-center justify-center rounded-full border border-[#8a6a4c]/40 bg-[#f4ecd8]/95 text-[1.1cqw] leading-none text-[#6b5541]"
      >
        +
      </span>
    </button>
  );
}

function BouquetShelfImpl({
  onAdd,
  full,
  compact = false,
}: {
  onAdd: (id: StemId) => void;
  full: boolean;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="flex gap-[2.4cqw] overflow-x-auto pb-[1.6cqw] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FLOWERS.map((flower) => (
          <FlowerCard
            key={flower.id}
            id={flower.id}
            label={flower.name}
            meaning={flower.meaning.split(" ")[0]}
            image={headSrc(flower.id, 256)}
            onAdd={onAdd}
            disabled={full}
            compact
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-[1.6%]">
      {FLOWERS.map((flower) => (
        <FlowerCard
          key={flower.id}
          id={flower.id}
          label={flower.name}
          meaning={flower.meaning.split(" ")[0]}
          image={headSrc(flower.id, 256)}
          onAdd={onAdd}
          disabled={full}
        />
      ))}
    </div>
  );
}

/**
 * The three greenery sprigs, kept separate from the flowers: clicking one adds it to the
 * greenery list (drawn behind the blooms) rather than taking one of the nine flower
 * slots. The count/label makes the state visible — previously a filler click looked like
 * nothing happened because it landed in a slot a flower already occupied.
 */
function FillerShelfImpl({
  onAdd,
  full,
  count = 0,
  max,
}: {
  onAdd: (id: StemId) => void;
  full: boolean;
  count?: number;
  max: number;
}) {
  return (
    <div className="mt-[2%]">
      <div className="flex items-baseline justify-between">
        <p className="wd-t-2xs font-[family-name:var(--font-type)] tracking-[0.12em] text-[#8a745c]">
          Greenery
        </p>
        <p
          className="wd-t-2xs font-[family-name:var(--font-type)] text-[#8a745c]"
          aria-live="polite"
        >
          {full ? "greenery is full" : `${count} / ${max}`}
        </p>
      </div>
      <div className="mt-[0.6cqw] grid grid-cols-3 gap-[1.6%]">
        {FILLERS.map((filler) => (
          <button
            key={filler.id}
            type="button"
            onClick={() => onAdd(filler.id)}
            disabled={full}
            aria-label={`Add ${filler.name} to the bouquet`}
            className="flex cursor-pointer items-center justify-center gap-[0.6cqw] rounded-[0.2cqw] border border-dashed border-[#9a8265]/40 bg-[#f7f0df]/50 px-[0.6cqw] py-[0.5cqw] text-center transition-colors hover:border-[#b0566b]/70 hover:bg-[#f2e6cf] focus-visible:ring-2 focus-visible:ring-[#b0566b] disabled:cursor-not-allowed disabled:opacity-55"
          >
            <Art
              src={`/womans-day/flowers/stems/${filler.id}.webp`}
              className="h-[3.4cqw] w-auto object-contain"
            />
            <span className="truncate wd-t-2xs font-[family-name:var(--font-type)] tracking-[0.03em] text-[#6b5541]">
              {filler.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function shelfCapacityLabel(count: number): string {
  if (count >= MAX_BOUQUET) return "Bouquet full — tap a stem in it to take it out";
  if (count === 0) return "Your bouquet is empty — pick a stem";
  return `${count} of ${MAX_BOUQUET} flowers`;
}

export const BouquetShelf = memo(BouquetShelfImpl);
export const FillerShelf = memo(FillerShelfImpl);
