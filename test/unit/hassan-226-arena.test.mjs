/**
 * Hundred-Faced Hassan's audit (#226), played in the arena: the defects the
 * live press found, each on a modelled world the way the table pressed it.
 * The projection-level halves are in `hassan-226.test.mjs`.
 * @see docs/46-roster-re-audit.md §46.32
 */
import { describe, it, expect, beforeAll, vi } from "vitest";
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
      // Its PUBLIC name, as the title says: this read the True Name and passed,
      // the caster's player reading every row (#239).
      expect(rowsOf(w).filter((r) => r.endsWith("Crit Up"))).toEqual(["Crit Up", "Assassin 2: Crit Up"]);
    }, MATCH);
  });
});

describe("A Round's deployment asks only a legion in this war (#230, live)", () => {
  // Found live in Arturia's war: at every Round's start Player1 was asked to
  // deploy "Hassan 12" onto her board. The Hassan audit's Master, on another
  // scene in another combat, still held his legion, and the offer walked every
  // actor in the world.
  it("a Master off this board is not asked, and nothing is deployed", async () => {
    const pool = { size: 100, remaining: 34, fieldCap: 10, openingMax: 10, label: "Hassan", nextNumber: 12 };
    const specs = [
      { from: "arturia", id: "arturiaElsewhr01", panel: { i: 5, j: 5 }, state: { factionId: "A" } },
      { from: "master-advanced", id: "hassanMasterOff1", owner: "p1", state: { factionId: "B", legions: { [H1]: pool } } },
    ];
    // Faction ids repeat from war to war, so his "B" finds this war's B base.
    const base = (id, factionId, i) => ({
      id, panels: [0, 1, 2].map((j) => ({ i, j })), behaviors: [{ type: "homeBase", system: { factionId } }],
    });
    await withSubjects(specs, async ({ world: w }) => {
      const { offerLegionDeploys } = await import("../../module/engine/legion.mjs");
      const { deployPanels } = await import("../../module/rules/linked-group.mjs");
      const { currentBoard } = await import("../../module/engine/board.mjs");
      // The offer WOULD find panels for him: only his absence from the war stops it.
      expect(deployPanels(currentBoard(), "B").length).toBeGreaterThan(0);
      expect(w.actor("hassanMasterOff1").system.legions[H1].remaining).toBe(34);
      // The panel picker cannot open in the test world, so the question is caught
      // where it fails: a prompt to his owner that nobody answers.
      const warned = vi.spyOn(console, "warn");
      const deployed = await offerLegionDeploys(3);
      const prompts = warned.mock.calls.filter((c) => String(c[0]).includes("window prompt was not answered"));
      warned.mockRestore();
      expect(prompts).toEqual([]);
      expect(w.asked).toEqual([]);
      expect(deployed).toEqual([]);
    }, { ...MATCH, regions: [base("hbA", "A", 0), base("hbB", "B", 12)] });
  });
});
