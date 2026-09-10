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

  it("removes an item content has forgotten entirely", () => {
    // Not in the template AND in no pack: a rename left it behind.
    const out = reconcileItems([item("old-skill")], [], { knownContentIds: new Set() });
    expect(out.remove).toEqual(["old-skill-id"]);
  });

  it("NEVER removes an item that is still real content", () => {
    // `semiramis-poison` is an ability Semiramis MAKES with Item Construction.
    // It is on no actor template and carries neither `copiedFrom` nor
    // `grantedBy`, so the provenance check alone would have swept every Poison
    // she had crafted -- found by the first live dry run, not by reasoning.
    const crafted = item("semiramis-poison", { quantity: 3 });
    const out = reconcileItems([crafted], [], {
      knownContentIds: new Set(["semiramis-poison"]),
    });
    expect(out.remove).toEqual([]);
    expect(out.kept).toEqual(["semiramis-poison-id"]);
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

describe("the summonVariant split", () => {
  it("takes the two forms from the pack and the flip from the world", () => {
    // SM Semiramis had come up `dsc`. The pack states heads and tails; which
    // one the coin landed on is the match's, and re-flipping a summon already
    // on the board is not a content update.
    const world = { contentId: "sm", summonVariant: { heads: { id: "old" }, tails: { id: "noDsc" }, variant: "dsc" } };
    const pack = { contentId: "sm", summonVariant: { heads: { id: "dsc" }, tails: { id: "noDsc" } } };
    const out = reconcileSystem("actor", world, pack).summonVariant;
    expect(out.heads).toEqual({ id: "dsc" });   // the pack's shape
    expect(out.variant).toBe("dsc");            // the match's flip
  });
});

describe("a document's type", () => {
  it("leaves a Master's rolled stats alone", () => {
    // war-setup rolls these onto a blank template. The live world held rank C
    // and zon 4 against a template of "" and 2.
    const world = { contentId: "master", rank: "C", zon: 4, baseAttack: { str: 50, mag: 125 } };
    const pack = { contentId: "master", rank: "", zon: 2, baseAttack: { str: 50, mag: 100 } };
    const out = reconcileSystem("actor", world, pack, { type: "master" });
    expect(out.rank).toBe("C");
    expect(out.zon).toBe(4);
    expect(out.baseAttack.mag).toBe(125);
  });

  it("still updates a Servant's rank from the pack", () => {
    const out = reconcileSystem("actor", { contentId: "s", rank: "C" }, { contentId: "s", rank: "A" }, { type: "servant" });
    expect(out.rank).toBe("A");
  });
});

describe("fields the engine writes during play", () => {
  it("keeps a summon pointed at its summoner", () => {
    const world = { contentId: "sphinx", summonerId: "ha6OpDqFBWndMfZp" };
    const out = reconcileSystem("actor", world, { contentId: "sphinx", summonerId: null });
    expect(out.summonerId).toBe("ha6OpDqFBWndMfZp");
  });

  it("keeps a revealed Servant revealed, and her war's class slot", () => {
    const world = { contentId: "medusa", identityRevealed: true, classContainer: "saber" };
    const pack = { contentId: "medusa", identityRevealed: false, classContainer: "rider" };
    const out = reconcileSystem("actor", world, pack);
    expect(out.identityRevealed).toBe(true);
    expect(out.classContainer).toBe("saber");
  });
});
