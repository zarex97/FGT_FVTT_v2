/**
 * @file The figures every count reader gives, pinned before the Count module (#319).
 * @see module/rules/count.mjs, docs/superpowers/plans/2026-10-22-count-and-use-record.md (Task 1)
 *
 * Six readers answered "how many" before the Count module, each with its own
 * arithmetic: `stackScaled` (element values), `timesOf` (an entry's `times`),
 * `stackTimes` (a handler's `times`), `cooldownChanges`' `perStack` and
 * `countMatching`, `countTargetsMagnitude`, and `cooldownFor`'s `perUnit`. Each
 * is asked here through the export its callers use, with the input shape its
 * callers hand it. Moving them into one module must leave every figure where
 * it is; the one figure that moves is marked, and is Q3's ruling.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { resolveValue } from "../../module/rules/elements.mjs";
import { timesOf } from "../../module/rules/effect-flow.mjs";
import { dispatch } from "../../module/engine/scheduler.mjs";
import { cooldownChanges } from "../../module/engine/skill-use.mjs";
import { cooldownFor } from "../../module/engine/cooldown.mjs";
import { countTargetsMagnitude } from "../../module/rules/effects/count-targets.mjs";

beforeAll(() => {
  // `turnsPerRound` is a world setting; the Great Holy Grail War runs at 3.
  globalThis.game ??= { settings: { get: () => 3 } };
});

const el = (extra) => ({ key: "StatDelta", value: 8, ...extra });

describe("element values (stackScaled)", () => {
  it("pays per stock, capped at the clause's own max", () => {
    expect(resolveValue(el({ perStack: { effect: "proliferationStock" }, max: 80 }), null,
      { stacks: { proliferationStock: 10 } })).toBe(80);
  });

  it("pays nothing at zero stocks, its base included (Kingprotea)", () => {
    expect(resolveValue(el({ perStack: { effect: "s", base: 30 } }), null, { stacks: { s: 0 } })).toBe(0);
  });

  it("pays one step per `each` stocks", () => {
    expect(resolveValue(el({ value: 1, perStack: { effect: "s", each: 3 } }), null, { stacks: { s: 7 } })).toBe(2);
  });
});

describe("an entry's times (timesOf)", () => {
  it("counts the stocks held", () => {
    expect(timesOf({ perStack: { effect: "proliferationStock" } }, { stacks: { proliferationStock: 7 } })).toBe(7);
    expect(timesOf({ perStack: { effect: "proliferationStock", each: 3 } }, { stacks: { proliferationStock: 7 } })).toBe(2);
  });

  it("reads an event field whole, its sign dropped", () => {
    expect(timesOf("@unitsHit", { event: { unitsHit: 2 } })).toBe(2);
    expect(timesOf("-@stageDelta", { event: { stageDelta: -3 } })).toBe(3);
  });
});

describe("a handler's times (the ApplyEffect action)", () => {
  const unit = (instances) => ({ id: "kp", abilities: [], effectInstances: instances });
  const timesFor = (instances, spec = { perStack: { effect: "proliferationStock" } }) => {
    const [intent] = dispatch(
      { kind: "ApplyEffect", effect: { id: "npDmUpGao" }, times: spec },
      unit(instances), { abilityId: "gao", source: "test" }, { tick: 0, turnsPerRound: 3 },
    );
    return intent?.effect?.times;
  };

  it("counts one per instance of the stock", () => {
    const stock = { defId: "proliferationStock", uses: 0, stage: 0 };
    expect(timesFor([stock, stock, stock, stock])).toBe(4);
  });

  // changes in Task 3 (Q3): `stackTimes` reads `max(1, uses)`, never the
  // stage, where `stacksHeld` -- every other reader's -- reads the stage.
  it("counts a staged instance as one (Q3: changes in Task 3)", () => {
    expect(timesFor([{ defId: "curse", uses: 0, stage: 5 }], { perStack: { effect: "curse" } })).toBe(1);
  });

  // changes in Task 3 (Q3): the projection keeps suppressed instances, flagged.
  it("counts a suppressed instance (Q3: changes in Task 3)", () => {
    const stock = { defId: "proliferationStock", uses: 0, stage: 0 };
    expect(timesFor([stock, { ...stock, suppressed: true }])).toBe(2);
  });
});

describe("a cooldown change sized by a count (cooldownChanges)", () => {
  const np = (id) => ({ id, type: "noblePhantasm", system: { kind: "noblePhantasm" } });

  it("multiplies the change by the stage of a staged effect (Van Gogh)", () => {
    const gogh = { id: "gogh", items: [np("gogh-np")], effects: [{ system: { defId: "curse", stage: 7, uses: 0 } }] };
    gogh.items.filter = Array.prototype.filter.bind(gogh.items);
    const phase = { kind: "cooldown", changes: [{ scope: "np", ticks: "⅓◈", direction: "down", perStack: { effect: "curse" } }] };
    const [cut] = cooldownChanges(phase, gogh, null);
    expect(cut).toMatchObject({ t: "cooldown", abilityId: "gogh-np", ticks: 7, mode: "reduce" });
  });

  it("counts the board's matching Units, capped (Familiar: Doves)", () => {
    const sem = { id: "sem", items: [np("sem-np")], effects: [] };
    sem.items.filter = Array.prototype.filter.bind(sem.items);
    const dove = (id) => ({ id, kind: "servant", factionId: "blue", effects: ["dove"], abilities: [] });
    const board = {
      units: [
        { id: "sem", kind: "servant", factionId: "red", effects: [], abilities: [] },
        dove("e1"), dove("e2"), dove("e3"),
        { id: "e4", kind: "servant", factionId: "blue", effects: [], abilities: [] },
      ],
    };
    const change = { scope: "np", countMatching: { relation: "enemy", requires: ["self:effect:dove"] } };
    const [uncapped] = cooldownChanges({ kind: "cooldown", changes: [change] }, sem, board);
    expect(uncapped).toMatchObject({ ticks: 3, mode: "reduce" });
    const [capped] = cooldownChanges({ kind: "cooldown", changes: [{ ...change, maxTicks: "⅓◈" }] }, sem, board);
    expect(capped).toMatchObject({ ticks: 1, mode: "reduce" });
  });
});

describe("a magnitude sized by the phase's targets (countTargets)", () => {
  const withSkill = (id) => ({ id, abilities: [{ slug: "existenceOutsideTheDomain" }] });
  const spec = { base: 3, each: 1, requires: ["self:skill:existenceOutsideTheDomain"], excludeSelf: true };
  const resolve = (targets) => countTargetsMagnitude(spec, targets, "gogh");

  it("adds `each` per matching target, the caster excluded", () => {
    expect(resolve([withSkill("gogh"), withSkill("a1"), withSkill("a2"), { id: "x", abilities: [] }])).toBe(5);
  });

  it("pays its base at zero matches (Van Gogh's floor)", () => {
    expect(resolve([withSkill("gogh")])).toBe(3);
  });
});

describe("a cooldown sized by what the use summoned (perUnit)", () => {
  it("is the rate times the count", () => {
    const ability = { id: "dtw", name: "Dragon Tooth Warriors", system: { cooldown: { perUnit: "⅔◈", countFrom: "summonCount" } } };
    expect(cooldownFor(ability, "medea", { count: 4 }).cooldowns).toEqual([{ actorId: "medea", abilityId: "dtw", ticks: 8 }]);
  });
});
