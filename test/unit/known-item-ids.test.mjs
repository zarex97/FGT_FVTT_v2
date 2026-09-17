/**
 * @file The protected set content sync checks before deleting a world item.
 * @see module/migration/runner.mjs, module/migration/content-sync.mjs
 *
 * `reconcileItems`'s own parameter doc calls this "every contentId any pack
 * defines" -- not "any FGT pack". A third-party module's Item pack satisfied
 * neither the template check nor the old `packageName === "fgt"` filter, so
 * its items would be silently deleted on every sync (#25).
 */

import { describe, it, expect } from "vitest";
import { loadKnownItemIds } from "../../module/migration/runner.mjs";

const pack = (packageName, documentName, entries) => ({
  metadata: { packageName },
  documentName,
  getIndex: async () => entries,
});

describe("loadKnownItemIds (#25)", () => {
  it("protects a contentId defined by a non-fgt module's Item pack", async () => {
    globalThis.game = {
      packs: [pack("some-other-module", "Item", [{ system: { contentId: "borrowed-ability" } }])],
    };

    expect(await loadKnownItemIds()).toEqual(new Set(["borrowed-ability"]));
  });

  it("still protects a contentId defined by an fgt pack", async () => {
    globalThis.game = {
      packs: [pack("fgt", "Item", [{ system: { contentId: "semiramis-poison" } }])],
    };

    expect(await loadKnownItemIds()).toEqual(new Set(["semiramis-poison"]));
  });

  it("ignores non-Item packs regardless of owning package", async () => {
    globalThis.game = {
      packs: [pack("some-other-module", "Actor", [{ system: { contentId: "not-an-item" } }])],
    };

    expect(await loadKnownItemIds()).toEqual(new Set());
  });

  it("ignores an index entry with no contentId", async () => {
    globalThis.game = {
      packs: [pack("some-other-module", "Item", [{ system: {} }])],
    };

    expect(await loadKnownItemIds()).toEqual(new Set());
  });
});
