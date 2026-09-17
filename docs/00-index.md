# 00 — Index and Reading Order

This chapter set describes the F/GT Foundry VTT system **as it is implemented**, not as it was
planned. Every chapter is written from the current source and cites it by `file:line`.

## How to read a chapter

Each chapter follows the same five sections:

| Section | What it holds |
|---|---|
| **What it is** | One paragraph. The thing, in domain terms. |
| **Where it lives** | The file map — every source file this chapter describes. |
| **How it works** | The mechanism, with `file:line` citations. |
| **Invariants & edge cases** | What must stay true *now*, and what breaks if it doesn't. |
| **Traps and anti-patterns** | Defects this subsystem has actually suffered, and the rule each one bought. |
| **Open questions** | Claims not yet verified, and decisions not yet made. |

**Everything in the main body is present tense and current.** A defect that has been fixed does
not belong in *How it works* or *Invariants* — it goes in **Traps and anti-patterns**, at the
bottom, where it reads as a warning rather than a bug report. Each entry names the trap, states
the rule in the imperative, and keeps the history as the evidence for it:

> **Adding a write path without declaring the schema field.** Foundry discards a write to an
> undeclared path without error. `baseAttack` was written to Masters for months and silently
> dropped; every Master attacked for `{str: 0, mag: 0}`. **Add the field to the schema in the
> same change as the write.**

Chapters are capped at roughly **300 lines**. A chapter that wants to be longer is two chapters,
or its detail belongs in an appendix.

### Citation convention

Every citation uses the **full repo-relative path**, every time — `module/engine/applier.mjs:105`,
never a bare `applier.mjs:105`, even on the second mention in the same chapter. It costs a few
characters and buys two things: any citation can be copied straight into an editor, and the whole
set can be checked mechanically. Files at the repo root (`system.json`, `eslint.config.mjs`) are
already full paths as written.

A line range (`:100-121`) points at a block worth reading whole; a single line (`:105`) points at
the exact statement the claim rests on.

## Rules of this documentation

1. **The code is the authority.** A claim that can't be traced to current source or a passing
   test doesn't go in a chapter — it goes under *Open questions*.
2. **`docs/plan-archive/` is not a source.** Those are the original plan-era chapters 00–45,
   written before the implementation existed. They are kept for history only.
3. **Behavioural claims are tagged `[unverified]`** until confirmed in a running world.
4. **Vocabulary comes from `CONTEXT.md`** at the repo root, which is the glossary. There is no
   glossary chapter.
5. **A comment describing a bug is not evidence the bug is live.** This codebase comments in an
   unusual style: the post-mortem of a defect is written *at the site of its fix*, in the past
   tense, often at length. `module/data/actor/master.mjs:24-33` explains at length that every
   Master reported `{str: 0, mag: 0}` — on the lines immediately above the code that fixed it.
   Before recording any defect as current, **confirm the fix is absent**: read the code the
   comment sits on, and check for a regression test. Report the durable lesson, not the corpse.

## The map

### Part I — Orientation

| Ch | Chapter |
|---|---|
| 00 | Index and reading order *(this file)* |
| 01 | What F/GT is, and what this system implements |
| 02 | Architecture: five layers, and the one place that writes |

### Part II — Domain primitives — `module/domain/`

| Ch | Chapter |
|---|---|
| 03 | Ranks, parameters and the rank-indexed tables |
| 04 | The ◈ tick operator and the time model |
| 05 | Board geometry: distance, shapes, reachability |
| 06 | Units: kinds, stats, health and resources |

### Part III — Data and documents — `module/data/`, `module/documents/`

| Ch | Chapter |
|---|---|
| 07 | Actor and Item schemas |
| 08 | Document subclasses and derived data |
| 09 | Projection: documents → plain data |

### Part IV — The rules engine — `module/rules/`

| Ch | Chapter |
|---|---|
| 10 | Rule elements, scripts and priority bands |
| 11 | Predicates, roll options and facets |
| 12 | Invalidation, auras and the aura index |
| 13 | Checks, randomness and the roll log |

### Part V — Effects

| Ch | Chapter |
|---|---|
| 14 | Effect taxonomy, registry and families |
| 15 | The seven-step application pipeline |
| 16 | Removal, transfer, visibility and undo |

### Part VI — Acting

| Ch | Chapter |
|---|---|
| 17 | Abilities: costs, requirements and timing windows |
| 18 | Items and equipment |
| 19 | The action economy and the turn budget |
| 20 | Targeting: the eleven-step algorithm |
| 21 | The Combat Process state machine |
| 22 | The damage pipeline: sixteen stages |
| 23 | Reactions, counters and deadlines |
| 24 | Modes, stances, compulsion and control |

### Part VII — The board and the world

| Ch | Chapter |
|---|---|
| 25 | Turn order, the scheduler and round boundaries |
| 26 | Terrain |
| 27 | Platforms, levels and scene levels |
| 28 | Bounded fields: the six-axis model |
| 29 | Environment: day/night, Home Base and the Holy Grail |
| 30 | Concealment, identity, Detect and vision |

### Part VIII — The war

| Ch | Chapter |
|---|---|
| 31 | Factions, war setup, summoning and contracts |
| 32 | Relationships, Overpower and the multi-Servant tax |
| 33 | Command Spells |

### Part IX — Interface — `module/apps/`

| Ch | Chapter |
|---|---|
| 34 | Action bar, turn panel and pending decisions |
| 35 | Sheets, the ability editor and the predicate builder |
| 36 | Canvas layers: targeting, overlays and tokens |
| 37 | Chat cards, the game log and card visibility |

### Part X — Authority, content and change

| Ch | Chapter |
|---|---|
| 38 | Authority: the GM proxy socket and typed operations |
| 39 | The authoring vocabulary |
| 40 | Content pipeline: packs, YAML export and content sync |
| 41 | Migration and versioning |
| 42 | History, state rewind and desync detection |

### Part XI — Practice

| Ch | Chapter |
|---|---|
| 43 | Tooling: builds, checks and driving a live world |
| 44 | Testing strategy |
| 45 | Case studies: how a Servant's clauses become engine features |

## Alongside the chapters

| Document | What it holds |
|---|---|
| `46-roster-re-audit.md` | The roster audit. Live, maintained separately from this set. |
| `A-effect-catalogue.md` | Every effect definition, as a table. |
| `B-rank-tables.md` | The rank-indexed tables, as data. |
| `C-dice-registry.md` | Every die rolled, and where. |
| `D-servant-data-sheets.md` | Per-Servant detail. Chapter 45 explains the *pattern*; this holds the instances. |
| `E-event-reference.md` | Every event the engine raises. |
| `Master Essences.md` | Master Essence source notes. |
| `CONTEXT.md` *(repo root)* | The glossary. Terms only, no implementation. |
| `docs/adr/` | Architecture decision records. |
| `docs/agents/` | How agents should consume this repo — issue tracker, labels, domain docs. |

## Provenance

The chapter map was derived from the codebase in September 2026: 219 files under `module/`,
14 under `tools/`, and 213 test files. Each chapter names a real cluster of source files rather
than a topic drawn in advance. The predecessor set — 46 chapters, 40,876 lines, written as a
plan before implementation began — is in `docs/plan-archive/`.
