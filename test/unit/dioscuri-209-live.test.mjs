/**
 * The Dioscuri's audit, #209: defects the live board found (Ch. 46 §46.31).
 * The rulings themselves are in `dioscuri-209-rulings.test.mjs`.
 */
import { describe, expect, it } from "vitest";
import { validatePath } from "../../module/rules/movement.mjs";

describe("a twin held by the leash is told so (#209, live)", () => {
  // Live, Round 1: Player1 moved Castor three panels from Pollux. The move was
  // refused, as the leash says it must be, with "The destination panel is
  // occupied." -- and the panel was empty.
  const pollux = { id: "pollux", name: "Pollux", kind: "servant", panel: { i: 0, j: 0 } };
  const castor = {
    id: "castor", name: "Castor", kind: "servant", panel: { i: 2, j: 1 }, mov: 6,
    turnState: {}, linkedGroup: { leash: 2, memberIds: ["pollux"] },
  };
  const board = { units: [pollux, castor] };

  it("names the leash and the partner, not an occupant", () => {
    const out = validatePath([{ i: 3, j: 1 }], castor, board);
    expect(out.ok).toBe(false);
    expect(out.reasons).toContain("Castor must stay within 2 panels of Pollux.");
    expect(out.reasons.join(" ")).not.toMatch(/occupied/);
  });

  it("an occupied panel within the leash still says occupied", () => {
    const medea = { id: "medea", name: "Medea", kind: "servant", panel: { i: 1, j: 1 } };
    const out = validatePath([{ i: 1, j: 1 }], castor, { ...board, units: [...board.units, medea] });
    expect(out.reasons).toContain("The destination panel is occupied.");
  });
});

describe("Stars of the Chief God buffs the twin too (#209, live)", () => {
  // Live, Round 1: Castor used Stars of the Chief God two panels from Pollux;
  // "2 effect(s) applied", both on Castor, none on Pollux. The sheet: "on
  // itself AND its linked partner". A self-only target spec short-cut to the
  // caster before the resolver's `alsoIncludes: partner` could add her.
  it("applies the Castor and Pollux buffs to both twins", async () => {
    const { withSubjects, prepareSubjects } = await import("../helpers/subject.mjs");
    const { castSkill } = await import("../helpers/process.mjs");
    const { twinSpecs, CASTOR, POLLUX } = await import("../helpers/dioscuri.mjs");
    await prepareSubjects();
    const specs = await twinSpecs({ castor: { panel: { i: 2, j: 1 } }, pollux: { panel: { i: 0, j: 0 } } });
    await withSubjects(specs, async ({ world: w }) => {
      const stars = [...w.actor(CASTOR).items].find((i) => i.system.contentId === "dioscuri-stars-of-the-chief-god");
      await castSkill(w, { caster: CASTOR, ability: stars.id });
      const held = (id) => [...w.actor(id).effects].map((e) => e.system.defId).sort();
      expect(held(CASTOR)).toEqual(["castorBuff", "polluxBuff"]);
      expect(held(POLLUX)).toEqual(["castorBuff", "polluxBuff"]);
    }, { tokens: true, combat: { round: 1, started: true, system: { globalTurn: 2 }, actingFactionId: "A" } });
  }, 120_000);
});

describe("Mad Enhancement's drain halves beside Pollux on the real board (#209, live)", () => {
  // Live, Round 2: Castor countered in Faction 2's Turn, standing diagonally
  // next to Pollux; the Turn's end read "Master of Saber of Faction 1 loses 20
  // Health (Mad Enhancement)". The sheet halves it beside Pollux. The halving is
  // a `tableFactor` on `self:withinOfPartner:1`, settled when the Unit's rules
  // compile, and they compiled inside `snapshotUnit` before the board pass gave
  // the twin a partner distance: the predicate was false for everybody.
  // `linked-group.test.mjs` passed because it handed the distance in by hand.
  /** What Castor's acted-Turn-end drain takes from his Master, Pollux at `pollux`. */
  const drainAt = async (pollux) => {
    const { withSubjects, prepareSubjects } = await import("../helpers/subject.mjs");
    const { twinSpecs, CASTOR } = await import("../helpers/dioscuri.mjs");
    await prepareSubjects();
    const specs = await twinSpecs({ castor: { panel: { i: 5, j: 5 } }, pollux: { panel: pollux } });
    return withSubjects(specs, async ({ world: w }) => {
      const me = [...w.actor(CASTOR).items].find((i) => i.system.contentId === "class-mad-enhancement");
      await me.update({ "system.active": true });
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const castor = currentBoard().units.find((u) => u.id === CASTOR);
      const handler = castor.eventHandlers.find((h) => h.source === "Mad Enhancement"
        && h.actions.some((a) => a.kind === "StatDelta" && a.subject === "master"));
      expect(handler, "Mad Enhancement's drain is collected while Active").toBeTruthy();
      return handler.actions.find((a) => a.kind === "StatDelta").amount;
    }, { tokens: true, combat: { round: 2, started: true, system: { globalTurn: 5 }, actingFactionId: "A" } });
  };

  it("drains 10 with Pollux diagonally next to him", async () => {
    expect(await drainAt({ i: 4, j: 4 })).toBe(10);
  }, 120_000);

  it("drains 20 with Pollux two panels away", async () => {
    expect(await drainAt({ i: 3, j: 5 })).toBe(20);
  }, 120_000);
});

describe("Mana Burst's 'both twins' restores both twins (#209, live)", () => {
  // Live, Round 2: Pollux's Mana Burst, "Restore 1 Agility and 1 Luck to both
  // twins": Pollux 15 → 16 Agility, Castor stayed at 14 of 18. The branch's
  // `statChange` says `target: linkedGroup`, and `skill-use.mjs#phaseTargets`
  // knew `self` and `reuse`: anything else fell to `reuse`, the caster alone.
  // `phase-targets.test.mjs` read top-level phases and never a branch's.
  const FOE = "foeOfTheTwins000";
  for (const [twin, partner, contentId] of [
    ["pollux", "castor", "dioscuri-mana-burst-pollux"],
    ["castor", "pollux", "dioscuri-mana-burst-castor"],
  ]) {
    it(`${twin}'s reaches ${partner}`, async () => {
      const { withSubjects, prepareSubjects } = await import("../helpers/subject.mjs");
      const { playAttack } = await import("../helpers/process.mjs");
      const { twinSpecs, CASTOR, POLLUX } = await import("../helpers/dioscuri.mjs");
      await prepareSubjects();
      const ids = { castor: CASTOR, pollux: POLLUX };
      const low = { state: { agility: { value: 10, max: 18 }, luck: { value: 5, max: 11 } } };
      const specs = [
        ...await twinSpecs({ castor: { panel: { i: 5, j: 5 }, ...low }, pollux: { panel: { i: 5, j: 6 }, ...low } }),
        { from: "heracles", id: FOE, state: { factionId: "B" }, panel: { i: 5, j: 7 } },
      ];
      await withSubjects(specs, async ({ world: w }) => {
        const before = (id) => [w.actor(id).system.agility.value, w.actor(id).system.luck.value];
        const start = { [twin]: before(ids[twin]), [partner]: before(ids[partner]) };
        w.answer({ title: "Mana Burst (Light/Ancient)", pick: ["both"] });
        const mb = w.actor(ids[twin]).items.find((i) => i.system.contentId === contentId);
        const attacker = ids[twin];
        // Pollux's Range is 1: the foe stands next to her; Castor reaches it at 2.
        await playAttack(w, { attacker, ability: mb.id, target: FOE, react: { [FOE]: ["nothing", "declined"] } });
        expect(before(ids[twin]), twin).toEqual(start[twin].map((v) => v + 1));
        expect(before(ids[partner]), partner).toEqual(start[partner].map((v) => v + 1));
      }, { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18 }, actingFactionId: "A" } });
    }, 120_000);
  }
});

describe("a cut a handler makes is said where a player reads it (#209, live)", () => {
  // Live, Round 2: Castor's Normal Attack crit Scáthach while he held the Castor
  // buff; the joint NP fell 7 → 6 on both copies and the card said nothing. Its
  // 5% Divine Core die was rolled and filed nowhere. The Turn's end took 2 off
  // both copies for Self-Replenishment and the card named the 40 Health only.
  const FOE = "foeOfTheTwins000";
  const NP = "dioscuri-tyndaridae";

  it("the crit's card prints both copies' cut and files the 5% die", async () => {
    const { withSubjects, prepareSubjects } = await import("../helpers/subject.mjs");
    const { playAttack } = await import("../helpers/process.mjs");
    const { twinSpecs, CASTOR, POLLUX } = await import("../helpers/dioscuri.mjs");
    await prepareSubjects();
    const specs = [
      ...await twinSpecs({
        castor: { panel: { i: 5, j: 5 }, effects: [{ defId: "castorBuff" }] },
        pollux: { panel: { i: 5, j: 6 } },
      }),
      { from: "heracles", id: FOE, state: { factionId: "B" }, panel: { i: 5, j: 7 } },
    ];
    await withSubjects(specs, async ({ world: w }) => {
      for (const id of [CASTOR, POLLUX]) {
        await w.actor(id).items.find((i) => i.system.contentId === NP).update({ "system.cooldown.remaining": 18 });
      }
      // A 40 is a Crit at 65% and misses the Divine Core's 5%.
      w.dice.every(40);
      const { declared } = await playAttack(w, { attacker: CASTOR, target: FOE, react: { [FOE]: ["nothing", "declined"] } });
      const message = w.messages.get(declared.messageId);
      expect(message.getFlag("fgt", "result").isCrit, "the swing crit").toBe(true);
      const lines = (message.getFlag("fgt", "effects") ?? []).filter((e) => e.id === "cooldown").map((e) => e.name);
      expect(lines).toEqual([
        "Dioscures Tyndaridae: Hymn of the Divine Twins: Cooldown 18 → 17",
        "Dioscures Tyndaridae: Hymn of the Divine Twins: Cooldown 18 → 17",
      ]);
      const state = JSON.parse(message.getFlag("fgt", "process"));
      const records = state.history.flatMap((h) => h.detail?.rollRecords ?? []);
      const notes = records.flatMap((r) => (r.modifiers ?? []).map((m) => m.source));
      expect(notes).toContain("against 5%: missed");
      // Named for the clause, not "rider" (#209, live).
      expect(records.map((r) => r.purpose)).toContain(`Castor: Twin God's Divine Core on ${w.actor(FOE).name}`);
    }, { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18 }, actingFactionId: "A" } });
  }, 120_000);

  it("the Turn-end card names the cut on each copy", async () => {
    const { turnEndCard } = await import("../../module/engine/turn-report.mjs");
    const t = (key, d) => `${key}|${d?.who}|${d?.ability}|${d?.ticks}|${d?.source}`;
    const card = turnEndCard([
      { t: "cooldown", unitId: "c", abilityId: "np", ticks: 2, mode: "reduce", source: "Self-Replenishment (Mana)" },
      { t: "cooldown", unitId: "p", abilityId: "np", ticks: 2, mode: "reduce", source: "Self-Replenishment (Mana)" },
      // The Turn's own tick names no source, and is not news.
      { t: "cooldown", unitId: "c", abilityId: "np", ticks: 1, mode: "reduce" },
    ], (id) => ({ c: "Castor", p: "Pollux" })[id], t, () => "Hymn");
    expect(card).toContain("FGT.TurnReport.CooldownCut|Castor|Hymn|2|Self-Replenishment (Mana)");
    expect(card).toContain("FGT.TurnReport.CooldownCut|Pollux|Hymn|2|Self-Replenishment (Mana)");
    expect(card.match(/CooldownCut/g)).toHaveLength(2);
  });

  it("says what a cut took, and nothing of one that found the clock at 0 (#209 review)", async () => {
    const { turnEndCard, clocksBefore } = await import("../../module/engine/turn-report.mjs");
    const t = (key, d) => `${key}|${d?.who}|${d?.ticks}`;
    const cuts = [
      { t: "cooldown", unitId: "c", abilityId: "np", ticks: 2, mode: "reduce", source: "Self-Replenishment (Mana)" },
      { t: "cooldown", unitId: "p", abilityId: "np", ticks: 2, mode: "reduce", source: "Self-Replenishment (Mana)" },
    ];
    const before = clocksBefore(cuts, (unitId) => ({ c: 1, p: 0 })[unitId]);
    const card = turnEndCard(cuts, (id) => ({ c: "Castor", p: "Pollux" })[id], t, () => "Hymn", before);
    expect(card).toContain("FGT.TurnReport.CooldownCut|Castor|1");
    expect(card).not.toContain("Pollux");
    expect(turnEndCard(cuts, (id) => id, t, () => "Hymn", clocksBefore(cuts, () => 0))).toBeNull();
  });

  it("Self-Replenishment's cut carries its source to that card", async () => {
    const { withSubjects, prepareSubjects } = await import("../helpers/subject.mjs");
    const { twinSpecs, CASTOR, POLLUX } = await import("../helpers/dioscuri.mjs");
    const { fireEvent } = await import("../../module/engine/scheduler.mjs");
    await prepareSubjects();
    await withSubjects(await twinSpecs(), ({ unit, board }) => {
      const out = fireEvent("unitTurnEnd", [unit(CASTOR)], { tick: 18, turnsPerRound: 3, activeFactionId: "A", board });
      const cuts = out.filter((i) => i.t === "cooldown");
      expect(cuts.map((i) => [i.unitId, i.source]).sort()).toEqual([
        [CASTOR, "Self-Replenishment (Mana)"], [POLLUX, "Self-Replenishment (Mana)"],
      ].sort());
    });
  }, 120_000);
});

describe("the joint NP's own hit does not drain what it inflicts after (#209, live)", () => {
  // Live, Round 3: the joint NP hit Heracles for 734, "Then, inflicts Def Dwn
  // (A) and (C)". The log showed `damageTaken` heard by both, from that same
  // hit: Luck 20 -> 19, Agility one more than the Injury took. The debuffs were
  // applied before `damageTaken` was raised, so they heard the damage that came
  // before them. "Whenever damage is received" is damage after they exist.
  const FOE = "foeOfTheTwins000";
  it("leaves Luck and Agility to the Injury alone", async () => {
    const { withSubjects, prepareSubjects } = await import("../helpers/subject.mjs");
    const { playAttack } = await import("../helpers/process.mjs");
    const { twinSpecs, CASTOR } = await import("../helpers/dioscuri.mjs");
    await prepareSubjects();
    const specs = [
      ...await twinSpecs({ castor: { panel: { i: 5, j: 5 } }, pollux: { panel: { i: 5, j: 4 } } }),
      // Heracles has no Magic Resistance to roll the debuffs off.
      { from: "heracles", id: FOE, panel: { i: 5, j: 7 },
        state: { factionId: "B", luck: { value: 8, max: 8 }, agility: { value: 8, max: 8 } } },
    ];
    await withSubjects(specs, async ({ world: w }) => {
      w.dice.every(60);
      const np = w.actor(CASTOR).items.find((i) => i.system.contentId === "dioscuri-tyndaridae");
      await playAttack(w, { attacker: CASTOR, ability: np.id, target: FOE, react: { [FOE]: ["nothing", "declined"] } });
      const held = [...w.actor(FOE).effects].map((e) => e.system.defId);
      expect(held, "the NP inflicted both").toEqual(expect.arrayContaining(["defDwnA", "defDwnC"]));
      expect(w.actor(FOE).system.luck.value, "Def Dwn (A) heard the hit that inflicted it").toBe(8);
      const heard = (w.combat.getFlag("fgt", "log") ?? [])
        .filter((e) => e.kind === "event" && e.event === "damageTaken" && e.unitId === FOE);
      expect(heard.map((e) => e.source)).toEqual([]);
    }, { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18 }, actingFactionId: "A" } });
  }, 120_000);
});

describe("a panel beside a guarded enemy Master is refused as that (#209, live)", () => {
  // Live, Round 4: Player1 dragged Castor to a panel beside the enemy Master of
  // Caster, whose Medea stood two from him. Refused, rightly, with "Step 3
  // passes through a panel this Unit may not enter." and "The destination panel
  // is occupied." -- and the panel was empty.
  const castor = { id: "castor", name: "Castor", kind: "servant", factionId: "A", panel: { i: 2, j: 1 }, mov: 6, turnState: {} };
  const master = { id: "m2", name: "Master of Caster", kind: "master", factionId: "B", panel: { i: 3, j: 5 } };
  const medea = { id: "medea", name: "Medea", kind: "servant", factionId: "B", masterId: "m2", panel: { i: 3, j: 4 } };
  const board = { units: [castor, master, medea] };

  it("names the Master's protection, not an occupant", async () => {
    const { validatePath } = await import("../../module/rules/movement.mjs");
    const out = validatePath([{ i: 2, j: 2 }, { i: 2, j: 3 }, { i: 2, j: 4 }], castor, board);
    expect(out.ok).toBe(false);
    expect(out.reasons).toContain("Step 3 is beside an enemy Master, and its Servant guards that panel.");
    expect(out.reasons.join(" ")).not.toMatch(/occupied/);
  });
});

describe("Mana Burst's restore card says what moved, and on whom (#209, live)", () => {
  // Live, Round 4: Castor's "Restore 2 Agility and 2 Luck" with his Luck at its
  // maximum read "Agility +2, Luck +2": Agility 14 -> 16, Luck 9 -> 9. And the
  // "both twins" card of Round 2 read "Agility +1, Luck +1" with nobody named.
  const FOE = "foeOfTheTwins000";
  const play = async (pick, castorState) => {
    const { withSubjects, prepareSubjects } = await import("../helpers/subject.mjs");
    const { playAttack } = await import("../helpers/process.mjs");
    const { twinSpecs, CASTOR } = await import("../helpers/dioscuri.mjs");
    await prepareSubjects();
    const specs = [
      ...await twinSpecs({
        castor: { panel: { i: 5, j: 5 }, state: castorState },
        pollux: { panel: { i: 5, j: 6 }, state: { agility: { value: 10, max: 18 }, luck: { value: 5, max: 11 } } },
      }),
      { from: "heracles", id: FOE, state: { factionId: "B" }, panel: { i: 5, j: 7 } },
    ];
    let rows;
    await withSubjects(specs, async ({ world: w }) => {
      w.answer({ title: "Mana Burst (Light/Ancient)", pick: [pick] });
      const mb = w.actor(CASTOR).items.find((i) => i.system.contentId === "dioscuri-mana-burst-castor");
      await playAttack(w, { attacker: CASTOR, ability: mb.id, target: FOE, react: { [FOE]: ["nothing", "declined"] } });
      const card = [...w.messages.values()].filter((m) => m.getFlag("fgt", "kind") === "skill").at(-1);
      rows = card.getFlag("fgt", "rows").map((r) => r.name);
    }, { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18 }, actingFactionId: "A" } });
    return rows;
  };

  it("a restore the maximum clamped says so", async () => {
    expect(await play("self", { agility: { value: 14, max: 18 }, luck: { value: 9, max: 9 } }))
      .toEqual(["Agility 14 → 16", "Luck 9 (no change)"]);
  }, 120_000);

  it("the twin's rows name the twin", async () => {
    expect(await play("both", { agility: { value: 10, max: 18 }, luck: { value: 5, max: 9 } }))
      .toEqual(["Agility 10 → 11", "Luck 5 → 6", "Pollux: Agility 10 → 11", "Pollux: Luck 5 → 6"]);
  }, 120_000);
});

describe("Mad Enhancement's 2◈ when the Master falls in one blow (#209 ME.sus)", () => {
  // Live, Round 6: the Master staged to 1 Health, and Mad Enhancement was
  // forcibly deactivated at once ("its Master's Health is at its limit"), so
  // the defeat that followed charged nothing. In one blow from 148 the same
  // happened: the blow's Health drop forced the mode off before the defeat
  // path read it, so clause 5 could never charge anybody.
  const MASTER = "masterOfSaber000";
  it("charges Castor 2◈ and not Pollux", async () => {
    const { withSubjects, prepareSubjects } = await import("../helpers/subject.mjs");
    const { twinSpecs, CASTOR, POLLUX } = await import("../helpers/dioscuri.mjs");
    await prepareSubjects();
    const bound = { masterId: MASTER, contract: "contracted" };
    const specs = [
      ...await twinSpecs({ castor: { panel: { i: 5, j: 5 }, state: bound }, pollux: { panel: { i: 5, j: 6 }, state: bound } }),
      { from: "master-advanced", id: MASTER, panel: { i: 6, j: 5 }, state: { factionId: "A", health: { value: 148, max: 300 } } },
    ];
    await withSubjects(specs, async ({ world: w }) => {
      const me = w.actor(CASTOR).items.find((i) => i.system.contentId === "class-mad-enhancement");
      await me.update({ "system.active": true });
      const { applyWorldIntents } = await import("../../module/engine/applier.mjs");
      await applyWorldIntents([{ t: "damage", unitId: MASTER, amount: 500, breakdown: null }], "test");
      expect(w.actor(MASTER).system.defeated, "the Master fell").toBe(true);
      expect(w.actor(CASTOR).system.contract).toBe("free");
      // 2◈ of a 2◈ clock at three Turns a Round: 6 - 6.
      expect(w.actor(CASTOR).system.sustainabilityRemaining).toBe(0);
      expect(w.actor(POLLUX).system.sustainabilityRemaining ?? null).toBe(null);
    }, { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18 }, actingFactionId: "B" } });
  }, 120_000);
});

describe("a twin defeated by any door takes the other (#209 DI.death, live)", () => {
  // Live, Round 6: Castor ran out of Sustainability ("sustainabilityExhausted")
  // and Pollux stood on at 1383 Health. The binding was emitted by the damage
  // path's defeat chain alone; the Sustainability sweep, an Instakill, Erase, a
  // Command Spell and a field's defeat each wrote `defeat` without it.
  for (const cause of ["sustainabilityExhausted", "instakill", "erase"]) {
    it(`${cause} takes Pollux with Castor`, async () => {
      const { withSubjects, prepareSubjects } = await import("../helpers/subject.mjs");
      const { twinSpecs, CASTOR, POLLUX } = await import("../helpers/dioscuri.mjs");
      await prepareSubjects();
      const specs = await twinSpecs({ castor: { panel: { i: 5, j: 5 } }, pollux: { panel: { i: 5, j: 6 } } });
      await withSubjects(specs, async ({ world: w }) => {
        const { applyWorldIntents } = await import("../../module/engine/applier.mjs");
        await applyWorldIntents([{ t: "defeat", unitId: CASTOR, cause, killerId: null }], "test");
        expect(w.actor(CASTOR).system.defeated).toBe(true);
        expect(w.actor(POLLUX).system.defeated, "the binding").toBe(true);
        expect(w.actor(POLLUX).system.defeatCause).toBe("linkedDeath");
      }, { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18 }, actingFactionId: "A" } });
    }, 120_000);
  }
});

describe("a compulsion may not switch Mad Enhancement on over a Master at 0 (#209 review)", () => {
  it("forcedOffNow holds for the compulsion, and the sweep leaves it to the defeat path", async () => {
    const { forcedOffNow } = await import("../../module/rules/modes.mjs");
    const { loadSource } = await import("../../tools/lib/load.mjs");
    const { files } = await loadSource("packs/_source");
    const me = files.find((f) => f.doc?.id === "class-mad-enhancement").doc;
    const item = { system: { isMode: true, rank: "B", activeRules: me.activeRules } };
    const unit = { id: "s", masterId: "m" };
    const board = { units: [unit, { id: "m", kind: "master", health: { value: 0, max: 100 } }] };
    expect(forcedOffNow(item, unit, board), "a compulsion reads the valve").toBe(true);
    expect(forcedOffNow(item, unit, board, { masterDefeatAnswers: true }), "the sweep does not").toBe(false);
  });
});
