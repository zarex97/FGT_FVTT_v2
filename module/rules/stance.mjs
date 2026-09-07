/**
 * @file A stance — a per-action declaration, free but window-constrained.
 * @see docs/44-case-expanded-roster.md §44.1
 *
 * Layer 2. Pure: every question here is answered from a Unit projection and a
 * named moment, and nothing writes.
 *
 * **Why this is not a mode.** Ch. 44 §44.1 makes the argument and it is worth
 * keeping next to the code: a mode (Ch. 15 §15.6) carries a duration, a
 * cooldown and a toggle lock, and a compulsion may force one on. A stance has
 * none of those — switching is free — and what it has instead is a set of
 * moments at which switching is allowed at all, plus a default it is dragged
 * back to whenever it is not its owner's Turn. Building it as a mode would mean
 * inventing a null duration, a null cooldown and a null lock, and then still
 * having nowhere to put *"always Dismounted when it is not his Turn"*.
 *
 * Achilles is the only bearer in either roster:
 *
 * > *"When Achilles Acts, the player must state whether he is Mounted, or
 * > Dismounted. Achilles is always Dismounted when it is not his Turn. If
 * > Mounted at the start of a Combat Phase, Achilles can Dismount at the start
 * > of the Combat Phase; but he cannot Mount his chariot when he initiates
 * > Combat while Dismounted."*
 *
 * Three sentences, three different kinds of rule: a declaration, a forced
 * default, and one asymmetric transition. The spec on the sheet says all three
 * and this module reads them back.
 */

/**
 * The moments a stance may be asked about.
 *
 * `declare` is the Unit choosing the stance it acts in; the rest are moments
 * inside a Combat Process at which a `transitions` entry may fire.
 *
 * @type {readonly string[]}
 */
export const STANCE_WINDOWS = Object.freeze([
  "declare", "combatPhaseStart", "damageStep", "turnEnd",
]);

/**
 * The stance a Unit is in.
 *
 * A stored value outside the spec's `states` reads back as the default rather
 * than as itself: that is a bug somewhere else, and reporting a state no rule
 * knows about would spread it.
 *
 * @param {object} unit a Unit projection
 * @returns {string|null} `null` for a Unit with no stance, which is every Unit but one
 */
export function stanceOf(unit) {
  const spec = unit?.stanceSpec ?? null;
  if (!spec?.states?.length) return null;
  const current = unit.stance ?? "";
  return spec.states.includes(current) ? current : (spec.default ?? spec.states[0]);
}

/**
 * May this Unit change to `to` at this moment?
 *
 * A Unit with no stance says yes to everything, so a caller may ask without
 * first checking whether there is a stance to constrain.
 *
 * @param {object} unit a Unit projection
 * @param {string} to the state being entered
 * @param {object} [ctx]
 * @param {string} [ctx.at] one of {@link STANCE_WINDOWS}
 * @param {boolean} [ctx.acted] has the Unit already acted this Turn?
 * @returns {{ok: boolean, reason?: string}}
 */
export function mayChangeStance(unit, to, { at = "declare", acted = false } = {}) {
  const spec = unit?.stanceSpec ?? null;
  if (!spec?.states?.length) return { ok: true };
  if (!spec.states.includes(to)) return { ok: false, reason: "unknownState" };

  const from = stanceOf(unit);
  if (from === to) return { ok: true };

  // The declaration. *"When Achilles Acts, the player must state whether he is
  // Mounted, or Dismounted"* -- the one moment both states are reachable,
  // because it is not a transition at all: it is choosing the stance the action
  // is taken in. Once he has acted the Turn's stance is settled, and the
  // asymmetric transitions below are the only way out of it.
  if (at === "declare") return acted ? { ok: false, reason: "acted" } : { ok: true };

  const allowed = (spec.transitions ?? []).some((t) => t.from === from && t.to === to && t.at === at);
  return allowed ? { ok: true } : { ok: false, reason: "window" };
}

/**
 * The stance this Unit must be dragged into right now, or `null`.
 *
 * *"Achilles is always Dismounted when it is not his Turn"*, which is what makes
 * Achilles' Heel a threat rather than a curiosity: he defends on foot, always,
 * whatever he chose to attack in.
 *
 * `null` when nothing needs writing — including when the Unit is already in the
 * forced state — so the caller writes only on a real change.
 *
 * @param {object} unit a Unit projection
 * @param {object} ctx
 * @param {boolean} ctx.isOwnTurn
 * @returns {string|null}
 */
export function forcedStanceFor(unit, { isOwnTurn }) {
  const spec = unit?.stanceSpec ?? null;
  const forced = spec?.forcedOutsideOwnTurn ?? null;
  if (!forced || isOwnTurn) return null;
  return stanceOf(unit) === forced ? null : forced;
}
