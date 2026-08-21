/**
 * @file The only place in the system that writes documents.
 * @see docs/03-domain-overview.md §3.4, docs/26-authority-and-sockets.md
 *
 * Layer 3. Split deliberately in two:
 *
 *   - {@link planApplication} is **pure**: it decides which intents this client
 *     may write and which must be proxied to the GM. That decision is where the
 *     permission bugs live, so it is unit-tested without a world.
 *   - {@link applyIntents} is the thin async shell that performs the writes.
 *
 * A batch applies atomically from the caller's perspective: intents are
 * validated first, and a validation failure aborts the whole batch rather than
 * leaving half a Noble Phantasm applied.
 */

import * as I from "./intents.mjs";

/**
 * @typedef {object} ApplicationPlan
 * @property {Intent[]} local intents this client may write directly
 * @property {Intent[]} remote intents that must go through the GM proxy
 * @property {Intent[]} prompts intents that ask a human
 * @property {string[]} problems validation failures; non-empty aborts the batch
 */

/**
 * Decide how a batch will be applied, without applying it.
 *
 * @param {Intent[]} intents
 * @param {object} args
 * @param {(unitId: string) => boolean} args.canWrite does this client own the target?
 * @param {boolean} [args.isGM] a GM writes everything locally
 * @returns {ApplicationPlan}
 */
export function planApplication(intents, { canWrite, isGM = false }) {
  const problems = I.validate(intents);
  if (problems.length > 0) return { local: [], remote: [], prompts: [], problems };

  /** @type {Intent[]} */ const local = [];
  /** @type {Intent[]} */ const remote = [];
  /** @type {Intent[]} */ const prompts = [];

  for (const intent of I.order(intents)) {
    if (intent.t === "prompt") {
      prompts.push(intent);
      continue;
    }
    // Log entries are written by whoever produced them; they carry no
    // authority and duplicating one is harmless, whereas dropping one loses
    // audit history.
    if (intent.t === "log" || isGM) {
      local.push(intent);
      continue;
    }
    const unitId = intent.unitId ?? intent.masterId;
    (canWrite(unitId) ? local : remote).push(intent);
  }

  return { local, remote, prompts, problems: [] };
}

/**
 * Apply a batch.
 *
 * @param {Intent[]} intents
 * @param {object} args
 * @param {object} args.io the write adapter — injected so this is testable
 * @param {(unitId: string) => boolean} args.canWrite
 * @param {boolean} [args.isGM]
 * @param {string} [args.source] for the audit trail
 * @returns {Promise<{applied: number, proxied: number, prompted: number}>}
 */
export async function applyIntents(intents, { io, canWrite, isGM = false, source = "unknown" }) {
  const plan = planApplication(intents, { canWrite, isGM });
  if (plan.problems.length > 0) {
    throw new Error(
      `FGT | Refusing to apply a malformed intent batch from ${source}:\n  ${plan.problems.join("\n  ")}`,
    );
  }

  for (const group of I.batch(plan.local)) {
    await writeGroup(group, io);
  }
  if (plan.remote.length > 0) await io.proxy(plan.remote, { source });
  for (const p of plan.prompts) await io.prompt(p.userId, p.prompt);

  return { applied: plan.local.length, proxied: plan.remote.length, prompted: plan.prompts.length };
}

/**
 * Apply a batch against the live world.
 *
 * The `{ io, canWrite, isGM }` triple was written out by hand at every call
 * site, and four of them got it wrong — passing `worldIO()` positionally, so
 * `canWrite` came out `undefined` and the first write threw. One helper, so
 * there is one place to get it right.
 *
 * @param {Intent[]} intents
 * @param {string} source for the audit trail
 * @returns {Promise<{applied: number, proxied: number, prompted: number}>}
 */
export async function applyWorldIntents(intents, source) {
  // Imported lazily to keep applier → io → socket → operations → applier from
  // being a static cycle; `net/operations.mjs` breaks the same loop the same
  // way.
  const { worldIO } = await import("./io.mjs");
  return applyIntents(intents, {
    io: worldIO(),
    canWrite: (unitId) => game.actors.get(unitId)?.isOwner ?? false,
    isGM: game.user.isGM,
    source,
  });
}

/**
 * Perform one batched group of same-type, same-unit writes.
 *
 * Grouping matters: every `applyEffect` on one actor becomes a single
 * `createEmbeddedDocuments` call rather than N round trips, which is the
 * difference between a Noble Phantasm resolving in one frame and in twenty.
 *
 * @param {{t: string, unitId: string|null, intents: Intent[]}} group
 * @param {object} io
 * @returns {Promise<void>}
 */
async function writeGroup(group, io) {
  const { t, unitId, intents } = group;
  switch (t) {
    case "damage":
      await io.adjustHealth(unitId, -sum(intents, "amount"), { intents });
      break;
    case "heal":
      await io.adjustHealth(unitId, sum(intents, "amount"), { intents });
      break;
    case "statDelta":
      for (const i of intents) await io.adjustStat(unitId, i.stat, i.delta, i.clamp);
      break;
    case "resource":
      for (const i of intents) await io.adjustResource(unitId, i.key, i.delta);
      break;
    case "applyEffect":
      await io.createEffects(unitId, intents.map((i) => i.effect), intents[0].sourceId);
      break;
    case "removeEffect":
      await io.deleteEffects(unitId, intents.map((i) => i.effectId), intents[0].reason);
      break;
    case "consumeUse":
      for (const i of intents) await io.consumeUse(unitId, i.defId, i.count);
      break;
    case "setMode":
      for (const i of intents) await io.setMode(unitId, i.abilityId, i.active);
      break;
    case "cooldown":
      for (const i of intents) await io.setCooldown(unitId, i.abilityId, i.ticks, i.mode);
      break;
    case "move":
      for (const i of intents) await io.move(unitId, i.path, i.forced);
      break;
    case "setFacing":
      await io.setFacing(unitId, intents.at(-1).facing);
      break;
    case "spendCS":
      // The Servant travels with the intent, because §16.9's pools are keyed by
      // it -- without it the writer cannot tell which pool to draw from.
      await io.spendCommandSpells(
        unitId, sum(intents, "count"), intents[0].command, intents[0].servantId ?? null,
      );
      break;
    case "markTurn":
      await io.markTurn(unitId, Object.assign({}, ...intents.map((i) => i.patch)));
      break;
    case "defeat":
      await io.defeat(unitId, intents[0].cause);
      break;
    case "itemQuantity":
      for (const i of intents) await io.adjustItemQuantity(unitId, i.itemId, i.delta);
      break;
    case "itemGrant":
      for (const i of intents) await io.grantItem(unitId, i.contentId, i.delta);
      break;
    case "markContract":
      await io.setContract(unitId, intents.at(-1).contract, intents.at(-1).masterId);
      break;
    case "grantCommandSpells":
      for (const i of intents) await io.grantCommandSpells(i.masterId, i.servantId, i.count);
      break;
    case "log":
      await io.log(intents.map((i) => i.entry));
      break;
    default:
      throw new RangeError(`FGT | No writer for intent type "${t}".`);
  }
}

/**
 * @param {Intent[]} intents
 * @param {string} field
 * @returns {number}
 */
function sum(intents, field) {
  return intents.reduce((acc, i) => acc + (i[field] ?? 0), 0);
}
