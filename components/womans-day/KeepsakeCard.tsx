"use client";

import { memo } from "react";

import { WOMANS_DAY_LABEL } from "@/lib/womansDay/flowers";
import type { BouquetState } from "@/lib/womansDay/bouquetState";
import type { Flower } from "@/lib/womansDay/flowers";
import { BouquetCanvas } from "@/components/womans-day/BouquetCanvas";
import { Art } from "@/components/womans-day/paper";

/**
 * The story-sized keepsake (1080 × 1920) captured by `ShareImageDialog`.
 *
 * It is always in the DOM — the share dialog captures an existing element by id — but
 * parked off-screen so it never costs layout attention. Sizes are in raw px because the
 * export must not depend on the viewport the sender happens to be using.
 */

export const KEEPSAKE_ID = "womans-day-keepsake";

function KeepsakeCardImpl({
  name,
  flower,
  bouquet,
  tracking,
}: {
  name: string;
  flower: Flower;
  bouquet: BouquetState;
  tracking: string;
}) {
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        left: -20000,
        top: 0,
        width: 1080,
        height: 1920,
        pointerEvents: "none",
        zIndex: -1,
      }}
    >
      <div
        id={KEEPSAKE_ID}
        className="relative overflow-hidden bg-[#ece4d2] text-[#2f2620]"
        style={{
          width: 1080,
          height: 1920,
          backgroundImage: "url('/womans-day/paper/cream.webp')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          containerType: "inline-size",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 40,
            border: "1px solid rgba(138, 106, 76, 0.35)",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 56,
            border: "1px dashed rgba(138, 106, 76, 0.22)",
          }}
        />

        <div className="relative flex h-full flex-col items-center px-[9%] pb-[7%] pt-[8%]">
          <p className="font-[family-name:var(--font-type)] text-[22px] tracking-[0.34em] text-[#7b6350]">
            Ronan SAT
          </p>
          <p className="mt-[14px] font-[family-name:var(--font-book)] text-[30px] italic text-[#8a745c]">
            a workbook for the women who keep showing up
          </p>

          <div className="mt-[7%] flex justify-center gap-[2.4%]">
            <Sticker name="gold-star" className="w-[74px] rotate-[-10deg]" />
            <Sticker name="pressed-leaf" className="w-[86px] rotate-[14deg]" />
            <Sticker name="gold-star" className="w-[74px] rotate-[8deg]" />
          </div>

          <h1 className="mt-[5%] text-center font-[family-name:var(--font-book)] text-[92px] leading-[0.98] tracking-[-0.02em]">
            Your flower is the{" "}
            <span className="italic" style={{ color: flower.hue }}>
              {flower.name}.
            </span>
          </h1>

          <p className="mt-[18px] font-[family-name:var(--font-book)] text-[40px] italic text-[#5b4636]">
            {flower.meaning.charAt(0).toUpperCase() + flower.meaning.slice(1)}.
          </p>

          <div className="mt-[4%] flex w-[74%] items-center justify-center">
            <BouquetCanvas state={bouquet} staticView reduced />
          </div>

          <div className="mt-auto flex w-full flex-col items-center">
            <p className="font-[family-name:var(--font-hand)] text-[76px] leading-none text-[#3a2d23]">
              {name}
            </p>
            <div className="mt-[26px] h-px w-[62%] bg-[#8a735a]/35" />
            <p className="mt-[20px] font-[family-name:var(--font-type)] text-[22px] tracking-[0.18em] text-[#7b6350]">
              {WOMANS_DAY_LABEL}
            </p>
            <p className="mt-[10px] font-[family-name:var(--font-type)] text-[18px] tracking-[0.12em] text-[#8a745c]">
              #{tracking} · Ronan SAT Workbook · Special Edition
            </p>
          </div>
        </div>

        <Art
          src="/womans-day/stickers/wax-seal.webp"
          className="absolute bottom-[9%] right-[8%] w-[96px] rotate-[9deg]"
        />
      </div>
    </div>
  );
}

function Sticker({ name, className }: { name: string; className?: string }) {
  return <Art src={`/womans-day/stickers/${name}.webp`} className={className} />;
}

export const KeepsakeCard = memo(KeepsakeCardImpl);
