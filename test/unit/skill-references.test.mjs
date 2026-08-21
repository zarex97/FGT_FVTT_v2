/**
 * @file Every reference to a skill by name must name a skill that exists.
 * @see module/rules/options.mjs, module/rules/items.mjs
 *
 * Content refers to other abilities by **slug** in five different ways —
 * `self:skill:x`, `self:skillActive:x`, `target:skillRank:x:gte:B`,
 * `modeActive: x`, `forcesSkill: x` — and a slug that matches nothing does not
 * fail. It is simply absent from the option set, so the clause is quietly
 * false for ever.
 *
 * That is what happened. A class skill's slug defaults to its id with `class-`
 * stripped, which leaves **kebab-case** (`mad-enhancement`), while every
 * reference in the game is camelCase (`madEnhancement`). Three rules were dead:
 *
 *   - Penthesilea's *Charisma* and *Goddess of War* gate on
 *     `not:self:skillActive:madEnhancement`, which was vacuously true — right
 *     by accident, and wrong the moment she started raging.
 *   - Her *Outrage Amazon* requires `modeActive: madEnhancement`, so her Noble
 *     Phantasm was refused in **every** state.
 *   - Medea's *Atlas* reduces its chance by 25% against
 *     `target:skillRank:magicResistance:gte:B`, and that reduction never
 *     applied.
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

const SOURCE = ymlUnder("packs/_source");

/**
 * The slug an authored document ends up with — the same rule `itemSystem` uses.
 * @param {object} doc
 * @returns {string}
 */
function slugOf(doc) {
  return doc.slug ?? String(doc.id ?? "").replace(/^class-/, "");
}

/** Every slug any authored ability, class skill or effect will carry. */
const SLUGS = new Set(
  SOURCE.map((p) => parse(readFileSync(p, "utf8")))
    .filter((d) => d?.id)
    .map(slugOf),
);

/** Every skill name referenced anywhere, with where it came from. */
function references() {
  /** @type {Array<{path: string, name: string, how: string}>} */
  const out = [];

  for (const path of SOURCE) {
    const text = readFileSync(path, "utf8");

    for (const [, how, name] of text.matchAll(/\b(skill|skillActive|skillRank):([A-Za-z][\w-]*)/g)) {
      out.push({ path, name, how });
    }
    for (const [, name] of text.matchAll(/\bforcesSkill:\s*([A-Za-z][\w-]*)/g)) {
      out.push({ path, name, how: "forcesSkill" });
    }

    // `mode:` is overloaded — `mode: dice`, `mode: rankComparison` and
    // `mode: clear` are all unrelated. Only a `modeActive` REQUIREMENT names a
    // skill, so this half reads the parsed document rather than the text.
    const doc = parse(text);
    for (const holder of [doc, ...(doc?.abilities ?? [])]) {
      for (const req of holder?.requirements ?? []) {
        if (req?.kind === "modeActive" && req.mode) out.push({ path, name: req.mode, how: "modeActive" });
        if (req?.kind === "hasSkill" && req.abilityId) {
          out.push({ path, name: req.abilityId, how: "hasSkill" });
        }
      }
    }
  }
  return out;
}

describe("skill references in content", () => {
  it("finds some, or this guard proves nothing", () => {
    expect(references().length).toBeGreaterThan(3);
    expect(SLUGS.has("madEnhancement")).toBe(true);
  });

  it("every one names a slug some authored document actually has", () => {
    const dangling = references()
      .filter((r) => !SLUGS.has(r.name))
      .map((r) => `${r.path}: ${r.how}:${r.name}`);

    expect(dangling).toEqual([]);
  });
});
