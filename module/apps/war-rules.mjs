/**
 * @file The War rules window: one War's rules, or the defaults a new War starts from.
 * @see docs/31-war-setup-and-summoning.md, CONTEXT.md (War Rules)
 *
 * Layer 4. Opened from the turn panel, it edits the War of the scene the GM is
 * looking at and no other (`engine/war.mjs#setWarRules`): two tables play two
 * Wars at once, and lengthening one table's Command Spell wait must not
 * lengthen the other's. A rule that would invalidate stored state is shown
 * disabled with its reason once the War has started, and refused if pressed.
 *
 * `WarRulesApp.Defaults` is the same window over the world's defaults, opened
 * from the settings menu. It says what it is: the next War starts from these,
 * and no War in play changes.
 *
 * The rows are `warRuleRows`, which the setup wizard's War tab renders too
 * (`templates/apps/war-rule-fields.hbs`), so the wizard and this window cannot
 * offer a rule two ways.
 */

import { WAR_RULES, warRuleEditable } from "../domain/war-rules.mjs";
import { currentWar, warRule, worldDefault, setWarRules, setWorldDefaults, sceneIdOfWar } from "../engine/war.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * One form row per War Rule.
 *
 * @param {(key: string) => unknown} valueOf the value to show
 * @param {{war?: object|null, keys?: string[]|null, prefix?: string, locked?: boolean}} [options]
 *   `keys` limits and orders the rows; `prefix` names the inputs (`rules.` by
 *   default); `locked` disables every row (a wizard on a started War's scene)
 * @returns {object[]}
 */
export function warRuleRows(valueOf, { war = null, keys = null, prefix = "rules.", locked = false } = {}) {
  const specs = keys
    ? keys.map((k) => WAR_RULES.find((r) => r.key === k)).filter(Boolean)
    : WAR_RULES.filter((r) => r.window !== false);
  const i18n = globalThis.game?.i18n;
  return specs.map((spec) => {
    const value = valueOf(spec.key);
    const editable = !locked && warRuleEditable(spec.key, war);
    return {
      key: spec.key,
      name: `${prefix}${spec.key}`,
      label: i18n?.localize(spec.name ?? spec.key) ?? spec.key,
      hint: spec.hint ? i18n?.localize(spec.hint) : null,
      isBoolean: spec.type === "boolean",
      isNumber: spec.type === "number" && !spec.choices,
      isSelect: Boolean(spec.choices),
      isText: spec.type === "string" && !spec.choices,
      value: value ?? "",
      checked: value === true,
      min: spec.range?.min ?? null,
      max: spec.range?.max ?? null,
      options: spec.choices
        ? Object.entries(spec.choices).map(([v, label]) => ({
          value: v, label: i18n?.localize(label) ?? label, selected: String(v) === String(value),
        }))
        : [],
      disabled: !editable,
      lockedReason: editable ? null : i18n?.localize("FGT.WarRules.LockedReason") ?? null,
    };
  });
}

export class WarRulesApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "fgt-war-rules",
    classes: ["fgt", "war-rules"],
    tag: "form",
    position: { width: 560, height: 640 },
    window: { title: "FGT.WarRules.Title", resizable: true },
    form: { handler: WarRulesApp.#onSubmit, submitOnChange: true, closeOnSubmit: false },
  };

  static PARTS = {
    body: { template: "systems/fgt/templates/apps/war-rules.hbs", scrollable: [".fgt-war-rules__rows"] },
  };

  /**
   * The War this window edits, fixed when it opens: the War of the scene the
   * GM was looking at. Switching scenes afterwards does not move the window
   * onto the other War.
   * @type {object|null}
   */
  war = null;

  /** Whether this window edits the world's defaults instead of a War. */
  get defaults() {
    return false;
  }

  /**
   * Open over the War of the scene the GM is looking at.
   * @returns {WarRulesApp|null}
   */
  static open() {
    if (!game.user.isGM) {
      ui.notifications.warn(game.i18n.localize("FGT.WarRules.GMOnly"));
      return null;
    }
    const war = currentWar();
    if (!war) {
      ui.notifications.warn(game.i18n.localize("FGT.WarRules.NoWar"));
      return null;
    }
    const app = new WarRulesApp({ id: `fgt-war-rules-${war.id}` });
    app.war = war;
    app.render(true);
    return app;
  }

  /** @inheritdoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const war = this.defaults ? null : (this.war ? game.combats.get(this.war.id) ?? this.war : null);
    const valueOf = this.defaults ? worldDefault : (key) => warRule(key, war);
    const scene = war ? game.scenes.get(sceneIdOfWar(war) ?? "") : null;
    return {
      ...context,
      defaults: this.defaults,
      warName: war ? (scene?.name ?? war.name ?? war.id) : null,
      started: Boolean(war?.started),
      rows: warRuleRows(valueOf, { war }),
    };
  }

  /**
   * @this {WarRulesApp}
   * @param {SubmitEvent} _event
   * @param {HTMLFormElement} _form
   * @param {object} formData
   */
  static async #onSubmit(_event, _form, formData) {
    const patch = foundry.utils.expandObject(formData.object).rules ?? {};
    // An unticked checkbox submits nothing; a boolean rule shown and absent
    // from the form is a rule switched off.
    for (const spec of WAR_RULES) {
      if (spec.type === "boolean" && spec.window !== false && !(spec.key in patch)) {
        const input = this.element?.querySelector(`[name="rules.${spec.key}"]`);
        if (input && !input.disabled) patch[spec.key] = false;
      }
    }
    if (this.defaults) await setWorldDefaults(patch);
    else if (this.war) await setWarRules(game.combats.get(this.war.id) ?? this.war, patch);
    this.render();
  }

  /** The same window over the world's defaults for new Wars. */
  static Defaults = class WarDefaultsApp extends WarRulesApp {
    static DEFAULT_OPTIONS = {
      id: "fgt-war-defaults",
      window: { title: "FGT.WarRules.DefaultsTitle" },
    };

    /** @inheritdoc */
    get defaults() {
      return true;
    }
  };
}
