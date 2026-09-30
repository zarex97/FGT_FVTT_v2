/**
 * @file Clauses the Semiramis audit (#68) found authored wrong.
 * @see char_orig_sheets/Copia de Semiramis.md, docs/46-roster-re-audit.md
 */

import { describe, it, expect } from "vitest";
import { effectDef } from "../helpers/effect-defs.mjs";

describe("Scales of the Sacred Fish's Shield", () => {
  // *"the Unit gains the Shield (200) buff for 2◈ Turns"* -- a buff, and
  // Appendix A's `Shield (X)` is an ordinary one. The file said `unremovable`,
  // copied from Rho Aias's marker, so no buff removal could touch it.
  it("is a buff that buff removal can take", () => {
    expect(effectDef("scalesShield")).toMatchObject({ polarity: "buff" });
    expect(effectDef("scalesShield").unremovable).toBeFalsy();
  });
});
