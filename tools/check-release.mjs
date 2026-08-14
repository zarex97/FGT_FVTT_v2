#!/usr/bin/env node
/**
 * @file Everything that must be true *before* a version is tagged.
 *
 * The release workflow already runs lint, the content validator and the tests —
 * but it runs them against **the tagged commit**, and a tag cannot be edited.
 * So a changelog fixed after tagging fixes nothing: the workflow re-reads the
 * commit the tag points at, finds the same problem, and fails again. That is
 * exactly how `v0.2.0` failed, twice.
 *
 * This is the check that has to happen while a commit can still be made. Run
 * `npm run check:release -- 0.3.0` before `git tag v0.3.0`.
 */

import { readFile } from "node:fs/promises";

const [version] = process.argv.slice(2);
if (!version) {
  console.error("usage: node tools/check-release.mjs <version>   (without the leading v)");
  process.exit(1);
}

/** @type {string[]} */
const problems = [];
/** @type {string[]} */
const notes = [];

if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
  problems.push(`"${version}" is not a semver version. Pass it without the leading "v".`);
}

/* ── The changelog section the release notes are cut from ─────────────────── */

// Advisory only. `tools/release-notes.mjs` falls back to the Unreleased section
// and then to the commit log, so a missing heading costs a tidier set of notes
// and nothing else. It is not worth blocking a release over prose.

const changelog = await readFile("CHANGELOG.md", "utf8").catch(() => "");
const lines = changelog.split("\n");
const heading = lines.findIndex((l) => l.startsWith(`## [${version}]`));

if (heading === -1) {
  const unreleased = lines.some((l) => l.startsWith("## [Unreleased]"));
  notes.push(
    unreleased
      ? `CHANGELOG.md has no "## [${version}]" section; the notes will use "## [Unreleased]".`
      : `CHANGELOG.md has no "## [${version}]" section; the notes will come from the commit log.`,
  );
} else if (!changelog.includes(`\n[${version}]: `)) {
  notes.push(`CHANGELOG.md has no link definition for ${version}.`);
}

/* ── The manifest ─────────────────────────────────────────────────────────── */

const manifest = JSON.parse(await readFile("system.json", "utf8"));
if (manifest.version !== version) {
  // Not fatal for the build -- `tools/release.mjs` stamps it in CI -- but a
  // repository whose manifest disagrees with its tag is a repository nobody can
  // reason about from a checkout.
  problems.push(
    `system.json says version "${manifest.version}" but you are releasing "${version}". ` +
    `Run: npm run release:stamp -- ${version} zarex97/FGT_FVTT_v2`,
  );
}

/* ── Report ───────────────────────────────────────────────────────────────── */

for (const n of notes) console.warn(`note     ${n}`);

if (problems.length > 0) {
  for (const p of problems) console.error(`error    ${p}`);
  console.error(`\nFGT | ${problems.length} problem(s) — fix and COMMIT before tagging v${version}.`);
  process.exit(1);
}

console.log(`FGT | Ready to tag v${version}.${notes.length ? ` (${notes.length} note(s) above.)` : ""}`);
