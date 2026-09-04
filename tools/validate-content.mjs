#!/usr/bin/env node
/**
 * @file Standalone content validation. Runs in CI and before every pack build.
 * @see docs/37-content-pipeline.md §37.4
 *
 * Exits non-zero on any problem. Warnings are printed but do not fail the
 * build, because they flag things that are suspicious rather than wrong.
 */

import { loadSource, loadAssets } from "./lib/load.mjs";
import { validateAll } from "./lib/content.mjs";

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

console.log(
  `\nFGT | ${files.length} source file(s), ${all.length} error(s), ${warnings.length} warning(s).`,
);
process.exit(all.length > 0 ? 1 : 0);
