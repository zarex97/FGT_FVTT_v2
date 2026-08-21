/**
 * @file Switching a mode on and off, and the rules that refuse.
 * @see docs/15-abilities.md §15.3, docs/31-case-heracles.md
 *
 * Layer 2 (rules). Pure.
 *
 * A mode is an ability that is *switched* rather than used — Mad Enhancement,
 * Riding's Active, Holder Mode. The toggle itself was a bare write: press the
 * button, flip `system.active`, no questions asked. Every rule about *when* a
 * mode may be switched therefore had nowhere to live, and there are three of
 * them in the reference set:
 *
 *   1. **Never** — Heracles *"cannot deactivate Mad Enhancement"*.
 *   2. **Not yet** — *"when Mad Enhancement is Activated, it can only be
 *      deactivated 2◈ Turns after it was activated, and vice versa."*
 *   3. **Not while** — Penthesilea's *Hatred of Achilles*: *"Mad Enhancement
 *      cannot be deactivated until there are no Greek Male Units within a 4
 *      panel area"*, and it is *"immediately activated regardless of Cooldown
 *      or any other factors"* while one is.
 *
 * The third is the interesting one, because it forces the mode **on** as well
 * as refusing to let it off — so this file answers two questions, not one.
 */

import { parseTick, resolveTicks } from "../domain/tick.mjs";

/**
 * @typedef {object} ToggleVerdict
 * @property {boolean} ok
 * @property {string} [reason]
 * @property {object} [detail]
 */

/**
 * May this mode be switched to `active`?
 *
 * @param {object} item the ability, or any `{system}` shape
 * @param {object} unit the owner's snapshot
 * @param {object} [ctx]
 * @param {boolean} ctx.active the state being switched TO
 * @param {number} [ctx.tick] the current global turn
 * @param {number} [ctx.turnsPerRound]
 * @returns {ToggleVerdict}
 */
export function canToggleMode(item, unit, { active, tick = 0, turnsPerRound = 3 } = {}) {
  const sys = item?.system ?? {};

  // Switching OFF something that never switches off.
  if (!active && sys.cannotDeactivate) return { ok: false, reason: "cannotDeactivate" };

  // Compelled on. A compulsion that names this skill holds it there for as
  // long as the compulsion stands, which is a positional question and
  // therefore re-answered every time it is asked.
  if (!active && compelledOn(item, unit)) return { ok: false, reason: "compelled" };

  // The two-way lockout. "And vice versa" in the source: it governs switching
  // on just as much as switching off, so one clock answers both.
  const lock = sys.toggleLock ?? null;
  if (lock && sys.toggledAt !== null && sys.toggledAt !== undefined) {
    const locked = resolveTicks(parseTick(lock), { turnsPerRound });
    const elapsed = tick - sys.toggledAt;
    if (elapsed < locked) {
      return { ok: false, reason: "toggleLock", detail: { remaining: locked - elapsed } };
    }
  }

  return { ok: true };
}

/**
 * Is a compulsion currently holding this mode on?
 *
 * Matched on the ability's slug, because that is what a compulsion names and a
 * display name can be renamed.
 *
 * @param {object} item
 * @param {object} unit
 * @returns {boolean}
 */
export function compelledOn(item, unit) {
  const slug = item?.system?.slug ?? item?.id ?? null;
  if (!slug) return false;

  return (unit?.compulsions ?? []).some(
    (c) => c.forcesSkill === slug && (c.targetIds ?? []).length > 0,
  );
}

/**
 * Modes a unit's compulsions are currently forcing ON that are switched off.
 *
 * The other half of the same rule, and the reason this file answers two
 * questions: *"her Mad Enhancement is **immediately activated** regardless of
 * Cooldown or any other factors"* is not a refusal to switch off, it is a
 * write. Returned as a list rather than performed, because this layer does not
 * write.
 *
 * @param {object} unit a snapshot carrying `compulsions`
 * @param {object[]} items the unit's abilities
 * @returns {object[]} the abilities that should be switched on
 */
export function forcedModes(unit, items) {
  const forced = new Set(
    (unit?.compulsions ?? [])
      .filter((c) => c.forcesSkill && (c.targetIds ?? []).length > 0)
      .map((c) => c.forcesSkill),
  );
  if (forced.size === 0) return [];

  return [...(items ?? [])].filter((i) => {
    const sys = i.system ?? {};
    if (!sys.isMode || sys.active) return false;
    return forced.has(sys.slug ?? i.id);
  });
}
