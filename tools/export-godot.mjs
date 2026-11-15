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
import { godotSchema } from "./lib/godot-schema.mjs";
import { SERVANT_CLASSES } from "../module/domain/enums.mjs";
import * as ENUMS from "../module/domain/enums.mjs";
import { TABLES, HOME_BASE_ESCAPE_MODIFIER } from "../module/domain/tables.mjs";
import { WAR_RULES } from "../module/domain/war-rules.mjs";
import { IMPLICATIONS } from "../module/domain/attributes.mjs";
import { REVISION_RULES, REVISION_CHOICES } from "../module/domain/revisions.mjs";
import { FACETS, patternFor, REF_SCOPES } from "../module/rules/facets.mjs";
import * as ORDERING from "../module/rules/ordering.mjs";
import * as TERRAIN_M from "../module/rules/terrain.mjs";
import * as SETUP_NORMAL from "../module/rules/setup-rolls-normal.mjs";
import * as GRANTED from "../module/rules/granted.mjs";
import * as NP_SCALE from "../module/rules/np-scale.mjs";
import * as STANCE_M from "../module/rules/stance.mjs";
import * as UNIT_GROUPS_M from "../module/rules/unit-groups.mjs";
import * as ZON_M from "../module/rules/zon.mjs";
import * as ENV_M from "../module/rules/environment.mjs";
import * as COUNT_M from "../module/rules/count.mjs";
import * as DIFFICULTY_M from "../module/rules/difficulty.mjs";
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
const MODELS = await installSystem();

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

// The domain's own data, so the port reads the tables the engine reads instead of a second copy (Ch. 04): the Rank
// tables, the War Rules, the attribute implications, the revision rules and the closed lists of `enums.mjs`.
const enumLists = Object.fromEntries(Object.entries(ENUMS)
  .filter(([, v]) => Array.isArray(v) || (v && typeof v === "object" && !(v instanceof Set)))
  .map(([k, v]) => [k, v]));
const domain = {
  tables: TABLES,
  home_base_escape_modifier: HOME_BASE_ESCAPE_MODIFIER,
  war_rules: WAR_RULES,
  implications: IMPLICATIONS,
  revision_rules: REVISION_RULES,
  revision_choices: REVISION_CHOICES,
  enums: enumLists,
};
write("domain.json", stable(domain));
counts["domain.json"] = Object.keys(TABLES).length;

// The rules layer's own tables (Ch. 05): the facets with each form's pattern tail per subject, as the regexes
// `facets.mjs` builds, so the port matches options with the engine's own patterns.
const facetRows = FACETS.map((f) => {
  const patterns = patternFor(f).map((r) => r.source);
  const tails = {};
  let k = 0;
  for (const form of f.forms) {
    void form;
    for (const subject of f.subjects) {
      const prefix = `^${subject}:${f.id}`;
      (tails[subject] ??= []).push(patterns[k].slice(prefix.length, -1));
      k++;
    }
  }
  return { ...f, form_tails: tails };
});
// The tables the rules modules hold as code; the Godot ports keep copies and a parity test holds each copy to these.
const RULE_TABLES = {
  ordering: { PRIORITY_BANDS: ORDERING.PRIORITY_BANDS, BY_KEY: ORDERING.BY_KEY },
  terrain: { TERRAIN: TERRAIN_M.TERRAIN, PERIODICS: TERRAIN_M.PERIODICS, ON_ENTRY: TERRAIN_M.ON_ENTRY },
  setup_rolls_normal: {
    NORMAL_AGILITY_BY_CLASS: SETUP_NORMAL.NORMAL_AGILITY_BY_CLASS, NORMAL_LUCK_BY_CLASS: SETUP_NORMAL.NORMAL_LUCK_BY_CLASS,
    AGILITY_BASE: SETUP_NORMAL.AGILITY_BASE,
  },
  granted: { GRANTS: GRANTED.GRANTS },
  np_scale: { NP_TAG_SCALE: NP_SCALE.NP_TAG_SCALE, NP_TAG_QUALIFIERS: NP_SCALE.NP_TAG_QUALIFIERS },
  stance: { STANCE_WINDOWS: STANCE_M.STANCE_WINDOWS },
  unit_groups: { UNIT_GROUPS: UNIT_GROUPS_M.UNIT_GROUPS },
  zon: { ZON_BASE: ZON_M.ZON_BASE, ZON_CLASS_BONUS: ZON_M.ZON_CLASS_BONUS, ZON_DEFAULT_BASE: ZON_M.ZON_DEFAULT_BASE },
  environment: {
    REGION_ADJACENCY: ENV_M.REGION_ADJACENCY, NOT_A_WAR_REGION: ENV_M.NOT_A_WAR_REGION,
    COUNTS_AS_ATTACK: ENV_M.COUNTS_AS_ATTACK, FIRST_ROUND_EXEMPT: ENV_M.FIRST_ROUND_EXEMPT, GRAIL_AREA: ENV_M.GRAIL_AREA,
  },
  count: { COUNT_KINDS: COUNT_M.COUNT_KINDS, BOARD_COUNT_KINDS: COUNT_M.BOARD_COUNT_KINDS, REQUIRED_KEYS: COUNT_M.REQUIRED_KEYS },
  difficulty: { NO_DAMAGE_MODIFIERS: DIFFICULTY_M.NO_DAMAGE_MODIFIERS, NO_LUCK_CHECK: DIFFICULTY_M.NO_LUCK_CHECK },
};
const plain = (v) => JSON.parse(JSON.stringify(v, (k, x) => (x instanceof Set ? [...x] : x)));
write("rules_data.json", stable({ facets: facetRows, ref_scopes: REF_SCOPES, tables: plain(RULE_TABLES) }));
counts["rules_data.json"] = FACETS.length;

// Every `system` field path per document type, off the real DataModels, for the loader's schema walk (Ch. 12).
const schema = godotSchema(MODELS);
write("schema.json", stable(schema));
counts["schema.json"] = Object.keys(schema).length;

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
