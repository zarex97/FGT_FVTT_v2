/**
 * @file Kingprotea — the pure halves of her kit.
 * @see docs/36-case-remaining.md §36.7, char_orig_sheets/Copia de Kingprotea.md
 *
 * Everything here is layer 1 or 2, so it runs without a world. The parts that
 * need documents — the growth writing a token's size, the knockback cascade,
 * the stock-gain handler — are live-tested in `fgt2026` and recorded in Ch. 45.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

import { collectContributions, resolveValue } from "../../module/rules/elements.mjs";
import { removalPlan, removalResistOf, pendingRemovalRolls } from "../../module/rules/removal.mjs";
import { dispatch } from "../../module/engine/scheduler.mjs";
import * as I from "../../module/engine/intents.mjs";
import { order } from "../../module/engine/intents.mjs";
import { applyStatDeltas } from "../../module/rules/derived.mjs";
import { closeAttributes } from "../../module/domain/attributes.mjs";
import { lookup } from "../../module/domain/tables.mjs";
import { Rank } from "../../module/domain/rank.mjs";

/** @param {string} id @returns {object} */
const ability = (id) => parse(readFileSync(join("packs/_source/abilities", `${id}.yml`), "utf8"));
/** @param {string} id @returns {object} */
const effect = (id) => parse(readFileSync(join("packs/_source/effects", `${id}.yml`), "utf8"));

const SHEET = parse(readFileSync("packs/_source/servants/kingprotea.yml", "utf8"));
const HUGE_SCALE = ability("kingprotea-huge-scale");

/** Her Huge Scale contributions at `n` Proliferation stocks. */
function atStocks(n) {
  return collectContributions(
    [{ id: "hs", name: "Huge Scale", rank: "B", passiveRules: HUGE_SCALE.passiveRules }],
    { refs: { self: { baseHealth: 2000 } }, stacks: { proliferationStock: n } },
  );
}

/* ========================================================================== */
/*  Statline                                                                  */
/* ========================================================================== */

describe("Kingprotea's statline", () => {
  it("derives every printed figure from the tables", () => {
    // END EX => 2000, STR EX => 200, MAG D => 125.
    expect(SHEET.baseHealth).toBe(2000);
    expect(SHEET.baseAttack).toEqual({ str: 200, mag: 125 });
    expect(SHEET.mov).toBe(7);
    expect(SHEET.sustainability).toBe("7◈");
  });

  it("is Non-Hominidae, so the Servant implication is withheld", () => {
    const closed = closeAttributes(SHEET.attributes);
    // `Servant => Hominidae` UNLESS Non-Hominidae — the same shape as
    // Mannanán's `pseudoServant` withholding `spirit`.
    expect(closed).not.toContain("hominidae");
    expect(closed).toContain("spirit");
    // `Giant => Large` is the closure's, so `large` is not on her sheet.
    expect(SHEET.attributes).not.toContain("large");
    expect(closed).toContain("large");
  });

  it("starts at one panel, because Huge Scale grows a base rather than setting one", () => {
    expect(SHEET.footprint).toEqual({ w: 1, h: 1 });
  });
});

/* ========================================================================== */
/*  perStack — the mechanism §36.7 is about                                    */
/* ========================================================================== */

describe("perStack", () => {
  const el = (extra) => ({ key: "X", value: 10, ...extra });
  const ctx = (n) => ({ stacks: { s: n } });

  it("pays nothing at zero, including its base", () => {
    expect(resolveValue(el({ perStack: { effect: "s", base: 30 } }), null, ctx(0))).toBe(0);
  });

  it("scales linearly", () => {
    const spec = el({ perStack: { effect: "s" } });
    expect(resolveValue(spec, null, ctx(1))).toBe(10);
    expect(resolveValue(spec, null, ctx(4))).toBe(40);
  });

  it("adds the base once, from the first stack", () => {
    // "35% at one stock, +5% for every additional" = 30 + 5n.
    const spec = { key: "X", value: 5, perStack: { effect: "s", base: 30 } };
    expect(resolveValue(spec, null, ctx(1))).toBe(35);
    expect(resolveValue(spec, null, ctx(2))).toBe(40);
    expect(resolveValue(spec, null, ctx(10))).toBe(80);
  });

  it("steps every N with `each`", () => {
    const spec = el({ value: 1, perStack: { effect: "s", each: 3 } });
    for (const [stocks, size] of [[0, 0], [2, 0], [3, 1], [5, 1], [6, 2], [9, 3], [10, 3]]) {
      expect(resolveValue(spec, null, ctx(stocks)), `${stocks} stocks`).toBe(size);
    }
  });

  it("clamps at `max`", () => {
    const spec = el({ perStack: { effect: "s" }, max: 80 });
    expect(resolveValue(spec, null, ctx(8))).toBe(80);
    expect(resolveValue(spec, null, ctx(10))).toBe(80);
  });

  it("leaves an element with no `perStack` alone", () => {
    expect(resolveValue(el({}), null, ctx(5))).toBe(10);
  });
});

/* ========================================================================== */
/*  Huge Scale                                                                */
/* ========================================================================== */

describe("Huge Scale", () => {
  it("grants the occupancy bypass only while she is a Giant", () => {
    const grant = HUGE_SCALE.passiveRules.find((r) => r.key === "GrantedAbility");
    expect(grant.abilities).toEqual(["ignoresOccupancy"]);
    expect(grant.predicate).toEqual(["self:attribute:giant"]);
  });

  it("pays 20% of her ORIGINAL Max Health per stock", () => {
    // 20% of 2000 is 400, whatever her maximum has already grown to.
    expect(atStocks(1).statDeltas.find((d) => d.stat === "health.max").value).toBe(400);
    expect(atStocks(5).statDeltas.find((d) => d.stat === "health.max").value).toBe(2000);
    // At zero stocks the element still contributes, and contributes nothing.
    expect(atStocks(0).statDeltas.find((d) => d.stat === "health.max").value).toBe(0);
  });

  it("grows one panel every third stock, with Range up and MOV down", () => {
    for (const [stocks, step] of [[0, 0], [2, 0], [3, 1], [6, 2], [9, 3], [10, 3]]) {
      const out = atStocks(stocks);
      const w = out.statDeltas.find((d) => d.stat === "footprint.w");
      const range = out.statDeltas.find((d) => d.stat === "range.panels");
      const mov = out.statDeltas.find((d) => d.stat === "mov");
      expect(w?.value ?? 0, `${stocks} → footprint`).toBe(step);
      expect(range?.value ?? 0, `${stocks} → range`).toBe(step);
      expect(mov?.value ?? 0, `${stocks} → mov`).toBe(0 - step);
    }
  });

  it("grows square, so a 3x3 is three panels on each axis", () => {
    const out = atStocks(6);
    expect(out.statDeltas.find((d) => d.stat === "footprint.w").value).toBe(2);
    expect(out.statDeltas.find((d) => d.stat === "footprint.h").value).toBe(2);
  });

  it("caps NP damage reduction at 80%, not the 100% ten stocks would give", () => {
    const npDefUp = (n) => atStocks(n).modifiers.find((m) => m.key === "defUp");
    expect(npDefUp(1).npValue).toBe(10);
    expect(npDefUp(5).npValue).toBe(50);
    expect(npDefUp(8).npValue).toBe(80);
    expect(npDefUp(10).npValue).toBe(80);
    // ...and only against a Noble Phantasm.
    expect(npDefUp(3).predicate).toEqual(["attack:kind:np"]);
  });

  it("resists buff removal at 35 for one stock and +5 thereafter", () => {
    const resist = (n) => removalResistOf({ buffRemovalResist: atStocks(n).buffRemovalResist });
    expect(resist(0)).toBe(0);
    expect(resist(1)).toBe(35);
    expect(resist(2)).toBe(40);
    expect(resist(10)).toBe(80);
  });

  it("applies Endless Proliferation for 3◈+⅓◈ and pulls the NP forward 1◈", () => {
    const cooldown = HUGE_SCALE.phases.find((p) => p.kind === "cooldown");
    expect(cooldown.changes[0]).toMatchObject({ scope: "np", ticks: "1◈", direction: "down" });
    const applied = HUGE_SCALE.phases.find((p) => p.kind === "applyEffects");
    expect(applied.effects[0]).toEqual({ id: "endlessProliferation", duration: "3◈+⅓◈" });
    expect(HUGE_SCALE.cooldown).toBe("6◈");
  });

  it("moves the footprint through derived data, from a base of one panel", () => {
    const { changes } = applyStatDeltas(
      { footprint: { w: 1, h: 1 }, mov: 7, range: { panels: 1 }, health: { value: 2000, max: 2000 } },
      atStocks(6).statDeltas,
    );
    expect(changes["footprint.w"]).toBe(3);
    expect(changes["footprint.h"]).toBe(3);
    expect(changes.mov).toBe(5);
    expect(changes["range.panels"]).toBe(3);
    expect(changes["health.max"]).toBe(4400);
  });
});

/* ========================================================================== */
/*  The stocks themselves                                                     */
/* ========================================================================== */

describe("Proliferation stocks", () => {
  const stock = effect("proliferation-stock");

  it("is a separate buff per stock, capped at ten", () => {
    expect(stock.polarity).toBe("buff");
    expect(stock.stacking).toBe("magnitudeStacks");
    expect(stock.maxStacks).toBe(10);
  });

  it("carries no rules of its own", () => {
    // Everything a stock is worth lives on Huge Scale. An effect's rules are
    // collected once per INSTANCE, so a `perStack` element here would be
    // collected n times and scaled by n each time.
    expect(stock.rules).toEqual([]);
  });

  it("has no duration, because stocks outlive Endless Proliferation", () => {
    expect(stock.defaultDuration).toBeUndefined();
  });

  it("restores the current Health AFTER the stock that raises the ceiling", () => {
    // Found live: at one stock her maximum went 2000 → 2400 and her current
    // Health stayed at 2000. The restore and the stock are emitted by the same
    // handler, and `heal` ranks before `applyEffect`, so the 400 was clamped to
    // the maximum she had a moment earlier.
    const out = dispatch(
      { kind: "Heal", percentOfBase: 20 },
      { id: "kp", baseHealth: 2000, health: { value: 2000, max: 2000 } },
      { source: "Endless Proliferation" },
      { tick: 20, turnsPerRound: 3, board: { units: [] }, rolls: {} },
    );
    expect(out[0]).toMatchObject({ t: "heal", amount: 400, afterEffects: true });

    const ordered = order([out[0], I.applyEffect("kp", { defId: "proliferationStock" }, "kp")]);
    expect(ordered.map((i) => i.t)).toEqual(["applyEffect", "heal"]);
  });

  it("is granted at every turn end while Endless Proliferation stands", () => {
    const ep = effect("endless-proliferation");
    const handler = ep.rules.find((r) => r.key === "OnEvent");
    // Every Turn, not just her own -- ten Turns of buff for the ten stocks her
    // sheet caps at. The handler vocabulary's `turnEnd` is the owner's Turn.
    expect(handler.event).toBe("anyTurnEnd");
    expect(handler.then.map((a) => a.key)).toEqual(["ApplyEffect", "Heal"]);
    // Of the ORIGINAL maximum: her live maximum has already grown by the time
    // the second stock lands.
    expect(handler.then[1]).toEqual({ key: "Heal", percentOfBase: 20 });
  });
});

/* ========================================================================== */
/*  Buff removal                                                              */
/* ========================================================================== */

describe("buff removal", () => {
  const bearer = { buffRemovalResist: [{ value: 35, source: "Huge Scale" }] };
  const buff = { defId: "proliferationStock", polarity: "buff" };
  const debuff = { defId: "burn", polarity: "debuff" };

  it("rolls only for buffs, and only when something resists", () => {
    expect(pendingRemovalRolls({ candidates: [buff, debuff], bearer })).toEqual(["proliferationStock"]);
    expect(pendingRemovalRolls({ candidates: [buff], bearer: {} })).toEqual([]);
  });

  it("keeps a buff whose roll beats the reduced chance", () => {
    const plan = removalPlan({ candidates: [buff], bearer, rolls: { proliferationStock: 90 } });
    expect(plan.removed).toEqual([]);
    expect(plan.resisted[0]).toMatchObject({ chance: 65, roll: 90 });
  });

  it("removes it when the roll is under", () => {
    const plan = removalPlan({ candidates: [buff], bearer, rolls: { proliferationStock: 20 } });
    expect(plan.removed).toEqual(["proliferationStock"]);
  });

  it("never protects a debuff, so a self-cleanse is unaffected", () => {
    // Self-Suggestion removes her own debuffs while Huge Scale is protecting
    // her buffs; the two must not meet.
    const plan = removalPlan({ candidates: [debuff], bearer, rolls: {} });
    expect(plan.removed).toEqual(["burn"]);
  });

  it("is bypassed outright by Infantile Regression", () => {
    const plan = removalPlan({
      candidates: [buff], bearer, rolls: { proliferationStock: 100 }, ignoresProtection: true,
    });
    expect(plan.removed).toEqual(["proliferationStock"]);
    expect(pendingRemovalRolls({ candidates: [buff], bearer, ignoresProtection: true })).toEqual([]);
  });

  it("never removes an Unremovable effect, whatever the roll", () => {
    const plan = removalPlan({
      candidates: [{ defId: "fragarach", polarity: "status", unremovable: true }],
      bearer: {}, rolls: {}, ignoresProtection: true,
    });
    expect(plan.removed).toEqual([]);
  });
});

/* ========================================================================== */
/*  The rest of the kit                                                       */
/* ========================================================================== */

describe("Infantile Regression", () => {
  const ir = ability("kingprotea-infantile-regression");

  it("turns the stock into NP cooldown, ⅓◈ each", () => {
    const cooldown = ir.phases.find((p) => p.kind === "cooldown");
    expect(cooldown.changes[0]).toMatchObject({
      scope: "np", ticks: "⅓◈", direction: "down", perStack: { effect: "proliferationStock" },
    });
  });

  it("reduces her other Skills by 1◈, excluding itself", () => {
    const cooldown = ir.phases.find((p) => p.kind === "cooldown");
    expect(cooldown.changes[1]).toMatchObject({ scope: "skills", excludeSelf: true, ticks: "1◈" });
  });

  it("counts before it removes, because afterwards there is nothing to count", () => {
    expect(ir.phases.map((p) => p.kind)).toEqual(["cooldown", "removeEffect"]);
  });

  it("dispels through the protection those very stocks granted", () => {
    const removal = ir.phases.find((p) => p.kind === "removeEffect");
    expect(removal.ignoresRemovalProtection).toBe(true);
    expect(removal.effects).toEqual(["endlessProliferation", "proliferationStock"]);
  });
});

describe("Giant Monster of the Great River", () => {
  const gao = ability("kingprotea-giant-monster-of-the-great-river");

  it("fires on one named ability rather than a family", () => {
    const handler = gao.passiveRules[0];
    expect(handler.event).toBe("abilityUsed");
    expect(handler.ofContentId).toEqual(["kingprotea-monstrous-strength"]);
  });

  it("applies one buff worth X charges, X being her stock count", () => {
    const action = gao.passiveRules[0].then[0];
    expect(action.effect.id).toBe("npDmUpGao");
    expect(action.times).toEqual({ perStack: { effect: "proliferationStock" } });
  });

  it("decays one charge a Turn, but not on the Turn it arrived", () => {
    const def = effect("np-dm-up-gao");
    expect(def.stacking).toBe("count");
    const decay = def.rules.find((r) => r.key === "OnEvent");
    expect(decay.event).toEqual(["turnEnd", "actedTurnEnd"]);
    expect(decay.notOnApplyTurn).toBe(true);
    expect(decay.consumesUse).toBe(true);
  });

  it("is worth 10% of NP damage per charge", () => {
    const def = effect("np-dm-up-gao");
    const mod = def.rules.find((r) => r.key === "DamageModifier");
    const out = collectContributions(
      [{ id: "gao", name: "NP DmUp (GAO)", rules: [mod] }],
      { stacks: { npDmUpGao: 4 } },
    );
    expect(out.modifiers[0].value).toBe(40);
  });
});

describe("Mad Enhancement A+", () => {
  it("reduces damage taken by 55%, and NP damage by the 25% her sheet prints", () => {
    expect(lookup("madEnhancementDefence", Rank.parse("A+"))).toEqual([55, 25]);
  });

  it("halves the MAG share to 40, not 42.5", () => {
    const me = parse(readFileSync("packs/_source/class-skills/mad-enhancement.yml", "utf8"));
    const mag = me.activeRules.find((r) => r.predicate?.includes?.("attack:component:mag"));
    expect(mag.magnitudeFactor).toBe(0.5);
    expect(mag.magnitudeRoundTo).toBe(5);

    const out = collectContributions([{
      id: "me", name: "Mad Enhancement", rank: "A+", active: true, activeRules: me.activeRules,
    }], { options: new Set(["attack:component:mag"]) });
    const atk = out.modifiers.filter((m) => m.key === "atkUp");
    expect(atk.some((m) => m.value === 40)).toBe(true);
  });
});

describe("her sheet", () => {
  const known = new Set([
    ...readdirSync("packs/_source/abilities").filter((f) => f.endsWith(".yml"))
      .map((f) => parse(readFileSync(join("packs/_source/abilities", f), "utf8")).id),
    ...readdirSync("packs/_source/class-skills").filter((f) => f.endsWith(".yml"))
      .map((f) => parse(readFileSync(join("packs/_source/class-skills", f), "utf8")).id),
  ]);

  it("carries all twelve abilities the sheet lists", () => {
    expect(SHEET.abilities).toHaveLength(12);
    for (const entry of SHEET.abilities) expect(known.has(entry.ref)).toBe(true);
  });

  it("shares Alter Ego and Mad Enhancement rather than copying them", () => {
    const byRef = Object.fromEntries(SHEET.abilities.map((a) => [a.ref, a]));
    expect(byRef["class-alter-ego"]).toBeDefined();
    expect(byRef["class-mad-enhancement"].rank).toBe("A+");
    expect(byRef["class-independent-action"].rank).toBe("B");
  });

  it("prices Earth Mother's Wail and Airavata King Size as the sheet does", () => {
    const wail = ability("kingprotea-earth-mothers-wail");
    expect(wail.targeting.anchor).toEqual({ kind: "targetUnit", rangeBonus: 2 });
    expect(wail.damage).toEqual({ component: "mag" });
    expect(wail.cooldown).toBe("2◈");

    const np = ability("kingprotea-airavata-king-size");
    expect(np.rank).toBe("E");
    expect(np.damage).toEqual({ component: "str", multiplier: 2 });
    expect(np.targeting.shape).toEqual({ kind: "square", size: 3 });
    // The size bonus lands BEFORE the damage it is a bonus to.
    expect(np.phases[0]).toMatchObject({ kind: "applyEffects", when: "beforeDamage" });
    expect(np.phases[0].effects[0].perStack).toEqual({ effect: "proliferationStock", each: 3 });
  });

  it("gives Monstrous Strength EX its 150/75 at the Damage Step", () => {
    const ms = ability("kingprotea-monstrous-strength");
    expect(ms.timing.window).toEqual(["damageStep"]);
    expect(ms.activeRules[0]).toMatchObject({ component: "str", value: 150, npValue: 75 });
    expect(ms.cooldown).toBe("4◈");
  });

  it("gives Territory Creation EX both halves at 6d20 and 3d10+30", () => {
    const tc = ability("kingprotea-territory-creation");
    expect(tc.passiveRules[0].roll.formula).toBe("6d20");
    expect(tc.passiveRules[1].elements[0].roll.formula).toBe("3d10+30");
    expect(tc.passiveRules[1].stacking).toBe("highestOnly");
  });
});
