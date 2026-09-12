# Raikou — Design

**Source sheet:** `char_orig_sheets/Copia de Raikou.md`
**Data sheet:** `docs/D-servant-data-sheets.md` §D.32
**Structural chapters:** Ch. 13 §13.5 (Mad Enhancement's two magnitudes), Ch. 15 §15.3 (modes),
Ch. 30 (auditing five damage instances), Appendix B §B.3 (the Mad Enhancement ladder)
**Date:** 2026-09-12

**Goal.** Minamoto no Yorimitsu plays exactly as her sheet reads. Nine clauses, two of them
Noble Phantasms that break the shape every other Noble Phantasm in the corpus has: one summons
four differently-armed copies of herself and runs a Master-funded clock, and the other resolves
as **five separate attacks under two different rule sets**, four of which are explicitly exempt
from the mode that is definitionally active while it is usable.

**Method.** Every commit pairs an engine addition with the clause that consumes it. Nothing
lands inert. Raikou is unusual in the opposite direction from Nemo: Nemo arrived with a stage of
the damage pipeline already named after him and unwritten, while Raikou arrives with her hardest
class skill **already built and already validated against her**. `domain/tables.mjs` cites her
`EX` row by name, and Appendix B §B.3 calls the agreement between her sheet and Penthesilea's
*"the strongest validation any table in this appendix has received."*

---

## 1. What the sheet says, and what each clause costs

| # | Clause | Mechanism | Status |
|---|---|---|---|
| 1 | Statline, attributes, Sustainability | content only | every number reproduces (§1.1) |
| 2 | Mad Enhancement EX — seven numbered effects | `{ref: class-mad-enhancement, rank: EX}` | **all seven already built** |
| 2b | …*"constantly Active while her Master is within 2 panels"* | **`ForceMode`** + **`withinOfMaster:` facet** | nothing built |
| 2c | …*"deactivated for 1◈ by spending a Command Spell"* | **`cs-suspend-skill`** + **`suspendSkill`** | nothing built |
| 3 | Riding A+ (3 passives + Active) | `{ref: class-riding, rank: "A+", cooldown: "3◈-⅓◈"}` | adds nothing |
| 4 | Magic Resistance D (both passives + the ladder) | `{ref: class-magic-resistance, rank: D}` | adds nothing |
| 5 | Divinity C — all damage +30 incl. NP | `{ref: divinity, rank: C}` | adds nothing |
| 6 | Genji-clan Martial Arts Discipline EX (passive) | **`EffectMagnitudeScale`** | nothing built |
| 6b | …(active) Crit Up / Crit DmUp (Martial), ME-conditional | **`uses` spent by a predicate** | partly built |
| 7 | Mana Burst (Lightning) A | content only — Karna's twin | built |
| 8 | Thunder God's Embodiment A+ | **element-scoped `FlatDamage`**, `raikou` buff | partly built |
| 9 | Mystery Slayer A | attribute-predicated modifiers + an exclusion | built |
| 10 | **Goō Shōrai・Tenmōkaikai** (NP) | **facing placement**, **passive inheritance**, **summon upkeep reaching the summoner's Master** | nothing built |
| 11 | **Goō Shōriki・Dohatsu Tenshou** (NP) | **`damage.instances[]`**, **`excludeModifierSources`** | nothing built |

Plus one engine correction with corpus-wide reach (§5), settled by an authorial ruling made
during design: **effects land on a Unit that was hit, whether or not the damage number reached
it.**

### 1.1 Every number on the sheet reproduces from the tables

Not one figure is authored as an override. Measured against `domain/tables.mjs`:

| Sheet says | Table | Rank | Value |
|---|---|---|---|
| Base Attack (STR): 150 | `baseAttackStrByStr` | A | 150 ✔ |
| Base Attack (MAG): 200 | `baseAttackMagByMag` | A | 200 ✔ |
| Base Health: 1250 | `baseHealthByEnd` | B | 1250 ✔ |
| Divinity *"increased by 30"* | `divinity` | C | 30 ✔ |
| MR *"reduced by 20%"* | `magicResistancePercent` | D | 20 ✔ |
| MR *"debuffs reduced by 10%"* | `magicResistanceDebuffResist` | D | 10 ✔ |
| ME *"taken −75%; if NP, 30%"* | `madEnhancementDefence` | EX | `[75, 30]` ✔ |
| ME *"dealt +100%"* | `madEnhancementOffence` | EX | 100 ✔ |
| ME *"Master loses 30"* / *"30 or less"* | `madEnhancementDrain` | EX | 30 ✔ |
| Riding *"MOV +5"* | `ridingMov` | A+ | 5 ✔ |
| Riding *"Cooldown 3◈-⅓◈"* | `ridingCooldown` | A+ | `3◈` + a ⅓◈ regen ✔ |

The MAG halving of clause 3 is the shared file's `magnitudeFactor: 0.5` with
`magnitudeRoundTo: 5`: 100 → 50, exact, no rounding needed. `test/unit/raikou.test.mjs` holds
the agreement rather than restating the numbers.

---

## 2. Rulings

Settled by the author before design. Do not re-litigate.

### R1 — *"N times"* is a **use count**, everywhere

> *"applies Crit DmUp (Martial) to Raikou for 1◈ Turns, **3 times**"*
> *"Applies the 'Raikou' buff **for 3 times**"*

One effect instance carrying three charges, not three stacked instances. Where a duration is
also stated, **both** apply and the buff ends on whichever comes first.

This is already the house idiom and no existing content needs correcting: Scáthach's `alpi` is
`stacking: count` / `uses: 3` / `defaultDuration: "1◈"` with `consumesUse: true` on its handler,
and Pale Rider's `dmgCut` is `uses: 3` with `consumesUse` on the negation. Raikou follows both.

**Scope of the ruling.** It governs *effect applications* — "applies X … N times". It does not
govern damage repetition: Dohatsu Tenshou's *"deal 0.5x damage four times"* is four damage
instances, where a charge count has no meaning.

**What counts as a use** must be stated per effect, because the three in play differ:

| Effect | A use is |
|---|---|
| `critDmUpMartial` | a Critical Hit whose damage the buff scaled |
| `raikou` | a Normal Attack of hers that landed |
| `critUpMartial` | *not count-limited* — the sheet gives it a duration and no count |

### R2 — Mystery Slayer's exclusion covers the **whole skill**

> *"Mystery Slayer and Atk Up (MS) have no effect on 'Demi-Servants' and 'Pseudo-Servants'
> except Sitonai."*

All four clauses — both passives and both halves of the Active — do nothing against a Unit with
the `demiServant` or `pseudoServant` attribute. The Demonic clauses are **not** carved out, even
though the note names only `Atk Up (MS)`: the sentence names *the skill*, and a Demi-Servant who
is also Demonic would otherwise be a hole in it.

Sitonai is the single stated exception and is named by **content id**, not by an attribute:
`target:contentId:sitonai`. She is not in either roster, so the predicate is authored against a
Servant who does not exist yet — which the `contentId` facet already supports, and which is the
same thing `attribute`'s deliberately-open vocabulary does for `outsider` and `undead`.

### R3 — The `raikou` buff's ⅓◈ comes off **both** Noble Phantasms

> *"…and reduce her NP Cooldown by ⅓◈ Turns."*

`scope: np`, which reaches every Noble Phantasm on cooldown — Scáthach's `alpi` reads the same
way for the same reason, and its file records it: *"the sheet names no ability and Scáthach has
two Noble Phantasms."* Raikou has two. No prompt, no clock left behind.

### R4 — Tenmōkaikai's clone panels are read off her **facing**

> *"…which appear on the panels in front of her, behind her, and her left and right."*

Front / back / left / right are resolved against `token.facing`, which this system already
tracks and already uses for attack cones (`domain/geometry.mjs#coneOf`). A panel that is
off-board, occupied, or on another Scene Level pushes that clone **outward along the same axis**
to the nearest free panel; if the axis offers none, that clone does not appear and the chat card
says which one and why. A clone that quietly failed to exist is worse than one that appeared
further out — the ruling `engine/summoning.mjs#placeSummons` already made for Medea's Warriors.

### R5 — Tenmōkaikai's rider applies to **every attack she makes**

> *"During the NP duration, Raikou's Attacks deal 50% extra damage and inflict Shock for 2◈
> Turns, Lightning damage (half)."*

Normal Attacks, Attack Skills and Dohatsu Tenshou alike. The sheet narrows to *"Normal Attacks"*
in the very next clause, on the copies, and in three other places on this sheet — so *"Raikou's
Attacks"* unqualified is unqualified.

### R6 — Dohatsu Tenshou's four sub-attacks **are** Normal Attacks

> *"Each of these four Attacks can be separately Blocked or Evaded; treat these Attacks as
> Normal Attacks. These 4 Attacks are not affected by Mad Enhancement."*

Taken at its word. Each emits `attack:kind:normal`, so every rider predicated on a Normal Attack
fires on each of the four: the `raikou` buff's +40 Lightning and 40% Shock and ⅓◈, Mana Burst's
passives, Tenmōkaikai's own Shock rider. **Only Mad Enhancement is exempt, because only Mad
Enhancement is named as exempt** — which is why the mechanism is `excludeModifierSources` and
not the existing all-or-nothing `bypassModifiers` (§4.6).

### R7 — Effects land on a Unit that was **hit**, not one that was **hurt**

> *"Then, inflict Crit Dwn on all affected Units for 1◈ Turns."*

Affected = the attack connected. A Unit that Evaded took nothing and is not affected; a Unit
that Blocked, or whose Def Up reduced the total to zero, **is**. The author states this as a
general rule for the system, not as a Raikou clause: *"that's how it should be for every Attack
that also applies effects."* §5 is the correction that follows from it.

### R8 — Her Normal Attack uses **BA(STR) = 150**

The sheet gives both Base Attacks and never says which the Normal Attack uses; every other
Servant in the corpus declares it. STR, on Karna's precedent: his Mana Burst (Flames) carries
the identical sentence — *"the Base Attack used is his BA(STR) and BA(MAG) combined"* — and it
reads as a departure from a STR default, which is exactly how he is authored. Mad Enhancement's
MAG halving then covers precisely the cases that exist on her sheet: Mana Burst's combined
attack, and Dohatsu Tenshou's MAG portion.

A consequence worth stating, because it is the reason the question mattered: had it been MAG,
`domain/attributes.mjs#isMagus` would have made her a **Magus** (*"all Units whose Normal
Attacks use Base Attack (MAG)"*), and every ordinary swing would have taken ME's halved +50%
instead of +100%. She is not a Magus.

### R9 — Her Class container is **Berserker**

The sheet states no Class and lists three class skills: Mad Enhancement, Riding, Magic
Resistance. Mad Enhancement is Berserker's, and it is the one that decides her — §D.32 has
recorded Berserker since the data sheets were transcribed. The container is not cosmetic: it
sets base Detect (`rules/identity.mjs`), her ZON base, and which column of `npCostByRank` her
Master pays.

---

## 3. The content

### 3.1 `packs/_source/servants/raikou.yml`

```yaml
trueName: "Minamoto no Yorimitsu"     # "Minamoto no Yorimitsu, Ushi Gozen" — Ushi Gozen is the
                                      # aspect, carried in notes, not as a second name
servantClasses: [berserker]           # R9
classContainer: berserker
alignment: { order: chaotic, morality: good }
region: [japan]
attributes: [female, servant, sky, humanoid]   # `spirit` and `hominidae` are CLOSED by
                                               # domain/attributes.mjs, never authored by hand
parameters: { str: A, end: B, agi: D, mag: A, luc: C }
baseHealth: 1250
mov: 4
range: { panels: 4, targets: 1 }
baseAttack: { str: 150, mag: 200 }
normalAttack: { mode: fixed, component: str }  # R8
sustainability: "2◈"
```

No `rules:` block on the Servant. Unlike Nemo, whose Normal Attack carries an unnamed 10% Slow
rider that belongs to no skill, every rider Raikou has belongs to a named ability.

### 3.2 Four refs, no new files

```yaml
- { ref: class-mad-enhancement, rank: EX }
- { ref: class-riding, rank: "A+", cooldown: "3◈-⅓◈" }
- { ref: class-magic-resistance, rank: D }
- { ref: divinity, rank: C }
```

**Riding adds nothing**, exactly as it added nothing for Nemo. Her sheet spends five lines
restating Double Move, Riding Attack, Passenger Seat and the not-a-buff MOV Up — including the
clause about a Riding Attack after a Move getting MOV minus the panels already spent — and
`class-riding` plus `engine/riding.mjs` already perform all of it.

**Magic Resistance adds nothing.** Her sheet's three paragraphs — the rank negation, the 20%,
the 10% debuff resistance, the Instakill/Death ladder with its STR and `ignoresMagicResistance`
exemptions, and *"Erase is completely unaffected"* — are the shared file clause for clause.

**Mad Enhancement adds two things and only two**: §4.1 and §4.2, both authored on *her* entry
rather than on the shared class skill, because no other bearer has them.

### 3.3 Six ability files

| File | Notes |
|---|---|
| `raikou-genji-clan-martial-arts-discipline.yml` | passive §4.3 + ME-conditional active |
| `raikou-mana-burst-lightning.yml` | Karna's twin; `modeInactive` gate |
| `raikou-thunder-gods-embodiment.yml` | `modeActive` gate; the `raikou` buff |
| `raikou-mystery-slayer.yml` | four modifiers, one exclusion (R2) |
| `raikou-tenmokaikai.yml` | the clone NP (§6) |
| `raikou-dohatsu-tenshou.yml` | the compound NP (§7) |

Six, because Mad Enhancement's two additions (§4.1, §4.2) ride on the servant's own `abilities`
entry as overrides rather than on a seventh file, and Riding, Magic Resistance and Divinity are
refs to shared files that gain nothing.

### 3.4 Four summon files

`raikou-watanabe`, `raikou-sakata`, `raikou-urabe`, `raikou-usui`. Each differs in exactly three
fields — Range, element, rider effect — and shares everything else:

| Copy | Range | Element | Rider (50%, 1◈) |
|---|---|---|---|
| Watanabe | 1 | fire | `burn` |
| Sakata | 1 | lightning | `shock` |
| Urabe | 3 | wind | `bleed` |
| Usui | 2 | ice | `disable` |

All four: `type: summon`, `countsTowardBudget: false`, `actsOncePerTurn: true`,
`inherit: {agility, luck, mov from summoner; maxHealth from summoner ×0.5; passives from
summoner}`, `normalAttack: {mode: fixed, component: str, elementFraction: 0.5}`, a
`TargetabilityModifier` radius 1 with `recipientRoles: [summoner, summonerMaster]`, and
`GrantedAbility: [noNormalAttackOnly]` — the grant that says *"can only perform Normal
Attacks"*.

### 3.5 Five effect files, one command spell

| Id | Shape |
|---|---|
| `critUpMartial` | `magnitudeStacks`, `CheckModifier` on crit. Duration only — no count (R1) |
| `critDmUpMartial` | `stacking: count`, `uses: 3`, `defaultDuration: "1◈"`, `CritModifier` + a `consumesUse` handler on a crit |
| `atkUpMs` | `DamageModifier` predicated on `[Earth]`/`[Sky]`, carrying R2's exclusion |
| `atkUpDemonic` | `DamageModifier` predicated on `Demonic`, carrying R2's exclusion |
| `raikou` | `stacking: count`, `uses: 3`; element-scoped `FlatDamage` + a `damageDealt` handler |
| `cs-suspend-skill` | the Command Spell of §4.2 |

`shock`, `dodge`, `burn`, `bleed`, `disable`, `critDwn`, `atkUp` all already exist.

---

## 4. The engine additions

Each is stated with the clause that consumes it, the file it lands in, and the reader that makes
it non-inert.

### 4.1 `ForceMode` — a mode held on by position

> *"(Passive) When Raikou's Master is within a 2 panel area of herself, her Mad Enhancement is
> constantly Active and cannot be deactivated."*

Penthesilea's *Hatred of Achilles* is the same shape and is built as a `Compulsion`, which is
*positional* for exactly this reason: it must lift the instant the other Unit leaves, with no
cleanup step to forget. But a compulsion is evaluated **per other unit on the board** and its
relation vocabulary is `ally` / `enemy` — it cannot say *her own Master* as against *any allied
Master*, and Raikou's clause is not a targeting constraint at all (`forcesTarget` would be
false, leaving the element doing one of its two jobs).

So: a new element that states the policy as a predicate.

```yaml
- key: ForceMode
  mode: madEnhancement
  predicate: ["self:withinOfMaster:2"]
```

- **`rules/elements.mjs`** collects it into `out.forcedModeRules` (new bucket, mirrored in
  `rules/authoring/elements.mjs`; `test/unit/authoring-elements.test.mjs` holds both directions).
- **`rules/modes.mjs`** reads it in *both* of its existing answers: `forcedModes` returns the
  ability when the predicate holds and it is off, and `canToggleMode` refuses a deactivation with
  `reason: "forced"` while it holds. Both already do precisely this for compulsions; this is a
  second source, not a second mechanism.
- **`engine/modes.mjs#reconcileForcedModes`** is already the writer and already rides the aura
  index's invalidation, so it re-runs on every move. No new watcher.

**The new roll option.** `self:withinOfMaster:<n>` — a ladder, capped at 6, exactly like the
existing `withinOfOwnerMaster:` (which measures distance to *the owner of the field you are
standing in*'s Master, and cannot answer this). New `facet()` entry in `rules/facets.mjs`,
emitted in `rules/options.mjs#add` from a new `unit.masterPanel` annotation. `rules/zon.mjs`
already resolves the pair with `masterOf(servant, board)` and already runs a board pass; the
annotation is stamped there rather than reaching for the board a second time.

**What is deliberately absent.** Nothing switches the mode *off* when the predicate lapses —
the same ruling `engine/modes.mjs` already records for Penthesilea: *"A Berserker who has been
driven mad does not simply calm down."* The sheet frees the player's hand; it does not move it.

### 4.2 `cs-suspend-skill` — the Command Spell override

> *"In this situation, Mad Enhancement can be deactivated for 1◈ Turns by spending a Command
> Spell (it will reactivate if the aforementioned conditions are still met after those 1◈
> Turns)."*

Penthesilea's sheet carries the identical clause and it is currently prose with no mechanism, so
this is built as a **shared catalogue entry**, not as a Raikou special case.

```yaml
id: cs-suspend-skill
cost: 1
effect:
  - kind: suspendSkill
    target: contractedServant
    scope: oneSkill
    duration: "1◈"
```

- A new `suspendSkill` case in `engine/command-spells.mjs`, beside the nine that exist. It
  writes `system.suspendedUntil` on the chosen ability and sets `active: false`.
- `rules/modes.mjs#canToggleMode` refuses re-activation while suspended, **and the suspension
  outranks `ForceMode`** — that is the whole point of the clause, and the ordering is the one
  thing about it that can be got wrong silently.
- When the tick passes, `forcedModes` sees the predicate still holding and
  `reconcileForcedModes` switches it back on, which is *"it will reactivate if the aforementioned
  conditions are still met"* with no extra machinery. The ordinary scheduler expiry is the timer.
- It does **not** defeat the 2◈ `toggleLock`; the sheet says a Command Spell, and the lockout is
  a separate refusal that a Command Spell is not stated to buy out.

### 4.3 `EffectMagnitudeScale` — a modifier whose subject is another modifier's magnitude

> *"(Passive) The magnitude of all Atk Dwn effects on Raikou is halved."*

Nothing in the system scales an *effect's* magnitude. `ApplicationChance` changes how likely an
effect is to land; `DurationExtension` changes how long it lasts; neither touches how big it is.

```yaml
- key: EffectMagnitudeScale
  direction: incoming
  effects: [atkDwn]
  factor: 0.5
```

- Collected into `out.magnitudeScales`.
- Read by **`engine/effect-applier.mjs`**, at application time, where the magnitude is decided
  and stamped. Application time rather than collection time because the passive is permanent and
  unremovable in practice, so the two are equivalent — and stamping means the audit card shows
  the number the Unit actually carries rather than one the reader has to halve in their head.
- **By effect id, not by family.** `atkDwn` and a negative `atkUp` are *different families* on
  purpose (`effects/atk-dwn.yml` says so in as many words: buff removal strips the latter and
  cannot touch this), and the sheet names `Atk Dwn`. A `family:` spelling is available on the
  element for a later clause that needs it; Raikou uses the id list.

### 4.4 A use spent by a predicate

R1's `critDmUpMartial` is *"3 times, or 1◈ Turns, whichever ends first"*, where a use is a
critical hit. `uses` + `defaultDuration` already compose (`alpi`), and `consumesUse` already
exists on `OnEvent` (`np-dm-up-gao`) and on `DamageNegation` (`dmg-cut`). What is missing is
spending a use from a `CritModifier` — the modifier fires inside the damage pipeline, not on an
event rung.

The cheapest honest answer, and the one that needs no pipeline change: a second element on the
same effect.

```yaml
rules:
  - { key: CritModifier, aspect: damage, modifierKey: critDmUp, value: "@magnitude" }
  - key: OnEvent
    event: damageDealt
    automatic: true
    predicate: ["attack:crit"]
    consumesUse: true
    then: []
```

`attack:crit` is already emitted, and *only* at `damageDealt` — `engine/attack.mjs` notes that a
clause asking whether the attack crit is by definition asking about a resolved one. So the
charge is spent by the same event that proves the crit happened. `test/unit/raikou.test.mjs`
holds that the two elements name the same effect, because a `CritModifier` without its
`consumesUse` twin is an infinite buff.

### 4.5 Element-scoped `FlatDamage`

> *"Normal Attacks deal 40 bonus Lightning damage…"*

`FlatDamage` lands at stage 7 and carries `component` but not `element`, so +40 of *Lightning*
cannot be said. The pipeline already knows what to do with an element — stage 4b scopes
percentages to the element's own share and `elementFractionOf` reads `ctx.attack.elementFraction`
— so this is one field on the executor and one branch at stage 7, not a new stage.

```yaml
- key: FlatDamage
  value: 40
  element: lightning
  predicate: ["attack:kind:normal"]
```

The consequence that makes it worth doing properly rather than as a bare +40: a defender with
Lightning resistance resists it, and **Raikou herself is immune to Shock and takes half from
Lightning** — so a Raikou copy's Lightning Normal Attack against a mirror-matched Raikou has to
land on the right side of that arithmetic.

### 4.6 `excludeModifierSources` — narrower than `bypassModifiers`

> *"These 4 Attacks are not affected by Mad Enhancement."*

`bypassModifiers` is all-or-nothing per side (`true`), or per side as an object (Nemo's
`{attacker: true}`). Neither says *"this one source"*: Raikou's Divinity, her Mystery Slayer, her
Atk Up from Thunder God's Embodiment and the defender's every reduction all still apply to these
four attacks. Only Mad Enhancement does not.

```yaml
damage:
  instances: [...]
  excludeModifierSources: [class-mad-enhancement]
```

Every modifier already carries `source`. The pipeline drops matching contributions **where they
are collected, noting the exclusion in the breakdown** rather than skipping a stage — the rule
stages 4, 7 and 12 already follow for `ignoresAttackerIncreases`, `Ignore Def` and a Heel
Attack, and for the reason each of them states: *a modifier that vanishes from the breakdown is
indistinguishable from one that was never collected.* Ch. 30's audit format is what makes this
clause checkable at all, and §8.2's live pass reads it off the card.

### 4.7 `damage.instances[]` — one declaration, five attacks, two rule sets

> *"First, deal 0.5x damage four times using Base Attack (STR), each instance of damage
> respectively being Lightning damage (half), Fire damage (half), Ice damage (half) and Wind
> damage (half). Each of these four Attacks can be separately Blocked or Evaded… Then, deals
> 3.5x damage plus 200 using Base Attack (MAG)…"*

`damage.repeat: N` already gives each hit its own Combat Process and therefore its own reaction
ladder (Mannanán's Tóole Fragarach, EMIYA's Overedge). What it cannot do is vary the hits.

```yaml
damage:
  instances:
    - { multiplier: 0.5, component: str, element: lightning, elementFraction: 0.5, kind: normal }
    - { multiplier: 0.5, component: str, element: fire,      elementFraction: 0.5, kind: normal }
    - { multiplier: 0.5, component: str, element: ice,       elementFraction: 0.5, kind: normal }
    - { multiplier: 0.5, component: str, element: wind,      elementFraction: 0.5, kind: normal }
    - { multiplier: 3.5, flatBonus: 200, component: mag, element: lightning, kind: np }
  excludeModifierSources: [class-mad-enhancement]   # applies to the four only — see below
```

`engine/attack.mjs` expands `instances` the way it expands `repeat`, one Combat Process per
instance per target, in declared order. `repeat` becomes the degenerate case of `instances` (N
copies of one spec) rather than a second code path — held by a test that Overedge and Tóole
Fragarach produce byte-identical breakdowns before and after.

**`kind` per instance** is what R6 buys: the first four emit `attack:kind:normal` and the fifth
`attack:kind:np`. That one field decides whether the `raikou` buff pays out four times or zero,
whether Magic Resistance reads the MAG portion as a Noble Phantasm, and which half of every
`[normal, vsNP]` table pair the defender gets.

**The exclusion is scoped to the four, not to the five.** `excludeModifierSources` at the damage
level with a per-instance `false` on the fifth is one spelling; an `excludeModifierSources` on
each of the four is another. The plan takes the second: it is longer and it cannot be misread,
and *"These 4 Attacks"* is a sentence about four things.

**Note the Lightning asymmetry the sheet draws and the file must not smooth over.** The four are
each *"(half)"*; the fifth is *"Lightning damage"* with no parenthesis — full element share. A
defender's Lightning resistance therefore bites the whole of the Noble Phantasm portion and half
of the first instance.

### 4.8 Summon inheritance: passives, and a halved maximum

> *"All of these clones have the same Max Agility, Max Luck and MOV as Raikou, but Max Health is
> halved. The clones are unable to use Mad Enhancement, Riding and the Active effects of
> Raikou's Skills (**Passive effects are still present**)…"*

`inherit:` already carries `{from: summoner}` and `{from: summoner, delta: N}` (the Kagome
spirits, the Sphinxes). Two additions:

- `maxHealth: { from: summoner, factor: 0.5 }` — a factor beside the existing delta. 1250 → 625.
  **Max**, so a wounded Raikou still spawns copies at 625.
- `passives: { from: summoner }` — the interesting one. At summon time the clone's
  `passiveRules` are the union of its own and every `passiveRules` of its summoner's abilities.
  Divinity's +30 reaches them, Mystery Slayer's two passives reach them, Magic Resistance reaches
  them, Mana Burst's Shock immunity and Lightning halving reach them. Mad Enhancement's
  `activeRules` do not, because they are not passives; Riding's `GrantedAbility` does not,
  because the sheet names Riding as withheld and the union is filtered by
  `excludeAbilities: [class-mad-enhancement, class-riding]`.

`GrantedAbility: [normalAttacksOnly]` is the grant for *"can only perform Normal Attacks"* —
`rules/granted.mjs`'s existing `noNormalAttack` inverted. It withholds the Skill and NP buttons
rather than refusing them on click, the way `noNormalAttack` withholds the Attack button.

### 4.9 A summon's turn charging its summoner's Master

> *"At the end of Raikou's Turn and at the end of any Turn Raikou **or any of her copies** Acts,
> Raikou's Master loses 25 Health."*

Mad Enhancement's clause 1 is the same shape and already works: `OnEvent actedTurnEnd` →
`StatDelta subject: master` with a `floorTable`, then a `SetMode` that tests what the drain left.
`subject: master` exists precisely because *"the effect is on the Servant and the cost lands on
somebody else."*

What does not exist is the **second hop**: a copy's `actedTurnEnd` must charge *its summoner's*
Master. `subject: summonerMaster` — a third value beside `self` and `master` in
`engine/scheduler.mjs#targetsOf`, resolved through `system.summonerId` and then `masterOf`.

**Deduplication matters and is already solved.** *"At the end of Raikou's Turn **and** at the end
of any Turn Raikou or any copy Acts"* is two boundaries on one clause, and §E.2's existing
deduplication is what stops a Raikou who acted on her own Turn paying 50. Two copies that both
acted on the same Turn is a different question — the sheet's *"any Turn Raikou or any of her
copies Acts"* is one charge per Turn, not per actor, so the handler is keyed on the **Turn**, not
on the unit. Stated here because the generous reading (25 per copy per turn = 125 a Round) makes
the Noble Phantasm unusable and is easy to write by accident.

---

## 5. The correction R7 forces

`engine/attack.mjs` gates three rungs of the damage step on `result.total > 0`:

```js
if (!skipped && result.total > 0) await fireDamageStepEnd(state);
if (!skipped && result.total > 0) await fireDamageDealt(state, result);
if (!skipped && result.total > 0) await fireDamageTaken(state, result);
```

Under R7 the second and third are wrong: a Unit that was hit for zero was still hit, and every
on-hit rider in Appendix A — `Bleed Atk`, `Queen's Poison`, Serenity's daggers, Nemo's Slow,
Karna's Burn, and the `raikou` buff — should pay out. The gate becomes `!skipped`, which is
already the test the *ability-declared* riders use one line above (`applyAbilityEffects` runs
whenever the attack was neither suppressed nor veiled). The two halves of "riders" currently
disagree with each other; this makes them agree, in the direction the author ruled.

**`damageStepEnd` is left alone.** Scáthach's Alpi is *"at the end of the Damage Step when a
successful Attack is performed"*, which is a clause about the attack succeeding rather than about
an effect being delivered, and R7 is explicitly about *"every Attack that also applies effects"*.
Changing it would be extending the ruling rather than applying it. Recorded so the inconsistency
is a decision and not an oversight.

This is a corpus-wide behaviour change and gets **its own commit, ahead of Raikou**, with a
regression test that fires a zero-total hit and asserts the rider landed.

---

## 6. Goō Shōrai・Tenmōkaikai

A **mode** Noble Phantasm, like Zero Sail: it is activated, things are true *"during the NP
duration"*, and it is deactivated by four different paths. `isMode: true`, `slug: tenmokaikai`,
`cooldown: { max: "7◈+⅓◈", countFrom: deactivation }`.

| Clause | Mechanism |
|---|---|
| *"only when Mad Enhancement is deactivated"* | `requirements: [{kind: modeInactive, mode: madEnhancement}]` |
| *"ME can be reactivated after this NP is activated"* | nothing — the requirement is checked at use, not maintained |
| four clones, four panels | `phases: [{kind: summon}]` with the facing placement of R4 |
| clone statlines | §4.8 |
| *"Raikou's Attacks +50%, Shock 2◈, Lightning (half)"* | `activeRules` on the NP: a `DamageModifier` and an `OnEvent damageDealt` (R5 — no `attack:kind` predicate) |
| *"Raikou's Crit +30%, copies' Crit +15%"* | `CheckModifier` on the NP's `activeRules`; the copies' +15% on the clone files, because it is theirs |
| Master upkeep 25 | §4.9 |
| *"forcefully deactivated if Master has 25 or less and would lose Health"* | `SetMode` with `whenValue`, the shape ME clause 1 already uses |
| *"Master does not lose Health on the same Turn this NP is deactivated"* | the `SetMode` is ordered **before** the `StatDelta` on the deactivating tick — the mirror of ME, where it is ordered after, and the difference is the sheet's |
| *"forcefully deactivated at the end of a Turn Raikou is defeated"* | `OnEvent unitDefeated` → `SetMode active: false`, at turn end not immediately |
| copies exempt from the budget, once per Turn each | `countsTowardBudget: false`, `actsOncePerTurn: true` — summon fields, not Raikou rules |
| *"Enemy Units cannot Attack Raikou or her Master if any copies are next to them"* | `TargetabilityModifier` radius 1, `recipientRoles: [summoner, summonerMaster]` — the Sphinx's element verbatim |
| *"can deactivate during her Turn and at the start or end of any Turn or Round"* | `deactivation: { byOwner: true, window: any }` |
| *"Cooldown 7◈+⅓◈ after deactivated / after the last copy is defeated"* | `countFrom: deactivation`, plus an `OnEvent unitDefeated` on each clone that deactivates the mode when it is the last one standing |

The last row is the subtle one: **the last copy dying ends the Noble Phantasm**, which is not
the same as the Noble Phantasm merely having no copies left. It starts the 7◈+⅓◈, and it must
fire from the clone, not from Raikou.

---

## 7. Goō Shōriki・Dohatsu Tenshou

Not a mode. `requirements: [{kind: modeActive, mode: madEnhancement}]`,
`targeting: {anchor: {kind: withinRange, range: 3}, shape: {kind: square, size: 3}}`,
`cooldown: "6◈+⅔◈"`.

Damage is §4.7's five instances. Then:

- `phases: [{kind: damage}, {kind: applyEffects, ...}]` — Shock 2◈ from the NP portion, and
  Crit Dwn 20% / 1◈ on **every Unit the area caught that was hit** (R7).
- *"If used while Goō Shōrai・Tenmōkaikai is Active, it is immediately ended at the end of that
  Combat Phase, and its Cooldown is increased by 2◈ Turns (in addition to its original
  Cooldown)."*

  Two clauses and both are easy to attach to the wrong ability. *"It"* is Tenmōkaikai (ended);
  *"its Cooldown"* is **Dohatsu Tenshou's own** — 6◈+⅔◈ becomes 8◈+⅔◈. Read the other way the
  clause would be a free extension of the clone NP's cooldown, which is a penalty on a thing that
  has already ended. Authored as a `cooldown.conditionalBonus` on this file predicated on
  `self:skillActive:tenmokaikai`, plus a `phase: {kind: cooldown}` that ends the other at
  `combatPhaseEnd` rather than immediately.

---

## 8. Testing and verification

### 8.1 Unit tests are the regression net, not the evidence

`test/unit/raikou.test.mjs`, one `describe` per sheet clause, layer 1 and 2 only — the table
agreements of §1.1, the predicate shapes, the placement arithmetic, the instance expansion, the
magnitude scaling, `forcedModes` and `canToggleMode` under `ForceMode`, and the
`CritModifier`/`consumesUse` pairing.

They cannot see: a token appearing on the board, a Master's Health moving because a summon ended
its turn, a targeting cursor refusing a panel, a Command Spell dialog, or a chat card's damage
breakdown. Those are §8.2.

### 8.2 The live proof in `fgt2026`

Over claude-in-chrome, against a real board, with the world brought up the way this project's
tooling requires: a Foundry tab open over CDP **first**, then `node tools/fgt-world.mjs launch`,
then join. Pack rebuilds go through `node tools/fgt-rebuild.mjs` with the world down.

Every clause below is read off the screen or off a chat card, not inferred:

**Mad Enhancement** — Master walked to 2 panels: mode switches on unbidden, the toggle refuses
with *"forced"*. Master walked to 3: the refusal lifts, the mode stays on. Command Spell spent:
mode goes off and the button refuses for 1◈; on expiry with the Master still close, it comes back
on by itself. Damage taken −75% and −30% vs an NP on the card. Damage dealt +100%, and +50% on
the Mana Burst attack. MOV 4→6, Range 4→5, Master's ZON +2. Evade forced to the unfavourable
table. Master −30 at the end of every acted Turn, floored at 30, then forcibly deactivated.
Sustainability −2◈ on the Master's death.

**Riding** — Active for MOV 9; Double Move split around an attack; a Riding Attack down a line
hitting three Units; Passenger Seat moving the Master with her and counting as one Unit; the
MOV Up surviving a buff-removal.

**Magic Resistance** — a D-rank MAG attack negated outright; an A-rank one reduced 20%; a Death
debuff from a MAG source resisted at +10% and the same debuff from a STR source not; Erase
unaffected.

**Genji-clan** — an Atk Dwn 40 landing as 20. The Active with ME on (+30/+30) and off (+60/+60),
and the Crit DmUp gone after the third crit or 1◈, whichever came first.

**Mana Burst (Lightning)** — refused while ME is on; BA 350 on the card; Shock 2◈ applied; Magic
Resistance skipped at stage 11; half the total carrying Lightning; Dodge on herself after.
Passives: a Shock application refused, a Lightning NP halved.

**Thunder God's Embodiment** — refused while ME is off. Atk Up 40/30. Dodge. Three Normal
Attacks each showing +40 Lightning at stage 7, each rolling the 40% Shock, each taking ⅓◈ off
**both** NP cooldowns; the buff gone after the third.

**Mystery Slayer** — +20% against a [Sky] Unit, +20% against a Demonic one, +30%/+30% from the
Actives, and **nothing at all** against a Demi-Servant (R2).

**Tenmōkaikai** — refused while ME is on. Four clones on the four facing-relative panels; one
spawn with a blocked panel to prove the outward displacement. Each clone's Range, element and
rider verified by attacking with it. A clone at 625 Health. A clone showing Divinity's +30 on its
card (passive inheritance) and no Skill buttons. Raikou's attacks +50% with Shock. Crit +30% /
+15%. Master −25 on her Turn end and −25 on a clone's Turn end, once per Turn and not once per
clone. An enemy adjacent to a clone refused a target lock on Raikou and on her Master. Forced
deactivation at Master ≤25 with no charge that Turn. Deactivation at the start of a Round.
Cooldown starting at deactivation, and starting again when the last clone is killed.

**Dohatsu Tenshou** — refused while ME is off. Five chat cards under one parent id (Ch. 30). The
four at 0.5× BA(STR) in four elements, each separately Evaded and Blocked in one resolution to
prove independence, each showing Mad Enhancement **excluded by name** in the breakdown while
Divinity is still there. The fifth at 3.5× BA(MAG) + 200 with full Lightning and Mad
Enhancement's halved MAG figure present. Shock 2◈ and Crit Dwn 20% on everyone the 3×3 caught,
including one Unit whose total was reduced to zero (R7). Used during Tenmōkaikai: the clone NP
ends at the end of the Combat Phase and this cooldown reads 8◈+⅔◈.

**R7's correction** — a hit reduced to zero by Def Up still applying its rider, on a Servant that
is not Raikou.

### 8.3 The bar

A clause is done when it has been *seen* doing the thing the sheet says, in a live world. Green
unit tests are not evidence — this project has shipped six Servants whose unit tests passed and
whose clauses were inert, and Ch. 45 names *"a rule that is right and inert"* as its dominant
defect.

---

## 9. Out of scope

- **Penthesilea's Command Spell clause.** §4.2 makes it authorable and her file is not touched.
- **`damageStepEnd`'s zero-damage gate** (§5), which is a different sentence.
- **Sitonai.** R2 names her; she is not authored.
- **Ushi Gozen** as a separate form. The sheet gives one statline.
- **`repeat` → `instances` migration for other Servants.** `repeat` stays as the degenerate
  spelling; Overedge and Tóole Fragarach are held byte-identical, not rewritten.

---

## 10. Documentation

Every commit updates the affected chapter in `docs/00-44` **and** `docs/45-implementation-status.md`.

| Chapter | What changes |
|---|---|
| `13-damage-pipeline.md` | §13.8 gains `excludeModifierSources`; stage 7 gains an element |
| `15-abilities.md` | §15.3 gains `ForceMode` as a third mode policy |
| `17-command-spells.md` | §17.2 gains `cs-suspend-skill` |
| `24-rules-engine.md` | `ForceMode`, `EffectMagnitudeScale` in their groups |
| `12-combat-process.md` | `instances` — one declaration, N Processes |
| `30-chat-and-audit.md` | the five-card Dohatsu Tenshou entry, which §D.32 says this format was designed for |
| `A-effect-catalogue.md` | `critUpMartial`, `critDmUpMartial`, `atkUpMs`, `atkUpDemonic`; the `Raikou` row already exists |
| `D-servant-data-sheets.md` | §D.32 from "Scripts: 0" to authored |
| `E-event-reference.md` | `subject: summonerMaster`; the zero-damage rider correction |
| `45-implementation-status.md` | the commit log and what each defect cost |
