import { describe, expect, test } from "bun:test";

import { FLOWERS } from "@/lib/womansDay/flowers";
import {
  FALLBACK_NAME,
  MAX_NAME_LENGTH,
  displayNameFor,
  flowerIndexForName,
  hashTag,
  nameHash,
  normalizeName,
  sanitizeName,
} from "@/lib/womansDay/flowerHash";

describe("normalizeName", () => {
  test("trims and collapses whitespace", () => {
    expect(normalizeName("  Minh   Anh \n")).toBe("Minh Anh");
  });

  test("normalizes to NFC", () => {
    const decomposed = "Nguye\u0302\u0303n";
    expect(normalizeName(decomposed)).toBe("Nguyễn");
  });
});

describe("sanitizeName", () => {
  test("strips control and bidi characters", () => {
    expect(sanitizeName("La\u0000n\u202E")).toBe("Lan");
  });

  test("caps at the label length", () => {
    expect(Array.from(sanitizeName("A".repeat(120))).length).toBe(MAX_NAME_LENGTH);
  });

  test("empty or punctuation-only input survives", () => {
    expect(sanitizeName("   ")).toBe("");
    expect(sanitizeName(null)).toBe("");
  });
});

describe("flowerIndexForName", () => {
  test("is stable across calls", () => {
    expect(flowerIndexForName("Lan")).toBe(flowerIndexForName("Lan"));
    expect(nameHash("Lan")).toBe(nameHash("Lan"));
  });

  test("case, surrounding space and canonical normalization do not change the flower", () => {
    expect(flowerIndexForName("Nguyễn Thu Hà")).toBe(flowerIndexForName("  nguyễn thu hà  "));
    expect(flowerIndexForName("Nguyễn Thu Hà")).toBe(
      flowerIndexForName("Nguye\u0302\u0303n Thu Hà")
    );
  });

  test("an empty label falls back to Scholar", () => {
    expect(flowerIndexForName("")).toBe(flowerIndexForName(FALLBACK_NAME));
    expect(displayNameFor("   ")).toBe(FALLBACK_NAME);
  });

  test("always lands inside the species table", () => {
    const names = ["", "A", "Lan", "Minh Anh", "Trần Bảo Ngọc", "Zoë", "123", "李"];
    for (const name of names) {
      const index = flowerIndexForName(name);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(FLOWERS.length);
    }
  });

  test("snapshot: known names pick a flower (changing this changes real plates)", () => {
    expect(
      ["Lan", "Minh Anh", "Nguyễn Thu Hà", "Scholar", "Rose"].map((name) => [
        name,
        FLOWERS[flowerIndexForName(name)].id,
      ])
    ).toEqual([
      ["Lan", "peony"],
      ["Minh Anh", "lily"],
      ["Nguyễn Thu Hà", "lily"],
      ["Scholar", "daisy"],
      ["Rose", "camellia"],
    ]);
  });
});

describe("hashTag", () => {
  test("is six uppercase hex characters", () => {
    expect(hashTag("Lan")).toMatch(/^[0-9A-F]{6}$/);
  });
});
