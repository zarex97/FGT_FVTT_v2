# The plan archive — superseded

These are the original chapters 00–45, written as a **plan** before the implementation existed.
They are kept for history only.

> **Do not cite these as a source of truth about how the system works.** They describe intentions,
> many of which changed. The current chapter set in `docs/` is written from the codebase and cites
> it by `file:line`.

The replacement set was derived from the code in September 2026: 219 files under `module/`, 14
under `tools/`, 213 test files. It is renumbered, because the old numbering was drawn before the
subsystems existed and no longer matches them.

## Where each chapter's subject went

| Archived chapter | Now covered by |
|---|---|
| `00-index.md` | `docs/00-index.md` |
| `01-vision-and-goals.md` | `docs/01-what-this-is.md` |
| `02-glossary.md` | **`CONTEXT.md`** at the repo root — the glossary is no longer a chapter |
| `03-domain-overview.md` | `docs/02-architecture.md` |
| `04-units.md` | `docs/06-units-and-stats.md` |
| `05-ranks-and-parameters.md` | `docs/03-ranks-and-tables.md` |
| `06-stats-and-resources.md` | `docs/06-units-and-stats.md` |
| `07-time-model.md` | `docs/04-time-model.md` |
| `08-board-and-geometry.md` | `docs/05-board-geometry.md` |
| `09-targeting.md` | `docs/20-targeting.md` |
| `10-effects-taxonomy.md` | `docs/14-effect-taxonomy.md` |
| `11-effect-engine.md` | `docs/15-effect-application.md` |
| `12-combat-process.md` | `docs/21-combat-process.md` |
| `13-damage-pipeline.md` | `docs/22-damage-pipeline.md` |
| `14-checks-and-randomness.md` | `docs/13-checks-and-randomness.md` |
| `15-abilities.md` | `docs/17-abilities.md`, and `docs/18-items.md` for the item half |
| `16-relationships.md` | `docs/32-relationships.md` |
| `17-command-spells.md` | `docs/33-command-spells.md` |
| `18-action-economy.md` | `docs/19-action-economy.md` |
| `19-environment.md` | `docs/29-environment.md` |
| `20-platforms-and-levels.md` | `docs/27-platforms-and-levels.md` |
| `21-system-skeleton.md` | `docs/02-architecture.md` |
| `22-data-models.md` | `docs/07-schemas.md` |
| `23-documents-and-derived-data.md` | `docs/08-documents-and-derived.md`, `docs/09-projection.md` |
| `24-rules-engine.md` | **split** → `docs/10-rule-elements.md` and `docs/11-predicates.md` |
| `25-turn-system.md` | `docs/25-turn-order-and-scheduler.md` |
| `26-authority-and-sockets.md` | `docs/38-authority.md` |
| `27-reaction-protocol.md` | `docs/23-reactions.md` |
| `28-targeting-implementation.md` | **merged** into `docs/20-targeting.md` |
| `29-user-interface.md` | **split** → `docs/34-action-bar.md`, `docs/35-sheets-and-editor.md`, `docs/36-canvas-layers.md` |
| `30-chat-and-audit.md` | `docs/37-chat-and-log.md` |
| `31-case-heracles.md` | `docs/45-case-studies.md`, `docs/D-servant-data-sheets.md` |
| `32-case-semiramis.md` | `docs/45-case-studies.md`, `docs/D-servant-data-sheets.md` |
| `33-case-mannanan.md` | `docs/45-case-studies.md`, `docs/D-servant-data-sheets.md` |
| `34-case-dioscuri.md` | `docs/45-case-studies.md`, `docs/D-servant-data-sheets.md` |
| `35-case-van-gogh.md` | `docs/45-case-studies.md`, `docs/D-servant-data-sheets.md` |
| `36-case-remaining.md` | `docs/45-case-studies.md`, `docs/D-servant-data-sheets.md` |
| `37-content-pipeline.md` | `docs/40-content-pipeline.md`, and `docs/39-authoring-vocabulary.md` |
| `38-testing-strategy.md` | `docs/44-testing.md` |
| `39-migration-and-versioning.md` | `docs/41-migration.md` |
| `40-roadmap.md` | **nothing.** It was the plan; `docs/46-roster-re-audit.md` supersedes it |
| `41-open-questions.md` | **nothing.** Each chapter carries its own *Open questions* section |
| `42-terrain.md` | `docs/26-terrain.md` |
| `43-bounded-fields.md` | `docs/28-bounded-fields.md` |
| `44-case-expanded-roster.md` | `docs/45-case-studies.md`, `docs/D-servant-data-sheets.md` |
| `45-implementation-status.md` | **nothing.** `docs/46-roster-re-audit.md` is the live status document |

## Subjects with no predecessor here

These chapters describe subsystems built after this archive was written, so nothing in it
corresponds to them:

`09-projection` · `12-invalidation-and-auras` · `16-effect-flow` · `18-items` ·
`24-modes-and-control` · `30-concealment-and-identity` · `31-war-setup-and-summoning` ·
`39-authoring-vocabulary` · `42-history-and-rewind` · `43-tooling`

## Section anchors

Section numbers (`§12.4`, `§44.6`) do **not** survive the rewrite. Where source comments still
cite them, they refer to documents in this folder. Resolve them by subject, using the table above.
