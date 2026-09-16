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
