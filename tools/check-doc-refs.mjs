#!/usr/bin/env node
/**
 * @file Enforce that every `docs/…` reference in the source points at a real chapter.
 * @see docs/00-index.md
 *
 * The codebase is densely cross-linked to the documentation: 495 `@see docs/…`
 * references across 332 files at the time this was written. That is a genuinely
 * good habit — it is how a reader gets from a function to the chapter explaining
 * why it is shaped that way — but nothing checked it, so when the chapter set was
 * renumbered in September 2026 every one of those references silently went stale.
 *
 * Exactly four of them were caught, by `test/unit/authoring-elements.test.mjs`,
 * which asserts that each authoring descriptor's `doc:` field resolves. The other
 * ~490 were found only because someone went looking. This script closes that gap
 * for all of them.
 *
 * It is deliberately a small script rather than a lint plugin, for the same reason
 * `tools/check-layers.mjs` is: one rule, twenty lines, no new dependency. Both run
 * as part of `npm run lint`.
 *
 * It reads the authored corpus (`packs/_source/**.yml`) as well as the source.
 * Content cites chapters too — `karna-brahmastra.yml` opened with two references
 * to archived chapters — and a check that only walked `.mjs` would never see it.
 *
 * **`docs/plan-archive/` is a failure, not a target.** Those chapters are the
 * superseded plan-era set, kept for history and explicitly marked as never a
 * source of truth. A reference into them is rot that survived the remap.
 */

import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const ROOT = resolve(".");
const SCANNED = ["module", "tools", "test", "packs/_source"];

/**
 * Config files at the repo root cite chapters too, and a directory walk misses
 * them. `eslint.config.mjs` carried a reference to an archived chapter through a
 * whole remap for exactly this reason: the remapper and the first version of this
 * check both scanned `SCANNED` only.
 */
const ROOT_FILES = ["eslint.config.mjs", "vitest.config.mjs"];

/** Any `docs/<name>.md`, with an optional `#anchor` we ignore. */
const REF = /docs\/([A-Za-z0-9][\w.-]*\.md)(#[\w.-]*)?/g;

/**
 * Every source or content file under a directory.
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function walk(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (entry.name.endsWith(".mjs") || entry.name.endsWith(".yml")) out.push(full);
  }
  return out;
}

/* ── Run ──────────────────────────────────────────────────────────────────── */

/** @type {string[]} */
const problems = [];
let checked = 0;

/** Every file this check reads: the walked directories, plus the root configs. */
const targets = [];
for (const dir of SCANNED) {
  if (existsSync(join(ROOT, dir))) targets.push(...(await walk(join(ROOT, dir))));
}
for (const name of ROOT_FILES) {
  if (existsSync(join(ROOT, name))) targets.push(join(ROOT, name));
}

{
  for (const file of targets) {
    const source = await readFile(file, "utf8");
    const rel = relative(ROOT, file).split(sep).join("/");

    for (const [, name] of source.matchAll(REF)) {
      checked += 1;
      // The archive is history. Pointing at it is the rot this check exists for.
      if (existsSync(join(ROOT, "docs", "plan-archive", name))
        && !existsSync(join(ROOT, "docs", name))) {
        problems.push(
          `${rel}: references docs/${name}, which is in docs/plan-archive/ — `
          + "superseded, and never a source of truth. Remap it using the table in "
          + "docs/plan-archive/README.md.",
        );
        continue;
      }
      if (!existsSync(join(ROOT, "docs", name))) {
        problems.push(`${rel}: references docs/${name}, which does not exist.`);
      }
    }
  }
}

if (problems.length > 0) {
  for (const p of problems) console.error(`error    ${p}`);
  console.error(`\nFGT | ${problems.length} dangling documentation reference(s).`);
  process.exit(1);
}

console.log(`FGT | Documentation references intact (${checked} checked).`);
