/**
 * @file The registry must carry every effect field somebody reads.
 * @see module/rules/registry.mjs
 *
 * `EffectRegistry.load` builds a **hand-written projection** of an effect
 * document. A field the compiler emits and the projection omits is dropped
 * silently: the YAML validates, the pack contains it, the document holds it,
 * and the consumer sees `undefined`.
 *
 * It has happened three times. `severity` reached the registry only when Item
 * Construction needed it; `terminal` and `uses` were added to the schema and
 * the compiler in this change and the projection did not know about either,
 * which would have made Instakill create a badge and remove no Health.
 *
 * The guard is not "these fields exist" — it is that the projection and the
 * documents agree, checked against real content rather than a second list.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { parse } from "yaml";
import { EffectRegistry } from "../../module/rules/registry.mjs";
import { compileDocument } from "../../tools/lib/content.mjs";

const DIR = "packs/_source/effects";

/** Every authored effect, compiled exactly as the pack build compiles it. */
const documents = readdirSync(DIR)
  .filter((f) => f.endsWith(".yml"))
  .map((f) => compileDocument(parse(readFileSync(`${DIR}/${f}`, "utf8")), "effects", new Map()));

describe("EffectRegistry", () => {
  it("loads every authored effect", () => {
    expect(EffectRegistry.load(documents)).toBe(documents.length);
  });

  it("carries every field the authored set actually uses", () => {
    EffectRegistry.load(documents);

    // Only fields some effect DECLARES a non-default value for: an unused
    // field is not yet a defect, and demanding all of them would make the
    // guard fail on the compiler's own filler.
    const declared = new Set();
    for (const f of readdirSync(DIR).filter((n) => n.endsWith(".yml"))) {
      for (const key of Object.keys(parse(readFileSync(`${DIR}/${f}`, "utf8")))) declared.add(key);
    }
    // Not effect behaviour: bookkeeping the registry has no reason to keep.
    for (const key of ["schema", "id", "name", "description"]) declared.delete(key);

    const projected = new Set(Object.keys(EffectRegistry.all()[0] ?? {}));
    const missing = [...declared].filter((k) => !projected.has(k));

    expect(missing).toEqual([]);
  });

  it("carries `terminal`, which decides whether Instakill does anything", () => {
    EffectRegistry.load(documents);
    const instakill = EffectRegistry.get("instakill");
    expect(instakill?.terminal).toEqual({ kind: "reduceToZero" });
  });

  it("carries `uses`, which decides whether a count-limited effect expires", () => {
    EffectRegistry.load(documents);
    expect(EffectRegistry.get("autoEvade")?.uses).toBe(1);
  });
});
