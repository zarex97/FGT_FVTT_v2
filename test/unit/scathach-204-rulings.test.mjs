/**
 * @file The second round of Scáthach's rulings (#204, ruled 2026-10-14).
 * @see module/engine/skill-use.mjs#resourceLine, module/rules/copy.mjs#canCopy
 *
 * The open findings her press left (§46.4-LH to LK) and the two questions
 * beside them. LH (guards) is held in `master-guard.test.mjs`, `cover.test.mjs`
 * and `pale-rider.test.mjs`; LI (`damageStepEnd` at 0) in
 * `castor-pollux-crit.test.mjs`; LJ (Round 1) in `reaction-attack-budget.test.mjs`.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { castSkill, playAttack } from "../helpers/process.mjs";
import { resourceLine } from "../../module/engine/skill-use.mjs";
import { copyCandidates, canCopy } from "../../module/rules/copy.mjs";
import { currentBoard } from "../../module/engine/board.mjs";
import { readFileSync, readdirSync } from "node:fs";
import { parse } from "yaml";
import { CommandSpellRegistry } from "../../module/rules/cs-registry.mjs";
import { teleportPanels, teleportLandings } from "../../module/rules/command-spells.mjs";
import * as cp from "../../module/engine/combat-process.mjs";

beforeAll(prepareSubjects, 120_000);

const S = "scathachCaster00";
const at = { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18 }, actingFactionId: "A" } };

describe("a Skill card lists its resource changes (LK)", () => {
  it("words the real numbers, a clamp included", () => {
    expect(resourceLine("agility.value", 12, 16)).toBe("Agility 12 → 16");
    expect(resourceLine("resources.prs.value", 2, 1)).toBe("PRS 2 → 1");
    expect(resourceLine("fragarachTokens", 0, 1)).toBe("Fragarach Tokens 0 → 1");
    expect(resourceLine("agility.value", 16, 16)).toBe("Agility 16 (no change)");
    expect(resourceLine("agility.value", null, 16)).toBeNull();
  });

  it("puts Ár's +4 Agility beside its Atk Up", async () => {
    // Live: the card read "Atk Up" alone while Agility went 12 → 16.
    await withSubjects([
      { from: "scathach", id: S, state: { factionId: "A" }, panel: { i: 5, j: 5 } },
    ], async ({ world: w }) => {
      await w.actor(S).update({ "system.agility.max": 16, "system.agility.value": 10 });
      const ar = [...w.actor(S).items].find((i) => i.system.contentId === "scathach-ar");
      const out = await castSkill(w, { caster: S, ability: ar.id, placement: { unitId: S } });
      expect(out.ok).toBe(true);
      expect(w.actor(S).system.agility.value).toBe(14);
      const used = (game.combat.getFlag("fgt", "log") ?? []).find((e) => e.event === "skillUsed");
      expect(used.applied.map((a) => a.name)).toEqual(expect.arrayContaining(["Agility 10 → 14"]));
    }, at);
  }, 60_000);
});

describe("an Attack's caster phases say what they did (LK)", () => {
  it("Toole Fragarach's 3 tokens show on a card", async () => {
    // The attack path ran the caster phases and dropped their lines, so a
    // resource an Attack spends or restores was seen by nobody.
    const MN = "mannananCaster01", H = "heraclesDefender";
    await withSubjects([
      { from: "mannanan", id: MN, state: { factionId: "A" }, panel: { i: 5, j: 5 } },
      { from: "heracles", id: H, state: { factionId: "B" }, panel: { i: 5, j: 6 } },
    ], async ({ world: w }) => {
      await w.actor(MN).update({ "system.resources.fragarachTokens.value": 4, "system.resources.fragarachTokens.max": 9 });
      const tf = [...w.actor(MN).items].find((i) => i.system.contentId === "mannanan-toole-fragarach");
      w.dice.every(50);
      // Her passive offers its choice on every Attack; declined, it is out of the way.
      w.answer({ title: "God's Holder: Tradition Carrier", by: "u1", decline: true });
      await playAttack(w, { attacker: MN, ability: tf.id, target: H, react: { [H]: ["nothing", "nothing", "nothing", "declined"] } });
      const rows = [...w.messages.values()].filter((m) => m.getFlag?.("fgt", "kind") === "skill")
        .flatMap((m) => m.getFlag("fgt", "rows").map((r) => r.name));
      expect(rows).toContain("Fragarach Tokens 4 → 1");
    }, at);
  }, 60_000);
});

describe("a Spell is not a Skill to copy (Q5)", () => {
  it("refuses Medea's six Spells and keeps her Active Skills", async () => {
    // Ruled 2026-10-14: every one of her Spells was offered to Wisdom of Dún
    // Scáith. The board projected neither half of "is a Spell" for the copier.
    const ME = "medeaSource00001";
    await withSubjects([
      { from: "scathach", id: S, state: { factionId: "A" }, panel: { i: 5, j: 5 } },
      { from: "medea", id: ME, state: { factionId: "B" }, panel: { i: 5, j: 8 } },
    ], async () => {
      const board = currentBoard();
      const offered = copyCandidates(board, board.units.find((u) => u.id === S))
        .filter((c) => c.unitId === ME).map((c) => c.ability.contentId);
      for (const spell of ["medea-aero", "medea-argos", "medea-atlas", "medea-keraino", "medea-rain-of-light", "medea-trofa"]) {
        expect(offered).not.toContain(spell);
      }
      expect(offered.length).toBeGreaterThan(0);
      const aero = board.units.find((u) => u.id === ME).abilities.find((a) => a.contentId === "medea-aero");
      expect(canCopy(aero)).toEqual({ ok: false, reason: "spell" });
    }, at);
  }, 60_000);

  it("reads the category as well as the flag", () => {
    expect(canCopy({ category: "spell", hasPhases: true }).reason).toBe("spell");
    expect(canCopy({ isSpell: true, hasPhases: true }).reason).toBe("spell");
    expect(canCopy({ hasPhases: true }).ok).toBe(true);
  });
});

/** The reference Command Spells, loaded as `fgt.mjs` loads the pack. */
function loadCommands() {
  const docs = readdirSync("packs/_source/command-spells").filter((f) => f.endsWith(".yml")).map((f) => f.slice(0, -4)).map((id) => {
    const y = parse(readFileSync(`packs/_source/command-spells/${id}.yml`, "utf8"));
    return { name: y.name, system: { ...y, contentId: y.id } };
  });
  CommandSpellRegistry.load(docs);
}

describe("where a teleport lands (Q6)", () => {
  const master = { id: "m", kind: "master", faction: "B", panel: { i: 1, j: 1 } };
  const servant = { id: "s", kind: "servant", faction: "B", masterId: "m", panel: { i: 8, j: 8 } };
  const zones = { hb: { faction: "B", panels: [{ i: 0, j: 0 }, { i: 0, j: 1 }, { i: 0, j: 2 }] }, foe: { faction: "A", panels: [{ i: 9, j: 9 }] } };
  const board = (extra = []) => ({ units: [master, servant, ...extra], zones, bounds: { rows: 10, columns: 10 } });
  const escape = { kind: "teleport", target: "pair", anchor: "homeBase", unitId: "s" };

  it("offers Escape the free panels of the Master's own Home Base", () => {
    const blocker = { id: "x", kind: "servant", panel: { i: 0, j: 0 } };
    expect(teleportPanels(escape, { master, servant, board: board([blocker]) })).toEqual([{ i: 0, j: 1 }, { i: 0, j: 2 }]);
  });

  it("lands the pair side by side, never on one panel", () => {
    const out = teleportLandings(escape, { master, servant, board: board() }, { i: 0, j: 1 });
    expect(out).toEqual([{ unitId: "m", panel: { i: 0, j: 1 } }, { unitId: "s", panel: { i: 0, j: 0 } }]);
    expect(teleportLandings(escape, { master, servant, board: board() }, { i: 5, j: 5 })).toBeNull();
    expect(teleportLandings(escape, { master, servant, board: board() }, null)).toBeNull();
  });
});

describe("a Command Spell beats Gate of Skye (Q6)", () => {
  const D = "drakeDefender000", M = "drakesMaster0000";

  /** The Gate north over Drake, her Master well away; `play` gets the open Process. */
  async function gateOverDrake(play) {
    loadCommands();
    await withSubjects([
      { from: "scathach", id: S, state: { factionId: "A" }, panel: { i: 7, j: 5 } },
      { from: "drake", id: D, state: { factionId: "B", masterId: M }, panel: { i: 4, j: 5 } },
      { from: "master-advanced", id: M, state: { factionId: "B" }, panel: { i: 1, j: 9 } },
    ], async ({ world: w }) => {
      await w.actor(D).update({ "system.luck.max": 10, "system.luck.value": 10 });
      await w.actor(M).update({ "system.commandSpells": 3 });
      const gate = [...w.actor(S).items].find((i) => i.system.contentId === "scathach-gate-of-skye");
      // Every die high: without the Command Spell her Luck Check fails, and that is Death.
      w.dice.every(20);
      const { resolveAttack } = await import("../../module/engine/attack.mjs");
      const declared = await resolveAttack({ attackerId: S, abilityId: gate.id, placement: { direction: "n", chosenIds: [D] } });
      const id = declared.processes[0].messageId;
      await play(w, id);
    }, at);
  }

  it("Teleport Servant carries Drake out, and the Gate resolves against nobody", async () => {
    await gateOverDrake(async (w, id) => {
      const { spendCommandSpell } = await import("../../module/engine/command-spells.mjs");
      const out = await spendCommandSpell({ masterId: M, commandId: "cs-teleport-servant", messageId: id, context: { destination: { i: 1, j: 8 } } });
      expect(out).toMatchObject({ ok: true });
      const { advanceAttack } = await import("../../module/engine/attack.mjs");
      for (let n = 0; n < 10; n += 1) {
        const st = cp.deserialize(w.messages.get(id).getFlag("fgt", "process"));
        const prompt = cp.pendingPrompt(st);
        if (cp.isComplete(st) || !prompt) break;
        await advanceAttack({ messageId: id, event: prompt.kind === "reaction" ? "nothing" : "declined" });
      }
      const st = cp.deserialize(w.messages.get(id).getFlag("fgt", "process"));
      expect(st.history.map((h) => h.state)).toContain("noDamage");
      expect(st.interrupts).toEqual([expect.objectContaining({ kind: "escape", command: "cs-teleport-servant", applied: true })]);
      expect(w.actor(D).system.defeated).toBeFalsy();
      expect(w.actor(D).system.health.value).toBe(w.actor(D).system.health.max);
      expect(currentBoard().units.find((u) => u.id === D).panel).toEqual({ i: 1, j: 8 });
      expect(w.actor(M).system.commandSpells).toBe(2);
    });
  }, 60_000);

  it("is refused before it is paid for when there is nowhere to land", async () => {
    await gateOverDrake(async (w, id) => {
      const { spendCommandSpell } = await import("../../module/engine/command-spells.mjs");
      expect(await spendCommandSpell({ masterId: M, commandId: "cs-teleport-servant", messageId: id }))
        .toEqual({ ok: false, reason: "noDestination" });
      expect(w.actor(M).system.commandSpells).toBe(3);
    });
  }, 60_000);
});

describe("a Command Spell serves its own Master's Servant (LM, LN, Q3, Q4)", () => {
  const H = "heraclesAttacker", D = "drakeDefender000", C = "castorSecond0000", M = "drakesMaster0000";
  const M2 = "otherMaster00001", E = "emiyaOtherServ01";

  /**
   * Heracles swings at Drake. Her Master holds her and Castor; a second Master
   * on her side holds EMIYA. `play` gets the Process at its reaction rung.
   */
  async function swingAtDrake(play, { castorDown = false } = {}) {
    loadCommands();
    await withSubjects([
      { from: "heracles", id: H, state: { factionId: "A" }, panel: { i: 5, j: 4 } },
      { from: "drake", id: D, state: { factionId: "B", masterId: M }, panel: { i: 5, j: 5 } },
      { from: "castor", id: C, state: { factionId: "B", masterId: M, ...(castorDown ? { defeated: true } : {}) }, panel: { i: 6, j: 6 } },
      { from: "master-advanced", id: M, state: { factionId: "B" }, panel: { i: 5, j: 7 } },
      { from: "emiya", id: E, state: { factionId: "B", masterId: M2 }, panel: { i: 3, j: 6 } },
      { from: "master-advanced", id: M2, state: { factionId: "B" }, panel: { i: 3, j: 8 } },
    ], async ({ world: w }) => {
      for (const id of [M, M2]) await w.actor(id).update({ "system.commandSpells": 3 });
      const { resolveAttack } = await import("../../module/engine/attack.mjs");
      const declared = await resolveAttack({ attackerId: H, abilityId: null, placement: { unitId: D, chosenIds: [D] } });
      const id = declared.processes?.[0]?.messageId ?? declared.messageId;
      await play(w, id, cp.deserialize(w.messages.get(id).getFlag("fgt", "process")));
    }, at);
  }

  const offers = async (state) => {
    const { processOffers } = await import("../../module/engine/command-spells.mjs");
    return processOffers(state).map((o) => `${o.masterId}:${o.command.id}:${o.servantId}`);
  };

  it("offers a command that changes the attack only for the Servant in it", async () => {
    await swingAtDrake(async (w, id, state) => {
      expect(state.state).toBe("react");
      const list = await offers(state);
      // Damage Block shields Drake, the one attacked, and nobody else's.
      expect(list).toContain(`${M}:cs-damage-block:${D}`);
      expect(list).not.toContain(`${M}:cs-damage-block:${C}`);
      expect(list.filter((o) => o.startsWith(`${M2}:cs-damage-block`))).toEqual([]);
      // A heal does not touch the attack: Drake's Master, for each of its
      // Servants. EMIYA's Master is in no Contract with a Unit of this attack,
      // and offers nothing on its card (ruled 2026-10-17, #241).
      expect(list).toEqual(expect.arrayContaining([`${M}:cs-half-heal:${D}`, `${M}:cs-half-heal:${C}`]));
      expect(list.filter((o) => o.startsWith(`${M2}:`))).toEqual([]);
    });
  }, 60_000);

  it("offers nothing for a Servant that is defeated", async () => {
    await swingAtDrake(async (w, id, state) => {
      expect((await offers(state)).filter((o) => o.endsWith(`:${C}`))).toEqual([]);
    }, { castorDown: true });
  }, 60_000);

  it("refuses, before it charges, a command the card does not offer", async () => {
    await swingAtDrake(async (w, id) => {
      const { spendCommandSpell } = await import("../../module/engine/command-spells.mjs");
      expect(await spendCommandSpell({ masterId: M2, commandId: "cs-damage-block", messageId: id, context: { servantId: E } }))
        .toEqual({ ok: false, reason: "notInThisAttack" });
      expect(w.actor(M2).system.commandSpells).toBe(3);
      // ...and spends one it does, on the Servant it names.
      expect(await spendCommandSpell({ masterId: M, commandId: "cs-damage-block", messageId: id, context: { servantId: D } }))
        .toMatchObject({ ok: true });
      expect(w.actor(M).system.commandSpells).toBe(2);
    });
  }, 60_000);

  it("heals the Servant the Master names, not the first one listed", async () => {
    await swingAtDrake(async (w) => {
      await w.actor(C).update({ "system.health.value": 100 });
      const before = w.actor(D).system.health.value;
      const { spendCommandSpell } = await import("../../module/engine/command-spells.mjs");
      // Spent in the Process Heracles opened, on Faction A's Turn: the attack
      // card's window, not the bar's `ownTurn`, which is the Master's own Turn
      // only (#359 ruling 6).
      expect(await spendCommandSpell({ masterId: M, commandId: "cs-half-heal", window: "react", context: { servantId: C } }))
        .toMatchObject({ ok: true });
      expect(w.actor(C).system.health.value).toBeGreaterThan(100);
      expect(w.actor(D).system.health.value).toBe(before);
    });
  }, 60_000);

  it("leaves the escape rung no free escape", () => {
    expect(cp.PROMPTS.s23_acceptOrEscape.options).toEqual(["accept"]);
  });

  it("offers a reaction ability on the reaction rung, never after a failed Evade (LO)", () => {
    // Ruled 2026-10-14: Eye of the Mind (False) does not answer the escape rung.
    const base = { attackerId: "a", defenderId: "d", reactionAbilities: { d: [{ id: "eye", name: "Eye of the Mind (False)" }] } };
    expect(cp.pendingPrompt({ ...base, state: "react" }).options).toContain("ability:eye");
    for (const state of ["s23_acceptOrEscape", "s24_luckyEvasion"]) {
      const prompt = cp.pendingPrompt({ ...base, state });
      expect((prompt.options ?? []).filter((o) => o.startsWith("ability:"))).toEqual([]);
      expect(prompt.abilities).toEqual([]);
    }
  });
});
