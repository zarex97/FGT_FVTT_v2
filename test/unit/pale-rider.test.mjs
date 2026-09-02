/**
 * Pale Rider — the clauses that needed engine.
 *
 * @see char_orig_sheets/Copia de Pale Rider.md, docs/D-servant-data-sheets.md §D.26
 * @see docs/superpowers/plans/2026-09-02-pale-rider.md
 *
 * Almost nothing on his sheet is an attack: he cannot be damaged, cannot
 * attack and cannot react. What he has instead is an area that leaks Health, a
 * moving prison anchored to his Master, an aura of parameter-keyed effects and
 * four summoned spirits. These pin the general pieces each of those needed.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { GRANTS, hasGranted } from "../../module/rules/granted.mjs";
import { zonRadius } from "../../module/rules/zon.mjs";
import { collectContributions } from "../../module/rules/elements.mjs";

const effect = (name) => parse(readFileSync(`packs/_source/effects/${name}.yml`, "utf8"));
const classSkill = (name) => parse(readFileSync(`packs/_source/class-skills/${name}.yml`, "utf8"));
const ability = (name) => parse(readFileSync(`packs/_source/abilities/${name}.yml`, "utf8"));

/* -------------------------------------------------------------------------- */

describe("Riding EX — the four passives", () => {
  it("names two grants no other Servant carries", () => {
    // "3. Pale Rider cannot perform Normal Attacks. 4. Pale Rider cannot
    // Evade, Block, or Counter." Grants rather than a Range of 0 or an empty
    // reaction list: he has a MAG Base Attack the sheet prints, and the
    // defender's rung still exists -- the only answer is nothing.
    expect(GRANTS.noNormalAttack).toBe("noNormalAttack");
    expect(GRANTS.noReactions).toBe("noReactions");
    const unit = { grantedAbilities: ["noNormalAttack", "noReactions"] };
    expect(hasGranted(unit, GRANTS.noNormalAttack)).toBe(true);
    expect(hasGranted(unit, GRANTS.noReactions)).toBe(true);
  });

  it("swells the Master's ZON by the Servant's MOV, and by six more on Riding's Turn", () => {
    // "Pale Rider's Master's ZON is increased by X panels, X = Pale Rider's
    // MOV." A bonus that names a STAT, which `ZonBonus` could not express.
    const master = { zon: 0, rank: null };
    const base = { servantClasses: ["rider"], mov: 6, zonBonuses: [{ fromStat: "mov", stacks: true }] };
    const withBonus = zonRadius(base, master);
    const without = zonRadius({ ...base, zonBonuses: [] }, master);
    expect(withBonus - without).toBe(6);

    // Read literally: Riding's Active is "+6 MOV for this Turn" and `mov` on
    // the snapshot includes it, so the zone swells by six on that Turn too.
    // The sheet gives no cap and none is imposed.
    expect(zonRadius({ ...base, mov: 12 }, master) - withBonus).toBe(6);
  });

  it("is authored as its own class-skill variant, not a rank row", () => {
    // The PASSIVE SET differs -- none of Double Move / Riding Attack /
    // Passenger Seat -- and a rank table cannot say that.
    const riding = classSkill("riding-pale-rider");
    expect(riding.rank).toBe("EX");
    const granted = riding.passiveRules.find((r) => r.key === "GrantedAbility");
    expect(granted.abilities).toEqual(["noNormalAttack", "noReactions"]);
    expect(riding.passiveRules.find((r) => r.key === "ZonBonus")).toMatchObject({
      fromStat: "mov", stacks: true,
    });
    // "The MOV Up effect from Riding's Active usage is not a buff."
    expect(riding.activeRules[0]).toMatchObject({ key: "MovDelta", value: 6, isBuff: false });
  });
});

describe("the three new effects", () => {
  it("Charm is the id control.mjs already looks for", () => {
    const charm = effect("charm");
    expect(charm.id).toBe("charm");
    expect(charm.polarity).toBe("debuff");
    // `mental` is a VOLATILITY -- Appendix A's own classification, and what
    // Heracles' Bravery and Jack's Mental Pollution both name, so both resist
    // Charm without either sheet listing it. `severity` is the other ladder
    // entirely (normal｜instakill｜death｜erase), which is what the content
    // validator caught when this was first authored the wrong way round.
    expect(charm.volatility).toBe("mental");
    expect(charm.severity).toBe("normal");
  });

  it("Regen heals 10% of maximum on all three boundaries", () => {
    // "Health is restored by 10% of its maximum value at the end of the Unit's
    // Turn, the end of any Turn the Unit Acts, and at the end of the Round."
    const rules = effect("regen").rules;
    // `event`, singular, holding an array -- which is what `normalizeHandler`
    // reads. Authored as `events:` it listened for `undefined` and healed
    // nobody; this assertion is the reason that was caught.
    const events = rules.flatMap((r) => (Array.isArray(r.event) ? r.event : [r.event]));
    expect(events).toEqual(["turnEnd", "actedTurnEnd", "roundEnd"]);
    expect(rules[0].then[0]).toMatchObject({ key: "Heal", percentOfMax: 10 });
  });

  it("Dmg Cut is a flat negation that spends one of three uses", () => {
    // "Applies Dmg Cut for 1◈ Turns, 3 times; all damage taken is reduced by
    // 100." A charge count `DamageNegation` never carried.
    const def = effect("dmg-cut");
    expect(def.uses).toBe(3);
    const out = collectContributions([{ id: "dmgCut", name: "Dmg Cut", rules: def.rules }]);
    expect(out.damageNegation[0]).toMatchObject({ mode: "flat", consumesUse: true });
  });
});

/* -------------------------------------------------------------------------- */
/*  Contagion — the first passive bounded field                                */
/* -------------------------------------------------------------------------- */

describe("Contagion", () => {
  const contagion = ability("pale-rider-contagion");

  it("is a passive field that follows him, with no duration and nothing to cast it", () => {
    // "(Passive) The 2 panel area around Pale Rider IS the Contagion area."
    const f = contagion.field;
    expect(f.passive).toBe(true);
    expect(f.geometry).toMatchObject({ kind: "followsUnit", shape: { kind: "square", size: 5 } });
    expect(f.duration).toBeUndefined();
  });

  it("lets Doomsday's area outrank the Active's marker, in file order", () => {
    // "Instead of its usual Range" is a precedence claim, and the file is
    // where precedence lives: first match wins.
    const [first, second] = contagion.field.geometry.overrides;
    expect(first).toMatchObject({ whileFieldOpen: "pale-rider-doomsday-come", sameAs: "pale-rider-doomsday-come" });
    expect(second).toMatchObject({ whileOwnerHas: "contagionExpanded", shape: { size: 9 } });
  });

  it("answers all three boundaries the sheet names", () => {
    // Trigger 1 is the OWNER's Turn ending, reaching every enemy inside;
    // trigger 2 is one enemy's own Turn ending inside, acted or not.
    const events = contagion.field.interiorEvents;
    expect(events.map((e) => e.event)).toEqual(["unitTurnEnd", "turnEnd", "actedTurnEnd"]);
    expect(events.every((e) => e.relations).valueOf()).toBe(true);
    expect(events.find((e) => e.event === "actedTurnEnd").requiresActed).toBe(true);
  });

  it("takes 100 as a Health loss rather than as damage, everywhere", () => {
    // "Not affected by effects that modify damage taken (does not count as
    // 'damage')" -- so never `Damage`, which is the pipeline.
    for (const event of contagion.field.interiorEvents) {
      expect(event.onFail[0]).toEqual({ key: "HealthLoss", amount: 100 });
      expect(event.onFail.some((a) => a.key === "Damage")).toBe(false);
    }
  });

  it("rewrites all three numbers under Doomsday Come, and 150 only near the Master", () => {
    const [near, inside] = contagion.field.interiorEvents[0].branches;
    expect(near.predicate).toEqual([
      "self:inField:pale-rider-doomsday-come", "self:withinOfOwnerMaster:3",
    ]);
    expect(near.onFail[0]).toEqual({ key: "HealthLoss", amount: 150 });
    expect(inside.onFail[0]).toEqual({ key: "HealthLoss", amount: 100 });
    for (const branch of [near, inside]) {
      expect(branch.onFail.find((a) => a.effect?.id === "poison").chance).toBe(75);
      expect(branch.onFail.find((a) => a.effect?.id === "charm").chance).toBe(25);
    }
  });

  it("uses 50/10 with no Doomsday standing", () => {
    const base = contagion.field.interiorEvents[0].onFail;
    expect(base.find((a) => a.effect?.id === "poison").chance).toBe(50);
    expect(base.find((a) => a.effect?.id === "charm")).toMatchObject({ chance: 10, duration: "1◈" });
  });

  it("has an Active that only marks him — the area reads the marker", () => {
    expect(contagion.cooldown).toBe("4◈");
    expect(contagion.phases).toEqual([
      { kind: "applyEffects", target: "self", effects: [{ id: "contagionExpanded", duration: "1◈" }] },
    ]);
  });
});
