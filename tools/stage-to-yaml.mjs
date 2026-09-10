/**
 * @file Turn a staged export into pack source.
 * @see module/apps/yaml-export.mjs, docs/29-user-interface.md §29.6
 *
 * The other half of the ability editor's way home. The browser writes the
 * authored shape as JSON because nothing under `module/` may import an npm
 * package; this runs in Node, where `yaml` already lives, and produces the
 * `.yml` the content loader reads.
 *
 * Usage: `node tools/stage-to-yaml.mjs [--dir packs/_staged]`
 */

import { readdirSync, readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { stringify } from "yaml";

/**
 * One authored shape as the YAML a pack source file holds.
 *
 * @param {object} shape the object `toAuthoredSource` produced
 * @returns {string}
 */
export function shapeToYaml(shape) {
  return stringify(shape, { lineWidth: 100 });
}

/**
 * Where a document of this kind belongs under `packs/_source/`.
 *
 * Read off the shape rather than guessed from the id: an ability and a Noble
 * Phantasm both live in `abilities/`, and a Servant does not.
 *
 * @param {object} shape
 * @returns {string}
 */
export function destinationFor(shape) {
  if (shape.kind === "servant" || shape.servantClasses) return "servants";
  if (shape.kind === "summon") return "summons";
  return "abilities";
}

/** @returns {void} */
function main() {
  const dirArg = process.argv.indexOf("--dir");
  const staged = dirArg > -1 ? process.argv[dirArg + 1] : "packs/_staged";
  if (!existsSync(staged)) {
    console.log(`FGT | Nothing staged (${staged} does not exist).`);
    return;
  }

  const files = readdirSync(staged).filter((f) => f.endsWith(".export.json"));
  if (files.length === 0) {
    console.log("FGT | Nothing staged.");
    return;
  }

  for (const file of files) {
    const shape = JSON.parse(readFileSync(join(staged, file), "utf8"));
    const out = join("packs/_source", destinationFor(shape), `${shape.id}.yml`);
    writeFileSync(out, shapeToYaml(shape), "utf8");
    unlinkSync(join(staged, file));
    console.log(`FGT | ${file} -> ${out}`);
  }
  console.log(`FGT | ${files.length} staged export(s) written. Run 'npm run validate:content' next.`);
}

// Only when run directly, so the tests can import `shapeToYaml` without it
// scanning a directory.
if (process.argv[1]?.endsWith("stage-to-yaml.mjs")) main();
