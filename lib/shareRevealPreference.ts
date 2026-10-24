"use client";

import { useSyncExternalStore } from "react";

/**
 * Per-browser preference for the question share dialog (`ShareImageDialog`):
 * what the exported PNG should include — the "chosen option" reveal, the
 * "correct answer" reveal, and (live-session quiz cards) the per-option response
 * counts / voter chips. Mirrors `lib/wordwise/difficulty.ts`'s shared-external-
 * store pattern. Kept in localStorage only — it's a personal export preference,
 * not account data, so the next share (this browser, any question) restores the
 * last choice with no DB round-trip.
 *
 * All default to `true` (show), matching the dialog's original always-reveal
 * behavior, so existing users see no change until they opt to omit something.
 */
export type ShareRevealPreference = {
  showChosenAnswer: boolean;
  showCorrectAnswer: boolean;
  /** Live-quiz exports: keep the per-option response counts + voter chips. */
  showChoiceCounts: boolean;
};

const KEY = "testing-room:share-reveal:v1";
const DEFAULT_PREFERENCE: ShareRevealPreference = {
  showChosenAnswer: true,
  showCorrectAnswer: true,
  showChoiceCounts: true,
};

let current: ShareRevealPreference | null = null;
const listeners = new Set<() => void>();

// Stored values are MERGED over the defaults rather than validated all-or-
// nothing: a browser that saved the two-field v1 shape must keep its choices and
// pick up the default for any field added later, instead of silently resetting.
function normalize(value: unknown): ShareRevealPreference {
  if (typeof value !== "object" || value === null) return DEFAULT_PREFERENCE;
  const raw = value as Record<string, unknown>;
  const pick = (name: keyof ShareRevealPreference) =>
    typeof raw[name] === "boolean" ? (raw[name] as boolean) : DEFAULT_PREFERENCE[name];
  return {
    showChosenAnswer: pick("showChosenAnswer"),
    showCorrectAnswer: pick("showCorrectAnswer"),
    showChoiceCounts: pick("showChoiceCounts"),
  };
}

function read(): ShareRevealPreference {
  if (typeof window === "undefined") return DEFAULT_PREFERENCE;
  if (current !== null) return current;
  try {
    const raw = window.localStorage.getItem(KEY);
    current = normalize(raw ? JSON.parse(raw) : null);
  } catch {
    current = DEFAULT_PREFERENCE;
  }
  return current;
}

function emit() {
  for (const listener of listeners) listener();
}

export function setShareRevealPreference(next: Partial<ShareRevealPreference>): void {
  if (typeof window === "undefined") return;
  const merged = { ...read(), ...next };
  current = merged;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(merged));
  } catch {
    // Ignore quota/serialization errors — the in-memory store still updates
    // for the rest of this session.
  }
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Reflect changes made in another tab (storage event fires cross-tab only).
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    try {
      current = normalize(e.newValue ? JSON.parse(e.newValue) : null);
    } catch {
      current = DEFAULT_PREFERENCE;
    }
    emit();
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

/** Read the shared share-reveal preference, re-rendering on any change. */
export function useShareRevealPreference(): ShareRevealPreference {
  return useSyncExternalStore(subscribe, read, () => DEFAULT_PREFERENCE);
}
