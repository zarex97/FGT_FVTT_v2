# 35 — Case Study: Van Gogh and the Curse Economy

Van Gogh inverts a core assumption: she wants to be debuffed. Her design converts stacks of a
damage-over-time debuff into Noble Phantasm cooldown, protects her from dying to it, and lets her
*steal* it from everyone nearby. She is the acceptance test for **self-harm as a resource**,
for **application chances far above 100%**, and for the **stage-stacking** system.

---

## 35.1 The sheet

```
True Name: Vincent van Gogh, Clytie, Clytie van Gogh, Vulthoom
Region: Netherlands, Europe, Greece      Alignment: Chaotic Neutral
STR E   END B   AGI C   MAG A   LUC D
Attributes: Female, Servant, [Man], Humanoid, Threat to Humanity, Child
Base Health 1250   MOV 5   Range 3 panels, 1 target
BA(STR) 50   BA(MAG) 200   Sustainability 2◈
Note: Van Gogh's Normal Attacks use her Base Attack (MAG).
```

`BA(STR) 50` against `BA(MAG) 200` — she is a pure caster whose normal attack override
(Ch. 04 §4.3) is essential; using the default STR rule would make her deal 50 damage a hit.

The `Child` attribute and `Threat to Humanity` have no mechanical effect in the reference set,
but they are exactly the kind of tag future content will key on, which is why the attribute
vocabulary is open and validated rather than enumerated in code.

---

## 35.2 The curse loop

Four abilities interlock:

```
Imaginary Numbers Arts          →  Guts + 3 stacks of Curse on herself
                                   + NP cooldown −(⅓◈ × current Curse stage)
Channel Marker Soul (passive)   →  Curse damage halved
                                   + NP cooldown −1 turn per stage gained OR removed
Sunflower's Curse (passive)     →  Health cannot drop below 1 from Curse
                                   + cannot be ordered to kill herself
Shadow of Longing… (active)     →  steal ALL Curse from every unit within 3 panels
                                   + the 'Gogh' buff: successful attacks remove a stage
                                     and grant Atk Up
```

The loop:

1. Self-inflict Curse (guaranteed — 500% chance).
2. Each stack reduces her NP cooldown twice: once via *Imaginary Numbers Arts*'s scaling
   clause, once via *Channel Marker Soul*'s per-stage clause.
3. *Sunflower's Curse* makes the accumulated damage survivable.
4. *Shadow of Longing* converts stacks back into attack power as she spends them.
5. Meanwhile she is *cleansing her allies* — the steal removes their Curse.

It is a genuinely elegant design and it stresses three subsystems hard.

---

## 35.3 Application chance above 100%

```
Imaginary Numbers Arts:  "Has a 500% chance of inflicting Curse on herself, 3 times."
Het Gele Huis:           "Has a 150% chance of inflicting Def Dwn…"
                         "Has a 500% chance of inflicting Curse on all affected allied Units."
```

500% exists to punch through resistance. Van Gogh's own *Item Construction B-* reduces her
allies' debuff-inflict chance... no — it *increases* the chance of *inflicting* by 35% and
*reduces* the chance of *being inflicted* by 35%. So her allies within 2 panels resist Curse by
35%, and her own Existence Outside The Domain gives her −25%.

Working her self-application: `500 + 35 (her own Item Construction boosts her inflicts)
− 35 (her own Item Construction protects her) − 25 (EOTD) = 475%`. Guaranteed.

The accumulation rule (Ch. 10 §10.7): **do not clamp during accumulation**, only at roll time.
A naive `Math.min(100, chance)` before subtracting resistance would make 500% and 100%
equivalent, which destroys the entire point.

```js
function applicationChance(base, inflicterMods, targetMods) {
  return base + sum(inflicterMods) - sum(targetMods);    // NOT clamped
}
function rolls(chance) {
  if (chance >= 100) return { auto: true };              // clamped only here
  if (chance <= 0)   return { auto: false };
  return { roll: true };
}
```

The chat card shows `500% − 35% resistance = 465% → automatic`, so a player can see why it
never fails.

---

## 35.4 Stage stacking

`Curse` uses `stacking: { rule: stage }` (Ch. 11 §11.3). Van Gogh's *"3 times"* means three
independent applications, each with its own resistance evaluation:

```yaml
effects:
  - { id: curse, chance: 500, applications: 3 }
```

expanded by the applier into three passes through the pipeline. Three rolls, three stage
increments, three `curseStageChanged` events — which matters, because *Channel Marker Soul*
fires on each:

> *"Whenever Gogh is inflicted with Curse or has Curse removed from herself due to the effects
> of the 'Gogh' buff, reduce her NP Cooldown by 1 Turn for every Stage of Curse inflicted or
> removed in this way."*

```yaml
- key: OnEvent
  event: curseStageChanged
  predicate: ["self:isTarget"]
  then:
    - { key: CooldownDelta, target: self, ability: all, scope: np,
        delta: "-abs(@event.stageDelta)", unit: turns }
```

`abs(@event.stageDelta)` because it fires on both gain *and* loss. A stage removed by the
`Gogh` buff reduces cooldown just as much as a stage gained.

---

## 35.5 The scaling cooldown reduction

> *"Reduce Gogh's NP Cooldown by X Turns, where X = ⅓◈ × the stage of the Curse debuff on Gogh
> (e.g. Gogh has Stage 7 Curse, so NP Cooldown is reduced by 2◈+⅓◈ Turns)."*

Let us verify the worked example at 3 turns/round:
- ⅓◈ = 1 turn (from the override table, Ch. 07 §7.2).
- Stage 7 × 1 = 7 turns.
- `2◈+⅓◈` = 2×3 + 1 = 7 turns. ✓

The source's own example confirms our tick arithmetic. Good — this is exactly the kind of
cross-check that validates a design.

At 8 turns/round: ⅓◈ = 2, so stage 7 gives 14 turns, and `2◈+⅓◈` = 16+2 = 18. The example
does **not** hold at 8 turns/round, because the source expressed the *result* in ◈ notation as
if it were a fixed expression. **DECISION.** The formula `⅓◈ × stage` is authoritative; the
parenthetical `2◈+⅓◈` is an illustration at 3 turns/round only. Recorded in Ch. 41.

```yaml
- kind: cooldown
  target: self
  changes:
    - ability: all
      scope: np
      delta: "-(ticks('⅓◈') * @self.effect(curse).stage)"
      unit: turns
```

`ticks(expr)` resolves a `TickExpr` inside the expression language — needed here and by two
other abilities.

---

## 35.6 The death floor

> *"Gogh's Health cannot drop below 1 due to the effects of Curse (Gogh cannot be defeated due
> to the effects of Curse)."*

A **source-scoped** damage floor:

```yaml
- key: DamageNegation
  mode: floorAtOne
  predicate: ["damage:source:curse"]
```

Distinct from `Endure` (which floors at 1 for *any* damage) and from Heracles's God Hand
(which floors for *recorded attacks*). Three variants of the same mechanism, all expressed as
`floorAtOne` with different predicates. That is the payoff for building the predicate system.

`damage:source:curse` is a roll option on the *damage packet*, not on a unit — so the option
builder must produce packet-scoped options during damage resolution. A small addition to
`OptionBuilder` and it unlocks a whole class of "immune to X damage" content.

And:

> *"Gogh cannot be ordered to commit suicide/kill herself, even with a Command Spell."*

```yaml
- key: Immunity
  scope: commandSpell
  commands: [killYourself]
```

The only Command-Spell immunity in the game (Ch. 17 §17.6), checked at *offer* time so the
option never appears on her Master's card.

---

## 35.7 Curse transfer

> *"Remove all Curse debuffs from **all** Units within a 3 panel area of Gogh, then apply them
> to herself (apply all stages of Curse accordingly, if any affected Unit has more than one
> stage of Curse)."*

Three things at once: it targets **all** relations (allies *and* enemies), it removes rather
than steals damage, and stages **sum**.

```yaml
- kind: removeEffect
  target:
    anchor: { kind: self }
    shape: { kind: chebyshevRadius, r: 3 }
    selection: { relations: [self, ally, enemy, neutral], chooser: all }
  selector: { kind: byId, ids: [curse], all: true }
  transferTo: self
  stageMode: sum
```

`transferTo` on a removal phase implements the Transfer keyword (Ch. 11 §11.8). `stageMode: sum`
handles the stage arithmetic — three units at stages 2, 1, and 4 give Van Gogh +7 stages.

Note the strategic shape: she strips Curse from **enemies** too. Against a Curse-based opponent
this is a cleanse; against her own team it is a rescue; and for her it is fuel. One ability doing
three jobs, and it needed one new field.

---

## 35.8 The `Gogh` buff

> *"Whenever Gogh performs a successful Attack, remove one stage of Curse from Gogh and apply
> Atk Up to herself for 1◈ if a stage of Curse was removed, +10% damage (5% NP). If the Attack
> was a Crit, remove 2 stages and apply the Atk Up buff twice. Does not stack, but reset its
> duration if used while she already has a 'Gogh' buff."*

A conditional chain — the buff is granted *only if* a stage was actually removed:

```yaml
id: goghBuff
polarity: buff
stacking: { rule: noneRefresh }         # "does not stack, but reset its duration"
rules:
  - key: OnEvent
    event: damageStepEnd
    predicate: ["self:isAttacker", "attack:successful"]
    then:
      - key: RemoveEffect
        target: self
        selector: { kind: byId, ids: [curse] }
        stages: "@attack.crit ? 2 : 1"
        captureResult: removedStages
      - key: ApplyEffect
        target: self
        effect: { id: atkUp, duration: "1◈", magnitude: { base: 10, np: 5 } }
        repeat: "@removedStages"
```

`captureResult` binds an action's outcome to a name that later actions in the same `then` chain
can read. `repeat: "@removedStages"` then applies the buff zero, one, or two times — correctly
handling the case where she has only one stage left and crits.

That is a small piece of imperative flavour inside a declarative chain, and it is the minimum
needed to express "if X happened, then Y, N times". Two other abilities in the set need it.

---

## 35.9 The mirrored skill/NP pair

Van Gogh has `Het Gele Huis` as **both** a skill and a Noble Phantasm, with the NP being a
strictly stronger version, and each blocking the other:

| | Skill | NP (`The Yellow House`) |
|---|---|---|
| Area | 5×5 orthogonal-adjacent | 7×7 orthogonal-adjacent |
| Def Dwn | 10%, 1◈ | 20%, 2◈ |
| Def Dwn (C) | 20%, 1◈ | 20%, 2◈ |
| Ally Evade | 1◈, 1 time | 2◈, 2 times |
| Ally Regen | 1◈+½◈ | 3◈ |
| Ally Curse | ×1 | ×2 |
| Cooldown | 4◈−⅓◈ | 7◈+⅓◈ |
| Blocked by | the NP being on cooldown | the skill being on cooldown |

```yaml
# on the skill
blockedBy: [van-gogh-het-gele-huis-np]
# on the NP
blockedBy: [van-gogh-het-gele-huis-skill]
```

The mutual-exclusion validator (Ch. 07 §7.6) checks the symmetry and would flag a one-sided
declaration.

Tactically this means using the skill locks out the NP for 11 turns (at 3 turns/round) and vice
versa for 22 — a real decision every time, and the sheet must show the consequence before the
click:

```
🎨 Het Gele Huis                              Rank A+   [ USE ]
   Ready · Cooldown 4◈−⅓◈ (11 turns)
   ⚠ Using this locks Het Gele Huis: The Yellow House (NP) for 11 turns
```

---

## 35.10 `De Sterrennacht` and the ally-counting buff

> *"Applies Atk Up for 1◈, all damage dealt is increased by X0%; if NP, halved. X = 3 + the
> number of affected allied Units with the 'Existence Outside the Domain' Skill excluding
> herself."*

`X0%` means X in the tens place — so X=3 gives 30%, X=5 gives 50%. An unusual notation, and the
magnitude depends on the *composition of the target set*:

```yaml
- kind: applyEffect
  target:
    anchor: { kind: self }
    shape: { kind: chebyshevRadius, r: 3 }
    selection: { relations: [ally, self], chooser: all }
  effects:
    - id: atkUp
      duration: "1◈"
      magnitude:
        base: "10 * (3 + @count(targets where skill:existenceOutsideTheDomain and not self))"
        npDivisor: 2
```

`@count(targets where ...)` — an aggregate over the *resolved target set*, evaluated after
targeting and before application. The expression language needs access to the resolution result,
which is why magnitude evaluation happens in phase execution rather than at authoring time.

`npDivisor: 2` expresses *"if NP, the value is halved"* without hardcoding a second number,
which matters because the base value is computed.

---

## 35.11 Tally

| Mechanism | New support needed |
|---|---|
| Normal attack using BA(MAG) on a non-Caster | `normalAttack.component` override (already designed) |
| Application chance >100% surviving resistance | no clamping during accumulation |
| N independent applications of one effect | `applications: N` |
| Stage-stacking with per-stage events | `curseStageChanged` with `stageDelta` |
| Cooldown scaling with a stage count | `ticks()` in the expression language |
| Source-scoped damage floor | `floorAtOne` + damage-packet roll options |
| Command Spell immunity | `Immunity` with `scope: commandSpell` |
| Mass transfer with stage summing | `transferTo` + `stageMode: sum` |
| Conditional chained actions | `captureResult` + `repeat` |
| Magnitude computed from the target set | `@count(targets where …)` |
| Mirrored skill/NP mutual exclusion | `blockedBy` symmetry (already designed) |

**Script elements: zero.**

Van Gogh is the most *mechanically inventive* Servant in the set — she uses the effect system in
a direction it was not obviously designed for — and she is entirely declarative. That is the
strongest argument that the effect model is right: it supports designs its author did not
anticipate.

---

**Next:** [36 — Case Study: The Remaining Seven](36-case-remaining.md)
