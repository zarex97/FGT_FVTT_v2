/**
 * @file The Information System, slices 1 and 2: the Faction Notebook and earning Intel (#399, #400).
 * @see docs/superpowers/specs/2026-11-12-information-system.md (WR.*, ST.*, EA.*)
 *
 * Built through the real projection (`withSubjects`). A guard, never the evidence:
 * every Clause is pressed live.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { playAttack } from "../helpers/process.mjs";

beforeAll(prepareSubjects, 120_000);
vi.setConfig({ testTimeout: 60_000 });

const HE = "intelHeracles001", AR = "intelArturia0001", CU = "intelCuChulain01", FAR = "intelFarUnit0001";
const ROSTER = [
  { id: "A", name: "Faction A", userIds: ["p1"] },
  { id: "B", name: "Faction B", userIds: [] },
];
const WAR = {
  tokens: true,
  combat: { round: 6, started: true, system: { globalTurn: 18, difficulty: "intermediate", npGateRound: 1, factions: ROSTER }, actingFactionId: "B" },
};
const OFF = { ...WAR, combat: { ...WAR.combat, system: { ...WAR.combat.system, informationSystem: false } } };

/** Faction A's Units watch Faction B's Heracles. */
const scene = [
  { from: "heracles", id: HE, panel: { i: 5, j: 5 }, state: { factionId: "B" } },
  { from: "arturia", id: AR, owner: "p1", panel: { i: 5, j: 6 }, state: { factionId: "A" } },
  { from: "cu-chulainn", id: CU, owner: "p1", panel: { i: 6, j: 6 }, state: { factionId: "A" } },
];

describe("who witnesses, and what it pays (EA.*)", () => {
  it("a seen Move pays 1, three Witnesses of one Faction still 1, and nothing to the mover's own (EA.move, EA.max, EA.own)", async () => {
    await withSubjects(scene, async ({ board }) => {
      const { witnessesOf } = await import("../../module/rules/intel.mjs");
      const b = board;
      const actor = b.units.find((u) => u.id === HE);
      const got = witnessesOf({ actor, board: b, kind: "move" });
      expect(Object.fromEntries(got)).toEqual({ A: 1 });
    }, WAR);
  });

  it("an involved Witness pays ×2, and its Faction takes the higher (EA.x2, EA.max)", async () => {
    await withSubjects(scene, async ({ board }) => {
      const { witnessesOf } = await import("../../module/rules/intel.mjs");
      const b = board;
      const actor = b.units.find((u) => u.id === HE);
      expect(Object.fromEntries(witnessesOf({ actor, board: b, kind: "attack", involvedIds: [AR] }))).toEqual({ A: 4 });
    }, WAR);
  });

  it("nobody in sight and nobody involved: nothing (EA.see.out); involved from far off: ×2 (EA.see.involved)", async () => {
    const far = [scene[0], { from: "arturia", id: FAR, owner: "p1", panel: { i: 12, j: 12 }, state: { factionId: "A" } }];
    await withSubjects(far, async ({ board }) => {
      const { witnessesOf } = await import("../../module/rules/intel.mjs");
      const b = board;
      const actor = b.units.find((u) => u.id === HE);
      expect(witnessesOf({ actor, board: b, kind: "move" }).size).toBe(0);
      expect(Object.fromEntries(witnessesOf({ actor, board: b, kind: "attack", involvedIds: [FAR] }))).toEqual({ A: 4 });
    }, WAR);
  });

  it("a Move is seen at its start or its end panel (EA.see.moment, reading 29)", async () => {
    const far = [scene[0], { from: "arturia", id: FAR, owner: "p1", panel: { i: 12, j: 12 }, state: { factionId: "A" } }];
    await withSubjects(far, async ({ board }) => {
      const { witnessesOf } = await import("../../module/rules/intel.mjs");
      const b = board;
      const actor = b.units.find((u) => u.id === HE);
      const got = witnessesOf({ actor, board: b, kind: "move", panels: [{ i: 5, j: 5 }, { i: 11, j: 12 }] });
      expect(Object.fromEntries(got)).toEqual({ A: 1 });
    }, WAR);
  });

  it("concealed, nobody witnesses (EA.see.concealed)", async () => {
    await withSubjects(scene, async ({ board }) => {
      const { witnessesOf } = await import("../../module/rules/intel.mjs");
      const b = board;
      const actor = { ...b.units.find((u) => u.id === HE), effects: ["presenceConcealment"] };
      expect(witnessesOf({ actor, board: b, kind: "attack", involvedIds: [AR] }).size).toBe(0);
    }, WAR);
  });

  it("a Summon earns nobody anything (EA.kind.summon)", async () => {
    const { witnessesOf } = await import("../../module/rules/intel.mjs");
    const board = { units: [{ id: "g", kind: "summon", faction: "B", panel: { i: 1, j: 1 } }, { id: "w", kind: "servant", faction: "A", panel: { i: 1, j: 2 } }] };
    expect(witnessesOf({ actor: board.units[0], board, kind: "attack", involvedIds: ["w"] }).size).toBe(0);
  });

  it("the values (EA.move … EA.ab.np, EA.ab.cs)", async () => {
    const { INTEL_VALUES } = await import("../../module/rules/intel.mjs");
    expect(INTEL_VALUES).toEqual({ move: 1, attack: 2, evade: 1, block: 1, counter: 2, skill: 2, np: 8, commandSpell: 2 });
  });
});

describe("the per-Turn ledger (EA.once.*, EA.repeat.react)", () => {
  it("a second Attack in one Turn pays nothing; an area's later Process raising 2 to 4 pays 2", async () => {
    const { payAct } = await import("../../module/rules/intel.mjs");
    let r = payAct(null, { tick: 18, unitId: "x", kind: "attack", value: 2 });
    expect(r.paid).toBe(2);
    r = payAct(r.ledger, { tick: 18, unitId: "x", kind: "attack", value: 2 });
    expect(r.paid).toBe(0);
    r = payAct(r.ledger, { tick: 18, unitId: "x", kind: "attack", value: 4 });
    expect(r.paid).toBe(2);
    expect(r.ledger.gains.x).toBe(4);
    // A new Turn: paid again.
    r = payAct(r.ledger, { tick: 19, unitId: "x", kind: "attack", value: 2 });
    expect(r.paid).toBe(2);
  });

  it("Evades pay every time (EA.repeat.react)", async () => {
    const { payAct } = await import("../../module/rules/intel.mjs");
    let r = payAct(null, { tick: 3, unitId: "x", kind: "evade", value: 1 });
    r = payAct(r.ledger, { tick: 3, unitId: "x", kind: "evade", value: 1 });
    expect(r.paid).toBe(1);
    expect(r.ledger.gains.x).toBe(2);
  });
});

describe("the Faction Notebook (ST.*)", () => {
  it("an act paid lands in the Faction's Notebook, read by its players only, written whole (ST.faction, ST.page, ST.private)", async () => {
    await withSubjects(scene, async ({ world: w }) => {
      const { noteAct } = await import("../../module/engine/intel.mjs");
      const paid = await noteAct({ unitId: HE, kind: "attack", involvedIds: [AR] });
      expect(Object.fromEntries(paid)).toEqual({ A: 4 });
      const book = w.journal.find((j) => j.getFlag("fgt", "intelNotebook")?.factionId === "A");
      expect(book, "Faction A's Notebook").toBeTruthy();
      expect(book.ownership).toEqual({ default: 0, p1: 2 });
      const state = JSON.parse(book.getFlag("fgt", "intelState"));
      expect(state.dossiers[HE].intel).toBe(4);
      expect(w.journal.find((j) => j.getFlag("fgt", "intelNotebook")?.factionId === "B")).toBeFalsy();
    }, WAR);
  });

  it("the War Rule off: nothing earned, no Notebook (WR.off.earn)", async () => {
    await withSubjects(scene, async ({ world: w }) => {
      const { noteAct } = await import("../../module/engine/intel.mjs");
      const paid = await noteAct({ unitId: HE, kind: "attack", involvedIds: [AR] });
      expect(paid.size).toBe(0);
      expect(w.journal.size).toBe(0);
    }, OFF);
  });

  it("the Turn's gains are whispered to the Faction and the GM, then cleared (EA.card, EA.silent.other)", async () => {
    await withSubjects(scene, async ({ world: w }) => {
      const { noteAct, sayIntelGains } = await import("../../module/engine/intel.mjs");
      await noteAct({ unitId: HE, kind: "move" });
      await noteAct({ unitId: HE, kind: "attack", involvedIds: [AR] });
      const told = await sayIntelGains(18);
      expect(told).toEqual(["A"]);
      const card = [...w.messages.values()].find((m) => (m.flags ?? m.doc?.flags)?.fgt?.intelGains === "A");
      expect(card, "the gains card").toBeTruthy();
      expect([...(card.whisper ?? card.doc?.whisper)].sort()).toEqual(["p1", "u1"]);
      expect(card.content ?? card.doc?.content).toContain("FGT.Intel.GainLine");
      // Said once: a second call finds nothing.
      expect(await sayIntelGains(18)).toEqual([]);
    }, WAR);
  });

  it("a player's old Notebook folds into their Faction's, page by page, and is deleted; once (ST.mig.*)", async () => {
    await withSubjects(scene, async ({ world: w }) => {
      await JournalEntry.create({ name: "old", ownership: { p1: 3 }, flags: { fgt: { notebook: "p1" } } });
      const old = w.journal.find((j) => j.getFlag("fgt", "notebook") === "p1");
      await old.createEmbeddedDocuments("JournalEntryPage", [{ name: "De Sterrennacht", type: "text", text: { content: "x" }, flags: { fgt: { key: "np:gogh" } } }]);
      const { foldPlayerNotebooks } = await import("../../module/engine/intel-store.mjs");
      const first = await foldPlayerNotebooks();
      expect(first.folded).toEqual(["Player1"]);
      const book = w.journal.find((j) => j.getFlag("fgt", "intelNotebook")?.factionId === "A");
      expect([...book.pages.values()].map((p) => p.getFlag("fgt", "key"))).toEqual(["np:gogh"]);
      expect(w.journal.find((j) => j.getFlag("fgt", "notebook"))).toBeFalsy();
      const second = await foldPlayerNotebooks();
      expect(second).toEqual({ folded: [], skipped: [] });
    }, WAR);
  });

  it("a player in no Faction keeps theirs, named (ST.mig.none)", async () => {
    const lone = { ...WAR, combat: { ...WAR.combat, system: { ...WAR.combat.system, factions: [{ id: "A", name: "A", userIds: [] }] } } };
    await withSubjects(scene, async ({ world: w }) => {
      await JournalEntry.create({ name: "old", ownership: { p1: 3 }, flags: { fgt: { notebook: "p1" } } });
      const { foldPlayerNotebooks } = await import("../../module/engine/intel-store.mjs");
      expect(await foldPlayerNotebooks()).toEqual({ folded: [], skipped: ["Player1"] });
      expect(w.journal.find((j) => j.getFlag("fgt", "notebook"))).toBeTruthy();
    }, lone);
  });
});

describe("acts played through the engine (EA.attack, EA.evade)", () => {
  it("an Attack on Arturia pays Faction A 4; her Evade pays Faction B 2", async () => {
    await withSubjects(scene, async ({ world: w }) => {
      w.dice.every(1);
      await playAttack(w, { attacker: HE, target: AR, react: { [AR]: ["declined", "declined", "declined"], [HE]: ["declined", "declined", "declined"] } });
      const { notebookState } = await import("../../module/engine/intel.mjs");
      expect(notebookState("A").dossiers[HE]?.intel).toBe(4);
      expect(notebookState("B").dossiers[AR]?.intel).toBe(2);
    }, WAR);
  });
});

describe("buying (BU.*, PR.*, SE.*)", () => {
  /** Faction A holds `intel` on Heracles. */
  const bank = async (intel) => {
    const { changeNotebook, emptyDossier } = await import("../../module/engine/intel-store.mjs");
    await changeNotebook("A", (s) => { s.dossiers[HE] = { ...emptyDossier(), intel }; });
  };

  it("an Entry costs its price and opens; a second buy is refused (BU.pay, BU.again, PR.end)", async () => {
    await withSubjects(scene, async () => {
      await bank(5);
      const { buy, notebookState } = await import("../../module/engine/intel.mjs");
      expect(await buy({ factionId: "A", unitId: HE, entry: "end", userId: "p1" })).toMatchObject({ ok: true, price: 4 });
      expect(notebookState("A").dossiers[HE]).toMatchObject({ intel: 1, open: { end: true } });
      expect(await buy({ factionId: "A", unitId: HE, entry: "end" })).toMatchObject({ ok: false, reason: "open" });
    }, WAR);
  });

  it("short of Intel: refused, nothing spent (BU.short)", async () => {
    await withSubjects(scene, async () => {
      await bank(3);
      const { buy, notebookState } = await import("../../module/engine/intel.mjs");
      expect(await buy({ factionId: "A", unitId: HE, entry: "str" })).toEqual({ ok: false, reason: "short", need: 4, held: 3 });
      expect(notebookState("A").dossiers[HE].intel).toBe(3);
    }, WAR);
  });

  it("two buys at once spend once each and never below 0 (BU.race)", async () => {
    await withSubjects(scene, async () => {
      await bank(6);
      const { buy, notebookState } = await import("../../module/engine/intel.mjs");
      const [a, b] = await Promise.all([
        buy({ factionId: "A", unitId: HE, entry: "str" }),
        buy({ factionId: "A", unitId: HE, entry: "mag" }),
      ]);
      expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
      expect(notebookState("A").dossiers[HE].intel).toBe(2);
    }, WAR);
  });

  it("a Section draw opens one ability, at random among those left; with none left it is Complete, free (SE.draw, SE.complete)", async () => {
    await withSubjects(scene, async ({ world: w }) => {
      await bank(100);
      const { buy, notebookState } = await import("../../module/engine/intel.mjs");
      const { sectionOf } = await import("../../module/rules/intel.mjs");
      const { isSpellAbility } = await import("../../module/rules/costs.mjs");
      const nps = [...w.actor(HE).items].filter((i) => sectionOf(i, isSpellAbility) === "nps").map((i) => i.system.contentId);
      expect(nps.length).toBeGreaterThan(0);
      for (let n = 0; n < nps.length; n++) {
        expect(await buy({ factionId: "A", unitId: HE, section: "nps" })).toMatchObject({ ok: true, price: 32 });
      }
      expect([...notebookState("A").dossiers[HE].sections.nps.known].sort()).toEqual([...nps].sort());
      const before = notebookState("A").dossiers[HE].intel;
      expect(await buy({ factionId: "A", unitId: HE, section: "nps" })).toMatchObject({ ok: true, complete: true, price: 0 });
      expect(notebookState("A").dossiers[HE].intel).toBe(before);
      expect(await buy({ factionId: "A", unitId: HE, section: "nps" })).toMatchObject({ ok: false, reason: "complete" });
    }, WAR);
  });

  it("a buy posts a card whispered to the Faction and the GM (BU.card)", async () => {
    await withSubjects(scene, async ({ world: w }) => {
      await bank(4);
      const { buy } = await import("../../module/engine/intel.mjs");
      await buy({ factionId: "A", unitId: HE, entry: "agi", userId: "p1" });
      const card = [...w.messages.values()].find((m) => (m.flags ?? m.doc?.flags)?.fgt?.intelBuy === "A");
      expect(card).toBeTruthy();
      expect([...(card.whisper ?? card.doc?.whisper)].sort()).toEqual(["p1", "u1"]);
    }, WAR);
  });

  it("what each Stat Entry shows (PR.str … PR.luc)", async () => {
    await withSubjects(scene, async ({ world: w }) => {
      const { entryValue, entriesOf } = await import("../../module/rules/intel.mjs");
      const he = w.actor(HE);
      expect(entriesOf(he)).toEqual(["str", "end", "agi", "mag", "luc", "mov", "range", "region", "attributes", "alignment"]);
      expect(entryValue("end", he)).toMatchObject({ rank: he.system.parameters.end, value: he.system.health.value, max: he.system.health.max });
      expect(entryValue("str", he)).toMatchObject({ rank: he.system.parameters.str, base: he.system.baseAttack.str });
      expect(entryValue("end", he, { ranksOnly: true })).toEqual({ rank: he.system.parameters.end });
    }, WAR);
  });

  it("an ability's summary names no name, Rank or text (SE.show.not)", async () => {
    await withSubjects(scene, async ({ world: w }) => {
      const { abilitySummary } = await import("../../module/rules/intel.mjs");
      const { isSpellAbility } = await import("../../module/rules/costs.mjs");
      for (const item of w.actor(HE).items) {
        const sum = abilitySummary(item, { effectName: (id) => id, isSpell: isSpellAbility });
        const text = JSON.stringify(sum);
        expect(text).not.toContain(item.name);
        if (item.system?.description) expect(text).not.toContain(String(item.system.description).slice(0, 30));
      }
    }, WAR);
  });
});
