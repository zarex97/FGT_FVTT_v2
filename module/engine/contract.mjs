/**
 * @file Forming contracts — the draft flow.
 * @see docs/16-relationships.md §16.2
 *
 * Layer 3. `rules/contract.mjs` decides; this rolls and writes.
 *
 * The conquest path is the one that needs care. §16.2 requires the Servants of
 * a killed Master to become Free **and** be contracted to the killer *in one
 * transaction, so no intermediate state is observable*. That is why
 * `onMasterDefeated` and this are sequenced here rather than each hooking the
 * death independently: two listeners would produce exactly the intermediate
 * state the rule forbids, and whichever ran second would win by accident.
 */

import {
  contractPlan, contractOutcome, conquestContract, canAttemptContract,
} from "../rules/contract.mjs";
import { currentBoard } from "./board.mjs";
import { applyWorldIntents } from "./applier.mjs";
import * as I from "./intents.mjs";

/**
 * What contracting this Servant would take, without doing it.
 *
 * @param {object} args
 * @param {string} args.contractorId
 * @param {string} args.servantId
 * @returns {object}
 */
export function planContract({ contractorId, servantId }) {
  const board = currentBoard();
  const contractor = board.units.find((u) => u.id === contractorId);
  const servant = board.units.find((u) => u.id === servantId);
  if (!contractor || !servant) return { ok: false, reason: "notFound" };

  return contractPlan(contractor, servant, board);
}

/**
 * Attempt the contract: roll what the plan asks for, then apply.
 *
 * Every roll is made and **all** are kept, even once one has failed. The
 * arithmetic does not need them — one failure decides it — but the log does:
 * "Kiritsugu resisted 4, 2, 6, 1" is a record a player can check, and stopping
 * at the first failure would make an Independent Action A look identical to an
 * ordinary Servant in the audit trail.
 *
 * @param {object} args
 * @param {string} args.contractorId
 * @param {string} args.servantId
 * @returns {Promise<{ok: boolean, success?: boolean, reason?: string, rolls?: number[]}>}
 */
export async function attemptContract({ contractorId, servantId }) {
  const plan = planContract({ contractorId, servantId });
  if (!plan.ok) return { ok: false, reason: plan.reason };

  /** @type {number[]} */
  const rolls = [];
  for (let k = 0; k < plan.rolls; k++) {
    rolls.push((await new Roll(plan.formula).evaluate()).total);
  }

  const outcome = contractOutcome(plan, rolls);
  const intents = [
    ...toIntents(outcome.descriptors),
    I.log({
      kind: "contract", event: outcome.success ? "contractFormed" : "contractFailed",
      contractorId, servantId, rolls, required: plan.rolls, succeedsOn: plan.succeedsOn,
    }),
  ];

  await applyWorldIntents(intents, `contract:${servantId}`);
  return { ok: true, success: outcome.success, reason: outcome.reason, rolls };
}

/**
 * The automatic contract that follows a Master's death (§16.2).
 *
 * Called from the defeat path **after** `onMasterDefeated` has decided what
 * happens to the Servants, and applied in the same batch, so the Free state the
 * rules describe is never written on its own.
 *
 * @param {object} args
 * @param {string} args.killerId
 * @param {string} args.deadMasterId
 * @returns {Promise<object[]>} intents to fold into the caller's batch
 */
export function conquestIntents({ killerId, deadMasterId }) {
  const board = currentBoard();
  const killer = board.units.find((u) => u.id === killerId);
  const deadMaster = board.units.find((u) => u.id === deadMasterId);
  if (!killer || !deadMaster) return [];

  const out = conquestContract({ killer, deadMaster, board });
  if (!out.ok) {
    // A lone Servant killing a Master creates a Free Servant nobody claims.
    // Logged, because the *absence* of a contract here is a rule rather than an
    // oversight and a player will otherwise assume the system missed it.
    return [I.log({
      kind: "contract", event: "conquestDeclined",
      killerId, deadMasterId, reason: out.reason,
    })];
  }
  return toIntents(out.descriptors);
}

/**
 * Every Servant this contractor could reach right now, for the dialog.
 *
 * @param {string} contractorId
 * @returns {object[]}
 */
export function contractCandidates(contractorId) {
  const board = currentBoard();
  const contractor = board.units.find((u) => u.id === contractorId);
  if (!contractor) return [];

  return board.units
    .filter((u) => u.kind === "servant" && u.id !== contractorId)
    .map((servant) => {
      const legal = canAttemptContract(contractor, servant, board);
      const plan = legal.ok ? contractPlan(contractor, servant, board) : legal;
      return {
        id: servant.id,
        name: game.actors.get(servant.id)?.name ?? servant.id,
        contract: servant.contract,
        // Offered even when refused, with the reason: "why can I not contract
        // that one" is the question the dialog exists to answer, and hiding the
        // row answers it with silence.
        ok: plan.ok,
        reason: plan.reason ?? null,
        automatic: Boolean(plan.automatic),
        rolls: plan.rolls ?? 0,
        succeedsOn: plan.succeedsOn ?? [],
      };
    });
}

/* -------------------------------------------------------------------------- */

/**
 * @param {object[]} descriptors
 * @returns {object[]}
 */
function toIntents(descriptors) {
  /** @type {object[]} */
  const out = [];
  for (const d of descriptors ?? []) {
    switch (d.kind) {
      case "setContract":
        out.push(I.markContract(d.unitId, d.contract, d.masterId ?? null));
        break;
      case "grantCommandSpells":
        out.push(I.grantCommandSpells(d.masterId, d.servantId, d.count));
        break;
      case "log":
        out.push(I.log(d));
        break;
      default:
        console.warn(`FGT | Contract descriptor "${d.kind}" has no intent; it did nothing.`);
    }
  }
  return out;
}
