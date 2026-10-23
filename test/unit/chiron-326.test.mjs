/**
 * @file Chiron (Archer), the audit of #326: his sheet through the real projection.
 * @see docs/superpowers/specs/2026-10-23-chiron-clauses.md
 *
 * Every subject is `packs/_source/servants/chiron.yml` as authored, compiled and
 * kept by the DataModel (`test/helpers/subject.mjs`).
 */

import { beforeAll, describe, expect, it, vi } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";

beforeAll(prepareSubjects, 120_000);
vi.setConfig({ testTimeout: 60_000 });

const CH = "chironArcher0001", FOE = "chironFoe0000001", ALLY = "chironAlly000001";
const WAR = { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18, npGateRound: 1 }, actingFactionId: "A" } };
const abilityOf = (w, id, contentId) => w.actor(id).items.find((i) => i.system.contentId === contentId);

describe("the sheet (ST*)", () => {
  it("is Chiron, a Lawful Good Archer from Greece, every figure the table's", async () => {
    await withSubjects([{ from: "chiron", id: CH }], ({ world: w, unit }) => {
      const c = unit(CH);
      const s = w.actor(CH).system;
      expect(w.actor(CH).name).toBe("Chiron");
      expect([...s.servantClasses]).toEqual(["archer"]);
      expect(s.alignment).toMatchObject({ order: "lawful", morality: "good" });
      expect([...s.region]).toEqual(["greece"]);
      expect(c.baseAttack).toEqual(expect.objectContaining({ str: 125, mag: 175 }));
      expect(c.maxHealth ?? c.health?.max).toBe(1250);
      expect(c.mov).toBe(6);
      expect(c.range).toBe(4);
      expect(s.normalAttack.component).toBe("str");
      expect(c.attributes).toEqual(expect.arrayContaining(["male", "servant", "sky", "humanoid", "nonHominidae"]));
    });
  });
});

describe("Great Sage of Centaurs (GS*)", () => {
  const centaur = (w) => abilityOf(w, CH, "chiron-great-sage-of-centaurs");

  it("switches once per Round, in his own Turn, as a Mode", async () => {
    await withSubjects([{ from: "chiron", id: CH }], ({ world: w }) => {
      expect(centaur(w).system).toMatchObject({ isMode: true, oncePerRound: true });
    });
  });

  it("in Centaur Form: MOV 8, Evade rolls +2, Passenger Seat, and no longer Humanoid", async () => {
    await withSubjects([{ from: "chiron", id: CH }], async ({ world: w }) => {
      await centaur(w).update({ "system.active": true });
      const { snapshotUnit } = await import("../../module/rules/snapshot.mjs");
      const c = snapshotUnit(w.actor(CH), { panel: { i: 5, j: 5 } });
      expect(c.mov).toBe(8);
      expect(c.attributes).not.toContain("humanoid");
      expect(c.attributes).toEqual(expect.arrayContaining(["sky", "servant"]));
      expect(c.grantedAbilities).toContain("passengerSeat");
      const evade = (c.checkModifiers ?? []).filter((m) => m.check === "evade" && (m.direction ?? "outgoing") === "outgoing");
      // +2 from the form, −3 from Eye of the Mind (True).
      expect(evade.map((m) => m.value).sort()).toEqual([-3, 2]);
    });
  });

  it("in Human Form the statblock stands: MOV 6, Humanoid, no seat", async () => {
    await withSubjects([{ from: "chiron", id: CH }], async ({ world: w }) => {
      const { snapshotUnit } = await import("../../module/rules/snapshot.mjs");
      const c = snapshotUnit(w.actor(CH), { panel: { i: 5, j: 5 } });
      expect(c.mov).toBe(6);
      expect(c.attributes).toContain("humanoid");
      expect(c.grantedAbilities ?? []).not.toContain("passengerSeat");
    });
  });
});

describe("Antares Snipe aims at a weak point at +75 (AS.weak, ruling 12)", () => {
  it("adds its bonus to Achilles' Heel's chance, and so is offered from his front", async () => {
    const { weakPointChance, weakPointOffered } = await import("../../module/rules/weak-point.mjs");
    await withSubjects([
      { from: "chiron", id: CH, panel: { i: 2, j: 5 } },
      // Dismounted, as the Heel asks; facing north, so Chiron stands at his front.
      { from: "achilles", id: FOE, state: { stance: "dismounted", facing: "n" }, panel: { i: 5, j: 5 } },
    ], ({ unit }) => {
      const defender = unit(FOE), attacker = unit(CH), state = { isCounter: false };
      const spec = defender.weakPoints.find((w) => w.id === "achillesHeel");
      const plain = weakPointChance(spec, { defender, attacker, state });
      const aimed = weakPointChance(spec, { defender, attacker, state, aimBonus: 75 });
      expect(plain.available).toBe(true);
      expect(aimed.chance - plain.chance).toBe(75);
      expect(aimed.breakdown).toContainEqual({ label: "aimed", delta: 75 });
      expect(weakPointOffered(spec, { defender, attacker, state, aimBonus: 75 })).toBe(true);
    });
  });
});

describe("Wisdom of Divine Gift copies three (WD*, WS*, rulings 6 and 7)", () => {
  const SRC = "chironSourceArj1";
  const pick = (w, contentId) => ({ unitId: SRC, abilityId: abilityOf(w, SRC, contentId).id });

  it("grants three copies at A+ and 4◈-⅓◈, each locked while another cools", async () => {
    await withSubjects([
      { from: "chiron", id: CH, panel: { i: 5, j: 5 } },
      { from: "arjuna", id: SRC, panel: { i: 5, j: 7 } },
    ], async ({ world: w }) => {
      const { grantCopies } = await import("../../module/engine/copy.mjs");
      const out = await grantCopies({
        copierId: CH,
        picks: [pick(w, "arjuna-clairvoyance-bowman"), pick(w, "arjuna-awarded-hero"), pick(w, "arjuna-mana-burst-flames")]
          .filter((p) => p.abilityId),
        grantedBy: "chiron-wisdom-of-divine-gift",
      });
      // Mana Burst is a named family no copy takes: two of the three are copyable.
      expect(out.ok, out.reason).toBe(false);
      expect(out.reason).toBe("named");
      const ok = await grantCopies({
        copierId: CH, picks: [pick(w, "arjuna-clairvoyance-bowman"), pick(w, "arjuna-awarded-hero")],
        grantedBy: "chiron-wisdom-of-divine-gift",
      });
      expect(ok).toEqual({ ok: true, created: 2 });
      const copies = w.actor(CH).items.filter((i) => i.system.grantedBy === "chiron-wisdom-of-divine-gift");
      expect(copies.map((c) => c.system.rank)).toEqual(["A+", "A+"]);
      expect(copies.map((c) => c.system.cooldown.max)).toEqual(["4◈-⅓◈", "4◈-⅓◈"]);
      for (const c of copies) {
        expect(c.system.exclusionSet).toBe("wisdomOfDivineGift");
        expect(c.system.requirements).toContainEqual(expect.objectContaining({ kind: "abilityOffCooldown", exclusionSet: "wisdomOfDivineGift", excludeSelf: true }));
      }
    });
  });

  it("takes three, not Scáthach's two, and refuses a fourth", async () => {
    await withSubjects([{ from: "chiron", id: CH }], async ({ world: w }) => {
      const { copyGrantSpec, copyGrantOf } = await import("../../module/engine/copy.mjs");
      expect(copyGrantSpec(copyGrantOf(w.actor(CH)))).toEqual({
        slots: 3, rank: "A+", cooldown: "4◈-⅓◈", exclusionSet: "wisdomOfDivineGift", grantedBy: "chiron-wisdom-of-divine-gift",
      });
      const { grantCopies } = await import("../../module/engine/copy.mjs");
      const four = Array.from({ length: 4 }, () => ({ unitId: "x", abilityId: "y" }));
      expect(await grantCopies({ copierId: CH, picks: four, grantedBy: "chiron-wisdom-of-divine-gift" }))
        .toEqual({ ok: false, reason: "tooManyPicks" });
    });
  });

  it("refuses a Class Skill, as Scáthach's (ruling 6)", async () => {
    await withSubjects([
      { from: "chiron", id: CH, panel: { i: 5, j: 5 } },
      { from: "arjuna", id: SRC, panel: { i: 5, j: 7 } },
    ], async ({ world: w }) => {
      const { grantCopies } = await import("../../module/engine/copy.mjs");
      const ia = w.actor(SRC).items.find((i) => i.system.kind === "classSkill");
      expect(await grantCopies({ copierId: CH, picks: [{ unitId: SRC, abilityId: ia.id }], grantedBy: "chiron-wisdom-of-divine-gift" }))
        .toEqual({ ok: false, reason: "classSkill" });
    });
  });
});

describe("the posthumous Antares Snipe (AS.trig*, ruling 13)", () => {
  // Opening on Day, so an even Round is Night and an odd one Day.
  const night = (globalTurn) => ({ tokens: true, combat: { round: 10, started: true, system: { globalTurn, phase: "day" }, actingFactionId: "A" } });
  const day = (globalTurn) => ({ tokens: true, combat: { round: 9, started: true, system: { globalTurn, phase: "day" }, actingFactionId: "A" } });
  const MAS = "chironMaster0001";
  // The killer stands nine panels off: the shot ignores Range.
  const party = () => [
    { from: "chiron", id: CH, panel: { i: 5, j: 5 }, state: { factionId: "A", masterId: MAS, contract: "contracted" } },
    { from: "master-advanced", id: MAS, panel: { i: 5, j: 4 }, state: { factionId: "A" } },
    { from: "karna", id: FOE, panel: { i: 5, j: 14 }, state: { factionId: "B" } },
  ];
  const strikes = (w) => w.combat.getFlag("fgt", "scheduledStrikes") ?? [];
  const defeat = async (killerId) => {
    const { applyWorldIntents } = await import("../../module/engine/applier.mjs");
    const I = await import("../../module/engine/intents.mjs");
    await applyWorldIntents([I.defeat(CH, "damage", killerId)], "test:defeat");
  };

  it("records the shot when he falls: on his killer, ⅓◈ later, from where he fell", async () => {
    await withSubjects(party(), async ({ world: w }) => {
      await defeat(FOE);
      expect(strikes(w)).toEqual([expect.objectContaining({
        kind: "posthumous", ownerId: CH, targetId: FOE, fireAt: 31, panel: { i: 5, j: 5 },
        contentId: "chiron-antares-snipe", holdUnless: ["war:phase:night"],
      })]);
    }, night(30));
  });

  it("records nothing when nobody defeated him, and says so", async () => {
    await withSubjects(party(), async ({ world: w }) => {
      await defeat(null);
      expect(strikes(w)).toEqual([]);
      // The test world renders a line by its key.
      expect([...w.messages].map((m) => m.content).join(" ")).toMatch(/FGT\.Schedule\.PosthumousNoKiller/);
    }, night(30));
  });

  it("fires at Night at the start of the first Turn past ⅓◈, out of Range, and his Master pays nothing", async () => {
    await withSubjects(party(), async ({ world: w }) => {
      await defeat(FOE);
      const { runScheduledStrikes } = await import("../../module/engine/schedule.mjs");
      expect((await runScheduledStrikes(30)).fired).toEqual([]);
      const masterBefore = w.actor(MAS).system.health.value;
      const out = await runScheduledStrikes(31);
      expect(out.fired).toHaveLength(1);
      const { deserialize } = await import("../../module/engine/combat-process.mjs");
      const hit = [...w.messages].filter((m) => m.getFlag("fgt", "process")).map((m) => deserialize(m.getFlag("fgt", "process")));
      expect(hit.map((s) => [s.attackerId, s.defenderId])).toEqual([[CH, FOE]]);
      expect(w.actor(MAS).system.health.value).toBe(masterBefore);
      expect(strikes(w)).toEqual([]);
    }, night(30));
  });

  it("holds through a Day Round, says so once, and keeps his body on the board", async () => {
    await withSubjects(party(), async ({ world: w, board }) => {
      await defeat(FOE);
      const { runScheduledStrikes } = await import("../../module/engine/schedule.mjs");
      expect((await runScheduledStrikes(31)).fired).toEqual([]);
      expect((await runScheduledStrikes(32)).fired).toEqual([]);
      expect(strikes(w)).toHaveLength(1);
      const said = [...w.messages].map((m) => m.content).filter((c) => /FGT\.Schedule\.PosthumousHeld/.test(c));
      expect(said).toHaveLength(1);
      const { clearBodies } = await import("../../module/engine/scheduler.mjs");
      const { pendingStrikes } = await import("../../module/engine/schedule.mjs");
      const body = { id: CH, defeated: true, defeatedAt: 30, panel: { i: 5, j: 5 }, kind: "servant" };
      const heldBodies = pendingStrikes(w.combat).filter((s) => s.kind === "posthumous").map((s) => s.ownerId);
      expect(clearBodies([body], { tick: 32, heldBodies })).toEqual([]);
      expect(clearBodies([body], { tick: 32 })).not.toEqual([]);
      void board;
    }, day(30));
  });

  it("is cancelled with a line when his killer is gone before it fires", async () => {
    await withSubjects(party(), async ({ world: w }) => {
      await defeat(FOE);
      await w.actor(FOE).update({ "system.defeated": true });
      const { runScheduledStrikes } = await import("../../module/engine/schedule.mjs");
      const out = await runScheduledStrikes(31);
      expect(out.cancelled).toHaveLength(1);
      expect(strikes(w)).toEqual([]);
      expect([...w.messages].map((m) => m.content).join(" ")).toMatch(/FGT\.Schedule\.PosthumousLost/);
    }, night(30));
  });
});

describe("teaching a copy (WD.teach*, rulings 8–11)", () => {
  const SRC = "chironSourceArj1", LEARNER = "chironLearner001", ENEMY = "chironEnemy00001";
  const TICK = 18;
  const party = () => [
    { from: "chiron", id: CH, owner: "p1", panel: { i: 5, j: 5 }, state: { factionId: "A" } },
    { from: "emiya", id: LEARNER, panel: { i: 5, j: 6 }, state: { factionId: "A" } },
    { from: "arjuna", id: SRC, panel: { i: 9, j: 9 }, state: { factionId: "B" } },
    { from: "karna", id: ENEMY, panel: { i: 5, j: 8 }, state: { factionId: "B" } },
  ];
  const copyOf = (w, contentId) => w.actor(CH).items.find((i) => i.system.copiedFrom === contentId);
  const held = (w, id) => [...w.actor(id).effects].map((e) => e.system?.defId);
  const learned = (w) => w.actor(LEARNER).items.filter((i) => i.system.taughtBy === CH);

  /** Chiron copies two of Arjuna's, then presses the teaching on the learner. */
  const teach = async (w, contentId, { consent = true } = {}) => {
    const { grantCopies } = await import("../../module/engine/copy.mjs");
    if (!copyOf(w, "arjuna-clairvoyance-bowman")) {
      const pick = (id) => ({ unitId: SRC, abilityId: abilityOf(w, SRC, id).id });
      expect((await grantCopies({ copierId: CH, picks: [pick("arjuna-clairvoyance-bowman"), pick("arjuna-awarded-hero")] })).ok).toBe(true);
    }
    w.answer({ title: "FGT.Teach.ChooseTitle", by: "p1", pick: [copyOf(w, contentId).id] });
    w.answer({ title: "FGT.Teach.ConsentTitle", kind: "confirm", value: consent });
    const { castSkill } = await import("../helpers/process.mjs");
    return castSkill(w, { caster: CH, ability: abilityOf(w, CH, "chiron-wisdom-teach").id, placement: { unitId: LEARNER, chosenIds: [LEARNER] } });
  };

  it("for 1◈ both Cannot Act; then the learner holds the copy at A+ and 4◈-⅓◈, and Chiron keeps his", async () => {
    await withSubjects(party(), async ({ world: w }) => {
      const out = await teach(w, "arjuna-clairvoyance-bowman");
      expect(out.ok, out.reason).toBe(true);
      expect(held(w, CH)).toContain("cannotAct");
      expect(held(w, LEARNER)).toContain("cannotAct");
      expect(w.actor(CH).system.teaching).toEqual(expect.objectContaining({ teacherId: CH, learnerId: LEARNER, endsAt: TICK + 3 }));
      expect(w.actor(LEARNER).system.teaching).toEqual(w.actor(CH).system.teaching);

      const { runTeachings } = await import("../../module/engine/teaching.mjs");
      await runTeachings(TICK + 2);
      expect(learned(w)).toEqual([]);
      await runTeachings(TICK + 3);
      const [taught] = learned(w);
      expect(taught.system).toMatchObject({ copiedFrom: "arjuna-clairvoyance-bowman", rank: "A+" });
      expect(taught.system.cooldown.max).toBe("4◈-⅓◈");
      expect(taught.system.requirements ?? []).toEqual([]);
      expect(copyOf(w, "arjuna-clairvoyance-bowman")).toBeTruthy();
      expect(w.actor(CH).system.teaching ?? null).toBeNull();
      expect(w.actor(LEARNER).system.teaching ?? null).toBeNull();
      expect([...w.messages].map((m) => m.content).join(" ")).toMatch(/FGT\.Teach\.Learned/);
    }, WAR);
  });

  it("a learner holds one Skill learned from him, and is offered none it already holds", async () => {
    await withSubjects(party(), async ({ world: w }) => {
      await teach(w, "arjuna-clairvoyance-bowman");
      const { runTeachings, teachableCopies } = await import("../../module/engine/teaching.mjs");
      await runTeachings(TICK + 3);
      // Taught once: refused, with the reason.
      expect(teachableCopies(w.actor(CH), w.actor(LEARNER))).toEqual({ ok: false, reason: "alreadyLearned" });
      // Arjuna holds both originals: nothing is offered him. Karna holds neither.
      expect(teachableCopies(w.actor(CH), w.actor(SRC))).toEqual({ ok: false, reason: "nothingToTeach" });
      const offer = teachableCopies(w.actor(CH), w.actor(ENEMY));
      expect(offer.ok).toBe(true);
      expect(offer.copies.map((c) => c.system.copiedFrom).sort()).toEqual(["arjuna-awarded-hero", "arjuna-clairvoyance-bowman"]);
    }, WAR);
  });

  it("a declined consent teaches nothing and locks nobody", async () => {
    await withSubjects(party(), async ({ world: w }) => {
      await teach(w, "arjuna-clairvoyance-bowman", { consent: false });
      expect(held(w, CH)).not.toContain("cannotAct");
      expect(held(w, LEARNER)).not.toContain("cannotAct");
      expect(w.actor(CH).system.teaching ?? null).toBeNull();
      expect([...w.messages].map((m) => m.content).join(" ")).toMatch(/FGT\.Teach\.Declined/);
    }, WAR);
  });

  it("is cancelled when an enemy's Attack hits either, and both may Act again", async () => {
    await withSubjects(party(), async ({ world: w }) => {
      await teach(w, "arjuna-clairvoyance-bowman");
      const { cancelTeachingOnHit } = await import("../../module/engine/teaching.mjs");
      // A Process that reached its Damage Step, from an enemy: a hit, Blocked or not.
      await cancelTeachingOnHit({ attackerId: ENEMY, defenderId: LEARNER, history: [{ state: "damage", event: "done" }] });
      expect(w.actor(CH).system.teaching ?? null).toBeNull();
      expect(held(w, CH)).not.toContain("cannotAct");
      expect(held(w, LEARNER)).not.toContain("cannotAct");
      expect([...w.messages].map((m) => m.content).join(" ")).toMatch(/FGT\.Teach\.Cancelled\.hit/);
    }, WAR);
  });

  it("is not cancelled by a miss, nor by an ally's Attack", async () => {
    await withSubjects(party(), async ({ world: w }) => {
      await teach(w, "arjuna-clairvoyance-bowman");
      const { cancelTeachingOnHit } = await import("../../module/engine/teaching.mjs");
      await cancelTeachingOnHit({ attackerId: ENEMY, defenderId: LEARNER, history: [{ state: "missCheck", event: "miss" }] });
      await cancelTeachingOnHit({ attackerId: CH, defenderId: LEARNER, history: [{ state: "damage", event: "done" }] });
      expect(w.actor(CH).system.teaching).toBeTruthy();
    }, WAR);
  });

  it("is cancelled when either is defeated, or they are Moved apart", async () => {
    await withSubjects(party(), async ({ world: w }) => {
      await teach(w, "arjuna-clairvoyance-bowman");
      const { cancelTeachingsApart } = await import("../../module/engine/teaching.mjs");
      // A forced Move, as a Knockback would make: the learner pushed away.
      const { applyWorldIntents } = await import("../../module/engine/applier.mjs");
      const I = await import("../../module/engine/intents.mjs");
      await applyWorldIntents([I.move(LEARNER, [{ i: 5, j: 9 }], true)], "test:knockback");
      await cancelTeachingsApart();
      expect(w.actor(CH).system.teaching ?? null).toBeNull();
      expect([...w.messages].map((m) => m.content).join(" ")).toMatch(/FGT\.Teach\.Cancelled\.apart/);
    }, WAR);
    await withSubjects(party(), async ({ world: w }) => {
      await teach(w, "arjuna-clairvoyance-bowman");
      const { applyWorldIntents } = await import("../../module/engine/applier.mjs");
      const I = await import("../../module/engine/intents.mjs");
      await applyWorldIntents([I.defeat(LEARNER, "damage", ENEMY)], "test:defeat");
      expect(w.actor(CH).system.teaching ?? null).toBeNull();
      expect(held(w, CH)).not.toContain("cannotAct");
    }, WAR);
  });
});

describe("Antares Snipe (AS*)", () => {
  const MAS = "chironMaster0001";
  const at = (round) => ({ tokens: true, combat: { round, started: true, system: { globalTurn: 30, phase: "day", npGateRound: 1 }, actingFactionId: "A" } });
  const party = (foe = "heracles") => [
    { from: "chiron", id: CH, panel: { i: 5, j: 5 }, state: { factionId: "A", masterId: MAS, contract: "contracted" } },
    { from: "master-advanced", id: MAS, panel: { i: 5, j: 4 }, state: { factionId: "A" } },
    { from: foe, id: FOE, panel: { i: 5, j: 9 }, state: { factionId: "B" },
      effects: [{ defId: "defUp", magnitude: 30, expiry: 99 }, { defId: "atkUp", magnitude: 20, expiry: 99 }] },
  ];
  const np = (w) => abilityOf(w, CH, "chiron-antares-snipe");
  const held = (w, id) => [...w.actor(id).effects].map((e) => e.system?.defId);

  it("is refused in a Day Round, the War's Round and not the panel's (AS.night)", async () => {
    await withSubjects(party(), async ({ world: w }) => {
      const { playAttack } = await import("../helpers/process.mjs");
      await expect(playAttack(w, { attacker: CH, ability: np(w).id, target: FOE })).rejects.toThrow(/Cannot use/);
    }, at(9));
  });

  it("at Night: strips Defensive Buffs first, 2x BA(MAG) +100, Crit Dwn 40%, and his Master pays a Rank E price", async () => {
    await withSubjects(party(), async ({ world: w }) => {
      const { playAttack } = await import("../helpers/process.mjs");
      const { npCostAt } = await import("../../module/rules/costs.mjs");
      const before = w.actor(MAS).system.health.value;
      const { processes } = await playAttack(w, { attacker: CH, ability: np(w).id, target: FOE, react: { [FOE]: ["nothing", "declined", "declined"] } });
      expect(processes).toHaveLength(1);
      expect(held(w, FOE)).not.toContain("defUp");
      expect(held(w, FOE)).toContain("atkUp");
      expect(held(w, FOE)).toContain("critDwn");
      const price = npCostAt({ rank: "E", unit: { masterId: MAS }, master: { id: MAS } });
      expect(before - w.actor(MAS).system.health.value).toBe(price.amount);
      expect(np(w).system.cooldown.remaining).toBe(9);
    }, at(10));
  });

  it("deals +150% more to an Earth Unit", async () => {
    const dealt = async (foe) => withSubjects(party(foe), async ({ world: w }) => {
      const { playAttack } = await import("../helpers/process.mjs");
      w.dice.every(1);
      // Achilles' Heel is offered: Antares's +75 reaches it from his front (ruling 12).
      if (foe === "achilles") w.answer({ title: "FGT.WeakPoint.Title", decline: true });
      // Karna's Uncrowned Arms Mastership is offered at his Defending Phase.
      if (foe === "karna") w.answer({ title: "FGT.Window.defendingPhaseStart", decline: true });
      const { processes } = await playAttack(w, { attacker: CH, ability: np(w).id, target: FOE, react: { [FOE]: ["nothing", "declined", "declined"] } });
      const msg = [...w.messages].find((m) => m.getFlag("fgt", "result"));
      return { breakdown: JSON.stringify(msg.getFlag("fgt", "result")), processes };
    }, at(10));
    const earth = await dealt("achilles");
    expect(earth.breakdown).toMatch(/Earth \(\+150%\)/);
    // Karna is Sky, not Earth.
    const none = await dealt("karna");
    expect(none.breakdown).not.toMatch(/Earth \(\+150%\)/);
  });
});

describe("Consecration of Eternal Life (CE*)", () => {
  it("Crit DmUp 50% on every ally within 2 and himself, S.Crit Up on him, then 5% of his Health, never below 1", async () => {
    await withSubjects([
      { from: "chiron", id: CH, panel: { i: 5, j: 5 }, state: { factionId: "A" } },
      { from: "emiya", id: ALLY, panel: { i: 5, j: 7 }, state: { factionId: "A" } },
      { from: "karna", id: FOE, panel: { i: 5, j: 6 }, state: { factionId: "B" } },
    ], async ({ world: w }) => {
      const { castSkill } = await import("../helpers/process.mjs");
      const out = await castSkill(w, { caster: CH, ability: abilityOf(w, CH, "chiron-consecration-of-eternal-life").id });
      expect(out.ok, out.reason).toBe(true);
      const has = (id) => [...w.actor(id).effects].map((e) => [e.system?.defId, e.system?.magnitude]);
      expect(has(CH)).toEqual(expect.arrayContaining([["critDmUp", 50], ["sCritUp", 15]]));
      expect(has(ALLY)).toContainEqual(["critDmUp", 50]);
      expect(has(FOE).map(([d]) => d)).not.toContain("critDmUp");
      // 5% of 1250 is 62.5: a percent of max drops its fraction, as Trace On's does.
      expect(w.actor(CH).system.health.value).toBe(1188);
    }, WAR);
  });
});

describe("Clairvoyance (CV*)", () => {
  const party = (j) => [
    { from: "chiron", id: CH, panel: { i: 5, j: 5 }, state: { factionId: "A" } },
    { from: "emiya", id: FOE, panel: { i: 5, j }, state: { factionId: "B" } },
  ];
  const clair = (w) => abilityOf(w, CH, "chiron-clairvoyance");
  const swing = async (w) => {
    await clair(w).update({ "system.cooldown.remaining": 6 });
    const { playAttack } = await import("../helpers/process.mjs");
    // EMIYA's Eye of the Mind is offered at his Defending Phase.
    w.answer({ title: "FGT.Window.defendingPhaseStart", decline: true });
    await playAttack(w, { attacker: CH, target: FOE, react: { [FOE]: ["nothing", "declined", "declined"] } });
    return clair(w).system.cooldown.remaining;
  };

  it("Passive 2: a Normal Attack at Range 3 cuts its clock by ⅓◈ (ruling 5), and the card says so", async () => {
    await withSubjects(party(8), async ({ world: w }) => {
      expect(await swing(w)).toBe(5);
      const rows = [...w.messages].flatMap((m) => m.getFlag("fgt", "effects") ?? []).filter((r) => r.id === "cooldown");
      expect(rows.map((r) => r.name)).toEqual([expect.stringMatching(/Clairvoyance.*6 → 5/)]);
    }, WAR);
  });

  it("...and one at Range 2 does not", async () => {
    await withSubjects(party(7), async ({ world: w }) => {
      expect(await swing(w)).toBe(6);
    }, WAR);
  });

  it("the Active: Crit Up 35% and Range Up (Clairvoyance) +1, for 1◈", async () => {
    await withSubjects(party(8), async ({ world: w }) => {
      const { castSkill } = await import("../helpers/process.mjs");
      expect((await castSkill(w, { caster: CH, ability: clair(w).id })).ok).toBe(true);
      const has = [...w.actor(CH).effects].map((e) => [e.system?.defId, e.system?.magnitude]);
      expect(has).toEqual(expect.arrayContaining([["critUp", 35], ["rangeUpClairvoyance", 1]]));
      expect(clair(w).system.cooldown.remaining).toBe(11);
    }, WAR);
  });
});

describe("Eye of the Mind (True) (EM*)", () => {
  it("a successful Evade cuts its clock by ⅓◈, and the card says so", async () => {
    await withSubjects([
      { from: "chiron", id: CH, panel: { i: 5, j: 5 }, state: { factionId: "A" },
        effects: [{ defId: "dodge", expiry: 99 }] },
      { from: "karna", id: FOE, panel: { i: 5, j: 6 }, state: { factionId: "B" } },
    ], async ({ world: w }) => {
      const eye = abilityOf(w, CH, "chiron-eye-of-the-mind-true");
      await eye.update({ "system.cooldown.remaining": 9 });
      const { playAttack } = await import("../helpers/process.mjs");
      // Karna's Uncrowned Arms Mastership is offered at his Combat Phase.
      w.answer({ title: "FGT.Window.combatPhaseStart", decline: true });
      await playAttack(w, { attacker: FOE, target: CH, react: { [CH]: ["evade", "declined", "declined"], [FOE]: ["declined"] } });
      expect(eye.system.cooldown.remaining).toBe(8);
      const rows = [...w.messages].flatMap((m) => m.getFlag("fgt", "effects") ?? []).filter((r) => r.id === "cooldown");
      expect(rows.map((r) => r.name)).toContainEqual(expect.stringMatching(/Eye of the Mind.*9 → 8/));
    }, { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18 }, actingFactionId: "B" } });
  });
});

describe("the copy dialog names its own grant", () => {
  // Live, 2026-10-23: Chiron's pick opened titled "Wisdom of Dún Scáith".
  it("is titled Wisdom of Divine Gift for Chiron, and asks for three", async () => {
    await withSubjects([{ from: "chiron", id: CH, panel: { i: 5, j: 5 } }], async () => {
      const { CopyDialog } = await import("../../module/apps/copy-dialog.mjs");
      const app = new CopyDialog({ copierId: CH });
      expect(app.title).toBe("Wisdom of Divine Gift");
      expect((await app._prepareContext()).slots).toBe(3);
    }, WAR);
  });
});
