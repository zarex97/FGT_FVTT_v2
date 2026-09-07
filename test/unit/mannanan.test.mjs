/**
 * @file Mannanán mac Lir — the pure halves of her kit.
 * @see docs/33-case-mannanan.md, char_orig_sheets/Copia de Mannanán mac Lir.md
 *
 * Everything here is layer 1 or 2, so it runs without a world. The three
 * document-touching halves — the automatic counter's declaration, the Noble
 * Phantasm cancellation and Holder Mode's entry — are live-tested in `fgt2026`
 * and recorded in Ch. 45.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

import { closeAttributes, isMagus, IMPLICATIONS } from "../../module/domain/attributes.mjs";
import { evade } from "../../module/rules/checks.mjs";
import { collectContributions, resolveValue } from "../../module/rules/elements.mjs";
import { annotateCompulsions, compelledTargetsOf } from "../../module/rules/compulsion.mjs";
import { decoyVerdict } from "../../module/rules/movement.mjs";
import { rankNoblePhantasms, isStrongestNP, expectedDamage } from "../../module/rules/np-strength.mjs";
import { availableRevivals } from "../../module/rules/revival.mjs";

/** @param {string} id @returns {object} */
function ability(id) {
  return parse(readFileSync(join("packs/_source/abilities", `${id}.yml`), "utf8"));
}

/** @param {string} id @returns {object} */
function effect(id) {
  return parse(readFileSync(join("packs/_source/effects", `${id}.yml`), "utf8"));
}

const SHEET = parse(readFileSync("packs/_source/servants/mannanan.yml", "utf8"));

/* ========================================================================== */
/*  §33.1 — the statline and the attribute closure                            */
/* ========================================================================== */

describe("Pseudo Servant (Ch. 02 §2.10)", () => {
  it("gives every ordinary Servant Spirit and Hominidae", () => {
    const closed = closeAttributes(["male", "servant", "humanoid"]);
    expect(closed).toContain("spirit");
    expect(closed).toContain("hominidae");
  });

  it("withholds Spirit from a Pseudo-Servant, and only Spirit", () => {
    const closed = closeAttributes(SHEET.attributes);
    // "Effects keying on Spirit miss her, and effects keying on Living Human
    // hit her" -- Ch. 33's opening claim, which was previously unenforceable.
    expect(closed).not.toContain("spirit");
    expect(closed).toContain("livingHuman");
    expect(closed).toContain("hominidae");
  });

  it("closes transitively — Demi-Servant reaches Living Human in three steps", () => {
    const closed = closeAttributes(["servant", "demiServant"]);
    expect(closed).toEqual(expect.arrayContaining(["human", "humanoid", "livingHuman"]));
    expect(closed).not.toContain("spirit");
  });

  it("is idempotent, so a sheet that authored its own closure is unchanged", () => {
    const once = closeAttributes(["human"]);
    expect(closeAttributes(once)).toEqual(once);
  });

  it("derives Magus from what the Sealing Designation Enforcer's Note says", () => {
    expect(isMagus({ kind: "master" })).toBe(true);
    expect(isMagus({ kind: "servant", servantClasses: ["caster"] })).toBe(true);
    expect(isMagus({ kind: "servant", normalAttack: { component: "mag" } })).toBe(true);
    // Mannanán herself is not one: she is an Alter Ego who swings with STR.
    expect(isMagus({ kind: "servant", servantClasses: SHEET.servantClasses, normalAttack: SHEET.normalAttack }))
      .toBe(false);
  });

  it("has a rule for every implication the glossary prints", () => {
    expect(IMPLICATIONS.map((r) => r.from)).toEqual(
      expect.arrayContaining(["human", "demiServant", "giant", "demonicBeast", "demon", "servant"]),
    );
  });

  it("derives both Base Attacks from the tables, so the sheet needs no exception", () => {
    // STR A => 150, MAG EX => 250 (docs/B-rank-tables.md).
    expect(SHEET.baseAttack).toEqual({ str: 150, mag: 250 });
  });
});

/* ========================================================================== */
/*  §33.2 — the token economy                                                 */
/* ========================================================================== */

describe("Fragarach Tokens", () => {
  const carrier = ability("mannanan-tradition-carrier");

  /** A Mannanán holding `n` tokens, in the shape `contributionsOf` builds. */
  const refs = (n) => ({ self: { resources: { fragarachTokens: { value: n, max: 5 } } } });

  it("scales Crit Damage by 5% per token held", () => {
    const el = carrier.passiveRules.find((r) => r.key === "CritModifier");
    expect(resolveValue(el, null, { refs: refs(5) })).toBe(25);
    expect(resolveValue(el, null, { refs: refs(2) })).toBe(10);
    expect(resolveValue(el, null, { refs: refs(0) })).toBe(0);
  });

  it("feeds that magnitude through to a CritModifier contribution", () => {
    const out = collectContributions(
      [{ id: "tc", name: "Tradition Carrier", rank: "EX", passiveRules: carrier.passiveRules }],
      { refs: refs(4) },
    );
    const crit = out.modifiers.find((m) => m.key === "critDmUp");
    expect(crit?.value).toBe(20);
  });

  it("declares one producer, one optional spend and one duration extension", () => {
    const keys = carrier.passiveRules.map((r) => r.key);
    expect(keys).toEqual(["OnEvent", "OptionalCost", "CritModifier", "DurationExtension"]);

    const spend = carrier.passiveRules.find((r) => r.key === "OptionalCost");
    expect(spend.cost).toEqual({ resource: "fragarachTokens", amount: 1 });
    expect(spend.timing).toBe("combatPhaseStart");
  });

  it("projects the duration extension so the applier can read it", () => {
    const out = collectContributions(
      [{ id: "tc", name: "Tradition Carrier", rank: "EX", passiveRules: carrier.passiveRules }],
      { refs: refs(0) },
    );
    expect(out.durationExtensions).toEqual([
      { amount: "⅓◈", appliesTo: "buffs", direction: "incoming", value: null, source: "Tradition Carrier" },
    ]);
  });

  it("caps the pool at five, which is what makes Holder Mode's seven a change", () => {
    expect(SHEET.resources.fragarachTokens).toEqual({ value: 5, max: 5 });
  });
});

/* ========================================================================== */
/*  §33.3 — the Fragarach status and its counter                              */
/* ========================================================================== */

describe("the Fragarach status", () => {
  const def = effect("fragarach");

  it("is neither a buff nor a debuff, and is Unremovable", () => {
    expect(def.polarity).toBe("status");
    expect(def.unremovable).toBe(true);
  });

  it("forbids the normal Counter and subscribes to BOTH provocations", () => {
    const forbid = def.rules.find((r) => r.key === "ForbidReaction");
    expect(forbid.reactions).toEqual(["counter"]);

    const auto = def.rules.find((r) => r.key === "AutoCounter");
    expect(auto.on).toEqual(["attacked", "debuffed"]);
    expect(auto.ability).toBe("mannanan-fragarach-counter");
  });

  it("projects both into the snapshot's own buckets", () => {
    const out = collectContributions([{ id: "fragarach", name: "Fragarach", rules: def.rules }]);
    expect(out.forbiddenReactions).toEqual(["counter"]);
    expect(out.autoCounters).toEqual([
      { on: ["attacked", "debuffed"], ability: "mannanan-fragarach-counter", source: "Fragarach" },
    ]);
  });
});

describe("the Fragarach Counter", () => {
  const counter = ability("mannanan-fragarach-counter");

  it("deals 2.5x BA(STR) as NP damage without being an NP", () => {
    expect(counter.damage.multiplier).toBe(2.5);
    expect(counter.damage.base.sources).toEqual([{ unit: "self", component: "str", factor: 1 }]);
    // "Fragarach Counters deal NP Damage; however they are not affected by NP
    // Seal" -- the two scoping flags pulled apart.
    expect(counter.categorizedAsNP).toBe(true);
    expect(counter.isNP).toBeUndefined();
  });

  it("cannot be Blocked and cannot be Evaded except with Dodge", () => {
    expect(counter.damage.unblockable).toBe(true);
    expect(counter.damage.evadableOnlyBy).toEqual(["dodge"]);
  });

  it("pays out four riders", () => {
    const kinds = counter.phases.map((p) => p.kind);
    expect(kinds).toEqual(["damage", "applyEffects", "applyEffects", "cooldown", "resource"]);
  });
});

describe("evadableOnlyBy", () => {
  const base = { roll: 1, agility: 15, evadableOnlyBy: ["dodge"] };

  it("fails without rolling for a defender holding nothing named", () => {
    const out = evade({ ...base, held: [] });
    expect(out.success).toBe(false);
    expect(out.automatic).toBe(true);
  });

  it("still fails for the Evade buff, which is the point of the two effects", () => {
    // Successor of the Red Branch applies `evade`; a Fragarach Counter says
    // "except with Dodge" and means it.
    expect(evade({ ...base, held: ["evade"] }).success).toBe(false);
  });

  it("lets Dodge through", () => {
    const out = evade({ ...base, held: ["dodge"], hasDodge: true });
    expect(out.success).toBe(true);
  });

  it("is inert when the attack does not narrow the ladder", () => {
    // A very low roll against a high Agility succeeds normally.
    expect(evade({ roll: 1, agility: 15, held: [] }).success).toBe(true);
  });

  it("with an EMPTY permit refuses everybody — the multi-hit lock", () => {
    // "If any Evade fails, the remaining hits cannot be Evaded." A permit that
    // exists and admits nobody, which is what `evadePermit` returns once a
    // sibling hit of the same declaration has failed. Even Dodge is refused.
    const out = evade({ roll: 1, agility: 15, evadableOnlyBy: [], held: ["dodge"], hasDodge: true });
    expect(out.success).toBe(false);
    expect(out.modifiers[0].source).toBe("this hit cannot be Evaded");
  });
});

/* ========================================================================== */
/*  §33.6 — Decoy                                                             */
/* ========================================================================== */

describe("Decoy", () => {
  const def = effect("decoy");

  it("bypasses resistance when self- or ally-applied", () => {
    expect(def.allySelfBypassesResistance).toBe(true);
  });

  /** Mannanán at (0,0) with Decoy up, an enemy at (0,2), an ally at (0,1). */
  function board() {
    const decoy = {
      id: "mannanan", factionId: "a", panel: { i: 0, j: 0 }, range: 1,
      suppressions: [{ scope: "targeting", decoy: true, radius: 3, source: "Decoy" }],
    };
    const enemy = { id: "enemy", factionId: "b", panel: { i: 0, j: 2 }, range: 1, suppressions: [] };
    const ally = { id: "ally", factionId: "a", panel: { i: 0, j: 1 }, range: 1, suppressions: [] };
    return { units: [decoy, enemy, ally] };
  }

  it("compels an enemy inside the radius and leaves allies alone", () => {
    const b = board();
    annotateCompulsions(b.units, b);

    const enemy = b.units.find((u) => u.id === "enemy");
    expect(enemy.decoy?.sourceUnitId).toBe("mannanan");
    expect(compelledTargetsOf(enemy)).toEqual(["mannanan"]);

    expect(b.units.find((u) => u.id === "ally").decoy).toBe(null);
    // A decoy never pulls itself.
    expect(b.units.find((u) => u.id === "mannanan").decoy).toBe(null);
  });

  it("is inert while the decoy is concealed", () => {
    const b = board();
    b.units[0].concealed = true;
    annotateCompulsions(b.units, b);
    expect(b.units.find((u) => u.id === "enemy").decoy).toBe(null);
  });

  it("does not reach past max(radius, the enemy's own Range)", () => {
    const b = board();
    b.units[1].panel = { i: 0, j: 9 };
    annotateCompulsions(b.units, b);
    expect(b.units.find((u) => u.id === "enemy").decoy).toBe(null);
  });

  it("refuses a step that increases the distance, and allows one that does not", () => {
    const b = board();
    annotateCompulsions(b.units, b);
    const enemy = b.units.find((u) => u.id === "enemy");

    const away = decoyVerdict(enemy, [{ i: 0, j: 2 }, { i: 0, j: 3 }], b);
    expect(away.ok).toBe(false);

    const closer = decoyVerdict(enemy, [{ i: 0, j: 2 }, { i: 0, j: 1 }], b);
    expect(closer.ok).toBe(true);
  });
});

/* ========================================================================== */
/*  §33.4 — "strongest NP"                                                    */
/* ========================================================================== */

describe("ranking Noble Phantasms", () => {
  const attacker = { id: "x", baseAttack: { str: 100, mag: 100 }, modifiers: [], effects: [], attributes: [] };

  const np = (id, damage) => ({
    id, name: id, type: "noblePhantasm",
    system: { isNP: true, damage, phases: [{ kind: "damage" }] },
  });

  it("ranks by expected damage against a neutral defender", () => {
    const weak = np("weak", { base: { sources: [{ unit: "self", component: "str", factor: 1 }] }, multiplier: 1 });
    const strong = np("strong", { base: { sources: [{ unit: "self", component: "str", factor: 1 }] }, multiplier: 4 });

    const ranked = rankNoblePhantasms([weak, strong], attacker);
    expect(ranked.map((r) => r.id)).toEqual(["strong", "weak"]);
    expect(isStrongestNP([weak, strong], attacker, "strong").strongest).toBe(true);
    expect(isStrongestNP([weak, strong], attacker, "weak").strongest).toBe(false);
  });

  it("treats a Unit's only damaging Noble Phantasm as its strongest", () => {
    const only = np("only", { base: { sources: [{ unit: "self", component: "str", factor: 1 }] } });
    expect(isStrongestNP([only], attacker, "only").strongest).toBe(true);
  });

  it("takes the BEST branch of a conditional, so the ranking is about the weapon", () => {
    const branched = np("branched", {
      base: { sources: [{ unit: "self", component: "str", factor: 1 }] },
      multiplier: 2,
      branches: [
        { predicate: ["target:attribute:divine"], multiplier: 4 },
      ],
    });
    const flat = np("flat", {
      base: { sources: [{ unit: "self", component: "str", factor: 1 }] }, multiplier: 3,
    });
    // 4x beats 3x, even though the 4x branch would not fire against the neutral
    // defender: "strongest" is a property of the Noble Phantasm, not of the
    // matchup (§33.4's DECISION).
    expect(rankNoblePhantasms([branched, flat], attacker)[0].id).toBe("branched");
  });

  it("ignores passive and non-damaging Noble Phantasms", () => {
    const passive = { id: "p", name: "p", type: "noblePhantasm", system: { isNP: true, isPassive: true, damage: {} } };
    const nonDamaging = { id: "n", name: "n", type: "noblePhantasm", system: { isNP: true, phases: [{ kind: "applyEffects" }] } };
    expect(rankNoblePhantasms([passive, nonDamaging], attacker)).toEqual([]);
  });

  it("is deterministic: the same inputs give the same number twice", () => {
    const one = np("one", { base: { sources: [{ unit: "self", component: "mag", factor: 1 }] }, multiplier: 3 });
    expect(expectedDamage(one, attacker)).toBe(expectedDamage(one, attacker));
  });
});

/* ========================================================================== */
/*  §33.5 — Holder Mode                                                       */
/* ========================================================================== */

describe("God's Holder: Possession", () => {
  const possession = ability("mannanan-gods-holder-possession");

  it("is a one-way mode with an entry price", () => {
    expect(possession.isMode).toBe(true);
    expect(possession.cannotDeactivate).toBe(true);
    expect(possession.maxUses).toBe(1);
    expect(possession.phases.map((p) => p.kind)).toEqual(["resource", "statChange", "heal"]);
  });

  it("gates the button on Health below 30% and at least one token", () => {
    expect(possession.requirements).toEqual([
      { kind: "healthBelow", fraction: 0.3 },
      { kind: "resourceAtLeast", key: "fragarachTokens", amount: 1 },
    ]);
  });

  it("is an OPTIONAL revival, above Guts and below Special Guts", () => {
    const revival = possession.passiveRules.find((r) => r.key === "RevivalSource");
    expect(revival.optional).toBe(true);
    expect(revival.revivalPriority).toBe(250);
    expect(revival.percentOfMax).toBe(50);
    expect(revival.enterMode).toBe("godsHolderPossession");
  });

  it("restores to exactly half, whatever killed her", () => {
    const revival = possession.passiveRules.find((r) => r.key === "RevivalSource");
    // "Restoring her Health TO 50% of its maximum value" is a destination, so
    // the overkill that God Hand subtracts does not apply here.
    expect(revival.ignoresOverkill).toBe(true);
    expect(possession.phases.find((p) => p.kind === "heal").toPercentOfMax).toBe(50);
  });

  it("is withheld until somebody accepts it", () => {
    const out = collectContributions([{
      id: "possession", name: "God's Holder: Possession",
      passiveRules: possession.passiveRules, fromEffect: false,
    }]);
    const unit = {
      revivals: out.revivals.map((r) => ({ ...r, charges: 1 })),
      resources: { fragarachTokens: { value: 3, max: 5 } },
      abilities: [],
    };
    expect(availableRevivals(unit)).toEqual([]);
    expect(availableRevivals({ ...unit, acceptedRevivals: ["holderMode"] })).toHaveLength(1);
  });

  it("is withheld when she holds no tokens, whatever the answer", () => {
    const out = collectContributions([{
      id: "possession", name: "God's Holder: Possession", passiveRules: possession.passiveRules,
    }]);
    const unit = {
      revivals: out.revivals.map((r) => ({ ...r, charges: 1 })),
      resources: { fragarachTokens: { value: 0, max: 5 } },
      abilities: [],
      acceptedRevivals: ["holderMode"],
    };
    expect(availableRevivals(unit)).toEqual([]);
  });

  it("rewrites Range and the Normal Attack through her own variant block", () => {
    const holder = SHEET.summonVariant.holder.overrides;
    expect(holder.range.panels).toBe(3);
    expect(holder.normalAttack.mode).toBe("rangeBanded");
    // 150 + 30% of 250 = 225 at Range 1-2, not seen by Magic Resistance.
    const melee = holder.normalAttack.bands.find((b) => b.from === 1);
    expect(melee.sources).toEqual([
      { component: "str", factor: 1 },
      { component: "mag", factor: 0.3 },
    ]);
    expect(melee.ignoresMagicResistance).toBe(true);
    // BA(MAG) alone at 3 or higher.
    expect(holder.normalAttack.bands.find((b) => b.from === 3).sources)
      .toEqual([{ component: "mag", factor: 1 }]);
  });

  it("swaps the two swords with gates on both sides and one shared clock", () => {
    const toole = ability("mannanan-toole-fragarach");
    const hallowed = ability("mannanan-hallowed-sea-gods-sword");

    expect(toole.requirements).toContainEqual({ kind: "modeInactive", mode: "godsHolderPossession" });
    expect(hallowed.requirements).toContainEqual({ kind: "modeActive", mode: "godsHolderPossession" });
    expect(toole.alsoTriggers).toEqual([{ ability: "mannanan-hallowed-sea-gods-sword" }]);
    expect(hallowed.alsoTriggers).toEqual([{ ability: "mannanan-toole-fragarach" }]);
    expect(toole.cooldown).toBe(hallowed.cooldown);
  });
});

/* ========================================================================== */
/*  Content wiring                                                            */
/* ========================================================================== */

describe("her sheet", () => {
  const ABILITIES = new Set(
    readdirSync("packs/_source/abilities")
      .filter((f) => f.endsWith(".yml"))
      .map((f) => parse(readFileSync(join("packs/_source/abilities", f), "utf8")).id),
  );
  const CLASS_SKILLS = new Set(
    readdirSync("packs/_source/class-skills")
      .filter((f) => f.endsWith(".yml"))
      .map((f) => parse(readFileSync(join("packs/_source/class-skills", f), "utf8")).id),
  );

  it("carries all fourteen abilities the sheet lists", () => {
    expect(SHEET.abilities).toHaveLength(14);
    for (const entry of SHEET.abilities) {
      expect(ABILITIES.has(entry.ref) || CLASS_SKILLS.has(entry.ref)).toBe(true);
    }
  });

  it("takes Magic Resistance B, Riding A and Divinity B from the shared tables", () => {
    const byRef = Object.fromEntries(SHEET.abilities.map((a) => [a.ref, a]));
    expect(byRef["class-magic-resistance"].rank).toBe("B");
    expect(byRef["class-riding"]).toMatchObject({ rank: "A", cooldown: "3◈" });
    expect(byRef.divinity.rank).toBe("B");
  });

  it("prices both Fragarach spends as the sheet does", () => {
    expect(ability("mannanan-toole-fragarach").requirements)
      .toContainEqual({ kind: "resourceAtLeast", key: "fragarachTokens", amount: 3 });
    expect(ability("mannanan-fragarach").requirements)
      .toContainEqual({ kind: "resourceAtLeast", key: "fragarachTokens", amount: 5 });
  });

  it("declares Fragarach's two branches and its window", () => {
    const np = ability("mannanan-fragarach");
    expect(np.timing.window).toBe("whenTargetedByNP");
    expect(np.cancelsNP.againstStrongest.effect).toBe("instakill");
    expect(np.cancelsNP.otherwise.reflect).toBe(true);
    expect(np.cooldown).toBe("8◈");
  });
});
