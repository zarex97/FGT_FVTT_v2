/**
 * @file Every key content authors on an ability must survive its schema.
 * @see module/data/item/ability.mjs, tools/lib/content.mjs
 *
 * The failure this guards is silent in both directions. A key the compiler
 * emits and the Item DataModel does not declare is dropped by Foundry **without
 * a warning**: the YAML validates, the pack contains it, the document loads,
 * and the consumer reads `undefined`.
 *
 * It happened with `field`. Every bounded field in the corpus belonged to a
 * Noble Phantasm — Chaos Labyrinthos, Unlimited Blade Works, Sikera Ušum, The
 * Mist — so `field` was declared on `NoblePhantasmData` alone. Nothing in Ch. 43
 * makes that a rule, and Pale Rider's Contagion is a **Skill**: *"(Passive) The
 * 2 panel area around Pale Rider is the Contagion area."* Its whole six-axis
 * block compiled, shipped, and was thrown away on load.
 *
 * Read as TEXT rather than by importing the models, which need Foundry's
 * global `fields`. Coarse, and it catches exactly the class of bug that bit.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { parse } from "yaml";

const SOURCE = readFileSync("module/data/item/ability.mjs", "utf8");

/** The schema body of one exported DataModel class, as source text. */
function schemaOf(className) {
  const start = SOURCE.indexOf(`export class ${className} `);
  expect(start, `${className} not found`).toBeGreaterThan(-1);
  const next = SOURCE.indexOf("\nexport class ", start + 1);
  return SOURCE.slice(start, next === -1 ? SOURCE.length : next);
}

/** `abilityCommon()`, spread into every one of the models. */
const COMMON = SOURCE.slice(
  SOURCE.indexOf("function abilityCommon()"),
  SOURCE.indexOf("export class AbilityData"),
);

/** Does this model declare a top-level schema key, itself or through the common block? */
const declares = (className, key) => {
  // `\\s` — inside a template literal `\s` is just `s`, which would have made
  // this match `^s+rank:s` and report every declared key as missing.
  const declaration = new RegExp(`^\\s+${key}:\\s`, "m");
  return declaration.test(schemaOf(className)) || declaration.test(COMMON);
};

const DIRS = ["packs/_source/abilities", "packs/_source/class-skills"];

/** Every authored ability document, with the item type it compiles to. */
const MODELS = {
  equipment: "EquipmentData",
  commandSpell: "CommandSpellData",
  masterEssence: "MasterEssenceData",
};

const authored = DIRS.flatMap((dir) =>
  readdirSync(dir).filter((f) => f.endsWith(".yml")).map((f) => {
    const doc = parse(readFileSync(`${dir}/${f}`, "utf8"));
    // A document may state its own `type` — `[Semiramis' Poison]` lives beside
    // the abilities and is `type: equipment`. Otherwise `tools/lib/content.mjs`
    // decides: `type: ability.isNP ? "noblePhantasm" : "ability"`.
    const model = MODELS[doc.type] ?? (doc.isNP ? "NoblePhantasmData" : "AbilityData");
    return { path: `${dir}/${f}`, doc, model };
  }));

describe("an authored ability's keys survive its DataModel", () => {
  it("finds abilities of both kinds, or this guard proves nothing", () => {
    expect(authored.filter((a) => a.model === "AbilityData").length).toBeGreaterThan(0);
    expect(authored.filter((a) => a.model === "NoblePhantasmData").length).toBeGreaterThan(0);
  });

  it("declares `field` on whichever model an authored bounded field lands in", () => {
    const withFields = authored.filter((a) => a.doc.field);
    expect(withFields.length).toBeGreaterThan(0);

    const dropped = withFields
      .filter((a) => !declares(a.model, "field"))
      .map((a) => `${a.path} → ${a.model}`);

    expect(dropped).toEqual([]);
  });

  it("declares every other schema-shaped key an ability authors", () => {
    // The keys the compiler passes through verbatim and a model has to name.
    // Not exhaustive over the vocabulary — exhaustive over what is AUTHORED,
    // which is the same discipline `registry-fields.test.mjs` applies to
    // effects: check the projection against real content, not a second list.
    const SKIP = new Set(["schema", "id", "name", "description", "notes", "ref", "kind", "type"]);
    const missing = [];
    for (const { path, doc, model } of authored) {
      for (const key of Object.keys(doc)) {
        if (SKIP.has(key)) continue;
        if (!declares(model, key)) missing.push(`${path}: ${key} (${model})`);
      }
    }
    expect(missing).toEqual([]);
  });
});
