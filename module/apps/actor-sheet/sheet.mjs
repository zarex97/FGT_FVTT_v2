/**
 * @file The actor sheet.
 * @see docs/35-sheets-and-editor.md
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
import { canToggleMode, pricedOnEntry } from "../../rules/modes.mjs";
import { mayChangeStance } from "../../rules/stance.mjs";
import { unitSnapshot, currentTick, clockRunning } from "../../engine/board.mjs";
import { previewContext } from "../../engine/attack.mjs";
import { dealsNoDamage } from "../../rules/ability-use.mjs";
import { buildContext } from "./context.mjs";
import { editImage } from "../image-edit.mjs";
import { factionOfCombatant } from "../../engine/turn-order.mjs";
import { enrichAbilityCards } from "../enrich.mjs";

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
      setStance: FGTActorSheet.#onSetStance,
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
   * cheapest thing that works until the canvas preview lands (Ch. 20). The
   * resolution itself runs on the GM client, because contested outcomes are
   * computed where the authoritative snapshot lives (Ch. 38, Model B).
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
  /**
   * Declare a stance (Ch. 45).
   *
   * Not a mode toggle: switching costs nothing, so there is no price to pay and
   * no cooldown to spend. What there is instead is a window -- his sheet allows
   * the declaration when he acts, allows dropping out of Mounted at a Combat
   * Phase start, and allows nothing else -- and `rules/stance.mjs` is the one
   * place that knows which is which.
   *
   * @this {FGTActorSheet}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onSetStance(_event, target) {
    const to = target.dataset.stance;
    const unit = unitSnapshot(this.document);
    const at = game.combat?.started ? "declare" : "free";
    const acting = game.combats?.active?.actingFactionId ?? null;
    const verdict = mayChangeStance(unit, to, {
      at,
      acted: Boolean(unit.turnState?.acted),
      // Out of combat there is no Turn to be out of, so the declaration is free.
      isOwnTurn: !acting || (unit.actingFactionId ?? unit.factionId) === acting,
    });
    if (!verdict.ok) {
      ui.notifications.warn(game.i18n.format(`FGT.Stance.Refused.${verdict.reason}`, {
        name: this.document.name,
        stance: game.i18n.localize(`FGT.Stance.${to}`),
      }));
      return;
    }
    await this.document.update({ "system.stance": to });
  }

  static async #onToggleMode(_event, target) {
    const id = target.closest("[data-item-id]")?.dataset.itemId;
    const item = this.document.items.get(id);
    if (!item) return;
    await FGTActorSheet.toggleMode(this.document, item);
  }

  /**
   * Switch a mode, through every rule about when it may be switched.
   *
   * One path for the sheet and the action bar. The bar wrote `system.active`
   * bare, so a mode switched from it skipped every gate -- Heracles's
   * `cannotDeactivate`, the 2◈ lockout, a compulsion, the new own-Turn window
   * (#101) -- and stamped no `toggledAt` for the lockout to count from.
   *
   * @param {object} actor
   * @param {object} item
   * @returns {Promise<void>}
   */
  static async toggleMode(actor, item) {
    const active = !item.system.active;
    // `currentTick`, NOT `game.combat` -- the latter is the combat being
    // VIEWED, so this stamped the lockout against whatever tracker happened to
    // be on screen.
    const tick = currentTick() ?? 0;

    // Every rule about WHEN a mode may be switched, in one place
    // (`rules/modes.mjs`). This was a bare write, so Heracles's clause was the
    // only one that existed and the other two -- the 2◈ lockout and a
    // compulsion holding the mode on -- had nowhere to live.
    const verdict = canToggleMode(item, unitSnapshot(actor), {
      active, tick, turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
      // A lockout is measured against the match's clock, so it cannot be
      // stamped when there is no match to measure it against.
      clockRunning: clockRunning(),
      // The Round this press happens in, so a use recorded in an earlier one
      // does not bite in this one (Ch. 46 §46.4-L).
      round: game.combats?.active?.round ?? null,
      // Whose Turn it is, when a faction's is (#101). The GM's own slot, and a
      // table with no match, answer nothing.
      ownTurn: ownTurnOf(actor),
    });
    if (!verdict.ok) {
      ui.notifications.warn(game.i18n.format(`FGT.Mode.${verdict.reason}`, {
        name: item.name, ...(verdict.detail ?? {}),
      }));
      return;
    }

    // A mode may have an ENTRY PRICE, and until Mannanán none did. Mad
    // Enhancement and Presence Concealment are free switches, so the toggle was
    // a bare write and every gate an ordinary ability is checked against -- its
    // requirements, its cooldown, its whole-match budget -- was simply absent
    // from this path.
    //
    // *God's Holder: Possession* is the first that is not: *"can only be used
    // when Mannanán's Health is less than 30% of its maximum value OR when she
    // is defeated, and while she has at least 1 Fragarach Token. Remove all
    // Fragarach Counters from Mannanán and she enters Holder Mode, restoring
    // her Health to 50% of its maximum value."* Three gates and three writes,
    // none of which a boolean flip performs.
    //
    // Riding's Active is the second, and has no phases at all: *"Cooldown: 3◈
    // Turns"* is a clock that starts at the press, which a bare flip never
    // started (#116). `pricedOnEntry` is the one question both answer.
    //
    // Switching a mode OFF never pays: an exit price is not a thing any sheet
    // in the corpus states, and charging one would be inventing a rule.
    if (active && pricedOnEntry(item)) {
      const out = await FGTActorSheet.#relaySkill(actor, item);
      if (!out.ok) {
        ui.notifications.warn(game.i18n.format("FGT.Skill.Refused", { name: item.name, reason: out.reason }));
        return;
      }
    }

    // Stamped on BOTH directions. *"When Mad Enhancement is Activated, it can
    // only be deactivated 2◈ Turns after it was activated, **and vice
    // versa**"* — two symmetric waits off one clock that restarts on every
    // flip, not one clock that only ever starts on an activation.
    //
    // Stamping the way ON alone left the second half unenforced entirely.
    // Measured live: Mad Enhancement on since tick 10, switched off at tick 40
    // (permitted, 30 Turns elapsed) with `toggledAt` still reading 10 — and
    // `canToggleMode` then answered `{ok: true}` to switching it straight back
    // on in the same Turn. Once the first 2◈ had passed the mode was a free
    // toggle for the rest of the match, which is the state of affairs the
    // clause exists to prevent.
    await item.update({ "system.active": active, "system.toggledAt": tick });

    // RECORD the press, for the modes that ration it. `canToggleMode` above can
    // only refuse a second switch if something wrote the first one down, and
    // this path wrote nothing: a mode that is not `pricedOnEntry` never calls
    // `useSkill`, which is where every other use in the game is recorded.
    // Narrowed to the modes that declare a limit so an ordinary free toggle --
    // Mad Enhancement, Presence Concealment -- does not start appearing in a
    // record that
    // `oncePerTurn` and `abilityOffCooldown` also read (Ch. 46 §46.4-L).
    if (item.system?.oncePerRound || item.system?.oncePerTurn) {
      const [{ applyWorldIntents }, I] = await Promise.all([
        import("../../engine/applier.mjs"),
        import("../../engine/intents.mjs"),
      ]);
      await applyWorldIntents(
        [I.recordUse(actor.id, item.id, item.system?.contentId ?? null)],
        "toggleMode",
      );
    }
  }

  /**
   * @this {FGTActorSheet}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onUseAbility(_event, target) {
    const abilityId = target.closest("[data-item-id]")?.dataset.itemId ?? null;
    const ability = abilityId ? this.document.items.get(abilityId) : null;

    // A Skill is not an Attack (Ch. 17), and until now both went down the same
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
   * Ask the GM to use a Skill, and say how it went.
   *
   * A Skill runs on the GM, as an attack does. On a player's client it cannot
   * write what most of them write -- a `zone` phase's Region, a field's Region,
   * the Actor, Token and Level a platform or a summon creates -- and is refused a
   * buff on another player's Unit (`OPERATIONS.useSkill`, #130, #144). A GM's
   * own press executes locally, so this is the one path for everybody. The
   * placement the player picked travels with the request: only their client can
   * pick it.
   *
   * @param {object} actor
   * @param {object} ability
   * @param {object} [placement]
   * @returns {Promise<{ok: boolean, reason?: string}>}
   */
  static async #relaySkill(actor, ability, placement = {}) {
    const { FGTSocket } = await import("../../net/socket.mjs");
    try {
      return await FGTSocket.request("useSkill", { actorId: actor.id, abilityId: ability.id, placement });
    } catch (err) {
      return { ok: false, reason: err.message };
    }
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

    const out = await FGTActorSheet.#relaySkill(actor, ability, placement);
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
   * The token HUD (Ch. 34) offers the same buttons, and a second implementation
   * of "declare an attack" would be a second place for it to be wrong -- with
   * the copy being the one nobody updates.
   *
   * @param {object} actor
   * @param {object|null} ability
   * @returns {Promise<void>}
   */
  static async declareAttack(actor, ability) {
    // An ability that IS a Riding Attack rides to a destination the player picks
    // rather than aiming from where the Unit stands: *"used in the form of a
    // Riding Attack, with a distance of 13 panels"* (Troias Tragōidia). Declared
    // from here it resolved as a stationary 13-panel line, and `@ride.x` and
    // `@hitCount` had nothing to read (#113).
    if (ability && classifyAbility(ability).ridesAsAttack) {
      const { rideFrom } = await import("../hud/action-bar.mjs");
      return rideFrom(actor, { ability });
    }

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
   * Roll a Master's setup lines (Ch. 13).
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
   * Open the contract dialog (Ch. 32).
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

    // Ch. 34's editor for a GM, the plain sheet for everyone else: the editor
    // writes rule elements, and a player who reorders a phase has changed the
    // ability for the whole table.
    if (game.user.isGM) {
      const { AbilityEditor } = await import("../ability-editor/index.mjs");
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

  // Ch. 34's Master block used to be a PARTIAL inside one body part, because two
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
    const built = { ...context, ...buildContext(this.document, this) };
    // `enrichHTML` is async and Handlebars is not, so this is the only place
    // it can happen. Without it a `@UUID` link renders as literal text.
    await enrichAbilityCards(built.abilityCards);
    return built;
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
  return pickPlacementFor(actor, ability);
}

/**
 * Open a targeting session for an attack, optionally requiring a unit be caught.
 *
 * Exported for Ch. 21: the action bar arms for a Counter and needs the same
 * session with one extra limit, `requireUnitId`, so an area that misses the
 * attacker is refused under the cursor rather than after the player commits.
 *
 * @param {object} actor
 * @param {object|null} ability
 * @param {object} [opts]
 * @param {string|null} [opts.requireUnitId]
 * @returns {Promise<object|null>}
 */
export async function pickPlacementFor(actor, ability, { requireUnitId = null, excludeUnitIds = [] } = {}) {
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
  const base = targetSpecForAttack(actor, ability, rollOptionsFor({ attacker: boardSelf }));
  // Ch. 21: a Counter must catch the unit that attacked. Merged into the spec so
  // the refusal is DRAWN, in the illegal tint with its reason, while the player
  // is still aiming.
  const aimed = (requireUnitId || excludeUnitIds.length > 0)
    ? { ...base, limits: { ...(base.limits ?? {}), requireUnitId, excludeUnitIds } }
    : base;
  // What this is, for a platform's protection of its occupants (#138): the
  // resolution says "attack" or "effect" through its placement, and the preview
  // has no placement until the player aims, so it says it on the spec.
  const spec = { ...aimed, reach: (ability ? classifyAbility(ability).isAttack : true) ? "attack" : "effect" };
  const isNP = ability?.type === "noblePhantasm";

  return pickTarget({
    spec, caster, board,
    preview: {
      label: ability?.name ?? game.i18n.localize("FGT.Chat.NormalAttack"),
      isAttack: ability ? classifyAbility(ability).isAttack : true,
      damageFor: (unitId) => {
        const defender = board.units.find((u) => u.id === unitId);
        if (!defender) return null;
        // *"(Non-damaging)"*. The RESOLVER has known this since `dealsNoDamage`
        // was written -- it hands stage 1 a `{fixedValue: 0}` base -- and the
        // preview did not, so it fell through to `baseSpecFor`'s Normal Attack
        // fallback the way the resolver used to. Chaos Labyrinthos was previewed
        // at "192 - 264" on a Noble Phantasm that deals nothing, which is the
        // gate and the display disagreeing with the player believing the
        // display (Ch. 46 §46.8).
        if (dealsNoDamage(ability)) return null;
        return preview.damageRange(
          previewContext({ caster, defender, ability, board, isNP }),
          { negation: preview.negationBounds(defender, isNP) },
        );
      },
    },
  });
}

/**
 * Is it this actor's faction's Turn? `undefined` when no faction's Turn is
 * running -- no match, or the GM's own slot -- which asks nothing of a mode.
 * @param {object} actor
 * @returns {boolean|undefined}
 */
function ownTurnOf(actor) {
  const combat = game.combats?.active;
  if (!combat?.started) return undefined;
  const faction = factionOfCombatant(combat.combatant);
  if (faction === null) return undefined;
  return (actor.system?.factionId ?? null) === faction;
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
  // The one Unit Foundry has targeted is the choice, for an ability that asks for
  // one: without `chosenIds` a `chooser: chosen` ability returned `needsChoice`
  // and did nothing (#129).
  return {
    unitId: token.actor?.id,
    panel: { i: token.document.y, j: token.document.x },
    chosenIds: [token.actor?.id],
  };
}


export { FGTActorSheet };
