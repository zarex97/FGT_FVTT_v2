/**
 * @file The spatially-bucketed aura index.
 * @see docs/23-documents-and-derived-data.md §23.3, §23.9
 *
 * Layer 2 (rules). Pure — builds an index from a board snapshot and answers
 * *spatial* queries against it. The engine owns the instance and decides when
 * to rebuild.
 *
 * `annotateAuras` has been a **linear scan** since it was written: correct, and
 * 28 units was not yet a performance problem. This is the structure §23.3
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
 * The one-pass staleness this introduces is acceptable and stated in §23.3: an
 * aura that begins applying one frame late is invisible, and any *resolution*
 * rebuilds synchronously before reading.
 */

import { chebyshev } from "../domain/geometry.mjs";

/** Panels per bucket, per §23.3. */
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
  let count = 0;

  for (const unit of board?.units ?? []) {
    const auras = unit.auras ?? [];
    // The cheap early-out. Most units are here and leave immediately.
    if (auras.length === 0) continue;
    // An actor with no token on this scene projects nothing. Defaulting a
    // missing panel to (0,0) would put every unplaced aura in the top corner.
    if (!unit.panel) continue;

    for (const aura of auras) {
      index(buckets, unit, aura);
      count++;
    }
  }

  return { version: previousVersion + 1, buckets, count };
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
  if (!panel) return [];
  return (index?.buckets?.get(bucketKey(panel.i, panel.j)) ?? [])
    .filter((e) => chebyshev(e.unit.panel, panel) <= (e.aura.radius ?? 0))
    .map((e) => ({ unit: e.unit, aura: e.aura }));
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

  const iMin = Math.floor((unit.panel.i - r) / BUCKET_SIZE);
  const iMax = Math.floor((unit.panel.i + r) / BUCKET_SIZE);
  const jMin = Math.floor((unit.panel.j - r) / BUCKET_SIZE);
  const jMax = Math.floor((unit.panel.j + r) / BUCKET_SIZE);

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
