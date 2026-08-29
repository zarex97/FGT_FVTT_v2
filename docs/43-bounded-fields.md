# 43 — Bounded Fields

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
> Not built: the **paint-style canvas tool** `freeform` needs (The Mist, targeting mode E), the
> two-phase `markDefined` construction (Blood Fort Andromeda's Bloodmarks), and the scheduled
> detonation of §43.9. The state history of §43.11 exists only as `state.escapeHistory` — enough
> for the veteran rule, not the general log.

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
| Doomsday Come | **`followsUnit`** — `(2 + 1d4)` panels around **Pale Rider's Master**, moving with them |
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
fourth completes a legal rectangle. The marks are objects on the board that **only Masters can
destroy**, and that are **only visible within 3 panels**. So the counter-play is a Master
sortie into fog.

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
}
```

| Field | Cross-boundary targeting |
|---|---|
| Chaos Labyrinthos | **Fully isolated** — *"Units outside cannot Attack or apply any effects to Units within and vice versa"* |
| Doomsday Come | **Fully isolated** |
| Unlimited Blade Works | **Fully isolated** |
| The Mist | Open — it is a debuff field, not a prison |
| Ramesseum Tentyris | Open |
| Duel field | **Fully isolated, and Command Spells cannot reach in** |

Full isolation is a strong statement: it partitions the board into two independent combats. The
turn system must handle a player whose units are split across the boundary — they take one turn
and act with both groups, but the groups cannot help each other.

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

---

## 43.7 Axis 5 — Duration and extension

```ts
type FieldDuration =
  | { kind: "ticks"; value: TickExpr }
  | { kind: "untilOwnerDefeated" }
  | { kind: "permanentUntilEnded" }
  | { kind: "onceOnly" };

interface ExtensionSpec {
  cost: { kind: "health"; amount: number; payer: "owner" | "ownerMaster" };
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

**Ramesseum Tentyris is permanent** once activated — *"remains constantly Active"* — with four
distinct termination paths (§43.8).

---

## 43.8 Axis 6 — Vulnerability

How the field can be broken from outside. This is where the NP tag system becomes load-bearing.

```ts
interface FieldVulnerability {
  kind: "npTagAtLeast" | "damageThreshold" | "npCount" | "ownerDefeat" | "markDestruction";
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
placed.

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
