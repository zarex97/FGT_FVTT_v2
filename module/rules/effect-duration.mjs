/**
 * @file Setting or extending a held effect's duration by name.
 * @see module/engine/skill-use.mjs, docs/17-abilities.md
 *
 * Layer 2 (rules). Pure.
 *
 * Vlad III (Berserker) (#333). Shapeshift's Passive 2: *"If this Skill is used
 * while Vlad has any Def Up (Shapeshift) and/or Atk Up (Shapeshift) buffs, their
 * duration is reset to 1◈ Turns"*, exactly 1◈ even with more left (ruling 5).
 * Legend of Dracula's step 1: *"the duration of those buffs is extended by 1◈
 * Turns"*. One `effectDuration` phase, `set` or `extend`, over the named effects
 * the target holds. Durations are absolute expiry ticks (Ch. 04), so both are a
 * delta on that tick, and an effect with no expiry has no clock to move.
 */

import { parseTick, resolveTicks } from "../domain/tick.mjs";

/**
 * The expiry change for each named effect the Unit holds.
 *
 * @param {{effects?: string[], set?: string|number, extend?: string|number}} phase
 * @param {Array<{id?: string, defId: string, expiry?: number|null}>} held the Unit's instances
 * @param {{tick: number, turnsPerRound: number}} ctx
 * @returns {Array<{defId: string, instanceId: string|null, delta: number, before: number, after: number}>}
 *   only the instances whose expiry moves; `before`/`after` are Turns left
 */
export function durationChanges(phase, held, { tick, turnsPerRound }) {
  const setting = phase?.set !== undefined && phase?.set !== null;
  const stated = setting ? phase.set : phase?.extend;
  if (stated === undefined || stated === null) return [];
  const span = resolveTicks(parseTick(stated), { turnsPerRound });
  const out = [];
  for (const defId of phase.effects ?? []) {
    for (const instance of held ?? []) {
      if (instance?.defId !== defId || typeof instance.expiry !== "number") continue;
      const after = setting ? tick + span : instance.expiry + span;
      const delta = after - instance.expiry;
      if (delta === 0) continue;
      out.push({
        defId, instanceId: instance.id ?? null, delta,
        before: Math.max(0, instance.expiry - tick), after: Math.max(0, after - tick),
      });
    }
  }
  return out;
}
