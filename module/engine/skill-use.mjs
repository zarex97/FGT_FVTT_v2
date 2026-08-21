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
} from "../rules/ability-use.mjs";
import { effectivePhases } from "../rules/copy.mjs";
import { resolveTargets } from "../rules/targeting/resolve.mjs";
import { applyEffect, inflictBonusOf } from "./effect-applier.mjs";
import { EffectRegistry } from "../rules/registry.mjs";
import { parseTick, resolveTicks } from "../domain/tick.mjs";
import { currentBoard, unitFrom, unitSnapshot } from "./board.mjs";
import { applyWorldIntents } from "./applier.mjs";
import * as budget from "./budget.mjs";
import * as I from "./intents.mjs";

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
    // Recorded so a mutually-exclusive partner can see it went. Content ids,
    // because that is what `sameTurnExclusive` names.
    abilitiesUsed: [...usedThisTurn(actor), ability.system?.contentId || ability.id],
  };

  await applyWorldIntents([
    ...(usage.cost ? costIntents(usage.cost) : []),
    ...cooldownIntents(ability, actor),
    I.markTurn(actorId, marks),
    I.log({
      kind: "ability", event: "skillUsed",
      unitId: actorId, abilityId, name: ability.name,
      targets: targets.units.map((t) => t.unitId),
      applied: applied.map((a) => a.summary),
    }),
  ], `skill:${abilityId}`);

  if (combat?.started) await budget.spend({ combat, unit: self, action: asAttack ? "normal" : "skill" });
  await postCard(actor, ability, targets.units, applied);

  return { ok: true, applied };
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
async function runPhases(ability, actor, targets, board) {
  /** @type {object[]} */
  const applied = [];

  for (const phase of effectivePhases(ability.system ?? {}, resolveSource)) {
    for (const target of targets) {
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
            (phase.changes ?? []).map((c) => I.statDelta(target.unitId, `${c.stat}.value`, c.delta, c.clamp !== false)),
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
            cooldownChanges(phase, doc),
            `skill:${ability.id}:cooldown`,
          );
          break;

        case "removeEffect":
          await applyWorldIntents(
            removals(phase, doc).map((id) => I.removeEffect(target.unitId, id, "skill")),
            `skill:${ability.id}:remove`,
          );
          break;

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
  return applied;
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
      duration: rule.duration ?? spec.duration ?? def.defaultDuration,
      source: { unitId: actor.id, abilityId: ability.id },
      ctx: {
        turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
        currentTick: game.combat?.system?.globalTurn ?? 0,
        roll: roll.total,
        // The attacker's own outgoing `ApplicationChance` contributions.
        // Hardcoded to 0 until Medea's Item Construction needed it, which
        // made every outgoing contribution in the game inert.
        inflictBonus: inflictBonusOf(unitSnapshot(actor), def),
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

/** @param {object} ability @param {object} actor @returns {object[]} */
function cooldownIntents(ability, actor) {
  // `max` is the authored tick expression; `remaining` is the running clock.
  // Reading `.value` -- which does not exist on this schema -- silently produced
  // no cooldown at all, so every Skill was reusable the moment it resolved.
  const raw = ability.system?.cooldown?.max ?? null;
  if (!raw || typeof raw === "number") return [];

  try {
    const ticks = resolveTicks(parseTick(String(raw)), {
      turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
    });
    return ticks > 0 ? [I.cooldown(actor.id, ability.id, ticks, "set")] : [];
  } catch {
    console.warn(`FGT | ${ability.name} has an unreadable cooldown "${raw}".`);
    return [];
  }
}

/** @param {object} cost @returns {object[]} */
function costIntents(cost) {
  // `statDelta`, never `damage` -- Health *loss* must not feed damage-keyed
  // triggers (Ch. 06). Same reason as the attack path.
  if (!cost?.unitId) return [];
  const path = cost.kind === "sustainability" ? "sustainability" : "health.value";
  return [
    I.statDelta(cost.unitId, path, -cost.amount, false),
    I.log({ kind: "cost", cost: cost.kind, amount: cost.amount, unitId: cost.unitId }),
  ];
}

/** @param {object} ability @returns {object} */
function usageSpec(ability) {
  const sys = ability.system ?? {};
  return {
    id: ability.id,
    isNP: ability.type === "noblePhantasm" || Boolean(sys.isNP),
    rank: sys.rank,
    cooldown: sys.cooldown,
    requiresRound: sys.targeting?.limits?.requiresRound ?? null,
    requirements: sys.targeting?.limits?.requirements ?? sys.requirements ?? [],
  };
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
 * @returns {object[]}
 */
function cooldownChanges(phase, doc) {
  /** @type {object[]} */
  const out = [];

  for (const change of phase.changes ?? []) {
    const targets = change.category
      ? doc.items.filter((i) => i.system?.category === change.category)
      : [doc.items.get(change.abilityId)].filter(Boolean);

    for (const item of targets) {
      // `set: 0` is "completely reduce", which is a set rather than a subtract:
      // a reduce of some large number would work by accident and read as a bug.
      if (change.set !== undefined) out.push(I.cooldown(doc.id, item.id, change.set, "set"));
      else out.push(I.cooldown(doc.id, item.id, Math.abs(change.delta ?? 0), (change.delta ?? 0) < 0 ? "reduce" : "set"));
    }
  }
  return out;
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
