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
 * **`damageStepEnd` is routed through this too** (ruled 2026-10-14, #204 LI).
 * App. E said it fires at zero damage, the code fired it only above zero, and
 * the author chose the reference. Alpi, paid once per Attack rather than per
 * Unit hit, listens to `attackLanded` instead.
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
  // A COMPLETE negation at stage 0 is the other "no damage and effects": Anti-
  // Purge and Substitution halt the attack before it is measured (#184,
  // Akhilleus Kosmos). The ability's own riders were already refused for it
  // (`engine/attack.mjs#applyAbilityEffects`); the event-declared ones were
  // not, so a barrier that negated the NP still let its on-hit riders land.
  if (["Anti-Purge", "Substitution"].includes(result?.flags?.negatedBy)) return false;
  return result?.flags?.concealmentVeil?.effects !== false;
}

/**
 * Was the Unit *successfully Attacked* by this Process?
 *
 * Ruled 2026-10-17 (#239 reading 3a) for every clause with that wording: Def Dwn
 * (A) and (C), Alpi, the 'Gogh' buff. Hit, not hurt, as the riders read it: a
 * Block and a hit for 0 count; an Evade never reaches here; a complete negation
 * (Anti-Purge, Substitution) and a concealment coin that says *"no damage and
 * effects are received"* do not. And one more than the riders: a hit whose
 * damage an Instakill skipped (Gáe Bolg Alternative) was a successful Attack,
 * though nothing rides it.
 *
 * @param {object} args
 * @param {string|null|undefined} args.skipped what suppressed the damage, if anything
 * @param {object|null|undefined} args.result the finished damage result
 * @returns {boolean}
 */
export function successfullyAttacked({ skipped, result }) {
  if (skipped) return true;
  return ridersFire({ skipped: null, result });
}
