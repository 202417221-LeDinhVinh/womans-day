"use client";

/**
 * The reader's photo for the scratch polaroid (Plan 15 §3.4).
 *
 * The photo NEVER leaves the browser: it is processed to a small WebP blob, stored in
 * IndexedDB, and rendered from an object URL. It is not uploaded, not in the gift link, and
 * not in the keepsake capture (unless a later change asks for it). `docs/SECURITY.md`
 * records this (no new data flow).
 */

const DB_NAME = "womans-day";
const DB_VERSION = 1;
const STORE = "photo";
const KEY = "self";

/** Reject anything larger than this (bytes). */
export const MAX_PHOTO_BYTES = 20 * 1024 * 1024;

/** Longest edge of the stored image. */
const MAX_EDGE = 1200;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
  });
}

export async function savePhoto(blob: Blob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
  });
  db.close();
}

export async function loadPhoto(): Promise<Blob | null> {
  try {
    const db = await openDb();
    const blob = await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const request = tx.objectStore(STORE).get(KEY);
      request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error("IndexedDB read failed"));
    });
    db.close();
    return blob;
  } catch {
    return null;
  }
}

export async function deletePhoto(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB delete failed"));
    });
    db.close();
  } catch {
    // Nothing to delete.
  }
}

export type ProcessResult = { ok: true; blob: Blob } | { ok: false; message: string };

/**
 * Centre-crop to `aspect` (width ÷ height), downscale the long edge to 1200 px, and export a
 * WebP (JPEG fallback). Decoding prefers `createImageBitmap` with EXIF orientation; a plain
 * `<img>` + `decode()` is the fallback.
 */
export async function processPhoto(file: File, aspect: number): Promise<ProcessResult> {
  if (!file.type.startsWith("image/")) {
    return { ok: false, message: "That file is not an image." };
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return { ok: false, message: "That photo is over 20 MB. Try a smaller one." };
  }

  let source: ImageBitmap | HTMLImageElement;
  try {
    if (typeof createImageBitmap === "function") {
      source = await createImageBitmap(file, { imageOrientation: "from-image" });
    } else {
      source = await decodeViaImage(file);
    }
  } catch {
    return { ok: false, message: "That photo could not be read. Try another one." };
  }

  const sw = "width" in source ? source.width : 0;
  const sh = "height" in source ? source.height : 0;
  if (!sw || !sh) return { ok: false, message: "That photo could not be read." };

  // Centre-crop to the target aspect.
  let cw = sw;
  let ch = Math.round(sw / aspect);
  if (ch > sh) {
    ch = sh;
    cw = Math.round(sh * aspect);
  }
  const sx = Math.round((sw - cw) / 2);
  const sy = Math.round((sh - ch) / 2);

  const scale = Math.min(1, MAX_EDGE / Math.max(cw, ch));
  const dw = Math.max(1, Math.round(cw * scale));
  const dh = Math.max(1, Math.round(ch * scale));

  const canvas = document.createElement("canvas");
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { ok: false, message: "This browser cannot process the photo." };
  ctx.drawImage(source as CanvasImageSource, sx, sy, cw, ch, 0, 0, dw, dh);
  if ("close" in source && typeof source.close === "function") source.close();

  const blob = await canvasToBlob(canvas, "image/webp", 0.86);
  if (blob) return { ok: true, blob };
  const jpeg = await canvasToBlob(canvas, "image/jpeg", 0.88);
  if (jpeg) return { ok: true, blob: jpeg };
  return { ok: false, message: "This browser cannot save the photo." };
}

function decodeViaImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = async () => {
      try {
        if (typeof image.decode === "function") await image.decode();
      } catch {
        // Ignore; the load event already fired.
      }
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode failed"));
    };
    image.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), type, quality));
}
