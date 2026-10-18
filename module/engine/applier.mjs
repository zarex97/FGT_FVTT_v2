/**
 * @file The only place in the system that applies an intent.
 * @see docs/02-architecture.md, docs/38-authority.md
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
import { acquisitionTarget } from "../rules/items.mjs";
import { currentBoard, currentMoment, unitActor } from "./board.mjs";

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
 * @param {object|null} [args.process] the Combat Process this batch belongs to,
 *   which offers its debuffs' targets the Prevention Luck Check
 * @param {object[]|null} [args.sink] where the batch's {@link CardLine}s go, for
 *   a caller that will print them; one is made when none is given
 * @param {boolean} [args.lines] also say what this batch's OWN clocks and stage
 *   removals did. A caller whose batch is a handler's says it; one whose batch is
 *   its own phase already prints its clocks (#202)
 * @returns {Promise<{applied: number, proxied: number, prompted: number, lines: CardLine[]}>}
 */
export async function applyIntents(intents, {
  io, canWrite, isGM = false, source = "unknown", moment = null, process = null, sink = null, lines = false,
}) {
  // What the batch did that its caller did not decide, for a card (#202): an
  // effect a handler landed, a clock a handler turned, a stage a handler took.
  // Riders and a Skill's own phases land through the door themselves and print
  // their own rows; these went through this function and printed nowhere.
  const said = sink ?? [];
  const clocks = lines ? clocksBeforeBatch(intents) : [];
  const stats = lines ? statsBeforeBatch(intents) : [];
  const spans = lines ? spansBeforeBatch(intents) : [];
  const held = lines ? itemsBeforeBatch(intents) : [];
  // HERE rather than in `applyWorldIntents`, because three call sites write to
  // the world without going through that helper -- the attack flow, the
  // scheduler's boundary sequences and the movement hook -- and putting the
  // step in one of them would leave the other two applying bare effect intents.
  // That is the same "two implementations of one rule" defect this file's own
  // header warns about.
  const plan = planApplication(
    await resolveHealing(await resolveElements(await resolveEffects(await resolveRemovals(intents), { process, sink: said }))),
    { canWrite, isGM },
  );
  if (plan.problems.length > 0) {
    throw new Error(
      `FGT | Refusing to apply a malformed intent batch from ${source}:\n  ${plan.problems.join("\n  ")}`,
    );
  }

  for (const group of I.batch(plan.local)) {
    await writeGroup(group, io, { moment, sink: said, lines });
  }

  // Who has just been debuffed, and by whom.
  //
  // Read HERE because this is the one place every debuff in the game converges,
  // whatever declared it -- an attack's rider, a Skill's phase, a field's
  // interior rule, a periodic tick. Mannanán's `Fragarach` fires *"when she is
  // Attacked **or inflicted with a debuff**"*, and a trigger that hung off the
  // attack path alone would miss the half the clause exists for: a pure control
  // ability provoking a 2.5× retaliation.
  //
  // Queued, never resolved: a Counter is a full declaration (Ch. 21) and cannot
  // be opened from inside the write path (`engine/auto-counter.mjs`).
  await noteDebuffs(plan.local);
  // *"If Drake is inflicted with NP Seal, Golden Hind is immediately
  // deactivated."* Hung on the same convergence point the auto-counter uses,
  // because it is the one place every effect application path meets -- four
  // separate hooks would have been four chances to miss one.
  await notePlatformDeactivations(plan.local);
  if (plan.remote.length > 0) await io.proxy(plan.remote, { source });
  for (const p of plan.prompts) await io.prompt(p.userId, p.prompt);

  said.push(...clockLines(clocks), ...statLines(stats), ...await spanLines(spans), ...itemLines(held), ...suppressionLines(lines ? plan.local : []));
  return { applied: plan.local.length, proxied: plan.remote.length, prompted: plan.prompts.length, lines: said };
}

/**
 * One line a card prints for something a batch did: the shape a rider's row
 * has, so `effectLine` and a Skill card's filter read it unchanged.
 *
 * @typedef {object} CardLine
 * @property {string} unitId whose it is, so the card shows it to that Unit's controllers
 * @property {{id: string, name: string, outcome: string, reason: string|null, chance: *}} summary
 */

/**
 * A clock's line, `Name: Cooldown 18 → 15`, or `null` when it did not move.
 *
 * @param {string|null} name
 * @param {number} before
 * @param {number} after
 * @returns {string|null}
 */
export function cooldownLine(name, before, after) {
  if (!name || !Number.isFinite(before) || !Number.isFinite(after) || before === after) return null;
  return `${name}: Cooldown ${before} → ${after}`;
}

/**
 * A stat change as a card prints it: `Agility 19 → 18`, or the authored delta
 * when the numbers were not read.
 *
 * @param {object} intent a `statDelta` or `resource` intent
 * @param {number|null} [before] the stat as read before the change
 * @param {number|null} [after] the stat as read after it
 * @returns {string|null}
 */
export function statChangeLine(intent, before = null, after = null) {
  const key = intent?.stat ?? intent?.key ?? null;
  const delta = Number(intent?.delta);
  if (!key || !Number.isFinite(delta) || delta === 0) return null;
  const [word, part] = String(key).split(".");
  const label = word.charAt(0).toUpperCase() + word.slice(1) + (part === "max" ? " max" : "");
  // The numbers when the caller read them, so a clamp says so; the authored
  // delta otherwise.
  if (Number.isFinite(before) && Number.isFinite(after)) {
    return before === after ? `${label} ${after} (no change)` : `${label} ${before} → ${after}`;
  }
  return `${label} ${delta > 0 ? "+" : ""}${delta}`;
}

/**
 * The stats a batch's `statDelta` intents move, read before it is written: Def
 * Dwn (C)'s Agility −1 on the Unit it was hit on (#202).
 *
 * @param {Intent[]} intents
 * @returns {Array<{intent: Intent, before: number|null}>}
 */
function statsBeforeBatch(intents) {
  if (typeof game === "undefined" || !game?.actors) return [];
  return (intents ?? []).filter((i) => i?.t === "statDelta" && i.unitId && i.stat)
    .map((intent) => ({ intent, before: statOf(intent.unitId, intent.stat) }));
}

/** @param {string} unitId @param {string} stat @returns {number|null} */
function statOf(unitId, stat) {
  const n = Number(foundry.utils.getProperty(unitActor(unitId)?.system ?? {}, stat));
  return Number.isFinite(n) ? n : null;
}

/**
 * Each stat a handler moved, as a card line, read after the writes.
 *
 * @param {Array<{intent: Intent, before: number|null}>} stats
 * @returns {CardLine[]}
 */
function statLines(stats) {
  return stats.flatMap(({ intent, before }) => {
    const line = statChangeLine(intent, before, statOf(intent.unitId, intent.stat));
    return line ? [{ unitId: intent.unitId, summary: { id: "statChange", name: line, outcome: "applied", reason: null, chance: null } }] : [];
  });
}

/**
 * The effects a batch's `extendEffect` intents name, with their expiry before.
 *
 * Magecraft's *"extend the duration of the 'Suppression' buff by 1◈"* moved a
 * clock no card showed (#243, live): a handler's extension is news too.
 *
 * @param {Intent[]} intents
 * @returns {Array<{unitId: string, defId: string, before: number|null}>}
 */
function spansBeforeBatch(intents) {
  if (typeof game === "undefined" || !game?.actors) return [];
  return (intents ?? []).filter((i) => i?.t === "extendEffect")
    .map((i) => ({ unitId: i.unitId, defId: i.defId, before: expiryOf(i.unitId, i.defId) }));
}

/** @param {string} unitId @param {string} defId @returns {number|null} */
function expiryOf(unitId, defId) {
  const e = unitActor(unitId)?.effects?.find((x) => x.system?.defId === defId);
  return typeof e?.system?.expiry === "number" ? e.system.expiry : null;
}

/**
 * Each effect a handler extended, as a card line: Turns left before and after.
 *
 * @param {Array<{unitId: string, defId: string, before: number|null}>} spans
 * @returns {Promise<CardLine[]>}
 */
async function spanLines(spans) {
  if (spans.length === 0) return [];
  const { EffectRegistry } = await import("../rules/registry.mjs");
  const now = currentMoment().tick ?? 0;
  return spans.flatMap(({ unitId, defId, before }) => {
    const after = expiryOf(unitId, defId);
    if (before === null || after === null || after === before) return [];
    // The effect's name, not its id: the document's own name is the id it was
    // created under, and the card read "suppression: 4 → 7 Turns left" (#243).
    const name = EffectRegistry.get(defId)?.name ?? defId;
    const line = game.i18n.format("FGT.Effect.Extended", { name, before: Math.max(0, before - now), after: Math.max(0, after - now) });
    return [{ unitId, summary: { id: "extendEffect", name: line, outcome: "applied", reason: null, chance: null } }];
  });
}

/**
 * The Items a batch's `itemQuantity` intents name, with how many were held.
 *
 * @param {Intent[]} intents
 * @returns {Array<{unitId: string, itemId: string, name: string|null, before: number}>}
 */
function itemsBeforeBatch(intents) {
  if (typeof game === "undefined" || !game?.actors) return [];
  return (intents ?? []).filter((i) => i?.t === "itemQuantity" && i.unitId && i.itemId).map((i) => {
    const item = heldItem(i.unitId, i.itemId);
    return { unitId: i.unitId, itemId: i.itemId, name: item?.name ?? null, before: quantityOf(item) };
  });
}

/** @param {string} unitId @param {string} itemId a document or content id @returns {object|null} */
function heldItem(unitId, itemId) {
  const items = unitActor(unitId)?.items;
  return items?.get?.(itemId) ?? items?.find?.((x) => x.system?.contentId === itemId) ?? null;
}

/** @param {object|null} item @returns {number} */
function quantityOf(item) {
  if (!item) return 0;
  const n = Number(item.system?.quantity);
  return Number.isFinite(n) ? n : 1;
}

/**
 * Each Item a handler spent, as a card line. The sheet's own words when the
 * language file keys them by the Item (*"the Vorpal Blade breaks"*); the count
 * otherwise. The Blade left Heracles' hands and the card said nothing (#247,
 * live).
 *
 * @param {Array<{unitId: string, itemId: string, name: string|null, before: number}>} held
 * @returns {CardLine[]}
 */
function itemLines(held) {
  return held.flatMap(({ unitId, itemId, name, before }) => {
    const after = quantityOf(heldItem(unitId, itemId));
    if (after === before) return [];
    const item = name ?? itemId;
    const content = heldItem(unitId, itemId)?.system?.contentId ?? itemId;
    const gone = `FGT.Item.Gone.${content}`;
    const line = after === 0 && game.i18n.has?.(gone)
      ? game.i18n.format(gone, { item })
      : game.i18n.format("FGT.Item.Count", { item, before, after });
    return [{ unitId, summary: { id: "itemQuantity", name: line, outcome: "applied", reason: null, chance: null } }];
  });
}

/**
 * Each rule a handler took away for good, as a card line: the lifesteal the
 * Blade removed went with no word (#247, live). Keyed by the rule's slug, so
 * the line is the sheet's words and never the slug.
 *
 * @param {Intent[]} written
 * @returns {CardLine[]}
 */
function suppressionLines(written) {
  return (written ?? []).filter((i) => i?.t === "suppressRule" && i.scope).map((i) => {
    const key = `FGT.Suppressed.${i.scope}`;
    const line = game.i18n.has?.(key) ? game.i18n.localize(key) : game.i18n.localize("FGT.Suppressed.Generic");
    return { unitId: i.unitId, summary: { id: "suppressRule", name: line, outcome: "applied", reason: null, chance: null } };
  });
}

/**
 * The clocks a batch's `cooldown` intents name, read before it is written.
 *
 * @param {Intent[]} intents
 * @returns {Array<{unitId: string, abilityId: string, before: number}>}
 */
function clocksBeforeBatch(intents) {
  if (typeof game === "undefined" || !game?.actors) return [];
  return (intents ?? []).filter((i) => i?.t === "cooldown").map((i) => ({
    unitId: i.unitId, abilityId: i.abilityId, before: remainingOf(i.unitId, i.abilityId),
  }));
}

/** @param {string} unitId @param {string} abilityId @returns {number} */
function remainingOf(unitId, abilityId) {
  return unitActor(unitId)?.items?.get(abilityId)?.system?.cooldown?.remaining ?? 0;
}

/**
 * Each clock that moved, as a card line, read after the writes: what it did,
 * so a cut on a clock at 0 says nothing.
 *
 * @param {Array<{unitId: string, abilityId: string, before: number}>} clocks
 * @returns {CardLine[]}
 */
function clockLines(clocks) {
  return clocks.flatMap((c) => {
    const name = unitActor(c.unitId)?.items?.get(c.abilityId)?.name ?? null;
    const line = cooldownLine(name, c.before, remainingOf(c.unitId, c.abilityId));
    return line ? [{ unitId: c.unitId, summary: { id: "cooldown", name: line, outcome: "applied", reason: null, chance: null } }] : [];
  });
}

/**
 * Queue an automatic counter for every debuff this batch landed.
 *
 * Guarded on `game` rather than on the caller, because `applyIntents` is
 * exercised by unit tests with an injected `io` and no Foundry globals at all.
 * A batch that lands no debuffs costs one array scan.
 *
 * @param {Intent[]} intents the intents that were actually written
 * @returns {Promise<void>}
 */
async function fireWriteEvent(name, unitId, payload, { sink = null } = {}) {
  if (typeof game === "undefined" || !game?.actors) return;
  const { fireEvent } = await import("./scheduler.mjs");
  const { currentBoard } = await import("./board.mjs");
  const board = currentBoard();
  const unit = (board.units ?? []).find((u) => u.id === unitId);
  if (!unit) return;

  const intents = fireEvent(name, [unit], {
    tick: game.combat?.system?.globalTurn ?? 0,
    turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
    board,
    options: new Set(),
    rolls: {},
    // The payload IS the context for a handler that asks about the change
    // rather than about a unit -- see `eventFilterPasses`.
    event: payload,
    // ...and the SUBJECT, for an event that is about an ability: `abilityUsed`
    // raised by a rule (`AbilityUsed`) is heard by `ofCategory` handlers the
    // way one raised by a cast is (`skill-use.mjs#fireAbilityUsed`).
    subject: payload?.subject,
  });
  // A handler's batch: its clocks and stages are news to whoever reads the card
  // of what raised it (#202). Channel Marker Soul's cut on a Curse landing is one.
  if (intents.length > 0) await applyWorldIntents(intents, `event:${name}`, { sink, lines: true });
}

/**
 * A staged effect's removal, as a card line: `Curse: Stage 2 → 1`.
 *
 * @param {string} unitId
 * @param {{defId: string, stageDelta: number, newStage: number}} payload
 * @returns {Promise<CardLine>}
 */
async function stageLine(unitId, payload) {
  const { EffectRegistry } = await import("../rules/registry.mjs");
  const name = EffectRegistry.get(payload.defId)?.name ?? payload.defId;
  const was = payload.newStage - payload.stageDelta;
  return { unitId, summary: { id: payload.defId, name: `${name}: Stage ${was} → ${payload.newStage}`, outcome: "applied", reason: null, chance: null } };
}

/**
 * Switch a platform off when its owner is hit by a named effect.
 */
async function notePlatformDeactivations(intents) {
  if (typeof game === "undefined" || !game?.actors) return;
  const applied = intents.filter((i) => i.t === "applyEffect" && i.effect?.defId);
  if (applied.length === 0) return;

  const { currentBoard } = await import("./board.mjs");
  const { deactivatedBy } = await import("../rules/platforms.mjs");
  const board = currentBoard();
  const platforms = (board.units ?? []).filter((u) => u.kind === "platform");
  if (platforms.length === 0) return;

  const { destroyPlatform } = await import("./platforms.mjs");
  for (const intent of applied) {
    for (const id of deactivatedBy(platforms, intent.unitId, intent.effect.defId)) {
      await destroyPlatform({ platformId: id, reason: "effect" });
    }
  }
}

/**
 * Queue an automatic counter for every debuff this batch landed.
 *
 * Guarded on `game` rather than on the caller, because `applyIntents` is
 * exercised by unit tests with an injected `io` and no Foundry globals at all.
 * A batch that lands no debuffs costs one array scan.
 *
 * @param {Intent[]} intents the intents that were actually written
 * @returns {Promise<void>}
 */
async function noteDebuffs(intents) {
  const { debuffsIn, provoke, isDraining } = await import("./auto-counter.mjs");
  if (isDraining()) return;

  const landed = debuffsIn(intents);
  if (landed.length === 0) return;
  if (typeof game === "undefined" || !game?.actors) return;

  const { currentBoard } = await import("./board.mjs");
  const board = currentBoard();
  for (const { unitId, sourceId } of landed) {
    const bearer = (board.units ?? []).find((u) => u.id === unitId);
    if (!bearer || !(bearer.autoCounters ?? []).length) continue;
    // "On the DU" -- an enemy. A debuff an ally landed (a Bloodmark, a
    // deliberate Decoy) is not a provocation, and answering it would turn a
    // support Skill into friendly fire.
    const provoker = (board.units ?? []).find((u) => u.id === sourceId);
    if (!provoker || (provoker.factionId != null && provoker.factionId === bearer.factionId)) continue;
    provoke({ bearer, provokerId: sourceId, cause: "debuffed" });
  }
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
 * @param {object} [opts]
 * @param {object[]|null} [opts.sink] {@link applyIntents}'s
 * @param {boolean} [opts.lines] {@link applyIntents}'s
 * @returns {Promise<{applied: number, proxied: number, prompted: number, lines: CardLine[]}>}
 */
export async function applyWorldIntents(intents, source, { sink = null, lines = false } = {}) {
  // Imported lazily to keep applier → io → socket → operations → applier from
  // being a static cycle; `net/operations.mjs` breaks the same loop the same
  // way.
  const { worldIO } = await import("./io.mjs");
  return applyIntents(intents, {
    io: worldIO(),
    canWrite: (unitId) => unitActor(unitId)?.isOwner ?? false,
    isGM: game.user.isGM,
    source,
    sink,
    lines,
  });
}

/**
 * Let an element act on damage that never ran the pipeline.
 *
 * *"Any Fire damage removes Freeze with no damage or effects"* and *"Burn
 * damage is converted to healing by Flame Heal"* are stage 0 of the pipeline.
 * A bare damage intent -- a field's `Damage` action, the terrain's Burning toll
 * -- skips the pipeline, so its element did nothing: a Frozen enemy in Piedra
 * Del Sol took the 50 and stayed Frozen. Asked here, of the same
 * `elementalEarlyExit` stage 0 asks, for a damage intent that carries an
 * `element` and no `breakdown`: heal instead of damage, or remove Freeze with
 * no damage (#154).
 *
 * @param {Intent[]} intents
 * @returns {Promise<Intent[]>}
 */
async function resolveElements(intents) {
  const bare = (i) => i.t === "damage" && i.element && i.breakdown == null && i.unitId;
  if (!intents.some(bare)) return intents;
  // No world: a unit test applying against an injected `io`, with nobody to ask.
  if (typeof game === "undefined" || !game?.actors) return intents;

  const [{ elementalEarlyExit }, { unitOf, currentBoard }] = await Promise.all([
    import("../rules/damage/pipeline.mjs"),
    import("./board.mjs"),
  ]);
  const board = currentBoard();

  /** @type {Intent[]} */
  const out = [];
  for (const intent of intents) {
    const target = bare(intent) ? unitActor(intent.unitId) : null;
    const exit = target ? elementalEarlyExit(unitOf(target, board), intent.element) : null;
    if (exit?.kind === "heal") {
      out.push(I.heal(intent.unitId, intent.amount, intent.source ?? exit.by));
    } else if (exit?.kind === "freeze") {
      out.push(I.removeEffect(intent.unitId, "freeze", "fire"));
    } else {
      out.push(intent);
    }
  }
  return out;
}

/**
 * Scale every heal by what its receiver's `HealingReceived` says.
 *
 * The one door every heal passes, whatever made it: a Skill's phase, a field,
 * a periodic tick, an Avalon, the Home Base. Heal Dwn (#232 reading 18) is
 * *"Healing received −X%"*, sparing the Home Base as Heal Up's catalogue row
 * does; Drowning's *"Health cannot be restored"* is −100 (reading 19). A
 * revival is not a heal: Guts restores a defeated Unit, which Drowning does not
 * speak to. Rounded down, never below 0.
 *
 * @param {Intent[]} intents
 * @returns {Promise<Intent[]>}
 */
async function resolveHealing(intents) {
  const heal = (i) => i.t === "heal" && !i.revival && i.unitId && i.amount > 0;
  if (!intents.some(heal)) return intents;
  if (typeof game === "undefined" || !game?.actors) return intents;
  const { unitOf, currentBoard } = await import("./board.mjs");
  const board = currentBoard();
  return intents.map((intent) => {
    if (!heal(intent)) return intent;
    const actor = unitActor(intent.unitId);
    if (!actor) return intent;
    const percent = healingPercent(unitOf(actor, board), intent.source);
    if (percent === 0) return intent;
    return { ...intent, amount: Math.max(0, Math.floor(intent.amount * (1 + percent / 100))), healingScaled: percent };
  });
}

/**
 * The summed change to a heal from this source, in percent, floored at −100.
 *
 * @param {object} unit a board unit
 * @param {string|null} source the heal's source
 * @returns {number}
 */
export function healingPercent(unit, source) {
  const total = (unit?.healingReceived ?? [])
    .filter((m) => !(m.exceptSources ?? []).includes(source))
    .reduce((sum, m) => sum + (Number(m.value) || 0), 0);
  return Math.max(-100, total);
}

/**
 * The removals that carry no "on removal" clause of their own: a refresh or a
 * replacement REMOVES the instance to put its successor in, which is the effect
 * continuing and not going.
 */
const CONTINUING_REMOVALS = new Set(["refreshed", "replaced"]);

/**
 * Run an effect's "on removal" clauses (`onRemove`) for EVERY way it can go.
 *
 * They ran for expiry alone (`scheduler.expireEffects`), so a Cure, a strip, a
 * dispel or an `until <event>` took the effect and skipped the clause. EMIYA's
 * Circuits are *"removed when Atk Up (Trace) is removed from him"* -- any removal,
 * ruled 2026-10-15 (#208 reading 13) -- and Shock's *"current Agility +1 when max
 * is restored"* is the other clause that was keyed to the clock by accident.
 *
 * Here because this is where every removal meets, whichever path produced it.
 * An expiry carries `onRemoveRan` (its clause was paid when it was decided, with
 * the effect still on the board), and a refresh or a replacement is not a
 * removal. What a clause removes is itself a removal, so it comes back through.
 *
 * @param {Intent[]} intents
 * @param {number} [depth]
 * @returns {Promise<Intent[]>}
 */
async function resolveRemovals(intents, depth = 0) {
  const due = (i) => i.t === "removeEffect" && !i.onRemoveRan && !CONTINUING_REMOVALS.has(i.reason);
  if (depth > 4 || !intents.some(due)) return intents;
  // No world: a unit test applying against an injected `io`.
  if (typeof game === "undefined" || !game?.actors) return intents;

  const [{ EffectRegistry }, { unitOf, currentMoment }, { onRemoveIntents }] = await Promise.all([
    import("../rules/registry.mjs"),
    import("./board.mjs"),
    import("./scheduler.mjs"),
  ]);
  const board = currentBoard();
  const ctx = {
    board,
    tick: currentMoment().tick ?? 0,
    turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
    effectDef: (id) => EffectRegistry.get(id),
  };

  /** @type {Intent[]} */
  const out = [];
  for (const intent of intents) {
    if (!due(intent)) {
      out.push(intent);
      continue;
    }
    const actor = unitActor(intent.unitId);
    const unit = actor ? unitOf(actor, board) : null;
    const going = (unit?.effectInstances ?? [])
      .filter((e) => e.id === intent.effectId || e.defId === intent.effectId);
    const clauses = going.flatMap((instance) => onRemoveIntents(unit, instance, ctx));
    out.push(...await resolveRemovals(clauses, depth + 1), intent);
  }
  return out;
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
async function resolveEffects(intents, { process = null, sink = null } = {}) {
  const raw = intents.filter((i) => i.t === "applyEffect" && !i.resolved);
  if (raw.length === 0) return intents;
  // No world: this is a unit test applying against an injected `io`, and there
  // is no registry to resolve a definition from. Pass the batch through rather
  // than failing -- the flow is exercised directly by its own tests.
  if (typeof game === "undefined" || !game?.actors) return intents;

  const [{ landEntry }, { EffectRegistry }, { unitOf }] = await Promise.all([
    import("./landing.mjs"),
    import("../rules/registry.mjs"),
    import("./board.mjs"),
  ]);

  /** @type {Intent[]} */
  const out = [];
  // Built ONCE for the batch, not per intent: `currentBoard()` assembles every
  // unit on the map, and this loop runs per effect applied.
  //
  // It is needed because the applier asks the target BOARD questions. A field's
  // `ImmunityDowngrade` writes `suppressions` onto the units standing in it,
  // and `immunityDowngradeFor` reads them at the immunity gate -- a bare
  // `unitSnapshot` has none, so Sikera Usum clause d never downgraded anything
  // (Ch. 46 §46.4-AG).
  const board = currentBoard();
  for (const intent of mergeStages(intents)) {
    if (intent.t !== "applyEffect" || intent.resolved) {
      out.push(intent);
      continue;
    }

    const target = unitActor(intent.unitId);
    // Nothing to resolve it against: pass it through rather than dropping it,
    // because a missing definition is a content problem and losing the write
    // would hide it.
    if (!EffectRegistry.get(intent.effect?.defId) || !target) {
      out.push(intent);
      continue;
    }

    // Through the one door, like every other path. What the emitter stated
    // and the door cannot know rides on `emitted`: the expiry it computed from
    // the duration it was authored with, and its source (#147).
    const effect = intent.effect;
    const rows = await landEntry(entryOfIntent(effect), {
      target: unitOf(target, board),
      // The effect's own `sourceUnitId` FIRST. The scheduler passes the
      // handler's *ability* id as the intent's `sourceId`, and reading that as
      // the inflicter stamped an ability id where a Unit belongs.
      source: {
        unitId: effect.sourceUnitId ?? intent.sourceId ?? null,
        abilityId: effect.sourceAbilityId ?? null,
        // The bounded field that applied it: a field is not a Unit and not an
        // ability, and the Complex's Curse lost it here the first time (#147).
        fieldId: effect.sourceFieldId ?? null,
        terrain: effect.sourceTerrain ?? null,
      },
      // The attack that raised the event, where there was one (#127).
      attackOptions: effect.attackOptions ?? [],
      // The die a handler's chance gate already rolled; a fresh one only for a
      // chance nothing has decided yet (#191).
      rolled: typeof effect.rolled === "number" ? effect.rolled : null,
      attributionHidden: Boolean(effect.attributionHidden),
      emitted: intent,
      process,
      board,
    }, { write: async (landed) => { out.push(...landed); } });
    // What it did, for the card of whatever raised it (#202). A bare intent is
    // a handler's or a transfer's; a rider's and a phase's were resolved by
    // their own caller, which prints its own rows.
    for (const row of rows ?? []) if (row?.summary) sink?.push({ unitId: intent.unitId, summary: row.summary });
  }
  return out;
}

/**
 * The Effect Entry an `applyEffect` intent carries.
 *
 * An intent is the one place an entry has already been half-resolved: its
 * magnitude is a number, its count is a number, its secrecy is a visibility.
 * What it states is read; what it computed (`expiry`) rides beside, on
 * `emitted`.
 *
 * @param {object} effect the intent's effect
 * @returns {object}
 */
function entryOfIntent(effect) {
  const entry = { id: effect.defId, magnitude: effect.magnitude ?? 0 };
  if (effect.npMagnitude !== undefined && effect.npMagnitude !== null) entry.npMagnitude = effect.npMagnitude;
  if (effect.chance !== undefined) entry.chance = effect.chance;
  if (effect.bypassChanceModifiers) entry.bypassChanceModifiers = true;
  const stages = effect.stages ?? effect.stage;
  if (typeof stages === "number" && stages > 0) entry.stages = stages;
  if (typeof effect.times === "number") entry.times = effect.times;
  if (effect.visibility) entry.visibility = effect.visibility;
  if (effect.permanent) entry.permanent = true;
  if (effect.unremovable) entry.unremovable = true;
  // An `until <event>` duration only: it has no tick to ride beside in `expiry`,
  // so the flow has to be told (`endsOn`). A counted span stays the emitter's
  // `expiry`, which already stands -- handing the flow both would be two clocks.
  if (typeof effect.duration === "string" && /^until\s/i.test(effect.duration.trim())) entry.duration = effect.duration;
  return entry;
}

/**
 * The option set an effect delivered by an event rider is tested against.
 *
 * What the `ApplyEffect` action copied off the event: the options of the attack
 * that raised it (`rules/effect-flow.mjs#attackOptionsOf`). This was
 * `new Set()` on this path, so Magic Resistance's `attackPredicate` -- Instakill
 * and Death are unaffected when the attack deals STR damage or is not affected by
 * Magic Resistance -- saw neither option and both `not:` tests passed whatever the
 * attack was (#127). Empty for an effect that carries none: a Turn boundary and a
 * field's interior event have no attack.
 *
 * @param {object|null|undefined} effect the intent's effect
 * @returns {Set<string>}
 */
export function riderOptions(effect) {
  return new Set(effect?.attackOptions ?? []);
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
export function mergeStages(intents) {
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
    // `stages ?? stage ?? 1`, the SAME chain `resolveEffects` reads below. A
    // transferred instance carries no `stages` -- it carries `stage`, the depth
    // it had on its previous bearer -- so reading only `stages` counted every
    // arrival as one and then wrote that count over the real depths.
    //
    // Van Gogh's Shadow of Longing is where it shows: Curse gathered from an
    // ally at Stage 2 and an enemy at Stage 3 arrived as Stage 2. The defect
    // scaled backwards, so the more she gathered the less of it landed.
    const first = out[index];
    out[index] = {
      ...first,
      effect: { ...first.effect, stages: depthOf(first.effect) + depthOf(intent.effect) },
    };
  }
  return out;
}

/**
 * How many stages one application is worth.
 *
 * `stages` is what an ability STATES ("inflicts Stage 3 Poison"); `stage` is
 * the depth an instance ALREADY HAS, which is what a transfer carries. Both
 * mean "this many stages are arriving", and every reader of one has to read
 * the other.
 *
 * @param {object} effect
 * @returns {number}
 */
function depthOf(effect) {
  return effect?.stages ?? effect?.stage ?? 1;
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
async function writeGroup(group, io, { moment = null, sink = null, lines = false } = {}) {
  const { t, unitId, intents } = group;
  switch (t) {
    case "damage":
      await io.adjustHealth(unitId, -sum(intents, "amount"));
      // Damage no attack dealt -- no breakdown -- has nobody else to resolve
      // its defeat; the attack path resolves its own (§46.4-CE).
      if (intents.some((i) => i.breakdown == null && !i.reflected)) await io.defeatIfLethal(unitId);
      break;
    case "heal":
      await io.adjustHealth(unitId, sum(intents, "amount"));
      break;
    // Secret Poison's tick: banked, and the Health left alone (#199 reading 13).
    case "bankSecret":
      for (const i of intents) await io.bankSecret(unitId, i.inflicterId, i.amount);
      break;
    case "statDelta":
      for (const i of intents) await io.adjustStat(unitId, i.stat, i.delta, i.clamp, i.alsoCurrent);
      // A Health LOSS that is not damage still empties a Health bar: a field's
      // `HealthLoss` (Pale Rider's Contagion, Ramesseum Tentyris' toll) marks
      // its intent, and the Unit it leaves at 0 is defeated (#180).
      if (intents.some((i) => i.defeatsAtZero)) await io.defeatIfLethal(unitId);
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
    case "scheduleDelta": {
      const { shiftStrikes } = await import("./schedule.mjs");
      for (const i of intents) await shiftStrikes(unitId, i.delta, i.source ?? null);
      break;
    }
    case "suspendSkill":
      for (const i of intents) await io.suspendSkill(unitId, i.abilityId, i.untilTick);
      break;

    case "setMode":
      for (const i of intents) await io.setMode(unitId, i.abilityId, i.active);
      break;
    case "setStance":
      await io.setStance(unitId, intents.at(-1).stance);
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
    case "spendEssence":
      for (const i of intents) await io.spendEssence(unitId, i.itemId);
      break;

    case "spendCS":
      // The Servant travels with the intent, because Ch. 32's pools are keyed by
      // it -- without it the writer cannot tell which pool to draw from.
      await io.spendCommandSpells(
        unitId, sum(intents, "count"), intents[0].command, intents[0].servantId ?? null,
      );
      break;
    case "markTurn":
      await io.markTurn(unitId, Object.assign({}, ...intents.map((i) => i.patch)));
      break;
    case "markRoundState":
      await io.markRoundState(unitId, Object.assign({}, ...intents.map((i) => i.patch)));
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
      for (const i of intents) await io.recordUse(unitId, i.abilityId, i.contentId, i.count, Boolean(i.categoryExempt));
      break;
    case "defeat":
      await io.defeat(unitId, intents[0].cause, intents[0].killerId ?? null);
      // A defeated platform falls, and one that goes with its owner goes with
      // it (Ch. 46 §46.4-CH).
      if (io.destroyPlatformsOf) await io.destroyPlatformsOf(unitId);
      break;
    // A summon whose stay ran out. Distinct from `defeat`: no revival chain, no
    // `unitDefeated`, no kill. It DOES write the summon's stats home and start
    // its summoner's `countFrom: "destroyed"` clock.
    case "dismissSummon":
      await io.dismissSummon(unitId, intents[0].reason);
      break;
    // A defeated Unit's body leaving the board, one tick after it fell.
    case "clearBody":
      await io.clearBody(unitId);
      break;
    // *"extends its period of existing on the board for 3◈ MORE Turns."*
    // Summed, so two extensions in one batch both count.
    // ONE update per Unit, so a failure cannot leave a Unit half in the past.
    case "rewind":
      await io.rewind(unitId, intents.at(-1).state, intents.at(-1).clearsDefeat);
      break;
    case "markGlassGameSpent":
      await io.markGlassGameSpent(unitId);
      break;
    case "suppressRule":
      await io.suppressRules(unitId, intents.map((i) => i.scope));
      break;
    case "durationDelta":
      await io.extendSummonStay(unitId, intents.reduce((n, i) => n + i.delta, 0));
      break;
    case "moveItem":
      for (const i of intents) await io.moveItem(i.fromId, unitId, i.contentId, i.bond ?? null);
      break;
    case "itemQuantity":
      for (const i of intents) await io.adjustItemQuantity(unitId, i.itemId, i.delta);
      break;
    case "itemGrant":
      // Every route by which a unit comes to HOLD an item ends here -- a
      // transfer, Item Construction conjuring one from nothing, and whatever
      // drop or reward is added later -- so this is where Pale Rider's *"all
      // Items that would be obtained by Pale Rider are instead obtained by his
      // Master"* is answered. Asked per intent rather than per batch: the
      // destination depends on where the Master is standing right now.
      //
      // Idempotent against `giveItem`, which asks the same question to decide
      // what to REFUSE and reports the redirect to its caller; by the time the
      // descriptor reaches here it already names the Master, and a Master holds
      // its own items.
      for (const i of intents) {
        const board = currentBoard();
        // The item's own refusals travel with it -- `barredFrom` names roles
        // rather than ids, so it can be answered from the descriptor's content
        // id without loading the pack.
        const to = acquisitionTarget(
          board.units.find((u) => u.id === unitId), board,
          { contentId: i.contentId, barredFrom: i.barredFrom ?? null },
        );
        if (!to.ok && to.leftOnFloor) {
          // *"...left on the panel where the Unit who dropped the Item was
          // standing"*: the giver's panel when one handed it over, his own
          // when nobody did (ruled 2026-10-04, #180).
          const holder = board.units.find((u) => u.id === unitId);
          await io.dropItem?.(i.contentId, i.delta, i.dropAt ?? holder?.panel ?? null, i.barredFrom ?? null, unitId);
          continue;
        }
        if (!to.ok) {
          // Loud: an item that lands nowhere is a clause doing less than it
          // says, and silence is how that goes unnoticed for a month.
          console.warn(`FGT | "${i.contentId}" could not be granted to ${unitId}: ${to.reason}.`);
          continue;
        }
        await io.grantItem(to.unitId, i.contentId, i.delta);
      }
      break;
    case "markContract":
      await io.setContract(unitId, intents.at(-1).contract, intents.at(-1).masterId);
      break;
    case "grantCommandSpells":
      for (const i of intents) await io.grantCommandSpells(i.masterId, i.servantId, i.count);
      break;
    case "setStage":
      for (const i of intents) await io.setStage(unitId, i.defId, i.stage);
      break;

    case "event":
      // Raised from inside a write, because only the write knew the number --
      // `curseStageChanged` carries the SIZE of a stage jump. Dispatched here
      // rather than by the caller for the same reason `noteDebuffs` is:
      // this is where every write path meets.
      // `eventSubject`, not `unitId`: `batch()` files an addressless intent
      // under `null`, so the group cannot say who this is about. The payload
      // can.
      for (const i of intents) {
        // A stage a handler TOOK is said here, where the number is: the 'Gogh'
        // buff ate a stage of Curse and no card said so (#202). A stage gained
        // is the landing's own line.
        if (lines && i.payload?.stageDelta < 0) sink?.push(await stageLine(I.eventSubject(i, unitId), i.payload));
        await fireWriteEvent(i.event, I.eventSubject(i, unitId), i.payload, { sink });
      }
      break;

    case "log":
      // A `banish` entry is a log line AND a world write: the Kagome Spirits'
      // *"disappears for 1◈ Turns ... then reappears on a random panel
      // within"*. The scheduler settles the tick to return on -- it is pure
      // and knows the turn length -- and hiding the token is this layer's job.
      for (const i of intents) {
        // What a handler owes at a later boundary (`at:`), kept on the match
        // until `scheduler-hooks.mjs` pays it (#103).
        if (i.entry?.kind === "deferred") await io.defer?.(i.entry);
        if (i.entry?.kind !== "banish") continue;
        await io.banish(i.entry.unitId, i.entry.untilTick, i.entry.fieldId);
      }
      // Filed at the Moment the batch is about: the end of Round 9 runs once the
      // clock reads Round 10, and its entries belong to Round 9.
      await io.log(intents.map((i) => i.entry), { moment });
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
