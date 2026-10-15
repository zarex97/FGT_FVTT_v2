/**
 * EMIYA's audit (#208), pressed in the arena: the readings that only a whole
 * Combat Process can show. The rest are in `emiya-208-rulings.test.mjs`.
 * @see docs/46-roster-re-audit.md §46.30
 */
import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { playAttack } from "../helpers/process.mjs";

beforeAll(prepareSubjects, 120_000);

const E = "emiyaAttacker000";
const H = "heraclesDefender";
const NOW = 7;
const opts = { tokens: true, combat: { round: 3, started: true, system: { globalTurn: NOW }, actingFactionId: "A" } };

/** The effect instances of one definition an actor holds. */
const held = (w, id, defId) => [...w.actor(id).effects].filter((e) => e.system?.defId === defId);
const itemOf = (w, id, contentId) => [...w.actor(id).items].find((i) => i.system?.contentId === contentId);
/** A Process's stored state, parsed. */
const stateOf = (w, messageId) => JSON.parse(w.messages.get(messageId).getFlag("fgt", "process"));

/** EMIYA holding Atk Up (Trace) until tick 9, and Heracles `range` panels away. */
const board = (range, { emiya = {} } = {}) => [
  { from: "emiya", id: E, state: { factionId: "A" }, panel: { i: 5, j: 5 },
    effects: [{ defId: "atkUpTrace", expiry: 9, magnitude: 60, npMagnitude: 40 }, ...(emiya.effects ?? [])] },
  { from: "heracles", id: H, state: { factionId: "B" }, panel: { i: 5, j: 5 + range } },
];

describe("a close Normal Attack uses Kanshou & Bakuya (#208 reading 5, ruled 2026-10-14)", () => {
  it("at Range 2 it extends Atk Up (Trace) by one third of a Round and gives Range Up", async () => {
    await withSubjects(board(2), async ({ world: w }) => {
      w.answer({ title: "FGT.Window.combatPhaseStart", decline: true });
      w.dice.every(50);
      await playAttack(w, { attacker: E, target: H, react: { [H]: ["nothing", "declined"] } });
      // HEAD: 9 and no Range Up -- the swords were projected and never "used".
      expect(held(w, E, "atkUpTrace")[0].system.expiry).toBe(10);
      expect(held(w, E, "rangeUp")).toHaveLength(1);
    }, opts);
  }, 60_000);

  it("at Range 3 it is not used: neither follows", async () => {
    await withSubjects(board(3), async ({ world: w }) => {
      w.answer({ title: "FGT.Window.combatPhaseStart", decline: true });
      w.dice.every(50);
      await playAttack(w, { attacker: E, target: H, react: { [H]: ["nothing", "declined"] } });
      expect(held(w, E, "atkUpTrace")[0].system.expiry).toBe(9);
      expect(held(w, E, "rangeUp")).toHaveLength(0);
    }, opts);
  }, 60_000);
});

describe("Overedge's two swings (#208 readings 5, 7, ruled 2026-10-14)", () => {
  /** Overedge on Heracles at this range, both Processes played out. */
  const overedgeAt = async (range, after) => withSubjects(
    board(range, { emiya: { effects: [{ defId: "nAtkUp", magnitude: 30 }] } }),
    async ({ world: w }) => {
      w.answer({ title: "FGT.Window.combatPhaseStart", decline: true });
      w.dice.every(50);
      const oe = itemOf(w, E, "emiya-overedge");
      const { declared, processes } = await playAttack(w, {
        attacker: E, ability: oe.id, target: H,
        react: { [H]: ["nothing", "nothing", "declined", "declined"] },
      });
      return after({ w, declared, processes });
    },
    opts,
  );

  it("each swing is a Normal Attack beside its Attack Skill, and Reinforcement's N.Atk Up reaches it", async () => {
    await overedgeAt(3, ({ w, declared, processes }) => {
      const ids = (declared.processes ?? [{ messageId: declared.messageId }]).map((p) => p.messageId);
      expect(ids).toHaveLength(2);
      for (const id of ids) {
        const attack = stateOf(w, id).attack;
        // HEAD: asNormalAttack false -- "attack:kind:normal" was absent.
        expect(attack.kind).toBe("attackSkill");
        expect(attack.asNormalAttack).toBe(true);
        expect(attack.categorizedAsNP).toBe(true);
        const names = (w.messages.get(id).getFlag("fgt", "result").breakdown ?? [])
          .flatMap((b) => (b.contributors ?? []).map((c) => c.note ?? c.source ?? ""))
          .join(" | ");
        // The breakdown names a contributor by its effect id. N.Atk Up's clause is `attack:kind:normal`.
        expect(names, `breakdown of ${id}`).toMatch(/nAtkUp/);
      }
      expect(processes).toHaveLength(2);
    });
  }, 60_000);

  it("is three uses of Projection NPs: its own and one Kanshou & Bakuya per swing", async () => {
    await overedgeAt(3, ({ w }) => {
      // 9 + one third of a Round, three times. HEAD: 10, Overedge's own use alone.
      expect(held(w, E, "atkUpTrace")[0].system.expiry).toBe(9 + 3);
      expect(held(w, E, "rangeUp")).toHaveLength(1);
      // Kanshou & Bakuya's effect reached the Range 3 swing (the grant rule's work, unchanged).
      expect(held(w, E, "dualWieldGuard")).toHaveLength(1);
    });
  }, 60_000);
});
