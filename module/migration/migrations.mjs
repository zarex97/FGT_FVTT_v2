/**
 * @file Schema migrations.
 * @see docs/41-migration.md
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
export const SCHEMA_VERSION = 2;

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
 * `{globalTurn}`, which Ch. 41's own example needs to turn a remaining-tick count
 * into an absolute expiry.
 *
 * Empty today. The version axis exists so that the FIRST shape change has
 * somewhere to go; adding the machinery at that moment, under time pressure, is
 * how worlds get corrupted.
 *
 * @type {ReadonlyArray<object>}
 */
export const MIGRATIONS = Object.freeze([
  {
    to: 2,
    description: "Backfill baseAttack on Masters stranded at {str: 0, mag: 0} from before the field was declared (#20)",
    /**
     * `baseAttack` was written to Masters by `engine/summon.mjs` for as long
     * as that writer has existed, but the field was not declared on the
     * schema until recently -- Foundry drops a write to an undeclared path
     * without complaint, so a Master summoned before the fix reads the
     * schema's own `initial: 0` on both components forever, with nothing to
     * distinguish it from an authored zero.
     *
     * `str` is safe to restore exactly: both rulesets author the same flat 50
     * and nothing ever rolls it (`packs/_source/masters/master-advanced.yml`,
     * `master-normal.yml`). `mag` is rolled once at summon and that roll is
     * gone, so this restores the PRE-roll pack default (100) rather than the
     * Master's true historical value -- the best available outcome once the
     * write that should have carried it silently dropped.
     *
     * Gated on `type === "master"`: `{str: 0, mag: 0}` is also the DELIBERATE
     * value several Structures author (Bloodmark, Piedra del Sol, the Vorpal
     * Blade cache) and must not be touched.
     */
    actor(source) {
      if (source.type !== "master") return source;
      const ba = source.system?.baseAttack;
      if (!ba || ba.str !== 0 || ba.mag !== 0) return source;
      return { ...source, system: { ...source.system, baseAttack: { str: 50, mag: 100 } } };
    },
  },
]);

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
