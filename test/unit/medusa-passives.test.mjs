/**
 * @file Medusa's four passive skills.
 * @see packs/_source/servants/medusa.yml, docs/D-servant-data-sheets.md §D.25
 *
 * Divinity `E−` is the first sub-E rank in the corpus and needed no new
 * document: the `divinity` table is scaled at ±5 per step and its own header
 * records `E- (5)` as verified.
 */

import { describe, it, expect } from "vitest";
import { lookup } from "../../module/domain/tables.mjs";
import { Rank } from "../../module/domain/rank.mjs";
import { collectContributions } from "../../module/rules/elements.mjs";
import { rollOptionsFor } from "../../module/rules/options.mjs";
import { readFileSync } from "node:fs";
import { parse } from "yaml";

describe("Divinity E−", () => {
  it("is +5, from the existing scaled table", () => {
    // "(Passive) All damage dealt is increased by 5 including NP."
    expect(lookup("divinity", Rank.parse("E-"))).toBe(5);
  });

  it("sits one step below E, which the rank domain already parses", () => {
    const r = Rank.parse("E-");
    expect([r.grade, r.steps]).toEqual(["E", -1]);
    expect(lookup("divinity", Rank.parse("E"))).toBe(10);
  });
});

describe("Independent Action — the Civilian clause", () => {
  const rule = {
    key: "SustainabilityGain",
    event: "unitDefeated",
    value: 1,
    predicate: ["self:free"],
    targetPredicate: ["target:type:civilian"],
  };
  const asAbility = () => ([{
    id: "self", name: "Medusa", slug: "self", active: true,
    rules: [rule], passiveRules: [], activeRules: [],
  }]);

  it("collects for a FREE Servant", () => {
    // "Every time Medusa kills a Civilian when she is a Free Servant, increase
    // her Sustainability by 1◈ Turns."
    const out = collectContributions(asAbility(), { options: new Set(["self:free"]) });
    expect(out.eventHandlers).toEqual([
      { event: "unitDefeated", sustainabilityGain: 1, source: "Medusa" },
    ]);
  });

  it("collects nothing for a contracted one, which is the clause's own gate", () => {
    expect(collectContributions(asAbility(), { options: new Set() }).eventHandlers).toEqual([]);
  });
});

describe("`self:free` is reachable from a unit's own state", () => {
  // The regression that made the clause above inert. `options.mjs` emits
  // `self:free` from `unit.contract`, and `snapshot.mjs` built its self-option
  // set without one -- so the predicate could never hold, for Medusa or for
  // Jack the Ripper, whom the emitter's own comment names as its reason.
  it("emits self:free from a contract", () => {
    const options = rollOptionsFor({ attacker: { kind: "servant", contract: "free" }, defender: null });
    expect(options.has("self:free")).toBe(true);
  });

  it("does not emit it for a contracted Servant", () => {
    const options = rollOptionsFor({ attacker: { kind: "servant", contract: "contracted" }, defender: null });
    expect(options.has("self:free")).toBe(false);
  });

  it("emits the self rank ladder, which was unreachable for the same reason", () => {
    const options = rollOptionsFor({
      attacker: { kind: "servant", parameters: { mag: "B" } }, defender: null,
    });
    expect(options.has("self:rank:mag:gte:B")).toBe(true);
    expect(options.has("self:rank:mag:gte:C")).toBe(true);
    expect(options.has("self:rank:mag:gte:A")).toBe(false);
  });
});

describe("Riding A+ Active — the MOV it promises (Ch. 03)", () => {
  // "Used during your Turn. Increases MOV by 5 panels for this Turn."
  //
  // The Active is a USED ability: it has phases, so `classifyAbility` calls it
  // `active` and never reaches the `activeRules`-means-mode fallback. That is
  // correct -- it is not a mode -- but it means `contributionsOf` reads
  // `active: false` for it and drops its `activeRules` entirely, so the MOV Up
  // was authored, shipped, and applied by nothing. The third time this exact
  // shape has bitten (Monstrous Strength, Hatred of Achilles, this).
  //
  // The lasting change therefore belongs on the effect the Active APPLIES,
  // which `contributionsOf` collects with `active: true` because an effect that
  // is present is in force.
  const ridingActive = () => ([{
    id: "e1", name: "Riding (Active)", slug: "ridingActive", rank: null, active: true,
    fromEffect: true, defId: "ridingActive",
    rules: [{ key: "MovDelta", value: 5, isBuff: false }],
    passiveRules: [], activeRules: [],
  }]);

  it("contributes +5 MOV while the marker is up", () => {
    const out = collectContributions(ridingActive(), { options: new Set() });
    const mov = out.statDeltas.filter((d) => d.stat === "mov");
    expect(mov).toHaveLength(1);
    expect(mov[0].value).toBe(5);
  });

  it("is not a buff, so buff removal cannot take it", () => {
    // "The MOV Up from the Active is NOT a buff: it cannot be removed by buff
    // removal and is not prevented by an effect that blocks buffs."
    const out = collectContributions(ridingActive(), { options: new Set() });
    expect(out.statDeltas.find((d) => d.stat === "mov").isBuff).toBe(false);
  });
});

describe("Riding A+ Active — the authored content, not a stand-in", () => {
  // The tests above prove the MECHANISM carries +5 MOV. These prove the
  // shipped files actually use it, which is the half that was broken: every
  // piece of this worked except where the number was written down.
  const read = (p) => parse(readFileSync(p, "utf8"));
  const skill = read("packs/_source/class-skills/riding-medusa.yml");
  const marker = read("packs/_source/effects/riding-active.yml");

  it("puts the MOV Up on the effect the Active applies", () => {
    const mov = (marker.rules ?? []).find((r) => r.key === "MovDelta");
    expect(mov).toBeDefined();
    expect(mov.value).toBe(5);
    expect(mov.isBuff).toBe(false);
  });

  it("keeps no activeRules on the skill, where nothing would collect them", () => {
    expect(skill.activeRules ?? []).toHaveLength(0);
  });

  it("still applies the marker, so Riding Attack and Passenger Seat unlock", () => {
    // The MOV moving must not cost the Active its other half.
    const applied = skill.phases.flatMap((p) => p.rules ?? []).map((r) => r.effect?.id);
    expect(applied).toContain("ridingActive");
  });

  it("agrees with the ridingMov table at her rank", () => {
    // A+ reads grade A, and the table is flat per grade (perStep 0).
    expect(lookup("ridingMov", Rank.parse("A+"))).toBe(5);
  });
});
