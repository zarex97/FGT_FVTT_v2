/**
 * @file The damage pipeline — sixteen strictly ordered stages.
 * @see docs/13-damage-pipeline.md
 *
 * Layer 2 (rules). **Pure.** Every random value the pipeline consumes is rolled
 * by the caller and passed in `ctx.rolls`; this keeps the function
 * deterministic, makes golden-file testing trivial, and is what allows the
 * speculative-damage preview in the targeting UI to run the real pipeline
 * rather than an approximation.
 *
 * Every stage records its contributors. That array **is** the damage explainer
 * in Ch. 30 — it is not debug output, it is the product.
 *
 * The two things most likely to be got wrong, both corrected from earlier
 * drafts by the game's author:
 *
 *   - **Stage 2.** The `5d10` applies to Base Attack *before* the ability
 *     multiplier, and crit-damage percentages scale the roll and *only* the
 *     roll (Q39). They are not stage-4 bucket entries.
 *   - **Stage 14.** Block is a flat 25% of the finished number, undiminished
 *     against Noble Phantasms (Q1). It is not a roll.
 */

import { Rank } from "../../domain/rank.mjs";
import { lookupNumber } from "../../domain/tables.mjs";
import { test as testPredicate } from "../predicate.mjs";

/** Block's base percentage. A constant, not a dice entry (Ch. 41 Q1). */
export const BLOCK_BASE_PERCENT = 25;

/** Damage above this in one attack forces an Injury Roll. */
export const INJURY_THRESHOLD = 100;

/** Stage names, indexed by stage number. Stable — content references them. */
export const STAGE_NAMES = Object.freeze([
  "precondition", "base", "crit", "abilityMultiplier", "combinedPercent",
  "componentAmplification", "band", "flatAttackBonuses", "environment",
  "zonPenalty", "luckIncreasedDamage", "resistance", "flatReductions",
  "luckReducedDamage", "block", "totalDamageModifiers", "absorptionAndClamp",
]);

/**
 * @typedef {object} Modifier
 * @property {string} key      e.g. "atkUp", "defUp", "dmgCut", "critDmUp"
 * @property {number} value    percentage points, or a flat amount by key
 * @property {number} [npValue] magnitude when the attack is an NP; defaults to `value`
 * @property {"str"|"mag"|null} [component] restrict to one base-attack component
 * @property {import("../predicate.mjs").Predicate} [predicate]
 * @property {string} source   for the audit trail
 */

/**
 * @typedef {object} DamageResult
 * @property {number} total
 * @property {number} magical
 * @property {number} physical
 * @property {number} fixed
 * @property {Array<object>} breakdown
 * @property {{negatedBy: string|null, shieldAbsorbed: number,
 *            exceededInjuryThreshold: boolean, defeatedOutright: boolean}} flags
 */

/**
 * Compute the damage of one hit.
 *
 * @param {object} ctx see docs/13-damage-pipeline.md §13.1
 * @returns {DamageResult}
 */
export function computeDamage(ctx) {
  const state = new PipelineState(ctx);

  stage0Precondition(state);
  if (state.halted) return state.finish();

  stage1Base(state);
  if (ctx.attack?.isFixedDamage || ctx.attack?.bypassModifiers) {
    // Fixed damage and volatile-debuff damage skip stages 2-15 entirely.
    // "Fixed damage is not affected by any damage modifying effect on both the
    // AU and DU including Block ... However, Fixed damage IS affected by Invuln."
    state.note("fixedDamage", "skipped stages 2-15");
    stage16AbsorptionAndClamp(state);
    return state.finish();
  }

  stage2Crit(state);
  stage3AbilityMultiplier(state);
  stage4CombinedPercent(state);
  stage5ComponentAmplification(state);
  stage6Band(state);
  stage7FlatAttackBonuses(state);
  stage8Environment(state);
  stage9ZonPenalty(state);
  stage10LuckIncreasedDamage(state);
  stage11Resistance(state);
  stage12FlatReductions(state);
  stage13LuckReducedDamage(state);
  stage14Block(state);
  stage15TotalDamageModifiers(state);
  stage16AbsorptionAndClamp(state);

  return state.finish();
}

/* ========================================================================== */
/*  Stages                                                                    */
/* ========================================================================== */

/**
 * Stage 0 — early exits, in a fixed precedence order.
 * @param {PipelineState} s
 */
function stage0Precondition(s) {
  s.begin(0);
  const { defender, attacker, attack } = s.ctx;

  // Order matters: Substitution beats Aim, Anti-Purge beats Pierce and Invuln.
  if (has(defender, "substitution")) return s.halt("Substitution");
  if (has(defender, "antiPurge")) return s.halt("Anti-Purge");

  // "cannot take damage" as a property of the unit, not a buff. Pale Rider and
  // the Kagome Spirits. Distinct from Invuln: not removable, not halved vs NP.
  if (defender?.health === null) return s.halt("invulnerable-by-nature");

  // Element-to-heal conversion happens before anything reduces the number.
  const heal = { poison: "poisHeal", curse: "cursHeal", burn: "flamHeal" }[attack?.element ?? ""];
  if (heal && has(defender, heal)) {
    s.converted = true;
    s.note("conversion", `${attack.element} converted to healing by ${heal}`);
  }

  // Fire removes Freeze with no damage or effects. The <150 absorption clause
  // needs the total, so it is deferred to stage 16 where the total exists.
  if (attack?.element === "fire" && has(defender, "freeze")) {
    s.removeFreeze = true;
    return s.halt("Freeze broken by Fire");
  }

  if (has(attacker, "dragonblight") && attack?.element) return s.halt("Dragonblight");

  const reflect = attack?.component === "mag" ? "magReflect" : "strReflect";
  if (has(defender, reflect)) {
    s.reflected = true;
    return s.halt(reflect === "magReflect" ? "MAG Reflect" : "STR Reflect");
  }

  s.end(0);
}

/**
 * Stage 1 — select base attacks and their factors.
 * @param {PipelineState} s
 */
function stage1Base(s) {
  s.begin(1);
  const spec = s.ctx.base ?? { sources: [] };

  if (s.ctx.attack?.isFixedDamage) {
    s.phys = spec.fixedValue ?? 0;
    s.fixed = s.phys;
    s.contribute("fixed", s.phys, "fixed damage");
    return s.end(1);
  }

  for (const src of spec.sources ?? []) {
    const unit = src.unit === "self" ? s.ctx.attacker : (s.ctx.units?.[src.unit] ?? s.ctx.attacker);
    const base = unit?.baseAttack?.[src.component] ?? 0;
    const v = base * (src.factor ?? 1);
    if (src.component === "mag") s.mag += v;
    else s.phys += v;
    s.contribute(`base:${src.component}`, v, `${src.unit} BA(${src.component.toUpperCase()}) × ${src.factor ?? 1}`);
  }
  s.end(1);
}

/**
 * Stage 2 — the crit roll, applied to Base Attack **before** the multiplier.
 *
 * `Attack+` and `Attack−` are the same `5d10` pool; the sign is the difference.
 * The author's reference calculation places the roll inside the bracket:
 * `[(200 + 35) × 4 × 2 + 100] × …`, and only that placement reproduces the
 * stated total of 1980. Applying it after the multiplier — as an earlier draft
 * of Ch. 13 did — gives 1735.
 *
 * Crit-damage percentages multiply **the roll**, not the attack (Q39). The
 * `Attack−` branch is never scaled by them, because a non-crit has no crit
 * damage to modify.
 *
 * @param {PipelineState} s
 */
function stage2Crit(s) {
  s.begin(2);
  const isCrit = s.ctx.crit?.isCrit ?? false;
  const roll = s.ctx.rolls?.[isCrit ? "attackPlus" : "attackMinus"] ?? 0;

  if (isCrit) {
    const pct =
      sumMods(s, s.ctx.attacker, "critDmUp") -
      sumMods(s, s.ctx.attacker, "critDmDwn") -
      sumMods(s, s.ctx.defender, "critResUp") +
      sumMods(s, s.ctx.defender, "critResDwn") +
      overCritBonus(s);
    const factor = Math.max(0, 1 + pct / 100);
    const applied = roll * factor;
    s.contribute("attack+", applied, pct === 0 ? `5d10 = ${roll}` : `5d10 = ${roll}, ×${factor.toFixed(2)} crit damage`);
    s.addProportional(applied);
  } else {
    s.contribute("attack-", -roll, `5d10 = ${roll}, subtracted`);
    s.addProportional(-roll);
  }
  s.clampNonNegative();
  s.end(2);
}

/**
 * Stage 3 — the ability's own multiplier, its conditional multipliers, and its
 * flat bonus.
 *
 * Conditional multipliers stated **in the ability's description** land here,
 * inside the bracket, per the author's reference calculation: the `× 2` in
 * `[(200+35) × 4 × 2 + 100]` is the NP's own "+100% against `[Sky]`" clause. A
 * *buff* saying "damage dealt is increased by X%" joins the bucket at stage 4
 * instead. The dividing line is where the text lives.
 *
 * @param {PipelineState} s
 */
function stage3AbilityMultiplier(s) {
  s.begin(3);
  const mult = s.ctx.multiplier ?? 1;
  const flat = s.ctx.flatBonus ?? 0;

  let conditional = 1;
  for (const cm of s.ctx.conditionalMultipliers ?? []) {
    if (!testPredicate(cm.predicate, s.predicateCtx)) continue;
    conditional *= cm.factor;
    s.contribute("conditionalMultiplier", cm.factor, cm.source ?? "ability clause");
  }

  const before = s.mag + s.phys;
  const scaled = before * mult * conditional;
  if (mult !== 1) s.contribute("multiplier", mult, `${mult}× damage`);

  // The flat bonus is distributed proportionally so that component-scoped
  // modifiers downstream (Magic Resistance) see the right share.
  const total = scaled + flat;
  if (flat !== 0) s.contribute("flatBonus", flat, `plus ${flat}`);
  s.split(total, before === 0 ? 0.5 : s.mag / before);
  s.end(3);
}

/**
 * Stage 4 — the one additive bucket.
 *
 * The rulebook constrains this explicitly: *"if the AU has 30% Atk Up and uses
 * a Normal Attack on a Unit who has 100% Def Up, then the damage calculation
 * would be (100+30−100)%, so it would deal 30% damage only, not 0."* That is a
 * single additive expression, so everything of that shape sums here and is
 * applied once.
 *
 * @param {PipelineState} s
 */
function stage4CombinedPercent(s) {
  s.begin(4);
  const isNP = s.isNP;
  let bucket = 0;

  for (const m of activeMods(s, s.ctx.attacker, ATTACKER_BUCKET_KEYS)) {
    const v = magnitudeOf(m, isNP);
    // Asymmetric (component-scoped) modifiers contribute their *shared* part
    // here; the differential goes to stage 5.
    const shared = m.component ? 0 : v;
    if (shared === 0 && m.component) continue;
    bucket += NEGATIVE_KEYS.has(m.key) ? -shared : shared;
    s.contribute(m.key, NEGATIVE_KEYS.has(m.key) ? -shared : shared, m.source);
  }

  for (const m of activeMods(s, s.ctx.defender, DEFENDER_BUCKET_KEYS)) {
    if (m.key === "defUp" && s.ctx.attack?.ignoresDefUp) {
      s.contribute("defUp", 0, `${m.source} (ignored by Ignore Def)`);
      continue;
    }
    const v = magnitudeOf(m, isNP);
    const signed = DEFENDER_POSITIVE_KEYS.has(m.key) ? v : -v;
    bucket += signed;
    s.contribute(m.key, signed, m.source);
  }

  const factor = Math.max(0, 1 + bucket / 100);
  s.scale(factor);
  s.note("bucket", `${bucket >= 0 ? "+" : ""}${bucket}% → ×${factor.toFixed(2)}`);
  s.end(4);
}

/**
 * Stage 5 — modifiers whose magnitude differs by component.
 *
 * Mad Enhancement: *"All damage dealt is increased by X% including NP; X is
 * halved for damage which uses Base Attack (MAG)."* One bucket cannot express
 * that, so the shared part went to stage 4 and the differential lands here on
 * the larger component.
 *
 * @param {PipelineState} s
 */
function stage5ComponentAmplification(s) {
  s.begin(5);
  const isNP = s.isNP;
  let strPct = 0;
  let magPct = 0;

  for (const m of activeMods(s, s.ctx.attacker, ATTACKER_BUCKET_KEYS)) {
    if (!m.component) continue;
    const v = magnitudeOf(m, isNP) * (NEGATIVE_KEYS.has(m.key) ? -1 : 1);
    if (m.component === "str") strPct += v;
    else magPct += v;
    s.contribute(m.key, v, `${m.source} (${m.component.toUpperCase()} only)`);
  }

  if (strPct !== 0) s.phys *= Math.max(0, 1 + strPct / 100);
  if (magPct !== 0) s.mag *= Math.max(0, 1 + magPct / 100);
  s.end(5);
}

/**
 * Stage 6 — banded AoE. Nemo's *Triton's Conch*: 1.5× adjacent, 0.5× at range 2.
 * @param {PipelineState} s
 */
function stage6Band(s) {
  s.begin(6);
  const m = s.ctx.bandMultiplier ?? 1;
  if (m !== 1) {
    s.scale(m);
    s.contribute("band", m, `band ${s.ctx.band ?? "?"}`);
  }
  s.end(6);
}

/**
 * Stage 7 — flat attacker bonuses. All "including NP" by their own text.
 * @param {PipelineState} s
 */
function stage7FlatAttackBonuses(s) {
  s.begin(7);
  let flat = 0;
  for (const m of activeMods(s, s.ctx.attacker, FLAT_ATTACK_KEYS)) {
    flat += m.value;
    s.contribute(m.key, m.value, m.source);
  }
  if (flat !== 0) s.addProportional(flat);
  s.end(7);
}

/**
 * Stage 8 — environment. Day/Night, Home Base, Territory Creation offence.
 * @param {PipelineState} s
 */
function stage8Environment(s) {
  s.begin(8);
  const env = s.ctx.environment ?? {};

  // Day/Night is ±25% for units with the [Dark] attribute, and the phase is a
  // *per-panel* property now that terrain can override it (Ch. 42 §42.3).
  if (env.phaseBonusPercent) {
    s.scale(Math.max(0, 1 + env.phaseBonusPercent / 100));
    s.contribute("dayNight", env.phaseBonusPercent, `${env.phase ?? "phase"} vs [Dark]`);
  }

  if (env.homeBaseAttackPercent) {
    const v = s.isNP ? env.homeBaseAttackPercent / 2 : env.homeBaseAttackPercent;
    s.scale(Math.max(0, 1 + v / 100));
    s.contribute("homeBaseAttack", v, "both combatants in the AU's home base");
  }

  const tc = s.ctx.rolls?.territoryCreationAtk ?? 0;
  if (tc) {
    s.addProportional(tc);
    s.contribute("territoryCreation", tc, "Territory Creation (offence)");
  }
  s.end(8);
}

/**
 * Stage 9 — the ZON penalty: a flat `5d10` when a Servant attacks from outside
 * its Master's Zone of Nourishment. Free Servants have no Master, so no ZON,
 * so the rule cannot apply.
 * @param {PipelineState} s
 */
function stage9ZonPenalty(s) {
  s.begin(9);
  if (s.ctx.attacker?.outsideZon) {
    const roll = s.ctx.rolls?.zonPenalty ?? 0;
    s.addProportional(-roll);
    s.contribute("zonPenalty", -roll, "outside the Master's ZON");
    s.clampNonNegative();
  }
  s.end(9);
}

/**
 * Stage 10 — Luck Check: Increased Damage. Explicitly blocked for NPs and for
 * abilities categorized as NP.
 * @param {PipelineState} s
 */
function stage10LuckIncreasedDamage(s) {
  s.begin(10);
  const v = s.ctx.luckChecks?.increasedDamage ?? 0;
  if (v && s.isNP) {
    s.note("luckIncreasedDamage", "blocked: cannot increase NP damage");
  } else if (v) {
    s.addProportional(v);
    s.contribute("luckIncreasedDamage", v, "Luck Check: Increased Damage");
  }
  s.end(10);
}

/**
 * Stage 11 — Magic Resistance, on the MAG portion only.
 *
 * Two modes. The rank version negates completely when the resistance meets or
 * exceeds the attack's rank, else reduces by a percentage. The `dice` version
 * (Proto Gil) subtracts a roll and **never** negates.
 *
 * @param {PipelineState} s
 */
function stage11Resistance(s) {
  s.begin(11);
  const mr = s.ctx.defender?.magicResistance;
  if (!mr || s.mag <= 0 || s.ctx.attack?.ignoresMagicResistance) {
    if (mr && s.ctx.attack?.ignoresMagicResistance) {
      s.note("resistance", "bypassed: attack is not affected by Magic Resistance");
    }
    return s.end(11);
  }

  if (mr.mode === "dice") {
    const roll = s.ctx.rolls?.magicResistanceDice ?? 0;
    s.mag = Math.max(0, s.mag - roll);
    s.contribute("magicResistance", -roll, `dice mode (${mr.formula ?? "?"}) — never negates`);
    return s.end(11);
  }

  // Rank mode. An unranked attack falls back to the attacker's MAG parameter.
  const attackRank = s.ctx.attack?.rank ?? s.ctx.attacker?.parameters?.mag ?? null;
  const mrRank = mr.rank instanceof Rank ? mr.rank : Rank.parseOrNull(mr.rank);
  if (Rank.gte(mrRank, attackRank, false)) {
    s.contribute("magicResistance", -s.mag, `negated: MR ${mrRank} ≥ attack ${attackRank}`);
    s.mag = 0;
    s.flags.negatedBy = "Magic Resistance";
  } else {
    const pct = mr.percent ?? lookupNumber("magicResistancePercent", mrRank);
    const lost = s.mag * (pct / 100);
    s.mag -= lost;
    s.contribute("magicResistance", -lost, `−${pct}% MAG (MR ${mrRank} < attack ${attackRank})`);
  }
  s.end(11);
}

/**
 * Stage 12 — flat reductions, applied proportionally and clamped at zero.
 * @param {PipelineState} s
 */
function stage12FlatReductions(s) {
  s.begin(12);
  let flat = 0;

  for (const m of activeMods(s, s.ctx.defender, FLAT_REDUCTION_KEYS)) {
    // Dmg Cut is explicitly NOT bypassed by Pierce, unlike Invuln and Block.
    flat += magnitudeOf(m, s.isNP);
    s.contribute(m.key, -magnitudeOf(m, s.isNP), m.source);
  }

  const bc = s.ctx.rolls?.battleContinuation ?? 0;
  if (bc) {
    flat += bc;
    s.contribute("battleContinuation", -bc, "Battle Continuation");
  }

  // Dice-mode `DamageNegation` elements the defender carries. The caller rolls
  // them -- the pipeline stays pure -- and passes the results keyed by source,
  // so a defender with two such skills gets both.
  for (const n of s.ctx.rolls?.negation ?? []) {
    const value = typeof n === "number" ? n : (n.value ?? 0);
    if (!value) continue;
    flat += value;
    s.contribute("damageNegation", -value, typeof n === "number" ? "damage negation" : n.source);
  }
  const tcDef = s.ctx.rolls?.territoryCreationDef ?? 0;
  if (tcDef) {
    flat += tcDef;
    s.contribute("territoryCreationDefence", -tcDef, "Territory Creation (defence)");
  }

  if (flat !== 0) {
    s.addProportional(-flat);
    s.clampNonNegative();
  }
  s.end(12);
}

/**
 * Stage 13 — Luck Check: Reduced Damage. No NP exclusion, unlike stage 10.
 * @param {PipelineState} s
 */
function stage13LuckReducedDamage(s) {
  s.begin(13);
  const v = s.ctx.luckChecks?.reducedDamage ?? 0;
  if (v) {
    s.addProportional(-v);
    s.contribute("luckReducedDamage", -v, "Luck Check: Reduced Damage");
    s.clampNonNegative();
  }
  s.end(13);
}

/**
 * Stage 14 — Block.
 *
 * A flat percentage of the finished number, **the same against Noble Phantasms
 * as against anything else** (Q1). `Block Up` adds percentage points and the
 * *Strengthen Block* Luck Check adds another full 25, i.e. 50% total.
 *
 * @param {PipelineState} s
 */
function stage14Block(s) {
  s.begin(14);
  if (s.ctx.reaction?.kind !== "block") return s.end(14);

  if (s.ctx.attack?.pierce) {
    s.note("block", "bypassed by Pierce");
    return s.end(14);
  }
  if (s.ctx.attack?.breakSucceeded) {
    s.note("block", "bypassed by Break");
    return s.end(14);
  }

  let pct = BLOCK_BASE_PERCENT;
  for (const m of activeMods(s, s.ctx.defender, new Set(["blockUp"]))) {
    pct += m.value;
    s.contribute("blockUp", m.value, m.source);
  }
  if (s.ctx.luckChecks?.strengthenBlock) {
    pct += BLOCK_BASE_PERCENT;
    s.contribute("strengthenBlock", BLOCK_BASE_PERCENT, "Luck Check: Strengthen Block");
  }

  pct = Math.min(pct, 100);
  s.scale(1 - pct / 100);
  s.contribute("block", -pct, `Block −${pct}% of Total Damage`);
  s.end(14);
}

/**
 * Stage 15 — modifiers whose text says **"Total Damage"**.
 *
 * Multiplicative here, unlike stage 4, because each is stated as operating on
 * the finished number independently. The phrase is the mechanical dividing
 * line and the content validator checks it against the effect's description.
 *
 * @param {PipelineState} s
 */
function stage15TotalDamageModifiers(s) {
  s.begin(15);
  for (const m of s.ctx.totalDamageModifiers ?? []) {
    if (!testPredicate(m.predicate, s.predicateCtx)) continue;
    s.scale(m.factor);
    s.contribute(m.key ?? "totalDamage", m.factor, m.source);
  }
  s.end(15);
}

/**
 * Stage 16 — absorption and the clamp.
 * @param {PipelineState} s
 */
function stage16AbsorptionAndClamp(s) {
  s.begin(16);
  const d = s.ctx.defender ?? {};

  // The injury snapshot is taken BEFORE Def Crk's addition, because
  // "additional damage taken due to Def Crk does not count towards the amount
  // required for an Injury Roll."
  s.flags.exceededInjuryThreshold = s.total > INJURY_THRESHOLD;

  for (const m of activeMods(s, d, new Set(["defCrk"]))) {
    s.addProportional(m.value);
    s.contribute("defCrk", m.value, m.source);
  }

  // Freeze's absorption clause needs the total, which is why it is here and not
  // at stage 0. Crystalfreeze is the same without the Fire escape.
  for (const [status, label] of [["freeze", "Freeze"], ["crystalfreeze", "Crystalfreeze"]]) {
    if (!has(d, status)) continue;
    if (s.total < 150) {
      s.contribute(status, -s.total, `${label}: attack under 150 does nothing`);
      s.zero();
      s.flags.negatedBy = label;
      return s.end(16);
    }
    s.note(status, `${label} broken; excess passes through`);
    s.removeFreeze = true;
  }

  if (has(d, "petrify") && s.total > 200) {
    s.flags.defeatedOutright = true;
    s.note("petrify", "over 200 in one attack — the unit is defeated");
  }

  if (has(d, "invuln") && !s.ctx.attack?.pierce) {
    // The NP halving already happened at stage 15; what remains is negation.
    if (!s.isNP) {
      s.contribute("invuln", -s.total, "Invuln");
      s.zero();
      s.flags.negatedBy = "Invuln";
      return s.end(16);
    }
  }

  const shield = d.shield ?? 0;
  if (shield > 0 && s.total > 0) {
    const absorbed = Math.min(shield, s.total);
    s.flags.shieldAbsorbed = absorbed;
    s.addProportional(-absorbed);
    s.contribute("shield", -absorbed, `Shield absorbed ${absorbed}`);
  }

  if (has(d, "endure") && d.health > 1 && s.total >= d.health) {
    const reduced = s.total - (d.health - 1);
    s.addProportional(-reduced);
    s.contribute("endure", -reduced, "Endure: leaves the unit at 1 Health");
  }

  s.clampNonNegative();
  s.floor();
  s.end(16);
}

/* ========================================================================== */
/*  Modifier bookkeeping                                                      */
/* ========================================================================== */

const ATTACKER_BUCKET_KEYS = new Set(["atkUp", "atkDwn", "dmgUp", "npDmUp", "npDmDwn"]);
const DEFENDER_BUCKET_KEYS = new Set(["defUp", "defDwn", "ward"]);
/** Attacker-side keys whose magnitude *reduces* damage. */
const NEGATIVE_KEYS = new Set(["atkDwn", "npDmDwn"]);
/** Defender-side keys that *increase* damage taken. */
const DEFENDER_POSITIVE_KEYS = new Set(["defDwn"]);
const FLAT_ATTACK_KEYS = new Set(["divinity", "dmgBoost", "avengerCounter", "flatDamage"]);
const FLAT_REDUCTION_KEYS = new Set(["dmgCut", "flatReduction"]);

/**
 * @param {object|null|undefined} unit
 * @param {string} id
 * @returns {boolean}
 */
function has(unit, id) {
  return Boolean(unit?.effects?.includes?.(id));
}

/**
 * Every modifier on `unit` whose key is wanted and whose predicate passes.
 * @param {PipelineState} s
 * @param {object|null|undefined} unit
 * @param {ReadonlySet<string>} keys
 * @returns {Modifier[]}
 */
function activeMods(s, unit, keys) {
  return (unit?.modifiers ?? []).filter(
    (m) => keys.has(m.key) && testPredicate(m.predicate, s.predicateCtx),
  );
}

/**
 * @param {PipelineState} s
 * @param {object|null|undefined} unit
 * @param {string} key
 * @returns {number}
 */
function sumMods(s, unit, key) {
  return activeMods(s, unit, new Set([key])).reduce((acc, m) => acc + magnitudeOf(m, s.isNP), 0);
}

/**
 * Most percentage buffs carry a reduced magnitude against Noble Phantasms.
 * @param {Modifier} m
 * @param {boolean} isNP
 * @returns {number}
 */
function magnitudeOf(m, isNP) {
  return isNP && m.npValue !== undefined ? m.npValue : m.value;
}

/**
 * `Over Crit`: while crit chance exceeds 100%, crit damage gains the excess.
 * @param {PipelineState} s
 * @returns {number}
 */
function overCritBonus(s) {
  if (!has(s.ctx.attacker, "overCrit")) return 0;
  return Math.max(0, (s.ctx.crit?.chanceUsed ?? 0) - 100);
}

/* ========================================================================== */
/*  State                                                                     */
/* ========================================================================== */

/**
 * Mutable accumulator threaded through the stages.
 *
 * Kept as a class rather than a plain object so that `contribute` and `note`
 * are impossible to forget: every arithmetic helper records the change. The
 * breakdown is the product, not a debugging aid.
 */
class PipelineState {
  /** @param {object} ctx */
  constructor(ctx) {
    this.ctx = ctx;
    this.mag = 0;
    this.phys = 0;
    this.fixed = 0;
    this.halted = false;
    this.converted = false;
    this.reflected = false;
    this.removeFreeze = false;
    /** @type {Array<object>} */
    this.breakdown = [];
    /** @type {object|null} */
    this.current = null;
    this.flags = {
      negatedBy: /** @type {string|null} */ (null),
      shieldAbsorbed: 0,
      exceededInjuryThreshold: false,
      defeatedOutright: false,
    };
    this.isNP = Boolean(ctx.attack?.kind === "np" || ctx.attack?.categorizedAsNP);
    this.predicateCtx = {
      options: ctx.options ?? new Set(),
      refs: { self: ctx.attacker, target: ctx.defender, attack: ctx.attack, board: ctx.board },
    };
  }

  get total() {
    return this.mag + this.phys;
  }

  /** @param {number} index */
  begin(index) {
    this.current = {
      index,
      name: STAGE_NAMES[index],
      before: { mag: round4(this.mag), phys: round4(this.phys) },
      after: null,
      contributors: [],
      notes: [],
    };
  }

  /** @param {number} index */
  end(index) {
    if (!this.current) return;
    this.current.after = { mag: round4(this.mag), phys: round4(this.phys) };
    // Keep every stage, including no-ops: a reader asking "why didn't Magic
    // Resistance apply?" needs to see that the stage ran and did nothing.
    this.breakdown.push(this.current);
    this.current = null;
    void index;
  }

  /**
   * @param {string} source
   * @param {number} value
   * @param {string} [note]
   */
  contribute(source, value, note) {
    this.current?.contributors.push({ source, value: round4(value), ...(note ? { note } : {}) });
  }

  /**
   * @param {string} source
   * @param {string} text
   */
  note(source, text) {
    this.current?.notes.push({ source, text });
  }

  /** @param {string} reason */
  halt(reason) {
    this.flags.negatedBy = reason;
    this.halted = true;
    this.mag = 0;
    this.phys = 0;
    this.note("precondition", `negated by ${reason}`);
    this.end(0);
  }

  /** @param {number} factor */
  scale(factor) {
    this.mag *= factor;
    this.phys *= factor;
  }

  /**
   * Add a flat amount, split across components in their current proportion.
   * @param {number} amount
   */
  addProportional(amount) {
    const t = this.total;
    if (t === 0) {
      this.phys += amount;
      return;
    }
    this.mag += amount * (this.mag / t);
    this.phys += amount * (this.phys / t);
  }

  /**
   * @param {number} total
   * @param {number} magShare
   */
  split(total, magShare) {
    this.mag = total * magShare;
    this.phys = total * (1 - magShare);
  }

  clampNonNegative() {
    if (this.total >= 0) {
      this.mag = Math.max(0, this.mag);
      this.phys = Math.max(0, this.phys);
      return;
    }
    this.zero();
  }

  zero() {
    this.mag = 0;
    this.phys = 0;
  }

  floor() {
    // Floor the total, then re-split so the components still sum to it exactly.
    const t = Math.max(0, Math.floor(this.total));
    const share = this.total > 0 ? this.mag / this.total : 0;
    this.mag = Math.round(t * share);
    this.phys = t - this.mag;
  }

  /** @returns {DamageResult} */
  finish() {
    if (this.current) this.end(this.current.index);
    return {
      total: round4(this.total),
      magical: round4(this.mag),
      physical: round4(this.phys),
      fixed: round4(this.fixed),
      breakdown: this.breakdown,
      flags: {
        ...this.flags,
        converted: this.converted,
        reflected: this.reflected,
        removeFreeze: this.removeFreeze,
      },
    };
  }
}

/**
 * @param {number} n
 * @returns {number}
 */
function round4(n) {
  return Math.round(n * 10000) / 10000;
}
