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
 * @param {string|number|null} [args.duration] a ◈ expression
 * @param {object} args.source `{unitId, abilityId}`
 * @param {object} args.ctx `{turnsPerRound, currentTick, roll, inflictBonus, resist}`
 * @returns {ApplicationResult}
 */
export function applyEffect({ def, target, magnitude = 0, duration = null, source, ctx }) {
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
  const chanceSpec = applicationChance({
    base: def.baseChance ?? 100,
    inflictBonus: ctx.inflictBonus ?? 0,
    resist: ctx.resist ?? 0,
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
    detail: automatic ? `${chanceSpec.percent}% (automatic)` : `rolled ${roll} vs ${chanceSpec.percent}%`,
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
  const stack = resolveStacking(def, existing, magnitude);
  trace.push({ step: "stacking", outcome: stack.action, detail: stack.detail });
  if (stack.action === "noop") {
    return { outcome: "noop", reason: "already present, does not refresh", intents: [], trace };
  }

  // ── 6. CONSTRUCT ─────────────────────────────────────────────────────────
  // Duration is stored as an ABSOLUTE expiry tick, not a countdown, so that
  // Stop's clock freeze and mid-game ◈ changes cannot corrupt it (Ch. 07 §7.5).
  const ticks = resolveTicks(parseTick(duration ?? def.defaultDuration ?? null), ctx);
  const expiry = ticks === INFINITE ? null : (ctx.currentTick ?? 0) + ticks;

  const effect = {
    defId: def.id,
    magnitude: stack.magnitude,
    stage: stack.stage,
    uses: stack.uses,
    expiry,
    sourceUnitId: source?.unitId ?? null,
    sourceAbilityId: source?.abilityId ?? null,
    polarity: def.polarity,
    volatility: def.volatility,
    unremovable: Boolean(def.unremovable),
  };

  // ── 7. EMIT ──────────────────────────────────────────────────────────────
  const intents = exclusion.replaces.map((id) => I.removeEffect(target.id, id, "replaced"));
  intents.push(I.applyEffect(target.id, effect, source?.unitId ?? null));
  return { outcome: "applied", reason: null, intents, trace };
}

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
 * @returns {{action: string, magnitude: number, stage: number, uses: number, detail?: string}}
 */
function resolveStacking(def, existing, magnitude) {
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
      const stage = (current?.stage ?? 0) + 1;
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
