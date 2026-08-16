# 22 — Data Models

Every `TypeDataModel` schema in the system. These are the contract between content, engine, and
persistence — the most consequential code in the project to get right, because changing a schema
later costs a migration (Ch. 39).

---

## 22.1 Custom data fields

Four domain types need their own `DataField` so that validation and cleaning happen at the
schema layer rather than scattered through the code.

### `RankField`

```js
export class RankField extends foundry.data.fields.StringField {
  constructor(options = {}) {
    super({ blank: true, nullable: true, initial: null, ...options });
  }

  _validateType(value) {
    if (value === null || value === "") return;         // unranked
    if (!Rank.isValid(value)) throw new Error(`"${value}" is not a valid Rank`);
  }

  initialize(value) {
    return value ? Rank.parse(value) : null;            // source string → Rank instance
  }

  toObject(value) {
    return value?.toString() ?? null;
  }
}
```

The `initialize`/`toObject` pair means `actor.system.parameters.str` is a live `Rank` object
with `.compare()` and `.steps`, while `_source` stays a plain `"A+"` string. This is exactly the
pattern v14's `ColorField` and `ForeignDocumentField` use.

### `TickField`

Same shape for durations: source `"1◈+⅔◈"`, initialized to a `TickExpr` with a `.resolve(tpr)`
method. Validation rejects unparseable expressions at write time, so a typo in content surfaces
as a document validation error naming the field, not as `NaN` in combat.

### `ResourceField`

```js
export class ResourceField extends foundry.data.fields.SchemaField {
  constructor(opts = {}) {
    super({
      value: new NumberField({ required: true, integer: true, min: 0, initial: opts.initial ?? 0 }),
      max:   new NumberField({ required: true, integer: true, min: 0, initial: opts.max ?? 0 }),
      base:  new NumberField({ required: true, integer: true, min: 0, initial: opts.max ?? 0 }),
    }, opts);
  }

  static validateJoint(data) {
    if (data.value > data.max)
      throw new Error(`Resource value ${data.value} exceeds max ${data.max}`);
  }
}
```

The `base` field exists so `max` modifiers are reversible: `Max HpUp` raises `max`, and when it
expires `max` returns to `base` plus whatever other modifiers remain.

### `PredicateField`

An `ArrayField` of predicate expressions, validated against the predicate grammar (Ch. 24) at
write time. A malformed predicate is a content bug and should never reach runtime.

---

## 22.2 Shared actor schema mixins

Rather than a god-schema with nullable fields, common groups are composed:

```js
// data/actor/_shared.mjs
const f = foundry.data.fields;

export const identitySchema = () => ({
  trueName:     new f.StringField({ blank: true }),
  nameRevealed: new f.BooleanField({ initial: false }),
  factionId:    new f.StringField({ blank: true }),
  biography:    new f.HTMLField({ textSearch: true }),
  notes:        new f.HTMLField(),
  attributes:   new f.SetField(new f.StringField({ blank: false })),
  region:       new f.SetField(new f.StringField({ blank: false })),
});

export const positionSchema = () => ({
  facing:    new f.NumberField({ integer: true, min: 0, max: 315, initial: 0, step: 45 }),
  footprint: new f.SchemaField({
    w: new f.NumberField({ integer: true, min: 1, initial: 1 }),
    h: new f.NumberField({ integer: true, min: 1, initial: 1 }),
  }),
});

export const combatStatsSchema = () => ({
  parameters: new f.SchemaField({
    base:    new f.SchemaField(Object.fromEntries(
      PARAM_KEYS.map(k => [k, new RankField({ initial: "E" })]))),
    granted: new f.SchemaField(Object.fromEntries(
      PARAM_KEYS.map(k => [k, new f.NumberField({ integer: true, initial: 0 })]))),
  }),

  health:  new ResourceField({ max: 1000 }),
  agility: new ResourceField({ max: 15 }),
  luck:    new ResourceField({ max: 10 }),

  mov:   new f.NumberField({ integer: true, min: 1, initial: 5 }),
  range: new f.SchemaField({
    panels:  new f.NumberField({ integer: true, min: 1, initial: 1 }),
    targets: new f.NumberField({ integer: true, min: 1, initial: 1 }),
  }),
  detect: new f.NumberField({ integer: true, min: 0, initial: 0 }),

  baseAttack: new f.SchemaField({
    str: new f.NumberField({ integer: true, min: 0, initial: 100 }),
    mag: new f.NumberField({ integer: true, min: 0, initial: 100 }),
  }),

  normalAttack: new f.SchemaField({
    mode: new f.StringField({ choices: ["fixed", "combined", "byRange"], initial: "fixed" }),
    component: new f.StringField({ choices: ["str", "mag"], initial: "str" }),
    strFactor: new f.NumberField({ initial: 1 }),
    magFactor: new f.NumberField({ initial: 0 }),
    bands: new f.ArrayField(new f.ObjectField()),      // byRange
    element: new f.StringField({ blank: true }),
  }),

  resources: new f.TypedObjectField(new ResourceField()),
});

export const turnStateSchema = () => ({
  turnState: new f.SchemaField({
    moved:        new f.BooleanField({ initial: false }),
    movedPanels:  new f.NumberField({ integer: true, initial: 0 }),
    moveSegments: new f.NumberField({ integer: true, initial: 0 }),
    attacked:     new f.BooleanField({ initial: false }),
    usedActiveSkill: new f.BooleanField({ initial: false }),
    acted:        new f.BooleanField({ initial: false }),
    countedAgainstBudget: new f.StringField({ blank: true, nullable: true, initial: null }),
    reactionsThisPhase:   new f.SetField(new f.StringField()),
    pausedTicks:  new f.NumberField({ integer: true, initial: 0 }),   // Stop (Ch. 10 §10.4)
  }),
});
```

`f.TypedObjectField` (v14) is exactly right for `resources` — an open map of string keys to a
uniform value schema, validated per-entry.

---

## 22.3 `ServantData`

```js
export class ServantData extends foundry.abstract.TypeDataModel {
  static LOCALIZATION_PREFIXES = ["FGT.Servant"];

  static defineSchema() {
    return {
      ...identitySchema(),
      ...positionSchema(),
      ...combatStatsSchema(),
      ...turnStateSchema(),

      servantClasses: new f.SetField(
        new f.StringField({ choices: Object.keys(FGT.servantClasses) }),
        { initial: ["saber"] }),

      alignment: new f.SchemaField({
        order:    new f.StringField({ choices: ["lawful", "neutral", "chaotic"], initial: "neutral" }),
        morality: new f.StringField({ choices: ["good", "neutral", "evil", "mad"], initial: "neutral" }),
      }),

      sustainability: new f.SchemaField({
        base:      new TickField({ nullable: true, initial: "2◈" }),   // null = N/A
        remaining: new f.NumberField({ integer: true, nullable: true, initial: null }),
      }),

      contract: new f.SchemaField({
        masterId:     new f.StringField({ blank: true, nullable: true, initial: null }),
        bondedOnTurn: new f.NumberField({ integer: true, initial: 0 }),
        refusesContractFrom: new f.SetField(new f.StringField()),   // Kill Humans (Ch. 17 §17.7)
      }),

      linkedGroup: new f.SchemaField({
        groupId:   new f.StringField({ blank: true, nullable: true, initial: null }),
        role:      new f.StringField({ blank: true }),              // "castor" | "pollux"
      }, { nullable: true, initial: null }),

      // Bookkeeping the engine writes
      homeBase: new f.SchemaField({
        consecutiveRounds:    new f.NumberField({ integer: true, initial: 0 }),
        combatInBaseThisRound: new f.BooleanField({ initial: false }),
      }),
    };
  }

  prepareBaseData() {
    // Effective parameters = base shifted by granted steps.
    // Runs in BASE data so Active Effects can target the result.
    this.parameters.effective = {};
    for (const k of PARAM_KEYS) {
      this.parameters.effective[k] = this.parameters.base[k]?.shift(this.parameters.granted[k]);
    }
    // Base-attack adjustment from granted steps only (Ch. 05 §5.6).
    this.baseAttack.str += this.parameters.granted.str * 10;
    this.baseAttack.mag += this.parameters.granted.mag * 10;
  }

  prepareDerivedData() {
    // Rule elements have run by now (Ch. 23). Compute the last derived values.
    this.contract.state = this.parent.deriveContractState();
    this.zon            = this.parent.deriveZon();
    this.attributesClosed = closure(this.attributes);
    this.health.pct     = Math.round(100 * this.health.value / Math.max(1, this.health.max));
  }
}
```

### Why `parameters.effective` is computed in `prepareBaseData`

The v14 guidance is explicit: values an Active Effect might target belong in base data;
values that must see post-effect state belong in derived data. Parameters can be shifted by
effects (Kiritsugu's LUC `E → EX`), so the *effective* value must exist before effects run in
order for them to modify it, and anything reading parameters (ZON, Magic Resistance) must run
after — hence `zon` in derived data.

---

## 22.4 `MasterData`

```js
export class MasterData extends foundry.abstract.TypeDataModel {
  static LOCALIZATION_PREFIXES = ["FGT.Master"];

  static defineSchema() {
    return {
      ...identitySchema(),
      ...positionSchema(),
      ...combatStatsSchema(),
      ...turnStateSchema(),

      rank: new f.StringField({ choices: ["A", "B", "C", "D", "rankless"], initial: "C" }),
      essenceId: new f.StringField({ blank: true, nullable: true, initial: null }),

      commandSpells: new f.SchemaField({
        own:        new f.NumberField({ integer: true, min: 0, initial: 3 }),
        perServant: new f.TypedObjectField(
          new f.NumberField({ integer: true, min: 0, initial: 0 })),
      }),

      servantIds: new f.SetField(new f.StringField()),

      homeBase: new f.SchemaField({
        consecutiveRounds:     new f.NumberField({ integer: true, initial: 0 }),
        combatInBaseThisRound: new f.BooleanField({ initial: false }),
      }),
    };
  }

  prepareBaseData() {
    this.isHighRank = this.rank === "A" || this.rank === "B";
    this.baseAttack.mag = this.isHighRank ? 125 : 100;
  }

  prepareDerivedData() {
    // ZON per contracted Servant — the radius depends on the Servant's class.
    this.zonByServant = {};
    for (const sid of this.servantIds) {
      this.zonByServant[sid] = this.parent.computeZonFor(sid);
    }
    this.totalSpells = this.commandSpells.own
      + Object.values(this.commandSpells.perServant).reduce((a, b) => a + b, 0);
  }
}
```

`zonByServant` being a map rather than a scalar is the schema-level expression of Ch. 16 §16.3:
ZON is a property of the *pair*, not of either unit.

---

## 22.5 `PlatformData`

```js
export class PlatformData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new f.HTMLField(),
      ownerId: new f.StringField({ blank: true }),
      levelId: new f.StringField({ blank: true, nullable: true, initial: null }),

      health: new ResourceField({ max: 2500 }),
      agility: new f.NumberField({ integer: true, initial: 0 }),
      luck: new f.SchemaField({
        mode:  new f.StringField({ choices: ["own", "shared"], initial: "own" }),
        value: new f.NumberField({ integer: true, initial: 0 }),
      }),
      mov: new f.NumberField({ integer: true, initial: 0 }),
      range: new f.SchemaField({
        panels:  new f.NumberField({ integer: true, initial: 0 }),
        targets: new f.NumberField({ integer: true, initial: 1 }),
      }),
      baseAttack: new f.SchemaField({
        mode: new f.StringField({ choices: ["own", "owner"], initial: "own" }),
        str:  new f.NumberField({ integer: true, initial: 0 }),
        mag:  new f.NumberField({ integer: true, initial: 0 }),
      }),
      detect: new f.NumberField({ integer: true, initial: 0 }),

      footprint: new f.SchemaField({
        w: new f.NumberField({ integer: true, nullable: true, initial: 1 }),
        h: new f.NumberField({ integer: true, nullable: true, initial: 1 }),
      }, { nullable: true }),          // null = no ground footprint (Storm Border)

      facing: new f.NumberField({ integer: true, initial: 0, step: 90 }),
      capacity: new f.NumberField({ integer: true, nullable: true, initial: null }),
      passengers: new f.SetField(new f.StringField()),

      boarding: new f.SchemaField({
        formula:   new f.StringField({ initial: "1d12" }),
        successOn: new f.NumberField({ integer: true, initial: 12 }),
        modifiers: new f.ArrayField(new f.ObjectField()),
      }),

      crossLevel: new f.SchemaField({
        mayTargetOccupants:  new f.BooleanField({ initial: false }),
        requiresRanged:      new f.BooleanField({ initial: true }),
        forbidDirectlyBelow: new f.BooleanField({ initial: true }),
        aoePassengerFactor:  new f.NumberField({ initial: 1.0 }),
        aoeMastersImmune:    new f.BooleanField({ initial: false }),
      }),

      upkeep: new f.SchemaField({
        target:    new f.StringField({ choices: ["ownerMaster", "owner", "none"], initial: "none" }),
        amount:    new f.NumberField({ integer: true, initial: 0 }),
        trigger:   new f.StringField({ choices: ["roundEnd", "turnEnd"], initial: "roundEnd" }),
        deactivateAtOrBelow: new f.NumberField({ integer: true, nullable: true, initial: null }),
        supersedesNPCost: new f.BooleanField({ initial: false }),
      }),

      subZones: new f.ArrayField(new f.SchemaField({
        id:    new f.StringField(),
        shape: new f.ObjectField(),
        tags:  new f.SetField(new f.StringField()),
      })),

      // Fixed rules — declared as data so the sheet can show them
      acceptsEffects:        new f.BooleanField({ initial: false }),
      canReact:              new f.BooleanField({ initial: false }),
      canBeCountered:        new f.BooleanField({ initial: false }),
      countsTowardTurnBudget:new f.BooleanField({ initial: false }),
    };
  }
}
```

Note `acceptsEffects` and friends are stored fields rather than hardcoded class behaviour, so a
GM homebrewing a platform that *can* be buffed does not need code.

---

## 22.6 `AbilityData`

The largest schema, because it carries the phase system.

```js
export class AbilityData extends foundry.abstract.TypeDataModel {
  static LOCALIZATION_PREFIXES = ["FGT.Ability"];

  static defineSchema() {
    return {
      description: new f.HTMLField({ textSearch: true }),
      rank: new RankField(),
      source: new f.StringField({
        choices: ["class", "personal", "np", "magicCrest", "granted"], initial: "personal" }),

      // Type flags
      hasPassive: new f.BooleanField({ initial: false }),
      hasActive:  new f.BooleanField({ initial: true }),
      isSpell:    new f.BooleanField({ initial: false }),
      isNP:       new f.BooleanField({ initial: false }),
      categorizedAsNP: new f.BooleanField({ initial: false }),
      dealsDamage:new f.BooleanField({ initial: false }),
      countsAs:   new f.SetField(new f.StringField()),          // "divinity"

      // NP scoping — three independent flags (Ch. 15 §15.5)
      scoping: new f.SchemaField({
        cooldown: new f.StringField({ choices: ["np", "skill"], initial: "skill" }),
        damage:   new f.StringField({ choices: ["np", "skill"], initial: "skill" }),
        seal:     new f.StringField({ choices: ["np", "skill", "none"], initial: "skill" }),
      }),

      // Economy
      countsAsAttack: new f.BooleanField({ initial: false }),
      countsAsAct:    new f.BooleanField({ initial: true }),
      cooldown: new f.SchemaField({
        max:         new TickField({ nullable: true, initial: null }),
        usedOnTurn:  new f.NumberField({ integer: true, nullable: true, initial: null }),
        elapsed:     new f.NumberField({ integer: true, initial: 0 }),
      }),
      usesPerGame:  new f.NumberField({ integer: true, nullable: true, initial: null }),
      usesRemaining:new f.NumberField({ integer: true, nullable: true, initial: null }),
      usesPerRound: new f.NumberField({ integer: true, nullable: true, initial: null }),

      // Mode (Presence Concealment, Mad Enhancement) — Ch. 15 §15.6
      mode: new f.SchemaField({
        isMode:        new f.BooleanField({ initial: false }),
        active:        new f.BooleanField({ initial: false }),
        activatedOn:   new f.NumberField({ integer: true, nullable: true, initial: null }),
        minDuration:   new TickField({ nullable: true }),
        cooldownAfter: new TickField({ nullable: true }),
        cannotDeactivate: new f.BooleanField({ initial: false }),
        forcedActive:  new PredicateField(),        // Penthesilea's Hatred of Achilles
      }),

      // Channelled activation (HGoB) — Ch. 20 §20.4
      channel: new f.SchemaField({
        isChannelled: new f.BooleanField({ initial: false }),
        duration:     new TickField({ nullable: true }),
        startedOn:    new f.NumberField({ integer: true, nullable: true, initial: null }),
        interruptedBy:new f.SetField(new f.StringField()),
      }),

      // Gates
      timing: new f.SchemaField({
        window:    new f.StringField({ choices: TIMING_WINDOWS, initial: "ownTurn" }),
        appliesTo: new f.SetField(new f.StringField()),
      }),
      requirements: new f.ArrayField(new f.ObjectField()),
      costs:        new f.ArrayField(new f.ObjectField()),
      blockedBy:         new f.SetField(new f.StringField()),
      alsoTriggers:      new f.SetField(new f.StringField()),
      sameTurnExclusive: new f.SetField(new f.StringField()),

      // Behaviour
      passiveRules: new f.ArrayField(new f.ObjectField()),
      phases:       new f.ArrayField(new f.ObjectField()),

      // Copying (Scáthach) — Ch. 15 §15.7
      copyable: new f.SchemaField({
        allowed: new f.BooleanField({ initial: true }),
        reason:  new f.StringField({ blank: true }),
      }),
      copiedFrom: new f.StringField({ blank: true, nullable: true, initial: null }),
      grantedBy:  new f.StringField({ blank: true, nullable: true, initial: null }),
      grantExpiry:new f.NumberField({ integer: true, nullable: true, initial: null }),
    };
  }

  static validateJoint(data) {
    if (data.mode.isMode && data.channel.isChannelled)
      throw new Error("An ability cannot be both a mode and channelled.");
    if (data.isNP && data.source !== "np")
      throw new Error("isNP requires source: 'np'.");
    if (data.hasActive && !data.phases.length && !data.mode.isMode)
      throw new Error("An active ability must define at least one phase.");
  }
}
```

### `ObjectField` for phases and rules — a deliberate compromise

`phases`, `passiveRules`, `requirements`, and `costs` are `ObjectField`s (unvalidated bags)
rather than discriminated schemas. Foundry's `DataField` system has no clean discriminated-union
field, and expressing "one of fourteen phase shapes" through it would be extremely verbose.

**DECISION.** Validate these at the **content build** (`tools/validate-content.mjs`) and at
**registry load**, not in the schema. The build refuses to compile a pack containing an invalid
phase, and `devMode` re-validates at world setup. This gets full validation with far less
schema code, at the cost of runtime-authored abilities (via the sheet) being validated slightly
later. The ability sheet performs the same validation on submit, so a GM never persists an
invalid ability either.

---

## 22.7 `EffectData` (on `ActiveEffect`)

```js
export class EffectData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      defId: new f.StringField({ required: true, blank: false }),

      magnitude: new f.SchemaField({
        base: new f.NumberField({ nullable: true, initial: null }),
        np:   new f.NumberField({ nullable: true, initial: null }),
      }),
      stage: new f.NumberField({ integer: true, min: 1, initial: 1 }),

      duration: new f.SchemaField({
        expr:       new TickField({ nullable: true }),
        startTurn:  new f.NumberField({ integer: true, initial: 0 }),
        expiryTurn: new f.NumberField({ integer: true, nullable: true, initial: null }),
        uses:          new f.NumberField({ integer: true, nullable: true, initial: null }),
        usesRemaining: new f.NumberField({ integer: true, nullable: true, initial: null }),
        consumedByAttacks: new f.SetField(new f.StringField()),   // idempotency (Ch. 07 §7.5)
      }),

      source: new f.SchemaField({
        unitId:    new f.StringField({ blank: true }),
        abilityId: new f.StringField({ blank: true }),
        kind:      new f.StringField({
          choices: ["skill", "np", "attack", "environment", "self", "gm"], initial: "skill" }),
        rank: new RankField(),                    // for highestOnly comparisons
      }),

      flags: new f.SchemaField({
        unremovable: new f.BooleanField({ initial: false }),
        hidden:      new f.BooleanField({ initial: false }),
      }),

      payload: new f.ObjectField(),               // Shield hp, Repel value, Decoy source…
      groupKey: new f.StringField({ blank: true }),   // stack grouping (GAO, Proliferation)
    };
  }

  prepareDerivedData() {
    this.def = CONFIG.FGT.effects.get(this.defId);   // throws on unknown (principle P4)
  }
}
```

`suppressed` is **not** stored — it is recomputed each derived-data pass (Ch. 11 §11.4).
Storing it would produce stale state after any change and would generate a document write per
suppression change.

---

## 22.8 `MatchData` (on `Combat`)

```js
export class MatchData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ruleset: new f.SchemaField({
        turnsPerRound: new f.NumberField({ integer: true, min: 2, initial: 3 }),
        boardSize:     new f.NumberField({ integer: true, initial: 13 }),
        difficulty:    new f.StringField({
          choices: ["beginner", "intermediate", "expert", "lunatic"], initial: "expert" }),
        region:        new f.StringField({ blank: true, nullable: true, initial: null }),
        variant:       new f.StringField({ initial: "greatHolyGrailWar" }),
        locked:        new f.BooleanField({ initial: false }),
      }),

      globalTurn: new f.NumberField({ integer: true, initial: 0 }),
      startedAtDay: new f.BooleanField({ initial: true }),

      baseOrder: new f.ArrayField(new f.StringField()),         // combatant ids
      delays:    new f.TypedObjectField(new f.NumberField({ integer: true })),
      takenThisRound: new f.SetField(new f.StringField()),

      factions: new f.ArrayField(new f.SchemaField({
        id:     new f.StringField(),
        name:   new f.StringField(),
        colour: new f.ColorField(),
        homeBaseRegionIds: new f.SetField(new f.StringField()),
        playerIds: new f.SetField(new f.StringField()),
      })),

      grail: new f.SchemaField({
        threshold:      new f.NumberField({ integer: true, initial: 9 }),
        defeatedCount:  new f.NumberField({ integer: true, initial: 0 }),
        materialized:   new f.BooleanField({ initial: false }),
        position:       new f.ObjectField({ nullable: true, initial: null }),
        contest:        new f.TypedObjectField(new f.NumberField({ integer: true })),
        destroyed:      new f.BooleanField({ initial: false }),
      }),

      journal: new f.ArrayField(new f.ObjectField()),           // undo journal (Ch. 18 §18.7)
      log:     new f.ArrayField(new f.ObjectField()),           // the audit trail (Ch. 30)
      schemaVersion: new f.NumberField({ integer: true, initial: 1 }),
    };
  }

  prepareDerivedData() {
    const tpr = this.ruleset.turnsPerRound;
    this.round      = Math.floor(this.globalTurn / tpr) + 1;
    this.turnInRound= this.globalTurn % tpr;
    this.phase      = ((this.round % 2 === 1) === this.startedAtDay) ? "day" : "night";
    this.turnOrder  = computeTurnOrder(this.baseOrder, this.delays, this.takenThisRound);
  }
}
```

`round` and `phase` derived from `globalTurn` rather than stored is the payoff for Ch. 07's
design: there is exactly one source of truth for time.

**RISK.** `journal` and `log` are unbounded arrays on a single document. A long match could
produce thousands of entries and every append rewrites the field. Mitigation: `journal` is
truncated to the current turn (undo does not cross turns anyway), and `log` is capped at the
last N entries in the document with the full history written to a `JournalEntry` in batches.
Ch. 30 covers it.

---

## 22.9 `PlayerCombatantData` (on `Combatant`)

Combatants are **players**, not tokens (Ch. 25).

```js
export class PlayerCombatantData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      userId:    new f.StringField({ required: true, blank: false }),
      factionId: new f.StringField({ blank: true }),

      budget: new f.SchemaField({
        servantMoves:   new f.NumberField({ integer: true, min: 0, initial: 0 }),
        masterMoves:    new f.NumberField({ integer: true, min: 0, initial: 0 }),
        servantAttacks: new f.NumberField({ integer: true, min: 0, initial: 0 }),
      }),

      isGM: new f.BooleanField({ initial: false }),
    };
  }

  prepareDerivedData() {
    const max = CONFIG.FGT.budgets;
    this.remaining = {
      servantMoves:   max.servantMoves   - this.budget.servantMoves,
      masterMoves:    max.masterMoves    - this.budget.masterMoves,
      servantAttacks: max.servantAttacks - this.budget.servantAttacks,
    };
    this.user = game.users.get(this.userId);
  }
}
```

Following the prototype's finding, we do **not** add a `type` discriminator to distinguish
player combatants from token combatants — the presence of `system.userId` is the discriminator.
v14's typed combatants make this cleaner than the prototype's version: `Combatant` genuinely has
a subtype now.

---

> **Note (Ch. 45 C4).** `NPFieldBehavior` carries the whole six-axis bounded-field model from
> Ch. 43 — `geometry`, `membership`, `isolation`, `interior`, `extension`, `vulnerabilities`,
> plus `npTags` and a `state` object holding the per-unit escape history the veteran rule needs.
> `NoblePhantasmData` gains a `field` object for the Noble Phantasm that creates one.

> **Note (Ch. 45 C3).** `PlatformData` now carries the full four-axis cross-level protection
> model from Ch. 20 §20.7 (`occupantTargeting`, `requiresBoarding`, `aoePassengerFactor`,
> `aoeMastersImmune`, `outboundTargeting`, `forbidDirectlyBelow`), plus `ownerId` and its own
> `level`. The previous three-field version could not express the Golden Hind, whose Masters take
> no area damage while its other passengers take half.

## 22.10 Region behaviour schemas

> **Implemented** in `module/data/regions.mjs` and registered in `fgt.mjs` as
> `CONFIG.RegionBehavior.dataModels`. All four types — `terrain`, `homeBase`, `npField`,
> `platform` — have been declared in `system.json` since the manifest was written and **none of
> them had a data model**, so an `fgt.terrain` behaviour added to a Region carried no type, no
> duration and no meaning. `npField` and `platform` are declared with their schemas but their
> rules are still Ch. 43 and Ch. 20 work.

```js
export class HomeBaseBehavior extends foundry.data.regionBehaviors.RegionBehaviorType {
  static defineSchema() {
    return {
      events: this._createEventsField({
        events: [CONST.REGION_EVENTS.TOKEN_ENTER, CONST.REGION_EVENTS.TOKEN_EXIT] }),
      factionId: new f.StringField({ required: true, blank: false }),
      isSecondary: new f.BooleanField({ initial: false }),      // the HGoB
    };
  }

  async _handleRegionEvent(event) {
    const actor = event.data.token.actor;
    if (!actor) return;
    if (event.name === CONST.REGION_EVENTS.TOKEN_ENTER) {
      Hooks.callAll("fgt.homeBaseEntered", actor, this.factionId);
    } else {
      await actor.update({ "system.homeBase.consecutiveRounds": 0 });
      Hooks.callAll("fgt.homeBaseExited", actor, this.factionId);
    }
  }
}
```

`TerrainBehavior` carries a tag set; `NPFieldBehavior` carries an owner, an expiry turn, and a
phase list applied on `tokenTurnEnd` inside the region; `PlatformBehavior` links a region to a
Scene Level.

---

## 22.11 What lives in flags rather than schemas

Almost nothing. The v14 guidance is unambiguous — *"Storing character data in flags: no
validation, no migration, no effects"* — and we follow it.

The exceptions, all transient:

| Flag | On | Purpose |
|---|---|---|
| `flags.fgt.combatProcess` | `ChatMessage` | Serialized ladder state (Ch. 12 §12.12) |
| `flags.fgt.targetingPreview` | client-side only | Never persisted |
| `flags.fgt.commandOffer` | `ChatMessage` | The interrupt offer payload |

Chat messages are the right home for these: they are per-exchange, disposable, and their
permission model (whisper targets) is exactly what the reaction protocol needs.

---

## 22.12 Summary of decisions

| # | Decision |
|---|---|
| D22.1 | Four custom `DataField`s (`RankField`, `TickField`, `ResourceField`, `PredicateField`) so domain validation happens at the schema layer. |
| D22.2 | Actor schemas compose from mixins; no god-schema with nullable fields. |
| D22.3 | `parameters.effective` is computed in `prepareBaseData` so effects can target it; ZON and closures in `prepareDerivedData`. |
| D22.4 | `ResourceField` carries `base` so `max` modifiers are reversible. |
| D22.5 | Phases, rules, requirements and costs are `ObjectField`s validated at build and registry-load time, not in the schema. |
| D22.6 | Effect `suppressed` is never stored; it is recomputed per derived-data pass. |
| D22.7 | `Combat` stores only `globalTurn`; round, turn-in-round, and day/night phase are derived. |
| D22.8 | Combatants are players; `system.userId` is the discriminator. |
| D22.9 | Platform rule switches (`acceptsEffects`, `canReact`) are data, not hardcoded behaviour. |
| D22.10 | Flags hold only transient, per-message state. |

---

**Next:** [23 — Documents and Derived Data](23-documents-and-derived-data.md)
