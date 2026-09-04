# 21 — System Skeleton

> **Implementation notes (Ch. 45).** Two registries load at `setup`: `EffectRegistry` and
> `CommandSpellRegistry`. `CONFIG.RegionBehavior.dataModels` registers the four Region behaviour
> types, which `system.json` had declared from the beginning with no model behind any of them.
>
> Three gates were added to the tooling and are worth knowing about:
>
> | Tool | What it catches |
> |---|---|
> | `tools/check-layers.mjs` | Layer-boundary violations. Runs inside `npm run lint`. |
> | `tools/smoke-world.mjs` | A world that does not come up. Local only — CI has no Foundry. |
> | `test/unit/release-notes.test.mjs` | A changelog that could block a release. |
>
> `CONFIG.debug.hooks` is on: this system is driven almost entirely by hooks, so "did the hook
> fire at all" is the first question in every rule bug.

The manifest, the module layout, the bootstrap sequence, and the tooling. Everything here
targets **Foundry VTT v14** and uses v14-native APIs throughout.

---

## 21.1 `system.json`

```json
{
  "id": "fgt",
  "title": "Fate/Grail Tactics",
  "description": "A grid-based tactical wargame of Masters, Servants and Noble Phantasms, with full rules automation.",
  "version": "0.1.0",
  "compatibility": { "minimum": "14", "verified": "14.364" },

  "authors": [{ "name": "zarex" }],

  "esmodules": ["module/fgt.mjs"],
  "styles": ["styles/fgt.css"],
  "socket": true,

  "languages": [
    { "lang": "en", "name": "English", "path": "lang/en.json" },
    { "lang": "es", "name": "Español", "path": "lang/es.json" }
  ],

  "grid": { "type": 1, "distance": 1, "units": "panels", "diagonals": 6 },

  "primaryTokenAttribute": "health",
  "secondaryTokenAttribute": "agility",

  "documentTypes": {
    "Actor": {
      "servant":   { "htmlFields": ["biography", "notes"] },
      "master":    { "htmlFields": ["biography", "notes"] },
      "civilian":  {},
      "summon":    {},
      "platform":  { "htmlFields": ["description"] },
      "structure": {}
    },
    "Item": {
      "ability":       { "htmlFields": ["description"] },
      "noblePhantasm": { "htmlFields": ["description"] },
      "commandSpell":  { "htmlFields": ["description"] },
      "masterEssence": { "htmlFields": ["description"] },
      "equipment":     { "htmlFields": ["description"] }
    },
    "ActiveEffect": {
      "fgtEffect": {}
    },
    "Combat":    { "match": {} },
    "Combatant": { "player": {} },
    "RegionBehavior": {
      "homeBase":  {},
      "npField":   {},
      "terrain":   {},
      "platform":  {}
    }
  },

  "packs": [
    { "name": "effects",        "label": "F/GT Effects",        "type": "Item",  "system": "fgt" },
    { "name": "class-skills",   "label": "F/GT Class Skills",   "type": "Item",  "system": "fgt" },
    { "name": "master-essences","label": "F/GT Master Essences","type": "Item",  "system": "fgt" },
    { "name": "command-spells", "label": "F/GT Command Spells", "type": "Item",  "system": "fgt" },
    { "name": "servants",       "label": "F/GT Servants",       "type": "Actor", "system": "fgt" },
    { "name": "masters",        "label": "F/GT Masters",        "type": "Actor", "system": "fgt" },
    { "name": "rules",          "label": "F/GT Rules Reference","type": "JournalEntry", "system": "fgt" }
  ],

  "relationships": { "requires": [], "recommends": [] },

  "url": "https://github.com/zarex97/FGT_FVTT_v2",
  "manifest": "https://github.com/zarex97/FGT_FVTT_v2/releases/latest/download/system.json",
  "download": "https://github.com/zarex97/FGT_FVTT_v2/releases/latest/download/fgt.zip",
  "license": "LICENSE",
  "readme": "README.md",
  "bugs": "https://github.com/zarex97/FGT_FVTT_v2/issues"
}
```

### Notes on specific fields

**`"socket": true`** — mandatory. Without it the server refuses to register the
`system.fgt` socket namespace and every `emit` silently does nothing. The prototype's notes
record learning this the hard way, and it requires a **world restart** to take effect.

**`grid.diagonals: 6`** — `CONST.GRID_DIAGONALS.ILLEGAL`. Makes native pathing and the ruler
orthogonal-only, matching the movement rule (Ch. 08 §8.9). Note this governs *movement*, not
our rules-level distance functions.

**`grid.distance: 1`, `units: "panels"`** — the ruler reads "3 panels", matching the rulebook's
vocabulary.

**`primaryTokenAttribute: "health"`** — drives the default token bar. Secondary is `agility`,
since it is the second resource that depletes in combat and players need it visible.

**`documentTypes`** — v14 declares subtypes in the manifest, and `htmlFields` tells the core
which fields need the rich-text editor and search indexing.

**One `ActiveEffect` subtype** (`fgtEffect`) rather than one per effect. The effect's identity
lives in `system.defId`, referencing the registry (Ch. 11 §11.11). Declaring 120 subtypes would
bloat the manifest and gain nothing.

---

## 21.2 Repository layout

```
FGT_FVTT_v2/
├── system.json
├── module/
│   ├── fgt.mjs                     entry point; the init/setup/ready sequence
│   │
│   ├── config.mjs                  CONFIG.FGT: enums, labels, tables
│   ├── settings.mjs                game settings registration
│   │
│   ├── domain/                     ── L1: pure, no Foundry ──────────────
│   │   ├── rank.mjs                Rank value object, compare, step arithmetic
│   │   ├── tick.mjs                TickExpr parsing and resolution
│   │   ├── geometry.mjs            distances, shapes, reachability
│   │   ├── enums.mjs               every enum in the game
│   │   └── tables.mjs              rank-indexed tables (Appendix B as data)
│   │
│   ├── rules/                      ── L2: pure, consumes snapshots ──────
│   │   ├── snapshot.mjs            projection from documents to plain data
│   │   ├── damage/
│   │   │   ├── pipeline.mjs        the 16 stages
│   │   │   └── stages/             one module per stage
│   │   ├── targeting/
│   │   │   ├── resolve.mjs         the 11-step resolution algorithm
│   │   │   ├── anchors.mjs
│   │   │   ├── shapes.mjs
│   │   │   └── selection.mjs
│   │   ├── checks.mjs              agility/luck checks, chance rolls
│   │   ├── elements/               rule-element implementations
│   │   │   ├── base.mjs
│   │   │   ├── damage-modifier.mjs
│   │   │   ├── stat-delta.mjs
│   │   │   ├── on-event.mjs
│   │   │   ├── aura.mjs
│   │   │   └── … (~30 more)
│   │   ├── predicate.mjs           predicate evaluation
│   │   └── options.mjs             roll-option construction
│   │
│   ├── engine/                     ── L3: orchestration, owns writes ────
│   │   ├── combat-phase.mjs        the CombatPhase driver
│   │   ├── combat-process.mjs      the ladder state machine
│   │   ├── ability-resolver.mjs    phase execution
│   │   ├── effect-applier.mjs      the application pipeline
│   │   ├── scheduler.mjs           turn/round boundary sequences
│   │   ├── intents.mjs             intent application and batching
│   │   ├── journal.mjs             undo journal
│   │   ├── contracts.mjs           the ContractService
│   │   └── platforms.mjs           platform lifecycle
│   │
│   ├── data/                       TypeDataModel schemas
│   │   ├── actor/
│   │   │   ├── _shared.mjs         schema mixins
│   │   │   ├── servant.mjs
│   │   │   ├── master.mjs
│   │   │   ├── civilian.mjs
│   │   │   ├── summon.mjs
│   │   │   ├── platform.mjs
│   │   │   └── structure.mjs
│   │   ├── item/
│   │   │   ├── ability.mjs
│   │   │   ├── noble-phantasm.mjs
│   │   │   ├── command-spell.mjs
│   │   │   ├── master-essence.mjs
│   │   │   └── equipment.mjs
│   │   ├── effect.mjs
│   │   ├── combat.mjs
│   │   ├── combatant.mjs
│   │   └── fields.mjs              custom DataFields (RankField, TickField, …)
│   │
│   ├── documents/                  Document subclasses
│   │   ├── actor.mjs
│   │   ├── item.mjs
│   │   ├── effect.mjs
│   │   ├── combat.mjs
│   │   ├── combatant.mjs
│   │   └── token.mjs
│   │
│   ├── apps/                       ApplicationV2 UI
│   │   ├── sheets/
│   │   │   ├── servant-sheet.mjs
│   │   │   ├── master-sheet.mjs
│   │   │   ├── platform-sheet.mjs
│   │   │   └── ability-sheet.mjs
│   │   ├── hud/
│   │   │   ├── turn-hud.mjs        budget, compulsions, end-turn
│   │   │   └── unit-hud.mjs        token HUD extensions
│   │   ├── dialogs/
│   │   │   ├── targeting.mjs       the four preview modes
│   │   │   ├── reaction.mjs        the ladder prompts
│   │   │   ├── command-spell.mjs
│   │   │   └── summon.mjs          setup rolls
│   │   └── chat/
│   │       ├── cards.mjs
│   │       └── explainer.mjs       the damage breakdown
│   │
│   ├── canvas/
│   │   ├── targeting-layer.mjs     preview rendering
│   │   ├── zone-overlay.mjs        ZON, home base, threat range
│   │   └── facing-indicator.mjs
│   │
│   ├── net/
│   │   ├── socket.mjs              the GM proxy protocol
│   │   └── operations.mjs          typed operation definitions
│   │
│   ├── regions/                    RegionBehaviorType subclasses
│   │   ├── home-base.mjs
│   │   ├── np-field.mjs
│   │   ├── terrain.mjs
│   │   └── platform.mjs
│   │
│   └── util/
│       ├── log.mjs
│       ├── errors.mjs
│       └── memo.mjs
│
├── packs/                          source YAML → built LevelDB packs
│   └── _source/
│       ├── effects/*.yml
│       ├── class-skills/*.yml
│       ├── servants/*.yml
│       └── …
│
├── templates/                      Handlebars partials
├── styles/                         compiled from styles/src/*.scss
├── lang/
├── tools/
│   ├── build-packs.mjs             YAML → pack compiler with validation
│   ├── validate-content.mjs
│   └── release.mjs
└── test/
    ├── unit/                       L1 + L2, no Foundry
    ├── golden/                     damage fixtures
    └── integration/                requires a headless world
```

The `domain/` → `rules/` → `engine/` → `apps/` dependency direction mirrors the four layers from
Ch. 01 §1.7 and is enforced by an ESLint `import/no-restricted-paths` rule, so a violation is a
lint failure rather than a code review comment.

---

## 21.3 The bootstrap sequence

```js
// module/fgt.mjs
import { FGT }              from "./config.mjs";
import { registerSettings } from "./settings.mjs";
import * as data            from "./data/index.mjs";
import * as documents       from "./documents/index.mjs";
import * as apps            from "./apps/index.mjs";
import { EffectRegistry }   from "./rules/registry.mjs";
import { DiceRegistry }     from "./rules/dice-registry.mjs";
import { FGTSocket }        from "./net/socket.mjs";
import { Scheduler }        from "./engine/scheduler.mjs";

Hooks.once("init", () => {
  globalThis.fgt = { FGT, api: {} };
  CONFIG.FGT = FGT;

  // ── Data models ────────────────────────────────────────────────────────
  CONFIG.Actor.dataModels = {
    servant: data.ServantData, master: data.MasterData,
    civilian: data.CivilianData, summon: data.SummonData,
    platform: data.PlatformData, structure: data.StructureData,
  };
  CONFIG.Item.dataModels = {
    ability: data.AbilityData, noblePhantasm: data.NoblePhantasmData,
    commandSpell: data.CommandSpellData, masterEssence: data.MasterEssenceData,
    equipment: data.EquipmentData,
  };
  CONFIG.ActiveEffect.dataModels = { fgtEffect: data.EffectData };
  CONFIG.Combat.dataModels       = { match: data.MatchData };
  CONFIG.Combatant.dataModels    = { player: data.PlayerCombatantData };
  CONFIG.RegionBehavior.dataModels = {
    homeBase: regions.HomeBaseBehavior, npField: regions.NPFieldBehavior,
    terrain: regions.TerrainBehavior, platform: regions.PlatformBehavior,
  };

  // ── Document classes ───────────────────────────────────────────────────
  CONFIG.Actor.documentClass        = documents.FGTActor;
  CONFIG.Item.documentClass         = documents.FGTItem;
  CONFIG.ActiveEffect.documentClass = documents.FGTEffect;
  CONFIG.Combat.documentClass       = documents.FGTCombat;
  CONFIG.Combatant.documentClass    = documents.FGTCombatant;
  CONFIG.Token.documentClass        = documents.FGTToken;

  // ── Initiative: there is none ──────────────────────────────────────────
  // Turn order is a fixed roll at setup plus Delay. See Ch. 25.
  CONFIG.Combat.initiative = { formula: "0", decimals: 0 };

  // ── Sheets ─────────────────────────────────────────────────────────────
  apps.registerSheets();

  // ── Settings, socket, keybindings ──────────────────────────────────────
  registerSettings();
  FGTSocket.initialize();
  apps.registerKeybindings();

  // ── Compendium index fields, so pickers can filter without loading ─────
  CONFIG.Actor.compendiumIndexFields.push("system.servantClass", "system.region");
  CONFIG.Item.compendiumIndexFields.push("system.rank", "system.isNP");
});

Hooks.once("setup", async () => {
  await EffectRegistry.load();      // reads the effects compendium
  await DiceRegistry.load();        // reads settings + defaults
  if (game.settings.get("fgt", "devMode")) {
    const report = EffectRegistry.validate();
    if (report.errors.length) ui.notifications.error(
      `F/GT: ${report.errors.length} content errors — see console.`);
  }
});

Hooks.once("ready", () => {
  Scheduler.attach();               // GM client only; no-op elsewhere
  fgt.api = buildPublicAPI();       // documented surface for macros and modules
  DiceRegistry.warnAboutPlaceholders();
});
```

### Why `EffectRegistry.load()` is in `setup` and not `init`

Compendium packs are not readable during `init`. `setup` runs after packs are indexed and
before the canvas draws, which is exactly the window we need.

---

## 21.4 `CONFIG.FGT`

The system's public configuration object. Everything a GM or module might want to override
lives here, not in module-scope constants.

```js
export const FGT = {
  // Enums with localization keys
  servantClasses: { saber: "FGT.Class.Saber", archer: "FGT.Class.Archer", /* … */ },
  parameters:     { str: "FGT.Param.Str", end: "FGT.Param.End", /* … */ },
  ranks:          ["E", "D", "C", "B", "A", "EX"],

  // Rule-indexed tables (Appendix B)
  tables: {
    baseHealthByEnd:   { EX: 2000, A: 1500, B: 1250, C: 1000, D: 750, E: 500 },
    baseAgilityByAgi:  { EX: 20, A: 18, B: 16, C: 14, D: 12, E: 10 },
    baseLuckByLuc:     { EX: 20, A: 16, B: 12, C: 8, D: 4, E: 0 },
    npCostByRank:      { EX: [75,100], A: [50,60], B: [40,50], C: [30,40], D: [20,30], E: [10,20] },
    zonByClass:        { saber: 2, lancer: 2, rider: 2, berserker: 2,
                         archer: 2, assassin: 2, caster: 3 },
    zonClassBonus:     { assassin: 2, caster: 2 },
    knockbackByEnd:    { EX: "1d12", A: "1d20", B: "2d12", C: "3d12", D: "2d20", E: "3d20",
                         none: "5d10" },
    // … one entry per table in Appendix B
  },

  // Tick override table (Ch. 07 §7.2)
  tickOverrides: {
    3:  { "1/3": 1, "2/3": 2, "1/2": 2 },
    8:  { "1/3": 2, "2/3": 5, "1/2": 4 },
    15: { "1/3": 5, "2/3": 10, "1/2": 7 },
  },

  // Turn budgets
  budgets: { servantMoves: 4, masterMoves: 3, servantAttacks: 2 },

  // Gates
  gates: { npRound: 6, npRoundAssassin: 4, magicCrestRound: 3, noAttackRound: 1 },

  // Registries populated at setup
  effects: null,      // EffectRegistry
  dice:    null,      // DiceRegistry
  ruleElements: {},   // key → class
};
```

A module wanting to add a new rule element does `CONFIG.FGT.ruleElements.myThing = MyClass` in
its own `init`, and content can then reference `key: myThing`. That is the whole extension
story, and it is deliberately the same mechanism the system itself uses.

---

## 21.5 Settings

| Setting | Scope | Default | Purpose |
|---|---|---|---|
| `turnsPerRound` | world | 3 | The ◈ value |
| `boardSize` | world | 13 | 13 or 25 |
| `difficulty` | world | `expert` | Ch. 14 §14.10 |
| `region` | world | `null` | The war's region |
| `grailThreshold` | world | 9 | Servants defeated before materialization |
| `closedInfo` | world | `true` | Redact chat cards per viewer (§26.7): own modifiers, own effects, own exchanges |
| `diceFormulas` | world | `{}` | Overrides for the dice registry |
| `masterMode` | world | `essences` | `essences` / `coinFlip` / `rankless` |
| `activeSkillBudget` | world | `move` | Ch. 18 §18.3 / Ch. 41 Q5 |
| `interruptTimeout` | world | 45 | Seconds before a command-spell offer lapses |
| `autoDeclineLuckBelow` | client | 0 | Auto-decline checks below N% success |
| `showDamagePreview` | client | `true` | Speculative damage in the targeting UI |
| `animateFacing` | client | `true` | |
| `devMode` | world | `false` | Content validation, verbose logging |
| `schemaVersion` | world | (managed) | Migration bookkeeping (Ch. 39) |

Settings that change rules (`turnsPerRound`, `difficulty`, `activeSkillBudget`) are **locked
once a match is in progress**, because changing ◈ mid-game would invalidate every stored expiry
turn. The setting's `onChange` refuses and explains.

---

## 21.6 The public API

```js
fgt.api = {
  // Domain
  Rank, TickExpr, geometry,

  // Rules (pure)
  computeDamage(ctx),
  resolveTargets(spec, casterUuid, placement),
  evaluatePredicate(predicate, options),

  // Engine (writes)
  async declareAttack({ attackerUuid, abilityId, placement }),
  async useAbility({ actorUuid, abilityId, placement }),
  async applyEffect({ targetUuid, defId, magnitude, duration, sourceUuid }),
  async spendCommandSpell({ masterUuid, command, args }),

  // Registries
  effects: EffectRegistry,
  dice: DiceRegistry,

  // Snapshots, for module authors and debugging
  snapshotBoard(),
  snapshotUnit(actorUuid),
};
```

Everything a macro needs, and nothing that bypasses permission checks — every `engine` call
routes through the socket layer if the caller lacks ownership.

---

## 21.7 Tooling

**No bundler for the system itself.** ES modules load natively in Foundry v14, the module count
is manageable (~120 files), and skipping a build step removes an entire class of "my change
didn't apply" problems during development. Styles are the exception: SCSS compiles to
`styles/fgt.css` via a watch task.

| Tool | Purpose |
|---|---|
| **Vitest** | Unit and golden tests for L1/L2. No Foundry needed. |
| **ESLint** | With `import/no-restricted-paths` enforcing the layer boundaries |
| **Prettier** | Formatting |
| **sass** | `styles/src/**.scss` → `styles/fgt.css` |
| **`tools/build-packs.mjs`** | YAML → LevelDB compendium packs, with full content validation |
| **`tools/validate-content.mjs`** | Standalone validation, runnable in CI |
| **TypeScript (checkJs)** | Type-checks JSDoc annotations without compiling |

The last one is worth defending: JSDoc + `checkJs` gives roughly 80% of TypeScript's safety with
zero build step and no `.ts`/`.mjs` duality. For a system with a very large domain model, the
type checking is not optional; the compile step is.

```json
// jsconfig.json
{
  "compilerOptions": {
    "checkJs": true, "strict": true, "noEmit": true,
    "target": "ES2022", "module": "ES2022", "moduleResolution": "bundler",
    "types": ["@league-of-foundry-developers/foundry-vtt-types"]
  },
  "include": ["module/**/*.mjs", "tools/**/*.mjs"]
}
```

---

## 21.8 CI

```yaml
name: ci
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24 }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run validate:content     # every YAML parses, every id resolves
      - run: npm run test:unit
      - run: npm run test:golden
      - run: npm run build:packs          # must succeed for a release
```

`validate:content` is the gate that matters most in practice. It catches: unknown effect ids,
unparseable durations, unknown targeting shapes, rank strings that do not parse, ability
cross-references that do not resolve, `blockedBy` asymmetries, and missing localization keys.
Content bugs are the dominant failure mode in a data-driven system, and this catches them before
anyone loads a world.

---

## 21.9 Naming and conventions

| Thing | Convention | Example |
|---|---|---|
| System id | `fgt` | flag scope, socket namespace, `CONFIG.FGT` |
| Files | kebab-case | `combat-process.mjs` |
| Classes | PascalCase, `FGT` prefix for document subclasses | `FGTActor`, `CombatProcess` |
| Rule element keys | PascalCase | `DamageModifier`, `StatDelta` |
| Effect ids | camelCase | `defDwnC`, `sCritUp` |
| Ability ids | `<servant>-<slug>` | `karna-vasavi-shakti` |
| Roll option tags | colon-separated, lowercase | `target:attribute:divine` |
| Localization keys | `FGT.<Area>.<Key>` | `FGT.Combat.EvadeSuccess` |
| Flags | `flags.fgt.<key>` | `flags.fgt.combatProcess` |

---

## 21.10 What is deliberately not here

- **No `Actor.prototype` patching.** Everything goes through subclasses and CONFIG.
- **No global mixins into core classes.** Modules that do this break on every Foundry release.
- **No jQuery.** v14's ApplicationV2 is native DOM; jQuery is legacy.
- **No `MeasuredTemplate`.** v14 replaced it with grid shape generators (Ch. 28).
- **No third-party module dependencies.** The prototype required *Mass Edit* for targeting;
  that dependency is eliminated (Ch. 28). `relationships.requires` is empty and should stay so.

---

**Next:** [22 — Data Models](22-data-models.md)
