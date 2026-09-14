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
import { MODIFIABLE_PATHS } from "../../module/rules/derived.mjs";

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

describe("Drake — Beyond the Uncharted", () => {
  const a = src("abilities", "drake-beyond-the-uncharted.yml");
  const uncharted = src("effects", "uncharted.yml");
  const group = a.phases.find((p) => p.target === "reuse");
  const selfOnly = a.phases.find((p) => p.target === "self");

  it("is an A-rank Skill on a 4◈ cooldown", () => {
    expect(a.rank).toBe("A");
    expect(a.cooldown).toBe("4◈");
  });

  it("prefers the ship and falls back to a 2-panel radius", () => {
    const anchor = a.targeting.anchor;
    expect(anchor.kind).toBe("conditional");
    expect(anchor.branches[0].predicate).toEqual(["self:onPlatform:platform-golden-hind"]);
    expect(anchor.branches[0].anchor).toEqual(
      { kind: "platform", platformId: "platform-golden-hind" },
    );
    expect(anchor.branches[0].shape).toEqual({ kind: "zone" });
    expect(anchor.otherwise.anchor).toEqual({ kind: "self" });
    expect(anchor.otherwise.shape).toEqual({ kind: "chebyshevRadius", r: 2 });
  });

  it("names the platform by its content id, not by its filename", () => {
    // `golden-hind` is the file; `platform-golden-hind` is the id the
    // `onPlatform` facet and the `platform` anchor both resolve against.
    const hind = src("platforms", "golden-hind.yml");
    expect(hind.id).toBe("platform-golden-hind");
    expect(a.targeting.anchor.branches[0].anchor.platformId).toBe(hind.id);
  });

  it("reaches allies and herself", () => {
    expect(a.targeting.selection.relations).toEqual(["ally", "self"]);
    expect(a.targeting.selection.includeSelf).toBe(true);
  });

  it("gives the group NP DmUp 20, Atk Up 20/10 and NP Regen, each 1◈", () => {
    const byId = (id) => group.effects.find((e) => e.id === id);
    expect(byId("npDmUp")).toMatchObject({ duration: "1◈", magnitude: 20 });
    expect(byId("atkUp")).toMatchObject({ duration: "1◈", magnitude: 20, npMagnitude: 10 });
    expect(byId("npRegen")).toMatchObject({ duration: "1◈" });
  });

  it("gives Uncharted to DRAKE ALONE, not to the group", () => {
    // "Applies the 'Uncharted' buff for 1◈ Turns TO DRAKE" -- where effects
    // 1-3 say "affects all allied Units". A phase that defaulted to `reuse`
    // would hand every ally +3 Detect and nothing would complain.
    expect(selfOnly.effects).toHaveLength(1);
    expect(selfOnly.effects[0]).toMatchObject({ id: "uncharted", duration: "1◈" });
    expect(group.effects.map((e) => e.id)).not.toContain("uncharted");
  });

  it("increases Detect by 3", () => {
    expect(uncharted.rules[0]).toMatchObject({ key: "StatDelta", stat: "detect", add: 3 });
  });

  it("writes a stat `restoreModifiable` puts back each preparation", () => {
    // Without this the +3 lands again on every prepare and her Detect drifts --
    // the defect Mad Enhancement's MOV +2 had, at 6 -> 8 -> 10 -> 12.
    expect(MODIFIABLE_PATHS).toContain("detect");
  });
});

describe("Drake — Pioneer of the Stars", () => {
  const a = src("abilities", "drake-pioneer-of-the-stars.yml");
  const selfPhase = a.phases.find((p) => p.kind === "applyEffects" && p.target === "self");
  const groupPhase = a.phases.find((p) => p.kind === "applyEffects" && p.target === "reuse");

  it("is EX rank on a 4◈ cooldown", () => {
    expect(a.rank).toBe("EX");
    expect(a.cooldown).toBe("4◈");
  });

  it("reduces BOTH Noble Phantasms by 1◈+⅔◈, DOWNWARDS (spec R4)", () => {
    const phase = a.phases.find((p) => p.kind === "cooldown");
    expect(phase.changes).toEqual([
      { scope: "np", ticks: "1◈+⅔◈", direction: "down" },
    ]);
  });

  it("states `direction: down`, without which the cooldown GOES UP", () => {
    // `cooldownChanges`: const down = change.ticks !== undefined
    //   ? (change.direction === "down") : ...
    // With `ticks` and no direction, `down` is false and the reduction becomes
    // an increase. Kingprotea's Huge Scale is the precedent and states it.
    // The OnEvent ACTION of the same name is the opposite convention -- it
    // negates `ticks` itself. Two readers, two rules; Drake uses both.
    const phase = a.phases.find((p) => p.kind === "cooldown");
    expect(phase.changes[0].direction).toBe("down");
    const kingprotea = src("abilities", "kingprotea-huge-scale.yml");
    const precedent = kingprotea.phases.find((p) => p.kind === "cooldown");
    expect(precedent.changes[0].direction).toBe("down");
  });

  it("gives Drake Pierce for 1◈+½◈", () => {
    expect(selfPhase.effects).toContainEqual(
      expect.objectContaining({ id: "pierce", duration: "1◈+½◈" }),
    );
  });

  it("gives allies within 2 panels S.Crit Up 10 for ⅓◈", () => {
    expect(groupPhase.effects).toContainEqual(
      expect.objectContaining({ id: "sCritUp", duration: "⅓◈", magnitude: 10 }),
    );
  });

  it("uses two different durations across its two target sets", () => {
    const durations = new Set(
      [...selfPhase.effects, ...groupPhase.effects].map((e) => e.duration),
    );
    expect(durations).toEqual(new Set(["1◈+½◈", "⅓◈"]));
  });

  it("aims the S.Crit Up at a radius, and the Pierce at her alone", () => {
    // "to all allied Units within a 2 panel area of herself" -- a different
    // set from the self-only Pierce.
    expect(a.targeting.anchor).toEqual({ kind: "self" });
    expect(a.targeting.shape).toEqual({ kind: "chebyshevRadius", r: 2 });
    expect(a.targeting.selection.relations).toEqual(["ally", "self"]);
    expect(selfPhase.effects.map((e) => e.id)).toEqual(["pierce"]);
  });
});

describe("The Golden Hind — the statline her sheet prints", () => {
  const h = src("platforms", "golden-hind.yml");

  it("keeps what it already had", () => {
    expect(h.baseHealth).toBe(2500);
    expect(h.mov).toBe(6);
    expect(h.range).toEqual({ panels: 5, targets: 1 });
    expect(h.baseAttack).toEqual({ str: 0, mag: 200 });
    expect(h.detect).toBe(4);
    expect(h.footprint).toEqual({ w: 4, h: 3 });
    expect(h.capacity).toBe(9);
    expect(h.attributes).toEqual(["large", "mechanical"]);
  });

  it("has an Agility of 10", () => {
    expect(h.agility).toBe(10);
  });

  it("shares Drake's Luck rather than carrying its own", () => {
    expect(h.inherit).toEqual({ luck: { from: "summoner" } });
  });

  it("moves onto occupied panels and sits on top", () => {
    // `sharesPanel`, NOT `movesOntoOccupiedPanels`: the second is Basmu's and
    // knocks the occupants back. This co-locates and displaces nobody.
    expect(h.sharesPanel).toBe(true);
  });

  it("attacks with MAG, its only Base Attack", () => {
    expect(h.normalAttack).toEqual({ mode: "fixed", component: "mag" });
  });

  it("replaces Drake's Normal Attack but NOT her Move (spec R8)", () => {
    // Quetzalcoatl's mount takes `move: true` because her sheet says "Quetz's
    // Move AND Normal Attack is replaced". Drake's says only the Attack.
    expect(h.replacesRiderAction).toEqual({ roles: ["owner"], normalAttack: true });
    expect(h.replacesRiderAction.move).toBeUndefined();
    const quetz = src("platforms", "quetzalcoatlus.yml");
    expect(quetz.replacesRiderAction.move).toBe(true);
  });

  it("can be switched off by its owner at any window, with no lockout", () => {
    // "Drake can deactivate the Golden Hind during her Turn, or at the start
    // or end of any Turn or Round." Quetz's identical block adds a 2◈ lockout;
    // Drake's sheet states none.
    expect(h.deactivation).toEqual({ byOwner: true, window: "any" });
    expect(h.deactivation.lockout).toBeUndefined();
  });
});

describe("Drake — Voyager of the Storm", () => {
  const a = src("abilities", "drake-voyager-of-the-storm.yml");

  it("is an A+ passive that modifies nothing", () => {
    // Flavour, with its mechanical consequence on the Noble Phantasm. Nemo's
    // identically-named passive is recorded the same way and for the same
    // reason: inventing a rule element here would author an inert one.
    expect(a.rank).toBe("A+");
    expect(a.passive).toBe(true);
    expect(a.passiveRules).toBeUndefined();
    expect(a.phases).toBeUndefined();
  });
});
