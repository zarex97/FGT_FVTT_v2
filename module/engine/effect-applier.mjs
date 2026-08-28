/**
 * @file The seven-step effect application pipeline.
 * @see docs/11-effect-engine.md §11.2
 *
 * Layer 3 (orchestration), but **pure**: it decides and emits intents. The
 * caller supplies the chance roll, as everywhere else in the rules layer.
 *
 * Every step records its outcome, so the chat card can say *"Curse resisted
 * (rolled 78 vs 65%)"* or *"Charm blocked by Berserk"* rather than silently
 * doing nothing — which is the single most common complaint about automated
 * effect systems.
 */

import { applicationChance } from "../rules/checks.mjs";
import { test } from "../rules/predicate.mjs";
import { currentHealth } from "../domain/health.mjs";
import { resolveTicks, parseTick } from "../domain/tick.mjs";
import { INFINITE } from "../domain/enums.mjs";
import * as I from "./intents.mjs";

/**
 * @typedef {object} ApplicationResult
 * @property {"applied"|"blocked"|"resisted"|"noop"} outcome
 * @property {string|null} reason the blocking effect or the failed gate
 * @property {Intent[]} intents
 * @property {Array<{step: string, outcome: string, detail?: string}>} trace
 */

/** Mental debuffs are mutually exclusive; each blocks the other two. */
const MENTAL_EXCLUSIVITY = Object.freeze({
  charm: ["confuse", "berserk"],
  berserk: ["charm", "confuse"],
  confuse: ["charm", "berserk"],
});

/** Sleep derivatives replace `Sleep` but cannot replace one another. */
const SLEEP_DERIVATIVES = Object.freeze(["nightmare", "coma"]);

/**
 * Apply one effect to one target.
 *
 * @param {object} args
 * @param {object} args.def the effect definition from the registry
 * @param {object} args.target the target's unit snapshot
 * @param {number} [args.magnitude]
 * @param {number|null} [args.npMagnitude] the reduced magnitude against an NP
 * @param {string|number|null} [args.duration] a ◈ expression
 * @param {object} args.source `{unitId, abilityId}`
 * @param {object} args.ctx `{turnsPerRound, currentTick, roll, inflictBonus, resist}`
 * @param {object[]} [args.chanceModifiers] per-effect modifiers the ability declares
 * @param {number|null} [args.chance] the ability's own stated chance, which
 *   overrides the effect definition's `baseChance`
 * @param {number} [args.stages] how many stages one application adds. `1`
 *   everywhere but Serenity's Zabaniya, which *"inflicts Stage 3 Poison"*.
 * @param {string} [args.visibility] who may see the instance
 * @param {boolean} [args.attributionHidden] apply the result, hide the cause
 * @returns {ApplicationResult}
 */
export function applyEffect({
  def, target, magnitude = 0, npMagnitude = null, duration = null, source, ctx,
  chanceModifiers = [], chance = null, stages = 1, bypassChanceModifiers = false,
  visibility = "public", attributionHidden = false,
}) {
  /** @type {Array<{step: string, outcome: string, detail?: string}>} */
  const trace = [];
  const held = target.effects ?? [];
  const instances = target.effectInstances ?? [];

  // ── 1. IMMUNITY GATE ─────────────────────────────────────────────────────
  const immunity = findImmunity(def, target, held);
  if (immunity) {
    trace.push({ step: "immunity", outcome: "blocked", detail: immunity });
    return blocked(immunity, trace);
  }
  trace.push({ step: "immunity", outcome: "passed" });

  // ── 2. REPLACEMENT / EXCLUSIVITY GATE ────────────────────────────────────
  const exclusion = findExclusion(def, held);
  if (exclusion.blocked) {
    trace.push({ step: "exclusivity", outcome: "blocked", detail: exclusion.by });
    return blocked(exclusion.by, trace);
  }
  trace.push({
    step: "exclusivity",
    outcome: exclusion.replaces.length ? "replace" : "passed",
    detail: exclusion.replaces.join(", ") || undefined,
  });

  // ── 3. CHANCE ROLL ───────────────────────────────────────────────────────
  //
  // Per-effect modifiers the ABILITY declares, as opposed to the standing
  // contributions the units carry. Medea's Atlas is the reference case and the
  // reason they are a list rather than one number: "reduced by 25% on Units
  // with a MAG Rank of B or higher; reduced by 25% on Units with a Magic
  // Resistance of Rank B or higher; **this reduction does stack**."
  // Skipped outright when `bypassChanceModifiers` is set: Queen's Poison's
  // extra Stage is "a flat 50% chance ... not affected by debuff chance
  // increasing/reducing effects", and `matched`/`declared` are themselves
  // debuff-chance modifiers the ability declares.
  const matched = bypassChanceModifiers ? [] : (chanceModifiers ?? []).filter(
    (m) => !m.predicate || test(m.predicate, { options: ctx.options ?? new Set() }),
  );
  const declared = matched.reduce((sum, m) => sum + (m.value ?? 0), 0);

  const chanceSpec = applicationChance({
    // The ABILITY may state its own chance, overriding the effect's default.
    // Scáthach's Gáe Bolg Alternative has both extremes on one Noble Phantasm:
    // Stun at **500%**, which is not "guaranteed" but "guaranteed through four
    // stacked resistances", and Instakill at 75%. Reading only `def.baseChance`
    // made every stated chance in the game inert -- Stun's own 100 would have
    // applied to both.
    base: (chance ?? def.baseChance ?? 100) + declared,
    inflictBonus: bypassChanceModifiers ? 0 : (ctx.inflictBonus ?? 0),
    // The target's own resistance, from its `ApplicationChance` contributions.
    // `ctx.resist` had no supplier: every caller left it at 0, so Off.Debuff
    // ResUp and Magic Resistance's clause 2 had nowhere to land. Reading it off
    // the target here closes the loop without every caller having to know.
    resist: bypassChanceModifiers ? 0 : (ctx.resist ?? resistanceOf(target, def, ctx.options)),
    immune: false,
    bypassesImmunity: Boolean(def.bypassesImmunity),
  });
  const automatic = chanceSpec.percent >= 100;
  const roll = ctx.roll ?? 1;
  const succeeded = automatic || roll <= chanceSpec.percent;
  trace.push({
    step: "chance",
    outcome: succeeded ? "passed" : "resisted",
    // Logged even when automatic, so the audit trail never has a silent step.
    detail: automatic
      ? `${chanceSpec.percent}% (automatic)`
      : `rolled ${roll} vs ${chanceSpec.percent}%`
        + (matched.length > 0 ? ` [${matched.map((m) => `${m.source} ${m.value}`).join(", ")}]` : ""),
  });
  if (!succeeded) {
    return { outcome: "resisted", reason: `rolled ${roll} vs ${chanceSpec.percent}%`, intents: [], trace };
  }

  // ── 4. PREVENTION WINDOW ─────────────────────────────────────────────────
  // Offered once per Combat Process, and never against terminal effects.
  if (ctx.preventionAvailable && def.volatility !== "terminal") {
    trace.push({ step: "prevention", outcome: "offered" });
    return {
      outcome: "noop",
      reason: "awaiting Luck Check: Prevention",
      intents: [I.prompt(ctx.targetUserId, { kind: "luckCheck", check: "prevention", defId: def.id })],
      trace,
    };
  }

  // ── 5. STACKING RESOLUTION ───────────────────────────────────────────────
  const existing = instances.filter((e) => e.defId === def.id);
  const stack = resolveStacking(def, existing, magnitude, stages);
  trace.push({ step: "stacking", outcome: stack.action, detail: stack.detail });
  if (stack.action === "noop") {
    return { outcome: "noop", reason: "already present, does not refresh", intents: [], trace };
  }

  // ── 6. CONSTRUCT ─────────────────────────────────────────────────────────
  // Duration is stored as an ABSOLUTE expiry tick, not a countdown, so that
  // Stop's clock freeze and mid-game ◈ changes cannot corrupt it (Ch. 07 §7.5).
  // An effect nobody gave a clock to does not expire; it is removed by a Cure,
  // by consumption, or by whatever its own text says.
  //
  // `resolveTicks(null)` is **0**, which is a legitimate answer for "this turn"
  // and a disastrous default for "unstated": the expiry lands on the current
  // tick, so the instance is swept by the very next boundary -- before it has
  // ticked once. Found live. Poison is the case that exposed it (Appendix A
  // gives it no duration at all, because it runs until it is cured), and it was
  // applied, staged to 1, and removed at the end of the same Round having dealt
  // nothing.
  const authored = duration ?? def.defaultDuration ?? null;
  const ticks = authored === null ? INFINITE : resolveTicks(parseTick(authored), ctx);
  const expiry = ticks === INFINITE ? null : (ctx.currentTick ?? 0) + ticks;

  const effect = {
    defId: def.id,
    magnitude: stack.magnitude,
    // Carried separately, because it is a second magnitude and not a scaling
    // of the first: Appendix A's pairs are 25/15 and 50/30, neither of which
    // is a fixed ratio of the other.
    npMagnitude: npMagnitude ?? def.defaultNpMagnitude ?? null,
    stage: stack.stage,
    uses: stack.uses,
    expiry,
    sourceUnitId: source?.unitId ?? null,
    sourceAbilityId: source?.abilityId ?? null,
    polarity: def.polarity,
    volatility: def.volatility,
    unremovable: Boolean(def.unremovable),
    // Deferred disclosure (Appendix A §A.18). Both fields have been on the
    // instance schema since `0.2.0` and NOTHING wrote either of them, so
    // Secret Poison had a place to live and no way to get there.
    visibility,
    attributionHidden: Boolean(attributionHidden),
  };

  // ── 7. EMIT ──────────────────────────────────────────────────────────────
  //
  // A TERMINAL effect is a consequence, not a condition. Appendix A's Instakill
  // is "Health reduced to 0" and Death is "the Unit is defeated" -- neither is
  // something a Unit then *carries*, and creating a document for one would
  // leave an "Instakill" badge sitting on a corpse for the rest of the match
  // while the Health it was supposed to remove stayed where it was.
  //
  // Scathach has both, one on each Noble Phantasm, which is why this had to
  // exist before either of them could do anything.
  if (def.terminal) {
    trace.push({ step: "terminal", outcome: def.terminal.kind });
    return { outcome: "applied", reason: null, intents: terminalIntents(def, target), trace };
  }

  const intents = exclusion.replaces.map((id) => I.removeEffect(target.id, id, "replaced"));

  // The stacking ACTION has to reach the intents, and it did not: every branch
  // emitted a bare `applyEffect`, which always creates. So `refresh`, `extend`
  // and `stage` each produced a SECOND document instead of replacing the first,
  // and every effect using one of those rules -- Bleed, Burn, Stun, most of
  // Appendix A -- silently duplicated on reapplication.
  //
  // `magnitudeStacks` is the one rule where a second instance is the point:
  // "magnitudes sum at read time, and each keeps its own duration and source."
  if (REPLACING_ACTIONS.has(stack.action)) {
    intents.push(I.removeEffect(target.id, def.id, "refreshed"));
  }

  // Marked as having been through this flow. An `applyEffect` intent that has
  // NOT been is expanded at the applier boundary -- see `resolveEffects` there
  // -- because a bare intent skips immunity, resistance, exclusivity and
  // stacking, and the scheduler's `ApplyEffect` action emits exactly that.
  intents.push({ ...I.applyEffect(target.id, effect, source?.unitId ?? null), resolved: true });
  return { outcome: "applied", reason: null, intents, trace };
}

/**
 * What a terminal effect actually does.
 *
 * The two differ in more than degree. **Instakill** empties the Health pool and
 * lets the ordinary defeat machinery run, so `Guts` and Heracles's God Hand
 * still get their say. **Death** defeats outright and *"ignores all revival
 * effects"*, which is why it is a `defeat` intent rather than a very large
 * amount of damage -- damage would be caught by `Endure`, and Endure has no
 * business surviving Death.
 *
 * Neither is `damage`: Health *loss* must not feed damage-keyed triggers
 * (Ch. 06), so an Instakill cannot pay out a `Dmged NP Regen`.
 *
 * @param {object} def
 * @param {object} target
 * @returns {Intent[]}
 */
function terminalIntents(def, target) {
  switch (def.terminal.kind) {
    case "reduceToZero":
      return [
        I.statDelta(target.id, "health.value", -currentHealth(target), false),
        I.log({ kind: "terminal", effect: def.id, unitId: target.id }),
      ];
    case "defeat":
      return [I.defeat(target.id, def.id)];
    default:
      // Loud rather than silent: an unrecognised terminal kind means the most
      // consequential effect in the game did nothing at all.
      console.error(`FGT | Effect "${def.id}" declares an unknown terminal kind "${def.terminal.kind}".`);
      return [];
  }
}

/**
 * Stacking actions that REPLACE the instance already present.
 *
 * `create` adds beside what is there and `noop` never reaches the emit step, so
 * these three are the ones that must clear the old document first.
 */
const REPLACING_ACTIONS = new Set(["refresh", "extend", "stage"]);

/**
 * Apply a batch of buffs from one ability.
 *
 * `No Buff` is checked **once per applying ability**, not per buff, because the
 * source is explicit: *"If a single effect that applies multiple buffs is used
 * on a Unit with No Buff, all of those buffs will fail to be applied."*
 *
 * @param {object} args
 * @param {object[]} args.defs
 * @param {object} args.target
 * @param {object} args.source
 * @param {object} args.ctx
 * @param {Record<string, {magnitude?: number, duration?: string}>} [args.params]
 * @returns {{results: ApplicationResult[], intents: Intent[], blockedWholesale: boolean}}
 */
export function applyBatch({ defs, target, source, ctx, params = {} }) {
  const held = target.effects ?? [];
  const buffs = defs.filter((d) => d.polarity === "buff");
  if (buffs.length > 0 && held.includes("noBuff")) {
    return {
      results: buffs.map(() => ({ outcome: "blocked", reason: "No Buff", intents: [], trace: [] })),
      intents: [],
      blockedWholesale: true,
    };
  }

  const results = defs.map((def) =>
    applyEffect({
      def,
      target,
      magnitude: params[def.id]?.magnitude ?? def.defaultMagnitude ?? 0,
      duration: params[def.id]?.duration ?? null,
      source,
      ctx: { ...ctx, roll: ctx.rolls?.[def.id] ?? ctx.roll },
    }),
  );
  return { results, intents: results.flatMap((r) => r.intents), blockedWholesale: false };
}

/* -------------------------------------------------------------------------- */

/**
 * @param {object} def
 * @param {object} target
 * @param {string[]} held
 * @returns {string|null} the name of the blocking effect
 */
function findImmunity(def, target, held) {
  if (held.includes(`immune:${def.id}`)) return `${def.id} Immune`;

  // Immunities granted by a rule element rather than carried as an effect --
  // a class skill that reads "immune to Charm" produces an entry here, and it
  // has to gate at exactly the same point as the `Charm Immune` status does.
  const granted = target.immunities ?? [];
  if (granted.includes(def.id)) return `${def.id} Immune`;
  if (def.polarity === "debuff" && granted.includes("debuff")) return "Debuff Immune";
  if (def.polarity === "debuff" && def.volatility && granted.includes(`debuff:${def.volatility}`)) {
    return `${def.volatility} Debuff Immune`;
  }

  if (def.polarity === "buff") return held.includes("noBuff") ? "No Buff" : null;
  if (def.polarity !== "debuff") return null;

  // Terminal debuffs are NOT covered by Debuff Immune unless the immunity says
  // so — Instakill, Death and Erase have their own resistance ladder.
  if (def.volatility === "terminal" && !def.coveredByDebuffImmune) return null;

  if (held.includes("debuffImmune")) return "Debuff Immune";
  const scoped = {
    nonVolatile: "nvDebuffImmune",
    volatile: "vDebuffImmune",
    mental: "menDebuffImmune",
  }[def.volatility];
  if (scoped && held.includes(scoped)) return scoped;
  if (def.valence === "offensive" && held.includes("offDebuffImmune")) return "Off.Debuff Immune";
  if (def.valence === "defensive" && held.includes("defDebuffImmune")) return "Def.Debuff Immune";
  return null;
}

/**
 * @param {object} def
 * @param {string[]} held
 * @returns {{blocked: boolean, by: string|null, replaces: string[]}}
 */
function findExclusion(def, held) {
  // Replacement is checked FIRST, so a pair that declares both does not refuse
  // itself. EMIYA's Circuits are the reference case: mutually exclusive AND
  // deliberately swappable, which `blocks` alone cannot say.
  const replaced = (def.replaces ?? []).filter((id) => held.includes(id));
  if (replaced.length > 0) return { blocked: false, by: null, replaces: replaced };

  for (const id of def.blockedBy ?? []) {
    if (held.includes(id)) return { blocked: true, by: id, replaces: [] };
  }
  for (const id of def.blocks ?? []) {
    if (held.includes(id)) return { blocked: true, by: id, replaces: [] };
  }

  const mental = MENTAL_EXCLUSIVITY[def.id];
  if (mental) {
    const conflict = mental.find((id) => held.includes(id));
    if (conflict) return { blocked: true, by: conflict, replaces: [] };
  }

  // Sleep-family state machine: a derivative replaces Sleep, using its own
  // duration; a unit already carrying a derivative takes neither Sleep nor
  // another derivative.
  if (def.id === "sleep" && SLEEP_DERIVATIVES.some((d) => held.includes(d))) {
    return { blocked: true, by: SLEEP_DERIVATIVES.find((d) => held.includes(d)), replaces: [] };
  }
  if (SLEEP_DERIVATIVES.includes(def.id)) {
    const other = SLEEP_DERIVATIVES.find((d) => d !== def.id && held.includes(d));
    if (other) return { blocked: true, by: other, replaces: [] };
    if (held.includes("sleep")) return { blocked: false, by: null, replaces: ["sleep"] };
  }

  return { blocked: false, by: null, replaces: [] };
}

/**
 * @param {object} def
 * @param {object[]} existing instances of the same definition already present
 * @param {number} magnitude
 * @param {number} [stages] how many stages this application is worth
 * @returns {{action: string, magnitude: number, stage: number, uses: number, detail?: string}}
 */
function resolveStacking(def, existing, magnitude, stages = 1) {
  const current = existing[0];
  switch (def.stacking ?? "noneNoRefresh") {
    case "noneNoRefresh":
      return current
        ? { action: "noop", magnitude: current.magnitude, stage: current.stage ?? 0, uses: current.uses ?? 0 }
        : { action: "create", magnitude, stage: 0, uses: def.uses ?? 0 };

    case "noneRefresh":
      return { action: current ? "refresh" : "create", magnitude, stage: 0, uses: def.uses ?? 0 };

    case "noneExtend":
      return { action: current ? "extend" : "create", magnitude, stage: 0, uses: def.uses ?? 0 };

    case "stage": {
      // *"Reapplication adds a stage"* -- one, normally. Serenity's Zabaniya
      // *"inflicts Stage 3 Poison"* in a single application, and reading that as
      // three separate applications would roll its chance three times.
      const stage = (current?.stage ?? 0) + Math.max(1, stages);
      return { action: current ? "stage" : "create", magnitude, stage, uses: 0, detail: `stage ${stage}` };
    }

    case "magnitudeStacks":
      // A second instance, not a bigger one — magnitudes sum at read time, and
      // each keeps its own duration and source.
      return { action: "create", magnitude, stage: 0, uses: def.uses ?? 0, detail: `instance ${existing.length + 1}` };

    case "highestOnly":
      if (current && current.magnitude >= magnitude) {
        return { action: "noop", magnitude: current.magnitude, stage: 0, uses: 0, detail: "weaker than existing" };
      }
      return { action: current ? "replace" : "create", magnitude, stage: 0, uses: 0 };

    case "count": {
      const uses = (current?.uses ?? 0) + (def.uses ?? 1);
      return { action: current ? "count" : "create", magnitude, stage: 0, uses, detail: `${uses} uses` };
    }

    default:
      throw new RangeError(`FGT | Unknown stacking rule "${def.stacking}" on effect "${def.id}".`);
  }
}

/**
 * @param {string} reason
 * @param {Array<object>} trace
 * @returns {ApplicationResult}
 */
function blocked(reason, trace) {
  return { outcome: "blocked", reason, intents: [], trace };
}

/**
 * How much this target resists having `def` applied to it.
 *
 * Sums the `ApplicationChance` contributions that point inwards and match the
 * effect — by name if the contribution names one, otherwise by valence, which
 * is what "Off.Debuff ResUp" selects on.
 *
 * @param {object} target the target's unit snapshot
 * @param {object} def the effect definition
 * @returns {number} percentage points of resistance
 */
function resistanceOf(target, def, options = null) {
  return chanceContribution(target, def, "incoming", options);
}

/**
 * How much this attacker's own contributions IMPROVE what it inflicts.
 *
 * `inflictBonus` has been a parameter of `applyEffect` since effects were
 * written, and **every caller passed 0** — so an outgoing `ApplicationChance`
 * was collected on every snapshot and read by nothing. Medea's Item
 * Construction is the first content that needs it, and it would have been
 * silently inert.
 *
 * @param {object} attacker the attacker's unit snapshot
 * @param {object} def
 * @returns {number} percentage points
 */
export function inflictBonusOf(attacker, def, options = null) {
  return chanceContribution(attacker, def, "outgoing", options);
}

/**
 * The matching `ApplicationChance` contributions, in one direction.
 *
 * A contribution that names a **severity** applies only to that tier. Appendix
 * A keeps Instakill, Death and Erase out of ordinary chance modifiers "unless
 * stated", so an unnamed contribution covers `normal` alone — the safe reading,
 * and the one that stops a generic Debuff ChUp quietly improving a Death roll.
 *
 * @param {object} unit
 * @param {object} def
 * @param {string} direction
 * @returns {number}
 */
function chanceContribution(unit, def, direction, options = null) {
  const severity = def.severity ?? "normal";
  let total = 0;

  for (const c of unit?.applicationChances ?? []) {
    if ((c.direction ?? "incoming") !== direction) continue;
    if (c.effectId && c.effectId !== def.id) continue;

    // DEBUFFS, unless the contribution names one effect outright. Every clause
    // of this shape in the corpus is about inflicting or resisting a debuff --
    // *"chance of inflicting debuffs"*, *"chance of being inflicted by
    // debuffs"* -- and nothing anywhere modifies how likely a buff is to land.
    //
    // Without the filter, Serenity's Silent Dance raised the application chance
    // of her own self-buffs: Presence Concealment went on at "110% (automatic)",
    // which is harmless at 100 and would not have been on anything resistible.
    if (def.polarity !== "debuff") continue;
    if (c.valence && c.valence !== def.valence) continue;
    // Appendix A's classification, which is what "Mental Debuffs" names.
    // Heracles's Bravery is the only content that uses it, and naming the
    // mental debuffs one by one would go stale the moment another was written.
    if (c.volatility && c.volatility !== def.volatility) continue;

    // Named severity: those tiers only. Unnamed: `normal` only. A LIST is
    // accepted because Magic Resistance covers three of the four at one
    // magnitude -- *"also affects Instakill and Death ... Erase is completely
    // unaffected"* -- and writing it as three contributions would say the
    // rank table is consulted three times.
    const tiers = [c.severity ?? "normal"].flat();
    if (!tiers.includes(severity)) continue;

    // A condition on the ATTACK, evaluated now. Magic Resistance's ladder
    // exempts *"an Attack/Attack Skill/Spell/NP that deals STR damage or that
    // is not affected by Magic Resistance"*, which is a property of the
    // incoming attack rather than of the bearer -- so it cannot be a
    // collection-time predicate.
    if (c.predicate && !test(c.predicate, { options: options ?? new Set() })) continue;

    total += c.value ?? 0;
  }
  return total;
}
