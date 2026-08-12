# Appendix B — Rank Tables

Every rank-indexed table in F/GT, in one place, in the form the engine consumes
(Ch. 05 §5.4). Each is authored once in `module/domain/tables.mjs` and referenced by id from
rule elements.

**Table kinds** (Ch. 05 §5.4):
- **scaled** — a value per grade plus a per-step delta.
- **banded** — grades grouped; steps ignored.
- **threshold** — ordinal cut points.

---

## B.1 Setup derivation

### `baseHealthByEnd` — scaled, perStep ±100

| EX | A | B | C | D | E |
|---|---|---|---|---|---|
| 2000* | 1500 | 1250 | 1000 | 750 | 500 |

\* `EX` is not in the source table; inferred from Kingprotea's sheet (Ch. 41 Q18).

Procedure: take the grade value, flip a coin, roll `Health(S)`, add on Heads and subtract on
Tails, then apply ±100 per step.

### `baseAgilityByAgi` — scaled, perStep ±1

| EX | A | B | C | D | E |
|---|---|---|---|---|---|
| 20 + 1d4 | 18 + X | 16 + X | 14 + X | 12 + X | 10 + X |

`X` = 2 on Heads, 1 on Tails.

### `baseLuckByLuc` — scaled, perStep ±1

| EX | A | B | C | D | E |
|---|---|---|---|---|---|
| 20 + 1d4 | 16 + 1d4 | 12 + 1d4 | 8 + 1d4 | 4 + 1d4 | 0 + 1d4 |

### Base Attack

Not rank-derived — authored per Servant. Adjusted by **±10 per granted step**
(Ch. 05 §5.6), where "granted" excludes the Servant's innate steps.

---

## B.2 Noble Phantasm costs

### `npCostByRank` — scaled, perStep ±3

Master Health lost when the Servant uses an NP. Left value: High Rank Master (A/B) or rankless.
Right value: Low Rank Master (C/D).

| Rank | High / Rankless | Low |
|---|---|---|
| EX | 75 | 100 |
| A | 50 | 60 |
| B | 40 | 50 |
| C | 30 | 40 |
| D | 20 | 30 |
| E | 10 | 20 |

Requirement: `masterHealth > cost`, strictly.

### `freeServantNPSustainabilityCost` — banded

Sustainability lost when a **Free** Servant uses an NP.

| EX | A | B | C | D | E |
|---|---|---|---|---|---|
| 6◈ | 5◈ | 4◈ | 3◈ | 2◈ | 1◈ |

For a Free Servant with `Sustainability: N/A`, the cost is **self Health equal to double the
left-hand column** of `npCostByRank`. Reaching 0 means disappearance at the end of the Combat
Process.

---

## B.3 Class skills

### Magic Resistance

**Passive 1 — MAG damage negation/reduction** — the negated rank is the skill's own rank,
extended by each `+`. Otherwise a percentage reduction:

| EX | A | B | C | D | E |
|---|---|---|---|---|---|
| 100% (total) | 50% | 40% | 30% | 20% | 10% |

**Passive 2 — debuff resistance** — scaled, perStep 0:

| EX | A | B | C | D | E |
|---|---|---|---|---|---|
| 30% | 25% | 20% | 15% | 10% | 5% |

Also protects against Instakill and Death **unless** the source deals STR damage or is otherwise
unaffected by Magic Resistance. Never protects against Erase.

### Independent Action

**Passive 2 — ZON bonus** — banded:

| EX, A | B, C | D, E |
|---|---|---|
| +3 | +2 | +1 |

**Passive 3 — contract rolls required** — banded:

| EX, A+ | A | B | C and below |
|---|---|---|---|
| Cannot be contracted | 4 | 3 | 2 |

### Riding — Active MOV bonus and cooldown

Scaled; cooldown perStep ∓⅓◈.

| Rank | MOV | Cooldown |
|---|---|---|
| EX | +6 | 3◈ |
| A | +5 | 3◈ |
| B | +4 | 2◈ |
| C | +3 | 2◈ |
| D | +2 | 1◈ |
| E | +1 | 1◈ |

### Territory Creation

**Passive 1 — offensive dice** (while in the Home Base), scaled, perStep ±5:

| EX | A | B | C | D | E |
|---|---|---|---|---|---|
| 6d20 | 5d20 | 5d10 | 5d8 | 5d6 | 5d4 |

**Passive 2 — defensive dice** (for allies in the Home Base), scaled, perStep ±2:

| EX | A | B | C | D | E |
|---|---|---|---|---|---|
| 3d10+30 | 3d10+20 | 3d10+15 | 3d10+10 | 3d10+5 | 3d10 |

Stacking: `highestOnly`, compared by **rank**.

### Item Construction

Aura, radius 2, allies. Scaled, perStep ±5. Values in brackets are the Instakill / Death ladder.

| Rank | General | Instakill | Death | Erase |
|---|---|---|---|---|
| EX | 75% | 40% | 20% | 0% |
| A | 50% | 25% | 10% | 0% |
| B | 40% | 20% | 10% | 0% |
| C | 30% | 15% | 5% | 0% |
| D | 20% | 10% | 5% | 0% |
| E | 10% | 5% | 0% | 0% |

Verification: Van Gogh's `Rank B-` sheet states 35% / 15% / 5%. Table gives `40 − 5 = 35` ✓.

Stacking: `highestOnly` by rank.

### Presence Concealment

**Discover chance** — scaled, perStep ∓5%:

| EX | A | B | C | D | E |
|---|---|---|---|---|---|
| 0% | 10% | 20% | 40% | 60% | 80% |

**Evade roll increase for the DU** — banded:

| A, EX | B, C | D, E |
|---|---|---|
| +4 | +3 | +2 |

**Cooldown after deactivation** — banded: `EX–B` = 2◈; `C–E` = 1◈.
**Duration when activated:** 2◈ at all ranks.

Verification: Kiritsugu `A+` → 10 − 5 = 5% ✓ (his sheet says 5%). Semiramis `C+` → 40 − 5 = 35% ✓.

### Mad Enhancement

**Passive 1 — Master Health lost per acted turn** — banded (no per-step clause):

| EX | A | B | C | D | E |
|---|---|---|---|---|---|
| 30 | 25 | 20 | 15 | 10 | 5 |

**Passive 2 — damage taken reduction** (NP value in brackets) — scaled, perStep ±5%:

| EX | A | B | C | D | E |
|---|---|---|---|---|---|
| 75% (30%) | 50% (25%) | 40% (20%) | 30% (15%) | 20% (10%) | 10% (5%) |

**Passive 3 — damage dealt increase** (halved for MAG) — scaled, perStep ±5%:

| EX | A | B | C | D | E |
|---|---|---|---|---|---|
| 100% | 80% | 60% | 40% | 20% | 10% |

**Passive 4:** MOV +2, Range +1, Master's ZON +2 — flat at all ranks.
**Passive 5:** Sustainability −2◈ if the Master dies while active — flat.
**Passive 6:** Evade rolls always use `Evade−` — flat.

Verification against sheets:
- Kingprotea `A+`: 50+5 = 55% taken (sheet: 55% ✓); 80+5 = 85% dealt (sheet: 85% ✓);
  Master drain 25 (sheet: 25 ✓ — banded, so `+` does not change it).
- Castor `B-`: 40−5 = 35% taken (sheet: 35% ✓); 60−5 = 55% dealt (sheet: 55% ✓).
- Penthesilea `EX`: 75% taken (sheet: 75% ✓); 100% dealt (sheet: 100% ✓); drain 30 (sheet: 30 ✓).
- Heracles `B`: 40% / 60% / 20 (sheet: 40% / 60% / 20 ✓).

All four sheets reproduce from the tables. Strong confirmation that the model is right.

### Battle Continuation

**Passive 1 — damage reduction** — scaled, perStep ±2. NP damage: *"the Total value of the roll
is doubled"* (but see Ch. 41 Q16 for Heracles's variant).

| EX | A | B | C | D | E |
|---|---|---|---|---|---|
| 2d10+30 | 2d10+20 | 2d10+15 | 2d10+10 | 2d10+5 | 2d10 |

**Passive 2 — revival** — scaled, perStep ±5 Health:

| Rank | Health restored | Cooldown |
|---|---|---|
| EX | 6d20 | 3◈ |
| A | 5d20 | 3◈ |
| B | 4d20 | 3◈ |
| C | 3d20 | 2◈ |
| D | 2d20 | 2◈ |
| E | 1d20 | 2◈ |

Additional condition: Health must have exceeded 50% of max at least once since the last use.

---

## B.4 Other rank-indexed rules

### `knockbackCollisionByEnd` — banded

STR damage taken when knocked into an occupied panel.

| EX | A | B | C | D | E | none |
|---|---|---|---|---|---|---|
| 1d12 | 1d20 | 2d12 | 3d12 | 2d20 | 3d20 | 5d10 |

Expectations: 6.5, 10.5, 13, 19.5, 21, 31.5, 27.5. Monotonic in toughness (except the "none"
row, which sits between D and E).

### `zonByClass` — not rank-indexed, but the companion table

| Class | Base | Class bonus | Effective default |
|---|---|---|---|
| Saber, Lancer, Rider, Berserker | 2 | — | 2 |
| Archer | 2 | — | 4† |
| Assassin | 2 | +2 | 4 |
| Caster | 3 | +2 | 5 |

† The source states Archer's default as 4 but only names Casters and Assassins in the +2 clause.
Recorded in Ch. 41 Q20.

The class bonus does **not** stack with Independent Action's ZON bonus — take the highest.

### `hgobBoardingModifiers` — threshold

| Condition | Required roll reduction |
|---|---|
| AGI rank C to B | −1 |
| AGI rank ≥ A | −2 |
| LUC rank C to B | −1 |
| LUC rank ≥ A | −2 |
| Hit by Dragon Wing Warriors this turn | −2 |
| Has the `Levitating` attribute | roll 1d8 instead, base target 8 |

Base: `1d12`, success on 12.

### `vasaviShaktiDivinityBonus` — threshold

| DU's Divinity | Damage multiplier bonus |
|---|---|
| Rank B to EX | +200% (tripled) |
| Rank E to C | +100% (doubled) |
| `Divine` attribute, no Divinity skill | +150% |

Note the third row sits *between* the first two, which is why this is a threshold table with an
explicit override rather than a pure ordinal scale.

### `gateOfSkyeSaveModifier` — **equality**, not threshold

| DU's MAG | Luck Check roll modifier |
|---|---|
| Rank B | −2 |
| Rank A | −4 |

Exactly `B` and exactly `A`. A `Rank EX` MAG receives **no** bonus. This is the case the
validator's `gte`-warning exists for (Ch. 05 §5.3).

### `masterEssenceNPShift` — by Master rank

| Rank | Essence | NP available from |
|---|---|---|
| A | Kaleidoscope | Round 2 (−4) |
| B | Imaginary Number | Round 3 (−3) |
| C | Leyline | Round 4 (−2) |
| D | Harvest | Round 5 (−1) |

### `masterEssenceCooldownReduction` — one use only

| Rank | Essence | Reduction |
|---|---|---|
| A | Divine Banquet | 3◈ |
| B | — | — |
| C | Crystal | 2◈ |
| D | Concentration | 1◈ |

Note Rank B's `Divine Banquet` is listed at 3◈ in the source under Rank B, not Rank A — the Rank
A list has `Heaven's Feel` (NP damage) instead. Table transcribed as printed.

### `masterEssenceNPDamage` — one use only

| Rank | Essence | Bonus |
|---|---|---|
| A | Heaven's Feel | +200% |
| B | Angel's Song | +150% |
| C | Dragonkind | +100% |
| D | Oracle | +50% |

---

## B.5 The Master essence catalogue

Full list, for the draft system (deferred past v1 — Ch. 01 §1.4).

**Rank A** (1 allowed; BA(MAG) 125; ZON +1; Sustainability +1◈; +1 parameter step):
Formalcraft (Luck +4) · Imaginary Around (Agility +4) · Limited/Zero Over (Health +200) ·
Kaleidoscope (NP 4 rounds earlier) · Heaven's Feel (NP +200% damage, 1 use).

**Rank B** (2 allowed; same bonuses as A):
Steel Training (damage taken −20%, NP −15%) · Primeval Magic (debuff chance −20%) ·
Projection (Luck +3) · Gandr (Agility +3) · Verdant Destruction (Health +150) ·
Antumbra (Normal/Skill/Spell damage +20%) · Elegance (crit +20%) ·
Imaginary Number (NP 3 rounds earlier) · Divine Banquet (NP cooldown −3◈, 1 use) ·
Angel's Song (NP +150% damage, 1 use).

**Rank C** (2 allowed; BA(MAG) 100):
Azoth Blade (damage taken −15%, NP −10%) · False Attendant (debuff chance −15%) ·
Black Keys B (Luck +2) · Black Keys G (Agility +2) · Black Keys R (Health +100) ·
Pendant (Normal/Skill/Spell damage +15%) · Grimoire (crit +10%) ·
Leyline (NP 2 rounds earlier) · Crystal (NP cooldown −2◈, 1 use) ·
Dragonkind (NP +100% damage, 1 use).

**Rank D** (2 allowed; BA(MAG) 100):
Tenacity (damage taken −10%, NP −5%) · Meditation (debuff chance −10%) · Technique (Luck +1) ·
Preemption (Agility +1) · Destruction (Health +50) · Flash (damage +10%) · Chance (crit +10%) ·
Harvest (NP 1 round earlier) · Concentration (NP cooldown −1◈, 1 use) ·
Oracle (NP +50% damage, 1 use).

A player may substitute a higher-rank slot with a lower-rank essence. Effects are **lost if the
Master is defeated** and are not transferred on re-contract.

---

## B.6 Implementation

```js
export const TABLES = {
  baseHealthByEnd: {
    kind: "scaled",
    byGrade: { EX: 2000, A: 1500, B: 1250, C: 1000, D: 750, E: 500 },
    perStep: 100,
  },
  independentActionZon: {
    kind: "banded",
    bands: [ { grades: ["EX","A"], value: 3 },
             { grades: ["B","C"],  value: 2 },
             { grades: ["D","E"],  value: 1 } ],
  },
  vasaviDivinity: {
    kind: "threshold",
    thresholds: [ { minOrdinal: Rank.parse("B").ordinal, value: 200 },
                  { minOrdinal: Rank.parse("E").ordinal, value: 100 } ],
    overrides: [ { predicate: ["target:attribute:divine",
                               { not: "target:skill:divinity" }], value: 150 } ],
  },
  // …
};
```

Every table is unit-tested against the sheet values that use it (Ch. 38 §38.3). The Mad
Enhancement verifications in §B.3 are four such tests, and they pass — which is the best
available evidence that the rank model matches the game's author's intent.

---

**Next:** [C — Dice Registry](C-dice-registry.md)
