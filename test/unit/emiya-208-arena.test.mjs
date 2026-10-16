/**
 * EMIYA's audit (#208), pressed in the arena: the readings that only a whole
 * Combat Process can show. The rest are in `emiya-208-rulings.test.mjs`.
 * @see docs/46-roster-re-audit.md §46.30
 */
import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { playAttack, castSkill } from "../helpers/process.mjs";

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
      expect(held(w, E, "rangeUpHawkeye")).toHaveLength(1);
    }, opts);
  }, 60_000);

  it("at Range 3 it is not used: neither follows", async () => {
    await withSubjects(board(3), async ({ world: w }) => {
      w.answer({ title: "FGT.Window.combatPhaseStart", decline: true });
      w.dice.every(50);
      await playAttack(w, { attacker: E, target: H, react: { [H]: ["nothing", "declined"] } });
      expect(held(w, E, "atkUpTrace")[0].system.expiry).toBe(9);
      expect(held(w, E, "rangeUpHawkeye")).toHaveLength(0);
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
      expect(held(w, E, "rangeUpHawkeye")).toHaveLength(1);
      // Kanshou & Bakuya's effect reached the Range 3 swing (the grant rule's work, unchanged).
      expect(held(w, E, "dualWieldGuard")).toHaveLength(1);
    });
  }, 60_000);
});

/* ========================================================================== */
/*  Readings 10, 11, 12, 13 -- Activated and Blazing Circuits (#213)            */
/* ========================================================================== */

/** The real Reality Marble: a field whose id is the Noble Phantasm's content id, 7x7 around EMIYA. */
const UBW_PANELS = Array.from({ length: 49 }, (_, n) => ({ i: 2 + Math.floor(n / 7), j: 2 + (n % 7) }));
const UBW = {
  id: "ubwRegion",
  panels: UBW_PANELS,
  behaviors: [{
    type: "npField",
    system: {
      fieldId: "emiya-unlimited-blade-works", ownerUnitId: E,
      geometry: { kind: "fixedArea", anchor: { i: 5, j: 5 }, shape: { kind: "square", size: 7 } },
      // As a real one stores it, so the board's geometry sync finds nothing to redraw.
      panels: UBW_PANELS,
    },
  }],
};

const AC = [
  { defId: "atkUpTrace", expiry: 99, magnitude: 60, npMagnitude: 40 },
  { defId: "activatedCircuits" },
  { defId: "acNextNp", uses: 1 },
];
const BC = [
  { defId: "atkUpTrace", expiry: 99, magnitude: 60, npMagnitude: 40 },
  { defId: "blazingCircuits" },
  { defId: "bcNextNp", uses: 1 },
];

/** EMIYA with these effects, Heracles `range` panels away (dodging if asked). */
const circuitsBoard = (range, effects, { dodges = false } = {}) => [
  { from: "emiya", id: E, state: { factionId: "A" }, panel: { i: 5, j: 5 }, effects },
  { from: "heracles", id: H, state: { factionId: "B" }, panel: { i: 5, j: 5 + range },
    ...(dodges ? { effects: [{ defId: "dodge", uses: 9 }] } : {}) },
];

/** An attack on Heracles, played through. An Evade he makes gives EMIYA a Lucky Hit to decline. */
const swing = (w, ability = null, react = ["nothing", "declined"]) =>
  playAttack(w, {
    attacker: E, ability, target: H,
    react: { [H]: react, ...(react[0] === "evade" ? { [E]: ["declined"] } : {}) },
  });

/** Set the Luck EMIYA starts from, well under its maximum, and return it. */
const startLuck = async (w) => {
  await w.actor(E).update({ "system.luck.max": 20, "system.luck.value": 5 });
  return w.actor(E).system.luck.value;
};

describe("Activated Circuits fire on any Normal Attack inside the Marble, hit or miss (#208 reading 10)", () => {
  it("a Normal Attack that lands: Luck +1 and every NP Cooldown -1", async () => {
    await withSubjects(circuitsBoard(2, AC), async ({ world: w }) => {
      w.answer({ title: "FGT.Window.combatPhaseStart", decline: true });
      w.dice.every(50);
      const before = await startLuck(w);
      await itemOf(w, E, "emiya-hrunting").update({ "system.cooldown.remaining": 5 });
      await swing(w);
      // HEAD: unchanged -- the clause asked `self:inField:unlimitedBladeWorks`, the slug, and a
      // field's id is its content id.
      expect(w.actor(E).system.luck.value).toBe(before + 1);
      expect(itemOf(w, E, "emiya-hrunting").system.cooldown.remaining).toBe(4);
    }, { ...opts, regions: [UBW] });
  }, 60_000);

  it("a Normal Attack that is Evaded does the same: the Combat Process ended", async () => {
    await withSubjects(circuitsBoard(2, AC, { dodges: true }), async ({ world: w }) => {
      w.answer({ title: "FGT.Window.combatPhaseStart", decline: true });
      w.dice.every(50);
      const before = await startLuck(w);
      await itemOf(w, E, "emiya-hrunting").update({ "system.cooldown.remaining": 5 });
      const { declared } = await swing(w, null, ["evade", "declined"]);
      const result = w.messages.get(declared.messageId).getFlag("fgt", "result");
      expect(result?.total ?? 0, "the swing was evaded").toBe(0);
      // HEAD: unchanged -- `damageStepEnd` is a hit's event, and a miss never reaches it.
      expect(w.actor(E).system.luck.value).toBe(before + 1);
      expect(itemOf(w, E, "emiya-hrunting").system.cooldown.remaining).toBe(4);
    }, { ...opts, regions: [UBW] });
  }, 60_000);

  it("outside the Marble it does nothing", async () => {
    await withSubjects(circuitsBoard(2, AC), async ({ world: w }) => {
      w.answer({ title: "FGT.Window.combatPhaseStart", decline: true });
      w.dice.every(50);
      const before = await startLuck(w);
      await swing(w);
      expect(w.actor(E).system.luck.value).toBe(before);
    }, opts);
  }, 60_000);
});

describe("Blazing Circuits add 50 to a Normal Attack inside the Marble that hits (#208 reading 10)", () => {
  /** The contributors of a Normal Attack's breakdown. */
  const contributors = (w, declared) => (w.messages.get(declared.messageId).getFlag("fgt", "result").breakdown ?? [])
    .flatMap((b) => (b.contributors ?? []).map((c) => c.note ?? c.source ?? ""));

  it("inside: the +50 is in the breakdown", async () => {
    await withSubjects(circuitsBoard(2, BC), async ({ world: w }) => {
      w.answer({ title: "FGT.Window.combatPhaseStart", decline: true });
      w.dice.every(50);
      const { declared } = await swing(w);
      // HEAD: absent, for the same reason as Activated Circuits (the field's name).
      expect(contributors(w, declared).join(" | ")).toMatch(/blazingCircuits/);
    }, { ...opts, regions: [UBW] });
  }, 60_000);

  it("outside, or on a swing that misses, there is no +50 to add", async () => {
    await withSubjects(circuitsBoard(2, BC), async ({ world: w }) => {
      w.answer({ title: "FGT.Window.combatPhaseStart", decline: true });
      w.dice.every(50);
      const { declared } = await swing(w);
      expect(contributors(w, declared).join(" | ")).not.toMatch(/blazingCircuits/);
    }, opts);
    await withSubjects(circuitsBoard(2, BC, { dodges: true }), async ({ world: w }) => {
      w.answer({ title: "FGT.Window.combatPhaseStart", decline: true });
      w.dice.every(50);
      const { declared } = await swing(w, null, ["evade", "declined"]);
      expect(w.messages.get(declared.messageId).getFlag("fgt", "result")?.total ?? 0).toBe(0);
    }, { ...opts, regions: [UBW] });
  }, 60_000);
});

describe("the next NP that deals damage: used once, hit or miss, and the cut waits for the next Attack (#208 readings 11, 12)", () => {
  const cooldownOf = (w, contentId) => itemOf(w, E, contentId).system.cooldown.remaining;
  const damaged = async (w, id) => w.actor(id).system.health.value;

  it("Hrunting lands: Luck +2, the charge is spent, Activated Circuits stay, and the NP's own cooldown is not cut", async () => {
    await withSubjects(circuitsBoard(4, AC), async ({ world: w }) => {
      w.answer({ title: "FGT.Window.combatPhaseStart", decline: true });
      w.dice.every(50);
      const before = await startLuck(w);
      const { declared } = await swing(w, itemOf(w, E, "emiya-hrunting").id);
      expect(w.messages.get(declared.messageId).getFlag("fgt", "result").total).toBeGreaterThan(0);
      // HEAD: the first damaging NP threw -- `duration: "thisRound"` is not a duration (#208 §46.30).
      expect(w.actor(E).system.luck.value).toBe(before + 2);
      expect(held(w, E, "acNextNp")).toHaveLength(0);
      // HEAD: gone with it. `consumesUse` on a clause of a persistent effect spends the whole effect.
      expect(held(w, E, "activatedCircuits")).toHaveLength(1);
      const [overdrive] = held(w, E, "acOverdrive");
      expect(overdrive.system.endsOn).toBe("roundEnd");
      expect(overdrive.system.expiry).toBeNull();
      // The 2-Turn cut starts with the NEXT Attack: Hrunting's 7◈ (21 ticks) is whole.
      expect(cooldownOf(w, "emiya-hrunting")).toBe(21);
      expect(held(w, E, "circuitsPending")).toHaveLength(0);
    }, opts);
  }, 60_000);

  it("the next Attack in the Round cuts every NP Cooldown by 2; then the Round ends and it stops", async () => {
    // The full chain in one world: an NP, then a Normal Attack, then the Round's end.
    await withSubjects(circuitsBoard(4, AC), async ({ world: w }) => {
      w.answer({ title: "FGT.Window.combatPhaseStart", decline: true });
      w.answer({ title: "FGT.Window.combatPhaseStart", decline: true });
      w.dice.every(50);
      await startLuck(w);
      await swing(w, itemOf(w, E, "emiya-hrunting").id);
      expect(cooldownOf(w, "emiya-hrunting")).toBe(21);
      await w.combat.update({ "system.globalTurn": NOW + 1 }); // his next Turn, in the same Round
      await swing(w);
      // 21 - 2 = 19: the Normal Attack was an Attack he performed, and the NP's own cut waited for it.
      expect(cooldownOf(w, "emiya-hrunting")).toBe(19);

      // The Round ends: "for the rest of the Round" is over.
      const { fireEvent } = await import("../../module/engine/scheduler.mjs");
      const { applyWorldIntents } = await import("../../module/engine/applier.mjs");
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const board = currentBoard();
      const unit = board.units.find((u) => u.id === E);
      await applyWorldIntents(fireEvent("roundEnd", [unit], { tick: NOW, turnsPerRound: 3, board, options: new Set(), rolls: {} }), "test:roundEnd");
      expect(held(w, E, "acOverdrive")).toHaveLength(0);
      expect(held(w, E, "activatedCircuits")).toHaveLength(1);
    }, opts);
  }, 90_000);

  it("a close swing is not the NP: the charge waits (reading 22)", async () => {
    await withSubjects(circuitsBoard(2, AC), async ({ world: w }) => {
      w.answer({ title: "FGT.Window.combatPhaseStart", decline: true });
      w.dice.every(50);
      const before = await startLuck(w);
      await swing(w);
      expect(w.actor(E).system.luck.value).toBe(before);
      expect(held(w, E, "acNextNp")).toHaveLength(1);
      expect(held(w, E, "acOverdrive")).toHaveLength(0);
    }, opts);
  }, 60_000);

  it("an NP that is Evaded still counts as used: Overedge on a Unit that Dodges", async () => {
    await withSubjects(circuitsBoard(3, AC, { dodges: true }), async ({ world: w }) => {
      w.answer({ title: "FGT.Window.combatPhaseStart", decline: true });
      w.dice.every(50);
      const before = await startLuck(w);
      const hp = await damaged(w, H);
      // Two Processes: both evade, EMIYA declines both Lucky Hits, Heracles declines both Counters.
      await playAttack(w, {
        attacker: E, ability: itemOf(w, E, "emiya-overedge").id, target: H,
        react: { [H]: ["evade", "evade", "declined", "declined"], [E]: ["declined", "declined"] },
      });
      expect(await damaged(w, H), "both swings were evaded").toBe(hp);
      // The chosen reading (2026-10-15): the sheet says "uses an NP", not "hits with one".
      expect(w.actor(E).system.luck.value).toBe(before + 2);
      expect(held(w, E, "acNextNp")).toHaveLength(0);
    }, opts);
  }, 60_000);

  it("Overedge's two swings spend the charge once, and the second swing is not cut by it", async () => {
    await withSubjects(circuitsBoard(3, AC), async ({ world: w }) => {
      w.answer({ title: "FGT.Window.combatPhaseStart", decline: true });
      w.dice.every(50);
      const before = await startLuck(w);
      const oe = itemOf(w, E, "emiya-overedge");
      await playAttack(w, {
        attacker: E, ability: oe.id, target: H,
        react: { [H]: ["nothing", "nothing", "declined", "declined"] },
      });
      // Two Processes finish together; one decision (not +4): the in-flight claim.
      expect(w.actor(E).system.luck.value).toBe(before + 2);
      expect(held(w, E, "acNextNp")).toHaveLength(0);
      expect(held(w, E, "acOverdrive")).toHaveLength(1);
      // Overedge's own 2◈ (6 ticks) stands: the second swing began under the pending marker.
      expect(cooldownOf(w, "emiya-overedge")).toBe(6);
      expect(held(w, E, "circuitsPending")).toHaveLength(0);
    }, opts);
  }, 60_000);
});

describe("Blazing Circuits' +20% for the rest of the Round starts after the NP's Combat Process (#208 reading 11, ruled 2026-10-15)", () => {
  const breakdownOf = (w, messageId) => (w.messages.get(messageId).getFlag("fgt", "result").breakdown ?? [])
    .flatMap((b) => (b.contributors ?? []).map((c) => c.note ?? c.source ?? "")).join(" | ");

  it("Overedge's own swings do not carry it; the next Attack does; the Round's end takes it", async () => {
    await withSubjects(circuitsBoard(3, BC), async ({ world: w }) => {
      w.answer({ title: "FGT.Window.combatPhaseStart", decline: true });
      w.answer({ title: "FGT.Window.combatPhaseStart", decline: true });
      w.dice.every(50);
      const oe = itemOf(w, E, "emiya-overedge");
      const { declared } = await playAttack(w, {
        attacker: E, ability: oe.id, target: H,
        react: { [H]: ["nothing", "nothing", "declined", "declined"] },
      });
      const ids = (declared.processes ?? [{ messageId: declared.messageId }]).map((p) => p.messageId);
      for (const id of ids) expect(breakdownOf(w, id), `swing ${id}`).not.toMatch(/bcOverdrive/);
      // HEAD: the first damaging NP threw (`thisRound`), and the clause asked `attack:kind:np`.
      const [overdrive] = held(w, E, "bcOverdrive");
      expect(overdrive.system.endsOn).toBe("roundEnd");
      expect(overdrive.system.magnitude).toBe(20);
      expect(held(w, E, "bcNextNp")).toHaveLength(0);
      expect(held(w, E, "blazingCircuits")).toHaveLength(1);

      await w.combat.update({ "system.globalTurn": NOW + 1 }); // his next Turn, in the same Round
      const next = await swing(w);
      expect(breakdownOf(w, next.declared.messageId)).toMatch(/bcOverdrive/);
    }, opts);
  }, 90_000);
});

describe("one Round of EMIYA's, from Trace, On to the Round's end (#208, the whole chain)", () => {
  it("Trace, On (AC) -> Overedge in the Marble -> a Normal Attack the next Turn -> the Round ends", async () => {
    await withSubjects([
      { from: "emiya", id: E, state: { factionId: "A" }, panel: { i: 5, j: 5 } },
      { from: "heracles", id: H, state: { factionId: "B" }, panel: { i: 5, j: 8 } },
    ], async ({ world: w }) => {
      w.answer({ title: "FGT.Window.combatPhaseStart", decline: true });
      w.answer({ title: "FGT.Window.combatPhaseStart", decline: true });
      w.dice.every(50);
      const cooldown = (id) => itemOf(w, E, id).system.cooldown.remaining;

      // Trace, On, as the player presses it.
      w.answer({ title: "Trace, On", pick: ["activatedCircuits"] });
      const traced = await castSkill(w, { caster: E, ability: itemOf(w, E, "emiya-trace-on").id, placement: { unitId: E } });
      expect(traced.ok).toBe(true);
      expect(held(w, E, "activatedCircuits")).toHaveLength(1);
      expect(held(w, E, "acNextNp")).toHaveLength(1);
      expect(held(w, E, "atkUpTrace")[0].system.expiry).toBe(NOW + 1);

      await itemOf(w, E, "emiya-hrunting").update({ "system.cooldown.remaining": 21 });
      // Room to gain: Trace, On's +5 left him at his maximum.
      await w.actor(E).update({ "system.luck.max": 30 });
      const luck = w.actor(E).system.luck.value;

      // Overedge: two Normal Attacks in the Marble, and the Noble Phantasm the second clause wants.
      const oe = itemOf(w, E, "emiya-overedge");
      await playAttack(w, {
        attacker: E, ability: oe.id, target: H,
        react: { [H]: ["nothing", "nothing", "declined", "declined"] },
      });
      // Two swings inside the Marble (+1 each) and the next NP (+2), once.
      expect(w.actor(E).system.luck.value).toBe(luck + 4);
      // His own cooldown 2◈ (6) and Hrunting's 21 each lost 1 per swing: the first clause. The Overdrive waits.
      expect(cooldown("emiya-hrunting")).toBe(19);
      expect(cooldown("emiya-overedge")).toBe(4);
      expect(held(w, E, "acNextNp")).toHaveLength(0);
      expect(held(w, E, "circuitsPending")).toHaveLength(0);
      expect(held(w, E, "acOverdrive")).toHaveLength(1);
      // Overedge's own use and one Kanshou & Bakuya per swing: three extensions.
      expect(held(w, E, "atkUpTrace")[0].system.expiry).toBe(NOW + 1 + 3);

      // His next Turn: a Normal Attack at Range 3, which Kanshou & Bakuya does not touch.
      await w.combat.update({ "system.globalTurn": NOW + 1 });
      await playAttack(w, { attacker: E, target: H, react: { [H]: ["nothing", "declined"] } });
      // First clause -1 and the Overdrive -2.
      expect(cooldown("emiya-hrunting")).toBe(16);
      expect(cooldown("emiya-overedge")).toBe(1);
      expect(w.actor(E).system.luck.value).toBe(luck + 5);

      // The Round ends.
      const { fireEvent } = await import("../../module/engine/scheduler.mjs");
      const { applyWorldIntents } = await import("../../module/engine/applier.mjs");
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const board = currentBoard();
      await applyWorldIntents(fireEvent("roundEnd", [board.units.find((u) => u.id === E)], {
        tick: NOW + 1, turnsPerRound: 3, board, options: new Set(), rolls: {},
      }), "test:roundEnd");
      expect(held(w, E, "acOverdrive")).toHaveLength(0);
      expect(held(w, E, "activatedCircuits")).toHaveLength(1);
    }, { ...opts, regions: [UBW] });
  }, 120_000);
});

/* ========================================================================== */
/*  Readings 8 and 9 -- Reinforcement, on the Combat Phase he is attacked in (#214) */
/* ========================================================================== */

describe("Reinforcement at the start of the Combat Phase he is attacked in (#208 readings 8, 9)", () => {
  const FOE = "heraclesAttacker";

  /** Press a Process's open questions from a script until it is complete (the helper plays declared Processes only). */
  const playOut = async (w, id, presses) => {
    const process = await import("../../module/engine/combat-process.mjs");
    const { advanceAttack } = await import("../../module/engine/attack.mjs");
    for (let step = 0; step < 20; step += 1) {
      const state = process.deserialize(w.messages.get(id).getFlag("fgt", "process"));
      if (process.isComplete(state)) return state;
      const prompt = process.pendingPrompt(state);
      const event = presses[prompt?.unitId]?.shift();
      if (!event) throw new Error(`Process ${id} asks ${prompt?.unitId} (${prompt?.kind}) and the script has no answer.`);
      await advanceAttack({ messageId: id, event });
    }
    throw new Error(`Process ${id} did not finish.`);
  };

  it("is offered and cast on the enemy's Turn; his Counter carries N.Atk Up; it is gone with the Phase", async () => {
    await withSubjects([
      { from: "heracles", id: FOE, state: { factionId: "A" }, panel: { i: 5, j: 5 } },
      { from: "emiya", id: E, state: { factionId: "B" }, panel: { i: 5, j: 6 } },
    ], async ({ world: w }) => {
      w.dice.every(50);
      const reinforcement = itemOf(w, E, "emiya-reinforcement");
      // The window question goes to its player, and the answer is the cast.
      w.answer({ title: "FGT.Window.defendingPhaseStart", pick: [reinforcement.id] });
      const { declared } = await playAttack(w, {
        attacker: FOE, target: E, react: { [E]: ["nothing", "counter"] },
      });
      const process = await import("../../module/engine/combat-process.mjs");
      const original = process.deserialize(w.messages.get(declared.messageId).getFlag("fgt", "process"));
      const counterId = original.history.find((h) => h.state === "counter" && h.event === "counter")?.detail?.counterMessageId;
      expect(counterId, "he Countered").toBeTruthy();

      // Cast on the ENEMY's Turn, from the window: the engine said so (`atWindow`).
      // HEAD: an expiry a third of a Round out; now it has no clock but the Phase's end.
      const [buff] = held(w, E, "nAtkUp");
      expect(buff.system.endsOn).toBe("combatPhaseEnd");
      expect(buff.system.expiry).toBeNull();
      expect(reinforcement.system.cooldown.remaining).toBe(3);

      // The Phase is still open: the Counter waits on the foe. Finish it.
      await playOut(w, counterId, { [FOE]: ["nothing", "declined"], [E]: ["declined"] });
      const names = (w.messages.get(counterId).getFlag("fgt", "result")?.breakdown ?? [])
        .flatMap((b) => (b.contributors ?? []).map((c) => c.note ?? c.source ?? "")).join(" | ");
      // His Counter is a Normal Attack inside the Phase, and carries it.
      expect(names).toMatch(/nAtkUp/);

      // ...and the Phase over, it is gone. HEAD: it stood for the rest of the Turn.
      expect(held(w, E, "nAtkUp")).toHaveLength(0);
    }, opts);
  }, 60_000);
});

/* ========================================================================== */
/*  Reading 15 -- any successful Evade cuts Eye of the Mind's Cooldown (#215)   */
/* ========================================================================== */

describe("a successful Evade cuts Eye of the Mind's shared Cooldown by one third of a Round (#208 reading 15, pinned: as built)", () => {
  // Ruled 2026-10-14: any Evade that succeeds counts, Dodge included. Already how it is built
  // (`attack.mjs#autoEvadeFrom` raises `evadeSucceeded` for a Dodge as for a rolled Evade); these pin it.
  const FOE = "heraclesAttacker";
  const board15 = () => [
    { from: "heracles", id: FOE, state: { factionId: "A" }, panel: { i: 5, j: 5 } },
    { from: "emiya", id: E, state: { factionId: "B" }, panel: { i: 5, j: 6 } },
  ];

  it("Dodge from the Skill itself: 4◈ is 12 ticks, minus one third of a Round is 11, on both Ranks' mirrored clocks", async () => {
    await withSubjects(board15(), async ({ world: w }) => {
      // Reinforcement is offered at the start of a Combat Phase he is attacked in (#214): not taken here.
      w.answer({ title: "FGT.Window.defendingPhaseStart", decline: true });
      w.dice.every(50);
      const eye = itemOf(w, E, "emiya-eye-of-the-mind-true");
      // His Health is above 20%, so the B form is the one offered.
      await playAttack(w, {
        attacker: FOE, target: E,
        // The Skill's Dodge takes the Evade rung itself; the Lucky Hit is his foe's to decline, the Counter his.
        react: { [E]: [`ability:${eye.id}`, "declined"], [FOE]: ["declined"] },
      });
      expect(itemOf(w, E, "emiya-eye-of-the-mind-true").system.cooldown.remaining).toBe(11);
      expect(itemOf(w, E, "emiya-eye-of-the-mind-true-ex").system.cooldown.remaining).toBe(11);
    }, opts);
  }, 60_000);

  it("a rolled Evade that succeeds cuts it too", async () => {
    await withSubjects(board15(), async ({ world: w }) => {
      // Reinforcement is offered at the start of a Combat Phase he is attacked in (#214): not taken here.
      w.answer({ title: "FGT.Window.defendingPhaseStart", decline: true });
      w.dice.every(50);
      // Start from a running clock on both, as after an earlier use.
      for (const id of ["emiya-eye-of-the-mind-true", "emiya-eye-of-the-mind-true-ex"]) {
        await itemOf(w, E, id).update({ "system.cooldown.remaining": 12 });
      }
      // A roll UNDER his Agility succeeds, and the test world starts it at nothing.
      await w.actor(E).update({ "system.agility.max": 20, "system.agility.value": 20 });
      w.dice.set("d20", 1);
      await playAttack(w, {
        attacker: FOE, target: E,
        react: { [E]: ["evade", "declined"], [FOE]: ["declined"] },
      });
      expect(itemOf(w, E, "emiya-eye-of-the-mind-true").system.cooldown.remaining).toBe(11);
      expect(itemOf(w, E, "emiya-eye-of-the-mind-true-ex").system.cooldown.remaining).toBe(11);
    }, opts);
  }, 60_000);
});

/* ========================================================================== */
/*  Readings 18, 19 -- Rho Aias holds against Gáe Bolg Alternative, and lasts one NP (#216) */
/* ========================================================================== */

describe("Rho Aias against a thrown weapon, and for that one Noble Phantasm only (#208 readings 18, 19)", () => {
  const SC = "scathachThrower0", ATT = "anastasiaThrower", D2 = "heraclesProtected", N = "medeaNeighbour00", M = "emiyasMaster0000";
  const at = { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18 }, actingFactionId: "A" } };

  /** `attacker` hits Heracles with a huge Atk Up while EMIYA, beside him, projects Rho Aias. */
  const board = (attacker) => [
    // A Servant's Base Attack is derived from her parameters, so the size is a damage multiplier: x10.
    { from: attacker.from, id: attacker.id, state: { factionId: "A" }, panel: { i: 5, j: 5 },
      effects: [{ defId: "atkUp", magnitude: 900, npMagnitude: 900 }] },
    { from: "heracles", id: D2, state: { factionId: "B" }, panel: { i: 5, j: 9 } },
    { from: "emiya", id: E, state: { factionId: "B", masterId: M }, panel: { i: 5, j: 10 } },
    // Inside the 3x3 around the protected Unit and not the target: it receives the barrier and is not hit.
    { from: "medea", id: N, state: { factionId: "B" }, panel: { i: 4, j: 9 } },
    { from: "master-advanced", id: M, state: { factionId: "B" }, panel: { i: 5, j: 12 } },
  ];

  /** Play the attack with Rho Aias taken, and hand back what the board looks like. */
  const withRhoAias = async (attacker, abilityContentId, check) => withSubjects(board(attacker), async ({ world: w }) => {
    w.dice.every(99); // Instakill (75%) does not land; Stun (500%) does.
    // Anastasia is offered Watermelon at the start of her Combat Phase; Scathach has nothing there.
    if (attacker.from === "anastasia") w.answer({ title: "FGT.Window.combatPhaseStart", decline: true });
    const rho = itemOf(w, E, "emiya-rho-aias");
    const np = itemOf(w, attacker.id, abilityContentId);
    const hp = w.actor(D2).system.health.value;
    const emiyaHp = w.actor(E).system.health.value;
    const { declared } = await playAttack(w, {
      attacker: attacker.id, ability: np.id, target: D2,
      react: { [D2]: [`ability:${rho.id}`, "declined"] },
    });
    await check({ w, declared, rho, hp, emiyaHp });
  }, at);

  it("Gáe Bolg Alternative is a thrown weapon: the barrier ends at 1 and the hit does nothing", async () => {
    await withRhoAias({ from: "scathach", id: SC }, "scathach-gae-bolg-alternative", ({ w, declared, hp, emiyaHp }) => {
      const result = w.messages.get(declared.messageId).getFlag("fgt", "result");
      // HEAD: the barrier broke (pool 0) and the rest went through to Heracles.
      expect(itemOf(w, E, "emiya-rho-aias").system.shieldHealth).toBe(1);
      expect(result.total).toBe(0);
      expect(w.actor(D2).system.health.value).toBe(hp);
      // For every 200 it lost, EMIYA lost 100: 1399 lost is six hundreds.
      expect(w.actor(E).system.health.value).toBe(emiyaHp - 600);
      // OPEN (Ch. 46 §46.30): the NP's Stun and Instakill are tried `beforeDamage` on the protected Unit whatever the
      // barrier absorbed, and whether Rho Aias also stops an NP's effects is a rule nobody has ruled. Recorded as built.
      const rows = [...w.messages.values()].flatMap((m) => m.getFlag?.("fgt", "effects") ?? []);
      expect(rows.find((e) => e.id === "stun")?.outcome).toBe("applied");
      expect(rows.find((e) => e.id === "instakill")?.outcome).not.toBe("applied");
    });
  }, 90_000);

  it("an ordinary Noble Phantasm of the same size breaks it and the rest goes through (pinned: as built)", async () => {
    await withRhoAias({ from: "anastasia", id: ATT }, "anastasia-snegleta", ({ w, declared, hp, emiyaHp }) => {
      expect(itemOf(w, E, "emiya-rho-aias").system.shieldHealth).toBe(0);
      expect(w.messages.get(declared.messageId).getFlag("fgt", "result").total).toBeGreaterThan(0);
      expect(w.actor(D2).system.health.value).toBeLessThan(hp);
      expect(w.actor(E).system.health.value).toBe(emiyaHp - 700);
    });
  }, 90_000);

  it("is gone with the Noble Phantasm it answered: from the Unit it covered and from the neighbours the NP did not hit", async () => {
    await withRhoAias({ from: "scathach", id: SC }, "scathach-gae-bolg-alternative", ({ w }) => {
      // HEAD: all three kept `rhoAias` for a third of a Round after the NP had been answered.
      expect(held(w, D2, "rhoAias")).toHaveLength(0);
      expect(held(w, E, "rhoAias")).toHaveLength(0);
      // Never hit, never in the Process, and so never told the Combat Phase had ended.
      expect(held(w, N, "rhoAias")).toHaveLength(0);
    });
  }, 90_000);
});
