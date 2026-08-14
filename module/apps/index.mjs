/**
 * @file Sheet registration.
 * @see docs/29-user-interface.md
 *
 * ApplicationV2 throughout, no jQuery. The sheets here are intentionally
 * minimal — enough to inspect and edit a document. The tactical HUD, the
 * targeting preview and the reaction prompts are a later phase.
 */

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2, ItemSheetV2 } = foundry.applications.sheets;
const { DocumentSheetConfig } = foundry.applications.apps;

class FGTActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["fgt", "sheet", "actor"],
    position: { width: 620, height: 720 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      useAbility: FGTActorSheet.#onUseAbility,
      editAbility: FGTActorSheet.#onEditAbility,
    },
  };

  /**
   * Declare an attack with an ability.
   *
   * Targeting comes from the user's current Foundry targets, which is the
   * cheapest thing that works until the canvas preview lands (Ch. 28). The
   * resolution itself runs on the GM client, because contested outcomes are
   * computed where the authoritative snapshot lives (Ch. 26 §26.4, Model B).
   *
   * @this {FGTActorSheet}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onUseAbility(_event, target) {
    const abilityId = target.closest("[data-item-id]")?.dataset.itemId ?? null;
    const targets = Array.from(game.user.targets);
    if (targets.length === 0) {
      ui.notifications.warn(game.i18n.localize("FGT.Attack.NoTarget"));
      return;
    }

    const { FGTSocket } = await import("../net/socket.mjs");
    try {
      await FGTSocket.request("resolveAttack", {
        attackerId: this.document.id,
        abilityId,
        placement: { unitId: targets[0].actor?.id, panel: { i: targets[0].document.y, j: targets[0].document.x } },
      });
    } catch (err) {
      ui.notifications.error(err.message);
    }
  }

  /**
   * @this {FGTActorSheet}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static #onEditAbility(_event, target) {
    const id = target.closest("[data-item-id]")?.dataset.itemId;
    this.document.items.get(id)?.sheet?.render(true);
  }

  static PARTS = {
    body: { template: "systems/fgt/templates/actor/unit.hbs", scrollable: [""] },
  };

  /** @inheritdoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return {
      ...context,
      system: this.document.system,
      fields: this.document.system.schema.fields,
      abilities: this.document.items.filter((i) => i.type === "ability"),
      noblePhantasms: this.document.items.filter((i) => i.type === "noblePhantasm"),
      isEditable: this.isEditable,
    };
  }
}

class FGTItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["fgt", "sheet", "item"],
    position: { width: 560, height: 620 },
    window: { resizable: true },
    form: { submitOnChange: true },
  };

  static PARTS = {
    body: { template: "systems/fgt/templates/item/ability.hbs", scrollable: [""] },
  };

  /** @inheritdoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return { ...context, system: this.document.system, isEditable: this.isEditable };
  }
}

export function registerSheets() {
  DocumentSheetConfig.unregisterSheet(Actor, "core", foundry.appv1?.sheets?.ActorSheet ?? {});
  DocumentSheetConfig.registerSheet(Actor, "fgt", FGTActorSheet, {
    types: ["servant", "master", "civilian", "summon", "platform", "structure"],
    makeDefault: true, label: "FGT.Sheet.Unit",
  });
  DocumentSheetConfig.registerSheet(Item, "fgt", FGTItemSheet, {
    types: ["ability", "noblePhantasm", "commandSpell", "masterEssence", "equipment"],
    makeDefault: true, label: "FGT.Sheet.Ability",
  });
}

export { FGTActorSheet, FGTItemSheet };
