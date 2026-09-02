# Master rank, and painting a bounded field — design

**Date:** 2026-09-02
**Chapters affected:** [04 — Units](../../04-units.md), [06 — Stats and Resources](../../06-stats-and-resources.md),
[15 — Abilities](../../15-abilities.md), [16 — Relationships](../../16-relationships.md),
[17 — Command Spells](../../17-command-spells.md), [28 — Targeting Implementation](../../28-targeting-implementation.md),
[43 — Bounded Fields](../../43-bounded-fields.md), [45 — Implementation Status](../../45-implementation-status.md)

---

## 1. The problem

Two requests, and both turn out to be finishing something rather than starting it.

### 1.1 Masters have a rank that is read wrongly and cannot say "Rankless"

`MasterData.rank` already exists — a free-form `StringField` — and two separate copies of the
same function parse it as a Servant grade:

```js
// duplicated verbatim in rules/costs.mjs:281 AND rules/command-spells.mjs:338
const HIGH_RANK_MASTER = Object.freeze(["A", "B"]);

function isHighRankMaster(master) {
  const rank = Rank.parseOrNull(master?.rank ?? null);
  if (!rank) return true;                       // ← unset ⇒ HIGH
  return HIGH_RANK_MASTER.includes(rank.grade);
}
```

Three problems in nine lines:

1. **`if (!rank) return true`.** Every Master in a live world has `rank: ""`, so every Master
   silently takes the *cheap* column on Command Spells and Noble Phantasm Master-Health costs.
2. **"Rankless" is unrepresentable.** Ch. 17 gives it a rule of its own — *"If all Masters are
   Rankless, the Kill Yourself command only costs one Command Spell"* — and the current shape
   has nowhere to put it.
3. **The list is duplicated**, so the two readers can drift.

And the rank's three stated benefits (Ch. 04 §4.5, Ch. 16) are **all unwired**:

| Grant | Status |
|---|---|
| `ZON +1` | `rules/zon.mjs#zonRadius` has no rank term at all. The formula comment at `zon.mjs:53` lists `+ highRankMaster // stacks`; the code never adds it. |
| `Sustainability +1◈` while alive | No term anywhere in `rules/relationships.mjs`. |
| A free `+` to one Servant parameter | `masterGrants` is an argument the *caller* hands `prepareSummon`; nothing derives it from the contracting Master's rank. |

So the rank exists, is misread, cannot express a third of its own vocabulary, and none of its
effects fire.

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
```

Both existing copies of `isHighRankMaster` are **deleted** and their callers import from here.
That removes the duplication and the `if (!rank) return true` defect in one move.

### 2.2 What Rankless costs — read from the rules, not invented

The two prices are different questions and must not share a predicate:

| Rule | Source | Predicate |
|---|---|---|
| Noble Phantasm Master-Health cost | Ch. 15 §15.4: *"Rankless Masters use the left column"* | `tierOf(m) !== "low"` — High **and** Rankless take the High column |
| Kill Yourself Command Spell cost | Ch. 17: 1 for High, 2 for Low, *"if **all** Masters are Rankless … only one"* | `isHighRank(m)`, plus a board-wide `everyMasterRankless(board)` |

Writing both as `isHighRank` would make Rankless Masters pay the Low NP price, which the rules
explicitly deny.

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

- **Sheet.** A rank selector on the Master's details tab (`templates/actor/details.hbs`), four
  grades plus a blank meaning Rankless, with `masterContext` projecting the derived tier beside
  it so the sheet shows both the letter and what it buys.
- **Setup.** `rules/setup-rolls.mjs#masterSetupPlan`'s `coinFlip` mode (Ch. 14 §14.9) writes
  `A` on Heads and `C` on Tails; the no-essence mode leaves `null`, which is the rulebook's
  *"all Masters have Base Attack (MAG)=100"* case.
- **Snapshot.** `rules/snapshot.mjs` projects `masterTier` onto a Master's unit snapshot, and
  `rules/options.mjs` emits `self:masterTier:<t>` / `target:masterTier:<t>` so content can
  predicate on it.
- **Jack's Mist.** The `kinds: [master]` contact clause gains
  `exemptIf: { masterTier: high }`, closing the Advanced Note left unmodelled when she was
  built. `rules/bounded-fields.mjs#isExempt` grows one branch beside `categorizedAs`.

### 2.5 Migration

Every Master in an existing world has `rank: ""`, which reads as High today and as **Rankless**
afterwards. Consequences:

- Noble Phantasm cost: **unchanged** (Rankless uses the High column).
- Kill Yourself: unchanged in a world where no Master has a rank (all Rankless ⇒ 1 spell). It
  changes only at a **mixed** table, which cannot exist today because the field is unset
  everywhere.

No migration script. The change is a no-op on a world nobody has ranked, and the first GM to set
a rank is opting in deliberately.

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
| NP cost: Rankless takes the **left** column; Low the right | Kill Yourself at 1 / 2 / 1-when-all-Rankless |
| `everyMasterRankless` with mixed and empty boards | — |
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
2. **Master rank**: schema, `tierOf`, de-duplication, sheet selector, setup coin flip.
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
- **Out of scope, and staying out.** The two clauses left unmodelled when Jack was built — her
  *Information Erasure* passive (it erases a player's notebook, which is not game state) and *The
  Mist*'s Fog of War exemption (there is no Fog of War subsystem) — are untouched by this work and
  remain documented as unmodelled.
