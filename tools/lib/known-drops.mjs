/**
 * @file Silent Drops the build has found in authored content and not yet fixed.
 * @see tools/lib/model-check.mjs, docs/40-content-pipeline.md
 *
 * Each entry is an Authored Key that the DataModel does not keep, so the Clause
 * it carries does not happen in a live world. It is listed rather than fixed on
 * sight because each one needs its own audit against its Character Sheet, and
 * each is owned by an issue. The build reports these without failing; anything
 * NOT listed fails it.
 *
 * The list may only shrink (`test/unit/known-drops.test.mjs`). An entry leaves
 * it when its issue is fixed — and one that no longer happens is reported as
 * stale, so it cannot linger after the fix.
 *
 * `file` is the source path under the repository, `path` the dotted path the
 * model check reports, including an `items["name"] ` prefix when embedded.
 */

/** @type {ReadonlyArray<{file: string, path: string, issue: string}>} */
export const KNOWN_BUILD_DROPS = Object.freeze([
].map((d) => Object.freeze(d)));
