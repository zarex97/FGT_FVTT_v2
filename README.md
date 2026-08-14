# FGT — Fate/Grail Tactics for Foundry VTT

A ground-up Foundry VTT **system** implementing *F/GT: Fate Grail Tactics*, a grid-based
tactical wargame originally played in Tabletop Simulator, with **full rules automation**.

This repository currently contains the **design documentation** for that system. The
implementation follows.

**Current documentation version: `0.2.1`.** See [`CHANGELOG.md`](CHANGELOG.md) for what changed
and why — including corrections in `0.2.0` and `0.2.1` that invalidate anything built against an
earlier version's Range geometry, Block rule, or crit-damage placement.

---

## Start here

| If you want to… | Read |
|---|---|
| Understand what we are building and why | [`docs/01-vision-and-goals.md`](docs/01-vision-and-goals.md) |
| Look up a term used anywhere in these docs | [`docs/02-glossary.md`](docs/02-glossary.md) |
| Understand the game as a formal model | [Part I — Domain Model](docs/00-index.md#part-i--the-domain-model) |
| Understand how combat/damage actually resolve | [Part II — Resolution Systems](docs/00-index.md#part-ii--resolution-systems) |
| Understand the Foundry code architecture | [Part III — Foundry Architecture](docs/00-index.md#part-iii--foundry-architecture) |
| See how a specific Servant gets automated | [Part IV — Case Studies](docs/00-index.md#part-iv--case-studies-and-reference) |
| Know what changed since the last version | [`CHANGELOG.md`](CHANGELOG.md) |
| Just see the whole table of contents | [`docs/00-index.md`](docs/00-index.md) |

---

## The one-paragraph summary

F/GT is a chess-like tactical game on a 13×13 or 25×25 grid. Each **player** — not each
token — takes a turn, moving up to 4 Servants and 3 Masters and making at most 2 Servant
attacks. A **Round** is one turn per player plus the GM's turn; the symbol **◈** means
"number of turns in a round", and nearly every duration in the game is expressed in
multiples and fractions of it. Combat is an interactive negotiation between two players —
attack, evade, luck-check contest, counter-check, counter-attack — not a single roll.
Damage runs through a long, strictly-ordered pipeline of multiplicative and flat modifiers.
Over 150 named status effects interact with each other by explicit priority rules, on a board
whose panels carry terrain, whose airspace carries platforms, and into which Noble Phantasms
carve enclosed **bounded fields** with their own membership and escape rules. Automating this
means building a **rules engine**, not a character sheet.

---

## Design pillars

1. **Automated targeting is a first-class subsystem.** Every ability declares its target
   geometry declaratively (`{shape: "orthogonalRect", w: 5, h: 5, anchor: "edge-adjacent"}`)
   and the engine resolves, previews, validates, and applies it. No manual token clicking.
   See [Chapter 09](docs/09-targeting.md).
2. **Data, not code, describes content.** A Servant is a compendium document, not a script.
   Effects are declarative rule elements with predicates. Scripts are the escape hatch, not
   the norm. See [Chapters 11](docs/11-effect-engine.md) and [24](docs/24-rules-engine.md).
3. **The rules are a state machine, and the state machine is explicit.** The Combat Process
   has named steps (1, 2, 2.1 … 2.5, 3, 4, 5, 6) straight from the rulebook, and the engine
   implements exactly those steps. See [Chapter 12](docs/12-combat-process.md).
4. **Every number is auditable.** Any damage figure can be expanded into the ordered list of
   modifiers that produced it. See [Chapter 30](docs/30-chat-and-audit.md).
5. **Turns belong to players.** The Combat document is player-based, and the action economy
   (4 moves / 3 master moves / 2 servant attacks) is tracked per player per turn.
   See [Chapter 25](docs/25-turn-system.md).
6. **The GM is an authority, not a bottleneck.** A socket proxy lets players drive their own
   units against actors they do not own, without handing out permissions.
   See [Chapter 26](docs/26-authority-and-sockets.md).
7. **The board is not flat, and areas are not one thing.** A panel has terrain; the space
   above it has platforms and levels; and Noble Phantasms carve out enclosed *bounded fields*
   with their own membership, permeability and escape rules. These are three separate models
   on purpose. See [Chapters 20](docs/20-platforms-and-levels.md),
   [42](docs/42-terrain.md) and [43](docs/43-bounded-fields.md).

---

## Target platform

- **Foundry VTT v14** (release generation 14). This matters: v14 replaced `MeasuredTemplate`
  with grid **shape generators** (`grid.getRectangle`, `getCone`, `getCircle`, …), added
  **Scene Levels**, and moved movement into a first-class `TokenDocument.move()` API with
  waypoints and cost functions. All three are load-bearing in this design.
- ES modules, no build step required for the core system; TypeScript-style JSDoc for typing.

---

## Repository layout (planned)

```
FGT_FVTT_v2/
├── docs/                  ← design documentation (this deliverable)
├── CHANGELOG.md           ← every change to docs, and later to code
├── system.json            ← manifest
├── module/
│   ├── fgt.mjs            ← entry point
│   ├── data/              ← DataModel schemas (actor/item/combat subtypes)
│   ├── documents/         ← Document subclasses
│   ├── rules/             ← the rule-element engine
│   ├── engine/            ← combat process, damage pipeline, checks, scheduler
│   ├── targeting/         ← geometry resolution
│   ├── apps/              ← ApplicationV2 sheets and dialogs
│   └── helpers/
├── packs/                 ← compendium content (Servants, Masters, effects)
├── templates/
├── styles/
└── lang/
```

---

## Status

| Phase | State |
|---|---|
| Design documentation | **`0.2.1`** — 44 chapters + 5 appendices, see `docs/` |
| System skeleton | **`system.json`, tooling, CI config** — done |
| L1 domain (pure) | **Done** — ranks, ◈ ticks, geometry, rank tables |
| L2 rules (pure) | **Damage pipeline, targeting, checks, predicates, snapshots** — done |
| L3 engine (orchestration) | **Intents, effect applier, combat process, scheduler, write adapter** — done |
| Foundry layer (data models, documents, sheets) | Not started |
| Content (29 reference Servants) | Specified in Part IV and Appendix D, not yet authored |

**266 tests passing**, covering everything built so far. They pin behaviour to the
*documentation* rather than to the implementation: the R=4 attack-range diagram is asserted
character for character, all six Mad Enhancement sheets are checked against the rank table, and
both worked examples from Chapter 13 are golden fixtures.

```
npm install
npm test          # 266 unit + golden tests, no Foundry required
npm run lint      # includes the layer-boundary rule
```

The `domain/` → `rules/` → `engine/` → `apps/` dependency direction is enforced by ESLint, and
`module/domain` and `module/rules` are forbidden from touching Foundry globals at all. That is
what makes the whole rules engine testable in plain Node.

Open design questions are tracked in
[`docs/41-open-questions.md`](docs/41-open-questions.md): **Q1–Q40 answered** by the game's
author, **Q41–Q49 open**.

## Sources

The design is derived from these primary documents:

- *F/GT Rulebook — Great Holy Grail War*
- *F/GT Advanced: Common Skills*
- *Status Effects / Keywords / Attributes / Other*
- *Important — ◈ notation* (rounds and turns)
- *General Notes*
- *Terrain Effects* — the 21 terrain types and their overlap rules (added in `0.2.0`)
- *41-open-questions.md, annotated* — the author's answers to Q1–Q38 (added in `0.2.0`)
- **29 reference character sheets:**
  - The original twelve: Van Gogh, Mannanán mac Lir, Kingprotea, the Dioscuri, Semiramis,
    Scáthach, Karna, Kiritsugu, Francis Drake, Penthesilea, Nemo, Heracles.
  - Added in `0.2.0`: Nursery Rhyme, Hassan of Serenity, Jack the Ripper, Yan Qing,
    Katō Danzō, Hundred-Faced Hassan, Medea, Achilles, Ozymandias, Medusa, Pale Rider,
    Anastasia & Viy, Quetzalcoatl, EMIYA, Proto Gil, Asterios, Raikou.

Where the source documents are ambiguous or self-contradictory, the resolution is recorded
explicitly in [`docs/41-open-questions.md`](docs/41-open-questions.md) rather than silently
decided. Where a resolution later turned out to be **wrong**, the correction is recorded in
[`CHANGELOG.md`](CHANGELOG.md) alongside the superseded reading — see the Range formula in
`0.2.0`, which fit every piece of evidence available and was still incorrect.
