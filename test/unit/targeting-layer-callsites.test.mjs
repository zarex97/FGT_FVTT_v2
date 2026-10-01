/**
 * @file Every targeting session hands the canvas back to the layer it took.
 * @see docs/36-canvas-layers.md invariant 8
 *
 * `InteractionLayer#activate()` deactivates every other layer. A targeting
 * session that activated the TargetingLayer and then simply ended left the
 * canvas there: `canvas.activeLayer` stayed `TargetingLayer`,
 * `canvas.tokens.active` was false, no token could be controlled, and the
 * action bar -- which hangs off token control -- closed and did not come back.
 * The Token controls button could not repair it, because that group was already
 * the selected one; only switching to another group and back did.
 *
 * Found on a live board during the Quetzalcoatl audit (#65): she used Good
 * God's Wisdom, the unit picker resolved normally, and she was left with no bar
 * and no way to pick a token.
 *
 * Nothing about the targeting rules was wrong, and a test of them cannot see
 * this: the defect is a line that was never written at the end of a function.
 * So this reads the source, which is where a missing restore is visible. The
 * layer is a PIXI class that needs a running canvas, which is not practical to
 * stand up here.
 */

import { readFileSync } from "node:fs";

import { describe, it, expect } from "vitest";

const FILE = "module/apps/canvas/targeting-layer.mjs";
const src = readFileSync(FILE, "utf8").replace(/\r\n/g, "\n");

/** The text of each method of the class that contains `needle`, up to the next method. */
function sessionsCalling(needle) {
  // A method starts at two-space indentation; the next one ends it.
  const parts = src.split(/\n(?= {2}(?:async |static |get )?#?\w+\([^)]*\) \{)/);
  return parts.filter((p) => p.includes(needle));
}

describe("targeting layer takes and returns the canvas", () => {
  it("never calls activate() or deactivate() directly outside the take/hand-back pair", () => {
    // The helpers are the only place the layer is switched on or off; a session
    // that calls `this.activate()` itself has stopped going through the pair.
    const direct = sessionsCalling("this.activate(")
      .map((m) => m.match(/^\s+(?:async )?(#?\w+)\(/)?.[1]);
    expect(direct, "only #takeCanvas may call this.activate()").toEqual(["#takeCanvas"]);
    expect(src, "this.deactivate() leaves no layer active; use #handCanvasBack").not.toMatch(/this\.deactivate\(/);
  });

  it("hands the canvas back to a remembered layer, or the token layer", () => {
    const take = sessionsCalling("#takeCanvas() {")[0];
    expect(take, "#takeCanvas does not remember canvas.activeLayer").toMatch(/canvas\.activeLayer/);
    const back = sessionsCalling("#handCanvasBack(claim) {")[0];
    expect(back, "#handCanvasBack does not re-activate a layer").toMatch(/\.activate\(\)/);
    expect(back, "#handCanvasBack has no token-layer fallback").toMatch(/canvas\.tokens/);
  });

  it("pairs every #takeCanvas() with a #handCanvasBack in the same method's finally", () => {
    const sessions = sessionsCalling("this.#takeCanvas()");
    // pick and paintPanels: the two sessions that take the canvas.
    expect(sessions.length).toBeGreaterThanOrEqual(2);
    for (const body of sessions) {
      const name = body.match(/^\s+(?:async )?(#?\w+)\(/)?.[1];
      const finallyAt = body.lastIndexOf("} finally {");
      expect(finallyAt, `${name} takes the canvas but has no finally`).toBeGreaterThan(-1);
      expect(
        body.slice(finallyAt),
        `${name} takes the canvas but does not hand it back in its finally`,
      ).toMatch(/this\.#handCanvasBack\(\s*claim\s*\)/);
      // The claim the finally gives back is the one the session took.
      expect(body, `${name} drops the claim #takeCanvas returned`).toMatch(/const claim = this\.#takeCanvas\(\)/);
    }
  });

  it("counts takeCanvas calls so no new session slips in unpaired", () => {
    const takes = src.match(/this\.#takeCanvas\(\)/g) ?? [];
    const backs = src.match(/this\.#handCanvasBack\(/g) ?? [];
    expect(backs.length, "each #takeCanvas() needs its own #handCanvasBack()").toBe(takes.length);
  });
});
