/**
 * @file Guts restores the percentage of Maximum Health the instance carries (#128).
 * @see packs/_source/effects/guts.yml, module/rules/snapshot.mjs#resolveRuleValues, module/rules/revival.mjs
 *
 * > *"Guts — Revive on defeat with X Health. Consumed on use."* — Appendix A §A.6
 *
 * `guts.yml` authors `restore: {percentOfMax: "@magnitude"}`. `resolveRuleValues`
 * substituted the instance magnitude into `value`, `npValue` and the named
 * carriers (`chance`, `effect`, `then`) and not into `restore`, so the literal
 * string reached the `RevivalSource` executor, resolved to nothing against the
 * unit's refs, and became 0%. `resolveRevival` computed `floor(max × 0) = 0`,
 * the Guts was spent, and the Unit was defeated: Quetzalcoatl's Good God's
 * Wisdom (10%), Nemo's Indomitable (20%) and Van Gogh's Imaginary Numbers Arts
 * (20%) revived nobody. Three tests asserted only the authored `magnitude`,
 * from the source.
 *
 * So this goes through the real projection: a Unit from the corpus, a real
 * `guts` ActiveEffect at a magnitude, `snapshotUnit`, and `resolveRevival`.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { resolveRevival } from "../../module/rules/revival.mjs";

beforeAll(prepareSubjects, 60_000);

/** Heracles carrying `guts` at `magnitude`, projected the way a board projects him. */
const withGuts = (magnitude, fn) => withSubjects(
  [{ from: "heracles", id: "heracles", effects: [{ defId: "guts", magnitude }] }],
  ({ unit }) => fn(unit("heracles")),
);

/** His Maximum Health, as the projection holds it. */
const maxOf = (unit) => unit.maxHealth;

/** The `guts` source in his projection. */
const gutsOf = (unit) => (unit.revivals ?? []).find((r) => r.id === "guts");

describe("Guts at magnitude 10", () => {
  it("projects a source that restores 10% of Maximum Health, a number", async () => {
    const source = await withGuts(10, gutsOf);
    expect(source).toMatchObject({ id: "guts", priority: 200, percentOfMax: 10, charges: 1 });
  });

  it("revives the Unit with floor(max x 10%), where it restored 0 and defeated him", async () => {
    await withGuts(10, (unit) => {
      const result = resolveRevival({ unit, overkill: 0 });
      expect(result.revived).toBe(true);
      expect(result.restored).toBe(Math.floor(maxOf(unit) * 0.10));
      expect(result.restored).toBeGreaterThan(0);
      expect(result.chargesUsed).toBe(1);
    });
  });
});

describe("Guts at magnitude 20 (Nemo's Indomitable, Van Gogh's Imaginary Numbers Arts)", () => {
  it("restores floor(max x 20%)", async () => {
    await withGuts(20, (unit) => {
      expect(gutsOf(unit).percentOfMax).toBe(20);
      const result = resolveRevival({ unit, overkill: 0 });
      expect(result).toMatchObject({ revived: true, restored: Math.floor(maxOf(unit) * 0.20) });
    });
  });
});

describe("a stray Guts at magnitude 0", () => {
  it("still restores nothing: the instance is what says how much", async () => {
    await withGuts(0, (unit) => {
      expect(gutsOf(unit).percentOfMax).toBe(0);
      expect(resolveRevival({ unit, overkill: 0 })).toMatchObject({ revived: false, restored: 0, chargesUsed: 1 });
    });
  });
});
