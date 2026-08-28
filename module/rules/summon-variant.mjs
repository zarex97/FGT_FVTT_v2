/**
 * @file Summon-time variants — a coin flip at summon that changes a Servant's
 * shape from then on.
 * @see docs/05-ranks-and-parameters.md, char_orig_sheets/Copia de Semiramis.md
 *
 * Layer 2 (rules). Pure.
 *
 * Semiramis is the only Servant in the reference set that needs this: her
 * Range, normal-attack component and Sustainability all depend on whether she
 * rolled the 'Double Summon: Caster' Skill at summon. Modeled as a summon-time
 * branch, resolved once and stored, rather than a runtime predicate — the
 * branch changes the SHAPE of her data (range bands, sustainability), not
 * just a conditional effect layered on a fixed shape, and resolving it once
 * keeps every downstream reader simple.
 */

/**
 * @typedef {object} SummonVariantBranch
 * @property {string} id
 * @property {object} [overrides] a `system`-shaped patch applied at commit
 */

/**
 * Which branch a summon-time coin flip picked.
 *
 * Roll 1 is heads, matching `masterSetupPlan`'s `coinFlip` mode
 * (`rules/setup-rolls.mjs`) and the sign-coin convention `resolveSetupPlan`
 * already uses — this codebase's one, unvarying "heads = 1" rule.
 *
 * A branch overrides FIELDS (Range, normal-attack mode, Sustainability); it
 * does not attach or detach ability Items. Semiramis's 'Double Summon:
 * Caster' Skill is authored on her sheet unconditionally, with its own two
 * Passives each gated by `self:variant:dsc` — simpler than conditionally
 * creating an Item at commit time, and it is also how her `Double Summon`
 * Active's temporary grant of the same Skill has to work anyway (a buff
 * cannot retroactively attach an Item's passive rules to itself).
 *
 * @param {object|null} spec `system.summonVariant`
 * @param {number} rollTotal the `1d2` result
 * @returns {SummonVariantBranch|null} `null` when `spec` is absent
 */
export function resolveSummonVariant(spec, rollTotal) {
  if (!spec) return null;
  const branch = rollTotal === 1 ? spec.heads : spec.tails;
  if (!branch?.id) return null;
  return { id: branch.id, overrides: branch.overrides ?? {} };
}
