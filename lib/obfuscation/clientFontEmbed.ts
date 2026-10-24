"use client";

import { getReviewRenderDescriptor } from "@/lib/obfuscation/reviewRenderStore";

/**
 * Build `@font-face` CSS for the ACTIVE obfuscated font family, with the WOFF2
 * bytes inlined as data URLs.
 *
 * WHY THIS EXISTS: the share-capture pipeline rasterises a DOM clone through
 * `html-to-image`, which embeds webfonts by scanning the document STYLESHEETS for
 * `@font-face` rules. The obfuscated faces never appear there — they are loaded
 * through the FontFace API (`hooks/useObfuscatedFont`) — so without this the
 * cloned card renders its PUA text with fallback fonts and every exported PNG is
 * a wall of tofu boxes. Injecting the returned CSS into `document.head` for the
 * duration of the capture puts the faces where the embedder can see them (and
 * lets its normal pipeline keep handling KaTeX and every other stylesheet font).
 *
 * Memoized per family: the four faces are fetched and encoded once, then reused
 * by every later capture in the session. Fails OPEN — any fetch/encode error
 * returns "" so a capture proceeds exactly as it did before this existed.
 */

const memo = new Map<string, Promise<string>>();

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

async function buildFaceCss(
  family: string,
  faces: Array<{ url: string; weight: string | number; style: string }>
): Promise<string> {
  const rules = await Promise.all(
    faces.map(async (face) => {
      const response = await fetch(face.url);
      if (!response.ok) {
        throw new Error(`Font face fetch failed: HTTP ${response.status}`);
      }
      const base64 = arrayBufferToBase64(await response.arrayBuffer());
      // Quotes around the family are required (it contains digits); the data URL
      // must be unquoted-format per the CSS font loader the embedder generates.
      return `@font-face { font-family: "${family}"; src: url(data:font/woff2;base64,${base64}) format("woff2"); font-weight: ${face.weight}; font-style: ${face.style}; font-display: block; }`;
    })
  );
  return rules.join("\n");
}

export function buildObfuscatedFontEmbedCss(): Promise<string> {
  const descriptor = getReviewRenderDescriptor();
  if (!descriptor) {
    return Promise.resolve("");
  }

  const cached = memo.get(descriptor.fontFamily);
  if (cached) {
    return cached;
  }

  const built = buildFaceCss(descriptor.fontFamily, descriptor.faces).catch((error) => {
    console.warn("[obf-font] Could not embed the obfuscated family into the capture.", error);
    // Do not cache failures — the next capture may succeed (e.g. network recovered).
    return "";
  });
  if (descriptor.fontFamily) {
    memo.set(descriptor.fontFamily, built);
  }
  return built;
}
