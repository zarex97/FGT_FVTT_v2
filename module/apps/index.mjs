/**
 * @file Sheet registration.
 * @see docs/29-user-interface.md
 *
 * Registration only. The actor sheet moved to `actor-sheet/`, which is where
 * it grew a header, a nav rail and four tabs; leaving it here would have made
 * this file the place every one of those lived.
 */

import { FGTActorSheet } from "./actor-sheet/sheet.mjs";
import { editImage } from "./image-edit.mjs";
import { enrichText, effectFacts } from "./enrich.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;
const { DocumentSheetConfig } = foundry.applications.apps;

class FGTItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["fgt", "sheet", "item"],
    // `height: "auto"`, because most of these documents are three lines long.
    // A fixed 620 left an effect's two-sentence description floating above
    // half a screen of nothing.
    position: { width: 560, height: "auto" },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      editImage: FGTItemSheet.#onEditImage,
    },
  };

  /**
   * @this {FGTItemSheet}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onEditImage(_event, target) {
    return editImage(this, target);
  }

  static PARTS = {
    body: { template: "systems/fgt/templates/item/ability.hbs", scrollable: [""] },
  };

  /** @inheritdoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return {
      ...context,
      system: this.document.system,
      isEditable: this.isEditable,
      // `enrichHTML` is async and Handlebars is not, so this is the only place
      // it can happen. Without it a `@UUID` link renders as literal text.
      enrichedDescription: await enrichText(this.document.system?.description),
      // What a player who just clicked "Burn" actually wants to know. Every
      // one of these was already on the document and none of it was shown;
      // the sheet offered a rule-element key instead, which is the one thing
      // on here that is not for them.
      effect: effectFacts(this.document.system),
      // Rule elements are internals. A GM debugging content wants them; a
      // player who followed a link from a description does not.
      isGM: game.user?.isGM ?? false,
    };
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
