# Quetzalcoatl — Design

**Source:** `char_orig_sheets/Copia de Quetzalcoatl.md`
**Chapters:** `docs/D-servant-data-sheets.md` §D.28, `docs/44-case-expanded-roster.md` §44.2,
`docs/43-bounded-fields.md` §43.10, `docs/20-platforms-and-levels.md` §20.7, `docs/42-terrain.md`

She is the acceptance test for **the field**. Karna is the benchmark for predicates, Kingprotea
for stack economies and Achilles for gating; Quetzalcoatl is the first Servant whose sheet is
mostly about *the panels themselves* — three separate routes to changing what ground a unit is
standing on, a mount that substitutes her whole action set, and a levitating object that shares a
panel with whoever walks under it.

Her ten entries need **seven mechanisms that do not exist**, and §D.28 already predicted six of
them. The seventh — panel sharing — is the one the chapters missed.

---

## 1. Statline

```
Rider · Central & South America · Lawful Good
STR B  END B  AGI B+  MAG EX  LUC A+
Attributes: Female, Servant, King, [Sky], Humanoid
Base Health 1250 · MOV 7 · Range 2/1
BA(STR) 125 · BA(MAG) 250 · Sustainability 2◈
```

Every figure reproduces from `domain/tables.mjs`: `B → 125` and `B → 1250`, `EX → 250`. She is
the **highest BA(MAG) in either roster** and the first `MAG: EX` outside Mannanán (§D.28), which
is what makes Xiuhcoatl's combined base attack land at 250 with only *half* her MAG in it.

`LUC A+` puts her in the four-Servant band (with Drake, Semiramis and Ozymandias) that succeeds on
its own Luck checks unconditionally and imposes the penalty on everyone contesting her
(`docs/14-checks-and-randomness.md`, `docs/C-dice-registry.md`). Nothing new is needed; the band
already exists.

---

## 2. What is already built

Recorded first, because it is most of her and it is the part that must **not** grow new code.

| Sheet entry | Reuses |
|---|---|
| Riding EX | `class-skills/riding.yml` **unchanged**, `rank: EX`, `cooldown: 3◈` |
| Magic Resistance A | `class-skills/magic-resistance.yml` **unchanged**, `rank: A` |
| Goddess's Divine Core EX | `divineCore` table → `EX = 120`; Kingprotea's file is the shape |
| Charisma / Wisdom / Lucha Libre | ordinary `applyEffects` + `cooldown` phases |
| The mount's three AoE tiers | `rules/platforms.mjs#aoePassengerFactor`, already per-role |
| Piedra Del Sol's upkeep + deactivation | `NPFieldBehavior.upkeep` / `.deactivation`, Jack's Mist |
| `Guts`, `Atk Up`, `S.Crit Up`, `Crit Up`, `Crit DmUp`, `NP Seal`, `Burn`, `Shock`, `Slow` | authored |

Her Riding text and her Magic Resistance text are **verbatim** the shared class documents,
including MR's Instakill/Death/Erase paragraph. `ridingMov` already gives `EX → 6` and
`ridingCooldown` already bands `EX → 3◈`; `magicResistancePercent` gives `A → 50%` and
`magicResistanceDebuffResist` gives `A → 25%`. Four numbers her sheet prints, none authored.

**Two effects are missing.** `Sol` has a catalogue row (`docs/A-effect-catalogue.md` §A.17.1) and
no document. `Sap` is worse: `engine/scheduler.mjs:1267` has carried its damage-over-time entry
since the scheduler was written and **no effect document has ever existed to carry it**, so any
sheet that inflicts Sap has been inflicting nothing. Ehecatle is what finally notices.

---

## 3. Panel sharing — the mechanism the chapters missed

> *"the panel occupied by Piedra Del Sol can still be Moved onto (replace the Piedra Del Sol on
> top of any Units which Move onto that panel)"*
>
> *"[the Quetzalcoatlus] can Move onto occupied panels (place the Quetzalcoatlus on top of
> anything occupying said panels)"*

The engine has **one** occupancy exception today, and it is the wrong one.
`rules/movement.mjs#ignoresBlocking` (via `GRANTS.ignoresOccupancy` and the
`movesOntoOccupiedPanels` flag) is Bašmu's and Kingprotea's: *"all Units occupying said panels
will be knocked back"*. It **displaces**. Quetzalcoatl's two objects do not displace anybody;
they co-locate.

**Corrected while planning: half of this already works.** `canPassThrough` (`movement.mjs:308`)
and `canStopOn` (`:351`) already exempt `platform` and `structure` occupants, so an ordinary
Servant can walk onto Piedra Del Sol's panel today. Two things are actually missing, and they are
both narrower than this section first claimed:

1. **The mover side.** `canStopOn` asks `ignoresBlocking(unit)` of the *mover*, so the
   Quetzalcoatlus cannot land on a Servant.
2. **Structure-vs-structure.** Because objects are unconditionally non-blocking, two Bloodmarks
   may already share a panel. They must not.

So a second, distinct capability:

```yaml
sharesPanel: true
```

| | `ignoresOccupancy` | `sharesPanel` |
|---|---|---|
| May enter an occupied panel | yes | yes |
| What happens to the occupant | knocked back | nothing; both stand there |
| Blocks others from entering | yes | no |
| Carried by | Bašmu, Kingprotea | Quetzalcoatlus, Piedra Del Sol |

**The rule, as approved:**

```js
// rules/movement.mjs
function blockersAt(panel, board, level, mover) {
  const here = occupantsAt(panel, board, level);
  // A sharing unit is invisible to everyone else's occupancy check.
  if (!mover?.sharesPanel) return here.filter((u) => !u.sharesPanel);
  // A sharing unit is itself stopped only by another STRUCTURE — two figurines
  // cannot stand on the same square, but a figurine and a Servant can.
  return here.filter((u) => u.kind === "structure");
}
```

`occupantAt` keeps its current meaning and its current callers; `canStopOn` and `canPassThrough`
move to `blockersAt`. `engine/summoning.mjs`'s free-panel search treats a sharing unit's panel as
free. Bloodmark does **not** get the flag, so Medusa's behaviour and
`test/unit/bloodmarks.test.mjs` are untouched.

**Rendering.** Two tokens on one grid square is a Foundry display question, not a rules one.
`engine/token-footprint.mjs` already owns placement; a sharing token takes a raised `sort` so it
draws above, which is literally what both sheets ask for (*"place ... on top of"*).

---

## 4. Terrain gets a writer

`rules/terrain.mjs` is complete, tested (24 tests) and **read-only**. `board.terrain.areas` is
populated exclusively from a scene's hand-placed `fgt.terrain` Regions
(`engine/board.mjs#terrainAreasOf`), and `terrainConversions` — the function that answers *"what
terrain does this attack create"* — **has no caller anywhere in the codebase**. Ch. 42 is a read
system with no write half.

Quetzalcoatl needs three writes, which is why she is the one who builds it.

### 4.1 `engine/terrain.mjs` (new, layer 3)

```js
export async function paintTerrain({ types, panels, duration, sourceUnitId, followsSource, tag })
export async function clearTerrain(tag)        // by the tag that created it
export async function repaintFollowing(unitId) // a following area's source moved
export async function expireTerrain(tick)      // scheduler sweep
```

It creates and deletes `RegionDocument`s carrying an `fgt.terrain` behaviour — the same documents
`terrainAreasOf` already reads, so **nothing on the read side changes**. `TerrainBehavior` already
declares `duration`, `sourceUnitId`, `followsSource` and `createdOnTurn`; all four have been inert
since the model was written and this is what fills them.

`tag` is how an area is found again: `sol:<unitId>`, `piedra:<fieldId>`, `xiuhcoatl:<fieldId>`.
Without it, ending an effect could not find the ground it painted.

### 4.2 The `zone` phase kind

**Ch. 42 §42.7 already named this**, and the design follows the chapter rather than inventing a
parallel spelling: ability-created terrain is a `zone` phase with a terrain payload, and the
chapter's worked example is Ozymandias's *Pyramid Drop* leaving its blast area as Day.

```yaml
- kind: zone
  spec:
    terrain: [sunlight]
    shape: { kind: square, size: 5 }
    anchor: { kind: self }
    followsSource: true
    duration: "1◈"
```

Added to `engine/skill-use.mjs`'s phase switch beside `createField`, and to the content
validator's allowlist. Every one of her three terrain writes is then **authored content**.

`shape: reuse` — the chapter's other form, meaning *"the NP's own blast area"* — is what
Xiuhcoatl's Fortress clause and Pyramid Drop both want, so it is built at the same time.

### 4.3 Wiring the dead code

`terrainConversions` gets its call in the damage step (`engine/attack.mjs`), so Forest→Burning and
the Meadow consumption fire for the first time.

This is not Quetzalcoatl's clause. It is included because leaving a function that computes the
right answer with nobody asking is the defect shape this project has now recorded five separate
times — `fireEvent`, the ZON tables, Magic Resistance's own clause 2, the aura relations,
`checkModifiers` — and the writer being built one file away is when it costs nothing.

---

## 5. `Sol` — Day on 25 panels

> *"Applies the 'Sol' buff to herself for 1◈ Turns, its effects are as follows- The 5x5 panel area
> around Quetz is 'Day', even if it is during a Night Round."*

Round phase is **global** today: `board.phase` is one string, and `rules/environment.mjs#phaseOf`
derives it from the round number. Sol makes it positional — which **Ch. 42 §42.6 already
specified**, function and all, naming Sol as its motivating case. This builds the chapter's
version verbatim rather than a near-miss of it:

```js
// rules/environment.mjs
export function phaseAt(panel, board) {
  const here = terrainAt(panel, board);
  if (here.includes("indoors")) return "none";
  if (here.includes("sunlight")) return "day";
  if (here.includes("darkness")) return "night";
  return board?.phase ?? "day";       // the global default
}
```

Three terrain entries join `TERRAIN` with **no standing effects of their own** — they are phase
overrides, not modifiers. `sunlight` is what Sol paints; `darkness` and `indoors` are authored
with it because §42.6 defines all three as one mechanism and a one-directional override would be
a rule shaped around a single Servant.

**Readers to repoint.** Every consumer of `board.phase` that is about a *unit* rather than about
the *round*: `rules/elements.mjs`'s Day/Night damage bands, `rules/items.mjs:242`'s phase
requirement, and the environment's own Night clauses. A consumer that is genuinely global — the
round banner, the phase log line — keeps `board.phase`. The distinction is settled per call site
in the implementation plan, because getting it backwards makes a 5×5 pocket of daylight either
cover the board or do nothing.

**§42.6's decision Q43 governs which panel is asked**: day/night is evaluated at the **defender's**
panel for damage-taken modifiers and at the **attacker's** panel for damage-dealt modifiers, since
the rule is phrased as two separate clauses about the `Dark` unit itself. `rules/elements.mjs`
takes one panel argument per direction accordingly.

`Sol` itself is one effect document (`polarity: buff`, no magnitude) whose application fires the
`createTerrain` above with `followsSource: true` — the flag `TerrainBehavior`'s own comment says
exists *"because Quetzalcoatl's Sol is one of the few that does"*. When the effect expires or is
removed, `clearTerrain("sol:<unitId>")` takes the daylight with it.

---

## 6. Charisma of the Sun, Good God's Wisdom, Lucha Libre

Three ordinary Actives, and they are ordinary on purpose — they are the control group that proves
the new machinery is not being reached for unnecessarily.

**Charisma of the Sun (EX)** — anchor self, `shape: square, size: 5` (a 2-panel area), relations
`[ally, self]`, three `applyEffects` rules: `atkUp 30/15` for 1◈, `sCritUp 25` for ⅓◈, and `sol`
on herself for 1◈. Cooldown 4◈.

**Good God's Wisdom (A+)** — one allied unit within 2 panels: `guts` at 10% of Max Health for 1◈,
`atkUp 40/30` for 1◈. Cooldown `4◈-⅓◈`, the banded notation Achilles and Heracles already use.

**Lucha Libre (EX)** — `critUp 60` and `critDmUp 50` for ⅓◈, then a `cooldown` phase reducing
**Xiuhcoatl specifically** by 1◈. Cooldown 4◈.

> **One-line engine fix.** `skill-use.mjs#selectAbilities`'s single-ability branch is
> `doc.items.get(change.abilityId)` — an **embedded item id**, which no content file can know.
> Every other ability selector in the codebase (`abilityOffCooldown`, `sameTurnExclusive`, the
> turn-use record) keys on **contentId**. Lucha Libre is the first content to name one ability by
> name, so the branch gains `abilityIds: [<contentId>, ...]` matching the rest of the vocabulary.
> Left alone it would compile, resolve to nothing, and silently reduce no cooldown at all.

---

## 7. Xiuhcoatl — two resolutions and a fraction

> *"Base Attack (STR) and half of Base Attack (MAG) is used (BA=250), not affected by Magic
> Resistance. Deals 4x damage and inflicts NP Seal for 1◈ Turns, and inflicts Burn for 2◈ Turns.
> Fire damage (half).*
>
> *Then (regardless of whether the NP hits the DU or not), deals normal damage to all Units within
> a 2 panel area of Quetzalcoatl except herself and the previously targeted Unit (Base Attack
> (MAG) is used) with a 25% chance of inflicting NP Seal for 1◈ Turns and inflicts Burn for 1◈
> Turns. Fire damage."*

`125 + (250 / 2) = 250`, which is the figure her sheet prints. `ignoresMagicResistance: true` is
already a damage-spec flag (Karna's Mana Burst carries it).

### 7.1 `aftermath` — the second resolution

The splash is **not** an area attack with a hole in it. It is a separate resolution that happens
*whether or not the first one landed*, from a different anchor (her, not the target), on a
different base attack (MAG alone, not the combined figure), at a different multiplier (1×, not
4×), with a different rider set. An ability carries one `damage` block today.

```yaml
aftermath:
  unconditional: true                 # "regardless of whether the NP hits the DU or not"
  targeting:
    anchor: { kind: self }
    shape: { kind: square, size: 5 }  # "within a 2 panel area of Quetzalcoatl"
    selection:
      relations: [enemy, ally, neutral]
      includeSelf: false              # "except herself"
      excludePrimaryTarget: true      # "and the previously targeted Unit"
  damage: { component: mag, multiplier: 1, element: fire }
  effects:
    - { id: npSeal, duration: "1◈", chance: 25 }
    - { id: burn, duration: "1◈" }
```

`engine/attack.mjs` declares a second fan-out after the primary group resolves, reusing
`declareProcesses` verbatim — the fan-out machinery exists, it has simply never been asked for
twice. `excludePrimaryTarget` is a new selection filter; nothing else in the corpus needed one,
because nothing else fires a second area from a different origin.

**Note the asymmetry**, which is easy to lose: the primary inflicts Burn for 2◈ and NP Seal
unconditionally; the splash inflicts Burn for 1◈ and NP Seal at 25%. Four numbers, all different.

### 7.2 `elementFraction` — "(half)" becomes real

*"Fire damage (half)"* means half the damage is Fire-typed. `karna-mana-burst-flames.yml` records
the current state honestly: *"KNOWN SIMPLIFICATION: the '(half)' is not modelled ... an enemy with
`flamHeal` heals from all of this rather than from half."* Dioscuri, Raikou and now Xiuhcoatl all
carry the same idiom.

```yaml
damage:
  element: fire
  elementFraction: 0.5
```

`rules/damage/pipeline.mjs` applies element-scoped modifiers — `elementAtkUp` / `elementDefUp`,
`flamHeal`, the Freeze and `Soaked` interactions, and any `attack:element:` predicate gating a
*damage* rather than a rider — to `total * elementFraction`, and the remainder as untyped.
Default `1`, so every existing ability is unchanged. Karna's file is retrofitted in the same pass
and its simplification note deleted rather than left to mislead.

**Corrected while planning: this is bigger than a fraction, because there is nothing to halve.**
`elementAtkUp`, `elementDefUp` and `elementDefDwn` are **in no bucket** in `pipeline.mjs` —
`ATTACKER_BUCKET_KEYS` is `["atkUp", "atkDwn", "dmgUp", "npDmUp", "npDmDwn"]` and
`DEFENDER_BUCKET_KEYS` is `["defUp", "defDwn", "ward"]`. Per that file's own comment, a key in no
bucket is *"collected onto the unit, carried through the snapshot, and never read"*. So the six
terrain types that emit element interactions — Waterside, Forest, Snowfield, Burning, Lava — have
emitted them into a void since terrain shipped.

Making `(half)` mean anything therefore means making elements mean anything first, and both halves
land together. This is also what Piedra Del Sol's Burning area needs to have any mechanical
effect beyond its own turn-end clause.

The **splash** is plain `Fire damage.` — fraction 1. The sheet distinguishes them and so does the
content.

### 7.3 The `[Fortress]` clause

> *"If this NP is used within or directly next to a [Fortress] NP (regardless of ally's or
> enemy's), that NP area and the panels directly outside/next to the NP area are now 'Burning'
> until the Fortress NP is deactivated."*

On resolution, every active field whose `npTags` include `fortress` (or whose scale is
`antiFortress`) and whose panels contain or neighbour her origin is painted `burning`, area plus
one-panel border, tagged `xiuhcoatl:<fieldId>` and cleared by that field's `onEnd`.
`rules/np-scale.mjs` already holds the `fortress` qualifier and the `antiFortress` scale
comparison; this is a reader for them.

**Stated honestly: there is no live referent.** The only `[Fortress]` NP in either roster is
Ozymandias's Ramesseum Tentyris, which is unauthored. This clause gets unit tests against a
synthetic field and **cannot be demonstrated in the live world**. It is built anyway because the
sheet says it, and skipping it would leave the one clause a reader would assume works.

---

## 8. Quetzalcoatl: Winged Serpent — the mount

A `platform` actor, which is Ch. 20's own filing of it, not a fresh decision.

```yaml
id: quetzalcoatlus
type: platform
baseHealth: 1000
agility: 16
inherit: { luck: { from: summoner } }     # "Luck: Shared with Quetz's"
mov: 7
range: { panels: 2, targets: 1 }
baseAttack: { str: 150, mag: 0 }
normalAttack: { mode: fixed, component: str }
attributes: [giant, beast]
capacity: 2
footprint: { w: 1, h: 1 }
sharesPanel: true                          # §3
crossLevel:
  occupantTargeting: forbidden             # "cannot be targeted for an Attack"
  requiresBoarding: true
  aoePassengerFactor: 0.5                  # "Quetz receives 50% Total Damage"
  aoeMastersImmune: true                   # "her Master receives no damage and effects"
  outboundTargeting: free
  forbidDirectlyBelow: false
```

The three AoE tiers fall straight out of `aoePassengerFactor` as it stands: the function returns
`1` when the unit *is* the platform (the mount takes full damage), `0` for a Master when
`aoeMastersImmune`, and `0.5` otherwise. §20.7 built the per-role axis specifically because
Quetzalcoatlus is *"the first platform where the mount itself takes full AoE damage while its
riders are partially shielded"*. It has been waiting for her.

`inherit` and `capacity` already compile for any actor type (`tools/lib/content.mjs#actorSystem`).

### 8.1 `replacesRiderAction` — the genuinely new part

> *"While Quetz is Riding the Quetzalcoatlus, Quetz's Move and Normal Attack is replaced with
> Quetzalcoatlus'."*

Not a buff and not a stat override: while she is aboard, her Move **is** the mount's move and her
Normal Attack **is** the mount's attack, spending her action rather than the platform's.

```yaml
replacesRiderAction: { roles: [owner], move: true, normalAttack: true }
```

- `rules/movement.mjs` — a rider's legal destinations are computed from the platform's MOV,
  footprint and its `sharesPanel` / obstacle-ignoring movement, and moving the rider moves the
  platform (and its other passengers) through the existing `movePlatform`.
- `rules/normal-attack.mjs` — her Normal Attack spec resolves to the mount's `baseAttack.str` and
  its `range`.
- `rules/budget.mjs` — one action, not two. The platform's own `actsOncePerTurn` accounting must
  not also charge her.

Riding's own Passenger Seat composes with this rather than fighting it: her Master boards as the
second occupant, and *"if her Master is next to the Quetzalcoatlus; otherwise her Master can get on
at any time"* is `boardingTarget`'s existing adjacency path with no roll.

### 8.2 Upkeep, lockout and cooldown

> *"After every 1◈ Turns, Quetz's Master's Health is reduced by 25 at the end of the Turn if this
> NP is Active unless the NP was deactivated during this Round. If her Master's Health is 25 or
> less, this NP is forcefully deactivated at the end of the Round. This NP can be deactivated
> during Quetz's Turn or at the start or end of any Round or Turn, but cannot be deactivated for
> 2◈ Turns after it was activated."*

Three things, and the first two are shared with Piedra Del Sol.

1. **Recurring platform upkeep.** `engine/fields.mjs#runUpkeep` sweeps `board.fields` only. A
   platform's `upkeep` is read in exactly one place today — `engine/attack.mjs:1959`, as an NP
   *cost replacement*, which is a different thing. `runUpkeep` is generalized to sweep platforms as
   well, so `{ every: "1◈", cost: { kind: health, amount: 25, payer: ownerMaster },
   endWhenUnaffordable: true }` means the same thing wherever it is authored.
2. **`deactivation.lockout`.** A new axis on the shared deactivation spec:
   `{ byOwner: true, window: any, lockout: "2◈" }`. `mayDeactivate` gains the tick comparison
   against `createdAt`. Piedra Del Sol declares the same block **without** a lockout, which is
   exactly the difference between the two sheets' final paragraphs.
3. **`cooldown: { max: "7◈", countFrom: destroyed }`** — a third `countFrom` beside the existing
   `activation` and `deactivation`. *"7◈ Turns after Quetzalcoatlus is defeated"* starts on the
   mount's death, and a mount dismissed rather than killed is a different clock.

### 8.3 The three Spells

Tlahuitequiliztli (Shock 2◈, Lightning), Ehecatle (Sap 1◈, Wind), Tlaelquiyahuitl (Slow 2◈,
Water). Identical but for the rider: Range 4, 3×3 area, 2× damage.

Four shared clauses, all of them existing vocabulary:

- `requirements: [{ kind: predicate, predicate: [self:onPlatform:quetzalcoatlus] }]` — Semiramis's
  Territory Creation already uses `self:onPlatform:`.
- One shared cooldown of 2◈ across all three: `exclusionSet`, which `engine/copy.mjs` and the
  `abilityOffCooldown` requirement already share.
- *"Cannot be used if Piedra Del Sol is Active"* — a field-active predicate.
- *"Counts as Quetz's & Quetzalcoatlus' Attack for the Turn"* and *"Cannot be used as a Counter"* —
  `countsAsAttack: true` and `timing: { window: ownTurn }`, both already honoured.

**Xiuhcoatl cannot be used while she is Riding** — the mirror requirement, declared on Xiuhcoatl
rather than inferred, the way Karna's two Brahmastras declare theirs on both sides.

---

## 9. Piedra Del Sol — a field anchored to an object

§43.10 already made the decision: *"These are `Structure` actors with a linked `BoundedField`."*
Bloodmark proved the pattern. This is the second, and the first where the object levitates.

```yaml
# structures/piedra-del-sol.yml
type: structure
baseHealth: null
undamageable: true
mov: 0
sharesPanel: true       # §3 — "the panel can still be Moved onto"
```

**Why `undamageable` and not Bloodmark's 1 Health.** Bloodmark got a single point because its own
sheet says *"only Masters can destroy a Bloodmark, and it is done by simply Attacking it"* — a
destruction clause needed something to spend. Piedra Del Sol's sheet contains **no destruction
clause at all**: it ends on her word, on the upkeep going unpaid, and on nothing else. Giving it
Health would invent a way to remove it that her sheet does not offer.

The field it anchors, in the six axes:

| Axis | Value |
|---|---|
| Geometry | `fixedArea`, `square 7`, `anchorRef: structure` — it does **not** follow her |
| Membership | free in both directions; *"Quetz can Move out of the Piedra Del Sol area"* |
| Isolation | none |
| Interior | `FlatDamage 180` and damage taken −50% including NP, both `relations: [self]` |
| Duration | none; `upkeep` 50/1◈ on her Master, `endWhenUnaffordable: true` |
| Deactivation | `{ byOwner: true, window: any }` — **no lockout**, unlike the mount |

Cooldown `{ max: "8◈", countFrom: deactivation }`, which Jack's Mist already established.

**The area is `burning` terrain**, painted by §4's writer and tagged `piedra:<fieldId>`, which is
what makes clause 2 mostly free:

> *"When an enemy Unit ends its Turn within the 7x7 panel area, it receives 50 Fire damage and is
> inflicted with Burn; this Burn debuff is permanent as long as the Unit is within the area."*

`PERIODICS.burning` already inflicts an unremovable, non-expiring Burn at turn end and already
deals fixed Fire damage at turn end. Only two things differ from the standard entry: the damage is
**50** rather than 25, and it applies to **enemies** rather than everyone. Both are expressed as an
`interiorEvents` `turnEnd` clause on the field, which overrides the terrain's generic one for units
inside — the terrain type is what makes the *ground* Burning (and gives the panels their water and
fire interactions); the field is what makes it *hers*.

### 9.1 The +180, stated as an assumption

> *"1. Goddess' Divine Core: All damage dealt is increased by 180; and all damage taken by Quetz is
> reduced by 50% including NP."*

Her passive Skill of that name gives +120. The clause is **headed with the Skill's name** and gives
a different number, which reads as the stone *raising* the Skill's value to 180 while it stands —
not as a second +180 stacking to +300.

**DECISION: it overrides.** Implemented as an interior `FlatDamage` carrying
`supersedes: [quetz-goddesses-divine-core]`, the same mechanism §15.4 built for ability
supersession, so the two cannot both apply and the reason is legible at the call site rather than
being a subtraction somebody has to remember. If play proves the other reading, the fix is deleting
one line.

`EX → 120` and the stone's `180` are also exactly `divineCore(EX)` and `divineCore(EX) × 1.5`; the
1.5 is **not** derived, because one data point is a coincidence and not a table.

---

## 10. What is deliberately not built

Recorded, rather than left to look finished.

- **Xiuhcoatl's `[Fortress]` clause has no live referent** (§7.3). Built and unit-tested; not
  demonstrable in-world until Ozymandias exists.
- **`(half)` for Dioscuri and Raikou** is enabled by §7.2 but not authored — neither Servant exists
  yet. Karna *is* retrofitted, because his file is the one carrying the note.
- **`darkness` and `indoors`** are authored alongside `sunlight` with no content using them yet.
  Not speculation: §42.6 defines the three as one mechanism, and building only the branch Sol
  needs would leave `phaseAt` a partial copy of a function the chapter already wrote out in full.
- **The GM's terrain palette** (§42.7's canvas tool — pick a type, draw a region, preview the
  overlap) is not built. The writer this design adds is the programmatic half only.

---

## 11. Testing

**Unit.** `test/unit/quetzalcoatl.test.mjs` for the sheet's own arithmetic (BA 250, 4×, the
splash's separate figures, the three AoE tiers, the two upkeeps, the lockout), plus additions to
`test/unit/movement.test.mjs` (sharing, and that Bloodmark still blocks),
`test/unit/terrain.test.mjs` (the writer, `followsSource`, `phaseAt` and its three overrides),
`test/unit/platforms.test.mjs` (`replacesRiderAction`, platform upkeep),
`test/unit/normal-attack.test.mjs` (the mount's substitution), `test/unit/elements.test.mjs` and
`test/golden/damage.test.mjs` (`elementFraction`, including Karna's retrofit), and
`test/unit/content.test.mjs`.

**Live.** Green tests are not evidence for the layers that touch documents — which is most of this.
Authoring, then `npm run build:packs` **with Foundry closed** (the app holds the LevelDB; shutting
the world down does not release it), then reopened and driven in the debug Chrome:

1. **Sol** — cast Charisma of the Sun during a Night round; a 5×5 patch reads Day, moves with her,
   and vanishes when the buff expires.
2. **The mount** — Winged Serpent places the Quetzalcoatlus, Quetz and her Master board it, both
   are refused as attack targets, and her Move draws from the mount's MOV over an occupied panel.
3. **A Spell** — Ehecatle's 3×3 lands and Sap is actually held (the effect that has never existed).
4. **Xiuhcoatl** — the primary at 4× and the splash at 1× resolve as two chat cards, with the
   primary target excluded from the second.
5. **Piedra Del Sol** — the structure token shares a panel with a unit that walks under it, the 7×7
   burns, and the Master's Health drops 50 on the upkeep tick.

---

## 12. Files

**New content** — `servants/quetzalcoatl.yml`; `platforms/quetzalcoatlus.yml`;
`structures/piedra-del-sol.yml`; `effects/sol.yml`, `effects/sap.yml`; and ten abilities:
`quetz-goddesses-divine-core`, `quetz-charisma-of-the-sun`, `quetz-good-gods-wisdom`,
`quetz-lucha-libre`, `quetz-xiuhcoatl`, `quetz-winged-serpent`, `quetz-piedra-del-sol`,
`quetz-tlahuitequiliztli`, `quetz-ehecatle`, `quetz-tlaelquiyahuitl`.

**New engine** — `module/engine/terrain.mjs`.

**Modified** — `rules/movement.mjs`, `rules/terrain.mjs`, `rules/environment.mjs`,
`rules/platforms.mjs`, `rules/normal-attack.mjs`, `rules/budget.mjs`, `rules/damage/pipeline.mjs`,
`rules/elements.mjs`, `rules/items.mjs`, `engine/skill-use.mjs`, `engine/attack.mjs`,
`engine/fields.mjs`, `engine/summoning.mjs`, `engine/token-footprint.mjs`, `engine/board.mjs`,
`data/actor/*`, `tools/lib/content.mjs`, `tools/validate-content.mjs`,
`packs/_source/abilities/karna-mana-burst-flames.yml`.

**Docs** — Ch. 08 (sharing), Ch. 13 (`elementFraction`), Ch. 20 (`replacesRiderAction`, platform
upkeep, `lockout`, `countFrom: destroyed`), Ch. 42 (the writer, `phaseAt`), Ch. 43 §43.10, Ch. 45,
Appendix A (`Sol`, `Sap`), §D.28, `CHANGELOG.md`.
