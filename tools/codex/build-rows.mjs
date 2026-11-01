#!/usr/bin/env node
// The Codex rows: every ability and every effect the packs author, with who
// holds each one, for the Ability & Effect Codex sheet (docs/design/codex/).
//
//   node tools/codex/build-rows.mjs [--out <dir>] [--csv <columns.json>]
//
// It reads packs/_source only. The hand-written columns (the one-line phrase,
// the lore, the icon) live in <out>/columns.json, keyed by row id; with
// --csv they are merged in and abilities.csv / effects.csv are written.
//
// Holders are every non-test Servant, summon and Master type whose
// `abilities:` lists the doc by `ref`, plus any ability that grants it
// (`grants.abilities`). Test servants (`test-*`) and Normal Servants are out of
// scope; a doc held only by them is dropped.
//
// "Variant" is a doc held only by versions of one figure. The figures are
// listed here by hand, because nothing on a sheet says two Servants are one
// person:
const FIGURES = {
  vlad: ["vlad-berserker", "vlad-lancer"],
  gilles: ["gilles", "gilles-saber"],
  dioscuri: ["castor", "pollux"],
  artoria: ["arturia", "lanceturia"],
};

import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "../..");
const SRC = path.join(ROOT, "packs/_source");
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const OUT = path.resolve(opt("--out") ?? path.join(ROOT, "docs/design/codex"));

const load = (dir) => fs.readdirSync(path.join(SRC, dir))
  .filter((f) => f.endsWith(".yml"))
  .map((f) => {
    const raw = fs.readFileSync(path.join(SRC, dir, f), "utf8");
    return { dir, file: f, raw, doc: yaml.load(raw) };
  });

const outOfScope = (id) => id.startsWith("test-");

// Turn `@effect[atkUp]{Atk Up}` and its kin into their label.
const clean = (text) => String(text ?? "")
  .replace(/@\w+\[[^\]]*\]\{([^}]*)\}/g, "$1")
  .replace(/@\w+\[([^\]]*)\]/g, "$1")
  .replace(/\r?\n/g, " ")
  .replace(/\s+/g, " ")
  .trim();

// ── Holders ───────────────────────────────────────────────────────────────
const holders = new Map(); // ability id -> [{ holder, rank }]
const hold = (ref, holder, rank) => {
  if (!holders.has(ref)) holders.set(ref, []);
  holders.get(ref).push({ holder, rank: rank ?? null });
};
const holderName = new Map();
for (const dir of ["servants", "summons", "masters"]) {
  for (const { file, doc } of load(dir)) {
    const id = doc.id ?? file.replace(/\.yml$/, "");
    if (outOfScope(id)) continue;
    holderName.set(id, doc.name ?? id);
    for (const a of doc.abilities ?? []) if (a?.ref) hold(a.ref, id, a.rank);
  }
}

const abilityDocs = [
  ...load("abilities"), ...load("class-skills"), ...load("command-spells"), ...load("master-essences"),
];
// An ability that grants others makes its holders theirs too.
for (const { doc } of abilityDocs) {
  for (const g of doc.grants?.abilities ?? []) {
    for (const h of holders.get(doc.id) ?? []) hold(g, h.holder, null);
  }
}

// Docs a test servant or a Normal Servant holds, so a doc held by nobody in
// scope can be told apart from one nobody holds at all.
const outsideOnly = new Set();
for (const dir of ["servants", "servants-normal"]) {
  for (const { file, doc } of load(dir)) {
    const id = doc.id ?? file.replace(/\.yml$/, "");
    if (dir === "servants" && !outOfScope(id)) continue;
    for (const a of doc.abilities ?? []) if (a?.ref) outsideOnly.add(a.ref);
  }
}

const kindOf = (d) => {
  if (d.type === "commandSpell") return "Command Spell";
  if (d.type === "masterEssence") return "Master Essence";
  if (d.kind === "equipment" || d.type === "equipment") return "Equipment";
  if (d.kind === "noblePhantasm" || d.isNP) return "Noble Phantasm";
  const passive = d.passive || d.isPassive || /^\(Passive\)/i.test(String(d.description ?? "").trim())
    || (d.passiveRules && !d.phases && !d.cooldown);
  if (d.kind === "classSkill") return passive ? "Class Skill (Passive)" : "Class Skill";
  return passive ? "Passive Skill" : "Active Skill";
};

const shareOf = (ids) => {
  if (ids.length <= 1) return "Unique";
  for (const members of Object.values(FIGURES)) if (ids.every((i) => members.includes(i))) return "Variant";
  return "Shared";
};

const abilities = [];
const dropped = [];
for (const { dir, file, doc } of abilityDocs) {
  const id = doc.id ?? file.replace(/\.yml$/, "");
  const hs = holders.get(id) ?? [];
  const ids = [...new Set(hs.map((h) => h.holder))];
  if (outOfScope(id) || (!ids.length && outsideOnly.has(id))) { dropped.push(id); continue; }
  const ranks = [...new Set(hs.map((h) => h.rank).filter(Boolean))];
  abilities.push({
    id,
    pack: dir,
    name: doc.name ?? id,
    // A shared Class Skill authors `rank: "@rank"`: each holder brings its own.
    rank: doc.rank && !String(doc.rank).startsWith("@") ? doc.rank : ranks.join(" / "),
    kind: kindOf(doc),
    holders: ids.map((i) => holderName.get(i) ?? i).join(", ") || (dir === "command-spells" || dir === "master-essences" ? "Any Master" : "Granted by another ability"),
    holderIds: ids,
    share: dir === "command-spells" || dir === "master-essences" ? "Shared" : null,
    system: clean(doc.description),
  });
}

// A name several docs carry is one skill held at several Ranks or in several
// versions (Charisma, Riding, Mana Burst): its holders are the union.
const byName = new Map();
for (const a of abilities) {
  if (!byName.has(a.name)) byName.set(a.name, new Set());
  for (const h of a.holderIds) byName.get(a.name).add(h);
}
for (const a of abilities) {
  if (a.share) continue;
  a.share = shareOf([...byName.get(a.name)]);
  a.sameName = abilities.filter((b) => b.name === a.name).length;
}

// ── Effects ───────────────────────────────────────────────────────────────
const effectDocs = load("effects");
const effectIds = new Set(effectDocs.map(({ doc }) => doc.id));
const appliedBy = new Map();
for (const { doc, raw } of abilityDocs) {
  if (dropped.includes(doc.id)) continue;
  const named = new Set();
  for (const m of raw.matchAll(/@effect\[([\w-]+)\]/g)) named.add(m[1]);
  for (const m of raw.matchAll(/\bid:\s*"?([\w-]+)"?/g)) if (effectIds.has(m[1])) named.add(m[1]);
  for (const e of named) {
    if (!effectIds.has(e)) continue;
    if (!appliedBy.has(e)) appliedBy.set(e, new Set());
    appliedBy.get(e).add(doc.name ?? doc.id);
  }
}
const effects = effectDocs.map(({ doc }) => ({
  id: doc.id,
  name: doc.name ?? doc.id,
  polarity: doc.polarity ?? "",
  nature: [doc.volatility, doc.severity, doc.valence].filter(Boolean).join(" · "),
  appliedBy: [...(appliedBy.get(doc.id) ?? [])].sort().join(", ") || "—",
  share: (appliedBy.get(doc.id)?.size ?? 0) > 1 ? "Shared" : "Unique",
  system: clean(doc.description),
}));

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "abilities.rows.json"), JSON.stringify(abilities, null, 1));
fs.writeFileSync(path.join(OUT, "effects.rows.json"), JSON.stringify(effects, null, 1));

const count = (rows, k) => rows.reduce((o, r) => ((o[r[k]] = (o[r[k]] ?? 0) + 1), o), {});
console.log(`abilities ${abilities.length}`, JSON.stringify(count(abilities, "kind")), JSON.stringify(count(abilities, "share")));
console.log(`effects ${effects.length}`, JSON.stringify(count(effects, "polarity")));
console.log(`dropped (test or Normal Servant only) ${dropped.length}: ${dropped.join(", ")}`);
console.log(`unheld abilities ${abilities.filter((a) => a.holders === "—").length}`);

// ── CSV ───────────────────────────────────────────────────────────────────
const colsPath = opt("--csv");
if (colsPath) {
  const cols = JSON.parse(fs.readFileSync(path.resolve(colsPath), "utf8"));
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const write = (file, head, rows) => fs.writeFileSync(path.join(OUT, file),
    "﻿" + [head, ...rows].map((r) => r.map(q).join(",")).join("\r\n") + "\r\n");
  const hand = (id) => cols[id] ?? {};
  write("abilities.csv",
    ["ID", "Name", "Rank", "Kind", "Holders", "Shared / Variant / Unique", "What it does (system)", "In one line",
      "Lore: what it is", "Lore: how it looks", "Wiki source", "Icon family", "Icon concept"],
    abilities.map((a) => { const h = hand(a.id); return [a.id, a.name, a.rank, a.kind, a.holders, a.share, a.system,
      h.line, h.lore, h.look, h.source, h.family, h.icon]; }));
  write("effects.csv",
    ["ID", "Name", "Polarity", "Nature", "Applied by", "Shared / Unique", "What it does (system)", "In one line",
      "Lore: what it is", "Lore: how it looks", "Wiki source", "Icon family", "Icon concept"],
    effects.map((e) => { const h = hand(`effect:${e.id}`); return [e.id, e.name, e.polarity, e.nature, e.appliedBy, e.share,
      e.system, h.line, h.lore, h.look, h.source, h.family, h.icon]; }));
  const missing = [...abilities.map((a) => a.id), ...effects.map((e) => `effect:${e.id}`)]
    .filter((k) => !cols[k]?.line || !cols[k]?.icon);
  console.log(`csv written; rows missing a line or an icon: ${missing.length}`);
}
