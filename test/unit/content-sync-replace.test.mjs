/**
 * @file The content sync replaces a world document's system rather than merging into it (#163).
 * @see module/migration/runner.mjs#syncContent
 *
 * `reconcileItems` builds each item's whole `system` and `syncContent` writes it.
 * Foundry's update is recursive unless told otherwise, so the new system was
 * merged into the old one and a key the pack had removed survived: on a live
 * board Xiuhcoatl kept `targeting.anchor.range: 2` after her content dropped it.
 * The sync is never run by the suite, so this reads the two writes it makes.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync("module/migration/runner.mjs", "utf8").replaceAll("\r\n", "\n");
const body = source.slice(source.indexOf("export async function syncContent"));

describe("syncContent writes", () => {
  it("replaces an actor's system", () => {
    expect(body).toMatch(/actor\.update\(\{ system \}, \{ diff: false, recursive: false \}\)/);
  });

  it("replaces each refreshed item's system", () => {
    expect(body).toMatch(/updateEmbeddedDocuments\("Item", refreshed, \{ diff: false, recursive: false \}\)/);
  });
});

// A key the pack omits and the DataModel stores as `null` is not a change: the
// replace writes the pack's shape and the model fills the null straight back, so
// four Semiramis actors resynced on every load (2026-10-02).
describe("syncContent's comparison", async () => {
  const { same } = await import("../../module/migration/runner.mjs");

  it("treats a missing key and a null one as the same", () => {
    expect(same({ mode: "fixed", element: null }, { mode: "fixed" })).toBe(true);
    expect(same({ mode: "fixed" }, { mode: "fixed", shape: null })).toBe(true);
  });

  it("still sees a key the pack removed that holds a value", () => {
    expect(same({ anchor: { kind: "withinRange", range: 2 } }, { anchor: { kind: "withinRange" } })).toBe(false);
  });
});
