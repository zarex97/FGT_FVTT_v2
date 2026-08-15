/**
 * @file Effect, Combat and Combatant schemas.
 * @see docs/11-effect-engine.md, docs/25-turn-system.md
 */

const fields = foundry.data.fields;

/**
 * One ActiveEffect subtype, not one per effect. The effect's identity lives in
 * `system.defId` referencing the registry; declaring 152 subtypes would bloat
 * the manifest and gain nothing (Ch. 21 §21.1).
 */
export class EffectData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      // Core requires every ActiveEffect subtype to carry `changes`, and warns
      // at `setupGame` when one does not. F/GT does not use Foundry's own
      // change system — a rule element on the effect *definition* is what
      // modifies a unit (Ch. 24), because a change can only write a document
      // field and the rules need predicates, ordering and an audit trail. But
      // "we do not use it" is not the same as "it may be absent": modules and
      // core UI both read `effect.changes`, so the field exists, defaults empty,
      // and is honoured by core for anyone who does put something in it.
      changes: new fields.ArrayField(new fields.SchemaField({
        key: new fields.StringField({ required: true, blank: true }),
        value: new fields.StringField({ required: true, blank: true }),
        mode: new fields.NumberField({
          integer: true, initial: CONST.ACTIVE_EFFECT_MODES.ADD,
          choices: Object.values(CONST.ACTIVE_EFFECT_MODES),
        }),
        priority: new fields.NumberField({ required: false, nullable: true, initial: null }),
      })),

      defId: new fields.StringField({ required: true, blank: false }),
      magnitude: new fields.NumberField({ required: true, initial: 0 }),
      stage: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      uses: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),

      // An ABSOLUTE expiry tick, never a countdown. That is what makes Stop's
      // clock freeze expressible -- it shifts expiries rather than skipping
      // decrements -- and what keeps a mid-match fixed-operator change from
      // corrupting every duration on the board (Ch. 07 §7.5).
      expiry: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),

      sourceUnitId: new fields.DocumentIdField({ required: false, nullable: true, initial: null }),
      sourceAbilityId: new fields.StringField({ required: false, nullable: true, initial: null }),
      unremovable: new fields.BooleanField({ initial: false }),
      visibility: new fields.StringField({ initial: "public", choices: ["public", "ownerOnly", "gmOnly"] }),
      deferredUntil: new fields.StringField({ required: false, nullable: true, initial: null }),
      attributionHidden: new fields.BooleanField({ initial: false }),
    };
  }
}

/** The match. Turn order is per-PLAYER, not per-token (Ch. 25). */
export class MatchData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      // Monotonic across the whole match, so absolute expiries never collide.
      globalTurn: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      phase: new fields.StringField({ initial: "day", choices: ["day", "night", "none"] }),

      // Re-rolled EVERY round, not once at setup (Ch. 41 Q32). Two lists, not
      // one: `baseOrder` is what the dice said and `turnOrder` is what is
      // actually played after Delay. Collapsing them would make Delay
      // cumulative -- each recomputation would delay from the already-delayed
      // position -- and a faction could be pushed to the back of the round by
      // one declaration (Ch. 25 §25.3).
      baseOrder: new fields.ArrayField(new fields.StringField()),
      turnOrder: new fields.ArrayField(new fields.StringField()),

      // Faction id → positions delayed. Cleared at the start of each Round;
      // an individual entry is dropped at the end of the round it took effect
      // in (Ch. 07 §7.8).
      delays: new fields.ObjectField({ required: true, initial: () => ({}) }),

      // Which factions have already taken their turn this Round. Delay may not
      // reorder them, and a faction that delays after acting has its Delay
      // applied next Round instead.
      takenThisRound: new fields.ArrayField(new fields.StringField()),

      region: new fields.StringField({ required: false, nullable: true, initial: null }),
      grailCounter: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
    };
  }
}

/** A combatant is a PLAYER, with a budget, not a token. */
export class PlayerCombatantData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      factionId: new fields.StringField({ required: false, nullable: true, initial: null }),

      // The GM's slot, which is always last in the order (Ch. 25 §25.3). A flag
      // rather than a reserved faction id, because the GM is not a faction: it
      // owns no units and has no budget, it simply gets a turn.
      isGM: new fields.BooleanField({ initial: false }),

      budget: new fields.SchemaField({
        servantMoves: new fields.NumberField({ integer: true, initial: 4, min: 0 }),
        masterMoves: new fields.NumberField({ integer: true, initial: 3, min: 0 }),
        servantAttacks: new fields.NumberField({ integer: true, initial: 2, min: 0 }),
      }),
      turnOrderRoll: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
      delay: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
    };
  }
}
