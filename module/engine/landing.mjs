/**
 * @file Landing: the one door every authored Effect comes through.
 * @see docs/15-effect-application.md, CONTEXT.md (Effect Entry, Landing)
 *
 * Layer 3 (orchestration). An Effect Entry was applied in eight places, each
 * assembling `applyEffect`'s arguments itself, so the same entry meant one
 * thing on a Noble Phantasm and another on a Skill: `uses` was read on one
 * path, `stages` was missing on a check's effects, the Skill path read no ring
 * and no per-panel chance, a field rolled its chance twice, and Shock's
 * `onApply` ran only for effects a handler applied. About thirteen Surprises
 * came from that drift.
 *
 * So every path hands its entry here, with what it knows about where the entry
 * came from, and gets back what happened. In order:
 *
 *   1. the entry's own gate (`predicate`), asked of the caster as the BOARD
 *      sees it, so a gate on where the caster stands can pass;
 *   2. its count: `applications` separate applications, or `times` of them;
 *   3. its magnitude, resolved once against the caster;
 *   4. one option set, with `attack:` options only when there is an attack;
 *   5. its chance, and a die only when the chance is not certain;
 *   6. `effect-applier.applyEffect`, with every key;
 *   7. the Prevention Luck Check, inside a Combat Process;
 *   8. what the effect does as it lands (`onApply`), and a log line when it
 *      was resisted;
 *   9. one summary row, which is what the player reads.
 *
 * `test/unit/landing-one-door.test.mjs` fails if anything else calls
 * `applyEffect`.
 */

import { applyEffect, inflictBonusOf, mergeEmitted } from "./effect-applier.mjs";
import { EffectRegistry } from "../rules/registry.mjs";
import { rollOptionsFor } from "../rules/options.mjs";
import { test as testPredicate } from "../rules/predicate.mjs";
import { applicationsOf, chanceOf, effectGatePasses, timesOf } from "../rules/effect-flow.mjs";
import { resolveValue } from "../rules/elements.mjs";
import { expressionRefs, stacksHeld } from "../rules/snapshot.mjs";
import { countTargetsMagnitude } from "../rules/effects/count-targets.mjs";
import { checkPlan, luckCheck } from "../rules/checks.mjs";
import { luckChecksApply } from "../rules/difficulty.mjs";
import { luckChecksBlocked } from "../rules/bounded-fields.mjs";
import { chebyshevFromAny } from "../domain/geometry.mjs";
import { currentBoard, currentTick, unitFrom } from "./board.mjs";
import { askOwner } from "./ask.mjs";
import { dispatch } from "./scheduler.mjs";
import * as I from "./intents.mjs";

/**
 * @typedef {object} LandingContext
 * @property {object} target the recipient as the board sees it
 * @property {{unitId: string|null, abilityId?: string|null, fieldId?: string|null, terrain?: string|null}} source
 * @property {object|null} [caster] the caster's Actor, for `@` expressions and stacks
 * @property {object|null} [casterUnit] the caster as the board sees it; projected here when absent
 * @property {object|null} [attack] the Attack Description's facts, when an attack delivers the entry
 * @property {string[]} [attackOptions] the `attack:` options an intent carried instead
 * @property {number|null} [distance] panels from the source to the target; measured when absent
 * @property {number|null} [band] the targeting ring the target stands in
 * @property {object[]} [targets] every recipient of the phase, for `countTargets`
 * @property {object|null} [ride] the ride's own facts, for an `@` magnitude
 * @property {object|null} [event] the event a handler answers, for `times: "@field"`
 * @property {number|null} [rolled] a die already rolled for this chance
 * @property {object|null} [process] the Combat Process state, which offers Prevention
 * @property {object|null} [emitted] the intent being resolved, whose stated expiry stands
 * @property {object|null} [board]
 */

/**
 * @typedef {object} LandingResult
 * @property {"applied"|"blocked"|"resisted"|"noop"|"prevented"} outcome
 * @property {string|null} reason
 * @property {string|null} chance the die against its chance, when one was rolled
 * @property {object[]} intents what the caller writes
 * @property {{id: string, name: string, outcome: string, reason: string|null, chance: string|null}} summary
 * @property {number|null} roll the d100, when one was rolled
 * @property {object[]} trace
 */

/**
 * Land one application of an entry on one target.
 *
 * Decides and does not write: the caller writes `intents`, as everywhere else
 * in the engine. It may ask a player a question (Prevention), so it is async.
 *
 * @param {object} entry an Effect Entry (`rules/effect-flow.mjs#entryOf`)
 * @param {LandingContext} ctx
 * @returns {Promise<LandingResult>}
 */
export async function landEffect(entry, ctx) {
  const def = EffectRegistry.get(entry?.id);
  if (!def) return unknownEffect(entry, ctx);

  const board = ctx.board ?? currentBoard();
  const target = ctx.target;
  const caster = casterUnitOf(ctx, board);
  const options = optionsFor(caster, target, ctx);
  const tick = currentTick();
  const turnsPerRound = game.settings.get("fgt", "turnsPerRound");

  const magnitude = magnitudeOf(entry, def, ctx, caster);
  const npMagnitude = (entry.npMagnitude === undefined ? null : authoredMagnitude(entry, ctx.caster, "npMagnitude", ctx))
    ?? npFactorOf(entry, magnitude);
  const stated = chanceOf(entry, { distance: ctx.distance ?? distanceBetween(caster, target), band: ctx.band ?? null });
  // *"Hidden while the inflicter is concealed"*: Secret Poison, decided as it lands.
  const hidden = Boolean(entry.secret) && concealed(caster);

  const args = {
    def,
    target,
    magnitude,
    npMagnitude,
    duration: entry.duration ?? null,
    permanent: Boolean(entry.permanent),
    unremovable: Boolean(entry.unremovable),
    source: { abilityId: null, fieldId: null, terrain: null, ...ctx.source },
    chanceModifiers: entry.chanceModifiers ?? [],
    chance: stated,
    stages: entry.stages ?? 1,
    // Charges, for a counted effect: what the entry states, or its `times`.
    uses: (entry.stacking ?? def.stacking) === "count" ? (entry.uses ?? ctx.times ?? null) : (entry.uses ?? null),
    // How THIS application stacks, where the entry says: Bab-ilu's *"for
    // debuffs which do not stack, its duration is extended instead"* and its
    // No Buff counted *"1 time per number of dice which rolled a 9"* (#232).
    stacking: entry.stacking ?? null,
    // Enkidu: *"if the DU has the 'Divine' Attribute, Debuff Immune effects
    // cannot prevent Stun from being inflicted, even those which specifically
    // affect Stun (Debuff Resist can still reduce the chance!)"* (#232).
    bypassesImmunity: bypassesImmunityFor(entry, options),
    bypassChanceModifiers: Boolean(entry.bypassChanceModifiers),
    visibility: hidden ? "gmOnly" : (entry.visibility ?? "public"),
    attributionHidden: hidden || Boolean(ctx.attributionHidden),
  };
  const flowCtx = {
    turnsPerRound,
    currentTick: tick,
    // The APPLIER's own outgoing `ApplicationChance`, tested against the same
    // options as everything else here. It was handed none, so a contribution
    // with a predicate could never pass.
    inflictBonus: caster ? inflictBonusOf(caster, def, options) : 0,
    options,
    ignoresResistanceFrom: entry.ignoresResistanceFrom ?? [],
  };

  // The die, only when the chance can fail. Asked first with a die that always
  // misses: if that still lands, the chance is certain and no die is rolled. It
  // was rolled for every application, so a card's roll log was full of dice
  // that decided nothing.
  let roll = typeof ctx.rolled === "number" ? ctx.rolled : null;
  let result = applyEffect({ ...args, ctx: { ...flowCtx, roll: roll ?? 101 } });
  if (roll === null && result.outcome === "resisted") {
    roll = (await new Roll("1d100").evaluate()).total;
    result = applyEffect({ ...args, ctx: { ...flowCtx, roll } });
  }

  let { outcome, reason } = result;
  /** @type {object[]} */
  let intents = result.intents;
  // The line the card prints beside the name: the die against its chance, and
  // a Prevention Luck Check that was made. An applied effect shows this and no
  // reason, so a failed check that cost a Luck would otherwise say nothing.
  let line = result.chance ?? null;

  // A ward that negates debuffs its holder picks, before any Luck is spent on
  // them: the Master's Avalon, *"negate up to Y additional negative effects
  // (i.e. debuffs) from that Attack"*, the Master's pick (#230 reading 19).
  if (outcome === "applied") {
    const ward = await offerWard(def, target);
    if (ward?.negated) {
      outcome = "negated";
      reason = ward.line;
      intents = [...ward.spend, I.log({ kind: "effectNegated", unitId: target.id, defId: def.id, tick })];
    }
  }

  if (outcome === "applied") {
    const check = await offerPrevention(def, target, ctx, board);
    if (check?.prevented) {
      outcome = "prevented";
      // The outcome says "prevented"; the reason says how.
      reason = check.line;
      intents = [...check.spend, I.log({ kind: "effectPrevented", unitId: target.id, defId: def.id, tick })];
    } else if (check) {
      line = [line, `${check.line}: failed`].filter(Boolean).join("; ");
      intents = [...intents, ...check.spend];
    }
  }

  if (ctx.emitted) intents = intents.map((i) => mergeEmitted(i, ctx.emitted, { tick }));

  if (outcome === "applied") intents.push(...landedIntents(def, target, result, board, tick, turnsPerRound));
  // What this application restores as it lands, beside the effect. Expert of
  // Many Specializations: *"a 70% chance of restoring 3 Agility ... If
  // successful, also apply AGL Up"* -- one die, and the restore is the
  // ENTRY's, not AGL Up's, which other sheets apply with no restore (#226).
  // A restore: the maximum caps it.
  if (outcome === "applied") {
    for (const r of Array.isArray(entry.restores) ? entry.restores : []) {
      if (typeof r?.stat === "string" && Number.isFinite(r.delta) && r.delta !== 0) {
        intents.push(I.statDelta(target.id, r.stat, r.delta, true));
      }
    }
  }
  if (outcome === "resisted") {
    // The card of a handler's rider reads this back (`attack.mjs#fireDamageDealt`):
    // Usui's Disable rolled under its 50% and Mannanán's resistance took it to
    // 30% with nothing saying so (#195).
    intents.push(I.log({
      kind: "effectResisted", unitId: target.id, defId: def.id,
      sourceUnitId: ctx.source?.unitId ?? null, chance: reason ?? null, tick,
    }));
  }

  return {
    outcome,
    reason,
    chance: line,
    intents,
    roll,
    trace: result.trace ?? [],
    summary: { id: def.id, name: def.name, outcome, reason, chance: line },
  };
}

/**
 * Whether this application passes every immunity: `true`, or a predicate
 * tested against the landing's options (Enkidu's, on a `Divine` DU).
 *
 * @param {object} entry
 * @param {Set<string>} options
 * @returns {boolean}
 */
function bypassesImmunityFor(entry, options) {
  const spec = entry?.bypassesImmunity;
  if (!spec) return false;
  if (spec === true) return true;
  return testPredicate(Array.isArray(spec) ? spec : spec.predicate ?? [], { options });
}

/**
 * Land an entry on one recipient: its gate, its count, and every application.
 *
 * Writes between applications, because a staged effect decides its next stage
 * from what the target already carries: three applications against one
 * snapshot compute Stage 1 three times.
 *
 * @param {object} entry
 * @param {LandingContext} ctx
 * @param {object} io
 * @param {(intents: object[]) => Promise<unknown>} io.write writes one application's intents
 * @param {() => object|null} [io.reread] the recipient as it now stands
 * @returns {Promise<Array<{summary: object, result: LandingResult}>>}
 */
export async function landEntry(entry, ctx, { write, reread = null }) {
  if (!entry) return [];
  const board = ctx.board ?? currentBoard();
  const caster = casterUnitOf(ctx, board);
  // The entry's own gate, asked of each recipient (De Sterrennacht clause 2),
  // with the caster as the BOARD sees it: Great Ram's *"if Nemo is within a
  // Waterside area"* is a fact about where he stands.
  if (!effectGatePasses(entry, null, { options: optionsFor(caster, ctx.target, ctx) })) return [];

  // `times` is a count. On a counted effect it is charges, one application
  // worth N (Kingprotea); on anything else it is N applications (Gogh's one
  // Atk Up per stage removed). Zero is no application at all.
  const def = EffectRegistry.get(entry.id);
  const times = timesOf(entry.times, { stacks: ctx.caster ? stacksHeld(ctx.caster) : {}, event: ctx.event ?? null });
  if (times !== null && times <= 0) return [];
  const counted = (entry.stacking ?? def?.stacking) === "count";
  const applications = applicationsOf(entry) * (times !== null && !counted ? times : 1);

  /** @type {Array<{summary: object, result: LandingResult}>} */
  const out = [];
  for (let n = 0; n < applications; n += 1) {
    const target = n === 0 ? ctx.target : (reread?.() ?? ctx.target);
    const result = await landEffect(entry, { ...ctx, board, target, times: counted ? times : null });
    if (result.intents.length > 0) await write(result.intents);
    out.push({ summary: result.summary, result });
    // The chance's other branch. Expert of Many Specializations: *"Applies
    // Dodge with a 70% chance of applying it for ⅔◈ Turns, otherwise it is only
    // applied for ⅓◈ Turns."* A failed die lands the shorter one, uncertain no
    // longer; a blocked one (No Buff) lands nothing (#226 reading 11).
    if (result.outcome === "resisted" && entry.otherwise && typeof entry.otherwise === "object") {
      const { chance: _chance, otherwise: _otherwise, ...rest } = entry;
      const fallback = await landEffect({ ...rest, ...entry.otherwise }, {
        ...ctx, board, target: reread?.() ?? target, times: counted ? times : null,
      });
      if (fallback.intents.length > 0) await write(fallback.intents);
      out.push({ summary: { ...fallback.summary, chance: fallback.summary.chance ?? "otherwise" }, result: fallback });
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */

/**
 * The caster as the board sees it: auras, terrain and fields included.
 *
 * A bare snapshot carries none of them, so Item Construction's +50 never
 * reached a Skill's debuff (#193) and a gate on where Nemo stands never
 * passed (#191).
 *
 * @param {LandingContext} ctx
 * @param {object} board
 * @returns {object|null}
 */
function casterUnitOf(ctx, board) {
  if (ctx.casterUnit) return ctx.casterUnit;
  const id = ctx.source?.unitId ?? ctx.caster?.id ?? null;
  const doc = ctx.caster ?? (id ? game.actors.get(id) : null);
  return doc ? unitFrom(board, doc) : null;
}

/**
 * One option set for the gate, the chance modifiers, the inflicter's bonus and
 * the target's resistance.
 *
 * `attack:` options only from an attack. `rollOptionsFor` invents
 * `attack:kind:normal` when it is handed none, so a Skill's debuff looked like
 * a Normal Attack to every clause that asked (#190, #199).
 *
 * @param {object|null} caster
 * @param {object|null} target
 * @param {LandingContext} ctx
 * @returns {Set<string>}
 */
function optionsFor(caster, target, ctx) {
  const options = rollOptionsFor({ attacker: caster, defender: target, attack: ctx.attack ?? null });
  for (const o of ctx.attackOptions ?? []) options.add(o);
  return options;
}

/**
 * The magnitude, resolved once: the phase's target count, then an authored
 * number or expression, then the definition's own.
 *
 * @param {object} entry
 * @param {object} def
 * @param {LandingContext} ctx
 * @param {object|null} caster
 * @returns {number}
 */
function magnitudeOf(entry, def, ctx, caster) {
  const raw = entry.magnitude;
  if (raw && typeof raw === "object" && raw.countTargets) {
    return countTargetsMagnitude(raw.countTargets, ctx.targets ?? [], caster?.id ?? ctx.source?.unitId ?? null);
  }
  return authoredMagnitude(entry, ctx.caster, "magnitude", ctx) ?? def.defaultMagnitude ?? 0;
}

/**
 * An authored magnitude, which may be a number or an `@` expression.
 *
 * Resolved against the CASTER at the moment it lands. `null` passes through:
 * `npMagnitude` uses it to mean *"no reduced NP magnitude"*, and coercing that
 * to 0 would make every buff worth nothing against a Noble Phantasm.
 *
 * The attack path and the Skill path each had a copy, and only the attack's
 * knew about a ride.
 *
 * @param {object} entry
 * @param {object|null} actor the caster's Actor
 * @param {string} field
 * @param {LandingContext} ctx
 * @returns {number|null}
 */
function authoredMagnitude(entry, actor, field, ctx) {
  const raw = entry?.[field];
  if (raw === null || raw === undefined) return null;
  // A literal with no `perStack` and no `max` cannot mean anything else.
  if (typeof raw === "number" && !entry.perStack && entry.max === undefined) return raw;
  if (!actor) return typeof raw === "number" ? raw : null;

  const ride = ctx.ride ?? null;
  const value = resolveValue(entry, null, {
    // The ride's own facts, and `@self.remainingMov` overridden with the
    // pre-ride figure: the ride's `markTurn` lands before the attack resolves.
    refs: expressionRefs(actor, {
      tick: currentTick(),
      ...(ride ? { ride, hitCount: ride.hitCount, self: { remainingMov: ride.remainingMov } } : {}),
    }),
    // A magnitude that scales with what the caster carries (Kingprotea).
    stacks: stacksHeld(actor),
  }, field);
  return typeof value === "number" ? value : null;
}

/**
 * The NP magnitude as a factor of the resolved one. De Sterrennacht's base is
 * computed from its targets, so *"if NP, the value is halved"* cannot be an
 * absolute.
 *
 * @param {object} entry
 * @param {number} magnitude
 * @returns {number|null}
 */
function npFactorOf(entry, magnitude) {
  const factor = entry?.npMagnitudeFactor ?? null;
  return typeof factor === "number" ? Math.floor(magnitude * factor) : null;
}

/**
 * Panels from the caster's nearest panel to the target's nearest.
 *
 * @param {object|null} from
 * @param {object|null} to
 * @returns {number|null}
 */
function distanceBetween(from, to) {
  const a = from?.panels ?? (from?.panel ? [from.panel] : null);
  const b = to?.panels ?? (to?.panel ? [to.panel] : null);
  if (!a?.length || !b?.length) return null;
  const d = Math.min(...b.map((p) => chebyshevFromAny(a, p)));
  return Number.isFinite(d) ? d : null;
}

/**
 * @param {object|null} unit
 * @returns {boolean}
 */
function concealed(unit) {
  return Boolean(unit?.concealed) || (unit?.effects ?? []).includes("presenceConcealment");
}

/**
 * What an effect does as it LANDS, once: Shock's *"maximum and current Agility
 * are reduced by 3"*.
 *
 * The maximum is derived and comes back when the effect goes; the current is
 * stored, so its half is paid here (#106). It was paid only for effects a
 * handler applied, so Shock from a rider or a Skill took the maximum and left
 * the current alone. A refresh replaces an instance already paid for.
 *
 * @returns {object[]}
 */
function landedIntents(def, target, result, board, tick, turnsPerRound) {
  const created = !def.terminal
    && !result.intents.some((i) => i.t === "removeEffect" && i.reason === "refreshed");
  if (!created || !def.onApply?.length) return [];
  const handler = { source: def.name ?? def.id, abilityId: null, defId: def.id };
  const ctx = { board, tick, turnsPerRound, effectDef: (id) => EffectRegistry.get(id) };
  return def.onApply.flatMap((a) => dispatch({ ...a, kind: a.kind ?? a.key }, target, handler, ctx));
}

/**
 * Offer a debuff's target the ward it holds: negate this one, at the cost of
 * one of the ward's uses.
 *
 * `debuffWard`, with `uses` the number it may negate -- the Master's Avalon's Y
 * (#230). Each debuff is asked as it lands, so the holder's owner picks which,
 * up to Y (reading 19). A closed window negates nothing.
 *
 * @param {object} def
 * @param {object} target
 * @returns {Promise<{negated: boolean, spend: object[], line: string}|null>}
 */
async function offerWard(def, target) {
  if (def.polarity !== "debuff") return null;
  const ward = (target.effectInstances ?? []).find((i) => i.defId === "debuffWard" && (i.uses ?? 0) > 0);
  if (!ward) return null;
  const doc = game.actors.get(target.id);
  if (!doc || target.defeated || doc.system?.defeated) return null;
  const answer = await askOwner(doc, {
    kind: "confirm",
    title: game.i18n.localize("FGT.Ward.Title"),
    hint: game.i18n.format("FGT.Ward.Ask", { name: doc.name, effect: def.name, left: ward.uses }),
  });
  if (!answer?.accepted) return null;
  return {
    negated: true,
    spend: [I.consumeUse(target.id, "debuffWard")],
    line: game.i18n.format("FGT.Ward.Negated", { left: ward.uses - 1 }),
  };
}

/**
 * The Prevention Luck Check (CONTEXT.md): a Unit about to receive a debuff
 * during a Combat Process may spend 1 Luck on a Luck Check to stop it, once per
 * Combat Process. Never against a terminal Effect.
 *
 * The rule had a step in `applyEffect` since effects were written and nothing
 * ever offered it: no caller set `preventionAvailable`.
 *
 * Asked of the target's owner, on their screen. It costs the Luck whatever the
 * die says, and it is not offered where Luck Checks are not (Beginner and
 * Intermediate, Ch. 29), with no Luck to spend, or inside a duel that forbids
 * them.
 *
 * @param {object} def
 * @param {object} target
 * @param {LandingContext} ctx
 * @param {object} board
 * @returns {Promise<{prevented: boolean, spend: object[], line: string}|null>} null when not offered or declined
 */
async function offerPrevention(def, target, ctx, board) {
  const state = ctx.process ?? null;
  if (!state || def.polarity !== "debuff") return null;
  if (def.terminal || def.volatility === "terminal") return null;
  if (state.prevented?.[target.id]) return null;
  if (!luckChecksApply(board?.difficulty)) return null;
  if (luckChecksBlocked(target)) return null;
  const luck = target.luck ?? 0;
  if (luck <= 0) return null;

  const doc = game.actors.get(target.id);
  if (!doc) return null;
  // Nothing left to protect. A rider lands after the damage that defeated its
  // target, and the board Unit it was handed can predate that defeat: the live
  // document is what knows. Asking a dead Master to spend Luck held the whole
  // Process on the question (#206).
  if (target.defeated || doc.system?.defeated) return null;
  const answer = await askOwner(doc, { kind: "luckCheck", check: "prevention", unitId: target.id, defId: def.id });
  if (!answer?.accepted) return null;

  // Once per Process, whatever the die says: the check was made.
  (state.prevented ??= {})[target.id] = true;

  const roll = (await new Roll("1d20").evaluate()).total;
  const plan = checkPlan(target, "luck");
  const check = luckCheck({
    roll,
    luck,
    hasBoost: (target.effects ?? []).includes("luckBoost") || plan.forceTable === "favourable",
    hasLoss: (target.effects ?? []).includes("luckLoss") || plan.forceTable === "unfavourable",
    modifiers: plan.modifiers,
  });
  const spend = [
    // A platform sharing its owner's Luck spends hers: `io.mjs#adjustStat` redirects it.
    I.statDelta(target.id, "luck.value", -1),
    I.log({
      kind: "check", check: "prevention", unitId: target.id, defId: def.id,
      roll: check.roll, total: check.total, target: check.target, success: check.success,
      modifiers: check.modifiers,
    }),
  ];
  return { prevented: check.success, spend, line: `Luck Check ${check.total} vs ${check.target}` };
}

/**
 * @param {object} entry
 * @param {LandingContext} ctx
 * @returns {LandingResult}
 */
function unknownEffect(entry, ctx) {
  // Loud: a missing definition means the ability silently does less than its
  // text says, which reads exactly like the ability working.
  const id = entry?.id ?? "?";
  console.warn(`FGT | ${ctx.source?.abilityId ?? "An ability"} applies unknown effect "${id}"`);
  ui.notifications?.warn(`FGT | Unknown effect "${id}"`);
  return {
    outcome: "noop", reason: "unknown effect", chance: null, intents: [], roll: null, trace: [],
    summary: { id, name: id, outcome: "noop", reason: "unknown effect", chance: null },
  };
}
