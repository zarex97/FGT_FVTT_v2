/**
 * @file F/GT controls on Foundry's token HUD.
 * @see docs/29-user-interface.md §29.5
 *
 * Layer 4. Extends the HUD rather than replacing it, so Foundry's own controls
 * (visibility, combat, target) keep working.
 *
 * §29.5's argument for the **budget indicator** is the one worth keeping: a
 * player with seven Servants should not have to remember which of them has
 * already acted. Putting it on the token means the answer is wherever they are
 * already looking, rather than in a HUD they have to open per unit.
 *
 * Everything here is a shortcut to something that already exists — the attack
 * flow, the movement mode, mode toggles. Nothing resolves anything itself,
 * because a second path into a resolution is a second place for it to be wrong.
 */

import { classifyAbility } from "../../rules/ability-use.mjs";
import { currentBoard, unitFrom } from "../../engine/board.mjs";
import { budgetFor } from "../../engine/budget.mjs";
import { mayDeactivate } from "../../engine/fields.mjs";
import { mayReshape } from "../../rules/bounded-fields.mjs";

/** How many abilities the quick-bar shows. §29.5 says up to six. */
const QUICK_BAR = 6;

/**
 * Attach to the token HUD. Called from `ready`.
 */
export function attachTokenHUD() {
  Hooks.on("renderTokenHUD", (hud, html, data) => {
    const root = html instanceof HTMLElement ? html : html?.[0];
    const token = canvas.tokens.get(data._id);
    const actor = token?.actor;
    if (!root || !actor?.isOwner) return;

    const column = document.createElement("div");
    column.className = "col fgt-hud";

    column.append(...controls(actor, token));
    root.querySelector(".col.right")?.after(column) ?? root.append(column);
  });

  // The dial reads its arrow from `system.facing` at render time, so the HUD
  // has to be told when that changes — including when somebody else changes it.
  // Foundry re-renders the token HUD for its own document's updates, never for
  // the Actor's.
  Hooks.on("updateActor", (actor, changes) => {
    if (!(changes.system && "facing" in changes.system)) return;
    const hud = canvas.hud?.token;
    if (hud?.rendered && hud.object?.actor?.id === actor.id) hud.render();
  });

  // The end-of-turn repaint window, raised by the scheduler once the owner has
  // accepted it (`engine/fields.mjs#offerReshape`). Opened here rather than
  // there because the painter is layer 4 and the scheduler is layer 3.
  Hooks.on("fgtOfferReshape", async ({ fieldId, unitId }) => {
    const board = currentBoard();
    const field = (board.fields ?? []).find((f) => f.id === fieldId);
    const unit = (board.units ?? []).find((u) => u.id === unitId);
    if (field && unit) await reshape(field, unit);
  });
}

/* -------------------------------------------------------------------------- */

/**
 * @param {object} actor
 * @param {object} token
 * @returns {HTMLElement[]}
 */
function controls(actor, token) {
  const board = currentBoard();
  const unit = unitFrom(board, actor);
  const state = actor.system?.turnState ?? {};
  const stale = state.tick !== (game.combat?.system?.globalTurn ?? 0);

  return [
    budgetPip(state, stale),
    button("attack", "fa-solid fa-khanda", "FGT.HUD.Attack", () => declare(actor, null)),
    button("move", "fa-solid fa-shoe-prints", "FGT.HUD.Move", () => enterMovement(token)),
    facingDial(actor),
    ...quickBar(actor),
    ...modeToggles(actor),
    ...fieldSwitches(actor, board),
    effectPips(unit),
  ].filter(Boolean);
}

/**
 * A switch for each open bounded field this unit may close.
 *
 * Jack's Mist is the first field in the corpus its owner may end at will —
 * *"This NP can be deactivated at any time … during her Turn or at the start or
 * end of any Turn or Round"* — and without a control the `deactivation` spec
 * would be one more authored field with no way to reach it. Most fields carry
 * none and get no button: a Reality Marble runs its clock out.
 *
 * Deactivating is what starts an ability's `countFrom: "deactivation"` cooldown
 * (`engine/fields.mjs#deactivateField`), so this must not be a bare Region
 * delete — the clock would never start.
 *
 * @param {object} actor
 * @param {object} board
 * @returns {HTMLElement[]}
 */
function fieldSwitches(actor, board) {
  const unit = unitFrom(board, actor);
  /** @type {HTMLElement[]} */
  const out = [];

  for (const field of board?.fields ?? []) {
    if (mayDeactivate(field, actor.id)) {
      out.push(button(
        `field-${field.id}`,
        "fa-solid fa-circle-xmark",
        null,
        async () => {
          const { deactivateField } = await import("../../engine/fields.mjs");
          await deactivateField(field.id, "owner");
        },
        game.i18n.format("FGT.HUD.EndField", { name: nameOfField(field, actor) }),
      ));
    }
    // `mayReshape` takes a SNAPSHOT, not the actor: it reads `turnState`, which
    // the document does not carry in the same shape.
    if (mayReshape(field, unit)) {
      out.push(button(
        `reshape-${field.id}`,
        "fa-solid fa-pen-nib",
        null,
        () => reshape(field, unit),
        game.i18n.format("FGT.HUD.ReshapeField", { name: nameOfField(field, actor) }),
      ));
    }
  }
  return out;
}

/**
 * Open the painter for a field, and commit what comes back.
 *
 * A cancelled session resolves `null` and writes nothing — including the
 * once-per-Turn flag, so backing out of the painter does not spend the window.
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
 * The ability's own name, so the button says what it will close rather than
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

/**
 * The budget indicator — a dot whose colour says what is left.
 *
 * Turn state is **stale by reading**, not by writing: a state stamped with an
 * earlier tick is spent, whatever it says. That is why a missed reset hook
 * cannot leave a Servant looking exhausted for the rest of the match.
 *
 * @param {object} state
 * @param {boolean} stale
 * @returns {HTMLElement}
 */
function budgetPip(state, stale) {
  const moved = !stale && state.moved;
  const attacked = !stale && state.attacked;

  const el = document.createElement("div");
  el.className = "control-icon fgt-hud__budget";
  el.dataset.tooltip = game.i18n.format("FGT.HUD.Budget", {
    move: game.i18n.localize(moved ? "FGT.HUD.Spent" : "FGT.HUD.Ready"),
    attack: game.i18n.localize(attacked ? "FGT.HUD.Spent" : "FGT.HUD.Ready"),
  });
  el.innerHTML = `<span class="fgt-hud__dot fgt-hud__dot--${moved && attacked ? "done" : moved || attacked ? "part" : "fresh"}"></span>`;
  return el;
}

/**
 * The eight compass points, in clockwise order. Index arithmetic on this array
 * is what makes the dial turn, and `rules/snapshot.mjs` uses the same order.
 */
export const FACINGS = Object.freeze(["n", "ne", "e", "se", "s", "sw", "w", "nw"]);

/**
 * The facing dial.
 *
 * §29.5 is explicit that this must **not** end the turn: facing is a correction
 * a player makes while thinking, and a control that spent their turn for them
 * would be worse than no control.
 *
 * **This was a `<select>`, and it was unusable.** Foundry's `.control-icon` is
 * a fixed 35px square built to hold one glyph; a native select inside it,
 * stretched to `width: 100%` with the theme's own `0 8px` padding, measured
 * **25px wide with 16px of that spent on padding** — nine pixels of content box
 * for "South-west", plus a dropdown arrow that alone is wider than that. It
 * rendered as an empty grey sliver: the current facing could not be read, and
 * neither could any option. Measured live before it was replaced.
 *
 * So the control is now what the box is shaped for — one arrow, pointing the
 * way the unit faces. Left-click turns it 45° clockwise, right-click 45°
 * anticlockwise, so any of the eight is at most four clicks away in either
 * direction. The board is where the answer is read (`apps/canvas/token.mjs`
 * draws the same heading on the token itself), which is what lets this be a
 * turn-by-turn control rather than a menu.
 *
 * @param {object} actor
 * @returns {HTMLElement}
 */
function facingDial(actor) {
  const current = FACINGS.includes(actor.system?.facing) ? actor.system.facing : "n";

  const el = document.createElement("div");
  el.className = "control-icon fgt-hud__facing";
  el.dataset.tooltip = game.i18n.format("FGT.HUD.Facing", {
    facing: game.i18n.localize(`FGT.Facing.${current}`),
  });

  // One glyph, rotated. `fa-location-arrow` points north-east at rest, so the
  // base rotation is -45deg and each compass step adds 45.
  const icon = document.createElement("i");
  icon.className = "fa-solid fa-location-arrow fgt-hud__facing-arrow";
  icon.style.transform = `rotate(${FACINGS.indexOf(current) * 45 - 45}deg)`;
  el.append(icon);

  const turn = (steps) => {
    const next = FACINGS[(FACINGS.indexOf(current) + steps + FACINGS.length) % FACINGS.length];
    return actor.update({ "system.facing": next });
  };
  el.addEventListener("click", () => turn(1));
  // Right-click is the other direction rather than a context menu: the HUD has
  // no context menu of its own, and losing it costs nothing here.
  el.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    event.stopPropagation();
    return turn(-1);
  });

  return el;
}

/**
 * Up to six ready abilities, one click each.
 *
 * **Ready** is the filter: an ability on cooldown is not offered, because a
 * button that refuses when pressed teaches nothing that a missing button does
 * not teach faster.
 *
 * @param {object} actor
 * @returns {HTMLElement[]}
 */
function quickBar(actor) {
  return actor.items
    .filter((i) => {
      const use = classifyAbility(i);
      return use.clickable && !use.toggles && (i.system?.cooldown?.remaining ?? 0) === 0;
    })
    .slice(0, QUICK_BAR)
    .map((item) => button(
      `ability-${item.id}`,
      "fa-solid fa-wand-sparkles",
      null,
      () => declare(actor, item),
      item.name,
    ));
}

/**
 * Mode toggles, with their cooldowns.
 * @param {object} actor
 * @returns {HTMLElement[]}
 */
function modeToggles(actor) {
  return actor.items
    .filter((i) => classifyAbility(i).toggles)
    .map((item) => {
      const on = Boolean(item.system?.active);
      const locked = on && item.system?.cannotDeactivate;
      const el = button(
        `mode-${item.id}`,
        on ? "fa-solid fa-toggle-on" : "fa-solid fa-toggle-off",
        null,
        // A mode that cannot be deactivated says so rather than silently doing
        // nothing -- Mad Enhancement is the case, and a dead control is how a
        // player concludes the system is broken.
        () => (locked
          ? ui.notifications.warn(game.i18n.format("FGT.Ability.CannotDeactivate", { name: item.name }))
          : item.update({ "system.active": !on })),
        `${item.name}${item.system?.cooldown?.remaining ? ` (${item.system.cooldown.remaining})` : ""}`,
      );
      if (on) el.classList.add("active");
      return el;
    });
}

/**
 * Effect pips — hover for the full list.
 * @param {object} unit
 * @returns {HTMLElement|null}
 */
function effectPips(unit) {
  // §11.10's `visibility`, honoured for the first time. The field has been on
  // the instance schema since `0.2.0` and nothing anywhere read it, so
  // `gmOnly` did nothing at all -- and Serenity's Secret Poison would have
  // announced itself on the victim's own HUD the moment it landed.
  //
  // Only the EXPLICIT settings are applied here, not §11.10's polarity default.
  // The default would hide every ordinary buff from everyone but its bearer,
  // which is a much larger change than this hook is entitled to make and one no
  // sheet in the reference set asks for.
  const restricted = new Set(
    (unit?.effectInstances ?? [])
      .filter((e) => e.visibility === "gmOnly" || e.visibility === "ownerOnly")
      .filter((e) => !(e.visibility === "ownerOnly" && ownsUnit(unit)))
      .map((e) => e.defId),
  );
  const effects = (unit?.effects ?? []).filter((id) => game.user.isGM || !restricted.has(id));
  if (effects.length === 0) return null;

  const el = document.createElement("div");
  el.className = "control-icon fgt-hud__effects";
  el.dataset.tooltip = effects.join(", ");
  el.textContent = String(effects.length);
  return el;
}

/**
 * Does the current user control this Unit?
 * @param {object} unit
 * @returns {boolean}
 */
function ownsUnit(unit) {
  return Boolean(game.actors.get(unit?.id)?.isOwner);
}

/**
 * @param {string} key
 * @param {string} icon
 * @param {string|null} tooltipKey
 * @param {() => unknown} onClick
 * @param {string} [tooltipText]
 * @returns {HTMLElement}
 */
function button(key, icon, tooltipKey, onClick, tooltipText) {
  const el = document.createElement("div");
  el.className = `control-icon fgt-hud__${key}`;
  el.dataset.tooltip = tooltipText ?? (tooltipKey ? game.i18n.localize(tooltipKey) : "");
  el.innerHTML = `<i class="${icon}"></i>`;
  el.addEventListener("click", onClick);
  return el;
}

/**
 * Hand off to the sheet's own declaration path.
 *
 * Imported lazily and reused rather than reimplemented: a second path into a
 * resolution is a second place for it to be wrong, and this one would be the
 * copy nobody updated.
 *
 * @param {object} actor
 * @param {object|null} ability
 */
async function declare(actor, ability) {
  const { FGTActorSheet } = await import("../index.mjs");
  // Same split as the sheet: a Skill is not an Attack, and the quick-bar must
  // not be the one place that still sends one into a Combat Process.
  if (ability && !classifyAbility(ability).isAttack) {
    return FGTActorSheet.useSkill(actor, ability);
  }
  return FGTActorSheet.declareAttack(actor, ability);
}

/** @param {object} token */
function enterMovement(token) {
  Hooks.callAll("fgtEnterMovement", token);
}

/**
 * Whether this unit has anything left, for callers that want the number rather
 * than the dot.
 * @param {object} actor
 * @returns {object|null}
 */
export function remainingBudget(actor) {
  const combat = game.combats?.active;
  if (!combat?.started) return null;
  // Keyed by FACTION: the budget is a faction's, and passing a unit here would
  // silently look up `undefined` and report a fresh budget for everyone.
  return budgetFor(combat, actor.system?.factionId ?? null);
}
