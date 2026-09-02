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
  const charm = findCharm(unit);
  // `sourceUnitId` is what the projection writes (`rules/snapshot.mjs`'s
  // `effectInstances`); `source.unitId` is the older nested form the tests and
  // Ch. 25 §25.7's sketch use. Both, because the whole reason this file did
  // nothing for so long is that it only knew the one nobody produced.
  return charm?.sourceUnitId ?? charm?.source?.unitId ?? null;
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

/**
 * Which faction's **Turn** this unit acts on.
 *
 * §25.7 again, in the half that is about the clock rather than about the
 * keyboard: *"a charmed unit appears in the charmer's `currentUnits` during
 * their turn and is absent from its owner's"*. So a charmed unit moves on the
 * charmer's Turn, spends the charmer's action budget, and cannot be moved on
 * its owner's Turn at all — while its **own** `factionId` is untouched, which
 * is why the token keeps its colour and every relation still reads it as the
 * enemy it was.
 *
 * Follows the chain for the same reason `controllerOf` does, and shares its
 * cycle guard.
 *
 * Differs from `controllerOf` in exactly one case, deliberately: when the
 * charmer has left the board, control falls back to the **GM** (handing it
 * back to the victim's own player would make a dead charmer's charm a no-op)
 * but the Turn falls back to the unit's **own** faction — there is no other
 * faction left to act on, and a unit that can never be activated is a softlock
 * rather than a rule.
 *
 * @param {object} unit
 * @param {object} board
 * @param {Set<string>} [seen] internal, for the cycle guard
 * @returns {string|null}
 */
export function actingFactionOf(unit, board, seen = new Set()) {
  if (!unit) return null;
  if (seen.has(unit.id)) return unit.factionId ?? null;

  const sourceId = charmSource(unit);
  if (!sourceId || sourceId === unit.id) return unit.factionId ?? null;

  const charmer = (board?.units ?? []).find((u) => u.id === sourceId);
  if (!charmer) return unit.factionId ?? null;

  return actingFactionOf(charmer, board, new Set([...seen, unit.id]));
}

/**
 * Annotate every unit with who acts with it and on whose Turn.
 *
 * Board-wide and settled once, for the same reason ZON and the aura pass are
 * (`rules/snapshot.mjs`): a charm points at another unit, so a unit projected
 * alone cannot answer either question, and every consumer — the movement gate,
 * the action budget, the turn HUD — wants the same answer.
 *
 * Both fields were computable from the day this file was written and **nothing
 * ever called it**: `control.mjs` had no consumer anywhere in the system, and
 * `unit.ownerUserId` — which `controllerOf` reads — was projected by nothing.
 * So Charm applied, showed on the sheet, and transferred no control at all.
 *
 * @param {object[]} units
 * @param {object} board
 * @returns {object[]} the same units, annotated
 */
export function annotateControl(units, board) {
  for (const unit of units ?? []) {
    unit.actingFactionId = actingFactionOf(unit, board);
    unit.controllerUserId = controllerOf(unit, board);
  }
  return units;
}

/* -------------------------------------------------------------------------- */

/**
 * The charm instance on this unit, or `null`.
 *
 * Reads `effectInstances`, which is where the snapshot actually puts the
 * source: `unit.effects` is a list of **bare defIds** (`activeEffectIds`), and
 * this file used to search it for an object with a `.source.unitId` — a shape
 * `rules/snapshot.mjs` has never produced. So `charmSource` returned `null`
 * for every charm that ever existed, `controllerOf` fell straight through to
 * the owner, and Charm transferred nothing. The unit tests agreed with it,
 * because they were written against the same imagined shape.
 *
 * Both forms are accepted now: a caller holding only the id list can still ask
 * *whether* a unit is charmed, it just cannot learn by whom.
 *
 * A suppressed instance does not hold control — the same reading `isActive`
 * always intended.
 *
 * @param {object} unit
 * @returns {object|null}
 */
function findCharm(unit) {
  const instance = (unit?.effectInstances ?? []).find(
    (e) => e?.defId === CHARM && !e.suppressed && e.isActive !== false,
  );
  if (instance) return instance;

  return (unit?.effects ?? []).find(
    (e) => (e?.defId ?? e) === CHARM && (typeof e === "string" || e.isActive),
  ) ?? null;
}
