/**
 * @file Setup rolls and the summon plan.
 * @see docs/14-checks-and-randomness.md §14.9, docs/37-content-pipeline.md §37.6
 */

import { describe, it, expect } from "vitest";
import {
  servantSetupPlan, masterSetupPlan, resolveSetupPlan, baseAttackAdjustment, summonPlan,
} from "../../module/rules/setup-rolls.mjs";

const karna = {
  parameters: { str: "B", end: "C", agi: "A", mag: "B", luc: "D" },
  region: ["india"],
};

const lineOf = (plan, id) => plan.lines.find((l) => l.id === id);

/* ── §14.9 Servant ────────────────────────────────────────────────────────── */

describe("servantSetupPlan", () => {
  it("has no summonVariant line for an ordinary Servant", () => {
    expect(lineOf(servantSetupPlan(karna), "summonVariant")).toBeUndefined();
  });

  it("puts the summonVariant line FIRST, ahead of every other roll", () => {
    // It changes what the Servant's other lines even mean (a variant's
    // Sustainability base differs), so it must resolve before anything reads
    // her shape.
    const semiramis = { ...karna, summonVariant: { heads: { id: "dsc" }, tails: { id: "noDsc" } } };
    expect(servantSetupPlan(semiramis).lines[0].id).toBe("summonVariant");
  });

  it("takes Max Health from the END table with no roll", () => {
    // "NO ROLL — Health(S) is not used" for a Servant. The asymmetry with the
    // Master, who does roll, is easy to implement backwards.
    const line = lineOf(servantSetupPlan(karna), "maxHealth");

    expect(line.base).toBe(1000);
    expect(line.roll).toBeNull();
  });

  it("prefers a Health stated on the sheet over the table", () => {
    expect(lineOf(servantSetupPlan({ ...karna, baseHealth: 1500 }), "maxHealth").base).toBe(1500);
  });

  it("flips a coin for Agility at an ordinary grade", () => {
    // "+ (coinFlip ? 2 : 1)".
    expect(lineOf(servantSetupPlan(karna), "maxAgility").roll).toMatchObject({ map: [1, 2] });
  });

  it("rolls 1d4 for Agility at EX instead", () => {
    const ex = { ...karna, parameters: { ...karna.parameters, agi: "EX" } };

    expect(lineOf(servantSetupPlan(ex), "maxAgility").roll).toMatchObject({ formula: "1d4" });
  });

  it("adds one per Agility step to the base", () => {
    // A 18, A+ 19.
    const plus = { ...karna, parameters: { ...karna.parameters, agi: "A+" } };

    expect(lineOf(servantSetupPlan(karna), "maxAgility").base).toBe(18);
    expect(lineOf(servantSetupPlan(plus), "maxAgility").base).toBe(19);
  });

  it("rolls 1d4 for Luck over its table base", () => {
    const line = lineOf(servantSetupPlan(karna), "maxLuck");

    expect(line.base).toBe(4);
    expect(line.roll).toMatchObject({ formula: "1d4" });
  });
});

/* ── §14.9 Master ─────────────────────────────────────────────────────────── */

describe("masterSetupPlan", () => {
  it("gives every Master a flat 250 base Health", () => {
    // Regardless of rank or essence — the numerical statement of how fragile
    // Masters are, and the reason Overpower and ZON exist.
    expect(lineOf(masterSetupPlan({ rank: "A" }), "maxHealth").base).toBe(250);
    expect(lineOf(masterSetupPlan({ rank: "D" }), "maxHealth").base).toBe(250);
  });

  it("coin-flips the sign of that roll", () => {
    expect(lineOf(masterSetupPlan({ rank: "A" }), "maxHealth").roll).toMatchObject({ signCoin: true });
  });

  it("gives a High Rank Master 125 Base Attack and a Low Rank one 100", () => {
    expect(lineOf(masterSetupPlan({ rank: "B" }), "baseAttackMag").base).toBe(125);
    expect(lineOf(masterSetupPlan({ rank: "C" }), "baseAttackMag").base).toBe(100);
  });

  it("flips a coin for the RANK when essences are not in play", () => {
    // "Heads=High Rank, Tails=Low Rank." The coin picks the RANK, and Base
    // Attack (MAG) derives from it.
    //
    // It used to pick the VALUE and discard which side came up, on the
    // reasoning that "the rank exists at this point only to select it" -- but
    // the rank also decides ZON, Sustainability, the parameter grant and the
    // Kill Yourself price, so a table that flipped Heads got a Master with 125
    // who was Rankless for every other rule in the game.
    expect(lineOf(masterSetupPlan({ rank: "A" }, { mode: "coinFlip" }), "rank"))
      .toMatchObject({ roll: { formula: "1d2", map: ["A", "C"] } });
  });

  it("derives Base Attack (MAG) from that rank rather than rolling a second coin", () => {
    // Two coins could disagree; one cannot.
    expect(lineOf(masterSetupPlan({ rank: "A" }, { mode: "coinFlip" }), "baseAttackMag"))
      .toMatchObject({ roll: null, derivedFrom: "rank" });
  });

  it("gives every Master 100 when ranks are not used at all", () => {
    // "If not, all Masters have Base Attack (MAG)=100."
    expect(lineOf(masterSetupPlan({ rank: "A" }, { mode: "rankless" }), "baseAttackMag"))
      .toMatchObject({ base: 100, roll: null });
  });

  it("resolves a coin-flipped rank to a grade, and its Base Attack alongside", () => {
    const heads = resolveSetupPlan(masterSetupPlan({}, { mode: "coinFlip" }), { rank: 1 });
    expect(heads.find((l) => l.id === "rank").value).toBe("A");
    expect(heads.find((l) => l.id === "baseAttackMag").value).toBe(125);

    const tails = resolveSetupPlan(masterSetupPlan({}, { mode: "coinFlip" }), { rank: 2 });
    expect(tails.find((l) => l.id === "rank").value).toBe("C");
    expect(tails.find((l) => l.id === "baseAttackMag").value).toBe(100);
  });

  it("starts every Master with three Command Spells", () => {
    expect(lineOf(masterSetupPlan({ rank: "A" }), "commandSpells")).toMatchObject({ base: 3, roll: null });
  });
});

/* ── Resolution ───────────────────────────────────────────────────────────── */

describe("resolveSetupPlan", () => {
  it("adds the rolled total to the base", () => {
    const out = resolveSetupPlan(servantSetupPlan(karna), { maxLuck: 3 });

    expect(out.find((l) => l.id === "maxLuck").value).toBe(7);
  });

  it("maps a coin flip onto its two outcomes", () => {
    // 1d2 rolling 2 means +2, not +2 faces.
    const out = resolveSetupPlan(servantSetupPlan(karna), { maxAgility: 2 });

    expect(out.find((l) => l.id === "maxAgility").value).toBe(20);
  });

  it("subtracts when the sign coin came up negative", () => {
    const out = resolveSetupPlan(masterSetupPlan({ rank: "A" }), { maxHealth: 87 }, { maxHealth: true });

    expect(out.find((l) => l.id === "maxHealth").value).toBe(163);
  });

  it("adds when it came up positive", () => {
    const out = resolveSetupPlan(masterSetupPlan({ rank: "A" }), { maxHealth: 87 }, { maxHealth: false });

    expect(out.find((l) => l.id === "maxHealth").value).toBe(337);
  });

  it("reports what the roll CONTRIBUTED, sign included", () => {
    // A display that used the unsigned die would render 250 − 87 = 163 as
    // "250 + 87", which is the kind of thing a GM re-rolls over.
    const out = resolveSetupPlan(masterSetupPlan({ rank: "A" }), { maxHealth: 87 }, { maxHealth: true });
    const line = out.find((l) => l.id === "maxHealth");

    expect(line).toMatchObject({ rolled: 87, applied: -87, value: 163 });
  });

  it("resolves an unrolled line to its base and says so", () => {
    // Never NaN, and never silently the base as though it had been rolled.
    const out = resolveSetupPlan(servantSetupPlan(karna), {});

    expect(out.find((l) => l.id === "maxLuck")).toMatchObject({ value: 4, unrolled: true });
  });

  it("leaves a no-roll line alone", () => {
    const out = resolveSetupPlan(servantSetupPlan(karna), {});

    expect(out.find((l) => l.id === "maxHealth")).toMatchObject({ value: 1000, rolled: null });
  });

  it("resolves a summon variant's map to the branch id, not to base + a number", () => {
    // Ch. 05, `rules/summon-variant.mjs`: the variant line's `map` carries
    // strings. `base + signed` would string-concatenate "0dsc" if this were
    // not special-cased.
    const semiramis = { ...karna, summonVariant: { heads: { id: "dsc" }, tails: { id: "noDsc" } } };

    const heads = resolveSetupPlan(servantSetupPlan(semiramis), { summonVariant: 1 });
    expect(heads.find((l) => l.id === "summonVariant")).toMatchObject({ value: "dsc" });

    const tails = resolveSetupPlan(servantSetupPlan(semiramis), { summonVariant: 2 });
    expect(tails.find((l) => l.id === "summonVariant")).toMatchObject({ value: "noDsc" });
  });
});

/* ── Granted steps and Base Attack ────────────────────────────────────────── */

describe("baseAttackAdjustment", () => {
  it("moves Base Attack by 10 per granted STR step", () => {
    expect(baseAttackAdjustment({ str: 1 })).toEqual({ str: 10, mag: 0 });
  });

  it("moves MAG the same way", () => {
    expect(baseAttackAdjustment({ mag: 2 })).toEqual({ str: 0, mag: 20 });
  });

  it("ignores parameters that do not feed Base Attack", () => {
    // §37.6 states it outright: "BA adjustment: none (AGI does not affect BA)".
    expect(baseAttackAdjustment({ agi: 1, end: 1, luc: 1 })).toEqual({ str: 0, mag: 0 });
  });
});

/* ── §37.6 the summon sequence ────────────────────────────────────────────── */

describe("summonPlan", () => {
  it("rolls before it grants", () => {
    // A Region step applied before the roll would be rolled against the wrong
    // table row.
    const steps = summonPlan({ sheet: karna, warRegion: "india" });

    expect(steps[0].kind).toBe("rolls");
    expect(steps[1].kind).toBe("grant");
  });

  it("grants the war Region's step to a matching Servant", () => {
    const steps = summonPlan({ sheet: karna, warRegion: "india" });
    const grant = steps.find((s) => s.source === "region:india");

    expect(grant.steps).toMatchObject({ str: 1, end: 1, agi: 1, mag: 1, luc: 1 });
  });

  it("adjusts Base Attack for that grant, but only STR and MAG", () => {
    const grant = summonPlan({ sheet: karna, warRegion: "india" }).find((s) => s.source === "region:india");

    expect(grant.baseAttack).toEqual({ str: 10, mag: 10 });
  });

  it("grants nothing for a war elsewhere", () => {
    expect(summonPlan({ sheet: karna, warRegion: "japan" }).some((s) => s.kind === "grant")).toBe(false);
  });

  it("keeps Master grants separate from the Region's", () => {
    // They stack as two steps rather than one combined shift.
    const steps = summonPlan({ sheet: karna, warRegion: "india", masterGrants: { agi: 1 } });

    expect(steps.filter((s) => s.kind === "grant")).toHaveLength(2);
  });

  it("contracts to the Master when one was assigned", () => {
    expect(summonPlan({ sheet: karna, master: { id: "m" } }))
      .toContainEqual(expect.objectContaining({ kind: "contract", masterId: "m" }));
  });

  it("always ends with a confirmation the GM may re-roll", () => {
    // Nothing is written until every line has been shown.
    expect(summonPlan({ sheet: karna }).at(-1))
      .toMatchObject({ kind: "confirm", rerollable: true, locksAtMatchStart: true });
  });
});
