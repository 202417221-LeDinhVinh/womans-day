/**
 * AES-256-GCM payload envelope — pure, dependency-free, Workers-safe.
 *
 * WHAT THIS IS FOR, precisely: it stops the `curl` / `requests` tier of scraper from
 * reading a question payload out of an HTTP response, and it forces anyone who wants to
 * automate extraction to run OUR client code. It is NOT confidentiality — every input to
 * the key derivation is ultimately reachable by someone who reverse-engineers the client
 * (in production, from inside the WASM binary). That is a documented, accepted limit.
 * See memory/0.3/240-question-payload-obfuscation.md §6.
 *
 * The durable friction comes from ROTATION, not from AES: the pepper half of the key
 * material is baked into the WASM module at build time and rotated every production
 * deploy, so an extractor built by reading one binary is worth exactly one deploy.
 *
 * This module holds NO secret and reads NO env — it is the primitive, so it can be unit
 * tested and reused by the reference decryptor. `envelope.server.ts` owns the secrets.
 */

const ENVELOPE_VERSION = 1;
const IV_BYTES = 12;
const KID_BYTES = 16;

export type PayloadEnvelope = {
  v: number;
  alg: "A256GCM";
  /** Per-response random salt for the key derivation. */
  kid: string;
  iv: string;
  /** Ciphertext with the GCM tag appended (Web Crypto convention). */
  ct: string;
  /**
   * The response-side half of the key material (`ENVELOPE_PUBLIC_HALF`). The other half is baked
   * into the WASM decryptor and rotated per deploy; shipping this half is what lets the module
   * reconstruct the same IKM without the server ever sending a usable key.
   */
  ph?: string;
  /**
   * The HKDF `info` label (`subject|sessionKey|v1`). Not secret — it names the caller's own session
   * — but it must travel, because the client cannot reconstruct the server's subject key.
   */
  info?: string;
};

export type EnvelopeKeyContext = {
  /** Concatenated key material. Both halves are ultimately client-reachable. */
  ikm: Uint8Array;
  /** Binds the key to the caller + session so one response's key opens nothing else. */
  info: string;
};

export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function utf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

async function deriveContentKey(context: EnvelopeKeyContext, kid: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey("raw", context.ikm as BufferSource, "HKDF", false, [
    "deriveKey",
  ]);

  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: kid as BufferSource,
      info: utf8(context.info) as BufferSource,
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/** Encrypt any JSON-serialisable payload into an envelope. */
export async function sealJson(
  payload: unknown,
  context: EnvelopeKeyContext
): Promise<PayloadEnvelope> {
  const kid = crypto.getRandomValues(new Uint8Array(KID_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveContentKey(context, kid);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    utf8(JSON.stringify(payload)) as BufferSource
  );

  return {
    v: ENVELOPE_VERSION,
    alg: "A256GCM",
    kid: toBase64Url(kid),
    iv: toBase64Url(iv),
    ct: toBase64Url(new Uint8Array(ciphertext)),
  };
}

/**
 * Decrypt an envelope. Throws on any tampering, on a wrong context, or on a version we
 * do not recognise — never returns a partially trusted value.
 */
export async function openJson<T>(
  envelope: PayloadEnvelope,
  context: EnvelopeKeyContext
): Promise<T> {
  if (envelope.v !== ENVELOPE_VERSION || envelope.alg !== "A256GCM") {
    throw new Error("Unsupported payload envelope");
  }

  const kid = fromBase64Url(envelope.kid);
  const iv = fromBase64Url(envelope.iv);
  const key = await deriveContentKey(context, kid);

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    fromBase64Url(envelope.ct) as BufferSource
  );

  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}

/** Concatenate the pepper and public halves into one HKDF input. */
export function joinKeyMaterial(...parts: string[]): Uint8Array {
  return utf8(parts.join("\u0000"));
}
