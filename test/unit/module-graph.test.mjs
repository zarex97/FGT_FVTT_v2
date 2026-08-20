/**
 * @file Every import in the system resolves to a file that exists.
 * @see docs/21-system-skeleton.md
 *
 * A mistyped relative path is a **black screen**: the browser fails to fetch
 * the module, `fgt.mjs` never finishes evaluating, no hook registers, and
 * Foundry renders nothing with one 404 in a console nobody has open. That is
 * how `v0.2.10` shipped.
 *
 * Node cannot import these files to find out — they reference `game`, `Hooks`
 * and `foundry` at module scope — so the graph is checked as text. Templates
 * referenced from `PARTS` are checked the same way and for the same reason: a
 * missing `.hbs` is a render-time throw inside an already-open sheet.
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { PACKS } from "../../tools/lib/content.mjs";

/** @param {string} dir @returns {string[]} */
function mjsUnder(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return mjsUnder(path);
    return e.name.endsWith(".mjs") ? [path] : [];
  });
}

/**
 * Packs `system.json` declares that nothing compiles yet.
 *
 * `rules` is the Rules Reference journal — the 44 chapters as in-world
 * compendium entries. It is declared, so Foundry creates an **empty**
 * compendium for it, which reads as "the rules are missing" rather than as
 * "not built yet". Recorded here rather than silently allowed, so the list
 * shrinks instead of growing.
 */
const UNBUILT_PACKS = new Set(["rules"]);

/**
 * Entry points `system.json` names that a build step generates, mapped to the
 * source that produces each.
 *
 * These are gitignored: a fresh clone does not have them, and neither does CI
 * at the point `npm test` runs. Checking the **source** is what a pre-build
 * test can honestly assert -- a stylesheet pointed at a `.scss` nobody ships
 * fails here, while a merely unbuilt one does not.
 */
const GENERATED = Object.freeze({ "styles/fgt.css": "styles/src/fgt.scss" });

describe("the module graph", () => {
  const files = mjsUnder("module");

  it("has files to check", () => {
    // A scan that silently matched nothing would pass every assertion below.
    expect(files.length).toBeGreaterThan(30);
  });

  it("resolves every relative import, static and dynamic", () => {
    /** @type {string[]} */
    const broken = [];

    for (const file of files) {
      const src = readFileSync(file, "utf8");
      const specifiers = [
        ...src.matchAll(/(?:^|\s)(?:import|export)\s[^;]*?from\s+["'](\.[^"']+)["']/g),
        ...src.matchAll(/\bimport\(\s*["'](\.[^"']+)["']\s*\)/g),
      ].map((m) => m[1]);

      for (const spec of specifiers) {
        const target = resolve(dirname(file), spec);
        if (!existsSync(target)) broken.push(`${file} → ${spec}`);
      }
    }

    expect(broken).toEqual([]);
  });

  it("resolves every template a PARTS block names", () => {
    /** @type {string[]} */
    const broken = [];

    for (const file of files) {
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(/template:\s*["']systems\/fgt\/([^"']+)["']/g)) {
        if (!existsSync(m[1])) broken.push(`${file} → ${m[1]}`);
      }
    }

    expect(broken).toEqual([]);
  });

  it("declares every entry point that the repository itself carries", () => {
    // `esmodules`, `styles` and `languages` are fetched by Foundry before
    // anything of ours runs, so a stale path is the earliest possible failure.
    //
    // Only the paths the repo CARRIES are checked here. A build artifact does
    // not exist yet at test time -- both workflows run `npm test` before
    // `build:styles`, deliberately, so a broken build never reaches a release
    // -- and asserting it would test the pipeline's ordering rather than the
    // manifest. `tools/check-manifest.mjs` makes the same assertion for real,
    // after the build, which is the only point at which it means anything.
    const manifest = JSON.parse(readFileSync("system.json", "utf8"));
    const declared = [
      ...(manifest.esmodules ?? []),
      ...(manifest.styles ?? []),
      ...(manifest.languages ?? []).map((l) => l.path),
    ];

    for (const path of declared) {
      const source = GENERATED[path] ?? path;
      expect(existsSync(source), `system.json names ${path}, and ${source} does not exist`).toBe(true);
    }
  });

  it("builds every generated entry point from the source it claims", () => {
    // The map above is only worth having if it cannot go stale, so it is held
    // against the build script that actually produces each artifact. Renaming
    // either side without the other now fails here rather than at release.
    const scripts = JSON.parse(readFileSync("package.json", "utf8")).scripts ?? {};
    const all = Object.values(scripts).join(" ");

    for (const [artifact, source] of Object.entries(GENERATED)) {
      expect(all, `no build script produces ${artifact}`).toContain(artifact);
      expect(all, `no build script consumes ${source}`).toContain(source);
    }
  });

  it("can rebuild every pack system.json declares", () => {
    // The compiled packs are gitignored, so a fresh clone has only the YAML.
    // A declared pack that no source directory feeds is one that can never be
    // rebuilt -- its contents would exist only in whatever LevelDB happened to
    // be committed, which is the state this project deliberately does not keep.
    const manifest = JSON.parse(readFileSync("system.json", "utf8"));
    const sources = new Set(Object.values(PACKS).map((p) => p.pack));

    for (const pack of manifest.packs ?? []) {
      if (UNBUILT_PACKS.has(pack.name)) continue;
      expect(sources.has(pack.name), `pack "${pack.name}" has no source directory`).toBe(true);
    }
  });
});
