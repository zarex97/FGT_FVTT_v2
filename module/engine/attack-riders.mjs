/**
 * @file A Noble Phantasm that rides a Normal Attack: a die rolled at its
 * declaration, whose face changes the Attack.
 * @see docs/21-combat-process.md
 *
 * Layer 3. U-Olga Marie's Four Elements (#328 ruling 16):
 *
 * > *"(Passive) Can be used when performing a Normal Attack at Range of 2 or
 * > higher. When used, roll a six-sided die and activate the corresponding
 * > effect- 1. Nothing happens ... 2. The Attack deals Fire damage and inflicts
 * > Burn for 2◈ Turns ... 5. U-Olga Marie first performs an Attack using Base
 * > Attack (STR), then immediately performs an extra follow-up Attack using
 * > Base Attack (MAG) ... 6. Your choice. Effects 2, 3, 4, and 5 can only
 * > activate once per Turn ... 'Four Elements' has no effect while inflicted
 * > with NP Seal."*
 *
 * Ruled: an NP for the gate and NP Seal, offered and optional on each Normal
 * Attack at Range 2 or more, with no Cooldown and no Master price; the die is
 * rolled at declaration and shown; the Attack stays a Normal Attack; a 6 picks
 * any face unspent this Turn; the riders roll their chance on a hit; it rides
 * the Defender of Humanity Normal Attack too, face 5 excepted.
 *
 * Authored as an `AttackRider` element on the NP (`rules/elements.mjs`). The
 * face is stamped on the declaration as `attack.rider`, which the Attack
 * Description, the base and the riders read (`engine/attack.mjs`).
 */

import { currentBoard, unitOf, unitActor } from "./board.mjs";
import { chooseFor } from "./ask.mjs";
import { applyWorldIntents } from "./applier.mjs";
import * as I from "./intents.mjs";
import * as process from "./combat-process.mjs";
import { pressGate } from "./press-gate.mjs";
import { shownName, publicSpeakerFor } from "./public-identity.mjs";
import { test as testPredicate } from "../rules/predicate.mjs";
import { rollOptionsFor } from "../rules/options.mjs";
import { turnRecordOf } from "./board.mjs";

/**
 * The key a once-per-Turn face is recorded under in the Turn Record.
 *
 * @param {string} abilityKey the rider's ability, by content id
 * @param {number|string} face
 * @returns {string}
 */
export function faceKey(abilityKey, face) {
  return `${abilityKey}:face:${face}`;
}

/**
 * The face a roll lands on: a spent once-per-Turn face reads as the rider's
 * blank face, *"if one of those effects that has already been activated this
 * Turn is rolled, the roll is treated as 'Nothing happens'"*.
 *
 * Pure.
 *
 * @param {object} rider the `AttackRider` contribution
 * @param {number} rolled
 * @param {string[]} used this Turn's `abilitiesUsed`
 * @returns {{face: number, spent: boolean}}
 */
export function landedFace(rider, rolled, used) {
  const once = (rider.oncePerTurnFaces ?? []).map(Number);
  const spent = once.includes(rolled) && used.includes(faceKey(rider.abilityKey, rolled));
  return { face: spent ? Number(rider.blankFace ?? 1) : rolled, spent };
}

/**
 * The faces a chosen face may name: every face but the choosing one, less the
 * once-per-Turn faces already spent and those this Attack cannot take.
 *
 * Pure.
 *
 * @param {object} rider
 * @param {string[]} used
 * @param {{excludeFaces?: number[]}} [opts]
 * @returns {number[]}
 */
export function choosableFaces(rider, used, { excludeFaces = [] } = {}) {
  const once = (rider.oncePerTurnFaces ?? []).map(Number);
  return Object.keys(rider.faces ?? {}).map(Number)
    .filter((f) => !(rider.chooseOn ?? []).map(Number).includes(f))
    .filter((f) => !excludeFaces.includes(f))
    .filter((f) => !(once.includes(f) && used.includes(faceKey(rider.abilityKey, f))));
}

/**
 * Offer the riders this Attack may take, roll the one taken, and say what the
 * Attack becomes.
 *
 * @param {object} args
 * @param {object} args.attackerDoc
 * @param {object|null} args.ability the declared ability, `null` for a Normal Attack
 * @param {object} args.attackSpec the declaration as `buildAttackSpec` built it
 * @param {number} args.range the distance it is declared at
 * @param {object} [args.board]
 * @returns {Promise<object|null>} fields to fold onto the declaration, or `null`
 */
export async function offerAttackRiders({ attackerDoc, ability, attackSpec, range, board = currentBoard() }) {
  const isNormal = !ability || Boolean(ability.system?.countsAsNormalAttack);
  if (!isNormal || !attackerDoc) return null;
  const self = unitOf(attackerDoc, board);
  const options = rollOptionsFor({ attacker: self, attack: { ...attackSpec, range } });

  for (const rider of self?.attackRiders ?? []) {
    if (rider.predicate && !testPredicate(rider.predicate, { options })) continue;
    // The NP's own use gate: NP Seal, the Round it opens in (#328 ruling 16).
    // An offer is a reader of the gate it would press.
    const npItem = attackerDoc.items.get(rider.abilityId) ?? null;
    if (npItem && !pressGate(attackerDoc, npItem, { board, atWindow: true, selfOnly: true, billsBudget: false }).ok) continue;

    const take = await chooseFor(attackerDoc, {
      title: "FGT.AttackRider.Title",
      hint: game.i18n.format("FGT.AttackRider.Hint", { name: rider.source }),
      count: 1,
      min: 0,
      options: [
        { id: "use", name: game.i18n.format("FGT.AttackRider.Use", { name: rider.source }) },
        { id: "skip", name: game.i18n.localize("FGT.AttackRider.Skip") },
      ],
    });
    if ((take ?? [])[0] !== "use") continue;
    return rollRider({ attackerDoc, ability, rider, board });
  }
  return null;
}

/**
 * Roll a rider's die and resolve the face, on a card.
 *
 * @param {object} args
 * @returns {Promise<object>}
 */
async function rollRider({ attackerDoc, ability, rider, board }) {
  const used = turnRecordOf(attackerDoc).abilitiesUsed ?? [];
  const roll = await new Roll(`1d${rider.die ?? 6}`).evaluate();
  const rolled = roll.total;
  let { face, spent } = landedFace(rider, rolled, used);
  let chosen = false;
  // A face that is a choice: any face this Turn has not spent, face 5 excepted
  // on an Attack it cannot follow (ruling 16).
  if ((rider.chooseOn ?? []).map(Number).includes(face)) {
    const excludeFaces = ability ? (rider.normalAttackOnlyFaces ?? []).map(Number) : [];
    const faces = choosableFaces(rider, used, { excludeFaces });
    const picked = await chooseFor(attackerDoc, {
      title: "FGT.AttackRider.ChooseTitle",
      hint: game.i18n.format("FGT.AttackRider.ChooseHint", { name: rider.source }),
      count: 1,
      min: 1,
      options: faces.map((f) => ({ id: String(f), name: faceName(rider, f) })),
    });
    face = Number((picked ?? [])[0] ?? rider.blankFace ?? 1);
    chosen = true;
  }
  // A face this Attack cannot take, rolled outright: face 5 on the Defender of
  // Humanity Normal Attack reads as nothing.
  if (ability && (rider.normalAttackOnlyFaces ?? []).map(Number).includes(face)) {
    face = Number(rider.blankFace ?? 1);
    spent = true;
  }

  const spec = rider.faces?.[face] ?? {};
  const once = (rider.oncePerTurnFaces ?? []).map(Number).includes(face);
  if (once) {
    const key = faceKey(rider.abilityKey, face);
    await applyWorldIntents([I.recordUse(attackerDoc.id, key, key)], `attackRider:${rider.abilityKey}`);
  }

  const name = shownName(attackerDoc, board);
  const line = game.i18n.format(spent ? "FGT.AttackRider.Spent" : chosen ? "FGT.AttackRider.Chosen" : "FGT.AttackRider.Rolled", {
    name, source: rider.source, roll: rolled, face: faceName(rider, face),
  });
  await ChatMessage.create({
    content: `<div class="fgt-card fgt-card--rider"><p>${foundry.utils.escapeHTML(line)}</p></div>`,
    speaker: publicSpeakerFor(attackerDoc, board),
    rolls: [roll],
  });

  return {
    rider: {
      abilityId: rider.abilityId, source: rider.source, face, rolled,
      ...(spec.element ? { element: spec.element } : {}),
      ...(spec.component ? { component: spec.component } : {}),
      ...(spec.followUp ? { followUp: { ...spec.followUp } } : {}),
    },
    ...(spec.element ? { element: spec.element, elementFraction: undefined } : {}),
    ...(spec.component ? { component: spec.component } : {}),
    riders: (spec.inflicts ?? []).map((e) => ({ ...e })),
  };
}

/**
 * A face in words, from the lang file when the rider names its faces there.
 *
 * @param {object} rider
 * @param {number} face
 * @returns {string}
 */
function faceName(rider, face) {
  const key = rider.faces?.[face]?.label ?? null;
  return key ? game.i18n.localize(key) : String(face);
}

/**
 * The reactions a rider's follow-up Attack takes away, from how the DU
 * answered the first: *"If the DU Blocked the first hit, it must also Block
 * the second hit; if the DU failed to Evade the first hit, it cannot React to
 * the second hit."* Pure.
 *
 * @param {object} first the first hit's Process state
 * @returns {string[]}
 */
export function riderLockedReactions(first) {
  if (first?.reaction === "block") return ["evade", "nothing"];
  // "Cannot React": no Evade, Block or Counter, and no reaction ability either.
  if (first?.reaction === "evade" && !first?.evaded) return ["evade", "block", "counter", "abilities"];
  return [];
}

/** Groups whose rider follow-up has been declared, claimed before any await. */
const claimed = new Set();

/**
 * Declare the follow-up a rider's face owes, once its first hit has closed.
 *
 * Face 5: *"first performs an Attack using Base Attack (STR), then immediately
 * performs an extra follow-up Attack using Base Attack (MAG)"*. On the same DU,
 * at no cost; the follow-up earns nothing further. GM-only, as Bab-ilu's is.
 *
 * @param {object} state the Process that just closed
 * @param {{resolveAttack: Function}} deps
 * @returns {Promise<object|null>}
 */
export async function offerRiderFollowUp(state, { resolveAttack }) {
  if (!game.user?.isGM) return null;
  const follow = state?.attack?.rider?.followUp ?? null;
  if (!follow || state.attack?.followUp || state.isCounter) return null;
  if (!process.isComplete(state)) return null;
  const key = `${state.groupId ?? state.attackerId}|${state.attackerId}|${state.defenderId}`;
  if (claimed.has(key)) return null;
  claimed.add(key);
  setTimeout(() => claimed.delete(key), 120_000);

  const attackerDoc = unitActor(state.attackerId);
  const defenderDoc = unitActor(state.defenderId);
  if (!attackerDoc || !defenderDoc) return null;
  const board = currentBoard();
  const defender = unitOf(defenderDoc, board);
  if (!defender || defender.defeated || (defender.health ?? 0) <= 0) return null;

  await ChatMessage.create({
    content: `<p>${foundry.utils.escapeHTML(game.i18n.format("FGT.AttackRider.FollowUp", {
      name: shownName(attackerDoc, board), source: state.attack.rider.source, target: shownName(defenderDoc, board),
    }))}</p>`,
    speaker: publicSpeakerFor(attackerDoc, board),
  });
  return resolveAttack({
    attackerId: attackerDoc.id,
    abilityId: null,
    placement: {
      unitId: defenderDoc.id,
      followUp: true,
      forbidReactions: riderLockedReactions(state),
      rider: { source: state.attack.rider.source, ...(follow.component ? { component: follow.component } : {}) },
    },
    resume: true,
  });
}
