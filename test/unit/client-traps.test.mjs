/**
 * @file The lint rule for Foundry's two client-side Silent Drops.
 * @see tools/lib/eslint-client-traps.mjs, docs/08-documents-and-derived.md
 *
 * Neither trap can be run in Node — Foundry's `client/` layer does not import
 * — so the guard is a lint rule, proved here on each shape, and proved against
 * a live world by `tools/check-world.mjs`.
 */

import { describe, it, expect } from "vitest";
import { Linter } from "eslint";
import plugin from "../../tools/lib/eslint-client-traps.mjs";

const lint = (code) => new Linter({ configType: "flat" }).verify(code, [{
  files: ["**/*.mjs"],
  languageOptions: { ecmaVersion: 2023, sourceType: "module" },
  plugins: { fgt: plugin },
  rules: { "fgt/client-traps": "error" },
}], { filename: "fixture.mjs" }).map((m) => m.message);

describe("the empty-diff skip", () => {
  it("flags update() after updateSource() on the same document", () => {
    expect(lint(`async function f(actor) {
      actor.updateSource({ "system.mov": 3 });
      await actor.update({ "system.mov": 3 });
    }`)).toHaveLength(1);
  });

  it("flags updateSource() inside a _preUpdate", () => {
    expect(lint(`class A { _preUpdate(changes) { this.updateSource({ x: 1 }); } }`)).toHaveLength(1);
  });

  it("flags updateSource() inside a preUpdate hook", () => {
    expect(lint(`Hooks.on("preUpdateToken", (doc, changes) => { doc.updateSource({ x: 1 }); });`)).toHaveLength(1);
  });

  it("flags a write to _source inside a _preUpdate", () => {
    expect(lint(`class A { _preUpdate(changes) { this._source.system.mov = 3; } }`)).toHaveLength(1);
  });

  it("lets a _preUpdate change the changes it was handed", () => {
    expect(lint(`class A { _preUpdate(changes) { changes.system = { mov: 3 }; } }`)).toEqual([]);
  });
});

describe("_preCreate edits to data", () => {
  it("flags an assignment to the data argument of _preCreate", () => {
    expect(lint(`class A { _preCreate(data, options, user) { data.system.mov = 3; } }`)).toHaveLength(1);
  });

  it("flags an assignment to the data argument of a preCreate hook", () => {
    expect(lint(`Hooks.on("preCreateActor", (doc, data) => { data.img = "x.webp"; });`)).toHaveLength(1);
  });

  it("flags setProperty on the data argument", () => {
    expect(lint(`Hooks.on("preCreateActor", (doc, data) => { foundry.utils.setProperty(data, "img", "x"); });`))
      .toHaveLength(1);
  });

  it("lets a _preCreate go through updateSource, which is the right way", () => {
    expect(lint(`class A { _preCreate(data) { this.updateSource({ "prototypeToken.actorLink": true }); } }`)).toEqual([]);
  });

  it("lets a preCreate hook go through the document's updateSource", () => {
    expect(lint(`Hooks.on("preCreateToken", (document) => { document.updateSource({ lockRotation: true }); });`))
      .toEqual([]);
  });
});

// #96. `CONFIG.ActiveEffect.dataModels = { fgtEffect }` replaced core's
// `{ base: ActiveEffectTypeDataModel }`, so no core status effect could be
// created -- the defeat skull silently was not -- and the same shape on
// `CONFIG.RegionBehavior.dataModels` dropped every built-in behaviour.
describe("a CONFIG registry replaced wholesale", () => {
  it("flags assigning a CONFIG dataModels object that does not spread the existing one", () => {
    expect(lint(`CONFIG.ActiveEffect.dataModels = { fgtEffect: X };`)).toHaveLength(1);
  });

  it("allows one that keeps core's entries", () => {
    expect(lint(`CONFIG.ActiveEffect.dataModels = { ...CONFIG.ActiveEffect.dataModels, fgtEffect: X };`)).toEqual([]);
  });
});
