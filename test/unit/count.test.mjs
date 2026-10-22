/**
 * @file The Count module: one reader for every "how many" a sheet asks (#319).
 * @see module/rules/count.mjs, docs/superpowers/plans/2026-10-22-count-and-use-record.md (Task 2)
 */

import { describe, it, expect } from "vitest";
import {
  COUNT_KINDS, UnknownCountKind, countOf, countedValue, stacksHeld,
  fromPerStack, fromCountTargets, fromCountMatching,
} from "../../module/rules/count.mjs";
import { withSubjects } from "../helpers/subject.mjs";

describe("the closed list of kinds (Q19)", () => {
  it("is the eight kinds the grill settled, frozen", () => {
    expect(COUNT_KINDS).toEqual(["stacks", "targets", "board", "resource", "parameters", "criteria", "use", "tally"]);
    expect(Object.isFrozen(COUNT_KINDS)).toBe(true);
  });

  it("refuses a kind it does not know, out loud and by name", () => {
    let caught = null;
    try { countOf({ of: "bogus" }, {}); } catch (err) { caught = err; }
    expect(caught).toBeInstanceOf(UnknownCountKind);
    expect(caught.kind).toBe("bogus");
    expect(caught.message).toContain("bogus");
  });

  it("refuses a spec with no kind at all", () => {
    expect(() => countOf({}, {})).toThrow(UnknownCountKind);
  });
});

describe("each kind reads its own source", () => {
  it("stacks: the bearer's count of one effect, none when it holds none", () => {
    expect(countOf({ of: "stacks", effect: "s" }, { stacks: { s: 4 } })).toBe(4);
    expect(countOf({ of: "stacks", effect: "other" }, { stacks: { s: 4 } })).toBe(0);
  });

  it("targets: the phase's recipients that pass `requires`, the caster excluded when asked", () => {
    const withSkill = (id) => ({ id, abilities: [{ slug: "eotd" }] });
    const targets = [withSkill("gogh"), withSkill("a1"), { id: "x", abilities: [] }];
    const spec = { of: "targets", requires: ["self:skill:eotd"], excludeSelf: true };
    expect(countOf(spec, { targets, casterId: "gogh" })).toBe(1);
    expect(countOf({ ...spec, excludeSelf: false }, { targets, casterId: "gogh" })).toBe(2);
    expect(countOf({ of: "targets" }, { targets, casterId: "gogh" })).toBe(3);
  });

  it("board: the Units at the stated relation that pass `requires`", () => {
    const self = { id: "sem", kind: "servant", factionId: "red", effects: [], abilities: [] };
    const dove = (id, factionId) => ({ id, kind: "servant", factionId, effects: ["dove"], abilities: [] });
    const board = { units: [self, dove("e1", "blue"), dove("e2", "blue"), dove("a1", "red")] };
    expect(countOf({ of: "board", relation: "enemy", requires: ["self:effect:dove"] }, { board, self })).toBe(2);
    expect(countOf({ of: "board", relation: "ally", requires: ["self:effect:dove"] }, { board, self })).toBe(1);
  });

  it("resource: the value of one of the Unit's resources, 0 when it has none", () => {
    const refs = { self: { resources: { aria: { value: 5 } } } };
    expect(countOf({ of: "resource", key: "aria" }, { refs })).toBe(5);
    expect(countOf({ of: "resource", key: "prs" }, { refs })).toBe(0);
  });

  it("criteria: the declaration's criteria met", () => {
    expect(countOf({ of: "criteria" }, { use: { criteriaMet: 3 } })).toBe(3);
    expect(countOf({ of: "criteria" }, {})).toBe(0);
  });

  it("use: a fact of the Use record, a flag counting 1", () => {
    expect(countOf({ of: "use", fact: "debuffsInflicted" }, { use: { debuffsInflicted: 2 } })).toBe(2);
    expect(countOf({ of: "use", fact: "evaded" }, { use: { evaded: true } })).toBe(1);
    expect(countOf({ of: "use", fact: "evaded" }, { use: {} })).toBe(0);
  });

  it("tally: the mode's tally", () => {
    expect(countOf({ of: "tally" }, { ability: { tally: 4 } })).toBe(4);
    expect(countOf({ of: "tally" }, {})).toBe(0);
  });
});

describe("a value sized by a count (countedValue)", () => {
  const stacks = (n) => ({ stacks: { s: n } });
  const count = { of: "stacks", effect: "s" };

  it("is base plus per for every `each` counted, clamped to max", () => {
    expect(countedValue({ count, per: 8, max: 80 }, stacks(12))).toBe(80);
    expect(countedValue({ count, per: 1, each: 3 }, stacks(7))).toBe(2);
    expect(countedValue({ count, base: 3, per: 0.5 }, stacks(4))).toBe(5);
  });

  it("pays nothing at zero when the clause says so, its base included", () => {
    expect(countedValue({ count, base: 30, per: 5, zeroPaysNothing: true }, stacks(0))).toBe(0);
    expect(countedValue({ count, base: 30, per: 5 }, stacks(0))).toBe(30);
  });

  it("is a plain number when it is one", () => {
    expect(countedValue(4.5, {})).toBe(4.5);
  });
});

describe("the one rule for counting stacks (Q3)", () => {
  it("counts a stage before uses and uses before one, on the actor and its projection alike", async () => {
    await withSubjects([{
      from: "test-jeanne-d-arc",
      effects: [
        { defId: "curse", stage: 7, uses: 2 },
        { defId: "npDmUpGao", uses: 2 },
        { defId: "proliferationStock" },
        { defId: "proliferationStock" },
      ],
    }], ({ units, world }) => {
      // A stage before uses, uses before one, one per plain instance.
      const want = { curse: 7, npDmUpGao: 2, proliferationStock: 2 };
      expect(stacksHeld(world.actor("test-jeanne-d-arc"))).toEqual(want);
      // The board's projection of the same Unit gives the same answer: the
      // handler's `times` reads this shape, and counted it its own way.
      expect(stacksHeld(units[0])).toEqual(want);
    });
  });
});

describe("the old spellings, in the canonical form", () => {
  it("perStack pays nothing at zero, base included", () => {
    expect(fromPerStack({ effect: "s", each: 3, base: 30 }))
      .toEqual({ count: { of: "stacks", effect: "s" }, each: 3, base: 30, zeroPaysNothing: true });
  });

  it("countTargets pays its base at zero, and `each` is the amount per target", () => {
    expect(fromCountTargets({ base: 3, each: 1, requires: ["x"], excludeSelf: true }))
      .toEqual({ count: { of: "targets", requires: ["x"], excludeSelf: true }, per: 1, base: 3 });
  });

  it("countMatching counts the board", () => {
    expect(fromCountMatching({ relation: "enemy", requires: ["self:effect:dove"] }))
      .toEqual({ count: { of: "board", relation: "enemy", requires: ["self:effect:dove"] }, per: 1 });
  });
});
