import { describe, expect, test } from "bun:test";

import {
  bouquetFromStems,
  bouquetReducer,
  createBouquet,
  parseBouquet,
  serializeBouquet,
} from "@/lib/womansDay/bouquetState";
import { MAX_BOUQUET, MAX_FILLERS } from "@/lib/womansDay/bouquetSlots";

describe("bouquetReducer", () => {
  test("adds flowers into the next free slot", () => {
    let state = createBouquet(["lotus"]);
    state = bouquetReducer(state, { type: "add", id: "rose", key: "r1" });
    state = bouquetReducer(state, { type: "add", id: "peony", key: "p1" });
    expect(state.items.map((item) => [item.id, item.slot])).toEqual([
      ["lotus", 0],
      ["rose", 1],
      ["peony", 2],
    ]);
  });

  test("adds greenery to the filler list, never taking a flower slot", () => {
    let state = createBouquet(["lotus"]);
    state = bouquetReducer(state, { type: "addFiller", id: "eucalyptus" });
    state = bouquetReducer(state, { type: "addFiller", id: "fern" });
    expect(state.items.map((item) => item.id)).toEqual(["lotus"]);
    expect(state.fillers).toEqual(["eucalyptus", "fern"]);
  });

  test("caps flowers at nine and greenery at the filler count", () => {
    let state = createBouquet();
    for (let index = 0; index < 14; index += 1) {
      state = bouquetReducer(state, { type: "add", id: "rose", key: `k${index}` });
    }
    expect(state.items).toHaveLength(MAX_BOUQUET);

    for (let index = 0; index < 9; index += 1) {
      state = bouquetReducer(state, { type: "addFiller", id: "fern" });
    }
    expect(state.fillers).toHaveLength(MAX_FILLERS);
  });

  test("removes a filler by index", () => {
    let state = createBouquet([], ["fern", "eucalyptus", "babys-breath"]);
    state = bouquetReducer(state, { type: "removeFiller", index: 1 });
    expect(state.fillers).toEqual(["fern", "babys-breath"]);
  });

  test("removes flowers by key, keeps other stems", () => {
    let state = createBouquet(["lotus", "rose"]);
    state = bouquetReducer(state, { type: "remove", key: "lotus-gift-0" });
    expect(state.items.map((item) => item.id)).toEqual(["rose"]);
  });

  test("clear empties both flowers and greenery", () => {
    const state = bouquetReducer(createBouquet(["lotus", "rose"], ["fern"]), { type: "clear" });
    expect(state.items).toEqual([]);
    expect(state.fillers).toEqual([]);
  });

  test("wrap and ribbon are independent of the stems", () => {
    const state = bouquetReducer(createBouquet(["lotus"]), { type: "wrap", id: "sage" });
    expect(state.wrap).toBe("sage");
    expect(state.items).toHaveLength(1);
  });
});

describe("rearrange keeps the centre flower fixed", () => {
  test("slot 0 (the reader's hashed flower) stays in the centre", () => {
    let state = createBouquet(["lotus", "rose", "peony", "daisy"]);
    const centreKey = state.items.find((item) => item.slot === 0)?.key;
    for (let press = 0; press < 6; press += 1) {
      state = bouquetReducer(state, { type: "shuffle" });
      expect(state.items.find((item) => item.key === centreKey)?.slot).toBe(0);
      expect(state.items.filter((item) => item.slot === 0)).toHaveLength(1);
    }
  });

  test("re-deals the surrounding stems among slots 1..n-1 without loss", () => {
    const state = createBouquet(["lotus", "rose", "peony", "daisy"]);
    const shuffled = bouquetReducer(state, { type: "shuffle" });
    expect(shuffled.items).toHaveLength(4);
    expect(new Set(shuffled.items.map((item) => item.slot))).toEqual(new Set([0, 1, 2, 3]));
    expect(shuffled.items.map((item) => item.slot)).not.toEqual([0, 1, 2, 3]);
  });

  test("nothing moves with fewer than three stems", () => {
    const state = createBouquet(["lotus", "rose"]);
    expect(bouquetReducer(state, { type: "shuffle" }).items).toEqual(state.items);
  });
});

describe("gift stems", () => {
  test("arrive in slot order", () => {
    expect(bouquetFromStems(["rose", "peony", "lotus"]).map((item) => item.slot)).toEqual([
      0, 1, 2,
    ]);
  });

  test("are capped at nine", () => {
    expect(bouquetFromStems(Array.from({ length: 12 }, () => "lotus" as const))).toHaveLength(9);
  });
});

describe("parseBouquet", () => {
  test("round-trips a saved bouquet", () => {
    const state = bouquetReducer(createBouquet(["lotus"], ["fern"]), { type: "wrap", id: "linen" });
    expect(parseBouquet(serializeBouquet(state))).toEqual(state);
  });

  test("drops invalid stems, duplicate slots and unknown colours", () => {
    const parsed = parseBouquet(
      JSON.stringify({
        items: [
          { key: "a", id: "lotus", slot: 0 },
          { key: "b", id: "not-a-flower", slot: 1 },
          { key: "c", id: "rose", slot: 0 },
          { key: "d", id: "daisy", slot: 99 },
        ],
        wrap: "velvet",
        ribbon: "neon",
      })
    );
    expect(parsed?.items).toEqual([{ key: "a", id: "lotus", slot: 0 }]);
    expect(parsed?.fillers).toEqual([]);
    expect(parsed?.wrap).toBe("kraft");
    expect(parsed?.ribbon).toBe("blush");
  });

  test("migrates a v1 bouquet that stored fillers among the flowers", () => {
    const parsed = parseBouquet(
      JSON.stringify({
        items: [
          { key: "a", id: "lotus", slot: 0 },
          { key: "b", id: "eucalyptus", slot: 1 },
          { key: "c", id: "fern", slot: 2 },
        ],
        wrap: "sage",
        ribbon: "red",
      })
    );
    expect(parsed?.items.map((item) => item.id)).toEqual(["lotus"]);
    expect(parsed?.fillers).toEqual(["eucalyptus", "fern"]);
  });

  test("reads the new fillers array and caps it", () => {
    const parsed = parseBouquet(
      JSON.stringify({
        items: [],
        fillers: ["fern", "fern", "fern", "fern", "fern", "fern", "fern"],
        wrap: "kraft",
        ribbon: "blush",
      })
    );
    expect(parsed?.fillers).toHaveLength(MAX_FILLERS);
  });

  test("junk returns null instead of throwing", () => {
    expect(parseBouquet(null)).toBeNull();
    expect(parseBouquet("{")).toBeNull();
    expect(parseBouquet("null")).toBeNull();
    expect(parseBouquet("42")).toBeNull();
  });
});
