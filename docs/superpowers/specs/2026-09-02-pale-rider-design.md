# Pale Rider — design

**Date:** 2026-09-02
**Source:** `char_orig_sheets/Copia de Pale Rider.md`
**Chapters affected:** [04 — Units](../../04-units.md), [06 — Stats and Resources](../../06-stats-and-resources.md),
[09 — Targeting](../../09-targeting.md), [16 — Relationships](../../16-relationships.md),
[24 — Rules Engine](../../24-rules-engine.md), [43 — Bounded Fields](../../43-bounded-fields.md),
[44 — Case: Expanded Roster](../../44-case-expanded-roster.md), [45 — Implementation Status](../../45-implementation-status.md),
[A — Effect Catalogue](../../A-effect-catalogue.md), [D — Servant Data Sheets](../../D-servant-data-sheets.md),
[E — Event Reference](../../E-event-reference.md)

---

## 1. The problem

Pale Rider is the strongest argument in the corpus for the snapshot/intent boundary (Ch. D
§D.26): almost nothing on his sheet is an attack. He cannot be damaged, cannot attack, cannot
react. Everything he does happens *around* him — an area that leaks Health, a moving prison
anchored to his Master, an aura of parameter-keyed effects, and four summoned spirits that hunt
their assigned enemy. A design that had grown outward from "attacker hits defender" would need a
special case for every line.

The bounded-field model of Ch. 43 is what makes him buildable without one. What is missing is
narrower than it looks, and all of it is general:

| Sheet clause | What the engine lacks |
|---|---|
| *Base Health: —* / *cannot take damage* | `health: null` is already the convention and the pipeline already halts on it; `ServantData#prepareBaseData` **backfills** a null max from the END table |
| *cannot perform Normal Attacks* / *cannot Evade, Block, or Counter* | No grant says either |
| *Master's ZON is increased by X, X = MOV* | `ZonBonus` takes a number, not a stat |
| Contagion: *the 2 panel area around Pale Rider* | Fields exist only between a cast and an expiry; nothing is passive |
| Contagion Active: *5×5 becomes 9×9 for 1◈* / *within Doomsday, affects the NP area instead* | A field's geometry cannot change while it stands |
| Contagion: *Health reduced by 100 … does not count as 'damage'* | Field events have `Damage` (the pipeline) and `ApplyEffect`; no plain Health write, no `chance` |
| Innocent World | D.26 files it as a **Script**; `Script` is emitted and **no registry exists** |
| Guidance of the Netherworld's `GotN` | Nothing stores an effect for later; nothing filters a field event by an effect the unit carries |
| Doomsday Come: *X = 2 + 1d4* | A field's size cannot be rolled |
| Doomsday Come: *extend by 1◈ for 100 of the Master's Health* | `extension` is **authored on Chaos Labyrinthos and run by nothing** |
| Doomsday Come: *an [Anti-World] NP … ends it, damage −50%* | No isolation exception, no NP-scale option, no vulnerability kind |
| Doomsday Come: *drag an enemy within 2 panels of the area inside* | No anchor is measured from a field's edge; no non-damaging forced entry |
| Kagome Spirits: *one per enemy, same one on reactivation* | Summons have no per-target binding and no memory |
| Kagome Spirits: *constantly Move towards that Unit and Attack it* | Nothing constrains a move by distance to a target; `ForceTarget` exists for the attack half |
| Kagome Spirits: *a Light or anti-Dark attack banishes it for 1◈/2◈* | No defender-side declaration event; nothing hides a token for a span |
| *Relationship Rules apply between Kagome Spirits and the Master instead* | `RelationshipProxy` is emitted and **read by nothing**; never authored |
| Charm, Regen, Dmg Cut | Catalogued in Appendix A; no content files |

Three decisions were taken in conversation and are fixed here:

1. **Kagome Spirits are player-driven and rule-constrained**, not automata. The engine refuses a
   move that does not close on the assigned enemy and refuses an attack on anyone else;
   *"constantly"* is a constraint, not an AI.
2. **A trapped enemy the Master walks away from is left outside.** Membership is positional; no
   field ever carries a unit. The Master's player chooses between keeping prisoners and moving.
3. **Everything area-shaped is a bounded field** (approach A). No script registry, no aura events.

---

## 2. The unit, its class skills, and its effects

### 2.1 A Servant with no Health

`baseHealth: null` on the sheet, and a new schema flag on `unitCommon()`:

```js
undamageable: new fields.BooleanField({ initial: false }),
```

`ServantData#prepareBaseData` (and `SummonData`'s) returns early when it is set, leaving
`health.value` and `health.max` at `null`. From there nothing is new: the snapshot already reads
`null` as "cannot be damaged and cannot be healed", `rules/damage/pipeline.mjs` already halts at
stage 0 with `invulnerable-by-nature`, and `desync.mjs`/`io.mjs` already honour it. The flag
exists only so the backfill stands aside.

### 2.2 Two new grants

Beside `doubleMove`, `ridingAttack` and `passengerSeat` in `rules/granted.mjs`:

| Grant | Reader |
|---|---|
| `noNormalAttack` | `engine/attack.mjs#resolveAttack` refuses a declaration with no ability, naming the grant |
| `noReactions` | `engine/attack.mjs#offeredReactions` returns nothing, and the defender's rung offers only *nothing* |

Kagome Spirits carry both as well (their sheets say "cannot be damaged"; their attacks are
Normal Attacks, so only `noReactions` applies to them).

### 2.3 ZON from MOV

`ZonBonus` gains `fromStat`. `rules/zon.mjs#zonRadius` already receives the Servant snapshot;
a bonus with `fromStat: "mov"` resolves to `servant.mov` there, `stacks: true`.

**Read literally:** Riding's Active is `+6 MOV for this Turn`, and `mov` on the snapshot includes
it, so the Master's ZON swells by six on that Turn. The sheet gives no reason to cap it. Flagged
rather than silently capped.

### 2.4 Class skills

- `class-riding` at **EX**, with a `riding-ex.yml` variant carrying the four Pale Rider passives
  (the `undamageable` flag, the two grants, and the `ZonBonus fromStat: mov`) — the same way
  Presence Concealment's rank table gives Serenity and Jack different numbers off one skill.
  Its Active is the ordinary `MovDelta +6, this turn, isBuff: false`.
- `class-magic-resistance` at **C**, unchanged. Vestigial for damage; Passive 2's −15% debuff
  chance still works.

### 2.5 New effects

| Id | Shape | Existing reader |
|---|---|---|
| `charm` | mental debuff, `defaultDuration: "1◈"`, control transfer | `rules/control.mjs#isCharmed` looks for exactly this id |
| `regen` | periodic heal, 10% of max, `triggers: [turnEnd, actedTurnEnd, roundEnd]`, *does not fire on the turn it ends* | the periodic runner |
| `dmgCut` | `DamageNegation` flat −100, `includesNP: true`, `uses: 3`, not bypassed by Pierce | `DamageNegation` — **gains `uses`**, spent by the same `consumeUse` path `AutoSucceed` already uses; the executor carries no charge count today |
| `gotn` | `polarity: status`, `valence: neither`, `unremovable: true`, **no rules** | a marker (§4) |
| `contagionExpanded` | `polarity: status`, no rules, `defaultDuration: "1◈"` | a marker (§3) |

---

## 3. Contagion

### 3.1 Passive fields

`field.passive: true` marks a field that is neither cast nor ended. `engine/fields.mjs#
ensurePassiveFields()` runs at `ready` and at every `turnStart`: for each placed unit whose
abilities declare a passive field with no open Region, it creates one; for each open passive
field whose owner has left the board, it closes one. No phase, no cooldown, no `duration`.

### 3.2 Geometry that reads the board

`panelsOf` gains one clause. A geometry may carry `overrides`, tested in order, first match wins:

```yaml
field:
  passive: true
  geometry:
    kind: followsUnit                      # the owner, by default
    shape: { kind: square, size: 5 }
    overrides:
      - { whileOwnerHas: contagionExpanded, shape: { kind: square, size: 9 } }
      - { whileFieldOpen: pale-rider-doomsday-come, sameAs: pale-rider-doomsday-come }
```

`whileOwnerHas` reads the owner's effect list off the board; `whileFieldOpen`/`sameAs` reads
another open field's panels. Both are pure — `panelsOf` already takes the board.

The Active is therefore `applyEffects: [{ id: contagionExpanded, duration: "1◈" }]` on himself,
with `cooldown: "4◈"`. No timer of its own.

### 3.3 The triggers

Two `interiorEvents`, both on boundaries the scheduler already fires:

| Trigger | Event | Scope |
|---|---|---|
| *At the end of Pale Rider's Turn: all enemy Units within* | `unitTurnEnd` (owner's own turn end; **new dispatcher**, the event already exists in §E) | `relations: [enemy]` |
| *An enemy ended its Turn inside, or Acted and ended inside* | `turnEnd` + `actedTurnEnd` with `requiresActed` | that unit only |

Two engine additions to `runFieldEvent`:

- **`HealthLoss`** — `I.statDelta(unit, "health.value", -amount)`. Never the pipeline, never
  `fgt.damageTaken`; *"does not count as 'damage'"*. It still reaches zero and still defeats.
- **`chance`** on `ApplyEffect` — a `1d100` per unit, through the existing `chance()` helper.

```yaml
onFail:
  - { key: HealthLoss, amount: 100 }
  - { key: ApplyEffect, effect: { id: poison }, chance: 50 }
  - { key: ApplyEffect, effect: { id: charm }, duration: "1◈", chance: 10 }
```

### 3.4 The Doomsday rewrite

*"75% Poison, 25% Charm; and 150 if within 3 panels of Pale Rider's Master."* Field events gain
`branches`, selected per unit against its option set — the same first-match shape `damage.branches`
uses — with a new option `target:withinOfOwnerMaster:<n>` emitted beside `inField`:

```yaml
branches:
  - predicate: ["self:inField:pale-rider-doomsday-come", "self:withinOfOwnerMaster:3"]
    onFail: [{ key: HealthLoss, amount: 150 }, { key: ApplyEffect, effect: { id: poison }, chance: 75 }, …]
  - predicate: ["self:inField:pale-rider-doomsday-come"]
    onFail: [{ key: HealthLoss, amount: 100 }, …75 / 25…]
  - predicate: []
    onFail: [{ key: HealthLoss, amount: 100 }, …50 / 10…]
```

---

## 4. Guidance of the Netherworld

The Active is ordinary: `applyEffects` with its own targeting (allies within 2, self included —
EMIYA's Eye of the Mind EX shape) for Atk Up 20/10, Regen, and Dmg Cut ×3, then a second phase
applying `gotn` with `includeSelf: false`. `cooldown: "4◈"`.

The discharge is Doomsday's, as a `contact` event with a **`requiresEffect`** filter (the mirror
of `kinds:`) and a **`RemoveEffect`** action:

```yaml
- event: contact
  relations: [ally]
  requiresEffect: gotn
  onFail:
    - { key: ApplyEffect, effect: { id: atkUp, magnitude: 20, npMagnitude: 10 }, duration: "1◈" }
    - { key: ApplyEffect, effect: { id: regen }, duration: "1◈" }
    - { key: ApplyEffect, effect: { id: dmgCut, magnitude: 100, uses: 3 }, duration: "1◈" }
    - { key: RemoveEffect, effect: { id: gotn } }
```

`contact` fires on walking in **and** on the field closing over you, so a bearer standing where
Doomsday opens discharges — which is what *"enters the area"* has to mean for a field that
appears around you.

**GotN stores nothing.** The bundle is authored on the one field that will ever discharge it. An
effect that carries an unapplied payload has no second consumer and would be a subsystem.

---

## 5. Doomsday Come

### 5.1 The six axes

| Axis | Spec | Status |
|---|---|---|
| Geometry | `followsUnit`, `unitRef: ownerMaster`, `shape: { kind: square, radiusRoll: "2+1d4" }` | `ownerMaster` exists; **`radiusRoll`** rolled once at cast, stored as `geometry.radius`, size = 2r+1 (7×7 … 13×13) |
| Membership | `allyEntry: free, allyExit: free, enemyEntry: free, enemyExit: sealed` | exists |
| Isolation | both `…CanTarget…: false`, `piercedBy: { npScale: antiWorld }` | **`piercedBy` new** |
| Duration | `"2◈"` | exists |
| Extension | `cost: { kind: health, amount: 100, payer: ownerMaster, minimum: 100 }`, `grants: "1◈"`, `repeatable: true` | **runner new** |
| Vulnerability | `{ kind: npScaleUsedOn, scale: antiWorld, result: end, when: combatProcessEnd }` | **new kind** |
| Cooldown | `{ max: "8◈", countFrom: deactivation }` | exists |
| Interior | Innocent World (§6) | — |
| Interior events | Kagome summoning (§7), GotN discharge (§4) | — |

"X panel area around" is radius X, by the corpus's own convention (Contagion's *"2 panel area"*
is its 5×5).

### 5.2 The extension runner

`expireFields(tick)` gains one step before closing a field whose expiry has come: if it declares
`extension`, the payer is asked — the `FGTSocket.ask` prompt the reshape uses — and a yes charges
`cost` and pushes `expiry` by `grants`. `payer: ownerMaster` resolves through the field's
`ownerMasterId`; `payer: owner` is what Chaos Labyrinthos authors, and **starts working in the
same commit**. Refused outright — no prompt — when the payer's Health is below `minimum`, so a
Master is never asked a question whose answer would kill them.

### 5.3 The Anti-World escape

Three pieces:

1. `rules/bounded-fields.mjs#isolationBlocks` honours `isolation.piercedBy`, using
   `meetsTagThreshold` against the attack's `npTags`.
2. `rules/options.mjs` emits `attack:npScale:gte:<tag>` as a ladder up the scale (the same shape
   `attack:range:gte`), and Doomsday carries an interior `DamageModifier` taken −50%, predicated
   `attack:npScale:gte:antiWorld`. The NP's own targeting decides who is hit; the field halves it.
3. The Process completion point in `engine/attack.mjs` — where `resumeDeferredAttack` lives —
   reads each open field's `vulnerabilities` for `npScaleUsedOn` and deactivates a match.

### 5.4 The drag-in

A **granted ability**, *Doomsday Drag*, `oncePerTurn`, `timing: { window: ownTurn }`, granted
by Doomsday Come's passive rules while its field is open:

- `targeting.anchor: { kind: fieldEdge, fieldId: pale-rider-doomsday-come, range: 2 }` — a
  **new anchor kind**, measured from the nearest panel of the field rather than from the caster,
  which is why a plain `targetUnit` cannot express it.
- One phase, `kind: dragInto`: the target rolls Evade through `evade`/`checkPlan`; on failure it
  is moved with `fgtForced` to a random free panel inside, which fires `contact`.

It spends the attack budget and marks `acted` — *"an attack in every structural sense except that
it deals no damage"* (Ch. 43) — and never opens a Combat Process.

---

## 6. Innocent World

Six `interior` rules on Doomsday, `relations: [enemy]`, each predicated on the unit it lands on:

| Clause | Rule | Predicate |
|---|---|---|
| STR highest | `DamageModifier` dealt −50, `npValue: -25` | `self:highestParameter:str` |
| END highest | `DamageModifier` taken +50, `npValue: 25` | `self:highestParameter:end` |
| AGI highest | `CheckModifier` evade, outgoing, +4 | `self:highestParameter:agi` |
| MAG highest | `ApplicationChance` incoming +50; `VulnerabilityAmplifier` **`polarity: debuff`**, factor 1.5 | `self:highestParameter:mag` |
| LUC highest | `CheckModifier` luck, outgoing, +4 | `self:highestParameter:luc` |
| NP above all Parameters | `Suppress scope: npSeal` — a **standing** seal | `self:npAboveAllParameters` |

Three engine pieces:

- **`rules/options.mjs`** emits `self:highestParameter:<p>` **once per Parameter tied for
  highest**, so *"two or more Parameters of the same Rank … all related effects"* is set
  membership rather than a case; `self:npAboveAllParameters` when any NP's rank exceeds every
  Parameter; and `self:stableDie:d6:<n>` for a unit with **no** Parameters.
- **`interiorModifiers`** tests a rule's `predicate` against `rollOptionsFor({ attacker: unit })`
  at annotation. Today an interior rule's predicate is dropped (executors receive `ctx: {}` and no
  `deferred`).
- **`VulnerabilityAmplifier`** accepts `polarity: debuff` beside `effectId`.
- **`Suppress scope: npSeal`** — the NP Seal *effect* carries no rules; what refuses a Noble
  Phantasm is the prevention table in `rules/budget.mjs`, keyed on the `npSeal` effect id being
  present. (`scope: "np"` is a different thing — the NP-*cooldown* scope Scáthach's Alpi uses.)
  The prevention check gains one line: a standing `suppressions` entry scoped `npSeal` refuses the
  same way the effect does. Standing rather than an applied effect because the sheet says the
  seal *"cannot be prevented or removed as long as a Unit is within"* — an interior annotation is
  present exactly while the unit stands inside and gone the moment it leaves, with nothing for
  Dispel to find and no exit event needed to clean up.

**The stable die.** *"Roll a six-sided die … the same effect every time."* A hash of the unit's id
folded to 1–6: random-looking, identical on every read, survives reload, needs no state, and is
generic enough that the next sheet with the shape gets it free. A unit *with* Parameters never
emits it. Each clause's predicate is `{ or: ["self:highestParameter:str", "self:stableDie:d6:1"] }`
and so on. This satisfies the clause's intent, not its letter — a GM cannot "reroll" a Master —
and §9 records the alternative.

*"Cannot be prevented or removed as long as a Unit is within"* is free: interior contributions are
standing annotations, not effects. There is nothing for Dispel to find.

---

## 7. Kagome Kagome

### 7.1 Four statlines

`packs/_source/summons/kagome-{sword,famine,death,beast}.yml`. Shared: `undamageable: true`,
`attributes: [dark, spirit]`, `actsOncePerTurn: true`, the `noReactions` grant, and budget
exemption (every summon has it). Two things a summon cannot say today:

- **Stats relative to the summoner**: `inherit: { agility: { from: summoner, delta: 2 }, luck: { from: summoner } }`,
  resolved at placement from the summoner's live values.
- **A shaped Normal Attack** (Famine, *"3×3 panel area"*): `normalAttack.shape`, default `unit`.

The Death rider is Serenity's on-hit pattern: `OnEvent damageDealt → ApplyEffect death, chance: N`,
predicated `attack:kind:normal`.

### 7.2 Summoning with memory

A Doomsday `contact` event — creation, drag-in and walking in are all contact — with a new action:

```yaml
- event: contact
  relations: [enemy]
  onFail:
    - { key: SummonBound, typeRoll: "1d4",
        types: { 1: kagome-sword, 2: kagome-famine, 3: kagome-death, 4: kagome-beast },
        rememberOn: owner }
```

`rememberOn: owner` writes `system.summonAssignments[enemyId] = type` on Pale Rider — the general
name for "which summon is bound to which enemy" — and a later contact from the same enemy reads
it instead of rolling. The summon is stamped `pursuitTargetId` and `boundToFieldId` (generalising
Bašmu's `boundToPlatformId`); Doomsday's `onEnd` removes every summon bound to it.

### 7.3 Pursuit as constraint

- **Attack:** a `ForceTarget` suppression pointed at `pursuitTargetId`. Exists (Decoy).
- **Move:** `movement-hooks.mjs#onPreMove` refuses a step for a unit with `pursuitTargetId`
  whose destination is further from the target (Chebyshev) than its origin, naming the target.
  Lifted when the target is no longer inside the bound field.

### 7.4 Banishment

*"A Light attack, or one that deals extra damage to Dark or Spirit Units, … Flip a Coin; 1◈ if
Tails, 2◈ if Heads; then reappears on a random panel within."*

- **`fgt.attacked`**: a new event fired on each defender when a Process is built, with the attack
  in its option set. The corpus has lacked a defender-side declaration event.
- **`attack:vsAttribute:<a>`**: emitted when the attacker's active damage modifiers carry a
  predicate naming `target:attribute:<a>` — that is what "deals extra damage to Dark Units" *is*.
- **`Banish`**: an action that hides the token, records `state.banished[unitId] = untilTick` on
  the field, and at `turnStart` returns any whose tick has come to a random free panel inside.

The Spirit's passive rule: `OnEvent attacked, predicate: [{ or: ["attack:element:light",
"attack:vsAttribute:dark", "attack:vsAttribute:spirit"] }], then: [{ key: Banish, coin: { heads: "2◈", tails: "1◈" } }]`.
The Process still runs and still halts at stage 0.

---

## 8. The relationship proxy, and items

`RelationshipProxy` (emitted, never read, never authored) gains readers in the two relationship
rules that exist: Master-protection targeting (`rules/targeting/resolve.mjs` step 7) and zone
denial (`rules/movement.mjs#inEnemyMasterProtection`). Where either asks "is this Master's
Servant within 2", a Servant carrying `proxy: summons` answers with its live bound summons.

The third rule — *"the Master is unharmed while the Servant's damage is doubled"* — is
**implemented for no one**, so there is nothing to redirect. Noted as unmodelled for the corpus.

**Items are not built.** There is no item-acquisition flow — `engine/items.mjs` has `giveItem`
and `useItem`, and nothing drops an item on a panel or awards one on a kill — so *"Items that
would be obtained by Pale Rider are instead obtained by his Master"* redirects an acquisition that
cannot happen. `giveItem` refuses him, and the rest is documented as unmodelled.

---

## 9. Testing

| Pure (vitest) | Live (`fgt2026`) |
|---|---|
| `undamageable` survives `prepareBaseData`; pipeline halts stage 0 | An attack on Pale Rider deals 0 and names why |
| `noNormalAttack` / `noReactions` refuse | Bare attack refused by name; reaction rung offers only *nothing* |
| `ZonBonus fromStat: mov`, +6 on Riding's Turn | Master's ZON reads base + MOV; +6 after the Active |
| `panelsOf` overrides: 5 → 9 on the marker; Doomsday's panels while open | Contagion's tint changes on the Active and again when Doomsday opens |
| `HealthLoss` is a `statDelta`, never `fgt.damageTaken`; Dmg Cut does not reduce it | Enemy loses exactly 100 with Def Up standing |
| Event `branches` select by option set | 150 within 3 of the Master, 100 otherwise |
| `highestParameter` emits every tie; `stableDie` in 1–6 and stable; `npAboveAllParameters` | EMIYA (AGI A) gets +4 Evade inside; a Master gets one stable clause |
| `radiusRoll` stored once; extension refused below `minimum` | Master asked at expiry; charged 100; expiry +1◈; refused at 99 |
| `piercedBy` opens for Anti-World, not Anti-Army | Chaos Labyrinthos refused across the boundary; an Anti-World NP allowed at −50%, field closes at Process end |
| `dragInto`: fail → inside on a free panel; success → nothing | Drag a foe in; contact fires; a Spirit appears; the same type after a recast |
| Pursuit refuses a step that increases distance; `ForceTarget` refuses another target | Sword's move away refused by name; its attack on a bystander refused |
| `Banish`: coin → 1◈/2◈; returns inside; teardown at field end | A Light attack hides Sword; it returns on a free panel; closing Doomsday removes all four |
| Proxy: protection asks the summons, not Pale Rider | An enemy may step beside the Master with Pale Rider adjacent and no Spirit near |

---

## 10. Sequencing — eight commits

1. **Effects + the unit shape** — `undamageable`, the two grants, `ZonBonus fromStat`, `DamageNegation uses`, Riding EX, MR C.
2. **Passive fields + geometry overrides + `HealthLoss`/`chance`/event `branches`** — Contagion, both triggers and the Active.
3. **Doomsday's axes + `radiusRoll` + the extension runner** (fixes Asterios).
4. **The Anti-World escape + the drag-in** (`fieldEdge` anchor, `dragInto` phase, `npScale` ladder, `piercedBy`, `npScaleUsedOn`).
5. **Innocent World** — the three option families, predicates on interior rules, `VulnerabilityAmplifier polarity`, the `npSeal` suppression scope.
6. **GotN + Guidance of the Netherworld** — `requiresEffect`, `RemoveEffect`.
7. **Kagome Spirits** — statlines, `inherit`, `normalAttack.shape`, `SummonBound` with memory, pursuit, `fgt.attacked` + `attack:vsAttribute` + `Banish`, `boundToFieldId` teardown.
8. **Relationship proxy reader; the Servant file; docs.**

Each leaves the system working; 1–6 are live-testable without a Spirit existing.

---

## 11. Risks

- **Eight commits is the honest size.** Six new engine pieces — passive fields, geometry
  overrides, the extension runner, `fieldEdge` anchors, `fgt.attacked`, bound summons — every one
  general, every one with a second consumer waiting in Medusa or Achilles. Still six.
- **Banishment is the least certain piece.** Hiding a token for a span and returning it elsewhere
  has no precedent and touches the scheduler's expiry machinery. If it fights, it becomes its own
  commit and the rest of §7 ships without it.
- **`stableDie` is a design choice, not the sheet's letter.** The alternative is a real roll
  remembered in a `summonAssignments`-shaped map; one more write, and a GM could reroll.
- **The ZON clause is read literally** and swells by six on Riding's Turn. One flag caps it if
  that is not the intent.
- **`unitTurnEnd` is listed in §E and dispatched nowhere.** Contagion's first trigger needs it; it
  is the same shape as the `turnEnd` dispatcher Jack's Mist added.
- **Out of scope, staying out.** Items (no acquisition flow), and the NP-cover relationship rule
  (implemented for no one).
