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
    effectPips(unit),
  ].filter(Boolean);
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
 * The facing dial.
 *
 * §29.5 is explicit that this must **not** end the turn: facing is a correction
 * a player makes while thinking, and a control that spent their turn for them
 * would be worse than no control.
 *
 * @param {object} actor
 * @returns {HTMLElement}
 */
function facingDial(actor) {
  const el = document.createElement("div");
  el.className = "control-icon fgt-hud__facing";
  el.dataset.tooltip = game.i18n.localize("FGT.HUD.Facing");

  const select = document.createElement("select");
  for (const dir of ["n", "ne", "e", "se", "s", "sw", "w", "nw"]) {
    const option = document.createElement("option");
    option.value = dir;
    option.textContent = game.i18n.localize(`FGT.Facing.${dir}`);
    option.selected = actor.system?.facing === dir;
    select.append(option);
  }
  select.addEventListener("change", () => actor.update({ "system.facing": select.value }));

  el.append(select);
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
