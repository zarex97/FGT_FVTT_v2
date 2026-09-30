/**
 * @file The spatially-bucketed aura index.
 * @see docs/08-documents-and-derived.md, Ch. 08
 *
 * Layer 2 (rules). Pure — builds an index from a board snapshot and answers
 * *spatial* queries against it. The engine owns the instance and decides when
 * to rebuild.
 *
 * `annotateAuras` has been a **linear scan** since it was written: correct, and
 * 28 units was not yet a performance problem. This is the structure Ch. 08
 * specifies, with the three properties that make it work:
 *
 * 1. **Units with no auras cost nothing** — they are skipped before any
 *    geometry happens, and most units have none.
 * 2. **Spatial bucketing** — the board is divided into 4×4 panel buckets, and
 *    an aura of radius r is indexed into every bucket it could reach. A query
 *    touches one bucket instead of every unit.
 * 3. **Version-gated rebuild** — the index carries a version so a caller can
 *    tell a stale one from a current one without comparing contents.
 *
 * **This index does spatial narrowing and nothing else.** Whether an aura's
 * `relations` cover a particular recipient stays in `collectAuras`, which
 * already decides it correctly. A second relation implementation living here
 * would be two answers to one question — the defect this codebase produces most
 * often — so the index narrows the candidates and `collectAuras` judges them.
 *
 * The one-pass staleness this introduces is acceptable and stated in Ch. 08: an
 * aura that begins applying one frame late is invisible, and any *resolution*
 * rebuilds synchronously before reading.
 */

import { chebyshev } from "../domain/geometry.mjs";

/** Panels per bucket, per Ch. 08. */
export const BUCKET_SIZE = 4;

/**
 * Build the index from a board snapshot.
 *
 * @param {object} board
 * @param {number} [previousVersion]
 * @returns {{version: number, buckets: Map<string, object[]>, count: number}}
 */
export function buildAuraIndex(board, previousVersion = 0) {
  /** @type {Map<string, object[]>} */
  const buckets = new Map();
  // Auras with no reach at all -- `scope: "field"`, *"while this Unit is on the
  // field"*. They carry the executor's default `radius` of 2, and bucketing
  // them by it made every one stop two panels out on a real board (#68).
  /** @type {object[]} */
  const unbounded = [];
  let count = 0;

  for (const unit of board?.units ?? []) {
    const auras = unit.auras ?? [];
    // The cheap early-out. Most units are here and leave immediately.
    if (auras.length === 0) continue;
    // An actor with no token on this scene projects nothing. Defaulting a
    // missing panel to (0,0) would put every unplaced aura in the top corner.
    if (!unit.panel) continue;

    for (const aura of auras) {
      if (aura.scope === "field") unbounded.push({ unit, aura });
      else index(buckets, unit, aura);
      count++;
    }
  }

  return { version: previousVersion + 1, buckets, unbounded, count };
}

/**
 * The aura sources whose radius reaches a panel.
 *
 * Spatial only — see the file comment. Each result carries the **source unit**
 * so the caller can apply its own relation rules against it.
 *
 * @param {object} index from {@link buildAuraIndex}
 * @param {{i: number, j: number}} panel
 * @returns {Array<{unit: object, aura: object}>}
 */
export function candidatesAt(index, panel) {
  // One panel, or every panel a multi-panel recipient covers: a 3x3 Unit is
  // "next to" whatever is next to any part of it (Ch. 46 §46.4-BO).
  const at = (Array.isArray(panel) ? panel : [panel]).filter(Boolean);
  if (at.length === 0) return [];
  const seen = new Set();
  const near = [];
  for (const p of at) {
    for (const e of index?.buckets?.get(bucketKey(p.i, p.j)) ?? []) {
      if (seen.has(e)) continue;
      seen.add(e);
      if (reach(e.unit, at) <= (e.aura.radius ?? 0)) near.push(e);
    }
  }
  return [...(index?.unbounded ?? []), ...near].map((e) => ({ unit: e.unit, aura: e.aura }));
}

/**
 * Nearest panel of a source's footprint to any of the given panels.
 *
 * @param {object} unit
 * @param {Array<{i: number, j: number}>} panels
 * @returns {number}
 */
function reach(unit, panels) {
  let best = Infinity;
  for (const p of footprintOf(unit)) for (const q of panels) best = Math.min(best, chebyshev(p, q));
  return best;
}

/** @param {object} unit @returns {Array<{i: number, j: number}>} */
function footprintOf(unit) {
  return unit.panels?.length ? unit.panels : [unit.panel];
}

/* -------------------------------------------------------------------------- */

/**
 * Put one aura into every bucket its radius could reach.
 *
 * Indexing only the bearer's own bucket is the tempting shortcut, and the bug
 * it causes is subtle: the aura would keep working next to its bearer and stop
 * a few panels out, which is exactly where it starts mattering.
 *
 * @param {Map<string, object[]>} buckets
 * @param {object} unit
 * @param {object} aura
 */
function index(buckets, unit, aura) {
  const r = aura.radius ?? 0;
  const entry = { unit, aura };

  // From the whole footprint: a 3x3 Bašmu's aura reaches out from its far
  // edge, not only from its anchor corner.
  const cells = footprintOf(unit);
  const is = cells.map((p) => p.i);
  const js = cells.map((p) => p.j);
  const iMin = Math.floor((Math.min(...is) - r) / BUCKET_SIZE);
  const iMax = Math.floor((Math.max(...is) + r) / BUCKET_SIZE);
  const jMin = Math.floor((Math.min(...js) - r) / BUCKET_SIZE);
  const jMax = Math.floor((Math.max(...js) + r) / BUCKET_SIZE);

  for (let bi = iMin; bi <= iMax; bi++) {
    for (let bj = jMin; bj <= jMax; bj++) {
      const key = `${bi},${bj}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(entry);
    }
  }
}

/** @param {number} i @param {number} j @returns {string} */
function bucketKey(i, j) {
  return `${Math.floor(i / BUCKET_SIZE)},${Math.floor(j / BUCKET_SIZE)}`;
}
