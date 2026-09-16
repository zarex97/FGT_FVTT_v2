/**
 * @file The linked unit group — two tokens that are one Servant.
 * @see docs/16-relationships.md §16.8, docs/34-case-dioscuri.md
 *
 * Layer 2 (rules). **Pure.**
 *
 * Every question here is PAIRWISE, which is why it is a board pass rather than
 * a per-unit derivation — the same shape of problem as ZON and auras, and it
 * gets the same answer: settle it once in `snapshotBoard`, after every unit is
 * projected, and let the readers ask a plain field.
 *
 * Ch. 16 D16.7 is emphatic that this is **a general mechanism, not a Dioscuri
 * special case**: the shape recurs for a Servant with a permanent summon, and
 * for a Master-Servant pair moving under Passenger Seat. Nothing in this file
 * names a twin.
 */

import * as geo from "../domain/geometry.mjs";

/**
 * The other live members of this unit's group that are on the board.
 *
 * A member with no panel is not on the board and cannot constrain anybody. That
 * matters more than it looks: a leash that refused every panel because the
 * partner has not been placed yet would freeze the survivor solid.
 *
 * @param {object} unit
 * @param {object} board
 * @returns {object[]}
 */
export function partnersOf(unit, board) {
  // Spread, for the reason `test/unit/set-fields.test.mjs` enforces: a
  // document-shaped unit carries a SetField here, and `.includes` on one
  // returns undefined rather than failing.
  const ids = [...(unit?.linkedGroup?.memberIds ?? [])];
  if (ids.length === 0) return [];
  return (board?.units ?? []).filter((u) => ids.includes(u.id) && u.panel);
}

/**
 * Chebyshev distance to the nearest partner, or `null` when there is none.
 *
 * `null` rather than `Infinity`, so the predicate ladder in `rules/options.mjs`
 * emits nothing at all and `self:withinOfPartner:N` is false for every N —
 * which is the right answer for a twin standing alone, and makes its negation
 * true, which is also right.
 *
 * @param {object} unit
 * @param {object} board
 * @returns {number|null}
 */
export function partnerDistance(unit, board) {
  const partners = partnersOf(unit, board);
  if (partners.length === 0 || !unit?.panel) return null;
  return Math.min(...partners.map((p) => geo.chebyshev(unit.panel, p.panel)));
}

/**
 * Is this unit further from a partner than the leash allows?
 *
 * Only ever true after a FORCED displacement: voluntary movement cannot reach
 * such a panel, because `rules/movement.mjs#canStopOn` refuses it. Ch. 34 §34.3
 * takes the DECISION that a knockback may break the leash — dragging the
 * partner along would produce a knockback that pulls a unit *toward* its
 * attacker, which is absurd.
 *
 * @param {object} unit
 * @param {object} board
 * @returns {boolean}
 */
export function leashBroken(unit, board) {
  const leash = unit?.linkedGroup?.leash;
  if (leash === null || leash === undefined) return false;
  const d = partnerDistance(unit, board);
  return d !== null && d > leash;
}

/**
 * What this unit counts as wherever the rules count Units.
 *
 * *"each one counts as 0.5 Units"* scopes to every such rule and qualifies
 * none of them: the four turn-budget pools, the multi-Servant tax (§16.7) and
 * the roster allowance all read this.
 *
 * @param {object} unit
 * @returns {number}
 */
export function unitWeight(unit) {
  return unit?.linkedGroup?.unitWeight ?? 1;
}

/**
 * Annotate every grouped unit with its partner facts.
 *
 * Runs in `snapshotBoard` beside `annotateZon` — and **before** it, because
 * `zonSatisfaction: "any"` is delivered by unioning the group into
 * `zonPartnerIds`, which is the field `rules/zon.mjs` already reads. Deriving
 * it here rather than changing that reader is what keeps the ZON clause free:
 * that comment has quoted *"as long as the other counterpart is within their
 * Master's ZON"* since it was written, and the rule was right and unwritable.
 *
 * @param {object[]} units
 * @param {object} board
 * @returns {object[]} the same units, annotated
 */
export function annotateLinkedGroups(units, board) {
  for (const unit of units ?? []) {
    if (!unit?.linkedGroup?.id) continue;

    const partners = partnersOf(unit, board);
    unit.partnerIds = partners.map((p) => p.id);
    unit.partnerDistance = partnerDistance(unit, board);
    unit.leashBroken = leashBroken(unit, board);

    if (unit.linkedGroup.zonSatisfaction === "any") {
      // The DECLARED members, not only the ones currently on the board: ZON is
      // asked about a Servant that may be anywhere, and `zonStatus` does its
      // own board lookup and skips what it cannot find.
      unit.zonPartnerIds = [
        ...new Set([...(unit.zonPartnerIds ?? []), ...(unit.linkedGroup.memberIds ?? [])]),
      ];
    }
  }
  return units;
}
