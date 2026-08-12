# 41 — Open Questions

Every place where the source documents are silent, ambiguous, or self-contradictory, with the
reading we implemented and why. **Nothing here blocks development** — each has a shipped
default — but each is a decision the game's author should confirm.

Questions are ordered by impact. Q1 and Q2 should be asked before implementation starts.

---

## Priority 1 — Ask before writing code

### Q1. What are the `Attack+`, `Attack−`, and `Block` roll formulas?

**Source:** The rulebook references a companion *Dice Roll Instructions* document we do not
have. It names the rolls (`Attack+`, `Attack−`, `Block`, `Evade`, `Evade−`, `Luck Check`,
`Luck Check−`, `Injury`, `Health(S)`, `Health(M)`, `Agility(M)`, `Luck`) but gives formulas for
only a few.

**Impact:** `Attack+`/`Attack−` sit at damage pipeline stage 3 and scale every damage number in
the game. `Block` at stage 14 is the primary damage-reduction mechanic. Without them, no balance
claim can be made about anything.

**Our placeholders:** `Attack+` = ×1.5, `Attack−` = ×1.0, `Block` = 5d10, `Evade` = 1d20,
`Evade−` = 1d20+4, `Luck Check−` = 1d20+4, `Injury` = 1d4, `Health(S)` = 2d100,
`Health(M)` = 1d100, `Agility(M)` = 2d6, `Luck(M)` = 1d10. Confidence: low on all of them.

**Mitigation:** every roll is a registry entry with a per-world override (Ch. 14 §14.4), so
supplying the real values is a settings change, not a code change. A world using any placeholder
shows a persistent banner.

---

### Q2. Are damage percentages additive or multiplicative?

**Source, in favour of additive:**
> *"100% Def Up does not always mean no damage is taken. For example, if the AU has 30% Atk Up
> and uses a Normal Attack on a Unit who has 100% Def Up, then the damage calculation would be
> (100+30−100)%, so it would deal 30% damage only, not 0."*

That is unambiguous for the `Atk Up` / `Def Up` pair. But it is the *only* worked example, and
the reference set stacks many percentages at once.

**The stakes.** Penthesilea with Mad Enhancement EX (+100%), `Atk Up (GreekMale)` (+100%), and
`Atk Up (STR)` (+30%), against Heracles's Mad Enhancement B (−40%):
- Additive: `1 + (100+100+30−40)/100 = ×2.90`
- Multiplicative: `2.00 × 2.00 × 1.30 × 0.60 = ×3.12`

Close here, but the divergence grows fast: add Presence Concealment's +100% and additive gives
×3.90 while multiplicative gives ×6.24.

**Our reading:** additive for everything in stage 4, per the one worked example. Effects whose
text says **"Total Damage"** are multiplicative at stage 15.

**What we would need to change:** stage 4 only. It is isolated by design.

---

## Priority 2 — Affects many numbers

### Q3. Is `½◈` at 3 turns per round really 2?

**Source table:** `3 Turns per Round (⅓ = 1 Turn, ⅔ = 2 Turns, ½ = 2 Turns)`

`floor(0.5 × 3) = 1`, not 2. Every other cell in the published table matches `floor`. The 8- and
15-turn rows give `½ = 4` and `½ = 7`, both of which are `floor`.

**Our reading:** a deliberate exception (a half-round of 1 turn out of 3 would be shorter than a
third of a round). Implemented as a published override table consulted before the `floor` rule
(Ch. 07 §7.2), so a correction is a one-line data edit.

---

### Q4. Does `Burn` reduce both STR and MAG base attack?

**Source:** *"Burn reduces the affected Unit's Base Attack (STR & MAG?) by 30."*

The question mark is in the original.

**Our reading:** both, `−30` each. A setting exposes STR-only.

---

### Q5. Which budget pool does an Active Skill consume?

**Source:** *"Only a Unit that has Moved or Attacked during its Turn may use its Active Skills;
similarly, a Unit that has used an Active Skill counts towards the number of Units who Move or
Attack during that Turn."*

The first clause reads as a *prerequisite* (you must have already moved or attacked), which would
prevent opening a turn with a buff — strange. The second clause reads as a *budget* rule.

**Our reading:** the second clause is operative; the first is a garbled restatement. An Active
Skill consumes a **move** slot from the appropriate pool, and there is no prerequisite.

**Alternatives documented** (Ch. 18 §18.3): consume an *attack* slot (very restrictive given how
skill-dense the reference Servants are), or let the player choose the pool.

---

### Q6. Are Mental debuffs volatile or non-volatile?

**Source:** The status document gives four headings — Non-volatile, Mental, Volatile, Other —
without saying whether Mental is a subset of either.

**Impact:** `nvDebuff Immune` and `vDebuff Immune`. Kingprotea has 60% + 60% `nvDebuff` resistance
from *Self-Suggestion*; whether that protects her from `Charm` depends on this.

**Our reading:** Mental debuffs are **non-volatile** and additionally flagged `mental`. Rationale:
they apply no damage over time, and Self-Suggestion reads naturally as mental protection.

---

### Q7. What is the exact Range shape at R = 4 and R = 5?

**Source:** States R=3 is a 7×7 *"EXCEPT the twelve corner panels"*, and includes diagrams for
R=4 and R=5 that we cannot read (they are images).

**Our derivation:** a panel is in range iff `d ≤ R` and, for `R ≥ 3`, `d + s ≤ R + 1`
(where `d = max(|di|,|dj|)`, `s = min(|di|,|dj|)`). This produces exactly 12 excluded panels at
R=3 ✓, 24 at R=4 (57 panels total), and 40 at R=5 (81 panels total).

**Confirmation needed:** the panel counts for the R=4 and R=5 diagrams. Implemented as a lookup
table for R ≤ 8 so a correction is a data edit (Ch. 08 §8.2).

---

### Q8. How is MOV derived from the AGI rank?

**Source:** *"MOV: The number of panels a Unit can Move in one Turn. Reliant on AGI Rank."* No
table is given.

**The reference data contradicts a pure function:** `AGI: C` gives MOV 5 for Van Gogh and MOV 4
for Penthesilea. `AGI: A` gives 7 for Scáthach, Karna and Kingprotea, but 6 for Heracles.

**Our reading:** MOV is authored per-Servant, not derived. The AGI relationship is a design
guideline, not a rule.

---

## Priority 3 — Affects specific content

### Q9. Does `NP Seal` negate `Kavacha and Kundala`?

**Source:** *"This effect is negated if Karna is affected by NP Seal?"* — question mark in the
original.

The general rule says `NP Seal` *"does not affect Passive NP unless stated"*, and a question mark
is not a statement.

**Our reading:** Kavacha and Kundala survives NP Seal.

---

### Q10. What identifies an "Attack" for God Hand's recording?

**Source:** *"Whenever an Attack reduces Heracles' Health to 0 for the first time, record that
Attack. These recorded Attacks can no longer defeat Heracles."*

**Our reading:** the **ability identity** — so Karna's *Brahmastra Kundala* becomes non-lethal
but *Vasavi Shakti* still gets a chance. Normal attacks record as `normal:<attackerId>`.

**Alternative:** the attacking *unit*, which would make one kill permanently defang an entire
Servant. Very strong.

---

### Q11. Does Dioscuri linked death ignore revival?

**Source:** *"If either one is defeated, the other one is also defeated as well regardless of
remaining Health."*

**The problem case:** Castor dies, linked death kills Pollux, Pollux's Guts revives her — leaving
her alive with a dead partner, which the binding forbids.

**Our reading:** linked death applies `Death` semantics (ignores revival). *"Regardless of
remaining Health"* reads as absolute, and the alternative produces an illegal board state.

---

### Q12. Do the Dioscuri's combined NP modifiers double-count?

**Source:** *"The effects of all Skills, buffs and debuffs on both Castor and Pollux are combined
when calculating damage for this NP."*

If both twins carry `Atk Up 15%` from the same `Guardians of Navigation` cast, does the NP get
+30%?

**Our reading:** yes. "Combined" is plain, deduplication would need cross-instance identity
tracking, and it is what makes the joint NP worth its cost.

---

### Q13. What is a Servant's "strongest" Noble Phantasm?

**Source (Mannanán's Fragarach):** *"If the NP was the enemy Unit's strongest NP (or its only
damage-dealing NP), the NP is cancelled and the user is inflicted with Instakill."*

Ambiguous for conditional NPs (Karna's *Brahmastra* is 4× or 2× depending on the target) and for
non-damaging NPs.

**Our reading:** rank damaging NPs by expected damage against a synthetic neutral defender,
taking the best branch of any conditional. Non-damaging NPs are excluded (the ability already
says it cannot be used against them).

---

### Q14. Van Gogh's cooldown-reduction example

**Source:** *"Reduce Gogh's NP Cooldown by X Turns, where X = ⅓◈ × the stage of the Curse debuff
(e.g. Gogh has Stage 7 Curse, so NP Cooldown is reduced by 2◈+⅓◈ Turns)."*

At 3 turns/round: `⅓◈ = 1`, so `1 × 7 = 7` turns, and `2◈+⅓◈ = 7`. ✓ Consistent.
At 8 turns/round: `⅓◈ = 2`, so `2 × 7 = 14`, but `2◈+⅓◈ = 18`. ✗ Inconsistent.

**Our reading:** the formula `⅓◈ × stage` is authoritative; the parenthetical is an illustration
at 3 turns/round only.

---

### Q15. `Fragarach Tokens` or `Fragarach Counters`?

**Source:** Mannanán's sheet uses both names for what appears to be one resource
(*"Fragarach Tokens: 5/5"*, *"+5% for each Fragarach Counter"*, *"Remove all Fragarach
Counters"*).

**Our reading:** one resource, canonically `fragarachTokens`, with `Counters` as a display alias.

---

### Q16. Battle Continuation's NP reduction — doubled total or doubled dice?

**Source (generic skill):** *"For Noble Phantasm damage received, the **Total value of the roll**
is doubled."* → `2 × (2d10 + 20)`
**Source (Heracles's sheet):** *"if NP, the **number of dice rolled** is doubled."* → `4d10 + 20`

Different numbers (expectation 62 vs 42).

**Our reading:** the per-Servant sheet wins where it conflicts with the generic skill. So
Heracles uses `4d10+20`. General principle: a Servant's own text overrides the class-skill
template.

---

## Priority 4 — Edge cases and definitions

### Q17. Is defeat at `health ≤ 0` or `health < 0`?

Source says *"defeated when this drops below 0"* but effects say *"reduced to 0"*. We use `≤ 0`;
otherwise `Instakill` would not kill.

### Q18. Base Health for `END: EX`?

The table stops at Rank A (1500). Kingprotea has `END: EX` and a stated Base Health of 2000. We
extend the table with `EX: 2000`.

### Q19. Max Luck's `-` step value?

Source: *"For every - in Rank, decrease the Servant's Max Luck by."* — value missing. We use 1,
mirroring the `+` clause.

### Q20. ZON base values for Assassin and Caster

Source gives defaults (Assassin 4, Caster 5) *and* a "+2 for Casters and Assassins" clause that
does not stack with Independent Action. We read the +2 as *the reason for* those defaults
(bases 2 and 3), not an addition on top. The alternative reading gives Assassin 6 and Caster 7.

### Q21. Multi-class Servants

Semiramis is *"both a 'Caster' and 'Assassin' Class Servant"*. Which class's ZON default and NP
round gate apply? We take the most favourable of each (Caster's ZON, Assassin's round-4 gate).

### Q22. "Steps 1 and 4 of Combat are repeated" for Counters

Almost certainly a typo for "Steps 1 **to** 4" — a counter that skips the reaction ladder and the
damage step is nonsense, and `Instant Counter` explicitly describes skipping to Step 3 as its
*special* property. We run the full process.

### Q23. Master counter-redirect when the Servant is out of range

The redirect is written as absolute protection. We let it succeed regardless of range.

### Q24. Do Noble Phantasms crit?

The rules describe NP damage using the same `Attack+`/`Attack−` coin flip, but every crit-chance
effect says *"does not affect NP"*. We read this as: NPs crit on the base 50%, but crit-chance
modifiers do not apply.

### Q25. Does a revived unit perform an Injury Roll?

Step 4 requires the DU to have "survived". Revival is a post-defeat event. We say no.

### Q26. Does the ZON penalty apply to Free Servants?

No Master means no ZON, so the rule cannot apply. We exempt them.

### Q27. Even-dimension shape centring

No even-dimensioned self-anchored shape exists in the reference set. We bias toward negative
offsets (the caster occupies the lower-right of the four central panels) and show it in the
preview.

### Q28. Golden Wild Hunt's rectangle placement

*"Hits a 7×3 or 3×7 panel area in the direction the Golden Hind is facing."* Centred on the ship,
or projected forward from the bow? We project forward.

### Q29. Charm and faction

Charm changes control but not faction. Can a charmed unit attack its own allies? We say yes —
otherwise Charm is nearly useless.

### Q30. Do Confused units consume the controller's budget?

Unstated. We say yes: they act on their player's turn and nothing exempts them.

### Q31. Home base residency after a debuff cure

Does the 3-round counter reset after firing? We reset it to 0.

### Q32. Turn order with more than two factions

The rulebook only describes two. We have all factions roll `1d20`; highest picks their slot
first; the GM is always last.

### Q33. Knockback cascade ordering and tie-breaking

Unspecified for Kingprotea's `Huge Scale`. We use breadth-first from her centre, nearest first,
pushing directly away, with ties broken toward the larger open space, and a cycle guard that
stops the innermost unit and applies collision damage.

### Q34. Kingprotea's growth when displacement cannot resolve

Unspecified. We defer the growth (the stock is still gained, the size step is retried at the next
opportunity).

### Q35. Does `CS: Kill Yourself` bypass revival?

Unstated. We say no — `Death` is explicitly the effect that ignores revival, and this is not it.

### Q36. Dioscuri leash broken by forced movement

Unspecified. We allow it, require restoration on their next turn, and disable the joint NP while
broken.

### Q37. HGoB and AoE damage to passengers

The Golden Hind specifies full damage to the ship, 50% to passengers, and immunity for Masters
aboard. The HGoB says nothing. We apply the Golden Hind's rule.

### Q38. Combat Process step count

The rulebook says *"from Step 1 to Step 4"* in one place and then describes steps 5 and 6. We
treat the process as steps 1–6 with facing and counter included.

---

## How to use this chapter

For the game's author: Q1 through Q8 are worth an hour of your time and would remove most of the
uncertainty in this design. Q9 onward are individually small and can be resolved as they come up
in play.

For implementers: every question here has a shipped default and a note on where it is
implemented. If a resolution arrives, the change is localized — that is deliberate, and it is why
each entry names the chapter and mechanism involved.

For reviewers: this chapter is the honest accounting of what we do **not** know. A design
document that claimed no ambiguities against source material of this complexity would be
concealing them.

---

**End of the numbered chapters.** Appendices follow:
[A — Effect Catalogue](A-effect-catalogue.md) ·
[B — Rank Tables](B-rank-tables.md) ·
[C — Dice Registry](C-dice-registry.md) ·
[D — Servant Data Sheets](D-servant-data-sheets.md) ·
[E — Event Reference](E-event-reference.md)
