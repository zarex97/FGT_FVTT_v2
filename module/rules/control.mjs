/**
 * @file Who controls a unit right now — Charm and control transfer.
 * @see docs/25-turn-system.md §25.7, docs/18-action-economy.md §18.5
 *
 * Layer 2 (rules). Pure.
 *
 * The turn system asks a **derived control map** rather than raw ownership,
 * because Charm moves who acts with a unit without moving who owns it. A
 * charmed Servant appears in the charmer's units during their turn and is
 * absent from its owner's; its token stays the owner's colour, because its
 * faction has not changed.
 *
 * §25.7's RISK is unchanged by any of this and worth restating: Foundry
 * permissions are **not** altered by Charm, so the charmer's client cannot
 * write to the charmed actor. Every action with a charmed unit routes through
 * the GM proxy — which is already the default path (Ch. 26), so nothing here
 * needs a special case. It costs one extra round trip.
 */

/** The effect that transfers control. */
const CHARM = "charm";

/**
 * Is this unit under an **active** charm?
 *
 * An expired charm is left on the unit until the scheduler sweeps it, so
 * `isActive` is the question, not presence.
 *
 * @param {object} unit
 * @returns {boolean}
 */
export function isCharmed(unit) {
  return Boolean(findCharm(unit));
}

/**
 * The unit id of whoever is charming this one, or `null`.
 * @param {object} unit
 * @returns {string|null}
 */
export function charmSource(unit) {
  return findCharm(unit)?.source?.unitId ?? null;
}

/**
 * The user id that controls this unit, or `null` for the GM.
 *
 * Resolution **follows the chain**, because control is what transfers, not
 * ownership: if A charms B and B charms C, then C answers to whoever holds B,
 * and whoever holds B is A's controller. Stopping after one hop would return
 * B's *owner* instead — the player who currently controls nothing.
 *
 * The chain is guarded by a visited set. A cycle is nonsense content, but an
 * unguarded one hangs the turn HUD rather than producing a wrong answer, and a
 * unit in a cycle falls back to its own owner.
 *
 * A charm whose source has left the board, or has no owner, falls back to the
 * **GM** rather than to the victim's owner. Handing control back to the player
 * the charm just took it from would make a dead charmer's charm a no-op.
 *
 * @param {object} unit
 * @param {object} board
 * @param {Set<string>} [seen] internal, for the cycle guard
 * @returns {string|null}
 */
export function controllerOf(unit, board, seen = new Set()) {
  if (!unit) return null;
  if (seen.has(unit.id)) return unit.ownerUserId ?? null;

  const sourceId = charmSource(unit);
  if (!sourceId || sourceId === unit.id) return unit.ownerUserId ?? null;

  const charmer = (board?.units ?? []).find((u) => u.id === sourceId);
  if (!charmer) return null;

  return controllerOf(charmer, board, new Set([...seen, unit.id]));
}

/**
 * Every unit this user may act with, charm included.
 *
 * Both halves matter and they are the same call: a charmed unit joins the
 * charmer's list **and** leaves its owner's. A unit in two lists acts twice.
 *
 * @param {string|null} userId `null` for the GM's own units
 * @param {object} board
 * @returns {object[]}
 */
export function unitsControlledBy(userId, board) {
  return (board?.units ?? []).filter((u) => controllerOf(u, board) === userId);
}

/* -------------------------------------------------------------------------- */

/** @param {object} unit @returns {object|null} */
function findCharm(unit) {
  return (unit?.effects ?? []).find(
    (e) => (e?.defId ?? e) === CHARM && (typeof e === "string" || e.isActive),
  ) ?? null;
}
