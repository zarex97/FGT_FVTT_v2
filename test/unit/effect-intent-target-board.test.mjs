/**
 * @file Which snapshot an applied effect is tested against.
 * @see module/engine/applier.mjs, docs/46-roster-re-audit.md §46.4-AG
 *
 * Sikera Ušum rule d: *"When a Unit with Poison Immune effects is in this NP
 * area, the Poison Immune effect is reduced to a Poison Resist effect, the
 * chance of being inflicted with Poison is reduced by 75%."*
 *
 * Every piece of it existed. `ImmunityDowngrade` produces a suppression,
 * `annotateFields` writes it onto the units standing in the area, and
 * `effect-applier.mjs`'s `immunityDowngradeFor` reads `target.suppressions` at
 * the immunity gate and lets the application through when one matches.
 *
 * The intent path built its subject with `unitSnapshot(target)` — an actor-only
 * pass with no `suppressions`, because suppressions are a BOARD annotation. So
 * the downgrade was never found and the immunity blocked absolutely.
 *
 * Measured live: Hassan of Serenity (*"Serenity is Immune to Poison and Deadly
 * Poison"*, authored as `Immunity: [poison, deadlyPoison]`) standing in the
 * Throne Room, hit fourteen times by Semiramis's `BA(STR)` Normal Attack, which
 * inflicts Poison inside the area. **0 of 14 landed** — against ~25% expected
 * from a downgraded immunity, so 0/14 is a 1.8% outcome — while her board row
 * carried the suppression in full:
 *
 * ```
 * suppressions: [{ scope: "immunity", effectId: "poison",
 *                  downgradeTo: "poisonResist", resistPercent: 75 }]
 * immunities:   ["poison", "deadlyPoison"]        ← still absolute
 * ```
 *
 * The same shape as §46.4-AF, one layer down: a board question asked of a
 * snapshot is answered "no" rather than refused. `resistOf` reads
 * `unit.suppressions` too, for the clause's other half (*"Units with Poison
 * Resist effects that are not Poison Immune ... have the magnitude halved"*),
 * so both halves were dead for the same reason.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const applier = readFileSync("module/engine/applier.mjs", "utf8");

describe("the intent path tests against the board's unit", () => {
  it("prefers unitFrom(board, …) over a bare snapshot", () => {
    expect(applier).toMatch(/unitFrom\(\s*board\s*,\s*target\s*\)/);
  });

  it("still falls back to unitSnapshot for a unit with no board row", () => {
    expect(applier).toMatch(/unitFrom\([^)]*\)\s*\?\?\s*unitSnapshot\(target\)/);
  });

  it("builds the board once for the batch, not once per intent", () => {
    // `applyIntents` walks every intent in a batch; a `currentBoard()` inside
    // the loop would rebuild the whole board per effect applied.
    const fn = applier.slice(applier.indexOf("mergeStages(intents)"));
    const loop = fn.slice(0, fn.indexOf("return out"));
    expect(loop).not.toMatch(/currentBoard\(\)/);
  });
});
