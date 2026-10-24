"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { playSound } from "@/lib/womansDay/sound";

/**
 * The parcel's three-tap unboxing state machine, owned HERE (in the experience) rather
 * than inside `ParcelBox`. Lifting it out means the box can be remounted freely — a leaf
 * copy, a scene flip from a settle snap, a re-render — without resetting to `sealed`.
 *
 * Three taps: shake → bigger shake → open + bloom. The third tap swaps `box-sealed` →
 * `box-open` and starts the flower burst in the SAME state change, so there is no
 * "open but empty" beat.
 *
 * Stale-closure fix: `advance` reads the CURRENT step from a ref, not from the render it
 * closed over, so the 460 ms lock's queued tap advances the step that is actually current.
 * At most one tap is queued (`queued` is a boolean).
 */

export type ParcelStep = "sealed" | "shake1" | "shake2" | "bloom";

export const PARCEL_NEXT: Record<ParcelStep, ParcelStep> = {
  sealed: "shake1",
  shake1: "shake2",
  shake2: "bloom",
  bloom: "bloom",
};

export const PARCEL_STATUS: Record<ParcelStep, string> = {
  sealed: "A parcel with your name on it. Tap it three times to open it.",
  shake1: "Something is moving inside. Tap again.",
  shake2: "It is definitely alive. One more tap.",
  bloom: "Your bouquet is out of the box.",
};

export const PARCEL_STEPS: readonly ParcelStep[] = ["sealed", "shake1", "shake2", "bloom"];

export function useParcel(resetKey: boolean) {
  const [step, setStep] = useState<ParcelStep>("sealed");
  const stepRef = useRef<ParcelStep>("sealed");
  const queued = useRef(false);
  const lock = useRef<number | null>(null);

  const set = useCallback((next: ParcelStep) => {
    stepRef.current = next;
    setStep(next);
  }, []);

  // An explicit re-arrival rule (NOT a mount): reset to sealed when the reset key flips
  // back to false (the reader left the mail rest), so a remount can never reset it.
  useEffect(() => {
    if (resetKey) return;
    queued.current = false;
    if (lock.current) {
      window.clearTimeout(lock.current);
      lock.current = null;
    }
    if (stepRef.current !== "sealed") set("sealed");
  }, [resetKey, set]);

  const advance = useCallback(() => {
    const current = stepRef.current;
    if (current === "bloom") return;
    if (lock.current) {
      queued.current = true;
      return;
    }

    const next = PARCEL_NEXT[current];
    set(next);
    if (next === "bloom") {
      // Two distinct names overlap cleanly (each buffer playback is its own source).
      playSound("pop");
      playSound("chime");
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([18, 40, 24]);
      return;
    }
    playSound("shake");
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(15);
    lock.current = window.setTimeout(() => {
      lock.current = null;
      if (queued.current) {
        queued.current = false;
        advance();
      }
    }, 460);
  }, [set]);

  const forceStep = useCallback(
    (next: ParcelStep) => {
      set(next);
    },
    [set]
  );

  useEffect(() => {
    return () => {
      if (lock.current) window.clearTimeout(lock.current);
    };
  }, []);

  return { step, advance, forceStep };
}
