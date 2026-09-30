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
  { file: "packs/_source/effects/kiritsugu-mark.yml", path: "system.bypassesImmunity", issue: "#98" },
  { file: "packs/_source/platforms/golden-hind.yml", path: "system.normalAttack", issue: "#99" },
  { file: "packs/_source/platforms/hanging-gardens.yml", path: "system.range.targets", issue: "#100" },
  { file: "packs/_source/platforms/quetzalcoatlus.yml", path: "system.normalAttack", issue: "#99" },
  { file: "packs/_source/structures/bloodmark.yml", path: "system.range.targets", issue: "#100" },
  { file: "packs/_source/structures/bloodmark.yml", path: "system.baseAttack", issue: "#100" },
  { file: "packs/_source/structures/piedra-del-sol.yml", path: "system.range.targets", issue: "#100" },
  { file: "packs/_source/structures/piedra-del-sol.yml", path: "system.baseAttack", issue: "#100" },
  { file: "packs/_source/structures/vorpal-blade-cache.yml", path: "system.range.targets", issue: "#100" },
  { file: "packs/_source/structures/vorpal-blade-cache.yml", path: "system.baseAttack", issue: "#100" },
  { file: "packs/_source/summons/basmu.yml", path: "system.footprint", issue: "#99" },
  { file: "packs/_source/summons/kagome-famine.yml", path: "system.normalAttack.shape", issue: "#99" },
].map((d) => Object.freeze(d)));
