/**
 * @file The sheet offers no Normal Attack to a Unit that cannot make one (#180).
 * @see module/apps/actor-sheet/context.mjs, templates/actor/overview.hbs
 *
 * Live: Pale Rider's sheet showed "Normal Attack" under Actions, previewed
 * "Medea 180–234 — Legal", and the press was refused: "Pale Rider cannot
 * perform Normal Attacks." The action bar has never offered the slot.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { hasGranted, GRANTS } from "../../module/rules/granted.mjs";

beforeAll(prepareSubjects, 60_000);

describe("the sheet's Normal Attack button", () => {
  it("is guarded by the same grant the action bar reads", () => {
    const template = readFileSync("templates/actor/overview.hbs", "utf8");
    expect(template).toMatch(/\{\{#if canNormalAttack\}\}\s*<button[^>]*data-action="normalAttack"/);
    const context = readFileSync("module/apps/actor-sheet/context.mjs", "utf8");
    expect(context).toMatch(/canNormalAttack: !hasGranted\(snapshot, GRANTS\.noNormalAttack\)/);
  });

  it("is hidden for Pale Rider and shown for Medea", async () => {
    const out = await withSubjects([
      { from: "pale-rider", id: "paleRiderSheet01", state: { factionId: "A" }, panel: { i: 2, j: 2 } },
      { from: "medea", id: "medeaSheet000001", state: { factionId: "B" }, panel: { i: 2, j: 3 } },
    ], ({ unit }) => [unit("paleRiderSheet01"), unit("medeaSheet000001")].map((u) => !hasGranted(u, GRANTS.noNormalAttack)));
    expect(out).toEqual([false, true]);
  });
});
