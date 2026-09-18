#!/usr/bin/env node
/**
 * @file Emit a Servant's Clause task list from its Character Sheet.
 * @see docs/46-roster-re-audit.md
 *
 * Step 1 of the per-Servant audit procedure. Hand-transcribing Clauses is the
 * programme's mechanical bulk — six to nine hundred of them across twenty-six
 * Servants — and this does the mechanical part: one task-list line per Clause,
 * grouped under its Ability, every Clause starting at `Untouched`.
 *
 * It does **not** do the judgement part, and it is loud about which is which.
 * Everything it could not place is printed to stderr with the line it came from,
 * because a Clause dropped in silence is the defect shape the audit programme
 * exists to find, and a generator that produces a short list without saying so
 * would manufacture it twenty-six times.
 *
 *   node tools/extract-clauses.mjs Asterios
 *   node tools/extract-clauses.mjs "Hassan (Serenity)" --json
 *   node tools/extract-clauses.mjs --all --count
 *
 * Exit status is 0 whenever the sheet parsed; warnings are not failures. They
 * are work for the auditor, and the auditor is reading stderr.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { allClauses, parseCharacterSheet, renderClauseList } from "./lib/clauses.mjs";

const SHEET_DIR = "char_orig_sheets";

/**
 * The Character Sheet for a Servant, by whatever name the caller had to hand:
 * a path, the file's name, or the Servant's.
 *
 * @param {string} who
 * @returns {string} path
 */
function sheetPath(who) {
  if (existsSync(who)) return who;
  const direct = join(SHEET_DIR, `Copia de ${who}.md`);
  if (existsSync(direct)) return direct;

  const lower = who.toLowerCase();
  const files = readdirSync(SHEET_DIR).filter((f) => f.endsWith(".md"));
  const exact = files.find((f) => f.toLowerCase() === `copia de ${lower}.md`);
  if (exact) return join(SHEET_DIR, exact);

  // An exact match is preferred over any partial one, and an ambiguous partial
  // is refused rather than resolved by directory order: "Hassan" matches two
  // Servants, and quietly picking the first would open an audit issue against
  // the wrong one.
  const partial = files.filter((f) => f.toLowerCase().includes(lower));
  if (partial.length === 1) return join(SHEET_DIR, partial[0]);
  if (partial.length > 1) {
    throw new Error(`"${who}" matches ${partial.length} Character Sheets — name one:\n  ${partial.join("\n  ")}`);
  }
  throw new Error(`No Character Sheet for "${who}" in ${SHEET_DIR}/`);
}

/** Every Character Sheet in the corpus. @returns {string[]} */
function everySheet() {
  return readdirSync(SHEET_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => join(SHEET_DIR, f));
}

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith("--")));
const names = argv.filter((a) => !a.startsWith("--"));

if (!names.length && !flags.has("--all")) {
  console.error("usage: node tools/extract-clauses.mjs <Servant>… [--json] [--count] [--all]");
  process.exit(2);
}

/** @type {string[]} */
let paths;
try {
  paths = flags.has("--all") ? everySheet() : names.map(sheetPath);
} catch (error) {
  // The message names the sheets that matched, which is the whole point of it;
  // a stack trace buries it.
  console.error(error.message);
  process.exit(2);
}

for (const path of paths) {
  const sheet = parseCharacterSheet(readFileSync(path, "utf8"));
  const clauses = allClauses(sheet);

  if (flags.has("--count")) {
    const unnamed = clauses.filter((c) => c.unnamed).length;
    console.log(
      `${String(clauses.length).padStart(4)} Clauses  ${String(sheet.groups.reduce((n, g) => n + g.abilities.length, 0)).padStart(3)} Abilities  ` +
        `${String(unnamed).padStart(3)} to name  ${sheet.title}`,
    );
    continue;
  }

  if (flags.has("--json")) {
    console.log(JSON.stringify(sheet, (_k, v) => (v instanceof Map ? Object.fromEntries(v) : v), 2));
  } else {
    if (paths.length > 1) console.log(`\n<!-- ${sheet.title} -->\n`);
    console.log(renderClauseList(sheet));
  }

  if (sheet.warnings.length) {
    console.error(`\n${sheet.title}: ${sheet.warnings.length} line(s) need a human:`);
    for (const w of sheet.warnings) {
      console.error(`  ${path}:${w.line || "?"}  ${w.why}`);
      console.error(`      ${w.text.slice(0, 140)}`);
    }
  }
}
