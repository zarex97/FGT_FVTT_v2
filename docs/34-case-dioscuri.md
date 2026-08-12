# 34 — Case Study: The Dioscuri

Castor and Pollux are one Servant occupying two tokens. They break the assumption that a unit is
a unit — every subsystem that counts units, checks distance, applies cooldowns, or resolves
death has to handle a pair. This is the acceptance test for `LinkedUnitGroup`.

---

## 34.1 The binding rules

```
Castor and Pollux are summoned as two separate Servants as one. They have their individual
stats; however, the maximum distance between the two is 2 panels. If either one is defeated,
the other is also defeated regardless of remaining Health. Both are respectively allowed to
Move and Attack once during their Turn; each one counts as 0.5 Units.

When calculating whether damage dealt needs to be reduced if too far from their Master, as
long as the other counterpart is within their Master's ZON, damage dealt is not reduced.

When either uses a Skill, the Skill enters Cooldown for both.
```

Six distinct bindings, and each hits a different subsystem.

---

## 34.2 The `LinkedUnitGroup`

```yaml
linkedGroup:
  id: dioscuri
  members: [castor, pollux]
  leash: 2                          # max Chebyshev distance between members
  linkedDeath: true
  sharedCooldowns: true
  budgetWeight: 0.5                 # each counts as half a unit
  zonSatisfaction: any
  modifierCombination: separate     # except for the joint NP — see §34.6
  summonTogether: true
  deathOrder: simultaneous
```

Introduced in Ch. 16 §16.8 as a general mechanism. This chapter shows what each field costs to
implement.

---

## 34.3 The leash

*"the maximum distance between the two is 2 panels"*

A **hard movement constraint**, not a penalty. Neither may move to a panel more than Chebyshev 2
from the other.

```js
function leashConstraint(unit, group, board) {
  if (!group?.leash) return null;
  const others = group.members.filter(id => id !== unit.id).map(id => board.units.get(id));
  return (destination) => others.every(o => chebyshev(destination, o.position) <= group.leash);
}
```

Folded into the movement cost function (Ch. 08 §8.3) as an `Infinity` cost, so the reachable-set
highlight automatically shows only leash-legal panels. A player dragging Castor sees the
highlight shrink as Pollux's position constrains him — the rule teaches itself.

**Edge case:** what if a *forced* movement (knockback, Kingprotea's displacement, a platform
scatter) would break the leash? The source does not say.

**DECISION.** Forced movement may break the leash; the pair must restore it on their next turn,
and while broken:
- neither may take a voluntary action other than movement that reduces the distance,
- the ZON "either counts" clause still applies,
- the joint NP is unusable (it requires adjacency anyway).

Recorded in Ch. 41. The alternative — dragging the partner along on knockback — produces
absurdities (a knockback that pulls a unit *toward* the attacker).

---

## 34.4 Linked death

*"If either one is defeated, the other one is also defeated as well regardless of remaining
Health."*

This runs **after** the revival chain, not instead of it:

```
Castor's health reaches 0
  └─▶ resolve Castor's revival chain (Ch. 31 §31.2)
       ├─ revived → nothing further happens; Pollux is fine
       └─ not revived → Castor is defeated
            └─▶ linked death: Pollux is defeated
                 └─▶ resolve POLLUX's revival chain
                      ├─ revived → ⚠ see below
                      └─ not revived → Pollux defeated
```

The awkward case: Pollux has a Guts buff and Castor does not. Castor dies, linked death kills
Pollux, Pollux's Guts revives her — and now she is alive with a dead partner, which the binding
forbids.

**DECISION.** Linked death **ignores revival** — it is `Death`-like, not damage-like:

> `Death`: *"If Death is successfully inflicted on a Unit, the DU is defeated. Ignores buffs and
> abilities that revive the Unit after being defeated."*

So linked death applies the `Death` semantics to the survivor. Rationale: the binding says
*"regardless of remaining Health"*, which reads as an absolute. And the alternative produces an
illegal board state. Recorded in Ch. 41.

```yaml
- key: OnEvent
  event: unitDefeated
  scope: linkedGroup
  then:
    - { key: Defeat, target: linkedPartners, mode: ignoresRevival, cause: linkedDeath }
```

---

## 34.5 Half-unit budget accounting

*"each one counts as 0.5 Units"*

So moving both Castor and Pollux consumes **one** Servant move from the faction's budget of 4,
and attacking with both consumes **one** of the 2 Servant attacks.

```js
function consumeBudget(unit, action, budget) {
  const weight = unit.linkedGroup?.budgetWeight ?? 1;
  const pool = poolFor(unit.kind, action);
  if (budget[pool].used + weight > budget[pool].max) return Refused(pool);
  budget[pool].used += weight;
  return OK;
}
```

Budget counters become fractional. Two consequences:

1. **Display.** `2.5 / 4` looks odd. The HUD renders half-pips: `●●◐○`.
2. **The boundary case.** With 3.5 of 4 servant moves used, may a single Dioscuri twin move?
   `3.5 + 0.5 = 4.0 ≤ 4` — yes. May a normal Servant? `3.5 + 1 = 4.5 > 4` — no. Correct and
   slightly surprising, so the HUD tooltip explains it.

**RISK.** Floating-point accumulation. Mitigated by storing budget in **halves** as integers
(`usedHalves: number`, max `8`) and rendering the division. No float ever touches the budget.

---

## 34.6 Shared cooldowns and the modifier question

*"When either Castor or Pollux uses a Skill, the Skill enters Cooldown for both."*

Both twins carry `Stars of the Chief God` and `Guardians of Navigation` as separate ability
items with identical content. Sharing means:

```yaml
- key: SharedCooldown
  group: dioscuri
  matchBy: name                     # abilities with the same name share state
```

Implemented by redirecting cooldown reads and writes to a group-level store keyed by ability
name. Each twin's sheet shows the same cooldown, and using either sets both.

Note the twins do **not** share all abilities: Castor has `Mad Enhancement` and
`Self-Replenishment`; Pollux has `Magic Resistance` and `Riding`. Only same-named abilities
share.

### `modifierCombination`

Normally the twins' buffs are separate — Castor's `Atk Up` does not help Pollux. But for the
joint NP:

> *"The effects of all Skills, buffs and debuffs on **both** Castor and Pollux are combined when
> calculating damage for this NP."*

So the NP's damage context collects rule elements from *both* units:

```yaml
- kind: damage
  modifierSources: [castor, pollux]     # union of both units' contributions
  formula:
    base:
      - { unit: castor, component: str, factor: 0.5 }
      - { unit: pollux, component: str, factor: 0.5 }
    multiplier: 3.5
    effects: [pierce, ignoreDef]
```

`modifierSources` on a damage phase is the general form — an ability whose damage reads more
than one unit's modifiers. Only the Dioscuri need it today, but "combined attack" is a
recognizable pattern.

**RISK.** Duplicate modifiers. If both twins have `Atk Up 15%` from the same `Guardians of
Navigation` cast, does the NP get +30%? **DECISION.** Yes — the source says "combined", and
deduplicating would require identity tracking across instances. It is also what makes the NP
worth using. Ch. 41.

---

## 34.7 ZON satisfaction

*"as long as the other counterpart is within their Master's ZON, damage dealt is not reduced"*

```yaml
zonSatisfaction: any
```

```js
function inZon(unit, board) {
  const group = unit.linkedGroup;
  if (group?.zonSatisfaction === "any")
    return group.members.some(id => baseInZon(board.units.get(id), board));
  return baseInZon(unit, board);
}
```

Three lines, and it is the mechanical justification for the pair's playstyle: one twin can range
far ahead while the other holds position near the Master, and both keep full damage — up to the
2-panel leash, which is exactly what stops it from being unlimited. Elegant design in the
source, and it costs nothing to implement once the group exists.

---

## 34.8 Castor's Avenger class skills

Castor is noted as an **Avenger**-class Servant, carrying three class skills the other reference
Servants do not have:

```yaml
- class-avenger:
    rank: B
    passiveRules:
      - { key: DamageModifier, direction: taken, value: 80, mode: flat, includesNP: true }
      - { key: DamageModifier, direction: dealt, value: 80, mode: flat, includesNP: true,
          predicate: ["attack:isCounter", "self:wasAttackedThisPhase"] }

- class-oblivion-correction:
    rank: C
    passiveRules:
      - { key: CritModifier, aspect: chance, value: 15 }

- class-self-replenishment-mana:
    rank: D
    passiveRules:
      - key: OnEvent
        event: [unitTurnEnd, actedTurnEnd]
        then:
          - { key: StatDelta, stat: health, delta: 40, clamp: true }
          - { key: CooldownDelta, ability: all, scope: np, delta: -2, unit: turns }
```

Two details:

**Avenger is a flat *increase* to damage taken.** +80 to everything including NP — a genuine
drawback, offset by the counter bonus. A rare case of a class skill that is net-negative in
isolation.

**Self-Replenishment's cooldown reduction is in literal turns, not ◈.** *"NP Cooldown is reduced
by 2 Turns"* — so `unit: turns` on the delta, distinguishing it from `delta: "-2◈"`. Content
authors will get this wrong constantly, so the validator warns whenever a cooldown delta is a
bare number without an explicit unit.

---

## 34.9 The paired buffs

`Stars of the Chief God` applies two named buffs to both twins:

```
'Pollux' buff: When the affected Unit performs a Normal Attack that does NOT Crit, apply
  S.Crit Up for ⅓◈ to all allied Units within 2 panels of himself (and Pollux if she is out
  of the Skill's Range), +10% Crit Chance.
'Castor' buff: When the affected Unit performs a Normal Attack that IS a Crit, reduce the
  Unit's NP Cooldown by 1 Turn.
```

Complementary triggers — every normal attack fires exactly one of them. A tidy piece of design
that needs no new mechanism:

```yaml
effects:
  - id: polluxBuff
    polarity: buff
    rules:
      - key: OnEvent
        event: damageStepEnd
        predicate: ["self:isAttacker", "attack:kind:normal", { not: "attack:crit" }]
        then:
          - { key: ApplyEffect, target: alliesWithin2OrPartner,
              effect: { id: sCritUp, duration: "⅓◈", magnitude: { base: 10 } } }
  - id: castorBuff
    polarity: buff
    rules:
      - key: OnEvent
        event: damageStepEnd
        predicate: ["self:isAttacker", "attack:kind:normal", "attack:crit"]
        then:
          - { key: CooldownDelta, target: self, ability: all, scope: np, delta: -1, unit: turns }
```

`alliesWithin2OrPartner` is a target shorthand for the recurring *"all allied Units within a 2
panel area of himself (and Pollux if she is out of the Skill's Range)"* clause — the partner is
always included regardless of distance. It appears in three of the twins' abilities, so it earns
a name.

---

## 34.10 Mana Burst's either/or restoration

Both twins have `Mana Burst (Light/Ancient) — Rank A+`:

```
First, EITHER restore 2 Agility and 2 Luck to [the user]; OR restore 1 Agility and 1 Luck to
BOTH Castor and Pollux. Then, for that Combat Process, the Base Attack used is the user's
BA(STR) and BA(MAG) combined. Not affected by Magic Resistance. Light damage (half).
50% chance of inflicting Blind for 1◈. Then [Castor: reduce NP Cooldown by 1◈]
[Pollux: apply Evade for ⅓◈].
```

A **player choice inside a phase**:

```yaml
phases:
  - kind: choice
    prompt: "FGT.Dioscuri.ManaBurstChoice"
    options:
      - label: "FGT.Dioscuri.SelfRestore"
        phases:
          - { kind: statChange, target: self,
              changes: [{ stat: agility, delta: 2 }, { stat: luck, delta: 2 }] }
      - label: "FGT.Dioscuri.SplitRestore"
        phases:
          - { kind: statChange, target: linkedGroup,
              changes: [{ stat: agility, delta: 1 }, { stat: luck, delta: 1 }] }
  - kind: modifyAttack
    modifiers:
      - { key: BaseAttackOverride, sources: [
            { unit: self, component: str, factor: 1.0 },
            { unit: self, component: mag, factor: 1.0 }] }
      - { key: IgnoreMagicResistance }
      - { key: ElementTag, element: light, portion: 0.5 }
      - { key: OnHit, effects: [{ id: blind, duration: "1◈", chance: 50 }] }
```

`kind: choice` is a new phase type and it is broadly useful — Scáthach's *Primordial Rune* needs
it too (`"Your choice of any of the above effect(s)"`).

---

## 34.11 Tally

| Mechanism | New support needed |
|---|---|
| Two tokens, one Servant | `LinkedUnitGroup` |
| Hard distance leash | movement cost function constraint |
| Linked death ignoring revival | `Defeat` action with `ignoresRevival` |
| Fractional unit budget | integer half-units + half-pip rendering |
| Shared cooldowns by ability name | `SharedCooldown` |
| Damage reading two units' modifiers | `modifierSources` on a damage phase |
| Either-twin ZON satisfaction | `zonSatisfaction: any` |
| Cooldown deltas in literal turns vs ◈ | `unit: turns` + a validator warning |
| Partner-always-included target shorthand | `alliesWithin2OrPartner` |
| Player choice mid-ability | `kind: choice` phase |

**Script elements: zero.**

The Dioscuri look exotic but decompose into ten small, general mechanisms. That is the strongest
evidence the architecture is right: the weirdest-shaped content in the set needed no bespoke
code at all.

---

**Next:** [35 — Case Study: Van Gogh and the Curse Economy](35-case-van-gogh.md)
