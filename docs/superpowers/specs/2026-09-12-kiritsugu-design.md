# Kiritsugu — Design

**Source sheet:** `char_orig_sheets/Copia de Kiritsugu.md`
**Prior analysis:** Ch. 36 §36.2 — *"Kiritsugu — reactive support and buff stripping"*
**Structural chapters:** Ch. 11 §11.6 (auras), Ch. 12 §12.8 (the reaction ladder), Ch. 13 (the
damage pipeline), Ch. 14 §14.5–6 (checks), Ch. 15 §15.3 (timing windows), Ch. 24 §24.3 (rule
elements), Appendix A §A.10 (Decoy, Skill Seal)
**Date:** 2026-09-12

**Goal.** Emiya Kiritsugu plays exactly as his sheet reads. Eleven entries, and the shape that
makes him different from everything already in the corpus is **reactivity**: his signature skill
fires an attack on somebody else's Turn, triggered by a third party being attacked, and lets him
cast a spell inside the trigger. Every other Servant built so far acts on their own Turn or
answers an attack aimed at themselves.

**Method.** Every commit pairs an engine addition with the clause that consumes it. Nothing lands
inert — which for this Servant is the governing risk rather than a slogan, because **two of his
eight gaps are cases where the contribution is already collected correctly and read by nobody**
(§4.2, §4.4). That is the failure mode the Raikou pass produced six times, and §4 names the
reader for every addition before it is written.

---

## 1. What the sheet says, and what each clause costs

| # | Clause | Mechanism | Status |
|---|---|---|---|
| 1 | Statline, attributes, Sustainability | content only | every number reproduces (§1.1) |
| 2 | **Presence Concealment A+** — eight clauses | `{ref: class-presence-concealment, rank: "A+"}` | **all eight already built** |
| 3 | **Independent Action A** — three passives | `{ref: class-independent-action, rank: A}` | **all three already built** |
| 4 | Magecraft B P1 — one Thaumaturgy per Turn | **a category-scoped per-Turn limit** | nothing built (§4.1) |
| 4b | Magecraft B P2 — extend `Suppression` by 1◈ | `OnEvent` + `DurationExtension` | built |
| 5 | Thaumaturgy: Reinforcement — N.Atk Up 40% | content only — EMIYA's twin at 30% | built |
| 6 | Thaumaturgy: Penetration — Ignore Def, halve Invuln | **attacker-borne attack properties** | nothing built (§4.3) |
| 7 | Thaumaturgy: Familiars — Range Up, ranged Crit Up | content only — EMIYA's Hawkeye shape | built |
| 8 | Affection of the Holy Grail P — LUC E→EX | `RankShift` | built |
| 8b | …*"Luck Checks of all Units within 2 panels, except himself"* | **an aura carrying a check modifier** | nothing built (§4.2) |
| 8c | …the Skill Seal substitution | predicated elements + R2 | built, given R2 |
| 8d | …(Active) Pierce / Crit DmUp / Debuff ResDwn | needs §4.3 for Pierce | partly built |
| 9 | Scapegoat C — Decoy on an ally, at two windows | `whenAllyAttacked` + a Decoy variant | built |
| 10 | **Lethal Gunfire Suppression B+ (Passive)** | **a free out-of-turn attack on a third party's trigger** | nothing built (§4.7) |
| 10b | …(Active) Luck, Atk Up, the `Suppression` buff | **a damage-step strip whose result gates a follow-on** | nothing built (§4.6) |
| 11 | **Chronos Rose** (NP) — Ignore Def, Crit Dwn, +1◈ to the DU's NP | **a cooldown phase that reaches the target** | nothing built (§4.5) |
| 12 | **Mystery Bisection** (NP) — Instakill, the `Kiritsugu` mark | **a Base Attack modifier, both components** | nothing built (§4.4) |

### 1.1 Every number on the sheet reproduces from the tables

Measured against `domain/tables.mjs`:

| Sheet says | Table | Rank | Value |
|---|---|---|---|
| Base Attack (MAG): 175 | `baseAttackMagByMag` | B | 175 ✔ |
| Base Attack (STR): 65 | `baseAttackStrByStr` | D | **75 — the table wins, see below** |
| Base Health: 1000 | `baseHealthByEnd` | C | 1000 ✔ |
| PC *"5% chance of being discovered"* | `presenceConcealmentDiscover` | A+ | 10 + (−5) = 5 ✔ |
| PC *"Evade Roll is increased by 4"* | `presenceConcealmentEvade` | A+ | 4 ✔ |
| PC *"Cooldown: 2◈ after deactivation"* | `presenceConcealmentCooldown` | A+ | 2◈ ✔ |
| IA *"high Sustainability (8◈ Turns)"* | `independentActionSustainability` | A | 8 ✔ |
| IA *"Master's ZON increased by 3 panels"* | `independentActionZon` | A | 3 ✔ |
| IA *"Requires 4 successful rolls"* | `independentActionContract` | A | 4 ✔ |

Eight figures across two class skills, and **not one is authored as an override**. Both class
skills are a `ref:` line and nothing else.

**One deviation, and the sheet loses it.** `baseAttackStrByStr` puts STR D at **75**; his sheet
says **65**, and so does Serenity's — which looked like a deliberate figure for the set's two
Assassins. **It is not.** Ch. 41 Q50 settles the general case in the author's own words:

> *"If you find a value of Base attack that differs from this calculation choose the value of
> this table instead of what is on the character sheet."*

So `domain/base-attack.mjs#baseAttackFor` **derives** Base Attack from the rank and the authored
65 is ignored: **he plays at 75.** The authored figure is kept anyway, as the other four
deviations are (Jack, Penthesilea, Semiramis, Serenity), so the sheet's record survives and
`validate:content` keeps warning that it is overruled.

*Corrected during Task 3.* This section first claimed the opposite — *"the sheet is
authoritative: 65 stands"* — and the Task 1 test asserted `baseAttack.str === 65` and passed
while the game played 75. An assertion about the YAML rather than about the behaviour, which is
the failure §5.1 warns about, caught by a validator warning rather than by any test.

---

## 2. Rulings

### R1 — The Suppression shot is **entirely free**

> *"Kiritsugu can instantly perform a Normal Attack on that AU."*

**Authorial ruling.** It costs him nothing and has **no per-Turn cap**: it does not spend his
Attack, does not mark him as having Acted, and fires on every qualifying trigger. He may take
three shots on an enemy Turn and still attack normally on his own.

The clause is limited by its *trigger* rather than by a budget — `Decoy (Scapegoat)` lasts 1◈
behind Scapegoat's 3◈ cooldown, the attacker must be inside his Range, and the decoy has to
actually be attacked. That is the cost, and it is paid in advance by spending Scapegoat.

Consequence for the design: the shot must **not** route through the ordinary Attack budget, and
`countsAsAttack` must be false on whatever carries it. A shot that quietly consumed his Turn's
Attack would read identically in every unit test and be wrong in every actual game.

### R2 — Skill Seal is a **hard counter**, not a trade

> *"If Kiritsugu is inflicted with Skill Seal, instead of reducing his Max Luck, all of his Luck
> Check rolls are increased by 20; and the original effect is negated."*

**Authorial ruling.** Under Skill Seal, **all** of the following hold at once:

1. The `RankShift` to EX **stops applying** — his LUC falls back to **E** and Max Luck drops with it.
2. The +4 aura on nearby Units **stops**.
3. His Skills and Spells **remain sealed** — the ordinary Skill Seal lockout is untouched.
4. He additionally takes **+20 to every Luck Check roll he makes**.

So *"the original effect is negated"* is read against the **aura**, and the +20 is a *substitute
penalty* rather than compensation. This matches Ch. 36 §36.2's sketch and makes Skill Seal the
designed answer to him.

**+20 is a penalty, not a bonus, and this is the clause most likely to be built backwards.**
`checks.mjs#resolveCheck` returns `success: total <= target`, so *increasing a roll* moves it
away from success. The same reading governs the aura in R3.

### R3 — The +4 aura **hinders** everyone, allies included

> *"the Luck Check rolls of all Units within a 2 panel area of Kiritsugu are increased by 4
> except himself."*

**"All Units"** means both relations — `relations: [ally, enemy]`, with `self` **omitted** from
the list, which is exactly the addressing `rules/auras.mjs` documents in its own header, naming
this skill. And by R2's arithmetic it is a **penalty on the recipients**: standing near
Kiritsugu makes your Luck Checks harder whether you are his ally or not.

That is coherent with the name. The Grail's affection is not a blessing he shares; it is
something that spills out of him and lands on whoever is close.

### R4 — The `Kiritsugu` mark halves **both** Base Attack components

> *"the Unit's Base Attack (both STR and MAG) are reduced by half of their original value."*

**Authorial ruling, on the user's clarification.** Both components, and *"original value"* means
the value before this mark — so re-application cannot compound, which the sheet also states
outright (*"does not stack"*).

This decides **where** the modifier lives (§4.4): in the **snapshot projection**, not in damage
pipeline stage 1. A stage-1 hook sees only the one component the current attack uses, so the
`mag` half would never be applied at all against a STR attacker and vice versa.

**The mark is far worse for a MAG-based Servant.** Medea (50/210) loses 105 off the number she
actually attacks with; a STR attacker loses the smaller half of theirs. That asymmetry is the
sheet's design — it is what makes Mystery Bisection a *crippling* rather than a finisher — and
the live test must therefore hit a **MAG attacker** explicitly, not only a STR one.

### R5 — *"5 times"* on `Suppression` is a **use count**

Carried forward from the Raikou pass, where the user generalised it: *"what I said of
'Genji-clan: Crit DmUp' applies to anything that says 'N times', these are the number of uses."*

So `Suppression` holds **both** a duration (1◈, extendable by Magecraft) and **5 uses**, and ends
on whichever runs out first. A use is spent by a **successful strip**, not by every Normal
Attack — the clause reads *"Successful Normal Attacks remove 1 buff …"*, so an attack against a
target with no buffs left spends nothing.

### R6 — The strip happens **before** the damage is computed

> *"…remove 1 buff from the DU **at the start of the Damage Step**."*

Load-bearing and the easiest thing here to get quietly wrong. If the strip lands after the
damage, a `Def Up` that should have been torn off still reduces the hit, and every unit test
that only asserts *"a buff was removed"* passes anyway. The ordering **is** the clause, so it is
what the live test measures: the same attack against the same target, with and without
Suppression, must differ by the stripped buff's contribution.

### R7 — His Normal Attack uses **BA(STR) = 65**

His sheet states no component. **Semiramis is the precedent**: authored at STR 45 / MAG 200 and
she still swings with STR, because her sheet is silent too. Both of his Noble Phantasms say
*"Base Attack (STR) is used"* explicitly, and his two signature skills — Reinforcement and
Lethal Gunfire Suppression — are both about **Normal Attacks**, which is a gunman's identity.
`normalAttack: {mode: fixed, component: str}`.

### R8 — His Class container is **Assassin**

He carries an Assassin class skill (Presence Concealment) and an Archer one (Independent
Action), so the container is a choice. **Assassin**, because Presence Concealment is eight
clauses that rewrite targeting, the reaction ladder, the damage pipeline and movement legality,
while Independent Action is three passives — and because his statline is Serenity's shape
(§1.1). `classContainer` is presentational and the setup wizard's slot; it drives no class
bonus, so nothing mechanical rests on this.

### R9 — The NP2 mark's effect id is `kiritsuguMark`, not `kiritsugu`

An effect sharing a content id with its Servant is a **build-breaking collision**, found the hard
way last pass when the `raikou` effect collided with the `raikou` Servant and had to become
`raikouBuff`. Named correctly from the start this time.

---

## 3. The content

### 3.1 `packs/_source/servants/kiritsugu.yml`

```yaml
id: kiritsugu
name: "Kiritsugu"
trueName: "Emiya Kiritsugu"
classContainer: assassin          # R8
region: japan
alignment: { order: chaotic, morality: evil }
attributes: [male, servant, man, humanoid, antiHero]
parameters: { str: D, end: C, agi: "A+", mag: B, luc: E }   # EX via Affection — R2
baseHealth: 1000
mov: 7
range: { panels: 3, targets: 1 }
baseAttack: { str: 65, mag: 175 }  # 65 is the sheet's, matching Serenity — §1.1
normalAttack: { mode: fixed, component: str }               # R7
sustainability: "8◈"               # Independent Action A's table value
```

`luc: E` is the **written** parameter; the EX is a `RankShift` the passive contributes, so that
Skill Seal can take it away (R2). Authoring `luc: EX` would make the rank shift unobservable and
R2 unimplementable.

### 3.2 Two refs, no new files

```yaml
abilities:
  - { ref: class-presence-concealment, rank: "A+" }
  - { ref: class-independent-action, rank: A }
```

Eleven sheet clauses across three entries, and **all eleven already resolve**. §1.1 is the proof.

### 3.3 Nine ability files

| File | Shape |
|---|---|
| `kiritsugu-magecraft` | passive: the per-Turn category limit (§4.1) + `DurationExtension` on `Suppression` |
| `kiritsugu-reinforcement` | Spell, `combatPhaseStart`, `nAtkUp` 40% for ⅓◈, cd 2◈ |
| `kiritsugu-penetration` | Spell, `penetration` for ⅓◈, cd 3◈ |
| `kiritsugu-familiars` | Spell, `rangeUp` 2 + `critUpFamiliar` 30, both 1◈, cd 4◈ |
| `kiritsugu-affection-of-the-holy-grail` | passive (R2/R3) + Active: `pierce`, `critDmUp` 50, aura `debuffResDwn` 20; cd 4◈-⅓◈ |
| `kiritsugu-scapegoat` | Active at `[ownTurn, whenAllyAttacked]`; `decoyScapegoat` 1◈ then `sCritUp` 15 for ⅓◈; cd 3◈ |
| `kiritsugu-lethal-gunfire-suppression` | passive (§4.7) + Active: restore 4 Luck, `atkUp` 40/30, `suppression`; cd 4◈ |
| `kiritsugu-chronos-rose` | NP, Range 3, BA(STR), 3.5× + 100 Ignore Def, `critDwn` 30, +1◈ to the DU's NP; cd 6◈+⅓◈ |
| `kiritsugu-mystery-bisection` | NP, Range 1, BA(STR), 3× + 100, 35% Instakill if damaged, `kiritsuguMark`; cd 5◈+⅓◈ |

All three Thaumaturgy Spells carry `category: thaumaturgy`, `isSpell: true`,
`countsAsAttack: false` and `negatedBy: [silence]` — EMIYA's Reinforcement is the template and
`ofCategory: thaumaturgy` already exists as a filter.

### 3.4 Six effect files

| Id | Why it is its own document |
|---|---|
| `pierce` | **There is no Pierce effect in the corpus at all.** `attack.pierce` is read off an ability's own damage block; nothing can grant it as a buff (§4.3) |
| `penetration` | Ignore Def **and** halve Invuln — a pairing no existing effect carries |
| `critUpFamiliar` | Range-conditional, exactly like `critUpHawkeye`; a plain `critUp` would buff him in melee where the sheet gives nothing |
| `decoyScapegoat` | Lethal Gunfire Suppression triggers on **this** decoy specifically, so it cannot be the shared `decoy` |
| `suppression` | 5 uses + 1◈ + the strip loop (R5, R6) |
| `kiritsuguMark` | Base Attack halving, both components; unremovable, non-stacking, resist- and immunity-bypassing (R4, R9) |

Reused unchanged: `nAtkUp`, `rangeUp`, `critDmUp`, `debuffResDwn`, `sCritUp`, `critDwn`,
`instakill`, `atkUp`, `skillSeal`.

---

## 4. The engine additions

Each names its **reader** before it is written. An addition with no reader is the defect this
project produces most often.

### 4.1 A per-Turn limit scoped to a **category**, with an exemption

> *"Only one Thaumaturgy Spell can be used per Turn."* — and Lethal Gunfire Suppression:
> *"Kiritsugu can use a Thaumaturgy Spell once before performing this Normal Attack (Note: This
> does not count towards the one Thaumaturgy Spell usage per Turn, but it will still enter
> Cooldown)."*

`sameTurnExclusive` names ability **ids**, so three Spells would need six cross-references that
go stale the moment a fourth is authored — and, decisively, **it has no way to express an
exemption**. The sheet states one explicitly.

A limit declared by the skill that states it, counted against the Turn record (which already
records what was used), and bypassable by a flag on the offered use.
**Reader:** `rules/costs.mjs#canUseAbility`, beside the existing `oncePerTurn` gate, so the
button greys out with a reason rather than failing at resolution.

### 4.2 An aura that carries a **check** modifier

`annotateAuras` routes each contribution by `ROUTES[m.key] ?? "modifiers"`, and check modifiers
are read from `unit.checkModifiers` by `checks.mjs#checkPlan`. So an aura carrying a
`CheckModifier` today lands in `modifiers`, where the damage pipeline ignores it and nothing else
looks — **collected correctly, read by nobody.**

This is the same class of defect as Medea's Item Construction (`ApplicationChance`, which needed
its own route for exactly this reason) and it is already solved in the same file. One route
entry. **Reader:** `checkPlan`, via `unit.checkModifiers`.

The addressing needs nothing new: `relations: [ally, enemy]` with `self` omitted is supported,
and `rules/auras.mjs`'s header already cites this skill as the reason.

### 4.3 Attacker-borne attack properties — Pierce, Ignore Def, halved Invuln

`attack.pierce` comes from `resolvedDamage(ability, options)?.pierce` — the **ability's own**
damage block — and `ignoresDefensiveBuffs` is set by the Heel resolver. A *buff on the attacker*
has no path to either, so Affection's *"Applies Pierce to himself"* and Penetration's
*"Ignore Def effect and halves the effect of Invuln"* are both unauthorable today.

Attacker contributions folded into the attack spec at build time, the same way `component` and
`ignoresMagicResistance` already travel.
**Readers:** `pipeline.mjs#bypassesDefence` (stage 4), the `invuln` branch in `stage16AbsorptionAndClamp`, and
the `defUp` branch at stage 3.

*Halving* Invuln is new in kind: the existing branch is all-or-nothing
(`if (has(d, "invuln") && !s.ctx.attack?.pierce)`), so a fractional form is needed beside it.

### 4.4 A Base Attack modifier, applied in the **projection**

> *"the Unit's Base Attack (both STR and MAG) are reduced by half of their original value."*

Pipeline stage 1 reads `unit.baseAttack[src.component]` raw. But the **snapshot** is the right
site, and `snapshot.mjs:867` already does this exact shape for the Master's granted steps:

```js
const ba = baseAttackAdjustment({ str: steps, mag: steps });
unit.baseAttack = { str: unit.baseAttack.str + ba.str, mag: unit.baseAttack.mag + ba.mag };
```

Three things fall out of choosing the projection over stage 1 (R4):

1. **Damage is covered for free** — stage 1 reads the snapshot, so both components arrive halved.
2. **The victim can see it.** `present.mjs#baseAttackTiles(written, effective)` already renders
   written-vs-effective and sets `shifted: true` when they differ, so a marked Servant shows
   **175 → 87** on their own sheet with no UI work. For a mark that is *permanent and
   unremovable*, being legible is most of the point.
3. One site instead of two.

A stage-1 hook would have been correct damage on a sheet that never admitted anything happened.

### 4.5 A cooldown phase that reaches the **target**

> *"…and increase the DU's NP Cooldown by 1◈ Turns."*

`cooldownChanges` emits `I.cooldown(doc.id, …)` — always the caster. `selectAbilities` already
supports `scope: np` and its own comment anticipates this: *"what a sheet means by 'its NP
Cooldown' when the Unit it is aimed at is somebody else's and may have two."* The selector is
ready; only the subject is hard-wired.
**Reader:** the `cooldown` phase in `engine/skill-use.mjs`.

### 4.6 The `Suppression` strip — automatic, ordered, and result-gating

> *"Successful Normal Attacks remove 1 buff from the DU at the start of the Damage Step and if a
> buff was successfully removed, apply Atk Up for 1◈ Turns to Kiritsugu, +15%; if NP, 5%."*

Three requirements, and the third is what makes it new:

1. **At the start of the Damage Step** — the attacker's `DAMAGE_STEP_WINDOW` already exists and
   is already dispatched (`offerAttackerWindow`), but it *offers abilities*. This must be
   automatic.
2. **A removal** — `rules/removal.mjs#removalPlan` exists and handles resistance.
3. **Conditional on the removal having succeeded** — the follow-on Atk Up fires only if a buff
   actually came off. Ch. 36 §36.2 identifies this as the second occurrence of Van Gogh's
   `captureResult` pattern, which is what confirms it is a general need rather than a one-off.

Ordering is R6 and is the live test's subject.

### 4.7 A free out-of-turn attack, triggered by a **third party** being attacked

> *"Whenever a Unit inflicted with Decoy (Scapegoat) is Attacked, if that AU is within
> Kiritsugu's Range, Kiritsugu can instantly perform a Normal Attack on that AU which cannot be
> Reacted to unless the AU's AGI Rank is higher than Kiritsugu's."*

The widest gap, and the one nothing in the corpus approximates:

- `AutoCounter` fires on its **bearer** being attacked. Here the bearer is the decoy and the
  responder is Kiritsugu — a different unit entirely.
- The `whenAllyAttacked` window (`ALLY_WINDOW`) exists and is the right trigger, and *"can"*
  makes it an **offer**, not automatic — `OfferAbilityUse` is the shape.
- The attack is **free and uncapped** (R1).
- *"Cannot be Reacted to unless the AU's AGI Rank is higher"* is `reactionsRefused`'s comparison
  **inverted**: Presence Concealment refuses reactions unless the defender is *equal or higher*;
  this refuses unless *strictly higher*. Same rank arithmetic, one boundary apart — so it reuses
  `rules/concealment.mjs`'s rank comparison rather than growing a second one that can disagree.
- The nested Spell (§4.1's exemption) resolves **before** the shot.

### 4.8 A debuff that bypasses resistance **and** immunity

> *"this effect ignores Debuff Resist and Debuff Immune effects, and the 'Kiritsugu' debuff is
> Unremovable."*

`bypassesImmunity` and `ignoresResistanceFrom` both exist on the effect-application path
(`engine/effect-applier.mjs`). This is a content assembly rather than an engine addition; it is
listed because the combination is unexercised and the live test must prove it against a target
holding **both** `debuffImmune` and `debuffResUp`.

---

## 5. Testing and verification

### 5.1 Unit tests are the regression net, not the evidence

`test/unit/kiritsugu.test.mjs`, one describe per clause. They are necessary and they are not
proof: the Raikou pass produced a unit test that **passed the whole time** while its clause did
nothing, because it asserted the authored shape rather than the behaviour.

### 5.2 The live proof

Every clause driven **through the interface** on a live board — his sheet's toggles, the action
bar, the reaction prompt, the End Turn button — not through the console. The bar is Raikou's:
*a clause is not done until a player has been seen to reach it.*

Clauses whose live check has a **specific measurement**, because a green test would not catch a
failure:

| Clause | What must be measured |
|---|---|
| §4.6 strip ordering (R6) | the same attack, with and without `Suppression`, against a target holding `Def Up` — the totals must differ by that buff's contribution |
| §4.4 the mark (R4) | a **MAG** attacker's own sheet reading `175 → 87`, *and* its next attack's damage falling accordingly |
| §4.2 the aura (R3) | a nearby **ally's** Luck Check roll going **up** by 4 — a benefit here means the sign is inverted |
| R2 Skill Seal | LUC falling to **E**, the aura stopping, Skills **still** refused, and his own rolls at **+20** — all four at once |
| §4.7 the shot (R1) | fired on an **enemy's** Turn, and his own Attack still available on his next |
| §4.1 the exemption | a Spell used inside the trigger, the Turn's own Thaumaturgy **still** available, and the Spell **on cooldown** |
| §4.5 NP1 | the **defender's** NP cooldown rising by 1◈, his own unchanged |
| §4.8 | the mark landing on a target holding both `debuffImmune` and `debuffResUp` |
| R5 uses | `Suppression` ending after the **5th successful strip**, and a no-buff target spending nothing |

### 5.3 Out of scope

Nothing on the sheet. `Items held:` is empty. Cross-Servant references: none.

---

## 6. Documentation

Ch. 45 gets the pass and its defects. The affected chapter for each addition — Ch. 11 (auras),
Ch. 13 (Base Attack, Pierce), Ch. 14 (checks), Ch. 15 (windows, category limits), Ch. 24 (the new
elements) — and Ch. 36 §36.2 rewritten from a sketch into what was built, the way §36.1 records
Karna's `modes:` decision. Appendix D gets his data sheet.
