/**
 * Hundred-Faced Hassan's audit (#226), played in the arena: the defects the
 * live press found, each on a modelled world the way the table pressed it.
 * The projection-level halves are in `hassan-226.test.mjs`.
 * @see docs/46-roster-re-audit.md §46.32
 */
import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { castSkill } from "../helpers/process.mjs";
import { loadSource } from "../../tools/lib/load.mjs";

beforeAll(prepareSubjects, 120_000);

const H1 = "hassanHundred001";
const H2 = "hassanHundred002";
const MATCH = { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18 }, actingFactionId: "A" } };

let GROUP = null;
async function group() {
  GROUP ??= (await loadSource("packs/_source")).files.find((f) => f.doc?.id === "hassan-hundred-face").doc.linkedGroup;
  return GROUP;
}

/** Two bodies of one legion, side by side, Player1's. */
async function bodies(over = {}) {
  const authored = await group();
  const one = (id, n, partner, panel) => ({
    from: "hassan-hundred-face", id, owner: "p1", panel,
    state: {
      factionId: "A", legionKey: H1, legionNumber: n,
      linkedGroup: { ...authored, memberIds: [partner] },
      ...(over[id]?.state ?? {}),
    },
    ...(over[id]?.effects ? { effects: over[id].effects } : {}),
  });
  return [one(H1, 1, H2, { i: 5, j: 5 }), one(H2, 2, H1, { i: 5, j: 6 })];
}

const abilityOf = (w, actorId, contentId) => w.actor(actorId).items.find((i) => i.system?.contentId === contentId);
const rowsOf = (w) => [...w.messages.values()].at(-1)?.getFlag("fgt", "rows")?.map((r) => r.name)
  ?? ([...w.messages.values()].at(-1)?.flags?.fgt?.rows ?? []).map((r) => r.name);

describe("Expert of Many Specializations, on the table (#226 readings 11, live)", () => {
  it("a failed 70% Dodge lands the ⅓◈ one instead (EMS.4.dur)", async () => {
    await withSubjects(await bodies(), async ({ world: w }) => {
      w.dice.every(95);
      const out = await castSkill(w, { caster: H1, ability: abilityOf(w, H1, "hassan-expert-of-many-specializations").id });
      expect(out.ok).toBe(true);
      const dodge = [...w.actor(H1).effects].find((e) => e.system.defId === "dodge");
      expect(dodge, "the shorter Dodge landed").toBeTruthy();
      // ⅓◈ at 3 Turns a Round is one tick.
      expect(dodge.system.expiry).toBe(19);
      expect(rowsOf(w)).toContain("Dodge (otherwise)");
    }, MATCH);
  });

  it("LUC Up's restore is on the card with its real numbers (live)", async () => {
    await withSubjects(await bodies({ [H1]: { state: { luck: { value: 1, max: 5 } } } }), async ({ world: w }) => {
      w.dice.every(10);
      await castSkill(w, { caster: H1, ability: abilityOf(w, H1, "hassan-expert-of-many-specializations").id });
      expect(w.actor(H1).system.luck.value).toBe(4);
      expect(rowsOf(w).filter((r) => r.startsWith("LUC Up"))).toEqual(["LUC Up (rolled 10 vs 70%); Luck 1 → 4"]);
    }, MATCH);
  });
});

describe("Librarian's Passive 2 reaches a concealed body, and names it (#226 reading 13, live)", () => {
  it("offers the concealed body and prefixes its rows with its public name", async () => {
    const specs = await bodies({ [H2]: { effects: [{ defId: "presenceConcealment" }] } });
    await withSubjects(specs, async ({ world: w }) => {
      w.answer({ title: w.actor(H1).name, by: "p1", pick: [H2] });
      const out = await castSkill(w, { caster: H1, ability: abilityOf(w, H1, "hassan-librarian-of-stored-knowledge").id });
      expect(out.ok).toBe(true);
      const held = [...w.actor(H2).effects].map((e) => e.system.defId);
      expect(held).toEqual(expect.arrayContaining(["critUp", "buffChUp", "critDmUp"]));
      expect(rowsOf(w).filter((r) => r.endsWith("Crit Up"))).toEqual(["Crit Up", `${w.actor(H2).name}: Crit Up`]);
    }, MATCH);
  });
});
