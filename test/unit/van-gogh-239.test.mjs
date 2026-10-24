/**
 * @file Van Gogh's audit (#239): the readings ruled 2026-10-17, and #202, which
 * her loop proved live.
 * @see docs/46-roster-re-audit.md §46.36, docs/superpowers/specs/2026-10-17-van-gogh-clauses.md
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import yaml from "js-yaml";
import { transferEffect } from "../../module/rules/effect-flow.mjs";
import { cardFor } from "../../module/rules/card-visibility.mjs";
import { cooldownLine } from "../../module/engine/applier.mjs";
import { cooldownLine as skillCooldownLine } from "../../module/engine/skill-use.mjs";

const src = (dir, file) => yaml.load(readFileSync(new URL(`../../packs/_source/${dir}/${file}`, import.meta.url), "utf8"));
const code = (file) => readFileSync(new URL(`../../module/${file}`, import.meta.url), "utf8");

describe("the pull's arrival (#239 reading 6)", () => {
  const curse = { id: "c1", defId: "curse", stage: 3, expiry: null, chance: 500, rolled: 12 };
  const [removal, arrival] = transferEffect(curse, { id: "ally", pausedTicks: 0 }, { id: "gogh", pausedTicks: 0 });

  it("removes it from its bearer first, so an immunity on her loses it (6c)", () => {
    expect(removal).toMatchObject({ kind: "removeEffect", unitId: "ally", reason: "transferred" });
  });

  it("lands every stage with no roll and no resistance (6b)", () => {
    // It went through the landing door as a fresh 100% less her 25 and 35:
    // 40%, all or nothing, after the others' Curse was already gone.
    expect(arrival.effect.stage).toBe(3);
    expect(arrival.effect.bypassChanceModifiers).toBe(true);
    expect(arrival.effect).not.toHaveProperty("chance");
    expect(arrival.effect).not.toHaveProperty("rolled");
  });

  it("does not take her own Curse (6a), and reaches Civilians (reading 7)", () => {
    const sol = src("abilities", "gogh-shadow-of-longing.yml");
    expect(sol.phases.find((p) => p.kind === "transfer").relations).toEqual(["ally", "enemy", "neutral"]);
    // The executor skips the caster whatever the relations say.
    expect(code("engine/skill-use.mjs")).toMatch(/if \(other\.id === actor\.id\) return false;/);
  });
});

describe("the 'Gogh' buff hears a successful Attack, once (#239 reading 2)", () => {
  const gogh = src("effects", "gogh.yml");

  it("listens to attackLanded, not damageDealt", () => {
    const eat = gogh.rules.filter((r) => r.then?.[0]?.key === "RemoveEffect");
    expect(eat.map((r) => r.event)).toEqual(["attackLanded", "attackLanded"]);
  });

  it("attackLanded carries attack:crit when any Unit it landed on was critted", () => {
    expect(code("engine/attack.mjs")).toMatch(/flags\?\.isCrit\)\) options\.add\("attack:crit"\)/);
  });
});

describe("#202: what a handler does reaches a card", () => {
  it("one cooldown line, read by the Skill card and the applier alike", () => {
    expect(cooldownLine("De Sterrennacht: The Starry Night", 24, 21)).toBe("De Sterrennacht: The Starry Night: Cooldown 24 → 21");
    expect(cooldownLine("X", 0, 0)).toBeNull();
    expect(skillCooldownLine).toBe(cooldownLine);
  });

  it("a handler's stat change is a line too, read from the applier's one reader", async () => {
    const A = await import("../../module/engine/applier.mjs");
    const S = await import("../../module/engine/skill-use.mjs");
    expect(S.statChangeLine).toBe(A.statChangeLine);
    expect(A.statChangeLine({ stat: "agility.value", delta: -1 }, 19, 18)).toBe("Agility 19 → 18");
    // ...and an extension's span beside them, since #243 (Magecraft's 1◈ on Suppression),
    // then an Item spent and a rule taken away for good, since #247 (the Vorpal Blade's blow),
    // and a magnitude that fell, since #315 (Merlin's Illusion), and a Mode's
    // tally, since #319 (Saitou's seventh Attack).
    // ...and a heal it gave, since #330 (Dracula's 25% for a Unit he felled). One
    // statement says them all; each builder is named in it, not the line pinned.
    const said = code("engine/applier.mjs").match(/said\.push\(([\s\S]*?)\);\r?\n/)?.[1] ?? "";
    for (const builder of ["clockLines(clocks)", "healLines(plan.local, healths)", "statLines(stats)", "spanLines(spans)",
      "itemLines(held)", "decayLines(plan.local)", "tallyLines(plan.local)", "suppressionLines(lines ? plan.local : [])",
      "removalLines(lines ? plan.local : [])"]) {
      expect(said, builder).toContain(builder);
    }
  });

  const input = (effects, effectOwners) => ({
    summary: "Foreigner → Lancer",
    attackerId: "gogh", defenderIds: ["karna"],
    attackerControllers: ["p1"], defenderControllers: ["p2"],
    controllersByActor: { gogh: ["p1"], karna: ["p2"] },
    total: 28, breakdown: [], effects, effectOwners, rolls: [],
  });

  it("shows the attacker her own lines and the defender only a count of them", () => {
    const r = input(["Curse: Stage 2 → 1", "Atk Up", "Def Dwn (C)"], ["gogh", "gogh", "karna"]);
    expect(cardFor(r, { id: "p1" })).toMatchObject({ effects: ["Curse: Stage 2 → 1", "Atk Up"], effectsHidden: 1 });
    expect(cardFor(r, { id: "p2" })).toMatchObject({ effects: ["Def Dwn (C)"], effectsHidden: 2 });
    expect(cardFor(r, { id: "gm", isGM: true })).toMatchObject({ effectsHidden: 0 });
    expect(cardFor(r, { id: "nobody" })).toMatchObject({ effects: 3 });
  });

  it("a row with no Unit is the defender's, as every row was", () => {
    const r = input(["Bleed"], [null]);
    expect(cardFor(r, { id: "p2" }).effects).toEqual(["Bleed"]);
    expect(cardFor(r, { id: "p1" }).effects).toBe(1);
  });

  it("a Turn's end says what its handlers landed", async () => {
    const { turnEndCard } = await import("../../module/engine/turn-report.mjs");
    const t = (key, data) => (data ? `${key}:${JSON.stringify(data)}` : key);
    const card = turnEndCard([], (id) => ({ k: "Lancer" })[id], t, undefined, null, null, "FGT.TurnReport.Title",
      [{ unitId: "k", summary: { id: "stun", name: "Stun", outcome: "applied", chance: null } }]);
    expect(card).toContain("Lancer: Stun");
    expect(turnEndCard([], () => "", t)).toBeNull();
  });

  it("every damage-step event returns its lines to the card", () => {
    const attack = code("engine/attack.mjs");
    for (const event of ["damageStepStart", "damageDealt", "damageTaken", "attackLanded", "attackPerformed", "damageStepEnd"]) {
      expect(attack, event).toMatch(new RegExp(`applyWithLines\\(intents, "${event}"`));
    }
    // The damage step's card rows, each named; the damage batch's own lines (a
    // defeat's `unitFelled` heal, #330) among them.
    const rows = attack.match(/setFlag\("fgt", "effects", \[\.\.\.said, \.\.\.cardRows\(\[([\s\S]*?)\]\)\]\)/)?.[1] ?? "";
    for (const row of ["...startRows", "...before", "...applied", "...held", "...(result.lines ?? [])", "...taken.rows",
      "...receivedRows", "...dealt.rows", "...stepEnd.rows"]) {
      expect(rows, row).toContain(row);
    }
  });

  it("a Skill's writes collect what the handlers they raise did", () => {
    const skill = code("engine/skill-use.mjs");
    expect(skill).toMatch(/const applyWorld = \(intents, source\) => applyWorldIntents\(intents, source, \{ sink \}\);/);
    // Per phase, so a handler's line follows the phase that raised it.
    expect(skill).toMatch(/applied\.push\(\.\.\.sink\.splice\(0\)\);\s*\}\s*applied\.push\(\.\.\.sink\.splice\(0\)\);/);
  });
});

describe("Shadow of Longing on herself (#239 reading 4)", () => {
  it("may choose her, as Primordial Rune may choose Scáthach", () => {
    const sel = src("abilities", "gogh-shadow-of-longing.yml").targeting.selection;
    expect(sel).toMatchObject({ relations: ["ally", "self"], includeSelf: true, chooser: "chosen", count: 1 });
  });
});

describe("a Curse tick on her, found live (#239)", () => {
  it("is held at 1 by Sunflower's Curse, which only the attack pipeline read", async () => {
    const { flooredTick } = await import("../../module/engine/scheduler.mjs");
    const gogh = { damageFloors: [{ floor: 1, defId: "curse", source: "Sunflower's Curse" }] };
    expect(flooredTick(63, "curse", gogh, 40)).toBe(39);
    expect(flooredTick(63, "curse", gogh, 1)).toBe(0);
    expect(flooredTick(63, "curse", gogh, 500)).toBe(63);
    // Another source is not floored.
    expect(flooredTick(63, "poison", gogh, 40)).toBe(63);
  });

  it("is said on a Turn's card, by the effect's name", async () => {
    const { periodicCard } = await import("../../module/engine/field-report.mjs");
    const t = (key, data) => (data ? `${key}:${JSON.stringify(data)}` : key);
    const card = periodicCard([{ unitId: "g", unitName: "Foreigner", defId: "curse", amount: 63 }], t,
      "FGT.TurnReport.Title", () => "Curse");
    expect(card).toContain("FGT.TurnReport.Title");
    expect(card).toContain('"who":"Foreigner","amount":63,"effect":"Curse"');
    expect(code("engine/scheduler-hooks.mjs")).toMatch(/await postPeriodicReport\(turnIntents, worldIO\(\), "FGT\.TurnReport\.Title"\);/);
  });
});

describe("an Evade 1 time is spent by the Evade it gives (#239, live)", () => {
  it("the plain Evade rung spends a count-limited automatic evasion, as the reaction ability's did", () => {
    const attack = code("engine/attack.mjs");
    expect(attack).toMatch(/if \(outcome\.spends\) await applyBatch\(\[I\.consumeUse\(state\.defenderId, outcome\.spends\)\], "autoEvade"\);/);
    expect(attack).toMatch(/spends: spentBy\(outcome, plan, defender\),/);
    expect(attack).toMatch(/return plan\.autoSucceed\?\.uses \? \(plan\.autoSucceed\.defId \?\? null\) : null;/);
  });
});

describe("Terror's Stun is a flat 60%, found live (#239)", () => {
  it("states bypassChanceModifiers, so no resistance or bonus meets the die", () => {
    const terror = src("effects", "terror.yml");
    const stun = terror.rules[0].then.find((a) => a.key === "ApplyEffect");
    expect(stun).toMatchObject({ chance: "@magnitude", bypassChanceModifiers: true });
  });
});

describe("successfully Attacked, one reader (#239 reading 3)", () => {
  it("is hit, not hurt, plus an Instakill that skipped the damage", async () => {
    const { successfullyAttacked } = await import("../../module/rules/damage/riders.mjs");
    expect(successfullyAttacked({ skipped: null, result: { total: 0, flags: {} } })).toBe(true);
    expect(successfullyAttacked({ skipped: "instakill", result: null })).toBe(true);
    expect(successfullyAttacked({ skipped: null, result: { total: 0, flags: { negatedBy: "Anti-Purge" } } })).toBe(false);
    expect(successfullyAttacked({ skipped: null, result: { total: 0, flags: { negatedBy: "Substitution" } } })).toBe(false);
    expect(successfullyAttacked({ skipped: null, result: { total: 0, flags: { concealmentVeil: { effects: false } } } })).toBe(false);
  });

  it("every Def Dwn (A) and (C) drains once per Attack on attackReceived (readings 3b, 3c)", () => {
    for (const file of ["def-dwn-a.yml", "def-dwn-c.yml"]) {
      const drain = src("effects", file).rules.find((r) => r.key === "OnEvent");
      expect(drain, file).toMatchObject({ event: "attackReceived", predicate: ["not:attack:plainDamage"] });
    }
    const attack = code("engine/attack.mjs");
    expect(attack).toMatch(/successfullyAttacked\(\{ skipped, result \}\) && !state\.attack\?\.plainDamage\s*&& claimReceived\(state, message\)/);
    // Alpi and the 'Gogh' buff read the same test at the Phase's end.
    expect(attack).toMatch(/successfullyAttacked\(\{ skipped: m\.getFlag\("fgt", "result"\) \? null : "skipped"/);
  });
});
