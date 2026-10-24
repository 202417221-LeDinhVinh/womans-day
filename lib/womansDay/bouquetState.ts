"use client";

import { useEffect, useReducer, useRef } from "react";

import {
  MAX_BOUQUET,
  MAX_FILLERS,
  OFFSET_ROT_RANGE,
  OFFSET_X_RANGE,
  OFFSET_Y_RANGE,
  addFiller as addFillerToList,
  addStem,
  clampOffset,
  rearrange,
  removeFiller as removeFillerFromList,
  removeStem,
  type BouquetItem,
} from "@/lib/womansDay/bouquetSlots";
import {
  RIBBON_IDS,
  WRAP_IDS,
  isFlowerId,
  isStemId,
  type FillerId,
  type FlowerId,
  type RibbonId,
  type StemId,
  type WrapId,
} from "@/lib/womansDay/flowers";

/**
 * The bouquet is modelled in two parts, because they behave differently:
 *
 *  - `items` are the FLOWERS, one per slot of the nine-slot dome. This is what "the
 *    bouquet is full" refers to.
 *  - `fillers` is the GREENERY, an ordered list of up to `MAX_FILLERS` species drawn in
 *    the filler slots behind the flowers. Greenery is not competing for a flower slot,
 *    so adding eucalyptus never steals the centre bloom (the previous model put fillers
 *    into `items`, which both hid the add and emptied the centre on rearrange).
 *
 * Old saved bouquets (v1) kept fillers inside `items`; `parseBouquet` migrates them.
 */

export type BouquetState = {
  items: BouquetItem[];
  fillers: FillerId[];
  wrap: WrapId;
  ribbon: RibbonId;
};

export type BouquetAction =
  | { type: "add"; id: FlowerId; key: string }
  | { type: "remove"; key: string }
  | { type: "transform"; key: string; dx: number; dy: number; rot: number }
  | { type: "addFiller"; id: FillerId }
  | { type: "removeFiller"; index: number }
  | { type: "shuffle" }
  | { type: "clear" }
  | { type: "wrap"; id: WrapId }
  | { type: "ribbon"; id: RibbonId }
  | { type: "replace"; state: BouquetState };

export const DEFAULT_WRAP: WrapId = "kraft";
export const DEFAULT_RIBBON: RibbonId = "blush";
export const BOUQUET_STORAGE_KEY = "womans-day:bouquet";

export function bouquetReducer(state: BouquetState, action: BouquetAction): BouquetState {
  switch (action.type) {
    case "add":
      return { ...state, items: addStem(state.items, action.id, action.key) };
    case "remove":
      return { ...state, items: removeStem(state.items, action.key) };
    case "transform":
      return {
        ...state,
        items: state.items.map((item) =>
          item.key === action.key
            ? {
                ...item,
                dx: clampOffset(action.dx, OFFSET_X_RANGE),
                dy: clampOffset(action.dy, OFFSET_Y_RANGE),
                rot: clampOffset(action.rot, OFFSET_ROT_RANGE),
              }
            : item
        ),
      };
    case "addFiller":
      return { ...state, fillers: addFillerToList(state.fillers, action.id, MAX_FILLERS) };
    case "removeFiller":
      return { ...state, fillers: removeFillerFromList(state.fillers, action.index) };
    case "shuffle":
      return { ...state, items: rearrange(state.items) };
    case "clear":
      return { ...state, items: [], fillers: [] };
    case "wrap":
      return { ...state, wrap: action.id };
    case "ribbon":
      return { ...state, ribbon: action.id };
    case "replace":
      return action.state;
    default:
      return state;
  }
}

/** Slots are dealt in order from 0, so a gift bouquet arrives arranged. */
export function bouquetFromStems(
  stems: readonly FlowerId[],
  offsets?: readonly { dx?: number; dy?: number; rot?: number }[]
): BouquetItem[] {
  return stems.slice(0, MAX_BOUQUET).map((id, index) => {
    const offset = offsets?.[index];
    return {
      key: `${id}-gift-${index}`,
      id,
      slot: index,
      ...(offset?.dx ? { dx: clampOffset(offset.dx, OFFSET_X_RANGE) } : {}),
      ...(offset?.dy ? { dy: clampOffset(offset.dy, OFFSET_Y_RANGE) } : {}),
      ...(offset?.rot ? { rot: clampOffset(offset.rot, OFFSET_ROT_RANGE) } : {}),
    };
  });
}

/** Fillers arrive after the flowers, in their own list. */
export function fillersFromStems(stems: readonly FillerId[]): FillerId[] {
  return stems.slice(0, MAX_FILLERS);
}

export function createBouquet(
  stems: readonly FlowerId[] = [],
  fillers: readonly FillerId[] = []
): BouquetState {
  return {
    items: bouquetFromStems(stems),
    fillers: fillersFromStems(fillers),
    wrap: DEFAULT_WRAP,
    ribbon: DEFAULT_RIBBON,
  };
}

/**
 * localStorage is untrusted (other tabs, old builds, hand-edited values). Anything that
 * does not match the schema is dropped; a partially valid bouquet is still better than
 * throwing away the reader's work.
 *
 * v1 stored fillers (e.g. "eucalyptus") inside `items`; those entries are moved into
 * `fillers` here so an old bouquet still looks right after the model split.
 */
export function parseBouquet(raw: string | null): BouquetState | null {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  const record = parsed as Record<string, unknown>;
  const items: BouquetItem[] = [];
  const fillers: FillerId[] = [];
  const usedSlots = new Set<number>();
  const usedKeys = new Set<string>();

  if (Array.isArray(record.items)) {
    for (const entry of record.items) {
      if (!entry || typeof entry !== "object") continue;
      const item = entry as Record<string, unknown>;
      if (typeof item.id !== "string" || !isStemId(item.id)) continue;
      // v1: a filler stored among the flowers becomes greenery, not a flower slot.
      if (!isFlowerId(item.id)) {
        if (fillers.length < MAX_FILLERS) fillers.push(item.id as FillerId);
        continue;
      }
      if (typeof item.slot !== "number" || !Number.isInteger(item.slot)) continue;
      if (item.slot < 0 || item.slot >= MAX_BOUQUET || usedSlots.has(item.slot)) continue;
      const key =
        typeof item.key === "string" && item.key.length > 0 && item.key.length <= 80
          ? item.key
          : `${item.id}-${item.slot}`;
      if (usedKeys.has(key)) continue;
      usedSlots.add(item.slot);
      usedKeys.add(key);
      const offset: Pick<BouquetItem, "dx" | "dy" | "rot"> = {};
      if (typeof item.dx === "number") offset.dx = clampOffset(item.dx, OFFSET_X_RANGE);
      if (typeof item.dy === "number") offset.dy = clampOffset(item.dy, OFFSET_Y_RANGE);
      if (typeof item.rot === "number") offset.rot = clampOffset(item.rot, OFFSET_ROT_RANGE);
      items.push({ key, id: item.id as FlowerId, slot: item.slot, ...offset });
      if (items.length >= MAX_BOUQUET) break;
    }
  }

  if (Array.isArray(record.fillers)) {
    for (const entry of record.fillers) {
      if (typeof entry !== "string" || !isStemId(entry) || isFlowerId(entry)) continue;
      if (fillers.length >= MAX_FILLERS) break;
      fillers.push(entry as FillerId);
    }
  }

  const wrap =
    typeof record.wrap === "string" && (WRAP_IDS as readonly string[]).includes(record.wrap)
      ? (record.wrap as WrapId)
      : DEFAULT_WRAP;
  const ribbon =
    typeof record.ribbon === "string" && (RIBBON_IDS as readonly string[]).includes(record.ribbon)
      ? (record.ribbon as RibbonId)
      : DEFAULT_RIBBON;

  return { items, fillers, wrap, ribbon };
}

export function serializeBouquet(state: BouquetState): string {
  return JSON.stringify(state);
}

export type GiftBouquet = {
  stems: readonly FlowerId[];
  fillers?: readonly FillerId[];
  wrap?: WrapId;
  ribbon?: RibbonId;
  offsets?: readonly { dx?: number; dy?: number; rot?: number }[];
};

/**
 * Bouquet state for the page. Starts from the gift link (a bouquet someone sent) or from
 * local storage, then seeds the reader's own flower into the centre slot. Persistence is
 * switched on only after hydration so the first render can never overwrite a saved
 * bouquet with the default one.
 *
 * A GIFT must not silently overwrite the recipient's own saved bouquet: when a gift is
 * present the initial state is the gift, but persistence stays OFF until the recipient
 * actually edits it (`touchedGift`). Merely opening someone's link must not destroy the
 * bouquet you built yourself last time.
 */
export function useBouquet(seed: FlowerId, gift?: GiftBouquet) {
  const giftStems = gift?.stems;
  const giftFillers = gift?.fillers;
  const giftOffsets = gift?.offsets;
  const hasGift = Boolean(
    (giftStems && giftStems.length > 0) || (giftFillers && giftFillers.length > 0) || gift?.wrap
  );
  const initial: BouquetState = {
    items: bouquetFromStems(hasGift ? (giftStems ?? []) : [], giftOffsets),
    fillers: fillersFromStems(hasGift ? (giftFillers ?? []) : []),
    wrap: gift?.wrap ?? DEFAULT_WRAP,
    ribbon: gift?.ribbon ?? DEFAULT_RIBBON,
  };
  const [state, dispatch] = useReducer(bouquetReducer, initial);
  const hydrated = useRef(false);
  const restored = useRef(false);
  const autoSeedKey = useRef<string | null>(null);
  // A gift bouquet is shown but not written to storage until the recipient edits it.
  const giftPristine = useRef(hasGift);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;

    if (hasGift) {
      // Show the sender's bouquet; do NOT persist yet (see `useBouquet` doc).
      return;
    }

    let stored: BouquetState | null = null;
    try {
      stored = parseBouquet(window.localStorage.getItem(BOUQUET_STORAGE_KEY));
    } catch {
      stored = null;
    }

    if (stored && (stored.items.length > 0 || stored.fillers.length > 0)) {
      dispatch({ type: "replace", state: stored });
      return;
    }

    const key = `${seed}-centre`;
    autoSeedKey.current = key;
    dispatch({
      type: "replace",
      state: { ...createBouquet(), items: [{ key, id: seed, slot: 0 }] },
    });
    // Hydration runs once by design; `initial` is the SSR-consistent value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The cover name may arrive after this hook mounts (saved label, session display name,
  // gift recipient). If the bouquet is still only the automatic centre stem, retarget it
  // to the name the reader actually has. Any manual edit disables this.
  useEffect(() => {
    const key = autoSeedKey.current;
    if (!key) return;
    if (state.items.length !== 1) return;
    if (state.items[0].key !== key || state.items[0].id === seed) return;
    dispatch({ type: "replace", state: { ...state, items: [{ key, id: seed, slot: 0 }] } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  useEffect(() => {
    if (!hydrated.current) return;
    if (!restored.current) {
      restored.current = true;
      return;
    }
    // A pristine gift is not the recipient's own bouquet: do not persist it.
    if (giftPristine.current) return;
    try {
      window.localStorage.setItem(BOUQUET_STORAGE_KEY, serializeBouquet(state));
    } catch {
      // Storage disabled: the bouquet lives for this visit only.
    }
  }, [state]);

  // Any edit after a gift arrived makes the state the recipient's own, so it persists.
  const wrappedDispatch = useRef((action: BouquetAction) => {
    if (action.type !== "replace") giftPristine.current = false;
    dispatch(action);
  }).current;

  return [state, wrappedDispatch] as const;
}

let keyCounter = 0;

export function newStemKey(id: FlowerId | FillerId): string {
  keyCounter += 1;
  return `${id}-${Date.now().toString(36)}-${keyCounter.toString(36)}`;
}
