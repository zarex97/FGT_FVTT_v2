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
/*  Ch. 15 Riders                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The options that describe the ATTACK an event was raised for.
 *
 * An effect an event rider delivers is applied long after the attack's own
 * option set was built, by a path that has only the intent to go on, and an
 * intent has nowhere to put a Set. Magic Resistance's Instakill and Death
 * clause exempts *"an Attack ... that deals STR damage or that is not affected
 * by Magic Resistance"* -- an `attackPredicate`, tested against the attack's
 * options when the effect lands -- so those options ride on the effect as an
 * array and the applier rebuilds the Set (`engine/applier.mjs#riderOptions`).
 * Only `attack:*`: the rest describe the bearer and the target, which the
 * applier reads off the Units it is handed (#127).
 *
 * @param {Iterable<string>|null|undefined} options the event's option set
 * @returns {string[]}
 */
export function attackOptionsOf(options) {
  return [...(options ?? [])].filter((option) => typeof option === "string" && option.startsWith("attack:"));
}

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

/* -------------------------------------------------------------------------- */
/*  Ch. 15 The Effect Entry                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Every key an Effect Entry may author, and what it means.
 *
 * ONE list, for the three things that must agree about it: `entryOf` keeps
 * these keys and no others, `engine/landing.mjs` reads them, and the ability
 * editor offers them (`rules/authoring/phases.mjs`). Each path used to read
 * its own subset, so the same entry meant one thing on a Noble Phantasm and
 * another on a Skill: `uses` was read on the intent path alone, which left Van
 * Gogh's Evade at one charge where *The Yellow House* states two.
 *
 * `type` is the editor's field type: `effect` (an effect id), `number`,
 * `expression` (a number or an `@` expression), `duration` (a ◈ expression),
 * `boolean`, `select` (with `choices`), and `json` for a list or a map the
 * form edits as text.
 */
export const ENTRY_KEYS = Object.freeze({
  id: { type: "effect", means: "The effect applied." },
  magnitude: { type: "expression", means: "How much: a number, an @ expression, or { countTargets }." },
  npMagnitude: { type: "expression", means: "The magnitude against a Noble Phantasm, when it differs." },
  npMagnitudeFactor: { type: "number", means: "The NP magnitude as a factor of the resolved magnitude." },
  perStack: { type: "json", means: "Scale the magnitude by a stack the caster carries." },
  max: { type: "number", means: "A ceiling on an expression magnitude." },
  duration: { type: "duration", means: "How long, as a ◈ expression; the definition's own when absent." },
  permanent: { type: "boolean", means: "No expiry at all, whatever the definition says." },
  unremovable: { type: "boolean", means: "Cannot be removed while it lasts." },
  visibility: { type: "select", choices: ["public", "ownerOnly", "gmOnly"], means: "Who may see the instance." },
  secret: { type: "boolean", means: "Hidden, with its cause, while the inflicter is concealed." },
  chance: { type: "number", means: "The stated chance, in place of the definition's." },
  chancePerPanel: { type: "number", means: "A chance per panel between the source and the target." },
  bands: { type: "json", means: "A chance per ring, index-aligned with the targeting's bands." },
  chanceModifiers: { type: "json", means: "Changes to the chance the ability itself states." },
  bypassChanceModifiers: { type: "boolean", means: "A flat chance no bonus or resistance touches." },
  stages: { type: "number", means: "Stages one application adds." },
  uses: { type: "number", means: "Charges one application gives a counted effect." },
  times: { type: "expression", means: "A count: charges on a counted effect, applications on any other." },
  applications: { type: "number", means: "Separate applications, each rolled on its own." },
  predicate: { type: "json", means: "Apply only to the recipients this matches." },
  ignoresResistanceFrom: { type: "json", means: "Resistances this application is not subject to." },
});

/**
 * One authored Effect Entry, in its one canonical shape.
 *
 * Content writes an entry three ways: bare (`{id, magnitude}`), wrapped
 * (`{effect: {id}, duration}`, every Riding variant) and as a handler's
 * `ApplyEffect` action (`{effect: {id, magnitude}, duration, chance}`). Each
 * path unwrapped its own and each read a different subset, so a magnitude
 * beside a nested `effect:` was dropped on one path and read on another.
 *
 * The inner effect wins over what is written beside it, as `effectSpecsOf`
 * already decided. A RULE may supply what the entry leaves out -- the Skill
 * path's rule-level `magnitude` and `duration` -- and a PHASE's own
 * `ignoresResistanceFrom` is merged in, because *"not affected by Magic
 * Resistance"* covers every effect the phase applies.
 *
 * Only {@link ENTRY_KEYS} survive. A key outside it is one no path reads, and
 * `test/unit/landing-one-door.test.mjs` sweeps the corpus for any.
 *
 * @param {object|null} raw the entry, wrapped or bare
 * @param {object} [where]
 * @param {object|null} [where.phase] the phase it sits in
 * @param {object|null} [where.rule] the rule it sits on, when `raw` is its inner effect
 * @returns {object|null} the entry, or null when it names no effect
 */
export function entryOf(raw, { phase = null, rule = null } = {}) {
  if (!raw || typeof raw !== "object") return null;
  const inner = raw.effect && typeof raw.effect === "object" ? raw.effect : null;
  const id = inner?.id ?? inner?.defId ?? raw.id ?? raw.defId ?? null;
  if (!id) return null;

  /** @type {Record<string, unknown>} */
  const entry = { id };
  for (const key of Object.keys(ENTRY_KEYS)) {
    if (key === "id") continue;
    const value = inner?.[key] ?? raw[key] ?? (rule && rule !== raw ? rule[key] : undefined);
    if (value !== undefined) entry[key] = value;
  }
  // A handler states a staged effect's stage on the effect itself:
  // `effect: { id: curse, stage: 1 }` is one application worth one stage.
  if (entry.stages === undefined && typeof inner?.stage === "number" && inner.stage > 0) entry.stages = inner.stage;

  const ignored = [
    ...(phase?.ignoresResistanceFrom ?? []),
    ...(entry.ignoresResistanceFrom ?? []),
  ];
  if (ignored.length > 0) entry.ignoresResistanceFrom = [...new Set(ignored)];
  else delete entry.ignoresResistanceFrom;
  return entry;
}

/**
 * The chance an entry states against one target.
 *
 * In order: a chance per panel of distance (Anastasia's Ice Block Launcher),
 * a chance per ring (Triton's Conch, index-aligned with the targeting's
 * `bands`), then the flat `chance`. `null` leaves the definition's own
 * `baseChance`. Moved here from the attack path's `declaredChance`, so a Skill
 * reads a ring and a per-panel chance the same way a Noble Phantasm does.
 *
 * @param {object} entry
 * @param {object} [at]
 * @param {number|null} [at.distance] panels between the source and the target
 * @param {number|null} [at.band] which ring of the targeting the target is in
 * @returns {number|null}
 */
export function chanceOf(entry, { distance = null, band = null } = {}) {
  if (entry?.chancePerPanel !== undefined) {
    if (typeof distance !== "number" || !Number.isFinite(distance)) return 0;
    return Math.min(100, Math.max(0, entry.chancePerPanel * distance));
  }
  const ring = entry?.bands?.[band ?? 0]?.chance;
  if (typeof ring === "number") return ring;
  return entry?.chance ?? null;
}

/**
 * How many times an entry's `times` asks for, or null when it states none.
 *
 * Three spellings, each from a sheet:
 *
 * - a number;
 * - `{ perStack: { effect, each } }`, one per `each` of a stack the bearer
 *   holds (Kingprotea's *"X times, where X = the number of Proliferation
 *   Stocks she has"*);
 * - an `@` field of the event that fired the handler, its size taken whole.
 *   Gogh's *"one Atk Up per stage removed"* is `times: "@stageDelta"`, and a
 *   removal's delta is negative. Any string counted 1, so a Crit that took two
 *   stages paid one Atk Up.
 *
 * @param {number|string|object|undefined} raw
 * @param {object} [ctx]
 * @param {Record<string, number>} [ctx.stacks] what the bearer holds, by effect id
 * @param {object|null} [ctx.event] the event's payload
 * @returns {number|null}
 */
export function timesOf(raw, { stacks = {}, event = null } = {}) {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === "number") return Math.floor(raw);
  if (typeof raw === "string") {
    const field = raw.replace("-", "").replace("@", "").trim();
    const value = event?.[field];
    return typeof value === "number" ? Math.abs(Math.trunc(value)) : 0;
  }
  const spec = raw?.perStack ?? null;
  if (!spec?.effect) return 1;
  return Math.floor((stacks[spec.effect] ?? 0) / (spec.each ?? 1));
}
