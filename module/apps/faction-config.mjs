/**
 * @file The GM's faction roster editor.
 * @see docs/04-units.md §4.10
 *
 * Layer 4. Create factions, colour them, assign a player to each, and declare
 * alliances. Every unit sheet then picks from this list rather than accepting
 * free text, because two units whose faction strings differ by a typo are
 * enemies — silently, and with no way for the player to see why.
 *
 * Assigning a **player** to a faction is what makes the roster more than a
 * label: the turn HUD, the budget authorizer and the GM proxy all need to know
 * whose turn a faction's turn is.
 */

import * as board from "../engine/board.mjs";
import { createFaction, FACTION_COLORS } from "../rules/factions.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class FactionConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "fgt-faction-config",
    classes: ["fgt", "faction-config"],
    tag: "form",
    position: { width: 560, height: "auto" },
    window: { title: "FGT.Factions.Title", resizable: true },
    form: { handler: FactionConfig.#onSubmit, submitOnChange: true, closeOnSubmit: false },
    actions: {
      addFaction: FactionConfig.#onAdd,
      deleteFaction: FactionConfig.#onDelete,
    },
  };

  static PARTS = {
    body: { template: "systems/fgt/templates/apps/faction-config.hbs", scrollable: [""] },
  };

  /** @inheritdoc */
  async _prepareContext() {
    const factions = board.factions();
    return {
      factions: factions.map((f) => ({
        ...f,
        // Every other faction, so alliances can be ticked off. A faction is
        // never offered as its own ally.
        others: factions.filter((o) => o.id !== f.id)
          .map((o) => ({ ...o, allied: f.allies.includes(o.id) })),
      })),
      players: game.users.filter((u) => !u.isGM).map((u) => ({ id: u.id, name: u.name })),
      colors: FACTION_COLORS,
      isEmpty: factions.length === 0,
    };
  }

  /**
   * Read every row back out of the form.
   *
   * The whole roster is rewritten on every change rather than patched, because
   * alliances are symmetric: ticking "red allies blue" has to write blue's row
   * too, and a patch that touches one row cannot do that.
   *
   * @this {FactionConfig}
   * @param {SubmitEvent} _event
   * @param {HTMLFormElement} form
   * @param {object} formData
   * @returns {Promise<void>}
   */
  static async #onSubmit(_event, form, formData) {
    const data = foundry.utils.expandObject(formData.object);
    const rows = Object.entries(data.factions ?? {}).map(([id, row]) => ({
      id,
      name: row.name,
      color: row.color,
      userId: row.userId || null,
      allies: Object.entries(row.allies ?? {}).filter(([, on]) => on).map(([ally]) => ally),
    }));
    await board.setFactions(rows);
    this.render();
  }

  /**
   * @this {FactionConfig}
   */
  static async #onAdd() {
    const existing = board.factions();
    const name = game.i18n.format("FGT.Factions.NewName", { n: existing.length + 1 });
    await board.setFactions([...existing, createFaction(name, existing)]);
    this.render();
  }

  /**
   * Deleting a faction leaves its units pointing at an id that no longer
   * exists, which reads as "no faction" — the same as never having set one. The
   * confirmation says how many units that is, because it is not recoverable by
   * undoing the delete.
   *
   * @this {FactionConfig}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onDelete(_event, target) {
    const id = target.closest("[data-faction-id]")?.dataset.factionId;
    if (!id) return;

    const orphans = game.actors.filter((a) => a.system?.factionId === id);
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("FGT.Factions.DeleteTitle") },
      content: `<p>${game.i18n.format("FGT.Factions.DeleteWarn", {
        name: board.faction(id)?.name ?? id,
        count: orphans.length,
      })}</p>`,
    });
    if (!confirmed) return;

    await board.setFactions(board.factions().filter((f) => f.id !== id));
    this.render();
  }
}

/**
 * Register the settings menu that opens this.
 * Called from `registerSettings`.
 */
export function registerFactionMenu() {
  game.settings.registerMenu("fgt", "factionConfig", {
    name: "FGT.Factions.MenuName",
    label: "FGT.Factions.MenuLabel",
    hint: "FGT.Factions.MenuHint",
    icon: "fa-solid fa-flag",
    type: FactionConfig,
    restricted: true,
  });
}
