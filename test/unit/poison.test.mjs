/**
 * @file The poison family, and the four mechanisms it needed.
 * @see docs/A-effect-catalogue.md §A.12, docs/11-effect-engine.md §11.5
 *
 * Poison is the first staged effect authored, and building it exposed a
 * mechanism at each layer that had a name and no reader: the `effect:` shorthand
 * every rider in Appendix A is written in, the `target: victim` Ch. 32 already
 * writes, the per-instance `visibility`/`attributionHidden` pair `0.2.0` put on
 * the schema, and an unstated duration meaning "expires this instant".
 */

import { describe, it, expect } from "vitest";
import { tickPeriodics, fireEvent, PERIODICS } from "../../module/engine/scheduler.mjs";
import { normalizeHandler } from "../../module/rules/elements.mjs";
import { applyEffect } from "../../module/engine/effect-applier.mjs";

const ctx = { tick: 10, turnsPerRound: 3, rolls: {}, options: new Set() };

/** A unit carrying one Poison instance at `stage`. */
const poisoned = (stage, over = {}) => ({
  id: "v", effects: ["poison"], acted: true,
  effectInstances: [{ id: "e1", defId: "poison", stage, expiry: null, ...(over.instance ?? {}) }],
  ...over,
});

describe("the tick", () => {
  it("deals 20 × 2^(N−1) at the end of the Round", () => {
    for (const [stage, amount] of [[1, 20], [2, 40], [3, 80], [4, 160], [5, 320]]) {
      const [intent] = tickPeriodics([poisoned(stage)], "roundEnd", ctx);
      expect(intent.amount).toBe(amount);
    }
  });

  it("bypasses every damage modifier", () => {
    // Volatile-debuff damage "ignores all effects that modify the damage taken",
    // which is why `Deadly Poison` cannot be a `DamageModifier`.
    const [intent] = tickPeriodics([poisoned(2)], "roundEnd", ctx);
    expect(intent.bypassModifiers).toBe(true);
    expect(intent.periodic).toBe(true);
  });

  it("does not tick at turn end", () => {
    expect(tickPeriodics([poisoned(1)], "turnEnd", ctx)).toEqual([]);
  });
});

describe("PeriodicOverride (Ch. 32, Sikera Ušum clause c)", () => {
  // "Units inflicted with Poison while within this NP area receive Poison
  // damage at the end of its Turn and at the end of any Turn it Acts, IN
  // ADDITION TO at the end of the Round." A field's `PeriodicOverride`
  // interior rule (`rules/bounded-fields.mjs`'s `annotateFields`) widens
  // which boundaries this specific instance answers to, on top of its
  // ordinary `roundEnd`.
  const widened = (over = {}) => poisoned(1, {
    periodicOverrides: [{ effectId: "poison", triggers: ["turnEnd", "actedTurnEnd"] }],
    ...over,
  });

  it("still ticks at round end, unaffected", () => {
    expect(tickPeriodics([widened()], "roundEnd", ctx)[0]?.amount).toBe(20);
  });

  it("also ticks at turn end when it is this unit's own turn", () => {
    const unit = widened({ factionId: "f1" });
    expect(tickPeriodics([unit], "turnEnd", { ...ctx, activeFactionId: "f1" })[0]?.amount).toBe(20);
  });

  it("does NOT tick at turn end for somebody else's turn", () => {
    // "The end of ITS Turn" -- a `turnEnd` boundary belonging to a different
    // faction must not widen this unit's Poison too.
    const unit = widened({ factionId: "f1" });
    expect(tickPeriodics([unit], "turnEnd", { ...ctx, activeFactionId: "f2" })).toEqual([]);
  });

  it("also ticks at actedTurnEnd, regardless of faction", () => {
    expect(tickPeriodics([widened()], "actedTurnEnd", ctx)[0]?.amount).toBe(20);
  });

  it("an ordinary poison instance with no override still does not tick at either boundary", () => {
    expect(tickPeriodics([poisoned(1, { factionId: "f1" })], "turnEnd", { ...ctx, activeFactionId: "f1" }))
      .toEqual([]);
    expect(tickPeriodics([poisoned(1)], "actedTurnEnd", ctx)).toEqual([]);
  });
});

describe("Deadly Poison", () => {
  it("doubles it", () => {
    const unit = poisoned(2, { effects: ["poison", "deadlyPoison"] });
    expect(tickPeriodics([unit], "roundEnd", ctx)[0].amount).toBe(80);
  });

  it("does not touch Burn, which is a different tick", () => {
    const unit = {
      id: "v", effects: ["burn", "deadlyPoison"], acted: true,
      effectInstances: [{ id: "e1", defId: "burn", expiry: null }],
    };
    expect(tickPeriodics([unit], "roundEnd", ctx)[0].amount).toBe(PERIODICS.burn.amount({}));
  });

  it("still converts to healing for a Unit with PoisHeal", () => {
    const unit = poisoned(1, { effects: ["poison", "deadlyPoison", "poisHeal"] });
    const [intent] = tickPeriodics([unit], "roundEnd", ctx);
    expect(intent.t).toBe("heal");
    expect(intent.amount).toBe(40);
  });
});

describe("Secret Poison's tick", () => {
  it("carries the hidden flag so the tally can be kept", () => {
    // Q47: the Health comes off on schedule and only the CAUSE is deferred, so
    // displayed and real Health never diverge.
    const unit = poisoned(1, { instance: { attributionHidden: true } });
    expect(tickPeriodics([unit], "roundEnd", ctx)[0].attributionHidden).toBe(true);
  });

  it("leaves an ordinary Poison unmarked", () => {
    expect(tickPeriodics([poisoned(1)], "roundEnd", ctx)[0].attributionHidden).toBe(false);
  });
});

describe("the `effect:` shorthand", () => {
  const handler = (el) => normalizeHandler(el, { rank: null, source: "s", ability: { id: "a" }, ctx: {} });

  it("desugars to an ApplyEffect action", () => {
    // It desugared to NOTHING: `normalizeActions` read `then` and `revive` and
    // no third thing, so every handler written this way produced an empty action
    // list. Two shipped effects were inert twice over -- the event that would
    // have fired them did not exist either.
    const h = handler({ key: "OnEvent", event: "damageDealt", target: "victim", effect: { id: "poison" } });
    expect(h.actions).toEqual([{ kind: "ApplyEffect", target: "victim", effect: { id: "poison" } }]);
  });

  it("carries the chance, the duration and the stage count", () => {
    const h = handler({
      key: "OnEvent", event: "damageDealt", target: "victim",
      effect: { id: "deadlyPoison" }, chance: 25, duration: "1◈", stages: 2, secret: true,
    });
    expect(h.actions[0]).toMatchObject({ chance: 25, duration: "1◈", stages: 2, secret: true });
  });

  it("defaults to the handler's owner, so a rider must say `victim`", () => {
    const h = handler({ key: "OnEvent", event: "damageDealt", effect: { id: "poison" } });
    expect(h.actions[0].target).toBe("self");
  });

  it("composes with an explicit `then` list rather than replacing it", () => {
    const h = handler({
      key: "OnEvent", event: "damageDealt",
      then: [{ key: "Message", text: "hi" }],
      effect: { id: "poison" }, target: "victim",
    });
    expect(h.actions.map((a) => a.kind)).toEqual(["Message", "ApplyEffect"]);
  });
});

describe("where an event-applied effect lands", () => {
  const owner = {
    id: "s", factionId: "red", panel: { i: 0, j: 0 }, effects: [], abilities: [],
    eventHandlers: [normalizeHandler({
      key: "OnEvent", event: "damageDealt", automatic: true,
      target: "victim", effect: { id: "poison" },
    }, { rank: null, source: "Projectile", ability: { id: "a" }, ctx: {} })],
  };

  /** The effect applications a firing produced, ignoring the audit entry. */
  const applications = (intents) => intents.filter((i) => i.t === "applyEffect");

  it("reaches the victim the event carries, not the handler's owner", () => {
    const intents = fireEvent("damageDealt", [owner], { ...ctx, victim: { unitId: "d" } });
    expect(applications(intents).map((i) => i.unitId)).toEqual(["d"]);
  });

  it("emits nothing when the event has no victim", () => {
    // A rider with nobody to ride is not a rider on its owner.
    expect(applications(fireEvent("damageDealt", [owner], ctx))).toEqual([]);
  });

  it("reaches everybody inside a radius for `nearby`", () => {
    const cloud = {
      ...owner,
      eventHandlers: [normalizeHandler({
        key: "OnEvent", event: "turnEnd", automatic: true,
        then: [{
          key: "ApplyEffect", target: "nearby", radius: 2,
          relations: ["any"], effect: { id: "poison" },
        }],
      }, { rank: null, source: "Zabaniya", ability: { id: "z" }, ctx: {} })],
    };
    const board = {
      units: [
        cloud,
        { id: "near-ally", factionId: "red", panel: { i: 1, j: 1 } },
        { id: "near-foe", factionId: "blue", panel: { i: 0, j: 2 } },
        { id: "far", factionId: "blue", panel: { i: 9, j: 9 } },
      ],
    };
    const intents = fireEvent("turnEnd", [cloud], { ...ctx, board });
    // "Any Unit" -- the cloud does not check badges -- but never its own owner.
    expect(applications(intents).map((i) => i.unitId).sort()).toEqual(["near-ally", "near-foe"]);
  });

  it("honours a relation list when one is given", () => {
    const cloud = {
      ...owner,
      eventHandlers: [normalizeHandler({
        key: "OnEvent", event: "turnEnd", automatic: true,
        then: [{ key: "ApplyEffect", target: "nearby", radius: 2, relations: ["enemy"], effect: { id: "poison" } }],
      }, { rank: null, source: "x", ability: { id: "z" }, ctx: {} })],
    };
    const board = {
      units: [
        cloud,
        { id: "ally", factionId: "red", panel: { i: 1, j: 1 } },
        { id: "foe", factionId: "blue", panel: { i: 0, j: 2 } },
      ],
    };
    expect(applications(fireEvent("turnEnd", [cloud], { ...ctx, board })).map((i) => i.unitId))
      .toEqual(["foe"]);
  });
});

describe("staging an application", () => {
  const def = { id: "poison", polarity: "debuff", volatility: "volatile", stacking: "stage", baseChance: 100 };
  const target = (instances = []) => ({ id: "v", effects: [], effectInstances: instances, applicationChances: [] });
  const applyCtx = { turnsPerRound: 3, currentTick: 5, roll: 1 };

  it("adds one stage by default", () => {
    const out = applyEffect({ def, target: target(), source: {}, ctx: applyCtx });
    expect(out.intents.at(-1).effect.stage).toBe(1);
  });

  it("adds N at once for a clause that states a stage", () => {
    // "Inflicts Stage 3 Poison on the DU."
    const out = applyEffect({ def, target: target(), source: {}, ctx: applyCtx, stages: 3 });
    expect(out.intents.at(-1).effect.stage).toBe(3);
  });

  it("adds to what is already there", () => {
    const held = [{ id: "e1", defId: "poison", stage: 2 }];
    const out = applyEffect({
      def, target: { ...target(held), effects: ["poison"] }, source: {}, ctx: applyCtx, stages: 3,
    });
    expect(out.intents.at(-1).effect.stage).toBe(5);
  });
});

describe("an effect nobody gave a clock to", () => {
  const def = { id: "poison", polarity: "debuff", stacking: "stage", baseChance: 100 };

  it("does not expire", () => {
    // `resolveTicks(null)` is 0, which is right for "this turn" and disastrous
    // for "unstated": the expiry lands on the current tick and the instance is
    // swept by the very next boundary, before it has ticked once. Found live --
    // Poison was applied, staged to 1, and removed at the end of the same Round
    // having dealt nothing.
    const out = applyEffect({
      def, target: { id: "v", effects: [], effectInstances: [], applicationChances: [] },
      source: {}, ctx: { turnsPerRound: 3, currentTick: 5, roll: 1 },
    });
    expect(out.intents.at(-1).effect.expiry).toBe(null);
  });

  it("still honours one that IS stated", () => {
    const out = applyEffect({
      def: { ...def, id: "deadlyPoison", stacking: "noneNoRefresh" },
      target: { id: "v", effects: [], effectInstances: [], applicationChances: [] },
      duration: "1◈", source: {}, ctx: { turnsPerRound: 3, currentTick: 5, roll: 1 },
    });
    expect(out.intents.at(-1).effect.expiry).toBe(8);
  });
});

describe("deferred disclosure reaches the instance", () => {
  const def = { id: "poison", polarity: "debuff", stacking: "stage", baseChance: 100 };
  const target = { id: "v", effects: [], effectInstances: [], applicationChances: [] };

  it("carries visibility and the hidden attribution", () => {
    // Both fields have been on the instance schema since `0.2.0` and nothing
    // wrote either -- so Secret Poison had a place to live and no way there.
    const out = applyEffect({
      def, target, source: { unitId: "s" }, ctx: { turnsPerRound: 3, currentTick: 0, roll: 1 },
      visibility: "gmOnly", attributionHidden: true,
    });
    expect(out.intents.at(-1).effect).toMatchObject({
      visibility: "gmOnly", attributionHidden: true, sourceUnitId: "s",
    });
  });

  it("is public by default", () => {
    const out = applyEffect({ def, target, source: {}, ctx: { turnsPerRound: 3, currentTick: 0, roll: 1 } });
    expect(out.intents.at(-1).effect).toMatchObject({ visibility: "public", attributionHidden: false });
  });
});

describe("an inflict bonus is about DEBUFFS", () => {
  const target = {
    id: "v", effects: [], effectInstances: [],
    applicationChances: [{ direction: "incoming", value: 30 }],
  };

  it("does not resist a status the bearer is putting on itself", () => {
    // Serenity's Silent Dance is "chance of inflicting debuffs is increased by
    // 10%", and it raised her own Presence Concealment to 110%. Harmless at 100
    // and wrong on anything resistible.
    const out = applyEffect({
      def: { id: "presenceConcealment", polarity: "status", stacking: "noneRefresh", baseChance: 100 },
      target, source: {}, ctx: { turnsPerRound: 3, currentTick: 0, roll: 100 },
    });
    expect(out.outcome).toBe("applied");
  });

  it("still resists an actual debuff", () => {
    const out = applyEffect({
      def: { id: "poison", polarity: "debuff", stacking: "stage", baseChance: 100 },
      target, source: {}, ctx: { turnsPerRound: 3, currentTick: 0, roll: 100 },
    });
    expect(out.outcome).toBe("resisted");
  });
});
