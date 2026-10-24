"use client";

import { motion } from "framer-motion";
import { memo } from "react";

import { headSrc, type Flower, type FlowerId } from "@/lib/womansDay/flowers";
import type { ParcelStep } from "@/lib/womansDay/parcelMachine";
import { PaperSurface, Sticker, Washi } from "@/components/womans-day/paper";
import { ParcelBox } from "@/components/womans-day/ParcelBox";

/**
 * Spread three: airmail. A handwritten note on the left, the parcel on the right. The
 * striped edge is print decoration (not an object), so it is drawn with a repeating
 * gradient; every actual object — stamp art and the box — is painted raster.
 */

function AirmailFrame() {
  const stripe =
    "repeating-linear-gradient(135deg, #b24a4a 0 10px, #f4ead6 10px 20px, #33557f 20px 30px, #f4ead6 30px 40px)";
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-40">
      <div
        className="absolute inset-x-[4%] top-[3%] h-[0.9cqw] opacity-80"
        style={{ background: stripe }}
      />
      <div
        className="absolute inset-x-[4%] bottom-[3%] h-[0.9cqw] opacity-80"
        style={{ background: stripe }}
      />
      <div
        className="absolute bottom-[3%] left-[3%] top-[3%] w-[0.6cqw] opacity-60"
        style={{ background: stripe }}
      />
      <div
        className="absolute bottom-[3%] right-[3%] top-[3%] w-[0.6cqw] opacity-60"
        style={{ background: stripe }}
      />
    </div>
  );
}

function MailNotePageImpl({
  flower,
  name,
  tracking,
}: {
  flower: Flower;
  name: string;
  tracking: string;
}) {
  return (
    <PaperSurface>
      <AirmailFrame />
      <div
        className="relative flex h-full flex-col px-[11%] pb-[9%] pt-[9%]"
        style={{ containerType: "inline-size" }}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="wd-t-xs font-[family-name:var(--font-type)] tracking-[0.18em] text-[#8a745c]">
              Ronan SAT post · 20.10
            </p>
            <h2 className="mt-[2%] wd-t-h font-[family-name:var(--font-book)] italic leading-[0.95] text-[#a8423f]">
              You&apos;ve got mail.
            </h2>
          </div>
          <motion.div
            initial={{ rotate: -14, scale: 0.9, opacity: 0 }}
            animate={{ rotate: -8, scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 180, damping: 16, delay: 0.2 }}
            className="relative mt-[1%] w-[22%] border border-[#8a745c]/50 bg-[#f8f1e1] p-[0.5cqw] shadow-[0.2cqw_0.3cqw_0px_rgba(60,42,28,0.16)]"
            style={{ containerType: "inline-size" }}
          >
            <div className="relative aspect-[4/5] overflow-hidden border border-dashed border-[#a08464]/60 bg-[#efe4cd]">
              <img
                src={headSrc(flower.id, 256)}
                alt=""
                aria-hidden
                className="absolute inset-0 h-full w-full scale-[1.07] object-contain p-[8%]"
                draggable={false}
              />
            </div>
            {/* The caption is sized in STAMP-relative `cqw` (no px floor, which used to
                overflow the 22 % stamp at laptop widths) and is allowed to wrap to two
                centred lines rather than being forced onto one overflowing line. */}
            <p className="mt-[0.4cqw] text-center font-[family-name:var(--font-type)] text-[9cqw] leading-[1.15] tracking-[0.04em] text-[#6b5541]">
              Ronan SAT
              <span className="block">· 20.10</span>
            </p>
            <div className="pointer-events-none absolute inset-0 border-[0.35cqw] border-dotted border-[#efe4cd]" />
          </motion.div>
        </div>

        <div className="mt-[5%] border-t border-[#8a745c]/30 pt-[4%]">
          <p className="wd-t-lead font-[family-name:var(--font-note)] leading-[1.55] text-[#34496b]">
            There is a parcel on the next page with your name on the label.
          </p>
          <div className="mt-[2%] flex items-center gap-[2%]">
            <p className="wd-t-lead font-[family-name:var(--font-note)] text-[#34496b]">
              Tap it to open it
            </p>
            <motion.span
              animate={{ x: [0, 7, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              className="wd-t-lead font-[family-name:var(--font-note)] leading-none text-[#34496b]"
            >
              →
            </motion.span>
          </div>
        </div>

        <div className="mt-[6%] bg-[#efe6d2]/70 p-[3.5%]">
          <p className="wd-t-xs font-[family-name:var(--font-type)] tracking-[0.12em] text-[#6b5541]">
            Manifest №{tracking}
          </p>
          <ul className="mt-[1.6%] space-y-[0.6cqw] wd-t-body font-[family-name:var(--font-book)] text-[#3b3128]">
            <li>— one pressed {flower.name.toLowerCase()}, hand-picked</li>
            <li>— one letter, unsigned but meant</li>
            <li>— one reminder that you are doing better than you think</li>
          </ul>
        </div>

        <div className="mt-auto flex items-end justify-between gap-[3%] pt-[4%]">
          <div className="relative rotate-[6deg] border-[0.25cqw] border-[#a8423f]/70 px-[1.2cqw] py-[0.4cqw] wd-t-2xs font-[family-name:var(--font-type)] tracking-[0.14em] text-[#a8423f]/80">
            fragile · handle with care
          </div>
          <Sticker name="wax-seal" inline className="w-[9%] shrink-0 rotate-[-10deg] opacity-90" />
        </div>

        <p className="mt-[3%] text-right wd-t-xs font-[family-name:var(--font-note)] text-[#34496b]/70">
          for {name}, seat 20.10
        </p>
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 z-40 w-[7%] bg-gradient-to-l from-[#4d3a2b]/18 to-transparent" />
    </PaperSurface>
  );
}

function MailParcelPageImpl({
  flower,
  name,
  tracking,
  burst,
  step,
  onTap,
}: {
  flower: Flower;
  name: string;
  tracking: string;
  burst: readonly FlowerId[];
  step: ParcelStep;
  onTap: () => void;
}) {
  return (
    <PaperSurface>
      <AirmailFrame />
      <div
        className="relative flex h-full flex-col items-center px-[9%] pb-[8%] pt-[9%]"
        style={{ containerType: "inline-size" }}
      >
        <div className="flex w-full items-baseline justify-between">
          <p className="wd-t-lead font-[family-name:var(--font-book)] italic text-[#5b4636]">
            Special delivery
          </p>
          <p className="wd-t-2xs font-[family-name:var(--font-type)] tracking-[0.16em] text-[#8a745c]">
            page 03 · 20.10
          </p>
        </div>

        <div className="mt-[4%] flex w-full items-start justify-between">
          <div>
            <p className="wd-t-xs font-[family-name:var(--font-type)] tracking-[0.1em] text-[#6b5541]">
              To: {name}
            </p>
            <p className="mt-[0.4cqw] wd-t-2xs font-[family-name:var(--font-type)] text-[#8a745c]">
              Tracking #RS-2010-{tracking}
            </p>
          </div>
          <Washi tone="pink" className="relative h-[2.4cqw] w-[18%] rotate-[-6deg]" />
        </div>

        <div className="flex w-full flex-1 items-center justify-center">
          <ParcelBox
            name={name}
            tracking={tracking}
            flowerId={flower.id}
            burst={burst}
            step={step}
            onTap={onTap}
          />
        </div>

        <p className="mt-[2%] text-center wd-t-sm font-[family-name:var(--font-note)] text-[#34496b]/80">
          — keep scrolling, the book turns itself —
        </p>
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 z-40 w-[7%] bg-gradient-to-r from-[#4d3a2b]/18 to-transparent" />
    </PaperSurface>
  );
}

function MailMobilePageImpl(props: {
  flower: Flower;
  name: string;
  tracking: string;
  burst: readonly FlowerId[];
  step: ParcelStep;
  onTap: () => void;
}) {
  return (
    <PaperSurface>
      <AirmailFrame />
      <div
        className="relative flex h-full flex-col px-[8%] pb-[8%] pt-[9%]"
        style={{ containerType: "inline-size" }}
      >
        <div className="flex items-start justify-between">
          <h2 className="wd-t-h font-[family-name:var(--font-book)] italic leading-[0.95] text-[#a8423f]">
            You&apos;ve got mail.
          </h2>
          <Sticker name="wax-seal" inline className="w-[13%] shrink-0 rotate-[10deg]" />
        </div>
        <p className="mt-[2%] wd-t-lead font-[family-name:var(--font-note)] leading-snug text-[#34496b]">
          A parcel with your name on it. Tap it to open it ↓
        </p>
        <div className="mt-[2%] flex flex-1 items-center">
          <ParcelBox
            name={props.name}
            tracking={props.tracking}
            flowerId={props.flower.id}
            burst={props.burst}
            step={props.step}
            onTap={props.onTap}
          />
        </div>
        <p className="mt-auto text-center wd-t-sm font-[family-name:var(--font-type)] text-[#8a745c]">
          Manifest №{props.tracking} · from Ronan SAT
        </p>
      </div>
    </PaperSurface>
  );
}

export const MailNotePage = memo(MailNotePageImpl);
export const MailParcelPage = memo(MailParcelPageImpl);
export const MailMobilePage = memo(MailMobilePageImpl);
