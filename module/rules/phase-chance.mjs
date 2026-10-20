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
 */

/**
 * The percent a phase's die must roll at or under.
 *
 * @param {number|{value?: number, perPriorUse?: number, max?: number}} chance
 * @param {number} priorUses the ability's uses before this one
 * @returns {number}
 */
export function phaseChance(chance, priorUses = 0) {
  if (typeof chance === "number") return chance;
  const base = Number(chance?.value ?? 0);
  const grown = base + Number(chance?.perPriorUse ?? 0) * Math.max(0, priorUses);
  const max = typeof chance?.max === "number" ? chance.max : 100;
  return Math.max(0, Math.min(max, grown));
}
