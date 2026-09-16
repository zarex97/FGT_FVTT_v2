/**
 * @file Which connection runs a scheduler boundary, and under what name.
 * @see module/engine/scheduler-hooks.mjs, docs/46-roster-re-audit.md §46.4-AB
 *
 * Layer 2: pure, no `game`, no `canvas`. The election itself needs to write to
 * a document and lives in the hook; the two questions it turns on do not, and
 * they are here so they can be asked without a world.
 *
 * `game.users.activeGM` elects one GM *user*, and `isSelf` is true for every
 * connection that user holds — so two browser tabs on one Gamemaster each ran
 * the whole turn-end sequence and every scheduled effect ticked twice
 * (Ch. 46 §46.4-D). The second half of that election is a claim on the
 * boundary, and this file says what a boundary is called.
 */

/**
 * The name a boundary is claimed under.
 *
 * **Not `system.globalTurn`**, which is what §46.4-D used and which is the one
 * counter that must never be the key: it is advanced *by the sequence the claim
 * guards*, a hundred lines below the claim itself. Anything throwing in between
 * left the claim written and the counter where it was, so every later boundary
 * read the same tick, found it already claimed, and refused — freezing the
 * scheduler for the life of the world (Ch. 46 §46.4-AB).
 *
 * Foundry's own `round` and `turn` have neither problem. It advances both
 * *before* it fires `updateCombat`, so a hook reads the incoming boundary's
 * numbers, and it does so whether or not our sequence succeeds. A Turn is named
 * by both because `turn` alone repeats every round; a Round needs only `round`.
 *
 * @param {"turn"|"round"} kind
 * @param {{round?: number, turn?: number}} combat
 * @returns {string}
 */
export function boundaryKey(kind, combat) {
  const round = combat?.round ?? 1;
  return kind === "round" ? `r${round}` : `r${round}t${combat?.turn ?? 0}`;
}

/**
 * Has this exact boundary already been claimed?
 *
 * The cheap half of the election, and the common case for the losing tab once
 * the winner's write has landed. A claim with no token is not a claim: the
 * token is what makes the race decidable, since Foundry hands a system no
 * server-side compare-and-set.
 *
 * Compared with `===` against a string, which is also how a world frozen by
 * §46.4-AB thaws without a migration: the old shape stored a NUMBER, and a
 * number is never equal to a key, so the next boundary simply proceeds.
 *
 * @param {object|null} claim `combat.system.scheduleClaim`
 * @param {"turn"|"round"} kind
 * @param {string} key from {@link boundaryKey}
 * @returns {boolean}
 */
export function alreadyClaimed(claim, kind, key) {
  return Boolean(claim?.token) && claim?.[kind] === key;
}
