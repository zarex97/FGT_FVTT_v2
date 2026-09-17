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

**Nothing needed building here.** Nothing clamped during accumulation, and the fear was
unfounded — this section's value is the argument, not the change. The tension it identifies is
real and deliberate: passive 2 of her Item Construction reduces her own incoming debuff chance by
35%, and she spends the whole match trying to land Curse on herself. A 500% chance is a number
written to survive subtraction.

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
fires on each.

Three applications rather than one worth three stages (`stages: 3`) because the sheet states a
**chance** beside the count. A chance is rolled per application; at 500% all three land and the
two readings coincide, but below 100% they are different abilities. The grammar now carries all
three counts and they mean different things: `stages: N` is one application worth N stages,
`uses: N` is one application worth N charges, `applications: N` is N applications.

The loop re-reads the recipient between applications. `applyEffect` decides the new stage from
`target.effects`, so handing it the same snapshot three times computes Stage 1 three times —
which is the failure the whole clause exists to avoid.

> **`applications` was written here, authored on two of her abilities, asserted by two content
> tests — and read by nothing.** `applyPhaseEffects` applied each effect entry exactly once, so
> Imaginary Numbers Arts applied Guts and no Curse at all. The content was right; the reader did
> not exist. Found in the live pass, not by the suite.

*Channel Marker Soul*:

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

The insight is right and the spelling changed. What was built:

```yaml
- key: OnEvent
  event: curseStageChanged
  automatic: true
  eventFilter: { either: [{ stageDelta: positive }, { cause: gogh }] }
  then:
    - { key: CooldownDelta, scope: np, delta: "-@stageDelta" }
```

`eventFilter` rather than a predicate, because the question is about the **change** and not
about a unit — a predicate tests roll options and a stage delta is not one. The disjunction is
spelled `either` and not `anyOf`: `anyOf` already belongs to the predicate grammar, where it
tests membership in a set of option strings, and the validator rejects the collision.

Not `abs()`. The sheet's two halves are **not symmetric**, which this chapter had wrong: the
removal half is gated to the `Gogh` buff specifically (*"due to the effects of the 'Gogh'
buff"*), and the infliction half is not gated at all. So a Cure stripping her Curse pays her
nothing, while any Curse from any source shortens her NP. `-@stageDelta` negates the magnitude
rather than the signed value, so a removal reporting −1 pays 1 Turn instead of reading as a gain.

Confirmed live from Stage 0 against two NPs at 20 Turns: one press of Imaginary Numbers Arts
takes them to 14. Three Turns from this Skill (one per stage inflicted) and 1◈ from the
ability's own third clause — the double payment is the engine, not a bug in it.

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

A **source-scoped** damage floor. It was built smaller than this section proposed — no new
predicate scope, no packet-scoped option builder:

```yaml
- { key: DamageFloor, floor: 1, defId: curse }
```

The packet already knows which effect it came from (`ctx.attack.defId`), so the floor names that
directly and the whole `damage:source:*` option family turned out to be unnecessary. It lives at
**stage 16**, beside `endure`, because it is a statement about the RESULT — *"cannot drop below
1"* — rather than a reduction anything earlier could express (Ch. 13 §13.16).

Distinct from the three mechanisms that already mean "does not die", and the distinction is the
whole point of a Servant who runs herself to Stage 9 on purpose:

- **Guts** revives *after* defeat.
- **Invuln** stops the damage.
- **Endure** leaves the unit at 1 Health — this arithmetic exactly, but unconditional.

Hers is Endure with a source on it. Measured on the board at 40 Health: Curse deals 39 and stops,
Poison deals its full 500, and a Normal Attack kills her normally.

And:

> *"Gogh cannot be ordered to commit suicide/kill herself, even with a Command Spell."*

This needed **nothing new**. `packs/_source/command-spells/cs-kill-yourself.yml` has carried

```yaml
- { kind: targetNotImmune, attribute: immuneToKillYourself }
```

since it was written, naming her in its own comment. It had no writer: no content granted the
attribute. Sunflower's Curse passive 1 is that writer, one `StatDelta` line, and the requirement
began working the moment it existed.

Checked at *offer* time, so the option never appears on her Master's card. Confirmed live: with
the same Master and the same window, *Kill Yourself* is refused for her with `targetNotImmune`
and offered for her Master's other Servant. Scoped to that one command rather than to Command
Spells generally, so a future exception can name its own (Ch. 17 §17.6).

---

## 35.7 Curse transfer

> *"Remove all Curse debuffs from **all** Units within a 3 panel area of Gogh, then apply them
> to herself (apply all stages of Curse accordingly, if any affected Unit has more than one
> stage of Curse)."*

Three things at once: it targets **all** relations (allies *and* enemies), it removes rather
than steals damage, and stages **sum**.

It needed **almost nothing new**. `rules/effect-flow.mjs` has carried `transferableFrom` and
`transferEffect` since it was written, and the latter's own comment names this Skill: *"Van
Gogh's Shadow of Longing gathers Curse from everyone nearby, and 'apply all stages accordingly'
means the stages arrive, not that the effect restarts at one."* The scheduler's `Transfer` action
already drove the pair from an event. Only the **phase spelling** was missing, so an active Skill
could reach it:

```yaml
- kind: transfer
  target: self
  defId: curse
  radius: 3
  relations: [ally, enemy, self]
```

`target: self` explicitly: the ability targets a chosen ally, and the default is `reuse`, which
would gather the Curse onto that ally instead.

No `stageMode: sum` field. Stage summing is what `resolveStacking` already does for a staged
effect, and the depth travels on the instance.

> **It did not sum, and the reason is worth keeping.** `mergeStages` collapses repeated
> applications of one staged effect inside a batch by summing `effect.stages`. A transferred
> instance carries no `stages` — it carries `stage`, the depth it had on its previous bearer.
> The merge read only `stages`, counted each arrival as one, and wrote that count over the real
> depths. **The defect scaled backwards**: an ally at Stage 2 and an enemy at Stage 3 gave her
> Stage 2, and the more she gathered the less arrived. Both readers now use one chain,
> `stages ?? stage ?? 1`.

Note the strategic shape: she strips Curse from **enemies** too — the sheet bolds "all". Against
a Curse-based opponent this is a cleanse; against her own team it is a rescue; and for her it is
fuel. One ability doing three jobs.

Confirmed live: ally at Stage 2 and enemy at Stage 3 within her 3 panels, both stripped, Van Gogh
ends at **Stage 5**, and her NP cooldown falls 20 → 15. That last number is the proof the two
clauses agree — *Channel Marker Soul* pays one Turn per stage inflicted, and five stages
arrived.

---

## 35.8 The `Gogh` buff

> *"Whenever Gogh performs a successful Attack, remove one stage of Curse from Gogh and apply
> Atk Up to herself for 1◈ if a stage of Curse was removed, +10% damage (5% NP). If the Attack
> was a Crit, remove 2 stages and apply the Atk Up buff twice. Does not stack, but reset its
> duration if used while she already has a 'Gogh' buff."*

A conditional chain — the buff is granted *only if* a stage was actually removed. This section
proposed `captureResult` + `repeat` to express that, and **the condition disappeared instead**.

`RemoveEffect` with `stages` reports what it **actually took**, and the grant rides the event
that removal raised:

```yaml
stacking: noneRefresh                    # "does not stack, but reset its duration"
rules:
  - key: OnEvent
    event: damageDealt
    automatic: true
    predicate: [{ not: "attack:crit" }]
    then: [{ key: RemoveEffect, effect: curse, stages: 1, cause: gogh }]
  - key: OnEvent
    event: damageDealt
    automatic: true
    predicate: ["attack:crit"]
    then: [{ key: RemoveEffect, effect: curse, stages: 2, cause: gogh }]

  - key: OnEvent
    event: curseStageChanged
    automatic: true
    eventFilter: { cause: gogh }
    then:
      - key: ApplyEffect
        effect: { id: atkUp, magnitude: 10, npMagnitude: 5 }
        duration: "1◈"
        times: "@stageDelta"
```

At Stage 0 the removal takes nothing, raises no event, and grants nothing — "*if* a stage was
removed" answered with arithmetic rather than with a condition. At Stage 1 a Crit asks for two,
gets one, and the event says −1. No imperative flavour was needed, and no other ability in the
set needs it either.

`cause: gogh` is what lets *Channel Marker Soul* pay for the removal at all (§35.5): that Skill's
removal half is gated to this buff specifically, so a Cure stripping her Curse pays nothing.

**One stage is ONE action, not two.** Two separate single removals would raise two events and, at
Stage 1, pay her twice for one swing — once legitimately and once for a stage that was not there.

> **The two handlers have to partition, and originally they did not.** Both are evaluated in one
> `fireEvent` pass against the same snapshot, so a Crit ran the ordinary one as well as its own:
> three stages off a single swing where the sheet grants two. `{not: "attack:crit"}` on the first
> is the whole fix. Found live at Stage 1, where one Crit left her holding two Atk Up.

Measured on the board, and this table is the clause:

| | ordinary | Crit |
|---|---|---|
| Stage 0 | nothing | nothing |
| Stage 1 | −1 | −1 |
| Stage 2 | −1 | −2 |
| Stage 3 | −1 | −2 |

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

`blockedBy` is **not a field on `NoblePhantasmData`**, and `item-schema-coverage.test.mjs` says
so. The mechanism that already existed is Gate of Skye's shape — a requirement, checked at use
time like every other:

```yaml
# on the skill
requirements: [{ kind: abilityOffCooldown, abilityIds: [gogh-the-yellow-house] }]
# on the NP
requirements: [{ kind: abilityOffCooldown, abilityIds: [gogh-het-gele-huis] }]
```

The symmetry is still worth checking by eye, because nothing enforces it: a one-sided
declaration is a legal document that silently lets one half through.

Confirmed live, and the third reading is the one that matters: with the NP on cooldown the Skill
refuses with `abilityOffCooldown`; with the Skill on cooldown the NP refuses the same way; and
with **both free** the refusal changes to a targeting one, which is what proves the mutual gate
was doing the refusing and not something else.

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

`@count(targets where ...)` was **rejected by name** — in `semiramis-familiar-doves.yml`, before
this chapter was written, in favour of the ordinary predicate grammar. What was built instead:

```yaml
- id: atkUp
  duration: "1◈"
  magnitude:
    countTargets:
      base: 30
      each: 10
      requires: ["self:skill:existenceOutsideTheDomain"]
      excludeSelf: true
  npMagnitudeFactor: 0.5
```

`base: 30` and `each: 10` rather than a multiplication, because X0% *is* X × 10% and the
arithmetic is clearer stated than parsed. `excludeSelf` is load-bearing and not tidiness: she
always carries the Skill she is counting, so without it her floor would be one step high.

The insight the section got right stands — this is a property of the **set**, which is why the
magnitude resolves during phase execution and not at authoring time. It is deliberately not one
of the three counting mechanisms that already existed: `perStack` counts effects on the caster,
`countMatching` counts the board, and neither answers *"how many of the Units I am about to
buff"*.

`npMagnitudeFactor: 0.5` rather than `npDivisor: 2`, for the reason the section gives: the base
is computed, so half of it cannot be written as an absolute. `DamageModifier` already carried
`magnitudeFactor` for Mad Enhancement's halving, which is the same relationship said the same way.

**Clause 2 is a separate mechanism and this chapter missed it.** *"Applies Crit DmUp again to all
affected allied Units WITH the Skill"* narrows one effect entry to a subset of the recipients the
phase already resolved — a question about each recipient, not about the set. That is a per-effect
`predicate`, and it had no reader until the live pass found all three allies on Crit DmUp 200.

Both now read off the board: Terror 60 on the enemies in the 5×5, Crit DmUp 200 for the two EOTD
carriers and 100 for the plain ally, Atk Up 40 across all three, and Area CritUp 10 on Gogh alone
— whose radius-2 aura reaches an ally one panel away and not one three panels away, while that
farther ally still takes the radius-3 buffs. Two reaches in one Noble Phantasm, each measuring
its own.

---

## 35.11 Tally

**This section was written before she was built, and the engine grew past it.** A reader who
implements from the original table today builds five things that already exist. It is kept, in
corrected form, because *what each proposal turned out to be* is the useful part.

| Clause | Proposed here | What it actually was |
|---|---|---|
| BA(MAG) on a non-Caster | `normalAttack.component` | Existed. One authored line. |
| Chance >100% surviving resistance | no clamping during accumulation | Existed. Nothing clamped it; the fear was unfounded. |
| N independent applications | `applications: N` | **Genuinely new.** Authored, then found inert — see below. |
| Stage-stacking with per-stage events | `curseStageChanged` | **Genuinely new.** The event, its intent, and its subject. |
| Cooldown scaling with a stage count | `ticks()` in the expression language | Existed: `perStack` already counted, once `stacksHeld` counted STAGES. |
| Source-scoped damage floor | `floorAtOne` + packet roll options | **Genuinely new**, but smaller: `DamageFloor` beside `endure` at stage 16. |
| Command Spell immunity | `Immunity` with `scope: commandSpell` | Existed, and was **waiting for her by name** — `cs-kill-yourself.yml` has carried `targetNotImmune: immuneToKillYourself` since it was written. |
| Mass transfer with stage summing | `transferTo` + `stageMode: sum` | Existed: `transferableFrom` and `transferEffect` were written FOR her, and `transferEffect`'s own comment names this Skill. Only the phase spelling was missing. |
| Conditional chained actions | `captureResult` + `repeat` | Rejected. `removeStages` reports what it took and the rider reads the event, so the condition became arithmetic. |
| Magnitude from the target set | `@count(targets where …)` | Rejected by name in `semiramis-familiar-doves.yml`; became `countTargets` on the ordinary predicate grammar. |
| Mirrored skill/NP exclusion | `blockedBy` symmetry | Existed as `requirements: abilityOffCooldown`, which is Gate of Skye's shape. `blockedBy` is not a field on `NoblePhantasmData`. |

So: **five already had a reader and no writer**, two were rejected in favour of mechanisms that
already existed, and four were genuinely new. The dominant work of building her was not inventing
mechanisms. It was finding the ones already waiting.

**Script elements: zero.** That claim survives, and is the stronger one. She is the most
mechanically inventive Servant in the set and she is entirely declarative.

### 35.11.1 What the live pass found

Six defects, none of which a green suite caught, and every one of them a *reader* problem rather
than a rule problem. They are recorded here because the pattern is the chapter's real lesson.

| Defect | Shape |
|---|---|
| `applications: N` had no reader | Authored on two abilities, asserted by two content tests, named in this chapter — and `applyPhaseEffects` applied each entry exactly once. She inflicted no Curse at all. |
| `event` and `setStage` missing from `INTENT_TYPES` | Three of the four authorities an intent needs. `applyIntents` threw the whole batch out, so the Curse, the cooldown phase and the usage marking all died behind one missing string. |
| An `event` intent had no subject | `batch()` files an addressless intent under `null`; the dispatcher handed that null to the board lookup and returned before reaching a handler. The cooldown still fell 3 Turns from the ability's own phase, so a number moved and it looked like it worked. |
| A Crit ran BOTH halves of the `gogh` buff | The two `damageDealt` handlers did not partition, so a Crit took three stages and paid three Atk Up where the sheet grants two. |
| `mergeStages` read `stages` and not `stage` | A transferred instance carries the depth it HAD. Gathering Stage 2 and Stage 3 gave her Stage 2 — the defect scaled backwards. |
| A per-effect `predicate` had no reader | De Sterrennacht clause 2 narrows to EOTD allies; every ally took it, and all three ended on Crit DmUp 200. |

Two more were latent rather than hers: an unreadable rank on an aura threw out of `snapshotBoard`
and blanked the whole board, and `@magnitude` nested inside an aura's `elements` was never
resolved, so Area CritUp reached every correct recipient carrying a string.

**Four of the eight are wrong numbers that look right.** That is the argument for the live pass
in one line.

---

**Next:** [36 — Case Study: The Remaining Seven](36-case-remaining.md)
