# 04 — Units

Everything on the board that can be targeted, damaged, moved, or that occupies a panel is a
**Unit**. This chapter specifies the hierarchy, what varies between kinds, and the identity,
faction, attribute, and disposition systems.

---

## 4.1 The hierarchy

```
Unit (abstract)
 ├── CombatUnit (abstract)          — has parameters, can attack, can be attacked
 │    ├── Servant                   — the primary pieces
 │    ├── Master                    — commands Servants, holds Command Spells
 │    └── Summon                    — created by abilities (Bašmu)
 ├── Civilian                       — neutral, one-shot, alignment-relevant
 ├── Platform                       — boardable, movable, carries units
 └── Structure                      — the Holy Grail; immobile, targetable
```

The split at `CombatUnit` is deliberate: Civilians, Platforms, and Structures do not have
Parameters, do not perform Luck Checks in the normal way, and are excluded from most effect
targeting by default. Writing `unit instanceof CombatUnit` is the correct guard for "can this
thing evade/block/counter".

### Why not one class with flags

A flags-only model (`isServant`, `isMaster`) is tempting and wrong here, because the kinds
differ in *behaviour*, not just data:

- A Master attacked by a Servant runs the **Overpower** coin flip; a Servant does not.
- A Servant attacked by a Master runs **Underpower**; a Master does not.
- A Platform cannot Evade, Block, or Counter, and cannot be affected by buffs or debuffs at
  all (both HGoB and Golden Hind state this explicitly).
- A Summon does not count toward its controller's move/attack budget.
- A Civilian dies to any Servant attack without a damage calculation.

These are five different resolution paths. They belong in five types.

**DECISION.** Foundry `Actor` subtypes map 1:1 to the concrete classes:
`servant`, `master`, `civilian`, `summon`, `platform`, `structure`. Each gets its own
`TypeDataModel` (Ch. 22). Shared fields live in shared schema mixins, not in a god-schema.

---

## 4.2 `Unit` — the base

```ts
abstract class Unit {
  readonly id: string;              // Actor uuid
  readonly tokenId: string;         // TokenDocument id on the active scene
  name: string;                     // display name
  trueName: string;                 // hidden until revealed
  nameRevealed: boolean;

  factionId: string;
  controllerId: string | null;      // Foundry user id; null ⇒ GM-controlled

  health: Resource;                 // {value, max}
  position: GridOffset;
  footprint: Footprint;             // {w, h}, default 1×1
  facing: Facing;
  elevation: number;
  levelId: string | null;

  attributes: AttributeSet;
  effects: EffectCollection;

  abstract get canReact(): boolean;
  abstract get countsTowardTurnBudget(): boolean;
  abstract get isTargetableByDefault(): boolean;
}
```

### Identity and hidden information

F/GT supports **Closed Info** play, where unit stats and abilities are hidden from opponents.
This is not a UI nicety; it changes what the client is allowed to *have*.

Three visibility tiers per unit, per observing user:

| Tier | Sees |
|---|---|
| `OWNER` | Everything. |
| `KNOWN` | Name (possibly an alias), current/max Health bar, position, facing, publicly-revealed effects. |
| `UNKNOWN` | Position and token image only; no stats, no effect list, no ability list. |

The rulebook specifies exactly when information leaks:
1. A player is told a Skill was *used*, but not its effects, unless the user announces them.
2. A player **is** told the effects applied *to their own units*, and only those.
3. The GM discloses whatever is needed for play to proceed.

**Implication for architecture:** the rules layer must be able to compute a defender-side
resolution *on the defender's client* without that client possessing the attacker's full
effect list. This is why the reaction ladder (Ch. 27) passes a **redacted snapshot**: the
attacker's client computes the damage and transmits the result plus a *redaction-aware*
breakdown. The defender's client sees "attacker modifiers: +215%" without seeing that 100% of
it came from Presence Concealment.

**RISK.** Any client-side calculation in a closed-info game is exploitable by a player reading
their own console. Full mitigation requires server-side resolution, which Foundry does not
offer for system logic. Chapter 26 documents the practical mitigation (GM-client
authoritative resolution for contested values) and its limits. Treat closed-info as
"opt-in, honour-system-plus-friction", not as a security boundary.

### Facing

Every unit has one of eight facings. The rulebook uses eight directions on the tabletop but
notes explicitly: *"For a 2d system like foundryVTT we should use a 4 cone system, one for
front, one for the back and one for each side."*

**DECISION.** Store the eight-way facing (it is what the player picks and what the token art
shows) and derive the four-way **relative side** for rules purposes:

```ts
type Facing = 0 | 45 | 90 | 135 | 180 | 225 | 270 | 315;   // degrees, 0 = north
type RelativeSide = "front" | "left" | "right" | "back";

function relativeSide(defenderFacing: Facing, attackFrom: Bearing): RelativeSide {
  const delta = normalize(attackFrom - defenderFacing);      // 0..359
  if (delta <= 45  || delta >= 315) return "front";
  if (delta <  135) return "right";
  if (delta <= 225) return "back";
  return "left";
}
```

Each cone is 90°, centred on the four cardinal offsets from the unit's facing. Bearing is
computed from panel centres. For a multi-panel unit, bearing is computed from the *nearest
occupied panel* to the attacker, not the centre — otherwise a 3×3 Kingprotea attacked at the
corner reports the wrong side.

Facing matters for exactly three things:
- Evade roll penalty: `+1` from left/right, `+2` from back (Rules — Combat 3).
- Step 5 of Combat: the DU turns to face the AU (not for AoE).
- Directional area anchoring for a small number of abilities (Golden Hind's bow direction).

Facing is stored on `TokenDocument.rotation`, which gives free token-art rotation and native
persistence. `lockRotation` is set false; token art must be authored pointing north.

---

## 4.3 `CombatUnit`

```ts
abstract class CombatUnit extends Unit {
  parameters: Parameters;           // STR END AGI MAG LUC as Ranks
  agility: Resource;
  luck: Resource;
  mov: number;
  range: RangeSpec;                 // {panels, targets}
  baseAttack: { str: number; mag: number };
  normalAttackComponent: "str" | "mag" | "both";

  abilities: AbilityCollection;
  resources: Map<string, Resource>; // Fragarach Tokens, Proliferation, HGoB Construction…

  turnState: UnitTurnState;

  get canReact() { return true; }
}
```

### `normalAttackComponent`

The rulebook default: *"When a Servant other than Caster Attacks, their Base Attack (STR) is
used. When a Caster Attacks, their Base Attack (MAG) is used."* But the reference set is full
of exceptions declared per-unit:

- Van Gogh: *"Van Gogh's Normal Attacks use her Base Attack (MAG)"* — and she is not a Caster.
- Nemo: normal attacks use BA(MAG), deal Water damage, 10% Slow.
- Semiramis: BA(STR) at range 1–2, BA(MAG) at range 3+ — **range-dependent**.
- Mannanán in Holder Mode: BA(STR) + 30% of BA(MAG) at range 1–2; BA(MAG) at range 3+.

**DECISION.** `normalAttackComponent` is not a scalar but a small resolver:

```ts
type AttackComponentSpec =
  | { mode: "fixed"; component: "str" | "mag" }
  | { mode: "combined"; strFactor: number; magFactor: number }   // e.g. 1.0 / 0.3
  | { mode: "byRange"; bands: Array<{ maxRange: number; spec: AttackComponentSpec }> };
```

evaluated at attack time with the actual distance. This is the same structure abilities use
for their own component declaration, so there is one code path.

### Turn state

```ts
interface UnitTurnState {
  moved: boolean;
  movedPanels: number;          // for Riding's double-move budget
  moveSegments: number;         // 0, 1, or 2 (Riding)
  attacked: boolean;
  usedActiveSkill: boolean;
  acted: boolean;               // any of the above, or reacted
  countedAgainstBudget: "servantMove"|"masterMove"|"servantAttack"|null;
  reactionsThisPhase: Set<string>;   // e.g. "luckCheck:reducedDamage" — once per Process
}
```

`acted` deserves emphasis. A large number of effects trigger *"at the end of every Turn the
Unit Acts"* — Mad Enhancement's Master health drain, Kingprotea's NP DmUp (GAO) decay,
Sap/Bleed, Crystallize's fixed damage, Van Gogh's Regen. "Acts" includes reacting (Evade,
Block, Counter, Luck Check), which means a unit can "act" during an *opponent's* turn. The
turn scheduler must therefore evaluate end-of-turn triggers against every unit on the board,
not just the active player's units.

---

## 4.4 `Servant`

```ts
class Servant extends CombatUnit {
  servantClass: ServantClass;       // saber | archer | lancer | rider | caster
                                    // | assassin | berserker | avenger | alterEgo | ...
  secondaryClass: ServantClass | null;   // Semiramis is Caster AND Assassin
  alignment: Alignment;             // {order: lawful|neutral|chaotic, morality: good|neutral|evil|mad}
  region: string[];                 // ["Ireland"], ["Greece", "Netherlands", "Europe"]
  sustainability: number | null;    // ticks; null = N/A (indefinite)

  contract: ContractState;
  masterId: string | null;

  noblePhantasms: NoblePhantasm[];  // several Servants have 2–4
}
```

### Class

Class determines: the default ZON granted by the Master, NP availability round (Assassin: 4,
others: 6), and which Class Skills are expected. It is *not* a hard constraint on abilities —
Semiramis carries both Caster and Assassin class skills simultaneously.

**DECISION.** `servantClass` is a list, not a scalar, internally; the sheet shows the primary.
Rules that key on class (`ZON default`, `NP round gate`) take the most favourable value, since
that matches how Semiramis is described (Assassin's round-4 NP gate and Caster's ZON 5).
Recorded as an open question in Ch. 41 — this is an inference, not a stated rule.

### Alignment

Used by exactly one automated rule in the reference set, but it is a rule with teeth:
Servants with the `Good` morality **will not kill Civilians** and **will not use an AoE Noble
Phantasm if a Civilian is within range**, unless a Command Spell (`Kill Humans`) is spent —
and spending it has a permanent consequence (the Servant abandons its Master if it ever
becomes Unbound).

**Implication:** this is a *targeting legality* rule, not a flavour note. The targeting
validator (Ch. 09) must refuse to confirm an AoE NP placement that includes a Civilian, for a
Good-aligned Servant, with an explanatory message and a "spend Command Spell" affordance.

Heracles's alignment is listed as `Chaotic Mad`, which is not one of the standard morality
values. Treat `Mad` as a fourth morality value that is not `Good`.

### Sustainability

Ticks a Free Servant survives after its Master dies. Sources that modify it:
- Independent Action grants a "high Sustainability" (the actual number is stated per-Servant:
  Kingprotea 7◈, Kiritsugu 8◈).
- High Rank Masters: +1◈ while alive.
- Mad Enhancement active when the Master dies: −2◈.
- Using an NP while Free: −1◈ to −6◈ by NP Rank.
- Semiramis aboard HGoB: +2◈.

`null` means N/A — indefinite survival. A Servant with `null` Sustainability that uses an NP
while Free loses Health instead, at *double* the left-column Master-cost value; if that would
reduce it to 0 it disappears at the end of the Combat Process.

`0` means immediate disappearance on Master death. Distinct from `null`. The type must not
conflate them — `number | null`, never `number` with 0 as sentinel.

---

## 4.5 `Master`

```ts
class Master extends CombatUnit {
  rank: MasterRank;                 // A | B | C | D | rankless
  essence: MasterEssence | null;    // Kaleidoscope, Steel Training, …
  commandSpells: number;            // starts at 3
  borrowedCommandSpells: Map<string, number>;  // servantId → count, from killed Masters
  zonBase: number;                  // derived from contracted servant's class
  servantIds: string[];
}
```

### Rank and essence

Masters come in four ranks with different `Base Attack (MAG)` (125 for A/B, 100 for C/D) and
different bonuses. High Rank Masters (A, B) additionally grant `ZON +1`, `Sustainability +1◈`,
and a free `+` to one of their Servant's Parameters.

Essences are a *draft* concept — each is a distinct passive granting one specific bonus to the
contracted Servant. There are 10 essences per rank in the source. They are modelled as
ordinary passive abilities on the Master with rule elements targeting the Servant, not as a
special case:

```yaml
id: essence-kaleidoscope
rank: A
rules:
  - key: NPAvailabilityShift
    target: contractedServants
    rounds: -4                  # NP usable from Round 2 instead of 6
```

**Critical rule:** *"If Master Essences are used, a Servant loses the effects of the Master
Essence if its Master is defeated."* So essence rule elements are conditioned on the Master
being alive, and are *not* transferred when the Servant is re-contracted.

### Command Spells

Three per Master, spendable at any time — including as an interrupt mid-Combat-Process.
Chapter 17 covers the command catalogue. Two structural points here:

1. **Borrowed spells are namespaced.** When a Master kills an enemy Master and inherits its
   Command Spells, those spells *can only be used on the corresponding Servant*. So the count
   is not a single integer; it is `own: number` plus a per-Servant map.
2. **Running out changes contract state.** A Master with zero spells makes its Servant
   `UNBOUND`, contractible by enemies. This is a derived property, recomputed whenever the
   count changes.

### Master-specific rules

| Rule | Effect |
|---|---|
| **Overpower** | Servant attacks Master → coin flip → instant defeat on Heads. Blocked by Invuln, Shield, `Master's Luck` Luck Check. Chance reduced 10% by Def Up/Dmg Cut. |
| **Underpower** | Master attacks Servant → coin flip → Tails halves Total Damage including NP. Chance reduced 10% by the Master having Atk Up/NP DmUp. |
| **Protection** | A Master cannot be targeted while its Servant is within 2 panels. Counters are redirected to the Servant. |
| **Zone denial** | Units may not enter a 1-panel area of an enemy Master whose Servant is within 2 panels. (Not symmetric — Masters *may* stop next to enemy units.) |
| **Adjacency bonus** | A Master directly next to its Servant gets `MOV +1`. |
| **Multi-servant tax** | A Master with >1 contracted Servant loses 25 Health at end of turn if more than one Acted. Cannot order more than one to Act at ≤25 Health. Does not apply in Grand Order HGW. |
| **Cover** | A Master caught in an AoE NP with its Servant within 2 panels: the Servant rolls an Agility Check to shove the Master out. Failure ⇒ Master takes nothing, Servant takes +100% damage and cannot Evade. |

All seven are implemented as rule elements on a built-in `master-core` passive, not as
hard-coded branches in the combat engine. This keeps them inspectable and overridable.

---

## 4.6 `Civilian`

```ts
class Civilian extends Unit {
  get canReact() { return false; }
  get countsTowardTurnBudget() { return false; }
}
```

Minimal. Attributes: `Human`, `Living Human`, `Humanoid`. Behaviour:
- Any Servant attack kills it instantly (no damage calculation, no reaction).
- The killing Servant restores 100 Health and 1 Agility.
- Good-aligned Servants refuse (see 4.4).
- On Lunatic difficulty, the board maintains at least 2 Civilians at all times.

The "at least 2 civilians" invariant is a `Game`-level rule, enforced at round start by the
random-event system (Ch. 19).

---

## 4.7 `Summon`

```ts
class Summon extends CombatUnit {
  summonerId: string;
  summonAbilityId: string;
  constraints: SummonConstraints;
}

interface SummonConstraints {
  maxConcurrent: number;            // Bašmu: 1
  boundToZoneId: string | null;     // Bašmu cannot leave HGoB
  dismissOnSummonerDefeat: boolean;
  dismissOnZoneRemoval: boolean;    // Bašmu disappears if HGoB is removed
  countsTowardTurnBudget: boolean;  // Bašmu: false
  actionsPerTurn: number;           // Bašmu: 1 move/attack
}
```

Bašmu is the only summon in the reference set, but it exercises every field: it is capped at
one, bound to the HGoB zone, dismissed when HGoB is removed, exempt from turn budget, and
grants a positional effect (*"Enemy Units cannot Attack Semiramis or her allied Units if a
Bašmu is next to them"*) which is a rule element on the summon affecting *others*.

---

## 4.8 `Platform`

Covered fully in Chapter 20. Summary of what makes it a distinct kind:

```ts
class Platform extends Unit {
  footprint: Footprint;             // HGoB 9×9 (11×11 large board), Golden Hind 4×3
  capacity: number | null;          // Golden Hind: 9
  passengers: string[];             // unit ids
  boardingRoll: BoardingSpec;       // die, target number, modifiers
  levelId: string;                  // its own Scene Level
  ownerId: string;                  // the Servant that created it

  get canReact() { return false; }  // "cannot Evade, Block, and Counter"
  get acceptsEffects() { return false; }  // "cannot be affected by buffs and/or debuffs"
}
```

Platforms move onto occupied panels (they are *above* the board), carry units, gate targeting
between levels, and destroy/scatter their passengers when destroyed. They can attack (HGoB has
two attacks; Golden Hind replaces Drake's normal attack).

---

## 4.9 `Structure`

Currently one instance: the Holy Grail.

```ts
class Structure extends Unit {
  destructible: boolean;
  destructionRule: DestructionSpec;
}
```

The Grail's rule: if hit by a damaging AoE NP, it has an `X%` chance of destruction where
`X = damage / 20`. If destroyed, **everyone loses**. This is a `Game`-terminating condition,
so the Grail's destruction check is wired into the damage application step with high priority.

---

## 4.10 Factions and disposition

```ts
interface Faction {
  id: string;
  name: string;
  colour: string;
  homeBaseRegionId: string;
  playerIds: string[];             // 1..7 users cooperating
  turnSlot: number;                // position in the round
}
```

Foundry's `TOKEN_DISPOSITIONS` (`FRIENDLY 1`, `NEUTRAL 0`, `HOSTILE -1`, `SECRET -2`) is
*relative to the viewer* and only supports two sides. F/GT supports up to 7 factions plus
neutrals, and alliance is a property of the match, not of the token.

**DECISION.** Disposition is derived, never stored as the source of truth:

```ts
function relation(a: UnitSnapshot, b: UnitSnapshot): "self"|"ally"|"enemy"|"neutral" {
  if (a.id === b.id) return "self";
  if (b.factionId === NEUTRAL_FACTION) return "neutral";
  if (a.factionId === b.factionId) return "ally";
  return "enemy";
}
```

`TokenDocument.disposition` is maintained as a *display* mirror for the currently-viewing
user, so token borders colour correctly, but no rule reads it. Every targeting filter and
effect predicate uses `relation()`.

This matters because `Charm` **switches control of a unit to the enemy player** for a
duration. During Charm, the unit's `controllerId` changes but its `factionId` does not — the
rulebook is clear that a Charmed unit is controlled by the charmer, and separately that a
Charmed unit is immune to Confuse and Berserk. Whether a Charmed unit's *allies* change is
left ambiguous by the source; see Ch. 41.

---

## 4.11 Attributes

An `AttributeSet` is a transitively closed set of string tags. Closure is computed once at
derived-data time from the implication table in §2.10:

```ts
const IMPLIES: Record<string, string[]> = {
  human:        ["humanoid", "livingHuman"],
  demiServant:  ["human"],
  giant:        ["large"],
  divine:       ["divinity"],
  divinity:     ["divine"],
  demonicBeast: ["nonHominidae"],
  demon:        ["demonic"],
};

function closure(base: Set<string>): Set<string> {
  const out = new Set(base);
  let changed = true;
  while (changed) {
    changed = false;
    for (const a of [...out]) for (const b of IMPLIES[a] ?? [])
      if (!out.has(b)) { out.add(b); changed = true; }
  }
  return out;
}
```

Conditional implications (`Servant ⟹ Spirit unless Demi-/Pseudo-Servant`) are expressed as
guarded rules rather than in the plain table:

```ts
if (has("servant") && !has("demiServant") && !has("pseudoServant")) add("spirit");
if (has("servant") && !has("nonHominidae") && !has("demonicBeast")) add("hominidae");
if (hasSkill("swimsuit")) add("summer");
```

Attributes are exposed as roll options (`self:attribute:divine`, `target:attribute:large`) so
predicates can key on them without a bespoke API. Nemo's *Great Ram Nautilus* — "+150% if the
DU has the `Large` Attribute" — becomes:

```yaml
- key: DamageModifier
  value: 150
  mode: percent
  predicate: ["target:attribute:large"]
```

**RISK.** Attribute names are free text in the source documents and inconsistently cased
(`[Man]`, `Non-Hominidae`, `Threat to Humanity`). The content pipeline (Ch. 37) validates
every attribute against a closed vocabulary and fails the build on unknown values, rather than
letting a typo silently disable a rule.

---

## 4.12 Multi-panel units

Two mechanisms produce units larger than 1×1:

1. **Intrinsic size** — Platforms (HGoB 9×9, Golden Hind 4×3).
2. **Growth** — Kingprotea's `Huge Scale`: every 3 Proliferation stocks grows her from 1×1 to
   2×2 to 3×3 to 4×4, each step granting `Range +1` and `MOV −1`.

Consequences that must be handled everywhere:

| Concern | Rule |
|---|---|
| Occupancy | The unit occupies all `w×h` panels; `occupancy` maps each to the unit id. |
| Distance to | Minimum over occupied panels. |
| Distance from | Minimum over occupied panels (so a 3×3 unit's Range 1 reaches a 5×5 ring). |
| AoE inclusion | Included if **any** occupied panel is inside the area. |
| Facing bearing | Computed from the nearest occupied panel. |
| Movement | `Huge Scale` lets Kingprotea move onto occupied panels, knocking occupants back 1 panel until she fits — a cascading displacement. |
| Growth collision | When growing, the same knockback cascade runs. If it cannot resolve, growth is deferred (see Ch. 41). |

Foundry's `TokenDocument.width`/`height` handle rendering and `getOccupiedGridSpaceOffsets()`
gives the panel set natively. `token.resize()` is the v14 API for growth.

---

## 4.13 Unit lifecycle

```
        summon / deploy
              │
              ▼
        ┌──────────┐   master dies    ┌──────────┐
        │CONTRACTED│─────────────────▶│   FREE   │
        └────┬─────┘                  └────┬─────┘
             │ CS exhausted                │ sustainability = 0
             ▼                             ▼
        ┌──────────┐                  ┌──────────┐
        │ UNBOUND  │─── recontract ──▶│DISAPPEAR │
        └──────────┘                  └──────────┘
             │
             │ health ≤ 0
             ▼
        ┌──────────┐   guts / battle continuation / god hand
        │ DEFEATED │◀──────────────────────────┐
        └────┬─────┘                            │
             │ revival available ───────────────┘
             ▼
        ┌──────────┐
        │  REMOVED │   (or ERASED — does not count toward Grail materialization)
        └──────────┘
```

Two exit states matter separately:
- **Defeated/Disappeared** counts toward the Servant-death counter that materializes the Grail.
- **Erased** does **not**.

`Erase` is therefore not "defeat with extra steps"; it is a distinct terminal state with its
own bookkeeping. The `Game` aggregate maintains `defeatedServantCount` and increments it only
on non-Erase removal.

### Revival priority

The source specifies an explicit chain, and Heracles adds a fourth link:

```
Special Guts (named revival buffs, e.g. Undying)
  > Guts (the generic buff)
    > Passive revival effects (Battle Continuation)
      > God Hand (Heracles only)
```

Implemented as a priority-ordered query at the moment of defeat: the engine asks every
revival source for its priority, picks the highest, consumes it, and re-runs the
health check. Chapter 31 walks through Heracles in detail, including the interaction where
God Hand *records* the attack that killed him so that attack can never kill him again.

---

**Next:** [05 — Ranks and Parameters](05-ranks-and-parameters.md)
