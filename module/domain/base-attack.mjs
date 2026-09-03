/**
 * @file Base Attack, derived from STR and MAG.
 * @see docs/06-stats-and-resources.md §6.4, docs/B-rank-tables.md, Ch. 41 Q50
 *
 * Layer 1 (domain). Pure, and here rather than in `rules/` because
 * `data/actor/servant.mjs` derives it in `prepareBaseData` and a data model may
 * import from `domain` only — the same reason Max Health's own derivation reads
 * `lookup("baseHealthByEnd", …)` straight from `domain/tables.mjs`.
 */

import { Rank } from "./rank.mjs";
import { lookup } from "./tables.mjs";

/** Which table each component's parameter is read from. */
const COMPONENTS = Object.freeze([
  ["str", "baseAttackStrByStr"],
  ["mag", "baseAttackMagByMag"],
]);

/**
 * A Servant's Base Attack, from its parameters.
 *
 * > *"STR: E => 50, D => 75, C => 100, B => 125, A => 150, EX => 200. MAG:
 * > E => 100, D => 125, C => 150, B => 175, A => 200, EX => 250. For every +
 * > or - added to the Servant's STR/MAG increase or decrease that Servant's
 * > corresponding Base Attack by 10. ... **If you find a value of Base attack
 * > that differs from this calculation choose the value of this table instead
 * > of what is on the character sheet.** Then on top of it the + or - from
 * > other sources (High Rank Master, Region)."*
 *
 * Derived rather than validated because of that emphasised sentence: three of
 * the eleven authored sheets disagree and the table is what the game is played
 * with. The authored figure survives only where there is no parameter to derive
 * from — summons and platforms state Base Attack outright and carry no STR or
 * MAG rank at all.
 *
 * Granted steps fold in by moving the **rank**, which is the same operation an
 * innate step performs; *"then on top of it the + or - from other sources (High
 * Rank Master, Region)"* describes exactly that. `engine/summon.mjs` used to add
 * a separate ±10 per granted step on the reasoning that a sheet's figure
 * *"already accounts for the parameters it was written with"* — true under the
 * old reading, and a double count under this one.
 *
 * @param {object} sheet a Servant's system data
 * @returns {{str: number, mag: number}}
 */
export function baseAttackFor(sheet) {
  const granted = sheet?.grantedSteps ?? {};
  /** @type {{str: number, mag: number}} */
  const out = { str: 0, mag: 0 };

  for (const [parameter, table] of COMPONENTS) {
    const rank = Rank.parseOrNull(sheet?.parameters?.[parameter]);
    const derived = rank
      ? lookup(table, Rank.of(rank.grade, rank.steps + (granted[parameter] ?? 0)))
      : null;
    out[parameter] = typeof derived === "number"
      ? derived
      : (sheet?.baseAttack?.[parameter] ?? 0);
  }
  return out;
}
