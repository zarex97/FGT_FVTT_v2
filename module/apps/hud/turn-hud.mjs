/**
 * @file The turn HUD — budget pips, compulsion warnings, and the End Turn gate.
 * @see docs/18-action-economy.md §18.9, docs/29-user-interface.md
 *
 * Layer 4. Reads snapshots and the budget flag; every write goes through the
 * engine.
 *
 * The whole point of this panel is the third section. Compulsions are
 * turn-scoped constraints (D18.4), so a player can only discover they have
 * violated one *after* committing the actions that violated it. Showing them
 * from the moment they apply — rather than as an error when End Turn is
 * clicked — is what turns a frustrating rule into a legible one.
 */

import * as budget from "../../engine/budget.mjs";
import { remainingMovement, effectiveMov, segmentCheck } from "../../rules/movement.mjs";
import { unitSnapshot } from "../../engine/board.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class TurnHUD extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "fgt-turn-hud",
    classes: ["fgt", "turn-hud"],
    position: { width: 300, height: "auto" },
    window: { title: "FGT.HUD.Title", minimizable: true, resizable: false },
    actions: {
      endTurn: TurnHUD.#onEndTurn,
      panTo: TurnHUD.#onPanTo,
    },
  };

  static PARTS = {
    body: { template: "systems/fgt/templates/hud/turn.hbs" },
  };

  /** The singleton. There is one turn at a time, so there is one HUD. */
  static #instance = null;

  /**
   * Show the HUD and keep it current.
   *
   * Re-renders on the three things that can change what it displays: the turn
   * advancing, the budget being spent, and an effect being applied or removed
   * (which is how a compulsion appears mid-turn).
   *
   * @returns {TurnHUD}
   */
  static attach() {
    TurnHUD.#instance ??= new TurnHUD();
    const refresh = () => {
      if (game.combats?.active?.started) TurnHUD.#instance.render({ force: true });
      else TurnHUD.#instance.close();
    };

    Hooks.on("combatTurnChange", refresh);
    Hooks.on("combatStart", refresh);
    Hooks.on("deleteCombat", () => TurnHUD.#instance.close());
    Hooks.on("fgtBudgetChanged", refresh);
    Hooks.on("createActiveEffect", refresh);
    Hooks.on("deleteActiveEffect", refresh);

    refresh();
    return TurnHUD.#instance;
  }

  /** @inheritdoc */
  async _prepareContext() {
    const combat = game.combats.active;
    const factionId = actingFaction(combat);
    const units = factionUnits(factionId);
    const verdict = budget.endTurnVerdict(combat, factionId, units);

    return {
      factionName: factionLabel(combat, factionId),
      round: combat?.round ?? 1,
      turn: (combat?.system?.globalTurn ?? 0) % turnsPerRound() + 1,
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
        moveBlocked: segmentCheck(u, hasRiding(u)),
      })),
      unmet: verdict.unmet,
      canEndTurn: verdict.ok,
      isMyTurn: controlsFaction(factionId),
    };
  }

  /**
   * @this {TurnHUD}
   * @param {PointerEvent} _event
   */
  static async #onEndTurn(_event) {
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
   * @this {TurnHUD}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static #onPanTo(_event, target) {
    const id = target.dataset.unitId;
    const token = canvas.tokens?.placeables.find((t) => t.actor?.id === id);
    if (token) canvas.animatePan({ x: token.center.x, y: token.center.y });
  }
}

/* -------------------------------------------------------------------------- */

/**
 * Does this unit have Riding, and so a second movement segment?
 * @param {object} unit a snapshot
 * @returns {boolean}
 */
function hasRiding(unit) {
  const actor = game.actors.get(unit.id);
  return Boolean(actor?.items.some((i) => i.system?.slug === "riding" || i.name === "Riding"));
}

/**
 * @param {object} combat
 * @returns {string|null}
 */
function actingFaction(combat) {
  const c = combat?.combatant;
  return c?.system?.factionId ?? c?.id ?? null;
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
  if (game.user.isGM) return true;
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
