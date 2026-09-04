/**
 * @file The Combat Process as an explicit state machine.
 * @see docs/12-combat-process.md
 *
 * Layer 3 (orchestration), but **pure**: `advance()` is a reducer over a
 * serializable state. It never writes and never awaits — the caller drives it,
 * prompts the humans, and feeds the answers back.
 *
 * That shape is not incidental. The reaction ladder spans up to five prompts
 * across two clients, so the state has to survive being serialized into a chat
 * message flag between rungs (Ch. 27). A reducer over plain data is the only
 * version of this that can be resumed after a reconnect.
 *
 * The ladder is symmetric and two rungs deep on each side, terminating in 2.3:
 *
 *   evade succeeds → 2.1 AU lucky hit → 2.2 DU contest → 2.3
 *   evade fails    → 2.4 DU lucky evasion → 2.5 AU contest → 2.3
 */

import { append as appendRoll } from "../rules/roll-log.mjs";
import { mayCounterAgain, MAX_COUNTER_DEPTH } from "../rules/counter.mjs";

/** Every state the process can occupy. */
export const STATES = Object.freeze([
  "declare", "react", "evadeRoll",
  "s21_luckyHit", "s22_duContest", "s23_acceptOrEscape",
  "s24_luckyEvasion", "s25_auContest",
  "damage", "noDamage", "injury", "facing", "counter", "done",
]);

/**
 * The transition table, transcribed from Ch. 12 §12.3.
 *
 * Every Luck Check rung carries a `declined` edge, because Luck is a finite
 * resource spent 1 per check whether or not it succeeds, and a player may
 * rationally refuse. Declining is **not** the same as failing on the attacker's
 * rungs — see the note below the table.
 */
export const TRANSITIONS = Object.freeze({
  "react:nothing": "damage",
  "react:block": "damage", // Block reduces damage at stage 14; it does not avoid it
  "react:evade": "evadeRoll",

  "evadeRoll:success": "s21_luckyHit",
  "evadeRoll:fail": "s24_luckyEvasion",

  "s21_luckyHit:fail": "noDamage",
  "s21_luckyHit:success": "s22_duContest",
  "s21_luckyHit:declined": "noDamage",

  "s22_duContest:success": "noDamage",
  "s22_duContest:fail": "s23_acceptOrEscape",
  "s22_duContest:declined": "s23_acceptOrEscape",

  "s24_luckyEvasion:success": "s25_auContest",
  "s24_luckyEvasion:fail": "s23_acceptOrEscape",
  "s24_luckyEvasion:declined": "s23_acceptOrEscape",

  "s25_auContest:success": "s23_acceptOrEscape",
  "s25_auContest:fail": "noDamage",
  "s25_auContest:declined": "noDamage",

  "s23_acceptOrEscape:accept": "damage",
  "s23_acceptOrEscape:cs": "noDamage",

  "damage:done": "injury",
  "injury:done": "facing",
  "noDamage:done": "facing",
  "facing:done": "counter",
  "counter:done": "done",
  // The counter is a choice, so it has a taken branch and a declined one. Both
  // finish the process: "Counters cannot be Countered again", so there is
  // nothing after this rung either way.
  "counter:counter": "done",
  "counter:declined": "done",
  "declare:done": "react",
});

/** Which side answers each prompting state, and what it costs. */
export const PROMPTS = Object.freeze({
  react: { side: "defender", kind: "reaction", options: ["nothing", "block", "evade"] },
  s21_luckyHit: { side: "attacker", kind: "luckCheck", check: "luckyHit", cost: 1 },
  s22_duContest: { side: "defender", kind: "luckCheck", check: "counterContest", cost: 1 },
  s23_acceptOrEscape: { side: "defender", kind: "acceptOrEscape", options: ["accept", "cs"] },
  s24_luckyEvasion: { side: "defender", kind: "luckCheck", check: "luckyEvasion", cost: 1 },
  s25_auContest: { side: "attacker", kind: "luckCheck", check: "counterContest", cost: 1 },
  counter: { side: "defender", kind: "counter", options: ["counter", "declined"] },
});

/**
 * @typedef {object} ProcessState
 * @property {string} state
 * @property {string} attackerId
 * @property {string} defenderId
 * @property {object} attack
 * @property {string|null} reaction what the defender chose at step 2
 * @property {boolean} evaded
 * @property {Array<{state: string, event: string, detail?: object}>} history
 * @property {boolean} isAoE
 */

/**
 * Start a Combat Process.
 * @param {object} args
 * @returns {ProcessState}
 */
export function begin({
  attackerId, defenderId, attack, isAoE = false, groupId = null,
  isCounter = false, requiredTargetId = null, counterDepth = 0,
  counterRedirectId = null,
}) {
  return {
    state: "declare",
    attackerId,
    defenderId,
    attack,
    reaction: null,
    evaded: false,
    isAoE,
    groupId,
    // "Counters cannot be Countered again" — carried on the state because the
    // check happens inside a process that has no other way to know what it is.
    isCounter,
    // WHO this counter was aimed at. Implicit in `defenderId` while a counter
    // was 1v1; an area counter has several defenders and only one of them was
    // the point, and `rules/counter.mjs#mayCounterAgain` has to tell them apart
    // to let a bystander answer without reopening the chain.
    requiredTargetId,
    // 0 for a declaration, +1 per counter. The chain terminates on COST, not on
    // this; it is a backstop against a content bug that authors a free area
    // attack (`MAX_COUNTER_DEPTH`).
    counterDepth,
    // §12.8's Master redirect: the unit a Counter off THIS process must hit
    // instead of its attacker, because the attacker is a Master with a Servant
    // within two panels. Decided by the orchestrator at the counter rung, which
    // can see positions; `null` everywhere else.
    counterRedirectId,
    history: [],
    // Every roll this Process made (§14.8). On the state rather than beside it
    // because the state is what crosses the socket and what the card is built
    // from -- a log kept anywhere else would not survive either trip.
    rolls: [],
  };
}

/**
 * One Combat Process per defender an attack caught (§12.10).
 *
 * `resolveAttack` used to take `targets.units[0]` and drop the rest, keeping
 * them only long enough to set the `isAoE` flag — so a Noble Phantasm over
 * seven units damaged one of them, and nothing anywhere said so. The card
 * showed a correct calculation against a correct target and the other six
 * silently disappeared.
 *
 * Each defender gets its own ladder because each reacts independently: they
 * are prompted in parallel, evade separately, and may be contested separately.
 * The states are plain values, so one advancing cannot disturb another.
 *
 * `groupId` is what remembers they were one attack. Two things need it: the
 * attacker's budget is spent once for the group rather than once per defender,
 * and the counter step resolves across the whole fan-out *"sequentially in turn
 * order"* rather than per-card.
 *
 * A single caught unit is **not** an AoE resolution — facing still applies, and
 * a card that claimed a fan-out over one defender would be a lie.
 *
 * @param {object} args
 * @param {string} args.attackerId
 * @param {string[]} args.targetIds defenders, in target order
 * @param {object} args.attack
 * @param {string} [args.groupId] supplied only to make a fan-out reproducible
 * @returns {ProcessState[]}
 */
export function beginFanOut({
  attackerId, targetIds, attack, groupId = null, isAoE = null,
  isCounter = false, requiredTargetId = null, counterDepth = 0,
  counterRedirectId = null,
}) {
  const ids = targetIds ?? [];
  if (ids.length === 0) return [];

  const group = groupId ?? `fan.${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
  // More than one PROCESS is not the same as more than one defender. EMIYA's
  // Overedge is "2 Normal Attacks in a row" against one Unit -- two processes
  // in one Combat Phase -- and treating that as an area attack would emit
  // `attack:isAoE` and skip the defender's facing change. The caller decides
  // when it knows better; the process count remains the default.
  const area = isAoE ?? ids.length > 1;
  return ids.map((defenderId) =>
    begin({
      attackerId, defenderId, attack, isAoE: area, groupId: group,
      // Carried to EVERY process in the fan-out. This dropped `isCounter`
      // entirely, which was harmless only while a counter was 1v1 and never
      // came through here -- the moment one fans out, a bystander's process
      // that forgot the flag lets the counter be countered.
      isCounter, requiredTargetId, counterDepth, counterRedirectId,
    }));
}

/**
 * Advance the machine by one event.
 *
 * @param {ProcessState} s
 * @param {string} event e.g. `"evade"`, `"success"`, `"declined"`, `"done"`
 * @param {object} [detail] recorded in the history for the audit trail
 * @returns {ProcessState} a new state; `s` is not mutated
 * @throws {RangeError} on an illegal transition — a bug, not a player action
 */
export function advance(s, event, detail = undefined) {
  // A reaction ability answers the same rung as Block and Evade, and resolves
  // to the same next state as declining: using Trofa is not itself an Evade
  // roll -- the ability's own AutoSucceed decides that a rung later.
  const normalized = String(event).startsWith("ability:") ? "nothing" : event;

  // A reaction this Process has already refused. The card filters the buttons,
  // but the card is a client and the transition is the boundary: a stale card,
  // a macro, or a second player's window must not be able to declare an Evade
  // that Presence Concealment or a Command Spell retarget already took away.
  if (s.state === "react" && (s.forbiddenReactions ?? []).includes(normalized)) {
    throw new RangeError(
      `FGT | "${normalized}" is not available against this attack.`,
    );
  }

  const key = `${s.state}:${normalized}`;
  const next = TRANSITIONS[key];
  if (!next) {
    throw new RangeError(
      `FGT | Illegal Combat Process transition "${key}". ` +
        `Legal events from "${s.state}": ${legalEvents(s.state).join(", ") || "(none)"}.`,
    );
  }

  const out = {
    ...s,
    state: next,
    history: [...s.history, { state: s.state, event, ...(detail ? { detail } : {}) }],
  };
  // A detail carrying a roll record files it. Done here rather than at each
  // roll site so no check can produce a number the log never hears about.
  if (detail?.rollRecord) out.rolls = appendRoll(s.rolls ?? [], detail.rollRecord);
  if (s.state === "react") out.reaction = event;
  if (s.state === "evadeRoll") out.evaded = event === "success";
  return out;
}

/**
 * Which events are legal from a state.
 * @param {string} state
 * @returns {string[]}
 */
export function legalEvents(state) {
  return Object.keys(TRANSITIONS)
    .filter((k) => k.startsWith(`${state}:`))
    .map((k) => k.slice(state.length + 1));
}

/**
 * Who, if anyone, must answer right now.
 * @param {ProcessState} s
 * @returns {{side: string, kind: string, unitId: string}|null}
 */
export function pendingPrompt(s) {
  const p = PROMPTS[s.state];
  if (!p) return null;
  // The counter rung is the one prompt that is conditional. Offering it to a
  // defender who cannot counter would stop the ladder to ask a question with
  // one answer, so eligibility is decided first (by the orchestrator, which can
  // see positions and ranges) and recorded on the state.
  if (s.state === "counter" && !s.counterAvailable) return null;

  const unitId = p.side === "attacker" ? s.attackerId : s.defenderId;
  // Reaction abilities are offered BESIDE Block and Evade (§15.3). Medea's
  // Trofa is "used when Attacked" and there is no other moment it can be
  // reached: by the time it matters its owner is inside somebody else's
  // Process. The orchestrator records what is usable, because deciding it
  // needs the documents and this file is pure.
  const extra = s.reactionAbilities?.[unitId] ?? [];
  const options = p.options ? [...p.options, ...extra.map((a2) => `ability:${a2.id}`)] : p.options;

  return { ...p, options, unitId, abilities: extra };
}

/**
 * Did the attack connect?
 *
 * Read from the *history*, not from the final state, because by the time the
 * process reaches `facing` both the hit and the miss paths have converged.
 *
 * @param {ProcessState} s
 * @returns {boolean}
 */
export function didHit(s) {
  return s.state === "damage" || s.history.some((h) => h.state === "damage");
}

/** @param {ProcessState} s @returns {boolean} */
export function isComplete(s) {
  return s.state === "done";
}

/**
 * Can the defender counter-attack?
 *
 * > *"If the DU evaded OR survived, and the AU is within the DU's range."*
 *
 * `Accel` on the attacker forbids any reaction, which includes the counter.
 *
 * @param {ProcessState} s
 * @param {object} args
 * @param {boolean} args.defenderAlive
 * @param {boolean} args.attackerInRange
 * @param {boolean} [args.attackerHasAccel]
 * @param {boolean} [args.defenderCanAct]
 * @returns {boolean}
 */
export function canCounter(s, {
  defenderAlive, attackerInRange, attackerHasAccel = false, defenderCanAct = true,
  defenderHasBerserk = false, defenderHasFragarach = false, attackerConcealedAndFaster = false,
  chainMode = "collateral",
}) {
  // "Counters cannot be Countered again." First, because without it two
  // Servants in range of each other counter one another until something gives
  // out — and it is the one clause that is a safety property rather than a
  // rules detail.
  //
  // It used to be a flat refusal on `isCounter`. It is now precise about WHICH
  // unit is refused: the one the counter was AIMED at, always, and a bystander
  // an area counter merely caught only when the GM has chosen `strict`.
  if (!mayCounterAgain(s, s.defenderId, chainMode)) return false;
  // The backstop. Cost is what actually terminates the chain -- reaching a
  // bystander needs an area ability and an ability pays its own price -- so
  // this only catches a content bug that authors a free one.
  if ((s.counterDepth ?? 0) >= MAX_COUNTER_DEPTH) return false;

  if (attackerHasAccel) return false;
  if (!defenderCanAct) return false;
  if (!attackerInRange) return false;

  // Berserk fixes the unit's target selection, so it cannot choose to counter.
  if (defenderHasBerserk) return false;
  // Mannanán trades the normal counter for an automatic Fragarach counter
  // (Ch. 24 §24.8): "cannot perform a normal Counter".
  if (defenderHasFragarach) return false;
  // Presence Concealment: a defender slower than a concealed attacker never
  // located it to counter.
  if (attackerConcealedAndFaster) return false;

  return s.evaded || defenderAlive;
}

/**
 * The counter sub-processes: an Attack the other way round (§12.8).
 *
 * > *"the DU may use the 'Counter' Action and declare an Attack on the AU.
 * > Steps 1 and 4 of Combat are repeated, but with the roles reversed."*
 *
 * A **fresh** set of processes, not a mutation of the original: the counter
 * runs the full ladder (Ch. 41's ruling on the "Steps 1 and 4" typo — a counter
 * that cannot be evaded and deals no damage is nonsense, and Instant Counter's
 * "skip straight to Step 3" is only special if the normal one does not skip),
 * so it needs its own history and its own state.
 *
 * **An array, and an area is allowed.** The old signature returned one state
 * and said "a counter is one unit hitting one unit" — true only because the
 * `attack` parameter it already took was never passed by anybody, so every
 * counter was a Normal Attack. A counter declared with a Noble Phantasm has
 * that Noble Phantasm's shape.
 *
 * **The parent's `groupId` is kept.** §12.1: a Combat Phase is the declaration
 * plus any counters. `engine/attack.mjs#fireCombatPhaseEnd` counts unfinished
 * siblings by `groupId` and says so in as many words — *"a counter can add a
 * process to the group after the first one finished"* — so giving the counter
 * its own group would end the phase while the counter is still resolving.
 *
 * It carries no budget cost: `resolveAttack`'s spend sits above the shared
 * declaration path this leads to, so a counter does not skip paying for a turn,
 * it never reaches the payment.
 *
 * @param {ProcessState} s the process being countered
 * @param {object} [choice]
 * @param {object} [choice.attack] what to counter with; a Normal Attack by default
 * @param {string[]} [choice.targetIds] every unit the ability caught; the
 *   original attacker MUST be among them (`rules/counter.mjs`)
 * @param {boolean|null} [choice.isAoE]
 * @returns {ProcessState[]}
 */
export function beginCounter(s, {
  attack = { abilityId: null, kind: "normal" }, targetIds = null, isAoE = null,
} = {}) {
  const ids = targetIds?.length ? targetIds : [s.attackerId];
  return beginFanOut({
    attackerId: s.defenderId,
    targetIds: ids,
    attack,
    groupId: s.groupId,
    isAoE: isAoE ?? ids.length > 1,
    isCounter: true,
    requiredTargetId: s.attackerId,
    counterDepth: (s.counterDepth ?? 0) + 1,
  });
}

/**
 * Whether step 5 applies. AoE attacks do not turn the defender.
 * @param {ProcessState} s
 * @returns {boolean}
 */
export function shouldUpdateFacing(s) {
  return !s.isAoE;
}

/**
 * Would the ladder collapse to a single prompt?
 *
 * Five sequential prompts across two clients is a lot of latency for one
 * attack. When the defender has no Luck to spend, no Command Spells, and no
 * automatic evasion, every rung past step 2 has exactly one possible outcome —
 * so the whole ladder can be resolved in one round trip.
 *
 * @param {object} defender
 * @returns {boolean}
 * @see docs/12-combat-process.md §12.3, the RISK note
 */
export function laddersCollapse(defender) {
  return (
    (defender.luck?.value ?? 0) < 1 &&
    (defender.commandSpells ?? 0) < 1 &&
    !(defender.effects ?? []).includes("dodge") &&
    !(defender.effects ?? []).includes("invuln")
  );
}

/**
 * Serialize for storage in a chat-message flag between rungs.
 * @param {ProcessState} s
 * @returns {string}
 */
export function serialize(s) {
  return JSON.stringify(s);
}

/**
 * @param {string} json
 * @returns {ProcessState}
 */
export function deserialize(json) {
  const s = JSON.parse(json);
  if (!STATES.includes(s.state)) {
    throw new RangeError(`FGT | Cannot resume Combat Process: unknown state "${s.state}".`);
  }
  return s;
}

/* -------------------------------------------------------------------------- */
/*  Interrupts (Ch. 17 §17.4, Ch. 27 §27.9)                                   */
/* -------------------------------------------------------------------------- */

/**
 * Which Command Spell window a Process state opens.
 *
 * Only these states are interruptible: *"Command Spells can be used at any time
 * at all, even if it were to interrupt an ongoing process"* is about **timing**,
 * not about being able to rewrite a resolution that has already finished.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const INTERRUPT_WINDOWS = Object.freeze({
  declare: "beforeAttack",
  react: "react",
  s23_acceptOrEscape: "s23_acceptOrEscape",
  damage: "damage",
  injury: "beforeDamage",
});

/**
 * The window this Process is currently offering, or `null`.
 * @param {ProcessState} s
 * @returns {string|null}
 */
export function windowFor(s) {
  return INTERRUPT_WINDOWS[s?.state] ?? null;
}

/**
 * Can this Process be interrupted right now?
 * @param {ProcessState} s
 * @returns {boolean}
 */
export function interruptible(s) {
  return windowFor(s) !== null;
}

/**
 * The accumulated Command Spell damage factor.
 *
 * **Multiplicative**, and that is not a stylistic choice: Halve Noble Phantasm
 * (×0.5) followed by Noble Phantasm Max (×2) must come back to ×1 in either
 * order. Summing the deltas would give −50% +100% = +50%, which is wrong both
 * ways round.
 *
 * @param {ProcessState} s
 * @returns {number}
 */
export function damageFactorOf(s) {
  return (s?.damageFactors ?? []).reduce((a, b) => a * b, 1);
}

/**
 * Apply a Command Spell's effect to a Process already in flight.
 *
 * A **GM-side mutation** (§27.9): it changes a Process another client is
 * participating in, which is why the GM arbitrates the ladder even though the
 * individual rungs are answered by their owners.
 *
 * Every interrupt is recorded on the state, applied or not. A Command Spell is
 * the most expensive thing a Master can spend and the most likely to be argued
 * about afterwards, so "it did nothing and said nothing" is the one outcome
 * that must be impossible.
 *
 * @param {ProcessState} s
 * @param {object} interrupt `{kind, ...}` from `rules/command-spells.effectsOf`
 * @returns {ProcessState} a new state; `s` is not mutated
 */
export function applyInterrupt(s, interrupt) {
  // A finished Process has nothing left to rewrite.
  if (!interruptible(s)) return s;

  const record = {
    kind: interrupt.kind,
    command: interrupt.command ?? null,
    masterId: interrupt.masterId ?? null,
    atState: s.state,
    applied: true,
  };
  const base = { ...s, interrupts: [...(s.interrupts ?? []), record] };

  switch (interrupt.kind) {
    case "escape":
      // The pair leaves; the attack resolves against nobody.
      return { ...base, state: "noDamage" };

    case "modifyDamage":
      return { ...base, damageFactors: [...(s.damageFactors ?? []), interrupt.factor ?? 1] };

    case "retarget":
      // A new defender who has not reacted yet — and who cannot use the
      // reactions it never had the chance to declare (§27.9).
      return {
        ...base,
        defenderId: interrupt.newTargetId,
        state: "react",
        reaction: null,
        evaded: false,
        forbiddenReactions: ["evade", "block"],
      };

    case "survive":
      // Decided at defeat, not here. Recorded so `resolveDefeat` can honour it.
      return { ...base, survive: interrupt.fractionOfMax ?? 0.05 };

    case "overrideValidation":
      return { ...base, overrides: [...(s.overrides ?? []), interrupt.reason] };

    default:
      // Recorded as NOT applied, so an effect this machine does not understand
      // is visible in the state it failed to change. Replaces the optimistic
      // record rather than appending beside it — one interrupt, one entry.
      return { ...s, interrupts: [...(s.interrupts ?? []), { ...record, applied: false }] };
  }
}
