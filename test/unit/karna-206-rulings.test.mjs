/**
 * Karna's audit, #206: the readings ruled on 2026-10-14 that differ from what
 * was built. Each test names its reading; Ch. 46 §46.29 holds the record.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { computeDamage } from "../../module/rules/damage/pipeline.mjs";
import { Rank } from "../../module/domain/rank.mjs";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { installClientNamespace } from "../helpers/client-namespace.mjs";
import { canUseAbility } from "../../module/rules/costs.mjs";
import { usageSpecFor } from "../../module/rules/ability-use.mjs";
import { rollOptionsFor } from "../../module/rules/options.mjs";
import { test as testPredicate } from "../../module/rules/predicate.mjs";
import { resolveTargets } from "../../module/rules/targeting/resolve.mjs";
import { unmetCompulsions, canEndTurn } from "../../module/rules/budget.mjs";
import { suspendableSkills } from "../../module/rules/command-spells.mjs";
import { abilitiesAtWindow, windowSubject } from "../../module/rules/reactions.mjs";

beforeAll(prepareSubjects, 60_000);

/** One of a Subject's abilities, by slug or content id. */
const abilityOf = (world, actorId, key) =>
  world.actor(actorId).items.find((i) => i.system?.slug === key || i.system?.contentId === key);

/* ========================================================================== */
/*  Reading 10 — only the MAG share of Brahmastra Kundala meets Magic Resistance */
/* ========================================================================== */

describe("Brahmastra Kundala meets Magic Resistance with its MAG share only (#206 reading 10)", () => {
  // Already the pipeline's behaviour: stage 1 keeps the two sources apart,
  // stage 3 splits the +100 in their ratio, and stage 11 reads `s.mag` alone.
  // The issue's "today the whole damage counts as MAG" was not read off the
  // code (Surprise 2026-10-14-mr-split-already-built); these pin the ruling.
  const karna = { id: "karna", baseAttack: { str: 125, mag: 175 }, abilities: [], modifiers: [] };
  /** @param {object} magicResistance */
  const hit = (magicResistance) => computeDamage({
    attacker: karna,
    defender: { id: "foe", magicResistance, modifiers: [] },
    base: { sources: [{ unit: "self", component: "str", factor: 1 }, { unit: "self", component: "mag", factor: 1 }] },
    component: "mag",
    multiplier: 4,
    flatBonus: 100,
    attack: { kind: "np", rank: Rank.parse("A+") },
    rolls: { attackMinus: 0 },
  });

  it("halves only the 175-of-300 share, the +100 split in the same ratio", () => {
    // 300 × 4 + 100 = 1300; MAG share 1300 × 175/300 = 758.33, halved.
    const r = hit({ mode: "rankComparison", rank: Rank.parse("A"), percent: 50 });
    // The whole halved would be 650; the shares give 379 MAG and 541 STR.
    expect(r.magical).toBe(379);
    expect(r.total).toBe(920);
  });

  it("cancels only the MAG share when the Rank beats the NP's", () => {
    const r = hit({ mode: "rankComparison", rank: Rank.parse("EX"), percent: 50 });
    expect(r.magical).toBe(0);
    expect(r.total).toBe(541);
  });
});

/* ========================================================================== */
/*  Reading 6 — "All Total Fire Damage taken is reduced by 50%"                */
/* ========================================================================== */

describe("a Total Fire Damage cut is multiplied in at the end, on the Fire share (#206 reading 6)", () => {
  const cut = { key: "elementTotalDefUp", element: "fire", value: 50, npValue: 50, source: "Mana Burst (Flames)" };
  /**
   * @param {{atkUp?: number, element?: string, fraction?: number}} args
   */
  const hit = ({ atkUp = 0, element = "fire", fraction } = {}) => computeDamage({
    attacker: {
      id: "foe", baseAttack: { str: 1000, mag: 0 }, abilities: [],
      modifiers: atkUp ? [{ key: "atkUp", value: atkUp, source: "Atk Up" }] : [],
    },
    defender: { id: "karna", modifiers: [cut] },
    base: { sources: [{ unit: "self", component: "str", factor: 1 }] },
    component: "str",
    attack: { kind: "normal", element, ...(fraction ? { elementFraction: fraction } : {}) },
    rolls: { attackMinus: 0 },
  });

  it("is not cancelled by the attacker's Atk Up: 150% halved is 75%", () => {
    // As a stage-4 Ward it read +50 − 50 = ×1.00, 1000.
    expect(hit({ atkUp: 50 }).total).toBe(750);
  });

  it("cuts only the Fire half of a half-Fire attack", () => {
    expect(hit({ fraction: 0.5 }).total).toBe(750);
    expect(hit({}).total).toBe(500);
  });

  it("leaves another element alone, and says what it cut", () => {
    expect(hit({ element: "water" }).total).toBe(1000);
    const notes = hit({}).breakdown.flatMap((b) => (b.contributors ?? []).map((c) => c.note ?? ""));
    expect(notes).toContain("Mana Burst (Flames) (Total fire)");
  });
});

/* ========================================================================== */
/*  The paper trace and reading 9 — "Used during your Turn", and which Seal    */
/* ========================================================================== */

describe("his own-Turn Skills and the Activation (#206 paper trace, reading 9)", () => {
  const OWN_TURN = [
    "karna-discernment-of-the-poor", "karna-end-of-charity",
    "karna-flash-of-the-sun-god", "karna-vasavi-shakti-activation",
  ];
  const gate = (item, unit, ctx = {}) => canUseAbility({
    ability: usageSpecFor(item), unit, round: 5, turnsPerRound: 3, ...ctx,
  });

  it("refuses all four on an enemy's Turn and allows them on his", async () => {
    await withSubjects([{ from: "karna", state: { factionId: "red" } }], ({ world, unit }) => {
      for (const id of OWN_TURN) {
        const item = abilityOf(world, "karna", id);
        expect(gate(item, unit("karna"), { actingFactionId: "blue" }), id)
          .toMatchObject({ ok: false, reason: "notOwnTurn" });
        expect(gate(item, unit("karna"), { actingFactionId: "red" }).ok, id).toBe(true);
      }
    });
  });

  it("lets NP Seal stop the Activation and Skill Seal not", async () => {
    const activation = (effects) => withSubjects([{ from: "karna", state: { factionId: "red" }, effects }],
      ({ world, unit }) => gate(abilityOf(world, "karna", "karna-vasavi-shakti-activation"), unit("karna")));
    expect(await activation([{ defId: "npSeal" }]))
      .toMatchObject({ ok: false, reason: "prevented", detail: { by: "npSeal" } });
    expect((await activation([{ defId: "skillSeal" }])).ok).toBe(true);
  });
});

/* ========================================================================== */
/*  Reading 5 — Mana Burst's attack is his Normal Attack                       */
/* ========================================================================== */

describe("Mana Burst (Flames) attacks as his Normal Attack (#206 reading 5)", () => {
  it("is stamped a Normal Attack, so Vasavi Shakti's Divinity ladder hears it", async () => {
    await withSubjects(
      [{ from: "karna", panel: { i: 5, j: 5 } }, { from: "heracles", panel: { i: 5, j: 6 } }],
      async ({ unit, board, world }) => {
        installClientNamespace();
        const { buildAttackSpec } = await import("../../module/engine/attack.mjs");
        const item = abilityOf(world, "karna", "karna-mana-burst-flames");
        const declared = buildAttackSpec({
          attacker: world.actor("karna"), ability: item, abilityId: item.id,
          options: rollOptionsFor({ attacker: unit("karna"), defender: unit("heracles") }), board,
        });
        expect(declared.kind).toBe("attackSkill");
        expect(declared.asNormalAttack).toBe(true);
        const options = rollOptionsFor({ attacker: unit("karna"), defender: unit("heracles"), attack: declared });
        expect(options.has("attack:kind:normal")).toBe(true);
        // Heracles holds Divinity: the first rung of Vasavi's +30 ladder.
        expect(testPredicate(["attack:kind:normal", "target:skillRank:divinity:gte:E"], { options })).toBe(true);
        // Brahmastra is not one.
        const np = abilityOf(world, "karna", "karna-brahmastra");
        const npSpec = buildAttackSpec({
          attacker: world.actor("karna"), ability: np, abilityId: np.id, options: new Set(), board,
        });
        expect(rollOptionsFor({ attacker: unit("karna"), attack: npSpec }).has("attack:kind:normal")).toBe(false);
      },
    );
  });
});

describe("every Mana Burst attacks as its user's Normal Attack (#206, ruled 2026-10-14)", () => {
  it("Raikou's and the Dioscuri's are stamped as Karna's is", async () => {
    await withSubjects(
      [{ from: "raikou", panel: { i: 5, j: 3 } }, { from: "castor", panel: { i: 4, j: 5 } },
        { from: "pollux", panel: { i: 6, j: 5 } }, { from: "heracles", panel: { i: 5, j: 5 } }],
      async ({ unit, board, world }) => {
        installClientNamespace();
        const { buildAttackSpec } = await import("../../module/engine/attack.mjs");
        for (const [who, id] of [["raikou", "raikou-mana-burst-lightning"],
          ["castor", "dioscuri-mana-burst-castor"], ["pollux", "dioscuri-mana-burst-pollux"]]) {
          const item = abilityOf(world, who, id);
          const declared = buildAttackSpec({
            attacker: world.actor(who), ability: item, abilityId: item.id,
            options: rollOptionsFor({ attacker: unit(who), defender: unit("heracles") }), board,
          });
          expect(declared.asNormalAttack, id).toBe(true);
          const options = rollOptionsFor({ attacker: unit(who), defender: unit("heracles"), attack: declared });
          // Castor's Divine Core and the Castor and Pollux buffs read this.
          expect(options.has("attack:kind:normal"), id).toBe(true);
        }
      },
    );
  });
});

/* ========================================================================== */
/*  Readings 3 and 4 — Uncrowned Arms Mastership                               */
/* ========================================================================== */

describe("Uncrowned Arms Mastership (#206 readings 3, 4)", () => {
  it("is offered at the start of a Combat Phase he is attacked in", async () => {
    await withSubjects([{ from: "karna" }], ({ world, unit }) => {
      const subject = windowSubject(unit("karna"), world.actor("karna").items);
      const offered = abilitiesAtWindow(subject, "defendingPhaseStart").map((i) => i.system?.contentId);
      expect(offered).toEqual(["karna-uncrowned-arms-mastership"]);
    });
  });

  it("carries the two labels its opening choice offers", async () => {
    await withSubjects([{ from: "karna" }], ({ world, unit }) => {
      const item = abilityOf(world, "karna", "karna-uncrowned-arms-mastership");
      expect(item.system.openingChoice).toEqual({ off: "FGT.Karna.UncrownedEffect1", on: "FGT.Karna.UncrownedEffect2" });
      expect(unit("karna").openingChoiceDue).toBe(false);
    });
  });

  it("reads in the window as words, not as link codes (found live)", async () => {
    // The attacker's window printed "negated by @UUID[Compendium.fgt.effects.
    // Item.…]{Skill Seal}": the option's detail is the raw description.
    await withSubjects([{ from: "karna" }], async ({ world }) => {
      const { plainLinks } = await import("../../module/apps/choice-dialog.mjs");
      const raw = abilityOf(world, "karna", "karna-uncrowned-arms-mastership").system.description;
      expect(raw).toMatch(/@\w+\[[^\]]*\]\{Skill Seal\}/);
      const shown = plainLinks(raw);
      expect(shown).toMatch(/negated by Skill Seal/);
      expect(shown).not.toMatch(/@\w+\[/);
    });
  });

  it("holds the Turn while his opening choice is owed, whoever's Turn it is", async () => {
    await withSubjects([{ from: "karna", state: { factionId: "red" } }], async ({ world }) => {
      const { snapshotUnit } = await import("../../module/rules/snapshot.mjs");
      const item = abilityOf(world, "karna", "karna-uncrowned-arms-mastership");
      // Marked as the war's build marks it: the item's own id.
      await world.actor("karna").update({ "system.openingChoices.due": [item.id] });
      const karna = snapshotUnit(world.actor("karna"), {});
      expect(karna.openingChoiceDue).toBe(true);
      // No red Unit is acting: the OTHER faction's Turn, and still held.
      const verdict = canEndTurn([], { units: [karna] });
      expect(verdict.ok).toBe(false);
      expect(verdict.unmet[0]).toMatchObject({ unitId: "karna", effect: "Opening choice" });
      await world.actor("karna").update({ "system.openingChoices.due": [] });
      expect(canEndTurn([], { units: [snapshotUnit(world.actor("karna"), {})] }).ok).toBe(true);
    });
  });
});

/* ========================================================================== */
/*  Reading 2 — Fated Rivals                                                   */
/* ========================================================================== */

describe("Fated Rivals of the Mahabharata (#206 reading 2)", () => {
  /** A stand-in Arjuna, authored under the content id the passive names. */
  const ARJUNA = {
    from: {
      type: "servant", id: "arjuna", name: "Arjuna (stand-in)", trueName: "Arjuna (stand-in)",
      servantClasses: ["archer"], classContainer: "archer",
      alignment: { order: "lawful", morality: "good" }, region: ["india"],
      attributes: ["male", "servant", "earth", "humanoid"],
      parameters: { str: "B", end: "B", agi: "A", mag: "B", luc: "A" },
      baseHealth: 1000, mov: 6, range: { panels: 3, targets: 1 },
      baseAttack: { str: 125, mag: 150 }, normalAttack: { mode: "fixed", component: "str" },
      sustainability: "2◈", abilities: [],
    },
    state: { factionId: "blue" },
  };
  const scene = (arjunaAt, karnaWith = {}) => [
    { from: "karna", panel: { i: 5, j: 5 }, state: { factionId: "red" }, ...karnaWith },
    { ...ARJUNA, panel: arjunaAt },
    { from: "heracles", panel: { i: 5, j: 4 }, state: { factionId: "blue" } },
  ];

  it("binds him while Arjuna stands within his Range, and not beyond it", async () => {
    await withSubjects(scene({ i: 5, j: 7 }), ({ unit }) => {
      expect(unit("karna").compulsions.map((c) => c.id)).toEqual(["fatedRivals"]);
    });
    await withSubjects(scene({ i: 5, j: 8 }), ({ unit }) => {
      expect(unit("karna").compulsions).toEqual([]);
    });
  });

  it("measures his CURRENT Range: three panels reach Arjuna at three", async () => {
    await withSubjects(scene({ i: 5, j: 8 }, { with: { range: { panels: 3, targets: 1 } } }), ({ unit }) => {
      expect(unit("karna").compulsions.map((c) => c.id)).toEqual(["fatedRivals"]);
    });
  });

  it("lets a single-target Attack choose Arjuna only, and a Skill anybody", async () => {
    await withSubjects(scene({ i: 5, j: 7 }), ({ unit, board }) => {
      const karna = unit("karna");
      const pick = (unitId, forAttack) => resolveTargets({
        anchor: { kind: "targetUnit", range: 2 }, shape: { kind: "unit" },
        selection: { relations: ["enemy"], chooser: "chosen", count: 1 }, limits: { forAttack },
      }, karna, board, { unitId, chosenIds: [unitId] }).units.map((u) => u.unitId);
      expect(pick("arjuna", true)).toEqual(["arjuna"]);
      expect(pick("heracles", true)).toEqual([]);
      // Discernment of the Poor is not an Attack: anybody in reach.
      expect(pick("heracles", false)).toEqual(["heracles"]);
    });
  });

  it("lets an area Attack that catches Arjuna hit everyone in it, and refuses one that does not", async () => {
    await withSubjects(scene({ i: 5, j: 7 }), ({ unit, board }) => {
      const karna = unit("karna");
      const area = (panel) => resolveTargets({
        anchor: { kind: "withinRange", range: 5, metric: "chebyshev" }, shape: { kind: "square", size: 5 },
        selection: { relations: ["enemy"], chooser: "all" }, limits: { forAttack: true },
      }, karna, board, { panel });
      // A 5x5 on (5,5)'s row catches Heracles at (5,4) and Arjuna at (5,7).
      expect(area({ i: 5, j: 6 }).units.map((u) => u.unitId).sort()).toEqual(["arjuna", "heracles"]);
      // One on Heracles's side alone, columns 0-4, is refused with its reason.
      const without = area({ i: 5, j: 2 });
      expect(without.units).toEqual([]);
      expect(without.errors[0]).toMatch(/Heracles is in an area without the rival this attacker is bound to/);
    });
  });

  it("names the rival rule, not a fallen Unit, when it refuses an area (found live)", async () => {
    // Live: an area over two fallen Servants and one Master read "No legal
    // targets: Kingprotea is defeated (and 3 more excluded)".
    const fallen = { from: "medea", panel: { i: 3, j: 3 }, state: { factionId: "blue", defeated: true } };
    await withSubjects([fallen, ...scene({ i: 5, j: 7 })], ({ unit, board }) => {
      const out = resolveTargets({
        anchor: { kind: "withinRange", range: 5, metric: "chebyshev" }, shape: { kind: "square", size: 5 },
        selection: { relations: ["enemy"], chooser: "all" }, limits: { forAttack: true },
      }, unit("karna"), board, { panel: { i: 5, j: 2 } });
      expect(out.excluded.map((e) => e.reason)).toContain("defeated");
      expect(out.errors[0]).toMatch(/^No legal targets: Heracles is in an area without the rival/);
    });
  });

  it("never makes him Attack", async () => {
    await withSubjects(scene({ i: 5, j: 7 }), ({ unit, board }) => {
      const karna = unit("karna");
      const someoneAttacked = { ...unit("heracles"), factionId: "red", turnState: { attacked: true } };
      expect(unmetCompulsions([karna, someoneAttacked], board)).toEqual([]);
    });
  });

  it("is a Skill Suspend Skill may name only while it binds him", async () => {
    await withSubjects(scene({ i: 5, j: 7 }), ({ unit, world }) => {
      const fr = abilityOf(world, "karna", "karna-fated-rivals");
      expect(suspendableSkills([fr], unit("karna"))).toEqual([fr]);
    });
    await withSubjects(scene({ i: 5, j: 9 }), ({ unit, world }) => {
      const fr = abilityOf(world, "karna", "karna-fated-rivals");
      const flash = abilityOf(world, "karna", "karna-flash-of-the-sun-god");
      expect(suspendableSkills([fr, flash], unit("karna"))).toEqual([flash]);
    });
  });
});

/* ========================================================================== */
/*  Found live — his Riding unlocks its passives only on the Active's Turn      */
/* ========================================================================== */

describe("Riding's Active unlocks Double Move, Riding Attack and Passenger Seat (#206)", () => {
  it("refuses a ride without the Active and grants it with it", async () => {
    const ride = (effects) => withSubjects(
      [{ from: "karna", panel: { i: 5, j: 2 }, state: { factionId: "red" }, effects }],
      async () => {
        const { performRidingAttack } = await import("../../module/engine/riding.mjs");
        return performRidingAttack({ unitId: "karna", destination: { i: 5, j: 7 } });
      },
      {
        round: 3, tick: 9, tokens: true,
        combat: { round: 3, started: true, actingFactionId: "red", system: { globalTurn: 9 } },
        worldSettings: { noAttackRound: 1, grandOrder: false },
      },
    );
    expect(await ride([])).toMatchObject({ ok: false, reason: "notGranted" });
    expect((await ride([{ defId: "ridingActive", magnitude: 5 }])).ok).toBe(true);
  });
});

/* ========================================================================== */
/*  Found live — Skill Seal negates Uncrowned Arms Mastership's switch too      */
/* ========================================================================== */

describe("Uncrowned Arms Mastership under Skill Seal (#206 UA.seal, found live)", () => {
  it("refuses the switch as it negates the effects", async () => {
    const { canToggleMode } = await import("../../module/rules/modes.mjs");
    await withSubjects([{ from: "karna", state: { factionId: "red" }, effects: [{ defId: "skillSeal" }] }], ({ world, unit }) => {
      const ua = abilityOf(world, "karna", "karna-uncrowned-arms-mastership");
      expect(canToggleMode(ua, unit("karna"), { active: true, round: 4, ownTurn: true }))
        .toMatchObject({ ok: false, reason: "negated" });
      // Its rules contribute nothing while sealed.
      expect((unit("karna").modifiers ?? []).filter((m) => m.source === "Uncrowned Arms Mastership")).toEqual([]);
    });
    await withSubjects([{ from: "karna", state: { factionId: "red" } }], ({ world, unit }) => {
      const ua = abilityOf(world, "karna", "karna-uncrowned-arms-mastership");
      expect(canToggleMode(ua, unit("karna"), { active: true, round: 4, ownTurn: true }).ok).toBe(true);
    });
  });
});
