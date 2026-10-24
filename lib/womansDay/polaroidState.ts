"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { deletePhoto, loadPhoto, savePhoto } from "@/lib/womansDay/photo";
import { sanitizeName } from "@/lib/womansDay/flowerHash";
import { REVEAL_AT } from "@/lib/womansDay/polaroidGeometry";

/**
 * The "You, in bloom" polaroid state (Plan 15 §3). Lives in the experience (like the
 * bouquet) so a turning-leaf copy is identical to the base page.
 *
 *  - the PHOTO blob is in IndexedDB (never localStorage, never the network);
 *  - `caption` + `strokes` are in localStorage as `{ v: 2, caption, strokes }`
 *    (small, sync-safe);
 *  - the FOIL snapshot is a data URL captured on each pointerup so the leaf shows exactly
 *    what was on the page mid-scratch.
 */

export const POLAROID_STORAGE_KEY = "womans-day:polaroid";
export const MAX_CAPTION = 32;
/** Cap on the stored scratching: total points across all strokes (keeps earliest). */
export const MAX_STROKE_POINTS = 6000;

/**
 * One scratch stroke: flat `[x0, y0, x1, y1, …]` in NORMALISED window coordinates
 * (each 0–1, rounded to 3 decimals), so a resize replays exactly the same scratching.
 */
export type ScratchStroke = number[];

export type PolaroidState = {
  /** The processed photo blob, or null when none is imported. */
  blob: Blob | null;
  /** The photo's object URL (revoked on replace). */
  photoUrl: string | null;
  /** Editable bottom-strip caption. */
  caption: string;
  /** The foil has been scratched past the reveal threshold (derived flag only — the
   *  foil is a lottery ticket and is never removed). */
  revealed: boolean;
  /** The scratch strokes in normalised coordinates (persisted; replayed on paint). */
  strokes: ScratchStroke[];
  /** The current foil snapshot (data URL) for the leaf copy; null = full foil / none. */
  foilSnapshot: string | null;
};

export type PolaroidAction =
  | { type: "photo"; blob: Blob | null; url: string | null }
  | { type: "caption"; value: string }
  | { type: "reveal" }
  | { type: "refoil" }
  | { type: "strokes"; value: ScratchStroke[] }
  | { type: "foilSnapshot"; value: string | null };

function initialState(): PolaroidState {
  return {
    blob: null,
    photoUrl: null,
    caption: "",
    revealed: false,
    strokes: [],
    foilSnapshot: null,
  };
}

export function polaroidReducer(state: PolaroidState, action: PolaroidAction): PolaroidState {
  switch (action.type) {
    case "photo":
      return {
        ...state,
        blob: action.blob,
        photoUrl: action.url,
        revealed: false,
        strokes: [],
        foilSnapshot: null,
      };
    case "caption":
      return { ...state, caption: action.value.slice(0, MAX_CAPTION) };
    case "reveal":
      return { ...state, revealed: true };
    case "refoil":
      return { ...state, revealed: false, strokes: [], foilSnapshot: null };
    case "strokes":
      return { ...state, strokes: truncateStrokes(action.value) };
    case "foilSnapshot":
      return { ...state, foilSnapshot: action.value };
    default:
      return state;
  }
}

/** Keep the earliest whole strokes while the total point count stays in the cap. */
export function truncateStrokes(strokes: ScratchStroke[]): ScratchStroke[] {
  const kept: ScratchStroke[] = [];
  let points = 0;
  for (const stroke of strokes) {
    const strokePoints = Math.floor(stroke.length / 2);
    if (points + strokePoints > MAX_STROKE_POINTS) break;
    kept.push(stroke);
    points += strokePoints;
  }
  return kept;
}

function cleanStroke(value: unknown): ScratchStroke | null {
  if (!Array.isArray(value) || value.length < 2 || value.length % 2 !== 0) return null;
  const cleaned: number[] = [];
  for (const entry of value) {
    if (typeof entry !== "number" || !Number.isFinite(entry) || entry < 0 || entry > 1) {
      return null;
    }
    cleaned.push(Math.round(entry * 1000) / 1000);
  }
  return cleaned;
}

/**
 * localStorage is untrusted: keep only well-formed fields. Storage is `{ v: 2, caption,
 * strokes }`. An old record with no `v` (or `v !== 2`) keeps its caption and IGNORES
 * `revealed` — readers hit by the one-stroke auto-clear bug get their foil back.
 */
export function parsePolaroid(
  raw: string | null
): { caption: string; strokes: ScratchStroke[] } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return null;
    const caption = sanitizeName(typeof parsed.caption === "string" ? parsed.caption : "").slice(
      0,
      MAX_CAPTION
    );
    if (parsed.v !== 2) return { caption, strokes: [] };
    const strokes: ScratchStroke[] = [];
    if (Array.isArray(parsed.strokes)) {
      for (const entry of parsed.strokes) {
        const cleaned = cleanStroke(entry);
        if (cleaned) strokes.push(cleaned);
      }
    }
    return { caption, strokes: truncateStrokes(strokes) };
  } catch {
    return null;
  }
}

export function usePolaroid() {
  const [state, dispatch] = useReducer(polaroidReducer, undefined, initialState);
  const hydrated = useRef(false);
  const urlRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);

  // Restore on mount (photo from IndexedDB, caption + strokes from localStorage). The
  // stored strokes are applied AFTER the photo dispatch (`photo` resets them).
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    let cancelled = false;

    const readStored = () => {
      try {
        return parsePolaroid(window.localStorage.getItem(POLAROID_STORAGE_KEY));
      } catch {
        return null;
      }
    };

    (async () => {
      if (typeof window !== "undefined") {
        const stored = readStored();
        if (stored && !cancelled) {
          dispatch({ type: "caption", value: stored.caption });
          if (stored.strokes.length > 0) dispatch({ type: "strokes", value: stored.strokes });
        }
      }
      const blob = await loadPhoto();
      if (blob && !cancelled) {
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        dispatch({ type: "photo", blob, url });
        const stored = typeof window !== "undefined" ? readStored() : null;
        if (stored && !cancelled) {
          dispatch({ type: "caption", value: stored.caption });
          if (stored.strokes.length > 0) dispatch({ type: "strokes", value: stored.strokes });
        }
      }
      if (!cancelled) setReady(true);
    })();

    return () => {
      cancelled = true;
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, []);

  // Persist caption + strokes (the blob lives in IndexedDB).
  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(
        POLAROID_STORAGE_KEY,
        JSON.stringify({ v: 2, caption: state.caption, strokes: state.strokes })
      );
    } catch {
      // Storage disabled.
    }
  }, [ready, state.caption, state.strokes]);

  const setPhoto = useCallback(async (blob: Blob | null) => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    if (blob) {
      await savePhoto(blob);
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      dispatch({ type: "photo", blob, url });
    } else {
      await deletePhoto();
      dispatch({ type: "photo", blob: null, url: null });
    }
  }, []);

  const removePhoto = useCallback(async () => {
    await deletePhoto();
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    try {
      window.localStorage.removeItem(POLAROID_STORAGE_KEY);
    } catch {
      // ignore
    }
    dispatch({ type: "photo", blob: null, url: null });
    dispatch({ type: "caption", value: "" });
  }, []);

  return { state, dispatch, ready, setPhoto, removePhoto };
}

export { REVEAL_AT };
