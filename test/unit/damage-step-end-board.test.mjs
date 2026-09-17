/**
 * @file Which snapshot `damageStepEnd` asks about the attacker.
 * @see module/engine/attack.mjs, docs/46-roster-re-audit.md §46.4-AF
 *
 * Sikera Ušum rule a: *"Semiramis' Normal Attacks which use Base Attack (STR)
 * inflict Poison."* It is an `OnEvent` on `damageStepEnd` predicated on
 * `["self:inField:semiramis-sikera-usum", "attack:kind:normal",
 * "attack:component:str"]`, and the file's own comment records that
 * `self:inField:` had to be added to `DEFERRED_PREFIXES` because it is *"a
 * board annotation, unknowable at contributionsOf's actor-only pass"*.
 *
 * Deferring it was right and not enough: `fireDamageStepEnd` built both
 * subjects with `unitSnapshot(actor)`, which is exactly the actor-only pass the
 * comment warns about. A snapshot has no `fields`, so the deferred predicate
 * was evaluated against an option set that could never contain
 * `self:inField:` — and the clause failed on every attack.
 *
 * Measured live, Semiramis standing in her own Throne Room and landing a
 * Range-1 `BA(STR)` Normal Attack on a Servant beside her:
 *
 * ```
 * board unit   fields: ["semiramis-sikera-usum"]  →  self:inField:… emitted
 * unitSnapshot fields: (absent)                   →  self:inField:… absent
 * ```
 *
 * The third of a family: §46.4-V (a hand-assembled subject answering `null` for
 * `stance`), §46.4-AC (a rebuilt board that had forgotten the Turn), and this.
 * A snapshot is not a board, and a board question asked of one is answered
 * "no" rather than refused.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const attack = readFileSync("module/engine/attack.mjs", "utf8");
const body = (() => {
  const i = attack.indexOf("async function fireDamageStepEnd");
  return attack.slice(i, attack.indexOf("\n}", i));
})();

describe("fireDamageStepEnd asks the board, not a bare snapshot", () => {
  it("builds the attacker from the board when the board knows it", () => {
    expect(body).toMatch(/unitFrom\(board, /);
  });

  it("builds the defender the same way, so `target:inField:` works too", () => {
    expect((body.match(/unitFrom\(board, /g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("still falls back to unitSnapshot for a unit the board has no row for", () => {
    expect(body).toMatch(/\?\?\s*unitSnapshot\(/);
  });

  it("computes the board once and reuses it for the context", () => {
    // Not `board: currentBoard()` a second time: two boards in one event is two
    // answers to one question, which is what §46.4-AC was.
    expect((body.match(/currentBoard\(\)/g) ?? []).length).toBe(1);
  });
});
