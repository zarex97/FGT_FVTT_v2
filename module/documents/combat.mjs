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

import { resolveTurnOrder, computeTurnOrder, factionOfCombatant } from "../engine/turn-order.mjs";
import { factions as rosterFactions, faction as factionById } from "../engine/board.mjs";

export class FGTCombat extends Combat {
  /* ------------------------------------------------------------------------ */
  /*  Combatants are factions                                                  */
  /* ------------------------------------------------------------------------ */

  /**
   * Add a faction to the match.
   *
   * A Combatant here is a **faction**, not a token: turns belong to players
   * (D25.1), and a player moves up to four Servants in one turn rather than
   * getting four turns. Foundry's own "toggle combat state" makes a
   * token-shaped combatant, which is why adding tokens to the tracker appeared
   * to do nothing useful — the turn system had nothing it recognised to read.
   *
   * @param {string} factionId an id from the roster
   * @returns {Promise<object|null>} the created Combatant
   */
  async addFaction(factionId) {
    const faction = factionById(factionId);
    if (!faction) {
      ui.notifications.warn(game.i18n.format("FGT.Combat.UnknownFaction", { id: factionId }));
      return null;
    }
    if (this.combatants.some((c) => c.system?.factionId === factionId)) {
      ui.notifications.warn(game.i18n.format("FGT.Combat.AlreadyIn", { name: faction.name }));
      return null;
    }

    const created = await this.createEmbeddedDocuments("Combatant", [{
      type: "player",
      name: faction.name,
      system: { factionId, isGM: false },
    }]);
    return created.shift() ?? null;
  }

  /**
   * Add the GM's slot, which always takes the last turn of the Round.
   * @returns {Promise<object|null>}
   */
  async addGM() {
    if (this.combatants.some((c) => c.system?.isGM)) return null;
    const created = await this.createEmbeddedDocuments("Combatant", [{
      type: "player",
      name: game.i18n.localize("FGT.Combat.GMSlot"),
      system: { factionId: null, isGM: true },
    }]);
    return created.shift() ?? null;
  }

  /**
   * Put every faction in the roster into the match, in one action.
   *
   * The common case by a wide margin: a match is every faction that exists, and
   * making the GM add them one at a time is a tax on the setup they always
   * perform.
   *
   * @param {object} [opts]
   * @param {boolean} [opts.withGM=false] also add the GM's slot
   * @returns {Promise<number>} how many were added
   */
  async syncFactions({ withGM = false } = {}) {
    const present = new Set(this.combatants.map((c) => c.system?.factionId).filter(Boolean));
    const missing = rosterFactions().filter((f) => !present.has(f.id));

    if (missing.length > 0) {
      await this.createEmbeddedDocuments("Combatant", missing.map((f) => ({
        type: "player",
        name: f.name,
        system: { factionId: f.id, isGM: false },
      })));
    }
    if (withGM) await this.addGM();
    return missing.length;
  }

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
    // The GM does not roll: its slot is appended last by `computeTurnOrder`.
    const factions = [...new Set(
      this.combatants.filter((c) => !c.system?.isGM).map((c) => c.system?.factionId ?? c.id),
    )];
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
    const gm = this.combatants.find((c) => c.system?.isGM);
    return gm ? (gm.system?.factionId ?? gm.id) : null;
  }

  /**
   * The faction whose turn it is, or `null` before the match has one.
   *
   * Every consumer used to reach for `combat.combatant?.system?.factionId`
   * itself, which is `undefined` when the match has no combatants — and an
   * undefined faction reads as "No Faction" in the HUD, skips the turn-state
   * reset, and files the budget under the key `null`. One accessor, one answer.
   *
   * @returns {string|null}
   */
  get actingFactionId() {
    return factionOfCombatant(this.combatant);
  }

  /** Every faction slot in the match, the GM's excluded. @returns {object[]} */
  get factionCombatants() {
    return this.combatants.filter((c) => !c.system?.isGM);
  }

  /**
   * Which turn of the Round this is, 1-based, and how many there are.
   *
   * Distinct from `system.globalTurn`, which is the monotonic ◈ tick every
   * effect expiry is measured against and keeps counting across Rounds. The HUD
   * showed the tick where a player expected the position, so "Turn 2 of 3"
   * could appear in a two-faction match on Round 1.
   *
   * @returns {{position: number, total: number}}
   */
  get turnPosition() {
    const total = this.turns?.length ?? 0;
    return { position: total === 0 ? 0 : (this.turn ?? 0) + 1, total };
  }

  /**
   * @inheritdoc
   * A match with no factions in it cannot take a turn: `combatant` is
   * undefined, so nothing knows whose budget to reset or whose units to clear.
   * Refusing here — with the fix named — beats starting a combat that silently
   * does nothing on every "next turn".
   */
  async startCombat() {
    if (this.factionCombatants.length === 0) {
      ui.notifications.error(game.i18n.localize("FGT.Combat.NoFactionsInCombat"), { permanent: true });
      return this;
    }
    await super.startCombat();
    await this.rollTurnOrder();
    return this;
  }
}
