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
    const events = rules.flatMap((r) => r.events ?? [r.event]);
    expect(events).toEqual(expect.arrayContaining(["turnEnd", "actedTurnEnd", "roundEnd"]));
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
