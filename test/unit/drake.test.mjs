/**
 * @file Francis Drake — the pure halves of her kit.
 * @see char_orig_sheets/Copia de Francis Drake.md
 * @see docs/superpowers/specs/2026-09-13-drake-design.md
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

import { lookup } from "../../module/domain/tables.mjs";
import { Rank } from "../../module/domain/rank.mjs";
import { EXECUTORS } from "../../module/rules/elements.mjs";
import { ELEMENT_DESCRIPTORS } from "../../module/rules/authoring/elements.mjs";
import { MODIFIABLE_PATHS, applyStatDeltas } from "../../module/rules/derived.mjs";
import { detectRangeOf } from "../../module/rules/identity.mjs";

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
    // `value`, not `add` -- see the Uncharted describe below for the live
    // crash that distinction caused.
    expect(uncharted.rules[0]).toMatchObject({ key: "StatDelta", stat: "detect", value: 3 });
  });

  it("does NOT write the stat, which is what stops it drifting", () => {
    // This asserted the opposite until the live pass: `detect` was in
    // `MODIFIABLE_PATHS`, and because a Servant's stored Detect is null the
    // reset skipped it and the +3 accumulated. See the Uncharted describe.
    expect(MODIFIABLE_PATHS).not.toContain("detect");
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
    // `injuryOnlyFromNP` joins them in the three-clauses describe below.
    expect(h.attributes).toContain("large");
    expect(h.attributes).toContain("mechanical");
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

describe("The Golden Hind — boarding (spec R7)", () => {
  const h = src("platforms", "golden-hind.yml");

  it("is a flat 1d10 needing a 10, from enemies only", () => {
    expect(h.boarding).toEqual({ die: 10, target: 10, byRelation: "enemy" });
  });

  it("states a target equal to its die, so only the top face boards", () => {
    // "successfully boards if a 10 is rolled" -- one face in ten, and the
    // comparison is `roll >= target`.
    expect(h.boarding.target).toBe(h.boarding.die);
  });
});

describe("The Golden Hind — the toll (spec R6, R11, R12)", () => {
  const h = src("platforms", "golden-hind.yml");

  it("charges her MASTER 50 on the Round boundary", () => {
    expect(h.upkeep.every).toBe("round");
    expect(h.upkeep.cost).toEqual({ kind: "health", amount: 50, payer: "ownerMaster" });
  });

  it("charges on the Round, not on a 1◈ period (spec R6)", () => {
    // Her sheet strikes out "Round/1◈ Turns" in favour of "full Round", and
    // with a variable turnsPerRound the two are different moments.
    expect(h.upkeep.every).not.toBe("1◈");
    // The Quetzalcoatlus is the tick-period platform, and stays one.
    expect(src("platforms", "quetzalcoatlus.yml").upkeep.every).toBe("1◈");
  });

  it("closes instead of charging when he cannot pay (spec R12)", () => {
    expect(h.upkeep.endWhenUnaffordable).toBe(true);
  });

  it("replaces the normal NP Master-health loss rather than stacking (R11)", () => {
    expect(h.upkeep.supersedes).toEqual(["npCost"]);
  });

  it("carries BOTH documented shapes of `upkeep` at once", () => {
    // The first platform to do so. `runUpkeep` filters on `every` and
    // `attack.mjs` reads `supersedes`; the filter is the only thing keeping
    // the two readers apart, so this is the test that holds it.
    expect(h.upkeep.every).toBeDefined();
    expect(h.upkeep.supersedes).toBeDefined();
  });
});

describe("The Golden Hind — the three small clauses", () => {
  const h = src("platforms", "golden-hind.yml");

  it("only rolls an Injury Roll against a Noble Phantasm", () => {
    // Carried as an ATTRIBUTE, not a schema field: `rules/injury.mjs` has
    // tested for `injuryOnlyFromNP` since it was written -- naming the Golden
    // Hind in its own comment -- and no content ever carried it. Adding a
    // second mechanism would have left the first one inert for ever.
    expect(h.attributes).toContain("injuryOnlyFromNP");
  });

  it("locks its owner aboard, and nobody else", () => {
    expect(h.lockAboard).toEqual(["owner"]);
  });

  it("is switched off the moment Drake is NP Sealed", () => {
    expect(h.deactivateOn).toEqual(["npSeal"]);
  });
});

describe("Drake — Golden Hind: Wild Hunt (NP1)", () => {
  const a = src("abilities", "drake-golden-hind-wild-hunt.yml");

  it("is an A+ Anti-Army Noble Phantasm", () => {
    expect(a.rank).toBe("A+");
    expect(a.isNP).toBe(true);
    expect(a.npTags).toEqual(["antiArmy"]);
  });

  it("deals no damage — it puts a ship on the board", () => {
    const kinds = a.phases.map((p) => p.kind);
    expect(kinds).toContain("summonPlatform");
    expect(kinds).not.toContain("damage");
  });

  it("raises the Golden Hind, and does not board her Master", () => {
    const phase = a.phases.find((p) => p.kind === "summonPlatform");
    expect(phase.platformId).toBe("platform-golden-hind");
    // Her sheet says "then place Drake upon it" and says nothing about her
    // Master, unlike Quetzalcoatl's, which boards hers if adjacent.
    expect(phase.boardMasterIfAdjacent).toBe(false);
  });

  it("counts its cooldown from deactivation, not from use (spec R10)", () => {
    // "7◈+⅓◈ Turns AFTER the Golden Hind is destroyed/deactivated." A ship
    // that stays up for six Rounds has not been counting down for six of them.
    expect(a.cooldown).toEqual({ max: "7◈+⅓◈", countFrom: "deactivation" });
  });

  it("uses the same authored shape Jack's Mist and Zero Sail use", () => {
    // `countFrom: deactivation` was built for Presence Concealment and is read
    // by `engine/cooldown.mjs`; nothing new was needed for R10.
    expect(src("abilities", "jack-the-mist.yml").cooldown.countFrom).toBe("deactivation");
    expect(src("abilities", "nemo-zero-sail.yml").cooldown.countFrom).toBe("deactivation");
  });
});

describe("Drake — every ability she names now exists", () => {
  const d = src("servants", "drake.yml");

  it("names exactly the eight entries on her sheet", () => {
    expect(d.abilities).toHaveLength(8);
  });

  it("resolves all eight refs", () => {
    for (const entry of d.abilities) {
      // `class-magic-resistance` lives at class-skills/magic-resistance.yml and
      // `class-riding-drake` at class-skills/riding-drake.yml -- the `class-`
      // prefix names the FOLDER, and is stripped from the filename.
      const isClass = entry.ref.startsWith("class-");
      const dir = isClass ? "class-skills" : "abilities";
      const base = isClass ? entry.ref.replace(/^class-/, "") : entry.ref;
      const file = join(process.cwd(), "packs/_source", dir, `${base}.yml`);
      expect(existsSync(file), `${entry.ref} is unresolved`).toBe(true);
    }
  });
});

describe("Drake — Golden Wild Hunt (NP2)", () => {
  const a = src("abilities", "drake-golden-wild-hunt.yml");

  it("hits 7x3 from whichever anchor applies, the same shape on both", () => {
    const [ship] = a.targeting.anchor.branches;
    expect(ship.shape).toEqual({ kind: "orientedRect", short: 3, long: 7 });
    expect(a.targeting.anchor.otherwise.shape).toEqual(ship.shape);
  });

  it("uses short/long, never w/h", () => {
    // The anchor's facing decides which becomes the width, which is what makes
    // one entry describe both the 7x3 and the 3x7 the sheet names.
    expect(a.targeting.anchor.branches[0].shape.w).toBeUndefined();
  });

  it("uses the ship's Base Attack even with no ship (spec R1)", () => {
    // The sheet exempts only the Range. `contentId`, not `unit`: a board
    // lookup cannot answer a Noble Phantasm that fires with no ship on the
    // board, and would fall back to her own 100.
    // `base.sources`, NOT a top-level `sources`: `baseSpecFor` reads
    // `damage.base` and otherwise falls through to the caster's declared
    // component. Found live -- the breakdown read "self BA(MAG) x 1" = 100.
    expect(a.damage.sources).toBeUndefined();
    expect(a.damage.base.sources).toEqual([
      { contentId: "platform-golden-hind", component: "mag", factor: 1 },
    ]);
    expect(a.damage.multiplier).toBe(4);
    expect(a.damage.flatBonus).toBe(100);
  });

  it("reads 200 off the platform document, so the sum is 900", () => {
    const hind = src("platforms", "golden-hind.yml");
    expect(hind.baseAttack.mag).toBe(200);
    expect(hind.baseAttack.mag * a.damage.multiplier + a.damage.flatBonus).toBe(900);
  });

  it("scales on Total damage, on the NP's own damage block (spec R5)", () => {
    // NOT a `DamageModifier` rule element on the ability: `contributionsOf`
    // collects an ability's `rules` UNCONDITIONALLY, beside its passives, so
    // authored there these would apply to every Normal Attack she makes.
    // Found live, and her NP2 is the only ability in the corpus with a
    // top-level `rules:` -- nothing had ever exercised the difference.
    expect(a.rules).toBeUndefined();
    expect(a.damage.totalModifiers).toHaveLength(2);
  });

  it("gives +10% per token and −15% at none", () => {
    const [per, zero] = a.damage.totalModifiers;
    expect(per.value).toBe(10);
    expect(per.perResource).toEqual({ resource: "galleonTokens", each: 1 });
    expect(zero.value).toBe(-15);
    expect(zero.predicate).toEqual(["self:resourceEmpty:galleonTokens"]);
  });

  it("keeps the two clauses mutually exclusive by arithmetic", () => {
    // At zero tokens the per-token band contributes nothing and is dropped;
    // the penalty's predicate is the only thing true there.
    const [per, zero] = a.damage.totalModifiers;
    expect(per.predicate).toBeUndefined();
    expect(zero.perResource).toBeUndefined();
  });

  it("only targets enemies", () => {
    expect(a.targeting.selection.relations).toEqual(["enemy"]);
  });

  it("keeps its own 7◈+⅓◈ cooldown, counted from use unlike NP1", () => {
    // NP1's clock waits for the ship to go; this one is an ordinary attack.
    expect(a.cooldown).toBe("7◈+⅓◈");
  });
});

describe("Riding's MOV Up reaches the effect it is applied with", () => {
  // FOUND LIVE. Drake used Riding, gained all three grants -- and her MOV
  // stayed 6 where her sheet says 10. The phase carried `magnitude: 4` and the
  // applied instance carried 0.
  //
  // `applyPhaseEffects` does `const spec = rule.effect ?? rule`, then reads the
  // magnitude off `spec` ALONE. The corpus has two authored shapes:
  //
  //   { id: atkUp, magnitude: 10 }                  -- Nemo's Voyager
  //   { effect: { id: ridingActive }, magnitude: 4 } -- every Riding variant
  //
  // Only the first was read. `npMagnitude` on the very next line has always
  // fallen back to the rule, so the asymmetry was the defect rather than the
  // fallback -- and it made Medusa's +5 work only because her number was the
  // effect's own hard-coded literal until this pass moved it out.
  const drake = src("class-skills", "riding-drake.yml");
  const medusa = src("class-skills", "riding-medusa.yml");
  const rule = (skill) => skill.phases[0].rules.find((r) => r.effect?.id === "ridingActive");

  it("authors the magnitude beside a nested effect, the shape that was dropped", () => {
    expect(rule(drake).effect.magnitude).toBeUndefined();
    expect(rule(drake).magnitude).toBe(4);
    expect(rule(medusa).magnitude).toBe(5);
  });

  it("keeps the effect itself parameterized, so neither rank is hard-coded", () => {
    const active = src("effects", "riding-active.yml");
    const mov = active.rules.find((r) => r.key === "MovDelta");
    expect(mov.value).toBe("@magnitude");
  });
});

describe("Uncharted raises Detect, and a bad magnitude cannot take the board down", () => {
  // FOUND LIVE, as a thrown TypeError out of `currentBoard()`.
  //
  // `StatDelta`'s `add` is the ATTRIBUTE-tag list -- Divinity's `divine` --
  // and `uncharted` authored `add: 3` against an authoring vocabulary that
  // described the field as a number. The executor then did
  // `for (const attribute of el.add)` over a 3 and threw, and the throw came
  // out of `contributionsOf`, which every board snapshot runs.
  //
  // So one mistyped effect stopped the whole board being read, and
  // `validate:content` passed it. Three things were wrong and all three are
  // fixed: the content, the vocabulary that invited it, and an executor that
  // escalated a bad clause into a dead match.
  const uncharted = src("effects", "uncharted.yml");

  it("uses `value` for the number, not `add`", () => {
    const rule = uncharted.rules[0];
    expect(rule).toEqual({ key: "StatDelta", stat: "detect", value: 3 });
    expect(rule.add).toBeUndefined();
  });

  it("survives a `StatDelta` whose `add` is a number instead of a tag list", () => {
    const out = { statDeltas: [], attributes: [], modifiers: [] };
    expect(() => EXECUTORS.StatDelta(
      { key: "StatDelta", stat: "detect", add: 3 },
      { rank: null, source: "bad content", out, ctx: {} },
    )).not.toThrow();
  });

  it("still grants attributes when `add` really is a list", () => {
    // Divinity's own shape must keep working.
    const out = { statDeltas: [], attributes: [], modifiers: [] };
    EXECUTORS.StatDelta(
      { key: "StatDelta", stat: "attributes", add: ["divine"] },
      { rank: null, source: "Divinity", out, ctx: {} },
    );
    expect(out.attributes).toEqual(["divine"]);
  });

  it("advertises `add` as a tag list in the authoring vocabulary", () => {
    const add = ELEMENT_DESCRIPTORS.StatDelta.fields.find((f) => f.key === "add");
    expect(add.type).toBe("tokenList");
  });
});

describe("Uncharted's +3 Detect — the base, and the drift", () => {
  // FOUND LIVE, twice over, and neither showed in any unit test.
  //
  // 1. THE BASE. Drake's Detect read 2 (the Rider table) and Uncharted took it
  //    to 3, not 5. `applyStatDeltas` wrote `system.detect`, whose stored
  //    value is null for every Servant -- so the delta started from 0 and threw
  //    the class base away.
  //
  // 2. THE DRIFT. `restoreModifiable` deliberately leaves a null stored value
  //    alone, because that is the case where the model derives the field
  //    itself. A Servant's Detect is NOT derived by the model -- it is derived
  //    at read time by `detectRangeOf` -- so nothing reset it, and the +3
  //    landed again on every preparation: 6, 9, 12, 15, 18 across five.
  //
  // Both are the same root cause, and both are fixed by never writing it:
  // `detect` leaves `MODIFIABLE_PATHS`, and `detectRangeOf` adds the deltas to
  // the base it already resolves.
  const rider = (over = {}) => ({ kind: "servant", classContainer: "rider", ...over });
  const uncharted = { stat: "detect", value: 3, source: "Uncharted" };

  it("leaves a Rider at the class table with nothing applied", () => {
    expect(detectRangeOf(rider(), null)).toBe(2);
  });

  it("adds to the class base rather than replacing it", () => {
    expect(detectRangeOf(rider({ statDeltas: [uncharted] }), null)).toBe(5);
  });

  it("cannot drift, because nothing writes the stat", () => {
    // The same unit read five times is the same number.
    const u = rider({ statDeltas: [uncharted] });
    expect([1, 2, 3, 4, 5].map(() => detectRangeOf(u, null))).toEqual([5, 5, 5, 5, 5]);
    expect(MODIFIABLE_PATHS).not.toContain("detect");
  });

  it("still lets a platform state its own Detect outright", () => {
    // The Golden Hind's `Detect: 4` must beat any class table.
    const hind = { kind: "platform", detect: 4 };
    expect(detectRangeOf(hind, null)).toBe(4);
    expect(detectRangeOf({ ...hind, statDeltas: [uncharted] }, null)).toBe(7);
  });
});

describe("a detect delta is never written to the document", () => {
  // The half that removing it from `MODIFIABLE_PATHS` did not fix: the delta
  // was still APPLIED, so it was written and then never reset. Nothing may
  // write `detect` at all -- `detectRangeOf` sums the deltas at read time.
  it("produces no `detect` change", () => {
    const out = applyStatDeltas(
      { detect: null, mov: 6 },
      [{ stat: "detect", value: 3, source: "Uncharted" },
       { stat: "mov", value: 4, source: "Riding" }],
    );
    expect(out.changes.detect).toBeUndefined();
    expect(out.changes.mov).toBe(10);
  });
});

describe("Raising the Golden Hind costs her Master nothing (spec R11)", () => {
  // FOUND LIVE: her Master went 250 -> 197 on activation, paying the A+ Rank
  // table's 53. The platform's own `upkeep.supersedes: [npCost]` covers every
  // Noble Phantasm fired once the ship is UP -- `pendingCosts` looks for a
  // platform on the board owned by the caster -- but at the activation there
  // is no such platform yet, so nothing superseded anything.
  //
  // Her sheet puts no condition on the sentence: "This effect overwrites the
  // normal Master Health loss when a Servant uses its NP."
  const np1 = src("abilities", "drake-golden-hind-wild-hunt.yml");
  const hind = src("platforms", "golden-hind.yml");

  it("declares a zero cost that supersedes the Rank table's", () => {
    expect(np1.additionalCosts).toEqual([
      { id: "goldenHindUpkeep", kind: "masterHealth", amount: 0, supersedes: ["npCost"] },
    ]);
  });

  it("uses the same shape Ramesseum Tentyris does", () => {
    const ozy = src("abilities", "ozymandias-ramesseum-tentyris.yml");
    expect(ozy.additionalCosts[0].supersedes).toEqual(["npCost"]);
  });

  it("leaves the per-Round toll as the whole price", () => {
    // Nothing here charges 50; `runUpkeep` does, once a Round.
    expect(hind.upkeep.cost.amount).toBe(50);
    expect(np1.additionalCosts[0].amount).toBe(0);
  });
});
