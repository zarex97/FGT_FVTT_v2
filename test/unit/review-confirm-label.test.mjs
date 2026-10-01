/**
 * @file The review's confirm button names what the click does (#68).
 * @see module/apps/canvas/target-review.mjs, docs/46 §46.4-CM
 *
 * Every targeting review confirmed with **Attack** -- for De Sterrennacht's
 * five effects, for the Hanging Gardens' activation aimed at Semiramis herself.
 * Since §46.4-CK a non-damaging ability is not an attack; its button says so.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const review = readFileSync("module/apps/canvas/target-review.mjs", "utf8");
const layer = readFileSync("module/apps/canvas/targeting-layer.mjs", "utf8");
const sheet = readFileSync("module/apps/actor-sheet/sheet.mjs", "utf8");
const lang = JSON.parse(readFileSync("lang/en.json", "utf8"));

describe("the confirm button", () => {
  it("reads Use for an ability that is not an attack", () => {
    expect(review).toMatch(/isAttack \? "FGT\.Targeting\.Confirm" : "FGT\.Targeting\.Use"/);
    expect(lang["FGT.Targeting.Use"]).toBeTruthy();
  });

  it("is told which one it is, from the ability's own classification", () => {
    expect(layer).toMatch(/isAttack: preview\.isAttack/);
    expect(sheet).toMatch(/isAttack: ability \? classifyAbility\(ability\)\.isAttack : true/);
  });
});
