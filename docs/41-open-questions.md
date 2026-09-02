# 41 — Open Questions

> **Note (Ch. 45 C4).** Q44's NP tag ordering is now **implemented as constructed**:
> `NP_TAG_SCALE` in `module/rules/bounded-fields.mjs` orders Anti-Unit < Anti-Army <
> Anti-Fortress < Anti-Country < Anti-World, with the qualifiers listed separately rather than
> inferred — so a new tag is a deliberate decision about which kind it is. It remains our
> construction from conventional usage, not a stated rule, and every field vulnerability that
> compares scales depends on it.

Every place where the source documents are silent, ambiguous, or self-contradictory, with the
resolution and where it is implemented.

**Status as of `0.2.1`:** questions **Q1–Q40 have been answered by the game's author**. They are
retained below in condensed form as the record of what was decided and why, because several
resolutions changed the design. **Q41–Q50 are open** — Q41–Q48 raised by the expanded roster and
terrain documents, Q49 raised by the reference calculation supplied with the Q39 answer.

---

## Part 1 — Answered (Q1–Q38)

### Q1. The dice formulas — **ANSWERED**

All named rolls are supplied. Full table in [Appendix C](C-dice-registry.md).

| Roll | Answer |
|---|---|
| `Attack+` | `5d10`, **added** to damage |
| `Attack−` | `5d10`, **subtracted** from damage |
| `Block` | **Not a roll — a flat 25% reduction, the same value against NP** |
| `Evade` / `Evade−` | `1d20` / `1d20+4` |
| `Luck Check` / `Luck Check−` | `1d20` / `1d20+4` (corrected in `0.2.1` — see Q40) |
| `Injury` | `1d4` |
| Master Base Health | **250** |
| `Agility(M)` / `Luck(M)` | `4+1d8` / `8+1d12` |
| `Health(S)` | **Not used** — Servant Max Health has no variance roll |

Three of these changed the design materially: Block became a percentage (Ch. 13 §13.3 stage 14),
crit became a flat ±5d10 (Ch. 13 §13.3 stage 3), and Servant health became fully deterministic
(Ch. 05 §5.6). The `Luck Check−` row above was printed as `1d20` in `0.2.0`; that was a typo in
the source, corrected under Q40.

### Q2. Additive or multiplicative damage percentages — **ANSWERED: additive**

Confirmed. Stage 4 is one additive bucket; effects whose text says **"Total Damage"** are
multiplicative at stage 15. Ch. 13 §13.4.

### Q3. `½◈` at 3 turns per round — **ANSWERED: yes, 2**

The published override table is correct and the `floor` rule is the fallback. Ch. 07 §7.2.

### Q4. Does `Burn` reduce both STR and MAG — **ANSWERED: both, −30 each**

### Q5. Which budget pool an Active Skill consumes — **ANSWERED: a move slot**

No prerequisite; the "must have Moved or Attacked" clause is a garbled restatement of the budget
rule. Ch. 18 §18.3.

### Q6. Mental debuff classification — **ANSWERED**

> *"Mental debuffs are their own category: non-volatile and additionally flagged mental."*

So `nvDebuff Immune` **does** block them, and `Men.Debuff Immune` targets them specifically.
Ch. 10 §10.2.

### Q7. The Range shape at R ≥ 4 — **ANSWERED, and our formula was wrong**

The rule is: exclude panels where `d = R` **and** `s ≥ 2`. **Only the outermost ring is
clipped.** Excluded = `8R − 12`.

| R | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| Panels in range | 9 | 25 | 37 | **61** | **93** | **133** |

Our earlier derivation (`d + s ≤ R + 1`) also gave 12 exclusions at R=3 but additionally clipped
one ring inward from R=4 up, producing 57 and 81 instead of 61 and 93. Corrected in Ch. 08 §8.2
and Ch. 28 §28.3. Content authored at Range ≤ 3 is unaffected.

### Q8. MOV derivation — **ANSWERED: authored per-Servant, not derived**

### Q9. `NP Seal` vs `Kavacha and Kundala` — **ANSWERED: it survives**

### Q10. God Hand's attack identity — **ANSWERED: the ability identity**

### Q11. Dioscuri linked death — **ANSWERED, with an important clarification**

Linked death ignores the *survivor's* revival — but it triggers only on **true defeat**:

> *"Imagine Pollux's HP is reduced to 0; her Guts will revive her, so in the moment she is
> initially reduced to 0 it shouldn't link-kill Castor, as she is not truly dead."*

So the trigger is `unitDefeated` (after the revival chain), not `healthReachedZero`. Ch. 34 §34.4.

### Q12. Dioscuri combined NP modifiers — **ANSWERED: yes, they double-count**

### Q13. "Strongest" Noble Phantasm — **ANSWERED**

Ranked by expected damage against a neutral defender, **and the ranking is stored as part of the
character's data** rather than recomputed. Ch. 33 §33.4.

### Q14. Van Gogh's cooldown example — **ANSWERED: the formula is authoritative**

### Q15. Fragarach Tokens vs Counters — **ANSWERED: the same thing; Tokens is canonical**

### Q16. Battle Continuation's NP doubling — **ANSWERED: the per-Servant sheet wins**

### Q17–Q19, Q21–Q23, Q25–Q28, Q30, Q31, Q33, Q34, Q36, Q38 — **confirmed as implemented**

No changes. Our readings stand.

### Q20. ZON base values — **ANSWERED: our reading is correct**

The `+2` clause is the *reason* for Assassin's 4 and Caster's 5, not an addition on top.

### Q24. Do NPs crit — **ANSWERED: yes, at the base 50%**

Crit-chance modifiers do not apply **unless stated otherwise** — the "unless stated" is new and
means a per-ability override is legal.

### Q29. Charm and faction — **confirmed: a charmed unit may attack its own allies**

### Q32. Turn order with more than two factions — **ANSWERED, and it changed the design**

- Every faction rolls `1d100`.
- **Ties are re-rolled for the contested positions only.**
- The GM is always last.
- **This is re-done every Round.**

The earlier design fixed the order at setup. Turn order is now round-scoped, and `Delay` does not
carry across rounds. Ch. 19 §19.8, Ch. 25 §25.3.

### Q35. `CS: Kill Yourself` and revival — **ANSWERED: it bypasses revival**

Changed from our reading. Ch. 17 §17.6.

### Q37. Platform AoE protection — **ANSWERED: case by case**

> *"Some fortresses/vehicles soak up all the damage for the people inside them, some absorb a
> part and some absorb none, and others do not even let you target the units inside them unless
> from the exterior (requiring you to be inside)."*

So there is no global rule — there is a four-axis protection model and each platform picks a
point in it, including a "must board to target occupants" mode we had not anticipated.
Ch. 20 §20.7.

---

## Part 2 — Answered in `0.2.1` (Q39–Q40)

### Q39. Do crit-damage percentages scale the whole attack, or only the `Attack+` roll?

**ANSWERED: only the `Attack+` roll.** Our reading was wrong.

> *"Crit damage effects affect only the part of crit damage."*

The author supplied the pre-`0.2.0` reference calculation to make the placement unambiguous:

```
[(Base Attack ± 5d10) × (Skill/Spell/NP multiplier)
   ± (non-multiplier % modifiers in the description)
   ± (non-multiplier increase/reduction for a + or − Rank NP)]
 × (total of any non-Skill/Spell/NP multipliers)
 − (Block) ± (Luck Check values) ± (other non-multiplier modifiers)
```

with the worked case:

> Caster BA(MAG) 200 uses a Rank A+ NP, `4x damage plus 100`, on an Archer with the `[Sky]`
> attribute. Crit. NP deals +100% to `[Sky]`. Caster has `NP DmUp +20%`. Archer has Magic
> Resistance C (−30%).
> `[(200+35) × 4 × 2 + 100] × (100+100+20−30)% = 1980 × 190% = 3762`
> *"35 was the 5d10 of the crit damage; if this was duplicated the damage increase would be
> felt."*

So `Crit DmUp +100%` turns the `35` into `70`. It does not scale the 1,980.

**What changed.** Two things, and they compound:

1. `Crit DmUp`, `Crit DmDwn`, `Crit ResUp`, `Crit ResDwn` and `Over Crit` moved **out of the
   stage-4 bucket** and became a multiplier on the roll. `Attack−` is never scaled by them.
2. **The roll itself moved earlier.** The formula brackets it as
   `[(Base Attack ± 5d10) × multiplier …]`, so it applies to Base Attack *before* the ability
   multiplier. `0.2.0` applied it after. Stages 2 and 3 swapped as a result: stage 2 is now
   *Crit*, stage 3 is *Ability multiplier*.

Only that placement reproduces the author's stated total of 3,762 — our order gave 3,297. See
Ch. 13 §13.3 stages 2 and 3 for the superseded reading and a numeric comparison.

**Our reasoning for the wrong answer, recorded.** We argued that a 27-point mean roll was too
small for the game's many `Crit DmUp +100%` effects to be meaningful. That is true, and it is
simply how the game is balanced: crits are a small consistent bonus, and crit-damage effects are
a small bonus on a small bonus. Wanting a mechanic to matter is not evidence about what it does.

**Where.** Ch. 13 §13.2 (stage list), §13.3 stages 2 and 3, both worked examples in §13.5 and
§13.6, and the stage column in Appendix A.

---

### Q40. Is `Luck Check−` being identical to `Luck Check` intended?

**ANSWERED: no — it was a typo. `Luck Check−` is `1d20+4`.**

Exactly parallel to `Evade−`. Everything `0.2.0` wrote off as inert is live:

- `Luck Boost` and `Luck Loss` are ordinary working effects, each worth a flat 4.
- The current-Luck comparison in `luckCheck()` is load-bearing, not cosmetic.
- High-Luck Servants — Drake (`EX`), Semiramis, Quetzalcoatl, Ozymandias (`A+`) — impose the
  penalty on every contest and never pay it.

**Where.** Ch. 14 §14.4, Appendix A §A.3, Appendix C §C.1.

---

## Part 3 — Open (Q41–Q50)


### Q41. What is a "Dead panel"?

The `Dead Zone` terrain says *"All panels within a Dead Zone are Dead panels (see 'Mori
Nagayoshi')"*. We do not have that Servant's sheet.

We implement the stated effect (units standing on one deal −20% damage including NP) and leave
the concept otherwise undefined. If Dead panels have properties beyond that — persistence,
creation conditions, interactions — they are unimplemented.

**Where.** Ch. 42 §42.2.

---

### Q42. What is `Style Change`?

The `Magnetic` terrain's `Immobilize` clause is *"not affected by Debuff Immune effects or
effects that modify debuff resist **EXCEPT Style Change**"*. `Style Change` is not defined in any
document we have.

We implement the immunity bypass as absolute and leave a named exception hook
(`bypassExceptions: ["styleChange"]`) that currently matches nothing.

**Where.** Ch. 42 §42.2.

---

### Q43. Is day/night evaluated at the attacker's panel or the defender's?

Now that `Sunlight`, `Darkness` and `Indoors` make the phase a **per-panel** property, an attack
can cross a boundary — a `Dark` unit standing in a Sunlight pocket attacking a target outside it.

The rule has two clauses: damage *received* by `Dark` units is increased, and damage *dealt* by
`Dark` units is reduced.

**Our reading.** Evaluate each clause at the panel of the unit it describes: the damage-taken
clause at the defender's panel, the damage-dealt clause at the attacker's panel.

**Alternative.** Evaluate both at the defender's panel (the point of impact), or both at the
attacker's.

**Where.** Ch. 42 §42.2.

---

### Q44. Is the Noble Phantasm tag scale ordered as we assume?

Several field vulnerabilities require comparisons — *"an `[Anti-World]` or higher NP"*, *"two
`[Anti-Fortress]` or higher NPs"*. That needs an ordering.

**Our construction:**

```
Anti-Unit  <  Anti-Army  <  Anti-Fortress  <  Anti-Country  <  Anti-World
```

with `Anti-Divine`, `Anti-Beast`, `Barrier`, `Fortress`, `Labyrinth`, `Counter`, `Bounded Field`
and `Anti-Unit (Self)` as unordered qualifiers that do not participate. An NP with several tags
compares by its highest scale tag. `[???]` never satisfies a threshold and prompts the GM.

This is conventional usage, not a stated rule. Getting it wrong changes which Noble Phantasms can
break Ramesseum Tentyris and Doomsday Come.

**Where.** Ch. 43 §43.8.

---

### Q45. Does Nursery Rhyme's rewind restore position?

*The Queen's Glass Game* returns *"the Stats, Parameters, Buffs, Debuffs, Cooldowns, and other
existing effects"* of affected units to an earlier state. Position is not listed.

**Our reading.** Position and facing are **not** restored — units are not teleported back. Turn
budget and contract state are likewise excluded.

**If position should be restored**, the rewind becomes far stronger (it undoes an entire approach)
and the history buffer must record positions, which it currently does not.

**Where.** Ch. 43 §43.11.

---

### Q46. Hassan's bracketed alternatives

The Hundred-Faced Hassan sheet contains two unresolved options in brackets:

- *"a maximum of ten **(twenty?)** Hundred-Faced Hassans on the field"*
- *"one counts as 0.5 **(0.25?)** of a Unit"*

We default to **ten** and **0.5**, both exposed as ruleset settings. Note the two interact: at
twenty deployed and 0.25 weight, a full Hassan board would consume the same budget as five
ordinary Servants, which against the standard 4-move/2-attack budget is already over cap.

**Where.** Ch. 44 §44.1.

---

### Q47. Secret Poison — hide the damage, or only its cause?

Serenity's `Zabaniya` can inflict **Secret Poison**, *"where the debuff and total Poison Damage
taken is only revealed after Presence Concealment is deactivated"*.

Read literally, the victim's Health should not visibly drop until disclosure — which means the
displayed Health is wrong, and a unit could be walking around already dead.

**Our reading.** Apply the damage to real Health immediately, but hide the *cause*: the victim
sees an unattributed loss. State integrity wins over the strength of the secret.

**Alternative.** Genuinely defer the damage, accumulating it and applying the total on disclosure.
That is implementable but means a unit's true and displayed state diverge, which every other part
of the design works to prevent.

**Where.** Ch. 44 §44.4.

**Built, on our reading.** The debuff is hidden (`visibility: gmOnly`), the attribution is hidden
(`attributionHidden`), and a per-victim tally of unattributed damage is accumulated and disclosed
when the concealment ends. The sheet's *"the debuff and total Poison Damage taken is only revealed
after Presence Concealment is deactivated"* is satisfied word for word — what is revealed is a
**debuff** and a **total** — without the bar and the truth ever disagreeing.

---

### Q48. Does Rule Breaker override absolute Independent Action?

Medea's Rule Breaker seizes a Servant's contract with no adjacency requirement and no roll. Four
Servants in the roster have `Independent Action` at `A+` or `EX`, described as *"cannot be
contracted by enemy Casters and Masters"* — Proto Gil, Anastasia, Kiritsugu, Serenity.

**Our reading.** No. The absolute immunity holds. Rule Breaker's damage and buff-stripping still
land; the contract seizure does not.

**Alternative.** Rule Breaker is a Noble Phantasm that explicitly *cuts* contracts and might be
intended to override everything.

**Where.** Ch. 44 §44.5.

---

### Q49. In the Q39 reference calculation, is the `[Sky]` bonus counted twice?

The supplied worked case is `[(200+35) × 4 × 2 + 100] × (100+100+20−30)%`. The setup names three
percentage sources: the NP's `+100%` against `[Sky]`, `NP DmUp +20%`, and Magic Resistance
`−30%`. Accounting for the inner `× 2` as the `[Sky]` clause leaves the outer `+100` with no
stated source; accounting for it as the outer term leaves the `× 2` unexplained.

**Our reading.** The `× 2` is the `[Sky]` clause, applied at pipeline stage 3 as an
ability-stated conditional multiplier, and the outer bucket is `(100 + 20 − 30)% = 90%`. We
implement that, because it follows the formula's own structure — description-level modifiers
live inside the bracket, effect-level ones outside — and because double-counting a single stated
bonus would be surprising.

**If instead the bonus genuinely applies twice** (once as a multiplier and once as a bucket
term), it is a one-line content change: the ability declares both a `conditionalMultiplier` and
a `Dmg Up` rule element. Nothing in the engine needs to change either way, which is why this
ships rather than blocks.

**Where.** Ch. 13 §13.3 stage 3.

---

### Q50. What are Servants' Agility and Luck values?

**This one has a live consequence and is the most important question in Part 3.**

Agility is not a rank: §6.3 makes it a number you must roll **under** on an Evade, and Luck the
same for a Luck Check. Every Servant sheet in the reference set states them as an unfilled
placeholder:

```
Agility: XX/XX
Luck: XX/XX
```

Only the summons and platforms carry real numbers — Bašmu's *"Agility: 14 / Luck: 7"*, the four
Dragon Tooth Warriors, the Hanging Gardens. So all 29 Servants compile to **0 and 0**, and a
target of 0 is one no d20 can roll under: **every Servant Evade and every Servant Luck Check
fails automatically**, including Lucky Hit, Lucky Evasion and the contests either side of them.

This was invisible for a long time because it is not an error anywhere — the sheets say `XX`,
the compiler carries `XX` faithfully as "unstated", and the schema default for an unstated
resource is 0. It surfaced only when a new content guard (`unitKeyCoverage`) noticed that the
*summons'* stated numbers were being dropped by the compiler's allowlist, and the fix for that
made the Servants' silence conspicuous by contrast.

**We do not guess.** A rank-derived table would be an invention: §6.3 describes Agility as a
depleting resource that Injury Rolls grind down, not as a function of AGI, and Q8 already
established the parallel case — *"MOV is authored per-Servant, not derived"*. A per-Servant
number is what the sheets are shaped to hold.

**What we do instead.** The value stays 0 until the author supplies the numbers, one per
Servant, at which point it is pure content: `agility: N` and `luck: N` on each sheet, compiled
by the mapper that now carries the summons'.

**Where.** Ch. 06 §6.3, Appendix D.

---

## How to use this chapter

**For the game's author.** Q50 is the one that changes play today — every Servant currently
auto-fails every Evade and Luck Check for want of two numbers per sheet. Q49 is next — it is a two-line arithmetic
clarification that decides whether one term is being counted twice. Q41 through Q48 are
individually small and can be settled in play.

**For implementers.** Every question has a shipped default and a named location. Resolutions
remain localized by design.

**For reviewers.** Answered questions are kept rather than deleted, so the record shows what was
decided and which of our readings turned out to be wrong. Q7 is the instructive one: a formula
that fit every piece of evidence we had was still incorrect, which is the argument for asking
rather than deriving.

---

**End of the numbered chapters.** Appendices follow:
[A — Effect Catalogue](A-effect-catalogue.md) ·
[B — Rank Tables](B-rank-tables.md) ·
[C — Dice Registry](C-dice-registry.md) ·
[D — Servant Data Sheets](D-servant-data-sheets.md) ·
[E — Event Reference](E-event-reference.md)
