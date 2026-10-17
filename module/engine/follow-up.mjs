/**
 * @file An additional Normal Attack after an Attack: Bab-ilu's passive.
 * @see docs/21-combat-process.md
 *
 * Layer 3. *"Whenever Proto Gil Attacks an enemy Unit at a Range of 2 or
 * higher, he can Move to any panel that is directly next to the DU and perform
 * an additional Normal Attack on that DU; if the DU Blocked the first Attack,
 * it also has to Block the second Attack, while if the DU successfully Evaded
 * the first Attack, it has a choice to Block or Evade the second Attack."*
 * (#232)
 *
 * Ruled: any single-target Attack of his sets it off (reading 1); the Move is
 * his to take or not, and the Normal Attack happens either way (2); neither
 * costs anything, and the additional Attack never sets it off again (3). A DU
 * that Blocked must Block: no Evade and no taking the hit, though a reaction
 * NP and a Counter still work; one that Evaded chooses Block or Evade; one that
 * took the hit or failed its Evade chooses freely (24).
 *
 * Offered once the first Attack's last Process has closed, from
 * `engine/attack.mjs#closeRung`, before its Combat Phase ends. GM-only, as the
 * automatic counter is: this declares an Attack on somebody's behalf. The
 * offer is claimed in memory before anything awaits (the check-then-act lesson):
 * two clients closing the same rung must not offer it twice.
 */

import { currentBoard, unitOf } from "./board.mjs";
import { displaceToken } from "./io.mjs";
import { chooseFor } from "./ask.mjs";
import * as process from "./combat-process.mjs";
import { test as testPredicate } from "../rules/predicate.mjs";
import { relationOf } from "../rules/relations.mjs";
import { canStopOn } from "../rules/movement.mjs";
import { shownName, publicSpeakerFor } from "./public-identity.mjs";
import { chebyshev, inBounds } from "../domain/geometry.mjs";

/** Groups whose follow-up has been offered, claimed before any await. */
const claimed = new Set();

/**
 * The reactions the second Attack forbids, from how the DU answered the first.
 *
 * @param {object} first the first Attack's Process state
 * @returns {string[]}
 */
export function lockedReactions(first) {
  if (first?.reaction === "block") return ["evade", "nothing"];
  if (first?.reaction === "evade" && first?.evaded) return ["nothing"];
  return [];
}

/**
 * Offer the additional Normal Attack a finished Attack earns, if it earns one.
 *
 * @param {object} state the Process that just closed
 * @param {object} deps `rollOptions(attacker, defender, state)` and `resolveAttack`, from `attack.mjs`
 * @returns {Promise<object|null>} the declaration, or null
 */
export async function offerFollowUp(state, { rollOptions, resolveAttack }) {
  if (!game.user?.isGM) return null;
  if (!state?.attackerId || !state?.defenderId || state.attack?.followUp) return null;

  const attackerDoc = game.actors.get(state.attackerId);
  const defenderDoc = game.actors.get(state.defenderId);
  if (!attackerDoc || !defenderDoc) return null;
  // Asked of the documents before a board is built: this runs as every Process
  // in the game closes, and almost no attacker carries the rule.
  if (!carriesFollowUp(attackerDoc)) return null;
  const board = currentBoard();
  const attacker = unitOf(attackerDoc, board);
  const followUps = attacker?.followUps ?? [];
  if (followUps.length === 0) return null;

  // The whole Attack, not one of its Processes: a single DU, every Process of
  // this attacker's in the group closed. An area Attack names no one DU.
  const mine = siblingStates(state).filter((s) => s.attackerId === state.attackerId && Boolean(s.isCounter) === Boolean(state.isCounter));
  if (mine.some((s) => !process.isComplete(s))) return null;
  if (new Set(mine.map((s) => s.defenderId)).size > 1) return null;
  // An AREA Attack is not a single-target one because it caught one Unit: the
  // ability's own shape says which it is (reading 1). Bab-ilu's 3x3 over a
  // lone DU offered the second swing until the arena test caught it.
  const used = state.attack?.abilityId ? attackerDoc.items.get(state.attack.abilityId) : null;
  const shape = used?.system?.targeting?.shape?.kind ?? "unit";
  if (shape !== "unit") return null;

  const key = `${state.groupId ?? state.attackerId}|${state.attackerId}`;
  if (claimed.has(key)) return null;
  claimed.add(key);
  setTimeout(() => claimed.delete(key), 120_000);

  const defender = unitOf(defenderDoc, board);
  if (!defender || defender.defeated || (defender.health ?? 0) <= 0) return null;
  if (relationOf(attacker, defender, board) !== "enemy") return null;
  const options = rollOptions(attacker, defender, state);
  const spec = followUps.find((f) => !f.predicate || testPredicate(f.predicate, { options }));
  if (!spec) return null;

  // Where he may land: any panel directly next to the DU he could stand on, or
  // where he stands, if he is beside it already.
  const panels = spec.move === "adjacent" ? besideFree(defender, attacker, board) : [];
  // PUBLIC names, on the offer and on the card: a concealed DU is its class to
  // the table, and the card under this one says so (#232, found live).
  const shown = shownName(defenderDoc, board);
  const stay = { id: "stay", name: game.i18n.format("FGT.FollowUp.Stay", { target: shown }) };
  const picked = await chooseFor(attackerDoc, {
    title: game.i18n.format("FGT.FollowUp.Title", { name: spec.source }),
    hint: game.i18n.format("FGT.FollowUp.Hint", { target: shown }),
    count: 1,
    min: 0,
    options: [
      stay,
      ...panels.map((p) => ({
        id: `${p.i},${p.j}`,
        name: game.i18n.format("FGT.FollowUp.MoveTo", { row: p.i + 1, col: p.j + 1, target: shown }),
      })),
    ],
  });
  const choice = (picked ?? [])[0] ?? null;
  if (!choice) return null;

  if (choice !== "stay") {
    const [i, j] = choice.split(",").map(Number);
    const token = attackerDoc.getActiveTokens?.()[0]?.document;
    const size = canvas?.scene?.grid?.size ?? 100;
    if (token) await displaceToken(token, { x: j * size, y: i * size });
  }

  const forbid = spec.lockReaction ? lockedReactions(mine.at(-1) ?? state) : [];
  await ChatMessage.create({
    content: `<p>${game.i18n.format("FGT.FollowUp.Declared", {
      name: spec.source, unit: shownName(attackerDoc, board), target: shown,
    })}</p>`,
    speaker: publicSpeakerFor(attackerDoc, board),
  });
  return resolveAttack({
    attackerId: attackerDoc.id,
    abilityId: null,
    placement: { unitId: defenderDoc.id, followUp: true, forbidReactions: forbid },
    // Paid already: it costs nothing (reading 3), so the budget, the price and
    // the start-of-Phase windows of a fresh declaration are all skipped.
    resume: true,
  });
}

/**
 * Whether any of this actor's abilities or effects authors a `FollowUpAttack`.
 *
 * @param {object} actor
 * @returns {boolean}
 */
function carriesFollowUp(actor) {
  const has = (sys) => [...(sys?.rules ?? []), ...(sys?.passiveRules ?? []), ...(sys?.activeRules ?? [])]
    .some((r) => r?.key === "FollowUpAttack");
  return [...(actor.items ?? [])].some((i) => has(i.system)) || [...(actor.effects ?? [])].some((e) => has(e.system));
}

/**
 * Every Process of this one's Combat Phase, read back off the chat log.
 *
 * @param {object} state
 * @returns {object[]}
 */
function siblingStates(state) {
  if (!state.groupId) return [state];
  const out = [];
  for (const m of game.messages ?? []) {
    const raw = m.getFlag("fgt", "process");
    if (!raw) continue;
    try {
      const s = process.deserialize(raw);
      if (s.groupId === state.groupId) out.push(s);
    } catch { /* not a Process */ }
  }
  return out.length > 0 ? out : [state];
}

/**
 * The panels directly next to the DU this Unit could stop on.
 *
 * @param {object} defender
 * @param {object} mover
 * @param {object} board
 * @returns {Array<{i: number, j: number}>}
 */
function besideFree(defender, mover, board) {
  const footprint = defender.panels ?? (defender.panel ? [defender.panel] : []);
  const seen = new Set();
  const out = [];
  for (const p of footprint) {
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        const panel = { i: p.i + di, j: p.j + dj };
        const k = `${panel.i},${panel.j}`;
        if (seen.has(k)) continue;
        seen.add(k);
        if (footprint.some((f) => f.i === panel.i && f.j === panel.j)) continue;
        if (mover.panel && mover.panel.i === panel.i && mover.panel.j === panel.j) continue;
        if (!footprint.some((f) => chebyshev(f, panel) === 1)) continue;
        if (!inBounds(panel, board.bounds ?? null)) continue;
        if (canStopOn(panel, mover, board)) out.push(panel);
      }
    }
  }
  return out;
}
