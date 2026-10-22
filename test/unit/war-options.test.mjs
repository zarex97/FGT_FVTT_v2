/**
 * @file The War's own facts and a Servant's Class as predicate options (#314).
 * @see module/rules/options.mjs, module/rules/environment.mjs#roundPhase, module/engine/round-phase.mjs
 *
 * Closes #286 (Class), #294 (an effect sets Day or Night), #301 (the War's Region)
 * and the remaining part of #287 (an ability's no-cycle alternative). Rulings of
 * 2026-10-22: Knight is Saber, Archer and Lancer; an override holds for the Round
 * in progress only; a change by an ability fires `phaseChanged` as a Round
 * boundary does; in a War without the cycle the alternative IS the ability.
 */

import { beforeAll, describe, expect, it } from "vitest";

import { roundPhase } from "../../module/rules/environment.mjs";
import { rollOptionsFor, isEmittableOption } from "../../module/rules/options.mjs";
import { availableInThisWar, canUseAbility } from "../../module/rules/costs.mjs";
import { test as testPredicate } from "../../module/rules/predicate.mjs";
import { SERVANT_CLASSES, STANDARD_CLASSES } from "../../module/domain/enums.mjs";
import { CORE_CLASSES } from "../../module/rules/war-setup.mjs";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { castSkill } from "../helpers/process.mjs";

beforeAll(async () => { await prepareSubjects(); }, 120_000);

describe("roundPhase, the one deriver", () => {
  it("alternates from the opening flip", () => {
    expect([1, 2, 3, 4].map((round) => roundPhase({ round, opening: "day" }))).toEqual(["day", "night", "day", "night"]);
    expect([1, 2, 3].map((round) => roundPhase({ round, opening: "night" }))).toEqual(["night", "day", "night"]);
  });

  it("is none in a War without the cycle, by rule or by an opening of none", () => {
    expect(roundPhase({ round: 2, opening: "day", cycle: false })).toBe("none");
    expect(roundPhase({ round: 2, opening: "none" })).toBe("none");
  });

  it("takes an override for its own Round only, and leaves the alternation alone", () => {
    // Kuonji Alice, Round 3 a Day Round: *"the game state becomes Night until the
    // end of the Round (next Round will still be Night as usual)"*.
    const override = { phase: "night", round: 3 };
    expect(roundPhase({ round: 3, opening: "day", override })).toBe("night");
    expect(roundPhase({ round: 4, opening: "day", override })).toBe("night");
    expect(roundPhase({ round: 5, opening: "day", override })).toBe("day");
    // Tamamo Goth: *"Day-Night progression is unaffected"*.
    expect(roundPhase({ round: 2, opening: "day", override: { phase: "day", round: 2 } })).toBe("day");
    expect(roundPhase({ round: 3, opening: "day", override: { phase: "day", round: 2 } })).toBe("day");
  });

  it("ignores an override in a War without the cycle", () => {
    expect(roundPhase({ round: 3, opening: "day", cycle: false, override: { phase: "night", round: 3 } })).toBe("none");
  });
});

const servant = (classes, extra = {}) => ({ kind: "servant", servantClasses: classes, ...extra });

describe("war: options", () => {
  it("emits the War's Region and the Round's phase from either combatant", () => {
    const war = { region: "russia", phase: "night" };
    const options = rollOptionsFor({ attacker: servant(["caster"], { war }), defender: servant(["saber"]) });
    expect([...options].filter((o) => o.startsWith("war:"))).toEqual(["war:region:russia", "war:phase:night"]);
    const fromDefender = rollOptionsFor({ attacker: null, defender: servant(["saber"], { war }) });
    expect(fromDefender.has("war:region:russia")).toBe(true);
  });

  it("emits war:phase:none, which self:phase never does", () => {
    const options = rollOptionsFor({ attacker: servant([], { phase: "none", war: { region: null, phase: "none" } }) });
    expect(options.has("war:phase:none")).toBe(true);
    expect([...options].some((o) => o.startsWith("self:phase:"))).toBe(false);
  });

  it("keeps a Unit's own Region apart from the War's", () => {
    // Penthesilea's *"Male Units from the Greece region"* is where the Unit is from.
    const options = rollOptionsFor({ attacker: servant([], { region: ["greece"], war: { region: "russia", phase: "day" } }) });
    expect(options.has("self:region:greece")).toBe(true);
    expect(options.has("war:region:russia")).toBe(true);
    expect(options.has("war:region:greece")).toBe(false);
  });

  it("is in the option vocabulary, so content may author it", () => {
    for (const o of ["war:region:russia", "war:phase:none", "war:phase:day", "target:class:caster",
      "target:class:same", "self:classGroup:knight", "target:classGroup:extra", "self:class:shielder"]) {
      expect(isEmittableOption(o), o).toBe(true);
    }
    expect(isEmittableOption("war:phase:dusk")).toBe(false);
    expect(isEmittableOption("target:classGroup:cavalry")).toBe(false);
  });
});

describe("Class options", () => {
  const opts = (attacker, defender) => rollOptionsFor({ attacker, defender });

  it("names a Servant's Class and its group: Summer Passionlip's Standard Class Servants", () => {
    const o = opts(servant(["foreigner"]), servant(["caster"]));
    expect(o.has("target:class:caster")).toBe(true);
    expect(o.has("target:classGroup:standard")).toBe(true);
    expect(o.has("self:classGroup:extra")).toBe(true);
  });

  it("reads Knight as Saber, Archer and Lancer only (ruled 2026-10-22)", () => {
    for (const c of ["saber", "archer", "lancer"]) expect(opts(null, servant([c])).has("target:classGroup:knight"), c).toBe(true);
    for (const c of ["rider", "caster", "ruler"]) expect(opts(null, servant([c])).has("target:classGroup:knight"), c).toBe(false);
  });

  it("answers Draco's non-Standard Class Servants excluding Avenger and Shielder", () => {
    const draco = ["not:target:classGroup:standard", "not:target:class:avenger", "not:target:class:shielder"];
    const hit = (c) => testPredicate(draco, { options: opts(servant(["beast"]), servant([c])) });
    expect(hit("ruler")).toBe(true);
    expect(hit("saber")).toBe(false);
    expect(hit("avenger")).toBe(false);
    expect(hit("shielder")).toBe(false);
  });

  it("answers Kazuradrop's same Class as herself", () => {
    expect(opts(servant(["alterEgo"]), servant(["alterEgo"])).has("target:class:same")).toBe(true);
    expect(opts(servant(["alterEgo"]), servant(["saber"])).has("target:class:same")).toBe(false);
  });

  it("gives a Master or a summon no Class: the sheets say X-class Servants", () => {
    const o = opts({ kind: "master", servantClasses: ["caster"] }, { kind: "summon", servantClasses: ["saber"] });
    expect([...o].some((x) => x.includes(":class:") || x.includes(":classGroup:"))).toBe(false);
  });

  it("keeps the seven Standard Classes one list, and knows Shielder and Saver", () => {
    expect(CORE_CLASSES).toBe(STANDARD_CLASSES);
    expect(STANDARD_CLASSES).toEqual(["saber", "archer", "lancer", "rider", "caster", "assassin", "berserker"]);
    expect(SERVANT_CLASSES).toEqual(expect.arrayContaining(["shielder", "saver"]));
  });
});

describe("availableWhen: an ability exists in the War its bearer stands in", () => {
  const unitIn = (phase) => servant(["saber"], { war: { region: null, phase } });

  it("lets a no-cycle form through only in a War without the cycle", () => {
    const noCycle = { availableWhen: ["war:phase:none"] };
    const cycled = { availableWhen: ["not:war:phase:none"] };
    expect(availableInThisWar(noCycle, unitIn("none"))).toBe(true);
    expect(availableInThisWar(noCycle, unitIn("day"))).toBe(false);
    expect(availableInThisWar(cycled, unitIn("night"))).toBe(true);
    expect(availableInThisWar(cycled, unitIn("none"))).toBe(false);
    expect(availableInThisWar({}, unitIn("none"))).toBe(true);
  });

  it("is refused by the use gate with its own reason, which the bar and the sheet hide on", () => {
    const verdict = canUseAbility({ ability: { id: "x", availableWhen: ["war:phase:none"] }, unit: unitIn("day") });
    expect(verdict).toMatchObject({ ok: false, reason: "notInThisWar" });
  });

  // Gawain's shape: one passive for a War with Day and Night, one for a War without.
  const probe = {
    type: "servant", id: "probeGawain", name: "Probe Gawain", servantClasses: ["saber"],
    parameters: { str: "C", end: "C", agi: "C", mag: "C", luc: "C" },
    abilities: [
      { id: "probe-cycle", name: "Probe Cycle", kind: "skill", slug: "probeCycle",
        availableWhen: ["not:war:phase:none"], passiveRules: [{ key: "FlatDamage", value: 3 }] },
      { id: "probe-nocycle", name: "Probe No Cycle", kind: "skill", slug: "probeNoCycle",
        availableWhen: ["war:phase:none"], passiveRules: [{ key: "FlatDamage", value: 7 }] },
    ],
  };
  // Read through the live projection (`currentBoard`), which hands collection the War's facts.
  const flats = (cycle) => withSubjects([{ from: probe, id: "probeGawain", state: { factionId: "A" }, panel: { i: 5, j: 5 } }],
    async () => {
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const me = currentBoard().units.find((u) => u.id === "probeGawain");
      return me.modifiers.filter((m) => /Probe/.test(m.source ?? "")).map((m) => m.value);
    },
    { tokens: true, combat: { round: 2, started: true, system: { globalTurn: 6, phase: "day", dayNightCycle: cycle } } });

  it("applies only the version that exists in this War", async () => {
    expect(await flats(true)).toEqual([3]);
    expect(await flats(false)).toEqual([7]);
  });
});

describe("setRoundPhase: Kuonji Alice turns a Day Round to Night", () => {
  const alice = {
    type: "servant", id: "probeAlice", name: "Probe Alice", servantClasses: ["caster"],
    parameters: { str: "C", end: "C", agi: "C", mag: "C", luc: "C" },
    abilities: [
      { id: "probe-night", name: "Probe Night", kind: "skill", slug: "probeNight", timing: { window: "ownTurn" },
        targeting: { anchor: { kind: "self" }, shape: { kind: "unit" }, selection: { relations: ["self"], includeSelf: true, chooser: "all" } },
        phases: [{ kind: "setRoundPhase", to: "night", predicate: ["war:phase:day"] }] },
      // *"Whenever the game state changes from a Day Round to a Night Round"*.
      { id: "probe-hears", name: "Probe Hears", kind: "skill", slug: "probeHears",
        passiveRules: [{ key: "OnEvent", event: "phaseChanged", eventFilter: { to: "night" }, automatic: true,
          then: [{ key: "Message", text: "heard the night" }] }] },
    ],
  };
  const atRound = (round) => ({ tokens: true, combat: { round, started: true, system: { globalTurn: round * 3, phase: "day" }, actingFactionId: "A" } });

  it("makes the Round in progress Night, for that Round only, and is heard", async () => {
    await withSubjects([{ from: alice, id: "probeAlice", state: { factionId: "A" }, panel: { i: 5, j: 5 } }], async ({ world: w }) => {
      const { currentRoundPhase, currentBoard } = await import("../../module/engine/board.mjs");
      expect(currentRoundPhase(3)).toBe("day");
      const ability = [...w.actor("probeAlice").items].find((i) => i.system.slug === "probeNight");
      const out = await castSkill(w, { caster: "probeAlice", ability: ability.id });
      expect(out.ok, out.reason).toBe(true);
      expect(w.combat.system.phaseOverride).toEqual({ phase: "night", round: 3 });
      expect(currentBoard().phase).toBe("night");
      expect(currentRoundPhase(4)).toBe("night");
      expect(currentRoundPhase(5)).toBe("day");
      const log = w.combat.getFlag("fgt", "log") ?? [];
      expect(log.some((e) => e.kind === "message" && e.text === "heard the night")).toBe(true);
    }, atRound(3));
  });

  it("changes nothing, and fires nothing, on a Night Round: the predicate gates it", async () => {
    await withSubjects([{ from: alice, id: "probeAlice", state: { factionId: "A" }, panel: { i: 5, j: 5 } }], async ({ world: w }) => {
      const ability = [...w.actor("probeAlice").items].find((i) => i.system.slug === "probeNight");
      await castSkill(w, { caster: "probeAlice", ability: ability.id });
      expect(w.combat.system.phaseOverride ?? null).toBeNull();
      expect((w.combat.getFlag("fgt", "log") ?? []).some((e) => e.kind === "message")).toBe(false);
    }, atRound(2));
  });
});
