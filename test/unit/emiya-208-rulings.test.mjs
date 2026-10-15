/**
 * EMIYA's audit, #208: the readings ruled on 2026-10-14 that differ from what
 * was built. Each test names its reading; Ch. 46 §46.30 holds the record.
 * The Process-driven ones are in `emiya-208-arena.test.mjs`.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { castSkill } from "../helpers/process.mjs";
import { canUseAbility } from "../../module/rules/costs.mjs";
import { usageSpecFor } from "../../module/rules/ability-use.mjs";
import { rollOptionsFor } from "../../module/rules/options.mjs";
import { test as testPredicate } from "../../module/rules/predicate.mjs";
import { parseOption } from "../../module/rules/facets.mjs";
import { installClientNamespace } from "../helpers/client-namespace.mjs";
import { readFileSync } from "node:fs";
import { parse } from "yaml";

beforeAll(prepareSubjects, 120_000);

const E = "emiyaCaster00000";
const OWN_TURN = { tokens: true, combat: { round: 3, started: true, system: { globalTurn: 7 }, actingFactionId: "A" } };

/** An authored ability document. */
const ability = (name) => parse(readFileSync(`packs/_source/abilities/${name}.yml`, "utf8"));

/** One of a Subject's abilities, by content id. */
const abilityOf = (world, actorId, key) =>
  world.actor(actorId).items.find((i) => i.system?.slug === key || i.system?.contentId === key);

/** The effect instances of one definition an actor holds. */
const held = (world, actorId, defId) =>
  [...world.actor(actorId).effects].filter((e) => e.system?.defId === defId);

/* ========================================================================== */
/*  Readings 2 and 3 -- Trace, On is a plain Skill (#210)                       */
/* ========================================================================== */

describe("Trace, On is a plain Skill, not a Thaumaturgy Spell (#208 reading 2, ruled 2026-10-14)", () => {
  it("is usable while he is Silenced", async () => {
    await withSubjects([
      { from: "emiya", id: E, state: { factionId: "A" }, effects: [{ defId: "silence" }] },
    ], ({ world, unit }) => {
      const item = abilityOf(world, E, "emiya-trace-on");
      const verdict = canUseAbility({
        ability: usageSpecFor(item), unit: unit(E), round: 3, turnsPerRound: 3, actingFactionId: "A",
      });
      // HEAD refused with reason "prevented" (`negatedBy: [silence]`): the reason is asserted, not only the failure.
      expect(verdict.reason).toBeUndefined();
      expect(verdict.ok).toBe(true);
    });
  });

  it("is not a Spell: no category for Magecraft or the Atk Up (Trace) extension to hear", async () => {
    await withSubjects([{ from: "emiya", id: E, state: { factionId: "A" } }], ({ world }) => {
      const item = abilityOf(world, E, "emiya-trace-on");
      expect(item.system.isSpell).toBe(false);
      expect(item.system.category ?? null).toBeNull();
      expect(item.system.negatedBy ?? []).toEqual([]);
    });
  });

  it("gives no Range Up (Hawkeye): Magecraft does not hear it", async () => {
    await withSubjects([
      { from: "emiya", id: E, state: { factionId: "A" }, panel: { i: 5, j: 5 } },
    ], async ({ world: w }) => {
      w.answer({ title: "Trace, On", pick: ["activatedCircuits"] });
      const out = await castSkill(w, { caster: E, ability: abilityOf(w, E, "emiya-trace-on").id, placement: { unitId: E } });
      expect(out.ok).toBe(true);
      // The Skill did its work ...
      expect(held(w, E, "atkUpTrace")).toHaveLength(1);
      // ... and Magecraft stayed silent.
      expect(held(w, E, "rangeUpHawkeye")).toHaveLength(0);
    }, OWN_TURN);
  }, 60_000);
});

describe("Trace, On adds one third of a Round to Atk Up (Trace), once (#208 reading 3, ruled 2026-10-14)", () => {
  // Turn 7 of a 3-Turn Round. Atk Up (Trace) lasts ⅓◈ = 1 Turn.
  const NOW = 7;

  it("the first use applies it for exactly ⅓◈", async () => {
    await withSubjects([
      { from: "emiya", id: E, state: { factionId: "A" }, panel: { i: 5, j: 5 } },
    ], async ({ world: w }) => {
      w.answer({ title: "Trace, On", pick: ["activatedCircuits"] });
      await castSkill(w, { caster: E, ability: abilityOf(w, E, "emiya-trace-on").id, placement: { unitId: E } });
      const [buff] = held(w, E, "atkUpTrace");
      // HEAD: NOW + 2 -- the Skill's own `abilityUsed` extended the buff it had just applied.
      expect(buff.system.expiry).toBe(NOW + 1);
    }, OWN_TURN);
  }, 60_000);

  it("a second use while he holds it adds exactly ⅓◈, not twice", async () => {
    await withSubjects([
      { from: "emiya", id: E, state: { factionId: "A" }, panel: { i: 5, j: 5 } },
    ], async ({ world: w }) => {
      w.answer({ title: "Trace, On", pick: ["activatedCircuits"] });
      const trace = abilityOf(w, E, "emiya-trace-on");
      await castSkill(w, { caster: E, ability: trace.id, placement: { unitId: E } });
      const before = held(w, E, "atkUpTrace")[0].system.expiry;
      // The 5◈ Cooldown is the sheet's, not what this test is about: clear it.
      await trace.update({ "system.cooldown.remaining": 0 });
      w.answer({ title: "Trace, On", pick: ["blazingCircuits"] });
      const out = await castSkill(w, { caster: E, ability: trace.id, placement: { unitId: E } });
      expect(out.ok).toBe(true);
      const buffs = held(w, E, "atkUpTrace");
      expect(buffs).toHaveLength(1);
      // HEAD: before + 2 -- once for the Skill itself, once more through `abilityUsed`.
      expect(buffs[0].system.expiry).toBe(before + 1);
    }, OWN_TURN);
  }, 60_000);
});

/* ========================================================================== */
/*  Readings 4 and 23 -- Unlimited Blade Works is not a Projection (#211)       */
/* ========================================================================== */

describe("Unlimited Blade Works is not a Projection (#208 reading 4, ruled 2026-10-14)", () => {
  it("Tracing does not offer it, though it is cooling, and offers the Projections beside it", async () => {
    await withSubjects([
      { from: "emiya", id: E, state: { factionId: "A" }, panel: { i: 5, j: 5 } },
    ], async ({ world: w }) => {
      const ubw = abilityOf(w, E, "emiya-unlimited-blade-works");
      const hrunting = abilityOf(w, E, "emiya-hrunting");
      const caladbolg = abilityOf(w, E, "emiya-caladbolg");
      for (const item of [ubw, hrunting, caladbolg]) await item.update({ "system.cooldown.remaining": 5 });
      const tracing = abilityOf(w, E, "emiya-tracing");
      // The same title twice: the shape, then the Projection.
      w.answer({ title: tracing.name, pick: ["focus"] });
      w.answer({ title: tracing.name, pick: [hrunting.id] });
      const out = await castSkill(w, { caster: E, ability: tracing.id, placement: { unitId: E } });
      expect(out.ok).toBe(true);
      const offered = w.asked.find((a) => a.title === tracing.name && a.options.includes(hrunting.id));
      expect(offered.options).toContain(caladbolg.id);
      // HEAD: UBW was on this list (`category: projection`).
      expect(offered.options).not.toContain(ubw.id);
    }, OWN_TURN);
  }, 60_000);

  it("using it neither extends Atk Up (Trace) nor gives Range Up", async () => {
    await withSubjects([
      { from: "emiya", id: E, state: { factionId: "A" }, panel: { i: 5, j: 5 },
        effects: [{ defId: "atkUpTrace", expiry: 9, magnitude: 60, npMagnitude: 40 }] },
    ], async ({ world: w }) => {
      const { fireAbilityUsed } = await import("../../module/engine/skill-use.mjs");
      await fireAbilityUsed(w.actor(E), abilityOf(w, E, "emiya-unlimited-blade-works"));
      // HEAD: 10 and a Range Up -- both handlers heard `category: projection`.
      expect(held(w, E, "atkUpTrace")[0].system.expiry).toBe(9);
      expect(held(w, E, "rangeUpHawkeye")).toHaveLength(0);
      // The control: a Projection that IS one still does both.
      await fireAbilityUsed(w.actor(E), abilityOf(w, E, "emiya-hrunting"));
      expect(held(w, E, "atkUpTrace")[0].system.expiry).toBe(10);
      expect(held(w, E, "rangeUpHawkeye")).toHaveLength(1);
    }, OWN_TURN);
  }, 60_000);
});

describe("Silence stops the Aria and nothing else of Unlimited Blade Works (#208 reading 23, ruled 2026-10-14)", () => {
  const silenced = { from: "emiya", id: E, state: { factionId: "A", resources: { aria: { value: 6, max: 6 } } }, effects: [{ defId: "silence" }] };

  it("opens with 6 Aria while Silenced", async () => {
    await withSubjects([silenced], ({ world, unit }) => {
      const verdict = canUseAbility({
        ability: usageSpecFor(abilityOf(world, E, "emiya-unlimited-blade-works")),
        unit: unit(E), round: 6, turnsPerRound: 3, actingFactionId: "A",
      });
      // HEAD refused with reason "prevented" (`negatedBy: [silence]`).
      expect(verdict.reason).toBeUndefined();
      expect(verdict.ok).toBe(true);
    });
  });

  it("still needs the 6 Aria", async () => {
    await withSubjects([{ ...silenced, state: { factionId: "A", resources: { aria: { value: 5, max: 6 } } } }], ({ world, unit }) => {
      const verdict = canUseAbility({
        ability: usageSpecFor(abilityOf(world, E, "emiya-unlimited-blade-works")),
        unit: unit(E), round: 6, turnsPerRound: 3, actingFactionId: "A",
      });
      expect(verdict.ok).toBe(false);
      expect(verdict.reason).toBe("resourceAtLeast");
    });
  });

  it("gains no Aria at the end of a Combat Phase while Silenced, and one when not (pinned: as built)", async () => {
    const { fireEvent } = await import("../../module/engine/scheduler.mjs");
    const phaseEnd = (unit) => fireEvent("combatPhaseEnd", [unit], { tick: 7, turnsPerRound: 3, options: new Set() })
      .filter((i) => i.t !== "log");
    await withSubjects([{ ...silenced, state: { factionId: "A" }, effects: [{ defId: "silence" }] }], ({ unit }) => {
      expect(phaseEnd(unit(E))).toEqual([]);
    });
    await withSubjects([{ from: "emiya", id: E, state: { factionId: "A" } }], ({ unit }) => {
      const gained = phaseEnd(unit(E));
      expect(gained).toHaveLength(1);
      expect(gained[0]).toMatchObject({ unitId: E });
      expect(JSON.stringify(gained[0])).toContain("aria");
    });
  });
});

/* ========================================================================== */
/*  Readings 5, 7, 11, 22 -- Kanshou & Bakuya and Overedge (#212)               */
/* ========================================================================== */

describe("a close Normal Attack uses Kanshou & Bakuya (#208 reading 5, ruled 2026-10-14)", () => {
  const H = "heraclesTarget00";
  const board = (j) => [
    { from: "emiya", id: E, state: { factionId: "A" }, panel: { i: 5, j: 5 } },
    { from: "heracles", id: H, state: { factionId: "B" }, panel: { i: 5, j } },
  ];

  /** The `abilityUsed` events K&B's `attackDeclared` rule raises for a Normal Attack at this range. */
  const usesAt = async (j) => {
    const { fireEvent } = await import("../../module/engine/scheduler.mjs");
    return withSubjects(board(j), ({ unit }) => {
      const options = rollOptionsFor({ attacker: unit(E), defender: unit(H), attack: { kind: "normal", range: j - 5 } });
      return fireEvent("attackDeclared", [unit(E)], { tick: 7, turnsPerRound: 3, options, rolls: {} })
        .filter((i) => i.t === "event" && i.event === "abilityUsed");
    });
  };

  it("raises abilityUsed about the Projection NP at Range 2", async () => {
    const used = await usesAt(7);
    // HEAD: none -- the rule applied Kanshou & Bakuya's effect and never said it was used.
    expect(used).toHaveLength(1);
    expect(used[0].payload).toMatchObject({
      unitId: E,
      subject: { contentId: "emiya-kanshou-and-bakuya", category: "projection", isNP: true },
    });
  });

  it("raises nothing at Range 3: it is not used", async () => {
    expect(await usesAt(8)).toHaveLength(0);
  });
});

describe("Overedge's swings are Normal Attacks and the Noble Phantasm the Circuits ask for (#208 readings 7, 11, 22)", () => {
  const H = "heraclesTarget00";
  /** The options a declared attack carries against Heracles at this range. */
  const optionsOf = async (contentId, range) => {
    installClientNamespace();
    const { buildAttackSpec } = await import("../../module/engine/attack.mjs");
    return withSubjects([
      { from: "emiya", id: E, state: { factionId: "A" }, panel: { i: 5, j: 5 } },
      { from: "heracles", id: H, state: { factionId: "B" }, panel: { i: 5, j: 5 + range } },
    ], ({ world, unit, board }) => {
      const item = contentId ? abilityOf(world, E, contentId) : null;
      const declared = buildAttackSpec({
        attacker: world.actor(E), ability: item, abilityId: item?.id ?? null,
        options: rollOptionsFor({ attacker: unit(E), defender: unit(H) }), board,
      });
      return {
        declared,
        options: rollOptionsFor({ attacker: unit(E), defender: unit(H), attack: { ...declared, range } }),
        clairvoyance: abilityOf(world, E, "emiya-clairvoyance").system.passiveRules[0].predicate,
      };
    });
  };

  it("Overedge: attack:kind:normal beside attackSkill, and attack:isNP (it is categorized as one)", async () => {
    const { declared, options } = await optionsOf("emiya-overedge", 3);
    // HEAD: neither `attack:kind:normal` (not countsAsNormalAttack) nor `attack:isNP` (no such option).
    expect(declared.asNormalAttack).toBe(true);
    expect(declared.categorizedAsNP).toBe(true);
    expect(options.has("attack:kind:normal")).toBe(true);
    expect(options.has("attack:kind:attackSkill")).toBe(true);
    expect(options.has("attack:isNP")).toBe(true);
  });

  it("a bare close swing is a Normal Attack and not 'an NP that deals damage' (reading 22)", async () => {
    const { options } = await optionsOf(null, 2);
    expect(options.has("attack:kind:normal")).toBe(true);
    expect(options.has("attack:isNP")).toBe(false);
  });

  it("a real Noble Phantasm carries attack:isNP too, and one definition decides (isNPAttack)", async () => {
    const { options } = await optionsOf("emiya-hrunting", 4);
    expect(options.has("attack:kind:np")).toBe(true);
    expect(options.has("attack:isNP")).toBe(true);
  });

  it("Clairvoyance hears an Overedge swing at Range 3, and not one at Range 2", async () => {
    const far = await optionsOf("emiya-overedge", 3);
    const near = await optionsOf("emiya-overedge", 2);
    expect(testPredicate(far.clairvoyance, { options: far.options })).toBe(true);
    expect(testPredicate(near.clairvoyance, { options: near.options })).toBe(false);
  });

  it("the facet is registered, so a Clause may name it", () => {
    expect(parseOption("attack:isNP")).not.toBeNull();
  });
});

describe("Overedge fires the Circuits' 'next NP that deals damage'; a close swing does not (#208 readings 11, 22)", () => {
  const H = "heraclesTarget00";

  it("both Circuits ask attack:isNP for it, and an Overedge swing, Hrunting and no bare swing answers", async () => {
    installClientNamespace();
    const { buildAttackSpec } = await import("../../module/engine/attack.mjs");
    const { EffectRegistry } = await import("../../module/rules/registry.mjs");
    await withSubjects([
      { from: "emiya", id: E, state: { factionId: "A" }, panel: { i: 5, j: 5 } },
      { from: "heracles", id: H, state: { factionId: "B" }, panel: { i: 5, j: 7 } },
    ], ({ world, unit, board }) => {
      const optionsOf = (contentId, range) => {
        const item = contentId ? abilityOf(world, E, contentId) : null;
        const declared = buildAttackSpec({
          attacker: world.actor(E), ability: item, abilityId: item?.id ?? null,
          options: rollOptionsFor({ attacker: unit(E), defender: unit(H) }), board,
        });
        return rollOptionsFor({ attacker: unit(E), defender: unit(H), attack: { ...declared, range } });
      };
      // The charge is its own document since #213 (a one-shot inside a persistent effect spends the effect).
      for (const defId of ["acNextNp", "bcNextNp"]) {
        // The clause that spends the charge is the one carrying `consumesUse`.
        const clause = EffectRegistry.get(defId).rules.find((r) => r.consumesUse);
        // At 7231295 (as the Circuits themselves): ["attack:kind:np"] -- Overedge is categorized as an NP and is not kind np.
        expect(clause.predicate, defId).toEqual(["attack:isNP"]);
        expect(testPredicate(clause.predicate, { options: optionsOf("emiya-overedge", 3) }), `${defId} Overedge`).toBe(true);
        expect(testPredicate(clause.predicate, { options: optionsOf("emiya-hrunting", 4) }), `${defId} Hrunting`).toBe(true);
        expect(testPredicate(clause.predicate, { options: optionsOf(null, 2) }), `${defId} close swing`).toBe(false);
      }
    });
  });
});

/* ========================================================================== */
/*  Reading 13 -- Atk Up (Trace) going takes the Circuits with it (#213)        */
/* ========================================================================== */

describe("Atk Up (Trace) removed from him removes every piece of the Circuits (#208 reading 13, ruled 2026-10-14/15)", () => {
  const PIECES = ["activatedCircuits", "acNextNp", "acOverdrive", "blazingCircuits", "bcNextNp", "bcOverdrive", "circuitsPending"];
  const everything = [
    { defId: "atkUpTrace", expiry: 7, magnitude: 60, npMagnitude: 40 },
    // The two circuits cannot both be held; the pieces are listed whole so none can be missed.
    ...PIECES.map((defId) => ({ defId })),
  ];

  it("running out: the scheduler removes all seven (pinned: as built for the two circuits)", async () => {
    const { expireEffects } = await import("../../module/engine/scheduler.mjs");
    const { EffectRegistry } = await import("../../module/rules/registry.mjs");
    await withSubjects([{ from: "emiya", id: E, state: { factionId: "A" }, effects: everything }], ({ unit }) => {
      const ctx = { tick: 7, turnsPerRound: 3, effectDef: (id) => EffectRegistry.get(id) };
      const intents = expireEffects([unit(E)], ctx);
      const removed = intents.filter((i) => i.t === "removeEffect" && PIECES.includes(i.effectId)).map((i) => i.effectId);
      // HEAD: activatedCircuits and blazingCircuits only -- the pieces did not exist.
      expect([...new Set(removed)].sort()).toEqual([...PIECES].sort());
    });
  });

  it("a Cure or a strip does the same: the clause runs for any removal", async () => {
    const { applyWorldIntents } = await import("../../module/engine/applier.mjs");
    const I = await import("../../module/engine/intents.mjs");
    await withSubjects([
      { from: "emiya", id: E, state: { factionId: "A" }, panel: { i: 5, j: 5 }, effects: everything },
    ], async ({ world: w }) => {
      await applyWorldIntents([I.removeEffect(E, "atkUpTrace", "cure")], "test:cure");
      // HEAD: the circuits stayed -- `onRemove` was paid by expiry alone.
      expect([...w.actor(E).effects].map((e) => e.system.defId)).toEqual([]);
    }, OWN_TURN);
  });

  it("a refresh is not a removal: reapplying Atk Up (Trace) keeps the Circuits", async () => {
    await withSubjects([
      { from: "emiya", id: E, state: { factionId: "A" }, panel: { i: 5, j: 5 },
        effects: [{ defId: "atkUpTrace", expiry: 9, magnitude: 60, npMagnitude: 40 }, { defId: "activatedCircuits" }, { defId: "acNextNp", uses: 1 }] },
    ], async ({ world: w }) => {
      // Trace, On again, with Atk Up (Trace) held: the buff extends and the circuits are chosen anew.
      w.answer({ title: "Trace, On", pick: ["blazingCircuits"] });
      const out = await castSkill(w, { caster: E, ability: abilityOf(w, E, "emiya-trace-on").id, placement: { unitId: E } });
      expect(out.ok).toBe(true);
      const held = [...w.actor(E).effects].map((e) => e.system.defId).sort();
      // The swap: AC and its one-shot are replaced by BC and its own. Atk Up (Trace) stays, once.
      expect(held).toEqual(["atkUpTrace", "bcNextNp", "blazingCircuits"]);
    }, OWN_TURN);
  }, 60_000);
});

describe("choosing a circuit puts its pieces on him (#208 readings 10 to 13)", () => {
  it("Activated Circuits come with their one-shot, Blazing Circuits with theirs", async () => {
    await withSubjects([
      { from: "emiya", id: E, state: { factionId: "A" }, panel: { i: 5, j: 5 } },
    ], async ({ world: w }) => {
      w.answer({ title: "Trace, On", pick: ["activatedCircuits"] });
      await castSkill(w, { caster: E, ability: abilityOf(w, E, "emiya-trace-on").id, placement: { unitId: E } });
      expect(held(w, E, "activatedCircuits")).toHaveLength(1);
      // HEAD: authored `uses: 1` on AC itself; the one-shot is its own document now.
      expect(held(w, E, "acNextNp")).toHaveLength(1);
      expect(held(w, E, "acNextNp")[0].system.uses).toBe(1);
      expect(held(w, E, "blazingCircuits")).toHaveLength(0);
    }, OWN_TURN);
  }, 60_000);
});

describe("`on removal` is the effect's, whichever way it goes (#208 reading 13, found building it)", () => {
  it("Shock's Agility +1 on removal is paid by a Cure as well as by running out", async () => {
    const { applyWorldIntents } = await import("../../module/engine/applier.mjs");
    const I = await import("../../module/engine/intents.mjs");
    await withSubjects([
      { from: "emiya", id: E, state: { factionId: "A" }, panel: { i: 5, j: 5 }, effects: [{ defId: "shock" }] },
    ], async ({ world: w }) => {
      await w.actor(E).update({ "system.agility.max": 12, "system.agility.value": 9 });
      await applyWorldIntents([I.removeEffect(E, "shock", "cure")], "test:cure");
      // Was 9 -- the clause belonged to the clock by accident.
      expect(w.actor(E).system.agility.value).toBe(10);
    }, OWN_TURN);
  }, 60_000);
});

/* ========================================================================== */
/*  Readings 8 and 9 -- Reinforcement (#214)                                    */
/* ========================================================================== */

describe("Reinforcement is used at the start of a Combat Phase he is in, not any time in his Turn (#208 reading 8, ruled 2026-10-14)", () => {
  it("is offered at the start of a Combat Phase he attacks in, and one he is attacked in; not as a reaction to the attack", async () => {
    const { abilitiesAtWindow, windowSubject } = await import("../../module/rules/reactions.mjs");
    await withSubjects([{ from: "emiya", id: E, state: { factionId: "A" } }], ({ world, unit }) => {
      const subject = windowSubject(unit(E), world.actor(E).items);
      const offeredAt = (window) => abilitiesAtWindow(subject, window).map((i) => i.system.contentId);
      expect(offeredAt("combatPhaseStart")).toContain("emiya-reinforcement");
      // HEAD: absent -- only Karna's Uncrowned Arms named the defender's side.
      expect(offeredAt("defendingPhaseStart")).toContain("emiya-reinforcement");
      expect(offeredAt("whenAttacked")).not.toContain("emiya-reinforcement");
    });
  });

  it("is not pressable any time in his Turn: the sheet button is refused, outside a Combat Phase start", async () => {
    await withSubjects([
      { from: "emiya", id: E, state: { factionId: "A" } },
      { from: "medea", id: "medeaWindowOnly0", state: { factionId: "A" } },
    ], ({ world, unit }) => {
      const item = abilityOf(world, E, "emiya-reinforcement");
      const gate = (ctx = {}) => canUseAbility({
        ability: usageSpecFor(item), unit: unit(E), round: 5, turnsPerRound: 3, actingFactionId: "A", ...ctx,
      });
      // HEAD: ok -- `ownTurn` was one of its windows. And after removing `ownTurn` alone it would
      // still have been ok: an ability with windows that exclude `ownTurn` had no gate at all.
      expect(gate()).toMatchObject({ ok: false, reason: "windowOnly" });
      // At the window, as the engine uses it, it is allowed.
      expect(gate({ atWindow: true }).ok).toBe(true);
    });
  });

  it("the same gate reaches every window-only ability, and a Counter is exempt", async () => {
    await withSubjects([
      { from: "medea", id: "medeaWindowOnly0", state: { factionId: "A" } },
    ], ({ world, unit }) => {
      const trofa = abilityOf(world, "medeaWindowOnly0", "medea-trofa");
      const gate = (ctx = {}) => canUseAbility({
        ability: usageSpecFor(trofa), unit: unit("medeaWindowOnly0"), round: 5, turnsPerRound: 3, ...ctx,
      });
      expect(gate()).toMatchObject({ ok: false, reason: "windowOnly" });
      expect(gate({ atWindow: true }).reason).not.toBe("windowOnly");
      expect(gate({ isCounter: true }).reason).not.toBe("windowOnly");
    });
  });

  it("an ability that also names ownTurn, or is automatic, is not window-only", async () => {
    const { usedOnlyAtWindows } = await import("../../module/rules/windows.mjs");
    expect(usedOnlyAtWindows({ timing: { window: ["ownTurn", "combatPhaseStart"] } })).toBe(false);
    expect(usedOnlyAtWindows({ timing: { window: "ownTurn" } })).toBe(false);
    expect(usedOnlyAtWindows({ timing: { window: "automatic" } })).toBe(false);
    expect(usedOnlyAtWindows({ timing: null })).toBe(false);
    expect(usedOnlyAtWindows({ timing: { window: ["combatPhaseStart", "defendingPhaseStart"] } })).toBe(true);
  });
});

describe("Reinforcement lasts that Combat Phase only (#208 reading 9, ruled 2026-10-14)", () => {
  it("applies N.Atk Up until the Combat Phase ends, not for a third of a Round", () => {
    const doc = ability("emiya-reinforcement");
    expect(doc.timing).toEqual({ window: ["combatPhaseStart", "defendingPhaseStart"] });
    expect(doc.phases[0].effects[0]).toMatchObject({ id: "nAtkUp", magnitude: 30, duration: "until combatPhaseEnd" });
  });
});

/* ========================================================================== */
/*  Reading 14 -- Range Up (Hawkeye) is its own effect (#215)                   */
/* ========================================================================== */

describe("Range Up (Hawkeye) is its own effect, and stacks with another Range Up (#208 reading 14, ruled 2026-10-14)", () => {
  it("Magecraft applies it and not Range Up", () => {
    const handler = ability("emiya-magecraft").passiveRules[0];
    // HEAD: `rangeUp`, the effect Kiritsugu's Familiars also applies: one shared instance.
    expect(handler.then[0].effect.id).toBe("rangeUpHawkeye");
    expect(ability("emiya-magecraft").description).toContain("@effect[rangeUpHawkeye]");
  });

  it("with Range Up (+2) and Range Up (Hawkeye) (+1) held, his Range is 4 + 2 + 1", async () => {
    await withSubjects([
      { from: "emiya", id: E, state: { factionId: "A" },
        effects: [{ defId: "rangeUp", magnitude: 2 }, { defId: "rangeUpHawkeye", magnitude: 1 }] },
    ], ({ unit }) => {
      // HEAD: 6 -- `rangeUpHawkeye` is no effect there.
      expect(unit(E).range).toBe(7);
    });
  });

  it("reapplying it extends its own clock and leaves the other Range Up's alone", async () => {
    await withSubjects([
      { from: "emiya", id: E, state: { factionId: "A" }, panel: { i: 5, j: 5 },
        effects: [{ defId: "rangeUp", magnitude: 2, expiry: 8 }, { defId: "rangeUpHawkeye", magnitude: 1, expiry: 9 }] },
    ], async ({ world: w }) => {
      const { fireAbilityUsed } = await import("../../module/engine/skill-use.mjs");
      // A Thaumaturgy Spell used: Magecraft's rider, for 1◈ (3 ticks).
      await fireAbilityUsed(w.actor(E), abilityOf(w, E, "emiya-reinforcement"));
      expect(held(w, E, "rangeUpHawkeye")).toHaveLength(1);
      expect(held(w, E, "rangeUpHawkeye")[0].system.expiry).toBe(12);
      // HEAD: the shared `rangeUp` took the extension (8 + 3) and the Kiritsugu-style +2 grew with it.
      expect(held(w, E, "rangeUp")).toHaveLength(1);
      expect(held(w, E, "rangeUp")[0].system.expiry).toBe(8);
    }, OWN_TURN);
  }, 60_000);
});
