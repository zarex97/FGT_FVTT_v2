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

import { resolveTurnOrder, computeTurnOrder } from "../engine/turn-order.mjs";

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

    // Delay does not carry across Rounds, and neither does who has acted.
    await this.update({
      "system.baseOrder": order,
      "system.turnOrder": computeTurnOrder(order, {}, [], this.gmFactionId),
      "system.delays": {},
      "system.takenThisRound": [],
    });
    return order;
  }

  /**
   * Declare `Delay+X` for a faction.
   *
   * Delay is a declaration about the *coming* turns, so it is recomputed
   * against the order rather than written into it: the stored `baseOrder` never
   * changes within a Round, and `turnOrder` is derived from it every time. That
   * is what keeps a delay from compounding each time anything re-renders.
   *
   * A faction that has already acted this Round keeps the entry for the next
   * Round instead of having it applied now (Ch. 25 §25.3).
   *
   * @param {string} factionId
   * @param {number} positions how many places later to go
   * @returns {Promise<string[]>} the new effective order
   */
  async delayFaction(factionId, positions) {
    const by = Math.max(0, Math.round(positions));
    const delays = { ...(this.system?.delays ?? {}), [factionId]: by };
    if (by === 0) delete delays[factionId];

    const order = computeTurnOrder(
      this.system?.baseOrder ?? [],
      delays,
      this.system?.takenThisRound ?? [],
      this.gmFactionId,
    );
    await this.update({ "system.delays": delays, "system.turnOrder": order });
    Hooks.callAll("fgtTurnOrderChanged", this, order);
    return order;
  }

  /**
   * Record that a faction has taken its turn, and re-derive the order.
   *
   * Called by the scheduler at each turn boundary. Marking is what freezes a
   * faction's position: a Delay declared after acting can no longer move it.
   *
   * @param {string|null} factionId
   * @returns {Promise<void>}
   */
  async markTurnTaken(factionId) {
    if (!factionId) return;
    const taken = new Set(this.system?.takenThisRound ?? []);
    if (taken.has(factionId)) return;
    taken.add(factionId);

    await this.update({
      "system.takenThisRound": [...taken],
      "system.turnOrder": computeTurnOrder(
        this.system?.baseOrder ?? [], this.system?.delays ?? {}, taken, this.gmFactionId,
      ),
    });
  }

  /**
   * The GM's combatant id, which is always last in the order.
   * @returns {string|null}
   */
  get gmFactionId() {
    const gm = this.combatants.find((c) => c.system?.isGM || c.name === "GM");
    return gm ? (gm.system?.factionId ?? gm.id) : null;
  }

  /** @inheritdoc */
  async startCombat() {
    await super.startCombat();
    await this.rollTurnOrder();
    return this;
  }
}
