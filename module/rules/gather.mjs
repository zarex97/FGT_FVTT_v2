/**
 * @file Gather: who may perform it, for whose pool, and for how much (#298).
 * @see docs/19-action-economy.md, module/engine/gather.mjs
 *
 * Layer 2 (rules). Pure. The ONE reader of a Gather, asked by the bar's offer
 * (`rules/actions.mjs`) and by the press (`engine/gather.mjs`) alike, so the
 * button never offers what the press would refuse.
 *
 * A Gather is authored on the Servant whose pool it feeds, as `gather`:
 *
 *   - Semiramis: *"Semiramis or any allied Unit can perform 'Gather' during its
 *     Turn, which increases Construction by 3. However, if Semiramis uses it,
 *     Construction is increased by 5, while it is increased by 4 if her Master
 *     uses it."* -- `{resource: hgobConstruction, by: {self: 5, master: 4, ally:
 *     3}, regionScaled: middleEast}`.
 *   - Avicebron: *"During your Turn, Avicebron and/or his Master can perform
 *     'Gather', which increases Construction by 2 per Unit."* -- `{resource:
 *     construction, by: {self: 2, master: 2}}` (#394).
 *
 * A role the spec does not name may not Gather for that pool. It was written in
 * code for Semiramis alone (`engine/gather.mjs`), so nobody else could have one.
 */

import { relationOf } from "./relations.mjs";

/**
 * The role a Unit holds toward a pool's owner, as a Gather names roles.
 *
 * The Master by contract (`masterId`), never by kind (Role keyed on type).
 *
 * @param {object} unit the Unit that would Gather
 * @param {object} owner the Servant whose pool it would feed
 * @param {object} board
 * @returns {"self"|"master"|"ally"|null}
 */
export function gatherRole(unit, owner, board) {
  if (!unit || !owner) return null;
  if (unit.id === owner.id) return "self";
  if (owner.masterId && unit.id === owner.masterId) return "master";
  return relationOf(owner, unit, board) === "ally" ? "ally" : null;
}

/**
 * Every pool this Unit may Gather for now, and what each would gain.
 *
 * `full` marks a pool already at its maximum: the gain is lost there (#394
 * ruling 13), so the press refuses it and says so (ruling 12a).
 *
 * @param {object} unit
 * @param {object} board
 * @returns {Array<{ownerId: string, resource: string, amount: number, regionScaled: string|null,
 *   value: number, max: number|null, full: boolean}>}
 */
export function gatherOffers(unit, board) {
  /** @type {ReturnType<typeof gatherOffers>} */
  const out = [];
  for (const owner of board?.units ?? []) {
    const spec = owner?.gather;
    if (!spec?.resource || owner.defeated) continue;
    const role = gatherRole(unit, owner, board);
    const amount = role ? spec.by?.[role] : undefined;
    if (typeof amount !== "number") continue;
    const pool = owner.resources?.[spec.resource] ?? {};
    const value = Number(pool.value ?? 0);
    const max = typeof pool.max === "number" ? pool.max : null;
    out.push({
      ownerId: owner.id, resource: spec.resource, amount,
      regionScaled: spec.regionScaled ?? null,
      value, max, full: max !== null && value >= max,
    });
  }
  return out;
}
