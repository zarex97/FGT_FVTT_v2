# 42 — Terrain

Chapter 19 introduced terrain as a minimal open tag system, on the basis that the rulebook
defined no terrain types. The *Terrain Effects* document supplies **21 terrain types with full
mechanical effects and a formal overlap-resolution matrix**. This chapter replaces
[§19.6](19-environment.md#196-terrain).

Terrain is now a first-class subsystem — comparable in weight to the effect catalogue — because
it modifies damage, movement, checks, debuff application, and even the day/night cycle, and
because several Servants create it as an ability effect.

---

## 42.1 The model

A **terrain area** is a set of panels carrying one or more terrain types, with a duration and an
origin.

```ts
interface TerrainArea {
  id: string;
  type: TerrainType;
  panels: PanelSet;                  // may be non-contiguous
  duration: Duration | null;         // null = permanent (map terrain)
  sourceUnitId: string | null;       // null = authored on the map
  followsSource: boolean;            // default FALSE — see below
  createdOnTurn: number;
}
```

**The default is that terrain does not move:**

> *"Whenever an effect which applies a Terrain Effect to the field is used, the created Terrain
> Effect area will not follow its user unless stated."*

So `followsSource` defaults to `false`. Quetzalcoatl's `Sol` buff (*"The 5×5 panel area around
Quetz is 'Day'"*) is one of the few that does follow, because it is phrased as an area *around
her* rather than an area placed on the field.

**Terrain is not an effect.** It is a property of *panels*, evaluated for whichever unit
occupies them. A unit does not carry a `Forest` status; it is *in* a Forest and the terrain's
rule elements apply while it stays there. This matters because:

- Terrain cannot be dispelled, cured, or resisted.
- Moving out ends the effects instantly, with no removal step.
- Two units on different panels of the same area can be under different terrain if the areas
  overlap unevenly.

**Implementation.** A `Region` document per terrain area with a `fgt.terrain` behaviour carrying
the type set and duration. Region membership is native, `tokenEnter`/`tokenExit` fire natively,
and rule elements are collected from the regions a unit currently occupies during the aura pass
(Ch. 23 §23.3) — terrain is, mechanically, a positional aura whose source is a region rather
than a unit.

> **Implemented.** `module/rules/terrain.mjs` holds the catalogue and the three kinds of clause;
> `TerrainBehavior` in `module/data/regions.mjs` is the Region schema; `engine/board.mjs`
> projects a scene's Regions into `board.terrain.areas`; `snapshotBoard` runs `annotateTerrain`
> beside `annotateAuras`; `engine/scheduler.mjs` maps the periodic clauses into intents.
>
> The clauses split three ways, and keeping them apart is what lets the standing table stay a
> pure lookup:
>
> | Kind | Function | When |
> |---|---|---|
> | **Standing** | `terrainEffects` | While the unit occupies the panel |
> | **Periodic** | `terrainPeriodics` | At a turn or round boundary |
> | **On entry** | `terrainOnEntry` | The moment a unit steps on |
> | **Conversion** | `terrainConversions` | When an attack changes the ground itself |
>
> Chance-based clauses keep the "caller rolls" contract: the rules are pure and read a total out
> of `ctx.rolls`, keyed `terrain:<type>:<outcome>`. A clause whose roll is **missing logs itself
> by name** rather than firing or vanishing — "the swamp did not add a stage" and "the swamp was
> never asked" are different facts.

---

## 42.2 The catalogue

### Burning

*Previously known as 'On Fire'.*

| # | Effect |
|---|---|
| 1 | All units are inflicted with `Burn` at the end of every Turn. While inside, this Burn **does not expire and cannot be removed**. After leaving (or when the area ends) it lasts 1◈ more turns. |
| 2 | Units with **any** resistance to Burn or Fire damage are not inflicted at all, unless stated. |
| 3 | 25 Fixed Fire damage at the end of the unit's turn and at the end of any turn it Acts — unless it has an effect reducing or negating Burn/Fire damage. |
| 4 | Total Water damage taken −50% including NP. |
| 5 | Chance of being inflicted with `Freeze` −25%. |

Note the unusual gating: effects 1 and 3 are **fully negated by any resistance**, not scaled by
it. A unit with `Fire damage taken −10%` takes zero from both. That is a binary check, not a
magnitude comparison, and content must not treat it as one.

```yaml
id: terrain-burning
rules:
  - key: OnEvent
    event: turnEnd
    predicate: [{ not: "unit:hasAnyResistanceTo:[burn, fire]" }]
    then: [{ key: ApplyEffect, target: unit,
             effect: { id: burn, duration: unremovableWhileInTerrain, lingering: "1◈" } }]
  - key: OnEvent
    event: [unitTurnEnd, actedTurnEnd]
    predicate: [{ not: "unit:hasAnyResistanceTo:[burn, fire]" }]
    then: [{ key: Damage, amount: 25, kind: fixed, element: fire }]
  - { key: TotalDamageModifier, direction: taken, value: -50, element: water, includesNP: true }
  - { key: ApplicationChance, direction: incoming, value: -25, effect: freeze }
```

`unremovableWhileInTerrain` and `lingering` are two new duration modes. The first makes an
effect unremovable and non-expiring while a predicate holds; the second converts it to a normal
timed effect when the predicate stops holding. Both are general — the same shape appears in
Ozymandias's permanent Stage 1 Curse inside the Complex and Quetzalcoatl's Piedra Del Sol Burn.

### Waterside

| # | Effect |
|---|---|
| i | Units **with** the `Swimsuit!` skill: MOV +1, Evade rolls −1. |
| ii | Units **without** it: MOV −1, Evade rolls +1. |
| iii | Total Water damage **dealt** +25% including NP. |
| iv | Total Lightning and Ice damage **taken** +25% including NP. |
| v | Total Fire damage taken −50% including NP. |
| vi | `Shock` and `Freeze` inflict chance +25%; `Burn` inflict chance −25%. |

The Swimsuit split (i/ii) is the first terrain effect keyed on a *skill* rather than an
attribute, and it is why `Swimsuit!` is a real skill in the catalogue rather than flavour.
Anastasia has it; Nemo's `Poseidon's Protection` keys on Waterside independently.

### Forest

| # | Effect |
|---|---|
| i | MOV −1. |
| ii | Evade rolls **−2** (easier — a rare terrain that helps evasion). |
| iii | All damage taken −10% including NP. |
| iv | All Nature damage dealt +25% including NP. |
| v | **Fire converts Forest to Burning.** When an attack dealing Fire damage hits a unit in a Forest, flip a coin. On Tails the 3×3 around the DU becomes `Burning` for 2◈ turns — and **does not revert to Forest afterwards**. If the attack's area is larger than 3×3, the whole attack area converts. |
| vi | Units with the `Dark` attribute are **not affected by the negative effects of a Day Round** while in a Forest. |

Effect v is the most mechanically interesting terrain rule in the game: it is a **terrain
transformation triggered by combat**, it is permanent (the Forest is gone for good), and its
area depends on the *attack's* footprint. It is the reason `TerrainArea` needs a
`replace(area, newType, duration, permanent)` operation rather than just a create/destroy pair.

Effect vi is a conditional suppression of the day/night rule — the first thing in the game that
turns off an environmental modifier for a subset of units.

### Snowfield

| # | Effect |
|---|---|
| i | MOV −1, Evade rolls +1. **Does not affect units with the `Santa` attribute.** |
| ii | Total Ice damage taken +50% including NP. |
| iii | Normal Attacks deal **+50 Ice damage**; this bonus is not itself amplified by effect ii. |
| iv | Total Fire damage taken −25% including NP. |
| v | `Freeze` inflict chance +25%; `Burn` inflict chance −25%. |
| vi | On receiving Water damage from an attack: 50% chance of `Freeze` for X◈ turns, X increasing by 1 per 100 Water damage. **This chance is not modified by effect v.** |

Two self-exclusion clauses (iii not amplified by ii, vi not modified by v) — the terrain
explicitly prevents its own effects from compounding. `selfExclude: [effectId]` on a terrain rule
element handles both.

### Poison Swamp

| # | Effect |
|---|---|
| 1 | At the end of the Turn, every unit inside that is **not** already Poisoned is inflicted with `Poison`. Affected by normal Poison-chance modifiers. |
| 2 | At the end of the unit's turn or any turn it Acts: it takes Poison damage if Poisoned, then has a **50% chance of an additional Poison stage**. |

Note clause 2 accelerates Poison staging well beyond its normal once-per-round rate. Combined
with Serenity or Semiramis, a Poison Swamp is lethal fast.

### Thunderstorm

At the end of the unit's turn or any turn it Acted: an **Agility Check**. On failure, 50 Fixed
Lightning damage and `Shock` for 2◈ turns. **No Injury Roll from this damage.**

The explicit Injury Roll suppression is worth noting — it is the first case of damage above the
100 threshold that deliberately does not degrade Agility, presumably because the terrain already
inflicts Shock (which reduces Agility by 3).

### Eldritch

| # | Effect |
|---|---|
| 1 | At the **start** of every turn, every unit inside flips a coin; on Tails, `Stun` for that turn. (Explicitly equivalent to `Terror 50%`.) |
| 2 | All damage taken inside +20%. |
| 3 | Damage dealt by units with the `Dark (Outsider)` attribute +50%. |
| 4 | At the start of every **Round**, roll `1d10` and summon that many **Horrors** inside. Horrors have **no allied units** — they are hostile to everyone. |
| 5 | When the area ends, all Horrors it summoned are removed. |

Clause 4 introduces a genuinely new unit relation: a summon belonging to *nobody*. The
`relation()` function (Ch. 04 §4.10) returns `enemy` for every observer, and the Horrors act on
the GM's turn.

### Dead Zone

All panels are **Dead panels**. Units standing on one deal **−20% damage including NP**.

The source cross-references a Servant we do not have (*Mori Nagayoshi*) for the definition of a
Dead panel. **Recorded as Q41** — we implement the stated −20% and leave the Dead-panel concept
otherwise undefined.

### City

| # | Effect |
|---|---|
| i | Evade rolls −1. |
| ii | Range of all attacks −1 **if it is greater than 3**. |

> *"Note: Some 'City' areas will not have these effects and will be stated if they don't."*

So `City` is a terrain type that can be declared cosmetically. The behaviour is a flag on the
area (`inert: true`), not a separate type.

### Lava

| # | Effect |
|---|---|
| i | MOV −1. |
| ii | On **moving onto** a Lava panel: 20 Fire damage, then a 50% chance of `Burn` for 2◈ turns. |

The first **per-panel entry trigger** rather than a per-turn one. It fires once per panel
entered, so crossing three Lava panels costs 60 damage and three Burn rolls.

### Frozen

| # | Effect |
|---|---|
| i | Evade rolls **+3**. |
| ii | On moving onto a Frozen panel: an Agility Check. On failure, the unit **cannot Act for the rest of the Turn**. |

Also a per-panel entry trigger, and a brutal one — a failed check mid-move ends the turn.

### Magnetic

| # | Effect |
|---|---|
| i | A unit using a Lightning attack within 3 panels of a Magnetic area **always hits a unit standing in the Magnetic area** if any exist; if several, the DU is chosen at random, and its Evade roll is +3. |
| ii | On moving onto a Magnetic panel: 25% chance of `Immobilize` for 1◈ turns — **100% for units with the `Mechanical` attribute**. This is **not** affected by Debuff Immune or any debuff-resist modifier, **except `Style Change`**. |

Effect i is a **forced retarget of an attack by terrain** — the only one in the game. It runs in
the targeting pipeline as a `TargetingRestriction` with a redirect, before selection.

Effect ii names an exception (`Style Change`) to an otherwise absolute immunity bypass. We do
not have `Style Change` defined; **recorded as Q42**.

### Meadow

| # | Effect |
|---|---|
| i | Health restoration effects **+100%** on units inside. |
| ii | Fire damage taken by a unit standing on a Meadow panel **+100% including NP** — and then **the panel reverts to normal at the end of the Damage Step**. |

Effect ii is self-consuming terrain: it fires once per panel and burns itself out. Combined with
the Forest/Meadow → Burning overwrite rule (§42.3), Meadow is a fire trap that clears itself.

### Underworld

| # | Effect |
|---|---|
| i | Chance of inflicting `Instakill` and `Death` **+20%**. |
| ii | A unit reduced to 0 Health inside is **not defeated**; it gains `Near-Death` for 1◈ turns (neither buff nor debuff, unremovable). A Near-Death unit cannot Act. If its Health is restored above 0, the effect is removed. If `Near-Death` **expires naturally, the unit is defeated**. |
| iii | Also treated as `Darkness` terrain. |

Effect ii is a terrain-granted revival window — a fourth revival-adjacent mechanism after Guts,
Battle Continuation, and God Hand. It slots into the defeat chain (Ch. 31 §31.2) as a
**pre-revival intercept**: it fires before the revival sources are queried, and converts the
defeat into a timed state.

### Airspace

| # | Effect |
|---|---|
| i | Units **without** `Levitating`: MOV −1, Agility Checks +2. |
| ii | Units **with** `Levitating`: MOV +1, Agility Checks −2. |

Same with/without split as Waterside. Proto Gil has `Levitation`; Enki explicitly spares
`Levitating` units.

### Universe

Affects only units with the **`Servant Universe` region**:

1. Damage dealt +25% including NP.
2. Damage taken −25% including NP.
3. Evade rolls −2.
4. MOV +1.
5. **Effects 3 and 4 also apply to units with the `Spaceflight` attribute**, even if not from the
   Servant Universe region.

The first terrain keyed on a **region** rather than an attribute or skill.

### Halloween

1. At the end of the Round, reduce the NP cooldown of units with the `Elizabeth` attribute by
   1 turn. (`Elizabeth` = units whose True Name is Elizabeth Báthory, or units with the `Eliza`
   effect.)
2. Chance of inflicting debuffs +5%. Mental debuffs a further +5%.

### Sunlight / Darkness / Indoors

The three terrain types that interact with the day/night cycle:

| Terrain | Effect |
|---|---|
| **Sunlight** | During a Day Round the whole field is treated as Sunlight. Sunlight areas created by effects are categorized as `Day`. |
| **Darkness** | During a Night Round the whole field is treated as Darkness. Darkness areas created by effects are categorized as `Night`. |
| **Indoors** | **There is no Day or Night when Indoors.** |

**This changes the day/night model.** Chapter 19 §19.2 treated the phase as a global property of
the round. It is now a **per-panel property**:

```ts
function phaseAt(panel: GridOffset, board: BoardSnapshot): "day" | "night" | "none" {
  const terrain = board.terrainAt(panel);
  if (terrain.has("indoors")) return "none";
  if (terrain.has("sunlight")) return "day";
  if (terrain.has("darkness")) return "night";
  return board.roundPhase;                       // the global default
}
```

So Quetzalcoatl's `Sol` buff creates a 5×5 pocket of Day during a Night Round, weakening `Dark`
units standing in it while everyone outside enjoys the Night bonus. Ozymandias's *Pyramid Drop*
leaves its blast area as `Day` for 2◈ turns. And Forest gives `Dark` units immunity from the Day
penalty specifically.

**DECISION.** Day/night is evaluated at the **defender's panel** for damage-taken modifiers and
at the **attacker's panel** for damage-dealt modifiers, since the rule is phrased as two separate
clauses about the `Dark` unit itself. Recorded as **Q43**.

### Labyrinth

Not a terrain with effects of its own, but a **category**:

> *"Certain area-based NPs which require a dice roll or a chance to escape would be categorized
> as 'Labyrinth' terrain. Confirmed Labyrinth NPs: Chaos Labyrinthos, Shí Bīng Bā Zhèn."*

Asterios's `Chaos Labyrinthos` is in the new roster. Chapter 43 specifies the escape mechanics
this category implies.

---

## 42.3 Overlap resolution

When a terrain type is applied to panels already carrying a different type, **both coexist by
default** — except for five specified interactions.

```
DEFAULT: coexist (a panel may carry several terrain types at once)
```

| # | Interaction | Resolution |
|---|---|---|
| 1 | **Burning/Lava applied to Forest/Meadow** | Forest/Meadow is **overwritten** |
| 1b | **Forest/Meadow applied to Burning/Lava** | Burning/Lava's **duration is extended** by the Forest/Meadow's duration |
| 2 | **Waterside ↔ Burning** | Each **overwrites** the other, in both directions |
| 3 | **Burning + Frozen/Snowfield** | Both are replaced by **Waterside**, using the duration of the later-applied terrain |
| 4 | **Lava + Frozen/Waterside/Snowfield** | They **cancel out** — no terrain effect remains |
| 5 | **Frozen/Snowfield applied to Waterside** | Waterside is **overwritten** |
| 5b | **Waterside applied to Frozen/Snowfield** | Frozen/Snowfield's **duration is extended** by the Waterside's duration |

Four distinct resolution verbs — `overwrite`, `extendDuration`, `replaceWith`, `cancel` — and
the rules are **directional**: applying A to B is not the same as applying B to A in three of the
five cases.

**DECISION.** Encode as a directional lookup table, not as code:

```ts
type OverlapResult =
  | { kind: "coexist" }
  | { kind: "overwrite" }                          // incoming wins, existing removed
  | { kind: "extendExisting" }                     // incoming discarded, existing +duration
  | { kind: "replaceWith"; type: TerrainType; useDuration: "incoming" }
  | { kind: "cancel" };                            // both removed

const OVERLAP: Record<string, OverlapResult> = {
  "burning→forest":     { kind: "overwrite" },
  "burning→meadow":     { kind: "overwrite" },
  "lava→forest":        { kind: "overwrite" },
  "lava→meadow":        { kind: "overwrite" },
  "forest→burning":     { kind: "extendExisting" },
  "forest→lava":        { kind: "extendExisting" },
  "meadow→burning":     { kind: "extendExisting" },
  "meadow→lava":        { kind: "extendExisting" },
  "waterside→burning":  { kind: "overwrite" },
  "burning→waterside":  { kind: "overwrite" },
  "burning→frozen":     { kind: "replaceWith", type: "waterside", useDuration: "incoming" },
  "burning→snowfield":  { kind: "replaceWith", type: "waterside", useDuration: "incoming" },
  "frozen→burning":     { kind: "replaceWith", type: "waterside", useDuration: "incoming" },
  "snowfield→burning":  { kind: "replaceWith", type: "waterside", useDuration: "incoming" },
  "lava→frozen":        { kind: "cancel" },
  "lava→waterside":     { kind: "cancel" },
  "lava→snowfield":     { kind: "cancel" },
  "frozen→lava":        { kind: "cancel" },
  "waterside→lava":     { kind: "cancel" },
  "snowfield→lava":     { kind: "cancel" },
  "frozen→waterside":   { kind: "overwrite" },
  "snowfield→waterside":{ kind: "overwrite" },
  "waterside→frozen":   { kind: "extendExisting" },
  "waterside→snowfield":{ kind: "extendExisting" },
};
// everything else: coexist
```

Read `"A→B"` as *"A is applied to a panel already carrying B"*.

**Resolution is per panel, not per area.** A 7×7 Burning placed half-over a Forest overwrites
only the overlapping panels; the rest of the Forest survives and the Burning area's own panel set
is unchanged. So a `TerrainArea` can end up with a ragged effective footprint, which is why
`panels` is a `PanelSet` rather than a rectangle.

**Resolution runs on application only.** Once resolved, the result is stable — a Burning area
that overwrote a Forest does not re-examine the question each turn.

---

## 42.4 Terrain and the damage pipeline

Terrain modifiers slot into the existing stages. Nothing new is needed.

| Terrain effect | Stage |
|---|---|
| Forest's −10% damage taken | 4 (bucket) |
| Eldritch's +20% damage taken | 4 |
| Dead Zone's −20% damage dealt | 4 |
| Waterside's ±25% elemental | 15 (it says **Total** damage) |
| Burning's −50% Water taken | 15 (**Total**) |
| Snowfield's ±Ice/Fire | 15 (**Total**) |
| Universe's ±25% | 4 |
| Snowfield's +50 Ice on normal attacks | 7 (flat) |
| Burning/Lava/Thunderstorm fixed damage | own damage packets, not this pipeline |

The "Total" convention from Ch. 13 §13.4 holds throughout: the terrain document is consistent
about saying *"All Total Water Damage taken…"* when it means stage 15 and *"All damage taken is
reduced by 10%"* when it means stage 4. That consistency is strong evidence the convention is
real and not an artefact of our reading.

---

## 42.5 Terrain and checks

| Terrain | Check modifier |
|---|---|
| Waterside (no Swimsuit) | Evade +1 |
| Waterside (Swimsuit) | Evade −1 |
| Forest | Evade −2 |
| Snowfield (no Santa) | Evade +1 |
| City | Evade −1 |
| Frozen | Evade +3 |
| Airspace (no Levitating) | Agility Checks +2 |
| Airspace (Levitating) | Agility Checks −2 |
| Universe | Evade −2 |
| Ramesseum Tentyris (Ch. 43) | Evade **and** Luck Checks +2 |

Note the scope difference: most are `evade`-scoped, Airspace is `agilityCheck`-scoped (so it
affects Cover shoves and platform knock-off checks too), and Ramesseum Tentyris affects both
check families. The `direction` convention from Ch. 14 §14.5 applies — authors write
`harder`/`easier`, never a sign.

---

## 42.6 New vocabulary introduced by terrain

Terrain pulls in a substantial amount of new content vocabulary. All of it is added to the
closed validation lists (Ch. 37 §37.4).

**Elements** — now confirmed: `fire`, `water`, `ice`, `lightning`, `wind`, `light`, `nature`,
plus the debuff-damage kinds `curse`, `poison`, `burn`. `Nature` appears only in Forest's
effect iv and has no other source yet.

**Attributes** — `Levitating`, `Spaceflight`, `Santa`, `Elizabeth`, `Dark`, `Dark (Outsider)`,
`Mechanical`.

**Skills** — `Swimsuit!` (already partially specified in the General Notes), `Style Change`
(undefined — Q42).

**Regions** — `Servant Universe`.

**Effects** — `Near-Death` (status), `Eliza` (effect), `Horrors` (unit kind).

---

## 42.7 Authoring terrain

Map-authored terrain is a Region drawn in the scene with a `fgt.terrain` behaviour:

```yaml
behaviour: fgt.terrain
types: [forest]
permanent: true
```

Ability-created terrain is a `zone` phase (Ch. 15 §15.2) with a terrain payload:

```yaml
# Ozymandias — Ramesseum Tentyris: Pyramid Drop, final clause
- kind: zone
  spec:
    terrain: [sunlight]
    shape: reuse                       # the NP's own 5×5 blast area
    duration: "3◈"                     # "becomes 'Day' for 2◈ Turns" → see note
    followsSource: false
```

The GM's terrain palette is a canvas tool: pick a type, draw a region, set a duration. Overlap
resolution runs automatically and the result is previewed before commit — important, because
dropping Burning on a Forest is irreversible.

---

## 42.8 Summary of decisions

| # | Decision |
|---|---|
| D42.1 | Terrain is a property of panels, backed by Regions, collected during the aura pass. Not an effect: uncurable, unresistable, ends instantly on leaving. |
| D42.2 | `followsSource` defaults to false, per the source's explicit note. |
| D42.3 | Overlap resolution is a **directional** lookup table with four verbs, applied per panel at application time only. |
| D42.4 | Day/night becomes a **per-panel** property; Sunlight, Darkness and Indoors override the round's global phase. |
| D42.5 | Burning's Burn and fixed damage are negated *entirely* by any Fire/Burn resistance — a binary check, not a magnitude comparison. |
| D42.6 | Forest→Burning conversion is permanent and sized by the triggering attack's area. |
| D42.7 | Underworld's `Near-Death` is a pre-revival intercept in the defeat chain. |
| D42.8 | Magnetic's Lightning redirect is a targeting-stage forced retarget. |
| D42.9 | Eldritch's Horrors are hostile to every faction — `relation()` returns `enemy` for all observers. |

---

**Next:** [43 — Bounded Fields](43-bounded-fields.md)
