/**
 * @file Picking a fixed number of things from a curated list.
 * @see docs/15-abilities.md §15.7, docs/36-case-remaining.md §36.4
 *
 * Layer 4. Scáthach's player picking two of the abilities the GM offered is the
 * case this was written for, but nothing here knows that: it takes a list and a
 * count and returns ids.
 *
 * The count is enforced **here**, in the dialog, and again by the caller. The
 * answer crosses a socket from a client the GM does not control, so a dialog
 * that only disabled the button would be an honour system.
 */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class ChoiceDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "fgt-choice-dialog",
    classes: ["fgt", "choice-dialog"],
    tag: "form",
    position: { width: 560, height: "auto" },
    window: { title: "FGT.Choice.Title", resizable: true },
    actions: { toggle: ChoiceDialog.#onToggle, confirm: ChoiceDialog.#onConfirm },
  };

  static PARTS = {
    body: { template: "systems/fgt/templates/apps/choice-dialog.hbs", scrollable: [".fgt-choice__list"] },
  };

  /** @type {object} */
  #spec;

  /** @type {Set<string>} */
  #picked = new Set();

  /** @type {(value: string[]|null) => void} */
  #resolve;

  /**
   * Ask for a selection and resolve to the chosen ids.
   *
   * Resolves to `null` when the window is dismissed — declining is an answer,
   * and the caller decides what it means.
   *
   * @param {object} spec
   * @param {string} spec.title
   * @param {string} [spec.hint]
   * @param {number} spec.count the most that may be picked
   * @param {number} [spec.min] the fewest; defaults to `count`, i.e. "exactly"
   * @param {Array<{id: string, name: string, subtitle?: string, detail?: string}>} spec.options
   * @returns {Promise<string[]|null>}
   */
  static pick(spec) {
    return new Promise((resolve) => {
      const app = new ChoiceDialog(spec, resolve);
      app.render(true);
    });
  }

  /**
   * @param {object} spec
   * @param {(value: string[]|null) => void} resolve
   */
  constructor(spec, resolve) {
    super({ window: { title: spec.title || "FGT.Choice.Title" } });
    this.#spec = spec;
    this.#resolve = resolve;
  }

  /**
   * The fewest picks this question accepts.
   *
   * `min` has been passed by four call sites since they were written and this
   * dialog never read it, so every one of them was an **exactly-N** question:
   * Jack's pre-emption, the attacker's timing window, Mannanán's optional token
   * spend and her optional revival all say `min: 0`, and all four could only be
   * declined by dismissing the window. Confirm warned and refused.
   *
   * That is not a cosmetic defect. Declining is a legitimate answer to all four
   * -- an `OptionalCost` is a trade the player is meant to weigh -- and a
   * dialog whose only "no" is the X teaches that pressing the obvious button
   * does nothing.
   *
   * Defaults to `count`, so Scáthach's "pick exactly two" is unchanged.
   *
   * @returns {number}
   */
  get #min() {
    const count = this.#spec.count ?? 1;
    return Math.min(this.#spec.min ?? count, count);
  }

  /** @inheritdoc */
  async _prepareContext() {
    const count = this.#spec.count ?? 1;
    const min = this.#min;
    return {
      hint: this.#spec.hint ?? "",
      count,
      min,
      optional: min === 0,
      remaining: Math.max(0, min - this.#picked.size),
      complete: this.#picked.size >= min,
      options: (this.#spec.options ?? []).map((o) => ({ ...o, picked: this.#picked.has(o.id) })),
    };
  }

  /**
   * A dismissed window is a declined question, not a lost one: the asker is
   * blocked on this promise and would otherwise wait for its timeout.
   *
   * @inheritdoc
   */
  async close(options) {
    this.#resolve?.(null);
    this.#resolve = null;
    return super.close(options);
  }

  /**
   * @this {ChoiceDialog}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static #onToggle(_event, target) {
    const id = target.closest("[data-option-id]")?.dataset.optionId;
    if (!id) return;

    if (this.#picked.has(id)) this.#picked.delete(id);
    // Picking past the limit replaces nothing and refuses quietly; silently
    // dropping the oldest pick would change a choice the player made.
    else if (this.#picked.size < (this.#spec.count ?? 1)) this.#picked.add(id);
    else {
      ui.notifications.warn(game.i18n.format("FGT.Choice.AtLimit", { count: this.#spec.count ?? 1 }));
      return;
    }
    this.render();
  }

  /**
   * @this {ChoiceDialog}
   */
  static async #onConfirm() {
    const count = this.#spec.count ?? 1;
    const min = this.#min;
    if (this.#picked.size < min) {
      ui.notifications.warn(min === count
        ? game.i18n.format("FGT.Choice.PickExactly", { count })
        : game.i18n.format("FGT.Choice.PickAtLeast", { count: min }));
      return;
    }
    const picked = [...this.#picked];
    // Cleared before closing, so `close` does not resolve the promise a second
    // time with a null that would overwrite the answer.
    this.#resolve?.(picked);
    this.#resolve = null;
    await this.close();
  }
}
