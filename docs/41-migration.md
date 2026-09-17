# 41 — Migration and Versioning

## What it is

A world's stored schema does not change with every release — only when the system's data shape actually shifts. When it does, **every** world document must be rewritten to match the new shape, in order, before the new code runs against it. That migration is the highest-risk operation the system performs, and it has one rule: **backing the world up first is not optional, and a backup failure aborts the entire migration**. The SCHEMA_VERSION is declared once in the code, bumped beside each migration entry, and stored per-world in a game setting so the runner can tell whether a world has already been migrated (`module/migration/migrations.mjs:22`, `module/migration/runner.mjs:27`).

Versioning here covers rules as well as schemas. CHANGELOG.md distinguishes the three: **MAJOR** changes invalidate authored work; **MINOR** adds new subsystems or content; **PATCH** is correction and typo. A RULE correction (not just a schema change) can make existing content nonsensical — the first time content is created after a rule change, it will produce different results, and a pack document's validity is tied to the rule version it was authored under.

## Where it lives

| File | Role |
|---|---|
| `module/migration/migrations.mjs` | The ordered migration entries, each declaring handlers per document type; `SCHEMA_VERSION` and `MIGRATIONS` are the single source of truth |
| `module/migration/runner.mjs` | Applying migrations and content sync to a live world; finding the version, running pending migrations, and reconciling content |
| `module/migration/backup.mjs` | Collecting and writing pre-migration backups to the world directory |
| `module/migration/content-sync.mjs` | Pure logic for reconciling world documents against pack templates; detecting what the world owns versus what the pack owns |
| `tools/release.mjs` | Stamping version and release URLs into system.json before tagging |
| `tools/check-release.mjs` | Pre-tag checklist: semver format, manifest match, changelog section |
| `tools/check-manifest.mjs` | Verifying declared paths exist and socket is enabled |
| `system.json` | The manifest: version, packs, document types |
| `CHANGELOG.md` | Categorised release notes; MAJOR/MINOR/PATCH tags; the record migrations read |

## How it works

### Storing and detecting version

The schema version is persisted in a world-scoped game setting (`module/migration/runner.mjs:27`). A world with no recorded version is treated as current rather than as zero — old worlds predate this versioning — so the first load stamps the current SCHEMA_VERSION to avoid replaying every future migration against data that never needed them (`module/migration/runner.mjs:49-52`).

### Walking the world

`migrateWorld` starts by collecting every F/GT document as source data (not prepared data) into a timestamped JSON object (`module/migration/runner.mjs:59-73`). Source data is what migrations read — prepared data contains derived values that would restore as though authored (`module/migration/backup.mjs:25-36`). Before any migration, that backup is written to the world directory as a real file, not a browser download, because a GM can dismiss a download and a backup nobody kept is not a backup (`module/migration/backup.mjs:39-70`). A backup failure is fatal — the migration aborts and the world is left unchanged (`module/migration/runner.mjs:71-73`).

With the backup safe, migrations are applied in order: each entry runs its handlers for actors, items, scenes, and combats in turn (`module/migration/runner.mjs:78-93`). A migration that declares no handler for a kind returns the source unchanged — the same object — so the runner can skip writes when nothing changed (`module/migration/migrations.mjs:73-76`).

### Content sync: separating world from pack

After migrations fix the SHAPE, content sync reconciles CONTENT — every world document is checked against its pack template and brought into conformity (`module/migration/runner.mjs:273-289`). The compendium is the whole source of truth; a world copy is an instance of pack content plus everything the match has written to it, and sync is the machinery for telling them apart.

An actor carrying a `contentId` is pack content and gets reconciled (`module/migration/runner.mjs:119-162`). One without a `contentId` is the world's own and is left entirely alone. `reconcileSystem` starts from the world's system data and overlays the pack's, key by key, taking the pack's value only where the pack owns the key (`module/migration/content-sync.mjs:40-72`). THREE keys are split: `cooldown`'s clock is world-owned (what the match has spent), `summonVariant`'s `variant` is world-owned (how the coin came up), and `linkedGroup`'s `memberIds` are world-owned (the actor ids resolved at summon) (`module/migration/content-sync.mjs:46-64`).

Items are matched by `contentId`, which is the stable name a pack document carries and a Foundry id is not. An item on the world copy that the template does not list is removed only if its `contentId` is in NO pack at all. If the ability still exists as content, its presence here is something play did and deleting it destroys a match. Items carrying `copiedFrom` or `grantedBy` are granted during play, not authored, and are protected even if they are not on the template (`module/migration/content-sync.mjs:135-182`).

## Invariants & edge cases

1. **A backup failure is fatal.** Writing the backup is non-negotiable, and if it fails, the migration aborts with the world unchanged (`module/migration/runner.mjs:71-73`).

2. **Migrations must be idempotent.** A runner that fails partway through is re-run against data some of which is already migrated (`module/migration/migrations.mjs:6-13`). A handler that doubles a value on the second pass is worse than one that never ran.

3. **SCHEMA_VERSION and the highest migration target are the same fact.** The version is a single integer; the migration list runs past it or stops short depending on that integer's value. They must stay synchronized or migrations loop or data stays half-migrated (`test/unit/migrations.test.mjs:22-27`).

4. **A world ahead of the code gets nothing.** A world opened by a newer system and then by an older one will not run migrations backwards (`module/migration/runner.mjs:49-52`).

5. **Only the active GM migrates.** Foundry gives no lock to prevent concurrent migrations, so the guard is that exactly one client is allowed to try (`module/migration/runner.mjs:274-275`).

6. **Content sync runs on every load.** The compendium is the source of truth, and the world's copy drifts as play writes to it. Re-syncing on every load brings it back into conformity without explicit author action (`module/migration/runner.mjs:273-289`).

## Traps and anti-patterns

**Comparing objects by `JSON.stringify` when key order differs.** Content sync's first dry run reported 66 Servants as changed because the pack writes `normalAttack` as `{mode, component, element, bands}` and the world holds `{mode, component, bands, element}` — identical data, yet `JSON.stringify` says they differ. The `same()` function now compares by iterating over keys instead of stringifying, so key order does not matter (`module/migration/runner.mjs:230-242`).

**Comparing HTML-escaped text as raw strings.** Foundry escapes HTML entities on save: the pack holds `Kanshou & Bakuya` and the document stores `Kanshou &amp; Bakuya`. Writing the pack's value and it comes back escaped again, so a literal comparison never converges — the second live run would have reported 17 actors as changed and rewritten them on every world load for ever. The `decoded()` function now decodes both sides before comparing, so entity escaping does not trigger false changes (`module/migration/runner.mjs:203-214`, `module/migration/runner.mjs:231`).

**Forgetting that `contentId` is stable but Foundry ids are not.** When reconciling items, the world's item retains its Foundry id and the pack's id is ignored, so anything holding a reference to that item keeps working. A template sync that drops the world's id and takes the pack's id would delete and recreate the item, breaking any reference (`module/migration/content-sync.mjs:165-169`).

**Assuming a granted item is always on the template.** Semiramis crafts `semiramis-poison` with Item Construction — it is on no actor template and carries neither `copiedFrom` nor `grantedBy`. A naive sync that checked only provenance would sweep every Poison she had crafted. The fix is to check whether the `contentId` is in ANY pack before removing it (`module/migration/content-sync.mjs:121-127`, `module/migration/runner.mjs:177-188`).

**"Any pack" implemented as "any `fgt` pack."** `loadKnownItemIds` is `reconcileItems`'s last line of
defence: an item whose `contentId` is on no actor template and not in this set is **removed**. Its
own parameter doc calls the set *"every contentId any pack defines"*, but the loop filtered on
`pack.metadata.packageName !== "fgt"` — so a contentId defined only by a third-party module's Item
pack satisfied neither the template check nor this one, and would have been silently deleted on every
sync. No such module ships in this repo today, which is the only reason it went unnoticed; filed
speculatively and fixed as [#25](https://github.com/zarex97/FGT_FVTT_v2/issues/25) by dropping the
`packageName` filter, matching the doc's actual stated contract
(`module/migration/runner.mjs:177-188`). **A parameter's doc comment is the contract; when the
implementation is narrower, the doc was right and the code was the bug.**

## Open questions

- **Still a policy question, though the first migration has now shipped.** `SCHEMA_VERSION` is `2`
  (`module/migration/migrations.mjs:22`), with one entry: a data-repair backfill for Masters stranded
  at `baseAttack: {str: 0, mag: 0}` by the schema defect #20 fixed. That is neither a schema change
  nor a rule correction — it is a third kind, repairing data a past defect corrupted — so it does not
  settle the original question. A genuine rule correction still leaves old documents readable and
  *wrong*, as `CHANGELOG.md` records for the Range geometry and the Block rule, and a schema migration
  still cannot fix that without re-authoring content. Worth an ADR before the first rule-only release,
  because the answer decides whether such a release may leave `SCHEMA_VERSION` untouched.

- **How do worlds created before versioning existed know their version?** A world with no recorded version is assigned SCHEMA_VERSION on first load, assuming it is current. This works when a world is created before the versioning machinery ships, but the logic is fragile: if a world is very old and created before a migration that should have run, the assumption is wrong.

- **Resolved: see Traps and anti-patterns, [#25](https://github.com/zarex97/FGT_FVTT_v2/issues/25).**
