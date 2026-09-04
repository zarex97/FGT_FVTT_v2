/**
 * @file One owner per class name.
 * @see styles/src/, docs/29-user-interface.md §29.9
 *
 * Written after `.fgt-bar` was defined twice: `_shell.scss` had owned it for
 * the actor sheet's Health, Agility and Luck bars since the sheet was built,
 * and the action bar took the same name in `_apps.scss`. The later block sets
 * `position: fixed`, so every resource bar on every character sheet was ripped
 * out of its header and pinned to the bottom of the SCREEN at 1500px wide.
 *
 * Nothing caught it. The stylesheet compiled, the templates checked out, and
 * 2564 tests passed — a CSS collision is invisible to all three. It was
 * reported from play as "a weird bottom bar with two boxes".
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";

/** Every top-level `.class {` in a partial, mapped to the partials defining it. */
function owners() {
  const files = readdirSync("styles/src").filter((f) => f.endsWith(".scss") && f !== "fgt.scss");
  /** @type {Map<string, Set<string>>} */
  const map = new Map();
  for (const file of files) {
    const source = readFileSync(`styles/src/${file}`, "utf8");
    for (const match of source.matchAll(/^\.([a-zA-Z0-9_-]+)\s*\{/gm)) {
      if (!map.has(match[1])) map.set(match[1], new Set());
      map.get(match[1]).add(file);
    }
  }
  return map;
}

describe("stylesheet ownership", () => {
  it("gives every top-level class exactly one owning partial", () => {
    // Two partials defining the same class is a collision waiting to be found
    // in play: the later one silently wins, and which is later depends on the
    // import order in `fgt.scss`.
    const shared = [...owners()]
      .filter(([, files]) => files.size > 1)
      .map(([cls, files]) => `${cls} in ${[...files].sort().join(" and ")}`);
    expect(shared).toEqual([]);
  });

  it("keeps the action bar and the sheet's resource bars apart by name", () => {
    // The specific collision this test was written for. `.fgt-bar` is the
    // sheet's; the action bar is `.fgt-actionbar`.
    const map = owners();
    expect([...(map.get("fgt-bar") ?? [])]).toEqual(["_shell.scss"]);
    expect([...(map.get("fgt-actionbar") ?? [])]).toEqual(["_apps.scss"]);
  });

  it("finds classes at all, so a broken parse cannot pass vacuously", () => {
    expect(owners().size).toBeGreaterThan(50);
  });
});
