import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { STICKERS, WOMANS_DAY_IMAGES, floristImages } from "@/lib/womansDay/assets";

const ROOT = process.cwd();
const PUBLIC = join(ROOT, "public");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function componentFiles(): string[] {
  const dirs = [join(ROOT, "components", "womans-day"), join(ROOT, "app", "womans-day")];
  return dirs.flatMap((dir) => (existsSync(dir) ? walk(dir) : []));
}

describe("womans-day asset manifest", () => {
  test("every manifest entry exists under public/", () => {
    const missing = WOMANS_DAY_IMAGES.filter(
      (src) => !existsSync(join(PUBLIC, src.replace(/^\//, "")))
    );
    expect(missing).toEqual([]);
  });

  test("every /womans-day image literal in the components is in the manifest", () => {
    const manifest = new Set(WOMANS_DAY_IMAGES);
    // Sticker/paper paths are referenced through helpers with a `.webp` literal; capture
    // the file-extension literals only (skip code identifiers like `womans-day/paper`).
    const literal = /\/womans-day\/[A-Za-z0-9._/-]+\.(?:webp|jpg|png)/g;
    const found = new Set<string>();
    for (const file of componentFiles()) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(literal)) found.add(match[0]);
    }
    const missing = [...found].filter((src) => !manifest.has(src));
    // The OG social card is referenced from the route metadata but is not an in-page image.
    expect(missing.filter((src) => !/\/og\.jpg$/.test(src))).toEqual([]);
  });

  test("sticker names all resolve to real files", () => {
    const missing = STICKERS.filter(
      (name) => !existsSync(join(PUBLIC, "womans-day", "stickers", `${name}.webp`))
    );
    expect(missing).toEqual([]);
  });

  test("the manifest has no duplicate entries", () => {
    expect(WOMANS_DAY_IMAGES.length).toBe(new Set(WOMANS_DAY_IMAGES).size);
  });

  test("the florist-first tier is a subset of the manifest (no duplicates)", () => {
    const manifest = new Set(WOMANS_DAY_IMAGES);
    const tier = floristImages();
    expect(tier.length).toBe(new Set(tier).size);
    expect(tier.filter((src) => !manifest.has(src))).toEqual([]);
  });

  test("the manifest lists every art file that exists (no orphan we forgot to preload)", () => {
    const artDir = join(PUBLIC, "womans-day");
    const onDisk = walk(artDir)
      .filter((f) => /\.(webp|jpg|png)$/.test(f))
      .map((f) => "/" + relative(PUBLIC, f).replace(/\\/g, "/"))
      // Excluded on purpose: the OG social card (referenced from route metadata, not an
      // in-page image). The parcel's unused `flap`/`tape` pieces were removed (Plan 8 §5).
      .filter((f) => !/\/og\.jpg$/.test(f));
    const manifest = new Set(WOMANS_DAY_IMAGES);
    const orphans = onDisk.filter((f) => !manifest.has(f));
    expect(orphans).toEqual([]);
  });
});
