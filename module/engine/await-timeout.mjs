/**
 * @file Deadlines on reaction prompts, and what happens when they pass.
 * @see docs/23-reactions.md
 *
 * Layer 3. `rules/await-policy.mjs` decides *what* the default is; this runs
 * the clock and applies it.
 *
 * A player who has closed their browser must not block the table — but the
 * decision made for them must never cost them anything. Ch. 23's rule, and the
 * one property the policy table enforces across every situation: **the timeout
 * default is always the option that spends nothing.** A player who was
 * disconnected should not come back to find their Luck and Command Spells
 * drained by auto-decisions.
 *
 * The timer runs on the **GM client only**. Every client rendering a card would
 * otherwise start its own, and the first to fire would advance the process
 * while the others were still counting — which is a race that produces two
 * answers to one prompt.
 */

import { policyFor, expiryOutcome, formatCountdown, remainingMs } from "../rules/await-policy.mjs";
import { pendingPrompt, deserialize, rungOptions } from "./combat-process.mjs";
import { warRule } from "./war.mjs";

/** messageId → timer handle. */
const timers = new Map();

/**
 * The policy for a Process's current prompt, with its deadline resolved.
 *
 * The deadline is stored **on the message**, not computed per client: two
 * clients that computed it from their own clocks would disagree by the drift
 * between them, and the countdown a player sees would not be the one the GM is
 * acting on.
 *
 * @param {object} message a chat message carrying a Process
 * @returns {object|null}
 */
export function policyForMessage(message) {
  const state = readProcessFlag(message?.getFlag("fgt", "process"));
  const prompt = state ? pendingPrompt(state) : null;
  if (!prompt) return null;

  const configured = {
    reaction: warRule("reactionTimeout"),
    luckCheck: warRule("interruptTimeout"),
    commandSpell: warRule("interruptTimeout"),
    counter: warRule("interruptTimeout"),
  };

  const policy = policyFor(prompt.kind, configured);
  // The clock belongs to THIS prompt. It was one stamp per card, set at its
  // first prompt and never moved, so every later prompt on the card ran on the
  // reaction's clock: a Counter offered after a damage step's Command Spell
  // windows had expired before it was drawn, and was declined unseen (#256,
  // live). A prompt not yet stamped has just been reached.
  const key = promptKey(state, prompt);
  const clock = message.getFlag("fgt", "promptClock");
  const started = clock?.key === key;
  const startedAt = started ? clock.at : now();

  return { ...policy, deadline: startedAt + policy.timeoutMs, prompt, key, started };
}

/**
 * Which prompt a clock was started for: its kind, its rung, how far the ladder
 * had got, and whom it asks. Two prompts on one card never share it.
 *
 * @param {object} state
 * @param {object} prompt
 * @returns {string}
 */
export function promptKey(state, prompt) {
  return `${prompt.kind}:${state.state}:${state.history?.length ?? 0}:${prompt.unitId ?? ""}`;
}

/** @returns {number} */
function now() {
  return Date.now();
}

/**
 * How the card renders the wait.
 *
 * @param {object} message
 * @param {number} [now]
 * @returns {{label: string, expired: boolean, canDecideForThem: boolean}|null}
 */
export function countdownFor(message, now = Date.now()) {
  const policy = policyForMessage(message);
  if (!policy) return null;

  const left = remainingMs(policy, now);
  return {
    label: formatCountdown(left),
    expired: left === 0,
    // Ch. 23's "decide for them" button. GM-only, and shown from the start
    // rather than after the timeout: a GM who can see the table knows before
    // the clock does that somebody has left.
    canDecideForThem: game.user.isGM,
  };
}

/**
 * Start the clock for a message's prompt. GM only.
 *
 * @param {object} message
 */
export function armTimeout(message) {
  if (!game.user.isGM) return;

  const policy = policyForMessage(message);
  if (!policy) {
    disarmTimeout(message.id);
    return;
  }
  // `hold` decides nothing by design, so there is nothing to schedule.
  if (policy.onExpiry === "hold") return;
  if (timers.has(message.id)) return;

  // Stamped once per prompt, on the first render that saw it, so re-rendering
  // the card does not restart the clock and the next prompt starts its own.
  if (!policy.started) {
    message.setFlag("fgt", "promptClock", { key: policy.key, at: policy.deadline - policy.timeoutMs });
  }

  const handle = setTimeout(() => {
    timers.delete(message.id);
    void applyExpiry(message);
  }, Math.max(0, remainingMs(policy, Date.now())));

  timers.set(message.id, handle);
}

/** @param {string} messageId */
export function disarmTimeout(messageId) {
  const handle = timers.get(messageId);
  if (handle === undefined) return;
  clearTimeout(handle);
  timers.delete(messageId);
}

/**
 * Take the default choice on behalf of an absent player.
 *
 * Logged as a timeout rather than as a decision, because the record should not
 * show a player declining something they never saw.
 *
 * @param {object} message
 */
export async function applyExpiry(message) {
  const policy = policyForMessage(message);
  if (!policy) return;

  const outcome = expiryOutcome(policy);
  if (!outcome.decided) {
    if (outcome.escalate) {
      ui.notifications.warn(game.i18n.localize("FGT.Await.NeedsGM"));
    }
    return;
  }

  // A rung the Process refuses is no default: a DU that must Block (Bab-ilu's
  // second Attack, #232) cannot be timed into taking the hit. The first rung it
  // may take stands in, in the card's own order.
  const state = readProcessFlag(message?.getFlag("fgt", "process"));
  const choice = policy.prompt?.kind === "reaction" && state
    ? timeoutReaction(state, outcome.choice)
    : outcome.choice;

  const { advanceAttack } = await import("./attack.mjs");
  await advanceAttack({
    messageId: message.id,
    event: choice,
    respondingUnitId: policy.prompt.unitId,
    // The card and the log both say this was a timeout, not a choice.
    timedOut: true,
  });
}

/**
 * The rung a timed-out reaction takes: the policy's choice when the rung still
 * has it, else the first rung left, in the card's own order. Asked of
 * `rungOptions`, which the card asks too (#244).
 *
 * @param {object} state the Process
 * @param {string} choice the policy's default
 * @returns {string}
 */
export function timeoutReaction(state, choice) {
  const left = rungOptions(state);
  if (left.includes(choice)) return choice;
  // A standing rung first; when the attack has refused all three, the rung is
  // answered only by an ability, and the first one is the one move the
  // transition takes (#244 review: the policy's refused rung threw, and the
  // Process waited for ever).
  return left.find((o) => !o.startsWith("ability:")) ?? left[0] ?? choice;
}

/**
 * Attach the clock to every Process card. Called from `ready`.
 */
export function attachAwaitTimeouts() {
  Hooks.on("renderChatMessageHTML", (message) => {
    if (!message.getFlag("fgt", "process")) return;
    armTimeout(message);
  });

  Hooks.on("updateChatMessage", (message) => {
    if (!message.getFlag("fgt", "process")) return;
    // The prompt moved on, so the old deadline is meaningless. Re-armed rather
    // than left running: a stale timer would answer the *next* prompt with the
    // previous one's default.
    disarmTimeout(message.id);
    armTimeout(message);
  });

  Hooks.on("deleteChatMessage", (message) => disarmTimeout(message.id));
}

/**
 * The Process a message carries.
 *
 * The flag is a **JSON string** (`combat-process.mjs#serialize`), so handing it
 * to `pendingPrompt` raw reads `PROMPTS[undefined]` and returns `null` for every
 * card: no prompt ever got a deadline (#166). An already-parsed object is
 * accepted too. A flag that does not parse reads as "no prompt", which fails
 * closed: no timer, so nothing is auto-answered on the strength of a state that
 * could not be read.
 *
 * @param {string|object|null|undefined} raw
 * @returns {object|null}
 */
function readProcessFlag(raw) {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try {
    return deserialize(raw);
  } catch {
    return null;
  }
}
