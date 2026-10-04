/**
 * @file Attacking a Master whose Servant is within 2 panels (#181).
 * @see docs/32-relationships.md, docs/20-targeting.md
 *
 * Layer 2 (rules). Pure.
 *
 * > When a Master becomes the target of an Attack while their Servant is
 * > within a 2 panel area of themselves, perform the following checks-
 * > 1. If the Target Unit is a Master whose Servant is within the AU's Range,
 * >    the AU can only target the Servant.
 * > 2. … not within the AU's Range but standing on a panel directly next to
 * >    their Master, the AU can target the Master, but the target is
 * >    automatically changed to their Servant at the start of the Combat Phase.
 * > 3. … not within the AU's Range and also not standing on a panel directly
 * >    next to their Master- At the start of the Combat Phase, the Master's
 * >    Servant performs an Agility Check (against the AU). If successful, the
 * >    Servant Moves to the nearest panel which is directly next to their
 * >    Master and the Attack target is changed to the Servant; if Failed,
 * >    Combat proceeds as normal. Note: If the Servant has an effect which
 * >    prevents it from Moving (e.g. Immobilize), then it cannot perform this
 * >    Agility Check.
 *
 * — *Normal Great Holy Grail War*. Ruled 2026-10-04: all three cases, for
 * every targeted Attack (Normal Attacks, Attack Skills, single-target Noble
 * Phantasms), with `guardsOf` deciding who guards -- so Pale Rider's Kagome
 * Spirits stand in for him and a charmed Servant guards nobody. Until now the
 * engine reduced the three to "an ADJACENT guard refuses the target".
 */

import * as geo from "../domain/geometry.mjs";
import { guardsOf } from "./relations.mjs";
import { preventedBy } from "./budget.mjs";

/** "Within a 2 panel area of themselves." */
export const GUARD_RADIUS = 2;

/**
 * The Master's guards within 2 panels of it, able to act.
 *
 * @param {object} master
 * @param {object} board
 * @returns {object[]}
 */
export function guardsNear(master, board) {
  if (master?.kind !== "master" || !master.panel) return [];
  return guardsOf(master, board).filter((u) =>
    u.panel && u.canAct !== false && geo.chebyshev(u.panel, master.panel) <= GUARD_RADIUS);
}

/**
 * Is this guard within the attacker's Range? Footprint to footprint, as the
 * targeting anchor measures a target.
 *
 * @param {object} guard
 * @param {object} attacker
 * @param {number} range
 * @returns {boolean}
 */
export function guardInRange(guard, attacker, range) {
  if (!attacker?.panel) return false;
  const from = attacker.panels?.length ? attacker.panels : [attacker.panel];
  const to = guard.panels?.length ? guard.panels : [guard.panel];
  return geo.inAttackRangeBetween(from, to, range);
}

/**
 * Case 1: may the attacker target this Master at all?
 *
 * @param {object} master
 * @param {object} attacker
 * @param {object} board
 * @param {number} range the attack's Range
 * @returns {object[]} the guards in Range; empty means the Master may be targeted
 */
export function guardsInRange(master, attacker, board, range) {
  return guardsNear(master, board).filter((g) => guardInRange(g, attacker, range));
}

/**
 * What happens at the start of the Combat Phase to an Attack on this Master.
 *
 * `{kind: "none"}` when no guard is within 2; `{kind: "redirect", guardId}`
 * for case 2; `{kind: "check", order}` for case 3, the guards that may check,
 * nearest the Master first and, on a tie, nearest the attacker. Case 1 is
 * refused at targeting and never reaches here.
 *
 * @param {object} master
 * @param {object} attacker
 * @param {object} board
 * @returns {{kind: "none"}|{kind: "redirect", guardId: string}|{kind: "check", order: string[]}}
 */
export function guardCase(master, attacker, board) {
  const guards = guardsNear(master, board);
  if (guards.length === 0) return { kind: "none" };
  const toAttacker = (u) => (attacker?.panel ? geo.chebyshev(u.panel, attacker.panel) : 0);

  // Case 2. "The target is automatically changed": the adjacent guard nearest
  // the attacker, the first in board order on a tie.
  const adjacent = guards.filter((g) => geo.chebyshev(g.panel, master.panel) === 1);
  if (adjacent.length > 0) {
    const best = adjacent.reduce((a, b) => (toAttacker(b) < toAttacker(a) ? b : a));
    return { kind: "redirect", guardId: best.id };
  }

  // Case 3. Each in turn until one succeeds; one that cannot Move cannot check.
  const order = guards
    .filter((g) => !preventedBy(g, "move").prevented)
    .map((g, index) => ({ g, index }))
    .sort((a, b) => (geo.chebyshev(a.g.panel, master.panel) - geo.chebyshev(b.g.panel, master.panel))
      || (toAttacker(a.g) - toAttacker(b.g)) || (a.index - b.index))
    .map(({ g }) => g.id);
  return order.length > 0 ? { kind: "check", order } : { kind: "none" };
}

/**
 * Where a guard that passed its check moves: the free panel directly next to
 * its Master nearest the GUARD, and on a tie the one nearest the attacker.
 * `null` when there is none, and then no check is made.
 *
 * @param {object} guard
 * @param {object} master
 * @param {object} attacker
 * @param {object} board
 * @param {(panel: object) => boolean} isFree may the guard stand there
 * @returns {{i: number, j: number}|null}
 */
export function guardLanding(guard, master, attacker, board, isFree) {
  const around = [];
  for (let di = -1; di <= 1; di += 1) {
    for (let dj = -1; dj <= 1; dj += 1) {
      if (di === 0 && dj === 0) continue;
      const p = { i: master.panel.i + di, j: master.panel.j + dj };
      if (!geo.inBounds(p, board?.bounds ?? null)) continue;
      if (isFree(p)) around.push(p);
    }
  }
  if (around.length === 0) return null;
  const toAttacker = (p) => (attacker?.panel ? geo.chebyshev(p, attacker.panel) : 0);
  return around.reduce((a, b) => {
    const da = geo.chebyshev(a, guard.panel);
    const db = geo.chebyshev(b, guard.panel);
    if (db !== da) return db < da ? b : a;
    return toAttacker(b) < toAttacker(a) ? b : a;
  });
}
