"use client";

import { motion } from "framer-motion";
import { memo } from "react";

import { WOMANS_DAY_LABEL, WOMANS_DAY_SHORT, type Flower } from "@/lib/womansDay/flowers";
import { MusicWidget } from "@/components/womans-day/MusicWidget";
import { Art, Sticker } from "@/components/womans-day/paper";

/**
 * The closing scene: the book has shut on a pastel collage, a pink envelope opens and
 * the letter rises out of it. Everything here is painted art plus real text; the music
 * card is the only interactive object besides the two closing actions.
 *
 * Composition (vision §5.6): the envelope sits BEHIND and BELOW the letter card, which
 * rises up out of it; the actions panel is a separate opaque card on top of any art, so
 * the envelope can never cover the recipient field or the buttons.
 *
 * Sizing is viewport-relative (not page-container relative) because this scene fills the
 * screen on both a phone and a laptop; the letter card itself caps at a readable width,
 * and the whole column is internally scrollable if a short viewport cannot fit it.
 */

function LetterSceneImpl({
  name,
  flower,
  visible,
  reduced,
  onSave,
}: {
  name: string;
  flower: Flower;
  visible: boolean;
  reduced: boolean;
  onSave: () => void;
}) {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[#f0dfd8]">
      <Art
        src="/womans-day/paper/letter-bg.webp"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_18%,rgba(255,250,244,0.55),transparent_66%)]" />
      <div className="absolute inset-0 bg-[#f0dfd8]/20" />

      <Sticker
        name="moon"
        className="left-[5%] top-[7%] w-[clamp(34px,8vw,88px)] -rotate-12 opacity-70"
      />
      <Sticker
        name="butterfly"
        className="right-[6%] top-[10%] w-[clamp(30px,7vw,78px)] rotate-12 opacity-80"
      />
      <Sticker
        name="cherries"
        className="bottom-[12%] left-[7%] w-[clamp(30px,7vw,78px)] -rotate-6 opacity-80"
      />
      <Sticker
        name="gold-star"
        className="right-[12%] top-[34%] w-[clamp(20px,4vw,46px)] rotate-12 opacity-70"
      />

      <div className="relative z-10 flex h-full w-[min(92vw,880px)] flex-col items-center overflow-y-auto overscroll-contain py-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* Envelope: behind and BELOW the letter card, so the card rises out of it. */}
        <Art
          src="/womans-day/stickers/envelope-open.webp"
          className="pointer-events-none absolute bottom-[16%] left-1/2 w-[min(62vw,470px)] -translate-x-1/2 opacity-90"
        />

        <motion.div
          initial={false}
          animate={visible ? { y: 0, rotate: -0.8, opacity: 1 } : { y: 90, rotate: 3, opacity: 0 }}
          transition={
            reduced
              ? { duration: 0.22 }
              : { type: "spring", stiffness: 120, damping: 17, delay: 0.12 }
          }
          className="relative z-10 mx-auto w-[min(82vw,560px)] -rotate-[0.8deg] bg-[#fbf4e4] px-[clamp(22px,7vw,46px)] py-[clamp(26px,7vw,44px)] shadow-[0_22px_48px_rgba(80,45,40,0.28)]"
        >
          <div className="pointer-events-none absolute inset-[2.8%] border border-dashed border-[#c2a78d]/50" />

          <p className="font-[family-name:var(--font-type)] text-[clamp(8px,1vw,10px)] tracking-[0.24em] text-[#9a7f68]">
            Ronan SAT · {WOMANS_DAY_SHORT}
          </p>
          <h2 className="mt-3 font-[family-name:var(--font-hand)] text-[clamp(32px,6.4vw,46px)] leading-[1.05] text-[#7a3b3f]">
            To {name},
          </h2>
          <p className="mt-4 font-[family-name:var(--font-book)] text-[clamp(14px,1.55vw,17px)] leading-[1.6] text-[#46362b]">
            in the quiet study moments and the exciting breakthroughs: wishing you an unwavering
            spirit, a peaceful mind, and a score as soaring as your ambitions.
          </p>
          <p className="mt-2.5 font-[family-name:var(--font-book)] text-[clamp(14px,1.55vw,17px)] leading-[1.6] text-[#46362b]">
            Happy Vietnamese Women&apos;s Day.
          </p>

          <div className="mt-6 flex items-end justify-between gap-4">
            <div>
              <p className="font-[family-name:var(--font-book)] text-[clamp(12px,1.4vw,15px)] italic text-[#7b6350]">
                — with the {flower.name.toLowerCase()},{" "}
                <span style={{ color: flower.hue }}>{flower.meaning}</span>
              </p>
              <p className="mt-1 font-[family-name:var(--font-type)] text-[clamp(8px,0.9vw,9.5px)] tracking-[0.10em] text-[#9a7f68]">
                {WOMANS_DAY_LABEL}
              </p>
            </div>
            <Sticker name="wax-seal" inline className="w-[clamp(44px,7vw,60px)] rotate-[10deg]" />
          </div>
        </motion.div>

        {/* Actions: the music card, stacked ABOVE any art so the envelope can never
            cover it. */}
        <div className="relative z-20 mt-5 w-full">
          <MusicWidget visible={visible} />
        </div>

        <p className="mt-4 shrink-0 text-center font-[family-name:var(--font-type)] text-[clamp(8px,0.95vw,10px)] tracking-[0.12em] text-[#8a745c]/80">
          Ronan SAT Workbook · Special Edition · 2026
        </p>
      </div>
    </div>
  );
}

export const LetterScene = memo(LetterSceneImpl);
