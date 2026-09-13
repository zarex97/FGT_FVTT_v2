# Francis Drake — design

**Date:** 2026-09-13
**Source:** `char_orig_sheets/Copia de Francis Drake.md`
**Chapters affected:** [09 — Targeting](../../09-targeting.md), [12 — Combat Process](../../12-combat-process.md),
[14 — Checks and Randomness](../../14-checks-and-randomness.md), [20 — Platforms and Levels](../../20-platforms-and-levels.md),
[22 — Data Models](../../22-data-models.md), [36 — Case Study: The Remaining Seven](../../36-case-remaining.md),
[45 — Implementation Status](../../45-implementation-status.md),
[A — Effect Catalogue](../../A-effect-catalogue.md), [D — Servant Data Sheets](../../D-servant-data-sheets.md)

---

## 1. The problem

Drake is the **twenty-first** Servant and the **fifth** platform owner, and almost everything she
needs is already here. `packs/_source/platforms/golden-hind.yml` has existed since Ch. 20 was
written; `orientedRect`, conditional targeting anchors, `scope: np` cooldown changes,
`summonPlatform`, `supersedes` NP costs, `replacesRiderAction`, `sharesPanel`, `deactivationVerdict`
and the whole `upkeep` axis are all built and have live callers.

So this is not a Servant that needs a subsystem. It is a Servant that needs **five clauses the
platform schema cannot currently express**, a **resource**, and a **correction**.

### 1.1 The correction: §36.3 describes a sheet that no longer exists

`docs/36-case-remaining.md` §36.3 specifies Drake's Noble Phantasm damage as a set of
elapsed-time bands:

```yaml
- key: DamageModifier
  direction: dealt
  value: 30
  predicate: [{ lt: ["@elapsedSince(drake-blazing-golden-rule)", "ticks('⅓◈')"] }]
```

The current sheet does not work that way. It reads:

> *"Total damage dealt is further increased by 10% for every Galleon Token on herself; however,
> if she has no Galleon Tokens, Total damage dealt is reduced by 15%."*

`Blazing Golden Rule` was rewritten around a **token economy** — three tokens from its Active, a
15% chance of one more on every Crit, one lost at the end of every full Round. The chapter's
`@elapsedSince` design reads a cooldown tracker that the sheet no longer asks about.

**The sheet is authoritative.** §36.3 is rewritten as part of this work (Task 14). It is called
out here because a reader who implements the chapter rather than the sheet builds the wrong
Servant, and the chapter is the more convenient document to reach for.

### 1.2 The correction, smaller: a comment that names the wrong payer

`module/engine/fields.mjs:1177`:

> *"Who pays. `ownerMaster` is the only payer any sheet names, but the field is the wrong place
> to assume it: **the Golden Hind's upkeep is Drake's own Health**, and that is the same axis with
> a different payer."*

It is not. Her sheet says *"Drake's **Master** loses 50 Health."* The `payer: "owner"` branch the
comment justifies is real and worth keeping — nothing else uses it yet — but the justification is
wrong and the Golden Hind pays `ownerMaster` like every other platform. Corrected in place.

### 1.3 What `golden-hind.yml` is missing

The file carries the statline, `capacity: 9`, `level: 2`, `detect: 4` and the three-tier
`crossLevel` block. Against the sheet it is missing:

| Missing | Sheet |
|---|---|
| `agility: 10` | *"Agility: 10"* |
| `inherit: {luck: {from: summoner}}` | *"Luck: Shared with Drake"* |
| `sharesPanel: true` | *"can Move onto occupied panels… place it on top of the figurines"* |
| `normalAttack: {mode: fixed, component: mag}` | its only Base Attack is MAG 200 |
| `replacesRiderAction: {roles: [owner], normalAttack: true}` | *"Drake's Normal Attacks are replaced with Attacks from the Golden Hind"* |
| `upkeep`, `deactivation` | the 50/Round toll and the at-will switch-off |

---

## 2. Rulings

These are the readings the content cites by number. Where the sheet is ambiguous the reading is
stated with its reason, so a later reader can disagree with the reason rather than guess at the
rule.

**R1 — Golden Wild Hunt always uses the Hind's Base Attack (MAG) 200, with or without the ship.**
The sheet says *"The Golden Hind's Base Attack (MAG) is used"* flatly, and its shipless clause
exempts exactly one thing: *"in this case the **Range** is still the same, just applied to Drake."*
Only the **anchor** is conditional. `4 × 200 + 100 = 900` either way. *(User ruling, 2026-09-13.)*

**R2 — Drake's Riding Active gates all three passives, Double Move included.** Her Active names
*"'Double Move', 'Riding Attack', and 'Passenger Seat'"*; Medusa's otherwise word-for-word Active
names only the last two, and `class-riding-medusa.yml` rules her Double Move unconditional on
that basis. The difference between the two sheets is the whole reason the Medusa variant exists,
so it is honoured in both directions. New file, `class-riding-drake.yml`. *(User ruling,
2026-09-13.)*

**R3 — Her normal attack is STR.** Her sheet names no component. Semiramis is the precedent
(STR 45 / MAG 200, silent, authored STR), recorded in `kiritsugu.yml`. It also reads right: her
MAG is rank **E**, so a MAG normal attack is negated outright by any Magic Resistance of D or
better, and her BA(MAG) 100 is never what her NP uses — that is the ship's 200 (R1).

**R4 — "its NP Cooldown" reaches both Noble Phantasms.** `selectAbilities`' `scope: np` is
already the house answer to this question for a Servant with two NPs, with the reasoning written
above it. Every cooldown reduction Drake has — Pioneer of the Stars' `1◈+⅔◈`, Blazing Golden
Rule's and Beyond the Uncharted's NP Regen, the Crit passive's 1 Turn — uses it. No clause of
hers names a specific NP.

**R5 — Both Galleon Token damage modifiers are Total Damage (stage 15), not stage 4.** The sheet
says *"**Total** damage dealt is further increased"* and *"**Total** damage dealt is reduced by
15%"*. §13.4 makes that distinction load-bearing, and §36.3 already flagged it for the clause
this one replaces.

**R6 — The 50 Health toll charges on the Round boundary, not on a 1◈ period.** The sheet's own
text is `At the end of every ~~Round/1◈ Turns~~ full Round`. The strikethrough is the author
rejecting the tick-period reading, and with variable turn order `1◈` from activation and the end
of the Round are different moments.

**R7 — Enemy boarding is a flat 1d10 needing a 10; allies board free.** *"If an **enemy** Unit
attempts to board… it rolls a ten-sided die. The enemy unit successfully boards if a 10 is
rolled."* No rank relief, no Levitating branch — the existing `boardingTarget` is the Hanging
Gardens' rule and does not apply. Allies are covered by the separate sentence *"Other allied
Units can board and unboard the Golden Hind by Moving onto it normally."*

**R8 — The Hind replaces Drake's Normal Attack but not her Move.** Quetzalcoatl's
`replacesRiderAction` takes `move: true` because her sheet says *"Quetz's Move **and** Normal
Attack is replaced"*. Drake's says only *"Drake's Normal Attacks are replaced."* The ship keeps
its own `actsOncePerTurn` movement, as the Hanging Gardens do.

**R9 — Galleon Tokens are uncapped and floored at zero, and both are free.** The sheet states no
maximum, unlike EMIYA's Aria (*"maximum number of Aria stored is 6"*), so `max: null`. The Round
decay cannot take her below zero — *"lose 1 Galleon Token"* has nothing to take at zero, and a
negative count would invert R5's bonus into a penalty. `io.mjs#adjustResource` already does
`Math.max(0, …)` and only applies a ceiling when the pool's `max` is a number, so this ruling
needs no code — only the test that holds it.

**R10 — The Noble Phantasm cooldown counts from deactivation.** *"Cooldown: 7◈+⅓◈ Turns **after
the Golden Hind is destroyed/deactivated**."* Not from use: a ship that stays up for six Rounds
has not been counting down for six Rounds.

**R11 — The upkeep supersedes the normal NP Master-health cost for as long as the ship is up.**
*"This effect overwrites the normal Master Health loss when a Servant uses its NP."* The Hanging
Gardens carry the identical sentence and `engine/attack.mjs:2751` already reads
`platform.upkeep.supersedes` for it. The clause is not scoped to the activation, so Golden Wild
Hunt fired from the deck is covered too.

**R12 — Forced deactivation does not charge.** *"…forcefully deactivated at the end of the Round
if Drake's Master has 50 Health or less; her Master **does not** lose Health at the end of the
Round in this situation."* This is `endWhenUnaffordable`'s existing semantics
(`currentHealth(payer) <= amount` → deactivate instead of charging) with no change.

---

## 3. The five platform blocks

Approach A, chosen 2026-09-13: every novelty becomes **authored platform vocabulary** rather than
a `module/engine/drake.mjs`. Each block is optional and defaults to today's behaviour, so the
Hanging Gardens, the Storm Border and the Quetzalcoatlus are untouched.

The standing risk this project names as its dominant defect is a rule that is right and inert.
**Every block below lands in the same task as its reader and a test that observes it.**

### 3.1 `boarding` — R7

```yaml
boarding: { die: 10, target: 10, byRelation: enemy }
```

`rules/platforms.mjs#boardingTarget` gains the override. It already takes a context object, so
the signature does not change:

```js
export function boardingTarget(unit, ctx = {}) {
  const spec = ctx.platform?.boarding ?? null;
  if (spec) return { die: spec.die, target: spec.target };   // flat, no relief
  // …the Hanging Gardens' 1d12/1d8 with rank relief, unchanged
}
```

`engine/platforms.mjs#boardPlatform` gains the relation gate: when `byRelation` is set and the
boarder is **not** of that relation, no roll happens and boarding succeeds outright. Capacity is
still counted first — failing a roll you could not have benefited from wastes the attempt, which
is the existing comment's reasoning and applies equally here.

### 3.2 `upkeep.every: "round"` — R6, R11, R12

```yaml
upkeep:
  every: round
  cost: { kind: health, amount: 50, payer: ownerMaster }
  endWhenUnaffordable: true
  supersedes: [npCost]
```

`engine/fields.mjs#runUpkeep` today resolves `every` through `parseTick`/`resolveTicks` and
compares elapsed ticks. The literal `"round"` takes a second branch: charge when the sweep is
running on a Round boundary and `lastUpkeepAt` is not already this Round. `stampUpkeep` needs no
change — it writes the tick either way, and the Round-boundary branch compares Rounds rather than
ticks.

`supersedes` and `endWhenUnaffordable` need **no code at all**; both readers exist. This is the
one block that carries both documented shapes of the untyped `upkeep` field at once — a recurring
toll *and* a cost that replaces another — which is exactly why `simple.mjs` made it an
`ObjectField`.

### 3.3 `injuryRoll` — the sheet's parenthesis

```yaml
injuryRoll: { onlyFrom: np }
```

*"Agility: 10 (Only performs Injury Roll when damaged by NP)."* `rules/injury.mjs#injuryCheck`
gains the gate. §12 already anticipates it: *"a per-unit"* rule, noted and never built.

### 3.4 `lockAboard`

```yaml
lockAboard: [owner]
```

*"Drake cannot unboard the Golden Hind."* Refused at movement legality, so the interface never
offers the move rather than rejecting it afterwards.

### 3.5 `deactivateOn`

```yaml
deactivateOn: [npSeal]
```

*"If Drake is inflicted with NP Seal, Golden Hind is immediately deactivated."* Hung on
`effectApplied`, which `engine/applier.mjs` already raises for every debuff that lands (the
convergence point Mannanán's Fragarach uses).

### 3.6 Four additions that are not platform blocks

**`cooldown.from: deactivation`** (R10) on both Noble Phantasms. The cooldown clock starts when
`destroyPlatform`/deactivation runs, not when the ability was used.

**`chance` on OnEvent actions.** Effect *riders* already honour `a.chance`
(`scheduler.mjs:686`); the action table does not. Her 15%-per-Crit token needs it. Added to
`dispatch` so it covers every action rather than `ResourceDelta` alone.

**Anchor direction for `platform` and `self`** — §6.1. Two returns gain a `direction`, without
which the broadside always fires north.

**`vocabulary.mjs:155`'s `needs: ["w", "h"]` → `["short", "long"]`** — a pre-existing defect in
the ability editor's shape vocabulary, found here because Drake is `orientedRect`'s third user.
Not hers, fixed here because this pass is the one that noticed.

---

## 4. Galleon Tokens

A **resource**, modelled on EMIYA's `aria` — not an effect. Tokens are counted, are read by a
damage modifier, and have no duration, which is the distinction Ch. 06 draws.

```yaml
# drake.yml
resources:
  galleonTokens: { value: 0, max: null }    # R9
```

| Sheet clause | Shape |
|---|---|
| *"Whenever this Unit performs a Crit, reduce its NP Cooldown by 1 Turn and she has a 15% chance of gaining 1 Galleon Token"* | `OnEvent: damageDealt`, `predicate: ["attack:crit"]`, `then: [CooldownDelta {scope: np, delta: -1}, ResourceDelta {resource: galleonTokens, delta: 1, chance: 15}]` |
| *"Gain 3 Galleon Tokens"* (Active, effect 4) | `ResourceDelta {delta: 3}` |
| *"At the end of every full Round, lose 1 Galleon Token"* | `OnEvent: roundEnd`, `ResourceDelta {delta: -1}`, floored at 0 (R9) |
| *"+10% Total per token; −15% Total at zero"* | two `DamageModifier`s at **stage 15** (R5), one scaled per token, one predicated on zero — see §4.1 |

`damageDealt` fires **on the attacker** with `attack:crit` in the option set, and is the rung
Appendix A's on-hit riders already hang from — so the Crit passive has a real trigger and needs
no new event.

Note the sheet says *"reduce its NP Cooldown by **1 Turn**"*, not `1◈`. A raw turn count, which
`CooldownDelta`'s `delta` is; `ticks` is the ◈ form and is wrong here.

**Two cooldown readers, opposite conventions.** The OnEvent *action*
`{key: CooldownDelta, ticks}` negates its own ticks, so a reduction needs no direction. An ability
*phase* (`kind: cooldown`) goes through `skill-use.mjs#cooldownChanges`, where
`const down = change.ticks !== undefined ? (change.direction === "down") : …` — so a `ticks` change
with no `direction: down` counts **up**. Pioneer of the Stars is a phase and must state it;
Kingprotea's *Huge Scale* is the precedent. Drake uses both readers, which is why this is written
down rather than left to the implementer.

### 4.1 Total Damage has no authoring channel yet

Stage 15 reads `s.ctx.totalDamageModifiers` (`rules/damage/pipeline.mjs:875`), and that array has
**exactly one producer in the codebase** — `coverModifiersFor` (`engine/attack.mjs:3512`). No
authored content has ever contributed to it, and `DamageModifier` has no `stage` field at all:
every authored modifier lands at stage 4.

So R5 is not a field to set but a channel to open — `stage` on `DamageModifier`, defaulting to
today's behaviour, routed into `totalDamageModifiers` for `stage: "total"`.

It is worth the work rather than worth rounding away, because the two stages give different
numbers: `(200 × 4 + 100) × 1.3 = 1170` at stage 15, against `200 × 1.3 × 4 + 100 = 1140` at
stage 4. Authored at the wrong stage, Drake's broadside is wrong by 30 and looks right.

---

## 5. The abilities

| Sheet entry | File | Notes |
|---|---|---|
| Magic Resistance D | — | `{ref: class-magic-resistance, rank: D}`. **One line.** The tables already yield 20% reduction, negation up to D, 10% debuff resist, the Instakill/Death clause with its STR-damage exemption, and Erase unaffected — every word of her sheet. |
| Riding B | `class-skills/riding-drake.yml` | R2. Tables yield MOV +4 and cooldown 2◈. |
| Voyager of the Storm A+ | `abilities/drake-voyager-of-the-storm.yml` | Flavour. Nemo's identically-named passive is recorded and modifies nothing; hers is the same and is authored the same way rather than invented into an inert rule element. |
| Beyond the Uncharted A | `abilities/drake-beyond-the-uncharted.yml` | Conditional anchor (§9.3): `platform` branch when the Hind is boarded, `chebyshevRadius r:2` otherwise — Nemo's Zero Sail shape exactly. Four effects: `npDmUp 20`, `atkUp 20/np 10`, `npRegen`, and `uncharted` **to Drake only**. |
| Pioneer of the Stars EX | `abilities/drake-pioneer-of-the-stars.yml` | `CooldownDelta {scope: np, ticks: "1◈+⅔◈"}`, then `pierce` for `1◈+½◈` on self, then `sCritUp 10` at `chebyshevRadius r:2` for `⅓◈`. Three different durations and two different target sets in one ability. |
| Blazing Golden Rule A | `abilities/drake-blazing-golden-rule.yml` | §4's two passives plus an Active of `npRegen`, `atkUp 30/np 20`, `ignoreDef`, `+3 tokens`. |
| Golden Hind: Wild Hunt A+ | `abilities/drake-golden-hind-wild-hunt.yml` | NP1. The existing generic `summonPlatform` phase; no new engine. |
| Golden Wild Hunt A+ | `abilities/drake-golden-wild-hunt.yml` | NP2. §6. |

**Effect 4 of Beyond the Uncharted targets Drake, not the group.** *"Applies the 'Uncharted' buff
for 1◈ Turns **to Drake**"* — where effects 1–3 reach everyone the ability caught. A phase whose
reach differs from its ability's must say so per phase; defaulting is the defect that once sent
Scáthach's tokens to Medea.

New effects: `uncharted` (`StatDelta stat: detect add: 3` — `detect` is already in
`MODIFIABLE_PATHS`) and `ignore-def` (`AttackProperty: ignoresDefUp` **alone**; Kiritsugu's
`penetration.yml` bundles it with halved Invuln and is not reusable here).

---

## 6. Golden Wild Hunt

```yaml
targeting:
  anchor:
    kind: conditional
    branches:
      - predicate: ["self:onPlatform:platform-golden-hind"]
        anchor: { kind: platform, platformId: platform-golden-hind }
        shape: { kind: orientedRect, short: 3, long: 7 }
    otherwise:
      anchor: { kind: self }
      shape: { kind: orientedRect, short: 3, long: 7 }
```

Same shape on both branches (R1 — only the anchor moves). `shapes.mjs:132`'s `orientedRect`
already carries Drake's clause as its own explanatory comment — *"7×3 or 3×7 in the direction the
bow is facing"* — so the two facings fall out of `anchor.direction` rather than needing two
entries.

**`short`/`long`, not `w`/`h`.** `normal-berserker-np-a.yml` already notes this, and
`vocabulary.mjs:155` declares `needs: ["w", "h"]` — which is **wrong**, and means the ability
editor prompts for two fields the shape never reads. Drake is its third user; the one-line fix
belongs to this pass (§3.6).

Damage is `4× + 100` off the Hind's BA(MAG) 200 (`multiplier: 4`, `flatBonus: 100` — Heracles's
*Nine Lives* is the precedent for the pairing), then R5's two Total-Damage modifiers.

**And the Base Attack cannot be a board lookup.** `pipeline.mjs:249` resolves a damage source as
`src.unit === "self" ? attacker : (ctx.units?.[src.unit] ?? attacker)` — against the board, falling
back to the attacker. R1 says the ship's 200 is used *"even if the Golden Hind isn't
present/activated"*, so there may be no such unit, and the fallback would silently substitute
Drake's own 100 and halve the Noble Phantasm. A `contentId` source reads the platform's authored
compendium value instead, where 200 is a constant.

### 6.1 The bow has to reach the shape

`orientedRect` reads `anchor.direction`. Only `selfEdgeAdjacent` supplies one today — which is
why Nemo's Barrel Bombing pairs the two — and `resolve.mjs:666`'s `platform` case returns
`{panel, panels}` and no direction at all.

The facing itself is **not** missing: `PlatformData` spreads `unitCommon()`, so the Golden Hind
has `system.facing` like every other unit, and `snapshot.mjs:158` already projects it. Ch. 20
§204's `facing: Cardinal // Golden Hind's bow` is therefore already satisfied.

What is missing is one line of propagation:

```js
case "platform": {
  const platform = (board.units ?? []).find((u) => u.id === (placement.platformId ?? spec.platformId));
  return { ...base, panel: platform?.panel ?? casterPanel, panels: platform?.panels ?? [],
           direction: platform?.facing ?? "n" };
}
```

The `otherwise` branch needs the same from `self`, which today returns `{panel}` only — so
`anchor.direction` falls back to `"n"` and a shipless broadside always fires north regardless of
which way Drake is standing. Both are fixed together, because R1 makes the two branches differ
only in *whose* facing is read.

---

## 7. Testing

`test/unit/drake.test.mjs`, one `describe` per clause. The ones that earn their own case:

- Magic Resistance D negates a MAG-D attack and reduces a MAG-A one by 20% — proving the `ref:`
  line needs no authoring.
- Riding's Active grants all three, and **none of the three exist without it** (R2 — the negative
  is the whole ruling).
- An enemy boarding roll of 9 fails and 10 succeeds, with no rank relief applied (R7), while an
  ally boards with no roll at all.
- The toll charges once per Round and not once per 1◈ (R6).
- At Master Health 50 exactly: deactivates, and **charges nothing** (R12).
- Galleon damage at 0 tokens is −15% Total, at 3 tokens is +30% Total, and both land at stage 15
  (R5).
- The Round decay floors at zero (R9).
- Golden Wild Hunt with no ship uses 200, not 100 (R1).
- The broadside fires along the **bow** with the ship and along **Drake's own facing** without
  it — and in particular not north in either case (§6.1), which is what the bug would look like.
- NP Seal deactivates the Hind on application.
- The Hind rolls an Injury Roll against an NP and not against a Normal Attack.

**Then the live pass**, which is what this Servant is actually judged on: the world up via
`node tools/fgt-world.mjs up`, driven through the real interface with claude-in-chrome. Raise the
ship, board an ally, fail an enemy over the side, watch the Master bleed 50 on a Round boundary,
take him to 50 and watch it force-deactivate without charging, fire the broadside at 0 tokens and
at 3, and read the swing off the chat card.

---

## 8. Sequencing

Each task pairs **one engine addition with the clause that consumes it**, so nothing lands inert.

1. The Servant, the statline, and Magic Resistance D for free
2. `riding-drake.yml` — R2, and the negative case
3. Galleon Tokens: the resource, the Round decay, `chance` on OnEvent actions
4. Blazing Golden Rule — the Crit passive and the Active
5. Beyond the Uncharted — the conditional anchor and `uncharted`
6. Pioneer of the Stars — three durations, two target sets
7. `golden-hind.yml` completed — statline, inherit, sharesPanel, attack replacement
8. `boarding` + its reader — R7
9. `upkeep.every: round` + its reader — R6, R11, R12
10. `injuryRoll`, `lockAboard`, `deactivateOn` + their readers
11. NP1 — the activation, and `cooldown.from: deactivation` (R10)
12. NP2 — anchor direction (§6.1), the `needs` fix, the oriented broadside, token scaling (R1, R5)
13. The live pass
14. Documentation

---

## 9. Risks

**The `@elapsedSince` trap.** §36.3 is the natural place to look for Drake's NP and it describes a
sheet that no longer exists (§1.1). Task 14 rewrites it; until then the chapter actively misleads.

**Five new schema blocks is five chances to ship a stub.** Mitigated by the pairing rule in §8 and
by §7's negative tests — a block whose test only proves the happy path has not been proven to be
read at all.

**`upkeep` now carries both of its documented shapes at once.** The Golden Hind is the first to
do so. `runUpkeep` filters on `upkeep?.every` and `attack.mjs` reads `upkeep.supersedes`, so the
two do not collide today — but the filter is the only thing keeping them apart, and a test holds
it.

**Round-boundary upkeep and variable turns per Round.** `turnsPerRound` is a world setting; the
Round branch must compare Rounds, not derive a tick count, or R6 silently becomes the reading its
own sheet struck out.

**Three of this Servant's defects are wrong numbers that look right,** which is the class of bug
this project is least able to see: Riding's MOV Up hard-coded to Medusa's rank (+5 where Drake's
sheet says +4), a Total Damage modifier authored at stage 4 (1140 where the sheet says 1170), and
a shipless broadside falling back to her own Base Attack (500 where R1 says 900). None of the
three throws, none fails a test that does not specifically look for it, and all three are
plausible values for what they replace. Every one has a named test in §7.
