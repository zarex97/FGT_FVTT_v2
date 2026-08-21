# 24 — The Rules Engine

> **Implementation notes (Ch. 45).** Three additions to the vocabulary since this chapter was
> written, each driven by content that could not otherwise be authored:
>
> | Addition | For |
> |---|---|
> | **`Compulsion`** (Group 4) | Penthesilea's *Hatred of Achilles* — a positional forced target |
> | **`ApplicationChance` executor** (Group 6) | *Off.Debuff ResUp*; the key existed, the executor did not |
> | **`roll:` on `DamageModifier`** | *Goddess of War* — a magnitude rolled per damage event rather than fixed before the attack |
>
> The **roll option vocabulary** also grew: `skill:`, `skillActive:` and `region:`. `Appendix B`
> has predicated on `target:skill:divinity` since the tables were transcribed and **nothing ever
> emitted a `skill:` option**, so that clause could not fire in either direction. Options are now
> built in `module/rules/options.mjs`, in the rules layer, where they can be tested without
> Foundry — which is the only reason the gap lasted as long as it did.
>
> One more: `contributionsOf` passed an **empty option set**, so every `self:` predicate in the
> system was unsatisfiable.
>
> **This chapter's key list is maintained twice** — here in prose, and as `RULE_ELEMENT_KEYS` in
> `tools/lib/content.mjs` against `EXECUTORS` in `module/rules/elements.mjs`. The two code lists
> are held against each other by `test/unit/elements.test.mjs` in both directions; a key in one
> and not the other is a defect either way round.

The rule element system: how declarative data becomes behaviour. This is the mechanism that
makes principle P2 (*declarative first, imperative as escape hatch*) real, and it is the single
biggest determinant of how expensive Servant #47 will be to author.

---

## 24.1 The idea

A **rule element** is a small, typed, declarative object attached to an ability or an effect
that describes one modification to the world.

```yaml
- key: DamageModifier
  value: 40
  npValue: 30
  mode: percent
  predicate: ["self:attacking"]
```

That is Karna's *Flash of the Sun God* `Atk Up` in its entirety. No JavaScript.

The design is directly inspired by PF2e's rule elements, which have proven the model at scale —
thousands of items, authored by non-programmers, with the engine unchanged. The differences are
domain-specific: our modifiers carry NP variants, our predicates read board geometry, and our
events are turn-based rather than encounter-based.

---

## 24.2 The base class

```js
export class RuleElement {
  static KEY = "";                    // registry key
  static SCHEMA = {};                 // validated at content build

  constructor(spec, source) {
    this.spec = spec;
    this.source = source;             // the Item or ActiveEffect that owns it
    this.priority = spec.priority ?? this.constructor.DEFAULT_PRIORITY;
    this.predicate = Predicate.parse(spec.predicate ?? []);
    this.suppressed = false;
  }

  /** Does this element apply right now? */
  test(options) { return this.predicate.test(options); }

  /** Modify the actor during derived-data preparation. Default: no-op. */
  apply(actor, ctx) {}

  /** Contribute to a damage computation. Default: no-op. */
  contributeDamage(ctx, bag) {}

  /** Contribute to a check. Default: no-op. */
  contributeCheck(ctx, bag) {}

  /** Modify targeting resolution. Default: no-op. */
  contributeTargeting(spec, ctx) {}

  /** Aura declaration, if any. */
  get aura() { return this.spec.aura ?? null; }

  /** Is this an automatic effect (suppressible by Addle)? */
  get automatic() { return this.spec.automatic ?? false; }
}
```

Five contribution points, because F/GT modifiers genuinely act at five different places. An
element implements only the ones it needs.

---

## 24.3 The element catalogue

Roughly 30 elements cover the entire reference set. Grouped by contribution point.

### Group 1 — Stat and derived-value modifiers (`apply`)

| Key | Purpose | Example content |
|---|---|---|
| `StatModifier` | Modify MOV, Range, Detect, base attack, max health/agility/luck | Mad Enhancement's `MOV +2` |
| `RankShift` | Shift or set a parameter rank, with explicit reversible stat deltas | Semiramis aboard HGoB |
| `ResourceMax` | Change a resource's cap | Mannanán Holder Mode: 5 → 7 tokens |
| `ZonModifier` | Modify the Master's ZON for this Servant | Independent Action |
| `SustainabilityModifier` | Modify Sustainability | High Rank Master `+1◈` |
| `GrantAbility` | Add an ability with a lifetime | Semiramis's *Double Summon* granting DSC |
| `GrantAttribute` | Add an attribute | future content |
| `NPAvailabilityShift` | Shift the NP round gate | Master essence `Kaleidoscope` |

### Group 2 — Damage contributors (`contributeDamage`)

| Key | Stage | Purpose |
|---|---|---|
| `DamageModifier` | 4 | The additive bucket: Atk Up, Def Up, Atk Dwn, Def Dwn, and every percentage in the game |
| `DamageComponentModifier` | 5 | Asymmetric STR/MAG modifiers (Mad Enhancement's halving) |
| `FlatDamage` | 7 | Divinity, Dmg Boost, Avenger's counter bonus |
| `FlatReduction` | 12 | Dmg Cut, Battle Continuation, Territory Creation defence |
| `Resistance` | 11 | Magic Resistance and its rank comparison |
| `TotalDamageModifier` | 15 | Anything whose text says "Total Damage" |
| `DamageNegation` | 0 / 16 | Invuln, Anti-Purge, Substitution, Freeze absorption |
| `CritModifier` | 3 | Crit chance, crit damage, G.Crit, No Crit, Over Crit |
| `IgnoreDefense` | 4 | Ignore Def, Pierce |
| `ElementTag` | 0 | Tag a portion of damage with an element |
| `Multihit` | — | Declare an attack hits N times |

`DamageModifier` alone covers perhaps 60% of the reference set's content. Its schema:

```yaml
key: DamageModifier
value: 40                # magnitude, percent
npValue: 30              # magnitude when the attack is an NP (optional)
direction: dealt|taken   # attacker-side or defender-side
includesNP: true         # if true, npValue is ignored and value applies to NP too
predicate: [...]
```

### Group 3 — Check contributors (`contributeCheck`)

| Key | Purpose |
|---|---|
| `CheckModifier` | Add to or subtract from a named roll (Evade, Luck Check, Block) |
| `ForceCheckTable` | Force the favourable/unfavourable table (Agility Boost, Mad Enhancement) |
| `AutoSucceedCheck` | Dodge, Insight's 50% |
| `ForbidReaction` | Cannot Block (Invuln), cannot Evade (Berserk), cannot React (Accel) |
| `BlockModifier` | Block Up, doubled-vs-NP |

### Group 4 — Targeting contributors (`contributeTargeting`)

| Key | Purpose |
|---|---|
| `RangeModifier` | Range +N, or an absolute override for one Combat Process |
| `TargetingRestriction` | Decoy's constraint, Berserk's nearest-enemy rule |
| `TargetabilityModifier` | Presence Concealment's untargetability, Master protection |
| `ForceTarget` | Karna's *Fated Rivals*, Penthesilea's *Hatred of Achilles* |
| `Compulsion` | The positional form of the above: forced targets while somebody is standing nearby |

> **Status.** `Compulsion` is **implemented** (`module/rules/compulsion.mjs`) and the targeting
> resolver reads it at step 4b, narrowing a compelled unit's candidates rather than erroring —
> the compulsion does not make the attack illegal, it makes the *choice* illegal.
>
> The other four keys in this group are still **collected with no reader**: `TargetingModifier`,
> `ForceTarget`, `Decoy` and `TargetabilityModifier` write keys `resolveTargets` does not
> consult. `Compulsion` exists because Penthesilea needed the positional case and `ForceTarget`
> could not express "while a Greek Male is within 4 panels" — an applied effect would need a
> position-watcher writing on every move.
>
> A compulsion's test names the **other** unit, so it is authored as `targetPredicate`, not
> `predicate`. `predicate` gates whether the element applies at all and is evaluated at
> collection time against its owner, where no other unit is in scope — writing it there makes the
> element vanish silently.

### Group 5 — Event handlers (`OnEvent`)

One element, many uses. It is the most powerful and most-used element after `DamageModifier`.

```yaml
- key: OnEvent
  event: damageStepEnd
  predicate: ["self:wasSuccessfullyAttacked"]
  automatic: true                    # suppressible by Addle
  then:
    - { key: StatDelta, stat: agility, delta: -1 }
```

> **Status.** Implemented. `OnEvent` normalizes at **collection time** into
> `{events, actions, automatic, abilityId, source}` — `events` always a list, and every
> rank-dependent table already resolved, because rank is in scope there and nowhere downstream.
> `scheduler.fireEvent` dispatches the actions. An action the dispatcher does not understand
> **logs itself by name** rather than resolving silently.
>
> A `revive:` shorthand desugars into a `Revive` action; it is authored separately because it
> carries a cooldown table alongside its roll.
>
> Dice keep the "caller rolls" contract: `fireEvent` is pure and reads totals from `ctx.rolls`,
> and `pendingRolls(unit, event)` tells the impure caller which formulas to roll first — so the
> attack flow does not have to know what Battle Continuation is.

Supported events: every hook in Appendix E. The `then` array is a list of **actions**, which are
a different (smaller) vocabulary from rule elements:

| Action | Purpose |
|---|---|
| `StatDelta` | Change a stat |
| `ApplyEffect` | Apply an effect |
| `RemoveEffect` | Remove effects by selector |
| `ResourceDelta` | Change a resource |
| `CooldownDelta` | Change a cooldown |
| `Damage` | Deal damage (fixed or formula) |
| `Heal` | Restore health |
| `Move` | Forced movement |
| `Attack` | Trigger an attack (counters, Kiritsugu's suppression fire) |
| `Summon` | Create a summon |
| `Message` | Post to chat |
| `Script` | The escape hatch |

### Group 6 — Suppression and meta

| Key | Purpose |
|---|---|
| `Suppress` | Petrify, Pigify, Toad, Addle (Ch. 11 §11.4) |
| `Immunity` | Debuff Immune and its variants, named-effect immunity |
| `ApplicationChance` | Debuff ChUp/ResUp, Item Construction, Magic Resistance's clause 2 |

> **Status.** `ApplicationChance` is **implemented** as of the Penthesilea conversion. It had
> been named in this table and accepted by the content validator since the tables were
> transcribed, with **no executor** — and `effect-applier` read a `ctx.resist` that **no caller
> ever supplied**, so the resistance path was dead at both ends. Contributions now fill an
> `applicationChances` bucket, the snapshot carries it, and `applyEffect` reads it off the target.
>
> `Suppress`, `StackingOverride` and `ImmunityDowngrade` remain collected-only.
| `StackingOverride` | Rare per-content stacking changes |
| `Aura` | Wraps another element with a radius and relation filter |

### Group 7 — The escape hatch

```yaml
- key: Script
  fn: "semiramis.hgobActivation"
  args: { constructionRequired: 100 }
```

Scripts are registered functions, not `eval`'d strings:

```js
CONFIG.FGT.scripts["semiramis.hgobActivation"] = async (ctx, args) => { /* … */ };
```

A closed registry means content cannot execute arbitrary code from a compendium, which matters
because compendia are shared between users. **DECISION.** No `eval`, no `new Function`, ever.
A script id that is not registered fails the content build.

**Target:** ≤ 15% of the reference set's abilities need a `Script` element. The candidates are
Semiramis's HGoB construction and activation, Heracles's God Hand attack-recording, Mannanán's
Fragarach NP cancellation, Nemo's Zero Sail, and Scáthach's Wisdom of Dún Scáith copy setup.
Five out of roughly seventy abilities — about 7%.

---

## 24.4 Predicates

A predicate is a boolean expression over **roll options** — a flat set of strings describing the
current context.

### Roll options

```
self:type:servant
self:class:caster
self:attribute:divine
self:attribute:large
self:effect:madEnhancement
self:mode:presenceConcealment
self:inOwnHomeBase
self:inZon
self:acted
self:health:below:30
self:resource:fragarachTokens:gte:3
self:skill:divinity
self:skill:divinity:rank:a

target:type:master
target:attribute:divine
target:relation:enemy
target:effect:burn
target:parameter:mag:gte:b
target:distance:1

attack:kind:np
attack:kind:normal
attack:element:fire
attack:isAoE
attack:rank:a+
attack:component:mag

board:phase:night
board:round:gte:6
board:region:middleEast

check:kind:evade
check:vsNP
```

### When a predicate can be answered

Contributions are collected **per unit**, and at that moment only that unit's own options exist:
there is no target and no attack yet. A predicate naming `target:` or `attack:` therefore cannot
be answered at collection time, and testing it there answers **false** — which drops the element
for ever rather than deferring it.

That is what happened, for the whole life of the project. Penthesilea's *Goddess of War* is gated
on `attack:kind:normal` and never fired on a Normal Attack; `NP DmUp` is gated on `attack:kind:np`
and raised no Noble Phantasm's damage; Scáthach's *God Slayer* is gated on the target's Attributes
and added nothing against a Divine Unit. Three shipped abilities, one line. The JSDoc on
`contributionsOf` had claimed the deferral happened since it was written.

A predicate is now classified at collection: one that names only the owner is **answered** and the
modifier carries `predicate: null`; one that names anybody else is **deferred**, travelling on the
modifier for the damage pipeline to answer with the full option set. Deferral is all-or-nothing —
a predicate is an implicit AND, so deferring the whole clause is equivalent to splitting it (the
pipeline has the owner's options too) and splitting would need the two halves kept in step through
every executor.

The rule of thumb for an author: **anything about somebody else is free**; the engine works out
when to ask.

Two options were added for Magic Resistance's terminal ladder, both properties of the incoming
attack rather than of the bearer: `attack:component:str|mag`, and `attack:ignoresMagicResistance`.
Neither was emitted before, so *"unless … from an Attack/Attack Skill/Spell/NP that deals STR
damage or that is not affected by Magic Resistance"* could not be written at all.

Options are built once per operation by `OptionBuilder` and passed to every predicate
evaluation. Building them is O(effects + abilities + attributes) per unit, ~1 ms, and cached
with the snapshot.

### The grammar

```ts
type Predicate = Array<Statement>;      // implicit AND

type Statement =
  | string                                        // option must be present
  | { not: Statement }
  | { and: Statement[] }
  | { or:  Statement[] }
  | { nand: Statement[] } | { nor: Statement[] }
  | { gte: [ValueRef, ValueRef] }                 // numeric comparison
  | { gt:  [ValueRef, ValueRef] }
  | { lte: [ValueRef, ValueRef] }
  | { lt:  [ValueRef, ValueRef] }
  | { eq:  [ValueRef, ValueRef] }
  | { rankGte: [RankRef, RankRef] }               // rank-aware comparison
  | { rankEq:  [RankRef, RankRef] }
  | { anyOf: string[] };                          // at least one option present

type ValueRef = number | string;                  // "@self.health.value", "@target.mov"
```

Examples from the reference set:

```yaml
# Nemo's Great Ram Nautilus: +150% vs Large
predicate: ["target:attribute:large"]

# Scáthach's God Slayer: vs Undead or Divine
predicate: [{ anyOf: ["target:attribute:undead", "target:attribute:divine"] }]

# Karna's Brahmastra: 4x if NO target parameter exceeds Karna's
predicate:
  - { nor: [
      { rankGte: ["@target.parameters.str", "@self.parameters.str+1"] },
      { rankGte: ["@target.parameters.end", "@self.parameters.end+1"] },
      { rankGte: ["@target.parameters.agi", "@self.parameters.agi+1"] },
      { rankGte: ["@target.parameters.mag", "@self.parameters.mag+1"] },
      { rankGte: ["@target.parameters.luc", "@self.parameters.luc+1"] }] }

# Van Gogh's Existence Outside The Domain, clause 2
predicate: ["target:skill:madEnhancement"]

# Nemo's Poseidon's Protection, passive 2
predicate: [{ anyOf: ["self:terrain:waterside", "self:terrain:imaginaryNumbers"] }]

# Penthesilea's Howl of the War God, effect 2
predicate: ["target:attribute:male", "target:region:greece"]
```

The Karna one is the most complex predicate in the reference set, and it fits. That is the
evidence that the grammar is sufficient.

### Why a data grammar rather than functions

Three reasons, in order of importance:

1. **Content is data.** A predicate expressed as a function cannot live in a compendium, be
   edited in a sheet, be validated at build time, or be serialized into an audit trail.
2. **Explainability.** A failed predicate can be rendered as *"requires: target has the Large
   attribute (target does not)"*. A function can only say "false".
3. **Safety.** Compendia are shared. Data cannot execute.

---

## 24.5 The expression language

Rule element values may be expressions rather than literals:

```yaml
value: "@self.range + 2"
amount: "@self.resources.proliferation.value"
magnitude: "5 * @self.resources.fragarachTokens.value"
duration: "1◈"
```

A tiny, total expression evaluator: arithmetic (`+ - * / %`), comparison, `min`/`max`/
`floor`/`ceil`/`clamp`, and `@`-prefixed path references into the snapshot. No function calls,
no property assignment, no loops.

```js
// Mannanán: "Crit Damage dealt is increased by 5% for every Fragarach Token"
- key: CritModifier
  aspect: damage
  value: "5 * @self.resources.fragarachTokens.value"
```

Parsed at content-build time into an AST, evaluated against the snapshot. Parse errors fail the
build. Evaluation errors (a missing path) throw with the element's source document named —
principle P4.

---

> **Implemented.** `@intentional` is enforced by `tools/lib/content.mjs`: an element with an
> explicit `priority` and no marker is a **build error**, and one with a marker is a **warning**
> naming the band the override lands in. The marker must be **prose** — `@intentional: true`
> states nothing, and a reviewer reading it a year later learns nothing either. The override
> itself only warns, because it is a supported feature that fewer than five elements need.

## 24.6 Priority and ordering

Elements apply in priority bands (Ch. 06 §6.11), with a stable secondary sort by source document
id so ordering is deterministic across clients.

| Band | Priority | Contains |
|---|---|---|
| 10 | Base | `RankShift`, permanent base changes |
| 20 | Additive | `StatModifier` add, `DamageModifier` |
| 30 | Aura collection | `Aura`-wrapped elements are gathered |
| 35 | Aura consumers | `Clarity` and anything reading aura magnitudes |
| 40 | Multiplicative | `StatModifier` multiply |
| 50 | Application chance | `ApplicationChance` |
| 60 | Absolute set | `StatModifier` set (Pigify, Toad, Holder Mode) |
| 70 | Immunity | `Immunity`, `DamageNegation` |
| 80 | Bounds | min/max clamps |
| 90 | Suppression | `Suppress` — runs last so it sees everything |

Content may override with an explicit `priority`, but doing so requires an `@intentional` marker
and the validator warns. In practice fewer than five elements in the reference set need it.

---

## 24.7 Worked example — Van Gogh's *Existence Outside The Domain*

The reference set's densest passive: five numbered clauses, three of which reference other
skills.

```yaml
id: van-gogh-existence-outside-the-domain
name: "Existence Outside The Domain"
rank: A
source: class
hasPassive: true
hasActive: false
countsAs: [existenceOutsideTheDomain]
passiveRules:

  # 1. Debuff resistance with the terminal ladder
  - key: ApplicationChance
    direction: incoming
    value: -25
    terminalLadder: { instakill: -25, death: -10, erase: -5 }

  # 2a. Damage taken from Mad Enhancement units −40%
  - key: DamageModifier
    direction: taken
    value: -40
    includesNP: true
    predicate: ["attacker:skill:madEnhancement"]

  # 2b. Damage dealt to Mad Enhancement units +40%
  - key: DamageModifier
    direction: dealt
    value: 40
    includesNP: true
    predicate: ["target:skill:madEnhancement"]

  # 3. Damage taken from Outsiders +40%
  - key: DamageModifier
    direction: taken
    value: 40
    includesNP: true
    predicate:
      - { anyOf: ["attacker:skill:existenceOutsideTheDomain", "attacker:attribute:outsider"] }

  # 4. Crit chance +15%
  - key: CritModifier
    aspect: chance
    value: 15

  # 5. Negate Mad Enhancement's damage boost when attacked by such a unit,
  #    and its damage reduction when attacking one.
  - key: SuppressForeign
    target: attacker
    suppresses: { sourceSkill: madEnhancement, elementKeys: [DamageModifier], direction: dealt }
    predicate: ["attacker:skill:madEnhancement"]
  - key: SuppressForeign
    target: target
    suppresses: { sourceSkill: madEnhancement, elementKeys: [DamageModifier], direction: taken }
    predicate: ["target:skill:madEnhancement"]
```

Zero JavaScript. Clause 5 needed one new element (`SuppressForeign` — suppress an element on the
*other* unit for this exchange only), which is general enough to be worth having: it is how
"negate the enemy's X" is expressed, and several unique skills will want it.

Note clauses 2 and 5 interact: clause 2 gives −40% from Mad Enhancement units, and clause 5
negates Mad Enhancement's own bonus. Both apply — Van Gogh takes 40% less *and* the attacker
loses their boost. That is a large swing and it is what "Existence Outside The Domain" is meant
to be.

---

## 24.8 Worked example — Mannanán's `Fragarach` status

The reference set's most mechanically unusual effect, and the one that justifies `OnEvent`.

```yaml
id: fragarach
name: "Fragarach"
polarity: status
removability: { unremovable: true }
rules:
  # 1. Cannot perform a normal counter
  - key: ForbidReaction
    reactions: [counter]

  # 2. Automatic Fragarach Counter on being attacked OR debuffed
  - key: OnEvent
    event: [combatProcessEnd, effectApplied]
    automatic: true
    predicate:
      - { or: ["self:wasAttackedThisProcess", "self:wasDebuffedThisProcess"] }
    then:
      - key: Attack
        target: sourceOfAttack
        formula:
          base: [{ unit: self, component: str, factor: 1.0 }]
          multiplier: 2.5
          damageScope: np              # "deal NP Damage"
          unblockable: true
          evadableOnlyBy: [dodge]
          ignoresNPSeal: true          # explicit exception (Ch. 15 §15.5)
        then:
          - { key: ApplyEffect, target: victim,
              effect: { id: defDwnC, duration: "1◈", magnitude: 10 } }
          - { key: ApplyEffect, target: alliesWithin2,
              effect: { id: sCritUp, duration: "⅓◈", magnitude: 10 } }
          - { key: CooldownDelta, target: self, ability: fragarachEnbarr, delta: "-⅓◈" }
          - { key: ResourceDelta, target: self, resource: fragarachTokens, delta: 1 }
```

Also fully declarative, at the cost of the `Attack` action supporting a nested `then`. That
nesting is worth it — chained on-hit effects are extremely common.

The one piece that stays scripted is her *Fragarach* NP itself, which **cancels an incoming
Noble Phantasm** and either instakills its user or reflects its damage, with the branch
depending on whether the cancelled NP was that Servant's strongest. Determining "strongest NP"
requires comparing damage formulas across abilities, which is genuinely a computation.

---

## 24.9 Explainability

Every applied element records its contribution:

```ts
interface Contribution {
  elementKey: string;
  sourceName: string;              // "Flash of the Sun God"
  sourceType: "ability" | "effect" | "environment" | "essence";
  value: number | string;
  stage: number | string;
  predicateResult: PredicateTrace | null;
}
```

`PredicateTrace` records *which clause* passed or failed, so the UI can render:

```
Not applied: Dmg Up (Gods)
  requires: target has [Undead] or [Divine]
  target Heracles has: [Male] [Servant] [Earth] [Humanoid]
  → clause failed
```

This is the single most valuable debugging tool in a data-driven system, and it costs one object
per evaluated element. In production it is retained only for the current operation; in dev mode
it is kept for the whole session.

---

## 24.10 Content validation

`tools/validate-content.mjs` checks, per rule element:

1. `key` is registered in `CONFIG.FGT.ruleElements`.
2. The spec validates against the element's `SCHEMA`.
3. Every `predicate` parses, and every referenced roll option is in the known vocabulary
   (unknown options are a **warning**, since content may legitimately introduce new ones —
   but they must be declared in the ability's `providesOptions`).
4. Every expression parses and every `@path` resolves against the snapshot type.
5. Every effect id referenced exists in the effect registry.
6. Every ability id referenced (`blockedBy`, `alsoTriggers`, `sameTurnExclusive`) exists.
7. Every `Script` fn is registered.
8. Every duration parses.
9. Every localization key exists.
10. Priority overrides carry `@intentional`.

Validation runs in CI, at pack build, and at world setup in dev mode. A failure names the
document, the ability, the element index, and the field path.

---

## 24.11 Extension

A module adds a rule element:

```js
Hooks.once("init", () => {
  class MyElement extends fgt.api.RuleElement {
    static KEY = "MyElement";
    static SCHEMA = { magnitude: { type: "number", required: true } };
    contributeDamage(ctx, bag) { bag.stage(4).add(this.spec.magnitude, this.source.name); }
  }
  CONFIG.FGT.ruleElements.MyElement = MyElement;
});
```

Content then uses `key: MyElement`. Same mechanism the system itself uses; no privileged path.

---

## 24.12 Summary of decisions

| # | Decision |
|---|---|
| D24.1 | ~30 rule elements with five contribution points cover the entire reference set. |
| D24.2 | Predicates are a data grammar over roll options, never functions — for compendium safety, explainability, and build-time validation. |
| D24.3 | Scripts are entries in a closed registry; no `eval`, no `new Function`. |
| D24.4 | `OnEvent` is the general trigger mechanism, with a small action vocabulary and nested `then` chaining. |
| D24.5 | Values may be expressions in a tiny total language with `@`-path references. |
| D24.6 | Priority bands with a stable secondary sort guarantee cross-client determinism. |
| D24.7 | `SuppressForeign` expresses "negate the enemy's X for this exchange". |
| D24.8 | Every element records a `Contribution` with a predicate trace, for the explainer. |
| D24.9 | Target: ≤15% of abilities need a `Script`. Measured at ~7% on the reference set. |

---

**Next:** [25 — The Turn System](25-turn-system.md)
