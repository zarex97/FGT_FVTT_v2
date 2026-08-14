/**
 * @file Document subclasses.
 * @see docs/23-documents-and-derived-data.md
 *
 * Deliberately thin. Everything interesting lives in `rules/` and `engine/`;
 * these classes exist to project documents into snapshots and to route writes,
 * not to hold logic. No `Actor.prototype` patching anywhere (Ch. 21 §21.10).
 */

import { snapshotUnit } from "../rules/snapshot.mjs";

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

export class FGTCombat extends Combat {
  /** The monotonic turn index every absolute expiry is measured against. */
  get globalTurn() {
    return this.system?.globalTurn ?? 0;
  }
}

export class FGTCombatant extends Combatant {}

export class FGTToken extends TokenDocument {}
