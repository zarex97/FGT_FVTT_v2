# Kingprotea — Design

**Source:** `char_orig_sheets/Copia de Kingprotea.md`
**Chapter:** `docs/36-case-remaining.md` §36.7

She is the acceptance test for **a Unit whose physical size changes mid-match**. Everything
else on her sheet is a fortress: the highest Mad Enhancement in the corpus, Territory Creation
EX on both sides, Independent Action B, and two independent stack economies feeding each other.

---

## 1. Statline

```
Alter Ego · Moon · Lawful Good
STR EX  END EX  AGI A  MAG D  LUC B
Attributes: Female, Servant, [Earth], Giant, Humanoid, Non-Hominidae, Mechanical, Animalistic
Base Health 2000 · MOV 7 · Range 1/1 · BA(STR) 200 · BA(MAG) 125 · Sustainability 7◈
Proliferation: (a stack economy, max 10)
```

`END EX → 2000` and `STR EX → 200` come off `domain/tables.mjs`; `MAG D → 125` likewise. The
attribute closure (Ch. 02 §2.10, built for Mannanán) gives her `spirit` and *not* `hominidae`,
because `Non-Hominidae` is on her sheet and the implication is stated *unless* it is.

`Giant ⇒ Large` is the closure's own rule and is what her *Huge Scale* passive keys on.

---

## 2. Proliferation — one mechanism, six clauses

The centre of the build. *Huge Scale*'s Active applies `Endless Proliferation` for 3◈+⅓◈, and
while it stands she gains **one Proliferation stock at the end of every ⅓◈**. Each stock is a
separate buff (the sheet says so, and it is what makes *Infantile Regression* a dispel). Ten
maximum. They survive `Endless Proliferation` ending.

What a stock is worth:

| Clause | Magnitude |
|---|---|
| Max **and current** Health | +20% of her *original* Max Health (400) per stock |
| NP damage received | −10% per stock, **capped at 80%** |
| Buff-removal chance | −35% at one stock, +5% for each after (= 30 + 5n) |
| Size | +1 panel every **3** stocks: 1×1 → 2×2 → 3×3 → 4×4 |
| Range | +1 per size step |
| MOV | −1 per size step |

Five of those six are "a magnitude that scales with how many of an effect the bearer holds",
which is one general mechanism the engine does not have:

```yaml
- key: MaxDelta
  stat: health
  value: 400
  perStack: { effect: proliferationStock }

- key: SizeStep
  value: 1
  perStack: { effect: proliferationStock, each: 3 }

- key: DamageModifier
  modifierKey: defUp
  direction: taken
  npValue: 10
  predicate: ["attack:kind:np"]
  perStack: { effect: proliferationStock }
  max: 80

- key: BuffRemovalResist
  value: 5
  perStack: { effect: proliferationStock, base: 30 }
```

`perStack: {effect, each = 1, base = 0}` resolves to `base + value × floor(count / each)` when
`count > 0`, and to `0` when it is not. `max` clamps the result. It is applied inside
`resolveValue`, which is the single funnel every executor already reads its magnitude through,
so every element gains it at once.

**The rules live on the Skill, not on the stock.** An effect's rules are collected once *per
instance*, so a `perStack` element on the stock itself would scale by `n` and be collected `n`
times — `n²`. *Huge Scale* is collected once.

**Counting.** `stacksOf(actor, defId)` sums `max(1, uses)` over instances, so it reads a
`magnitudeStacks` effect (n documents) and a `count` effect (one document with `uses: n`)
identically. `NP DmUp (GAO)` is the second shape.

**Current Health is raised by the stock-gain action, not by `alsoCurrent`.** `MaxDelta` is
recomputed on every data preparation, so `alsoCurrent` there would refill her every frame. The
handler that grants the stock emits the `+400` to `health.value` once; losing stocks lowers the
maximum and the pipeline's existing clamp brings current Health down with it, which is the
sheet's *"their effects are immediately lost"*.

**Growth.** `SizeStep` writes `footprint.w`/`footprint.h` as derived values;
`engine/token-footprint.mjs` already sizes a token from `system.footprint` and already
re-syncs on change — it only had to be told that a Servant can have one. Growing into occupied
panels is Ch. 08 §8.3's cascade, which `knockBackOccupants` already performs for Bašmu.

---

## 3. What else the engine is missing

| Clause | Missing | Design |
|---|---|---|
| Huge Scale P1 — move onto occupied panels | `movesOntoOccupiedPanels` is a Summon field | `GRANTS.ignoresOccupancy`, so a *Skill* can grant it |
| Huge Scale P1 — knock back **every** panel she lands on | The cascade handles one panel | `knockBackOccupants` walks the mover's whole footprint |
| Huge Scale P3 / Infantile Regression | Buff removal has no chance and no bypass | `rules/removal.mjs` + `BuffRemovalResist` + `ignoresRemovalProtection` |
| Self-Suggestion | `nvDebuff ResUp` | an effect; the `volatility` filter already exists |
| Giant Monster of the Great River | Apply an effect **N times** | `times:` on an effect spec, resolved from a stack count |
| Airavata King Size | NP DmUp scaled by her size | `perStack` again — `10 × floor(n/3)` is exactly 0/10/20/30 |
| Mad Enhancement A+ | Two figures the shared table does not produce | see §4 |

---

## 4. Mad Enhancement A+ — two figures, one rule

Six sheets reproduce from `madEnhancementDefence` and `madEnhancementOffence`. Hers states two
numbers neither table gives:

- *"All damage taken is reduced by 55%; **if NP, 25%**"* — the table's A+ is `[55, 30]`.
- *"increased by 85% ... halved for Base Attack (MAG) **(40%)**"* — half of 85 is 42.5.

Both fall out of one observation: **the author halves and rounds down to the nearest 5.**

| Rank | Normal | Half, floored to 5 | Sheet's NP figure |
|---|---|---|---|
| E | 10 | 5 | 5 |
| D | 20 | 10 | 10 |
| C | 30 | 15 | 15 |
| B− | 35 | 15 | 15 (Castor) |
| B | 40 | 20 | 20 (Asterios, Heracles) |
| A | 50 | 25 | 25 |
| A+ | 55 | 25 | **25 (Kingprotea)** |
| EX | 75 | 35 | **30 (Penthesilea, Raikou)** |

Seven of eight, and the same operation reproduces her MAG gloss (85 → 40). EX is the exception,
and it is the only rank whose normal figure jumps off the ladder (50 → 75 rather than 60).

**DECISION.** `magnitudeRoundTo: 5` on `DamageModifier`'s `magnitudeFactor` — so clause 3's MAG
half is derived rather than tabulated — and an `overrides` map on `scaled` tables, carrying
`"A+": [55, 25]` for `madEnhancementDefence`. Published exceptions live as data, the way
`TICK_OVERRIDES` does in `domain/tick.mjs`, rather than as a rounding hack in the lookup.

---

## 5. Alter Ego becomes a class skill

Mannanán and Kingprotea have the same *Alter Ego* passive, word for word. It is the **class**'s
skill, so it moves to `packs/_source/class-skills/alter-ego.yml` and both Servants reference it.
That is what the `{ref: …}` indirection exists for, and it makes the third Alter Ego free.

---

## 6. Territory Creation EX, and the rest

Straight instantiations of patterns Medea and Semiramis already established: a self-predicated
`DamageModifier` with a rolled `6d20` in her Home Base, and a field-scope `Aura` with
`requiresRecipient: {inHomeBase: true}`, `stacking: highestOnly` and `group: territoryCreation`
carrying a `3d10+30` `DamageNegation`. *Independent Action B* and *Goddess's Divine Core A* are
one `{ref}` and one small file.

*Monstrous Strength EX* is Asterios's ability at a different rank (150 / 75, 4◈), and *Giant
Monster of the Great River* hangs an `abilityUsed` handler off it.

*Earth Mother's Wail* is `rangeBonus: 2` and `component: mag` — both mechanisms built for
Mannanán.
