/**
 * @file Anastasia (Summer)'s audit rulings, played in the test world (#258).
 * @see docs/superpowers/specs/2026-10-20-anastasia-clauses.md
 *
 * Her sheet is *"Anastasia & Viy"*; reading 9 renamed her and reading 1 made her
 * an Archer. Reading 3 lets Crit Up (Viy) reach her ranged Normal Attack, which
 * uses BA(MAG) as a tenth of its base. Reading 4 gives Soaked a Freeze roll of
 * its own on an Ice Attack that carries none. Reading 5: Snegleta's own hit
 * drains the Luck of the Def Dwn (A) it inflicted first.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { playAttack } from "../helpers/process.mjs";

beforeAll(prepareSubjects, 120_000);

const AN = "anastasiaSummer0", HE = "heraclesTarget00";
const WAR = { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18, difficulty: "intermediate", npGateRound: 1 }, actingFactionId: "A" } };

const abilityOf = (w, id, contentId) => w.actor(id).items.find((i) => i.system.contentId === contentId);
const effectsOf = (w, id) => [...w.actor(id).effects].map((e) => e.system?.defId ?? e.name);

/** Anastasia at (5,5), Heracles `distance` panels away, both as the board sees them. */
const facing = (distance, check, { heracles = {}, anastasia = {}, attacks = true } = {}) => withSubjects([
  { from: "anastasia-summer", id: AN, panel: { i: 5, j: 5 }, state: { factionId: "A" }, ...anastasia },
  { from: "heracles", id: HE, panel: { i: 5, j: 5 + distance }, state: { factionId: "B" }, ...heracles },
], async ({ world: w }) => {
  // Watermelon is offered at the start of every Combat Phase she opens; declined.
  if (attacks) w.answer({ title: "FGT.Window.combatPhaseStart", decline: true });
  return check(w);
}, WAR);

describe("her identity (#258 readings 1, 2, 9)", () => {
  it("is Anastasia (Summer), an Archer from Russia alone", async () => {
    await facing(3, async (w) => {
      const s = w.actor(AN).system;
      expect(w.actor(AN).name).toBe("Anastasia (Summer)");
      expect([...s.servantClasses]).toEqual(["archer"]);
      expect(s.classContainer).toBe("archer");
      expect([...s.region]).toEqual(["russia"]);
    }, { attacks: false });
  }, 60_000);

  it("holds no Caster power: she cannot contract, and is not Magus", async () => {
    await facing(3, async (w) => {
      const { canAttemptContract } = await import("../../module/rules/contract.mjs");
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const { isMagus } = await import("../../module/domain/attributes.mjs");
      const board = currentBoard();
      const unit = (id) => board.units.find((u) => u.id === id);
      expect(canAttemptContract(unit(AN), unit(HE), board)).toMatchObject({ ok: false, reason: "notAContractor" });
      expect(isMagus(w.actor(AN).system)).toBe(false);
    }, { attacks: false });
  }, 60_000);
});

describe("Crit Up (Viy) and her ranged Normal Attack (#258 reading 3)", () => {
  // 50 + Independent Action's 10 = 60. Crit Up (Viy) adds 50 to an Attack that
  // uses BA(MAG). Every die lands on 75: 60 misses, 110 crits.
  const swing = (distance) => facing(distance, async (w) => {
    await w.actor(AN).createEmbeddedDocuments("ActiveEffect", [{
      name: "Crit Up (Viy)", system: { defId: "critUpViy", magnitude: 50, npMagnitude: 20 },
    }]);
    w.dice.every(75);
    const { declared } = await playAttack(w, { attacker: AN, ability: null, target: HE, react: { [HE]: ["nothing", "declined"] } });
    return w.messages.get(declared.messageId).getFlag("fgt", "result").isCrit;
  });

  it("crits her ranged shot on a 75: BA(STR) plus 10% of BA(MAG) uses BA(MAG)", async () => {
    // RED before #258: the coin read `attack:component:mag`, and the band counts as STR.
    expect(await swing(3)).toBe(true);
  }, 60_000);

  it("does not crit her melee swing on a 75: BA(STR) alone", async () => {
    expect(await swing(1)).toBe(false);
  }, 60_000);
});

describe("Soaked's own Freeze roll (#258 reading 4)", () => {
  // Her ranged Normal Attack is Ice and inflicts no Freeze. On a Soaked
  // Heracles it rolls Freeze at 25, plus her Fae Contract's 5: 30. The d100s,
  // in order: the crit coin, then Soaked's roll; Rock Snowball's 10% comes after.
  const shot = (distance, face) => facing(distance, async (w) => {
    w.dice.every(face);
    await playAttack(w, { attacker: AN, ability: null, target: HE, react: { [HE]: ["nothing", "declined"] } });
    return effectsOf(w, HE);
  }, { heracles: { effects: [{ defId: "soaked" }] } });

  it("freezes a Soaked Unit on a roll of 30 under her Ice shot", async () => {
    // RED before #258: the clause only raised a Freeze chance the Attack carried.
    expect(await shot(3, 30)).toContain("freeze");
  }, 60_000);

  it("does not on a 31", async () => {
    expect(await shot(3, 31)).not.toContain("freeze");
  }, 60_000);

  it("never under her melee swing, which is not Ice", async () => {
    expect(await shot(1, 1)).not.toContain("freeze");
  }, 60_000);
});

describe("Snegleta's own hit and its Def Dwn (A) (#258 reading 5)", () => {
  it("drains 1 Luck for the NP that inflicted it first", async () => {
    await facing(3, async (w) => {
      // Setup has not rolled his Luck, and 0 cannot drain.
      await w.actor(HE).update({ "system.luck.max": 19, "system.luck.value": 10 });
      const before = w.actor(HE).system.luck.value;
      const sneg = abilityOf(w, AN, "anastasia-summer-snegleta");
      await playAttack(w, { attacker: AN, ability: sneg.id, target: HE, react: { [HE]: ["nothing", "declined"] } });
      expect(effectsOf(w, HE)).toContain("defDwnA");
      expect(w.actor(HE).system.luck.value).toBe(before - 1);
    });
  }, 60_000);
});

describe("Skill Seal and a Normal Attack (found pressing #258)", () => {
  // Snegleta's Skill Seal sealed Karna, and his Normal Attack was refused:
  // "Cannot use this ability: Prevented". A Normal Attack has no Item, and the
  // use gate read "no ability" as a Skill.
  const sealed = (defId) => ({ id: "u", kind: "servant", effects: [defId], effectInstances: [{ defId }] });
  it("lets a Normal Attack through Skill Seal, and not through Seal", async () => {
    const { canUseAbility } = await import("../../module/rules/costs.mjs");
    expect(canUseAbility({ ability: null, unit: sealed("skillSeal") })).toMatchObject({ ok: true });
    expect(canUseAbility({ ability: null, unit: sealed("seal") })).toMatchObject({ ok: false, reason: "prevented" });
  });
});

describe("Fire breaks Freeze, found pressing Soaked (#258, design R2)", () => {
  // Pressed live: Nemo's Barrel Bombing on a Soaked, Frozen Asterios read
  // "negated by Freeze broken by Fire — 0", consumed the Soaked, and left the
  // Freeze on him and a Burn beside it. The pipeline raised `removeFreeze` and
  // nothing read it; Freeze is *"removed with no damage or effects"*.
  const KA = "karnaFireTest000";
  const frozenHit = (check) => withSubjects([
    { from: "karna", id: KA, panel: { i: 5, j: 5 }, state: { factionId: "A" } },
    { from: "heracles", id: HE, panel: { i: 5, j: 6 }, state: { factionId: "B" }, effects: [{ defId: "freeze" }, { defId: "soaked" }] },
  ], async ({ world: w }) => {
    w.answer({ title: "FGT.Window.combatPhaseStart", decline: true });
    const flames = abilityOf(w, KA, "karna-mana-burst-flames");
    // Frozen, he cannot react: the ladder asks him only at the Counter rung.
    await playAttack(w, { attacker: KA, ability: flames.id, target: HE, react: { [HE]: ["declined"] } });
    return check(w);
  }, WAR);

  it("removes the Freeze and the Soaked, and lands no Burn", async () => {
    await frozenHit((w) => {
      const held = effectsOf(w, HE);
      expect(held).not.toContain("freeze");
      expect(held).not.toContain("soaked");
      expect(held).not.toContain("burn");
    });
  }, 60_000);
});

describe("Blind's Evade penalty counts once (found pressing WM.p.own, #258)", () => {
  // Karna's Normal Attack on a Blind Anastasia, who Evades: the roll carried
  // "Blind 3" and "blind 3". The effect authors it; the engine added it again.
  it("adds +3 once to a Blind defender's Evade", async () => {
    await withSubjects([
      { from: "karna", id: "karnaEvadeTest00", panel: { i: 5, j: 5 }, state: { factionId: "B" } },
      { from: "anastasia-summer", id: AN, panel: { i: 5, j: 6 }, state: { factionId: "A" }, effects: [{ defId: "blind" }] },
    ], async ({ world: w }) => {
      w.answer({ title: "FGT.Window.combatPhaseStart", decline: true });
      w.dice.set("d20", 1);
      const { processes } = await playAttack(w, { attacker: "karnaEvadeTest00", ability: null, target: AN, react: { [AN]: ["evade", "accept", "declined"] } });
      const roll = processes[0].history.find((h) => h.state === "evadeRoll");
      const blind = roll.detail.modifiers.filter((m) => /^blind$/i.test(m.source));
      expect(blind.map((m) => m.value)).toEqual([3]);
    }, { ...WAR, combat: { ...WAR.combat, actingFactionId: "B" } });
  }, 60_000);
});

describe("Soaked dries at the end of a Day Round (found pressing SK.c, #258)", () => {
  // Round 1 (Day) ended live with Soaked still on Nemo and Medea: the handler's
  // `self:phase:day` was asked at collection, before the board knew the phase.
  const roundEnd = (round) => withSubjects([
    { from: "heracles", id: HE, panel: { i: 5, j: 6 }, state: { factionId: "B" }, effects: [{ defId: "soaked" }] },
  ], async () => {
    const { currentBoard } = await import("../../module/engine/board.mjs");
    const { moment } = await import("../../module/domain/moment.mjs");
    const { fireEvent } = await import("../../module/engine/scheduler.mjs");
    const board = currentBoard({ moment: moment(round, round * 3) });
    const unit = board.units.find((u) => u.id === HE);
    return { phase: unit.phase, intents: fireEvent("roundEnd", [unit], { board, tick: round * 3, round, turnsPerRound: 3, rolls: {} }) };
  }, WAR);
  const dries = (intents) => intents.some((i) => i.t === "removeEffect" && i.effectId === "soaked");

  it("removes it at the end of a Day Round", async () => {
    const { phase, intents } = await roundEnd(1);
    expect(phase).toBe("day");
    expect(dries(intents)).toBe(true);
  }, 60_000);

  it("keeps it at the end of a Night Round", async () => {
    const { phase, intents } = await roundEnd(2);
    expect(phase).toBe("night");
    expect(dries(intents)).toBe(false);
  }, 60_000);
});

describe("a buff removal that is held says so (found pressing FS.2, #258)", () => {
  // Medea's Rule Breaker on Anastasia under BuffRemoval ResUp 100: every buff
  // held, and the card read only "Rule Breaker".
  it("prints each held buff as resisted", async () => {
    await withSubjects([
      { from: "medea", id: "medeaRuleBreaker", panel: { i: 5, j: 5 }, state: { factionId: "B" } },
      { from: "anastasia-summer", id: AN, panel: { i: 5, j: 6 }, state: { factionId: "A" },
        effects: [{ defId: "buffRemovalResUp", magnitude: 100 }, { defId: "atkUp", magnitude: 30 }] },
    ], async ({ world: w }) => {
      const rb = abilityOf(w, "medeaRuleBreaker", "medea-rule-breaker");
      const { declared } = await playAttack(w, { attacker: "medeaRuleBreaker", ability: rb.id, target: AN, react: { [AN]: ["nothing", "declined"] } });
      const rows = w.messages.get(declared.messageId).getFlag("fgt", "effects") ?? [];
      expect(rows).toEqual(expect.arrayContaining([expect.objectContaining({ id: "atkUp", outcome: "resisted" })]));
      expect(effectsOf(w, AN)).toContain("atkUp");
    }, { ...WAR, combat: { ...WAR.combat, actingFactionId: "B" } });
  }, 60_000);
});

describe("a rule's removal is a card line (found pressing SK.c, #258)", () => {
  // Soaked dried at the end of Round 3, a Day Round, and the Round's card said
  // nothing; Fire used it up and the hit's card said nothing.
  it("lines Soaked's removal at a Day Round's end", async () => {
    await withSubjects([
      { from: "heracles", id: HE, panel: { i: 5, j: 6 }, state: { factionId: "B" }, effects: [{ defId: "soaked" }] },
    ], async () => {
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const { moment } = await import("../../module/domain/moment.mjs");
      const { fireEvent } = await import("../../module/engine/scheduler.mjs");
      const { applyWorldIntents } = await import("../../module/engine/applier.mjs");
      const board = currentBoard({ moment: moment(1, 3) });
      const intents = fireEvent("roundEnd", [board.units.find((u) => u.id === HE)], { board, tick: 3, round: 1, turnsPerRound: 3, rolls: {} });
      const { lines } = await applyWorldIntents(intents, "test:roundEnd", { lines: true });
      expect(lines).toEqual(expect.arrayContaining([expect.objectContaining({ unitId: HE, summary: expect.objectContaining({ name: "Soaked", outcome: "removed" }) })]));
    }, WAR);
  }, 60_000);
});

describe("Independent Action EX refuses Conquest (#258 reading 12)", () => {
  // Ruled 2026-10-20: Independent Action is meant against "the normal Contract
  // option (or Conquest)"; Rule Breaker's gift of her Contract to Medea stands.
  it("leaves her out of the killer's claim, Free, and says so", async () => {
    await withSubjects([
      { from: "anastasia-summer", id: AN, panel: { i: 5, j: 6 }, state: { factionId: "A" } },
    ], async ({ unit }) => {
      const { conquestContract } = await import("../../module/rules/contract.mjs");
      const killer = { id: "killerMaster0000", kind: "master", factionId: "B", panel: { i: 5, j: 5 } };
      const dead = { id: "deadMaster000000", kind: "master", factionId: "A", panel: { i: 6, j: 6 }, commandSpells: 3 };
      const her = { ...unit(AN), contract: "contracted", masterId: dead.id };
      const out = conquestContract({ killer, deadMaster: dead, board: { units: [killer, dead, her] } });
      expect(out.refused).toEqual([AN]);
      expect(out.descriptors.some((d) => d.kind === "setContract" && d.unitId === AN)).toBe(false);
    }, WAR);
  }, 60_000);
});
