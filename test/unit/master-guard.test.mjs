/**
 * @file Attacking a Master whose Servant is within 2 panels: the rulebook's three cases (#181).
 * @see module/rules/master-guard.mjs, module/engine/master-guard.mjs, module/rules/targeting/resolve.mjs
 *
 * Ruled 2026-10-04. Case 1: a guard within 2 of the Master and in the
 * attacker's Range, so only the guard may be targeted (the attacker picks).
 * Case 2: a guard adjacent but out of Range takes the Attack at the start of
 * the Combat Phase (nearest the attacker). Case 3: guards within 2 check in
 * turn, nearest the Master first, and the first to pass steps in beside it.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { guardsInRange, guardCase, guardLanding } from "../../module/rules/master-guard.mjs";
import { resolveTargets } from "../../module/rules/targeting/resolve.mjs";
import { targetSpecFor } from "../../module/rules/ability-use.mjs";

beforeAll(prepareSubjects, 60_000);

const M = "masterGuarded001";
const AU = "attackerHeracles";
const G1 = "guardAchilles001";
const G2 = "guardCastor00001";

/** Heracles (Range 1) at (2,2); the Master at (2,6); guards wherever given. */
const at = (guards, fn, extra = []) => withSubjects([
  { from: "heracles", id: AU, state: { factionId: "A" }, panel: { i: 2, j: 2 } },
  { from: "master-advanced", id: M, state: { factionId: "B" }, panel: { i: 2, j: 6 } },
  ...guards.map(([id, from, i, j, state = {}]) => ({ from, id, state: { factionId: "B", ...state }, panel: { i, j } })),
  ...extra,
], fn);

describe("case 1: a guard within the attacker's Range", () => {
  it("leaves only the guard targetable", async () => {
    const out = await at([[G1, "achilles", 2, 4]], ({ unit, board }) => ({
      inRange: guardsInRange(unit(M), unit(AU), board, 3).map((g) => g.id),
      aimed: resolveTargets(targetSpecFor(null, 5, null, unit(AU)), unit(AU), board, { unitId: M }).errors.join(" "),
    }));
    expect(out.inRange).toEqual([G1]);
    expect(out.aimed).toMatch(/guarded by a Servant within your Range/);
  });
});

describe("case 2: an adjacent guard out of Range", () => {
  it("lets the Master be targeted, and on a tie the first in board order takes it", async () => {
    // Both on the far side of the Master, five panels from Heracles; his Range 4 reaches the Master only.
    const out = await at([[G1, "achilles", 1, 7], [G2, "castor", 3, 7]], ({ unit, board }) => ({
      aimed: resolveTargets(targetSpecFor(null, 4, null, unit(AU)), unit(AU), board, { unitId: M }).errors,
      decision: guardCase(unit(M), unit(AU), board),
    }));
    expect(out.aimed.join(" ")).not.toMatch(/guarded/);
    expect(out.decision).toEqual({ kind: "redirect", guardId: G1 });
  });

  it("the adjacent guard nearest the attacker takes it", async () => {
    const out = await at([[G1, "achilles", 1, 7], [G2, "castor", 3, 6]], ({ unit, board }) => guardCase(unit(M), unit(AU), board));
    expect(out).toEqual({ kind: "redirect", guardId: G2 });
  });
});

describe("case 3: guards within 2, neither in Range nor adjacent", () => {
  it("check nearest the Master first, ties nearest the attacker", async () => {
    // Both two panels from the Master; Castor nearer Heracles.
    const out = await at([[G1, "achilles", 0, 8], [G2, "castor", 4, 4]], ({ unit, board }) => guardCase(unit(M), unit(AU), board));
    expect(out).toEqual({ kind: "check", order: [G2, G1] });
  });

  it("a guard that cannot Move makes no check", async () => {
    const out = await withSubjects([
      { from: "heracles", id: AU, state: { factionId: "A" }, panel: { i: 2, j: 2 } },
      { from: "master-advanced", id: M, state: { factionId: "B" }, panel: { i: 2, j: 6 } },
      { from: "castor", id: G2, state: { factionId: "B" }, panel: { i: 4, j: 4 }, effects: [{ defId: "immobilize" }] },
    ], ({ unit, board }) => guardCase(unit(M), unit(AU), board));
    expect(out).toEqual({ kind: "none" });
  });

  it("steps onto the free panel next to the Master nearest itself, ties nearest the attacker", async () => {
    const out = await at([[G2, "castor", 4, 4]], ({ unit, board }) =>
      guardLanding(unit(G2), unit(M), unit(AU), board, () => true));
    expect(out).toEqual({ i: 3, j: 5 });
  });

  it("with no free panel next to the Master, has nowhere to go", async () => {
    const out = await at([[G2, "castor", 4, 4]], ({ unit, board }) =>
      guardLanding(unit(G2), unit(M), unit(AU), board, () => false));
    expect(out).toBeNull();
  });
});

describe("who guards", () => {
  it("Pale Rider's Kagome Spirits guard his Master; he does not", async () => {
    const out = await withSubjects([
      { from: "heracles", id: AU, state: { factionId: "A" }, panel: { i: 2, j: 2 } },
      { from: "master-advanced", id: M, state: { factionId: "B" }, panel: { i: 2, j: 6 } },
      { from: "pale-rider", id: "paleRiderGuard01", state: { factionId: "B", masterId: M }, panel: { i: 2, j: 7 } },
    ], ({ unit, board }) => guardCase(unit(M), unit(AU), board));
    expect(out).toEqual({ kind: "none" });
  });
});

describe("the declaration", () => {
  it("runs the guard step on a targeted Attack, never on a Counter", () => {
    const src = readFileSync("module/engine/attack.mjs", "utf8");
    expect(src).toMatch(/if \(!isCounter && targetIds\.length === 1 && aimedAt === targetIds\[0\]\) \{\s*const \{ guardMasterTarget \}/);
  });
});
