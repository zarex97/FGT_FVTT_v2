/**
 * @file What clicking an ability does.
 * @see module/rules/ability-use.mjs
 */

import { describe, it, expect } from "vitest";
import {
  classifyAbility, targetSpecFor, needsTargeting, countsAsAttack, countsAsAct,
} from "../../module/rules/ability-use.mjs";

const ability = (system = {}, type = "ability") => ({ type, system });

describe("classifyAbility", () => {
  it("calls a Noble Phantasm an attack, damaging or not", () => {
    expect(classifyAbility(ability({}, "noblePhantasm")).kind).toBe("attack");
    expect(classifyAbility(ability({ isNP: true })).kind).toBe("attack");
  });

  it("calls anything with a damage phase an attack — Nine Lives", () => {
    const nineLives = ability({ phases: [{ kind: "damage" }, { kind: "applyEffects" }] });
    expect(classifyAbility(nineLives).isAttack).toBe(true);
  });

  it("calls an authored mode a mode — Mad Enhancement", () => {
    const mad = classifyAbility(ability({ isMode: true, activeRules: [{ key: "MovDelta" }] }));
    expect(mad.kind).toBe("mode");
    expect(mad.isAttack).toBe(false);
    expect(mad.toggles).toBe(true);
    expect(mad.action).toBe("toggleMode");
  });

  it("calls a skill with only passiveRules a passive — Divinity", () => {
    const divinity = classifyAbility(ability({ passiveRules: [{ key: "FlatDamage" }] }));
    expect(divinity.kind).toBe("passive");
    expect(divinity.clickable).toBe(false);
  });

  it("treats activeRules without phases as a mode — Riding's Active MOV Up", () => {
    const riding = ability({
      passiveRules: [{ key: "GrantedAbility" }],
      activeRules: [{ key: "MovDelta" }],
    });
    expect(classifyAbility(riding).kind).toBe("mode");
  });

  it("calls a non-damaging skill with a target declaration active", () => {
    const heal = ability({ targeting: { anchor: { kind: "targetUnit" } }, phases: [{ kind: "heal" }] });
    const use = classifyAbility(heal);
    expect(use.kind).toBe("active");
    expect(use.isAttack).toBe(false);
    expect(use.clickable).toBe(true);
  });

  it("honours the explicit attack-skill and spell flags", () => {
    expect(classifyAbility(ability({ isAttackSkill: true })).isAttack).toBe(true);
    expect(classifyAbility(ability({ isSpell: true })).isAttack).toBe(true);
  });

  it("survives an item with no system data at all", () => {
    expect(classifyAbility(null).kind).toBe("passive");
    expect(classifyAbility({}).clickable).toBe(false);
  });
});

describe("targetSpecFor", () => {
  it("uses the ability's own declaration when it has one", () => {
    const declared = { anchor: { kind: "selfEdgeAdjacent" }, shape: { kind: "orientedRect" } };
    expect(targetSpecFor(ability({ targeting: declared }), 3)).toBe(declared);
  });

  it("gives a normal attack a single enemy at the caster's Range", () => {
    const spec = targetSpecFor(null, 4);
    expect(spec.anchor).toEqual({ kind: "targetUnit", range: 4 });
    expect(spec.selection.relations).toEqual(["enemy"]);
  });

  it("gives an undeclared ATTACK the same enemy default", () => {
    const spec = targetSpecFor(ability({ phases: [{ kind: "damage" }] }), 2);
    expect(spec.anchor.kind).toBe("targetUnit");
    expect(spec.selection.relations).toEqual(["enemy"]);
  });

  // The bug: every ability got the enemy default, so a class skill with no
  // declaration opened an enemy targeting session and reported no legal targets.
  it("does NOT hand an undeclared non-attack an enemy target", () => {
    const spec = targetSpecFor(ability({ passiveRules: [{ key: "FlatDamage" }] }), 3);
    expect(spec.anchor.kind).toBe("self");
    expect(spec.selection.relations).toEqual(["self"]);
  });

  it("targets the user for a mode", () => {
    expect(targetSpecFor(ability({ isMode: true }), 3).anchor.kind).toBe("self");
  });
});

describe("needsTargeting", () => {
  const selfSkill = { system: { phases: [{ kind: "applyEffects", rules: [] }] } };

  it("is FALSE for a self-only skill", () => {
    // Asterios's Avyssos of Labrys buffs himself. Opening a targeting session
    // to confirm the only possible target is a click that answers nothing --
    // and the one it shipped with offered an "Attack" button and a damage
    // range for a skill that neither attacks nor deals damage.
    expect(needsTargeting(selfSkill)).toBe(false);
  });

  it("is true for an ability that targets an enemy", () => {
    expect(needsTargeting({ system: { isAttackSkill: true } })).toBe(true);
  });

  it("is true for a Noble Phantasm", () => {
    expect(needsTargeting({ type: "noblePhantasm", system: {} })).toBe(true);
  });

  it("is true for a self-anchored skill that still picks a DIRECTION", () => {
    // Anchored on the caster and still a choice: the 5x5 block projects one of
    // four ways, and which one is the player's decision.
    expect(needsTargeting({
      system: { targeting: { anchor: { kind: "self" }, shape: { kind: "rect", w: 5, h: 5 } } },
    })).toBe(true);
  });

  it("is true when the ability targets allies, because which ally is a choice", () => {
    expect(needsTargeting({
      system: {
        phases: [{ kind: "applyEffects" }],
        targeting: { anchor: { kind: "targetUnit" }, selection: { relations: ["ally"] } },
      },
    })).toBe(true);
  });

  it("is false for a declared self/self spec", () => {
    expect(needsTargeting({
      system: {
        phases: [{ kind: "applyEffects" }],
        targeting: {
          anchor: { kind: "self" }, shape: { kind: "unit" },
          selection: { relations: ["self"], count: 1 },
        },
      },
    })).toBe(false);
  });
});

describe("countsAsAttack / countsAsAct", () => {
  it("treats a damaging skill as the Unit's Attack for the Turn", () => {
    // "Attack Skills usually count as the Unit's Attack for the Turn unless
    // stated."
    expect(countsAsAttack({ system: { phases: [{ kind: "damage" }] } })).toBe(true);
  });

  it("does NOT treat a debuff that causes Health loss as an Attack", () => {
    // The distinction the rules draw and the code did not: an Attack Skill
    // deals damage DIRECTLY. A skill that inflicts poison is not one, however
    // much Health the poison eventually costs.
    expect(countsAsAttack({
      system: { phases: [{ kind: "applyEffects", rules: [{ effect: { id: "poison" } }] }] },
    })).toBe(false);
  });

  it("lets content say otherwise, because the rule says 'unless stated'", () => {
    expect(countsAsAttack({ system: { phases: [{ kind: "damage" }], countsAsAttack: false } })).toBe(false);
    expect(countsAsAttack({ system: { countsAsAttack: true } })).toBe(true);
  });

  it("counts an active skill as the Unit's Act even when it is not an Attack", () => {
    expect(countsAsAct({ system: { phases: [{ kind: "applyEffects" }] } })).toBe(true);
  });

  it("does not count a passive as an Act", () => {
    expect(countsAsAct({ system: {} })).toBe(false);
  });
});
