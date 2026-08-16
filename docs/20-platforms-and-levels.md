# 20 — Platforms and Levels

Three of the twelve reference Servants create a large, boardable, movable structure that carries
units and separates them from the ground: Semiramis's **Hanging Gardens of Babylon**, Drake's
**Golden Hind**, and Nemo's **Storm Border**. They are the most structurally demanding content
in the game, and Foundry v14's **Scene Levels** are close to a purpose-built solution.

---

## 20.1 Why platforms are hard

A platform simultaneously:

- occupies a large footprint **on top of** the board, without displacing what is underneath;
- carries a passenger list whose members move with it;
- separates targeting between "on it" and "under it";
- has its own stats, its own attacks, and its own destruction condition;
- **cannot be affected by buffs or debuffs at all** (both HGoB and Golden Hind say so);
- cannot Evade, Block, or Counter;
- scatters its passengers when destroyed, with damage rolls;
- and can be **boarded by enemies** via a dice roll.

None of that fits a normal token. Modelling a platform as a large token with a flag produces
immediate contradictions — a 9×9 token cannot overlap other tokens, and Foundry's targeting
does not distinguish "on" from "under".

---

> **Implemented (Ch. 45 C3).** `module/rules/platforms.mjs` holds the model — membership,
> movement linkage, the cross-level protection model, boarding, falling and the destruction
> sequence. `module/engine/platforms.mjs` performs boarding, knock-offs and destruction.
> `snapshotBoard` runs `annotatePlatforms`, and the three reference platforms are authored in
> `packs/_source/platforms/`.
>
> The defect this closed is worth naming: `resolveTargets` has had a `crossLevelAllows` step
> since it was written, keyed on `board.crossLevel[unit.platformId]`, and **nothing ever supplied
> that map or set `platformId`**. The whole cross-level rule was implemented, called on every
> resolution, and permanently inert.
>
> Not built, and each needs a Scene Level operation rather than more rules: creating a level on
> activation, deleting it on destruction, scattering passengers to the ground, and reversing the
> owner's effects. Those steps of §20.9 are **logged by name** rather than silently skipped.

## 20.2 Scene Levels

v14 turns a Scene from a plane into a stack:

- `canvas.level` — the currently viewed `Level` document.
- Tokens carry a `level` field.
- Each level has its own background, foreground, and fog textures.
- `level.visibility.levels` (a `SceneLevelsSetField`) declares which other levels are visible.
- Moving between levels is a movement operation, and there is a native `changeLevel` region
  behaviour.
- `canvas.inferLevelFromElevation(elevation, {levels})` maps elevations to levels.

**DECISION.** Each active platform gets its own Scene Level.

```
Level 0  "Ground"                    the board proper
Level 1  "Hanging Gardens"           created when HGoB activates, destroyed with it
Level 2  "Golden Hind"               created when the ship is deployed
Level 3  "Imaginary Numbers Space"   created by Zero Sail
```

What this buys us for free:

| Requirement | Provided by |
|---|---|
| Units on the platform do not collide with units below | separate level ⇒ separate occupancy |
| Targeting separation | level check in the targeting filter (Ch. 09 §9.5) |
| Visual separation | native level rendering and fog |
| Boarding as a movement operation | `changeLevel` region behaviour |
| Cross-level visibility rules | `level.visibility.levels` |

What we still implement: the platform's own stats and attacks, the passenger manifest, the
movement linkage, the boarding rolls, and destruction/scatter.

---

## 20.3 The platform model

```ts
interface Platform {
  id: string;                       // an Actor of subtype "platform"
  ownerId: string;                  // the Servant that created it
  levelId: string;                  // its Scene Level

  footprint: { w: number; h: number };
  anchor: GridOffset;               // top-left on the ground grid
  facing: Cardinal;                 // Golden Hind's bow

  stats: {
    health: Resource;
    agility: number;
    luck: "shared" | number;        // Golden Hind shares Drake's
    mov: number;
    range: RangeSpec | null;
    baseAttack: { mag?: number; str?: number };
    detect?: number;
  };

  capacity: number | null;          // Golden Hind: 9 (incl. Drake); HGoB: unbounded
  passengers: string[];

  boarding: BoardingSpec;
  attacks: PlatformAttack[];
  upkeep: UpkeepSpec | null;

  rules: {
    acceptsEffects: false;
    canReact: false;
    canBeCountered: false;
    countsTowardTurnBudget: false;
    movesOntoOccupiedPanels: true;
  };

  destruction: DestructionSpec;
  subZones: Array<{ id: string; shape: ShapeSpec; tags: string[] }>;   // Throne Room
}
```

---

## 20.4 The Hanging Gardens of Babylon

The most elaborate. Semiramis's `Rank EX` Anti-World Bounded Field NP.

### Construction

Not summoned — **built**. A counter from 0 to 100 with six accrual sources:

| # | Source | Amount |
|---|---|---|
| 1 | War region is Middle East | starts at 25; adjacent to Middle East, starts at 10 |
| 2 | On summon | `2d6`, **multiplied together** (so 1–36) |
| 3 | End of every Round | `1d4 + 2` |
| 4 | Item Construction used | +1 per `[Semiramis' Poison]` produced |
| 5 | Any non-Spell Skill used except Item Construction | +2 |
| 6 | `Gather` action | +3 (Semiramis +5, her Master +4) |

Plus the region multiplier: *"If the Grail War's Region is in a Middle East region, all
Construction increases are doubled excluding effects 1 and 2; if directly next to, all increases
are increased by 2 excluding effects 1 and 2."*

Note source 2's *"multiplied together"* — `2d6` where the result is `d1 × d2`, not `d1 + d2`.
An unusual roll that the dice registry must express (`{2d6}kh1 * {2d6}kl1` does not work;
this needs a custom evaluator, or simply two separate `1d6` rolls multiplied in code).

`Gather` is a new **action kind** — it consumes the unit's Move for the turn and forbids
attacking that turn. Available to Semiramis, her Master, and any allied unit.

### Activation

When Construction reaches 100:

> *"Semiramis has to be within her Home Base, and cannot Act for **3◈ Turns**. If Semiramis is
> Attacked during this period, the period is interrupted and she has to restart. If not
> interrupted, the HGoB is activated at the end of the last Turn in that period."*
> *"Semiramis' Master only loses Health as per NP usage rules only when HGoB **successfully**
> activates."*
> *"Semiramis can perform the activation without being in her Master's ZON."*

A **channelled ability** — a shape nothing else in the game has.

```yaml
activation:
  kind: channelled
  duration: "3◈"
  requirements:
    - { kind: inZone, zoneId: ownHomeBase }
    - { kind: resourceAtLeast, key: hgobConstruction, amount: 100 }
  exemptions: [inZon]
  interruptedBy: [beingAttacked]
  onInterrupt: restart
  costTiming: onSuccess
  duringChannel:
    - { key: CannotAct }
```

`ChannelState` lives on the ability item and is checked by the turn scheduler. Being attacked
during it resets `channelStartTurn`, requiring a fresh 3◈.

### Placement and effects

- Token placed where Semiramis stood; she is moved to the centre panel.
- Allied units of the player's choice are transported aboard.
- Size 9×9 (11×11 on the large board).
- The central 5×5 is the **Throne Room**, a sub-zone.
- Counts as a **second Home Base** for her faction.
- Semiramis's parameters all rise one rank, with the explicit stat deltas from her sheet
  (Ch. 05 §5.6).
- ZON does not apply to her; Sustainability +2◈.
- Territory Creation EX applies to the whole HGoB area (with her home base dropping to Rank C).

### Stats and attacks

```
Health: 6000    Agility 0    Luck 0    MOV 2 (3 large board)
Base Attack (MAG): uses Semiramis's
Cannot be affected by buffs or debuffs. Cannot Evade, Block, or Counter, or be Countered.
Moves/attacks once per turn on Semiramis's turn. Does not count toward the turn budget.
```

| Attack | Spec |
|---|---|
| **Dragon Wing Warriors** | Range 4 **plus the area under and of the HGoB**. Hits 5×5 within range. `1d6+4` instances of **50 Fixed STR damage**. Each instance separately evadable/blockable. One Injury Roll total. Cooldown 1◈. |
| **Aerial Garden of Vanity** | Range 7. **Cannot hit under or above the HGoB.** Hits 7×7 within range. BA(MAG), 2× damage. Cooldown 2◈. |

Note the two attacks have *complementary* range rules — one explicitly includes the area under
the platform, the other explicitly excludes it. This is why `AnchorSpec` supports a compound
range (Ch. 09 §9.8, T20).

### Boarding

> Roll `1d12`. Success on **12**. Modifiers reduce the required value:
> - AGI rank C–B: −1; AGI rank ≥A: −2
> - LUC rank C–B: −1; LUC rank ≥A: −2
> - Attacked by Dragon Wing Warriors this turn: −2
> - Has the `Levitating` attribute: roll `1d8` instead, base target 8

So a unit with `AGI A` and `LUC A` needs 8+ on a d12 (42%), and after being hit by Dragon Wing
Warriors, 6+ (58%). A boarding Servant may bring its Master if the Master was within 2 panels.

### Falling off

> *"If a Unit standing on the edge of the HGoB is knocked back which would knock it off, it
> performs an Agility Check. If successful, it may Move to the nearest unoccupied HGoB panel
> other than the one it occupied, **or** land on the Game Board panel directly under it. If
> failed, it lands on the panel directly under it and takes `10 × 2d6` STR damage."*
> *"If the Unit knocked off was a Master, it has to perform an Overpower roll if it lands on the
> Game Board — even if it had already performed one from the initial Attack."*
> *"If a Master directly next to its Servant fails its Agility Check, its Servant can perform an
> Agility Check too; if successful, its Master is not knocked off."*

A three-tier check: Master's own check, then the Servant's rescue check, then the fall.

### Jumping off

> *"A non-Civilian or non-Master Unit standing on an edge panel can Jump off and land on a Game
> Board panel within its MOV; the Unit's MOV is reduced by 1."*
> *"If a Servant would Jump off with its Master directly next to it, the Servant can choose to
> bring its Master; the Master lands next to its Servant in the same orientation. This does not
> count as Moving the Master."*

A voluntary level change. Another `changeLevel` operation.

### Destruction

> *"Destroyed when Semiramis is defeated or its Health drops to 0. All Units on it perform either
> an Agility Check **or** a Luck Check (roller's choice). If failed, 100 Fixed STR damage. A
> Master within 2 panels of its Servant does not roll if its Servant succeeded. Then all Units
> are randomly scattered below it. Semiramis can attempt to rebuild it (Construction reset to 0)."*

Rebuildable — the Construction counter resets and the whole cycle can run again.

---

## 20.5 The Golden Hind

Drake's ship. Simpler than the HGoB but with its own quirks.

```
Health: 2500    Agility 10    Luck: SHARED with Drake    MOV 6
Range: 5 panels, 1 target    Base Attack (MAG): 200    Detect: 4
Footprint: 4×3 (12 panels)   Capacity: 9 including Drake
Attributes: Large, Mechanical
Injury Roll only when damaged by NP.
```

Differences from the HGoB:

| Aspect | HGoB | Golden Hind |
|---|---|---|
| Creation | channelled build over 3◈ | activated directly (it is an NP) |
| Upkeep | none | **Drake's Master loses 50 Health per Round**; forced deactivation at ≤50 |
| Boarding roll | `1d12`, target 12, with modifiers | `1d10`, target **10**, no modifiers |
| AoE handling | not specified | **full damage to the ship, 50% to units aboard, Masters aboard take nothing** |
| Owner's attacks | Semiramis attacks separately | **Drake's Normal Attacks are replaced by the ship's** |
| Deactivation | destruction only | Drake may deactivate at will, at the start or end of any Turn or Round |
| Cooldown | rebuild from 0 | `7◈+⅓◈` after destruction/deactivation |

The AoE rule is the interesting one and it has no HGoB analogue:

> *"AoE Attacks and Noble Phantasms deal full damage to the Golden Hind, and **50% Total Damage**
> to all Units upon it; while **Masters onboard take no damage and effects**."*

So an AoE that catches the ship hits three ways at once: the platform, its passengers at half,
and Masters not at all. That is a three-target-set resolution from one placement, handled by the
targeting engine returning band-tagged targets (Ch. 09 §9.4).

The upkeep clause has a precedence note: *"This effect overwrites the normal Master Health loss
when a Servant uses its NP"* — so the 50/round replaces, rather than stacks with, the NP cost.
Same `supersedes` mechanism as Karna's (Ch. 15 §15.4).

### Golden Wild Hunt

Drake's second NP, fired from the ship:

> *"Hits a 7×3 or 3×7 panel area in the direction the Golden Hind is facing for 4× damage plus
> 100."*

with a damage modifier keyed on the state of her *Blazing Golden Rule* skill:

| Golden Rule state | Modifier |
|---|---|
| Not activated, not on cooldown | — |
| Activated, <⅓◈ elapsed | +30% |
| Activated, ⅓◈–⅔◈ elapsed | +20% |
| Activated, >⅔◈ elapsed | +10% |
| On cooldown | **−15% Total Damage** |

A modifier that reads *how long ago another ability was used*. The ability model must expose
`elapsedSince(abilityId)` as a predicate source. Cheap, since cooldown state already tracks it.

And: *"Can be used even if the Golden Hind isn't present/activated; in this case the Range is
still the same, just applied to Drake."* So the anchor is conditional (Ch. 09 §9.3).

---

## 20.6 The Storm Border

Nemo's is not a platform in the same sense — it is a **pocket dimension**.

> *"Nemo and any number of allied Units within a 2 panel area enter the Storm Border and warp
> into the Imaginary Numbers Space. Enemy Units within 3 panels can attempt to enter as well:
> roll `1d20`, entering only on 18+."*
> *"While within the Storm Border, all Units still take their Turn normally."*
> *"At the end of any Turn, Nemo can resurface, placing all Units within onto a 5×5 panel area on
> the board excluding enemy Home Bases. The maximum distance is `2 + X` panels, where `X = 1` per
> ⅓◈ Turns spent inside."*
> *"Maximum time inside is 2◈ Turns; Nemo is forced to resurface after that."*
> *"If Nemo is defeated while Zero Sail is Active, he performs a Luck Check before dying. If
> successful, the Storm Border immediately resurfaces (but he is still defeated); if failed, all
> Units within are inflicted with **Erase**."*
> *"Units within cannot use Skills, NP, or any ability that creates a Unit/Item/object with the
> `Large` or `Giant` Attribute."*

So it is:
- a **level** with no ground-board footprint,
- carrying a manifest that is decided at entry (with an enemy opt-in roll),
- moving the whole group a distance proportional to time spent,
- with a catastrophic failure mode (`Erase` for everyone inside, which does *not* count toward
  the Grail counter — so it can make the Grail unreachable),
- and a capability restriction on its occupants.

**DECISION.** Model as a platform with `footprint: null` (no ground presence), a
`relocateOnExit` spec, and a `restrictions` list. The general platform machinery covers it;
only `relocateOnExit` is new.

```yaml
id: nemo-zero-sail
platform:
  footprint: null
  levelName: "Imaginary Numbers Space"
  terrainTags: [imaginaryNumbers]
  entry:
    allies:  { range: 2, automatic: true, chooser: chosen }
    enemies: { range: 3, roll: "1d20", successOn: 18 }
  maxDuration: "2◈"
  forceExitAt: maxDuration
  relocateOnExit:
    shape: { kind: rect, w: 5, h: 5 }
    maxDistance: "2 + floor(ticksInside / (◈/3))"
    forbidZones: [enemyHomeBase]
  restrictions:
    - { key: ForbidAbilityKind, kinds: [skill, np] }
    - { key: ForbidCreating, attributes: [large, giant] }
  onOwnerDefeat:
    check: luck
    onSuccess: { action: resurface, ownerStillDefeated: true }
    onFailure: { action: applyToAll, effect: erase }
```

Note `restrictions` forbidding **all** Skills and NPs inside — which includes Nemo's own. So the
Storm Border is a pure repositioning tool, not a combat platform. The UI must make that obvious
before a player enters and finds their entire kit disabled.

---

## 20.7 Cross-level targeting rules

Cross-level rules are **per-platform data, decided case by case**. The game's author confirmed
this explicitly (Ch. 41 Q37):

> *"Protection rules go on a case-by-case basis: some fortresses/vehicles soak up all the damage
> for the people inside them, some absorb a part and some absorb none, and others do not even
> let you target the units inside them unless from the exterior (requiring you to be inside)."*

So there is no global rule to derive — there is a **protection model** with four axes, and each
platform picks a point in it.

```ts
interface CrossLevelRules {
  // Can occupants be targeted at all from outside?
  occupantTargeting: "forbidden" | "rangedOnly" | "free";
  // Must the attacker board to reach occupants?
  requiresBoarding: boolean;
  // How much of an AoE reaches occupants?
  aoePassengerFactor: number;          // 0 = fully soaked, 0.5 = half, 1 = none soaked
  aoeMastersImmune: boolean;
  // Can occupants shoot out, and how?
  outboundTargeting: "forbidden" | "rangedOnly" | "free";
  forbidDirectlyBelow: boolean;
}
```

The reference platforms, and the new ones from the expanded roster:

| Platform | Occupants targetable from outside | AoE to passengers | Outbound | Below |
|---|---|---|---|---|
| **Hanging Gardens** | forbidden | 0.5 | ranged only | forbidden |
| **Golden Hind** | forbidden | 0.5 (Masters 0) | ranged only | forbidden |
| **Storm Border** | forbidden (different dimension) | n/a | forbidden | n/a |
| **Quetzalcoatlus** | forbidden | 1.0 to the mount, 0.5 to Quetz, 0 to her Master | free | n/a |
| **Ramesseum Tentyris** | free (it is a zone, not a level) | 1.0, then −50% from Divine Protection | free | n/a |

Quetzalcoatlus is the first platform in the set where the *mount itself* takes full AoE damage
while its riders are partially shielded — a third point in the model that the Golden Hind's
rule alone would not have surfaced.

Ramesseum Tentyris is the first "platform" that is not a level at all: it is a ground-level
**bounded field** with fortress semantics. Chapter 43 covers that family separately, because
their rules are about *entry, exit and suppression* rather than about elevation.

"Ranged only" means `range.panels ≥ 2`.

```ts
function crossLevelLegal(attacker, target, board): LegalityResult {
  if (attacker.levelId === target.levelId) return OK;
  const platform = platformOf(attacker.levelId) ?? platformOf(target.levelId);
  const rules = platform.crossLevelRules;
  if (target.kind !== "platform" && !rules.mayTargetOccupants)
    return Refused("Units aboard cannot be targeted from the ground.");
  if (attacker.range.panels < 2 && rules.requiresRanged)
    return Refused("Only ranged Attacks can cross between the ground and the platform.");
  if (rules.forbidDirectlyBelow && isDirectlyBelow(attacker, target, platform))
    return Refused("Units cannot attack targets directly below the platform.");
  return OK;
}
```

---

## 20.8 Movement linkage

When a platform moves, its passengers move with it, preserving relative position.

```ts
function movePlatform(p: Platform, delta: GridOffset): Intent[] {
  const intents: Intent[] = [{ t: "move", unitId: p.id, path: [add(p.anchor, delta)], forced: false }];
  for (const id of p.passengers)
    intents.push({ t: "move", unitId: id, path: [add(positionOf(id), delta)], forced: true });
  return intents;
}
```

Passengers move with `forced: true` so it does not count against their own movement budget and
does not trigger movement-based effects (Ch. 08 §8.3).

> **Implemented** as `movePlatform` plus a `preMoveToken` hook. The carried moves are flagged
> `fgtForced`, which is also what stops the hook recursing into the moves it is itself making —
> a platform must not carry its own passengers a second time because it noticed them moving.

Passengers may *also* move independently within the platform on their own turn, using their own
MOV, constrained to the platform's footprint.

The same linkage mechanism serves Riding's **Passenger Seat** (Ch. 08 §8.3), which is a
two-unit platform in all but name.

---

## 20.9 Platform lifecycle

```
        create (activate / channel / deploy)
                     │
                     ▼
        ┌────────────────────────┐
        │  create Scene Level    │
        │  place footprint       │
        │  board initial units   │
        │  apply owner effects   │  (Semiramis's rank-up, Drake's attack replacement)
        └───────────┬────────────┘
                    ▼
        ┌────────────────────────┐   upkeep failure / owner deactivates
        │        ACTIVE          │───────────────────────────────┐
        │  move, attack, board,  │                               │
        │  jump, fall            │   owner defeated              │
        └───────────┬────────────┘───────────────────────────┐   │
                    │ health ≤ 0                             │   │
                    ▼                                        ▼   ▼
        ┌──────────────────────────────────────────────────────────┐
        │                     DESTRUCTION                          │
        │  1. per-passenger save (Agility or Luck, roller's choice)│
        │  2. failed saves take fixed damage                       │
        │  3. Servant rescue check for adjacent Masters            │
        │  4. scatter passengers to the ground level               │
        │  5. remove owner effects (rank-down, restore attacks)    │
        │  6. remove sub-zones                                     │
        │  7. dismiss bound summons (Bašmu)                        │
        │  8. delete the Scene Level                               │
        │  9. start the rebuild cooldown                           │
        └──────────────────────────────────────────────────────────┘
```

Step 5's reversal is why rank-shift effects declare explicit stat deltas (Ch. 05 §5.6) — they
must be subtractable without re-rolling.

Step 7 matters for Semiramis: *"Bašmu cannot leave the HGoB. If HGoB is removed from the field
while Bašmu is summoned, it disappears."*

---

## 20.10 Platform attacks

> **Implemented:** `canConsume` returns free for any unit of kind `platform`, before every other
> gate. A platform is not a combatant taking a slot — it is equipment its owner operates — so it
> spends nothing and is refused nothing.

Platforms attack on their owner's turn without consuming budget:

> HGoB: *"During Semiramis' Turn, the HGoB can Move/Attack once per Turn … does not count
> towards number of Units who Move or Act in a Turn."*

They use the ordinary attack pipeline with three modifications:
- They cannot be countered (`canBeCountered: false`).
- They have no facing update (they are not really a combatant).
- Their base attack may reference the owner's (`"Base Attack (MAG): Uses Semiramis'"`), which
  the `BaseAttackSource` union already supports (`{unit: "owner", component: "mag"}`).

`Dragon Wing Warriors` is worth one more note: `1d6+4` instances of **50 Fixed STR damage**, each
separately evadable and blockable, with **one** Injury Roll. That is 5–10 separate reaction
prompts against one attack. **DECISION.** Multi-instance fixed-damage attacks present a single
consolidated reaction prompt — "Evade each hit / Block all / Do nothing" — resolving the evades
in sequence server-side with the cascade rule (a failed evade ends evasion for the rest). Five
sequential prompts per target per turn is not acceptable UX.

---

## 20.11 Summary of decisions

| # | Decision |
|---|---|
| D20.1 | Each active platform gets its own v14 Scene Level. |
| D20.2 | Platforms are an Actor subtype with `acceptsEffects: false` and `canReact: false`, not flagged tokens. |
| D20.3 | Cross-level rules are per-platform data on a four-axis protection model; the author confirmed protection is decided case by case, including a "must board to target occupants" mode. |
| D20.4 | Passenger movement is `forced: true`, exempt from budget and movement triggers. |
| D20.5 | The Storm Border is a platform with `footprint: null` and a `relocateOnExit` spec. |
| D20.6 | HGoB activation is a new **channelled** ability kind, interruptible and restartable. |
| D20.7 | Rank-shift effects declare explicit reversible stat deltas so platform destruction can undo them. |
| D20.8 | Multi-instance fixed-damage attacks use one consolidated reaction prompt, not one per hit. |
| D20.9 | Riding's Passenger Seat reuses the platform movement-linkage mechanism. |

---

**Next:** [21 — System Skeleton](21-system-skeleton.md)
