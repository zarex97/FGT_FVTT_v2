/**
 * @file The authored Effect definitions, as a pure lookup.
 *
 * `engine/scheduler.mjs` resolves a definition through `ctx.effectDef` rather
 * than importing the registry, so a pure scheduler test has to supply one. A
 * stub that returns `null` tests nothing now that the tick is read from the
 * definition's own `periodic` (#105), and a stub that restates the numbers is
 * the second copy #105 removed. This reads the files themselves.
 */

import { readFileSync, readdirSync } from "node:fs";
import { parse } from "yaml";

const DIR = "packs/_source/effects";

const byId = new Map(
  readdirSync(DIR).filter((f) => f.endsWith(".yml")).map((f) => {
    const doc = parse(readFileSync(`${DIR}/${f}`, "utf8"));
    return [doc.id, doc];
  }),
);

/**
 * The authored definition of an effect, or `null`.
 * @param {string} id
 * @returns {object|null}
 */
export const effectDef = (id) => byId.get(id) ?? null;
