/**
 * @file Nursery Rhyme, against her sheet.
 * @see char_orig_sheets/Copia de Nursery Rhyme.md
 *
 * Part 1 of four. Pinned to the SHEET and to the documentation rather than to
 * the implementation; every `it` names the clause it holds.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { parse } from "yaml";
import { lookup } from "../../module/domain/tables.mjs";
import { Rank } from "../../module/domain/rank.mjs";
import { collectContributions } from "../../module/rules/elements.mjs";
import { splitCooldownRider } from "../../module/rules/cooldown-riders.mjs";
import { PREVENTS_FOR, ACTION_KINDS } from "../../module/rules/budget.mjs";

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
