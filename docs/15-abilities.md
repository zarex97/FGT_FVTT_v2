# 15 — Abilities

> **Implemented (Ch. 45 B3, B4).** Costs and requirements (§15.4) are live in
> `module/rules/costs.mjs`: Master Health by rank column and rank step, Sustainability for a Free
> Servant, double self-Health for one with no clock, the cooldown gate, the Noble Phantasm round
> gate and the ZON gate. `resolveAttack` **validates at declaration and pays at confirmation**,
> which is this section's own decision, so cancelling during targeting costs nothing.
>
> The Health comparison is **strict** — a Master at exactly 50 cannot pay a 50-cost NP — and the
> cost is paid with `statDelta`, never `damage`, so it cannot trigger `Dmged NP Regen` or an
> Injury Roll.
>
> Granted abilities (§15.7) are read via `module/rules/granted.mjs`, which now also carries the
> `grantedAbility` constructor — one shape for all four grant mechanisms this section names, so a
> grant from any of them expires and displays the same way. The **copy** half is
> `module/rules/copy.mjs`: `canCopy` (with the exclusion list as per-ability `copyable` data
> rather than a name list in code), `copyCandidates`, `copyAbility` and `effectivePhases`. A copy
> carries `copiedFrom` and **no phases of its own**, so a later content fix to the source reaches
> every copy; `effectivePhases` is what every phase reader goes through, because a reader that
> read `.phases` directly would make the copy load correctly and do nothing.
>
> Rank and cooldown on a copy are the **copier's** (`A+`, `4◈−⅓◈`), not the source's. The engine
> half is `module/engine/copy.mjs` (`offerCopies`, `grantCopies`), which re-checks `canCopy` at
> pick time — the offer and the pick are separated by a human. The GM dialog (Ch. 36) is still to
> come.
>
> **All twelve of §15.4's requirement kinds** are implemented in `module/rules/items.mjs`
> (`REQUIREMENT_KINDS`, `meetsRequirement`, `meetsRequirements`), and **`canUseAbility` consults
> them** — they were the long tail after the cooldown, round and ZON gates, which are checked
> first because those are the refusals a player can act on. An unrecognised kind **refuses**.
>
> Two more shipped with Semiramis's kit: **`itemAtLeast`** (a gate on the caster's own held item
> quantity), **`noAliveSummon`** (at most one live instance of a named summon on the field), and
> **`withinPlatformCentre`** (inside a radius of a platform's own geometric centre — "the Throne
> Room"). More load-bearing: **any requirement may now carry its own `predicate`**, scoping it to
> one of an ability's several behaviours — vacuously satisfied (never refuses) when that predicate
> is false, rather than a hard AND across the whole requirement list. `noAliveSummon` needed this
> for Summoning: Bašmu (its clause must not block the OTHER, unrelated clause just because a Bašmu
> happens to be alive) and it generalizes past that one case.
>
> A wider pattern runs through this Servant's kit: **`damage`, `targeting`, `cooldown` and a
> bounded field's own `geometry`/`duration`/`membership` may each carry a `branches` array**
> (`{predicate, ...override}[]`, first match wins, falling back to the base declaration) for an
> ability whose targeting shape, damage, cooldown length, or field shape genuinely differs by
> which of its stated behaviours fires — one document, not several abilities pretending to be
> unrelated. `engine/attack.mjs#resolvedDamage`, `rules/ability-use.mjs#targetSpecFor`,
> `engine/cooldown.mjs#cooldownFor` and `engine/fields.mjs#createField` each read it the same way.
>
> Items (§15.8) are `canTransferItem`, `transferItem` and `consumeItem` in the same module, with
> `module/engine/items.mjs` (`giveItem`, `useItem`) writing through the new `itemQuantity` and
> `itemGrant` intents. `transferable` **defaults to false** — "Items cannot be traded/given/passed
> to other Units unless stated" — and a consumed item's quantity drops **before** its effect runs,
> so a consumable that kills its bearer is still spent. The once-per-turn allowance is counted on
> the giver's `turnState.itemTransfers`, not on the item, which would otherwise carry a spent
> allowance to its new owner.
>
>
> **`supersedes` is implemented.** `resolveCosts` in `module/rules/costs.mjs` resolves a set of
> pending costs against each other before any of them is charged, and `resolveAttack` collects
> them into one list precisely so it can: supersession is a *relation between costs*, and a cost
> paid before its supersessor is known has already been paid wrongly. Karna's NP cost overwrites
> the 20 Health his Master loses when he Acts; Ch. 20's Hanging Gardens upkeep overwrites the NP
> cost in the other direction. Both are authored data — `additionalCosts` on an ability, `upkeep`
> on a platform — rather than named in code.
>
> Two decisions worth keeping. Supersession is resolved in **one pass over the original set**, not
> transitively, so the result cannot depend on arrival order. And a cycle of mutual supersession
> collapses to **one** survivor rather than none — "none" would make a Noble Phantasm free, which
> is the one outcome no reading of the rule supports. What was dropped and by what is logged, so a
> Master who paid 50 where they expected 70 can see which rule did it.

Skills, Spells, Attack Skills, Noble Phantasms, Magic Crests, and Class Skills. This chapter
specifies the ability model: the type taxonomy, the phase structure, costs and gates, and the
categorization rules that decide which effects apply to which abilities.

---

## 15.1 The taxonomy

```
Ability (abstract)
 ├── Skill
 │    ├── PassiveSkill              always in effect
 │    ├── ActiveSkill               used, has cooldown
 │    │    └── AttackSkill          deals damage, normally BA(STR)
 │    └── HybridSkill               both passive and active components
 ├── Spell                          a subset of Skill, normally Casters
 │    └── DamageSpell               deals damage, always BA(MAG)
 ├── NoblePhantasm
 │    ├── ActiveNP
 │    ├── PassiveNP
 │    └── CounterNP                 usable in response
 └── MagicCrest                     Master ability, round-3 gate
```

The rulebook's own statements that define the relationships:

> *"Passive Skills are always in effect. Active Skills (or just Skills) have to be used by the
> Unit, and have a Cooldown."*
> *"Some Skills may have both Passive and Active effects. When such a Skill is used, the Active
> effect is activated for the duration as stated, and Cooldown only applies to the use of the
> Active effect."*
> **Implementation note.** A Skill that is not an Attack now has its **own resolution path**
> (`module/engine/skill-use.mjs`) and does not enter a Combat Process. It used to: `resolveAttack`
> was the only route into using an ability, so Asterios's *Avyssos of Labrys* — three buffs
> applied to Asterios, touching nobody — opened a targeting session listing Asterios as a target,
> priced him for damage, offered a button labelled "Attack", and then asked him to Evade.
> `classifyAbility` had returned `isAttack: false` the whole time and nothing on the use path read
> it.
>
> **"Deal damage" means directly.** `countsAsAttack` is true for an ability with a `damage` phase,
> and false for one whose only effect is a debuff that costs the target Health over time — a skill
> inflicting poison is not an Attack Skill, however much Health the poison eventually removes.
> `countsAsAct` is the broader question and is true for any active skill, because a self-buff is
> not an attack and is still what the Servant did with its turn. Both honour this section's
> "unless stated" through the `countsAsAttack` / `countsAsAct` fields, which the chapter's own
> worked example used and nothing had ever read.
>
> **Abilities usable "when Attacked" are offered at the reaction rung**, beside Block and Evade
> (`module/rules/reactions.mjs`). Medea's Argos and Trofa are the reference cases and there is no
> other moment they can be reached: by the time either matters, its owner is standing inside
> somebody else's Combat Process. Everything that would refuse the ability — cooldown, a
> same-turn exclusion, a negating effect — is checked **before** it is offered, for §17.6's reason.
>
> `timing.window` lives on the ability schema now. It was only on Command Spells, so an ability
> authored "used when Attacked" compiled with the window and the DataModel dropped it on load.
>
> **An `applyEffects` phase carries `effects:`, not `rules:`.** §15.2's own shape, and the
> distinction matters to the validator: `phases[].rules` is walked as *rule elements* and each
> entry must carry a `key`, while `effects` are effect applications. Both readers accept either
> shape, so Asterios's earlier `rules: [{ key: OnEvent, effect: ... }]` still works — though the
> attack path read only `rules` for a while, and silently dropped every rider on the newer shape:
> Aero dealt its damage and inflicted no Bleed.
>
> An effect entry may carry **`chanceModifiers`**, a list of predicated adjustments to how likely
> it is to land. Medea's Atlas is the reference case and the reason it is a list: "reduced by 25%
> on Units with a MAG Rank of B or higher; reduced by 25% on Units with a Magic Resistance of Rank
> B or higher; **this reduction does stack**." 
>
> **A targeting session opens only when something is chosen.** Self-anchored is not sufficient on
> its own — a 5×5 block projected from the caster still has four directions — so `needsTargeting`
> asks whether the anchor, the selection or the shape leaves a decision.

> *"Attack Skills are a subtype of (Active) Skill. Attack Skills deal damage, normally using
> Base Attack (STR) unless stated. Attack Skills usually count as the Unit's Attack for the Turn
> unless stated."*
> *"Spells are a subset of Skills, normally available to Casters. Damage Spells are a subtype of
> Spell that deal damage, which always use Base Attack (MAG) unless stated."*

**DECISION.** Rather than a deep class hierarchy, an ability is one document type with
orthogonal flags. The hierarchy above describes *concepts*; the data model is flat:

```ts
interface Ability {
  id: string;
  name: string;
  rank: Rank | null;
  source: "class" | "personal" | "np" | "magicCrest" | "granted";

  // Type flags — orthogonal, not exclusive
  hasPassive: boolean;
  hasActive: boolean;
  isSpell: boolean;
  isNP: boolean;
  categorizedAsNP: boolean;         // Skills that count as NP for effect scoping
  dealsDamage: boolean;
  defaultComponent: "str" | "mag" | "inherit";

  // Economy
  countsAsAttack: boolean;
  countsAsAct: boolean;
  cooldown: TickExpr | null;
  usesPerGame: number | null;
  usesPerRound: number | null;

  // Gates
  timing: TimingSpec;
  requirements: Requirement[];
  costs: Cost[];
  blockedBy: string[];
  alsoTriggers: string[];
  sameTurnExclusive: string[];

  // Behaviour
  passiveRules: RuleElement[];
  phases: Phase[];                  // the active effect
}
```

Why flat: `Semiramis's Territory Creation` is a class skill that is passive, rank-conditional,
and changes behaviour based on whether she has another skill. `Mannanán's Riding` is a class
skill with three passives and an active. `Karna's Kavacha and Kundala` is a *passive Noble
Phantasm* that is lost when another NP is activated. A rigid hierarchy would need a new class
for each combination; flags compose.

---

> **Implemented phase kinds.** `damage`, `applyEffects`, `removeEffect` (by name or by a
> `selector`'s **polarity**, so "all debuffs" covers debuffs written later), `heal` (with
> `percentOfMax`, because a sheet that says "30% of its maximum value" means the maximum),
> `statChange`, `resource` (with `clampToMax`, the difference between *restores* 3 Agility and
> *grants* 3), `cooldown` (by ability id **or by `category`**, so Medea's High-Speed Divine Words
> can reset all seven of her Spells without naming them), `summon`, and `cutContract`.
>
> An `applyEffects` phase carries **`effects:`**, not `rules:` — `phases[].rules` is walked by the
> validator as *rule elements* and each entry must have a `key`.
>
> `summon` is the most structurally demanding (Medea's Dragon Tooth Warriors): two nested rolls,
> one for how many and one for what each is, placement restricted to **free** panels in the
> declared area, and a cooldown scaled by the first roll. `cutContract` is the only phase that
> rewrites the relationship graph, and it reads the ladder's outcome — a successful Evade keeps
> the Contract, so it cannot be an unconditional rider after damage.

## 15.2 Phases

An active ability's behaviour is an **ordered list of phases**. Each phase is one of the two
pipelines from Ch. 03 §3.5 — an attack (A) or an application (B) — plus a few utility kinds.

```ts
type Phase =
  | { kind: "damage";       target: TargetSpec; formula: DamageFormula; element?: Element }
  | { kind: "applyEffect";  target: TargetSpec | "reuse"; effects: EffectApplication[] }
  | { kind: "removeEffect"; target: TargetSpec | "reuse"; selector: RemovalSelector }
  | { kind: "resource";     target: TargetSpec | "self"; changes: ResourceChange[] }
  | { kind: "cooldown";     target: TargetSpec | "self"; changes: CooldownChange[] }
  | { kind: "statChange";   target: TargetSpec | "reuse"; changes: StatChange[] }
  | { kind: "move";         target: TargetSpec | "self"; movement: MovementSpec }
  | { kind: "summon";       spec: SummonSpec }
  | { kind: "zone";         spec: ZoneSpec }
  | { kind: "choose";       target: "self"; options: EffectChoice[]; count: number }
  | { kind: "createField";  }                              // the ability's own `field:` (Ch. 43)
  | { kind: "modifyAttack"; modifiers: AttackModifier[] }   // for "used when attacking" skills
  | { kind: "script";       fn: string; args: Record<string, unknown> };
```

Phases execute in declaration order. `"reuse"` chains a phase to the previous phase's resolved
target set — the mechanism that makes `Brahmastra Kundala` apply Burn to exactly the units it
damaged.

**`target` is read.** It was authored on every ability from the beginning and the skill executor
ignored it, looping every phase over every resolved target. That stayed invisible for as long as
every `target: self` phase belonged to a *self-targeting* ability, where the two lists are
identical. Scáthach's *Primordial Rune* is the first where they differ — *"Gain 2 PRS Tokens.
Then, … on an allied Unit"* — and in a live world the tokens went to the ally.

### A `cooldown` phase may lengthen somebody else's clock

`CooldownChange` has three selectors and three directions, and one of each was added for
Serenity's *Shapeshift* — *"Used on an enemy Unit. Increase its NP Cooldown by 1◈ Turns"*.

| Selector | Names | Used by |
|---|---|---|
| `abilityId` | one ability | — |
| `category` | a family | Medea's *High-Speed Divine Words* (seven Spells; a list would go stale) |
| `scope: np` | every Noble Phantasm the target has | *Shapeshift* — the clause is aimed at somebody else's sheet, and that Servant may have two (EMIYA has five) |

| Direction | Means |
|---|---|
| `set: N` | write the remaining turns outright; `set: 0` is "completely reduce", a set rather than a subtract so it cannot work by accident |
| `ticks` + `direction: down` | subtract, floored at zero |
| `ticks` | **add** |

`increase` is the direction the writer did not have: `setCooldown` could set or reduce, so
lengthening an enemy's clock was the one cooldown operation the system could not perform — and
`set` would have replaced a *longer* cooldown with a shorter one, turning the debuff into a
favour. Changes are stated in **◈**, resolved against the world's turns per Round; reading `1◈`
as one turn would make *Shapeshift* a third as strong. Verified live: Karna's *Brahmastra Kundala*
went from 0 to 3 turns.

### A phase may carry its own targeting

`target` has three answers, not two. `self` names the caster and `reuse` names whatever the
ability's own targeting resolved — and neither is *"all allied Units within a 2 panel area of
himself"*, which is clause 4 of EMIYA's *Eye of the Mind (True) EX* while its other three clauses
buff him alone. On a **reaction** the gap is worse: `reuse` resolves to whoever just attacked.

So a phase may declare a whole `targeting:` block of its own, resolved against the board like any
other:

```yaml
- kind: applyEffects
  targeting:
    anchor: { kind: self }
    shape: { kind: chebyshevRadius, r: 2 }
    selection: { relations: [ally, self], includeSelf: true, chooser: all }
  effects:
    - { id: sCritUp, magnitude: 30, duration: "⅓◈" }
```

### `choose`: a phase that asks

The one place in the reference set where the **choice is the rule** rather than a convenience.
EMIYA's *Trace, On*: *"Apply one of the following effects **of your choice** to EMIYA — Activated
Circuits (AC) or Blazing Circuits (BC)"*, and a later use *"can choose to swap from AC to BC or
vice-versa"*. Picking a default would quietly halve the Skill.

It opens the same `ChoiceDialog` Scáthach's *Primordial Rune* wildcard does, at resolution rather
than at targeting. Dismissing it is an answer: nothing is applied, and the Skill's other clauses
have already happened.

The swap needs no machinery of its own — see §11's `replaces`.

### `afterFirstUse`: a phase the first press skips

*"If this is **not the first time** EMIYA has used this Skill in this game, reduce his Health by
5% of its maximum value."* A gate on the ability's whole-match counter, read **before** this use
is recorded, so the first press costs nothing and every one after does.

`timesUsed` and `maxUses` are new fields on every ability, and three clauses in the reference set
need them: this one, Heracles's God Hand (*"can only be used 11 times"*), and EMIYA's *Rho Aias*
(*"every time … after its first usage, its Health is restored by half of its current Health"*).
A whole-match budget is not a cooldown and cannot be expressed as one.

### The attack path runs the caster's phases too

A Noble Phantasm resolves through the Combat Process, which knows about damage and about the
effects that ride on it — **and about nothing else**. Every other phase kind was `useSkill`'s
business, so an NP that spent a Resource, opened a bounded field, conjured a squad or asked the
player a question silently did none of it.

EMIYA's *Unlimited Blade Works* is the case that found it: it consumed no Aria and created no
Reality Marble, while charging his Master in full. The attack flow now runs the caster-scoped
phases once, from the caster, before the fan-out — `resource`, `statChange`, `cooldown`,
`removeEffect`, `summon`, `createField`, `choose`, `heal`. `damage` and `applyEffects` are
deliberately absent: the first is the Combat Process itself and the second is its rider step,
which resolves per defender after the damage has landed.

### `when`: phases that run before the damage

A phase may declare `when: beforeDamage`. Unstated means after, which is what every phase written
before this existed meant.

Scáthach's *Gáe Bolg Alternative* is the case: *"has a 75% chance of inflicting Instakill. **If
Instakill is not inflicted**, this NP deals 3.5x damage plus 100."* That cannot be a rider,
because a rider fires after a damage step that should not have happened. The effects resolve
first, and the ability's `damage.skipIf` names what cancels the damage:

```yaml
damage:
  multiplier: 3.5
  flatBonus: 100
  skipIf: { effectApplied: instakill }
phases:
  - kind: applyEffects
    when: beforeDamage
    target: reuse
    effects:
      - { id: stun, duration: "1◈", chance: 500 }
      - { id: instakill, chance: 75 }
```

Only an **applied** effect suppresses the damage. A resisted Instakill did not happen, and the
Noble Phantasm falls back to its damage exactly as the sheet says. Note `chance` on the effect
entries: the **ability's** stated chance, overriding the effect definition's own. 500% is not
"guaranteed" but "guaranteed through four stacked resistances", which is what the number is for.

### `check`: a phase the defender rolls

```ts
  type Outcome =
    | { effects?: EffectApplication[]; statDeltas?: { path: string; delta: number }[] }
    | CheckPhase;                                  // "if Failed, roll again"

  | { kind: "check"; check?: Parameter;            // default "luck"
      modifierTable?: string; modifierRank?: Parameter;
      ignoresResistanceFrom?: string[];            // skill slugs
      branches?: { when: Predicate[]; onSuccess?: Outcome; onFail?: Outcome }[];
      onFail?: Outcome; onSuccess?: Outcome }      // when there are no branches
```

**Scáthach's *Gate of Skye*** was the only author for a long time, and every part of it is
unusual: the check is rolled by the **target** rather than by the attacker, its difficulty is
read from a rank table keyed on the *target's own* MAG, and failing it is worse than succeeding —
success only means taking 4x damage.

`gateOfSkyeSaveModifier` is an **equality** table, not a threshold: *"if their MAG is Rank B,
reduce the value rolled by 2; if their MAG is Rank A, reduce it by 4"*, and a `MAG A+` or `MAG EX`
target gets nothing at all. Do not "improve" it into a `gte`.

**Medusa's *Mystic Eyes*** is what generalised the shape, and it needed four things:

| Clause | Mechanism |
|---|---|
| *"Perform an **Agility** Check"* | `check:` names the parameter. A Luck Check is contested against the attacker's Luck and costs the defender 1 either way (Ch. 14); anything else is a plain check against that stat, through the same `resolveCheck`/`checkPlan` pair Cover uses. |
| three outcomes by what the target **is** | `branches:`, first match wins **in authored order** — load-bearing, because a Master is a Human *and* has a MAG rank, and the sheet lists the human case first. |
| *"If Failed, roll again"* | a branch may hold another check. Capped at `MAX_CHECK_DEPTH` against an authored cycle, not as a rule. |
| *"reduce the DU's Agility by 2"* | `statDeltas`, an outcome that is not an effect. |

A phase with **no** `branches` is its own branch, which is how Gate of Skye keeps resolving
untouched — verified live rather than assumed.

`ignoresResistanceFrom` names skills by slug: *"Debuffs inflicted by this Skill ignore the DU's
debuff resistance due to Magic Resistance."* Scoped to the **source**, so Magic Resistance's other
halves — the MAG-damage negation and the Instakill/Death interaction — are untouched.

### `rollTable`: an ability whose effect is decided by a die

```ts
  | { kind: "rollTable"; target: TargetSpec | "reuse"; count: number; faces: number;
      tables?: { ally: Table; enemy: Table }; entries?: Table }
```

Scáthach's *Primordial Rune*, and it has three wrinkles worth naming. **Two tables chosen by
relation** — the same Skill, two eight-row tables, and which one applies is a property of the
target rather than of the use. **Duplicates apply twice**: *"if a duplicate number is rolled,
apply the effect twice"*, so the dice resolve **per die** and collapsing them into a set — the
obvious implementation — is precisely the bug that clause forbids. And a **wildcard row**,
`{choose: true}`, which resolves to a question rather than to an effect; it offers the rows
*above* it, never itself, and accepts one **or more**, because the sheet says "effect(s)".

### Example — Karna's *Flash of the Sun God*

```yaml
id: karna-flash-of-the-sun-god
name: "Flash of the Sun God"
rank: EX
hasActive: true
timing: { window: ownTurn }
cooldown: "4◈"
sameTurnExclusive: [karna-mana-burst-flames]
countsAsAct: true
countsAsAttack: false
phases:
  - kind: statChange
    target: self
    changes: [{ stat: agility, delta: 3, clamp: true }]
  - kind: applyEffect
    target: self
    effects:
      - { id: atkUp, duration: "1◈", magnitude: { base: 40, np: 30 } }
      - { id: npDmUp, duration: "1◈", magnitude: { base: 20 } }
```

Three lines of behaviour, no code.

### Example — Mannanán's *Toole Fragarach*

```yaml
id: mannanan-toole-fragarach
name: "Toole Fragarach: Gouging Greatsword of the War God"
hasActive: true
dealsDamage: true
countsAsAttack: true
cooldown: "3◈"
costs:
  - { kind: resource, key: fragarachTokens, amount: 3 }
phases:
  - kind: damage
    target:
      anchor: { kind: withinRange, range: { metric: attackRange, panels: "@self.range + 2" } }
      shape: { kind: unit }
      selection: { relations: [enemy], chooser: chosen, count: 1 }
    formula:
      base: [{ unit: self, component: str, factor: 1.0 }]
      multiplier: 1.0
      multihit: 3
      evadeModifier: 3
      evadeFailCascades: true      # "if any Evade fails, the remaining hits cannot be Evaded"
```

Note `"@self.range + 2"` — a small expression language for values derived from the caster.
Chapter 24 specifies it.

---

## 15.3 Timing windows

When may an ability be used?

```ts
type TimingWindow =
  | "ownTurn"                   // default
  | "anyTime"                   // Command Spells only
  | "combatPhaseStart"          // Semiramis's Scales of the Sacred Fish; Karna's UAM switch
  | "combatProcessStart"        // Heracles's Eye of the Mind (False)
  | "damageStepStart"           // Kingprotea's Monstrous Strength
  | "whenAttacking"             // Mana Burst skills
  | "whenAttacked"              // Fragarach NP
  | "whenAllyAttacked"          // Kiritsugu's Scapegoat
  | "onDefeat"                  // Mannanán's God's Holder: Possession
  | "reaction";                 // generic
```

The default and its two important qualifiers:

> *"All Active Skills are used during your Turn unless stated, and can still be used after the
> Unit has Moved and/or Attacked, unless stated."*
> *"Only a Unit that has Moved or Attacked during its Turn may use its Active Skills; similarly,
> a Unit that has used an Active Skill counts towards the number of Units who Move or Attack
> during that Turn."*

The second sentence is worth reading twice. It appears to say a unit **must** have already moved
or attacked to use a skill — which would be a strange restriction, since it would prevent
opening a turn with a buff. The more likely reading, given the second clause, is that the
sentence is a garbled statement of the *budget* rule: using a skill consumes a unit-slot in the
turn's move/attack allowance.

**DECISION.** Read it as: using an Active Skill counts the unit toward the turn's budget of
units that may act, and does **not** require a prior move or attack. Ch. 41, Q4.

### The modifier skills — an Attack Skill, not a `modifyAttack` phase

Karna's *Mana Burst (Flames)*, Castor's and Pollux's *Mana Burst (Light/Ancient)*, and
Kiritsugu's *Thaumaturgy: Reinforcement* are all "used when performing a Normal Attack" and
change the attack's parameters rather than performing one.

This chapter originally proposed a `modifyAttack` phase pushing `BaseAttackOverride`,
`IgnoreMagicResistance`, `ElementTag` and `OnHit` into a pending `AttackContext`. **None of those
five things were built, and none of them need to be.** The `damage:` block already says all of
it, and it says it in the vocabulary the pipeline reads:

```yaml
id: karna-mana-burst-flames
isAttackSkill: true                  # it performs the attack; it does not decorate one
element: fire
cooldown: "3◈"
sameTurnExclusive: [karna-flash-of-the-sun-god]
damage:
  base:
    sources:                         # "BA(STR) and BA(MAG) combined (e.g. BA=300)"
      - { unit: self, component: str, factor: 1 }
      - { unit: self, component: mag, factor: 1 }
  component: str                     # what it COUNTS AS, for Magic Resistance's own exemption
  ignoresMagicResistance: true
phases:
  - kind: damage
  - kind: applyEffects
    rules:
      - { key: OnEvent, event: damageDealt, effect: { id: burn }, duration: "2◈" }
```

**DECISION.** A Skill that "is used when performing a Normal Attack" *is* the attack —
`isAttackSkill: true`, one button, one Combat Process. The alternative asks the player to press
two things in the right order and gives the engine a second attack-building path to keep in step
with the first. `damageDealt` is what *"if the Attack is not Evaded"* means, because that rung
only fires once the damage has landed.

Measured live: 551 damage from a combined Base Attack of 325 (150 STR after Vasavi Shakti's +25,
plus 175 MAG) with Atk Up 40% and Divinity +50, Burn applied, cooldown 9.

### The attacker's own windows

Every window above describes a moment inside **somebody else's** Combat Process. Two abilities in
the reference set are used at a moment inside *your own*, and neither had anywhere to be offered:

| Window | Ability | Text |
|---|---|---|
| `damageStep` | Asterios, *Monstrous Strength* | *"used at the start of a **Damage Step** when performing an Attack"* |
| `combatPhaseStart` | Karna, *Uncrowned Arms Mastership* | *"used during your Turn **or at the start of a Combat Phase**"* |

`abilitiesAtWindow` (`rules/reactions.mjs`) is `reactionAbilities` with the window as a
parameter — one gate list for both sides of an exchange, because an ability offered at a moment
it is on cooldown for is the refusal-when-pressed §17.6 forbids whichever side its owner is on.
`offerAttackerWindow` (`engine/attack.mjs`) does the asking.

Three things about it are decisions rather than details:

**It is asked inline, not through `PROMPTS`.** The Combat Process's own prompt table exists
because the reaction ladder is answered by the *other* client and has to survive serialization
into a chat flag between rungs (Ch. 27). This question is answered by the player already driving
the resolution, so a card round trip would add a rung to ask somebody something they are looking
at. `FGTSocket.ask` still routes it to the ability's actual owner rather than to the arbitrating
GM.

**The Damage Step, not the declaration.** *Monstrous Strength* has a 3◈ cooldown, and an attack
that is Evaded never reaches a Damage Step. Offering it at declaration would spend the clock on a
swing that missed. Declining costs nothing — measured live at 201 damage declined, 406 accepted,
cooldown untouched in the first case.

**What "using it" means depends on what it is.** *Monstrous Strength* contributes rules to the
attack in progress, folded into that one damage computation and nothing else — *"STR Damage dealt
by **that Attack**"*, so an effect applied to Asterios would be the wrong shape twice over: it
would survive into his next attack and be strippable by buff removal, neither of which the sheet
says. *Uncrowned Arms Mastership* is a **mode**, and using it *is* the switch.

An ability whose only moment is a window is **not a sheet button**: `classifyAbility` returns
`windowed`. *Monstrous Strength* previously fell through to the `activeRules` fallback and
classified as a mode, which put a toggle on the sheet that switches a permanent +100% STR damage
on and leaves it there.

---

### Modes: when a switch may be flipped

A mode is *switched* rather than used, and the toggle was a bare write — press the button, flip
`system.active`, no questions asked. Every rule about **when** it may be switched therefore had
nowhere to live, and there are three in the reference set:

| Rule | Source | Field |
|---|---|---|
| Never | Heracles: *"cannot deactivate Mad Enhancement"* | `cannotDeactivate` |
| Not yet | *"it can only be deactivated 2◈ Turns after it was activated, **and vice versa**"* | `toggleLock`, with `toggledAt` stamped on the way on |
| Not while | Penthesilea: *"Mad Enhancement cannot be deactivated until there are no Greek Male Units within a 4 panel area"* | a `Compulsion` naming the skill |

The third is the interesting one, because it forces the mode **on** as well as refusing to let it
off — *"her Mad Enhancement is immediately activated regardless of Cooldown or any other
factors"*. So `rules/modes.mjs` answers two questions: `canToggleMode` for the refusal, and
`forcedModes` for the write.

**Nobody presses anything**, and *"at any time"* means the moment the condition becomes true — so
something has to be watching. `engine/modes.mjs` rides the same invalidation the aura index does
(§23.9 now carries a `compulsions` target), because the question is positional and its answer
changes whenever anybody moves. It also runs once at world load, for a match resumed with a Greek
Male already standing beside her: a rule that only fires on a *change* would leave her calm until
somebody happened to move.

Three properties worth stating, because each is a decision:

- **It never switches a mode off.** The sheet says Mad Enhancement *"cannot be deactivated
  until"* they are gone, which frees the player's hand rather than moving it for them. A
  Berserker who has been driven mad does not simply calm down.
- **It bypasses every gate**, including the 2◈ lockout — *"regardless of Cooldown or any other
  factors"*. Note the asymmetry that produces: the compulsion may switch it on inside the lockout
  window, and the player still cannot switch it off inside that window.
- **It announces itself.** A mode that switches itself on with no explanation is
  indistinguishable from a bug, and this one takes control of the Servant away from its player;
  the card names the compulsion and the Units that triggered it.

Note the asymmetry the source draws between a *player's* toggle and a *forced* one. Mad
Enhancement's own first clause deactivates it when its Master runs low, and that is not subject to
the 2◈ lockout; a player's click is.

## 15.4 Requirements and costs

```ts
type Requirement =
  | { kind: "inZon" }                          // NPs
  | { kind: "roundAtLeast"; round: number }    // NP/MC gates
  | { kind: "inZone"; zoneId: string }         // Sikera Ušum ⊂ Throne Room
  | { kind: "notInZone"; zoneId: string }
  | { kind: "hasSkill"; abilityId: string }    // Bašmu requires Double Summon: Caster
  | { kind: "resourceAtLeast"; key: string; amount: number }
  | { kind: "healthBelow"; fraction: number }  // God's Holder: Possession (<30%)
  | { kind: "modeActive"; mode: string }       // Holder Mode
  | { kind: "counterpartAdjacent" }            // Dioscuri NP
  | { kind: "masterHealthAbove"; amount: number }   // NP cost
  | { kind: "targetHasEffect"; effectId: string }
  | { kind: "notHasEffect"; effectId: string }     // the USER's own state
  | { kind: "modeInactive"; mode: string }         // the mirror of modeActive
  | { kind: "abilityOffCooldown";                  // §7.6; see below
      abilityIds?: string[]; category?: string; exclusionSet?: string; excludeSelf?: boolean }
  | { kind: "healthAbove"; fraction: number }      // the mirror of healthBelow
  | { kind: "healthRestoredSince"; fraction: number }   // a question about HISTORY
  | { kind: "predicate"; predicate: Predicate };   // escape hatch

type Cost =
  | { kind: "resource"; key: string; amount: number }
  | { kind: "masterHealth"; byNPRank: true }
  | { kind: "masterHealthByNPRank"; rank: Rank }   // charged AS a Rank it does not have
  | { kind: "commandSpells"; amount: number }
  | { kind: "sustainability"; byNPRank: true }      // Free Servants using NP
  | { kind: "selfHealth"; amount: number | "npRankDoubled" };
```

### The Noble Phantasm cost

> *"When a Servant's Noble Phantasm is used, its Master first loses Health depending on the Rank
> of the Noble Phantasm and the Master's own Rank."*

| NP Rank | High Rank Master | Low Rank Master |
|---|---|---|
| EX | 75 | 100 |
| A | 50 | 60 |
| B | 40 | 50 |
| C | 30 | 40 |
| D | 20 | 30 |
| E | 10 | 20 |

`±3` per rank step. Rankless Masters use the left column. Does not apply to Passive NPs unless
stated.

**A Noble Phantasm may be charged at a Rank it does not have.** Two of EMIYA's are: *Rho Aias*
prints `?` for a Rank and costs *"equivalent to if an EX Rank NP is used"*; *Unlimited Blade
Works* prints the range `E~A++` and costs *"equivalent to if a B Rank NP is used"*. Derived from
the ability's own `rank`, both read null and charge nothing at all, so the cost is stated as an
`additionalCosts` entry of kind `masterHealthByNPRank`.

It routes through the same function `npCost` does, which matters for the branch below it: a
**Free Servant** has no Master to charge and pays in Sustainability instead (§16.5). Written as a
plain Master cost it produced an intent with no target — and found live, because the Master in
question had been defeated three tests earlier and the Servant freed itself exactly as it should.

### Three scales of "already used"

| Field | Scope | Case |
|---|---|---|
| `oncePerTurn` | one Turn | Scáthach's *Ár*, whose cooldown a PRS Token waives entirely |
| `sameTurnExclusive` | one Turn | Medea's *Keraino* and *Trofa* |
| `sameRoundExclusive` | one **Round** | EMIYA's *Caladbolg II* and *Hrunting* |
| `maxUses` | the whole **match** | Heracles's God Hand, *"can only be used 11 times"* |

The Round scale is not a nicety: a Servant acts up to three times in a Round, so *"Caladbolg II
cannot be used on the same Round as Hrunting and vice versa"* forbids nothing at all if enforced
per Turn. `system.roundState` mirrors `turnState` and is stale-by-reading in the same way — a
boundary hook that fails to fire cannot leave a Servant permanently unable to project.

All four are checked in `canUseAbility`, which both use paths consult. They used to be enforced
on the **Skill path only**, so the abilities most likely to carry one — Noble Phantasms and Attack
Skills — ignored every one of them: `resolveAttack` recorded no use at all. One `recordUse` intent
now writes the Turn record, the Round record and the whole-match counter together.

### Unrecognised kinds refuse

`meetsRequirement` returns **false** for a kind it does not implement, which is the safe
direction and the reason the vocabulary is guarded against the authored content
(`test/unit/ability-requirements.test.mjs`). An ability whose gate nobody implements does not
fail loudly — it becomes *permanently unusable*: it compiles, validates, loads into the pack,
renders on the sheet, and refuses every time it is pressed. Medea's *High-Speed Divine Words* had
been shipping a `notHasEffect` gate the vocabulary never had.

### …but a recognised kind with an unrecognised **field** does the opposite

An unknown *kind* refuses, which is loud enough to find. An unknown **selector field** on a known
kind is the dangerous case, because the failure mode is a **pass**.

`abilityOffCooldown` collects the abilities its selector matches and asks
`matched.every(cooldown <= 0)`. On an empty set that is `true` — deliberately, and correctly: a
Scáthach who has not copied anything has no Wisdom slots to be blocked *by*, and a gate that
refused on an empty set would make *Clairvoyance* unusable until she copied. Which means a
selector matching nothing **because its field name is wrong** is indistinguishable from a gate
that legitimately has nothing to check.

Karna's *Brahmastra Kundala* is *"cannot be used if Mana Burst (Flames) or Vasavi Shakti is on
Cooldown"*, authored with `abilityId` where `gatedAbilities` reads `abilityIds`. Both gates passed
unconditionally, in a live world, with no warning anywhere — measured as ALLOWED with Mana Burst
on a nine-tick clock.

**DECISION.** The content validator checks requirement **kinds** and **selectors**: a kind whose
empty match set is a silent pass must name at least one of its selector fields. Abilities are
checked against `rules/items.mjs`'s own exported vocabulary rather than a second copy of it;
Command Spells get a separate list, because theirs is a different vocabulary with a different
reader (`rules/command-spells.mjs`) — sharing one would let an ability author `attackIsNotNP` and
receive a gate that never fires.

### `oncePerTurn`

A field on the ability rather than a requirement, because the question is about the ability
*itself* and a requirement has no way to name its own declarer without repeating the id.

It is **not** implied by a cooldown. Scáthach's *Ár* is the case: a PRS Token waives its `3◈`
entirely (§7.6), so *"can only be used once per Turn"* is the only limit left on it.

### `oncePerRound`

The same limit one scale up, and it exists for the reason `sameRoundExclusive` exists beside
`sameTurnExclusive` (§15.3): a Servant acts up to three times in a Round, so a per-Turn cap
forbids almost nothing it would otherwise do.

Karna's *Uncrowned Arms Mastership* is *"can only be used once per Round"* and has **no cooldown
at all**, which makes this the only limit on it. Authored as `oncePerTurn` it would be a free
toggle three times a Round, and the choice between its two effects would stop being a choice.

### `negatedBy` has two halves, and only one was built

> Medea, *High-Speed Divine Words*: *"cannot be used **and its effects are negated** while
> inflicted with Silence."*

`negatedBy` was read only by `isNegated`, which sits on the **use** path. So it refused the
button and left the ability's rules contributing underneath. `rules/snapshot.mjs#negated` now
honours it too, which is what drops the contributions.

Three things turned on it. EMIYA carries `negatedBy: [silence]` on eight abilities, one of which
(*Kanshou & Bakuya*) is `isPassive` and therefore never *used* at all — so its clause could not be
checked anywhere. Karna's *Kavacha and Kundala* is *"lost when Vasavi Shakti is used/Activated"*,
which is how the largest single defensive modifier in the game (−90%, including NP) stops
existing. And *Uncrowned Arms Mastership*'s *"effects are negated by Skill Seal"* is the same
shape.

> *"The Servant cannot use its Noble Phantasm if its Master's Health is equal to or less than
> the amount that would be lost."*

So `masterHealth > cost`, strictly. A Master at exactly 50 cannot pay a 50-cost NP.

For **Free Servants**, the cost becomes Sustainability instead (EX 6◈ down to E 1◈), and for
Free Servants with `Sustainability: N/A`, it becomes *self* health at **double the left-column
value**, with disappearance at the end of the Combat Process if that reduces them to 0.

Karna has an override worth noting: *"When Karna uses a NP that deals damage, his Master's
Health loss from him using the NP overwrites the 20 Health loss from when Karna would normally
Act/Attack"* — costs can supersede other costs, so `Cost` carries a `supersedes: string[]`.

### Cost timing

Costs are paid at **declaration**, before targeting resolution, so that an aborted targeting
does not refund a partially-paid cost. **DECISION.** Costs are paid at *confirmation* (after
targeting, before resolution) and validated at declaration. Cancelling during targeting costs
nothing. This is friendlier and no rule requires otherwise.

---

## 15.5 Categorization: the three scoping questions

Three flags decide which effects touch an ability. They are the most bug-prone part of the
content model, so they get their own section.

### Q1 — Is it an NP for cooldown purposes?

> *"Any Skill/Spell that is 'Categorized as Noble Phantasm' is affected by effects that affect
> NP Cooldown **and not** Skill/Spell Cooldown unless stated."*

`isNP || categorizedAsNP` ⇒ NP cooldown scope. Bašmu's *Cursed Poison Dragonfire* is the
reference case (a summon's skill, explicitly *Categorized as Noble Phantasm*).

### Q2 — Is it an NP for damage-modifier purposes?

`NP DmUp` / `NP DmDwn`: *"Damage dealt by NP is increased and also Attacks/Attack
Skills/Damage Spells that are Categorized as Noble Phantasm. Does not apply to Passive NP."*

Same predicate, plus the Passive NP exclusion.

Meanwhile `Atk Up` uses its **reduced NP magnitude** for these abilities, and
`Luck Check: Increased Damage` is **blocked** for them.

### Q3 — Is it an NP for `NP Seal` purposes?

> `NP Seal`: *"The Unit cannot use Noble Phantasms, does not affect Passive NP unless stated.
> Also affects Attacks/Skills that are only Categorized as Noble Phantasm."*

Same predicate again — but with an explicit exception in the reference set: Mannanán's
Fragarach Counters *"deal NP Damage; however they are **not** affected by NP Seal."* So the
flags are independent booleans, not one derived predicate:

```ts
interface NPScoping {
  cooldownScope: "np" | "skill";
  damageScope:   "np" | "skill";
  sealScope:     "np" | "skill" | "none";
}
```

Defaults are derived from `isNP`/`categorizedAsNP`; overrides are explicit. The content
validator warns when all three are not the same, requiring an `@intentional` marker — because
divergence is rare and usually a mistake.

---

## 15.6 Class Skills

Seven canonical class skills plus the Avenger set. Each is a rank-indexed template in the
compendium; a Servant instantiates one at a rank and the effects follow from Appendix B's
tables.

| Class Skill | Structure |
|---|---|
| **Magic Resistance** | 2 passives: MAG damage negation/reduction by rank comparison; debuff resistance % |
| **Independent Action** | 3 passives: high Sustainability; ZON bonus; contract-roll multiplier |
| **Riding** | 3 passives (Double Move, Riding Attack, Passenger Seat) + 1 active (MOV up) |
| **Territory Creation** | 2 passives: home-base damage bonus (dice); home-base damage reduction for allies (dice). `highestOnly` |
| **Item Construction** | 2 passives: debuff inflict chance up; debuff resist up, both in a 2-panel aura. `highestOnly` |
| **Presence Concealment** | 1 activatable status with 7 clauses |
| **Mad Enhancement** | 1 activatable status with 6 clauses |
| **Battle Continuation** | 2 passives: flat damage reduction (dice, doubled vs NP); revival on defeat |
| **Avenger** *(Avenger class)* | Damage taken +N; counter damage +N |
| **Oblivion Correction** *(Avenger)* | Crit chance +N% |
| **Self-Replenishment (Mana)** *(Avenger)* | Health and NP cooldown recovery per turn |

### Presence Concealment and Mad Enhancement as modes

Both are *activatable statuses* with their own timers and cooldowns — a shape no other ability
has:

```yaml
id: class-presence-concealment
activation: mode
modeDuration: "2◈"
modeCooldown: "2◈"          # "after PC is deactivated", rank-dependent
modeAutoDeactivate:
  - { trigger: afterAttack, at: combatProcessEnd }
  - { trigger: discovered }
  - { trigger: aoeCoinFlipTails }
polarity: status              # neither buff nor debuff, unremovable
```

`Mad Enhancement` is the same shape with different triggers, plus:
- some Servants cannot deactivate it at all (Heracles: *"Constantly Active. Cannot be
  deactivated."*);
- some have it force-activated by a condition (Penthesilea's *Hatred of Achilles*);
- a Command Spell can suppress it for 1◈ (Heracles, Penthesilea).

**DECISION.** Modes are a first-class ability activation kind, not a self-applied effect. The
mode's state lives on the ability item (`system.mode = {active, activatedOnTurn, cooldownUntil}`)
and its rule elements are conditioned on `mode:active`. This makes "cannot be deactivated"
a property of the ability rather than an unremovable effect, which is the correct home for it.

**As built, that decision holds for Mad Enhancement and is reversed for Presence Concealment**,
because the two are not the same shape after all. The sheets say so:

| | Mad Enhancement | Presence Concealment |
|---|---|---|
| The source's own word | *"Constantly Active"*, toggled | *"(Active) Used during your Turn"* |
| How long | until switched off | *"the effects of this Skill lasts for 2◈ Turns"* |
| What ends it | a player, or a compulsion | six things, five of which are not a player |
| Cooldown | none | *"2◈ Turns **after** PC is deactivated"* |

A mode is a toggle somebody **holds**. Presence Concealment is a window that closes on its own —
and on being attacked with, on being discovered, on a coin, and on a 20% roll. Modelled as a
toggle, every one of those five would have to reach in and flip a field on an Item; modelled as an
**effect with a duration**, they remove it, and the clock is the ordinary effect clock.

It also gives clause 8 its natural home: *"the effects of Presence Concealment are neither a buff
or a debuff, and are Unremovable"* is `polarity: status` with `unremovable: true` — exactly what
the plan above wanted the polarity line for, on a document that can carry it.

Two fields were added for it, both on the ability:

```yaml
cooldown: { countFrom: deactivation }   # the clock starts when the Skill ENDS
usableWhileConcealed: true              # clause 7's "unless stated"
concealmentBreakChance: 20              # and what stating it costs
```

`countFrom` had been a declared schema field with **no reader** since the ability schema was
written. Without it the 2◈ cooldown runs *underneath* the Skill's own 2◈ duration and a Servant
can re-conceal the instant the first concealment lapses — half the cost the sheet charges.

The six ways it ends converge on one function (`engine/concealment.mjs`), driven by the effect's
own **deletion** rather than by its six callers, because the sixth caller is the effect clock and
there is nothing there to call. Each owes the same three debts: the cooldown, the announcement,
and the Secret Poison that becomes visible (Ch. 44 §44.4).

### Skills that count as another skill

> Kingprotea's *Goddess's Divine Core*: "This Skill counts as 'Divinity'."
> Castor's / Pollux's *Twin God's Divine Core*: "This Skill counts as 'Divinity'."
> Attributes: "Having the 'Divine' Attribute counts as having the 'Divinity' Skill and vice versa."

So skill identity is queryable and aliasable:

```yaml
countsAs: [divinity]
```

and `hasSkill("divinity")` checks both real skills and aliases. This matters because
Scáthach's *God Slayer* and Karna's *Vasavi Shakti* both key on "the DU has Divinity", and
Vasavi Shakti reads the **rank** of Divinity, so the alias must carry a rank.

---

## 15.7 Copied and granted abilities

Scáthach's *Wisdom of Dún Scáith* is the hardest ability in the reference set to model:

> *"When Scáthach is Summoned, she is given a list of Skills (preferably Rank B to Rank A) that
> must have an Active effect, of all other Servants on the field (excluding Class Skills). She
> can then select two of them, and use their effects as effects of this Skill."*

With an exclusion list:
> *"Natural Body, 'Mystic Eye' Skills, 'Mana Burst' Skills, Kishu no Ma … Skills that a Servant
> is physically born with or are part of their physical bodies; and Skills that are extremely
> unique to a Servant cannot be copied. Rank EX Skills cannot be copied."*

**DECISION.** Every ability carries a `copyable` field:

```yaml
copyable:
  allowed: true | false
  reason: "physical"    # when false: "physical" | "unique" | "classSkill" | "rankEX"
```

The copy operation creates a **granted ability** on Scáthach: a new ability document whose
`phases` are copied by reference (`copiedFrom: <abilityUuid>`), with Scáthach's own rank
(`A+`), cooldown (`4◈-⅓◈`), and mutual-exclusion set. Copying by reference rather than by value
means a later content fix to the source ability propagates.

The setup UI is a GM-facing dialog: the GM selects which abilities to offer, Scáthach's player
picks two. Ch. 36 walks through it.

### It had never worked, in three separate ways

Authoring Scáthach was the first time the grant was run against a real board, and it produced
nothing at all. Three defects, each sufficient on its own:

1. **`copyCandidates` reads the board snapshot**, whose ability entries carried no `phases` — so
   `canCopy`'s *"must have an Active effect"* test saw an empty list and refused **every
   candidate in the game** as `notActive`. The snapshot now carries `hasPhases`, a boolean rather
   than the phase list: the question is one bit, and copying every Servant's phases into every
   board snapshot to answer it is a great deal of data.
2. **`kind` and `passive` were read against a schema that declared neither**, so *"excluding
   Class Skills"* and the passive test both saw `undefined`. Had (1) been fixed alone, every
   class skill and every passive on the field would have been offered.
3. **The cooldown was `"4◈−⅓◈"` with a U+2212 MINUS SIGN**, which `parseTick` rejects, written
   to `cooldown.value` — a field the schema does not have. Every copy the grant ever made came
   back reading zero: reusable every Turn, for ever. The two characters are visually identical
   in most fonts, which is why `test/unit/tick-literals.test.mjs` now checks every ◈ expression
   written anywhere in the source.

### The exclusion set is the rule

*"Cannot be used if Wisdom of Dún Scáith (Skill 2) or (Clairvoyance) is on Cooldown"* — and the
same sentence on each of the other two. Three abilities, one mutual gate, expressed as a shared
`exclusionSet` plus an `abilityOffCooldown` requirement with `excludeSelf` (§7.6, §15.4).

Two of the three are copies that do not exist until she is summoned, and the third —
*Clairvoyance* — ships with fixed content. Both halves have to spell the set the same way, or the
gate matches nothing: it was authored `dunScaith` against the grant's `wisdomOfDunScaith`, and
both loaded, both validated, and the rule was simply absent. Same failure mode as a one-sided
`sameTurnExclusive`. `test/unit/exclusion-sets.test.mjs` holds the authored sets against the ones
the engine writes.

Related mechanisms:
- Semiramis's *Double Summon* grants the `Double Summon: Caster` skill for 1◈ via a buff.
- Master Essences grant rule elements to the contracted Servant.
- Semiramis's `[Semiramis' Poison]` items grant the `Queen's Poison` status when consumed.

All four are the same operation: **temporarily add an ability or rule element to a unit, from
an external source, with its own lifetime.** One mechanism, `GrantedAbility`, with a source and
a duration.

---

## 15.8 Items

The rulebook has a minimal item system:

> *"Note: Items cannot be traded/given/passed to other Units unless stated."*

with exactly one item in the reference set — `[Semiramis' Poison]`, which *is* explicitly
passable (*"any number of [Semiramis' Poison] can be passed from Semiramis to that Unit (once
per Turn)"*), and one referenced but undefined — `[Gold Needle]` (cures Petrify).

```ts
interface Item {
  id: string;
  name: string;
  quantity: number;
  transferable: boolean;
  transferRange: number;          // 1 = "directly next to"
  transfersPerTurn: number;
  consumeEffect: Phase[];
}
```

Kept deliberately thin. Items are an ability with a quantity.

### Acquisition

The rulebook describes exactly one way to **obtain** an item — being handed one — and "Items
held" is a blank slot on all 29 Servant sheets. Nothing drops an item on a panel and nothing
awards one on a kill, so there is no acquisition *system* to speak of; there is a moment at
which a unit comes to hold something, and two code paths reach it: `giveItem` and the
`itemGrant` intent (which is how Semiramis' *Item Construction* conjures a Poison from nothing).

Both ask `rules/items.mjs#acquisitionTarget` first, because one Servant redirects:

> *"Items held: Pale Rider cannot hold Items. All Items that would be obtained by Pale Rider are
> instead obtained by his Master if he/she is within a 2 panel area."*

Two halves, independently satisfiable, and the seam enforces both: `cannotHoldItems` refuses,
`itemHandling: "redirectToMaster"` re-routes, and a redirect with no Master in reach lapses back
to the refusal — which is what the clause's own *"if"* says happens. Verified live: Semiramis
passes a Poison to an adjacent Pale Rider and his Master, two panels away, ends up holding it;
push the Master to three panels and the pass is refused with nothing moved.

It is a **seam** rather than a branch inside `giveItem` because the clause is about *obtaining*,
not about being given. The day a drop or a kill reward is added it asks the same question and
inherits the answer. The redirect lives at the `itemGrant` intent so that every writer is
covered including future ones; `giveItem` asks it too, so it can *refuse* with a reason rather
than let an item silently land elsewhere.

**NOT routed through `guardsOf`.** Pale Rider's `RelationshipProxy` substitutes his Kagome
Spirits for him in the four §16.4 relationship rules. This is a separate line on his sheet and
it says *"his Master"*.

---

## 15.9 The ability lifecycle

```
                       ┌───────────┐
                       │ AVAILABLE │
                       └─────┬─────┘
        declare              │
                             ▼
                    ┌─────────────────┐
                    │   VALIDATING    │  requirements, gates, budget
                    └───┬─────────┬───┘
              fail      │         │  pass
                        ▼         ▼
                 ┌──────────┐  ┌──────────┐
                 │ REFUSED  │  │TARGETING │
                 └──────────┘  └────┬─────┘
                        cancel ◀────┤
                                    ▼
                             ┌────────────┐
                             │ CONFIRMING │  costs shown, legality final
                             └──────┬─────┘
                                    ▼
                             ┌────────────┐
                             │  PAYING    │  costs deducted
                             └──────┬─────┘
                                    ▼
                             ┌────────────┐
                             │ RESOLVING  │  phases in order
                             └──────┬─────┘
                                    ▼
                             ┌────────────┐
                             │ COOLDOWN   │  → AVAILABLE when ready
                             └────────────┘
```

Cancellation is free before `PAYING`. After `PAYING`, the ability is committed — an
interruption (a Command Spell) modifies the resolution rather than refunding it.

---

## 15.10 The ability sheet contract

Each ability renders on the actor sheet as a card showing:

- Name, rank, source (class/personal/NP), and type badges (`Spell`, `Attack Skill`, `NP`,
  `Categorized as NP`).
- Cooldown as a progress indicator: `3/9 turns` with the ready-turn.
- Costs, with affordability highlighted (a red Fragarach token count when below 3).
- Requirements, with unmet ones listed and explained.
- A one-click use button, disabled with a tooltip reason when unusable.
- The full effect text, authored, so the player can read the card as written.

The "disabled with a reason" affordance is important: the reference set is full of
mutual exclusions and gates, and a greyed-out button with *"Cannot be used: Het Gele Huis (NP)
is on cooldown for 4 more turns"* is the difference between a system that teaches its rules and
one that frustrates.

---

## 15.11 Summary of decisions

| # | Decision |
|---|---|
| D15.1 | Abilities are one flat document type with orthogonal flags, not a class hierarchy. |
| D15.2 | Active behaviour is an ordered list of typed phases; `reuse` chains target sets. |
| D15.3 | The three NP-scoping questions (cooldown, damage, seal) are independent booleans with derived defaults. |
| D15.4 | Costs are paid at confirmation, not declaration; targeting cancellation is free. |
| D15.5 | Presence Concealment and Mad Enhancement are ability **modes**, not self-applied effects. |
| D15.6 | Skills declare `countsAs` aliases; alias lookups carry rank. |
| D15.7 | Copied, granted, and essence-derived abilities all use one `GrantedAbility` mechanism. |
| D15.8 | "Only a Unit that has Moved or Attacked may use Active Skills" is read as a budget rule, not a prerequisite (Ch. 41 Q4). |
| D15.9 | `whenAttacking` skills present as toggles on the attack dialog rather than separate buttons. |

---

**Next:** [16 — Relationships](16-relationships.md)
