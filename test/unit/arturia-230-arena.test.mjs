/**
 * Arturia, audit #230, played in the arena: what only a Combat Process or a
 * use shows. The projection halves are in `arturia-230.test.mjs`.
 * @see docs/superpowers/specs/2026-10-16-arturia-clauses.md
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { playAttack, castSkill } from "../helpers/process.mjs";
import { fireEvent } from "../../module/engine/scheduler.mjs";
import * as process from "../../module/engine/combat-process.mjs";

beforeAll(prepareSubjects, 120_000);

const ART = "arturiaPendrag01";
const MAS = "arturiaMaster001";
const FOE = "arturiaFoe000001";

const TICK = 30;
const MATCH = { tokens: true, combat: { round: 10, started: true, system: { globalTurn: TICK }, actingFactionId: "A" } };

const abilityOf = (w, actorId, contentId) => w.actor(actorId).items.find((i) => i.system?.contentId === contentId);
const held = (w, id) => [...w.actor(id).effects].map((e) => e.system.defId);

/** Arturia, her Master beside her, an enemy in front. */
const party = (extra = []) => [
  { from: "arturia", id: ART, panel: { i: 5, j: 5 }, state: { factionId: "A", masterId: MAS, contract: "contracted" } },
  { from: "master-advanced", id: MAS, panel: { i: 5, j: 4 }, state: { factionId: "A" } },
  { from: "medea", id: FOE, panel: { i: 5, j: 6 }, state: { factionId: "B" } },
  ...extra,
];

/* ========================================================================== */

describe("Strike Air locks Invisible Air off for 1◈ (SA.ia)", () => {
  it("is previewed as it lands: her Atk Ups are bypassed there too (SA.flat, live)", async () => {
    // Found live: the targeting tooltip read "Scáthach 375" under Knight of
    // Utopia, and the card dealt 300 -- the preview's attack lacked the damage
    // block's `bypassModifiers`, which each Process's attack carries.
    await withSubjects(party(), async ({ world: w }) => {
      await w.actor(ART).createEmbeddedDocuments("ActiveEffect", [
        { name: "Atk Up (Charisma)", system: { defId: "atkUpCharismaUnit", magnitude: 30, npMagnitude: 15, expiry: TICK + 3 } },
      ]);
      const { previewContext } = await import("../../module/engine/attack.mjs");
      const { damageRange, negationBounds } = await import("../../module/rules/preview.mjs");
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const board = currentBoard();
      const caster = board.units.find((u) => u.id === ART);
      const defender = board.units.find((u) => u.id === FOE);
      const ctx = previewContext({ caster, defender, ability: abilityOf(w, ART, "arturia-strike-air"), board, isNP: true });
      const range = damageRange(ctx, { negation: negationBounds(defender, true) });
      expect(range.min).toBe(300);
      expect(range.max).toBe(300);
    }, MATCH);
  });

  it("hits for 300 that her own modifiers do not touch, then suspends the mode", async () => {
    await withSubjects(party(), async ({ world: w }) => {
      const sa = abilityOf(w, ART, "arturia-strike-air");
      const before = w.actor(FOE).system.health.value;
      await playAttack(w, { attacker: ART, ability: sa.id, target: FOE, react: { [FOE]: ["nothing", "declined"] } });
      expect(before - w.actor(FOE).system.health.value).toBeGreaterThan(0);
      const ia = abilityOf(w, ART, "arturia-invisible-air");
      expect(ia.system.active).toBe(false);
      expect(ia.system.suspendedUntil).toBe(TICK + 3);
    }, MATCH);
  });
});

/* ========================================================================== */

describe("Instinct rolls on every Attack, before she reacts (IN.1, IN.1.fail; live)", () => {
  // Found live: Medea's Normal Attack on Arturia offered her reactions and
  // rolled no Instinct at all; chosen, an Evade succeeded outright, 100% and
  // not 70. The automatic Evade was asked only on the Evade rung (#230).
  const THEIRS = { ...MATCH, combat: { ...MATCH.combat, actingFactionId: "B" } };
  const instinctRoll = (w, id) => process.deserialize(w.messages.get(id).getFlag("fgt", "process")).rolls
    .find((r) => r.check === "instinct");

  it("a 70 or under evades it outright, whatever she would have chosen", async () => {
    await withSubjects(party(), async ({ world: w }) => {
      w.dice.set("d100", 30);
      const before = w.actor(ART).system.health.value;
      const { declared } = await playAttack(w, { attacker: FOE, target: ART, react: { [FOE]: ["declined", "declined"], [ART]: ["declined", "declined"] } });
      expect(w.actor(ART).system.health.value).toBe(before);
      const record = instinctRoll(w, declared.processes[0].messageId);
      expect(record).toEqual(expect.objectContaining({ total: 30, target: 70, outcome: "success" }));
      // The line every client reads names her as the table knows her (live).
      const { publicIdentityOf } = await import("../../module/engine/public-identity.mjs");
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const shown = publicIdentityOf(w.actor(ART), currentBoard()).name;
      expect(shown).not.toBe(w.actor(ART).name);
      expect(record.purpose).toMatch(new RegExp(`^${shown}'s Instinct`));
    }, THEIRS);
  });

  it("over 70 fails, and the Process goes on: she takes the hit she chose to take", async () => {
    await withSubjects(party(), async ({ world: w }) => {
      w.dice.set("d100", 95);
      const before = w.actor(ART).system.health.value;
      const { declared } = await playAttack(w, { attacker: FOE, target: ART, react: { [ART]: ["nothing", "declined", "declined"], [FOE]: ["declined"] } });
      expect(w.actor(ART).system.health.value).toBeLessThan(before);
      expect(instinctRoll(w, declared.processes[0].messageId)).toEqual(expect.objectContaining({ total: 95, outcome: "fail" }));
    }, THEIRS);
  });

  it("an Attack on her Master beside her turns to her, and the table reads her public name (live)", async () => {
    // Found live: "Arturia stands next to Master of Saber of Faction 1: the
    // Attack is changed to Arturia." -- a public line, with her True Name.
    // Her Master between them: she is beside him and out of Medea's Range.
    const beside = party().map((s) => (s.id === ART ? { ...s, panel: { i: 5, j: 3 } }
      : s.id === FOE ? { ...s, panel: { i: 5, j: 7 } } : s));
    await withSubjects(beside, async ({ world: w }) => {
      w.dice.set("d100", 95);
      const format = vi.spyOn(game.i18n, "format");
      await playAttack(w, { attacker: FOE, target: MAS, react: { [ART]: ["nothing", "declined", "declined"], [FOE]: ["declined"] } });
      const said = format.mock.calls.find(([key]) => key === "FGT.MasterGuard.Redirected")?.[1];
      format.mockRestore();
      const { publicIdentityOf } = await import("../../module/engine/public-identity.mjs");
      const { currentBoard } = await import("../../module/engine/board.mjs");
      expect(said?.guard).toBe(publicIdentityOf(w.actor(ART), currentBoard()).name);
      expect(said?.guard).not.toBe(w.actor(ART).name);
    }, THEIRS);
  });

  it("after a failed Instinct, an Evade she chooses is rolled, not automatic", async () => {
    await withSubjects(party(), async ({ world: w }) => {
      w.dice.set("d100", 95);
      w.dice.set("d20", 20);
      const { declared } = await playAttack(w, { attacker: FOE, target: ART, react: { [ART]: ["evade", "declined", "accept", "declined", "declined"], [FOE]: ["declined", "declined"] } });
      const rolls = process.deserialize(w.messages.get(declared.processes[0].messageId).getFlag("fgt", "process")).rolls;
      const evade = rolls.find((r) => r.entryId === "evade-");
      expect(evade).toEqual(expect.objectContaining({ raw: 20 }));
      expect(evade.modifiers.map((m) => m.stage)).not.toContain("auto");
    }, THEIRS);
  });
});

/* ========================================================================== */

describe("Mana Burst on its Cooldown (MB.oncd; reading 2)", () => {
  it("the Master pays 20 and the clock stays where it was", async () => {
    await withSubjects(party(), async ({ world: w }) => {
      const mb = abilityOf(w, ART, "arturia-mana-burst");
      await mb.update({ "system.cooldown.remaining": 5 });
      const health = w.actor(MAS).system.health.value;
      await playAttack(w, { attacker: ART, ability: mb.id, target: FOE, react: { [FOE]: ["nothing", "declined"] } });
      expect(w.actor(MAS).system.health.value).toBe(health - 20);
      expect(abilityOf(w, ART, "arturia-mana-burst").system.cooldown.remaining).toBe(5);
    }, MATCH);
  });

  it("off its Cooldown it costs the Master nothing and starts the clock", async () => {
    await withSubjects(party(), async ({ world: w }) => {
      const mb = abilityOf(w, ART, "arturia-mana-burst");
      const health = w.actor(MAS).system.health.value;
      await playAttack(w, { attacker: ART, ability: mb.id, target: FOE, react: { [FOE]: ["nothing", "declined"] } });
      expect(w.actor(MAS).system.health.value).toBe(health);
      expect(abilityOf(w, ART, "arturia-mana-burst").system.cooldown.remaining).toBe(9);
    }, MATCH);
  });
});

/* ========================================================================== */

describe("Knight of Utopia (KU.1, KU.2, KU.3, KU.4; readings 4, 23)", () => {
  it("two Atk Ups (Charisma) on her, a Round Table Unit, and her two self-buffs", async () => {
    await withSubjects(party(), async ({ world: w }) => {
      const out = await castSkill(w, { caster: ART, ability: abilityOf(w, ART, "arturia-knight-of-utopia").id });
      expect(out.ok).toBe(true);
      const atk = [...w.actor(ART).effects].filter((e) => e.system.defId === "atkUpCharismaUnit").map((e) => e.system.magnitude).sort();
      expect(atk).toEqual([20, 30]);
      expect(held(w, ART)).toEqual(expect.arrayContaining(["dmgBoostUtopia", "utopia"]));
      // Her Master is no Round Table Unit: one Atk Up.
      expect([...w.actor(MAS).effects].filter((e) => e.system.defId === "atkUpCharismaUnit")).toHaveLength(1);
    }, MATCH);
  });
});

/* ========================================================================== */

describe("Dmg Boost (Utopia) counts Attacks (KU.3; readings 5, 6, 25)", () => {
  const performed = (unit, board, kind) => fireEvent("attackPerformed", [unit], {
    tick: TICK, turnsPerRound: 3, board, options: new Set([`attack:kind:${kind}`, "attack:performed"]),
    event: { unitsHit: 1 }, rolls: {},
  });

  it("an Attack before the third counts one more, an NP included", async () => {
    await withSubjects([{ from: "arturia", id: ART, effects: [{ defId: "dmgBoostUtopia" }, { defId: "utopiaCount" }, { defId: "utopiaCount" }] }], ({ unit, board }) => {
      const out = performed(unit(ART), board, "np");
      expect(out.filter((i) => i.t === "applyEffect").map((i) => i.effect.defId)).toEqual(["utopiaCount"]);
      expect(out.filter((i) => i.t === "removeEffect")).toEqual([]);
    });
  });

  it("the Normal Attack after three spends it, and counts nothing", async () => {
    await withSubjects([{ from: "arturia", id: ART, effects: [{ defId: "dmgBoostUtopia" }, { defId: "utopiaCount" }, { defId: "utopiaCount" }, { defId: "utopiaCount" }] }], ({ unit, board }) => {
      const out = performed(unit(ART), board, "normal");
      expect(out.filter((i) => i.t === "removeEffect").map((i) => i.effectId)).toEqual(["dmgBoostUtopia"]);
      expect(out.filter((i) => i.t === "applyEffect")).toEqual([]);
      // ...and with three counted, the +200% stands in the Normal Attack's bag.
      expect(unit(ART).modifiers.filter((m) => m.value === 200 && m.key === "atkUp")).toHaveLength(1);
    });
  });
});

/* ========================================================================== */

describe("Utopia cuts NP Cooldown per Unit hit, played (KU.4; reading 7)", () => {
  it("a Normal Attack that hits one Unit takes ⅓◈ off each Noble Phantasm", async () => {
    await withSubjects(party(), async ({ world: w }) => {
      await w.actor(ART).createEmbeddedDocuments("ActiveEffect", [{ name: "Utopia", system: { defId: "utopia", expiry: TICK + 9 } }]);
      const sa = abilityOf(w, ART, "arturia-strike-air");
      await sa.update({ "system.cooldown.remaining": 10 });
      const { declared } = await playAttack(w, { attacker: ART, ability: null, target: FOE, react: { [FOE]: ["nothing", "declined"] } });
      expect(abilityOf(w, ART, "arturia-strike-air").system.cooldown.remaining).toBe(9);
      // ...and the card says so: a cut made once the Combat Phase is over had
      // no line anywhere (#230, live, Excalibur's own 23 -> 21).
      const lines = (w.messages.get(declared.processes[0].messageId).getFlag("fgt", "effects") ?? [])
        .filter((e) => e.id === "cooldown").map((e) => e.name);
      expect(lines).toContain("Strike Air: Hammer of the Wind King: Cooldown 10 → 9");
    }, MATCH);
  });
});

/* ========================================================================== */

describe("Avalon placed inside her Master (AV.2.*, AV.a; readings 16, 22)", () => {
  const regions = [{ id: "hbA", panels: [{ i: 5, j: 4 }, { i: 5, j: 5 }, { i: 6, j: 4 }, { i: 6, j: 5 }], behaviors: [{ type: "homeBase", system: { factionId: "A" } }] }];

  it("moves to the Master with her bond, gives it its Avalon, and locks both for the Turn", async () => {
    await withSubjects(party(), async ({ world: w, }) => {
      const { applyWorldIntents } = await import("../../module/engine/applier.mjs");
      const I = await import("../../module/engine/intents.mjs");
      await applyWorldIntents([I.itemGrant(ART, "avalon", 1)], "test");
      expect(w.actor(ART).items.some((i) => i.system?.contentId === "avalon")).toBe(true);

      const out = await castSkill(w, { caster: ART, ability: abilityOf(w, ART, "arturia-avalon-place").id });
      expect(out.ok).toBe(true);
      const item = w.actor(MAS).items.find((i) => i.system?.contentId === "avalon");
      expect(item?.system.bondUnitId).toBe(ART);
      expect(item?.system.bondMasterId).toBe(MAS);
      expect(w.actor(ART).items.some((i) => i.system?.contentId === "avalon")).toBe(false);
      expect(w.actor(MAS).items.map((i) => i.system?.contentId)).toEqual(expect.arrayContaining(["avalon-master", "avalon-pass"]));
      expect(held(w, ART)).toContain("itemRite");
      expect(held(w, MAS)).toContain("itemRite");
      // The card names whose lock each is, and the hand the Item left (live).
      const card = [...w.messages].filter((m) => m.getFlag("fgt", "kind") === "skill").at(-1);
      const master = w.actor(MAS).name;
      expect(card.getFlag("fgt", "rows").map((r) => r.name)).toEqual(["Item Rite", `${master}: Item Rite`, `[Avalon] → ${master}`]);
    }, { ...MATCH, regions, pack: ["avalon", "avalon-master", "avalon-pass"] });
  });

  it("a Servant who Moved before the rite cannot Move after it (AV.2.lock, live)", async () => {
    // Found live: Arturia rode one panel, placed [Avalon], and a second drag
    // carried her and her Master on. The move hook asked the budget only of a
    // Unit not yet moved, and the budget is where a prevention was asked.
    await withSubjects(party(), async ({ world: w }) => {
      const { Movement } = await import("../../module/engine/movement-hooks.mjs");
      Movement.attach();
      const { applyWorldIntents } = await import("../../module/engine/applier.mjs");
      const I = await import("../../module/engine/intents.mjs");
      await applyWorldIntents([I.itemGrant(ART, "avalon", 1)], "test");
      const token = [...w.tokens.values()].find((t) => t.actorId === ART || t.actor?.id === ART);
      const size = canvas.grid.size;
      await token.update({ y: token.y + size });
      const first = { x: token.x, y: token.y };
      const out = await castSkill(w, { caster: ART, ability: abilityOf(w, ART, "arturia-avalon-place").id });
      expect(out.ok).toBe(true);
      expect(held(w, ART)).toContain("itemRite");
      await token.update({ y: token.y + size });
      expect({ x: token.x, y: token.y }).toEqual(first);
    }, { ...MATCH, regions: [{ id: "hbA", panels: [{ i: 5, j: 4 }, { i: 5, j: 5 }, { i: 6, j: 4 }, { i: 6, j: 5 }, { i: 7, j: 4 }, { i: 7, j: 5 }], behaviors: [{ type: "homeBase", system: { factionId: "A" } }] }], pack: ["avalon", "avalon-master", "avalon-pass"] });
  });

  it("raises its holder: Max Health +100, Max Luck +2, Base Attack +50", async () => {
    await withSubjects(party(), async ({ world: w, }) => {
      const { unitOf, currentBoard } = await import("../../module/engine/board.mjs");
      const before = unitOf(w.actor(MAS), currentBoard());
      const maxLuck = () => w.actor(MAS).system.luck.max;
      const luckBefore = maxLuck();
      const { applyWorldIntents } = await import("../../module/engine/applier.mjs");
      const I = await import("../../module/engine/intents.mjs");
      await applyWorldIntents([I.itemGrant(ART, "avalon", 1)], "test");
      await applyWorldIntents([I.moveItem(MAS, ART, "avalon", { bondUnitId: ART, bondMasterId: MAS })], "test");
      const after = unitOf(w.actor(MAS), currentBoard());
      expect(after.maxHealth - before.maxHealth).toBe(100);
      expect(maxLuck() - luckBefore).toBe(2);
      expect([after.baseAttack.str - before.baseAttack.str, after.baseAttack.mag - before.baseAttack.mag]).toEqual([50, 50]);
      // Its Servant gains nothing from holding it.
      expect(unitOf(w.actor(ART), currentBoard()).baseAttack.str).toBe(125);
    }, { ...MATCH, regions, pack: ["avalon", "avalon-master", "avalon-pass"] });
  });

  it("heals after a Damage Step that DAMAGED him, not after a hit for 0 (AV.b.when; reading 17, live)", async () => {
    // Found live: the Master's own Avalon cut Medusa's hit to 0, and the
    // `damageTaken` event still fired its [Avalon] handler. A hit for nothing
    // is still a hit for the riders (#204), but it "damaged" nobody.
    await withSubjects(party(), async ({ world: w }) => {
      const { unitOf, currentBoard } = await import("../../module/engine/board.mjs");
      const { applyWorldIntents } = await import("../../module/engine/applier.mjs");
      const I = await import("../../module/engine/intents.mjs");
      await applyWorldIntents([I.itemGrant(ART, "avalon", 1)], "test");
      await applyWorldIntents([I.moveItem(MAS, ART, "avalon", { bondUnitId: ART, bondMasterId: MAS })], "test");
      const board = currentBoard();
      const heals = (amount) => fireEvent("damageTaken", [unitOf(w.actor(MAS), board)], {
        board, tick: TICK, turnsPerRound: 3, options: [], victim: { unitId: FOE }, rolls: {}, event: { amount },
      }).filter((i) => i.t === "heal");
      expect(heals(0)).toEqual([]);
      expect(heals(40)).toEqual([expect.objectContaining({ unitId: MAS, source: "[Avalon]" })]);
    }, { ...MATCH, regions, pack: ["avalon", "avalon-master", "avalon-pass"] });
  });
});

/* ========================================================================== */

const PACK = ["avalon", "avalon-master", "avalon-pass"];
const THEIRS = { tokens: true, combat: { round: 10, started: true, system: { globalTurn: TICK }, actingFactionId: "B" } };

/** Give a Unit the Item, through the one door every Item enters by. */
async function grantAvalon(id) {
  const { applyWorldIntents } = await import("../../module/engine/applier.mjs");
  const I = await import("../../module/engine/intents.mjs");
  await applyWorldIntents([I.itemGrant(id, "avalon", 1)], "test");
}

/** Place it inside her Master, as Method 2 does, without the Turn's conditions. */
async function placeAvalon() {
  const { applyWorldIntents } = await import("../../module/engine/applier.mjs");
  const I = await import("../../module/engine/intents.mjs");
  await grantAvalon(ART);
  await applyWorldIntents([I.moveItem(MAS, ART, "avalon", { bondUnitId: ART, bondMasterId: MAS })], "test");
}

describe("Avalon, Method 1 (AV.1.*; readings 14, 15, 24)", () => {
  const ALLY = "arturiaAlly00001";
  const near = [
    { from: "arturia", id: ART, panel: { i: 5, j: 5 }, state: { factionId: "A", masterId: MAS, contract: "contracted" } },
    // Inside his ZON: a Noble Phantasm is not used from outside it.
    { from: "master-advanced", id: MAS, panel: { i: 5, j: 3 }, state: { factionId: "A" } },
    { from: "heracles", id: ALLY, panel: { i: 5, j: 6 }, state: { factionId: "A" } },
    { from: "medea", id: FOE, panel: { i: 5, j: 7 }, state: { factionId: "B" } },
  ];

  it("offered to the ally beside her, it negates the Attack on him, at no cost to her Master", async () => {
    await withSubjects(near, async ({ world: w }) => {
      await grantAvalon(ART);
      const avalon = abilityOf(w, ART, "arturia-avalon");
      const hp = w.actor(ALLY).system.health.value;
      const mhp = w.actor(MAS).system.health.value;
      const { declared } = await playAttack(w, {
        attacker: FOE, ability: null, target: ALLY,
        react: { [ALLY]: [`ability:${avalon.id}`, "declined"] },
      });
      expect(w.messages.get(declared.messageId).getFlag("fgt", "result")?.total ?? 0).toBe(0);
      expect(w.actor(ALLY).system.health.value).toBe(hp);
      expect(w.actor(MAS).system.health.value).toBe(mhp);
      expect(abilityOf(w, ART, "arturia-avalon").system.cooldown.remaining).toBe(24);
      // The offer names her as the table knows her: the card is public, and it
      // read "Avalon: The Everdistant Utopia (Arturia)" (live).
      const { publicIdentityOf } = await import("../../module/engine/public-identity.mjs");
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const offered = process.deserialize(w.messages.get(declared.messageId).getFlag("fgt", "process")).reactionAbilities?.[ALLY] ?? [];
      const shown = publicIdentityOf(w.actor(ART), currentBoard()).name;
      expect(shown).not.toBe(w.actor(ART).name);
      expect(offered.map((a) => a.name)).toContain(`${avalon.name} (${shown})`);
    }, { ...THEIRS, pack: PACK });
  });

  it("is not offered without the Item", async () => {
    await withSubjects(near, async ({ world: w }) => {
      const { reactionAbilities, windowSubject } = await import("../../module/rules/reactions.mjs");
      const { unitOf, currentBoard } = await import("../../module/engine/board.mjs");
      const offer = reactionAbilities(windowSubject(unitOf(w.actor(ART), currentBoard()), w.actor(ART).items));
      expect(offer.map((a) => a.system?.contentId)).not.toContain("arturia-avalon");
    }, { ...THEIRS, pack: PACK });
  });
});

describe("Avalon inside her Master, defended (AV.b, AV.c, AV.e, AVM.*; readings 17-19)", () => {
  it("its bond reads her Master and how far she stands", async () => {
    await withSubjects(party(), async ({ world: w }) => {
      await placeAvalon();
      const { unitOf, currentBoard } = await import("../../module/engine/board.mjs");
      const m = currentBoard().units.find((u) => u.id === MAS) ?? unitOf(w.actor(MAS), currentBoard());
      expect(m.bonds).toEqual([{ contentId: "avalon", unitId: ART, own: true, defeated: false, distance: 1 }]);
    }, { ...MATCH, pack: PACK });
  });

  it("a lethal blow at 10% or more leaves 1 Health, and the Master is not Overpowered", async () => {
    // She stands 3 away: no guard for him, and still his Avalon's 10%.
    await withSubjects([
      { from: "arturia", id: ART, panel: { i: 5, j: 5 }, state: { factionId: "A", masterId: MAS, contract: "contracted" } },
      { from: "master-advanced", id: MAS, panel: { i: 5, j: 2 }, state: { factionId: "A" } },
      { from: "medea", id: FOE, panel: { i: 5, j: 1 }, state: { factionId: "B" }, effects: [{ defId: "atkUp", magnitude: 9000, npMagnitude: 9000 }] },
    ], async ({ world: w }) => {
      await placeAvalon();
      await w.actor(MAS).update({ "system.health.value": 120 });
      w.dice.every(1);
      await playAttack(w, { attacker: FOE, ability: null, target: MAS, react: { [MAS]: ["nothing", "declined"] } });
      // Left at 1, then the Damage Step's end heals 20% of its maximum: she
      // stands within 3 (AV.b).
      const max = w.actor(MAS).system.health.max;
      expect(w.actor(MAS).system.health.value).toBe(1 + Math.floor(max * 0.2));
      expect(w.actor(MAS).system.defeated ?? false).toBe(false);
    }, { ...THEIRS, pack: PACK });
  });

  it("the Master's own Avalon: 80% off and three debuffs to ward, with her within 3", async () => {
    await withSubjects(party(), async ({ world: w }) => {
      await placeAvalon();
      // At its window, as the reaction rung uses it.
      const { useSkill } = await import("../../module/engine/skill-use.mjs");
      const out = await useSkill({ actorId: MAS, abilityId: abilityOf(w, MAS, "avalon-master").id, atWindow: true });
      expect(out.ok).toBe(true);
      const e = [...w.actor(MAS).effects].map((x) => [x.system.defId, x.system.magnitude, x.system.uses]);
      expect(e).toEqual(expect.arrayContaining([["avalonVeil", 80, expect.anything()], ["debuffWard", expect.anything(), 3]]));
    }, { ...MATCH, pack: PACK });
  });
});

/* ========================================================================== */

describe("Her Master hands Avalon to another Master (AV.pass, AV.other; live)", () => {
  // Found live: "Avalon (pass to a Master)" refused Karna's Master, beside him
  // in their Home Base, as "excluded by this ability's target predicate": the
  // targeting filter's own option set held no `target:inHomeBase`.
  const OTHER = "otherMaster00001";
  const base = [{ id: "hbA", panels: [{ i: 5, j: 3 }, { i: 5, j: 4 }, { i: 5, j: 5 }, { i: 4, j: 3 }, { i: 4, j: 4 }], behaviors: [{ type: "homeBase", system: { factionId: "A" } }] }];

  it("passes it whole to the Master beside him, who gains its abilities", async () => {
    const specs = [...party(), { from: "master-advanced", id: OTHER, panel: { i: 4, j: 4 }, state: { factionId: "A" } }];
    await withSubjects(specs, async ({ world: w }) => {
      await placeAvalon();
      const pass = w.actor(MAS).items.find((i) => i.system?.contentId === "avalon-pass");
      const out = await castSkill(w, { caster: MAS, ability: pass.id, placement: { unitId: OTHER, chosenIds: [OTHER] } });
      expect(out.ok, out.reason).toBe(true);
      expect(w.actor(OTHER).items.map((i) => i.system?.contentId)).toEqual(expect.arrayContaining(["avalon", "avalon-master", "avalon-pass"]));
      expect(w.actor(MAS).items.some((i) => i.system?.contentId === "avalon")).toBe(false);
    }, { ...MATCH, regions: base, pack: PACK });
  });
});

/* ========================================================================== */

describe("Avalon against an area, and after her defeat (AV.1.aoe, AV.dead; readings 15, 22)", () => {
  const ALLY = "arturiaAlly00001";

  it("Method 1 against an AoE covers every Unit within 1 of her, enemies too, and no farther", async () => {
    const specs = [
      { from: "arturia", id: ART, panel: { i: 5, j: 5 }, state: { factionId: "A", masterId: MAS, contract: "contracted" } },
      { from: "master-advanced", id: MAS, panel: { i: 5, j: 3 }, state: { factionId: "A" } },
      { from: "heracles", id: ALLY, panel: { i: 5, j: 6 }, state: { factionId: "A" } },
      { from: "medea", id: FOE, panel: { i: 4, j: 5 }, state: { factionId: "B" } },
    ];
    await withSubjects(specs, async ({ world: w }) => {
      await grantAvalon(ART);
      const { useSkill } = await import("../../module/engine/skill-use.mjs");
      const { reactionPlacement } = await import("../../module/rules/ability-use.mjs");
      const out = await useSkill({
        actorId: ART, abilityId: abilityOf(w, ART, "arturia-avalon").id, atWindow: true,
        placement: reactionPlacement({ attackerId: FOE, aimedAt: ALLY, attack: { kind: "np", isAoE: true } }),
      });
      expect(out.ok, out.reason).toBe(true);
      expect(held(w, ART)).toContain("antiPurge");
      expect(held(w, ALLY)).toContain("antiPurge");
      expect(held(w, FOE)).toContain("antiPurge");
      expect(held(w, MAS)).not.toContain("antiPurge");
    }, { ...THEIRS, pack: PACK });
  });

  it("with her defeated, her Master keeps it at the far values: 10% at his Turn's end", async () => {
    await withSubjects(party(), async ({ world: w }) => {
      await placeAvalon();
      await w.actor(ART).update({ "system.defeated": true });
      const { unitOf, currentBoard } = await import("../../module/engine/board.mjs");
      const board = currentBoard();
      const m = unitOf(w.actor(MAS), board);
      expect(m.bonds).toEqual([expect.objectContaining({ contentId: "avalon", own: true, defeated: true })]);
      const heals = fireEvent("turnEnd", [m], { board, tick: TICK, turnsPerRound: 3, options: [], rolls: {} })
        .filter((i) => i.t === "heal");
      expect(heals).toEqual([expect.objectContaining({ amount: Math.floor(m.maxHealth * 0.1) })]);
    }, { ...MATCH, pack: PACK });
  });
});

/* ========================================================================== */

describe("The Master's Avalon Cooldown follows the Item (readings 26 to 28)", () => {
  // Found live: passed on, the Master's Avalon arrived at 0 though the giver's
  // stood at 8 of 18. Ruled 2026-10-16: the 6◈ is the Item's (26), apart from
  // her Method 1's 8◈ (27), and it runs every Turn wherever the Item is (28).
  const OTHER = "otherMaster00001";
  const masterAvalon = (w, id) => w.actor(id).items.find((i) => i.system?.contentId === "avalon-master");

  it("passes on with the Item, keeps running in her hands, and comes back where it got to", async () => {
    const specs = [...party(), { from: "master-advanced", id: OTHER, panel: { i: 4, j: 4 }, state: { factionId: "A" } }];
    await withSubjects(specs, async ({ world: w }) => {
      const { applyWorldIntents } = await import("../../module/engine/applier.mjs");
      const I = await import("../../module/engine/intents.mjs");
      await placeAvalon();
      await masterAvalon(w, MAS).update({ "system.cooldown.remaining": 18 });
      // Passed on: the other Master's copy starts where the giver's was (26).
      await applyWorldIntents([I.moveItem(OTHER, MAS, "avalon", null)], "test");
      expect(masterAvalon(w, OTHER).system.cooldown.remaining).toBe(18);
      // Taken back to her, four Turns pass, placed in her Master again (28).
      await applyWorldIntents([I.moveItem(ART, OTHER, "avalon", null)], "test");
      await w.combat.update({ "system.globalTurn": TICK + 4 });
      await applyWorldIntents([I.moveItem(MAS, ART, "avalon", { bondUnitId: ART, bondMasterId: MAS })], "test");
      expect(masterAvalon(w, MAS).system.cooldown.remaining).toBe(14);
      // Her own Method 1 kept its own clock throughout (27).
      expect(abilityOf(w, ART, "arturia-avalon").system.cooldown.remaining).toBe(0);
    }, { ...MATCH, pack: PACK });
  });
});
