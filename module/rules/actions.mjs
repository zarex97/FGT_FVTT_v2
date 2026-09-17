/**
 * @file The unit-action registry — what a selected unit may DO, as data.
 * @see docs/34-action-bar.md, docs/19-action-economy.md
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
import { contains, membershipVerdict, canAttemptEscape } from "./bounded-fields.mjs";
import { remainingMovement } from "./movement.mjs";
import { boardablePlatform } from "./platforms.mjs";
import { mayAttemptEscape } from "./nameless-forest.mjs";

/**
 * The unit kinds that TAKE actions.
 *
 * A `structure` is a destructible object with Health and a panel — Medusa's
 * Bloodmarks are the first — and it does not move, attack, gather or face
 * anywhere. Selecting one offered all four, because these predicates asked
 * what a unit HAS and never what it IS.
 *
 * Platforms are in: the Hanging Gardens acts once per Turn (`actsOncePerTurn`),
 * so it is a unit that does things, not scenery.
 */
const ACTING_KINDS = Object.freeze(["servant", "master", "civilian", "summon", "platform"]);

/**
 * Does this unit take actions at all?
 * @param {object|null} unit
 * @returns {boolean}
 */
function acts(unit) {
  return Boolean(unit) && ACTING_KINDS.includes(unit.kind);
}

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
    available: (unit) => (acts(unit) && !hasGranted(unit, GRANTS.noNormalAttack) ? {} : null),
  },
  {
    id: "move",
    kind: "move",
    icon: "fa-solid fa-shoe-prints",
    label: "FGT.Action.Move",
    mode: "targeted",
    available: (unit) => (acts(unit) ? {} : null),
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
    available: (unit) => (acts(unit) && hasGranted(unit, GRANTS.ridingAttack) ? {} : null),
  },
  {
    id: "mark",
    kind: "mark",
    icon: "fa-solid fa-droplet",
    label: "FGT.Action.Mark",
    mode: "immediate",
    available: (unit, board) => {
      if (!acts(unit)) return null;
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
      if (!acts(unit)) return null;
      const owner = (board?.units ?? []).find(
        (u) => u.resources?.hgobConstruction && relationOf(u, unit, board) !== "enemy",
      );
      return owner ? { ownerId: owner.id } : null;
    },
  },
  {
    id: "carryMaster",
    // Bills NOTHING. *"Counts as only Moving one Unit"* -- the Servant's own
    // Move is the one that is paid for, and this button only decides whether
    // the Master comes with her.
    kind: null,
    icon: "fa-solid fa-person-walking-with-cane",
    label: "FGT.Action.CarryMaster",
    mode: "immediate",
    // Offered only when Riding's Passenger Seat is granted AND there is a
    // Master on the board to carry. The button's PRESENCE is the whole of the
    // skill's discoverability: nothing else on the sheet mentions it, and a
    // grant with no affordance is a rule players never learn they have.
    available: (unit, board) => {
      if (!acts(unit) || !hasGranted(unit, GRANTS.passengerSeat)) return null;
      const master = (board?.units ?? []).find(
        (u) => u.id === unit.masterId && u.kind === "master" && !u.defeated,
      );
      if (!master) return null;
      // `on` drives the button's pressed state, so the player can see at a
      // glance whether their Master is about to be taken along.
      return { on: unit.carriesMaster !== false, masterId: master.id };
    },
  },
  {
    // *"In order to Escape the Labyrinth, an enemy Unit must first Move to the
    // inner border of the Labyrinth. At this point, if that Unit does not have
    // any MOV left, it is unable to Escape on the same Turn; but if the Unit is
    // still able to Move at least 1 panel, it can attempt to Escape."*
    //
    // Bills NOTHING: the Move it is part of is already paid for, and the roll is
    // what the remaining movement buys. It is the affordance the ladder never
    // had -- `escapeAttempt` was complete, tested and called by nobody, while
    // `rules/movement.mjs` refused the exit outright (Ch. 46 §46.4-H).
    id: "escape",
    kind: null,
    icon: "fa-solid fa-door-open",
    label: "FGT.Action.Escape",
    mode: "immediate",
    available: (unit, board) => {
      if (!acts(unit)) return null;
      for (const field of board?.fields ?? []) {
        if (!contains(field, unit.panel, board)) continue;
        // Only a boundary that asks for a roll. A `free` exit needs no button
        // and a hard refusal must not grow one.
        if (membershipVerdict(field, unit, "exit", board).reason !== "rollRequired") continue;

        const veterans = (board?.units ?? []).filter(
          (u) => u.id !== unit.id && relationOf(u, unit, board) !== "enemy",
        );
        const gate = canAttemptEscape(field, unit, {
          movRemaining: remainingMovement(unit),
          adjacentVeterans: veterans,
        });
        // Offered even when the gate refuses, so the button can SAY why -- a
        // unit standing in the middle of the Labyrinth needs to learn that the
        // border is where this happens, and an absent button teaches nothing.
        return { fieldId: field.id, chance: gate.chance ?? null, blocked: gate.ok ? null : gate.reason };
      }
      return null;
    },
  },
  {
    // *"Once per Turn during its own Turn it may attempt a Luck Check to
    // remove every Token."* Nursery Rhyme's Nameless Forest is the only thing
    // in the game that kills by accumulation, its marker is authored
    // `unremovable` so no Cleanse can substitute, and this roll is the whole of
    // its counter-play -- which had no button, so a caught Unit had none at all
    // (#28).
    //
    // Bills NOTHING, like `escape`: the roll is the cost, and the attempt
    // counter is what limits it.
    id: "forestEscape",
    kind: null,
    icon: "fa-solid fa-tree",
    label: "FGT.Action.ForestEscape",
    mode: "immediate",
    available: (unit, board) => {
      if (!acts(unit)) return null;
      const gate = mayAttemptEscape(unit, board);
      // A Unit the forest has not caught has nothing to escape, so no button.
      // Every other refusal still shows one -- the `escape` reasoning exactly:
      // "already tried this Turn" and "not your Turn" are things a player needs
      // told, and an absent button teaches nothing.
      if (!gate.ok && gate.reason === "notAffected") return null;
      return { blocked: gate.ok ? null : gate.reason };
    },
  },
  {
    id: "facing",
    kind: null,
    icon: "fa-solid fa-location-arrow",
    label: "FGT.Action.Facing",
    mode: "dial",
    // Ch. 34 is explicit that setting facing must not end the turn, so it bills
    // no ActionKind at all.
    available: (unit) => (acts(unit) ? {} : null),
  },
  {
    // Bills nothing here, the same way `escape` does: the Move that put this
    // unit on the platform's footprint already paid for itself, and the roll
    // decides whether that Move succeeded in getting it aboard.
    //
    // `boardPlatform` (`engine/platforms.mjs`) implemented the whole sequence
    // -- the relation gate, the roll, the level move, bringing the Master --
    // and had no caller anywhere: no registry entry, no action bar button, no
    // `fgt.api` handle. Fixed as #24.
    id: "board",
    kind: null,
    icon: "fa-solid fa-ship",
    label: "FGT.Action.Board",
    mode: "immediate",
    available: (unit, board) => {
      if (!acts(unit)) return null;
      const platform = boardablePlatform(unit, board);
      return platform ? { platformId: platform.id } : null;
    },
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
