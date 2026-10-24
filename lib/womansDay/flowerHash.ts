import { FLOWERS } from "@/lib/womansDay/flowers";

/**
 * "Your flower" is derived from the name on the cover, deterministic and local.
 *
 * FNV-1a 32-bit over `NFC(normalized).toLowerCase().trim() + "|2026"`, finished with the
 * murmur3 `fmix32` avalanche. The finalizer matters: FNV alone puts neighbouring short
 * names in neighbouring buckets, and "Lan" / "Linh" would too often share a flower.
 * Everything here is pure and synchronous so the plate can render on the first paint.
 */

const HASH_SALT = "|2026";
export const HASH_HEX_LENGTH = 6;
export const MAX_NAME_LENGTH = 40;
export const FALLBACK_NAME = "Scholar";

/** NFC, trim, collapse runs of whitespace. Diacritics are kept (they are part of a name). */
export function normalizeName(raw: string): string {
  return raw.normalize("NFC").replace(/\s+/g, " ").trim();
}

/**
 * Safe-to-render display name. Strips control/format characters (including bidi
 * overrides that could flip the letter's layout), collapses whitespace, caps length.
 * Returns "" for input that is empty after cleaning.
 */
export function sanitizeName(raw: string | null | undefined): string {
  if (!raw) return "";
  const cleaned = raw
    .normalize("NFC")
    // C0/C1 controls plus Unicode line/paragraph separators.
    .replace(/[\u0000-\u001F\u007F-\u009F\u2028\u2029]/g, "")
    // Bidi controls and zero-width joiners have no place in a cover label.
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const clipped = Array.from(cleaned).slice(0, MAX_NAME_LENGTH).join("").trim();
  return clipped;
}

function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** murmur3's 32-bit finalizer. Decorrelates the low bits FNV leaves clumped. */
function fmix32(hash: number): number {
  let value = hash;
  value ^= value >>> 16;
  value = Math.imul(value, 0x85ebca6b) >>> 0;
  value ^= value >>> 13;
  value = Math.imul(value, 0xc2b2ae35) >>> 0;
  value ^= value >>> 16;
  return value >>> 0;
}

/** The 32-bit hash behind a name. Exported for tests and the tracking code. */
export function nameHash(raw: string): number {
  const normalized = normalizeName(raw).toLowerCase() || FALLBACK_NAME.toLowerCase();
  return fmix32(fnv1a(normalized + HASH_SALT));
}

/** Index into `FLOWERS` (0–11). Same name, same flower, forever. */
export function flowerIndexForName(raw: string): number {
  return nameHash(raw) % FLOWERS.length;
}

/** Uppercase 6-hex tracking tag, e.g. "TRACKING: #RS-2010-A1B2C3". */
export function hashTag(raw: string): string {
  const hex = nameHash(raw).toString(16).padStart(8, "0").toUpperCase();
  return hex.slice(0, HASH_HEX_LENGTH);
}

/** The name the page actually uses: the label if the reader filled it in, else Scholar. */
export function displayNameFor(raw: string): string {
  return sanitizeName(raw) || FALLBACK_NAME;
}
