/**
 * @file The targeting preview panel.
 * @see docs/28-targeting-implementation.md §28.6
 *
 * Layer 4. Every line it shows comes from data the resolution already produced:
 * the target list from `ResolvedTargets`, the damage range from a speculative
 * run of the real pipeline (§28.7), and the failure text from the resolver's
 * own error strings.
 *
 * It renders itself rather than going through ApplicationV2 because it follows
 * the pointer at frame rate; an Application's render cycle is the wrong tool
 * for something that updates on pointer-move.
 */

import { formatRange } from "../../rules/preview.mjs";

export class TargetingHUD {
  /** @type {HTMLElement|null} */
  #element = null;

  /** @type {string} */
  #label;

  /** @type {Function|null} */
  #damageFor;

  /** The pointer handler, kept so `close` can remove it. */
  #follow = null;

  /**
   * @param {object} [args]
   * @param {string} [args.label] the ability's name
   * @param {Function} [args.damageFor] `(unitId) => {min, max, certain}` or null
   */
  constructor({ label = "", damageFor = null } = {}) {
    this.#label = label;
    this.#damageFor = damageFor;
  }

  /**
   * Redraw for one placement option.
   *
   * @param {object|null} option `{legal, reasons, resolved}`, or null for "nothing under the cursor"
   */
  update(option) {
    const el = this.#ensure();
    if (!option) {
      el.innerHTML = `<div class="fgt-preview__header">${escape(this.#label)}</div>
        <div class="fgt-preview__empty">${game.i18n.localize("FGT.Targeting.ChoosePanel")}</div>`;
      return;
    }

    const targets = option.resolved?.units ?? [];
    const rows = targets.map((t) => this.#row(t)).join("");

    // Warnings are shown for a LEGAL placement too — `grailAtRisk` is legal and
    // catastrophic, which is exactly the case a preview exists to surface.
    const warnings = (option.resolved?.warnings ?? [])
      .map((w) => `<div class="fgt-preview__warning">⚠ ${escape(w)}</div>`).join("");
    const reasons = (option.reasons ?? [])
      .map((r) => `<div class="fgt-preview__reason">${escape(r)}</div>`).join("");

    el.innerHTML = `
      <div class="fgt-preview__header">${escape(this.#label)}</div>
      <div class="fgt-preview__meta">
        ${targets.length} ${game.i18n.localize("FGT.Targeting.Targets")} ·
        ${option.resolved?.panels?.length ?? 0} ${game.i18n.localize("FGT.Targeting.Panels")}
      </div>
      ${rows ? `<div class="fgt-preview__targets">${rows}</div>` : ""}
      ${warnings}
      ${reasons}
      <div class="fgt-preview__verdict fgt-preview__verdict--${option.legal ? "ok" : "no"}">
        ${game.i18n.localize(option.legal ? "FGT.Targeting.Legal" : "FGT.Targeting.Illegal")}
      </div>`;
  }

  /** Remove the panel and stop following the pointer. */
  close() {
    if (this.#follow) window.removeEventListener("pointermove", this.#follow);
    this.#follow = null;
    this.#element?.remove();
    this.#element = null;
  }

  /* ------------------------------------------------------------------------ */

  /**
   * @param {object} target a `TargetedUnit`
   * @returns {string}
   */
  #row(target) {
    const actor = game.actors.get(target.unitId);
    const name = escape(actor?.name ?? target.unitId);
    const range = this.#damageFor?.(target.unitId) ?? null;
    const damage = range ? `<span class="fgt-preview__damage">${escape(formatRange(range))}</span>` : "";
    const band = target.band ? `<span class="fgt-preview__band">band ${target.band}</span>` : "";
    return `<div class="fgt-preview__target">
      <span class="fgt-preview__name">${name}</span>${band}${damage}
    </div>`;
  }

  /**
   * @returns {HTMLElement}
   */
  #ensure() {
    if (this.#element?.isConnected) return this.#element;
    const el = document.createElement("aside");
    el.className = "fgt-preview";
    el.id = "fgt-targeting-preview";
    document.body.appendChild(el);

    // Follows the cursor, offset so it never sits under the pointer and hides
    // the panel the player is aiming at.
    this.#follow = (event) => {
      el.style.left = `${event.clientX + 18}px`;
      el.style.top = `${event.clientY + 18}px`;
    };
    window.addEventListener("pointermove", this.#follow);
    this.#element = el;
    return el;
  }
}

/**
 * @param {string} text
 * @returns {string}
 */
function escape(text) {
  return foundry.utils.escapeHTML(String(text ?? ""));
}
