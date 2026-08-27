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
  // HERE rather than in `applyWorldIntents`, because three call sites write to
  // the world without going through that helper -- the attack flow, the
  // scheduler's boundary sequences and the movement hook -- and putting the
  // step in one of them would leave the other two applying bare effect intents.
  // That is the same "two implementations of one rule" defect this file's own
  // header warns about.
  const plan = planApplication(await resolveEffects(intents), { canWrite, isGM });
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
 * Put every unresolved `applyEffect` through the effect flow first.
 *
 * `io.createEffects` is a bare create: it makes a document and asks nothing.
 * That is right for an intent produced by `effect-applier.applyEffect`, which
 * has already run immunity, exclusivity, the chance roll and the stacking rule
 * — and wrong for one produced anywhere else.
 *
 * The scheduler's `ApplyEffect` action emits a bare intent, so **every effect
 * applied by an event handler bypassed all four**: an immune Unit took it, a
 * resisted one took it at full strength, a `blocks` pair could be held
 * together, and a `noneExtend` buff made a second document instead of
 * extending. Found live, twice in one use: EMIYA's Magecraft gave him two
 * separate `Range Up` instances, and his Trace, On could not swap Activated
 * Circuits for Blazing Circuits because the swap is an exclusivity decision
 * nobody was making.
 *
 * @param {Intent[]} intents
 * @returns {Promise<Intent[]>}
 */
async function resolveEffects(intents) {
  const raw = intents.filter((i) => i.t === "applyEffect" && !i.resolved);
  if (raw.length === 0) return intents;
  // No world: this is a unit test applying against an injected `io`, and there
  // is no registry to resolve a definition from. Pass the batch through rather
  // than failing -- the flow is exercised directly by its own tests.
  if (typeof game === "undefined" || !game?.actors) return intents;

  const [{ applyEffect, inflictBonusOf }, { EffectRegistry }, { unitSnapshot }] = await Promise.all([
    import("./effect-applier.mjs"),
    import("../rules/registry.mjs"),
    import("./board.mjs"),
  ]);

  /** @type {Intent[]} */
  const out = [];
  for (const intent of mergeStages(intents)) {
    if (intent.t !== "applyEffect" || intent.resolved) {
      out.push(intent);
      continue;
    }

    const def = EffectRegistry.get(intent.effect?.defId);
    const target = game.actors.get(intent.unitId);
    // Nothing to resolve it against: pass it through rather than dropping it,
    // because a missing definition is a content problem and losing the write
    // would hide it.
    if (!def || !target) {
      out.push(intent);
      continue;
    }

    // The INFLICTER's own contributions. `inflictBonus` reaches
    // `applicationChance` from the attack flow and the skill flow, and this
    // third path -- everything an event handler applies -- passed none, so
    // Serenity's Silent Dance (*"chance of inflicting debuffs is increased by
    // 10%"*) would have been inert against exactly the effects her sheet inflicts
    // through riders.
    const inflicter = intent.effect?.sourceUnitId ?? intent.sourceId ?? null;
    const inflicterDoc = inflicter ? game.actors.get(inflicter) : null;

    const result = applyEffect({
      def,
      target: unitSnapshot(target),
      magnitude: intent.effect.magnitude ?? 0,
      npMagnitude: intent.effect.npMagnitude ?? null,
      // An ability's stated chance beats the definition's `baseChance`. Carried
      // on the instance because that is the only thing an intent has room for.
      chance: intent.effect.chance ?? null,
      stages: intent.effect.stages ?? 1,
      visibility: intent.effect.visibility ?? "public",
      attributionHidden: Boolean(intent.effect.attributionHidden),
      // The effect's own `sourceUnitId` FIRST. The scheduler's `ApplyEffect`
      // action passes the handler's *ability* id as the intent's `sourceId`, so
      // reading that as the inflicter stamped an ability id into a field every
      // reader treats as a Unit -- and Secret Poison's disclosure, which asks
      // "which instances did this Unit inflict", could never match one.
      source: {
        unitId: intent.effect.sourceUnitId ?? intent.sourceId ?? null,
        abilityId: intent.effect.sourceAbilityId ?? null,
      },
      ctx: {
        turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
        currentTick: game.combat?.system?.globalTurn ?? 0,
        roll: (await new Roll("1d100").evaluate()).total,
        inflictBonus: inflicterDoc ? inflictBonusOf(unitSnapshot(inflicterDoc), def) : 0,
        options: new Set(),
      },
    });

    // The expiry was already computed by whoever emitted the intent, and it
    // knows the duration this application was authored with; the flow recomputes
    // from the definition's default, which is not the same thing.
    out.push(...result.intents.map((i) => (i.t === "applyEffect"
      ? {
        ...i,
        effect: {
          ...i.effect,
          expiry: intent.effect.expiry ?? i.effect.expiry,
          // The SOURCE has to survive the round trip: Secret Poison is
          // disclosed by asking "which instances did this Unit inflict", and an
          // instance that lost its inflicter can never be revealed.
          sourceUnitId: i.effect.sourceUnitId ?? intent.effect.sourceUnitId ?? intent.sourceId ?? null,
        },
      }
      : i)));
  }
  return out;
}

/**
 * Collapse repeated applications of the same STAGED effect in one batch.
 *
 * A staged effect resolves its new stage against what the target is already
 * carrying, and nothing in a batch has been written yet — so two applications
 * of Poison in the same breath both see an unpoisoned Unit, both resolve to
 * "create at stage 1", and the Unit ends up with two Poison documents instead
 * of one at stage 2.
 *
 * Serenity is where that happens routinely: her Projectile inflicts Poison on
 * every Normal Attack and her `Macabre` buff inflicts *"an additional Stage"* on
 * a crit, so a critical dagger raises two handlers against one victim.
 *
 * Merged only when the two agree about their **chance**. Two riders at
 * different odds are two separate rolls, and folding them together would make
 * the pair land or miss as one.
 *
 * @param {Intent[]} intents
 * @returns {Intent[]}
 */
function mergeStages(intents) {
  /** @type {Map<string, number>} */
  const at = new Map();
  /** @type {Intent[]} */
  const out = [];

  for (const intent of intents) {
    if (intent.t !== "applyEffect" || intent.resolved || !intent.effect?.defId) {
      out.push(intent);
      continue;
    }
    const key = `${intent.unitId}:${intent.effect.defId}:${intent.effect.chance ?? ""}`;
    const index = at.get(key);
    if (index === undefined) {
      at.set(key, out.length);
      out.push({ ...intent, effect: { ...intent.effect } });
      continue;
    }
    // Fold into the first, by replacement rather than by mutation -- the caller
    // still owns the array it handed us. Only meaningful for a staged
    // definition; for anything else the extra `stages` is ignored by
    // `resolveStacking` and the merge is still right, because a second identical
    // application of a non-staged effect is a refresh, not a second instance.
    const first = out[index];
    out[index] = {
      ...first,
      effect: { ...first.effect, stages: (first.effect.stages ?? 1) + (intent.effect.stages ?? 1) },
    };
  }
  return out;
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
      for (const i of intents) await io.adjustResource(unitId, i.key, i.delta, Boolean(i.absolute));
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
    case "recordAttack":
      for (const i of intents) await io.recordAttack(unitId, i.abilityId, i.identity);
      break;
    case "shieldDelta":
      for (const i of intents) await io.adjustShield(unitId, i.abilityId, i.delta);
      break;
    case "extendEffect":
      for (const i of intents) await io.extendEffect(unitId, i.defId, i.turns);
      break;
    case "recordUse":
      for (const i of intents) await io.recordUse(unitId, i.abilityId, i.contentId);
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
