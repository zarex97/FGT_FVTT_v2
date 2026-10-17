/**
 * @file The Master content audit (#241): the Master Essences, the Magic Crest,
 * and the Contract and Sustainability rules a Master's life governs.
 * @see docs/superpowers/specs/2026-10-17-master-content-clauses.md, docs/46-roster-re-audit.md §46.37
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import yaml from "js-yaml";
import {
  ESSENCE_LIMITS, limitsFor, fitsLimits, essenceRefusals, grantsParameter,
} from "../../module/rules/master-essence.mjs";
import { essenceCommand, canSpend, availableCommands, reachesDeclaration } from "../../module/rules/command-spells.mjs";
import { CommandSpellRegistry } from "../../module/rules/cs-registry.mjs";
import { damageFactorOf, applyInterrupt, beginFanOut, deserialize } from "../../module/engine/combat-process.mjs";
import { multiServantTax, mayOrderAnotherServant, multiServantRule } from "../../module/rules/relationships.mjs";
import { npCost } from "../../module/rules/costs.mjs";
import { mayAttackCivilian } from "../../module/rules/environment.mjs";
import { canAttemptContract, conquestContract } from "../../module/rules/contract.mjs";
import { gateRoundFor } from "../../module/rules/np-gate.mjs";
import { endTurn } from "../../module/engine/scheduler.mjs";
import { compileDocument } from "../../tools/lib/content.mjs";
import { withSubjects, prepareSubjects, subject } from "../helpers/subject.mjs";

const src = (dir, file) => yaml.load(readFileSync(new URL(`../../packs/_source/${dir}/${file}`, import.meta.url), "utf8"));
const ESSENCES = readdirSync(new URL("../../packs/_source/master-essences/", import.meta.url))
  .map((f) => src("master-essences", f));

beforeAll(prepareSubjects, 120_000);

/* ========================================================================== */
/*  The draft (readings 1, 2, 17)                                              */
/* ========================================================================== */

describe("the Essence draft (#241 reading 1)", () => {
  it("is the published 1 A, 2 B, 2 C, 2 D, unless a custom war sets its own", () => {
    expect(limitsFor("greatHolyGrailWar")).toEqual({ A: 1, B: 2, C: 2, D: 2 });
    expect(limitsFor("holyGrailWar", { A: 7 })).toEqual(ESSENCE_LIMITS);
    expect(limitsFor("custom", { A: 0, B: 3, C: 2, D: 2 })).toEqual({ A: 0, B: 3, C: 2, D: 2 });
  });

  it("lets a lower Rank fill a higher slot, never the reverse", () => {
    // The sheet's own example: three Rank B instead of one A and two B.
    expect(fitsLimits(["B", "B", "B", "C", "C", "D", "D"], ESSENCE_LIMITS).ok).toBe(true);
    expect(fitsLimits(["A", "A"], ESSENCE_LIMITS)).toEqual({ ok: false, rank: "A" });
    expect(fitsLimits(["A", "B", "B", "B"], ESSENCE_LIMITS)).toEqual({ ok: false, rank: "B" });
    expect(fitsLimits(["D", "D", "D", "D", "D", "D", "D"], ESSENCE_LIMITS).ok).toBe(true);
    expect(fitsLimits(["D", "D", "D", "D", "D", "D", "D", "D"], ESSENCE_LIMITS).ok).toBe(false);
  });

  it("counts each Faction's own containers, and wants one per container", () => {
    const ranks = new Map([["me-formalcraft", "A"], ["me-kaleidoscope", "A"], ["me-gandr", "B"]]);
    const containers = [
      { id: "c1", factionId: "red", essenceId: "me-formalcraft" },
      { id: "c2", factionId: "blue", essenceId: "me-kaleidoscope" },
      { id: "c3", factionId: "blue", essenceId: null },
    ];
    const out = essenceRefusals(containers, [{ id: "red" }, { id: "blue" }], { ranks, limits: ESSENCE_LIMITS });
    // One Rank A each is within each Faction's own limit.
    expect(out.map((r) => r.code)).toEqual(["noEssence"]);
    const twoA = essenceRefusals([...containers.slice(0, 2), { id: "c4", factionId: "red", essenceId: "me-kaleidoscope" }],
      [{ id: "red", name: "Red" }, { id: "blue" }], { ranks, limits: ESSENCE_LIMITS });
    expect(twoA).toEqual([expect.objectContaining({ code: "essenceLimit", detail: { faction: "Red", rank: "A" } })]);
  });

  it("offers the Parameter + only for a High Rank Essence (reading 17)", () => {
    expect([..."ABCD"].map(grantsParameter)).toEqual([true, true, false, false]);
  });
});

/* ========================================================================== */
/*  The content                                                                */
/* ========================================================================== */

describe("the thirty-five Essences", () => {
  it("are all here, five Rank A and ten of each other Rank", () => {
    const by = (r) => ESSENCES.filter((e) => e.rank === r).length;
    expect([by("A"), by("B"), by("C"), by("D")]).toEqual([5, 10, 10, 10]);
  });

  it("Grimoire is +10%, as its line says (reading 9)", () => {
    const grimoire = ESSENCES.find((e) => e.id === "me-grimoire");
    expect(grimoire.rules).toEqual([{ key: "CritModifier", aspect: "chance", value: 10 }]);
  });

  it("gives every one-use Essence one use, and no passive Essence any", () => {
    const uses = ESSENCES.filter((e) => e.maxUses === 1).map((e) => e.id).sort();
    expect(uses).toEqual([
      "me-angels-song", "me-concentration", "me-crystal", "me-divine-banquet",
      "me-dragonkind", "me-heavens-feel", "me-oracle",
    ]);
  });
});

describe("an Essence reaches its Servant through the copy it holds (readings 5, 6, 7, 8)", () => {
  const copyOf = (id) => {
    const doc = ESSENCES.find((e) => e.id === id);
    const compiled = compileDocument(doc, "master-essences", new Map());
    return { _id: `copy-${id}`, name: compiled.name, type: "masterEssence",
      system: { ...compiled.system, grantedBy: "masterOne0000000", effect: [], timing: null, maxUses: null } };
  };

  it("raises the maximum only (Verdant Destruction +150)", async () => {
    const bare = await subject({ from: "heracles", id: "servantOne00000" });
    await withSubjects([{ from: "heracles", id: "servantOne00000" }], async ({ world }) => {
      await world.actor("servantOne00000").createEmbeddedDocuments("Item", [copyOf("me-verdant-destruction")]);
      expect(world.actor("servantOne00000").system.health.max).toBe(bare.maxHealth + 150);
    });
  });

  it("Steel Training is a defUp of 20, 15 against an NP; Antumbra never reaches an NP", async () => {
    await withSubjects([{ from: "heracles", id: "servantOne00000" }], async ({ world }) => {
      await world.actor("servantOne00000").createEmbeddedDocuments("Item", [copyOf("me-steel-training"), copyOf("me-antumbra")]);
      const { snapshotUnit } = await import("../../module/rules/snapshot.mjs");
      const unit = snapshotUnit(world.actor("servantOne00000"), {});
      expect(unit.modifiers).toEqual(expect.arrayContaining([
        // The key says the side: `defUp` is read off the defender, `dmgUp` off
        // the attacker (`rules/damage/pipeline.mjs`).
        expect.objectContaining({ key: "defUp", value: 20, npValue: 15, source: "Steel Training" }),
        expect.objectContaining({ key: "dmgUp", value: 20, npValue: 0, source: "Antumbra" }),
      ]));
    });
  });

  it("Kaleidoscope opens an Assassin's gate from the first Round (reading 10)", async () => {
    await withSubjects([{ from: "jack-the-ripper", id: "servantOne00000" }], async ({ world }) => {
      await world.actor("servantOne00000").createEmbeddedDocuments("Item", [copyOf("me-kaleidoscope")]);
      const { snapshotUnit } = await import("../../module/rules/snapshot.mjs");
      const unit = snapshotUnit(world.actor("servantOne00000"), {});
      expect(unit.npGateShifts).toEqual([expect.objectContaining({ rounds: 4 })]);
      expect(gateRoundFor(unit, null)).toBe(1);
    });
  });
});

describe("the copy follows the Contract and ends with the Master (readings 3, 5, 6)", () => {
  const essence = (id) => {
    const doc = ESSENCES.find((e) => e.id === id);
    const compiled = compileDocument(doc, "master-essences", new Map());
    return { name: compiled.name, type: "masterEssence", system: compiled.system };
  };
  const specs = [
    { from: "master-advanced", id: "masterOne0000000", state: { factionId: "A", rank: "B" } },
    { from: "heracles", id: "servantOne00000", state: { factionId: "A", masterId: "masterOne0000000", contract: "contracted" } },
  ];

  it("is made when the Master's Essence is, and is gone when the Master is defeated, the current cut to the new maximum", async () => {
    await withSubjects(specs, async ({ world }) => {
      const { syncEssences } = await import("../../module/engine/master-essence.mjs");
      const srv = world.actor("servantOne00000");
      const before = srv.system.health.max;
      await world.actor("masterOne0000000").createEmbeddedDocuments("Item", [essence("me-verdant-destruction")]);
      await syncEssences(srv, { fill: true });
      const copies = () => [...srv.items].filter((i) => i.type === "masterEssence");
      expect(copies()).toHaveLength(1);
      expect(copies()[0].system.grantedBy).toBe("masterOne0000000");
      // The summon's rule: full at the new maximum.
      expect(srv.system.health.max).toBe(before + 150);
      expect(srv._source.system.health.value).toBe(before + 150);

      await world.actor("masterOne0000000").update({ "system.defeated": true });
      await syncEssences(srv);
      expect(copies()).toHaveLength(0);
      expect(srv.system.health.max).toBe(before);
      expect(srv._source.system.health.value).toBe(before);
    });
  });

  it("never reaches the Master that holds it: its rules are its Servant's (live)", async () => {
    await withSubjects(specs, async ({ world }) => {
      const m = world.actor("masterOne0000000");
      const before = m.system.health.max;
      await m.createEmbeddedDocuments("Item", [essence("me-black-keys-r"), essence("me-pendant")]);
      const { snapshotUnit } = await import("../../module/rules/snapshot.mjs");
      expect(m.system.health.max).toBe(before);
      expect(snapshotUnit(m, {}).modifiers.filter((x) => x.source === "Pendant")).toEqual([]);
    });
  });

  it("follows a new Contract: the old Master's goes, the new one's comes", async () => {
    await withSubjects([...specs, { from: "master-advanced", id: "masterTwo0000000", state: { factionId: "A" } }], async ({ world }) => {
      const { syncEssences } = await import("../../module/engine/master-essence.mjs");
      const srv = world.actor("servantOne00000");
      await world.actor("masterOne0000000").createEmbeddedDocuments("Item", [essence("me-gandr")]);
      await world.actor("masterTwo0000000").createEmbeddedDocuments("Item", [essence("me-projection")]);
      await syncEssences(srv);
      await srv.update({ "system.masterId": "masterTwo0000000" });
      await syncEssences(srv);
      expect([...srv.items].filter((i) => i.type === "masterEssence").map((i) => [i.name, i.system.grantedBy]))
        .toEqual([["Projection", "masterTwo0000000"]]);
    });
  });
});

/* ========================================================================== */
/*  The one use (readings 11, 12)                                               */
/* ========================================================================== */

describe("a one-use Essence is offered and spent as a command (readings 11, 12)", () => {
  const item = (id, timesUsed = 0) => {
    const doc = ESSENCES.find((e) => e.id === id);
    return { id: `item-${id}`, name: doc.name, system: { ...doc, contentId: id, timesUsed } };
  };
  const npAttack = { abilityId: "np", kind: "np" };
  const servant = (over = {}) => ({ id: "s", abilities: [{ id: "np", isNP: true, cooldownRemaining: 9 }], effects: [], ...over });
  const ctx = (over = {}) => ({ master: { id: "m" }, servant: servant(), board: { round: 6 }, gate: { round: 6 }, ...over });

  it("Heaven's Feel: on an NP's card only, once, for no Command Spell", () => {
    const hf = essenceCommand(item("me-heavens-feel"));
    expect(canSpend(hf, ctx({ attack: npAttack }))).toEqual({ ok: true, cost: 0 });
    expect(canSpend(hf, ctx({ attack: { abilityId: null } })).reason).toBe("attackIsNP");
    expect(canSpend(essenceCommand(item("me-heavens-feel", 1)), ctx({ attack: npAttack })).reason).toBe("spent");
    expect(availableCommands([hf], ctx({ attack: npAttack, window: "beforeAttack" }))).toHaveLength(1);
    expect(availableCommands([hf], ctx({ attack: npAttack, window: "ownTurn" }))).toHaveLength(0);
  });

  it("Divine Banquet: while an NP cools, never before the gate opens", () => {
    const db = essenceCommand(item("me-divine-banquet"));
    expect(canSpend(db, ctx()).ok).toBe(true);
    expect(canSpend(db, ctx({ servant: servant({ abilities: [{ id: "np", isNP: true, cooldownRemaining: 0 }] }) })).reason)
      .toBe("npCooling");
    expect(canSpend(db, ctx({ gate: { round: 5 } })).reason).toBe("npGateOpen");
  });

  it("a Servant's copy offers nothing: the use is the Master's", () => {
    expect(essenceCommand({ id: "c", name: "x", system: { ...item("me-heavens-feel").system, grantedBy: "m" } })).toBeNull();
  });

  it("adds to Noble Phantasm Max rather than multiplying it (reading 11)", () => {
    let s = { state: "damage", damageFactors: [], damagePercents: [] };
    s = applyInterrupt(s, { kind: "modifyDamage", percent: 100 });
    s = applyInterrupt(s, { kind: "modifyDamage", percent: 200 });
    expect(damageFactorOf(s)).toBe(4);
    s = applyInterrupt(s, { kind: "modifyDamage", factor: 0.5 });
    expect(damageFactorOf(s)).toBe(2);
  });

  it("Noble Phantasm Max now asks for an NP, and both Increases are percents", () => {
    expect(src("command-spells", "cs-noble-phantasm-max.yml").requirements).toContainEqual({ kind: "attackIsNP" });
    expect(src("command-spells", "cs-noble-phantasm-max.yml").effect[0]).toMatchObject({ percent: 100 });
    expect(src("command-spells", "cs-damage-up.yml").effect[0]).toMatchObject({ percent: 100 });
  });
});

describe("a new Contract restarts the Free clock (ruled 2026-10-17)", () => {
  const SC = "scathachFreeTwic", M1 = "semiramisMaster1", M2 = "newMasterOfScath";
  const run = (state, play) => withSubjects([
    { from: "scathach", id: SC, state: { factionId: "A", contract: "free", masterId: null, ...state }, panel: { i: 5, j: 5 } },
    { from: "master-advanced", id: M1, state: { factionId: "A" }, panel: { i: 5, j: 7 } },
    { from: "master-advanced", id: M2, state: { factionId: "A" }, panel: { i: 6, j: 7 } },
  ], async ({ world: w }) => {
    const { worldIO } = await import("../../module/engine/io.mjs");
    const { currentBoard } = await import("../../module/engine/board.mjs");
    return play(w, worldIO(), () => currentBoard().units.find((u) => u.id === SC).sustainability);
  }, { tokens: true });

  it("is full again, read off the sheet, when a Free Servant is contracted", async () => {
    // Live: Semiramis's two Scáthachs went Free at her death with 8 and 6 Turns;
    // one had kept what was left of her first Free period.
    const out = await run({ sustainabilityRemaining: 8 }, async (w, io, clock) => {
      const free = clock();
      await io.setContract(SC, "contracted", M1);
      return { free, contracted: clock(), stored: w.actor(SC).system.sustainabilityRemaining };
    });
    expect(out).toEqual({ free: 8, contracted: 6, stored: null });
  }, 60_000);

  it("is not touched by a write that changes no Contract", async () => {
    const out = await run({ contract: "contracted", masterId: M1, sustainabilityRemaining: 4 }, async (w, io, clock) => {
      await io.setContract(SC, "contracted", M1);
      return clock();
    });
    expect(out).toBe(4);
  }, 60_000);

  it("keeps Hanging Gardens' +2◈ while they stand", async () => {
    const out = await run({ sustainabilityRemaining: 3, zonExempt: true }, async (w, io, clock) => {
      await io.setContract(SC, "contracted", M2);
      return clock();
    });
    expect(out).toBe(12);
  }, 60_000);
});

/* ========================================================================== */
/*  The declaration window (ruled 2026-10-17, #241)                            */
/* ========================================================================== */

describe("the declaration window: one boost for every target (ruled 2026-10-17)", () => {
  const BOOSTS = [
    ["command-spells", "cs-noble-phantasm-max.yml"], ["command-spells", "cs-damage-up.yml"],
    ["master-essences", "me-heavens-feel.yml"], ["master-essences", "me-angels-song.yml"],
    ["master-essences", "me-dragonkind.yml"], ["master-essences", "me-oracle.yml"],
  ];

  it("times the six boosts to the window before the attack, and to no card's rung", () => {
    for (const [dir, file] of BOOSTS) {
      const doc = src(dir, file);
      expect(doc.timing, file).toEqual({ window: "beforeAttack" });
      expect(reachesDeclaration(doc), file).toBe(true);
    }
    // A cut a defender's Master buys stays on its own Servant's card.
    for (const file of ["cs-halve-noble-phantasm.yml", "cs-damage-block.yml", "cs-escape.yml", "cs-half-heal.yml"]) {
      expect(reachesDeclaration(src("command-spells", file)), file).toBe(false);
    }
  });

  it("starts every Process of the declaration with what it bought", async () => {
    const { carryDeclarationBoosts } = await import("../../module/engine/declaration-window.mjs");
    const window = { damagePercents: [100, 200], damageFactors: [], interrupts: [{ kind: "modifyDamage", command: "cs-noble-phantasm-max" }] };
    const fan = beginFanOut({ attackerId: "a", targetIds: ["d1", "d2", "d3"], attack: { abilityId: "np", kind: "np" } })
      .map((s) => carryDeclarationBoosts(s, window));
    expect(fan.map(damageFactorOf)).toEqual([4, 4, 4]);
    expect(fan.every((s) => s.interrupts.some((r) => r.declaration))).toBe(true);
    expect(carryDeclarationBoosts(fan[0], null)).toBe(fan[0]);
  });

  it("is a card before the ladder: Damage Up bought there reaches the Process, and no rung offers it", async () => {
    const H = "heraclesBoosted1", D = "drakeBoostTarget", M = "heraclesMaster01";
    CommandSpellRegistry.load(readdirSync(new URL("../../packs/_source/command-spells/", import.meta.url))
      .map((f) => src("command-spells", f)).map((y) => ({ name: y.name, system: { ...y, contentId: y.id } })));
    await withSubjects([
      { from: "heracles", id: H, state: { factionId: "A", masterId: M, contract: "contracted" }, panel: { i: 5, j: 4 } },
      { from: "master-advanced", id: M, state: { factionId: "A" }, panel: { i: 5, j: 2 } },
      { from: "drake", id: D, state: { factionId: "B" }, panel: { i: 5, j: 5 } },
    ], async ({ world: w }) => {
      await w.actor(M).update({ "system.commandSpells": 3 });
      const { resolveAttack } = await import("../../module/engine/attack.mjs");
      const { spendCommandSpell, processOffers } = await import("../../module/engine/command-spells.mjs");
      const declaring = resolveAttack({ attackerId: H, abilityId: null, placement: { unitId: D, chosenIds: [D] } });
      let card = null;
      for (let k = 0; k < 40 && !card; k += 1) {
        await new Promise((r) => setTimeout(r, 100));
        card = [...w.messages.values()].find((m) => m.getFlag("fgt", "declaration"));
      }
      expect(card, "no declaration window was opened").toBeTruthy();
      expect(await spendCommandSpell({ masterId: M, commandId: "cs-damage-up", messageId: card.id }))
        .toMatchObject({ ok: true, cost: 1 });
      await card.setFlag("fgt", "declarationOpen", false);
      const declared = await declaring;
      const id = declared.processes?.[0]?.messageId ?? declared.messageId;
      const state = deserialize(w.messages.get(id).getFlag("fgt", "process"));
      expect(state.damagePercents).toEqual([100]);
      expect(w.actor(M).system.commandSpells).toBe(2);
      expect(processOffers(state).map((o) => o.command.id)).not.toContain("cs-damage-up");
    }, {
      tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18 }, actingFactionId: "A" },
      // The test world sets the Command Spell timeout to 0, which closes every
      // window; this one has to open.
      worldSettings: { commandSpellTimeout: 5 },
    });
  }, 60_000);
});

/* ========================================================================== */
/*  The Magic Crest (readings 13, 14)                                           */
/* ========================================================================== */

describe("every Master carries the Magic Crest, a Spell (readings 13, 14)", () => {
  it("is on the Advanced Master as on the Normal one", () => {
    expect(src("masters", "master-advanced.yml").abilities).toContainEqual({ ref: "normal-magic-crest" });
    expect(src("masters", "master-normal.yml").abilities).toContainEqual({ ref: "normal-magic-crest" });
  });

  it("is a Damage Spell: a Spell, categorized as NP, from Round 3", () => {
    const crest = src("abilities", "normal-magic-crest.yml");
    expect(crest).toMatchObject({ isSpell: true, categorizedAsNP: true, npGateRound: 3, cooldown: { max: "2◈" } });
    expect(crest.damage).toEqual({ component: "mag", multiplier: 2 });
  });
});

/* ========================================================================== */
/*  Contracts and Sustainability (readings 4, 15, 16; Appendix B)               */
/* ========================================================================== */

describe("the multi-Servant tax by ruleset (reading 15)", () => {
  const acted = (n) => Array.from({ length: n }, (_, k) => ({ id: `s${k}`, turnState: { acted: true } }));
  const master = (health = 200) => ({ id: "m", health: { value: health, max: 250 } });

  it("Advanced: 25, flat, and the ban at 25", () => {
    expect(multiServantTax(master(), acted(3), { ruleset: "advanced" })[0].delta).toBe(-25);
    expect(mayOrderAnotherServant(master(25), acted(1), { ruleset: "advanced" }).ok).toBe(false);
  });

  it("Normal: 20 per additional Servant, and the ban at 20", () => {
    expect(multiServantTax(master(), acted(2), { ruleset: "normal" })[0].delta).toBe(-20);
    expect(multiServantTax(master(), acted(4), { ruleset: "normal" })[0].delta).toBe(-60);
    expect(mayOrderAnotherServant(master(21), acted(1), { ruleset: "normal" }).ok).toBe(true);
    expect(mayOrderAnotherServant(master(20), acted(1), { ruleset: "normal" }).ok).toBe(false);
    expect(multiServantRule("normal")).toEqual({ cost: 20, floor: 20, perAdditional: true });
  });

  // Live: a Grand Order war lifted the ban, and the Turn's end still charged
  // 25, because the Turn-end context never carried the setting. The scheduler
  // now reads the board's, the one the ban reads.
  it("is never charged at a Grand Order Turn's end, through the scheduler (CT.go, live)", async () => {
    const specs = [
      { from: "master-advanced", id: "taxMaster0000001", panel: { i: 9, j: 1 }, state: { factionId: "A" } },
      { from: "arjuna", id: "taxServantA00001", panel: { i: 5, j: 5 },
        state: { factionId: "A", masterId: "taxMaster0000001", contract: "contracted", turnState: { acted: true } } },
      { from: "heracles", id: "taxServantB00001", panel: { i: 6, j: 5 },
        state: { factionId: "A", masterId: "taxMaster0000001", contract: "contracted", turnState: { acted: true } } },
    ];
    const taxed = (grandOrder) => withSubjects(specs, ({ board }) =>
      endTurn(board, { tick: 10, round: 4, turnsPerRound: 3, activeFactionId: "A" })
        .filter((i) => i.t === "log" && i.entry?.kind === "multiServantTax").length,
    { settings: { grandOrder } });
    expect(await taxed(false)).toBe(1);
    expect(await taxed(true)).toBe(0);
  });

  // Live: the tax left a Master at 0 Health, alive (ruled 2026-10-17, #241).
  it("defeats a Master it empties, as any loss that empties a Health bar does", async () => {
    const specs = [
      { from: "master-advanced", id: "taxMaster0000002", panel: { i: 9, j: 1 }, state: { factionId: "A" } },
      { from: "arjuna", id: "taxServantA00002", panel: { i: 5, j: 5 },
        state: { factionId: "A", masterId: "taxMaster0000002", contract: "contracted", turnState: { acted: true } } },
      { from: "heracles", id: "taxServantB00002", panel: { i: 6, j: 5 },
        state: { factionId: "A", masterId: "taxMaster0000002", contract: "contracted", turnState: { acted: true } } },
    ];
    const tax = await withSubjects(specs, ({ board }) =>
      endTurn(board, { tick: 10, round: 4, turnsPerRound: 3, activeFactionId: "A" })
        .find((i) => i.t === "statDelta" && i.source === "Multi-Servant tax"),
    { settings: { grandOrder: false } });
    expect(tax).toMatchObject({ unitId: "taxMaster0000002", delta: -25, defeatsAtZero: true });
  });

  it("says the death on the Turn-end card, not only the Health it took (live)", async () => {
    const { turnEndCard } = await import("../../module/engine/turn-report.mjs");
    const t = (key, data) => `${key}${data ? JSON.stringify(data) : ""}`;
    const loss = [{ t: "statDelta", unitId: "m", stat: "health.value", delta: -25, source: "Multi-Servant tax", defeatsAtZero: true }];
    const card = turnEndCard(loss, () => "Master of Saber", t, undefined, null, null, undefined, [], ["m"]);
    expect(card).toContain("FGT.TurnReport.Loses");
    expect(card).toContain('FGT.TurnReport.Defeated{"who":"Master of Saber"}');
    expect(turnEndCard(loss, () => "Master of Saber", t)).not.toContain("FGT.TurnReport.Defeated");
  });
});

describe("a Free Servant's Noble Phantasm (Normal; Appendix B)", () => {
  const free = (over = {}) => ({ id: "s", contract: "free", sustainability: 30, ...over });
  const np = (over = {}) => ({ isNP: true, rank: "A", ...over });

  it("Normal: it disappears after use, or an Archer's or Caster's NP (a) costs 2◈", () => {
    expect(npCost({ ability: np({ freeServantCost: { kind: "disappear" } }), unit: free(), master: null }))
      .toEqual({ kind: "disappear", amount: 0, unitId: "s" });
    expect(npCost({ ability: np({ freeServantCost: { kind: "sustainability", rounds: 2 } }), unit: free(), master: null, turnsPerRound: 3 }))
      .toEqual({ kind: "sustainability", amount: 6, unitId: "s" });
  });

  it("is the Rank table, in ◈, for an Advanced one; the stated price only binds a Free Servant", () => {
    expect(npCost({ ability: np(), unit: free(), master: null, turnsPerRound: 3 }).amount).toBe(15);
    expect(npCost({ ability: np({ freeServantCost: { kind: "disappear" } }), unit: { id: "s", contract: "contracted" },
      master: { id: "m", rank: "A", health: { value: 200 } } }).kind).toBe("masterHealth");
  });

  it("every Normal NP states it: Archer's and Caster's (a) the 2◈, the rest disappear", () => {
    const dir = new URL("../../packs/_source/abilities/", import.meta.url);
    const nps = readdirSync(dir).filter((f) => f.startsWith("normal-") && f.includes("-np"));
    expect(nps).toHaveLength(11);
    for (const f of nps) {
      const want = /(archer|caster)-np-a/.test(f) ? { kind: "sustainability", rounds: 2 } : { kind: "disappear" };
      expect(src("abilities", f).freeServantCost, f).toEqual(want);
    }
  });
});

describe("Kill Humans' Contract half (reading 16)", () => {
  const mark = (sourceUnitId) => ({ effects: ["killHumans"], effectInstances: [{ defId: "killHumans", sourceUnitId }] });

  it("is spent in the Master's own Turn, once, and lays its mark", () => {
    const cs = src("command-spells", "cs-kill-humans.yml");
    expect(cs.timing).toEqual({ window: "ownTurn" });
    expect(cs.effect).toEqual([{ kind: "applyEffect", effect: "killHumans", target: "contractedServant" }]);
    expect(cs.requirements).toEqual([{ kind: "notMarked", effect: "killHumans" }]);
  });

  it("lets a Good Servant kill Civilians", () => {
    const good = { alignment: { morality: "good" } };
    expect(mayAttackCivilian(good).ok).toBe(false);
    expect(mayAttackCivilian({ ...good, ...mark("masterOne0000000") }).ok).toBe(true);
  });

  it("refuses a Contract with the Master who ordered it, and only that one", () => {
    const board = { units: [] };
    const servant = { id: "s", kind: "servant", contract: "free", panel: { i: 0, j: 1 }, factionId: "A", ...mark("masterOne0000000") };
    const old = { id: "masterOne0000000", kind: "master", panel: { i: 0, j: 0 }, factionId: "A" };
    const other = { id: "masterTwo0000000", kind: "master", panel: { i: 0, j: 0 }, factionId: "A" };
    expect(canAttemptContract(old, servant, board)).toEqual({ ok: false, reason: "refusesContract" });
    expect(canAttemptContract(other, servant, board).ok).toBe(true);
  });

  it("is never conquered by that Master either", () => {
    const dead = { id: "masterTwo0000000", kind: "master", commandSpells: 1 };
    const killer = { id: "masterOne0000000", kind: "master" };
    const servant = { id: "s", kind: "servant", masterId: "masterTwo0000000", ...mark("masterOne0000000") };
    const out = conquestContract({ killer, deadMaster: dead, board: { units: [servant, dead, killer] } });
    expect(out.descriptors).toEqual([]);
  });
});


describe("the Magic Crest's Underpower coin is on the card, Heads or Tails (live)", () => {
  it("says both outcomes, as Overpower does (#174)", async () => {
    const { underpowerText } = await import("../../module/rules/explain.mjs");
    expect(underpowerText({ roll: 73, chance: 50, halved: false })).toBe("Underpower: Heads (73 > 50) — damage as rolled");
    expect(underpowerText({ roll: 12, chance: 50, halved: true })).toBe("Underpower: Tails (12 ≤ 50) — damage halved");
    expect(underpowerText(null)).toBeNull();
  });
});

describe("the Magic Crest is a Spell AND categorized as NP (reading 14, live)", () => {
  it("is refused by Silence and by NP Seal", async () => {
    const { canUseAbility } = await import("../../module/rules/costs.mjs");
    const crest = { id: "c", isSpell: true, categorizedAsNP: true, npGateRound: 3, requiresRound: 3, cooldown: { remaining: 0 } };
    const master = (effects) => ({ id: "m", kind: "master", effects, health: { value: 200 } });
    const ask = (effects) => canUseAbility({ ability: crest, unit: master(effects), round: 5, clockRunning: true });
    expect(ask([]).ok).toBe(true);
    expect(ask(["silence"])).toMatchObject({ ok: false, reason: "prevented", detail: { by: "silence" } });
    expect(ask(["npSeal"])).toMatchObject({ ok: false, reason: "prevented", detail: { by: "npSeal" } });
  });
});

describe("a Free Normal Servant disappears after its Noble Phantasm (NC.np, live)", () => {
  const ASN = "normalAssassin01", FOE = "normalSaberFoe01";
  const MATCH = { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18 }, actingFactionId: "A" } };

  it("leaves the board when the Combat Phase that used it ends", async () => {
    const { playAttack } = await import("../helpers/process.mjs");
    await withSubjects([
      { from: "normal-assassin", id: ASN, state: { factionId: "A" }, panel: { i: 5, j: 5 } },
      { from: "normal-saber", id: FOE, state: { factionId: "B" }, panel: { i: 5, j: 7 } },
    ], async ({ world: w }) => {
      const np = w.actor(ASN).items.find((i) => i.system?.contentId === "normal-assassin-np");
      expect(np.system.freeServantCost).toEqual({ kind: "disappear" });
      await playAttack(w, {
        attacker: ASN, ability: np.id, placement: { panel: { i: 5, j: 7 }, unitId: FOE, chosenIds: [FOE] },
        react: { [FOE]: ["nothing", "declined"] },
      });
      expect(w.actor(ASN).system.defeated).toBe(true);
      expect(w.actor(ASN).system.defeatCause).toBe("sustainabilityExhausted");
      // ...and the table is told why it went (the test world prints the key).
      expect([...w.messages.values()].some((m) => /FGT\.Contract\.FreeNPDisappears/.test(m.content))).toBe(true);
    }, MATCH);
  }, 60_000);
});

describe("an Unbound Servant can be contracted (CT.ub.*, live)", () => {
  it("is derived on the board from its Master's pools, and the Contract rule reads it", async () => {
    const { snapshotBoard } = await import("../../module/rules/snapshot.mjs");
    const { contractPlan } = await import("../../module/rules/contract.mjs");
    const actor = (id, type, system) => ({ actor: { id, uuid: `Actor.${id}`, name: id, type, system, items: [], effects: [] } });
    const board = (cs) => snapshotBoard({
      scene: null,
      actors: [
        actor("s1", "servant", { factionId: "red", masterId: "m1", contract: "contracted", health: { value: 900, max: 900 }, range: { panels: 1, targets: 1 } }),
        actor("m1", "master", { factionId: "red", commandSpells: cs, health: { value: 200, max: 250 }, range: { panels: 1, targets: 1 } }),
      ],
      settings: { turnsPerRound: 3 },
    });
    expect(board(1).units.find((u) => u.id === "s1").unbound).toBe(false);
    const s1 = board(0).units.find((u) => u.id === "s1");
    // Still contracted: its Master stands and pays; only the Contract rule reads Unbound.
    expect(s1).toMatchObject({ unbound: true, contract: "contracted" });
    const here = { ...s1, panel: { i: 0, j: 1 } };
    const enemy = { id: "e1", kind: "master", factionId: "blue", panel: { i: 0, j: 0 } };
    const ally = { id: "a1", kind: "master", factionId: "red", panel: { i: 0, j: 0 } };
    expect(contractPlan(enemy, here, { units: [] })).toMatchObject({ ok: true, succeedsOn: [6] });
    expect(contractPlan(ally, here, { units: [] })).toMatchObject({ ok: false, reason: "forbidden" });
  });
});
