/**
 * @file The ◈ operator: `TickExpr` parsing and resolution to integer turn counts.
 * @see docs/04-time-model.md
 *
 * Layer 1 (domain). Pure.
 *
 * ◈ is "number of Turns in a Round" — 3 for the Great Holy Grail War, 8 for the
 * Holy Grail War, 15 for post-True-Masters Snowfield. Content is authored once
 * as `"1◈+⅔◈"` and resolves correctly in every variant (success criterion SC-3).
 *
 * Fractions **always round down**, and never to nothing: a span that floors to
 * 0 is 1 Turn. Ruled 2026-11-01 (#362): the one published exception, ½◈ at 3
 * Turns a Round being 2, is gone, and its table with it; ½◈ at 3 is 1. A sum of
 * spans is converted once, through the same rule ({@link roundsToTicks}).
 */

import { INFINITE } from "./enums.mjs";

/** Unicode vulgar fractions the authoring format accepts. */
const VULGAR = Object.freeze({
  "½": [1, 2], "⅓": [1, 3], "⅔": [2, 3],
  "¼": [1, 4], "¾": [3, 4], "⅕": [1, 5], "⅖": [2, 5], "⅗": [3, 5], "⅘": [4, 5],
  "⅙": [1, 6], "⅚": [5, 6], "⅛": [1, 8], "⅜": [3, 8], "⅝": [5, 8], "⅞": [7, 8],
});

/**
 * @typedef {object} Fraction
 * @property {number} num
 * @property {number} den
 */

/**
 * @typedef {{kind: "ticks", n: number}
 *         | {kind: "rounds", whole: number, frac: Fraction|null, sign: 1|-1}
 *         | {kind: "thisTurn"}
 *         | {kind: "permanent"}
 *         | {kind: "untilEvent", event: string}
 *         | {kind: "uses", n: number}} TickExpr
 */

/**
 * Resolve a fraction of a round to whole turns.
 *
 * @param {number} num
 * @param {number} den
 * @param {number} turnsPerRound
 * @returns {number}
 */
export function fractionTicks(num, den, turnsPerRound) {
  return roundsToTicks(num / den, turnsPerRound);
}

/**
 * A span of Rounds, whole or fractional or a sum of several, as whole Turns.
 *
 * Rounded DOWN, once, and never to nothing (#21): `1/3◈` at `turnsPerRound: 2`
 * floors to zero, which is not a shorter duration, it is the duration failing
 * to apply at all, so it is 1. Ruled 2026-11-01 (#362): a sum of spans (five
 * criteria's ½◈ each, four Warriors' ⅔◈ each) is added up first and converted
 * here once, the sign kept apart so a cut rounds the way a growth does.
 *
 * @param {number} rounds a signed number of Rounds
 * @param {number} turnsPerRound
 * @returns {number} whole Turns, signed
 */
export function roundsToTicks(rounds, turnsPerRound) {
  if (!Number.isFinite(rounds) || rounds === 0) return 0;
  const sign = rounds < 0 ? -1 : 1;
  // A hair over, so `3 × ⅓ × 3` lands on 3 and not on 2.999….
  const floored = Math.floor(Math.abs(rounds) * turnsPerRound + 1e-9);
  return sign * Math.max(1, floored);
}

/**
 * Parse a duration or cooldown expression.
 *
 * Accepted forms (the authoring format matches the source text character for
 * character wherever possible):
 *
 * ```
 *   "1◈"  "3◈"  "⅓◈"  "1◈+⅔◈"  "4◈-⅓◈"  "1/3◈"  "1+2/3◈"
 *   "2 turns"  "1 turn"  "this turn"  "permanent"
 *   "3 times"  "1 time"          → a use count, not a duration
 *   "until zeroSailEnds"         → removed by an event
 * ```
 *
 * Strict: anything else throws, and the content build reports the document and
 * field path.
 *
 * @param {string|number|null|undefined} input
 * @returns {TickExpr|null} `null` for empty input
 * @throws {RangeError} on malformed input
 */
export function parseTick(input) {
  if (input === null || input === undefined) return null;

  // A bare number means literal turns.
  if (typeof input === "number") {
    if (!Number.isInteger(input) || input < 0) {
      throw new RangeError(`FGT | Tick count must be a non-negative integer, got ${input}.`);
    }
    return { kind: "ticks", n: input };
  }

  const raw = String(input).trim();
  if (raw === "") return null;
  const s = raw.toLowerCase();

  if (s === "permanent" || s === "infinite") return { kind: "permanent" };
  if (s === "this turn" || s === "thisturn") return { kind: "thisTurn" };

  // The event keeps its case: it is an event name, matched exactly when it fires.
  const until = /^until\s+(.+)$/i.exec(raw);
  if (until) return { kind: "untilEvent", event: until[1].trim() };

  const uses = /^(\d+)\s*times?$/.exec(s);
  if (uses) return { kind: "uses", n: Number(uses[1]) };

  const turns = /^(\d+)\s*turns?$/.exec(s);
  if (turns) return { kind: "ticks", n: Number(turns[1]) };

  // ◈ expressions. Everything before the last ◈ is the payload.
  if (raw.includes("◈")) return parseRounds(raw);

  throw new RangeError(
    `FGT | Cannot parse duration "${raw}". Expected a ◈ expression, "N turns", "this turn", ` +
      `"permanent", "N times", or "until <event>".`,
  );
}

/**
 * Parse the `a◈ ± b/c◈` family.
 * @param {string} raw
 * @returns {TickExpr}
 */
function parseRounds(raw) {
  // Normalise: drop every ◈, keep the arithmetic. "1◈+⅔◈" → "1+⅔"
  const body = raw.replace(/◈/g, "").replace(/\s+/g, "");
  if (body === "") {
    throw new RangeError(`FGT | Cannot parse ◈ expression "${raw}": no quantity given.`);
  }
  const m = /^([^+-]*)(?:([+-])(.+))?$/.exec(body);
  if (!m) throw new RangeError(`FGT | Cannot parse ◈ expression "${raw}".`);

  const [, headRaw, signRaw, tailRaw] = m;
  const sign = signRaw === "-" ? -1 : 1;

  const head = parseTerm(headRaw, raw);
  const tail = tailRaw !== undefined ? parseTerm(tailRaw, raw) : null;

  // "⅓◈" alone: whole 0, fraction 1/3.
  if (tail === null) {
    if (head.frac && head.whole === 0) return { kind: "rounds", whole: 0, frac: head.frac, sign: 1 };
    if (head.frac) return { kind: "rounds", whole: head.whole, frac: head.frac, sign: 1 };
    return { kind: "rounds", whole: head.whole, frac: null, sign: 1 };
  }

  if (head.frac) {
    throw new RangeError(
      `FGT | Cannot parse ◈ expression "${raw}": the leading term must be a whole number of rounds.`,
    );
  }
  if (!tail.frac) {
    throw new RangeError(
      `FGT | Cannot parse ◈ expression "${raw}": the adjusting term must be a fraction.`,
    );
  }
  return { kind: "rounds", whole: head.whole, frac: tail.frac, sign };
}

/**
 * Parse one term of a ◈ expression: a whole number, a fraction, or both.
 * @param {string} term
 * @param {string} raw the full expression, for error messages
 * @returns {{whole: number, frac: Fraction|null}}
 */
function parseTerm(term, raw) {
  const t = term.trim();
  if (t === "") throw new RangeError(`FGT | Empty term in "${raw}".`);

  // ASCII fraction "2/3" — tested BEFORE the leading-integer rule, which would
  // otherwise consume the numerator and leave an unparseable "/3".
  const ascii = /^(\d+)\/(\d+)$/.exec(t);
  if (ascii) {
    const den = Number(ascii[2]);
    if (den === 0) throw new RangeError(`FGT | Zero denominator in "${raw}".`);
    return { whole: 0, frac: { num: Number(ascii[1]), den } };
  }

  // Bare vulgar fraction "⅓"
  if (VULGAR[t]) {
    const [num, den] = VULGAR[t];
    return { whole: 0, frac: { num, den } };
  }

  // Leading whole number, optionally followed by a vulgar fraction ("1½").
  const lead = /^(\d+)/.exec(t);
  if (!lead) throw new RangeError(`FGT | Cannot parse the term "${term}" in "${raw}".`);
  const whole = Number(lead[1]);
  const rest = t.slice(lead[0].length);

  if (rest === "") return { whole, frac: null };
  if (VULGAR[rest]) {
    const [num, den] = VULGAR[rest];
    return { whole, frac: { num, den } };
  }

  throw new RangeError(`FGT | Cannot parse the term "${term}" in "${raw}".`);
}

/**
 * Resolve a parsed expression to an integer number of turns.
 *
 * @param {TickExpr|null} expr
 * @param {{turnsPerRound: number}} ctx
 * @returns {number} turn count, or {@link INFINITE}
 */
export function resolveTicks(expr, ctx) {
  if (expr === null) return 0;
  const tpr = ctx.turnsPerRound;
  switch (expr.kind) {
    case "ticks":
      return expr.n;
    case "thisTurn":
      // Expires at the end of the current turn — zero *remaining* turns.
      return 0;
    case "permanent":
    case "untilEvent":
    case "uses":
      // Not time-limited. `uses` is removed by consumption, `untilEvent` by an
      // event; neither counts down, so neither can be given a turn count.
      return INFINITE;
    case "rounds": {
      const whole = expr.whole * tpr;
      if (!expr.frac) return whole;
      const f = fractionTicks(expr.frac.num, expr.frac.den, tpr);
      return Math.max(0, whole + expr.sign * f);
    }
    default: {
      /** @type {never} */
      const exhaustive = expr;
      throw new RangeError(`FGT | Unhandled TickExpr kind: ${JSON.stringify(exhaustive)}`);
    }
  }
}

/**
 * Has an absolute expiry been reached at a tick?
 *
 * THE comparison, for every clock that stores an absolute expiry: an effect
 * (`scheduler.expireEffects`) and a painted terrain area
 * (`engine/terrain.mjs#expireTerrain`) stamped with one expiry go at the same
 * boundary, because they ask this of the same tick -- the tick of the Turn that
 * just ended. Sol's daylight was gone a Turn before Sol was, because the two
 * sweeps were handed different ticks (#161).
 *
 * `null`, `undefined` and `INFINITE` mean no clock.
 *
 * @param {number|null|undefined} expiry
 * @param {number} tick
 * @returns {boolean}
 */
export function expiryReached(expiry, tick) {
  if (expiry === null || expiry === undefined || expiry === INFINITE) return false;
  return expiry <= tick;
}

/**
 * Parse and resolve in one call.
 * @param {string|number|null|undefined} input
 * @param {{turnsPerRound: number}} ctx
 * @returns {number}
 */
export function ticks(input, ctx) {
  return resolveTicks(parseTick(input), ctx);
}

/**
 * Render a parsed expression back to authoring notation.
 * Round-trips through {@link parseTick}.
 * @param {TickExpr|null} expr
 * @returns {string}
 */
export function formatTick(expr) {
  if (expr === null) return "";
  switch (expr.kind) {
    case "ticks": return `${expr.n} turn${expr.n === 1 ? "" : "s"}`;
    case "thisTurn": return "this turn";
    case "permanent": return "permanent";
    case "untilEvent": return `until ${expr.event}`;
    case "uses": return `${expr.n} time${expr.n === 1 ? "" : "s"}`;
    case "rounds": {
      if (!expr.frac) return `${expr.whole}◈`;
      const frac = `${expr.frac.num}/${expr.frac.den}◈`;
      if (expr.whole === 0) return frac;
      return `${expr.whole}◈${expr.sign < 0 ? "-" : "+"}${frac}`;
    }
    default: return "";
  }
}
