/**
 * @file `CONFIG.FGT` — the system's public configuration surface.
 * @see docs/21-system-skeleton.md §21.4
 *
 * Everything a GM or module might want to override lives here rather than in
 * module-scope constants. A module adding a rule element does
 * `CONFIG.FGT.ruleElements.myThing = MyClass` in its own `init`, and content
 * can then reference `key: myThing` — the same mechanism the system itself
 * uses, which is the whole extension story.
 */

import { TABLES } from "./domain/tables.mjs";
import { TICK_OVERRIDES } from "./domain/tick.mjs";
import { GRADES, SERVANT_CLASSES, PARAMETERS } from "./domain/enums.mjs";

export const FGT = {
  ranks: GRADES,

  servantClasses: Object.fromEntries(
    SERVANT_CLASSES.map((c) => [c, `FGT.Class.${c[0].toUpperCase()}${c.slice(1)}`]),
  ),
  parameters: Object.fromEntries(
    PARAMETERS.map((p) => [p, `FGT.Param.${p}`]),
  ),

  /** Appendix B, as data. */
  tables: TABLES,

  /** The published fixed-operator fraction table (Ch. 07 §7.2). */
  tickOverrides: TICK_OVERRIDES,

  /** Per-player, per-turn (Ch. 18). */
  budgets: { servantMoves: 4, masterMoves: 3, servantAttacks: 2 },

  /** Round gates. Assassins unlock Noble Phantasms two rounds early. */
  gates: { npRound: 6, npRoundAssassin: 4, magicCrestRound: 3, noAttackRound: 1 },

  /** Populated at `setup`, once the compendium packs are readable. */
  effects: null,
  dice: null,

  /** key → class. Extension point for modules. */
  ruleElements: {},
};
