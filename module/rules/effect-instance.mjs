/**
 * @file The one reader of a standing Effect: its polarity, its magnitude, its
 * time and whether the board admits it (#315).
 * @see docs/14-effect-taxonomy.md, docs/15-effect-application.md, CONTEXT.md (Polarity, Magnitude, Pause, Stacking)
 *
 * Layer 2 (rules). Pure.
 *
 * Every question about an Effect a Unit carries is asked here, so a rule that
 * bends one of them is one branch in one file:
 *
 * - **Polarity** is decided when the Effect lands, and never changes after.
 *   Romulus Quirinus's Roma Stacks *"are categorized as a debuff when applied to
 *   enemy Units and are categorized as a buff when applied to allied Units"*
 *   (`polarityByRelation`, #303); Prelati's Berserk (Folly) applied to allies by
 *   Blessing of Folly *"is treated as a buff instead of a debuff"* (the apply
 *   entry's own `polarity`). Before this, polarity was read off the definition in
 *   some 25 places and off a copy in the rest, and nothing stored the copy.
 * - **Magnitude** may fall while the Effect stands (`decay`, #296): Tomoe
 *   (Summer)'s Crit DmUp (Nightowl) is 100%, then 75%, then 50% across its ◈
 *   Turns; Merlin's Crit DmUp (Illusion) loses 5% per successful Crit.
 * - **Time** may pause (`pausedWhile`, #305): Santa Suzuka's Seiya buffs *"do not
 *   lose duration during a Night Round"*. The expiry stays an absolute Tick; a
 *   paused Turn pushes it one Tick on, so every reader of expiry stays as it is.
 * - **Admission** may be board-wide (`boardUnique`, #304): Nezha's *"Only one Stun
 *   (Sash) debuff can exist on the field at any time"*; Summer Passionlip's Prince
 *   and Princess, one of the two. A new one replaces the old.
 */

import { test as testPredicate } from "./predicate.mjs";

/** The polarities an Effect may have. */
export const POLARITIES = Object.freeze(["buff", "debuff", "status"]);

/**
 * The polarity an Effect lands with.
 *
 * The apply entry's own `polarity` first (it is this application's), then the
 * definition's `polarityByRelation` for the bearer's relation to the source,
 * then the definition's `polarity`. A self-application is an ally's.
 *
 * @param {object} def the Effect definition
 * @param {{relation?: string|null, entryPolarity?: string|null}} [ctx]
 * @returns {"buff"|"debuff"|"status"|null}
 */
export function landedPolarity(def, { relation = null, entryPolarity = null } = {}) {
  if (POLARITIES.includes(entryPolarity)) return entryPolarity;
  const byRelation = def?.polarityByRelation ?? null;
  const side = relation === "self" ? "ally" : relation;
  if (byRelation && side && POLARITIES.includes(byRelation[side])) return byRelation[side];
  return def?.polarity ?? null;
}

/**
 * The definition as one landing sees it: the same document with the polarity
 * this application decided. Everything the landing asks of its definition
 * (immunity, resistance, the duration bonus, the Prevention Luck Check) then
 * answers for the polarity the Effect will carry.
 *
 * @param {object} def
 * @param {{relation?: string|null, entryPolarity?: string|null}} [ctx]
 * @returns {object}
 */
export function landedDefinition(def, ctx = {}) {
  if (!def) return def;
  const polarity = landedPolarity(def, ctx);
  return polarity === def.polarity ? def : { ...def, polarity };
}

/**
 * The polarity of an Effect a Unit carries: what it landed with. An instance
 * written before polarity was stored (2026-10-22) reads its definition's.
 *
 * @param {object|null} instance an instance projection, an ActiveEffect's `system`, or an intent's effect record
 * @param {object|null} [def] its definition
 * @returns {"buff"|"debuff"|"status"|null}
 */
export function polarityOf(instance, def = null) {
  return instance?.polarity ?? instance?.system?.polarity ?? def?.polarity ?? null;
}

/**
 * The magnitude an Effect stands at now.
 *
 * - `decay: {on: "turn", steps: [100, 75, 50]}`: the step for the ◈ Turns since
 *   it landed, the last step holding. `per: "turn"` steps by each Turn instead:
 *   Def Dwn (Knacken) is 50% *"on the Turn this Spell is used, then its
 *   magnitude is reduced to 25% at the end of the Turn"* (Sieg, #345).
 * - `decay: {on: <event>, by: 5}`: its magnitude less `by` for each time the
 *   event was counted (`decayCount`).
 *
 * Never below 0. Without `decay`, the magnitude it landed with.
 *
 * @param {object} instance `{magnitude, appliedTick, decayCount}`
 * @param {object|null} def
 * @param {{tick?: number|null, turnsPerRound?: number}} [now]
 * @returns {number}
 */
export function magnitudeOf(instance, def, { tick = null, turnsPerRound = 3 } = {}) {
  const base = Number(instance?.magnitude ?? 0) || Number(def?.defaultMagnitude ?? 0) || 0;
  const decay = def?.decay ?? null;
  if (!decay) return base;
  if (decay.on === "turn") {
    const steps = Array.isArray(decay.steps) ? decay.steps : [];
    if (steps.length === 0) return base;
    const elapsed = Math.max(0, (tick ?? instance?.appliedTick ?? 0) - (instance?.appliedTick ?? 0));
    const span = decay.per === "turn" ? 1 : Math.max(1, turnsPerRound);
    const index = Math.min(steps.length - 1, Math.floor(elapsed / span));
    return Math.max(0, Number(steps[index]) || 0);
  }
  return Math.max(0, base - Number(decay.by ?? 0) * Number(instance?.decayCount ?? 0));
}

/**
 * What one Turn boundary does to an Effect's time: `{extend: 1}` when its
 * duration is paused this Turn, nothing otherwise.
 *
 * Paused by its definition's `pausedWhile`, tested against its bearer's options
 * (the War's `war:phase` among them), or by an area that pauses every duration
 * inside it (`paused`, the bearer's `pausesDurations`: Bug Space's *"All
 * effects, durations, and Cooldowns are paused"*). An Effect with no expiry has
 * no time to pause.
 *
 * @param {object} instance
 * @param {object|null} def
 * @param {{options?: Set<string>, paused?: boolean}} [at]
 * @returns {{extend?: number}}
 */
export function advance(instance, def, { options = new Set(), paused = false } = {}) {
  if (instance?.expiry === null || instance?.expiry === undefined) return {};
  if (paused) return { extend: 1 };
  const when = def?.pausedWhile ?? null;
  if (Array.isArray(when) && when.length > 0 && testPredicate(when, { options })) return { extend: 1 };
  return {};
}

/**
 * Which instances a landing removes from the whole board.
 *
 * A definition's `boardUnique` names a group; every other instance of a
 * definition in the same group, on any Unit of this War's board, goes when this
 * one lands. Nezha's group holds one definition, Passionlip's two.
 *
 * @param {object} def the landing definition
 * @param {{target: object, board: object, defOf: (id: string) => object|null}} at
 * @returns {Array<{unitId: string, instanceId: string, defId: string}>}
 */
export function admit(def, { target, board, defOf }) {
  const group = def?.boardUnique ?? null;
  if (!group) return [];
  const out = [];
  for (const unit of board?.units ?? []) {
    for (const inst of unit.effectInstances ?? []) {
      if (defOf(inst.defId)?.boardUnique !== group) continue;
      // The same definition on the same target is its own stacking rule's.
      if (unit.id === target?.id && inst.defId === def.id) continue;
      out.push({ unitId: unit.id, instanceId: inst.id ?? inst.defId, defId: inst.defId });
    }
  }
  return out;
}
