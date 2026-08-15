/**
 * @file The changelog must never be able to block a release.
 * @see tools/release-notes.mjs, .github/workflows/release.yml
 *
 * This used to be a real failure: `release-notes.mjs` exited non-zero when
 * `CHANGELOG.md` had no `## [x.y.z]` section, and the workflow reads the file
 * **at the tagged commit** — where it cannot be fixed. A missing heading meant
 * deleting and re-pushing a tag. `v0.2.0` failed that way twice.
 *
 * The fallback chain that replaced it is only worth having if it stays intact,
 * so these tests hold it in place: a version with no section must still produce
 * usable notes and exit 0.
 */

import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Run the generator and hand back what it wrote. */
function notesFor(version) {
  const dir = mkdtempSync(join(tmpdir(), "fgt-notes-"));
  const out = join(dir, "RELEASE_NOTES.md");
  try {
    // Throws on a non-zero exit, which is exactly the regression to catch.
    execFileSync("node", ["tools/release-notes.mjs", version, out], { encoding: "utf8", stdio: "pipe" });
    return readFileSync(out, "utf8");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("release notes", () => {
  it("uses the section written for the version when there is one", () => {
    // 0.2.12 has its own `## [0.2.12]` heading in the changelog.
    expect(notesFor("0.2.12")).toContain("Asterios");
  });

  it("still produces notes for a version with no section", () => {
    // The property that matters: an unreleased version number must not be able
    // to fail the build. What it falls back TO is a judgement call; that it
    // falls back at all is not.
    expect(notesFor("99.99.99").trim().length).toBeGreaterThan(0);
  });

  it("exits zero for a version with no section", () => {
    // `execFileSync` throws on a non-zero exit, so reaching the assertion is
    // the assertion. Stated explicitly because it is the whole point.
    expect(() => notesFor("99.99.99")).not.toThrow();
  });

  it("never emits an empty file, which would publish a blank release", () => {
    for (const v of ["0.2.12", "0.2.1", "99.99.99"]) {
      expect(notesFor(v).trim(), `${v} produced no notes`).not.toBe("");
    }
  });
});

describe("the changelog's structure", () => {
  const changelog = readFileSync("CHANGELOG.md", "utf8");

  it("keeps an Unreleased section for the next release to accumulate into", () => {
    expect(changelog).toContain("## [Unreleased]");
  });

  it("never leaves a bare placeholder in that section", () => {
    // Accumulating real entries here between releases is correct — that is
    // what shipped 0.2.2 through 0.2.11, via the `[Unreleased]` fallback. What
    // must never appear is a placeholder like "Nothing yet.", because
    // `release-notes.mjs` would publish it verbatim as the release notes for
    // any version lacking its own section. Empty is fine; prose alone is not.
    const body = changelog.split("## [Unreleased]")[1].split("\n## [")[0]
      .replace(/-{3,}/g, "").trim();

    if (body === "") return;
    expect(body, "Unreleased has prose but no entries").toMatch(/^(###\s|-\s)/m);
  });

  it("gives every released version a link definition", () => {
    const versions = [...changelog.matchAll(/^## \[(\d+\.\d+\.\d+)\]/gm)].map((m) => m[1]);
    const undefined_ = versions.filter((v) => !changelog.includes(`\n[${v}]: http`));

    expect(undefined_, `no link definition for: ${undefined_.join(", ")}`).toEqual([]);
  });
});
