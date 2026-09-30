/**
 * @file A current pool is stored, never derived (#106).
 * @see module/rules/derived.mjs, module/engine/hgob.mjs, packs/_source/effects/shock.yml
 *
 * `hgob-owner-buff` raised Semiramis's Health, Agility and Luck with a derived
 * `alsoCurrent`: every preparation added +500 to her CURRENT Health as well as
 * her maximum. Every writer reads the prepared value and stores the result, so
 * the offset was baked into `_source` by the first write and re-added on top by
 * the next preparation. Measured live: Heracles hit her for 49 and she read
 * 1250/1250 before and after; her bar read Agility 17 / 15. Shock's derived
 * `agility.value −3` compounded the other way on every Agility write.
 *
 * The rule now: a maximum may be derived, a current value is paid once and
 * stored. The garden buff's "+500 current" is paid by `hgob.mjs` at activation
 * and Shock's "−3 current" by its `onApply`, which fires on creation only. A
 * derived current is capped at its maximum, so losing a buff that raised both
 * clamps the current rather than leaving it above the ceiling.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";

beforeAll(prepareSubjects, 60_000);
beforeEach(() => { globalThis.Roll = class { async evaluate() { return { total: 1 }; } }; });
afterEach(() => { delete globalThis.Roll; });

const io = async () => (await import("../../module/engine/io.mjs")).worldIO();

describe("Semiramis aboard her garden", () => {
  // Health, Agility and Luck as `hgob.mjs` leaves them at activation: the
  // maximum raised by the buff (derived), the current paid once (stored).
  const aboard = {
    from: "semiramis", id: "semiramis",
    effects: [{ defId: "hgob-owner-buff", unremovable: true }],
    state: { health: { value: 1250, max: 750 }, agility: { value: 15, max: 13 }, luck: { value: 24, max: 20 } },
  };

  it("takes damage: 49 off 1250 reads 1201", async () => {
    const hp = await withSubjects([aboard], async ({ world }) => {
      await (await io()).adjustHealth("semiramis", -49);
      return world.actor("semiramis").system.health.value;
    });
    expect(hp).toBe(1201);
  });

  it("reads her pools at their stored values under the raised maxima", async () => {
    const pools = await withSubjects([aboard], ({ world }) => {
      const s = world.actor("semiramis").system;
      return { health: [s.health.value, s.health.max], agility: [s.agility.value, s.agility.max], luck: [s.luck.value, s.luck.max] };
    });
    expect(pools).toEqual({ health: [1250, 1250], agility: [15, 15], luck: [24, 24] });
  });

  it("spends Agility by exactly what is spent", async () => {
    const agility = await withSubjects([aboard], async ({ world }) => {
      await (await io()).adjustStat("semiramis", "agility.value", -1);
      return world.actor("semiramis").system.agility.value;
    });
    expect(agility).toBe(14);
  });

  it("clamps a current left above its maximum once the buff is gone", async () => {
    const pools = await withSubjects([{ ...aboard, effects: [] }], ({ world }) => {
      const s = world.actor("semiramis").system;
      return { health: s.health.value, agility: s.agility.value, luck: s.luck.value };
    });
    expect(pools).toEqual({ health: 750, agility: 13, luck: 20 });
  });
});

describe("Shock", () => {
  const shocked = async (applications) => withSubjects(
    [{ from: "heracles", id: "heracles", state: { agility: { value: 15, max: 19 } } }],
    async ({ world }) => {
      const { applyIntents } = await import("../../module/engine/applier.mjs");
      for (let n = 0; n < applications; n += 1) {
        await applyIntents([{ t: "applyEffect", unitId: "heracles", effect: { defId: "shock" }, sourceId: null }], {
          io: await io(), canWrite: () => true, isGM: true, source: "test",
        });
      }
      const s = world.actor("heracles").system;
      const before = s.agility.value;
      await (await io()).adjustStat("heracles", "agility.value", -1);
      return { first: [before, s.agility.max], afterSpend: world.actor("heracles").system.agility.value };
    },
  );

  it("takes 3 off the maximum and 3 off the current, once", async () => {
    const { first } = await shocked(1);
    expect(first).toEqual([12, 16]);
  });

  it("does not take them again when it is refreshed", async () => {
    const { first } = await shocked(2);
    expect(first).toEqual([12, 16]);
  });

  it("spends Agility by exactly what is spent, not 3 more each time", async () => {
    const { afterSpend } = await shocked(1);
    expect(afterSpend).toBe(11);
  });
});
