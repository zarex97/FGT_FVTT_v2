/**
 * @file Transfer, effect visibility, Confuse's selector, and Undo eligibility.
 * @see docs/15-effect-application.md, Ch. 15, docs/19-action-economy.md, Ch. 19
 *
 * Layer 2 (rules). Pure.
 *
 * Four small rules that share one property: each is about *who may know or
 * change what*, rather than about a number.
 */

import { test as testPredicate } from "./predicate.mjs";

/* -------------------------------------------------------------------------- */
/*  Ch. 15 Transfer                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Move an effect instance from one unit to another, keeping its duration.
 *
 * *"The buff is removed from the DU and applied to the AU instead, **with the
 * duration being maintained**."* Because durations are stored as **absolute
 * expiry ticks** (Ch. 04 D7.3), transfer is a move rather than a re-application
 * — which is what "maintained" means and what restarting the clock would break.
 *
 * The one adjustment is `pausedTicks`: if one of the two has been **Stopped**,
 * their clocks are offset, and an expiry carried across unchanged would land at
 * the wrong moment. Rebasing is the only arithmetic here.
 *
 * @param {object} instance the effect being moved
 * @param {object} from
 * @param {object} to
 * @returns {object[]} descriptors
 */
export function transferEffect(instance, from, to) {
  const rebased = instance.expiry === null || instance.expiry === undefined
    ? instance.expiry
    : instance.expiry - (from.pausedTicks ?? 0) + (to.pausedTicks ?? 0);

  return [
    { kind: "removeEffect", unitId: from.id, effectId: instance.id ?? instance.defId, reason: "transferred" },
    {
      kind: "applyEffect",
      unitId: to.id,
      // Stage travels with it: Van Gogh's Shadow of Longing gathers Curse from
      // everyone nearby, and "apply all stages accordingly" means the stages
      // arrive, not that the effect restarts at one.
      effect: { ...instance, expiry: rebased },
      sourceId: from.id,
    },
  ];
}

/**
 * Every instance a transfer would move, given a selector.
 *
 * @param {object[]} units the candidates
 * @param {object} spec
 * @param {string} [spec.defId] only this effect
 * @param {string} [spec.polarity] only buffs, or only debuffs
 * @returns {Array<{unit: object, instance: object}>}
 */
export function transferableFrom(units, spec = {}) {
  /** @type {Array<{unit: object, instance: object}>} */
  const out = [];
  for (const unit of units ?? []) {
    for (const instance of unit.effectInstances ?? []) {
      if (spec.defId && instance.defId !== spec.defId) continue;
      if (spec.polarity && instance.polarity !== spec.polarity) continue;
      // Unremovable effects cannot be taken off their bearer, and a transfer
      // removes before it applies.
      if (instance.unremovable) continue;
      out.push({ unit, instance });
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Ch. 15 Visibility                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Who may see an effect on a unit.
 *
 * The default is by polarity, and the asymmetry is deliberate: the **inflicter**
 * of a debuff also sees it, because they applied it and already know what they
 * applied. A buff has no inflicter to tell, so it stays with the owner and the
 * GM.
 *
 * @param {object} instance
 * @param {object} bearer
 * @returns {{visibleTo: string[], gm: true}}
 */
export function visibilityOf(instance, bearer) {
  const explicit = instance.visibility;
  if (explicit === "public" || explicit === "all") return { visibleTo: ["all"], gm: true };
  if (explicit === "gmOnly") return { visibleTo: [], gm: true };

  const viewers = [bearer?.ownerId ?? bearer?.id];
  // Telling the inflicter is not a leak: they are the ones who applied it.
  if (instance.polarity === "debuff" && instance.sourceUnitId) viewers.push(instance.sourceUnitId);

  return { visibleTo: viewers.filter(Boolean), gm: true };
}

/**
 * Can this viewer see this effect?
 *
 * @param {object} instance
 * @param {object} bearer
 * @param {object} viewer
 * @returns {boolean}
 */
export function canSeeEffect(instance, bearer, viewer) {
  if (viewer?.isGM) return true;
  const { visibleTo } = visibilityOf(instance, bearer);
  if (visibleTo.includes("all")) return true;
  return visibleTo.includes(viewer?.unitId) || visibleTo.includes(viewer?.id);
}

/* -------------------------------------------------------------------------- */
/*  Ch. 19 Confuse                                                             */
/* -------------------------------------------------------------------------- */

/** The four action classes a Confused unit may roll. */
export const CONFUSE_ACTIONS = Object.freeze(["move", "attack", "moveAndAttack", "nothing"]);

/**
 * What a Confused unit does, from rolls the caller made.
 *
 * Deliberately simple and **fully logged** — this is the one place the system
 * makes a tactical decision on a player's behalf, and an unexplained one would
 * be indistinguishable from a bug.
 *
 * A Confused unit **may attack its allies**, which is the point of the debuff,
 * so target enumeration takes every relation.
 *
 * @param {object} unit
 * @param {object[]} legalTargets already enumerated, any relation
 * @param {object} rolls
 * @param {number} rolls.action 1d4
 * @param {number} [rolls.direction] 1d4, cardinal
 * @param {number} [rolls.target] 1dN over `legalTargets`
 * @returns {{action: string, direction?: string, targetId?: string|null, trace: object[]}}
 */
export function confusedAction(unit, legalTargets, rolls) {
  const action = CONFUSE_ACTIONS[Math.min(CONFUSE_ACTIONS.length, Math.max(1, rolls.action)) - 1];
  /** @type {object[]} */
  const trace = [{ step: "action", roll: rolls.action, result: action }];

  const out = { action, trace };

  if (action === "move" || action === "moveAndAttack") {
    const cardinals = ["n", "e", "s", "w"];
    const direction = cardinals[Math.min(4, Math.max(1, rolls.direction ?? 1)) - 1];
    out.direction = direction;
    trace.push({ step: "direction", roll: rolls.direction, result: direction });
  }

  if (action === "attack" || action === "moveAndAttack") {
    const targets = legalTargets ?? [];
    if (targets.length === 0) {
      out.targetId = null;
      trace.push({ step: "target", result: "none in reach" });
    } else {
      const index = Math.min(targets.length, Math.max(1, rolls.target ?? 1)) - 1;
      out.targetId = targets[index].id;
      trace.push({ step: "target", roll: rolls.target, result: targets[index].id, of: targets.length });
    }
  }

  return out;
}

/* -------------------------------------------------------------------------- */
/*  Ch. 19 Undo                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Actions that can never be taken back, and why.
 *
 * The boundary is **information disclosure**: once an opponent has learned
 * something from your action, undoing it would let you extract information for
 * free. That is the classic take-back exploit, and it is the only line that
 * matters — everything else is convenience.
 */
const IRREVERSIBLE = Object.freeze({
  attackResolved: "the defender has already reacted",
  commandSpell: "your opponent saw the spend",
  revealedInformation: "it showed your opponent something",
  turnEnded: "the turn is over",
});

/**
 * May this action be undone?
 *
 * @param {object} action a log entry
 * @param {object} ctx
 * @param {boolean} ctx.turnEnded
 * @param {string} [ctx.actingFactionId]
 * @returns {{ok: boolean, reason?: string}}
 */
export function canUndo(action, ctx) {
  if (ctx?.turnEnded) return { ok: false, reason: IRREVERSIBLE.turnEnded };
  // Only your own turn: undoing during somebody else's would rewrite a board
  // they are currently reasoning about.
  if (ctx?.actingFactionId && action?.factionId && action.factionId !== ctx.actingFactionId) {
    return { ok: false, reason: "it is not your turn" };
  }

  if (action?.revealedToOpponent) return { ok: false, reason: IRREVERSIBLE.revealedInformation };

  switch (action?.kind) {
    case "move":
    case "facing":
    case "targeting":
      return { ok: true };
    case "abilityUsed":
      // A skill nobody could see is still yours to take back.
      return action.opponentVisible
        ? { ok: false, reason: IRREVERSIBLE.revealedInformation }
        : { ok: true };
    case "attack":
      return action.resolved
        ? { ok: false, reason: IRREVERSIBLE.attackResolved }
        : { ok: true };
    case "commandSpell":
      return { ok: false, reason: IRREVERSIBLE.commandSpell };
    default:
      // Unknown actions are NOT undoable. The safe direction is refusing to
      // rewind something whose consequences this function does not understand.
      return { ok: false, reason: "this action cannot be undone" };
  }
}

/* -------------------------------------------------------------------------- */
/*  Stage removal                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Take stages off a staged instance without taking the instance off.
 *
 * Van Gogh's `Gogh` buff: *"Whenever Gogh performs a successful Attack, remove
 * one stage of Curse from Gogh … If the Attack was a Crit, remove 2 stages."*
 *
 * `RemoveEffect` deletes the whole instance, which is the wrong shape twice
 * over: it would take a Stage 7 Curse to nothing in one swing, and it would
 * report one removal where the buff pays per stage.
 *
 * **It reports only what it actually took.** At Stage 1 a Crit asks for two
 * and gets one, and the event says −1 — because the buff grants an Atk Up per
 * stage removed, and claiming −2 would pay her for a stage that was never
 * there. That is the same clause as *"apply Atk Up … **if a stage of Curse was
 * removed**"*, answered with arithmetic instead of a condition.
 *
 * @param {object|null} instance the staged instance, or null if there is none
 * @param {number} stages how many to take
 * @param {string|null} cause who is taking them, for `curseStageChanged`
 * @returns {{removed: boolean, stage: number, event: object|null}}
 */
export function removeStages(instance, stages = 1, cause = null) {
  const held = instance?.stage ?? 0;
  if (!instance || held <= 0) return { removed: false, stage: 0, event: null };

  const taken = Math.min(Math.max(1, stages), held);
  const stage = held - taken;

  return {
    removed: stage <= 0,
    stage,
    event: {
      unitId: instance.unitId ?? null,
      defId: instance.defId,
      stageDelta: -taken,
      newStage: stage,
      cause,
    },
  };
}

/**
 * How many separate applications one authored effect entry is worth.
 *
 * *"Has a 500% chance of inflicting Curse on herself, **3 times**"* — Van
 * Gogh's Imaginary Numbers Arts, and *The Yellow House* says the same thing
 * twice over.
 *
 * This is the third of three counts an effect entry can carry, and they are
 * genuinely different statements:
 *
 *   - `stages: N` — ONE application worth N stages. One roll, one
 *     `curseStageChanged` carrying a delta of N.
 *   - `uses: N` (authored as `times`) — ONE application worth N charges.
 *     Kingprotea's Proliferation Stocks.
 *   - `applications: N` — N applications. N rolls, N events.
 *
 * The chance is what forces the distinction: a chance is rolled per
 * application, so "3 times at 500%" and "one application worth 3 stages" agree
 * only while the chance cannot fail. Below 100% they are different abilities.
 *
 * Floors at one. A zero would silently delete an effect the ability's own text
 * states, which reads exactly like the ability working.
 *
 * @param {object} spec the effect entry
 * @param {object} [rule] the rule it sits on, for the nested `{effect: {...}}` shape
 * @returns {number}
 */
export function applicationsOf(spec, rule = null) {
  const authored = spec?.applications ?? rule?.applications ?? 1;
  const n = Number(authored);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

/**
 * Whether one authored effect entry applies to THIS recipient.
 *
 * An `applyEffects` phase resolves a set of recipients once and then applies
 * each of its entries to all of them. A `predicate` on an entry narrows that
 * entry alone to a subset:
 *
 * > *"Applies Crit DmUp … **again** to all affected allied Units with the
 * > 'Existence Outside the Domain' Skill."* — De Sterrennacht clause 2
 *
 * Note what this is NOT. `countTargets` asks a question about the SET ("how
 * many of the Units I am about to buff carry the Skill") and answers with one
 * number every recipient shares. This asks about each recipient in turn and
 * answers yes or no. De Sterrennacht needs both, three lines apart, which is
 * why the distinction is worth a function of its own.
 *
 * Tested against the same option set the phase already builds for its chance
 * modifiers, so the recipient is addressed as `target:` and the caster as
 * `self:` — the spelling every other predicate in the corpus uses.
 *
 * @param {object} spec the effect entry
 * @param {object|null} rule the rule it sits on, for the nested shape
 * @param {object} ctx `{options}`
 * @returns {boolean}
 */
export function effectGatePasses(spec, rule, ctx) {
  const predicate = spec?.predicate ?? rule?.predicate ?? null;
  if (!predicate || predicate.length === 0) return true;
  // `test` membership-checks a Set; the phase hands one over, but a caller with
  // a plain array should not silently fail every predicate.
  const options = ctx?.options instanceof Set ? ctx.options : new Set(ctx?.options ?? []);
  return testPredicate(predicate, { options });
}
