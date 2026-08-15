#!/usr/bin/env node
/**
 * @file Enforce the layer boundary: domain → rules → engine → apps.
 * @see docs/01-vision-and-goals.md §1.7
 *
 * `eslint.config.mjs` has computed a `zones` table since the project started,
 * its header calls the layer boundary *"the rule that matters here"*, and it
 * says a violation *"is a lint failure rather than a code review comment"*.
 *
 * It was neither. The zones were exported and **nothing consumed them** —
 * enforcing them needs `eslint-plugin-import`, which is not a dependency. So
 * the project's central architectural rule was documented, computed, and
 * unchecked, which is the same defect shape this codebase keeps finding in its
 * own content: a rule that is right and inert.
 *
 * It was found the honest way: `module/rules/environment.mjs` imported
 * `engine/intents.mjs` and lint passed.
 *
 * This is deliberately a small script rather than a new dependency. It reads
 * the same `ALLOWED` table eslint exports, so there is one source of truth.
 */

import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve, dirname, sep } from "node:path";
import { ALLOWED, LAYERS } from "../eslint.config.mjs";

const ROOT = resolve(".");
const MODULE_DIR = join(ROOT, "module");

/**
 * Every `.mjs` file under a directory.
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function walk(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (entry.name.endsWith(".mjs")) out.push(full);
  }
  return out;
}

/**
 * Which layer a file under `module/` belongs to.
 *
 * A file directly in `module/` (`fgt.mjs`, `config.mjs`, `settings.mjs`) is the
 * bootstrap and belongs to no layer — it is allowed to reach anywhere, which is
 * what a bootstrap is for.
 *
 * @param {string} absolute
 * @returns {string|null}
 */
export function layerOf(absolute) {
  const rel = relative(MODULE_DIR, absolute);
  if (rel.startsWith("..")) return null;
  const [first] = rel.split(sep);
  return LAYERS.includes(first) ? first : null;
}

/**
 * The layers a source file imports from.
 *
 * Resolves the specifier against the importing file's directory, so
 * `"../domain/x.mjs"` and `"../../module/domain/x.mjs"` are the same edge. That
 * second form is exactly how the violation that prompted this slipped past a
 * pattern-matching rule.
 *
 * @param {string} absolute
 * @param {string} source
 * @returns {string[]}
 */
export function importedLayers(absolute, source) {
  /** @type {string[]} */
  const out = [];
  for (const m of source.matchAll(/^\s*(?:import|export)[^'"]*from\s*['"]([^'"]+)['"]/gm)) {
    const spec = m[1];
    if (!spec.startsWith(".")) continue;
    const target = layerOf(resolve(dirname(absolute), spec));
    if (target) out.push(target);
  }
  return out;
}

/**
 * Violations that already existed when this check was written.
 *
 * Recorded rather than waved through: widening `ALLOWED` to fit them would say
 * the architecture permits this, which it does not, and blocking every commit
 * until three refactors land would mean the rule goes on not being enforced.
 * So each is listed with the reason it exists and what would remove it.
 *
 * **New violations fail.** A stale entry here also fails, so the list cannot
 * quietly outlive the debt.
 *
 * @type {Array<{file: string, imports: string, why: string}>}
 */
const KNOWN_EXCEPTIONS = [
  {
    file: "module/documents/combat.mjs",
    imports: "engine",
    why: "FGTCombat reads turn-order and the faction roster from the engine. The turn "
      + "order is pure and belongs in rules; moving it would clear this.",
  },
  {
    file: "module/engine/attack.mjs",
    imports: "apps",
    why: "The attack flow renders its own chat card. The Process state lives on a message "
      + "flag (Ch. 27), so the orchestrator and its card are genuinely coupled; the fix is "
      + "an event the apps layer subscribes to, not a re-parenting.",
  },
  {
    file: "module/net/operations.mjs",
    imports: "engine",
    why: "The socket operation table validates intents statically and dynamically imports "
      + "each engine entry point. The dynamic ones are lazy on purpose; the static "
      + "`validate` import is the one that would move.",
  },
];

/* ── Run ──────────────────────────────────────────────────────────────────── */

/** @type {string[]} */
const problems = [];
/** @type {Set<string>} */
const seen = new Set();

for (const file of await walk(MODULE_DIR)) {
  const from = layerOf(file);
  if (!from) continue;

  const allowed = ALLOWED[from] ?? [];
  const source = await readFile(file, "utf8");
  const rel = relative(ROOT, file).split(sep).join("/");

  for (const to of new Set(importedLayers(file, source))) {
    if (to === from || allowed.includes(to)) continue;

    const excepted = KNOWN_EXCEPTIONS.find((e) => e.file === rel && e.imports === to);
    if (excepted) {
      seen.add(`${rel} -> ${to}`);
      continue;
    }
    problems.push(
      `${rel}: imports from module/${to}, but module/${from} may only import from: ` +
      `${allowed.join(", ") || "(nothing)"}`,
    );
  }
}

// A recorded exception that no longer happens is debt that was paid; say so,
// so the list shrinks instead of ossifying.
for (const e of KNOWN_EXCEPTIONS) {
  if (!seen.has(`${e.file} -> ${e.imports}`)) {
    problems.push(`${e.file}: no longer imports from module/${e.imports} — remove it from KNOWN_EXCEPTIONS.`);
  }
}

if (problems.length > 0) {
  for (const p of problems) console.error(`error    ${p}`);
  console.error(`\nFGT | ${problems.length} layer problem(s). See docs/01-vision-and-goals.md §1.7.`);
  process.exit(1);
}

console.log(
  `FGT | Layer boundaries intact (${KNOWN_EXCEPTIONS.length} recorded exception(s) still outstanding).`,
);
