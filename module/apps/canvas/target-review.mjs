/**
 * @file The last look before an attack is declared.
 * @see docs/28-targeting-implementation.md §28.6
 *
 * Layer 4.
 *
 * Adapted from `isaacsHBPF2e`'s `reviewTargets`, whose reasoning transfers
 * exactly: the area has already decided who is *in* it, and this is only about
 * who the caster **means**. Two things make that worth a dialog rather than a
 * hover panel.
 *
 * First, the relation rules are guesses about intent — a Charmed ally standing
 * with the enemy is still the same faction — so the caster needs to be able to
 * uncheck one. Second, and the reason this exists at all, everything the rules
 * *excluded* is listed with its reason, so a unit that is plainly inside the
 * highlighted area and plainly not being attacked is never a mystery the player
 * has to debug mid-turn.
 *
 * Re-aim is its own outcome and cannot be folded into either of the others: an
 * empty confirmation is legal (an ability whose effect is not target-dependent
 * may go off with nothing in the area) and cancelling is legal, so collapsing
 * re-aim into either would spend the attack or throw it away.
 */

import { formatRange } from "../../rules/preview.mjs";

/** "Put it somewhere else." A third outcome, distinct from `[]` and from `null`. */
export const REAIM = Symbol("re-aim");

/**
 * Confirm a resolved placement.
 *
 * @param {object} args
 * @param {object} args.resolved a `ResolvedTargets`
 * @param {string} args.label the ability's name
 * @param {Function|null} [args.damageFor] `(unitId) => {min, max}` for the preview
 * @param {boolean} [args.canReaim] whether re-aiming is meaningful for this anchor
 * @returns {Promise<string[]|symbol|null>} chosen unit ids, {@link REAIM}, or null
 */
export async function reviewTargets({ resolved, label, damageFor = null, canReaim = true }) {
  const units = resolved?.units ?? [];
  const excluded = resolved?.excluded ?? [];

  // Nothing caught and nothing excluded is the strongest reason to want another
  // go, so it is the one case where an empty result still asks.
  if (units.length === 0 && excluded.length === 0) {
    if (!canReaim) {
      ui.notifications.info(game.i18n.format("FGT.Targeting.NothingCaught", { name: label }));
      return [];
    }
    const again = await foundry.applications.api.DialogV2.confirm({
      window: { title: label },
      content: `<p>${game.i18n.localize("FGT.Targeting.NothingInArea")}</p>
        <p>${game.i18n.localize("FGT.Targeting.AimAgain")}</p>`,
      rejectClose: false,
    });
    return again ? REAIM : [];
  }

  const rows = units.map((t) => {
    const name = game.actors.get(t.unitId)?.name ?? t.unitId;
    const range = damageFor?.(t.unitId) ?? null;
    return `<li class="fgt-review__row" data-unit-id="${t.unitId}">
      <label>
        <input type="checkbox" name="target" value="${t.unitId}" checked>
        <span class="fgt-review__name">${escape(name)}</span>
      </label>
      ${range ? `<span class="fgt-review__damage">${escape(formatRange(range))}</span>` : ""}
      ${t.band ? `<span class="fgt-review__band">band ${t.band}</span>` : ""}
    </li>`;
  }).join("");

  const excludedRows = excluded.map((e) => `<li class="fgt-review__row fgt-review__row--out">
      <span class="fgt-review__name">✕ ${escape(e.name)}</span>
      <span class="fgt-review__why">${escape(e.reason)}</span>
    </li>`).join("");

  const warnings = (resolved?.warnings ?? [])
    .map((w) => `<p class="fgt-review__warning">⚠ ${escape(w)}</p>`).join("");

  const content = `<div class="fgt-review">
    <p class="fgt-review__meta">${units.length} ${game.i18n.localize("FGT.Targeting.Targets")} ·
      ${resolved?.panels?.length ?? 0} ${game.i18n.localize("FGT.Targeting.Panels")}</p>
    ${rows ? `<ul class="fgt-review__list">${rows}</ul>` : ""}
    ${excludedRows ? `<p class="fgt-review__head">${game.i18n.localize("FGT.Targeting.Excluded")}</p>
      <ul class="fgt-review__list fgt-review__list--out">${excludedRows}</ul>` : ""}
    ${warnings}
  </div>`;

  const buttons = [{
    action: "confirm",
    label: game.i18n.localize("FGT.Targeting.Confirm"),
    icon: "fa-solid fa-crosshairs",
    default: true,
    callback: (_event, _button, dialog) => Array.from(
      dialog.element.querySelectorAll('input[name="target"]:checked'),
      (input) => input.value,
    ),
  }];
  if (canReaim) {
    buttons.push({
      action: "reaim",
      label: game.i18n.localize("FGT.Targeting.Reaim"),
      icon: "fa-solid fa-rotate",
      callback: () => REAIM,
    });
  }
  buttons.push({
    action: "cancel",
    label: game.i18n.localize("FGT.Targeting.Cancel"),
    icon: "fa-solid fa-ban",
    callback: () => null,
  });

  return foundry.applications.api.DialogV2.wait({
    window: { title: label, icon: "fa-solid fa-crosshairs" },
    classes: ["fgt", "fgt-review-dialog"],
    position: { width: 420 },
    content,
    buttons,
    render: (_event, dialog) => highlightOnHover(dialog.element),
    rejectClose: false,
  }).then((result) => result ?? null);
}

/**
 * Hovering a row lights the token on the canvas, so a name in the list is never
 * ambiguous — two Servants of the same class often share one.
 * @param {HTMLElement} html
 */
function highlightOnHover(html) {
  for (const row of html.querySelectorAll("[data-unit-id]")) {
    const token = canvas.tokens?.placeables.find((t) => t.actor?.id === row.dataset.unitId);
    if (!token) continue;
    row.addEventListener("mouseenter", () => {
      try {
        token._onHoverIn(new PointerEvent("pointerenter"), { hoverOutOthers: true });
      } catch { /* hover is a nicety; never let it break the dialog */ }
    });
    row.addEventListener("mouseleave", () => {
      try {
        token._onHoverOut(new PointerEvent("pointerleave"));
      } catch { /* as above */ }
    });
  }
}

/**
 * @param {string} text
 * @returns {string}
 */
function escape(text) {
  return foundry.utils.escapeHTML(String(text ?? ""));
}
