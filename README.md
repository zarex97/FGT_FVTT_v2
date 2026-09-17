# FGT — Fate/Grail Tactics for Foundry VTT

A ground-up Foundry VTT **system** implementing *F/GT: Fate Grail Tactics*, a grid-based
tactical wargame originally played in Tabletop Simulator, with **full rules automation**.

This repository contains the **system implementation** and its **documentation**. The rules
engine, the interface and the content pipeline are all built; attacks resolve end to end through
the UI.

**System version: `0.3.5`** (`system.json`). See [`CHANGELOG.md`](CHANGELOG.md) for what changed
and why — including rule corrections that invalidate anything built against an earlier version's
Range geometry, Block rule, or crit-damage placement.

> **The documentation was rebuilt from the codebase in September 2026.** The previous 46 chapters
> were written as a *plan*, before the implementation existed, and had gone stale. Every chapter
> is now derived from current source and cites it by `file:line`. The superseded set is kept in
> [`docs/plan-archive/`](docs/plan-archive/README.md) with a mapping of where each subject went.

---

## Start here

| If you want to… | Read |
|---|---|
| Understand what this is and what it implements | [`docs/01-what-this-is.md`](docs/01-what-this-is.md) |
| Look up a term used anywhere | [`CONTEXT.md`](CONTEXT.md) — the glossary |
| Understand the code architecture | [`docs/02-architecture.md`](docs/02-architecture.md) |
| Understand how combat and damage resolve | [Ch. 21](docs/21-combat-process.md), [Ch. 22](docs/22-damage-pipeline.md) |
| See how a Servant's clauses become engine features | [`docs/45-case-studies.md`](docs/45-case-studies.md) |
| Run or drive a live world | [`docs/43-tooling.md`](docs/43-tooling.md) |
| Know what changed since the last version | [`CHANGELOG.md`](CHANGELOG.md) |
| See the whole table of contents | [`docs/00-index.md`](docs/00-index.md) |

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
   See [Ch. 20](docs/20-targeting.md).
2. **Data, not code, describes content.** A Servant is a compendium document, not a script.
   Effects are declarative rule elements with predicates. Scripts are the escape hatch, not
   the norm. See [Ch. 15](docs/15-effect-application.md) and [Ch. 10](docs/10-rule-elements.md).
3. **The rules are a state machine, and the state machine is explicit.** The Combat Process
   has named steps (1, 2, 2.1 … 2.5, 3, 4, 5, 6) straight from the rulebook, and the engine
   implements exactly those steps. See [Ch. 21](docs/21-combat-process.md).
4. **Every number is auditable.** Any damage figure can be expanded into the ordered list of
   modifiers that produced it. See [Ch. 37](docs/37-chat-and-log.md).
5. **Turns belong to players.** The Combat document is player-based, and the action economy
   (4 moves / 3 master moves / 2 servant attacks) is tracked per player per turn.
   See [Ch. 25](docs/25-turn-order-and-scheduler.md).
6. **The GM is an authority, not a bottleneck.** A socket proxy lets players drive their own
   units against actors they do not own, without handing out permissions.
   See [Ch. 38](docs/38-authority.md).
7. **The board is not flat, and areas are not one thing.** A panel has terrain; the space
   above it has platforms and levels; and Noble Phantasms carve out enclosed *bounded fields*
   with their own membership, permeability and escape rules. These are three separate models
   on purpose. See [Ch. 27](docs/27-platforms-and-levels.md),
   [Ch. 26](docs/26-terrain.md) and [Ch. 28](docs/28-bounded-fields.md).

---

## Target platform

- **Foundry VTT v14** (release generation 14). This matters: v14 replaced `MeasuredTemplate`
  with grid **shape generators** (`grid.getRectangle`, `getCone`, `getCircle`, …), added
  **Scene Levels**, and moved movement into a first-class `TokenDocument.move()` API with
  waypoints and cost functions. All three are load-bearing in this design.
- ES modules, no build step required for the core system; TypeScript-style JSDoc for typing.

---

## Repository layout

```
FGT_FVTT_v2/
├── docs/                  ← 46 chapters + 5 appendices, written from the code
│   └── plan-archive/      ← the superseded plan-era chapters, kept for history
├── CHANGELOG.md           ← every change to docs and code, with superseded readings
├── system.json            ← manifest
├── module/
│   ├── fgt.mjs            ← entry point: the init/setup/ready sequence
│   ├── domain/            ← L1, pure: ranks, ◈ ticks, geometry, rank tables
│   ├── rules/             ← L2, pure: damage pipeline, targeting, checks, predicates
│   ├── engine/            ← L3: intents, effect applier, combat process, scheduler
│   ├── data/              ← TypeDataModel schemas
│   ├── documents/         ← Document subclasses
│   ├── net/               ← the GM proxy socket and its typed operations
│   └── apps/              ← sheets, chat cards, the turn HUD, the targeting canvas layer
├── packs/_source/         ← content as YAML; the packs themselves are build artefacts
├── assets/                ← artwork, found by id at build time (assets/README.md)
├── tools/                 ← pack build, content validator, release stamping,
│                          layer check, and the live-world drivers
├── test/                  ← 5,021 unit and golden tests, no Foundry required
├── templates/  styles/  lang/
```

The `domain → rules → engine → apps` dependency direction is enforced by
[`tools/check-layers.mjs`](tools/check-layers.mjs), which runs as part of `npm run lint` — not by
ESLint itself, which would need `eslint-plugin-import`. `module/domain` and `module/rules` are
forbidden from referencing Foundry globals at all, which is what makes the entire rules engine
testable in plain Node. Three violations are recorded in an allowlist, each with the reason it
exists and what would remove it; a *stale* entry fails the check too, so the list cannot outlive
the debt. See [Ch. 02](docs/02-architecture.md).

---

## Status

| Area | State | Chapter |
|---|---|---|
| Documentation | 46 chapters, written from the code, `file:line` cited | [00](docs/00-index.md) |
| L1 domain (pure) | Ranks, ◈ ticks, geometry, tables, health, resources | [03](docs/03-ranks-and-tables.md)–[06](docs/06-units-and-stats.md) |
| L2 rules (pure) | Damage pipeline, targeting, checks, predicates, projection | [09](docs/09-projection.md)–[13](docs/13-checks-and-randomness.md) |
| L3 engine | Intents, effect applier, combat process, scheduler, write adapter | [02](docs/02-architecture.md), [15](docs/15-effect-application.md), [21](docs/21-combat-process.md), [25](docs/25-turn-order-and-scheduler.md) |
| Foundry layer | Manifest, data models, documents, sheets, ability editor | [07](docs/07-schemas.md), [08](docs/08-documents-and-derived.md), [35](docs/35-sheets-and-editor.md) |
| Attack flow | Declaration → reaction ladder → damage → card, end to end | [21](docs/21-combat-process.md), [22](docs/22-damage-pipeline.md), [23](docs/23-reactions.md) |
| Canvas targeting | Preview, review, overlays, level-aware token clicks | [20](docs/20-targeting.md), [36](docs/36-canvas-layers.md) |
| Turn HUD | Budget pools, per-unit state, the compulsion gate | [19](docs/19-action-economy.md), [34](docs/34-action-bar.md) |
| Effects | Registry, families, seven-step application, removal/transfer | [14](docs/14-effect-taxonomy.md)–[16](docs/16-effect-flow.md) |
| Auras and invalidation | Spatially-bucketed index, closed invalidation table | [12](docs/12-invalidation-and-auras.md) |
| Board systems | Terrain, platforms and levels, bounded fields, environment | [26](docs/26-terrain.md)–[29](docs/29-environment.md) |
| Concealment and identity | Presence Concealment, public identity, Detect, Discover | [30](docs/30-concealment-and-identity.md) |
| War setup | Factions, alliances, summoning, setup rolls, contracts | [31](docs/31-war-setup-and-summoning.md) |
| Relationships | Overpower, Sustainability, multi-Servant tax, linked groups | [32](docs/32-relationships.md) |
| Command Spells | Catalogue, per-relationship namespacing, spending | [33](docs/33-command-spells.md) |
| GM proxy socket | Typed operations, request/response, timeouts, authorization | [38](docs/38-authority.md) |
| Content pipeline | YAML source, validator, pack build, export, content sync | [39](docs/39-authoring-vocabulary.md), [40](docs/40-content-pipeline.md) |
| History and rewind | Per-unit ring buffer, desync detector | [42](docs/42-history-and-rewind.md) |
| Content authored | 26 Servants + 7 Normal-ruleset, 236 abilities, 157 effects, 21 class skills, 17 Command Spells | [45](docs/45-case-studies.md) |

**Known open defects** are tracked as [GitHub issues](https://github.com/zarex97/FGT_FVTT_v2/issues).
Each chapter's *Open questions* section lists claims tagged `[unverified]` — true by reading, not
yet confirmed in a running world.

**5,021 tests passing** across 213 files. Golden tests pin worked examples end to end; the R=4
attack-range diagram is asserted character for character and all six Mad Enhancement sheets are
checked against the rank table. See [Ch. 44](docs/44-testing.md) — including the one failure mode
these tests cannot see, where a rules function is fully tested and fed by nothing.

```
npm install
npm test                  # 5,021 unit + golden tests, no Foundry required
npm run lint              # includes tools/check-layers.mjs, the layer-boundary rule
npm run validate:content  # every YAML parses, every ref resolves, every id exists
npm run build             # compile packs and styles
```

Open questions are no longer a single chapter: each chapter carries its own **Open questions**
section, and anything not yet confirmed against a running world is tagged `[unverified]` there.

## Installing

The system is not yet published to Foundry's package registry. Install it from a release's
manifest URL:

```
https://github.com/zarex97/FGT_FVTT_v2/releases/latest/download/system.json
```

In Foundry: **Configuration and Setup → Game Systems → Install System**, paste that URL into the
*Manifest URL* field, and click Install.

> **What works today.** Open a Servant sheet, target an enemy token, and click an ability. The
> attack resolves through the real Combat Process: the defender is prompted on the chat card to
> do nothing, Block or Evade; the Luck Check ladder runs across both clients; damage runs the
> 16-stage pipeline and the card shows the full stage-by-stage breakdown.
>
> The turn HUD shows the four budget pools, which units have moved and attacked, how much
> movement each has left, and — the reason it exists — any unmet compulsion, with End Turn
> disabled until it is resolved. Abilities apply their effect riders automatically through the
> seven-step effect pipeline, and rule elements on class skills reach the damage pipeline, the
> checks and the actor's derived data.
>
> Clicking an ability opens the canvas targeting preview rather than reading Foundry's target
> set: an area ability shows all four legal directions at once, a ranged one dims the panels
> outside its Range, and a floating panel lists every unit that would be hit with the damage
> range each would take — computed by running the real pipeline at its minimum and maximum
> rolls, so the preview cannot disagree with the result.
>
> Dragging a token is validated against the seven movement clauses before it commits — orthogonal
> only, never through an enemy, never into a guarded Master's ring, never past MOV — and the
> move budget is spent when it lands. Riding's two segments share one MOV allowance and the
> second only opens once the unit has attacked.
>
> The persistent overlays (ZON rings, threat ranges, Master protection) are drawn by the overlay
> layer, and Undo eligibility is decided by the effect-flow rules. Everything is also reachable
> from the console via `fgt.api`, and a live world can be driven from the command line — see
> [Ch. 43](docs/43-tooling.md).

## Releasing

Releases are cut by CI, from **the commit the tag points at** — the workflow re-reads the
repository at that commit, so anything it needs must be committed *before* tagging.

```
npm run check:release -- 0.2.1     # optional preflight
npm run release:stamp -- 0.2.1 zarex97/FGT_FVTT_v2
git commit -am "Release 0.2.1" && git push
git tag v0.2.1 && git push origin v0.2.1
```

The release notes are best-effort and **never block the build**: `tools/release-notes.mjs` uses
this version's changelog section if there is one, otherwise the `## [Unreleased]` section,
otherwise the commit subjects since the previous tag. A missing heading costs tidier notes and
nothing else. Lint, content validation and the test suite *do* gate the release — the workflow
runs all three itself rather than trusting that CI passed on the same commit.

If a tag has already been pushed at a bad commit, move it rather than bumping the version:

```
git tag -d v0.2.1 && git push origin :refs/tags/v0.2.1   # delete, local and remote
git tag v0.2.1 && git push origin v0.2.1                 # re-tag the fixed commit
```

Delete any hollow release GitHub left behind first, or the re-run will update it in place.

[`.github/workflows/release.yml`](.github/workflows/release.yml) then lints, validates the
content, runs the tests, builds the packs and styles, stamps the version and the **versioned**
manifest/download URLs into `system.json`, assembles `fgt.zip`, and publishes a GitHub release
with both files attached.

The manifest and download URLs point at the specific release rather than at `latest`, so an
installed world updates to exactly the build it was told to.

A broken build cannot reach a release: the workflow runs the full check suite itself rather than
trusting that CI passed on the same commit.

## Authoring content

The source of truth is YAML under `packs/_source/`, compiled to LevelDB packs at build time. The
packs are build artefacts and are gitignored — LevelDB directories are binary, unmergeable and
undiffable, which is unacceptable for content that will be reviewed.

```
packs/_source/
├── effects/        buff, debuff and status definitions
├── class-skills/   parameterized templates, instantiated by `ref:`
├── abilities/      per-Servant abilities and Noble Phantasms
└── servants/       the Servant sheets themselves
```

`ref:` indirection is the point: Magic Resistance is authored once and instantiated at seven
different ranks, so fixing it fixes every Servant that has it.

Artwork is never named in the YAML. Drop `assets/servants/<id>.webp` for a portrait and
`assets/classes/<class>.webp` for the image a Servant wears until its identity is revealed; the
build attaches both (`assets/README.md`).

Run `npm run validate:content` after any edit. It catches unknown effect ids, unparseable ranks
and durations, unregistered rule-element keys, refs that do not resolve, and one-sided mutual
exclusions — the failure modes that otherwise sit in a compendium silently doing nothing.

---

## Sources

The design is derived from these primary documents:

- *F/GT Rulebook — Great Holy Grail War*
- *F/GT Advanced: Common Skills*
- *Status Effects / Keywords / Attributes / Other*
- *Important — ◈ notation* (rounds and turns)
- *General Notes*
- *Terrain Effects* — the 21 terrain types and their overlap rules (added in `0.2.0`)
- *Open questions, annotated* — the author's answers, now recorded per chapter
- **29 reference character sheets:**
  - The original twelve: Van Gogh, Mannanán mac Lir, Kingprotea, the Dioscuri, Semiramis,
    Scáthach, Karna, Kiritsugu, Francis Drake, Penthesilea, Nemo, Heracles.
  - Added in `0.2.0`: Nursery Rhyme, Hassan of Serenity, Jack the Ripper, Yan Qing,
    Katō Danzō, Hundred-Faced Hassan, Medea, Achilles, Ozymandias, Medusa, Pale Rider,
    Anastasia & Viy, Quetzalcoatl, EMIYA, Proto Gil, Asterios, Raikou.

Where the source documents are ambiguous or self-contradictory, the resolution is recorded
explicitly in the relevant chapter's *Open questions* section rather than silently decided. Where a resolution later turned out to be **wrong**, the correction is recorded in
[`CHANGELOG.md`](CHANGELOG.md) alongside the superseded reading — see the Range formula in
`0.2.0`, which fit every piece of evidence available and was still incorrect.
