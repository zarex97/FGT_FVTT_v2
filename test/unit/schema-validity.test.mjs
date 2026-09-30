/**
 * @file The schemas, held to Foundry's own rules rather than read as text.
 * @see docs/07-schemas.md, docs/adr/0006-tests-and-build-run-real-foundry.md, docs/adr/0003-the-record-schema-is-guarded-not-generated.md
 *
 * Two guards used to scrape `module/data` with regexes, because the DataModels
 * need Foundry's global `fields` to import: `actor-fields.test.mjs` and
 * `item-schema-coverage.test.mjs`. What each caught is now caught with the real
 * classes, most of it by a guard that already existed:
 *
 * - a write to a root no schema declares — the field ledger
 *   (`field-ledger.test.mjs`) over all of `module/`, not only `io.mjs`, and the
 *   test world's loud prune at runtime;
 * - an authored ability key its model does not declare — the build's model
 *   check (`model-check.test.mjs`), nested keys and every document type
 *   included, not only top-level keys of two directories.
 *
 * This file holds the two things left, and holds them PER TYPE where the text
 * scrape could only see the union of every name in `module/data`.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { installSystem } from "../../tools/lib/foundry.mjs";
import { withWorld } from "../helpers/world.mjs";

let models;
beforeAll(async () => { models = await installSystem(); });

/**
 * The dotted paths in `field` whose own initial value fails the field's own
 * validation. A field with no initial is one a writer must supply, which is a
 * different rule, and is not reported.
 *
 * @param {object} field
 * @param {string} path
 * @returns {string[]}
 */
function invalidInitials(field, path) {
  if (field instanceof foundry.data.fields.SchemaField) {
    return Object.entries(field.fields).flatMap(([k, f]) => invalidInitials(f, path ? `${path}.${k}` : k));
  }
  const initial = field.getInitialValue({});
  if (initial === undefined) return [];
  const failure = field.validate(initial);
  return failure ? [`${path} = ${JSON.stringify(initial)}: ${failure.message ?? String(failure)}`] : [];
}

describe("every schema's own defaults satisfy its own validation", () => {
  // `{choices, initial: ""}` without `blank: true` fails its own validation,
  // and one invalid field makes the whole `system` invalid: that is how every
  // actor in the world failed to initialize (8733fc4). The old guard scanned
  // `module/data/actor` source for the one spelling that had bitten; this walks
  // every field of every registered model, of every document type, and asks
  // Foundry's own `validate` about each field's own initial value.
  it("for every field of every model this system registers", () => {
    const invalid = [];
    for (const [documentName, byType] of Object.entries(models)) {
      for (const [type, Model] of Object.entries(byType)) {
        for (const bad of invalidInitials(Model.schema, "")) invalid.push(`${documentName}/${type}: ${bad}`);
      }
    }
    expect(invalid.join(String.fromCharCode(10))).toBe("");
  });

  it("catches the shape that broke every actor", () => {
    const { StringField, SchemaField } = foundry.data.fields;
    const broken = new SchemaField({ linkedDeath: new StringField({ initial: "", choices: ["", "both"] }) });
    expect(invalidInitials(broken, "")).toHaveLength(1);
  });
});

describe("a field is declared on the type it is written to, not on another", () => {
  // 21e74b4: `carriesItemId` was declared on SummonData and written to a
  // Structure. The text guard matched against the UNION of names in
  // `module/data`, so the write passed; Foundry pruned it; the Vorpal Blade's
  // cache carried nothing. The loud prune holds each write to its own type.
  const unit = (id, type) => ({ id, name: id, type, system: {} });

  it("lands on the type that declares it", async () => {
    await withWorld({ actors: [unit("cache", "structure")] }, async (w) => {
      await w.actor("cache").update({ "system.carriesItemId": "vorpal-blade" });
      expect(w.actor("cache").system.carriesItemId).toBe("vorpal-blade");
    });
  });

  it("throws on a type that does not, though another type declares the same name", async () => {
    await withWorld({ actors: [unit("warrior", "summon")] }, async (w) => {
      await expect(w.actor("warrior").update({ "system.carriesItemId": "vorpal-blade" }))
        .rejects.toThrow(/system\.carriesItemId/);
    });
  });
});
