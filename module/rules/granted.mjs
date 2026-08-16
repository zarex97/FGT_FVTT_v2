/**
 * @file Granted capabilities — reading the `grantedAbilities` bucket.
 * @see docs/15-abilities.md §15.7
 *
 * Layer 2 (rules). Pure.
 *
 * `GrantedAbility` collected ability ids and **nothing read the bucket**.
 * Riding's double move did work, but through a separate
 * `hasSkill(actor, "riding")` name-match — so the grant and the capability were
 * two mechanisms for one rule, and only one of them was connected.
 *
 * The split is the defect, not the name-match. A Servant granted the double
 * move by anything other than the Riding class skill — a Master Essence,
 * Semiramis's *Double Summon*, one of Scáthach's copies — would not have got
 * it, and every future granted capability would have needed its own bespoke
 * check somewhere in the engine.
 *
 * So the grant is the input, and this is how you ask.
 */

/**
 * The capabilities content can grant, as ids.
 *
 * A closed list, because these are the ones something in the engine actually
 * asks about. An id outside it is not an error — Scáthach copies arbitrary
 * abilities — but it will not switch on a rule, and the content validator is
 * where a typo in a *known* capability should be caught.
 */
export const GRANTS = Object.freeze({
  /** Riding: *"able to Move twice in one turn if it Attacks in between."* */
  doubleMove: "doubleMove",
  /** Riding: an attack along the movement path (Ch. 03). Terminal for the turn. */
  ridingAttack: "ridingAttack",
  /** Riding: carrying another unit. Needs platforms (Ch. 20), so nothing reads it yet. */
  passengerSeat: "passengerSeat",
});

/**
 * Was this unit granted a capability?
 *
 * @param {object} unit a unit snapshot
 * @param {string} id one of {@link GRANTS}
 * @returns {boolean}
 */
export function hasGranted(unit, id) {
  return (unit?.grantedAbilities ?? []).includes(id);
}

/**
 * A granted ability, as a descriptor.
 *
 * §15.7 makes the point that Scáthach's copies, Semiramis's *Double Summon*,
 * a Master Essence's rule elements and `[Semiramis' Poison]` are all **one**
 * operation: temporarily add an ability to a unit, from an external source,
 * with its own lifetime. One shape, so a grant from any of the four expires,
 * displays and suppresses the same way.
 *
 * @param {object} args
 * @returns {object}
 */
export function grantedAbility({
  name, rank = null, cooldown = null, phases = null, copiedFrom = null,
  unitId = null, grantedBy = null, exclusionSet = null, duration = null,
}) {
  const out = {
    granted: true,
    name, rank, cooldown, unitId, grantedBy, exclusionSet, duration,
  };
  // A copy carries `copiedFrom` and NO phases: the executor resolves the
  // reference, so a content fix to the source reaches every copy of it.
  if (copiedFrom) out.copiedFrom = copiedFrom;
  else if (phases) out.phases = phases;
  return out;
}
