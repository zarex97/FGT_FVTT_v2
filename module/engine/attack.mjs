/**
 * @file The attack flow — declaration through to applied damage.
 * @see docs/12-combat-process.md, docs/27-reaction-protocol.md
 *
 * Layer 3. This is the orchestrator: it drives the Combat Process state
 * machine, asks humans for their rungs, runs the pure pipeline, and applies the
 * result. It does not decide anything the rules layer can decide.
 *
 * The process state is stored on a **chat message flag** rather than in memory,
 * because the ladder spans up to five prompts across two clients and has to
 * survive a reconnect (Ch. 27). Every rung re-reads it, advances it, and writes
 * it back.
 */

import { computeDamage, INJURY_THRESHOLD } from "../rules/damage/pipeline.mjs";
import { displaceToken } from "./io.mjs";
import { resolveTargets } from "../rules/targeting/resolve.mjs";
import { currentBoard, unitSnapshot, unitFrom } from "./board.mjs";
import {
  evade as evadeCheck, luckCheck, chance, checkPlan, critChance, mergePlans,
  pendingCheckRolls, resolveCheck,
} from "../rules/checks.mjs";
import * as rollLog from "../rules/roll-log.mjs";
import { effectivePhases } from "../rules/copy.mjs";
import { cooldownFor, alsoTriggered } from "./cooldown.mjs";
import { classifyAbility, targetSpecFor as specForAbility, usageSpecFor } from "../rules/ability-use.mjs";
import { counterRedirect } from "../rules/counter.mjs";
import { Rank } from "../domain/rank.mjs";
import { lookup } from "../domain/tables.mjs";
import { inAttackRange, chebyshev } from "../domain/geometry.mjs";
import { rollOptionsFor } from "../rules/options.mjs";
import { collectContributions, resolveValue } from "../rules/elements.mjs";
import { test as testPredicate } from "../rules/predicate.mjs";
import { normalAttackAt } from "../rules/normal-attack.mjs";
import { actionSourceFor } from "../rules/platforms.mjs";
import { GRANTS, hasGranted } from "../rules/granted.mjs";
import { coveringServantsFor, coverFactor, shoveDestination, isCovering } from "../rules/cover.mjs";
import { absorb, refreshShield } from "./shield.mjs";
import { attackIdentity, recordedAttack } from "../rules/revival.mjs";
import { expressionRefs, stacksHeld } from "../rules/snapshot.mjs";
import { removalPlan, pendingRemovalRolls } from "../rules/removal.mjs";
import { isStrongestNP, isDamagingNP, EXPECTED_ATTACK_ROLL } from "../rules/np-strength.mjs";
import { currentHealth } from "../domain/health.mjs";
import * as process from "./combat-process.mjs";
import * as I from "./intents.mjs";
import { applyIntents } from "./applier.mjs";
import { worldIO } from "./io.mjs";
import { offerWeakPoint, resolveWeakPoint, weakPointIntents } from "./weak-point.mjs";
import { luckChecksBlocked } from "../rules/bounded-fields.mjs";
import { luckChecksApply } from "../rules/difficulty.mjs";
import { renderAttackCard, updateAttackCard } from "../apps/chat/cards.mjs";
import { applyEffect, inflictBonusOf } from "./effect-applier.mjs";
import { EffectRegistry } from "../rules/registry.mjs";
import * as budget from "./budget.mjs";
import { resolveDefeat, pendingRolls, fireEvent } from "./scheduler.mjs";
import { terrainConversions } from "../rules/terrain.mjs";
import { paintTerrain, removeTerrainType } from "./terrain.mjs";
import { injuryCheck, INJURY_STAT } from "../rules/injury.mjs";
import { meetsRequirement } from "../rules/items.mjs";
import { canUseAbility, resolveCosts, npCostAt } from "../rules/costs.mjs";
import {
  reactionAbilities, allyReactions, abilityFromOption, abilitiesAtWindow,
} from "../rules/reactions.mjs";
import { attacksPermitted, mayAttackCivilian, civilianKill } from "../rules/environment.mjs";
import { resolveOverpower, resolveUnderpower, mayOrderAnotherServant } from "../rules/relationships.mjs";
import { reactionsRefused, aoeOutcome, isConcealed } from "../rules/concealment.mjs";
import { selectBranch, isNestedCheck, MAX_CHECK_DEPTH } from "../rules/checks/branches.mjs";
import { publicSpeakerFor, publicIdentityOf } from "./public-identity.mjs";

/**
 * Declare an attack. Runs on the GM client (Model B — contested outcomes are
 * computed where the authoritative snapshot lives).
 *
 * @param {object} args
 * @param {string} args.attackerId
 * @param {string} args.abilityId  `null` for a normal attack
 * @param {object} args.placement  the player's targeting choices
 * @returns {Promise<{messageId: string, state: object}>}
 */
export async function resolveAttack({ attackerId, abilityId, placement, resume = false }) {
  const attacker = game.actors.get(attackerId);
  if (!attacker) throw new Error(`FGT | Unknown attacker ${attackerId}`);

  const board = boardSnapshot();
  // From the board, not projected alone: ZON is pairwise, so only the board
  // knows whether this Servant is inside its Master's zone -- and that is what
  // `limits.requiresZon` on every Noble Phantasm turns on.
  const self = unitFrom(board, attacker);
  const ability = abilityId ? attacker.items.get(abilityId) : null;
  // The caster's own options, for `targeting.branches`/`cooldown.branches`/
  // `damage.branches` (Summoning: Bašmu) -- computed once here rather than
  // per call site, since `self` does not change across this declaration.
  const options = rollOptionsFor({ attacker: self });

  // Pale Rider's Riding EX passive 3: *"Pale Rider cannot perform Normal
  // Attacks."* Refused ahead of the budget, so the message names the rule
  // rather than reporting an attack slot he was never going to spend -- and
  // ahead of the cost check, because a refused declaration costs nothing.
  //
  // A grant rather than a Range of 0: his sheet prints Base Attack (MAG) 200,
  // which an Attack Skill or a Spell could still spend, and a zero Range would
  // have refused those too.
  if (!ability && hasGranted(self, GRANTS.noNormalAttack)) {
    throw new Error(`FGT | ${attacker.name} cannot perform Normal Attacks.`);
  }

  // The budget is checked before the targeting is resolved, so a player who
  // has no attacks left is told that rather than being told their target is
  // out of range. Refusals are cheap; a half-resolved attack is not.
  const combat = game.combats.active;
  const actionKind = budgetActionFor(ability ? abilityKind(ability) : "normal");
  if (combat?.started) {
    const verdict = budget.affordable(combat, self, actionKind);
    if (!verdict.ok) throw new Error(`FGT | Cannot attack: ${verdict.reason}`);
  }

  // Costs are **validated** at declaration and **paid** at confirmation
  // (§15.4): cancelling during targeting must cost nothing, and no rule
  // requires otherwise. So this refuses early, and the payment is below.
  const master = self.masterId ? unitFrom(board, game.actors.get(self.masterId)) : null;
  const usage = canUseAbility({
    ability: abilityUsageSpec(ability),
    unit: self,
    master,
    round: combat?.round ?? 1,
    // The rest of §15.4's requirement kinds need more than the unit: a
    // counterpart check reads the board, and a target-effect check reads the
    // target. Passing neither made those two kinds silently unsatisfiable.
    board,
    target: placement?.targetId ? unitFrom(board, game.actors.get(placement.targetId)) : null,
    // The same gap `engine/skill-use.mjs`'s `useSkill` had: the `predicate`
    // requirement kind (`rules/items.mjs`) refused every use on the ATTACK
    // path too, unconditionally, for the same reason -- nothing ever
    // supplied `ctx.testPredicate`. Semiramis's Summoning: Bašmu is the
    // first damage-dealing ability that names one.
    // The DEFENDER too, when the declaration already names one. A `predicate`
    // requirement mentioning `target:` was unsatisfiable in EVERY case: this
    // built the option set from the attacker alone, so
    // `target:attribute:female` -- the second of the three gates on Jack's
    // Maria the Ripper -- could never be true. The target is resolved a few
    // lines above for the other requirement kinds that need it, and was simply
    // never handed to this one.
    testPredicate: (p) => testPredicate(p, {
      options: rollOptionsFor({
        attacker: self,
        defender: placement?.targetId ? unitFrom(board, game.actors.get(placement.targetId)) : null,
      }),
    }),
  });
  // CS: Force Noble Phantasm bypasses the cooldown and uses-exhausted gates.
  // It explicitly cannot bypass the Round gate, so `overrides` is consulted per
  // reason rather than as a blanket "skip validation".
  const overridden = (placement?.overrides ?? []).includes(usage.reason);
  if (!usage.ok && !overridden) throw new Error(`FGT | Cannot use this ability: ${usageRefusal(usage)}`);

  // §16.7: at 25 Health or less a Master cannot order more than one of its
  // Servants to Act. Enforced here, where it composes with the ordinary budget.
  if (master && combat?.started) {
    const siblings = board.units.filter((u) => u.masterId === master.id && u.id !== self.id);
    const allowed = mayOrderAnotherServant(master, siblings, { grandOrder: game.settings.get("fgt", "grandOrder") });
    if (!allowed.ok) {
      throw new Error("FGT | This Master is at 25 Health or less and cannot order a second Servant to Act.");
    }
  }

  // "During the first Round, neither Player/Faction is allowed to Attack"
  // (§19.7 step 12). A hard gate at declaration, so the refusal names the rule
  // instead of letting a player discover it as an unexplained targeting error.
  if (combat?.started && !attacksPermitted(combat.round ?? 1) && actionKind !== "skill") {
    throw new Error("FGT | No attacks are permitted during the first Round.");
  }

  // A Riding Attack supplies its own target list: *"Can Attack all Units in
  // its path while Moving in a straight line as its Normal Attack"*, and a
  // Normal Attack's own spec picks ONE unit. The path decided who is hit
  // before this was called, so the shape is a straight-line multi-target for
  // this declaration only -- not a change to what a Normal Attack is.
  const spec = placement?.pathTargets
    ? {
      anchor: { kind: "self" },
      shape: { kind: "unit" },
      selection: { relations: ["enemy"], chooser: "all" },
      pathTargets: placement.pathTargets,
    }
    : targetSpecFor(attacker, ability, options);
  // The scale travels with the placement so the isolation filter can honour a
  // field's `piercedBy` -- see `rules/targeting/resolve.mjs` step 4c.
  const targets = spec.pathTargets
    ? {
      units: spec.pathTargets.map((id) => ({ unitId: id, distance: 0, band: 0, relation: "enemy" })),
      panels: [], anchor: {}, warnings: [], errors: [], needsChoice: false,
      candidates: [], excluded: [],
    }
    : resolveTargets(spec, self, board, {
      ...placement, npTags: [...(ability?.system?.npTags ?? [])],
    });

  if (targets.errors.length > 0) {
    throw new Error(`FGT | Illegal attack: ${targets.errors.join(" ")}`);
  }
  if (targets.needsChoice) {
    return { needsChoice: true, candidates: targets.candidates };
  }

  // Declaring the attack is what spends the budget, not landing it: a Noble
  // Phantasm that misses still consumed the Servant's attack for the turn, and
  // *"non-damaging NPs count as the Unit's Attack for that Turn"* says so
  // explicitly.
  // `resume` is the second half of a PRE-EMPTED declaration (see
  // `offerPreemption`): the budget, the costs and the cooldown were all paid
  // when the attack was first declared, before the defender swung first.
  // Charging them again would bill a Servant twice for one attack.
  if (combat?.started && !resume) {
    await budget.spend({ combat, unit: self, action: actionKind });
    const isAttack = actionKind !== "skill";
    await applyBatch(
      [I.markTurn(attackerId, isAttack
        ? { attacked: true, acted: true }
        : { usedActiveSkill: true, acted: true })],
      "attack:declared",
    );
  }

  // The ability's OWN price -- its shield refresh, its use record, its costs
  // and its cooldown. Shared with the §12.8 Counter path, which pays all of it
  // and none of the budget above.
  await payAbilityPrice({ ability, attackerId, attacker, self, master, usage, board, resume });

  // "Used during your Turn OR at the start of a Combat Phase" -- the attacker's
  // second window, offered once for the whole Phase rather than per Process,
  // because a Combat Phase is one exchange however many defenders it catches
  // (§E, `combatPhaseEnd`). Karna's Uncrowned Arms Mastership is the only
  // ability in the reference set that names it, and it had no moment to be used
  // at: the sheet button covers "during your Turn" and nothing covered the rest.
  //
  // After the cost and the cooldown, so an attack that was refused never opens
  // the window, and before any Process exists, so the switch is in force for the
  // crit coin it is about to change.
  const phaseWindow = resume
    ? { windowAbilities: [] }
    : await offerAttackerWindow({ attackerId }, "combatPhaseStart", null);
  if ((phaseWindow.windowAbilities ?? []).length > 0) {
    // Loud, because the alternative is this project's signature defect. A
    // non-mode ability at this window would contribute rules that only
    // `applyDamage` can fold in, and there is no Process yet to carry them to --
    // so they would be collected, discarded, and look like they had applied.
    console.warn(
      "FGT | combatPhaseStart offered a non-mode ability; its rules reach no Combat Process:",
      phaseWindow.windowAbilities,
    );
  }

  // Civilians never enter a Combat Process: "the Civilian is instantly killed"
  // -- no damage calculation, no reaction ladder, no Overpower (Ch. 04 §4.6).
  // Resolved here, before any Process exists, because a Process that always
  // ends the same way is a ladder with one rung.
  const civilians = targets.units
    .map((t) => board.units.find((u) => u.id === t.unitId))
    .filter((u) => u?.kind === "civilian");
  if (civilians.length > 0) {
    const verdict = mayAttackCivilian(self, { overrides: placement?.overrides ?? [] });
    if (!verdict.ok) {
      throw new Error(
        "FGT | A Good-aligned Servant will not kill Civilians. " +
        "Spend a Command Spell (Kill Humans) to override.",
      );
    }
    const descriptors = civilians.flatMap((c) => civilianKill(self, c));
    await applyBatch(civilianIntents(descriptors), "civilianKill");
  }

  // One Combat Process per target — which is what the comment here has always
  // said, and what the code did not do. It took `targets.units[0]` and dropped
  // the rest, so a Noble Phantasm over seven units damaged one of them.
  const attackSpec = buildAttackSpec({ attacker, ability, abilityId, options, placement });
  // "EMIYA performs 2 Normal Attacks in a row." Two Combat PROCESSES against
  // the same defender, inside ONE Combat Phase -- which is the distinction that
  // matters, because a Combat Phase is what pays him his Aria and two phases
  // would pay twice for one action.
  //
  // Bašmu's Dragon Wing Warriors: "X times, where X = a d6 roll + 4" -- a
  // repeat count decided once per declaration rather than a fixed number, so
  // `repeat` accepts `{roll}` alongside the plain integer EMIYA uses. Each
  // repeat is still its own Combat Process and so still its own Injury Roll;
  // "Damaged Units only perform an Injury Roll once regardless of number of
  // hits taken" is a known, unmodelled simplification -- see basmu.yml.
  const repeatSpec = resolvedDamage(ability, options)?.repeat ?? 1;
  const repeat = Math.max(
    1,
    repeatSpec && typeof repeatSpec === "object" && repeatSpec.roll
      ? (await new Roll(repeatSpec.roll).evaluate()).total
      : repeatSpec,
  );
  const targetIds = targets.units.flatMap((t) => Array.from({ length: repeat }, () => t.unitId));

  // The Hanging Gardens' activation: "If Semiramis is Attacked during this
  // period, the period... is interrupted." Declared against, not necessarily
  // hit -- fired here, at declaration, rather than after the damage step.
  if (targetIds.length > 0) {
    const { interruptChannels } = await import("./channel.mjs");
    await interruptChannels(targetIds);
  }

  // "Whenever Jack is Attacked by an enemy Unit, and the AU is within Jack's
  // Range, Jack can Attack first INSTEAD of the opposing Unit."
  //
  // Offered after the declaration is fully paid for and before any Process
  // exists, because the pre-emption replaces the ORDER of this exchange rather
  // than any part of its cost: a pre-empted attacker has still spent its
  // attack for the Turn whether or not it survives to swing.
  if (!resume && targetIds.length > 0) {
    const preempted = await offerPreemption({
      attackerId, abilityId, placement, targetIds, board, self,
    });
    if (preempted) return { preempted: true, messageId: preempted.messageId };
  }

  // "Can be used when a Noble Phantasm is used against Mannanán." The one
  // ability in the corpus that CANCELS another Unit's resolution rather than
  // answering it, and the reason the interrupt machinery had to be generalised
  // past Command Spells (§17.1).
  //
  // Offered at the same moment a pre-emption is, and for the same reason: after
  // the attacker has paid in full, before any Combat Process exists. The
  // attacker still spent its Noble Phantasm — that is what "cancelled" means
  // here, and it is the whole cost of walking into her.
  if (!resume && targetIds.length > 0 && isDamagingNP(ability)) {
    const cancelled = await offerNPCancellation({
      attackerId, attacker, ability, targetIds, board, self, options,
    });
    if (cancelled) return { cancelled: true, ...cancelled };
  }

  // The rest of a declaration -- the fan-out, the cards, the events -- is
  // shared with the §12.8 Counter path, which needs every step of it.
  const primary = await declareProcesses({
    attackerId, attacker, ability, attackSpec, targetIds, targets, placement, board,
  });

  await declareAftermath({
    attackerId, attacker, ability, attackSpec, board, placement, targetIds,
    groupId: primary.groupId,
  });

  return primary;
}

/**
 * A second, unconditional resolution the same ability declares.
 *
 * > *"Then (regardless of whether the NP hits the DU or not), deals normal
 * > damage to all Units within a 2 panel area of Quetzalcoatl except herself and
 * > the previously targeted Unit (Base Attack (MAG) is used)..."*
 * > — Xiuhcoatl
 *
 * **Not an area attack with a hole in it.** It fires from a different anchor
 * (her, not the target), on a different base attack (MAG alone, not the
 * combined 250), at a different multiplier (1×, not 4×), and carries different
 * riders — Burn for 1◈ and NP Seal at 25%, against the primary's Burn for 2◈
 * and NP Seal outright. Four numbers, none of them shared.
 *
 * Declared BESIDE the primary rather than chained behind it, and
 * `unconditional` is why: the sheet does not wait to see what the first
 * resolution achieved, so there is nothing to wait for. Sequencing it after the
 * group would also mean holding it across every defender's reaction ladder, and
 * a splash that lands several player decisions later is not what "then" means.
 *
 * It shares the primary's `groupId`, so the two are one Combat Phase.
 *
 * @param {object} args
 * @returns {Promise<void>}
 */
async function declareAftermath({
  attackerId, attacker, ability, attackSpec, board, placement, targetIds, groupId,
}) {
  const spec = ability?.system?.aftermath ?? null;
  if (!spec?.unconditional) return;

  const self = board.units.find((u) => u.id === attackerId);
  if (!self) return;

  // The anchor of the resolution that just happened, which the splash excludes.
  const primaryTargetId = placement?.unitId ?? placement?.targetId ?? targetIds[0] ?? null;
  const caught = resolveTargets(spec.targeting, self, board, { primaryTargetId });
  if ((caught.units ?? []).length === 0) return;

  await declareProcesses({
    attackerId,
    attacker,
    ability,
    // The primary's flags (`ignoresMagicResistance`, the NP kind, the rank)
    // still describe the same Noble Phantasm; only the damage differs, so the
    // spec is overlaid rather than rebuilt.
    attackSpec: { ...attackSpec, ...(spec.damage ?? {}), isAftermath: true },
    targetIds: caught.units.map((t) => t.unitId),
    targets: caught,
    placement: null,
    board,
    groupId,
  });
}



/**
 * Charge an ability's own price: its use record, its costs and its cooldown.
 *
 * Separated from the BUDGET immediately above its old home, because a §12.8
 * Counter pays one and not the other. A Counter costs no turn — it is a
 * reaction — but the Noble Phantasm it is declared with costs exactly what it
 * would on the counterer's own turn. Without this split a Servant could
 * answer every attack with its Noble Phantasm forever, since the cooldown is
 * the only thing most of them cost.
 *
 * `resume` is the second half of a PRE-EMPTED declaration: everything here
 * was paid when the attack was first declared, and charging it again would
 * bill a Servant twice for one attack.
 *
 * @param {object} args
 * @returns {Promise<void>}
 */
async function payAbilityPrice({ ability, attackerId, attacker, self, master, usage, board, resume }) {
  if (resume) return;

  // A barrier is refreshed on the way up, BEFORE the use is recorded: *"every
  // time Rho Aias is used after its first usage, its Health is restored by half
  // of its current Health"*, and `refreshShield` decides first-versus-later
  // from the same counter `recordUse` is about to increment.
  if (ability?.system?.shield) await refreshShield(ability);

  // The record every use gate reads: `oncePerTurn`, both exclusion scales and
  // the whole-match use budget. An ABILITY rule, not a turn rule, which is why
  // it moved here from beside the budget spend -- a Counter records its use and
  // pays no turn.
  if (ability) {
    await applyBatch(
      [I.recordUse(attackerId, ability.id, ability.system?.contentId ?? null)],
      "attack:declared",
    );
  }


  // Confirmation: targeting is settled and legal, so the costs are now paid.
  //
  // Plural, and resolved against each other first (§15.4). A cost may declare
  // that it `supersedes` another -- Karna's NP cost overwrites the 20 Health his
  // Master loses when he Acts, and the Hanging Gardens upkeep overwrites the NP
  // cost the other way -- and charging both would bill more than the rules say.
  const pending = resume ? [] : pendingCosts({ usage, ability, self, master, board });
  const { charged, superseded } = resolveCosts(pending);

  for (const cost of charged) await applyBatch(costIntents(cost, self), "attack:cost");

  // The cooldown, at the same moment as the cost and for the same reason: the
  // ability has been committed. `resolveAttack` never did this, so every Attack
  // Skill and every Noble Phantasm was infinitely reusable -- limited only by
  // the attack budget, which is a different rule.
  if (ability && !resume) {
    const plan = cooldownFor(ability, attackerId, { unit: self });
    const clocks = [...plan.cooldowns, ...alsoTriggered(ability, attacker)];
    const intents = [
      ...clocks.map((c) => I.cooldown(c.actorId, c.abilityId, c.ticks, "set")),
      // A waived cooldown is PAID for -- Scáthach's PRS Token. Her damaging
      // Rune Spells come through this path rather than `useSkill`, so the
      // waiver has to be honoured in both places or it works for Ár and not
      // for Þurs.
      ...plan.spends.map((sp) => I.resource(sp.unitId, sp.key, sp.delta)),
    ];
    if (intents.length > 0) await applyBatch(intents, "attack:cooldown");
  }
  if (superseded.length > 0) {
    // Logged, because a Master who paid 50 where they expected 70 needs to see
    // which rule did that; a silently smaller number reads as a bug.
    await applyBatch(
      [I.log({ kind: "cost", event: "superseded", superseded, unitId: master?.id ?? self.id })],
      "attack:cost",
    );
  }
}
/**
 * The `attack` descriptor a Combat Process carries.
 *
 * Extracted alongside `declareProcesses` and for the same reason: a §12.8
 * Counter declares a real attack, so it needs a real spec, and building a
 * second one beside this would be the copy nobody updates. Every field here
 * exists because some rule reaches for it and cannot reach the ability
 * document — the comments say which.
 *
 * @param {object} args
 * @param {object} args.attacker the Actor
 * @param {object|null} args.ability
 * @param {string|null} args.abilityId
 * @param {object|null} args.options roll options for the attacker
 * @param {object} [args.placement] the declaration's placement, for a ride's own facts
 * @returns {object}
 */
/**
 * What a Riding Attack leaves for a magnitude to read.
 *
 * The DERIVED numbers are computed here rather than in the content, because the
 * expression grammar is deliberately `N * @path` and its own comment argues
 * against widening it — *"a general arithmetic evaluator here would be an
 * expression language nobody asked for, running on data from a shared
 * compendium."* So the rounding, which is a system rule (fractions always round
 * down), lives in code; the `X0%` from the sheet stays in the content as
 * `10 * @ride.x`, where a reader comparing the two will find it.
 *
 * @param {object} placement
 * @returns {{panels: number, hitCount: number, remainingMov: number, x: number, xLessOne: number}}
 */
function rideFacts(placement) {
  const remainingMov = placement.remainingMov ?? 0;
  // *"X = (the amount of remaining MOV Achilles has divided by 2)"*, rounded
  // down by Ch. 02's blanket rule.
  const x = Math.floor(remainingMov / 2);
  return {
    panels: placement.ridePanels,
    hitCount: placement.hitCount ?? 0,
    remainingMov,
    x,
    // *"if NP (X−1)0%"*, floored at zero: a ride with nothing left must not
    // hand out a negative buff.
    xLessOne: Math.max(0, x - 1),
  };
}

function buildAttackSpec({ attacker, ability, abilityId, options, placement = null }) {
  return {
      abilityId,
      kind: ability ? abilityKind(ability) : "normal",
      // Which Base Attack this uses, and whether Magic Resistance sees it at all.
      // Both are read by Magic Resistance's Instakill/Death ladder, which is
      // exempted for *"an Attack/Attack Skill/Spell/NP that deals STR damage or
      // that is not affected by Magic Resistance"* -- a property of the attack,
      // so it has to travel with the attack.
      component: componentOf(attacker, ability, options),
      // Facts that do not exist until the ride has happened. Troias Tragōidia
      // reads two of them — how much MOV he had left when he used it, and how
      // many Units he actually reached — and neither can come off a document.
      ride: placement?.ridePanels !== undefined
        ? rideFacts(placement)
        : null,
      // Appendix A treats `Aim` and `Pierce` as properties of the ATTACK, and
      // `evade`/the pipeline have read both by name since they were written --
      // against a spec that carried neither, so no authored Noble Phantasm could
      // ever have one. EMIYA's Hrunting is Aim and his Caladbolg II is Pierce.
      aim: Boolean(resolvedDamage(ability, options)?.aim),
      pierce: Boolean(resolvedDamage(ability, options)?.pierce),
      // The damage TYPE, carried on the attack for the same reason `component` is.
      // The pipeline has read `ctx.attack.element` at stage 0 since it was written
      // -- Fire breaks Freeze, `flamHeal` converts it -- and the attack spec never
      // carried one, so `element:` on an ability document reached the pipeline
      // only through `damageContext` and never through the predicate vocabulary.
      // Karna's Mana Burst (Flames) resists by type in both directions.
      // A Normal Attack has no ability document; its element comes from the
      // unit's own `normalAttack` spec, which `normalAttackAt` resolves.
      element: resolvedDamage(ability, options)?.element ?? ability?.system?.element
        ?? (ability ? null : normalAttackAt(attacker, null)?.element) ?? null,
      // "Fire damage (half)": how much of the total carries that element, which
      // the pipeline's stage 4b scales element-scoped modifiers by. Travels
      // BESIDE `element` at all three spec-building sites, because an element
      // that arrives without its fraction is silently a whole-element attack.
      elementFraction: resolvedDamage(ability, options)?.elementFraction
        ?? ability?.system?.damage?.elementFraction ?? undefined,
      ignoresMagicResistance: Boolean(
        resolvedDamage(ability, options)?.ignoresMagicResistance ?? ability?.system?.ignoresMagicResistance,
      ),
      // Per-attack RESTRICTIONS on the reaction ladder. Appendix A treats the
      // ladder as a fixed three, and Mannanán's Fragarach Counter is the first
      // attack in the corpus that narrows it: *"A Fragarach Counter cannot be
      // Blocked, and cannot be Evaded except with Dodge."* Both are properties
      // of the ATTACK, so they travel with it -- `unblockable` removes Block
      // from the rung at declaration and `evadableOnlyBy` makes the Evade roll
      // fail automatically unless the defender holds one of the named effects.
      unblockable: Boolean(resolvedDamage(ability, options)?.unblockable),
      evadableOnlyBy: [...(resolvedDamage(ability, options)?.evadableOnlyBy ?? [])],
      // *"If the DU Evades, its Evade Roll is increased by 3."* A penalty the
      // ability imposes, alongside the ones the attack's kind and the
      // defender's own effects impose (`evadeModifiers`).
      evadeModifier: resolvedDamage(ability, options)?.evadeModifier ?? 0,
      // *"If any Evade fails, the remaining hits cannot be Evaded."* A property
      // that spans the SIBLING Processes of one multi-hit declaration, which is
      // why it is on the attack rather than on any one Process.
      noEvadeAfterFail: Boolean(resolvedDamage(ability, options)?.noEvadeAfterFail),
      // The SCALE, carried on the attack for exactly the reasons `element` and
      // `pierce` are: three separate rules ask about it and none of them can
      // reach the ability document. Doomsday Come's isolation opens for an
      // [Anti-World] NP, its vulnerability ends on one, and its interior halves
      // that one's damage -- all three keyed on tags the attack never carried.
      npTags: [...(ability?.system?.npTags ?? [])],
      // The Noble Phantasm's own RANK, beside its tags. Achilles's barrier
      // answers *"an AoE Noble Phantasm of Rank A and above"* -- a threshold on
      // the rank rather than on the scale tag, which is a different axis
      // (Ch. 43 §43.8) and the one his sheet does not use.
      rank: ability?.system?.rank ?? null,
  };
}
/**
 * Turn resolved targets into live Combat Processes: one per defender, each with
 * its reaction offer, its card, its flags and its events.
 *
 * Extracted from `resolveAttack` so the **Counter** path can use it too. A
 * counter needs every one of these steps — the fan-out, the per-defender
 * reaction offer, the concealment refusals, `attackDeclared`, `attacked`, the
 * caster phases, `abilityUsed` and the ladder-collapse flag — and a second copy
 * would be the one nobody updates. This file has been bitten by exactly that
 * twice: `resolveAttack` kept no use record, and an attack's rider phases
 * ignored `target`.
 *
 * What deliberately did NOT move is the budget spend. It stays in
 * `resolveAttack`, above this call, so a Counter does not *skip* paying for a
 * turn — the payment is not on its path at all.
 *
 * @param {object} args
 * @param {string} args.attackerId
 * @param {object} args.attacker the Actor
 * @param {object|null} args.ability
 * @param {object} args.attackSpec
 * @param {string[]} args.targetIds
 * @param {object} args.targets the resolved target set
 * @param {object|null} args.placement
 * @param {object} args.board
 * @param {boolean} [args.isCounter] §12.8: this declaration answers an attack
 * @param {string|null} [args.requiredTargetId] the unit the Counter was aimed at
 * @param {number} [args.counterDepth]
 * @returns {Promise<{groupId: string, processes: Array<{messageId: string, state: object}>, messageId: string, state: object}>}
 */
async function declareProcesses({
  attackerId, attacker, ability, attackSpec, targetIds, targets, placement, board,
  isCounter = false, requiredTargetId = null, counterDepth = 0, groupId = null,
}) {
  // A resolution that caught no units is still a resolution — a ground-placed
  // non-damaging NP has a shape and no defenders — so it keeps its single
  // null-defender process rather than becoming an empty fan-out.
  // "Has the Pierce effect ON THE TARGETED UNIT" -- the anchor of the area, not
  // everyone in it. Pierce ignores Invuln and the Block action, so spreading it
  // across the splash would hand the Noble Phantasm a property the sheet gives
  // to one panel.
  const primaryId = attackSpec.pierce && ability?.system?.damage?.pierceOn === "primary"
    ? (placement?.unitId ?? placement?.targetId ?? null)
    : null;
  const states = targetIds.length > 0
    ? process.beginFanOut({
      attackerId,
      targetIds,
      attack: attackSpec,
      // DISTINCT defenders, not processes. Overedge's two swings are two
      // processes against one Unit and are not an area attack; deriving it from
      // the process count would have flipped `attack:isAoE` on for them and
      // suppressed the defender's facing change into the bargain.
      isAoE: new Set(targetIds).size > 1,
      // §12.1: a Combat Phase is the declaration PLUS its counters, and
      // `fireCombatPhaseEnd` counts unfinished siblings by group. A Counter
      // therefore inherits the parent's group rather than minting its own, or
      // the phase would end while the counter was still resolving. `null` on an
      // ordinary declaration, which mints one.
      groupId,
      // §12.8. Null on an ordinary declaration; set on every process of a
      // Counter's fan-out, so a bystander it caught cannot counter it in turn
      // unless `fgt.counterChain` says so.
      isCounter, requiredTargetId, counterDepth,
    }).map((state) => (primaryId === null
      ? state
      : { ...state, attack: { ...state.attack, pierce: state.defenderId === primaryId } }))
    : [process.begin({
      attackerId, defenderId: null, attack: attackSpec,
      isCounter, requiredTargetId, counterDepth,
    })];

  // "At the start of a Combat Phase, Mannanán can remove 1 Fragarach Token from
  // herself, her Crit Chance is increased by 30% for that Combat Phase."
  //
  // Offered to BOTH sides and before any card exists, because the buff has to
  // be standing when the crit coin is flipped -- and because the window is "a
  // Combat Phase", not "a Combat Phase you declared": she crits when she
  // counters too. `offerOptionalCosts` is idempotent per `groupId`, so the
  // §12.8 Counter that shares this group does not ask again.
  {
    const { offerOptionalCosts } = await import("./optional-costs.mjs");
    await offerOptionalCosts({
      unitIds: [attackerId, ...states.map((s2) => s2.defenderId)],
      timing: "combatPhaseStart",
      groupId: states[0]?.groupId ?? null,
    });
  }

  /** @type {Array<{messageId: string, state: object}>} */
  const processes = [];
  for (const state of states) {
    // What this defender could answer with, beyond Block and Evade. Recorded on
    // the state because `pendingPrompt` is pure and cannot read documents, and
    // recorded ONCE at creation because the offer is decided by the moment the
    // attack is declared (§15.3).
    const withReactions = state.defenderId
      ? {
        ...state,
        reactionAbilities: { [state.defenderId]: offeredReactions(state.defenderId, state.attack, state.isAoE) },
        // Presence Concealment clause 2: *"This Unit's Attacks cannot be
        // Blocked or Countered unless the DU's current AGI Rank is equal to or
        // higher than it."* Decided once, at declaration, alongside the offer --
        // the same moment and for the same reason.
        //
        // Plus whatever the ATTACK itself forbids. A Fragarach Counter *"cannot
        // be Blocked"*, and the rung is where that has to be said: the card
        // filters the buttons, and `process.advance` refuses the event, so a
        // stale card or a macro cannot Block one anyway.
        forbiddenReactions: [...new Set([
          ...concealmentRefusals(attackerId, state.defenderId),
          ...(state.attack?.unblockable ? ["block"] : []),
        ])],
      }
      : state;
    // A weak point the attacker may aim at (Ch. 44 §44.2). Offered here, at
    // declaration, because the sheet says the attacker states it "during its
    // Attack" -- and because what it forbids (a Block) has to be settled before
    // the defender is shown their rung.
    const aimed = await offerWeakPoint(withReactions, { board });
    const advanced = process.advance(aimed, "done");
    const target = targets.units.find((t) => t.unitId === advanced.defenderId);
    const message = await renderAttackCard({
      state: advanced,
      attacker,
      ability,
      targets: target ? [target] : [],
    });

    // A defender with no Luck, no Command Spells and no automatic evasion has
    // exactly one possible outcome at every rung past step 2, so the whole
    // ladder collapses into a single prompt (Ch. 12 §12.3). Asked per defender,
    // because one of four may collapse while the others do not.
    const defenderDoc = game.actors.get(advanced.defenderId);
    const collapse = defenderDoc ? process.laddersCollapse(unitSnapshot(defenderDoc)) : true;

    await message.setFlag("fgt", "process", process.serialize(advanced));
    await message.setFlag("fgt", "collapse", collapse);
    processes.push({ messageId: message.id, state: advanced });

    // §E.3's `attackDeclared`, raised for the first time. It is the moment
    // EMIYA's Kanshou & Bakuya asks about -- "used when EMIYA performs a Normal
    // Attack at a Range of 2 or lower" -- which is a question about the SWING
    // rather than about whether it landed, so `damageStepEnd` would be the
    // wrong rung: a Servant who projected the swords and then missed still
    // projected them.
    await fireAttackDeclared(advanced);
    // ...and the mirror on the defender, which nothing raised before. A Unit
    // that is about to be hit may have something to say about it -- a Kagome
    // Spirit vanishes rather than take a Light attack.
    await fireAttacked(advanced);
  }

  // Everything the ability does to its USER, which the Combat Process has no
  // rung for: spending a Resource, opening a bounded field, conjuring a squad,
  // asking the player a question. A Noble Phantasm silently did none of it --
  // Unlimited Blade Works consumed no Aria and created no Reality Marble while
  // charging its Master in full.
  if (ability) {
    const { runCasterPhases } = await import("./skill-use.mjs");
    // The ride's own facts travel with the caster phases, because Troias
    // Tragōidia's Agility restore is "X" and X is how much movement he had
    // left -- a number that does not exist on any document.
    await runCasterPhases(ability, attacker, board, attackSpec.ride ? { ride: attackSpec.ride } : {});
  }

  // The event two of EMIYA's passives listen for. On the ATTACK path as well as
  // the Skill path, because a Projection Noble Phantasm is a Thaumaturgy Spell
  // by his own sheet's note -- and firing it in only one place is exactly how
  // `abilitiesUsed` came to be recorded by half the game.
  if (ability) {
    const { fireAbilityUsed } = await import("./skill-use.mjs");
    await fireAbilityUsed(attacker, ability);
  }

  return {
    groupId: states[0].groupId,
    processes,
    // The first process, for callers that predate the fan-out.
    messageId: processes[0].messageId,
    state: processes[0].state,
  };
}

/**
 * Advance a waiting Combat Process by one human decision.
 *
 * @param {object} args
 * @param {string} args.messageId
 * @param {string} args.event  the ladder event: `"evade"`, `"success"`, `"declined"`, …
 * @returns {Promise<object>} the new state
 */
export async function advanceAttack({ messageId, event, abilityId = null, placement = null }) {
  const message = game.messages.get(messageId);
  if (!message) throw new Error(`FGT | Unknown attack message ${messageId}`);

  let state = process.deserialize(message.getFlag("fgt", "process"));

  // A reaction ABILITY is used before the ladder moves on, and what it did then
  // shapes the rungs below: Medea's Trofa applies an AutoSucceed on Evade, and
  // Argos applies Def Up that the damage pipeline reads a moment later. So it
  // resolves here rather than being recorded and applied afterwards.
  const reactionAbilityId = abilityFromOption(event);
  if (state.state === "react" && reactionAbilityId) {
    const defender = game.actors.get(state.defenderId);
    // The ability may belong to somebody else entirely -- Rho Aias is projected
    // by a third party standing up to three panels away -- so the owner is read
    // off the offer rather than assumed to be the defender.
    const offer = (state.reactionAbilities?.[state.defenderId] ?? [])
      .find((a) => a.id === reactionAbilityId) ?? null;
    const owner = game.actors.get(offer?.ownerId ?? state.defenderId) ?? defender;
    const used = owner?.items?.get(reactionAbilityId);
    if (used) {
      const { useSkill } = await import("./skill-use.mjs");
      const out = await useSkill({
        actorId: owner.id,
        abilityId: used.id,
        // The Unit in peril is what a third-party reaction points at: Rho Aias
        // is projected in front of the ally who is about to be hit, not in
        // front of its projector.
        placement: owner.id === state.defenderId ? undefined : { unitId: state.defenderId },
      });
      if (!out.ok) ui.notifications?.warn(game.i18n.format("FGT.Skill.Refused", { name: used.name, reason: out.reason }));
    }

    // An auto-evade granted by what was just used takes the Evade rung without
    // a roll. Read AFTER the ability resolved, because that is what granted it.
    const auto = autoEvadeFrom(state, defender);
    if (auto.applies) {
      // A count-limited automatic evasion is SPENT here. `uses` was recorded on
      // every such effect and never decremented, so Medea's Trofa -- authored
      // "1 times" -- evaded every attack for the rest of the match.
      if (auto.consumes) await applyBatch([I.consumeUse(defender.id, auto.consumes)], "autoEvade");

      state = process.advance(state, "evade");
      state = process.advance(state, auto.success ? "success" : "fail", auto.outcome);
      if (auto.success) await fireEvadeSucceeded(state);
      await message.setFlag("fgt", "process", process.serialize(state));
      await updateAttackCard(message, state);
      return state;
    }
  }

  // §16.4 rule 4's price: *"in this situation, Servants cannot Evade the enemy
  // Unit's AoE NP if their Master is within a 2 panel range of them."* A
  // Servant that has just failed to shove its Master takes the blast standing.
  //
  // Refused HERE rather than by withholding the option at declaration, because
  // the reaction list is recorded once when the attack is declared and Cover
  // is not decided until the Master's own Evade has failed — several rungs
  // later, on a different Process.
  if (state.state === "react" && event === "evade"
    && isCovering({ id: state.defenderId }, coverStateFor(state))) {
    ui.notifications?.warn(game.i18n.localize("FGT.Cover.CannotEvade"));
    return state;
  }

  // A reaction choice resolves into a roll before the machine moves on.
  if (state.state === "react" && event === "evade") {
    state = process.advance(state, "evade");
    const outcome = await rollEvade(state);
    state = process.advance(state, outcome.success ? "success" : "fail", outcome);
    if (outcome.success) await fireEvadeSucceeded(state);
    // §16.4 rule 4. A Master who fails to Evade an AoE Noble Phantasm gets one
    // more chance: its Servants throw themselves at it.
    else await resolveCover(state, message);
  } else if (state.state.startsWith("s2") && event === "contest") {
    const outcome = await rollLuck(state);
    state = process.advance(state, outcome.success ? "success" : "fail", outcome);
  } else if (state.state === "counter" && event === "counter") {
    // Declaring the counter starts a second Process in the opposite direction
    // and finishes this one. The new Process drives itself from here through
    // the same machinery, and cannot be countered in turn.
    const counter = await runCounter(state, { abilityId, placement });
    // A refused counter must NOT advance the ladder: the rung stays open and
    // the player may aim again. Advancing anyway is how one mis-aimed area
    // would have silently consumed the whole counter.
    if (!counter) {
      ui.notifications?.warn(game.i18n.localize("FGT.Counter.MustIncludeAttacker"));
      return state;
    }
    state = process.advance(state, "counter", { counterMessageId: counter?.messageId ?? null });
  } else {
    state = process.advance(state, event);
  }

  // Drive through every state that needs no human input — pausing at any rung
  // where somebody could interrupt with a Command Spell.
  while (!process.isComplete(state) && !process.pendingPrompt(state)) {
    const interrupted = await awaitInterrupt(message, state);
    if (interrupted) {
      // Somebody spent. Re-read: the interrupt may have moved the Process to a
      // different rung entirely (§17.4, "RESUME, possibly at a different state").
      const reread = process.deserialize(message.getFlag("fgt", "process"));
      // Guard against re-reading BACKWARDS. The flag is only written at the end
      // of this function, so a spurious interrupt would otherwise restore the
      // rung we started from and lose everything since -- which is exactly the
      // freeze this pair of comments describes.
      if (reread.history.length >= state.history.length) state = reread;
      continue;
    }
    state = await runAutomaticStep(state, message);
  }

  await message.setFlag("fgt", "process", process.serialize(state));
  await updateAttackCard(message, state);
  if (process.isComplete(state)) {
    await endConcealmentAfterAttack(state);
    await closeFieldsPiercedBy(state);
    await fireCombatProcessEnd(state);
    // *"When Mannanán is Attacked ... at the end of the Combat Process ... she
    // automatically performs a Fragarach Counter on the DU."* At the end of the
    // PROCESS, not the Phase: an area attack that caught her once owes one
    // counter per Process it opened against her, which is what the sheet says
    // and what makes standing under a Decoy so expensive for the attacker.
    await noteAttackProvocation(state);
    await flushAutoCounters(state.groupId);
    await fireCombatPhaseEnd(state);
    // Last, so the deferred half sees a board on which this Process has fully
    // settled -- including a defeat it caused.
    await resumeDeferredAttack(state, message);
  }
  return state;
}

/**
 * Queue this Process's own provocation, if the defender answers being attacked.
 *
 * "Attacked" is the declaration, not the hit. The sheet says *"when Mannanán is
 * Attacked"* and then *"at the end of the Combat Process (if Attacked)"* --
 * which is a statement about *when*, not a second condition -- so an Evade or a
 * fully-absorbed Block still provokes. That is deliberate on the sheet: the
 * whole point of the `Decoy` pairing is that attacking her at all is a mistake.
 *
 * A Process that is itself a counter does not provoke another one (§12.8).
 *
 * @param {object} state
 * @returns {Promise<void>}
 */
async function noteAttackProvocation(state) {
  if (state.isCounter || !state.defenderId || !state.attackerId) return;
  const board = boardSnapshot();
  const bearer = (board.units ?? []).find((u) => u.id === state.defenderId);
  if (!bearer || !(bearer.autoCounters ?? []).length) return;

  const { provoke } = await import("./auto-counter.mjs");
  provoke({ bearer, provokerId: state.attackerId, cause: "attacked" });
}

/**
 * Declare every automatic counter that has been provoked.
 *
 * Exported because the Skill path needs it too: a debuff inflicted by a Skill
 * opens no Combat Process, so there is no `combatProcessEnd` for its
 * provocation to wait for.
 *
 * GM-only. This declares an attack on somebody else's behalf, and two clients
 * each declaring it would resolve the counter twice.
 *
 * @param {string|null} [groupId] the Combat Phase the provocation happened in
 * @returns {Promise<Array<{messageId: string}>>}
 */
export async function flushAutoCounters(groupId = null) {
  const { takePending, whileDraining, pendingCount } = await import("./auto-counter.mjs");
  if (pendingCount() === 0) return [];
  if (!game.user?.isGM) return [];

  return whileDraining(async () => {
    /** @type {Array<{messageId: string}>} */
    const opened = [];

    for (const p of takePending()) {
      const bearer = game.actors.get(p.bearerId);
      const provoker = game.actors.get(p.provokerId);
      const ability = bearer?.items?.get?.(p.abilityId)
        ?? [...(bearer?.items ?? [])].find((i) => i.system?.contentId === p.abilityId);
      if (!bearer || !provoker || !ability) {
        console.warn(`FGT | ${p.source} could not counter: missing bearer, target or "${p.abilityId}".`);
        continue;
      }
      // A defeated Unit does not counter, and neither does one that cannot act.
      const board = boardSnapshot();
      const self = unitFrom(board, bearer) ?? unitSnapshot(bearer);
      if (self.defeated || currentHealth(self) <= 0 || self.canAct === false) continue;

      const options = rollOptionsFor({ attacker: self });
      const attackSpec = buildAttackSpec({ attacker: bearer, ability, abilityId: ability.id, options });

      // `isCounter`, so §12.8's *"Counters cannot be Countered again"* closes
      // the chain -- and so the counter does not spend a Turn, which it never
      // had: this is a reaction, and `declareProcesses` sits below the budget.
      const out = await declareProcesses({
        attackerId: bearer.id,
        attacker: bearer,
        ability,
        attackSpec,
        targetIds: [provoker.id],
        targets: { units: [{ unitId: provoker.id }] },
        placement: null,
        board,
        isCounter: true,
        requiredTargetId: provoker.id,
        counterDepth: 1,
        // The PARENT's group, when there is one. §12.1: a Combat Phase is the
        // declaration plus its Counters, and `runCounter` inherits it for
        // exactly this reason -- `fireCombatPhaseEnd` counts unfinished
        // siblings by group, and a counter with a group of its own would end
        // the Phase while it was still resolving and offer every
        // once-per-Phase decision a second time. `null` on the Skill path,
        // where the debuff that provoked this opened no Phase at all.
        groupId,
      });
      await ChatMessage.create({
        content: `<p><strong>${p.source}</strong> — ${bearer.name} counters `
          + `${provoker.name} (${p.cause}).</p>`,
        speaker: publicSpeakerFor(bearer),
      });
      opened.push({ messageId: out.messageId });
    }
    return opened;
  });
}

/**
 * Raise `combatProcessEnd` on both combatants, once per Process.
 *
 * §E has listed the event since the reference was written and **nothing ever
 * raised it**, so the one clause in the set that is priced per *Process* rather
 * than per *Phase* had no trigger.
 *
 * The distinction is the whole point and Karna states both halves himself.
 * `Kavacha and Kundala` charges his Master *"at the end of every Turn that Karna
 * is involved in a Combat Phase"*; `Vasavi Shakti` charges the same 20 *"at the
 * end of every Combat Process Karna is involved in"*. A Noble Phantasm over
 * seven Units is one Phase containing seven Processes, so trading the armour
 * away multiplies the bill — which is the cost the sheet is describing, and
 * collapsing the two events would erase it.
 *
 * @param {object} state
 * @returns {Promise<void>}
 */
async function fireCombatProcessEnd(state) {
  const units = [...new Set([state.attackerId, state.defenderId].filter(Boolean))]
    .map((id) => game.actors.get(id))
    .filter(Boolean)
    .map((a) => unitSnapshot(a));
  if (units.length === 0) return;

  const intents = fireEvent("combatProcessEnd", units, {
    tick: game.combat?.system?.globalTurn ?? 0,
    turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
    board: currentBoard(),
    options: new Set(),
    rolls: {},
  });
  if (intents.length > 0) await applyBatch(intents, "combatProcessEnd");
}

/**
 * Cover — a Servant taking the blast for its Master (§16.4 rule 4).
 *
 * > *"When a Master that has its Servant within a 2 panel Range of itself gets
 * > caught in an AoE Noble Phantasm and fails to Evade, the Servant performs an
 * > Agility Check. If Successful, the Servant shoves (Moves) its Master out of
 * > the NP area … If Failed, the Master receives no damage and effects, while
 * > the Total Damage the Servant takes from the AoE NP is increased by 100%."*
 *
 * Resolved on the MASTER's Process, at the moment its Evade fails, and
 * recorded on the fan-out group — because the Servants it changes are being
 * resolved in Processes of their own, and each has to be able to read the
 * decision that was taken over here.
 *
 * The shove is a **success** for the Master and costs the Servants nothing:
 * only a failed Agility Check turns a Servant into a shield. One success is
 * enough, which is why the roll stops at the first.
 *
 * @param {object} state the Master's Process state
 * @param {object} message its chat message
 * @returns {Promise<void>}
 */
async function resolveCover(state, message) {
  // AoE Noble Phantasms only. The sheet offers the same process for a non-NP
  // AoE and makes it *optional* there; that prompt is not built, and Ch. 16
  // records it.
  if (state.attack?.kind !== "np" || !state.isAoE) return;
  // Once per group, whatever re-enters. Cover writes to chat messages while
  // this Process is still mid-flight, and `attachAwaitTimeouts` re-arms a
  // message's prompt clock on every `updateChatMessage` -- so a write here can
  // wake a timeout that re-runs `advanceAttack` against the process flag as it
  // stood BEFORE this call, rolling the Agility Checks a second time. Found
  // live: a Master was shoved twice, (6,4) to (5,3) to (4,2).
  if (coverStateFor(state)) return;

  const board = currentBoard();
  const master = (board.units ?? []).find((u) => u.id === state.defenderId);
  if (master?.kind !== "master") return;

  // The area this Noble Phantasm actually covers: every panel a defender in
  // the fan-out is standing on. Taken from the group rather than recomputed,
  // so Cover asks about the same blast the targeting resolved.
  const siblings = siblingStates(state);
  const areaPanels = siblings
    .map((s2) => (board.units ?? []).find((u) => u.id === s2.defenderId)?.panel)
    .filter(Boolean);

  const servants = coveringServantsFor(master, board, areaPanels);
  if (servants.length === 0) return;

  // "The Servant performs an Agility Check." One success shoves, so the rolls
  // stop there -- and the Servant that succeeded is not then also a shield.
  /** @type {object[]} */
  const rolls = [];
  for (const servant of servants) {
    const roll = await new Roll("1d20").evaluate();
    // An AGILITY Check, not an Evade. The same table machinery (§16.4 names it
    // *"Agility Check/Agility Check−"*, and the dash is the unfavourable
    // table), but its own name in the plan vocabulary -- resolving it as an
    // Evade would let an Evade-specific bonus help a Servant shove, and
    // Innocent World hands out +4 Evade to half the board.
    const plan = checkPlan(servant, "agility");
    const outcome = resolveCheck({
      roll: roll.total,
      target: servant.agility,
      table: plan.forceTable === "unfavourable" ? "unfavourable" : "favourable",
      modifiers: plan.modifiers,
    });
    rolls.push({ unitId: servant.id, name: servant.name, roll: roll.total, success: outcome.success });
    if (!outcome.success) continue;

    // "The Servant shoves (Moves) its Master out of the NP area."
    const panel = shoveDestination(master, areaPanels, board);
    if (!panel) break;                       // nowhere to go: the shove fails
    const token = game.actors.get(master.id)?.getActiveTokens?.()[0]?.document;
    if (!token) break;
    // Displacement, not movement: it spends none of the Master's own budget
    // and is not re-validated as a voluntary step.
    await displaceToken(token, {
      x: panel.j * canvas.scene.grid.size,
      y: panel.i * canvas.scene.grid.size,
    });
    // A shoved Master is OUT of the area, so this Noble Phantasm no longer
    // reaches it — recorded on the group with nobody covering, which is exactly
    // the state the rest of this file already reads: `coverModifiersFor` zeroes
    // the Master at stage 15, the rider guard drops its effects, and an empty
    // `coveringIds` leaves every Servant free to Evade.
    //
    // The sheet spells the immunity out only in the FAILURE branch ("the Master
    // receives no damage and effects"), which reads at first as though a
    // successful shove leaves the Master to take the hit. It cannot: failure
    // would then be strictly better for the Master AND for the Servant, whose
    // reward for succeeding would be an unharmed enemy Master and its own
    // undivided damage. The Agility Check would be a trap nobody should pass.
    // "Moved to one panel OUTSIDE of the NP area" is the protection; "the
    // Combat Process proceeds as normal" is about everyone else's Processes.
    const shoved = { masterId: master.id, coveringIds: [], factor: 1, shoved: true };
    await broadcastCover(state, message, shoved);
    await applyBatch([I.log({
      kind: "cover", event: "shoved", unitId: master.id,
      by: servant.id, panel, rolls,
    })], "cover:shove");
    return;
  }

  // Every Check failed. "The Master receives no damage and effects, while the
  // Total Damage the Servant takes ... is increased by 100%" -- divided among
  // them, so two Servants take +50% each.
  const cover = {
    masterId: master.id,
    coveringIds: servants.map((u) => u.id),
    factor: coverFactor(servants.length),
  };
  await broadcastCover(state, message, cover);
  await applyBatch([I.log({
    kind: "cover", event: "covered", unitId: master.id,
    by: cover.coveringIds, factor: cover.factor, rolls,
  })], "cover:covered");
}

/**
 * Record a cover decision across the fan-out group.
 *
 * On every message of the group EXCEPT the one whose Process is making the
 * decision, so each Servant's own Process finds it without having to know which
 * sibling recorded it. The exception is not tidiness: writing to this Process's
 * own message fires `updateChatMessage`, which re-arms its prompt clock
 * (`engine/await-timeout.mjs`) against a process flag that has not been written
 * yet -- the timeout then answers the rung this call is still resolving. An AoE
 * always has a second defender, so the record always lands somewhere
 * `coverStateFor` will find it.
 *
 * @param {object} state
 * @param {object} message the deciding Process's own message
 * @param {object} cover
 * @returns {Promise<void>}
 */
async function broadcastCover(state, message, cover) {
  for (const sibling of siblingMessages(state)) {
    if (sibling.id === message?.id) continue;
    await sibling.setFlag("fgt", "cover", cover);
  }
}

/**
 * What Cover does to THIS defender's damage.
 *
 * The Master takes nothing at all — a factor of zero rather than a flat
 * subtraction, because *"receives no damage and effects"* is unconditional and
 * must survive anything that would otherwise add to the number. Each covering
 * Servant takes the multiplied Total.
 *
 * @param {object} state
 * @param {object} defender the defender's snapshot
 * @returns {object[]}
 */
function coverModifiersFor(state, defender) {
  const cover = coverStateFor(state);
  if (!cover) return [];

  if (defender?.id === cover.masterId) {
    return [{
      key: "cover",
      factor: 0,
      source: cover.shoved ? "shoved clear of the area by its Servant" : "covered by its Servant",
    }];
  }
  if ((cover.coveringIds ?? []).includes(defender?.id)) {
    return [{ key: "cover", factor: cover.factor, source: "covering its Master" }];
  }
  return [];
}

/**
 * Is this the Process a once-per-Phase effect should be paid on?
 *
 * A fan-out is one Combat Phase and many Processes. Anything the ability does
 * to its own USER happens once, so it is pinned to the first message of the
 * group — a stable choice every client makes the same way, rather than "whoever
 * finishes first".
 *
 * @param {object} state
 * @returns {boolean}
 */
function isFirstOfGroup(state) {
  const siblings = siblingMessages(state);
  if (siblings.length <= 1) return true;
  const first = siblings
    .map((m) => process.deserialize(m.getFlag("fgt", "process")))
    .find(Boolean);
  return !first || first.defenderId === state.defenderId;
}

/**
 * The chat messages of this Process's fan-out group, itself included.
 * @param {object} state
 * @returns {object[]}
 */
function siblingMessages(state) {
  if (!state.groupId) return [];
  return game.messages.filter((m) => {
    const raw = m.getFlag("fgt", "process");
    if (!raw) return false;
    try {
      return process.deserialize(raw).groupId === state.groupId;
    } catch {
      return false;
    }
  });
}

/**
 * The Process states of this fan-out group.
 * @param {object} state
 * @returns {object[]}
 */
function siblingStates(state) {
  const messages = siblingMessages(state);
  if (messages.length === 0) return [state];
  return messages.map((m) => process.deserialize(m.getFlag("fgt", "process")));
}

/**
 * The cover decision taken for this fan-out group, if any.
 * @param {object} state
 * @returns {object|null}
 */
function coverStateFor(state) {
  for (const m of siblingMessages(state)) {
    const cover = m.getFlag("fgt", "cover");
    if (cover) return cover;
  }
  return null;
}

/**
 * The DEFENDER-side declaration event.
 *
 * `attackDeclared` fires on the attacker; nothing ever told a Unit it was
 * about to be hit, so a clause like the Kagome Spirits' *"if a damage-dealing
 * NP or Attack that deals Light damage ... is used on a Kagome Spirit"* had no
 * handler slot to hang on. Fired once per defender, with the attack in its
 * option set.
 *
 * @param {object} state
 * @returns {Promise<void>}
 */
async function fireAttacked(state) {
  const attacker = unitSnapshot(game.actors.get(state.attackerId));
  const defender = state.defenderId ? unitSnapshot(game.actors.get(state.defenderId)) : null;
  if (!attacker || !defender) return;

  // The coin the Kagome Spirits' banishment flips, pre-rolled on the same
  // "caller rolls" contract every other event honours: `fireEvent` is pure and
  // reads totals out of `ctx.rolls`.
  const coin = await new Roll("1d2").evaluate();

  const intents = fireEvent("attacked", [defender], {
    tick: game.combat?.system?.globalTurn ?? 0,
    turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
    board: currentBoard(),
    // `self:` here is the ATTACKER, as in every other attack-scoped option
    // set; a handler on the defender predicates on `attack:`.
    options: rollOptions(attacker, defender, state),
    attackerId: attacker.id,
    rolls: { [`coin:${defender.id}`]: coin.total },
  });
  if (intents.length > 0) await applyBatch(intents, "attacked");
}

/**
 * Raise `attackDeclared` on the attacker, once per Combat Process.
 *
 * Per process rather than per Combat Phase, because the option set describes
 * one defender at one distance -- and every handler in the reference set that
 * listens for it is predicated on exactly those two facts.
 *
 * @param {object} state
 * @returns {Promise<void>}
 */
async function fireAttackDeclared(state) {
  const attacker = unitSnapshot(game.actors.get(state.attackerId));
  const defender = state.defenderId ? unitSnapshot(game.actors.get(state.defenderId)) : null;
  if (!attacker || !defender) return;

  const intents = fireEvent("attackDeclared", [attacker], {
    tick: game.combat?.system?.globalTurn ?? 0,
    turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
    board: currentBoard(),
    options: rollOptions(attacker, defender, state),
    rolls: {},
  });
  if (intents.length > 0) await applyBatch(intents, "attackDeclared");
}

/**
 * Reactions a concealed attacker denies this defender.
 *
 * @param {string} attackerId
 * @param {string} defenderId
 * @returns {string[]}
 */
function concealmentRefusals(attackerId, defenderId) {
  const attacker = game.actors.get(attackerId);
  const defender = game.actors.get(defenderId);
  if (!attacker || !defender) return [];
  return reactionsRefused(unitSnapshot(attacker), unitSnapshot(defender));
}

/**
 * Raise `damageDealt` on the attacker, with the victim in reach.
 *
 * §E.5 has listed it since the reference was written and nothing raised it, so
 * every **on-hit rider** in the catalogue was inert: `Bleed Atk`, `Queen's
 * Poison`, and both halves of Serenity's poisoned daggers. All of them are
 * *"Normal Attacks inflict X on the DU"*, which needs two things this is the
 * only place that has together — that the attack landed, and who it landed on.
 *
 * The victim travels as `ctx.victim` rather than in the unit list: a handler on
 * the ATTACKER is what pays out, and putting the defender in the list would run
 * the defender's own handlers for somebody else's attack.
 *
 * @param {object} state
 * @param {object} result the finished damage result
 * @returns {Promise<void>}
 */
async function fireDamageDealt(state, result) {
  const attacker = unitSnapshot(game.actors.get(state.attackerId));
  const defender = state.defenderId ? unitSnapshot(game.actors.get(state.defenderId)) : null;
  if (!attacker || !defender) return;

  const intents = fireEvent("damageDealt", [attacker], {
    tick: game.combat?.system?.globalTurn ?? 0,
    turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
    board: currentBoard(),
    // `attack:crit` is in the set only here, which is right: a clause that asks
    // whether the attack crit is by definition asking about a resolved one.
    options: rollOptions(attacker, defender, state, { crit: Boolean(result?.flags?.isCrit ?? result?.isCrit) }),
    victim: { unitId: state.defenderId },
    rolls: {},
  });
  if (intents.length > 0) await applyBatch(intents, "damageDealt");
}

/**
 * Raise `damageTaken` on the DEFENDER, once the damage has landed.
 *
 * The mirror of `damageDealt`, and §E has listed it since the reference was
 * written with nothing raising it — so every clause in the catalogue that pays
 * out for *receiving* damage had no rung at all. `Def Dwn (C)` is the first
 * content to need it: *"all damage taken is increased by 10%; **and Agility is
 * reduced by 1 when damage is received**"*, which is a handler on the bearer
 * and not on whoever hit them.
 *
 * The attacker travels as `ctx.victim` — the field names the OTHER party, and
 * on this side of the exchange that is the attacker. Naming it something else
 * would give the action vocabulary two words for one idea.
 *
 * @param {object} state
 * @param {object} result the finished damage result
 * @returns {Promise<void>}
 */
async function fireDamageTaken(state, result) {
  const attacker = unitSnapshot(game.actors.get(state.attackerId));
  const defender = state.defenderId ? unitSnapshot(game.actors.get(state.defenderId)) : null;
  if (!attacker || !defender) return;

  const intents = fireEvent("damageTaken", [defender], {
    tick: game.combat?.system?.globalTurn ?? 0,
    turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
    board: currentBoard(),
    options: rollOptions(attacker, defender, state, { crit: Boolean(result?.flags?.isCrit ?? result?.isCrit) }),
    victim: { unitId: state.attackerId },
    rolls: {},
  });
  if (intents.length > 0) await applyBatch(intents, "damageTaken");
}

/**
 * Presence Concealment clause 5, at the end of the Combat Process.
 *
 * > *"After performing an Attack while PC is Active, PC is deactivated at the
 * > end of the Combat Process."*
 *
 * At the END, not at the declaration, and the difference is the whole point of
 * the skill: the attack itself is made from concealment, at +100% damage,
 * unblockable and uncounterable. What it costs is the concealment.
 *
 * @param {object} state
 * @returns {Promise<void>}
 */
/**
 * Close any field a big enough Noble Phantasm was just used on.
 *
 * > *"A Noble Phantasm of [Anti-World] or higher can be used on Doomsday Come
 * > (from outside) or within Doomsday Come. If used in this way, Doomsday Come
 * > is **forcibly ended at the end of that Combat Process**."*
 *
 * At the END, and the timing is the whole clause: the damage lands **inside**
 * the field, where its interior halves it, and only then does the area come
 * down. Ending it at declaration would put the target outside the very rule
 * that is supposed to protect them from it.
 *
 * Asked of every open field rather than of the one that was targeted, because
 * "used on … or within" covers both, and a Reality Marble that happens to
 * enclose the fight is as much *used on* as one the attacker aimed at.
 *
 * @param {object} state
 * @returns {Promise<void>}
 */
async function closeFieldsPiercedBy(state) {
  const npTags = state.attack?.npTags ?? [];
  if (state.attack?.kind !== "np" || npTags.length === 0) return;

  const { vulnerabilityTriggered, meetsTagThreshold } = await import("../rules/bounded-fields.mjs");
  const { deactivateField, tallyAgainstField, lockOutField } = await import("./fields.mjs");

  // From the BOARD, not `unitSnapshot`. Which fields a unit stands in is a
  // board-wide annotation (`annotateFields`) and a unit projected alone does
  // not carry one — so reading `fields` off a bare snapshot answers
  // `undefined` for everybody, and the test below is false for every field on
  // the board. Measured live: an [Anti-World] NP crossed the boundary exactly
  // as it should and the area did not come down.
  const board = currentBoard();
  const attacker = (board.units ?? []).find((u) => u.id === state.attackerId) ?? null;
  const defender = (board.units ?? []).find((u) => u.id === state.defenderId) ?? null;

  for (const field of board.fields ?? []) {
    // Only a field this Process actually reached. One at the far end of the
    // board is not "used on" by an NP fired at somebody else, however large.
    const touched = [attacker, defender].some((u) => (u?.fields ?? []).includes(field.id));
    if (!touched) continue;

    // Recorded before it is tested: *"two … in the same Round"* counts THIS
    // use as well as the earlier ones, and a tally taken afterwards would need
    // the second NP to be the third.
    const window = await tallyAgainstField(field.id, { npTags });

    for (const event of [
      { kind: "npUsedOn", npTags },
      // How many of this Round's Noble Phantasms met THIS vulnerability's tag
      // is a question only the vulnerability can answer, so the count is
      // recomputed per clause rather than kept by the accumulator.
      { kind: "npUsed", npTags, countThisWindow: null },
    ]) {
      const hit = event.countThisWindow === null && event.kind === "npUsed"
        ? countedHit(field, npTags, window, vulnerabilityTriggered, meetsTagThreshold)
        : vulnerabilityTriggered(field, event);
      if (!hit.triggered) continue;

      // *"In this case, Ramesseum Tentyris cannot be used again for the rest of
      // the game."* `result: "endPermanently"` appeared nowhere outside the
      // unit tests: this branch tested `=== "end"` and dropped everything else,
      // so the harsher outcome was authored, validated and indistinguishable
      // from the mild one.
      if (hit.result === "endPermanently") await lockOutField(field);
      await deactivateField(field.id, "vulnerability");
      break;
    }
  }
}

/**
 * Test a count-window vulnerability against this Round's recorded uses.
 *
 * @param {object} field
 * @param {string[]} npTags
 * @param {{tags: string[][]}} window
 * @param {Function} triggered
 * @param {Function} meets
 * @returns {{triggered: boolean, result?: string}}
 */
function countedHit(field, npTags, window, triggered, meets) {
  for (const v of field.vulnerabilities ?? []) {
    if (v.kind !== "npCount") continue;
    const qualifying = (window.tags ?? []).filter((t) => meets(t, v.tag)).length;
    const hit = triggered(field, { kind: "npUsed", npTags, countThisWindow: qualifying });
    if (hit.triggered) return hit;
  }
  return { triggered: false };
}

async function endConcealmentAfterAttack(state) {
  // A counter is the defender attacking; it ends the counterer's concealment on
  // the same terms, so this asks about whoever swung rather than about roles.
  if (!process.didHit(state) && !state.evaded && state.state !== "done") return;
  const { deactivateConcealment } = await import("./concealment.mjs");
  const { DEACTIVATION_REASONS } = await import("../rules/concealment.mjs");
  await deactivateConcealment(state.attackerId, DEACTIVATION_REASONS.attacked);
}

/**
 * Raise `evadeSucceeded` on the unit that evaded.
 *
 * §E.3 has listed this event since the reference was written and nothing ever
 * raised it, so the three abilities in the reference set that pay out for a
 * successful Evade -- EMIYA's *Eye of the Mind (True)* at both Ranks and
 * Heracles's *Eye of the Mind (False)* -- each carried a clause that could not
 * fire. All three are *"upon a successful Evade, reduce the Cooldown of this
 * Skill"*, which is the reward for the defensive read and the reason the Skill
 * is reusable at all.
 *
 * Fired for an automatic Evade as well as a rolled one: `Dodge` is a
 * *"successful Evade"*, and the sheets do not distinguish.
 *
 * @param {object} state
 * @returns {Promise<void>}
 */
async function fireEvadeSucceeded(state) {
  const defender = state.defenderId ? unitSnapshot(game.actors.get(state.defenderId)) : null;
  if (!defender) return;
  const attacker = unitSnapshot(game.actors.get(state.attackerId));

  const intents = fireEvent("evadeSucceeded", [defender], {
    tick: game.combat?.system?.globalTurn ?? 0,
    turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
    board: currentBoard(),
    // From the EVADER's point of view: `self` is the unit that dodged and
    // `target` is whoever it dodged, so a clause can pay out differently
    // against a Noble Phantasm than against a Normal Attack.
    options: rollOptionsFor({
      attacker: defender, defender: attacker, attack: attackFacts(attacker, defender, state),
    }),
    rolls: {},
  });
  if (intents.length > 0) await applyBatch(intents, "evadeSucceeded");
}

/**
 * Raise `combatPhaseEnd`, once, when every Process in the fan-out has finished.
 *
 * A Combat **Phase** is the whole exchange; a Combat **Process** is one
 * attacker against one defender, and a Noble Phantasm over seven Units is one
 * phase containing seven processes. EMIYA's *Unlimited Blade Works* is *"at the
 * end of every Combat Phase involving EMIYA, he gains 1 Aria"* -- so firing per
 * process would hand him a full charge for one area attack.
 *
 * Completeness is read back off the sibling chat messages rather than counted
 * in memory, because the ladder can span a reconnect and a counter can add a
 * process to the group after the first one finished.
 *
 * @param {object} state
 * @returns {Promise<void>}
 */
async function fireCombatPhaseEnd(state) {
  // The flag holds a JSON STRING -- `process.serialize` stringifies -- so it has
  // to be parsed before anything can be read off it. Reaching for `.groupId`
  // straight off the flag gave `undefined` for every message, which silently
  // made every fan-out look like a group of one.
  const siblings = state.groupId
    ? game.messages.filter((m) => {
      const raw = m.getFlag("fgt", "process");
      if (!raw) return false;
      try {
        return process.deserialize(raw).groupId === state.groupId;
      } catch {
        return false;
      }
    })
    : [];
  const others = siblings.filter((m) => !process.isComplete(process.deserialize(m.getFlag("fgt", "process"))));
  if (others.length > 0) return;

  // Once per phase. The flag lives on the message rather than in memory so a
  // second `advanceAttack` on an already-finished process -- which the card's
  // buttons make easy -- cannot pay out twice.
  const marker = siblings[0] ?? null;
  if (marker?.getFlag("fgt", "phaseEnded")) return;
  if (marker) await marker.setFlag("fgt", "phaseEnded", true);

  const involved = [
    state.attackerId,
    state.defenderId,
    ...siblings.map((m) => process.deserialize(m.getFlag("fgt", "process")).defenderId),
  ].filter(Boolean);
  const units = [...new Set(involved)]
    .map((id) => game.actors.get(id))
    .filter(Boolean)
    .map((a) => unitSnapshot(a));
  if (units.length === 0) return;

  // Who this phase actually hurt. Charm is *"removed at the end of the Combat
  // Phase if the unit takes damage from an attack"* -- a condition about the
  // BEARER, not about the event's subject, so the boundary has to carry it.
  // Read off the same sibling messages the completeness check used: an Evade,
  // a Block that absorbed everything, and being the attacker all leave a
  // defender undamaged and its Charm standing.
  const damagedIds = [...new Set(
    siblings
      .map((m) => {
        const result = m.getFlag("fgt", "result") ?? null;
        if (!result || (result.total ?? 0) <= 0) return null;
        return process.deserialize(m.getFlag("fgt", "process")).defenderId ?? null;
      })
      .filter(Boolean),
  )];

  const intents = fireEvent("combatPhaseEnd", units, {
    tick: game.combat?.system?.globalTurn ?? 0,
    turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
    board: currentBoard(),
    options: new Set(),
    damagedIds,
    rolls: {},
  });
  if (intents.length > 0) await applyBatch(intents, "combatPhaseEnd");

  // The Phase is over, so the once-per-Phase optional spend may be offered
  // again next time. Cleared here rather than left to expire, because the guard
  // is keyed by `groupId` and a match is thousands of them.
  const { clearOptionalCostOffers } = await import("./optional-costs.mjs");
  clearOptionalCostOffers(state.groupId);
}

/**
 * Execute one state that resolves without asking anybody.
 * @param {object} state
 * @param {object} message
 * @returns {Promise<object>}
 */
async function runAutomaticStep(state, message) {
  // *"Luck Check cannot be used by the involved Units."* Achilles's duel is the
  // only thing in the game that says so, and it removes the OPTION rather than
  // penalising the roll -- so the rung is declined automatically rather than
  // offered and refused. Declining is already a legal edge on every Luck rung,
  // because Luck is finite and a player may rationally refuse.
  const prompt = process.pendingPrompt(state);
  if (prompt?.kind === "luckCheck") {
    // Beginner and Intermediate remove the Luck Check entirely (Ch. 19).
    // Declined with a reason on the same path `luckChecksBlocked` uses, rather
    // than the prompt being suppressed silently -- a player who expected the
    // option is owed the sentence saying why it is gone.
    if (!luckChecksApply(boardSnapshot()?.difficulty)) {
      return process.advance(state, "declined", { reason: "luckChecksRemoved" });
    }
    const asked = game.actors.get(prompt.unitId);
    if (asked && luckChecksBlocked(unitFrom(boardSnapshot(), asked) ?? unitSnapshot(asked))) {
      return process.advance(state, "declined", { reason: "luckChecksBlocked" });
    }
  }

  switch (state.state) {
    case "heelResolve": {
      // The declared weak-point attack, rolled in place of the damage. Both
      // outcomes are terminal for the attack, which is what makes declaring it
      // a gamble rather than a free extra.
      const out = await resolveWeakPoint(state, { board: boardSnapshot() });
      // The permanent mark, before the damage it accompanies: `heelWounded`
      // takes Andreias Amarantos away, and the attack that struck the Heel
      // should not still be measured against it.
      const marks = [...(out.spends ?? []), ...weakPointIntents(state, out.onSuccess)];
      if (marks.length > 0) await applyBatch(marks, "weakPoint");
      const next = process.advance(state, out.event, out.detail);
      // A successful Heel Attack goes through every defence he has. The flag
      // travels on the attack, so the pipeline reads it the same way it reads
      // `pierce` (`rules/damage/pipeline.mjs#bypassesDefence`).
      return out.event === "success"
        ? { ...next, attack: { ...next.attack, ignoresDefensiveBuffs: true } }
        : next;
    }
    case "damage": {
      // "Used at the start of a Damage Step when performing an Attack" -- the
      // attacker's own window, asked before anything is computed, because what
      // it grants is an input to the computation. Recorded on the state so
      // `applyDamage` can fold the chosen abilities' rules into this one
      // attack and nothing else (§15.3).
      state = await offerAttackerWindow(state, "damageStep", message);

      // Phases that resolve BEFORE the damage, because the damage depends on
      // them. Scáthach's Gáe Bolg Alternative is the case: *"has a 75% chance
      // of inflicting Instakill. **If Instakill is not inflicted**, this NP
      // deals 3.5x damage plus 100."* The branch cannot be expressed as a
      // rider, because a rider fires after a damage step that should not have
      // happened.
      const before = await applyAbilityEffects(state, { flags: {} }, { when: "beforeDamage" });
      const skipped = damageSuppressedBy(state, before);

      // A pre-damage phase can empty a Health bar without any damage being
      // dealt: `Instakill` is "Health reduced to 0", and the damage step that
      // would normally notice is the one it just suppressed. Without this the
      // Servant sits at 0 Health, undefeated, and takes its next turn.
      //
      // Through the same defeat chain damage uses, so `Guts` and God Hand get
      // their say -- which is the difference between Instakill and Death, and
      // the reason the two are separate effects.
      if (skipped) await resolveEmptiedDefender(state);

      const result = skipped
        ? { total: 0, flags: { suppressedBy: skipped }, breakdown: [] }
        : await applyDamage(state, message);

      // Riders declared in the ability's phases land only if the damage did.
      // "Deals 4x damage plus 100. Then inflicts Def Dwn" -- the "then" is
      // conditional on the attack connecting.
      // "If Heads, no damage AND EFFECTS are received." The riders are refused
      // by the same coin that refused the damage; applying them anyway would
      // make a complete negation the strongest debuff delivery in the game.
      const veiled = result.flags?.concealmentVeil?.effects === false;
      const applied = (skipped || veiled) ? [] : await applyAbilityEffects(state, result);

      // §E's `damageStepEnd`, fired for the first time. It has been in the
      // event reference since the reference was written and nothing ever
      // raised it, so a handler authored against it could not fire -- which
      // stayed invisible only because no content used it. Scáthach's Alpi is
      // the first: *"NP Cooldown is reduced by ½◈ Turns at the end of the
      // Damage Step when a successful Attack is performed."*
      if (!skipped && result.total > 0) await fireDamageStepEnd(state);
      // Terrain the attack itself changes (§42.2): Fire in a Forest makes
      // Burning on Tails, and a Meadow is consumed by the attack that used it.
      // `rules/terrain.mjs#terrainConversions` has computed both since terrain
      // shipped and NOTHING HAS EVER ASKED IT -- the same collected-and-inert
      // shape as `fireEvent`, the ZON tables and the element modifiers.
      if (!skipped) await applyTerrainConversions(state, result);
      // Riders, which need the victim as well as the fact that it landed.
      if (!skipped && result.total > 0) await fireDamageDealt(state, result);
      // ...and the mirror, on the Unit that took it.
      if (!skipped && result.total > 0) await fireDamageTaken(state, result);

      await message.setFlag("fgt", "damage", result.total);
      await message.setFlag("fgt", "effects", [...before, ...applied].map((a) => a.summary));
      return process.advance(state, "done", { total: result.total });
    }
    case "injury":
      await applyInjury(state, message);
      return process.advance(state, "done");
    case "noDamage":
    case "facing":
      // Facing: the defender turns to face the attacker, but not for AoE.
      if (state.state === "facing" && process.shouldUpdateFacing(state)) {
        await applyFacing(state);
      }
      return process.advance(state, "done");
    case "counter": {
      // Step 6 used to `advance(state, "done")` unconditionally — the rung was
      // reached and never asked anybody anything. Deciding eligibility here is
      // what turns it into a real offer: an eligible defender stops the ladder
      // and is asked, an ineligible one drives straight through as before.
      if (state.counterAvailable !== undefined) return process.advance(state, "done");

      const available = counterAvailable(state);
      // §12.8's redirect, decided here for the same reason `counterAvailable`
      // is: it needs positions, and this file can see them while the pure
      // module cannot. Recorded once, so the armed bar and the resolution
      // cannot disagree about who is being protected.
      const rungBoard = boardSnapshot();
      const redirectId = available
        ? counterRedirect(unitFrom(rungBoard, game.actors.get(state.attackerId)), rungBoard)
        : null;
      await message.setFlag("fgt", "counter", { available, redirectId });
      const marked = { ...state, counterAvailable: available, counterRedirectId: redirectId };
      return available ? marked : process.advance(marked, "done");
    }
    default:
      return process.advance(state, "done");
  }
}

/* -------------------------------------------------------------------------- */
/*  Steps                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Roll the `1d100` for every probabilistic check contribution this unit has.
 *
 * The caller-rolls contract, one more time: `checkPlan` is pure and reads
 * totals out of a map keyed by the contribution's source. Without this the
 * chance would have to be rolled inside the rules layer, and an 80% forced
 * table would stop being reproducible from a recorded roll.
 *
 * @param {object} unit
 * @param {string} check
 * @returns {Promise<Record<string, number>>}
 */
async function rollCheckChances(unit, check) {
  /** @type {Record<string, number>} */
  const rolls = {};
  for (const spec of pendingCheckRolls(unit, check, { direction: "imposed" })) {
    rolls[spec.key] = (await new Roll(spec.formula).evaluate()).total;
  }
  return rolls;
}

/**
 * Roll the Evade. The table is chosen by comparing current Agility, and Mad
 * Enhancement forces the unfavourable one regardless.
 * @param {object} state
 * @returns {Promise<object>}
 */
async function rollEvade(state) {
  // From the BOARD, not a bare `unitSnapshot`. `unitFrom`'s own docstring
  // makes the argument -- a re-projected unit carries none of the auras or
  // field interior rules it is standing in -- and this rung took the bare
  // projection anyway, so no aura and no bounded field has ever moved an Evade
  // roll. Ozymandias's Complex is *"when performing Evade and Luck Check
  // Rolls, the number rolled is increased by 2"*; Doomsday Come's Innocent
  // World says +4 on two of its six branches. All of it landed on the
  // snapshot and none of it on the die.
  const board = currentBoard();
  const attacker = unitFrom(board, game.actors.get(state.attackerId));
  const defender = unitFrom(board, game.actors.get(state.defenderId));
  const roll = await new Roll("1d20").evaluate();

  // Everything the defender's own abilities have to say about Evade -- Mad
  // Enhancement's forced table, an Agility check penalty, a granted
  // auto-evasion -- arrives through the plan rather than being named here.
  //
  // Plus what the ATTACKER imposes on it. EMIYA's Clairvoyance forces the
  // defender onto the unfavourable table 80% of the time, which is a rule on
  // his sheet and not on theirs, so it can never come from their own plan.
  const options = rollOptions(attacker, defender, state);
  const plan = mergePlans(
    checkPlan(defender, "evade", { options }),
    checkPlan(attacker, "evade", {
      direction: "imposed", options, rolls: await rollCheckChances(attacker, "evade"),
    }),
  );
  const attackProperties = [];
  if (state.attack?.aim) attackProperties.push("aim");
  if (state.attack?.kind === "np") attackProperties.push("np");

  const outcome = evadeCheck({
      roll: roll.total,
      agility: defender.agility,
      hasDodge: (defender.effects ?? []).includes("dodge"),
      attackHasAim: Boolean(state.attack?.aim),
      forceUnfavourable:
        plan.forceTable === "unfavourable" || defender.agility < attacker.agility,
      autoSucceed: plan.autoSucceed,
      attackProperties,
      // "Cannot be Evaded except with Dodge", and "if any Evade fails, the
      // remaining hits cannot be Evaded". The second is the same rule with an
      // empty permit list -- nothing gets through -- so one field says both.
      evadableOnlyBy: evadePermit(state),
      held: defender.effects ?? [],
      modifiers: [...evadeModifiers(state, attacker, defender), ...plan.modifiers],
  });

  return {
    ...outcome,
    formula: roll.formula,
    // §14.8: every roll files a record, so a failed Evade can be read back as
    // "the die was low" or "the wrong table was used" instead of one number.
    rollRecord: rollLog.fromCheck(outcome, {
      id: `${state.attackerId}:${state.defenderId}:evade:${game.combat?.system?.globalTurn ?? 0}`,
      globalTurn: game.combat?.system?.globalTurn ?? 0,
      entryId: "evade-",
      formula: roll.formula,
      purpose: `${defender.name} evades ${attacker.name}`,
      actorId: state.defenderId,
    }),
  };
}

/**
 * Which effects, if any, are the ONLY things that may evade this attack.
 *
 * `null` means the ordinary ladder. A list means the attack narrows it, and an
 * **empty** list means nothing evades at all — which is how *"if any Evade
 * fails, the remaining hits cannot be Evaded"* is expressed: the permit exists
 * and admits nobody.
 *
 * The multi-hit half is read off the SIBLING Processes, because that is where
 * the earlier hits are. Each hit of a `repeat` attack is its own Combat Process
 * (`resolveAttack`), so "the remaining hits" is a question about the group.
 *
 * @param {object} state
 * @returns {string[]|null}
 */
function evadePermit(state) {
  const declared = state.attack?.evadableOnlyBy ?? [];
  if (state.attack?.noEvadeAfterFail && siblingEvadeFailed(state)) return [];
  return declared.length > 0 ? declared : null;
}

/**
 * Has an earlier hit of this same declaration already failed to be evaded?
 *
 * Same `groupId`, same attacker, same defender — the three keys every other
 * cross-sibling question in this file uses (`alreadyInjuryRolled`), and for the
 * same reason: a Counter shares the parent's group, and one Unit can be caught
 * by two different attackers inside one Combat Phase.
 *
 * @param {object} state
 * @returns {boolean}
 */
function siblingEvadeFailed(state) {
  return game.messages.some((m) => {
    const raw = m.getFlag("fgt", "process");
    if (!raw) return false;
    const sibling = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (sibling.groupId !== state.groupId) return false;
    if (sibling.attackerId !== state.attackerId) return false;
    if (sibling.defenderId !== state.defenderId) return false;
    return (sibling.history ?? []).some((h) => h.state === "evadeRoll" && h.event === "fail");
  });
}

/**
 * @param {object} state
 * @param {object} attacker
 * @param {object} defender
 * @returns {Array<{source: string, value: number}>}
 */
function evadeModifiers(state, attacker, defender) {
  const mods = [];
  // What the ABILITY imposes. "If the DU Evades, its Evade Roll is increased by
  // 3" -- Toole Fragarach and Hallowed Sea God's Sword both say it, and there
  // was no way to author it: every entry below is a property of the attack's
  // KIND or of the defender's own effects.
  if (state.attack?.evadeModifier) {
    // Named, not "the attack": a roll log that says why a die was three higher
    // is the difference between a rule the table can check and a number that
    // appeared. `abilityId` is on the state; the document may be gone by the
    // time a log is read, so the fallback is honest rather than absent.
    const source = state.attack.abilityId
      ? (game.actors.get(state.attackerId)?.items?.get(state.attack.abilityId)?.name ?? "the attack")
      : "the attack";
    mods.push({ source, value: state.attack.evadeModifier });
  }
  if (state.attack?.kind === "np") mods.push({ source: "attack is an NP", value: 3 });
  if (state.isAoE) mods.push({ source: "attack is AoE", value: 2 });
  if ((defender.effects ?? []).includes("slow")) mods.push({ source: "Slow", value: 2 });
  if ((defender.effects ?? []).includes("blind")) mods.push({ source: "Blind", value: 3 });
  if ((defender.effects ?? []).includes("immobilize")) mods.push({ source: "Immobilize", value: 4 });
  // "If the DU Evades, the Evade Roll is increased by 4" -- at A+. From the RANK
  // TABLE, not the literal: `presenceConcealmentEvade` has been in
  // `domain/tables.mjs` since the tables were transcribed with nothing reading
  // it, and the corpus uses the skill at five different ranks. Serenity's A+ is
  // 4 and would have been right by accident; Yan Qing's C is 3.
  if (isConcealed(attacker)) {
    const skill = (attacker.abilities ?? []).find((a) => a.slug === "presenceConcealment");
    const rank = skill?.rank instanceof Rank ? skill.rank : Rank.parseOrNull(skill?.rank ?? null);
    const value = rank ? Number(lookup("presenceConcealmentEvade", rank) ?? 4) : 4;
    mods.push({ source: `Presence Concealment ${rank ?? ""}`.trim(), value });
  }
  return mods;
}

/**
 * @param {object} state
 * @returns {Promise<object>}
 */
async function rollLuck(state) {
  const prompt = process.pendingPrompt(state);
  // From the board, for the reason `rollEvade` records above.
  const board = currentBoard();
  const unit = unitFrom(board, game.actors.get(prompt.unitId));
  const opponentId = prompt.side === "attacker" ? state.defenderId : state.attackerId;
  const opponent = unitFrom(board, game.actors.get(opponentId));
  const roll = await new Roll("1d20").evaluate();

  const plan = checkPlan(unit, "luck");
  const outcome = luckCheck({
    roll: roll.total,
    luck: unit.luck,
    opposingLuck: opponent.luck,
    hasBoost: (unit.effects ?? []).includes("luckBoost") || plan.forceTable === "favourable",
    hasLoss: (unit.effects ?? []).includes("luckLoss") || plan.forceTable === "unfavourable",
    modifiers: plan.modifiers,
  });

  // A Luck Check costs 1 Luck whether or not it succeeds.
  await applyBatch([I.statDelta(prompt.unitId, "luck.value", -1)], "luckCheck");
  return {
    ...outcome,
    formula: roll.formula,
    rollRecord: rollLog.fromCheck(outcome, {
      id: `${prompt.unitId}:luck:${game.combat?.system?.globalTurn ?? 0}:${state.history.length}`,
      globalTurn: game.combat?.system?.globalTurn ?? 0,
      entryId: "luck",
      formula: roll.formula,
      purpose: `${unit.name} contests ${opponent.name}`,
      actorId: prompt.unitId,
    }),
  };
}

/**
 * Turn Civilian-kill descriptors into intents.
 * @param {object[]} descriptors
 * @returns {object[]}
 */
function civilianIntents(descriptors) {
  return descriptors.map((d) => {
    switch (d.kind) {
      case "defeat": return I.defeat(d.unitId, d.cause);
      case "heal": return I.heal(d.unitId, d.amount, d.source);
      case "statDelta": return I.statDelta(d.unitId, d.stat, d.delta);
      default: return I.log({ kind: "unappliedCivilianEffect", effect: d.kind, unitId: d.unitId });
    }
  });
}

/**
 * The ability as the cost rules want to see it.
 *
 * `requiresRound` is read from `targeting.limits`, the same untyped authored
 * object `requiresZon` already lives in — so a round gate is something content
 * can write today, rather than a schema field waiting to be invented.
 *
 * @param {object|null} ability an ability item
 * @returns {object|null}
 */
function abilityUsageSpec(ability) {
  return usageSpecFor(ability);
}

/**
 * Every cost this use would incur, before supersession.
 *
 * The Noble Phantasm cost is the one the rules layer computes; the rest are
 * standing charges the ability or an active platform declares. They arrive here
 * as a flat list precisely so `resolveCosts` can see all of them at once --
 * supersession is a relation between costs, and a cost paid before its
 * supersessor is known has already been paid wrongly.
 *
 * @param {object} args
 * @returns {object[]}
 */
function pendingCosts({ usage, ability, self, master, board }) {
  /** @type {object[]} */
  const out = [];

  if (usage.cost) out.push({ ...usage.cost, id: "npCost" });

  // Standing per-use costs the ability declares, each with its own id so
  // something else can name it in `supersedes`.
  for (const extra of ability?.system?.additionalCosts ?? []) {
    // `masterHealthByNPRank` charges the Noble Phantasm table at a STATED Rank
    // rather than at the ability's own, and through the same rule `npCost`
    // uses -- so a Free Servant pays in Sustainability instead of producing an
    // intent aimed at a Master who does not exist.
    // A FRACTION of the Master's maximum rather than a stated number.
    // *"The Master's Health is reduced by 50% of its maximum value"* -- the
    // first cost in the corpus whose size is not on the sheet, because it
    // depends on whose Master it is.
    if (extra.kind === "masterHealthFractionOfMax") {
      const max = master?.maxHealth ?? master?.health?.max ?? 0;
      out.push({
        kind: "masterHealth",
        amount: Math.floor(max * (extra.fraction ?? 0)),
        unitId: master?.id ?? null,
        id: extra.id,
        supersedes: extra.supersedes ?? [],
      });
      continue;
    }

    if (extra.kind === "masterHealthByNPRank") {
      out.push({ ...npCostAt({ rank: extra.rank, unit: self, master }), id: extra.id, supersedes: extra.supersedes ?? [] });
      continue;
    }
    out.push({
      kind: extra.kind ?? "masterHealth",
      amount: extra.amount ?? 0,
      unitId: extra.chargesMaster === false ? self.id : master?.id ?? null,
      id: extra.id,
      supersedes: extra.supersedes ?? [],
    });
  }

  // A platform this Servant owns may replace the NP cost outright (Ch. 20).
  const platform = (board.units ?? []).find(
    (u) => u.kind === "platform" && u.ownerId === self.id && u.upkeep,
  );
  if (platform?.upkeep) {
    out.push({
      kind: "masterHealth",
      amount: platform.upkeep.amount ?? 0,
      unitId: master?.id ?? null,
      id: `upkeep:${platform.id}`,
      supersedes: platform.upkeep.supersedes ?? [],
    });
  }

  return out;
}

/**
 * Turn a refusal into something a player can act on.
 * @param {object} usage
 * @returns {string}
 */
function usageRefusal(usage) {
  const d = usage.detail ?? {};
  switch (usage.reason) {
    case "cooldown": return `it is on cooldown for another ${d.remaining} turn(s).`;
    case "round": return `it cannot be used before Round ${d.requiresRound} (this is Round ${d.round}).`;
    case "zon": return "the Servant is outside its Master's ZON.";
    case "masterHealth":
      // The strict comparison is the surprising half, so it is spelled out.
      return `its Master needs MORE than ${usage.cost.amount} Health to pay for it.`;
    case "selfHealth": return `it needs more than ${usage.cost.amount} Health to pay for it.`;
    case "sustainability": return `it needs more than ${usage.cost.amount}◈ of Sustainability.`;
    default: return usage.reason ?? "unknown reason.";
  }
}

/**
 * Pay a cost.
 *
 * `statDelta`, never `damage`: this is Health *loss* rather than damage, so it
 * must not trigger damage-keyed effects like `Dmged NP Regen` or an Injury Roll
 * (Ch. 06). Getting that wrong would make every Noble Phantasm feed its own
 * Master's triggers.
 *
 * @param {object} cost
 * @param {object} self the paying unit's snapshot, for a sustainability cost
 * @returns {object[]} intents
 */
function costIntents(cost, self) {
  const note = I.log({ kind: "cost", cost: cost.kind, amount: cost.amount, unitId: cost.unitId });
  switch (cost.kind) {
    case "masterHealth":
    case "selfHealth":
      return [I.statDelta(cost.unitId, "health.value", -cost.amount), note];
    case "sustainability":
      // An ABSOLUTE write, from `self.sustainability` -- the already-resolved
      // remaining figure -- not a relative delta against the raw stored field.
      // That field is `null` until its first write, and a Free Servant's FIRST
      // Noble Phantasm read that `null` as 0 and set the clock to 0 regardless
      // of how much it actually had (same defect `checkRemovals` had; see its
      // comment in `scheduler.mjs`).
      return [I.setResource(cost.unitId, "sustainabilityRemaining", self.sustainability - cost.amount), note];
    default:
      return [note];
  }
}

/**
 * Hold a non-prompting rung open long enough for a Command Spell.
 *
 * §17.4: *"An offer that blocks resolution indefinitely is unacceptable in a
 * game with seven players."* So the wait is bounded by a setting (45s by
 * default, 0 to disable) and ends the moment somebody spends.
 *
 * It costs nothing in the common case: if no Master at the table could
 * actually use a command here, this returns immediately without waiting. That
 * matters, because most rungs of most attacks have no offer at all and a
 * blanket 45-second pause on each would be unplayable.
 *
 * Only the GM waits. The spend arrives over the socket and mutates the Process
 * from that side, which is what `interruptProcess` does.
 *
 * @param {object} message
 * @param {object} state
 * @returns {Promise<boolean>} whether an interrupt landed
 */
async function awaitInterrupt(message, state) {
  if (!game.user.isGM) return false;
  if (!process.interruptible(state)) return false;

  const seconds = game.settings.get("fgt", "commandSpellTimeout") ?? 45;
  if (seconds <= 0) return false;

  const { offerCommands } = await import("./command-spells.mjs");
  const window = process.windowFor(state);
  const anyOffer = game.actors.some((a) =>
    a.type === "master" && offerCommands({ masterId: a.id, window, context: { state: state.state, attack: state.attack } }).length > 0);
  if (!anyOffer) return false;

  // The baseline is the FLAG's current value, not the in-memory state.
  //
  // Comparing against `serialize(state)` compared two different things: the
  // flag still holds the state this call started from, while `state` has
  // already advanced past it. So the very first poll saw a difference, reported
  // "somebody spent" when nobody had, and the caller then re-read the flag --
  // restoring the pre-advance state and discarding the advance.
  //
  // The effect was that any attack reaching an interruptible rung with a Master
  // able to offer a Command Spell froze there permanently. It needed a Master
  // ON THE BOARD to appear at all, which is why it survived every earlier test.
  const before = message.getFlag("fgt", "process");
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 500));
    if (message.getFlag("fgt", "process") !== before) return true;
  }

  // Timed out. Said out loud rather than silently continuing: a player who was
  // disconnected should see that they missed the opportunity.
  await applyBatch(
    [I.log({ kind: "commandSpellWindowClosed", messageId: message.id, atState: state.state })],
    "commandSpell:timeout",
  );
  return false;
}

/**
 * Whether the defender of `state` may counter its attacker (§12.8).
 *
 * Every clause `canCounter` takes is derived here from the board, so the pure
 * check never has to guess and never reads a field nobody writes.
 *
 * @param {object} state
 * @returns {boolean}
 */
function counterAvailable(state) {
  const board = boardSnapshot();
  const attackerDoc = game.actors.get(state.attackerId);
  const defenderDoc = game.actors.get(state.defenderId);
  if (!attackerDoc || !defenderDoc) return false;

  const attacker = unitFrom(board, attackerDoc);
  const defender = unitFrom(board, defenderDoc);
  if (!attacker?.panel || !defender?.panel) return false;

  const held = defender.effects ?? [];
  return process.canCounter(state, {
    defenderAlive: (defenderDoc.system?.health?.value ?? 0) > 0,
    // The DU's range, not the AU's: the counter is the DU attacking.
    attackerInRange: inAttackRange(defender.panel, attacker.panel, defender.range ?? 1),
    attackerHasAccel: (attacker.effects ?? []).includes("accel"),
    defenderCanAct: defender.canAct !== false,
    defenderHasBerserk: held.includes("berserk"),
    defenderHasFragarach: held.includes("fragarach"),
    // The general form: whatever the defender is carrying that says which rungs
    // it may not take (`ForbidReaction`).
    defenderForbids: defender.forbiddenReactions ?? [],
    // AGI **Rank**, not the Agility pool. The pool is a spendable resource that
    // two Servants of the same Rank disagree about constantly, so a Servant who
    // had paid for a few Evades became blockable mid-match for no stated reason.
    attackerConcealedAndFaster: reactionsRefused(attacker, defender).includes("counter"),
    // The GM's `fgt.counterChain`. Read here rather than in the pure module,
    // which takes every derived fact as an argument.
    chainMode: game.settings.get("fgt", "counterChain"),
  });
}

/**
 * Run the counter as its own Combat Processes, roles reversed (§12.8, §27.10).
 *
 * A full declaration, not a bare damage roll: Ch. 41 rules that the source's
 * *"Steps 1 and 4 are repeated"* is a typo for "1 **to** 4", because a counter
 * that cannot be evaded and deals no damage is nonsense and Instant Counter's
 * *"skip straight to Step 3"* is only a special property if the normal counter
 * does not skip.
 *
 * **The counterer picks what to counter with.** Until now this hardcoded a
 * Normal Attack, and `beginCounter`'s `attack` parameter — which it has had
 * since it was written — was never passed by anybody, so the default was the
 * whole feature.
 *
 * No budget is spent: `declareProcesses` sits BELOW `resolveAttack`'s spend, so
 * this path never reaches it. The chosen ability's own cost is paid in full,
 * because `declareProcesses` runs the caster phases and records the use exactly
 * as a declaration on the counterer's own turn does.
 *
 * @param {object} state the process being countered
 * @param {object} [choice]
 * @param {string|null} [choice.abilityId] null for a Normal Attack
 * @param {object|null} [choice.placement] from the targeting session
 * @returns {Promise<object|null>} null when the counter is refused
 */
async function runCounter(state, { abilityId = null, placement = null } = {}) {
  // §12.8: a Counter aimed at a Master whose Servant shields it hits the
  // Servant instead, and the Master takes nothing. Read off the Process rather
  // than recomputed, so this and the armed bar cannot disagree.
  const requiredId = state.counterRedirectId ?? state.attackerId;
  const excludeUnitIds = state.counterRedirectId ? [state.attackerId] : [];

  const counterer = game.actors.get(state.defenderId);
  const required = game.actors.get(requiredId);
  if (!counterer || !required) return null;

  const ability = abilityId ? counterer.items.get(abilityId) : null;
  const board = boardSnapshot();
  const self = unitFrom(board, counterer) ?? unitSnapshot(counterer);
  const options = rollOptionsFor({ attacker: self });
  const attackSpec = buildAttackSpec({ attacker: counterer, ability, abilityId, options });

  // Who this counter actually caught. A Normal Attack with no placement is the
  // original attacker and nobody else -- the old behaviour, kept as the default
  // so a counter declared without a choice still works.
  let targets = { units: [{ unitId: requiredId }] };
  if (ability && placement) {
    const spec = targetSpecForAttack(counterer, ability, options);
    targets = resolveTargets(
      { ...spec, limits: { ...(spec.limits ?? {}), requireUnitId: requiredId, excludeUnitIds } },
      self, board, placement,
    );
  }

  // The server saying what the targeting session already said under the cursor.
  // The client is not the authority: a payload that got past the authorizer
  // with a placement that misses is refused here, and the rung stays open.
  if (!(targets.units ?? []).some((u) => u.unitId === requiredId)) return null;

  // The ability's OWN price -- its use record, its costs, its cooldown -- and
  // none of the budget. A Counter costs no turn, but the Noble Phantasm it is
  // declared with costs what it always costs; for most of them the cooldown is
  // the only price there is, and skipping it would let a Servant answer every
  // attack with its Noble Phantasm forever.
  const master = self.masterId ? unitFrom(board, game.actors.get(self.masterId)) : null;
  await payAbilityPrice({
    ability,
    attackerId: counterer.id,
    attacker: counterer,
    self,
    master,
    // The same shape `resolveAttack` builds. `canUseAbility` decided whether
    // the slot was offered at all; this is the record of what it costs.
    usage: canUseAbility({
      ability: abilityUsageSpec(ability), unit: self, master,
      round: game.combats.active?.round ?? 1, board,
      target: unitFrom(board, required),
    }),
    board,
    resume: false,
  });

  return declareProcesses({
    attackerId: counterer.id,
    attacker: counterer,
    ability,
    attackSpec,
    targetIds: targets.units.map((u) => u.unitId),
    targets,
    placement,
    board,
    isCounter: true,
    requiredTargetId: state.counterRedirectId ?? state.attackerId,
    counterDepth: (state.counterDepth ?? 0) + 1,
    // The parent's, deliberately. See `declareProcesses`.
    groupId: state.groupId,
  });
}

/**
 * Combat Process step 4 — the Injury Roll (§12.6).
 *
 * Reached after the damage has already been written, so the defender's Health
 * on the document is the post-damage value the rule wants.
 *
 * @param {object} state
 * @param {object} message
 * @returns {Promise<void>}
 */
async function applyInjury(state, message) {
  const result = message.getFlag("fgt", "result");
  const defenderDoc = game.actors.get(state.defenderId);
  if (!result || !defenderDoc) return;

  // Dragon Wing Warriors: "1d6+4 instances... each can be separately Evaded
  // or Blocked. Damaged Units only perform an Injury Roll ONCE regardless of
  // number of hits taken" — "on the total" (docs/12 §12.6's own reading,
  // matching the reference set's other multi-hit attacks), not "using
  // whichever hit happens to run the check first". Each instance is its own
  // Combat Process and so reaches this step once per hit; naively checking
  // the FIRST hit alone against the 100-damage threshold would mean Dragon
  // Wing Warriors (50 Fixed damage per hit) could never trigger an Injury
  // Roll at all, hit count notwithstanding.
  //
  // `singleInjuryRoll` therefore waits until every sibling process (same
  // `state.groupId`, same defender) has resolved its own damage step, sums
  // them, and performs the one check against the total -- on whichever
  // process turns out to be the LAST to have a `result` recorded, since
  // that is the only point the full total is known. Earlier siblings defer
  // (`singleInjuryRollPending`); later ones find the real verdict already
  // recorded and skip (`singleInjuryRoll`).
  const attackerDoc = game.actors.get(state.attackerId);
  const ability = state.attack?.abilityId ? attackerDoc?.items.get(state.attack.abilityId) : null;
  let damage = result.total;
  let exceededThreshold = Boolean(result.flags?.exceededInjuryThreshold);

  if (ability?.system?.damage?.singleInjuryRoll) {
    if (alreadyInjuryRolled(state, message)) {
      await message.setFlag("fgt", "injury", { roll: false, reason: "singleInjuryRoll" });
      return;
    }
    const siblings = siblingInjuryTotals(state);
    if (siblings.pending > 0) {
      await message.setFlag("fgt", "injury", { roll: false, reason: "singleInjuryRollPending" });
      return;
    }
    damage = siblings.total;
    // NOT `siblings.anyExceeded` (whether any ONE hit individually exceeded
    // 100) -- each of Dragon Wing Warriors' hits is 50 Fixed damage, so no
    // single one ever does, and reusing the per-hit flags here would make
    // the "once, on the total" roll never fire regardless of hit count. The
    // pipeline's own Def-Crk-exclusion reasoning for NOT re-deriving this
    // from `damage` (`rules/injury.mjs`'s own comment) is about a single
    // hit's stage-16 addition; a `singleInjuryRoll` attack's total is a sum
    // of already-settled `result.total` values with nothing further to add,
    // so comparing the sum directly is the correct fresh threshold check.
    exceededThreshold = siblings.total > INJURY_THRESHOLD;
  }

  const verdict = injuryCheck({
    exceededThreshold,
    damage,
    healthAfter: defenderDoc.system?.health?.value ?? 0,
    defender: unitFrom(boardSnapshot(), defenderDoc),
    isNP: state.attack?.kind === "np",
    // NOTE: no rung of the reaction ladder offers `Light Wound` yet (Ch. 45
    // D3), so this is always false today. It is read rather than hard-coded so
    // that adding the rung is the only change needed — but it is a gap, and it
    // is recorded as one rather than left to look implemented.
    lightWound: Boolean(state.luckChecks?.lightWound),
  });

  await message.setFlag("fgt", "injury", verdict);
  if (!verdict.roll) return;

  const roll = await new Roll("1d4").evaluate();
  await applyBatch(
    [
      I.statDelta(state.defenderId, INJURY_STAT, -roll.total),
      I.log({ kind: "injury", unitId: state.defenderId, amount: roll.total, tick: game.combat?.system?.globalTurn ?? 0 }),
    ],
    "injury",
  );
  await message.setFlag("fgt", "injury", { ...verdict, amount: roll.total });
}

/**
 * Has a SIBLING process -- the same declaration (`groupId`), the same
 * defender, a different message -- already recorded the REAL Injury Roll
 * verdict for this defender?
 *
 * `singleInjuryRollPending` does not count: that is a sibling saying "I could
 * not tell yet", not "it has been decided" -- counting it would let the
 * decision be skipped forever if this process happened to run before the one
 * that actually resolves it.
 *
 * @param {object} state
 * @param {object} message the current process's own message, excluded from the search
 * @returns {boolean}
 */
function alreadyInjuryRolled(state, message) {
  return game.messages.some((m) => {
    if (m.id === message.id) return false;
    const raw = m.getFlag("fgt", "process");
    if (!raw) return false;
    const sibling = typeof raw === "string" ? JSON.parse(raw) : raw;
    // `attackerId` as well as the group and the defender. A Counter shares the
    // parent's groupId (§12.1's Combat Phase) and an AREA counter can catch a
    // unit the original attack also caught -- so without this, one unit's
    // injuries from two DIFFERENT attackers in one Phase would be treated as
    // two hits of one multi-hit ability.
    if (sibling.groupId !== state.groupId) return false;
    if (sibling.attackerId !== state.attackerId) return false;
    if (sibling.defenderId !== state.defenderId) return false;
    const injury = m.getFlag("fgt", "injury");
    return Boolean(injury) && injury.reason !== "singleInjuryRollPending";
  });
}

/**
 * The combined picture across every sibling process against one defender --
 * total damage taken (each already-settled `result.total`) and how many
 * siblings have not resolved their own damage step yet.
 *
 * @param {object} state
 * @returns {{total: number, pending: number}}
 */
function siblingInjuryTotals(state) {
  let total = 0;
  let pending = 0;
  for (const m of game.messages) {
    const raw = m.getFlag("fgt", "process");
    if (!raw) continue;
    const sibling = typeof raw === "string" ? JSON.parse(raw) : raw;
    // Same three keys as `alreadyInjuryRolled`, and for the same reason: a
    // counter shares the parent's group, so the attacker is what separates two
    // exchanges against one unit within a single Combat Phase.
    if (sibling.groupId !== state.groupId) continue;
    if (sibling.attackerId !== state.attackerId) continue;
    if (sibling.defenderId !== state.defenderId) continue;

    const result = m.getFlag("fgt", "result");
    if (!result) {
      pending += 1;
      continue;
    }
    total += result.total;
  }
  return { total, pending };
}

/**
 * Roll for, and then resolve, a defender's defeat.
 *
 * `resolveDefeat` is pure and takes its dice through `ctx.rolls`, so the dice
 * are rolled here — and only the ones the defender's own handlers ask for, via
 * `pendingRolls`. A defender with no revive rolls nothing.
 *
 * @param {object} defender the defender's snapshot, taken *before* the damage
 * @param {number} damage
 * @returns {Promise<object[]>} intents: a revive, or a defeat, or neither
 */
async function resolveDefeatOf(defender, damage, state = {}) {
  // `defender` is a SNAPSHOT, whose `health` is a flat number. Reading
  // `.value` off it gave `undefined`, the `?? 0` made every defender look
  // empty, and the early return never fired -- so a 500-damage hit on a
  // Servant at 3000 went through the whole defeat chain.
  const remaining = currentHealth(defender) - damage;
  if (remaining > 0) return [];

  // CS: Survive Kill, declared earlier in this Process. "The Servant survives
  // with 5% of its Health" — so it is never defeated, and the revive handlers
  // below are not consulted at all. Three Command Spells outrank a skill.
  if (state.survive) {
    const restored = Math.max(1, Math.floor((defender.health?.max ?? 0) * state.survive));
    return [
      I.statDelta(defender.id, "health.value", -remaining + restored, true),
      I.log({ kind: "surviveKill", unitId: defender.id, restored }),
    ];
  }

  const combat = game.combat;
  const ctx = {
    tick: combat?.system?.globalTurn ?? 0,
    turnsPerRound: game.settings.get("fgt", "turnsPerRound") || 3,
    // How much damage was left over once the Health ran out. God Hand's first
    // passive spends charges against it -- "if the damage of the Attack that
    // defeated Heracles exceeds his current Health, the excess damage is
    // reduced from his newly restored Health, and so on" -- so a very large
    // Noble Phantasm can burn several charges in one resolution.
    overkill: Math.max(0, -remaining),
    rolls: {},
  };
  for (const spec of pendingRolls(defender, "unitDefeated")) {
    ctx.rolls[spec.key] = (await new Roll(spec.formula).evaluate()).total;
  }

  // "Whenever an Attack reduces Heracles' Health to 0 FOR THE FIRST TIME,
  // record that Attack under this Skill." Recorded at the moment the Health
  // runs out and before the revival query -- a recorded Attack is one he
  // survived, and he survives this one or he does not.
  const recording = recordIntents(defender, state);

  // A revival the player CHOOSES. Asked here, because `resolveDefeat` is pure
  // and this is a question about somebody's intentions rather than about the
  // board: *God's Holder: Possession* costs every Fragarach Token she holds and
  // transforms her permanently, so dying is a legitimate answer.
  const accepted = await acceptedOptionalRevivals({ ...defender, health: remaining });

  // Rebuilt in the SNAPSHOT's shape -- a flat number -- because that is what
  // `resolveDefeat` is given everywhere else and what `currentHealth` reads.
  return [
    ...recording,
    ...resolveDefeat({ ...defender, health: remaining, acceptedRevivals: accepted }, ctx),
  ];
}

/**
 * Ask about every optional revival this Unit could take, and return the ids of
 * the ones it wants.
 *
 * Silence is **no**. A revival that transforms its bearer and spends a whole
 * resource pool must not fire because a prompt timed out on a disconnected
 * client — and unlike a reaction, declining costs the Unit nothing it had.
 *
 * @param {object} unit the defender's snapshot, at zero Health
 * @returns {Promise<string[]>}
 */
async function acceptedOptionalRevivals(unit) {
  const optional = (unit.revivals ?? []).filter((r) => r.optional);
  if (optional.length === 0) return [];

  const actor = game.actors.get(unit.id);
  if (!actor) return [];

  /** @type {string[]} */
  const accepted = [];
  for (const source of optional) {
    // Its own gates first, so a Unit with no tokens left is not offered a
    // transformation it cannot pay for (§17.6).
    if ((source.requires ?? []).some((req) => !meetsRequirement(req, { unit }))) continue;

    const picked = await askOwner(actor, {
      kind: "choose",
      title: source.source,
      hint: game.i18n.format("FGT.Revival.OptionalHint", { name: actor.name, source: source.source }),
      min: 0,
      count: 1,
      options: [{ id: source.id, name: game.i18n.localize("FGT.Revival.Take"), detail: source.source }],
    });
    if ((picked ?? []).includes(source.id)) accepted.push(source.id);
  }
  return accepted;
}

/**
 * Record the attack that just emptied this unit's Health, if anything asks.
 *
 * God Hand is the only ability in the reference set that does, and what counts
 * as "that Attack" is a judgement §31.3 makes explicitly: the **ability**, with
 * a per-attacker pseudo-id for Normal Attacks. Recording the attacking *unit*
 * would mean Karna could never kill him again by any means; recording the
 * instance is vacuous, because an instance never recurs.
 *
 * @param {object} defender
 * @param {object} state
 * @returns {object[]}
 */
function recordIntents(defender, state) {
  if (!state.attackerId) return [];

  const identity = attackIdentity(state.attack ?? {}, state.attackerId);
  const doc = game.actors.get(defender.id);
  /** @type {object[]} */
  const out = [];

  for (const item of doc?.items ?? []) {
    if (!item.system?.recordsAttacks) continue;
    // "For the FIRST time" -- a second kill by the same ability records nothing
    // new, which a Set makes free.
    if ([...(item.system.recordedAttacks ?? [])].includes(identity)) continue;
    out.push(I.recordAttack(defender.id, item.id, identity));
  }
  return out;
}

/**
 * The named units a base-attack source may refer to.
 *
 * One entry today: `mount`, for a rider whose platform replaces her Normal
 * Attack. Stage 1 of the pipeline has resolved `ctx.units[src.unit]` since it
 * was written, and this is the first thing to supply the map.
 *
 * Empty when the attacker is not riding such a platform, which is every
 * attacker in the game except Quetzalcoatl aboard her Quetzalcoatlus — and an
 * empty map is safe, because stage 1 falls back to the attacker.
 *
 * @param {object} attacker the attacker's snapshot
 * @param {object} board
 * @returns {Record<string, object>}
 */
function mountUnits(attacker, board) {
  const { platform, attacksAsPlatform } = actionSourceFor(attacker, board);
  return attacksAsPlatform && platform ? { mount: platform } : {};
}

/**
 * Build the damage context, run the pure pipeline, and apply the result.
 * @param {object} state
 * @param {object} message
 * @returns {Promise<object>}
 */
async function applyDamage(state, message) {
  const attackerDoc = game.actors.get(state.attackerId);
  const defenderDoc = game.actors.get(state.defenderId);
  const board = boardSnapshot();
  // Stage 9 subtracts 5d10 when the attacker is outside its Master's ZON, which
  // only the board can answer.
  const attacker = windowAugmented(unitFrom(board, attackerDoc), attackerDoc, state);
  const defender = unitFrom(board, defenderDoc);
  const ability = state.attack?.abilityId ? attackerDoc.items.get(state.attack.abilityId) : null;

  // Once, and shared: the option set the predicates read and the context the
  // pipeline reads have to be describing the same attack.
  const facts = attackFacts(attacker, defender, state);
  const options = rollOptionsFor({ attacker, defender, attack: facts });

  // The crit roll, then every roll the pipeline will consume — rolled HERE so
  // the pipeline itself stays pure and reproducible.
  //
  // A PERCENTAGE, not a `1d2`. §14.6: "the normal chance of getting a Crit
  // would be 50%. Some effects increase and decrease the chance." The coin
  // flip encoded the 50 and made every crit modifier in the game inert --
  // `Crit Up` applied, showed on the sheet, and changed nothing.
  // Hawkeye's crit clauses are predicated on the distance, so the plan cannot
  // be read without the attack in scope.
  const critSpec = critChance(attacker, defender, { options });
  const critRoll = await new Roll("1d100").evaluate();
  const isCrit = critSpec.blocked
    ? false
    : (critSpec.automatic || critRoll.total <= critSpec.percent);
  const attackRoll = await new Roll("5d10").evaluate();

  const ctx = {
    attacker, defender, board,
    attack: {
      // SPREAD, not rebuilt. `component`, `pierce` and `ignoresMagicResistance`
      // are all read by the pipeline and all three were dropped here, which is
      // why Magic Resistance could not be bypassed and Pierce did nothing.
      ...facts,
      abilityId: state.attack?.abilityId ?? null,
      rank: Rank.parseOrNull(ability?.system?.rank),
      categorizedAsNP: Boolean(ability?.system?.categorizedAsNP),
      // The branch-resolved element first, then the ability's own. Rebuilding it
      // from `ability.system` alone would drop a `damage.branches` element the
      // way this block used to drop `component` and `pierce` -- Karna's
      // Brahmastra Kundala is Fire and his Brahmastra is not, and both are the
      // same Servant's Noble Phantasms.
      element: resolvedDamage(ability, options)?.element ?? ability?.system?.element ?? facts.element ?? null,
      // See the note at the first spec-building site: the fraction travels with
      // the element or the attack silently becomes whole-element.
      elementFraction: resolvedDamage(ability, options)?.elementFraction
        ?? ability?.system?.damage?.elementFraction ?? facts.elementFraction ?? undefined,
      // Dragon Wing Warriors: "50 Fixed STR damage". The pipeline has read
      // `ctx.attack.isFixedDamage` (stages 1 and 2, `rules/damage/pipeline.mjs`)
      // since it was written; nothing ever set it from content, so an authored
      // `damage.fixed` was always computed as a normal, modifiable attack.
      //
      // Summoning: Bašmu's summon branch: `resolvedDamage` picks the matching
      // `damage.branches` entry (`{fixed: true, base: {fixedValue: 0}}`) so
      // this Combat Process -- which still runs, she resolves as her own
      // defender -- deals nothing rather than her own Base Attack.
      isFixedDamage: Boolean(resolvedDamage(ability, options)?.fixed) || dealsNoDamage(ability),
    },
    // An AFTERMATH resolution carries its own damage, spread onto the attack
    // spec when it was declared. Xiuhcoatl's splash uses BA(MAG) alone at 1x
    // where the primary uses the combined 250 at 4x, so reading the ability's
    // `damage` block here would give the splash the primary's numbers -- which
    // is precisely the "looks resolved, is wrong" failure the two-resolution
    // design exists to avoid.
    base: dealsNoDamage(ability)
      ? { fixedValue: 0 }
      : (facts.isAftermath && facts.sources)
        ? { sources: facts.sources }
        : baseSpecFor(attackerDoc, ability, facts.range, options),
    // Named base-attack sources. Stage 1 has resolved `ctx.units[src.unit]`
    // since the pipeline was written and nothing has ever supplied the map:
    // `"mount"` is its first entry, so a rider whose Normal Attack is replaced
    // by her platform's swings the platform's 150 rather than her own 125.
    units: mountUnits(attacker, board),
    // Same reason as `base` above: the splash's own multiplier, or the
    // ability's when this is the ordinary resolution.
    multiplier: (facts.isAftermath ? facts.multiplier : resolvedDamage(ability, options)?.multiplier) ?? 1,
    flatBonus: (facts.isAftermath ? facts.flatBonus : resolvedDamage(ability, options)?.flatBonus) ?? 0,
    conditionalMultipliers: (facts.isAftermath
      ? facts.conditionalMultipliers
      : resolvedDamage(ability, options)?.conditionalMultipliers) ?? [],
    crit: { isCrit, chanceUsed: critSpec.percent },
    // Which rolls this table plays with (Ch. 19). Threaded into ctx the way
    // `grandOrder` is, because a pure pipeline stage may not read a setting.
    difficulty: board?.difficulty,
    reaction: { kind: state.reaction ?? "none" },
    // §16.4 rule 4, both halves. The Master its Servants covered *"receives no
    // damage and effects"*; each covering Servant's *"Total Damage ... is
    // increased by 100%"*, divided among them.
    //
    // Stage 15 has read `totalDamageModifiers` since the pipeline was written
    // and **nothing had ever supplied one** -- so the whole "Total Damage"
    // family of clauses had a stage of its own and no way into it. This is its
    // first entry.
    totalDamageModifiers: coverModifiersFor(state, defender),
    luckChecks: {},
    rolls: {
      [isCrit ? "attackPlus" : "attackMinus"]: attackRoll.total,
      negation: await rollNegation(defender, state.attack?.kind === "np"),
      // Modifiers whose magnitude is rolled per damage event. Rolled here,
      // once, for both sides, so the pipeline stays pure and a replay of the
      // same rolls reproduces the same number.
      ...(await rollModifierDice([attacker, defender])),
    },
    options,
  };

  const result = computeDamage(ctx);
  // Whether it crit belongs ON the result, not only on the chat flag. Every
  // rider fired after the Damage Step reads its predicate off the option set,
  // and `attack:crit` can only be in that set if the resolved attack says so --
  // Serenity's `Macabre` is *"Normal Attack **Crits** inflict an additional
  // Stage of Poison"* and had no way to ask.
  result.flags = { ...result.flags, isCrit };

  // Dmg Cut: *"3 times"*. Spent here rather than at collection, and only when
  // the negation stage had something to reduce -- a charge burned against an
  // attack that already dealt nothing would make three uses mean fewer.
  const consuming = (ctx.rolls.negation ?? []).filter((n) => n.consumes);
  if (consuming.length > 0) {
    const stage = (result.breakdown ?? []).find((b) => b.index === 12);
    const before = (stage?.before?.mag ?? 0) + (stage?.before?.phys ?? 0);
    if (before > 0) {
      await applyBatch(consuming.map((n) => I.consumeUse(defender.id, n.consumes)), "damageNegation");
    }
  }

  // §16.5. Overpower can end the Master outright before damage matters;
  // Underpower halves a Master's own Total Damage. Both are Master-Servant
  // asymmetries and neither fires between two units of the same kind.
  const overpower = resolveOverpower({
    attacker, defender, roll: (await new Roll("1d100").evaluate()).total,
    luckCheckPassed: Boolean(state.luckChecks?.overpower),
  });
  const underpower = resolveUnderpower({
    attacker, defender, roll: (await new Roll("1d100").evaluate()).total,
  });
  if (underpower.underpowered) {
    const before = result.total;
    result.total = Math.max(0, Math.round(result.total * underpower.factor));
    result.breakdown = [
      ...(result.breakdown ?? []),
      { stage: "underpower", label: "Underpowered (x0.5)", from: before, to: result.total },
    ];
  }
  // The Luck Check that prevents the Overpower also saves the Master from
  // lethal damage -- one success buys both (§16.5).
  if (overpower.survivesLethal && result.total >= currentHealth(defender)) {
    result.total = Math.max(0, currentHealth(defender, 1) - 1);
    result.breakdown = [...(result.breakdown ?? []), { stage: "luckCheck", label: "Survives at 1 Health" }];
  }

  // Command Spell interrupts that changed the number rather than avoiding the
  // attack: Damage Block, Damage Up, Halve Noble Phantasm, NP Max. Applied to
  // the finished total, after every pipeline stage, because each is phrased
  // against "Total Damage" (Ch. 17 §17.2).
  const csFactor = process.damageFactorOf(state);
  if (csFactor !== 1) {
    const before = result.total;
    result.total = Math.max(0, Math.round(result.total * csFactor));
    result.breakdown = [
      ...(result.breakdown ?? []),
      { stage: "commandSpell", label: `Command Spell x${csFactor}`, from: before, to: result.total },
    ];
  }

  // Presence Concealment clause 1, and the reason concealment does not simply
  // make a Unit untargetable:
  //
  //   "This Unit cannot be targeted for an Attack or an enemy Unit's Skill. If
  //    it is caught in an AoE Attack and fails to Evade, Flip a Coin. If Heads,
  //    no damage and effects are received; if Tails, Total Damage taken from
  //    that Attack is reduced by 50% & PC is deactivated."
  //
  // Targeting already drops a concealed Unit from anything *chosen* (§9.7); an
  // area still reaches it, and this is the compensation. On **Total Damage**,
  // so it lands after every pipeline stage and after the Command Spell factor,
  // and before the barrier -- a shield in front of a Unit that took no damage
  // has nothing to absorb.
  if (state.isAoE && isConcealed(defender)) {
    const coin = await new Roll("1d2").evaluate();
    const veil = aoeOutcome(coin.total);
    const before = result.total;
    result.total = Math.max(0, Math.round(result.total * veil.factor));
    result.flags = { ...result.flags, concealmentVeil: veil };
    result.breakdown = [
      ...(result.breakdown ?? []),
      {
        stage: "concealment",
        label: veil.heads
          ? "Presence Concealment: Heads — nothing is received"
          : "Presence Concealment: Tails — Total Damage halved",
        from: before,
        to: result.total,
      },
    ];
    if (veil.deactivates) {
      const { deactivateConcealment } = await import("./concealment.mjs");
      const { DEACTIVATION_REASONS } = await import("../rules/concealment.mjs");
      await deactivateConcealment(defender.id, DEACTIVATION_REASONS.aoe);
    }
  }

  // A barrier standing in front of the defender takes the damage first, and
  // charges its owner for what it took. LAST, after every stage and every
  // Command Spell interrupt, because the sheet says it "will take the damage of
  // the enemy's NP" -- the finished number, not an intermediate one.
  const barrier = absorb(defender, result.total, { options });
  if (barrier.absorbed > 0) {
    result.total = barrier.through;
    result.breakdown = [
      ...(result.breakdown ?? []),
      { stage: "barrier", label: `${barrier.source} absorbed ${barrier.absorbed}`, to: barrier.through },
    ];
  }

  // "These recorded Attacks can no longer defeat Heracles -- whenever a recorded
  // Attack would reduce his Health to 0, his Health will remain at 1 instead."
  // A floor rather than a negation: the damage still lands, it just cannot be
  // the last of it.
  const recorded = recordedAttack(defender, attackIdentity(facts, state.attackerId));
  if (recorded.floored && result.total >= currentHealth(defender)) {
    const before = result.total;
    result.total = Math.max(0, currentHealth(defender) - 1);
    result.breakdown = [
      ...(result.breakdown ?? []),
      { stage: "recorded", label: `${recorded.source}: survives at 1`, from: before, to: result.total },
    ];
  }

  await applyBatch(
    [
      ...barrier.intents,
      I.damage(state.defenderId, result.total, result.breakdown),
      ...(result.flags.defeatedOutright ? [I.defeat(state.defenderId, "petrify")] : []),
      I.log({ kind: "damage", attackerId: state.attackerId, defenderId: state.defenderId, total: result.total }),
      // Damage that empties a Health bar is where `unitDefeated` fires, and
      // until now nothing fired it — so Battle Continuation, which is authored
      // entirely as an `OnEvent: unitDefeated`, could never trigger. The revive
      // is decided *here*, before the defeat is written, because a unit that
      // comes back was never defeated.
      ...(overpower.defeated ? [I.defeat(state.defenderId, "overpowered")] : []),
      ...(result.flags.defeatedOutright || overpower.defeated
        ? [] : await resolveDefeatOf(defender, result.total, state)),
    ],
    "attack",
  );

  await message.setFlag("fgt", "result", {
    total: result.total, magical: result.magical, physical: result.physical,
    breakdown: result.breakdown, flags: result.flags, isCrit,
  });

  await tallyDamageAgainstFields(defender, attacker, result.total, board);

  return result;
}

/**
 * Count this hit against the Round window of every field it damaged.
 *
 * > *"…or would receive more than 3000 damage on the same round. In this case,
 * > Ramesseum Tentyris cannot be used again for the rest of the game."*
 *
 * On the ORDINARY damage path, not on `closeFieldsPiercedBy`. That function
 * runs for Noble Phantasms only, and this clause plainly covers every attack —
 * three thousand damage is three thousand damage however it was dealt.
 *
 * **Which damage counts is a reading**, and it is this: damage taken by a Unit
 * standing inside the field that is NOT an enemy of the field's owner. The
 * clause's subject is the Complex ("it … would receive"), and a bounded field
 * has no Health of its own; the nearest thing this system can measure is what
 * the area fails to protect. Counting every hit inside would let Ozymandias's
 * own Sphinxes break his Complex by beating on an intruder, which no reading
 * of the sentence supports.
 *
 * @param {object} defender the defender's board unit
 * @param {object} attacker the attacker's board unit
 * @param {number} total
 * @param {object} board
 * @returns {Promise<void>}
 */
async function tallyDamageAgainstFields(defender, attacker, total, board) {
  if (!(total > 0) || !defender) return;
  const inside = defender.fields ?? [];
  if (inside.length === 0) return;

  const { vulnerabilityTriggered } = await import("../rules/bounded-fields.mjs");
  const { deactivateField, tallyAgainstField, lockOutField } = await import("./fields.mjs");
  const { relationOf } = await import("../rules/relations.mjs");

  for (const fieldId of inside) {
    const field = (board.fields ?? []).find((f) => f.id === fieldId);
    if (!field) continue;
    const owner = (board.units ?? []).find((u) => u.id === field.ownerId) ?? null;
    // What the area failed to protect, not what it hurt.
    if (relationOf(owner, defender, board) === "enemy") continue;
    // ...and not a Unit hitting its own side inside its own area.
    if (attacker && relationOf(owner, attacker, board) !== "enemy") continue;

    const window = await tallyAgainstField(fieldId, { damage: total });
    const hit = vulnerabilityTriggered(field, { kind: "damage", damageThisWindow: window.damage });
    if (!hit.triggered) continue;
    if (hit.result === "endPermanently") await lockOutField(field);
    await deactivateField(fieldId, "vulnerability");
  }
}

/**
 * Roll every rolled modifier the given units carry.
 *
 * Keyed by the modifier's own roll key, so two units carrying the same effect
 * roll separately only if the content gives them separate keys — which is the
 * right default: Goddess of War is hers, and a second copy on somebody else is
 * a different die.
 *
 * @param {object[]} units
 * @returns {Promise<Record<string, number>>}
 */
async function rollModifierDice(units) {
  /** @type {Record<string, number>} */
  const out = {};
  for (const unit of units) {
    for (const m of unit?.modifiers ?? []) {
      if (!m.roll?.formula || out[m.roll.key] !== undefined) continue;
      out[m.roll.key] = (await new Roll(m.roll.formula).evaluate()).total;
    }
  }
  return out;
}

/**
 * Roll every dice-mode `DamageNegation` the defender carries.
 *
 * Battle Continuation is the archetype: `2d10+15` at rank B, and against a
 * Noble Phantasm *the number of dice is doubled* rather than the total — a
 * distinction that matters by about seven points on average, and one the
 * per-Servant sheets are explicit about (Ch. 41 Q16).
 *
 * @param {object} defender the defender's snapshot
 * @param {boolean} isNP
 * @returns {Promise<Array<{source: string, value: number, formula: string}>>}
 */
async function rollNegation(defender, isNP) {
  const out = [];
  for (const n of defender.damageNegation ?? []) {
    // A FLAT negation, which this loop skipped outright. Every negation in the
    // corpus was dice-mode until Pale Rider's Dmg Cut ("all damage taken is
    // reduced by 100"), so `mode: "flat"` -- the executor's own default --
    // authored cleanly, collected cleanly and reduced nothing. There is no
    // roll to make; the value is the value.
    if (n.mode === "flat") {
      const value = Number(n.formula) || 0;
      if (value <= 0) continue;
      if (isNP && n.includesNP === false) continue;
      // Spent only when it is about to apply. A charge burned on an attack
      // that dealt nothing would make "3 times" mean rather less than three.
      if (n.consumesUse && n.defId) out.push({ source: n.source, value, consumes: n.defId });
      else out.push({ source: n.source, value });
      continue;
    }
    if (n.mode !== "dice" || !n.formula) continue;
    const formula = isNP && n.npDiceDoubled ? doubleDice(n.formula) : n.formula;
    const roll = await new Roll(formula).evaluate();
    out.push({ source: n.source, value: roll.total + (n.bonus ?? 0), formula });
  }
  return out;
}

/**
 * Double the dice count of every term in a formula, leaving flat bonuses alone.
 * `2d10+15` becomes `4d10+15`.
 * @param {string} formula
 * @returns {string}
 */
function doubleDice(formula) {
  return String(formula).replace(/(\d+)d(\d+)/gi, (_, n, faces) => `${Number(n) * 2}d${faces}`);
}

/**
 * Apply the effect riders an ability declares in its `phases`.
 *
 * Every application goes through the seven-step pipeline in
 * `effect-applier.mjs`, so immunity, exclusivity, the chance roll and stacking
 * are all honoured -- and every step's outcome is recorded, so the card can say
 * "Burn resisted (rolled 78 vs 65%)" rather than silently doing nothing.
 *
 * @param {object} state
 * @param {object} damageResult
 * @returns {Promise<Array<{summary: object, result: object}>>}
 */
async function applyAbilityEffects(state, damageResult, { when = "afterDamage" } = {}) {
  const attackerDoc = game.actors.get(state.attackerId);
  const ability = state.attack?.abilityId ? attackerDoc?.items.get(state.attack.abilityId) : null;
  const defenderDoc = game.actors.get(state.defenderId);
  if (!ability || !defenderDoc) return [];

  // §16.4 rule 4: *"the Master receives no damage AND EFFECTS"*. The damage
  // half is stage 15's `factor: 0`; this is the other half, and it has to be
  // here rather than in the pipeline because a rider is not damage and would
  // otherwise land on a Master its Servants just took the blast for.
  if (coverStateFor(state)?.masterId === state.defenderId) return [];

  // Nothing rides on an attack that dealt nothing. Invuln explicitly does NOT
  // prevent rider debuffs, but it also does not zero the damage to zero via
  // this path -- negation is what matters here.
  if (damageResult.flags?.negatedBy) return [];

  const defender = unitSnapshot(defenderDoc);
  const applied = [];

  // An AFTERMATH resolution carries its own riders and NOT the ability's
  // phases. Xiuhcoatl's splash inflicts Burn for 1◈ and NP Seal at 25%, where
  // the primary inflicts Burn for 2◈ and NP Seal outright -- the sheet states
  // four numbers and shares none of them, so running the phases here would
  // hand the splash the primary's riders and look entirely correct.
  if (state.attack?.isAftermath) {
    for (const rider of ability.system?.aftermath?.effects ?? []) {
      const def = EffectRegistry.get(rider.id);
      if (!def) {
        console.error(`FGT | ${ability.name}'s aftermath names unknown effect "${rider.id}".`);
        continue;
      }
      const roll = await new Roll("1d100").evaluate();
      const outcome = applyEffect({
        def,
        target: defender,
        // "with a 25% chance of inflicting NP Seal for 1◈ Turns" -- the
        // rider's own stated chance, which the applier folds in with the
        // target's resistances rather than rolling separately from them.
        chance: rider.chance ?? null,
        magnitude: rider.magnitude ?? def.defaultMagnitude ?? 0,
        duration: rider.duration ?? def.defaultDuration,
        source: { unitId: state.attackerId, abilityId: ability.id },
        ctx: {
          turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
          currentTick: game.combat?.system?.globalTurn ?? 0,
          roll: roll.total,
          inflictBonus: inflictBonusOf(unitSnapshot(game.actors.get(state.attackerId)), def),
          options: rollOptions(unitSnapshot(game.actors.get(state.attackerId)), defender, state),
        },
      });
      if (outcome.intents.length > 0) await applyBatch(outcome.intents, "aftermathEffect");
      applied.push({
        summary: { id: rider.id, name: def.name, outcome: outcome.outcome, reason: outcome.reason },
        result: outcome,
      });
    }
    return applied;
  }

  // The CASTER's own options, for a phase-level `predicate:` -- the same
  // vocabulary `engine/skill-use.mjs#runPhases` already reads, extended to
  // this loop for Summoning: Bašmu's summon branch (a `summon` phase gated
  // off from the damage-spell branch's `damage`/`applyEffects` pair).
  const attackerUnit = unitFrom(boardSnapshot(), attackerDoc);
  const casterOptions = rollOptionsFor({ attacker: attackerUnit });

  // Through `effectivePhases`, because a copy (§15.7) has none of its own --
  // reading `.phases` directly makes Scáthach's copies load and do nothing.
  for (const phase of effectivePhases(ability.system ?? {}, resolveAbilitySource)) {
    // WHEN this phase runs relative to the damage. Unstated means after, which
    // is what every phase written before this window existed meant.
    if ((phase.when ?? "afterDamage") !== when) continue;
    if (phase.predicate && !testPredicate(phase.predicate, { options: casterOptions })) continue;
    // Medea's Rule Breaker: "removes all buffs from the DU", and then cuts the
    // Contract if the DU is a Servant that FAILED to Evade.
    if (phase.kind === "removeEffect") {
      await applyBatch(await removalIntents(phase, defenderDoc, defender), "np:removeEffect");
      continue;
    }
    if (phase.kind === "cutContract") {
      applied.push(...await cutContract(phase, state, defenderDoc));
      continue;
    }
    // A CHECK the defender makes, which branches the Noble Phantasm. Scáthach's
    // Gate of Skye: *"All targeted Units perform a Luck Check ... If the
    // targeted Unit's Luck Check fails, it is inflicted with Death. If the
    // Unit's Luck Check Succeeds, it receives 4x damage plus 100."*
    if (phase.kind === "check") {
      applied.push(...await runCheckPhase(phase, ability, state, defender));
      continue;
    }
    // NOT `summon` (nor `resource`/`statChange`/etc): those are "everything
    // the ability does to its USER, which the Combat Process has no rung
    // for" and already run exactly once, at declaration, through
    // `resolveAttack`'s own `runCasterPhases` call -- `CASTER_PHASES`
    // (engine/skill-use.mjs) lists `summon` explicitly. Adding a second
    // `case "summon"` here double-conjured Bašmu: one from that call, one
    // from this loop's own "afterDamage" pass, found live the moment two
    // appeared from a single cast. This loop's whole job is the two kinds
    // `CASTER_PHASES` deliberately excludes -- `damage` IS the Combat
    // Process, and `applyEffects` is its post-damage rider step, both of
    // which resolve per DEFENDER rather than once per caster.
    if (phase.kind !== "applyEffects" && phase.kind !== "applyEffect") continue;

    // A rider aimed at the ATTACKER. Bellerophon is the first: *"Then, applies
    // Crit Up for 1◈ Turns"* -- to Medusa, after her own damage lands. This
    // loop read no `target` at all and applied everything to the defender, so
    // a self-buff would have gone to the enemy it just hit.
    //
    // ONCE per Combat Phase, not once per defender: an AoE fans out into a
    // Process each, and `critUp` stacks by magnitude -- a 13-panel line
    // through four Units would have granted +120% instead of +30%. The first
    // defender's Process is the one that pays it, chosen by group order so
    // every client agrees which that is.
    if (phase.target === "self") {
      if (!isFirstOfGroup(state)) continue;
      const attackerUnit2 = unitSnapshot(attackerDoc);
      applied.push(...await applyDeclaredEffects(
        (phase.rules ?? phase.effects ?? []).map((r) => r.effect ?? r),
        ability,
        { ...state, defenderId: state.attackerId },
        attackerUnit2,
      ));
      continue;
    }
    // A rider that reaches a DIFFERENT set of Units from the one this attack
    // hit. The Skill path has honoured a phase's own `targeting:` since EMIYA's
    // Eye of the Mind (True) EX needed it (`skill-use.mjs#phaseTargets`); the
    // attack path never has, so the same clause on a Noble Phantasm or an
    // Attack Skill landed on the defender instead.
    //
    // Mannanán's Fragarach Counter is the case that found it: *"apply S.Crit Up
    // to all allied Units within a 2 panel area of MANNANÁN"* -- her allies, in
    // the middle of a Process aimed at somebody else. Once per Combat Phase for
    // the same reason `target: self` is: an area attack fans out into a Process
    // each, and a magnitude-stacking buff applied per Process would multiply.
    if (phase.targeting) {
      if (!isFirstOfGroup(state)) continue;
      applied.push(...await applyTargetedRider(phase, ability, state, attackerDoc));
      continue;
    }
    // Both authored shapes. §15.2's own is `effects: [{id, ...}]`; the earlier
    // content wrapped each in an `OnEvent` rule element, and both still ship.
    // Reading only `rules` silently dropped every rider on the newer shape --
    // Medea's Aero dealt its damage and inflicted no Bleed.
    for (const rule of phase.rules ?? phase.effects ?? []) {
      const spec = rule.effect ?? rule;
      if (!spec?.id) continue;

      const def = EffectRegistry.get(spec.id);
      if (!def) {
        // Loud, because a missing definition means the ability silently does
        // less than its text says.
        console.warn(`FGT | ${ability.name} applies unknown effect "${spec.id}"`);
        ui.notifications?.warn(`FGT | Unknown effect "${spec.id}" on ${ability.name}`);
        continue;
      }

      const roll = await new Roll("1d100").evaluate();
      const outcome = applyEffect({
        def,
        target: defender,
        chanceModifiers: spec.chanceModifiers ?? rule.chanceModifiers ?? [],
        // The ability's own stated chance, overriding the effect's default.
        chance: spec.chance ?? rule.chance ?? null,
        // An authored magnitude may be an `@` EXPRESSION rather than a number
        // (`rules/elements.mjs#resolveValue`), resolved against the CASTER at
        // the moment of application. One rule for both use paths: the Skill
        // path already did this, and an ability that resolves through the
        // attack path instead -- every Noble Phantasm -- would otherwise apply
        // the string itself as a magnitude and land nothing at all.
        magnitude: authoredMagnitude(spec, attackerDoc, "magnitude", state.attack?.ride)
          ?? def.defaultMagnitude ?? 0,
        npMagnitude: authoredMagnitude(spec, attackerDoc, "npMagnitude", state.attack?.ride)
          ?? authoredMagnitude(rule, attackerDoc, "npMagnitude", state.attack?.ride),
        // How many stages one application is worth. *"Inflicts Stage 3 Poison
        // on the DU"* is one application, not three -- three would roll the
        // chance three times and be improved three times by a Debuff ChUp.
        stages: spec.stages ?? rule.stages ?? 1,
        duration: rule.duration ?? spec.duration ?? def.defaultDuration,
        source: { unitId: state.attackerId, abilityId: ability.id },
        ctx: {
          turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
          currentTick: game.combat?.system?.globalTurn ?? 0,
          roll: roll.total,
          // The attacker's own outgoing `ApplicationChance` contributions.
          // Hardcoded to 0 until Medea's Item Construction needed it, which
          // made every outgoing contribution in the game inert.
          inflictBonus: inflictBonusOf(unitSnapshot(game.actors.get(state.attackerId)), def),
          options: rollOptions(unitSnapshot(game.actors.get(state.attackerId)), defender, state),
          // NOT `resist: 0`. `applyEffect` falls back to `resistanceOf(target)`
          // when this is absent -- and `0 ?? x` is `0`, so an explicit zero
          // here defeated that fallback and made the target's resistance
          // universally inert. Magic Resistance's *"chance of being inflicted
          // by debuffs is reduced by 20%"* has therefore never reduced
          // anything, on this path or the check path; the applier's own
          // comment describes the loop as closed and it was not.
        },
      });

      if (outcome.intents.length > 0) await applyBatch(outcome.intents, "abilityEffect");
      applied.push({
        summary: { id: spec.id, name: def.name, outcome: outcome.outcome, reason: outcome.reason },
        result: outcome,
      });
    }
  }
  return applied;
}

/**
 * An authored magnitude, which may be a number or an `@` expression.
 *
 * The same helper `engine/skill-use.mjs` uses, for the same reason and against
 * the same facade — a magnitude that means two numbers depending on which path
 * resolved the ability would be worse than one that means nothing.
 *
 * `null` passes through: `npMagnitude` uses it to mean *"this effect has no
 * reduced NP magnitude"*, and coercing that to 0 would make every buff worth
 * nothing against a Noble Phantasm.
 *
 * @param {number|string|null|undefined} raw
 * @param {object} actor the caster
 * @returns {number|null}
 */
function authoredMagnitude(spec, actor, field = "magnitude", ride = null) {
  const raw = spec?.[field];
  if (raw === null || raw === undefined) return null;
  // Straight through unless the SPEC asks for more than a number: a literal
  // with no `perStack` and no `max` cannot mean anything else.
  if (typeof raw === "number" && !spec.perStack && spec.max === undefined) return raw;

  const value = resolveValue(spec, null, {
    // The ride's own facts, when there was one. `@self.remainingMov` is
    // OVERRIDDEN here rather than read off the document, because the ride has
    // already written its movement by the time a rider phase resolves.
    refs: expressionRefs(actor, ride ? { ride, hitCount: ride.hitCount } : {}),
    // `perStack` on an effect spec, so a magnitude may scale with what the
    // CASTER is carrying. Kingprotea's Airavata King Size is *"NP damage dealt
    // is increased by X%"* where X is her size, and her size is one step per
    // three Proliferation stocks -- the same count her growth reads, rather
    // than a second reader of the footprint it produced.
    stacks: stacksHeld(actor),
  }, field);
  return typeof value === "number" ? value : null;
}

/**
 * Apply one rider phase to whatever its own `targeting:` resolves to.
 *
 * Anchored on the ATTACKER, because that is what a phase-level targeting block
 * on an attacker's ability means everywhere it is already used — *"all allied
 * Units within a 2 panel area of himself"*.
 *
 * @param {object} phase
 * @param {object} ability
 * @param {object} state
 * @param {object} attackerDoc
 * @returns {Promise<object[]>}
 */
async function applyTargetedRider(phase, ability, state, attackerDoc) {
  const board = boardSnapshot();
  const caster = unitFrom(board, attackerDoc) ?? unitSnapshot(attackerDoc);
  const resolved = resolveTargets(phase.targeting, caster, board, { unitId: caster.id, panel: caster.panel });

  /** @type {object[]} */
  const out = [];
  for (const target of resolved.units ?? []) {
    const doc = game.actors.get(target.unitId);
    if (!doc) continue;
    out.push(...await applyDeclaredEffects(
      (phase.rules ?? phase.effects ?? []).map((r) => r.effect ?? r),
      ability,
      { ...state, defenderId: target.unitId },
      board.units.find((u) => u.id === target.unitId) ?? unitSnapshot(doc),
    ));
  }
  return out;
}

/**
 * Defeat a defender left at zero Health by something other than damage.
 *
 * @param {object} state
 * @returns {Promise<void>}
 */
async function resolveEmptiedDefender(state) {
  const doc = game.actors.get(state.defenderId);
  if (!doc) return;

  const defender = unitFrom(boardSnapshot(), doc);
  if (currentHealth(defender) > 0) return;

  // Zero damage: the Health is already gone. This asks "is it defeated", not
  // "take this much more".
  const intents = await resolveDefeatOf(defender, 0, state);
  if (intents.length > 0) await applyBatch(intents, "terminal");
}

/**
 * Terrain the attack just changed.
 *
 * Two clauses, and they are opposites (§42.2): Fire **creates** Burning out of
 * a Forest permanently, and **consumes** a Meadow at the end of the Damage
 * Step. `rules/terrain.mjs#terrainConversions` decides both; this is the caller
 * it never had.
 *
 * The coin is flipped HERE and passed in, keeping the rules layer pure — the
 * same "caller rolls" contract the crit, negation and Injury rolls use.
 *
 * Fired whether or not the damage landed: a Forest catches fire from a Fire
 * attack that was Blocked, and the Meadow clause is *"at the end of the Damage
 * Step"* rather than "on a hit".
 *
 * @param {object} state
 * @param {object} result
 * @returns {Promise<void>}
 */
async function applyTerrainConversions(state, result) {
  if (!state.defenderId) return;
  const element = state.attack?.element ?? null;
  // The rules function refuses anything but Fire; asked here too, so a
  // non-Fire attack does not roll a coin it can never read.
  if (element !== "fire") return;

  const board = currentBoard();
  const defender = board.units.find((u) => u.id === state.defenderId);
  if (!defender?.panel) return;

  const coin = (await new Roll("1d2").evaluate()).total === 1 ? "heads" : "tails";
  const changes = terrainConversions({
    defender, board, element, coin,
    areaPanels: state.attack?.areaPanels ?? null,
  });
  if (changes.length === 0) return;

  for (const change of changes) {
    if (change.kind === "convertTerrain") {
      await paintTerrain({
        types: [change.to],
        panels: change.panels,
        // "does not revert to Forest afterwards" — a conversion that does not
        // revert is PERMANENT, so it carries no expiry even though the sheet
        // states a duration for the fire itself.
        duration: change.reverts ? change.duration : null,
        tag: `conversion:${change.to}:${state.defenderId}:${result.total}`,
      });
    } else if (change.kind === "removeTerrain") {
      // A Meadow is map terrain a GM drew, so it carries no tag and is
      // addressed by type and panel instead.
      await removeTerrainType(change.type, change.panels);
    }
  }
}

/**
 * Raise `damageStepEnd` on the **attacker**.
 *
 * On the attacker, because the clause that needs it is about attacking: *"when
 * a successful Attack is performed"*. The Defending Unit travels in the option
 * set rather than in the unit list, so a handler can pay out differently
 * against an Undead or Divine target — the second half of Alpi — without the
 * defender's own handlers firing for somebody else's attack.
 *
 * @param {object} state
 * @returns {Promise<void>}
 */
async function fireDamageStepEnd(state) {
  const attacker = unitSnapshot(game.actors.get(state.attackerId));
  const defender = state.defenderId ? unitSnapshot(game.actors.get(state.defenderId)) : null;
  if (!defender) return;

  const intents = fireEvent("damageStepEnd", [attacker], {
    tick: game.combat?.system?.globalTurn ?? 0,
    turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
    board: currentBoard(),
    options: rollOptions(attacker, defender, state),
    rolls: {},
  });

  if (intents.length > 0) await applyBatch(intents, "damageStepEnd");
}

/**
 * A check the DEFENDER makes, and what failing it costs.
 *
 * Scáthach's Gate of Skye is the only one in the reference set, and every part
 * of it is unusual. The check is rolled by the target rather than by the
 * attacker; its difficulty is read from a rank table keyed on the target's own
 * MAG; and failing it is worse than succeeding, because success only means
 * taking 4x damage.
 *
 * `gateOfSkyeSaveModifier` is an **equality** table, not a threshold: *"if
 * their MAG is Rank B, reduce the value rolled by 2; if their MAG is Rank A,
 * reduce it by 4"*, and a `MAG A+` target gets nothing. It has sat in
 * `domain/tables.mjs` since the tables were transcribed with nothing reading
 * it.
 *
 * @param {object} phase
 * @param {object} ability
 * @param {object} state
 * @param {object} defender the defender's snapshot
 * @returns {Promise<object[]>}
 */
export async function runCheckPhase(phase, ability, state, defender, depth = 0) {
  // *"If Failed, roll again"* is one more roll, not a loop.
  if (depth >= MAX_CHECK_DEPTH) return [];

  const attackerDoc = game.actors.get(state.attackerId);
  const attacker = unitSnapshot(attackerDoc);

  // WHICH outcome this target gets, before anything is rolled. Medusa's Mystic
  // Eyes has three, chosen by what the target IS -- and a phase with no
  // `branches` is its own branch, which is the shape Gate of Skye authors and
  // the one that had to keep resolving unchanged.
  // The DEFENDER's options, on the `target:` side. A branch asks what the unit
  // being checked is -- "Humans (including Masters)", "Servants with MAG of
  // Rank B or higher" -- so passing it as the attacker would emit `self:` and
  // every branch predicate would miss.
  const branch = selectBranch(phase, rollOptionsFor({ attacker: null, defender }));
  if (!branch) return [];

  const kind = branch.check ?? phase.check ?? "luck";
  const roll = await new Roll("1d20").evaluate();

  // The table modifier, keyed on the SUBJECT's parameter rather than on the
  // attacker's rank -- which is what makes it a save rather than a to-hit.
  /** @type {Array<{source: string, value: number}>} */
  const tableModifiers = [];
  if (phase.modifierTable) {
    const rank = Rank.parseOrNull(defender.parameters?.[phase.modifierRank ?? "mag"] ?? null);
    const value = Number(lookup(phase.modifierTable, rank) ?? 0);
    if (value !== 0) {
      tableModifiers.push({ source: `${(phase.modifierRank ?? "mag").toUpperCase()} ${rank}`, value });
    }
  }

  const plan = checkPlan(defender, kind);
  // A LUCK Check is contested against the attacker's Luck and costs the
  // defender a point either way (Ch. 14). Any other parameter is a plain check
  // against that stat -- the same `resolveCheck`/`checkPlan` pair Cover
  // (§16.4 rule 4) resolves an Agility Check with, and for the same reason:
  // going through `evade()` would let an Evade-specific bonus help.
  const outcome = kind === "luck"
    ? luckCheck({
      roll: roll.total,
      luck: defender.luck,
      opposingLuck: attacker.luck,
      hasBoost: (defender.effects ?? []).includes("luckBoost") || plan.forceTable === "favourable",
      hasLoss: (defender.effects ?? []).includes("luckLoss") || plan.forceTable === "unfavourable",
      modifiers: [...plan.modifiers, ...tableModifiers],
    })
    : resolveCheck({
      roll: roll.total,
      target: defender[kind] ?? 0,
      table: plan.forceTable === "unfavourable" ? "unfavourable" : "favourable",
      modifiers: [...plan.modifiers, ...tableModifiers],
    });

  /** @type {object[]} */
  const intents = [I.log({
    kind: "check", check: kind, unitId: state.defenderId, attempt: depth + 1,
    roll: outcome.roll, total: outcome.total, target: outcome.target, success: outcome.success,
    modifiers: outcome.modifiers,
  })];
  if (kind === "luck") intents.unshift(I.statDelta(state.defenderId, "luck.value", -1));
  await applyBatch(intents, "np:check");

  const taken = outcome.success ? branch.onSuccess : branch.onFail;
  if (!taken) return [];

  // "If Failed, roll again. On the second time, if Successful ... If Failed ..."
  if (isNestedCheck(taken)) {
    return runCheckPhase(
      { ...taken, modifierTable: phase.modifierTable, modifierRank: phase.modifierRank,
        ignoresResistanceFrom: phase.ignoresResistanceFrom },
      ability, state, defender, depth + 1,
    );
  }

  // An outcome that is not an effect: *"reduce the DU's Agility by 2"*.
  if (taken.statDeltas?.length) {
    await applyBatch(
      taken.statDeltas.map((d) => I.statDelta(state.defenderId, d.path, d.delta)),
      "np:check:stat",
    );
  }
  if (!taken.effects?.length) return [];

  return applyDeclaredEffects(taken.effects, ability, state, defender, {
    ignoresResistanceFrom: phase.ignoresResistanceFrom ?? [],
  });
}

/**
 * Apply a list of authored effect specs to the defender.
 *
 * Extracted so the check phase and the ordinary rider path build the same
 * application with the same context — two constructions of `applyEffect`'s
 * argument object is two places for `inflictBonus` or the option set to go
 * missing, which is how outgoing contributions were inert once already.
 *
 * @param {object[]} specs
 * @param {object} ability
 * @param {object} state
 * @param {object} defender
 * @returns {Promise<object[]>}
 */
async function applyDeclaredEffects(specs, ability, state, defender, { ignoresResistanceFrom = [] } = {}) {
  const attacker = unitSnapshot(game.actors.get(state.attackerId));
  /** @type {object[]} */
  const out = [];

  for (const spec of specs) {
    const def = EffectRegistry.get(spec.id);
    if (!def) {
      console.warn(`FGT | ${ability.name} applies unknown effect "${spec.id}"`);
      continue;
    }

    const roll = await new Roll("1d100").evaluate();
    const outcome = applyEffect({
      def,
      target: defender,
      // Resolved the same way the rider path resolves it, from the same
      // helper -- `target: self` effects come through here (Bellerophon's own
      // Crit Up, Mannanán's token-scaled Atk Up) and an authored expression
      // must mean the same number on both.
      magnitude: authoredMagnitude(spec, game.actors.get(state.attackerId), "magnitude", state.attack?.ride)
        ?? def.defaultMagnitude ?? 0,
      npMagnitude: authoredMagnitude(spec, game.actors.get(state.attackerId), "npMagnitude", state.attack?.ride),
      duration: spec.duration ?? def.defaultDuration,
      chanceModifiers: spec.chanceModifiers ?? [],
      chance: spec.chance ?? null,
      source: { unitId: state.attackerId, abilityId: ability.id },
      ctx: {
        turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
        currentTick: game.combat?.system?.globalTurn ?? 0,
        roll: roll.total,
        inflictBonus: inflictBonusOf(attacker, def),
        options: rollOptions(attacker, defender, state),
        // Left undefined rather than 0 so the applier computes the target's
        // own resistance: `ctx.resist ?? resistanceOf(...)` reads a literal 0
        // as "no resistance", which is how an authored `Debuff Res Up` used to
        // be ignored on this path.
        ignoresResistanceFrom,
      },
    });

    if (outcome.intents.length > 0) await applyBatch(outcome.intents, "npCheckEffect");
    out.push({
      summary: { id: spec.id, name: def.name, outcome: outcome.outcome, reason: outcome.reason },
      result: outcome,
    });
  }
  return out;
}

/**
 * Which effect, having landed before the damage, cancels it.
 *
 * `damage.skipIf.effectApplied` names it. Gáe Bolg Alternative: *"If Instakill
 * is not inflicted, this NP deals 3.5x damage plus 100"* — so a **successful**
 * Instakill is what suppresses the damage, and a failed one lets it through.
 *
 * Only `applied` counts. A `resisted` or `blocked` Instakill did not happen,
 * and the Noble Phantasm falls back to its damage exactly as the sheet says.
 *
 * @param {object} state
 * @param {object[]} before the results of the pre-damage phases
 * @returns {string|null} the effect that suppressed it
 */
function damageSuppressedBy(state, before) {
  const attackerDoc = game.actors.get(state.attackerId);
  const ability = state.attack?.abilityId ? attackerDoc?.items.get(state.attack.abilityId) : null;
  const skipIf = ability?.system?.damage?.skipIf ?? null;
  if (!skipIf?.effectApplied) return null;

  const landed = before.some(
    (a) => a.summary.id === skipIf.effectApplied && a.summary.outcome === "applied",
  );
  return landed ? skipIf.effectApplied : null;
}

/**
 * @param {object} state
 */
async function applyFacing(state) {
  const attacker = unitSnapshot(game.actors.get(state.attackerId));
  const defender = unitSnapshot(game.actors.get(state.defenderId));
  const di = attacker.panel.i - defender.panel.i;
  const dj = attacker.panel.j - defender.panel.j;
  const facing = Math.abs(di) >= Math.abs(dj)
    ? (di < 0 ? "n" : "s")
    : (dj > 0 ? "e" : "w");
  await applyBatch([I.setFacing(state.defenderId, facing)], "facing");
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * @param {object[]} intents
 * @param {string} source
 */
async function applyBatch(intents, source) {
  return applyIntents(intents, {
    io: worldIO(),
    canWrite: (unitId) => game.actors.get(unitId)?.isOwner ?? false,
    isGM: game.user.isGM,
    source,
  });
}

/** @returns {object} */
function boardSnapshot() {
  return currentBoard({ region: game.settings.get("fgt", "region") || null });
}

/**
 * A normal attack targets one unit inside the attack-Range shape; an ability
 * declares its own targeting.
 * @param {object} attacker
 * @param {object|null} ability
 * @param {Set<string>|null} [options] the caster's own roll options, for
 *   `targeting.branches`
 * @returns {object}
 */
function targetSpecFor(attacker, ability, options = null) {
  // The PROJECTION, not the document. A Unit's Range is not always the one its
  // sheet was written with -- `rules/snapshot.mjs` folds in `RangeDelta`
  // contributions and a variant override, and Mannanán's Holder Mode uses the
  // second: *"Range is increased to 3 panels."* Reading `attacker.system.range`
  // here refused her own Normal Attack at 2 panels while every other consumer
  // agreed she reached 3, and it would have done the same to any Servant
  // carrying a `Range Up`.
  //
  // The attacker still travels through so a bare Normal Attack can carry a
  // shape of its own -- Kagome: Famine's "3x3 panel area".
  const projected = unitFrom(boardSnapshot(), attacker) ?? unitSnapshot(attacker);
  const range = typeof projected.range === "number"
    ? projected.range
    : (attacker.system.range?.panels ?? 1);
  return specForAbility(ability, range, options, projected);
}

/**
 * The targeting spec for an attack, exported so the canvas preview resolves the
 * same declaration the resolution will.
 *
 * Two implementations of "what does this ability target" is the fastest route
 * to a preview that lies, so there is one.
 *
 * @param {object} attacker an `FGTActor`
 * @param {object|null} ability
 * @param {Set<string>|null} [options]
 * @returns {object}
 */
export function targetSpecForAttack(attacker, ability, options = null) {
  return targetSpecFor(attacker, ability, options);
}

/**
 * @param {object} attacker
 * @param {object|null} ability
 * @returns {object}
 */
function baseSpecFor(attacker, ability, range = null, options = null) {
  const dmg = resolvedDamage(ability, options);
  if (dmg?.base) return dmg.base;

  // A DECLARED component, which decides the arithmetic and not only what the
  // attack counts as.
  //
  // `componentOf` has read `damage.component` since it was written -- so an
  // ability declaring `mag` was correctly exempt from the wrong half of Magic
  // Resistance and correctly matched `attack:component:mag` -- while the number
  // was still built from the Servant's *Normal Attack* component. Every Noble
  // Phantasm in the corpus that states a Base Attack without spelling out a
  // `base` block was therefore computed from the other one: Serenity's Zabaniya
  // multiplied BA(STR) 65 where her sheet says BA(MAG) 100, and EMIYA's
  // Hrunting and Caladbolg II, Medea's Aero and Rain of Light, and three of
  // Scáthach's four all did the same. Found live.
  const declared = dmg?.component ?? null;
  if (declared) return { sources: [{ unit: "self", component: declared, factor: 1 }] };

  // Through the same rule the option set used, so the number the pipeline adds
  // up and the component a predicate tests cannot disagree.
  //
  // Off the PROJECTION, not the document. A Unit's normal attack is not always
  // the one its sheet was written with: `rules/snapshot.mjs` folds in a variant
  // override, and Mannanán's Holder Mode uses one -- *"Normal Attacks at a
  // Range of 1 to 2 use Base Attack (STR) and 30% of Base Attack (MAG)
  // combined"*. Reading `attacker.system.normalAttack` here took the sheet's
  // flat STR while `attackFacts` (which reads the projection) correctly
  // reported the band's `ignoresMagicResistance`, so the attack bypassed Magic
  // Resistance and then dealt the wrong number -- the two halves of one band
  // answered from two different places.
  const board = boardSnapshot();
  const projected = unitFrom(board, attacker) ?? unitSnapshot(attacker);
  // A mount that replaces its rider's Normal Attack supplies the whole spec,
  // and its sources name `unit: "mount"` — which stage 1 resolves through
  // `ctx.units`, populated beside this by `damageContext`.
  const { platform, attacksAsPlatform } = actionSourceFor(projected, board);
  return {
    sources: normalAttackAt(projected, range, {
      platform: attacksAsPlatform ? platform : null,
    }).sources,
  };
}

/**
 * Build the roll-option set the predicates evaluate against.
 * @param {object} attacker
 * @param {object} defender
 * @param {object} state
 * @returns {Set<string>}
 */
function rollOptions(attacker, defender, state, extra = {}) {
  // Built in the rules layer, where it can be tested without Foundry. It used
  // to be built here, which is why two whole clause families -- `skill:` and
  // `region:` -- went years without ever being emitted.
  return rollOptionsFor({
    attacker, defender, attack: { ...attackFacts(attacker, defender, state), ...extra },
  });
}

/**
 * Everything about THIS attack that a predicate may ask about.
 *
 * One builder, because there were four call sites and each spread a different
 * subset. Three of them rebuilt `attack` from scratch and dropped
 * `component`, `ignoresMagicResistance` and `pierce` on the way -- fields the
 * damage pipeline reads by name -- so Magic Resistance's own exemption clause
 * and every `Pierce` in the game were decided against a spec that never
 * carried them.
 *
 * @param {object} attacker attacker snapshot
 * @param {object} defender defender snapshot
 * @param {object} state the Combat Process state
 * @returns {object}
 */
export function attackFacts(attacker, defender, state) {
  const range = attackDistance(attacker, defender);
  const kind = state.attack?.kind ?? "normal";
  const facts = { ...(state.attack ?? {}), kind, isAoE: Boolean(state.isAoE), range };

  // A Normal Attack that changes shape with distance decides two of these
  // fields itself, and only here -- the declaration cannot, because the
  // distance is not known until there is a defender. EMIYA at Range 3 is a
  // combined STR/MAG shot that Magic Resistance does not see; at Range 2 the
  // same button is a plain STR attack.
  if (kind !== "normal") return facts;
  const source = actionSourceFor(attacker, currentBoard());
  const normal = normalAttackAt(attacker, range, {
    platform: source.attacksAsPlatform ? source.platform : null,
  });
  return {
    ...facts,
    component: normal.component,
    // The damage TYPE, from the same spec as the component. A Normal Attack has
    // no ability document, so this is the only place its element can come from
    // -- `facts.element` is what the two spec-building sites above fall through
    // to. Mesektet is *"All Normal Attacks ... Light damage"*, and without this
    // the pipeline's element stage returned at once and the type was lost.
    element: normal.element ?? facts.element ?? null,
    ignoresMagicResistance: facts.ignoresMagicResistance || normal.ignoresMagicResistance,
  };
}

/**
 * How many panels apart the two units are, or `null` when either has no panel.
 *
 * Chebyshev, which is what "at a Range of 3 or higher" counts: the attack-range
 * shape clips the outer ring's corners at R >= 3 (§8.2), but that is about
 * which panels are *reachable*, not about how far away the one you hit is.
 *
 * @param {object} attacker
 * @param {object} defender
 * @returns {number|null}
 */
function attackDistance(attacker, defender) {
  const from = attacker?.panel;
  const to = defender?.panel;
  if (!from || !to) return null;
  if (![from.i, from.j, to.i, to.j].every((n) => typeof n === "number")) return null;
  return chebyshev(from, to);
}

/**
 * @param {object} ability
 * @returns {string}
 */
/**
 * Which Base Attack an attack draws on.
 *
 * The ability may state it — Medea's Rule Breaker is a Caster's Noble Phantasm
 * that uses Base Attack (STR), and Scáthach's two Noble Phantasms use one each
 * — otherwise the Unit's own normal attack decides.
 *
 * @param {object} attacker the actor document
 * @param {object|null} ability
 * @returns {"str"|"mag"}
 */
function componentOf(attacker, ability, options = null) {
  const dmg = resolvedDamage(ability, options);
  const declared = dmg?.component ?? dmg?.base?.sources?.[0]?.component;
  return declared ?? attacker?.system?.normalAttack?.component ?? "str";
}

/**
 * The ability's `damage:` block, resolved for whichever behaviour is
 * actually firing.
 *
 * Summoning: Bašmu's `damage:` differs by branch the same way its
 * `cooldown:` and `targeting:` do (`cooldown.branches` in
 * `engine/cooldown.mjs`, `targeting.branches` in
 * `rules/ability-use.mjs#targetSpecFor`) -- its summon branch has a real
 * Combat Process (she resolves as her own defender, same as any self-cast
 * Spell) but deals no damage at all, and the Combat Process ladder always
 * runs the damage stage regardless of which phase is conceptually active.
 * `{fixed: true, base: {fixedValue: 0}}` is the existing "deals no damage"
 * vocabulary, selected per branch rather than invented per ability.
 *
 * Recomputed at every call site rather than resolved once and threaded
 * through, because the Combat Process is stateful across chat-message
 * advances (`advanceAttack` re-fetches the ability fresh each time) --
 * exactly how `ctx.attack.isFixedDamage` already works, extended to the rest
 * of the `damage:` block.
 *
 * @param {object|null} ability
 * @param {Set<string>|null} options the caster's own roll options
 * @returns {object|null}
 */
function resolvedDamage(ability, options) {
  const dmg = ability?.system?.damage ?? null;
  if (!dmg?.branches?.length || !options) return dmg;
  const match = dmg.branches.find((b) => testPredicate(b.predicate, { options }));
  return match ?? dmg;
}

/**
 * Does this ability deal no damage at all?
 *
 * An ability that declares **phases** and does not declare a `damage` one is
 * saying what it does, exhaustively. Asterios's *Chaos Labyrinthos* opens with
 * the word *"(Non-damaging)"*; EMIYA's *Unlimited Blade Works* creates a Reality
 * Marble whose toll is an interior event; Semiramis's *Hanging Gardens* is a
 * platform and her *Sikera Ušum* is an area of poison. None of them hits
 * anybody at the moment they are used.
 *
 * All five did. `classifyAbility` routes every Noble Phantasm through
 * `resolveAttack` deliberately -- a non-damaging NP still costs the Servant its
 * Attack -- and the Combat Process always runs its damage stage, where
 * `baseSpecFor` falls back to the caster's **Normal Attack** for an ability with
 * no `damage:` block. So opening the Labyrinth dealt Asterios's full BA(STR) 170
 * plus a crit roll to whichever Unit the fan-out picked. Measured live at 203.
 *
 * The alternative was five content files each carrying
 * `{fixed: true, base: {fixedValue: 0}}`, which is the same statement made five
 * times in a vocabulary that already contains it once, and a sixth author would
 * have had to know to write it.
 *
 * A `damage:` block still wins: Summoning: Bašmu's summon branch selects
 * `{fixed: true, fixedValue: 0}` explicitly, and an ability that declares a
 * damage BLOCK without a damage PHASE (Gáe Bolg Alternative, whose damage is
 * conditional on its Instakill missing) means it.
 *
 * @param {object|null} ability
 * @returns {boolean}
 */
function dealsNoDamage(ability) {
  if (!ability) return false;
  const sys = ability.system ?? {};
  if (sys.damage) return false;
  const phases = sys.phases ?? [];
  return phases.length > 0 && !phases.some((p) => p.kind === "damage");
}

function abilityKind(ability) {
  if (ability.type === "noblePhantasm" || ability.system?.isNP) return "np";
  if (ability.system?.isAttackSkill) return "attackSkill";
  if (ability.system?.isSpell) return "damageSpell";
  // A skill that is not an attack still resolves through this flow when it has
  // phases to run; the budget maps it to a move slot, not an attack slot.
  return classifyAbility(ability).isAttack ? "normal" : "skill";
}

/**
 * Map an ability kind onto the action the budget and the prevention table know.
 *
 * The distinction that matters is `damageSpell` → `spell`: `Seal` spares Spells
 * and `Silence` hits only them, so collapsing the two would make both effects
 * wrong in opposite directions.
 *
 * @param {string} kind
 * @returns {string}
 */
function budgetActionFor(kind) {
  // A non-attack skill draws from the MOVE pool (D18.2), so it must not fall
  // through to the attack default -- that would cost the Servant its attack.
  return { np: "np", damageSpell: "spell", attackSkill: "attack", normal: "attack", skill: "skill" }[kind]
    ?? "attack";
}

/** Re-exported so a macro can roll a raw chance without importing the rules layer. */
export { chance };

/**
 * A copied ability's source, by content id.
 *
 * Searched across every actor on the board rather than in the packs: a copy
 * points at the *instance* on the field, and the field is where a rank shift or
 * a suppression applied to that instance is visible.
 *
 * @param {string} contentId
 * @returns {object|null}
 */
function resolveAbilitySource(contentId) {
  for (const actor of game.actors ?? []) {
    const found = actor.items?.find(
      (i) => i.system?.contentId === contentId || i.id === contentId,
    );
    if (found) return found;
  }
  return null;
}

/**
 * Strip effects a Noble Phantasm removes.
 *
 * By **polarity** when a selector says so, because "removes all buffs" has to
 * cover buffs authored after the ability was written. Unremovable effects stay:
 * Appendix A marks a few that no cleanse reaches, and a blanket removal must
 * not be the exception that does.
 *
 * @param {object} phase
 * @param {object} doc the defender
 * @returns {object[]}
 */
async function removalIntents(phase, doc, bearer) {
  const named = (phase.effects ?? [phase.effect]).filter(Boolean).map((e) => e.id ?? e);
  const selector = phase.selector ?? null;

  const ids = named.length > 0
    ? named
    : doc.effects
      .filter((e) => {
        const def = EffectRegistry.get(e.system?.defId);
        if (!def) return false;
        if (selector?.polarity && def.polarity !== selector.polarity) return false;
        return !def.unremovable;
      })
      .map((e) => e.system.defId);

  // Buff removal has a resistance on the receiving end (`rules/removal.mjs`),
  // and this path is where an ATTACK dispels -- Medea's Rule Breaker *"removes
  // all buffs from the DU"*, straight into whatever `Buff Removal ResUp` the
  // defender is carrying. Rolled here, per definition id, because the rules
  // layer is pure.
  const candidates = doc.effects
    .filter((e) => ids.includes(e.system?.defId))
    .map((e) => {
      const def = EffectRegistry.get(e.system?.defId);
      return {
        defId: e.system.defId,
        polarity: def?.polarity,
        unremovable: Boolean(def?.unremovable ?? e.system?.unremovable),
      };
    });
  const ignoresProtection = Boolean(phase.ignoresRemovalProtection);

  /** @type {Record<string, number>} */
  const rolls = {};
  for (const defId of pendingRemovalRolls({ candidates, bearer, ignoresProtection })) {
    rolls[defId] = (await new Roll("1d100").evaluate()).total;
  }

  const plan = removalPlan({ candidates, bearer, rolls, ignoresProtection });
  return plan.removed.map((id) => I.removeEffect(doc.id, id, "ruleBreaker"));
}

/**
 * Cut a Servant's Contract and take its Master's Command Spells.
 *
 * Medea's Rule Breaker, and the only ability in the reference set that rewrites
 * the relationship graph as an attack rider. Two conditions from the sheet, and
 * both matter:
 *
 *   - **the DU must be a Servant.** A Master or a summon has no Contract to cut.
 *   - **it must have FAILED to Evade.** A successful Evade keeps the Contract,
 *     which is why this cannot be an unconditional phase after damage -- it has
 *     to read the ladder's outcome, and `state.evaded` is where that lives.
 *
 * The Contract and the spells move in ONE batch, for §16.2's reason: no
 * intermediate state where the Servant is Free and unclaimed may be observable.
 *
 * @param {object} phase
 * @param {object} state the Combat Process
 * @param {object} defenderDoc
 * @returns {Promise<object[]>}
 */
async function cutContract(phase, state, defenderDoc) {
  const requires = phase.requires ?? {};

  if (requires.targetKind && defenderDoc.type !== requires.targetKind) {
    return [{ summary: { id: "cutContract", name: "Rule Breaker", outcome: "blocked", reason: "notAServant" } }];
  }
  if (requires.evadeFailed && state.evaded) {
    // The Evade succeeded, so the Contract survives. Recorded rather than
    // silent: "why did Rule Breaker not steal it" is the first question asked.
    return [{ summary: { id: "cutContract", name: "Rule Breaker", outcome: "blocked", reason: "evaded" } }];
  }

  const oldMaster = defenderDoc.system?.masterId ? game.actors.get(defenderDoc.system.masterId) : null;
  const caster = game.actors.get(state.attackerId);
  const newMaster = caster?.type === "master" ? caster : game.actors.get(caster?.system?.masterId);

  if (!newMaster) {
    // A Free Medea has no Master to receive the Contract. The Servant is still
    // cut loose -- the NP destroyed the talisman either way.
    await applyBatch([I.markContract(defenderDoc.id, "free", null)], "np:cutContract");
    return [{ summary: { id: "cutContract", name: "Rule Breaker", outcome: "applied", reason: "freedOnly" } }];
  }

  const stripped = phase.stripMasterCommandSpells && oldMaster
    ? oldMaster.system?.commandSpells ?? 0
    : 0;

  await applyBatch([
    I.markContract(defenderDoc.id, "contracted", newMaster.id),
    // "removes the Master's Command Spells" -- all of them, not the three that
    // move. The three Medea receives are granted separately and are namespaced
    // to the Servant she just took (§16.9).
    ...(stripped > 0 ? [I.spendCS(oldMaster.id, stripped, "ruleBreaker", defenderDoc.id)] : []),
    I.grantCommandSpells(newMaster.id, defenderDoc.id, phase.grantToCaster?.commandSpells ?? 0),
    I.log({
      kind: "contract", event: "ruleBreaker",
      servantId: defenderDoc.id, fromMasterId: oldMaster?.id ?? null,
      toMasterId: newMaster.id, spellsStripped: stripped,
    }),
  ], "np:cutContract");

  return [{ summary: { id: "cutContract", name: "Rule Breaker", outcome: "applied", reason: null } }];
}

/**
 * The attacker's snapshot with any window ability's rules folded in.
 *
 * *"STR Damage dealt by **that Attack** is increased by 100%"* — by that
 * attack, so the contribution belongs to this one damage computation and to
 * nothing else. An effect applied to Asterios would be the wrong shape twice
 * over: it would survive into his next attack, and it would be strippable by
 * buff removal, which the sheet does not say.
 *
 * The ability is collected with `active: true` because that is what using it
 * means. Monstrous Strength shipped as `activeRules` on an ability with no
 * `isMode`, and `collectContributions` reads `activeRules` only while
 * `ability.active` is true — a flag nothing could ever set on it. The rules were
 * authored, compiled, loaded, and unreachable.
 *
 * Folded in **before** the option set and the crit plan are built, so a window
 * ability that changes the crit chance is counted by the coin it is supposed to
 * change rather than after it.
 *
 * @param {object} attacker the board snapshot
 * @param {object} attackerDoc
 * @param {object} state
 * @returns {object}
 */
function windowAugmented(attacker, attackerDoc, state) {
  const ids = state.windowAbilities ?? [];
  if (ids.length === 0) return attacker;

  const abilities = ids
    .map((id) => attackerDoc.items.get(id))
    .filter(Boolean)
    .map((item) => ({
      id: item.id,
      name: item.name,
      slug: item.system?.slug ?? item.id,
      rank: item.system?.rank ?? null,
      active: true,
      rules: item.system?.rules ?? [],
      passiveRules: [],
      activeRules: item.system?.activeRules ?? [],
    }));
  if (abilities.length === 0) return attacker;

  const extra = collectContributions(abilities, {
    options: rollOptionsFor({ attacker, defender: null }),
    refs: { self: attackerDoc },
  });

  return {
    ...attacker,
    modifiers: [...(attacker.modifiers ?? []), ...extra.modifiers],
    checkModifiers: [...(attacker.checkModifiers ?? []), ...extra.checkModifiers],
  };
}

/**
 * Offer the **attacker** its own abilities at a timing window inside its attack.
 *
 * The mirror of the reaction rung, and it did not exist. Every window in
 * `rules/reactions.mjs` describes a moment inside somebody else's Combat
 * Process; an ability whose text places it inside *your own* — Asterios's
 * *Monstrous Strength*, Karna's *Uncrowned Arms Mastership* — had no moment at
 * which it could be reached, so both shipped inert.
 *
 * Asked **inline** rather than through the Combat Process's own prompt table,
 * and the distinction is deliberate. `PROMPTS` exists because the reaction
 * ladder is answered by the *other* client and has to survive being serialized
 * into a chat flag between rungs (Ch. 27). This question is answered by the
 * player who is already driving this resolution, so a round trip through a card
 * would add a rung and a re-entry to ask somebody something they are looking at.
 * `FGTSocket.ask` still routes it to the ability's actual owner, because the
 * arbiter running this is the GM and the choice is not theirs.
 *
 * Declining is a real answer: these cost a cooldown, and a player may rationally
 * keep it. Nothing is spent unless something is picked.
 *
 * @param {object} state the Combat Process state
 * @param {string} window
 * @param {object} message the process's chat message
 * @returns {Promise<object>} the state, with `windowAbilities` recorded
 */
async function offerAttackerWindow(state, window, message) {
  // Asked once per Process. Re-entry after a Command Spell interrupt would
  // otherwise offer the same cooldown twice for one attack.
  if (state.windowAbilities !== undefined) return state;

  const actor = game.actors.get(state.attackerId);
  if (!actor) return { ...state, windowAbilities: [] };

  const offers = abilitiesAtWindow({
    items: actor.items,
    effects: actor.effects.map((e) => e.system?.defId).filter(Boolean),
    turnState: actor.system?.turnState ?? {},
    roundState: actor.system?.roundState ?? {},
  }, window);
  if (offers.length === 0) return { ...state, windowAbilities: [] };

  const picked = await askOwner(actor, {
    kind: "choose",
    title: game.i18n.localize(`FGT.Window.${window}`),
    hint: game.i18n.format("FGT.Window.Hint", { name: actor.name }),
    // `min: 0` -- keeping the cooldown is a legitimate play, and a dialog that
    // forces a pick would make "at the start of a Damage Step" mandatory.
    min: 0,
    count: offers.length,
    options: offers.map((a) => ({
      id: a.id,
      name: a.name,
      detail: a.system?.description ?? "",
    })),
  });

  const chosen = (picked ?? []).filter((id) => offers.some((a) => a.id === id));
  if (chosen.length === 0) return { ...state, windowAbilities: [] };

  // Paid for at the moment it is taken. `cooldownFor` is the same planner both
  // use paths run through, so a window use and a sheet click cannot disagree
  // about what the ability costs -- the disagreement `engine/cooldown.mjs` was
  // written to end.
  //
  // What "using it" MEANS depends on what the ability is, and the two in the
  // reference set are the two answers. Monstrous Strength contributes rules to
  // the attack in progress (`windowAugmented`); Uncrowned Arms Mastership is a
  // MODE, and using it is the switch itself -- *"switch the effect of this Skill
  // from 1 to 2, or 2 to 1"*. Folding a mode's rules into one attack would apply
  // the state it is leaving rather than the one it is entering.
  const intents = chosen.flatMap((id) => {
    const item = actor.items.get(id);
    const plan = cooldownFor(item, actor.id, { unit: unitSnapshot(actor) });
    const toggles = classifyAbility(item).toggles;
    return [
      ...plan.cooldowns.map((c) => I.cooldown(c.actorId, c.abilityId, c.ticks, "set")),
      ...(toggles
        ? [I.setMode(actor.id, item.system?.slug ?? id, !item.system?.active, `window:${window}`)]
        : []),
      I.recordUse(actor.id, id, item?.system?.contentId ?? null),
      I.log({
        kind: "ability", event: "windowUsed", window,
        unitId: actor.id, abilityId: id, name: item?.name ?? id,
      }),
    ];
  });
  await applyBatch(intents, `window:${window}`);

  // A mode's switch is its whole effect, so it is not carried forward as a
  // contribution: `contributionsOf` will read the new state off the document on
  // the next snapshot, which is every snapshot after this batch.
  const carried = chosen.filter((id) => !classifyAbility(actor.items.get(id)).toggles);

  await ChatMessage.create({
    content: `<p><strong>${publicIdentityOf(actor, currentBoard()).name}</strong> uses `
      + `${chosen.map((id) => actor.items.get(id)?.name ?? id).join(", ")}.</p>`,
    speaker: publicSpeakerFor(actor),
  });

  void message;
  return { ...state, windowAbilities: carried };
}

/**
 * Ask the player who owns this actor, or answer it here when nobody does.
 *
 * A GM-run resolution must not put a Servant's decision in the GM's hands when
 * the Servant belongs to somebody: `FGTSocket.ask` is the primitive for exactly
 * that, and it short-circuits to a local dialog when the owner *is* this client.
 * An unowned actor (a summon, an NPC) falls back to whoever is arbitrating.
 *
 * A timeout or a disconnected owner resolves to **null**, which every caller
 * reads as "declined" — the attack must not stall because somebody walked away.
 *
 * @param {object} actor
 * @param {object} spec a prompt spec (`module/apps/prompt.mjs`)
 * @returns {Promise<unknown>}
 */
async function askOwner(actor, spec) {
  const owner = game.users.find((u) => u.active && !u.isGM && actor.testUserPermission(u, "OWNER"))
    ?? game.user;
  try {
    const { FGTSocket } = await import("../net/socket.mjs");
    return await FGTSocket.ask(owner.id, spec);
  } catch (err) {
    console.warn(`FGT | ${actor.name}'s window prompt was not answered:`, err);
    return null;
  }
}

/**
 * The reaction abilities a defender may answer with (§15.3).
 *
 * Reduced to what a card needs -- an id and a name -- rather than carrying the
 * documents: the state is serialized into a chat flag and crosses the socket,
 * and an Item document does not survive that trip.
 *
 * @param {string} defenderId
 * @returns {Array<{id: string, name: string}>}
 */
function offeredReactions(defenderId, attack = null, isAoE = false) {
  const actor = game.actors.get(defenderId);
  if (!actor) return [];

  // Pale Rider and the Kagome Spirits: *"cannot Evade, Block, or Counter."*
  // The rung still happens -- Ch. 27's ladder prompts the defender either way
  // -- and the only option on it is nothing. Refused here rather than by
  // giving them no reaction abilities, because an ALLY's Rho Aias is offered
  // at this same rung and is equally unavailable to them.
  if (hasGranted(unitSnapshot(actor), GRANTS.noReactions)) return [];

  const own = reactionAbilities({
    items: actor.items,
    effects: actor.effects.map((e) => e.system?.defId).filter(Boolean),
    turnState: actor.system?.turnState ?? {},
  }).map((a) => ({ id: a.id, name: a.name, ownerId: defenderId }));

  // Plus anything a nearby ALLY could interpose. EMIYA's Rho Aias is the only
  // one, and it is the only ability in the game whose user is neither the
  // attacker nor the defender.
  //
  // Offered at the defender's rung because Ch. 27's ladder prompts one side per
  // rung; the option is labelled with the projector's name so whoever answers
  // knows whose Health it is about to cost.
  const board = boardSnapshot();
  const ally = allyReactions({
    defender: board.units.find((u) => u.id === defenderId) ?? unitSnapshot(actor),
    board,
    // `isAoE` lives on the Process rather than on the attack spec, and
    // Akhilleus Kosmos gates on it, so it is folded in here where both are in
    // scope.
    attack: { ...(attack ?? {}), isAoE: Boolean(isAoE) },
    actorFor: (id) => game.actors.get(id),
  }).map((a) => ({
    id: a.ability.id,
    name: `${a.ability.name} (${a.ownerName})`,
    ownerId: a.ownerId,
  }));

  return [...own, ...ally];
}

/**
 * An automatic Evade granted by an effect the defender is now carrying.
 *
 * Medea's Trofa: *"Automatically Evades the Attack. If the Attack was a Noble
 * Phantasm, Medea has a 50% chance of automatically Evading it. If Failed, the
 * Combat Process proceeds as normal."*
 *
 * The NP case is a **roll**, not a refusal, which is why `chance` exists at all
 * — and a failed roll must leave the ladder able to continue, so it reports a
 * failed Evade rather than declining to have happened.
 *
 * @param {object} state
 * @param {object|null} defender
 * @returns {{applies: boolean, success?: boolean, outcome?: object}}
 */
function autoEvadeFrom(state, defender) {
  if (!defender) return { applies: false };

  // Same reason as `rollEvade`: an auto-evasion granted by an aura or by a
  // field's interior rules is invisible to a bare projection.
  const plan = checkPlan(unitFrom(currentBoard(), defender), "evade");
  const auto = plan.autoSucceed;
  if (!auto) return { applies: false };

  // An attack that narrows the ladder narrows this rung too. A Fragarach
  // Counter *"cannot be Evaded except with Dodge"*, and an automatic evasion
  // granted by anything else -- the `Evade` buff, Medea's Trofa -- is exactly
  // what the clause is refusing. Without this the shortcut would let through
  // what the roll itself would have failed, which is the worst kind of bug: it
  // fires only when the defender happens to be buffed.
  const permit = evadePermit(state);
  if (permit && !permit.some((id) => (unitSnapshot(defender).effects ?? []).includes(id))) {
    return { applies: false };
  }

  const attackProperties = [];
  if (state.attack?.aim) attackProperties.push("aim");
  if (state.attack?.kind === "np") attackProperties.push("np");
  if ((auto.beatenBy ?? []).some((p) => attackProperties.includes(p))) return { applies: false };

  // A per-property chance: certain against anything ordinary, a coin against a
  // Noble Phantasm.
  const chance = chanceFor(auto, attackProperties);
  const success = chance >= 100 || (Math.random() * 100) < chance;

  return {
    applies: true,
    success,
    // Which effect this came from, so the caller can spend a charge of it.
    // `AutoSucceed` records the count on the effect INSTANCE, and the plan
    // carries the defId through -- without it the caller would have to guess
    // which of the defender's effects had just fired.
    consumes: auto.uses ? (auto.defId ?? null) : null,
    outcome: {
      success, automatic: true, roll: null, total: 0,
      table: null, modifiers: [{ source: auto.source ?? "automatic evasion", value: 0 }],
      chance,
    },
  };
}

/**
 * The chance an automatic success actually fires, given the attack.
 * @param {object} auto
 * @param {string[]} attackProperties
 * @returns {number}
 */
function chanceFor(auto, attackProperties) {
  for (const entry of auto.chanceWhen ?? []) {
    const wanted = [entry.predicate ?? []].flat();
    if (wanted.some((p) => attackProperties.includes(String(p).replace("attack:kind:", "")))) {
      return entry.chance ?? 100;
    }
  }
  return auto.chance ?? 100;
}

/* -------------------------------------------------------------------------- */
/*  Pre-emption — attacking first, instead of the Unit attacking you           */
/* -------------------------------------------------------------------------- */

/**
 * Offer any defender who may swing first the chance to do so.
 *
 * Jack the Ripper's *Murderer of the Misty Night* is the only clause in the
 * corpus that does this, and it is **not** a Counter. A Counter happens at the
 * end of the Process it answers (§12.8's `counter` rung), after the damage has
 * already landed; this happens *instead*, before the attacker's Process exists
 * at all. So it cannot reuse `beginCounter`: a counter cannot be countered and
 * ends the counterer's concealment on different terms, and neither is true of
 * an attack that is simply early.
 *
 * The original declaration is not discarded — it is **deferred onto the
 * pre-emptive Process**. When that Process completes, `resumeDeferredAttack`
 * re-enters `resolveAttack` with `resume: true`, which re-resolves targeting
 * (so a defender who died drops out) while skipping the budget, the costs and
 * the cooldown, all of which were already paid at the first declaration. If the
 * pre-empter killed the attacker, the deferred attack never happens: that is
 * what "instead of" buys, and it falls out of re-resolving rather than needing
 * a special case of its own.
 *
 * Only ONE pre-emption per declaration. A Noble Phantasm over seven Units that
 * caught two pre-empters would otherwise open two exchanges the sheet never
 * describes, and there is no stated order between them.
 *
 * @param {object} args
 * @returns {Promise<{messageId: string}|null>}
 */
async function offerPreemption({ attackerId, abilityId, placement, targetIds, board, self }) {
  const attackerDoc = game.actors.get(attackerId);
  if (!attackerDoc) return null;

  for (const defenderId of new Set(targetIds)) {
    if (defenderId === attackerId) continue;
    const defenderDoc = game.actors.get(defenderId);
    const defender = defenderDoc ? unitFrom(board, defenderDoc) : null;
    const rule = (defender?.preemptions ?? [])[0];
    if (!rule) continue;

    // "…and the AU is within JACK'S Range." The pre-empter's range, not the
    // attacker's: she is the one about to swing, so a sniper hitting her from
    // outside her own reach is exactly the case the clause does not cover.
    if (rule.withinOwnRange) {
      // `range` on a BOARD unit is the resolved number of panels, not the
      // `{panels, targets}` shape the document carries -- `rules/snapshot.mjs`
      // flattens it. Reading `.panels` here gave `undefined`, which fell to a
      // reach of 0, which refused every pre-emption at every distance. Both
      // shapes are accepted rather than assuming the caller's.
      const reach = typeof defender.range === "number"
        ? defender.range
        : (defender.range?.panels ?? 0);
      if (chebyshev(defender.panel, self.panel) > reach) continue;
    }

    const picked = await askOwner(defenderDoc, {
      kind: "choose",
      title: game.i18n.localize("FGT.Preempt.Title"),
      hint: game.i18n.format("FGT.Preempt.Hint", {
        name: defenderDoc.name, attacker: attackerDoc.name, source: rule.source,
      }),
      min: 0,
      count: 1,
      options: [{ id: "preempt", name: game.i18n.localize("FGT.Preempt.Take"), detail: rule.source }],
    });
    if (!(picked ?? []).includes("preempt")) continue;

    // "If it is a Day Round, the activation of this effect requires a
    // Successful Luck Check. Luck Check is not required during Night Rounds."
    // The Round phase is a COST modifier here rather than a damage one: the
    // same clause costs a point of Luck and a die by day, and nothing at night.
    //
    // `board.phase` and deliberately NOT `phaseAt` (§42.6): the sentence names
    // a "Day ROUND", which a 5x5 pocket of Quetzalcoatl's daylight does not
    // change. The two positional readers -- the Dark modifiers and the item
    // phase requirement -- were repointed; this one is about the clock.
    if ((rule.requiresLuckCheckIn ?? []).includes(board.phase)) {
      const ok = await preemptionLuckCheck(defenderDoc, attackerId);
      if (!ok) continue;
    }

    return runPreemption({ preempterId: defenderId, attackerId, abilityId, placement, targetIds });
  }
  return null;
}

/**
 * The Luck Check a Day Round charges for a pre-emption.
 *
 * Uncontested: the clause asks whether Jack got the drop on somebody, not
 * whether she is luckier than they are. Costs 1 Luck whether or not it
 * succeeds, like every other Luck Check.
 *
 * @param {object} defenderDoc
 * @param {string} attackerId
 * @returns {Promise<boolean>}
 */
async function preemptionLuckCheck(defenderDoc, attackerId) {
  const unit = unitFrom(currentBoard(), defenderDoc);
  const roll = await new Roll("1d20").evaluate();
  const plan = checkPlan(unit, "luck");
  const outcome = luckCheck({
    roll: roll.total,
    luck: unit.luck,
    hasBoost: (unit.effects ?? []).includes("luckBoost") || plan.forceTable === "favourable",
    hasLoss: (unit.effects ?? []).includes("luckLoss") || plan.forceTable === "unfavourable",
    modifiers: plan.modifiers,
  });
  await applyBatch([
    I.statDelta(defenderDoc.id, "luck.value", -1),
    I.log({
      kind: "check", event: "preemptLuck", unitId: defenderDoc.id,
      against: attackerId, success: outcome.success, roll: roll.total,
    }),
  ], "preempt:luck");
  return outcome.success;
}

/**
 * Open the pre-empter's own Combat Process, carrying the deferred attack.
 *
 * @param {object} args
 * @returns {Promise<{messageId: string}|null>}
 */
async function runPreemption({ preempterId, attackerId, abilityId, placement, targetIds }) {
  const preempter = game.actors.get(preempterId);
  const target = game.actors.get(attackerId);
  if (!preempter || !target) return null;

  // A NORMAL Attack. The clause says "Attack", and a Servant's Attack with no
  // ability named is its Normal Attack everywhere else in this engine.
  const state = process.advance(
    process.begin({
      attackerId: preempterId,
      defenderId: attackerId,
      attack: {
        abilityId: null,
        kind: "normal",
        component: componentOf(preempter, null, rollOptionsFor({ attacker: unitSnapshot(preempter) })),
      },
      isAoE: false,
      isPreemption: true,
    }),
    "done",
  );

  const message = await renderAttackCard({
    state, attacker: preempter, ability: null, targets: [{ unitId: attackerId }],
  });
  await message.setFlag("fgt", "process", process.serialize(state));
  await message.setFlag("fgt", "collapse", process.laddersCollapse(unitSnapshot(target)));
  // The other half of the exchange, parked until this one finishes.
  await message.setFlag("fgt", "deferredAttack", {
    attackerId, abilityId, placement: placement ?? null, targetIds,
  });
  return { messageId: message.id };
}

/**
 * Re-enter the attack a pre-emption interrupted, if its attacker still lives.
 *
 * Called from the Process completion point, so *"Jack killed him and his attack
 * never happened"* needs no special case: a defeated attacker cannot
 * re-declare, and a target the pre-emption killed drops out of the re-resolved
 * targeting on its own.
 *
 * @param {object} state
 * @param {object} message
 * @returns {Promise<void>}
 */
async function resumeDeferredAttack(state, message) {
  const deferred = message.getFlag("fgt", "deferredAttack");
  if (!deferred) return;
  // Cleared FIRST. A Process re-read after a Command Spell interrupt can reach
  // this point twice, and the second pass would launch the deferred attack a
  // second time.
  await message.unsetFlag("fgt", "deferredAttack");

  const attacker = game.actors.get(deferred.attackerId);
  if (!attacker) return;
  if (attacker.system?.defeated?.at || currentHealth(unitSnapshot(attacker)) <= 0) {
    await applyBatch([I.log({
      kind: "attack", event: "preemptCancelled", unitId: deferred.attackerId,
      by: state.attackerId,
    })], "preempt:cancelled");
    return;
  }

  try {
    await resolveAttack({ ...deferred, resume: true });
  } catch (err) {
    // Loud, not silent: the deferred half failing leaves a half-resolved
    // exchange, and the players need to know which half is missing.
    console.error("FGT | The attack a pre-emption deferred could not resume:", err);
    ui.notifications?.warn(game.i18n.localize("FGT.Preempt.ResumeFailed"));
  }
}

/* -------------------------------------------------------------------------- */
/*  Cancelling a Noble Phantasm (Ch. 33 §33.4)                                */
/* -------------------------------------------------------------------------- */

/**
 * Offer every defender who can cancel this Noble Phantasm the chance to do so.
 *
 * > *"Can only be used by removing 5 Fragarach Tokens from herself. Can be used
 * > when a Noble Phantasm is used against Mannanán. Cannot be used against
 * > (Passive) or (Non-damaging) Noble Phantasms. ... Both versions of this NP
 * > are effective at any Range. Fragarach cannot be responded to (Block, Evade,
 * > Luck Check, Counter, etc)."*
 *
 * This is the hardest single ability in the reference set (§33.4) and four
 * things make it so. Three are handled here:
 *
 *   1. **It interrupts another resolution.** Only Command Spells otherwise do
 *      (§17.1), so the offer sits exactly where `offerPreemption` sits: after
 *      the attacker has paid, before any Combat Process exists. The attacker
 *      still spent the Noble Phantasm; nothing is refunded, which is what
 *      "cancelled" means and what makes walking into her expensive.
 *   2. **It compares abilities.** `rules/np-strength.mjs` ranks the attacker's
 *      damaging Noble Phantasms against a synthetic neutral defender.
 *   3. **It cannot be responded to.** There is no ladder at all — no Combat
 *      Process is opened for the reflection, so there is nothing to Block,
 *      Evade or contest.
 *
 * The fourth, the counterfactual damage, is free: the pipeline is pure, so
 * "what would it have dealt" is the same call with the dice pinned.
 *
 * **One canceller.** A Noble Phantasm over seven Units that caught two of them
 * would otherwise open two cancellations the sheet never describes, with no
 * stated order between them — the same argument `offerPreemption` makes.
 *
 * @param {object} args
 * @returns {Promise<{cancelledBy: string, messageId: string|null}|null>}
 */
async function offerNPCancellation({ attackerId, attacker, ability, targetIds, board, self, options }) {
  for (const defenderId of new Set(targetIds)) {
    if (defenderId === attackerId) continue;
    const defenderDoc = game.actors.get(defenderId);
    if (!defenderDoc) continue;

    const defender = unitFrom(board, defenderDoc) ?? unitSnapshot(defenderDoc);
    // Everything that would refuse it is checked BEFORE it is offered (§17.6):
    // the window, the cooldown, the tokens, the Turn record.
    const held = [...(defenderDoc.effects ?? [])].map((e) => e.system?.defId).filter(Boolean);
    const usable = abilitiesAtWindow(
      { items: defenderDoc.items, turnState: defenderDoc.system?.turnState ?? {}, effects: held },
      "whenTargetedByNP",
    ).filter((item) => {
      if (!item.system?.cancelsNP) return false;
      const usage = canUseAbility({
        ability: abilityUsageSpec(item),
        unit: defender,
        master: defender.masterId ? unitFrom(board, game.actors.get(defender.masterId)) : null,
        round: game.combats.active?.round ?? 1,
        board,
        target: self,
      });
      return usage.ok;
    });
    if (usable.length === 0) continue;

    const item = usable[0];
    const picked = await askOwner(defenderDoc, {
      kind: "choose",
      title: item.name,
      hint: game.i18n.format("FGT.CancelNP.Hint", {
        name: defenderDoc.name, attacker: attacker.name, np: ability.name,
      }),
      min: 0,
      count: 1,
      options: [{ id: "cancel", name: game.i18n.localize("FGT.CancelNP.Take"), detail: item.name }],
    });
    if (!(picked ?? []).includes("cancel")) continue;

    return resolveNPCancellation({
      cancellerDoc: defenderDoc, canceller: defender, cancelling: item,
      attackerId, attacker, ability, board, options,
    });
  }
  return null;
}

/**
 * Cancel the Noble Phantasm, and pay both prices.
 *
 * @param {object} args
 * @returns {Promise<{cancelledBy: string, messageId: string|null}>}
 */
async function resolveNPCancellation({
  cancellerDoc, canceller, cancelling, attackerId, attacker, ability, board, options,
}) {
  // The canceller's own price — its five tokens, its 8◈, its use record. Paid
  // through the same path a declaration pays, because it is one.
  // The Master, resolved ONCE and passed to both. `canUseAbility` prices a
  // Noble Phantasm against whoever is paying for it, and handing it `null`
  // while `payAbilityPrice` was given the real Master produced a cost with no
  // `unitId` -- an intent the applier refuses, which took the whole
  // cancellation down with it.
  const cancellerMaster = canceller.masterId
    ? unitFrom(board, game.actors.get(canceller.masterId))
    : null;

  await payAbilityPrice({
    ability: cancelling,
    attackerId: cancellerDoc.id,
    attacker: cancellerDoc,
    self: canceller,
    master: cancellerMaster,
    usage: canUseAbility({
      ability: abilityUsageSpec(cancelling), unit: canceller, master: cancellerMaster,
      round: game.combats.active?.round ?? 1, board,
      target: unitFrom(board, attacker) ?? unitSnapshot(attacker),
    }),
    board,
    resume: false,
  });
  // ...and everything the ability does to its USER. `payAbilityPrice` charges
  // the cooldown and the use record; the five Fragarach Tokens are a `resource`
  // phase, and the only other path that runs those is `declareProcesses` --
  // which this resolution deliberately never reaches, because the whole point
  // is that no Combat Process happens.
  {
    const { runCasterPhases } = await import("./skill-use.mjs");
    await runCasterPhases(cancelling, cancellerDoc, board);
  }

  const spec = cancelling.system.cancelsNP ?? {};
  const attackerUnit = unitFrom(board, attacker) ?? unitSnapshot(attacker);
  const { strongest, ranked } = isStrongestNP([...attacker.items], attackerUnit, ability.id);

  /** @type {object[]} */
  const intents = [I.log({
    kind: "npCancelled", unitId: attackerId, by: cancellerDoc.id,
    ability: ability.name, source: cancelling.name, strongest,
  })];
  let outcome = "";

  if (strongest && spec.againstStrongest?.effect) {
    // "The NP is canceled and the Servant/Unit who used the NP is inflicted
    // with Instakill." Through the effect applier, so the target's own Magic
    // Resistance Instakill ladder still gets its say — and note that this
    // source deals no STR damage at all, which is exactly the case that ladder
    // is written to cover.
    const def = EffectRegistry.get(spec.againstStrongest.effect);
    if (def) {
      const roll = await new Roll("1d100").evaluate();
      const applied = applyEffect({
        def,
        target: attackerUnit,
        chance: spec.againstStrongest.chance ?? null,
        duration: null,
        source: { unitId: cancellerDoc.id, abilityId: cancelling.id },
        ctx: {
          turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
          currentTick: game.combat?.system?.globalTurn ?? 0,
          roll: roll.total,
          inflictBonus: inflictBonusOf(canceller, def),
          options: rollOptionsFor({ attacker: canceller, defender: attackerUnit }),
        },
      });
      intents.push(...applied.intents);
      outcome = game.i18n.format("FGT.CancelNP.Instakill", { name: attacker.name, effect: def.name });
    }
  } else if (spec.otherwise?.reflect) {
    // "The equivalent amount of damage that NP would have dealt is dealt to the
    // NP's user instead (only affects the user if it was an AoE NP)."
    //
    // Against the CANCELLER for a single-target Noble Phantasm — "the damage
    // that NP would have dealt" is the damage it would have dealt to her — and
    // against the USER for an AoE one, which is the distinction the
    // parenthesis is drawing: an area Noble Phantasm has several would-be
    // victims and only its user is reflected onto.
    const aoe = Boolean(ability.system?.targeting?.isDamagingAoE || ability.system?.damage?.isAoE);
    const amount = counterfactualDamage({
      attackerDoc: attacker, ability, board, options,
      defenderUnit: aoe ? attackerUnit : canceller,
    });
    if (amount > 0) intents.push(I.damage(attackerId, amount, cancellerDoc.id, { reflected: true }));
    outcome = game.i18n.format("FGT.CancelNP.Reflected", { name: attacker.name, amount });
  }

  await applyBatch(intents, "npCancelled");

  // The user's Health may now be empty, and nothing else is going to notice: no
  // Combat Process was opened, so no damage step runs the defeat chain.
  await resolveEmptiedUnit(attackerId);

  const message = await ChatMessage.create({
    content: `<p><strong>${cancelling.name}</strong> — ${cancellerDoc.name} cancels `
      + `<em>${ability.name}</em>.</p><p>${outcome}</p>`
      + `<p>${ranked.length} damaging Noble Phantasm(s) ranked; `
      + `${strongest ? "this was the strongest" : "this was not the strongest"}.</p>`,
    speaker: publicSpeakerFor(cancellerDoc),
  });
  return { cancelledBy: cancellerDoc.id, messageId: message?.id ?? null };
}

/**
 * What an ability WOULD have dealt, with every die at its expected value.
 *
 * The pipeline is pure and takes its randomness through `ctx.rolls`, so this is
 * the same computation the resolution would have made rather than an
 * approximation of it. Pinning `5d10` to its expected 27.5 instead of rolling
 * is what makes two clients agree about a number nobody rolled.
 *
 * @param {object} args
 * @returns {number}
 */
function counterfactualDamage({ attackerDoc, ability, board, options, defenderUnit }) {
  const attackerUnit = unitFrom(board, attackerDoc) ?? unitSnapshot(attackerDoc);
  const range = attackDistance(attackerUnit, defenderUnit);
  const damage = resolvedDamage(ability, options);

  return computeDamage({
    attacker: attackerUnit,
    defender: defenderUnit,
    board,
    attack: {
      kind: "np",
      abilityId: ability.id,
      rank: Rank.parseOrNull(ability.system?.rank),
      component: componentOf(attackerDoc, ability, options),
      categorizedAsNP: Boolean(ability.system?.categorizedAsNP),
      element: damage?.element ?? ability.system?.element ?? null,
      // See the note at the first spec-building site.
      elementFraction: damage?.elementFraction ?? undefined,
      ignoresMagicResistance: Boolean(damage?.ignoresMagicResistance),
      pierce: Boolean(damage?.pierce),
      aim: Boolean(damage?.aim),
      isFixedDamage: Boolean(damage?.fixed),
      range,
      npTags: [...(ability.system?.npTags ?? [])],
    },
    base: baseSpecFor(attackerDoc, ability, range, options),
    multiplier: damage?.multiplier ?? 1,
    flatBonus: damage?.flatBonus ?? 0,
    conditionalMultipliers: damage?.conditionalMultipliers ?? [],
    // No crit. The coin was never flipped — the resolution did not happen — and
    // assuming one would hand the reflection a bonus the sheet does not mention.
    crit: { isCrit: false, chanceUsed: 0 },
    // Which rolls this table plays with (Ch. 19). Threaded into ctx the way
    // `grandOrder` is, because a pure pipeline stage may not read a setting.
    difficulty: board?.difficulty,
    reaction: { kind: "none" },
    totalDamageModifiers: [],
    luckChecks: {},
    rolls: { attackMinus: EXPECTED_ATTACK_ROLL, negation: [] },
    options: rollOptionsFor({ attacker: attackerUnit, defender: defenderUnit, attack: { kind: "np", range } }),
  }).total;
}

/**
 * Run the defeat chain for a Unit whose Health was emptied outside a Process.
 *
 * A cancelled Noble Phantasm opens none, so nothing else would notice that its
 * user is now at zero — the reflection and the Instakill would each leave a
 * corpse standing.
 *
 * @param {string} unitId
 * @returns {Promise<void>}
 */
async function resolveEmptiedUnit(unitId) {
  const doc = game.actors.get(unitId);
  if (!doc) return;
  const unit = unitFrom(boardSnapshot(), doc) ?? unitSnapshot(doc);
  if (currentHealth(unit) > 0) return;

  const intents = await resolveDefeatOf(unit, 0, {});
  if (intents.length > 0) await applyBatch(intents, "npCancelled:defeat");
}
