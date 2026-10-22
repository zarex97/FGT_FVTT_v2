#!/usr/bin/env node
/**
 * @file Ask what the engine already runs.
 * @see tools/lib/capabilities.mjs, docs/43-tooling.md, docs/model/README.md
 *
 *   node tools/capability.mjs RankShift                  authored keys matching a term, who authors them, tests
 *   node tools/capability.mjs --shape "Item.wear"        a Character-model field and the keys that run it
 *   node tools/capability.mjs --sheet <clauses.md>       a hand-written Clause list, each Clause annotated
 *
 * `--as <Sheet>` names the roster sheet when a Clause list's title differs from it and no built Servant links them.
 * `--json` prints the result as JSON. `--all` lifts the five-hit limit on a term.
 *
 * `--sheet` reads a Clause list written by hand (`- [ ] **REF** · claim · *Status*`). It never splits a
 * sheet into Clauses itself.
 */

import { readFileSync } from "node:fs";

import { annotateClauses, buildIndex, capabilityOf } from "./lib/capabilities.mjs";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  if (i < 0) return false;
  args.splice(i, 1);
  return true;
};
const value = (name) => {
  const i = args.indexOf(name);
  if (i < 0) return null;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const json = flag("--json");
const all = flag("--all");
const shape = value("--shape");
const sheet = value("--sheet");
const as = value("--as");
const term = args.join(" ");

if (!shape && !sheet && !term) {
  console.error("usage: node tools/capability.mjs <term> | --shape <Shape.field> | --sheet <clauses.md> [--json] [--all]");
  process.exit(2);
}

const index = await buildIndex();
const head = (xs, n = 5) => (xs.length > n ? [...xs.slice(0, n), `… ${xs.length - n} more`] : xs);
const clip = (s, n = 110) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

if (sheet) {
  const rows = annotateClauses(readFileSync(sheet, "utf8"), { index, sheet: as });
  if (json) { console.log(JSON.stringify(rows, null, 2)); process.exit(0); }
  const known = rows.filter((r) => r.verdict || r.precedent);
  const unknown = rows.filter((r) => !r.verdict && !r.precedent);
  console.log(`${rows.length} Clauses: ${known.length} with Kin on the roster, ${unknown.length} new.\n`);
  console.log("| Clause | Kin sheets | verdict · Shape | keys | precedent |");
  console.log("|---|---|---|---|---|");
  for (const r of [...known, ...unknown]) {
    const v = r.verdict ? `${r.verdict.verdict} · ${clip(r.verdict.shape, 50)}` : "";
    const k = r.keys.length ? r.keys.join(", ") : r.gap ? `gap: ${r.gap}` : (r.family ? `(${r.family})` : "");
    const p = r.precedent ? `${r.precedent.servant}: ${r.precedent.file}` : "";
    console.log(`| ${r.ref} | ${r.kinSheets} | ${v.replace(/\|/g, "/")} | ${k} | ${p} |`);
  }
} else if (shape) {
  const { model } = capabilityOf(shape.replace(/^.*\./, ""), index);
  const want = shape.split(".")[0].toLowerCase();
  const found = model.filter((m) => m.shape.toLowerCase().replace(/\s/g, "") === want.replace(/\s/g, ""));
  if (json) { console.log(JSON.stringify(found, null, 2)); process.exit(0); }
  if (found.length === 0) console.log(`No field ${shape} in docs/model/.`);
  for (const m of found) {
    console.log(`${m.file}:${m.line}  ${m.shape}.${m.names[0]}`);
    console.log(`  keys: ${m.keys.length ? m.keys.join(", ") : (m.none ?? "(no keys: line)")}`);
    console.log(`  ${clip(m.text, 300)}`);
  }
} else {
  const { hits, model } = capabilityOf(term, index);
  const shown = all ? hits : hits.slice(0, 5);
  if (json) { console.log(JSON.stringify({ hits: shown.map((h) => ({ key: h.key, ...h.entry })), model }, null, 2)); process.exit(0); }
  if (hits.length === 0) console.log(`Nothing authored matches "${term}".`);
  for (const { key, entry } of shown) {
    console.log(`${key}${entry.english ? ` — ${clip(entry.english)}` : ""}`);
    if (entry.fields.length) console.log(`  fields: ${entry.fields.join(", ")}`);
    console.log(`  used by ${entry.usage.length}${entry.usage.length ? `: ${head(entry.usage).join(", ")}` : ""}`);
    if (entry.tests.length) console.log(`  tests: ${head(entry.tests, 3).join(", ")}`);
  }
  if (!all && hits.length > 5) console.log(`… ${hits.length - 5} more hits (--all)`);
  for (const m of model) console.log(`model: ${m.file}:${m.line} ${m.shape}.${m.names[0]} → ${m.keys.join(", ") || m.none || "(no keys: line)"}`);
}
