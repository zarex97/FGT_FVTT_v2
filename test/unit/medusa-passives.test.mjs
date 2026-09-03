/**
 * @file Medusa's four passive skills.
 * @see packs/_source/servants/medusa.yml, docs/D-servant-data-sheets.md §D.25
 *
 * Divinity `E−` is the first sub-E rank in the corpus and needed no new
 * document: the `divinity` table is scaled at ±5 per step and its own header
 * records `E- (5)` as verified.
 */

import { describe, it, expect } from "vitest";
import { lookup } from "../../module/domain/tables.mjs";
import { Rank } from "../../module/domain/rank.mjs";
import { collectContributions } from "../../module/rules/elements.mjs";
import { rollOptionsFor } from "../../module/rules/options.mjs";

describe("Divinity E−", () => {
  it("is +5, from the existing scaled table", () => {
    // "(Passive) All damage dealt is increased by 5 including NP."
    expect(lookup("divinity", Rank.parse("E-"))).toBe(5);
  });

  it("sits one step below E, which the rank domain already parses", () => {
    const r = Rank.parse("E-");
    expect([r.grade, r.steps]).toEqual(["E", -1]);
    expect(lookup("divinity", Rank.parse("E"))).toBe(10);
  });
});

describe("Independent Action — the Civilian clause", () => {
  const rule = {
    key: "SustainabilityGain",
    event: "unitDefeated",
    value: 1,
    predicate: ["self:free"],
    targetPredicate: ["target:type:civilian"],
  };
  const asAbility = () => ([{
    id: "self", name: "Medusa", slug: "self", active: true,
    rules: [rule], passiveRules: [], activeRules: [],
  }]);

  it("collects for a FREE Servant", () => {
    // "Every time Medusa kills a Civilian when she is a Free Servant, increase
    // her Sustainability by 1◈ Turns."
    const out = collectContributions(asAbility(), { options: new Set(["self:free"]) });
    expect(out.eventHandlers).toEqual([
      { event: "unitDefeated", sustainabilityGain: 1, source: "Medusa" },
    ]);
  });

  it("collects nothing for a contracted one, which is the clause's own gate", () => {
    expect(collectContributions(asAbility(), { options: new Set() }).eventHandlers).toEqual([]);
  });
});

describe("`self:free` is reachable from a unit's own state", () => {
  // The regression that made the clause above inert. `options.mjs` emits
  // `self:free` from `unit.contract`, and `snapshot.mjs` built its self-option
  // set without one -- so the predicate could never hold, for Medusa or for
  // Jack the Ripper, whom the emitter's own comment names as its reason.
  it("emits self:free from a contract", () => {
    const options = rollOptionsFor({ attacker: { kind: "servant", contract: "free" }, defender: null });
    expect(options.has("self:free")).toBe(true);
  });

  it("does not emit it for a contracted Servant", () => {
    const options = rollOptionsFor({ attacker: { kind: "servant", contract: "contracted" }, defender: null });
    expect(options.has("self:free")).toBe(false);
  });

  it("emits the self rank ladder, which was unreachable for the same reason", () => {
    const options = rollOptionsFor({
      attacker: { kind: "servant", parameters: { mag: "B" } }, defender: null,
    });
    expect(options.has("self:rank:mag:gte:B")).toBe(true);
    expect(options.has("self:rank:mag:gte:C")).toBe(true);
    expect(options.has("self:rank:mag:gte:A")).toBe(false);
  });
});
