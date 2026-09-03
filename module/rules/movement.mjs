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
import { contains, membershipVerdict } from "./bounded-fields.mjs";
import { guardsOf, relationOf } from "./relations.mjs";

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
 * A Riding Attack's path, and everyone it runs through.
 *
 * > *"Riding Attack: Can Attack all Units in its path while Moving in a
 * > straight line as its Normal Attack during its Turn. Cannot Attack or Move
 * > after it has stopped. ... If the Unit has already Moved during its Turn and
 * > intends to use Riding Attack, the number of panels it can Move for its
 * > Riding Attack is equal to its MOV minus the number of panels it has already
 * > Moved."*
 *
 * A move that is also an attack, which nothing else in the game is. `GRANTS`
 * has carried `ridingAttack` since grants were written and **no engine ever
 * read it** — this is its first reader.
 *
 * STRAIGHT means the three axes a grid has: a shared row, a shared column, or
 * an exact diagonal. Same test `panelsBetween` uses, and reusing it is the
 * point — a Riding Attack down a diagonal and a Mystic Eye down one should
 * agree about what a line is.
 *
 * @param {object} unit
 * @param {{i: number, j: number}} destination
 * @param {object} board
 * @param {object} [opts]
 * @param {number} [opts.movedAlready] panels spent earlier this Turn
 * @returns {{ok: boolean, reason?: string, hits?: object[], path?: object[], distance?: number}}
 */
export function ridingAttackPath(unit, destination, board, { movedAlready = null } = {}) {
  if (!unit?.panel || !destination) return { ok: false, reason: "unplaced" };

  const path = geo.panelsBetween(unit.panel, destination);
  const di = destination.i - unit.panel.i;
  const dj = destination.j - unit.panel.j;
  const distance = Math.max(Math.abs(di), Math.abs(dj));
  if (distance === 0) return { ok: false, reason: "noMovement" };
  // `panelsBetween` returns [] both for an adjacent panel and for one off the
  // three axes, so straightness is tested directly rather than inferred.
  if (di !== 0 && dj !== 0 && Math.abs(di) !== Math.abs(dj)) {
    return { ok: false, reason: "notStraight" };
  }

  const spent = movedAlready ?? unit.turnState?.movedPanels ?? 0;
  const allowance = Math.max(0, effectiveMov(unit) - spent);
  if (distance > allowance) {
    return {
      ok: false,
      reason: spent > 0
        ? `only ${allowance} panels left; it has already Moved ${spent}`
        : `${distance} panels is further than its MOV of ${allowance}`,
    };
  }

  // Everyone it runs THROUGH, plus whoever is standing on the destination.
  // In path order, because the fan-out reads as a sequence down the line.
  const walked = [...path, destination];
  const hits = [];
  for (const panel of walked) {
    for (const other of board?.units ?? []) {
      if (other.id === unit.id || !other.panel || other.defeated) continue;
      if (other.panel.i !== panel.i || other.panel.j !== panel.j) continue;
      if (relationOf(unit, other, board) !== "enemy") continue;
      hits.push(other);
    }
  }
  return { ok: true, hits, path: walked, distance };
}

/**
 * Where a Master lands when it rides along with its Servant.
 *
 * > *"Passenger Seat: The Servant's Master can Move together with its Servant;
 * > after Moving, both Servant and Master must be in the same
 * > orientation/position prior to the Move. Counts as only Moving one Unit."*
 *
 * The **same relative** position, not the same absolute one — otherwise the
 * Master does not move at all and the clause says nothing. So the Master is
 * displaced by exactly the delta the Servant travelled.
 *
 * `GRANTS.passengerSeat` has existed with no reader for as long as
 * `ridingAttack` has.
 *
 * @param {{i: number, j: number}} from the Servant's origin
 * @param {{i: number, j: number}} to the Servant's destination
 * @param {{i: number, j: number}} master where the Master is standing
 * @param {object|null} [bounds]
 * @returns {{i: number, j: number}|null} `null` when it would leave the board
 */
export function passengerDestination(from, to, master, bounds = null) {
  if (!from || !to || !master) return null;
  const panel = { i: master.i + (to.i - from.i), j: master.j + (to.j - from.j) };
  if (bounds && (panel.i < bounds.iMin || panel.i > bounds.iMax
    || panel.j < bounds.jMin || panel.j > bounds.jMax)) return null;
  return panel;
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
  // Terrain last, and additively: Slow halves what the unit HAS, while a Forest
  // costs a panel of whatever is left. Halving after the terrain penalty would
  // make difficult ground twice as expensive to a Slowed unit, which no rule
  // says.
  mov += unit?.terrainEffects?.movDelta ?? 0;
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

  const occupant = occupantAt(panel, board, unit.level);
  // Platforms and structures are terrain, not Units: a Platform is stood on,
  // and clause 3 is about *Units*, so neither blocks a step.
  const blocking = occupant && !["platform", "structure"].includes(occupant.kind);
  if (blocking && isEnemy(unit, occupant, board)) return false;
  if (inEnemyMasterProtection(panel, unit, board)) return false;
  if (blockedByFieldExit(panel, unit, board)) return false;
  return true;
}

/**
 * Is this unit currently held inside a field that will not let it leave?
 *
 * Sikera Ušum's Throne-Room branch: "all Units within the Throne Room when
 * the NP was activated cannot leave it while it is Active." Axis 2's own
 * `membershipVerdict` (rules/bounded-fields.mjs) has answered this question
 * since it was written; nothing had ever asked it during a move, so a
 * `allyExit`/`enemyExit` policy stricter than `"free"` refused nobody.
 *
 * @param {GridOffset} panel the candidate destination
 * @param {object} unit
 * @param {object} board
 * @returns {boolean}
 */
function blockedByFieldExit(panel, unit, board) {
  for (const field of board?.fields ?? []) {
    if (!contains(field, unit.panel, board)) continue; // not currently inside
    if (contains(field, panel, board)) continue; // still inside after this step
    if (!membershipVerdict(field, unit, "exit", board).ok) return true;
  }
  return false;
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
  const occupant = occupantAt(panel, board, unit.level);
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
/**
 * May this summon take this step?
 *
 * The Kagome Spirits are *"constantly Move towards that Unit and Attack it"*,
 * and the decision taken in the design was that this is a **constraint on the
 * player** rather than an automaton: the engine refuses a step that ends
 * further from the assigned enemy than it began, and the player chooses the
 * route. "Constantly" is a rule, not an AI.
 *
 * @param {object} unit
 * @param {Array<{i: number, j: number}>} path
 * @param {object} board
 * @returns {{ok: boolean, reason?: string}}
 */
export function pursuitVerdict(unit, path, board) {
  if (!unit?.pursuitTargetId || !Array.isArray(path) || path.length < 2) return { ok: true };

  const prey = (board?.units ?? []).find((u) => u.id === unit.pursuitTargetId);
  if (!prey?.panel || prey.defeated) return { ok: true };

  // Lifted once the prey is no longer inside the field the Spirit is bound to.
  // The compulsion is a property of the area -- a Spirit is summoned for an
  // enemy *within* Doomsday Come, and one who has left is no longer its
  // business.
  if (unit.boundToFieldId && !(prey.fields ?? []).includes(unit.boundToFieldId)) return { ok: true };

  const before = geo.chebyshev(path[0], prey.panel);
  const after = geo.chebyshev(path[path.length - 1], prey.panel);
  // Closing OR holding. "Constantly Move towards that Unit" is a direction,
  // not a speed, and a Spirit already adjacent has nowhere closer to go.
  return after <= before
    ? { ok: true }
    : { ok: false, reason: `${unit.name ?? "This summon"} must Move towards ${prey.name ?? "its target"}.` };
}

/**
 * Zone denial around an enemy Master.
 * @param {{i: number, j: number}} panel
 * @param {object} unit
 * @param {object} board
 * @returns {boolean}
 */
export function inEnemyMasterProtection(panel, unit, board) {
  // An OPTIONAL rule. It is the one clause in Ch. 08 that stops a player moving
  // where the board looks empty, and the refusal is easy to read as a bug --
  // so a table that does not want it can switch it off, and then it stops
  // applying everywhere at once, reachability included.
  //
  // Default ON: it is a core rule, and a board built before the setting existed
  // carries no `rules` block at all. `?? true` is what keeps absence from
  // silently disabling it, which would be the worst of both worlds.
  if (board?.rules?.masterProtection === false) return false;

  for (const other of board.units ?? []) {
    if (other.kind !== "master") continue;
    if (!isEnemy(unit, other, board)) continue;
    if (geo.chebyshev(panel, other.panel) > 1) continue;

    // `guardsOf`, so Pale Rider's Kagome Spirits deny the zone in his place --
    // and he does not deny it himself.
    const guard = guardsOf(other, board).find(
      (u) => u.panel && geo.chebyshev(u.panel, other.panel) <= 2,
    );
    if (guard) return true;
  }
  return false;
}

/**
 * The nearest free panel a unit lands on when knocked back FROM `origin`.
 *
 * Bašmu: *"when it Moves to any occupied panels, all Units occupying said
 * panels are knocked back by 1 panel until the space is free for Bašmu to
 * stand on."* Directional (away from `origin`) rather than a search in every
 * direction, and "until the space is free" is why this steps repeatedly along
 * that one line rather than stopping after a single panel.
 *
 * @param {GridOffset} origin what the knockback is FROM (Bašmu's own panel)
 * @param {object} unit the unit being knocked back
 * @param {object} board
 * @param {object} [opts]
 * @param {number} [opts.maxSteps] how far along the line to search
 * @returns {GridOffset|null} `null` when no free panel was found within range
 */
export function knockbackPanel(origin, unit, board, { maxSteps = 5 } = {}) {
  const dir = geo.cardinalToward(origin, unit.panel);
  if (dir.i === 0 && dir.j === 0) return null;

  let panel = unit.panel;
  for (let i = 0; i < maxSteps; i++) {
    panel = { i: panel.i + dir.i, j: panel.j + dir.j };
    if (!geo.inBounds(panel, board.bounds ?? null)) return null;
    if (!occupantAt(panel, board, unit.level)) return panel;
  }
  return null;
}

/**
 * @param {GridOffset} panel
 * @param {object} board
 * @returns {object|null}
 */
export function occupantAt(panel, board, level = 0) {
  // Per LEVEL, not per panel. §20.2 gives each platform its own Scene Level for
  // "separate occupancy" among four reasons, and this function -- the only
  // thing that answers "is somebody standing there" for movement -- compared
  // `i` and `j` and nothing else. Every unit in the scene therefore occupied
  // one shared 2D grid whatever its elevation, so the Hanging Gardens, which
  // flies, could not be moved anywhere near the board: the ground units blocked
  // it. Measured live before the fix, with the HGoB unable to pass through or
  // stop on any occupied panel.
  //
  // `?? 0` on both sides treats an absent level as the ground, which is what
  // every unit in a scene with no platforms has and what every board built
  // before levels existed carries.
  const here = level ?? 0;
  for (const u of board.units ?? []) {
    if ((u.level ?? 0) !== here) continue;
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
