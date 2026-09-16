/**
 * @file Nursery Rhyme, against her sheet.
 * @see char_orig_sheets/Copia de Nursery Rhyme.md
 *
 * Part 1 of four. Pinned to the SHEET and to the documentation rather than to
 * the implementation; every `it` names the clause it holds.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { parse } from "yaml";
import { lookup } from "../../module/domain/tables.mjs";
import { Rank } from "../../module/domain/rank.mjs";
import { collectContributions } from "../../module/rules/elements.mjs";
import { splitCooldownRider } from "../../module/rules/cooldown-riders.mjs";
import { PREVENTS_FOR, ACTION_KINDS } from "../../module/rules/budget.mjs";
import { parseTick, resolveTicks } from "../../module/domain/tick.mjs";

const classSkill = (id) => parse(readFileSync(`packs/_source/class-skills/${id}.yml`, "utf8"));
const servant = (id) => parse(readFileSync(`packs/_source/servants/${id}.yml`, "utf8"));

/** One ability's contributions, with no predicates satisfied and no shifts. */
const contribute = (ability, options = []) =>
  collectContributions([ability], { options: new Set(options), refs: {} });

describe("Territory Creation, promoted to a shared template (R4)", () => {
  const tc = () => classSkill("territory-creation");

  it("exists as a class skill, parameterized by rank", () => {
    expect(tc().id).toBe("class-territory-creation");
    expect(tc().parameterized).toContain("rank");
    expect(tc().rank).toBe("@rank");
  });

  it("T1 — reads the OFFENCE table rather than a literal", () => {
    // Medea's file hardcoded "5d20", which is the table's A value. That is the
    // same latent defect madEnhancementDrain had: right at one rank, wrong at
    // every other. The template must read the table.
    const rule = tc().passiveRules.find((r) => r.key === "DamageModifier");
    expect(rule.rollTable).toBe("territoryCreationOffence");
    expect(rule.roll).toBeUndefined();
    expect(lookup("territoryCreationOffence", Rank.parse("A"))).toBe("5d20");
  });

  it("T1 — and resolves to a different formula at a different Rank", () => {
    // The whole point of the promotion. Authored as a literal, an E-rank
    // Caster rolled 5d20 -- a hundred points of damage her sheet never gave
    // her.
    const el = (rank) => ({
      id: "tc", name: "Territory Creation", rank,
      passiveRules: [{ key: "DamageModifier", stage: "flat", rollTable: "territoryCreationOffence" }],
    });
    expect(contribute(el("A")).modifiers[0].roll.formula).toBe("5d20");
    expect(contribute(el("E")).modifiers[0].roll.formula).toBe("5d4");
    expect(contribute(el("EX")).modifiers[0].roll.formula).toBe("6d20");
  });

  it("T2 — reads the DEFENCE table, as an aura with no radius", () => {
    // "While this Unit is on the field" is not a distance, so `scope: field`.
    const aura = tc().passiveRules.find((r) => r.key === "Aura");
    expect(aura.scope).toBe("field");
    expect(aura.radius).toBeUndefined();
    expect(aura.requiresRecipient).toEqual({ inHomeBase: true });
    expect(lookup("territoryCreationDefence", Rank.parse("A"))).toBe("3d10+20");
  });

  it("T2 — and the negation is DICE, which is the half that was inert", () => {
    // `DamageNegation` never reads `el.roll`, and `mode` defaults to "flat".
    // Every Territory Creation in the corpus authored `roll:` with no `mode`,
    // so `rollNegation` computed `Number(null) || 0` and skipped it: the
    // clause has never reduced a single point of damage, for any Servant.
    const neg = tc().passiveRules.find((r) => r.key === "Aura").elements[0];
    expect(neg.mode).toBe("dice");
    expect(neg.table).toBe("territoryCreationDefence");
    expect(neg.roll).toBeUndefined();
  });

  it("T2 — and it collects with a formula a die can actually be rolled from", () => {
    const out = contribute({
      id: "tc", name: "Territory Creation", rank: "A",
      passiveRules: [{ key: "DamageNegation", mode: "dice", table: "territoryCreationDefence" }],
    });
    expect(out.damageNegation[0]).toMatchObject({ mode: "dice", formula: "3d10+20" });
  });

  it("T3 — does not stack; the highest Rank wins", () => {
    const aura = tc().passiveRules.find((r) => r.key === "Aura");
    expect(aura.stacking).toBe("highestOnly");
    expect(aura.group).toBe("territoryCreation");
  });

  it("Medea now refs the template, and her own file is gone", () => {
    expect(servant("medea").abilities.some((a) => a.ref === "class-territory-creation")).toBe(true);
    expect(existsSync("packs/_source/abilities/medea-territory-creation.yml")).toBe(false);
  });

  it("and every OTHER Territory Creation now rolls its dice too", () => {
    // Four more files carried the same dead clause. Fixing one Servant's and
    // leaving four with a silently inert class skill would be worse than
    // finding it.
    const negations = [
      "kingprotea-territory-creation", "normal-territory-creation", "semiramis-territory-creation",
    ].flatMap((id) => JSON.stringify(parse(readFileSync(`packs/_source/abilities/${id}.yml`, "utf8")))
      .split('"key":"DamageNegation"').slice(1));
    expect(negations.length).toBeGreaterThan(0);
    for (const id of ["kingprotea-territory-creation", "normal-territory-creation", "semiramis-territory-creation"]) {
      const text = readFileSync(`packs/_source/abilities/${id}.yml`, "utf8");
      const blocks = text.split("- key: DamageNegation").slice(1);
      for (const b of blocks) expect(b).toContain("mode: dice");
    }
    expect(readFileSync("packs/_source/effects/dsc-buff.yml", "utf8"))
      .toMatch(/- key: DamageNegation[\s\S]{0,200}mode: dice/);
  });
});

describe("A cooldown rider on a damaging ability (R5, A7)", () => {
  it("splits a phase's changes by who they land on", () => {
    // A Noble Phantasm catching four Units fans out into four Combat Processes.
    // A change aimed at the TARGET must run in each -- it is a different target
    // each time. A change aimed at the caster must run in exactly one, or a
    // four-Unit Noble Phantasm turns its own clock four times.
    const phase = {
      kind: "cooldown",
      changes: [
        { unit: "target", scope: "np", ticks: "1◈", direction: "up" },
        { scope: "np", ticks: "⅓◈", direction: "down" },
      ],
    };
    const { perDefender, oncePerPhase } = splitCooldownRider(phase);
    expect(perDefender).toHaveLength(1);
    expect(perDefender[0].direction).toBe("up");
    expect(oncePerPhase).toHaveLength(1);
    expect(oncePerPhase[0].direction).toBe("down");
  });

  it("treats an unstated `unit` as the caster's own", () => {
    // Every cooldown clause authored before Chronos Rose is the caster's, and
    // must stay that way.
    const { perDefender, oncePerPhase } = splitCooldownRider({
      changes: [{ scope: "np", ticks: "1◈" }],
    });
    expect(perDefender).toEqual([]);
    expect(oncePerPhase).toHaveLength(1);
  });

  it("handles a phase with no changes at all", () => {
    expect(splitCooldownRider({})).toEqual({ perDefender: [], oncePerPhase: [] });
  });
});

describe("her three new effects (V3, E2–E4, R1, R6)", () => {
  const effect = (id) => parse(readFileSync(`packs/_source/effects/${id}.yml`, "utf8"));

  it("R6 — Disable permits Move and nothing else", () => {
    // Appendix A: "Can only use the Move action." The complement of
    // `immobilize`, which prevents ONLY movement.
    expect(effect("disable")).toMatchObject({ id: "disable", preventsAction: true });
    expect(effect("disable").families).toContain("bind");
  });

  it("R6 — and the engine's own table agrees with the row", () => {
    // `rules/budget.mjs`'s PREVENTS table is what actually refuses an action,
    // and it listed attack/skill/np -- so a Disabled Unit could still cast a
    // Spell, which "can only use the Move action" forbids.
    // Stated as the complement of Move over the whole action vocabulary, so an
    // action kind added later has to be considered rather than quietly
    // permitted to a Unit that "can only use the Move action".
    expect(PREVENTS_FOR("disable").sort()).toEqual(ACTION_KINDS.filter((k) => k !== "move").sort());
  });

  it("E3/R1 — Enigma fires on HER own STR-component Normal Attack", () => {
    // Alice IS Nursery. Appendix A's row said "the bearer's ally" and was
    // wrong; correcting it is part of this task.
    const rule = effect("enigma").rules[0];
    expect(rule.key).toBe("OnEvent");
    expect(rule.event).toBe("damageStepEnd");
    expect(rule.predicate).toContain("attack:kind:normal");
    expect(rule.predicate).toContain("attack:component:str");
    expect(rule.then[0]).toMatchObject({ target: "victim", effect: { id: "defDwnMag" } });
  });

  it("E4 — Def Dwn (MAG) raises MAG damage taken, and is scoped to MAG", () => {
    const rule = effect("def-dwn-mag").rules[0];
    expect(rule.key).toBe("DamageModifier");
    expect(rule.direction).toBe("taken");
    expect(rule.value).toBe("@magnitude");
    expect(rule.npValue).toBe("@npMagnitude");
    // An unscoped Def Dwn is a different effect and already exists; this is
    // the (MAG) variant, like (A) and (C).
    expect(rule.predicate).toContain("attack:component:mag");
  });

  it("E4 — and is a Def Dwn for anything that strips one", () => {
    expect(effect("def-dwn-mag").families).toContain("defDwn");
  });

  it("E4 — 60% and 40% are the SHEET's numbers, carried by the applier", () => {
    // The magnitudes live on the application, not on the definition: "all MAG
    // damage taken is increased by 60%; if NP, 40%" is what Enigma inflicts,
    // and a second source could inflict a different one.
    expect(effect("enigma").rules[0].then[0]).toMatchObject({ magnitude: 60, npMagnitude: 40 });
  });
});

const ability = (id) => parse(readFileSync(`packs/_source/abilities/${id}.yml`, "utf8"));

describe("her four Skills (M1–M3, H1, W1–W4, P1–P7)", () => {
  it("M1/M2 — Self-Modification is a passive AND an active, on two different buckets", () => {
    const a = ability("nursery-self-modification");
    expect(a).toMatchObject({ rank: "A", cooldown: "4◈" });
    // Crit DAMAGE passive, Crit CHANCE active. The sheet states both and they
    // are not the same number.
    expect(a.passiveRules[0]).toMatchObject({ key: "CritModifier", aspect: "damage", value: 40 });
    expect(a.phases[0].effects[0]).toMatchObject({ id: "critUp", magnitude: 60, duration: "1◈" });
  });

  it("H1 — Shapeshift is a Ward, not a Def Up", () => {
    // Nothing applies it and nothing can strip it: it is a property of the
    // Servant, and a Def Up is an effect somebody put there.
    const rule = ability("nursery-shapeshift").passiveRules[0];
    expect(rule).toMatchObject({ key: "Ward", value: 30, npValue: 15 });
  });

  it("W1–W4 — Meanwhile turns her clock, heals a fraction, and cleanses", () => {
    const a = ability("nursery-meanwhile");
    expect(a.cooldown).toBe("4◈");
    const cd = a.phases.find((p) => p.kind === "cooldown");
    expect(cd.changes[0]).toMatchObject({ scope: "np", ticks: "1◈+⅓◈", direction: "down" });
    expect(a.phases.find((p) => p.kind === "heal").percentOfMax).toBe(15);
    expect(a.phases.find((p) => p.kind === "removeEffect").selector).toEqual({ polarity: "debuff" });
  });

  it("W1 — and that cooldown expression parses to more than one Round", () => {
    const t = parseTick("1◈+⅓◈");
    expect(resolveTicks(t, { turnsPerRound: 3 })).toBe(4);
  });

  it("P7 — Tommy Thumb carries the cooldown her sheet prints", () => {
    expect(ability("nursery-tommy-thumb")).toMatchObject({ rank: "A+", cooldown: "4◈-⅓◈" });
  });

  it("P1–P4 — four self effects, with their stated figures", () => {
    const e = ability("nursery-tommy-thumb").phases.find((p) => p.target === "self" && p.effects).effects;
    const by = (id) => e.find((x) => x.id === id);
    // "if NP, 20%" is ABSOLUTE, because the sheet states both and 20 is not
    // half of 30.
    expect(by("atkUp")).toMatchObject({ magnitude: 30, npMagnitude: 20, duration: "1◈" });
    expect(by("defUp")).toMatchObject({ magnitude: 30, npMagnitude: 15, duration: "1◈" });
    // "reduced by 30 INCLUDING NP" -- flat, with no NP variant.
    expect(by("dmgCut")).toMatchObject({ magnitude: 30, duration: "⅓◈" });
    expect(by("dmgCut").npMagnitude).toBeUndefined();
    expect(by("debuffResUp")).toMatchObject({ magnitude: 40, duration: "1◈" });
  });

  it("P1 — and restores 3 Luck", () => {
    const stat = ability("nursery-tommy-thumb").phases.find((p) => p.kind === "statChange");
    expect(stat.changes[0]).toMatchObject({ stat: "luck", delta: 3, clamp: true });
  });

  it("P5 — the Child clause reaches allies within 2 with that Attribute", () => {
    const phase = ability("nursery-tommy-thumb").phases.find((p) => p.kind === "cooldown");
    expect(phase.targeting.shape).toEqual({ kind: "chebyshevRadius", r: 2 });
    expect(phase.targeting.selection.attributes).toContain("target:attribute:child");
    // `unit: target` is what makes it land on the recipient rather than on her.
    expect(phase.changes[0]).toMatchObject({ unit: "target", scope: "np", ticks: "⅔◈", direction: "down" });
  });

  it("P6 — the Fairytale clause reaches a DIFFERENT set", () => {
    const phase = ability("nursery-tommy-thumb").phases.find((p) => p.effects?.[0]?.id === "npDmUp");
    expect(phase.targeting.selection.attributes).toContain("target:attribute:fairytale");
    expect(phase.effects[0]).toMatchObject({ magnitude: 20, duration: "1◈" });
  });

  it("P5/P6 — and she carries BOTH tags, so both reach her", () => {
    const attrs = servant("nursery-rhyme").attributes;
    expect(attrs).toContain("child");
    expect(attrs).toContain("fairytale");
  });
});

describe("her three Spells (V1–V4, F1–F4, E1–E2, R2)", () => {
  it("R2 — both damage Spells deal 1x BA(MAG) at a 2◈ cooldown", () => {
    // "Deals damage" states neither component nor multiplier. Scáthach's Þurs
    // settles the component in its own comment and states its own multiplier
    // of 2 explicitly, so the silence here means 1.
    for (const id of ["nursery-plains-of-winter", "nursery-frenzied-march-hare"]) {
      const a = ability(id);
      expect(a.isSpell).toBe(true);
      expect(a.damage).toMatchObject({ component: "mag", multiplier: 1 });
      expect(a.cooldown).toBe("2◈");
      // Her printed Range, which is what a Spell with no Range of its own uses.
      expect(a.targeting.anchor.range).toBe(2);
    }
  });

  it("V3/V4 — Plains of Winter is Ice, with a 50% Disable", () => {
    const a = ability("nursery-plains-of-winter");
    expect(a.element).toBe("ice");
    expect(a.phases.find((p) => p.kind === "applyEffects").effects[0])
      .toMatchObject({ id: "disable", chance: 50, duration: "1◈" });
  });

  it("F3/F4 — Frenzied March Hare is Wind, with a 50% Sap", () => {
    const a = ability("nursery-frenzied-march-hare");
    expect(a.element).toBe("wind");
    expect(a.phases.find((p) => p.kind === "applyEffects").effects[0])
      .toMatchObject({ id: "sap", chance: 50, duration: "1◈" });
  });

  it("E1/E2 — White Queen's Enigma is a non-damaging Spell that buffs HER", () => {
    const a = ability("nursery-white-queens-enigma");
    expect(a).toMatchObject({ isSpell: true, cooldown: "3◈" });
    // An ability with phases and no `damage` phase deals none.
    expect(a.phases.some((p) => p.kind === "damage")).toBe(false);
    expect(a.damage).toBeUndefined();
    expect(a.phases[0]).toMatchObject({ target: "self" });
    expect(a.phases[0].effects[0]).toMatchObject({ id: "enigma", duration: "1◈" });
  });
});

describe("Nursery Rhyme: A Tale for Somebody's Sake (A1–A8)", () => {
  const np = () => ability("nursery-a-tale-for-somebodys-sake");

  it("A1/A2/A8 — Rank C, Anti-Unit, Range 4, cooldown 5◈", () => {
    expect(np()).toMatchObject({ rank: "C", isNP: true, cooldown: "5◈" });
    expect(np().npTags).toEqual(["antiUnit"]);
    expect(np().targeting.anchor.range).toBe(4);
  });

  it("A3/A4/A5 — BA(MAG), a 3x3 area, 3x damage", () => {
    expect(np().damage).toMatchObject({ component: "mag", multiplier: 3 });
    expect(np().targeting.shape).toEqual({ kind: "square", size: 3 });
  });

  it("A6 — inflicts Def Dwn at +20% for 1◈", () => {
    const e = np().phases.find((p) => p.kind === "applyEffects").effects[0];
    expect(e).toMatchObject({ id: "defDwn", magnitude: 20, duration: "1◈" });
  });

  it("A7/R5 — INCREASES the affected Units' NP Cooldown by 1◈", () => {
    // `direction: up` is the load-bearing half. A `set` would put an enemy
    // Noble Phantasm at 4◈ remaining down to 1◈ -- a REDUCTION, which hands
    // them the Noble Phantasm back early. Backwards, not merely wrong.
    const change = np().phases.find((p) => p.kind === "cooldown").changes[0];
    expect(change).toMatchObject({ unit: "target", scope: "np", ticks: "1◈", direction: "up" });
  });

  it("A7 — and it is the per-defender half of the rider split", () => {
    const phase = np().phases.find((p) => p.kind === "cooldown");
    const { perDefender, oncePerPhase } = splitCooldownRider(phase);
    expect(perDefender).toHaveLength(1);
    expect(oncePerPhase).toEqual([]);
  });
});

describe("the Servant document (S1–S12)", () => {
  const n = () => servant("nursery-rhyme");

  it("S6/S9/S10 — her figures agree with the rank tables", () => {
    expect(n().baseAttack).toEqual({ str: 50, mag: 200 });
    expect(n().baseHealth).toBe(500);
    expect(lookup("baseHealthByEnd", Rank.parse("E"))).toBe(500);
  });

  it("S12/R3 — the Note: her Normal Attacks use BA(STR)", () => {
    // The axis her whole kit turns on. 50 against her Noble Phantasm's 200.
    expect(n().normalAttack).toMatchObject({ mode: "fixed", component: "str" });
  });

  it("S5 — carries all seven Attributes, including both her own kit reads", () => {
    expect([...n().attributes].sort()).toEqual(
      ["child", "fairytale", "female", "humanoid", "man", "nonHominidae", "servant"],
    );
  });

  it("S11 — Sustainability 4◈", () => {
    expect(n().sustainability).toBe("4◈");
  });

  it("carries the twelve abilities Parts 1 to 3 author", () => {
    // Part 1: one class skill + four Skills + three Spells + one Noble
    // Phantasm. Part 2 appends two more Noble Phantasms, Part 3 one, and Part 4
    // the last -- taking this to 13. This assertion is what makes each of those
    // an append rather than a rewrite.
    expect(n().abilities).toHaveLength(12);
    expect(n().abilities[0]).toEqual({ ref: "class-territory-creation", rank: "A" });
  });
});

describe("a non-damaging Spell must say it is not an attack", () => {
  // Found live: White Queen's Enigma refused with "Choose a target."
  //
  // `isSpell` is one of the three things `rules/ability-use.mjs#classifyAbility`
  // treats as attack-shaped, and an attack-shaped ability with no `targeting:`
  // of its own falls back to `anchor: {kind: targetUnit}` — so a Spell that
  // buffs its own caster asks the player to pick somebody and then refuses.
  //
  // The worse half is the one `classifyAbility`'s own comment records: such an
  // ability opens a real Combat Process against itself, and `baseSpecFor`
  // computes NORMAL ATTACK damage for a Spell that authored none. *"EMIYA took
  // 75 self-damage from casting a buff spell that grants nothing but a Normal
  // Attack bonus, every time."*
  //
  // A corpus-wide guard rather than one assertion on her file, because the next
  // author of a buff Spell will hit exactly this.
  const spellFiles = readdirSync("packs/_source/abilities")
    .filter((f) => f.endsWith(".yml"))
    .map((f) => [f, parse(readFileSync(`packs/_source/abilities/${f}`, "utf8"))])
    .filter(([, a]) => a?.isSpell === true);

  it("finds the Spells to check", () => {
    expect(spellFiles.length).toBeGreaterThan(0);
  });

  it.each(spellFiles.filter(([, a]) => !(a.phases ?? []).some((p) => p.kind === "damage")))(
    "%s deals no damage, so it declares countsAsAttack: false and its own targeting",
    (file, a) => {
      expect(a.countsAsAttack).toBe(false);
      expect(a.targeting, `${file} needs a targeting block`).toBeTruthy();
    },
  );

  it("and a DAMAGING Spell is left alone", () => {
    // The two halves of the rule are separable: Plains of Winter and Frenzied
    // March Hare are attacks and should classify as such.
    for (const id of ["nursery-plains-of-winter", "nursery-frenzied-march-hare"]) {
      const a = ability(id);
      expect(a.countsAsAttack ?? true).not.toBe(false);
      expect(a.phases.some((p) => p.kind === "damage")).toBe(true);
    }
  });
});
