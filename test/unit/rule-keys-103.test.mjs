/**
 * @file Rule-element keys the content authors and an executor never read (#103).
 * @see module/rules/elements.mjs, test/unit/rule-survival.test.mjs
 *
 * The rule-survival test found them: each key is authored inside a rule
 * element, and nothing on its Route reads it, so each Clause silently does not
 * happen. One section per executor. Every element is read from the real
 * content file and run through the real executor; the pipeline then gets what
 * the executor produced, never a shape written by hand.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { collectContributions } from "../../module/rules/elements.mjs";
import { computeDamage } from "../../module/rules/damage/pipeline.mjs";
import { rollOptionsFor } from "../../module/rules/options.mjs";
import { critChance } from "../../module/rules/checks.mjs";
import { applyEffect } from "../../module/engine/effect-applier.mjs";
import { fireEvent, pendingRolls, resolveDefeat, runDeferred } from "../../module/engine/scheduler.mjs";
import { subject, prepareSubjects } from "../helpers/subject.mjs";

beforeAll(prepareSubjects, 60_000);

/** A content file under packs/_source, parsed. */
const content = (path) => parse(readFileSync(`packs/_source/${path}`, "utf8"));

/** What one authored ability contributes, through the real executors. */
const contributions = (ability, ctx = {}) => collectContributions([{ active: true, ...ability }], ctx);

/** A plain STR hit carrying the attacker's modifiers. */
const hit = (modifiers, { kind = "normal" } = {}) => computeDamage({
  attacker: { id: "a", baseAttack: { str: 200, mag: 200 }, modifiers, effects: [] },
  defender: { id: "d", health: 9999, modifiers: [], effects: [] },
  attack: { kind, component: "str" },
  base: { fixedValue: 200 },
  rolls: { attackMinus: 0 },
  crit: { isCrit: false },
  options: rollOptionsFor({ attacker: {}, defender: {}, attack: { kind } }),
});

/** The stage-7 flat total a set of modifiers adds. */
const flatOf = (modifiers, opts) => hit(modifiers, opts).total - hit([], opts).total;

describe("FlatDamage", () => {
  it("carries npValue: Vorpal Blade's +50 adds nothing to a Noble Phantasm", () => {
    const blade = content("abilities/vorpal-blade.yml");
    const [bonus] = contributions({ name: blade.name, rules: [blade.rules[0]] }).modifiers;
    expect(bonus).toMatchObject({ value: 50, npValue: 0 });
    expect(flatOf([{ ...bonus, predicate: null }], { kind: "np" })).toBe(0);
  });

  // "Goddess' Divine Core: All damage dealt is increased by 180" while the
  // Sun Stone stands. The file's DECISION is that 180 replaces her Skill's 120.
  //
  // The Skill's own modifier comes from her REAL projection. This test used to
  // build it from the YAML with `contentId` handed into the ability by hand, so
  // it agreed with itself while `contributionsOf` dropped the id and `supersedes`
  // never fired on a board (#126; `supersedes-projection.test.mjs` runs the rest).
  it("carries supersedes: the Sun Stone's 180 replaces Goddess's Divine Core's 120", async () => {
    const stone = content("abilities/quetz-piedra-del-sol.yml");
    const skill = await subject({ from: "quetzalcoatl" }).then(
      (quetz) => quetz.modifiers.find((m) => m.key === "divinity" && m.source === "Goddess's Divine Core"),
    );
    // The stone's +180 is HER passive rule, gated on the stone existing (#65), not a rule of its 7x7.
    const [field] = contributions({ name: stone.name, rules: [stone.passiveRules[0]] }).modifiers;
    expect(skill).toMatchObject({ value: 120, sourceContentId: "quetz-goddesses-divine-core" });
    expect(field).toMatchObject({ value: 180, supersedes: ["quetz-goddesses-divine-core"] });
    // Its predicate -- the stone exists -- is the pipeline's to answer
    // (`test/unit/piedra-owner-bonus.test.mjs`); this is about `supersedes`.
    expect(flatOf([skill, { ...field, predicate: null }])).toBe(180);
    expect(flatOf([skill])).toBe(120);
  });
});

// Found beside #103's `npValue` row, and the larger half of it: `aspect:
// chance` produced a `critUp` modifier that NOTHING reads. Crit chance is read
// off `checkModifiers` (`rules/checks.mjs#critChance`) since the coin flip was
// replaced, so six clauses raised nobody's crit chance: Oblivion Correction,
// Existence Outside the Domain, Independent Action (Viy), Pollux's Twin God's
// Divine Core, Area Crit Up and Crit Up (Viy).
describe("CritModifier", () => {
  const chance = (checkModifiers, options = new Set()) =>
    critChance({ checkModifiers, effects: [] }, null, { options }).percent;

  it("raises crit chance: Oblivion Correction C", () => {
    const skill = content("class-skills/oblivion-correction.yml");
    const out = contributions({ name: skill.name, rank: "C", passiveRules: skill.passiveRules });
    expect(chance(out.checkModifiers)).toBeGreaterThan(50);
  });

  it("carries npValue: Crit Up (Viy) is 50% on a MAG attack, 20% if NP", () => {
    const viy = content("effects/crit-up-viy.yml");
    // `@magnitude`/`@npMagnitude` as `rules/snapshot.mjs#resolveRuleValues`
    // substitutes them on an instance.
    const out = contributions({ name: viy.name, rules: [{ ...viy.rules[0], value: 50, npValue: 20 }] });
    const mag = new Set(["attack:component:mag"]);
    expect(chance(out.checkModifiers, mag)).toBe(100);
    expect(chance(out.checkModifiers, new Set([...mag, "attack:kind:np"]))).toBe(70);
    expect(chance(out.checkModifiers, new Set(["attack:component:str"]))).toBe(50);
  });

  it("reaches an ally through an aura: Area Crit Up", () => {
    const area = content("effects/area-crit-up.yml");
    const aura = { ...area.rules[0], elements: [{ ...area.rules[0].elements[0], value: 20 }] };
    const [delivered] = contributions({ name: area.name, rules: [aura] }).auras[0].elements;
    expect(delivered).toMatchObject({ key: "checkModifier", check: "crit", value: 20 });
    expect(chance([delivered])).toBe(70);
  });
});

// Penthesilea's Charisma, active: *"all damage dealt by allied Units within a
// 2 panel area of herself is increased by 20%; if NP, 10%."*
describe("Aura", () => {
  it("carries npValue: Atk Up (Charisma) is 20% to a Normal Attack, 10% to an NP", () => {
    const charisma = content("effects/atk-up-charisma.yml");
    const aura = { ...charisma.rules[0], value: 20, npValue: 10 };
    const [delivered] = contributions({ name: charisma.name, rules: [aura] }).auras;
    expect(delivered).toMatchObject({ key: "atkUp", value: 20, npValue: 10 });
    const bonus = (kind) => hit([{ ...delivered, predicate: null }], { kind }).total / hit([], { kind }).total;
    expect(bonus("normal")).toBeCloseTo(1.2);
    expect(bonus("np")).toBeCloseTo(1.1);
  });
});

// Appendix A: *"Cannot be inflicted with debuffs. Does not affect Instakill,
// Death or Erase."* The file said so in `scope` and `except`, the executor
// read neither, and the applier gated on the held effect's id instead -- so
// the file's list of exceptions was decoration.
describe("Immunity", () => {
  const immune = (except) => {
    const file = content("effects/debuff-immune.yml");
    const rule = except ? { ...file.rules[0], except } : file.rules[0];
    return contributions({ name: file.name, rules: [rule] }).immunities;
  };
  const land = (def, immunities) => applyEffect({
    def: { stacking: "noneRefresh", baseChance: 100, ...def },
    target: { id: "t", effects: [], effectInstances: [], immunities },
    source: {},
    ctx: { turnsPerRound: 3, currentTick: 0, roll: 1, options: new Set() },
  }).outcome;

  it("blocks a debuff, from the rule alone", () => {
    expect(land({ id: "poison", polarity: "debuff", volatility: "volatile" }, immune())).toBe("blocked");
  });

  it("leaves the exceptions it names: Instakill lands", () => {
    expect(land({ id: "instakill", polarity: "debuff", volatility: "terminal" }, immune())).toBe("applied");
  });

  it("reads the exceptions from the file: an Instakill it does not except is blocked", () => {
    expect(land({ id: "instakill", polarity: "debuff", volatility: "terminal" }, immune(["death"]))).toBe("blocked");
  });

  it("does not touch a buff", () => {
    expect(land({ id: "atkUp", polarity: "buff", stacking: "magnitudeStacks" }, immune())).toBe("applied");
  });
});

// Normal Presence Concealment, Hidden Strike: *"Attacks performed by Assassin
// while Presence Concealment is Active cannot be Blocked or Countered."* The
// rungs are taken from the Assassin's TARGET. `direction: incoming` is the
// same convention as the Evade +4 beside it: a clause on what is done against
// this unit's attacks. Unread, the executor forbade the Assassin's OWN Block
// and Counter, and left his targets theirs.
describe("ForbidReaction", () => {
  const pc = () => {
    const file = content("effects/normal-presence-concealment-effect.yml");
    return contributions({ name: file.name, rules: file.rules.filter((r) => r.key === "ForbidReaction") });
  };

  it("takes Block and Counter from whoever this unit attacks", () => {
    expect(pc().refusesReactions).toEqual(["block", "counter"]);
  });

  it("leaves the Assassin's own reactions alone", () => {
    expect(pc().forbiddenReactions).toEqual([]);
  });

  it("still forbids the bearer's own rung when no direction is given: Invuln cannot Block", () => {
    const invuln = content("effects/invuln.yml");
    const out = contributions({ name: invuln.name, rules: invuln.rules.filter((r) => r.key === "ForbidReaction") });
    expect(out.forbiddenReactions).toEqual(["block"]);
    expect(out.refusesReactions).toEqual([]);
  });
});

// Mad Enhancement: *"MOV is increased by 2, Range is increased by 1 ... The
// effects of Mad Enhancement are neither a buff or a debuff."* Its MOV and
// Range deltas both say `isBuff: false`, and only the MOV one kept it.
describe("RangeDelta", () => {
  it("carries isBuff, as StatDelta and MovDelta do: Mad Enhancement's Range +1 is not a buff", () => {
    const skill = content("class-skills/mad-enhancement.yml");
    const deltas = skill.activeRules.filter((r) => r.key === "MovDelta" || r.key === "RangeDelta");
    const out = contributions({ name: skill.name, rank: "B", activeRules: deltas });
    expect(out.statDeltas.map((d) => [d.stat, d.value, d.isBuff])).toEqual([["mov", 2, false], ["range.panels", 1, false]]);
  });

  it("is a buff unless it says otherwise", () => {
    expect(contributions({ name: "Range Up", rules: [{ key: "RangeDelta", value: 1 }] }).statDeltas[0].isBuff).toBe(true);
  });
});

// Kingprotea's Huge Scale: *"Max and current Health is increased by 20% of
// Kingprotea's ORIGINAL Max Health"* per Proliferation stock. The survival test
// listed `perStack.effect` as unread, and it is not: the magnitude is an `@`
// expression, and `stackScaled` reads the stack only once that resolves to a
// number, which it cannot without a Unit's refs. The test's exemption knew
// that for an expression that STARTS with `@`, and this one starts with `0.2`.
describe("MaxDelta", () => {
  it("scales per stock: 0, 200, 600 for 0, 1 and 3 stocks at a base of 1000", () => {
    const skill = content("abilities/kingprotea-huge-scale.yml");
    const el = skill.passiveRules.find((r) => r.key === "MaxDelta");
    const at = (n) => contributions(
      { name: skill.name, passiveRules: [el] },
      { stacks: { proliferationStock: n }, refs: { self: { baseHealth: 1000 } } },
    ).statDeltas[0].value;
    expect([at(0), at(1), at(3)]).toEqual([0, 200, 600]);
  });
});

// Castor's Avenger B: *"All damage taken by Castor is increased by 80
// including NP."* The file said `mode: flat`, a key DamageModifier does not
// have: its bucket is `modifierKey: avenger`, which stage 11 reads as a flat
// addition to damage taken. The executor spells the percent/flat choice
// `stage`, and only asks when there is no `modifierKey`.
describe("DamageModifier", () => {
  const avenger = () => {
    const skill = content("class-skills/avenger.yml");
    return contributions({ name: skill.name, rank: "B", passiveRules: [skill.passiveRules[0]] }).modifiers[0];
  };
  const taken = (modifiers) => computeDamage({
    attacker: { id: "a", baseAttack: { str: 200, mag: 200 }, modifiers: [], effects: [] },
    defender: { id: "d", health: 9999, modifiers, effects: [] },
    attack: { kind: "normal", component: "str" },
    base: { fixedValue: 200 },
    rolls: { attackMinus: 0 },
    crit: { isCrit: false },
    options: rollOptionsFor({ attacker: {}, defender: {}, attack: { kind: "normal" } }),
  }).total;

  it("adds Avenger B's 80 to every hit Castor takes", () => {
    expect(avenger()).toMatchObject({ key: "avenger", value: 80 });
    expect(taken([avenger()]) - taken([])).toBe(80);
  });

  it("is authored without a key the executor does not read", () => {
    expect(content("class-skills/avenger.yml").passiveRules[0].mode).toBeUndefined();
  });
});

// Normal Lancer's Battle Continuation, Survival: *"When Health is reduced to
// 0, roll 5d20 and restore Lancer's Health by that amount. This Skill can only
// be used once."* The file said `uses: 1`; the executor reads `charges`, so the
// revival had no limit.
describe("RevivalSource", () => {
  it("can only be used once: charges 1, restoring 5d20", () => {
    const skill = content("abilities/normal-battle-continuation.yml");
    const [revival] = contributions({ name: skill.name, passiveRules: skill.passiveRules }).revivals;
    expect(revival).toMatchObject({ id: "normalBattleContinuation", charges: 1, formula: "5d20" });
  });
});

// Jack: *"Every time Jack kills a Human when she is a Free Servant, increase
// her Sustainability by 1◈ Turns."* Medusa's is the same for a Civilian. The
// handler dropped `targetPredicate`, and it listened on `unitDefeated`, which
// fires on the DEFEATED unit's own handlers -- so each of them gained
// Sustainability when she herself died, and never when she killed.
describe("SustainabilityGain", () => {
  const handlerOf = (path) => {
    const servant = content(path);
    return contributions({ name: servant.name, rules: servant.rules }, { options: new Set(["self:free"]) }).eventHandlers[0];
  };
  // Written as the RESULT, from the Sustainability the snapshot resolves (6
  // Turns left here): the stored figure is `null` until something first
  // writes it, and a relative +3 on `null` would leave her at 3.
  const killed = (handler, victimKind) => fireEvent(
    "unitKilled",
    [{ id: "jack", kind: "servant", sustainability: 6, effects: [], eventHandlers: [handler] }],
    { tick: 1, turnsPerRound: 3, options: new Set([`target:type:${victimKind}`]) },
  ).filter((i) => i.t === "resource" && i.key === "sustainabilityRemaining").map((i) => i.delta);

  it("listens for a kill, not for her own defeat", () => {
    expect(handlerOf("servants/jack-the-ripper.yml").events).toEqual(["unitKilled"]);
  });

  it("pays Jack 1◈ for a Civilian or a Master, and nothing for a Servant", () => {
    const jack = handlerOf("servants/jack-the-ripper.yml");
    expect(killed(jack, "civilian")).toEqual([9]);
    expect(killed(jack, "master")).toEqual([9]);
    expect(killed(jack, "servant")).toEqual([]);
  });

  it("pays Medusa for a Civilian only", () => {
    const medusa = handlerOf("servants/medusa.yml");
    expect(killed(medusa, "civilian")).toEqual([9]);
    expect(killed(medusa, "master")).toEqual([]);
  });
});

// The Dioscuri's 'Pollux' buff: *"When the affected Unit performs a Normal
// Attack that does not Crit, apply S.Crit Up for ⅓◈ Turns to all allied Units
// within a 2 panel area of himself (and Pollux if she is out of the Skill's
// Range)."* A handler-level `targeting` block no executor reads; the action's
// own `target: nearby` is the vocabulary that exists, and it now names the
// bearer and the linked partner too.
describe("OnEvent: targeting", () => {
  const unit = (id, i, j, over = {}) => ({ id, panel: { i, j }, factionId: "f1", effects: [], eventHandlers: [], ...over });

  it("puts the S.Crit Up aura on the bearer alone; the aura reaches the rest (#132)", () => {
    const buff = content("effects/pollux-buff.yml");
    const [handler] = contributions({ name: buff.name, rules: buff.rules }).eventHandlers;
    const castor = unit("castor", 5, 5, { eventHandlers: [handler], linkedGroup: { memberIds: ["pollux"] } });
    const board = {
      units: [
        castor,
        unit("near", 5, 7), unit("far", 5, 8),
        unit("enemy", 5, 6, { factionId: "f2" }),
        unit("pollux", 12, 12),
      ],
    };
    const hit = fireEvent("damageStepEnd", [castor], {
      tick: 1, turnsPerRound: 3, board, options: new Set(["attack:kind:normal"]),
    }).filter((i) => i.t === "applyEffect" && i.effect.defId === "sCritUpPollux").map((i) => i.unitId);
    expect(hit).toEqual(["castor"]);
  });
});

// A chance on the WHOLE handler, which no executor reads. The dispatcher reads
// a chance on an ACTION, with a d100 its caller rolls.
describe("OnEvent: chance", () => {
  const rolled = (unit, event, total) => Object.fromEntries(pendingRolls(unit, event).map((r) => [r.key, total]));

  // Castor's Twin God's Divine Core: *"Whenever Castor performs a successful
  // Normal Attack, he has a 5% chance of reducing his NP Cooldown by 1 Turn."*
  it("Castor's 5%: a 5 or under reduces the NP cooldown, a 6 does not", () => {
    const skill = content("abilities/dioscuri-twin-gods-divine-core-castor.yml");
    const handler = contributions({ name: skill.name, passiveRules: skill.passiveRules }).eventHandlers[0];
    const castor = { id: "castor", effects: [], eventHandlers: [handler], abilities: [{ id: "np", isNP: true }] };
    const fire = (total) => fireEvent("damageStepEnd", [castor], {
      tick: 1, turnsPerRound: 3, options: new Set(["attack:kind:normal"]), rolls: rolled(castor, "damageStepEnd", total),
    }).filter((i) => i.t === "cooldown");
    expect(pendingRolls(castor, "damageStepEnd")).toHaveLength(1);
    expect(fire(5).length).toBeGreaterThan(0);
    expect(fire(6)).toEqual([]);
  });

  // Normal Archer's Improved Sustainability: *"When Archer's Master is
  // defeated, Flip a Coin. If Heads, Archer's Sustainability is increased by
  // 3◈ Turns."* A coin is 50 on a d100. The event had no raiser and the action
  // no executor, so it had never paid.
  it("the Normal Archer's coin: heads adds 3◈ when her Master falls", () => {
    const skill = content("abilities/normal-independent-action.yml");
    const handler = contributions({ name: skill.name, passiveRules: skill.passiveRules }).eventHandlers[0];
    const archer = { id: "archer", kind: "servant", masterId: "m", sustainability: 6, effects: [], eventHandlers: [handler] };
    const fire = (total) => fireEvent("masterDefeated", [archer], {
      tick: 1, turnsPerRound: 3, rolls: rolled(archer, "masterDefeated", total),
    }).filter((i) => i.t === "resource" && i.key === "sustainabilityRemaining").map((i) => i.delta);
    expect(fire(50)).toEqual([15]);
    expect(fire(51)).toEqual([]);
  });

  it("raises masterDefeated on a defeated Master's Servants", () => {
    const skill = content("abilities/normal-independent-action.yml");
    const handler = contributions({ name: skill.name, passiveRules: skill.passiveRules }).eventHandlers[0];
    const archer = { id: "archer", kind: "servant", masterId: "m", sustainability: 6, effects: [], eventHandlers: [handler] };
    const master = { id: "m", kind: "master", health: 0, effects: [], eventHandlers: [] };
    const out = resolveDefeat(master, {
      tick: 1, turnsPerRound: 3, board: { units: [master, archer] }, rolls: rolled(archer, "masterDefeated", 1),
    });
    expect(out.filter((i) => i.t === "resource" && i.unitId === "archer").map((i) => i.delta)).toEqual([15]);
    expect(out.some((i) => i.t === "defeat" && i.unitId === "m")).toBe(true);
  });
});

// Raikou's Tenmōkaikai: *"This NP is forcefully deactivated at the end of a
// Turn Raikou is defeated."* At the END of that Turn, so her copies get their
// last Turn out. `at: turnEnd` was read by nobody, so the NP switched off the
// instant she fell.
describe("OnEvent: at", () => {
  const handler = () => {
    const np = content("abilities/raikou-tenmokaikai.yml");
    const rule = np.activeRules.find((r) => r.key === "OnEvent" && r.event === "unitDefeated");
    return contributions({ name: np.name, activeRules: [rule] }).eventHandlers[0];
  };
  const raikou = () => ({ id: "raikou", effects: [], eventHandlers: [handler()] });

  it("does nothing when she falls, and records what is owed at the Turn's end", () => {
    const out = fireEvent("unitDefeated", [raikou()], { tick: 7, turnsPerRound: 3 });
    expect(out.some((i) => i.t === "setMode")).toBe(false);
    expect(out.find((i) => i.t === "log" && i.entry.kind === "deferred")?.entry)
      .toMatchObject({ unitId: "raikou", at: "turnEnd", tick: 7, actions: [{ kind: "SetMode", ability: "tenmokaikai", active: false }] });
  });

  it("switches the NP off when the Turn ends", () => {
    const [logged] = fireEvent("unitDefeated", [raikou()], { tick: 7, turnsPerRound: 3 })
      .filter((i) => i.t === "log" && i.entry.kind === "deferred");
    const out = runDeferred([logged.entry], { units: [] }, { tick: 7, turnsPerRound: 3 });
    expect(out.filter((i) => i.t === "setMode")).toEqual([expect.objectContaining({ unitId: "raikou", abilityId: "tenmokaikai", active: false })]);
  });
});
