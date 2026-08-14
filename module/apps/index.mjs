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
    const ability = abilityId ? this.document.items.get(abilityId) : null;

    const placement = await pickPlacement(this.document, ability);
    // `null` is a cancellation, which is the most common outcome of opening a
    // targeting session and is not an error.
    if (!placement) return;

    const { FGTSocket } = await import("../net/socket.mjs");
    try {
      await FGTSocket.request("resolveAttack", {
        attackerId: this.document.id,
        abilityId,
        placement,
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

/**
 * Run the canvas targeting session for an ability and return its placement.
 *
 * The preview resolves the **same spec** the resolution will, and computes its
 * damage range with the **same pipeline** — the two are one implementation, so
 * the number the player is shown before committing cannot disagree with the
 * number they get.
 *
 * Falls back to Foundry's own target set when the canvas is unavailable (a
 * macro, a scene with no tokens), so nothing becomes unusable without it.
 *
 * @param {object} actor an `FGTActor`
 * @param {object|null} ability
 * @returns {Promise<object|null>}
 */
async function pickPlacement(actor, ability) {
  const [{ pickTarget }, { targetSpecForAttack }, { unitSnapshot, boardSnapshot }, preview] =
    await Promise.all([
      import("./canvas/targeting-layer.mjs"),
      import("../engine/attack.mjs"),
      import("../engine/board.mjs"),
      import("../rules/preview.mjs"),
    ]);

  if (!canvas?.ready || !canvas.fgtTargeting) return legacyPlacement();

  // The caster is snapshotted **with its token**: the preview and the
  // resolution must agree, and a caster with no panel reaches nothing.
  const caster = unitSnapshot(actor);
  const board = boardSnapshot();

  if (!caster.onBoard) {
    ui.notifications.warn(
      game.i18n.format("FGT.Targeting.CasterNotPlaced", { name: actor.name }),
    );
    return null;
  }

  const spec = targetSpecForAttack(actor, ability);
  const isNP = ability?.type === "noblePhantasm";

  return pickTarget({
    spec, caster, board,
    preview: {
      label: ability?.name ?? game.i18n.localize("FGT.Chat.NormalAttack"),
      damageFor: (unitId) => {
        const defender = board.units.find((u) => u.id === unitId);
        if (!defender) return null;
        return preview.damageRange(
          previewContext({ caster, defender, ability, board, isNP }),
          { negation: preview.negationBounds(defender, isNP) },
        );
      },
    },
  });
}

/**
 * The damage context the preview runs, without any rolls.
 * @param {object} args
 * @returns {object}
 */
function previewContext({ caster, defender, ability, board, isNP }) {
  return {
    attacker: caster, defender, board,
    attack: {
      kind: isNP ? "np" : "normal",
      abilityId: ability?.id ?? null,
      categorizedAsNP: Boolean(ability?.system?.categorizedAsNP),
      element: ability?.system?.element ?? null,
    },
    base: { sources: [{ unit: "self", component: caster.normalAttack?.component ?? "str", factor: 1 }] },
    multiplier: ability?.system?.damage?.multiplier ?? 1,
    flatBonus: ability?.system?.damage?.flatBonus ?? 0,
    conditionalMultipliers: ability?.system?.damage?.conditionalMultipliers ?? [],
    crit: { isCrit: false, chanceUsed: 0 },
    reaction: { kind: "none" },
    luckChecks: {},
    options: new Set(),
  };
}

/**
 * Foundry's own target set, as a placement. Used only when the canvas layer is
 * not available.
 * @returns {object|null}
 */
function legacyPlacement() {
  const targets = Array.from(game.user.targets);
  if (targets.length === 0) {
    ui.notifications.warn(game.i18n.localize("FGT.Attack.NoTarget"));
    return null;
  }
  const token = targets[0];
  // A panel is a grid offset, and a TokenDocument's x/y are pixels. Passing the
  // pixels through as `{i: y, j: x}` put the anchor hundreds of panels off the
  // board, where it was silently clipped away by the bounds check.
  const panel = canvas.grid.getOffset({ x: token.document.x, y: token.document.y });
  return { unitId: token.actor?.id, panel: { i: panel.i, j: panel.j } };
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
