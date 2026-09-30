/**
 * @file Reconciling a world document against its pack document.
 * @see module/migration/content-sync.mjs, docs/41-migration.md
 *
 * The compendium is the whole source of truth (spec R1) -- but a world copy
 * holds what the match has written to it, and a sync that overwrites that is a
 * corrupted match rather than an update. Fourteen Masters held a Magic Crest
 * without its Round gate for a whole day because nothing did this at all.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import {
  reconcileSystem, reconcileItems, PROVENANCE_KEYS,
} from "../../module/migration/content-sync.mjs";
import { ownedByWorld } from "../../module/content/authored-fields.mjs";

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
    expect(PROVENANCE_KEYS).toEqual(["copiedFrom", "grantedBy", "inheritedFrom"]);
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

  it("re-applies the flipped branch's overrides over the pack's sheet", () => {
    // Ch. 46 §46.4-AA. Keeping `variant` is only half of keeping the flip:
    // `engine/summon.mjs#sheetPatch` merges the branch's `overrides` onto
    // TOP-LEVEL keys, and those keys are the pack's. So the flip survived every
    // reload and its whole consequence did not -- a `dsc` Semiramis loaded with
    // `self:variant:dsc` still true and the un-varianted Range, Sustainability
    // and normal attack of the sheet she is not.
    const world = {
      contentId: "sm", variant: "dsc",
      range: { panels: 3, targets: 1 }, sustainability: "4◈",
      summonVariant: { variant: "dsc" },
    };
    const pack = {
      contentId: "sm",
      range: { panels: 2, targets: 1 }, sustainability: "2◈", mov: 6,
      summonVariant: {
        heads: { id: "dsc", overrides: { range: { panels: 3, targets: 1 }, sustainability: "4◈" } },
        tails: { id: "noDsc" },
      },
    };
    const out = reconcileSystem("actor", world, pack);
    expect(out.range).toEqual({ panels: 3, targets: 1 });
    expect(out.sustainability).toBe("4◈");
    // ...and everything the branch does NOT override still comes from the pack.
    expect(out.mov).toBe(6);
  });

  it("takes an EDITED override from the pack, not the world's baked copy", () => {
    // The branch spec is read from the PACK, so that editing what a variant
    // does is still a content update that reaches a summon already on a board.
    const world = { contentId: "sm", variant: "dsc", range: { panels: 3 }, summonVariant: { variant: "dsc" } };
    const pack = {
      contentId: "sm", range: { panels: 2 },
      summonVariant: { heads: { id: "dsc", overrides: { range: { panels: 4 } } }, tails: { id: "noDsc" } },
    };
    expect(reconcileSystem("actor", world, pack).range).toEqual({ panels: 4 });
  });

  it("leaves a Servant who never flipped entirely to the pack", () => {
    const world = { contentId: "heracles", range: { panels: 3 } };
    const pack = { contentId: "heracles", range: { panels: 1 } };
    expect(reconcileSystem("actor", world, pack).range).toEqual({ panels: 1 });
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

describe("linkedGroup is half the pack's and half the world's", () => {
  it("keeps the memberIds a summon resolved, and takes the settings from the pack", () => {
    // Found on a live board: adding `linkedGroup` to the authored keys made the
    // PACK own all of it, so a rebuild overwrote the resolved actor ids with
    // the pack's empty set -- silently unlinking a pair already standing on the
    // board. No leash, no linked death, no shared cooldown, no combined NP.
    const packSide = {
      linkedGroup: {
        id: "dioscuri", partners: ["pollux"], memberIds: [],
        leash: 2, unitWeight: 0.5, linkedDeath: "ignoresRevival",
      },
    };
    const worldSide = {
      linkedGroup: {
        id: "dioscuri", partners: ["pollux"], memberIds: ["bM8tTwckqwtj7z24"],
        leash: 99, unitWeight: 99, linkedDeath: "",
      },
    };
    const merged = reconcileSystem("actor", worldSide, packSide, { type: "servant" });
    expect(merged.linkedGroup.memberIds).toEqual(["bM8tTwckqwtj7z24"]);
    // The settings still follow the pack, so a content fix reaches the board.
    expect(merged.linkedGroup.leash).toBe(2);
    expect(merged.linkedGroup.unitWeight).toBe(0.5);
    expect(merged.linkedGroup.linkedDeath).toBe("ignoresRevival");
  });
});

// #109. Found live: Scales of the Sacred Fish's pool was spent to 37 and a
// reload put it back at 200. Rho Aias's pool DECAYS by design (half of what is
// left, each use after the first), so a reload undid the decay. The garden's
// BA(MAG), which activation copies from Semiramis (250), came back as the
// pack's placeholder (200).
describe("values play writes and the pack only seeds", () => {
  it("keeps a spent barrier spent", () => {
    const out = reconcileSystem("item", { shield: { health: 1400 }, shieldHealth: 350 }, { shield: { health: 1400 }, shieldHealth: null });
    expect(out.shieldHealth).toBe(350);
    // The declared size still follows the pack.
    expect(reconcileSystem("item", { shield: { health: 1400 } }, { shield: { health: 1000 } }).shield.health).toBe(1000);
  });

  it("keeps the Hanging Gardens' BA(MAG) mirrored from its owner", () => {
    const out = reconcileSystem("actor", { baseAttack: { str: 0, mag: 250 } }, { baseAttack: { str: 0, mag: 200 } }, { type: "platform" });
    expect(out.baseAttack.mag).toBe(250);
  });
});

/**
 * The sweep #109 asked for. Every `"system.X": value` that `module/` writes is
 * a value play owns. If the pack owns X too, the next reload overwrites it.
 * Each such X is either the world's (`SEEDED_THEN_OWNED`, `SEEDED_BY_TYPE`), or
 * split, or listed here with the reason the pack's copy is still right.
 */
const PACK_WINS = {
  "item:cooldown": "split: the clock is the world's (COOLDOWN_OWNED_BY_WORLD)",
  "actor:linkedGroup": "split: memberIds are the world's (LINKED_GROUP_OWNED_BY_WORLD)",
  "item:uses": "io.mjs#consumeUse writes an ActiveEffect, which the content sync does not reconcile",
  "actor:region": "war-setup.mjs writes the Combat's region, not an actor's",
  "actor:commandSpells": "written to a Master only, and SEEDED_BY_TYPE.master owns it",
  "actor:baseAttack": "written to the Hanging Gardens only, and SEEDED_BY_TYPE.platform owns it (#109)",
  "actor:parameters": "the Glass Game rewind restores the stored grades it snapshotted, which are the pack's",
};

describe("a key play writes is not overwritten by the next reload", () => {
  const walk = (dir, out = []) => {
    for (const f of readdirSync(dir)) {
      const p = `${dir}/${f}`;
      if (statSync(p).isDirectory()) walk(p, out);
      else if (f.endsWith(".mjs")) out.push(p);
    }
    return out;
  };
  const written = new Map();
  for (const p of walk("module")) {
    const text = readFileSync(p, "utf8");
    for (const m of text.matchAll(/["'`]system\.([A-Za-z]+)[\w.]*["'`]\s*:/g)) {
      const line = text.slice(0, m.index).split(String.fromCharCode(10)).length;
      for (const kind of ["actor", "item"]) {
        if (ownedByWorld(kind, m[1])) continue;
        const key = `${kind}:${m[1]}`;
        written.set(key, [...(written.get(key) ?? []), `${p}:${line}`]);
      }
    }
  }

  it("owns every such key, or says why the pack's copy wins", () => {
    const unexplained = [...written].filter(([key]) => !PACK_WINS[key]).map(([key, at]) => `${key} written at ${at.join(", ")}`);
    expect(unexplained).toEqual([]);
  });

  it("lists no reason for a key play no longer writes", () => {
    expect(Object.keys(PACK_WINS).filter((key) => !written.has(key))).toEqual([]);
  });
});

// #104. Raikou's copies inherit her passives: `engine/summoning.mjs` copies
// each Ability onto the copy and stamps `inheritedFrom`. That is provenance --
// granted during play, in no template -- and it was the one such stamp the
// sync did not count, so the copy kept them only while their content ids
// happened to be known.
describe("an Ability a summon inherited", () => {
  it("is kept by the sync, as anything granted during play is", () => {
    const inherited = { _id: "i1", name: "Divinity", system: { contentId: "an-id-no-pack-knows", inheritedFrom: "raikou" } };
    const { remove, kept } = reconcileItems([inherited], [], { knownContentIds: new Set() });
    expect(remove).toEqual([]);
    expect(kept).toEqual(["i1"]);
    expect(PROVENANCE_KEYS).toContain("inheritedFrom");
  });
});
