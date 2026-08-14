import { describe, it, expect } from "vitest";
import { explainDamage, explainRankComparison, explainNotApplied, STAGE_LABELS } from "../../module/rules/explain.mjs";
import { computeDamage } from "../../module/rules/damage/pipeline.mjs";
import { Rank } from "../../module/domain/rank.mjs";

/** Worked example 1 from docs/13-damage-pipeline.md §13.5 — 409 damage. */
function penthesileaVsHeracles() {
  const unit = (o = {}) => ({
    baseAttack: { str: 0, mag: 0 }, parameters: {}, effects: [], modifiers: [],
    health: 1000, shield: 0, magicResistance: null, outsideZon: false, ...o,
  });
  return computeDamage({
    attacker: unit({
      baseAttack: { str: 160, mag: 0 },
      modifiers: [
        { key: "atkUp", value: 100, source: "Mad Enhancement EX" },
        { key: "atkUp", value: 100, source: "Atk Up (GreekMale)" },
        { key: "atkUp", value: 30, source: "Atk Up (STR)" },
        { key: "divinity", value: 40, source: "Divinity B" },
      ],
    }),
    defender: unit({ modifiers: [{ key: "defUp", value: 40, source: "Mad Enhancement B" }] }),
    board: {},
    attack: { kind: "normal", rank: null, categorizedAsNP: false, element: null },
    base: { sources: [{ unit: "self", component: "str", factor: 1 }] },
    multiplier: 1, flatBonus: 0,
    crit: { isCrit: false, chanceUsed: 0 },
    reaction: { kind: "none" }, luckChecks: {},
    rolls: { attackMinus: 22, battleContinuation: 31 },
    options: new Set(),
  });
}

describe("explainDamage", () => {
  const { rows, summary } = explainDamage(penthesileaVsHeracles());

  it("emits one row per stage, in order", () => {
    expect(rows.map((r) => r.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
  });

  it("keeps stages that did nothing, marked —", () => {
    // Their absence would raise the question "was stage 9 even considered?"
    const zon = rows.find((r) => r.index === 9);
    expect(zon.inert).toBe(true);
    expect(zon.delta).toBe("—");
    expect(zon.label).toBe("ZON penalty");
  });

  it("labels every stage", () => {
    expect(rows.every((r) => r.label && r.label !== "")).toBe(true);
    expect(STAGE_LABELS[2]).toBe("Crit");
    expect(STAGE_LABELS[3]).toBe("Ability multiplier");
  });

  it("shows the running total after each stage", () => {
    expect(rows.find((r) => r.index === 1).running).toBe(160);
    expect(rows.find((r) => r.index === 2).running).toBe(138);
    expect(rows.at(-1).running).toBe(409);
  });

  it("names each contributor in readable form, not as an internal key", () => {
    const bucket = rows.find((r) => r.index === 4);
    const sources = bucket.contributors.map((c) => c.source);
    expect(sources).toContain("Atk Up");
    expect(sources).toContain("Def Up");
    expect(sources).not.toContain("atkUp");
  });

  it("carries the note through, so the reader knows which effect it was", () => {
    const bucket = rows.find((r) => r.index === 4);
    expect(bucket.contributors.map((c) => c.note)).toContain("Atk Up (GreekMale)");
  });

  it("formats percentages as percentages and amounts as amounts", () => {
    const bucket = rows.find((r) => r.index === 4);
    expect(bucket.contributors[0].value).toMatch(/%$/);
    const flat = rows.find((r) => r.index === 7);
    expect(flat.contributors[0].value).toBe("+40");
  });

  it("summarizes the headline the reader needs first", () => {
    expect(summary.total).toBe(409);
    expect(summary.injury).toBe(true);
    expect(summary.negatedBy).toBeNull();
  });

  it("can hide inert stages when a caller insists", () => {
    const terse = explainDamage(penthesileaVsHeracles(), { hideInert: true });
    expect(terse.rows.length).toBeLessThan(rows.length);
    expect(terse.rows.every((r) => !r.inert)).toBe(true);
  });
});

describe("blocked contributions are shown, not omitted", () => {
  it("surfaces the reason a stage declined to act", () => {
    const unit = (o = {}) => ({
      baseAttack: { str: 0, mag: 0 }, parameters: {}, effects: [], modifiers: [],
      health: 1000, shield: 0, magicResistance: null, outsideZon: false, ...o,
    });
    const result = computeDamage({
      attacker: unit({ baseAttack: { str: 100, mag: 0 } }),
      defender: unit(),
      board: {},
      attack: { kind: "np", rank: null, categorizedAsNP: false, element: null },
      base: { sources: [{ unit: "self", component: "str", factor: 1 }] },
      multiplier: 1, flatBonus: 0,
      crit: { isCrit: false, chanceUsed: 0 },
      reaction: { kind: "none" },
      luckChecks: { increasedDamage: 30 },
      rolls: {}, options: new Set(),
    });
    const { rows } = explainDamage(result);
    const luck = rows.find((r) => r.index === 10);
    expect(luck.notes[0].text).toMatch(/cannot increase NP damage/);
    // A stage carrying a note is not inert, even though the number did not move.
    expect(luck.inert).toBe(false);
  });
});

describe("explainRankComparison", () => {
  it("shows the arithmetic, which is what settles the argument", () => {
    const text = explainRankComparison(Rank.parse("B"), Rank.parse("A+"), "not negated");
    expect(text).toBe("B (300) < A+ (401) → not negated");
  });

  it("handles equality and the reverse direction", () => {
    expect(explainRankComparison(Rank.parse("A"), Rank.parse("A"), "negated")).toMatch(/A \(400\) = A \(400\)/);
    expect(explainRankComparison(Rank.parse("EX"), Rank.parse("C"), "negated")).toMatch(/EX \(500\) > C \(200\)/);
  });

  it("says incomparable rather than inventing an order for unranked", () => {
    expect(explainRankComparison(null, Rank.parse("A"), "fallback applies")).toMatch(/incomparable/);
  });
});

describe("explainNotApplied", () => {
  const considered = [
    { source: "Dmg Up (Gods)", explanation: [{ text: "target has attribute divine", passed: false }] },
    { source: "Atk Up (GreekMale)", explanation: [
      { text: "target attribute = male", passed: true },
      { text: "target region = greece", passed: false },
    ] },
    { source: "Divinity", explanation: [{ text: "self skill = divinity", passed: true }] },
  ];

  it("lists only elements that failed, with the clause that failed", () => {
    const { entries } = explainNotApplied(considered);
    expect(entries.map((e) => e.source)).toEqual(["Dmg Up (Gods)", "Atk Up (GreekMale)"]);
    expect(entries[1].failed).toEqual(["target region = greece"]);
    expect(entries[1].passed).toEqual(["target attribute = male"]);
  });

  it("caps the list and reports how many were dropped", () => {
    const many = Array.from({ length: 30 }, (_, k) => ({
      source: `E${k}`, explanation: [{ text: "x", passed: false }],
    }));
    const { entries, truncated } = explainNotApplied(many, 20);
    expect(entries.length).toBe(20);
    expect(truncated).toBe(10);
  });
});
