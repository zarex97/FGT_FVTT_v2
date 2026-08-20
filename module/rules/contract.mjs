/**
 * @file Forming a contract with a Servant.
 * @see docs/16-relationships.md §16.2
 *
 * Layer 2 (rules). Pure — decides whether an attempt is legal, what must be
 * rolled, and what a success produces. The caller rolls.
 *
 * Two things about this rule are easy to get subtly wrong, and both are load-
 * bearing:
 *
 * 1. **The enemy-proximity check is about the contractor**, not the target:
 *    *"cannot attempt a Contract Servant roll if there is another enemy Unit
 *    within a 2 panel area of **itself**"*. And the Servant being contracted is
 *    itself an enemy unit standing adjacent, so a naive reading of that check
 *    refuses every enemy contract in the game.
 *
 * 2. **Independent Action at EX or A+ is a prohibition, not a difficulty.**
 *    Returning a large number of required rolls would make it a rule that
 *    enough attempts can beat; the text says such a Servant cannot be
 *    contracted by enemies at all.
 */

import { Rank } from "../domain/rank.mjs";
import { chebyshev } from "../domain/geometry.mjs";

/** Every reason an attempt can be refused. */
export const CONTRACT_REFUSALS = Object.freeze([
  "notAContractor", "notAdjacent", "enemyNearby", "alreadyContracted", "forbidden", "immune",
]);

/** How far an enemy must be for an attempt to be legal. */
const ENEMY_CLEARANCE = 2;

/** Command Spells a successful contract grants, namespaced to that Servant. */
const SPELLS_GRANTED = 3;

/**
 * May this unit even attempt to contract that one?
 *
 * @param {object} contractor a Master, or a Caster
 * @param {object} servant
 * @param {object} board
 * @returns {{ok: boolean, reason?: string}}
 */
export function canAttemptContract(contractor, servant, board) {
  if (!isContractor(contractor)) return { ok: false, reason: "notAContractor" };
  if (servant?.contract === "contracted") return { ok: false, reason: "alreadyContracted" };

  if (!contractor?.panel || !servant?.panel) return { ok: false, reason: "notAdjacent" };
  if (chebyshev(contractor.panel, servant.panel) > 1) return { ok: false, reason: "notAdjacent" };

  // The target is excluded: it is an enemy unit standing one panel away by
  // definition, so counting it would forbid every enemy contract there is.
  const intruder = (board?.units ?? []).find((u) =>
    u.id !== contractor.id
    && u.id !== servant.id
    && isEnemy(u, contractor)
    && u.panel
    && chebyshev(u.panel, contractor.panel) <= ENEMY_CLEARANCE);

  if (intruder) return { ok: false, reason: "enemyNearby" };

  return { ok: true };
}

/**
 * What contracting this Servant would take.
 *
 * @param {object} contractor
 * @param {object} servant
 * @param {object} board
 * @returns {object}
 */
export function contractPlan(contractor, servant, board) {
  const legal = canAttemptContract(contractor, servant, board);
  if (!legal.ok) return { ...legal, servantId: servant?.id ?? null, contractorId: contractor?.id ?? null };

  const allied = !isEnemy(servant, contractor);
  const unbound = servant.contract === "unbound";

  // §16.2's table. The one row that is neither a roll nor an automatic success
  // is an ally reaching for an Unbound Servant, which is forbidden outright.
  if (allied && unbound) {
    return { ok: false, reason: "forbidden", servantId: servant.id, contractorId: contractor.id };
  }
  if (allied) {
    return {
      ok: true, automatic: true, rolls: 0, formula: null, succeedsOn: [],
      servantId: servant.id, contractorId: contractor.id,
    };
  }

  const rolls = rollsRequired(servant, true);
  if (rolls === Infinity) {
    return { ok: false, reason: "immune", servantId: servant.id, contractorId: contractor.id };
  }

  return {
    ok: true,
    automatic: false,
    formula: "1d6",
    // Unbound is the harder of the two: only a 6.
    succeedsOn: unbound ? [6] : [5, 6],
    rolls,
    servantId: servant.id,
    contractorId: contractor.id,
  };
}

/**
 * How many successful rolls an attempt needs.
 *
 * Independent Action resists being contracted **by enemies**; an ally offering
 * a contract to a Free Servant is not something it defends against, so an
 * allied attempt is unaffected.
 *
 * @param {object} servant
 * @param {boolean} byEnemy
 * @returns {number} `Infinity` when it cannot be contracted at all
 */
export function rollsRequired(servant, byEnemy) {
  if (!byEnemy) return 1;

  const skill = (servant?.abilities ?? []).find(
    (a) => a.slug === "independentAction" || a.id === "independentAction",
  );
  if (!skill) return 1;

  const rank = Rank.parseOrNull(skill.rank);
  if (!rank) return 1;

  // EX and A+ are a prohibition rather than a difficulty. A number here would
  // be a rule that enough attempts can beat, and the text says otherwise.
  if (rank.grade === "EX" || (rank.grade === "A" && rank.steps > 0)) return Infinity;

  if (rank.grade === "A") return 4;
  if (rank.grade === "B") return 3;
  return 2;
}

/**
 * Fold the rolls into an outcome.
 *
 * @param {object} plan from {@link contractPlan}
 * @param {number[]} rolls
 * @returns {{success: boolean, reason?: string, descriptors: object[]}}
 */
export function contractOutcome(plan, rolls) {
  if (!plan?.ok) return { success: false, reason: plan?.reason ?? "illegal", descriptors: [] };

  if (!plan.automatic) {
    // Under-rolling is a caller bug, and succeeding on it would hand out a
    // contract that was never earned.
    if ((rolls ?? []).length < plan.rolls) {
      return { success: false, reason: "tooFewRolls", descriptors: [] };
    }
    // "The Servant can only be contracted if ALL rolls are successful."
    const allSucceeded = rolls.slice(0, plan.rolls).every((r) => plan.succeedsOn.includes(r));
    if (!allSucceeded) return { success: false, reason: "rollFailed", descriptors: [] };
  }

  return { success: true, descriptors: grants(plan.contractorId, plan.servantId, SPELLS_GRANTED) };
}

/**
 * The automatic contract that follows killing a Master (§16.2).
 *
 * Three trigger conditions, one outcome. The middle one is the subtle one: a
 * **Servant** killing an enemy Master only transfers the contract if it is
 * within 2 panels of *its own* Master. A lone Servant killing a Master creates
 * a Free Servant that nobody automatically claims.
 *
 * @param {object} args
 * @param {object} args.killer
 * @param {object} args.deadMaster
 * @param {object} args.board
 * @returns {{ok: boolean, reason?: string, descriptors: object[]}}
 */
export function conquestContract({ killer, deadMaster, board }) {
  const claimant = claimantFor(killer, board);
  if (!claimant.ok) return { ...claimant, descriptors: [] };

  const theirs = (board?.units ?? []).filter(
    (u) => u.masterId === deadMaster?.id && u.kind !== "master",
  );
  const inherited = deadMaster?.commandSpells ?? 0;

  // Freeing and contracting happen in ONE descriptor list. Emitting a
  // `contract: "free"` step first would let a watcher observe a Free Servant
  // that, by the rules, was never Free -- §16.2 requires both in one
  // transaction so no intermediate state exists.
  return {
    ok: true,
    descriptors: theirs.flatMap((servant) => grants(claimant.masterId, servant.id, inherited)),
  };
}

/* -------------------------------------------------------------------------- */

/**
 * Which Master, if any, claims the kill.
 * @param {object} killer
 * @param {object} board
 * @returns {{ok: boolean, reason?: string, masterId?: string}}
 */
function claimantFor(killer, board) {
  if (killer?.kind === "master" || killer?.servantClass === "caster") {
    return { ok: true, masterId: killer.id };
  }

  const own = (board?.units ?? []).find((u) => u.id === killer?.masterId);
  if (!own) return { ok: false, reason: "noMaster" };

  if (!own.panel || !killer.panel || chebyshev(own.panel, killer.panel) > ENEMY_CLEARANCE) {
    return { ok: false, reason: "servantTooFarFromMaster" };
  }
  return { ok: true, masterId: own.id };
}

/**
 * The descriptors a contract produces.
 * @param {string} masterId
 * @param {string} servantId
 * @param {number} spells
 * @returns {object[]}
 */
function grants(masterId, servantId, spells) {
  return [
    { kind: "setContract", unitId: servantId, contract: "contracted", masterId },
    // Namespaced to that Servant (§16.9): "3 Command Spells that can only be
    // used on that Servant".
    { kind: "grantCommandSpells", masterId, servantId, count: spells },
    { kind: "log", event: "contractFormed", masterId, servantId, spellsGranted: spells },
  ];
}

/** @param {object} unit @returns {boolean} */
function isContractor(unit) {
  return unit?.kind === "master" || unit?.servantClass === "caster";
}

/** @param {object} a @param {object} b @returns {boolean} */
function isEnemy(a, b) {
  if (!a?.factionId || !b?.factionId) return false;
  if (a.factionId === b.factionId) return false;
  return !(b.allyFactionIds ?? []).includes(a.factionId);
}
