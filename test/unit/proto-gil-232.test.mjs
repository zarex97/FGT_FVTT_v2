/**
 * Proto Gil, audit #232: the readings ruled 2026-10-16, built through the real
 * projection. The Combat Process halves are in `proto-gil-232-arena.test.mjs`.
 * @see docs/superpowers/specs/2026-10-16-proto-gil-clauses.md
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { computeDamage, computeDamageHits } from "../../module/rules/damage/pipeline.mjs";
import { rollOptionsFor } from "../../module/rules/options.mjs";
import { checkPlan } from "../../module/rules/checks.mjs";
import { canPassThrough, canStopOn } from "../../module/rules/movement.mjs";
import { hasGranted, GRANTS } from "../../module/rules/granted.mjs";
import { fireEvent } from "../../module/engine/scheduler.mjs";
import { missChance, missSourceOf } from "../../module/rules/miss.mjs";
import { healingPercent } from "../../module/engine/applier.mjs";
import { lockedReactions } from "../../module/engine/follow-up.mjs";
import { resolveTargets } from "../../module/rules/targeting/resolve.mjs";
import { applyEffect } from "../../module/engine/effect-applier.mjs";
import { EffectRegistry } from "../../module/rules/registry.mjs";

beforeAll(prepareSubjects, 120_000);
// A whole match per test, and the first pays for the warm-up: 5s is not enough on a busy run.
vi.setConfig({ testTimeout: 30_000 });

const GIL = "protoGilgamesh01";
const MAS = "protoGilMaster01";
const ALLY = "protoGilAlly0001";
const FOE = "protoGilFoe00001";

const abilityOf = (w, actorId, contentId) => w.actor(actorId).items.find((i) => i.system?.contentId === contentId);

/* ========================================================================== */

describe("the sheet, projected (SB, SB.attr, LE.1, LE.4)", () => {
  it("Base Attack and Health by the tables, MOV 5 + Levitation, Divine and Levitating granted", async () => {
    await withSubjects([{ from: "proto-gil", id: GIL }], ({ unit }) => {
      const g = unit(GIL);
      expect(g.baseAttack).toEqual(expect.objectContaining({ str: 100, mag: 200 }));
      expect(g.maxHealth ?? g.health?.max).toBe(1000);
      expect(g.mov).toBe(6);
      expect(g.attributes).toEqual(expect.arrayContaining(["male", "sky", "king", "divine", "levitating"]));
    });
  });

  it("NP Seal takes all four of Levitation's passives at once (LE.seal)", async () => {
    await withSubjects([{ from: "proto-gil", id: GIL, effects: [{ defId: "npSeal" }] }], ({ unit }) => {
      const g = unit(GIL);
      expect(g.mov).toBe(5);
      expect(g.attributes).not.toContain("levitating");
      expect(hasGranted(g, GRANTS.passesThroughUnits)).toBe(false);
      expect(checkPlan(g, "evade").modifiers.reduce((s, m) => s + (m.value ?? 0), 0)).toBe(0);
    });
  });
});

/* ========================================================================== */

describe("Levitation (LE.2, LE.3; readings 9, 15)", () => {
  const field = (extra = []) => [
    { from: "proto-gil", id: GIL, panel: { i: 5, j: 5 }, state: { factionId: "A", masterId: MAS, contract: "contracted" } },
    { from: "medusa", id: FOE, panel: { i: 5, j: 6 }, state: { factionId: "B" } },
    ...extra,
  ];

  it("passes an enemy's panel and still cannot stop on it", async () => {
    await withSubjects(field(), ({ unit, board }) => {
      const g = unit(GIL);
      expect(canPassThrough({ i: 5, j: 6 }, g, board)).toBe(true);
      expect(canStopOn({ i: 5, j: 6 }, g, board)).toBe(false);
    });
  });

  it("without it, the enemy is in the way", async () => {
    await withSubjects(field().map((s) => (s.id === GIL ? { ...s, effects: [{ defId: "npSeal" }] } : s)), ({ unit, board }) => {
      expect(canPassThrough({ i: 5, j: 6 }, unit(GIL), board)).toBe(false);
    });
  });

  it("an Evade and an Agility Check are both 3 lower, which helps him", async () => {
    await withSubjects([{ from: "proto-gil", id: GIL }], ({ unit }) => {
      const g = unit(GIL);
      const sum = (check) => checkPlan(g, check).modifiers.reduce((s, m) => s + (m.value ?? 0), 0);
      expect(sum("evade")).toBe(-3);
      expect(sum("agility")).toBe(-3);
    });
  });
});

/* ========================================================================== */

describe("Divinity B: Fixed Divine Damage (DI.*; reading 16)", () => {
  const strike = (attacker, defender, extra = {}) => computeDamage({
    attacker, defender,
    attack: { kind: "normal", component: "str" },
    base: { sources: [{ unit: "self", component: "str", factor: 1 }] },
    rolls: { attackMinus: 0 },
    options: rollOptionsFor({ attacker, defender, attack: { kind: "normal", component: "str" } }),
    ...extra,
  });

  it("adds 40 after every modifier, and leaves it out of the Injury Roll", async () => {
    await withSubjects([
      { from: "proto-gil", id: GIL },
      { from: "medusa", id: FOE, effects: [{ defId: "defUp", magnitude: 50 }] },
    ], ({ unit }) => {
      const r = strike(unit(GIL), unit(FOE));
      // 100 BA(STR), halved by Def Up 50%, then the 40 untouched by it.
      expect(r.total).toBe(90);
      expect(r.flags.fixedExtra).toBe(40);
      expect(r.flags.exceededInjuryThreshold).toBe(false);
    });
  });

  it("a hit over 100 before the 40 still exceeds; one at 100 does not", async () => {
    await withSubjects([{ from: "proto-gil", id: GIL }, { from: "medusa", id: FOE }], ({ unit }) => {
      const r = strike(unit(GIL), unit(FOE));
      expect(r.total).toBe(140);
      expect(r.flags.exceededInjuryThreshold).toBe(false);
    });
  });

  it("several hits leave the 40s out of the sum the Injury Roll is asked of", async () => {
    await withSubjects([{ from: "proto-gil", id: GIL }, { from: "medusa", id: FOE }], ({ unit }) => {
      const attacker = unit(GIL);
      const defender = unit(FOE);
      const attack = { kind: "normal", component: "str" };
      const r = computeDamageHits({
        attacker, defender, attack,
        base: { diceTotal: 60, successes: 2 },
        rolls: { attackMinus: 0 },
        options: rollOptionsFor({ attacker, defender, attack }),
      });
      expect(r.flags.fixedExtra).toBe(80);
      expect(r.flags.exceededInjuryThreshold).toBe(false);
    });
  });
});

/* ========================================================================== */

describe("Charisma A+ (CH.*)", () => {
  const field = (gilEffects = []) => [
    { from: "proto-gil", id: GIL, panel: { i: 5, j: 5 }, state: { factionId: "A" }, effects: gilEffects },
    { from: "medusa", id: ALLY, panel: { i: 5, j: 6 }, state: { factionId: "A" } },
  ];
  const flat = (u) => (u.modifiers ?? []).filter((m) => m.key === "flatDamage").map((m) => m.value);

  it("an ally beside him deals +27, and he does not (CH.1, CH.1.self)", async () => {
    await withSubjects(field(), ({ unit }) => {
      expect(flat(unit(ALLY))).toContain(27);
      expect(flat(unit(GIL))).not.toContain(27);
    }, { tokens: true });
  });

  it("goes quiet while he holds Atk Up (Charisma) (CH.neg.atk)", async () => {
    await withSubjects(field([{ defId: "atkUpCharisma", magnitude: 25, npMagnitude: 10 }]), ({ unit }) => {
      expect(flat(unit(ALLY))).not.toContain(27);
    }, { tokens: true });
  });
});

/* ========================================================================== */

describe("Golden Rule's Crit cut and its fallback (GR.p, GR.p.enki; readings 8, 14)", () => {
  const crit = (u, board) => fireEvent("damageDealt", [u], {
    tick: 10, turnsPerRound: 3, board, rolls: {},
    options: new Set(["attack:crit"]),
  });

  it("a Crit cuts every NP on its Cooldown by 1 Turn", async () => {
    await withSubjects([{ from: "proto-gil", id: GIL }], ({ unit, board, world: w }) => {
      const ba = abilityOf(w, GIL, "proto-gil-bab-ilu");
      const g = unit(GIL);
      const withClock = { ...g, abilities: g.abilities.map((a) => (a.id === ba.id ? { ...a, cooldownRemaining: 5 } : a)) };
      const out = crit(withClock, board);
      expect(out.filter((i) => i.t === "cooldown").length).toBeGreaterThan(0);
      expect(out.some((i) => i.t === "scheduleDelta")).toBe(false);
    });
  });

  it("with none on its Cooldown, it moves Enki's count instead", async () => {
    await withSubjects([{ from: "proto-gil", id: GIL }], ({ unit, board }) => {
      const out = crit(unit(GIL), board);
      expect(out.filter((i) => i.t === "scheduleDelta")).toEqual([expect.objectContaining({ unitId: GIL, delta: -1 })]);
      expect(out.some((i) => i.t === "cooldown")).toBe(false);
    });
  });
});

/* ========================================================================== */

describe("Bab-ilu's rolled debuffs (BI.*; readings 5, 18, 20)", () => {
  it("names twenty rows, each an effect that exists", async () => {
    await withSubjects([{ from: "proto-gil", id: GIL }], ({ world: w }) => {
      const ba = abilityOf(w, GIL, "proto-gil-bab-ilu");
      const table = ba.system.phases.find((p) => p.kind === "rollTable").entries;
      expect(Object.keys(table).map(Number).sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, k) => k + 1));
      for (const row of Object.values(table)) {
        for (const e of row.effects) expect(EffectRegistry.get(e.id), e.id).toBeTruthy();
      }
    });
  });

  it("Heal Dwn cuts healing by 30% and spares the Home Base; Drowning stops it all", async () => {
    await withSubjects([
      { from: "medusa", id: FOE, effects: [{ defId: "healDwn", magnitude: 30 }] },
      { from: "medusa", id: ALLY, effects: [{ defId: "drowning" }] },
    ], ({ unit }) => {
      expect(healingPercent(unit(FOE), "some skill")).toBe(-30);
      expect(healingPercent(unit(FOE), "Home Base")).toBe(0);
      expect(healingPercent(unit(ALLY), "Home Base")).toBe(-100);
    });
  });

  it("a repeated row that does not stack extends; a 9 counts a charge", async () => {
    await withSubjects([{ from: "medusa", id: FOE, effects: [{ defId: "npSeal", expiry: 13 }, { defId: "noBuff", uses: 1, expiry: 13 }] }], ({ unit }) => {
      const target = unit(FOE);
      const ctx = { turnsPerRound: 3, currentTick: 10, roll: 1 };
      const seal = applyEffect({ def: EffectRegistry.get("npSeal"), target, duration: "1◈", source: {}, ctx, stacking: "noneExtend" });
      expect(seal.intents.find((i) => i.t === "applyEffect").effect.expiry).toBe(16);
      const nb = applyEffect({ def: EffectRegistry.get("noBuff"), target, duration: "1◈", source: {}, ctx, stacking: "count", uses: 1 });
      expect(nb.intents.find((i) => i.t === "applyEffect").effect.uses).toBe(2);
    });
  });

  it("No Buff with charges spends one for each buff it stops", async () => {
    await withSubjects([{ from: "medusa", id: FOE, effects: [{ defId: "noBuff", uses: 2, expiry: 13 }] }], ({ unit }) => {
      const r = applyEffect({
        def: EffectRegistry.get("atkUp"), target: unit(FOE), magnitude: 20, duration: "1◈", source: {},
        ctx: { turnsPerRound: 3, currentTick: 10, roll: 1 },
      });
      expect(r.outcome).toBe("blocked");
      expect(r.intents).toEqual([expect.objectContaining({ t: "consumeUse", defId: "noBuff", count: 1 })]);
    });
  });
});

/* ========================================================================== */

describe("Bab-ilu's passive: what the second Attack forbids (BI.p.block, BI.p.evade; reading 24)", () => {
  it("Blocked: Block only; Evaded: Block or Evade; hit or failed: free", () => {
    expect(lockedReactions({ reaction: "block" })).toEqual(["evade", "nothing"]);
    expect(lockedReactions({ reaction: "evade", evaded: true })).toEqual(["nothing"]);
    expect(lockedReactions({ reaction: "evade", evaded: false })).toEqual([]);
    expect(lockedReactions({ reaction: "nothing" })).toEqual([]);
  });
});

/* ========================================================================== */

describe("Enkidu against Divinity (EC.*; readings 6, 7)", () => {
  const stun = (target, options) => applyEffect({
    def: EffectRegistry.get("stun"), target, duration: "1◈", source: {}, chance: 50,
    ctx: { turnsPerRound: 3, currentTick: 10, roll: 99, options },
    bypassesImmunity: options.has("target:attribute:divine"),
  });

  it("is an NP that costs his Master nothing", async () => {
    await withSubjects([{ from: "proto-gil", id: GIL }], ({ world: w }) => {
      const ek = abilityOf(w, GIL, "proto-gil-enkidu");
      expect(ek.type).toBe("noblePhantasm");
      expect(ek.system.noMasterCost).toBe(true);
    });
  });

  it("against a Divine DU, a Stun immunity does not stop it", async () => {
    await withSubjects([{ from: "medusa", id: FOE, effects: [{ defId: "immune:stun" }] }], ({ unit }) => {
      const divine = new Set(["target:attribute:divine"]);
      const r = stun({ ...unit(FOE), effects: [...unit(FOE).effects, "immune:stun"] }, divine);
      expect(r.trace.find((t) => t.step === "immunity").outcome).toBe("passed");
    });
  });
});

/* ========================================================================== */

describe("Enki's area spares whom it names (EK.spare.*; readings 21, 23)", () => {
  it("not him, not his Master, not a Levitating Unit, not Noah or Noah's allies within 2; his allies are hit", async () => {
    const noah = { type: "servant", id: "noah", name: "Noah", parameters: { str: "C", end: "C", agi: "C", mag: "C", luc: "C" },
      baseHealth: 1000, mov: 5, range: { panels: 1, targets: 1 }, baseAttack: { str: 100, mag: 100 }, attributes: [] };
    await withSubjects([
      { from: "proto-gil", id: GIL, panel: { i: 6, j: 6 }, state: { factionId: "A", masterId: MAS, contract: "contracted" } },
      { from: "master-advanced", id: MAS, panel: { i: 6, j: 5 }, state: { factionId: "A" } },
      { from: "medusa", id: ALLY, panel: { i: 6, j: 7 }, state: { factionId: "A" } },
      { from: "karna", id: FOE, panel: { i: 3, j: 3 }, state: { factionId: "B" } },
      { from: { ...noah, id: "floater", name: "Floater", attributes: ["levitating"] }, id: "levitatingFoe001", panel: { i: 2, j: 2 }, state: { factionId: "B" } },
      { from: noah, id: "noahUnit00000001", panel: { i: 9, j: 9 }, state: { factionId: "C" } },
      { from: "medea", id: "noahsAlly0000001", panel: { i: 9, j: 10 }, state: { factionId: "C" } },
      { from: "medea", id: "farFromNoah00001", panel: { i: 9, j: 12 }, state: { factionId: "C" } },
    ], ({ unit, board, world: w }) => {
      const enki = abilityOf(w, GIL, "proto-gil-enki");
      const caught = resolveTargets(enki.system.targeting, unit(GIL), board, { reach: "attack" }).units.map((t) => t.unitId);
      expect(caught).toContain(ALLY);
      expect(caught).toContain(FOE);
      expect(caught).not.toContain(GIL);
      expect(caught).not.toContain(MAS);
      expect(caught).not.toContain("levitatingFoe001");
      expect(caught).not.toContain("noahUnit00000001");
      expect(caught).not.toContain("noahsAlly0000001");
      expect(caught).toContain("farFromNoah00001");
    }, { settings: { boardSize: 13 } });
  });
});

/* ========================================================================== */

describe("Drowning's miss is its own (EK.drown; reading 19)", () => {
  it("80%, whatever Blind's exemptions say, and named on the card", () => {
    const u = { effects: ["drowning", "blind"] };
    expect(missChance(u, new Set(["self:skillActive:eyeOfTheMind"]))).toBe(80);
    expect(missSourceOf(u)).toBe("drowning");
  });
});

/* ========================================================================== */

describe("Enki's gate weighs the cost it will charge (EK.cost, EK.gate; found live)", () => {
  it("a Master on 95 of 115 can pay half his maximum, which replaces the EX cost of 100", async () => {
    const { canUseAbility } = await import("../../module/rules/costs.mjs");
    const { usageSpecFor } = await import("../../module/rules/ability-use.mjs");
    await withSubjects([
      { from: "proto-gil", id: GIL, panel: { i: 5, j: 5 }, state: { factionId: "A", masterId: MAS, contract: "contracted" } },
      { from: "master-advanced", id: MAS, panel: { i: 5, j: 4 }, state: { factionId: "A" } },
    ], ({ unit, world: w }) => {
      const enki = abilityOf(w, GIL, "proto-gil-enki");
      const master = unit(MAS);
      const at = (health) => canUseAbility({
        ability: usageSpecFor(enki), unit: unit(GIL),
        master: { ...master, health, maxHealth: 115 }, round: 10, gates: { npGateRound: 2, npGateRoundAssassin: 2 },
      });
      expect(at(95)).toEqual(expect.objectContaining({ ok: true }));
      // 57 is not above half of 115: the requirement refuses it, not the cost.
      expect(at(57).ok).toBe(false);
    });
  });
});
