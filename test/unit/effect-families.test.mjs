/**
 * @file Effect families — Appendix A's umbrella names.
 * @see module/rules/effects/families.mjs, docs/A-effect-catalogue.md
 *
 * > *"Bind — umbrella for Stun, Disable, Immobilize, Slow, Petrify, Shock,
 * > Webbed, Seal, Freeze, Crystalfreeze."*
 *
 * Medusa's `Dmg Up (Bind)` is *"all damage dealt to Units inflicted with Bind
 * effects"* — the first clause in the corpus that asks about the umbrella
 * rather than about one of its members.
 */

import { describe, it, expect } from "vitest";
import { familiesOf, familiesPresent, unitHasFamily } from "../../module/rules/effects/families.mjs";
import { rollOptionsFor } from "../../module/rules/options.mjs";

const registry = new Map([
  ["stun", { id: "stun", families: ["bind"] }],
  ["petrify", { id: "petrify", families: ["bind"] }],
  ["burn", { id: "burn", families: [] }],
  ["poison", { id: "poison" }],
]);

/* -------------------------------------------------------------------------- */

describe("familiesOf", () => {
  it("reads the declared list", () => {
    expect(familiesOf({ families: ["bind"] })).toEqual(["bind"]);
  });

  it("is empty for an effect that declares none, and for nothing at all", () => {
    expect(familiesOf({ id: "poison" })).toEqual([]);
    expect(familiesOf(null)).toEqual([]);
  });
});

describe("familiesPresent", () => {
  it("collects every family the live effects put the unit in", () => {
    expect(familiesPresent(["stun", "burn"], registry)).toEqual(["bind"]);
  });

  it("names each family once, however many members are carried", () => {
    // Stun AND Petrify is still one Bind, not two.
    expect(familiesPresent(["stun", "petrify"], registry)).toEqual(["bind"]);
  });

  it("is empty for effects with no family and for unknown ids", () => {
    expect(familiesPresent(["burn", "nosuch"], registry)).toEqual([]);
    expect(familiesPresent([], registry)).toEqual([]);
  });
});

describe("unitHasFamily", () => {
  it("reads the projected list when the snapshot has one", () => {
    expect(unitHasFamily({ effectFamilies: ["bind"] }, "bind")).toBe(true);
    expect(unitHasFamily({ effectFamilies: [] }, "bind")).toBe(false);
  });

  it("falls back to the registry for a bare unit", () => {
    expect(unitHasFamily({ effects: ["stun"] }, "bind", registry)).toBe(true);
    expect(unitHasFamily({ effects: ["burn"] }, "bind", registry)).toBe(false);
  });

  it("ignores a SUPPRESSED instance — a Stun that is not stunning is not binding", () => {
    const unit = { effects: ["stun"], effectInstances: [{ defId: "stun", suppressed: true }] };
    expect(unitHasFamily(unit, "bind", registry)).toBe(false);
  });
});

describe("the roll option", () => {
  it("emits one per family, for both sides", () => {
    const options = rollOptionsFor({
      attacker: { kind: "servant", effectFamilies: ["bind"] },
      defender: { kind: "servant", effectFamilies: ["bind"] },
    });
    expect(options.has("self:effectFamily:bind")).toBe(true);
    expect(options.has("target:effectFamily:bind")).toBe(true);
  });

  it("emits none when the unit carries no family", () => {
    const options = rollOptionsFor({ attacker: { kind: "servant", effects: ["burn"] }, defender: null });
    expect([...options].some((o) => o.startsWith("self:effectFamily:"))).toBe(false);
  });
});
