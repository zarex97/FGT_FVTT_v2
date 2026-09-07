/**
 * @file Ranking a Unit's Noble Phantasms by how hard they hit.
 * @see docs/33-case-mannanan.md §33.4, docs/13-damage-pipeline.md §13.1
 *
 * Layer 2 (rules). **Pure.**
 *
 * One ability in the reference set needs a Servant's Noble Phantasms compared
 * against each other, and it is the hardest one in the set:
 *
 * > *"If the NP was the enemy Unit's **strongest** NP (or its only
 * > damage-dealing NP), the NP is canceled and the Servant/Unit who used the NP
 * > is inflicted with Instakill."*
 *
 * That is a genuine computation rather than a lookup. Two things make it
 * tractable:
 *
 * **The pipeline is pure**, so "what would this deal" is the same call the real
 * resolution makes, against a defender that does not exist.
 *
 * **The comparison must not depend on who is standing in front of it.** A
 * ranking taken against the live defender would make "strongest" a function of
 * the board — Karna's *Brahmastra* is 4× against a Unit whose parameters he
 * matches and 2× against one he does not, so the same two Noble Phantasms would
 * swap places depending on who Mannanán happened to be. So the ranking runs
 * against a **synthetic neutral defender** with no resistances, no buffs and no
 * attributes, with the expected value of every die, and takes the **best**
 * branch of any conditional. Deterministic across clients, which is what
 * matters when the answer decides an Instakill.
 *
 * RISK and DECISION are recorded in Ch. 41 and Ch. 33 §33.4.
 */

import { computeDamage } from "./damage/pipeline.mjs";

/**
 * The expected total of `5d10`, the attack roll every damage event makes.
 *
 * 27.5, not a roll: a ranking that re-rolled would put two Noble Phantasms in
 * a different order on two clients, and this one decides whether somebody dies.
 */
export const EXPECTED_ATTACK_ROLL = 27.5;

/**
 * A defender with nothing on it.
 *
 * Every field the pipeline reads, at its most neutral value — no Magic
 * Resistance, no modifiers, no negation, no effects, no attributes. Health is a
 * large finite number rather than `null`, because `null` means *"cannot take
 * damage at all"* (Pale Rider) and would rank every Noble Phantasm at zero.
 *
 * @returns {object}
 */
export function neutralDefender() {
  return {
    id: "__neutral__",
    kind: "servant",
    health: 1_000_000,
    maxHealth: 1_000_000,
    agility: 10,
    luck: 10,
    attributes: [],
    effects: [],
    effectInstances: [],
    effectFamilies: [],
    modifiers: [],
    damageNegation: [],
    magicResistance: null,
    revivals: [],
    applicationChances: [],
    suppressions: [],
    abilities: [],
  };
}

/**
 * What one damaging ability would deal to a Unit with no defences.
 *
 * `branches` are resolved by taking the **best** of them, which is the DECISION
 * §33.4 records: a conditional Noble Phantasm is ranked at its ceiling, because
 * that is what "strongest" means about a weapon rather than about a matchup.
 *
 * @param {object} ability an ability item, or any `{system}` shape
 * @param {object} attacker the owner's unit snapshot
 * @returns {number} `0` for anything that deals no damage
 */
export function expectedDamage(ability, attacker) {
  const sys = ability?.system ?? ability ?? {};
  const specs = damageSpecs(sys);
  if (specs.length === 0) return 0;

  let best = 0;
  for (const spec of specs) {
    const total = computeDamage({
      attacker,
      defender: neutralDefender(),
      board: { units: [] },
      attack: {
        kind: "np",
        abilityId: ability?.id ?? null,
        component: spec.component ?? "str",
        categorizedAsNP: Boolean(sys.categorizedAsNP),
        isFixedDamage: Boolean(spec.fixed),
        element: spec.element ?? sys.element ?? null,
        ignoresMagicResistance: Boolean(spec.ignoresMagicResistance),
      },
      base: spec.fixed
        ? { fixedValue: spec.base?.fixedValue ?? 0 }
        : (spec.base ?? { sources: [{ unit: "self", component: spec.component ?? "str", factor: 1 }] }),
      multiplier: spec.multiplier ?? 1,
      flatBonus: spec.flatBonus ?? 0,
      // Every conditional multiplier the ability declares, taken as though it
      // fired. Same reasoning as `branches`: the ceiling is the weapon.
      conditionalMultipliers: (spec.conditionalMultipliers ?? []).map((c) => ({ ...c, predicate: null })),
      // A crit is not assumed. The crit coin is 50/50 for a Noble Phantasm
      // (§12.5) and assuming it would scale every entry by the same factor
      // anyway — but it would also let a crit-damage buff on the OWNER change
      // the ranking, which is a fact about the moment rather than about the
      // Noble Phantasm.
      crit: { isCrit: false, chanceUsed: 0 },
      reaction: { kind: "none" },
      totalDamageModifiers: [],
      luckChecks: {},
      rolls: { attackMinus: EXPECTED_ATTACK_ROLL, negation: [] },
      options: new Set(),
    }).total;

    // Multi-hit is part of how hard it hits. Dragon Wing Warriors is 50 Fixed
    // damage a hit and `1d6+4` hits, which is nothing on one line and up to 500
    // on all of them.
    const hits = typeof spec.repeat === "number" ? Math.max(1, spec.repeat) : 1;
    best = Math.max(best, total * hits);
  }
  return best;
}

/**
 * Every damage shape one ability can take.
 *
 * A `damage.branches` ability has several and the resolution picks one by
 * predicate; this pass keeps all of them, because {@link expectedDamage} ranks
 * at the ceiling.
 *
 * @param {object} sys
 * @returns {object[]}
 */
function damageSpecs(sys) {
  const damage = sys.damage ?? null;
  if (!damage) return [];
  const branches = damage.branches ?? [];
  // The top-level block is the fallback a branched ability still declares, and
  // it is a legitimate shape in its own right — Brahmastra's is its weaker 2×.
  const base = { ...damage, branches: undefined };
  return branches.length > 0 ? [...branches.map((b) => ({ ...base, ...b })), base] : [base];
}

/**
 * A Unit's damaging Noble Phantasms, hardest first.
 *
 * *"Cannot be used against (Passive) or (Non-damaging) Noble Phantasms"* — both
 * exclusions are here rather than at the call site, because they are what makes
 * a Noble Phantasm a candidate for being ranked at all.
 *
 * @param {Array<object>} abilities the owner's ability items
 * @param {object} attacker the owner's unit snapshot
 * @returns {Array<{id: string, contentId: string|null, name: string, expected: number}>}
 */
export function rankNoblePhantasms(abilities, attacker) {
  return (abilities ?? [])
    .filter((a) => isDamagingNP(a))
    .map((a) => ({
      id: a.id,
      contentId: a.system?.contentId ?? null,
      name: a.name,
      expected: expectedDamage(a, attacker),
    }))
    .filter((entry) => entry.expected > 0)
    .sort((a, b) => b.expected - a.expected || String(a.id).localeCompare(String(b.id)));
}

/**
 * Is this a Noble Phantasm that could be cancelled?
 *
 * @param {object} ability
 * @returns {boolean}
 */
export function isDamagingNP(ability) {
  const sys = ability?.system ?? {};
  const isNP = ability?.type === "noblePhantasm" || sys.isNP === true;
  if (!isNP || sys.isPassive === true) return false;
  return (sys.phases ?? []).some((p) => p.kind === "damage") || Boolean(sys.damage);
}

/**
 * Was `abilityId` the strongest damaging Noble Phantasm this Unit has?
 *
 * *"(or its only damage-dealing NP)"* — a Unit with one is always at its
 * strongest, which falls out of the ranking rather than needing a clause.
 *
 * A tie counts as strongest. Two Noble Phantasms of equal expected damage are
 * both the best the Unit has, and the alternative — picking one by id — decides
 * a Servant's life on a sort order.
 *
 * @param {Array<object>} abilities
 * @param {object} attacker
 * @param {string} abilityId
 * @returns {{strongest: boolean, ranked: Array<object>}}
 */
export function isStrongestNP(abilities, attacker, abilityId) {
  const ranked = rankNoblePhantasms(abilities, attacker);
  if (ranked.length <= 1) return { strongest: true, ranked };

  const used = ranked.find((r) => r.id === abilityId || r.contentId === abilityId);
  if (!used) return { strongest: false, ranked };
  return { strongest: used.expected >= ranked[0].expected, ranked };
}
