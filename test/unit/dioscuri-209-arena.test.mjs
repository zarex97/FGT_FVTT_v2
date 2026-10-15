/**
 * The Dioscuri audit (#209), played in the arena: a Combat Process, a Skill use
 * and a Turn boundary on a modelled world, the way the table presses them.
 * The projection-level halves are in `dioscuri-209-rulings.test.mjs`.
 * @see docs/46-roster-re-audit.md §46.31
 */
import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { playAttack } from "../helpers/process.mjs";
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
