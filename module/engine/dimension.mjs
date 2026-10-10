/**
 * @file The Storm Border — a pocket dimension, entered and left.
 * @see docs/27-platforms-and-levels.md, char_orig_sheets/Copia de Nemo.md
 *
 * Layer 3 (engine).
 *
 * A dimension is a platform with **no ground footprint**, so the placement half
 * is `engine/platforms.mjs`'s and is not rewritten here: `activatePlatform`
 * already creates the Scene Level, moves the manifest onto it and sinks the
 * platform token beneath its passengers. What is new is everything *about* the
 * manifest — who may enter, who had to roll for it, how long they have, and
 * where they come out.
 *
 * Four of the five exported functions are **pure** and take no document:
 * {@link manifestFor}, {@link travelDistance}, {@link placementIsLegal} and
 * {@link onOwnerDefeat}. Who is eligible, how far the vessel reaches, whether a
 * destination is legal and what a failed Luck Check costs are all questions
 * with right answers, and they should be checkable without a world. Only
 * {@link enterDimension} and {@link resurface} touch Foundry.
 */

import * as I from "./intents.mjs";
import { worldIO, displaceToken } from "./io.mjs";
import { chooseFor, askOwner } from "./ask.mjs";
import { applyIntents } from "./applier.mjs";
import { chebyshev, inBounds } from "../domain/geometry.mjs";
import { parseTick, resolveTicks } from "../domain/tick.mjs";
import { currentBoard } from "./board.mjs";
import { activatePlatform } from "./platforms.mjs";
import * as rollLog from "../rules/roll-log.mjs";
import { relationOf } from "../rules/relations.mjs";
import { occupantsAt } from "../rules/movement.mjs";
import { interiorOf, withinInterior } from "../rules/platforms.mjs";

export { interiorOf, withinInterior };

/**
 * Apply a batch of intents as this client.
 *
 * A local copy of the two-line wrapper `engine/attack.mjs` keeps privately --
 * the same shape, because both are "apply these intents through the world IO
 * with the usual ownership gate". Importing that one is not an option: it is
 * not exported, and `attack.mjs` already imports this file's `onOwnerDefeat`,
 * so reaching back would close a cycle.
 *
 * @param {object[]} intents
 * @param {string} source
 * @returns {Promise<unknown>}
 */
async function applyBatch(intents, source) {
  return applyIntents(intents, {
    io: worldIO(),
    canWrite: (unitId) => game.actors.get(unitId)?.isOwner ?? false,
    isGM: game.user.isGM,
    source,
  });
}

/**
 * @typedef {object} Manifest
 * @property {string[]} eligibleAllies  allies close enough to be offered a place
 * @property {string[]} eligibleEnemies enemies close enough to attempt entry
 * @property {string[]} entering        everyone who actually goes in
 * @property {Array<{unitId: string, roll: number, successOn: number, entered: boolean}>} enemyAttempts
 */

/** What is never a Unit that enters a dimension. */
const ENTRY_EXCLUDED = new Set(["platform", "structure"]);

/**
 * Who goes into the Storm Border.
 *
 * > *"Nemo and any number of allied Units within a 2 panel area of himself
 * > enters the Storm Border ... Enemy Units within a 3 panel area of Nemo when
 * > Zero Sail is activated can attempt to enter the Storm Border as well, roll
 * > a twenty-sided die; the enemy Unit only successfully enters if it rolls 18
 * > or higher."*
 *
 * `chosenAllyIds` is INTERSECTED with the eligible set rather than trusted. A
 * chooser that takes its input at face value lets a player walk a Servant
 * across the board into a submarine, and the range is the rule.
 *
 * @param {object} spec the platform's `dimension`
 * @param {{owner: object, board: object, chosenAllyIds: string[],
 *          rolls: Record<string, number>}} ctx
 * @returns {Manifest}
 */
export function manifestFor(spec, { owner, board, chosenAllyIds = [], rolls = {} }) {
  const units = board?.units ?? [];
  const within = (u, r) => u.panel && owner?.panel && chebyshev(owner.panel, u.panel) <= r;

  const allyRange = spec?.entry?.allies?.range ?? 0;
  const enemyRange = spec?.entry?.enemies?.range ?? 0;
  const successOn = spec?.entry?.enemies?.successOn ?? Infinity;

  // Units, and living ones. A platform, a structure or a body is not a Unit
  // that "enters" anything, and an allied Golden Hind within 2 panels was
  // offered a seat in the submarine.
  const candidates = units.filter((u) => u.id !== owner.id && !ENTRY_EXCLUDED.has(u.kind) && !u.defeated);

  // By RELATION, not by faction id (#191 reading 2): a Civilian or an
  // unassigned Unit is neither an ally nor an enemy, and comparing faction ids
  // made every Civilian within 3 an enemy who could roll to come aboard.
  const eligibleAllies = candidates
    .filter((u) => relationOf(owner, u, board) === "ally" && within(u, allyRange))
    .map((u) => u.id);

  const eligibleEnemies = candidates
    .filter((u) => relationOf(owner, u, board) === "enemy" && within(u, enemyRange))
    .map((u) => u.id);

  // EVERY attempt, passed or failed. A 15% gate that reports only its
  // successes is unauditable, and the whole point of rolling in the open is
  // that the table can see the two that did not make it.
  const enemyAttempts = eligibleEnemies
    .filter((id) => rolls[id] !== undefined)
    .map((id) => ({
      unitId: id, roll: rolls[id], successOn, entered: rolls[id] >= successOn,
    }));

  const chosen = eligibleAllies.filter((id) => chosenAllyIds.includes(id));
  const boarded = enemyAttempts.filter((a) => a.entered).map((a) => a.unitId);

  return {
    eligibleAllies,
    eligibleEnemies,
    entering: [owner.id, ...chosen, ...boarded],
    enemyAttempts,
  };
}

/**
 * How far the Storm Border may travel before it surfaces.
 *
 * > *"This distance is 2+X panels, where X=1 for every ⅓◈ Turns spent within
 * > Imaginary Numbers Space (e.g. 1◈ Turns spent in Imaginary Numbers Space,
 * > Nemo can travel 2+3=5 panels)."*
 *
 * **The worked example is a three-Turns-per-Round example and nothing else.**
 * ◈ is turns-per-Round and varies by war variant — 3 for the Great Holy Grail
 * War, 8 for the Holy Grail War, 15 for Snowfield — so ⅓◈ is 1, 2 or 5 Turns
 * respectively, and those come from `TICK_OVERRIDES` rather than from
 * `floor(turns / 3)`, which disagrees at every one of them. Hard-coding the 5
 * would silently shorten every war that is not the Great Holy Grail War.
 *
 * @param {object} spec the platform's `dimension`
 * @param {{turnsInside: number, turnsPerRound: number}} ctx
 * @returns {number}
 */
export function travelDistance(spec, { turnsInside, turnsPerRound }) {
  const perStep = resolveTicks({ kind: "rounds", whole: 0, frac: { num: 1, den: 3 }, sign: 1 },
    { turnsPerRound });
  // Never 0 for any supported variant, but a guard here is cheaper than an
  // Infinity reaching the placement validator.
  const steps = perStep > 0 ? Math.floor(turnsInside / perStep) : 0;
  return 2 + steps;
}

/**
 * Whether a chosen resurface destination is legal.
 *
 * Two clauses, and the second is ruling R3: *"excluding enemy Home Bases"* bars
 * the 5×5 from **overlapping** one, not merely from being centred on one. A
 * centre-only test would let a five-panel square land four-fifths inside an
 * enemy base.
 *
 * @param {object} spec the platform's `dimension`
 * @param {{at: {i: number, j: number}, from: {i: number, j: number},
 *          distance: number, board: object, factionId: string}} ctx
 * @returns {boolean}
 */
export function placementIsLegal(spec, { at, from, distance, board, factionId }) {
  if (!at || !from) return false;
  if (chebyshev(at, from) > distance) return false;

  const { w = 5, h = 5 } = spec?.relocateOnExit?.shape ?? {};
  const halfW = Math.floor(w / 2);
  const halfH = Math.floor(h / 2);

  // The board carries its Home Bases as `zones` (`engine/board.mjs#homeBaseZonesOf`);
  // this read `homeBases`, which no board has, so a 5x5 could surface inside an
  // enemy Home Base on a live board while every test passed (#191). Both, so a
  // test board may still say `homeBases`.
  const forbidden = new Set(
    [...(board?.homeBases ?? []), ...Object.values(board?.zones ?? {})]
      // "enemy Home Bases" -- his own is not one. A zone names its side
      // `faction`, a test board's base `factionId`.
      .filter((b) => (b.factionId ?? b.faction) !== factionId)
      .flatMap((b) => (b.panels ?? []).map((p) => `${p.i},${p.j}`)),
  );
  if (forbidden.size === 0) return true;

  for (let i = at.i - halfH; i <= at.i + halfH; i++) {
    for (let j = at.j - halfW; j <= at.j + halfW; j++) {
      if (forbidden.has(`${i},${j}`)) return false;
    }
  }
  return true;
}

/* -------------------------------------------------------------------------- */
/*  The inside, and the way back out (#191 readings 3, 4, 6 and 8)            */
/* -------------------------------------------------------------------------- */

/**
 * The eight ways a square can be laid down: four turns, each mirrored or not.
 *
 * > *"…in any orientation."* (#191 reading 6)
 *
 * @type {ReadonlyArray<string>}
 */
export const ORIENTATIONS = Object.freeze(["r0", "r90", "r180", "r270", "m0", "m90", "m180", "m270"]);

/**
 * An offset from the centre, turned and perhaps mirrored.
 *
 * `r` turns clockwise as the board is drawn -- rows run down, columns right, so
 * a Unit to the centre's right goes below it at `r90`. `m` mirrors left for
 * right first, then turns. `r0` is the formation as it stood inside.
 *
 * @param {{i: number, j: number}} offset
 * @param {string} orientation one of {@link ORIENTATIONS}
 * @returns {{i: number, j: number}}
 */
export function orient(offset, orientation = "r0") {
  const mirrored = orientation.startsWith("m");
  let { i, j } = mirrored ? { i: offset.i, j: -offset.j } : offset;
  const turns = (Number(orientation.slice(1)) / 90) % 4;
  for (let t = 0; t < turns; t++) ({ i, j } = { i: j, j: -i });
  // `-0` is a different key from `0` to nobody but `Object.is`, and a test.
  return { i: i + 0, j: j + 0 };
}

/**
 * Every panel a Unit covers, as offsets from its anchor.
 *
 * @param {object} unit a snapshot, `panels` set only for a multi-panel Unit
 * @returns {Array<{i: number, j: number}>}
 */
function footprintOffsets(unit) {
  const anchor = unit.panel;
  const panels = unit.panels?.length ? unit.panels : [anchor];
  return panels.map((p) => ({ i: p.i - anchor.i, j: p.j - anchor.j }));
}

/**
 * The panels nearest a wanted one first, ring by ring, then straight before
 * diagonal, then row-major, so
 * the answer is the same on every client.
 *
 * @param {Array<{i: number, j: number}>} panels
 * @param {{i: number, j: number}} wanted
 * @returns {Array<{i: number, j: number}>}
 */
function nearestFirst(panels, wanted) {
  const steps = (p) => Math.abs(p.i - wanted.i) + Math.abs(p.j - wanted.j);
  // Straight before diagonal within a ring: a Unit 3 panels below slides up to
  // the edge in its own column rather than into the corner beside it.
  return [...panels].sort((a, b) => (chebyshev(a, wanted) - chebyshev(b, wanted))
    || (steps(a) - steps(b)) || (a.i - b.i) || (a.j - b.j));
}

/**
 * Seat a set of Units on a square: each where it wants to be, or on the nearest
 * free panel of the square that holds its whole footprint.
 *
 * One answer to the question both ways in and out ask, so the two cannot
 * disagree about what "the nearest free panel" means.
 *
 * @param {Array<{id: string, offsets: Array<{i: number, j: number}>, wanted: {i: number, j: number}}>} movers
 *   in the order they are seated
 * @param {Array<{i: number, j: number}>} square the panels a Unit may cover
 * @param {(p: {i: number, j: number}) => boolean} free whether nothing else stands there
 * @returns {Record<string, {i: number, j: number}>|null} anchors, or `null` when one does not fit
 */
function seat(movers, square, free) {
  const inSquare = new Set(square.map((p) => `${p.i},${p.j}`));
  const taken = new Set();
  /** @type {Record<string, {i: number, j: number}>} */
  const out = {};
  for (const m of movers) {
    const fits = (anchor) => m.offsets.every((o) => {
      const p = { i: anchor.i + o.i, j: anchor.j + o.j };
      const k = `${p.i},${p.j}`;
      return inSquare.has(k) && !taken.has(k) && free(p);
    });
    const anchor = fits(m.wanted) ? m.wanted : nearestFirst(square, m.wanted).find(fits);
    if (!anchor) return null;
    for (const o of m.offsets) taken.add(`${anchor.i + o.i},${anchor.j + o.j}`);
    out[m.id] = { i: anchor.i, j: anchor.j };
  }
  return out;
}

/**
 * Where everybody stands once they are inside.
 *
 * Nemo at the centre, and everyone else at their offset from him; a Unit whose
 * offset falls outside the 5x5 -- an enemy that rolled its way in from 3 panels
 * -- slides to the nearest free panel of it (#191 reading 4, ruled 2026-10-10).
 * Seated nearest first, so a Unit already inside never loses its panel to one
 * sliding in from outside.
 *
 * @param {object} spec the platform's `dimension`
 * @param {{owner: object, entering: string[], board: object}} ctx
 * @returns {Record<string, {i: number, j: number}>} anchors on the dimension's Level
 */
export function entryPlacement(spec, { owner, entering, board }) {
  const interior = interiorOf(spec, owner.panel);
  const units = (board?.units ?? []).filter((u) => entering.includes(u.id) && u.panel);
  const movers = units
    .sort((a, b) => (a.id === owner.id ? -1 : b.id === owner.id ? 1 : 0)
      || (chebyshev(a.panel, owner.panel) - chebyshev(b.panel, owner.panel)))
    .map((u) => ({ id: u.id, offsets: footprintOffsets(u), wanted: u.panel }));
  // The Level is empty but for them, so nothing outside the movers is in the way.
  return seat(movers, interior.panels, () => true) ?? {};
}

/**
 * Where everybody lands, laid down on the board at `at` in `orientation`.
 *
 * Everyone keeps their panel in the 5x5, turned with it (#191 reading 6). A
 * board panel somebody else holds sends its Unit to the nearest free panel of
 * the 5x5; free is no Unit on the ground there -- a platform and a structure are
 * stood on, as everywhere else -- and inside the board. Too few free panels
 * refuses the spot.
 *
 * @param {object} spec the platform's `dimension`
 * @param {{from: {i: number, j: number}, at: {i: number, j: number}, orientation?: string,
 *          occupants: object[], board: object, factionId: string, distance: number}} ctx
 *   `occupants` are the snapshots inside, bodies included (#191 reading 9)
 * @returns {{ok: boolean, reason?: string, panels?: Record<string, {i: number, j: number}>}}
 */
export function landingPlan(spec, { from, at, orientation = "r0", occupants = [], board, factionId, distance }) {
  if (!placementIsLegal(spec, { at, from, distance, board, factionId })) return { ok: false, reason: "illegalPlacement" };
  const square = interiorOf(spec, at).panels;
  if (!square.every((p) => inBounds(p, board?.bounds ?? null))) return { ok: false, reason: "offBoard" };

  const aboard = new Set(occupants.map((u) => u.id));
  const free = (p) => !occupantsAt(p, board, 0)
    .some((u) => !aboard.has(u.id) && !ENTRY_EXCLUDED.has(u.kind));

  const movers = occupants
    .filter((u) => u.panel)
    .map((u) => {
      const turned = orient({ i: u.panel.i - from.i, j: u.panel.j - from.j }, orientation);
      const offsets = footprintOffsets(u).map((o) => orient(o, orientation));
      // A turned footprint's anchor is its top-left again.
      const top = Math.min(...offsets.map((o) => o.i));
      const left = Math.min(...offsets.map((o) => o.j));
      return {
        id: u.id,
        offsets: offsets.map((o) => ({ i: o.i - top, j: o.j - left })),
        wanted: { i: at.i + turned.i + top, j: at.j + turned.j + left },
      };
    });
  const panels = seat(movers, square, free);
  return panels ? { ok: true, panels } : { ok: false, reason: "noRoom" };
}

/**
 * Where it surfaces when Nemo has not said: centred on his own panel, or the
 * nearest legal spot to it (#191 reading 8, ruled 2026-10-10).
 *
 * Read for the forced exit with no plan, and for his defeat inside with no plan
 * still legal (reading 9). Searched ring by ring outward from his panel, and
 * never past the travel allowance, which his own panel is always within -- it is
 * inside the 5x5 and the allowance is never less than 2.
 *
 * @param {object} spec the platform's `dimension`
 * @param {{ownerPanel: {i: number, j: number}, from: {i: number, j: number},
 *          occupants: object[], board: object, factionId: string, distance: number}} ctx
 * @returns {{at: {i: number, j: number}, orientation: string, panels: Record<string, {i: number, j: number}>}|null}
 */
export function fallbackLanding(spec, { ownerPanel, from, occupants, board, factionId, distance }) {
  const reach = distance + chebyshev(ownerPanel, from);
  for (let r = 0; r <= reach; r++) {
    const ring = [];
    for (let i = ownerPanel.i - r; i <= ownerPanel.i + r; i++) {
      for (let j = ownerPanel.j - r; j <= ownerPanel.j + r; j++) {
        if (Math.max(Math.abs(i - ownerPanel.i), Math.abs(j - ownerPanel.j)) === r) ring.push({ i, j });
      }
    }
    for (const at of ring) {
      const plan = landingPlan(spec, { from, at, orientation: "r0", occupants, board, factionId, distance });
      if (plan.ok) return { at, orientation: "r0", panels: plan.panels };
    }
  }
  return null;
}

/**
 * What happens to the Storm Border when Nemo dies inside it.
 *
 * > *"If Nemo is defeated while Zero Sail is Active, he performs a Luck Check
 * > **before dying**. If successful, the Storm Border immediately resurfaces
 * > (**but he is still defeated**); if failed, all Units within the Storm
 * > Border are inflicted with Erase."*
 *
 * **This is not a revival and must not be registered as one.** The parenthesis
 * is the whole point: the check saves the passengers and never him. Offered as
 * a `RevivalSource` it would compete with his own Guts in the revival chain
 * and, on a success, leave him alive — which the sheet denies in the same
 * sentence that grants the check.
 *
 * @param {object|null} spec the platform's `dimension`, or null if not submerged
 * @param {{owner: object, succeeded: boolean, occupants: string[]}} ctx
 * @returns {{resurfaces: boolean, ownerStillDefeated: boolean, erased: string[]}|null}
 */
export function onOwnerDefeat(spec, { succeeded, occupants = [] }) {
  if (!spec?.onOwnerDefeat) return null;
  if (succeeded) return { resurfaces: true, ownerStillDefeated: true, erased: [] };
  // "ALL Units within the Storm Border" -- Nemo included. He is inside it.
  return { resurfaces: false, ownerStillDefeated: true, erased: [...occupants] };
}

/* -------------------------------------------------------------------------- */
/*  The document-touching half                                                */
/* -------------------------------------------------------------------------- */

/**
 * Which of the allies in reach come in, asked of the dimension owner's player.
 *
 * Every one ticked to start, because the usual answer is all of them; a
 * dismissed window is "nobody", as the Hanging Gardens' riders read it.
 *
 * @param {object|null} ownerDoc
 * @param {string[]} eligible
 * @returns {Promise<string[]>}
 */
async function chooseEntrants(ownerDoc, eligible) {
  if (!ownerDoc || eligible.length === 0) return [];
  const picked = await chooseFor(ownerDoc, {
    title: game.i18n.localize("FGT.Dimension.AlliesTitle"),
    hint: game.i18n.localize("FGT.Dimension.AlliesHint"),
    min: 0,
    count: eligible.length,
    preselected: eligible,
    options: eligible.map((id) => ({ id, name: game.actors.get(id)?.name ?? id })),
  });
  return picked ?? [];
}

/**
 * Which enemies in reach choose to try their luck at the door.
 *
 * @param {string[]} eligible
 * @param {object} spec the platform's `dimension`
 * @returns {Promise<string[]>}
 */
async function askAttempts(eligible, spec) {
  const successOn = spec.entry?.enemies?.successOn ?? 18;
  const answers = await Promise.all(eligible.map(async (id) => {
    const doc = game.actors.get(id);
    if (!doc) return null;
    const picked = await askOwner(doc, {
      kind: "choose",
      title: game.i18n.format("FGT.Dimension.AttemptTitle", { name: doc.name }),
      hint: game.i18n.format("FGT.Dimension.AttemptHint", { successOn }),
      min: 0,
      count: 1,
      options: [{ id: "attempt", name: game.i18n.format("FGT.Dimension.Attempt", { successOn }) }],
    });
    return (picked ?? []).includes("attempt") ? id : null;
  }));
  return answers.filter(Boolean);
}

/**
 * Open the dimension and move its manifest into it.
 *
 * Rolls each eligible enemy's `1d20` **into the roll log** before anything
 * moves, so the 18+ threshold and every roll against it are auditable rather
 * than asserted, then hands the manifest to `activatePlatform`.
 *
 * @param {object} args
 * @param {string} args.ownerId
 * @param {string} args.platformId content id of the dimension's platform
 * @param {string[]} [args.chosenAllyIds]
 * @returns {Promise<{ok: boolean, reason?: string, manifest?: Manifest}>}
 */
export async function enterDimension({ ownerId, platformId, chosenAllyIds = [] }) {
  const board = currentBoard();
  const owner = (board.units ?? []).find((u) => u.id === ownerId);
  if (!owner) return { ok: false, reason: "ownerNotOnBoard" };

  // The platform lives in a PACK, not in the world -- `platformId` here is a
  // content id, the same thing `summonPlatform`'s phase names. Looking only for
  // an existing world actor found nothing on the first use in a fresh world and
  // the Skill silently did nothing. Found live.
  //
  // A previous submersion leaves its actor behind, so an existing one is
  // reused rather than duplicated.
  let platform = game.actors.find((a) => a.system?.contentId === platformId && a.system?.ownerId === ownerId)
    ?? game.actors.get(platformId);
  if (!platform) {
    const { actorFromPacks } = await import("./skill-use.mjs");
    const source = await actorFromPacks(platformId);
    if (!source) return { ok: false, reason: "unknownPlatform" };
    const data = source.toObject();
    delete data._id;
    data.system.ownerId = ownerId;
    data.system.factionId = owner.factionId ?? null;
    platform = await Actor.create(data);
  }
  const spec = platform?.system?.dimension;
  if (!spec) return { ok: false, reason: "notADimension" };

  const probe = manifestFor(spec, { owner, board, chosenAllyIds: [], rolls: {} });
  const ownerDoc = game.actors.get(ownerId);

  // *"Nemo and ANY NUMBER of allied Units within a 2 panel area"* -- his
  // player's choice, every ally in reach ticked to start (#191 reading 1). The
  // phase passed no choice at all, so no ally ever came in. A caller that has
  // already chosen (a test, a macro) passes `chosenAllyIds` and is not asked.
  const allies = chosenAllyIds.length > 0 ? chosenAllyIds : await chooseEntrants(ownerDoc, probe.eligibleAllies);

  // *"Enemy Units ... CAN ATTEMPT to enter"*: each one's owner is asked, and
  // only a yes rolls (#191 reading 2). Asked together, so one slow table does
  // not hold the others; no answer by the prompt's timeout is no attempt.
  const attempting = await askAttempts(probe.eligibleEnemies, spec);

  // Roll first, so the manifest is decided by dice the table has seen.
  /** @type {Record<string, number>} */
  const rolls = {};
  /** @type {object[]} */
  const records = [];
  for (const id of attempting) {
    const roll = await new Roll(spec.entry?.enemies?.roll ?? "1d20").evaluate();
    rolls[id] = roll.total;
    records.push(rollLog.record({
      id: `${id}:enterStormBorder:${game.combat?.system?.globalTurn ?? 0}`,
      globalTurn: game.combat?.system?.globalTurn ?? 0,
      entryId: "enterStormBorder",
      formula: roll.formula,
      raw: roll.total,
      total: roll.total,
      purpose: `enters the Storm Border on ${spec.entry?.enemies?.successOn ?? "?"}+`,
      actorId: id,
    }));
  }

  const manifest = manifestFor(spec, { owner, board, chosenAllyIds: allies, rolls });

  const out = await activatePlatform({ platformId: platform.id, initialUnitIds: manifest.entering });
  if (!out.ok) return out;

  // Onto the 5x5: Nemo at its centre, everyone at their offset from him, and an
  // enemy that came in from 3 panels on the nearest free panel of its edge
  // (#191 reading 4). Displaced, not walked -- nobody chose to move there.
  const seats = entryPlacement(spec, { owner, entering: manifest.entering, board });
  for (const [unitId, panel] of Object.entries(seats)) {
    const token = canvas.scene?.tokens?.contents?.find((t) => t.actorId === unitId);
    const here = (board.units ?? []).find((u) => u.id === unitId)?.panel;
    if (!token || (here && here.i === panel.i && here.j === panel.j)) continue;
    const point = canvas.grid.getTopLeftPoint(panel);
    await displaceToken(token, { x: point.x, y: point.y });
  }

  await platform.update({
    "system.activatedAt": game.combat?.system?.globalTurn ?? 0,
    "system.ownerId": ownerId,
    // WHERE IT SUBMERGED. The travel allowance is measured from here, and
    // `resurface` read a field nothing wrote -- so it fell back to the owner's
    // current panel, which a submerged Unit does not have, and then to the
    // destination itself, which makes every placement trivially legal.
    "system.submergedFrom": { i: owner.panel.i, j: owner.panel.j },
  });

  await applyBatch(
    records.map((r) => I.log({
      kind: "ability", unitId: r.actorId, roll: r.total,
      detail: `Storm Border entry: ${r.total} vs ${spec.entry?.enemies?.successOn}+`,
      tick: game.combat?.system?.globalTurn ?? 0,
    })),
    "stormBorderEntry",
  );

  // Said on the chat log, every attempt with its die: a 15% door that only the
  // flag log knew about was a roll the table never saw (#191).
  const name = (id) => game.actors.get(id)?.name ?? id;
  await postDimensionCard([
    game.i18n.format("FGT.Dimension.Entered", {
      names: manifest.entering.map(name).join(", "),
      i: owner.panel.i, j: owner.panel.j,
    }),
    ...manifest.enemyAttempts.map((a) => game.i18n.format(
      a.entered ? "FGT.Dimension.AttemptPassed" : "FGT.Dimension.AttemptFailed",
      { name: name(a.unitId), roll: a.roll, successOn: a.successOn },
    )),
  ].join(" "));

  Hooks.callAll("fgtDimensionEntered", platform, manifest);
  return { ok: true, manifest };
}

/**
 * Surface the Storm Border and put everybody aboard back on the board.
 *
 * Laid down on Nemo's plan when he has one and it is still legal; otherwise,
 * when it must surface -- the 2◈ ceiling, his defeat inside -- centred on his
 * own panel or the nearest legal spot to it (#191 readings 6, 8 and 9). A plan
 * that has gone bad on a surface he CHOSE is called off instead, and he may
 * press again: `forced` is the difference.
 *
 * Everyone inside lands at once, bodies too, each token set down on the ground
 * Level at its panel in one write. Then Zero Sail switches off and its 5◈
 * starts -- *"Cooldown: 5◈ Turns after Nemo resurfaces"* -- which nothing did:
 * the mode stayed on for good and the clock never began.
 *
 * @param {object} args
 * @param {string} args.platformId
 * @param {{at: {i: number, j: number}, orientation?: string}|null} [args.plan]
 * @param {boolean} [args.forced]
 * @param {{i: number, j: number}|null} [args.ownerPanel] where Nemo stands inside,
 *   when his snapshot is not the one to read -- his body, mid-defeat
 * @returns {Promise<{ok: boolean, reason?: string, distance?: number, moved?: string[], at?: object}>}
 */
export async function resurface({ platformId, plan = null, forced = false, ownerPanel = null }) {
  const platform = game.actors.get(platformId)
    ?? game.actors.find((a) => a.system?.contentId === platformId);
  const spec = platform?.system?.dimension;
  if (!spec) return { ok: false, reason: "notADimension" };

  const board = currentBoard();
  const turnsPerRound = game.settings.get("fgt", "turnsPerRound");
  const now = game.combat?.system?.globalTurn ?? 0;
  const turnsInside = Math.max(0, now - (platform.system?.activatedAt ?? now));
  const distance = travelDistance(spec, { turnsInside, turnsPerRound });

  // Stamped at entry: the travel allowance is measured from here.
  const from = platform.system?.submergedFrom;
  if (!from) return { ok: false, reason: "noSubmergePoint" };

  // Everybody on the dimension's Level, the living and the bodies (#191
  // reading 9) -- by Level, because a dimension has no footprint to stand on
  // and the Level is the only record of who is inside.
  const levelId = platform.system?.levelId;
  const occupants = (board.units ?? []).filter((u) => u.levelId === levelId && u.id !== platform.id && u.panel);
  const owner = occupants.find((u) => u.id === platform.system?.ownerId)
    ?? (board.units ?? []).find((u) => u.id === platform.system?.ownerId);
  const factionId = platform.system?.factionId;

  let landing = null;
  if (plan?.at) {
    const out = landingPlan(spec, {
      from, at: plan.at, orientation: plan.orientation ?? "r0", occupants, board, factionId, distance,
    });
    if (out.ok) landing = { at: plan.at, orientation: plan.orientation ?? "r0", panels: out.panels };
    else if (!forced) return { ok: false, reason: out.reason, distance };
  }
  if (!landing) {
    landing = fallbackLanding(spec, {
      ownerPanel: ownerPanel ?? owner?.panel ?? from, from, occupants, board, factionId, distance,
    });
  }
  if (!landing) return { ok: false, reason: "noRoom", distance };

  const { groundLevel, teardown } = await import("./scene-levels.mjs");
  const ground = groundLevel();
  for (const unit of occupants) {
    const panel = landing.panels[unit.id];
    const token = canvas.scene?.tokens?.contents?.find((t) => t.actorId === unit.id);
    if (!panel || !token) continue;
    const point = canvas.grid.getTopLeftPoint(panel);
    await displaceToken(token, {
      x: point.x, y: point.y,
      ...(ground ? { level: ground.id, elevation: ground.elevation?.bottom ?? 0 } : {}),
    });
  }

  await endZeroSail(platform);
  await teardown(platform);

  await applyBatch([I.log({
    kind: "ability", unitId: platform.system?.ownerId ?? null, tick: now,
    detail: `The Storm Border surfaces at (${landing.at.i}, ${landing.at.j}), ${landing.orientation}, `
      + `${chebyshev(landing.at, from)} of ${distance} panels${forced ? " (forced)" : ""}.`,
  })], "stormBorderResurface");
  await postDimensionCard(game.i18n.format("FGT.Dimension.Surfaced", {
    i: landing.at.i, j: landing.at.j, moved: occupants.length,
  }));

  Hooks.callAll("fgtDimensionSurfaced", platform, { distance, forced });
  return { ok: true, distance, moved: occupants.map((u) => u.id), at: landing.at };
}

/**
 * Switch Zero Sail off and start its clock from now.
 *
 * The ability is found by the phase that opened this dimension, as
 * `engine/platforms.mjs#setCooldownOnDestruction` finds a platform's, so the
 * content's slug is never assumed.
 *
 * @param {object} platform the dimension's actor
 * @returns {Promise<void>}
 */
async function endZeroSail(platform) {
  const owner = platform.system?.ownerId ? game.actors.get(platform.system.ownerId) : null;
  const contentId = platform.system?.contentId;
  const ability = owner?.items?.find?.((i) => (i.system?.phases ?? [])
    .some((p) => p.kind === "enterDimension" && p.platformId === contentId));
  if (!owner || !ability) return;
  const intents = [I.setMode(owner.id, ability.id, false, "resurfaced")];
  const cd = ability.system?.cooldown ?? null;
  if (cd?.countFrom === "deactivation" && cd.max) {
    const ticks = resolveTicks(parseTick(String(cd.max)), { turnsPerRound: game.settings.get("fgt", "turnsPerRound") });
    if (ticks > 0) intents.push(I.cooldown(owner.id, ability.id, ticks, "set"));
  }
  await applyBatch(intents, "stormBorder:resurfaced");
}

/**
 * A line on the chat log about the Storm Border.
 *
 * @param {string} text already localized
 * @returns {Promise<void>}
 */
export async function postDimensionCard(text) {
  if (!game.users?.activeGM?.isSelf) return;
  const escape = foundry.utils.escapeHTML;
  await ChatMessage.create({
    content: `<div class="fgt-card fgt-card--dimension"><p>${escape(text)}</p></div>`,
    flags: { fgt: { dimension: true } },
  });
}

/**
 * Plan a resurface for the next Turn End, or call one off.
 *
 * > *"At the end of any Turn, Nemo can choose to resurface the Storm Border."*
 *
 * Pressed at any moment; carried out at the boundary (#191 reading 5). The plan
 * is checked now against the allowance it will have THEN, which is never less,
 * so a spot that is legal now is never refused for distance later -- only for a
 * panel taken in between, which `resurface` sends to the nearest free one.
 *
 * @param {object} args
 * @param {string} args.platformId
 * @param {{at: {i: number, j: number}, orientation?: string}|null} args.plan `null` calls it off
 * @param {string} [args.by] the user who pressed it
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
export async function scheduleResurface({ platformId, plan, by = null }) {
  const platform = game.actors.get(platformId);
  const spec = platform?.system?.dimension;
  if (!spec || platform.system?.activatedAt === null || platform.system?.activatedAt === undefined) {
    return { ok: false, reason: "notSubmerged" };
  }
  if (!plan) {
    await platform.update({ "system.resurfacePlan": null });
    return { ok: true };
  }
  const from = platform.system?.submergedFrom;
  const board = currentBoard();
  const turnsPerRound = game.settings.get("fgt", "turnsPerRound");
  const now = game.combat?.system?.globalTurn ?? 0;
  const distance = travelDistance(spec, { turnsInside: Math.max(0, now - platform.system.activatedAt), turnsPerRound });
  const occupants = (board.units ?? []).filter((u) => u.levelId === platform.system?.levelId && u.panel);
  const check = landingPlan(spec, {
    from, at: plan.at, orientation: plan.orientation ?? "r0", occupants, board,
    factionId: platform.system?.factionId, distance,
  });
  if (!check.ok) return check;
  await platform.update({
    "system.resurfacePlan": { at: { i: plan.at.i, j: plan.at.j }, orientation: plan.orientation ?? "r0", by },
  });
  return { ok: true };
}

/**
 * Every spot it could surface at the coming Turn End, each with the
 * orientations that fit there.
 *
 * What the Resurface control offers, from the same {@link landingPlan} the
 * scheduler carries it out with, so the board cannot offer a spot the boundary
 * then refuses -- unless somebody walks onto it in between, which it answers
 * by the nearest free panel.
 *
 * @param {object} dimension a `board.dimensions` entry
 * @param {object} board
 * @param {{now: number, turnsPerRound: number}} clock
 * @returns {Array<{at: {i: number, j: number}, orientations: string[]}>}
 */
export function landingOptions(dimension, board, { now, turnsPerRound }) {
  const spec = dimension.spec;
  const from = dimension.centre;
  const distance = travelDistance(spec, { turnsInside: Math.max(0, now - (dimension.activatedAt ?? now)), turnsPerRound });
  const occupants = (board.units ?? []).filter((u) => u.levelId === dimension.levelId && u.panel);
  const out = [];
  for (let i = from.i - distance; i <= from.i + distance; i++) {
    for (let j = from.j - distance; j <= from.j + distance; j++) {
      const at = { i, j };
      const orientations = ORIENTATIONS.filter((orientation) => landingPlan(spec, {
        from, at, orientation, occupants, board, factionId: dimension.factionId, distance,
      }).ok);
      if (orientations.length > 0) out.push({ at, orientations });
    }
  }
  return out;
}

/**
 * Every open dimension's clock, run at the Turn boundary.
 *
 * > *"At the end of **any** Turn, Nemo can choose to resurface the Storm
 * > Border."*
 * > *"The maximum time the Storm Border can spend within Imaginary Numbers
 * > Space is 2◈ Turns, Nemo is forced to resurface after 2◈ Turns have
 * > passed."*
 *
 * **Any** Turn, not only his own -- which is why this runs on the global
 * boundary rather than inside the active faction's block. A plan he pressed is
 * carried out here; one gone bad is called off with a line on the chat log,
 * and the control is his again (#191 readings 5 and 6). At the ceiling it
 * surfaces whatever he has said, on his plan or centred on him (reading 8),
 * and one Turn before it the table is warned.
 *
 * Nothing here asks anybody anything, so the boundary is never held. It raised
 * `fgtDimensionExitOffer` for a placement layer to answer, and nothing listened:
 * the Storm Border never surfaced at all.
 *
 * @param {number} tick the global turn
 * @returns {Promise<void>}
 */
export async function runDimensionClock(tick) {
  if (!game.users?.activeGM?.isSelf) return;

  const open = (game.actors?.contents ?? []).filter(
    (a) => a.type === "platform" && a.system?.dimension && a.system?.activatedAt !== null
      && a.system?.activatedAt !== undefined && a.system?.levelId,
  );
  if (open.length === 0) return;

  const turnsPerRound = game.settings.get("fgt", "turnsPerRound");
  const ceiling = resolveTicks({ kind: "rounds", whole: 2, frac: null, sign: 1 }, { turnsPerRound });

  for (const platform of open) {
    const spec = platform.system.dimension;
    const turnsInside = Math.max(0, tick - platform.system.activatedAt);
    const forced = spec.forceExitAt === "maxDuration" && turnsInside >= ceiling;
    const plan = platform.system.resurfacePlan ?? null;

    if (plan || forced) {
      const out = await resurface({ platformId: platform.id, plan, forced });
      if (!out.ok) {
        await platform.update({ "system.resurfacePlan": null });
        await postDimensionCard(game.i18n.format(forced ? "FGT.Dimension.Stranded" : "FGT.Dimension.CalledOff", {
          reason: game.i18n.localize(`FGT.Dimension.Reason.${out.reason}`),
        }));
      }
      continue;
    }

    if (spec.forceExitAt === "maxDuration" && turnsInside === ceiling - 1) {
      await postDimensionCard(game.i18n.localize("FGT.Dimension.ForcedNext"));
    }
  }
}
