# 41 — Open Questions

Every place where the source documents are silent, ambiguous, or self-contradictory, with the
resolution and where it is implemented.

**Status as of `0.2.0`:** questions **Q1–Q38 have been answered by the game's author**. They are
retained below in condensed form as the record of what was decided and why, because several
resolutions changed the design. **Q39–Q48 are new**, raised by the answers themselves and by the
expanded roster and terrain documents.

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
| `Luck Check` / `Luck Check−` | `1d20` / `1d20` — **identical** |
| `Injury` | `1d4` |
| Master Base Health | **250** |
| `Agility(M)` / `Luck(M)` | `4+1d8` / `8+1d12` |
| `Health(S)` | **Not used** — Servant Max Health has no variance roll |

Three of these changed the design materially: Block became a percentage (Ch. 13 §13.3 stage 14),
crit became a flat ±5d10 with crit-damage percentages moving to the stage-4 bucket
(Ch. 13 §13.3 stage 3), and Servant health became fully deterministic (Ch. 05 §5.6).

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

## Part 2 — New questions (Q39–Q48)

### Q39. Do crit-damage percentages scale the whole attack, or only the `Attack+` roll?

**Why it matters.** `Attack+` adds a flat `5d10` (mean 27.5). If `Crit DmUp +100%` doubles only
that roll, it is worth 27 points — negligible against a 2,000-damage Noble Phantasm, and the
game contains a great many `Crit DmUp` effects at magnitudes from 25% to 100%.

**Our reading.** Crit-damage percentages are ordinary stage-4 bucket modifiers gated on
`attack:crit`, so they scale the whole attack. `Crit DmUp +100%` on a crit therefore roughly
doubles the damage.

**Alternative.** They multiply only the `Attack+` roll, making crits a small consistent bonus and
crit-damage effects nearly worthless. We think this is clearly not intended, but it is our
inference.

**Where.** Ch. 13 §13.3 stage 3.

---

### Q40. Is `Luck Check−` being identical to `Luck Check` intended?

`Evade−` carries a `+4` penalty; `Luck Check−` carries none. So contesting a luckier opponent is
free, and two buffs/debuffs become inert:

- `Luck Boost` — *"always Rolls with (normal) Luck Check instead of Luck Check−"* — does nothing.
- `Luck Loss` — the inverse — does nothing.

Both appear in content. We have implemented the table selection anyway (it costs nothing and
keeps the code symmetric with Evade) and marked the two effects **inert** in the catalogue rather
than removing them.

**If a penalty was intended**, `1d20+4` mirroring `Evade−` would restore both effects and make
Luck a matchup as well as a budget.

**Where.** Ch. 14 §14.4, Appendix A §A.3.

---

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

## How to use this chapter

**For the game's author.** Q39 and Q40 are the two worth answering soon — both change how a whole
class of effects behaves. Q43 through Q48 are individually small and can be settled in play.

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
