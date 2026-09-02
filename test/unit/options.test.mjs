/**
 * @file Roll options — the vocabulary predicates are written against.
 * @see docs/24-rules-engine.md §24.4
 *
 * Two gaps found by authoring Penthesilea:
 *
 *   - `tables.mjs` has predicated on `target:skill:divinity` since the tables
 *     were transcribed, and **nothing ever emitted a `skill:` option**. The
 *     Divinity-versus-Divinity clause could not fire.
 *   - Nothing emitted region, so *"damage dealt to Male Units from the Greece
 *     region"* had no way to be written at all.
 *
 * Building them here rather than inside the attack flow is what makes them
 * testable: the flow needs Foundry, this does not.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { rollOptionsFor, isEmittableOption } from "../../module/rules/options.mjs";
import { referencedOptions } from "../../module/rules/predicate.mjs";
import { ruleElements } from "../../tools/lib/content.mjs";

/** @param {string} dir @returns {string[]} */
function ymlUnder(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return ymlUnder(path);
    return e.name.endsWith(".yml") ? [path] : [];
  });
}

const unit = (over = {}) => ({
  id: "u", kind: "servant", attributes: [], effects: [], region: [], abilities: [], ...over,
});

const optionsFor = (attacker, defender, attack = { kind: "normal" }) =>
  [...rollOptionsFor({ attacker, defender, attack })];

describe("rollOptionsFor", () => {
  it("names both units' types", () => {
    const out = optionsFor(unit(), unit({ kind: "master" }));

    expect(out).toContain("self:type:servant");
    expect(out).toContain("target:type:master");
  });

  it("names attributes on both sides", () => {
    const out = optionsFor(unit({ attributes: ["divine"] }), unit({ attributes: ["male", "king"] }));

    expect(out).toContain("self:attribute:divine");
    expect(out).toContain("target:attribute:male");
    expect(out).toContain("target:attribute:king");
  });

  it("names held effects on both sides", () => {
    const out = optionsFor(unit({ effects: ["burn"] }), unit({ effects: ["curse"] }));

    expect(out).toContain("self:effect:burn");
    expect(out).toContain("target:effect:curse");
  });

  it("names the attack kind", () => {
    expect(optionsFor(unit(), unit(), { kind: "np" })).toContain("attack:kind:np");
  });

  it("flags an area attack", () => {
    expect(optionsFor(unit(), unit(), { kind: "np", isAoE: true })).toContain("attack:isAoE");
  });

  describe("skills", () => {
    it("names each unit's skills, which the damage tables already predicate on", () => {
      // `tables.mjs`: `["target:attribute:divine", "not:target:skill:divinity"]`
      // — the second half could never be true, because nothing emitted it.
      const out = optionsFor(
        unit({ abilities: [{ id: "divinity", slug: "divinity" }] }),
        unit({ abilities: [{ id: "class-riding", slug: "riding" }] }),
      );

      expect(out).toContain("self:skill:divinity");
      expect(out).toContain("target:skill:riding");
    });

    it("distinguishes an active skill from a merely held one", () => {
      // Penthesilea's Charisma is "negated and cannot be used when Mad
      // Enhancement is activated" — an ability disabled by its owner's other
      // ability, which needs the ACTIVE state, not just presence.
      const out = optionsFor(
        unit({ abilities: [{ id: "me", slug: "madEnhancement", active: true }] }),
        unit(),
      );

      expect(out).toContain("self:skill:madEnhancement");
      expect(out).toContain("self:skillActive:madEnhancement");
    });

    it("does not claim an inactive skill is active", () => {
      const out = optionsFor(
        unit({ abilities: [{ id: "me", slug: "madEnhancement", active: false }] }),
        unit(),
      );

      expect(out).toContain("self:skill:madEnhancement");
      expect(out).not.toContain("self:skillActive:madEnhancement");
    });
  });

  describe("region", () => {
    it("names each unit's regions", () => {
      // Howl of the War God: "damage dealt to Male Units from the Greece region".
      const out = optionsFor(unit({ region: ["greece"] }), unit({ region: ["greece", "europe"] }));

      expect(out).toContain("self:region:greece");
      expect(out).toContain("target:region:greece");
      expect(out).toContain("target:region:europe");
    });

    it("lets a Greek-male clause be written at all", () => {
      const greekMale = unit({ region: ["greece"], attributes: ["male"] });
      const out = optionsFor(unit(), greekMale);

      expect(out).toEqual(expect.arrayContaining(["target:attribute:male", "target:region:greece"]));
    });
  });

  describe("summon-time variant", () => {
    it("names a resolved variant", () => {
      // Semiramis's 'Double Summon: Caster' passives predicate on this.
      const out = optionsFor(unit({ variant: "dsc" }), unit());

      expect(out).toContain("self:variant:dsc");
    });

    it("emits nothing for a Servant with no variant", () => {
      const out = optionsFor(unit(), unit());

      expect(out.some((o) => o.includes(":variant:"))).toBe(false);
    });
  });

  it("is safe on a unit with nothing on it", () => {
    expect(() => rollOptionsFor({ attacker: {}, defender: {}, attack: {} })).not.toThrow();
  });
});

describe("rank comparisons (Medea's Atlas)", () => {
  const unit = (over = {}) => ({
    kind: "servant", attributes: [], effects: [], abilities: [],
    parameters: { str: "C", end: "C", agi: "C", mag: "A", luc: "C" },
    ...over,
  });

  it("emits a gte option at and above each grade", () => {
    // "reduced by 25% on Units with a MAG Rank of B or higher" -- a clause that
    // needs a COMPARISON, not equality. `rank:mag:A` alone would make a rule
    // written for B miss every A.
    const o = rollOptionsFor({ attacker: null, defender: unit() });

    expect(o).toContain("target:rank:mag:gte:B");
    expect(o).toContain("target:rank:mag:gte:A");
    expect(o).not.toContain("target:rank:mag:gte:EX");
  });

  it("does not emit one the unit falls short of", () => {
    const o = rollOptionsFor({ attacker: null, defender: unit({
      parameters: { str: "C", end: "C", agi: "C", mag: "D", luc: "C" },
    }) });

    expect(o).not.toContain("target:rank:mag:gte:B");
    expect(o).toContain("target:rank:mag:gte:D");
  });

  it("counts a + step as clearing its own grade", () => {
    // B+ is "B or higher", which is the reading the clause needs.
    const o = rollOptionsFor({ attacker: null, defender: unit({
      parameters: { str: "C", end: "C", agi: "C", mag: "B+", luc: "C" },
    }) });

    expect(o).toContain("target:rank:mag:gte:B");
  });

  it("emits a SKILL rank comparison too", () => {
    // "reduced by 25% on Units with a Magic Resistance of Rank B or higher" --
    // the rank of an ability rather than of a parameter, and the two reductions
    // stack, so both must be expressible independently.
    const o = rollOptionsFor({ attacker: null, defender: unit({
      abilities: [{ slug: "magicResistance", rank: "A" }],
    }) });

    expect(o).toContain("target:skillRank:magicResistance:gte:B");
    expect(o).toContain("target:skillRank:magicResistance:gte:A");
  });

  it("emits nothing for a skill the unit does not have", () => {
    const o = rollOptionsFor({ attacker: null, defender: unit() });

    expect([...o].some((x) => x.startsWith("target:skillRank:magicResistance"))).toBe(false);
  });

  it("emits them for the attacker side as well", () => {
    const o = rollOptionsFor({ attacker: unit(), defender: null });

    expect(o).toContain("self:rank:mag:gte:B");
  });

  it("says nothing about a rank that cannot be parsed", () => {
    expect(() => rollOptionsFor({ attacker: null, defender: unit({
      parameters: { str: "?", end: null, agi: "C", mag: "C", luc: "C" },
    }) })).not.toThrow();
  });
});

describe("the range ladder", () => {
  it("emits a distance both ways, so a predicate can compare in either direction", () => {
    // EMIYA is written almost entirely in these terms: his Normal Attack
    // changes component at 3, Clairvoyance and Hawkeye turn on at 3, and
    // Kanshou & Bakuya applies at "Range 2 or lower".
    const out = optionsFor(unit(), unit(), { kind: "normal", range: 3 });

    expect(out).toContain("attack:range:3");
    expect(out).toContain("attack:range:gte:3");
    expect(out).toContain("attack:range:gte:1");
    expect(out).toContain("attack:range:lte:3");
    expect(out).not.toContain("attack:range:gte:4");
    expect(out).not.toContain("attack:range:lte:2");
  });

  it("says nothing at all when the distance is unknown", () => {
    // A unit with no panel — a snapshot taken off the board — must not be
    // read as "at range 0", which would satisfy every `lte` clause in the game.
    const out = optionsFor(unit(), unit(), { kind: "normal" });

    expect(out.some((o) => o.startsWith("attack:range"))).toBe(false);
  });
});

describe("attack properties", () => {
  it("names Aim and Pierce, which the evade rung and the pipeline read", () => {
    const out = optionsFor(unit(), unit(), { kind: "np", aim: true, pierce: true });

    expect(out).toContain("attack:aim");
    expect(out).toContain("attack:pierce");
  });

  it("names the crit, which is knowable only once the coin has been flipped", () => {
    // Serenity's `Macabre` is "Normal Attack **Crits** inflict an additional
    // Stage of Poison on the DU", and nothing emitted a crit -- so a clause
    // about a resolved attack could not be written at all.
    expect(optionsFor(unit(), unit(), { kind: "normal", crit: true })).toContain("attack:crit");
  });

  it("leaves it out of every set built before the Damage Step", () => {
    // Correct rather than incomplete: a handler that asks whether the attack
    // crit is by definition asking about one that has already resolved.
    expect(optionsFor(unit(), unit(), { kind: "normal" })).not.toContain("attack:crit");
  });
});

/* -------------------------------------------------------------------------- */
/*  The vocabulary guard                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Every predicate in the shipped content must name an option this file can
 * actually produce.
 *
 * This is the same class of defect as `test/unit/skill-references.test.mjs`
 * and it failed the same way: `N.Atk Up` and `Bleed Atk` were both written
 * against `self:attack:normal`, which `rollOptionsFor` has never emitted.
 * Neither errored. The clause was simply absent from the set, so the modifier
 * was dropped at every damage event and the effect did nothing at all —
 * `N.Atk Up` raised no Normal Attack's damage for as long as it has shipped.
 */
describe("content predicates name options that exist", () => {
  const SOURCE = ymlUnder("packs/_source");

  /** Every option any authored predicate names, with where it came from. */
  const referenced = SOURCE.flatMap((path) => {
    const doc = parse(readFileSync(path, "utf8"));
    return [...ruleElements(doc)]
      .flatMap(([where, el]) => [
        ...[...referencedOptions(el.predicate)].map((o) => ({ path, where, option: o })),
        ...[...referencedOptions(el.attackPredicate)].map((o) => ({ path, where, option: o })),
        ...[...referencedOptions(el.targetPredicate)].map((o) => ({ path, where, option: o })),
      ]);
  });

  it("finds some, or this guard proves nothing", () => {
    expect(referenced.length).toBeGreaterThan(5);
  });

  it("every one is a string rollOptionsFor can emit", () => {
    const dangling = referenced
      .filter((r) => !isEmittableOption(r.option))
      .map((r) => `${r.path}: ${r.where} → ${r.option}`);

    expect(dangling).toEqual([]);
  });
});

describe("self:withinOfOwnerMaster", () => {
  it("is a ladder: emitted for every radius the unit is within", () => {
    // Contagion under Doomsday: "if the enemy Unit is within a 3 panel area of
    // Pale Rider's Master, Health is reduced by 150 instead of 100". Stamped
    // by `annotateFields` from the field the unit is standing in.
    const unit = { id: "u", panel: { i: 0, j: 0 }, ownerMasterPanel: { i: 0, j: 2 } };
    const o = rollOptionsFor({ attacker: unit });
    expect(o.has("self:withinOfOwnerMaster:2")).toBe(true);
    expect(o.has("self:withinOfOwnerMaster:3")).toBe(true);
    expect(o.has("self:withinOfOwnerMaster:1")).toBe(false);
  });

  it("is absent when the unit stands in no field with an owning Master", () => {
    const o = rollOptionsFor({ attacker: { id: "u", panel: { i: 0, j: 0 } } });
    expect([...o].some((x) => x.startsWith("self:withinOfOwnerMaster:"))).toBe(false);
  });
});
