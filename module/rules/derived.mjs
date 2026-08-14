/**
 * @file Applying collected `statDeltas` to a unit's derived values.
 * @see docs/23-documents-and-derived-data.md §23.4
 *
 * Layer 2 (rules). Pure: takes a plain `system`-shaped object and a list of
 * deltas, returns the changes to write. The document layer does the writing.
 *
 * The split matters because the same function has to serve two callers that
 * look nothing alike — `FGTActor#prepareDerivedData`, which mutates a live
 * data model during Foundry's preparation cycle, and the test suite, which
 * hands it a literal. Neither is allowed to be the one that knows the rules.
 *
 * **Ordering.** Deltas are applied in three passes, because `Max HpUp` must
 * resolve before the clamp that keeps `value <= max`, and a rank shift must
 * resolve before anything that reads the shifted rank:
 *
 *   1. rank shifts on `parameters.*`
 *   2. numeric deltas, including `.max` deltas
 *   3. clamps
 *
 * A delta with a `duration` is still applied here. Duration governs when the
 * *source* goes away (the scheduler removes the effect, and the next
 * preparation no longer sees the element), not whether the delta counts now.
 */

import { Rank } from "../domain/rank.mjs";

/** Stats that may never go below zero. */
const NON_NEGATIVE = new Set(["mov", "range.panels", "agility.value", "luck.value", "shield"]);

/**
 * @typedef {object} DerivedResult
 * @property {Record<string, number|string>} changes flat path → new value
 * @property {Array<{path: string, value: number|string, source: string}>} trace
 */

/**
 * Compute the derived changes a set of stat deltas produces.
 *
 * @param {object} system the actor's `system` data, read-only
 * @param {object[]} statDeltas from `collectContributions`
 * @returns {DerivedResult}
 */
export function applyStatDeltas(system, statDeltas = []) {
  /** @type {Record<string, number|string>} */
  const changes = {};
  /** @type {Array<{path: string, value: number|string, source: string}>} */
  const trace = [];

  const read = (path) => (path in changes ? changes[path] : getPath(system, path));

  // ── 1. Rank shifts ───────────────────────────────────────────────────────
  for (const d of statDeltas) {
    if (!d.rankShift) continue;
    // A shift aimed at somebody else -- Enkidu's rank reduction on its target --
    // is not this unit's derived data.
    if (d.target && d.target !== "self") continue;
    const current = Rank.parseOrNull(read(d.stat));
    if (!current) continue;
    const shifted = current.step(d.rankShift);
    changes[d.stat] = shifted.toString();
    trace.push({ path: d.stat, value: changes[d.stat], source: d.source });
  }

  // ── 2. Numeric deltas ────────────────────────────────────────────────────
  for (const d of statDeltas) {
    if (d.rankShift || typeof d.value !== "number" || d.value === 0) continue;
    const path = normalise(d.stat);
    const before = numberAt(read(path));
    changes[path] = before + d.value;
    trace.push({ path, value: changes[path], source: d.source });

    // `Max HpUp` restores current Health by the same amount; `Max HpDwn` does
    // not reduce it, so only the positive direction carries.
    if (d.alsoCurrent && d.value > 0) {
      const currentPath = path.replace(/\.max$/, ".value");
      changes[currentPath] = numberAt(read(currentPath)) + d.value;
      trace.push({ path: currentPath, value: changes[currentPath], source: d.source });
    }
  }

  // ── 3. Clamps ────────────────────────────────────────────────────────────
  for (const path of Object.keys(changes)) {
    const value = changes[path];
    if (typeof value !== "number") continue;
    if (NON_NEGATIVE.has(path) && value < 0) changes[path] = 0;
  }

  // Only Health has a ceiling. `Agi Up` raising current Agility past the
  // printed maximum is the normal case, not an overflow: the maximum is what
  // the sheet started with, and buffs are explicitly allowed to exceed it.
  // Lowering Max Health, by contrast, drags current Health down with it even
  // when no delta named `health.value` — which is why this reads the current
  // value rather than only revisiting paths already in `changes`.
  const healthMax = numberAt(read("health.max"));
  if (healthMax > 0 && numberAt(read("health.value")) > healthMax) {
    changes["health.value"] = healthMax;
    trace.push({ path: "health.value", value: healthMax, source: "Max Health cap" });
  }

  return { changes, trace };
}

/**
 * Write a `DerivedResult` onto a live data model.
 *
 * Separate from `applyStatDeltas` so the computation stays testable without a
 * mutable target.
 *
 * @param {object} system the live `system` object, mutated in place
 * @param {DerivedResult} result
 * @returns {object} the same `system`
 */
export function writeDerived(system, result) {
  for (const [path, value] of Object.entries(result.changes)) setPath(system, path, value);
  return system;
}

/* -------------------------------------------------------------------------- */

/**
 * `agility` and `agility.value` name the same thing on different sheets; the
 * schema stores the latter.
 * @param {string} stat
 * @returns {string}
 */
function normalise(stat) {
  if (["agility", "luck", "health"].includes(stat)) return `${stat}.value`;
  if (stat === "range") return "range.panels";
  return stat;
}

/**
 * @param {object} obj
 * @param {string} path
 * @returns {unknown}
 */
function getPath(obj, path) {
  return path.split(".").reduce((o, k) => (o === null || o === undefined ? o : o[k]), obj);
}

/**
 * @param {object} obj
 * @param {string} path
 * @param {unknown} value
 */
function setPath(obj, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  let cursor = obj;
  for (const key of keys) {
    if (cursor[key] === null || cursor[key] === undefined) cursor[key] = {};
    cursor = cursor[key];
  }
  cursor[last] = value;
}

/**
 * @param {unknown} v
 * @returns {number}
 */
function numberAt(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}
