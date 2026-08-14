/**
 * @file Filesystem loading for the content pipeline.
 *
 * Split from `content.mjs` so that every decision the pipeline makes stays
 * unit-testable against in-memory objects; this module is the only part that
 * needs a disk.
 */

import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import YAML from "yaml";

/**
 * Load every `.yml` under `root`, tagged with its immediate source directory.
 *
 * @param {string} root e.g. `packs/_source`
 * @returns {Promise<{files: Array<{path: string, dir: string, doc: object}>, problems: string[]}>}
 */
export async function loadSource(root) {
  /** @type {Array<{path: string, dir: string, doc: object}>} */
  const files = [];
  /** @type {string[]} */
  const problems = [];

  for await (const abs of walk(root)) {
    if (!abs.endsWith(".yml") && !abs.endsWith(".yaml")) continue;
    const rel = relative(root, abs);
    const dir = rel.split(sep)[0];
    try {
      const doc = YAML.parse(await readFile(abs, "utf8"));
      files.push({ path: relative(process.cwd(), abs), dir, doc });
    } catch (err) {
      // YAML errors carry a line number; surfacing it is the difference
      // between a two-second fix and a hunt.
      problems.push(`${relative(process.cwd(), abs)}: ${err.message}`);
    }
  }
  return { files, problems };
}

/**
 * @param {string} dir
 * @returns {AsyncGenerator<string>}
 */
async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(abs);
    else yield abs;
  }
}
