/**
 * @file Servant identity, and Detect.
 * @see docs/06-units-and-stats.md, docs/05-board-geometry.md
 *
 * Layer 2 (rules). Pure.
 *
 * A Servant is publicly its **class**, not its name — "Berserker", or
 * "Berserker of Yellow" once it belongs to a named faction. The true name is
 * hidden until revealed, and that is what gives Ch. 38's
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
    // `name` before the class container, and before the literal "Servant":
    // every non-Servant takes this branch, and a Master with no `trueName`
    // was being announced as "Servant" on every surface that asked.
    return unit?.trueName || unit?.name || titleCase(unit?.classContainer) || "Servant";
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
  // The class table unless the sheet states a number -- the Golden Hind's
  // `Detect: 4`, and nothing else in the corpus.
  const stated = unit?.detect ?? detectForClass(unit, board);
  // Then whatever is modifying it. Read HERE rather than written into
  // `system.detect` by `applyStatDeltas`, for two reasons: a written value
  // cannot be reset between preparations (a Servant's `_source.detect` is
  // null, so `restoreModifiable` leaves it alone and the delta accumulates --
  // Drake's Uncharted read 6, 9, 12, 15, 18 across five), and a delta applied
  // to a null stored value starts from ZERO, which throws the class base away:
  // her sheet says Detect "is increased by 3", from a Rider's 2 to 5, not to 3.
  const delta = (unit?.statDeltas ?? [])
    .filter((d) => d.stat === "detect" && typeof d.value === "number")
    .reduce((n, d) => n + d.value, 0);
  const base = stated + delta;
  const deafened = (unit?.effects ?? []).includes("deafen") ? 1 : 0;
  // A bounded field may cap it outright — Jack's Mist reduces Detect "to 1
  // panel" for every enemy inside. Applied to the DERIVED number, after the
  // class table and Deafen, because the cap is stated as a result and not as
  // an adjustment. The tightest cap wins if a unit somehow stands in two.
  const caps = (unit?.suppressions ?? [])
    .filter((s) => s.scope === "detect" && typeof s.maximum === "number")
    .map((s) => s.maximum);
  const capped = caps.length > 0 ? Math.min(base, ...caps) : base;
  return Math.max(MIN_DETECT, capped - deafened);
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
 * Every unit newly within `seer`'s Detect range it has not seen before.
 *
 * Familiar: Doves' passive: *"Whenever Semiramis sees a Unit for the first
 * time, the 'Dove' effect is applied to it."* "First time" is a question
 * about history (`seer.seenUnitIds`, `_shared.mjs`), the same way
 * `discoverAttempts` above answers "in range right now" without one —
 * membership is all `unitFirstSeen` (`engine/vision.mjs`) needs to add.
 *
 * Symmetric only in that it is called for both parties of a move: this
 * answers "who does `seer` now see", and the caller asks it once with the
 * mover as `seer` and once per OTHER unit as `seer` (with the mover as the
 * only candidate) to cover both directions of a Detect crossing.
 *
 * @param {object} seer
 * @param {object} board
 * @returns {string[]} unit ids
 */
export function newlySeenBy(seer, board) {
  if (!seer?.panel) return [];
  const seen = new Set(seer.seenUnitIds ?? []);
  const range = detectRangeOf(seer, board);

  return (board?.units ?? [])
    .filter((u) => u.id !== seer.id && u.panel && !seen.has(u.id) && chebyshev(seer.panel, u.panel) <= range)
    .map((u) => u.id);
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
 * How many Discover attempts one faction gets per Turn against one concealed
 * Unit.
 *
 * Three, per the game's author. The cap is what keeps a concealed Servant from
 * being found simply by being outnumbered: without it, walking past six enemies
 * rolled six times, and at Semiramis's 35% that is a 92% chance of being seen
 * for one step.
 */
export const DISCOVER_ATTEMPTS_PER_FACTION = 3;

/**
 * Every Discover attempt a concealed unit's position currently offers.
 *
 * One per **watcher**, not one per panel entered: a unit that walks three
 * panels through somebody's Detect radius is noticed once, not three times.
 *
 * Bounded twice over, both rulings from the game's author. **Only Servants
 * watch** — the Skill says *"an enemy Servant's Range (or Detect)"* and a
 * Master used to roll as well. And **a faction gets three attempts per Turn
 * against one concealed Unit**, spent in the order its Servants acquired the
 * target, with none of them attempting twice; each faction's three are its own,
 * so spending them buys another faction nothing (Ch. 46 §46.4-AN).
 *
 * `spent` and `acquiredAt` are the per-Turn record, passed in rather than read:
 * this is Layer 2 and the record lives on the concealed Unit's actor.
 *
 * Each attempt is marked `gmOnly` and `silentUnlessSucceeded`, and that is not
 * decoration. *"The Overseer will perform the Discover rolls, since if either
 * Player performs the roll, that would mean that they would already know there
 * is a Unit with Active Presence Concealment in the area."* The flags travel
 * with the attempt so the socket layer cannot broadcast one by accident.
 *
 * @param {object} concealedUnit
 * @param {object} board
 * @param {{spent?: Record<string, string[]>, acquiredAt?: Record<string, number>}} [budget]
 *   `spent` is watcher ids already used this Turn, keyed by faction;
 *   `acquiredAt` is the tick each watcher first held this target in Detect.
 * @returns {Array<{watcherId: string, faction: string|null, chance: number,
 *   gmOnly: true, silentUnlessSucceeded: true}>}
 */
export function discoverAttempts(concealedUnit, board, { spent = {}, acquiredAt = {} } = {}) {
  if (!concealedUnit?.concealed) return [];
  const chance = discoverChance(concealedUnit);

  /** @type {Map<string, object[]>} */
  const byFaction = new Map();
  for (const watcher of board?.units ?? []) {
    if (watcher.id === concealedUnit.id) continue;
    // "An enemy SERVANT's Range (or Detect)". Ch. 05 quotes the source's
    // general rule as *"an enemy Unit's"*, and this filter used to follow it --
    // so a Master standing beside a concealed Servant rolled to Discover as
    // readily as the Servant hunting her. Measured live as two watchers at 35%
    // each, which is 58% for one step against a sheet that offers 35%. Settled
    // by the game's author in favour of the Skill's own wording
    // (Ch. 46 §46.4-AN).
    if (watcher.kind !== "servant") continue;
    if (!isEnemy(watcher, concealedUnit, board)) continue;
    if (chebyshev(watcher.panel ?? {}, concealedUnit.panel ?? {}) > detectRangeOf(watcher, board)) continue;

    const faction = watcher.faction ?? watcher.factionId ?? null;
    // "No repeated attempts from the same Unit on the same Turn against the
    // same concealed Unit."
    if ((spent[faction] ?? []).includes(watcher.id)) continue;

    if (!byFaction.has(faction)) byFaction.set(faction, []);
    byFaction.get(faction).push(watcher);
  }

  /** @type {object[]} */
  const out = [];
  for (const [faction, watchers] of byFaction) {
    // "In order of arrival, depending on which Units had the concealed Unit on
    // their Detect range [first]." `acquiredAt` is the tick each watcher first
    // held this target; a watcher with no record sorts last, and ties fall back
    // to id so the order is stable rather than whatever the board happened to
    // be built in.
    const ordered = [...watchers].sort((a, b) => {
      const at = acquiredAt[a.id] ?? Infinity;
      const bt = acquiredAt[b.id] ?? Infinity;
      return at === bt ? String(a.id).localeCompare(String(b.id)) : at - bt;
    });

    // Three per FACTION per Turn against this one concealed Unit -- not three
    // per Servant, and not three shared across the board. A faction that has
    // spent all of its own leaves another faction's untouched, which is why the
    // budget is keyed by faction rather than held on the target alone.
    //
    // A TABLE SETTING, carried on `board.rules` exactly as `masterProtection`
    // is: this is Layer 2 and cannot read `game.settings`, so the optional rule
    // arrives as data. `??` and not `||`, because **0 is a legal value** and
    // means "no Discover rolls at all" -- a table that wants concealment
    // absolute. Absence falls back to the rule as written, since every board
    // built before the setting existed carries no value for it.
    const cap = board?.rules?.discoverAttemptsPerFaction ?? DISCOVER_ATTEMPTS_PER_FACTION;
    const left = cap - (spent[faction] ?? []).length;
    for (const watcher of ordered.slice(0, Math.max(0, left))) {
      out.push({
        watcherId: watcher.id,
        concealedId: concealedUnit.id,
        faction,
        chance,
        gmOnly: true,
        silentUnlessSucceeded: true,
      });
    }
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
