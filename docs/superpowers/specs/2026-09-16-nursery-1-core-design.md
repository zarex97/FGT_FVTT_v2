# Nursery Rhyme, Part 1 — the core kit — design

**Date:** 2026-09-16
**Source:** `char_orig_sheets/Copia de Nursery Rhyme.md`
**Part 1 of 4.** See §1.1 for the decomposition.
**Chapters affected:** [07 — Time Model](../../07-time-model.md),
[15 — Abilities](../../15-abilities.md), [19 — Environment](../../19-environment.md),
[44 — Case Studies: the Expanded Roster](../../44-case-expanded-roster.md),
[45 — Implementation Status](../../45-implementation-status.md),
[A — Effect Catalogue](../../A-effect-catalogue.md), [D — Servant Data Sheets](../../D-servant-data-sheets.md)

---

## 1. The problem

Nursery Rhyme is the largest sheet in either roster — roughly **110 clauses**, more than the
Dioscuri (85) and Anastasia (60) put together. She carries **five Noble Phantasms**, two kinds of
summon, an Item that exists mostly to counter one of her own summons, a token economy, and a
**time rewind** that Ch. 43 §43.11 calls *"by a wide margin the most demanding mechanic in either
roster… nothing else requires the engine to remember the past."*

### 1.1 The decomposition

Four spec → plan → implement cycles, each producing working software.

| Part | Scope | Clauses |
|---|---|---|
| **1 — the core kit** *(this spec)* | Stats, the Note, four skills, three Spells, and *A Tale for Somebody's Sake* | ~45 |
| 2 — the summons | Trump Soldiers, the Jabberwock, and the `[Vorpal Blade]` Item | ~40 |
| 3 — Nameless Forest | The token economy | ~15 |
| 4 — The Queen's Glass Game | State history and the rewind | ~10 |

Part 1 ends with **a playable Nursery Rhyme**: a Servant you can put on a board, whose Skills,
Spells and one Noble Phantasm all work. Each later part adds a subsystem and gets its own
live-board verification, so a defect in the rewind cannot hide behind a working kit.

### 1.2 What Part 1 is

Underneath the exotic machinery is an ordinary Caster with an unusual weakness: **her Normal
Attacks use Base Attack (STR), which is 50, while her Noble Phantasm uses Base Attack (MAG), which
is 200.** Everything in her core kit either compensates for that swing or sets up the big one.

---

## 2. What already exists

| Her clause | Reality |
|---|---|
| *"Nursery's Normal Attacks use Base Attack (STR)"* | `normalAttack: {mode: fixed, component: str}`. Van Gogh is the mirror — her Note forces MAG — and the field exists for exactly this. |
| Territory Creation A, both clauses | **Authored already, on Medea, word for word.** Same Rank A, same `5d20`, same `(3d10+20)`, same non-stacking clause. See §4. |
| Home Base as a predicate | `rules/home-base.mjs`, and `self:inHomeBase` is the option Medea's clause 1 already uses. |
| Dice-valued damage modifiers | `roll: {key, formula}` on a `DamageModifier`, and `DamageNegation` for the ward half. Both are Medea's. |
| Non-stacking by rank | `stacking: highestOnly` on an `Aura`, which `rules/auras.mjs` resolves and makes the **default**. |
| A Spell's Base Attack | Scáthach's *Thurs* states the idiom in its own comment: *"A Caster's Spell draws on Base Attack (MAG)."* |
| `Child` / `Fairytale` scoping | `target:attribute:<tag>`, used by Jack and Achilles. `attributes` is an open set (Ch. 04 §4.5). |
| `Sap`, `Crit Up`, `Crit DmUp`, `Atk Up`, `Def Up`, `Dmg Cut`, `Debuff ResUp`, `NP DmUp`, `Def Dwn` | All authored. |
| Her printed figures | END `E` → **500**, STR `E` → **50**, MAG `A` → **200**. All three agree with the tables; `validate:content` will report no deviation. |

---

## 3. Rulings

**R1 — `Enigma` is self-only.** *(User ruling, 2026-09-16.)*

Her sheet: *"Applies the 'Enigma' buff **to Nursery**… Whenever **Alice** performs a Normal Attack
which deals STR damage, **Nursery** inflicts the Def Dwn (MAG) debuff for 1◈ Turns on the DU."*

Alice **is** Nursery — her True Name is *"Nursery Rhyme, Alice"*, the sheet labels her Skills
`(Alice)` and her last Noble Phantasm `(Nursery)`, and the two names alternate throughout.

**Appendix A's `Enigma` row disagrees** and is wrong: it reads *"When the bearer's **ally** performs
a STR-component Normal Attack."* That lost the Alice/Nursery identity. **Correcting the row is part
of this work.**

The self reading is also the one that makes the Skill coherent. Her Note pins her Normal Attacks to
BA(STR) **50** while her Noble Phantasm swings BA(MAG) **200**; *Enigma* is what makes the feeble
swing worth taking, because the `Def Dwn (MAG)` it plants raises MAG damage taken by 60% — setting
up the big one.

**R2 — Her two damage Spells deal 1× Base Attack (MAG).** *"Damage Spell. Deals damage with a 50%
chance of…"* states neither a component nor a multiplier. Scáthach's *Thurs* settles the component
in its own comment — *"A Caster's Spell draws on Base Attack (MAG)"* — and the multiplier is **1**
because none is stated; *Thurs* states its `2` explicitly, so the silence is meaningful.

**R3 — The Note is a defining weakness, not a footnote.** BA(STR) 50 against BA(MAG) 200, on a
Servant whose Range is 2. Recorded as a ruling because an author reading the sheet quickly would
treat it as a formality, and it is the axis her whole kit turns on.

**R4 — Territory Creation is promoted to a shared template.** Nursery's is byte-for-byte Medea's.
See §4.

**R5 — *A Tale for Somebody's Sake* increases the enemy's clock, it does not set it.** *"increases
the NP Cooldown of all affected Units by 1◈ Turns."* See §5's E1: today `CooldownDelta` would
**set** it to 1◈, which on a Noble Phantasm mid-cooldown is a *reduction*.

**R6 — `Disable` permits Move and nothing else.** Appendix A: *"Can only use the Move action."* So
it prevents `attack`, `np`, `spell`, `skill`, `gather` and `mark`, and leaves `move` alone — the
complement of `immobilize`, which prevents only movement.

---

## 4. Territory Creation, promoted

Four Servants carry a skill called Territory Creation and **each has its own file**:
`medea-territory-creation`, `semiramis-territory-creation`, `kingprotea-territory-creation`,
`normal-territory-creation`. Nursery's text is **identical to Medea's** — same rank, same dice, same
non-stacking clause.

**DECISION.** Promote the shared clause to `packs/_source/class-skills/territory-creation.yml`,
parameterised by rank, and re-point **Medea** and **Nursery** at it by `ref:`. This is the principle
the README states outright: *"Magic Resistance is authored once and instantiated at seven different
ranks, so fixing it fixes every Servant that has it."*

**Semiramis and Kingprotea keep their own files.** Semiramis's is the EX/C Hanging-Gardens split
that Appendix D marks with an `S`; Kingprotea's is a different clause set. They stay as variants
beside the template, exactly as `riding-medusa.yml` stays beside `class-riding.yml`.

**The rank tables already exist — and Medea is not using them.**

> **Corrected 2026-09-16, before planning.** `domain/tables.mjs` already carries
> `territoryCreationOffence` (`EX 6d20, A 5d20, B 5d10, C 5d8, D 5d6, E 5d4`) and
> `territoryCreationDefence` (`EX 3d10+30, A 3d10+20, … E 3d10`), **both fully indexed across all
> six grades**. This spec first claimed they would have to be created as single-witness
> derivations. They are neither new nor single-witness.
>
> What is true is that **`medea-territory-creation.yml` hardcodes the literals** — `"5d20"` and
> `"3d10+20"` — rather than reading the tables. That is the same latent defect
> `madEnhancementDrain` had, where a literal `30` was EX's value and every rank below it was
> wrong. Medea is Rank A so her two numbers happen to be right, and the file would be wrong at
> any other rank.
>
> So the promotion **fixes a bug on the way past**: the shared template reads
> `table: territoryCreationOffence` and `table: territoryCreationDefence`, and no literal survives.

**RISK.** This touches a Servant who is authored, tested and on a live board. Medea's existing tests
must pass unchanged — if any of them move, the promotion is wrong and gets reverted rather than
argued with.

---

## 5. The engine work

**One change.**

### E1 — `CooldownDelta` must reach the attack's targets, and must add

*A Tale for Somebody's Sake*: *"increases the NP Cooldown of all affected Units by 1◈ Turns."*

Two gaps, both in `engine/scheduler.mjs`'s `CooldownDelta`:

```js
return ids.map((id) => I.cooldown(u.id, id, Math.abs(amount), amount < 0 ? "reduce" : "set"));
```

1. **It turns the bearer's clock.** `u.id` is the handler's own unit. Every existing use is
   self-directed — *"reduce **Castor's** NP Cooldown"*, *"reduce the **Unit's** NP Cooldown"* — so
   nothing has ever needed to reach somebody else. Hers reaches the units her Noble Phantasm caught.
2. **A positive figure SETS rather than ADDS.** On an enemy Noble Phantasm sitting at 4◈ remaining,
   *"increases by 1◈"* must produce 5◈; `"set"` would produce 1◈, which is a **reduction** and
   hands the enemy their Noble Phantasm back early. The failure is not merely wrong, it is
   backwards — which is the shape of defect this project keeps finding.

Both are a few lines: a `target:` on the action, and an `"increase"` mode beside `"reduce"` and
`"set"`.

---

## 6. The clause inventory

~45 numbered goals. **FREE** = the engine already does it. **CONTENT** = new YAML. **ENGINE** = new code.

### 6.1 Identity and stats — 12, all FREE

| # | Clause |
|---|---|
| S1 | True Name *"Nursery Rhyme, Alice"* |
| S2 | Region England |
| S3 | Alignment True Neutral |
| S4 | STR E, END E, AGI C, MAG A, LUC B |
| S5 | Attributes: Female, Servant, `[Man]`, Humanoid, **Fairytale**, Non-Hominidae, **Child** |
| S6 | Base Health 500 (END `E` → 500 ✓) |
| S7 | MOV 4 |
| S8 | Range 2 panels, 1 target |
| S9 | BA(STR) 50 (STR `E` ✓) |
| S10 | BA(MAG) 200 (MAG `A` ✓) |
| S11 | Sustainability 4◈ |
| S12 | The Note — Normal Attacks use BA(STR) (R3) |

`Fairytale` and `Child` are new attribute tags and need no schema change: `attributes` is an open
set by design, and both are read by her own *Tommy Thumb's* clauses 5 and 6.

### 6.2 Territory Creation A — 3, CONTENT via the promoted template (§4)

| # | Clause |
|---|---|
| T1 | In its Home Base, damage dealt +`5d20` including NP |
| T2 | While on the field, allied Units **in their own Home Base** take `(3d10+20)` less, including NP |
| T3 | Only the highest-Rank Territory Creation takes effect — does not stack |

### 6.3 Self-Modification A — 3, CONTENT

| # | Clause |
|---|---|
| M1 | (Passive) Crit Damage dealt +40% |
| M2 | (Active) `Crit Up` 1◈, Crit Chance +60% |
| M3 | Cooldown 4◈ |

### 6.4 Shapeshift A+ — 1, CONTENT

| # | Clause |
|---|---|
| H1 | All damage taken −30%; if NP, −15%. A passive `Ward`, not a `Def Up` — nothing applies it and nothing can strip it. |

### 6.5 Tommy Thumb's Secret Picture Book A+ — 7, CONTENT

| # | Clause |
|---|---|
| P1 | Restores 3 Luck, and `Atk Up` 1◈ at +30% / NP +20% |
| P2 | `Def Up` 1◈ at −30% / NP −15% |
| P3 | `Dmg Cut` ⅓◈ at −30 flat, including NP |
| P4 | `Debuff ResUp` 1◈ at −40% |
| P5 | NP Cooldown −⅔◈ for allied Units within 2 panels with the **`Child`** Attribute |
| P6 | `NP DmUp` 1◈ at +20% for allied Units within 2 panels with the **`Fairytale`** Attribute |
| P7 | Cooldown 4◈−⅓◈ |

P5 and P6 reach **different sets**, so each states its own targeting rather than reusing the
ability's. She carries both tags herself, so both reach her.

### 6.6 Meanwhile… A — 4, CONTENT

| # | Clause |
|---|---|
| W1 | NP Cooldown −(1◈+⅓◈) |
| W2 | Restores 15% of maximum Health |
| W3 | Removes **all** debuffs from Nursery |
| W4 | Cooldown 4◈ |

### 6.7 The two damage Spells — 8, CONTENT + 1 new effect

| # | Clause |
|---|---|
| V1–V4 | **Plains of Winter** — Damage Spell, 1× BA(MAG) (R2), 50% `Disable` 1◈, Ice, cooldown 2◈ |
| F1–F4 | **Frenzied March Hare** — Damage Spell, 1× BA(MAG) (R2), 50% `Sap` 1◈, Wind, cooldown 2◈ |

`Disable` is **new** (R6). `Sap` exists.

### 6.8 White Queen's Enigma — 4, CONTENT + 2 new effects

| # | Clause |
|---|---|
| E1 | Spell, used during your Turn; cooldown 3◈ |
| E2 | Applies `Enigma` to Nursery for 1◈ |
| E3 | `Enigma`: whenever **she** makes a STR-component Normal Attack, inflict `Def Dwn (MAG)` 1◈ on the DU (R1) |
| E4 | `Def Dwn (MAG)`: all MAG damage taken +60%; if NP, +40% |

`enigma` and `defDwnMag` are both **new**. `Def Dwn (MAG)` has no row of its own in Appendix A — it
is referenced only from the `Enigma` row — so it gains one.

### 6.9 Nursery Rhyme: A Tale for Somebody's Sake — 8

| # | Clause | Verdict |
|---|---|---|
| A1 | Rank C, NP, `[Anti-Unit]` | FREE |
| A2 | Range = 4 | FREE |
| A3 | Base Attack (MAG) is used | CONTENT |
| A4 | Hits a **3×3 panel area** within Range | CONTENT |
| A5 | 3× damage | CONTENT |
| A6 | `Def Dwn` 1◈, all damage taken +20% | CONTENT |
| A7 | **Increases** the NP Cooldown of all affected Units by 1◈ | **ENGINE — E1** (R5) |
| A8 | Cooldown 5◈ | FREE |

**Tally: 12 FREE, ~29 CONTENT, 1 ENGINE, 3 new effects, 1 refactor.**

---

## 7. The content

**Thirteen new files, and two modified.**

**Effects (3)** — `disable`, `enigma`, `def-dwn-mag`.

**Class skills (1)** — `territory-creation.yml`, the promoted template (§4).

**Abilities (8)** — seven Skills and Spells plus one Noble Phantasm:
`nursery-self-modification`, `-shapeshift`, `-tommy-thumb`, `-meanwhile`, `-plains-of-winter`,
`-frenzied-march-hare`, `-white-queens-enigma`; and `-a-tale-for-somebodys-sake`.
Territory Creation comes by `ref:` to the promoted template rather than as a file of her own.

**Servant (1)** — `nursery-rhyme.yml`, carrying eight ability refs. The four Noble Phantasms of
Parts 2–4 are added by their own parts.

**Modified** — `medea-territory-creation.yml` becomes a `ref:` (§4), and Medea's Servant file with
it.

---

## 8. Verification

**Unit and golden tests** pinned to the sheet: her three derived figures against the tables; the
Note resolving her Normal Attack to BA(STR) 50 rather than BA(MAG) 200; Territory Creation's two
dice clauses reaching the pipeline from the promoted template, with **Medea's existing tests passing
unchanged**; `Enigma` firing on a STR Normal Attack and **not** on a MAG one; `Disable` permitting
Move and refusing the rest; and *A Tale*'s cooldown clause **increasing** an enemy clock from 4◈ to
5◈ rather than setting it to 1◈.

**The live board**, through claude-in-chrome: her sheet rendering with seven Attributes and
Sustainability 4◈; a Normal Attack card showing **50**, not 200; Territory Creation's `5d20` on the
damage card while she stands in her Home Base and its absence when she steps out; *Tommy Thumb*
reaching a `Child` ally and a `Fairytale` ally differently; and *A Tale* hitting a 3×3 and pushing a
caught enemy's Noble Phantasm **further** away.

---

## 9. Risks

**The Territory Creation promotion touches a live Servant.** Medea is authored, tested and on a
board. Her tests must pass unchanged; if any move, the promotion is wrong.

**E1's failure mode is backwards, not merely wrong.** A `"set"` where `"increase"` belongs hands an
enemy their Noble Phantasm *early*. It must be tested against a clock that is already running, not
against a fresh one — a test starting from 0 passes under both readings.

**Two new attribute tags are load-bearing for her own kit.** `Fairytale` and `Child` are read by
*Tommy Thumb's* clauses 5 and 6, and she carries both herself. A typo in either tag makes two
clauses silently reach nobody — including her.

**This is Part 1 of 4.** Nothing here may assume the summons, the tokens or the rewind exist. Her
Servant file gains four more ability refs in later parts, and must be written so that adding them is
an append rather than a rewrite.
