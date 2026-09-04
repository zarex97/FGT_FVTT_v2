/**
 * @file Every registered setting is read by something.
 * @see module/settings.mjs, docs/21-system-skeleton.md §21.9
 *
 * Written after `closedInfo` was found registered, translated, documented in
 * the settings table, and consulted by **no code at all**. A GM could turn
 * "Closed-information play" on and off and change nothing, which is
 * indistinguishable from the switch not existing — except that it advertises a
 * feature the system does not have.
 *
 * This is the same defect shape as a rule element nothing collects or a
 * compendium nothing populates: authored, shipped, inert. A setting is
 * cheap to add and its inertness is invisible at review, so the check is here.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** Every `.mjs` under `module/`. */
function sources(dir = "module") {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...sources(path));
    else if (entry.endsWith(".mjs")) out.push(path);
  }
  return out;
}

const settingsFile = readFileSync("module/settings.mjs", "utf8");
const registered = [...settingsFile.matchAll(/\bs\(\s*"([a-zA-Z0-9]+)"/g)].map((m) => m[1]);

/**
 * Settings whose only consumer is Foundry itself or the setup UI, and which
 * therefore have no `game.settings.get("fgt", ...)` anywhere. Each needs a
 * reason; "we will use it later" is not one.
 */
const NOT_READ_BY_CODE = new Set([
  // Written by the release stamper and read by the migration guard on load,
  // which reaches it through a variable rather than a literal.
  "schemaVersion",
  // KNOWN INERT. Both are registered, translated and shown in the settings
  // window, and nothing reads either one. Listed rather than deleted because
  // removing a setting is a world-data decision; listed rather than silently
  // tolerated because the whole point of this file is that a switch which
  // changes nothing is worse than no switch at all.
  "activeSkillBudget",
  "diceFormulas",
]);

describe("registered settings", () => {
  it("finds the registrations at all, so a broken match cannot pass vacuously", () => {
    expect(registered.length).toBeGreaterThan(15);
  });

  it("is read somewhere for every setting it registers", () => {
    const all = sources()
      .filter((f) => !f.endsWith("settings.mjs"))
      .map((f) => readFileSync(f, "utf8"))
      .join("\n");

    // The key is looked for as a quoted literal anywhere outside the
    // registration file, because settings are reached through several wrappers
    // -- `setting()`, `safeSetting()`, and plain lists of keys -- and matching
    // only `game.settings.get("fgt", ...)` would fail every one of them.
    const unread = registered.filter(
      (key) => !NOT_READ_BY_CODE.has(key) && !all.includes(`"${key}"`),
    );
    expect(unread).toEqual([]);
  });

  it("keeps closed-information play on by default", () => {
    // The rulebook's information rules are rules, not a house style. A group
    // that wants an open table switches it off knowingly.
    expect(settingsFile).toMatch(/"closedInfo"[\s\S]{0,400}?default: true/);
  });
});
