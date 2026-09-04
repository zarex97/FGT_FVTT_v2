/**
 * @file The sheet's arithmetic, held without a world.
 * @see docs/29-user-interface.md §29.2
 *
 * Every function under test is pure by construction. That is the whole point
 * of the split: "Cooldown 4◈ (12 turns)", "Poison Stage 3 → 80" and "written
 * C, granted +1" are questions with answers, and a question with an answer
 * belongs in a test rather than inside a template that can only be checked by
 * opening it and looking.
 */

import { describe, it, expect } from "vitest";
import {
  resourceBar, parameterTiles, baseAttackTiles, remainingTurns, ticksLabel,
  abilityState, abilityCost, groupEffects, describeModifier,
} from "../../module/apps/actor-sheet/present.mjs";

describe("resourceBar", () => {
  it("computes a percentage", () => {
    expect(resourceBar({ value: 500, max: 1000 })).toMatchObject({ pct: 50, label: "500 / 1000" });
  });

  it("calls a null maximum undamageable rather than drawing an empty bar", () => {
    // `null` health is intrinsic -- Pale Rider, the Kagome Spirits -- and a
    // zero-width bar reads as "about to die", which is the opposite of true.
    expect(resourceBar({ value: null, max: null })).toMatchObject({ undamageable: true, pct: 0 });
  });

  it("does not divide by zero", () => {
    expect(resourceBar({ value: 0, max: 0 })).toMatchObject({ pct: 0 });
  });

  it("clamps a value above its maximum", () => {
    expect(resourceBar({ value: 1200, max: 1000 })).toMatchObject({ pct: 100 });
  });

  it("survives being handed nothing", () => {
    expect(resourceBar(null)).toMatchObject({ undamageable: true });
  });
});

describe("parameterTiles", () => {
  it("reports the granted steps beside the rank in force", () => {
    const tiles = parameterTiles({ str: "B", end: "C" }, { str: 1, end: 0 });
    expect(tiles.find((t) => t.key === "str")).toMatchObject({
      rank: "B", steps: 1, granted: true,
    });
  });

  it("never invents an 'authored' rank by stepping back down", () => {
    // Nothing in the engine shifts `system.parameters` by `grantedSteps`:
    // summon writes the steps and only `baseAttackAdjustment` reads them, and a
    // Region bonus travels a different path. So a tile that rendered
    // "B- ▸ B" would print a Rank the Servant was never written with, on the
    // one tile whose whole purpose is being checkable against its sheet.
    const tiles = parameterTiles({ str: "B" }, { str: 1 });
    expect(tiles[0].authored).toBeUndefined();
    expect(tiles[0].rank).toBe("B");
  });

  it("leaves an ungranted parameter unmarked", () => {
    const tiles = parameterTiles({ end: "C" }, { end: 0 });
    expect(tiles[0]).toMatchObject({ key: "end", rank: "C", granted: false, steps: 0 });
  });

  it("renders an unset parameter as a dash rather than as empty", () => {
    expect(parameterTiles({ luc: "" }, {})[0]).toMatchObject({ key: "luc", rank: "—" });
  });

  it("keeps the five parameters in sheet order", () => {
    const keys = parameterTiles({ luc: "A", str: "B", mag: "C", end: "D", agi: "E" }, {}).map((t) => t.key);
    expect(keys).toEqual(["str", "end", "agi", "mag", "luc"]);
  });
});

describe("remainingTurns", () => {
  it("is the difference between expiry and now", () => {
    expect(remainingTurns(24, 20)).toBe(4);
  });

  it("is null out of combat, where there is no tick to count from", () => {
    expect(remainingTurns(24, null)).toBe(null);
  });

  it("is null for an effect with no expiry", () => {
    expect(remainingTurns(null, 20)).toBe(null);
  });

  it("never goes negative", () => {
    expect(remainingTurns(18, 20)).toBe(0);
  });
});

describe("ticksLabel", () => {
  it("renders whole rounds", () => {
    expect(ticksLabel(12, 3)).toBe("4◈");
  });

  it("renders a part round as a vulgar fraction", () => {
    expect(ticksLabel(4, 3)).toBe("1⅓◈");
    expect(ticksLabel(2, 3)).toBe("⅔◈");
  });

  it("handles halves and quarters for other round lengths", () => {
    expect(ticksLabel(1, 2)).toBe("½◈");
    expect(ticksLabel(3, 4)).toBe("¾◈");
  });

  it("falls back to n/d for a fraction with no glyph", () => {
    expect(ticksLabel(1, 5)).toBe("1/5◈");
  });

  it("is empty for no turns at all", () => {
    expect(ticksLabel(0, 3)).toBe("");
  });
});

describe("abilityState", () => {
  const ctx = { turnsPerRound: 3 };

  it("reports Ready when the gate allows it", () => {
    expect(abilityState({ ok: true }, ctx)).toMatchObject({ ok: true, label: "FGT.Ability.Ready" });
  });

  it("converts a cooldown to both notations", () => {
    // "12" tells a player nothing about when; "4◈ (12 turns)" tells them both.
    expect(abilityState({ ok: false, reason: "cooldown", detail: { remaining: 12 } }, ctx))
      .toMatchObject({ ok: false, label: "FGT.Ability.Cooldown", detail: { remaining: 12, ticks: "4◈" } });
  });

  it("keeps a part-round cooldown honest rather than rounding it to a tick", () => {
    expect(abilityState({ ok: false, reason: "cooldown", detail: { remaining: 4 } }, ctx))
      .toMatchObject({ detail: { remaining: 4, ticks: "1⅓◈" } });
  });

  it("reports an exhausted whole-match budget with both numbers", () => {
    expect(abilityState({ ok: false, reason: "exhausted", detail: { maxUses: 11, timesUsed: 11 } }, ctx))
      .toMatchObject({ ok: false, label: "FGT.Ability.Exhausted", detail: { maxUses: 11, timesUsed: 11 } });
  });

  it("reports a round gate with how far away it is", () => {
    expect(abilityState({ ok: false, reason: "round", detail: { requiresRound: 6, round: 4 } }, ctx))
      .toMatchObject({ label: "FGT.Ability.FromRound", detail: { requiresRound: 6, away: 2 } });
  });

  it("labels every reason canUseAbility can return", () => {
    // A refusal with no label is a disabled button with no explanation, which
    // is the one thing D29.2 forbids.
    for (const reason of ["oncePerTurn", "sameTurnExclusive", "sameRoundExclusive",
      "presenceConcealment", "zon"]) {
      expect(abilityState({ ok: false, reason }, ctx).label).toBe(`FGT.Ability.Refused.${reason}`);
    }
  });

  it("passes an unrecognised reason through rather than dropping it", () => {
    expect(abilityState({ ok: false, reason: "someNewGate" }, ctx))
      .toMatchObject({ ok: false, label: "FGT.Ability.Refused.someNewGate" });
  });
});

describe("abilityCost", () => {
  it("states affordability rather than implying it", () => {
    expect(abilityCost({ kind: "masterHealth", amount: 53 }, { name: "Jinako", health: { value: 118 } }))
      .toMatchObject({ kind: "masterHealth", amount: 53, affordable: true, payer: "Jinako", has: 118 });
  });

  it("marks an unaffordable cost", () => {
    expect(abilityCost({ kind: "masterHealth", amount: 53 }, { name: "Jinako", health: { value: 40 } }))
      .toMatchObject({ affordable: false });
  });

  it("is not affordable when a contracted Servant has no Master at all", () => {
    expect(abilityCost({ kind: "masterHealth", amount: 53 }, null))
      .toMatchObject({ affordable: false });
  });

  it("charges a Free Servant's Sustainability against its own clock", () => {
    expect(abilityCost({ kind: "sustainability", amount: 2 }, null, { sustainability: 7 }))
      .toMatchObject({ kind: "sustainability", amount: 2, has: 7, affordable: true });
  });

  it("refuses a Sustainability cost the clock cannot pay", () => {
    expect(abilityCost({ kind: "sustainability", amount: 5 }, null, { sustainability: 2 }))
      .toMatchObject({ affordable: false });
  });

  it("is null when there is no cost", () => {
    expect(abilityCost(null, null)).toBe(null);
  });

  it("is null for a zero cost, which is not a cost", () => {
    expect(abilityCost({ kind: "masterHealth", amount: 0 }, null)).toBe(null);
  });
});

describe("groupEffects", () => {
  // `polarity` is the buff/debuff/status axis, NOT `valence`. Valence is a
  // separate one -- offensive/defensive/neutral/neither -- and no effect in
  // the catalogue carries `valence: debuff` at all, so grouping on it filed
  // every debuff in the game under Statuses.
  const defs = {
    defUp: { id: "defUp", name: "Def Up", polarity: "buff", valence: "defensive" },
    poison: { id: "poison", name: "Poison", polarity: "debuff", valence: "offensive" },
    madEnhancement: {
      id: "madEnhancement", name: "Mad Enhancement",
      polarity: "status", valence: "neither", unremovable: true,
    },
  };
  const lookup = (id) => defs[id] ?? null;

  it("groups by the definition's polarity, not its valence", () => {
    const out = groupEffects(
      [{ defId: "defUp" }, { defId: "poison" }, { defId: "madEnhancement" }],
      lookup, { effects: [] },
    );
    expect(out.buffs.map((e) => e.defId)).toEqual(["defUp"]);
    expect(out.debuffs.map((e) => e.defId)).toEqual(["poison"]);
    expect(out.statuses.map((e) => e.defId)).toEqual(["madEnhancement"]);
  });

  it("surfaces an instance with no definition rather than dropping it", () => {
    // A silently dropped effect is the failure mode this project keeps
    // finding: it loads, it does nothing, and nothing reports it.
    const out = groupEffects([{ defId: "notInRegistry" }], lookup, { effects: [] });
    expect(out.unknown.map((e) => e.defId)).toEqual(["notInRegistry"]);
    expect(out.unknown[0].name).toBe("notInRegistry");
  });

  it("carries the computed periodic damage on the row", () => {
    const out = groupEffects([{ defId: "poison", stage: 3 }], lookup, { effects: ["poison"] });
    expect(out.debuffs[0]).toMatchObject({ stage: 3, periodic: 80 });
  });

  it("carries the amplified figure, not the table one", () => {
    const out = groupEffects([{ defId: "poison", stage: 3 }], lookup,
      { effects: ["poison", "deadlyPoison"] });
    expect(out.debuffs[0].periodic).toBe(160);
  });

  it("marks an unremovable effect so no [x] is offered for it", () => {
    const out = groupEffects([{ defId: "madEnhancement" }], lookup, { effects: [] });
    expect(out.statuses[0]).toMatchObject({ removable: false });
  });

  it("keeps a suppressed instance visible, and says it is suppressed", () => {
    const out = groupEffects([{ defId: "defUp", suppressed: true }], lookup, { effects: [] });
    expect(out.buffs[0]).toMatchObject({ suppressed: true });
  });

  it("returns four empty groups for a unit with nothing on it", () => {
    expect(groupEffects([], lookup, {})).toEqual({ buffs: [], debuffs: [], statuses: [], unknown: [] });
  });
});

describe("describeModifier", () => {
  it("renders a predicate as text rather than as [object Object]", () => {
    expect(describeModifier({ key: "atkUp", value: 50, source: "Mana Burst", predicate: ["attack:kind:np"] }))
      .toMatchObject({ key: "atkUp", value: 50, source: "Mana Burst", predicate: "attack:kind:np" });
  });

  it("has no predicate text when the modifier is unconditional", () => {
    expect(describeModifier({ key: "atkUp", value: 50 })).toMatchObject({ predicate: null });
  });

  it("flattens a nested predicate clause to something readable", () => {
    expect(describeModifier({ key: "x", value: 1, predicate: [{ not: "attack:component:str" }] }))
      .toMatchObject({ predicate: "not attack:component:str" });
  });

  it("joins several clauses", () => {
    expect(describeModifier({ key: "x", value: 1, predicate: ["a:b", { not: "c:d" }] }))
      .toMatchObject({ predicate: "a:b · not c:d" });
  });

  it("names an unattributed modifier rather than leaving it blank", () => {
    expect(describeModifier({ key: "x", value: 1 }).source).toBe("FGT.Sheet.UnknownSource");
  });
});

describe("a granted step is written in the game's own notation", () => {
  it("renders one step as a single +, not as +1", () => {
    // Ch. 04 §4.5 states the grant as "a free `+` to one of their Servant's
    // Parameters", and a Rank carries it that way: A becomes A+. "+1" is
    // arithmetic the rank ladder does not use anywhere else on the sheet.
    expect(parameterTiles({ str: "B" }, { str: 1 })[0].plus).toBe("+");
  });

  it("renders two steps as ++", () => {
    expect(parameterTiles({ str: "B" }, { str: 2 })[0].plus).toBe("++");
  });

  it("renders a negative step with the matching minus", () => {
    expect(parameterTiles({ str: "B" }, { str: -1 })[0].plus).toBe("-");
  });

  it("is empty when nothing was granted", () => {
    expect(parameterTiles({ str: "B" }, { str: 0 })[0].plus).toBe("");
  });
});

describe("the sheet shows the numbers the rules are using", () => {
  it("pairs the written Rank with the Rank in force", () => {
    const tiles = parameterTiles({ str: "B", end: "D" }, { str: 0 }, { str: "B+", end: "D" });
    expect(tiles.find((t) => t.key === "str")).toMatchObject({ rank: "B", effective: "B+", shifted: true });
    // Unshifted parameters say so, so the arrow appears only where it means something.
    expect(tiles.find((t) => t.key === "end")).toMatchObject({ rank: "D", shifted: false });
  });

  it("does not claim a shift when no projection was passed", () => {
    expect(parameterTiles({ str: "B" }, { str: 1 })[0].shifted).toBe(false);
  });

  it("pairs the written Base Attack with the one the damage pipeline uses", () => {
    // Medusa in a Greek war: STR B becomes B+, which is +10 Base Attack.
    const ba = baseAttackTiles({ str: 125, mag: 175 }, { str: 135, mag: 185 });
    expect(ba.str).toMatchObject({ value: 125, effective: 135, shifted: true });
    expect(ba.mag).toMatchObject({ value: 175, effective: 185, shifted: true });
  });

  it("marks Base Attack unshifted when the two agree", () => {
    expect(baseAttackTiles({ str: 125, mag: 0 }, { str: 125, mag: 0 }).str.shifted).toBe(false);
  });

  it("survives a unit with no Base Attack at all", () => {
    expect(baseAttackTiles(null, { str: 1, mag: 1 })).toBeNull();
  });
});
