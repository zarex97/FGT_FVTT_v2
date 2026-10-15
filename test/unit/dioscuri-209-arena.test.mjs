/**
 * The Dioscuri audit (#209), played in the arena: a Combat Process, a Skill use
 * and a Turn boundary on a modelled world, the way the table presses them.
 * The projection-level halves are in `dioscuri-209-rulings.test.mjs`.
 * @see docs/46-roster-re-audit.md §46.31
 */
import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { playAttack, playProcess } from "../helpers/process.mjs";
import { twinSpecs, CASTOR, POLLUX } from "../helpers/dioscuri.mjs";

beforeAll(prepareSubjects, 120_000);

const FOE = "foeOfTheTwins000";
const MATCH = { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18 }, actingFactionId: "A" } };

/** The twins side by side, and a Berserker three panels from Castor. */
const board = async (over = {}) => [
  ...await twinSpecs({ castor: { panel: { i: 5, j: 5 } }, pollux: { panel: { i: 5, j: 6 } }, ...over }),
  { from: "heracles", id: FOE, state: { factionId: "B" }, panel: { i: 5, j: 8 } },
];

/** One of a Servant's abilities by content id. */
const abilityOf = (w, actorId, contentId) => w.actor(actorId).items.find((i) => i.system?.contentId === contentId);

/** A Noble Phantasm clock on both twins, started where a real fight would have it. */
const startClocks = async (w, remaining = 18) => {
  for (const id of [CASTOR, POLLUX]) {
    await abilityOf(w, id, "dioscuri-tyndaridae").update({ "system.cooldown.remaining": remaining });
  }
};
const npClock = (w, id) => abilityOf(w, id, "dioscuri-tyndaridae").system.cooldown.remaining;

/* ========================================================================== */
/*  Reading 2 -- one Cooldown clock for the joint NP                           */
/* ========================================================================== */

describe("Mana Burst cuts the joint NP's clock, and it is one clock (#209 reading 2, found while building)", () => {
  it("Castor's Mana Burst takes 1 Turn off the NP of BOTH twins", async () => {
    await withSubjects(await board(), async ({ world: w }) => {
      await startClocks(w);
      w.answer({ title: "Mana Burst (Light/Ancient)", pick: ["self"] });
      const mb = abilityOf(w, CASTOR, "dioscuri-mana-burst-castor");
      const { declared } = await playAttack(w, {
        attacker: CASTOR, ability: mb.id, target: FOE, react: { [FOE]: ["nothing", "declined"] },
      });
      // 3 ticks a Turn at 3 Turns a Round: "1◈" is 3 ticks. RED before #219: both read 18,
      // the cut was never built (§46.4-D1).
      expect(npClock(w, CASTOR)).toBe(15);
      expect(npClock(w, POLLUX)).toBe(15);
      // ...and the card says so, once for each clock that moved.
      const lines = (w.messages.get(declared.messageId).getFlag("fgt", "effects") ?? [])
        .filter((e) => e.id === "cooldown").map((e) => e.name);
      expect(lines).toEqual([
        "Dioscures Tyndaridae: Hymn of the Divine Twins: Cooldown 18 → 15",
        "Dioscures Tyndaridae: Hymn of the Divine Twins: Cooldown 18 → 15",
      ]);
    }, MATCH);
  });
});

/* ========================================================================== */
/*  §46.4-D1 -- a cooldown cut written as a rule element in an applyEffects     */
/*  phase landed nowhere                                                       */
/* ========================================================================== */

describe("Anastasia's Shvibzik turns her NP clock by 1◈+⅔◈ (§46.4-D1, the same drop)", () => {
  const ANASTASIA = "anastasiaCaster0";

  it("takes 5 ticks off every Noble Phantasm she holds", async () => {
    await withSubjects([
      { from: "anastasia", id: ANASTASIA, state: { factionId: "A" }, panel: { i: 5, j: 5 } },
    ], async ({ world: w }) => {
      const nps = [...w.actor(ANASTASIA).items].filter((i) => i.type === "noblePhantasm" || i.system?.isNP);
      expect(nps.length, "she holds Noble Phantasms").toBeGreaterThan(0);
      for (const np of nps) await np.update({ "system.cooldown.remaining": 18 });
      const shvibzik = abilityOf(w, ANASTASIA, "anastasia-shvibzik");
      const { castSkill } = await import("../helpers/process.mjs");
      const out = await castSkill(w, { caster: ANASTASIA, ability: shvibzik.id });
      expect(out.ok).not.toBe(false);
      // 1◈+⅔◈ at 3 Turns a Round is 3 + 2 ticks.
      // RED before #219: every clock still read 18 (the cut was never built).
      expect(nps.map((np) => np.system.cooldown.remaining)).toEqual(nps.map(() => 13));
    }, MATCH);
  });
});

describe("using the joint NP starts one clock for both (#209 reading 2, ruled 2026-10-14)", () => {
  // The pair stands side by side; the foe is 2 from Castor, the NP's Range.
  const near = async () => [
    ...await twinSpecs({ castor: { panel: { i: 5, j: 5 } }, pollux: { panel: { i: 5, j: 6 } } }),
    { from: "heracles", id: FOE, state: { factionId: "B" }, panel: { i: 5, j: 7 } },
  ];

  for (const [declarer, other] of [[CASTOR, POLLUX], [POLLUX, CASTOR]]) {
    it(`${declarer === CASTOR ? "Castor" : "Pollux"} declares it and both copies read 6◈`, async () => {
      await withSubjects(await near(), async ({ world: w }) => {
        expect(npClock(w, declarer)).toBe(0);
        const np = abilityOf(w, declarer, "dioscuri-tyndaridae");
        await playAttack(w, { attacker: declarer, ability: np.id, target: FOE, react: { [FOE]: ["nothing", "declined"] } });
        expect(npClock(w, declarer)).toBe(18);
        expect(npClock(w, other)).toBe(18);
      }, MATCH);
    });
  }
});

describe("a Command Spell cools the Skill on both twins (#209 reading 2, decision of 2026-10-15)", () => {
  const MASTER = "masterOfTwins000";

  /** The reference Command Spells, loaded as `fgt.mjs` loads the pack. */
  const loadCommands = async () => {
    const { readFileSync, readdirSync } = await import("node:fs");
    const { parse } = await import("yaml");
    const { CommandSpellRegistry } = await import("../../module/rules/cs-registry.mjs");
    CommandSpellRegistry.load(readdirSync("packs/_source/command-spells").filter((f) => f.endsWith(".yml")).map((f) => {
      const y = parse(readFileSync(`packs/_source/command-spells/${f}`, "utf8"));
      return { name: y.name, system: { ...y, contentId: y.id } };
    }));
  };
  const near = async () => [
    ...await twinSpecs({
      castor: { panel: { i: 5, j: 5 }, state: { masterId: MASTER } },
      pollux: { panel: { i: 5, j: 6 }, state: { masterId: MASTER } },
    }),
    { from: "master-advanced", id: MASTER, state: { factionId: "A" }, panel: { i: 6, j: 5 } },
  ];
  const clock = (w, id) => abilityOf(w, id, "dioscuri-guardians-of-navigation").system.cooldown.remaining;

  it("Reduce Cooldown on Castor's Guardians takes 1◈ off Pollux's Guardians too", async () => {
    await loadCommands();
    await withSubjects(await near(), async ({ world: w }) => {
      await w.actor(MASTER).update({ "system.commandSpells": 3 });
      for (const id of [CASTOR, POLLUX]) await abilityOf(w, id, "dioscuri-guardians-of-navigation").update({ "system.cooldown.remaining": 9 });
      const { spendCommandSpell } = await import("../../module/engine/command-spells.mjs");
      const out = await spendCommandSpell({
        masterId: MASTER, commandId: "cs-reduce-cooldown", window: "ownTurn",
        context: { servantId: CASTOR, abilityId: abilityOf(w, CASTOR, "dioscuri-guardians-of-navigation").id },
      });
      expect(out).toMatchObject({ ok: true });
      // RED before #219: Castor's read 6 and Pollux's still 9.
      expect(clock(w, CASTOR)).toBe(6);
      expect(clock(w, POLLUX)).toBe(6);
    }, MATCH);
  });
});

/* ========================================================================== */
/*  Reading 3 -- Mad Enhancement is halved on Mana Burst, which uses BA(MAG)    */
/* ========================================================================== */

describe("Mad Enhancement is halved on Mana Burst (#209 reading 3, ruled 2026-10-14)", () => {
  const MEDEA = "medeaTarget00000";
  const near = async () => [
    ...await twinSpecs({ castor: { panel: { i: 5, j: 5 } }, pollux: { panel: { i: 5, j: 6 } } }),
    { from: "medea", id: MEDEA, state: { factionId: "B" }, panel: { i: 5, j: 7 } },
  ];

  /** What Mad Enhancement adds to an attack's damage, off the stage-4 breakdown of its card. */
  const offence = (w, declared) => {
    const result = w.messages.get(declared.messageId).getFlag("fgt", "result");
    const stage = result.breakdown.find((s) => s.name === "combinedPercent");
    return stage.contributors
      .filter((c) => c.value > 0 && /Mad Enhancement/.test(c.note ?? c.label ?? ""))
      .map((c) => c.value);
  };

  /** Castor strikes Medea with Mad Enhancement on. */
  const strike = async (ability) => {
    let out;
    await withSubjects(await near(), async ({ world: w }) => {
      await abilityOf(w, CASTOR, "class-mad-enhancement").update({ "system.active": true });
      const item = ability ? abilityOf(w, CASTOR, ability) : null;
      if (ability === "dioscuri-mana-burst-castor") w.answer({ title: "Mana Burst (Light/Ancient)", pick: ["self"] });
      const { declared } = await playAttack(w, {
        attacker: CASTOR, ability: item?.id ?? null, target: MEDEA, react: { [MEDEA]: ["nothing", "declined"] },
      });
      out = offence(w, declared);
    }, MATCH);
    return out;
  };

  it("adds +55% to a Normal Attack and to the Noble Phantasm, in full", async () => {
    expect(await strike(null)).toEqual([55]);
    expect(await strike("dioscuri-tyndaridae")).toEqual([55]);
  });

  it("adds half of it to Mana Burst, rounded down to a multiple of 5 as the template rounds (27.5 is 25)", async () => {
    // The ticket said +27.5%. The shared template floors a halved figure to a
    // multiple of 5 (`magnitudeRoundTo: 5`, Kingprotea's 85 is 40 on her sheet),
    // so Castor's 55 is 25 here: one rule, one rounding, not a rounding slot of
    // his own. RED before #220: 55, the full figure.
    expect(await strike("dioscuri-mana-burst-castor")).toEqual([25]);
  });
});

/* ========================================================================== */
/*  Reading 4 -- Mana Burst answers a Counter, as Raikou's does                 */
/* ========================================================================== */

describe("Mana Burst is a Counter too (#209 reading 4, ruled 2026-10-14: already built)", () => {
  // The ticket read "own Turn only"; the code never did. `answersACounter` takes
  // every Attack Skill, and the use gate exempts a Counter from "used during your
  // Turn" (`costs.mjs`). These play it as the table would, so it cannot regress.
  const ATTACKER = "heraclesAttacker";
  const THEIRS = { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18 }, actingFactionId: "B" } };
  const flanked = async () => [
    ...await twinSpecs({ castor: { panel: { i: 5, j: 5 } }, pollux: { panel: { i: 5, j: 6 } } }),
    { from: "heracles", id: ATTACKER, state: { factionId: "B" }, panel: { i: 5, j: 7 } },
  ];

  /**
   * Heracles swings at `who`, who answers with their Mana Burst; the Counter's
   * own Process is played out. Returns what the table sees of it.
   */
  const counterWith = async (who, contentId) => {
    let seen;
    await withSubjects(await flanked(), async ({ world: w }) => {
      await startClocks(w);
      const mb = abilityOf(w, who, contentId);
      w.answer({ title: "Mana Burst (Light/Ancient)", pick: ["self"] });
      await playAttack(w, {
        attacker: ATTACKER, target: who,
        react: { [who]: ["nothing", { event: "counter", abilityId: mb.id }] },
      });
      const process = await import("../../module/engine/combat-process.mjs");
      const counter = [...w.messages.values()].find((m) => {
        const flag = m.getFlag("fgt", "process");
        return flag && process.deserialize(flag).isCounter;
      });
      expect(counter, "the Counter opens a Process of its own").toBeTruthy();
      const state = await playProcess(w, counter.id, { [ATTACKER]: ["nothing", "declined"], [who]: ["declined"] });
      const result = counter.getFlag("fgt", "result");
      seen = {
        state,
        base: result.breakdown.find((s) => s.name === "base").contributors.map((c) => c.value),
        bonuses: result.breakdown.find((s) => s.name === "flatAttackBonuses").contributors.map((c) => c.note ?? c.label),
        lines: (counter.getFlag("fgt", "effects") ?? []).map((e) => e.id),
        clocks: [npClock(w, CASTOR), npClock(w, POLLUX)],
        evade: [...w.actor(POLLUX).effects].some((e) => e.system.defId === "evade"),
      };
    }, THEIRS);
    return seen;
  };

  it("Pollux answers Heracles with it: aimed back at him, 150 + 150, and she Evades after", async () => {
    const seen = await counterWith(POLLUX, "dioscuri-mana-burst-pollux");
    expect(seen.state).toMatchObject({ isCounter: true, attackerId: POLLUX, defenderId: ATTACKER });
    expect(seen.base).toEqual([150, 150]);
    expect(seen.evade).toBe(true);
    expect(seen.lines).toContain("blind");
  });

  it("Castor answers with it: the Avenger's +80 counts, and the Noble Phantasm's clock falls on both twins", async () => {
    const seen = await counterWith(CASTOR, "dioscuri-mana-burst-castor");
    expect(seen.state).toMatchObject({ isCounter: true, attackerId: CASTOR, defenderId: ATTACKER });
    expect(seen.base).toEqual([150, 150]);
    expect(seen.bonuses).toContain("Avenger");
    expect(seen.clocks).toEqual([15, 15]);
  });
});

/* ========================================================================== */
/*  Reading 5 -- the joint NP counts an effect held by both twins twice         */
/* ========================================================================== */

describe("an effect on both twins counts twice in the joint NP (#209 reading 5, ruled 2026-10-14: already built)", () => {
  // The ticket read the combination as a union; `pipeline.mjs#activeMods` has
  // concatenated the partner's whole bag since Ch. 41 Q12 (the author's own
  // answer: "DOUBLE-COUNTING IS INTENDED"). These play it, so it stays played.
  const near = async () => [
    ...await twinSpecs({ castor: { panel: { i: 5, j: 5 } }, pollux: { panel: { i: 5, j: 6 } } }),
    { from: "medea", id: "medeaTarget00000", state: { factionId: "B" }, panel: { i: 5, j: 7 } },
  ];

  /** The contributors of one stage of a finished attack's card, as `[value, source]`. */
  const stageOf = (w, declared, name) => w.messages.get(declared.messageId).getFlag("fgt", "result")
    .breakdown.find((s) => s.name === name).contributors.map((c) => [c.value, c.note ?? c.label]);

  /** Castor casts Guardians of Navigation (on both twins), then swings: the NP, or a Normal Attack. */
  const swing = async (ability) => {
    let out;
    await withSubjects(await near(), async ({ world: w }) => {
      const { castSkill } = await import("../helpers/process.mjs");
      await castSkill(w, { caster: CASTOR, ability: abilityOf(w, CASTOR, "dioscuri-guardians-of-navigation").id });
      const { declared } = await playAttack(w, {
        attacker: CASTOR, ability: ability ? abilityOf(w, CASTOR, ability).id : null, target: "medeaTarget00000",
        react: { medeaTarget00000: ["nothing", "declined"] },
      });
      out = { flat: stageOf(w, declared, "flatAttackBonuses"), percent: stageOf(w, declared, "combinedPercent") };
    }, MATCH);
    return out;
  };

  it("adds both Divine Cores, +160, and both Atk Ups and NP DmUps to the NP", async () => {
    const { flat, percent } = await swing("dioscuri-tyndaridae");
    expect(flat.filter(([, s]) => /Divine Core/.test(s)).map(([v]) => v)).toEqual([80, 80]);
    // Guardians reached both: the NP takes each twin's Atk Up (5 for an NP) and NP DmUp (15).
    expect(percent.filter(([, s]) => /^atkUp/.test(s)).map(([v]) => v)).toEqual([5, 5]);
    expect(percent.filter(([, s]) => /^npDmUp/.test(s)).map(([v]) => v)).toEqual([15, 15]);
  });

  it("does not combine for a Normal Attack: Castor's own Divine Core and Atk Up, once", async () => {
    const { flat, percent } = await swing(null);
    expect(flat.filter(([, s]) => /Divine Core/.test(s)).map(([v]) => v)).toEqual([80]);
    expect(percent.filter(([, s]) => /^atkUp/.test(s)).map(([v]) => v)).toEqual([15]);
  });
});

/* ========================================================================== */
/*  Reading 6 -- the joint NP is declared from either twin's reach              */
/* ========================================================================== */

describe("the joint NP is declared at a target either twin reaches (#209 reading 6, ruled 2026-10-14)", () => {
  const at = async (foe) => [
    ...await twinSpecs({ castor: { panel: { i: 5, j: 6 } }, pollux: { panel: { i: 5, j: 5 } } }),
    { from: "heracles", id: FOE, state: { factionId: "B" }, panel: foe },
  ];

  it("Pollux declares it at a foe 2 from Castor and 3 from her, and it lands", async () => {
    await withSubjects(await at({ i: 5, j: 8 }), async ({ world: w }) => {
      const { declared } = await playAttack(w, {
        attacker: POLLUX, ability: abilityOf(w, POLLUX, "dioscuri-tyndaridae").id, target: FOE,
        react: { [FOE]: ["nothing", "declined"] },
      });
      // RED before #221: the declaration was refused, "out of Range (2)".
      expect(w.messages.get(declared.messageId).getFlag("fgt", "result").total).toBeGreaterThan(0);
      expect(npClock(w, POLLUX)).toBe(18);
      expect(npClock(w, CASTOR)).toBe(18);
    }, MATCH);
  });

  it("is refused for a foe 3 from both, and nothing is spent", async () => {
    await withSubjects(await at({ i: 5, j: 9 }), async ({ world: w }) => {
      const { resolveAttack } = await import("../../module/engine/attack.mjs");
      await expect(resolveAttack({
        attackerId: POLLUX, abilityId: abilityOf(w, POLLUX, "dioscuri-tyndaridae").id,
        placement: { unitId: FOE, chosenIds: [FOE] },
      })).rejects.toThrow(/Illegal attack: .*out of Range \(2\)/);
      expect(npClock(w, POLLUX)).toBe(0);
      expect(npClock(w, CASTOR)).toBe(0);
    }, MATCH);
  });
});

/* ========================================================================== */
/*  Reading 10 -- the Crit Chance the Combat Process rolls against              */
/* ========================================================================== */

describe("the joint NP rolls its Crit against both twins' chance (#209 reading 10, ruled 2026-10-14)", () => {
  // Pollux alone holds a Crit Up that states an NP figure (+30%, NP +20%); the
  // die lands on 70. Castor's NP: 50 + Pollux's 20 = 70, a Crit. Castor's Normal
  // Attack: 50 + Oblivion Correction's 15 = 65, none -- Pollux's Crit Up is not his.
  const MEDEA = "medeaTarget00000";
  const NP_FIGURE = {
    id: "test-crit-with-np-figure", name: "Test Crit Up", kind: "skill", passive: true,
    passiveRules: [{ key: "CritModifier", aspect: "chance", value: 30, npValue: 20 }],
  };
  const swing = async (ability) => {
    const { loadSource } = await import("../../tools/lib/load.mjs");
    const { files } = await loadSource("packs/_source");
    const [castor, pollux] = await twinSpecs({
      castor: { panel: { i: 5, j: 5 } }, pollux: { panel: { i: 5, j: 6 } },
    });
    const holder = { ...pollux, with: { abilities: [...files.find((f) => f.doc?.id === "pollux").doc.abilities, NP_FIGURE] } };
    let crit;
    await withSubjects([castor, holder, { from: "medea", id: MEDEA, state: { factionId: "B" }, panel: { i: 5, j: 7 } }], async ({ world: w }) => {
      w.dice.every(70);
      const { declared } = await playAttack(w, {
        attacker: CASTOR, ability: ability ? abilityOf(w, CASTOR, ability).id : null, target: MEDEA,
        react: { [MEDEA]: ["nothing", "declined"] },
      });
      crit = w.messages.get(declared.messageId).getFlag("fgt", "result").isCrit;
    }, MATCH);
    return crit;
  };

  it("crits the NP on a 70: 50 + Pollux's NP figure", async () => {
    // RED before #221: 50 against a 70.
    expect(await swing("dioscuri-tyndaridae")).toBe(true);
  });

  it("does not crit Castor's own Normal Attack on a 70: 65, the twin's Crit Up is not his", async () => {
    expect(await swing(null)).toBe(false);
  });
});
