"use client";

import { useSyncExternalStore } from "react";

import type { RenderDescriptor } from "@/types/obfuscation";

/**
 * The client-side holder for the REVIEW surface's obfuscation render descriptor.
 *
 * Every review-surface response (`GET /api/results/[resultId]`, the per-question
 * fetch, the bulk prefetch, the error-log page) carries the SAME `render`
 * descriptor — the server derives one font family per caller
 * (`review:<userId>`, see `reviewObfuscationSessionKey`) — so one module-scoped
 * slot is enough for the whole SPA session. Surfaces that render projected prose
 * (the per-question popup, the Error Log record dialog, the Notes previews) read
 * the descriptor from here instead of threading it through props, which matters
 * because two of those render inside Radix PORTALS that escape any reasonable
 * container.
 *
 * Why module scope and not React state: the descriptor must survive route
 * transitions (/review/question → /review) and be writable from plain service
 * functions (`lib/services/reviewService.ts`) at unwrap time. It holds no secret —
 * the family index and token ride in the clear by design (docs/SECURITY.md).
 */

let currentDescriptor: RenderDescriptor | null = null;

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Record the descriptor from the latest review-surface response. `null`/`undefined`
 * clears it (plaintext response: feature off, editor exemption, granted plain
 * fallback, or an adaptive payload) so every marker disappears together.
 */
export function setReviewRenderDescriptor(descriptor: RenderDescriptor | null | undefined) {
  const next = descriptor ?? null;
  // Identity changes per response object; compare by what actually matters so a
  // stream of identical responses does not spam subscribers.
  if (
    currentDescriptor?.fontFamily === next?.fontFamily &&
    currentDescriptor?.token === next?.token
  ) {
    return;
  }
  currentDescriptor = next;
  emit();
}

/** True while review payloads are arriving projected (and a font is expected). */
export function isReviewPayloadObfuscated(): boolean {
  return currentDescriptor !== null;
}

/** Non-reactive read for non-React consumers (the share-capture pipeline). */
export function getReviewRenderDescriptor(): RenderDescriptor | null {
  return currentDescriptor;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): RenderDescriptor | null {
  return currentDescriptor;
}

function getServerSnapshot(): RenderDescriptor | null {
  return null;
}

/** Reactively read the current review render descriptor (null = plaintext). */
export function useReviewRenderDescriptor(): RenderDescriptor | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
