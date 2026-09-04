/**
 * @file The unit-action registry — what a selected unit may DO, as data.
 * @see docs/29-user-interface.md §29.5, docs/18-action-economy.md §18.9
 *
 * Layer 2 (rules). Pure: every predicate reads a unit snapshot and the board,
 * never a document and never a Foundry global.
 *
 * This exists because three of `rules/budget.mjs`'s eight `ActionKind`s had no
 * caller anywhere in the repository — `mark`, `gather` and `ridingAttack` —
 * while all three engines were complete. Blood Fort Andromeda could not be
 * built, Semiramis's Construction could not be fed, and no Servant could ride
 * through a line, for want of a button. A hand-written HUD is where that
 * happens; a table plus a drift test (`test/unit/actions.test.mjs`) is where it
 * cannot.
 *
 * `available` returns a CONTEXT object rather than a boolean, because two of
 * these need an argument the predicate is already computing: Mark needs the id
 * of the Noble Phantasm the Bloodmarks belong to, and Gather needs the unit
 * whose Construction it feeds. Returning `null` means "do not offer".
 */

import { hasGranted, GRANTS } from "./granted.mjs";
import { relationOf } from "./relations.mjs";

/**
 * The `ActionKind`s billed by an ability button rather than by an entry here.
 *
 * Named rather than implied so the drift test can tell "deliberately not an
 * action button" from "somebody forgot", which is the exact distinction that
 * let three actions ship unreachable.
 */
export const ACTION_EXEMPT_KINDS = Object.freeze(["skill", "np", "spell"]);

/**
 * Every action a unit may take that is not the use of an ability.
 *
 * @type {ReadonlyArray<{
 *   id: string, kind: string|null, icon: string, label: string,
 *   mode: "immediate"|"targeted"|"dial",
 *   available: (unit: object, board: object) => object|null,
 * }>}
 */
export const UNIT_ACTIONS = Object.freeze([
  {
    id: "attack",
    kind: "attack",
    icon: "fa-solid fa-khanda",
    label: "FGT.Action.Attack",
    mode: "targeted",
    // Pale Rider's Riding EX: *"cannot perform Normal Attacks."* The grant is
    // already read by `engine/attack.mjs#resolveAttack`, which refuses the
    // declaration; withholding the button means he is never invited to try.
    available: (unit) => (unit && !hasGranted(unit, GRANTS.noNormalAttack) ? {} : null),
  },
  {
    id: "move",
    kind: "move",
    icon: "fa-solid fa-shoe-prints",
    label: "FGT.Action.Move",
    mode: "targeted",
    available: (unit) => (unit ? {} : null),
  },
  {
    id: "ridingAttack",
    kind: "ridingAttack",
    icon: "fa-solid fa-horse",
    label: "FGT.Action.RidingAttack",
    mode: "targeted",
    // Permanent for Achilles, unlocked by Riding's Active for Medusa. Either
    // way the GRANT is what says it is available, which is the whole reason
    // `granted.mjs` exists rather than a name-match on the Riding skill.
    available: (unit) => (unit && hasGranted(unit, GRANTS.ridingAttack) ? {} : null),
  },
  {
    id: "mark",
    kind: "mark",
    icon: "fa-solid fa-droplet",
    label: "FGT.Action.Mark",
    mode: "immediate",
    available: (unit, board) => {
      const np = (unit?.abilities ?? []).find((a) => a.fieldGeometryKind === "markDefined");
      if (!np) return null;
      // *"Medusa cannot place new Bloodmarks while Bloodfort Andromeda is
      // Active."* The field is keyed by the ability's content id, the same key
      // `engine/marks.mjs#placeMark` uses.
      const fieldId = np.contentId ?? np.id;
      if ((board?.fields ?? []).some((f) => f.id === fieldId)) return null;
      return { abilityId: np.id };
    },
  },
  {
    id: "gather",
    kind: "gather",
    icon: "fa-solid fa-hand-holding-hand",
    label: "FGT.Action.Gather",
    mode: "immediate",
    // *"Semiramis or any allied Unit can perform 'Gather'."* Board-dependent,
    // not unit-intrinsic: this button appears on an ally's bar because of who
    // ELSE is standing on the board.
    available: (unit, board) => {
      if (!unit) return null;
      const owner = (board?.units ?? []).find(
        (u) => u.resources?.hgobConstruction && relationOf(u, unit, board) !== "enemy",
      );
      return owner ? { ownerId: owner.id } : null;
    },
  },
  {
    id: "facing",
    kind: null,
    icon: "fa-solid fa-location-arrow",
    label: "FGT.Action.Facing",
    mode: "dial",
    // §29.5 is explicit that setting facing must not end the turn, so it bills
    // no ActionKind at all.
    available: (unit) => (unit ? {} : null),
  },
]);

/**
 * The actions this unit may take right now, in registry order.
 *
 * @param {object|null} unit a unit snapshot
 * @param {object} board
 * @returns {Array<{id: string, kind: string|null, icon: string, label: string, mode: string, context: object}>}
 */
export function availableActions(unit, board) {
  if (!unit) return [];
  const out = [];
  for (const action of UNIT_ACTIONS) {
    const context = action.available(unit, board);
    if (!context) continue;
    const { id, kind, icon, label, mode } = action;
    out.push({ id, kind, icon, label, mode, context });
  }
  return out;
}
