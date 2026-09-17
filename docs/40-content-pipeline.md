# 40 — Content pipeline: packs, YAML export and content sync

## What it is

The content pipeline is a round trip: YAML source in `packs/_source/` becomes compiled LevelDB compendium packs, which are imported into a world, edited in-place during play, and exported back to YAML for version control. The crucial distinction is *authored fields*—which fields belong to the pack and which to the world—because content sync must not clobber play state when a rebuild happens.

The packs themselves are build artefacts and are gitignored. LevelDB directories are binary, unmergeable and undiffable, which is unacceptable for content that will be reviewed and collaboratively edited. YAML under `packs/_source/` is the source of truth (`tools/build-packs.mjs:1-12`).

## Where it lives

| File | Role |
|---|---|
| `packs/_source/` | Authored YAML tree: `abilities/`, `servants/`, `class-skills/`, `effects/`, `command-spells/`, `master-essences/`, `platforms/`, `summons/`, `structures/` |
| `tools/build-packs.mjs` | Main entry: YAML source → validation → compiled packs. Runs `compilePack` from `@foundryvtt/foundryvtt-cli` |
| `tools/validate-content.mjs` | Standalone validator; runs in CI and before every pack build |
| `tools/lib/content.mjs` | Compiler internals: loading, validation, `ref:` resolution, id assignment, cross-references |
| `tools/lib/load.mjs` | Filesystem walk: loads YAML files and asset paths |
| `tools/stage-to-yaml.mjs` | Inverse of the loader: JSON export → YAML source |
| `module/apps/yaml-export.mjs` | Writing a document back to pack source; exports at authored-fields boundaries |
| `module/migration/content-sync.mjs` | Reconciling world documents against pack documents; applies the authored-fields split |
| `module/content/authored-fields.mjs` | Which fields are pack-owned and which are world-owned; consulted by both the compiler and the sync |
| `packs/` | Compiled LevelDB directories, one per pack type; gitignored |

## How it works

### The round trip

A Servant authored in `packs/_source/servants/semiramis.yml` flows through five stages.

**1. Validation.** `validateAll` runs first, before any compilation (`tools/build-packs.mjs:28-35`). It checks schema versions, id uniqueness, rule-element keys, timing windows, predicates, terrain types, marker resolution, and a hundred other invariants. A single error aborts the whole build (`tools/build-packs.mjs:34-35`).

**2. Compilation.** `compileDocument` transforms the YAML shape into a Foundry document. It instantiates `ref:` templates, resolves cross-references by content id to UUIDs, applies asset paths, derives stable Foundry ids from content ids, and patches system data into the compiled shape (`tools/lib/content.mjs:1674`). The compiler is pure—no filesystem, no Foundry—so it is unit-testable (`tools/lib/content.mjs:5-6`).

**3. Pack build.** Compiled documents are grouped by pack, written as JSON to a staging directory, then converted to LevelDB with the Foundry CLI (`tools/build-packs.mjs:63-77`). A successful build produces binary `.ldb` and `.json` files.

**4. World import.** A GM imports from a pack via the Foundry UI. The compendium entry is copied into the world as a new document with a fresh Foundry id and a `contentId` field linking it back to the pack.

**5. In-world editing.** Play changes the document: a cooldown ticks, a mode is toggled, a quantity is consumed, a status is applied, a field is opened. These changes are world-owned and must survive a content sync.

**6. Export.** A GM opens the ability editor, makes changes, and clicks Save. `toAuthoredSource` reads the document's system data and exports only authored fields—skipping cooldown clocks, `timesUsed` counters, and any runtime state—as JSON (`module/apps/yaml-export.mjs:56-82`). The file is staged in `packs/_staged/`.

**7. Staging to YAML.** `tools/stage-to-yaml.mjs` converts the staged JSON export to YAML and writes it back to `packs/_source/`, replacing the original. A commit records the change (`tools/stage-to-yaml.mjs:23-64`).

**8. Content sync.** On a world reload, the sync runner walks every world item and actor, calls `reconcileSystem` to merge pack data over world data (taking pack values only where the pack owns the key), and writes the result. `reconcileItems` handles embedded abilities, creating new ones from the pack, updating existing ones by content id, and removing ones no longer in the pack—unless they were granted during play (`module/migration/content-sync.mjs:40-182`).

### The authored-fields boundary

`AUTHORED_ACTOR_KEYS` and `AUTHORED_ITEM_KEYS` declare the vocabulary both the compiler and the sync use (`module/content/authored-fields.mjs:16-77`). The compiler's `actorSystem()` and `itemSystem()` functions read this list and silently drop anything that is not on it (`tools/lib/content.mjs:1705`, etc.). The sync's `ownedByWorld()` function asks the same list and preserves everything else (`module/content/authored-fields.mjs:177-182`).

Three fields are half the pack's and half the world's (`module/content/authored-fields.mjs:46-54`):

- **`cooldown`**: The pack owns `max`, `perUnit`, `countFrom`, `branches`. The world owns `remaining`, `regen`, `gatedDelay` — the clock's state.
- **`summonVariant`**: The pack owns the coin flip's two branches (`heads`, `tails`). The world owns which one actually came up (`variant`).
- **`linkedGroup`**: The pack owns settings and partner names by content id (`partners`, `leash`, `linkedDeath`, etc.). The world owns `memberIds` — the resolved actor ids.

Overwriting these halves is how the old system corrupted matches. A content sync that overwrote `linkedGroup.memberIds` would silently unlink a pair already on the board (`module/migration/content-sync.mjs:52-64`).

## Invariants & edge cases

1. **YAML is the source of truth, packs are build artefacts.** Never edit a pack file directly; always edit the YAML and rebuild (`tools/build-packs.mjs:9-10`).

2. **Validation is mandatory and precedes compilation.** A broken pack can never reach a release because `validateAll` runs first and a single error aborts the build (`tools/build-packs.mjs:28-35`).

3. **Content ids are stable; Foundry ids are derived.** A deterministic hash ensures rebuilding does not churn ids and worlds that already imported a Servant keep their links (`tools/lib/content.mjs:293-303`).

4. **Authoring flows through schema version 1.** Every YAML file must declare `schema: 1` (`tools/lib/content.mjs:36`).

5. **`ref:` templates are instantiated at compile time.** A template's `parameterized` list names required parameters; missing one fails the build (`tools/lib/content.mjs:419-423`).

6. **Half-world fields survive only if they are listed.** The split between pack and world is checked structurally in both directions by a test; a missing entry means content silently overwrites play state (`test/unit/authored-fields.test.mjs`).

7. **Embedded abilities are matched by content id, not Foundry id.** A Servant's own ability retains its world id through a sync so that anything holding a reference keeps working (`module/migration/content-sync.mjs:168-169`).

## Traps and anti-patterns

**Authoring a split-ownership field without both halves.** The old system added `linkedGroup` to the authored list without splitting the ownership. The sync then overwrote `memberIds` with the pack's empty set, silently unlinking every pair on the board (`module/content/authored-fields.mjs:135-150`). **When a field is half the pack's and half the world's, list both halves in the ownership split and check in both directions in tests** (`test/unit/content-sync.test.mjs:73-85`). Fixed by `module/migration/content-sync.mjs:52-64`.

**Losing variant overrides on load.** A summon's coin-flip produces a branch whose `overrides` land on top-level system keys that the pack owns. A sync that did not re-apply them would load the variant flag but not its consequence: a `dsc` Semiramis answering `self:variant:dsc` while carrying the wrong Range and a `fixed` normal attack instead of `rangeBanded` (`module/migration/content-sync.mjs:74-111`). **Re-apply variant overrides from the pack after reconciling, not from the world's cached copy** (`module/migration/content-sync.mjs:102-112`). Fixed by the same commit.

**Compiling authored keys that the schema does not map.** A key present on the authored list but missing from `actorSystem()`/`itemSystem()` compiles to its schema default and does nothing. Four keys shipped this way — `npGateRound`, `onEnd`, `countsTowardBudget`, and `itemHandling` — found only by checking a live value and wondering why it was the default (`tools/lib/content.mjs:1017-1030`). **Every key on the authored list must appear in the schema output and be tested** (`test/unit/authored-fields.test.mjs`). Fixed by adding the missing keys to `itemSystem()`.

## Open questions

- **Confirmed live, and without risking a rebuild.** With the world running, all **eight** pack
  LevelDB directories carry a `LOCK` file, and opening any of them read-write returns
  **"Permission denied"** -- the Foundry process holds them exclusively. So the rule is not a
  convention but a filesystem fact: a pack build cannot write while the application is up, and only
  shutting the world down releases them. This was verified by probing the locks rather than by
  attempting a build, because a build that *did* get through is precisely the scenario that corrupts
  the database.

- **Still open.** The fallback path (`module/apps/yaml-export.mjs:122-128`) is reached only when the
  upload to `packs/_staged/` fails, which needs the failure induced -- a read-only directory or a
  denied permission. Reading it confirms the branch exists and hands the file to the browser instead;
  whether the browser download is reliable across clients is not something reading can settle.

- **Why does `ref:` instantiation happen at compile time instead of runtime?** Templates could be instantiated by the sheet's own code, making parametrized abilities a pure data feature. Build-time instantiation is cheaper but binds the instantiation shape permanently into the pack, and any future changes to how a template applies its parameters become a content update that rolls forward to every board.
