/**
 * @file The action bar — one persistent panel for the controlled unit.
 * @see docs/29-user-interface.md §29.5
 *
 * Layer 4. Replaces the token HUD column, which packed an unbounded number of
 * controls into a container Foundry sizes for about four: Medusa produced
 * twelve and it overflowed. Rows wrap here, so a Servant with three open
 * fields and two modes fits by construction.
 *
 * Thin by design. Every decision it draws comes from `hud/present.mjs`, and
 * every action it dispatches comes from `rules/actions.mjs`; this file knows
 * no rules at all.
 */

import { rowsFor, slotFor, portraitBlock } from "./present.mjs";
import { availableActions } from "../../rules/actions.mjs";
import { classifyAbility } from "../../rules/ability-use.mjs";
import { canUseAbility } from "../../rules/costs.mjs";
import { publicNameOf } from "../../rules/identity.mjs";
import { abilityCost } from "../actor-sheet/present.mjs";
import { currentBoard, unitSnapshot, unitFrom } from "../../engine/board.mjs";
import { turnContext, TURN_ACTIONS } from "./turn-panel.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class ActionBar extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "fgt-action-bar",
    classes: ["fgt", "action-bar"],
    position: { width: "auto", height: "auto" },
    window: { frame: false, positioned: false },
    // The turn panel's three controls sit beside the bar's own, because the
    // panel is now this bar's right-hand segment rather than a second window.
    actions: { useSlot: ActionBar.onUseSlot, ...TURN_ACTIONS },
  };

  static PARTS = {
    body: { template: "systems/fgt/templates/hud/action-bar.hbs" },
  };

  /** The controlled token this bar is showing. @type {object|null} */
  token = null;

  /** The singleton: one selection, one bar. */
  static instance = null;

  /**
   * Show the bar and keep it current.
   *
   * The listener list is the design's §10 verbatim. `fgt.modeToggled` is NOT
   * here: only `engine/concealment.mjs` raises it, and an ordinary toggle
   * writes `system.active`, which surfaces as `updateItem`.
   *
   * @returns {ActionBar}
   */
  static attach() {
    ActionBar.instance ??= new ActionBar();
    const bar = ActionBar.instance;

    const refresh = () => {
      const token = canvas.tokens?.controlled?.[0] ?? null;
      bar.token = token?.actor?.isOwner ? token : null;
      if (bar.token) bar.render({ force: true });
      else bar.close();
    };

    Hooks.on("controlToken", refresh);
    Hooks.on("updateActor", refresh);
    Hooks.on("updateItem", refresh);
    Hooks.on("createActiveEffect", refresh);
    Hooks.on("deleteActiveEffect", refresh);
    Hooks.on("updateCombat", refresh);
    Hooks.on("fgtBudgetChanged", refresh);
    Hooks.on("fgtFieldChanged", refresh);

    console.log("FGT | Action bar attached");
    return bar;
  }

  /** @inheritdoc */
  async _prepareContext() {
    const token = this.token;
    const actor = token?.actor;
    if (!actor) return { rows: [], portrait: {}, resources: [], turn: await turnContext() };

    // ONE snapshot per render, threaded through every builder — the same
    // discipline `actor-sheet/context.mjs` uses and for the same reason.
    const board = currentBoard();
    const snapshot = unitSnapshot(actor, token.document);
    const unit = unitFrom(board, actor) ?? snapshot;
    const turnsPerRound = game.settings.get("fgt", "turnsPerRound");
    const openFields = new Set((board.fields ?? []).map((f) => f.id));

    const actions = availableActions(snapshot, board).map((a) => ({
      ...a, tooltip: game.i18n.localize(a.label),
    }));

    const abilities = [...actor.items]
      .filter((i) => i.type === "ability" || i.type === "noblePhantasm")
      .map((item) => {
        const use = classifyAbility(item);
        if (!use.clickable) return null;
        const entry = (snapshot.abilities ?? []).find((a) => a.id === item.id) ?? {};
        const verdict = canUseAbility({ ability: item.system, unit: snapshot });
        const slot = slotFor({
          ...entry,
          img: item.img,
          name: item.name,
          active: Boolean(item.system?.active),
          fieldOpen: openFields.has(entry.contentId ?? item.id),
        }, {
          verdict,
          cost: abilityCost(item.system?.cost, null, snapshot),
          turnsPerRound,
        });
        return {
          ...slot,
          group: use.toggles ? "mode" : (entry.isNP ? "np" : "skill"),
          tooltip: slot.reason ? `${item.name} — ${refusalText(slot.reason)}` : item.name,
        };
      })
      .filter(Boolean);

    const pins = (game.user.getFlag("fgt", "pins") ?? {})[actor.id] ?? [];

    return {
      portrait: portraitBlock(snapshot, {
        img: actor.img,
        defaultImage: actor.system?.defaultImage ?? null,
        publicName: publicNameOf(unit, board, { id: game.user.id }),
        trueName: actor.name,
        isOwner: actor.isOwner,
      }),
      // `FGT.Resource.*`, which already exist. `FGT.Sheet.Health` is not a key
      // this system has.
      resources: [
        { label: "FGT.Resource.health", value: snapshot.health, max: actor.system?.health?.max ?? null },
        { label: "FGT.Resource.agility", value: actor.system?.agility?.value ?? 0, max: actor.system?.agility?.max ?? null },
        { label: "FGT.Resource.luck", value: actor.system?.luck?.value ?? 0, max: actor.system?.luck?.max ?? null },
      ],
      rows: rowsFor({ actions, abilities, pins }),
      // FACTION-scoped, while everything above is unit-scoped. Two scopes
      // side by side, which is what BG3 does with end-turn beside the hotbar.
      turn: await turnContext(),
    };
  }

  /**
   * Click a slot: an action, or an ability.
   *
   * A refusal is REPORTED. Every engine here already returns `{ok, reason}`,
   * and swallowing one is how a player concludes the system is broken.
   *
   * @this {ActionBar}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async onUseSlot(_event, target) {
    const actor = this.token?.actor;
    if (!actor) return;

    // The row is read from the DOM ancestor rather than trusted from the
    // button's own attribute. Both are written, but only the ancestor cannot
    // be silently empty: `{{../row.id}}` rendered as "" under Handlebars block
    // params and this handler returned without a word, which is exactly the
    // silent no-op this bar exists to stop doing.
    const row = target.dataset.row || target.closest(".fgt-bar__row")?.dataset?.row || "";
    const id = target.dataset.slot;

    if (row === "actions") {
      const { performAction } = await import("../../engine/actions.mjs");
      const board = currentBoard();
      const snapshot = unitSnapshot(actor, this.token.document);
      const entry = availableActions(snapshot, board).find((a) => a.id === id);
      if (!entry) return;

      if (id === "facing") return this.turnFacing(actor, 1);

      // A targeted action that is not the attack flow hands off to the canvas
      // rather than resolving here: it needs a destination first.
      if (entry.mode === "targeted" && id !== "attack") {
        Hooks.callAll("fgtEnterMovement", this.token);
        return;
      }

      const result = await performAction(id, { actor, token: this.token, context: entry.context });
      if (result?.ok === false) ui.notifications.warn(refusalText(result.reason));
      return;
    }

    const item = actor.items.get(id);
    if (!item) return;
    const { FGTActorSheet } = await import("../index.mjs");
    if (classifyAbility(item).toggles) {
      await item.update({ "system.active": !item.system?.active });
      return;
    }
    if (classifyAbility(item).isAttack) await FGTActorSheet.declareAttack(actor, item);
    else await FGTActorSheet.useSkill(actor, item);
  }

  /**
   * Turn the facing dial.
   *
   * §29.5 is explicit that this must **not** end the turn: facing is a
   * correction a player makes while thinking. Left-click turns 45° clockwise
   * and right-click 45° anticlockwise, so any of the eight is at most four
   * clicks away either way.
   *
   * @param {object} actor
   * @param {number} steps
   * @returns {Promise<void>}
   */
  async turnFacing(actor, steps) {
    const current = FACINGS.includes(actor.system?.facing) ? actor.system.facing : "n";
    const next = FACINGS[(FACINGS.indexOf(current) + steps + FACINGS.length) % FACINGS.length];
    const { performAction } = await import("../../engine/actions.mjs");
    await performAction("facing", { actor, context: { facing: next } });
  }

  /** @inheritdoc */
  _onRender(context, options) {
    super._onRender(context, options);

    for (const el of this.element.querySelectorAll("[data-slot]")) {
      el.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const actor = this.token?.actor;
        if (!actor) return;
        // Right-click on the dial is the other direction; on an ability it
        // pins. The HUD has no context menu of its own, so losing it costs
        // nothing here.
        const elRow = el.dataset.row || el.closest(".fgt-bar__row")?.dataset?.row || "";
        if (el.dataset.slot === "facing") return this.turnFacing(actor, -1);
        if (elRow === "actions") return undefined;
        return this.togglePin(actor.id, el.dataset.slot);
      });
    }

    // The facing arrow points where the unit is facing, rotated in place.
    const dial = this.element.querySelector('[data-slot="facing"] .fgt-slot__icon');
    const facing = this.token?.actor?.system?.facing;
    if (dial && FACINGS.includes(facing)) {
      dial.style.transform = `rotate(${FACINGS.indexOf(facing) * 45 - 45}deg)`;
    }
  }

  /**
   * Pin or unpin a slot.
   *
   * A USER flag, not actor data: a pin is one player's shortcut, and storing
   * it on the actor would let one player rearrange another's bar and would
   * need a socket to sync. The auto rows always show everything, so a pin can
   * never hide an ability.
   *
   * @param {string} actorId
   * @param {string} abilityId
   * @returns {Promise<void>}
   */
  async togglePin(actorId, abilityId) {
    const all = foundry.utils.deepClone(game.user.getFlag("fgt", "pins") ?? {});
    const current = all[actorId] ?? [];
    all[actorId] = current.includes(abilityId)
      ? current.filter((pinned) => pinned !== abilityId)
      : [...current, abilityId];
    await game.user.setFlag("fgt", "pins", all);
    this.render({ force: true });
  }
}

/**
 * A refusal, in words a player can read.
 *
 * The engines do not agree on what `reason` is. `placeMark` and `gather`
 * return short ids (`alreadyMarked`, `noHgobOwner`) that key a translation;
 * `engine/budget.mjs#affordable` returns a finished English sentence
 * (*"Servant attacks exhausted (2/2)"*). Localizing blindly printed
 * `FGT.Action.Refusal.Servant attacks exhausted (2/2)` on screen, which is
 * worse than either — so a reason with no translation is shown as it stands.
 *
 * @param {string|undefined} reason
 * @returns {string}
 */
function refusalText(reason) {
  if (!reason) return game.i18n.localize("FGT.Action.Refusal.unavailable");
  const key = `FGT.Action.Refusal.${reason}`;
  return game.i18n.has(key) ? game.i18n.localize(key) : reason;
}

/**
 * The eight compass points, in clockwise order. Index arithmetic on this array
 * is what makes the dial turn, and `rules/snapshot.mjs` uses the same order.
 */
export const FACINGS = Object.freeze(["n", "ne", "e", "se", "s", "sw", "w", "nw"]);
