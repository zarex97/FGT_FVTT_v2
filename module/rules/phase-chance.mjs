/**
 * @file A Skill phase that happens only on a die, and a chance that grows with each use.
 * @see module/engine/skill-use.mjs, docs/17-abilities.md
 *
 * Layer 2 (rules). Pure.
 *
 * Prelati's Encouragement (Gilles de Rais (Saber), #260): *"Gilles has a 15%
 * chance of permanently activating his Mad Enhancement Skill. Every time this
 * Skill is used after the first usage, activation chance is increased by 15%
 * (max. 90%)."* Authored on the phase as
 * `chance: { value: 15, perPriorUse: 15, max: 90 }`.
 *
 * Vlad III (Berserker)'s Bloodsucking (#333): *"If Mad Enhancement is Active ...
 * the chance of increasing the DU's NP Cooldown is reduced by 20%"*. A
 * `modifiers` entry adds to the chance while its predicate holds of the user:
 * `{ value: 100, modifiers: [{ add: -20, predicate: [self:skillActive:madEnhancement] }] }`.
 */

import { test as testPredicate } from "./predicate.mjs";

/**
 * The percent a phase's die must roll at or under.
 *
 * @param {number|{value?: number, perPriorUse?: number, max?: number, modifiers?: Array<{add: number, predicate: unknown[]}>}} chance
 * @param {number} priorUses the ability's uses before this one
 * @param {Set<string>} [options] the user's own options, for `modifiers`
 * @returns {number}
 */
export function phaseChance(chance, priorUses = 0, options = new Set()) {
  if (typeof chance === "number") return chance;
  const base = Number(chance?.value ?? 0);
  const modified = (chance?.modifiers ?? [])
    .filter((m) => testPredicate(m.predicate ?? [], { options }))
    .reduce((sum, m) => sum + Number(m.add ?? 0), 0);
  const grown = base + modified + Number(chance?.perPriorUse ?? 0) * Math.max(0, priorUses);
  const max = typeof chance?.max === "number" ? chance.max : 100;
  return Math.max(0, Math.min(max, grown));
}
