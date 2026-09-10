/**
 * @file Reconciling a world document against its pack document.
 * @see module/migration/content-sync.mjs, docs/39-migration-and-versioning.md
 *
 * The compendium is the whole source of truth (spec R1) -- but a world copy
 * holds what the match has written to it, and a sync that overwrites that is a
 * corrupted match rather than an update. Fourteen Masters held a Magic Crest
 * without its Round gate for a whole day because nothing did this at all.
 */

import { describe, it, expect } from "vitest";
import {
  reconcileSystem, reconcileItems, PROVENANCE_KEYS,
} from "../../module/migration/content-sync.mjs";

describe("reconcileSystem", () => {
  it("takes an authored field from the pack", () => {
    const world = { contentId: "ozymandias", mov: 5 };
    const pack = { contentId: "ozymandias", mov: 6 };
    expect(reconcileSystem("actor", world, pack).mov).toBe(6);
  });

  it("leaves a field the pack does not name", () => {
    // Health, contracts, positions: not authored, so not the pack's business.
    const world = { contentId: "ozymandias", health: { value: 400, max: 1000 }, masterId: "m1" };
    const out = reconcileSystem("actor", world, { contentId: "ozymandias" });
    expect(out.health).toEqual({ value: 400, max: 1000 });
    expect(out.masterId).toBe("m1");
  });

  it("leaves a SEEDED field even though the pack states one", () => {
    // Resources are authored as a starting value and spent during play.
    const world = { contentId: "emiya", resources: { aria: 2 } };
    const pack = { contentId: "emiya", resources: { aria: 0 } };
    expect(reconcileSystem("actor", world, pack).resources).toEqual({ aria: 2 });
  });

  it("splits cooldown between the pack and the world", () => {
    const world = { contentId: "x", cooldown: { max: "3◈", remaining: 4, regen: 1, gatedDelay: 5 } };
    const pack = { contentId: "x", cooldown: { max: "7◈", remaining: 0, regen: 0, gatedDelay: 0 } };
    const out = reconcileSystem("item", world, pack).cooldown;
    expect(out.max).toBe("7◈");         // the pack's shape
    expect(out.remaining).toBe(4);      // the match's clock
    expect(out.regen).toBe(1);
    expect(out.gatedDelay).toBe(5);
  });

  it("adds an authored field the world copy never had", () => {
    // The Magic Crest case exactly: the pack gained `npGateRound` and the world
    // copy read null for a day.
    const out = reconcileSystem("item", { contentId: "crest" }, { contentId: "crest", npGateRound: 3 });
    expect(out.npGateRound).toBe(3);
  });

  it("keeps provenance with the world", () => {
    const world = { contentId: "np", copiedFrom: "emiya-hrunting", grantedBy: "wisdomOfDunScaith" };
    const out = reconcileSystem("item", world, { contentId: "np", copiedFrom: null, grantedBy: null });
    expect(out.copiedFrom).toBe("emiya-hrunting");
    expect(out.grantedBy).toBe("wisdomOfDunScaith");
  });

  it("does not mutate either input", () => {
    const world = { contentId: "x", mov: 5 };
    const pack = { contentId: "x", mov: 6 };
    reconcileSystem("actor", world, pack);
    expect(world.mov).toBe(5);
    expect(pack.mov).toBe(6);
  });
});

describe("reconcileItems", () => {
  const item = (contentId, over = {}) => ({ _id: contentId + "-id", system: { contentId, ...over } });

  it("refreshes an item both sides have", () => {
    const out = reconcileItems([item("crest")], [item("crest", { npGateRound: 3 })]);
    expect(out.update).toHaveLength(1);
    expect(out.update[0].system.npGateRound).toBe(3);
    expect(out.update[0]._id).toBe("crest-id");   // the world's id, not the pack's
  });

  it("creates an item the template gained", () => {
    const out = reconcileItems([], [item("crest")]);
    expect(out.create.map((i) => i.system.contentId)).toEqual(["crest"]);
  });

  it("removes an item the template lost", () => {
    const out = reconcileItems([item("old-skill")], []);
    expect(out.remove).toEqual(["old-skill-id"]);
  });

  it("NEVER removes an item granted during play", () => {
    // Wisdom of Dún Scáith copies a Noble Phantasm onto its caster. A content
    // update has no business sweeping it.
    const copied = item("emiya-hrunting", { copiedFrom: "emiya", grantedBy: "wisdomOfDunScaith" });
    const out = reconcileItems([copied], []);
    expect(out.remove).toEqual([]);
    expect(out.kept).toEqual(["emiya-hrunting-id"]);
  });

  it("leaves an item with no contentId alone", () => {
    // Hand-made items are the GM's, not the pack's.
    const homemade = { _id: "hand-1", system: {} };
    const out = reconcileItems([homemade], []);
    expect(out.remove).toEqual([]);
    expect(out.kept).toEqual(["hand-1"]);
  });
});

describe("PROVENANCE_KEYS", () => {
  it("is the pair that marks a runtime grant", () => {
    expect(PROVENANCE_KEYS).toEqual(["copiedFrom", "grantedBy"]);
  });
});
