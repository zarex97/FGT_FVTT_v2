# 44 — Case Studies: The Expanded Roster

Seventeen Servants joined the reference set. Their bounded fields are covered in Chapter 43 and
their terrain interactions in Chapter 42; this chapter covers **everything else they demand** —
grouped by the mechanism rather than by the Servant, because the same requirement recurs across
several of them.

Full data in [Appendix D](D-servant-data-sheets.md).

---

## 44.1 Unit-shape mechanisms

### Hundred-Faced Hassan — one Servant, up to ten bodies

> *"Hassan's Master has a total of 100 Hassans. Hassan is only defeated when all 100 are
> defeated. There can only be a maximum of ten on the field. Each is counted as a separate Unit,
> with its own Stats and Cooldowns. Each is coded with a number in ascending order. One
> Hundred-Faced Hassan counts as **0.5 of a Unit** for the turn budget."*

This is `LinkedUnitGroup` (Ch. 16 §16.8) with three properties the Dioscuri did not need:

```yaml
linkedGroup:
  id: hassan-hundred-face
  membership: pool                     # NOT a fixed member list
  poolSize: 100
  maxDeployed: 10
  budgetWeight: 0.5
  linkedDeath: false                   # the OPPOSITE of the Dioscuri
  sharedCooldowns: false               # also the opposite
  defeatCondition: poolExhausted
  deployment:
    when: roundStart
    where: ownHalfOrWithin2OfHomeBase
```

**`membership: pool`** is new. The Dioscuri are two named units; Hassan is a *reservoir* from
which bodies are drawn. Deployment adds a unit, defeat removes one from both the field and the
pool, and the Servant is only truly dead at zero.

**`linkedDeath: false` and `sharedCooldowns: false`** are the inversions. Losing one Hassan does
nothing to the others, and each carries independent cooldowns — which is the entire point of
the design.

The NP consumes `4d6` from the pool (mean 14), so using it twice costs roughly a third of her
total existence. That is a resource cost expressed in *bodies*.

The source carries two open bracket-questions — *"maximum of ten (twenty?)"* and *"0.5 (0.25?)
of a Unit"*. Both are exposed as ruleset settings with the un-bracketed value as default, and
recorded as **Q46**.

### Katō Danzō — fake death

`Karakuri Genpō: Kirihanasu`, used when she would take fatal damage:

> *"First, the Player **privately informs the GM** that it wants to use this Skill. Instead of
> taking damage, the player Moves Danzō to another panel as per her Move, and Presence
> Concealment is Activated regardless of Cooldown; the GM makes a note of the panel. Meanwhile,
> the opposing Player is **shown and informed that Danzō has been defeated**. From this point an
> invisible Danzō is secretly controlled by her Player by informing the GM of her Moves; she does
> not count toward the number of Units that Move. The concealment lasts until Danzō Attacks, at
> which point her survival is revealed to all players."*

This is the first mechanic in either roster that requires the system to **lie to a client**.

Everything else in the information model (Ch. 26 §26.6) is about *withholding* — a client is not
told something. Here a client must be **actively told something false**: an opponent sees a
death message, a removed token, and a defeat log entry for a unit that is alive.

**DECISION.** Implement as a **GM-mediated shadow state**, not as a client-side illusion:

```
1. Danzō's controller sends a private request to the GM client.
2. The GM applies the real state: Danzō alive, relocated, PC active, hidden.
3. The GM broadcasts a FABRICATED defeat: the token is removed from every client
   except the GM's and the owner's, and a defeat entry is written to the public log.
4. The real state lives only on the GM client and the owner's client.
5. Danzō's movement is relayed through the GM; she is absent from the public board state.
6. On her next Attack, the GM broadcasts the correction: a "survived" entry, the token
   reappears, and the public log is annotated rather than rewritten.
```

**RISK — the highest in either roster.** This deliberately desynchronizes clients, which every
other part of the design works to prevent. The desync detector (Ch. 25 §25.10) must be taught to
exempt units in this state or it will fire every round. And the audit log now contains an entry
that was false when written, which conflicts with the "report outcomes faithfully" principle
behind Chapter 30.

**Mitigation.** The public log entry is written as `kind: "defeat", provisional: true`, and the
GM's private log records the truth immediately. When the deception ends, the public entry is
**annotated, never deleted** — so the final record is honest about both what was believed and
what was true. A GM can also disable the mechanic per-world; it is the only content in the set
with a "requires GM comfort" flag.

This mechanic is also **only meaningful with Fog of War enabled**, exactly like Yan Qing's
`Doppelganger` (§44.4). Both declare `requiresFogOfWar: true` and fall back to plain Presence
Concealment when it is off — a fallback the source states explicitly for Yan Qing and which we
extend to Danzō by analogy.

### Pale Rider — a Servant that cannot be damaged or attack

```
Base Health: -      Range: -      Health: -
1. Pale Rider cannot take damage.
2. Its Master's ZON is increased by X panels, X = Pale Rider's MOV.
3. Pale Rider cannot perform Normal Attacks.
4. Pale Rider cannot Evade, Block, or Counter.
```

A `CombatUnit` with no health resource at all — not zero, *absent*. Everything it does happens
through auras (`Contagion`), a field (`Doomsday Come`), and summons (`Kagome Spirits`).

**DECISION.** `health: null` is a legal `Resource` value meaning "cannot be damaged and cannot be
healed". The damage pipeline early-exits at stage 0 with `negatedBy: "invulnerable-by-nature"`.
This is distinct from `Invuln` (a buff, removable, halved vs NP) and from `Anti-Purge` (a buff
that beats Pierce). Kagome Spirits share it.

And the Master–Servant relationship rules are **redirected**:

> *"The following Servant-Master Relationship Rules have no effect between Pale Rider and its
> Master; but apply between **Kagome Spirits** and Pale Rider's Master (replace 'Servant' with
> 'Kagome Spirit')."*

So Master protection, zone denial, and Cover are computed against the *summons* rather than the
Servant. `relationshipProxy: "summons"` on the unit, consumed by the `canAct`-gated protection
predicate (Ch. 16 §16.4). One field, no special case.

Pale Rider also cannot hold Items — they fall to its Master if within 2 panels, otherwise they
drop on the panel where they were released. `itemHandling: "redirectToMaster"`.

### Achilles — mounted and dismounted

> *"When Achilles Acts, the player must state whether he is **Mounted** or **Dismounted**.
> Achilles is always Dismounted when it is not his Turn. If Mounted at the start of a Combat
> Phase, he can Dismount at the start of the Phase; but he cannot Mount when he initiates Combat
> while Dismounted."*

A **stance** — a mode (Ch. 15 §15.6) with three unusual properties:

1. **Declared per action**, not toggled with a cooldown.
2. **Forced to a default outside your own turn** — always Dismounted when defending.
3. **Asymmetric transitions**: you may drop out of Mounted at the start of a Combat Phase, but
   never into it.

```yaml
stance:
  id: achilles-mount
  states: [mounted, dismounted]
  default: dismounted
  declaredAt: actionStart
  forcedOutsideOwnTurn: dismounted
  transitions:
    - { from: mounted, to: dismounted, at: combatPhaseStart }
    # no mounted-entry transition mid-phase
```

Each state gates a different ability set: Riding's passives and `Troias Tragōidia` require
Mounted; `Dromeus Komētēs`, `Runner Comet`, and the duel NP require Dismounted. `Andreias
Amarantos` and `Achilles' Heel` only matter Dismounted.

**DECISION.** `stance` is a new ability-adjacent construct distinct from `mode`: modes have
durations and cooldowns, stances are free but constrained by *when* they may change.

---

## 44.2 Damage and defence mechanisms

### Proto Gil — Magic Resistance as dice

> *"(Passive 1) All MAG damage received is reduced by **3d20**; if NP, the number of dice rolled
> is doubled."*

Every other Magic Resistance in the game is a rank comparison plus a percentage. Proto Gil's is a
**flat dice reduction** — structurally the same shape as Battle Continuation, not Magic
Resistance.

**DECISION.** `Resistance` gains a `mode` field:

```yaml
- key: Resistance
  component: mag
  mode: dice                        # instead of "rankComparison"
  formula: "3d20"
  npDiceDoubled: true
  # no negatesUpToRank clause — there is no negation at all
```

Note it never fully negates, unlike the rank version. Proto Gil is *steadier* against magic but
never immune, which is a meaningfully different defensive profile. He is also `Rank C (E)` —
elevated from E by his armour — so the parenthetical notation now has a second instance
(alongside Kiritsugu's `LUC: EX (E)`) and is formalized: `displayRank (baseRank)`, with the
elevated value authoritative and the base recorded for effects that care about the intrinsic
value.

### Achilles — Andreias Amarantos and the Heel

`Andreias Amarantos` nullifies damage by the **attacker's** Divinity rank:

| Attacker's Divinity | Damage taken |
|---|---|
| None | **0** |
| Rank E | 50% |
| Rank D | 75% |
| Rank C+ | 100% (normal) |

A defensive modifier keyed on an attacker property, with **total immunity** as the default case.
Against the ten Divinity-bearing Servants in the roster he is merely tough; against the rest he
is untouchable. That is the design, and it makes `Divinity` a targeting consideration.

`Achilles' Heel` is the counter-play, and it is the most involved single mechanic in the roster:

```
Whenever Achilles is in a Combat Phase while UNMOUNTED, the attacker may declare a
Heel Attack. Achilles cannot Block it. If he fails to Evade, the Heel Attack succeeds
with probability:

  base:  Front 0%  ·  Sides 5%  ·  Back 10%
  +5%  if the AU's Agility >= Achilles'
  +5%  if the attack was at Range 3 or higher
  +5%  if the AU initiated combat (not a counter)
  −10% if the attack was AoE
  +10% if attacked from within Fog of War
  +25% on a successful Luck Check

On success: damage IGNORES all defensive buffs and damage-reducing effects, and
  1. Andreias Amarantos is permanently lost.
  2. Dromeus Komētēs' passives are lost and penalized:
       MOV −1 unmounted; Evade rolls +1 unmounted; Runner Comet's buffs drop to 10%.
On failure: Achilles successfully Evades.
```

Three things make this novel:

**A declared sub-attack with its own hit table.** The attacker opts in at declaration; it is
resolved *after* a failed Evade, as a second gate. So the reaction ladder gains an optional
branch between step 2 and step 3.

**Six conditional modifiers, one of which is a Luck Check.** All expressible as
`CheckModifier`-shaped entries on a `weakPointAttack` spec.

**A permanent, irreversible state change on the defender.** Not a debuff — it cannot be cured,
it has no duration, and it *rewrites two of his abilities*. Modelled as a permanent `status`
effect (`heelWounded`) whose rule elements suppress `Andreias Amarantos` and re-parameterize
`Dromeus Komētēs` and `Runner Comet`.

**DECISION.** `weakPoint` is a general ability-adjacent construct:

```yaml
weakPoint:
  id: achillesHeel
  availableWhen: { predicate: ["self:stance:dismounted"] }
  declaredBy: attacker
  blockable: false
  resolvesAfter: failedEvade
  baseChanceBySide: { front: 0, left: 5, right: 5, back: 10 }
  modifiers: [ … ]
  luckCheckBonus: 25
  onSuccess:
    ignoresDefensiveBuffs: true
    then: [{ key: ApplyEffect, target: self, effect: { id: heelWounded, duration: permanent } }]
  onFailure: { result: attackEvaded }
```

The construct is general enough that any future "aim for the weak spot" content reuses it.

### EMIYA — Rho Aias, a shared absorbing barrier

> *"Used when any allied Unit (including EMIYA) within 3 panels is about to be hit by a Noble
> Phantasm. Rho Aias has **1400 Health** and takes the damage of the enemy's NP. **For every 200
> Health Rho Aias loses, EMIYA loses 100 Health.** If the NP deals more than 1400, the remainder
> is dealt to the DUs. If the NP is a 'thrown weapon', Rho Aias' Health cannot drop below 1.
> EMIYA's Health cannot drop below 1 from this. All Units in a 3×3 around the protected Unit also
> receive its protection. Every time Rho Aias is used after the first, its Health is restored by
> half of its current Health."*

Structurally a `Shield` (Appendix A) with four extensions:

| Extension | Handling |
|---|---|
| Protects units other than its bearer | `shieldScope: { anchor: protectedUnit, shape: rect3x3 }` |
| Damage to the shield damages a *third party* | `bleedThrough: { unitId: owner, ratio: 0.5, floor: 1 }` |
| A category of attack cannot break it | `indestructibleAgainst: ["thrownWeapon"]` |
| Regenerates by half on reuse | `onReuse: { restore: "50% of current" }` |

`thrownWeapon` is a new **NP sub-classification** — a property of the attacking NP, not of the
target. It joins the NP tag vocabulary (Ch. 43 §43.8) as an unordered qualifier.

Note the reuse clause is a *decay*: half of *current*, not of maximum. So Rho Aias degrades with
each use — 1400, then 700 if fully spent, and so on.

### Quetzalcoatl — a mount that soaks differently

> *"Quetz or her Master cannot be targeted while Riding the Quetzalcoatlus. If hit with an AoE,
> the Quetzalcoatlus receives **full** damage, Quetz receives **50% Total Damage**, and her
> Master receives **no** damage and effects."*

Three protection tiers from one AoE — the third point in the cross-level protection model
(Ch. 20 §20.7) and the reason that model has an `aoePassengerFactor` per role rather than a
single value.

---

## 44.3 Targeting and ability-shape mechanisms

### Bellerophon and Troias Tragōidia — full-board lines

> Medusa: *"Hits a **1×13 or 13×1** panel area in a straight line **in any direction (including
> diagonal)** next to Medusa. Hits in **both directions** (front and back); but only one
> direction on the Large Board."*

Two novelties for the targeting engine (Ch. 09):

**Diagonal lines.** Every previous directional shape was cardinal-only. `line` gains
`allowDiagonal: true`, and diagonal lines use Chebyshev stepping.

**Bidirectional projection.** The line extends *both ways* from the caster on the 13×13 board and
one way on the 25×25 — a **board-size-dependent shape**, joining the HGoB's footprint in the
`*ByBoardSize` pattern.

Achilles's `Troias Tragōidia` is the same shape delivered as a Riding Attack over 13 panels, with
`X` and `Y` computed from remaining MOV and from the number of units actually hit — so its
magnitudes depend on the *result* of its own targeting. `@count(hitTargets)` joins
`@count(targets where …)` in the expression language.

### Proto Gil — attack, reposition, attack again

> *"Whenever Proto Gil Attacks an enemy Unit at a Range of 2 or higher, he can **Move to any
> panel directly next to the DU and perform an additional Normal Attack** on that DU; if the DU
> Blocked the first Attack it must also Block the second, while if it successfully Evaded the
> first it may choose to Block or Evade the second."*

A **movement inserted into a Combat Phase**, plus a *reaction lock*: the defender's first choice
constrains their second. That second clause is a small piece of state on the phase
(`reactionLock: { blocked: "mustBlock", evaded: "free" }`) and it is the first time a defender's
earlier decision restricts a later one.

### The random-debuff table — Bab-ilu

Three `1d20` rolls against a twenty-entry debuff table, with duplicates stacking (or extending
duration for non-stacking debuffs), and entry 9 (`No Buff`) scaling with the number of 9s rolled.

The `kind: roll` phase from Scáthach's `Primordial Rune` (Ch. 36 §36.4) already covers this;
Bab-ilu needs only `dice: 3`, `duplicateBehaviour: applyTwiceOrExtend`, and one per-entry
`countScaled` flag.

Yan Qing's NP is the same shape with `2d4`, **reroll-on-duplicate**, and "a 4 applies all three".
`duplicateBehaviour: reroll` is the third variant.

### Medusa — Mystic Eyes with facing and line of sight

> *"Cannot be used on a Unit if there is an obstacle/obstruction between Medusa and the target,
> and can only be used if Medusa is **facing** the targeted Unit."*

Chapter 08 §8.6 states flatly that F/GT has no line of sight. **This is the exception**, and it
is scoped to a single ability: `requiresClearPath: true` plus `requiresFacing: true`.

**DECISION.** Do **not** introduce general LOS. Implement `requiresClearPath` as a per-ability
targeting predicate that walks the panel line and rejects if any panel is occupied. That keeps
the global no-LOS rule intact and makes the Mystic Eyes' restriction visible as the special case
it is.

The outcome is tiered by target class and MAG rank, with a *second* Agility Check on the middle
tier — a nested check ladder inside a single ability. And the inflicted debuffs *"ignore the DU's
debuff resistance due to Magic Resistance"* specifically, while remaining subject to other
resistances: `ignoresResistanceFrom: [magicResistance]`.

### Anastasia — Blind as a self-buff

> *"When Anastasia performs a Normal Attack at Range 1–2 while inflicted with **Blind**, it does
> not have a chance of Missing; instead it gains **Pierce & Ignore Def**, and the DU's Evade roll
> is increased by 4."*
> *"(Active) Anastasia gains **Blind** until the end of the Combat Process."*

A Servant who deliberately inflicts a debuff on herself to convert it into an offensive buff.
Mechanically this is the same shape as Van Gogh's curse economy (Ch. 35) — self-harm as a
resource — but it works by *reinterpreting* an existing debuff rather than by consuming stages.

No new machinery: a passive with `predicate: ["self:effect:blind", "attack:range:lte:2"]` that
suppresses Blind's miss clause and adds the effects.

---

## 44.4 Identity and information mechanisms

### Yan Qing — Doppelganger

> *"Yan Qing can disguise himself as **any other character (figurine), including Masters and
> Servants**. However, it is only the appearance. All Parameters and Stats remain the same.
> Skills and NPs except Presence Concealment cannot be used while Active. Automatically
> deactivated when he takes damage equal to 10% of his Max Health or more in one Attack."*

A **cosmetic identity swap** — the token's name and image change, nothing else does. Like Danzō's
fake death it only means anything with Fog of War, and the source says so and specifies the
fallback: without Fog of War it behaves as `Presence Concealment — Rank B+`.

**DECISION.** `disguise` is a token-presentation override applied per-viewer:

```yaml
- key: Disguise
  appearAs: chosenUnit                 # name, image, and disposition colour
  visibleTo: [owner, gm]               # everyone else sees the disguise
  breaksOn:
    - { event: damageTaken, threshold: "10% of maxHealth", perAttack: true }
    - { event: abilityUsed, except: [presenceConcealment] }
  fallbackWithoutFogOfWar: { grantsPresenceConcealment: "B+" }
```

Because it changes only presentation, it does not desynchronize game state — which is exactly
why it is safe and Danzō's fake death is not.

### Serenity — Secret Poison

> *"They can be inflicted with **Secret Poison** instead, where the debuff and total Poison
> Damage taken is only revealed after Presence Concealment is deactivated."*

A **deferred-disclosure effect**: applied and ticking normally, but invisible to the victim's
controller until a trigger fires, at which point the accumulated damage lands.

**DECISION.** This is `EffectVisibility` (Ch. 11 §11.10) with a new `deferredUntil` field, plus
**deferred damage application** — the damage is computed and recorded per tick but only written
to Health when disclosed. That second half is genuinely new: it means a unit's displayed Health
can be *higher* than its true Health.

**RISK.** A unit that would have died from hidden Poison is walking around alive. **DECISION.**
Secret Poison damage is applied immediately to real Health but the *cause* is hidden — the
victim sees their Health drop with an unattributed entry. This preserves state integrity at the
cost of a weaker secret, and it is the right trade. Recorded as **Q47**.

**As built.** Not a second effect definition, and not `deferredUntil`: it is the ordinary `poison`
instance carrying `visibility: gmOnly` and `attributionHidden: true`, set by the applying action
**only when the inflicter is currently concealed**. That last condition is what makes the clause
self-limiting rather than a mode — the disclosure trigger is the concealment ending, so an
unconcealed Serenity has nothing to hide behind and poisons openly.

Three pieces had to become real, and all three were fields with no writer:

| Piece | Where it lives | What it was |
|---|---|---|
| `visibility` / `attributionHidden` on the instance | `data/misc.mjs` | On the schema since `0.2.0`; `io.createEffects` did not mention either, so an effect could be *constructed* hidden and was always *created* public. |
| The tally | `system.hiddenDamage`, keyed by cause | New. Accumulated by `io.adjustHealth` from the intents of the write that takes the Health, and cleared key by key on disclosure — assigning `{}` to an ObjectField **merges**, so the obvious clear is a no-op. |
| The disclosure | `engine/concealment.mjs` | New. Reveals every instance this Unit inflicted, posts the totals, clears the tally. |

The victim's own client is told nothing while it is hidden: §11.10's `visibility` is honoured by
the token HUD, which is the only surface that lists effects. Only the **explicit** settings are
applied there, not §11.10's polarity default — that default would hide every ordinary buff from
everyone but its bearer, which no sheet in the reference set asks for.

**Measured.** Five Units inside Zabaniya's 2-panel cloud took 60 Poison damage each over two
Rounds with no attribution and no entry on their own HUD; deactivating her Presence Concealment
revealed all five instances and posted *"Secret Poison revealed: Hassan of Serenity was the
source"* with each total.

### Jack the Ripper — Information Erasure

> *"Whenever Jack leaves the Detect area of an enemy Unit, **erase all information recorded by
> that Player about Jack**, if any had been recorded in the Player's Notebook (let the GM do
> this)."*

In a tabletop game this is an instruction to a human. In Foundry it is implementable: the
closed-info knowledge model (Ch. 26 §26.6) tracks what each player has learned, and this clears
that record.

**DECISION.** Implement only when closed-info mode ships (deferred past v1). Until then it is a
GM-facing reminder posted to chat when the trigger fires — honest about being unautomated rather
than silently doing nothing.

---

## 44.5 Contract and economy mechanisms

### Medea — Rule Breaker

> *"Deals 1x damage plus 100 and removes all buffs from the DU. If the DU is a Servant (and it
> failed to Evade), Rule Breaker will **cut the Servant's Contract with its Master and remove the
> Master's Command Spells**; the Servant's Contract, along with three Command Spells, will be
> given to Medea."*

The only ability that performs a **hostile contract transfer** outside the normal contracting
rules (Ch. 16 §16.2) — no adjacency requirement, no roll, no Independent Action check.

```yaml
- kind: contract
  operation: seize
  target: reuse
  bypassesIndependentAction: true
  bypassesContractRoll: true
  stripsSourceMasterSpells: true
  grantsSpells: 3
```

**Interaction to get right:** the four Servants with `Independent Action A+` or `EX`
(Proto Gil, Anastasia, Kiritsugu, Serenity) are described as *"cannot be contracted by enemy
Masters and Casters"*. Does Rule Breaker override that?

**DECISION.** No. `Independent Action` at A+/EX is an absolute, and Rule Breaker's
`bypassesIndependentAction` applies to the *roll count*, not to the absolute immunity. Against
those four the buff-removal and damage still land; the contract seizure does not. Recorded as
**Q48**.

### EMIYA — copying enemy Noble Phantasms

> *"Whenever an enemy Unit within 2 panels uses a **Weapon-type** Noble Phantasm, record it.
> (Active) Emiya creates a copy of a Weapon-type NP of any allied Unit, or of a recorded enemy
> one, **as an Item**. Destroyed after 2◈ Turns. While Equipped, his Normal Attacks gain that
> NP's Passive effects and Range, and he may use its Active effect once, destroying the Item."*
> *"Can be used together with **Broken Phantasm**: Range +1 (or the AoE grows by 1 panel each
> direction), Total Damage +100%, all applied effect magnitudes **doubled**, and that Item can
> never be created again."*
> *"**Divine Constructs cannot be copied** (except black Arondight)."*

This is Scáthach's `Wisdom of Dún Scáith` (Ch. 36 §36.4) taken considerably further: it copies
*Noble Phantasms* rather than skills, it copies them from **enemies**, it copies **at runtime**
rather than at summon, and the copy is an **Item** with its own lifetime.

Reuses: the `copyable` flag system, `GrantedAbility`, and the Item model. Adds:

- `weaponType: true` on NP definitions — a new classification, alongside `divineConstruct: true`
  for the exclusion (with a per-NP `copyableException` for black Arondight).
- **Runtime recording** of enemy ability use within a radius — the same `OnEvent` shape as
  Semiramis's `Dove` mark.
- **Broken Phantasm** as a *modifier applied to a copied item's use*, with a permanent
  consumption side effect.

`Aria` (0/6) is an ordinary `Resource` gained per Combat Phase, spent entirely to activate UBW.

### Ozymandias — a Noble Phantasm gated on Round 7

> *"Can only be used after **7 full Rounds** have passed."*

Every other NP uses the global gate (Round 6, or 4 for Assassin). This is a **per-ability gate
override**, and it composes with the global one by `max()` — the same rule as the cooldown
interaction in Ch. 07 §7.9. `npGateRound: 8` on the ability.

---

## 44.6 Aggregate: what the expanded roster demanded

| Category | New constructs |
|---|---|
| **Unit shape** | `membership: pool`, `health: null`, `relationshipProxy`, `stance`, `itemHandling` |
| **Defence** | `Resistance mode: dice`, `weakPoint`, shield `bleedThrough`/`shieldScope`/`indestructibleAgainst`, tiered AoE soak |
| **Targeting** | diagonal lines, bidirectional projection, `requiresClearPath`, `requiresFacing`, `reactionLock`, mid-phase reposition |
| **Fields** | the whole of Ch. 43 |
| **Terrain** | the whole of Ch. 42 |
| **Information** | `Disguise`, fabricated-defeat shadow state, `deferredUntil` visibility |
| **Economy** | contract `seize`, NP copying as Items, Broken Phantasm |
| **Time** | `kind: schedule`, state-history ring buffer |
| **Classification** | ordered NP tag scale, `weaponType`, `divineConstruct`, `normalHuman`, `displayRank (baseRank)` |

**Script elements needed across all 17: four.**

| Script | Servant | Why |
|---|---|---|
| `nurseryRhyme.rewind` | Nursery Rhyme | Restoring an arbitrary historical snapshot across a unit set |
| `emiya.brokenPhantasm` | EMIYA | Rewriting a copied NP's formula and doubling arbitrary effect magnitudes |
| `paleRider.innocentWorld` | Pale Rider | Determining which parameters are *highest* and applying the corresponding branches, with the no-parameters and tied-parameters cases |
| `achilles.heel` | Achilles | The six-modifier probability table with a Luck Check branch, resolved between ladder steps |

Four scripts across roughly 130 new abilities — about **3%**, holding the ratio from the original
twelve (Ch. 36 §36.8) despite the new roster being substantially more exotic. Two of the four
(`innocentWorld`, `heel`) are strong candidates for generalization into rule elements once a
second example of each shape appears.

---

## 44.7 Summary of decisions

| # | Decision |
|---|---|
| D44.1 | `LinkedUnitGroup` gains `membership: pool` for Hassan; linked death and shared cooldowns are per-group flags, not assumptions. |
| D44.2 | Fake death is a GM-mediated shadow state with a provisional, later-annotated public log entry, a desync-detector exemption, and a per-world disable. |
| D44.3 | `health: null` means intrinsically undamageable — distinct from `Invuln` and `Anti-Purge`. |
| D44.4 | `relationshipProxy` redirects Master-protection rules to a unit's summons. |
| D44.5 | `stance` is distinct from `mode`: free to change, but only at declared transition points. |
| D44.6 | `Resistance` gains a `dice` mode that never fully negates. |
| D44.7 | `weakPoint` is a general construct resolved after a failed Evade, with a per-side base chance and conditional modifiers. |
| D44.8 | No general line of sight; `requiresClearPath` is a per-ability targeting predicate. |
| D44.9 | `Disguise` is presentation-only and per-viewer, so it never desynchronizes state. |
| D44.10 | Secret Poison hides the *cause*, not the damage — state integrity wins over secrecy. |
| D44.11 | Rule Breaker's seizure does not override absolute Independent Action immunity. |
| D44.12 | Per-ability NP round gates compose with the global gate by `max()`. |

---

**Next:** [37 — Content Pipeline](37-content-pipeline.md) · or back to the [index](00-index.md)
