/**
 * @file Van Gogh — the Servant whose own debuff is her fuel.
 * @see char_orig_sheets/Copia de Van Gogh.md
 * @see docs/superpowers/specs/2026-09-14-van-gogh-design.md
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

import { lookup } from "../../module/domain/tables.mjs";
import { Rank } from "../../module/domain/rank.mjs";
import { computeDamage } from "../../module/rules/damage/pipeline.mjs";
import { applyEffect } from "../../module/engine/effect-applier.mjs";
import { stacksHeld } from "../../module/rules/snapshot.mjs";
import { countTargetsMagnitude } from "../../module/rules/effects/count-targets.mjs";
import { removeStages, applicationsOf, effectGatePasses } from "../../module/rules/effect-flow.mjs";
import * as I from "../../module/engine/intents.mjs";
import { mergeStages } from "../../module/engine/applier.mjs";

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

describe("curseStageChanged — the event her whole kit runs on", () => {
  // Raised where a stage is DECIDED -- `resolveStacking`'s `stage` branch --
  // rather than from each of the paths that reach it. `engine/applier.mjs`'s
  // `noteDebuffs` makes the same argument two files away: "a hook fired from
  // each of the four application paths would have been four chances to miss
  // one."
  const def = {
    id: "curse", stacking: "stage", polarity: "debuff", baseChance: 100,
    valence: "offensive", volatility: "volatile",
  };
  const target = (stage) => ({
    id: "gogh", unitId: "gogh", effects: [], effectInstances: stage
      ? [{ id: "e1", defId: "curse", stage }]
      : [],
  });

  it("fires on a first application, from 0 to 1", () => {
    const out = applyEffect({ def, target: target(0), magnitude: 0, ctx: {} });
    const ev = out.intents.find((i) => i.t === "event" && i.event === "curseStageChanged");
    expect(ev).toBeDefined();
    expect(ev.payload).toMatchObject({ unitId: "gogh", defId: "curse", stageDelta: 1, newStage: 1 });
  });

  it("carries the size of the jump, not just that one happened", () => {
    // Imaginary Numbers Arts inflicts three at once; Channel Marker Soul is
    // paid per stage, so the delta has to be the number.
    const out = applyEffect({ def, target: target(2), magnitude: 0, stages: 3, ctx: {} });
    const ev = out.intents.find((i) => i.t === "event");
    expect(ev.payload.stageDelta).toBe(3);
    expect(ev.payload.newStage).toBe(5);
  });

  it("carries a cause, so a listener can tell WHO moved it", () => {
    // Spec R2: Channel Marker Soul pays for any infliction but only for
    // removals the `gogh` buff made. Without a cause the two are one event.
    const out = applyEffect({ def, target: target(0), magnitude: 0, ctx: { cause: "gogh" } });
    expect(out.intents.find((i) => i.t === "event").payload.cause).toBe("gogh");
  });

  it("does not fire for a non-staged effect", () => {
    const plain = { ...def, stacking: "noneRefresh", id: "atkUp" };
    const out = applyEffect({ def: plain, target: target(0), magnitude: 10, ctx: {} });
    expect(out.intents.find((i) => i.t === "event")).toBeUndefined();
  });
});

describe("Van Gogh — Channel Marker Soul EX (spec R1, R2)", () => {
  const cms = src("abilities", "gogh-channel-marker-soul.yml");
  const on = cms.passiveRules.find((r) => r.key === "OnEvent");

  it("halves Curse damage with the one lever that reaches a bypassing packet", () => {
    // Curse damage is periodic and carries `bypassModifiers: true`, so a Def
    // Up or a Ward would be skipped entirely.
    const amp = cms.passiveRules.find((r) => r.key === "VulnerabilityAmplifier");
    expect(amp).toEqual({ key: "VulnerabilityAmplifier", effectId: "curse", factor: 0.5 });
  });

  it("listens to curseStageChanged and pays per stage", () => {
    expect(on.event).toBe("curseStageChanged");
    expect(on.then).toEqual([
      { key: "CooldownDelta", scope: "np", delta: "-@stageDelta" },
    ]);
  });

  it("takes Curse from ANY source, including her own (spec R1)", () => {
    // The sentence names no source, and her own kit is the largest source
    // there is -- so the positive branch of the filter is unconditional.
    expect(on.eventFilter.either).toContainEqual({ stageDelta: "positive" });
  });

  it("only pays for a removal the `gogh` buff made (spec R2)", () => {
    // "inflicted with Curse OR has Curse removed from herself TO THE EFFECTS
    // OF THE 'GOGH' BUFF" -- asymmetric on purpose. A Cure pays nothing.
    expect(on.eventFilter.either).toContainEqual({ cause: "gogh" });
  });

  it("reduces in BOTH directions, which is what the leading minus means", () => {
    // stageDelta is +3 when she takes three on and -1 when the buff eats one;
    // reading the sign through would turn the removal half into an INCREASE.
    expect(on.then[0].delta.startsWith("-@")).toBe(true);
  });
});

describe("stacksHeld — a staged effect counts its STAGE", () => {
  // Imaginary Numbers Arts reduces the cooldown by "⅓◈ * the stage of the
  // Curse debuff on Gogh", with the sheet's own worked example: Stage 7 gives
  // 2◈+⅓◈. `stacksHeld` counted `uses`, which a staged instance leaves at 0 --
  // so `Math.max(1, 0)` reported every Curse as ONE stage however deep it ran,
  // and her signature clause would have been a flat ⅓◈ for ever.
  const actor = (instances) => ({
    effects: instances.map((i) => ({ system: { defId: i.defId, stage: i.stage, uses: i.uses } })),
  });

  it("reports the stage of a staged instance", () => {
    expect(stacksHeld(actor([{ defId: "curse", stage: 7 }])).curse).toBe(7);
  });

  it("still counts uses for a charge-based effect", () => {
    // Evade "2 times" is two uses of one instance, and nothing about it is
    // staged. Mannanan's Fragarach Counters are the same shape.
    expect(stacksHeld(actor([{ defId: "evade", uses: 2 }])).evade).toBe(2);
  });

  it("counts a plain instance as one", () => {
    expect(stacksHeld(actor([{ defId: "atkUp" }])).atkUp).toBe(1);
  });

  it("sums across instances", () => {
    const held = stacksHeld(actor([{ defId: "curse", stage: 3 }, { defId: "curse", stage: 2 }]));
    expect(held.curse).toBe(5);
  });
});

describe("Van Gogh — Imaginary Numbers Arts B+", () => {
  const ina = src("abilities", "gogh-imaginary-numbers-arts.yml");
  const effects = ina.phases.find((p) => p.kind === "applyEffects").effects;

  it("is on a 4◈−⅓◈ cooldown", () => {
    expect(ina.cooldown).toBe("4◈-⅓◈");
  });

  it("applies Guts for 1◈+⅔◈ at 20% of max Health", () => {
    expect(effects.find((e) => e.id === "guts"))
      .toMatchObject({ duration: "1◈+⅔◈", magnitude: 20 });
  });

  it("self-curses three times at 500%, unclamped (spec R8)", () => {
    const curse = effects.find((e) => e.id === "curse");
    expect(curse.applications).toBe(3);
    expect(curse.chance).toBe(500);
    // Her own Item Construction cuts incoming debuff chance by 35%; the excess
    // is exactly what survives it, so clamping here deletes the clause.
    expect(curse.chance).toBeGreaterThan(100);
  });

  it("reduces the NP cooldown by ⅓◈ per Curse STAGE", () => {
    const cd = ina.phases.find((p) => p.kind === "cooldown");
    expect(cd.changes[0]).toEqual({
      scope: "np", ticks: "⅓◈", perStack: { effect: "curse", each: 1 }, direction: "down",
    });
  });

  it("states `direction: down`, without which the cooldown GOES UP", () => {
    // `cooldownChanges` reads `change.ticks !== undefined ? (direction ===
    // "down") : ...`, so a ticks change with no direction increases it.
    expect(ina.phases.find((p) => p.kind === "cooldown").changes[0].direction).toBe("down");
  });

  it("measures the stage AFTER the self-curses, per sheet order", () => {
    // Effects are numbered 1, 2, 3 and the cooldown is 3. Measuring before
    // would read Stage 0 on her opening use and reduce nothing.
    const kinds = ina.phases.map((p) => p.kind);
    expect(kinds.indexOf("applyEffects")).toBeLessThan(kinds.indexOf("cooldown"));
  });

  it("pays TWICE from one press, which is the engine (spec R1)", () => {
    // Channel Marker Soul pays 1 Turn per stage INFLICTED (3 stages = 3
    // Turns); this ability separately pays ⅓◈ per stage HELD (3 stages = 1◈).
    // Both fire from one press. Anyone reading the drop without the ruling
    // will read it as double-counting and "fix" it.
    const cms = src("abilities", "gogh-channel-marker-soul.yml");
    expect(cms.passiveRules.find((r) => r.event === "curseStageChanged")).toBeDefined();
    expect(ina.phases.find((p) => p.kind === "cooldown")).toBeDefined();
  });
});

describe("DamageFloor — a floor scoped to one damage source (spec R9)", () => {
  // Three mechanisms in this game already mean "does not die" and this is none
  // of them. Guts revives AFTER defeat. Invuln stops the damage. `Endure`
  // leaves the unit at 1 Health -- which is this arithmetic exactly, but
  // unconditional. Hers is Endure with a source on it: Curse takes her from
  // 1250 to 1 and never further, while a Normal Attack at 1 Health kills her
  // normally. That asymmetry is the whole point of a Servant who runs herself
  // to Stage 9 on purpose.
  const hit = (health, floors, packet) => computeDamage({
    attacker: { id: "src", baseAttack: { mag: 0 }, abilities: [] },
    defender: { id: "gogh", abilities: [], health, damageFloors: floors },
    base: { fixedValue: 500 },
    component: "mag",
    attack: { kind: "skill", ...packet },
    rolls: { attackMinus: 0 },
  });
  const curseFloor = [{ floor: 1, defId: "curse", source: "Sunflower's Curse" }];

  it("leaves exactly 1 Health against the named source", () => {
    expect(hit(300, curseFloor, { defId: "curse", periodic: true }).total).toBe(299);
  });

  it("does nothing at all against any other source", () => {
    expect(hit(300, curseFloor, { defId: "poison", periodic: true }).total).toBe(500);
  });

  it("takes nothing when already at the floor, and does not heal", () => {
    expect(hit(1, curseFloor, { defId: "curse", periodic: true }).total).toBe(0);
  });

  it("is not Guts and not Invuln — an ordinary attack still kills her", () => {
    expect(hit(1, curseFloor, { kind: "normal" }).total).toBe(500);
  });

  it("leaves a defender with no floor alone", () => {
    expect(hit(300, [], { defId: "curse", periodic: true }).total).toBe(500);
  });
});

describe("Van Gogh — Sunflower's Curse, passive 2 (spec R9)", () => {
  const sc = src("abilities", "gogh-sunflowers-curse.yml");

  it("floors her at 1 against Curse and nothing else", () => {
    expect(sc.passiveRules.find((r) => r.key === "DamageFloor"))
      .toEqual({ key: "DamageFloor", floor: 1, defId: "curse" });
  });

  it("is not authored as Guts, Invuln or a blanket Endure", () => {
    const json = JSON.stringify(sc.passiveRules);
    expect(json).not.toContain("guts");
    expect(json).not.toContain("invuln");
    expect(json).not.toContain("endure");
  });
});

describe("countTargets — a magnitude computed from the phase's own target set", () => {
  // De Sterrennacht effect 3: "damage dealt is increased by X0%, where X = 3 +
  // the number of affected allied Units with the EOTD Skill EXCLUDING
  // herself". The number is not on the ability, not on the caster, and not on
  // the recipient -- it is a property of the SET, and only the phase knows it.
  //
  // `perStack` counts effects on the caster and `countMatching` counts the
  // board; neither answers "how many of the units I am about to buff".
  const spec = { base: 30, each: 10, requires: ["self:skill:existenceOutsideTheDomain"], excludeSelf: true };
  const withSkill = (id) => ({ id, abilities: [{ slug: "existenceOutsideTheDomain" }] });

  it("is the base alone when she is the only one", () => {
    expect(countTargetsMagnitude(spec, [withSkill("gogh")], "gogh")).toBe(30);
  });

  it("adds ten per other ally carrying the Skill", () => {
    const set = [withSkill("gogh"), withSkill("ally1"), withSkill("ally2")];
    expect(countTargetsMagnitude(spec, set, "gogh")).toBe(50);
  });

  it("excludes herself even when she carries it", () => {
    // "excluding herself" is stated, and she always carries EOTD -- so without
    // the exclusion her floor would be 40, not 30.
    const set = [withSkill("gogh"), withSkill("ally1")];
    expect(countTargetsMagnitude(spec, set, "gogh")).toBe(40);
  });

  it("ignores allies who do not carry the Skill", () => {
    const set = [withSkill("gogh"), { id: "plain", abilities: [] }];
    expect(countTargetsMagnitude(spec, set, "gogh")).toBe(30);
  });
});

describe("Van Gogh — Terror, and De Sterrennacht EX (NP1)", () => {
  const terror = src("effects", "terror.yml");
  const np = src("abilities", "gogh-de-sterrennacht.yml");

  it("rolls Terror flat, where every other chance is shiftable", () => {
    // Appendix A §A.11 states it outright. Authoring the 60% as the Stun's own
    // application chance would route it through the applier, where her Item
    // Construction would sharpen it by 35% against the enemies inside her aura.
    const onTurnEnd = terror.rules.find((r) => r.event === "turnEnd");
    const stun = onTurnEnd.then.find((a) => a.key === "ApplyEffect");
    expect(stun.chance).toBe("@magnitude");
    expect(JSON.stringify(stun)).toContain("stun");
  });

  it("removes itself whether or not the Stun landed", () => {
    // "then Terror is removed" -- one roll, not one per Turn until it works.
    const onTurnEnd = terror.rules.find((r) => r.event === "turnEnd");
    const removal = onTurnEnd.then.find((a) => a.key === "RemoveEffect");
    expect(removal.effect).toBe("terror");
    expect(removal.predicate).toBeUndefined();
  });

  it("is an EX Anti-Unit Noble Phantasm on 8◈, dealing no damage", () => {
    expect(np.rank).toBe("EX");
    expect(np.npTags).toEqual(["antiUnit"]);
    expect(np.cooldown).toBe("8◈");
    expect(np.damage).toBeUndefined();
    expect(np.phases.map((p) => p.kind)).not.toContain("damage");
  });

  it("Terrors a 5x5 of ENEMIES in a chosen direction, at 60%", () => {
    expect(np.targeting.anchor.kind).toBe("selfEdgeAdjacent");
    expect(np.targeting.shape).toEqual({ kind: "rect", w: 5, h: 5 });
    expect(np.targeting.selection.relations).toEqual(["enemy"]);
    const enemyPhase = np.phases.find((p) => p.target === "reuse");
    expect(enemyPhase.effects[0]).toMatchObject({ id: "terror", magnitude: 60 });
  });

  it("buffs allies on a DIFFERENT reach, stated per phase", () => {
    // Three reaches in one NP. Defaulting the ally half to `reuse` would
    // Terror her own side.
    const ally = np.phases.find((p) => p.targeting);
    expect(ally.targeting.shape).toEqual({ kind: "chebyshevRadius", r: 3 });
    expect(ally.targeting.selection.relations).toEqual(["ally", "self"]);
  });

  it("gives Crit DmUp twice, the second only to EOTD Units", () => {
    const ally = np.phases.find((p) => p.targeting);
    const crits = ally.effects.filter((e) => e.id === "critDmUp");
    expect(crits).toHaveLength(2);
    expect(crits[0].predicate).toBeUndefined();
    expect(crits[1].predicate).toEqual(["target:skill:existenceOutsideTheDomain"]);
  });

  it("scales Atk Up off its own target set, excluding her (spec R7)", () => {
    const atk = np.phases.find((p) => p.targeting).effects.find((e) => e.id === "atkUp");
    expect(atk.magnitude.countTargets).toEqual({
      base: 30, each: 10,
      requires: ["self:skill:existenceOutsideTheDomain"], excludeSelf: true,
    });
    // NOT the `@count(...)` expression Ch. 35 proposed -- this codebase
    // rejected that by name in `semiramis-familiar-doves.yml`.
    expect(JSON.stringify(np)).not.toContain("@count(");
  });

  it("halves the NP value by a FACTOR, since the base is computed", () => {
    const atk = np.phases.find((p) => p.targeting).effects.find((e) => e.id === "atkUp");
    expect(atk.npMagnitudeFactor).toBe(0.5);
    expect(atk.npMagnitude).toBeUndefined();
  });

  it("gives the Area CritUp to Gogh alone", () => {
    const selfPhase = np.phases.find((p) => p.target === "self");
    expect(selfPhase.effects[0]).toMatchObject({ id: "areaCritUp", magnitude: 10 });
    const areaCrit = src("effects", "area-crit-up.yml");
    expect(areaCrit.rules[0]).toMatchObject({ key: "Aura", radius: 2 });
  });
});

describe("Van Gogh — the mirrored pair (spec R6)", () => {
  const skill = src("abilities", "gogh-het-gele-huis.yml");
  const np = src("abilities", "gogh-the-yellow-house.yml");

  it("is a 5x5 Skill and a 7x7 Noble Phantasm", () => {
    expect(skill.isNP).toBeUndefined();
    expect(skill.targeting.shape).toEqual({ kind: "rect", w: 5, h: 5 });
    expect(np.isNP).toBe(true);
    expect(np.targeting.shape).toEqual({ kind: "rect", w: 7, h: 7 });
  });

  const offCooldown = (a) => a.requirements.find((r) => r.kind === "abilityOffCooldown");

  it("each blocks the other, by the OTHER's id", () => {
    // The trap: two abilities whose names differ by a subtitle. Pointing
    // either at itself makes it permanently usable or permanently dead, and
    // both read plausibly -- so the test asserts the DIRECTION.
    expect(offCooldown(skill).abilityIds).toEqual(["gogh-the-yellow-house"]);
    expect(offCooldown(np).abilityIds).toEqual(["gogh-het-gele-huis"]);
    expect(offCooldown(skill).abilityIds).not.toContain(skill.id);
    expect(offCooldown(np).abilityIds).not.toContain(np.id);
  });

  it("uses the requirement Gate of Skye uses, not effect exclusivity", () => {
    // `blockedBy` is the EFFECT-exclusivity field and answers a different
    // question; `NoblePhantasmData` does not even declare it, which is how
    // this was caught.
    expect(skill.blockedBy).toBeUndefined();
    expect(np.blockedBy).toBeUndefined();
    const skye = src("abilities", "scathach-gate-of-skye.yml");
    expect(skye.requirements.find((r) => r.kind === "abilityOffCooldown")).toBeDefined();
  });

  it("neither puts the other on cooldown", () => {
    // Her sheet says only "cannot be used if X is on Cooldown". Scathach's
    // Gate of Skye says BOTH -- blocked by three, triggers two -- so the
    // absence here is a reading rather than an omission.
    expect(skill.alsoTriggers).toBeUndefined();
    expect(np.alsoTriggers).toBeUndefined();
    expect(src("abilities", "scathach-gate-of-skye.yml").alsoTriggers).toBeDefined();
  });

  it("doubles the durations on the NP half", () => {
    expect(JSON.stringify(skill.phases)).toContain('"1◈"');
    expect(JSON.stringify(np.phases)).toContain('"2◈"');
  });

  it("curses its own allies, twice on the NP", () => {
    // The price of the Evade and the Regen -- and, through Channel Marker
    // Soul, the reason she wants to pay it.
    const c = (a) => a.phases.flatMap((p) => p.effects ?? []).find((e) => e.id === "curse");
    expect(c(skill).applications ?? 1).toBe(1);
    expect(c(np).applications).toBe(2);
    expect(c(skill).chance).toBe(500);
    expect(c(np).chance).toBe(500);
  });

  it("deals no damage despite covering a 7x7 of enemies", () => {
    expect(np.damage).toBeUndefined();
    expect(np.phases.map((p) => p.kind)).not.toContain("damage");
  });
});

describe("Van Gogh — Shadow of Longing EX (spec R3)", () => {
  const sol = src("abilities", "gogh-shadow-of-longing.yml");
  const transfer = sol.phases.find((p) => p.kind === "transfer");

  it("is EX on a 4◈ cooldown, used on ONE chosen ally within 2", () => {
    expect(sol.rank).toBe("EX");
    expect(sol.cooldown).toBe("4◈");
    expect(sol.targeting.shape).toEqual({ kind: "chebyshevRadius", r: 2 });
    expect(sol.targeting.selection.relations).toEqual(["ally"]);
    // `chosen`, not `all` -- "Used on an allied Unit", singular.
    expect(sol.targeting.selection.chooser).toBe("chosen");
    expect(sol.targeting.selection.count).toBe(1);
  });

  it("buffs the chosen ally with Atk Up 30/15 and Crit Up 60", () => {
    const ally = sol.phases.find((p) => p.target === "reuse");
    const by = (id) => ally.effects.find((e) => e.id === id);
    expect(by("atkUp")).toMatchObject({ duration: "1◈", magnitude: 30, npMagnitude: 15 });
    expect(by("critUp")).toMatchObject({ duration: "1◈", magnitude: 60 });
  });

  it("pulls Curse from ALL Units within 3, enemies included", () => {
    // The sheet bolds "all". She cleanses her opponents to fuel herself, and
    // that is a trade rather than an oversight.
    expect(transfer.defId).toBe("curse");
    expect(transfer.radius).toBe(3);
    expect(transfer.relations).toEqual(["ally", "enemy", "self"]);
  });

  it("gathers onto HER, not onto the ally the ability targeted", () => {
    // The default is `reuse`, which on an outward-targeting ability is the
    // chosen ally -- so the Curse would land on the person she just buffed.
    expect(transfer.target).toBe("self");
  });

  it("applies the `gogh` buff to herself for 1◈", () => {
    const selfPhase = sol.phases.find(
      (p) => p.kind === "applyEffects" && p.target === "self",
    );
    expect(selfPhase.effects.find((e) => e.id === "gogh")).toMatchObject({ duration: "1◈" });
  });
});

describe("removeStages — taking a stage off without taking the effect off", () => {
  // The `gogh` buff eats ONE stage of Curse per attack, not the whole
  // instance. `RemoveEffect` deletes; this decrements, and raises
  // `curseStageChanged` with a NEGATIVE delta so Channel Marker Soul is paid
  // for the removal exactly as it is paid for the infliction.
  it("decrements and reports a negative delta", () => {
    const out = removeStages({ defId: "curse", stage: 4, id: "e1" }, 1, "gogh");
    expect(out.stage).toBe(3);
    expect(out.removed).toBe(false);
    expect(out.event).toMatchObject({ stageDelta: -1, newStage: 3, cause: "gogh" });
  });

  it("takes two on a Crit", () => {
    const out = removeStages({ defId: "curse", stage: 4, id: "e1" }, 2, "gogh");
    expect(out.stage).toBe(2);
    expect(out.event.stageDelta).toBe(-2);
  });

  it("removes the instance outright at zero", () => {
    const out = removeStages({ defId: "curse", stage: 1, id: "e1" }, 1, "gogh");
    expect(out.removed).toBe(true);
    expect(out.event).toMatchObject({ stageDelta: -1, newStage: 0 });
  });

  it("never goes below zero, and reports only what it actually took", () => {
    // At Stage 1 a Crit asks for two and gets one. The buff pays per stage
    // REMOVED, so reporting -2 here would grant an Atk Up for a stage that
    // was never there.
    const out = removeStages({ defId: "curse", stage: 1, id: "e1" }, 2, "gogh");
    expect(out.stage).toBe(0);
    expect(out.event.stageDelta).toBe(-1);
  });

  it("does nothing at all when there is no stage to take", () => {
    expect(removeStages(null, 1, "gogh")).toEqual({ removed: false, stage: 0, event: null });
  });
});

describe("Van Gogh — the `gogh` buff", () => {
  const gogh = src("effects", "gogh.yml");
  const onAttack = gogh.rules.filter((r) => r.event === "damageDealt");
  const onStage = gogh.rules.find((r) => r.event === "curseStageChanged");

  it("eats one stage on an ordinary attack and two on a Crit", () => {
    expect(onAttack).toHaveLength(2);
    // Both now carry a predicate -- they partition on the Crit -- so they are
    // told apart by what they take, not by which one is unguarded.
    const plain = onAttack.find((r) => r.then[0].stages === 1);
    const crit = onAttack.find((r) => r.then[0].stages === 2);
    expect(plain.then[0]).toMatchObject({ effect: "curse", stages: 1, cause: "gogh" });
    expect(crit.then[0]).toMatchObject({ effect: "curse", stages: 2, cause: "gogh" });
  });

  it("takes the stages in ONE decrement, not two removals", () => {
    // Two separate single removals would raise two events and, at Stage 1,
    // pay her twice for one swing -- once legitimately and once for a stage
    // that was not there.
    for (const r of onAttack) expect(r.then).toHaveLength(1);
  });

  it("grants Atk Up only when a stage actually came off", () => {
    // At Stage 0 the attack removes nothing and must grant nothing. The rider
    // listens to the EVENT the removal raised rather than assuming it worked.
    expect(onStage.event).toBe("curseStageChanged");
    expect(JSON.stringify(onStage.then[0])).toContain("atkUp");
  });

  it("grants one Atk Up per stage actually taken", () => {
    // `times: "@stageDelta"` -- a Crit that ate two grants two, and a Crit at
    // Stage 1 that only managed one grants one.
    expect(onStage.then[0].times).toBe("@stageDelta");
  });

  it("pays at 10% / 5%", () => {
    expect(onStage.then[0].effect).toMatchObject({ id: "atkUp", magnitude: 10, npMagnitude: 5 });
  });

  it("gates on its own cause, which is what Channel Marker Soul reads", () => {
    // Spec R2. A Cure stripping her Curse raises the same event with a
    // different cause and pays nothing.
    expect(onStage.eventFilter).toEqual({ cause: "gogh" });
  });

  it("does not stack, but refreshes", () => {
    expect(gogh.stacking).toBe("noneRefresh");
  });
});

describe("Van Gogh — every ability she names now exists", () => {
  const g = src("servants", "van-gogh.yml");

  it("names exactly the eleven entries on her sheet", () => {
    expect(g.abilities).toHaveLength(11);
  });

  it("resolves all eleven refs", () => {
    // A ref resolves by ID, not by path, so this checks both folders: the
    // `class-` prefix usually names the folder AND is stripped from the
    // filename, but `divinity` is a class skill whose ref carries no prefix
    // at all.
    const candidates = (ref) => [
      join(process.cwd(), "packs/_source/abilities", `${ref}.yml`),
      join(process.cwd(), "packs/_source/class-skills", `${ref}.yml`),
      join(process.cwd(), "packs/_source/class-skills", `${ref.replace(/^class-/, "")}.yml`),
    ];
    for (const entry of g.abilities) {
      expect(candidates(entry.ref).some(existsSync),
        `${entry.ref} is unresolved`).toBe(true);
    }
  });
});

describe("applications — \"3 times\" is three applications, not one worth three", () => {
  // FOUND LIVE, and it is the defect this codebase is named for: `applications`
  // was authored on two of her abilities, asserted by two content tests, listed
  // in the spec -- and read by NOTHING. `applyPhaseEffects` looped over the
  // effect entries and called `applyEffect` exactly once each, so Imaginary
  // Numbers Arts applied Guts and no Curse at all. The content test passed
  // because the content was right. It was the reader that did not exist.
  //
  // Three applications rather than `stages: 3` because the sheet states a
  // CHANCE beside the count -- "a 500% chance of inflicting Curse on herself,
  // 3 times" -- and a chance is rolled per application. At 500% all three land
  // and the distinction is invisible; below 100% it is the whole clause.

  it("reads the authored count", () => {
    expect(applicationsOf({ id: "curse", applications: 3 })).toBe(3);
  });

  it("defaults to one, so every other effect in the corpus is unchanged", () => {
    expect(applicationsOf({ id: "atkUp" })).toBe(1);
  });

  it("reads it off the RULE when the effect is nested", () => {
    // The corpus carries both `{id, ...}` and `{effect: {id}, ...}`; the
    // magnitude resolvers already check both and this must match them.
    expect(applicationsOf({ id: "curse" }, { applications: 2 })).toBe(2);
  });

  it("never returns less than one", () => {
    // A count of zero would silently delete an effect an ability states.
    expect(applicationsOf({ id: "curse", applications: 0 })).toBe(1);
    expect(applicationsOf({ id: "curse", applications: -4 })).toBe(1);
  });

  it("covers both abilities that state a count", () => {
    const ina = src("abilities", "gogh-imaginary-numbers-arts.yml");
    const tyh = src("abilities", "gogh-the-yellow-house.yml");
    const curseOf = (a) => a.phases.flatMap((p) => p.effects ?? []).find((e) => e.id === "curse");
    expect(applicationsOf(curseOf(ina))).toBe(3);
    expect(applicationsOf(curseOf(tyh))).toBe(2);
  });
});

describe("every intent a factory can build is one the validator knows", () => {
  // FOUND LIVE, and it cost the whole ability. `applyIntents` refuses a batch
  // containing an intent type it does not recognise -- correctly, because a
  // half-applied Noble Phantasm is worse than none. But `event` and `setStage`
  // were added with a constructor, an ORDER rank and an applier case, and NOT
  // added to `INTENT_TYPES`. So Imaginary Numbers Arts applied Guts, built the
  // Curse's `curseStageChanged`, and had the entire batch thrown out: no
  // Curse, no cooldown reduction, and the skill not even marked used.
  //
  // Four authorities have to agree for an intent to exist, and unit tests that
  // exercise the producer will pass with three of them. This test is the
  // fourth: it walks the factories rather than naming them, so the next intent
  // added without a validator entry fails here instead of in the world.

  it("knows every type a factory produces", () => {
    const built = [];
    for (const [name, fn] of Object.entries(I)) {
      if (typeof fn !== "function") continue;
      let out;
      try { out = fn("unit-1", "thing", 1, 1, 1); } catch { continue; }
      if (!out || typeof out.t !== "string") continue;
      built.push([name, out.t]);
    }
    // Guard the guard: if the probe stops constructing anything, this test
    // would pass vacuously for ever.
    expect(built.length).toBeGreaterThan(10);

    const unknown = built.filter(([, t]) => !I.INTENT_TYPES.includes(t));
    expect(unknown, `factories build intent types the validator rejects: ${JSON.stringify(unknown)}`)
      .toEqual([]);
  });

  it("accepts the two her kit introduced", () => {
    expect(I.INTENT_TYPES).toContain("event");
    expect(I.INTENT_TYPES).toContain("setStage");
  });

  it("validates a real curseStageChanged batch", () => {
    // The exact shape Imaginary Numbers Arts produced when it failed.
    const batch = [
      I.applyEffect("unit-1", "curse", {}),
      I.event("curseStageChanged", { unitId: "unit-1", defId: "curse", stageDelta: 1 }),
    ];
    expect(I.validate(batch)).toEqual([]);
  });

  it("validates a setStage batch, which the `gogh` buff emits", () => {
    expect(I.validate([I.setStage("unit-1", "curse", 2)])).toEqual([]);
  });
});

describe("an addressless intent still has a subject (spec R1)", () => {
  // FOUND LIVE, and it was the second half of the same wound. Once `event` was
  // a type the validator knew, the batch applied -- and Channel Marker Soul
  // still paid nothing, because `batch()` groups by `intent.unitId` and an
  // `event` deliberately has none. The applier handed `fireWriteEvent` the
  // group's `null`, the board lookup found no unit, and the function returned
  // before dispatching to a single handler.
  //
  // So the event fired into nothing. Imaginary Numbers Arts still reduced the
  // cooldown by 3 Turns from its own phase, which is exactly the shape of
  // defect that survives a live pass: a number moved, so it looked like it
  // worked. It was half the clause.

  it("groups an event under no unit at all", () => {
    const [group] = I.batch([I.event("curseStageChanged", { unitId: "u1", stageDelta: 1 })]);
    expect(group.unitId).toBeNull();
  });

  it("takes the subject from the payload", () => {
    expect(I.eventSubject(I.event("curseStageChanged", { unitId: "u1" }), null)).toBe("u1");
  });

  it("falls back to the group when the payload names no one", () => {
    expect(I.eventSubject(I.event("x", {}), "u2")).toBe("u2");
  });

  it("prefers the payload over the group", () => {
    // The unit a stage change HAPPENED to is not always the unit whose write
    // raised it -- Shadow of Longing takes stages off an enemy.
    expect(I.eventSubject(I.event("x", { unitId: "u1" }), "u2")).toBe("u1");
  });
});

describe("the `gogh` buff's Crit clause REPLACES its ordinary one", () => {
  // FOUND LIVE. Both `damageDealt` handlers are evaluated in one `fireEvent`
  // pass against the same snapshot, so a Crit ran BOTH: the plain handler took
  // one stage and the Crit handler took two, for three stages off one swing and
  // three Atk Up where the sheet grants two.
  //
  // Measured on the board at Stage 1: one Crit, Curse gone, and TWO Atk Up on
  // her -- one legitimate, one paid for a stage that was never there. Which is
  // the exact failure my own comment in `gogh.yml` claimed the single-action
  // `stages` shape had already prevented. It prevented it WITHIN one handler
  // and said nothing about two.
  //
  // The sheet is an either/or: "remove one stage ... IF the Attack was a Crit,
  // remove 2 stages", so the ordinary clause has to stand down on a Crit.
  const gogh = src("effects", "gogh.yml");
  const onAttack = gogh.rules.filter((r) => r.event === "damageDealt");
  const asText = (r) => JSON.stringify(r.predicate ?? []);

  it("has exactly the two halves", () => {
    expect(onAttack).toHaveLength(2);
  });

  it("guards the ordinary half against a Crit", () => {
    const plain = onAttack.find((r) => r.then[0].stages === 1);
    expect(plain.predicate, "the one-stage removal must stand down on a Crit")
      .toEqual([{ not: "attack:crit" }]);
  });

  it("fires the Crit half only on a Crit", () => {
    const crit = onAttack.find((r) => r.then[0].stages === 2);
    expect(asText(crit)).toContain("attack:crit");
    expect(asText(crit)).not.toContain("not");
  });

  it("leaves exactly one half eligible for any given swing", () => {
    // The invariant the defect broke: the two predicates must partition, so a
    // swing matches one and only one.
    const plain = onAttack.find((r) => r.then[0].stages === 1);
    const crit = onAttack.find((r) => r.then[0].stages === 2);
    expect(plain.predicate).toEqual([{ not: "attack:crit" }]);
    expect(crit.predicate).toEqual(["attack:crit"]);
  });
});

describe("a transfer of staged effects SUMS (spec R3)", () => {
  // FOUND LIVE. Shadow of Longing gathered Curse from an ally at Stage 2 and
  // an enemy at Stage 3 -- stripping both, which is R3's own claim and worked
  // -- and left Van Gogh holding Stage 2. Not 5, and not even the larger of
  // the two.
  //
  // `mergeStages` folds repeated applications of one staged effect in a batch
  // by summing `effect.stages`. A TRANSFERRED instance does not carry `stages`;
  // it carries `stage`, the depth it had on its previous bearer.
  // `resolveEffects` knows that and reads `stages ?? stage ?? 1` -- the merge
  // read only `stages`, counted each arrival as one, and wrote `stages: 2` over
  // the top of the real depths.
  //
  // So the bug scaled backwards: the more Curse she gathered, the less of it
  // arrived. Two instances at 3 and 2 became 2; her sheet's "apply all stages
  // of Curse accordingly" is 5.

  const transferred = (unitId, defId, stage) => I.applyEffect(unitId, { defId, stage }, "shadow");

  it("sums the depths two transferred instances arrive with", () => {
    const [merged, ...rest] = mergeStages([
      transferred("gogh", "curse", 3),
      transferred("gogh", "curse", 2),
    ]);
    expect(rest).toHaveLength(0);
    expect(merged.effect.stages).toBe(5);
  });

  it("still sums ordinary applications that state `stages`", () => {
    // Serenity's crit: the Projectile's Poison and Macabre's additional stage.
    const [merged] = mergeStages([
      I.applyEffect("v", { defId: "poison", stages: 1 }, "a"),
      I.applyEffect("v", { defId: "poison", stages: 1 }, "b"),
    ]);
    expect(merged.effect.stages).toBe(2);
  });

  it("counts a bare application as one", () => {
    const [merged] = mergeStages([
      I.applyEffect("v", { defId: "poison" }, "a"),
      I.applyEffect("v", { defId: "poison" }, "b"),
    ]);
    expect(merged.effect.stages).toBe(2);
  });

  it("mixes a transfer with an ordinary application", () => {
    const [merged] = mergeStages([
      transferred("gogh", "curse", 4),
      I.applyEffect("gogh", { defId: "curse", stages: 1 }, "b"),
    ]);
    expect(merged.effect.stages).toBe(5);
  });

  it("keeps different chances apart, as it always did", () => {
    const out = mergeStages([
      I.applyEffect("v", { defId: "poison", stage: 2, chance: 50 }, "a"),
      I.applyEffect("v", { defId: "poison", stage: 3, chance: 80 }, "b"),
    ]);
    expect(out).toHaveLength(2);
  });

  it("takes from enemies as well as allies", () => {
    // The other half of R3, and the half that already worked: the sheet bolds
    // "all", so she cleanses her opponents to fuel herself.
    const sol = src("abilities", "gogh-shadow-of-longing.yml");
    const t = sol.phases.find((p) => p.kind === "transfer");
    expect(t.relations).toContain("enemy");
    expect(t.relations).toContain("ally");
    expect(t.radius).toBe(3);
  });
});

describe("a per-effect predicate inside an applyEffects phase (spec R7)", () => {
  // FOUND LIVE, and the third key in this pass that was authored, tested and
  // read by nothing.
  //
  // De Sterrennacht clause 2 is "Applies Crit DmUp ... AGAIN to all affected
  // allied Units WITH the 'Existence Outside the Domain' Skill", so the second
  // 100 lands on a subset of the first's recipients. `applyPhaseEffects`
  // iterated the effect entries and applied every one of them to every
  // recipient; `predicate` on an entry was inert.
  //
  // On the board: Van Gogh, an EOTD ally and a PLAIN ally all ended on Crit
  // DmUp 200. The plain one should be on 100. Nothing errored and every number
  // looked plausible, which is how a wrong number survives a green suite.
  //
  // The set-level count in clause 3 was right all along -- `countTargets`
  // filters with the same predicate grammar and always had a reader. Only the
  // per-recipient gate was missing.

  it("passes an entry with no predicate", () => {
    expect(effectGatePasses({ id: "critDmUp" }, null, { options: [] })).toBe(true);
  });

  it("passes when the recipient satisfies it", () => {
    expect(effectGatePasses(
      { id: "critDmUp", predicate: ["target:skill:existenceOutsideTheDomain"] },
      null,
      { options: ["target:skill:existenceOutsideTheDomain"] },
    )).toBe(true);
  });

  it("REFUSES when the recipient does not", () => {
    // The plain ally. This is the assertion the live board failed.
    expect(effectGatePasses(
      { id: "critDmUp", predicate: ["target:skill:existenceOutsideTheDomain"] },
      null,
      { options: ["target:skill:riding"] },
    )).toBe(false);
  });

  it("reads it off the RULE when the effect is nested", () => {
    expect(effectGatePasses({ id: "x" }, { predicate: ["target:attribute:female"] }, { options: [] }))
      .toBe(false);
  });

  it("still authors the gate on clause 2 and not on clause 1", () => {
    const ds = src("abilities", "gogh-de-sterrennacht.yml");
    const ally = ds.phases.find((p) => p.targeting?.shape?.r === 3);
    const crits = ally.effects.filter((e) => e.id === "critDmUp");
    expect(crits).toHaveLength(2);
    expect(crits[0].predicate).toBeUndefined();
    expect(crits[1].predicate).toEqual(["target:skill:existenceOutsideTheDomain"]);
  });
});
