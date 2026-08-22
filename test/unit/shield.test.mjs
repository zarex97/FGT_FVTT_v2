/**
 * @file A barrier with its own Health pool.
 * @see module/engine/shield.mjs
 *
 * EMIYA's Rho Aias is the only one in the reference set and it is unlike every
 * other defensive effect in the game: it has a bar, the bar persists between
 * attacks, several Units stand behind one of them, and it charges its owner for
 * what it absorbs.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { absorb } from "../../module/engine/shield.mjs";
import { EffectRegistry } from "../../module/rules/registry.mjs";

const NP = new Set(["attack:kind:np"]);
const THROWN = new Set(["attack:kind:np", "attack:thrownWeapon"]);

/** Rho Aias, as authored. */
const spec = {
  health: 1400,
  ownerLoss: { per: 200, amount: 100 },
  ownerFloor: 1,
  poolFloor: 1,
  poolFloorWhen: ["attack:thrownWeapon"],
};

/**
 * A defender standing behind a barrier owned by `emiya`.
 * @param {object} [over]
 */
const defender = (over = {}) => ({
  id: "ally",
  effectInstances: [{ defId: "rhoAias", sourceUnitId: "emiya" }],
  ...over,
});

/**
 * @param {number} pool
 * @param {number} ownerHealth
 */
function world(pool, ownerHealth = 1000) {
  const item = { id: "np", name: "Rho Aias", system: { shield: spec, shieldHealth: pool } };
  globalThis.game = {
    actors: {
      get: (id) => (id === "emiya"
        ? { id: "emiya", items: [item], system: { health: { value: ownerHealth, max: 1000 } } }
        : null),
    },
  };
  return item;
}

beforeEach(() => {
  vi.spyOn(EffectRegistry, "get").mockImplementation((id) =>
    (id === "rhoAias" ? { name: "Rho Aias", absorbs: { scope: "np", poolFrom: "sourceAbility" } } : null));
});

describe("what gets through", () => {
  it("takes the whole hit while the pool covers it", () => {
    world(1400);
    const out = absorb(defender(), 900, { options: NP });

    expect(out.through).toBe(0);
    expect(out.absorbed).toBe(900);
  });

  it("passes the overflow on to the defender", () => {
    // "If the AU's NP deals more than 1400 damage, the remaining damage is
    // dealt to the DUs accordingly."
    world(1400);
    const out = absorb(defender(), 2000, { options: NP });

    expect(out.absorbed).toBe(1400);
    expect(out.through).toBe(600);
  });

  it("does nothing once the pool is empty", () => {
    world(0);
    expect(absorb(defender(), 500, { options: NP }).through).toBe(500);
  });

  it("ignores an attack that is not a Noble Phantasm", () => {
    // The restriction, not a note: a barrier that answered every Normal Attack
    // would be a permanent 1400-point buffer.
    world(1400);
    expect(absorb(defender(), 300, { options: new Set(["attack:kind:normal"]) }).through).toBe(300);
  });

  it("does nothing for a defender standing behind no barrier", () => {
    world(1400);
    expect(absorb({ id: "x", effectInstances: [] }, 300, { options: NP }).through).toBe(300);
  });
});

describe("the thrown-weapon clause", () => {
  it("stops the attack outright, however large", () => {
    // "If the NP is a 'thrown weapon', Rho Aias' Health cannot drop below 1" --
    // so a barrier that cannot break absorbs everything.
    world(1400);
    const out = absorb(defender(), 9000, { options: THROWN });

    expect(out.through).toBe(0);
    expect(out.absorbed).toBe(9000);
  });

  it("still only spends what the pool had above the floor", () => {
    world(1400);
    const out = absorb(defender(), 9000, { options: THROWN });
    const poolWrite = out.intents.find((i) => i.t === "shieldDelta");

    expect(poolWrite.delta).toBe(-1399);
  });
});

describe("what the owner pays", () => {
  it("charges 100 for every completed 200 the barrier lost", () => {
    world(1400);
    const out = absorb(defender(), 900, { options: NP });
    const owner = out.intents.find((i) => i.t === "statDelta");

    // 900 lost → four completed 200s → 400.
    expect(owner.unitId).toBe("emiya");
    expect(owner.delta).toBe(-400);
  });

  it("charges nothing for a partial 200", () => {
    // "For EVERY 200 Health" — 199 is not one, which makes a chip attack free.
    world(1400);
    const out = absorb(defender(), 199, { options: NP });

    expect(out.intents.some((i) => i.t === "statDelta")).toBe(false);
  });

  it("never takes the owner below 1", () => {
    // "EMIYA's Health cannot drop below 1 due to Rho Aias being damaged."
    world(1400, 150);
    const out = absorb(defender(), 1000, { options: NP });
    const owner = out.intents.find((i) => i.t === "statDelta");

    expect(owner.delta).toBe(-149);
  });

  it("is a stat change, not damage", () => {
    // Damage would trigger an Injury Roll and every on-damage effect he has.
    // He is not being attacked; his barrier is.
    world(1400);
    const out = absorb(defender(), 400, { options: NP });

    expect(out.intents.some((i) => i.t === "damage")).toBe(false);
    expect(out.intents.some((i) => i.t === "statDelta")).toBe(true);
  });
});

describe("one pool, several bearers", () => {
  it("draws the second defender down from what the first left", () => {
    // The reason the pool lives on the ABILITY. An area NP over a protected
    // 3x3 meets one 1400 in resolution order, not one per Unit.
    const item = world(1400);

    const first = absorb(defender({ id: "a" }), 1000, { options: NP });
    item.system.shieldHealth += first.intents.find((i) => i.t === "shieldDelta").delta;

    const second = absorb(defender({ id: "b" }), 1000, { options: NP });
    expect(second.absorbed).toBe(400);
    expect(second.through).toBe(600);
  });
});
