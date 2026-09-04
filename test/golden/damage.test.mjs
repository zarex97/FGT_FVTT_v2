/**
 * Golden tests for the damage pipeline.
 *
 * The two worked examples in docs/13-damage-pipeline.md §13.5 and §13.6 are the
 * acceptance fixtures: if these two numbers change, either the documentation or
 * the implementation is wrong and the diff says which.
 */
import { describe, it, expect } from "vitest";
import { computeDamage, BLOCK_BASE_PERCENT } from "../../module/rules/damage/pipeline.mjs";
import { Rank } from "../../module/domain/rank.mjs";

/** Minimal snapshot factory — only the fields the pipeline reads. */
function unit(overrides = {}) {
  return {
    baseAttack: { str: 0, mag: 0 },
    parameters: {},
    effects: [],
    modifiers: [],
    health: 1000,
    shield: 0,
    magicResistance: null,
    outsideZon: false,
    ...overrides,
  };
}

function baseCtx(overrides = {}) {
  return {
    attacker: unit(),
    defender: unit(),
    board: {},
    attack: { kind: "normal", rank: null, categorizedAsNP: false, element: null },
    base: { sources: [] },
    multiplier: 1,
    flatBonus: 0,
    crit: { isCrit: false, chanceUsed: 0 },
    reaction: { kind: "none" },
    luckChecks: {},
    rolls: {},
    options: new Set(),
    ...overrides,
  };
}

/* ========================================================================== */

describe("worked example 1 — Penthesilea normal-attacks Heracles", () => {
  // docs/13-damage-pipeline.md §13.5. Expected: 409.
  const ctx = baseCtx({
    attacker: unit({
      baseAttack: { str: 160, mag: 0 },
      modifiers: [
        { key: "atkUp", value: 100, source: "Mad Enhancement EX", component: null },
        { key: "atkUp", value: 100, source: "Atk Up (GreekMale)" },
        { key: "atkUp", value: 30, source: "Atk Up (STR)" },
        { key: "divinity", value: 40, source: "Divinity B" },
      ],
    }),
    defender: unit({
      modifiers: [{ key: "defUp", value: 40, source: "Mad Enhancement B" }],
    }),
    base: { sources: [{ unit: "self", component: "str", factor: 1 }] },
    crit: { isCrit: false, chanceUsed: 0 },
    rolls: { attackMinus: 22, battleContinuation: 31 },
  });

  it("produces 409", () => {
    expect(computeDamage(ctx).total).toBe(409);
  });

  it("walks the documented stage trace", () => {
    const r = computeDamage(ctx);
    const at = (i) => r.breakdown.find((s) => s.index === i);
    expect(at(1).after.phys).toBe(160);
    expect(at(3).after.phys).toBe(138); // 160 - 22
    expect(at(4).after.phys).toBeCloseTo(400.2, 1); // ×2.90
    expect(at(7).after.phys).toBeCloseTo(440.2, 1); // + Divinity 40
    expect(at(12).after.phys).toBeCloseTo(409.2, 1); // − Battle Continuation 31
  });

  it("flags the Injury Roll, because 409 > 100", () => {
    expect(computeDamage(ctx).flags.exceededInjuryThreshold).toBe(true);
  });

  it("gives 536 on a crit with the same roll — the ±5d10 is amplified by the bucket", () => {
    const crit = { ...ctx, crit: { isCrit: true, chanceUsed: 0 }, rolls: { attackPlus: 22, battleContinuation: 31 } };
    expect(computeDamage(crit).total).toBe(536);
  });
});

describe("worked example 2 — Karna's Brahmastra Kundala into a home base", () => {
  // docs/13-damage-pipeline.md §13.6. Expected: 1076.
  const ctx = baseCtx({
    attacker: unit({
      baseAttack: { str: 125, mag: 175 },
      parameters: { mag: Rank.parse("B") },
      modifiers: [
        { key: "atkUp", value: 40, npValue: 30, source: "Flash of the Sun God" },
        { key: "npDmUp", value: 20, source: "NP DmUp" },
        { key: "divinity", value: 50, source: "Divinity A" },
      ],
    }),
    defender: unit({
      magicResistance: { rank: Rank.parse("B"), percent: 40, mode: "rank" },
      modifiers: [{ key: "defUp", value: 10, source: "Home Base" }],
    }),
    attack: { kind: "np", rank: Rank.parse("A+"), categorizedAsNP: false, element: null },
    base: {
      sources: [
        { unit: "self", component: "str", factor: 1 },
        { unit: "self", component: "mag", factor: 1 },
      ],
    },
    multiplier: 4,
    flatBonus: 100,
    crit: { isCrit: true, chanceUsed: 0 },
    reaction: { kind: "block" },
    rolls: { attackPlus: 31, territoryCreationDef: 32 },
  });

  it("produces 1151", () => {
    expect(computeDamage(ctx).total).toBe(1151);
  });

  it("puts the crit roll inside the bracket: (300 + 31) × 4 + 100 = 1424", () => {
    const r = computeDamage(ctx);
    expect(r.breakdown.find((s) => s.index === 2).after.mag
         + r.breakdown.find((s) => s.index === 2).after.phys).toBe(331);
    expect(r.breakdown.find((s) => s.index === 3).after.mag
         + r.breakdown.find((s) => s.index === 3).after.phys).toBe(1424);
  });

  it("splits into 525 magical and 626 physical", () => {
    const r = computeDamage(ctx);
    expect(r.magical).toBe(525);
    expect(r.physical).toBe(626);
    expect(r.magical + r.physical).toBe(r.total);
  });

  it("does not negate: Magic Resistance B is below the attack's A+", () => {
    const r = computeDamage(ctx);
    expect(r.flags.negatedBy).toBeNull();
    const s11 = r.breakdown.find((s) => s.index === 11);
    expect(s11.after.mag).toBeCloseTo(715.3, 0);
  });

  it("blocks the Luck Check: Increased Damage because the attack is an NP", () => {
    const withLuck = { ...ctx, luckChecks: { increasedDamage: 30 } };
    expect(computeDamage(withLuck).total).toBe(1151);
    const note = computeDamage(withLuck).breakdown
      .find((s) => s.index === 10).notes[0];
    expect(note.text).toMatch(/cannot increase NP damage/);
  });
});

/* ========================================================================== */

describe("stage 2 — the Q39 correction", () => {
  const karna = (critDmUp) =>
    baseCtx({
      attacker: unit({
        baseAttack: { str: 125, mag: 0 },
        modifiers: critDmUp ? [{ key: "critDmUp", value: critDmUp, source: "Uncrowned Arms Mastership" }] : [],
      }),
      base: { sources: [{ unit: "self", component: "str", factor: 1 }] },
      multiplier: 4,
      crit: { isCrit: true, chanceUsed: 0 },
      rolls: { attackPlus: 31 },
    });

  it("scales the 5d10 roll only, not the attack", () => {
    // docs/13-damage-pipeline.md §13.3 stage 2 micro-example.
    expect(computeDamage(karna(0)).total).toBe(624);  // (125 + 31) × 4
    expect(computeDamage(karna(40)).total).toBe(673); // (125 + 31×1.40) × 4
  });

  it("would have produced 743 under the superseded stage-4 reading", () => {
    // Recorded so the regression stays visible: under 0.2.0 the roll landed
    // after the multiplier and the crit percentage joined the bucket, giving
    // (125 × 4 + 31) × 1.40 = 743.4.
    expect(computeDamage(karna(40)).total).not.toBe(743);
  });

  it("never scales the Attack− branch, because a non-crit has no crit damage", () => {
    const nonCrit = {
      ...karna(100),
      crit: { isCrit: false, chanceUsed: 0 },
      rolls: { attackMinus: 31 },
    };
    expect(computeDamage(nonCrit).total).toBe(376); // (125 − 31) × 4, unscaled
  });

  it("clamps the crit factor at zero rather than turning a crit into a penalty", () => {
    const ctx = baseCtx({
      attacker: unit({ baseAttack: { str: 100, mag: 0 } }),
      defender: unit({ modifiers: [{ key: "critResUp", value: 200, source: "Crit ResUp" }] }),
      base: { sources: [{ unit: "self", component: "str", factor: 1 }] },
      crit: { isCrit: true, chanceUsed: 0 },
      rolls: { attackPlus: 40 },
    });
    expect(computeDamage(ctx).total).toBe(100); // the roll contributes 0, never negative
  });

  it("adds the Over Crit excess to the same stage-3 factor", () => {
    const ctx = baseCtx({
      attacker: unit({ baseAttack: { str: 100, mag: 0 }, effects: ["overCrit"] }),
      base: { sources: [{ unit: "self", component: "str", factor: 1 }] },
      crit: { isCrit: true, chanceUsed: 150 },
      rolls: { attackPlus: 40 },
    });
    expect(computeDamage(ctx).total).toBe(160); // 100 + 40 × 1.50
  });
});

describe("stage 3 — ability-stated conditional multipliers", () => {
  it("multiplies inside the bracket, before the flat bonus", () => {
    // The author's reference calculation: [(200+35) × 4 × 2 + 100] × …
    const ctx = baseCtx({
      attacker: unit({ baseAttack: { str: 0, mag: 200 } }),
      base: { sources: [{ unit: "self", component: "mag", factor: 1 }] },
      multiplier: 4,
      flatBonus: 100,
      conditionalMultipliers: [
        { factor: 2, predicate: ["target:attribute:sky"], source: "+100% vs [Sky]" },
      ],
      crit: { isCrit: true, chanceUsed: 0 },
      rolls: { attackPlus: 35 },
      options: new Set(["target:attribute:sky"]),
    });
    // (200 + 35) × 4 × 2 + 100 = 1980
    expect(computeDamage(ctx).total).toBe(1980);
  });

  it("does not apply when the predicate fails", () => {
    const ctx = baseCtx({
      attacker: unit({ baseAttack: { str: 0, mag: 200 } }),
      base: { sources: [{ unit: "self", component: "mag", factor: 1 }] },
      multiplier: 4,
      flatBonus: 100,
      conditionalMultipliers: [{ factor: 2, predicate: ["target:attribute:sky"], source: "+100% vs [Sky]" }],
      crit: { isCrit: true, chanceUsed: 0 },
      rolls: { attackPlus: 35 },
      options: new Set(),
    });
    expect(computeDamage(ctx).total).toBe(1040); // 235 × 4 + 100
  });
});

describe("stage 4 — the additive bucket", () => {
  it("reproduces the rulebook's own (100+30−100)% = 30% example", () => {
    const ctx = baseCtx({
      attacker: unit({
        baseAttack: { str: 100, mag: 0 },
        modifiers: [{ key: "atkUp", value: 30, source: "Atk Up" }],
      }),
      defender: unit({ modifiers: [{ key: "defUp", value: 100, source: "Def Up" }] }),
      base: { sources: [{ unit: "self", component: "str", factor: 1 }] },
    });
    expect(computeDamage(ctx).total).toBe(30);
  });

  it("floors at zero rather than producing healing", () => {
    const ctx = baseCtx({
      attacker: unit({ baseAttack: { str: 100, mag: 0 } }),
      defender: unit({ modifiers: [{ key: "defUp", value: 250, source: "Def Up" }] }),
      base: { sources: [{ unit: "self", component: "str", factor: 1 }] },
    });
    expect(computeDamage(ctx).total).toBe(0);
  });

  it("uses the NP magnitude when the attack is an NP", () => {
    const mk = (kind) =>
      baseCtx({
        attacker: unit({
          baseAttack: { str: 100, mag: 0 },
          modifiers: [{ key: "atkUp", value: 40, npValue: 20, source: "Atk Up" }],
        }),
        attack: { kind, rank: null, categorizedAsNP: false, element: null },
        base: { sources: [{ unit: "self", component: "str", factor: 1 }] },
      });
    expect(computeDamage(mk("normal")).total).toBe(140);
    expect(computeDamage(mk("np")).total).toBe(120);
  });

  it("treats abilities categorized as NP as NPs for magnitude purposes", () => {
    const ctx = baseCtx({
      attacker: unit({
        baseAttack: { str: 100, mag: 0 },
        modifiers: [{ key: "atkUp", value: 40, npValue: 20, source: "Atk Up" }],
      }),
      attack: { kind: "attackSkill", rank: null, categorizedAsNP: true, element: null },
      base: { sources: [{ unit: "self", component: "str", factor: 1 }] },
    });
    expect(computeDamage(ctx).total).toBe(120);
  });

  it("lets Ignore Def bypass Def Up but not Dmg Cut", () => {
    const mk = (ignore) =>
      baseCtx({
        attacker: unit({ baseAttack: { str: 200, mag: 0 } }),
        defender: unit({
          modifiers: [
            { key: "defUp", value: 50, source: "Def Up" },
            { key: "dmgCut", value: 30, source: "Dmg Cut" },
          ],
        }),
        attack: { kind: "normal", rank: null, categorizedAsNP: false, element: null, ignoresDefUp: ignore },
        base: { sources: [{ unit: "self", component: "str", factor: 1 }] },
      });
    expect(computeDamage(mk(false)).total).toBe(70);  // 200×0.5 − 30
    expect(computeDamage(mk(true)).total).toBe(170);  // 200 − 30
  });
});

describe("stage 14 — Block", () => {
  const mk = (extra = {}) =>
    baseCtx({
      attacker: unit({ baseAttack: { str: 0, mag: 2000 } }),
      base: { sources: [{ unit: "self", component: "mag", factor: 1 }] },
      reaction: { kind: "block" },
      ...extra,
    });

  it("is a flat 25% of the finished number", () => {
    expect(computeDamage(mk()).total).toBe(1500);
    expect(BLOCK_BASE_PERCENT).toBe(25);
  });

  it("is undiminished against Noble Phantasms", () => {
    const np = mk({ attack: { kind: "np", rank: null, categorizedAsNP: false, element: null } });
    expect(computeDamage(np).total).toBe(1500);
  });

  it("saves 500 on a 2000-damage NP, where the old dice-based rule saved ~55", () => {
    const np = mk({ attack: { kind: "np", rank: null, categorizedAsNP: false, element: null } });
    expect(2000 - computeDamage(np).total).toBe(500);
  });

  it("adds Block Up as percentage points", () => {
    const withUp = mk();
    withUp.defender.modifiers = [{ key: "blockUp", value: 15, source: "Block Up" }];
    expect(computeDamage(withUp).total).toBe(1200); // 40%
  });

  it("doubles to 50% on a successful Strengthen Block Luck Check", () => {
    expect(computeDamage(mk({ luckChecks: { strengthenBlock: true } })).total).toBe(1000);
  });

  it("is bypassed by Pierce and by a successful Break", () => {
    const pierce = mk({ attack: { kind: "normal", rank: null, categorizedAsNP: false, element: null, pierce: true } });
    expect(computeDamage(pierce).total).toBe(2000);
    const brk = mk({ attack: { kind: "normal", rank: null, categorizedAsNP: false, element: null, breakSucceeded: true } });
    expect(computeDamage(brk).total).toBe(2000);
  });

  it("does nothing when the defender did not Block", () => {
    expect(computeDamage(mk({ reaction: { kind: "none" } })).total).toBe(2000);
  });
});

describe("stage 11 — Magic Resistance", () => {
  const mk = (mr, attackRank) =>
    baseCtx({
      attacker: unit({ baseAttack: { str: 100, mag: 100 }, parameters: { mag: Rank.parse("C") } }),
      defender: unit({ magicResistance: mr }),
      attack: { kind: "np", rank: attackRank, categorizedAsNP: false, element: null },
      base: {
        sources: [
          { unit: "self", component: "str", factor: 1 },
          { unit: "self", component: "mag", factor: 1 },
        ],
      },
    });

  it("negates the MAG portion completely when the rank meets or exceeds the attack", () => {
    const r = computeDamage(mk({ rank: Rank.parse("A"), percent: 50, mode: "rank" }, Rank.parse("A")));
    expect(r.magical).toBe(0);
    expect(r.physical).toBe(100);
    expect(r.flags.negatedBy).toBe("Magic Resistance");
  });

  it("makes A+ negate up to A+, per the source's + clause", () => {
    expect(computeDamage(mk({ rank: Rank.parse("A+"), percent: 50, mode: "rank" }, Rank.parse("A+"))).magical).toBe(0);
    expect(computeDamage(mk({ rank: Rank.parse("A+"), percent: 50, mode: "rank" }, Rank.parse("A++"))).magical).toBe(50);
  });

  it("never touches the STR portion", () => {
    expect(computeDamage(mk({ rank: Rank.parse("EX"), percent: 100, mode: "rank" }, Rank.parse("A"))).physical).toBe(100);
  });

  it("falls back to the attacker's MAG parameter for an unranked attack", () => {
    // Attacker MAG is C; MR C negates.
    expect(computeDamage(mk({ rank: Rank.parse("C"), percent: 30, mode: "rank" }, null)).magical).toBe(0);
  });

  it("dice mode subtracts a roll and never negates", () => {
    const ctx = mk({ mode: "dice", formula: "3d20" }, Rank.parse("EX"));
    ctx.rolls = { magicResistanceDice: 30 };
    const r = computeDamage(ctx);
    expect(r.magical).toBe(70);
    expect(r.flags.negatedBy).toBeNull();
  });

  it("is skipped entirely for an attack flagged as unaffected by Magic Resistance", () => {
    const ctx = mk({ rank: Rank.parse("EX"), percent: 100, mode: "rank" }, Rank.parse("A"));
    ctx.attack.ignoresMagicResistance = true;
    expect(computeDamage(ctx).magical).toBe(100);
  });
});

describe("stage 0 — preconditions", () => {
  const attack = (over = {}) =>
    baseCtx({
      attacker: unit({ baseAttack: { str: 500, mag: 0 } }),
      base: { sources: [{ unit: "self", component: "str", factor: 1 }] },
      ...over,
    });

  it("Substitution beats Aim and zeroes the packet", () => {
    const ctx = attack({ defender: unit({ effects: ["substitution"] }) });
    ctx.attack.aim = true;
    const r = computeDamage(ctx);
    expect(r.total).toBe(0);
    expect(r.flags.negatedBy).toBe("Substitution");
  });

  it("Anti-Purge beats Pierce", () => {
    const ctx = attack({ defender: unit({ effects: ["antiPurge"] }) });
    ctx.attack.pierce = true;
    expect(computeDamage(ctx).flags.negatedBy).toBe("Anti-Purge");
  });

  it("health: null means intrinsically undamageable — distinct from Invuln", () => {
    const r = computeDamage(attack({ defender: unit({ health: null }) }));
    expect(r.total).toBe(0);
    expect(r.flags.negatedBy).toBe("invulnerable-by-nature");
  });

  it("Fire breaks Freeze with no damage or effects", () => {
    const ctx = attack({ defender: unit({ effects: ["freeze"] }) });
    ctx.attack.element = "fire";
    const r = computeDamage(ctx);
    expect(r.total).toBe(0);
    expect(r.flags.removeFreeze).toBe(true);
  });
});

describe("stage 16 — absorption and clamp", () => {
  const mk = (defender, total = 300) =>
    baseCtx({
      attacker: unit({ baseAttack: { str: total, mag: 0 } }),
      defender,
      base: { sources: [{ unit: "self", component: "str", factor: 1 }] },
    });

  it("takes the injury snapshot before Def Crk's addition", () => {
    const d = unit({ modifiers: [{ key: "defCrk", value: 50, source: "Def Crk" }] });
    const r = computeDamage(mk(d, 80));
    expect(r.total).toBe(130);
    expect(r.flags.exceededInjuryThreshold).toBe(false); // 80 <= 100, not 130
  });

  it("Freeze absorbs an attack under 150 entirely", () => {
    const r = computeDamage(mk(unit({ effects: ["freeze"] }), 100));
    expect(r.total).toBe(0);
    expect(r.flags.negatedBy).toBe("Freeze");
  });

  it("Freeze breaks and passes the excess at 150 or more", () => {
    const r = computeDamage(mk(unit({ effects: ["freeze"] }), 200));
    expect(r.total).toBe(200);
    expect(r.flags.removeFreeze).toBe(true);
  });

  it("Petrify flags an outright defeat above 200", () => {
    expect(computeDamage(mk(unit({ effects: ["petrify"] }), 250)).flags.defeatedOutright).toBe(true);
    expect(computeDamage(mk(unit({ effects: ["petrify"] }), 150)).flags.defeatedOutright).toBe(false);
  });

  it("Invuln zeroes a normal attack but not one with Pierce", () => {
    expect(computeDamage(mk(unit({ effects: ["invuln"] }))).total).toBe(0);
    const ctx = mk(unit({ effects: ["invuln"] }));
    ctx.attack.pierce = true;
    expect(computeDamage(ctx).total).toBe(300);
  });

  it("Shield absorbs up to its pool and passes the excess", () => {
    const r = computeDamage(mk(unit({ shield: 200 })));
    expect(r.total).toBe(100);
    expect(r.flags.shieldAbsorbed).toBe(200);
  });

  it("Endure leaves the unit at exactly 1 Health", () => {
    const r = computeDamage(mk(unit({ health: 120 }), 500));
    expect(r.total).toBe(500);
    const withEndure = computeDamage(mk(unit({ health: 120, effects: ["endure"] }), 500));
    expect(withEndure.total).toBe(119);
  });
});

describe("fixed damage", () => {
  it("skips every modifier stage including Block, but not Invuln", () => {
    const ctx = baseCtx({
      attacker: unit({ modifiers: [{ key: "atkUp", value: 100, source: "Atk Up" }] }),
      defender: unit({ modifiers: [{ key: "defUp", value: 50, source: "Def Up" }] }),
      attack: { kind: "normal", rank: null, categorizedAsNP: false, element: null, isFixedDamage: true },
      base: { sources: [], fixedValue: 50 },
      reaction: { kind: "block" },
    });
    expect(computeDamage(ctx).total).toBe(50);

    ctx.defender.effects = ["invuln"];
    expect(computeDamage(ctx).total).toBe(0);
  });
});

describe("the breakdown", () => {
  it("records every stage, including the ones that did nothing", () => {
    const ctx = baseCtx({
      attacker: unit({ baseAttack: { str: 100, mag: 0 } }),
      base: { sources: [{ unit: "self", component: "str", factor: 1 }] },
    });
    const r = computeDamage(ctx);
    // A reader asking "why didn't Magic Resistance apply?" needs to see the
    // stage ran and did nothing, not to find it missing.
    expect(r.breakdown.map((s) => s.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    for (const s of r.breakdown) {
      expect(s.name).toBeTypeOf("string");
      expect(s.before).toBeDefined();
      expect(s.after).toBeDefined();
    }
  });

  it("names each contributor so the explainer can render it", () => {
    const ctx = baseCtx({
      attacker: unit({
        baseAttack: { str: 100, mag: 0 },
        modifiers: [{ key: "atkUp", value: 30, source: "Howl of the War God" }],
      }),
      base: { sources: [{ unit: "self", component: "str", factor: 1 }] },
    });
    const s4 = computeDamage(ctx).breakdown.find((s) => s.index === 4);
    // The side travels with the contributor: it is what lets a card show a
    // viewer their own modifiers and withhold the opponent's (Ch. 26 26.7).
    expect(s4.contributors).toContainEqual({
      source: "atkUp", value: 30, note: "Howl of the War God", side: "attacker",
    });
  });
});

describe("stage 12 consumes the defender's rolled DamageNegation", () => {
  const ctx = baseCtx({
    attacker: unit({ baseAttack: { str: 200, mag: 0 } }),
    base: { sources: [{ unit: "self", component: "str", factor: 1 }] },
    rolls: { attackMinus: 0 },
  });

  it("subtracts one rolled negation", () => {
    const r = computeDamage({ ...ctx, rolls: { attackMinus: 0, negation: [{ source: "Battle Continuation", value: 35 }] } });
    expect(r.total).toBe(165);
  });

  it("subtracts every entry, so two skills both count", () => {
    const r = computeDamage({
      ...ctx,
      rolls: { attackMinus: 0, negation: [{ source: "Battle Continuation", value: 35 }, { source: "Guardian Knight", value: 15 }] },
    });
    expect(r.total).toBe(150);
  });

  it("names the source in the breakdown, so the card can explain it", () => {
    const r = computeDamage({ ...ctx, rolls: { attackMinus: 0, negation: [{ source: "Battle Continuation", value: 35 }] } });
    const stage = r.breakdown.find((s) => s.index === 12);
    expect(JSON.stringify(stage)).toContain("Battle Continuation");
  });

  it("stacks with the legacy battleContinuation key rather than replacing it", () => {
    const r = computeDamage({
      ...ctx,
      rolls: { attackMinus: 0, battleContinuation: 20, negation: [{ source: "Guardian Knight", value: 15 }] },
    });
    expect(r.total).toBe(165);
  });

  it("accepts a bare number", () => {
    const r = computeDamage({ ...ctx, rolls: { attackMinus: 0, negation: [35] } });
    expect(r.total).toBe(165);
  });

  it("does nothing when the defender has none", () => {
    expect(computeDamage(ctx).total).toBe(200);
  });
});
