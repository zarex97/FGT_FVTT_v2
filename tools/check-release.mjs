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

if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
  problems.push(`"${version}" is not a semver version. Pass it without the leading "v".`);
}

/* ── The changelog section the release notes are cut from ─────────────────── */

const changelog = await readFile("CHANGELOG.md", "utf8");
const lines = changelog.split("\n");
const heading = lines.findIndex((l) => l.startsWith(`## [${version}]`));

if (heading === -1) {
  const unreleased = lines.some((l) => l.startsWith("## [Unreleased]"));
  problems.push(
    `CHANGELOG.md has no "## [${version}]" section.` +
    (unreleased
      ? ` There is an "## [Unreleased]" section — rename it to "## [${version}] — <date>".`
      : " Add one before tagging."),
  );
} else {
  // An empty section produces empty release notes, which the workflow will
  // happily publish. Better to catch it here than to ship a blank release.
  let end = lines.length;
  for (let k = heading + 1; k < lines.length; k++) {
    if (lines[k].startsWith("## ")) { end = k; break; }
  }
  const body = lines.slice(heading + 1, end).join("\n").replace(/^\s*---\s*$/gm, "").trim();
  if (body.length === 0) problems.push(`The "## [${version}]" section is empty.`);

  if (!changelog.includes(`\n[${version}]: `)) {
    problems.push(
      `CHANGELOG.md has no link definition for ${version}. ` +
      `Add "[${version}]: https://github.com/zarex97/FGT_FVTT_v2/releases/tag/v${version}" at the end.`,
    );
  }
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

if (problems.length > 0) {
  for (const p of problems) console.error(`error    ${p}`);
  console.error(`\nFGT | ${problems.length} problem(s) — fix and COMMIT before tagging v${version}.`);
  process.exit(1);
}

console.log(`FGT | Ready to tag v${version}.`);
