/**
 * @file Copied abilities — Wisdom of Dún Scáith.
 * @see docs/15-abilities.md §15.7
 */

import { describe, it, expect } from "vitest";
import {
  canCopy, copyCandidates, copyAbility, effectivePhases, COPY_REFUSALS,
} from "../../module/rules/copy.mjs";

const ability = (over = {}) => ({
  id: "a", name: "Battle Continuation", rank: "A", kind: "personalSkill",
  phases: [{ kind: "StatDelta" }], ...over,
});

const unit = (over = {}) => ({ id: "u", name: "Karna", abilities: [], ...over });

describe("canCopy", () => {
  it("allows an ordinary active Personal Skill", () => {
    expect(canCopy(ability())).toMatchObject({ ok: true });
  });

  it("refuses a Class Skill", () => {
    // "excluding Class Skills" — stated in the grant itself, not the exclusion
    // list, and easy to lose because the exclusion list is the longer text.
    expect(canCopy(ability({ kind: "classSkill" }))).toMatchObject({ ok: false, reason: "classSkill" });
  });

  it("refuses Rank EX outright", () => {
    expect(canCopy(ability({ rank: "EX" }))).toMatchObject({ ok: false, reason: "rankEX" });
  });

  it("refuses an ability whose content says it cannot be copied", () => {
    expect(canCopy(ability({ copyable: { allowed: false, reason: "physical" } })))
      .toMatchObject({ ok: false, reason: "physical" });
  });

  it("refuses a passive, because the grant asks for an Active effect", () => {
    expect(canCopy(ability({ phases: [], passive: true })))
      .toMatchObject({ ok: false, reason: "notActive" });
  });

  it("refuses a Noble Phantasm", () => {
    // The grant says Skills. An NP is not one, and copying one would hand over
    // the single most consequential thing a Servant owns.
    expect(canCopy(ability({ isNP: true }))).toMatchObject({ ok: false, reason: "notASkill" });
  });

  it("names a refusal from the documented set", () => {
    const reason = canCopy(ability({ kind: "classSkill" })).reason;

    expect(COPY_REFUSALS).toContain(reason);
  });
});

describe("copyCandidates", () => {
  const scathach = unit({ id: "scathach", name: "Scáthach" });
  const board = {
    units: [
      scathach,
      unit({ id: "karna", abilities: [ability({ id: "k1", rank: "A" }), ability({ id: "k2", rank: "EX" })] }),
      unit({ id: "heracles", abilities: [ability({ id: "h1", rank: "B" })] }),
    ],
  };

  it("offers every copyable Skill on the field", () => {
    expect(copyCandidates(board, scathach).map((c) => c.ability.id)).toEqual(["k1", "h1"]);
  });

  it("excludes the copier's own abilities", () => {
    // "of all OTHER Servants on the field".
    const withOwn = { units: [{ ...scathach, abilities: [ability({ id: "s1" })] }, ...board.units.slice(1)] };

    expect(copyCandidates(withOwn, scathach).map((c) => c.ability.id)).not.toContain("s1");
  });

  it("says which Servant each came from, because the GM picks per Servant", () => {
    expect(copyCandidates(board, scathach)[0]).toMatchObject({ unitId: "karna", unitName: "Karna" });
  });

  it("prefers B to A when asked to, without hiding the rest", () => {
    // "preferably Rank B to Rank A" — a preference, not a filter, so a war
    // with nothing in that band still offers something.
    const ranked = copyCandidates(board, scathach, { prefer: ["A", "B"] });

    expect(ranked.every((c) => "preferred" in c)).toBe(true);
    expect(ranked.filter((c) => c.preferred)).toHaveLength(2);
  });

  it("offers nothing on an empty field", () => {
    expect(copyCandidates({ units: [scathach] }, scathach)).toEqual([]);
  });
});

describe("copyAbility", () => {
  const source = ability({ id: "k1", name: "Mana Burst", rank: "A" });

  it("copies the phases BY REFERENCE, so a later content fix propagates", () => {
    const copy = copyAbility(source, unit({ id: "scathach" }), { rank: "A+", cooldown: "4◈−⅓◈" });

    expect(copy.copiedFrom).toBe("k1");
    expect(copy.phases).toBeUndefined();
  });

  it("takes the copier's rank, not the source's", () => {
    // Scáthach uses them "as effects of THIS Skill", so the Skill's own rank
    // governs — copying the source's rank would let her outrank the original.
    expect(copyAbility(source, unit(), { rank: "A+" }).rank).toBe("A+");
  });

  it("takes the copier's cooldown", () => {
    expect(copyAbility(source, unit(), { rank: "A+", cooldown: "4◈−⅓◈" }).cooldown).toBe("4◈−⅓◈");
  });

  it("keeps the source's name visible, so the card says what was copied", () => {
    expect(copyAbility(source, unit(), { rank: "A+" }).name).toContain("Mana Burst");
  });

  it("marks it as granted, with a source, so it expires like every other grant", () => {
    expect(copyAbility(source, unit({ id: "scathach" }), { rank: "A+", grantedBy: "wisdomOfDunScaith" }))
      .toMatchObject({ granted: true, grantedBy: "wisdomOfDunScaith", unitId: "scathach" });
  });

  it("puts every copy in one mutual-exclusion set", () => {
    // Two copies of the same Skill are one Skill used twice, and the grant
    // gives two slots rather than two independent abilities.
    const copy = copyAbility(source, unit(), { rank: "A+", exclusionSet: "dunScaith" });

    expect(copy.exclusionSet).toBe("dunScaith");
  });

  it("refuses to copy what canCopy refuses", () => {
    // The gate belongs on the operation too; a caller that forgot to check
    // would otherwise produce a copy the rules forbid.
    expect(copyAbility(ability({ rank: "EX" }), unit(), { rank: "A+" })).toBeNull();
  });
});

describe("effectivePhases", () => {
  const source = ability({ id: "k1", phases: [{ kind: "damage" }] });

  it("follows a copy to its source", () => {
    const copy = copyAbility(source, unit(), { rank: "A+" });

    expect(effectivePhases(copy, (id) => (id === "k1" ? source : null))).toEqual([{ kind: "damage" }]);
  });

  it("sees a later content fix to the source", () => {
    // The whole reason a copy is by reference.
    const copy = copyAbility(source, unit(), { rank: "A+" });
    const fixed = { ...source, phases: [{ kind: "damage", fixed: true }] };

    expect(effectivePhases(copy, () => fixed)[0]).toMatchObject({ fixed: true });
  });

  it("returns an ordinary ability's own phases", () => {
    expect(effectivePhases(source, () => null)).toEqual([{ kind: "damage" }]);
  });

  it("returns nothing when the source is gone", () => {
    const copy = copyAbility(source, unit(), { rank: "A+" });

    expect(effectivePhases(copy, () => null)).toEqual([]);
  });

  it("reads a Foundry document's system.phases too", () => {
    const copy = copyAbility(source, unit(), { rank: "A+" });

    expect(effectivePhases(copy, () => ({ system: { phases: [{ kind: "heal" }] } })))
      .toEqual([{ kind: "heal" }]);
  });
});

describe("the board shape", () => {
  it("accepts `hasPhases` in place of the phases themselves", () => {
    // `copyCandidates` reads the BOARD snapshot, whose ability entries carry a
    // boolean rather than a phase list. Reading only `phases` made every
    // candidate on the board look passive, so Wisdom of Dún Scáith could not
    // copy a single Skill in the game — in any world, ever.
    expect(canCopy({ id: "a", rank: "B", hasPhases: true })).toMatchObject({ ok: true });
    expect(canCopy({ id: "a", rank: "B", hasPhases: false })).toMatchObject({ ok: false, reason: "notActive" });
  });

  it("still refuses a class skill and a passive on the board shape", () => {
    expect(canCopy({ id: "a", rank: "A", hasPhases: true, kind: "classSkill" }))
      .toMatchObject({ reason: "classSkill" });
    expect(canCopy({ id: "a", rank: "A", hasPhases: true, passive: true }))
      .toMatchObject({ reason: "notActive" });
  });

  it("offers a board ability whose whole record is the projection", () => {
    // The exact shape `collectAbilities` produces, so the projection and the
    // rule are held against each other rather than against a fixture.
    const board = {
      units: [
        { id: "s", name: "Scáthach", abilities: [] },
        {
          id: "m",
          name: "Medea",
          abilities: [{
            id: "gf", name: "Golden Fleece", rank: null, isNP: false,
            kind: null, passive: false, hasPhases: true, copyable: null,
          }],
        },
      ],
    };
    expect(copyCandidates(board, { id: "s" }).map((c) => c.ability.name)).toEqual(["Golden Fleece"]);
  });
});
