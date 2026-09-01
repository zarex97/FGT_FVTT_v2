# 36 — Case Study: The Remaining Seven

> **Implemented (§36.4).** Scáthach's Wisdom setup flow is built, and it is built as **two**
> dialogs because this section gives its two decisions to two different people: the GM curates
> (`module/apps/copy-dialog.mjs`), then Scáthach's player picks
> (`module/apps/choice-dialog.mjs`, reached over `FGTSocket.ask`). Collapsing them into one would
> have been simpler and wrong — the curation is a GM judgement about what is thematic and the pick
> is the player's.
>
> The rank band is a **toggle**, as this section says ("a soft filter with a toggle"), and the
> dialog says so when the band hides everything rather than showing an empty list with no reason.
> `canCopy` is re-checked when the player answers, because the offer and the pick are separated by
> a human. The ability reaches its dialog through `opensDialog: copy` on its own document rather
> than by a name match, so the next such ability needs content and not code.
>
> **It offered nothing, in any world, until Scáthach was authored.** The two dialogs and the
> socket primitive were built and correct; `copyCandidates` reads the **board snapshot**, whose
> ability entries carried no `phases`, so `canCopy`'s *"must have an Active effect"* test refused
> every candidate in the game as `notActive`. The list came up empty and the dialog said so
> honestly, which is exactly why it read as "no eligible Servants on the field" rather than as a
> bug. Ch. 15 §15.7 records the two further defects behind it.
>
> Asking a **named player** a question needed a socket primitive that did not exist:
> `FGTSocket.ask`. `request` routes everything to the active GM, which is right for anything that
> writes and exactly wrong for a prompt. Its absence had also left `io.prompt` emitting a
> `"prompt"` operation that `OPERATIONS` never contained, so every prevention Luck Check threw
> `UNKNOWN_OP` where a player should have been asked a question.
>
> Still to come from this section: `Primordial Rune`'s `kind: roll` phase with its table and
> `duplicateBehaviour`, and `Gate of Skye`'s `alsoTriggers`.

Karna, Kiritsugu, Francis Drake, Scáthach, Penthesilea, Nemo, and Kingprotea. Each is covered
at the level of *what it demands of the architecture*, rather than repeating conversions whose
patterns are now established.

---

## 36.1 Karna — layered Noble Phantasms and permanent activation

> **Implemented, and `modes:` was not built.** All thirteen abilities resolve end to end in a
> live world, verified individually. Four were authored before this pass and the four included
> neither of the two that define him.
>
> **DECISION — Vasavi Shakti is two documents, not a `modes:` block.** The `modes:` schema this
> section sketches below was never built, and the reason is concrete rather than aesthetic: an
> `isNP: true` document **cannot be free**. `npCost` prices every Noble Phantasm off
> `npCostByRank`, and `canUseAbility` *refuses the use outright* when the Master cannot pay — so
> an EX-rank activation would have been gated behind 75 Master Health that the sheet explicitly
> says it does not cost. So `karna-vasavi-shakti-activation` is a free, non-NP Skill with
> `maxUses: 1`, and `karna-vasavi-shakti` is the Noble Phantasm, gated on the status the first
> applies.
>
> The branch machinery that arrived later for Semiramis's *Summoning: Bašmu* —
> `targeting.branches`, `damage.branches`, `cooldown.branches`, per-phase `predicate:` — covers
> every case `modes:` was invented for, and this one is not a branch at all: it is a separate,
> free, one-way action. Two buttons is also the honest presentation of a decision that
> permanently deletes his best defensive clause. Nemo's Zero Sail and the HGoB build-vs-use, the
> two other cases this section cites for `modes:`, are both branch-shaped and already built that
> way.
>
> **`vasaviActivated`'s clause 1 is expressed from the other side.** *"Kavacha and Kundala's
> effect is permanently lost"* is `negatedBy: [vasaviActivated]` on the Noble Phantasm itself, so
> the −90% **stops contributing** rather than being cancelled out by a +90% that would show in
> every damage breakdown and fight with anything else touching the same bucket. That is what
> forced `negatedBy` to be honoured for passive contributions at all (§15.4).
>
> **Clause 3's Divinity ladder is six predicated elements, not a rank table.** *"For every Rank
> in Divinity the DU has, damage dealt is increased by 30 (e.g. Divinity Rank C, +90)"* is keyed
> on the **defender's** Divinity, and `table:` on a rule element resolves against the **owning
> ability's** rank — an effect-borne rule has no rank at all, so a table would look up `null`.
> Six +30s gated on `target:skillRank:divinity:gte:<grade>` reproduce the sheet's own arithmetic
> by counting grades: a Divinity C defender satisfies `gte:E`, `gte:D` and `gte:C`, and collects
> 90. Measured live against the authored roster — Semiramis (C) 90, Penthesilea (B) 120,
> Heracles (A) 150, all on top of Karna's own Divinity A +50.
>
> **Brahmastra's comparison needed a new roll option**, and the reason is in Ch. 24 §24.4: the
> existing `rank:gte:` ladder is grade-coarse, so *"equal or lower"* written against it hands the
> 4× branch to a `B+` defender against Karna's `B`. Measured live, the `+` step decides three of
> six matchups on the authored roster.
>
> **Note 2 is not `supersedes`.** *"His Master's Health loss from him using the NP overwrites the
> 20 Health loss from when Karna would normally Act/Attack"* looks like §15.4's cost
> supersession, and §15.4 cites it as such — but `resolveCosts` resolves a set of costs against
> each other *at the moment an ability is used*, and this 20 is a standing upkeep that falls due
> at the end of a Turn. `unlessUsedThisTurn` on the handler asks the Turn record instead
> (Ch. 24 §24.3, Group 5).
>
> `Fated Rivals` is authored and **inert by design**: Arjuna is not in the reference set. The
> DECISION below — that a cross-Servant reference resolves by a stable id and warns rather than
> erroring — is now backed by a `target:contentId:` roll option, which nothing emitted before.


**The demand: an NP whose activation permanently rewrites the Servant.**

`Vasavi Shakti` has an `(Passive/Activation)` clause distinct from its `(Active)` use:

> When Vasavi Shakti is **Activated**, the following are permanently applied:
> 1. `Kavacha and Kundala`'s effect is permanently lost.
> 2. BA(STR) +25, STR Rank B → A.
> 3. Normal Attacks deal +30 damage per Divinity rank the DU has (+100 if `Divine` with no
>    Divinity skill).
> 4. Normal Attacks inflict Burn at 50% instead of 25%.
> 5. His Master loses 20 Health at the end of every Combat Process he is in (floor 1).
>
> *"'Activating' Vasavi Shakti is different from using the Active effect below; also it does
> not cost Master Health to 'Activate' it."*

So the NP has **two use modes**: a free one-way activation, and a normal NP use gated on having
activated.

```yaml
id: karna-vasavi-shakti
isNP: true
rank: EX
modes:
  - id: activate
    label: "FGT.Karna.ActivateVasaviShakti"
    oneWay: true
    costs: []                          # explicitly free
    confirmWarning: "FGT.Karna.VasaviWarning"
    phases:
      - kind: applyEffect
        target: self
        effects: [{ id: vasaviActivated, duration: permanent, polarity: status }]
      - kind: removeEffect
        target: self
        selector: { kind: byId, ids: [kavachaKundala] }
        permanent: true
  - id: use
    requirements: [{ kind: hasEffect, effectId: vasaviActivated }]
    blockedBy: [karna-brahmastra-kundala]
    cooldown: "8◈"
    phases: [ /* the 5× 3×3 AoE with Divinity scaling */ ]
```

Multi-mode abilities are a small addition (`modes` on the ability) and they express a pattern
that appears three times in the set (this, Semiramis's HGoB build-vs-use, Nemo's Zero Sail
enter-vs-resurface).

**The `vasaviActivated` status** carries the five permanent changes as its rule elements —
including the loss of `Kavacha and Kundala`, which is modelled as removing a *different*
permanent status rather than as a flag, so the −90% damage reduction simply stops existing.

### `Kavacha and Kundala` — a passive Noble Phantasm

> *"(Passive) All damage received by Karna is reduced by 90% including NP; ignored by Attacks
> with the Pierce effect. While in effect, Karna's Master loses 20 Health at the end of every
> Turn Karna is involved in a Combat Phase; his Master's Health cannot drop below 1 in this way.
> The effect is lost when Vasavi Shakti is used/Activated. This effect is negated if Karna is
> affected by NP Seal?"*

−90% damage reduction is the largest single defensive modifier in the set, and it joins the
stage 4 bucket, so `Atk Up` stacking can still overcome it: an attacker with +95% Atk Up nets
+5%. That interaction is exactly why the bucket is additive (Ch. 13 §13.4).

The trailing question mark on the NP Seal clause is in the source. **DECISION.** Passive NPs are
**not** affected by NP Seal per the general rule (*"does not affect Passive NP unless stated"*),
and a question mark is not a statement. So Kavacha and Kundala survives NP Seal. Ch. 41.

### Fated Rivals — a forced-target compulsion

> *"If Arjuna is on the opposing Faction and within Range of Karna, they will only Attack each
> other. Negatable for 1◈ by spending a Command Spell, affecting Karna only."*

`ForceTarget` (Ch. 24 §24.3) with a named-unit predicate. Arjuna is not in the reference set, so
this is inert today — but it demonstrates that content can reference *another Servant by
identity*, which needs the content build to validate the reference or warn that it is
unresolvable.

**DECISION.** Cross-Servant references resolve by a stable `slug` and produce a **warning**, not
an error, when unresolvable — because a match legitimately may not include the referenced
Servant.

### Brahmastra's parameter comparison

> 1. If **all** of the DU's Parameters are equal or lower than Karna's → 4× + 100.
> 2. If the DU has **any** Parameter higher than Karna's → 2× + 100.

The most complex predicate in the set, shown in full at Ch. 24 §24.4. Worth noting: it compares
*all five* parameters, and Karna's are `B/C/A/B/D`. A high-LUC Servant like Drake (`EX`) or
Heracles (`A`) immediately drops him to the 2× branch. So the "4×" mode is rarer than it looks,
which is good design and the preview must show which branch will apply *before* committing:

```
Brahmastra — 7×7 within Range 4
  ▸ Heracles     LUC A > Karna's D  →  2× branch     1,247 – 1,682
  ▸ Civilian     all params lower   →  4× branch     ⛔ blocked (Karna is Chaotic Good)
```

---

## 36.2 Kiritsugu — reactive support and buff stripping

**The demand: a passive that fires an attack on someone else's turn.**

> `Lethal Gunfire Suppression` (Passive): *"Whenever a Unit inflicted with Decoy (Scapegoat) is
> Attacked, if that AU is within Kiritsugu's Range, Kiritsugu can instantly perform a Normal
> Attack on that AU which cannot be Reacted to unless the AU's AGI Rank is higher than
> Kiritsugu's. Additionally, Kiritsugu can use a Thaumaturgy Spell once before performing this
> Normal Attack."*

An **out-of-turn attack triggered by an ally being attacked**, with an optional spell used
inside the trigger. Three requirements:

1. `OnEvent: attackDeclared` where the target has a specific effect *applied by this unit*.
2. An `Attack` action with `cannotBeReactedTo` conditioned on a rank comparison.
3. A nested optional ability use *before* the triggered attack.

```yaml
- key: OnEvent
  event: attackDeclared
  automatic: true
  predicate:
    - "target:effect:decoyScapegoat"
    - { eq: ["@target.effect(decoyScapegoat).source.unitId", "@self.id"] }
    - { lte: ["@distance(self, attacker)", "@self.range.panels"] }
  then:
    - key: OfferAbilityUse
      filter: { family: thaumaturgy }
      note: "FGT.Kiritsugu.PreSuppressionSpell"
      bypassesPerTurnLimit: true
      stillTriggersCooldown: true
    - key: Attack
      target: attacker
      kind: normal
      cannotBeReactedTo:
        unless: { rankGt: ["@attacker.parameters.agi", "@self.parameters.agi"] }
```

`OfferAbilityUse` is a new action that prompts the owner mid-trigger. It is the same shape as a
Command Spell offer (Ch. 17 §17.1) and reuses that UI.

**The buff-stripping loop.** `Suppression` (5 times, 1◈):

> *"Successful Normal Attacks remove 1 buff from the DU at the start of the Damage Step and if a
> buff was successfully removed, apply Atk Up for 1◈ to Kiritsugu, +15% (5% NP)."*

The same `captureResult` + conditional pattern as Van Gogh's `Gogh` buff (Ch. 35 §35.8) — the
second occurrence, confirming it is a general need. And `Magecraft B` extends the `Suppression`
duration by 1◈ every time a Thaumaturgy spell is used, so the two skills feed each other.

**Affection of the Holy Grail** is the set's only **conditional rank override with a fallback**:

> *"Kiritsugu's Luck is increased from Rank E to Rank EX; Luck Check rolls of all Units within 2
> panels except himself are increased by 4. If Kiritsugu is inflicted with Skill Seal, instead
> of reducing his Max Luck, all of his Luck Check rolls are increased by 20; and the original
> effect is negated."*

So under Skill Seal the rank override reverses *and* a compensating penalty applies — the
character is designed so that sealing his skills is a specific, severe counter.

```yaml
- key: RankShift
  parameter: luc
  set: EX
  predicate: [{ not: "self:effect:skillSeal" }]
- key: CheckModifier
  check: luckCheck
  value: 20
  direction: harder
  predicate: ["self:effect:skillSeal"]
- key: CheckModifier
  check: luckCheck
  value: 4
  direction: harder
  aura: { radius: 2, relations: [ally, enemy, self], excludeSelf: true }
  predicate: [{ not: "self:effect:skillSeal" }]
```

Note the aura's `relations` includes **enemy** — it is a debuff-shaped aura affecting everyone
nearby. The aura system does not care about polarity, which is why it generalizes.

---

## 36.3 Francis Drake — a platform and a state-reading NP

Covered structurally in Ch. 20 §20.5. The two novel demands:

**An NP whose damage reads how long ago a skill was used.**

```yaml
- key: DamageModifier
  direction: dealt
  value: 30
  predicate: [{ lt: ["@elapsedSince(drake-blazing-golden-rule)", "ticks('⅓◈')"] }]
- key: DamageModifier
  value: 20
  predicate: [{ and: [
      { gte: ["@elapsedSince(drake-blazing-golden-rule)", "ticks('⅓◈')"] },
      { lt:  ["@elapsedSince(drake-blazing-golden-rule)", "ticks('⅔◈')"] }] }]
# … and the +10% band, and the −15% Total Damage penalty while on cooldown
```

`@elapsedSince(abilityId)` reads the cooldown tracker, which already stores `usedOnTurn`. Free.

Note the last band is *"Total Damage dealt is reduced by 15%"* — stage 15, not stage 4, per the
Ch. 13 §13.4 rule. The four bonus bands say *"Damage dealt increased"* — stage 4. The source's
wording is precise and the model reproduces it exactly.

**An NP usable with or without its platform.**

> *"Can be used even if the Golden Hind isn't present/activated; in this case the Range is still
> the same, just applied to Drake."*

The conditional anchor (Ch. 09 §9.3), with `platform` as the preferred branch and `self` as the
fallback.

---

## 36.4 Scáthach — copied abilities and a random-effect table

**The demand: an ability that copies two other Servants' abilities at summon.**

`Wisdom of Dún Scáith` is specified in Ch. 15 §15.7. The setup flow:

```
1. At match start, after all Servants are summoned, the GM opens the Wisdom dialog.
2. The dialog lists every ability on the field where:
     copyable.allowed === true
     && hasActive
     && rank !== EX
     && !isClassSkill
     && rank in [B..A]   (a "preferably", so a soft filter with a toggle)
3. The GM chooses which to offer (they may curate).
4. Scáthach's player picks two.
5. Two GrantedAbility documents are created on Scáthach with copiedFrom references,
   her rank (A+), her cooldown (4◈−⅓◈), and mutual exclusion with each other and Clairvoyance.
```

The exclusion list from the source — `Natural Body`, `Mystic Eye` skills, `Mana Burst` skills,
`Kishu no Ma` — is expressed per-ability as `copyable: {allowed: false, reason: "physical"}`,
which means Karna's and the Dioscuri's `Mana Burst` abilities carry the flag in the compendium
rather than the copy logic carrying a blocklist.

**The demand: a random effect table with a "choose any" outcome.**

`Primordial Rune`: roll `2d8` on an eight-entry table, where entry 8 is *"Your choice of any of
the above effect(s)"*.

```yaml
- kind: roll
  formula: "2d8"
  perDie: true                       # each die selects independently
  table:
    1: { effects: [{ id: atkUp,       duration: "1◈", magnitude: { base: 25, np: 15 } }] }
    2: { effects: [{ id: defUp,       duration: "1◈", magnitude: { base: 25, np: 15 } }] }
    3: { effects: [{ id: critUp,      duration: "1◈", magnitude: { base: 25 } }] }
    4: { effects: [{ id: critDmUp,    duration: "1◈", magnitude: { base: 25 } }] }
    5: { effects: [{ id: npDmUp,      duration: "1◈", magnitude: { base: 30 } }] }
    6: { effects: [{ id: debuffResUp, duration: "1◈", magnitude: { base: 25 } }] }
    7: { effects: [{ id: debuffChUp,  duration: "1◈", magnitude: { base: 25 } }] }
    8: { choice: { from: [1,2,3,4,5,6,7], count: 1 } }
  duplicateBehaviour: applyTwice     # "If a duplicate number is rolled, apply the effect twice"
```

`kind: roll` with a table is a new phase type, and `duplicateBehaviour` handles the explicit
duplicate clause. The enemy-targeting variant is the same table with the debuff mirror.

**The demand: an NP that puts *other* abilities on cooldown as a cost.**

> `Gate of Skye`: *"Cannot be used if Primordial Rune, Wisdom of Dún Scáith, and/or Gáe Bolg
> Alternative are on Cooldown; when this NP is used, Primordial Rune and Wisdom of Dún Scáith
> enter Cooldown."*

`blockedBy` plus `alsoTriggers` (Ch. 07 §7.6), both already designed. Note the asymmetry: it is
blocked by three abilities but only triggers two.

**And a Death-inflicting AoE with a per-target rank-scaled save:**

> *"All targeted Units perform a Luck Check; if their MAG is Rank B, reduce the value rolled by
> 2; if Rank A, by 4. If the Luck Check fails → Death. If it succeeds → 4× damage plus 100
> (using Scáthach's BA(MAG))."*

Rank **equality**, not `gte` (Ch. 05 §5.3's RISK) — a Rank `EX` MAG gets *no* bonus, which is
counterintuitive and is exactly the case the validator's `gte`-warning exists to catch.

---

## 36.5 Penthesilea — a compulsion that overrides the player

**The demand: an effect that seizes control conditionally and continuously.**

> `Hatred of Achilles`: *"At any time, if there is a Greek Male Unit (regardless of enemy or
> ally) within a 4 panel area, her Mad Enhancement is immediately activated regardless of
> Cooldown or any other factors, and cannot be deactivated until there are no Greek Male Units
> within 4 panels. During your Turn, if there are any such Units, Penthesilea will ignore all
> orders; she will constantly Move towards and Attack said Unit. This counts towards the number
> of Units that Move and/or Attack during your Turn."*

Three mechanisms:

1. **Forced mode activation by a positional predicate**, bypassing cooldown.
2. **Total loss of player control** while the condition holds.
3. **Budget consumption** for the forced actions.

```yaml
mode:
  isMode: true
  forcedActive:
    predicate:
      - { exists: { within: 4, relations: [ally, enemy],
                    where: ["unit:attribute:male", "unit:region:greece"] } }
    bypassesCooldown: true
    cannotDeactivateWhile: true
passiveRules:
  - key: ForceAction
    predicate: [{ exists: { within: 4, where: ["unit:attribute:male", "unit:region:greece"] } }]
    action: { kind: moveAndAttack, target: nearestMatching }
    consumesBudget: true
    overridesPlayerControl: true
```

`ForceAction` with `overridesPlayerControl` is stronger than `Berserk` or `Decoy`, both of which
constrain choices rather than eliminating them. It is the same machinery as `Confuse`'s random
action (Ch. 18 §18.5) but deterministic instead of random.

The Command Spell escape:

> *"This effect can be disabled for 1◈ Turns by spending one Command Spell. Note: Does **not**
> deactivate Mad Enhancement!"*

So one spell buys back control but leaves her transformed. Two separate suppressions, and the
UI must distinguish them or a player will spend a spell expecting the wrong outcome.

**And a Noble Phantasm active only while Mad Enhancement is off:**

`Goddess of War` is a passive NP whose effects — d4-scaled damage bonuses on both offence and
defence, an evade improvement, and a **Divinity rank increase** — are gated on ME being
deactivated. Since `Hatred of Achilles` forces ME on whenever a Greek male is near, and
Heracles, Karna (no — Indian), and the Dioscuri are Greek males, her NP is off far more often
than on in a typical roster. That is the character.

---

## 36.6 Nemo — a pocket dimension and a dice-counting attack

Structurally covered in Ch. 20 §20.6. Two additional demands:

**A dice-counting attack skill with five conditional modifiers.**

> `Quickfire`: *"Roll 6 six-sided die, this Attack Skill deals 25 STR damage for each die that
> rolls X or higher, where X = 5, modified: +1 if the enemy Evades (instead of performing an
> Evade roll); −1 if used at Range ≤2; −1 if the enemy has Slow, Immobilize or Stun; −1 if the
> enemy's Agility ≤ Nemo's. After performing this Attack Skill, if the enemy does not Counter,
> reduce Quickfire's Cooldown by 1◈. A DU damaged only performs an Injury Roll once. Damage is
> not affected by damage modifying effects on Nemo."*

```yaml
formula:
  kind: diceCount
  dice: "6d6"
  threshold:
    base: 5
    modifiers:
      - { delta: +1, predicate: ["defender:reaction:evade"] }
      - { delta: -1, predicate: [{ lte: ["@distance", 2] }] }
      - { delta: -1, predicate: [{ anyOf: ["target:effect:slow", "target:effect:immobilize",
                                           "target:effect:stun"] }] }
      - { delta: -1, predicate: [{ lte: ["@target.agility.value", "@self.agility.value"] }] }
  perSuccess: { amount: 25, component: str }
  bypassModifiers: { attacker: true, defender: false }
  singleInjuryRoll: true
```

`kind: diceCount` is a new damage formula kind. The two-sided `bypassModifiers` (Ch. 13 §13.8)
gets its only user here.

Note the first modifier: `+1 if the enemy Evades (instead of performing an Evade roll)` — the
threshold worsens if the defender chooses to evade, and the evade roll is *replaced* by this.
So `Quickfire` is a special reaction case: choosing Evade against it does not roll Evade, it
just makes the attack worse. The reaction ladder needs a per-ability override for what "Evade"
means, which is one more entry in `formula`.

**Banded AoE with per-band effect chances.** `Triton's Conch` (Ch. 09 §9.4).

---

## 36.7 Kingprotea — a growing unit

**The demand: a unit whose physical size changes mid-match.**

> `Huge Scale`: *"For each Proliferation stock, Max and current Health +20% of her original Max
> Health. For every 3 stocks, her size grows by 1 panel (1×1 → 2×2 → 3×3 → 4×4). Each growth
> gives Range +1 and MOV −1. Maximum 10 stocks. Stocks are not lost when Endless Proliferation
> ends. Each stock counts as a separate buff."*

Four coupled consequences per stock, and a size change every third stock. The growth mechanism
is specified in Ch. 08 §8.3 (cascading knockback) and Ch. 04 §4.12 (multi-panel units).

```yaml
effects:
  - id: proliferationStock
    polarity: buff
    stacking: { rule: magnitudeStacks, max: 10 }
    groupKey: proliferation
    rules:
      - { key: StatModifier, stat: health, aspect: max,
          value: "0.2 * @self.originalMaxHealth", alsoRestore: true }
      - { key: DamageModifier, direction: taken, value: -10,
          predicate: ["attack:kind:np"], cap: -80 }
      - { key: BuffRemovalResist, value: "@stackIndex == 1 ? 35 : 5", cumulative: true }
      - key: SizeStep
        every: 3
        footprintDelta: 1
        rangeDelta: 1
        movDelta: -1
```

`SizeStep` with `every: 3` is the mechanism: the effect applier counts stacks in the group and
emits a size change on every third. Growth triggers the knockback cascade; shrinking (via
`Infantile Regression`) is the reverse and needs no cascade because it frees panels.

**`Infantile Regression`** converts the entire stock into NP cooldown:

> *"Removes Endless Proliferation and all Proliferation stocks. Then reduce NP Cooldown by ⅓◈ ×
> the number removed. **Ignores effects that prevent buffs from being removed.** Then reduce
> the Cooldown of her other Skills by 1◈."*

`ignoresRemovalProtection: true` on the removal — the only ability in the set that dispels
*through* `Buff Removal ResUp`, and notably it is dispelling *her own* buffs, which the
protection was defending. A self-targeting bypass, needed because her own passive would
otherwise block her own combo.

**`NP DmUp (GAO)`** is the second stack-based effect, applied N times where N is her current
Proliferation count, decaying one per turn she acts. Two independent stack economies on one
unit, which is why the `groupKey` field exists on effect instances (Ch. 11 §11.1).

**And Mad Enhancement A+ with a 55%/25% split** — the highest damage reduction in the set after
Karna's Kavacha and Kundala, combined with `Territory Creation EX` (6d20 offence,
3d10+30 defence) and `Independent Action B`. She is a fortress that grows.

---

## 36.8 Cross-cutting findings

Aggregating across all twelve:

| Requirement | Servants needing it |
|---|---|
| Non-standard normal-attack component | Van Gogh, Nemo, Semiramis, Mannanán |
| Modes (activatable statuses) | Heracles, Penthesilea, Kingprotea, Castor, Semiramis, Kiritsugu |
| Resource pools | Mannanán, Kingprotea, Semiramis, Scáthach |
| Platforms | Semiramis, Drake, Nemo |
| Multi-mode abilities | Karna, Semiramis, Nemo |
| Conditional targeting anchors | Drake, Nemo, Semiramis |
| Player choice inside an ability | Dioscuri, Scáthach |
| Revival sources | Heracles, Mannanán, Nemo, Van Gogh |
| Cross-ability cooldown coupling | Van Gogh, Scáthach, Karna |
| Attack-modifier skills (`whenAttacking`) | Karna, Castor, Pollux, Kiritsugu |
| Out-of-turn triggered attacks | Kiritsugu, Mannanán |
| Forced-target compulsions | Penthesilea, Karna |
| Stack-based effect economies | Kingprotea, Van Gogh |

**Total script elements across all twelve Servants: two.** Mannanán's `Fragarach` NP
(cross-ability "strongest NP" reasoning) and Semiramis's `TerritoryCreationScope`. Roughly 70
abilities, two scripts — under 3%, against a 15% target.

---

**Next:** [37 — Content Pipeline](37-content-pipeline.md)
