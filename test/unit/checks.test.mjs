import { describe, it, expect } from "vitest";
import {
  evade, luckCheck, tableFor, resolveCheck, chance, applicationChance, checkPlan,
  UNFAVOURABLE_PENALTY, critChance,
} from "../../module/rules/checks.mjs";

describe("the favourable/unfavourable split is symmetric between Evade and Luck", () => {
  it("penalises the unfavourable table by 4 in both cases — the Q40 correction", () => {
    expect(UNFAVOURABLE_PENALTY).toBe(4);
    expect(resolveCheck({ roll: 12, target: 14, table: "unfavourable" }).total).toBe(16);
    expect(luckCheck({ roll: 12, luck: 14, opposingLuck: 20 }).total).toBe(16);
    expect(evade({ roll: 12, agility: 14, forceUnfavourable: true }).total).toBe(16);
  });

  it("makes contesting a luckier opponent actually cost something", () => {
    // 0.2.0 had luckCheck- identical to luckCheck, which made this free.
    const vsLuckier = luckCheck({ roll: 12, luck: 14, opposingLuck: 20 });
    const vsWorse = luckCheck({ roll: 12, luck: 14, opposingLuck: 8 });
    expect(vsLuckier.success).toBe(false);
    expect(vsWorse.success).toBe(true);
  });
});

describe("tableFor", () => {
  it("picks favourable when your stat meets or beats the opponent's", () => {
    expect(tableFor(14, 14)).toBe("favourable");
    expect(tableFor(15, 14)).toBe("favourable");
    expect(tableFor(13, 14)).toBe("unfavourable");
  });

  it("uses favourable for an uncontested check", () => {
    expect(tableFor(10, null)).toBe("favourable");
  });

  it("honours Luck Boost and Luck Loss, which are live effects again", () => {
    expect(tableFor(5, 20, { boost: true })).toBe("favourable");
    expect(tableFor(20, 5, { loss: true })).toBe("unfavourable");
  });

  it("lets the debuff win when a unit somehow has both", () => {
    expect(tableFor(20, 5, { boost: true, loss: true })).toBe("unfavourable");
  });
});

describe("success is rolling at or under the target", () => {
  it("treats an exact match as a success", () => {
    expect(resolveCheck({ roll: 14, target: 14, table: "favourable" }).success).toBe(true);
    expect(resolveCheck({ roll: 15, target: 14, table: "favourable" }).success).toBe(false);
  });

  it("treats positive modifiers as making the check harder", () => {
    const r = evade({
      roll: 10, agility: 14,
      modifiers: [{ source: "attack is an NP", value: 3 }, { source: "from behind", value: 2 }],
    });
    expect(r.total).toBe(15);
    expect(r.success).toBe(false);
  });

  it("records every modifier for the audit trail", () => {
    const r = luckCheck({
      roll: 5, luck: 12, opposingLuck: 20,
      modifiers: [{ source: "LUC Dwn", value: 2 }],
    });
    expect(r.modifiers).toEqual([
      { source: "unfavourable table", value: 4 },
      { source: "LUC Dwn", value: 2 },
    ]);
    expect(r.total).toBe(11);
  });
});

describe("Dodge and Aim", () => {
  it("Dodge succeeds without rolling", () => {
    const r = evade({ roll: 20, agility: 1, hasDodge: true });
    expect(r.success).toBe(true);
    expect(r.automatic).toBe(true);
  });

  it("Aim beats Dodge and forces the roll", () => {
    const r = evade({ roll: 20, agility: 1, hasDodge: true, attackHasAim: true });
    expect(r.success).toBe(false);
    expect(r.automatic).toBe(false);
  });
});

describe("Mad Enhancement clause 6", () => {
  it("forces Evade− regardless of the stat comparison", () => {
    expect(evade({ roll: 12, agility: 14 }).success).toBe(true);
    expect(evade({ roll: 12, agility: 14, forceUnfavourable: true }).success).toBe(false);
  });
});

describe("chance", () => {
  it("is strictly under the percentage, so 0% never fires and 100% always does", () => {
    expect(chance(1, 0)).toBe(false);
    expect(chance(100, 100)).toBe(true);
    expect(chance(1, 100)).toBe(true);
  });

  it("gives exactly N successes in 100 for an N% chance", () => {
    for (const pct of [1, 25, 50, 99]) {
      const hits = Array.from({ length: 100 }, (_, k) => chance(k + 1, pct)).filter(Boolean).length;
      expect(hits, `${pct}%`).toBe(pct);
    }
  });

  it("clamps a stated chance above 100 rather than needing a special case", () => {
    // Proto Gil's Enki states a 500% Drowning chance.
    expect(chance(100, 500)).toBe(true);
    expect(chance(1, 500)).toBe(true);
  });
});

describe("applicationChance", () => {
  it("subtracts resistance from the stated chance", () => {
    expect(applicationChance({ base: 50, resist: 20 }).percent).toBe(30);
    expect(applicationChance({ base: 50, inflictBonus: 10, resist: 20 }).percent).toBe(40);
  });

  it("blocks entirely on immunity", () => {
    const r = applicationChance({ base: 50, immune: true });
    expect(r.blocked).toBe(true);
    expect(r.percent).toBe(0);
  });

  it("separates immunity from resistance, as Enkidu requires", () => {
    // Enkidu bypasses Debuff Immune against Divine units, but Debuff Resist
    // still reduces the chance.
    const r = applicationChance({ base: 50, resist: 20, immune: true, bypassesImmunity: true });
    expect(r.blocked).toBe(false);
    expect(r.percent).toBe(30);
  });
});

describe("checkPlan — the bridge from rule elements to a die roll", () => {
  /** A snapshot carrying what `collectContributions` produces. */
  const unit = {
    checkModifiers: [
      { check: "evade", forceTable: "unfavourable", source: "Mad Enhancement" },
      { check: "evade", value: 2, direction: "outgoing", source: "Heavy Armour" },
      { check: "evade", value: 5, direction: "incoming", source: "somebody else's problem" },
      { check: "luck", value: -1, source: "Fortune" },
      { check: "any", playerAdjustable: true, max: 3, source: "Master Essence" },
    ],
    autoSucceeds: [{ check: "evade", beatenBy: ["aim"], source: "Clairvoyance" }],
  };

  it("selects only the modifiers for the named check and direction", () => {
    expect(checkPlan(unit, "evade").modifiers).toEqual([
      { source: "Heavy Armour", value: 2 },
    ]);
  });

  it("includes check: any entries", () => {
    expect(checkPlan(unit, "evade").adjustable.map((m) => m.source)).toEqual(["Master Essence"]);
  });

  it("carries the forced table through", () => {
    expect(checkPlan(unit, "evade").forceTable).toBe("unfavourable");
    expect(checkPlan(unit, "luck").forceTable).toBeNull();
  });

  it("lets the unfavourable table win when both are forced", () => {
    const both = {
      checkModifiers: [
        { check: "evade", forceTable: "favourable", source: "Agi Boost" },
        { check: "evade", forceTable: "unfavourable", source: "Mad Enhancement" },
      ],
    };
    expect(checkPlan(both, "evade").forceTable).toBe("unfavourable");
  });

  it("finds the auto-succeed entry", () => {
    expect(checkPlan(unit, "evade").autoSucceed.source).toBe("Clairvoyance");
    expect(checkPlan(unit, "luck").autoSucceed).toBeNull();
  });

  it("returns an empty plan for a unit with no contributions", () => {
    const plan = checkPlan({}, "evade");
    expect(plan).toEqual({ modifiers: [], forceTable: null, autoSucceed: null, adjustable: [] });
  });

  it("survives a null unit", () => {
    expect(checkPlan(null, "evade").modifiers).toEqual([]);
  });
});

describe("a granted AutoSucceed behaves like Dodge", () => {
  const granted = { beatenBy: ["aim"], source: "Clairvoyance" };

  it("succeeds without rolling", () => {
    const r = evade({ roll: 20, agility: 3, autoSucceed: granted });
    expect(r.success).toBe(true);
    expect(r.automatic).toBe(true);
    expect(r.modifiers[0].source).toBe("Clairvoyance");
  });

  it("is beaten by the property it names", () => {
    const r = evade({ roll: 20, agility: 3, autoSucceed: granted, attackProperties: ["aim"] });
    expect(r.success).toBe(false);
    expect(r.automatic).toBe(false);
  });

  it("is not beaten by an unrelated property", () => {
    const r = evade({ roll: 20, agility: 3, autoSucceed: granted, attackProperties: ["np"] });
    expect(r.success).toBe(true);
  });

  it("still loses to a forced unfavourable table only by rolling", () => {
    // The auto-succeed short-circuits before the table is consulted, which is
    // the point: Mad Enhancement makes the ROLL worse, it does not remove an
    // automatic evasion.
    const r = evade({ roll: 20, agility: 3, autoSucceed: granted, forceUnfavourable: true });
    expect(r.success).toBe(true);
  });
});

describe("critChance", () => {
  const withMods = (mods) => ({ effects: [], checkModifiers: mods });

  it("is 50% with nothing modifying it", () => {
    // §14.6: the coin flip IS a 50% chance, and writing it as a `1d2` is what
    // made every crit modifier in the game inert.
    expect(critChance(withMods([])).percent).toBe(50);
  });

  it("adds the attacker's Crit Up", () => {
    // Scáthach's Clairvoyance: "Crit Chance is increased by 50%."
    expect(critChance(withMods([{ check: "crit", value: 50, source: "Crit Up" }])).percent).toBe(100);
  });

  it("subtracts the attacker's Crit Dwn", () => {
    // Her Primordial Rune's enemy table, row 3.
    expect(critChance(withMods([{ check: "crit", value: -25, source: "Crit Dwn" }])).percent).toBe(25);
  });

  it("reads the defender's contributions as incoming", () => {
    // `Crit Guard` reduces the ATTACKER's crit chance. Authored incoming so a
    // defender cannot accidentally raise its own crit rate with it.
    const spec = critChance(
      withMods([]),
      withMods([{ check: "crit", direction: "incoming", value: -20, source: "Crit Guard" }]),
    );
    expect(spec.percent).toBe(30);
  });

  it("treats 100% or more as automatic", () => {
    expect(critChance(withMods([{ check: "crit", value: 60, source: "x" }])).automatic).toBe(true);
  });

  it("lets No Crit beat G.Crit, as debuffs beat buffs everywhere else", () => {
    const both = { effects: ["gCrit", "noCrit"], checkModifiers: [] };
    expect(critChance(both)).toMatchObject({ percent: 0, blocked: true, automatic: false });
  });

  it("makes G.Crit certain on its own", () => {
    expect(critChance({ effects: ["gCrit"], checkModifiers: [] }).automatic).toBe(true);
  });
});
