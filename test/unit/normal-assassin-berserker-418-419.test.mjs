/**
 * @file The Normal Berserker's Mad Enhancement and the Normal Assassin's Presence Concealment (#418, #419).
 * @see packs/_source/abilities/normal-mad-enhancement.yml, packs/_source/effects/normal-presence-concealment-effect.yml
 *
 * Both reproduced live in fgt2026 (2026-11-16): the drain took nothing from the Master, and a Normal Attack
 * on the concealed Normal Assassin read "✓ Legal". Ruled with the user the same day: the drain has no floor;
 * the forced end is asked at every Turn's end, after the drain, and never of a Master the drain felled (the
 * lock wins); Sustainability is 1◈ while the Mode is on. The Normal concealment is its own state: no direct
 * Attack target (a Skill may still choose it), an area's coin, its end starting the Skill's clock, Masters
 * approached and Attacked regardless of their Servants, and no Cover against its Attacks.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import yaml from "js-yaml";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { endTurn } from "../../module/engine/scheduler.mjs";
import { onMasterDefeated } from "../../module/rules/relationships.mjs";
import { resolveTargets } from "../../module/rules/targeting/resolve.mjs";
import { isConcealed, veiledFromAttacks } from "../../module/rules/concealment.mjs";
import { inEnemyMasterProtection } from "../../module/rules/movement.mjs";
import { validateAll } from "../../tools/lib/content.mjs";

beforeAll(prepareSubjects, 120_000);

const BERSERKER = "normBerserker001";
const MASTER = "normBerserkMstr1";

/** The Normal Berserker's abilities as authored, Mad Enhancement on or off. */
const berserkerAbilities = (on) => yaml.load(readFileSync("packs/_source/servants-normal/normal-berserker.yml", "utf8"))
  .abilities.map((a) => (a.ref === "normal-mad-enhancement" ? { ...a, active: on } : a));

/** The Normal Berserker and its Master at `health`, Mad Enhancement on, having Acted or not. */
const berserkerWar = ({ health, acted = true, on = true }) => [
  {
    from: "normal-berserker", id: BERSERKER, with: { abilities: berserkerAbilities(on) },
    state: { factionId: "A", masterId: MASTER, turnState: { tick: 7, acted } }, panel: { i: 5, j: 5 },
  },
  { from: "master-normal", id: MASTER, state: { factionId: "A", health: { value: health, max: 300 } }, panel: { i: 6, j: 5 } },
];

const turnEnd = (board) => endTurn(board, { tick: 7, round: 3, turnsPerRound: 3, activeFactionId: "A" });
const drains = (intents) => intents.filter((i) => i.t === "statDelta" && i.unitId === MASTER && i.stat === "health.value").map((i) => i.delta);
const switchedOff = (intents) => intents.filter((i) => i.t === "setMode" && i.unitId === BERSERKER && i.active === false).length > 0;

describe("Mad Enhancement's drain (#419)", () => {
  it("takes 15 from its Master at the end of a Turn its Berserker Acted", async () => {
    const out = await withSubjects(berserkerWar({ health: 300 }), ({ board }) => turnEnd(board));
    expect(drains(out)).toEqual([-15]);
    expect(switchedOff(out)).toBe(false);
  });

  it("takes nothing on a Turn it did not Act", async () => {
    const out = await withSubjects(berserkerWar({ health: 300, acted: false }), ({ board }) => turnEnd(board));
    expect(drains(out)).toEqual([]);
  });

  it("has no floor: a Master at 10 is drained the full 15, and the lock keeps the Mode on", async () => {
    const out = await withSubjects(berserkerWar({ health: 10 }), ({ board }) => turnEnd(board));
    expect(drains(out)).toEqual([-15]);
    expect(switchedOff(out)).toBe(false);
  });

  it("switches the Mode off when the drain leaves the Master at 15 or less", async () => {
    const out = await withSubjects(berserkerWar({ health: 25 }), ({ board }) => turnEnd(board));
    expect(drains(out)).toEqual([-15]);
    expect(switchedOff(out)).toBe(true);
  });

  it("switches it off at the end of a Turn it did not Act, when the Master stands at 15 or less", async () => {
    const low = await withSubjects(berserkerWar({ health: 12, acted: false }), ({ board }) => turnEnd(board));
    const high = await withSubjects(berserkerWar({ health: 30, acted: false }), ({ board }) => turnEnd(board));
    expect([switchedOff(low), switchedOff(high)]).toEqual([true, false]);
  });

  it("does nothing while the Mode is off", async () => {
    const out = await withSubjects(berserkerWar({ health: 300, on: false }), ({ board }) => turnEnd(board));
    expect([drains(out), switchedOff(out)]).toEqual([[], false]);
  });
});

describe("Mad Enhancement's Sustainability (#419)", () => {
  it("is 1◈ while on and the sheet's 2◈ while off", async () => {
    const free = (on) => [{ ...berserkerWar({ health: 300, on })[0], state: { factionId: "A", sustainabilityRemaining: null } }];
    const on = await withSubjects(free(true), ({ unit }) => unit(BERSERKER).sustainability);
    const off = await withSubjects(free(false), ({ unit }) => unit(BERSERKER).sustainability);
    expect([on, off]).toEqual([3, 6]);
  });

  it("charges no Advanced clause 5 when the Master falls with it on: the clock starts at 1◈", async () => {
    const out = await withSubjects(berserkerWar({ health: 300 }), ({ unit }) => onMasterDefeated(unit(BERSERKER), { turnsPerRound: 3 }));
    expect(out.filter((d) => d.kind === "resource" && d.key === "sustainability")).toEqual([]);
    expect(out.some((d) => d.kind === "lockModes")).toBe(true);
  });
});

describe("the build refuses a StatDelta with no figure (#419)", () => {
  const problems = (action) => validateAll([{ path: "x.yml", dir: "abilities", doc: {
    schema: 1, id: "thing", name: "Thing", kind: "skill", passive: true,
    passiveRules: [{ key: "OnEvent", event: "turnEnd", automatic: true, then: [{ key: "StatDelta", stat: "health.value", ...action }] }],
  } }]).problems.filter((p) => p.includes("StatDelta states no figure"));

  it("names `value`, which nothing reads, and passes `amount`", () => {
    expect(problems({ value: 15, direction: "down" })[0]).toContain('it has "value", which nothing reads');
    expect(problems({ amount: 15, direction: "down" })).toEqual([]);
  });
});

const ASSASSIN = "normAssassin0001";
const ENEMY = "normEnemySaber01";
const ENEMY_MASTER = "normEnemyMaster1";

/** The Normal Assassin under its concealment beside an enemy Saber, the Saber's Master one panel off. */
const assassinWar = (concealed = true) => [
  {
    from: "normal-assassin", id: ASSASSIN, state: { factionId: "A" }, panel: { i: 5, j: 5 },
    ...(concealed ? { effects: [{ defId: "normalPresenceConcealment" }] } : {}),
  },
  { from: "normal-saber", id: ENEMY, state: { factionId: "B", masterId: ENEMY_MASTER }, panel: { i: 4, j: 5 } },
  { from: "master-normal", id: ENEMY_MASTER, state: { factionId: "B", health: { value: 300, max: 300 } }, panel: { i: 3, j: 7 } },
];

const aimed = (forAttack) => ({
  anchor: { kind: "targetUnit", range: 3 }, shape: { kind: "unit" },
  selection: { chooser: "chosen", count: 1, relations: ["enemy"] }, limits: { forAttack },
});

describe("the Normal Presence Concealment (#418)", () => {
  it("is out of reach of an Attack and nothing else of the full state", async () => {
    const out = await withSubjects(assassinWar(), ({ unit }) => [veiledFromAttacks(unit(ASSASSIN)), isConcealed(unit(ASSASSIN))]);
    expect(out).toEqual([true, false]);
  });

  it("refuses an enemy's direct Attack, and lets an enemy's Skill choose it", async () => {
    const out = await withSubjects(assassinWar(), ({ unit, board }) => ({
      attack: resolveTargets(aimed(true), unit(ENEMY), board, { unitId: ASSASSIN, chosenIds: [ASSASSIN], reach: "attack" }),
      skill: resolveTargets(aimed(false), unit(ENEMY), board, { unitId: ASSASSIN, chosenIds: [ASSASSIN], reach: "effect" }),
    }));
    expect(out.attack.units).toEqual([]);
    expect(out.attack.excluded.map((e) => e.reason)).toContain("concealed — it cannot be targeted directly");
    expect(out.skill.units.map((u) => u.unitId)).toEqual([ASSASSIN]);
  });

  it("is still caught by an area", async () => {
    const area = { anchor: { kind: "self" }, shape: { kind: "chebyshevRadius", r: 2 }, selection: { chooser: "all", relations: ["enemy"] } };
    const out = await withSubjects(assassinWar(), ({ unit, board }) => resolveTargets(area, unit(ENEMY), board, {}).units.map((u) => u.unitId));
    expect(out).toContain(ASSASSIN);
  });

  it("approaches an enemy Master its Servant guards, and without it may not", async () => {
    const step = (concealed) => withSubjects(assassinWar(concealed), ({ unit, board }) => inEnemyMasterProtection({ i: 4, j: 7 }, unit(ASSASSIN), board));
    expect([await step(true), await step(false)]).toEqual([false, true]);
  });

  it("is authored to lift Cover and to start its Skill's clock at its end", () => {
    const effect = yaml.load(readFileSync("packs/_source/effects/normal-presence-concealment-effect.yml", "utf8"));
    expect(effect.rules.filter((r) => r.key === "Suppress").map((r) => r.scope).sort()).toEqual(["cover", "masterProtection"]);
    const skill = yaml.load(readFileSync("packs/_source/abilities/normal-presence-concealment.yml", "utf8"));
    expect(skill.cooldown).toEqual({ max: "1◈", countFrom: "deactivation" });
  });
});
