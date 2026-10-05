/**
 * @file Achilles's duel: who it encloses, and when it ends (#184 reading 4).
 * @see module/rules/bounded-fields.mjs#pushOutPlan, #duelDecided,
 *   module/engine/fields.mjs#openField, #closeDecidedDuels
 *
 * Ruled 2026-10-04. *"Achilles and the opposing Unit are enclosed within a 5x5
 * panel area"* -- the two and nobody else, so anyone else standing there is
 * moved to the nearest free panel outside, a forced move. And the default
 * defeat is one that sticks: a duellist revived fights on.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { pushOutPlan, duelDecided } from "../../module/rules/bounded-fields.mjs";
import { squareBounds } from "../../module/domain/geometry.mjs";

/** The 5x5 around (5,5). */
const AREA = [];
for (let i = 3; i <= 7; i += 1) for (let j = 3; j <= 7; j += 1) AREA.push({ i, j });

const unit = (id, i, j, over = {}) => ({ id, panel: { i, j }, kind: "servant", ...over });

describe("who the duel encloses", () => {
  it("keeps the two duellists and pushes everyone else to the nearest free panel outside", () => {
    const board = {
      bounds: squareBounds(13),
      units: [unit("achilles", 5, 5), unit("foe", 5, 6), unit("ally", 3, 4), unit("bystander", 6, 7)],
    };
    const plan = pushOutPlan(AREA, board, ["achilles", "foe"]);
    expect(plan).toEqual([
      // (3,4) is on the top edge: straight up is outside, and nearest.
      { unitId: "ally", from: { i: 3, j: 4 }, to: { i: 2, j: 4 } },
      { unitId: "bystander", from: { i: 6, j: 7 }, to: { i: 6, j: 8 } },
    ]);
  });

  it("never lands two on one panel, nor on someone standing outside", () => {
    const board = {
      bounds: squareBounds(13),
      units: [unit("a", 5, 5), unit("b", 5, 4), unit("x", 3, 3), unit("y", 3, 4), unit("wall", 2, 2)],
    };
    const plan = pushOutPlan(AREA, board, ["a", "b"]);
    const landed = plan.map((s) => `${s.to.i},${s.to.j}`);
    expect(new Set(landed).size).toBe(landed.length);
    expect(landed).not.toContain("2,2");
    for (const s of plan) expect(AREA.some((p) => p.i === s.to.i && p.j === s.to.j)).toBe(false);
  });

  it("stays on the board", () => {
    const corner = [];
    for (let i = 0; i <= 4; i += 1) for (let j = 0; j <= 4; j += 1) corner.push({ i, j });
    const plan = pushOutPlan(corner, { bounds: squareBounds(13), units: [unit("a", 2, 2), unit("z", 0, 0)] }, ["a"]);
    expect(plan[0].to.i).toBeGreaterThanOrEqual(0);
    expect(plan[0].to.j).toBeGreaterThanOrEqual(0);
    expect(Math.max(plan[0].to.i, plan[0].to.j)).toBe(5);
  });

  it("leaves objects where they are", () => {
    const board = {
      bounds: squareBounds(13),
      units: [unit("a", 5, 5), unit("cache", 4, 4, { kind: "structure" })],
    };
    expect(pushOutPlan(AREA, board, ["a"])).toEqual([]);
  });
});

describe("when the duel ends", () => {
  const field = {
    vulnerabilities: [{ kind: "duellistDefeat", result: "end" }],
    state: { duellistIds: ["achilles", "foe"] },
  };

  it("at a duellist's defeat", () => {
    expect(duelDecided(field, (id) => id === "foe")).toBe(true);
    expect(duelDecided(field, () => false)).toBe(false);
  });

  it("not at anyone else's", () => {
    expect(duelDecided(field, (id) => id === "bystander")).toBe(false);
  });

  it("only on a field that watches for it", () => {
    expect(duelDecided({ ...field, vulnerabilities: [] }, () => true)).toBe(false);
  });

  it("is read after the Process, so a revived duellist fights on", () => {
    const src = readFileSync("module/engine/attack.mjs", "utf8");
    const at = src.indexOf("await closeDecidedDuels();");
    expect(at).toBeGreaterThan(src.indexOf("if (process.isComplete(state)) {\n    await endConcealmentAfterAttack(state);"));
    const fields = readFileSync("module/engine/fields.mjs", "utf8");
    expect(fields).toMatch(/game\.actors\.get\(id\)\?\.system\?\.defeated/);
  });
});

describe("the content", () => {
  const np = parse(readFileSync("packs/_source/abilities/achilles-diatrekhon-aster-lonkhe.yml", "utf8"));

  it("encloses the duellists only and ends at a defeat", () => {
    expect(np.field.membership).toMatchObject({ trappedAtActivation: true, enclosesOnly: "duellists" });
    expect(np.field.vulnerabilities).toContainEqual({ kind: "duellistDefeat", result: "end" });
    // The owner's control stays, for terms the two players agreed.
    expect(np.field.deactivation).toEqual({ byOwner: true });
  });
});
