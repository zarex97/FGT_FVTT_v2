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
| *"Cannot be obtained by Nursery or her Master"* | `acquisitionTarget` — the seam Pale Rider's item redirect needed, and *"every route by which a unit comes to hold one passes it first."* |

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

**Three changes**, and one of them is a single field.

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

*"Cannot be obtained by Nursery or her Master"* is `acquisitionTarget`, which every acquisition route
already passes through — so the pickup hook inherits the refusal rather than restating it.

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
| J10 | Disappears after 3◈ Turns | CONTENT |
| J11 | On its **first** summon, `[Vorpal Blade]` appears on a random panel | **ENGINE — E3** |
| J12 | May Move to **any** panel; occupants are knocked back 1 | FREE — `movesOntoOccupiedPanels` + `Knockback` |
| J13 | Heals 75% of damage received **from Servants** (R2, R3) | **ENGINE — E1** |
| J14 | *Alice Eater*: `Atk Up` 1◈ at +50% / NP +25% | CONTENT |
| J15 | *Alice Eater*: extends its stay by 3◈ **more** (R8); cooldown 4◈ | CONTENT |
| J16 | Does not count towards Units that Move/Attack; once per Turn | FREE |
| J17 | Enemies cannot Attack Nursery or her Master if it is next to them; summoning counts as her Attack (R6) | FREE — `TargetingModifier {mode: protectSummoner}` |
| J18 | Re-summoned with the Stats it had when it disappeared; cooldown 5◈ **after it disappears** (R7) | FREE — `fieldSummonStats`, `countFrom: destroyed` |

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
| B8 | Cannot be obtained by Nursery or her Master | FREE — `acquisitionTarget` |

**Tally: ~24 FREE, ~13 CONTENT, 3 ENGINE.**

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
`RelationshipProxy` making Nursery un-attackable while it stands adjacent, and attackable when it
does not; the Jabberwock healing **75% of what landed** rather than of what was rolled (R2), and
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

**Part 2 depends on Part 1 and must not assume Parts 3–4.** Her Servant file gains two refs here and
two more later.
