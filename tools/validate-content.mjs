#!/usr/bin/env node
/**
 * @file Standalone content validation. Runs in CI and before every pack build.
 * @see docs/40-content-pipeline.md
 *
 * Exits non-zero on any problem. Warnings are printed but do not fail the
 * build, because they flag things that are suspicious rather than wrong.
 *
 * Two passes. The validator checks the authored source; then, if it is clean,
 * every compiled document is constructed through Foundry's real DataModel and
 * any Authored Key the model would not keep is a Silent Drop, and an error
 * (ADR-0006).
 */

import { loadSource, loadAssets } from "./lib/load.mjs";
import { validateAll, compileCorpus } from "./lib/content.mjs";
import { checkCompiled, partitionKnown, reportModelCheck } from "./lib/model-check.mjs";

const SOURCE = "packs/_source";
const ASSETS = "assets";

const { files, problems: loadProblems } = await loadSource(SOURCE);
const { assets, problems: assetProblems } = await loadAssets(ASSETS);
const { problems, warnings } = validateAll(files, assets);
const all = [...loadProblems, ...assetProblems, ...problems];

if (files.length === 0) {
  console.error(`FGT | No content found under ${SOURCE}/`);
  process.exit(1);
}

for (const w of warnings) console.warn(`  warning  ${w}`);
for (const p of all) console.error(`  error    ${p}`);

// The model check needs content that compiles, so it runs only when the
// validator found nothing.
let dropped = 0;
if (all.length === 0) {
  const { failing, known, stale } = partitionKnown(await checkCompiled(compileCorpus(files, assets).compiled));
  reportModelCheck({ failing, known, stale });
  dropped = failing.length + stale.length;
}

console.log(
  `\nFGT | ${files.length} source file(s), ${all.length} error(s), ${dropped} Silent Drop(s), `
  + `${warnings.length} warning(s).`,
);
process.exit(all.length + dropped > 0 ? 1 : 0);
