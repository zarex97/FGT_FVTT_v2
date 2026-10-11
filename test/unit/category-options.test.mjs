/**
 * @file A Skill that counts as another is that Skill to every predicate (#125).
 * @see module/rules/options.mjs, module/rules/items.mjs#categoriesOf, docs/11-predicates.md
 *
 * > Kingprotea's Divine Core: *"... counts as Divinity for every clause in the
 * > game that asks."* -- packs/_source/abilities/kingprotea-divine-core.yml
 *
 * Two readers of "has Divinity" disagreed. `hasCategory` and `categoryRankOf`
 * read `categorizedAs`, so Achilles's Andreias Amarantos and Ozymandias's
 * Ramesseum Tentyris saw Goddess's Divine Core as Divinity. `rollOptionsFor`
 * emitted `skill:<slug>` and `skillRank:<slug>:gte:<grade>` from each ability's
 * own slug only, so `target:skill:divinity` did not: Vasavi Shakti's "Divine, no
 * Divinity (+150%)" row beat its "Divinity B-EX (+200%)" row against every Divine
 * Core holder, and `vasavi-activated`'s six +30 rows paid Quetzalcoatl +100.
 *
 * Every Unit here is built through the real projection.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readdirSync } from "node:fs";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { Rank } from "../../module/domain/rank.mjs";
import { rollOptionsFor } from "../../module/rules/options.mjs";
import { categoryRankOf } from "../../module/rules/items.mjs";
import { computeDamage } from "../../module/rules/damage/pipeline.mjs";

beforeAll(prepareSubjects, 60_000);

const LADDER = ["E", "D", "C", "B", "A", "EX"];

/** The options Karna emits against `defender`, as the projection builds both. */
const against = (defender, fn) => withSubjects(
  [{ from: "karna", id: "karna" }, { from: defender, id: defender }],
  ({ unit, world }) => fn({
    karna: unit("karna"),
    target: unit(defender),
    options: rollOptionsFor({ attacker: unit("karna"), defender: unit(defender), attack: { kind: "np" } }),
    world,
  }),
);

describe("a Skill categorized as Divinity is Divinity to skill:divinity", () => {
  // The four Divine Core holders, and the Rank each holds it at.
  it.each([
    ["quetzalcoatl", "EX"],
    ["kingprotea", "A"],
    ["castor", "B"],
    ["pollux", "B"],
  ])("%s (Divine Core %s)", async (id, rank) => {
    await against(id, ({ options }) => {
      expect(options.has("target:skill:divinity")).toBe(true);
      expect(options.has("target:skillRank:divinity:gte:B")).toBe(true);
      // ...and exactly as high as the Skill is, no higher.
      for (const grade of LADDER) {
        const cleared = LADDER.indexOf(grade) <= LADDER.indexOf(rank);
        expect(options.has(`target:skillRank:divinity:gte:${grade}`), `${id} at ${grade}`).toBe(cleared);
      }
    });
  });

  it("is unchanged for a Unit whose Divinity is the class skill itself (Nemo, A)", async () => {
    await against("nemo", ({ options }) => {
      expect(options.has("target:skill:divinity")).toBe(true);
      expect(options.has("target:skillRank:divinity:gte:A")).toBe(true);
      expect(options.has("target:skillRank:divinity:gte:EX")).toBe(false);
    });
  });

  it("does not invent Divinity for a Unit with no such Skill (Kiritsugu)", async () => {
    await against("kiritsugu", ({ options }) => {
      expect(options.has("target:skill:divinity")).toBe(false);
    });
  });
});

describe("Vasavi Shakti reads a Divine Core as Divinity", () => {
  /** Stage 3 of Brahmastra's sister NP against `defender`, with the NP's own authored ladder. */
  const stage3 = (defender) => against(defender, ({ karna, target, options, world }) => {
    const vasavi = world.actor("karna").items.find((i) => i.system.contentId === "karna-vasavi-shakti");
    const result = computeDamage({
      attacker: karna, defender: { ...target, health: 99999 },
      attack: { kind: "np", component: "mag" },
      base: { fixedValue: 200 },
      multiplier: vasavi.system.damage.multiplier,
      conditionalMultipliers: vasavi.system.damage.conditionalMultipliers,
      rolls: { attackMinus: 0 },
      crit: { isCrit: false },
      options,
    });
    return result.breakdown.find((s) => s.index === 3).contributors
      .filter((c) => c.source === "conditionalMultiplier").map((c) => `${c.note} x${c.value}`);
  });

  it("against Quetzalcoatl (Divinity EX through Goddess's Divine Core): +200% x3.0, not the +150% x2.5 of 'no Divinity'", async () => {
    expect(await stage3("quetzalcoatl")).toEqual(["Divinity B–EX (+200%) x3"]);
  });

  it("against Kingprotea (Divine Core A): the same row", async () => {
    expect(await stage3("kingprotea")).toEqual(["Divinity B–EX (+200%) x3"]);
  });

  it("against Castor (Twin God's Divine Core B): the same row", async () => {
    expect(await stage3("castor")).toEqual(["Divinity B–EX (+200%) x3"]);
  });

  it("against Nemo (Divinity A, the class skill): still that row", async () => {
    expect(await stage3("nemo")).toEqual(["Divinity B–EX (+200%) x3"]);
  });
});

describe("a Unit's own contributions see the same Divinity", () => {
  // The collection pass builds its own `abilities` list for `rollOptionsFor`
  // (`snapshot.mjs#contributionsOf`), and it carried `{id, slug, active}` only: a
  // `self:skill:divinity` clause was false from a Divine Core holder's own rules.
  const probe = (predicate) => ({
    type: "servant", id: "probeServant", name: "Probe Servant", servantClasses: ["saber"],
    parameters: { str: "C", end: "C", agi: "C", mag: "C", luc: "C" },
    abilities: [
      { ref: "quetz-goddesses-divine-core" },
      {
        id: "probe-flat", name: "Probe Flat", kind: "skill", slug: "probeFlat",
        passiveRules: [{ key: "FlatDamage", value: 7, predicate }],
      },
    ],
  });
  const flat = (predicate) => withSubjects([{ from: probe(predicate), id: "probeServant" }],
    ({ unit }) => unit("probeServant").modifiers.filter((m) => m.source === "Probe Flat").map((m) => m.value));

  it("collects a rule gated on self:skill:divinity from a Divine Core holder", async () => {
    expect(await flat(["self:skill:divinity"])).toEqual([7]);
  });

  it("collects a rule gated on the Rank the Divine Core is held at", async () => {
    expect(await flat(["self:skillRank:divinity:gte:A"])).toEqual([7]);
  });

  it("does not collect one gated on a category she does not hold (charisma)", async () => {
    expect(await flat(["self:skill:charisma"])).toEqual([]);
  });
});

describe("categoryRankOf and the options ladder are one reader", () => {
  // Drake cannot be built by `withSubjects` today (his Riding cooldown is the literal "@cooldown",
  // which the DataModel refuses, #120) and he carries no Divinity either way.
  const servants = readdirSync("packs/_source/servants").filter((f) => f.endsWith(".yml"))
    .map((f) => f.slice(0, -4)).filter((id) => id !== "drake");

  it("agree on every Servant in the corpus that carries Divinity, whatever Skill it comes from", async () => {
    const disagreements = [];
    let carriers = 0;
    // One world per Servant.
    for (const id of servants) {
      const seen = await withSubjects([{ from: id, id }], ({ unit }) => {
        const u = unit(id);
        return { rank: categoryRankOf(u, "divinity"), self: rollOptionsFor({ attacker: u, defender: null }) };
      });
      if (!seen.rank) {
        if (seen.self.has("self:skill:divinity")) disagreements.push(`${id}: options say Divinity, categoryRankOf says none`);
        continue;
      }
      carriers += 1;
      if (!seen.self.has("self:skill:divinity")) disagreements.push(`${id}: categoryRankOf says ${seen.rank}, no self:skill:divinity`);
      for (const grade of LADDER) {
        // At the LETTER: "B or higher" is met by B− (#193 reading 11), which is
        // how the options ladder reads every rank.
        const r = typeof seen.rank === "string" ? Rank.parse(seen.rank) : seen.rank;
        const held = Rank.gte(Rank.of(r.grade), Rank.of(grade));
        if (seen.self.has(`self:skillRank:divinity:gte:${grade}`) !== held) {
          disagreements.push(`${id}: Divinity ${seen.rank}, gte:${grade} should be ${held}`);
        }
      }
    }
    // Quetzalcoatl, Kingprotea, Castor and Pollux hold it through a Divine Core; the class skill is the rest.
    expect(carriers).toBeGreaterThanOrEqual(4);
    expect(disagreements).toEqual([]);
  }, 300_000);
});

