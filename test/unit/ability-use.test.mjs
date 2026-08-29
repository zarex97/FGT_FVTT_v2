/**
 * @file What clicking an ability does.
 * @see module/rules/ability-use.mjs
 */

import { describe, it, expect } from "vitest";
import {
  classifyAbility, targetSpecFor, needsTargeting, countsAsAttack, countsAsAct,
  blockedThisTurn, isNegated,
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

  it("routes a Spell with countsAsAttack: false away from the attack path", () => {
    // EMIYA's Reinforcement and Tracing: `isSpell: true`, `countsAsAttack:
    // false`, no `damage:` block, self-targeted. Left routed through the
    // attack path (the old behaviour, `isAttack` never read the flag),
    // `resolveAttack` ran a real Combat Process against whoever resolved --
    // often the caster itself -- and `baseSpecFor`'s fallback then computed
    // NORMAL ATTACK damage for an ability that authored none: EMIYA took 75
    // self-damage from casting a buff spell that grants nothing but a Normal
    // Attack bonus. Content's own `countsAsAttack: false` was always the
    // signal that this ability is not attack-shaped; only the budget
    // bookkeeping (`countsAsAttack()`, tested below) ever read it.
    const reinforcement = ability({
      isSpell: true, countsAsAttack: false,
      targeting: { anchor: { kind: "self" } },
      phases: [{ kind: "applyEffects", effects: [{ id: "nAtkUp" }] }],
    });
    const use = classifyAbility(reinforcement);
    expect(use.isAttack).toBe(false);
    expect(use.kind).toBe("active");

    // An Attack Skill gets the same override.
    expect(classifyAbility(ability({ isAttackSkill: true, countsAsAttack: false })).isAttack).toBe(false);

    // A real Noble Phantasm is NEVER exempted, even with the flag set --
    // "non-damaging NPs still cost the Attack" is a rule about NPs
    // specifically, not something content can opt out of.
    expect(classifyAbility(ability({ isNP: true, countsAsAttack: false })).isAttack).toBe(true);

    // Nor is an ability with a REAL damage phase, regardless of the flag.
    const contradictory = ability({
      isSpell: true, countsAsAttack: false,
      phases: [{ kind: "damage" }],
    });
    expect(classifyAbility(contradictory).isAttack).toBe(true);
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

  it("picks a targeting branch by the caster's own options, falling back to the base declaration", () => {
    // Summoning: Bašmu: an enemy 3x3 AoE off her HGoB, a self anchor aboard it
    // -- one document, two shapes that cannot be expressed as one spec.
    const enemyAoE = { anchor: { kind: "withinRange" }, shape: { kind: "square", size: 3 } };
    const selfAnchor = { anchor: { kind: "self" }, shape: { kind: "unit" } };
    const basmuSpell = ability({
      targeting: {
        branches: [
          { predicate: ["self:onPlatform:hanging-gardens-of-babylon"], ...selfAnchor },
          { predicate: [{ not: "self:onPlatform:hanging-gardens-of-babylon" }], ...enemyAoE },
        ],
      },
    });

    const onPlatform = new Set(["self:onPlatform:hanging-gardens-of-babylon"]);
    expect(targetSpecFor(basmuSpell, 2, onPlatform).anchor.kind).toBe("self");
    expect(targetSpecFor(basmuSpell, 2, new Set()).anchor.kind).toBe("withinRange");
    // No options supplied at all: falls through to the raw `targeting` block
    // rather than throwing -- a caller with no board context still gets
    // something back, even if it is not branch-selected.
    expect(targetSpecFor(basmuSpell, 2)).toBe(basmuSpell.system.targeting);
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

  it("is true for a skill that still picks a DIRECTION", () => {
    // The 5x5 block projects one of four ways and which one is the player's
    // decision — but that is `selfEdgeAdjacent`, not `self`. A `self` anchor
    // has no direction at all: the resolver CENTRES a rect on the caster, and
    // only a directional anchor projects it outward.
    expect(needsTargeting({
      system: {
        targeting: { anchor: { kind: "selfEdgeAdjacent" }, shape: { kind: "rect", w: 5, h: 5 } },
      },
    })).toBe(true);
  });

  it("is false for a centred area that catches everyone in it", () => {
    // Penthesilea's Howl of the War God: "affects all allied Units within a
    // 2 panel area of Penthesilea". Reaching somebody else is not by itself a
    // choice — `chooser: all` with no subset means everyone the shape caught,
    // and asking is a confirmation dialog with one possible answer.
    expect(needsTargeting({
      system: {
        phases: [{ kind: "applyEffects" }],
        targeting: {
          anchor: { kind: "self" },
          shape: { kind: "chebyshevRadius", r: 2 },
          selection: { relations: ["ally", "self"], chooser: "all" },
        },
      },
    })).toBe(false);
  });

  it("is true again as soon as the area names a subset", () => {
    // A `count`, or an explicit `choose`, is what turns the area into a
    // decision — Scáthach's Gate of Skye picks "targets of choice" from its 5x5.
    for (const selection of [
      { relations: ["enemy"], chooser: "all", count: 2 },
      { relations: ["enemy"], chooser: "all", choose: true },
    ]) {
      expect(needsTargeting({
        system: {
          phases: [{ kind: "applyEffects" }],
          targeting: { anchor: { kind: "self" }, shape: { kind: "chebyshevRadius", r: 2 }, selection },
        },
      })).toBe(true);
    }
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

describe("blockedThisTurn — sameTurnExclusive", () => {
  const keraino = { id: "k", system: { sameTurnExclusive: ["medea-trofa"], contentId: "medea-keraino" } };

  it("allows it when the partner has not been used", () => {
    expect(blockedThisTurn(keraino, [])).toBe(null);
  });

  it("blocks it once the partner has been used this Turn", () => {
    // Medea: "Cannot be used on the same Turn as Tρoψα."
    expect(blockedThisTurn(keraino, ["medea-trofa"])).toBe("medea-trofa");
  });

  it("does not block on an unrelated ability", () => {
    expect(blockedThisTurn(keraino, ["medea-aero"])).toBe(null);
  });

  it("matches on content id as well as document id", () => {
    // Turn state records whatever the caller had; both are legitimate.
    expect(blockedThisTurn(keraino, ["k"])).toBe(null);
    expect(blockedThisTurn({ id: "x", system: { sameTurnExclusive: ["k"] } }, ["k"])).toBe("k");
  });
});

describe("isNegated", () => {
  it("is false with no negating effect present", () => {
    expect(isNegated({ system: { negatedBy: ["silence"] } }, ["burn"])).toBe(false);
  });

  it("is true while the negating effect is on the Unit", () => {
    // Medea: High-Speed Divine Words "cannot be used and its effects are
    // negated while inflicted with Silence". The second half matters because
    // Silence can land between declaration and resolution.
    expect(isNegated({ system: { negatedBy: ["silence"] } }, ["silence"])).toBe(true);
  });

  it("is false for an ability nothing negates", () => {
    expect(isNegated({ system: {} }, ["silence"])).toBe(false);
  });
});

describe("a passive Noble Phantasm", () => {
  it("is not a button", () => {
    // Penthesilea's Goddess of War: "(Passive) The effect of this Noble
    // Phantasm is only active when Mad Enhancement is deactivated" — four
    // standing clauses and nothing to use. Every NP classified as an attack,
    // so clicking it opened a targeting session and offered to spend her
    // Attack on an ability that has no active form at all.
    const gow = { type: "noblePhantasm", system: { isNP: true, isPassive: true, passiveRules: [{}] } };

    expect(classifyAbility(gow)).toMatchObject({ kind: "passive", isAttack: false, clickable: false });
    expect(needsTargeting(gow)).toBe(false);
    expect(countsAsAttack(gow)).toBe(false);
  });

  it("leaves an ordinary Noble Phantasm an attack", () => {
    const outrage = { type: "noblePhantasm", system: { isNP: true, phases: [{ kind: "damage" }] } };
    expect(classifyAbility(outrage)).toMatchObject({ kind: "attack", isAttack: true });
  });
});
