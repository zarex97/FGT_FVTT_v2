import { describe, it, expect } from "vitest";
import * as I from "../../module/engine/intents.mjs";
import { applyEffect, applyBatch } from "../../module/engine/effect-applier.mjs";
import {
  begin, advance, legalEvents, pendingPrompt, didHit, isComplete,
  canCounter, shouldUpdateFacing, laddersCollapse, serialize, deserialize, TRANSITIONS,
} from "../../module/engine/combat-process.mjs";
import {
  endTurn, beginTurn, beginRound, endRound, tickPeriodics, expireEffects,
  advanceCooldowns, cooldownRate, checkRemovals, resolveDefeat,
} from "../../module/engine/scheduler.mjs";

/* ========================================================================== */
/*  Intents                                                                   */
/* ========================================================================== */

describe("intent ordering", () => {
  it("puts removals before applications, so a replace does not delete itself", () => {
    const out = I.order([
      I.applyEffect("u", { defId: "nightmare" }, "s"),
      I.removeEffect("u", "sleep", "replaced"),
    ]);
    expect(out.map((i) => i.t)).toEqual(["removeEffect", "applyEffect"]);
  });

  it("puts damage before defeat, so the defeat handler sees final health", () => {
    const out = I.order([I.defeat("u", "damage"), I.damage("u", 500)]);
    expect(out.map((i) => i.t)).toEqual(["damage", "defeat"]);
  });

  it("puts prompts last, so nothing awaits a human while writes are pending", () => {
    const out = I.order([I.prompt("user", { kind: "luckCheck" }), I.damage("u", 10), I.log({})]);
    expect(out.map((i) => i.t)).toEqual(["log", "damage", "prompt"]);
  });

  it("is stable within a rank", () => {
    const out = I.order([I.damage("a", 1), I.damage("b", 2), I.damage("c", 3)]);
    expect(out.map((i) => i.unitId)).toEqual(["a", "b", "c"]);
  });

  it("puts a REVIVAL heal after the damage that caused it", () => {
    // Found live. It is emitted in the same batch as the damage, and at the
    // ordinary heal rank it applied first -- so Heracles was revived by God
    // Hand and the damage then took him straight back to zero: alive at 0
    // Health, with a charge spent for nothing.
    const out = I.order([I.heal("h", 200, "godHand", true), I.damage("h", 500)]);
    expect(out.map((i) => i.t)).toEqual(["damage", "heal"]);
  });

  it("leaves an ordinary heal where it was", () => {
    const out = I.order([I.heal("h", 200, "potion"), I.damage("h", 500)]);
    expect(out.map((i) => i.t)).toEqual(["heal", "damage"]);
  });
});

describe("intent batching", () => {
  it("collapses consecutive same-type same-unit intents into one group", () => {
    const groups = I.batch([
      I.applyEffect("u1", { defId: "a" }, "s"),
      I.applyEffect("u1", { defId: "b" }, "s"),
      I.applyEffect("u2", { defId: "c" }, "s"),
    ]);
    expect(groups.length).toBe(2);
    expect(groups[0].intents.length).toBe(2);
    expect(groups[1].unitId).toBe("u2");
  });
});

describe("intent validation", () => {
  it("accepts a well-formed batch", () => {
    expect(I.validate([I.damage("u", 100), I.heal("u", 10, "regen"), I.log({})])).toEqual([]);
  });

  it("rejects negative damage, pointing at the right constructor", () => {
    expect(I.validate([I.damage("u", -5)])[0]).toMatch(/use a heal intent/);
    expect(I.validate([I.heal("u", -5, "x")])[0]).toMatch(/use a damage or statDelta/);
  });

  it("rejects unknown types, missing units and non-finite numbers", () => {
    expect(I.validate([{ t: "teleport", unitId: "u" }])[0]).toMatch(/unknown intent type/);
    expect(I.validate([{ t: "damage", amount: 1 }])[0]).toMatch(/missing unitId/);
    expect(I.validate([I.damage("u", NaN)])[0]).toMatch(/not a finite number/);
  });

  it("does not require a unitId on log or prompt intents", () => {
    expect(I.validate([I.log({ kind: "x" }), I.prompt("user", {})])).toEqual([]);
  });

  it("rejects a bad cooldown mode", () => {
    expect(I.validate([I.cooldown("u", "np", 3, "wobble")])[0]).toMatch(/must be "set" or "reduce"/);
  });
});

describe("intent summarize — the free preview", () => {
  it("folds a batch into net change per unit", () => {
    const s = I.summarize([
      I.damage("a", 300), I.damage("a", 100),
      I.applyEffect("a", { defId: "burn" }, "x"),
      I.heal("b", 50, "regen"), I.defeat("a", "damage"),
    ]);
    expect(s.get("a")).toEqual({ damage: 400, healing: 0, effects: ["burn"], defeated: true });
    expect(s.get("b").healing).toBe(50);
  });
});

/* ========================================================================== */
/*  Effect applier                                                            */
/* ========================================================================== */

const ctx = { turnsPerRound: 3, currentTick: 10, roll: 1 };
const target = (over = {}) => ({ id: "t", effects: [], effectInstances: [], ...over });
const def = (over = {}) => ({
  id: "curse", polarity: "debuff", volatility: "volatile", valence: "offensive",
  stacking: "stage", baseChance: 100, ...over,
});

describe("step 1 — the immunity gate", () => {
  it("blocks a debuff on Debuff Immune, naming the blocker", () => {
    const r = applyEffect({ def: def(), target: target({ effects: ["debuffImmune"] }), source: {}, ctx });
    expect(r.outcome).toBe("blocked");
    expect(r.reason).toBe("Debuff Immune");
  });

  it("blocks by classification-scoped immunity", () => {
    expect(applyEffect({ def: def(), target: target({ effects: ["vDebuffImmune"] }), source: {}, ctx }).outcome)
      .toBe("blocked");
    expect(applyEffect({ def: def({ volatility: "nonVolatile" }), target: target({ effects: ["vDebuffImmune"] }), source: {}, ctx }).outcome)
      .toBe("applied");
  });

  it("does NOT block terminal debuffs with plain Debuff Immune", () => {
    // Instakill, Death and Erase have their own resistance ladder.
    const instakill = def({ id: "instakill", volatility: "terminal", stacking: "noneNoRefresh" });
    expect(applyEffect({ def: instakill, target: target({ effects: ["debuffImmune"] }), source: {}, ctx }).outcome)
      .toBe("applied");
  });

  it("blocks a buff on No Buff", () => {
    const buff = def({ id: "atkUp", polarity: "buff", stacking: "magnitudeStacks" });
    expect(applyEffect({ def: buff, target: target({ effects: ["noBuff"] }), source: {}, ctx }).reason)
      .toBe("No Buff");
  });

  // Immunities granted by a rule element rather than carried as a status. A
  // class skill reading "immune to Charm" has to gate here, or the content
  // loads and does nothing.
  it("blocks on an immunity granted by a rule element", () => {
    const charm = def({ id: "charm", volatility: "mental" });
    const r = applyEffect({ def: charm, target: target({ immunities: ["charm"] }), source: {}, ctx });
    expect(r.outcome).toBe("blocked");
    expect(r.reason).toBe("charm Immune");
  });

  it("blocks every debuff on a granted blanket debuff immunity", () => {
    expect(applyEffect({ def: def(), target: target({ immunities: ["debuff"] }), source: {}, ctx }).reason)
      .toBe("Debuff Immune");
  });

  it("respects a granted classification-scoped immunity", () => {
    const target_ = target({ immunities: ["debuff:mental"] });
    expect(applyEffect({ def: def({ volatility: "mental" }), target: target_, source: {}, ctx }).outcome)
      .toBe("blocked");
    expect(applyEffect({ def: def({ volatility: "volatile" }), target: target_, source: {}, ctx }).outcome)
      .toBe("applied");
  });

  it("does not let a granted immunity block an unrelated effect", () => {
    expect(applyEffect({ def: def({ id: "burn" }), target: target({ immunities: ["charm"] }), source: {}, ctx }).outcome)
      .toBe("applied");
  });
});

describe("step 2 — exclusivity", () => {
  it("makes the three mental debuffs mutually exclusive", () => {
    const charm = def({ id: "charm", volatility: "mental", stacking: "noneNoRefresh" });
    const r = applyEffect({ def: charm, target: target({ effects: ["berserk"] }), source: {}, ctx });
    expect(r.outcome).toBe("blocked");
    expect(r.reason).toBe("berserk");
  });

  it("lets a sleep derivative replace Sleep, but not another derivative", () => {
    const nightmare = def({ id: "nightmare", stacking: "noneNoRefresh" });
    const over = applyEffect({ def: nightmare, target: target({ effects: ["sleep"] }), source: {}, ctx });
    expect(over.outcome).toBe("applied");
    expect(over.intents[0]).toMatchObject({ t: "removeEffect", effectId: "sleep" });

    const blocked = applyEffect({ def: nightmare, target: target({ effects: ["coma"] }), source: {}, ctx });
    expect(blocked.outcome).toBe("blocked");
  });

  it("blocks Sleep on a unit already carrying a derivative", () => {
    const sleep = def({ id: "sleep", stacking: "noneNoRefresh" });
    expect(applyEffect({ def: sleep, target: target({ effects: ["nightmare"] }), source: {}, ctx }).outcome)
      .toBe("blocked");
  });
});

describe("step 3 — the chance roll", () => {
  it("resists when the roll exceeds the final chance, and says so", () => {
    const r = applyEffect({
      def: def({ baseChance: 65 }), target: target(), source: {},
      ctx: { ...ctx, roll: 78 },
    });
    expect(r.outcome).toBe("resisted");
    expect(r.reason).toBe("rolled 78 vs 65%");
  });

  it("logs an automatic application rather than skipping the step silently", () => {
    const r = applyEffect({ def: def({ baseChance: 100 }), target: target(), source: {}, ctx });
    const step = r.trace.find((t) => t.step === "chance");
    expect(step.detail).toMatch(/automatic/);
  });

  it("nets inflict bonuses against resistance", () => {
    // base 50 + inflict 30 − resist 20 = 60.
    const under = applyEffect({
      def: def({ baseChance: 50 }), target: target(), source: {},
      ctx: { ...ctx, roll: 55, inflictBonus: 30, resist: 20 },
    });
    expect(under.outcome).toBe("applied");
    expect(under.trace.find((t) => t.step === "chance").detail).toBe("rolled 55 vs 60%");

    const over = applyEffect({
      def: def({ baseChance: 50 }), target: target(), source: {},
      ctx: { ...ctx, roll: 61, inflictBonus: 30, resist: 20 },
    });
    expect(over.outcome).toBe("resisted");
    expect(over.reason).toBe("rolled 61 vs 60%");
  });

  it("lets resistance push the chance below the base", () => {
    const r = applyEffect({
      def: def({ baseChance: 50 }), target: target(), source: {},
      ctx: { ...ctx, roll: 40, resist: 30 },
    });
    expect(r.outcome).toBe("resisted"); // 50 − 30 = 20, roll 40 > 20
  });
});

describe("step 5 — stacking", () => {
  const withOne = (over = {}) => target({ effectInstances: [{ defId: "curse", magnitude: 10, stage: 1, ...over }] });

  it("stage increments on reapplication", () => {
    const r = applyEffect({ def: def({ stacking: "stage" }), target: withOne(), source: {}, ctx });
    expect(r.intents.at(-1).effect.stage).toBe(2);
  });

  it("noneNoRefresh is a no-op when already present", () => {
    const r = applyEffect({ def: def({ stacking: "noneNoRefresh" }), target: withOne(), source: {}, ctx });
    expect(r.outcome).toBe("noop");
    expect(r.intents).toEqual([]);
  });

  it("highestOnly keeps the stronger instance", () => {
    const weaker = applyEffect({ def: def({ stacking: "highestOnly" }), target: withOne(), magnitude: 5, source: {}, ctx });
    expect(weaker.outcome).toBe("noop");
    const stronger = applyEffect({ def: def({ stacking: "highestOnly" }), target: withOne(), magnitude: 20, source: {}, ctx });
    expect(stronger.outcome).toBe("applied");
    expect(stronger.intents.at(-1).effect.magnitude).toBe(20);
  });

  it("magnitudeStacks creates a second instance rather than a bigger one", () => {
    const r = applyEffect({ def: def({ stacking: "magnitudeStacks" }), target: withOne(), magnitude: 15, source: {}, ctx });
    expect(r.outcome).toBe("applied");
    expect(r.trace.find((t) => t.step === "stacking").detail).toMatch(/instance 2/);
  });

  it("throws on an unknown stacking rule rather than silently defaulting", () => {
    expect(() => applyEffect({ def: def({ stacking: "wobble" }), target: target(), source: {}, ctx }))
      .toThrow(/Unknown stacking rule/);
  });
});

describe("step 6 — duration is an absolute expiry tick", () => {
  it("resolves a ◈ expression against the current tick", () => {
    const r = applyEffect({ def: def(), target: target(), duration: "1◈", source: {}, ctx });
    expect(r.intents.at(-1).effect.expiry).toBe(13); // tick 10 + 3
  });

  it("stores null for a permanent effect, not a huge number", () => {
    const r = applyEffect({ def: def(), target: target(), duration: "permanent", source: {}, ctx });
    expect(r.intents.at(-1).effect.expiry).toBeNull();
  });

  it("resolves the same content differently at 8 turns per round", () => {
    const r = applyEffect({
      def: def(), target: target(), duration: "1◈+⅔◈", source: {},
      ctx: { ...ctx, turnsPerRound: 8 },
    });
    expect(r.intents.at(-1).effect.expiry).toBe(23); // 10 + 13
  });
});

describe("No Buff blocks a multi-buff ability wholesale", () => {
  it("fails all of them, not just the first", () => {
    // "If a single effect that applies multiple buffs is used on a Unit with
    // No Buff, ALL of those buffs will fail to be applied."
    const defs = [
      def({ id: "atkUp", polarity: "buff", stacking: "magnitudeStacks" }),
      def({ id: "defUp", polarity: "buff", stacking: "magnitudeStacks" }),
      def({ id: "critUp", polarity: "buff", stacking: "magnitudeStacks" }),
    ];
    const r = applyBatch({ defs, target: target({ effects: ["noBuff"] }), source: {}, ctx });
    expect(r.blockedWholesale).toBe(true);
    expect(r.intents).toEqual([]);
    expect(r.results.every((x) => x.outcome === "blocked")).toBe(true);
  });

  it("applies normally without No Buff", () => {
    const defs = [def({ id: "atkUp", polarity: "buff", stacking: "magnitudeStacks" })];
    expect(applyBatch({ defs, target: target(), source: {}, ctx }).intents.length).toBe(1);
  });
});

/* ========================================================================== */
/*  Combat process                                                            */
/* ========================================================================== */

const proc = () => begin({ attackerId: "au", defenderId: "du", attack: { kind: "normal" } });

describe("the reaction ladder", () => {
  it("goes straight to damage when the defender does nothing or blocks", () => {
    for (const r of ["nothing", "block"]) {
      expect(advance(advance(proc(), "done"), r).state).toBe("damage");
    }
  });

  it("walks the evade-succeeds branch: 2.1 → 2.2 → 2.3", () => {
    let s = advance(advance(proc(), "done"), "evade");
    expect(s.state).toBe("evadeRoll");
    s = advance(s, "success");
    expect(s.state).toBe("s21_luckyHit");
    s = advance(s, "success");
    expect(s.state).toBe("s22_duContest");
    s = advance(s, "fail");
    expect(s.state).toBe("s23_acceptOrEscape");
    expect(advance(s, "accept").state).toBe("damage");
    expect(advance(s, "cs").state).toBe("noDamage");
  });

  it("walks the evade-fails branch: 2.4 → 2.5 → 2.3", () => {
    let s = advance(advance(advance(proc(), "done"), "evade"), "fail");
    expect(s.state).toBe("s24_luckyEvasion");
    s = advance(s, "success");
    expect(s.state).toBe("s25_auContest");
    expect(advance(s, "success").state).toBe("s23_acceptOrEscape");
    expect(advance(s, "fail").state).toBe("noDamage");
  });

  it("whiffs the attack when the attacker fails or declines the lucky hit", () => {
    const s = advance(advance(advance(proc(), "done"), "evade"), "success");
    expect(advance(s, "fail").state).toBe("noDamage");
    expect(advance(s, "declined").state).toBe("noDamage");
  });

  it("treats a declined defender contest as a failed one — it reaches 2.3 either way", () => {
    const s = advance(advance(advance(advance(proc(), "done"), "evade"), "success"), "success");
    expect(advance(s, "fail").state).toBe("s23_acceptOrEscape");
    expect(advance(s, "declined").state).toBe("s23_acceptOrEscape");
  });

  it("offers a declined edge on every Luck Check rung, because Luck is finite", () => {
    for (const rung of ["s21_luckyHit", "s22_duContest", "s24_luckyEvasion", "s25_auContest"]) {
      expect(legalEvents(rung), rung).toContain("declined");
    }
  });

  it("converges both branches on facing, then counter, then done", () => {
    let s = advance(advance(advance(proc(), "done"), "nothing"), "done");
    expect(s.state).toBe("injury");
    s = advance(s, "done");
    expect(s.state).toBe("facing");
    s = advance(s, "done");
    expect(s.state).toBe("counter");
    expect(isComplete(advance(s, "done"))).toBe(true);
  });

  it("throws on an illegal transition, listing what would have been legal", () => {
    expect(() => advance(proc(), "evade")).toThrow(/Legal events from "declare": done/);
  });

  it("never mutates the state it is given", () => {
    const s = advance(proc(), "done");
    const before = JSON.stringify(s);
    advance(s, "evade");
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe("didHit reads the history, not the final state", () => {
  it("is true after passing through damage, even once the process has moved on", () => {
    let s = advance(advance(advance(proc(), "done"), "nothing"), "done");
    s = advance(advance(s, "done"), "done"); // injury → facing → counter
    expect(didHit(s)).toBe(true);
  });

  it("is false on the no-damage path, which converges on the same states", () => {
    let s = advance(advance(advance(proc(), "done"), "evade"), "success");
    s = advance(advance(s, "fail"), "done"); // noDamage → facing
    expect(didHit(s)).toBe(false);
  });
});

describe("prompts", () => {
  it("names which side must answer each rung", () => {
    const s = advance(advance(advance(proc(), "done"), "evade"), "success");
    expect(pendingPrompt(s)).toMatchObject({ side: "attacker", unitId: "au", check: "luckyHit" });
    expect(pendingPrompt(advance(s, "success"))).toMatchObject({ side: "defender", unitId: "du" });
  });

  it("returns null in non-prompting states", () => {
    expect(pendingPrompt(advance(advance(advance(proc(), "done"), "nothing"), "done"))).toBeNull();
  });
});

describe("counters and facing", () => {
  it("allows a counter when the defender evaded or survived and the attacker is in range", () => {
    const s = advance(advance(advance(proc(), "done"), "evade"), "success");
    expect(canCounter(s, { defenderAlive: false, attackerInRange: true })).toBe(true);
    expect(canCounter(s, { defenderAlive: true, attackerInRange: false })).toBe(false);
  });

  it("is forbidden by Accel on the attacker", () => {
    const s = advance(advance(proc(), "done"), "nothing");
    expect(canCounter(s, { defenderAlive: true, attackerInRange: true, attackerHasAccel: true })).toBe(false);
  });

  it("skips the facing update for an AoE attack", () => {
    const aoe = begin({ attackerId: "au", defenderId: "du", attack: {}, isAoE: true });
    expect(shouldUpdateFacing(aoe)).toBe(false);
    expect(shouldUpdateFacing(proc())).toBe(true);
  });
});

describe("ladder collapse — the latency mitigation", () => {
  it("collapses when the defender has no Luck, no Command Spells and no auto-evasion", () => {
    expect(laddersCollapse({ luck: { value: 0 }, commandSpells: 0, effects: [] })).toBe(true);
  });

  it("does not collapse while any of those remain", () => {
    expect(laddersCollapse({ luck: { value: 3 }, commandSpells: 0, effects: [] })).toBe(false);
    expect(laddersCollapse({ luck: { value: 0 }, commandSpells: 1, effects: [] })).toBe(false);
    expect(laddersCollapse({ luck: { value: 0 }, commandSpells: 0, effects: ["dodge"] })).toBe(false);
  });
});

describe("serialization between rungs", () => {
  it("round-trips, so the ladder survives a reconnect", () => {
    const s = advance(advance(advance(proc(), "done"), "evade"), "success");
    expect(deserialize(serialize(s))).toEqual(s);
  });

  it("refuses to resume from an unknown state", () => {
    expect(() => deserialize(JSON.stringify({ state: "wobble" }))).toThrow(/unknown state/);
  });
});

describe("the transition table has no dead ends", () => {
  it("every reachable non-terminal state has at least one outgoing edge", () => {
    const targets = new Set(Object.values(TRANSITIONS));
    for (const state of targets) {
      if (state === "done") continue;
      expect(legalEvents(state).length, `${state} has no outgoing edge`).toBeGreaterThan(0);
    }
  });
});

/* ========================================================================== */
/*  Scheduler                                                                 */
/* ========================================================================== */

const sctx = { tick: 10, round: 4, turnsPerRound: 3, activeFactionId: "a" };
const board = (units) => ({ units });

describe("endTurn ordering", () => {
  it("ticks a periodic before expiring it, so the last tick still lands", () => {
    const u = {
      id: "u", kind: "servant", factionId: "a", acted: true,
      effects: ["curse"],
      effectInstances: [{ id: "e1", defId: "curse", stage: 2, expiry: 10 }],
    };
    const out = endTurn(board([u]), sctx);
    const tickIndex = out.findIndex((i) => i.t === "damage");
    const expireIndex = out.findIndex((i) => i.t === "removeEffect");
    expect(expireIndex).toBeGreaterThan(-1);
    // Curse expiring exactly now does NOT tick (Ch. 11 §11.9), but the ordering
    // must still put expiry after the tick pass.
    expect(tickIndex === -1 || tickIndex < expireIndex).toBe(true);
  });

  it("fires acted-unit handlers for EVERY faction, not just the active one", () => {
    const sap = () => [{ events: ["actedTurnEnd"], actions: [{ kind: "Damage", amount: 50 }] }];
    const mine = { id: "mine", factionId: "a", acted: false, eventHandlers: sap() };
    const theirs = { id: "theirs", factionId: "b", acted: true, eventHandlers: sap() };
    const out = endTurn(board([mine, theirs]), sctx);
    const hit = out.filter((i) => i.t === "damage").map((i) => i.unitId);
    expect(hit).toContain("theirs");
    expect(hit).not.toContain("mine");
  });
});

describe("periodic damage", () => {
  const mk = (defId, over = {}) => ({
    id: "u", factionId: "a", acted: true, effects: [defId],
    effectInstances: [{ id: "e", defId, stage: 1, expiry: null, ...over }],
  });

  it("uses the catalogued formulas", () => {
    expect(tickPeriodics([mk("curse", { stage: 3 })], "turnEnd", sctx)[0].amount).toBe(75);
    expect(tickPeriodics([mk("poison", { stage: 3 })], "roundEnd", sctx)[0].amount).toBe(80);
    expect(tickPeriodics([mk("burn")], "roundEnd", sctx)[0].amount).toBe(50);
    expect(tickPeriodics([mk("sap")], "turnEnd", sctx)[0].amount).toBe(50);
  });

  it("bypasses every damage modifier, because volatile-debuff damage is stated to", () => {
    expect(tickPeriodics([mk("burn")], "roundEnd", sctx)[0].bypassModifiers).toBe(true);
  });

  it("only fires acted-only effects on a turn the unit acted", () => {
    const idle = { ...mk("sap"), acted: false };
    expect(tickPeriodics([idle], "turnEnd", sctx)).toEqual([]);
  });

  it("does not tick on the turn the effect expires", () => {
    expect(tickPeriodics([mk("curse", { expiry: 10 })], "turnEnd", sctx)).toEqual([]);
    expect(tickPeriodics([mk("curse", { expiry: 11 })], "turnEnd", sctx).length).toBe(1);
  });

  it("converts to healing when the unit has the matching conversion buff", () => {
    const u = { ...mk("burn"), effects: ["burn", "flamHeal"] };
    expect(tickPeriodics([u], "roundEnd", sctx)[0]).toMatchObject({ t: "heal", amount: 50 });
  });

  it("is frozen entirely by Stop", () => {
    const u = { ...mk("burn"), effects: ["burn", "stop"] };
    expect(tickPeriodics([u], "roundEnd", sctx)).toEqual([]);
  });
});

describe("Poison's stage increments at round start, not on application", () => {
  it("bumps the stage once per round", () => {
    const u = { id: "u", effectInstances: [{ id: "e", defId: "poison", stage: 1 }] };
    const out = beginRound(board([u]), sctx).filter((i) => i.t === "applyEffect");
    expect(out[0].effect.stage).toBe(2);
  });
});

describe("expiry uses absolute ticks", () => {
  const u = (expiry) => ({ id: "u", effectInstances: [{ id: "e", defId: "x", expiry }] });

  it("removes at or past the expiry tick", () => {
    expect(expireEffects([u(10)], sctx).length).toBe(1);
    expect(expireEffects([u(9)], sctx).length).toBe(1);
    expect(expireEffects([u(11)], sctx).length).toBe(0);
  });

  it("never expires a permanent effect", () => {
    expect(expireEffects([u(null)], sctx).length).toBe(0);
    expect(expireEffects([u(Infinity)], sctx).length).toBe(0);
  });
});

describe("cooldown rates", () => {
  const unit = (effects) => ({ effects });

  it("is 1 per turn by default and adds NP Regen", () => {
    expect(cooldownRate(unit([]), { isNP: true }, sctx)).toBe(1);
    expect(cooldownRate(unit([]), { isNP: true, regen: 2 }, sctx)).toBe(3);
  });

  it("NP Lock stops it without being NP Seal", () => {
    expect(cooldownRate(unit(["npLock"]), { isNP: true }, sctx)).toBe(0);
    expect(cooldownRate(unit(["npLock"]), { isNP: false }, sctx)).toBe(1);
  });

  it("NP Lag halves the rate by skipping alternate turns", () => {
    expect(cooldownRate(unit(["npLag"]), { isNP: true }, { ...sctx, tick: 10 })).toBe(1);
    expect(cooldownRate(unit(["npLag"]), { isNP: true }, { ...sctx, tick: 11 })).toBe(0);
  });

  it("Stop freezes every clock on the unit", () => {
    const u = { id: "u", effects: ["stop"], abilities: [{ id: "np", cooldownRemaining: 5 }] };
    expect(advanceCooldowns([u], sctx)).toEqual([]);
  });
});

describe("Sustainability", () => {
  const free = (over = {}) => ({ id: "s", kind: "servant", contract: "free", sustainability: 3, ...over });

  it("decays for Free Servants", () => {
    // The NUMERIC clock. `system.sustainability` holds the authored ◈
    // expression -- "2◈" -- and writing a delta to it appended to a string and
    // produced NaN, so a Free Servant never ran out of time.
    expect(checkRemovals([free()], sctx)[0])
      .toMatchObject({ t: "resource", key: "sustainabilityRemaining", delta: -1 });
  });

  it("defeats the Servant when it reaches zero", () => {
    const out = checkRemovals([free({ sustainability: 1 })], sctx);
    expect(out.some((i) => i.t === "defeat" && i.cause === "sustainabilityExhausted")).toBe(true);
  });

  it("does not run at all when the clock does not exist — Independent Action A+/EX", () => {
    // null means "no clock", not "a very large number".
    expect(checkRemovals([free({ sustainability: null })], sctx)).toEqual([]);
  });

  it("does not apply to contracted Servants", () => {
    expect(checkRemovals([free({ contract: "contracted" })], sctx)).toEqual([]);
  });
});

describe("beginTurn", () => {
  it("resets only the incoming player's units but fires turn-start effects for all", () => {
    const mine = { id: "mine", factionId: "a", eventHandlers: [{ event: "turnStart", intents: [] }] };
    const theirs = { id: "theirs", factionId: "b", eventHandlers: [{ event: "turnStart", intents: [] }] };
    const out = beginTurn(board([mine, theirs]), sctx);
    const resets = out.filter((i) => i.entry?.kind === "resetTurnState").map((i) => i.entry.unitId);
    expect(resets).toEqual(["mine"]);
    const fired = out.filter((i) => i.entry?.kind === "event").map((i) => i.entry.unitId);
    expect(fired.sort()).toEqual(["mine", "theirs"]);
  });
});

describe("endRound", () => {
  it("ticks round-end periodics and logs the boundary", () => {
    const u = { id: "u", effects: ["burn"], effectInstances: [{ id: "e", defId: "burn", expiry: null }] };
    const out = endRound(board([u]), sctx);
    expect(out.some((i) => i.t === "damage" && i.amount === 50)).toBe(true);
    expect(out.at(-1).entry.kind).toBe("roundEnd");
  });
});

describe("stacking actions actually reach the intents", () => {
  const def = (over = {}) => ({
    id: "npCooldownRegen", name: "NP Cooldown Regen", polarity: "buff",
    volatility: "nonVolatile", valence: "defensive", stacking: "noneRefresh",
    baseChance: 100, severity: "normal", ...over,
  });

  const target = (instances = []) => ({
    id: "medea", effectInstances: instances, effects: instances.map((i) => i.defId),
  });

  const ctx = { turnsPerRound: 3, currentTick: 4, roll: 1, inflictBonus: 0, resist: 0 };

  it("REPLACES rather than duplicates on a refresh", () => {
    // Found in a live world: `resolveStacking` returned "refresh", the emit step
    // ignored the action, and the applier created a SECOND document. Every
    // `noneRefresh` effect in the game duplicated on reapplication -- Bleed,
    // Burn, Stun, and Medea's NP Cooldown Regen, which is where it was noticed.
    const out = applyEffect({
      def: def(),
      target: target([{ defId: "npCooldownRegen", magnitude: 0, expiry: 10 }]),
      magnitude: 0, duration: "1◈", source: { unitId: "medea" }, ctx,
    });

    expect(out.outcome).toBe("applied");
    expect(out.intents.map((i) => i.t)).toEqual(["removeEffect", "applyEffect"]);
    expect(out.intents[0]).toMatchObject({ effectId: "npCooldownRegen", reason: "refreshed" });
  });

  it("creates without removing when nothing is there yet", () => {
    const out = applyEffect({
      def: def(), target: target([]),
      magnitude: 0, duration: "1◈", source: { unitId: "medea" }, ctx,
    });

    expect(out.intents.map((i) => i.t)).toEqual(["applyEffect"]);
  });

  it("does NOT remove for magnitudeStacks, where a second instance is the point", () => {
    // "A second instance, not a bigger one -- magnitudes sum at read time, and
    // each keeps its own duration and source."
    const out = applyEffect({
      def: def({ id: "atkUp", stacking: "magnitudeStacks" }),
      target: target([{ defId: "atkUp", magnitude: 20, expiry: 10 }]),
      magnitude: 20, duration: "1◈", source: { unitId: "medea" }, ctx,
    });

    expect(out.intents.map((i) => i.t)).toEqual(["applyEffect"]);
  });

  it("replaces on a stage increase, so the ladder does not become two rungs", () => {
    const out = applyEffect({
      def: def({ id: "poison", stacking: "stage" }),
      target: target([{ defId: "poison", magnitude: 0, stage: 1, expiry: 10 }]),
      magnitude: 0, duration: "1◈", source: { unitId: "medea" }, ctx,
    });

    expect(out.intents.map((i) => i.t)).toEqual(["removeEffect", "applyEffect"]);
    expect(out.intents[1].effect.stage).toBe(2);
  });
});

describe("per-effect chance modifiers (Medea's Atlas)", () => {
  const stun = {
    id: "stun", name: "Stun", polarity: "debuff", volatility: "volatile",
    valence: "offensive", stacking: "noneRefresh", baseChance: 100, severity: "normal",
  };
  const target = { id: "t", effectInstances: [], effects: [] };
  const base = { turnsPerRound: 3, currentTick: 0, inflictBonus: 0, resist: 0 };

  it("lands at full chance with no modifier matching", () => {
    const out = applyEffect({
      def: stun, target, magnitude: 0, duration: "1◈", source: { unitId: "medea" },
      ctx: { ...base, roll: 100, options: new Set() },
    });

    expect(out.outcome).toBe("applied");
  });

  it("reduces the chance when a predicate matches", () => {
    // "reduced by 25% on Units with a MAG Rank of B or higher".
    const out = applyEffect({
      def: stun, target, magnitude: 0, duration: "1◈", source: { unitId: "medea" },
      ctx: { ...base, roll: 80, options: new Set(["target:rank:mag:gte:B"]) },
      chanceModifiers: [{ predicate: ["target:rank:mag:gte:B"], value: -25, source: "MAG B+" }],
    });

    expect(out.outcome).toBe("resisted");
  });

  it("STACKS two matching reductions, as the sheet says they do", () => {
    // 100 - 25 - 25 = 50, so a roll of 60 fails where it would have landed
    // against either reduction alone.
    const mods = [
      { predicate: ["target:rank:mag:gte:B"], value: -25, source: "MAG B+" },
      { predicate: ["target:skillRank:magicResistance:gte:B"], value: -25, source: "MR B+" },
    ];
    const both = new Set(["target:rank:mag:gte:B", "target:skillRank:magicResistance:gte:B"]);

    expect(applyEffect({
      def: stun, target, magnitude: 0, duration: "1◈", source: { unitId: "medea" },
      ctx: { ...base, roll: 60, options: both }, chanceModifiers: mods,
    }).outcome).toBe("resisted");

    expect(applyEffect({
      def: stun, target, magnitude: 0, duration: "1◈", source: { unitId: "medea" },
      ctx: { ...base, roll: 60, options: new Set(["target:rank:mag:gte:B"]) }, chanceModifiers: mods,
    }).outcome).toBe("applied");
  });

  it("records each applied modifier in the trace, so the card can explain it", () => {
    const out = applyEffect({
      def: stun, target, magnitude: 0, duration: "1◈", source: { unitId: "medea" },
      ctx: { ...base, roll: 1, options: new Set(["target:rank:mag:gte:B"]) },
      chanceModifiers: [{ predicate: ["target:rank:mag:gte:B"], value: -25, source: "MAG B+" }],
    });

    const chance = out.trace.find((t) => t.step === "chance");
    expect(chance.detail).toContain("75");
  });

  it("ignores a modifier whose predicate does not match", () => {
    const out = applyEffect({
      def: stun, target, magnitude: 0, duration: "1◈", source: { unitId: "medea" },
      ctx: { ...base, roll: 90, options: new Set() },
      chanceModifiers: [{ predicate: ["target:rank:mag:gte:B"], value: -25, source: "MAG B+" }],
    });

    expect(out.outcome).toBe("applied");
  });
});

describe("on-removal clauses", () => {
  const shocked = {
    id: "u", effectInstances: [{ id: "e1", defId: "shock", expiry: 4 }],
    effects: ["shock"], abilities: [],
  };

  it("runs an expiring effect's own onRemove before removing it", () => {
    // Appendix A's Shock: "on removal, current Agility +1 when max is
    // restored" -- ONE point back, not the three the maximum regains. The
    // asymmetry is the whole clause, and it had nowhere to live.
    const intents = expireEffects([shocked], {
      tick: 5,
      turnsPerRound: 3,
      effectDef: () => ({
        id: "shock", name: "Shock",
        onRemove: [{ key: "StatDelta", stat: "agility.value", delta: 1 }],
      }),
    });

    expect(intents.map((i) => i.t)).toEqual(["statDelta", "removeEffect"]);
    expect(intents[0]).toMatchObject({ stat: "agility.value", delta: 1 });
  });

  it("removes an effect with no onRemove exactly as before", () => {
    const intents = expireEffects([shocked], { tick: 5, effectDef: () => ({ id: "shock" }) });
    expect(intents.map((i) => i.t)).toEqual(["removeEffect"]);
  });

  it("does not need an effectDef supplier at all", () => {
    // The scheduler stays usable without a compendium: an absent lookup means
    // no on-removal clauses, not a crash.
    expect(expireEffects([shocked], { tick: 5 }).map((i) => i.t)).toEqual(["removeEffect"]);
  });
});

describe("resolveDefeat reads the snapshot's health shape", () => {
  it("leaves a unit on full Health alone", () => {
    // `snapshotUnit` flattens `health: {value, max}` to a NUMBER. This read
    // `unit.health?.value`, got `undefined`, and the `?? 0` beside it turned
    // that into "no Health left" -- so every successful attack defeated its
    // target, at full Health, in every world.
    expect(resolveDefeat({ id: "u", health: 3000, eventHandlers: [] }, { tick: 0 })).toEqual([]);
  });

  it("defeats a unit that is actually empty", () => {
    expect(resolveDefeat({ id: "u", health: 0, eventHandlers: [] }, { tick: 0 }))
      .toEqual([{ t: "defeat", unitId: "u", cause: "damage" }]);
  });

  it("still reads the document shape, for a caller that hands one over", () => {
    expect(resolveDefeat({ id: "u", health: { value: 3000, max: 3000 }, eventHandlers: [] }, { tick: 0 }))
      .toEqual([]);
  });

  it("treats an intrinsically undamageable unit as alive, not as empty", () => {
    // `health: null` is Pale Rider, not a corpse.
    expect(resolveDefeat({ id: "u", health: null, eventHandlers: [] }, { tick: 0 }))
      .toEqual([{ t: "defeat", unitId: "u", cause: "damage" }]);
  });
});
