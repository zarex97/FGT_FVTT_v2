/**
 * Yan Qing's build (#253), played in the arena: what only a cast or a Combat
 * Process shows. The projection-level halves are in `yan-qing-253-rulings.test.mjs`.
 * @see docs/superpowers/specs/2026-10-19-yan-qing-clauses.md
 */
import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { castSkill, playAttack } from "../helpers/process.mjs";

beforeAll(prepareSubjects, 120_000);

const Y = "yanQingArena0001";
const E = "yanQingEnemy0001";
/** His side's Turn, at ◈ 3 unless a spec says otherwise. */
const match = (turnsPerRound = 3) => ({
  tokens: true,
  combat: { round: 4, started: true, system: { globalTurn: 12, turnsPerRound }, actingFactionId: "A" },
});

const abilityOf = (w, actorId, contentId) => w.actor(actorId).items.find((i) => i.system?.contentId === contentId);
const held = (w, id) => [...w.actor(id).effects].map((e) => e.system.defId);
const lost = (w, id) => w.actor(id).system.health.max - w.actor(id).system.health.value;
/** Every contributor's label on a Process's damage breakdown. */
const sourcesOf = (w, declared) => (w.messages.get(declared.processes[0].messageId).getFlag("fgt", "result")?.breakdown ?? [])
  .flatMap((b) => b.contributors ?? []).map((c) => `${c.source ?? ""} ${c.note ?? ""} ${c.key ?? ""}`);

/** Yan Qing, Player1's, and one enemy `from` next to him. */
const duel = (from, { yanEffects = [], enemyEffects = [] } = {}) => [
  // Agility as a War's opening rolls would leave it at AGI A+; a Subject holds 0 until then.
  { from: "yan-qing", id: Y, owner: "p1", panel: { i: 5, j: 5 },
    state: { factionId: "A", agility: { value: 20, max: 20 } }, effects: yanEffects },
  { from, id: E, panel: { i: 5, j: 6 }, state: { factionId: "B" }, effects: enemyEffects },
];
/** His Normal Attack on E, which E takes; Ruffian's offer declined unless `spend` says how much. */
const strike = (w, { spend = 0, react = ["nothing", "declined", "declined"] } = {}) => {
  w.answer(spend > 0 ? { title: "Ruffian", by: "p1", pick: [String(spend)] } : { title: "Ruffian", by: "p1", decline: true });
  return playAttack(w, { attacker: Y, target: E, react: { [E]: react } });
};

/* ========================================================================== */
/*  Slice 1: Yan Qing Fist and Zhōng Guó Quán Fǎ                               */
/* ========================================================================== */

describe("Yan Qing Fist (YF.*, #253 reading 1)", () => {
  const fist = (w) => castSkill(w, { caster: Y, ability: abilityOf(w, Y, "yan-qing-fist").id });

  it("lands Crit Up, Dmg Up (Lawful) and Dmg Up (Evil) on himself", async () => {
    await withSubjects(duel("arturia"), async ({ world: w }) => {
      const out = await fist(w);
      expect(out.ok, out.reason).toBe(true);
      expect(held(w, Y)).toEqual(expect.arrayContaining(["critUp", "dmgUpLawful", "dmgUpEvil"]));
    }, match());
  });

  /** His Normal Attack's damage on `from`, with and without the Fist. */
  const pair = async (from) => {
    const once = async (withFist) => withSubjects(duel(from), async ({ world: w }) => {
      w.dice.every(99);
      if (withFist) expect((await fist(w)).ok).toBe(true);
      const { declared } = await strike(w);
      return { lost: lost(w, E), sources: sourcesOf(w, declared) };
    }, match());
    return { plain: await once(false), fisted: await once(true) };
  };

  it("raises damage on a Lawful Unit by the Lawful 30%, and only that one", async () => {
    const { plain, fisted } = await pair("arturia");
    expect(fisted.sources.some((s) => /dmgUpLawful/.test(s)), fisted.sources.join(" | ")).toBe(true);
    expect(fisted.sources.some((s) => /dmgUpEvil/.test(s))).toBe(false);
    expect(fisted.lost).toBeGreaterThan(plain.lost);
  });

  it("raises damage on an Evil Unit by the Evil 30%, and only that one", async () => {
    // Medea, Neutral Evil: Jack is Evil too, but asks to strike first.
    const { plain, fisted } = await pair("medea");
    expect(fisted.sources.some((s) => /dmgUpEvil/.test(s)), fisted.sources.join(" | ")).toBe(true);
    expect(fisted.sources.some((s) => /dmgUpLawful/.test(s))).toBe(false);
    expect(fisted.lost).toBeGreaterThan(plain.lost);
  });

  it("raises nothing on a Neutral Neutral Unit", async () => {
    const { fisted } = await pair("kato-danzo");
    expect(fisted.sources.some((s) => /dmgUpLawful|dmgUpEvil/.test(s))).toBe(false);
  });
});

describe("Zhōng Guó Quán Fǎ: his NP Cooldown cut at the Process end (ZG.np, ZG.np.big, #253 reading 3)", () => {
  /** His NP's clock, set to 10 Turns, after one Normal Attack on Medea at ◈ `turns`. */
  const cutAt = async (turns, { enemyEffects = [] } = {}) => withSubjects(duel("medea", { enemyEffects }), async ({ world: w }) => {
    const np = abilityOf(w, Y, "yan-qing-np");
    await np.update({ "system.cooldown.remaining": 10 });
    w.dice.every(99);
    await strike(w);
    return 10 - abilityOf(w, Y, "yan-qing-np").system.cooldown.remaining;
  }, match(turns));

  it("cuts 1 Turn at ◈ 3", async () => {
    expect(await cutAt(3)).toBe(1);
  });

  it("cuts 2 Turns at ◈ 8", async () => {
    expect(await cutAt(8)).toBe(2);
  });

  it("cuts nothing when the hit dealt 0: a hit is not enough, it must hurt", async () => {
    expect(await cutAt(3, { enemyEffects: [{ defId: "invuln" }] })).toBe(0);
  });
});

/* ========================================================================== */
/*  Slice 2: Ruffian's Agility spend                                           */
/* ========================================================================== */

describe("Ruffian, Passive 2: Agility spent at his Damage Step (RF.p2*, #253 reading 2)", () => {
  const agility = (w) => w.actor(Y).system.agility.value;

  it("spends the 7 he chooses, past the sheet's old cap of 5, for +35% on this Process", async () => {
    await withSubjects(duel("medea"), async ({ world: w }) => {
      w.dice.every(99);
      const before = agility(w);
      const { declared } = await strike(w, { spend: 7 });
      expect(agility(w)).toBe(before - 7);
      const row = (w.messages.get(declared.processes[0].messageId).getFlag("fgt", "result")?.breakdown ?? [])
        .flatMap((b) => b.contributors ?? []).find((c) => /dmgUp/.test(`${c.source ?? ""} ${c.key ?? ""}`));
      expect(row, "the Dmg Up it bought is in the damage").toBeTruthy();
      expect(String(row.value ?? row.percent ?? row.amount ?? JSON.stringify(row))).toMatch(/35/);
      expect(held(w, Y), "gone with the Process").not.toContain("dmgUp");
    }, match());
  });

  it("raises the damage over the same hit unpaid", async () => {
    const once = (spend) => withSubjects(duel("medea"), async ({ world: w }) => {
      w.dice.every(99);
      await strike(w, { spend });
      return lost(w, E);
    }, match());
    expect(await once(4)).toBeGreaterThan(await once(0));
  });

  it("is never asked on an Evade: the Damage Step is never reached", async () => {
    // A Dodge: her Evade succeeds without a roll.
    await withSubjects(duel("medea", { enemyEffects: [{ defId: "dodge", uses: 1 }] }), async ({ world: w }) => {
      w.dice.every(50);
      const before = agility(w);
      const { processes } = await playAttack(w, { attacker: Y, target: E, react: { [E]: ["evade", "declined"], [Y]: ["declined", "declined"] } });
      expect(processes[0].evaded, "Medea evaded").toBe(true);
      expect(w.asked.filter((q) => q.title === "Ruffian")).toEqual([]);
      expect(agility(w)).toBe(before);
    }, match());
  });

  it("is never asked on his Noble Phantasm", async () => {
    await withSubjects(duel("medea"), async ({ world: w }) => {
      w.dice.every(99);
      await playAttack(w, {
        attacker: Y, ability: abilityOf(w, Y, "yan-qing-np").id, target: E,
        react: { [E]: ["nothing", "declined", "declined"] },
      });
      expect(w.asked.filter((q) => q.title === "Ruffian")).toEqual([]);
    }, match());
  });
});

/* ========================================================================== */
/*  Slice 4: Skillful Star, cast                                               */
/* ========================================================================== */

describe("Skillful Star, cast (SS.when, SS.order, SS.cd)", () => {
  it("lands his Crit Dwn for this Turn, then the aura for 1◈, and starts 3◈-⅓◈", async () => {
    await withSubjects(duel("medea"), async ({ world: w }) => {
      const star = abilityOf(w, Y, "yan-qing-skillful-star");
      const out = await castSkill(w, { caster: Y, ability: star.id });
      expect(out.ok, out.reason).toBe(true);
      const mine = [...w.actor(Y).effects].map((e) => ({ id: e.system.defId, magnitude: e.system.magnitude }));
      expect(mine).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: "critDwn", magnitude: 50 }),
        expect.objectContaining({ id: "sCritUpOthers", magnitude: 15 }),
      ]));
      // 3◈-⅓◈ at ◈ 3 is 9 - 1 = 8 Turns.
      expect(abilityOf(w, Y, "yan-qing-skillful-star").system.cooldown.remaining).toBe(8);
    }, match());
  });
});

/* ========================================================================== */
/*  Slice 5: the Noble Phantasm                                                */
/* ========================================================================== */

describe("Shí Miàn Mái Fú (NP.*, #253 reading 9)", () => {
  /** His NP on Medea; the two d4s set by the test, every other die at `every`. */
  const np = (w, react = ["nothing", "declined", "declined"]) => playAttack(w, {
    attacker: Y, ability: abilityOf(w, Y, "yan-qing-np").id, target: E, react: { [E]: react },
  });

  it("rolls 2 then 3: Crit Dwn on Medea, Crit DmUp on himself, no Def Dwn (C)", async () => {
    await withSubjects(duel("medea"), async ({ world: w }) => {
      // Every other die at 1, so each landing chance passes: at 99 Medea resists.
      w.dice.every(1);
      w.dice.set("d4", 2, 3);
      await np(w);
      expect(held(w, E)).toContain("critDwn");
      expect(held(w, E)).not.toContain("defDwnC");
      expect(held(w, Y)).toContain("critDmUp");
    }, match());
  });

  it("rerolls a second 1 and applies the third die's row", async () => {
    await withSubjects(duel("medea"), async ({ world: w }) => {
      // Every other die at 1, so each landing chance passes: at 99 Medea resists.
      w.dice.every(1);
      w.dice.set("d4", 1, 1, 2);
      await np(w);
      expect(held(w, E)).toEqual(expect.arrayContaining(["defDwnC", "critDwn"]));
      expect(held(w, Y)).not.toContain("critDmUp");
    }, match());
  });

  it("applies all three on a 4", async () => {
    await withSubjects(duel("medea"), async ({ world: w }) => {
      // Every other die at 1, so each landing chance passes: at 99 Medea resists.
      w.dice.every(1);
      w.dice.set("d4", 4, 1);
      await np(w);
      expect(held(w, E)).toEqual(expect.arrayContaining(["defDwnC", "critDwn"]));
      expect(held(w, Y)).toContain("critDmUp");
    }, match());
  });

  it("deals BA(STR) 125, by the table, at 5x", async () => {
    await withSubjects(duel("medea"), async ({ world: w }) => {
      // Every other die at 1, so each landing chance passes: at 99 Medea resists.
      w.dice.every(1);
      w.dice.set("d4", 2, 3);
      const { declared } = await np(w);
      const rows = w.messages.get(declared.processes[0].messageId).getFlag("fgt", "result")?.breakdown ?? [];
      expect(rows.find((b) => b.index === 1)?.contributors?.[0]?.value, "BA(STR) by the table").toBe(125);
      expect(rows.find((b) => b.index === 3)?.contributors?.find((c) => c.source === "multiplier")?.value, "5x").toBe(5);
    }, match());
  });

  it("rolls nothing when Medea Dodges it", async () => {
    await withSubjects(duel("medea", { enemyEffects: [{ defId: "dodge", uses: 1 }] }), async ({ world: w }) => {
      w.dice.every(50);
      await playAttack(w, {
        attacker: Y, ability: abilityOf(w, Y, "yan-qing-np").id, target: E,
        react: { [E]: ["evade", "declined"], [Y]: ["declined", "declined"] },
      });
      expect(w.dice.log.filter((d) => d.faces === 4)).toEqual([]);
      expect(held(w, Y)).not.toContain("critDmUp");
    }, match());
  });
});

/* ========================================================================== */
/*  Slice 6: Doppelganger                                                      */
/* ========================================================================== */

describe("Doppelganger: the Disguise (DP.*, ES.excl, #253 readings 5, 6, 10-14)", () => {
  const ALLY = "yanQingAlly00001";
  const BASMU = "yanQingBasmu0001";
  const board = ({ yanState = {}, yanEffects = [] } = {}) => [
    { from: "yan-qing", id: Y, owner: "p1", panel: { i: 5, j: 5 },
      state: { factionId: "A", agility: { value: 10, max: 20 }, ...yanState }, effects: yanEffects },
    { from: "medea", id: E, panel: { i: 5, j: 6 }, state: { factionId: "B" } },
    { from: "arturia", id: ALLY, panel: { i: 9, j: 9 }, state: { factionId: "A" } },
    { from: "basmu", id: BASMU, panel: { i: 12, j: 2 }, state: { factionId: "B" } },
  ];
  const dopp = (w) => abilityOf(w, Y, "yan-qing-doppelganger");
  /** Switched on as the sheet does: the use, then the switch. */
  const disguiseAs = async (w, as) => {
    const out = await castSkill(w, { caster: Y, ability: dopp(w).id, placement: { unitId: as, chosenIds: [as] } });
    expect(out.ok, out.reason).toBe(true);
    await dopp(w).update({ "system.active": true, "system.toggledAt": 12, "system.endedBy": null });
  };
  const look = (w) => [...w.actor(Y).effects].find((e) => e.system.defId === "disguise")?.system.params ?? null;

  it("opens a targeting session when the sheet switches it on, as the sheet asks", async () => {
    await withSubjects(board(), async ({ world: w }) => {
      const { needsTargeting } = await import("../../module/rules/ability-use.mjs");
      // The sheet's `toggleMode` picks only when this says so; the switch
      // relayed an empty placement live and was refused (#253).
      expect(needsTargeting(dopp(w))).toBe(true);
      expect(needsTargeting(abilityOf(w, Y, "class-presence-concealment") ?? w.actor(Y).items.find((i) => i.system.slug === "presenceConcealment"))).toBe(false);
    }, match());
  });

  it("still offers an enemy's look while he is concealed, in the aiming session as in the use (reading 15)", async () => {
    await withSubjects(board({ yanEffects: [{ defId: "presenceConcealment", unremovable: true }] }), async ({ world: w }) => {
      const { currentBoard, unitFrom } = await import("../../module/engine/board.mjs");
      const { targetSpecFor } = await import("../../module/rules/ability-use.mjs");
      const { veiledSpec } = await import("../../module/rules/concealment.mjs");
      const { validate } = await import("../../module/rules/targeting/resolve.mjs");
      const b = currentBoard();
      const self = unitFrom(b, w.actor(Y));
      // The session's spec, built as `pickPlacementFor` builds it.
      const spec = veiledSpec(targetSpecFor(dopp(w), 1), dopp(w), self);
      const legal = (id) => validate(spec, self, b, { unitId: id, chosenIds: [id] }).ok;
      expect(legal(E), "an enemy's look: nothing reaches it, so PC.7 does not bar it").toBe(true);
      expect(legal(ALLY), "an ally, offered").toBe(true);
    }, match());
  });

  it("offers any Unit on the board of his size, either side, never himself or Bašmu", async () => {
    await withSubjects(board(), async ({ world: w }) => {
      const { resolveSkillTargets } = await import("../../module/engine/skill-use.mjs");
      const { currentBoard, unitFrom } = await import("../../module/engine/board.mjs");
      const b = currentBoard();
      const self = unitFrom(b, w.actor(Y));
      const offered = (b.units ?? []).filter((u) => {
        const out = resolveSkillTargets(dopp(w), self, b, { unitId: u.id, chosenIds: [u.id] });
        return out.errors.length === 0 && out.units.some((t) => t.unitId === u.id);
      }).map((u) => u.id);
      expect(offered).toEqual(expect.arrayContaining([E, ALLY]));
      expect(offered).not.toContain(Y);
      expect(offered).not.toContain(BASMU);
    }, match());
  });

  it("takes Medea's look, names him Medea on every line, and tells only his side's owner and the GM", async () => {
    await withSubjects(board(), async ({ world: w }) => {
      const { shownName } = await import("../../module/engine/public-identity.mjs");
      const before = shownName(w.actor(E));
      await disguiseAs(w, E);
      expect(look(w)).toMatchObject({ as: E, name: before });
      expect(shownName(w.actor(Y))).toBe(before);
      const card = [...w.messages.values()].reverse().find((m) => m.getFlag?.("fgt", "kind") === "skill");
      expect(card?.whisper?.length ?? 0, "the activation card is private").toBeGreaterThan(0);
      expect(dopp(w).system.cooldown.remaining ?? 0, "its clock starts at the end, not the use").toBe(0);
    }, match());
  });

  it("bars Espionage while Active, keeps Presence Concealment, and Espionage's buff bars it back", async () => {
    await withSubjects(board(), async ({ world: w }) => {
      await disguiseAs(w, E);
      const refused = await castSkill(w, { caster: Y, ability: abilityOf(w, Y, "yan-qing-espionage").id });
      expect(refused.ok).toBe(false);
      expect(refused.reason).toMatch(/abilityLocked|Doppelganger/);
    }, match());
    await withSubjects(board({ yanEffects: [{ defId: "espionage" }] }), async ({ world: w }) => {
      const refused = await castSkill(w, { caster: Y, ability: dopp(w).id, placement: { unitId: E, chosenIds: [E] } });
      expect(refused.ok).toBe(false);
      expect(refused.reason).toMatch(/notHasEffect|espionage/i);
    }, match());
  });

  it("still lets him make a Normal Attack while disguised", async () => {
    await withSubjects(board(), async ({ world: w }) => {
      await disguiseAs(w, ALLY);
      w.dice.every(99);
      const before = w.actor(E).system.health.value;
      await strike(w);
      expect(w.actor(E).system.health.value).toBeLessThan(before);
    }, match());
  });

  it("ended by his hand: restores 3 Agility, lands the three buffs, drops the look, starts 4◈-⅓◈", async () => {
    await withSubjects(board(), async ({ world: w }) => {
      await disguiseAs(w, E);
      await dopp(w).update({ "system.active": false, "system.toggledAt": 12, "system.endedBy": "manual" });
      await w.settle?.();
      expect(w.actor(Y).system.agility.value).toBe(13);
      expect(held(w, Y)).toEqual(expect.arrayContaining(["atkUp", "critUp", "critDmUp"]));
      expect(look(w)).toBeNull();
      // 4◈-⅓◈ at ◈ 3: 12 - 1 = 11 Turns.
      expect(dopp(w).system.cooldown.remaining).toBe(11);
      const lines = [...w.messages.values()].map((m) => m.content ?? "");
      // The test world prints a line by its key.
      expect(lines.some((c) => /FGT\.Disguise\.Ended\b|disguise drops/.test(c)), lines.slice(-4).join(" | ")).toBe(true);
    }, match());
  });

  /** Medea's Normal Attack on him, at a Max Health that makes 10% `max / 10`. */
  const struck = (maxHealth) => withSubjects(board({
    yanState: { health: { value: maxHealth, max: maxHealth } },
    // Worn already: it is Medea's Turn, and he put it on during his own.
    yanEffects: [{ defId: "disguise", unremovable: true, params: { as: ALLY, name: "Saber", img: "", disposition: 1 } }],
  }), async ({ world: w }) => {
    await dopp(w).update({ "system.active": true, "system.toggledAt": 12 });
    w.dice.every(99);
    await playAttack(w, { attacker: E, target: Y, react: { [Y]: ["nothing", "declined", "declined"] } });
    return {
      lost: maxHealth - w.actor(Y).system.health.value,
      disguised: Boolean(look(w)),
      active: dopp(w).system.active,
      paid: held(w, Y).includes("atkUp"),
      cooldown: dopp(w).system.cooldown.remaining ?? 0,
    };
  }, { ...match(), combat: { ...match().combat, actingFactionId: "B" } });

  it("holds under a blow below 10% of his Max Health", async () => {
    const out = await struck(5000);
    expect(out.lost).toBeGreaterThan(0);
    expect(out.lost).toBeLessThan(500);
    expect(out.disguised).toBe(true);
    expect(out.active).toBe(true);
  });

  it("breaks under a blow of 10% or more: no rewards, and the clock starts", async () => {
    const out = await struck(300);
    expect(out.lost).toBeGreaterThanOrEqual(30);
    expect(out.active).toBe(false);
    expect(out.disguised).toBe(false);
    expect(out.paid, "a broken disguise pays nothing").toBe(false);
    expect(out.cooldown).toBe(11);
  });
});
