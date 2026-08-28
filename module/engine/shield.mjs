/**
 * @file A second Health pool between an attack and its target.
 * @see docs/13-damage-pipeline.md, docs/A-effect-catalogue.md §A.3
 *
 * Layer 3.
 *
 * Every other defensive effect in the game is a percentage (`Def Up`), a flat
 * subtraction (`Dmg Cut`), a refusal (`Invuln`) or an evasion (`Dodge`). A
 * **barrier** is none of those: it has a bar, the bar carries over between
 * attacks, it is shared by several Units at once, and it charges its owner for
 * every point it loses.
 *
 * EMIYA's *Rho Aias* is the only one in the reference set, and it is worth
 * quoting because four separate clauses interlock:
 *
 * > *"Rho Aias has 1400 Health, and it will take the damage of the enemy's NP.
 * > For every 200 Health Rho Aias loses, EMIYA loses 100 Health. If the AU's NP
 * > deals more than 1400 damage, the remaining damage is dealt to the DUs
 * > accordingly. However, if the NP is a 'thrown weapon', Rho Aias' Health
 * > cannot drop below 1. EMIYA's Health cannot drop below 1 due to Rho Aias
 * > being damaged by the AU's NP."*
 *
 * The pool lives on the **ability**, not on the effect instance. That is what
 * makes the overflow clause mean anything: an area Noble Phantasm hitting four
 * protected Units draws all four down one 1400 in resolution order, rather than
 * meeting four fresh barriers.
 */

import { EffectRegistry } from "../rules/registry.mjs";
import { test as testPredicate } from "../rules/predicate.mjs";
import * as I from "./intents.mjs";

/**
 * @typedef {object} Absorption
 * @property {number} through   damage that still reaches the defender
 * @property {number} absorbed  damage the barrier took
 * @property {object[]} intents the pool write and the owner's share
 * @property {string|null} source the barrier's name, for the card
 */

/**
 * Run an incoming total through whatever barrier the defender stands behind.
 *
 * @param {object} defender the defender's snapshot
 * @param {number} total the damage the pipeline produced
 * @param {object} ctx
 * @param {ReadonlySet<string>} ctx.options the attack's roll options
 * @returns {Absorption}
 */
export function absorb(defender, total, ctx = {}) {
  const none = { through: total, absorbed: 0, intents: [], source: null };
  if (total <= 0) return none;

  const barrier = barrierOn(defender, ctx.options ?? new Set());
  if (!barrier) return none;

  const { item, def, owner } = barrier;
  const spec = item.system?.shield ?? {};
  const pool = item.system?.shieldHealth ?? 0;
  if (pool <= 0) return none;

  // "If the NP is a 'thrown weapon', Rho Aias' Health cannot drop below 1" --
  // and a barrier that cannot be broken absorbs everything, however large.
  const floored = testPredicate(spec.poolFloorWhen ?? null, { options: ctx.options ?? new Set() })
    ? (spec.poolFloor ?? 0)
    : 0;
  const available = Math.max(0, pool - floored);
  const absorbed = floored > 0 ? total : Math.min(available, total);
  const through = floored > 0 ? 0 : Math.max(0, total - absorbed);

  // The pool only ever loses what it could actually lose: a thrown weapon is
  // stopped in full and still only costs the barrier what it had above the
  // floor.
  const lost = Math.min(available, absorbed);

  return {
    through,
    absorbed,
    source: def.name ?? item.name,
    intents: [
      ...(lost > 0 ? [I.shieldDelta(owner.id, item.id, -lost)] : []),
      ...ownerShare(spec, lost, owner),
    ],
  };
}

/**
 * What the barrier's owner pays for what it took.
 *
 * *"For every 200 Health Rho Aias loses, EMIYA loses 100 Health."* Per
 * completed 200, not pro rata: 199 costs him nothing, which is the reading the
 * word "every" carries and the one that makes a small chip attack free.
 *
 * `statDelta` rather than `damage`, because this is not an attack on him -- it
 * must not trigger an Injury Roll, `Dmged NP Regen`, or anything else keyed on
 * taking damage.
 *
 * @param {object} spec
 * @param {number} lost
 * @param {object} owner the owner's snapshot
 * @returns {object[]}
 */
function ownerShare(spec, lost, owner) {
  const per = spec.ownerLoss?.per ?? 0;
  const amount = spec.ownerLoss?.amount ?? 0;
  if (per <= 0 || amount <= 0 || lost <= 0) return [];

  const share = Math.floor(lost / per) * amount;
  if (share <= 0) return [];

  // "EMIYA's Health cannot drop below 1 due to Rho Aias being damaged by the
  // AU's NP" -- a floor on THIS deduction, so ordinary damage may still finish
  // him afterwards.
  const floor = spec.ownerFloor ?? 0;
  const allowed = Math.max(0, (owner.health ?? 0) - floor);
  const taken = Math.min(allowed, share);
  return taken > 0 ? [I.statDelta(owner.id, "health.value", -taken)] : [];
}

/**
 * The barrier standing in front of this defender, if any.
 *
 * @param {object} defender
 * @param {ReadonlySet<string>} options
 * @returns {{item: object, def: object, owner: object}|null}
 */
function barrierOn(defender, options) {
  for (const instance of defender.effectInstances ?? []) {
    const def = EffectRegistry.get(instance.defId);
    const absorbs = def?.absorbs ?? null;
    if (!absorbs) continue;

    // "About to be hit by a NOBLE PHANTASM." An ordinary Attack passes straight
    // through a standing Rho Aias, which is easy to get wrong in the generous
    // direction and would make the barrier a permanent 1400-point buffer.
    if (absorbs.scope === "np" && !options.has("attack:kind:np")) continue;

    const owner = game.actors.get(instance.sourceUnitId);
    const item = owner?.items?.find((i) => i.system?.shield);
    if (!item) continue;

    return { item, def, owner: { id: owner.id, health: owner.system?.health?.value ?? 0 } };
  }
  return null;
}

/**
 * Refresh a barrier's pool for a new use.
 *
 * *"Every time Rho Aias is used after its first usage, its Health is restored
 * by half of its current Health."* Half of what is LEFT, not back to the
 * maximum, so it decays across a match: 1400, then 700 + 350, then less. A
 * refill to full would leave the cooldown as the only limit on it, and the
 * sheet is explicit that it is not.
 *
 * @param {object} item the ability Item
 * @returns {Promise<number>} the pool it now holds
 */
export async function refreshShield(item) {
  const spec = item.system?.shield ?? null;
  if (!spec) return 0;

  const first = (item.system?.timesUsed ?? 0) < 1;
  if (first) {
    // The first projection is the authored maximum; nothing to restore.
    const full = spec.health ?? 0;
    if ((item.system?.shieldHealth ?? null) !== full) await item.update({ "system.shieldHealth": full });
    return full;
  }

  // "Full" is the default a barrier with no decay clause needs: Scales of the
  // Sacred Fish's Shield(200) is a fresh 200 on every cast, not Rho Aias's
  // "restored by half of its CURRENT Health" -- without an explicit case here
  // it fell through to whatever was left over from the pool's last use, which
  // for a short-lived reactive Shield is usually a stale, mostly-spent number
  // rather than the 200 the sheet promises.
  if (spec.refresh?.kind === "halfOfCurrent") {
    const current = item.system?.shieldHealth ?? 0;
    const next = Math.min(spec.health ?? current, current + Math.floor(current / 2));
    await item.update({ "system.shieldHealth": next });
    return next;
  }

  const full = spec.health ?? 0;
  if ((item.system?.shieldHealth ?? null) !== full) await item.update({ "system.shieldHealth": full });
  return full;
}
