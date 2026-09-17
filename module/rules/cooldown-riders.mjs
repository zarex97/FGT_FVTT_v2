/**
 * @file Splitting a cooldown rider between its two audiences.
 * @see docs/21-combat-process.md, docs/17-abilities.md
 *
 * Layer 2 (rules). Pure.
 *
 * A `kind: cooldown` phase on a damaging ability can aim at two different
 * people, and an area attack is what makes the difference visible.
 *
 * > *"Then, inflicts Def Dwn for 1◈ Turns … and increases the NP Cooldown of
 * > all affected Units by 1◈ Turns."* — Nursery Rhyme, over a 3×3 area.
 *
 * > *"increase the DU's NP Cooldown by 1◈ Turns"* — Kiritsugu's Chronos Rose,
 * > over one Unit.
 *
 * A Noble Phantasm that catches four Units fans out into four Combat Processes,
 * one per defender. A change aimed at the TARGET must run in each of them — it
 * is a different target each time. A change aimed at the CASTER must run in
 * exactly one, or a four-Unit Noble Phantasm turns its own clock four times.
 *
 * That is the same distinction `engine/attack.mjs`'s rider loop already draws
 * for `target: self` and for `targeting:` — both of which it gates on
 * `isFirstOfGroup` — and it is drawn here, per change rather than per phase,
 * because one phase may carry both kinds.
 */

/**
 * Split a cooldown phase's changes by who they land on.
 *
 * @param {object} phase a `kind: "cooldown"` phase
 * @returns {{perDefender: object[], oncePerPhase: object[]}}
 */
export function splitCooldownRider(phase) {
  const changes = phase?.changes ?? [];
  return {
    perDefender: changes.filter((c) => c?.unit === "target"),
    // Everything else is the caster's own clock. `unit` unstated is the caster,
    // which is what every cooldown clause authored before Chronos Rose meant.
    oncePerPhase: changes.filter((c) => c?.unit !== "target"),
  };
}
