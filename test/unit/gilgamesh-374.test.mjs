/**
 * Gilgamesh (Archer), audit #374: his sheet through the real projection, and the
 * pieces he brought: a Rank chosen at the declaration, a die table whose rows change
 * at a count, five debuffs, Seal (Ea), and Enuma Elish's lists.
 * @see docs/superpowers/specs/2026-11-02-gilgamesh-clauses.md
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it, vi } from "vitest";
import yaml from "js-yaml";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { playAttack } from "../helpers/process.mjs";
import { chosenTierView, tierView } from "../../module/rules/tiers.mjs";
import { entriesFor, rollsTable } from "../../module/rules/roll-table.mjs";
import { inflictedEffectIds } from "../../module/rules/damage/riders.mjs";
import { causedBy, fieldSealed, fieldsEndedBy, struckAbilities } from "../../module/rules/listed-abilities.mjs";
import { npCostAt } from "../../module/rules/costs.mjs";
import { periodicOf } from "../../module/rules/periodic.mjs";

beforeAll(prepareSubjects, 120_000);
vi.setConfig({ testTimeout: 60_000 });

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const source = (rel) => yaml.load(readFileSync(path.join(ROOT, "packs/_source", rel), "utf8"));
const GATE = source("abilities/gilgamesh-gate-of-babylon.yml");
const ENUMA = source("abilities/gilgamesh-enuma-elish.yml");
const GIL = "gilgamesh0000001";
const asItem = (system) => ({ id: "x", name: "x", system });
const gate = () => asItem({ ...GATE, cooldown: { max: GATE.cooldown } });

describe("the sheet, projected (ST.*)", () => {
  it("Archer, Chaotic Good; B C C B A; Health 1000; MOV 4; Range 4; BA 125/175; no Sustainability", async () => {
    await withSubjects([{ from: "gilgamesh", id: GIL, panel: { i: 6, j: 6 } }], ({ unit, world: w }) => {
      const g = unit(GIL);
      const s = w.actor(GIL).system;
      expect(g.servantClasses).toEqual(["archer"]);
      expect(s.alignment).toMatchObject({ order: "chaotic", morality: "good" });
      expect(s.health.max).toBe(1000);
      expect(g.mov).toBe(4);
      expect(g.range).toBe(4);
      expect(g.baseAttack).toEqual(expect.objectContaining({ str: 125, mag: 175 }));
      expect(s.sustainability).toBeNull();
      expect(g.attributes).toEqual(expect.arrayContaining(["male", "servant", "sky", "king", "humanoid", "divine"]));
    });
  });

  it("Golden Armor raises Magic Resistance from E to C: 30% and 15%", async () => {
    await withSubjects([{ from: "gilgamesh", id: GIL, panel: { i: 6, j: 6 } }], ({ unit }) => {
      const g = unit(GIL);
      expect(g.magicResistance).toMatchObject({ percent: 30 });
      expect(g.immunities).toContain("petrify");
    });
  });
});

describe("the chosen Rank (GB.rank, GB.plus, GB.cost, readings 2-4)", () => {
  it("has fifteen tiers, E to A++, whose + adds 100 damage and ⅓◈ and no die", () => {
    expect(GATE.tiers.map((t) => t.rank)).toEqual(["E", "E+", "E++", "D", "D+", "D++", "C", "C+", "C++", "B", "B+", "B++", "A", "A+", "A++"]);
    const at = (rank) => GATE.tiers.find((t) => t.rank === rank);
    expect(at("E")).toMatchObject({ cooldown: "3◈", damage: { multiplier: 2, flatBonus: 0 }, refs: { dice: 1 } });
    // Ko-Gil's B++ is this table's row: 3.5x plus 200, Cooldown 6◈+⅔◈.
    expect(at("B++")).toMatchObject({ cooldown: "6◈+⅔◈", damage: { multiplier: 3.5, flatBonus: 200 }, refs: { dice: 4 } });
    expect(at("A++")).toMatchObject({ cooldown: "7◈+⅔◈", damage: { multiplier: 4, flatBonus: 200 }, refs: { dice: 5 } });
  });

  it("reads the ability as the tier chosen, and refuses a choice no tier holds", () => {
    const view = chosenTierView(gate(), 14);
    expect(view.system.rank).toBe("A++");
    expect(view.system.damage).toMatchObject({ component: "str", multiplier: 4, flatBonus: 200 });
    expect(view.system.cooldown.max).toBe("7◈+⅔◈");
    expect(view.system.phases.find((p) => p.kind === "rollTable").count).toBe(5);
    for (const bad of [undefined, null, -1, 15, 1.5, "3"]) expect(chosenTierView(gate(), bad)).toBeNull();
    // An ability with no choice to make is itself.
    const plain = asItem({ tiers: [] });
    expect(chosenTierView(plain, undefined)).toBe(plain);
  });

  it("prices his Master at the Rank in force, + included", () => {
    const unit = { id: "g", contract: "contracted" };
    const master = { id: "m" };
    const paid = (rank) => npCostAt({ rank, unit, master }).amount;
    expect([10, 20]).toContain(paid("E"));
    expect([56, 66]).toContain(paid("A++"));
    expect(paid("A++") - paid("A")).toBe(6);
  });
});

describe("the die table (GB.dice, GB.enemy, GB.same, readings 5-9)", () => {
  const table = GATE.phases.find((p) => p.kind === "rollTable").entries;
  const ids = (results) => entriesFor(table, results).flatMap(({ entry }) => entry.effects.map((e) => e.id));

  it("only enemies roll", () => {
    const phase = GATE.phases.find((p) => p.kind === "rollTable");
    expect(rollsTable(phase, "enemy")).toBe(true);
    expect(rollsTable(phase, "ally")).toBe(false);
    expect(rollsTable(phase, "neutral")).toBe(false);
    expect(rollsTable({}, "ally")).toBe(true);
  });

  it("has a row for every face, each landing what the sheet prints", () => {
    expect(Object.keys(table).map(Number)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(ids([1, 2, 3, 4, 5])).toEqual(["curse", "burn", "shock", "poison", "stun"]);
    expect(ids([6, 7, 8, 9, 10])).toEqual(["freeze", "slow", "immobilize", "disable", "npSeal"]);
    expect(ids([11, 12, 13, 14, 15])).toEqual(["bleed", "sleep", "seal", "blind", "silence"]);
    expect(ids([16, 17, 18, 19, 20])).toEqual(["addle", "gashed", "deafenY", "dragonblight", "crystallize"]);
  });

  it("states 1◈ on Freeze and Sleep, a typo on the sheet, and no clock on Curse and Poison (reading 7)", () => {
    expect(table[6].effects[0].duration).toBe("1◈");
    expect(table[12].effects[0].duration).toBe("1◈");
    expect(table[1].effects[0].duration).toBeUndefined();
    expect(table[4].effects[0].duration).toBeUndefined();
    expect(table[2].effects[0].duration).toBe("2◈");
    expect(table[3].effects[0].duration).toBe("2◈");
  });

  it("two of a number land twice, which a non-stacking debuff reads as extended", () => {
    expect(ids([5, 5])).toEqual(["stun", "stun"]);
    expect(table[5].effects[0].stacking).toBe("noneExtend");
    expect(table[1].effects[0].stacking).toBeUndefined();
  });

  it("three or more 6s land Crystalfreeze instead, and two do not (reading 8)", () => {
    expect(ids([6, 6, 1])).toEqual(["freeze", "freeze", "curse"]);
    expect(ids([6, 6, 6])).toEqual(["crystalfreeze", "crystalfreeze", "crystalfreeze"]);
    expect(ids([6, 2, 6, 6, 6])).toEqual(["crystalfreeze", "burn", "crystalfreeze", "crystalfreeze", "crystalfreeze"]);
  });

  it("three or more 12s land Nightmare instead", () => {
    expect(ids([12, 12])).toEqual(["sleep", "sleep"]);
    expect(ids([12, 12, 12])).toEqual(["nightmare", "nightmare", "nightmare"]);
  });

  it("18s land once, magnitude their number, and stay at 1◈ (reading 9)", () => {
    const landed = entriesFor(table, [18, 3, 18, 18]);
    const deafen = landed.flatMap(({ entry }) => entry.effects).filter((e) => e.id === "deafenY");
    expect(deafen).toHaveLength(1);
    expect(deafen[0]).toMatchObject({ magnitude: 3, duration: "1◈" });
    // Nothing is written back to the table: each target rolls its own.
    expect(table[18].effects[0].magnitude).toBeUndefined();
  });

  it("names every row, upgrades included, as what the Attack inflicts", () => {
    const inflicted = inflictedEffectIds({ system: tierView(gate(), 6).system });
    expect(inflicted).toEqual(expect.arrayContaining(["freeze", "crystalfreeze", "sleep", "nightmare", "deafenY"]));
  });
});

describe("the new debuffs (reading 11)", () => {
  it("Nightmare takes 10% of what is left, rounded down, on its own Turn", () => {
    const spec = periodicOf(source("effects/nightmare.yml"));
    expect(spec.amount({}, { health: 1234 })).toBe(123);
    expect(spec.ownTurnOnly).toBe(true);
    expect(spec.when).toBe("turnEnd");
  });

  it("Sleep and Nightmare are woken by an attack's damage, and +100% Total", () => {
    for (const file of ["effects/sleep.yml", "effects/nightmare.yml"]) {
      const def = source(file);
      expect(def.wokenByAttackDamage).toBe(true);
      expect(def.preventsAction).toBe(true);
      expect(def.rules).toEqual(expect.arrayContaining([expect.objectContaining({ modifierKey: "totalDefDwn", value: 100 })]));
    }
  });

  it("Crystallize is every clause of its row", () => {
    const def = source("effects/crystallize.yml");
    expect(def.periodic).toMatchObject({ when: "turnEnd", amount: 50, actedOnly: true });
    expect(def.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "MovDelta", value: -3 }),
      expect.objectContaining({ key: "DamageModifier", modifierKey: "defUp", value: 10, npValue: 10 }),
      expect.objectContaining({ check: "evade", roll: expect.objectContaining({ formula: "1d6" }) }),
    ]));
  });

  it("Deafen(Y) is a different effect from Nemo's", () => {
    const y = source("effects/deafen-y.yml");
    expect(y.id).toBe("deafenY");
    expect(y.id).not.toBe(source("effects/deafen.yml").id);
    expect(y.rules).toEqual(expect.arrayContaining([expect.objectContaining({ direction: "imposed", value: "-@magnitude" })]));
  });

  it("Seal (Ea) is Unremovable and no Immune or Resist stops it", () => {
    expect(source("effects/seal-ea.yml")).toMatchObject({ unremovable: true, bypassesImmunity: true, bypassesResistance: true });
  });
});

describe("Enuma Elish's exempt list (EE.except, readings 14-16, 29)", () => {
  const multiplier = ENUMA.damage.conditionalMultipliers[0];
  const sheetsOnDisk = () => {
    const root = path.join(ROOT, "char_orig_sheets/by-class");
    return new Set(readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory())
      .flatMap((cls) => readdirSync(path.join(root, cls.name)).map((f) => f.replace(/\.md$/, ""))));
  };

  it("doubles against a Servant, and carries one row for each of the forty printed names, Karl struck", () => {
    expect(multiplier).toMatchObject({ factor: 2, predicate: ["target:type:servant"] });
    expect(multiplier.except).toHaveLength(40);
    expect(multiplier.except.map((r) => r.printed).join()).not.toMatch(/Karl/);
  });

  it("maps each name to a sheet that exists, but for the three with none", () => {
    const disk = sheetsOnDisk();
    const missing = multiplier.except.flatMap((r) => r.sheets.filter((s) => !disk.has(s)).map((s) => `${r.printed} -> ${s}`));
    expect(missing).toEqual([]);
    const noSheet = multiplier.except.filter((r) => r.noSheet).map((r) => r.printed);
    expect(noSheet).toEqual(["Demeter (Erinyes)", "BB Dubai", "Azumi no Isora"]);
    for (const row of multiplier.except.filter((r) => !r.noSheet)) expect(row.sheets.length).toBeGreaterThan(0);
  });

  it("holds every built Servant on a listed sheet to its row's id", () => {
    const built = readdirSync(path.join(ROOT, "packs/_source/servants")).filter((f) => f.endsWith(".yml"))
      .map((f) => source(`servants/${f}`)).filter((s) => s?.id && s?.name);
    const wrong = [];
    for (const row of multiplier.except) {
      for (const s of built) {
        if (row.sheets.includes(s.name) && !row.ids.includes(s.id)) wrong.push(`${s.name} is ${s.id}, not ${row.ids}`);
      }
    }
    expect(wrong).toEqual([]);
    expect(built.find((s) => s.id === "drake")?.name).toBe("Francis Drake");
    expect(built.find((s) => s.id === "u-olga-marie")?.name).toBe("U-Olga Marie");
  });

  it("spares Super Aoko only once she has transformed", () => {
    expect(multiplier.except.find((r) => r.printed === "Super Aoko").when).toEqual(["target:effect:superAoko"]);
  });
});

describe("Enuma Elish's lists (EE.rm.*, EE.np.*, EE.nf.*, readings 17-24, 30)", () => {
  const phase = ENUMA.phases.find((p) => p.kind === "strikeListedAbilities");
  const item = (contentId, extra = {}) => ({ id: `i-${contentId}`, name: contentId, system: { contentId, ...extra } });

  it("seals the listed abilities it finds, and no other", () => {
    const struck = struckAbilities(phase, [
      item("kingprotea-airavata-king-size"), item("gogh-de-sterrennacht"), item("kama-mara-papiyas"), item("nursery-nameless-forest"),
    ]);
    expect(struck.map((s) => s.item.system.contentId)).toEqual(["kingprotea-airavata-king-size", "gogh-de-sterrennacht", "nursery-nameless-forest"]);
    expect(struck[0].row.removesCaused).toBe(true);
    expect(struck[2].row.removesEffects).toEqual(["namelessForest"]);
    expect(struck[2].row.removesCaused).toBeUndefined();
  });

  it("reads a Reality Marble tag: an ability seals, an area does not", () => {
    const tagged = item("bradamante-angelica-cathay", { npTags: ["antiUnit", "realityMarble"] });
    const area = item("somebody-marble", { npTags: ["realityMarble"], field: { geometry: { kind: "fixedArea" } } });
    expect(struckAbilities(phase, [tagged, area]).map((s) => s.item.id)).toEqual(["i-bradamante-angelica-cathay"]);
  });

  it("ends the listed area he stands in, whoever owns it, and leaves the rest", () => {
    const fields = [
      { id: "emiya-unlimited-blade-works", ownerId: "enemy" },
      { id: "asterios-chaos-labyrinthos", ownerId: "ally" },
      { id: "somebody-else", ownerId: "enemy" },
      { id: "tagged", npTags: ["realityMarble"], ownerId: "enemy" },
    ];
    const board = { fields };
    expect(fieldsEndedBy(ENUMA.endsFieldsInside, { fields: ["emiya-unlimited-blade-works", "somebody-else", "tagged"] }, board))
      .toEqual(["emiya-unlimited-blade-works", "tagged"]);
    expect(fieldsEndedBy(ENUMA.endsFieldsInside, { fields: [] }, board)).toEqual([]);
    expect(fieldsEndedBy(null, { fields: ["emiya-unlimited-blade-works"] }, board)).toEqual([]);
  });

  it("finds what an ability caused on any Unit, by its id or its content id, and no one else's", () => {
    const np = item("kingprotea-airavata-king-size");
    const units = [
      { id: "ally", effectInstances: [
        { id: "a", sourceUnitId: "bearer", sourceAbilityId: np.id },
        { id: "b", sourceUnitId: "bearer", sourceAbilityId: "other" },
      ] },
      { id: "enemy", effectInstances: [
        { id: "c", sourceUnitId: "bearer", sourceAbilityId: "kingprotea-airavata-king-size" },
        { id: "d", sourceUnitId: "stranger", sourceAbilityId: np.id },
      ] },
    ];
    expect(causedBy(np, "bearer", units).map((f) => f.instance.id)).toEqual(["a", "c"]);
  });

  it("asks whether a field's ability is sealed on its owner", () => {
    const field = { id: "demiya-unlimited-lost-works", ownerId: "o" };
    const sealed = { units: [{ id: "o", effectInstances: [{ params: { sealsAbility: field.id } }] }] };
    const other = { units: [{ id: "o", effectInstances: [{ params: { sealsAbility: "else" } }] }] };
    expect(fieldSealed(field, sealed)).toBe(true);
    expect(fieldSealed(field, other)).toBe(false);
  });

  it("keeps Gully Trap Funny Muryan off every list until Kazuradrop (reading 22)", () => {
    expect(JSON.stringify(ENUMA.phases)).not.toMatch(/muryan/i);
    expect(JSON.stringify(ENUMA.endsFieldsInside)).not.toMatch(/muryan/i);
  });
});

describe("the exclusion (GB.round, EE.round, reading 12)", () => {
  it("is declared on both sides", () => {
    expect(GATE.sameRoundExclusive).toEqual(["gilgamesh-enuma-elish"]);
    expect(ENUMA.sameRoundExclusive).toEqual(["gilgamesh-gate-of-babylon"]);
  });
});

describe("through the real attack path (found pressing, #374)", () => {
  const FOE = "gilgameshFoe0001";
  const ALLY = "gilgameshAlly001";
  const WAR = { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18, npGateRound: 1, difficulty: "expert" }, actingFactionId: "A" } };
  const NOTHING = (...ids) => Object.fromEntries(ids.map((id) => [id, ["nothing", "declined", "declined", "declined", "declined"]]));
  const gil = (extra = {}) => ({ from: "gilgamesh", id: GIL, panel: { i: 6, j: 6 }, ...extra, state: { factionId: "A", ...(extra.state ?? {}) } });
  const foe = (from, panel, extra = {}) => ({ from, id: FOE, panel, ...extra, state: { factionId: "B", ...(extra.state ?? {}) } });
  const abilityOf = (w, id, contentId) => w.actor(id).items.find((i) => i.system.contentId === contentId);
  const effectsOf = (w, id, defId) => [...w.actor(id).effects].filter((e) => e.system?.defId === defId);

  it("carries the chosen Rank onto the clock, and refuses a declaration with none", async () => {
    await withSubjects([gil(), foe("drake", { i: 6, j: 8 })], async ({ world: w }) => {
      const gate = abilityOf(w, GIL, "gilgamesh-gate-of-babylon");
      await expect(playAttack(w, { attacker: GIL, ability: gate.id, placement: { direction: "e" }, react: NOTHING(FOE) })).rejects.toThrow(/FGT\.Tier\.NoneChosen/);
      await playAttack(w, { attacker: GIL, ability: gate.id, placement: { direction: "e", tier: 14 }, react: NOTHING(FOE, GIL) });
      // 7◈+⅔◈ at three a Round, less a Crit's cut if the coin gave one.
      expect([22, 23]).toContain(w.actor(GIL).items.get(gate.id).system.cooldown.remaining);
    }, WAR);
  });

  it("seals what Enuma Elish's DU carries, by name and with no chance against it", async () => {
    await withSubjects([gil(), foe("kingprotea", { i: 6, j: 8 })], async ({ world: w }) => {
      const ee = abilityOf(w, GIL, "gilgamesh-enuma-elish");
      await playAttack(w, { attacker: GIL, ability: ee.id, placement: { direction: "e" }, react: NOTHING(FOE, GIL) });
      const [seal] = effectsOf(w, FOE, "sealEa");
      expect(seal?.system.params).toMatchObject({ sealsAbility: "kingprotea-airavata-king-size" });
      expect(seal.system.params.name).toBe("FGT.Effect.NpSealNamed");
      expect(seal.system.unremovable).toBe(true);
    }, WAR);
  });

  it("takes Nameless Forest's marker and Token pool from every Unit, and writes no stat back (reading 23)", async () => {
    await withSubjects([
      gil(),
      foe("nursery-rhyme", { i: 6, j: 8 }),
      { from: "cu-chulainn", id: ALLY, panel: { i: 2, j: 2 }, state: { factionId: "A", resources: { namelessForestTokens: { value: 2 } } }, effects: [{ defId: "namelessForest", expiry: null }] },
    ], async ({ world: w }) => {
      const before = w.actor(ALLY).system.health.max;
      const ee = abilityOf(w, GIL, "gilgamesh-enuma-elish");
      await playAttack(w, { attacker: GIL, ability: ee.id, placement: { direction: "e" }, react: NOTHING(FOE, GIL) });
      expect(effectsOf(w, ALLY, "namelessForest")).toHaveLength(0);
      expect(w.actor(ALLY).system.resources?.namelessForestTokens?.value).toBe(0);
      expect(w.actor(ALLY).system.health.max).toBe(before);
      // Only a successful Luck Check earns the 10% off gaining them again.
      expect(effectsOf(w, ALLY, "namelessForestResistance")).toHaveLength(0);
    }, WAR);
  });

  it("wakes a sleeper with an attack's damage, doubled at Total", async () => {
    await withSubjects([gil(), foe("cu-chulainn", { i: 6, j: 8 }, { effects: [{ defId: "sleep", expiry: 40 }] })], async ({ world: w }) => {
      await playAttack(w, { attacker: GIL, target: FOE, react: NOTHING(FOE, GIL) });
      expect(effectsOf(w, FOE, "sleep")).toHaveLength(0);
      const card = [...w.messages].map((m) => m.getFlag?.("fgt", "result")).filter(Boolean).at(-1);
      expect(card.flags.wokeFromSleep).toBe(true);
    }, WAR);
  });
});

describe("Addle and Gashed at their doors (reading 11)", () => {
  it("holds his automatic Golden Rule under Addle, with a line, and says so when Treasury is clear", async () => {
    const { fireEvent } = await import("../../module/engine/scheduler.mjs");
    const crit = (u) => fireEvent("damageDealt", [u], { tick: 1, options: new Set(["attack:crit"]), board: { units: [u] } });
    const lines = (intents) => intents.filter((x) => x.entry?.kind === "cardLine").map((x) => x.entry.line.key);
    await withSubjects([{ from: "gilgamesh", id: GIL, panel: { i: 6, j: 6 } }], ({ unit }) => {
      expect(lines(crit(unit(GIL)))).toEqual(["FGT.Cooldown.NamedClear"]);
    });
    await withSubjects([{ from: "gilgamesh", id: GIL, panel: { i: 6, j: 6 }, effects: [{ defId: "addle", expiry: 30 }] }], ({ unit }) => {
      expect(lines(crit(unit(GIL)))).toEqual(["FGT.Effect.AddleHolds"]);
    });
  });

  it("states both halves of Gashed", () => {
    expect(source("effects/gashed.yml").rules).toEqual([
      { key: "HealingReceived", value: -100 },
      { key: "BarsRestore", stat: "agility" },
    ]);
  });
});
