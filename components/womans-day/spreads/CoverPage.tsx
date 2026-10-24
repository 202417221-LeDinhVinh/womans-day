"use client";

import { motion } from "framer-motion";
import { memo } from "react";

import { MAX_NAME_LENGTH } from "@/lib/womansDay/flowerHash";
import { WOMANS_DAY_LABEL } from "@/lib/womansDay/flowers";
import { Art, Sticker } from "@/components/womans-day/paper";

/**
 * The closed textbook cover: cloth, a ransom-note title made of paper scraps, a collage
 * of painted stickers, and a real name label. The label feeds `flowerHash`, so it is an
 * input rather than decorative text.
 */

const TITLE_ROWS = [
  ["W", "O", "M", "E", "N", "'", "S"],
  ["D", "A", "Y"],
];

const SCRAPS = ["#f4ecd8", "#eac3c9", "#cfd6bd", "#dcbf97", "#f7f2e5", "#e6d3b8"];

function CoverPageImpl({
  name,
  onNameChange,
  disabled = false,
}: {
  name: string;
  onNameChange: (next: string) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ containerType: "inline-size" }}
    >
      <Art
        src="/womans-day/paper/cover-cloth.webp"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-[#f3e7d4]/35" />
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_20%_0%,rgba(255,255,255,0.45),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-[3.2%] rounded-[0.6cqw] border border-[#8d6a4f]/35" />
      <div className="pointer-events-none absolute inset-[3.9%] rounded-[0.4cqw] border border-dashed border-[#8d6a4f]/25" />

      <Sticker name="torn-news" className="left-[-7%] top-[5%] w-[42%] -rotate-6 opacity-95" />
      <Sticker name="cherries" className="right-[-5%] top-[3%] w-[23%] rotate-6" />
      <Sticker name="camera" className="bottom-[29%] right-[1%] w-[21%] -rotate-6" />
      <Sticker name="moon" className="bottom-[33%] left-[5%] w-[16%] -rotate-12" />
      <Sticker name="gold-star" className="right-[20%] top-[31%] w-[8%] rotate-12" />
      <Sticker name="washi-pink" className="left-[-4%] top-[43%] w-[27%] -rotate-[19deg]" />
      <Sticker name="pressed-leaf" className="bottom-[12%] left-[6%] w-[11%] -rotate-[24deg]" />

      <div className="relative z-10 flex h-full flex-col items-center px-[10%] pb-[9%] pt-[10%]">
        <p className="font-[family-name:var(--font-type)] wd-t-2xs tracking-[0.34em] text-[#6c5744]">
          Ronan SAT
        </p>
        <p className="mt-[0.8cqw] font-[family-name:var(--font-book)] wd-t-sm italic tracking-[0.04em] text-[#7a6350]">
          a workbook for the women who keep showing up
        </p>

        <div className="mt-[6%] flex w-full flex-col items-center gap-[0.7cqw]">
          {TITLE_ROWS.map((row, rowIndex) => (
            <div key={rowIndex} className="flex items-center justify-center gap-[0.5cqw]">
              {row.map((letter, index) => {
                const tilt = [-4, 3, -2, 5, -5, 2, -3, 4, -6, 2][index + rowIndex * 5];
                return (
                  <motion.span
                    key={`${rowIndex}-${index}`}
                    initial={{ opacity: 0, y: 10, rotate: 0 }}
                    animate={{ opacity: 1, y: 0, rotate: tilt }}
                    transition={{
                      delay: 0.08 + (rowIndex * row.length + index) * 0.035,
                      type: "spring",
                      stiffness: 260,
                      damping: 20,
                    }}
                    className="inline-block select-none border border-black/10 px-[0.75cqw] py-[0.15cqw] font-[family-name:var(--font-book)] text-[9.6cqw] font-bold leading-[0.98] text-[#2e2620] shadow-[0.18cqw_0.22cqw_0px_rgba(47,38,29,0.16)]"
                    style={{
                      background: SCRAPS[(index + rowIndex * 3) % SCRAPS.length],
                      fontFamily: "var(--font-book)",
                    }}
                  >
                    {letter}
                  </motion.span>
                );
              })}
            </div>
          ))}
        </div>

        <p className="mt-[4%] text-center font-[family-name:var(--font-type)] wd-t-2xs tracking-[0.12em] text-[#5f4b3a]">
          Ronan SAT Workbook · Special Edition
        </p>
        <p className="mt-[0.4cqw] font-[family-name:var(--font-type)] wd-t-2xs tracking-[0.12em] text-[#5f4b3a]">
          {WOMANS_DAY_LABEL}
        </p>

        <div className="mt-auto w-full">
          <div
            data-wd-interactive
            className="relative mx-auto w-[86%] -rotate-[1.1deg] border border-[#8a6a4c]/40 bg-[#f6efe0]/95 px-[7%] py-[4.5%] shadow-[0.4cqw_0.6cqw_0px_rgba(56,42,30,0.14)]"
          >
            <div className="pointer-events-none absolute inset-[3%] border border-dashed border-[#a08464]/45" />
            <p className="text-center font-[family-name:var(--font-book)] wd-t-sm italic text-[#7b6350]">
              This book belongs to
            </p>
            <div className="relative mt-[2%] flex items-end gap-[2%] border-b border-[#8a6a4c]/40 pb-[0.6cqw]">
              <input
                value={name}
                onChange={(event) => onNameChange(event.target.value)}
                maxLength={MAX_NAME_LENGTH}
                placeholder="Your name"
                aria-label="Your name on the cover"
                autoComplete="name"
                spellCheck={false}
                disabled={disabled}
                className="w-full bg-transparent text-center font-[family-name:var(--font-hand)] text-[6.4cqw] leading-[1.15] text-[#3a2d23] caret-[#b0566b] outline-none placeholder:text-[#b3a28d]"
              />
            </div>
            <div className="mt-[2%] flex items-center justify-between font-[family-name:var(--font-type)] wd-t-2xs text-[#7b6350]">
              <span>Class · 2026</span>
              <span>Plate №07</span>
            </div>
            <Sticker
              name="wax-seal"
              className="right-[-5%] top-[-28%] w-[15%] rotate-[8deg] drop-shadow-[0.1cqw_0.2cqw_0.2cqw_rgba(80,20,25,0.3)]"
            />
          </div>

          <p className="mt-[3.5%] text-center font-[family-name:var(--font-type)] wd-t-2xs tracking-[0.18em] text-[#6c5744]/85">
            scroll to open
          </p>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-y-0 right-0 w-[2%] bg-gradient-to-l from-black/10 to-transparent" />
    </div>
  );
}

export const CoverPage = memo(CoverPageImpl);
