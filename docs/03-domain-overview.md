# 03 — Domain Overview

This chapter is the map. It shows the whole object graph, names the aggregate roots, explains
how the eight subsystems compose, and defines the Snapshot/Intent boundary that everything
else depends on.

---

## 3.1 The object graph

```
                                  ┌──────────┐
                                  │   Game   │  one match
                                  └────┬─────┘
                 ┌─────────────────────┼──────────────────────┐
                 │                     │                      │
          ┌──────▼──────┐       ┌──────▼──────┐        ┌──────▼──────┐
          │   Board     │       │  Schedule   │        │  Factions   │
          │ (Scene)     │       │ Round/Turn  │        │   (2..7)    │
          └──────┬──────┘       └──────┬──────┘        └──────┬──────┘
                 │                     │                      │
        ┌────────┴────────┐            │              ┌───────┴───────┐
        │                 │            │              │               │
  ┌─────▼─────┐    ┌──────▼─────┐      │       ┌──────▼─────┐  ┌──────▼─────┐
  │   Zones   │    │  Panels    │      │       │  Players   │  │  HomeBase  │
  │ HomeBase  │    │ occupancy  │      │       └──────┬─────┘  └────────────┘
  │ NP fields │    └────────────┘      │              │
  │ Platforms │                        │              │
  └───────────┘                        │        ┌─────▼──────┐
                                       │        │TurnBudget  │ 4 servant moves
                                       │        │ per turn   │ 3 master moves
                                       │        └────────────┘ 2 servant attacks
                                       │
                              ┌────────▼─────────┐
                              │      Units       │
                              └────────┬─────────┘
        ┌──────────────┬───────────────┼───────────────┬──────────────┐
        │              │               │               │              │
  ┌─────▼────┐   ┌─────▼────┐   ┌──────▼───┐   ┌───────▼──┐   ┌───────▼──┐
  │ Servant  │   │  Master  │   │ Civilian │   │  Summon  │   │ Platform │
  └─────┬────┘   └─────┬────┘   └──────────┘   └──────────┘   └──────────┘
        │              │
        │        ┌─────▼──────────┐
        │        │ CommandSpells  │ 3, spendable, interrupt-capable
        │        └────────────────┘
        │
        ├────────────────┬──────────────────┬─────────────────┐
        │                │                  │                 │
 ┌──────▼─────┐   ┌──────▼─────┐    ┌───────▼──────┐  ┌───────▼──────┐
 │ Parameters │   │   Stats    │    │  Abilities   │  │   Effects    │
 │ STR END    │   │ HP AGI LUC │    │ Skills       │  │ buffs        │
 │ AGI MAG LUC│   │ MOV Range  │    │ Spells       │  │ debuffs      │
 │ (Ranks)    │   │ Sustain.   │    │ NPs          │  │ statuses     │
 └────────────┘   └─────┬──────┘    │ ClassSkills  │  └───────┬──────┘
                        │           └───────┬──────┘          │
                  ┌─────▼──────┐            │          ┌──────▼───────┐
                  │ Resources  │      ┌─────▼──────┐   │ RuleElements │
                  │ tokens     │      │  Cooldown  │   │ + Predicates │
                  │ stocks     │      │  Targeting │   └──────────────┘
                  │ counters   │      │  Costs     │
                  └────────────┘      └────────────┘

        ┌───────────────────── Relationship layer ─────────────────────┐
        │  Contract (Master ⟷ Servant)   ZON   Sustainability   Cover  │
        └───────────────────────────────────────────────────────────────┘
```

## 3.2 Aggregate roots

Four aggregates. Each owns its invariants and is the only legitimate entry point for mutating
what it contains.

### `Game`
Owns: the schedule (current round/turn), the day/night phase, the ruleset configuration
(turns-per-round, board size, difficulty level, region), the Grail state, and the roster of
factions. Enforces: turn order, round transitions, NP availability gates (round ≥ 6, or ≥ 4
for Assassin), Magic Crest gate (round ≥ 3), the first-round no-attack rule.

Maps to a Foundry `Combat` document. There is exactly one per match.

### `Unit`
Owns: its parameters, stats, position, facing, effect list, ability list, resources, per-turn
action flags, and contract state. Enforces: stat clamping (`0 ≤ current ≤ max`), effect
stacking rules, cooldown state, and the "acted this turn" flags.

Maps to a Foundry `Actor` (or `ActorDelta` for unlinked tokens) plus its `TokenDocument`.

### `CombatPhase`
Owns: an in-flight attack exchange. Transient — it exists only between attack declaration and
final resolution. Enforces: the step sequence, who is allowed to act at each step, the
one-counter limit, and the "same Luck Check only once per Combat Process" rule.

Maps to a chain of `ChatMessage` documents carrying serialized state (Ch. 27). Deliberately
*not* a persistent document, because it must survive clients disconnecting mid-ladder and
must never be writable by the wrong player.

### `Board`
Owns: panel occupancy, zone membership (home bases, NP fields, platform footprints), and
movement legality. Enforces: no diagonal movement, no moving through enemy-occupied panels,
the "cannot enter 1 panel of an enemy Master whose Servant is within 2 panels" rule, and
Decoy movement constraints.

Maps to a Foundry `Scene` plus its `Region` documents and `Level` documents.

## 3.3 The eight subsystems

Every mechanic in the game belongs to exactly one of these. When something new arrives, the
first question is which of the eight owns it.

| # | Subsystem | Responsibility | Chapters |
|---|---|---|---|
| S1 | **Time** | Rounds, turns, ◈ arithmetic, durations, cooldowns, scheduled callbacks | 07, 25 |
| S2 | **Space** | Grid, distance, facing, occupancy, movement legality, zones | 08, 19, 20 |
| S3 | **Targeting** | Shape definition, anchoring, resolution, filtering, validation | 09, 28 |
| S4 | **Effects** | Taxonomy, application, stacking, suppression, expiry, removal | 10, 11 |
| S5 | **Rules** | Rule elements, predicates, roll options, modifier collection | 24 |
| S6 | **Resolution** | Combat process, damage pipeline, checks, randomness | 12, 13, 14 |
| S7 | **Abilities** | Skills, spells, NPs, costs, cooldowns, categorization | 15, 17 |
| S8 | **Authority** | Ownership, permissions, socket routing, information hiding | 26, 27 |

### How they compose — the canonical flow

A single skill use touches six of the eight:

```
Player clicks "Het Gele Huis" on Van Gogh's sheet
  │
  ├─ S7 Abilities:  is it off cooldown? is Skill Seal active? does the unit
  │                 have budget left this turn? is Van Gogh able to Act?
  │
  ├─ S3 Targeting:  shape = orthogonalRect(5,5) anchored edge-adjacent to caster
  │                 → present 4 placement options (N/E/S/W)
  │                 → player picks; engine resolves the covered panel set
  │                 → filter to enemy units → resolve second shape (radius 2, allies)
  │
  ├─ S2 Space:      which units occupy those panels? (multi-panel units count if any
  │                 occupied panel intersects)
  │
  ├─ S5 Rules:      build roll options; evaluate each effect's application chance
  │                 (150% Def Dwn ⇒ guaranteed after resistance; 500% Curse ⇒ ditto)
  │                 collect the target's Debuff ResUp / Item Construction modifiers
  │
  ├─ S4 Effects:    for each target, roll resistance separately (General Notes Note 13),
  │                 construct EffectInstances with duration 1◈, apply stacking rules
  │
  ├─ S1 Time:       convert "1◈" and "1◈+½◈" into absolute expiry ticks;
  │                 set the skill's cooldown to 4◈−⅓◈ ticks from next turn
  │
  └─ S8 Authority:  the player owns Van Gogh but not the enemy targets → route the
                    effect writes through the GM proxy; emit one chat card
```

Note what is *not* in that list: S6 Resolution. Het Gele Huis deals no damage, so no Combat
Process starts. This is why "attack" and "use ability" are distinct pipelines that share
targeting and effects but not resolution.

## 3.4 The Snapshot/Intent boundary

This is the structural decision that makes the rules layer testable, and it deserves its own
section.

### The problem

Foundry documents are live, reactive, permission-checked, and asynchronous. A damage
calculation that reads `actor.system.currentHp` and `token.document.x` directly is:
- untestable without a running world,
- unable to run on a client that doesn't own the actor,
- vulnerable to mid-calculation mutation,
- impossible to run speculatively (for previews, "what-if" displays, or AI).

### The solution

Before any rules computation, project the world into plain data.

```ts
/** Everything the rules layer may know about one unit. */
interface UnitSnapshot {
  id: string;                       // actor uuid
  tokenId: string;
  name: string;
  kind: "servant" | "master" | "civilian" | "summon" | "platform";
  factionId: string;
  controllerId: string | null;      // user id, null for GM-run units

  parameters: Record<ParamKey, RankString>;
  stats: {
    health:  { value: number; max: number };
    agility: { value: number; max: number };
    luck:    { value: number; max: number };
    mov: number;
    range: { panels: number; targets: number };
    baseAttack: { str: number; mag: number };
    sustainability: number | null;  // null = N/A
  };
  resources: Record<string, { value: number; max: number }>;  // Fragarach Tokens, etc.

  position: { i: number; j: number };   // grid offset (row, col)
  footprint: { w: number; h: number };  // 1x1 for most, 3x3 for grown Kingprotea
  facing: Facing;                       // N | NE | E | SE | S | SW | W | NW
  elevation: number;
  levelId: string | null;               // scene level, for platforms

  attributes: ReadonlySet<string>;      // transitively closed
  effects: EffectSnapshot[];
  abilities: AbilitySnapshot[];

  turnState: {
    moved: boolean; movedPanels: number;
    attacked: boolean;
    acted: boolean;
    usedActiveSkill: boolean;
  };

  contract: {
    state: "contracted" | "unbound" | "free";
    masterId: string | null;
    servantIds: string[];
    commandSpells: number;
  };

  flags: {
    inHomeBase: boolean;
    inOwnMasterZon: boolean;
    presenceConcealed: boolean;
    madEnhancementActive: boolean;
  };
}

interface BoardSnapshot {
  width: number; height: number;
  diagonals: DiagonalRule;
  units: Map<string, UnitSnapshot>;
  occupancy: Map<PanelKey, string[]>;     // panel → unit ids
  zones: ZoneSnapshot[];                  // home bases, NP fields, platforms
  round: number; turn: number; turnsPerRound: number;
  phase: "day" | "night";
  ruleset: RulesetConfig;
}
```

The rules layer receives a `BoardSnapshot` and returns `Intent[]`:

```ts
type Intent =
  | { t: "damage";      unitId: string; amount: number; breakdown: DamageBreakdown }
  | { t: "heal";        unitId: string; amount: number; source: string }
  | { t: "statDelta";   unitId: string; stat: StatKey; delta: number; clamp: boolean }
  | { t: "applyEffect"; unitId: string; effect: EffectSpec; sourceId: string }
  | { t: "removeEffect";unitId: string; effectId: string; reason: RemovalReason }
  | { t: "move";        unitId: string; path: GridOffset[]; forced: boolean }
  | { t: "setFacing";   unitId: string; facing: Facing }
  | { t: "defeat";      unitId: string; cause: DefeatCause }
  | { t: "resource";    unitId: string; key: string; delta: number }
  | { t: "cooldown";    unitId: string; abilityId: string; ticks: number; mode: "set"|"reduce" }
  | { t: "spendCS";     masterId: string; count: number; command: CommandSpellKind }
  | { t: "prompt";      userId: string; prompt: PromptSpec }        // ask a human
  | { t: "log";         entry: LogEntry };
```

### Why intents and not direct writes

1. **Testability.** A combat test asserts on the `Intent[]`, not on document state.
2. **Preview.** The same computation with `apply: false` gives a "this will deal 847 damage"
   tooltip, free.
3. **Permission.** The orchestration layer inspects each intent's target, decides whether the
   current client can write it, and routes accordingly (Ch. 26). The rules layer never needs
   to know who owns what.
4. **Atomicity.** All intents from one resolution are applied in one batch, so a failure
   halfway doesn't leave half a Noble Phantasm applied.
5. **Ordering.** Intents carry an implicit order, and the applier can reorder within
   documented equivalence classes for batching (e.g. all `applyEffect` on the same actor
   become one `createEmbeddedDocuments` call).
6. **Audit.** The intent list *is* the audit log entry.

### Snapshot cost and caching

**RISK.** Naively rebuilding a full `BoardSnapshot` (28 units × ~30 effects) for every
predicate evaluation would be pathological.

Mitigation:
- Snapshots are built once per *operation* (one attack, one skill use), not per predicate.
- `UnitSnapshot` construction is memoized per actor against the actor's `_stats.modifiedTime`
  plus a system-maintained `derivedVersion` counter bumped on effect changes.
- The board occupancy map is maintained incrementally by the movement system, not rebuilt.
- Speculative previews (hover tooltips) reuse the last snapshot and are explicitly allowed to
  be one frame stale.

Budget: full snapshot build ≤ 8 ms for 28 units on the reference machine. Measured in the
performance tests (Ch. 38).

## 3.5 Two pipelines

Everything a unit does goes down one of two paths. Keeping them distinct — rather than making
everything an "attack" — avoids a large class of bugs.

### Pipeline A — Attack (S6 involved)

Used by: Normal Attack, Attack Skill, Damage Spell, Noble Phantasm (damaging), Magic Crest,
Counter, Riding Attack, Instant Counter, Fragarach Counter.

```
declare → legality → target resolve → [per DU] reaction ladder → damage pipeline
        → apply → injury → facing → on-hit effects → counter opportunity → cleanup
```

The defining characteristic: it has a **defender who gets to react**.

### Pipeline B — Application (S6 not involved)

Used by: non-damaging skills, buffs, non-damaging NPs, summons, movement abilities, resource
manipulation, cooldown manipulation.

```
declare → legality → target resolve → [per target] application chance → effects
        → apply → cleanup
```

The defining characteristic: it **cannot be reacted to**, only resisted (debuff resistance is
a probability, not a decision).

### Abilities that do both

Many do. `Het Gele Huis` is pure B. `Brahmastra Kundala` is A (damage) then B (Burn, Def Dwn)
in a specified order. `Mana Burst (Flames)` is a *modifier* to a subsequent A. The ability
model (Ch. 15) represents an ability as an ordered list of **phases**, each of which is an A
or a B, so composition is explicit:

```yaml
- phase: damage        # A
  target: {shape: rect, w: 7, h: 7, anchor: withinRange, range: 5}
  formula: {multiplier: 4, flat: 100, component: both}
  element: fire
- phase: applyEffect   # B  (same target set, reused)
  reuseTargets: true
  effects: [{id: burn, duration: "3◈"}, {id: defDwnB, duration: "1◈", magnitude: 30, npMagnitude: 40}]
- phase: cooldown      # B
  targets: [self]
  set: [{ability: brahmastraKundala, ticks: "7◈+⅓◈"}, {ability: manaBurstFlames, ticks: "default"}]
```

## 3.6 Where state lives

A frequent source of confusion in Foundry systems is *which document owns a given piece of
state*. Fixed here, once.

| State | Lives on | Why |
|---|---|---|
| Parameters, base stats, abilities | `Actor.system` | Intrinsic to the character |
| Current HP/AGI/LUC, resources | `Actor.system` | Per-instance; unlinked tokens get an ActorDelta |
| Effects | `Actor.effects` (`ActiveEffect`) | Native duration/status integration |
| Position, facing, elevation, level | `TokenDocument` | Native; facing uses `rotation` |
| Per-turn action flags | `Actor.system.turnState` | Reset by the turn scheduler |
| Cooldowns | `Item.system.cooldown` on the ability item | Co-located with the ability |
| Turn order, round, day/night | `Combat.system` | One per match |
| Per-player turn budget | `Combatant.system` | Combatants *are* players here |
| Home bases, NP fields | `Scene.regions` | Native region containment + events |
| Platforms | `Scene.levels` + a Platform actor | Native cross-level visibility |
| Grail state, random events | `Combat.system.grail` | Match-scoped |
| Contract graph | `Actor.system.contract` on both ends | Bidirectional, validated on write |

**DECISION.** Effects are `ActiveEffect` documents, not `Item` documents (unlike the
prototype). Rationale: native `duration.start` records combat/round/turn/initiative at
application time, which is precisely what ◈ expiry needs; native status-icon rendering on
tokens; native transfer semantics; and `ActiveEffect` is cheaper than `Item`. The rule-element
payload lives in `effect.system` via a `TypeDataModel`.

## 3.7 Naming conventions

- Domain classes take the rulebook's word: `CombatProcess`, `NoblePhantasm`, `CommandSpell`,
  `Sustainability`, `Zon`.
- Our own concepts are prefixed or clearly non-rulebook: `UnitSnapshot`, `RuleElement`,
  `TargetShape`.
- Foundry document subclasses are prefixed `FGT`: `FGTActor`, `FGTCombat`, `FGTToken`.
- Files are kebab-case, one primary export per file, matching the export name.
- The system id is `fgt`. Flag scope, socket namespace, and CONFIG key all use it.

## 3.8 What comes next

The remaining Part I chapters each take one node of the graph above and specify it fully:

- **04 Units** — the hierarchy and what varies between kinds.
- **05 Ranks** — the algebra everything else indexes into.
- **06 Stats** — derivation, clamping, and resources.
- **07 Time** — ◈, durations, cooldowns, the scheduler.
- **08 Space** — grid, distance, facing, occupancy.
- **09 Targeting** — the shape type system.
- **10 Effects taxonomy** — the catalogue's structure.
- **11 Effect engine** — application and stacking.
- **12 Combat process** — the state machine.

---

**Next:** [04 — Units](04-units.md)
