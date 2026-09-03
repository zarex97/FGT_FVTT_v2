/**
 * @file §37.6's worked summon, as a golden fixture.
 * @see docs/37-content-pipeline.md §37.6, docs/14-checks-and-randomness.md §14.9
 *
 * The grant arithmetic is the part of the summon that has no Foundry in it, so
 * it is pinned here rather than left to the dialog. Every number below is read
 * off §37.6's Karna walkthrough.
 *
 * **One deliberate divergence, and it is a contradiction in the specification.**
 * §37.6's example rolls a Servant's Max Health (`1000 ± Health(S) → 913`);
 * §14.9's procedure block says `maxHealth = endTable[END.grade]  NO ROLL —
 * Health(S) is not used`. The code follows §14.9: an explicit "NO ROLL"
 * instruction in the normative procedure beats an illustrative walkthrough. The
 * Health figures here are therefore the unrolled ones, and §37.6 now carries a
 * note saying so.
 */

import { describe, it, expect } from "vitest";
import { applyGrants, mergeGrants, sheetPatch } from "../../module/engine/summon.mjs";
import {
  servantSetupPlan, resolveSetupPlan, summonPlan, baseAttackFor,
} from "../../module/rules/setup-rolls.mjs";

/** Karna, as §37.6 has him. */
const karna = {
  parameters: { str: "B", end: "C", agi: "A", mag: "B", luc: "D" },
  region: ["india"],
  baseAttack: { str: 125, mag: 175 },
};

/** The plan resolved against §37.6's dice: AGI coin heads (2), LUC 1d4 = 3. */
const resolved = () => resolveSetupPlan(servantSetupPlan(karna), { maxAgility: 2, maxLuck: 3 });

const valueOf = (lines, id) => lines.find((l) => l.id === id).value;

describe("§37.6 — summoning Karna into an Indian war", () => {
  const steps = summonPlan({ sheet: karna, warRegion: "india", masterGrants: { agi: 1 } });
  const granted = mergeGrants(steps);

  it("stacks the Master's grant with the Region's rather than taking one", () => {
    // Kaleidoscope gives +1 AGI; India gives +1 to everything. AGI ends at +2.
    expect(granted).toMatchObject({ str: 1, end: 1, agi: 2, mag: 1, luc: 1 });
  });

  it("moves Max Agility by one per step, on top of the rolled coin", () => {
    // 18 (AGI A) + 2 (coin) = 20, then +1 Master and +1 Region → 22.
    expect(valueOf(resolved(), "maxAgility")).toBe(20);
    expect(valueOf(applyGrants(resolved(), karna, granted), "maxAgility")).toBe(22);
  });

  it("moves Max Luck by one per step, on top of the 1d4", () => {
    // 4 (LUC D) + 3 = 7, then +1 from India → 8.
    expect(valueOf(applyGrants(resolved(), karna, granted), "maxLuck")).toBe(8);
  });

  it("moves Max Health UP THE TABLE for a granted END step, not by one", () => {
    // C → C+ is +100, because the Health table is not linear. Adding 1 the way
    // Agility does would give 1001.
    const before = valueOf(resolved(), "maxHealth");

    expect(valueOf(applyGrants(resolved(), karna, granted), "maxHealth")).toBe(before + 100);
  });

  it("still moves Health by 100 when the sheet states its own baseHealth", () => {
    // Medea states `baseHealth: 750`. Re-reading the table at the shifted rank
    // returned the stated figure unchanged, so her Region grant did nothing to
    // her Health -- and §14.9 says "± 100 per END step" outright.
    const stated = { ...karna, baseHealth: 750 };
    const lines = resolveSetupPlan(servantSetupPlan(stated), { maxAgility: 2, maxLuck: 3 });

    expect(valueOf(applyGrants(lines, stated, { end: 1 }), "maxHealth")).toBe(850);
  });

  it("adds 10 to each Base Attack component for its granted step", () => {
    // "STR B → B+ ⇒ BA(STR) +10 → 135" and "MAG B → B+ ⇒ BA(MAG) +10 → 185".
    //
    // Read off `baseAttackFor` rather than off the patch: since the author
    // supplied the conversion table (Ch. 41 Q50) Base Attack is DERIVED from
    // STR and MAG, so `sheetPatch` no longer carries it and a granted step
    // reaches it by moving the rank. The numbers are unchanged -- Karna is
    // STR B MAG B, and the table's B is exactly the 125/175 his sheet states.
    expect(baseAttackFor({ ...karna, grantedSteps: granted })).toEqual({ str: 135, mag: 185 });
    expect(sheetPatch(applyGrants(resolved(), karna, granted), karna, granted).baseAttack)
      .toBeUndefined();
  });

  it("leaves Base Attack alone for the AGI grant", () => {
    // §37.6 says it outright: "BA adjustment: none (AGI does not affect BA)".
    const agiOnly = mergeGrants(summonPlan({ sheet: karna, warRegion: null, masterGrants: { agi: 1 } }));

    expect(baseAttackFor({ ...karna, grantedSteps: agiOnly })).toEqual({ str: 125, mag: 175 });
  });

  it("records the granted steps on the sheet, so a rank can be checked", () => {
    // Without this the sheet shows a rank the Servant was not written with and
    // nothing says why.
    expect(sheetPatch(applyGrants(resolved(), karna, granted), karna, granted).grantedSteps)
      .toEqual({ str: 1, end: 1, agi: 2, mag: 1, luc: 1 });
  });

  it("starts the Servant at full Health, Agility and Luck", () => {
    const patch = sheetPatch(applyGrants(resolved(), karna, granted), karna, granted);

    expect(patch.health.value).toBe(patch.health.max);
    expect(patch.agility.value).toBe(patch.agility.max);
  });

  it("grants nothing for a war fought elsewhere", () => {
    const elsewhere = mergeGrants(summonPlan({ sheet: karna, warRegion: "japan" }));

    expect(elsewhere).toEqual({});
    expect(valueOf(applyGrants(resolved(), karna, elsewhere), "maxAgility")).toBe(20);
  });
});

/* ── A summon-time variant, applied at commit ────────────────────────────── */

describe("sheetPatch applies a resolved summon variant", () => {
  const semiramis = {
    ...karna,
    summonVariant: {
      heads: { id: "dsc", overrides: { sustainability: "4◈", range: { panels: 3, targets: 1 } } },
      tails: { id: "noDsc", overrides: { sustainability: "2◈", range: { panels: 2, targets: 1 } } },
    },
  };

  it("writes the branch id and merges its overrides on heads", () => {
    const lines = resolveSetupPlan(servantSetupPlan(semiramis), { summonVariant: 1, maxAgility: 2, maxLuck: 3 });
    const patch = sheetPatch(lines, semiramis, {});

    expect(patch.variant).toBe("dsc");
    expect(patch.sustainability).toBe("4◈");
    expect(patch.range).toEqual({ panels: 3, targets: 1 });
  });

  it("writes the OTHER branch's overrides on tails", () => {
    const lines = resolveSetupPlan(servantSetupPlan(semiramis), { summonVariant: 2, maxAgility: 2, maxLuck: 3 });
    const patch = sheetPatch(lines, semiramis, {});

    expect(patch.variant).toBe("noDsc");
    expect(patch.sustainability).toBe("2◈");
    expect(patch.range).toEqual({ panels: 2, targets: 1 });
  });

  it("does nothing for a Servant with no summonVariant block", () => {
    const patch = sheetPatch(resolved(), karna, {});

    expect(patch.variant).toBeUndefined();
    expect(patch.sustainability).toBeUndefined();
  });
});

/* ── HGoB Construction's summon-time value (Ch. 32 §32.2, sources 1-2) ───── */

describe("sheetPatch computes HGoB Construction's starting value", () => {
  const semiramis = { ...karna, resources: { hgobConstruction: { value: 0, max: 100 } } };
  const lines = (roll) => resolveSetupPlan(servantSetupPlan(semiramis),
    { maxAgility: 2, maxLuck: 3, hgobConstructionRoll: roll });

  it("starts at 25 when the war's Region IS Middle East, plus the summon roll", () => {
    const patch = sheetPatch(lines(12), semiramis, {}, "middleEast");
    expect(patch.resources.hgobConstruction.value).toBe(37);
  });

  it("starts at 10 when merely adjacent to Middle East, plus the summon roll", () => {
    // Greece borders Middle East but is not it.
    const patch = sheetPatch(lines(12), semiramis, {}, "greece");
    expect(patch.resources.hgobConstruction.value).toBe(22);
  });

  it("starts at 0 for an unrelated Region, plus the summon roll", () => {
    const patch = sheetPatch(lines(12), semiramis, {}, "japan");
    expect(patch.resources.hgobConstruction.value).toBe(12);
  });

  it("starts at 0 with no war Region at all", () => {
    const patch = sheetPatch(lines(6), semiramis, {}, null);
    expect(patch.resources.hgobConstruction.value).toBe(6);
  });

  it("does nothing for a Servant with no hgobConstruction resource", () => {
    expect(sheetPatch(resolved(), karna, {}, "middleEast").resources).toBeUndefined();
  });
});
