/**
 * @file Whether a resolved Damage Step delivers its on-hit riders.
 * @see docs/21-combat-process.md, docs/E-event-reference.md §E.5
 *
 * Layer 2 (rules). Pure.
 *
 * **Hit, not hurt.** The Damage Step asked this question twice, one line
 * apart, and got two different answers. The ABILITY-declared riders
 * (`applyAbilityEffects`) ran whenever the attack was neither suppressed nor
 * veiled; the EVENT-declared ones (`damageDealt`, `damageTaken`) additionally
 * required `result.total > 0`. So a defender whose Def Up, Dmg Cut or Ward
 * reduced the total to zero took the phase-authored rider and none of `Bleed
 * Atk`, `Queen's Poison`, Serenity's poisoned daggers, Nemo's Slow or Karna's
 * Burn — every on-hit rider in Appendix A, silent against exactly the targets
 * worth riding.
 *
 * A Unit that was hit for nothing was still hit. The author's ruling states it
 * as a general rule rather than as one Servant's clause: *"every unit that was
 * hit, even if they didn't take damage — that's how it should be for every
 * Attack that also applies effects."* Only an attack that was **suppressed**
 * (a complete negation — *"no damage and effects are received"*) or **veiled**
 * by concealment refuses them.
 *
 * This lives here rather than beside its caller so there is one decision with
 * one reader, and so it can be held by a test without a world. The two halves
 * drifted apart from the day the second was written precisely because neither
 * had a name.
 *
 * **`damageStepEnd` is deliberately not routed through this.** Scáthach's Alpi
 * is *"at the end of the Damage Step when a successful Attack is performed"* —
 * a clause about the attack succeeding rather than about delivering an effect,
 * and widening it would be extending the ruling rather than applying it.
 */

/**
 * Does this resolved Damage Step fire its event-declared on-hit riders?
 *
 * @param {object} args
 * @param {string|null|undefined} args.skipped what suppressed the damage, if anything
 * @param {object|null|undefined} args.result the finished damage result
 * @returns {boolean}
 */
export function ridersFire({ skipped, result }) {
  if (skipped) return false;
  return result?.flags?.concealmentVeil?.effects !== false;
}
