/**
 * @file Servant identity, and Detect.
 * @see docs/04-units.md §4.2, docs/08-board-and-geometry.md §8.7
 *
 * Layer 2 (rules). Pure.
 *
 * A Servant is publicly its **class**, not its name — "Berserker", or
 * "Berserker of Yellow" once it belongs to a named faction. The true name is
 * hidden until revealed, and that is what gives Ch. 26 §26.6's
 * closed-information play something to conceal.
 *
 * Detect is the other half of the same idea from the other direction: the
 * radius at which a unit may **Discover** somebody hiding.
 */

import { chebyshev } from "../domain/geometry.mjs";
import { Rank } from "../domain/rank.mjs";

/** The minimum Detect radius: *"(minimum 2 panels)"*. */
const MIN_DETECT = 2;

/* -------------------------------------------------------------------------- */
/*  Identity                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Is this unit's true name public?
 *
 * Only Servants have one to hide. A Master, a Civilian or a platform is what it
 * appears to be, so asking about them always answers yes rather than leaving
 * callers to special-case the question.
 *
 * @param {object} unit
 * @returns {boolean}
 */
export function isIdentityRevealed(unit) {
  if (unit?.kind !== "servant") return true;
  return Boolean(unit.identityRevealed);
}

/**
 * What everyone else calls this Servant.
 *
 * @param {object} unit
 * @param {object} board
 * @param {object} [viewer]
 * @param {boolean} [viewer.isOwner] the concealment is from opponents, not from
 *   the player running the unit
 * @returns {string}
 */
export function publicNameOf(unit, board, viewer = {}) {
  if (viewer.isOwner || isIdentityRevealed(unit)) {
    return unit?.trueName || titleCase(unit?.classContainer) || "Servant";
  }

  // An explicit override wins: a Servant may be publicly known as something
  // other than its class container.
  if (unit?.concealedIdentity) return unit.concealedIdentity;

  const container = titleCase(unit?.classContainer);
  if (!container) return "Servant";

  const faction = (board?.factions ?? []).find((f) => f.id === unit.faction);
  const label = faction?.name?.trim();
  return label ? `${container} of ${label}` : container;
}

/**
 * @param {string|null|undefined} raw
 * @returns {string}
 */
function titleCase(raw) {
  if (!raw) return "";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/* -------------------------------------------------------------------------- */
/*  Detect                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * How far this unit can Discover a concealed one.
 *
 * *"…Moves into an enemy Unit's Range (Detect)"* with a floor of 2 — so it
 * defaults to attack range and is overridable, because the Golden Hind states
 * `Detect: 4` regardless of its range.
 *
 * The floor applies **after** every modifier: Deafen cannot take a unit below
 * two panels, so a melee unit under Deafen is exactly as perceptive as one
 * without it. That is the rule as written, and worth noting because it makes
 * Deafen useless against short-ranged units rather than merely weak.
 *
 * @param {object} unit
 * @returns {number}
 */
export function detectRangeOf(unit) {
  const base = unit?.detect ?? unit?.range ?? 0;
  const deafened = (unit?.effects ?? []).includes("deafen") ? 1 : 0;
  return Math.max(MIN_DETECT, base - deafened);
}

/**
 * The chance that a watcher Discovers this concealed unit.
 *
 * Drawn from the **concealed** unit's Presence Concealment rank, inverted:
 * EX 0%, A 10%, B 20%, C 40%, D 60%, E 80%, ∓5% per step. A unit with no
 * Presence Concealment is not hidden at all, so it is found for certain.
 *
 * @param {object} concealedUnit
 * @returns {number} percent
 */
export function discoverChance(concealedUnit) {
  const skill = (concealedUnit?.abilities ?? []).find((a) => a.slug === "presenceConcealment");
  if (!skill) return 100;

  const rank = skill.rank instanceof Rank ? skill.rank : Rank.parseOrNull(skill.rank);
  if (!rank) return 100;

  const byGrade = { EX: 0, A: 10, B: 20, C: 40, D: 60, E: 80 };
  const base = byGrade[rank.grade];
  if (base === undefined) return 100;

  // A `+` step makes the concealment better, so it lowers the discovery chance.
  return Math.max(0, Math.min(100, base - 5 * rank.steps));
}

/**
 * Every Discover attempt a concealed unit's position currently offers.
 *
 * One per **watcher**, not one per panel entered: a unit that walks three
 * panels through somebody's Detect radius is noticed once, not three times.
 *
 * Each attempt is marked `gmOnly` and `silentUnlessSucceeded`, and that is not
 * decoration. *"The Overseer will perform the Discover rolls, since if either
 * Player performs the roll, that would mean that they would already know there
 * is a Unit with Active Presence Concealment in the area."* The flags travel
 * with the attempt so the socket layer cannot broadcast one by accident.
 *
 * @param {object} concealedUnit
 * @param {object} board
 * @returns {Array<{watcherId: string, chance: number, gmOnly: true, silentUnlessSucceeded: true}>}
 */
export function discoverAttempts(concealedUnit, board) {
  if (!concealedUnit?.concealed) return [];
  const chance = discoverChance(concealedUnit);

  /** @type {object[]} */
  const out = [];
  for (const watcher of board?.units ?? []) {
    if (watcher.id === concealedUnit.id) continue;
    if (!isEnemy(watcher, concealedUnit, board)) continue;
    if (chebyshev(watcher.panel ?? {}, concealedUnit.panel ?? {}) > detectRangeOf(watcher)) continue;

    out.push({
      watcherId: watcher.id,
      concealedId: concealedUnit.id,
      chance,
      gmOnly: true,
      silentUnlessSucceeded: true,
    });
  }
  return out;
}

/**
 * @param {object} a
 * @param {object} b
 * @param {object} board
 * @returns {boolean}
 */
function isEnemy(a, b, board) {
  if (!a.faction || !b.faction) return false;
  const allied = board?.alliances?.[a.faction]?.includes(b.faction) ?? a.faction === b.faction;
  return !allied;
}
