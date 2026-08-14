#!/usr/bin/env node
/**
 * @file Extract one release's section from CHANGELOG.md.
 *
 * The whole changelog is several hundred lines and includes three
 * documentation versions; pasting all of it into a GitHub release makes the
 * notes useless. This takes only the section for the version being released.
 */

import { readFile, writeFile } from "node:fs/promises";

const [version, out = "RELEASE_NOTES.md"] = process.argv.slice(2);
if (!version) {
  console.error("usage: node tools/release-notes.mjs <version> [outfile]");
  process.exit(1);
}

const changelog = await readFile("CHANGELOG.md", "utf8");
const lines = changelog.split("\n");

const start = lines.findIndex((l) => l.startsWith(`## [${version}]`));
if (start === -1) {
  console.error(`FGT | No "## [${version}]" section in CHANGELOG.md.`);
  process.exit(1);
}
// Stop at the next top-level heading of either version line.
let end = lines.length;
for (let k = start + 1; k < lines.length; k++) {
  if (lines[k].startsWith("## ")) { end = k; break; }
}

const body = lines.slice(start + 1, end).join("\n").replace(/^\s*---\s*$/gm, "").trim();
await writeFile(out, `${body}\n`);
console.log(`FGT | Wrote ${out} (${body.split("\n").length} lines) for ${version}`);
