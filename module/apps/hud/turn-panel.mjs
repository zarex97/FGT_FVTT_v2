/**
 * @file The turn panel — budget pips, compulsion warnings, and the End Turn gate.
 * @see docs/18-action-economy.md §18.9, docs/29-user-interface.md
 *
 * Layer 4. Reads snapshots and the budget flag; every write goes through the
 * engine.
 *
 * No longer an application of its own. It is the right-hand segment of
 * `hud/action-bar.mjs`, so this module supplies a context builder and three
 * handlers and the bar does the rendering.
 *
 * The whole point of this panel is the third section. Compulsions are
 * turn-scoped constraints (D18.4), so a player can only discover they have
 * violated one *after* committing the actions that violated it. Showing them
 * from the moment they apply — rather than as an error when End Turn is
 * clicked — is what turns a frustrating rule into a legible one.
 */

import * as budget from "../../engine/budget.mjs";
import { remainingMovement, effectiveMov, segmentCheck } from "../../rules/movement.mjs";
import { unitSnapshot, factionOfUser, faction as factionById } from "../../engine/board.mjs";

/**
 * The turn panel's context: the acting faction, its budget, and the End Turn
 * gate with the compulsions that block it.
 *
 * This used to be `TurnHUD._prepareContext` on an `ApplicationV2` of its own.
 * The panel is now the right-hand segment of `hud/action-bar.mjs` rather than
 * a second floating window, so the logic is a function and the rendering
 * belongs to the bar. Nothing about WHAT it computes changed.
 *
 * It stays FACTION-scoped while the rest of the bar is unit-scoped: the End
 * Turn gate is about the faction's whole budget, not about whichever token
 * happens to be selected. Adjacency is not merging.
 *
 * @returns {Promise<object>}
 */
export async function turnContext() {
  const combat = game.combats.active;
  const factionId = actingFaction(combat);
  const units = factionUnits(factionId);
  const verdict = budget.endTurnVerdict(combat, factionId, units);

  return {
    active: Boolean(combat?.started),
    factionName: factionLabel(combat, factionId),
    factionColor: factionById(factionId)?.color ?? null,
    round: combat?.round ?? 1,
    // Which faction's turn this is within the Round -- NOT the ◈ tick. The
    // two were the same field, so a two-faction match on Round 1 announced
    // "Turn 2 of 3" using the monotonic tick and the ◈ constant.
    turn: combat?.turnPosition?.position ?? 0,
    turnsThisRound: combat?.turnPosition?.total ?? 0,
    // The ◈ tick, shown separately because every duration in the game is
    // quoted in it and a player reading "Burn 3◈" needs to see it somewhere.
    tick: combat?.system?.globalTurn ?? 0,
    turnsPerRound: turnsPerRound(),
    rows: budget.rows(combat, factionId),
    units: units.map((u) => ({
      id: u.id,
      name: u.name,
      moved: Boolean(u.turnState?.moved),
      attacked: Boolean(u.turnState?.attacked),
      movementLeft: remainingMovement(u),
      mov: effectiveMov(u),
      // Why the move button is unavailable, when it is -- Riding's second
      // segment waiting on an attack is the case a player cannot guess.
      moveBlocked: segmentCheck(u),
    })),
    unmet: verdict.unmet,
    canEndTurn: verdict.ok,
    isMyTurn: controlsFaction(factionId),

    // Turn order, with the delay each faction has declared. Shown to
    // everybody: Delay is a public declaration, and a player deciding whether
    // to delay needs to see who they would end up behind.
    order: turnOrderRows(combat),
    delay: combat?.system?.delays?.[factionId] ?? 0,
    // Delaying past the last pending faction does nothing, so the choices
    // stop there rather than offering a number with no effect.
    delayChoices: delayChoices(combat, factionId),
  };
}

/**
 * The panel's three controls, for the bar to spread into its own `actions`.
 *
 * Plain functions rather than static privates: they never used `this`, and the
 * application that owns them is now the bar.
 */
export const TURN_ACTIONS = Object.freeze({
  endTurn: onEndTurn,
  panTo: onPanTo,
  delay: onDelay,
});

/** @param {PointerEvent} _event */
async function onEndTurn(_event) {
  const combat = game.combats.active;
  const factionId = actingFaction(combat);
  const verdict = budget.endTurnVerdict(combat, factionId, factionUnits(factionId));
  if (!verdict.ok) {
    // Belt and braces: the button is already disabled, but a stale render
    // must not be able to skip the gate.
    ui.notifications.warn(verdict.unmet[0].message);
    return;
  }
  await combat.nextTurn();
}

/**
 * Declare `Delay+X`.
 *
 * Proxied through the GM like every other write to the Combat document: no
 * player owns it, and the authorizer checks the faction is theirs.
 *
 * @param {PointerEvent} _event
 * @param {HTMLElement} target
 */
async function onDelay(_event, target) {
  const combat = game.combats.active;
  const factionId = actingFaction(combat);
  const positions = Number(
    target.closest(".fgt-hud__delay")?.querySelector("select")?.value ?? 0,
  );

  const { FGTSocket } = await import("../../net/socket.mjs");
  try {
    await FGTSocket.request("delayTurn", { combatId: combat.id, factionId, positions });
  } catch (err) {
    ui.notifications.error(err.message);
  }
}

/**
 * @param {PointerEvent} _event
 * @param {HTMLElement} target
 */
function onPanTo(_event, target) {
  const id = target.dataset.unitId;
  const placed = canvas.tokens?.placeables.find((t) => t.actor?.id === id);
  if (placed) canvas.animatePan({ x: placed.center.x, y: placed.center.y });
}

/* -------------------------------------------------------------------------- */

/**
 * @param {object} combat
 * @returns {string|null}
 */
function actingFaction(combat) {
  return combat?.actingFactionId ?? null;
}

/**
 * @param {object} combat
 * @param {string|null} factionId
 * @returns {string}
 */
function factionLabel(combat, factionId) {
  return combat?.combatant?.name ?? factionId ?? game.i18n.localize("FGT.HUD.NoFaction");
}

/**
 * @param {string|null} factionId
 * @returns {object[]} unit snapshots
 */
function factionUnits(factionId) {
  if (!factionId) return [];
  return (canvas?.tokens?.placeables ?? [])
    .map((t) => (t.actor ? unitSnapshot(t.actor, t.document) : null))
    .filter((u) => u && u.factionId === factionId);
}

/**
 * @param {string|null} factionId
 * @returns {boolean}
 */
function controlsFaction(factionId) {
  if (!factionId) return false;
  if (game.user.isGM) return true;
  // The roster is where the GM assigned the player to the faction, so it is the
  // answer. Owning a unit of that faction still counts -- a player handed a
  // single Servant without a roster entry can still take its turn -- but it is
  // the fallback, not the test: checking only ownership meant a player properly
  // assigned to a faction was not recognised as controlling it.
  if (factionOfUser(game.user.id)?.id === factionId) return true;
  return game.actors.some(
    (a) => a.system?.factionId === factionId && a.testUserPermission(game.user, "OWNER"),
  );
}

/**
 * @returns {number}
 */
function turnsPerRound() {
  return game.settings.get("fgt", "turnsPerRound") || 3;
}

/**
 * The effective turn order, as rows the template can render.
 *
 * `system.turnOrder` is already the order after Delay — the document derives it
 * rather than mutating the roll — so this only labels it.
 *
 * @param {object} combat
 * @returns {Array<{id: string, name: string, acted: boolean, active: boolean, delay: number}>}
 */
function turnOrderRows(combat) {
  const order = combat?.system?.turnOrder ?? [];
  const taken = new Set(combat?.system?.takenThisRound ?? []);
  const delays = combat?.system?.delays ?? {};
  const active = actingFaction(combat);

  return order.map((id) => ({
    id,
    name: factionLabel(combat, id),
    acted: taken.has(id),
    active: id === active,
    delay: delays[id] ?? 0,
  }));
}

/**
 * How far this faction could usefully delay.
 *
 * Delaying past the last faction still to act does nothing — `computeTurnOrder`
 * clamps it — so offering `+5` when only two factions remain would be offering a
 * choice with no consequence.
 *
 * @param {object} combat
 * @param {string|null} factionId
 * @returns {number[]}
 */
function delayChoices(combat, factionId) {
  const taken = new Set(combat?.system?.takenThisRound ?? []);
  const pending = (combat?.system?.baseOrder ?? []).filter((id) => !taken.has(id));
  const max = Math.max(0, pending.length - 1);
  if (!factionId || max === 0) return [];
  return Array.from({ length: max + 1 }, (_, n) => n);
}
