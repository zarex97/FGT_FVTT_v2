# Anastasia & Viy — design

**Date:** 2026-09-16
**Source:** `char_orig_sheets/Copia de Anastasia & Viy.md`
**Chapters affected:** [12 — Combat Process](../../12-combat-process.md),
[13 — Damage Pipeline](../../13-damage-pipeline.md), [14 — Checks](../../14-checks-and-randomness.md),
[19 — Environment](../../19-environment.md), [44 — Case Studies: the Expanded Roster](../../44-case-expanded-roster.md),
[45 — Implementation Status](../../45-implementation-status.md), [A — Effect Catalogue](../../A-effect-catalogue.md),
[D — Servant Data Sheets](../../D-servant-data-sheets.md)

---

## 1. The problem

A Servant who deliberately **blinds herself to hit harder**, who **soaks** her enemies so that the
next Ice attack freezes them, and whose Normal Attack is two different attacks depending on how far
away she is standing.

She also carries two Noble Phantasms, the corpus's only `Sustainability: N/A`, and an alignment the
rulebook does not list.

The striking thing about her, checked against the code, is how much of that the engine already
does. Three of her four most intimidating clauses — the banded Normal Attack, `Freeze` and `Invuln`
— are **readers that have been waiting for a writer**, in one case with her exact shape written into
the docstring for somebody else.

---

## 2. What already exists

| Her clause | Reality |
|---|---|
| *"Normal Attacks at a Range of 1 to 2 use BA(STR). At a Range of 3 or higher use BA(STR) and 10% of BA(MAG) combined (e.g. BA=110) and deal Ice damage, not affected by Magic Resistance."* | **`rangeBanded` is fully built.** `rules/normal-attack.mjs` exists for exactly this clause, and its docstring quotes **EMIYA's**, which is the same sentence with 20% in place of 10%. The chapter's own words: *"`rangeBanded` has been one of the three declared modes since the actor schema was written and nothing implemented it."* It does now, and `band.element` carries her Ice. |
| `Freeze` | **The damage behaviour is built and the effect document is not.** Stage 0 halts on *"Freeze broken by Fire"*; stage 16 holds the `<150` absorption and the excess pass-through. |
| `Invuln` | **Same.** Stage 16 negates and honours `Pierce`; stage 15 already halves it for a Noble Phantasm. |
| Independent Action **EX**: *"Sustainability does not apply"* | `independentActionSustainability` EX = **`null`**. |
| Independent Action **EX**: *"Master's ZON is increased by 3 panels"* | `independentActionZon` EX = **3** — her exact figure, and the table comment records it being fixed from a literal `2` for precisely this reason. |
| Independent Action **EX**: *"Cannot be contracted by enemy Casters and Masters"* | `rules/contract.mjs` makes A+/EX an absolute prohibition rather than a difficulty (Ch. 44, **Q48**). |
| *"Range+1 / Range+3 for the Combat Process"* | `anchor: { rangeBonus: N }` — Kingprotea's *Earth Mother's Wail*. |
| *"All Total Water Damage taken is reduced by 50% including NP"* | `Ward` predicated on `attack:element:water`. Karna's fire resistance is the same rule with a different element, and `attack:element` was added as a roll option when he was authored. |
| `Def Dwn (A)` on her Noble Phantasm | Authored 2026-09-16 for the Dioscuri's joint NP, which inflicts both variants. |
| Alignment *"Chaotic Summer"* | Ch. 44 §44.1 already made `alignment.morality` an open string, calling it *"a one-line schema change that would have been an expensive one to discover after content authoring began."* |
| `sustainability: N/A` | The scheduler tolerates `null`, and `apps/actor-sheet/context.mjs:378` already guards the sheet against it. |

**Her printed numbers all agree with the rank tables**, which is worth stating because the last
Servant's did not: STR `D++` → 75 + 2×10 = **95**; MAG `C` → **150**; END `E` → **500**; and the
Note's own *"e.g. BA=110"* is 95 + 15. Nothing here needs the Q50 correction Pollux needed.

---

## 3. Rulings

**R1 — No figure on her sheet is overruled.** See above. Recorded because the absence is
informative: `validate:content` will report no Base Attack deviation for her.

**R2 — Soaked is consumed when Fire breaks Freeze.** *(User ruling, 2026-09-16.)*

Her `Soaked` says *"When this Unit receives Fire damage, Total Fire Damage taken is reduced by 50%,
then the 'Soaked' effect is removed"*; `Freeze` says *"Any Fire damage removes Freeze with **no
damage or effects**"*, and stage 0 enforces that by halting outright before any reduction could run.

For a unit that is both, hit by Fire: **the halt stands** — no damage, Freeze breaks — **and Soaked
is consumed as well.** One Fire attack strips both layers without dealing a point. The halt gains a
carve-out so the removal fires on the way out.

**R3 — *"for each panel between Anastasia and the DU"* is the Chebyshev distance, not the gap.**
The corpus's only other use of the phrase is the Dioscuri's *"the maximum distance between the two
is 2 panels between them"*, which means distance 2 and is implemented as a Chebyshev 2 leash. So at
her Range 3 plus the Noble Phantasm's +3, the Instakill chance tops out at **30%**.

**R4 — Watermelon Splitting Master suppresses Blind's *miss* clause only.** *"it does not have a
chance of Missing"* is singular and specific. She keeps clause 2 — her own Evade rolls at +3 — which
is the price of the trick, and it bites, because her Active gives her Blind *"until the end of the
Combat Process"*, a window in which the defender may Counter. Clause 3 is inert; she carries no
Mystic Eye.

**R5 — Watermelon applies only at Range 1–2.** The sheet says so, and that is exactly the band in
which her Note already has her swinging BA(STR). Her ranged shots gain nothing from it.

**R6 — "Independent Action with Viy" is a variant document.** Passives 1–3 are the shared template
verbatim; passive 4 (*"Crit Chance is increased by 10%. Crit Damage dealt is increased by 10%"*) is
hers alone, and the skill is differently **named**. A variant, the way `riding-medusa.yml` is one —
not a `ref:` override, because `ref:` replaces a key wholesale and the extra passive would have to
restate the whole rule list.

**R7 — Her two Noble Phantasms are both hers, always.** `npChoice` is Normal-mode's *"select only
one before play"* and does not apply. Ch. 33's *"strongest Noble Phantasm"* ranking is stored data;
Snegleta (3.5× off BA(MAG) 150) outranks Ice Block Launcher (3× off BA(STR) 95) against a neutral
defender, so Snegleta is recorded as the stronger.

**R8 — Rock Snowball rides the ranged band only.** *"Normal Attacks at a Range of 3 or higher"* —
the same `attack:range:gte:3` boundary the Note draws, so the two clauses cannot disagree about
where her stance changes.

---

## 4. The clause inventory

~60 numbered goals. **FREE** = the engine already does it. **CONTENT** = new YAML. **ENGINE** = new code.

### 4.1 Identity and stats — 9, all FREE

True Name, Region Russia, Alignment Chaotic Summer, the five Parameters, Attributes
(Female, Servant, `[Man]`, Humanoid), Health 500, MOV 6, Range 3/1 target, BA 95/150,
`sustainability: null`.

### 4.2 The Note — 4, all FREE

| # | Clause | Verdict |
|---|---|---|
| N1 | Range 1–2 → BA(STR) | FREE — `rangeBanded` default |
| N2 | Range 3+ → BA(STR) + 10% BA(MAG) = 110 | FREE — a two-entry `sources` band |
| N3 | Range 3+ → Ice damage | FREE — `band.element` |
| N4 | Range 3+ → not affected by Magic Resistance | FREE — `band.ignoresMagicResistance` |

### 4.3 Class and passive skills — 9

| # | Clause | Verdict |
|---|---|---|
| W1 | Swimsuit!: Water damage taken −50% incl. NP | CONTENT — `Ward` + `attack:element:water` |
| I1 | Independent Action EX: Sustainability does not apply | FREE |
| I2 | Independent Action EX: Master's ZON +3 | FREE |
| I3 | Independent Action EX: cannot be contracted by an enemy | FREE |
| I4 | Independent Action EX: Crit Chance +10%, Crit Damage +10% | CONTENT — the variant's own passive (R6) |
| F1 | Fae Contract B+: Debuff Resist +5% | CONTENT — `ApplicationChance` incoming |
| F2 | Fae Contract B+: chance of inflicting debuffs +5% | CONTENT — `ApplicationChance` outgoing |
| K1 | Rock Snowball: 10% Bleed ½◈ on Normal Attacks at Range 3+ | CONTENT — `attack:range:gte:3` (R8) |
| K2 | *"Remember kids, don't throw snowballs with rocks in them!"* | FREE — flavour, carried in the description |

### 4.4 Active skills — 17

**Shvibzik (Summer) B+** — restores 3 Luck; `Atk Up` 1◈ +30% / NP 20%; NP cooldown −(1◈+⅔◈);
cooldown 4◈−⅓◈. All CONTENT. The cooldown reduction is `ticks`, being a ◈ expression.

**Freezing Summertime A** — `Invuln` ⅓◈ (**new effect**, reader built); `BuffRemoval ResUp` ⅓◈ at
100% (**new effect**; its `BuffRemovalResist` reader exists); `S.Crit Up` ⅓◈ +20% to allies within
2; cooldown 3◈.

**Full Acceleration: Spirit Eyes B** — `Aim` 1◈; `Crit Up (Viy)` 1◈, +50% crit on BA(MAG) attacks
and +20% if NP (**new effect**; `CritModifier` already carries `npValue`); `Crit DmUp` 1◈ +30%;
`NP DmUp` 1◈ +20%; cooldown 4◈.

### 4.5 Watermelon Splitting Master — 6

| # | Clause | Verdict |
|---|---|---|
| M1 | At Range 1–2 while Blind, no chance of Missing | **ENGINE — E1** |
| M2 | …instead it gains Pierce | CONTENT |
| M3 | …and Ignore Def | CONTENT |
| M4 | …and the DU's Evade roll is increased by 4 | **ENGINE — E2** |
| M5 | (Active) Anastasia gains Blind until the end of the Combat Process | CONTENT — self-applied |
| M6 | Cooldown 2◈ | FREE |

### 4.6 Ice Bucket Challenge — 10

| # | Clause | Verdict |
|---|---|---|
| B1 | Attack Skill, Range=2 | CONTENT |
| B2 | BA(MAG) is used | CONTENT |
| B3 | Water damage | CONTENT |
| B4 | 20% chance of `Slow` 1◈ | CONTENT |
| B5 | Applies `Soaked` | CONTENT — **new effect** |
| B6 | Soaked (a): on Ice damage, 25% Freeze, **additive** to the attack's own chance | **ENGINE — E3** |
| B7 | Soaked (b): on Fire damage, Total Fire −50%, then Soaked is removed | **ENGINE — E4** (+ R2's carve-out) |
| B8 | Soaked (c): removed at the end of a **Day** Round | **ENGINE — E5** |
| B9 | Soaked (d): neither a buff nor a debuff, and Unremovable | CONTENT |
| B10 | Cooldown 3◈ | FREE |

### 4.7 The two Noble Phantasms — 15

**Snegleta・Snegurochka B `[Anti-Unit]`** — BA(MAG); **Range+1** (FREE, `rangeBonus`);
`Def Dwn (A)` ⅓◈ at +30% with Luck −1 on damage (FREE, authored for the Dioscuri); 3.5× damage;
`Skill Seal` ⅓◈; cooldown 6◈.

**Ice Block Launcher C `[Anti-Unit]`** — BA(STR); **Range+3** (FREE); the `Aim` effect; 3× damage;
**5% Instakill per panel of distance** (**ENGINE — E6**, capped at 30% by R3); Ice damage;
cooldown 5◈.

**Tally: ~30 FREE, ~24 CONTENT, 6 ENGINE.**

---

## 5. The engine work

Six changes. Each lands with its reader in the same task — a rule that is right and inert is this
project's named dominant defect, and Ch. 45 classifies exactly that as **Collected**.

### E1 — `Suppress { scope: "miss" }`, read by `missChance`

Watermelon's *"does not have a chance of Missing"*, against the Miss check built at Combat Process
step 1.5 on 2026-09-16.

`rules/miss.mjs#missChance` already takes the attacker's roll options, so the gate rides along
unchanged. The predicate is `["self:effect:blind", "attack:range:lte:2"]` — **both options already
exist**, `attack:range:lte:N` being emitted as a ladder by `rules/options.mjs:139`.

Reuses the `Suppress` element that Blind's own clause 3 uses, rather than inventing a second way to
switch a rule off.

### E2 — an attacker-contributed check modifier reaching the defender

*"the DU's Evade roll is increased by 4 if it Evades the Attack."*

`rules/checks.mjs#checkPlan` already filters by `direction: "outgoing" | "incoming"`, so the axis
exists. What is missing is the attack flow **merging the attacker's `incoming` modifiers into the
defender's evade plan**.

`Deafen` is the near-miss that proves the gap: its catalogue row promises *"enemies evading this
unit's attacks roll −Y"*, its implementation modifies only its own bearer, and `deafen.yml`'s header
already records the discrepancy. Building this closes that too — but the catalogue row and Nemo's
sheet disagree about `Deafen`, so **only Anastasia's clause is authored here**; the `Deafen`
correction is noted and left for whoever settles that conflict.

### E3 — an additive chance rider contributed by the victim

*"a 25% chance of being inflicted with Freeze, **this is additive** to any Freeze chance the Attack
might have."*

The applier folds a rider's stated chance with the target's resistances today. It cannot let a
**defender's** effect *raise* the chance of a rider the **attacker** is applying — resistance only
runs downward. A `chanceBonus` contribution, keyed on effect id and on the incoming attack's
element, read where the rider's chance is resolved.

### E4 — Soaked's Fire clause, and the stage-0 carve-out

The halving is an ordinary element-scoped `Ward`. Two things are new: the effect **removes itself**
when its clause fires, and stage 0's `return s.halt("Freeze broken by Fire")` gains a line so Soaked
is consumed on the way out (R2).

**The riskiest edit in this Servant.** Stage 0 halts; a mistake there negates damage silently rather
than failing loudly.

### E5 — removal at the end of a Day Round

`roundEnd` fires and `rules/environment.mjs#phaseAt` answers `"day" | "night"`; the pair has never
been joined. An `OnEvent` on `roundEnd` predicated on `self:phase:day` — the option
`rules/options.mjs:268` already emits, **per panel** rather than per Round, because `phaseAt` is
positional (a unit standing in `sunlight` terrain reads `day` at night).

### E6 — a distance-scaled chance

`chancePerPanel: 5`, resolved against the attacker–defender distance the damage context already
carries. R3 puts the ceiling at 30%.

---

## 6. The content

**17 files.**

**Effects (5)** — `freeze`, `invuln`, `soaked`, `buff-removal-res-up`, `crit-up-viy`.

`freeze` and `invuln` are **status effects the whole roster can now receive**, not hers alone. Their
damage behaviour is already in the pipeline; these documents give it a way to arrive.

**Class skills (1)** — `independent-action-viy` (R6).

**Abilities (10)** — eight skills and two Noble Phantasms:
`anastasia-swimsuit`, `-fae-contract`, `-shvibzik`, `-freezing-summertime`, `-spirit-eyes`,
`-watermelon`, `-rock-snowball`, `-ice-bucket-challenge`; and `-snegleta`, `-ice-block-launcher`.

**Servant (1)** — `anastasia.yml`.

---

## 7. Verification

Two layers, and the second is not optional.

**Unit and golden tests**, pinned to the sheet: the banded Normal Attack resolving to 95 at range 2
and 110 + Ice + MR-exempt at range 3; Independent Action EX giving null Sustainability and ZON 3;
Freeze's `<150` absorption and Fire escape against the *authored* effect; Invuln's negation and its
Pierce bypass; Soaked's three clauses including R2's double strip; the Instakill ladder at 1, 3 and
6 panels.

**The live board**, through claude-in-chrome. The clauses only a board can settle: a Normal Attack
at range 2 versus one at range 3 producing different Base Attacks on the card; a Blind melee swing
that produces damage rather than a Miss; Soaked applied, then met by Ice, then by Fire; both Noble
Phantasms firing with their range bonuses; and the sheet rendering `Sustainability: N/A` without
falling over.

---

## 8. Risks

**`Freeze` and `Invuln` change the game for everyone.** They are not hers; they are two of the most
load-bearing statuses in Appendix A, and until now nothing could apply either. Authoring them makes
live behaviour that the pipeline has been carrying unexercised, so they get tests against the
existing readers rather than against the new documents alone.

**Stage 0 halts.** E4 edits the one place in the pipeline that returns before anything is computed.
A mistake there is a silent zero.

**Blind is now load-bearing in two directions.** It was authored a week ago as a pure debuff; E1
makes it a *resource* for one Servant, the way Van Gogh's Curse is. The suppression must be scoped
to her and to her melee band, or every Blinded attacker in the game stops missing.

**E2 has a second customer that disagrees with itself.** Building the attacker→defender check
modifier makes `Deafen`'s catalogue clause implementable, and the catalogue and Nemo's sheet do not
agree about what `Deafen` does. Out of scope here, and flagged so it is not silently "fixed" wrong.
