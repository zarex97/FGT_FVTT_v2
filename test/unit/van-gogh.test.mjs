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
import { applyEffect } from "../../module/engine/effect-applier.mjs";
import { stacksHeld } from "../../module/rules/snapshot.mjs";
import { countTargetsMagnitude } from "../../module/rules/effects/count-targets.mjs";

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
    expect(on.eventFilter.anyOf).toContainEqual({ stageDelta: "positive" });
  });

  it("only pays for a removal the `gogh` buff made (spec R2)", () => {
    // "inflicted with Curse OR has Curse removed from herself TO THE EFFECTS
    // OF THE 'GOGH' BUFF" -- asymmetric on purpose. A Cure pays nothing.
    expect(on.eventFilter.anyOf).toContainEqual({ cause: "gogh" });
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
