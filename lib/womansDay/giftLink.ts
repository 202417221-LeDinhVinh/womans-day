import { sanitizeName } from "@/lib/womansDay/flowerHash";
import {
  MAX_BOUQUET,
  MAX_FILLERS,
  OFFSET_ROT_RANGE,
  OFFSET_X_RANGE,
  OFFSET_Y_RANGE,
  clampOffset,
  type BouquetItem,
} from "@/lib/womansDay/bouquetSlots";
import {
  RIBBON_IDS,
  STEM_IDS,
  WRAP_IDS,
  isFlowerId,
  isStemId,
  type FillerId,
  type FlowerId,
  type RibbonId,
  type WrapId,
} from "@/lib/womansDay/flowers";

/**
 * A gift bouquet travels inside the URL — no database, no server round trip.
 *
 * `/womans-day?to=<name>&b=<code>` where `code` is URL-safe base64 of a tiny JSON
 * payload. The decoder is a strict schema: known species only, at most nine flowers and
 * five fillers, known wrap and ribbon. Anything else is ignored, never partially
 * rendered, and the reader still gets the default page.
 *
 * v2 splits flowers (`s`) from greenery (`f`). v1 kept fillers inside `s`; the decoder
 * still reads a v1 code so links already sent keep working, sorting the fillers out.
 */

export type BouquetState = {
  items: BouquetItem[];
  fillers: FillerId[];
  wrap: WrapId;
  ribbon: RibbonId;
};

export type GiftPayloadV2 = {
  v: 2;
  s: FlowerId[];
  f: FillerId[];
  w: WrapId;
  r: RibbonId;
};

/**
 * v3 adds manual head offsets `o`, aligned with `s`: each entry is
 * `[dx*2|0, dy*2|0, rot|0]` (the ×2 keeps a half-percent of precision in an integer). The
 * array is omitted entirely when every offset is zero, so a plain bouquet still encodes as
 * a v2-length code.
 */
export type GiftPayloadV3 = {
  v: 3;
  s: FlowerId[];
  f: FillerId[];
  w: WrapId;
  r: RibbonId;
  o?: number[][];
};

export type Gift = {
  /** Sanitised recipient name from `?to=`, or null. */
  to: string | null;
  /** Decoded bouquet, or null when the link had no/invalid code. */
  bouquet: {
    stems: FlowerId[];
    fillers: FillerId[];
    wrap: WrapId;
    ribbon: RibbonId;
    /** Manual head offsets aligned with `stems` (v3); empty for v1/v2. */
    offsets?: { dx?: number; dy?: number; rot?: number }[];
  } | null;
};

export const GIFT_CODE_PARAM = "b";
export const GIFT_TO_PARAM = "to";
export const MAX_GIFT_CODE_LENGTH = 720;

function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): string | null {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const withPadding = padded + "=".repeat((4 - (padded.length % 4)) % 4);
  try {
    const binary = atob(withPadding);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/** Compact, deterministic code for the current bouquet. */
export function encodeBouquet(state: BouquetState): string {
  const flowers = state.items.filter((item) => isFlowerId(item.id)).slice(0, MAX_BOUQUET);
  const payload: GiftPayloadV3 = {
    v: 3,
    s: flowers.map((item) => item.id as FlowerId),
    f: state.fillers.slice(0, MAX_FILLERS),
    w: state.wrap,
    r: state.ribbon,
  };
  const offsets = flowers.map((item) => [
    Math.round((item.dx ?? 0) * 2),
    Math.round((item.dy ?? 0) * 2),
    Math.round(item.rot ?? 0),
  ]);
  if (offsets.some((entry) => entry[0] || entry[1] || entry[2])) payload.o = offsets;
  return toBase64Url(JSON.stringify(payload));
}

type Decoded = {
  s: FlowerId[];
  f: FillerId[];
  w: WrapId;
  r: RibbonId;
  /** Per-flower offsets aligned with `s` (dx/dy/rot), all zero when absent. */
  o: { dx: number; dy: number; rot: number }[];
};

function decodeV1(record: Record<string, unknown>): Decoded | null {
  if (!Array.isArray(record.s) || record.s.length > MAX_BOUQUET + MAX_FILLERS) return null;
  const flowers: FlowerId[] = [];
  const fillers: FillerId[] = [];
  for (const id of record.s) {
    if (typeof id !== "string" || !isStemId(id)) return null;
    if (isFlowerId(id)) {
      if (flowers.length < MAX_BOUQUET) flowers.push(id);
    } else if (fillers.length < MAX_FILLERS) {
      fillers.push(id);
    }
  }
  if (typeof record.w !== "string" || !(WRAP_IDS as readonly string[]).includes(record.w)) {
    return null;
  }
  if (typeof record.r !== "string" || !(RIBBON_IDS as readonly string[]).includes(record.r)) {
    return null;
  }
  return { s: flowers, f: fillers, w: record.w as WrapId, r: record.r as RibbonId, o: [] };
}

function decodeV2(record: Record<string, unknown>): Decoded | null {
  if (!Array.isArray(record.s) || record.s.length > MAX_BOUQUET) return null;
  const flowers: FlowerId[] = [];
  for (const id of record.s) {
    if (typeof id !== "string" || !isFlowerId(id)) return null;
    flowers.push(id);
  }
  const fillers: FillerId[] = [];
  if (Array.isArray(record.f)) {
    if (record.f.length > MAX_FILLERS) return null;
    for (const id of record.f) {
      if (typeof id !== "string" || !isStemId(id) || isFlowerId(id)) return null;
      fillers.push(id as FillerId);
    }
  }
  if (typeof record.w !== "string" || !(WRAP_IDS as readonly string[]).includes(record.w)) {
    return null;
  }
  if (typeof record.r !== "string" || !(RIBBON_IDS as readonly string[]).includes(record.r)) {
    return null;
  }
  return { s: flowers, f: fillers, w: record.w as WrapId, r: record.r as RibbonId, o: [] };
}

/**
 * v3 = v2 plus an optional `o` array of per-flower `[dx2, dy2, rot]` offsets aligned with
 * `s`. A malformed `o` (wrong length, non-numeric) degrades to zero offsets rather than
 * rejecting the whole link — the bouquet itself is still valid.
 */
function decodeV3(record: Record<string, unknown>): Decoded | null {
  const base = decodeV2(record);
  if (!base) return null;
  const offsets: Decoded["o"] = base.s.map(() => ({ dx: 0, dy: 0, rot: 0 }));
  if (Array.isArray(record.o)) {
    for (let i = 0; i < base.s.length; i += 1) {
      const entry = record.o[i];
      if (!Array.isArray(entry)) continue;
      const [dx2, dy2, rot] = entry;
      if (typeof dx2 === "number") offsets[i].dx = clampOffset(dx2 / 2, OFFSET_X_RANGE);
      if (typeof dy2 === "number") offsets[i].dy = clampOffset(dy2 / 2, OFFSET_Y_RANGE);
      if (typeof rot === "number") offsets[i].rot = clampOffset(rot, OFFSET_ROT_RANGE);
    }
  }
  return { ...base, o: offsets };
}

export function decodeBouquet(code: string | null | undefined): Decoded | null {
  if (!code || code.length > MAX_GIFT_CODE_LENGTH) return null;
  const json = fromBase64Url(code);
  if (!json) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as Record<string, unknown>;
  if (record.v === 3) return decodeV3(record);
  if (record.v === 2) return decodeV2(record);
  if (record.v === 1) return decodeV1(record);
  return null;
}

/** Build the shareable link, preserving the current host. */
export function buildGiftUrl(origin: string, name: string, state: BouquetState): string {
  const url = new URL("/womans-day", origin);
  const safeName = sanitizeName(name);
  if (safeName) url.searchParams.set(GIFT_TO_PARAM, safeName);
  if (state.items.length > 0 || state.fillers.length > 0) {
    url.searchParams.set(GIFT_CODE_PARAM, encodeBouquet(state));
  }
  return url.toString();
}

/**
 * Read both params from a page's `searchParams` object. A recipient's name is text, not
 * markup — it is sanitised here and rendered as a React text node later.
 */
export function readGift(
  params: Record<string, string | string[] | undefined> | URLSearchParams
): Gift {
  const get = (key: string): string | null => {
    if (params instanceof URLSearchParams) return params.get(key);
    const value = params[key];
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
  };

  const to = sanitizeName(get(GIFT_TO_PARAM));
  const payload = decodeBouquet(get(GIFT_CODE_PARAM));

  return {
    to: to || null,
    bouquet: payload
      ? {
          stems: payload.s,
          fillers: payload.f,
          wrap: payload.w,
          ribbon: payload.r,
          offsets: payload.o,
        }
      : null,
  };
}

/** Stem ids known to this build — exported so callers can validate without importing flowers. */
export const KNOWN_STEM_IDS: readonly FlowerId[] = STEM_IDS.filter(isFlowerId);
