# Migration: schema versioning and content sync

**Date:** 2026-09-09
**Chapter:** Ch. 39, which designs all of this and none of which is built.

## 1. What is wrong

Ch. 39 specifies three version axes, a migration runner, a mandatory backup, and a content-staleness
policy. Measured against the code:

| Ch. 39 says | Reality |
|---|---|
| `world.flags.fgt.schemaVersion` | a **setting**, default `""`, read by nothing |
| A migration runner over source data | absent |
| A mandatory pre-migration backup | absent |
| `Combat.system.ruleVersion` | field absent from `MatchData` |
| `contentVersion` + changelog in YAML | absent from the pipeline |

Worse than absent: `schemaVersion` sits in `settings-are-read.test.mjs`'s `NOT_READ_BY_CODE` set with
the comment *"Written by the release stamper and read by the migration guard on load, which reaches
it through a variable rather than a literal."* **There is no migration guard.** The exception
documents a reader that has never existed, which is the one thing that file exists to prevent.

The practical consequence surfaced today. Fourteen Masters, created by the setup wizard in the
morning, held a Magic Crest without the Round gate the pack gained in the evening. Nothing detected
it and nothing could fix it; the repair was a hand-written script run once against a live world.

## 2. Scope

This spec builds two of Ch. 39's three subsystems:

- **A — schema migration** (§39.2): the version axis, the runner, the backup, per-model shims.
- **B — content sync** (§39.6, amended): world copies reconciled against the compendium.
- **C — the way home** for authoring, which B makes necessary.

**Rule-version pinning (§39.3) is deferred to its own spec.** It is the largest of the three, it
only earns its cost once matches span releases, and every rule change thereafter needs a version
entry and a compatibility branch — a tax §39.3 itself calls out. Deferring it has a consequence,
recorded in §7 below.

## 3. Rulings

| # | Question | Ruling |
|---|---|---|
| R1 | Ch. 39 D39.6 says a world copy is **never** auto-updated — the GM's edits win. | **Replaced.** The compendium is the whole source of truth; world copies are reconciled to it on load. D39.6 was written to protect homebrew, and R3 protects it better by giving it somewhere real to live. The chapter is amended, not contradicted. |
| R2 | What separates a field the sync may overwrite from one it must preserve? | **The authored-field list, minus the fields the pack only *seeds*.** `actorSystem()`/`itemSystem()` decide what enters a pack, so anything they do not name is runtime by definition and is preserved for free. But the list is not a clean discriminator on its own: `timesUsed`, `lastUsedTick` and `recordedAttacks` are in it and authored by **no** content, while `active`, `quantity`, `stance` and `resources` are authored as *starting* values that play then owns, and `cooldown` mixes the two — `max` is the pack's, `remaining` is the world's. So the sync overwrites the authored list **except** an explicit `SEEDED_THEN_OWNED` set, enumerated in §4.1 and held by a test. |
| R3 | If world copies are overwritten, where does a GM's ability-editor work live? | **It round-trips.** `AbilityEditor` gains an export that writes the document back to `packs/_source/**.yml`. Authoring becomes a pack change, so nothing of value lives only in a world copy — which is what makes R1 safe rather than lossy. |
| R4 | May the sync delete an item the pack no longer has? | **Only if the item has no runtime provenance.** An item carrying `copiedFrom` or `grantedBy` was granted during play — Wisdom of Dún Scáith's copied Noble Phantasms are the reference case — and must never be swept by a content update. Everything else with a `contentId` absent from the template is removed. |
| R5 | Where does the backup go? | **A real file**, `worlds/<id>/fgt-backups/<ISO timestamp>.json`, via `FilePicker.upload`. D39.3 calls the backup non-negotiable and a browser download is not a backup — it is a prompt the GM can dismiss. |

## 4. Architecture

### 4.1 The shared idea: authored versus runtime

Both halves turn on one distinction, and it is already made in the codebase — the content pipeline's
allowlists. `actorSystem()` and `itemSystem()` name exactly the fields a YAML document may state; a
field they do not name is silently dropped on the way into a pack, which is the mechanism that has
already cost this project `npGateRound`, `onEnd`, `countsTowardBudget` and others.

That property is exactly what the sync needs: **a field in the list is the pack's to define; a field
outside it belongs to the world.** Health, cooldown remaining, `turnState`, contracts, positions,
`timesUsed`, `expended`, `gatedDelay`, `fieldSummonStats`, `summonerId` — none are authored, so none
are touched.

`module/content/authored-fields.mjs` (Layer 1, pure data) exports `AUTHORED_ACTOR_KEYS` and
`AUTHORED_ITEM_KEYS`. `tools/lib/content.mjs` imports them — it already imports from `module/`
(lines 15–19), so the direction is established. A drift test holds the key sets and the builder
functions against each other in **both** directions, the same guard `RULE_ELEMENT_KEYS` and
`EXECUTORS` already have.

**Not every authored key is the pack's to overwrite.** Some carry a *starting* value that play then
owns, and one mixes both:

```js
export const SEEDED_THEN_OWNED = Object.freeze({
  // Authored as an opening value; mutated for the rest of the match.
  actor: ["agility", "luck", "resources", "stance"],
  // `timesUsed`, `lastUsedTick` and `recordedAttacks` are in the allowlist and
  // authored by NO content -- they are runtime that the list happens to name.
  // `active` is a toggle, `quantity` is spent, and provenance is the world's.
  item: ["active", "timesUsed", "lastUsedTick", "recordedAttacks", "quantity",
         "copiedFrom", "grantedBy"],
});

// `cooldown` is the one key that is half the pack's and half the world's.
export const COOLDOWN_OWNED_BY_WORLD = Object.freeze(["remaining", "regen", "gatedDelay"]);
```

Overwriting any of these would reset a Servant's Resources, un-toggle a mode, or refill a spent
cooldown **mid-match** — the exact corruption Ch. 39 opens by promising to prevent.

### 4.2 A — schema migration

`schemaVersion` moves from a setting to `world.flags.fgt.schemaVersion`, where §39.1 says it lives.
The setting is removed and its false entry in `NOT_READ_BY_CODE` goes with it.

`module/migration/migrations.mjs` — pure, no `game`, unit-testable without a world (D39.2):

```js
export const SCHEMA_VERSION = 1;   // the code's version; bump beside each entry

export const MIGRATIONS = [
  // { to: 2, description: "...", actor(source, ctx) {...}, item(source, ctx) {...} }
];
```

Each entry declares handlers per document type; absent handlers mean "this type is unaffected". The
runner applies them in order from the world's version to the code's.

`module/migration/runner.mjs` — Layer 4, GM only, on `ready`:

1. Read the world's version. Equal to the code's → return, silently and immediately. This is the
   common path and must cost nothing.
2. **Back up first** (R5). A failed backup aborts the migration; there is no "continue anyway".
3. Apply migrations in order over world actors, their embedded items and effects, scenes (tokens,
   regions), and the combat document — §39.2's list.
4. Write the new version. Log every document touched, and surface a summary the GM can read.

A world with no version recorded is treated as being at the code's version, not at zero: this ships
into worlds that predate it, and replaying every future migration against data that never needed
them would be a fabricated history.

`static migrateData(source)` shims go on the TypeDataModels for shape fixes that need no database
write — Foundry's own idiom (`app/common/abstract/data.mjs:908`), wrapped by `migrateDataSafe` so a
throw warns rather than corrupts. The rule for choosing: a shim that can read the new shape from the
old **without losing information** belongs in `migrateData`; anything that must decide, combine, or
consult another document belongs in a migration entry.

### 4.3 B — content sync

`contentVersion` enters the YAML pipeline beside `schema:`, is carried by `itemSystem`/`actorSystem`,
and lands on the document. The pack is authoritative; the world copy records what it last synced.

For each world document carrying a `contentId`:

1. Find its pack document. Absent → leave it alone entirely and report it; a world document whose
   content has been deleted is a GM's problem, not a thing to silently mutate.
2. Overwrite every **authored** field from the pack except those in `SEEDED_THEN_OWNED` (R2), and
   merge `cooldown` field by field so `max` follows the pack while `remaining`, `regen` and
   `gatedDelay` stay with the world. Leave everything else untouched.
3. Reconcile embedded items by `contentId`: refresh those that match, add those the template gained,
   remove those it lost **unless** the item carries `copiedFrom` or `grantedBy` (R4).
4. Preserve each surviving item's runtime state across the refresh — cooldown remaining, regen,
   `gatedDelay`, `timesUsed`, `expended`, `active`.

Runs after the schema migration, GM only, and produces a report: what changed, on which documents,
and what was skipped and why.

### 4.4 C — the way home

`AbilityEditor` gains **Export to YAML**: serialise the edited document back to its
`packs/_source/**.yml` shape and write it via `FilePicker.upload`, falling back to a download when
the upload is refused.

The exporter is the inverse of the loader and must produce a file the loader accepts — the test is a
round trip: load a pack source, export it, and the two parse to the same document.

## 5. What this does not do

- **Rule-version pinning** (§39.3), deferred to its own spec.
- **A diff UI.** R1 removes the need for the GM to choose per document, so §39.6's badge-and-diff
  view is not built. The migration report says what changed, which is the part that matters once the
  choice is gone.
- **Migrating unlocked world compendia.** §39.2 lists them; they are rare, and the runner will report
  them as skipped rather than pretend to have covered them.

## 6. Testing

**Pure** (`test/unit/migrations.test.mjs`): each migration entry against fixture source data, in
order and idempotently — applying a migration twice must equal applying it once, because a runner
that fails halfway will be re-run.

**Sync** (`test/unit/content-sync.test.mjs`): the authored/runtime split against fixtures — an
authored field changes; a runtime field survives; every `SEEDED_THEN_OWNED` key survives even though
it is in the allowlist; `cooldown.max` follows the pack while `cooldown.remaining` does not; an item
with `copiedFrom` survives a template that dropped it; a document with no `contentId` is untouched.

**Drift** (`test/unit/authored-fields.test.mjs`): the key sets and the pack builders hold each other
in both directions.

**Round trip** (`test/unit/yaml-export.test.mjs`): every file in `packs/_source/` survives
load → export → load unchanged.

**Live**, in `fgt2026`, because green tests are not evidence:

1. A schema migration runs once, writes its version, and does not run again on the next load.
2. The backup file exists in `worlds/fgt2026/fgt-backups/` and parses as JSON.
3. A Servant whose pack ability changed is refreshed, while its Health, cooldowns and contract
   survive.
4. An ability granted by Wisdom of Dún Scáith survives a sync.
5. A document edited in the ability editor, exported and rebuilt, comes back through the pack.
6. The fourteen Masters need no hand-written script the next time a pack moves.

## 7. The limitation this leaves

Ch. 39 opens with *"a tactical match can run for weeks of real time. A system update mid-match must
not corrupt it."* Content sync runs on load and **can change a Servant's abilities mid-match**. The
mechanism that protects an in-flight match is rule-version pinning, which this spec defers.

Until that exists the honest guidance — and it goes in the chapter, not in a comment — is: **rebuild
packs between sessions, not during one.** Naming the gap is the point; a reader who assumes matches
are protected because Ch. 39 opens by promising it would be wrong.

## 8. Chapters to correct

- **Ch. 39 §39.1/§39.2** — the axes and the runner exist; `schemaVersion` is a world flag.
- **Ch. 39 §39.6 and D39.6** — replaced by R1, with the reasoning.
- **Ch. 39 §39.9** — the upgrade checklist gains the sync step.
- **Ch. 29 §29.6** — the ability editor's export, and what it means for SC-6.
- **Ch. 37** — `contentVersion` in the pipeline.
- **Ch. 45** — the entry, naming what was measured live.
