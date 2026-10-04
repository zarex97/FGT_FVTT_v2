/**
 * @file Movement legality, reachability and the Riding segment rule.
 * @see docs/05-board-geometry.md, docs/19-action-economy.md
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
import { guardsOf, relationOf, sideOf } from "./relations.mjs";
import { actionSourceFor, withinFootprint } from "./platforms.mjs";
import { partnersOf } from "./linked-group.mjs";
import { resolveTargets } from "./targeting/resolve.mjs";

/** Effects that let a unit ignore occupancy and Master protection. */
const IGNORES_BLOCKING = Object.freeze(["presenceConcealment", "hugeScale"]);

/**
 * Unit kinds that are scenery rather than combatants for occupancy.
 *
 * Clause 3 of Ch. 05 is about *Units*: a Platform is stood on and a Structure is
 * an object lying on the panel, so neither blocks a step. Two of them on ONE
 * panel is a different question — Quetzalcoatl's Piedra Del Sol may share with
 * anything except another object — and `canStopOn` answers it.
 */
const OBJECT_KINDS = new Set(["platform", "structure"]);

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
 * Whose movement rules a Move by this unit is measured by.
 *
 * > *"While Quetz is Riding the Quetzalcoatlus, Quetz's Move … is replaced with
 * > Quetzalcoatlus'."* and *"The Quetzalcoatlus ignores obstacles while Moving,
 * > and can Move onto occupied panels."*
 *
 * A rider whose mount replaces her Move is measured as THE MOUNT: its MOV, its
 * own effects and its obstacle rules -- and, being a platform, it is not held at
 * the footprint it stands on, which is what refused her drag as *"the destination
 * panel is occupied"* (the #29 edge-hold). Two things stay hers: her Turn State,
 * because the segments and the panels already spent are hers, and the panel the
 * path starts from -- the drag begins at her token, which stands anywhere on a
 * mount larger than one panel. Her Master, who does not drive (`roles`), is
 * measured as himself and is still held.
 *
 * Two of her Riding clauses carry to the mount she drives (ruled 2026-10-02,
 * #65, rulings 26 and 27). Her Double Move: the mount's Move is hers, so it may
 * be split around the Attack as hers may. And her Active's *"MOV +6 for this
 * Turn"*: the mount moves 7 + 6 = 13. Only a MOV delta authored
 * `carriesToMount` carries -- a buff on her, or her Slow, stays on her feet.
 *
 * @param {object} unit the mover's snapshot, from the BOARD (`platformId` is stamped by the board pass)
 * @param {object} board
 * @returns {object} `unit` itself when nothing drives for it
 */
export function moverFor(unit, board) {
  const source = actionSourceFor(unit, board);
  if (!source.movesAsPlatform || !source.platform) return unit;
  const platform = source.platform;
  const carried = (unit.statDeltas ?? [])
    .filter((d) => d.stat === "mov" && d.carriesToMount && typeof d.value === "number")
    .reduce((sum, d) => sum + d.value, 0);
  const granted = platform.grantedAbilities ?? [];
  return {
    ...platform,
    mov: (platform.mov ?? 0) + carried,
    grantedAbilities: hasGranted(unit, GRANTS.doubleMove) && !granted.includes(GRANTS.doubleMove)
      ? [...granted, GRANTS.doubleMove]
      : granted,
    panel: unit.panel,
    turnState: unit.turnState,
    level: platform.level ?? unit.level,
  };
}

/**
 * Is this drag legal? {@link validatePath} for the unit that is actually moving.
 *
 * What `onPreMove` calls, so the gate that runs is the one that knows about a
 * driven mount: the planner swapped a rider for her mount and had no caller, and
 * the gate validated her own snapshot, so her drag was refused outright and the
 * mount's carry (`carryDrivenPlatform`) never fired (#143).
 *
 * A mount larger than one panel moves by the same delta she does, so its far
 * panels must still be on the board when it arrives.
 *
 * @param {GridOffset[]} path panels after the origin, in order
 * @param {object} unit
 * @param {object} board
 * @param {object} [opts] as {@link validatePath}
 * @returns {{ok: boolean, reasons: string[], cost: number}}
 */
export function gateMovement(path, unit, board, opts = {}) {
  const mover = moverFor(unit, board);
  const verdict = validatePath(path, mover, board, opts);
  if (mover === unit) return verdict;

  const destination = (path ?? []).at(-1);
  const platform = actionSourceFor(unit, board).platform;
  if (destination && platform?.panel && unit.panel) {
    const { w = 1, h = 1 } = platform.footprint ?? {};
    const shift = { i: destination.i - unit.panel.i, j: destination.j - unit.panel.j };
    const far = [
      { i: platform.panel.i + shift.i, j: platform.panel.j + shift.j },
      { i: platform.panel.i + shift.i + h - 1, j: platform.panel.j + shift.j + w - 1 },
    ];
    if (!far.every((p) => geo.inBounds(p, board.bounds ?? null))) {
      verdict.reasons.push("The mount would leave the board.");
      verdict.ok = false;
    }
  }
  return verdict;
}

/**
 * Everywhere this unit could move to, right now.
 *
 * @param {object} unit the mover's snapshot
 * @param {object} board the board snapshot
 * @returns {MovementPlan}
 */
export function planMovement(unit, board) {
  // The grant is the one question to ask ("can this unit move twice?"), and a
  // unit that carries the capability needs no help from its caller to be
  // believed.
  const canDoubleMove = hasGranted(unit, GRANTS.doubleMove);

  // A rider whose mount replaces her Move plans from THE MOUNT (`moverFor`).
  const mover = moverFor(unit, board);

  const budget = remainingMovement(mover);
  const bounds = board.bounds ?? null;

  const passable = geo.reachablePanels(
    mover.panel,
    budget,
    (panel) => !canPassThrough(panel, mover, board),
    bounds,
  );

  const reachable = new Map();
  for (const [k, steps] of passable) {
    if (canStopOn(geo.unkey(k), mover, board)) reachable.set(k, steps);
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
 * **One ride, judged by the rules a drag and an attack already have** (#114).
 * The line is held to what `validatePath` holds a walk to -- the board's edge,
 * `canPassThrough` (an enemy Master's zone, a field's exit), `canStopOn` at the
 * destination, and the pursuit and Decoy verdicts -- with the ONE exemption that
 * is the point of the clause: an enemy standing in the line, but not on the
 * destination, does not stop the ride. It is hit. Who is hit passes through
 * `resolveTargets`' own filters, from the rider's own Level.
 *
 * @param {object} unit
 * @param {{i: number, j: number}} destination
 * @param {object} board
 * @param {object} [opts]
 * @param {number} [opts.movedAlready] panels spent earlier this Turn
 * @param {number|null} [opts.distanceOverride] the ability's own reach
 * @param {string[]} [opts.npTags] the ability's NP tags, for a field's isolation
 * @returns {{ok: boolean, reason?: string, hits?: object[], path?: object[], distance?: number}}
 */
export function ridingAttackPath(unit, destination, board, {
  movedAlready = null, distanceOverride = null, npTags = [],
} = {}) {
  const ride = judgeRide(unit, destination, board, { movedAlready, distanceOverride });
  if (!ride.ok) return ride;
  return { ...ride, hits: ridingHits(unit, ride.path, board, npTags) };
}

/**
 * Why a ride is not possible at all, before any destination is asked about.
 *
 * *"While Quetz is Riding the Quetzalcoatlus, Quetz's Move and Normal Attack is
 * replaced with Quetzalcoatlus'."* The ride displaced her TOKEN only and never
 * asked whose Move it was, so it moved her off her deck and left the mount
 * behind. The author has ruled that her Move drives the mount but not what a
 * Riding Attack is then, so it is refused with a stated reason until they do
 * (#114).
 *
 * @param {object} unit
 * @param {object} board
 * @returns {"mounted"|null}
 */
export function ridingRefusal(unit, board) {
  return actionSourceFor(unit, board).movesAsPlatform ? "mounted" : null;
}

/**
 * The movement half of a ride: is the line legal, ignoring who it hits?
 *
 * What `ridingDestinations` asks of each candidate, and what
 * {@link ridingAttackPath} adds its hits to, so the overlay and the engine
 * cannot disagree.
 *
 * @param {object} unit
 * @param {{i: number, j: number}} destination
 * @param {object} board
 * @param {object} [opts]
 * @returns {{ok: boolean, reason?: string, path?: object[], distance?: number}}
 */
function judgeRide(unit, destination, board, { movedAlready = null, distanceOverride = null } = {}) {
  if (!unit?.panel || !destination) return { ok: false, reason: "unplaced" };
  const mounted = ridingRefusal(unit, board);
  if (mounted) return { ok: false, reason: mounted };

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
  // A table that holds the ride to rows and columns (#65, ruling 18).
  if (di !== 0 && dj !== 0 && !ridesDiagonally(board)) return { ok: false, reason: "notStraight" };

  const spent = movedAlready ?? unit.turnState?.movedPanels ?? 0;
  // *"This NP is used in the form of a Riding Attack, with a distance of 13
  // panels."* An ability may state the ride's reach outright, and then MOV is
  // not what bounds it -- Achilles's own is 8 at best, and Troias Tragōidia
  // crosses the whole board. The allowance is still reduced by what he has
  // already walked, because the clause overrides the distance and not the
  // rule that a Unit moves once.
  const reach = typeof distanceOverride === "number" ? distanceOverride : effectiveMov(unit);
  const allowance = Math.max(0, reach - spent);
  if (distance > allowance) {
    return {
      ok: false,
      reason: spent > 0
        ? `only ${allowance} panels left; it has already Moved ${spent}`
        : `${distance} panels is further than its MOV of ${allowance}`,
    };
  }

  const walked = [...path, destination];

  // The board's edge, for every panel the ride covers. A drag is refused a step
  // that leaves it; the ride was not, and (5,10) to (5,15) was `ok`.
  if (walked.some((panel) => !geo.inBounds(panel, board?.bounds ?? null))) {
    return { ok: false, reason: "offBoard" };
  }

  // What a drag holds every step to: an enemy Master's zone, a field's exit. An
  // enemy in the line is exempt -- it is hit, not in the way.
  if (walked.some((panel) => !canPassThrough(panel, unit, board, { throughEnemies: true }))) {
    return { ok: false, reason: "blocked" };
  }

  // ...and the panel it ends on, which is `canStopOn`'s: nobody there at all
  // (an enemy on the destination is not "in the line"), a Platform's edge held,
  // a linked partner's leash.
  if (!canStopOn(destination, unit, board)) return { ok: false, reason: "cannotStop" };

  // Kagome Spirits and Decoy, as a drag asks them. `path[0]` is where it
  // begins, so the verdicts compare the distance before and after.
  const route = [unit.panel, ...walked];
  const pursuit = pursuitVerdict(unit, route, board);
  if (!pursuit.ok) return { ok: false, reason: pursuit.reason };
  const pulled = decoyVerdict(unit, route, board);
  if (!pulled.ok) return { ok: false, reason: pulled.reason };

  return { ok: true, path: walked, distance };
}

/** What a ride is, to the targeting resolver: every enemy along a path of panels. */
const RIDE_SPEC = Object.freeze({
  anchor: { kind: "movementPath" },
  shape: { kind: "path" },
  selection: { relations: ["enemy"], chooser: "all" },
  // A ride that reaches nobody is legal, and spends the action.
  targetsRequired: false,
});

/**
 * Everyone a ride hits, in path order.
 *
 * Chosen from the rider's own Level -- the path is a line on it, and a Unit
 * above or below is not in it -- and kept to Units: a Platform or a Structure is
 * terrain a ride crosses. Then through `resolveTargets`, which `pathTargets` used
 * to skip entirely, so a field's isolation, the targetability aura and every
 * other survivor filter applied to this attack as to any other (#114).
 * Multi-panel Units are caught by any panel of their footprint.
 *
 * @param {object} unit
 * @param {GridOffset[]} walked every panel the ride covers, in order
 * @param {object} board
 * @param {string[]} npTags
 * @returns {object[]}
 */
function ridingHits(unit, walked, board, npTags) {
  const level = unit.level ?? 0;
  const firstStep = new Map();
  walked.forEach((panel, n) => { if (!firstStep.has(geo.key(panel))) firstStep.set(geo.key(panel), n); });

  const candidates = [];
  for (const other of board?.units ?? []) {
    if (other.id === unit.id || !other.panel || other.defeated) continue;
    if ((other.level ?? 0) !== level || OBJECT_KINDS.has(other.kind)) continue;
    if (relationOf(unit, other, board) !== "enemy") continue;
    const steps = (other.panels ?? [other.panel])
      .map((p) => firstStep.get(geo.key(p)))
      .filter((n) => n !== undefined);
    if (steps.length > 0) candidates.push({ other, at: Math.min(...steps) });
  }
  if (candidates.length === 0) return [];

  const survivors = new Set(
    resolveTargets(RIDE_SPEC, unit, board, { path: walked, npTags }).units.map((t) => t.unitId),
  );
  return candidates
    .filter(({ other }) => survivors.has(other.id))
    .sort((a, b) => a.at - b.at)
    .map(({ other }) => other);
}

/**
 * Every panel a Riding Attack may end on, from where this Unit stands.
 *
 * What the destination picker paints, and what `ridingAttackPath` judges: the
 * overlay and the engine are ONE rule, because a candidate is offered only if
 * the movement half of `ridingAttackPath` (`judgeRide`) accepts it. Two readers of one rule drift (Ch. 46 §46.3),
 * and an overlay that offers a panel the engine then refuses is the silent
 * no-op the action bar was built to stop (#113).
 *
 * Candidates are the eight lines a grid has, out to the allowance -- the
 * ability's own reach when it states one (Troias Tragōidia's 13), else MOV --
 * less the panels already Moved. A line stops where the board does.
 *
 * @param {object} unit
 * @param {object} board
 * @param {object} [opts]
 * @param {number|null} [opts.distanceOverride] the ability's own reach
 * @returns {GridOffset[]}
 */
export function ridingDestinations(unit, board, { distanceOverride = null } = {}) {
  if (!unit?.panel) return [];
  const reach = typeof distanceOverride === "number" ? distanceOverride : effectiveMov(unit);
  const allowance = Math.max(0, reach - (unit.turnState?.movedPanels ?? 0));

  /** @type {GridOffset[]} */
  const out = [];
  const directions = ridesDiagonally(board) ? RIDING_DIRECTIONS : RIDING_DIRECTIONS.slice(0, 4);
  for (const [di, dj] of directions) {
    for (let step = 1; step <= allowance; step += 1) {
      const panel = { i: unit.panel.i + di * step, j: unit.panel.j + dj * step };
      if (!geo.inBounds(panel, board?.bounds ?? null)) break;
      if (judgeRide(unit, panel, board, { distanceOverride }).ok) out.push(panel);
    }
  }
  return out;
}

/** The eight lines a Riding Attack may run along: the axes and the exact diagonals. */
const RIDING_DIRECTIONS = Object.freeze([
  [-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1],
]);

/**
 * May a Riding Attack run down a diagonal on this board?
 *
 * *"…while Moving in a straight line"*. The eight grid lines are the default,
 * diagonals included; a GM may hold the ride to rows and columns with the
 * `ridingAttackLines` world setting, carried here on `board.rules` (ruled
 * 2026-10-02, #65, ruling 18). Absent reads as the default.
 *
 * @param {object} board
 * @returns {boolean}
 */
export function ridesDiagonally(board) {
  return board?.rules?.ridingAttackLines !== "orthogonal";
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
 * Read by `engine/passenger-seat.mjs#carryMasterAlong`, which a drag and a
 * Riding Attack both call.
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
 * Where a Master lands when his Servant moves, judged against the board as it
 * will be AFTER her move.
 *
 * The carry runs from `moveToken`, where Foundry still reports the Servant at
 * her ORIGIN until the animation ends (`engine/io.mjs`; §46.4-BZ recorded the
 * same timing for knockback). So the board still stands her on her origin
 * panel, and a Master exactly one move behind her -- which includes the ordinary
 * 1-panel follow -- lands on that panel: `occupantAt` found her there and the
 * carry refused with "the landing panel is occupied" (#118). This treats her as
 * already standing on `destination`, with her footprint translated to it, before
 * it asks who holds the landing. A board that has already caught up (a Riding
 * Attack's carry, after the displacement) gives the same answer.
 *
 * Bounds and a panel held by SOMEONE ELSE still refuse.
 *
 * @param {object} servant the Servant's snapshot
 * @param {object} master the Master's snapshot
 * @param {GridOffset} origin where the Servant was
 * @param {GridOffset} destination where she is going, or now is
 * @param {object} board
 * @returns {{ok: true, panel: GridOffset}|{ok: false, reason: "offBoard"|"panelOccupied"}}
 */
export function passengerLanding(servant, master, origin, destination, board) {
  const panel = passengerDestination(origin, destination, master.panel, board?.bounds ?? null);
  if (!panel) return { ok: false, reason: "offBoard" };
  // A delta of zero carries nobody anywhere.
  if (panel.i === master.panel.i && panel.j === master.panel.j) return { ok: true, panel };

  // The Servant where she will stand, whatever the board says: her footprint
  // keeps its shape about her anchor and is moved onto the destination.
  const anchor = servant.panel ?? origin;
  const footprint = (servant.panels ?? [anchor]).map((p) => ({
    ...p, i: p.i - anchor.i + destination.i, j: p.j - anchor.j + destination.j,
  }));
  const arrived = { ...servant, panel: { ...anchor, i: destination.i, j: destination.j }, panels: footprint };
  const after = { ...board, units: (board?.units ?? []).map((u) => (u.id === servant.id ? arrived : u)) };

  // Another Unit on the landing. The Master is not his own obstacle: it is a
  // different panel from the one he leaves.
  const holder = occupantsAt(panel, after, master.level ?? 0).find((u) => u.id !== master.id);
  return holder ? { ok: false, reason: "panelOccupied" } : { ok: true, panel };
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
 * @returns {{ok: boolean, reasons: string[], cost: number}}
 */
export function validatePath(path, unit, board) {
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

  const segmentProblem = segmentCheck(unit);
  if (segmentProblem) reasons.push(segmentProblem);

  return { ok: reasons.length === 0, reasons, cost };
}

/**
 * Whether this unit may begin another movement segment at all.
 *
 * Asks the `doubleMove` grant, and nothing else. This used to be decided by
 * whether the Unit held an item NAMED Riding, so a Servant whose Riding does
 * not grant Double Move all the time moved after an Attack every Turn: Pollux
 * and Drake, whose sheets unlock it only on the Turn of the Active, and Pale
 * Rider, whose Riding grants none of it (#117).
 *
 * @param {object} unit
 * @returns {string|null} the refusal, or `null` when it may move
 */
export function segmentCheck(unit) {
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
  // position"*. Double Move is the exception, and its two segments — before the
  // Attack and after it — share the one MOV allowance already checked above.
  if (!state.attacked) return null;
  if (!hasGranted(unit, GRANTS.doubleMove)) return "This Unit has Attacked; it cannot Move again this Turn.";
  return null;
}

/* -------------------------------------------------------------------------- */

/**
 * May this unit move *through* the panel? Clauses 3–5.
 *
 * @param {GridOffset} panel
 * @param {object} unit
 * @param {object} board
 * @param {object} [opts]
 * @param {boolean} [opts.throughEnemies] a Riding Attack's exemption: an enemy in
 *   the line is not in the way, it is hit. Everything else still applies.
 * @returns {boolean}
 */
export function canPassThrough(panel, unit, board, { throughEnemies = false } = {}) {
  if (ignoresBlocking(unit)) return true;
  // A Unit that may STOP on an occupied panel must be able to cross one:
  // ending a move somewhere it could not pass through is incoherent, and the
  // Quetzalcoatlus's own sheet says both halves -- *"ignores obstacles while
  // Moving, and can Move onto occupied panels"*.
  //
  // This is still not `ignoresBlocking`: that flag makes
  // `engine/movement-hooks.mjs` knock the occupant off the panel, and a sharing
  // Unit displaces nobody.
  if (unit?.sharesPanel) return !inEnemyMasterProtection(panel, unit, board);

  // Platforms and structures are terrain, not Units: a Platform is stood on,
  // and clause 3 is about *Units*, so neither blocks a step. Nor does a body:
  // a defeated Unit may be passed through until it leaves the board, and is
  // not a panel to stop on (`canStopOn`; ruled 2026-10-02, #65, ruling 25).
  const blocking = occupantsAt(panel, board, unit.level)
    .some((o) => !OBJECT_KINDS.has(o.kind) && !o.defeated && isEnemy(unit, o, board));
  if (blocking && !throughEnemies) return false;
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

  // A Platform's edge holds (#29). Nothing constrained a Unit at a Platform's
  // level to that Platform's footprint, so a passenger could walk off the edge
  // by ordinary movement and stand at Platform elevation on nothing at all.
  // Leaving a Platform is a Jump or a Knocked Off; it is never a walk.
  //
  // Asked of the Unit's OWN level, so the ground is unconstrained, and never of
  // a Platform itself -- a Platform is the thing being stood on.
  if (unit?.kind !== "platform" && (unit?.level ?? 0) > 0) {
    const under = (board?.units ?? []).find(
      (u) => u.kind === "platform" && (u.level ?? 0) === (unit.level ?? 0),
    );
    if (under && !withinFootprint(panel, under)) return false;
  }

  // Clause 8 — the linked-group leash (Ch. 32). *"the maximum distance
  // between the two is 2 panels."* A hard constraint on where a member may
  // STAND, not a penalty, and not a constraint on the path: stepping out to 3
  // and back to 1 is legal, which is what lets a twin walk around a wall.
  //
  // Here rather than in a cost function, because `canStopOn` is what the
  // reachable-set search already consults -- so the highlight shrinks as the
  // partner moves and the rule teaches itself.
  //
  // A partner not on the board constrains nothing (`partnersOf` drops units
  // with no panel); a leash that refused every panel would freeze the survivor
  // solid. Forced displacement may still break it -- Ch. 45 takes that
  // DECISION, because dragging the partner along would produce a knockback
  // that pulls a unit toward its attacker.
  const leash = unit?.linkedGroup?.leash;
  if (leash !== null && leash !== undefined) {
    for (const partner of partnersOf(unit, board)) {
      if (geo.chebyshev(panel, partner.panel) > leash) return false;
    }
  }

  const here = occupantsAt(panel, board, unit.level).filter((u) => u.id !== unit.id);
  if (here.length === 0) return true;

  // A Unit that SHARES panels is stopped only by another object. Two figurines
  // cannot stand on the same square; a figurine and a Servant can.
  //
  //   "The Quetzalcoatlus ... can Move onto occupied panels (place the
  //    Quetzalcoatlus on top of anything occupying said panels)."
  //
  // Distinct from `ignoresBlocking` below, which is Bašmu's and Kingprotea's
  // and knocks the occupant off the panel instead of standing on it.
  if (unit?.sharesPanel) return !here.some((u) => OBJECT_KINDS.has(u.kind));

  // Platforms and Structures are stood on, not blocked by, and Huge Scale
  // overlaps by design.
  if (here.every((u) => OBJECT_KINDS.has(u.kind))) return true;
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
  // ...and while the prey is not its enemy at all: a Unit Pale Rider has
  // charmed is his ally for the Charm's duration (ruled 2026-10-04, #180).
  if (relationOf(unit, prey, board) !== "enemy") return { ok: true };

  const before = geo.chebyshev(path[0], prey.panel);
  const after = geo.chebyshev(path[path.length - 1], prey.panel);
  // Closing OR holding. "Constantly Move towards that Unit" is a direction,
  // not a speed, and a Spirit already adjacent has nowhere closer to go.
  return after <= before
    ? { ok: true }
    : { ok: false, reason: `${unit.name ?? "This summon"} must Move towards ${prey.name ?? "its target"}.` };
}

/**
 * Decoy's movement half.
 *
 * > *"That enemy Unit cannot Move away from the Unit with Decoy, and can only
 * > Move in its direction."*
 *
 * The same shape as {@link pursuitVerdict} and deliberately a separate
 * function: a pursuit is a property of the mover (a Kagome Spirit summoned for
 * one enemy), and a Decoy pull is a property of somebody else that the board
 * pass stamps on the mover each time it is projected. Merging them would make
 * one refusal message stand for two different rules.
 *
 * Holding position is legal. "Cannot Move **away**" forbids increasing the
 * distance, not standing still, and a Unit already adjacent has nowhere closer
 * to go.
 *
 * @param {object} unit a projected unit, carrying `decoy`
 * @param {Array<{i: number, j: number}>} path
 * @param {object} board
 * @returns {{ok: boolean, reason?: string}}
 */
export function decoyVerdict(unit, path, board) {
  const sourceId = unit?.decoy?.sourceUnitId ?? null;
  if (!sourceId || !Array.isArray(path) || path.length < 2) return { ok: true };

  const decoy = (board?.units ?? []).find((u) => u.id === sourceId);
  if (!decoy?.panel || decoy.defeated) return { ok: true };

  const before = geo.chebyshev(path[0], decoy.panel);
  const after = geo.chebyshev(path[path.length - 1], decoy.panel);
  return after <= before
    ? { ok: true }
    : { ok: false, reason: `${unit.name ?? "This Unit"} cannot Move away from ${decoy.name ?? "the Decoy"}.` };
}

/**
 * Zone denial around an enemy Master.
 * @param {{i: number, j: number}} panel
 * @param {object} unit
 * @param {object} board
 * @returns {boolean}
 */
export function inEnemyMasterProtection(panel, unit, board) {
  // An OPTIONAL rule. It is the one clause in Ch. 05 that stops a player moving
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
 * **When `origin` is the panel the unit is already standing on** there is no
 * direction to push along — `cardinalToward` returns `{0, 0}` — and the search
 * fans out over the four cardinals instead, nearest panel first. That is the
 * ordinary case rather than a corner one: a 1×1 mover walks ONTO its victim, so
 * the mover's panel and the victim's are the same panel, and the directional
 * branch returned `null` every time. Bašmu never knocked anybody back.
 * Kingprotea's caller passes the CENTRE of her footprint, so a Unit under her
 * edge is shoved outward and only one under her middle fans out.
 *
 * @param {GridOffset} origin what the knockback is FROM
 * @param {object} unit the unit being knocked back
 * @param {object} board
 * @param {object} [opts]
 * @param {number} [opts.maxSteps] how far along the line to search
 * @returns {GridOffset|null} `null` when no free panel was found within range
 */
export function knockbackPanel(origin, unit, board, {
  maxSteps = 5, preferredDirection = null, allowSidestep = false,
} = {}) {
  // *"the Unit occupying said panel is forced to Move BACKWARD until Achilles
  // stops Moving in that direction"* — Akhilleus Kosmos shoves along the
  // mover's own travel rather than away from a point, so the caller may name
  // the direction outright. Kingprotea's cascade names none and the direction
  // is derived from her centre, as before.
  const toward = preferredDirection ?? geo.cardinalToward(origin, unit.panel);
  const fanned = (toward.i === 0 && toward.j === 0);
  const directions = fanned
    ? [{ i: -1, j: 0 }, { i: 1, j: 0 }, { i: 0, j: -1 }, { i: 0, j: 1 }]
    : [toward];

  // Free of UNITS. A platform or a structure is stood on, not in the way --
  // `canStopOn` and `freePanels` say it in the same words -- and the Hanging
  // Gardens covers every panel of its own deck, so counting it left Bašmu,
  // which only ever moves there, with nowhere to push anybody (§46.4-BU).
  const free = (panel) => !occupantsAt(panel, board, unit.level)
    .some((u) => u.kind !== "platform" && u.kind !== "structure" && !u.sharesPanel);

  // Step by step rather than direction by direction, so a fanned-out search
  // returns the NEAREST free panel rather than the first direction's.
  for (let step = 1; step <= maxSteps; step++) {
    for (const dir of directions) {
      const panel = { i: unit.panel.i + dir.i * step, j: unit.panel.j + dir.j * step };
      if (!geo.inBounds(panel, board.bounds ?? null)) continue;
      if (free(panel)) return { panel, sidestepped: false };
    }
  }

  // *"If the Unit does not or cannot vacate those panels, that Unit is
  // forcefully Moved to one of the panels to its sides, and receives damage
  // equivalent to a Normal Attack."* The fallback is a different OUTCOME rather
  // than a wider search: it is the clause that makes his push hurt, and the
  // caller has to know which one it got.
  if (!allowSidestep || fanned) return null;
  for (const side of perpendicular(toward)) {
    const panel = { i: unit.panel.i + side.i, j: unit.panel.j + side.j };
    if (!geo.inBounds(panel, board.bounds ?? null)) continue;
    if (free(panel)) return { panel, sidestepped: true };
  }
  return null;
}

/**
 * Who a knockback moves, and where -- planned in full before anything moves.
 *
 * `footprint` is where the mover is ARRIVING, which the caller takes from the
 * movement: at `moveToken` the token still reports where it came from. Each
 * Unit is moved once, however many level layers the footprint lists a panel
 * for (a Bašmu's are k 20, 21 and 22), and each landing is judged against the
 * Units already planned to have moved. The loop this replaces visited every
 * layer and read a stale board, so Heracles fell off the garden three times and
 * his Master was pushed into the square Bašmu was arriving at (§46.4-BZ).
 *
 * Platforms, structures and Units that share a panel are stood on, not pushed.
 *
 * @param {object} mover
 * @param {GridOffset[]} footprint every panel the mover will occupy
 * @param {object} board
 * @param {object} [opts] passed to {@link knockbackPanel}
 * @returns {Array<{unitId: string, landing: {panel: GridOffset, sidestepped: boolean}}>}
 */
export function knockbackPlan(mover, footprint, board, opts = {}) {
  const cells = [];
  const seen = new Set();
  for (const p of footprint ?? []) {
    const key = `${p.i},${p.j}`;
    if (seen.has(key)) continue;
    seen.add(key);
    cells.push({ i: p.i, j: p.j });
  }
  if (cells.length === 0) return [];
  const centre = {
    i: Math.round(cells.reduce((n, p) => n + p.i, 0) / cells.length),
    j: Math.round(cells.reduce((n, p) => n + p.j, 0) / cells.length),
  };

  // The mover where it is going, and everybody else where they stand.
  let units = (board?.units ?? []).map((u) => (u.id === mover.id ? { ...u, panels: cells } : u));
  const moved = new Set([mover.id]);
  const plan = [];
  for (const cell of cells) {
    for (const occupant of occupantsAt(cell, { units }, mover.level)) {
      if (moved.has(occupant.id)) continue;
      if (occupant.kind === "platform" || occupant.kind === "structure" || occupant.sharesPanel) continue;
      moved.add(occupant.id);
      const landing = knockbackPanel(centre, occupant, { ...board, units }, opts);
      if (!landing) continue;
      plan.push({ unitId: occupant.id, landing });
      units = units.map((u) => (u.id === occupant.id ? { ...u, panel: landing.panel, panels: [landing.panel] } : u));
    }
  }
  return plan;
}

/**
 * The two cardinals at right angles to `dir` — "the panels to its sides".
 * @param {GridOffset} dir
 * @returns {GridOffset[]}
 */
function perpendicular(dir) {
  return dir.i !== 0
    ? [{ i: 0, j: -1 }, { i: 0, j: 1 }]
    : [{ i: -1, j: 0 }, { i: 1, j: 0 }];
}

/**
 * @param {GridOffset} panel
 * @param {object} board
 * @returns {object|null}
 */
export function occupantsAt(panel, board, level = 0) {
  const here = level ?? 0;
  return (board.units ?? []).filter((u) => {
    if ((u.level ?? 0) !== here) return false;
    const footprint = u.panels ?? (u.panel ? [u.panel] : []);
    return footprint.some((p) => p.i === panel.i && p.j === panel.j);
  });
}

/**
 * The FIRST unit standing on a panel, or `null`.
 *
 * Every caller that asks "is this panel free" wants this. A caller that has to
 * act on whoever is there wants {@link occupantsAt} instead: a mover that walks
 * ONTO somebody shares their panel, so "the occupant" may be the mover itself
 * and the Unit it is standing on goes unseen. Found live — Achilles walked onto
 * Karna and pushed nobody, because the board listed him first.
 *
 * @param {GridOffset} panel
 * @param {object} board
 * @param {number} [level]
 * @returns {object|null}
 */
export function occupantAt(panel, board, level = 0) {
  // Per LEVEL, not per panel. Ch. 27 gives each platform its own Scene Level for
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
  // Sides, so a charmed Unit is its charmer's ally here too (#180).
  const mine = sideOf(unit);
  const theirs = sideOf(other);
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
  if (IGNORES_BLOCKING.some((id) => held.includes(id))) return true;
  // The summon's own field (Bašmu), or a Skill that grants the capability
  // (Kingprotea's *Huge Scale*). The second is a grant rather than a field
  // because a Skill can be sealed and a sheet cannot.
  return Boolean(unit?.ignoresOccupancy) || hasGranted(unit, GRANTS.ignoresOccupancy);
}
