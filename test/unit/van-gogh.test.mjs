/**
 * @file Van Gogh — the Servant whose own debuff is her fuel.
 * @see char_orig_sheets/Copia de Van Gogh.md
 * @see docs/superpowers/specs/2026-09-14-van-gogh-design.md
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

import { lookup } from "../../module/domain/tables.mjs";
import { Rank } from "../../module/domain/rank.mjs";
import { computeDamage } from "../../module/rules/damage/pipeline.mjs";

const src = (dir, file) =>
  parse(readFileSync(join(process.cwd(), "packs/_source", dir, file), "utf8"));

describe("Van Gogh — the statline", () => {
  const g = src("servants", "van-gogh.yml");

  it("is the sheet's statline exactly", () => {
    expect(g.parameters).toEqual({ str: "E", end: "B", agi: "C", mag: "A", luc: "D" });
    expect(g.baseHealth).toBe(1250);
    expect(g.mov).toBe(5);
    expect(g.range).toEqual({ panels: 3, targets: 1 });
    expect(g.baseAttack).toEqual({ str: 50, mag: 200 });
    expect(g.sustainability).toBe("2◈");
  });

  it("attacks with MAG, which her sheet states in a Note (spec R4)", () => {
    // Unusual enough that the sheet has a Note for it. BA(MAG) 200 against a
    // STR of 50 -- reading the default would quarter her Normal Attack.
    expect(g.normalAttack).toEqual({ mode: "fixed", component: "mag" });
  });

  it("is Chaotic Neutral with the sheet's six attributes", () => {
    expect(g.alignment).toEqual({ order: "chaotic", morality: "neutral" });
    expect(g.attributes).toEqual(
      ["female", "servant", "man", "humanoid", "threatToHumanity", "child"],
    );
  });

  it("takes Base Health and BA(MAG) from the tables", () => {
    expect(g.baseHealth).toBe(lookup("baseHealthByEnd", Rank.parse("B")));
    expect(g.baseAttack.mag).toBe(lookup("baseAttackMagByMag", Rank.parse("A")));
  });
});

describe("Van Gogh — Divinity B+ is a ref and nothing else (spec R5)", () => {
  const g = src("servants", "van-gogh.yml");

  it("carries it at B+", () => {
    expect(g.abilities).toContainEqual({ ref: "divinity", rank: "B+" });
  });

  it("gets the sheet's 45 from the table", () => {
    // "All damage dealt is increased by 45 including NP" -- B is 40, perStep 5.
    expect(lookup("divinity", Rank.parse("B+"))).toBe(45);
  });
});

describe("excludeModifierSources — it travels anonymously, and that is worth a test", () => {
  // `excludeModifierSources` greps as though nothing populates it: the string
  // appears in `rules/damage/pipeline.mjs` and in Raikou's content and nowhere
  // between. It IS wired -- `withInstance` spreads the whole instance spec
  // into `state.attack`, `attackFacts` spreads `state.attack` into `facts`,
  // and `facts` is spread into `ctx.attack` -- so it arrives without ever
  // being named.
  //
  // Recorded here because the next person to grep it will reach the same wrong
  // conclusion this author did and "fix" working code. These tests pin the
  // path end to end so a future spread that drops it fails loudly.
  //
  // Van Gogh needs the same filter from a PASSIVE rather than from an attack's
  // damage block -- her Class Skill negates Mad Enhancement on whoever she is
  // fighting, in either direction -- which is the part that is genuinely new.
  it("reaches the pipeline from an authored damage variant", () => {
    const raikou = src("abilities", "raikou-dohatsu-tenshou.yml");
    const variant = (raikou.damage.instances ?? [])
      .find((v) => v.excludeModifierSources);
    expect(variant, "Raikou still authors it").toBeDefined();
    expect(variant.excludeModifierSources).toContain("Mad Enhancement");
  });

  it("drops a named source from the attacker's bag", () => {
    const out = computeDamage({
      attacker: {
        id: "a", baseAttack: { str: 100 }, abilities: [],
        modifiers: [{ key: "atkUp", value: 50, direction: "dealt", source: "Mad Enhancement" }],
      },
      defender: { id: "d", abilities: [] },
      base: { sources: [{ unit: "self", component: "str", factor: 1 }] },
      component: "str",
      attack: { kind: "normal", component: "str", excludeModifierSources: ["Mad Enhancement"] },
      rolls: { attackMinus: 0 },
    });
    // 100 flat: the +50% is dropped rather than applied.
    expect(out.total).toBe(100);
  });

  it("drops it from the DEFENDER's bag too, which is the half Van Gogh needs", () => {
    const out = computeDamage({
      attacker: { id: "a", baseAttack: { str: 100 }, abilities: [] },
      defender: {
        id: "d", abilities: [],
        modifiers: [{ key: "defUp", value: 50, direction: "taken", source: "Mad Enhancement" }],
      },
      base: { sources: [{ unit: "self", component: "str", factor: 1 }] },
      component: "str",
      attack: { kind: "normal", component: "str", excludeModifierSources: ["Mad Enhancement"] },
      rolls: { attackMinus: 0 },
    });
    expect(out.total).toBe(100);
  });
});

describe("Van Gogh — negating Mad Enhancement from a passive, both ways", () => {
  // EOTD passive 5 is not an attack's property -- it is hers, and it applies
  // whether she is swinging or being swung at:
  //
  //   "When a Unit with Active Mad Enhancement Attacks this Unit, the damage
  //    BOOSTING effect of Mad Enhancement is negated. When this Unit Attacks a
  //    Unit with Active Mad Enhancement, the damage REDUCING effect is negated."
  //
  // One rule, stated twice: drop Mad Enhancement from the OPPONENT's bag
  // whenever Van Gogh is one of the two parties. `excludeModifierSources` is
  // per-attack; this is per-unit, so the pipeline unions the two.
  const hit = ({ attacker = {}, defender = {} }) => computeDamage({
    attacker: { id: "a", baseAttack: { str: 100 }, abilities: [], ...attacker },
    defender: { id: "d", abilities: [], ...defender },
    base: { sources: [{ unit: "self", component: "str", factor: 1 }] },
    component: "str",
    attack: { kind: "normal", component: "str" },
    rolls: { attackMinus: 0 },
  });

  it("drops the ATTACKER's Mad Enhancement when she is defending", () => {
    const out = hit({
      attacker: { modifiers: [{ key: "atkUp", value: 50, direction: "dealt", source: "Mad Enhancement" }] },
      defender: { excludesOpponentSources: ["Mad Enhancement"] },
    });
    expect(out.total).toBe(100);
  });

  it("drops the DEFENDER's Mad Enhancement when she is attacking", () => {
    const out = hit({
      attacker: { excludesOpponentSources: ["Mad Enhancement"] },
      defender: { modifiers: [{ key: "defUp", value: 50, direction: "taken", source: "Mad Enhancement" }] },
    });
    expect(out.total).toBe(100);
  });

  it("does not drop her OWN modifiers of that name", () => {
    // "the damage boosting effect of Mad Enhancement is negated" is about the
    // other Unit's Skill. If she somehow carried one it would still apply --
    // and more importantly, dropping from her own bag would silently delete
    // her Divinity if a source name ever collided.
    const out = hit({
      attacker: {
        excludesOpponentSources: ["Mad Enhancement"],
        modifiers: [{ key: "atkUp", value: 50, direction: "dealt", source: "Mad Enhancement" }],
      },
    });
    expect(out.total).toBe(150);
  });

  it("leaves every other source alone on both sides", () => {
    const out = hit({
      attacker: { excludesOpponentSources: ["Mad Enhancement"] },
      defender: { modifiers: [{ key: "defUp", value: 50, direction: "taken", source: "Divinity" }] },
    });
    expect(out.total).toBe(50);
  });
});

describe("Van Gogh — Existence Outside The Domain A", () => {
  const eotd = src("class-skills", "existence-outside-the-domain.yml");
  const el = (key) => eotd.passiveRules.filter((r) => r.key === key);

  it("uses the slug `alter-ego.yml` had been waiting for", () => {
    // `alter-ego.yml` predicated on `target:skill:existenceOutsideTheDomain`
    // and declared it as a forward reference; `validate:content` reported
    // "declared, inert" from the day it shipped until this file existed.
    const alterEgo = src("class-skills", "alter-ego.yml");
    expect(eotd.slug).toBe("existenceOutsideTheDomain");
    expect(JSON.stringify(alterEgo.passiveRules)).toContain("existenceOutsideTheDomain");
  });

  it("let Alter Ego drop the declaration, which is the half that fires once", () => {
    // The validator flips from "declared, inert" to "now exists -- remove the
    // declaration" the moment the target is authored. Both halves of that
    // mechanism have now run, and only one of them can ever run again.
    expect(src("class-skills", "alter-ego.yml").forwardReferences).toBeUndefined();
  });

  it("resists debuffs on a three-tier ladder: 25 / 10 / 5", () => {
    const chances = el("ApplicationChance");
    const at = (sev) => chances.find((c) => String(c.severity).includes(sev));
    expect(at("normal").value).toBe(25);
    expect(at("death").value).toBe(10);
    expect(at("erase").value).toBe(5);
    for (const c of chances) expect(c.direction).toBe("incoming");
  });

  it("puts Instakill on the FIRST tier, unlike Magic Resistance", () => {
    // "including Instakill" -- it rides the 25, where Magic Resistance gives
    // Instakill a tier of its own.
    const first = el("ApplicationChance").find((c) => c.value === 25);
    expect(first.severity).toEqual(["normal", "instakill"]);
  });

  it("trades 40% both ways with Mad Enhancement", () => {
    const mods = el("DamageModifier");
    const has = (dir) => mods.find(
      (m) => m.direction === dir && JSON.stringify(m.predicate).includes("madEnhancement"),
    );
    expect(has("dealt")).toMatchObject({ value: 40, npValue: 40 });
    expect(has("taken")).toMatchObject({ value: 40, npValue: 40 });
  });

  it("takes 40% more from her own kind", () => {
    const outsider = el("DamageModifier")
      .find((m) => JSON.stringify(m.predicate).includes("outsider"));
    expect(outsider.direction).toBe("taken");
    expect(outsider.value).toBe(40);
  });

  it("raises Crit Chance by 15", () => {
    expect(el("CritModifier")[0]).toMatchObject({ aspect: "chance", value: 15 });
  });

  it("negates Mad Enhancement on the opponent, which STACKS with passive 2", () => {
    // Passive 2 is a percentage she gains against Berserkers; passive 5
    // removes the percentage the Berserker brings. Two clauses, both apply.
    expect(el("NegateOpponentSource")[0]).toEqual(
      { key: "NegateOpponentSource", sources: ["Mad Enhancement"] },
    );
    expect(el("DamageModifier").length).toBeGreaterThan(2);
  });
});

describe("Van Gogh — Item Construction B− (spec R10)", () => {
  const ic = src("class-skills", "item-construction-gogh.yml");
  const aura = ic.passiveRules.find((r) => r.key === "Aura");

  it("is a third ability of this name, and not Medea's or Semiramis's", () => {
    // Medea's is the same SHAPE at different numbers; Semiramis's creates
    // Items and shares nothing but the title.
    expect(src("abilities", "medea-item-construction.yml").rank).toBe("A");
    expect(src("abilities", "semiramis-item-construction.yml").phases[0].kind).toBe("itemGrant");
    // Hers is parameterized, so the rank lives on the Servant's ref -- which
    // is also what lets it contest Medea's A by rank at all.
    expect(ic.parameterized).toEqual(["rank"]);
    expect(src("servants", "van-gogh.yml").abilities)
      .toContainEqual({ ref: "class-item-construction-gogh", rank: "B-" });
  });

  it("reaches allies at radius 2", () => {
    expect(aura.radius).toBe(2);
    expect(aura.relations).toEqual(["ally", "self"]);
  });

  it("does not stack, and the whole Skill wins by rank", () => {
    // `group` rather than per-element comparison: a C-rank instance winning
    // one tier and losing another would blend two Skills that never existed.
    // `rules/auras.mjs` resolves this already and quotes the clause verbatim.
    expect(aura.stacking).toBe("highestOnly");
    expect(aura.group).toBe("itemConstruction");
  });

  it("shares its group with Medea's, so the two contest by rank", () => {
    const medea = src("abilities", "medea-item-construction.yml");
    const theirs = medea.passiveRules.find((r) => r.key === "Aura");
    expect(theirs.group).toBe(aura.group);
  });

  it("carries six elements on the sheet's ladder: 35 / 15 / 5, both ways", () => {
    const by = (dir, sev) => aura.elements.find(
      (e) => e.direction === dir && String(e.severity).includes(sev),
    );
    for (const dir of ["outgoing", "incoming"]) {
      expect(by(dir, "normal").value).toBe(35);
      expect(by(dir, "instakill").value).toBe(15);
      expect(by(dir, "death").value).toBe(5);
    }
  });

  it("uses the direction values the executor actually reads", () => {
    // `effect-applier.mjs` calls chanceContribution(..., "incoming") and
    // (..., "outgoing") and defaults to "incoming", so a wrong value applies
    // silently in the wrong direction.
    for (const e of aura.elements) expect(["incoming", "outgoing"]).toContain(e.direction);
  });
});

describe("Van Gogh — Insanity C", () => {
  const ins = src("abilities", "gogh-insanity.yml");

  it("is a flat 6% including NP", () => {
    const mod = ins.passiveRules.find((r) => r.key === "DamageModifier");
    expect(mod.direction).toBe("dealt");
    expect(mod.value).toBe(6);
    // "including NP" -- npValue equal to value, not the usual halving.
    expect(mod.npValue).toBe(6);
  });
});

describe("Van Gogh — Sunflower's Curse, passive 1", () => {
  const sc = src("abilities", "gogh-sunflowers-curse.yml");

  it("grants the attribute the Command Spell already refuses on", () => {
    // `cs-kill-yourself.yml` carries
    //   { kind: targetNotImmune, attribute: immuneToKillYourself }
    // and its comment names THIS Skill as the only stated immunity. Checked at
    // OFFER time, so the option never appears rather than being refused after
    // a Master has committed a Command Spell to it.
    expect(JSON.stringify(sc.passiveRules)).toContain("immuneToKillYourself");
  });

  it("is the reader's named writer", () => {
    const cs = src("command-spells", "cs-kill-yourself.yml");
    const req = cs.requirements.find((r) => r.kind === "targetNotImmune");
    expect(req.attribute).toBe("immuneToKillYourself");
  });

  it("grants it as a tag LIST, which is what `add` means", () => {
    // `StatDelta.add` is the attribute-tag list. A number there is iterated as
    // a set and throws out of `contributionsOf`, taking the board snapshot
    // with it -- the defect Drake's `uncharted` found.
    const grant = sc.passiveRules.find((r) => r.key === "StatDelta");
    expect(Array.isArray(grant.add)).toBe(true);
    expect(grant.add).toEqual(["immuneToKillYourself"]);
  });

  it("does not make her immune to Command Spells generally", () => {
    // "cannot be ordered to commit suicide/kill herself" names ONE order. A
    // blanket immunity would also stop Escape, Full Heal and Cure Servant,
    // none of which her sheet mentions.
    const json = JSON.stringify(sc.passiveRules);
    expect(json).not.toContain("commandSpell");
    expect(json).not.toContain("allCommands");
  });
});
