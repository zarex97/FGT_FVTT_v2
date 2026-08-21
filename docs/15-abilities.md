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
> **An `applyEffects` phase carries `effects:`, not `rules:`.** §15.2's own shape, and the
> distinction matters to the validator: `phases[].rules` is walked as *rule elements* and each
> entry must carry a `key`, while `effects` are effect applications. Both readers accept either
> shape, so Asterios's earlier `rules: [{ key: OnEvent, effect: ... }]` still works.
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
  | { kind: "modifyAttack"; modifiers: AttackModifier[] }   // for "used when attacking" skills
  | { kind: "script";       fn: string; args: Record<string, unknown> };
```

Phases execute in declaration order. `"reuse"` chains a phase to the previous phase's resolved
target set — the mechanism that makes `Brahmastra Kundala` apply Burn to exactly the units it
damaged.

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

### `whenAttacking` — the modifier skills

Karna's *Mana Burst (Flames)*, Castor's and Pollux's *Mana Burst (Light/Ancient)*, and
Kiritsugu's *Thaumaturgy: Reinforcement* are all "used when performing a Normal Attack" and
change the attack's parameters rather than performing one:

```yaml
id: karna-mana-burst-flames
timing: { window: whenAttacking, appliesTo: [normalAttack] }
cooldown: "3◈"
sameTurnExclusive: [karna-flash-of-the-sun-god]
phases:
  - kind: modifyAttack
    modifiers:
      - { key: BaseAttackOverride, sources: [
            { unit: self, component: str, factor: 1.0 },
            { unit: self, component: mag, factor: 1.0 }] }
      - { key: IgnoreMagicResistance }
      - { key: ElementTag, element: fire, portion: 0.5 }
      - { key: OnHit, condition: notEvaded,
          effects: [{ id: burn, duration: "2◈" }] }
```

The `modifyAttack` phase pushes modifiers into the pending `AttackContext`. The UI presents
these as toggles on the attack dialog rather than as separate buttons, which is a substantially
better interaction than making the player remember to click the skill first.

---

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
  | { kind: "predicate"; predicate: Predicate };   // escape hatch

type Cost =
  | { kind: "resource"; key: string; amount: number }
  | { kind: "masterHealth"; byNPRank: true }
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
(`A+`), cooldown (`4◈−⅓◈`), and mutual-exclusion set. Copying by reference rather than by value
means a later content fix to the source ability propagates.

The setup UI is a GM-facing dialog: the GM selects which abilities to offer, Scáthach's player
picks two. Ch. 36 walks through it.

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
