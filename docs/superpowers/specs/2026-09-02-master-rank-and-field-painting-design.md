# Master rank, and painting a bounded field — design

**Date:** 2026-09-02
**Chapters affected:** [04 — Units](../../04-units.md), [06 — Stats and Resources](../../06-stats-and-resources.md),
[15 — Abilities](../../15-abilities.md), [16 — Relationships](../../16-relationships.md),
[17 — Command Spells](../../17-command-spells.md), [28 — Targeting Implementation](../../28-targeting-implementation.md),
[43 — Bounded Fields](../../43-bounded-fields.md), [45 — Implementation Status](../../45-implementation-status.md)

---

## 1. The problem

Two requests, and both turn out to be finishing something rather than starting it.

### 1.1 A Master's rank cannot be set, and the one thing that determines it throws it away

**What already works, and must not be "fixed".** `MasterData.rank` exists, and the *pricing* that
reads it is correct. Both `rules/costs.mjs:281` and `rules/command-spells.mjs:338` treat an unset
rank as High Rank, deliberately and with the reasoning written above them:

> *"A rankless Master pays the **left** column — the cheaper one. That reads backwards until you
> notice it is the default rather than a reward: the right column is the penalty a Low Rank
> Master carries."*

That is Ch. 15 §15.4 (*"Rankless Masters use the left column"*) implemented exactly. Ch. 17's
all-Rankless Kill Yourself rule is implemented too: `engine/command-spells.mjs:143` computes
`allMastersRankless(board)`, `rules/command-spells.mjs#costOf` honours it, and
`test/unit/command-spells.test.mjs:80` covers it. **Rankless is already representable and already
priced correctly.** None of this changes.

What is missing is everything *upstream* and *downstream* of that:

1. **Nothing can set the rank.** It is a free-form `StringField` with no `choices` and **no
   control on the Master sheet anywhere** — the only way to give a Master a rank is to hand-edit
   the document. A typo (`"high"`, `"Rank A"`) parses to `null` and silently reads as Rankless.
2. **The coin flip determines the rank and then discards it.** `rules/setup-rolls.mjs`'s
   `coinFlip` mode implements Ch. 14 §14.9 — *"Heads=High Rank, Tails=Low Rank"* — as a `1d2`
   mapped to `[125, 100]`, with the comment *"The coin picks the **value**, because the rank
   exists here only to select it."* It does not: the rank also decides ZON, Sustainability, the
   parameter grant, the Kill Yourself price and (once Jack exists) whether the Mist poisons you.
   So a table that flips Heads gets a Master with `Base Attack (MAG) 125` who is **Rankless for
   every other rule in the game**.
3. **The list is duplicated** across the two cost readers, so they can drift. Minor, but free to
   fix while the module exists.

And the rank's three stated benefits (Ch. 04 §4.5, Ch. 16) are **all unwired**:

| Grant | Status |
|---|---|
| `ZON +1` | `rules/zon.mjs#zonRadius` has no rank term at all. The formula comment at `zon.mjs:53` lists `+ highRankMaster // stacks`; the code never adds it. |
| `Sustainability +1◈` while alive | No term anywhere in `rules/relationships.mjs`. |
| A free `+` to one Servant parameter | `masterGrants` is an argument the *caller* hands `prepareSummon`; nothing derives it from the contracting Master's rank. |

So the rank is priced correctly and is otherwise inert: unsettable from the interface, thrown
away by the roll that decides it, and buying none of the three things it is supposed to buy.

### 1.2 A freeform field cannot be reshaped, and would not survive it if it could

Jack the Ripper's *The Mist* opens at its largest legal footprint and keeps it. Her sheet gives
her more:

> *"During Jack's Turn or at the end of any Turn Jack Acts, she can Move the Mist and/or change
> the shape of the Mist once, as long as it stays within the stated Range (4 panels). Does not
> count as Moving a Unit and is not an Attack. Note: Jack does not need to be within the Mist."*

Ch. 43 has called this "targeting mode E" since it was written and lists the paint tool as not
built.

**There is a defect underneath it.** `engine/fields.mjs#shapeOf` builds a field's Region as the
**bounding rectangle** of its panels:

```js
return { type: "rectangle", x: left * size, y: top * size,
         width: (maxJ - left + 1) * size, height: (maxI - top + 1) * size };
```

…while `engine/board.mjs#boundedFieldsOf` reads the panels back **off the Region**
(`panelsOfRegion`). The stored `field.panels` are therefore discarded on the way out and
replaced by the rectangle's. This is invisible today only because every field in the corpus is a
square, where the bounding box and the panel set are the same set. Paint one L-shape and the
board fills in the notch.

`apps/canvas/target-region.mjs#gridShape` already does it correctly — `{type: "grid", offsets,
origin: null}` — and `panelsOfRegion` prefers `getOccupiedGridSpaceOffsets()`, which enumerates a
grid shape exactly. So the fix exists in the codebase already; fields simply do not use it.

---

## 2. Master rank

### 2.1 Data model

The letter stays and gains a vocabulary; the tier is derived. Chosen over replacing the letter
with a three-value enum because the grade is what a character sheet prints, and over storing
both because two fields that can disagree would disagree silently — nothing in the rules reads
the letter directly.

```js
// module/data/actor/master.mjs
rank: new fields.StringField({
  required: false, nullable: true, initial: null,
  choices: ["A", "B", "C", "D"],       // null ⇒ Rankless
}),
```

One derivation, in one new pure module (layer 2):

```js
// module/rules/master-rank.mjs
export const HIGH_GRADES = Object.freeze(["A", "B"]);

/** @returns {"high"|"low"|"rankless"} */
export function tierOf(master) {
  const rank = Rank.parseOrNull(master?.rank ?? null);
  if (!rank) return "rankless";
  return HIGH_GRADES.includes(rank.grade) ? "high" : "low";
}

export const isHighRank = (master) => tierOf(master) === "high";
export const isRankless = (master) => tierOf(master) === "rankless";

/**
 * Whether this Master pays the LEFT (cheap) column. High and Rankless both do
 * — Ch. 15 §15.4, and the right column is the Low Rank penalty rather than the
 * default. This is the existing `isHighRankMaster` behaviour, unchanged.
 */
export const paysHighColumn = (master) => tierOf(master) !== "low";
```

Both existing copies of `isHighRankMaster` are **deleted** and their callers import
`paysHighColumn` from here. This is a pure de-duplication: the behaviour is already right in both
places and must not change.

### 2.2 The two prices — already correct, and staying that way

This is the part of the system that works, recorded so the implementer does not "fix" it:

| Rule | Source | Predicate | Status |
|---|---|---|---|
| Noble Phantasm Master-Health cost | Ch. 15 §15.4: *"Rankless Masters use the left column"* | `paysHighColumn(m)` — `tierOf(m) !== "low"`, so High **and** Rankless take the High column | **Correct today** |
| Kill Yourself Command Spell cost | Ch. 17: 1 for High, 2 for Low, *"if **all** Masters are Rankless … only one"* | `paysHighColumn(m)`, plus the board-wide `allMastersRankless(board)` already computed in `engine/command-spells.mjs:143` | **Correct today, and tested** |

Both readers keep their exact current behaviour; only the function they call moves. The
regression tests in §4 exist to prove the de-duplication changed nothing, not to fix anything.

`tierOf` is what the *new* consumers (the three grants, the sheet, the Mist) need, and
`paysHighColumn` is what the two existing ones need. They are different questions — a Rankless
Master pays the High price but does not get a High Master's ZON — so they are two functions and
not one.

### 2.3 The three grants, wired

- **`ZON +1`** — `rules/zon.mjs#zonRadius` gains a term for a High Rank Master. It is a
  **stacking** bonus added to `derived` (per the formula comment at `zon.mjs:53` and Ch. 06
  §6.9), *not* folded into the `Math.max(derived, master.zon)` floor: the floor exists so a
  Master sheet that states a ZON is believed, and a rank bonus is a different thing from a
  stated number.
- **`Sustainability +1◈` while alive** — `rules/relationships.mjs`, conditional on the Master
  being alive, so it lapses at the same instant the Free-Servant clock starts.
- **The parameter grant** — the summon dialog already offers the *choice*
  (`apps/summon-dialog.mjs`'s `grantRows`, one free-form number per parameter). What is missing
  is the **entitlement**: nothing says how many steps the Master may grant, so a GM can type any
  number into any row and `prepareSummon` will honour it. `rules/master-rank.mjs` gains
  `grantBudget(master)` — `1` for High Rank, `0` otherwise — and the dialog spends against it,
  refusing a total that exceeds it. The choice of *which* parameter stays the player's; only the
  size of the allowance becomes a rule.

### 2.4 Reach

- **Sheet.** There is **no rank control anywhere today**. One goes on the Master's details tab
  (`templates/actor/details.hbs`): a `<select>` of the four grades plus a blank meaning Rankless,
  with `masterContext` projecting the derived tier beside it so the sheet shows both the letter
  and what it buys.
- **Setup — the coin flip keeps its answer.** `rules/setup-rolls.mjs`'s `coinFlip` mode currently
  maps `1d2` straight onto `[125, 100]` and discards which side came up. It gains a `rank` line
  carrying `A` on Heads and `C` on Tails, and `engine/summon.mjs#rollMasterSetup` writes it to
  `system.rank`. Base Attack (MAG) is then **derived from that rank** rather than rolled
  separately, so the two can no longer disagree — a Master with 125 and no rank becomes
  unrepresentable. The `rankless` mode leaves `rank: null`, which is the rulebook's *"all Masters
  have Base Attack (MAG)=100"* case, and `essences` keeps reading the rank off the sheet.
- **Snapshot.** `rules/snapshot.mjs` projects `masterTier` onto a Master's unit snapshot, and
  `rules/options.mjs` emits `self:masterTier:<t>` / `target:masterTier:<t>` so content can
  predicate on it.
- **Jack's Mist.** The `kinds: [master]` contact clause gains
  `exemptIf: { masterTier: high }`, closing the Advanced Note left unmodelled when she was
  built. `rules/bounded-fields.mjs#isExempt` grows one branch beside `categorizedAs`.

### 2.5 Migration

**None needed, and nothing silently changes price.** Every Master in an existing world has
`rank: ""`, which reads as Rankless before this work and as Rankless after it — the `choices`
list accepts `null`, and `""` parses to `null` exactly as it does today. Both prices are computed
by the same predicate as before, only imported from a different file.

What *does* change for an existing world is that a Master who was never ranked now gains no ZON,
no Sustainability and no parameter grant — which is already true, because none of those are
wired. So the first GM to set a rank is opting in deliberately, and everyone else sees no
difference.

The one number that moves is on **new** summons in `coinFlip` mode, where Base Attack (MAG)
becomes derived from the recorded rank rather than rolled independently. Same two values, same
coin, now with the rank kept.

---

## 3. Painting a bounded field

### 3.1 Prerequisite: make the round-trip lossless

`engine/fields.mjs#shapeOf` returns a **grid** shape rather than a bounding rectangle, matching
what `target-region.mjs#gridShape` already produces for transient targeting areas. This must land
**before** the painter, or the painter's output is silently squared off on the next board read.

Existing fields (Sikera Ušum, Chaos Labyrinthos, The Mist) are all squares, so their panel sets
do not move — but their Regions change representation, and the plan verifies each still reads
back the same panels.

### 3.2 Mode E

`TargetingLayer` already documents four interaction modes and owns `#drawPanels`,
`showArea`/`discardArea`, `announce` and `#confirm`. The painter is a fifth mode, reached by a
new entry point beside `pick()`:

```js
paintPanels({ anchor, maxPanels, maxDistance, initial }) -> Promise<Panel[]|null>
```

- `_onDragLeftStart` / `_onDragLeftMove` / `_onDragLeftDrop` paint; `_onClickLeft` toggles one
  panel; holding `shift` erases.
- Legality is **drawn, not enforced after the fact**: a panel outside `maxDistance` of the
  anchor renders in the existing `ILLEGAL` tint and refuses paint. A live `n/maxPanels` counter
  sits in the `TargetingHUD`; at the cap, unpainted panels also go illegal.
- Returns the panel array, or `null` on cancel — the same contract `pick()` already has.

**The layer draws and never decides.** That is the file's own stated contract, and the painter is
not the exception: the rules half is a new pure function

```js
// module/rules/bounded-fields.mjs
legalRepaint(field, panels, anchorPanel) -> {ok: boolean, reason?: string}
```

checked again on the GM side at commit, so a hand-crafted socket payload cannot draw a
40-panel Mist across the board.

Beside it, the gate that decides whether the control is offered at all:

```js
// module/rules/bounded-fields.mjs
mayReshape(field, unit) -> boolean
```

`true` when the field declares `geometry.kind: "freeform"`, `unit.id === field.ownerId`, and the
unit has not already spent its repaint this Turn (`turnState.reshapedField`). It is the sibling
of `mayDeactivate`, which the field switch on the token HUD already uses, and it lives in the
rules layer for the same reason: the HUD asks, and never decides.

### 3.3 Committing a repaint

```js
// module/engine/fields.mjs
repaintField(fieldId, panels) -> Promise<boolean>
```

Validates with `legalRepaint` against the field's own `maxPanels`/`maxDistance` and the owner's
**current** panel, then updates the Region's grid shape and the behaviour's `system.panels`
together.

Nothing else moves: the field keeps its id, its interior rules, its `createdAt` and its upkeep
clock. This is why a repaint must not be "close it and cast it again" — that would restart the
upkeep period and fire the NP's `countFrom: "deactivation"` cooldown.

Contact fires for whoever the **new** footprint closes over and not for anyone the old one
already covered, reusing the entry set `runContactEvents` takes. Painting the fog onto an enemy
Master poisons him; painting it off and back on next turn poisons him again — which is what
"upon contact" means.

### 3.4 The two windows and the once-per-turn gate

A new `turnState.reshapedField: boolean`, cleared by the same tick-stamped staleness rule as the
rest of that schema, so a hook that fails to fire cannot lock the ability out for the match.

*"Does not count as Moving a Unit and is not an Attack"* means the repaint writes **only** that
flag — never `moved`, `attacked` or `acted`.

- **During her Turn.** A HUD button beside the field switch, gated on `mayReshape(field, actor)`.
- **At the end of any Turn she Acts.** A prompt from the scheduler's existing `actedTurnEnd`
  pass — the same boundary the Mist's own poison clause uses — offered only to a unit whose
  `acted` is set, which is exactly the sheet's wording.

*"Jack does not need to be within the Mist"* needs no rule: the leash is measured from her token
to each panel, never from the fog to her.

---

## 4. Testing

| Pure (vitest) | Live (`fgt2026`) |
|---|---|
| `tierOf` over `A`/`B`/`C`/`D`/`null`/`""`/junk | Sheet selector writes; derived tier follows |
| **Regression:** NP cost and Kill Yourself price are byte-identical before and after the de-duplication, for all of High/Low/Rankless | Kill Yourself at 1 / 2 / 1-when-all-Rankless, unchanged |
| `coinFlip` mode emits a `rank` line, and Base Attack (MAG) derives from it | A coin-flip summon leaves a Master with a rank on the sheet |
| ZON +1 stacks onto `derived`, not the `Math.max` floor | A High Rank Master's Servant stays in ZON one panel further out |
| Sustainability +1◈ while alive; gone when dead | The bonus lapses on the Master's death |
| `legalRepaint`: over cap, outside leash, empty set, non-contiguous | Paint an L; the board reads an L |
| `shapeOf` round-trip on a **non-rectangular** fixture | Repaint preserves id, `createdAt`, upkeep clock |
| `isExempt` with `masterTier` | A High Rank Master walks into the Mist unpoisoned |

The round-trip test matters most, because it is the defect that hides: it passes today by
coincidence and would keep passing forever if its fixture were a rectangle.

---

## 5. Sequencing

Four commits, each leaving the system working:

1. **`shapeOf` → grid shape**, with the non-rectangular round-trip test. A standalone bug fix,
   worth having whether or not anything is ever painted.
2. **Master rank**: schema `choices`, `tierOf`/`paysHighColumn`, de-duplication (behaviour-
   preserving, proved by regression tests), sheet selector, and the coin flip keeping its answer.
3. **The three grants**, plus Jack's Mist `exemptIf: { masterTier: high }`.
4. **The painter**: mode E, `legalRepaint`, `repaintField`, HUD button, end-of-turn prompt.

2 and 3 could merge. Splitting them lands the data-model change without also moving anyone's ZON
in the same commit, which makes a surprising number easy to bisect.

---

## 6. Risks

- **Drag-painting is the least testable thing here.** Pointer capture, drag-versus-click
  disambiguation and cancel-mid-drag are where canvas bugs live, and a headless harness cannot
  drive a real pointer. The plan drives the layer's own handlers and screenshots the result, but
  a human should drag it once before this is called done.
- **The rectangle fix rewrites existing Regions.** Verify Sikera Ušum and Chaos Labyrinthos read
  back identical panel sets afterwards.
- **`turnState.reshapedField` is a seventh boolean on an already-wide schema.** Correct now; if a
  second ability ever wants a once-per-turn action, that schema should become a set of used-action
  keys rather than growing an eighth flag.
- **The pricing readers are correct and must not be "improved".** The first draft of this spec
  called `if (!rank) return true` a defect; it is the rule, documented above both copies. The
  de-duplication in commit 2 is behaviour-preserving and its tests exist to prove exactly that.
  An implementer who "fixes" Rankless to pay the Low column has broken Ch. 15 §15.4.
- **Out of scope, and staying out.** The two clauses left unmodelled when Jack was built — her
  *Information Erasure* passive (it erases a player's notebook, which is not game state) and *The
  Mist*'s Fog of War exemption (there is no Fog of War subsystem) — are untouched by this work and
  remain documented as unmodelled.
