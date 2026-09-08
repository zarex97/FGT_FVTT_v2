/**
 * @file Abilities usable "when Attacked".
 * @see docs/15-abilities.md §15.3, docs/27-reaction-protocol.md §27.2
 *
 * Layer 2 (rules). Pure.
 *
 * Medea has the two that made this necessary. *Argos* is *"used during your
 * Turn **or when Attacked**"*, and *Trofa* is *"used **when Attacked**"* and
 * automatically Evades. Neither can be reached from the Skill button on the
 * sheet, because the moment they matter their owner is standing inside somebody
 * else's Combat Process — so they have to be offered **at the reaction rung**,
 * beside Block and Evade.
 *
 * Everything that would refuse the ability is checked *before* it is offered,
 * for §17.6's reason: an option that refuses when pressed teaches nothing that
 * a missing option does not teach faster.
 */

import { blockedThisTurn, isNegated } from "./ability-use.mjs";
import { meetsRequirements } from "./items.mjs";
import { chebyshev } from "../domain/geometry.mjs";
import { Rank } from "../domain/rank.mjs";
import { relationOf } from "./relations.mjs";

/** The window an ability must name to be offered as a reaction. */
const REACTION_WINDOW = "whenAttacked";

/**
 * The windows the **attacker's own** abilities may name.
 *
 * The mirror of `whenAttacked`, and it had no implementation at all: every
 * window in this file describes a moment inside somebody *else's* Combat
 * Process, so an ability used at a moment inside *your own* had nowhere to be
 * offered. Two in the reference set, and both were inert:
 *
 *   - Asterios's *Monstrous Strength* — *"used at the start of a **Damage Step**
 *     when performing an Attack"*. It shipped as `activeRules` on an ability
 *     that is not a mode, and `collectContributions` only reads `activeRules`
 *     while `ability.active` is true, so its +100% STR damage could never be
 *     switched on by anything. The Damage Step is the right moment rather than
 *     declaration: with a 3◈ cooldown, spending it on an attack that is then
 *     evaded is the difference the sheet's wording is drawing.
 *   - Karna's *Uncrowned Arms Mastership* — *"used during your Turn **or at the
 *     start of a Combat Phase**"*.
 */
export const ATTACKER_WINDOWS = Object.freeze(["damageStep", "combatPhaseStart"]);

/**
 * The window for an ability somebody ELSE's peril triggers.
 *
 * EMIYA's *Rho Aias* is the only one in the reference set: *"used when any
 * allied Unit (including EMIYA) within a 3 panel area of EMIYA is about to be
 * hit by a Noble Phantasm."* The Unit that may act is neither the attacker nor
 * the defender, which no other ability in the game is true of.
 */
const ALLY_WINDOW = "whenAllyAttacked";

/**
 * Requirements answerable from the bearer alone.
 *
 * A window offer has no target and no attack, so a gate that needs one cannot
 * be judged here and must not refuse for lack of it — the offer would then be
 * silently missing rather than honestly refused.
 *
 * @type {ReadonlySet<string>}
 */
const SELF_REQUIREMENTS = new Set([
  "stance", "modeActive", "modeInactive", "notHasEffect", "hasSkill",
  "healthAbove", "healthBelow", "resourceAtLeast", "itemAtLeast",
  "roundAtLeast", "roundPhase", "inZon", "healthRestoredSince",
]);

/**
 * The abilities this unit could use in response to being attacked.
 *
 * @param {object} unit an actor-shaped object with `items`
 * @returns {object[]}
 */
export function reactionAbilities(unit) {
  return abilitiesAtWindow(unit, REACTION_WINDOW);
}

/**
 * The abilities this unit could use at a named timing window.
 *
 * One implementation for both sides of the exchange. `reactionAbilities` was
 * this function with `"whenAttacked"` inlined, and the attacker-side windows
 * need exactly the same gate list — an ability offered at a moment it is on
 * cooldown for is the refusal-when-pressed §17.6 forbids, whichever side of the
 * attack its owner is standing on.
 *
 * `oncePerTurn` and the **round**-scale exclusion are checked here and are not
 * checked by `reactionAbilities`'s original list, because they had no attacker
 * to be true of: Karna's *Uncrowned Arms Mastership* is *"can only be used once
 * per Round"*, which is the only limit on it — it has no cooldown at all.
 *
 * @param {object} unit an actor-shaped object with `items`
 * @param {string} window
 * @returns {object[]}
 */
export function abilitiesAtWindow(unit, window) {
  const used = unit?.turnState?.abilitiesUsed ?? [];
  const usedThisRound = unit?.roundState?.abilitiesUsed ?? [];
  const effects = unit?.effects ?? [];

  return [...(unit?.items ?? [])].filter((item) => {
    const sys = item.system ?? {};

    // A window may be a single string or a list; both are legitimate, and
    // Medea has one of each. Karna's Uncrowned Arms Mastership has two, and
    // they are not both reaction windows: *"during your Turn OR at the start of
    // a Combat Phase"* is the sheet button and this offer, one ability.
    const windows = [sys.timing?.window ?? []].flat();
    if (!windows.includes(window)) return false;

    if ((sys.cooldown?.remaining ?? 0) > 0) return false;
    if (blockedThisTurn(item, used)) return false;
    if (isNegated(item, effects)) return false;

    if (sys.oncePerTurn && used.some((id) => id === item.id || id === sys.contentId)) return false;
    if (sys.oncePerRound && usedThisRound.some((id) => id === item.id || id === sys.contentId)) return false;

    const maxUses = sys.maxUses ?? null;
    if (maxUses !== null && (sys.timesUsed ?? 0) >= maxUses) return false;

    // Already spent for good.
    if (sys.expended) return false;

    // ...and everything the ability's own `requirements` say. Offered without
    // them, a window put Achilles's Runner Comet in front of him while he was
    // MOUNTED -- and his sheet says "can only be used when Unmounted". That is
    // the refusal-when-pressed §17.6 forbids, and the same argument this
    // function's own docstring makes about cooldowns. Found live.
    //
    // Only the requirements answerable from the Unit alone: a `targetHasEffect`
    // has no target at a window and must not refuse for lack of one.
    const gates = (sys.requirements ?? []).filter((r) => SELF_REQUIREMENTS.has(r.kind));
    if (gates.length > 0 && !meetsRequirements(gates, { unit }).ok) return false;

    return true;
  });
}

/**
 * The reaction prompt's options, with any usable abilities appended.
 *
 * Prefixed `ability:` so the ladder can tell them from its own three without
 * a second field — the defender is choosing between "Evade" and "Trofa" in one
 * list, and they are the same kind of decision.
 *
 * @param {string[]} base the standard options for this rung
 * @param {object} unit
 * @returns {string[]}
 */
export function reactionOptions(base, unit) {
  return [...base, ...reactionAbilities(unit).map((a) => `ability:${a.id}`)];
}

/**
 * The ability id behind a chosen reaction option, or `null`.
 * @param {string} event
 * @returns {string|null}
 */
export function abilityFromOption(event) {
  return typeof event === "string" && event.startsWith("ability:") ? event.slice("ability:".length) : null;
}

/**
 * Abilities a **third party** may use because this defender is about to be hit.
 *
 * Returned with their owner, because the ability does not belong to the Unit
 * whose Combat Process it interrupts — which is the whole difficulty. Ch. 27's
 * ladder prompts one side per rung, so the offer is appended to the defender's
 * rung and carries the projector's name; the GM or the projector's player is
 * the one who answers.
 *
 * Every gate an ordinary reaction is checked against is checked here too, plus
 * two of its own: the distance from the projector, and what kind of attack it
 * answers. *"About to be hit by a Noble Phantasm"* is not a note — a barrier
 * offered against every Normal Attack would be a different ability.
 *
 * @param {object} args
 * @param {object} args.defender the defender's snapshot
 * @param {object} args.board
 * @param {object} args.attack `{kind}`
 * @param {(id: string) => object|null} args.actorFor resolves a unit id to a document
 * @returns {Array<{ability: object, ownerId: string, ownerName: string}>}
 */
export function allyReactions({ defender, board, attack, actorFor }) {
  /** @type {Array<{ability: object, ownerId: string, ownerName: string}>} */
  const out = [];
  if (!defender?.panel) return out;

  for (const unit of board?.units ?? []) {
    if (!unit.panel) continue;
    // "Any allied Unit (INCLUDING EMIYA)" -- the projector may itself be the
    // defender, which is why `self` counts and the id is not excluded.
    const relation = unit.id === defender.id ? "self" : relationOf(unit, defender, board);
    if (relation !== "ally" && relation !== "self") continue;

    const doc = actorFor(unit.id);
    if (!doc) continue;
    const used = unit.turnState?.abilitiesUsed ?? [];

    for (const item of doc.items ?? []) {
      const sys = item.system ?? {};
      const timing = sys.timing ?? {};
      if (![timing.window ?? []].flat().includes(ALLY_WINDOW)) continue;

      // Reach, measured from the PROJECTOR to the Unit in peril.
      const radius = timing.radius ?? 0;
      if (chebyshev(unit.panel, defender.panel) > radius) continue;

      // What it answers. "About to be hit by a Noble Phantasm" is a
      // restriction, not a note: a barrier offered against every Normal Attack
      // would be a different ability entirely.
      if (timing.againstKind && timing.againstKind !== (attack?.kind ?? "normal")) continue;

      // *"...an AoE Noble Phantasm of Rank A and above."* Achilles's barrier
      // answers a narrower set than EMIYA's: his gates on the incoming Noble
      // Phantasm's RANK and on it being an area attack at all, where Rho Aias
      // gates only on it being a Noble Phantasm.
      if (timing.againstRank) {
        const floor = Rank.parseOrNull(timing.againstRank);
        const incoming = Rank.parseOrNull(attack?.rank ?? null);
        if (!floor || !incoming || Rank.compare(incoming, floor) < 0) continue;
      }
      if (timing.requiresAoE && !attack?.isAoE) continue;

      // Spent for the rest of the game, which is not a cooldown: there is no
      // number of Turns after which Akhilleus Kosmos comes back.
      if (sys.expended) continue;

      if ((sys.cooldown?.remaining ?? 0) > 0) continue;
      if (blockedThisTurn(item, used)) continue;
      if (isNegated(item, unit.effects ?? [])) continue;

      out.push({ ability: item, ownerId: unit.id, ownerName: unit.name ?? doc.name });
    }
  }
  return out;
}
