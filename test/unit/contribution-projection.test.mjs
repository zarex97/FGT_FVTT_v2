/**
 * @file Contributions that were collected and never handed to anyone.
 * @see module/rules/snapshot.mjs, docs/46-roster-re-audit.md §46.4-AI
 *
 * `collectContributions` fills a bucket per element kind, and the snapshot
 * projects those buckets onto the unit — `immunities`, `applicationChances`,
 * `checkModifiers` and the rest are all listed there explicitly. Two were not:
 * `vulnerabilityAmplifiers` and `periodicOverrides`.
 *
 * Both reached a unit by exactly one route: `rules/bounded-fields.mjs`'s
 * `annotateFields`, which appends them from a FIELD's interior rules. So the
 * elements worked perfectly inside Sikera Ušum's Throne Room and did nothing at
 * all anywhere else — an ability or an effect contributing either one was
 * collected, projected nowhere, and read by nobody.
 *
 * Van Gogh's *Channel Marker Soul* is the live casualty:
 * `{ key: VulnerabilityAmplifier, effectId: curse, factor: 0.5 }` on an ability,
 * which is a HALVING of Curse damage that has never once applied.
 *
 * Found authoring `weakToPoison` to give Sikera Ušum clause e something to
 * meet: the new effect's own amplifier was collected and absent from the board
 * unit, while the field's sat there beside it.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { collectContributions } from "../../module/rules/elements.mjs";

const snapshot = readFileSync("module/rules/snapshot.mjs", "utf8");

describe("the snapshot projects every bucket something reads", () => {
  it("projects vulnerabilityAmplifiers", () => {
    expect(snapshot).toMatch(/vulnerabilityAmplifiers:\s*contributions\.vulnerabilityAmplifiers/);
  });

  it("projects periodicOverrides", () => {
    expect(snapshot).toMatch(/periodicOverrides:\s*contributions\.periodicOverrides/);
  });

  it("still projects the buckets that already worked", () => {
    expect(snapshot).toMatch(/immunities:\s*contributions\.immunities/);
    expect(snapshot).toMatch(/applicationChances:\s*contributions\.applicationChances/);
    expect(snapshot).toMatch(/checkModifiers:\s*contributions\.checkModifiers/);
  });
});

describe("the buckets are genuinely filled, so the projection has something to carry", () => {
  it("collects a VulnerabilityAmplifier from an effect's own rules", () => {
    const out = collectContributions([{
      id: "e", name: "Poison Weakness", rank: null, active: true, fromEffect: true,
      rules: [{ key: "VulnerabilityAmplifier", effectId: "poison", factor: 1.5 }],
    }]);
    expect(out.vulnerabilityAmplifiers).toEqual([
      { effectId: "poison", polarity: null, factor: 1.5, source: "Poison Weakness" },
    ]);
  });

  it("collects a PeriodicOverride the same way", () => {
    const out = collectContributions([{
      id: "e", name: "Some Zone", rank: null, active: true,
      rules: [{ key: "PeriodicOverride", effectId: "poison" }],
    }]);
    expect(out.periodicOverrides).toHaveLength(1);
    expect(out.periodicOverrides[0].effectId).toBe("poison");
  });
});
