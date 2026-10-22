/**
 * @file Effect, Combat and Combatant schemas.
 * @see docs/15-effect-application.md, docs/25-turn-order-and-scheduler.md
 */

import { WAR_RULES } from "../domain/war-rules.mjs";

const fields = foundry.data.fields;

/**
 * One field per War Rule, from `rules/war-rules.mjs`.
 * @returns {Record<string, foundry.data.fields.DataField>}
 */
function warRuleFields() {
  /** @type {Record<string, foundry.data.fields.DataField>} */
  const out = {};
  for (const spec of WAR_RULES) {
    const choices = spec.choices ? Object.keys(spec.choices) : undefined;
    if (spec.type === "number") {
      out[spec.key] = new fields.NumberField({
        // No `choices` on a number: the closed lists (the ◈'s three rows, the
        // two board sizes) are the controls' job, and a stored value outside
        // them is the GM's earlier choice, not a document to refuse.
        required: true, integer: true, initial: spec.initial,
        ...(spec.range?.min !== undefined ? { min: spec.range.min } : {}),
        ...(spec.range?.max !== undefined ? { max: spec.range.max } : {}),
      });
    } else if (spec.type === "boolean") {
      out[spec.key] = new fields.BooleanField({ initial: spec.initial });
    } else if (spec.type === "string") {
      out[spec.key] = new fields.StringField({
        // `legacy`: a War document that never stored this rule was created before
        // it existed, and reads the value that keeps it playing as it began. A new
        // War never meets it: the wizard writes every rule from the world's
        // defaults (`engine/war-setup.mjs#commitWar`).
        required: !spec.nullable, nullable: Boolean(spec.nullable), initial: spec.legacy ?? spec.initial,
        ...(choices ? { choices } : {}),
      });
    } else {
      // The roster: a shape `rules/factions.mjs#normalizeFactions` owns.
      out[spec.key] = new fields.ArrayField(new fields.ObjectField());
    }
  }
  return out;
}

/**
 * One ActiveEffect subtype, not one per effect. The effect's identity lives in
 * `system.defId` referencing the registry; declaring 152 subtypes would bloat
 * the manifest and gain nothing (Ch. 02).
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
      // effect *definition* is what modifies a unit (Ch. 10), because a change
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
      // The polarity it LANDED with, decided once (`rules/effect-instance.mjs`,
      // #315): Romulus's stacks are a buff on an ally and a debuff on an enemy.
      // `null` on an instance written before 2026-10-22: its definition's.
      polarity: new fields.StringField({ required: false, nullable: true, initial: null, choices: ["buff", "debuff", "status"] }),
      // How many times its definition's `decay` event has been counted: Merlin's
      // Crit DmUp (Illusion) loses 5% per successful Crit (#296).
      decayCount: new fields.NumberField({ required: false, integer: true, initial: 0, min: 0 }),
      // What THIS instance's definition reads off it, beyond a magnitude: a
      // Presence Concealment granted by Dongyū carries its own Rank and Evade
      // (`{rank: "C+", evade: 2}`), because the Unit it lands on has no Skill to
      // read them from (#249 readings 2, 4). Keys are checked per definition
      // (`rules/effect-flow.mjs#EFFECT_PARAMS`).
      params: new fields.ObjectField({ required: false, nullable: true, initial: null }),

      // An ABSOLUTE expiry tick, never a countdown. That is what makes Stop's
      // clock freeze expressible -- it shifts expiries rather than skipping
      // decrements -- and what keeps a mid-match fixed-operator change from
      // corrupting every duration on the board (Ch. 04).
      expiry: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),

      // The tick this instance ARRIVED on, which is the mirror of `expiry` and
      // answers the mirror question. Ch. 15's rule -- an effect does not
      // act on the Turn it ends -- has always been enforced from `expiry`;
      // Kingprotea's `NP DmUp (GAO)` is the first clause that states the other
      // end: *"at the end of this Unit's Turn **except the Turn this Skill was
      // activated**"*. Without this, the buffs she gained this Turn would each
      // lose a charge before she had used any of them.
      appliedTick: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),

      sourceUnitId: new fields.DocumentIdField({ required: false, nullable: true, initial: null }),
      // The bounded field this instance belongs to, if any. Ozymandias's
      // Complex is *"permanent Stage 1 Curse as long as they are within ...
      // automatically removed after leaving"*, and the removal is swept on
      // MEMBERSHIP rather than fired on an exit event -- a unit teleported out,
      // knocked back out, or standing still while the field closes under it
      // would otherwise carry it for ever.
      //
      // A plain `StringField`, not a `DocumentIdField`: a field's id is its
      // ability's CONTENT id (`engine/fields.mjs` stamps `fieldId` from
      // `system.contentId`), which is a slug and not a Foundry id.
      sourceFieldId: new fields.StringField({ required: false, nullable: true, initial: null, blank: false }),
      // The terrain TYPE this instance belongs to, if any, the way
      // `sourceFieldId` names a field. Burning's Burn *"does not expire and
      // cannot be removed"* while its bearer is inside, and ends on leaving --
      // swept on the panel the bearer stands on, never on an exit event, for
      // the argument above (#147).
      sourceTerrain: new fields.StringField({ required: false, nullable: true, initial: null, blank: false }),
      // The event that ends this instance, for a duration authored as `until
      // <event>`: Anastasia's Blind *"until the Combat Process ends"*, Mannanán's
      // Crit Up *"for that Combat Phase"*. Parsed, and then nothing ever removed
      // it -- the Blind outlived its Process by the rest of the match (#197).
      endsOn: new fields.StringField({ required: false, nullable: true, initial: null, blank: false }),
      // The field a tied instance LEFT and turned ordinary on leaving. Piedra
      // Del Sol's Burn *"is no longer permanent"* once its bearer leaves -- an
      // ordinary Burn from then on -- and walking back in makes that same Burn
      // permanent again (ruled 2026-10-02, #65). `sourceFieldId` is cleared on
      // leaving, so this is how re-entry finds it (`engine/movement-hooks.mjs`).
      revertedFromField: new fields.StringField({ required: false, nullable: true, initial: null, blank: false }),
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

      // Which CONNECTION ran a given boundary's scheduler sequence.
      //
      // `game.users.activeGM` elects one GM *user*, and `isSelf` is true for
      // every connection that user holds — so two browser tabs on one
      // Gamemaster each ran the whole turn-end sequence and every scheduled
      // effect ticked twice: drains, periodics, cooldown advances, expiries.
      // `game.users.filter(u => u.active)` will not show it, because Foundry
      // tracks activity per user and not per connection (Ch. 46 §46.4-D).
      //
      // `{turn, round, token}` rather than a bare "last boundary run": the
      // token is what makes the election decidable. Foundry gives a system no
      // server-side compare-and-set, so both connections write and the server
      // serialises them; whichever token survives is the one connection that
      // proceeds. Runtime state, never authored.
      //
      // `turn` and `round` hold the BOUNDARY KEYS from
      // `rules/schedule-claim.mjs` ("r3t1", "r3") and not, as they first did,
      // the global turn and round numbers. Keying the claim on `globalTurn`
      // keyed it on a counter the guarded sequence itself advances, so one
      // throw between the claim and the advance froze the scheduler for the
      // life of the world (Ch. 46 §46.4-AB). A world holding the old numeric
      // shape thaws on its next boundary: a number never equals a key.
      scheduleClaim: new fields.ObjectField({ required: false, initial: () => ({}) }),
      phase: new fields.StringField({ initial: "day", choices: ["day", "night", "none"] }),
      // A `setRoundPhase` Phase's change to the Round in progress, and only that
      // Round (Kuonji Alice, Tamamo Goth; #294). Written by `io.setRoundPhase`,
      // read by `rules/environment.mjs#roundPhase` through the board.
      phaseOverride: new fields.SchemaField({
        phase: new fields.StringField({ required: false, nullable: true, initial: null, choices: ["day", "night"] }),
        round: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
      }, { required: false, nullable: true, initial: null }),

      // Re-rolled EVERY round, not once at setup (Ch. 41 Q32). Two lists, not
      // one: `baseOrder` is what the dice said and `turnOrder` is what is
      // actually played after Delay. Collapsing them would make Delay
      // cumulative -- each recomputation would delay from the already-delayed
      // position -- and a faction could be pushed to the back of the round by
      // one declaration (Ch. 25).
      baseOrder: new fields.ArrayField(new fields.StringField()),
      turnOrder: new fields.ArrayField(new fields.StringField()),

      // Faction id → positions delayed. Cleared at the start of each Round;
      // an individual entry is dropped at the end of the round it took effect
      // in (Ch. 04).
      delays: new fields.ObjectField({ required: true, initial: () => ({}) }),

      // Which factions have already taken their turn this Round. Delay may not
      // reorder them, and a faction that delays after acting has its Delay
      // applied next Round instead.
      takenThisRound: new fields.ArrayField(new fields.StringField()),

      // The War Rules (`rules/war-rules.mjs`): the War's Region, type,
      // ruleset, ◈, Round gates, timeouts, optional rules and Faction roster.
      // They live on the War rather than in world settings because a world
      // holds several Wars at once and a setting hit them all (2026-10-18).
      // Built from the one table, so a key, an initial value or a choice list
      // cannot drift between the schema, the wizard and the migration.
      ...warRuleFields(),
      homeBaseDepth: new fields.NumberField({ required: true, integer: true, initial: 3, min: 1 }),
      // The war's slot roster: which containers exist, who owns them, and what
      // is in each. An ObjectField for the same reason `resources` is one --
      // this is a shape the setup wizard owns, and a typed schema would have to
      // name every future field before the wizard could write one.
      containers: new fields.ArrayField(new fields.ObjectField()),


      // The Holy Grail (Ch. 29). `grailCounter` counted defeated Servants
      // and nothing ever incremented or read it; the rest of the state had
      // nowhere to live at all, so materialization could not happen.
      // The structured game log (Ch. 37). Chat is ephemeral in practice --
      // it scrolls, it gets cleared, and it interleaves with out-of-character
      // talk -- so the record that survives lives here. Bounded at 200 entries;
      // older ones flush to a JournalEntry, which is what keeps this document
      // from growing without limit (Ch. 07's RISK).
      log: new fields.ArrayField(new fields.ObjectField()),
      // The journal holding everything already flushed off `log`.
      logJournalId: new fields.StringField({ required: false, nullable: true, initial: null }),

      grailCounter: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
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

      // The GM's slot, which is always last in the order (Ch. 25). A flag
      // rather than a reserved faction id, because the GM is not a faction: it
      // owns no units and has no budget, it simply gets a turn.
      isGM: new fields.BooleanField({ initial: false }),

      budget: new fields.SchemaField({
        servantMoves: new fields.NumberField({ integer: true, initial: 4, min: 0 }),
        masterMoves: new fields.NumberField({ integer: true, initial: 3, min: 0 }),
        servantAttacks: new fields.NumberField({ integer: true, initial: 2, min: 0 }),
      }),
      delay: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
    };
  }
}
