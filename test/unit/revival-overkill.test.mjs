/**
 * @file Only God Hand carries the killing blow's excess into its revival.
 * @see module/rules/revival.mjs#resolveRevival, char_orig_sheets/Copia de Heracles.md, #172
 *
 * `resolveRevival` subtracted the overkill from what EVERY source restored. Only
 * Heracles's God Hand states the clause -- *"if the damage of the Attack that
 * defeated Heracles exceeds his current Health, the excess damage is reduced
 * from his newly restored Health, and so on"* -- so Guts 10 on a 1,250-Health
 * Servant restored 125 less whatever killed her, and an overkill of 167 left
 * her dead (seen live).
 *
 * The subjects are authored content through the real projection, so the
 * `cascading` that decides it is the one the corpus wrote, not a fixture's.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { resolveRevival } from "../../module/rules/revival.mjs";

beforeAll(prepareSubjects, 60_000);

/** A projected Unit, brought to zero Health. */
const defeated = (unit, over = {}) => ({ ...unit, health: 0, ...over });

describe("Guts", () => {
  it("restores its percentage of maximum Health whatever the overkill", async () => {
    await withSubjects(
      [{ from: "van-gogh", id: "gogh", effects: [{ defId: "guts", magnitude: 10 }] }],
      ({ unit }) => {
        const gogh = unit("gogh");
        const guts = gogh.revivals.find((r) => r.id === "guts");
        expect(guts.cascading).toBe(false);
        const expected = Math.floor(gogh.maxHealth * 0.1);

        // An overkill larger than the restore: the old rule left her dead.
        for (const overkill of [0, expected - 1, expected, expected + 42, 10_000]) {
          const out = resolveRevival({ unit: defeated(gogh), overkill });
          expect(out.source.id).toBe("guts");
          expect(out.revived).toBe(true);
          expect(out.restored).toBe(expected);
          expect(out.chargesUsed).toBe(1);
        }
      },
    );
  });
});

describe("God Hand", () => {
  it("still subtracts the excess and cascades against it", async () => {
    await withSubjects([{ from: "heracles", id: "herc" }], ({ unit }) => {
      const herc = unit("herc");
      const godHand = herc.revivals.find((r) => r.id === "godHand");
      expect(godHand.cascading).toBe(true);

      // One charge, a 105 roll, 30 of excess: 75 stands.
      const one = resolveRevival({
        unit: defeated(herc, { revivals: [godHand] }), overkill: 30, rolls: { "revival:godHand:0": 105 },
      });
      expect(one.source.id).toBe("godHand");
      expect(one.restored).toBe(75);
      expect(one.chargesUsed).toBe(1);

      // 274 against three 100s: two charges swallowed whole, 26 left standing.
      const three = resolveRevival({
        unit: defeated(herc, { revivals: [godHand] }),
        overkill: 274,
        rolls: { "revival:godHand:0": 100, "revival:godHand:1": 100, "revival:godHand:2": 100 },
      });
      expect(three.restored).toBe(26);
      expect(three.chargesUsed).toBe(3);
    });
  });
});

describe("the sources that state an amount or a destination", () => {
  it("Undying restores 25% of maximum Health, not 25% less the excess", async () => {
    await withSubjects(
      [{ from: "heracles", id: "herc", effects: [{ defId: "undying" }] }],
      ({ unit }) => {
        const herc = unit("herc");
        const out = resolveRevival({ unit: defeated(herc), overkill: 100_000 });
        expect(out.source.id).toBe("undying");
        expect(out.restored).toBe(Math.floor(herc.maxHealth * 0.25));
      },
    );
  });

  it("Holder Mode restores to exactly half, whatever killed her", async () => {
    await withSubjects([{ from: "mannanan", id: "mann" }], ({ unit }) => {
      const mann = unit("mann");
      const holder = mann.revivals.find((r) => r.id === "holderMode");
      expect(holder.cascading).toBe(false);

      const out = resolveRevival({
        unit: defeated(mann, { acceptedRevivals: ["holderMode"], resources: { ...mann.resources, fragarachTokens: { value: 1, max: 5 } } }),
        overkill: 100_000,
      });
      expect(out.source.id).toBe("holderMode");
      expect(out.restored).toBe(Math.floor(mann.maxHealth * 0.5));
    });
  });
});
