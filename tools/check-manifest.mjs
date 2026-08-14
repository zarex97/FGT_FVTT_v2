#!/usr/bin/env node
/**
 * @file Manifest sanity checks.
 *
 * Every path system.json declares must exist in the built package. A missing
 * esmodule or stylesheet is a system that installs and then fails to load,
 * which is a far worse failure than a build error.
 */

import { readFile, access } from "node:fs/promises";
import { constants } from "node:fs";

const manifest = JSON.parse(await readFile("system.json", "utf8"));
/** @type {string[]} */
const problems = [];

const mustExist = [
  ...(manifest.esmodules ?? []),
  ...(manifest.styles ?? []),
  ...(manifest.languages ?? []).map((l) => l.path),
];

for (const path of mustExist) {
  try {
    await access(path, constants.R_OK);
  } catch {
    problems.push(`declared path does not exist: ${path}`);
  }
}

if (manifest.socket !== true) {
  // Without it the server refuses to register the system.fgt namespace and
  // every emit silently does nothing. It requires a world restart to take
  // effect, so it is worth failing the build over.
  problems.push('"socket" must be true — the GM proxy depends on it');
}
if (!manifest.compatibility?.minimum) problems.push("compatibility.minimum is missing");
if (!manifest.id || manifest.id !== "fgt") problems.push('id must be "fgt"');

for (const pack of manifest.packs ?? []) {
  for (const field of ["name", "label", "type"]) {
    if (!pack[field]) problems.push(`pack "${pack.name ?? "?"}" is missing "${field}"`);
  }
}

for (const p of problems) console.error(`  error    ${p}`);
console.log(`\nFGT | Manifest check: ${problems.length} problem(s).`);
process.exit(problems.length > 0 ? 1 : 0);
