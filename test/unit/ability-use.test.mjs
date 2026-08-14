/**
 * @file What clicking an ability does.
 * @see module/rules/ability-use.mjs
 */

import { describe, it, expect } from "vitest";
import { classifyAbility, targetSpecFor } from "../../module/rules/ability-use.mjs";

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
