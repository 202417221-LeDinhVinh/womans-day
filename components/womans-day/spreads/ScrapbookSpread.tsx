"use client";

import { motion, type MotionValue } from "framer-motion";
import { memo, type CSSProperties } from "react";

import type { CollageItem } from "@/lib/womansDay/spreads";
import { SCRAPBOOK_LEFT, SCRAPBOOK_RIGHT } from "@/lib/womansDay/spreads";
import { Art, LabelQuote, PaperSurface, Sticker, Washi } from "@/components/womans-day/paper";

/**
 * Spread two: the sketchbook collage. Torn map and newsprint scraps, taped polaroid
 * vignettes, gold stars, a butterfly, label-tape quotes. The layout lives in
 * `lib/womansDay/spreads.ts` so it stays composed at every page size.
 */

function Layer({ item, index }: { item: CollageItem; index: number }) {
  const style: CSSProperties = {
    left: `${item.x}%`,
    top: `${item.y}%`,
    width: `${item.w}%`,
    zIndex: item.z,
    ["--wd-tilt" as string]: `${item.rotate}deg`,
    ["--wd-delay" as string]: `${(index % 6) * -1.1}s`,
  };
  const className = "wd-wobble absolute select-none";

  if (item.kind === "label") {
    return (
      <LabelQuote
        className={className}
        style={{ ...style, minHeight: `${item.h}%` }}
        tone={item.tone}
      >
        {item.text}
      </LabelQuote>
    );
  }

  if (item.kind === "photo") {
    // A real portrait taped into the collage: white polaroid-style frame, the photo,
    // and a handwritten caption. The frame sizes from the image (portrait 3:4), so the
    // card always fits its picture.
    return (
      <figure
        className={`${className} bg-[#faf5e9] p-[3%] pb-[2%] shadow-[0_2px_10px_rgba(74,44,36,0.28)]`}
        style={style}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.src} alt={item.caption} draggable={false} className="block h-auto w-full" />
        <figcaption className="pt-[5%] text-center font-[family-name:var(--font-hand)] text-[3.4cqw] leading-tight text-[#4c3a2b]">
          {item.caption}
        </figcaption>
      </figure>
    );
  }

  if (item.kind === "washi") {
    // Washi is a thin strip: no intrinsic ratio to lean on, so give the wrapper an
    // explicit aspect so it has real height. Rendering `absolute inset-0` inside a
    // zero-height wrapper made every strip (and sticker) invisible.
    return (
      <div className={className} style={{ ...style, aspectRatio: "7 / 1" }}>
        <Washi tone={item.tone} inline className="h-full w-full" />
      </div>
    );
  }

  // Stickers are painted WebPs with a real intrinsic size: render them in flow so the
  // wrapper picks up height from the image, instead of an absolutely-positioned child in
  // a height-less box.
  return (
    <div className={className} style={style}>
      <Sticker name={item.name} inline className="block h-auto w-full" />
    </div>
  );
}

function GridLines({ tone = "sage" }: { tone?: "sage" | "rose" }) {
  const line = tone === "rose" ? "rgba(168,103,112,0.16)" : "rgba(112,128,104,0.15)";
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-[5%] rounded-[1px] opacity-70"
      style={{
        backgroundImage: `linear-gradient(to right, ${line} 1px, transparent 1px), linear-gradient(to bottom, ${line} 1px, transparent 1px)`,
        backgroundSize: "2.6cqw 2.6cqw",
      }}
    />
  );
}

function PageHeading({ left, right }: { left: string; right: string }) {
  return (
    <div className="relative z-50 flex items-baseline justify-between px-[7%] pt-[5%]">
      <p className="wd-t-sm font-[family-name:var(--font-book)] italic text-[#5b4636]">{left}</p>
      <p className="wd-t-2xs font-[family-name:var(--font-type)] tracking-[0.18em] text-[#8a745c]">
        {right}
      </p>
    </div>
  );
}

function ScrapbookLeftPageImpl({ sway }: { sway: MotionValue<number> }) {
  return (
    <PaperSurface>
      <div className="relative h-full px-[2%] pt-[1%]" style={{ containerType: "inline-size" }}>
        <GridLines />
        <PageHeading left="Scrapbook" right="field notes · 01" />
        <motion.div style={{ rotate: sway }} className="absolute inset-0 origin-center">
          {SCRAPBOOK_LEFT.map((item, index) => (
            <Layer key={index} item={item} index={index} />
          ))}
        </motion.div>
        <div className="pointer-events-none absolute inset-y-0 right-0 z-[60] w-[7%] bg-gradient-to-l from-[#4d3a2b]/18 to-transparent" />
      </div>
    </PaperSurface>
  );
}

function ScrapbookRightPageImpl({ sway }: { sway: MotionValue<number> }) {
  return (
    <PaperSurface>
      <div className="relative h-full px-[2%] pt-[1%]" style={{ containerType: "inline-size" }}>
        <GridLines tone="rose" />
        <PageHeading left="Women in learning" right="page 03 · 20.10" />
        <motion.div style={{ rotate: sway }} className="absolute inset-0 origin-center">
          {SCRAPBOOK_RIGHT.map((item, index) => (
            <Layer key={index} item={item} index={index} />
          ))}
        </motion.div>
        <div className="pointer-events-none absolute inset-y-0 left-0 z-[60] w-[7%] bg-gradient-to-r from-[#4d3a2b]/18 to-transparent" />
      </div>
    </PaperSurface>
  );
}

const MOBILE_ITEMS: readonly CollageItem[] = [
  { kind: "sticker", name: "torn-map", x: -8, y: 2, w: 50, rotate: -7, z: 3 },
  {
    kind: "photo",
    src: "/womans-day/scrapbook/marie-curie.jpg",
    caption: "Marie Curie",
    x: 4,
    y: 8,
    w: 27,
    rotate: -4,
    z: 20,
  },
  { kind: "washi", tone: "beige", x: 8, y: 5, w: 16, rotate: -16, z: 26 },
  {
    kind: "photo",
    src: "/womans-day/scrapbook/malala-yousafzai.jpg",
    caption: "Malala Yousafzai",
    x: 37,
    y: 8,
    w: 27,
    rotate: 3,
    z: 22,
  },
  { kind: "washi", tone: "pink", x: 41, y: 5, w: 16, rotate: 9, z: 28 },
  {
    kind: "photo",
    src: "/womans-day/scrapbook/alysa-liu.jpg",
    caption: "Alysa Liu",
    x: 70,
    y: 8,
    w: 27,
    rotate: 4,
    z: 21,
  },
  { kind: "sticker", name: "butterfly", x: 66, y: 41, w: 15, rotate: -12, z: 25 },
  { kind: "sticker", name: "gold-star", x: 84, y: 40, w: 7, rotate: 14, z: 30 },
  { kind: "sticker", name: "moon", x: 6, y: 42, w: 13, rotate: -9, z: 15 },
  {
    kind: "label",
    text: "“Nothing in life is to be feared, it is only to be understood. Now is the time to understand more, so that we may fear less.” — Marie Curie",
    x: 4,
    y: 50,
    w: 92,
    h: 12,
    rotate: -1,
    z: 40,
  },
  {
    kind: "label",
    text: "“One child, one teacher, one book, and one pen can change the world.” — Malala Yousafzai",
    x: 8,
    y: 69,
    w: 84,
    h: 8,
    rotate: 1.2,
    z: 39,
  },
  {
    kind: "label",
    text: "“I love struggling, actually. It makes me feel alive.” — Alysa Liu",
    x: 5,
    y: 81,
    w: 86,
    h: 7,
    rotate: -1.4,
    z: 38,
  },
] as const;

function ScrapbookMobilePageImpl({ sway }: { sway: MotionValue<number> }) {
  return (
    <PaperSurface>
      <div className="relative h-full" style={{ containerType: "inline-size" }}>
        <GridLines />
        <div className="relative z-50 flex items-baseline justify-between px-[7%] pt-[6%]">
          <p className="wd-t-lead font-[family-name:var(--font-book)] italic text-[#5b4636]">
            Scrapbook
          </p>
          <p className="wd-t-sm font-[family-name:var(--font-type)] tracking-[0.16em] text-[#8a745c]">
            20.10
          </p>
        </div>
        <motion.div style={{ rotate: sway }} className="absolute inset-0 origin-center">
          {MOBILE_ITEMS.map((item, index) => (
            <Layer key={index} item={item} index={index} />
          ))}
        </motion.div>
        <motion.div
          className="pointer-events-none absolute bottom-[3%] right-[6%] z-[50]"
          initial={{ opacity: 0, rotate: -8 }}
          animate={{ opacity: 1, rotate: 6 }}
          transition={{ delay: 0.4 }}
        >
          <Art src="/womans-day/stickers/ribbon-bow.webp" className="w-[14cqw]" />
        </motion.div>
      </div>
    </PaperSurface>
  );
}

export const ScrapbookLeftPage = memo(ScrapbookLeftPageImpl);
export const ScrapbookRightPage = memo(ScrapbookRightPageImpl);
export const ScrapbookMobilePage = memo(ScrapbookMobilePageImpl);
