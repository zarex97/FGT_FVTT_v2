# Nursery Rhyme, Part 3 — Nameless Forest — design

**Date:** 2026-09-16
**Source:** `char_orig_sheets/Copia de Nursery Rhyme.md`
**Part 3 of 4.** Depends on Part 1 (`2026-09-16-nursery-1-core-design.md`).
**Chapters affected:** [05 — Ranks and Parameters](../../05-ranks-and-parameters.md),
[06 — Stats and Resources](../../06-stats-and-resources.md),
[14 — Checks and Randomness](../../14-checks-and-randomness.md),
[44 — Case Studies: the Expanded Roster](../../44-case-expanded-roster.md),
[45 — Implementation Status](../../45-implementation-status.md), [A — Effect Catalogue](../../A-effect-catalogue.md)

---

## 1. The problem

A Noble Phantasm that is **passive, continuous, and kills by accumulation**.

Every Round, every enemy within 2 panels of Nursery gains a **Nameless Forest Token**. Each token
permanently shaves their Max Health, both Base Attacks and their Max Luck. From three tokens up, a
d12 at the end of their own Turn may simply **delete them** — and the more tokens they carry, the
likelier that is. They may attempt a Luck Check to shed the whole stack, but the check gets *harder*
the better their MAG Rank is, and easier the worse it is.

It is the only ability in either roster that wins by waiting.

**A note on the sheet.** The text carries a visible errata:

> *"reduce its Max Health by ~~50~~ 25, Base Attack (both) by ~~20~~ 10"*

The struck figures are superseded. **25 and 10 are the live values** (R1).

---

## 2. What already exists

| Clause | Reality |
|---|---|
| A per-unit token count | `resources` — an `ObjectField` of per-unit pools (Ch. 06 §6.10). Scáthach's PRS Tokens and Mannanán's Fragarach Counters are the precedents. |
| *"reduce its Max Health by 25"* | `MaxDelta`, which carries `alsoCurrent` and is already used by `Max HpDwn`. |
| *"Base Attack (both) by 10"* | `BaseAttackModifier`. |
| *"Max Luck by 1"* | `MaxDelta` on `luck`. |
| *"per token"* | `perStack` — the magnitude form that scales with a held count. |
| A Luck Check with modifiers | `rules/checks.mjs#checkPlan` and `luckCheck`, with `CheckModifier` contributions. |
| *"if the Unit is within its Home Base"* | `self:inHomeBase`, which Medea's Territory Creation already reads. |
| Rank-indexed modifier ladders | `domain/tables.mjs` — a `scaled` table keyed by grade is exactly the MAG ladder below. |
| *"does not occur if Nursery is inflicted with NP Seal"* | `npSeal` is an authored effect and `preventedBy` reads it. |
| `roundEnd` and `unitTurnEnd` | Both fired (Appendix E). |

**Most of the parts exist.** What does not is the *shape*: a token whose count drives three separate
stat penalties, a check whose difficulty is read off a parameter, and a death roll.

---

## 3. Rulings

**R1 — 25 and 10, not 50 and 20.** The sheet strikes through the larger figures. Superseded text is
not an alternative reading.

**R2 — The stat reductions are permanent; only the tokens are removed.** *"(Health and Luck that are
lost from the effects of this NP are not restored)"* — stated outright in the same sentence as the
removal. So a successful Luck Check ends the *accumulation* and the *death roll*, and leaves the
damage done.

This makes the reductions **writes**, not modifiers. A `MaxDelta` contribution scaled by a held token
count would spring back the instant the tokens left, which is precisely what the parenthesis forbids.

**R3 — The Luck Check modifier is applied to the roll, and lower is better.** The ladder reads
*"MAG Rank EX: −3 … MAG Rank E: +2"*, and a high MAG Rank is supposed to make escape *harder*. A
Luck Check in this system is rolled **under** a target, so a **−3 on the die** makes the roll more
likely to succeed — which would help EX and hurt E, backwards from the intent.

**Confirmed against the engine.** `rules/checks.mjs#resolveCheck` computes
`total = roll + modifiers` and succeeds on `total <= target`, so a **negative modifier makes success
more likely**.

**DECISION.** The figures modify the dice value as the sheet says, signs as written. A **MAG EX** unit
rolls at −3 and therefore escapes **more easily**; a **MAG E** unit rolls at +2 and escapes less
easily.

That is coherent rather than backwards, and the Home Base term is what proves it: *"If the Unit is
within its Home Base: −3"* also helps, and the sheet separately refuses to let a Unit be deleted at
home. Both terms point the same way — safety and magical power each make the forest easier to walk
out of. A powerful magus sees through it; so does someone standing on their own ground.

**R4 — The Home Base modifier stacks with the MAG modifier.** Stated in the sheet: *"(stacks with
the MAG Rank modifiers as seen below)"*. So a MAG EX unit at home rolls at −6.

**R5 — The death roll happens at the end of the affected Unit's own Turn, not Nursery's.** *"At the
end of the Unit's Turn"* — so `unitTurnEnd` on the bearer, not `roundEnd`.

**R6 — A Unit in its Home Base cannot be deleted, but still rolls.** *"a Unit cannot disappear due to
the effects of this NP if it is within its Home Base."* The roll is not skipped; the *consequence* is
refused. Recorded because skipping the roll and refusing the outcome are indistinguishable today and
will not be once anything reads the roll log.

**R7 — The escape resistance is per-Unit, permanent, and stacks.** *"Every time a Unit successfully
removes Nameless Forest Tokens from itself, the chance of it gaining Nameless Forest Tokens again is
reduced by 10% (base chance=100%); this effect can stack."* So a Unit that has escaped three times
gains a token only 70% of the time thereafter. It is a property of the **Unit**, not of the effect
instance, and survives losing every token.

**R8 — Tokens are gained at the end of every Round, not every Turn.** *"At the end of every Round,
this NP affects all enemy Units within a 2 panel area."* One token per Round per qualifying enemy.

---

## 4. The engine work

**Three changes.**

### E1 — A token count that drives permanent writes

The tokens themselves are an ordinary `resources` pool. What is new is that **gaining one performs
three permanent stat writes** rather than contributing a modifier (R2).

**DECISION.** The token grant and the stat writes are one action: an `OnEvent roundEnd` handler that
emits a resource delta **and** three `StatDelta` writes (`health.max` −25 with `alsoCurrent`,
`baseAttack.str` and `baseAttack.mag` −10 each, `luck.max` −1). Removal later returns the pool to
zero and writes nothing back.

`BaseAttackModifier` is a *contribution* today and would spring back; the write form is what R2
requires. This is the one place Part 3 diverges from how the engine normally expresses a stat change,
and the divergence is the sheet's parenthesis.

### E2 — A check whose difficulty is read off a parameter

*"the value of the dice rolled for the affected Unit's Luck Check is modified as follows: MAG Rank
EX: −3, A: −2, B: −1, C: no change, D: +1, E: +2"*, plus −3 for being in its own Home Base (R4).

A `namelessForestEscape` table in `domain/tables.mjs`, keyed by grade, read as a `CheckModifier` on
the **affected unit** — not on Nursery. The Home Base term is a second `CheckModifier` predicated on
`self:inHomeBase`, and the two sum (R4).

The novelty is that the modifier is indexed by the *bearer's own MAG Rank* rather than by the
ability's rank. Every rank table in the corpus is read against the owning ability's rank; this one is
read against the target's parameter.

### E3 — The death roll

*"a Unit with at least 3 Nameless Forest Tokens rolls a twelve-sided die. If the number rolled is
equal to or lower than the number of Tokens, the Unit disappears."*

An `OnEvent unitTurnEnd` on the affected unit, gated at `>= 3` tokens, rolling `1d12` against the
count, and emitting a defeat — refused if the unit is in its Home Base (R6).

*"Disappears (i.e. is defeated)"* — the sheet glosses its own term, so this is an ordinary defeat and
runs the revival chain like any other. It is **not** `Death` semantics; nothing says revival is
ignored.

---

## 5. The clause inventory

~15 numbered goals.

| # | Clause | Verdict |
|---|---|---|
| F1 | Rank C, NP, `[Anti-Unit]`, **(Passive)** | FREE |
| F2 | At the end of every Round, affects all enemy Units within 2 panels of Nursery (R8) | CONTENT |
| F3 | Each affected Unit gains one Nameless Forest Token | **ENGINE — E1** |
| F4 | Does not occur if Nursery is inflicted with `NP Seal` | CONTENT — a predicate on her |
| F5 | Per token: Max Health −25 (R1), permanently (R2) | **ENGINE — E1** |
| F6 | Per token: Base Attack **both** −10 (R1), permanently | **ENGINE — E1** |
| F7 | Per token: Max Luck −1, permanently | **ENGINE — E1** |
| F8 | Once per Turn, during its own Turn, an affected Unit may attempt a Luck Check to remove **all** tokens | CONTENT |
| F9 | Success removes the tokens; lost Health and Luck are **not** restored (R2) | **ENGINE — E1** |
| F10 | Luck Check dice modified by MAG Rank: EX −3, A −2, B −1, C 0, D +1, E +2 (R3) | **ENGINE — E2** |
| F11 | −3 more if the Unit is within its own Home Base, stacking (R4) | **ENGINE — E2** |
| F12 | At the end of the Unit's Turn, with ≥3 tokens, roll `1d12` (R5) | **ENGINE — E3** |
| F13 | Rolled ≤ token count ⇒ the Unit disappears | **ENGINE — E3** |
| F14 | …unless it is within its Home Base (R6) | **ENGINE — E3** |
| F15 | Each successful removal reduces its future token chance by 10%, from a base of 100%, stacking (R7) | CONTENT — a negative outgoing `ApplicationChance` on the Unit |

**Tally: 1 FREE, 4 CONTENT, 10 ENGINE.** The most engine-dense part of the four by proportion,
because almost every clause is a novel *shape* rather than a novel value.

---

## 6. The content

**Two new files, and one modified.**

- `packs/_source/abilities/nursery-nameless-forest.yml`
- `packs/_source/effects/nameless-forest.yml` — the marker the tokens hang from, carrying the Luck
  Check offer, the death roll and the escape resistance. `polarity: status`, because it is neither a
  buff nor a debuff in any useful sense and must not be strippable by ordinary removal.
- **Modified** — `nursery-rhyme.yml` gains one ability ref; `domain/tables.mjs` gains
  `namelessForestEscape`.

---

## 7. Verification

**Unit and golden tests:** one token per Round and not per Turn (R8); three tokens producing −75 Max
Health, −30 to **both** Base Attacks and −3 Max Luck; a successful escape zeroing the pool and
**leaving every stat where it was** (R2 — the test that matters most); the MAG ladder at all six
grades (R3) and the Home Base term summing with it (R4); the death roll firing at 3 tokens and not at
2, deleting on a roll at or under the count, and **refusing to delete in a Home Base while still
rolling** (R6); and the escape resistance compounding to 70% after three escapes (R7).

**The live board:** an enemy standing in her 2-panel ring and collecting a token at Round end; its
sheet showing a *reduced* Max Health; the Luck Check offered on its own Turn with the right modifier
for its MAG Rank; the stats staying reduced after a successful escape; and a three-token unit
vanishing on a bad d12 — but surviving the same roll at home.

---

## 8. Risks

**R2 is the clause most likely to be built wrong.** Every other stat change in this engine is a
contribution that springs back when its source leaves. This one must not, and the sheet spends a
parenthesis saying so. A `MaxDelta` contribution scaled by `perStack` would look correct, pass a
casual test, and silently restore everything the moment a Unit escaped.

**R3 inverts under one careless reading.** A high MAG Rank makes escape *easier*, which sounds wrong
until you notice the Home Base term does the same and that the sheet refuses to delete a Unit at home
at all. An implementer who reads "EX: −3" as "harder for EX" will flip six table rows and produce a
Noble Phantasm that is strongest against exactly the Servants it should struggle with. The table is
tested at all six grades for this reason.

**This Noble Phantasm can delete a Unit with no attack, no roll to hit, and no counter-play beyond a
Luck Check.** It is the only such thing in either roster. Its gates — the 2-panel ring, the ≥3
threshold, the Home Base exemption, and the NP Seal clause — are the whole of its balance, and every
one of them is a separate clause that must actually fire.

**Part 3 depends on Part 1 and is independent of Parts 2 and 4.** It may be built before or after the
summons; it must not assume either.
