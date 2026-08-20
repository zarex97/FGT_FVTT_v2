/**
 * @file The ability editor.
 * @see docs/29-user-interface.md §29.6, docs/22-data-models.md §22.6
 *
 * Layer 4. The tool §29.6 says determines whether **SC-6** is met — a GM
 * authors a Karna-complexity Servant in under an hour.
 *
 * The piece §29.6 says matters most is the **targeting picker**: a GM should
 * never have to know that `selfEdgeAdjacent` is the internal name for "a 5×5
 * area in any non-diagonal direction next to the caster" — they should see the
 * shapes and click one. So anchors and shapes are presented as labelled options
 * with a schematic preview, and the internal name is what gets written, never
 * what gets read.
 *
 * **Live validation asks the engine itself.** Not the content build's
 * validator: `tools/lib/content.mjs` already imports from `module/`, so
 * importing it back would invert the layer graph. Instead every check here
 * consults the authority the engine actually uses at runtime -- `handledKeys()`
 * for rule elements, `EffectRegistry` for effect ids, `parseTick` for
 * durations, `SHAPE_IDS` for targeting. Those are the checks that decide
 * whether an ability *does anything*, which is the failure this editor exists
 * to prevent. CI remains authoritative for the rest, and a drift test holds the
 * two vocabularies together in both directions.
 */

import { handledKeys } from "../rules/elements.mjs";
import { TARGET_ANCHORS, TARGET_SHAPES, SHAPE_IDS, ANCHOR_IDS } from "../rules/targeting/vocabulary.mjs";
import { EffectRegistry } from "../rules/registry.mjs";
import { parseTick } from "../domain/tick.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class AbilityEditor extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "fgt-ability-editor",
    classes: ["fgt", "ability-editor"],
    tag: "form",
    position: { width: 780, height: 720 },
    window: { title: "FGT.Editor.Title", resizable: true },
    form: { handler: AbilityEditor.#onChange, submitOnChange: true, closeOnSubmit: false },
    actions: {
      addPhase: AbilityEditor.#onAddPhase,
      removePhase: AbilityEditor.#onRemovePhase,
      movePhase: AbilityEditor.#onMovePhase,
      pickAnchor: AbilityEditor.#onPickAnchor,
      pickShape: AbilityEditor.#onPickShape,
      save: AbilityEditor.#onSave,
    },
  };

  static PARTS = {
    body: { template: "systems/fgt/templates/apps/ability-editor.hbs", scrollable: [".fgt-editor__body"] },
  };

  /** @type {object} the Item being edited */
  #item;

  /** @type {object} the working copy — nothing is written until Save */
  #draft;

  /** @param {object} item */
  constructor(item) {
    super();
    this.#item = item;
    this.#draft = foundry.utils.deepClone(item.system ?? {});
  }

  /**
   * @param {object} item an ability or Noble Phantasm Item
   * @returns {AbilityEditor}
   */
  static open(item) {
    const app = new AbilityEditor(item);
    app.render(true);
    return app;
  }

  /** @inheritdoc */
  async _prepareContext() {
    const report = this.#validate();

    return {
      name: this.#item.name,
      draft: this.#draft,

      // The three NP-scoping flags sit behind a disclosure that defaults to the
      // derived values (§29.6): they are the flags most often set wrongly, and
      // the derived answer is right almost always.
      advanced: {
        isNP: Boolean(this.#draft.isNP),
        categorizedAsNP: this.#draft.categorizedAsNP ?? Boolean(this.#draft.isNP),
        countsForNPSeal: this.#draft.countsForNPSeal ?? Boolean(this.#draft.isNP),
      },

      phases: (this.#draft.phases ?? []).map((p, index) => ({
        ...p, index, isFirst: index === 0,
        isLast: index === (this.#draft.phases ?? []).length - 1,
      })),

      // Illustrated, not named. See the file comment.
      anchors: TARGET_ANCHORS.map((a) => ({
        ...a, selected: this.#draft.targeting?.anchor === a.id,
      })),
      shapes: TARGET_SHAPES.map((sh) => ({
        ...sh, selected: this.#draft.targeting?.shape === sh.id,
      })),

      elementKeys: handledKeys().sort(),
      effects: EffectRegistry.all().map((d) => ({ id: d.id, name: d.name })),

      // "1◈+⅔◈ shows = 5 turns at 3 turns/round" — the duration field explains
      // itself as you type, because tick arithmetic is the thing authors get
      // wrong and the notation gives no hint.
      durationHint: this.#durationHint(),

      problems: report.problems,
      warnings: report.warnings,
      valid: report.problems.length === 0,
    };
  }

  /**
   * Check the draft against what the engine can actually execute.
   *
   * Every rule here answers the same question in a different place: **will this
   * do anything at play time?** An unknown element key, a missing effect id and
   * an unimplemented shape all produce the same failure -- an ability that
   * authors cleanly, compiles, loads, and silently does nothing -- which is the
   * defect this project produces more than any other.
   *
   * @returns {{problems: string[], warnings: string[]}}
   */
  #validate() {
    /** @type {string[]} */ const problems = [];
    /** @type {string[]} */ const warnings = [];
    const known = new Set(handledKeys());

    for (const [where, el] of this.#elements()) {
      if (!el.key) {
        problems.push(game.i18n.format("FGT.Editor.NoKey", { where }));
        continue;
      }
      if (!known.has(el.key)) {
        problems.push(game.i18n.format("FGT.Editor.UnknownKey", { where, key: el.key }));
      }
      // §24.6: an explicit priority reorders the element against its whole
      // band, so it must say why.
      if (el.priority !== undefined && !String(el["@intentional"] ?? "").trim()) {
        problems.push(game.i18n.format("FGT.Editor.NeedsIntentional", { where }));
      }
    }

    for (const [where, id] of this.#effectIds()) {
      if (!EffectRegistry.get(id)) {
        problems.push(game.i18n.format("FGT.Editor.UnknownEffect", { where, id }));
      }
    }

    const targeting = this.#draft.targeting ?? null;
    if (targeting?.shape && !SHAPE_IDS.includes(targeting.shape?.kind ?? targeting.shape)) {
      problems.push(game.i18n.format("FGT.Editor.UnknownShape", { shape: targeting.shape?.kind ?? targeting.shape }));
    }
    if (targeting?.anchor && !ANCHOR_IDS.includes(targeting.anchor?.kind ?? targeting.anchor)) {
      problems.push(game.i18n.format("FGT.Editor.UnknownAnchor", { anchor: targeting.anchor?.kind ?? targeting.anchor }));
    }

    for (const [where, value] of [["duration", this.#draft.duration], ["cooldown", this.#draft.cooldown?.value]]) {
      if (!value) continue;
      try {
        parseTick(String(value));
      } catch (err) {
        problems.push(game.i18n.format("FGT.Editor.BadTick", { where, message: err.message }));
      }
    }

    // A phaseless, ruleless ability is legal -- a pure flavour entry -- but it
    // is far more often a half-finished one, so it warns rather than refuses.
    if ((this.#draft.phases ?? []).length === 0 && this.#elements().length === 0) {
      warnings.push(game.i18n.localize("FGT.Editor.DoesNothing"));
    }

    return { problems, warnings };
  }

  /** @returns {Array<[string, object]>} */
  #elements() {
    return ["rules", "passiveRules", "activeRules"].flatMap(
      (bucket) => (this.#draft[bucket] ?? []).map((el, k) => [`${bucket}[${k}]`, el]),
    );
  }

  /** @returns {Array<[string, string]>} */
  #effectIds() {
    return (this.#draft.phases ?? []).flatMap((phase, p) =>
      (phase.rules ?? [])
        .map((rule, r) => [`phases[${p}].rules[${r}]`, rule.effect?.id])
        .filter(([, id]) => Boolean(id)));
  }

  /** @returns {string|null} */
  #durationHint() {
    const raw = this.#draft.duration ?? this.#draft.cooldown?.value ?? null;
    if (!raw) return null;
    try {
      const tick = parseTick(String(raw));
      const perRound = game.settings.get("fgt", "turnsPerRound") ?? 3;
      return game.i18n.format("FGT.Editor.DurationHint", {
        turns: tick.rounds * perRound + tick.turns, perRound,
      });
    } catch (err) {
      return game.i18n.format("FGT.Editor.DurationBad", { message: err.message });
    }
  }

  /* ── Handlers ───────────────────────────────────────────────────────────── */

  /**
   * @this {AbilityEditor}
   * @param {SubmitEvent} _event
   * @param {HTMLFormElement} _form
   * @param {object} formData
   */
  static async #onChange(_event, _form, formData) {
    foundry.utils.mergeObject(this.#draft, foundry.utils.expandObject(formData.object));
    this.render();
  }

  /** @this {AbilityEditor} */
  static #onAddPhase() {
    this.#draft.phases = [...(this.#draft.phases ?? []), { kind: "damage" }];
    this.render();
  }

  /**
   * @this {AbilityEditor}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static #onRemovePhase(_event, target) {
    const index = Number(target.closest("[data-index]")?.dataset.index);
    this.#draft.phases = (this.#draft.phases ?? []).filter((_, k) => k !== index);
    this.render();
  }

  /**
   * Reorder a phase.
   *
   * Phases are **ordered**, and the order is the ability: an `applyEffects`
   * before its `damage` applies to a unit that has not been hit yet.
   *
   * @this {AbilityEditor}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static #onMovePhase(_event, target) {
    const index = Number(target.closest("[data-index]")?.dataset.index);
    const delta = target.dataset.direction === "up" ? -1 : 1;
    const phases = [...(this.#draft.phases ?? [])];
    const to = index + delta;
    if (to < 0 || to >= phases.length) return;

    [phases[index], phases[to]] = [phases[to], phases[index]];
    this.#draft.phases = phases;
    this.render();
  }

  /**
   * @this {AbilityEditor}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static #onPickAnchor(_event, target) {
    this.#draft.targeting = { ...(this.#draft.targeting ?? {}), anchor: target.dataset.anchorId };
    this.render();
  }

  /**
   * @this {AbilityEditor}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static #onPickShape(_event, target) {
    this.#draft.targeting = { ...(this.#draft.targeting ?? {}), shape: target.dataset.shapeId };
    this.render();
  }

  /**
   * Write the draft back.
   *
   * Refused while the validator has problems. An ability that cannot compile is
   * one that will load into a compendium and do nothing — the failure this
   * project produces most often — and catching it here is the entire point of
   * running the build's checks live.
   *
   * @this {AbilityEditor}
   */
  static async #onSave() {
    const report = this.#validate();
    if (report.problems.length > 0) {
      ui.notifications.error(game.i18n.format("FGT.Editor.CannotSave", { count: report.problems.length }));
      return;
    }

    await this.#item.update({ system: this.#draft });
    ui.notifications.info(game.i18n.format("FGT.Editor.Saved", { name: this.#item.name }));
    await this.close();
  }
}
