# Achilles — Design

**Source:** `char_orig_sheets/Copia de Achilles.md`
**Chapters:** `docs/44-case-expanded-roster.md` §44.1–44.3, `docs/D-servant-data-sheets.md` §D.23

He is the acceptance test for **gating**. Karna is the benchmark for the predicate machinery and
Kingprotea for stack economies; Achilles is the one whose sheet is mostly a question of *when*
each clause is allowed to apply. Thirteen entries, **five Noble Phantasms** — three of them
non-damaging and two purely passive, both corpus records — and almost every one of them is
switched on or off by a stance he declares each time he acts.

---

## 1. Statline

```
Rider · Greece · Lawful Neutral
STR B+  END A  AGI A+  MAG C  LUC D
Attributes: Male, Servant, [Earth], Humanoid
Base Health 1500 · MOV 7 dismounted / 8 mounted · Range 2/1
BA(STR) 135 · BA(MAG) 150 · Sustainability 2◈
```

Every figure reproduces from `domain/tables.mjs`: `B+ → 135`, `C → 150`, `A → 1500`. Note
**BA(MAG) exceeds BA(STR)**, which is unusual and is not a transcription error — the tables give
it, and nothing on his sheet uses BA(MAG) anyway. It is recorded here so a later reader does not
"fix" it.

`MOV 7 (Dismounted); 8 (Mounted)` is the first statline in the corpus that is *stance-dependent*.
It is authored as MOV 7 with a `+1 while mounted` contribution rather than as two numbers, so
that everything which modifies MOV — Riding's Active, `heelWounded`'s penalty — composes with it
instead of racing it.

---

## 2. The stance — the spine of the sheet

> *"When Achilles Acts, the player must state whether he is Mounted or Dismounted. Achilles is
> always Dismounted when it is not his Turn. If Mounted at the start of a Combat Phase, Achilles
> can Dismount at the start of the Combat Phase; but he cannot Mount his chariot when he
> initiates Combat while Dismounted."*

Ch. 44 §44.1 already called this a **stance** and distinguished it from a mode. The distinction
is real and worth restating: a mode has a duration, a cooldown and a toggle lock, and may be
*forced* on by a compulsion. A stance has none of those — it is free — but it may only change at
declared moments. Building it as a mode would mean inventing a null duration, a null cooldown and
a null lock, and then still having nowhere to put *"always Dismounted when it is not his Turn"*.

```yaml
stance:
  states: [mounted, dismounted]
  default: dismounted
  forcedOutsideOwnTurn: dismounted
  transitions:
    - { from: mounted, to: dismounted, at: combatPhaseStart }
  # deliberately no mounted-entry transition: the sheet forbids mounting once
  # combat has been initiated dismounted, and offers no other entry point.
```

Stored as `system.stance` on the actor; authored as `stanceSpec` on the servant document. The
projection emits `self:stance:mounted` and `self:stance:dismounted` as roll options, which is
what makes the rest of the sheet ordinary: every *"while Mounted"* clause becomes one predicate.

**Three enforcement points**, each in the layer that owns the moment:

| Rule | Where |
|---|---|
| Forced to Dismounted outside his own Turn | the turn scheduler, at turn end |
| Mounted → Dismounted at a Combat Phase start | the Combat Process, at `declare` |
| No Dismounted → Mounted once he has initiated combat | the toggle's own guard |

The sheet and the action bar carry the control. It is not a cooldown-bearing button, so it reads
as a two-state selector rather than a mode toggle.

---

## 3. What is already built

Four entries are `ref` + rank against shared documents that already exist, which is the whole
point of having written them that way:

| Entry | Document | Reproduces |
|---|---|---|
| Magic Resistance C | `class-magic-resistance` | 30% reduction, negates up to C, 15% debuff resist, and the Instakill/Death exemption clause already authored |
| Battle Continuation A | `class-battle-continuation` | `2d10+20` reduction with doubled dice vs NP, `5d20` revival, 3◈, and `requiresHealthRestoredSince: 0.5` |
| Divinity C | `divinity` | +30 flat including NP, and the `divine` attribute |
| Bravery A+ | **new** `bravery.yml` | Mental debuff resist 50%; `Atk Up (STR)` 25%/15% for 1◈, cooldown 4◈-⅓◈ |

**Bravery becomes shared.** Heracles's `heracles-bravery.yml` is A+ with the same numbers plus
two Mad-Enhancement clauses that are his alone. Achilles's has neither. This is exactly the
`class-riding` / `class-riding-medusa` split: a shared parameterized document, and a per-Servant
variant for the one whose sheet reads differently. Heracles keeps his.

**Riding needs a third variant.** His sheet says *"All effects/abilities related to Riding can
only be used while Mounted EXCEPT Passive 1"*, so `riding-achilles.yml` predicates the
`ridingAttack` and `passengerSeat` grants and the Active on `self:stance:mounted`, and leaves
`doubleMove` unconditional. The comment in `riding-medusa.yml` predicting that *"Achilles's and
Ozymandias's read the other way and keep `class-riding`"* is wrong about Achilles and gets
corrected rather than left to mislead.

`ridingMov A+ → 5` and the explicit `cooldown: "3◈-⅓◈"` (the same way Medusa's A+ passes hers)
give the Active exactly what his sheet prints.

---

## 4. Achilles' Heel

The most involved single mechanic in either roster, and the one that makes the rest of him
playable to fight.

> Whenever he is in a Combat Phase **while Dismounted**, the attacker may declare a Heel Attack.
> He cannot Block it. If he fails to Evade, it succeeds with probability:
>
> ```
> base:  Front 0%  ·  Sides 5%  ·  Back 10%
> +5%  the attacker's Agility >= his
> +5%  the attack was at Range 3 or higher
> +5%  the attacker initiated combat (not a Counter)
> −10% the attack was AoE
> +10% attacked from within Fog of War
> +25% on a successful Luck Check
> ```
>
> On success the damage **ignores all defensive buffs and damage-reducing effects**, and he is
> permanently wounded. On failure he Evades.

### Where it sits in the ladder

An optional rung, offered at `declare` and resolved after `evadeRoll:fail`:

```
declare → (heel offered when chance > 0) → react → evadeRoll
                                                      ├── success → s21_luckyHit …
                                                      └── fail    → heelResolve → success → damage (ignoring defence)
                                                                                └── fail  → noDamage  (he Evades)
```

Two properties fall out of the sheet and both are load-bearing. *"Achilles cannot Block Heel
Attacks"* removes a rung from the ladder for this attack only, which the per-attack restriction
vocabulary built for Mannanán (`damage.unblockable`) already expresses. And *"if the Heel Attack
fails, Achilles successfully Evades"* means a **failed** sub-roll turns a failed Evade into a
successful one — the only place in the game where losing a roll is better for the roller than not
having rolled.

### The prompt

Offered **only when the chance can exceed 0**, so an ordinary frontal attack never asks. The
offer shows the computed chance with its breakdown, and carries the Luck Check as a second opt-in
inside the same prompt rather than as a separate rung.

### Inputs the engine already has

| Modifier | Source |
|---|---|
| Front / side / back | `domain/geometry.mjs#coneOf` — which names Achilles' Heel in its own docstring and has never been called for it |
| Agility comparison | both unit projections |
| Range ≥ 3 | `attackFacts.range`, Chebyshev |
| Initiated vs Counter | `state.isCounter` |
| AoE | `state.isAoE` |
| Fog of War | *"a place where he had no vision of"* — the attacker's panel outside his Detect range (`rules/identity.mjs#detectRangeOf`) |
| Luck Check | `rules/checks.mjs#luckCheck` |

### `heelWounded`

A permanent, unremovable `status` — not a debuff. It cannot be cured, has no duration, and
**rewrites three abilities**:

1. Andreias Amarantos is suppressed for the rest of the game.
2. Dromeus Komētēs' passives are lost, and penalised: MOV −1 while Dismounted, and Evade rolls
   read **+1** instead of −4.
3. Runner Comet's two buffs drop from 30% to 10%.

Point 3 is the interesting one: an effect that changes another ability's **magnitude**. It is
expressed as a `perEffect` scale on Runner Comet's own clauses rather than as a second copy of
the ability, for the same reason Kingprotea's six clauses live on one Skill.

`damage.ignoresDefensiveBuffs` is new: it zeroes the defender's reduction buckets for one attack
— broader than `Pierce` (which ignores Def Up and Invuln) because the sheet says *all* damage
reducing effects, which includes Battle Continuation's dice and Andreias Amarantos itself.

---

## 5. Andreias Amarantos — a defence keyed on the attacker

| Attacker's Divinity | Damage taken |
|---|---|
| none | **0** |
| E | 50% |
| D | 75% |
| C and above | 100% |

`domain/tables.mjs#andreiasAmarantosByAttackerDivinity` **already holds this table** and nothing
reads it — the third time in three Servants that the table preceded its reader. What is missing
is an element that resolves a rank table against the **attacker** rather than the bearer:

```yaml
- key: AttackerPropertyTier
  property: skillRank:divinity
  table: andreiasAmarantosByAttackerDivinity
  applies: totalDamageFactor
```

Total immunity as the *default* case is the unusual part, and it is deliberate: against the ten
Divinity-bearing Servants in the roster he is merely tough, and against everyone else he cannot
be hurt at all except through the Heel. That is what makes the Heel the counter-play rather than
a flourish.

---

## 6. Troias Tragōidia — the Riding Attack NP

> *"Base Attack (STR) is used. Used in the form of a Riding Attack, with a distance of 13 panels.
> First restores X Agility and applies Atk Up for ⅓◈, all damage dealt +X0%; if NP (X−1)0%;
> X = remaining MOV ÷ 2. Deals 4× damage. Then applies Crit DmUp for 1◈, Crit Damage +Y0%,
> Y = number of Units successfully hit. Hits in both directions on the normal board; one
> direction on the Large Board."*

The line itself is solved: `bidirectional: "unlessLargeBoard"` was built for Bellerophon and this
is the same shape at 13 panels. `engine/riding.mjs` already resolves a Riding Attack as *move
first and completely, then attack everyone on the line*.

Two magnitudes are new, and they are new in different ways:

- **`X = remaining MOV ÷ 2`**, rounded down per the glossary's blanket fraction rule, read at
  resolution from the mover's remaining allowance. One value feeds three places: an Agility
  restore, `+X0%` damage, and `+(X−1)0%` for NP.
- **`Y = units successfully hit`** — a magnitude computed from *the ability's own targeting
  result*. Nothing in the corpus has needed a number that cannot exist until the attack has
  already resolved.

Its passive has two halves: Riding Attack damage +25% (explicitly **not** NP), and *"at the end
of any Turn where Achilles Acts while Mounted, his Master loses 25 Health"* — an `actedTurnEnd`
handler whose subject is the Master, which is the shape Mad Enhancement's drain already uses.

---

## 7. Dromeus Komētēs and Runner Comet

**Dromeus Komētēs** (A+, passive NP, Dismounted only) grants Double Move — the same grant Riding
Passive 1 gives, which is why his Riding variant leaves that one ungated — and reduces the value
of his Evade rolls by 4. `damage.evadeModifier` exists from Mannanán; this is its defensive twin
on the roller's own side.

**Runner Comet** (A+, active) is Dismounted-only, usable only at the start of a Combat Phase, and
*"cannot be used if Achilles is affected by Skill Seal or NP Seal"* — a requirement naming two
different seals, which is worth stating because a Skill that is also gated by an NP Seal is
otherwise a contradiction in the vocabulary. Restores 3 Agility, then `N.Atk Up` 30% and
`Crit DmUp` 30% for the Turn.

---

## 8. Akhilleus Kosmos — two clauses, one name

**The passive** is Kingprotea's cascade with a different direction rule. She pushes occupants
*away from her centre*; he pushes them **backward along his own travel**, and *"if the Unit does
not or cannot vacate those panels, that Unit is forcefully Moved to one of the panels to its
sides, and receives damage equivalent to a Normal Attack from Achilles"*. So the machinery
generalises rather than duplicates: `knockbackPanel` gains a preferred direction and a sidestep
fallback, and the fallback carries a damage hook.

**The barrier** is a reaction-window ability:

> *"Once, when Achilles or any allied Unit within 2 panels is targeted by / is within Range of an
> AoE Noble Phantasm of Rank A and above, negate all damage and effects of that NP in a 5×5 panel
> area around Achilles. After that, Akhilleus Kosmos is broken; all its effects are lost and
> cannot be used for the rest of the game."*

Negation is `DamageNegation` at stage 0/16, which exists; the novelty is **permanent expenditure**
— an ability that is not on cooldown but gone, and gone in a way that survives everything.

---

## 9. Diatrekhōn Astēr Lonkhē — the duel

A bounded field, and the machinery is largely there: `rules/bounded-fields.mjs` carries
`isolation.blocksCommandSpells` as its own axis, written in a comment that names *"the duel
field"* as the reason it exists.

What the field does, all of it stated on the sheet as rules:

- a **5×5** area around the two units, drawn where they stand
- nobody may enter; the two may not leave; nobody may interfere
- **Command Spells are blocked** — the only thing in the game that blocks them
- **Luck Checks cannot be used** by the involved units
- **all buffs and debuffs caused by units not involved are negated** for the duration

Three gates on activation, and they are refusals rather than modifiers: not on a **Female** unit,
not on a unit with **at least 3 Parameters one Rank lower** than his, and not on **Hector, Chiron
or Penthesilea** by name.

Per the decision taken during brainstorming: the engine enforces every mechanical clause above,
prompts the target for consent, and **does not model the victory condition** — the sheet leaves
the terms to the two players, so a GM control ends the duel and tears the field down. Encoding a
terms vocabulary would be inventing rules the sheet does not have.

---

## 10. What the engine is missing, in one list

| Feature | For | Named in the spec? |
|---|---|---|
| `stance` — states, transitions, forced default, roll options | the whole sheet | Ch. 44 §44.1 |
| `weakPoint` — an optional ladder rung with its own chance table | Achilles' Heel | Ch. 44 §44.2 |
| `damage.ignoresDefensiveBuffs` | a successful Heel Attack | Ch. 44 §44.2 |
| A permanent, ability-rewriting `status` | `heelWounded` | Ch. 44 §44.2 |
| `AttackerPropertyTier` | Andreias Amarantos | Ch. 44 §44.2, and the table is already written |
| A magnitude from the ability's own targeting result | Troias Tragōidia's `Y` | no |
| A magnitude from remaining movement | Troias Tragōidia's `X` | no |
| Evade-roll modifiers on the roller's own side | Dromeus Komētēs | no |
| A preferred-direction knockback with a damaging sidestep | Akhilleus Kosmos | Ch. 43 |
| Permanent expenditure of an ability | Akhilleus Kosmos | no |
| Duel-field axes: membership lock, Luck Check block, foreign-effect suppression | Diatrekhōn Astēr Lonkhē | Ch. 43, partly — `blocksCommandSpells` exists |
| A stance-dependent statline | MOV 7/8 | no |

**Script count: 1**, as §D.23 budgeted — `achilles.heel`, and only if the six modifiers turn out
not to be expressible as data. The working assumption is that they are, in which case it is 0.

---

## 11. Readings taken

- **Bravery's magnitude is missing from his sheet** — *"STR damage dealt is increased by; if NP,
  15%"*. Heracles's Bravery at the same A+ rank is 25%/15%, so it is read as **25%**.
- The Heel's Luck Check bonus is printed **`25%(?)`**, the author's own uncertainty. Taken as 25.
- `X = remaining MOV ÷ 2` **rounds down** (Ch. 02: fractional forms always round down).
- *"restores X Agility"* uses the same X as the damage bonus, not a separate roll.
- **BA(MAG) 150 > BA(STR) 135** is correct from the tables and not a transcription slip.
- *"Attack from the Sides: 5%"* is both left and right cones at 5%.
- The barrier's *"Rank A and above"* is read as the **NP's own rank**, not its scale tag; its
  `[Anti-Army]`-style tag is a separate axis and the sheet says Rank.
