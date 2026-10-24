import { describe, expect, test } from "bun:test";

import type { BouquetItem } from "@/lib/womansDay/bouquetSlots";
import {
  GIFT_CODE_PARAM,
  MAX_GIFT_CODE_LENGTH,
  buildGiftUrl,
  decodeBouquet,
  encodeBouquet,
  readGift,
  type BouquetState,
} from "@/lib/womansDay/giftLink";
import type { FillerId, FlowerId } from "@/lib/womansDay/flowers";

function bouquet(overrides: Partial<BouquetState> = {}): BouquetState {
  const items: BouquetItem[] = [
    { key: "a", id: "lotus", slot: 0 },
    { key: "b", id: "rose", slot: 1 },
    { key: "c", id: "peony", slot: 2 },
  ];
  return { items, fillers: ["fern"], wrap: "blush", ribbon: "cream", ...overrides };
}

function codeWith(payload: unknown): string {
  return btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

describe("encodeBouquet / decodeBouquet", () => {
  test("round-trips flowers, greenery, wrap and ribbon", () => {
    const state = bouquet();
    const decoded = decodeBouquet(encodeBouquet(state));
    expect(decoded).toEqual({
      s: ["lotus", "rose", "peony"],
      f: ["fern"],
      w: "blush",
      r: "cream",
      o: [
        { dx: 0, dy: 0, rot: 0 },
        { dx: 0, dy: 0, rot: 0 },
        { dx: 0, dy: 0, rot: 0 },
      ],
    });
  });

  test("produces URL-safe characters only and stays short", () => {
    const code = encodeBouquet(bouquet());
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(code.length).toBeLessThan(MAX_GIFT_CODE_LENGTH);
  });

  test("caps flowers at nine and greenery at five", () => {
    const items: BouquetItem[] = Array.from({ length: 14 }, (_, index) => ({
      key: `k${index}`,
      id: (["lotus", "rose", "peony"] as FlowerId[])[index % 3],
      slot: index % 9,
    }));
    const fillers: FillerId[] = Array.from({ length: 9 }, () => "fern");
    const decoded = decodeBouquet(encodeBouquet(bouquet({ items, fillers })));
    expect(decoded?.s).toHaveLength(9);
    expect(decoded?.f).toHaveLength(5);
  });

  test("reads a v1 code, sorting fillers out of the stems list", () => {
    const decoded = decodeBouquet(
      codeWith({ v: 1, s: ["lotus", "fern", "rose"], w: "kraft", r: "red" })
    );
    expect(decoded).toEqual({
      s: ["lotus", "rose"],
      f: ["fern"],
      w: "kraft",
      r: "red",
      o: [],
    });
  });

  test("rejects junk, unknown versions and unknown species", () => {
    expect(decodeBouquet(null)).toBeNull();
    expect(decodeBouquet("")).toBeNull();
    expect(decodeBouquet("not base64 !!")).toBeNull();
    expect(decodeBouquet(codeWith({ v: 4, s: [], w: "kraft", r: "red" }))).toBeNull();
    expect(
      decodeBouquet(codeWith({ v: 2, s: ["sunflower", "nope"], f: [], w: "kraft", r: "red" }))
    ).toBeNull();
    expect(decodeBouquet(codeWith({ v: 2, s: [], f: ["lotus"], w: "kraft", r: "red" }))).toBeNull();
    expect(decodeBouquet(codeWith({ v: 2, s: [], f: [], w: "velvet", r: "red" }))).toBeNull();
    expect(decodeBouquet(codeWith({ v: 2, s: [], f: [], w: "kraft", r: "neon" }))).toBeNull();
    expect(decodeBouquet(codeWith({ v: 2, s: "lotus", f: [], w: "kraft", r: "red" }))).toBeNull();
  });

  test("v3 round-trips manual head offsets", () => {
    const items: BouquetItem[] = [
      { key: "a", id: "lotus", slot: 0 },
      { key: "b", id: "rose", slot: 1, dx: 4, dy: -3, rot: 12 },
      { key: "c", id: "peony", slot: 2, rot: -8 },
    ];
    const decoded = decodeBouquet(encodeBouquet(bouquet({ items })));
    expect(decoded?.o).toEqual([
      { dx: 0, dy: 0, rot: 0 },
      { dx: 4, dy: -3, rot: 12 },
      { dx: 0, dy: 0, rot: -8 },
    ]);
  });

  test("a plain bouquet still encodes without the `o` array", () => {
    const raw = JSON.parse(
      atob(
        encodeBouquet(bouquet())
          .replace(/-/g, "+")
          .replace(/_/g, "/")
          .padEnd(Math.ceil(encodeBouquet(bouquet()).length / 4) * 4, "=")
      )
    );
    expect(raw.o).toBeUndefined();
    expect(raw.v).toBe(3);
  });

  test("clamps malformed v3 offsets and degrades to zero rather than rejecting", () => {
    const decoded = decodeBouquet(
      codeWith({ v: 3, s: ["lotus", "rose"], w: "kraft", r: "red", o: [[999, "x"], null] })
    );
    expect(decoded?.s).toEqual(["lotus", "rose"]);
    // 999 is clamped to the x range; a missing entry becomes zero.
    expect(Math.abs(decoded?.o[0].dx ?? 0)).toBeLessThanOrEqual(42);
    expect(decoded?.o[1]).toEqual({ dx: 0, dy: 0, rot: 0 });
  });

  test("rejects an oversized code before parsing it", () => {
    expect(decodeBouquet("A".repeat(MAX_GIFT_CODE_LENGTH + 1))).toBeNull();
  });

  test("accepts an empty bouquet (just a wrapped bunch of greenery)", () => {
    expect(decodeBouquet(encodeBouquet(bouquet({ items: [], fillers: [] })))).toEqual({
      s: [],
      f: [],
      w: "blush",
      r: "cream",
      o: [],
    });
  });
});

describe("buildGiftUrl / readGift", () => {
  test("round-trips through a URL", () => {
    const url = new URL(buildGiftUrl("https://learn.ronansat.com", "Nguyễn Thu Hà", bouquet()));
    expect(url.pathname).toBe("/womans-day");
    expect(url.searchParams.get("to")).toBe("Nguyễn Thu Hà");

    const gift = readGift(Object.fromEntries(url.searchParams));
    expect(gift.to).toBe("Nguyễn Thu Hà");
    expect(gift.bouquet).toEqual({
      stems: ["lotus", "rose", "peony"],
      fillers: ["fern"],
      wrap: "blush",
      ribbon: "cream",
      offsets: [
        { dx: 0, dy: 0, rot: 0 },
        { dx: 0, dy: 0, rot: 0 },
        { dx: 0, dy: 0, rot: 0 },
      ],
    });
  });

  test("sanitises the recipient name and drops control characters", () => {
    const gift = readGift({ to: ["  La\u0000n  "], [GIFT_CODE_PARAM]: encodeBouquet(bouquet()) });
    expect(gift.to).toBe("Lan");
  });

  test("ignores an invalid code but keeps the name", () => {
    const gift = readGift({ to: "Minh Anh", [GIFT_CODE_PARAM]: "garbage" });
    expect(gift.to).toBe("Minh Anh");
    expect(gift.bouquet).toBeNull();
  });

  test("no params means no gift", () => {
    expect(readGift({})).toEqual({ to: null, bouquet: null });
  });

  test("never emits an empty name param", () => {
    const url = new URL(buildGiftUrl("https://learn.ronansat.com", "   ", bouquet()));
    expect(url.searchParams.has("to")).toBe(false);
  });
});
