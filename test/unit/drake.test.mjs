/**
 * @file Francis Drake — the pure halves of her kit.
 * @see char_orig_sheets/Copia de Francis Drake.md
 * @see docs/superpowers/specs/2026-09-13-drake-design.md
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

import { lookup } from "../../module/domain/tables.mjs";
import { Rank } from "../../module/domain/rank.mjs";

const src = (dir, file) =>
  parse(readFileSync(join(process.cwd(), "packs/_source", dir, file), "utf8"));

describe("Drake — the statline", () => {
  const d = src("servants", "drake.yml");

  it("is the sheet's statline exactly", () => {
    expect(d.parameters).toEqual({ str: "D", end: "C", agi: "B", mag: "E", luc: "EX" });
    expect(d.baseHealth).toBe(1000);
    expect(d.mov).toBe(6);
    expect(d.range).toEqual({ panels: 3, targets: 1 });
    expect(d.baseAttack).toEqual({ str: 75, mag: 100 });
    expect(d.sustainability).toBe("2◈");
  });

  it("takes all three combat numbers from the tables, deviating nowhere", () => {
    // The first Servant in the set for whom this is true of all three.
    expect(d.baseHealth).toBe(lookup("baseHealthByEnd", Rank.parse("C")));
    expect(d.baseAttack.str).toBe(lookup("baseAttackStrByStr", Rank.parse("D")));
    expect(d.baseAttack.mag).toBe(lookup("baseAttackMagByMag", Rank.parse("E")));
  });

  it("is Chaotic Evil out of England, with the sheet's four attributes", () => {
    expect(d.alignment).toEqual({ order: "chaotic", morality: "evil" });
    expect(d.region).toEqual(["england"]);
    expect(d.attributes).toEqual(["female", "servant", "star", "humanoid"]);
  });

  it("swings with STR, though her BA(MAG) is higher (spec R3)", () => {
    // Her sheet names no component. Semiramis is the precedent. It also reads
    // right: MAG rank E is negated outright by any Magic Resistance D or better.
    expect(d.normalAttack).toEqual({ mode: "fixed", component: "str" });
  });

  it("opens with no Galleon Tokens and no ceiling on them (spec R9)", () => {
    expect(d.resources.galleonTokens).toEqual({ value: 0, max: null });
  });
});

describe("Drake — Magic Resistance D is a ref and nothing else", () => {
  const d = src("servants", "drake.yml");

  it("carries it at rank D", () => {
    expect(d.abilities).toContainEqual({ ref: "class-magic-resistance", rank: "D" });
  });

  it("gets both of the sheet's numbers from the rank tables", () => {
    // "MAG damage taken is reduced by 20%" and "debuffs reduced by 10%".
    expect(lookup("magicResistancePercent", Rank.parse("D"))).toBe(20);
    expect(lookup("magicResistanceDebuffResist", Rank.parse("D"))).toBe(10);
  });
});

describe("Drake — Riding B (spec R2)", () => {
  const drake = src("class-skills", "riding-drake.yml");
  const medusa = src("class-skills", "riding-medusa.yml");
  const active = src("effects", "riding-active.yml");
  const grantsOf = (skill) =>
    skill.passiveRules.filter((r) => r.key === "GrantedAbility");

  it("gates ALL THREE grants on the Active, where Medusa gates only two", () => {
    // Her Active names "'Double Move', 'Riding Attack', and 'Passenger Seat'";
    // Medusa's names only the last two. The difference between the two sheets
    // is the whole reason a Medusa variant exists, so it is honoured both ways.
    const rules = grantsOf(drake);
    expect(rules).toHaveLength(1);
    expect(rules[0].abilities).toEqual(["doubleMove", "ridingAttack", "passengerSeat"]);
    expect(rules[0].predicate).toEqual(["self:effect:ridingActive"]);
  });

  it("grants nothing at all without the Active — the negative is the ruling", () => {
    // If any GrantedAbility rule on Drake's Riding lacks the predicate, one of
    // the three is permanent and R2 is not implemented.
    for (const rule of grantsOf(drake)) {
      expect(rule.predicate).toContain("self:effect:ridingActive");
    }
  });

  it("leaves Medusa's Double Move unconditional", () => {
    const unconditional = grantsOf(medusa).filter((r) => !r.predicate);
    expect(unconditional).toHaveLength(1);
    expect(unconditional[0].abilities).toEqual(["doubleMove"]);
  });

  it("takes its MOV from the magnitude it passes, not from Medusa's literal", () => {
    // `ridingMov` at B is 4 and at A is 5. The effect must carry neither.
    expect(lookup("ridingMov", Rank.parse("B"))).toBe(4);
    expect(lookup("ridingMov", Rank.parse("A"))).toBe(5);
    const mov = active.rules.find((r) => r.key === "MovDelta");
    expect(mov.value).toBe("@magnitude");
    expect(mov.isBuff).toBe(false);
  });

  it("passes 4 for Drake and 5 for Medusa", () => {
    const magnitudeOf = (skill) =>
      skill.phases[0].rules.find((r) => r.effect?.id === "ridingActive").magnitude;
    expect(magnitudeOf(drake)).toBe(lookup("ridingMov", Rank.parse("B")));
    expect(magnitudeOf(medusa)).toBe(lookup("ridingMov", Rank.parse("A")));
  });

  it("reads its cooldown off the table the sheet agrees with", () => {
    expect(lookup("ridingCooldown", Rank.parse("B"))).toBe("2◈");
  });
});

describe("Drake — Galleon Tokens", () => {
  const d = src("servants", "drake.yml");
  const on = (event) => d.passiveRules.find((r) => r.key === "OnEvent" && r.event === event);

  it("pays out on a Crit, off damageDealt, gated on attack:crit", () => {
    expect(on("damageDealt").predicate).toEqual(["attack:crit"]);
  });

  it("reduces both NPs by a raw Turn, not by a ◈ (spec R4)", () => {
    const cd = on("damageDealt").then.find((a) => a.key === "CooldownDelta");
    expect(cd).toEqual({ key: "CooldownDelta", scope: "np", delta: -1 });
    expect(cd.ticks).toBeUndefined();
  });

  it("gives the token a 15% chance, as a chance and not as a roll", () => {
    // `ResourceDelta` reads a `roll` as the AMOUNT, so `roll` here would grant
    // her 1d100 tokens rather than one of them 15% of the time.
    const gain = on("damageDealt").then.find((a) => a.key === "ResourceDelta");
    expect(gain).toEqual(
      { key: "ResourceDelta", resource: "galleonTokens", delta: 1, chance: 15 },
    );
    expect(gain.roll).toBeUndefined();
  });

  it("loses exactly one at the end of every Round, unconditionally", () => {
    const decay = on("roundEnd");
    expect(decay.predicate).toBeUndefined();
    expect(decay.then).toEqual([
      { key: "ResourceDelta", resource: "galleonTokens", delta: -1 },
    ]);
  });

  it("has the Active's tokens nowhere near the Crit passive's chance", () => {
    // The Active grants 3 with certainty (Task 4); only the Crit rolls.
    const chanced = d.passiveRules
      .flatMap((r) => r.then ?? [])
      .filter((a) => a.chance !== undefined);
    expect(chanced).toHaveLength(1);
  });
});

describe("Drake — Blazing Golden Rule", () => {
  const a = src("abilities", "drake-blazing-golden-rule.yml");
  const ignoreDef = src("effects", "ignore-def.yml");
  const effects = a.phases.find((p) => p.kind === "applyEffects").effects;
  const byId = (id) => effects.find((e) => e.id === id);

  it("is an A-rank Skill on a 4◈ cooldown, used on her own Turn", () => {
    expect(a.rank).toBe("A");
    expect(a.cooldown).toBe("4◈");
    expect(a.timing).toEqual({ window: "ownTurn" });
  });

  it("applies NP Regen, Atk Up 30/20, and Ignore Def, each for 1◈", () => {
    expect(byId("npRegen")).toMatchObject({ duration: "1◈" });
    expect(byId("atkUp")).toMatchObject({ duration: "1◈", magnitude: 30, npMagnitude: 20 });
    expect(byId("ignoreDef")).toMatchObject({ duration: "1◈" });
  });

  it("grants three Galleon Tokens, by path and with no chance attached", () => {
    const phase = a.phases.find((p) => p.kind === "resource");
    expect(phase.changes).toEqual([
      { key: "resources.galleonTokens.value", delta: 3 },
    ]);
    // A `resource` PHASE takes a full path; the OnEvent action takes the bare
    // name. Two readers, two shapes.
    expect(JSON.stringify(a.phases)).not.toContain("chance");
  });

  it("carries Ignore Def alone, without Kiritsugu's halved Invuln", () => {
    expect(ignoreDef.rules).toHaveLength(1);
    expect(ignoreDef.rules[0]).toEqual(
      { key: "AttackProperty", property: "ignoresDefUp", value: true },
    );
    // `penetration.yml` is the two-clause version and is NOT reusable here:
    // reusing it would hand her a halved Invuln her sheet never grants.
    expect(src("effects", "penetration.yml").rules).toHaveLength(2);
  });

  it("is a lasting buff, not a property of one attack", () => {
    expect(ignoreDef.polarity).toBe("buff");
    expect(ignoreDef.id).toBe("ignoreDef");
  });
});
