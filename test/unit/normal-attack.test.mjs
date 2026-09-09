/**
 * @file A Normal Attack that changes shape with distance.
 * @see module/rules/normal-attack.mjs
 *
 * `rangeBanded` has been one of the three declared `normalAttack.mode` choices
 * since the actor schema was written and nothing implemented it, so a Servant
 * authored with it would have attacked with its flat `component` at every
 * distance — silently, because the fallback is a legal answer.
 */

import { describe, it, expect } from "vitest";
import { normalAttackAt } from "../../module/rules/normal-attack.mjs";

/** EMIYA's, from the sheet. */
const emiya = {
  normalAttack: {
    mode: "rangeBanded",
    component: "str",
    bands: [{
      from: 3,
      component: "str",
      ignoresMagicResistance: true,
      sources: [{ component: "str", factor: 1 }, { component: "mag", factor: 0.2 }],
    }],
  },
};

describe("a flat normal attack", () => {
  it("is its component at every distance", () => {
    const flat = { normalAttack: { mode: "fixed", component: "mag" } };
    for (const range of [1, 3, 9]) {
      expect(normalAttackAt(flat, range).sources).toEqual([{ unit: "self", component: "mag", factor: 1 }]);
    }
  });

  it("defaults to STR when nothing is declared at all", () => {
    expect(normalAttackAt({}, 4).component).toBe("str");
  });
});

describe("a range-banded normal attack", () => {
  it("is plain STR inside the band's floor", () => {
    // "At a Range of 1 or 2, EMIYA's Normal Attacks use Base Attack (STR)."
    for (const range of [1, 2]) {
      const spec = normalAttackAt(emiya, range);
      expect(spec.sources).toEqual([{ unit: "self", component: "str", factor: 1 }]);
      expect(spec.ignoresMagicResistance).toBe(false);
    }
  });

  it("combines STR with a fifth of MAG from 3 out", () => {
    // "…use Base Attack (STR) and 20% of his Base Attack (MAG) combined
    // (i.e. 75+35=110)."
    const spec = normalAttackAt(emiya, 3);
    expect(spec.sources).toEqual([
      { unit: "self", component: "str", factor: 1 },
      { unit: "self", component: "mag", factor: 0.2 },
    ]);

    const total = spec.sources.reduce((a, s) => a + ({ str: 75, mag: 175 })[s.component] * s.factor, 0);
    expect(total).toBe(110);
  });

  it("stops Magic Resistance seeing the ranged shot", () => {
    // The half that is easy to miss and expensive to get wrong: without it the
    // arrow is a MAG attack a Rank D Magic Resistance negates outright.
    expect(normalAttackAt(emiya, 3).ignoresMagicResistance).toBe(true);
    expect(normalAttackAt(emiya, 2).ignoresMagicResistance).toBe(false);
  });

  it("still counts as a STR attack, which is what the exemptions read", () => {
    // "Base Attack (STR) and 20% of MAG combined" is a STR attack with a
    // top-up, and `attack:component:` is what Magic Resistance's Instakill
    // clause tests.
    expect(normalAttackAt(emiya, 5).component).toBe("str");
  });

  it("falls back rather than guessing when the distance is unknown", () => {
    // A snapshot taken off the board has no panel. Reading that as range 0
    // would put him in his melee band while previewing a shot across the map —
    // and reading it as "in the band" would do the reverse.
    expect(normalAttackAt(emiya, null).sources).toHaveLength(1);
    expect(normalAttackAt(emiya).ignoresMagicResistance).toBe(false);
  });

  it("takes the narrowest band when two overlap", () => {
    const layered = {
      normalAttack: {
        mode: "rangeBanded",
        component: "str",
        bands: [
          { from: 2, sources: [{ component: "mag", factor: 1 }] },
          { from: 5, sources: [{ component: "str", factor: 3 }] },
        ],
      },
    };
    expect(normalAttackAt(layered, 6).sources[0].factor).toBe(3);
    expect(normalAttackAt(layered, 3).sources[0].component).toBe("mag");
  });
});

describe("element", () => {
  it("carries the element a Normal Attack is authored with", () => {
    // Mesektet: "All Normal Attacks use Base Attack (MAG) ... Light damage."
    // Every element in the engine came from an ABILITY document, and the
    // pipeline's element stage returns immediately without one — so a Servant
    // whose ordinary swing has a type had nowhere to say so.
    const unit = { normalAttack: { mode: "fixed", component: "mag", element: "light" } };
    expect(normalAttackAt(unit, 1).element).toBe("light");
  });

  it("is null when unstated, rather than undefined", () => {
    expect(normalAttackAt({ normalAttack: { mode: "fixed", component: "str" } }, 1).element)
      .toBeNull();
  });

  it("lets a band retype the damage as well as re-source it", () => {
    const unit = {
      normalAttack: {
        mode: "rangeBanded", component: "str", element: "fire",
        bands: [{ from: 3, component: "mag", element: "light" }],
      },
    };
    expect(normalAttackAt(unit, 1).element).toBe("fire");
    expect(normalAttackAt(unit, 3).element).toBe("light");
  });

  it("takes the MOUNT's element when a mount replaces the attack", () => {
    // The whole spec comes from the platform, which is the existing rule --
    // the element is one more field that must come with it.
    const rider = { normalAttack: { mode: "fixed", component: "str", element: "fire" } };
    const mount = { normalAttack: { mode: "fixed", component: "mag", element: "light" } };
    expect(normalAttackAt(rider, 1, { platform: mount }).element).toBe("light");
  });
});

describe("the projection", () => {
  it("carries the element onto the snapshot", async () => {
    // `snapshotUnit` rebuilds `normalAttack` field by field rather than
    // spreading it, so a newly declared field is dropped silently — which is
    // exactly what happened to `element` the first time it was authored.
    const { snapshotUnit } = await import("../../module/rules/snapshot.mjs");
    const actor = {
      id: "o", name: "O", type: "servant", items: [], effects: [],
      system: { normalAttack: { mode: "fixed", component: "mag", element: "light" } },
    };
    expect(snapshotUnit(actor).normalAttack.element).toBe("light");
  });
});
