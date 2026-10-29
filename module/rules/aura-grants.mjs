/**
 * @file Which effects an aura GRANTS, and to whom: the plan its sync writes.
 * @see module/engine/aura-grants.mjs, docs/12-invalidation-and-auras.md
 *
 * Layer 2 (rules). Pure.
 *
 * Most auras are modifiers a recipient reads off the board (`rules/auras.mjs`).
 * Some clauses are not: Karl de Große's Ceremonial Reformation raises Max
 * Health, Agility and Luck, which its recipient's own document must hold, since
 * its heal, its bar and its Checks read them there (#351 readings 6, 7). Such an
 * aura names an effect (`grantsEffect`) its recipients hold while it reaches
 * them; this decides who should hold one and who should not, and
 * `engine/aura-grants.mjs` writes the difference.
 */

import { relationOf } from "./relations.mjs";

/** The Units an aura may grant to: no platform, structure or Civilian. */
const RECIPIENT_KINDS = Object.freeze(["servant", "master", "summon"]);

/**
 * @param {object} board the War's board
 * @returns {{add: Array<{unitId: string, effectId: string, sourceId: string}>,
 *   remove: Array<{unitId: string, instanceId: string, effectId: string}>}}
 */
export function auraGrantPlan(board) {
  const units = board?.units ?? [];
  /** @type {Map<string, string>} `${unitId}|${effectId}` → the granting Unit */
  const want = new Map();
  for (const source of units) {
    // *"As long as he is on the board"*: alive and on it (reading 6).
    if (source.defeated || !source.panel) continue;
    for (const aura of source.auras ?? []) {
      if (!aura?.grantsEffect) continue;
      for (const u of units) {
        if (u.defeated || !u.panel || !RECIPIENT_KINDS.includes(u.kind)) continue;
        if (!(aura.relations ?? ["ally", "self"]).includes(relationOf(source, u, board))) continue;
        if (aura.scope !== "field" && chebyshev(source.panel, u.panel) > (aura.radius ?? 0)) continue;
        const key = `${u.id}|${aura.grantsEffect}`;
        if (!want.has(key)) want.set(key, source.id);
      }
    }
  }

  const remove = [];
  for (const u of units) {
    if (u.defeated) continue;
    for (const e of u.effectInstances ?? []) {
      const by = e.params?.auraGrant;
      if (!by) continue;
      const key = `${u.id}|${e.defId}`;
      if (want.get(key) === by) want.delete(key);
      else remove.push({ unitId: u.id, instanceId: e.id, effectId: e.defId });
    }
  }
  const add = [...want].map(([key, sourceId]) => {
    const [unitId, effectId] = key.split("|");
    return { unitId, effectId, sourceId };
  });
  return { add, remove };
}

/**
 * @param {{i: number, j: number}} a
 * @param {{i: number, j: number}} b
 * @returns {number}
 */
function chebyshev(a, b) {
  return Math.max(Math.abs(a.i - b.i), Math.abs(a.j - b.j));
}
