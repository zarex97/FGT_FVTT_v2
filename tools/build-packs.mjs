#!/usr/bin/env node
/**
 * @file YAML source → LevelDB compendium packs.
 * @see docs/40-content-pipeline.md
 *
 * The packs are build artefacts and are gitignored: LevelDB directories are
 * binary, unmergeable and undiffable, which is unacceptable for content that
 * will be reviewed and collaboratively edited. YAML under `packs/_source/` is
 * the source of truth.
 *
 * Validation runs first and a failure aborts the build, so a broken pack can
 * never reach a release. Then every compiled document is constructed through
 * Foundry's real DataModel, and a key it would not keep aborts the build too.
 */

import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { compilePack } from "@foundryvtt/foundryvtt-cli";
import { loadSource, loadAssets } from "./lib/load.mjs";
import { validateAll, compileCorpus } from "./lib/content.mjs";
import { checkCompiled, partitionKnown, reportModelCheck } from "./lib/model-check.mjs";

const SOURCE = "packs/_source";
const ASSETS = "assets";
const STAGING = ".build/packs";
const OUT = "packs";

const { files, problems: loadProblems } = await loadSource(SOURCE);
const { assets, problems: assetProblems } = await loadAssets(ASSETS);
const { problems, warnings } = validateAll(files, assets);
const all = [...loadProblems, ...assetProblems, ...problems];

for (const w of warnings) console.warn(`  warning  ${w}`);
if (all.length > 0) {
  for (const p of all) console.error(`  error    ${p}`);
  console.error(`\nFGT | Build aborted: ${all.length} content error(s).`);
  process.exit(1);
}

// Every compiled document is held to Foundry's real DataModel before anything
// is packed: an Authored Key the model would not keep fails the build here,
// instead of vanishing when the document loads in a world (ADR-0006).
const { compiled, warnings: compileWarnings } = compileCorpus(files, assets);
for (const w of compileWarnings) console.warn(`  warning  ${w}`);
const { failing, known, stale } = partitionKnown(await checkCompiled(compiled));
reportModelCheck({ failing, known, stale });
if (failing.length > 0 || stale.length > 0) {
  console.error(`\nFGT | Build aborted: ${failing.length} Silent Drop(s), ${stale.length} stale known drop(s).`);
  process.exit(1);
}

// Group compiled documents by destination pack.
/** @type {Map<string, object[]>} */
const byPack = new Map();
for (const { pack, doc } of compiled) {
  if (!byPack.has(pack)) byPack.set(pack, []);
  byPack.get(pack).push(doc);
}

await rm(STAGING, { recursive: true, force: true });

let total = 0;
for (const [pack, docs] of byPack) {
  const stage = join(STAGING, pack);
  await mkdir(stage, { recursive: true });
  for (const doc of docs) {
    await writeFile(join(stage, `${doc._id}.json`), JSON.stringify(doc, null, 2));
  }
  const dest = join(OUT, pack);
  await rm(dest, { recursive: true, force: true });
  await compilePack(stage, dest, { log: false });
  console.log(`  packed   ${pack.padEnd(16)} ${String(docs.length).padStart(4)} document(s)`);
  total += docs.length;
}

console.log(`\nFGT | Built ${byPack.size} pack(s), ${total} document(s), ${warnings.length} warning(s).`);
