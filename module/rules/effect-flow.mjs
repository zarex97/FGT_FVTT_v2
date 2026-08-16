/**
 * @file Transfer, effect visibility, Confuse's selector, and Undo eligibility.
 * @see docs/11-effect-engine.md §11.8, §11.10, docs/18-action-economy.md §18.5, §18.7
 *
 * Layer 2 (rules). Pure.
 *
 * Four small rules that share one property: each is about *who may know or
 * change what*, rather than about a number.
 */

/* -------------------------------------------------------------------------- */
/*  §11.8 Transfer                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Move an effect instance from one unit to another, keeping its duration.
 *
 * *"The buff is removed from the DU and applied to the AU instead, **with the
 * duration being maintained**."* Because durations are stored as **absolute
 * expiry ticks** (Ch. 07 D7.3), transfer is a move rather than a re-application
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
/*  §11.10 Visibility                                                         */
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
/*  §18.5 Confuse                                                             */
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
/*  §18.7 Undo                                                                */
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
