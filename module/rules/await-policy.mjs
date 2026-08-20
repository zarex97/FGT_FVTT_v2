/**
 * @file What happens when nobody answers.
 * @see docs/27-reaction-protocol.md §27.5
 *
 * Layer 2 (rules). Pure.
 *
 * A player who has closed their browser must not block the table. That is the
 * requirement; the interesting part is what to decide *for* them.
 *
 * §27.5's decision, and the one property every entry below satisfies: **every
 * timeout default is the option that spends nothing.** A player who was
 * disconnected should never come back to find their Luck and Command Spells
 * drained by auto-decisions. `spends: false` is asserted across the whole table
 * by a test rather than reviewed per row, because the tempting mistake — "they
 * would probably have countered" — is individually reasonable every time.
 */

/** Every situation that can time out. */
export const AWAIT_SITUATIONS = Object.freeze([
  "reaction", "luckCheck", "commandSpell", "counter", "facing", "gmRuling",
]);

/**
 * The policy table.
 *
 * `onExpiry` is one of:
 *   - `default`   — take `defaultChoice` and carry on.
 *   - `gmDecides` — escalate; there is no answer that is safe to guess.
 *   - `hold`      — decide nothing and keep waiting. The only outcome that
 *                   cannot be wrong, and therefore the fallback.
 */
const POLICIES = Object.freeze({
  // "none" -- take the hit. It never spends a resource the player might have
  // wanted, which is the whole rule.
  reaction: { defaultChoice: "none", onExpiry: "default", timeoutMs: 60_000, spends: false },
  luckCheck: { defaultChoice: "declined", onExpiry: "default", timeoutMs: 45_000, spends: false },
  commandSpell: { defaultChoice: "declined", onExpiry: "default", timeoutMs: 45_000, spends: false },
  counter: { defaultChoice: "declined", onExpiry: "default", timeoutMs: 45_000, spends: false },
  // Facing the attacker is the defensive assumption and costs nothing.
  facing: { defaultChoice: "attacker", onExpiry: "default", timeoutMs: 45_000, spends: false },
  // A ruling has no safe default by definition.
  gmRuling: { defaultChoice: null, onExpiry: "gmDecides", timeoutMs: 60_000, spends: false },
});

/** Used for a situation this module does not know. */
const HOLD = Object.freeze({ defaultChoice: null, onExpiry: "hold", timeoutMs: 60_000, spends: false });

/**
 * The policy for a situation.
 *
 * @param {string} situation one of {@link AWAIT_SITUATIONS}
 * @param {Record<string, number>} [configured] situation → timeout in **seconds**
 * @returns {{deadline: number|null, defaultChoice: string|null, onExpiry: string, timeoutMs: number, spends: boolean}}
 */
export function policyFor(situation, configured = {}) {
  const base = POLICIES[situation] ?? HOLD;
  const override = configured?.[situation];

  return {
    ...base,
    timeoutMs: Number.isFinite(override) ? override * 1000 : base.timeoutMs,
    deadline: null,
  };
}

/**
 * What to do when the deadline passes.
 *
 * @param {object} policy from {@link policyFor}
 * @returns {{decided: boolean, choice?: string|null, escalate?: boolean}}
 */
export function expiryOutcome(policy) {
  switch (policy?.onExpiry) {
    case "default":
      return { decided: true, choice: policy.defaultChoice };
    case "gmDecides":
      return { decided: false, escalate: true };
    default:
      // Hold. Nothing is decided and nothing is spent; the prompt stays up.
      return { decided: false, escalate: false };
  }
}

/**
 * Milliseconds left, floored at zero.
 *
 * A negative remaining renders as "-0:03 left", which reads as a bug in the
 * countdown rather than as an expired prompt.
 *
 * @param {{deadline: number}} policy
 * @param {number} now
 * @returns {number}
 */
export function remainingMs(policy, now) {
  return Math.max(0, (policy?.deadline ?? 0) - now);
}

/**
 * The GM's "waiting for X (0:23)" indicator.
 *
 * @param {number} ms
 * @returns {string}
 */
export function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
}
