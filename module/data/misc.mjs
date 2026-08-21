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
export class EffectData extends foundry.data.ActiveEffectTypeDataModel {
  static defineSchema() {
    return {
      // `changes` comes from core's own base model, not from a hand-rolled copy.
      //
      // Core hard-verifies the shape of this field at `setupGame`
      // (`#verifyActiveEffectModels`): the element schema must carry a numeric
      // `priority` and STRING `type` and `phase`. A v13-style numeric `mode`
      // throws, and because the throw happens inside `Game.setupGame` nothing
      // catches it — the world never renders, which on screen is just a black
      // page. Absent the field entirely core patches it in and logs; present
      // but wrong is fatal. So inherit it: the one shape that cannot drift out
      // of sync with the contract is core's own.
      //
      // F/GT does not use Foundry's change system — a rule element on the
      // effect *definition* is what modifies a unit (Ch. 24), because a change
      // can only write a document field and the rules need predicates,
      // ordering and an audit trail. The field exists, defaults empty, and is
      // honoured by core for anyone who does put something in it.
      ...super.defineSchema(),

      defId: new fields.StringField({ required: true, blank: false }),
      magnitude: new fields.NumberField({ required: true, initial: 0 }),
      // The reduced magnitude that applies against a Noble Phantasm. Appendix A
      // gives one to most of the damage family -- "damage dealt is increased
      // by 25%; **if NP, 15%**" -- and the effect definitions have referenced
      // `@npMagnitude` since they were written, against an instance that never
      // carried it. Every "if NP" clause in the game scored at the full
      // magnitude or at nothing, depending on the reader.
      npMagnitude: new fields.NumberField({ required: false, nullable: true, initial: null }),
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

      // The war's Region (Ch. 19 §19.3). Grants every Servant from it a
      // parameter step, which is why it lives on the match rather than on a
      // setting: it is chosen once, at setup, and never changes mid-war.
      region: new fields.StringField({ required: false, nullable: true, initial: null }),
      difficulty: new fields.StringField({ initial: "intermediate",
        choices: ["beginner", "intermediate", "expert", "lunatic"] }),

      // The Holy Grail (Ch. 19 §19.4). `grailCounter` counted defeated Servants
      // and nothing ever incremented or read it; the rest of the state had
      // nowhere to live at all, so materialization could not happen.
      // The structured game log (Ch. 30 §30.8). Chat is ephemeral in practice --
      // it scrolls, it gets cleared, and it interleaves with out-of-character
      // talk -- so the record that survives lives here. Bounded at 200 entries;
      // older ones flush to a JournalEntry, which is what keeps this document
      // from growing without limit (Ch. 22 §22.8's RISK).
      log: new fields.ArrayField(new fields.ObjectField()),
      // The journal holding everything already flushed off `log`.
      logJournalId: new fields.StringField({ required: false, nullable: true, initial: null }),

      grailCounter: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      grailThreshold: new fields.NumberField({ required: true, integer: true, initial: 9, min: 1 }),
      grailMaterialized: new fields.BooleanField({ initial: false }),
      grailDestroyed: new fields.BooleanField({ initial: false }),
      grailPosition: new fields.ObjectField({ required: false, nullable: true, initial: null }),
      /** unitId → `{unitId, roundsHeld}`. */
      grailContest: new fields.ObjectField({ required: true, initial: () => ({}) }),
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
