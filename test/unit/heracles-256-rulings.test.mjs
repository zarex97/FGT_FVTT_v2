/**
 * @file Heracles's audit rulings, played in the test world (#256).
 * @see docs/superpowers/specs/2026-10-19-heracles-clauses.md, module/rules/revival.mjs
 *
 * Reading 6, ruled 2026-10-19: an Instakill from an Attack is that Attack
 * reducing his Health to 0. God Hand revives him and records it, and the next
 * time that Attack's Instakill leaves him at 1.
 *
 * Pressed live before the fix: Scáthach's Gáe Bolg Alternative Instakilled
 * him, God Hand revived him and recorded it; the second Instakill spent another
 * use (*"Uses spent: 1; 3 left."*) where the record should have held him at 1.
 * The damage step's floor never saw an Instakill, which skips the damage.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { playAttack } from "../helpers/process.mjs";

beforeAll(prepareSubjects, 120_000);

const SC = "scathachHerc0256", HE = "heraclesHerc0256";
// Intermediate: no Prevention Luck Check is offered, so nothing asks.
const WAR = { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18, difficulty: "intermediate", npGateRound: 1 }, actingFactionId: "A" } };

/** Gáe Bolg Alternative into Heracles at 300, the Instakill's d100 scripted to land. */
async function gaeBolg(recorded, check) {
  await withSubjects([
    { from: "scathach", id: SC, panel: { i: 5, j: 5 }, state: { factionId: "A" } },
    { from: "heracles", id: HE, panel: { i: 5, j: 9 }, state: { factionId: "B" } },
  ], async ({ world: w }) => {
    const gae = w.actor(SC).items.find((i) => i.system.contentId === "scathach-gae-bolg-alternative");
    const godHand = () => w.actor(HE).items.find((i) => i.system.contentId === "heracles-god-hand");
    await w.actor(HE).update({ "system.health.value": 300 });
    // Battle Continuation on its Cooldown, as it stood live: God Hand is next.
    await w.actor(HE).items.find((i) => i.system.contentId === "class-battle-continuation")
      .update({ "system.cooldown.remaining": 9 });
    if (recorded) await godHand().update({ "system.recordedAttacks": [`ability:${gae.id}`] });
    w.dice.set("d100", 10);
    await playAttack(w, { attacker: SC, ability: gae.id, target: HE, react: { [HE]: ["nothing", "declined"] } });
    await check({ w, gae, godHand: godHand() });
  }, WAR);
}

describe("an Instakill and God Hand's record (#256 reading 6)", () => {
  it("revives him through God Hand the first time, and records the Attack", async () => {
    await gaeBolg(false, async ({ w, gae, godHand }) => {
      expect(w.actor(HE).system.defeated).toBeFalsy();
      expect(godHand.system.timesUsed).toBeGreaterThanOrEqual(1);
      expect([...godHand.system.recordedAttacks]).toContain(`ability:${gae.id}`);
    });
  }, 60_000);

  it("leaves him at 1 once that Attack is recorded, spending nothing", async () => {
    await gaeBolg(true, async ({ w, godHand }) => {
      expect(w.actor(HE).system.health.value).toBe(1);
      expect(w.actor(HE).system.defeated).toBeFalsy();
      expect(godHand.system.timesUsed ?? 0).toBe(0);
    });
  }, 60_000);
});

/**
 * Reading 2, ruled 2026-10-19: the Command Spell holds Mad Enhancement off for
 * 1◈, then it switches back on by itself, lock or no lock. Pressed live before
 * the fix: suspended at tick 5 to tick 8, it was still off at tick 8 and his
 * player's bar offered nothing; Bravery stayed live for good.
 */
describe("Mad Enhancement after the Command Spell's span (#256 reading 2)", () => {
  /** Heracles with Mad Enhancement suspended to tick 8, at `tick`. */
  const suspended = (tick, check) => withSubjects([
    { from: "heracles", id: HE, panel: { i: 5, j: 9 }, state: { factionId: "B" } },
  ], async ({ world: w }) => {
    const me = () => w.actor(HE).items.find((i) => i.system.slug === "madEnhancement");
    await me().update({ "system.active": false, "system.suspendedUntil": 8 });
    const { reconcileForcedModes } = await import("../../module/engine/modes.mjs");
    await reconcileForcedModes();
    await check({ w, me: me() });
  }, { tokens: true, tick, combat: { round: 3, started: true, system: { globalTurn: tick }, actingFactionId: "B" } });

  it("stays off while the span runs", async () => {
    await suspended(7, async ({ me }) => expect(me.system.active).toBe(false));
  });

  it("is on again once it has passed, and says so", async () => {
    await suspended(8, async ({ w, me }) => {
      expect(me.system.active).toBe(true);
      expect([...w.messages.values()].map((m) => m.content ?? "").join(" ")).toContain("FGT.Mode.SuspensionLapsed");
    });
  });
});

/**
 * Battle Continuation's *"Health must have been restored back to above half
 * its maximum value at least once since the last activation"*. Pressed live:
 * healed above half at tick 11, killed and revived by it at tick 11, its
 * Cooldown staged off, killed again at tick 11: it revived him again. The
 * crossing and the activation shared a tick, and the gate read "not before".
 */
describe("Battle Continuation's half-Health gate within one Turn (#256)", () => {
  it("does not count a crossing made before the activation it follows", async () => {
    await withSubjects([
      { from: "medea", id: "medeaHerc0256bc", panel: { i: 5, j: 8 }, state: { factionId: "A" } },
      { from: "heracles", id: HE, panel: { i: 5, j: 9 }, state: { factionId: "B" } },
    ], async ({ world: w }) => {
      const bc = () => w.actor(HE).items.find((i) => i.system.contentId === "class-battle-continuation");
      const gh = () => w.actor(HE).items.find((i) => i.system.contentId === "heracles-god-hand");
      const { worldIO } = await import("../../module/engine/io.mjs");
      // Above half through the engine's own Health path, which stamps the crossing.
      await w.actor(HE).update({ "system.health.value": 600 });
      await worldIO().adjustHealth(HE, 500);
      expect(Object.keys(w.actor(HE).system.healthWatermarks)).toContain("50");

      const budget = await import("../../module/engine/budget.mjs");
      const kill = async () => {
        // A second Attack in one Turn: the attacker's record and pool reset, as staged live.
        await budget.reset(w.combat, "A");
        await w.actor("medeaHerc0256bc").update({ "system.turnState.attacked": false, "system.turnState.acted": false });
        await w.actor(HE).update({ "system.health.value": 1 });
        await playAttack(w, { attacker: "medeaHerc0256bc", target: HE, react: { [HE]: ["nothing", "declined"] } });
      };
      await kill();
      expect(bc().system.lastUsedTick).toBe(18);
      expect(w.actor(HE).system.healthWatermarks?.["50"], "the activation wipes the mark").toBeUndefined();

      await bc().update({ "system.cooldown.remaining": 0 });
      await gh().update({ "system.recordedAttacks": [] });
      const before = gh().system.timesUsed ?? 0;
      await kill();
      expect(w.actor(HE).system.defeated).toBeFalsy();
      expect(gh().system.timesUsed, "God Hand, not Battle Continuation, brought him back").toBeGreaterThan(before);
    }, { ...WAR, combat: { ...WAR.combat, system: { ...WAR.combat.system, difficulty: "intermediate" } } });
  }, 60_000);
});

/**
 * Found on the Heracles audit's War: the GM's Wisdom of Dún Scáith offer, built
 * while the GM was looking at another scene, read *"Nothing on the field can be
 * copied"* over a pool of three Servants. The list reads the canvas's board.
 */
describe("the copy offer, away from the War's board (#256)", () => {
  it("is no list at all, rather than an empty one, while the copier is not on the board", async () => {
    await withSubjects([
      { from: "scathach", id: SC, panel: { i: 5, j: 5 }, state: { factionId: "A" } },
      { from: "heracles", id: HE, panel: { i: 5, j: 9 }, state: { factionId: "B" } },
    ], async () => {
      const { offerCopies } = await import("../../module/engine/copy.mjs");
      expect(offerCopies({ copierId: SC })).toBeNull();
    }, { tokens: false });
  });

  it("lists the field once it is", async () => {
    await withSubjects([
      { from: "scathach", id: SC, panel: { i: 5, j: 5 }, state: { factionId: "A" } },
      { from: "heracles", id: HE, panel: { i: 5, j: 9 }, state: { factionId: "B" } },
    ], async () => {
      const { offerCopies } = await import("../../module/engine/copy.mjs");
      const names = (offerCopies({ copierId: SC }) ?? []).map((c) => c.ability.name);
      expect(names).toEqual(expect.arrayContaining(["Indomitable", "Eye of the Mind (False)"]));
    }, { tokens: true });
  });
});
