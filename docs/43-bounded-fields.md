# 43 — Bounded Fields

> **Mark has a control, so a `markDefined` field is playable (Ch. 45).** `engine/marks.mjs`
> implemented the whole action — budget, turn bookkeeping, the Bloodmark structure, the completed
> square and the field opening — and **nothing called it**. Blood Fort Andromeda could not be
> built. The action bar offers Mark to any unit whose Noble Phantasm declares this geometry, and
> withdraws it once the field is open. Verified live: four corners of a 5×5, and the field opened.


> **Implemented (Ch. 45 C4).** `module/rules/bounded-fields.mjs` is the six-axis model, one
> module rather than ten special cases — which is this chapter's own argument.
> `NPFieldBehavior` (Ch. 22 §22.10) carries the axes on a Region; `engine/board.mjs` projects
> them; `snapshotBoard` runs `annotateFields`; and `resolveTargets` enforces isolation at step 4c.
>
> | Axis | Function |
> |---|---|
> | 1 Geometry | `panelsOf`, `contains` — `fixedArea` and `followsUnit` computed, the drawn kinds stored |
> | 2 Membership | `membershipVerdict`, `escapeAttempt` |
> | 3 Isolation | `isolationBlocks` |
> | 4 Interior | `interiorModifiers` |
> | 5 Duration | `extensionFor` |
> | 6 Vulnerability | `vulnerabilityTriggered`, on the `NP_TAG_SCALE` ordering |
>
> Details worth keeping. `rollRequired` is **not** a refusal — it refuses the *free* move and the
> caller offers `escapeAttempt`; conflating the two turns a Labyrinth into a wall. Blocking
> **Command Spells** is its own axis rather than an inference from isolation, because the duel
> field is the only thing in the game that does it. And `???` never satisfies a tag threshold, so
> the check surfaces a prompt instead of silently deciding either way.
>
> **Chaos Labyrinthos is authored** (`packs/_source/abilities/asterios-chaos-labyrinthos.yml`) as
> the reference point in the model, including §43.4's escape ladder and its veteran clause.
>
> **`freeform` is now built** (Jack the Ripper's The Mist, Ch. 45). A freeform field has no shape
> to recompute from, so it **stores its panels** — which is the whole difference from `fixedArea`,
> and what makes reshaping a write rather than a recast. It opens at its authored `shape`, which
> for The Mist is a 5×5 centred on Jack: exactly the 25 panels her sheet caps her at, every one of
> them inside the 4-panel leash, and therefore the largest legal opening. Without that,
> `createField` would have refused it outright — `panelsOf` reads the stored list, and a newly
> created field has none.
>
> The same pass added the two axes The Mist needed and no earlier field did: **`upkeep`**, a
> recurring toll that keeps a field open (as opposed to `duration`, which closes it on a clock),
> with `endWhenUnaffordable` closing it *instead* of charging when the payer cannot pay; and
> **`deactivation`**, which says whether the owner may switch it off and when. It also added a
> **`contact`** event — the entry half of axis 4, which had only Turn boundaries to fire on
> before — and a `Defeat` action for the fields that kill on contact.
>
> **The painter is built too** (Ch. 45): mode E on the existing `TargetingLayer`, reached from a
> button on the token HUD during the owner's Turn and from a prompt the scheduler offers at the
> end of any Turn the owner Acts — a window that closes silently is one players lose. A repaint
> updates the Region and the stored panels **together and touches nothing else**, so the field
> keeps its id, its interior rules, its `createdAt` and its upkeep clock. Closing and recasting
> would restart the upkeep period and fire a `countFrom: "deactivation"` cooldown the owner has
> not earned, which is why a reshape must not be one.
>
> Once per Turn, via `turnState.reshapedField` — its own flag rather than `usedActiveSkill`,
> because the sheet says a reshape *"does not count as Moving a Unit and is not an Attack"*, so
> it must spend nothing else. Note that `rules/snapshot.mjs#turnStateAt` copies a **fixed key
> list**: a flag added to the schema and not added there is written to the document and invisible
> to every rule that reads a snapshot.
>
> The two-phase `markDefined` construction (Blood Fort Andromeda's Bloodmarks) **is now built**,
> along with `Structure` content and the drain-to-heal pool. Still not built: the scheduled
> detonation of §43.9. The state history of §43.11 exists only as
> `state.escapeHistory` — enough for the veteran rule, not the general log.

The expanded roster added nine abilities that create a **persistent area with its own rules of
entry, exit, and suppression**. They are not platforms (Ch. 20 — those are about elevation) and
not terrain (Ch. 42 — that is about panel properties). They are a third family, and they are the
single largest new subsystem the new Servants demand.

The rulebook already gestures at the category with the `[Bounded Field]`, `[Barrier]`,
`[Fortress]`, and `[Labyrinth]` Noble Phantasm tags. This chapter formalizes it.

---

## 43.1 The family

| Field | Owner | Rank | Tag |
|---|---|---|---|
| Hanging Gardens of Babylon | Semiramis | EX | `[Anti-World/Bounded Field]` |
| Chaos Labyrinthos | Asterios | EX | `[Labyrinth]` |
| Doomsday Come | Pale Rider | EX | `[Anti-World]` |
| Unlimited Blade Works | EMIYA | E~A++ | `[???]` |
| The Mist | Jack the Ripper | C | `[Barrier]` |
| Ramesseum Tentyris | Ozymandias | EX | `[Anti-Fortress/Fortress/Anti-Unit]` |
| Blood Fort Andromeda | Medusa | B | `[Anti-Army]` |
| Diatrekhōn Astēr Lonkhē (duel field) | Achilles | B+ | `[Anti-Unit]` |
| Akhilleus Kosmos | Achilles | A+ | `[Barrier]` |
| Piedra Del Sol | Quetzalcoatl | EX | `[Anti-Army~Anti-Fortress]` |

Ten fields across nine Servants — more than a third of the expanded roster creates one. They
need a shared model or the engine will grow ten special cases.

---

## 43.2 The model

```ts
interface BoundedField {
  id: string;
  ownerId: string;
  abilityId: string;

  geometry: FieldGeometry;
  duration: FieldDuration;
  membership: MembershipRules;
  isolation: IsolationRules;
  interior: RuleElement[];             // applied to units inside
  onEnd: Phase[];

  npTags: NPTag[];                     // Fortress, Barrier, Labyrinth, AntiWorld…
  vulnerabilities: FieldVulnerability[];
}
```

Six axes. Every field in the table is a point in this space.

---

## 43.3 Axis 1 — Geometry

```ts
type FieldGeometry =
  | { kind: "fixedArea"; shape: ShapeSpec; anchor: "castPosition" }
  | { kind: "followsUnit"; unitRef: "owner" | "ownerMaster"; shape: ShapeSpec }
  | { kind: "freeform"; maxPanels: number; maxDistanceFrom: string; reshapeable: boolean }
  | { kind: "markDefined"; markCount: number; allowedShapes: ShapeSpec[] }
  | { kind: "enclosing"; participants: string[]; shape: ShapeSpec };
```

| Field | Geometry |
|---|---|
| Chaos Labyrinthos | `fixedArea` 9×9 around Asterios (11×11 if the Region is Greece) |
| Doomsday Come | **`followsUnit`** — `(2 + 1d4)` panels around **Pale Rider's Master**, moving with them. The only field whose **size is rolled**: `shape.radiusRoll` is evaluated once at cast and stored as a concrete size, because a field that re-rolled on every read would breathe and membership would depend on who asked last. "X panel area" is radius X by the corpus's convention, so it opens as a 7×7 through a 13×13 |
| Unlimited Blade Works | `fixedArea` 7×7 around EMIYA |
| The Mist | **`freeform`** — any shape up to 25 panels, within 4 panels of Jack, **reshapeable once per turn** |
| Ramesseum Tentyris | `fixedArea` 11×11, **cannot intersect an enemy Home Base** |
| Blood Fort Andromeda | **`markDefined`** — four Bloodmarks placed as an Action define a 5×5, 7×7 or 9×9 |
| Duel field | **`enclosing`** — 5×5 around the two duellists |
| Piedra Del Sol | `followsUnit`-adjacent — a 7×7 around a placed object |

Three of these are genuinely new shapes.

**`followsUnit` anchored on the Master** (Doomsday Come) is unique: the field tracks a unit that
is not its creator. Pale Rider's Master becomes a mobile prison, which is the whole design.

**`freeform`** (The Mist) lets the player draw an arbitrary 25-panel region each turn, bounded by
distance from Jack. This needs a **paint-style canvas tool**, not a shape picker — the first
targeting interaction that is not one of the four modes in Ch. 09 §9.9. Mode E.

**`markDefined`** (Blood Fort Andromeda) is a two-phase construction: Medusa spends four Actions
placing Bloodmarks (each counting as her Attack for the turn), and the field activates when the
fourth completes a legal **square**. The marks are objects on the board that **only Masters can
destroy**, and that are **only visible within 3 panels**. So the counter-play is a Master
sortie into fog.

> **Built.** `rules/bloodmarks.mjs#squareFrom` decides it and `engine/marks.mjs` places the
> objects. Four readings the sheet forces:
>
> - **Corners, not four panels.** *"The four CORNER panels"* — three in a row and a fourth adrift
>   is not a field, so it wants exactly two distinct rows and two distinct columns with all four
>   combinations present.
> - **A square, not a rectangle**, and only at 5, 7 or 9. A 5×7 is not on the list and a 6×6 is
>   not either.
> - **Order-independent**, because the marks are placed over four separate Turns and nothing says
>   which corner comes first.
> - **A stray mark may coexist with a completed set** — *"whenever Blood Fort Andromeda is
>   complete, all OTHER Bloodmarks will vanish"* only means anything if it can, so completion
>   looks for **any** completing four rather than requiring exactly four to exist.
>
> A mark's panel is **written at placement**, not read back off its token: `getActiveTokens()`
> lags `createEmbeddedDocuments`, and the fourth mark completed no square because its own token
> was not yet queryable. `placeMark` reads Medusa's own panel from the token **document** for the
> same reason — `currentBoard()` reads canvas placeables, which lag it, and a Mark taken right
> after a Move landed one panel behind her.
>
> Visibility is **approximated**. The rule is per-viewer and Foundry has no per-viewer token
> rendering — the constraint `engine/token-image.mjs` states for a Servant's portrait, and the
> one D44.9 assessed and deferred. So it drives Foundry's `hidden`, which players cannot see
> through and the GM always can, from whether any enemy stands within 3. It errs toward
> concealment, which is the clause's own direction.

### A geometry may read the board

Pale Rider's Contagion states two rewrites of its own area in a single paragraph, and neither
is a new field: it is one passive area measured differently while something else is true.

```yaml
geometry:
  kind: followsUnit
  shape: { kind: square, size: 5 }
  overrides:
    - { whileFieldOpen: pale-rider-doomsday-come, sameAs: pale-rider-doomsday-come }
    - { whileOwnerHas: contagionExpanded, shape: { kind: square, size: 9 } }
```

`whileOwnerHas` reads an effect off the owner; `whileFieldOpen` / `sameAs` borrows another open
field's panels. Both are pure — `panelsOf` already takes the board — and both are tested in
**authored order, first match wins**, because *"instead of its usual Range"* is a precedence
claim and the file is where precedence belongs. An override stating neither condition never
applies, so a bare `{shape}` cannot shadow the entries after it.

### The drawn Region and the computed one

A field's membership is computed: `panelsOf` reads the anchor's current panel every time it is
asked, so the **rules** have always followed a `followsUnit` anchor correctly. What the player
can *see* is a different object — a Foundry Region, drawn once at cast time — and it did not
follow anything.

Foundry v14 answers the movement half natively. A Region carries `attachment.token`, and the
core translates its stored offsets as that token moves. So a `followsUnit` field is created
attached to its anchor's token — the **Master's** token for Doomsday Come, which is what
`unitRef` already names — and the drawn area and the computed one agree with no hook, no write,
and no dependence on which movement paths the system manages to observe.

What the core cannot do is resize a shape, and Contagion resizes itself twice without anybody
moving: 5×5 to 9×9 on its Active, and to Doomsday's whole area while that field stands.
`engine/fields.mjs#syncDerivedFields` redraws a field whose computed panels no longer match its
drawn ones, and runs on effect changes and at every Turn start. A `freeform` field stores what
the player painted, so its computed panels *are* its drawn ones and it is never touched — the
painter stays the only thing that reshapes it.

---

## 43.4 Axis 2 — Membership: entry and exit

The defining axis. Six distinct policies appear.

```ts
interface MembershipRules {
  enemyEntry: "free" | "forbidden" | "rollRequired" | "draggedIn";
  enemyExit:  "free" | "forbidden" | "rollRequired";
  allyEntry:  "free" | "forbidden";
  allyExit:   "free" | "forbidden";
  escape?: EscapeSpec;
}

interface EscapeSpec {
  baseChance: number;                  // percent
  formula: string;                     // "1d20"
  onFailure: "randomRelocate" | "stayPut" | "damage";
  chanceIncreasePerFailure: number;
  requiresBorderContact: boolean;      // must reach the inner edge first
  requiresRemainingMove: boolean;
  veteranBonus?: VeteranSpec;          // having escaped before
}
```

| Field | Enemy entry | Enemy exit |
|---|---|---|
| Chaos Labyrinthos | free | **escape roll**, 20% base, +5% per failure, must reach the inner border with MOV left; failure relocates randomly inside |
| Doomsday Come | free — **and can be dragged in** | **forbidden** |
| Unlimited Blade Works | **forbidden** | **forbidden** |
| The Mist | free | free |
| Ramesseum Tentyris | free | free |
| Blood Fort Andromeda | free | free |
| Duel field | **forbidden to everyone** | forbidden to the duellists |
| Piedra Del Sol | free | free |

**Chaos Labyrinthos's escape ladder** is the most elaborate and gives the `[Labyrinth]` tag its
meaning:

```
To escape:
  1. Move to the inner border of the Labyrinth.
  2. If no MOV remains, you cannot escape this turn.
  3. Roll 1d20. Base success 20%.
  4. Failure  → relocated to a RANDOM panel inside; next attempt +5%.
     Success  → move out, using whatever MOV remains.

Veteran rule: a unit that has escaped ONCE has, on every re-entry,
  - Base escape chance 100%
  - No MOV halving inside
  - And can lead allies out: any allied unit DIRECTLY NEXT TO a veteran
    also gets 100% escape and no MOV penalty.
```

The veteran clause makes the Labyrinth a puzzle rather than a soft lock: one unit escaping
unlocks the rest of their team, so the correct play is to concentrate escape attempts.

**Doomsday Come's drag** is the inverse:

> *"During Pale Rider's Turn, if there are any enemy Units within a 2 panel area of the Doomsday
> Come area, Pale Rider can target an enemy Unit within this Range; that target performs an
> Evade roll. If the Evade failed, the DU is forcibly dragged into the area and placed on a
> random panel within. Once per Turn."*

An **entry mechanic that the field's owner drives**, with a defender reaction. It is an attack in
every structural sense except that it deals no damage, so it runs Pipeline A (Ch. 03 §3.5) with a
`move` outcome instead of a `damage` one.

**Implementation note.** `membershipVerdict` was shipped, tested and never called from anywhere a
move actually happens — `rules/movement.mjs#canPassThrough` now asks it before every step, so
*every* field's exit policy is enforced for the first time, not just the one that surfaced the
gap. Semiramis's Sikera Ušum (Ch. 32) added a seventh policy neither table above lists:
`trappedAtActivation`, for *"all Units within the Throne Room when the NP was activated cannot
leave it while it is Active"* — a **membership snapshot taken at creation** (`field.state.
trappedUnitIds`, `engine/fields.mjs#createField`), not a standing `allyExit`/`enemyExit` policy,
because those would also catch a unit who wanders in and back out later. When set, it overrides
whatever `allyExit`/`enemyExit` values are present.

---

## 43.5 Axis 3 — Isolation

Can units inside and outside interact?

```ts
interface IsolationRules {
  outsideCanTargetInside: boolean;
  insideCanTargetOutside: boolean;
  outsideCanApplyEffectsInside: boolean;
  visibilityAcrossBoundary: "full" | "none" | "ownerOnly";
  piercedBy?: { npScale: NPTag };          // a big enough NP ignores all of it
}
```

| Field | Cross-boundary targeting |
|---|---|
| Chaos Labyrinthos | **Fully isolated** — *"Units outside cannot Attack or apply any effects to Units within and vice versa"* |
| Doomsday Come | **Fully isolated, except to an [Anti-World] Noble Phantasm** |
| Unlimited Blade Works | **Fully isolated** |
| The Mist | Open — it is a debuff field, not a prison |
| Ramesseum Tentyris | Open |
| Duel field | **Fully isolated, and Command Spells cannot reach in** |

Full isolation is a strong statement: it partitions the board into two independent combats. The
turn system must handle a player whose units are split across the boundary — they take one turn
and act with both groups, but the groups cannot help each other.

### One hole, and it is the counter-play

Doomsday Come is the only field with an exception written into its own isolation:

> *"A Noble Phantasm of [Anti-World] or higher can be used on Doomsday Come (from outside) or
> within Doomsday Come. If used in this way, Doomsday Come is forcibly ended at the end of that
> Combat Process, and all Units within it receive the damage from that NP, but its Total Damage
> is reduced by 50%."*

`piercedBy` is tested **before** both direction flags, because the clause names both directions.
It has to exist: enemies inside cannot leave, nobody can shoot across, and without this the area
is a soft lock that ends only when Pale Rider does.

Three pieces move together, and they are one clause read three ways:

| Axis | Reads |
|---|---|
| Isolation | `piercedBy` lets the NP across the boundary |
| Interior | a `defUp` contribution predicated `attack:npScale:gte:antiWorld` halves it for **everyone** inside — "all Units", ally and enemy alike |
| Vulnerability | `npScaleUsedOn` ends the area at the end of that Combat Process |

The **timing** is the whole clause: at the END, so the damage lands inside where the shelter
halves it, and only then does the area come down. Ending it at declaration would put the target
outside the very rule meant to shelter them.

The attack's own tags reach all three through `attack.npTags`, carried on the attack spec for
the same reason `element` and `pierce` are — three rules ask, and none of them can reach the
ability document. `attack:npScale:gte:<tag>` is emitted as a **ladder** (an Anti-Army NP is also
"Anti-Unit or higher"), for the same reason the rank comparison is: a predicate can only test set
membership.

**The duel field goes further than isolation.** It suppresses:
- All outside interference, *"even with Command Spells"* — the only thing in the game that
  blocks a Command Spell.
- **Luck Checks by the involved units.**
- All buffs and debuffs *"caused by Units not involved in the duel"* — a scoped suppression by
  effect *source*, which is a new selector (`suppressWhere: { sourceNotIn: participants }`).

---

## 43.6 Axis 4 — Interior rules

Ordinary rule elements applied to units inside, collected exactly like terrain (Ch. 42 §42.1).
Nothing new is needed here, which is the payoff for having built the rule-element system.

Representative interiors:

**Chaos Labyrinthos** — Asterios MOV +4; enemies MOV −2 (floor 2); on activation and on each
extension, `Atk Dwn` and `Def Dwn` on all enemies inside.

**Doomsday Come** — `Contagion` applies to *all* enemies inside continuously rather than in its
usual 2-panel radius, at elevated rates; `Innocent World` applies its highest-parameter effects;
Kagome Spirits spawn per enemy.

**Ramesseum Tentyris** — six clauses including a tiered `Divine Curse` (normal Humans **die at
the end of the turn after entering**; everyone else takes −20% dealt, +20% taken, +2 to Evade and
Luck Checks, and permanent Stage 1 Curse) and a `God's Curse` that **seals Noble Phantasms**
unless the unit's Divinity is equal to or higher than Ozymandias's.

**The Mist** — normal Humans die on contact; enemy Masters and non-normal Humans are Poisoned on
contact and per turn; enemy Servants +3 Evade; enemy MOV halved; enemy Detect reduced to 1 — all
of which the `Instinct` skill at Rank B+ ignores, and a unit adjacent to such a Servant ignores
the MOV clause.

**Blood Fort Andromeda** — a tiered health drain (normal Human: instant death; Master/non-normal
Human: 40/turn; Servant/non-Human: 20/turn), **halved against `Mechanical` units**, with the
total drained healing Medusa and/or her Master up to the amount drained.

> **Built, and the first interior event that pays somebody outside itself.** Every other one
> writes to the unit it landed on. `HealthLoss` accumulates into a per-tick pool when the event
> declares `payout:`, and `rules/fields/pool.mjs#distributePool` splits it **capped at the pool**
> — the cap is the rule, so it is enforced in the rules layer rather than trusted to content:
> two beneficiaries and one pool means an uncapped split would pay the drain out twice.
> *"Either or both"* states no procedure, so an even split is the neutral reading and the
> remainder goes to the field's owner; nothing is wasted and nothing is invented.
>
> `halveIf` states *"halved against Mechanical Units"* **once on the event** rather than as three
> more branches — one clause covering every tier, which authoring per tier would let drift.
>
> The tiers use the corpus reading Jack's Mist established: a **Normal Human is a Civilian**, a
> *"non-normal Human"* is a **Master**, and a Servant is not a Human. The Civilian tier carries
> `creditOwner`, so the kill is Medusa's — Independent Action pays her 1◈ per Civilian she kills
> while Free, and a death the *field* took credit for would quietly stop paying her.

### An interior rule may ask about the Unit it lands on

Innocent World is six clauses on one field, applied *"depending on which of the Unit's
Parameters are highest"* — so the field carries six rules and each one asks a question about the
Unit standing under it.

The predicate is split **per clause**, and that is a correctness requirement rather than
tidiness:

| Clause names | Answered | Why |
|---|---|---|
| the unit (`self:highestParameter:agi`) | at annotation, against the unit's own options | there is no attack yet, so deferring it means it is never answered |
| the attack (`attack:npScale:gte:antiWorld`) | later, by the damage pipeline | there is no attack yet, so answering it now reads false for everybody |

An answered clause is **stripped** before the rule travels on. `self:` in the pipeline's option
set means the **attacker**, so carrying an already-answered `self:highestParameter:agi` through
to a defender-side modifier would re-test it against the wrong Unit entirely.

`annotateFields` used to pass `ctx: {}` and no `deferred`, so every interior predicate was simply
dropped — a predicated rule became an unconditional one, which is the opposite of the authored
intent and silent in both directions.

### Interior rules are not all modifiers

The annotation pass appended every interior rule to the unit's `modifiers`, which is the bag the
**damage pipeline** reads — and a rule that moves a *stat* is not a damage modifier. Both authored
fields have one, and neither did anything: Asterios's *"MOV +4"* changed nobody's MOV, and EMIYA's
*"Base Attack (STR) is increased by 50"* changed nobody's Base Attack.

`StatDelta`, `MovDelta` and `RangeDelta` are now folded straight onto the unit snapshot;
everything else still goes into `modifiers`. The fold happens on the snapshot rather than in
`prepareDerivedData` because the annotation needs the whole board and derived data is per-document.

`minimum` floors the **result**, not the deduction — *"MOV reduced by 2, minimum 2"* — which is
the opposite of Mad Enhancement's Master drain and worth not confusing.

### The owner is its own relation

`relationTo` answered `ally` or `enemy` and nothing else, so the owner was folded into `ally` and
a rule scoped `relations: [self]` matched **nobody**. That is every owner-only interior clause in
the reference set: Asterios's own MOV bonus inside his Labyrinth, and EMIYA's Base Attack inside
his Reality Marble. It now returns `self` for the field's owner, as every other relation
computation in the system does.

### Interior *events*

Interior rules are standing contributions. EMIYA's *Unlimited Blade Works* also has something that
happens **at a boundary**: *"at the start of every Turn, all enemy Servants within perform an
Evade roll. If failed, that Unit receives (25 x 1d4) STR damage; this damage is not affected by
any damage modifying effects on EMIYA."*

That belongs to the **area**, not to its caster — a Servant dragged inside is subject to it, and
EMIYA's own event handlers do not follow anybody around. So it is a seventh field property rather
than an `OnEvent` on the ability:

```yaml
interiorEvents:
  - event: turnStart
    relations: [enemy]
    kinds: [servant]
    check: evade
    onFail:
      - { key: Damage, roll: { formula: "1d4", factor: 25 }, component: str, bypassModifiers: true }
```

`bypassModifiers` is the same flag periodic effect damage carries, and the reason the toll is a
bare damage intent rather than a Combat Process.

The recurring **"normal Human"** tier is worth noting: three fields treat them as an instant
kill. `normalHuman` is therefore a real unit classification, distinct from the `Human` attribute
— Masters have `Human` but are *not* normal Humans. **DECISION.** `normalHuman` is a derived
predicate: `attribute:human && kind:civilian`. Masters and Demi-Servants are excluded.

#### `HealthLoss` — a deduction that is not damage

Contagion: *"Health is reduced by 100. Not affected by effects that modify damage taken (does
not count as 'damage')."*

`Damage` is the pipeline. Routing this through it would subject the 100 to Def Up, Dmg Cut,
Magic Resistance and all thirteen stages, and would raise `fgt.damageTaken` for every on-damage
rider in the game. `HealthLoss` is a plain `statDelta` on `health.value` instead. It still
reaches zero and `resolveDefeat` still notices — which is the one thing *"not damage"* must not
be read to mean. Measured live: 100 lost against a standing Def Up of 50%.

#### `chance` and `duration` on an applied effect

*"A 50% chance of being inflicted with Poison"*, *"Charm for 1◈ Turns"*. The probability belongs
to the **field**, not to the effect — Poison's own `baseChance` is 100, and the number that
varies under Doomsday Come is Contagion's. The duration likewise: Sikera Ušum's Poison has none
(its clock is its own stage counter) and Contagion's Charm has one, so an applied effect can no
longer assume `expiry: null`.

#### `branches` — the same event, different numbers per unit

Contagion under Doomsday Come rewrites three of its own numbers at once, and one of them depends
on where the victim is standing relative to a *third party*: *"the chance of being inflicted with
Poison is 75% while chance of being inflicted with Charm is 25%; and if the enemy Unit is within
a 3 panel area of Pale Rider's Master, Health is reduced by 150 instead of 100."*

So an interior event may carry `branches`, selected **per unit** against that unit's own option
set — first match wins, falling back to the event's base actions. It is the same shape
`damage.branches`, `targeting.branches`, `cooldown.branches` and a field's own `branches`
already use; what differs is that the choice is made per victim rather than once per cast.

The distance to the field owner's Master is emitted as `self:withinOfOwnerMaster:<n>`, a ladder
like `attack:range:gte`. `annotateFields` stamps `ownerMasterPanel` from the field the unit is
standing in, because only the field knows who that Master is.

#### `unitTurnEnd` — the owner's own Turn

Contagion's first trigger is *"at the end of Pale Rider's Turn: affects all enemy Units within
the Contagion area"* — every enemy inside, on **his** Turn only. `fgt.unitTurnEnd` has been in
§E since that reference was written and nothing ever dispatched it. It is dispatched now, scoped
to the fields whose owner belongs to the faction whose Turn just ended: firing it unscoped would
charge Contagion on every faction's Turn and triple the toll.

---

## 43.7 Axis 5 — Duration and extension

```ts
type FieldDuration =
  | { kind: "ticks"; value: TickExpr }
  | { kind: "untilOwnerDefeated" }
  | { kind: "permanentUntilEnded" }
  | { kind: "onceOnly" };

interface ExtensionSpec {
  cost: {
    kind: "health";
    amount: number;                          // the price
    payer: "owner" | "ownerMaster";
    minimum?: number;                        // a floor, when the sheet states one
  };
  grants: TickExpr;
  repeatable: boolean;
  sideEffects?: Phase[];
}
```

Two fields introduce **paid extension**, a mechanic nothing else in the game has:

| Field | Extension |
|---|---|
| Chaos Labyrinthos | After the initial 4◈, Asterios may pay **200 of his own Health** for 2◈ more, repeatable. Each extension **re-applies** `Atk Dwn`/`Def Dwn` to everyone inside. |
| Doomsday Come | After the initial 2◈, Pale Rider's **Master** may pay **100 Health** for 1◈ more, repeatable. |

So both are attrition engines: the owner burns their own resource to keep the trap shut, and the
trapped units burn theirs trying to get out. That is a genuinely elegant piece of design and it
needs no special engine support beyond `ExtensionSpec`.

> **The runner exists (Ch. 45).** `ExtensionSpec` was authored on Chaos Labyrinthos from the day
> Asterios was written and **nothing ever ran it**: `extensionFor` was a pure function with no
> caller, so a field with a paid extension simply closed on schedule and the whole attrition
> cycle was decoration. `expireFields` now offers it, and only when the **clock** is what is
> closing the field — one ended by its owner's defeat is not for sale.
>
> Three things the spec had to say out loud once something read it:
>
> - **`payer`.** Doomsday Come charges Pale Rider's *Master*; Chaos Labyrinthos charges Asterios
>   himself. One runner serves both, so the cost names who pays.
> - **`minimum`, which is not the price.** Doomsday Come: *"cannot be used if the Master's Health
>   is **less than 100**"* — so at exactly 100 the Master may pay it down to zero, and at 99 they
>   are **never asked**, because a Master should not be offered a question whose answer kills
>   them. Where no floor is stated it defaults to the price, and the two refusals stay
>   distinguishable in the log (`belowMinimum` versus `cannotAfford`).
> - **`sideEffects`.** Asterios's are why extending is not merely paying to wait: each extension
>   re-applies `Atk Dwn` and `Def Dwn` to every enemy *currently* inside, read from the board
>   rather than remembered from cast time — who is inside is exactly what the intervening Turns
>   were about.
>
> The payer is read **from the board**, not from `game.actors`. For an unlinked token those are
> two different documents with two different Healths: the board reads the token's actor, which is
> what every write lands on, while `game.actors.get(id)` is the prototype nobody is playing.
> Asking the prototype and charging the token is how a Master gets billed for an extension they
> could not afford, or refused one they could.
>
> Measured live: the Master paid 100 and the expiry moved 10 → 13 (1◈); a second extension
> charged another 100, since both fields say *"repeatedly"*; at 99 the prompt never appeared and
> the field closed with the Health untouched; Asterios paid **200 of his own** for 2◈ and every
> enemy inside gained `Atk Dwn` and `Def Dwn` while he did not.

**Ramesseum Tentyris is permanent** once activated — *"remains constantly Active"* — with four
distinct termination paths (§43.8).

---

## 43.8 Axis 6 — Vulnerability

How the field can be broken from outside. This is where the NP tag system becomes load-bearing.

```ts
interface FieldVulnerability {
  kind: "npTagAtLeast" | "npScaleUsedOn" | "damageThreshold" | "npCount" | "ownerDefeat" | "markDestruction";
  tag?: NPTag;
  threshold?: number;
  window?: "round" | "turn";
  result: "end" | "endPermanently" | "reducedDamage";
}
```

| Field | Vulnerability |
|---|---|
| **Doomsday Come** | An `[Anti-World]` or higher NP used on it, from outside or within, **ends it at the end of that Combat Process**; all units inside take that NP's damage at **−50% Total Damage** |
| **Ramesseum Tentyris** | Two `[Anti-Fortress]` or higher NPs **in the same Round**, from outside or by units inside; **or** more than 3000 damage in one Round. Either result: **cannot be used again for the rest of the game** |
| **Blood Fort Andromeda** | Bloodmarks destroyed by Masters attacking them (visible only within 3 panels) |
| **Chaos Labyrinthos** | Asterios defeated → forcibly ends at end of turn |
| **The Mist** | Jack defeated, or her Master falls to ≤15 Health |
| **Akhilleus Kosmos** | Consumed on use — negates one `[Anti-Army]`+ NP in a 5×5, then is permanently gone |

This requires **NP tags to be a real, ordered classification**, because "Anti-World or higher"
and "Anti-Fortress or higher" are comparisons.

**DECISION.** NP tags form a partial order by *scale*:

```
Anti-Unit  <  Anti-Army  <  Anti-Fortress  <  Anti-Country  <  Anti-World
```

with orthogonal, unordered qualifiers that do not participate in the comparison:
`Anti-Divine`, `Anti-Beast`, `Anti-Unit (Self)`, `Barrier`, `Fortress`, `Labyrinth`, `Counter`,
`Bounded Field`, `???`.

An NP may carry several tags (Ozymandias's is `[Anti-Fortress/Fortress/Anti-Unit]`); comparisons
take its **highest scale tag**. `???` sorts as unknown and never satisfies a threshold — the GM
adjudicates, and the field's vulnerability check surfaces a prompt rather than silently failing.

Recorded as **Q44** in Ch. 41: the scale ordering is our construction from conventional usage,
not a stated rule.

---

## 43.9 Delayed and scheduled fields

Two abilities introduce **scheduled detonation**, which the time model (Ch. 07) supports but
nothing previously used.

**Proto Gil's `Enki`.** On activation: his Master loses **half their maximum Health**, Proto Gil
**cannot Act for 1◈ turns**, and the panel he stood on is marked `Utnapishtim`. Then **7◈ turns
later** a 13×13 area centred on that mark takes 5× + 700 damage with a 500% chance of `Drowning`,
and the area becomes `Waterside` for 7◈ turns. Once per game. **Cancelled if Proto Gil is
defeated during the wait.**

```yaml
- kind: schedule
  delay: "7◈"
  anchor: { kind: mark, id: utnapishtim }
  cancelIf: [{ event: unitDefeated, unitId: self }]
  then:
    - { kind: damage, target: { anchor: mark, shape: { kind: rect, w: 13, h: 13 } },
        formula: { base: [{ unit: self, component: mag }], multiplier: 5, flat: 700 },
        exclude: [self, ownerMaster, "attribute:levitating"] }
    - { kind: applyEffect, target: reuse,
        effects: [{ id: drowning, duration: "3◈", chance: 500 }] }
    - { kind: zone, spec: { terrain: [waterside], shape: reuse, duration: "7◈" } }
```

`kind: schedule` is a new phase type: it registers a callback on the global turn index with a
cancellation predicate. The scheduler (Ch. 25 §25.4) already walks turn boundaries, so this is a
queue lookup, not new machinery.

Note the status-effect document's clause that `NP Seal` *"does not delay, stop, or pause NP that
occur a set amount of time after being activated (e.g. Catastrophe Crime, Enki)"* — so a
scheduled detonation is immune to sealing once launched. That clause finally has a referent.

**Nursery Rhyme's `The Queen's Glass Game`** is scheduled in the opposite direction — it looks
*backwards*. See §43.11.

---

## 43.10 Fields that are objects

Two fields are anchored to a **placed object** rather than to a unit or a panel set.

**Quetzalcoatl's `Piedra Del Sol`** places a figurine *above* the field. Its 7×7 area is
`Burning`; units may still move onto the panel beneath it; Quetz may leave her own area. It costs
her Master 50 Health per 1◈.

**Medusa's Bloodmarks** are four destructible objects that define a field only when all four are
placed. **Built** — `StructureData` was a registered actor type with no content, and this is its
first. `destroyableBy: [master]` is both an **opt-in** and a refusal: platforms and structures
are excluded from targeting unless an ability asks with `kinds`, and *"it is done by simply
Attacking it"* is a Normal Attack, which asks for nothing. Destroying a corner ends the field,
because the square no longer exists.

**DECISION.** These are `Structure` actors (Ch. 04 §4.9) with a linked `BoundedField`. Modelling
them as units gives targeting, destruction, visibility rules, and health for free — the Grail
already established the pattern.

---

## 43.11 State history — the hardest new requirement

Nursery Rhyme's `The Queen's Glass Game: Perpetual Engine - Maiden Empire`:

> 1. Activates at the end of the Turn, **3◈ Turns after Nursery enters Combat**, if enemy Units
>    are still within 3 panels. The **Stats, Parameters, Buffs, Debuffs, Cooldowns, and other
>    existing effects** of all Units within 3 panels are returned to what they were **3◈ Turns
>    ago**.
> 2. Activates when Nursery is defeated. Same, but rewinding **6◈ Turns**, including herself.
>    Once per game.
>
> Does not affect Nameless Forest Tokens.

This is a **time rewind over an arbitrary set of units**, and it is by a wide margin the most
demanding mechanic in either roster. Nothing else requires the engine to remember the past.

### What it needs

A per-unit **state history** deep enough to cover 6◈ turns (18 turns at 3 turns/round, 48 at 8).

```ts
interface UnitStateSnapshot {
  globalTurn: number;
  stats: { health: Resource; agility: Resource; luck: Resource };
  parameters: Record<ParamKey, { base: string; granted: number }>;
  effects: EffectInstanceSnapshot[];        // full instances, not ids
  cooldowns: Record<string, CooldownState>;
  resources: Record<string, Resource>;
  modes: Record<string, ModeState>;
  // NOT included: position, facing, turn budget, contract state
}
```

**DECISION.** History is recorded as a **ring buffer of per-turn snapshots**, one entry per unit
per turn, retained for `max(6◈) + 2` turns and then discarded. Snapshots are diffed against the
previous entry and stored as patches, because the overwhelming majority of turns change little.

Budget: 28 units × 50 turns × ~200 bytes per patch ≈ **280 KB**. Acceptable on the `Combat`
document if flushed to a `JournalEntry` alongside the log (Ch. 30 §30.8), and it is only
recorded when a unit with a history-dependent ability is on the field.

**Gating is the key optimization.** `historyRecording` is off by default and enabled only when
an ability declaring `requiresHistory: true` enters play. A match without Nursery Rhyme pays
nothing.

### What it deliberately excludes

- **Position and facing.** The source lists *"Stats, Parameters, Buffs, Debuffs, Cooldowns, and
  other existing effects"* — not location. Units are not teleported back. **DECISION.** Position
  is excluded; recorded as **Q45**.
- **Nameless Forest Tokens**, explicitly, by the ability's own text.
- **Turn budget and contract state** — not "existing effects" in any natural reading.

### Ordering

The rewind fires at **end of turn**, after all other end-of-turn processing (Ch. 07 §7.7), so it
undoes that turn's events too. It emits one `rewind` intent per affected unit, and the intent
applier writes the restored state in a single batch per actor.

**RISK.** A rewind that restores a cooldown makes an ability usable again that a player already
spent; a rewind that restores health undoes a kill (though not a *defeat* — a unit already
removed is not within 3 panels to be restored). Both are intended. What must not happen is the
rewind restoring an effect whose *source* has since been removed, producing an orphaned
instance. Effect snapshots therefore record the source unit id and the applier drops instances
whose source no longer exists, logging each drop.

---

## 43.11a Creating one

Everything in this chapter had a reader and **no writer**. `panelsOf`, `membershipVerdict`,
`escapeAttempt`, `isolationBlocks`, `interiorModifiers`, `annotateFields`, the `NPFieldBehavior`
data model, `boundedFieldsOf` on the board projection and the isolation filter inside the
targeting resolver all shipped, tested, wired to each other — and `board.fields` was only ever
populated from Regions that nothing created. Asterios has carried six authored axes since he was
written and has never trapped anybody.

A field is a Foundry **Region** carrying an `npField` behaviour, for the reasons Ch. 42 gives for
terrain: membership is maintained natively, `tokenEnter`/`tokenExit` fire natively, and the shape
survives a reload without the engine having to remember anything. `engine/fields.mjs` is the write
half: `createField`, `endField`, `expireFields` and `runFieldEvents`.

### Dragging a Unit into one

Doomsday Come: *"During Pale Rider's Turn, if there are any enemy Units within a 2 panel area of
the Doomsday Come area, Pale Rider can target an enemy Unit within this Range, that target has to
perform an Evade roll. If the Evade failed, the DU is forcibly dragged into the Doomsday Come area
and placed on a random panel within. Can only be used once per Turn."*

Three things this needed, none of them Pale-Rider-shaped:

- **A `fieldEdge` anchor**, measured from the nearest panel of the *area* rather than from the
  caster. No existing anchor could express it, and the distinction is not academic: the area is
  anchored on his **Master** and may be the width of the board away from Pale Rider himself.
- **A `dragInto` phase.** It is an attack in every structural sense except that it deals no
  damage — it spends the Attack, marks him as having Acted, and opens **no Combat Process**,
  because there is no damage step for one to run. The displacement is `fgtForced`, so it neither
  spends the victim's move budget nor is re-validated as a voluntary step.
- **A `fieldOpen` requirement.** The drag is a clause *of* the Noble Phantasm taken on a later
  Turn, so it is authored as its own ability and gated on the area standing — better than a grant
  something has to remember to give and take away.

`randomFreePanelIn` picks the destination, and it clips to the **board's own bounds**: a field's
computed panels are not clipped to the board, so a 13×13 cast near an edge reaches past the last
column, and dropping a Unit there puts it wherever a negative coordinate clamps to — outside the
very area it was just dragged into. Found live.

### A field that is never cast

Pale Rider's Contagion has no activation at all: *"(Passive) The 2 panel area around Pale Rider
**is** the Contagion area."* There is nothing for `createField` to hang off, no duration for
`expireFields` to reach, and no cooldown.

`field.passive: true` marks one. `ensurePassiveFields()` reconciles them with the board — opening
one for every placed owner whose ability declares a passive field and has none open, closing every
open passive field whose owner has left the board or been defeated. It runs at `ready` and at every
Turn start, and it is **idempotent by design**: that is what makes it self-healing, so a Servant
summoned mid-match, a reloaded world or a hand-deleted Region is repaired at the next boundary
rather than needing a hook of its own.

**A bounded field is not a Noble Phantasm property.** `field` was declared on `NoblePhantasmData`
alone, because every field in the corpus up to this point belonged to one — Chaos Labyrinthos,
Unlimited Blade Works, Sikera Ušum, The Mist. Nothing in this chapter makes that a rule, and
Contagion is a **Skill**. Authored on an ability, its whole six-axis block was dropped by the
schema without a word: the Item existed, its `field` read `null`, and `ensurePassiveFields` found
nothing to open. `AbilityData` declares it too now, and
`test/unit/item-schema-coverage.test.mjs` fails the build if any authored key is missing from the
model its document compiles to.

> **And Asterios still did not trap anybody**, because the writer needs *calling*. `createField`
> is a **phase kind**, and *Chaos Labyrinthos* declared six axes and carried no `createField`
> phase — so it resolved as a pair of debuffs on an empty board and the Labyrinth never existed.
> EMIYA's *Unlimited Blade Works* has always carried the phase; this one never did.
>
> Two more of its own, both found the same way. Its targeting anchor was
> `{kind: selfCentred}`, **which is not an anchor this system has** — `resolveAnchor`'s default
> branch *throws*, so the largest bounded field in the corpus could not be used at all. And its
> activation debuffs were aimed at `[enemy, ally, self]` where the sheet says *"all **enemy**
> Units within the Labyrinth"*, so Asterios handed his own team and himself 40% Atk Dwn and 40%
> Def Dwn every time he opened it.
>
> The content validator now checks anchors and shapes against the resolver's own vocabulary
> (`ANCHOR_IDS`/`SHAPE_IDS`), which is how the first was found. The others needed a live board.
>
> Measured live afterwards: a 9×9 Region named for the ability, 81 panels, seven Units caught,
> both debuffs on the enemy and neither on Asterios, the EX Noble Phantasm cost of 75 charged to
> his Master, and **no damage** (§13.9) — and 11×11 / 121 panels with the war Region set to
> Greece, which `regionSizeOverride` had never been able to do because nothing read it and
> nothing set `board.warRegion` either (§19.3).

Four things about it are decisions rather than mechanics:

- **The anchor is stamped at cast time**, even for a `followsUnit` geometry, so a field whose
  anchor is later defeated still knows where it was — and a `fixedArea` one cannot silently start
  following its caster, which is the difference between a Reality Marble and a Labyrinth.
- **The expiry is absolute**, like every other duration in the system (§7.5). A countdown needs a
  hook that can fail to fire; an expiry tick cannot. It is enforced at the Turn boundary, along
  with `ownerDefeat` — a `duration` with nothing enforcing it is decoration, and for a
  total-isolation Reality Marble that means the match never ends.
- **Recasting replaces.** Two overlapping copies of one field would each answer the isolation
  question, and a Unit could be inside one and outside the other.
- **The behaviour is created as a second call.** Passing it inline in the Region's creation data
  is accepted without complaint and silently yields a Region with an **empty** `behaviors`
  collection. A rejected behaviour now deletes its Region and logs, because half a bounded field
  looks exactly like a working one.

**Implementation note.** `field.branches` (Ch. 32, Sikera Ušum) lets `createField` pick between
several `{predicate, geometry, duration, membership}` shapes for one ability — first match wins,
falling back to the base `geometry`/`duration`/`membership` when nothing matches or there are no
branches, the same shape `damage.branches`/`targeting.branches`/`cooldown.branches` (Ch. 15) pick
between an ability's several behaviours with. `geometry.anchorRef: "platform"` is the one addition
`panelsOf`'s `fixedArea`/`followsUnit` pair didn't have a use for before: it anchors the field to
a platform's own geometric centre (`rules/platforms.mjs#platformCentre`) instead of the caster's
own panel, for a field that names a fixed place on a platform rather than one that moves with
whoever cast it.

---

## 43.12 Interaction with existing subsystems

| Subsystem | Interaction |
|---|---|
| **Targeting** (Ch. 09) | Isolation adds a boundary filter alongside the cross-level filter. New anchor: `field` (target the field itself). New interaction mode E (freeform paint) for The Mist. |
| **Movement** (Ch. 08) | Exit restrictions are a **legality refusal** (`rules/movement.mjs#canPassThrough` asks `membershipVerdict` before every step), not an `Infinity` cost — a unit that cannot leave should never see the panel as reachable at all, the same distinction clause 3's occupancy check already draws; the escape roll is a movement *interruption* at the border |
| **Damage** (Ch. 13) | Interior rule elements use the ordinary stages; `[Anti-World]` breaking Doomsday Come applies a stage-15 −50% |
| **Effects** (Ch. 11) | The duel field's source-scoped suppression is a new `Suppress` selector |
| **Terrain** (Ch. 42) | Fields may *carry* terrain (Piedra Del Sol is Burning); the two systems compose without interacting |
| **Platforms** (Ch. 20) | HGoB is both a platform and a bounded field — the only thing that is both |
| **Time** (Ch. 07) | Scheduled detonation and state history both hang off the global turn index |

---

## 43.13 Summary of decisions

| # | Decision |
|---|---|
| D43.1 | Bounded fields are a distinct family with a six-axis model, not platforms and not terrain. |
| D43.2 | NP tags form an ordered scale (`Anti-Unit < Anti-Army < Anti-Fortress < Anti-Country < Anti-World`) plus unordered qualifiers; comparisons use the highest scale tag; `???` never satisfies a threshold. |
| D43.3 | `normalHuman` is `attribute:human && kind:civilian` — Masters are excluded. |
| D43.4 | Freeform field geometry gets a paint-style canvas tool (targeting interaction mode E). |
| D43.5 | Mark-defined fields are `Structure` actors with a linked field, so destruction and visibility come free. |
| D43.6 | Paid extension (`ExtensionSpec`) is a declarative field property. |
| D43.7 | `kind: schedule` phases register a cancellable callback on the global turn index; sealed NPs already launched still fire. |
| D43.8 | State history is a gated, diffed, per-turn ring buffer, recorded only when a history-dependent ability is in play. |
| D43.9 | Rewind excludes position, facing, budget and contract state; orphaned effect instances are dropped and logged. |
| D43.10 | A field is a Region with an `npField` behaviour, created by `engine/fields.mjs`; its expiry is absolute and enforced at the Turn boundary, and recasting replaces rather than layering. |
| D43.11 | Interior rules split by kind: `StatDelta`/`MovDelta`/`RangeDelta` fold onto the unit snapshot, everything else goes to `modifiers`. The owner's relation to its own field is `self`. |
| D43.12 | `interiorEvents` is a seventh field property, for rules that fire at a time boundary rather than standing — they belong to the area, not to its caster. |

---

**Next:** [44 — Case Studies: The Expanded Roster](44-case-expanded-roster.md)
