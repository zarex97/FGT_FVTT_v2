#!/usr/bin/env node
/**
 * @file Export the survival Routes and the corpus's Authored Keys for the Godot port's survival test (Ch. 12, S12.SV).
 *
 * `test/unit/survival.test.mjs` holds the real corpus to `tools/lib/survival-routes.mjs`. The port holds ITS projection
 * to the same tables: this writes them, and for every corpus Unit, Ability and Effect the keys that test walks, as one
 * test fixture, `<godot>/test/fixtures/survival/routes.json`. It is a fixture, not content: it is not in `content.lock`
 * and `content/` is not touched. It names the commit it was made from; the port's test fails when that is not the
 * commit `content.lock` names.
 *
 *   node tools/export-survival.mjs --out ../grail-tact-godot/test/fixtures/survival
 *
 * The keys are the ones the survival test walks: the compiled document's own `system` keys that the DataModel kept.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadSource, loadAssets } from "./lib/load.mjs";
import { compileCorpus } from "./lib/content.mjs";
import { installSystem } from "./lib/foundry.mjs";
import {
  UNIT_ROUTES, ABILITY_ROUTES, CONTRIBUTION_ROUTES, EFFECT_ROUTES, NESTED_ROUTES, TRANSFORMS, PROJECTIONS,
} from "./lib/survival-routes.mjs";

const fail = (message) => {
  console.error(`export-survival | ${message}`);
  process.exit(1);
};
const args = process.argv.slice(2);
const outAt = args.indexOf("--out");
if (outAt < 0 || !args[outAt + 1]) fail("usage: node tools/export-survival.mjs --out <grail-tact-godot>/test/fixtures/survival");
const OUT = resolve(args[outAt + 1]);

const dirty = execFileSync("git", ["status", "--porcelain", "--", "packs/_source", "module"], { encoding: "utf8" }).trim();
if (dirty) fail(`uncommitted changes under packs/_source or module; the header names one commit:\n${dirty}`);
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();

/** A route as data: a list of `{at, via?, projectVia?, contains?}` or `{reader, why}`; functions become their names. */
const plainRoute = (route) => [route].flat().map((r) => {
  if (r.reader) return { reader: r.reader, why: r.why };
  if (r.unread) fail(`a route is unread (${r.unread}); the ceiling is zero`);
  const out = { at: r.at };
  if (r.from) {
    if (!r.via) fail(`the route to "${r.at}" has a function with no name: build it with \`through\``);
    out.via = r.via;
  }
  if (r.project) {
    if (!r.projectVia) fail(`the route to "${r.at}" has a projection with no name`);
    out.projectVia = r.projectVia;
  }
  if (r.contains) out.contains = true;
  return out;
});
const plainTable = (table) => Object.fromEntries(Object.keys(table).sort().map((k) => [k, plainRoute(table[k])]));

const strip = (v) => (Array.isArray(v) ? v.map(strip) : v && typeof v === "object"
  ? Object.fromEntries(Object.entries(v).filter(([k]) => k !== "_key").map(([k, x]) => [k, strip(x)]))
  : v);

await installSystem();
const { files } = await loadSource("packs/_source");
const { assets } = await loadAssets("assets");
const { compiled } = compileCorpus(files, assets);
const loaded = (documentName, c) => new foundry.documents[`Base${documentName}`](strip(structuredClone(c)), { strict: false })._source;
const norm = (p) => p.split("\\").join("/");

const units = [];
const effects = [];
for (const c of compiled) {
  if (c.pack === "effects") {
    const source = loaded("Item", c.doc).system;
    effects.push({
      file: norm(c.path), contentId: source.contentId,
      keys: Object.keys(c.doc.system).filter((k) => k in source).sort(),
    });
  } else if (c.doc._key.startsWith("!actors!")) {
    const source = loaded("Actor", c.doc);
    units.push({
      file: norm(c.path), id: source._id, name: source.name, type: source.type, contentId: source.system.contentId,
      keys: Object.keys(c.doc.system).filter((k) => k in source.system).sort(),
      items: (c.doc.items ?? []).map((item) => {
        const sys = source.items.find((i) => i._id === item._id)?.system ?? {};
        return { id: item._id, name: item.name, type: item.type, keys: Object.keys(item.system).filter((k) => k in sys).sort() };
      }),
    });
  }
}
units.sort((a, b) => a.file.localeCompare(b.file, "en"));
effects.sort((a, b) => a.file.localeCompare(b.file, "en"));

const fixture = {
  header: {
    source_commit: sourceCommit,
    made_by: "node tools/export-survival.mjs (a test fixture of the Godot port: not content, not in content.lock)",
    note: "routes: where each Authored Key goes. corpus: the keys test/unit/survival.test.mjs walks, per document.",
  },
  transforms: Object.keys(TRANSFORMS).sort(),
  projections: Object.keys(PROJECTIONS).sort(),
  routes: {
    unit: plainTable(UNIT_ROUTES), ability: plainTable(ABILITY_ROUTES),
    contribution: plainTable(CONTRIBUTION_ROUTES), effect: plainTable(EFFECT_ROUTES),
  },
  nested: NESTED_ROUTES.map((n) => ({
    key: n.key, authored: n.authored, hops: n.hops.map((h) => (h.model ? { model: h.model, why: h.why, as: h.as } : { file: h.file, why: h.why, as: h.as })),
  })),
  corpus: { units, effects },
};
const sortKeys = (v) => (Array.isArray(v) ? v.map(sortKeys) : v && typeof v === "object"
  ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v);
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "routes.json"), JSON.stringify(sortKeys(fixture), null, 1) + "\n", "utf8");
const n = (t) => Object.keys(t).length;
console.log(`export-survival | routes unit ${n(UNIT_ROUTES)}, ability ${n(ABILITY_ROUTES)}, contribution ${n(CONTRIBUTION_ROUTES)}, `
  + `effect ${n(EFFECT_ROUTES)}, nested ${NESTED_ROUTES.length}; ${units.length} unit(s), ${effects.length} effect(s); commit ${sourceCommit.slice(0, 8)} -> ${OUT}`);
