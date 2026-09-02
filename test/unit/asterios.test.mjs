/**
 * @file Asterios — Mad Enhancement's three arithmetic clauses, the attacker's
 *       own timing window, and the Labyrinth's Region clause.
 * @see char_orig_sheets/Copia de Asterios.md, docs/31-case-heracles.md
 *
 * Every case here is a clause that was **authored and inert**, which is this
 * project's dominant defect and the reason each gets its own test rather than
 * being covered by "Mad Enhancement works". A clause that contributes the wrong
 * number is visible at the table; a clause that contributes nothing is not.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { collectContributions } from "../../module/rules/elements.mjs";
import { computeDamage } from "../../module/rules/damage/pipeline.mjs";
import { rollOptionsFor } from "../../module/rules/options.mjs";
import { classifyAbility } from "../../module/rules/ability-use.mjs";
import { abilitiesAtWindow } from "../../module/rules/reactions.mjs";
import { regionSizedShape } from "../../module/engine/fields.mjs";
import { Rank } from "../../module/domain/rank.mjs";

/** @param {string} dir @returns {string[]} */
function ymlUnder(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return ymlUnder(path);
    return e.name.endsWith(".yml") ? [path] : [];
  });
}

/** Mad Enhancement at Rank B, exactly as `class-skills/mad-enhancement.yml` authors it. */
function madEnhancement(rank = "B") {
  return [{
    id: "me",
    name: "Mad Enhancement",
    slug: "madEnhancement",
    rank,
    active: true,
    rules: [],
    passiveRules: [],
    activeRules: [
      {
        key: "DamageModifier", modifierKey: "atkUp", direction: "dealt",
        table: "madEnhancementOffence", predicate: ["not:attack:component:mag"],
      },
      {
        key: "DamageModifier", modifierKey: "atkUp", direction: "dealt",
        table: "madEnhancementOffence", magnitudeFactor: 0.5,
        predicate: ["attack:component:mag"],
      },
      {
        key: "DamageModifier", modifierKey: "defUp", direction: "taken",
        table: "madEnhancementDefence",
      },
    ],
  }];
}

/**
 * One attack's damage, with the attacker carrying `modifiers`.
 * @param {object} args
 * @returns {number}
 */
function damage({ modifiers = [], defenderModifiers = [], component = "str", kind = "normal", base = 100 }) {
  return computeDamage({
    attacker: { baseAttack: { str: base, mag: base }, modifiers },
    defender: { health: 9999, modifiers: defenderModifiers },
    attack: { kind, component },
    base: { sources: [{ unit: "self", component, factor: 1 }] },
    rolls: { attackMinus: 0 },
    crit: { isCrit: false },
    options: new Set([`attack:kind:${kind}`, `attack:component:${component}`]),
  }).total;
}

describe("Mad Enhancement — clause 2, the [normal, vsNP] pair", () => {
  // `madEnhancementDefence` at B is `[40, 20]` and has been since the tables
  // were transcribed. `scalar()` took index 0 and nothing else, so the second
  // half never left the table: every Mad Enhancement in the game reduced Noble
  // Phantasm damage by its full NORMAL figure.
  it("takes 40% off a Normal Attack and 20% off a Noble Phantasm at Rank B", () => {
    const mods = collectContributions(madEnhancement("B")).modifiers;
    const defUp = mods.find((m) => m.key === "defUp");

    expect(defUp.value).toBe(40);
    expect(defUp.npValue).toBe(20);
  });

  it("scales the pair with the rank", () => {
    const ex = collectContributions(madEnhancement("EX")).modifiers.find((m) => m.key === "defUp");
    expect([ex.value, ex.npValue]).toEqual([75, 30]);
  });
});

describe("Mad Enhancement — clause 3, halved for Base Attack (MAG)", () => {
  it("contributes 60% to a STR attack and 30% to a MAG one at Rank B", () => {
    const mods = collectContributions(madEnhancement("B")).modifiers
      .filter((m) => m.key === "atkUp");

    // Both survive collection, each carrying the predicate that selects it.
    expect(mods.map((m) => m.value).sort((a, b) => a - b)).toEqual([30, 60]);
  });

  it("applies exactly one of the two to any given attack", () => {
    const mods = collectContributions(madEnhancement("B")).modifiers;

    // 100 base, no crit roll: the bucket is the whole story.
    expect(damage({ modifiers: mods, component: "str" })).toBe(160);
    expect(damage({ modifiers: mods, component: "mag" })).toBe(130);
  });

  it("stays ADDITIVE against Def Up, which the stage-4/5 split did not", () => {
    // §13.4's own worked form: "(100 + 60 - 100)% ... so it would deal 30%
    // damage only, not 0". With Rank B against 100% Def Up that is x0.60 for a
    // STR attack. Ch. 13's original stage-5 proposal -- min() to the bucket and
    // the difference to stage 5 -- gives x0.30 then x1.3 = x0.39, because the
    // two stages compose multiplicatively and the rule is additive.
    const mods = collectContributions(madEnhancement("B")).modifiers;
    const defUp = [{ key: "defUp", value: 100, source: "test" }];

    expect(damage({ modifiers: mods, defenderModifiers: defUp, component: "str" })).toBe(60);
    expect(damage({ modifiers: mods, defenderModifiers: defUp, component: "mag" })).toBe(30);
  });
});

describe("Mad Enhancement — clause 1, one number said three times", () => {
  // "Its Master loses 20 Health ... when its Master's Health is 20 or less, ME
  // is forcibly deactivated." The 20 is `madEnhancementDrain` at B, and both the
  // floor and the threshold were authored as the literal 30 -- the table's EX
  // value. Every rank below EX clamped and deactivated against a number the
  // Servant's own sheet never mentions.
  const drain = [{
    id: "me",
    slug: "madEnhancement",
    rank: "B",
    active: true,
    rules: [],
    passiveRules: [],
    activeRules: [{
      key: "OnEvent",
      event: "actedTurnEnd",
      automatic: true,
      then: [
        {
          key: "StatDelta", subject: "master", stat: "health.value",
          table: "madEnhancementDrain", direction: "down", floorTable: "madEnhancementDrain",
        },
        {
          key: "SetMode", ability: "madEnhancement", active: false,
          whenValue: { subject: "master", stat: "health.value", lteTable: "madEnhancementDrain" },
        },
      ],
    }],
  }];

  it("resolves the drain, the floor and the threshold to the same rank value", () => {
    const [handler] = collectContributions(drain).eventHandlers;
    const [statDelta, setMode] = handler.actions;

    expect(statDelta.amount).toBe(20);
    expect(statDelta.floor).toBe(20);
    expect(setMode.whenValue.lte).toBe(20);
  });

  it("moves all three together when the rank does", () => {
    const ex = collectContributions(drain.map((a) => ({ ...a, rank: "EX" })));
    const [statDelta, setMode] = ex.eventHandlers[0].actions;

    expect([statDelta.amount, statDelta.floor, setMode.whenValue.lte]).toEqual([30, 30, 30]);
  });
});

describe("Monstrous Strength — the attacker's own timing window", () => {
  const monstrousStrength = {
    id: "ms",
    name: "Monstrous Strength",
    system: {
      slug: "monstrousStrength",
      rank: "A",
      timing: { window: ["damageStep"] },
      cooldown: { remaining: 0 },
      activeRules: [{
        key: "DamageModifier", modifierKey: "atkUp", component: "str", value: 100, npValue: 50,
      }],
    },
  };

  it("is not a sheet button", () => {
    // It used to classify as a mode -- the `activeRules` fallback -- which put a
    // toggle on the sheet that switches a permanent +100% STR damage on. There
    // is no moment during Asterios's Turn at which pressing it means anything.
    const use = classifyAbility(monstrousStrength);

    expect(use.kind).toBe("windowed");
    expect(use.clickable).toBe(false);
    expect(use.toggles).toBe(false);
  });

  it("is offered at the Damage Step", () => {
    const offered = abilitiesAtWindow({ items: [monstrousStrength] }, "damageStep");
    expect(offered).toHaveLength(1);
  });

  it("is not offered while it is on cooldown", () => {
    const cooling = {
      ...monstrousStrength,
      system: { ...monstrousStrength.system, cooldown: { remaining: 2 } },
    };
    expect(abilitiesAtWindow({ items: [cooling] }, "damageStep")).toHaveLength(0);
  });

  it("lifts the STR share only, which is what stage 5 is for", () => {
    const mods = collectContributions([{
      id: "ms", slug: "monstrousStrength", rank: "A", active: true,
      rules: [], passiveRules: [], activeRules: monstrousStrength.system.activeRules,
    }]).modifiers;

    // A combined attack -- Karna's Mana Burst shape -- with 100 of each.
    const result = computeDamage({
      attacker: { baseAttack: { str: 100, mag: 100 }, modifiers: mods },
      defender: { health: 9999, modifiers: [] },
      attack: { kind: "normal", component: "str" },
      base: {
        sources: [
          { unit: "self", component: "str", factor: 1 },
          { unit: "self", component: "mag", factor: 1 },
        ],
      },
      rolls: { attackMinus: 0 },
      crit: { isCrit: false },
      options: new Set(["attack:kind:normal"]),
    });

    // 100 STR doubled, 100 MAG untouched.
    expect(result.total).toBe(300);
  });
});

describe("Chaos Labyrinthos — the Region clause", () => {
  const geometry = {
    kind: "fixedArea",
    shape: { kind: "square", size: 9 },
    regionSizeOverride: { greece: 11 },
  };

  it("is 9x9 by default", () => {
    expect(regionSizedShape(geometry, "japan")).toMatchObject({ size: 9 });
    expect(regionSizedShape(geometry, null)).toMatchObject({ size: 9 });
  });

  it("is 11x11 when the war Region is Greece", () => {
    // `regionSizeOverride` was authored on this Noble Phantasm since Asterios
    // was written and had no reader at all.
    expect(regionSizedShape(geometry, "greece")).toMatchObject({ size: 11 });
  });

  it("leaves a shape it cannot size alone rather than guessing", () => {
    const line = { shape: { kind: "line", length: 5 }, regionSizeOverride: { greece: 11 } };
    expect(regionSizedShape(line, "greece")).toMatchObject({ kind: "line", length: 5 });
  });
});

describe("a non-damaging Noble Phantasm", () => {
  // Every NP goes through `resolveAttack` -- a non-damaging one still costs the
  // Servant its Attack -- and the Combat Process always runs its damage stage,
  // where `baseSpecFor` falls back to the caster's NORMAL ATTACK when there is
  // no `damage:` block. So five authored Noble Phantasms that hit nobody dealt
  // their caster's full Base Attack: Chaos Labyrinthos (measured live at 203),
  // Unlimited Blade Works, Rho Aias, the Hanging Gardens and Sikera Ušum.
  //
  // A static guard, because the fix is in `engine/attack.mjs` and that needs a
  // world. What can be held here is the CONTENT invariant the fix relies on:
  // an ability that means "no damage" says so by declaring phases and not
  // declaring a damage one.
  const docs = ymlUnder("packs/_source/abilities")
    .map((path) => ({ path, doc: parse(readFileSync(path, "utf8")) }));

  it("is recognisable from its phases alone", () => {
    const nonDamaging = docs.filter(({ doc }) =>
      doc?.isNP && !doc.isPassive && !doc.damage
      && (doc.phases ?? []).length > 0
      && !(doc.phases ?? []).some((p) => p.kind === "damage"));

    // If an eighth is authored it lands here, which is the point: the
    // engine rule keys on exactly this shape.
    expect(nonDamaging.map(({ doc }) => doc.id).sort()).toEqual([
      "asterios-chaos-labyrinthos",
      "emiya-rho-aias",
      "emiya-unlimited-blade-works",
      // Jack's Mist: "(Non-damaging)" is the first word of its description,
      // and it needs no `damage:` block to say so.
      "jack-the-mist",
      // Doomsday Come, the seventh: "(Non-damaging)" and its only phase opens
      // a field. Everything it does to a Unit is the AREA's doing.
      "pale-rider-doomsday-come",
      "semiramis-hanging-gardens-of-babylon",
      "semiramis-sikera-usum",
    ]);
  });

  it("never leaves a damaging NP without a way to compute its base", () => {
    // The mirror. An NP with a `damage` phase must either declare a `damage:`
    // block or be content to use its caster's Normal Attack -- both legitimate,
    // but a `damage` phase AND a `fixed: true` block with no value would be a
    // Noble Phantasm that silently deals nothing.
    const broken = docs.filter(({ doc }) =>
      (doc?.phases ?? []).some((p) => p.kind === "damage")
      && doc.damage?.fixed === true
      && doc.damage?.base?.fixedValue === undefined
      && !doc.damage?.branches);

    expect(broken.map(({ path }) => path)).toEqual([]);
  });
});

describe("Brahmastra's parameter comparison", () => {
  // Karna's, but it lives with the options tests it exercises. `B/C/A/B/D`.
  const karna = { parameters: { str: Rank.of("B"), end: Rank.of("C"), agi: Rank.of("A"), mag: Rank.of("B"), luc: Rank.of("D") } };

  it("marks every Parameter a defender beats Karna in", () => {
    // Heracles: LUC A against Karna's D.
    const heracles = { parameters: { str: Rank.of("A"), end: Rank.of("A"), agi: Rank.of("A"), mag: Rank.of("C"), luc: Rank.of("A") } };
    const options = rollOptionsFor({ attacker: karna, defender: heracles });

    expect(options.has("target:paramVsSelf:luc:gt")).toBe(true);
    expect(options.has("target:paramVsSelf:agi:eq")).toBe(true);
    expect(options.has("target:paramVsSelf:mag:lt")).toBe(true);
  });

  it("separates a + step from its grade, which the gte ladder cannot", () => {
    // The whole reason this comparison exists. `gradesClearedBy` gives a B+ unit
    // the grades E..B and NOT A, so `not:target:rank:str:gte:A` reads as "STR is
    // not above B" for a unit whose STR is above B -- and Brahmastra would hand
    // it the 4x branch.
    const stronger = { parameters: { str: Rank.of("B", 1) } };
    const options = rollOptionsFor({ attacker: karna, defender: stronger });

    expect(options.has("target:rank:str:gte:A")).toBe(false);
    expect(options.has("target:paramVsSelf:str:gt")).toBe(true);
  });

  it("emits nothing for a Parameter either side lacks", () => {
    const options = rollOptionsFor({ attacker: karna, defender: { parameters: { str: null } } });
    expect([...options].some((o) => o.startsWith("target:paramVsSelf:str"))).toBe(false);
  });
});

describe("attack:element", () => {
  it("names the damage type, so a resistance can be written against it", () => {
    // The pipeline has read `ctx.attack.element` at stage 0 since it was written
    // and no predicate could ask about it, so Karna's "All Total Fire Damage
    // taken is reduced by 50%" had no way to be authored.
    const options = rollOptionsFor({
      attacker: {}, defender: {}, attack: { kind: "np", element: "fire" },
    });
    expect(options.has("attack:element:fire")).toBe(true);
  });
});
