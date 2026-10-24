"use client";

import { useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

import { headSrc, type FlowerId } from "@/lib/womansDay/flowers";
import { Art } from "@/components/womans-day/paper";
import { PARCEL_STATUS, type ParcelStep } from "@/lib/womansDay/parcelMachine";
import { BOX_ART, FRONT_FACE, MOUTH, quadToMatrix3d } from "@/lib/womansDay/parcelGeometry";

/**
 * The parcel on the mail spread. Three taps, no wrapper: shake → bigger shake → open.
 * The third tap swaps `box-sealed` → `box-open` and starts the flower bloom in the SAME
 * state change (no "open but empty" beat, no auto-delay).
 *
 * CONTROLLED: the step machine lives in `WomansDayExperience` (`useParcel`), so a remount
 * (leaf copy, scene flip, settle snap) can never reset the parcel and every render copy
 * shows the same step. This component only draws the current step and reports taps.
 *
 * ART (Plan 8): the box is ONE painted object per state — `box-sealed`, `box-open` —
 * derived from a single reference so both share an identical canvas (`BOX_ART`). Every
 * state image is drawn `absolute inset-0 w-full h-full`, so a percentage of the wrapper
 * equals a percentage of the art and the measured `FRONT_FACE` / `MOUTH` (see
 * `lib/womansDay/parcelGeometry.ts`) land exactly where they were measured. There is NO
 * separate tape, untaped or tissue piece: the tape is painted into `box-sealed`. Only the
 * shipping label is live DOM, mapped onto the measured front-face quad with `matrix3d`.
 *
 * Hit-testing: every overlay is `pointer-events-none`, and the button is the top element
 * at every step, so a tap always reaches it.
 */

/** Fallback burst for an empty bouquet (still needs something to bloom). */
const FALLBACK_BURST: FlowerId[] = ["peony", "rose", "daisy", "ranunculus", "tulip", "iris"];

/**
 * The front face's bounding box in art percents, used to size and place the label element
 * before the `matrix3d` warp. Derived from `FRONT_FACE` (TL, TR, BR, BL).
 */
const FRONT_FACE_BOX = {
  left: Math.min(...FRONT_FACE.map((p) => p.x)),
  top: Math.min(...FRONT_FACE.map((p) => p.y)),
  width: Math.max(...FRONT_FACE.map((p) => p.x)) - Math.min(...FRONT_FACE.map((p) => p.x)),
  height: Math.max(...FRONT_FACE.map((p) => p.y)) - Math.min(...FRONT_FACE.map((p) => p.y)),
} as const;

export function ParcelBox({
  name,
  tracking,
  flowerId,
  burst,
  step,
  onTap,
}: {
  name: string;
  tracking: string;
  flowerId: FlowerId;
  /** The flowers that fly out — the reader's (or the gift's) actual bouquet. */
  burst?: readonly FlowerId[];
  step: ParcelStep;
  onTap: () => void;
}) {
  const bloomFlowers = useMemo<readonly FlowerId[]>(() => {
    const ids = (burst ?? []).filter((id, index, all) => all.indexOf(id) === index).slice(0, 6);
    return ids.length > 0 ? ids : FALLBACK_BURST;
  }, [burst]);

  const shaking = step === "shake1" ? 1 : step === "shake2" ? 2 : 0;
  // `bloom` means the box is open AND the flowers are out, in one state change.
  const open = step === "bloom";
  const reduceMotion = useReducedMotion();
  // The label rides the front face up to the last tap; once the lid opens the face is no
  // longer flat (the flaps move), so it fades out with the swap to `box-open`.
  const showLabel = !open;

  // The label is warped onto the measured front face. The matrix is built once per mount
  // (the geometry is static), sized to the FRONT_FACE bounding box; the element is placed
  // at that box's top-left with `transform-origin: 0 0` and the content is inset a little
  // so ink never touches the cardboard edge.
  const labelMatrix = useMemo(
    () => quadToMatrix3d(FRONT_FACE, FRONT_FACE_BOX.width, FRONT_FACE_BOX.height),
    []
  );

  return (
    <div
      data-wd-interactive
      className="relative flex w-full flex-col items-center"
      style={{ containerType: "inline-size" }}
    >
      <div className="relative w-[64%]">
        <motion.div
          className={step === "sealed" && !reduceMotion ? "wd-idle-bob relative" : "relative"}
          animate={
            reduceMotion
              ? { rotate: 0, y: 0, scaleY: 1 }
              : shaking === 2
                ? { rotate: [0, -5, 5, -3, 2, 0], y: [0, -12, 0], scaleY: [1, 0.96, 1.04, 1] }
                : shaking === 1
                  ? { rotate: [0, -4, 4, -2, 0], scaleY: [1, 0.94, 1.03, 1] }
                  : { rotate: 0, y: 0, scaleY: 1 }
          }
          transition={{ duration: shaking && !reduceMotion ? 0.44 : 0.3 }}
          style={{ transformOrigin: "50% 88%" }}
        >
          {/* The box: one wrapper at the art's own aspect ratio; every state image and every
              overlay is `absolute inset-0`, so percentages are percentages of the ART. */}
          <div
            className="relative w-full"
            style={{ aspectRatio: `${BOX_ART.width} / ${BOX_ART.height}` }}
          >
            {/* Warm glow from inside, at the measured mouth, visible the moment the box opens. */}
            <motion.div
              aria-hidden
              className="pointer-events-none absolute z-0 rounded-full bg-[radial-gradient(closest-side,rgba(255,214,150,0.85),rgba(255,214,150,0.28)_55%,transparent_78%)] blur-[0.4cqw]"
              style={{
                left: `${MOUTH.centreX - MOUTH.fullWidthPercent / 2}%`,
                top: `${MOUTH.frontEdgeY - 26}%`,
                width: `${MOUTH.fullWidthPercent}%`,
                height: "46%",
              }}
              initial={false}
              animate={{ opacity: open ? 1 : 0, scale: open ? 1.15 : 1 }}
              transition={{ duration: 0.2 }}
            />

            {/* OPEN state (behind the closed state) — fades in on the third tap with a small
                lid pop, so the closed box is never seen through it, and the bloom starts on
                the same frame. */}
            <motion.div
              className="absolute inset-0"
              initial={false}
              animate={{
                opacity: open ? 1 : 0,
                scaleY: open ? [1, 1.04, 1] : 1,
                y: 0,
              }}
              transition={{
                opacity: { duration: 0.12 },
                scaleY: { duration: 0.25 },
                y: { duration: 0.12 },
              }}
              style={{ transformOrigin: "50% 100%" }}
            >
              <Art src="/womans-day/box/box-open.webp" className="h-full w-full object-contain" />
            </motion.div>

            {/* SEALED state (tape painted on) — the base; fades out on the third tap. */}
            <motion.div
              className="absolute inset-0"
              initial={false}
              animate={{ opacity: open ? 0 : 1 }}
              transition={{ duration: 0.12 }}
            >
              <Art src="/womans-day/box/box-sealed.webp" className="h-full w-full object-contain" />

              {/* Shipping label: a live 3-line card warped onto the measured front face.
                  Sized in `cqw` of the BOX (not the floored `wd-t-*`), so it scales with
                  the art and cannot overflow the face. The element is the FRONT_FACE bbox;
                  the inner card is inset so the ink stays inside the face. */}
              <motion.div
                aria-hidden={!showLabel}
                className="pointer-events-none absolute"
                style={{
                  left: `${FRONT_FACE_BOX.left}%`,
                  top: `${FRONT_FACE_BOX.top}%`,
                  width: `${FRONT_FACE_BOX.width}%`,
                  height: `${FRONT_FACE_BOX.height}%`,
                  transform: labelMatrix,
                  transformOrigin: "0 0",
                }}
                initial={false}
                animate={{ opacity: showLabel ? 1 : 0 }}
                transition={{ duration: 0.28 }}
              >
                <div className="absolute inset-x-[10%] top-[12%] border border-[#6b4b32]/35 bg-[#f4ecd8]/95 px-[5%] py-[4%] text-left shadow-[0.1cqw_0.16cqw_0px_rgba(70,44,28,0.2)]">
                  <p className="truncate font-[family-name:var(--font-type)] text-[1.5cqw] font-bold leading-tight tracking-[0.04em] text-[#3a2d23]">
                    To: {name}
                  </p>
                  <p className="truncate font-[family-name:var(--font-type)] text-[1.35cqw] leading-tight text-[#5b4636]">
                    From: Ronan SAT
                  </p>
                  <p className="truncate font-[family-name:var(--font-type)] text-[1.35cqw] leading-tight text-[#8a745c]">
                    #RS-2010-{tracking}
                  </p>
                </div>
              </motion.div>
            </motion.div>

            {/* Bloom: the reader's own flowers rise in a fan ABOVE the mouth (or a fallback
                for an empty bouquet). Angles run −150°…−30°, never below the mouth line, and
                the cluster is clamped so it cannot reach the page header / airmail frame. */}
            <AnimatePresence>
              {open &&
                bloomFlowers.map((id, index) => {
                  const count = bloomFlowers.length;
                  // Fan across −150°…−30° (up is −90°); symmetric about the vertical.
                  const t = count === 1 ? 0.5 : index / (count - 1);
                  const angleDeg = -150 + t * 120;
                  const angle = (angleDeg * Math.PI) / 180;
                  const distance = 20 + (index % 3) * 7;
                  return (
                    <motion.div
                      key={`${id}-${index}`}
                      aria-hidden
                      className="pointer-events-none absolute z-[6] -translate-x-1/2"
                      style={{
                        left: `${MOUTH.centreX}%`,
                        top: `${MOUTH.frontEdgeY}%`,
                        width: `${index === 0 ? MOUTH.bloomWidthPercent * 0.62 : MOUTH.bloomWidthPercent * 0.46}%`,
                      }}
                      initial={
                        reduceMotion ? { opacity: 0 } : { y: 0, scale: 0.3, opacity: 0, rotate: 0 }
                      }
                      animate={{
                        x: `${Math.cos(angle) * distance}cqw`,
                        y: `${Math.sin(angle) * distance - 4}cqw`,
                        scale: 1,
                        opacity: 1,
                        rotate: (index % 2 === 0 ? 1 : -1) * (14 + index * 7),
                      }}
                      exit={{ opacity: 0 }}
                      transition={
                        reduceMotion
                          ? { duration: 0.2, delay: index * 0.02 }
                          : {
                              type: "spring",
                              stiffness: 120,
                              damping: 14,
                              delay: index * 0.03,
                            }
                      }
                    >
                      <Art
                        src={headSrc(id, 512)}
                        className="h-auto w-full drop-shadow-[0_6px_8px_rgba(80,45,40,0.25)]"
                      />
                    </motion.div>
                  );
                })}
            </AnimatePresence>

            {/* The whole box is the tap target. `onMouseDown` prevents the browser from
                scrolling the focused button into view (which would move the book). */}
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={onTap}
              aria-label={open ? "Open parcel, already open" : "Open your parcel"}
              aria-describedby="parcel-status"
              className="absolute inset-0 z-[12] cursor-pointer rounded-[1cqw] outline-none focus-visible:ring-2 focus-visible:ring-[#b0566b] focus-visible:ring-offset-4 focus-visible:ring-offset-[#f2ebda]"
            />
          </div>
        </motion.div>

        {/* The "tap to open" tag lives BELOW the box so it never covers the box or its
            shipping label. */}
        {!open && (
          <div className="pointer-events-none mt-[2%] flex items-center justify-center gap-[1.4cqw]">
            <span className="rotate-[-2deg] border border-[#8a6a4c]/40 bg-[#f7f0df]/95 px-[2.2cqw] py-[1cqw] font-[family-name:var(--font-note)] wd-t-sm text-[#5b4636] shadow-[0.25cqw_0.35cqw_0px_rgba(70,44,28,0.18)]">
              tap to open
            </span>
            <div className="flex gap-[0.6cqw]">
              {[0, 1, 2].map((index) => {
                const filled = ["shake1", "shake2", "bloom"].indexOf(step) >= index;
                return (
                  <span
                    key={index}
                    className="h-[1cqw] w-[1cqw] rounded-full border border-[#8a6a4c]/60"
                    style={{ background: filled ? "#b0566b" : "transparent" }}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      <p
        id="parcel-status"
        role="status"
        aria-live="polite"
        className="mt-[3%] max-w-[80%] text-center font-[family-name:var(--font-type)] wd-t-2xs leading-relaxed text-[#6b5541]"
      >
        {PARCEL_STATUS[step]}
      </p>

      {open && (
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-[2%] max-w-[84%] text-center font-[family-name:var(--font-note)] wd-t-sm text-[#2f4f7a]"
        >
          Your bouquet has travelled to the florist&apos;s page →
        </motion.p>
      )}
    </div>
  );
}
