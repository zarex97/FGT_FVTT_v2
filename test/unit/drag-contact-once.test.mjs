/**
 * @file The Drag's displacement runs field contact once (#180).
 * @see module/engine/skill-use.mjs (dragInto), module/engine/movement-hooks.mjs
 *
 * Live: Pale Rider dragged a Faction 2 Master into Doomsday Come, and Kagome
 * Kagome summoned a Beast AND a Sword for it on one panel. The displacement
 * runs contact through the move hook, which settles it above its forced-move
 * return; `dragInto` ran it a second time.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

describe("dragInto", () => {
  const skill = readFileSync("module/engine/skill-use.mjs", "utf8");
  const drag = skill.slice(skill.indexOf('case "dragInto":'), skill.indexOf('case "summon":'));

  it("displaces the target and leaves contact to the move hook", () => {
    expect(drag).toMatch(/await displaceToken\(token/);
    expect(drag).not.toMatch(/runContactEvents\(/);
  });

  it("the move hook runs contact for a forced move too", () => {
    const hooks = readFileSync("module/engine/movement-hooks.mjs", "utf8");
    const contact = hooks.indexOf("if (document.actor) await runContactEvents([document.actor.id], enteredFields(document, movement));");
    expect(contact).toBeGreaterThan(-1);
    expect(hooks.slice(0, contact)).toMatch(/deliberately\s+\/\/ above the forced-move return below/);
  });
});
