/**
 * @file The Noble Phantasm availability gate.
 * @see docs/07-time-model.md §7.9
 *
 * Layer 2 (rules). Pure — no `game`, no `canvas`, no settings.
 *
 * > *"Usable after 5 full Rounds — i.e. from Round 6. Assassin: after 3 — from
 * > Round 4."*
 *
 * `CONFIG.FGT.gates` has held all four of §7.9's numbers since the config file
 * was written and **nothing read that object**. Measured live before this
 * module existed: a Noble Phantasm fires in Round 1. This is the project's
 * dominant defect shape — a rule collected, correct and inert — applied to one
 * of the game's load-bearing constraints.
 *
 * The arithmetic lives here rather than in the reader because it is the part
 * worth testing exhaustively and the part that needs no world: §7.10's argument
 * for the whole time model.
 */

/**
 * The published defaults, mirrored from `CONFIG.FGT.gates`.
 *
 * Mirrored rather than imported: `config.mjs` is Layer 4 and this is Layer 2.
 * The world settings that seed from CONFIG are read in the engine and passed
 * in; these are what a caller gets when it passes nothing, and a caller that
 * passes nothing must get the RULE rather than no rule.
 *
 * @type {Readonly<{round: number, assassinRound: number}>}
 */
export const NP_GATE = Object.freeze({ round: 6, assassinRound: 4 });

/**
 * Master Essences that open the gate early, and by how many Rounds.
 *
 * > *"Kaleidoscope: Servant NP is usable 4 Rounds earlier (Round 2 onwards)."*
 *
 * The seam for an unbuilt subsystem (spec §2). `MasterData.essences` is a
 * `SetField` that nothing writes and nothing reads, and there is no content
 * pack — so `essenceShift` returns 0 in every world today. When the essence
 * subsystem is built it populates that set and this begins working with no
 * change here.
 *
 * @type {Readonly<Record<string, number>>}
 */
export const ESSENCE_SHIFT = Object.freeze({
  kaleidoscope: 4, imaginaryNumber: 3, leyline: 2, harvest: 1,
});

/** Classes whose gate opens early. Assassin is the only one §7.9 names. */
const EARLY_CLASSES = Object.freeze(["assassin"]);

/**
 * Does the availability gate cover this ability?
 *
 * `isNP || categorizedAsNP` — the same predicate §15.5's three other scoping
 * questions use (cooldown scope, damage-modifier scope, NP Seal scope).
 * Availability is a fourth scoping question that chapter never asked, and it
 * gets the same answer (spec R2).
 *
 * @param {object|null} ability a usage spec or an ability's system data
 * @returns {boolean}
 */
export function isGated(ability) {
  return Boolean(ability?.isNP) || Boolean(ability?.categorizedAsNP);
}

/**
 * The Round this unit's Noble Phantasms open in, before any essence.
 *
 * A Servant holding more than one class takes the **earliest** of them (spec
 * R5) — the mirror of `zonRadius`'s rule that the widest zone applies, because
 * a rule that opens sooner is not cancelled by one that opens later.
 *
 * A unit with no classes at all takes the general gate rather than being
 * exempt. Exemption is a decision and no sheet states one.
 *
 * @param {object|null|undefined} unit a unit snapshot
 * @param {{round: number, assassinRound: number}} [gates]
 * @returns {number}
 */
export function baseGateRound(unit, gates = NP_GATE) {
  const classes = unit?.servantClasses ?? [];
  const early = classes.some((c) => EARLY_CLASSES.includes(c));
  return early ? (gates.assassinRound ?? NP_GATE.assassinRound) : (gates.round ?? NP_GATE.round);
}

/**
 * How many Rounds early this Master's Essence opens its Servant's gate.
 *
 * The **largest** when a Master somehow carries two. One essence per Master is
 * the rule, and summing them would let two small ones reach Round 0 — a gate of
 * zero reads as no gate at all, which is the one outcome no essence buys.
 *
 * @param {object|null|undefined} master a Master's snapshot
 * @returns {number}
 */
export function essenceShift(master) {
  const held = [...(master?.essences ?? [])].map((id) => ESSENCE_SHIFT[id] ?? 0);
  return held.length > 0 ? Math.max(...held) : 0;
}

/**
 * The Round this unit's Noble Phantasms actually open in.
 *
 * Never earlier than Round 1: Round 0 does not exist, and a gate of 0 would
 * read as "no gate" to every comparison downstream.
 *
 * @param {object|null|undefined} unit
 * @param {object|null|undefined} master
 * @param {{round: number, assassinRound: number}} [gates]
 * @returns {number}
 */
export function gateRoundFor(unit, master, gates = NP_GATE) {
  return Math.max(1, baseGateRound(unit, gates) - essenceShift(master));
}

/**
 * The first absolute Turn on which the gate is open.
 *
 * Round `n` begins on global turn `(n − 1) × turnsPerRound + 1` (§7.4's
 * global-turn index).
 *
 * @param {object|null|undefined} unit
 * @param {object|null|undefined} master
 * @param {{gates?: object, turnsPerRound?: number}} [ctx]
 * @returns {number}
 */
export function gateTurnFor(unit, master, ctx = {}) {
  const turnsPerRound = ctx.turnsPerRound ?? 3;
  return (gateRoundFor(unit, master, ctx.gates ?? NP_GATE) - 1) * turnsPerRound + 1;
}

/**
 * The absolute Turn this ability becomes usable.
 *
 * > *"If a Unit has its NP Cooldown increased before its NP would be available
 * > (i.e. before 5 Rounds have passed), then its NP would only be usable X
 * > Turns **after** its NP would be available, X being the number of Turns its
 * > NP Cooldown was increased by."*
 *
 * **Additive, not `max()`.** §7.9 prints both readings — the prose says the two
 * compose additively and the pseudocode beneath it says
 * `max(gateTurn, readyOnTurn)` — and the prose is right (spec R1). Under `max()`
 * an NP Lock spent while the target's NP was gated anyway costs the caster a
 * Skill and buys nothing, which is precisely the outcome this clause exists to
 * prevent.
 *
 * `gatedDelay` is the running total of increases taken before the gate opened,
 * recorded by `engine/io.mjs`'s cooldown writer. Zero for every ability in
 * every world until something increases a cooldown early.
 *
 * @param {object|null|undefined} unit
 * @param {object|null} ability
 * @param {object|null|undefined} master
 * @param {{gates?: object, turnsPerRound?: number}} [ctx]
 * @returns {number} `0` when the gate does not cover this ability
 */
export function npAvailableTurn(unit, ability, master, ctx = {}) {
  if (!isGated(ability)) return 0;
  return gateTurnFor(unit, master, ctx) + (ability?.cooldown?.gatedDelay ?? 0);
}
