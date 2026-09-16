/**
 * @file Nameless Forest, against her sheet.
 * @see char_orig_sheets/Copia de Nursery Rhyme.md
 *
 * Part 3 of four. The only ability in either roster that wins by waiting.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { applicationChance } from "../../module/rules/checks.mjs";
import { lookup, HOME_BASE_ESCAPE_MODIFIER } from "../../module/domain/tables.mjs";
import { Rank } from "../../module/domain/rank.mjs";
import { resolveCheck } from "../../module/rules/checks.mjs";
import { collectContributions } from "../../module/rules/elements.mjs";
import { baseAttackFor } from "../../module/domain/base-attack.mjs";
import { clampToMax } from "../../module/domain/health.mjs";
import {
  deathRollOutcome, DEATH_ROLL_FORMULA, DEATH_ROLL_THRESHOLD,
  mayAttemptEscape, escapeModifiers,
} from "../../module/rules/nameless-forest.mjs";

describe("R3 — the MAG ladder, at all six grades", () => {
  // The sign question decides the whole ability, so every row is pinned. An
  // implementer who reads "EX: -3" as "harder for EX" flips all six and
  // produces a Noble Phantasm strongest against exactly the Servants it should
  // struggle with.
  it.each([
    ["EX", -3], ["A", -2], ["B", -1], ["C", 0], ["D", 1], ["E", 2],
  ])("MAG %s modifies the dice by %i", (grade, expected) => {
    expect(lookup("namelessForestEscape", Rank.parse(grade))).toBe(expected);
  });

  it("and a NEGATIVE modifier makes escape MORE likely", () => {
    // The direction proved against the check itself rather than asserted:
    // `resolveCheck` computes total = roll + mods and succeeds on total <= target.
    const ex = resolveCheck({ roll: 8, target: 7, modifiers: [{ source: "MAG EX", value: -3 }] });
    const e = resolveCheck({ roll: 8, target: 7, modifiers: [{ source: "MAG E", value: 2 }] });
    expect(ex.success).toBe(true);
    expect(e.success).toBe(false);
  });

  it("R4 — the Home Base term STACKS with it", () => {
    // "(stacks with the MAG Rank modifiers as seen below)". A MAG EX unit at
    // home rolls at -6.
    const both = resolveCheck({
      roll: 12, target: 7,
      modifiers: [{ source: "MAG EX", value: -3 }, { source: "Home Base", value: -3 }],
    });
    expect(both.total).toBe(6);
    expect(both.success).toBe(true);
  });

  it("R3 — and both terms point the SAME way", () => {
    // The coherence check. The sheet separately refuses to delete a Unit at
    // home, so safety and magical power each make the forest easier to walk out
    // of. If the MAG rows were flipped, these two would disagree.
    expect(lookup("namelessForestEscape", Rank.parse("EX"))).toBeLessThan(0);
    expect(HOME_BASE_ESCAPE_MODIFIER).toBeLessThan(0);
  });

  it("does not interpolate a `+` step the sheet never mentions", () => {
    // The sheet names grades, not the dense ladder. A+ escapes exactly as A.
    expect(lookup("namelessForestEscape", Rank.parse("A+"))).toBe(-2);
  });
});

describe("E2 — a rank table indexed by the target's own parameter", () => {
  const collect = (rules, refs) =>
    collectContributions([{ id: "nf", name: "Nameless Forest", rank: "C", passiveRules: rules }],
      { options: new Set(), refs });

  it("reads the grade off a ref path instead of the owning ability's rank", () => {
    const out = collect(
      [{ key: "CheckModifier", check: "luck", table: "namelessForestEscape", rankFrom: "@self.parameters.mag" }],
      { self: { parameters: { mag: "A" } } },
    );
    // A, not C. The ability is Rank C, and reading the table by the ability's
    // rank -- which is what every other table in the corpus does -- gives 0
    // here and silently makes the whole ladder do nothing.
    expect(out.checkModifiers[0].value).toBe(-2);
  });

  it("falls back to the owning ability's rank when no rankFrom is given", () => {
    const out = collectContributions(
      [{ id: "x", rank: "B", passiveRules: [{ key: "CheckModifier", check: "luck", table: "namelessForestEscape" }] }],
      { options: new Set(), refs: {} },
    );
    expect(out.checkModifiers[0].value).toBe(-1);
  });

  it("contributes NOTHING when the path resolves to no grade", () => {
    // A Master has no `parameters`. Reading `undefined` as EX would hand every
    // Master the best escape in the game -- and a contribution of 0 is
    // indistinguishable from MAG C, which is why this drops the element rather
    // than scaling it to zero.
    const out = collect(
      [{ key: "CheckModifier", check: "luck", table: "namelessForestEscape", rankFrom: "@self.parameters.mag" }],
      { self: { parameters: {} } },
    );
    expect(out.checkModifiers).toEqual([]);
  });

  it("and nothing when the refs carry no such path at all", () => {
    const out = collect(
      [{ key: "CheckModifier", check: "luck", table: "namelessForestEscape", rankFrom: "@self.parameters.mag" }],
      {},
    );
    expect(out.checkModifiers).toEqual([]);
  });
});

describe("R2 — the reductions are WRITES, and do not spring back", () => {
  // Every other stat change in this engine is a CONTRIBUTION that springs back
  // when its source leaves. These must not: "(Health and Luck that are lost
  // from the effects of this NP are not restored)".
  //
  // A MaxDelta scaled by a held token count would look correct, pass a casual
  // test, and silently restore everything the instant a Unit escaped.

  it("baseAttackFor subtracts a permanent penalty", () => {
    // Base Attack is DERIVED from the parameters on every prepare, so a write
    // to it is recomputed away on the next one. The reduction has to be
    // something the derivation itself subtracts.
    const sheet = { parameters: { str: "B", mag: "B" } };
    const before = baseAttackFor(sheet);
    const after = baseAttackFor({ ...sheet, baseAttackPenalty: { str: 30, mag: 30 } });
    expect(after.str).toBe(before.str - 30);
    expect(after.mag).toBe(before.mag - 30);
  });

  it("R1 — and 10 per token, never the struck-through 20", () => {
    // The sheet strikes through the larger figures: "reduce its Max Health by
    // ~~50~~ 25, Base Attack (both) by ~~20~~ 10". Superseded text is not an
    // alternative reading.
    const sheet = { parameters: { str: "B", mag: "B" } };
    const three = baseAttackFor({ ...sheet, baseAttackPenalty: { str: 30, mag: 30 } });
    expect(baseAttackFor(sheet).str - three.str).toBe(3 * 10);
  });

  it("never drops a Base Attack below zero", () => {
    const out = baseAttackFor({ parameters: { str: "E", mag: "E" }, baseAttackPenalty: { str: 9999, mag: 9999 } });
    expect(out.str).toBe(0);
    expect(out.mag).toBe(0);
  });

  it("is untouched when no penalty has been taken", () => {
    const sheet = { parameters: { str: "A", mag: "C" } };
    expect(baseAttackFor({ ...sheet, baseAttackPenalty: { str: 0, mag: 0 } })).toEqual(baseAttackFor(sheet));
  });

  it("alsoCurrent pulls a current value down with its ceiling", () => {
    // A Unit at full Health whose maximum drops must not sit above it.
    expect(clampToMax({ value: 1000, max: 1000 }, -25)).toEqual({ value: 975, max: 975 });
  });

  it("...but does not heal a wounded one", () => {
    // A Unit at 400 of 1000 goes to 400 of 975, not to 975.
    expect(clampToMax({ value: 400, max: 1000 }, -25)).toEqual({ value: 400, max: 975 });
  });

  it("...and never below zero", () => {
    expect(clampToMax({ value: 10, max: 20 }, -100)).toEqual({ value: 0, max: 0 });
  });
});

describe("E3 — the death roll (F12, F13, F14, R5, R6)", () => {
  it("F12 — does not roll at 2 tokens", () => {
    expect(deathRollOutcome({ tokens: 2, roll: 1, inHomeBase: false }))
      .toMatchObject({ rolls: false, deleted: false });
  });

  it("F12 — rolls at 3", () => {
    expect(deathRollOutcome({ tokens: 3, roll: 12, inHomeBase: false }))
      .toMatchObject({ rolls: true, deleted: false });
  });

  it("F13 — deleted on a roll EQUAL to the count", () => {
    // "equal to or lower than". The boundary is the clause.
    expect(deathRollOutcome({ tokens: 3, roll: 3, inHomeBase: false }).deleted).toBe(true);
  });

  it("F13 — and not on a roll one above it", () => {
    expect(deathRollOutcome({ tokens: 3, roll: 4, inHomeBase: false }).deleted).toBe(false);
  });

  it("F13 — the more tokens it carries, the likelier that is", () => {
    expect(deathRollOutcome({ tokens: 9, roll: 9, inHomeBase: false }).deleted).toBe(true);
    expect(deathRollOutcome({ tokens: 3, roll: 9, inHomeBase: false }).deleted).toBe(false);
  });

  it("F14/R6 — a Unit at home STILL ROLLS, and is refused the outcome", () => {
    // Skipping the roll and refusing the consequence are indistinguishable
    // today and will not be once anything reads the roll log. The sheet says a
    // Unit cannot DISAPPEAR at home -- it refuses the disappearance, not the
    // die.
    expect(deathRollOutcome({ tokens: 9, roll: 1, inHomeBase: true }))
      .toMatchObject({ rolls: true, deleted: false, reason: "inHomeBase" });
  });

  it("F14 — and a Unit at home below the threshold does not roll either", () => {
    expect(deathRollOutcome({ tokens: 1, roll: 1, inHomeBase: true }).rolls).toBe(false);
  });

  it("the die is a d12, and the threshold is 3", () => {
    expect(DEATH_ROLL_FORMULA).toBe("1d12");
    expect(DEATH_ROLL_THRESHOLD).toBe(3);
  });
});

describe("E4/F8 — the escape is OFFERED, once per Turn, on the bearer's own Turn", () => {
  const caught = (over = {}) => ({
    id: "foe", factionId: "blue", effects: ["namelessForest"],
    parameters: { mag: "A" }, turnState: {}, ...over,
  });
  const board = { activeFactionId: "blue" };

  it("stands for an affected Unit on its own Turn", () => {
    expect(mayAttemptEscape(caught(), board)).toMatchObject({ ok: true });
  });

  it("does not stand for a Unit the forest has not caught", () => {
    expect(mayAttemptEscape(caught({ effects: [] }), board))
      .toMatchObject({ ok: false, reason: "notAffected" });
  });

  it("does not stand on somebody ELSE's Turn", () => {
    // "During an affected Unit's Turn". Every caught Unit would otherwise be
    // offered an escape at the top of every Turn in the Round.
    expect(mayAttemptEscape(caught(), { activeFactionId: "red" }))
      .toMatchObject({ ok: false, reason: "notItsTurn" });
  });

  it("F8 — once per Turn, and no more", () => {
    expect(mayAttemptEscape(caught({ turnState: { namelessForestAttempts: 1 } }), board))
      .toMatchObject({ ok: false, reason: "alreadyTriedThisTurn" });
  });
});

describe("R3/R4 — what the escaping Unit's check carries", () => {
  const mods = (unit) => escapeModifiers(unit, lookup, (g) => Rank.parseOrNull(g));

  it("the MAG term, read off the UNIT's own parameter", () => {
    expect(mods({ parameters: { mag: "A" } })).toEqual([{ source: "MAG A", value: -2 }]);
  });

  it("R4 — and the Home Base term, summed with it", () => {
    // A MAG EX Unit at home rolls at -6.
    const out = mods({ parameters: { mag: "EX" }, inHomeBase: true });
    expect(out.reduce((n, m) => n + m.value, 0)).toBe(-6);
  });

  it("omits a MAG C term rather than showing a zero", () => {
    // "C: No change" is not a modifier, and a "+0" row on the card is noise.
    expect(mods({ parameters: { mag: "C" } })).toEqual([]);
  });

  it("gives a Unit with no MAG parameter nothing at all", () => {
    expect(mods({ parameters: {} })).toEqual([]);
  });

  it("R3 — a MAG E Unit is PENALISED, which is the direction the sheet gives", () => {
    expect(mods({ parameters: { mag: "E" } })).toEqual([{ source: "MAG E", value: 2 }]);
  });
});

const effect = (id) => parse(readFileSync(`packs/_source/effects/${id}.yml`, "utf8"));
const ability = (id) => parse(readFileSync(`packs/_source/abilities/${id}.yml`, "utf8"));
const servant = (id) => parse(readFileSync(`packs/_source/servants/${id}.yml`, "utf8"));

describe("the Nameless Forest marker (F8–F14)", () => {
  const f = () => effect("nameless-forest");

  it("is a STATUS, so ordinary buff-removal cannot strip it", () => {
    // Neither a buff nor a debuff in any useful sense, and a Noble Phantasm
    // whose entire counter-play is one Luck Check must not also fall to a
    // Cleanse -- the sheet gives exactly one way out and spends six lines
    // describing it.
    expect(f().polarity).toBe("status");
    expect(f().unremovable).toBe(true);
  });

  it("F10 — the MAG ladder, read off the BEARER's own parameter", () => {
    const mag = f().rules.find((r) => r.table === "namelessForestEscape");
    expect(mag).toMatchObject({ key: "CheckModifier", check: "luck", rankFrom: "@self.parameters.mag" });
  });

  it("F11/R4 — and the Home Base term, summed with it", () => {
    const home = f().rules.find((r) => r.key === "CheckModifier" && r.predicate);
    expect(home).toMatchObject({ check: "luck", value: -3 });
    expect(home.predicate).toContain("self:inHomeBase");
  });

  it("F11/R3 — both terms are NEGATIVE, so both help", () => {
    // The coherence check: the sheet separately refuses to delete a Unit at
    // home, so safety and magical power point the same way.
    const home = f().rules.find((r) => r.key === "CheckModifier" && r.predicate);
    expect(home.value).toBeLessThan(0);
    expect(lookup("namelessForestEscape", Rank.parse("EX"))).toBeLessThan(0);
  });

  it("F12/R5 — the death roll fires at turnEnd, not roundEnd", () => {
    // "at the end of the UNIT'S Turn", not Nursery's and not the Round's.
    // Fired at roundEnd it would roll once per Round for everybody at once,
    // which is a different ability.
    const roll = f().rules.find((r) => r.event === "turnEnd");
    expect(roll).toBeTruthy();
    expect(roll.then[0]).toMatchObject({
      key: "NamelessForestDeathRoll", resource: "namelessForestTokens",
    });
  });

  it("F12 — and declares its d12 on the action, so pendingRolls gathers it", () => {
    // A roll nobody gathered is a roll that never arrives, and the action
    // correctly emits nothing when it does not -- which would be silent.
    const roll = f().rules.find((r) => r.event === "turnEnd");
    expect(roll.then[0].roll).toMatchObject({ formula: "1d12" });
  });
});

describe("R7 — the resistance an escape leaves behind", () => {
  const r = () => effect("nameless-forest-resistance");

  it("subtracts from the chance of being caught again", () => {
    // `applicationChance` computes `base + inflictBonus - resist`, so
    // resistance is what subtracts and the value is POSITIVE.
    const rule = r().rules[0];
    expect(rule).toMatchObject({ key: "ApplicationChance", direction: "incoming", effect: "namelessForest" });
    expect(rule.value).toBe("@magnitude");
  });

  it("stacks, so three escapes compound to 70%", () => {
    // "this effect can stack" -- and the applier sums magnitudes, so three
    // applications of 10 make 30 off a base of 100.
    expect(r().stacking).toBe("magnitudeStacks");
    expect(applicationChance({ base: 100, resist: 30 }).percent).toBe(70);
  });

  it("is scoped to the forest and not to everything", () => {
    // This Unit has learned to walk out of a forest, not to shrug off the
    // world.
    expect(r().rules[0].effect).toBe("namelessForest");
  });

  it("is permanent and unremovable", () => {
    // It survives losing every token and being caught again -- it is a property
    // of the UNIT. A resistance a Cleanse could strip would let Nursery
    // re-catch a Unit that had already earned its way out three times.
    expect(r().unremovable).toBe(true);
    expect(r().volatility).toBe("nonVolatile");
  });
});

describe("Nursery Rhyme: Nameless Forest (F1–F7)", () => {
  const a = () => ability("nursery-nameless-forest");
  const grant = () => a().passiveRules.find((r) => r.event === "roundEnd");

  it("F1 — Rank C, NP, Anti-Unit, and PASSIVE", () => {
    expect(a()).toMatchObject({ rank: "C", isNP: true, isPassive: true });
    expect(a().npTags).toEqual(["antiUnit"]);
  });

  it("F1 — passive, so no cooldown and no timing window", () => {
    // It is the only ability in either roster that wins by waiting. A cooldown
    // on it would be a cooldown on nothing.
    expect(a().cooldown ?? null).toBeNull();
    expect(a().timing ?? null).toBeNull();
  });

  it("R8/F2 — at the end of every ROUND, not every Turn", () => {
    // Fired at turnEnd, a three-Turn Round would triple the rate and kill a
    // Unit in a third of the time.
    expect(grant().event).toBe("roundEnd");
  });

  it("F2 — reaching enemy Units within 2 panels", () => {
    for (const action of grant().then) {
      expect(action).toMatchObject({ target: "nearby", radius: 2, relations: ["enemy"] });
    }
  });

  it("F4 — and not at all while Nursery carries NP Seal", () => {
    // On HER, not on the target, which is why it is a `self:` predicate on a
    // rule whose actions reach somebody else.
    expect(grant().predicate).toContainEqual({ not: "self:effect:npSeal" });
  });

  it("F3 — the marker lands BEFORE the token that makes it matter", () => {
    // Reversed, a Unit's first token would sit on a Unit with no ladder and no
    // die.
    const kinds = grant().then.map((x) => x.key);
    expect(kinds.indexOf("ApplyEffect")).toBeLessThan(kinds.indexOf("ResourceDelta"));
  });

  it("F5/R1 — Max Health −25 per token, and never the struck-through 50", () => {
    const hp = grant().then.find((x) => x.stat === "health.max");
    expect(hp).toMatchObject({ delta: -25, alsoCurrent: true });
  });

  it("F6/R1 — BOTH Base Attacks −10, through the penalty the derivation reads", () => {
    // A write to `baseAttack` would be recomputed away on the next prepare.
    const str = grant().then.find((x) => x.stat === "baseAttackPenalty.str");
    const mag = grant().then.find((x) => x.stat === "baseAttackPenalty.mag");
    expect(str.delta).toBe(10);
    expect(mag.delta).toBe(10);
  });

  it("F7 — Max Luck −1 per token", () => {
    expect(grant().then.find((x) => x.stat === "luck.max")).toMatchObject({ delta: -1, alsoCurrent: true });
  });

  it("R2 — and NOTHING in the grant is a contribution that could spring back", () => {
    // The clause the whole part is arranged around. Every reduction is a
    // StatDelta -- a write -- and none is a MaxDelta scaled by the held count,
    // which would restore everything the instant a Unit escaped.
    const writes = grant().then.filter((x) => x.key === "StatDelta");
    expect(writes).toHaveLength(4);
    expect(grant().then.some((x) => x.key === "MaxDelta")).toBe(false);
  });

  it("her Servant file gains exactly one ref", () => {
    expect(servant("nursery-rhyme").abilities).toContainEqual({ ref: "nursery-nameless-forest" });
  });
});
