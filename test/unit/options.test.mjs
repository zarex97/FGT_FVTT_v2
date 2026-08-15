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
import { rollOptionsFor } from "../../module/rules/options.mjs";

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

  it("is safe on a unit with nothing on it", () => {
    expect(() => rollOptionsFor({ attacker: {}, defender: {}, attack: {} })).not.toThrow();
  });
});
