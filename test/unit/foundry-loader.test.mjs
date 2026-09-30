/**
 * @file Foundry's real data layer, loaded from outside the repository.
 * @see docs/adr/0006-tests-and-build-run-real-foundry.md, docs/44-testing.md
 *
 * Every Silent Drop guard after this one stands on these classes, so the first
 * thing to prove is that they are the real ones: a key no schema declares is
 * pruned by Foundry's own `SchemaField`, for every document type this system
 * registers — and that a copy which is missing, or is the wrong build, stops
 * the run instead of letting the guards quietly not exist.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { locateFoundry, loadFoundry, installSystem } from "../../tools/lib/foundry.mjs";

describe("locating the Foundry copy", () => {
  it("fails, naming FOUNDRY_PATH, when the copy is missing", () => {
    const nowhere = join(tmpdir(), "fgt-no-foundry-here");
    expect(() => locateFoundry({ path: nowhere })).toThrow(/FOUNDRY_PATH/);
    expect(() => locateFoundry({ path: nowhere })).toThrow(/zarex97\/foundryVTT_copy/);
  });

  it("fails when the copy is a different build from system.json's verified one", () => {
    const copy = mkdtempSync(join(tmpdir(), "fgt-foundry-"));
    mkdirSync(join(copy, "app", "common"), { recursive: true });
    writeFileSync(join(copy, "app", "package.json"), JSON.stringify({ version: "14.360.0", release: { build: 360 } }));
    expect(() => locateFoundry({ path: copy })).toThrow(/14\.360.*14\.364|14\.364.*14\.360/);
  });
});

describe("the real data layer", () => {
  let models;

  beforeAll(async () => {
    await loadFoundry();
    models = await installSystem();
  }, 60_000);

  it("is Foundry's own, not a stand-in", () => {
    expect(foundry.data.fields.SchemaField.prototype._cleanType).toBeTypeOf("function");
    expect(foundry.abstract.DataModel.prototype.updateSource).toBeTypeOf("function");
  });

  for (const [documentName, types] of Object.entries({
    Actor: ["servant", "master", "civilian", "summon", "platform", "structure"],
    Item: ["ability", "noblePhantasm", "commandSpell", "masterEssence", "equipment"],
  })) {
    for (const type of types) {
      it(`a ${documentName} of type ${type} constructs strictly, and prunes a key its schema does not declare`, () => {
        const Base = foundry.documents[`Base${documentName}`];
        const doc = new Base({ name: `probe ${type}`, type }, { strict: true });
        expect(doc.system).toBeInstanceOf(models[documentName][type]);

        const applied = doc.updateSource({ "system.fgtUndeclaredProbe": 1 });
        expect(applied.system?.fgtUndeclaredProbe).toBeUndefined();
        expect(doc._source.system.fgtUndeclaredProbe).toBeUndefined();
      });
    }
  }
});
