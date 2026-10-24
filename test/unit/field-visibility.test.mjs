/**
 * @file Every field is drawn for every player (#330, ruled 2026-10-24).
 *
 * A field's Region had Foundry's default visibility, the GM's Regions layer
 * only, so no player had ever seen a field until Wallachia set `shown`. Now
 * `openField` draws every field as a Home Base is drawn, and the passive pass
 * shows a field that stood hidden from before.
 */

import { beforeAll, describe, expect, it } from "vitest";
import { loadFoundry } from "../../tools/lib/foundry.mjs";
import { fieldVisibility, fieldsToShow } from "../../module/engine/fields.mjs";

// Foundry's own constants, from the copy the tests run against: the fallback in
// `fieldVisibility` must never be what a test reads.
beforeAll(loadFoundry, 120_000);
const ALWAYS = 2;
const region = (id, type, visibility) => ({ id, visibility, behaviors: [{ type, system: {} }] });

describe("a field is drawn for every player", () => {
  it("as a Home Base is: ALWAYS, not the GM's layer", () => {
    expect(globalThis.CONST?.REGION_VISIBILITY?.ALWAYS).toBe(ALWAYS);
    expect(fieldVisibility()).toBe(globalThis.CONST.REGION_VISIBILITY.ALWAYS);
  });

  it("shows a field that stood hidden, and leaves every other Region alone", () => {
    const hidden = region("contagion", "npField", 0);
    const gmLayer = region("mist", "npField", 1);
    const drawn = region("wallachia", "npField", ALWAYS);
    const homeBase = region("base", "homeBase", 0);
    expect(fieldsToShow([hidden, gmLayer, drawn, homeBase]).map((r) => r.id)).toEqual(["contagion", "mist"]);
  });
});
