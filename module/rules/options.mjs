/**
 * @file Roll options — the vocabulary every predicate is written against.
 * @see docs/24-rules-engine.md §24.4
 *
 * Layer 2 (rules). Pure.
 *
 * A predicate is a set membership test: `["target:attribute:divine"]` is true
 * when that string is in the option set. So the set *is* the vocabulary, and a
 * clause nobody emits is a clause that can never be true.
 *
 * Two such clauses were found by authoring Penthesilea:
 *
 *   - `domain/tables.mjs` has predicated on `target:skill:divinity` since the
 *     tables were transcribed, and **nothing emitted a `skill:` option**. The
 *     Divinity-versus-Divinity clause could not fire, in either direction.
 *   - Nothing emitted region, so *"damage dealt to Male Units from the Greece
 *     region"* could not be written at all.
 *
 * This lives in the rules layer rather than in the attack flow because the flow
 * needs Foundry and this does not — which is the only reason the gaps above
 * went unnoticed for as long as they did.
 */

import { Rank } from "../domain/rank.mjs";

/**
 * Every option describing this attacker, this defender and this attack.
 *
 * @param {object} args
 * @param {object} args.attacker the attacker's snapshot
 * @param {object} args.defender the defender's snapshot
 * @param {object} [args.attack] `{kind, isAoE}`
 * @returns {Set<string>}
 */
export function rollOptionsFor({ attacker, defender, attack = {} }) {
  /** @type {Set<string>} */
  const options = new Set();

  add(options, "self", attacker);
  add(options, "target", defender);

  options.add(`attack:kind:${attack.kind ?? "normal"}`);
  if (attack.isAoE) options.add("attack:isAoE");

  // WHICH Base Attack, and whether the attack is one Magic Resistance sees.
  // Magic Resistance's Instakill/Death ladder turns on both: it covers those
  // two tiers *"unless the Instakill or Death debuffs are from an Attack /
  // Attack Skill / Spell / NP that deals STR damage or that is not affected by
  // Magic Resistance"*. Neither was expressible before, so the exemption could
  // not be written at all.
  if (attack.component) options.add(`attack:component:${attack.component}`);
  if (attack.ignoresMagicResistance) options.add("attack:ignoresMagicResistance");

  return options;
}

/**
 * Everything one side contributes, under its own prefix.
 *
 * @param {Set<string>} options
 * @param {"self"|"target"} side
 * @param {object} unit
 * @returns {void}
 */
function add(options, side, unit) {
  if (!unit) return;

  if (unit.kind) options.add(`${side}:type:${unit.kind}`);
  for (const a of unit.attributes ?? []) options.add(`${side}:attribute:${a}`);
  for (const e of unit.effects ?? []) options.add(`${side}:effect:${e}`);

  // Region, so a clause can name where a unit is from.
  for (const r of unit.region ?? []) options.add(`${side}:region:${r}`);

  // Standing in its OWN Home Base. Medea's Territory Creation predicates on it
  // from both directions -- her own damage dealt, and an ally's damage taken --
  // which is why it is emitted for `self` and `target` alike.
  if (unit.inHomeBase) options.add(`${side}:inHomeBase`);

  // Rank COMPARISONS, emitted as one option per grade the unit clears.
  //
  // Medea's Atlas is "reduced by 25% on Units with a MAG Rank of B or higher",
  // and an equality option (`rank:mag:A`) cannot express that -- a rule written
  // for B would miss every A. Emitting the whole ladder below the unit's rank
  // turns a comparison into a set membership, which is all a predicate can do.
  for (const [parameter, raw] of Object.entries(unit.parameters ?? {})) {
    for (const grade of gradesClearedBy(raw)) {
      options.add(`${side}:rank:${parameter}:gte:${grade}`);
    }
  }

  for (const ability of unit.abilities ?? []) {
    const slug = ability.slug ?? ability.id;
    if (!slug) continue;
    options.add(`${side}:skill:${slug}`);
    // The rank of a SKILL, for Atlas's second reduction -- and the two stack,
    // so each has to be expressible on its own.
    for (const grade of gradesClearedBy(ability.rank)) {
      options.add(`${side}:skillRank:${slug}:gte:${grade}`);
    }
    // Held and *switched on* are different questions. Penthesilea's Charisma is
    // "negated and cannot be used when Mad Enhancement is activated" — an
    // ability disabled by its owner's other ability, which needs the second.
    if (ability.active) options.add(`${side}:skillActive:${slug}`);
  }
}

/**
 * Every grade a rank is at or above.
 *
 * `B+` clears `B`, which is the reading "Rank B or higher" needs -- a `+` step
 * is above its grade, not beside it.
 *
 * @param {string|null} raw
 * @returns {string[]}
 */
function gradesClearedBy(raw) {
  let rank = null;
  try {
    // `parseOrNull` handles the *unranked marker* and rethrows on anything
    // else, which is right at build time and wrong here: this pass runs over
    // whatever a live document holds, and one malformed rank must not take the
    // whole board snapshot down with it. The content validator is where a bad
    // rank is supposed to be loud.
    rank = Rank.parseOrNull(raw);
  } catch {
    return [];
  }
  if (!rank) return [];
  return GRADE_LADDER.filter((grade) => Rank.gte(rank, Rank.of(grade)));
}

/** The grades a comparison may name, weakest first. */
const GRADE_LADDER = Object.freeze(["E", "D", "C", "B", "A", "EX"]);
