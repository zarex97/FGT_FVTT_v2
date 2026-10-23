/**
 * @file Offering and resolving a weak-point attack.
 * @see module/rules/weak-point.mjs, docs/45-case-studies.md
 *
 * Layer 3. The arithmetic is pure and lives next door; this is the half that
 * asks the attacker, rolls, and writes.
 *
 * Achilles' Heel is the only weak point in either roster. The shape is:
 *
 *  - **at declaration**, the attacker is offered it, but only when it can land
 *    (`weakPointOffered`) — a prompt in front of every ordinary frontal attack
 *    on him would be a question with one answer;
 *  - **in place of the damage**, `heelResolve` rolls it. On a success the
 *    attack goes through every defence he has and wounds him permanently; on a
 *    failure he Evades, which is the clause that makes declaring it a gamble
 *    rather than a free extra.
 */

import { weakPointChance, weakPointOffered, objectAimable } from "../rules/weak-point.mjs";
import { luckChecksBlocked } from "../rules/bounded-fields.mjs";
import { luckCheck } from "../rules/checks.mjs";
import { currentBoard, currentMoment, unitOf, unitActor } from "./board.mjs";
import * as I from "./intents.mjs";
import * as rollLog from "../rules/roll-log.mjs";
import { currentWar } from "./war.mjs";

/**
 * What the attacking ability adds to a weak point's chance: its
 * `weakPointAimBonus` (#326), 0 for a Normal Attack or one that states none.
 *
 * @param {object} state the Combat Process state
 * @returns {number}
 */
function aimBonusOf(state) {
  const abilityId = state?.attack?.abilityId;
  if (!abilityId) return 0;
  return Number(unitActor(state.attackerId)?.items?.get(abilityId)?.system?.weakPointAimBonus ?? 0) || 0;
}

/**
 * The weak point this defender exposes to this attack, or `null`.
 *
 * @param {object} defender a Unit projection
 * @param {object} attacker a Unit projection
 * @param {object} state the Combat Process state
 * @param {object|null} [board]
 * @returns {object|null} the spec
 */
export function exposedWeakPoint(defender, attacker, state, board = null) {
  const aimBonus = aimBonusOf(state);
  for (const spec of defender?.weakPoints ?? []) {
    // An object its holder carries (Prelati's Spellbook, #323): offered on the
    // attacker's AGI Rank, never on a chance.
    if (spec.kind === "object") {
      if (!state?.declared?.plainDamage && objectAimable(spec, { defender, attacker })) return spec;
      continue;
    }
    if (weakPointOffered(spec, { defender, attacker, state, board, aimBonus })) return spec;
  }
  return null;
}

/**
 * Ask the attacker whether to aim for it.
 *
 * Returns the state unchanged when there is nothing to offer, so the caller can
 * run this over every Process without asking first.
 *
 * @param {object} state the Combat Process state, at `declare`
 * @param {object} [ctx]
 * @param {object|null} [ctx.board]
 * @returns {Promise<object>} the state, with `heel` set when it was taken
 */
export async function offerWeakPoint(state, { board = null } = {}) {
  const attackerDoc = unitActor(state.attackerId);
  const defenderDoc = unitActor(state.defenderId);
  if (!attackerDoc || !defenderDoc) return state;

  const view = board ?? currentBoard();
  const attacker = unitOf(attackerDoc, view);
  const defender = unitOf(defenderDoc, view);
  const spec = exposedWeakPoint(defender, attacker, state, board);
  if (!spec) return state;
  if (spec.kind === "object") return offerObject(state, spec, { attackerDoc, defenderDoc, defender });

  const aimBonus = aimBonusOf(state);
  const plain = weakPointChance(spec, { defender, attacker, state, board, aimBonus });
  const withLuck = weakPointChance(spec, { defender, attacker, state, board, luckCheckPassed: true, aimBonus });

  // The Luck Check is a second opt-in INSIDE this offer rather than a rung of
  // its own: it is one decision — "aim low, and how hard" — and splitting it
  // would ask the attacker to commit before knowing what the commitment buys.
  const options = [{
    id: "heel",
    name: game.i18n.format("FGT.WeakPoint.Aim", { name: defenderDoc.name, chance: plain.chance }),
    detail: describe(plain),
  }];
  // `luck` is a number on the board projection and `{value, max}` on the unit
  // one -- the same disagreement that made the Agility clause award itself
  // every time. Read both ways, and the offer's second option appears.
  const luck = typeof attacker.luck === "number" ? attacker.luck : (attacker.luck?.value ?? 0);
  // *"Luck Check cannot be used by the involved Units"* -- Achilles's duel. The
  // offer read the attacker off a bare snapshot, which carries none of the
  // field rules it stands in, so the Heel's Luck option was offered inside the
  // duel (#184, found live). The board's projection carries the suppression.
  const onBoard = (board?.units ?? []).find((u) => u.id === attackerDoc.id) ?? null;
  if (spec.luckCheckBonus && luck > 0 && !luckChecksBlocked(onBoard)) {
    options.push({
      id: "heelLuck",
      name: game.i18n.format("FGT.WeakPoint.AimWithLuck", {
        chance: withLuck.chance, bonus: spec.luckCheckBonus,
      }),
      detail: game.i18n.localize("FGT.WeakPoint.LuckHint"),
    });
  }

  // The ATTACKER's owner is asked, wherever this resolves. `ChoiceDialog.pick`
  // opened on the client running the Process, so a player's Serenity, her
  // Attack redirected onto Achilles by his Master's guard, had the Heel
  // offered on the GM's screen (#199). `min: 0` because declining is the
  // common answer and a real one -- the attacker who does not aim low simply
  // attacks.
  const { chooseFor } = await import("./ask.mjs");
  const picked = await chooseFor(attackerDoc, {
    title: game.i18n.format("FGT.WeakPoint.Title", { name: defenderDoc.name }),
    hint: game.i18n.localize("FGT.WeakPoint.Optional"),
    count: 1,
    min: 0,
    options,
  });
  const taken = (picked ?? [])[0] ?? null;
  if (!taken) return state;

  return {
    ...state,
    heel: {
      declared: true,
      specId: spec.id,
      usesLuck: taken === "heelLuck",
      chance: plain.chance,
      breakdown: plain.breakdown,
    },
    // "Achilles cannot Block Heel Attacks." Added to what the attack already
    // forbids rather than replacing it.
    forbiddenReactions: [...new Set([...(state.forbiddenReactions ?? []), "block"])],
    attack: { ...state.attack, unblockable: true },
  };
}

/**
 * Ask the attacker whether to aim at the object instead of its holder.
 *
 * *"It can instead target Prelati's Spellbook"* (#323 reading 1): the
 * ATTACKER's owner is asked, at declaration, per Process. Declining is the
 * ordinary Attack on him.
 *
 * @param {object} state at `declare`
 * @param {object} spec the object weak point
 * @param {{attackerDoc: object, defenderDoc: object}} docs
 * @returns {Promise<object>}
 */
async function offerObject(state, spec, { attackerDoc, defenderDoc, defender }) {
  const { chooseFor } = await import("./ask.mjs");
  const { shownName } = await import("./public-identity.mjs");
  const holder = shownName(defenderDoc);
  const picked = await chooseFor(attackerDoc, {
    title: game.i18n.format("FGT.WeakPoint.ObjectTitle", { object: spec.name, name: holder }),
    hint: game.i18n.localize("FGT.WeakPoint.Optional"),
    count: 1,
    min: 0,
    options: [{
      id: "object",
      name: game.i18n.format("FGT.WeakPoint.AimObject", { object: spec.name, name: holder }),
      detail: game.i18n.localize("FGT.WeakPoint.AimObjectHint"),
    }],
  });
  if ((picked ?? [])[0] !== "object") return state;
  return {
    ...state,
    // Whether its holder has a Luck Check to offer: one Luck at least. The rung
    // is pure and cannot read the pool.
    aimedAt: { specId: spec.id, name: spec.name, resolved: false, luckable: luckOf(defender) > 0 },
    attack: { ...state.attack, aimedAtObject: spec.id },
  };
}

/**
 * Resolve an Attack aimed at an object, in place of its damage.
 *
 * Ruled 2026-10-22 (#323 readings 3 and 4). Any hit that lands destroys it,
 * Gilles takes no damage and the riders land on nobody. A failed Evade first
 * rolls the 20% that he takes the hit himself; a miss of that die offers his
 * owner the Luck Check, whose success keeps it with nobody hurt. The Luck Check
 * taken at the reaction rung is the same check. Taking nothing, it is
 * destroyed.
 *
 * @param {object} state at `objectResolve`
 * @param {object} [ctx]
 * @param {object|null} [ctx.board]
 * @returns {Promise<{event: string, detail: object, spends: object[], rollRecords: object[]}>}
 */
export async function resolveObjectAim(state, { board = null } = {}) {
  const defenderDoc = unitActor(state.defenderId);
  const view = board ?? currentBoard();
  const defender = unitOf(defenderDoc, view);
  const spec = (defender?.weakPoints ?? []).find((w) => w.id === state.aimedAt?.specId) ?? null;
  if (!spec) return { event: "takes", detail: { reason: "no object" }, spends: [], rollRecords: [] };
  const { tick } = currentMoment();
  const rollRecords = [];
  const spends = [];
  // As the table knows him: the roll's line is on a public card (#323, found pressing).
  const { shownName } = await import("./public-identity.mjs");
  const name = defenderDoc ? shownName(defenderDoc, view) : "";

  // A failed Evade: *"he has a 20% chance of taking the damage instead"*.
  if (state.reaction === "evade") {
    const roll = (await new Roll("1d100").evaluate()).total;
    // The aiming Attack's bonus raises the chance its object is the one hit
    // (#326 ruling 12): Antares Snipe at the Spellbook.
    const takeChance = (spec.takeChance ?? 0) + aimBonusOf(state);
    const takes = roll <= takeChance;
    rollRecords.push(rollLog.record({
      id: `${state.attackerId}:${state.defenderId}:objectTake:${tick}`, globalTurn: tick, entryId: "objectTake",
      formula: "1d100", raw: roll, total: roll,
      modifiers: [{ source: `${takes ? "takes it" : "does not"}: ${roll} against ${takeChance}%`, delta: 0, stage: "table" }],
      purpose: game.i18n.format(takes ? "FGT.WeakPoint.ObjectTakes" : "FGT.WeakPoint.ObjectTakeMissed", { name, object: spec.name }),
      actorId: state.defenderId,
    }));
    if (takes) return { event: "takes", detail: { roll }, spends, rollRecords };
  }

  // The Luck Check: taken at the rung, or offered after the 20% missed.
  const luck = luckOf(defender);
  let tries = state.reaction === "luck";
  if (!tries && state.reaction === "evade" && luck > 0) {
    const { chooseFor } = await import("./ask.mjs");
    const picked = await chooseFor(defenderDoc, {
      title: game.i18n.format("FGT.WeakPoint.ObjectLuckTitle", { object: spec.name }),
      hint: game.i18n.localize("FGT.Reaction.ObjectLuckHint"),
      count: 1, min: 0,
      options: [{ id: "luck", name: game.i18n.localize("FGT.Reaction.ObjectLuck") }],
    });
    tries = (picked ?? [])[0] === "luck";
  }
  if (tries && luck > 0) {
    const roll = (await new Roll("1d20").evaluate()).total;
    const attacker = unitOf(unitActor(state.attackerId), view);
    const passed = luckCheck({
      roll, luck,
      opposingLuck: typeof attacker?.luck === "number" ? attacker.luck : (attacker?.luck?.value ?? null),
    }).success;
    spends.push(I.statDelta(state.defenderId, "luck.value", -1));
    rollRecords.push(rollLog.record({
      id: `${state.attackerId}:${state.defenderId}:objectLuck:${tick}`, globalTurn: tick, entryId: "objectLuck",
      formula: "1d20", raw: roll, total: roll,
      modifiers: [{ source: `${passed ? "succeeds" : "fails"}: ${roll} against Luck ${luck}`, delta: 0, stage: "table" }],
      purpose: game.i18n.format(passed ? "FGT.WeakPoint.ObjectSaved" : "FGT.WeakPoint.ObjectDestroyed", { name, object: spec.name }),
      actorId: state.defenderId,
    }));
    return { event: passed ? "saved" : "destroyed", detail: { roll, passed }, spends, rollRecords };
  }
  return { event: "destroyed", detail: {}, spends, rollRecords };
}

/**
 * @param {object|null} unit
 * @returns {number} its Luck, however the projection spells it
 */
function luckOf(unit) {
  return typeof unit?.luck === "number" ? unit.luck : (unit?.luck?.value ?? 0);
}

/**
 * Roll the declared weak-point attack.
 *
 * @param {object} state at `heelResolve`
 * @param {object} [ctx]
 * @param {object|null} [ctx.board]
 * @returns {Promise<{event: string, detail: object}>}
 */
export async function resolveWeakPoint(state, { board = null } = {}) {
  const attackerDoc = unitActor(state.attackerId);
  const defenderDoc = unitActor(state.defenderId);
  const view = board ?? currentBoard();
  const attacker = unitOf(attackerDoc, view);
  const defender = unitOf(defenderDoc, view);
  const spec = (defender?.weakPoints ?? []).find((w) => w.id === state.heel?.specId) ?? null;
  if (!spec) return { event: "fail", detail: { reason: "no weak point" } };

  // The Luck Check first, because its outcome is an input to the chance rather
  // than a re-roll of it. Luck is spent whether or not it succeeds, which is
  // the rule everywhere else and the reason declining is a real option.
  let luckPassed = false;
  let luckRoll = null;
  if (state.heel?.usesLuck) {
    luckRoll = (await new Roll("1d20").evaluate()).total;
    luckPassed = luckCheck({
      roll: luckRoll,
      luck: typeof attacker.luck === "number" ? attacker.luck : (attacker.luck?.value ?? 0),
      opposingLuck: typeof defender.luck === "number" ? defender.luck : (defender.luck?.value ?? null),
    }).success;
  }

  const { chance, breakdown } = weakPointChance(spec, {
    defender, attacker, state, board, luckCheckPassed: luckPassed, aimBonus: aimBonusOf(state),
  });
  const roll = (await new Roll("1d100").evaluate()).total;
  const succeeded = roll <= chance;

  // On the card, with its working (#184). The Heel roll decides the whole
  // attack -- a miss is an Evade -- and it filed no record, so a failed Heel
  // left a card that said nothing but "noDamage" in its ladder.
  const tick = currentWar()?.system?.globalTurn ?? 0;
  const rollRecord = rollLog.record({
    id: `${state.attackerId}:${state.defenderId}:heel:${tick}`,
    globalTurn: tick,
    entryId: "heel",
    formula: "1d100",
    raw: roll,
    total: roll,
    modifiers: [
      ...breakdown.map((b) => ({ source: describePart(b.label), delta: b.delta, stage: "modifier" })),
      { source: `${succeeded ? "succeeds" : "fails"}: ${roll} against ${chance}%`, delta: 0, stage: "table" },
    ],
    purpose: game.i18n.format(succeeded ? "FGT.WeakPoint.RollHit" : "FGT.WeakPoint.RollMiss", {
      attacker: attackerDoc?.name ?? "", name: defenderDoc?.name ?? "",
    }),
    actorId: state.attackerId,
  });

  return {
    event: succeeded ? "success" : "fail",
    detail: { chance, roll, breakdown, luckRoll, luckPassed, specId: spec.id, rollRecord },
    // Luck is spent whether or not the check succeeded -- the rule everywhere
    // else in the ladder, and what this offer's own hint promises. Returned as
    // an intent so the caller writes it in the same batch as the wound.
    spends: state.heel?.usesLuck ? [I.statDelta(state.attackerId, "luck.value", -1)] : [],
    // What a success leaves behind. Returned rather than applied here so that
    // the caller writes it in the same batch as everything else the rung does,
    // and so this function stays a roll rather than a write.
    onSuccess: succeeded ? (spec.onSuccess ?? null) : null,
  };
}

/**
 * The permanent mark a successful weak-point attack leaves.
 *
 * Applied with no chance roll and no duration: the sheet states the consequence
 * outright, so there is nothing to resist and nothing to expire. `heelWounded`
 * is `unremovable`, which is what carries "for the rest of the game".
 *
 * @param {object} state at `heelResolve`, after a success
 * @param {object|null} onSuccess the spec's `onSuccess` block
 * @returns {import("./intents.mjs").Intent[]}
 */
export function weakPointIntents(state, onSuccess) {
  if (!onSuccess?.applies) return [];
  return [I.applyEffect(state.defenderId, {
    defId: onSuccess.applies,
    magnitude: 0,
    stage: 0,
    uses: 0,
    expiry: null,
    unremovable: true,
    sourceUnitId: state.attackerId,
    visibility: "public",
  }, state.attackerId)];
}

/**
 * @param {string} label a breakdown part
 * @returns {string}
 */
function describePart(label) {
  return game.i18n.localize(`FGT.WeakPoint.Part.${label}`);
}

/**
 * A one-line summary of where a chance came from, for the offer.
 *
 * @param {{chance: number, breakdown: Array<{label: string, delta: number}>}} out
 * @returns {string}
 */
function describe(out) {
  return out.breakdown
    .filter((b) => b.delta !== 0)
    .map((b) => `${game.i18n.localize(`FGT.WeakPoint.Part.${b.label}`)} ${b.delta > 0 ? "+" : ""}${b.delta}`)
    .join(" · ");
}
