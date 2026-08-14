#!/usr/bin/env node
/**
 * @file Run the template checks over `templates/`.
 */

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { checkTemplate } from "./lib/templates.mjs";

/**
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function templates(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await templates(path)));
    else if (entry.name.endsWith(".hbs")) out.push(path);
  }
  return out;
}

const files = await templates("templates");
let problems = 0;

for (const file of files) {
  for (const problem of checkTemplate(file, await readFile(file, "utf8"))) {
    console.error(`error    ${problem}`);
    problems++;
  }
}

console.log(`\nFGT | ${files.length} template(s), ${problems} problem(s).`);
if (problems > 0) process.exit(1);
