#!/usr/bin/env node
/**
 * @file Export oracle cases for the Godot port (`grail-tact-godot`, Ch. 15 of its plan).
 *
 * The JS engine decides what is correct. A case is one call of a pure function or reducer: its arguments, its dice,
 * and what it returned. The Godot replay runs its own port of the function on the same arguments and demands the
 * same answer. Cases are cut from this repo's own tests, so their inputs are the tests' subjects: the exporter runs a
 * test file under vitest with `tools/oracle/record-setup.mjs`, which records each call of the wrapped functions.
 * The expectation is what the function returned, never what an assertion says.
 *
 *   node tools/export-oracle.mjs --out ../grail-tact-godot/test/oracle/fixtures --content-lock ../grail-tact-godot/content/content.lock
 *
 * M0 cuts the two golden files: `test/golden/damage.test.mjs` (every `computeDamage` call) and
 * `test/golden/akhilleus-kosmos-authoring.test.mjs` (the authoring descriptors its shipped ability needs).
 * Every case carries the content sha of the Godot content it was cut against; the replay refuses a mismatch.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parse } from "yaml";
import { encode } from "./oracle/codec.mjs";
import { ELEMENT_DESCRIPTORS } from "../module/rules/authoring/elements.mjs";
import { REQUIREMENT_DESCRIPTORS } from "../module/rules/authoring/requirements.mjs";
import { TIMING_DESCRIPTORS } from "../module/rules/authoring/timing.mjs";
import { TARGETS } from "./oracle/targets.mjs";

const fail = (message) => {
  console.error(`export-oracle | ${message}`);
  process.exit(1);
};
const arg = (name) => {
  const at = process.argv.indexOf(name);
  return at < 0 ? null : process.argv[at + 1];
};

const OUT = arg("--out") ? resolve(arg("--out")) : fail("--out <fixtures dir> is required");
const LOCK = arg("--content-lock") ? resolve(arg("--content-lock")) : fail("--content-lock <content.lock> is required");
const lock = JSON.parse(readFileSync(LOCK, "utf8"));
if (!lock.sha) fail(`${LOCK} has no sha`);
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (lock.source_commit !== sourceCommit) {
  fail(`content.lock was exported from ${lock.source_commit.slice(0, 8)}, this checkout is ${sourceCommit.slice(0, 8)}: `
    + "re-export the content first, so the cases and the content agree");
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64).replace(/-$/, "");
const sortKeys = (v) => (Array.isArray(v) ? v.map(sortKeys)
  : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v);
const stable = (v) => JSON.stringify(sortKeys(v), null, 2) + "\n";
const hash = (v) => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 12);

const cases = [];
const addCase = (layer, name, fn, input, result) => {
  cases.push({ id: `${layer}/${slug(name)}`, fn, content_sha: lock.sha, input, dice: [], expect: { result } });
};

// 1. Recorded calls: run the golden damage file under the recording config.
const scratch = mkdtempSync(join(tmpdir(), "fgt-oracle-"));
try {
  execFileSync(process.execPath, [
    "node_modules/vitest/vitest.mjs", "run", "test/golden/damage.test.mjs",
    "--config", "tools/oracle/vitest.oracle.config.mjs", "--reporter", "dot",
  ], { stdio: ["ignore", "ignore", "inherit"], env: { ...process.env, ORACLE_OUT: scratch } });
  const recorded = JSON.parse(readFileSync(join(scratch, "damage.test.mjs.json"), "utf8")).records;
  if (recorded.length === 0) fail("the damage golden file recorded no computeDamage call");
  const seen = new Set();
  for (const r of recorded) {
    const key = hash(r.input);
    if (seen.has(key)) continue; // the same call asserted twice is one case
    seen.add(key);
    // The hash goes after the slug is cut, so two calls under one long test name keep apart.
    cases.push({ id: `rules/damage/${slug(r.test)}-${key}`, fn: r.fn, content_sha: lock.sha, input: r.input, dice: [], expect: { result: r.expect.result } });
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

// 1b. The targets of `tools/oracle/targets.mjs`: a setup file is written for each, wrapping its functions, and its
// test files run under it. Every call is a case; one set of arguments is one case; `cap` bounds each function.
const GENERATED = "tools/oracle/.generated";
const NL = String.fromCharCode(10);
mkdirSync(GENERATED, { recursive: true });
for (const target of TARGETS) {
  const setup = join(GENERATED, `${slug(target.layer)}.mjs`);
  const wraps = Object.entries(target.fns)
    .map(([name, godot]) => `    ${name}: recording(${JSON.stringify(godot)}, mod.${name}),`).join(NL);
  writeFileSync(setup, [
    "// Written by tools/export-oracle.mjs from tools/oracle/targets.mjs; never edited by hand.",
    'import { vi } from "vitest";',
    'import { recording } from "../record-lib.mjs";',
    `vi.mock("../../../${target.module}", async (importOriginal) => {`,
    "  const mod = await importOriginal();",
    "  return {",
    "    ...mod,",
    wraps,
    "  };",
    "});",
    "",
  ].join(NL), "utf8");
  const out = mkdtempSync(join(tmpdir(), "fgt-oracle-"));
  try {
    execFileSync(process.execPath, [
      "node_modules/vitest/vitest.mjs", "run", ...target.tests,
      "--config", "tools/oracle/vitest.oracle.config.mjs", "--reporter", "dot",
    ], { stdio: ["ignore", "ignore", "inherit"], env: { ...process.env, ORACLE_OUT: out, ORACLE_SETUP: setup } });
    const perFn = new Map();
    let unreplayable = 0;
    for (const file of readdirSync(out).sort()) {
      const { records, unreplayable: skipped } = JSON.parse(readFileSync(join(out, file), "utf8"));
      unreplayable += skipped;
      for (const r of records) {
        const kept = perFn.get(r.fn) ?? new Map();
        perFn.set(r.fn, kept);
        const key = hash(r.input);
        if (!kept.has(key) && kept.size < target.cap) kept.set(key, r);
      }
    }
    for (const godot of Object.values(target.fns)) {
      for (const [key, r] of perFn.get(godot) ?? []) {
        const short = godot.split(".").pop();
        cases.push({ id: `${target.layer}/${slug(short)}-${key}`, fn: godot, content_sha: lock.sha, input: r.input, dice: [], expect: { result: r.expect.result } });
      }
    }
    const counts = Object.values(target.fns).map((g) => `${g.split(".").pop()} ${perFn.get(g)?.size ?? 0}`);
    console.log(`export-oracle | ${target.layer}: ${counts.join(", ")}; ${unreplayable} call(s) held a function`);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

// 2. The authoring descriptors the shipped Akhilleus Kosmos needs (the second golden file's subject).
const shipped = parse(readFileSync("packs/_source/abilities/achilles-akhilleus-kosmos.yml", "utf8"));
const fieldsOf = (descriptor) => (descriptor?.fields ?? []).map((f) => f.key).sort();
for (const el of shipped.passiveRules ?? []) {
  addCase("rules/authoring", `element-fields-${el.key}`, "rules.authoring.element_fields",
    { args: [el.key] }, encode(fieldsOf(ELEMENT_DESCRIPTORS[el.key])));
}
for (const req of shipped.requirements ?? []) {
  addCase("rules/authoring", `requirement-fields-${req.kind}`, "rules.authoring.requirement_fields",
    { args: [req.kind] }, encode(fieldsOf(REQUIREMENT_DESCRIPTORS[req.kind])));
}
if (shipped.timing?.window) {
  addCase("rules/authoring", `timing-window-${shipped.timing.window}`, "rules.authoring.has_timing_window",
    { args: [shipped.timing.window] }, Boolean(TIMING_DESCRIPTORS[shipped.timing.window]));
}

// 3. Write: one file per case, and the manifest the replay counts against. Ids are checked before anything is
// removed or written, so a refusal leaves the last export standing.
const ids = new Set();
for (const c of cases) {
  if (ids.has(c.id)) fail(`two cases share the id ${c.id}`);
  ids.add(c.id);
}
rmSync(OUT, { recursive: true, force: true });
for (const c of cases) {
  const file = join(OUT, ...c.id.split("/")) + ".json";
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, stable(c), "utf8");
}
writeFileSync(join(OUT, "manifest.json"), stable({
  content_sha: lock.sha,
  source_commit: sourceCommit,
  count: cases.length,
  cases: cases.map((c) => c.id).sort(),
}), "utf8");
console.log(`export-oracle | ${cases.length} case(s) -> ${OUT}`);
