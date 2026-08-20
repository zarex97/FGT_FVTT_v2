/**
 * @file The contract dialog.
 * @see docs/16-relationships.md §16.2
 *
 * Layer 4. Lists every Servant on the board with what contracting it would
 * take — and, when it cannot be attempted, **why**.
 *
 * Showing the refusals is the point. "Why can I not contract that one" has four
 * different answers here (too far, an enemy is watching, it is already
 * contracted, Independent Action refuses outright), and a dialog that simply
 * omitted the ineligible rows would answer all four with silence. The
 * enemy-proximity rule in particular is invisible on the board.
 */

import { contractCandidates, attemptContract } from "../engine/contract.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class ContractDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "fgt-contract-dialog",
    classes: ["fgt", "contract-dialog"],
    tag: "form",
    position: { width: 560, height: "auto" },
    window: { title: "FGT.Contract.Title", resizable: true },
    actions: { attempt: ContractDialog.#onAttempt },
  };

  static PARTS = {
    body: { template: "systems/fgt/templates/apps/contract-dialog.hbs", scrollable: [".fgt-contract__list"] },
  };

  /** @type {string} */
  #contractorId;

  /** @param {string} contractorId */
  constructor(contractorId) {
    super();
    this.#contractorId = contractorId;
  }

  /**
   * @param {string} contractorId a Master, or a Caster
   * @returns {ContractDialog}
   */
  static open(contractorId) {
    const app = new ContractDialog(contractorId);
    app.render(true);
    return app;
  }

  /** @inheritdoc */
  async _prepareContext() {
    const candidates = contractCandidates(this.#contractorId);

    return {
      contractor: game.actors.get(this.#contractorId)?.name ?? this.#contractorId,
      isEmpty: candidates.length === 0,
      candidates: candidates.map((c) => ({
        ...c,
        // The odds, stated. "3 × 1d6, all must succeed, succeeds on 5–6" is a
        // decision a player can make; "roll to contract" is not.
        terms: c.automatic
          ? game.i18n.localize("FGT.Contract.Automatic")
          : game.i18n.format("FGT.Contract.Rolls", { n: c.rolls }),
        odds: c.automatic || !c.ok
          ? null
          : game.i18n.format("FGT.Contract.SucceedsOn", { values: c.succeedsOn.join(", ") }),
        refusal: c.reason ? game.i18n.localize(`FGT.Contract.Refusal.${c.reason}`) : null,
      })),
    };
  }

  /**
   * @this {ContractDialog}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onAttempt(_event, target) {
    const servantId = target.closest("[data-servant-id]")?.dataset.servantId;
    if (!servantId) return;

    const out = await attemptContract({ contractorId: this.#contractorId, servantId });
    if (!out.ok) {
      ui.notifications.warn(game.i18n.localize(`FGT.Contract.Refusal.${out.reason}`));
      return;
    }

    const name = game.actors.get(servantId)?.name ?? servantId;
    if (out.success) ui.notifications.info(game.i18n.format("FGT.Contract.Succeeded", { name }));
    else ui.notifications.warn(game.i18n.format("FGT.Contract.Failed", { rolls: out.rolls.join(", ") }));

    this.render();
  }
}
