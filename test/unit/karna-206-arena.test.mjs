/**
 * Karna's audit (#206), pressed in the arena: what the live board found.
 * @see docs/46-roster-re-audit.md §46.29
 */
import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { playAttack } from "../helpers/process.mjs";

beforeAll(prepareSubjects, 120_000);

const SCATHACH = "scathachAttacker";
const KARNA = "karnaDefender000";

describe("a MAG hit Magic Resistance negates still tries its debuffs (#206, found live)", () => {
  it("Þurs on Karna: 0 damage, and Shock is rolled against him", async () => {
    await withSubjects([
      { from: "scathach", id: SCATHACH, state: { factionId: "A" }, panel: { i: 5, j: 5 } },
      { from: "karna", id: KARNA, state: { factionId: "B" }, panel: { i: 5, j: 7 } },
    ], async ({ world: w }) => {
      // His Uncrowned Arms Mastership is offered as he is attacked (reading 4).
      w.answer({ title: "FGT.Window.defendingPhaseStart", decline: true });
      const thurs = w.actor(SCATHACH).items.find((i) => i.system?.contentId === "scathach-thurs");
      const { declared } = await playAttack(w, {
        attacker: SCATHACH, ability: thurs.id, target: KARNA, react: { [KARNA]: ["nothing", "declined"] },
      });
      const msg = w.messages.get(declared.messageId);
      const result = msg.getFlag("fgt", "result");
      expect(result.total).toBe(0);
      expect(result.flags.negatedBy).toBe("Magic Resistance");
      // The rider is tried: applied, or resisted with its die, never absent.
      const effects = msg.getFlag("fgt", "effects") ?? [];
      expect(effects.map((e) => e.id)).toContain("shock");
    }, { tokens: true, combat: { round: 3, started: true, system: { globalTurn: 7 }, actingFactionId: "A" } });
  });
});

describe("Brahmastra chooses 4x or 2x against the target it hits (#206 reading 7, found live)", () => {
  const KARNA_A = "karnaAttacker000";
  const HERACLES = "heraclesDefender";
  /** @param {string} from @param {string} id @returns {Promise<number>} the multiplier stage 3 used */
  const brahmastraOn = (from, id) => withSubjects([
    { from: "karna", id: KARNA_A, state: { factionId: "A" }, panel: { i: 5, j: 5 } },
    { from, id, state: { factionId: "B" }, panel: { i: 5, j: 7 } },
  ], async ({ world: w }) => {
    w.answer({ title: "FGT.Window.combatPhaseStart", decline: true });
    const np = w.actor(KARNA_A).items.find((i) => i.system?.contentId === "karna-brahmastra");
    const { declared } = await playAttack(w, {
      attacker: KARNA_A, ability: np.id, target: id, react: { [id]: ["nothing", "declined"] },
    });
    const ids = (declared.processes ?? [{ messageId: declared.messageId }]).map((p) => p.messageId);
    const state = JSON.parse(w.messages.get(ids[0]).getFlag("fgt", "process"));
    return state.attack.instanceBlock?.multiplier ?? state.attack.multiplier;
  }, { tokens: true, combat: { round: 3, started: true, system: { globalTurn: 7 }, actingFactionId: "A" } });

  it("takes 2x against Heracles, whose STR A+ beats Karna's B", async () => {
    expect(await brahmastraOn("heracles", HERACLES)).toBe(2);
  });

  it("takes 4x against Kingprotea's Master, who has no Parameters (reading 7c)", async () => {
    expect(await brahmastraOn("master-advanced", "masterDefender00")).toBe(4);
  });
});

describe("after the Activation his Normal Attack files its 50% Burn roll (#206 VA.4, found live)", () => {
  it("shows the die against 50%, and none against 25%", async () => {
    await withSubjects([
      { from: "karna", id: "karnaVasavi00000", state: { factionId: "A" }, panel: { i: 5, j: 5 },
        effects: [{ defId: "vasaviActivated" }] },
      { from: "heracles", id: "heraclesTarget00", state: { factionId: "B" }, panel: { i: 5, j: 6 } },
    ], async ({ world: w }) => {
      w.answer({ title: "FGT.Window.combatPhaseStart", decline: true });
      const { declared } = await playAttack(w, {
        attacker: "karnaVasavi00000", target: "heraclesTarget00", react: { heraclesTarget00: ["nothing", "declined"] },
      });
      const state = JSON.parse(w.messages.get(declared.messageId).getFlag("fgt", "process"));
      const records = state.history.flatMap((h) => h.detail?.rollRecords ?? []);
      const notes = records.flatMap((r) => (r.modifiers ?? []).map((m) => m.source));
      expect(notes.some((n) => /^against 50%/.test(n))).toBe(true);
      expect(notes.some((n) => /^against 25%/.test(n))).toBe(false);
    }, { tokens: true, combat: { round: 3, started: true, system: { globalTurn: 7 }, actingFactionId: "A" } });
  });
});

describe("an Aim attack cannot be Evaded at all (#206 §46.4-MB, ruled 2026-10-14)", () => {
  const KARNA_A = "karnaAttacker000";
  const opts = { tokens: true, combat: { round: 3, started: true, system: { globalTurn: 7 }, actingFactionId: "A" } };

  it("Brahmastra on Heracles: Block is offered, Evade is not, and a stale Evade is refused", async () => {
    await withSubjects([
      { from: "karna", id: KARNA_A, state: { factionId: "A" }, panel: { i: 5, j: 5 } },
      { from: "heracles", id: "heraclesDefender", state: { factionId: "B" }, panel: { i: 5, j: 7 } },
    ], async ({ world: w }) => {
      w.answer({ title: "FGT.Window.combatPhaseStart", decline: true });
      const process = await import("../../module/engine/combat-process.mjs");
      const { resolveAttack } = await import("../../module/engine/attack.mjs");
      const np = w.actor(KARNA_A).items.find((i) => i.system?.contentId === "karna-brahmastra");
      const declared = await resolveAttack({
        attackerId: KARNA_A, abilityId: np.id,
        placement: { unitId: "heraclesDefender", chosenIds: ["heraclesDefender"] },
      });
      const id = (declared.processes ?? [{ messageId: declared.messageId }])[0].messageId;
      const state = process.deserialize(w.messages.get(id).getFlag("fgt", "process"));
      expect(state.attack.aim).toBe(true);
      // The card shows the rung's options less what the attack forbids.
      expect(process.pendingPrompt(state).options).toContain("block");
      expect(state.forbiddenReactions).toContain("evade");
      expect(state.forbiddenReactions).not.toContain("block");
      expect(() => process.advance(state, "evade")).toThrow(/not available/);
    }, opts);
  });

  it("Trofa's automatic evasion does not take it: the NP lands", async () => {
    await withSubjects([
      { from: "karna", id: KARNA_A, state: { factionId: "A" }, panel: { i: 5, j: 5 } },
      { from: "medea", id: "medeaDefender000", state: { factionId: "B" }, panel: { i: 5, j: 7 } },
    ], async ({ world: w }) => {
      w.answer({ title: "FGT.Window.combatPhaseStart", decline: true });
      const np = w.actor(KARNA_A).items.find((i) => i.system?.contentId === "karna-brahmastra");
      const trofa = w.actor("medeaDefender000").items.find((i) => i.system?.contentId === "medea-trofa");
      const { declared } = await playAttack(w, {
        attacker: KARNA_A, ability: np.id, target: "medeaDefender000",
        react: { medeaDefender000: [`ability:${trofa.id}`, "declined", "declined", "declined"] },
      });
      const id = (declared.processes ?? [{ messageId: declared.messageId }])[0].messageId;
      const state = JSON.parse(w.messages.get(id).getFlag("fgt", "process"));
      expect(state.history.some((h) => h.state === "evadeRoll" && h.event === "success")).toBe(false);
      expect(w.messages.get(id).getFlag("fgt", "result").total).toBeGreaterThan(0);
    }, opts);
  });
});
