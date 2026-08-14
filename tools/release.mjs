#!/usr/bin/env node
/**
 * @file Stamp the version and release URLs into system.json.
 *
 * Foundry installs a system from a manifest URL, so the manifest must point at
 * the exact release it belongs to: `manifest` at the versioned system.json and
 * `download` at the versioned zip. Pointing both at `latest` makes updates
 * silently install the wrong build.
 */

import { readFile, writeFile } from "node:fs/promises";

const [version, repository] = process.argv.slice(2);
if (!version || !repository) {
  console.error("usage: node tools/release.mjs <version> <owner/repo>");
  process.exit(1);
}
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
  console.error(`FGT | "${version}" is not a semver version.`);
  process.exit(1);
}

const path = "system.json";
const manifest = JSON.parse(await readFile(path, "utf8"));
const base = `https://github.com/${repository}`;

manifest.version = version;
manifest.url = base;
// Versioned, so an installed world updates to exactly this build.
manifest.manifest = `${base}/releases/download/v${version}/system.json`;
manifest.download = `${base}/releases/download/v${version}/fgt.zip`;

await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`FGT | system.json stamped at ${version}`);
console.log(`      manifest ${manifest.manifest}`);
console.log(`      download ${manifest.download}`);
