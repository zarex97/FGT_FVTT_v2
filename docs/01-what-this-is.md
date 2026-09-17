# 01 — What F/GT Is, and What This System Implements

## What it is

**F/GT — Fate/Grail Tactics** is a grid-based tactical wargame of Masters, Servants and Noble
Phantasms, originally played in Tabletop Simulator. This repository is a ground-up Foundry VTT
**system** that implements it with full rules automation (`system.json:2-4`).

The distinction that shapes every other decision in this codebase: F/GT is not a role-playing
game with a character sheet, it is a **wargame with a rules engine**. A Servant is not a sheet of
numbers a human interprets — it is a compendium document whose clauses the engine executes.
Automating it means building an engine, and the size of that engine is the reason this
documentation set exists.

The game itself, in one paragraph: play happens on a 13×13 or 25×25 grid of **panels**. A turn
belongs to a **player**, not a token — one player moves several Servants and Masters in a single
turn. A **Round** is one turn per player, and the symbol **◈** means "the number of turns in a
round", which is a *world setting* rather than a constant — so nearly every duration in the game
is expressed as a multiple or fraction of a quantity that varies per world (see Chapter 04).
Combat is an interactive negotiation between two players — attack, evade, luck-check contest,
counter-check, counter-attack — rather than a single roll. Damage runs through a long, strictly
ordered pipeline. Status effects interact by explicit priority rules. Noble Phantasms carve
enclosed **bounded fields** into the board, with their own membership and escape rules.

## Where it lives

| File | Role |
|---|---|
| `system.json` | The Foundry manifest: id `fgt`, version, compatibility, document sub-types |
| `package.json` | Scripts: test, lint, typecheck, pack build, release, smoke |
| `README.md` | Repository front door |
| `CHANGELOG.md` | Version history, including rule corrections that invalidate earlier content |
| `module/fgt.mjs` | The system entry point — init/setup/ready |
| `module/config.mjs` | `CONFIG.FGT` — the public configuration surface |

## How it works

### The shape of the implementation

| Measure | Value |
|---|---|
| System id / title | `fgt` — "Fate/Grail Tactics" (`system.json:2-3`) |
| Version | `0.3.5` (`system.json:5`) |
| Foundry compatibility | minimum **14**, verified **14.364** (`system.json:6-9`) |
| Source files under `module/` | 219 `.mjs` |
| Build and check tooling under `tools/` | 14 `.mjs` |
| Test files under `test/` | 213 |

The system registers its own Actor and Item sub-types rather than reusing generic ones — Servant,
Master, Civilian, Summon, Platform and Structure on the Actor side; Ability, Noble Phantasm,
Command Spell, Master Essence and Equipment on the Item side (`system.json`, and Chapter 07).

### The four design pillars, and the code that keeps them

The project states four pillars. Each is checkable against the source, and each is currently
honoured:

**1. Automated targeting is a first-class subsystem.** Abilities declare target geometry
declaratively — a shape, a size, an anchor — and the engine resolves, previews, validates and
applies it, rather than asking a player to click tokens. The resolution is an explicit
**eleven-step algorithm** (`module/rules/targeting/resolve.mjs:1-6`), with the authored
vocabulary held separately in `module/rules/targeting/vocabulary.mjs`. See Chapter 20.

**2. Data, not code, describes content.** A Servant is a compendium document, not a script.
Effects are declarative rule elements with predicates (`module/rules/elements.mjs`), and scripts
are the escape hatch rather than the norm. That claim is measurable: the entire script registry
is **64 lines**, and its header calls itself *"the escape hatch — a closed registry of named
scripts"* (`module/engine/scripts.mjs:1-2`). A closed registry that stayed small is the evidence
the pillar held. See Chapters 10 and 39.

**3. The rules are a state machine, and the state machine is explicit.** The Combat Process is
implemented as named steps taken straight from the rulebook
(`module/engine/combat-process.mjs:1-3`). See Chapter 21.

**4. Every number is auditable.** A damage figure expands into the ordered list of modifiers that
produced it — the pipeline runs **sixteen strictly ordered stages**
(`module/rules/damage/pipeline.mjs:1-3`), rendering is separated into
`module/rules/explain.mjs`, and every roll is recorded by `module/rules/roll-log.mjs`. See
Chapters 13 and 22.

### The system's recurring shape

Several subsystems are described in their own headers by a step or axis count, and the counts are
load-bearing rather than decorative — they come from the rulebook and the code is arranged to
match:

| Subsystem | Shape | Source |
|---|---|---|
| Targeting resolution | eleven steps | `module/rules/targeting/resolve.mjs` |
| Damage | sixteen ordered stages | `module/rules/damage/pipeline.mjs` |
| Effect application | seven steps | `module/engine/effect-applier.mjs` |
| Bounded fields | six axes | `module/rules/bounded-fields.mjs` |
| Intents | thirty-three frozen types | `module/engine/intents.mjs:23-36` |

### What this system is not

- **Not a generic VTT system.** It implements one game, and its data models name that game's
  concepts directly.
- **Not a character-sheet system.** The sheets exist, but the engine is the product.
- **Not system-agnostic in its content.** The compendium packs under `packs/_source/` are F/GT
  content, authored as YAML and compiled to LevelDB (Chapter 40).

## Invariants & edge cases

1. **The version in `system.json` is the only authoritative one.** There is no separate
   "documentation version"; the chapter set is rebuilt from the code rather than versioned against
   it. `README.md` carried a stale `0.2.1` documentation version for some time — the manifest
   wins, always.
2. **`◈` is a setting, not a constant.** Code that hardcodes a turns-per-round value is wrong by
   construction. Every consumer reads the `turnsPerRound` setting (Chapter 04).
3. **A turn belongs to a player, not a token.** `module/documents/combat.mjs` states this in its
   own header: *"`FGTCombat` — turns belong to players, not tokens."* Any reasoning that assumes
   Foundry's default token-initiative model will be wrong here (Chapter 25).
4. **Rule corrections can invalidate authored content.** `CHANGELOG.md` records corrections in
   `0.2.0` and `0.2.1` that invalidated anything built against the earlier Range geometry, Block
   rule, or crit-damage placement. Content is versioned against the rules, not just the schema
   (Chapter 41).

## Open questions

- **"The rules engine is complete and tested" is not a checkable claim** as stated. Completeness
  against what? The live status documents are `46-roster-re-audit.md` and, historically,
  the archived implementation-status chapter. A durable definition of "complete" — probably
  "every clause in the roster has an engine feature" — belongs in an ADR.
- **Confirmed live.** Attacks do resolve end to end through the interface. Verified in the
  `fgt2026` world: **169 chat messages carry Combat Process state**, and a rendered card shows the
  full ladder — *"Sikera Ušum: Arrogant King's Alcohol (B+) — Choose a reaction: Do nothing /
  Block −25% Total Damage / Evade — Scales of the Sacred Fish"*, with a Command Spell interrupt
  offered alongside it. The flagged state carries `attackerId`, `defenderId`, `attack`,
  `reaction`, `evaded`, `isAoE`, `groupId`, `isCounter`, `counterDepth`, `counterRedirectId`,
  `history` and `rolls` — the whole machine, not a stub.
