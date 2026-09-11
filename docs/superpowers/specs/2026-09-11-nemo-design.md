# Nemo — Design

**Source sheet:** `char_orig_sheets/Copia de Nemo.md`
**Structural chapters:** Ch. 20 §20.6 (the Storm Border), Ch. 36 §36.6 (Quickfire, Triton's Conch)
**Date:** 2026-09-11

**Goal.** Captain Nemo plays exactly as his sheet reads: twelve clauses, four of which need
engine mechanisms that do not exist, and one of which — Zero Sail — is a pocket dimension with
an entry roll, a clock, a relocation, a capability restriction and a catastrophic failure mode.

**Method.** Every commit pairs an engine addition with the clause that consumes it. Nothing
lands inert. This project names "a rule that is right and inert" as its dominant defect, and
Nemo arrives with one already waiting for him: `rules/damage/pipeline.mjs` stage 6 is *named
after Triton's Conch*, reads `ctx.bandMultiplier`, and nothing in the repository writes that
field.

---

## 1. What the sheet says, and what each clause costs

| # | Clause | Mechanism | Status |
|---|---|---|---|
| 1 | Stats, attributes, Sustainability | content only | tables already agree |
| 2 | Normal Attack — MAG, Water, 10% Slow 1◈ | content only | `normalAttack.mode: fixed` + rider |
| 3 | Riding A+ (3 passives + Active) | `{ref: class-riding}` | `ridingMov` A+ → 5 |
| 4 | Divinity A — all damage +50 incl. NP | `{ref: divinity}` | `divinity` A → 50 |
| 5 | Poseidon's Protection B | **`terrain:` facet**, component-scoped `CritModifier` | facet absent |
| 6 | Voyager of the Storm C++ | conditional anchor | new anchor branch |
| 7 | Indomitable B+ | **`indomited` effect** + `unitRevived` | effect absent |
| 8 | Journey's Guidance C++ | conditional anchor, doubled application | — |
| 9 | **Zero Sail** | **the dimension subsystem** | nothing built |
| 10 | **Quickfire** | **`kind: diceCount`**, **two-sided bypass**, Evade override | nothing built |
| 11 | **Triton's Conch** | **band plumbing**, per-band chance, **`deafen`** | stage 6 inert |
| 12 | Barrel Bombing | two-sided bypass (shared with #10) | — |
| 13 | Great Ram Nautilus (NP) | **`aim` effect**, conditional self-buffs | effect absent |

### 1.1 The numbers agree with the tables

Nemo's sheet states figures that `domain/tables.mjs` independently derives, and they match at
every point — so no arbitration is needed and none of them is authored as a literal override:

- STR C → `baseAttackStrByStr` 100. Sheet: *"Base Attack (STR): 100"*. ✔
- MAG A → `baseAttackMagByMag` 200. Sheet: *"Base Attack (MAG): 200"*. ✔
- END B → Health 1250. Sheet: *"Base Health: 1250"*. ✔
- Divinity A → `divinity` 50. Sheet: *"All damage dealt is increased by 50 including NP"*. ✔
- Riding A+ → `ridingMov` 5 (`perStep: 0`, so A+ and A agree). Sheet: *"Increases MOV by 5"*. ✔
- Riding A+ → `ridingCooldown` 3◈. Sheet: *"Cooldown: 3◈-⅓◈"* — the base plus a ⅓◈ regen. ✔

---

## 2. Rulings

Two readings of the sheet were settled by the author before design, and both are load-bearing.

### R1 — Zero Sail's restriction bars only Large/Giant creation

> *"Units within the Storm Border cannot use Skills, NP, or any other ability that creates a
> Unit/Item/object that has the 'Large' or 'Giant' Attribute."*

Read as **one** restriction with three subjects, not three restrictions: *cannot use [Skills,
NPs, or any other ability] **that create** a Large/Giant Unit/Item/object*. Skills and Noble
Phantasms are otherwise usable inside.

This is the only reading under which the sheet is self-consistent. Voyager of the Storm and
Journey's Guidance each say *"or if Zero Sail is activated, affects all allied Units within the
Storm Border"* — a branch that can only fire if Nemo can use a Skill while submerged. Under the
alternative reading, two of his five Skills carry a clause that can never execute.

It also reads as the sensible guard: the Storm Border is itself `large`, and what the clause
prevents is nesting one Large object inside another.

**Consequence: docs/20 §20.6 is wrong and must be corrected.** It currently reads *"Note
`restrictions` forbidding **all** Skills and NPs inside — so the Storm Border is a pure
repositioning tool, not a combat platform"*, and instructs the UI to warn players that entering
disables their kit. That paragraph is replaced in the commit that builds the restriction.

### R2 — The Storm Border has no combat statistics

`packs/_source/platforms/storm-border.yml` was authored from Ch. 20 §20.5's general platform
model and carries 3000 Health, MOV 8, Range 6, Base Attack (MAG) 220 and a 5×3 footprint.
**Nemo's sheet grants it none of those.** It has no Health line, no attack, and no movement of
its own — units inside *"still take their Turn normally"*, and where it surfaces is Nemo's
decision, not a move.

The actor is kept as the dimension's carrier and the unsourced statistics are removed, with the
removal recorded in the file's header comment rather than silently dropped.

### R4 — Nemo's Class is derived, not stated — **needs confirmation**

The sheet has no Class line. Every other conversion source states one; this one gives only
*"(Nemo) Class Skill: **Riding** — Rank: A+"*, and Riding is the Rider container's class skill,
so `servantClasses: [rider]`.

This is not cosmetic. The Class container decides base Detect (`rules/identity.mjs`), which
column of `npCostByRank` his Master pays, and which class-skill grants he is eligible for. It is
recorded here as an assumption to be confirmed before Task 1 rather than discovered later.

Note also that the sheet grants him **Riding alone** — no Magic Resistance, which Rider normally
carries. Authored as written: one class-skill ref, not two.

### R3 — Two judgement calls, recorded rather than escalated

- *"places all Units within the Storm Border onto a 5x5 panel area on the board … in any
  orientation"* — the group's relative formation is preserved and may be rotated in 90° steps,
  clamped into the 5×5. "Orientation" reads as rotating a formation; free per-unit placement is
  a much larger affordance and a different word.
- *"excluding enemy Home Bases"* — the 5×5 may not **overlap** an enemy Home Base, not merely
  may not be centred on one.

---

## 3. The content

Sixteen files under `packs/_source/`, in the house style: a header comment citing the sheet
line, the clause quoted beside the data that implements it, and anything unmodelled recorded
explicitly rather than left to look implemented.

### 3.1 `servants/nemo.yml`

```yaml
trueName: "Captain Nemo"          # "Captain Nemo, Triton"
servantClasses: [rider]           # derived, not stated — see R4
alignment: { order: chaotic, morality: neutral }
region: [eastIndia, greece]       # "East India, Greece"
attributes: [male, servant, sky, humanoid]
parameters: { str: C, end: B, agi: C, mag: A, luc: A }
baseHealth: 1250
mov: 6
range: { panels: 3, targets: 1 }
baseAttack: { str: 100, mag: 200 }
normalAttack: { mode: fixed, component: mag, element: water }
sustainability: "2◈"
```

The Normal Attack's *"10% chance of inflicting Slow for 1◈ Turns"* is an on-hit rider —
`OnEvent: damageDealt` applying `slow` at `chance: 10` — which is the rung Serenity built and
the same shape every *"Normal Attacks inflict X"* clause in the catalogue uses.

`eastIndia` and `greece` are both already in `REGION_ADJACENCY`, and `eastIndia` is a **distinct
region from `india`** in that graph — the sheet says *"East India"*, so it is the former. No
graph change is needed.

### 3.2 Two refs, no new files

```yaml
- { ref: class-riding, rank: "A+", cooldown: "3◈-⅓◈" }
- { ref: divinity, rank: A }
```

Riding's three passives (`doubleMove`, `ridingAttack`, `passengerSeat`) are already granted by
`class-riding` and already performed by `engine/riding.mjs`, including the clause the sheet
restates — *"if the Unit has already Moved … the number of panels it can Move for its Riding
Attack is equal to its MOV minus the number of panels it has already Moved"* — which is
`turnState.movedPanels` as a running total. Riding's Active is already `isBuff: false`, which
is the sheet's *"not a buff and cannot be removed by buff removal effects, or prevented by an
effect that prevents buffs from being applied"*, already built.

**Nemo adds nothing to Riding.** That is worth stating: the sheet's longest class-skill block
costs one line of content.

### 3.3 Nine ability files

`nemo-poseidons-protection`, `nemo-voyager-of-the-storm`, `nemo-indomitable`,
`nemo-journeys-guidance`, `nemo-zero-sail`, `nemo-quickfire`, `nemo-tritons-conch`,
`nemo-barrel-bombing`, `nemo-great-ram-nautilus`.

### 3.4 Four effect files

| id | Why it does not exist yet |
|---|---|
| `deafen` | `rules/identity.mjs` has reduced Detect by 1 for a `deafen` id since it was written. Nothing in the game could apply one. Evade +2, MOV −1, Detect −1. |
| `aim` | Appendix A §A.3 catalogues it (*"ignores `Dodge` and the Evade action; beaten by `Substitution`"*) and no content defines it. The NP's Waterside branch is its first user. |
| `indomited` | Nemo's twin of Heracles's `indomitable`: listens for `unitRevived`, but pays NP cooldown reduction rather than Atk Up, and carries `uses: 1`. |
| `erase` | `severity: erase`, for Zero Sail's failure branch. `fgt.unitErased` is already specified as **not** incrementing the Grail counter. |

### 3.5 One rewrite

`platforms/storm-border.yml` — per R2, and gaining the `dimension` block in §5.

---

## 4. The six engine mechanisms

### 4.1 A `terrain:` predicate facet

`rules/facets.mjs` holds 35 facets and not one of them can ask what a unit is standing in. Nemo
gates **four** clauses on *"within a 'Waterside' or 'Imaginary Numbers Space' area"*, so the
condition is currently unsayable.

`rules/terrain.mjs#terrainAt(panel, board)` already answers the question. The facet exposes it
to `rollOptionsFor`, emitting `self:terrain:waterside` and `target:terrain:<type>`. Value kind
is `registry` against `TERRAIN`'s keys — a closed enum would be wrong, because terrain types are
content-adjacent and the table grows.

Plus `imaginaryNumbers` as a new `TERRAIN` entry. It carries **no standing effects** — the
empty list is its finished state, the way `sunlight`/`darkness`/`indoors` are. Nemo's
Imaginary Numbers clauses are all on his own abilities; the space itself modifies nobody.

### 4.2 Band → `ctx.bandMultiplier`

Stage 6 exists, is named after this Servant, and is unreachable:

```js
function stage6Band(s) {
  const m = s.ctx.bandMultiplier ?? 1;      // written by nothing
```

`resolveTargets` already returns a `band` index per target (`shapes.mjs`'s `banded` case builds
a panel→band map, `toTargeted` reads it). The gap is entirely in the middle: `engine/attack.mjs`
drops `band` on the floor when it builds the damage context for each defender in the fan-out.

**Two consumers, not one.** The multiplier is only half of Triton's Conch — *"If the Unit was 2
panels away from Nemo, the chance of being inflicted with Deafen is 50% instead"* means the
`applyEffects` phase must read the same band. So `band` is carried on the resolved target and
read by both, rather than being passed to the pipeline alone.

Authored shape:

```yaml
targeting:
  shape:
    kind: banded
    bands: [{ maxDistance: 1 }, { maxDistance: 2 }]
damage:
  bands: [{ multiplier: 1.5 }, { multiplier: 0.5 }]
```

### 4.3 Two-sided `bypassModifiers`

Today it is all-or-nothing:

```js
if (ctx.attack?.isFixedDamage || ctx.attack?.bypassModifiers) {
  stage16AbsorptionAndClamp(state);   // stages 2-15 skipped entirely
```

That is correct for Fixed damage, whose own definition is *"not affected by any damage modifying
effect on **both** the AU and DU"*. It is wrong for Nemo, who says something narrower twice:

> Quickfire: *"Damage of this Attack Skill is not affected by damaging modifying effects **on
> Nemo**."*
> Barrel Bombing: the identical sentence.

The defender's Def Up, Dmg Cut, Block and Magic Resistance all still apply. docs/13 §13.8 already
specifies the two-sided form; Ch. 36 §36.6 predicted *"its only user here"* and there are two.

`bypassModifiers: {attacker: true, defender: false}` skips the attacker-side buckets (stages 3,
4-attacker, 5, 7, 8, 9, 10) and runs the defender-side ones (11–15). A bare `true` keeps its
current meaning, so no authored content changes behaviour.

### 4.4 `kind: diceCount`

> *"Roll 6 six-sided die, this Attack Skill deals 25 STR damage for each die that rolls X or
> higher, where X=5."*

A new base-spec kind resolved at stage 1:

```yaml
damage:
  formula:
    kind: diceCount
    dice: "6d6"
    threshold:
      base: 5
      modifiers:
        - { delta: +1, predicate: ["defender:reaction:evade"] }
        - { delta: -1, predicate: [{ lte: ["@distance", 2] }] }
        - { delta: -1, predicate: [{ anyOf: ["target:effect:slow",
                                             "target:effect:immobilize",
                                             "target:effect:stun"] }] }
        - { delta: -1, predicate: [{ lte: ["@target.agility.value",
                                           "@self.agility.value"] }] }
    perSuccess: { amount: 25, component: str }
  bypassModifiers: { attacker: true, defender: false }
  singleInjuryRoll: true
```

**The threshold computation goes into the roll log.** Each modifier's verdict is recorded with
its predicate rendered as prose — `explain()` already does this for failed predicates — so the
chat card says *why* X was 3 rather than presenting a number nobody can check. A four-modifier
threshold that arrives unexplained is exactly the kind of output this project's audit trail
exists to prevent.

`singleInjuryRoll` and the `perSuccess` shape need no new work: `engine/attack.mjs` already
implements the single-injury-roll rendezvous across sibling processes.

### 4.5 An Evade-replacement reaction override

> *"Plus 1 if — 1. The enemy Unit Evades **(instead of performing an Evade roll)**."*

Choosing Evade against Quickfire does not roll and does not avoid the attack. It raises Nemo's
threshold by 1 and the attack proceeds. The reaction ladder has no concept of an ability
redefining what a rung *means*; it has `ForbidReaction`, which removes the rung entirely, and
that is a different rule — a defender who cannot evade also cannot worsen the threshold.

A per-ability `reactionOverride: {evade: {kind: "noRoll", emits: "defender:reaction:evade"}}`,
read where the ladder offers Evade. The emitted option is what modifier 1 above tests.

### 4.6 `ForbidCreating`

One new rule element — the 55th — refusing an ability whose summon/structure/platform output
carries `large` or `giant` while its user is inside a dimension that declares the restriction.
Per R1 this is the *whole* of Zero Sail's restriction list.

---

## 5. Zero Sail

Ch. 20 §20.6's own decision governs: *"Model as a platform with `footprint: null`, a
`relocateOnExit` spec and a `restrictions` list. The general platform machinery covers it; only
`relocateOnExit` is new."*

The dimension spec lives on **the platform**, not on the ability, so the Storm Border describes
what it is and the ability only says *enter it*:

```yaml
# storm-border.yml
dimension:
  levelName: "Imaginary Numbers Space"
  terrainTags: [imaginaryNumbers]
  entry:
    allies:  { range: 2, automatic: true, chooser: chosen }
    enemies: { range: 3, roll: "1d20", successOn: 18 }
  maxDuration: "2◈"
  forceExitAt: maxDuration
  relocateOnExit:
    shape: { kind: rect, w: 5, h: 5 }
    maxDistance: "2 + floor(turnsInside / ⅓◈)"
    forbidZones: [enemyHomeBase]
  restrictions:
    - { key: ForbidCreating, attributes: [large, giant] }
  onOwnerDefeat:
    check: luck
    onSuccess: { action: resurface, ownerStillDefeated: true }
    onFailure: { action: applyToAll, effect: erase }
```

### 5.1 `maxDistance` is the one place the sheet's arithmetic cannot be copied

> *"This distance is 2+X panels, where X=1 for every ⅓◈ Turns spent within Imaginary Numbers
> Space (e.g. 1◈ Turns spent in Imaginary Numbers Space, Nemo can travel 2+3=5 panels)."*

◈ is turns-per-round and **varies by war variant** — 3 for the Great Holy Grail War, 8 for the
Holy Grail War, 15 for post-True-Masters Snowfield (`domain/tick.mjs`). The worked example holds
only at 3: there ⅓◈ is 1 turn, 1◈ is 3 turns, X = 3, distance 5. At 8 turns/round ⅓◈ is 2 turns,
1◈ is 8 turns, X = 4, distance 6.

Authoring the expression rather than the literal 5 is precisely what the tick model exists for
(success criterion SC-3: *"content is authored once and resolves correctly in every variant"*).
At the 2◈ ceiling and 3 turns/round, maximum X is 6 and maximum distance 8.

### 5.2 `module/engine/dimension.mjs` — layer 3, four entry points

**`enterDimension({ownerId, platformId})`**
Resolves allies within 2 through the existing chooser; rolls `1d20` per enemy within 3 **into
the roll log**, so the 18+ threshold and every roll against it are auditable rather than
asserted; hands the manifest to the existing `activatePlatform()`, which already creates the
Scene Level, moves the units onto it, and sinks the platform token beneath its passengers.
Stamps the entry tick.

**`resurface({platformId, at, orientation, forced})`**
Computes `2 + floor(turnsInside / ⅓◈)`; validates the destination against that radius and
against enemy Home Base panels (R3); places the units preserving formation; tears the level down
through the existing `scene-levels.mjs#teardown`; starts the cooldown.

The cooldown is *"5◈ Turns **after Nemo resurfaces**"* — `cooldown: {max: "5◈", countFrom:
"deactivation"}`. Both the field and the semantics already exist and are used by Jack's Mist and
Presence Concealment; Zero Sail is the third user, not a new mechanism.

**A scheduler hook at `maxDuration`** for the forced resurface. `scheduler-hooks.mjs` already
runs upkeep and expiry sweeps at the turn boundary.

**`onOwnerDefeat`** wired into `resolveDefeat`, which is the only place that knows a defeat is
final — it already owns the revival chain and fires `unitRevived` / `unitDefeated`. Ordering
matters and the sheet states it: *"he performs a Luck Check **before dying**"*, and on success
*"the Storm Border immediately resurfaces (**but he is still defeated**)"*. The check is not a
revival and must not be mistaken for one.

### 5.3 Two affordances

- **The resurface offer** — *"At the end of any Turn, Nemo can choose to resurface"* — through
  the existing pending panel. `OfferAbilityUse` already places end-of-turn offers there.
- **A placement pass** on the existing targeting layer, constrained to the computed disc with
  enemy Home Base panels excluded, showing the 5×5 and its rotation.

### 5.4 What the restriction is *not*

Under R1, nothing blocks a passenger's Skills or Noble Phantasms. The UI warning Ch. 20 §20.6
demands (*"the UI must make that obvious before a player enters and finds their entire kit
disabled"*) is therefore **not built**, because the situation it warns about does not arise.
That chapter paragraph is corrected in the same commit.

---

## 6. Testing and verification

### 6.1 Unit tests are the regression net, not the evidence

`test/unit/nemo.test.mjs` in the house pattern — one `describe` per sheet clause, quoting the
clause it holds. Mechanism tests land beside the code they cover: band multiplier, `diceCount`,
two-sided bypass, the terrain facet, the dimension.

Green tests are not proof that a Servant plays correctly. Asterios and Karna were both listed as
authored while six of Asterios's clauses had no reader and nine of Karna's thirteen abilities
did not exist (Ch. 45), and every unit test passed throughout.

### 6.2 The live proof in `fgt_2026`

**Every clause, demonstrated on a real board, one screenshot each.** The loop is already tooled:

- `node tools/fgt-rebuild.mjs` — shuts the world down (the only thing that releases the LevelDB;
  the application holds the files open even with the tab closed), rebuilds the packs, relaunches,
  rejoins. Never a bare `npm run build:packs`.
- Bringing the world up needs a Foundry tab open over CDP **first**; `fgt-world.mjs launch` with
  no page reports `pages: []` and fails silently.
- `tools/fgt-eval.mjs` for scenario setup and state assertions inside the running page.
- claude-in-chrome for the visual pass and the screenshots.

**The numeric evidence is the chat-card damage breakdown**, which already renders each pipeline
stage by name. Divinity's +50 appears as a labelled line at stage 7, Poseidon's −50/−100 at
stage 12, and Triton's Conch's 1.5×/0.5× at stage 6 — read off the card rather than inferred
from a total.

### 6.3 The clause checklist

1. Normal Attack — MAG 200, Water, Slow on a 10% rider
2. Riding — Double Move, Riding Attack, Passenger Seat, Active +5 MOV, and the MOV-minus-moved
   arithmetic when both are used in one Turn
3. Divinity — +50 visible in a breakdown, on a Skill and on the NP
4. Poseidon's Protection — crit damage +10% on a MAG attack and **not** on the NP; −50 taken on
   Waterside and −100 against an NP there; both off Waterside
5. Voyager of the Storm — the 2-panel branch, the Waterside branch, and the Storm Border branch
6. Indomitable — NP cooldown −1◈, then Guts at 20%, then the `Indomited` payout on revival
7. Journey's Guidance — Atk Up, S.Crit Up, and Effect 1 applied **twice** on Waterside
8. Zero Sail — entry rolls, the clock, the forced resurface, the chosen resurface with the
   computed distance, the Large/Giant restriction, and the Luck Check on Nemo's defeat
9. Quickfire — each threshold modifier in isolation and compounded; the no-Counter cooldown
   refund; the single Injury Roll; attacker-side bypass with a defender's Def Up still applying
10. Triton's Conch — 1.5× adjacent, 0.5× at 2, Deafen at 100% and at 50%
11. Barrel Bombing — the 3×3 non-diagonal block, 150 Fire, Burn 2◈, attacker-side bypass
12. Great Ram Nautilus — 4× damage, +150% against a Large target, and the three Waterside
    self-buffs

---

## 7. Out of scope

- **Anything not on Nemo's sheet.** The Storm Border gains no combat statistics (R2) and no
  Noble Phantasm of its own.
- **A board-size-dependent footprint.** The sheet does not state one, and there is no board-size
  setting for a platform footprint to key off — the same constraint the Hanging Gardens records.
- **`Erase`'s interaction with the Grail counter beyond the specified one.** `fgt.unitErased` is
  already specified as not incrementing it; nothing further is built.

---

## 8. Documentation

Per the standing rule, every commit updates the affected chapter **and** `docs/45`:

- **`docs/20-platforms-and-levels.md` §20.6** — corrected for R1 (the restriction bars only
  Large/Giant creation), R2 (no combat statistics), and the `maxDistance` expression.
- **`docs/36-case-remaining.md` §36.6** — Quickfire's and Triton's Conch's sketches reconciled
  with what was built.
- **`docs/A-effect-catalogue.md`** — `deafen`, `aim`, `indomited`, `erase` marked authored.
- **`docs/C-dice-registry.md`** — Quickfire's `6d6` and Zero Sail's entry `1d20`.
- **`docs/D-servant-data-sheets.md`** — Nemo's data sheet.
- **`docs/13-damage-pipeline.md` §13.8** — two-sided `bypassModifiers`, now with users.
- **`docs/24-rules-engine.md` §24.4** — the `terrain:` facet.
- **`docs/42-terrain.md`** — `imaginaryNumbers`.
- **`docs/45-implementation-status.md`** — Nemo, and the four mechanisms.
