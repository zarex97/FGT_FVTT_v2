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

  /** An override for the empty-state hint, so each mode names its own keys. */
  #emptyHint = null;

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
   * Replace the header text and redraw.
   *
   * `update(option)` renders a placement PREVIEW and has nothing to show when
   * there is no placement — which is every moment of a freeform paint session,
   * where the only status worth reporting is how many panels are down. Mode E
   * sets the count here and lets `update(null)` render the header plus the
   * choose-a-panel hint.
   *
   * @param {string} label
   * @returns {void}
   */
  setLabel(label, hint = null) {
    this.#label = label;
    this.#emptyHint = hint;
    this.update(null);
  }

  /**
   * Redraw for one placement option.
   *
   * @param {object|null} option `{legal, reasons, resolved}`, or null for "nothing under the cursor"
   */
  update(option) {
    const el = this.#ensure();
    if (!option) {
      // The empty-state hint is overridable because it names the CONTROLS, and
      // mode E's are not mode B's -- "right-click or Escape to cancel" is a lie
      // in a session where Enter confirms and right-click does nothing.
      const hint = this.#emptyHint ?? game.i18n.localize("FGT.Targeting.ChoosePanel");
      el.innerHTML = `<div class="fgt-preview__header">${escape(this.#label)}</div>
        <div class="fgt-preview__empty">${escape(hint)}</div>`;
      return;
    }

    const targets = option.resolved?.units ?? [];
    const rows = targets.map((t) => this.#row(t)).join("");

    // Everything the area caught and then dropped, with the reason it was
    // dropped. A unit standing inside the highlight and not in the target list
    // is the single most confusing thing a targeting preview can show, and the
    // player has no way to work out why on their own (§28.6).
    const excluded = (option.resolved?.excluded ?? []).map((e) => this.#excludedRow(e)).join("");

    // Warnings are shown for a LEGAL placement too — `grailAtRisk` is legal and
    // catastrophic, which is exactly the case a preview exists to surface.
    const warnings = (option.resolved?.warnings ?? [])
      .map((w) => `<div class="fgt-preview__warning">⚠ ${escape(w)}</div>`).join("");
    // §28.8: each refusal rendered with its own numbers and its own KIND. A
    // refusal a Command Spell can lift carries the offer inline, because the
    // moment a player learns they cannot do something is the moment to tell
    // them what would let them.
    const presented = option.presented ?? [];
    const reasons = presented.length > 0
      ? presented.map((p) => `
          <div class="fgt-preview__reason fgt-preview__reason--${p.kind}">
            ${escape(game.i18n.format(p.i18n, p.params))}
            ${p.kind === "overridable"
    ? `<span class="fgt-preview__override">${escape(game.i18n.localize("FGT.Legality.Override"))}</span>`
    : ""}
          </div>`).join("")
      : (option.reasons ?? [])
        .map((r) => `<div class="fgt-preview__reason">${escape(r)}</div>`).join("");

    // A legal-but-catastrophic placement asks a second time. Distinct from a
    // refusal: the player CAN do it, and the interface must not imply otherwise.
    const confirm = option.needsConfirm
      ? `<div class="fgt-preview__confirm">${escape(game.i18n.localize(
        option.confirmed ? "FGT.Legality.ConfirmGrail" : "FGT.Targeting.ClickAgain",
      ))}</div>`
      : "";

    el.innerHTML = `
      <div class="fgt-preview__header">${escape(this.#label)}</div>
      <div class="fgt-preview__meta">
        ${targets.length} ${game.i18n.localize("FGT.Targeting.Targets")} ·
        ${option.resolved?.panels?.length ?? 0} ${game.i18n.localize("FGT.Targeting.Panels")}
      </div>
      ${rows ? `<div class="fgt-preview__targets">${rows}</div>` : ""}
      ${excluded ? `<div class="fgt-preview__excluded">
        <div class="fgt-preview__excluded-head">${game.i18n.localize("FGT.Targeting.Excluded")}</div>
        ${excluded}</div>` : ""}
      ${warnings}
      ${reasons}
      ${confirm}
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
   * One unit the area caught and the rules dropped.
   * @param {object} entry an `ExcludedUnit`
   * @returns {string}
   */
  #excludedRow(entry) {
    return `<div class="fgt-preview__target fgt-preview__target--excluded">
      <span class="fgt-preview__name">✕ ${escape(entry.name)}</span>
      <span class="fgt-preview__why">${escape(entry.reason)}</span>
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
