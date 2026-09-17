/**
 * @file A shifted Magic Resistance Rank must move BOTH halves of the clause.
 * @see packs/_source/class-skills/magic-resistance.yml, docs/46-roster-re-audit.md §46.4-Q
 *
 * Magic Resistance states one Rank and reads it twice: *"MAG damage from a MAG
 * Rank of up to @rank is **negated**, otherwise MAG damage taken is **reduced
 * by the table value**"*. EMIYA's *Kanshou & Bakuya* raises that Rank by a whole
 * grade while it is up, and his sheet spells the result out — *"D to C: MAG
 * damage from a MAG Rank of up to **C** is negated, otherwise MAG damage taken
 * is reduced by **30%**"*.
 *
 * The reduction moved and the negation did not. `rules/elements.mjs`'s
 * `Resistance` executor computes
 *
 *     const negates = el.negatesUpToRank ? Rank.parseOrNull(el.negatesUpToRank) : rank;
 *
 * where `rank` is the SHIFTED rank from `abilityRankShifts`. The skill authored
 * `negatesUpToRank: "@rank"`, which the template substitutes to the **authored**
 * grade at build time — so the negation threshold was frozen at D while the
 * percentage correctly became 30.
 *
 * Measured live: with `dualWieldGuard` up, the contribution read
 * `{ rank: "D", percent: 30 }`.
 */

import { describe, it, expect } from "vitest";
import { collectContributions } from "../../module/rules/elements.mjs";
import { Rank } from "../../module/domain/rank.mjs";

/** Magic Resistance as the pack builds it, at a given rank. */
const magicResistance = (rank, extra = {}) => ({
  id: "mr", name: "Magic Resistance", slug: "magicResistance", rank, active: true,
  passiveRules: [{
    key: "Resistance", component: "mag", mode: "rankComparison",
    table: "magicResistancePercent", includesNP: true,
  }],
  ...extra,
});

/** Kanshou & Bakuya's buff: one whole grade, aimed at Magic Resistance. */
const dualWieldGuard = {
  id: "dwg", name: "Kanshou & Bakuya", active: true,
  rules: [{ key: "RankShift", ability: "magicResistance", grades: 1 }],
};

const mrOf = (abilities) => collectContributions(abilities).magicResistance;

describe("Magic Resistance without a shift", () => {
  it("negates up to its own rank and reduces by that rank's table value", () => {
    const mr = mrOf([magicResistance("D")]);
    expect(String(mr.rank)).toBe("D");
    expect(mr.percent).toBe(20);
  });

  it("keeps the + on a ranked skill — A+ negates up to A+, not A", () => {
    expect(String(mrOf([magicResistance("A+")]).rank)).toBe("A+");
  });
});

describe("the content does not freeze the threshold", () => {
  it("magic-resistance.yml authors no `negatesUpToRank`", async () => {
    // `"@rank"` substitutes to a LITERAL at build time, so the built item
    // carried `negatesUpToRank: "D"` and the threshold could never move. The
    // executor's default is the SHIFTED rank, which is what the skill wants.
    const { readFileSync } = await import("node:fs");
    const yaml = await import("yaml");
    const doc = yaml.default.parse(readFileSync("packs/_source/class-skills/magic-resistance.yml", "utf8"));
    const resistance = doc.passiveRules.find((r) => r.key === "Resistance");

    expect(resistance).toBeDefined();
    expect("negatesUpToRank" in resistance).toBe(false);
  });

  it("an authored threshold still wins where one is genuinely stated", () => {
    // The field stays in the vocabulary; nothing in the corpus uses it yet.
    const stated = {
      id: "x", name: "X", slug: "magicResistance", rank: "D", active: true,
      passiveRules: [{
        key: "Resistance", component: "mag", mode: "rankComparison",
        negatesUpToRank: "EX", table: "magicResistancePercent",
      }],
    };
    expect(String(mrOf([stated, dualWieldGuard]).rank)).toBe("EX");
  });
});

describe("Magic Resistance with Kanshou & Bakuya up", () => {
  it("moves the NEGATION threshold a whole grade, D to C", () => {
    expect(String(mrOf([magicResistance("D"), dualWieldGuard]).rank)).toBe("C");
  });

  it("moves the reduction to that grade's value too, 20% to 30%", () => {
    expect(mrOf([magicResistance("D"), dualWieldGuard]).percent).toBe(30);
  });

  it("negates an attack at the shifted grade, which is the clause's whole point", () => {
    const mr = mrOf([magicResistance("D"), dualWieldGuard]);
    // `damage/pipeline.mjs` asks exactly this question.
    expect(Rank.gte(mr.rank, Rank.parseOrNull("C"), false)).toBe(true);
    // ...and still loses to anything above it.
    expect(Rank.gte(mr.rank, Rank.parseOrNull("B"), false)).toBe(false);
  });
});
