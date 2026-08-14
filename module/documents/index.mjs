/**
 * @file Document subclasses.
 * @see docs/23-documents-and-derived-data.md
 *
 * Deliberately thin. Everything interesting lives in `rules/` and `engine/`;
 * these classes exist to project documents into snapshots and to route writes,
 * not to hold logic. No `Actor.prototype` patching anywhere (Ch. 21 §21.10).
 */

import { snapshotUnit, contributionsOf } from "../rules/snapshot.mjs";
import { applyStatDeltas, writeDerived } from "../rules/derived.mjs";

export { FGTCombat } from "./combat.mjs";

export class FGTActor extends Actor {
  /**
   * Project this actor into the plain-data snapshot the rules layer consumes.
   * @param {object} [opts]
   * @returns {object}
   */
  toSnapshot(opts = {}) {
    return snapshotUnit(this, opts);
  }

  /** Rule elements collected from every owned item, for the snapshot. */
  get ruleElements() {
    const out = [];
    for (const item of this.items) {
      const sys = item.system ?? {};
      for (const el of [...(sys.rules ?? []), ...(sys.passiveRules ?? [])]) {
        out.push({ ...el, source: el.source ?? item.name });
      }
    }
    return out;
  }

  /** @inheritdoc */
  prepareDerivedData() {
    super.prepareDerivedData();
    // The snapshot reads system.ruleElements; expose the collected list there
    // rather than making every consumer walk the item collection.
    this.system.ruleElements = this.ruleElements;

    // Mad Enhancement's `MOV +2, Range +1` has to be visible on the sheet and
    // to the movement planner, not only inside a damage calculation -- so stat
    // deltas are folded into derived data here, once, and every reader sees the
    // modified number without knowing where it came from.
    const contributions = contributionsOf(this);
    const derived = applyStatDeltas(this.system, contributions.statDeltas);
    writeDerived(this.system, derived);

    // Kept for the sheet's "why is my MOV 6?" tooltip.
    this.system.derivedTrace = derived.trace;
  }
}

export class FGTItem extends Item {}

export class FGTEffect extends ActiveEffect {
  /**
   * Absolute expiry means "is it over?" is a comparison, not a countdown.
   * @param {number} tick the combat's global turn index
   * @returns {boolean}
   */
  isExpired(tick) {
    const expiry = this.system?.expiry;
    return expiry !== null && expiry !== undefined && expiry <= tick;
  }
}



export class FGTCombatant extends Combatant {}

export class FGTToken extends TokenDocument {}
