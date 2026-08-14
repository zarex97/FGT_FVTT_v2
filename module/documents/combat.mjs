/**
 * @file `FGTCombat` — turns belong to players, not tokens.
 * @see docs/25-turn-system.md
 *
 * Foundry's Combat is token-based and initiative-driven; F/GT is neither. Each
 * *player* takes a turn, moving up to four Servants and three Masters, and turn
 * order is a `1d100` per faction re-rolled every Round.
 *
 * `globalTurn` is the monotonic index every absolute effect expiry is measured
 * against. It never resets, which is what stops a duration from surviving a
 * round boundary by accident.
 */

import { resolveTurnOrder } from "../engine/turn-order.mjs";

export class FGTCombat extends Combat {
  /** The monotonic turn index absolute expiries are measured against. */
  get globalTurn() {
    return this.system?.globalTurn ?? 0;
  }

  /** How many turns a Round lasts — the ◈ value. */
  get turnsPerRound() {
    return game.settings.get("fgt", "turnsPerRound");
  }

  /**
   * There is no initiative. Turn order is rolled per faction, per Round.
   * @inheritdoc
   */
  _sortCombatants(a, b) {
    const order = this.system?.turnOrder ?? [];
    const ia = order.indexOf(a.system?.factionId ?? a.id);
    const ib = order.indexOf(b.system?.factionId ?? b.id);
    if (ia !== ib) return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib);
    return (a.name ?? "").localeCompare(b.name ?? "");
  }

  /**
   * Roll faction turn order for the coming Round.
   *
   * Every Round, not once at setup — an answered question (Ch. 41 Q32) that
   * changes how the game plays, because a faction cannot be locked into last
   * place for the whole match.
   *
   * @returns {Promise<string[]>}
   */
  async rollTurnOrder() {
    const factions = [...new Set(this.combatants.map((c) => c.system?.factionId ?? c.id))];
    const entries = [];
    for (const id of factions) {
      const roll = await new Roll("1d100").evaluate();
      entries.push({ id, roll: roll.total });
    }

    let { order, contested } = resolveTurnOrder(entries, { gmId: null });

    // Ties are re-rolled among the tied factions only, for the contested
    // positions only. Guarded against a pathological run of identical rolls.
    for (let attempt = 0; contested.length > 0 && attempt < 10; attempt++) {
      const group = contested[0];
      const rerolls = [];
      for (const id of group) {
        const roll = await new Roll("1d100").evaluate();
        rerolls.push({ id, roll: roll.total });
      }
      const { breakTie } = await import("../engine/turn-order.mjs");
      const next = breakTie(order, rerolls);
      order = next.order;
      contested = next.stillContested;
    }

    await this.update({ "system.turnOrder": order });
    return order;
  }

  /** @inheritdoc */
  async startCombat() {
    await super.startCombat();
    await this.rollTurnOrder();
    return this;
  }
}
