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
 *   4. **Held on by a condition** — Raikou: *"When Raikou's Master is within a
 *      2 panel area of herself, her Mad Enhancement is constantly Active and
 *      cannot be deactivated."*
 *
 * The last two are the interesting ones, because they force the mode **on** as
 * well as refusing to let it off — so this file answers two questions, not one.
 *
 * They are also not the same mechanism, though they read alike. A compulsion is
 * evaluated per OTHER UNIT and its relation vocabulary is `ally`/`enemy`, which
 * cannot say *her own Master* as against *any allied Master*; and Penthesilea's
 * forces a target where Raikou's forces nothing. A `ForceMode` rule states the
 * condition directly instead, and {@link forcedOn} answers it LATE — every
 * time it is asked — so it lifts the instant the Master steps away, with no
 * cleanup step to forget.
 */

import { parseTick, resolveTicks } from "../domain/tick.mjs";
import { test as testPredicate } from "./predicate.mjs";
import { rollOptionsFor } from "./options.mjs";

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
 * @param {boolean} [ctx.clockRunning] whether a started match is keeping time
 * @returns {ToggleVerdict}
 */
export function canToggleMode(
  item, unit, { active, tick = 0, turnsPerRound = 3, clockRunning = true } = {},
) {
  const sys = item?.system ?? {};

  // A lockout stamped against a clock that does not exist. `toggledAt` is
  // written as the current tick, and out of a match every reader of the tick
  // falls back to 0 -- so the window is measured against whatever the *next*
  // match is reading by the time the player tries to switch back.
  //
  // Scoped to modes that actually carry a lockout, not to every mode: one
  // without `toggleLock` stamps nothing, so there is no clock to get wrong
  // and no reason to stop a GM arranging the board before the match begins.
  if (clockRunning === false && sys.toggleLock) {
    return { ok: false, reason: "noMatch" };
  }

  // A Command-Spell suspension, which OUTRANKS every refusal below it except
  // the toggle lock. Raikou: *"Mad Enhancement can be deactivated for 1◈ Turns
  // by spending a Command Spell"* -- the spell is bought precisely to defeat
  // `ForceMode`, so reading them in the other order would sell the most
  // expensive resource in the game for nothing.
  //
  // It does NOT buy out `toggleLock`, which is checked below and still bites:
  // the sheet names one refusal and says nothing about the other, and a
  // lockout a Command Spell defeats is a different rule from the one on the
  // page.
  const suspended = typeof sys.suspendedUntil === "number" && tick < sys.suspendedUntil;
  // "Deactivated FOR 1◈ Turns" is a span during which it is off, not a single
  // permission to press the button once -- so the bar is on switching back ON.
  if (suspended && active) return { ok: false, reason: "suspended" };

  // Switching OFF something that never switches off.
  if (!active && sys.cannotDeactivate) return { ok: false, reason: "cannotDeactivate" };

  // Compelled on. A compulsion that names this skill holds it there for as
  // long as the compulsion stands, which is a positional question and
  // therefore re-answered every time it is asked.
  if (!active && compelledOn(item, unit)) return { ok: false, reason: "compelled" };

  // Held on by a condition rather than by a neighbour. Positional like a
  // compulsion, and re-answered every time it is asked for the same reason.
  if (!active && !suspended && forcedOn(item, unit)) return { ok: false, reason: "forced" };

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
 * Is this mode currently held ON — by either source?
 *
 * *"While the Skill does not meet the condition to be deactivated"* is the
 * clause that needs it, and it appears on the two Mad Enhancement sheets whose
 * skill is held on positionally: Penthesilea's by *Hatred of Achilles* (a Greek
 * Male within 4 panels) and Raikou's by her Master's proximity. Their Master's
 * Health floor applies **only while the mode cannot be switched off**, which is
 * neither "is it on" nor "does she have it" — the two questions `skillActive`
 * and `skill` already answer.
 *
 * Takes a SLUG rather than an item, because the caller is
 * `rules/options.mjs`, which is looking at a snapshot's ability projection
 * rather than at a document. Both halves are the existing predicates, so a
 * third source of "held on" cannot drift from the refusal `canToggleMode` gives.
 *
 * Deliberately NOT `toggleLock` or `cannotDeactivate`: the lockout says *not
 * yet* and is carried by every bearer of the skill including the three whose
 * sheets grant no floor at all, and `cannotDeactivate` says *never* and belongs
 * to Heracles, whose floor is unconditional and needs no predicate.
 *
 * @param {string} slug
 * @param {object} unit the owner's snapshot
 * @returns {boolean}
 */
export function heldOn(slug, unit) {
  const item = { system: { slug } };
  return compelledOn(item, unit) || forcedOn(item, unit);
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
 * @param {object} unit a snapshot carrying `compulsions` and `forcedModeRules`
 * @param {object[]} items the unit's abilities
 * @param {object} [ctx]
 * @param {number} [ctx.tick] the current global turn, for a live suspension
 * @returns {object[]} the abilities that should be switched on
 */
export function forcedModes(unit, items, { tick = 0 } = {}) {
  const compelled = new Set(
    (unit?.compulsions ?? [])
      .filter((c) => c.forcesSkill && (c.targetIds ?? []).length > 0)
      .map((c) => c.forcesSkill),
  );

  return [...(items ?? [])].filter((i) => {
    const sys = i.system ?? {};
    if (!sys.isMode || sys.active) return false;
    // Bought off for a span. Switching it back on here is precisely what the
    // Command Spell was spent to prevent, and this is the half that would
    // undo it: `reconcileForcedModes` runs on every invalidation.
    if (typeof sys.suspendedUntil === "number" && tick < sys.suspendedUntil) return false;
    // Either source switches it on. `forcedOn` is asked per item because its
    // rule names the mode's own slug.
    return compelled.has(sys.slug ?? i.id) || forcedOn(i, unit);
  });
}

/**
 * Is a `ForceMode` rule currently holding this mode on?
 *
 * Matched on the ability's **slug**, which is what the rule names and what a
 * display name is not — the same key {@link compelledOn} matches, and the same
 * reason `class-mad-enhancement` states `slug: madEnhancement` by hand.
 *
 * The condition is tested HERE rather than at collection time, and that is the
 * whole point of the element: it is positional, so an answer frozen into the
 * snapshot would leave Mad Enhancement stuck on or stuck off depending on where
 * the Master happened to be standing when the board was built.
 *
 * @param {object} item the ability, or any `{system}` shape
 * @param {object} unit the owner's snapshot, carrying `forcedModeRules`
 * @returns {boolean}
 */
export function forcedOn(item, unit) {
  const slug = item?.system?.slug ?? item?.id ?? null;
  if (!slug) return false;

  const rules = (unit?.forcedModeRules ?? []).filter((r) => r.mode === slug);
  if (rules.length === 0) return false;

  // `withoutModeHeld`: this call is INSIDE the answer to "is a mode held",
  // and asking for that option here would re-enter this function for ever.
  const options = rollOptionsFor({ attacker: unit, defender: null, withoutModeHeld: true });
  return rules.some((r) => testPredicate(r.when, { options }));
}
