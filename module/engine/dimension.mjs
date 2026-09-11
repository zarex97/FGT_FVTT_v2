/**
 * @file The Storm Border — a pocket dimension, entered and left.
 * @see docs/20-platforms-and-levels.md §20.6, char_orig_sheets/Copia de Nemo.md
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
import { applyBatch } from "./io.mjs";
import { chebyshev } from "../domain/geometry.mjs";
import { resolveTicks } from "../domain/tick.mjs";
import { currentBoard } from "./board.mjs";
import { activatePlatform } from "./platforms.mjs";
import * as rollLog from "../rules/roll-log.mjs";

/**
 * @typedef {object} Manifest
 * @property {string[]} eligibleAllies  allies close enough to be offered a place
 * @property {string[]} eligibleEnemies enemies close enough to attempt entry
 * @property {string[]} entering        everyone who actually goes in
 * @property {Array<{unitId: string, roll: number, successOn: number, entered: boolean}>} enemyAttempts
 */

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

  const eligibleAllies = units
    .filter((u) => u.id !== owner.id && u.factionId === owner.factionId && within(u, allyRange))
    .map((u) => u.id);

  const eligibleEnemies = units
    .filter((u) => u.factionId !== owner.factionId && within(u, enemyRange))
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

  const forbidden = new Set(
    (board?.homeBases ?? [])
      // "enemy Home Bases" -- his own is not one.
      .filter((b) => b.factionId !== factionId)
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

  const platform = game.actors.get(platformId)
    ?? game.actors.find((a) => a.system?.contentId === platformId);
  const spec = platform?.system?.dimension;
  if (!spec) return { ok: false, reason: "notADimension" };

  // Roll first, so the manifest is decided by dice the table has seen.
  const probe = manifestFor(spec, { owner, board, chosenAllyIds, rolls: {} });
  /** @type {Record<string, number>} */
  const rolls = {};
  /** @type {object[]} */
  const records = [];
  for (const id of probe.eligibleEnemies) {
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

  const manifest = manifestFor(spec, { owner, board, chosenAllyIds, rolls });

  const out = await activatePlatform({ platformId: platform.id, initialUnitIds: manifest.entering });
  if (!out.ok) return out;

  await platform.update({
    "system.activatedAt": game.combat?.system?.globalTurn ?? 0,
    "system.ownerId": ownerId,
  });

  await applyBatch(
    records.map((r) => I.log({
      kind: "ability", unitId: r.actorId, roll: r.total,
      detail: `Storm Border entry: ${r.total} vs ${spec.entry?.enemies?.successOn}+`,
      tick: game.combat?.system?.globalTurn ?? 0,
    })),
    "stormBorderEntry",
  );

  Hooks.callAll("fgtDimensionEntered", platform, manifest);
  return { ok: true, manifest };
}

/**
 * Surface the Storm Border and put everybody aboard back on the board.
 *
 * `forced` is the 2◈ ceiling firing rather than Nemo choosing, and it changes
 * nothing about the distance: the sheet caps the TIME inside, not the travel,
 * and the ceiling already bounds the travel through `turnsInside`.
 *
 * @param {object} args
 * @param {string} args.platformId
 * @param {{i: number, j: number}} args.at centre of the 5×5
 * @param {boolean} [args.forced]
 * @returns {Promise<{ok: boolean, reason?: string, distance?: number, moved?: string[]}>}
 */
export async function resurface({ platformId, at, forced = false }) {
  const platform = game.actors.get(platformId)
    ?? game.actors.find((a) => a.system?.contentId === platformId);
  const spec = platform?.system?.dimension;
  if (!spec) return { ok: false, reason: "notADimension" };

  const board = currentBoard();
  const turnsPerRound = game.settings.get("fgt", "turnsPerRound");
  const now = game.combat?.system?.globalTurn ?? 0;
  const turnsInside = Math.max(0, now - (platform.system?.activatedAt ?? now));
  const distance = travelDistance(spec, { turnsInside, turnsPerRound });

  const owner = (board.units ?? []).find((u) => u.id === platform.system?.ownerId);
  const from = platform.system?.submergedFrom ?? owner?.panel ?? at;

  if (!placementIsLegal(spec, { at, from, distance, board, factionId: owner?.factionId })) {
    return { ok: false, reason: "illegalPlacement", distance };
  }

  // Everybody on the dimension's level. The formation is preserved and offset
  // as a group (ruling R3): the sheet says "in any orientation", which is a
  // rotation of a formation and not free placement of each Unit.
  const occupants = (board.units ?? []).filter((u) => u.platformContentId === platform.system?.contentId);
  const di = at.i - from.i;
  const dj = at.j - from.j;

  await applyBatch(
    occupants.map((u) => I.move(u.id, [{ i: u.panel.i + di, j: u.panel.j + dj }], true)),
    "stormBorderResurface",
  );

  const { teardown } = await import("./scene-levels.mjs");
  await teardown(platform);

  Hooks.callAll("fgtDimensionSurfaced", platform, { distance, forced });
  return { ok: true, distance, moved: occupants.map((u) => u.id) };
}

/**
 * Every open dimension's clock, run at the Turn boundary.
 *
 * Two clauses, and they are deliberately in this order:
 *
 * > *"At the end of **any** Turn, Nemo can choose to resurface the Storm
 * > Border."*
 * > *"The maximum time the Storm Border can spend within Imaginary Numbers
 * > Space is 2◈ Turns, Nemo is forced to resurface after 2◈ Turns have
 * > passed."*
 *
 * **Any** Turn, not only his own -- which is why this runs on the global
 * boundary rather than inside the active faction's block. A dimension entered
 * on the enemy's Turn can be left at the end of it.
 *
 * The forced exit still lets him choose WHERE. Nothing in the sheet hands that
 * choice to anybody else, and the cap is on the time rather than the travel --
 * the distance is already bounded by `turnsInside` having reached its ceiling.
 *
 * @param {number} tick the global turn
 * @returns {Promise<void>}
 */
export async function runDimensionClock(tick) {
  if (!game.users?.activeGM?.isSelf) return;

  const open = (game.actors?.contents ?? []).filter(
    (a) => a.type === "platform" && a.system?.dimension && a.system?.activatedAt !== null,
  );
  if (open.length === 0) return;

  const turnsPerRound = game.settings.get("fgt", "turnsPerRound");

  for (const platform of open) {
    const spec = platform.system.dimension;
    const turnsInside = Math.max(0, tick - (platform.system.activatedAt ?? tick));
    const ceiling = resolveTicks(
      { kind: "rounds", whole: 2, frac: null, sign: 1 },
      { turnsPerRound },
    );

    const forced = spec.forceExitAt === "maxDuration" && turnsInside >= ceiling;
    const owner = game.actors.get(platform.system.ownerId);
    if (!owner) continue;

    // Raised as a hook rather than opening the placement layer from here: this
    // is layer 3 and the targeting layer is layer 4, and the GM client running
    // the scheduler is not necessarily the client that will answer.
    Hooks.callAll("fgtDimensionExitOffer", {
      platformId: platform.id,
      ownerId: owner.id,
      forced,
      turnsInside,
      distance: travelDistance(spec, { turnsInside, turnsPerRound }),
    });
  }
}
