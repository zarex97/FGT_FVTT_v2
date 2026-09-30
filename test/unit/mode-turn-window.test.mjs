/**
 * @file When a mode may be switched: on its owner's Turn, unless it says otherwise (#101).
 * @see module/rules/modes.mjs, packs/_source/abilities/raikou-tenmokaikai.yml
 *
 * Every mode in the corpus is *"(Active) Used during your Turn"*, and nothing
 * asked whose Turn it was: a mode could be switched at any moment. So the one
 * mode whose sheet WIDENS that -- Raikou's Tenmōkaikai, *"Raikou can
 * deactivate this NP during her Turn and at the start or end of any Turn or
 * Round"* -- had nothing to widen. Its `deactivation: {byOwner, window: any}`
 * was declared, compiled, stored and read by nobody.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { canToggleMode } from "../../module/rules/modes.mjs";

const content = (path) => parse(readFileSync(`packs/_source/${path}`, "utf8"));
const asItem = (doc, over = {}) => ({ id: doc.id, system: { ...doc, ...over } });
const unit = { id: "u", factionId: "f1", abilities: [] };

describe("a mode on somebody else's Turn", () => {
  const tenmokaikai = asItem(content("abilities/raikou-tenmokaikai.yml"), { active: true });
  const zeroSail = asItem(content("abilities/nemo-zero-sail.yml"), { active: false });

  it("Raikou may switch Tenmōkaikai OFF outside her Turn", () => {
    expect(canToggleMode(tenmokaikai, unit, { active: false, ownTurn: false })).toEqual({ ok: true });
  });

  it("but not ON", () => {
    expect(canToggleMode(tenmokaikai, unit, { active: true, ownTurn: false }).reason).toBe("notOwnTurn");
  });

  it("an ordinary mode is switched only on its owner's Turn: Nemo's Zero Sail", () => {
    expect(canToggleMode(zeroSail, unit, { active: true, ownTurn: false }).reason).toBe("notOwnTurn");
    expect(canToggleMode(zeroSail, unit, { active: true, ownTurn: true })).toEqual({ ok: true });
  });

  it("says nothing when the caller cannot tell whose Turn it is", () => {
    expect(canToggleMode(zeroSail, unit, { active: true })).toEqual({ ok: true });
  });
});

describe("a mode its owner may not switch off", () => {
  it("refuses the owner when the window says byOwner: false", () => {
    const held = { id: "x", system: { isMode: true, active: true, deactivation: { byOwner: false } } };
    expect(canToggleMode(held, unit, { active: false, ownTurn: true }).reason).toBe("cannotDeactivate");
  });
});
