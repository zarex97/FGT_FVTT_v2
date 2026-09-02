/**
 * @file ZON — the Effective Servant Zone.
 * @see docs/06-stats-and-resources.md §6.9, docs/16-relationships.md §16.3
 *
 * Layer 2 (rules). Pure — takes the board, returns distances.
 *
 * ZON is a property of the Master–Servant **pair**, not of either unit: the
 * zone is drawn around the Master and its radius depends on the *Servant's*
 * class, so one Master with three Servants of different classes has three
 * different radii around the same panel.
 *
 * Being outside it costs exactly two things (§16.3) — 5d10 off attack damage
 * (pipeline stage 9) and no Noble Phantasms at all. Skills, spells, movement
 * and defence are untouched. Both consumers already existed and read
 * `unit.outsideZon`; nothing computed it, so neither rule had ever fired.
 *
 * The class split is read from a table rather than written into the arithmetic
 * because the reading behind it is an inference from two sentences and is
 * flagged for an authorial ruling (Ch. 41): a corrected table must not mean
 * corrected code.
 */

import * as geo from "../domain/geometry.mjs";
import { isHighRank } from "./master-rank.mjs";

/**
 * Base ZON by Servant class, before bonuses.
 *
 * Assassin's stated default is 4 and Caster's 5, which are 2+2 and 3+2 — the
 * "+2 for Casters and Assassins" clause is *the reason for* those numbers, not
 * an extra on top of them (§6.9). So the base here is the pre-bonus half, and
 * the bonus arrives through the max-not-sum channel below.
 *
 * @type {Readonly<Record<string, number>>}
 */
export const ZON_BASE = Object.freeze({
  saber: 2, lancer: 2, rider: 2, berserker: 2, archer: 2,
  assassin: 2, caster: 3,
});

/** The class bonus that does **not** stack with Independent Action. */
export const ZON_CLASS_BONUS = Object.freeze({ assassin: 2, caster: 2 });

/** Base for a class the table does not name — Ruler, Avenger, Beast and friends. */
export const ZON_DEFAULT_BASE = 2;

/**
 * The ZON radius for one Master–Servant pair.
 *
 * ```
 * zon = base(class)
 *     + max(classBonus, independentAction, other equivalent bonuses)   // not a sum
 *     + madEnhancement                                                 // stacks
 *     + highRankMaster                                                 // stacks
 * ```
 *
 * The max-not-sum channel is the whole subtlety: *"this does not stack with
 * Independent Action and other Skills with the same effect (use the effect with
 * the highest increase)"*. Mad Enhancement is not one of those, so it adds.
 *
 * @param {object} servant the Servant's snapshot
 * @param {object|null} master the Master's snapshot, or `null` for a free Servant
 * @param {object} [config] `{base, classBonus, defaultBase}` overrides
 * @returns {number}
 */
export function zonRadius(servant, master, config = {}) {
  const base = config.base ?? ZON_BASE;
  const classBonus = config.classBonus ?? ZON_CLASS_BONUS;

  // A Servant may hold more than one class (Ch. 04); the widest zone applies,
  // because a rule that reaches further is not cancelled by one that does not.
  const classes = [...(servant.servantClasses ?? [])];
  const radius = Math.max(
    ...classes.map((c) => base[c] ?? config.defaultBase ?? ZON_DEFAULT_BASE),
    classes.length === 0 ? (config.defaultBase ?? ZON_DEFAULT_BASE) : -Infinity,
  );

  // A bonus may name a STAT rather than a number. Pale Rider's Riding EX:
  // *"Pale Rider's Master's ZON is increased by X panels, X = Pale Rider's
  // MOV"* -- the first ZON clause in the corpus whose size is not a constant,
  // and `ZonBonus` could only carry one.
  //
  // Read literally, and off the same snapshot the rest of this function has:
  // Riding's own Active is "+6 MOV for this Turn", `mov` includes it, so the
  // zone swells by six on that Turn. The sheet states no cap and none is
  // imposed here; Ch. 06 records the reading.
  const valueOf = (b) => (b.fromStat ? (Number(servant?.[b.fromStat]) || 0) : (b.value ?? 0));

  // Max, not sum, across every bonus that claims to be "the same effect".
  const equivalent = [
    ...classes.map((c) => classBonus[c] ?? 0),
    ...(servant.zonBonuses ?? []).filter((b) => b.stacks !== true).map(valueOf),
  ];
  const exclusive = equivalent.length > 0 ? Math.max(...equivalent) : 0;

  const stacking = (servant.zonBonuses ?? [])
    .filter((b) => b.stacks === true)
    .reduce((sum, b) => sum + valueOf(b), 0);

  // The Master's own ZON stat is the floor: a Master sheet that states a number
  // is stating it, and the derivation is what fills in a sheet that does not.
  // "High Rank Masters additionally grant ZON +1" (Ch. 04 §4.5). A STACKING
  // bonus, exactly as this file's own formula comment says -- and it has never
  // been applied: `zonRadius` had no rank term at all, so the line reading
  // `+ highRankMaster // stacks` documented a rule nothing implemented.
  //
  // Added to `derived` rather than folded into the floor below. That floor
  // exists so a Master sheet stating a ZON is believed; a rank bonus is a
  // different thing, and a stated ZON would swallow it whole.
  const rankBonus = isHighRank(master) ? 1 : 0;

  const derived = radius + exclusive + stacking + rankBonus;
  return Math.max(derived, master?.zon ?? 0);
}

/**
 * Where a Servant stands relative to its Master's zone.
 *
 * A Servant with no Master cannot be outside a zone that does not exist — the
 * penalty is inapplicable to Free Servants rather than permanently applied
 * (§16.3, inferred in Ch. 41). Same for a Master who is not on the board.
 *
 * @param {object} servant the Servant's snapshot
 * @param {object} board the board snapshot
 * @param {object} [config]
 * @returns {{master: object|null, zon: number|null, distance: number|null, outside: boolean}}
 */
export function zonStatus(servant, board, config = {}) {
  const none = { master: null, zon: null, distance: null, outside: false };
  if (servant.kind !== "servant") return none;
  if (servant.contract === "free" || servant.contract === "unbound") return none;
  if (servant.zonExempt) return none; // Semiramis aboard the Hanging Gardens.

  const master = masterOf(servant, board);
  if (!master || !master.panel || !servant.panel) return none;

  const zon = zonRadius(servant, master, config);
  const distance = geo.chebyshev(servant.panel, master.panel);

  // "as long as the other counterpart is within their Master's ZON, damage
  // dealt is not reduced" — the Dioscuri test is `any`, not `all` (§6.9).
  const partners = (servant.zonPartnerIds ?? [])
    .map((id) => (board.units ?? []).find((u) => u.id === id))
    .filter((u) => u?.panel);
  const satisfiedByPartner = partners.some(
    (p) => geo.chebyshev(p.panel, master.panel) <= zonRadius(p, master, config),
  );

  return { master, zon, distance, outside: distance > zon && !satisfiedByPartner };
}

/**
 * The Master this Servant is contracted to.
 *
 * `masterId` is authoritative; the faction is the fallback for content that has
 * not been linked up, which is most of it — and a ZON that silently does not
 * apply is worse than one derived from the obvious candidate.
 *
 * @param {object} servant
 * @param {object} board
 * @returns {object|null}
 */
export function masterOf(servant, board) {
  const units = board.units ?? [];
  if (servant.masterId) return units.find((u) => u.id === servant.masterId) ?? null;
  if (!servant.faction) return null;
  return units.find((u) => u.kind === "master" && u.faction === servant.faction) ?? null;
}

/**
 * Annotate every unit on a board with its ZON status.
 *
 * Runs once per board snapshot rather than per query: `zonStatus` is O(units)
 * for the Master lookup, and the damage pipeline, the targeting resolver and
 * the canvas overlay all want the same answer.
 *
 * @param {object[]} units
 * @param {object} board the board these units belong to
 * @param {object} [config]
 * @returns {object[]} the same units, annotated
 */
export function annotateZon(units, board, config = {}) {
  for (const unit of units) {
    const status = zonStatus(unit, board, config);
    unit.zon = status.zon;
    unit.zonDistance = status.distance;
    unit.zonMasterId = status.master?.id ?? null;
    unit.outsideZon = status.outside;
  }
  return units;
}
