#!/usr/bin/env node
/**
 * @file Write release notes for a version. Never fails.
 *
 * This used to exit non-zero when `CHANGELOG.md` had no `## [x.y.z]` section,
 * which made the changelog a **release blocker**: the workflow reads the file
 * at the tagged commit, a tag cannot be edited, and so a missing heading meant
 * deleting and re-pushing the tag. That is a documentation chore standing
 * between a green build and a published artefact, and it is not worth it.
 *
 * Now the changelog is an *input*, not a gate. Best notes available, in order:
 *
 *   1. `## [<version>]` — the section written for this release.
 *   2. `## [Unreleased]` — the section that was clearly meant to be it.
 *   3. The commit subjects since the previous tag.
 *   4. A one-line placeholder.
 *
 * The build still fails on lint, content and test failures. It no longer fails
 * on prose.
 */

import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const [version, out = "RELEASE_NOTES.md"] = process.argv.slice(2);
if (!version) {
  console.error("usage: node tools/release-notes.mjs <version> [outfile]");
  process.exit(1);
}

const body = (await fromChangelog(version)) ?? fromGit(version) ?? placeholder(version);
await writeFile(out, `${body}\n`);
console.log(`FGT | Wrote ${out} (${body.split("\n").length} lines) for ${version}`);

/* -------------------------------------------------------------------------- */

/**
 * The changelog section for this version, or the `Unreleased` one.
 *
 * @param {string} v
 * @returns {Promise<string|null>}
 */
async function fromChangelog(v) {
  /** @type {string} */
  let changelog;
  try {
    changelog = await readFile("CHANGELOG.md", "utf8");
  } catch {
    console.warn("FGT | No CHANGELOG.md; falling back to the commit log.");
    return null;
  }

  const lines = changelog.split("\n");
  for (const heading of [`## [${v}]`, "## [Unreleased]"]) {
    const start = lines.findIndex((l) => l.startsWith(heading));
    if (start === -1) continue;

    let end = lines.length;
    for (let k = start + 1; k < lines.length; k++) {
      if (lines[k].startsWith("## ")) { end = k; break; }
    }
    const section = lines.slice(start + 1, end).join("\n").replace(/^\s*---\s*$/gm, "").trim();
    if (section.length === 0) continue;

    if (heading !== `## [${v}]`) {
      console.warn(`FGT | No "## [${v}]" section; using "## [Unreleased]" instead.`);
    }
    return section;
  }

  console.warn(`FGT | No usable changelog section for ${v}; falling back to the commit log.`);
  return null;
}

/**
 * Commit subjects since the previous tag. Merge commits are dropped: they say
 * what was combined, not what changed.
 *
 * @param {string} v
 * @returns {string|null}
 */
function fromGit(v) {
  try {
    const previous = execFileSync(
      "git",
      ["describe", "--tags", "--abbrev=0", "--exclude", `v${v}`, "HEAD"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();

    const log = execFileSync(
      "git",
      ["log", "--no-merges", "--pretty=format:- %s", `${previous}..HEAD`],
      { encoding: "utf8" },
    ).trim();

    if (!log) return null;
    return `### Changes since ${previous}\n\n${log}`;
  } catch {
    return null;
  }
}

/**
 * @param {string} v
 * @returns {string}
 */
function placeholder(v) {
  return `Release ${v}. See [CHANGELOG.md](CHANGELOG.md) for details.`;
}
