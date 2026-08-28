/**
 * @file The GM's summon dialog.
 * @see docs/37-content-pipeline.md §37.6, docs/14-checks-and-randomness.md §14.9
 *
 * Layer 4. `engine/summon.mjs` prepares, re-rolls and commits; this shows the
 * plan and collects the GM's decisions.
 *
 * §37.6 asks for one specific thing: *"Every line is shown before committing,
 * with a per-line re-roll for the GM. Once the match starts, the rolls are
 * locked."* That shape is why the engine operation is split into prepare →
 * re-roll → commit — a one-shot summon has already created the actor by the
 * time there is anything to show.
 *
 * Changing a dropdown does **not** re-roll. Grants apply after the rolls, so
 * nothing about a Master or a Region can change a die that was already thrown,
 * and re-rolling on every change would hand the GM new numbers each time they
 * touched a control.
 */

import {
  prepareSummon, rerollSummonLine, reviseSummon, commitSummon, servantCatalogue,
} from "../engine/summon.mjs";
import { REGION_ADJACENCY } from "../rules/environment.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** The parameters a Master's grant may raise. */
const PARAMETERS = Object.freeze(["str", "end", "agi", "mag", "luc"]);

export class SummonDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "fgt-summon-dialog",
    classes: ["fgt", "summon-dialog"],
    tag: "form",
    position: { width: 620, height: "auto" },
    window: { title: "FGT.Summon.Title", resizable: true },
    form: { handler: SummonDialog.#onChange, submitOnChange: true, closeOnSubmit: false },
    actions: {
      roll: SummonDialog.#onRoll,
      reroll: SummonDialog.#onReroll,
      confirm: SummonDialog.#onConfirm,
    },
  };

  static PARTS = {
    body: { template: "systems/fgt/templates/apps/summon-dialog.hbs", scrollable: [""] },
  };

  /** The prepared summon, or null before the first roll. @type {object|null} */
  #prepared = null;

  /** @type {Array<{contentId: string, name: string}>} */
  #catalogue = [];

  /** @type {{contentId: string|null, masterId: string|null, region: string, grants: object}} */
  #form = { contentId: null, masterId: null, region: "", grants: {} };

  /**
   * Open the dialog, optionally pre-selecting a Servant.
   * @param {object} [options]
   * @param {string} [options.contentId]
   * @returns {SummonDialog}
   */
  static open({ contentId = null } = {}) {
    const app = new SummonDialog();
    if (contentId) app.#form.contentId = contentId;
    app.render(true);
    return app;
  }

  /** @inheritdoc */
  async _prepareContext() {
    if (this.#catalogue.length === 0) this.#catalogue = await servantCatalogue();

    return {
      catalogue: this.#catalogue,
      form: this.#form,
      masters: game.actors.filter((a) => a.type === "master")
        .map((m) => ({ id: m.id, name: m.name })),
      // The curated Region graph is the authoritative list; free text here
      // would let a war be fought in a region no Servant can match.
      regions: Object.keys(REGION_ADJACENCY),
      parameters: PARAMETERS,
      grantRows: PARAMETERS.map((p) => ({
        key: p, label: p.toUpperCase(), value: this.#form.grants[p] ?? 0,
      })),

      prepared: this.#prepared
        ? {
            name: this.#prepared.source.name,
            img: this.#prepared.source.img,
            lines: this.#prepared.lines.map(describe),
            steps: this.#prepared.steps.map(describeStep),
            granted: this.#prepared.granted,
            hasGrants: Object.keys(this.#prepared.granted).length > 0,
          }
        : null,

      // "Once the match starts, the rolls are locked." Shown as a disabled
      // control with a reason rather than a hidden one, so a GM who expected a
      // re-roll button learns why it is not there.
      locked: Boolean(game.combat?.started),
      canRoll: Boolean(this.#form.contentId),
    };
  }

  /**
   * Read the controls back.
   *
   * A revision keeps the rolls (see the file comment); only a Servant change
   * discards them, because they were rolled against a different sheet.
   *
   * @this {SummonDialog}
   * @param {SubmitEvent} _event
   * @param {HTMLFormElement} _form
   * @param {object} formData
   */
  static async #onChange(_event, _form, formData) {
    const data = foundry.utils.expandObject(formData.object);
    const changedServant = data.contentId !== this.#form.contentId;

    this.#form = {
      contentId: data.contentId || null,
      masterId: data.masterId || null,
      region: data.region ?? "",
      grants: Object.fromEntries(PARAMETERS.map((p) => [p, Number(data.grants?.[p] ?? 0)])
        .filter(([, n]) => n > 0)),
    };

    if (changedServant) this.#prepared = null;
    else if (this.#prepared) {
      this.#prepared = reviseSummon(this.#prepared, {
        masterId: this.#form.masterId,
        warRegion: this.#form.region || null,
        masterGrants: this.#form.grants,
      });
    }
    this.render();
  }

  /**
   * @this {SummonDialog}
   */
  static async #onRoll() {
    if (!this.#form.contentId) return;

    this.#prepared = await prepareSummon({
      contentId: this.#form.contentId,
      masterId: this.#form.masterId,
      region: this.#form.region || null,
      masterGrants: this.#form.grants,
    });
    if (!this.#prepared) {
      ui.notifications.error(game.i18n.format("FGT.Summon.Unknown", { id: this.#form.contentId }));
      return;
    }
    this.render();
  }

  /**
   * @this {SummonDialog}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onReroll(_event, target) {
    const id = target.closest("[data-line-id]")?.dataset.lineId;
    if (!this.#prepared || !id) return;
    if (game.combat?.started) {
      ui.notifications.warn(game.i18n.localize("FGT.Summon.Locked"));
      return;
    }
    this.#prepared = await rerollSummonLine(this.#prepared, id);
    this.render();
  }

  /**
   * @this {SummonDialog}
   */
  static async #onConfirm() {
    if (!this.#prepared) return;

    const actor = await commitSummon(this.#prepared);
    ui.notifications.info(game.i18n.format("FGT.Summon.Created", { name: actor.name }));
    // Opened rather than only announced: the GM's next action is almost always
    // to look at the sheet they just made.
    actor.sheet?.render(true);
    await this.close();
  }
}

/* -------------------------------------------------------------------------- */

/**
 * One resolved line, for display.
 *
 * The arithmetic is shown, not just the result: "1000" tells a GM nothing about
 * whether to re-roll, and "18 + 2 (coin) = 20" tells them everything.
 *
 * @param {object} line
 * @returns {object}
 */
function describe(line) {
  // A summon variant's `applied` is a BRANCH ID (`rules/summon-variant.mjs`),
  // not a number added to a base — "null + NaN" is what the arithmetic below
  // would otherwise render for it, since there is no base to add it to.
  if (typeof line.applied === "string") {
    return {
      id: line.id, label: line.label, value: line.value,
      workings: `${line.roll.formula} → ${line.applied}`,
      rollable: Boolean(line.roll), note: line.note ?? null, unrolled: Boolean(line.unrolled),
    };
  }

  const parts = [String(line.base)];
  if (line.applied !== null && line.applied !== undefined) {
    // `applied`, not `rolled`: a tails 2d100 of 87 contributes −87, and showing
    // the unsigned die would render 250 − 87 = 163 as "250 + 87".
    parts.push(`${line.applied < 0 ? "−" : "+"} ${Math.abs(line.applied)} (${line.roll.formula})`);
  }
  if (line.granted) parts.push(`+ ${line.granted} granted`);

  return {
    id: line.id,
    label: line.label,
    value: line.value,
    workings: parts.join(" "),
    rollable: Boolean(line.roll),
    note: line.note ?? null,
    // A line nobody rolled resolves to its base rather than to NaN, and says
    // so — otherwise an unrolled line is indistinguishable from a rolled zero.
    unrolled: Boolean(line.unrolled),
  };
}

/**
 * One plan step, for display. The tree in §37.6, in order.
 * @param {object} step
 * @returns {object}
 */
function describeStep(step) {
  switch (step.kind) {
    case "rolls":
      return { label: game.i18n.localize("FGT.Summon.StepRolls"), detail: null };
    case "grant": {
      const steps = Object.entries(step.steps).map(([p, n]) => `${p.toUpperCase()} +${n}`).join(", ");
      const ba = [step.baseAttack?.str, step.baseAttack?.mag].some(Boolean)
        ? ` (BA +${step.baseAttack.str}/+${step.baseAttack.mag})`
        : ` (${game.i18n.localize("FGT.Summon.NoBA")})`;
      return { label: game.i18n.format("FGT.Summon.StepGrant", { source: step.source }), detail: steps + ba };
    }
    case "contract":
      return {
        label: game.i18n.localize("FGT.Summon.StepContract"),
        detail: game.actors.get(step.masterId)?.name ?? step.masterId,
      };
    default:
      return { label: game.i18n.localize("FGT.Summon.StepConfirm"), detail: null };
  }
}
