/**
 * @file The capability lookup: from a term, a Character-model Shape or a hand-written Clause list to the
 * authored keys that run it, and to a built Servant that already authors it.
 * @see tools/capability.mjs, docs/model/README.md, docs/43-tooling.md
 *
 * Three of the survey's issues (#284, #287, #290) claimed gaps the engine already ran, because "does the
 * engine run it?" was answered from the model's prose and a grep for one word. The authoring vocabulary is
 * self-describing (every Element, Phase, Requirement and option family carries its English), and the packs
 * say who authors each key. This module reads both, so the answer comes from the code.
 *
 * It never splits a sheet into Clauses: a Clause list is written by hand, by reading the sheet in full
 * (memory `feedback-clauses-written-by-reading`). It only annotates one.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

import {
  ELEMENT_DESCRIPTORS, PHASE_DESCRIPTORS, REQUIREMENT_DESCRIPTORS, CS_REQUIREMENT_DESCRIPTORS,
  TIMING_DESCRIPTORS, FIELD_DESCRIPTORS,
} from "../../module/rules/authoring/index.mjs";
import { predicateSitesIn } from "../../module/rules/authoring/predicates.mjs";
import { TARGET_ANCHORS, TARGET_SHAPES, CHOOSER_IDS, RELATION_IDS } from "../../module/rules/targeting/vocabulary.mjs";
import { FACETS, parseOption } from "../../module/rules/facets.mjs";
import { ENTRY_KEYS } from "../../module/rules/effect-flow.mjs";
import { AUTHORED_ACTOR_KEYS, AUTHORED_ITEM_KEYS } from "../../module/content/authored-fields.mjs";
import { ACTION_KINDS } from "../../module/engine/scheduler.mjs";
import { loadSource } from "./load.mjs";
import { phaseEffects, ruleElements } from "./content.mjs";
import { jaccard, loadCorpus, normalize } from "./kin.mjs";

/** The families an index entry belongs to, as a `keys:` line spells them. */
export const FAMILIES = Object.freeze([
  "element", "phase", "requirement", "csRequirement", "timing", "field",
  "anchor", "shape", "chooser", "relation", "option", "entry", "effectDef", "effect", "action", "actor", "classSkill", "commandSpell",
]);

/** Source folders whose documents are Actors, so their top-level keys are Actor fields. */
const ACTOR_DIRS = new Set(["servants", "servants-normal", "summons", "masters", "platforms", "structures"]);

const MODEL_DIR = "docs/model";
const LEDGER = "docs/model/ledger.json";
const SOURCE = "packs/_source";
const TESTS = "test/unit";

/**
 * @typedef {object} Entry
 * @property {string} family
 * @property {string} id
 * @property {string} english
 * @property {string[]} fields
 * @property {string[]} usage   source files that author it
 * @property {string[]} tests   test files that name it
 */

/**
 * @typedef {object} ModelField
 * @property {string} file
 * @property {number} line      1-based line of the bullet
 * @property {string} shape     the file's `shape:`
 * @property {string[]} names   the field's name and its Variant's value, camel-cased, for matching
 * @property {string} text      the bullet, joined
 * @property {string[]} keys    `family.id[.field]` references, empty for `none`
 * @property {string|null} none the `none (#NNN)` remark, or null
 * @property {boolean} hasKeys  whether the bullet carries a `keys:` line at all
 */

/** @param {string} family @param {string} id */
const keyOf = (family, id) => `${family}.${id}`;

/** Words to compare names by: lowercase, no accents, no punctuation. @param {string} s */
export function fold(s) {
  return String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** "breaks with use" → "breaksWithUse". @param {string} s */
function camel(s) {
  const w = String(s).trim().split(/[^A-Za-z0-9]+/).filter(Boolean);
  return w.map((x, i) => (i === 0 ? x[0].toLowerCase() + x.slice(1) : x[0].toUpperCase() + x.slice(1))).join("");
}

/* ── The vocabulary ─────────────────────────────────────────────────────── */

/** @returns {Map<string, Entry>} */
function vocabulary(documents) {
  const effectDocs = documents.filter((f) => f.dir === "effects");
  /** @type {Map<string, Entry>} */
  const out = new Map();
  const put = (family, id, english = "", fields = []) =>
    out.set(keyOf(family, id), { family, id, english, fields, usage: [], tests: [] });
  const table = (family, t) => {
    for (const d of Object.values(t)) put(family, d.id, d.english ?? "", (d.fields ?? []).map((f) => f.key));
  };
  table("element", ELEMENT_DESCRIPTORS);
  table("phase", PHASE_DESCRIPTORS);
  table("requirement", REQUIREMENT_DESCRIPTORS);
  table("csRequirement", CS_REQUIREMENT_DESCRIPTORS);
  table("timing", TIMING_DESCRIPTORS);
  table("field", FIELD_DESCRIPTORS);
  for (const a of TARGET_ANCHORS) put("anchor", a.id, a.hint ?? "", a.needs ?? []);
  for (const s of TARGET_SHAPES) put("shape", s.id, s.hint ?? "", s.needs ?? []);
  for (const c of CHOOSER_IDS) put("chooser", c);
  for (const r of RELATION_IDS) put("relation", r);
  for (const f of FACETS) {
    for (const subject of f.subjects) put("option", `${subject}:${f.id}`, f.english ?? "", f.segments.map((s) => s.name));
  }
  for (const [k, v] of Object.entries(ENTRY_KEYS)) put("entry", k, v?.means ?? "");
  for (const a of ACTION_KINDS) put("action", a);
  for (const k of AUTHORED_ACTOR_KEYS) put("actor", k);
  // An Effect definition's own keys: the authored keys the effects pack actually uses.
  const defKeys = new Set();
  for (const { doc } of effectDocs) for (const k of Object.keys(doc)) if (AUTHORED_ITEM_KEYS.includes(k)) defKeys.add(k);
  for (const k of defKeys) put("effectDef", k);
  for (const { doc } of effectDocs) if (doc.id) put("effect", doc.id, doc.name ?? "", [doc.polarity ?? ""].filter(Boolean));
  for (const { dir, doc } of documents) {
    if (dir === "class-skills" && doc.id) put("classSkill", doc.id, doc.name ?? "");
    if (dir === "command-spells" && doc.id) put("commandSpell", doc.id, doc.name ?? "");
  }
  return out;
}

/* ── Who authors what ───────────────────────────────────────────────────── */

/** Every `then:` action nested in a rule element. @param {object} el @param {(k: string) => void} see */
function actionsIn(el, see) {
  for (const a of el?.then ?? []) {
    if (a && typeof a === "object") {
      if (a.key) see(keyOf("action", a.key));
      if (a.key === "ApplyEffect" && (a.effect ?? a.id)) see(keyOf("effect", a.effect ?? a.id));
      actionsIn(a, see);
    }
  }
}

/** The index keys one source document authors. @param {object} doc @param {string} dir */
function keysAuthoredBy(doc, dir) {
  /** @type {Set<string>} */
  const keys = new Set();
  const see = (k) => keys.add(k);
  for (const [, el] of ruleElements(doc)) {
    if (el.key) see(keyOf("element", el.key));
    actionsIn(el, see);
  }
  const targeting = (t) => {
    if (!t) return;
    if (t.anchor?.kind) see(keyOf("anchor", t.anchor.kind));
    if (t.shape?.kind) see(keyOf("shape", t.shape.kind));
    if (t.selection?.chooser) see(keyOf("chooser", t.selection.chooser));
    for (const r of t.selection?.relations ?? []) see(keyOf("relation", r));
  };
  targeting(doc.targeting);
  for (const p of doc.phases ?? []) {
    if (p?.kind) see(keyOf("phase", p.kind));
    targeting(p?.targeting);
  }
  for (const [, spec] of phaseEffects(doc)) {
    if (spec.id) see(keyOf("effect", spec.id));
    for (const k of Object.keys(spec)) see(keyOf("entry", k));
  }
  for (const r of doc.requirements ?? []) if (r?.kind) see(keyOf("requirement", r.kind));
  if (doc.timing?.window) see(keyOf("timing", doc.timing.window));
  for (const k of Object.keys(doc)) {
    see(keyOf("field", k));
    if (dir === "effects") see(keyOf("effectDef", k));
    if (ACTOR_DIRS.has(dir)) see(keyOf("actor", k));
  }
  if (doc.cooldown && typeof doc.cooldown === "object") for (const k of Object.keys(doc.cooldown)) see(keyOf("field", `cooldown.${k}`));
  for (const site of predicateSitesIn(doc)) {
    for (const o of site.options) {
      const parsed = parseOption(String(o).replace(/^not:/, ""));
      if (parsed) see(keyOf("option", `${parsed.subject}:${parsed.facet}`));
    }
  }
  return keys;
}

/* ── The model ──────────────────────────────────────────────────────────── */

/** The `keys:` remark of a bullet. @param {string} text */
function keysRemark(text) {
  const m = text.match(/keys:\s*(.+?)\s*$/);
  if (!m) return { hasKeys: false, keys: [], none: null };
  const body = m[1];
  if (/^none\b/.test(body)) return { hasKeys: true, keys: [], none: body };
  const keys = [...body.matchAll(/`([^`]+)`/g)].map((x) => x[1]);
  return { hasKeys: true, keys, none: null };
}

/**
 * Every field bullet under `**Fields:**` in every Shape file.
 * @param {string} [dir]
 * @returns {ModelField[]}
 */
export function readModel(dir = MODEL_DIR) {
  /** @type {ModelField[]} */
  const out = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".md") && f !== "README.md").sort()) {
    const path = join(dir, file).replace(/\\/g, "/");
    const lines = readFileSync(path, "utf8").split(/\r?\n/);
    const shape = lines.find((l) => l.startsWith("shape:"))?.slice(6).trim() ?? basename(file, ".md");
    let inFields = false;
    /** @type {{line: number, parts: string[]}|null} */
    let cur = null;
    const flush = () => {
      if (!cur) return;
      const text = cur.parts.join(" ").replace(/\s+/g, " ").trim();
      const first = text.match(/^- `([^`]+)`/)?.[1] ?? text.match(/^- ([^:(]+?)[:(]/)?.[1]?.trim() ?? "";
      const variant = text.match(/\*\*(?:Variant|Attribute|Shape)\*\* `([^`]+)`/)?.[1];
      const names = [first, ...(variant ? [camel(variant)] : [])].filter(Boolean);
      out.push({ file: path, line: cur.line, shape, names, text, ...keysRemark(text) });
      cur = null;
    };
    lines.forEach((l, i) => {
      if (l.startsWith("**Fields:**")) { inFields = true; return; }
      if (/^\*\*[A-Z][^*]*:\*\*/.test(l)) { flush(); inFields = false; return; }
      if (!inFields) return;
      if (l.startsWith("- ")) { flush(); cur = { line: i + 1, parts: [l] }; return; }
      if (cur && /^\s{2,}\S/.test(l)) { cur.parts.push(l.trim()); return; }
      if (l.trim() === "") flush();
    });
    flush();
  }
  return out;
}

/* ── The index ──────────────────────────────────────────────────────────── */

/**
 * @typedef {object} Index
 * @property {Map<string, Entry>} entries
 * @property {ModelField[]} model
 * @property {Map<string, {servant: string, file: string, abilities: Array<{id: string, name: string, file: string}>}[]>} bySheet
 * @property {Record<string, {verdict: string, shape: string, note?: string}>} ledger
 * @property {Map<string, Entry>} effectsByName
 */

/** @type {Map<string, Promise<Index>>} */
const CACHE = new Map();

/**
 * Build (once per process and root) the whole index.
 * @param {{root?: string}} [opts]
 * @returns {Promise<Index>}
 */
export function buildIndex({ root = "." } = {}) {
  if (!CACHE.has(root)) CACHE.set(root, build(root));
  return CACHE.get(root);
}

/** @param {string} root @returns {Promise<Index>} */
async function build(root) {
  const { files } = await loadSource(join(root, SOURCE));
  const entries = vocabulary(files);

  // Keys the content authors that no descriptor lists: a phase's own keys and its `spec`'s, and the
  // cooldown's sub-keys. They are vocabulary all the same, read by the engine and named by the model.
  for (const { doc } of files) {
    for (const ph of doc.phases ?? []) {
      const e = ph?.kind ? entries.get(keyOf("phase", ph.kind)) : null;
      if (!e) continue;
      const spec = ph.spec && typeof ph.spec === "object" ? Object.keys(ph.spec) : [];
      for (const k of [...Object.keys(ph), ...spec]) if (k !== "kind" && !e.fields.includes(k)) e.fields.push(k);
    }
    if (doc.cooldown && typeof doc.cooldown === "object") {
      for (const k of Object.keys(doc.cooldown)) {
        const key = keyOf("field", `cooldown.${k}`);
        if (!entries.has(key)) entries.set(key, { family: "field", id: `cooldown.${k}`, english: "", fields: [], usage: [], tests: [] });
      }
    }
  }
  // Every top-level key a document authors is a field of its family, and an object's own keys are that
  // field's fields: `categorizedAs` on an ability, `linkedGroup.unitWeight` on a Servant, `field.extension`.
  for (const { dir, doc } of files) {
    const family = ACTOR_DIRS.has(dir) ? "actor" : dir === "effects" ? "effectDef" : "field";
    for (const [k, v] of Object.entries(doc)) {
      if (k === "cooldown" || k === "schema") continue;
      const key = keyOf(family, k);
      if (!entries.has(key)) entries.set(key, { family, id: k, english: "", fields: [], usage: [], tests: [] });
      if (v && typeof v === "object" && !Array.isArray(v)) {
        const e = entries.get(key);
        for (const sub of Object.keys(v)) if (!e.fields.includes(sub)) e.fields.push(sub);
      }
    }
  }
  for (const { path, dir, doc } of files) {
    const rel = path.replace(/\\/g, "/");
    for (const k of keysAuthoredBy(doc, dir)) entries.get(k)?.usage.push(rel);
  }

  const testDir = join(root, TESTS);
  const tests = existsSync(testDir)
    ? readdirSync(testDir).filter((f) => f.endsWith(".test.mjs")).map((f) => [f, readFileSync(join(testDir, f), "utf8")])
    : [];
  for (const e of entries.values()) {
    if (e.id.length < 4) continue;
    const word = new RegExp(`(?<![\\w-])${e.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`);
    for (const [name, text] of tests) if (text.includes(e.id) && word.test(text)) e.tests.push(name);
  }

  // A sheet's built Servants, through each Servant file's `# Conversion source:` line.
  const abilityFile = new Map(files.filter((f) => f.doc?.id).map((f) => [f.doc.id, f]));
  /** @type {Index["bySheet"]} */
  const bySheet = new Map();
  for (const f of files.filter((x) => x.dir === "servants" && !basename(x.path).startsWith("test-"))) {
    const sheet = conversionSheet(readFileSync(f.path, "utf8"));
    if (!sheet) continue;
    const abilities = (f.doc.abilities ?? []).map((a) => abilityFile.get(a?.ref)).filter(Boolean)
      .map((a) => ({ id: a.doc.id, name: a.doc.name ?? a.doc.id, file: a.path.replace(/\\/g, "/") }));
    const list = bySheet.get(sheet) ?? [];
    list.push({ servant: f.doc.name ?? f.doc.id, file: f.path.replace(/\\/g, "/"), abilities });
    bySheet.set(sheet, list);
  }

  const ledgerPath = join(root, LEDGER);
  const ledger = existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, "utf8")) : {};
  const effectsByName = new Map();
  for (const e of entries.values()) if (e.family === "effect" && e.english) effectsByName.set(fold(e.english), e);

  return { entries, model: readModel(join(root, MODEL_DIR)), bySheet, ledger, effectsByName };
}

/**
 * The sheet a Servant file was converted from, as a roster sheet name.
 * @param {string} text the Servant file
 * @returns {string|null} e.g. `Yan Qing` for `char_orig_sheets/Copia de Yan Qing.md`
 */
export function conversionSheet(text) {
  const m = text.match(/^# Conversion source: char_orig_sheets\/(?:Copia de )?(.+?)\.md\b/m);
  return m ? m[1] : null;
}

/* ── Questions ──────────────────────────────────────────────────────────── */

/**
 * @typedef {object} Hit
 * @property {string} key      `family.id`
 * @property {Entry} entry
 * @property {number} rank     0 exact id, 1 id prefix, 2 text match
 */

/**
 * Which authored keys answer a term.
 * @param {string} term
 * @param {Index} index
 * @returns {{hits: Hit[], model: ModelField[]}}
 */
export function capabilityOf(term, index) {
  const t = fold(term);
  /** @type {Hit[]} */
  const hits = [];
  for (const [key, entry] of index.entries) {
    const id = fold(entry.id);
    const rank = id === t ? 0
      : id.startsWith(t) ? 1
        : (fold(entry.english).includes(t) || entry.fields.some((f) => fold(f) === t)) ? 2
          : -1;
    if (rank >= 0) hits.push({ key, entry, rank });
  }
  hits.sort((a, b) => a.rank - b.rank || b.entry.usage.length - a.entry.usage.length || a.key.localeCompare(b.key));
  const model = index.model.filter((m) =>
    m.names.some((n) => fold(n) === t) || m.keys.some((k) => fold(k).includes(t)));
  return { hits, model };
}

/**
 * Resolve one `keys:` reference (`family.id` or `family.id.field`).
 * @param {string} ref
 * @param {Index} index
 * @returns {{ok: boolean, why?: string}}
 */
export function resolveKeyRef(ref, index) {
  const dot = ref.indexOf(".");
  if (dot < 0) return { ok: false, why: "no family" };
  const family = ref.slice(0, dot);
  if (!FAMILIES.includes(family)) return { ok: false, why: `unknown family ${family}` };
  const rest = ref.slice(dot + 1);
  if (index.entries.has(keyOf(family, rest))) return { ok: true };
  // `family.id.field`: the field must be one the entry declares.
  const last = rest.lastIndexOf(".");
  if (last > 0) {
    const entry = index.entries.get(keyOf(family, rest.slice(0, last)));
    if (entry) return entry.fields.includes(rest.slice(last + 1)) ? { ok: true } : { ok: false, why: `${rest.slice(0, last)} has no field ${rest.slice(last + 1)}` };
  }
  return { ok: false, why: `no ${family} named ${rest}` };
}

/** Ledger Shape words that name a whole family rather than one key. */
const GENERIC = Object.freeze({
  requirement: "requirement", "timing window": "timing", targeting: "anchor", cooldown: "field",
  resource: "element", statblock: "field", cost: "field",
});

/**
 * Ledger labels named by their head word, longest first where two share a start. Each names the keys
 * that carry the whole group, or the family when no single key does.
 */
const PREFIX = Object.freeze({
  "predicate: day or night round": { keys: ["option.self:phase", "requirement.roundPhase"] },
  "cooldown: waiver": { keys: ["field.cooldownWaiver"] },
  "ability.use mode": { keys: ["field.isMode", "phase.setMode"] },
  "ability: expended": { keys: ["field.expendsPermanently"] },
  "ability.use stance": { family: "field" },
  "ability.variant": { family: "field" },
  "bounded field": { keys: ["phase.createField", "field.field"] },
  "command spell": { family: "commandSpell" },
  "cost": { keys: ["field.cost"] },
  "item": { keys: ["phase.transferItem", "phase.itemGrant"] },
  "platform": { keys: ["phase.summonPlatform"] },
  "predicate": { keys: ["requirement.predicate"] },
  "reaction": { family: "timing" },
  "targeting": { family: "anchor" },
  "terrain": { keys: ["option.self:terrain"] },
});

/**
 * What a ledger Shape label resolves to.
 * @param {string} shape e.g. `Phase.damage`, `Effect: Atk Up`, `Item.breaksWithUse`
 * @param {Index} index
 * @returns {{keys: string[], model: ModelField|null, family: string|null}}
 */
export function resolveShape(shape, index) {
  const s = String(shape ?? "").trim();
  const one = (family, id) => (index.entries.has(keyOf(family, id)) ? [keyOf(family, id)] : []);
  let m;
  if ((m = s.match(/^Phase\.(\w+)/))) return { keys: one("phase", m[1]), model: null, family: null };
  if ((m = s.match(/^Element\.(\w+)/))) {
    const model = modelFor(s, index);
    return { keys: model?.keys.length ? model.keys : one("element", m[1]), model, family: null };
  }
  if ((m = s.match(/^Effect: (.+)$/))) {
    const e = index.effectsByName.get(fold(m[1].replace(/\s*\(.*$/, ""))) ?? index.effectsByName.get(fold(m[1]));
    return { keys: e ? [keyOf("effect", e.id)] : [], model: null, family: e ? null : "effect" };
  }
  const model = modelFor(s, index);
  if (model) return { keys: model.keys, model, family: null };
  if ((m = s.match(/^Ability\.(\w+)/)) && index.entries.has(keyOf("field", m[1]))) return { keys: [keyOf("field", m[1])], model: null, family: null };
  if ((m = s.match(/^Ability\.classSkill: (.+)$/))) {
    const cs = [...index.entries.values()].find((e) => e.family === "classSkill" && fold(e.english) === fold(m[1]));
    if (cs) return { keys: [keyOf("classSkill", cs.id)], model: null, family: null };
  }
  const prefix = Object.keys(PREFIX).find((p) => s.toLowerCase().startsWith(p));
  if (prefix) {
    const { keys = [], family = null } = PREFIX[prefix];
    return { keys: keys.filter((k) => index.entries.has(k)), model: null, family };
  }
  const generic = GENERIC[s.toLowerCase()];
  return { keys: [], model: null, family: generic ?? null };
}

/**
 * How many of the ledger's distinct Shape labels resolve to keys, a model field or a family. `Own`
 * verdicts are prose by design and are left out.
 * @param {Index} index
 * @returns {{total: number, mapped: number, unmapped: string[]}}
 */
export function ledgerCoverage(index) {
  // `Clause.prose` and `Clause.struck` mark text that is not a rule, like `Own`.
  const labels = new Set(Object.values(index.ledger)
    .filter((v) => v.verdict !== "Own" && !v.shape.startsWith("Clause.")).map((v) => v.shape));
  const unmapped = [];
  for (const s of labels) {
    const r = resolveShape(s, index);
    if (!r.keys.length && !r.model && !r.family) unmapped.push(s);
  }
  return { total: labels.size, mapped: labels.size - unmapped.length, unmapped: unmapped.sort() };
}

/** The model bullet a `Shape.field[ = value]` label names. @param {string} label @param {Index} index */
function modelFor(label, index) {
  const m = label.match(/^([A-Za-z ]+?)[.:]\s*([^=]+?)(?:\s*=\s*(.+))?$/);
  if (!m) return null;
  const shape = fold(m[1]);
  const wanted = [m[2], m[3]].filter(Boolean).flatMap((x) => [fold(x), fold(camel(x))]);
  return index.model.find((f) => fold(f.shape) === shape && f.names.some((n) => wanted.includes(fold(n))))
    ?? index.model.find((f) => fold(f.shape) === shape && f.names.some((n) => wanted.some((w) => fold(n).endsWith(w))))
    ?? null;
}

/* ── A hand-written Clause list ─────────────────────────────────────────── */

/**
 * The Clauses of a Clause list, as written by hand: `- [ ] **REF** · claim · *Status*`, each under its
 * Ability's `## Name — …` heading.
 * @param {string} markdown
 * @returns {{owner: string, clauses: Array<{ref: string, claim: string, ability: string, line: number}>}}
 */
export function readClauseList(markdown) {
  const lines = markdown.split(/\r?\n/);
  const owner = (lines.find((l) => l.startsWith("# ")) ?? "").slice(2).split(/\s+[—-]\s+/)[0].trim();
  const clauses = [];
  let ability = "";
  lines.forEach((l, i) => {
    if (l.startsWith("## ")) { ability = l.slice(3).split(/\s+—\s+/)[0].trim(); return; }
    const m = l.match(/^- \[[ xX]\] \*\*([^*]+)\*\* · (.+?)(?: · \*[^*]+\*.*)?$/);
    if (m) clauses.push({ ref: m[1].trim(), claim: m[2].trim(), ability, line: i + 1 });
  });
  return { owner, clauses };
}

/** @type {Map<string, {corpus: import("./kin.mjs").KinClause[], byPair: Map<string, number[]>}>} */
const CORPORA = new Map();

/** The roster's Clauses, indexed by word pair. @param {string} root @param {Index} index */
function corpusOf(root, index) {
  if (!CORPORA.has(root)) {
    // Built means a Servant file names the sheet as its conversion source.
    const corpus = loadCorpus(join(root, "char_orig_sheets/by-class"), [...index.bySheet.keys()]);
    const byPair = new Map();
    corpus.forEach((c, i) => { for (const p of c.pairs) byPair.set(p, (byPair.get(p) ?? []).concat(i)); });
    CORPORA.set(root, { corpus, byPair });
  }
  return CORPORA.get(root);
}

/** Words that carry nothing for matching a paraphrase to its sheet text. */
const STOP = new Set("the and for with that this from its his her their are was has have when then into onto than all any per each one also not but who which while been being does used use uses".split(" "));

/** Content words of a normalized text. @param {string} norm */
const wordsOf = (norm) => new Set(norm.split(/[^a-z#◈]+/).filter((w) => w.length > 2 && !STOP.has(w)));

/** How much of the smaller word set the larger one holds. */
function overlap(a, b) {
  let i = 0;
  for (const w of a) if (b.has(w)) i++;
  return i / (Math.min(a.size, b.size) || 1);
}

/**
 * @typedef {object} ClauseRow
 * @property {string} ref
 * @property {string} claim
 * @property {string|null} sheetClause  the sheet's own wording this Clause was read from
 * @property {number} kinSheets         distinct other roster sheets with a Kin of it
 * @property {{verdict: string, shape: string}|null} verdict
 * @property {string[]} keys
 * @property {string|null} family       a whole family, when the Shape names no single key
 * @property {string|null} gap          the model's `none (#NNN)` when the engine does not run it yet
 * @property {{servant: string, ability: string, file: string, claim: string}|null} precedent
 */

/**
 * Annotate a hand-written Clause list. Each Clause is first matched to its own sheet's wording, within its
 * Ability (a Clause list paraphrases; Kin compares sheet text with sheet text). That wording's Kin across
 * the roster then give the ledger verdict, the keys that run it, and a precedent on a built sheet.
 * @param {string} markdown
 * @param {{index: Index, root?: string, threshold?: number, sheet?: string}} opts `sheet` names the roster
 *   sheet when it differs from the list's title
 * @returns {ClauseRow[]}
 */
export function annotateClauses(markdown, { index, root = ".", threshold = 0.5, sheet = null }) {
  const { owner, clauses } = readClauseList(markdown);
  const { corpus, byPair } = corpusOf(root, index);
  const ownSheet = fold(sheet ?? sheetOf(owner, index, corpus));
  const own = corpus.filter((c) => fold(c.sheet) === ownSheet);
  return clauses.map(({ ref, claim, ability }) => {
    const words = wordsOf(normalize(claim, owner));
    const inAbility = own.filter((c) => fold(c.ability) === fold(ability)
      || (fold(ability).length > 3 && (fold(c.ability).startsWith(fold(ability)) || fold(ability).startsWith(fold(c.ability)))));
    let best = null, score = 0;
    for (const c of inAbility.length ? inAbility : own) {
      const s = overlap(words, wordsOf(c.norm));
      if (s > score) { score = s; best = c; }
    }
    if (!best || score < 0.34) return { ref, claim, sheetClause: null, kinSheets: 0, verdict: null, keys: [], family: null, precedent: null };

    /** @type {Array<{c: import("./kin.mjs").KinClause, j: number}>} */
    const kin = [];
    const seen = new Set();
    for (const p of best.pairs) for (const i of byPair.get(p) ?? []) {
      if (seen.has(i)) continue;
      seen.add(i);
      const j = jaccard(best.pairs, corpus[i].pairs);
      if (j >= threshold) kin.push({ c: corpus[i], j });
    }
    kin.sort((a, b) => b.j - a.j);
    const others = kin.filter((k) => fold(k.c.sheet) !== ownSheet);
    const verdict = index.ledger[best.norm] ?? kin.map((k) => index.ledger[k.c.norm]).find(Boolean) ?? null;
    const resolved = verdict ? resolveShape(verdict.shape, index) : { keys: [], family: null, model: null };
    return {
      ref, claim,
      sheetClause: best.claim,
      kinSheets: new Set(others.map((k) => `${k.c.cls}/${k.c.sheet}`)).size,
      verdict: verdict ? { verdict: verdict.verdict, shape: verdict.shape } : null,
      keys: resolved.keys,
      family: resolved.family,
      gap: resolved.model?.none ?? null,
      precedent: precedentOf(others, index),
    };
  });
}

/**
 * The roster sheet a Clause list's title names: the sheet itself, a built Servant converted from it
 * (`Gilles de Rais (Saber)` → `Gilles de Rais`), or the title without its parenthesis.
 * @param {string} owner @param {Index} index @param {import("./kin.mjs").KinClause[]} corpus
 * @returns {string}
 */
function sheetOf(owner, index, corpus) {
  const sheets = new Set(corpus.map((c) => c.sheet));
  const want = fold(owner);
  const exact = [...sheets].find((s) => fold(s) === want);
  if (exact) return exact;
  for (const [sheet, servants] of index.bySheet) if (servants.some((s) => fold(s.servant) === want)) return sheet;
  const bare = fold(owner.replace(/\s*\(.*\)\s*$/, ""));
  return [...sheets].find((s) => fold(s) === bare) ?? owner;
}

/** The best Kin on a built sheet, with the ability file that runs it. */
function precedentOf(kin, index) {
  for (const { c } of kin) {
    if (!c.built) continue;
    for (const s of index.bySheet.get(c.sheet) ?? []) {
      const want = fold(c.ability);
      const a = s.abilities.find((x) => fold(x.name) === want)
        ?? s.abilities.find((x) => want.startsWith(fold(x.name)) || fold(x.name).startsWith(want));
      return { servant: s.servant, ability: c.ability, file: a?.file ?? s.file, claim: c.claim };
    }
  }
  return null;
}
