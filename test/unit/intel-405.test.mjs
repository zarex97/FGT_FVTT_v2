/**
 * @file The Information System, slice 7: the sheets that hide, fake, erase and teach (#405).
 * @see docs/superpowers/specs/2026-11-12-information-system.md (MO.*, HE.*, JA.*, TN.*, HA.*, MJ.*, AA.*, FB.*)
 *
 * Jack and Karl are built; the rest stand on staged bench Servants (`test-intel-*`),
 * compiled through the real projection. A guard, never the evidence.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { castSkill, playAttack } from "../helpers/process.mjs";

beforeAll(prepareSubjects, 120_000);
vi.setConfig({ testTimeout: 60_000 });

const HIDER = "intelHider000001", FAKER = "intelFaker000001", COERCER = "intelCoercer0001";
const SHROUD = "intelShroud00001", IMMUNE = "intelImmune00001", JACK = "intelJack0000001";
const KARL = "intelKarl0000001", AR = "intelArturia0001", HE = "intelHeracles001";
const ROSTER = [{ id: "A", name: "A", userIds: ["p1"] }, { id: "B", name: "B", userIds: [] }];
const WAR = {
  tokens: true,
  combat: { round: 6, started: true, system: { globalTurn: 18, difficulty: "intermediate", npGateRound: 1, factions: ROSTER }, actingFactionId: "B" },
};
const bank = async (factionId, unitId, intel) => {
  const { changeNotebook, emptyDossier } = await import("../../module/engine/intel-store.mjs");
  await changeNotebook(factionId, (s) => { s.dossiers[unitId] = { ...emptyDossier(), intel }; });
};

describe("Secret of Pedigree (MO.*)", () => {
  const scene = [
    { from: "test-intel-hider", id: HIDER, panel: { i: 5, j: 5 }, state: { factionId: "B" } },
    { from: "arturia", id: AR, owner: "p1", panel: { i: 5, j: 7 }, state: { factionId: "A" } },
  ];

  it("while it holds: only Parameters and Class Skills are buyable, END sells its Rank alone, and no cloak opens on her pools (MO.only, MO.values, MO.refuse, MO.cloak)", async () => {
    await withSubjects(scene, async ({ world: w }) => {
      const { hiddenFrom, buy, viewerOpens, notebookState } = await import("../../module/engine/intel.mjs");
      const h = hiddenFrom(w.actor(HIDER));
      expect(h.entries).toEqual(["mov", "range", "region", "attributes", "alignment"]);
      expect(h.sections).toEqual(["spells", "active", "passive", "nps", "items"]);
      expect(h.ranksOnly).toEqual(["end", "agi", "luc"]);
      await bank("A", HIDER, 40);
      expect(await buy({ factionId: "A", unitId: HIDER, entry: "mov" })).toEqual({ ok: false, reason: "hidden" });
      expect(await buy({ factionId: "A", unitId: HIDER, section: "nps" })).toEqual({ ok: false, reason: "hidden" });
      expect(notebookState("A").dossiers[HIDER].intel).toBe(40);
      expect(await buy({ factionId: "A", unitId: HIDER, entry: "end" })).toMatchObject({ ok: true });
      expect(viewerOpens(HIDER, "end", game.users.get("p1"))).toBe(false);
      expect(await buy({ factionId: "A", unitId: HIDER, section: "classSkills" })).toMatchObject({ ok: true });
    }, WAR);
  });

  it("her Clarent switches it off, and her page is buyable again (MO.end)", async () => {
    await withSubjects(scene, async ({ world: w }) => {
      const clarent = w.actor(HIDER).items.find((i) => i.system.contentId === "test-intel-clarent");
      await playAttack(w, { attacker: HIDER, ability: clarent.id, placement: { panel: { i: 5, j: 7 } }, react: { [AR]: ["nothing", "declined", "declined"], [HIDER]: ["declined", "declined"] } });
      const secret = w.actor(HIDER).items.find((i) => i.system.contentId === "test-intel-secret");
      expect(secret.system.active).toBe(false);
      const { hiddenFrom } = await import("../../module/engine/intel.mjs");
      expect(hiddenFrom(w.actor(HIDER))).toEqual({ entries: [], sections: [], ranksOnly: [] });
    }, WAR);
  });
});

describe("Camouflage (HE.*)", () => {
  it("a Faction that does not know her reads the false view; one that witnessed her NP reads the truth (HE.stat, HE.np)", async () => {
    await withSubjects([
      { from: "test-intel-faker", id: FAKER, panel: { i: 5, j: 5 }, state: { factionId: "B" } },
      { from: "arturia", id: AR, owner: "p1", panel: { i: 5, j: 6 }, state: { factionId: "A" } },
    ], async ({ world: w }) => {
      const { falseViewOf, noteAct } = await import("../../module/engine/intel.mjs");
      expect(falseViewOf(w.actor(FAKER), "A")).toBeNull();
      await w.actor(FAKER).update({ "system.falseInformation": { className: "Saber", parameters: { str: "E", end: "E", agi: "E", mag: "E", luc: "E" } } });
      expect(falseViewOf(w.actor(FAKER), "A")).toMatchObject({ className: "Saber" });
      const { falseEntryValue } = await import("../../module/rules/intel.mjs");
      expect(falseEntryValue("str", { str: "E" }, { baseAttackFor: () => ({ str: 50, mag: 0 }), maxHealthOf: () => 0 })).toEqual({ rank: "E", base: 50 });
      await noteAct({ unitId: FAKER, kind: "np", involvedIds: [AR] });
      expect(falseViewOf(w.actor(FAKER), "A")).toBeNull();
    }, WAR);
  });
});

describe("Information Erasure (JA.*)", () => {
  it("Jack leaving Arturia's Detect erases Faction A's record of him; a Faction still seeing him keeps it (JA.leave, JA.any, JA.other)", async () => {
    await withSubjects([
      { from: "jack-the-ripper", id: JACK, panel: { i: 5, j: 5 }, state: { factionId: "B" } },
      { from: "arturia", id: AR, owner: "p1", panel: { i: 5, j: 6 }, state: { factionId: "A" } },
    ], async ({ world: w }) => {
      await bank("A", JACK, 9);
      const { eraseOnLeaving, notebookState } = await import("../../module/engine/intel.mjs");
      // A step that stays in her Detect erases nothing.
      expect(await eraseOnLeaving({ moverId: JACK, from: { i: 5, j: 5 }, to: { i: 5, j: 4 } })).toEqual([]);
      expect(notebookState("A").dossiers[JACK].intel).toBe(9);
      const told = await eraseOnLeaving({ moverId: JACK, from: { i: 5, j: 5 }, to: { i: 12, j: 0 } });
      expect(told).toEqual(["A"]);
      expect(notebookState("A").dossiers[JACK]).toBeUndefined();
      const line = [...w.messages.values()].find((m) => (m.flags ?? m.doc?.flags)?.fgt?.intelErased === "A");
      expect(line).toBeTruthy();
    }, WAR);
  });
});

describe("True Name Discernment (TN.*, HA.*, MJ.*)", () => {
  it("Karl's first sight opens the whole Dossier and the True Name to his Faction (TN.first, TN.truename, TN.full)", async () => {
    await withSubjects([
      { from: "karl-de-grosse", id: KARL, owner: "p1", panel: { i: 5, j: 5 }, state: { factionId: "A" } },
      { from: "heracles", id: HE, panel: { i: 5, j: 6 }, state: { factionId: "B" } },
    ], async () => {
      const { learnServantPage } = await import("../../module/engine/true-name.mjs");
      const { notebookState } = await import("../../module/engine/intel.mjs");
      const out = await learnServantPage({ unitId: KARL, targetId: HE });
      expect(out?.learned).toBe(true);
      const d = notebookState("A").dossiers[HE];
      expect(d.identity).toBe(true);
      expect(d.open.end).toBe(true);
      expect(Object.values(d.sections).every((s) => s.complete)).toBe(true);
      expect(Object.values(d.abilities).every((a) => a.full)).toBe(true);
    }, WAR);
  });

  it("against a shrouded Unit its first sight does nothing (HA.passive, MJ.none)", async () => {
    await withSubjects([
      { from: "karl-de-grosse", id: KARL, owner: "p1", panel: { i: 5, j: 5 }, state: { factionId: "A" } },
      { from: "test-intel-shrouded", id: SHROUD, panel: { i: 5, j: 6 }, state: { factionId: "B" } },
      { from: "test-intel-immune", id: IMMUNE, panel: { i: 6, j: 6 }, state: { factionId: "B" } },
    ], async () => {
      const { learnServantPage } = await import("../../module/engine/true-name.mjs");
      expect(await learnServantPage({ unitId: KARL, targetId: SHROUD })).toBeNull();
      expect(await learnServantPage({ unitId: KARL, targetId: IMMUNE })).toBeNull();
    }, WAR);
  });

  it("its active on Hassan flips a coin: Heads and a failed Luck Check open his Stats; on Metatron it does nothing (HA.coin, HA.luck, MJ.none)", async () => {
    await withSubjects([
      { from: "karl-de-grosse", id: KARL, owner: "p1", panel: { i: 5, j: 5 }, state: { factionId: "A" } },
      { from: "test-intel-shrouded", id: SHROUD, panel: { i: 5, j: 6 }, state: { factionId: "B" } },
      { from: "test-intel-immune", id: IMMUNE, panel: { i: 6, j: 6 }, state: { factionId: "B" } },
    ], async ({ world: w }) => {
      const { shroudedDiscernment, notebookState } = await import("../../module/engine/intel.mjs");
      w.dice.every(20);
      // 1d2 → 2: Tails.
      expect(await shroudedDiscernment(w.actor(KARL), w.actor(SHROUD))).toMatchObject({ coin: 2, opened: false });
      w.dice.every(1);
      const heads = await shroudedDiscernment(w.actor(KARL), w.actor(SHROUD));
      expect(heads.coin).toBe(1);
      expect(heads.opened).toBe(!heads.check);
      if (heads.opened) expect(notebookState("A").dossiers[SHROUD].open.agi).toBe(true);
      expect(await shroudedDiscernment(w.actor(KARL), w.actor(IMMUNE))).toEqual({ coin: null, check: null, opened: false });
    }, WAR);
  });
});

describe("Coercion and Classified (FB.*)", () => {
  const scene = [
    { from: "test-intel-coercer", id: COERCER, owner: "p1", panel: { i: 5, j: 5 }, state: { factionId: "A" } },
    { from: "heracles", id: HE, panel: { i: 5, j: 6 }, state: { factionId: "B" } },
  ];

  it("Coercion: the DU's player picks a Skill, and the coercer's Faction learns it in full (FB.coerce, FB.coerce.open)", async () => {
    await withSubjects(scene, async ({ world: w }) => {
      const skill = w.actor(HE).items.find((i) => i.type === "ability" && i.system.kind !== "classSkill");
      w.answer({ title: "FGT.Intel.CoerceTitle", pick: [skill.id] });
      const coercion = w.actor(COERCER).items.find((i) => i.system.contentId === "test-intel-coercion");
      const out = await castSkill(w, { caster: COERCER, ability: coercion.id, placement: { unitId: HE, chosenIds: [HE] } });
      expect(out.ok, out.reason).toBe(true);
      const { notebookState } = await import("../../module/engine/intel.mjs");
      expect(notebookState("A").dossiers[HE].abilities[skill.system.contentId]?.full).toBe(true);
    }, { ...WAR, combat: { ...WAR.combat, actingFactionId: "A" } });
  });

  it("Classified: the DU's whole page goes to every Faction with a Unit within 2 of it, never its own (FB.classified, FB.classified.self)", async () => {
    await withSubjects(scene, async ({ world: w }) => {
      const classified = w.actor(COERCER).items.find((i) => i.system.contentId === "test-intel-classified");
      const out = await castSkill(w, { caster: COERCER, ability: classified.id, placement: { unitId: HE, chosenIds: [HE] } });
      expect(out.ok, out.reason).toBe(true);
      const { notebookState } = await import("../../module/engine/intel.mjs");
      expect(notebookState("A").dossiers[HE]?.identity).toBe(true);
      expect(notebookState("B").dossiers[HE]).toBeUndefined();
    }, { ...WAR, combat: { ...WAR.combat, actingFactionId: "A" } });
  });
});

describe("Appreciation of the Arts (AA.*)", () => {
  it("a learned NP opens its Entry in full for the learner's Faction (AA.entry, AA.section)", async () => {
    await withSubjects([
      { from: "heracles", id: HE, panel: { i: 5, j: 6 }, state: { factionId: "B" } },
    ], async ({ world: w }) => {
      const { teachAbility, notebookState } = await import("../../module/engine/intel.mjs");
      const np = w.actor(HE).items.find((i) => i.type === "noblePhantasm" || i.system.isNP);
      await teachAbility("A", w.actor(HE), np);
      const d = notebookState("A").dossiers[HE];
      expect(d.abilities[np.system.contentId].full).toBe(true);
      expect(d.sections.nps.known).toContain(np.system.contentId);
    }, WAR);
  });
});
