/**
 * @file Every requirement an ability declares must be one the rules understand.
 * @see module/rules/items.mjs, docs/15-abilities.md §15.4
 *
 * `meetsRequirement` refuses on an unknown kind, which is the safe direction
 * and the reason this guard is necessary: an ability whose gate nobody
 * implements does not fail loudly, it becomes **permanently unusable**. It
 * compiles, validates, loads into the pack, renders on the sheet, and refuses
 * every time it is pressed.
 *
 * The Command Spell catalogue has had this guard since two of its requirements
 * were found unimplemented. Abilities did not, and Medea's *High-Speed Divine
 * Words* had been shipping a `notHasEffect` gate the vocabulary never had.
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { REQUIREMENT_KINDS } from "../../module/rules/items.mjs";

/** @param {string} dir @returns {string[]} */
function ymlUnder(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return ymlUnder(path);
    return e.name.endsWith(".yml") ? [path] : [];
  });
}

/** Command Spells have their own vocabulary and their own guard. */
const SOURCE = ymlUnder("packs/_source").filter((p) => !p.includes("command-spells"));

describe("authored ability requirements", () => {
  /** @type {Array<{path: string, doc: object}>} */
  const docs = SOURCE.map((path) => ({ path, doc: parse(readFileSync(path, "utf8")) }));

  it("uses only kinds `meetsRequirement` implements", () => {
    /** @type {string[]} */
    const unknown = [];

    for (const { path, doc } of docs) {
      // An ability may be a file of its own, or embedded in a Servant's roster.
      for (const holder of [doc, ...(doc?.abilities ?? [])]) {
        const declared = [
          ...(holder?.requirements ?? []),
          ...(holder?.targeting?.limits?.requirements ?? []),
        ];
        for (const req of declared) {
          if (!REQUIREMENT_KINDS.includes(req?.kind)) {
            unknown.push(`${path}: ${holder.id ?? holder.ref ?? "?"} requires "${req?.kind}"`);
          }
        }
      }
    }

    expect(unknown).toEqual([]);
  });
});
