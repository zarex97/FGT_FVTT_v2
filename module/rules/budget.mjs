import { hasGranted, GRANTS } from "./granted.mjs";

/**
 * @file The turn budget: four pools, per-unit limits, prevention and compulsion.
 * @see docs/18-action-economy.md
 *
 * Layer 2 (rules). Pure. Every function takes a budget and a unit snapshot and
 * returns a verdict or a new budget; nothing here reads a document or writes
 * one. The engine owns the flag the budget lives on.
 *
 * Three rules interact and are easy to conflate:
 *
 * 1. **The faction budget** — four independent pools (D18.1). Up to 4 Servants
 *    may move, up to 3 Masters may move, up to 2 Servants may attack, and any
 *    number of Masters may attack.
 * 2. **The per-unit limit** — a unit may move once and attack once, whatever
 *    the pools allow.
 * 3. **The unit-counting rule** (D18.3) — the budget counts *units*, not
 *    actions. A Servant that moves and then uses an Active Skill has consumed
 *    **one** `servantMove`, not two. Attacks are the documented exception: they
 *    draw from `servantAttack` *in addition* to the unit having been counted.
 */

/** The default maxima, from the rulebook's Faction Turn paragraph. */
export const DEFAULT_MAXIMA = Object.freeze({
  servantMove: 4,
  masterMove: 3,
  servantAttack: 2,
  masterAttack: Infinity,
});

/** Effects that stop a unit acting at all. */
const PREVENT_ALL = Object.freeze([
  "stun", "stop", "freeze", "petrify", "sleep", "nightmare", "coma", "webbed", "crystalfreeze",
]);

/** Effect → what it prevents, for the partial preventions. */
const PREVENTS = Object.freeze({
  immobilize: ["move"],
  disable: ["attack", "skill", "np"],
  seal: ["attack", "skill", "np"],
  silence: ["spell"],
  skillSeal: ["skill", "spell"],
  npSeal: ["np"],
});

/** Human-readable names, for the refusal messages the HUD prints. */
const LABELS = Object.freeze({
  servantMove: "Servant moves",
  masterMove: "Master moves",
  servantAttack: "Servant attacks",
  masterAttack: "Master attacks",
});

/**
 * @typedef {"move"|"attack"|"skill"|"np"|"spell"|"ridingAttack"|"gather"|"mark"} ActionKind
 */

/**
 * @typedef {object} Budget
 * @property {Record<string, {used: number, max: number}>} pools
 * @property {string[]} countedUnits units already counted against a move pool
 * @property {string[]} attackedUnits units that have attacked this turn
 */

/**
 * A fresh budget for one faction's turn.
 *
 * @param {object} [maxima] overrides, for a ruleset that changes the pools
 * @returns {Budget}
 */
export function emptyBudget(maxima = {}) {
  const limits = { ...DEFAULT_MAXIMA, ...maxima };
  return {
    pools: Object.fromEntries(Object.entries(limits).map(([k, max]) => [k, { used: 0, max }])),
    countedUnits: [],
    attackedUnits: [],
  };
}

/**
 * Which pool an action draws from, or `null` when it draws from none.
 *
 * Summons and Platforms are explicitly exempt: *"Bašmu do not count towards the
 * number of Units who Move/Attack in a Turn"*. Reactions — Counter, Evade,
 * Block — happen on somebody else's turn and cost nothing.
 *
 * @param {object} unit a `UnitSnapshot`
 * @param {ActionKind} action
 * @returns {string|null}
 */
export function poolFor(unit, action) {
  if (unit?.exemptFromBudget || ["summon", "platform"].includes(unit?.kind)) return null;
  const master = unit?.kind === "master";

  switch (action) {
    case "attack":
    case "np":
    case "spell":
    case "ridingAttack":
    case "mark":
      // "Using the 'Mark' Action places a Bloodmark ... and COUNTS AS HER
      // ATTACK FOR THE TURN." Billed to the attack pool rather than given one
      // of its own, so the mutual exclusion with attacking and with a Riding
      // Attack is the one the budget already enforces.
      return master ? "masterAttack" : "servantAttack";
    // D18.2: an Active Skill consumes a MOVE slot, not an attack slot. Reading
    // (b) would leave Scáthach and Karna nearly unusable.
    case "move":
    case "gather":
    case "skill":
      return master ? "masterMove" : "servantMove";
    default:
      return null;
  }
}

/**
 * Is this unit stopped by an effect before the budget is even consulted?
 *
 * A prevented action never happens, so it never costs budget — which is why
 * this is checked first and separately.
 *
 * @param {object} unit
 * @param {ActionKind} action
 * @returns {{prevented: boolean, by: string|null}}
 */
export function preventedBy(unit, action) {
  const held = unit?.effects ?? [];
  const blanket = PREVENT_ALL.find((id) => held.includes(id));
  if (blanket) return { prevented: true, by: blanket };

  for (const [id, actions] of Object.entries(PREVENTS)) {
    if (!held.includes(id)) continue;
    // `seal` spares Spells; `silence` spares everything but them. The two are
    // complements and the table above says so directly.
    if (actions.includes(action)) return { prevented: true, by: id };
  }

  // A STANDING prevention, from a suppression rather than from an effect.
  // Innocent World clause 6: *"the Servant is affected with NP Seal ... the
  // effects of Innocent World cannot be prevented or removed as long as a Unit
  // is within Doomsday Come."*
  //
  // An interior annotation rather than an applied effect, which is what makes
  // the second half free: it is present exactly while the Unit stands inside,
  // gone the moment it leaves, and there is nothing for Dispel or a Cure to
  // find. Read against the SAME table the effects are, so a scope and an
  // effect id that share a name prevent the same actions.
  for (const suppression of unit?.suppressions ?? []) {
    const actions = PREVENTS[suppression?.scope];
    if (actions?.includes(action)) return { prevented: true, by: suppression.scope };
  }

  return { prevented: false, by: null };
}

/**
 * May this unit take this action right now?
 *
 * @param {Budget} budget
 * @param {object} unit
 * @param {ActionKind} action
 * @returns {{ok: boolean, reason: string|null, pool: string|null, free: boolean}}
 */
export function canConsume(budget, unit, action) {
  const prevention = preventedBy(unit, action);
  if (prevention.prevented) {
    return { ok: false, reason: `prevented by ${prevention.by}`, pool: null, free: false };
  }

  const state = unit?.turnState ?? {};
  const isAttack = ["attack", "np", "spell", "ridingAttack", "mark"].includes(action);

  // "During Semiramis' Turn, the HGoB can Move/Attack once per Turn ... does
  // not count towards number of Units who Move or Act in a Turn" (§20.10),
  // and Bašmu's "can only Move/Attack once per Turn" (§20.10/summons) --
  // exempt from every pool below, but not from a PER-UNIT cap, which is a
  // separate rule (see the module docstring's rule 2 vs. rule 1). A platform
  // is not a combatant taking a slot; it is equipment its owner operates, so
  // it spends nothing -- but "spends nothing" is not "acts without limit",
  // which the unconditional `free: true` this replaced could not tell apart.
  if (unit?.kind === "platform" || unit?.actsOncePerTurn) {
    const already = isAttack ? state.attacked : (action === "move" ? state.moved : false);
    if (already) {
      return { ok: false, reason: "this unit has already acted this Turn", pool: null, free: false };
    }
    return { ok: true, reason: null, pool: null, free: true };
  }

  if (isAttack && state.attacked) {
    return { ok: false, reason: "this unit has already attacked this turn", pool: null, free: false };
  }
  // A Unit may Move as many times as its MOV allows, until it Attacks — the
  // allowance is a distance, and `segmentCheck` is what measures it. The only
  // thing the budget refuses is Moving *after* the Attack, which Riding alone
  // permits. (The superseded rule was one Move per Turn.)
  if (action === "move" && state.attacked && !hasGranted(unit, GRANTS.doubleMove) && !unit?.hasRiding) {
    return { ok: false, reason: "this unit has attacked and cannot move again", pool: null, free: false };
  }
  // Riding Attack is terminal: *"neither can it Move a second time after using
  // a Riding Attack"*.
  if (action === "move" && state.usedRidingAttack) {
    return { ok: false, reason: "Riding Attack ends this unit's turn", pool: null, free: false };
  }

  const pool = poolFor(unit, action);
  if (pool === null) return { ok: true, reason: null, pool: null, free: true };

  // D18.3 — already counted against a move pool, so a second non-attack action
  // by the same unit is free.
  const alreadyCounted = !isAttack && budget.countedUnits.includes(unit.id);
  if (alreadyCounted) return { ok: true, reason: null, pool, free: true };

  // A Master attacks at most once, which is a per-unit limit wearing an
  // unlimited pool's clothing.
  if (pool === "masterAttack" && budget.attackedUnits.includes(unit.id)) {
    return { ok: false, reason: "this Master has already attacked this turn", pool, free: false };
  }

  const p = budget.pools[pool];
  if (p && p.used >= p.max) {
    return { ok: false, reason: `${LABELS[pool] ?? pool} exhausted (${p.used}/${p.max})`, pool, free: false };
  }
  return { ok: true, reason: null, pool, free: false };
}

/**
 * Spend the budget for an action. Returns a **new** budget; the caller writes it.
 *
 * @param {Budget} budget
 * @param {object} unit
 * @param {ActionKind} action
 * @returns {{ok: boolean, reason: string|null, budget: Budget}}
 */
export function consume(budget, unit, action) {
  const verdict = canConsume(budget, unit, action);
  if (!verdict.ok) return { ok: false, reason: verdict.reason, budget };
  if (verdict.free || verdict.pool === null) return { ok: true, reason: null, budget };

  const isAttack = ["attack", "np", "spell", "ridingAttack", "mark"].includes(action);
  const next = {
    pools: { ...budget.pools, [verdict.pool]: { ...budget.pools[verdict.pool], used: budget.pools[verdict.pool].used + 1 } },
    countedUnits: isAttack ? [...budget.countedUnits] : [...budget.countedUnits, unit.id],
    attackedUnits: isAttack ? [...budget.attackedUnits, unit.id] : [...budget.attackedUnits],
  };
  return { ok: true, reason: null, budget: next };
}

/**
 * How many panels this unit may still move.
 *
 * Riding's *"the total number of panels Moved during both times cannot exceed
 * its MOV"* makes this a running total rather than a per-segment allowance.
 *
 * @param {object} unit
 * @returns {number}
 */
export function movementRemaining(unit) {
  const used = unit?.turnState?.movedPanels ?? 0;
  return Math.max(0, (unit?.mov ?? 0) - used);
}

/**
 * Unmet compulsions, evaluated over the whole turn.
 *
 * Both `Berserk` and `Decoy` carry the qualifier *"if there are multiple Units
 * on the board capable of Attacking in the same Turn **and the player performs
 * any Attacks**, the Unit affected must be one of the Attackers"* — so the
 * compulsion is conditional on the player having attacked at all, and cannot be
 * validated action by action. That is why it lands here, at turn end (D18.4).
 *
 * @param {object[]} units the acting faction's units, as snapshots
 * @returns {Array<{unitId: string, unitName: string, effect: string, message: string}>}
 */
export function unmetCompulsions(units) {
  const mine = units ?? [];
  const attackers = mine.filter((u) => u.turnState?.attacked);
  const anyoneAttacked = attackers.length > 0;
  /** @type {Array<{unitId: string, unitName: string, effect: string, message: string}>} */
  const unmet = [];

  for (const unit of mine) {
    const held = unit.effects ?? [];
    // Two sources. A held effect (Berserk, Decoy) and a POSITIONAL compulsion
    // annotated onto the unit by `rules/compulsion.mjs` -- which is what
    // Penthesilea's Hatred of Achilles is, and what this loop could never see
    // before, because nothing ever applied a `hatred` effect.
    const compelled = held.find((id) => ["berserk", "decoy:target", "hatred"].includes(id))
      ?? (unit.compulsions ?? [])[0]?.id;
    if (!compelled) continue;
    if (unit.turnState?.attacked) continue;
    // A unit that could not have attacked is not in breach.
    if (preventedBy(unit, "attack").prevented) continue;
    if (unit.canAct === false) continue;

    if (compelled === "berserk") {
      // Berserk is unconditional -- "has to Move and Attack on its Turn if able"
      // -- but the multi-unit clause below softens it to the same conditional
      // form when the player attacked with nobody at all.
      if (!anyoneAttacked && !unit.turnState?.moved) {
        unmet.push({
          unitId: unit.id, unitName: unit.name, effect: "Berserk",
          message: `${unit.name} is Berserked and must Move and Attack this turn.`,
        });
        continue;
      }
      if (anyoneAttacked) {
        unmet.push({
          unitId: unit.id, unitName: unit.name, effect: "Berserk",
          message: `${unit.name} is Berserked. You attacked with ${attackers.length} unit(s) this turn, so ${unit.name} must be one of the attackers.`,
        });
      }
      continue;
    }

    if (anyoneAttacked) {
      unmet.push({
        unitId: unit.id, unitName: unit.name, effect: compelled === "hatred" ? "Hatred" : "Decoy",
        message: `${unit.name} must attack the unit compelling it. You attacked with ${attackers.length} unit(s) this turn, so ${unit.name} must be one of the attackers.`,
      });
    }
  }
  return unmet;
}

/**
 * May the turn be ended?
 *
 * @param {object[]} units the acting faction's units
 * @returns {{ok: boolean, unmet: object[]}}
 */
export function canEndTurn(units) {
  const unmet = unmetCompulsions(units);
  return { ok: unmet.length === 0, unmet };
}

/**
 * The HUD's view of a budget: one row per pool, with the pips already counted.
 *
 * @param {Budget} budget
 * @returns {Array<{pool: string, label: string, used: number, max: number|null, pips: boolean[]}>}
 */
export function summarize(budget) {
  return Object.entries(budget.pools)
    .filter(([, p]) => Number.isFinite(p.max))
    .map(([pool, p]) => ({
      pool,
      label: LABELS[pool] ?? pool,
      used: p.used,
      max: p.max,
      pips: Array.from({ length: p.max }, (_, i) => i < p.used),
    }));
}
