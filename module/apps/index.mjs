/**
 * @file Sheet registration.
 * @see docs/29-user-interface.md
 *
 * ApplicationV2 throughout, no jQuery. The sheets here are intentionally
 * minimal — enough to inspect and edit a document. The tactical HUD, the
 * targeting preview and the reaction prompts are a later phase.
 */

import { classifyAbility, needsTargeting } from "../rules/ability-use.mjs";
import * as board from "../engine/board.mjs";
import { currentBoard } from "../engine/board.mjs";
import { poolsOf, isUnbound } from "../rules/cs-namespacing.mjs";
import { chebyshev } from "../domain/geometry.mjs";

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
      normalAttack: FGTActorSheet.#onNormalAttack,
      useAbility: FGTActorSheet.#onUseAbility,
      toggleMode: FGTActorSheet.#onToggleMode,
      editAbility: FGTActorSheet.#onEditAbility,
      openDialog: FGTActorSheet.#onOpenDialog,
      rollSetup: FGTActorSheet.#onRollSetup,
      contract: FGTActorSheet.#onContract,
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
  static async #onNormalAttack(_event, _target) {
    return FGTActorSheet.#declare(this.document, null);
  }

  /**
   * Toggle a mode on or off.
   *
   * A mode is not an attack and needs no target: Mad Enhancement is switched
   * on and stays on. Toggling it re-runs derived data, so its MOV, Range and
   * damage contributions appear and disappear with the switch.
   *
   * @this {FGTActorSheet}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onToggleMode(_event, target) {
    const id = target.closest("[data-item-id]")?.dataset.itemId;
    const item = this.document.items.get(id);
    if (!item) return;

    if (item.system.active && item.system.cannotDeactivate) {
      ui.notifications.warn(game.i18n.format("FGT.Ability.CannotDeactivate", { name: item.name }));
      return;
    }
    await item.update({ "system.active": !item.system.active });
  }

  /**
   * @this {FGTActorSheet}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onUseAbility(_event, target) {
    const abilityId = target.closest("[data-item-id]")?.dataset.itemId ?? null;
    const ability = abilityId ? this.document.items.get(abilityId) : null;

    // A Skill is not an Attack (§15.1), and until now both went down the same
    // path: a self-buff opened a targeting session, priced its own caster for
    // damage, offered an "Attack" button and started a Combat Process that
    // asked the target to Evade. `classifyAbility` had said `isAttack: false`
    // the whole time and nothing on this path read it.
    if (ability && !classifyAbility(ability).isAttack) {
      return FGTActorSheet.useSkill(this.document, ability);
    }
    return FGTActorSheet.#declare(this.document, ability);
  }

  /**
   * Use a non-attacking active Skill.
   *
   * The targeting session is opened **only when there is something to choose**.
   * A confirmation dialog for a decision with one possible answer is a click
   * that asks nothing, and the one this replaced asked it with the wrong verb.
   *
   * @param {object} actor
   * @param {object} ability
   * @returns {Promise<void>}
   */
  static async useSkill(actor, ability) {
    let placement = {};

    if (needsTargeting(ability)) {
      placement = await pickPlacement(actor, ability);
      if (!placement) return;
    }

    const { useSkill } = await import("../engine/skill-use.mjs");
    const out = await useSkill({ actorId: actor.id, abilityId: ability.id, placement });
    if (!out.ok) {
      ui.notifications.warn(game.i18n.format("FGT.Skill.Refused", {
        name: ability.name, reason: out.reason,
      }));
    }
  }

  /**
   * Target and declare. Shared by the normal attack and every ability that is
   * used rather than toggled.
   *
   * @param {object} actor
   * @param {object|null} ability `null` for a normal attack
   * @returns {Promise<void>}
   */
  static async #declare(actor, ability) {
    return FGTActorSheet.declareAttack(actor, ability);
  }

  /**
   * The declaration path, reachable from outside the sheet.
   *
   * The token HUD (§29.5) offers the same buttons, and a second implementation
   * of "declare an attack" would be a second place for it to be wrong -- with
   * the copy being the one nobody updates.
   *
   * @param {object} actor
   * @param {object|null} ability
   * @returns {Promise<void>}
   */
  static async declareAttack(actor, ability) {

    const placement = await pickPlacement(actor, ability);
    // `null` is a cancellation, which is the most common outcome of opening a
    // targeting session and is not an error.
    if (!placement) return;

    const { FGTSocket } = await import("../net/socket.mjs");
    try {
      await FGTSocket.request("resolveAttack", {
        attackerId: actor.id,
        abilityId: ability?.id ?? null,
        placement,
      });
    } catch (err) {
      ui.notifications.error(err.message);
    }
  }

  /**
   * An ability whose use is a setup decision rather than an action.
   *
   * Wisdom of Dún Scáith is the only one today. Routed through the ability's
   * own `opensDialog` rather than matched by name, so the next one needs
   * content and not code.
   *
   * @this {FGTActorSheet}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onOpenDialog(_event, target) {
    const id = target.closest("[data-item-id]")?.dataset.itemId;
    const item = this.document.items.get(id);
    const kind = item?.system?.opensDialog;
    if (!kind) return;

    if (kind === "copy") {
      const { CopyDialog } = await import("./copy-dialog.mjs");
      CopyDialog.open({ copierId: this.document.id, grantedBy: item.system.contentId || item.id });
    }
  }

  /**
   * Roll a Master's setup lines (§14.9).
   *
   * On the sheet rather than in a dialog of its own: a Master has five lines
   * and no choices to make, so a whole application for it would be ceremony.
   *
   * @this {FGTActorSheet}
   */
  static async #onRollSetup() {
    const { rollMasterSetup } = await import("../engine/summon.mjs");
    const result = await rollMasterSetup({ masterId: this.document.id });
    if (!result.ok) {
      ui.notifications.error(game.i18n.localize("FGT.Summon.SetupFailed"));
      return;
    }
    ui.notifications.info(game.i18n.format("FGT.Summon.SetupDone", {
      name: this.document.name,
      health: result.lines.find((l) => l.id === "maxHealth")?.value ?? 0,
    }));
  }

  /**
   * Open the contract dialog (§16.2).
   *
   * @this {FGTActorSheet}
   */
  static async #onContract() {
    const { ContractDialog } = await import("./contract-dialog.mjs");
    ContractDialog.open(this.document.id);
  }

  /**
   * @this {FGTActorSheet}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onEditAbility(_event, target) {
    const id = target.closest("[data-item-id]")?.dataset.itemId;
    const item = this.document.items.get(id);
    if (!item) return;

    // §29.6's editor for a GM, the plain sheet for everyone else: the editor
    // writes rule elements, and a player who reorders a phase has changed the
    // ability for the whole table.
    if (game.user.isGM) {
      const { AbilityEditor } = await import("./ability-editor.mjs");
      AbilityEditor.open(item);
      return;
    }
    item.sheet?.render(true);
  }

  static PARTS = {
    body: { template: "systems/fgt/templates/actor/unit.hbs", scrollable: [""] },
  };

  // §29.3's Master block is a PARTIAL inside the body rather than a second
  // part. Two parts meant two scroll containers on one sheet, and the scroll
  // position that ApplicationV2 preserves is per part -- so a Master editing
  // anything watched its Command Spell tracker jump while its stats stayed put.

  /** @inheritdoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return {
      ...context,
      system: this.document.system,
      fields: this.document.system.schema.fields,
      // Classified, so the template renders a toggle for a mode, a button for
      // an attack, and plain text for a passive -- rather than one button that
      // opens an enemy targeting session for all three.
      abilities: this.document.items.filter((i) => i.type === "ability").map(describe),
      noblePhantasms: this.document.items.filter((i) => i.type === "noblePhantasm").map(describe),
      // The roster is a GM-managed list, not free text: a typo'd faction makes
      // two units enemies with nothing on screen to explain why.
      factionChoices: board.choices(),
      hasFactions: Object.keys(board.choices()).length > 0,
      hasFaction: Boolean(this.document.system.factionId),
      isEditable: this.isEditable,
      // §14.9's setup rolls, offered on a Master that has not had them yet.
      // A GM may re-roll before the match starts; afterwards the rolls lock.
      // Only a Master or a Caster may contract (§16.2), so only they get the
      // button -- a control that always refuses is worse than none.
      //
      // Spread first: `servantClasses` is a SetField, so it arrives as a `Set`,
      // which has `.has` and not `.includes`. The `?? []` reads like a guard and
      // defends against nothing -- the field is required, so it is always
      // present and always a Set.
      canContract: this.document.type === "master"
        || [...(this.document.system?.servantClasses ?? [])].includes("caster"),
      canRollSetup: this.document.type === "master" && game.user.isGM,
      setupLocked: Boolean(game.combat?.started),
      // §29.3's three Master-only panels. Computed here rather than in the
      // template because every one of them is derived -- the Unbound warning
      // most of all, which no field on the sheet stores.
      isMaster: this.document.type === "master",
      ...(this.document.type === "master" ? masterContext(this.document) : {}),
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
 * The Master-only half of the sheet (§29.3).
 *
 * Every figure here is derived. The Command Spell tracker shows `own` and the
 * per-Servant grants apart because §16.9 makes them different resources, and
 * the **Unbound** warning falls out of the total being zero rather than being
 * stored -- a stored flag would need updating from spending, granting,
 * inheriting and the Master dying, and the one that got missed would leave a
 * Servant permanently Unbound with a full pool.
 *
 * @param {object} master an `FGTActor`
 * @returns {object}
 */
function masterContext(master) {
  const board = currentBoard();
  const self = board.units.find((u) => u.id === master.id) ?? null;

  return {
    csPools: poolsOf(master.system).map((pool) => ({
      ...pool,
      name: game.actors.get(pool.servantId)?.name ?? pool.servantId,
      // Pips, so "2 of 3" is legible at a glance rather than read as a number.
      // Built here rather than in the template: Foundry registers no `range`
      // helper, and a template that invents one throws at render time.
      pips: "●".repeat(Math.min(pool.total, 9)) + "○".repeat(Math.max(0, 3 - pool.total)),
    })),
    contracted: [...(master.system.servantIds ?? [])].map((id) => describeServant(id, master, board, self)),
    // "a warning that it is lost on death" -- the Essence is the one thing on
    // this sheet whose loss is permanent.
    essences: [...(master.system.essences ?? [])],
    // §16.7: at 25 Health or less a Master cannot order more than one Servant
    // to Act, and the tax has already been charged by the time anyone looks.
    taxWarning: (master.system.health?.value ?? 0) <= 25,
    multiServantTax: master.system.turnState?.servantsActed ?? 0,
  };
}

/**
 * One contracted Servant, as §29.3 shows it: distance, ZON, and what being
 * outside costs.
 *
 * @param {string} id
 * @param {object} master
 * @param {object} board
 * @param {object|null} self
 * @returns {object}
 */
function describeServant(id, master, board, self) {
  const actor = game.actors.get(id);
  const unit = board.units.find((u) => u.id === id) ?? null;
  const distance = unit?.panel && self?.panel ? chebyshev(unit.panel, self.panel) : null;

  return {
    id,
    name: actor?.name ?? id,
    distance,
    inZon: unit ? !unit.outsideZon : null,
    // Named rather than implied: a player who sees "outside ZON" and not what it
    // costs has to remember the rule, and remembering it is the mistake.
    penalty: unit?.outsideZon ? game.i18n.localize("FGT.Master.ZonPenalty") : null,
    unbound: isUnbound(master.system, id),
    health: actor?.system?.health ?? null,
  };
}

/**
 * Present one ability to the sheet.
 * @param {object} item
 * @returns {object}
 */
function describe(item) {
  const use = classifyAbility(item);
  return {
    id: item.id,
    name: item.name,
    rank: item.system.rank,
    use,
    // A mode that is on reads as on; `cannotDeactivate` explains a disabled
    // toggle rather than leaving the player clicking a dead control.
    active: Boolean(item.system.active),
    locked: Boolean(item.system.active && item.system.cannotDeactivate),
  };
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
  const [{ pickTarget }, { targetSpecForAttack }, { currentBoard, unitSnapshot }, preview] =
    await Promise.all([
      import("./canvas/targeting-layer.mjs"),
      import("../engine/attack.mjs"),
      import("../engine/board.mjs"),
      import("../rules/preview.mjs"),
    ]);

  if (!canvas?.ready || !canvas.fgtTargeting) return legacyPlacement();

  const caster = unitSnapshot(actor);
  const board = currentBoard();

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
  return { unitId: token.actor?.id, panel: { i: token.document.y, j: token.document.x } };
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
