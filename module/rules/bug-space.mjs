/**
 * @file Bug Space: where one Unit holds others off the board.
 * @see CONTEXT.md, docs/superpowers/specs/2026-11-04-kazuradrop-clauses.md readings 29-45
 *
 * Layer 2 (rules). Pure. What a held Unit is, how many fit and where they land.
 *
 * A held Unit is off the board, as a banished Kagome Spirit is (`snapshotBoard`):
 * every reader that walks the board passes it by, its clocks stop because the
 * sweeps walk the board, and its Effects have no effect (`FGTEffect#isSuppressed`).
 * It is not defeated, and its Contract stands (readings 30, 31, 39).
 */

import { chebyshev } from "../domain/geometry.mjs";

/**
 * Is this actor held in a Bug Space, and off the board?
 *
 * A Unit a sweeping NP strikes is back on the board for that Attack, Effects still
 * paused, so it can have a Process (`heldStruck`, reading 40).
 *
 * @param {object|null|undefined} actor
 * @returns {boolean}
 */
export function isOffBoard(actor) {
  return Boolean(actor?.system?.heldIn) && !actor.system.heldStruck;
}

/**
 * How many Units an actor's Bug Space holds now: three, or five in Atomicros Form.
 * Read off the ability that creates it, so its bearer is whoever holds that.
 *
 * @param {object[]} items the holder's ability Items
 * @returns {number} 0 for an actor with no such ability
 */
export function bugSpaceCapacity(items) {
  const held = [...(items ?? [])];
  const spec = held.find((i) => i.system?.bugSpace)?.system?.bugSpace;
  if (!spec) return 0;
  const raised = (spec.capacityWhile ?? []).find((c) => held.some((i) => i.system?.slug === c.mode && i.system?.active));
  return Number(raised?.capacity ?? spec.capacity ?? 0);
}

/**
 * Panels a footprint fits on at this anchor, free of everyone else.
 *
 * @param {{i: number, j: number}} at
 * @param {{w?: number, h?: number}} footprint
 * @param {Set<string>} taken
 * @param {object|null} bounds
 * @returns {string[]|null} the panels' keys, or null when it does not fit
 */
function fits(at, footprint, taken, bounds) {
  const w = footprint?.w ?? 1;
  const h = footprint?.h ?? 1;
  const keys = [];
  for (let i = at.i; i < at.i + h; i += 1) {
    for (let j = at.j; j < at.j + w; j += 1) {
      if (i < (bounds?.iMin ?? 0) || j < (bounds?.jMin ?? 0)) return null;
      if (i > (bounds?.iMax ?? Infinity) || j > (bounds?.jMax ?? Infinity)) return null;
      const key = `${i},${j}`;
      if (taken.has(key)) return null;
      keys.push(key);
    }
  }
  return keys;
}

/**
 * Where forced-out Units land: random free panels within a 2 panel area of `at`,
 * and when those run out, the nearest free ones outward, wide enough for each
 * footprint (reading 45).
 *
 * @param {object[]} units the Units coming out: `{id, footprint}`
 * @param {{i: number, j: number}} at
 * @param {object} board
 * @param {() => number} rand in `[0, 1)`, the Foundry dice's own
 * @param {number} [within]
 * @returns {Record<string, {i: number, j: number}>} a panel per Unit that could land
 */
export function forcedLandings(units, at, board, rand, within = 2) {
  const leaving = new Set((units ?? []).map((u) => u.id));
  const taken = new Set((board?.units ?? [])
    .filter((u) => !leaving.has(u.id) && !u.defeated && (u.level ?? 0) === 0 && u.kind !== "platform" && u.kind !== "structure")
    .flatMap((u) => u.panels ?? (u.panel ? [u.panel] : []))
    .map((p) => `${p.i},${p.j}`));
  const bounds = board?.bounds ?? null;
  const reach = bounds?.iMax !== undefined
    ? Math.max(bounds.iMax - (bounds.iMin ?? 0), bounds.jMax - (bounds.jMin ?? 0)) + 1
    : 25;

  const panelsWithin = (d) => {
    const out = [];
    for (let i = at.i - d; i <= at.i + d; i += 1) {
      for (let j = at.j - d; j <= at.j + d; j += 1) {
        const panel = { i, j };
        if (chebyshev(panel, at) <= d) out.push(panel);
      }
    }
    return out;
  };

  /** @type {Record<string, {i: number, j: number}>} */
  const landed = {};
  for (const unit of units ?? []) {
    for (let d = within; d <= reach; d += 1) {
      const open = panelsWithin(d).filter((p) => fits(p, unit.footprint, taken, bounds));
      if (open.length === 0) continue;
      const panel = open[Math.floor(rand() * open.length)];
      landed[unit.id] = panel;
      for (const key of fits(panel, unit.footprint, taken, bounds)) taken.add(key);
      break;
    }
  }
  return landed;
}
