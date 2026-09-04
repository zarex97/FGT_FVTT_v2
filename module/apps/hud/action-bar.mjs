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
import { ticksLabel } from "../actor-sheet/present.mjs";
import { availableActions } from "../../rules/actions.mjs";
import { classifyAbility } from "../../rules/ability-use.mjs";
import { canUseAbility } from "../../rules/costs.mjs";
import { publicNameOf } from "../../rules/identity.mjs";
import { abilityCost, abilityState } from "../actor-sheet/present.mjs";
import { currentBoard, unitSnapshot, unitFrom } from "../../engine/board.mjs";
import { mayDeactivate } from "../../engine/fields.mjs";
import { mayReshape } from "../../rules/bounded-fields.mjs";
import { FACINGS } from "../../domain/enums.mjs";
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

    // Debounced, and this is not a micro-optimisation. `controlToken` fires
    // TWICE when the selection moves: once for the token being released, with
    // nothing controlled at that instant, and once for the new one. Acting on
    // the first closed the application and the second re-opened it, so every
    // switch played a full fade-out and fade-in. One render at 13ms looked
    // like lag because it was bracketed by two animations.
    //
    // The delay also collapses the cascade: selecting a unit can raise
    // `controlToken`, `updateActor` and `fgtBudgetChanged` in one breath, and
    // each of those used to be its own full render.
    const refresh = foundry.utils.debounce(() => {
      const controlled = canvas.tokens?.controlled?.[0] ?? null;
      bar.token = controlled?.actor?.isOwner ? controlled : null;
      if (bar.token) bar.render({ force: true });
      else if (bar.rendered) bar.close();
    }, 60);

    Hooks.on("controlToken", refresh);
    Hooks.on("updateActor", refresh);
    Hooks.on("updateItem", refresh);
    Hooks.on("createActiveEffect", refresh);
    Hooks.on("deleteActiveEffect", refresh);
    Hooks.on("updateCombat", refresh);
    Hooks.on("fgtBudgetChanged", refresh);
    Hooks.on("fgtFieldChanged", refresh);

    // The end-of-turn repaint window, raised by the scheduler once the owner
    // has accepted it (`engine/fields.mjs#offerReshape`). Opened here rather
    // than there because the painter is layer 4 and the scheduler is layer 3.
    Hooks.on("fgtOfferReshape", async ({ fieldId, unitId }) => {
      const board = currentBoard();
      const field = (board.fields ?? []).find((f) => f.id === fieldId);
      const target = (board.units ?? []).find((u) => u.id === unitId);
      if (field && target) await reshape(field, target);
    });

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
          // An ability's refusal goes through `abilityState`, the same mapping
          // the sheet's ability cards use, so the two never disagree about why
          // something is unavailable. `FGT.Action.Refusal.*` stays for the
          // ACTION slots, whose reasons come from the engines instead.
          tooltip: slot.disabled
            ? `${item.name} — ${abilityRefusal(verdict, entry, turnsPerRound)}`
            : item.name,
        };
      })
      .filter(Boolean);

    // The Fields row, moved here from the token HUD. Jack's Mist is the first
    // field in the corpus its owner may end at will, and without a control the
    // `deactivation` spec would be one more authored field with no way to
    // reach it. Most fields carry none and get no slot.
    const fields = [];
    for (const field of board.fields ?? []) {
      const name = nameOfField(field, actor);
      if (mayDeactivate(field, actor.id)) {
        fields.push({
          id: `end:${field.id}`, name, img: null, icon: "fa-solid fa-circle-xmark",
          cost: null, cooldown: null, ring: null, disabled: false, reason: null,
          tooltip: game.i18n.format("FGT.HUD.EndField", { name }),
        });
      }
      if (mayReshape(field, unit)) {
        fields.push({
          id: `reshape:${field.id}`, name, img: null, icon: "fa-solid fa-pen-nib",
          cost: null, cooldown: null, ring: null, disabled: false, reason: null,
          tooltip: game.i18n.format("FGT.HUD.ReshapeField", { name }),
        });
      }
    }

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
      // §6.10's pools — EMIYA's Aria, Semiramis's Construction, Scáthach's PRS
      // Tokens. They gate abilities, so a player choosing what to press needs
      // them where the buttons are and not one tab away on the sheet.
      pools: poolsFor(snapshot.resources),
      rows: rowsFor({ actions, abilities, fields, pins }),
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

    if (row === "fields") {
      const [what, fieldId] = id.split(":");
      const board = currentBoard();
      const field = (board.fields ?? []).find((f) => f.id === fieldId);
      if (!field) return;
      if (what === "reshape") return reshape(field, unitFrom(board, actor));
      // Deactivating is what starts a `countFrom: "deactivation"` cooldown, so
      // this must not be a bare Region delete -- the clock would never start.
      const { deactivateField } = await import("../../engine/fields.mjs");
      await deactivateField(fieldId, "owner");
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

/* -------------------------------------------------------------------------- */

/**
 * Open the painter for a field, and commit what comes back.
 *
 * A cancelled session resolves `null` and writes nothing — including the
 * once-per-Turn flag, so backing out of the painter does not spend the window.
 *
 * Moved here from the token HUD unchanged.
 *
 * @param {object} field
 * @param {object} unit the owner's snapshot
 * @returns {Promise<void>}
 */
async function reshape(field, unit) {
  const { pickPaint } = await import("../canvas/targeting-layer.mjs");
  const panels = await pickPaint({
    anchor: unit.panel,
    maxPanels: field.geometry?.maxPanels ?? 25,
    maxDistance: field.geometry?.maxDistance ?? 4,
    initial: field.panels ?? [],
  });
  if (!panels) return;

  const { repaintField } = await import("../../engine/fields.mjs");
  const verdict = await repaintField(field.id, panels);
  // Named, not swallowed: the painter refuses illegal panels as you draw, so a
  // refusal here means something moved between drawing and committing.
  if (!verdict.ok) ui.notifications.warn(game.i18n.localize(`FGT.Paint.${verdict.reason}`));
}

/**
 * Why an ability is unavailable, in the sheet's own words.
 *
 * `abilityState` is what the ability cards already use, so routing through it
 * means the bar and the sheet cannot describe the same refusal differently. A
 * reason with no translation falls back to the reason itself rather than
 * printing `FGT.Ability.Refused.withinPlatformCentre` at a player.
 *
 * @param {{ok: boolean, reason?: string}} verdict
 * @param {object} entry the snapshot's ability entry
 * @param {number} turnsPerRound
 * @returns {string}
 */
function abilityRefusal(verdict, entry, turnsPerRound) {
  if (verdict?.ok === false) {
    const state = abilityState(verdict, { turnsPerRound });
    if (game.i18n.has(state.label)) return game.i18n.format(state.label, state.detail ?? {});
    return verdict.reason ?? game.i18n.localize("FGT.Action.Refusal.unavailable");
  }
  // Not refused, so the only thing left that disables a slot is its cooldown.
  const remaining = entry?.cooldownRemaining ?? 0;
  return game.i18n.format("FGT.Ability.Cooldown", {
    remaining, ticks: ticksLabel(remaining, turnsPerRound),
  });
}

/**
 * §6.10's pools, labelled for a reader.
 *
 * `FGT.Pool.<key>` when a translation exists, and the camelCase key split into
 * words when it does not — so a pool a future Servant introduces shows as
 * "Some New Pool" rather than as `someNewPool`, and never as nothing.
 *
 * @param {Record<string, {value: number, max: number|null}>} resources
 * @returns {Array<{key: string, label: string, value: number, max: number|null}>}
 */
function poolsFor(resources) {
  return Object.entries(resources ?? {}).map(([key, pool]) => {
    const translation = `FGT.Pool.${key}`;
    return {
      key,
      label: game.i18n.has(translation) ? game.i18n.localize(translation) : humanise(key),
      value: pool?.value ?? 0,
      max: pool?.max ?? null,
    };
  });
}

/**
 * `hgobConstruction` → `Hgob Construction`.
 * @param {string} key
 * @returns {string}
 */
function humanise(key) {
  const spaced = String(key).replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * The ability's own name, so the slot says what it will close rather than
 * naming a content id.
 *
 * @param {object} field
 * @param {object} actor
 * @returns {string}
 */
function nameOfField(field, actor) {
  const item = actor.items.find((i) => i.system?.contentId === field.id);
  return item?.name ?? field.id;
}
