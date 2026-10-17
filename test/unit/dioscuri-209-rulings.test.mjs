/**
 * The Dioscuri audit, #209: the readings ruled on 2026-10-14 that differ from
 * what was built (#218 to #223). Each describe names its reading; Ch. 46 §46.31
 * holds the record. The Combat Process halves are in `dioscuri-209-arena.test.mjs`.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { twinSpecs, CASTOR, POLLUX } from "../helpers/dioscuri.mjs";
import { loadSource } from "../../tools/lib/load.mjs";
import { validateAll, phaseEffects, PHASE_ACTIONS_STILL_DROPPED } from "../../tools/lib/content.mjs";
import { loadAssets } from "../../tools/lib/load.mjs";
import { unitImages } from "../../tools/lib/content.mjs";
import { publicNameOf } from "../../module/rules/identity.mjs";
import {
  CORE_CLASSES, EXTRA, candidatesFor, catalogueEntryOf,
} from "../../module/rules/war-setup.mjs";
import { fireEvent, advanceCooldowns, pendingRolls } from "../../module/engine/scheduler.mjs";
import { sharedAcrossGroup, sharedCooldownIntents } from "../../module/engine/cooldown.mjs";
import { computeDamage } from "../../module/rules/damage/pipeline.mjs";
import { GENERATED_EMITTABLE } from "../../module/rules/facets.mjs";
import { canUseAbility } from "../../module/rules/costs.mjs";
import { counterOffer } from "../../module/rules/counter.mjs";
import { usageSpecFor, targetSpecFor } from "../../module/rules/ability-use.mjs";
import { validate } from "../../module/rules/targeting/resolve.mjs";
import { critChance } from "../../module/rules/checks.mjs";
import { rollOptionsFor } from "../../module/rules/options.mjs";
import { installClientNamespace } from "../helpers/client-namespace.mjs";

beforeAll(prepareSubjects, 120_000);

/** The real twins, projected the way a live board projects them. */
const twins = (fn, specs = [{ from: "castor" }, { from: "pollux" }], opts = {}) =>
  withSubjects(specs, fn, opts);

/** One of a Subject's abilities, by content id. */
const abilityOf = (world, actorId, contentId) =>
  world.actor(actorId).items.find((i) => i.system?.contentId === contentId);

const FOE = "foeOfTheTwins000";

/* ========================================================================== */
/*  Readings 1, 8, 9 -- Pollux is a Saber, and the pair takes a Saber slot     */
/* ========================================================================== */

describe("Pollux is a Saber and Castor stays an Avenger (#209 reading 1, ruled 2026-10-14)", () => {
  it("projects Pollux's class as Saber and Castor's as Avenger", async () => {
    await twins(({ unit }) => {
      // RED before #218: Pollux read ["avenger"] (Appendix D marked it INFERRED).
      expect([...unit("pollux").servantClasses]).toEqual(["saber"]);
      expect([...unit("castor").servantClasses]).toEqual(["avenger"]);
    });
  });
});

describe("the pair fits a Saber slot only (#209 reading 8, ruled 2026-10-14)", () => {
  /**
   * The catalogue as the picker builds it: one compendium index entry per
   * Servant, carrying only the fields `servantCatalogue` asked the index for.
   * The twins' entries are cut from the real projected documents.
   */
  const fakePack = (world, ids) => ({
    collection: "fgt.servants",
    metadata: { type: "Actor", label: "Servants", collection: "fgt.servants" },
    getIndex: async ({ fields }) => ids.map((id) => {
      const source = world.actor(id)._source;
      const entry = { _id: id, name: source.name, img: source.img, type: source.type };
      for (const path of fields) {
        const value = foundry.utils.getProperty(source, path);
        if (value !== undefined) foundry.utils.setProperty(entry, path, value);
      }
      return entry;
    }),
  });

  /** The catalogue the setup wizard offers, through the real `servantCatalogue`. */
  const catalogueOf = async (world, ids) => {
    const { servantCatalogue } = await import("../../module/engine/summon.mjs");
    game.packs = [fakePack(world, ids)];
    return servantCatalogue();
  };

  const roster = (catalogue, classContainer) =>
    candidatesFor({ classContainer }, catalogue, {});

  it("lists Pollux in the Saber container and nobody else's container", async () => {
    await twins(async ({ world }) => {
      const catalogue = await catalogueOf(world, ["castor", "pollux"]);
      expect(roster(catalogue, "saber")).toEqual(["pollux"]);
      // RED before #218: Extra listed both (an Avenger holds no core class).
      expect(roster(catalogue, EXTRA)).toEqual([]);
      // Castor holds the Avenger class and is still never drawn alone.
      expect(roster(catalogue, "avenger")).toEqual([]);
      for (const container of CORE_CLASSES.filter((c) => c !== "saber")) {
        expect(roster(catalogue, container), container).toEqual([]);
      }
    });
  });

  it("marks only Castor as the companion: the one who sits in his partner's slot", async () => {
    await twins(async ({ world }) => {
      const catalogue = await catalogueOf(world, ["castor", "pollux"]);
      const byId = Object.fromEntries(catalogue.map((e) => [e.contentId, e]));
      expect(byId.castor).toMatchObject({ summonTogether: true, companion: true, classContainer: "saber" });
      expect(byId.pollux).toMatchObject({ summonTogether: true, companion: false, classContainer: "saber" });
    });
  });

  it("keeps every other Servant as it was: a lone Avenger is still an Extra candidate", () => {
    // The companion is a role of the relationship (summoned together, seated in
    // the partner's slot), not of the class: nothing else changes slot.
    const lone = catalogueEntryOf({
      name: "Lone", system: { contentId: "lone", servantClasses: ["avenger"], classContainer: "avenger" },
    });
    expect(lone.companion).toBe(false);
    expect(candidatesFor({ classContainer: EXTRA }, [lone], {})).toEqual(["lone"]);
    expect(candidatesFor({ classContainer: "avenger" }, [lone], {})).toEqual(["lone"]);
  });

  it("asks the index for the fields the companion rule reads", async () => {
    await twins(async ({ world }) => {
      const asked = [];
      game.packs = [{
        ...fakePack(world, ["castor"]),
        getIndex: async ({ fields }) => { asked.push(...fields); return []; },
      }];
      const { servantCatalogue } = await import("../../module/engine/summon.mjs");
      await servantCatalogue();
      expect(asked).toEqual(expect.arrayContaining([
        "system.servantClasses", "system.classContainer", "system.linkedGroup.summonTogether",
      ]));
    });
  });
});

describe("an enemy sees Saber on both twins before the True Names are revealed (#209 reading 9, ruled 2026-10-14)", () => {
  it("names both Saber while unrevealed, and by their names once revealed", async () => {
    await twins(({ unit, board }) => {
      // RED before #218: "Avenger" on both.
      expect(publicNameOf(unit("castor"), board)).toBe("Saber");
      expect(publicNameOf(unit("pollux"), board)).toBe("Saber");
    }, [{ from: "castor", state: { factionId: "A" } }, { from: "pollux", state: { factionId: "A" } }]);

    await twins(({ unit, board }) => {
      expect(publicNameOf(unit("castor"), board)).toBe("Castor");
      expect(publicNameOf(unit("pollux"), board)).toBe("Pollux");
    }, [{ from: "castor", state: { identityRevealed: true } }, { from: "pollux", state: { identityRevealed: true } }]);
  });

  it("gives both the Saber class image as their token until revealed", async () => {
    const { files } = await loadSource("packs/_source");
    const { assets } = await loadAssets("assets");
    for (const id of ["castor", "pollux"]) {
      const doc = files.find((f) => f.doc?.id === id).doc;
      // RED before #218: classes/avenger.webp.
      expect(unitImages(doc, "servants", "servant", assets).defaultImage, id).toMatch(/classes\/saber\.webp$/);
    }
  });
});

/* ========================================================================== */
/*  Finding §46.4-D3 -- the second twin of a war-setup slot is a full member    */
/* ========================================================================== */

describe("a war built by the wizard seats both twins (#218, finding §46.4-D3)", () => {
  // `commitWar` filled a slot with `commitSummon`, which summons the partner
  // with no Master and no faction, then wrote the faction, the Contract and the
  // token of the PRIMARY alone: the second twin of every war-setup pair stood
  // on no side, under no Master, off the board. Only the Dioscuri summon
  // together, so nothing else showed it.
  const MASTER = "masterOfTwins000";
  const container = { id: "A-saber-0", factionId: "A", classContainer: "saber" };

  /** Two summoned twins as `commitSummon` leaves them: cross-linked, no Master, no faction. */
  const summoned = async () => [
    ...(await twinSpecs({ faction: null, castor: { state: { contract: "free" } }, pollux: { state: { contract: "free" } } })),
    { from: "master-advanced", id: MASTER, state: { factionId: "A" } },
  ];

  it("gives the partner the primary's faction, slot and Master", async () => {
    await withSubjects(await summoned(), async ({ world }) => {
      const { seatPartners } = await import("../../module/engine/war-setup.mjs");
      // The primary is drawn into the container, as `commitWar` does.
      const seated = await seatPartners(world.actor(POLLUX), container, world.actor(MASTER));
      expect(seated.map((a) => a.id)).toEqual([CASTOR]);

      const castor = world.actor(CASTOR);
      expect(castor.system.factionId).toBe("A");
      expect(castor.system.classContainer).toBe("saber");
      expect(castor.system.contract).toBe("contracted");
      expect(castor.system.masterId).toBe(MASTER);
      // The Master's roster is the other half of the Contract (`setContract`).
      expect([...world.actor(MASTER).system.servantIds]).toContain(CASTOR);
    });
  });

  it("seats nobody for a Servant summoned alone", async () => {
    await withSubjects([
      { from: "karna", id: "karnaAlone000000", state: { factionId: "A" } },
      { from: "master-advanced", id: MASTER, state: { factionId: "A" } },
    ], async ({ world }) => {
      const { seatPartners } = await import("../../module/engine/war-setup.mjs");
      expect(await seatPartners(world.actor("karnaAlone000000"), container, world.actor(MASTER))).toEqual([]);
    });
  });
});

describe("a war built by the wizard puts both twins on the board (#218, finding §46.4-D3)", () => {
  const draft = { warType: "holyGrailWar", boardSize: 13, homeBaseDepth: 2 };
  const roster = [{ id: "A", name: "Red" }, { id: "B", name: "Blue" }];
  const stand = (id, factionId) => ({
    id, system: { factionId },
    getTokenDocument: async ({ x, y }) => ({ toObject: () => ({ actorId: id, x, y }) }),
  });

  it("deploys the partner beside the primary, inside the leash of 2", async () => {
    const { deployTokens } = await import("../../module/engine/war-setup.mjs");
    const made = [];
    const scene = { grid: { size: 100 }, createEmbeddedDocuments: async (_, data) => { made.push(...data); } };
    await deployTokens(
      scene, draft, roster,
      [stand("masterA", "A")], [stand("pollux", "A")], [[stand("castor", "A")]],
    );
    const at = (id) => {
      const t = made.find((m) => m.actorId === id);
      return t ? { i: t.y / 100, j: t.x / 100 } : null;
    };
    expect(made.map((m) => m.actorId).sort()).toEqual(["castor", "masterA", "pollux"]);
    const cheb = (a, b) => Math.max(Math.abs(a.i - b.i), Math.abs(a.j - b.j));
    // RED before the fix: no token at all for the partner.
    expect(cheb(at("castor"), at("pollux"))).toBeLessThanOrEqual(2);
    // Directly next to each other: the joint NP's condition.
    expect(cheb(at("castor"), at("pollux"))).toBe(1);
    const panels = made.map((m) => `${m.x},${m.y}`);
    expect(new Set(panels).size, "no two tokens on one panel").toBe(3);
  });
});

/* ========================================================================== */
/*  Reading 2 -- one Cooldown clock, and a cut by either twin reaches both     */
/* ========================================================================== */

describe("the joint NP has one Cooldown clock (#209 reading 2, ruled 2026-10-14)", () => {
  beforeAll(() => installClientNamespace());

  const tickCtx = (board, extra = {}) => ({ tick: 18, turnsPerRound: 3, activeFactionId: "A", board, ...extra });
  const npOf = (u) => u.abilities.find((a) => a.isNP);
  /** The cooldown intents of a batch, as the clock they turn. */
  const cuts = (intents) => intents.filter((i) => i.t === "cooldown")
    .map(({ unitId, abilityId, ticks, mode }) => ({ unitId, abilityId, ticks, mode }));
  /** The same cut on both twins' Noble Phantasm. */
  const onBoth = (unit, ticks, mode = "reduce") => [CASTOR, POLLUX]
    .map((id) => ({ unitId: id, abilityId: npOf(unit(id)).id, ticks, mode }));
  const sorted = (rows) => [...rows].sort((a, b) => a.unitId.localeCompare(b.unitId));

  it("Self-Replenishment cuts 2 Turns off Castor's NP and Pollux's", async () => {
    await twins(({ unit, board }) => {
      const out = fireEvent("unitTurnEnd", [unit(CASTOR)], tickCtx(board));
      // RED before #219: only Castor's id.
      expect(sorted(cuts(out))).toEqual(sorted(onBoth(unit, 2)));
    }, await twinSpecs());
  });

  it("the Divine Core's 5% is one roll, and it cuts both copies or neither", async () => {
    await twins(({ unit, board }) => {
      const roll = pendingRolls(unit(CASTOR), "damageStepEnd").find((r) => r.chance === 5);
      expect(roll, "the 5% chance is rolled by the attack").toBeTruthy();
      const fire = (face) => fireEvent("damageStepEnd", [unit(CASTOR)],
        tickCtx(board, { options: new Set(["attack:kind:normal"]), rolls: { [roll.key]: face } }));
      expect(sorted(cuts(fire(1)))).toEqual(sorted(onBoth(unit, 1)));
      expect(cuts(fire(100))).toEqual([]);
    }, await twinSpecs());
  });

  it("the Castor buff cuts both copies whichever twin crits, and the reverse", async () => {
    for (const bearer of [CASTOR, POLLUX]) {
      await twins(({ unit, board }) => {
        const out = fireEvent("damageStepEnd", [unit(bearer)],
          tickCtx(board, { options: new Set(["attack:kind:normal", "attack:crit"]) }));
        expect(sorted(cuts(out)), bearer).toEqual(sorted(onBoth(unit, 1)));
      }, await twinSpecs({ castor: { effects: [{ defId: "castorBuff" }] }, pollux: { effects: [{ defId: "castorBuff" }] } }));
    }
  });

  it("Mana Burst's own cut reaches both copies (it was dropped altogether: §46.4-D1)", async () => {
    await twins(async ({ unit, board, world }) => {
      const mb = abilityOf(world, CASTOR, "dioscuri-mana-burst-castor");
      const phases = mb.system.phases.filter((p) => p.kind === "cooldown");
      expect(phases, "the tail is a cooldown phase the engine reads").toHaveLength(1);
      const { cooldownChanges } = await import("../../module/engine/skill-use.mjs");
      const out = phases.flatMap((p) => cooldownChanges(p, world.actor(CASTOR), board, mb));
      expect(sorted(cuts(out))).toEqual(sorted(onBoth(unit, 3)));
    }, await twinSpecs());
  });

  it("Pollux's Mana Burst has no such cut: she Evades instead", async () => {
    await twins(({ world }) => {
      const mb = abilityOf(world, POLLUX, "dioscuri-mana-burst-pollux");
      expect(mb.system.phases.filter((p) => p.kind === "cooldown")).toEqual([]);
    }, await twinSpecs());
  });

  it("a cut an enemy makes reaches both too (an NP Cooldown increase on Castor)", async () => {
    await twins(async ({ unit, board, world }) => {
      const { cooldownChanges } = await import("../../module/engine/skill-use.mjs");
      const out = cooldownChanges(
        { changes: [{ scope: "np", ticks: "1◈", direction: "up", unit: "target" }] },
        world.actor(FOE), board, null, world.actor(CASTOR),
      );
      expect(sorted(cuts(out))).toEqual(sorted(onBoth(unit, 3, "increase")));
    }, [...await twinSpecs(), { from: "heracles", id: FOE, state: { factionId: "B" } }]);
  });

  it("an ungrouped Servant has no twin to mirror onto", async () => {
    await withSubjects([{ from: "karna", id: "karnaAlone000000" }], ({ unit, board }) => {
      const karna = unit("karnaAlone000000");
      const intent = { t: "cooldown", unitId: karna.id, abilityId: npOf(karna).id, ticks: 3, mode: "reduce" };
      expect(sharedCooldownIntents([intent], karna, board)).toEqual([]);
    });
  });

  it("only mirrors what the group shares by name: Mad Enhancement has no twin", async () => {
    await twins(({ unit, board }) => {
      const castor = unit(CASTOR);
      const mad = castor.abilities.find((a) => a.contentId === "class-mad-enhancement");
      expect(mad, "Castor holds Mad Enhancement").toBeTruthy();
      const intent = { t: "cooldown", unitId: CASTOR, abilityId: mad.id, ticks: 3, mode: "reduce" };
      expect(sharedCooldownIntents([intent], castor, board)).toEqual([]);
      // ...and a Skill both hold mirrors by name, in the same mode.
      const burst = castor.abilities.find((a) => a.contentId === "dioscuri-mana-burst-castor");
      const twin = unit(POLLUX).abilities.find((a) => a.contentId === "dioscuri-mana-burst-pollux");
      const cut = { t: "cooldown", unitId: CASTOR, abilityId: burst.id, ticks: 1, mode: "increase" };
      expect(sharedCooldownIntents([cut], castor, board)).toEqual([{ ...cut, unitId: POLLUX, abilityId: twin.id }]);
    }, await twinSpecs());
  });

  it("keeps mirroring a use by name, as it always did (`sharedAcrossGroup`)", async () => {
    await twins(({ unit, board }) => {
      const castor = unit(CASTOR);
      const burst = castor.abilities.find((a) => a.contentId === "dioscuri-mana-burst-castor");
      const twin = unit(POLLUX).abilities.find((a) => a.contentId === "dioscuri-mana-burst-pollux");
      expect(sharedAcrossGroup([{ actorId: CASTOR, abilityId: burst.id, ticks: 8 }], castor, board))
        .toEqual([{ actorId: POLLUX, abilityId: twin.id, ticks: 8 }]);
    }, await twinSpecs());
  });
});

describe("the joint NP's clock turns as one at the end of every Turn (#209 reading 2, decision of 2026-10-15)", () => {
  // Both copies tick every Turn, so they stay equal -- until an effect on ONE
  // twin speeds the NP up or slows it down and cuts that twin's copy alone.
  // The pair's clock ticks as one unit holding what either holds.
  const npOf = (u) => u.abilities.find((a) => a.isNP);
  const MATCH = { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18 }, actingFactionId: "A" } };
  const byUnit = (a, b) => a.unitId.localeCompare(b.unitId);

  /**
   * The pair side by side with both NP clocks at 18 and `over` put on each
   * twin; what the Turn boundary at `tick` turns on the two NP copies.
   *
   * @returns {Promise<Array<{unitId: string, ticks: number, mode: string}>>}
   */
  const turned = async (over, tick) => withSubjects(await twinSpecs({
    castor: { panel: { i: 5, j: 5 }, ...(over.castor ?? {}) },
    pollux: { panel: { i: 5, j: 6 }, ...(over.pollux ?? {}) },
  }), async ({ world: w }) => {
    for (const id of [CASTOR, POLLUX]) await abilityOf(w, id, "dioscuri-tyndaridae").update({ "system.cooldown.remaining": 18 });
    const { currentBoard } = await import("../../module/engine/board.mjs");
    const units = currentBoard().units.filter((u) => [CASTOR, POLLUX].includes(u.id));
    const clocks = new Set(units.map((u) => npOf(u).id));
    return advanceCooldowns(units, { tick, turnsPerRound: 3 })
      .filter((i) => i.t === "cooldown" && clocks.has(i.abilityId))
      .map(({ unitId, ticks, mode }) => ({ unitId, ticks, mode }))
      .sort(byUnit);
  }, MATCH);
  /** The same turn on both copies. */
  const both = (ticks, mode = "reduce") => [CASTOR, POLLUX].map((unitId) => ({ unitId, ticks, mode })).sort(byUnit);

  it("takes 1 Turn off both copies a Turn when nothing acts on it", async () => {
    expect(await turned({}, 18)).toEqual(both(1));
  });

  it("NP Regen on Castor takes the extra Turn off Pollux's copy too", async () => {
    // RED before #219: Castor's copy fell by 2 and Pollux's by 1.
    expect(await turned({ castor: { effects: [{ defId: "npCooldownRegen" }] } }, 18)).toEqual(both(2));
  });

  it("NP Lag on Pollux halves Castor's copy too, on the Turns it halves", async () => {
    const lagged = { pollux: { effects: [{ defId: "npLag" }] } };
    expect(await turned(lagged, 18)).toEqual(both(1));
    // RED before #219: Castor's copy still fell on the odd Turn.
    expect(await turned(lagged, 19)).toEqual([]);
  });

  it("NP Lock on Castor stops Pollux's copy too", async () => {
    expect(await turned({ castor: { effects: [{ defId: "npLock" }] } }, 18)).toEqual([]);
  });

  it("Stop on either twin freezes the clock for both", async () => {
    expect(await turned({ pollux: { effects: [{ defId: "stop" }] } }, 18)).toEqual([]);
  });
});

/* ========================================================================== */
/*  Finding §46.4-D1 -- a rule element in an applyEffects phase is dropped      */
/* ========================================================================== */

describe("the build refuses a rule element in an applyEffects phase (§46.4-D1)", () => {
  /** The real corpus, as the validator reads it. */
  const corpus = async () => (await loadSource("packs/_source")).files;
  const REASON = /is the rule element "CooldownDelta" in an applyEffects phase/;

  it("names Castor's old Mana Burst tail, and passes the one that is a cooldown phase", async () => {
    const files = await corpus();
    expect(validateAll(files).problems.filter((p) => REASON.test(p))).toEqual([]);

    // Put the tail back as it was authored before #219.
    const old = files.map((f) => {
      if (f.doc?.id !== "dioscuri-mana-burst-castor") return f;
      const phases = f.doc.phases.map((p) => (p.kind === "cooldown"
        ? { kind: "applyEffects", target: "self", rules: [{ key: "CooldownDelta", scope: "np", ticks: "1◈" }] }
        : p));
      return { ...f, doc: { ...f.doc, phases } };
    });
    const problems = validateAll(old).problems.filter((p) => REASON.test(p));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/dioscuri-mana-burst-castor\.yml/);
  });

  it("is only ever told of Jabberwock's Alice Eater, and the list only shrinks", async () => {
    // The one Clause of this kind still dropped: a stay-extension needs a phase
    // kind of its own. Lower this when it is built.
    expect(PHASE_ACTIONS_STILL_DROPPED.length).toBeLessThanOrEqual(1);
    const files = await corpus();
    for (const d of PHASE_ACTIONS_STILL_DROPPED) {
      const doc = files.find((f) => f.doc?.id === d.id)?.doc;
      expect(doc, `${d.id} is a file in the corpus`).toBeTruthy();
      // Stale once it is anything but an id-less rule element in such a phase.
      const stillDropped = phaseEffects(doc).some(([, spec]) => spec.key === d.key && !spec.id && !spec.effect);
      expect(stillDropped, `${d.id} ${d.key} is still dropped`).toBe(true);
    }
  });

  it("finds no other id-less rule element in any applyEffects phase of the corpus", async () => {
    const all = [];
    for (const { path, doc } of await corpus()) {
      for (const [where, spec] of phaseEffects(doc)) {
        if (!(spec.effect?.id ?? spec.effect?.defId ?? spec.id ?? spec.defId) && spec.key) all.push(`${path} ${where} ${spec.key}`);
      }
    }
    expect(all.map((s) => s.replaceAll("\\", "/"))).toEqual([
      "packs/_source/abilities/jabberwock-alice-eater.yml phases[1].rules[0] DurationDelta",
    ]);
  });
});

describe("Self-Replenishment REDUCES the NP clock by 2 Turns (§46.4-D4, found while building #219)", () => {
  beforeAll(() => installClientNamespace());

  it("its projected CooldownDelta carries the rank table's 2 as a reduction", async () => {
    await twins(({ unit, board }) => {
      const out = fireEvent("unitTurnEnd", [unit(CASTOR)], { tick: 18, turnsPerRound: 3, activeFactionId: "A", board });
      const mine = out.filter((i) => i.t === "cooldown" && i.unitId === CASTOR);
      // RED before #219: `mode: "set", ticks: 0` -- the table's `amount` and `direction` met
      // neither `ticks` nor `delta`, so the Noble Phantasm's clock was WIPED at every Turn end.
      expect(mine).toEqual([expect.objectContaining({ mode: "reduce", ticks: 2 })]);
    }, await twinSpecs());
  });
});

/* ========================================================================== */
/*  Reading 3 -- the fact the halving reads: the attack's Base Attack uses MAG  */
/* ========================================================================== */

describe("`attack:usesBase:mag` is the attack's base, not the component it declares (#209 reading 3)", () => {
  /** Mad Enhancement's predicated pair, as the shared template authors it (Rank B-: 55, halved 25). */
  const madEnhancement = [
    { key: "atkUp", value: 55, source: "Mad Enhancement", predicate: ["not:attack:usesBase:mag"] },
    { key: "atkUp", value: 25, source: "Mad Enhancement", predicate: ["attack:usesBase:mag"] },
  ];
  const hit = (sources, component) => computeDamage({
    attacker: {
      id: "castor", baseAttack: { str: 150, mag: 150 }, abilities: [],
      modifiers: madEnhancement.map((m) => ({ ...m, direction: "dealt" })),
    },
    defender: { id: "foe", modifiers: [] },
    base: { sources },
    component,
    attack: { kind: "normal", component },
    options: new Set([`attack:component:${component}`]),
    rolls: { attackMinus: 0 },
  });
  const offence = (r) => r.breakdown.find((s) => s.name === "combinedPercent")
    .contributors.filter((c) => c.value > 0).map((c) => c.value);
  const str = { unit: "self", component: "str", factor: 1 };
  const mag = { unit: "self", component: "mag", factor: 1 };

  it("is emittable, so a predicate may name it", () => {
    expect(GENERATED_EMITTABLE.some((r) => r.test("attack:usesBase:mag"))).toBe(true);
    expect(GENERATED_EMITTABLE.some((r) => r.test("attack:usesBase:str"))).toBe(true);
    expect(GENERATED_EMITTABLE.some((r) => r.test("attack:usesBase:agi"))).toBe(false);
  });

  it("halves an attack whose base has a BA(MAG) source, whatever component it declares", () => {
    // Mana Burst: BA(STR) + BA(MAG), declared `component: str` on purpose.
    expect(offence(hit([str, mag], "str"))).toEqual([25]);
  });

  it("keeps the full figure for a STR base, and halves a MAG one as it always did", () => {
    expect(offence(hit([str], "str"))).toEqual([55]);
    expect(offence(hit([mag], "mag"))).toEqual([25]);
  });

  it("reads the base the stage added up: a MAG source worth nothing does not halve", () => {
    expect(offence(hit([str, { ...mag, factor: 0 }], "str"))).toEqual([55]);
  });

  it("changes no attack of the six bearers but Castor's Mana Burst", async () => {
    // The sweep behind that claim: of every damage block in the corpus, the ones
    // whose base uses BA(MAG) while declaring another component. Only Castor holds
    // Mad Enhancement among them (Raikou's Mana Burst refuses under it).
    const { files } = await loadSource("packs/_source");
    const blocks = (d) => [d.damage, ...(d.damage?.instances ?? []), ...(d.damage?.branches ?? [])].filter(Boolean);
    const differs = files.flatMap(({ doc }) => blocks(doc).flatMap((b) => {
      const sources = b.base?.sources ?? (b.component ? [{ component: b.component, factor: 1 }] : []);
      const usesMag = sources.some((s) => s.component === "mag" && (s.factor ?? 1) > 0);
      return usesMag !== ((b.component ?? sources[0]?.component) === "mag") ? [doc.id] : [];
    })).sort();
    // Arturia's Mana Burst joined the sweep (#230): BA(STR) + BA(MAG), declared
    // `component: str` like Karna's. She holds no Mad Enhancement, so the
    // assertions below are unchanged.
    // Arjuna's Mana Burst joined it (#234): Karna's combined base, declared
    // `component: str`. He holds no Mad Enhancement.
    expect(differs).toEqual([
      "arjuna-mana-burst-flames",
      "arturia-mana-burst",
      "dioscuri-mana-burst-castor", "dioscuri-mana-burst-pollux", "karna-mana-burst-flames",
      "mannanan-hallowed-sea-gods-sword", "quetz-xiuhcoatl", "raikou-mana-burst-lightning",
    ]);
    const bearers = files.filter(({ doc }) => (doc.abilities ?? []).some((a) => a?.ref === "class-mad-enhancement"))
      .map(({ doc }) => doc.id).sort();
    expect(bearers).toEqual(["asterios", "castor", "heracles", "kingprotea", "penthesilea", "raikou"]);
    const held = new Set(files.filter(({ doc }) => bearers.includes(doc.id)).flatMap(({ doc }) => (doc.abilities ?? []).map((a) => a?.ref)));
    // Of the six, one is held by a bearer; Raikou's refuses under Mad Enhancement.
    expect([...held].filter((id) => differs.includes(id)).sort())
      .toEqual(["dioscuri-mana-burst-castor", "raikou-mana-burst-lightning"]);
  });
});

/* ========================================================================== */
/*  Reading 4 -- Mana Burst is offered on a Counter (already built; pinned)     */
/* ========================================================================== */

describe("both twins' Mana Burst is offered on a Counter, and only a Counter lifts the own-Turn window (#209 reading 4)", () => {
  const gate = (item, unit, ctx = {}) => canUseAbility({
    ability: usageSpecFor(item), unit, round: 5, turnsPerRound: 3, ...ctx,
  });

  it("lists it beside the Normal Attack for each twin", async () => {
    await twins(({ world }) => {
      for (const [id, contentId] of [[CASTOR, "dioscuri-mana-burst-castor"], [POLLUX, "dioscuri-mana-burst-pollux"]]) {
        const offer = counterOffer([...world.actor(id).items]);
        const mb = abilityOf(world, id, contentId);
        expect(offer.map((o) => o.id), id).toContain(mb.id);
        expect(offer[0]).toMatchObject({ isNormalAttack: true });
      }
    }, await twinSpecs());
  });

  it("is usable on the enemy's Turn as a Counter, and refused there without one", async () => {
    await twins(({ world, unit }) => {
      for (const [id, contentId] of [[CASTOR, "dioscuri-mana-burst-castor"], [POLLUX, "dioscuri-mana-burst-pollux"]]) {
        const mb = abilityOf(world, id, contentId);
        const ctx = { actingFactionId: "B" };
        // The exemption is the Counter's, not a loosened window.
        expect(gate(mb, unit(id), { ...ctx, isCounter: true }).ok, id).toBe(true);
        expect(gate(mb, unit(id), ctx), id).toMatchObject({ ok: false, reason: "notOwnTurn" });
        // ...and on its own Turn it needs no Counter.
        expect(gate(mb, unit(id), { actingFactionId: "A" }).ok, id).toBe(true);
      }
    }, await twinSpecs());
  });
});

/* ========================================================================== */
/*  Reading 6 -- the joint NP's Range: either twin within 2 of the target       */
/* ========================================================================== */

describe("the joint NP reaches a target either twin is within 2 of (#209 reading 6, ruled 2026-10-14)", () => {
  // Pollux (5,5) and Castor (5,6) side by side, as the NP requires. A foe at
  // (5,8) is 2 from Castor and 3 from Pollux; (5,9) is 3 and 4.
  const pair = async (foe, extra = {}) => [
    ...await twinSpecs({ castor: { panel: { i: 5, j: 6 } }, pollux: { panel: { i: 5, j: 5 } } }),
    { from: "heracles", id: FOE, state: { factionId: "B" }, panel: foe, ...extra },
  ];
  /** The verdict of the joint NP's own targeting, declared by `who`, against the foe. */
  const verdict = (who, specs) => withSubjects(specs, ({ unit, board, world }) => {
    const spec = targetSpecFor(abilityOf(world, who, "dioscuri-tyndaridae"), unit(who).range);
    return validate(spec, unit(who), board, { unitId: FOE, chosenIds: [FOE] });
  });

  it("lets Pollux declare it at a target only Castor is within 2 of", async () => {
    // RED before #221: "out of Range (2)" -- measured from the declarer alone.
    const out = await verdict(POLLUX, await pair({ i: 5, j: 8 }));
    expect(out.reasons).toEqual([]);
    expect(out.ok).toBe(true);
  });

  it("and the reverse: Castor declares it at a target only Pollux is within 2 of", async () => {
    const specs = [
      ...await twinSpecs({ castor: { panel: { i: 5, j: 5 } }, pollux: { panel: { i: 5, j: 6 } } }),
      { from: "heracles", id: FOE, state: { factionId: "B" }, panel: { i: 5, j: 8 } },
    ];
    expect((await verdict(CASTOR, specs)).ok).toBe(true);
  });

  it("still refuses a target 3 from both twins, in the same words", async () => {
    const out = await verdict(POLLUX, await pair({ i: 5, j: 9 }));
    expect(out.ok).toBe(false);
    expect(out.reasons.join(" ")).toMatch(/out of Range \(2\)/);
  });

  it("gives a caster with no twin no extra reach: the key finds a partner it does not have", async () => {
    // Karna borrows the joint NP's targeting from (5,12): the foe at (5,8) is 4
    // away, and the twins standing 2 and 3 from it are not HIS partners.
    const out = await withSubjects([
      ...await twinSpecs({ castor: { panel: { i: 5, j: 6 } }, pollux: { panel: { i: 5, j: 5 } } }),
      { from: "heracles", id: FOE, state: { factionId: "B" }, panel: { i: 5, j: 8 } },
      { from: "karna", id: "karnaAlone000000", state: { factionId: "A" }, panel: { i: 5, j: 12 } },
    ], ({ unit, board, world }) => {
      const spec = targetSpecFor(abilityOf(world, POLLUX, "dioscuri-tyndaridae"), 2);
      return validate(spec, unit("karnaAlone000000"), board, { unitId: FOE, chosenIds: [FOE] });
    });
    expect(out.ok).toBe(false);
    expect(out.reasons.join(" ")).toMatch(/out of Range \(2\)/);
  });

  it("keeps the key through the real compile and DataModel (a Hop of its own)", async () => {
    await twins(({ world }) => {
      for (const id of [CASTOR, POLLUX]) {
        expect(abilityOf(world, id, "dioscuri-tyndaridae").system.targeting.anchor.alsoFrom, id).toBe("partner");
      }
    }, await twinSpecs());
  });

  it("is refused by the build anywhere but a targetUnit anchor, and for anyone but the partner", async () => {
    const { files } = await loadSource("packs/_source");
    const withAnchor = (anchor) => validateAll(files.map((f) => (f.doc?.id === "dioscuri-tyndaridae"
      ? { ...f, doc: { ...f.doc, targeting: { ...f.doc.targeting, anchor } } } : f))).problems
      .filter((p) => /alsoFrom/.test(p));
    expect(withAnchor({ kind: "targetUnit", range: 2, alsoFrom: "partner" })).toEqual([]);
    expect(withAnchor({ kind: "targetUnit", range: 2, alsoFrom: "everyone" })).toHaveLength(1);
    expect(withAnchor({ kind: "withinRange", range: 2, alsoFrom: "partner" })).toHaveLength(1);
  });
});

/* ========================================================================== */
/*  Reading 10 -- the joint NP's Crit Chance combines, and reaches only an NP   */
/*  figure                                                                     */
/* ========================================================================== */

describe("the joint NP's Crit Chance is both twins', where an NP figure is stated (#209 reading 10)", () => {
  // Nothing in the Dioscuri's own kit states an NP figure for Crit Chance
  // (Oblivion Correction 15, Pollux's Divine Core 5, S.Crit Up 10: all plain), so
  // the one that does is authored here, on each twin, in the shape Crit Up (Viy)
  // authors it: *"+30%; if NP, 20%"*.
  const NP_FIGURE = {
    id: "test-crit-with-np-figure", name: "Test Crit Up", kind: "skill", passive: true,
    passiveRules: [{ key: "CritModifier", aspect: "chance", value: 30, npValue: 20 }],
  };
  /** The real twins, each carrying one extra Skill of that shape (`with` replaces the list: read it from the sheet). */
  const withNpFigure = async (which) => {
    const { files } = await loadSource("packs/_source");
    const specs = await twinSpecs();
    return specs.map((spec) => (which.includes(spec.id)
      ? { ...spec, with: { abilities: [...files.find((f) => f.doc?.id === spec.from).doc.abilities, NP_FIGURE] } }
      : spec));
  };
  /** The Crit Chance of `who` declaring the NP, or a Normal Attack, as the Attack Description hands it. */
  const chance = (who, specs) => withSubjects(specs, ({ unit }) => critChance(unit(who), null, {
    options: new Set(["attack:kind:np"]), isNP: true, alsoFrom: [unit(who === CASTOR ? POLLUX : CASTOR)],
  }));

  it("adds each twin's NP figure to the base 50", async () => {
    const out = await chance(CASTOR, await withNpFigure([CASTOR, POLLUX]));
    // RED before #221: 50 + Castor's 20 alone.
    expect(out.percent).toBe(90);
    expect(out.modifiers.map((m) => m.value).sort()).toEqual([0, 0, 20, 20].sort());
  });

  it("adds nothing for a twin whose Crit Up states no NP figure: no figure, no reach", async () => {
    // Oblivion Correction (15) and Pollux's Divine Core (5) are Crit Chance, and neither states one.
    const out = await chance(CASTOR, await twinSpecs());
    expect(out.percent).toBe(50);
    expect(out.modifiers.every((m) => m.value === 0)).toBe(true);
  });

  // Two whole worlds built in one test: about 2 s alone, and past vitest's 5 s
  // under the full suite's load on both branches (#230). The arena tests' own
  // budget, not a slower rule.
  it("counts the figure on ONE twin once, whichever of them declares", async () => {
    expect((await chance(CASTOR, await withNpFigure([POLLUX]))).percent).toBe(70);
    expect((await chance(POLLUX, await withNpFigure([POLLUX]))).percent).toBe(70);
  }, 30_000);
});

/* ========================================================================== */
/*  #223 -- Def Dwn (A) and (C): the Luck and Agility they take are for an Attack */
/* ========================================================================== */

describe("`attack:plainDamage` is how a Clause tells an Attack from measured damage (#223, §46.4-D2)", () => {
  it("is emittable, so a predicate may name it", () => {
    expect(GENERATED_EMITTABLE.some((r) => r.test("attack:plainDamage"))).toBe(true);
  });

  it("is emitted for a Process opened to measure damage, and for no other", () => {
    const attacker = { id: "a", kind: "servant", effects: [], abilities: [], attributes: [] };
    const defender = { id: "d", kind: "servant", effects: [], abilities: [], attributes: [] };
    const options = (attack) => rollOptionsFor({ attacker, defender, attack: { kind: "normal", ...attack } });
    expect(options({ plainDamage: true }).has("attack:plainDamage")).toBe(true);
    expect(options({ plainDamage: false }).has("attack:plainDamage")).toBe(false);
    expect(options({}).has("attack:plainDamage")).toBe(false);
  });

  it("is stamped on the declaration from the placement that asks for plain damage", async () => {
    await twins(async ({ world }) => {
      const { buildAttackSpec } = await import("../../module/engine/attack.mjs");
      const castor = game.actors.get(CASTOR);
      const spec = (placement) => buildAttackSpec({
        attacker: castor, ability: null, abilityId: null, options: new Set(), placement, board: null,
      });
      expect(spec({ pathTargets: [FOE], plainDamage: true }).plainDamage).toBe(true);
      expect(spec({ unitId: FOE }).plainDamage).toBe(false);
      expect(spec(null).plainDamage).toBe(false);
      void world;
    }, await twinSpecs());
  });

  it("is what gates the Luck and the Agility of Def Dwn (A) and (C), and only those drains in the corpus", async () => {
    const { files } = await loadSource("packs/_source");
    const drains = [];
    for (const { path, doc } of files) {
      for (const rule of doc.rules ?? []) {
        if (rule.key !== "OnEvent" || ![rule.event].flat().includes("damageTaken")) continue;
        for (const action of rule.then ?? []) {
          // A DRAIN: a restore on taking damage -- Avalon's, inside a Master
          // (#230) -- is not one.
          if (action.key === "StatDelta" && /^(luck|agility)\.value$/.test(action.stat) && !(action.delta > 0)) {
            drains.push({ id: doc.id, stat: action.stat, predicate: rule.predicate ?? [], path });
          }
        }
      }
    }
    // Two handlers, each with the gate; a third, or one without it, is a new Silent Drop of #223's kind.
    expect(drains.map(({ id, stat, predicate }) => ({ id, stat, predicate }))).toEqual([
      { id: "defDwnA", stat: "luck.value", predicate: ["not:attack:plainDamage"] },
      { id: "defDwnC", stat: "agility.value", predicate: ["not:attack:plainDamage"] },
    ]);
  });

  it("is inherited by every Servant who inflicts them: they apply the effects, none restates the drain", async () => {
    const { files } = await loadSource("packs/_source");
    const inflictors = files.filter(({ dir, doc }) => dir === "abilities" && JSON.stringify(doc.phases ?? []).match(/defDwn[AC]/))
      .map(({ doc }) => doc.id).sort();
    expect(inflictors).toEqual([
      "anastasia-snegleta", "dioscuri-tyndaridae", "gogh-het-gele-huis", "gogh-the-yellow-house",
      "hassan-zabaniya-delusional-illusion", "mannanan-fragarach-counter",
    ]);
  });
});
