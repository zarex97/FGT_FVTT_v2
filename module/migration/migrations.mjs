/**
 * @file Schema migrations.
 * @see docs/39-migration-and-versioning.md §39.2
 *
 * Layer 1-equivalent: pure, no `game`, no `canvas`, no settings. D39.2 requires
 * migrations to be "pure functions over source data, so they are unit-testable
 * without a world" -- and the runner that walks the world lives beside this,
 * knowing nothing about what any individual migration means.
 *
 * Every handler must be IDEMPOTENT. A runner that fails partway through is
 * re-run against data some of which is already migrated, so a handler that
 * doubles a value or appends a second time is worse than one that never ran.
 * `test/unit/migrations.test.mjs` holds every shipped entry to that.
 */

/**
 * The shape of persisted data this code expects.
 *
 * Bump this beside each new entry in `MIGRATIONS`, and never separately: the
 * two are one fact written twice, and a test holds them together.
 */
export const SCHEMA_VERSION = 1;

/**
 * The ordered migrations, each declaring handlers per document type.
 *
 * ```js
 * {
 *   to: 2,
 *   description: "Split parameters into base/granted",
 *   actor(source, ctx) { ... return source; },
 * }
 * ```
 *
 * `ctx` carries what a handler cannot read from the document alone -- currently
 * `{globalTurn}`, which §39.2's own example needs to turn a remaining-tick count
 * into an absolute expiry.
 *
 * Empty today. The version axis exists so that the FIRST shape change has
 * somewhere to go; adding the machinery at that moment, under time pressure, is
 * how worlds get corrupted.
 *
 * @type {ReadonlyArray<object>}
 */
export const MIGRATIONS = Object.freeze([]);

/**
 * The migrations a world at this version still needs, in order.
 *
 * A world ahead of the code gets nothing: running migrations backwards is not a
 * thing, and refusing is better than guessing.
 *
 * @param {number} worldVersion
 * @returns {object[]}
 */
export function pendingFrom(worldVersion) {
  return MIGRATIONS.filter((m) => m.to > worldVersion && m.to <= SCHEMA_VERSION);
}

/**
 * Apply one migration's handler for one document kind.
 *
 * Returns the source unchanged -- the same object, not a copy -- when the entry
 * declares no handler for this kind, so the runner can tell "nothing to do"
 * from "rewritten identically" and skip the write.
 *
 * @param {object} entry a `MIGRATIONS` element
 * @param {"actor"|"item"|"effect"|"scene"|"combat"} kind
 * @param {object} source the document's source data
 * @param {object} ctx `{globalTurn}`
 * @returns {object}
 */
export function applyMigration(entry, kind, source, ctx) {
  const handler = entry?.[kind];
  if (typeof handler !== "function") return source;
  return handler(source, ctx ?? {});
}
