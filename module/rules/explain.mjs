/**
 * @file Rendering the damage breakdown into displayable rows.
 * @see docs/30-chat-and-audit.md §30.3
 *
 * Layer 2 (rules). **Pure** — it turns a `DamageResult` into plain row objects.
 * The HTML lives in a template; this decides *what* to say.
 *
 * Three properties make this useful rather than merely thorough:
 *
 *   1. Stages with no contribution still appear, marked `—`. Their absence
 *      would raise the question "was stage 9 even considered?"
 *   2. Blocked contributions are shown **with the reason**, not omitted.
 *   3. Rank comparisons are shown as arithmetic (`B (300) < A+ (401)`), because
 *      the ordinal scheme is the most confusing part of the rules and showing
 *      the numbers settles arguments instantly.
 */

import { STAGE_NAMES } from "./damage/pipeline.mjs";

/** Human labels for each stage index. */
export const STAGE_LABELS = Object.freeze([
  "Precondition", "Base", "Crit", "Ability multiplier", "Combined percent",
  "Component amplification", "Band", "Flat attack bonuses", "Environment",
  "ZON penalty", "Luck: Increased Damage", "Resistance", "Flat reductions",
  "Luck: Reduced Damage", "Block", "Total-damage modifiers", "Clamp",
]);

/**
 * @typedef {object} ExplainerRow
 * @property {number} index
 * @property {string} label
 * @property {string} delta what this stage changed, or `"—"`
 * @property {number} running the running total after the stage
 * @property {Array<{source: string, value: string, note: string|null,
 *                   side: string|null}>} contributors
 * @property {Array<{source: string, text: string, side: string|null}>} notes
 * @property {boolean} inert nothing happened here
 */

/**
 * Build the explainer rows from a pipeline result.
 *
 * @param {object} result a `DamageResult`
 * @param {object} [opts]
 * @param {boolean} [opts.hideInert=false] drop no-op stages (not recommended)
 * @returns {{rows: ExplainerRow[], summary: object}}
 */
export function explainDamage(result, opts = {}) {
  const rows = [];

  for (const stage of result.breakdown ?? []) {
    const before = total(stage.before);
    const after = total(stage.after);
    const contributors = (stage.contributors ?? []).map((c) => ({
      source: prettySource(c.source),
      value: formatValue(c.source, c.value),
      note: c.note ?? null,
      // Carried through untouched. Deciding who may READ a contributor is a
      // separate question, answered by `redactBreakdown` in card-visibility;
      // this file's job is to say what happened, completely.
      side: c.side ?? null,
    }));
    const notes = (stage.notes ?? []).map((n) => ({ ...n, side: n.side ?? null }));
    const inert = contributors.length === 0 && notes.length === 0 && before === after;

    if (opts.hideInert && inert) continue;

    rows.push({
      index: stage.index,
      label: STAGE_LABELS[stage.index] ?? STAGE_NAMES[stage.index] ?? `Stage ${stage.index}`,
      delta: inert ? "—" : formatDelta(before, after),
      running: round(after),
      contributors,
      notes,
      inert,
    });
  }

  return { rows, summary: summarize(result) };
}

/**
 * The headline: the number, its split, and the flags a reader needs first.
 * @param {object} result
 * @returns {object}
 */
export function summarize(result) {
  const flags = result.flags ?? {};
  return {
    total: round(result.total ?? 0),
    magical: round(result.magical ?? 0),
    physical: round(result.physical ?? 0),
    hasSplit: (result.magical ?? 0) > 0 && (result.physical ?? 0) > 0,
    negatedBy: flags.negatedBy ?? null,
    shieldAbsorbed: flags.shieldAbsorbed ?? 0,
    injury: Boolean(flags.exceededInjuryThreshold),
    defeatedOutright: Boolean(flags.defeatedOutright),
  };
}

/**
 * Render a rank comparison as arithmetic.
 *
 * `"B (300) < A+ (401) → not negated"` rather than `"not negated"`. The
 * ordinal scheme is the single most confusing part of the rules, and showing
 * the numbers is what stops the argument.
 *
 * @param {import("../domain/rank.mjs").Rank|null} a
 * @param {import("../domain/rank.mjs").Rank|null} b
 * @param {string} outcome
 * @returns {string}
 */
export function explainRankComparison(a, b, outcome) {
  if (a === null || b === null) {
    return `${a ?? "unranked"} vs ${b ?? "unranked"} → incomparable, ${outcome}`;
  }
  const op = a.ordinal === b.ordinal ? "=" : a.ordinal > b.ordinal ? ">" : "<";
  return `${a} (${a.ordinal}) ${op} ${b} (${b.ordinal}) → ${outcome}`;
}

/**
 * The "Not applied" section — every rule element that was considered and did
 * not apply, with the clause that failed.
 *
 * This is the section that catches bugs. A modifier that silently did nothing
 * is indistinguishable from one that does not exist, until someone asks why
 * their buff had no effect.
 *
 * @param {Array<{source: string, predicate: unknown, explanation: Array<{text: string, passed: boolean}>}>} considered
 * @param {number} [cap=20]
 * @returns {{entries: Array<object>, truncated: number}}
 */
export function explainNotApplied(considered, cap = 20) {
  const entries = considered
    .filter((c) => (c.explanation ?? []).some((e) => !e.passed))
    .map((c) => ({
      source: c.source,
      failed: (c.explanation ?? []).filter((e) => !e.passed).map((e) => e.text),
      passed: (c.explanation ?? []).filter((e) => e.passed).map((e) => e.text),
    }));
  return { entries: entries.slice(0, cap), truncated: Math.max(0, entries.length - cap) };
}

/* -------------------------------------------------------------------------- */

/** @param {{mag: number, phys: number}|null} v @returns {number} */
function total(v) {
  return (v?.mag ?? 0) + (v?.phys ?? 0);
}

/** @param {number} n @returns {number} */
function round(n) {
  return Math.round((n ?? 0) * 100) / 100;
}

/**
 * @param {number} before
 * @param {number} after
 * @returns {string}
 */
function formatDelta(before, after) {
  const diff = after - before;
  if (Math.abs(diff) < 0.005) return "—";
  // A stage that scaled shows the factor; one that added shows the amount.
  if (before !== 0 && Math.abs(diff) > 0.005) {
    const factor = after / before;
    const isScale = Math.abs(factor - 1) > 0.005 && Number.isFinite(factor);
    if (isScale && Math.abs(Math.round(diff) - diff) > 0.001) {
      return `× ${factor.toFixed(2)}`;
    }
  }
  return `${diff > 0 ? "+" : "−"}${Math.abs(round(diff))}`;
}

/**
 * Percentage-shaped contributors read as percentages; the rest as amounts.
 * @param {string} source
 * @param {number} value
 * @returns {string}
 */
function formatValue(source, value) {
  const pct = PERCENT_SOURCES.has(source);
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(round(value))}${pct ? "%" : ""}`;
}

const PERCENT_SOURCES = new Set([
  "atkUp", "atkDwn", "defUp", "defDwn", "dmgUp", "npDmUp", "npDmDwn", "ward",
  "block", "blockUp", "strengthenBlock", "dayNight", "homeBaseAttack", "magicResistance",
]);

/** @type {Readonly<Record<string, string>>} */
const SOURCE_LABELS = Object.freeze({
  "base:str": "BA(STR)",
  "base:mag": "BA(MAG)",
  "attack+": "Attack+",
  "attack-": "Attack−",
  atkUp: "Atk Up",
  atkDwn: "Atk Dwn",
  defUp: "Def Up",
  defDwn: "Def Dwn",
  dmgUp: "Dmg Up",
  npDmUp: "NP DmUp",
  npDmDwn: "NP DmDwn",
  dmgCut: "Dmg Cut",
  defCrk: "Def Crk",
  divinity: "Divinity",
  dmgBoost: "Dmg Boost",
  magicResistance: "Magic Resistance",
  battleContinuation: "Battle Continuation",
  territoryCreation: "Territory Creation",
  territoryCreationDefence: "Territory Creation (defence)",
  zonPenalty: "ZON penalty",
  luckIncreasedDamage: "Luck: Increased Damage",
  luckReducedDamage: "Luck: Reduced Damage",
  block: "Block",
  blockUp: "Block Up",
  strengthenBlock: "Luck: Strengthen Block",
  multiplier: "Ability multiplier",
  flatBonus: "Flat bonus",
  conditionalMultiplier: "Ability clause",
  shield: "Shield",
  endure: "Endure",
  invuln: "Invuln",
  homeBaseAttack: "Home Base",
  dayNight: "Day/Night",
});

/** @param {string} source @returns {string} */
function prettySource(source) {
  return SOURCE_LABELS[source] ?? source;
}
