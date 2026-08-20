/**
 * @file Deadlines on reaction prompts, and what happens when they pass.
 * @see docs/27-reaction-protocol.md §27.5
 *
 * Layer 3. `rules/await-policy.mjs` decides *what* the default is; this runs
 * the clock and applies it.
 *
 * A player who has closed their browser must not block the table — but the
 * decision made for them must never cost them anything. §27.5's rule, and the
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
import { pendingPrompt } from "./combat-process.mjs";

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
  const state = message?.getFlag("fgt", "process");
  const prompt = state ? pendingPrompt(state) : null;
  if (!prompt) return null;

  const configured = {
    reaction: safeSetting("reactionTimeout", 60),
    luckCheck: safeSetting("interruptTimeout", 45),
    commandSpell: safeSetting("interruptTimeout", 45),
    counter: safeSetting("interruptTimeout", 45),
  };

  const policy = policyFor(prompt.kind, configured);
  const startedAt = message.getFlag("fgt", "promptStartedAt") ?? message.timestamp;

  return { ...policy, deadline: startedAt + policy.timeoutMs, prompt };
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
    // §27.5's "decide for them" button. GM-only, and shown from the start
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

  // Stamped once, on the first render that saw the prompt, so re-rendering the
  // card does not restart the clock.
  if (!message.getFlag("fgt", "promptStartedAt")) {
    message.setFlag("fgt", "promptStartedAt", Date.now());
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

  const { advanceAttack } = await import("./attack.mjs");
  await advanceAttack({
    messageId: message.id,
    event: outcome.choice,
    respondingUnitId: policy.prompt.unitId,
    // The card and the log both say this was a timeout, not a choice.
    timedOut: true,
  });
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
 * A setting this world may never have registered.
 * @param {string} key
 * @param {number} fallback
 * @returns {number}
 */
function safeSetting(key, fallback) {
  try {
    return game.settings.get("fgt", key) ?? fallback;
  } catch {
    return fallback;
  }
}
