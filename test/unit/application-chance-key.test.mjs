/**
 * @file The key an `ApplicationChance` names its effect with.
 * @see module/rules/elements.mjs, docs/46-roster-re-audit.md §46.4-AH
 *
 * The executor reads `el.effect`:
 *
 * ```js
 * effectId: el.effect ?? null,
 * ```
 *
 * and `rules/authoring/elements.mjs` agrees — the descriptor's field is
 * `{ key: "effect", type: "effectId" }`. An element authored with `effectId:`
 * therefore resolves to `effectId: null`, and `chanceContribution`'s scope test
 * is `if (c.effectId && c.effectId !== def.id) continue` — so a null id matches
 * **every** effect rather than none.
 *
 * `soaked.yml` had it. Its clause (a) is *"when this Unit receives Ice damage,
 * it has a 25% chance of being inflicted with Freeze"*, and unscoped it raised
 * the chance of **every debuff** landing on a Soaked Unit under an Ice attack
 * by 25 points. The failure is silent in the generous direction, which is the
 * shape §46.4-J's sign errors also had.
 *
 * A corpus guard rather than one assertion about one file: the key is easy to
 * get wrong — it was got wrong again while authoring `poison-susceptible.yml`
 * for Sikera Ušum clause e, which is how the original was found.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ELEMENT_DESCRIPTORS } from "../../module/rules/authoring/elements.mjs";

/** Every authored YAML under packs/_source, recursively. */
function* sources(dir = "packs/_source") {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* sources(path);
    else if (entry.name.endsWith(".yml")) yield path;
  }
}

describe("ApplicationChance names its effect with `effect:`", () => {
  it("is what the authoring descriptor offers", () => {
    const entry = ELEMENT_DESCRIPTORS.ApplicationChance;
    expect(entry).toBeTruthy();
    const fields = entry.fields.map((f) => f.key);
    expect(fields).toContain("effect");
    expect(fields).not.toContain("effectId");
  });

  it("and no authored element in the corpus uses `effectId:` instead", () => {
    const offenders = [];
    for (const path of sources()) {
      const text = readFileSync(path, "utf8");
      // Each `key: ApplicationChance` and the indented block that follows it.
      const re = /key:\s*ApplicationChance\b([\s\S]*?)(?=\n\s*-\s|\n\S|$)/g;
      for (const [, block] of text.matchAll(re)) {
        if (/^\s*effectId:/m.test(block)) offenders.push(path);
      }
    }
    expect(offenders).toEqual([]);
  });
});
