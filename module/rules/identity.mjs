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

/**
 * Detect, and therefore vision range, **by class container**.
 *
 * Supersedes the earlier reading that Detect was attack range with a floor of
 * two. It is not derived from range at all — an Archer sees four panels whether
 * or not it can shoot that far, and a Master sees one, which is *below* the old
 * floor. Reading it off range gave a Caster the same sight as a Saber.
 *
 * @type {Readonly<Record<string, number|{inHomeBase: number, outside: number}>>}
 */
export const DETECT_BY_CLASS = Object.freeze({
  master: 1,
  saber: 2,
  lancer: 2,
  archer: 4,
  rider: 2,
  // The only conditional entry: a Caster sees furthest from its own ground.
  caster: { inHomeBase: 5, outside: 3 },
  assassin: 4,
  berserker: 2,
});

/** Anything with no class container listed. */
const DEFAULT_DETECT = 2;

/** Detect can be reduced, but a unit always perceives at least its neighbours. */
const MIN_DETECT = 1;

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
 * Class container first, then an explicit sheet value, then Deafen. The Caster
 * entry is conditional on standing in its own Home Base, which is the only
 * position-dependent sight line in the game and the reason this takes a board.
 *
 * The Golden Hind states `Detect: 4` outright, so an explicit value wins over
 * the table — a platform has no class container to look up.
 *
 * @param {object} unit
 * @param {object} [board] needed only for a Caster's Home Base check
 * @returns {number}
 */
export function detectRangeOf(unit, board = null) {
  const base = unit?.detect ?? detectForClass(unit, board);
  const deafened = (unit?.effects ?? []).includes("deafen") ? 1 : 0;
  return Math.max(MIN_DETECT, base - deafened);
}

/**
 * The table value for a unit's container.
 *
 * @param {object} unit
 * @param {object|null} board
 * @returns {number}
 */
function detectForClass(unit, board) {
  const container = unit?.kind === "master" ? "master" : unit?.classContainer;
  const entry = DETECT_BY_CLASS[container];
  if (entry === undefined) return DEFAULT_DETECT;
  if (typeof entry === "number") return entry;
  return inOwnHomeBase(unit, board) ? entry.inHomeBase : entry.outside;
}

/**
 * @param {object} unit
 * @param {object|null} board
 * @returns {boolean}
 */
function inOwnHomeBase(unit, board) {
  for (const zone of Object.values(board?.zones ?? {})) {
    if (zone.faction !== unit?.faction) continue;
    if ((zone.panels ?? []).some((p) => p.i === unit.panel?.i && p.j === unit.panel?.j)) return true;
  }
  return false;
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
    if (chebyshev(watcher.panel ?? {}, concealedUnit.panel ?? {}) > detectRangeOf(watcher, board)) continue;

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
