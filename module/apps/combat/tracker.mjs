/**
 * @file The combat tracker — a match is a list of factions, not of tokens.
 * @see docs/25-turn-system.md §25.1
 *
 * Layer 4.
 *
 * Foundry's tracker is built around tokens: you select tokens, toggle their
 * combat state, and each becomes a combatant with its own initiative. F/GT's
 * turn belongs to a **player** who then moves up to four Servants and three
 * Masters within it (D25.1), so a combatant here is a faction and adding
 * tokens to the tracker produces something the turn system does not recognise.
 *
 * Without a way to create the right kind of combatant, a match had none at all:
 * `combat.combatant` was undefined, so the HUD showed "No Faction", the
 * turn-state reset skipped every unit, the budget was filed under the key
 * `null`, and Foundry's `nextTurn` — finding no turns to advance through — fell
 * straight into `nextRound` on every click.
 *
 * The affordance is borrowed from the Universal Tabletop System's
 * `CombatTracker#addPlayer`, which solves the same problem for the same reason:
 * a context-menu entry on the tracker that creates a combatant from a *user*
 * rather than a token. Here it creates one from a faction, because that is what
 * F/GT gives turns to.
 */

import { factions } from "../../engine/board.mjs";

export class FGTCombatTracker extends foundry.applications.sidebar.tabs.CombatTracker {
  /** @inheritdoc */
  _getCombatContextOptions() {
    const options = super._getCombatContextOptions();

    // Unshifted rather than pushed: on a fresh match these are the only two
    // entries that do anything, so they should not be below "Clear Movement
    // History" in a menu the GM is opening precisely because nothing works yet.
    options.unshift(
      {
        name: "FGT.Combat.AddAllFactions",
        icon: '<i class="fa-solid fa-users"></i>',
        condition: () => game.user.isGM && factions().length > 0,
        callback: () => this.viewed?.syncFactions({ withGM: true }),
      },
      {
        name: "FGT.Combat.AddFaction",
        icon: '<i class="fa-solid fa-flag"></i>',
        condition: () => game.user.isGM && factions().length > 0,
        callback: () => promptForFaction(this.viewed),
      },
    );
    return options;
  }

  /**
   * Create the match, then offer to populate it.
   *
   * A combat with no factions in it cannot take a turn, and the GM has no
   * reason to expect that — the tracker looks the same as any other system's.
   * Asking once, here, is cheaper than the twenty minutes of confusing symptoms
   * that follow an empty match.
   *
   * @inheritdoc
   */
  async _onCombatCreate(event, target) {
    await super._onCombatCreate(event, target);
    const combat = this.viewed;
    if (!combat || !game.user.isGM) return;

    const roster = factions();
    if (roster.length === 0) {
      ui.notifications.warn(game.i18n.localize("FGT.Combat.NoRoster"), { permanent: true });
      return;
    }
    if (combat.factionCombatants.length > 0) return;

    const populate = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("FGT.Combat.PopulateTitle") },
      content: `<p>${game.i18n.format("FGT.Combat.PopulateBody", {
        count: roster.length,
        names: roster.map((f) => f.name).join(", "),
      })}</p>`,
      rejectClose: false,
    });
    if (populate) await combat.syncFactions({ withGM: true });
  }
}

/**
 * Ask which faction to add, then add it.
 *
 * Only factions not already in the match are offered: an entry that reports
 * "already in this combat" is an entry that should not have been offered.
 *
 * @param {object|null} combat
 * @returns {Promise<void>}
 */
async function promptForFaction(combat) {
  if (!combat) return;
  const present = new Set(combat.combatants.map((c) => c.system?.factionId).filter(Boolean));
  const available = factions().filter((f) => !present.has(f.id));

  if (available.length === 0) {
    ui.notifications.info(game.i18n.localize("FGT.Combat.AllFactionsIn"));
    return;
  }

  const options = available
    .map((f) => `<option value="${f.id}">${foundry.utils.escapeHTML(f.name)}</option>`)
    .join("");

  const result = await foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n.localize("FGT.Combat.AddFaction") },
    content: `<div class="form-group">
      <label>${game.i18n.localize("FGT.Sheet.Faction")}</label>
      <select name="factionId">${options}</select>
    </div>`,
    ok: {
      label: game.i18n.localize("FGT.Combat.Add"),
      callback: (_event, button) => button.form.elements.factionId.value,
    },
    rejectClose: false,
  });

  if (result) await combat.addFaction(result);
}

/** Register the tracker. Called at `init`. */
export function registerCombatTracker() {
  CONFIG.ui.combat = FGTCombatTracker;
}
