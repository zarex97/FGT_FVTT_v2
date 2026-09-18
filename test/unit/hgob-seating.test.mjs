/**
 * @file Where the Hanging Gardens puts the people it lifts.
 * @see docs/46-roster-re-audit.md §46.14.6, module/engine/hgob.mjs
 *
 * > *"When HGoB is activated, place the HGoB token on the panel where Semiramis
 * > was standing; **and she is Moved to the middle panel of HGoB**, and all
 * > allied Units of your choice are transported to any panel within the HGoB."*
 *
 * She was not. She stayed on the panel the token was anchored to, which for a
 * top-left-anchored footprint is its **corner** — the one panel guaranteed to
 * be on the rim, and guaranteed to be outside the Throne Room. That made
 * Sikera Ušum's DSC branch, which is *"only within the Throne Room"*,
 * unreachable for the Servant whose Noble Phantasm it is.
 *
 * The arithmetic was never wrong. `seatRiders` computed the middle correctly
 * and always had; it then looked the rider's token up through
 * `getActiveTokens()`, which reads the canvas **placeable** layer — and it runs
 * immediately after a 9×9 token has been created and every rider reassigned to
 * a new level, so the layer is mid-redraw and answers `[]` for a Unit whose
 * token plainly exists. A falsy-`token` guard then skipped the owner in
 * silence.
 *
 * So the decision is pure and is tested here; the token lookup is four lines of
 * I/O beside it and is guarded by reading the source, below.
 */

import { readFileSync } from "node:fs";

import { describe, it, expect } from "vitest";

import { seatingPlan } from "../../module/engine/hgob.mjs";

/** The Hanging Gardens' own footprint. */
const HGOB = { w: 9, h: 9 };
const panelOf = (plan, unitId) => plan.find((p) => p.unitId === unitId)?.panel ?? null;

describe("seatingPlan", () => {
  it("puts the owner on the middle panel, not the anchor", () => {
    // Both measured live before the fix: activated at (0,0) she stayed at
    // (0,0), and activated at (5,5) she stayed at (5,5).
    expect(panelOf(seatingPlan({ i: 0, j: 0 }, HGOB, ["semiramis"]), "semiramis"))
      .toEqual({ i: 4, j: 4 });
    expect(panelOf(seatingPlan({ i: 5, j: 5 }, HGOB, ["semiramis"]), "semiramis"))
      .toEqual({ i: 9, j: 9 });
  });

  it("puts the owner inside the Throne Room, which is the point", () => {
    // The middle 5x5 of the footprint. Sikera Usum's DSC branch gates on it.
    const origin = { i: 3, j: 3 };
    const { i, j } = panelOf(seatingPlan(origin, HGOB, ["semiramis"]), "semiramis");
    expect(i).toBeGreaterThanOrEqual(origin.i + 2);
    expect(i).toBeLessThanOrEqual(origin.i + 6);
    expect(j).toBeGreaterThanOrEqual(origin.j + 2);
    expect(j).toBeLessThanOrEqual(origin.j + 6);
  });

  it("gives an ally the panel the caller chose", () => {
    const plan = seatingPlan({ i: 0, j: 0 }, HGOB, ["semiramis", "ally"], { ally: { i: 1, j: 7 } });
    expect(panelOf(plan, "ally")).toEqual({ i: 1, j: 7 });
  });

  it("seats an ally with no chosen panel near the middle rather than on the rim", () => {
    const plan = seatingPlan({ i: 0, j: 0 }, HGOB, ["semiramis", "ally"]);
    const { i, j } = panelOf(plan, "ally");
    expect(Math.max(Math.abs(i - 4), Math.abs(j - 4))).toBeLessThanOrEqual(1);
  });

  it("refuses a chosen panel outside the footprint, and seats them inside anyway", () => {
    const plan = seatingPlan({ i: 0, j: 0 }, HGOB, ["semiramis", "ally"], { ally: { i: 40, j: 40 } });
    const { i, j } = panelOf(plan, "ally");
    expect(i).toBeGreaterThanOrEqual(0);
    expect(i).toBeLessThan(9);
    expect(j).toBeGreaterThanOrEqual(0);
    expect(j).toBeLessThan(9);
  });

  it("never seats two riders on one panel", () => {
    const riders = ["semiramis", "a", "b", "c"];
    // Everyone asks for the middle; only one may have it.
    const chosen = Object.fromEntries(riders.slice(1).map((r) => [r, { i: 4, j: 4 }]));
    const plan = seatingPlan({ i: 0, j: 0 }, HGOB, riders, chosen);
    const keys = plan.map((p) => `${p.panel.i},${p.panel.j}`);
    expect(new Set(keys).size).toBe(riders.length);
    expect(panelOf(plan, "semiramis")).toEqual({ i: 4, j: 4 });
  });

  it("seats every rider, whatever the footprint", () => {
    for (const footprint of [{ w: 3, h: 3 }, { w: 5, h: 5 }, { w: 9, h: 9 }]) {
      const plan = seatingPlan({ i: 2, j: 2 }, footprint, ["owner", "x", "y"]);
      expect(plan, `${footprint.w}x${footprint.h}`).toHaveLength(3);
    }
  });
});

describe("the token lookup beside it", () => {
  it("reads the scene's documents rather than the canvas placeables", () => {
    // The defect was never in the arithmetic. `getActiveTokens()` reads the
    // placeable layer, which is empty mid-redraw — exactly when this runs.
    const src = readFileSync("module/engine/hgob.mjs", "utf8");
    expect(src).toMatch(/canvas\.scene\?\.tokens\?\.find/);
    // Code only: the comment above the lookup names `getActiveTokens` precisely
    // to say why it is not used, and a naive match reads that as the defect.
    const seating = src
      .slice(src.indexOf("async function seatRiders"), src.indexOf("export function seatingPlan"))
      .split("\n")
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join("\n");
    expect(seating, "seatRiders must not reach for the placeable layer")
      .not.toMatch(/getActiveTokens\s*\(/);
  });

  it("says so when it cannot seat somebody", () => {
    const src = readFileSync("module/engine/hgob.mjs", "utf8");
    expect(src).toMatch(/no token to seat for/);
    expect(src).toMatch(/could not seat/);
  });
});

describe("the riders it was never asked for", () => {
  /**
   * > *"…and **all allied Units of your choice are transported to any panel
   * > within the HGoB**."*
   *
   * The other half of the same sentence, and it had the mirror of the same
   * defect: `activateHangingGardens` has taken `allyIds` since it was written
   * and `seatingPlan` seats them, but the one caller — the channel completing —
   * passed nothing. So Semiramis always boarded alone and her Master was always
   * left on the ground, under a garden that had just taken her out of his ZON.
   *
   * Measured live on her audit board (§46.14.7): the activation dialog reads
   * *"1 target(s) · 1 panel(s)"* and the only name in it is hers.
   */
  // Line endings normalised: the repo checks out CRLF on Windows, and a
  // `\n}\n` boundary that silently fails to match turns a slice of one function
  // into a slice of the whole file — which is how this guard first passed
  // against the very code it was written to fail on.
  const src = readFileSync("module/engine/hgob.mjs", "utf8").replace(/\r\n/g, "\n");

  it("asks who is coming when the channel completes", () => {
    // The hook's own body, ending at the first closing brace in column 0 —
    // bounding it by the next function's name instead passes on a file where
    // that function does not exist yet, because `activateHangingGardens`'s own
    // signature names `allyIds`.
    const from = src.indexOf("async function onChannelComplete");
    const body = src.slice(from, src.indexOf("\n}\n", from));
    expect(body, "the activation must carry the choice, not default it away")
      .toMatch(/activateHangingGardens\([^)]*allyIds/);
  });

  it("offers the choice to the Servant's owner rather than to whoever is arbitrating", () => {
    // The GM runs the activation; the garden is not the GM's to fill.
    expect(src).toMatch(/import \{ askOwner \} from "\.\/ask\.mjs"/);
    expect(src).toMatch(/askOwner\(owner, \{/);
  });

  it("filters the answer against what was offered", () => {
    // It crosses a socket from a client the GM does not control — the same
    // reason ChoiceDialog enforces its own count a second time.
    expect(src).toMatch(/offered\.has\(id\)/);
  });

  it("seats a chosen ally on the panel that was chosen for it", () => {
    const plan = seatingPlan({ i: 0, j: 0 }, HGOB, ["owner", "master"], { master: { i: 6, j: 2 } });
    expect(panelOf(plan, "owner")).toEqual({ i: 4, j: 4 });
    expect(panelOf(plan, "master")).toEqual({ i: 6, j: 2 });
  });

  it("gives an ally with no chosen panel one inside the footprint", () => {
    const plan = seatingPlan({ i: 0, j: 0 }, HGOB, ["owner", "master"]);
    const at = panelOf(plan, "master");
    expect(at.i).toBeGreaterThanOrEqual(0);
    expect(at.i).toBeLessThanOrEqual(8);
    expect(at.j).toBeGreaterThanOrEqual(0);
    expect(at.j).toBeLessThanOrEqual(8);
    expect(at).not.toEqual(panelOf(plan, "owner"));
  });
});
