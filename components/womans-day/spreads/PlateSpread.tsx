"use client";

import { motion } from "framer-motion";
import { memo } from "react";

import type { Flower } from "@/lib/womansDay/flowers";
import { headSrc } from "@/lib/womansDay/flowers";
import {
  Art,
  DoodleArrow,
  Highlighter,
  PaperSurface,
  Sticker,
  Washi,
} from "@/components/womans-day/paper";

/**
 * Spread one: a real herbarium plate on the left, the reading on the right. The specimen
 * drops in, tape sticks, and the copy is uncovered left to right once the cover turn
 * finishes. Everything is sized in `cqw` so the same component works on a phone page.
 *
 * ARRIVAL RULE (2026-10-21/22, docs/DESIGN.md): a spread renders its FINAL state and may
 * only animate IN on the reader's first arrival. It must NEVER animate to a hidden pose
 * when `active` goes false, because `active` flips false mid-turn (the leaf lifts) and on
 * every leaf copy — that made the plate blank while the reader was still looking at it and
 * then fade back in on landing ("content disappears while scrolling"). So every animated
 * element takes `initial = reveal ? <hidden> : false` and `animate = <final>` ALWAYS; there
 * is no `: { opacity: 0 }` branch anywhere in this file. A leaf copy (`variant="leaf"`) and
 * reduced motion render `reveal="final"`: plain, pixel-identical to the resting page.
 */

export type PlateReveal = "intro" | "final";

/**
 * Resolve the motion pose for an element: `intro` (first arrival) plays from its hidden
 * pose; `final` (leaf copy, reduced motion, or any later visit) starts at the final state
 * and never animates out.
 */
function pose(
  reveal: PlateReveal,
  initial: Record<string, number | string>,
  animate: Record<string, number | string>
): { initial: Record<string, number | string> | false; animate: Record<string, number | string> } {
  return { initial: reveal === "intro" ? initial : false, animate };
}

function PlateHeader() {
  return (
    <div>
      <div className="flex items-baseline justify-between font-[family-name:var(--font-type)] wd-t-2xs tracking-[0.16em] text-[#7b6350]">
        <span>Chapter 20/10</span>
        <span>Plate №07</span>
      </div>
      <div className="mt-[1.6%] border-t border-[#5b4636]/50 pt-[0.5%]">
        <div className="border-t border-[#5b4636]/25" />
      </div>
      <p className="mt-[2%] font-[family-name:var(--font-book)] wd-t-sm italic text-[#5a4637]">
        Herbarium of a scholar
      </p>
    </div>
  );
}

function Specimen({ flower, reveal }: { flower: Flower; reveal: PlateReveal }) {
  const specimenPose = pose(
    reveal,
    { y: -46, opacity: 0, rotate: -7, scale: 0.94 },
    { y: 0, opacity: 1, rotate: -2, scale: 1 }
  );
  const tapeLeft = pose(reveal, { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1 });
  const tapeRight = pose(reveal, { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1 });
  const petal = pose(reveal, { opacity: 0 }, { opacity: 0.9 });
  const stamen = pose(reveal, { opacity: 0 }, { opacity: 0.9 });

  return (
    <div className="relative mx-auto mt-[2%] h-[52%] w-[86%]">
      <div className="absolute inset-0 rounded-[0.2cqw] border border-[#a08a6d]/25 bg-[radial-gradient(70%_60%_at_50%_45%,rgba(255,255,255,0.5),transparent_75%)]" />
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        className="absolute inset-0 h-full w-full text-[#9c8467]/25"
        preserveAspectRatio="none"
      >
        {[18, 36, 54, 72, 90].map((y) => (
          <line
            key={`h${y}`}
            x1="6"
            y1={y}
            x2="94"
            y2={y}
            stroke="currentColor"
            strokeWidth="0.18"
          />
        ))}
        {[18, 36, 54, 72, 90].map((x) => (
          <line
            key={`v${x}`}
            x1={x}
            y1="6"
            x2={x}
            y2="94"
            stroke="currentColor"
            strokeWidth="0.18"
          />
        ))}
      </svg>

      <motion.div
        initial={specimenPose.initial}
        animate={specimenPose.animate}
        transition={{
          type: "spring",
          stiffness: 210,
          damping: 16,
          delay: reveal === "intro" ? 0.18 : 0,
        }}
        className="absolute inset-[4%] flex items-center justify-center"
      >
        <Art
          src={headSrc(flower.id, 512)}
          alt={`Painted ${flower.name.toLowerCase()}`}
          className="max-h-full max-w-full object-contain drop-shadow-[0.5cqw_0.8cqw_0.7cqw_rgba(87,62,44,0.28)]"
        />
      </motion.div>

      <motion.span
        initial={tapeLeft.initial}
        animate={tapeLeft.animate}
        transition={{ delay: 0.5, duration: 0.35, ease: "easeOut" }}
        className="absolute left-[4%] top-[2%] h-[7%] w-[34%] origin-left -rotate-6"
      >
        <Washi tone="beige" className="inset-0 h-full w-full" />
      </motion.span>
      <motion.span
        initial={tapeRight.initial}
        animate={tapeRight.animate}
        transition={{ delay: 0.62, duration: 0.35, ease: "easeOut" }}
        className="absolute bottom-[3%] right-[2%] h-[7%] w-[30%] origin-right rotate-3"
      >
        <Washi tone="sage" className="inset-0 h-full w-full" />
      </motion.span>

      <div className="pointer-events-none absolute inset-0 text-[#2f4f7a]">
        <motion.div
          initial={petal.initial}
          animate={petal.animate}
          transition={{ delay: 0.85 }}
          className="absolute right-[4%] top-[26%] flex items-center gap-[0.5cqw]"
        >
          <DoodleArrow className="h-[5cqw] w-[4cqw] -rotate-[70deg]" />
          <span className="font-[family-name:var(--font-note)] wd-t-sm">petal</span>
        </motion.div>
        <motion.div
          initial={stamen.initial}
          animate={stamen.animate}
          transition={{ delay: 0.98 }}
          className="absolute bottom-[18%] left-[6%] flex items-center gap-[0.4cqw]"
        >
          <span className="font-[family-name:var(--font-note)] wd-t-sm">stamen</span>
          <DoodleArrow className="h-[4cqw] w-[3.2cqw] rotate-[150deg]" flip />
        </motion.div>
      </div>

      <div className="absolute inset-x-[10%] bottom-[-3%] h-[6%] rounded-[50%] bg-[#6b5541]/12 blur-[0.6cqw]" />
    </div>
  );
}

function PlateFooter({ flower, reveal }: { flower: Flower; reveal: PlateReveal }) {
  const note = pose(reveal, { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)" });
  return (
    <div className="mt-[3%] text-center">
      <p className="font-[family-name:var(--font-book)] wd-t-lead italic leading-tight text-[#3f3127]">
        {flower.latin}
      </p>
      <motion.p
        initial={note.initial}
        animate={note.animate}
        transition={{ delay: 0.7, duration: 0.5 }}
        className="mt-[1%] font-[family-name:var(--font-type)] wd-t-2xs tracking-[0.09em] text-[#7b6350]"
      >
        {flower.note}
      </motion.p>
      <p className="mt-[1.6%] font-[family-name:var(--font-note)] wd-t-sm text-[#2f4f7a]/80">
        collected for {`"${flower.meaning}"`}
      </p>
    </div>
  );
}

function PlatePageImpl({
  flower,
  reveal,
  readerName,
  tracking,
}: {
  flower: Flower;
  reveal: PlateReveal;
  readerName: string;
  tracking: string;
}) {
  const header = pose(
    reveal,
    { opacity: 0, clipPath: "inset(0 100% 0 0)" },
    { opacity: 1, clipPath: "inset(0 0% 0 0)" }
  );
  return (
    <PaperSurface>
      <div
        className="relative flex h-full flex-col px-[9%] pb-[7%] pt-[7%]"
        style={{ containerType: "inline-size" }}
      >
        <motion.div
          initial={header.initial}
          animate={header.animate}
          transition={{ duration: 0.5 }}
        >
          <PlateHeader />
        </motion.div>

        <Specimen flower={flower} reveal={reveal} />
        <PlateFooter flower={flower} reveal={reveal} />

        <div className="mt-auto flex items-end justify-between pt-[3%] font-[family-name:var(--font-type)] wd-t-2xs leading-relaxed text-[#8a745c]">
          <p className="max-w-[62%]">
            <sup>1</sup> Chosen from the letters of {readerName}&apos;s name · #{tracking}
          </p>
          <Sticker name="gold-star" inline className="w-[5%] opacity-80" />
        </div>
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 w-[7%] bg-gradient-to-l from-[#4d3a2b]/18 to-transparent" />
    </PaperSurface>
  );
}

function ReadingPageImpl({
  flower,
  reveal,
  readerName,
}: {
  flower: Flower;
  reveal: PlateReveal;
  readerName: string;
}) {
  const title = pose(
    reveal,
    { clipPath: "inset(0 100% 0 0)", opacity: 0 },
    { clipPath: "inset(0 0% 0 0)", opacity: 1 }
  );
  const paragraph = pose(reveal, { opacity: 0, y: 14 }, { opacity: 1, y: 0 });
  const footnote = pose(reveal, { opacity: 0 }, { opacity: 1 });
  return (
    <PaperSurface>
      <div
        className="relative flex h-full flex-col px-[10%] pb-[8%] pt-[8%]"
        style={{ containerType: "inline-size" }}
      >
        <div className="flex items-center gap-[2%]">
          <p className="font-[family-name:var(--font-type)] wd-t-2xs tracking-[0.18em] text-[#7b6350]">
            The reading
          </p>
          <span className="h-px flex-1 bg-[#8a735a]/35" />
          <Sticker name="pressed-leaf" inline className="w-[7%] rotate-12" />
        </div>

        <motion.div
          initial={title.initial}
          animate={title.animate}
          transition={{ duration: 0.55, delay: reveal === "intro" ? 0.42 : 0 }}
        >
          <h2 className="mt-[5%] font-[family-name:var(--font-book)] wd-t-h font-medium leading-[1.02] tracking-[-0.01em] text-[#2f2620]">
            Your flower is the{" "}
            <span className="italic" style={{ color: flower.hue }}>
              {flower.name}.
            </span>
          </h2>
          <p className="mt-[2.5%] font-[family-name:var(--font-book)] wd-t-lead italic leading-snug text-[#5b4636]">
            <Highlighter color="#f2d98b">
              {flower.meaning.charAt(0).toUpperCase() + flower.meaning.slice(1)}.
            </Highlighter>
          </p>
        </motion.div>

        <motion.p
          initial={paragraph.initial}
          animate={paragraph.animate}
          transition={{ duration: 0.6, delay: reveal === "intro" ? 0.66 : 0 }}
          className="mt-[4.5%] max-w-[94%] font-[family-name:var(--font-book)] wd-t-body leading-[1.62] text-[#3b3128]"
        >
          {flower.reading}
        </motion.p>

        <motion.div
          initial={footnote.initial}
          animate={footnote.animate}
          transition={{ delay: reveal === "intro" ? 0.95 : 0 }}
          className="mt-auto border-t border-[#8a735a]/30 pt-[2.5%]"
        >
          <p className="font-[family-name:var(--font-type)] wd-t-2xs leading-relaxed tracking-[0.02em] text-[#7b6350]">
            <sup>1</sup> How this flower was chosen. The hash of the name on the cover —{" "}
            {readerName} — picks one species from the twelve in this workbook. It is stable: the
            same name always opens on the same plate, so this page is yours and no one else&apos;s.
          </p>
        </motion.div>

        <p className="mt-[3%] text-right font-[family-name:var(--font-note)] wd-t-sm text-[#2f4f7a]/70">
          — turn the page for the scrapbook
        </p>
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-[7%] bg-gradient-to-r from-[#4d3a2b]/18 to-transparent" />
    </PaperSurface>
  );
}

/** Mobile: both halves on one portrait page, specimen first. */
function PlateMobilePageImpl({
  flower,
  reveal,
  readerName,
  tracking,
}: {
  flower: Flower;
  reveal: PlateReveal;
  readerName: string;
  tracking: string;
}) {
  const specimen = pose(
    reveal,
    { y: -34, opacity: 0, rotate: -6 },
    { y: 0, opacity: 1, rotate: -2 }
  );
  return (
    <PaperSurface>
      <div
        className="relative flex h-full flex-col px-[9%] pb-[7%] pt-[7%]"
        style={{ containerType: "inline-size" }}
      >
        <PlateHeader />
        <div className="relative mx-auto mt-[1%] h-[38%] w-[72%]">
          <motion.div
            initial={specimen.initial}
            animate={specimen.animate}
            transition={{
              type: "spring",
              stiffness: 200,
              damping: 16,
              delay: reveal === "intro" ? 0.1 : 0,
            }}
            className="absolute inset-[3%] flex items-center justify-center"
          >
            <Art
              src={headSrc(flower.id, 512)}
              alt={`Painted ${flower.name.toLowerCase()}`}
              className="max-h-full max-w-full object-contain drop-shadow-[2px_4px_6px_rgba(87,62,44,0.3)]"
            />
          </motion.div>
          <Washi tone="beige" className="left-[2%] top-[0%] h-[9%] w-[36%] -rotate-6" />
          <Washi tone="sage" className="bottom-[2%] right-[0%] h-[9%] w-[32%] rotate-3" />
        </div>
        <div className="mt-[1%] text-center">
          <p className="font-[family-name:var(--font-book)] wd-t-h italic text-[#3f3127]">
            {flower.latin}
          </p>
          <p className="mt-[0.6%] font-[family-name:var(--font-type)] wd-t-sm tracking-[0.06em] text-[#7b6350]">
            {flower.note}
          </p>
        </div>

        <div className="mt-[4%]">
          <h2 className="font-[family-name:var(--font-book)] wd-t-h leading-[1.02] text-[#2f2620]">
            Your flower is the{" "}
            <span className="italic" style={{ color: flower.hue }}>
              {flower.name}.
            </span>
          </h2>
          <p className="mt-[1.6%] font-[family-name:var(--font-book)] text-[4.6cqw] italic text-[#5b4636]">
            <Highlighter color="#f2d98b">
              {flower.meaning.charAt(0).toUpperCase() + flower.meaning.slice(1)}.
            </Highlighter>
          </p>
          <p className="mt-[2.6%] font-[family-name:var(--font-book)] text-[3.7cqw] leading-[1.5] text-[#3b3128]">
            {flower.reading}
          </p>
        </div>

        <p className="mt-auto pt-[3%] font-[family-name:var(--font-type)] text-[2.15cqw] leading-relaxed text-[#7b6350]">
          <sup>1</sup> Chosen from the letters of {readerName}&apos;s name · #{tracking}
        </p>
      </div>
    </PaperSurface>
  );
}

export const PlatePage = memo(PlatePageImpl);
export const ReadingPage = memo(ReadingPageImpl);
export const PlateMobilePage = memo(PlateMobilePageImpl);
