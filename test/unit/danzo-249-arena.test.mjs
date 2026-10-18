/**
 * Katō Danzō's build (#249), played in the arena: what only a cast or a Combat
 * Process shows. The projection-level halves are in `danzo-249-rulings.test.mjs`.
 * @see docs/superpowers/specs/2026-10-17-kato-danzo-clauses.md
 */
import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { castSkill, playAttack, playProcess } from "../helpers/process.mjs";
import { loadSource } from "../../tools/lib/load.mjs";

beforeAll(prepareSubjects, 120_000);

const D = "danzoArena000001";
const E = "danzoEnemy000001";
const MATCH = { tokens: true, combat: { round: 4, started: true, system: { globalTurn: 12 }, actingFactionId: "A" } };

let CORPUS = null;
/** An authored Unit from the corpus, by content id. */
async function authored(id) {
  CORPUS ??= (await loadSource("packs/_source")).files;
  return CORPUS.find((f) => f.doc?.id === id).doc;
}

const abilityOf = (w, actorId, contentId) => w.actor(actorId).items.find((i) => i.system?.contentId === contentId);
const held = (w, id) => [...w.actor(id).effects].map((e) => e.system.defId);

/** Danzō, Player1's, and an enemy Jack two panels away; `immuneTo` gives Jack an Immunity. */
async function duel({ immuneTo = null } = {}) {
  const jack = await authored("jack-the-ripper");
  const extra = immuneTo ? [{
    id: "test-immunity", name: "Test Immunity", kind: skill(), passiveRules: [{ key: "Immunity", effect: immuneTo }],
  }] : [];
  return [
    { from: "kato-danzo", id: D, owner: "p1", panel: { i: 5, j: 5 }, state: { factionId: "A" } },
    { from: "jack-the-ripper", id: E, panel: { i: 5, j: 7 }, state: { factionId: "B" },
      with: { abilities: [...jack.abilities, ...extra] } },
  ];
}
const skill = () => "skill";

describe("Harisenbon: Slow whenever Disable does not land (#249 reading 11)", () => {
  const press = (w) => castSkill(w, { caster: D, ability: abilityOf(w, D, "danzo-harisenbon").id, placement: { unitId: E, chosenIds: [E] } });

  it("lands Disable and no Slow when the 50% holds", async () => {
    await withSubjects(await duel(), async ({ world: w }) => {
      w.dice.every(10);
      expect((await press(w)).ok).toBe(true);
      expect(held(w, E)).toEqual(expect.arrayContaining(["disable", "defDwn"]));
      expect(held(w, E)).not.toContain("slow");
    }, MATCH);
  });

  it("lands Slow when the 50% misses", async () => {
    await withSubjects(await duel(), async ({ world: w }) => {
      w.dice.every(95);
      expect((await press(w)).ok).toBe(true);
      expect(held(w, E)).toEqual(expect.arrayContaining(["slow", "defDwn"]));
      expect(held(w, E)).not.toContain("disable");
    }, MATCH);
  });

  it("lands Slow when an Immunity blocks the Disable the die let through", async () => {
    await withSubjects(await duel({ immuneTo: "disable" }), async ({ world: w }) => {
      w.dice.every(10);
      expect((await press(w)).ok).toBe(true);
      expect(held(w, E)).toEqual(expect.arrayContaining(["slow", "defDwn"]));
      expect(held(w, E)).not.toContain("disable");
    }, MATCH);
  });
});

/* ========================================================================== */
/*  Slice 3: Funshindan, and PC.5 once per declaration                         */
/* ========================================================================== */

const E2 = "danzoEnemy000002";
const PC = [{ defId: "presenceConcealment", unremovable: true }];

/**
 * Danzō, concealed or not, and two enemy Jacks side by side three panels off.
 *
 * `plainArea` gives her Funshindan's twin without its break roll, so PC.5 is
 * what ends PC and not the roll (a held roll outlives PC.5, reading 9b).
 */
async function volley({ concealed = true, plainArea = false } = {}) {
  const extra = [];
  if (plainArea) {
    const { usableWhileConcealed: _u, concealmentBreakChance: _c, ...rest } = await authored("danzo-funshindan");
    extra.push({ ...rest, id: "test-area-strike", slug: "testAreaStrike", name: "Test Area Strike" });
  }
  const own = await authored("kato-danzo");
  return [
    { from: "kato-danzo", id: D, owner: "p1", panel: { i: 5, j: 5 }, state: { factionId: "A" }, effects: concealed ? PC : [],
      ...(plainArea ? { with: { abilities: [...own.abilities, ...extra] } } : {}) },
    { from: "jack-the-ripper", id: E, panel: { i: 5, j: 8 }, state: { factionId: "B" } },
    { from: "jack-the-ripper", id: E2, panel: { i: 6, j: 8 }, state: { factionId: "B" } },
  ];
}
const lost = (w, id) => w.actor(id).system.health.max - w.actor(id).system.health.value;

describe("Presence Concealment ends once a declaration's last Process closes (PC.5)", () => {
  const NOTHING = () => ["nothing", "declined", "declined"];

  /** Declare Funshindan, then let E answer and close before E2 answers at all, as a slow table does. */
  async function oneAfterTheOther(w) {
    const { resolveAttack } = await import("../../module/engine/attack.mjs");
    const declared = await resolveAttack({
      attackerId: D, abilityId: abilityOf(w, D, "test-area-strike").id, placement: { panel: { i: 5, j: 8 } },
    });
    const byDefender = Object.fromEntries(declared.processes.map((p) => [p.state.defenderId, p.messageId]));
    await playProcess(w, byDefender[E], { [E]: NOTHING() });
    const concealedBetween = held(w, D).includes("presenceConcealment");
    await playProcess(w, byDefender[E2], { [E2]: NOTHING() });
    return concealedBetween;
  }

  it("lets the defender who answers last take PC's +100% too", async () => {
    const plain = await withSubjects(await volley({ concealed: false, plainArea: true }), async ({ world: w }) => {
      w.dice.every(99);
      await oneAfterTheOther(w);
      return lost(w, E2);
    }, MATCH);
    await withSubjects(await volley({ plainArea: true }), async ({ world: w }) => {
      w.dice.every(99);
      const between = await oneAfterTheOther(w);
      expect(between, "PC still up while the second Process is open").toBe(true);
      expect(lost(w, E)).toBeGreaterThan(plain);
      expect(lost(w, E2)).toBe(lost(w, E));
      expect(held(w, D), "PC ended with the declaration").not.toContain("presenceConcealment");
    }, MATCH);
  });
});

describe("Funshindan's 50% roll on use (#249 readings 9, 9b)", () => {
  const both = { [E]: ["nothing", "declined", "declined"], [E2]: ["nothing", "declined", "declined"] };
  const fire = (w) => playAttack(w, {
    attacker: D, ability: abilityOf(w, D, "danzo-funshindan").id, placement: { panel: { i: 5, j: 8 } }, react: both,
  });

  it("held: PC stays up after the Attack, and both defenders took its +100%", async () => {
    const plain = await withSubjects(await volley({ concealed: false }), async ({ world: w }) => {
      w.dice.every(99);
      await fire(w);
      return lost(w, E);
    }, MATCH);
    await withSubjects(await volley(), async ({ world: w }) => {
      w.dice.every(99);
      await fire(w);
      expect(held(w, D), "a held roll outlives PC.5").toContain("presenceConcealment");
      expect(lost(w, E)).toBeGreaterThan(plain);
      expect(lost(w, E2)).toBe(lost(w, E));
    }, MATCH);
  });

  it("broken: PC ends before the Attack, which deals what an unconcealed one does", async () => {
    const plain = await withSubjects(await volley({ concealed: false }), async ({ world: w }) => {
      w.dice.every(10);
      await fire(w);
      return lost(w, E);
    }, MATCH);
    await withSubjects(await volley(), async ({ world: w }) => {
      w.dice.every(10);
      await fire(w);
      expect(held(w, D)).not.toContain("presenceConcealment");
      expect(lost(w, E)).toBe(plain);
    }, MATCH);
  });
});

/* ========================================================================== */
/*  Slice 4: Fubatsu's counted Invuln                                          */
/* ========================================================================== */

describe("Fubatsu's Invuln, 3 times (#249 reading 40)", () => {
  const invulnOf = (w, id) => [...w.actor(id).effects].find((e) => e.system.defId === "invuln");

  it("lands one Invuln holding three charges, with Crit Up", async () => {
    await withSubjects(await duel(), async ({ world: w }) => {
      const out = await castSkill(w, { caster: D, ability: abilityOf(w, D, "danzo-fubatsu").id, placement: { unitId: D, chosenIds: [D] } });
      expect(out.ok).toBe(true);
      expect(invulnOf(w, D)?.system.uses).toBe(3);
      expect(held(w, D)).toContain("critUp");
    }, MATCH);
  });

  const ON_B = { tokens: true, combat: { round: 4, started: true, system: { globalTurn: 13 }, actingFactionId: "B" } };
  const E3 = "danzoEnemy000003";
  /** Danzō holding Invuln, and three enemy Jacks around her, each with one Attack. */
  const ringed = (invuln) => [
    { from: "kato-danzo", id: D, owner: "p1", panel: { i: 5, j: 5 }, state: { factionId: "A" }, effects: [invuln] },
    { from: "jack-the-ripper", id: E, panel: { i: 5, j: 6 }, state: { factionId: "B" } },
    { from: "jack-the-ripper", id: E2, panel: { i: 6, j: 5 }, state: { factionId: "B" } },
    { from: "jack-the-ripper", id: E3, panel: { i: 4, j: 5 }, state: { factionId: "B" } },
  ];
  const hit = (w, by) => playAttack(w, { attacker: by, target: D, react: { [D]: ["nothing", "declined", "declined"] } });

  it("spends a charge on each hit it negates, and is gone with its last", async () => {
    // Two charges left: a faction has two Servant attacks a Turn.
    await withSubjects(ringed({ defId: "invuln", uses: 2 }), async ({ world: w }) => {
      w.dice.every(99);
      await hit(w, E);
      expect(w.actor(D).system.health.value).toBe(w.actor(D).system.health.max);
      expect(invulnOf(w, D)?.system.uses).toBe(1);
      await hit(w, E2);
      expect(w.actor(D).system.health.value).toBe(w.actor(D).system.health.max);
      expect(invulnOf(w, D)).toBeUndefined();
    }, ON_B);
  });

  it("leaves an Invuln applied without charges alone (Anastasia's)", async () => {
    await withSubjects(ringed({ defId: "invuln" }), async ({ world: w }) => {
      w.dice.every(99);
      await hit(w, E);
      expect(invulnOf(w, D)).toBeTruthy();
    }, ON_B);
  });
});

/* ========================================================================== */
/*  Slice 5: Dongyū                                                            */
/* ========================================================================== */

describe("Dongyū, Method 1: Presence Concealment C+ to every Unit in the 3x3 (#249 readings 2-5)", () => {
  const ALLY = "danzoAllyJack001";
  const PC_A_PLUS = { defId: "presenceConcealment", unremovable: true };
  const scene = () => [
    { from: "kato-danzo", id: D, owner: "p1", panel: { i: 5, j: 5 }, state: { factionId: "A" } },
    { from: "jack-the-ripper", id: E, panel: { i: 5, j: 7 }, state: { factionId: "B" } },
    { from: "jack-the-ripper", id: ALLY, panel: { i: 4, j: 6 }, state: { factionId: "A" }, effects: [PC_A_PLUS] },
  ];
  const instance = (w, id) => [...w.actor(id).effects].find((e) => e.system.defId === "presenceConcealment");

  it("conceals the enemy too, at C+, carried on the instance", async () => {
    await withSubjects(scene(), async ({ world: w }) => {
      const out = await castSkill(w, { caster: D, ability: abilityOf(w, D, "danzo-dongyu-concealment").id, placement: { direction: "e" } });
      expect(out.ok, out.reason).toBe(true);
      expect(instance(w, E)?.system.params).toEqual({ rank: "C+", evade: 2 });
      expect(instance(w, D), "the area is next to her, not on her").toBeUndefined();
    }, MATCH);
  });

  it("leaves a Unit whose own PC is Active on its own PC (reading 4)", async () => {
    await withSubjects(scene(), async ({ world: w }) => {
      await castSkill(w, { caster: D, ability: abilityOf(w, D, "danzo-dongyu-concealment").id, placement: { direction: "e" } });
      expect(instance(w, ALLY)?.system.params ?? null).toBeNull();
    }, MATCH);
  });

  it("offers an allied Jack it catches no pre-emption: his is against an enemy (found live)", async () => {
    const specs = [
      { from: "kato-danzo", id: D, owner: "p1", panel: { i: 5, j: 5 }, state: { factionId: "A" } },
      { from: "jack-the-ripper", id: ALLY, owner: "p1", panel: { i: 5, j: 6 }, state: { factionId: "A" } },
    ];
    await withSubjects(specs, async ({ world: w }) => {
      // An unscripted "Attack first?" to Player1 fails the world.
      await playAttack(w, {
        attacker: D, ability: abilityOf(w, D, "danzo-dongyu-concealment").id, placement: { direction: "e" },
        react: { [ALLY]: ["nothing", "declined", "declined"] },
      });
      expect(instance(w, ALLY)?.system.params).toEqual({ rank: "C+", evade: 2 });
    }, MATCH);
  });

  it("lets her Kawarimi into her own area, for the ally it caught (ruled 2026-10-18)", async () => {
    const specs = [
      { from: "kato-danzo", id: D, owner: "p1", panel: { i: 5, j: 5 }, state: { factionId: "A" } },
      { from: "jack-the-ripper", id: ALLY, owner: "p1", panel: { i: 5, j: 6 }, state: { factionId: "A" } },
    ];
    await withSubjects(specs, async ({ world: w }) => {
      const kawarimi = abilityOf(w, D, "danzo-kawarimi");
      const { processes } = await playAttack(w, {
        attacker: D, ability: abilityOf(w, D, "danzo-dongyu-concealment").id, placement: { direction: "e" },
        react: { [ALLY]: [`ability:${kawarimi.id}`], [D]: ["nothing", "declined", "declined"] },
      });
      expect(processes[0].defenderId, "the Process went on against her, where Jack stood").toBe(D);
      expect(processes[0].history.map((h) => `${h.state}:${h.event}`)).toContain("react:rebound");
      // Not concealed when she declared it, so PC.5 has nothing to end: the C+ it landed on her stays.
      expect([...w.actor(D).effects].find((e) => e.system.defId === "presenceConcealment")?.system.params)
        .toEqual({ rank: "C+", evade: 2 });
      expect(held(w, ALLY), "Jack, swapped out, is not caught").not.toContain("presenceConcealment");
    }, MATCH);
  });

  it("starts both methods' clock (reading 5)", async () => {
    await withSubjects(scene(), async ({ world: w }) => {
      await castSkill(w, { caster: D, ability: abilityOf(w, D, "danzo-dongyu-concealment").id, placement: { direction: "e" } });
      expect(abilityOf(w, D, "danzo-dongyu-concealment").system.cooldown.remaining).toBeGreaterThan(0);
      expect(abilityOf(w, D, "danzo-dongyu-storm").system.cooldown.remaining).toBeGreaterThan(0);
    }, MATCH);
  });
});

describe("Dongyū, Method 2: tripled against a Demon or a Beast (#249 reading 6)", () => {
  // Inside the bracket and before its +100, as Mesektet's 4× × 2 + 100 was
  // ruled (2026-10-06, Ch. 22 stage 3): (3 × 75) × 3 + 100 against a Beast.
  it("triples a `beast` Medea's stage 3, and not a plain one's", async () => {
    const medea = await authored("medea");
    const BEAST = "danzoBeastMedea1";
    const specs = [
      { from: "kato-danzo", id: D, owner: "p1", panel: { i: 5, j: 5 }, state: { factionId: "A" } },
      { from: "medea", id: E, panel: { i: 5, j: 6 }, state: { factionId: "B" } },
      { from: "medea", id: BEAST, panel: { i: 5, j: 8 }, state: { factionId: "B" },
        with: { attributes: [...medea.attributes, "beast"] } },
    ];
    await withSubjects(specs, async ({ world: w }) => {
      w.dice.every(99);
      const { declared } = await playAttack(w, {
        attacker: D, ability: abilityOf(w, D, "danzo-dongyu-storm").id, placement: { direction: "e" },
        react: { [E]: ["nothing", "declined", "declined"], [BEAST]: ["nothing", "declined", "declined"] },
      });
      const sources = (id) => {
        const p = declared.processes.find((x) => x.state.defenderId === id);
        return (w.messages.get(p.messageId).getFlag("fgt", "result")?.breakdown ?? [])
          .flatMap((b) => b.contributors ?? []).map((c) => c.note ?? c.source);
      };
      expect(sources(BEAST).some((s) => /Demon or Beast/.test(s ?? ""))).toBe(true);
      expect(sources(E).some((s) => /Demon or Beast/.test(s ?? ""))).toBe(false);
      // Nothing below stage 3 touches either: the +100 stays outside the ×3.
      expect(lost(w, BEAST) - 100).toBe(3 * (lost(w, E) - 100));
      expect(held(w, D), "Then, her Atk Up").toContain("atkUp");
    }, MATCH);
  });
});

/* ========================================================================== */
/*  Slice 6: Yuugao                                                            */
/* ========================================================================== */

describe("Yuugao (#249 readings 22-24)", () => {
  const M = "danzoMaster00001";
  const FOE = "danzoFoeAster001";
  const scene = ({ foe = {} } = {}) => [
    { from: "kato-danzo", id: D, owner: "p1", panel: { i: 5, j: 5 }, state: { factionId: "A", masterId: M, contract: "contracted" } },
    { from: "master-advanced", id: M, owner: "p1", panel: { i: 5, j: 3 }, state: { factionId: "A" } },
    { from: "asterios", id: FOE, panel: { i: 5, j: 7 }, state: { factionId: "B", ...(foe.state ?? {}) }, effects: foe.effects ?? [] },
  ];
  const yuugao = (w, react, own = ["declined"]) => playAttack(w, {
    attacker: D, ability: abilityOf(w, D, "danzo-yuugao").id, target: FOE, react: { [FOE]: react, [D]: own },
  });
  const breakdownOf = (w, declared) => w.messages.get(declared.processes[0].messageId).getFlag("fgt", "result")?.breakdown ?? [];

  it("spends a Command Spell, deals the DU's current Health, and Instakills", async () => {
    await withSubjects(scene({ foe: { state: { health: { value: 300, max: 1500 } } } }), async ({ world: w }) => {
      await w.actor(M).update({ "system.commandSpells": 3 });
      w.dice.every(99);
      const { declared } = await yuugao(w, ["nothing", "declined", "declined"]);
      expect(w.actor(M).system.commandSpells).toBe(2);
      expect([...w.messages.values()].some((m) => m.getFlag?.("fgt", "commandSpell") === "abilityCost"),
        "the spend is a card every player reads").toBe(true);
      const base = breakdownOf(w, declared).find((b) => b.index === 1)?.contributors?.[0];
      expect(base?.value).toBe(300);
      expect(w.actor(FOE).system.health.value).toBe(0);
      // A defeat posts a card every player reads (reading 33), naming the killer.
      const card = [...w.messages.values()].find((m) => m.getFlag?.("fgt", "defeat")?.unitId === FOE);
      expect(card, "the defeat card").toBeTruthy();
      expect(card.whisper ?? []).toEqual([]);
      expect(card.content).toMatch(/fgt-card--defeat/);
    }, MATCH);
  });

  it("Instakills past Magic Resistance, its damage being STR; the hit alone leaves her standing", async () => {
    const specs = [
      ...scene().slice(0, 2),
      { from: "scathach", id: FOE, panel: { i: 5, j: 7 }, state: { factionId: "B", health: { value: 1000, max: 1500 } } },
    ];
    await withSubjects(specs, async ({ world: w }) => {
      await w.actor(M).update({ "system.commandSpells": 3 });
      w.dice.every(99);
      const { declared } = await yuugao(w, ["nothing", "declined", "declined"]);
      const flags = w.messages.get(declared.processes[0].messageId).flags.fgt;
      expect(flags.damage, "short of her 1000: the Instakill is what defeats her").toBeLessThan(1000);
      expect(flags.effects.find((e) => e.id === "instakill"))
        .toMatchObject({ outcome: "applied", chance: null });
      expect(w.actor(FOE).system.defeated).toBe(true);
    }, MATCH);
  });

  it("is off with no Command Spell left", async () => {
    await withSubjects(scene(), async ({ world: w }) => {
      await w.actor(M).update({ "system.commandSpells": 0, "system.commandSpellsPerServant": {} });
      await expect(yuugao(w, [])).rejects.toThrow(/commandSpell/);
    }, MATCH);
  });

  it("is not evaded by Dodge or an Evade, only by Lucky Evasion; the Command Spell stays spent", async () => {
    await withSubjects(scene({ foe: { state: { luck: { value: 5, max: 5 } }, effects: [{ defId: "dodge", uses: 2 }] } }), async ({ world: w }) => {
      await w.actor(M).update({ "system.commandSpells": 3 });
      w.dice.every(1);
      const { processes } = await yuugao(w, ["evade", "contest", "declined", "declined"]);
      const history = processes[0].history.map((h) => `${h.state}:${h.event}`);
      expect(history).toContain("evadeRoll:fail");
      expect(history).toContain("s24_luckyEvasion:success");
      expect(w.actor(FOE).system.health.value).toBe(w.actor(FOE).system.health.max);
      expect(w.actor(M).system.commandSpells).toBe(2);
    }, MATCH);
  });
});

/* ========================================================================== */
/*  Slice 7: Kawarimi                                                          */
/* ========================================================================== */

describe("Kawarimi: two Units trade places and the Attack goes on (#249 readings 12-14, 32)", () => {
  const AU = "danzoKawaAU00001";
  const FOE2 = "danzoKawaFoe0002";
  const ALLY = "danzoKawaAlly001";
  const ON_B = { tokens: true, combat: { round: 4, started: true, system: { globalTurn: 13 }, actingFactionId: "B" } };
  const panelOf = (board, id) => board.units.find((u) => u.id === id)?.panel;
  const NOTHING = () => ["nothing", "declined", "declined"];

  it("Attacked herself, she swaps with an enemy, and the enemy is hit where she stood (case 1)", async () => {
    const specs = [
      { from: "kato-danzo", id: D, owner: "p1", panel: { i: 5, j: 5 }, state: { factionId: "A" } },
      { from: "medea", id: AU, panel: { i: 5, j: 7 }, state: { factionId: "B" } },
      { from: "medea", id: FOE2, panel: { i: 3, j: 5 }, state: { factionId: "B" } },
      // A second candidate, so the pick is asked rather than taken.
      { from: "medea", id: ALLY, owner: "p1", panel: { i: 6, j: 5 }, state: { factionId: "A" } },
    ];
    await withSubjects(specs, async ({ world: w }) => {
      w.dice.every(99);
      const kawarimi = abilityOf(w, D, "danzo-kawarimi");
      w.answer({ title: kawarimi.name, by: "p1", pick: [FOE2] });
      await playAttack(w, { attacker: AU, target: D, react: { [D]: [`ability:${kawarimi.id}`], [FOE2]: NOTHING() } });
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const board = currentBoard();
      expect(panelOf(board, D)).toEqual({ i: 3, j: 5 });
      expect(panelOf(board, FOE2)).toEqual({ i: 5, j: 5 });
      expect(lost(w, FOE2), "the enemy took the Attack").toBeGreaterThan(0);
      expect(lost(w, D)).toBe(0);
      expect([...w.messages.values()].some((m) => /trade places|FGT\.Swap\.Traded/.test(m.content ?? ""))).toBe(true);
    }, ON_B);
  });

  it("An ally Attacked, she swaps with that ally and takes the hit (case 2)", async () => {
    const specs = [
      { from: "kato-danzo", id: D, owner: "p1", panel: { i: 5, j: 5 }, state: { factionId: "A" } },
      { from: "medea", id: ALLY, owner: "p1", panel: { i: 5, j: 6 }, state: { factionId: "A" } },
      { from: "medea", id: AU, panel: { i: 5, j: 8 }, state: { factionId: "B" } },
    ];
    await withSubjects(specs, async ({ world: w }) => {
      w.dice.every(99);
      const kawarimi = abilityOf(w, D, "danzo-kawarimi");
      await playAttack(w, { attacker: AU, target: ALLY, react: { [ALLY]: [`ability:${kawarimi.id}`], [D]: NOTHING() } });
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const board = currentBoard();
      expect(panelOf(board, D)).toEqual({ i: 5, j: 6 });
      expect(panelOf(board, ALLY)).toEqual({ i: 5, j: 5 });
      expect(lost(w, D)).toBeGreaterThan(0);
      expect(lost(w, ALLY)).toBe(0);
    }, ON_B);
  });

  it("concealed, she may not pick an enemy, and may step in for an ally: no coin, PC ends (readings 14, 32)", async () => {
    const specs = [
      { from: "kato-danzo", id: D, owner: "p1", panel: { i: 5, j: 5 }, state: { factionId: "A" }, effects: PC },
      { from: "medea", id: ALLY, owner: "p1", panel: { i: 5, j: 6 }, state: { factionId: "A" } },
      { from: "medea", id: AU, panel: { i: 5, j: 8 }, state: { factionId: "B" } },
      { from: "medea", id: FOE2, panel: { i: 4, j: 4 }, state: { factionId: "B" } },
    ];
    await withSubjects(specs, async ({ world: w }) => {
      w.dice.every(99);
      const kawarimi = abilityOf(w, D, "danzo-kawarimi");
      const { legalSkillTargets } = await import("../../module/engine/skill-use.mjs");
      const picks = legalSkillTargets(kawarimi, w.actor(D), { sourceUnitId: AU });
      expect(picks).toContain(ALLY);
      expect(picks).not.toContain(FOE2);
      await playAttack(w, { attacker: AU, target: ALLY, react: { [ALLY]: [`ability:${kawarimi.id}`], [D]: NOTHING() } });
      expect(lost(w, D)).toBeGreaterThan(0);
      expect(held(w, D), "PC ends with the Process she stepped into").not.toContain("presenceConcealment");
    }, ON_B);
  });

  it("an area that caught both: the two trade Processes, and each is hit once (reading 36)", async () => {
    const heracles = await authored("heracles");
    const { usableWhileConcealed: _u, concealmentBreakChance: _c, ...strike } = await authored("danzo-funshindan");
    const area = { ...strike, id: "test-area-strike", slug: "testAreaStrike", name: "Test Area Strike" };
    const specs = [
      { from: "kato-danzo", id: D, owner: "p1", panel: { i: 5, j: 5 }, state: { factionId: "A" } },
      { from: "medea", id: ALLY, owner: "p1", panel: { i: 5, j: 7 }, state: { factionId: "A" } },
      // Heracles swings it: Medea's BA(STR) is all taken by the 5d10 the dice give.
      { from: "heracles", id: AU, panel: { i: 5, j: 9 }, state: { factionId: "B" },
        with: { abilities: [...heracles.abilities, area] } },
    ];
    await withSubjects(specs, async ({ world: w }) => {
      w.dice.every(99);
      const kawarimi = abilityOf(w, D, "danzo-kawarimi");
      const { resolveAttack } = await import("../../module/engine/attack.mjs");
      const declared = await resolveAttack({
        attackerId: AU, abilityId: abilityOf(w, AU, "test-area-strike").id, placement: { panel: { i: 5, j: 6 } },
      });
      const byDefender = Object.fromEntries(declared.processes.map((p) => [p.state.defenderId, p.messageId]));
      // She answers first and swaps; then each Process is answered by whoever it now strikes.
      const first = await playProcess(w, byDefender[D], { [D]: [`ability:${kawarimi.id}`], [ALLY]: NOTHING() });
      const second = await playProcess(w, byDefender[ALLY], { [D]: NOTHING() });
      const processes = [first, second];
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const board = currentBoard();
      expect(panelOf(board, D)).toEqual({ i: 5, j: 7 });
      expect(panelOf(board, ALLY)).toEqual({ i: 5, j: 5 });
      expect(processes.map((p) => p.defenderId).sort()).toEqual([ALLY, D].sort());
      expect(lost(w, D)).toBeGreaterThan(0);
      expect(lost(w, ALLY)).toBeGreaterThan(0);
    }, ON_B);
  });
});

/* ========================================================================== */
/*  Slice 9: Kirihanasu, a Feigned Defeat                                      */
/* ========================================================================== */

describe("Kirihanasu: a Feigned Defeat (#249 readings 15-19, 33-35)", () => {
  const AU = "danzoKiriAU00001";
  const M = "danzoKiriMaster1";
  const ON_B = { tokens: true, combat: { round: 4, started: true, system: { globalTurn: 13 }, actingFactionId: "B" } };
  // Hers is the GM's here, so Player1 stands for every other player: the one deceived.
  const scene = (health) => [
    { from: "kato-danzo", id: D, panel: { i: 5, j: 5 },
      state: { factionId: "A", masterId: M, contract: "contracted", health: { value: health, max: 750 } } },
    { from: "master-advanced", id: M, panel: { i: 5, j: 3 }, state: { factionId: "A" } },
    { from: "heracles", id: AU, panel: { i: 5, j: 6 }, state: { factionId: "B" } },
  ];
  const swing = (w) => playAttack(w, { attacker: AU, target: D, react: { [D]: ["nothing", "declined", "declined"] } });

  it("is offered on a fatal hit; taken, she receives nothing and becomes a ghost", async () => {
    await withSubjects(scene(60), async ({ world: w }) => {
      w.dice.every(99);
      const kiri = abilityOf(w, D, "danzo-kirihanasu");
      w.answer({ title: "FGT.Feigned.OfferTitle", by: "u1", pick: [kiri.id] });
      await swing(w);
      expect(w.actor(D).system.health.value, "nothing was received").toBe(60);
      expect(w.actor(D).system.defeated).toBeFalsy();
      expect(held(w, D)).toEqual(expect.arrayContaining(["feignedDefeat", "presenceConcealment"]));
      const pc = [...w.actor(D).effects].find((e) => e.system.defId === "presenceConcealment");
      expect(pc.system.expiry, "no expiry: only her Attack ends it").toBeNull();
      expect(w.actor(D).system.masterId).toBe(M);
      const cards = [...w.messages.values()];
      const shown = cards.find((m) => m.getFlag?.("fgt", "defeat")?.unitId === D);
      expect(shown, "the defeat card the others are shown").toBeTruthy();
      expect(shown.whisper).toEqual(["p1"]);
      const truth = cards.find((m) => m.getFlag?.("fgt", "feignedDefeat")?.unitId === D);
      expect(truth?.whisper, "the truth, to the GM and her owners").toEqual(["u1"]);
    }, ON_B);
  });

  it("is not offered on a hit she survives", async () => {
    await withSubjects(scene(750), async ({ world: w }) => {
      w.dice.every(99);
      await swing(w);
      expect(held(w, D)).not.toContain("feignedDefeat");
      expect(w.actor(D).system.health.value).toBeLessThan(750);
    }, ON_B);
  });

  it("declined, the hit lands and she is defeated for real, with the public card", async () => {
    await withSubjects(scene(60), async ({ world: w }) => {
      w.dice.every(99);
      w.answer({ title: "FGT.Feigned.OfferTitle", by: "u1", decline: true });
      await swing(w);
      expect(w.actor(D).system.defeated).toBe(true);
      const card = [...w.messages.values()].find((m) => m.getFlag?.("fgt", "defeat")?.unitId === D);
      expect(card.whisper ?? []).toEqual([]);
    }, ON_B);
  });
});

/* ========================================================================== */
/*  Slice 10: the reveal                                                       */
/* ========================================================================== */

describe("the ghost's reveal (#249 readings 18, 26, 27, 29-31)", () => {
  const GHOST = [{ defId: "feignedDefeat", unremovable: true }, { defId: "presenceConcealment", unremovable: true }];
  const revealed = (w) => [...w.messages.values()].some((m) => m.getFlag?.("fgt", "feignedDefeat")?.revealed);

  it("her Attack reveals her; PC.5 ends PC after it", async () => {
    const specs = [
      { from: "kato-danzo", id: D, owner: "p1", panel: { i: 5, j: 5 }, state: { factionId: "A" }, effects: GHOST },
      { from: "medea", id: E, panel: { i: 5, j: 7 }, state: { factionId: "B" } },
    ];
    await withSubjects(specs, async ({ world: w }) => {
      w.dice.every(99);
      await playAttack(w, { attacker: D, target: E, react: { [E]: ["nothing", "declined", "declined"] } });
      expect(held(w, D)).not.toContain("feignedDefeat");
      expect(revealed(w), "a public card says she lives").toBe(true);
      expect(held(w, D), "PC.5, after her revealing Attack").not.toContain("presenceConcealment");
      expect(lost(w, E)).toBeGreaterThan(0);
    }, MATCH);
  });

  it("an Attack the gates refuse reveals nothing (found live)", async () => {
    const specs = [
      { from: "kato-danzo", id: D, owner: "p1", panel: { i: 5, j: 5 }, state: { factionId: "A" }, effects: GHOST },
      { from: "medea", id: E, panel: { i: 5, j: 12 }, state: { factionId: "B" } },
    ];
    await withSubjects(specs, async ({ world: w }) => {
      expect(held(w, D), "a ghost before").toContain("feignedDefeat");
      const { resolveAttack } = await import("../../module/engine/attack.mjs");
      await expect(resolveAttack({ attackerId: D, placement: { unitId: E, chosenIds: [E] } })).rejects.toThrow(/out of Range/);
      expect(held(w, D), "still a ghost").toContain("feignedDefeat");
      expect(revealed(w), "no card says she lives").toBe(false);
    }, MATCH);
  });

  it("Funshindan's held roll keeps PC, now an ordinary one with its 2◈ from the reveal", async () => {
    const specs = [
      { from: "kato-danzo", id: D, owner: "p1", panel: { i: 5, j: 5 }, state: { factionId: "A" }, effects: GHOST },
      { from: "medea", id: E, panel: { i: 5, j: 8 }, state: { factionId: "B" } },
    ];
    await withSubjects(specs, async ({ world: w }) => {
      w.dice.every(99);
      await playAttack(w, {
        attacker: D, ability: abilityOf(w, D, "danzo-funshindan").id, placement: { panel: { i: 5, j: 8 } },
        react: { [E]: ["nothing", "declined", "declined"] },
      });
      expect(held(w, D)).not.toContain("feignedDefeat");
      const pc = [...w.actor(D).effects].find((e) => e.system.defId === "presenceConcealment");
      expect(pc, "the held roll keeps it").toBeTruthy();
      expect(pc.system.expiry).toBe(12 + 6);
    }, MATCH);
  });

  it("a tick that empties her bar reveals her, then defeats her for real", async () => {
    await withSubjects([{ from: "kato-danzo", id: D, owner: "p1", panel: { i: 5, j: 5 }, state: { factionId: "A" }, effects: GHOST }],
      async ({ world: w }) => {
        const { worldIO } = await import("../../module/engine/io.mjs");
        await worldIO().defeat(D, "burn");
        expect(revealed(w)).toBe(true);
        expect(held(w, D)).not.toContain("feignedDefeat");
        expect(w.actor(D).system.defeated).toBe(true);
        expect([...w.messages.values()].some((m) => m.getFlag?.("fgt", "defeat")?.unitId === D && !m.getFlag("fgt", "defeat").feigned)).toBe(true);
      }, MATCH);
  });
});
