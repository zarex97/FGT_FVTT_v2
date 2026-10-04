/**
 * @file A passive ability's card shows no use state and no cost (#180).
 * @see module/apps/actor-sheet/context.mjs, templates/actor/ability-card.hbs
 *
 * Live: Pale Rider's Kagome Kagome, a Rank A Noble Phantasm always in effect,
 * read "The Master cannot pay the Health cost — Master cost 50 Health ... ✗
 * cannot be paid". A passive is never used, so it is never refused or billed.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

describe("a passive's card", () => {
  it("carries no state and no cost", () => {
    const src = readFileSync("module/apps/actor-sheet/context.mjs", "utf8");
    expect(src).toMatch(/state: use\.kind === "passive" \? null : abilityState\(verdict/);
    expect(src).toMatch(/cost: use\.kind === "passive" \? null : abilityCost\(verdict\.cost/);
  });

  it("draws the state line only when there is one", () => {
    const hbs = readFileSync("templates/actor/ability-card.hbs", "utf8");
    expect(hbs).toMatch(/\{\{#if state\}\}\s*<p class="fgt-card-ability__state/);
  });
});
