/**
 * @file The round-boundary desync detector.
 * @see docs/25-turn-system.md §25.10
 */

import { describe, it, expect } from "vitest";
import { boardChecksum, compareChecksums } from "../../module/rules/desync.mjs";

const unit = (over = {}) => ({
  id: "karna", panel: { i: 3, j: 4 }, health: { value: 900 }, effects: ["burn"], ...over,
});

describe("boardChecksum", () => {
  it("is stable for the same board", () => {
    expect(boardChecksum({ units: [unit()] })).toBe(boardChecksum({ units: [unit()] }));
  });

  it("does not depend on the order units arrive in", () => {
    // Two clients enumerate tokens in whatever order the canvas gives them, so
    // an order-sensitive checksum would report a desync on every board.
    const a = { units: [unit({ id: "a" }), unit({ id: "b" })] };
    const b = { units: [unit({ id: "b" }), unit({ id: "a" })] };

    expect(boardChecksum(a)).toBe(boardChecksum(b));
  });

  it("changes when a unit moves", () => {
    expect(boardChecksum({ units: [unit()] }))
      .not.toBe(boardChecksum({ units: [unit({ panel: { i: 3, j: 5 } })] }));
  });

  it("changes when health changes", () => {
    expect(boardChecksum({ units: [unit()] }))
      .not.toBe(boardChecksum({ units: [unit({ health: { value: 800 } })] }));
  });

  it("changes when an effect is added", () => {
    expect(boardChecksum({ units: [unit()] }))
      .not.toBe(boardChecksum({ units: [unit({ effects: ["burn", "stun"] })] }));
  });

  it("does NOT depend on effect order", () => {
    // Effects arrive in creation order, which differs per client when two are
    // applied in one batch. That is not a desync.
    expect(boardChecksum({ units: [unit({ effects: ["burn", "stun"] })] }))
      .toBe(boardChecksum({ units: [unit({ effects: ["stun", "burn"] })] }));
  });

  it("ignores fields that legitimately differ between clients", () => {
    // §25.10 checksums positions, health and effect ids -- and nothing else.
    // A cached snapshot or a local UI flag differing is not a desync, and
    // including one would make the detector cry wolf until it was ignored.
    expect(boardChecksum({ units: [unit({ _hover: true, snapshotVersion: 12 })] }))
      .toBe(boardChecksum({ units: [unit()] }));
  });

  it("handles an empty board", () => {
    expect(typeof boardChecksum({ units: [] })).toBe("string");
  });

  it("handles a unit with null health, which is undamageable rather than zero", () => {
    expect(() => boardChecksum({ units: [unit({ health: null })] })).not.toThrow();
  });
});

describe("compareChecksums", () => {
  it("agrees when they match", () => {
    expect(compareChecksums("abc", "abc")).toMatchObject({ agreed: true });
  });

  it("reports a disagreement", () => {
    expect(compareChecksums("abc", "def")).toMatchObject({ agreed: false, shouldRefresh: true });
  });

  it("does not report a disagreement when the GM sent nothing", () => {
    // A missing broadcast is not evidence of drift, and refreshing on one would
    // make every reconnect look like a desync.
    expect(compareChecksums(null, "def")).toMatchObject({ agreed: true });
  });
});
