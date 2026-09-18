/**
 * @file Records that expire by being read.
 *
 * Layer 1 (domain). Pure.
 *
 * A Unit carries two records of what it has done inside a cycle of the clock:
 * the **Turn Record**, stamped with the ◈ tick, and the **Round Record**,
 * stamped with the Round. Both obey one rule, and this module is the rule.
 *
 * ## Stale by reading
 *
 * A record stamped with an earlier cycle says nothing about this one, so it
 * reads as blank. Deciding that on **read** is what makes the reset reliable.
 * The previous design cleared the record by writing a blank one at each
 * boundary, and a boundary hook that did not fire -- for any reason, on any
 * client -- left a Unit permanently out of movement with nothing on screen to
 * explain it. A stale stamp cannot fail in that direction: the worst it does is
 * forget something the Unit had already done.
 *
 * `null` as the current cycle means "do not apply the rule", used when no
 * combat is running and there are no cycles to be stale against. `null` as the
 * record's own stamp means "written before this field existed", which is stale
 * against every cycle -- the safe direction.
 *
 * ## The write side is half the rule
 *
 * Reading is only half of it, and the half that was missing cost four separate
 * defects. A writer that stamps the current cycle and patches the fields it
 * cares about makes every OTHER field of a stale record **current again**: the
 * stamp is what marked them dead, and re-stamping revives them. So a write has
 * to rebuild the whole record through the same projection a read uses, which is
 * why `write` is composed on `at` here rather than beside it. The two cannot
 * disagree about what stale means, because there is only one of them.
 *
 * That was learned twice. #32 found it in `markTurn` and fixed `markTurn`;
 * `recordUse` and `markRoundState` are separate writers in the same file and
 * went on doing it, one of them on every ability use in the game. The rule was
 * a convention each writer applied by hand, and a convention is fixed one hand
 * at a time. It is a module now so that there is nothing left to remember.
 *
 * ## The spec is the blank
 *
 * A record is declared as its field defaults and nothing else. That is
 * deliberate: the blank record used to be a hand-written literal beside a
 * hand-written projection beside a hand-written schema, and a field added to
 * one and not the others was written to the document and invisible to every
 * rule that read a snapshot. `reshapedField` shipped that way, and so did
 * `abilitiesUsed`. Here the defaults ARE the blank, so the two cannot drift.
 *
 * How a value is carried across is inferred from its default, which is enough
 * for every field either record has: a boolean is coerced, a number falls back,
 * and a list is COPIED rather than shared, so no two projections of one record
 * hand out the same array. A field needing something these three cannot express
 * is the signal to add a kind, not a reason to have started with one.
 *
 * The Foundry schema in `data/actor/_shared.mjs` still declares these fields in
 * its own idiom, because a `SchemaField` carries validation and documentation a
 * spec table would lose. The two are held together by a drift test rather than
 * generated one from the other -- see ADR 0003 for why, and for what would flip
 * that decision.
 *
 * @see docs/09-projection.md, docs/04-time-model.md
 */

/**
 * Carry one field's stored value into a projection, per its default's kind.
 *
 * @param {unknown} stored what the document holds
 * @param {unknown} fallback the field's declared default
 * @returns {unknown}
 */
function carry(stored, fallback) {
  // A fresh array every time. Sharing one would let a caller that mutates its
  // projection reach the next caller's -- and `abilitiesUsed` is appended to.
  if (Array.isArray(fallback)) return [...(Array.isArray(stored) ? stored : [])];
  if (typeof fallback === "boolean") return Boolean(stored);
  return stored ?? fallback;
}

/**
 * A record that expires by being read.
 *
 * @param {object} args
 * @param {string} args.stamp the field naming the cycle -- `"tick"` or `"round"`
 * @param {object} args.fields every other field, as its default value
 * @returns {{stamp: string, fields: object, at: Function, write: Function}}
 */
export function stampedRecord({ stamp, fields }) {
  const names = Object.keys(fields);

  /**
   * The record as it reads during `cycle`, or a blank one when it belongs to
   * an earlier cycle.
   *
   * @param {object|null} raw the stored record
   * @param {number|null} cycle the cycle being read from
   * @returns {object} every field of the projected record
   */
  const at = (raw, cycle) => {
    const stale = cycle !== null && (raw?.[stamp] ?? null) !== cycle;
    const out = { [stamp]: stale ? cycle : (raw?.[stamp] ?? null) };
    for (const name of names) out[name] = carry(stale ? undefined : raw?.[name], fields[name]);
    return out;
  };

  /**
   * Every field to WRITE when patching some of them.
   *
   * The whole record, not the patch: a partial write that refreshes the stamp
   * resurrects everything it did not touch.
   *
   * @param {object|null} raw the stored record
   * @param {number|null} cycle now
   * @param {object} [patch] the fields being set
   * @returns {object} every field to write
   */
  const write = (raw, cycle, patch = {}) => ({ ...at(raw, cycle), ...patch, [stamp]: cycle });

  return { stamp, fields, at, write };
}

/**
 * What a Unit has done so far during a Turn.
 *
 * Every field here is declared by `data/actor/_shared.mjs#combatantCommon`,
 * which carries the prose on why each one exists -- Karna's Kavacha and
 * Kundala, Jack's Mist, Medea's Keraino, the Nameless Forest's escape.
 * `test/unit/master-data.test.mjs` holds the two together.
 */
export const TURN_RECORD = stampedRecord({
  stamp: "tick",
  fields: {
    acted: false,
    moved: false,
    attacked: false,
    inCombatPhase: false,
    movedPanels: 0,
    moveSegments: 0,
    usedActiveSkill: false,
    usedRidingAttack: false,
    gathered: false,
    reshapedField: false,
    itemTransfers: 0,
    abilitiesUsed: [],
    namelessForestAttempts: 0,
  },
});

/** The same at Round scale, for exclusions a Turn cannot express. */
export const ROUND_RECORD = stampedRecord({
  stamp: "round",
  fields: {
    abilitiesUsed: [],
    combatInBaseThisRound: false,
  },
});
