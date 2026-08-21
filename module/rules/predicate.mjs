/**
 * @file Predicate evaluation over roll options.
 * @see docs/24-rules-engine.md §24.4
 *
 * Layer 2 (rules). Pure — consumes a snapshot and a roll-option set, returns a
 * boolean. No documents, no Foundry.
 *
 * A predicate is **data**, not a function, for three reasons (§24.4): content
 * lives in compendia and cannot execute; a failed predicate must be renderable
 * as prose for the audit trail; and shared compendia must be safe to load.
 * {@link explain} is the second of those three.
 */

import { Rank } from "../domain/rank.mjs";

/** The prefix that negates a bare option string. */
const NEGATION = "not:";

/**
 * A bare string is a set-membership test; prefix it with `not:` to negate.
 *
 * @typedef {string
 *   | {not: Statement}
 *   | {and: Statement[]} | {or: Statement[]} | {nand: Statement[]} | {nor: Statement[]}
 *   | {anyOf: string[]}
 *   | {gte: [ValueRef, ValueRef]} | {gt: [ValueRef, ValueRef]}
 *   | {lte: [ValueRef, ValueRef]} | {lt: [ValueRef, ValueRef]}
 *   | {eq: [ValueRef, ValueRef]}
 *   | {rankGte: [RankRef, RankRef]} | {rankEq: [RankRef, RankRef]}} Statement
 * @typedef {number|string} ValueRef
 * @typedef {string} RankRef
 * @typedef {Statement[]} Predicate implicit AND
 */

/**
 * @typedef {object} PredicateContext
 * @property {ReadonlySet<string>} options the roll options in scope
 * @property {Record<string, unknown>} [refs] resolution root for `@` references,
 *   conventionally `{self, target, attack, board}`
 */

/**
 * Evaluate a predicate. An empty or absent predicate is `true` — an unconditional
 * rule element is the common case and should not need `predicate: []` boilerplate.
 *
 * @param {Predicate|null|undefined} predicate
 * @param {PredicateContext} ctx
 * @returns {boolean}
 */
export function test(predicate, ctx) {
  if (!predicate || predicate.length === 0) return true;
  return predicate.every((s) => testStatement(s, ctx));
}

/**
 * @param {Statement} s
 * @param {PredicateContext} ctx
 * @returns {boolean}
 */
export function testStatement(s, ctx) {
  // A `not:` PREFIX negates the option that follows it. This notation is used
  // by content and by `domain/tables.mjs`, and it was never implemented: the
  // whole string was looked up as one option, which is never in the set, so
  // every such clause was permanently **false**.
  //
  // It cost three rules. Penthesilea's *Charisma* is gated
  // `not:self:skillActive:madEnhancement` in both its passive and its active
  // form, so her signature aura contributed nothing; her Noble Phantasm's
  // three passive clauses are gated the same way; and Karna's Vasavi Shakti
  // divinity override predicates on `not:target:skill:divinity` and could
  // never fire.
  //
  // The validator's own `looksLikeRollOption` accepts the prefixed form as
  // well-formed, which is exactly why nobody noticed.
  if (typeof s === "string") {
    return s.startsWith(NEGATION) ? !ctx.options.has(s.slice(NEGATION.length)) : ctx.options.has(s);
  }
  if (s === null || typeof s !== "object") {
    throw new TypeError(`FGT | Malformed predicate statement: ${JSON.stringify(s)}`);
  }

  if ("not" in s) return !testStatement(s.not, ctx);
  if ("and" in s) return s.and.every((x) => testStatement(x, ctx));
  if ("or" in s) return s.or.some((x) => testStatement(x, ctx));
  if ("nand" in s) return !s.nand.every((x) => testStatement(x, ctx));
  if ("nor" in s) return !s.nor.some((x) => testStatement(x, ctx));
  if ("anyOf" in s) return s.anyOf.some((o) => ctx.options.has(o));

  if ("gte" in s) return num(s.gte[0], ctx) >= num(s.gte[1], ctx);
  if ("gt" in s) return num(s.gt[0], ctx) > num(s.gt[1], ctx);
  if ("lte" in s) return num(s.lte[0], ctx) <= num(s.lte[1], ctx);
  if ("lt" in s) return num(s.lt[0], ctx) < num(s.lt[1], ctx);
  if ("eq" in s) return num(s.eq[0], ctx) === num(s.eq[1], ctx);

  if ("rankGte" in s) {
    const [a, b] = s.rankGte.map((r) => rank(r, ctx));
    // An unranked side never satisfies a rank threshold. Every rule that cares
    // states its own unranked fallback, so silently ordering null lowest would
    // implement the wrong one (Ch. 05 §5.1).
    return Rank.gte(a, b, false);
  }
  if ("rankEq" in s) {
    const [a, b] = s.rankEq.map((r) => rank(r, ctx));
    return Rank.equals(a, b);
  }

  throw new TypeError(`FGT | Unknown predicate operator in ${JSON.stringify(s)}`);
}

/**
 * Resolve a numeric reference: a literal, or an `@`-path into `ctx.refs`.
 * @param {ValueRef} ref
 * @param {PredicateContext} ctx
 * @returns {number}
 */
function num(ref, ctx) {
  if (typeof ref === "number") return ref;
  const v = resolve(ref, ctx);
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) {
    throw new TypeError(`FGT | Predicate reference "${ref}" did not resolve to a number (got ${JSON.stringify(v)}).`);
  }
  return n;
}

/**
 * Resolve a rank reference, supporting the `+n` / `-n` step suffix that Karna's
 * *Brahmastra* predicate uses (`"@target.parameters.str+1"` = one step above).
 * @param {RankRef} ref
 * @param {PredicateContext} ctx
 * @returns {Rank|null}
 */
function rank(ref, ctx) {
  if (typeof ref !== "string") return null;
  const m = /^(.*?)([+-]\d+)$/.exec(ref);
  const path = m ? m[1] : ref;
  const shift = m ? Number(m[2]) : 0;

  const raw = path.startsWith("@") ? resolve(path, ctx) : path;
  const base = raw instanceof Rank ? raw : Rank.parseOrNull(/** @type {string} */ (raw));
  if (base === null) return null;
  return shift === 0 ? base : base.step(shift);
}

/**
 * Resolve an `@a.b.c` path against `ctx.refs`.
 * @param {string} ref
 * @param {PredicateContext} ctx
 * @returns {unknown}
 */
function resolve(ref, ctx) {
  if (!ref.startsWith("@")) return ref;
  let cur = /** @type {any} */ (ctx.refs ?? {});
  for (const part of ref.slice(1).split(".")) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[part];
  }
  return cur;
}

/**
 * Render a predicate as prose, marking which statements failed.
 *
 * This is the reason predicates are data. A rule element that did not fire can
 * say *"requires: target has the Large attribute (target does not)"* rather
 * than "false", which is the difference between a usable audit trail and a
 * frustrating one.
 *
 * @param {Predicate|null|undefined} predicate
 * @param {PredicateContext} ctx
 * @returns {Array<{text: string, passed: boolean}>}
 */
export function explain(predicate, ctx) {
  if (!predicate || predicate.length === 0) return [];
  return predicate.map((s) => ({ text: describe(s), passed: safeTest(s, ctx) }));
}

/**
 * @param {Statement} s
 * @param {PredicateContext} ctx
 * @returns {boolean}
 */
function safeTest(s, ctx) {
  try {
    return testStatement(s, ctx);
  } catch {
    return false;
  }
}

/**
 * @param {Statement} s
 * @returns {string}
 */
function describe(s) {
  if (typeof s === "string") return humanize(s);
  if ("not" in s) return `not (${describe(s.not)})`;
  if ("and" in s) return s.and.map(describe).join(" and ");
  if ("or" in s) return s.or.map(describe).join(" or ");
  if ("nand" in s) return `not all of: ${s.nand.map(describe).join(", ")}`;
  if ("nor" in s) return `none of: ${s.nor.map(describe).join(", ")}`;
  if ("anyOf" in s) return `any of: ${s.anyOf.map(humanize).join(", ")}`;
  for (const [op, label] of Object.entries(COMPARATORS)) {
    if (op in s) return `${pretty(s[op][0])} ${label} ${pretty(s[op][1])}`;
  }
  return JSON.stringify(s);
}

const COMPARATORS = Object.freeze({
  gte: "≥", gt: ">", lte: "≤", lt: "<", eq: "=", rankGte: "rank ≥", rankEq: "rank =",
});

/**
 * `target:attribute:large` → `target has attribute "large"`.
 * @param {string} option
 * @returns {string}
 */
function humanize(option) {
  const parts = option.split(":");
  if (parts.length < 2) return option;
  const [subject, facet, ...rest] = parts;
  const value = rest.join(":");
  if (!value) return `${subject} is ${facet}`;
  return `${subject} ${facet} = ${value}`;
}

/**
 * @param {ValueRef} v
 * @returns {string}
 */
function pretty(v) {
  return typeof v === "string" && v.startsWith("@") ? v.slice(1) : String(v);
}

/**
 * Collect every literal option string a predicate mentions.
 * The content validator uses this to catch typo'd options at build time, which
 * is the dominant failure mode in a data-driven system (Ch. 21 §21.8).
 * @param {Predicate|null|undefined} predicate
 * @returns {Set<string>}
 */
export function referencedOptions(predicate) {
  /** @type {Set<string>} */
  const out = new Set();
  /** @param {string} o */
  const bare = (o) => (o.startsWith(NEGATION) ? o.slice(NEGATION.length) : o);
  /** @param {Statement} s */
  const walk = (s) => {
    // The OPTION, not the negation of it. Both readers want the bare name: the
    // validator is checking for typos, and the deferral pass in
    // `rules/elements.mjs` is asking whose state the clause is about --
    // `not:target:skill:divinity` is a question about the target either way.
    if (typeof s === "string") return void out.add(bare(s));
    if (s === null || typeof s !== "object") return;
    if ("not" in s) return walk(s.not);
    for (const k of ["and", "or", "nand", "nor"]) if (k in s) return s[k].forEach(walk);
    if ("anyOf" in s) return s.anyOf.forEach((o) => out.add(bare(o)));
  };
  predicate?.forEach(walk);
  return out;
}
