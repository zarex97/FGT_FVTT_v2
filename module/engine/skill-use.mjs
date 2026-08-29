/**
 * @file Using an active Skill that is not an Attack.
 * @see docs/15-abilities.md §15.1, §15.2, docs/18-action-economy.md
 *
 * Layer 3.
 *
 * **Why this exists as its own path.** `resolveAttack` was the only route into
 * using an ability, so a self-buff went through the whole attack machinery: it
 * opened a targeting session, computed a damage range for its own caster,
 * offered a button labelled "Attack", built a Combat Process, and prompted the
 * target for a reaction. Asterios's *Avyssos of Labrys* — which applies three
 * buffs to Asterios and touches nobody — did all of that.
 *
 * `classifyAbility` had said `isAttack: false` the whole time. Nothing read it
 * on the use path, which is this project's signature defect: a rule that is
 * right and inert.
 *
 * A Skill is not an Attack (§15.1). It has no defender, so there is nothing to
 * evade, block or counter, and no Combat Process to run — a ladder whose every
 * rung is skipped is not a ladder. It spends the Unit's **Act** and, unless it
 * deals damage directly, not its Attack.
 */

import { canUseAbility } from "../rules/costs.mjs";
import {
  targetSpecFor, countsAsAttack, countsAsAct, isNegated, blockedThisTurn, needsTargeting,
  usageSpecFor,
} from "../rules/ability-use.mjs";
import { effectivePhases } from "../rules/copy.mjs";
import { resolveTargets } from "../rules/targeting/resolve.mjs";
import { applyEffect, inflictBonusOf } from "./effect-applier.mjs";
import { summonPhase } from "./summoning.mjs";
import { cooldownFor, alsoTriggered } from "./cooldown.mjs";
import { EffectRegistry } from "../rules/registry.mjs";
import { currentBoard, unitFrom, unitSnapshot } from "./board.mjs";
import { resourcePathFor } from "../domain/resources.mjs";
import { rollOptionsFor } from "../rules/options.mjs";
import { relationOf } from "../rules/relations.mjs";
import { tableFor, entriesFor, choicesIn, effectsOf } from "../rules/roll-table.mjs";
import { applyWorldIntents } from "./applier.mjs";
import * as budget from "./budget.mjs";
import * as I from "./intents.mjs";
import { parseTick, resolveTicks } from "../domain/tick.mjs";
import { createField } from "./fields.mjs";
import { fireEvent, regionScale } from "./scheduler.mjs";
import { isConcealed, concealmentBreakChance } from "../rules/concealment.mjs";
import { test as testPredicate } from "../rules/predicate.mjs";

/**
 * Use an active Skill.
 *
 * @param {object} args
 * @param {string} args.actorId
 * @param {string} args.abilityId
 * @param {object} [args.placement] only when the skill needed targeting
 * @returns {Promise<{ok: boolean, reason?: string, applied?: object[]}>}
 */
export async function useSkill({ actorId, abilityId, placement = {} }) {
  const actor = game.actors.get(actorId);
  const ability = actor?.items?.get(abilityId);
  if (!actor || !ability) return { ok: false, reason: "notFound" };

  const board = currentBoard();
  const self = unitFrom(board, actor);
  const master = self.masterId ? unitFrom(board, game.actors.get(self.masterId)) : null;
  const combat = game.combats?.active;

  // The same gates an attack passes, because they are gates on *using an
  // ability* rather than on attacking: cooldown, round, cost, and §15.4's
  // requirement list.
  const usage = canUseAbility({
    ability: usageSpec(ability),
    unit: self,
    master,
    round: combat?.round ?? 1,
    board,
    // The `predicate` requirement kind (`rules/items.mjs`) has been in
    // `meetsRequirement` since §15.4 was implemented and refused every use
    // that named it: `ctx.testPredicate` had no supplier here, so
    // `typeof undefined === "function"` failed and the gate always lost.
    // Semiramis's Sikera Ušum is the first content that needs it --
    // `self:variant:noDsc`, gating clause 1 off from clause 2's Throne-Room
    // branch -- and self-only, the same scope a rule element's own
    // `predicate` gets at collection time.
    testPredicate: (p) => testPredicate(p, { options: rollOptionsFor({ attacker: self }) }),
  });
  if (!usage.ok) return { ok: false, reason: usage.reason };

  // Negated outright by an effect the Unit is carrying. Medea's High-Speed
  // Divine Words is "negated while inflicted with Silence", and that is a
  // different question from a requirement -- Silence can land between the
  // declaration and this moment.
  if (isNegated(ability, self.effects ?? [])) return { ok: false, reason: "negated" };

  // Its mutually-exclusive partner already went this Turn.
  const blocker = blockedThisTurn(ability, usedThisTurn(actor));
  if (blocker) return { ok: false, reason: "sameTurnExclusive", blocker };

  // A Skill spends the skill budget, not an attack (Ch. 18). `countsAsAttack`
  // is consulted rather than assumed: a damaging Attack Skill spends both.
  const asAttack = countsAsAttack(ability);
  if (combat?.started) {
    const verdict = budget.affordable(combat, self, asAttack ? "normal" : "skill");
    if (!verdict.ok) return { ok: false, reason: verdict.reason };
  }

  const targets = resolveSkillTargets(ability, self, board, placement);
  if (targets.errors.length > 0) return { ok: false, reason: targets.errors[0] };

  const applied = await runPhases(ability, actor, targets.units, board);

  const marks = {
    ...(countsAsAct(ability) ? { acted: true } : {}),
    ...(asAttack ? { attacked: true } : { usedActiveSkill: true }),
  };

  await applyWorldIntents([
    ...(usage.cost && !applied.channelStarted ? costIntents(usage.cost, self) : []),
    ...itemCostIntents(ability, actor),
    ...(applied.channelStarted ? [] : cooldownIntents(ability, actor, applied.summoned ?? 0, self)),
    I.markTurn(actorId, marks),
    // Recorded so a mutually-exclusive partner can see it went, at both
    // scales, and so a `maxUses` budget can be spent. One intent, shared with
    // the attack path, which used to keep no record at all.
    I.recordUse(actorId, ability.id, ability.system?.contentId ?? null),
    I.log({
      kind: "ability", event: "skillUsed",
      unitId: actorId, abilityId, name: ability.name,
      targets: targets.units.map((t) => t.unitId),
      applied: applied.map((a) => a.summary),
    }),
  ], `skill:${abilityId}`);

  if (combat?.started) await budget.spend({ combat, unit: self, action: asAttack ? "normal" : "skill" });
  await fireAbilityUsed(actor, ability);
  await rollConcealmentBreak(actor, ability, self);
  await postCard(actor, ability, targets.units, applied);

  return { ok: true, applied };
}

/**
 * The price of using a Skill from concealment.
 *
 * > *"Can be used when Presence Concealment is Active, has a 20% chance of
 * > deactivating Presence Concealment when used."*
 *
 * The other half of clause 7's "unless stated": an exemption that is free would
 * make the clause a formality, and Serenity's Shapeshift is the only ability in
 * the reference set that buys one. Rolled **after** the Skill has resolved, so
 * a bad roll never costs the Skill itself.
 *
 * @param {object} actor
 * @param {object} ability
 * @param {object} self the user's snapshot
 * @returns {Promise<void>}
 */
async function rollConcealmentBreak(actor, ability, self) {
  const chance = concealmentBreakChance(ability);
  if (chance <= 0 || !isConcealed(self)) return;

  const roll = await new Roll("1d100").evaluate();
  if (roll.total > chance) return;

  const { deactivateConcealment } = await import("./concealment.mjs");
  const { DEACTIVATION_REASONS } = await import("../rules/concealment.mjs");
  await deactivateConcealment(actor.id, DEACTIVATION_REASONS.skillUse);
  await ChatMessage.create({
    content: `<p><strong>${ability.name}</strong> gave ${actor.name} away —`
      + ` rolled ${roll.total} vs ${chance}%. Presence Concealment ends.</p>`,
    speaker: ChatMessage.getSpeaker({ actor }),
  });
}

/* -------------------------------------------------------------------------- */

/**
 * Which units the skill lands on.
 *
 * A skill with no declared targeting gets `targetSpecFor`'s self spec, and that
 * resolves to the caster without a placement — which is exactly why no
 * targeting session is needed for one.
 *
 * @param {object} ability
 * @param {object} self
 * @param {object} board
 * @param {object} placement
 * @returns {{units: object[], errors: string[]}}
 */
function resolveSkillTargets(ability, self, board, placement) {
  const spec = targetSpecFor(ability, self.range?.panels ?? 1);

  // A skill that targets only its caster resolves to the caster **without
  // consulting geometry at all**. Running it through the targeting resolver
  // made a self-buff depend on the Servant having a token placed on the current
  // scene -- Golden Fleece refused with "no legal targets in the selected area"
  // for a Medea standing in the actor directory, which is a sentence about a
  // board that has nothing to do with restoring her own Health.
  if (!needsTargeting(ability) && targetsSelfOnly(spec)) {
    return { units: [{ unitId: self.id }], errors: [] };
  }

  const resolved = resolveTargets(spec, self, board, placement);
  return { units: resolved.units, errors: resolved.errors };
}

/**
 * The units one phase acts on.
 *
 * @param {object} phase
 * @param {object[]} resolved what the targeting produced
 * @param {object} actor the caster
 * @returns {object[]}
 */
function phaseTargets(phase, resolved, actor, board) {
  // A phase whose reach differs from the ability's own. `self` and `reuse`
  // were the only two answers, and neither is "every ally within 2 panels of
  // me" -- least of all on a REACTION, where `reuse` resolves to whoever just
  // attacked. EMIYA's Eye of the Mind (True) EX buffs himself three ways and
  // his neighbours a fourth, in one use.
  if (phase.targeting) {
    const self = board.units.find((u) => u.id === actor.id) ?? unitSnapshot(actor);
    const out = resolveTargets(phase.targeting, self, board, {});
    return out.units;
  }
  return (phase.target ?? "reuse") === "self" ? [{ unitId: actor.id }] : resolved;
}

/**
 * Is this spec addressed at the caster and nobody else?
 *
 * @param {object} spec
 * @returns {boolean}
 */
function targetsSelfOnly(spec) {
  const anchor = spec?.anchor?.kind ?? spec?.anchor ?? "self";
  const relations = spec?.selection?.relations ?? ["self"];
  return anchor === "self" && relations.every((r) => r === "self");
}

/**
 * Run the ability's phases against its targets.
 *
 * Only the phase kinds a non-attack skill can carry. A `damage` phase reaching
 * here would mean `countsAsAttack` said false about an ability that deals
 * damage, so it is reported rather than quietly skipped.
 *
 * @param {object} ability
 * @param {object} actor
 * @param {object[]} targets
 * @param {object} board
 * @returns {Promise<object[]>}
 */
async function runPhases(ability, actor, targets, board, only = null) {
  /** @type {object[]} */
  const applied = [];
  // How many were conjured, for a cooldown that scales with the roll that just
  // happened -- Dragon Tooth Warriors is the only such cost in the set.
  let summoned = 0;
  // Whether a `channel` phase just opened a multi-Turn activation -- the
  // Hanging Gardens' NP cost and cooldown are both deferred to
  // `channel.mjs`'s `completeChannel`, not paid at this use.
  let channelStarted = false;

  // The CASTER's own options, for a phase-level `predicate:` -- Semiramis's
  // `Double Summon` grants the 'DSC' buff only in its THIRD clause, "if
  // Semiramis does not have the Double Summon: Caster Skill", a condition on
  // one phase of a three-phase ability rather than on the ability as a whole.
  // Self-only, like a rule element's own `predicate` (Ch. 24 §24.3) -- there
  // is no target and no attack here either, so a clause naming one belongs on
  // an `OnEvent` handler instead, not on a phase.
  const selfOptions = rollOptionsFor({ attacker: unitSnapshot(actor) });

  for (const phase of effectivePhases(ability.system ?? {}, resolveSource)) {
    // "If this is NOT THE FIRST TIME EMIYA has used this Skill in this game,
    // reduce his Health by 5%." A gate on the whole-match counter, which is
    // read BEFORE this use is recorded -- so the first press costs nothing and
    // the second onwards does.
    if (phase.afterFirstUse && (ability.system?.timesUsed ?? 0) < 1) continue;
    if (phase.predicate && !testPredicate(phase.predicate, { options: selfOptions })) continue;
    // A caller may want only part of the list -- the attack flow runs the
    // phases the Combat Process has no rung for, and leaves the effect phases
    // to the damage step where the riders belong.
    if (only && !only(phase)) continue;
    // WHO this phase lands on. `target: self` names the caster and `reuse`
    // names whatever the targeting resolved -- a distinction every ability in
    // the reference set has authored since phases existed, and which nothing
    // read: the loop ran every phase over every resolved target.
    //
    // It stayed invisible while every `target: self` phase belonged to a
    // self-targeting ability, where the two lists are the same. Scáthach's
    // Primordial Rune is the first where they differ -- "Gain 2 PRS Tokens.
    // Then, ... on an allied Unit" -- and the tokens went to the ally.
    for (const target of phaseTargets(phase, targets, actor, board)) {
      const doc = game.actors.get(target.unitId);
      if (!doc) continue;
      const snapshot = board.units.find((u) => u.id === target.unitId) ?? unitSnapshot(doc);

      switch (phase.kind) {
        case "applyEffects":
        case "applyEffect":
          applied.push(...await applyPhaseEffects(phase, ability, actor, snapshot));
          break;

        case "heal": {
          // Of MAXIMUM, not of current: 30% of a nearly-dead Medea's current
          // Health is a rounding error, and the sheet says "of its maximum
          // value" for exactly that reason.
          const max = doc.system?.health?.max ?? 0;
          const amount = phase.percentOfMax
            ? Math.floor(max * (phase.percentOfMax / 100))
            : (phase.amount ?? 0);
          if (amount > 0) {
            await applyWorldIntents([I.heal(target.unitId, amount, ability.id)], `skill:${ability.id}:heal`);
          }
          break;
        }

        case "statChange":
          await applyWorldIntents(
            statChanges(phase, target.unitId, doc),
            `skill:${ability.id}:stat`,
          );
          break;

        case "resource":
          await applyWorldIntents(
            (phase.changes ?? []).map((c) =>
              // `clampToMax` is the difference between "restores 3 Agility" and
              // "grants 3 Agility": Golden Fleece restores, so it cannot push a
              // Servant above the maximum it rolled at summon.
              (c.clampToMax
                ? I.statDelta(target.unitId, c.key, c.delta, true)
                : I.resource(target.unitId, c.key, c.delta))),
            `skill:${ability.id}:resource`,
          );
          break;

        case "cooldown":
          await applyWorldIntents(
            phase.choose ? await chosenCooldowns(phase, ability, doc) : cooldownChanges(phase, doc, board),
            `skill:${ability.id}:cooldown`,
          );
          break;

        case "removeEffect":
          await applyWorldIntents(
            removals(phase, doc).map((id) => I.removeEffect(target.unitId, id, "skill")),
            `skill:${ability.id}:remove`,
          );
          break;

        case "rollTable":
          applied.push(...await runRollTable(phase, ability, actor, snapshot, board));
          break;

        case "choose": {
          // A phase that asks a question. Trace, On's second clause is "apply
          // ONE OF the following effects OF YOUR CHOICE" -- the choice is the
          // rule, so it cannot be resolved by picking one and calling it a
          // default.
          applied.push(...await runChoice(phase, ability, actor, snapshot));
          break;
        }

        case "itemGrant": {
          // Item Construction: "roll a four-sided die; Semiramis creates that
          // number of [Semiramis' Poison] Items." `I.itemGrant`, not
          // `I.itemQuantity` -- the caster may hold none of the item yet, so
          // there is nothing an `itemQuantity` delta could adjust (the same
          // reason the RECEIVING half of a transfer uses it, `rules/items.mjs`).
          const amount = phase.roll
            ? (await new Roll(phase.roll).evaluate()).total
            : (phase.delta ?? 1);
          if (amount > 0) {
            await applyWorldIntents(
              [
                I.itemGrant(target.unitId, phase.contentId, amount),
                I.log({ kind: "itemGrant", contentId: phase.contentId, unitId: target.unitId, amount }),
                // HGoB Construction source 4 (Ch. 32): "increased by the
                // number of [Semiramis' Poison] PRODUCED" -- the SAME roll
                // that decided the item count, not a second, independent
                // one. `alsoGrantsResource` rides the one roll rather than
                // a sibling `resource` phase re-rolling the die.
                ...(phase.alsoGrantsResource
                  ? [I.resource(
                    phase.alsoGrantsResource.unitId === "self" ? actor.id : target.unitId,
                    resourcePathFor(phase.alsoGrantsResource.resource, unitFrom(board, actor)),
                    phase.alsoGrantsResource.regionScaled
                      ? regionScale(amount, phase.alsoGrantsResource.regionScaled, board.warRegion)
                      : amount,
                  )]
                  : []),
              ],
              `skill:${ability.id}:itemGrant`,
            );
          }
          applied.push({
            summary: { id: "itemGrant", name: `${amount} ${phase.contentId}`, outcome: "applied", reason: null },
          });
          break;
        }

        case "createField": {
          // Once per use, from the caster: a bounded field is one area, and
          // looping it over a target list would create one per Unit caught.
          if (target.unitId !== actor.id) break;
          const field = await createField(ability, actor, board);
          applied.push({
            summary: {
              id: "field", name: ability.name,
              outcome: field ? "applied" : "failed",
              reason: field ? null : "noScene",
            },
          });
          break;
        }

        case "summon": {
          // Only once per use, not once per target: the phase conjures from the
          // CASTER, and looping it over a target list would multiply the squad.
          if (target.unitId !== actor.id) break;
          const out = await summonPhase(phase, actor, { choose: chooseSummonType });
          summoned = out.count;
          applied.push({ summary: { id: "summon", name: `${out.count} summoned`, outcome: "applied", reason: null } });
          break;
        }

        case "channel": {
          // Only once per use, from the caster. The Hanging Gardens' own
          // activation: "cannot Act for 3◈ Turns... if Attacked during this
          // period, interrupted and has to restart... Master only loses
          // Health as per NP usage rules ONLY WHEN HGoB SUCCESSFULLY
          // ACTIVATES, not at the start" -- the deferred-cost half of that
          // is why `useSkill` skips its own cost/cooldown intents below
          // when a channel starts, and `completeChannel` pays them instead.
          if (target.unitId !== actor.id) break;
          const { startChannel } = await import("./channel.mjs");
          const started = await startChannel(actor, ability, phase);
          applied.push({
            summary: {
              id: "channel", name: ability.name,
              outcome: started ? "applied" : "failed",
              reason: started ? null : "alreadyChannelling",
            },
          });
          if (started) channelStarted = true;
          break;
        }

        case "damage":
          // `countsAsAttack` should have routed this to `resolveAttack`. Loud,
          // because the alternative is a Noble-Phantasm-sized hole that looks
          // like an ability quietly doing less than its text says.
          console.error(`FGT | ${ability.name} has a damage phase and was used as a Skill.`);
          ui.notifications?.error(game.i18n.format("FGT.Skill.DamagePhase", { name: ability.name }));
          break;

        default:
          console.warn(`FGT | Phase "${phase.kind}" is not supported on a Skill; it did nothing.`);
      }
    }
  }
  return Object.assign(applied, { summoned, channelStarted });
}

/**
 * Roll a table and apply what it lands on.
 *
 * Scáthach's *Primordial Rune*: two eight-sided dice, an allied table and an
 * enemy one, a row that is a question rather than an effect, and *"if a
 * duplicate number is rolled, apply the effect twice"*.
 *
 * The dice are rolled as **separate d8s** rather than as one `2d8`, because the
 * duplicate clause needs the individual faces and a summed total cannot say
 * whether the same row came up twice.
 *
 * @param {object} phase
 * @param {object} ability
 * @param {object} actor
 * @param {object} target the target's snapshot
 * @param {object} board
 * @returns {Promise<object[]>}
 */
async function runRollTable(phase, ability, actor, target, board) {
  const self = board.units.find((u) => u.id === actor.id) ?? unitSnapshot(actor);
  const table = tableFor(phase, relationOf(self, target, board));
  if (!table) {
    console.warn(`FGT | ${ability.name} has a rollTable phase with no table for this target.`);
    return [];
  }

  const faces = phase.faces ?? 8;
  const count = phase.count ?? 2;
  /** @type {number[]} */
  const results = [];
  for (let k = 0; k < count; k++) {
    results.push((await new Roll(`1d${faces}`).evaluate()).total);
  }

  /** @type {object[]} */
  const out = [];
  for (const { roll, entry } of entriesFor(table, results)) {
    if (!entry) {
      // A face with no row is a content error. Loud, because the alternative
      // is a Skill that quietly does nothing on a 7.
      console.error(`FGT | ${ability.name} rolled ${roll}, which its table has no row for.`);
      continue;
    }

    // "Your choice of any of the above effect(s)" -- resolved by asking, and
    // the chosen row then applies exactly as if it had been rolled. ONE per
    // die: both dice landing on 8 asks twice, which is where the plural comes
    // from.
    const rows = entry.choose ? await chooseRows(table, ability, roll) : [entry];

    for (const row of rows) {
      out.push(...await applyPhaseEffects({ effects: effectsOf(row) }, ability, actor, target));
    }
  }

  await postRollCard(actor, ability, target, results);
  return out;
}

/**
 * The wildcard row's question: **one row, for this die**.
 *
 * The "(s)" in *"your choice of any of the above effect(s)"* is about the
 * Skill, not about this die. Every other row on the table is one effect, and
 * the wildcard is a row like any other -- it is the row you rolled, not a
 * licence to take the table. What makes the plural true is that both dice can
 * land on 8, and then it is asked twice.
 *
 * So the count is one per prompt and the loop in `runRollTable` supplies the
 * rest. Two 8s ask twice and may pick the same row both times, which applies it
 * twice -- exactly what two of any other number would do.
 *
 * @param {object} table
 * @param {object} ability
 * @param {number} roll the die that landed on the wildcard, for the prompt
 * @returns {Promise<object[]>}
 */
async function chooseRows(table, ability, roll) {
  const options = choicesIn(table);
  const { ChoiceDialog } = await import("../apps/choice-dialog.mjs");

  const picked = await ChoiceDialog.pick({
    title: ability.name,
    hint: game.i18n.format("FGT.RollTable.ChooseHint", { roll }),
    count: 1,
    options: options.map((o) => ({
      id: String(o.roll),
      name: `${o.roll}. ${(o.entry.effects ?? []).map((e) => effectLabel(e)).join(", ")}`,
    })),
  });

  return (picked ?? []).map((id) => table[id]).filter(Boolean);
}

/**
 * How one table entry's effect reads in the prompt.
 *
 * The registry's display name and the magnitude, because "5. npDmUp" asks the
 * player to know the content ids and "5. NP DmUp 30%" does not.
 *
 * @param {object} spec
 * @returns {string}
 */
function effectLabel(spec) {
  const def = EffectRegistry.get(spec.id);
  const name = def?.name ?? spec.id;
  return spec.magnitude ? `${name} ${spec.magnitude}%` : name;
}

/**
 * What the dice said, before the effects land.
 *
 * A separate card from the skill's own, because the roll is the interesting
 * half: a player who sees only "Atk Up applied" cannot tell a 1 from a lucky 8.
 *
 * @param {object} actor
 * @param {object} ability
 * @param {object} target
 * @param {number[]} results
 */
async function postRollCard(actor, ability, target, results) {
  await ChatMessage.create({
    content: `<p><strong>${ability.name}</strong> on ${target.name ?? "the target"}: `
      + `rolled ${results.join(", ")}.</p>`,
    speaker: ChatMessage.getSpeaker({ actor }),
  });
}

/**
 * @param {object} phase
 * @param {object} ability
 * @param {object} actor
 * @param {object} target
 * @returns {Promise<object[]>}
 */
async function applyPhaseEffects(phase, ability, actor, target) {
  /** @type {object[]} */
  const out = [];

  for (const rule of phase.rules ?? phase.effects ?? []) {
    const spec = rule.effect ?? rule;
    if (!spec?.id) continue;

    const def = EffectRegistry.get(spec.id);
    if (!def) {
      // Loud: a missing definition means the ability silently does less than
      // its text says, which is indistinguishable from the ability working.
      console.warn(`FGT | ${ability.name} applies unknown effect "${spec.id}"`);
      ui.notifications?.warn(game.i18n.format("FGT.Skill.UnknownEffect", { name: ability.name, id: spec.id }));
      continue;
    }

    const roll = await new Roll("1d100").evaluate();
    const outcome = applyEffect({
      def,
      target,
      magnitude: spec.magnitude ?? def.defaultMagnitude ?? 0,
      // The "if NP" half of Appendix A's damage family. Referenced by every
      // such effect definition as `@npMagnitude`, against an instance that
      // never carried it.
      npMagnitude: spec.npMagnitude ?? rule.npMagnitude ?? null,
      // See `applyAbilityEffects`: one application worth N stages.
      stages: spec.stages ?? rule.stages ?? 1,
      duration: rule.duration ?? spec.duration ?? def.defaultDuration,
      source: { unitId: actor.id, abilityId: ability.id },
      // Declared per effect by the ability (§15.2). Atlas's two reductions
      // stack, which is why this is a list rather than a number.
      chanceModifiers: spec.chanceModifiers ?? rule.chanceModifiers ?? [],
      // The ability's own stated chance, overriding the effect's default.
      // Scáthach's Clairvoyance applies two of its three buffs at 80%.
      chance: spec.chance ?? rule.chance ?? null,
      ctx: {
        turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
        currentTick: game.combat?.system?.globalTurn ?? 0,
        roll: roll.total,
        // The attacker's own outgoing `ApplicationChance` contributions.
        // Hardcoded to 0 until Medea's Item Construction needed it, which
        // made every outgoing contribution in the game inert.
        inflictBonus: inflictBonusOf(unitSnapshot(actor), def),
        // The predicates those modifiers test against. Without the option set
        // every predicate is unsatisfiable, which is the shape of defect this
        // codebase has produced more than once.
        options: rollOptionsFor({ attacker: unitSnapshot(actor), defender: target }),
        resist: 0,
      },
    });

    if (outcome.intents.length > 0) await applyWorldIntents(outcome.intents, "skillEffect");
    out.push({
      summary: { id: spec.id, name: def.name, outcome: outcome.outcome, reason: outcome.reason },
      result: outcome,
    });
  }
  return out;
}

/**
 * Spend an ability's `itemCost`, if it has one.
 *
 * "Arrogant King's Poison requires 3 [Semiramis' Poison] to use" is a cost on
 * USING the ability, not on landing its effect -- unlike a consumed
 * `[Semiramis' Poison]`'s own `consumeEffect` (Queen's Poison), spending the
 * cost here does not itself apply anything. The `itemAtLeast` requirement
 * above (`rules/items.mjs`) already refused the use before this runs if the
 * caster held fewer than the cost, so the item is guaranteed to exist.
 *
 * @param {object} ability
 * @param {object} actor
 * @returns {object[]}
 */
function itemCostIntents(ability, actor) {
  const cost = ability.system?.itemCost;
  if (!cost) return [];
  const item = actor.items.find((i) => (i.system?.contentId ?? i.id) === cost.contentId);
  if (!item) return [];
  return [I.itemQuantity(actor.id, item.id, -(cost.amount ?? 1))];
}

/**
 * @param {object} ability
 * @param {object} actor
 * @param {number} [summoned]
 * @param {object|null} [unit] the user's snapshot, for a resource waiver
 * @returns {object[]}
 */
function cooldownIntents(ability, actor, summoned = 0, unit = null) {
  // One implementation for both use paths (`engine/cooldown.mjs`). They used to
  // disagree: this one set a cooldown and `resolveAttack` did not.
  const plan = cooldownFor(ability, actor.id, { count: summoned, unit });

  return [
    ...[...plan.cooldowns, ...alsoTriggered(ability, actor)]
      .map((c) => I.cooldown(c.actorId, c.abilityId, c.ticks, "set")),
    // A waived cooldown is PAID for. Emitting the skipped clock without the
    // token spent would make Scáthach's Rune Spells free for ever.
    ...plan.spends.map((sp) => I.resource(sp.unitId, sp.key, sp.delta)),
  ];
}

/**
 * @param {object} cost
 * @param {object} self the paying unit's snapshot, for a sustainability cost
 * @returns {object[]}
 */
export function costIntents(cost, self) {
  // `statDelta`, never `damage` -- Health *loss* must not feed damage-keyed
  // triggers (Ch. 06). Same reason as the attack path.
  if (!cost?.unitId) return [];
  const note = I.log({ kind: "cost", cost: cost.kind, amount: cost.amount, unitId: cost.unitId });
  if (cost.kind === "sustainability") {
    // An ABSOLUTE write, from `self.sustainability` -- see `costIntents` in
    // `engine/attack.mjs` for why a relative delta against the raw stored
    // field (`null` until its first write) is wrong here.
    return [I.setResource(cost.unitId, "sustainabilityRemaining", self.sustainability - cost.amount), note];
  }
  return [I.statDelta(cost.unitId, "health.value", -cost.amount, false), note];
}

/** @param {object} ability @returns {object} */
function usageSpec(ability) {
  // One implementation, shared with `resolveAttack` (`rules/ability-use.mjs`).
  // The two used to be separate and disagreed about which fields a gate could
  // see, so a requirement authored on an ability was honoured on one use path
  // and dropped on the other.
  return usageSpecFor(ability);
}

/** @param {string} contentId @returns {object|null} */
function resolveSource(contentId) {
  for (const actor of game.actors ?? []) {
    const found = actor.items?.find((i) => i.system?.contentId === contentId || i.id === contentId);
    if (found) return found;
  }
  return null;
}

/**
 * A plain card. Not a Combat Process card: there is no ladder to show, and a
 * card offering Evade for a self-buff is how this bug looked from the table.
 *
 * @param {object} actor
 * @param {object} ability
 * @param {object[]} targets
 * @param {object[]} applied
 */
async function postCard(actor, ability, targets, applied) {
  const names = targets
    .map((t) => game.actors.get(t.unitId)?.name ?? t.unitId)
    .filter((n) => n !== actor.name);

  const effects = applied
    .filter((a) => a.summary.outcome === "applied")
    .map((a) => a.summary.name);

  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/fgt/templates/chat/skill.hbs",
    {
      caster: actor.name,
      img: actor.img,
      ability: ability.name,
      rank: ability.system?.rank ?? null,
      targets: names,
      effects,
      // A refusal is shown too: an effect the target was immune to is a fact
      // the player needs, and an empty card reads as a skill that did nothing.
      refused: applied
        .filter((a) => a.summary.outcome !== "applied")
        .map((a) => ({ name: a.summary.name, reason: a.summary.reason })),
    },
  );

  await ChatMessage.create({ content, speaker: ChatMessage.getSpeaker({ actor }) });
}

/**
 * The cooldown intents a phase produces.
 *
 * A change may name **one ability** or a whole **category**. Medea's High-Speed
 * Divine Words resets "all of Medea's Spells", and naming each of the seven
 * would go stale the moment an eighth was written -- which is the same argument
 * that made `category` a field rather than a list in the ability.
 *
 * @param {object} phase
 * @param {object} doc the actor whose abilities are affected
 * @param {object} [board] needed only by a `countMatching` change
 * @returns {object[]}
 */
function cooldownChanges(phase, doc, board = null) {
  /** @type {object[]} */
  const out = [];

  for (const change of phase.changes ?? []) {
    const targets = selectAbilities(change, doc);

    for (const item of targets) {
      // `set: 0` is "completely reduce", which is a set rather than a subtract:
      // a reduce of some large number would work by accident and read as a bug.
      if (change.set !== undefined) {
        out.push(I.cooldown(doc.id, item.id, change.set, "set"));
        continue;
      }
      // A ◈ EXPRESSION as well as a raw turn count. Every cooldown a sheet
      // prints is in ◈ -- *"increase its NP Cooldown by 1◈ Turns"* -- and
      // reading that as one turn would make Shapeshift a third as strong in a
      // three-turn Round.
      const turns = change.ticks !== undefined
        ? resolveTicks(parseTick(change.ticks), { turnsPerRound: game.settings.get("fgt", "turnsPerRound") })
        : change.countMatching
          ? countMatchingTurns(change, doc, board)
          : Math.abs(change.delta ?? 0);
      const down = change.ticks !== undefined ? (change.direction === "down")
        : change.countMatching ? true : (change.delta ?? 0) < 0;
      out.push(I.cooldown(doc.id, item.id, turns, down ? "reduce" : "increase"));
    }
  }
  return out;
}

/**
 * A cooldown reduction sized by a board census: "reduce Semiramis' NP
 * Cooldown by X, where X = number of enemy Units on the board with the
 * 'Dove' effect (max Cooldown reduction = 1◈ Turns)" (Familiar: Doves).
 *
 * Reuses the ordinary predicate grammar (`rules/predicate.mjs`) against each
 * candidate unit's own roll options, rather than inventing a `@count(...)`
 * expression syntax the predicate language has no aggregate form for — the
 * count is a per-unit membership test summed over the board, which `test()`
 * already answers one unit at a time.
 *
 * @param {object} change `{countMatching: {relation, requires}, maxTicks?}`
 * @param {object} doc the caster, whose relation to each candidate is asked
 * @param {object|null} board
 * @returns {number}
 */
function countMatchingTurns(change, doc, board) {
  const self = board?.units?.find((u) => u.id === doc.id) ?? unitSnapshot(doc);
  const spec = change.countMatching;
  const count = (board?.units ?? []).reduce((n, u) => {
    if (spec.relation && relationOf(self, u, board) !== spec.relation) return n;
    const options = rollOptionsFor({ attacker: u });
    return testPredicate(spec.requires ?? [], { options }) ? n + 1 : n;
  }, 0);

  if (change.maxTicks === undefined) return count;
  const cap = resolveTicks(
    parseTick(change.maxTicks), { turnsPerRound: game.settings.get("fgt", "turnsPerRound") },
  );
  return Math.min(count, cap);
}

/**
 * Which of a Unit's abilities a cooldown change reaches.
 *
 * Three selectors. `abilityId` names one, `category` names a family -- Medea has
 * seven Spells and naming each would go stale -- and `scope: np` names every
 * Noble Phantasm, which is what a sheet means by *"its NP Cooldown"* when the
 * Unit it is aimed at is somebody else's and may have two.
 *
 * @param {object} change
 * @param {object} doc the target's actor document
 * @returns {object[]}
 */
function selectAbilities(change, doc) {
  if (change.scope === "np") {
    return doc.items.filter((i) => i.type === "noblePhantasm" || i.system?.categorizedAsNP);
  }
  if (change.category) return doc.items.filter((i) => i.system?.category === change.category);
  return [doc.items.get(change.abilityId)].filter(Boolean);
}

/**
 * The intents a `statChange` phase produces.
 *
 * Three shapes, and all three are on EMIYA's *Trace, On*:
 *
 *   - `delta`, the plain case.
 *   - `percentOfMax`, because "reduce his Health by 5% of its maximum value"
 *     is not a fixed number and 5% of a nearly-dead Servant's CURRENT Health is
 *     a rounding error — the same distinction Medea's heal draws.
 *   - `max: true`, which moves the ceiling; with `alsoCurrent` the pool comes
 *     up with it, which is what "Max **and current** Luck are increased by 5"
 *     means and what `Max HpUp` does in the other direction.
 *
 * `floor` limits THIS deduction rather than the pool: "cannot drop below 1 in
 * this way" leaves ordinary damage free to finish the job.
 *
 * @param {object} phase
 * @param {string} unitId
 * @param {object} doc the target's actor document
 * @returns {object[]}
 */
function statChanges(phase, unitId, doc) {
  /** @type {object[]} */
  const out = [];

  for (const change of phase.changes ?? []) {
    const path = change.max ? `${change.stat}.max` : `${change.stat}.value`;
    const max = doc.system?.[change.stat]?.max ?? 0;
    const raw = change.percentOfMax !== undefined
      ? Math.trunc(max * (change.percentOfMax / 100))
      : (change.delta ?? 0);
    if (raw === 0) continue;

    const delta = applyFloor(raw, change.floor, doc.system?.[change.stat]?.value ?? 0);
    if (delta === 0) continue;

    out.push(I.statDelta(unitId, path, delta, change.clamp !== false));
    // A maximum that carries its pool with it.
    if (change.max && change.alsoCurrent) out.push(I.statDelta(unitId, `${change.stat}.value`, delta, false));
  }
  return out;
}

/**
 * Trim a deduction so it cannot take the pool below `floor`.
 * @param {number} delta @param {number|undefined} floor @param {number} current
 * @returns {number}
 */
function applyFloor(delta, floor, current) {
  if (typeof floor !== "number" || delta >= 0) return delta;
  return -Math.min(Math.max(0, current - floor), Math.abs(delta));
}

/**
 * Ask the player which of several effects to apply, and apply it.
 *
 * The one place in the reference set where the CHOICE is the rule rather than a
 * convenience: *"apply one of the following effects of your choice to EMIYA —
 * Activated Circuits (AC) or Blazing Circuits (BC)"*, and the closing note that
 * a later use "can choose to swap from AC to BC or vice-versa". Picking a
 * default would quietly halve the Skill.
 *
 * The swap needs no code of its own: the two effects `block` each other, so
 * applying one removes the other.
 *
 * @param {object} phase
 * @param {object} ability
 * @param {object} actor
 * @param {object} snapshot the target's snapshot
 * @returns {Promise<object[]>}
 */
async function runChoice(phase, ability, actor, snapshot) {
  const options = phase.options ?? [];
  if (options.length === 0) return [];

  // Imported dynamically, like the other two dialogs this file opens: the
  // engine is layer 3 and the dialog is layer 4, so a static import would be a
  // layer inversion the checker rejects.
  const { ChoiceDialog } = await import("../apps/choice-dialog.mjs");
  const picked = await ChoiceDialog.pick({
    title: ability.name,
    hint: phase.prompt ? game.i18n.localize(phase.prompt) : "",
    count: phase.count ?? 1,
    options: options.map((o) => ({
      id: o.id,
      name: o.label ?? EffectRegistry.get(o.id)?.name ?? o.id,
      detail: EffectRegistry.get(o.id)?.description ?? "",
    })),
  });
  // Dismissing is an answer. Nothing is applied, and nothing else in the use is
  // rolled back — the Skill's other clauses already happened.
  if (!picked?.length) return [];

  /** @type {object[]} */
  const out = [];
  for (const id of picked) {
    const spec = options.find((o) => o.id === id) ?? { id };
    out.push(...await applyPhaseEffects({ effects: [spec] }, ability, actor, snapshot));
  }
  return out;
}

/**
 * A cooldown reduction the player shapes.
 *
 * EMIYA's *Tracing* is the only one in the reference set: *"reduce the
 * Cooldowns of **2 different** Skills or NP with 'Projection' in its name by
 * 1◈ Turns **OR** reduce the Cooldown of a Skill/NP with 'Projection' in its
 * name by 2◈ Turns."* Two decisions — the shape, then the abilities — and both
 * belong to the player, so neither can be resolved by picking a default.
 *
 * "With 'Projection' in its name" is a naming convention; the match is on
 * `category`, which every Projection document carries. Naming them one by one
 * would go stale the moment a fifth was written.
 *
 * @param {object} phase
 * @param {object} ability
 * @param {object} doc the caster's actor document
 * @returns {Promise<object[]>}
 */
async function chosenCooldowns(phase, ability, doc) {
  const { ChoiceDialog } = await import("../apps/choice-dialog.mjs");
  const spec = phase.choose ?? {};
  const options = spec.options ?? [];
  if (options.length === 0) return [];

  const shape = (await ChoiceDialog.pick({
    title: ability.name,
    hint: game.i18n.localize("FGT.Skill.ChooseCooldownShape"),
    count: 1,
    options: options.map((o) => ({ id: o.id, name: o.label ?? o.id })),
  }))?.[0];
  if (!shape) return [];

  const picked = options.find((o) => o.id === shape);
  const turns = resolveTicks(parseTick(picked.ticks), {
    turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
  });

  // Only abilities with something to reduce. Offering one at zero would let the
  // player spend half the Skill on nothing, and "2 DIFFERENT" is enforced by
  // the dialog returning a set of distinct ids.
  const candidates = doc.items.filter((i) =>
    i.system?.category === spec.category && (i.system?.cooldown?.remaining ?? 0) > 0);
  if (candidates.length === 0) return [];

  const chosen = await ChoiceDialog.pick({
    title: ability.name,
    hint: game.i18n.format("FGT.Skill.ChooseCooldownTargets", { turns }),
    // Fewer candidates than the shape asks for is not a refusal: reduce what
    // there is. The alternative is a Skill that cannot be used at all because
    // only one Projection happens to be running.
    count: Math.min(picked.count ?? 1, candidates.length),
    options: candidates.map((i) => ({
      id: i.id,
      name: i.name,
      subtitle: `${i.system.cooldown.remaining} turn(s) left`,
    })),
  });
  if (!chosen?.length) return [];

  return chosen.map((id) => I.cooldown(doc.id, id, turns, "reduce"));
}

/**
 * Which effect ids a `removeEffect` phase strips.
 *
 * A `selector` matches by **polarity** rather than by name -- "remove all
 * debuffs" has to cover debuffs authored after the Skill was written, and a
 * name list would silently stop covering them.
 *
 * @param {object} phase
 * @param {object} doc
 * @returns {string[]}
 */
function removals(phase, doc) {
  const named = (phase.effects ?? [phase.effect]).filter(Boolean).map((e) => e.id ?? e);
  if (named.length > 0) return named;

  const selector = phase.selector ?? null;
  if (!selector) return [];

  return doc.effects
    .filter((e) => {
      const def = EffectRegistry.get(e.system?.defId);
      if (!def) return false;
      if (selector.polarity && def.polarity !== selector.polarity) return false;
      // An unremovable effect stays: Appendix A marks a few that no cleanse
      // reaches, and a blanket "remove all debuffs" must not be the exception.
      return !def.unremovable;
    })
    .map((e) => e.system.defId);
}

/**
 * Which abilities this Unit has already used this Turn.
 *
 * Read as **stale-by-tick** like the rest of turn state: a list stamped with an
 * earlier tick is spent whatever it says, so a missed reset cannot leave a
 * Servant permanently unable to use half its Skills.
 *
 * @param {object} actor
 * @returns {string[]}
 */
function usedThisTurn(actor) {
  const state = actor.system?.turnState ?? {};
  const now = game.combat?.system?.globalTurn ?? 0;
  return state.tick === now ? [...(state.abilitiesUsed ?? [])] : [];
}

/**
 * Ask which kind of summon to conjure, for a "your choice" entry.
 *
 * Dragon Tooth Warriors rolls 1d4 per Warrior and entry 4 is *"your choice of
 * Blade, Bow or Daggers"* -- a prompt rather than a fourth statblock.
 *
 * @param {object} spec
 * @returns {Promise<string|null>}
 */
async function chooseSummonType(spec) {
  const { ChoiceDialog } = await import("../apps/choice-dialog.mjs");
  const picked = await ChoiceDialog.pick({
    title: game.i18n.localize("FGT.Summon.ChooseType"),
    hint: game.i18n.localize("FGT.Summon.ChooseTypeHint"),
    count: 1,
    options: (spec.choiceFrom ?? []).map((id) => ({ id, name: id })),
  });
  return picked?.[0] ?? null;
}

/**
 * Raise `abilityUsed` on the Unit that used it.
 *
 * §E.3 has listed the event since the reference was written and nothing ever
 * raised it, so the two clauses in the reference set that key on *using* an
 * ability rather than on its outcome could not fire: EMIYA's *Magecraft*
 * (*"whenever EMIYA uses a Thaumaturgy Spell, apply Range Up"*) and the
 * duration extension on his *Atk Up (Trace)*.
 *
 * The used ability travels in `ctx.subject`, which is what a handler's
 * `ofCategory` filter reads -- the event is about something, and a handler
 * that cannot ask what would have to fire on every ability in the game.
 *
 * Fired AFTER the phases have resolved, because the sheet's wording is "uses",
 * and a Skill that was refused mid-resolution has not been used.
 *
 * @param {object} actor
 * @param {object} ability
 * @returns {Promise<void>}
 */
export async function fireAbilityUsed(actor, ability) {
  const unit = unitSnapshot(actor);
  const intents = fireEvent("abilityUsed", [unit], {
    tick: game.combat?.system?.globalTurn ?? 0,
    turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
    board: currentBoard(),
    options: new Set(),
    rolls: {},
    subject: {
      id: ability?.id ?? null,
      contentId: ability?.system?.contentId ?? null,
      category: ability?.system?.category ?? null,
      isNP: ability?.type === "noblePhantasm" || Boolean(ability?.system?.isNP),
    },
  });
  if (intents.length > 0) await applyWorldIntents(intents, "abilityUsed");
}

/**
 * Run the phases a Combat Process has no rung for.
 *
 * A Noble Phantasm resolves through `resolveAttack`, which knows about damage
 * and about the effects that ride on it — and about nothing else. Every other
 * phase kind an ability can carry is `useSkill`'s business, so an NP that
 * spends a Resource, opens a bounded field, conjures a squad or asks the player
 * a question **silently did none of it**.
 *
 * EMIYA's Unlimited Blade Works is the case that found it: it consumed no Aria
 * and created no Reality Marble, while charging his Master the full cost.
 *
 * Run once, from the caster, before the fan-out: these are things the ability
 * does to its user, not to each defender.
 *
 * @param {object} ability
 * @param {object} actor
 * @param {object} board
 * @returns {Promise<object[]>}
 */
export async function runCasterPhases(ability, actor, board) {
  // The caster IS the resolved target list here. Passing an empty one made
  // every phase that had not written `target: self` resolve to `reuse` and then
  // to nobody, so the loop body never ran -- Unlimited Blade Works spent its
  // Aria (a `target: self` phase) and created no Reality Marble (which is not).
  return runPhases(ability, actor, [{ unitId: actor.id }], board, (phase) => CASTER_PHASES.has(phase.kind));
}

/**
 * The phase kinds the attack flow delegates here.
 *
 * `damage` and `applyEffects` are deliberately absent: the first is the Combat
 * Process itself and the second is its rider step, which resolves per defender
 * and after the damage has landed.
 */
const CASTER_PHASES = new Set([
  "resource", "statChange", "cooldown", "removeEffect", "summon", "createField", "choose", "heal",
]);
