/**
 * Client-visible types for the question-payload obfuscation pipeline.
 *
 * The render descriptor is deliberately CLEARTEXT even when the payload itself is
 * encrypted: the browser has to fetch the font by URL before it can render anything, so
 * which family a session drew is observable no matter what. What stays server-side is the
 * thing that matters — the secret, the hash and the modulus that CHOSE the family, so a
 * scraper cannot predict or precompute the mapping for a session it has not opened.
 */

import type { PayloadEnvelope } from "@/lib/obfuscation/envelopeCore";

export type ObfuscatedFontFaceDescriptor = {
  url: string;
  weight: string;
  style: string;
};

export type RenderDescriptor = {
  /** CSS family name to inject and apply. */
  fontFamily: string;
  faces: ObfuscatedFontFaceDescriptor[];
  /**
   * Signed, opaque. Echoed back on follow-up calls (Word Wise word resolution) so the
   * server knows which mapping this client holds without trusting a client integer.
   */
  token: string;
  /**
   * A short probe string rendered off-screen to verify the face actually applied.
   * Made of this family's PUA codepoints, so a fallback face cannot produce its metrics.
   */
  probe: string;
};

export type MaybeEnvelopedPayload = {
  envelope?: PayloadEnvelope;
  render?: RenderDescriptor | null;
};
