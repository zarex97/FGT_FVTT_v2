# FGT System Design Documentation — Index

This is the complete design specification for the Fate/Grail Tactics Foundry VTT system.
It is written to be read by a senior engineer who has never played the game, and to be
sufficient to implement the system without further reference to the original documents.

**Conventions used throughout:**

- `◈` means *number of Turns in a Round*. See [Chapter 07](07-time-model.md).
- Class and interface names are given in `PascalCase`, fields in `camelCase`,
  enum members in `SCREAMING_SNAKE_CASE`.
- Code blocks labelled `ts` are illustrative type declarations, not necessarily the final
  implementation language (the system ships as JSDoc-annotated ESM).
- Blocks marked **RULES** quote or paraphrase the source rulebook.
- Blocks marked **DECISION** record a design choice where the source was ambiguous.
- Blocks marked **RISK** flag something likely to be painful in implementation.

---

## Part 0 — Orientation

| # | Chapter | What it covers |
|---|---|---|
| 01 | [Vision and Goals](01-vision-and-goals.md) | What "full automation" means here, non-goals, success criteria, why the prototype is being replaced |
| 02 | [Glossary](02-glossary.md) | Every term of art, with its formal definition and the class that owns it |

## Part I — The Domain Model

| # | Chapter | What it covers |
|---|---|---|
| 03 | [Domain Overview](03-domain-overview.md) | The object graph at a glance; aggregate roots; the eight subsystems and how they compose |
| 04 | [Units](04-units.md) | `Unit` hierarchy: Servant, Master, Civilian, Summon, Platform, Structure. Identity, disposition, factions, ownership |
| 05 | [Ranks and Parameters](05-ranks-and-parameters.md) | Rank algebra (E → EX, `+`/`-` modifiers), parameter→stat derivation, rank comparison semantics |
| 06 | [Stats and Resources](06-stats-and-resources.md) | Health, Agility, Luck, MOV, Range, Sustainability, Command Spells, and ability-specific resource pools (tokens, stocks, counters) |
| 07 | [The Time Model](07-time-model.md) | Rounds, Turns, the ◈ operator, fractional-◈ arithmetic and rounding, duration semantics, cooldown semantics, the scheduler |
| 08 | [Board and Geometry](08-board-and-geometry.md) | Grid, panels, distance metrics, the diagonal-reduction rule, facing and the four-cone direction model, occupancy, multi-panel units |
| 09 | [Targeting](09-targeting.md) | **The targeting type system.** Every shape in the game, formalized, with resolution algorithms |
| 10 | [Effects Taxonomy](10-effects-taxonomy.md) | The complete catalogue of buffs, debuffs, and non-buff statuses, classified by axis |
| 11 | [The Effect Engine](11-effect-engine.md) | How an effect is represented, applied, stacked, suppressed, expired, and removed |
| 12 | [The Combat Process](12-combat-process.md) | The step-by-step state machine, including the luck-check contest ladder |

## Part II — Resolution Systems

| # | Chapter | What it covers |
|---|---|---|
| 13 | [The Damage Pipeline](13-damage-pipeline.md) | The strictly ordered damage computation, all 14 stages, with worked examples |
| 14 | [Checks and Randomness](14-checks-and-randomness.md) | Agility Check, Luck Check, coin flips, injury rolls, block rolls, the dice-roll registry |
| 15 | [Abilities](15-abilities.md) | Skills, Active/Passive, Spells, Attack Skills, Noble Phantasms, Class Skills, categorization rules |
| 16 | [Relationships](16-relationships.md) | Master↔Servant contracts, ZON, Sustainability, Cover, Overpower/Underpower, contract stealing |
| 17 | [Command Spells](17-command-spells.md) | The interrupt system; command spells as the only pre-emption mechanism |
| 18 | [Action Economy](18-action-economy.md) | Per-turn budgets, what counts as Acting, Move/Attack ordering, Riding's double-move |
| 19 | [Environment](19-environment.md) | Home Base, Day/Night cycle, Region bonuses, the Holy Grail, Random Events, Civilians |
| 20 | [Platforms and Levels](20-platforms-and-levels.md) | Hanging Gardens of Babylon, Golden Hind, Storm Border — vehicles as scene levels |

## Part III — Foundry Architecture

| # | Chapter | What it covers |
|---|---|---|
| 21 | [System Skeleton](21-system-skeleton.md) | Manifest, module layout, bootstrap sequence, CONFIG registration, build tooling |
| 22 | [Data Models](22-data-models.md) | Every `TypeDataModel` schema: actor subtypes, item subtypes, combat, combatant |
| 23 | [Documents and Derived Data](23-documents-and-derived-data.md) | Document subclasses, the derived-data pipeline, preparation order, caching |
| 24 | [The Rules Engine](24-rules-engine.md) | Rule elements, predicates, roll options, change resolution, priority |
| 25 | [The Turn System](25-turn-system.md) | Player-based `Combat`, turn ownership, Delay, the round/turn event bus |
| 26 | [Authority and Sockets](26-authority-and-sockets.md) | The GM proxy, the operation protocol, permission model, closed-information play |
| 27 | [The Reaction Protocol](27-reaction-protocol.md) | Interactive multi-party prompts: how the evade/luck ladder is driven across clients |
| 28 | [Targeting Implementation](28-targeting-implementation.md) | v14 grid shape generators, preview rendering, validation, LOS, the targeting service |
| 29 | [User Interface](29-user-interface.md) | ApplicationV2 sheets, the tactical HUD, the action bar, the effect tray |
| 30 | [Chat and Audit](30-chat-and-audit.md) | Chat card architecture, the damage explainer, the game log, replay |

## Part IV — Case Studies and Reference

| # | Chapter | What it covers |
|---|---|---|
| 31 | [Case Study: Heracles](31-case-heracles.md) | Revival priority chains, God Hand's attack-recording, permanent Mad Enhancement |
| 32 | [Case Study: Semiramis](32-case-semiramis.md) | Construction counters, a 9×9 flying fortress, conditional class skills, summons |
| 33 | [Case Study: Mannanán mac Lir](33-case-mannanan.md) | Counter-NP that cancels other NPs, token economy, mode switching |
| 34 | [Case Study: The Dioscuri](34-case-dioscuri.md) | One Servant, two bodies, half-unit accounting, shared cooldowns |
| 35 | [Case Study: Van Gogh & Curse Economy](35-case-van-gogh.md) | Self-harm as a resource, >100% application chances, curse transfer |
| 36 | [Case Study: The Remaining Seven](36-case-remaining.md) | Karna, Kiritsugu, Drake, Scáthach, Penthesilea, Nemo, Kingprotea |
| 37 | [Content Pipeline](37-content-pipeline.md) | Authoring format, compendium build, validation, the Servant schema |
| 38 | [Testing Strategy](38-testing-strategy.md) | Unit-testing a rules engine, golden-file combat tests, property tests for geometry |
| 39 | [Migration and Versioning](39-migration-and-versioning.md) | Schema versioning, data migration, rule-version pinning for in-progress games |
| 40 | [Roadmap](40-roadmap.md) | Milestones, sequencing, what "done" means per phase |
| 41 | [Open Questions](41-open-questions.md) | Q1–Q40 and Q50 answered by the game's author; Q41–Q49 still open |
| 42 | [Terrain](42-terrain.md) | The 21 terrain types, the directional overlap matrix, and day/night as a per-panel property |
| 43 | [Bounded Fields](43-bounded-fields.md) | The third area family: enclosed NP zones with their own membership, permeability and escape rules |
| 44 | [Case Studies: The Expanded Roster](44-case-expanded-roster.md) | Everything the 17 added Servants demanded, grouped by mechanism |
| 45 | [Implementation Status and Completion Plan](45-implementation-status.md) | What is built, what is stubbed, what is missing, and the order to finish it in |
| 45 | [Case Studies: The Expanded Roster](44-implementation-status.md) | Everything the 17 added Servants demanded, grouped by mechanism |

## Appendices

| # | Appendix | What it covers |
|---|---|---|
| A | [Effect Catalogue](A-effect-catalogue.md) | All 152 effects with formal semantics, stacking, and implementation notes |
| B | [Rank Tables](B-rank-tables.md) | Every rank-indexed table in the game, in one place |
| C | [Dice Roll Registry](C-dice-registry.md) | Every named roll, its formula, and its modifiers |
| D | [Servant Data Sheets](D-servant-data-sheets.md) | The 29 reference Servants as fully-specified system data |
| E | [Event Reference](E-event-reference.md) | Every hook and engine event, with payload shapes and ordering guarantees |

Changes to any of the above are tracked in the [changelog](../CHANGELOG.md).

---

## Reading paths

**"I'm implementing the combat engine."**
02 → 07 → 12 → 13 → 14 → 27 → 30

**"I'm implementing targeting."**
08 → 09 → 28 → 42 → 43 → Appendix D (to see the real shapes in use)

**"I'm authoring content."**
05 → 10 → 11 → 15 → 24 → 37 → Appendix A → Appendix D

**"I'm reviewing the architecture."**
01 → 03 → 21 → 22 → 24 → 26 → 40

**"I'm implementing areas."**
08 → 09 → 19 → 20 (platforms and levels) → 42 (terrain) → 43 (bounded fields).
These are three *distinct* area families and Chapter 43 §43.1 explains why they are not unified.

**"I want to know what changed and why."**
[CHANGELOG](../CHANGELOG.md) → 41 (Open Questions) → 44
