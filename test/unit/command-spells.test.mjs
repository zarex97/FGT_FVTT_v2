/**
 * @file Command Spells — offering, validating and resolving.
 * @see docs/17-command-spells.md, docs/45-implementation-status.md B1
 *
 * The schema, the `spendCS` intent and `io.spendCommandSpells` all existed and
 * were reachable end to end. What did not exist was anything that decided
 * *which* command a Master may use, *when*, or *what it does* — so nothing ever
 * constructed the intent and no Command Spell was ever spent.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { parse } from "yaml";
import {
  availableCommands, canSpend, effectsOf, costOf, WINDOWS, REQUIREMENT_KINDS,
} from "../../module/rules/command-spells.mjs";

/* ── Fixtures ─────────────────────────────────────────────────────────────── */

const master = (over = {}) => ({
  id: "m", kind: "master", rank: "A", commandSpells: 3,
  panel: { i: 5, j: 5 }, faction: "a", ...over,
});

const servant = (over = {}) => ({
  id: "s", kind: "servant", masterId: "m", faction: "a",
  panel: { i: 6, j: 5 }, outsideZon: false,
  health: { value: 400, max: 1000 }, agility: { value: 3, max: 8 },
  attributes: [], effects: [], ...over,
});

const halfHeal = {
  id: "cs-half-heal", name: "Half Heal", cost: 1,
  requirements: [{ kind: "servantInZon" }],
  timing: { window: "anyTime" },
  blockedWhen: [{ state: "damage", condition: "damageWouldDefeatServant" }],
  effect: [{
    kind: "statChange", target: "contractedServant",
    changes: [
      { stat: "health", deltaPercentOfMax: 50, clamp: true },
      { stat: "agility", deltaPercentOfMax: 50, clamp: true },
    ],
  }],
};

const damageBlock = {
  id: "cs-damage-block", name: "Damage Block", cost: 1,
  requirements: [{ kind: "servantInZon" }, { kind: "attackIsNotNP" }],
  timing: { window: "react" },
  effect: [{ kind: "modifyDamage", factor: 0 }],
};

const killYourself = {
  id: "cs-kill-yourself", name: "Kill Yourself", cost: 2,
  costByMasterRank: { high: 1, low: 2 },
  requirements: [{ kind: "servantInZon" }, { kind: "targetNotImmune" }],
  timing: { window: "ownTurn" },
  effect: [{ kind: "defeat", target: "contractedServant" }],
};

const ctx = (over = {}) => ({ master: master(), servant: servant(), ...over });

/* ── Cost ─────────────────────────────────────────────────────────────────── */

describe("costOf", () => {
  it("uses the flat cost when there is no rank variant", () => {
    expect(costOf(halfHeal, master())).toBe(1);
  });

  it("charges a High Rank Master less for Kill Yourself", () => {
    expect(costOf(killYourself, master({ rank: "A" }))).toBe(1);
  });

  it("charges a Low Rank Master the full price", () => {
    expect(costOf(killYourself, master({ rank: "C" }))).toBe(2);
  });

  it("charges one when every Master is Rankless", () => {
    // "If all Masters are Rankless, the Kill Yourself command only costs one."
    expect(costOf(killYourself, master({ rank: "" }), { allMastersRankless: true })).toBe(1);
  });
});

/* ── Validation ───────────────────────────────────────────────────────────── */

describe("canSpend", () => {
  it("allows a command the Master can pay for and meets", () => {
    expect(canSpend(halfHeal, ctx())).toMatchObject({ ok: true });
  });

  it("refuses when the Master has too few Command Spells", () => {
    expect(canSpend(killYourself, ctx({ master: master({ rank: "C", commandSpells: 1 }) })))
      .toMatchObject({ ok: false, reason: "cost" });
  });

  it("refuses when the Servant is outside ZON", () => {
    expect(canSpend(halfHeal, ctx({ servant: servant({ outsideZon: true }) })))
      .toMatchObject({ ok: false, reason: "servantInZon" });
  });

  it("refuses Damage Block against a Noble Phantasm", () => {
    // "Cannot be used against NP."
    expect(canSpend(damageBlock, ctx({ attack: { kind: "np" } })))
      .toMatchObject({ ok: false, reason: "attackIsNotNP" });
  });

  it("allows Damage Block against a normal attack", () => {
    expect(canSpend(damageBlock, ctx({ attack: { kind: "normal" } }))).toMatchObject({ ok: true });
  });

  it("refuses Kill Yourself against a Servant that is immune to it", () => {
    // Van Gogh: "cannot be ordered to commit suicide, even with a Command Spell."
    expect(canSpend(killYourself, ctx({
      servant: servant({ attributes: ["immuneToKillYourself"] }),
    }))).toMatchObject({ ok: false, reason: "targetNotImmune" });
  });

  it("refuses Half Heal during a Damage Step that would defeat the Servant", () => {
    expect(canSpend(halfHeal, ctx({
      state: "damage", incomingDamage: 500, // more than the Servant's 400 Health
    }))).toMatchObject({ ok: false, reason: "blocked" });
  });

  it("allows Half Heal during a Damage Step it would survive", () => {
    expect(canSpend(halfHeal, ctx({ state: "damage", incomingDamage: 100 })))
      .toMatchObject({ ok: true });
  });
});

/* ── Offering ─────────────────────────────────────────────────────────────── */

describe("availableCommands", () => {
  const catalogue = [halfHeal, damageBlock, killYourself];

  it("offers only the commands whose window is open", () => {
    expect(availableCommands(catalogue, ctx({ window: WINDOWS.react, attack: { kind: "normal" } }))
      .map((c) => c.id)).toEqual(["cs-half-heal", "cs-damage-block"]);
  });

  it("offers anyTime commands at every window", () => {
    expect(availableCommands(catalogue, ctx({ window: WINDOWS.onDefeat })).map((c) => c.id))
      .toEqual(["cs-half-heal"]);
  });

  it("never offers a command the Master cannot afford", () => {
    // Offering something that would be refused is worse than not offering it —
    // it stops the resolution to ask a question with one answer.
    expect(availableCommands(catalogue, ctx({
      window: WINDOWS.ownTurn, master: master({ commandSpells: 0 }),
    }))).toEqual([]);
  });

  it("never offers a command the target is immune to", () => {
    // "It must be checked at offer time so the option never appears."
    expect(availableCommands(catalogue, ctx({
      window: WINDOWS.ownTurn, servant: servant({ attributes: ["immuneToKillYourself"] }),
    })).map((c) => c.id)).toEqual(["cs-half-heal"]);
  });
});

/* ── Effects ──────────────────────────────────────────────────────────────── */

describe("effectsOf", () => {
  it("resolves a percent-of-maximum stat change against the Servant's maxima", () => {
    expect(effectsOf(halfHeal, ctx())).toEqual([
      { kind: "statChange", unitId: "s", stat: "health", delta: 500, clamp: true },
      { kind: "statChange", unitId: "s", stat: "agility", delta: 4, clamp: true },
    ]);
  });

  it("targets the contracted Servant, not the Master who spent the spell", () => {
    expect(effectsOf(killYourself, ctx())).toEqual([{ kind: "defeat", unitId: "s" }]);
  });
});

/* ========================================================================== */
/*  The shipped catalogue                                                     */
/* ========================================================================== */

describe("the authored catalogue", () => {
  const dir = "packs/_source/command-spells";
  const commands = readdirSync(dir)
    .filter((f) => f.endsWith(".yml"))
    .map((f) => parse(readFileSync(`${dir}/${f}`, "utf8")));

  it("ships the whole reference set", () => {
    // §17.2: nine at cost 1, seven at cost 2, one at cost 3.
    expect(commands).toHaveLength(16);
  });

  it("uses only requirement kinds the rules understand", () => {
    // The guard that matters. An unrecognised kind makes `canSpend` refuse, so
    // the command compiles, loads, appears in the pack, and can never be used
    // by anybody — silently. That is this project's most common defect shape
    // and this is the cheapest possible place to catch it.
    const used = new Set(commands.flatMap((c) => (c.requirements ?? []).map((r) => r.kind)));
    const unknown = [...used].filter((k) => !REQUIREMENT_KINDS.includes(k));

    expect(unknown).toEqual([]);
  });

  it("gives every command a timing window", () => {
    expect(commands.filter((c) => !c.timing?.window).map((c) => c.id)).toEqual([]);
  });

  it("gives every command at least one effect", () => {
    expect(commands.filter((c) => !(c.effect ?? []).length).map((c) => c.id)).toEqual([]);
  });
});
