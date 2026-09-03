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

Procedure: take the grade value and apply ±100 per step. **There is no variance roll** —
`Health(S)` is unused (Ch. 41 Q1, revised `0.2.0`), so two Servants of the same END rank and
steps have identical Max Health.

Confirmed by the expanded roster at every grade the table covers: Asterios `A++` → 1500 (the
`++` is on his *parameter display*, not a health step); Achilles `A` → 1500; Raikou and
Quetzalcoatl `B` → 1250; Ozymandias, Jack and EMIYA `C` → 1000; Serenity, Yan Qing, Danzō,
Hundred-Faced Hassan, Medea and Medusa `D` → 750; Nursery Rhyme and Anastasia `E` → 500.
Seventeen sheets, no exceptions.

### `masterBaseHealth` — not rank-indexed

**250**, ± the `healthM` roll (Appendix C §C.2). Against Servant base health of 500–2000.

### `baseAgilityByAgi` — scaled, perStep ±1

| EX | A | B | C | D | E |
|---|---|---|---|---|---|
| 20 + 1d4 | 18 + X | 16 + X | 14 + X | 12 + X | 10 + X |

`X` = 2 on Heads, 1 on Tails.

### `baseLuckByLuc` — scaled, perStep ±1

| EX | A | B | C | D | E |
|---|---|---|---|---|---|
| 20 + 1d4 | 16 + 1d4 | 12 + 1d4 | 8 + 1d4 | 4 + 1d4 | 0 + 1d4 |

### `baseAttackStrByStr` and `baseAttackMagByMag` — scaled, perStep ±10

| | EX | A | B | C | D | E |
|---|---|---|---|---|---|---|
| **BA(STR)** from STR | 200 | 150 | 125 | 100 | 75 | 50 |
| **BA(MAG)** from MAG | 250 | 200 | 175 | 150 | 125 | 100 |

Note EX breaks the pattern on both rows: the grades otherwise step by 25, and EX jumps by 50.

**The table beats the sheet.** The author states it outright — *"if you find a value of Base
attack that differs from this calculation choose the value of this table instead of what is on
the character sheet"* — so this is a derivation, not a validation. Four figures across three
transcribed sheets disagree and are overridden: Jack the Ripper (85 at STR C → 100), Semiramis
(45 at STR E → 50) and Hassan of Serenity (65/100 at STR D MAG C → 75/150). The sheets keep the
transcribed number — they are faithful records of the author's documents — and
`npm run validate:content` names each divergence as a warning.

**Granted steps move the rank, not the number.** *"Then on top of it the + or - from other
sources (High Rank Master, Region)"*: a Region grant raises the parameter and the parameter picks
the row. This appendix used to say Base Attack was *"not rank-derived — authored per Servant,
adjusted by ±10 per granted step, where 'granted' excludes the Servant's innate steps."* That
distinction is gone: innate and granted steps are the same operation now, and the separate ±10
that `engine/summon.mjs` added was removed with it (it would double-count). Ch. 41 Q50.

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

**Variant — `mode: dice`.** Proto Gil's armour-derived Magic Resistance `C (E)` does not use the
percentage table at all: *"All MAG damage received is reduced by `3d20`; if NP, the number of
dice rolled is doubled."* It **never negates**. Structurally this is Battle Continuation's shape
wearing Magic Resistance's name, and it is why `Resistance` carries a `mode` field
(Ch. 44 §44.2). No table; the formula is authored on the ability.

**Elevated ranks.** Two sheets print `displayRank (baseRank)` — Kiritsugu's `LUC: EX (E)` and
Proto Gil's `MR: C (E)`. The display value is authoritative for every lookup; the base value is
recorded because some effects care about the intrinsic parameter (Ch. 05 §5.7).

### Divinity — scaled, perStep ±5

Flat damage added to everything the bearer deals, **including NP**.

| EX | A | B | C | D | E |
|---|---|---|---|---|---|
| 60 | 50 | 40 | 30 | 20 | 10 |

Verification: Van Gogh `B+` → 40 + 5 = 45 ✓. Karna, Nemo, Heracles `A` → 50 ✓.
Mannanán, Penthesilea, Ozymandias, Proto Gil `B` → 40 ✓. Semiramis, Achilles, Raikou `C` → 30 ✓.
Medusa **`E−`** → 10 − 5 = 5 ✓ — the first sub-E rank in the corpus, and it reproduces from the
table without a special case, which is the strongest evidence yet that ranks below E are ordinary
points on the scale rather than a floor (Ch. 05 §5.3).

### Divine Core — **exactly twice Divinity**

`Goddess's Divine Core` and `Twin God's Divine Core` carry `countsAs: divinity` and, at every
observed rank, deal **double** the Divinity value:

| Rank | Divinity | Divine Core | Bearer |
|---|---|---|---|
| EX | 60 | **120** | Quetzalcoatl ✓ |
| A | 50 | **100** | Kingprotea ✓ |
| B | 40 | **80** | Castor, Pollux ✓ |

Three sheets, three grades, one rule. Implemented as `divinityTable × 2` rather than as a second
table, so a future correction to Divinity propagates.

### Independent Action

**Passive 1 — Sustainability** — scaled, perStep 0:

| EX, A+ | A | B | C | D | E |
|---|---|---|---|---|---|
| **N/A** | 8◈ | 7◈ | 6◈ | 5◈ | 4◈ |

`N/A` means the Sustainability clock does not exist for that unit — not that it is very large.
Verification: Kiritsugu and Serenity `A` → 8◈ ✓; Kingprotea and EMIYA `B` → 7◈ ✓; Medusa `C` →
6◈ ✓; Proto Gil `A+` and Anastasia `EX` → N/A ✓.

**Passive 2 — ZON bonus** — banded:

| EX, A | B, C | D, E |
|---|---|---|
| +3 | +2 | +1 |

The class skill carried a **literal `value: 2`** until Serenity, which is right for EMIYA's B and
wrong for every other rank the corpus uses — her sheet states *"Master's ZON is increased by 3
panels"* and she would have been quietly given 2. It reads the table now. Verified live: Serenity
A → 3, EMIYA B → 2.

**Passive 3 — contract rolls required** — banded:

| EX, A+ | A | B | C and below |
|---|---|---|---|
| Cannot be contracted | 4 | 3 | 2 |

The top band is **absolute**, not "very many rolls". Rule Breaker's `bypassesContractRoll` does
not defeat it (Ch. 44 §44.5, **Q48**).

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
From the expanded roster: Serenity, Jack and Hundred-Faced Hassan `A+` → 5% ✓; Danzō `A` →
10% ✓; Danzō's `Dongyū` grant at `C+` → 35% ✓; Yan Qing `C` → 40% ✓, raised to `A` → 10% by
`Espionage` ✓, and his no-Fog-of-War `Doppelganger` fallback at `B+` → 20 − 5 = 15% ✓.

**Eight independent confirmations across seven Servants.** The one deviation is textual, not
numeric: Hundred-Faced Hassan's sheet adds a ninth clause — `Skill Seal` deactivates PC
immediately — which no other bearer has. Presence Concealment is therefore a **parameterized
template with per-Servant clause overrides**, not one shared effect document.

**All three tables now have readers.** They were transcribed here and sat unconsulted:
`presenceConcealmentDiscover` feeds `discoverChance`, which had a caller only in its own tests;
`presenceConcealmentEvade` replaced a hardcoded `4` in the Evade ladder — right for Serenity's A+
by accident and wrong for Yan Qing's C; and `presenceConcealmentCooldown` is what
`cooldown.countFrom: deactivation` looks up when the Skill ends. The 2◈ duration lives on the
effect definition rather than in a table, because it does not vary by rank.

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
- **Asterios `B`** (`0.2.0`): 40% taken / 20% NP / 60% dealt / drain 20 ✓.
- **Raikou `EX`** (`0.2.0`): 75% taken / 30% NP / 100% dealt / drain 30 ✓.

**Six sheets reproduce from the tables, from two independently-supplied rosters.** Asterios and
Raikou were written months after Heracles and Penthesilea and match them to the point; that is
the strongest validation any table in this appendix has received.

**One rank-level exception.** Raikou's `EX` Mad Enhancement adds a clause no other bearer has:
it is **constantly active and cannot be deactivated while her Master is within 2 panels**, with
a Command-Spell override lasting 1◈ that lapses back if the condition still holds. Like
Heracles's `cannotDeactivate`, this is a per-Servant flag on the mode, not a table value —
modes carry their activation policy separately from their magnitudes for exactly this reason
(Ch. 15 §15.6).

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

Verification: Heracles `A` → 2d10+20, 5d20, 3◈ ✓. **Achilles `A`** (`0.2.0`) → 2d10+20, 5d20,
3◈ ✓ — and his sheet, like Heracles's, spells the NP clause as *"the number of dice rolled is
doubled"* rather than the common table's *"the Total value of the roll is doubled"*. Two of two
sheets print the dice form. Ch. 41 Q16 resolved this as **the per-Servant sheet wins**; the
second instance suggests the dice form may in fact be the norm and the table's wording the
outlier, but we continue to read it off the sheet rather than change the default.

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

### `andreiasAmarantosByAttackerDivinity` — threshold, **defaulting to immunity**

Achilles's damage reduction, keyed on the **attacker's** Divinity rank.

| Attacker's Divinity | Damage taken |
|---|---|
| C and above | 100% (normal) |
| D | 75% |
| E | 50% |
| **None** | **0** |

The "none" row is the default, not an edge case — and against the expanded roster eleven of
seventeen Servants fall into it. This is the only defensive table in the game whose *absent*
case is the strongest one, which is why it is a threshold table with an explicit `default`
rather than a scale with an implied zero.

### `enkiduByDivinity` — scaled, two outputs

Proto Gil's Enkidu, keyed on the **defender's** Divinity rank.

| Rank | Damage bonus | `Stun` chance bonus |
|---|---|---|
| EX | +150% | +100% |
| A | +100% | +50% |
| B | +80% | +40% |
| C | +60% | +30% |
| D | +40% | +20% |
| E | +20% | +10% |

Two overrides, both stated on the sheet:
- A unit with the `Divine` **attribute** but no `Divinity` **skill** is treated as Rank A.
- Against a `Divine` unit, `Debuff Immune` cannot prevent the Stun — but `Debuff Resist`
  still reduces its chance.

The second is worth dwelling on: it separates **immunity** from **resistance** in a way nothing
else in the corpus does. The effect application pipeline (Ch. 11 §11.4) checks them at different
points, so the override is a single `bypassesImmunity: true` flag rather than a special case.

### `xiuhcoatlNpTagEscalation` and the NP tag scale

The ordered scale established in Ch. 43 §43.8 (decision D43.2):

`Anti-Unit` < `Anti-Army` < `Anti-Fortress` < `Anti-Country` < `Anti-World`

Unordered qualifiers that sit outside it: `Anti-Unit (Self)`, `Anti-Divine`, `Anti-Beast`,
`Barrier`, `Fortress`, `Labyrinth`, `weaponType`, `divineConstruct`, `thrownWeapon`.

Consumers: Ozymandias's Complex ends when hit by two `[Anti-Fortress]`-or-higher NPs in one
Round; Pale Rider's Doomsday Come ends to any `[Anti-World]`-or-higher; Achilles's Akhilleus
Kosmos negates an incoming AoE NP of **Rank** A or above (rank, not tag — they are different
axes and this is the one ability that keys on the former). Recorded as **Q44**.

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

Every table is unit-tested against the sheet values that use it (Ch. 38 §38.3).

**As of `0.2.0` the verification set spans two independently-authored rosters.** Six Mad
Enhancement sheets, eight Presence Concealment sheets, seven Divinity sheets across five grades
including a sub-E, three Divine Cores, six Independent Action sheets, two Battle Continuations,
seventeen base-health derivations — and every one reproduces from the table. The one place a
table needed extending rather than confirming was Magic Resistance, which gained a `dice` mode
for a single Servant.

That is the outcome the rank model was designed for: adding 17 Servants required **zero** table
value changes and **one** new table kind.

---

**Next:** [C — Dice Registry](C-dice-registry.md)
