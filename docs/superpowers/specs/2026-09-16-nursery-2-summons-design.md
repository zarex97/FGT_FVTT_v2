# Nursery Rhyme, Part 2 — the summons — design

**Date:** 2026-09-16
**Source:** `char_orig_sheets/Copia de Nursery Rhyme.md`
**Part 2 of 4.** Depends on Part 1 (`2026-09-16-nursery-1-core-design.md`).
**Chapters affected:** [08 — Board and Geometry](../../08-board-and-geometry.md),
[15 — Abilities](../../15-abilities.md), [16 — Relationships](../../16-relationships.md),
[20 — Platforms and Levels](../../20-platforms-and-levels.md),
[44 — Case Studies: the Expanded Roster](../../44-case-expanded-roster.md),
[45 — Implementation Status](../../45-implementation-status.md), [D — Servant Data Sheets](../../D-servant-data-sheets.md)

---

## 1. The problem

Two Noble Phantasms that put units on the board, and an Item that exists mostly to kill one of them.

**Trump Soldiers** is a *swarm*: `1d8+4` bodies at once, each cheap, whose job is to stand next to
Nursery and her Master so that nothing may attack them.

**The Jabberwock** is the opposite: one 1500-Health monster that heals off Servants, walks through
people, remembers its wounds between summons, and can extend its own stay. It is the strongest
single summon in either roster.

**`[Vorpal Blade]`** is the answer to it — an Item that appears on a random panel the first time the
Jabberwock is summoned, that *"cannot be obtained by Nursery or her Master"*, and whose whole
purpose is to let the other side put the monster down for good.

That last relationship is the interesting one: **she summons her own counter.**

---

## 2. What already exists

Medea's *Dragon Tooth Warriors* is very nearly Trump Soldiers, and almost every flag both summons
need is in the schema because of Bašmu, the Sphinxes and the Warriors.

| Clause | Reality |
|---|---|
| *"Roll an eight-sided die and add 4"* | `spec.countRoll`, which Dragon Tooth Warriors uses as `"1d6"`. `"1d8+4"` is the same field with a modifier. |
| *"within a 2 panel area of herself"* | `spec.placement: {shape, size, anchor: self}` — the Warriors' own field. |
| *"do not count towards the number of Units that Move and/or Attack"* | `countsTowardBudget: false`, on the summon's statblock. |
| *"The same Trump Soldier can only Move/Attack once per Turn"* | `actsOncePerTurn: true`, likewise. |
| *"Enemy Units cannot Attack Nursery or her Master if any Trump Soldiers are directly next to them"* | **`TargetingModifier {mode: protectSummoner, radius: 1, protects: [summoner, summonerMaster]}`** — on the SUMMON's own statblock. Medea's Dragon Tooth Warriors carry the identical sentence and this identical rule, and its comment says why it is not a Compulsion: *"a Decoy-shaped rule rather than a Compulsion: it removes targets rather than forcing one."* **(Corrected before planning — this spec first said `RelationshipProxy`, which is Pale Rider's redirect of Master-protection to summons and a different mechanism.)** |
| *"Counts as Nursery's Attack for the Turn"* | `countsAsAttack: true`. |
| *"Cooldown: ⅓◈ Turns for each Trump Soldier summoned"* | `cooldown: {perUnit: "⅓◈", countFrom: summonCount}` — Dragon Tooth Warriors, verbatim. |
| *"if it Moves onto an occupied panel, all Units occupying said panels are knocked back by 1 panel"* | `movesOntoOccupiedPanels: true` (Bašmu) plus `Knockback`, both built. |
| *"its Stats will be the same as when it disappeared"* | **`fieldSummonStats`** — on the *summoner*, because the summon is about to stop existing. Built for Ozymandias's Sphinxes: *"If Ramesseum Tentyris is reactivated, the Sphinxes will respawn with the same Stats as when they disappeared."* |
| An Item that changes Base Attack and Range while Equipped | `rules/items.mjs`, `BaseAttackModifier`, `RangeDelta`. |
| *"Cannot be obtained by Nursery or her Master"* | `acquisitionTarget` is the right **seam** — *"the one seam every acquisition goes through"* — but it takes `(unit, board)` and **no item**, so it can refuse a unit that holds nothing (Pale Rider) and cannot refuse *this* item to *these* units. **(Corrected before planning — this spec first called B8 FREE. It is E4 below.)** |

**Trump Soldiers is therefore almost entirely free.** The Jabberwock is not.

---

## 3. Rulings

**R1 — `1d8+4` is a single roll, not four plus a die.** *"Roll an eight-sided die and add 4 to that
number"* — one `1d8`, then `+4`, for 5–12 soldiers. Recorded because `countRoll: "1d8+4"` and
`countRoll: "4d8"` are both plausible readings of a careless transcription, and they are very
different swarms.

**R2 — The Jabberwock's lifesteal reads *damage received*, not damage dealt to it.** *"Whenever the
Jabberwock receives damage from Servants, its Health is restored by 75% of the damage received."*
The figure is the damage that **landed**, after every reduction — so a Servant who hits it for 400
into its own Def Up heals it by 75% of what actually got through, not of what was rolled. This is
what `damageTaken` carries and is the only reading the event supports.

**R3 — Lifesteal is from *Servants* only.** Masters, summons, platforms and structures do not feed
it. The sheet names Servants and nothing else, and the distinction is load-bearing: the Vorpal Blade
is designed to be carried by a **Master** (*"If the Master with this Item Equipped cannot be
Underpowered by Servants"*), so a Master hitting it does not heal it even before the Blade's own
clause fires.

**R4 — The Vorpal Blade's anti-Jabberwock clause replaces the ×1.5, it does not stack with it.**
*"it receives **3x damage instead of** 50% extra damage due to having the 'Demonic' Attribute."*
Explicitly *instead of*, so 3× and not 4.5×.

**R5 — The Blade's three consequences fire together, once.** *"it receives 3x damage… **and** the
'Whenever the Jabberwock receives damage from Servants…' effect is **permanently removed**…
**then** the Vorpal Blade breaks and can no longer be used."* One attack: triple damage, lifesteal
gone for the rest of the game, Item destroyed. The removal is *permanent* and survives the
Jabberwock disappearing and being re-summoned — which matters, because §2 says its Stats persist.

**R6 — *"Summoning it counts as Nursery's Attack for the Turn"* applies to the Jabberwock's
summoning, not to the Jabberwock's attacks.** The monster then attacks on its own, once per Turn,
outside the budget. Otherwise the clause and `countsTowardBudget: false` would contradict each other.

**R7 — The Jabberwock's re-summon cooldown starts when it disappears, not when it is summoned.**
*"Cooldown: 5◈ Turns after the Jabberwock disappears."* `cooldown.countFrom: destroyed` — the field
Quetzalcoatl's mount already uses, whose comment records the defect it exists to prevent: *"the
mount may stand for twenty Turns and the clock has not begun."*

**R8 — *Alice Eater* extends the stay; it does not reset it.** *"extends its period of existing on
the board for 3◈ **more** Turns."* Additive to whatever remains.

---

## 4. The engine work

**Five changes**, and one of them is a single field.

### E1 — A fraction of an event's payload

*"its Health is restored by 75% of the damage received."*

`engine/scheduler.mjs#eventValue` already reads a number off the firing event — `@amount`,
`@stages` — and already supports negation. It has **no factor**, so *"75% of"* cannot be said.

```js
function eventValue(raw, event) {
  if (typeof raw === "number") return raw;
  if (typeof raw !== "string" || !raw.includes("@")) return null;
  const negate = raw.trim().startsWith("-");
  ...
}
```

A `factor` beside the existing negation, so `{key: StatDelta, stat: "health.value", delta: "@amount",
factor: 0.75}` says it. Van Gogh's *Channel Marker Soul* is the existing customer for the payload
itself; this is the first that wants a share of one.

### E2 — A permanent, targeted rule removal

*"the 'Whenever the Jabberwock receives damage from Servants…' effect is **permanently removed**
from the Jabberwock."*

The Jabberwock's lifesteal is a `passiveRule` on its own statblock, not an applied effect — so
`RemoveEffect` cannot reach it, and buff-removal is the wrong vocabulary besides: this is not a buff.

**DECISION.** A `Suppress` with `scope: <slug>` written onto the Jabberwock and read by
`contributionsOf`, so the rule is collected and then dropped. `Suppress` is the element that already
switches rules off by scope — Blind's clause 3 and Anastasia's Miss both use it — and the
*permanence* is that it is written to the **summoner's** `fieldSummonStats`, which is what already
carries a summon's state across a disappearance (§2).

### E3 — An Item that appears on the board

*"the `[Vorpal Blade]` Item appears on a random panel on the game board, this Item can be picked up
by a Unit walking onto its panel."*

Every Item in the corpus is granted to a unit (`itemGrant`). None has ever lain on the floor.

**DECISION.** A `Structure` carrying an `itemId`, placed by the existing `createStructure` phase, and
picked up by a movement hook when a unit stops on its panel. Structures are already placed objects
with panels, visibility rules and destruction rules (Bloodmark, Piedra Del Sol), so this is a new
*reader* on an existing object rather than a new kind of thing.

### E4 — An item that refuses particular holders

*"this Item cannot be obtained by Nursery or her Master."*

`acquisitionTarget` is the correct seam and its own docstring anticipates this exact day: *"the day a
drop or a reward is added, it asks this and inherits the redirect for free."* E3 is that day.

What it cannot do is refuse **this item** to **these units**. Its signature is `(unit, board)`, and
both of its refusals — `cannotHoldItems` and a failed `redirectToMaster` — are properties of the unit.
Pale Rider holds nothing at all; Nursery holds anything except one sword.

**DECISION.** A third parameter, `acquisitionTarget(unit, board, item)`, and a `barredFrom` list on
the item read against the candidate's **relationship to a named unit** rather than against unit ids
— *"Nursery or her Master"* is a role pair, and an id written into a content file would not survive
the Servant being placed twice. The parameter is optional, so the single existing caller is unchanged.

The refusal must land **at acquisition**, not in the pickup hook: a refusal written into E3's hook
is a refusal that a future second route — a trade, a reward — would not inherit, which is the whole
reason the seam exists.

### E5 — A summon that goes away on its own

*"When the Jabberwock is summoned, it disappears after 3◈ Turns."*

`expiresAt` is **already on the summon schema** — `module/data/actor/simple.mjs:37`, a nullable
integer tick — and the only thing in the codebase that reads it is the actor sheet, which displays
it. **Nothing writes it and nothing removes a summon when it passes.** That is the exact shape
Ch. 45 calls **Collected**: a rule that is right and inert, and this project's named dominant defect.

Every summon in the corpus until now leaves for a reason other than time. Bašmu goes when the
Hanging Gardens does; the Sphinxes and the Kagome Spirits go when their field closes; the Dragon
Tooth Warriors and Raikou's copies never go at all. The Jabberwock is the first with a **clock**.

**DECISION.** A `duration` on the summon spec, written to `expiresAt` at placement as an absolute
tick, and a reader in the round-end pass that dismisses every summon whose tick has passed. Absolute
rather than a countdown for the reason `data/regions.mjs` states twice about its own durations: *"a
countdown needs a hook that can fail to fire, and an expiry cannot."*

**Two other clauses hang off this one**, which is why it cannot be deferred:

- R7's `countFrom: destroyed` needs a moment the Jabberwock is *destroyed*. `engine/cooldown.mjs:61`
  already accepts the value and `engine/platforms.mjs#startDestroyedCooldown` already starts such a
  clock for a platform; the summon path has no equivalent because no summon has ever been destroyed
  on a schedule.
- R8's *Alice Eater* *"extends its period of existing on the board for 3◈ more Turns"* is `expiresAt
  += 3◈`, and there is nothing to add to until something sets it.

---

## 5. The clause inventory

~40 numbered goals.

### 5.1 Nursery Rhyme: Trump Soldiers — 14

| # | Clause | Verdict |
|---|---|---|
| T1 | Rank C, NP, `[Anti-Unit]`, **(Non-damaging)** | FREE — an ability with phases and no `damage` phase deals none |
| T2 | Used during your Turn | FREE |
| T3 | *"Roll an eight-sided die and add 4"* → 5–12 soldiers (R1) | FREE — `countRoll: "1d8+4"` |
| T4 | Summoned within a 2 panel area of herself | FREE — `placement` |
| T5–T10 | Trump Soldier statblock: Health 200, Agility 10, Luck 6, MOV 4, Range 2/1, BA(STR) 75 | CONTENT — one summon file |
| T11 | Do not count towards Units that Move and/or Attack | FREE — `countsTowardBudget: false` |
| T12 | The same Trump Soldier may Move/Attack once per Turn | FREE — `actsOncePerTurn: true` |
| T13 | Enemies cannot Attack Nursery or her Master if a Trump Soldier is next to them | FREE — `TargetingModifier {mode: protectSummoner}` on the summon |
| T14 | Counts as Nursery's Attack for the Turn; cooldown ⅓◈ **per soldier** | FREE — `countsAsAttack`, `cooldown.perUnit` |

**Trump Soldiers costs one statblock and one ability file.** Medea built it.

### 5.2 Nursery Rhyme: Jabberwock — 18

| # | Clause | Verdict |
|---|---|---|
| J1 | Rank C, NP, `[Anti-Unit]`, **(Non-damaging)** | FREE |
| J2 | Summoned on a panel **next to her** | FREE — `placement` at radius 1 |
| J3–J8 | Statblock: Health 1500, Agility 6, Luck 6, MOV 3, Range 2/1, BA(STR) 200 | CONTENT |
| J9 | Attributes: **Demonic**, **Giant** | CONTENT — `Giant ⟹ Large` is an existing implication (Asterios) |
| J10 | Disappears after 3◈ Turns | **ENGINE — E5** — `expiresAt` exists and nothing reads it |
| J11 | On its **first** summon, `[Vorpal Blade]` appears on a random panel | **ENGINE — E3** |
| J12 | May Move to **any** panel; occupants are knocked back 1 | FREE — `movesOntoOccupiedPanels` + `Knockback` |
| J13 | Heals 75% of damage received **from Servants** (R2, R3) | **ENGINE — E1** |
| J14 | *Alice Eater*: `Atk Up` 1◈ at +50% / NP +25% | CONTENT |
| J15 | *Alice Eater*: extends its stay by 3◈ **more** (R8); cooldown 4◈ | **ENGINE — E5** |
| J16 | Does not count towards Units that Move/Attack; once per Turn | FREE |
| J17 | Enemies cannot Attack Nursery or her Master if it is next to them; summoning counts as her Attack (R6) | FREE — `TargetingModifier {mode: protectSummoner}` |
| J18 | Re-summoned with the Stats it had when it disappeared; cooldown 5◈ **after it disappears** (R7) | `fieldSummonStats` is built; the **moment** it disappears is **ENGINE — E5** |

### 5.3 `[Vorpal Blade]` — 8

| # | Clause | Verdict |
|---|---|---|
| B1 | When Equipped, BA(STR) +50 | CONTENT |
| B2 | …but Range is reduced **to** 1 panel | CONTENT — an absolute, not a delta |
| B3 | Normal Attack damage to `Demonic` Units +50% | CONTENT |
| B4 | The above do **not** affect NP or Attacks *Categorized as NP* | CONTENT |
| B5 | Normal Attacks with it Equipped use BA(STR) | CONTENT |
| B6 | A Master holding it cannot be Underpowered by Servants | CONTENT — §16.5's `Underpower` |
| B7 | Against the Jabberwock: **3× instead of** the ×1.5 (R4); lifesteal **permanently** removed; the Blade breaks (R5) | **ENGINE — E2** |
| B8 | Cannot be obtained by Nursery or her Master | **ENGINE — E4** |

**Tally: ~21 FREE, ~12 CONTENT, 7 ENGINE.**

---

## 6. The content

**Six new files, and one modified.**

- `packs/_source/summons/trump-soldier.yml`
- `packs/_source/summons/jabberwock.yml` — carrying *Alice Eater* as its own ability ref
- `packs/_source/abilities/jabberwock-alice-eater.yml`
- `packs/_source/abilities/nursery-trump-soldiers.yml`
- `packs/_source/abilities/nursery-jabberwock.yml`
- `packs/_source/abilities/vorpal-blade.yml` — Items live in `abilities/` and are distinguished by
  `kind: item`, not by directory. `semiramis-poison.yml` is the precedent.

**Modified** — `nursery-rhyme.yml` gains two ability refs.

---

## 7. Verification

**Unit and golden tests:** `1d8+4` producing 5–12 and never 4 or 13 (R1); a Trump Soldier's
`TargetingModifier {mode: protectSummoner}` making Nursery un-attackable while it stands adjacent,
and attackable when it does not; the Jabberwock healing **75% of what landed** rather than of what was rolled (R2), and
**not** healing from a Master (R3); the Blade dealing **3×** and not 4.5× (R4); the lifesteal
suppression surviving a disappear-and-re-summon (R5); and *Alice Eater* adding 3◈ to a stay with 1◈
left, giving 4◈ rather than 3◈ (R8).

**The live board:** a Trump Soldier swarm appearing at a rolled count; an enemy finding Nursery
un-targetable behind them; the Jabberwock walking onto an occupied panel and knocking its occupant
back; its Health *rising* when a Servant hits it; the Vorpal Blade lying on a panel and being picked
up by walking onto it — and **refused** to Nursery's Master; and the Blade's one attack taking the
monster's lifesteal away for good.

---

## 8. Risks

**The Jabberwock is the strongest summon in either roster** — 1500 Health, BA(STR) 200, and healing
75% of everything a Servant does to it. If E1's factor is wrong in the *other* direction (say, a
missing factor reading as 1.0), it heals for **everything** and becomes unkillable. The test must
assert the exact figure, not merely that Health rose.

**E2's permanence is the subtle half.** A suppression that lives on the summon dies with the summon,
and the Jabberwock comes back with the Stats it had. The suppression must ride `fieldSummonStats`
home or the Blade's sacrifice is undone by the next summon — which is precisely the interaction the
sheet spends a sentence on.

**E3 puts a takeable object on the floor for the first time.** Every Item route today ends at a unit.
The refusal for Nursery and her Master must be enforced at the *pickup*, not merely hidden in the UI,
or the strongest counter to her own monster becomes hers.

**E5 was nearly missed, and the miss would have been invisible.** `expiresAt` is on the schema, so
writing `duration: "3◈"` into the summon spec and watching it land on the document would have looked
like success — and the Jabberwock would have stood on the board forever, its re-summon cooldown never
starting, *Alice Eater*'s extension adding to a number nobody read. **The verification for J10 is a
Jabberwock that is gone**, not a field that holds the right figure.

**Part 2 depends on Part 1 and must not assume Parts 3–4.** Her Servant file gains two refs here and
two more later.
