#!/usr/bin/env node
/**
 * @file Export the compiled corpus for the Godot port (`grail-tact-godot`, Ch. 12 of its plan).
 *
 * This repository stays the authority for rules and content; the Godot game loads only what this script writes.
 * It runs the same chain the pack build runs — load, validate, compile, hold every document to Foundry's real
 * DataModel — and then writes **what the model kept**, defaults filled, as JSON: one file per source directory,
 * the translation table, the closed word lists, and `content.lock`, which names the commit it was built from and
 * the hash a War pins.
 *
 *   node tools/export-godot.mjs --out ../grail-tact-godot/content
 *
 * It refuses to run on uncommitted changes under `packs/_source`, `module/` or `tools/lib/`: the lock names one
 * commit, and a dirty tree is not one. Two runs on one commit write the same bytes (keys sorted, documents sorted
 * by content id, LF endings).
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { loadSource, loadAssets } from "./lib/load.mjs";
import { validateAll, compileCorpus, ASSET_ROOT, RULE_ELEMENT_KEYS } from "./lib/content.mjs";
import {
  checkCompiled, partitionKnown, reportModelCheck, documentNameOf, withoutKeys, withoutTemplateSlots,
} from "./lib/model-check.mjs";
import { installSystem } from "./lib/foundry.mjs";
import { SERVANT_CLASSES } from "../module/domain/enums.mjs";
import { ABILITY_KINDS } from "../module/rules/authoring/ability.mjs";
import { PHASE_IDS } from "../module/rules/authoring/phases.mjs";
import { ANCHOR_IDS, SHAPE_IDS, CHOOSER_IDS, RELATION_IDS } from "../module/rules/targeting/vocabulary.mjs";
import { ABILITY_WINDOW_IDS } from "../module/rules/windows.mjs";
import { REQUIREMENT_KINDS } from "../module/rules/items.mjs";

const SOURCE = "packs/_source";
const GUARDED = ["packs/_source", "module", "tools/lib"];
/** Keys that are Foundry's bookkeeping, never content: dropped at every depth. */
const FOUNDRY_ONLY = new Set(["_key", "_stats", "ownership", "folder", "sort"]);
const CONTENT_SCHEMA = 1;

const fail = (message) => {
  console.error(`export-godot | ${message}`);
  process.exit(1);
};

const args = process.argv.slice(2);
const outAt = args.indexOf("--out");
if (outAt < 0 || !args[outAt + 1]) fail("usage: node tools/export-godot.mjs --out <grail-tact-godot>/content");
const OUT = resolve(args[outAt + 1]);

// 1. One commit, or nothing.
const dirty = execFileSync("git", ["status", "--porcelain", "--", ...GUARDED], { encoding: "utf8" }).trim();
if (dirty) fail(`uncommitted changes under ${GUARDED.join(", ")}; commit them first:\n${dirty}`);
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();

// 2. Load and validate, as the pack build does.
const { files, problems: loadProblems } = await loadSource(SOURCE);
const { assets, problems: assetProblems } = await loadAssets("assets");
const { problems } = validateAll(files, assets);
const errors = [...loadProblems, ...assetProblems, ...problems];
if (files.length === 0) fail(`no content under ${SOURCE}/`);
if (errors.length) {
  for (const p of errors) console.error(`  error    ${p}`);
  fail(`${errors.length} validation error(s); nothing written`);
}

// 3. Compile, and hold every document to the real DataModel.
const { compiled } = compileCorpus(files, assets);
const { failing, known, stale } = partitionKnown(await checkCompiled(compiled));
if (failing.length || stale.length) {
  reportModelCheck({ failing, known, stale });
  fail(`${failing.length + stale.length} Silent Drop(s) in the model check; nothing written`);
}

// 4. What the model kept, defaults filled, Foundry's bookkeeping stripped.
await installSystem();

/** @param {string} path a compiled entry's source file @returns {string} its source directory */
const dirOf = (path) => path.split(/[\\/]/).at(-2);

/** Image paths as the Godot project addresses them. */
const rewrite = (value) => {
  if (typeof value === "string") {
    return value.startsWith(`${ASSET_ROOT}/`) ? `res://assets/${value.slice(ASSET_ROOT.length + 1)}` : value;
  }
  if (Array.isArray(value)) return value.map(rewrite);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .filter(([k]) => !FOUNDRY_ONLY.has(k))
      .map(([k, v]) => [k, rewrite(v)]));
  }
  return value;
};

const byDir = new Map();
for (const { path, doc: compiledDoc } of compiled) {
  const documentName = documentNameOf(compiledDoc);
  if (!documentName) fail(`${path}: no document type in its _key`);
  const data = documentName === "Actor" ? withoutKeys(compiledDoc) : withoutTemplateSlots(withoutKeys(compiledDoc));
  const doc = new foundry.documents[`Base${documentName}`](structuredClone(data), { strict: true });
  const kept = structuredClone(doc._source);
  if (kept.prototypeToken) kept.prototypeToken = { width: kept.prototypeToken.width, height: kept.prototypeToken.height };
  const out = rewrite(kept);
  out.documentName = documentName;
  const dir = dirOf(path);
  if (!byDir.has(dir)) byDir.set(dir, []);
  byDir.get(dir).push({ key: out.system?.contentId ?? out.name ?? out._id, doc: out });
}

// 5. Write, deterministically.
/** JSON with every object's keys sorted, two-space indent, LF, trailing newline. */
const stable = (value) => JSON.stringify(sortKeys(value), null, 2) + "\n";
function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, sortKeys(value[k])]));
  }
  return value;
}
const sha256 = (text) => createHash("sha256").update(text).digest("hex");

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, "i18n"), { recursive: true });
const written = {};
const counts = {};
const write = (name, text) => {
  writeFileSync(join(OUT, ...name.split("/")), text, "utf8");
  written[name] = sha256(text);
};

for (const dir of [...byDir.keys()].sort()) {
  const docs = byDir.get(dir).sort((a, b) => String(a.key).localeCompare(String(b.key), "en")).map((e) => e.doc);
  const name = `${dir.replaceAll("-", "_")}.json`;
  write(name, stable(docs));
  counts[name] = docs.length;
}

const vocabulary = {
  rule_elements: [...RULE_ELEMENT_KEYS].sort(),
  phases: [...PHASE_IDS].sort(),
  requirements: [...REQUIREMENT_KINDS].sort(),
  windows: [...ABILITY_WINDOW_IDS].sort(),
  anchors: [...ANCHOR_IDS].sort(),
  shapes: [...SHAPE_IDS].sort(),
  choosers: [...CHOOSER_IDS].sort(),
  relations: [...RELATION_IDS].sort(),
  ability_kinds: [...ABILITY_KINDS].sort(),
  servant_classes: [...SERVANT_CLASSES].sort(),
};
write("vocabulary.json", stable(vocabulary));

const lang = JSON.parse(readFileSync("lang/en.json", "utf8"));
const csvCell = (s) => (/[",\n\r]/.test(s) ? `"${s.replaceAll("\"", "\"\"")}"` : s);
const rows = Object.keys(lang).sort().map((k) => `${csvCell(k)},${csvCell(String(lang[k]))}`);
write("i18n/en.csv", `keys,en\n${rows.join("\n")}\n`);
counts["i18n/en.csv"] = rows.length;

const names = Object.keys(written).sort();
const sha = sha256(names.map((n) => `${n}:${written[n]}\n`).join(""));
writeFileSync(join(OUT, "content.lock"), stable({
  content_schema: CONTENT_SCHEMA,
  source_commit: sourceCommit,
  files: Object.fromEntries(names.map((n) => [n, written[n]])),
  counts,
  sha,
}), "utf8");

const total = Object.entries(counts).filter(([n]) => n.endsWith(".json")).reduce((s, [, c]) => s + c, 0);
console.log(`export-godot | ${total} document(s) in ${byDir.size} file(s), ${rows.length} string(s); `
  + `commit ${sourceCommit.slice(0, 8)}, content sha ${sha.slice(0, 12)} -> ${OUT.split(sep).slice(-2).join("/")}`);
