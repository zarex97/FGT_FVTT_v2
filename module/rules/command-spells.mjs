/**
 * @file Command Spells — which one may be used, when, and what it does.
 * @see docs/17-command-spells.md
 *
 * Layer 2 (rules). Pure: it takes snapshots and a catalogue and returns
 * verdicts and **effects as data**. The engine turns effects into intents, the
 * same division `OnEvent` actions use — the rules layer never constructs an
 * intent, because intents are how layer 3 writes.
 *
 * Everything downstream of a spend already existed: the `spendCS` intent, the
 * applier case, `io.spendCommandSpells`, and `commandSpells` on the Master's
 * schema. What did not exist was anything that decided which command was
 * offerable, so nothing ever built the intent and no Command Spell was ever
 * spent by anybody.
 *
 * Two properties the chapter is emphatic about and this preserves:
 *
 *   - **An unusable command is never offered.** Van Gogh's immunity "must be
 *     checked at offer time so the option never appears", and the same argument
 *     applies to cost: stopping a resolution to ask a question with one answer
 *     is worse than not asking.
 *   - **Cost can depend on the Master.** Kill Yourself is 1 for a High Rank
 *     Master and 2 for a Low Rank one, and 1 for everybody when the whole table
 *     is Rankless.
 */

import { currentHealth } from "../domain/health.mjs";
import { availableFor } from "./cs-namespacing.mjs";
import { chebyshev } from "../domain/geometry.mjs";
import { paysHighColumn } from "./master-rank.mjs";

/** The interruptible points (§17.4). `anyTime` commands are offered at all of them. */
export const WINDOWS = Object.freeze({
  beforeAttack: "beforeAttack",
  react: "react",
  acceptOrEscape: "s23_acceptOrEscape",
  beforeDamage: "beforeDamage",
  duringDamage: "damage",
  onDefeat: "onDefeat",
  ownTurn: "ownTurn",
  validationFailure: "validationFailure",
});

/**
 * What this command costs this Master.
 *
 * @param {object} command
 * @param {object} master
 * @param {object} [settings]
 * @param {boolean} [settings.allMastersRankless]
 * @returns {number}
 */
export function costOf(command, master, settings = {}) {
  const variant = command.costByMasterRank;
  if (!variant) return command.cost ?? 1;
  // "If all Masters are Rankless, the Kill Yourself command only costs one."
  if (settings.allMastersRankless) return variant.high;
  return paysHighColumn(master) ? variant.high : variant.low;
}

/**
 * Whether a Master may use this command right now.
 *
 * Reports the **first** failing requirement, by its `kind`, so a refusal names
 * one thing rather than listing everything at once.
 *
 * @param {object} command
 * @param {object} ctx
 * @returns {{ok: boolean, reason?: string, cost: number}}
 */
export function canSpend(command, ctx) {
  const cost = costOf(command, ctx.master, ctx.settings);
  // §16.9: the pool is per RELATIONSHIP. A Master with three spells borrowed
  // for Archer cannot spend them on Lancer, and the flat count could not say so.
  if (availableFor(ctx.master, ctx.servant?.id ?? null) < cost) {
    return { ok: false, reason: "cost", cost };
  }

  for (const req of command.requirements ?? []) {
    if (!meets(req, ctx)) return { ok: false, reason: req.kind, cost };
  }

  // `blockedWhen` is a state-scoped veto rather than a requirement: Half Heal
  // is legal in general and illegal *during a Damage Step that would defeat
  // the Servant*, which is a fact about this moment, not about the pair.
  for (const block of command.blockedWhen ?? []) {
    if (block.state === ctx.state && conditionHolds(block.condition, ctx)) {
      return { ok: false, reason: "blocked", cost };
    }
  }

  return { ok: true, cost };
}

/**
 * Every command offerable at this moment, already filtered to the usable ones.
 *
 * @param {object[]} catalogue
 * @param {object} ctx
 * @returns {object[]}
 */
export function availableCommands(catalogue, ctx) {
  return (catalogue ?? []).filter((command) => {
    if (!windowOpen(command, ctx.window)) return false;
    return canSpend(command, ctx).ok;
  });
}

/**
 * The command's effects, resolved against the units they apply to.
 *
 * Data, not intents — the engine dispatches these. A percent-of-maximum change
 * is resolved here because the maxima are on the snapshot, and the engine
 * should not be re-deriving a number the rules already know.
 *
 * @param {object} command
 * @param {object} ctx
 * @returns {object[]}
 */
export function effectsOf(command, ctx) {
  /** @type {object[]} */
  const out = [];

  for (const effect of command.effect ?? []) {
    const unit = targetOf(effect.target, ctx);
    if (!unit) continue;

    switch (effect.kind) {
      case "statChange":
        for (const change of effect.changes ?? []) {
          out.push({
            kind: "statChange",
            unitId: unit.id,
            stat: change.stat,
            delta: deltaFor(change, unit),
            clamp: change.clamp !== false,
          });
        }
        break;
      case "defeat":
        out.push({ kind: "defeat", unitId: unit.id });
        break;
      default:
        out.push({ ...effect, unitId: unit.id });
        break;
    }
  }

  return out;
}

/* -------------------------------------------------------------------------- */
/*  Internals                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * @param {object} command
 * @param {string|undefined} window
 * @returns {boolean}
 */
function windowOpen(command, window) {
  const timing = command.timing ?? {};
  if (timing.window === "anyTime") return true;
  if (!window) return true;
  if (timing.window === window) return true;
  return Array.isArray(timing.states) && timing.states.includes(window);
}

/**
 * @param {object} req
 * @param {object} ctx
 * @returns {boolean}
 */
function meets(req, ctx) {
  const { master, servant } = ctx;
  switch (req.kind) {
    case "servantInZon":
      return !servant?.outsideZon;
    case "attackIsNotNP":
      return ctx.attack?.kind !== "np";
    case "targetNotImmune":
      // The immunity is a granted attribute, so content declares it and the
      // offer never shows the option (§17.6).
      return !(servant?.attributes ?? []).includes(immunityFor(ctx.command ?? req));
    case "servantWithin":
      return distance(master, servant) <= (req.panels ?? 2);
    case "servantNotWithin":
      return distance(master, servant) > (req.panels ?? 2);
    case "highRankMaster":
      return paysHighColumn(master);
    case "inZone":
      return inZone(req, master, servant);
    case "notInZone":
      // Escape's *"pair not already in the Home Base"* — there is nothing to
      // escape from if you are already there.
      return !inZone(req, master, servant);
    case "noOtherRevival":
      // Survive Kill is the only 3-cost command in the game, and the rules
      // guard against spending it on a Servant who would have come back anyway.
      return !hasRevivalAvailable(servant);
    default:
      // An unknown requirement refuses rather than passes. A command whose
      // gate nobody implemented must not become a command with no gate.
      return false;
  }
}

/**
 * Every requirement kind {@link meets} understands.
 *
 * Exported so a test can hold the shipped catalogue against it. An unrecognised
 * kind makes `canSpend` refuse, which is the safe direction — but it means the
 * command compiles, loads, appears in the pack and **can never be used by
 * anybody**, silently. That is this project's most common defect shape, and
 * comparing the two lists is the cheapest place to catch it.
 */
export const REQUIREMENT_KINDS = Object.freeze([
  "servantInZon", "attackIsNotNP", "targetNotImmune",
  "servantWithin", "servantNotWithin", "highRankMaster",
  "inZone", "notInZone", "noOtherRevival",
]);

/**
 * Is the subject standing in a named zone?
 *
 * `who: "pair"` means both Master and Servant, which is what Escape's *"pair
 * not already in the Home Base"* asks about — one of them being home is not
 * the same as being safe.
 *
 * @param {object} req
 * @param {object} master
 * @param {object} servant
 * @returns {boolean}
 */
function inZone(req, master, servant) {
  const holds = (u) => (u?.zones ?? []).includes(req.zone);
  return req.who === "pair" ? holds(master) && holds(servant) : holds(servant);
}

/**
 * Would this Servant come back without spending three Command Spells?
 *
 * Reads the normalized `unitDefeated` handlers the effect engine already
 * builds (Ch. 45 A1), so Battle Continuation and God Hand answer for
 * themselves rather than being named here — and a revive whose own cooldown is
 * running does not count, because it will not fire.
 *
 * @param {object} servant
 * @returns {boolean}
 */
function hasRevivalAvailable(servant) {
  for (const handler of servant?.eventHandlers ?? []) {
    const listens = handler.events
      ? handler.events.includes("unitDefeated")
      : handler.event === "unitDefeated";
    if (!listens) continue;
    if (!(handler.actions ?? []).some((a) => a.kind === "Revive")) continue;

    const ability = (servant.abilities ?? []).find((a) => a.id === handler.abilityId);
    if ((ability?.cooldownRemaining ?? 0) <= 0) return true;
  }
  return false;
}

/**
 * The attribute that blocks a command.
 *
 * Van Gogh's is the only stated one, and it is keyed to the command rather than
 * being a blanket "immune to Command Spells" so a future exception can name its
 * own command.
 *
 * @param {object} req
 * @returns {string}
 */
function immunityFor(req) {
  return req.attribute ?? "immuneToKillYourself";
}

/**
 * @param {string} condition
 * @param {object} ctx
 * @returns {boolean}
 */
function conditionHolds(condition, ctx) {
  switch (condition) {
    case "damageWouldDefeatServant":
      return (ctx.incomingDamage ?? 0) >= currentHealth(ctx.servant);
    default:
      return false;
  }
}

/**
 * @param {string} target
 * @param {object} ctx
 * @returns {object|null}
 */
function targetOf(target, ctx) {
  switch (target) {
    case "master": return ctx.master ?? null;
    case "contractedServant":
    default: return ctx.servant ?? null;
  }
}

/**
 * @param {object} change
 * @param {object} unit
 * @returns {number}
 */
function deltaFor(change, unit) {
  if (change.deltaPercentOfMax === undefined) return change.delta ?? 0;
  const max = unit?.[change.stat]?.max ?? 0;
  return Math.floor((max * change.deltaPercentOfMax) / 100);
}

/**
 * @param {object} a
 * @param {object} b
 * @returns {number}
 */
function distance(a, b) {
  if (!a?.panel || !b?.panel) return Infinity;
  return chebyshev(a.panel, b.panel);
}

