#!/usr/bin/env node
/**
 * @file YAML source → LevelDB compendium packs.
 * @see docs/37-content-pipeline.md §37.3
 *
 * The packs are build artefacts and are gitignored: LevelDB directories are
 * binary, unmergeable and undiffable, which is unacceptable for content that
 * will be reviewed and collaboratively edited. YAML under `packs/_source/` is
 * the source of truth.
 *
 * Validation runs first and a failure aborts the build, so a broken pack can
 * never reach a release.
 */

import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { compilePack } from "@foundryvtt/foundryvtt-cli";
import { loadSource } from "./lib/load.mjs";
import { validateAll, compileDocument, PACKS } from "./lib/content.mjs";

const SOURCE = "packs/_source";
const STAGING = ".build/packs";
const OUT = "packs";

const { files, problems: loadProblems } = await loadSource(SOURCE);
const { problems, warnings } = validateAll(files);
const all = [...loadProblems, ...problems];

for (const w of warnings) console.warn(`  warning  ${w}`);
if (all.length > 0) {
  for (const p of all) console.error(`  error    ${p}`);
  console.error(`\nFGT | Build aborted: ${all.length} content error(s).`);
  process.exit(1);
}

const library = new Map(files.filter((f) => f.doc?.id).map((f) => [f.doc.id, f.doc]));

// Group compiled documents by destination pack.
/** @type {Map<string, object[]>} */
const byPack = new Map();
for (const { path, dir, doc } of files) {
  const spec = PACKS[dir];
  if (!spec) {
    console.warn(`  warning  ${path}: directory "${dir}" has no pack mapping — skipped`);
    continue;
  }
  // Abilities referenced by a Servant are embedded in that Servant rather than
  // shipped standalone, so they are compiled through the actor, not here.
  if (dir === "abilities" && [...library.values()].some((d) => (d.abilities ?? []).some((a) => a?.ref === doc.id))) {
    continue;
  }
  if (!byPack.has(spec.pack)) byPack.set(spec.pack, []);
  byPack.get(spec.pack).push(compileDocument(doc, dir, library));
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
