/**
 * @file A Unit that stays aboard after a knock still clears the mover's square (#68).
 * @see module/engine/movement-hooks.mjs#knockBackOccupants, docs/46 §46.4-CC
 *
 * > Bašmu: *"...all Units occupying said panels are knocked back by 1 panel
 * > until the space is free."*
 * > HGoB: *"If a Master who is directly next to its Servant fails its Agility
 * > Check, its Servant can perform an Agility Check too; if successful, its
 * > Master is not knocked off."*
 *
 * Not knocked OFF is not "not knocked back". On the Semiramis audit Heracles
 * caught his Master, who then stayed on the panel the Bašmu had just moved
 * onto -- two Units on one panel, which no rule describes. The same holds for a
 * Unit that passed its check and chose to stay: `nearestFreePlatformPanel`
 * reads a board on which the mover has not arrived yet.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const hooks = readFileSync("module/engine/movement-hooks.mjs", "utf8");
const body = hooks.slice(hooks.indexOf("async function knockBackOccupants"), hooks.indexOf("function destinationFootprint"));

describe("a knock that leaves the Unit aboard", () => {
  it("keeps knockOff's verdict", () => {
    expect(body).toMatch(/const fell = await knockOff\(/);
  });

  it("moves a Unit still on the mover's footprint to a free deck panel outside it", () => {
    expect(body).toMatch(/!fell\?\.landed/);
    expect(body).toMatch(/boardingLanding\([^)]*footprint\)/);
  });
});
