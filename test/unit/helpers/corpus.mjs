/**
 * @file Every predicate option the shipped content names.
 *
 * Shared, because three tests want the same list and a second walker would be
 * a second opinion about what counts as a predicate.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { predicateSitesIn } from "../../../module/rules/authoring/predicates.mjs";

/** @returns {string[]} every option named, `not:` already stripped, deduplicated */
export function corpusOptions() {
  const out = new Set();
  for (const dir of readdirSync("packs/_source")) {
    const p = join("packs/_source", dir);
    if (!statSync(p).isDirectory()) continue;
    for (const f of readdirSync(p).filter((n) => n.endsWith(".yml"))) {
      let doc;
      try {
        doc = parse(readFileSync(join(p, f), "utf8"));
      } catch {
        continue;
      }
      for (const site of predicateSitesIn(doc)) for (const o of site.options) out.add(o);
    }
  }
  return [...out];
}
