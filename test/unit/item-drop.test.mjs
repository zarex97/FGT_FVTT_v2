/**
 * @file An Item Pale Rider cannot hold is left on the floor (#180, readings 12).
 * @see module/rules/items.mjs, module/engine/items.mjs#giveItem,
 *   module/engine/applier.mjs (itemGrant), module/engine/io.mjs#dropItem
 *
 * Ruled 2026-10-04: handed to him with his Master farther than 2 panels away,
 * the hand-over happens and the Item lands on the GIVER's panel; granted with
 * no giver, on his own; a ground Item he walks onto stays where it lies. The
 * giver spends the hand-over. A ground Item is taken by moving onto its panel,
 * every Item lying there is taken, and a stack lands and is taken whole.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { acquisitionTarget, itemPickupIntents } from "../../module/rules/items.mjs";

const at = (i, j) => ({ i, j });
const rider = { id: "pr", kind: "servant", panel: at(5, 5), masterId: "m", cannotHoldItems: true, itemHandling: "redirectToMaster" };
const far = { id: "m", kind: "master", panel: at(5, 12) };
const cache = (id, contentId, count, panel = at(5, 5)) => ({ id, kind: "structure", panel, carriesItemId: contentId, carriesItemCount: count, carriesItem: { contentId, barredFrom: null } });

describe("a refusal to hold", () => {
  it("says the Item is left on the floor", () => {
    expect(acquisitionTarget(rider, { units: [rider, far] })).toEqual({ ok: false, reason: "cannotHoldItems", leftOnFloor: true });
  });
});

describe("walking onto ground Items", () => {
  const walker = { id: "q", kind: "servant", panel: at(5, 5) };

  it("takes every Item lying there, each whole", () => {
    const out = itemPickupIntents(walker, { units: [walker, cache("c1", "potion", 3), cache("c2", "vorpal-blade", 1)] });
    expect(out.filter((d) => d.kind === "itemGrant").map((d) => [d.contentId, d.delta])).toEqual([["potion", 3], ["vorpal-blade", 1]]);
    expect(out.filter((d) => d.kind === "dismiss").map((d) => d.unitId)).toEqual(["c1", "c2"]);
  });

  it("leaves them where they lie for Pale Rider with his Master away", () => {
    expect(itemPickupIntents(rider, { units: [rider, far, cache("c1", "potion", 3)] })).toEqual([]);
  });
});

describe("the hand-over and the grant", () => {
  it("drops a hand-over on the giver's panel and spends the giver's allowance", () => {
    const src = readFileSync("module/engine/items.mjs", "utf8");
    expect(src).toMatch(/const onFloor = !destination\.ok && Boolean\(destination\.leftOnFloor\);/);
    expect(src).toMatch(/if \(onFloor\) \{\s*for \(const d of descriptors\) if \(d\.kind === "itemGrant"\) d\.dropAt = from\.panel;/);
    expect(src).toMatch(/intents\.push\(I\.markTurn\(fromId, \{ itemTransfers:/);
  });

  it("drops a grant at dropAt, or on his own panel when nobody gave it", () => {
    const src = readFileSync("module/engine/applier.mjs", "utf8");
    expect(src).toMatch(/if \(!to\.ok && to\.leftOnFloor\) \{[\s\S]*?await io\.dropItem\?\.\(i\.contentId, i\.delta, i\.dropAt \?\? holder\?\.panel \?\? null/);
  });

  it("is placed as the dropped-item structure, with its count", () => {
    const io = readFileSync("module/engine/io.mjs", "utf8");
    expect(io).toMatch(/carriesItemCount: Math\.max\(1, count \?\? 1\)/);
    expect(readFileSync("packs/_source/structures/dropped-item.yml", "utf8")).toMatch(/^id: dropped-item$/m);
  });
});
