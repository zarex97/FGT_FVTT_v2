/**
 * @file A mutual-exclusion set is only a rule if both sides spell it the same.
 * @see module/engine/copy.mjs, docs/15-abilities.md §15.7
 *
 * Scáthach's three Wisdom of Dún Scáith slots gate on each other: two are
 * filled by the grant and the third, *Clairvoyance*, ships with fixed content.
 * The grant writes `wisdomOfDunScaith`; Clairvoyance was authored `dunScaith`.
 * Both loaded, both validated, and the gate matched nothing.
 *
 * The same failure mode as a one-sided `sameTurnExclusive`: a rule that is
 * decided by whichever half happens to be read.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

/** @param {string} dir @returns {string[]} */
function ymlUnder(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return ymlUnder(path);
    return e.name.endsWith(".yml") ? [path] : [];
  });
}

/** Sets the engine itself writes. Authored content has to match one of them. */
const ENGINE_SETS = new Set(
  [...readFileSync("module/engine/copy.mjs", "utf8").matchAll(/exclusionSet: "([^"]+)"/g)].map((m) => m[1]),
);

describe("authored exclusion sets", () => {
  const docs = ymlUnder("packs/_source").map((path) => ({ path, doc: parse(readFileSync(path, "utf8")) }));

  it("the engine declares at least one, or this guard proves nothing", () => {
    expect(ENGINE_SETS.size).toBeGreaterThan(0);
  });

  it("every authored set is one the engine also writes", () => {
    /** @type {string[]} */
    const orphans = [];

    for (const { path, doc } of docs) {
      for (const holder of [doc, ...(doc?.abilities ?? [])]) {
        const set = holder?.exclusionSet;
        if (set && !ENGINE_SETS.has(set)) {
          orphans.push(`${path}: ${holder.id ?? holder.ref} joins "${set}", which nothing else is in`);
        }
      }
    }

    expect(orphans).toEqual([]);
  });

  it("a requirement naming a set joins that set too", () => {
    // Gating on a set you are not a member of is legal but almost always a
    // typo: it means "wait for THOSE others" rather than "one of us at a time".
    /** @type {string[]} */
    const odd = [];

    for (const { path, doc } of docs) {
      for (const holder of [doc, ...(doc?.abilities ?? [])]) {
        for (const req of holder?.requirements ?? []) {
          if (req?.kind !== "abilityOffCooldown" || !req.exclusionSet) continue;
          if (holder.exclusionSet !== req.exclusionSet) {
            odd.push(`${path}: ${holder.id ?? holder.ref} gates on "${req.exclusionSet}" but joins "${holder.exclusionSet ?? "nothing"}"`);
          }
        }
      }
    }

    expect(odd).toEqual([]);
  });
});
