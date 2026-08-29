/**
 * @file The actor sheet.
 * @see docs/29-user-interface.md §29.2
 *
 * ApplicationV2 with `HandlebarsApplicationMixin`, native DOM, no jQuery
 * (D29.1). One class for all six actor types rather than one class per type:
 * the tabs are the same everywhere and only the Overview tab's blocks differ,
 * so six classes would be six copies of the same eighty percent.
 *
 * `context.mjs` builds what each tab renders; `present.mjs` holds the
 * arithmetic, pure, so it can be tested without a world.
 */

import { classifyAbility, needsTargeting } from "../../rules/ability-use.mjs";
import { canToggleMode } from "../../rules/modes.mjs";
import { unitSnapshot } from "../../engine/board.mjs";
import { attackFacts } from "../../engine/attack.mjs";
import { normalAttackAt } from "../../rules/normal-attack.mjs";
import { rollOptionsFor } from "../../rules/options.mjs";
import { buildContext } from "./context.mjs";
import { editImage } from "../image-edit.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

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
      removeEffect: FGTActorSheet.#onRemoveEffect,
      editImage: FGTActorSheet.#onEditImage,
    },
  };

  /**
   * Change the portrait, or any other `data-edit`-named image field the sheet
   * carries -- the Details tab's concealed-image control uses this same
   * action for `system.defaultImage`.
   *
   * @this {FGTActorSheet}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onEditImage(_event, target) {
    return editImage(this, target);
  }

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

    const active = !item.system.active;
    const tick = game.combat?.system?.globalTurn ?? 0;

    // Every rule about WHEN a mode may be switched, in one place
    // (`rules/modes.mjs`). This was a bare write, so Heracles's clause was the
    // only one that existed and the other two -- the 2◈ lockout and a
    // compulsion holding the mode on -- had nowhere to live.
    const verdict = canToggleMode(item, unitSnapshot(this.document), {
      active, tick, turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
    });
    if (!verdict.ok) {
      ui.notifications.warn(game.i18n.format(`FGT.Mode.${verdict.reason}`, {
        name: item.name, ...(verdict.detail ?? {}),
      }));
      return;
    }

    // Stamped on the way ON only: the lockout runs from the activation, and
    // "vice versa" means the same clock is then consulted for switching off.
    await item.update({
      "system.active": active,
      ...(active ? { "system.toggledAt": tick } : {}),
    });
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

    const { useSkill } = await import("../../engine/skill-use.mjs");
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

    const { FGTSocket } = await import("../../net/socket.mjs");
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
      const { CopyDialog } = await import("../copy-dialog.mjs");
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
    const { rollMasterSetup } = await import("../../engine/summon.mjs");
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
    const { ContractDialog } = await import("../contract-dialog.mjs");
    ContractDialog.open(this.document.id);
  }

  /**
   * Remove one effect instance from this Unit.
   *
   * GM only, and it refuses an `unremovable` definition even though the
   * template does not draw the control for one. A rule that is only enforced
   * by not rendering a button is not enforced — the button comes back the
   * first time somebody renders the row a second way.
   *
   * @this {FGTActorSheet}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onRemoveEffect(_event, target) {
    if (!game.user.isGM) return;

    const id = target.closest("[data-effect-id]")?.dataset.effectId;
    const effect = this.document.effects.get(id);
    if (!effect) return;

    const { EffectRegistry } = await import("../../rules/registry.mjs");
    const def = EffectRegistry.get(effect.system?.defId ?? effect.name);
    if (def?.unremovable) {
      ui.notifications.warn(game.i18n.format("FGT.Effect.Unremovable", { name: effect.name }));
      return;
    }

    await effect.delete();
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
      const { AbilityEditor } = await import("../ability-editor.mjs");
      AbilityEditor.open(item);
      return;
    }
    item.sheet?.render(true);
  }

  static PARTS = {
    header:    { template: "systems/fgt/templates/actor/header.hbs" },
    nav:       { template: "systems/fgt/templates/actor/nav.hbs" },
    overview:  { template: "systems/fgt/templates/actor/overview.hbs",  scrollable: [""] },
    abilities: { template: "systems/fgt/templates/actor/abilities.hbs", scrollable: [""] },
    effects:   { template: "systems/fgt/templates/actor/effects.hbs",   scrollable: [""] },
    details:   { template: "systems/fgt/templates/actor/details.hbs",   scrollable: [""] },
  };

  // §29.3's Master block used to be a PARTIAL inside one body part, because two
  // parts meant two scroll containers on one sheet and the scroll position
  // ApplicationV2 preserves is per part -- so a Master editing anything watched
  // its Command Spell tracker jump while its stats stayed put.
  //
  // That reasoning is about two panels visible AT ONCE. With tabs one is
  // visible at a time, so per-part scroll is the behaviour we want rather than
  // the defect it was, and the Master block is Overview content now.
  static TABS = {
    primary: {
      initial: "overview",
      labelPrefix: "FGT.Tab",
      tabs: [
        { id: "overview",  icon: "fa-solid fa-address-card" },
        { id: "abilities", icon: "fa-solid fa-bolt" },
        { id: "effects",   icon: "fa-solid fa-person-rays" },
        { id: "details",   icon: "fa-solid fa-book-open" },
      ],
    },
  };

  /** @inheritdoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return { ...context, ...buildContext(this.document, this) };
  }

  /**
   * Hand a tab part its own tab descriptor.
   *
   * `_prepareTabs` puts every tab in `context.tabs`; a part still has to be
   * told which of them is its own, or its template has no `data-tab` to render
   * and no way to know whether it is the active one.
   *
   * @inheritdoc
   */
  async _preparePartContext(partId, context, options) {
    const part = await super._preparePartContext(partId, context, options);
    if (context.tabs && partId in context.tabs) part.tab = context.tabs[partId];
    return part;
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
  const [{ pickTarget }, { targetSpecForAttack }, { currentBoard, unitSnapshot }, { rollOptionsFor }, preview] =
    await Promise.all([
      import("../canvas/targeting-layer.mjs"),
      import("../../engine/attack.mjs"),
      import("../../engine/board.mjs"),
      import("../../rules/options.mjs"),
      import("../../rules/preview.mjs"),
    ]);

  if (!canvas?.ready || !canvas.fgtTargeting) return legacyPlacement();

  const caster = unitSnapshot(actor);
  const board = currentBoard();

  // The board-derived unit, not `caster` above -- `targeting.branches`
  // (Summoning: Bašmu) is tested against `self:onPlatform:`, which only the
  // full board projection stamps (`annotatePlatforms`). Without this the
  // targeting SESSION itself asked for an enemy AoE while aboard the HGoB,
  // where the ability actually summons at her own panel.
  const boardSelf = board.units.find((u) => u.id === actor.id) ?? caster;
  const spec = targetSpecForAttack(actor, ability, rollOptionsFor({ attacker: boardSelf }));
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
  // Through the SAME facts builder the resolution uses. This built its own
  // three-line version, which meant the preview ignored an ability's declared
  // `damage.base` -- Karna's combined STR+MAG read as plain STR -- and handed
  // the pipeline an EMPTY option set, so every predicated modifier on either
  // side was dropped and the range it showed was a different rule from the one
  // that would run.
  const facts = attackFacts(caster, defender, {
    attack: {
      kind: isNP ? "np" : "normal",
      abilityId: ability?.id ?? null,
      component: ability?.system?.damage?.component ?? null,
      aim: Boolean(ability?.system?.damage?.aim),
      pierce: Boolean(ability?.system?.damage?.pierce),
      ignoresMagicResistance: Boolean(ability?.system?.damage?.ignoresMagicResistance),
    },
  });

  return {
    attacker: caster, defender, board,
    attack: {
      ...facts,
      categorizedAsNP: Boolean(ability?.system?.categorizedAsNP),
      element: ability?.system?.element ?? null,
    },
    base: ability?.system?.damage?.base
      ?? { sources: normalAttackAt(caster, facts.range).sources },
    multiplier: ability?.system?.damage?.multiplier ?? 1,
    flatBonus: ability?.system?.damage?.flatBonus ?? 0,
    conditionalMultipliers: ability?.system?.damage?.conditionalMultipliers ?? [],
    crit: { isCrit: false, chanceUsed: 0 },
    reaction: { kind: "none" },
    luckChecks: {},
    options: rollOptionsFor({ attacker: caster, defender, attack: facts }),
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


export { FGTActorSheet };
