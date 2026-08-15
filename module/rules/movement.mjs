/**
 * @file Movement legality, reachability and the Riding segment rule.
 * @see docs/08-board-and-geometry.md §8.3, docs/18-action-economy.md §18.4
 *
 * Layer 2 (rules). Pure. `geometry.reachablePanels` does the search; everything
 * here is the seven-clause legality test that decides which panels the search
 * may enter, plus the budget arithmetic on top of it.
 *
 * The clause that catches people is #3: *"all Units are not allowed to Move
 * **through** a panel occupied by an enemy Unit"*. **Through**, not *onto* — so
 * an allied panel is passable but cannot be stopped on, and an enemy panel is
 * neither. Those are different predicates and the search needs both.
 */

import * as geo from "../domain/geometry.mjs";
import { hasGranted, GRANTS } from "./granted.mjs";

/** Effects that let a unit ignore occupancy and Master protection. */
const IGNORES_BLOCKING = Object.freeze(["presenceConcealment", "hugeScale"]);

/**
 * @typedef {import("../domain/geometry.mjs").GridOffset} GridOffset
 */

/**
 * @typedef {object} MovementPlan
 * @property {Map<string, number>} reachable panel key → steps, stoppable panels only
 * @property {Map<string, number>} passable panel key → steps, including pass-through
 * @property {number} budget panels still available this turn
 * @property {number} segments how many separate drags have been made — MOV, not
 *   this number, is what limits movement before the Attack
 * @property {number} maxSegments movement *phases*: 1, or 2 with Riding, which
 *   is one before the Attack and one after it
 */

/**
 * Everywhere this unit could move to, right now.
 *
 * @param {object} unit the mover's snapshot
 * @param {object} board the board snapshot
 * @param {object} [opts]
 * @param {boolean} [opts.hasRiding] legacy override; the `doubleMove` grant is preferred
 * @returns {MovementPlan}
 */
export function planMovement(unit, board, { hasRiding = undefined } = {}) {
  // The grant is the source of truth. The `hasRiding` override is kept for
  // callers that already computed it, but a unit that carries the capability
  // needs no help from its caller to be believed.
  const canDoubleMove = hasGranted(unit, GRANTS.doubleMove) || hasRiding === true;
  const budget = remainingMovement(unit);
  const bounds = board.bounds ?? null;

  const passable = geo.reachablePanels(
    unit.panel,
    budget,
    (panel) => !canPassThrough(panel, unit, board),
    bounds,
  );

  const reachable = new Map();
  for (const [k, steps] of passable) {
    if (canStopOn(geo.unkey(k), unit, board)) reachable.set(k, steps);
  }

  return {
    reachable,
    passable,
    budget,
    segments: unit.turnState?.moveSegments ?? 0,
    maxSegments: canDoubleMove ? 2 : 1,
  };
}

/**
 * How many panels remain in this turn's allowance.
 *
 * Riding's two segments share one allowance — *"the total number of panels
 * Moved during both times cannot exceed its MOV"* — so this is a running total,
 * not a per-segment one.
 *
 * @param {object} unit
 * @returns {number}
 */
export function remainingMovement(unit) {
  return Math.max(0, effectiveMov(unit) - (unit?.turnState?.movedPanels ?? 0));
}

/**
 * MOV after the effects that change it.
 *
 * `Slow` **halves MOV, rounding down**, rather than doubling the cost of each
 * step — a distinction that matters at odd MOV values and is what its text
 * says.
 *
 * @param {object} unit
 * @returns {number}
 */
export function effectiveMov(unit) {
  const held = unit?.effects ?? [];
  let mov = unit?.mov ?? 0;
  if (held.includes("slow")) mov = Math.floor(mov / 2);
  return Math.max(0, mov);
}

/**
 * Is a path legal? Returns every reason it is not, rather than the first.
 *
 * A player who has drawn a five-step path deserves to know that it is both too
 * long *and* passes through an enemy, not to fix one and be told about the
 * other.
 *
 * @param {GridOffset[]} path panels after the origin, in order
 * @param {object} unit
 * @param {object} board
 * @param {object} [opts]
 * @param {boolean} [opts.hasRiding]
 * @returns {{ok: boolean, reasons: string[], cost: number}}
 */
export function validatePath(path, unit, board, { hasRiding = false } = {}) {
  const reasons = [];
  const steps = path ?? [];
  let previous = unit.panel;

  for (const [index, panel] of steps.entries()) {
    if (geo.manhattan(previous, panel) !== 1) {
      reasons.push(`Step ${index + 1} is not an orthogonal move — Units cannot Move diagonally.`);
    }
    if (!geo.inBounds(panel, board.bounds ?? null)) {
      reasons.push(`Step ${index + 1} leaves the board.`);
    }
    if (!canPassThrough(panel, unit, board)) {
      reasons.push(`Step ${index + 1} passes through a panel this Unit may not enter.`);
    }
    previous = panel;
  }

  const destination = steps.at(-1);
  if (destination && !canStopOn(destination, unit, board)) {
    reasons.push("The destination panel is occupied.");
  }

  const cost = steps.length;
  const budget = remainingMovement(unit);
  if (cost > budget) {
    reasons.push(`This path is ${cost} panels; ${budget} remain of MOV ${effectiveMov(unit)}.`);
  }

  const segmentProblem = segmentCheck(unit, hasRiding);
  if (segmentProblem) reasons.push(segmentProblem);

  return { ok: reasons.length === 0, reasons, cost };
}

/**
 * Whether this unit may begin another movement segment at all.
 *
 * @param {object} unit
 * @param {boolean} hasRiding
 * @returns {string|null} the refusal, or `null` when it may move
 */
export function segmentCheck(unit, hasRiding = unit?.hasRiding ?? false) {
  const state = unit?.turnState ?? {};
  if (state.usedRidingAttack) return "Riding Attack ends this Unit's Turn; it cannot Move again.";

  // MOV is the only limit before the Attack. A Unit may Move as many times as
  // it likes, in as many separate drags as it likes, until the total reaches
  // its MOV — the allowance is a distance, not a number of moves.
  //
  // The superseded reading was one Move per Turn, which made every second drag
  // illegal and left "This Unit has already Moved this Turn" on the screen for
  // the rest of the match.
  if (remainingMovement(unit) <= 0) {
    return `This Unit has spent all ${effectiveMov(unit)} panels of its MOV this Turn.`;
  }

  // Attacking is what fixes a Unit in place: *"once you Attack you hold that
  // position"*. Riding is the exception, and its two segments — before the
  // Attack and after it — share the one MOV allowance already checked above.
  if (!state.attacked) return null;
  if (!hasRiding) return "This Unit has Attacked; it cannot Move again this Turn.";
  return null;
}

/* -------------------------------------------------------------------------- */

/**
 * May this unit move *through* the panel? Clauses 3–5.
 *
 * @param {GridOffset} panel
 * @param {object} unit
 * @param {object} board
 * @returns {boolean}
 */
export function canPassThrough(panel, unit, board) {
  if (ignoresBlocking(unit)) return true;

  const occupant = occupantAt(panel, board);
  // Platforms and structures are terrain, not Units: a Platform is stood on,
  // and clause 3 is about *Units*, so neither blocks a step.
  const blocking = occupant && !["platform", "structure"].includes(occupant.kind);
  if (blocking && isEnemy(unit, occupant, board)) return false;
  if (inEnemyMasterProtection(panel, unit, board)) return false;
  return true;
}

/**
 * May this unit *end* its move on the panel? Clause 7 on top of 3–5.
 *
 * @param {GridOffset} panel
 * @param {object} unit
 * @param {object} board
 * @returns {boolean}
 */
export function canStopOn(panel, unit, board) {
  if (!canPassThrough(panel, unit, board)) return false;
  const occupant = occupantAt(panel, board);
  // Platforms are stood on, not blocked by, and Huge Scale overlaps by design.
  if (!occupant) return true;
  if (["platform", "structure"].includes(occupant.kind)) return true;
  return ignoresBlocking(unit);
}

/**
 * Clause 4. *"Units are not allowed to enter a 1 panel area of enemy Masters if
 * that Master's Servant is within 2 panels of its Master."*
 *
 * Asymmetric on purpose: it protects Masters from being walked up to, and does
 * not stop a Master stopping next to an enemy.
 *
 * @param {GridOffset} panel
 * @param {object} unit
 * @param {object} board
 * @returns {boolean}
 */
export function inEnemyMasterProtection(panel, unit, board) {
  for (const other of board.units ?? []) {
    if (other.kind !== "master") continue;
    if (!isEnemy(unit, other, board)) continue;
    if (geo.chebyshev(panel, other.panel) > 1) continue;

    const guard = (board.units ?? []).find(
      (u) => u.kind === "servant"
        && u.factionId === other.factionId
        && geo.chebyshev(u.panel, other.panel) <= 2,
    );
    if (guard) return true;
  }
  return false;
}

/**
 * @param {GridOffset} panel
 * @param {object} board
 * @returns {object|null}
 */
function occupantAt(panel, board) {
  for (const u of board.units ?? []) {
    const footprint = u.panels ?? (u.panel ? [u.panel] : []);
    if (footprint.some((p) => p.i === panel.i && p.j === panel.j)) return u;
  }
  return null;
}

/**
 * @param {object} unit
 * @param {object} other
 * @param {object} board
 * @returns {boolean}
 */
function isEnemy(unit, other, board) {
  if (other.id === unit.id) return false;
  const mine = unit.factionId ?? unit.faction ?? null;
  const theirs = other.factionId ?? other.faction ?? null;
  if (mine === null || theirs === null) return false;
  if (mine === theirs) return false;
  const allies = board.alliances?.[mine] ?? [mine];
  return !allies.includes(theirs);
}

/**
 * @param {object} unit
 * @returns {boolean}
 */
function ignoresBlocking(unit) {
  const held = unit?.effects ?? [];
  return IGNORES_BLOCKING.some((id) => held.includes(id)) || Boolean(unit?.ignoresOccupancy);
}
