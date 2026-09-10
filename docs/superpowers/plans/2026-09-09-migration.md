# Migration and content sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Ch. 39's schema migration and content sync, so a world's documents follow the compendium without losing what play has written to them — and give the ability editor a way to write authoring back to the pack source.

**Architecture:** One shared vocabulary (`module/content/authored-fields.mjs`) names which fields the pack owns and which play owns; both the pack builder and the sync import it. A pure migration list (`module/migration/migrations.mjs`) is applied by a Layer-4 runner that backs the world up first. The sync reconciles every world document carrying a `contentId` against its pack document, and the ability editor gains a YAML exporter so nothing of value lives only in a world copy.

**Tech Stack:** Foundry VTT v14, ES modules, Vitest, `yaml`. Layered: `domain`(1) ← `rules`(2) ← `engine`(3) ← `apps`/`documents`(4), enforced by `tools/check-layers.mjs`. `rules/` and `domain/` may never touch `game`, `canvas`, `ui` or `Hooks`.

**Spec:** `docs/superpowers/specs/2026-09-09-migration-design.md`

## Global Constraints

- **The compendium is the whole source of truth** (spec R1). Ch. 39 D39.6 said the opposite; it is replaced, and the chapter must say so rather than be left contradicting the code.
- **Never overwrite what play owns** (spec R2). The authored allowlist minus `SEEDED_THEN_OWNED`, with `cooldown` merged key by key. Getting this wrong resets a live match, which is the corruption Ch. 39 opens by promising to prevent.
- **An item carrying `copiedFrom` or `grantedBy` is never removed** (spec R4). Wisdom of Dún Scáith's copied Noble Phantasms are not the pack's to sweep.
- **The backup is mandatory and is a real file** (spec R5, D39.3). A failed backup aborts the migration; there is no "continue anyway".
- **Migrations are pure functions over source data** (D39.2) — no `game`, no `canvas`, unit-testable without a world, and **idempotent**: applying one twice must equal applying it once, because a runner that fails halfway will be re-run.
- **Run `npm run lint`, not just `npm test`.** CI runs `eslint module tools test && node tools/check-layers.mjs`. A constant assigned and never read is invisible to a test and obvious to lint — that is how a real defect reached a PR earlier in this project.
- **Live verification is required.** Green tests are not evidence. Bring the world up with:
  ```bash
  node -e "fetch('http://127.0.0.1:9222/json/new?'+encodeURIComponent('http://localhost:30000/'),{method:'PUT'})"
  node tools/fgt-world.mjs launch && node tools/fgt-world.mjs join
  ```
  A pack change needs `node tools/fgt-rebuild.mjs`.
- **Docs travel with the change.** `docs/45` alone is not enough; the affected 00–44 chapter must change in the same commit.
- **Commit trailer:**
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01NJXzEHEgrcNbP3ChB6tiPN
  ```

## File Structure

| File | Responsibility |
|---|---|
| `module/content/authored-fields.mjs` *(new)* | The one vocabulary: which keys the pack owns, which play owns. Pure data, Layer 1. |
| `test/unit/authored-fields.test.mjs` *(new)* | Holds that vocabulary against `tools/lib/content.mjs`'s builders in both directions. |
| `tools/lib/content.mjs:1452,1572` | `actorSystem`/`itemSystem` build from the shared key sets instead of an inline literal. |
| `module/migration/migrations.mjs` *(new)* | `SCHEMA_VERSION` and the ordered `MIGRATIONS` list. Pure. |
| `module/migration/runner.mjs` *(new)* | Layer 4. Reads the world's version, backs up, applies, writes the new version, reports. |
| `module/migration/backup.mjs` *(new)* | Writes the world's F/GT documents to `worlds/<id>/fgt-backups/<ts>.json`. |
| `module/migration/content-sync.mjs` *(new)* | The pure reconcile: given a world source and a pack source, return what to write. |
| `module/migration/sync-runner.mjs` *(new)* | Layer 4. Walks world documents, applies the reconcile, reports. |
| `module/apps/yaml-export.mjs` *(new)* | Browser side: a document as its authored **shape**, written as JSON. No npm imports. |
| `tools/stage-to-yaml.mjs` *(new)* | Node side: staged JSON becomes the `.yml` the loader reads. |
| `module/apps/ability-editor.mjs` | Gains the export action. |
| `module/settings.mjs:193` | `schemaVersion` setting removed; the world flag replaces it. |
| `test/unit/settings-are-read.test.mjs:38` | The false `schemaVersion` exception removed. |
| `tools/lib/content.mjs` | `contentVersion` carried into the pack. |

---

### Task 1: One vocabulary for authored versus runtime

Nothing changes behaviour. This task extracts a list that already exists as an inline literal, so that two readers can share it — and adds the guard that keeps them in step.

**Files:**
- Create: `module/content/authored-fields.mjs`
- Create: `test/unit/authored-fields.test.mjs`
- Modify: `tools/lib/content.mjs:1452` and `:1572`

**Interfaces:**
- Consumes: nothing.
- Produces: `AUTHORED_ACTOR_KEYS: readonly string[]`, `AUTHORED_ITEM_KEYS: readonly string[]`, `SEEDED_THEN_OWNED: {actor: string[], item: string[]}`, `COOLDOWN_OWNED_BY_WORLD: readonly string[]`, `ownedByWorld(kind, key): boolean`.

- [ ] **Step 1: Write the failing test**

Create `test/unit/authored-fields.test.mjs`:

```js
/**
 * @file The one vocabulary: which fields the pack owns, which play owns.
 * @see module/content/authored-fields.mjs, docs/39-migration-and-versioning.md
 *
 * `actorSystem`/`itemSystem` in the content pipeline decide what enters a pack.
 * The content sync needs the same answer, so the list lives in one place and
 * this file holds the two readers against each other -- the same guard
 * `RULE_ELEMENT_KEYS` and `EXECUTORS` already have, and for the same reason: two
 * hand-maintained copies of one vocabulary drift, and the drift is silent.
 */

import { describe, it, expect } from "vitest";
import {
  AUTHORED_ACTOR_KEYS, AUTHORED_ITEM_KEYS,
  SEEDED_THEN_OWNED, COOLDOWN_OWNED_BY_WORLD, ownedByWorld,
} from "../../module/content/authored-fields.mjs";

describe("the authored vocabulary", () => {
  it("names the actor fields a pack may state", () => {
    // A spot check on the ones that have already gone missing once: a key
    // absent here is dropped on the way into the pack, silently.
    for (const key of ["contentId", "parameters", "baseAttack", "normalAttack", "passiveRules"]) {
      expect(AUTHORED_ACTOR_KEYS).toContain(key);
    }
  });

  it("names the item fields a pack may state", () => {
    for (const key of ["contentId", "cooldown", "targeting", "phases", "npGateRound", "damage"]) {
      expect(AUTHORED_ITEM_KEYS).toContain(key);
    }
  });

  it("has no duplicates in either list", () => {
    expect(new Set(AUTHORED_ACTOR_KEYS).size).toBe(AUTHORED_ACTOR_KEYS.length);
    expect(new Set(AUTHORED_ITEM_KEYS).size).toBe(AUTHORED_ITEM_KEYS.length);
  });
});

describe("fields the pack only seeds", () => {
  it("keeps every seeded key inside the authored list", () => {
    // A seeded key that is NOT authored is a contradiction: the sync would
    // never have touched it anyway, and listing it hides a real mistake.
    for (const key of SEEDED_THEN_OWNED.actor) expect(AUTHORED_ACTOR_KEYS).toContain(key);
    for (const key of SEEDED_THEN_OWNED.item) expect(AUTHORED_ITEM_KEYS).toContain(key);
  });

  it("names the three the allowlist carries but no content authors", () => {
    // Measured: `grep -rl "^ *timesUsed:" packs/_source/` finds nothing.
    for (const key of ["timesUsed", "lastUsedTick", "recordedAttacks"]) {
      expect(SEEDED_THEN_OWNED.item).toContain(key);
    }
  });

  it("names the ones content authors as a STARTING value", () => {
    for (const key of ["agility", "luck", "resources", "stance"]) {
      expect(SEEDED_THEN_OWNED.actor).toContain(key);
    }
    for (const key of ["active", "quantity"]) {
      expect(SEEDED_THEN_OWNED.item).toContain(key);
    }
  });

  it("keeps provenance with the world", () => {
    // An item copied by Wisdom of Dún Scáith records where it came from; a
    // content update has no business rewriting that.
    expect(SEEDED_THEN_OWNED.item).toContain("copiedFrom");
    expect(SEEDED_THEN_OWNED.item).toContain("grantedBy");
  });
});

describe("ownedByWorld", () => {
  it("says yes to a seeded key and no to an ordinary authored one", () => {
    expect(ownedByWorld("item", "timesUsed")).toBe(true);
    expect(ownedByWorld("item", "phases")).toBe(false);
    expect(ownedByWorld("actor", "resources")).toBe(true);
    expect(ownedByWorld("actor", "parameters")).toBe(false);
  });

  it("says yes to anything outside the authored list at all", () => {
    // Health, turnState, contracts and positions are not authored, so they are
    // preserved without needing to be listed.
    expect(ownedByWorld("actor", "health")).toBe(true);
    expect(ownedByWorld("actor", "turnState")).toBe(true);
    expect(ownedByWorld("item", "expended")).toBe(true);
  });
});

describe("the cooldown split", () => {
  it("leaves the clock with the world and the shape with the pack", () => {
    // `cooldown` is the one key that is half each: `max` is authored, and
    // `remaining` is what the match has spent.
    expect(COOLDOWN_OWNED_BY_WORLD).toEqual(["remaining", "regen", "gatedDelay"]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/unit/authored-fields.test.mjs`
Expected: FAIL — `Failed to resolve import "../../module/content/authored-fields.mjs"`.

- [ ] **Step 3: Write the vocabulary**

Create `module/content/authored-fields.mjs`. Copy the key names verbatim from `tools/lib/content.mjs`'s `actorSystem()` (line 1452) and `itemSystem()` (line 1572) — the exact sets are:

```js
/**
 * @file Which fields belong to the pack, and which belong to the world.
 * @see docs/39-migration-and-versioning.md, docs/37-content-pipeline.md
 *
 * Layer 1 (content). Pure data.
 *
 * The content pipeline's `actorSystem()`/`itemSystem()` decide what a YAML
 * document may state, and silently drop anything they do not name -- the
 * mechanism that has already cost this project `npGateRound`, `onEnd` and
 * `countsTowardBudget`. The content sync needs exactly the same answer, so the
 * vocabulary lives here and both read it. `test/unit/authored-fields.test.mjs`
 * holds the two together in both directions.
 */

/** Actor fields a pack document may state. */
export const AUTHORED_ACTOR_KEYS = Object.freeze([
  "npChoice", "rank", "commandSpells", "zon", "footprint", "upkeep",
  "countsTowardBudget", "actsOncePerTurn", "boundToPlatformId",
  "movesOntoOccupiedPanels", "sharesPanel", "replacesRiderAction",
  "countsAsHomeBase", "deactivation", "undamageable", "cannotHoldItems",
  "itemHandling", "destroyableBy", "visibleWithin", "agility", "luck",
  "inherit", "rules", "passiveRules", "activeRules", "summonerId", "capacity",
  "ownerId", "level", "crossLevel", "contentId", "trueName", "servantClasses",
  "classContainer", "concealedIdentity", "identityRevealed", "detect",
  "defaultImage", "alignment", "region", "attributes", "parameters",
  "baseHealth", "mov", "range", "baseAttack", "normalAttack", "sustainability",
  "summonVariant", "stanceSpec", "stance", "resources", "notes",
]);

/** Item fields a pack document may state. */
export const AUTHORED_ITEM_KEYS = Object.freeze([
  "contentId", "description", "source", "rank", "slug", "isNP", "isMode",
  "isAttackSkill", "replacesNormalAttack", "isSpell", "isPassive", "active",
  "cannotDeactivate", "toggleLock", "categorizedAsNP", "categorizedAs",
  "weakPoint", "ridingAttack", "expendsPermanently", "categorizedWhile",
  "npTags", "cooldown", "cooldownWaiver", "targeting", "field", "quantity",
  "transferable", "transferRange", "transfersPerTurn", "consumeEffect",
  "phases", "copyable", "copiedFrom", "opensDialog", "additionalCosts",
  "npGateRound", "itemCost", "category", "kind", "passive", "countsAsAttack",
  "countsAsAct", "oncePerTurn", "oncePerRound", "alsoTriggers", "exclusionSet",
  "grantedBy", "sameTurnExclusive", "sameRoundExclusive", "timesUsed",
  "maxUses", "lastUsedTick", "recordedAttacks", "recordsAttacks", "shield",
  "shieldHealth", "negatedBy", "negatedWhile", "cancelsNP",
  "allySelfBypassesResistance", "nonStacking", "damage", "aftermath",
]);

/**
 * Authored keys the pack only **seeds**, and which play then owns.
 *
 * Three of the item entries -- `timesUsed`, `lastUsedTick`, `recordedAttacks` --
 * are in the allowlist and authored by NO content at all; they are runtime the
 * list happens to name. The rest carry a starting value that a match then
 * changes: Resources are spent, a mode is toggled, an Item's quantity is used
 * up, a stance is taken.
 *
 * `copiedFrom` and `grantedBy` are provenance. An ability copied by Wisdom of
 * Dún Scáith records where it came from, and a content update has no business
 * rewriting that.
 *
 * Overwriting any of these on a sync would reset a live match -- the corruption
 * Ch. 39 opens by promising to prevent.
 */
export const SEEDED_THEN_OWNED = Object.freeze({
  actor: Object.freeze(["agility", "luck", "resources", "stance"]),
  item: Object.freeze([
    "active", "timesUsed", "lastUsedTick", "recordedAttacks", "quantity",
    "copiedFrom", "grantedBy",
  ]),
});

/**
 * The halves of `cooldown` a match owns.
 *
 * The one key that is half the pack's and half the world's: `max`, `perUnit`,
 * `countFrom` and `branches` are authored; the clock is what the match has
 * spent. Refilling a cooldown mid-match is not a content update.
 */
export const COOLDOWN_OWNED_BY_WORLD = Object.freeze([
  "remaining", "regen", "gatedDelay",
]);

/**
 * Is this field the world's to keep?
 *
 * True for anything outside the authored list -- Health, `turnState`,
 * contracts, positions -- and for the authored keys the pack only seeds.
 *
 * @param {"actor"|"item"} kind
 * @param {string} key
 * @returns {boolean}
 */
export function ownedByWorld(kind, key) {
  const authored = kind === "actor" ? AUTHORED_ACTOR_KEYS : AUTHORED_ITEM_KEYS;
  if (!authored.includes(key)) return true;
  return (SEEDED_THEN_OWNED[kind] ?? []).includes(key);
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run test/unit/authored-fields.test.mjs`
Expected: PASS.

- [ ] **Step 5: Hold the pipeline against it, in both directions**

Append to `test/unit/authored-fields.test.mjs`:

```js
describe("the pipeline and the vocabulary agree", () => {
  // Two hand-maintained copies of one list is the shape this codebase has been
  // bitten by repeatedly. Either direction is a defect: a key here that the
  // builder does not emit means the sync overwrites something the pack never
  // sets, and a key the builder emits that is missing here means the sync
  // leaves a stale field behind for ever.
  const source = readFileSync("tools/lib/content.mjs", "utf8");

  /** The keys one builder function emits, read out of its source. */
  const emitted = (fnName) => {
    const start = source.indexOf(`function ${fnName}(doc)`);
    expect(start).toBeGreaterThan(-1);
    const end = source.indexOf("\n}", start);
    return [...source.slice(start, end).matchAll(/^ {4}([a-zA-Z][\w]*):/gm)].map((m) => m[1]);
  };

  it("actorSystem emits exactly AUTHORED_ACTOR_KEYS", () => {
    expect([...emitted("actorSystem")].sort()).toEqual([...AUTHORED_ACTOR_KEYS].sort());
  });

  it("itemSystem emits exactly AUTHORED_ITEM_KEYS", () => {
    expect([...emitted("itemSystem")].sort()).toEqual([...AUTHORED_ITEM_KEYS].sort());
  });
});
```

Add the import at the top of the file: `import { readFileSync } from "node:fs";`

- [ ] **Step 6: Run it, and fix whichever side is wrong**

Run: `npx vitest run test/unit/authored-fields.test.mjs`

If a key differs, **read the builder and decide which side is right** — do not copy blindly. A key the builder emits and the list lacks belongs in the list. A key in the list the builder does not emit is either a typo here or a field the pack genuinely cannot state.

- [ ] **Step 7: Run everything**

Run: `npm test && npm run lint`
Expected: all PASS. Nothing else may move — this task adds a list and a test and changes no behaviour.

- [ ] **Step 8: Commit**

```bash
git add module/content/authored-fields.mjs test/unit/authored-fields.test.mjs
git commit -F - <<'EOF'
feat(migration): one vocabulary for authored versus runtime fields

`actorSystem`/`itemSystem` already decide which fields a pack document may
state, and silently drop anything they do not name -- the mechanism that has
cost this project `npGateRound`, `onEnd` and `countsTowardBudget`. The content
sync needs the same answer, so the list lives in one place with a drift test
holding both readers together in both directions.

`SEEDED_THEN_OWNED` is the correction the data forced: `timesUsed`,
`lastUsedTick` and `recordedAttacks` are in the allowlist and authored by no
content at all, and `active`, `quantity`, `stance` and `resources` are authored
as STARTING values that a match then owns. `cooldown` is half each. Syncing on
the allowlist alone would reset a live match.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NJXzEHEgrcNbP3ChB6tiPN
EOF
```

---

### Task 2: The reconcile, as a pure function

The decision of what to write, with no world attached. This is the part worth testing exhaustively and the part a mistake in would corrupt a match.

**Files:**
- Create: `module/migration/content-sync.mjs`
- Create: `test/unit/content-sync.test.mjs`

**Interfaces:**
- Consumes: `ownedByWorld`, `COOLDOWN_OWNED_BY_WORLD` from Task 1.
- Produces:
  - `reconcileSystem(kind, worldSystem, packSystem) → object` — the system data to write
  - `reconcileItems(worldItems, packItems) → {update: object[], create: object[], remove: string[], kept: string[]}`
  - `PROVENANCE_KEYS: readonly string[]` — `["copiedFrom", "grantedBy"]`

- [ ] **Step 1: Write the failing tests**

Create `test/unit/content-sync.test.mjs`:

```js
/**
 * @file Reconciling a world document against its pack document.
 * @see module/migration/content-sync.mjs, docs/39-migration-and-versioning.md
 *
 * The compendium is the whole source of truth (spec R1) -- but a world copy
 * holds what the match has written to it, and a sync that overwrites that is a
 * corrupted match rather than an update. Fourteen Masters held a Magic Crest
 * without its Round gate for a whole day because nothing did this at all.
 */

import { describe, it, expect } from "vitest";
import {
  reconcileSystem, reconcileItems, PROVENANCE_KEYS,
} from "../../module/migration/content-sync.mjs";

describe("reconcileSystem", () => {
  it("takes an authored field from the pack", () => {
    const world = { contentId: "ozymandias", mov: 5 };
    const pack = { contentId: "ozymandias", mov: 6 };
    expect(reconcileSystem("actor", world, pack).mov).toBe(6);
  });

  it("leaves a field the pack does not name", () => {
    // Health, contracts, positions: not authored, so not the pack's business.
    const world = { contentId: "ozymandias", health: { value: 400, max: 1000 }, masterId: "m1" };
    const out = reconcileSystem("actor", world, { contentId: "ozymandias" });
    expect(out.health).toEqual({ value: 400, max: 1000 });
    expect(out.masterId).toBe("m1");
  });

  it("leaves a SEEDED field even though the pack states one", () => {
    // Resources are authored as a starting value and spent during play.
    const world = { contentId: "emiya", resources: { aria: 2 } };
    const pack = { contentId: "emiya", resources: { aria: 0 } };
    expect(reconcileSystem("actor", world, pack).resources).toEqual({ aria: 2 });
  });

  it("splits cooldown between the pack and the world", () => {
    const world = { contentId: "x", cooldown: { max: "3◈", remaining: 4, regen: 1, gatedDelay: 5 } };
    const pack = { contentId: "x", cooldown: { max: "7◈", remaining: 0, regen: 0, gatedDelay: 0 } };
    const out = reconcileSystem("item", world, pack).cooldown;
    expect(out.max).toBe("7◈");         // the pack's shape
    expect(out.remaining).toBe(4);      // the match's clock
    expect(out.regen).toBe(1);
    expect(out.gatedDelay).toBe(5);
  });

  it("adds an authored field the world copy never had", () => {
    // The Magic Crest case exactly: the pack gained `npGateRound` and the world
    // copy read null for a day.
    const out = reconcileSystem("item", { contentId: "crest" }, { contentId: "crest", npGateRound: 3 });
    expect(out.npGateRound).toBe(3);
  });

  it("keeps provenance with the world", () => {
    const world = { contentId: "np", copiedFrom: "emiya-hrunting", grantedBy: "wisdomOfDunScaith" };
    const out = reconcileSystem("item", world, { contentId: "np", copiedFrom: null, grantedBy: null });
    expect(out.copiedFrom).toBe("emiya-hrunting");
    expect(out.grantedBy).toBe("wisdomOfDunScaith");
  });

  it("does not mutate either input", () => {
    const world = { contentId: "x", mov: 5 };
    const pack = { contentId: "x", mov: 6 };
    reconcileSystem("actor", world, pack);
    expect(world.mov).toBe(5);
    expect(pack.mov).toBe(6);
  });
});

describe("reconcileItems", () => {
  const item = (contentId, over = {}) => ({ _id: contentId + "-id", system: { contentId, ...over } });

  it("refreshes an item both sides have", () => {
    const out = reconcileItems([item("crest")], [item("crest", { npGateRound: 3 })]);
    expect(out.update).toHaveLength(1);
    expect(out.update[0].system.npGateRound).toBe(3);
    expect(out.update[0]._id).toBe("crest-id");   // the world's id, not the pack's
  });

  it("creates an item the template gained", () => {
    const out = reconcileItems([], [item("crest")]);
    expect(out.create.map((i) => i.system.contentId)).toEqual(["crest"]);
  });

  it("removes an item the template lost", () => {
    const out = reconcileItems([item("old-skill")], []);
    expect(out.remove).toEqual(["old-skill-id"]);
  });

  it("NEVER removes an item granted during play", () => {
    // Wisdom of Dún Scáith copies a Noble Phantasm onto its caster. A content
    // update has no business sweeping it.
    const copied = item("emiya-hrunting", { copiedFrom: "emiya", grantedBy: "wisdomOfDunScaith" });
    const out = reconcileItems([copied], []);
    expect(out.remove).toEqual([]);
    expect(out.kept).toEqual(["emiya-hrunting-id"]);
  });

  it("leaves an item with no contentId alone", () => {
    // Hand-made items are the GM's, not the pack's.
    const homemade = { _id: "hand-1", system: {} };
    const out = reconcileItems([homemade], []);
    expect(out.remove).toEqual([]);
    expect(out.kept).toEqual(["hand-1"]);
  });
});

describe("PROVENANCE_KEYS", () => {
  it("is the pair that marks a runtime grant", () => {
    expect(PROVENANCE_KEYS).toEqual(["copiedFrom", "grantedBy"]);
  });
});
```

- [ ] **Step 2: Run and watch every one fail**

Run: `npx vitest run test/unit/content-sync.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the reconcile**

Create `module/migration/content-sync.mjs`:

```js
/**
 * @file Reconciling a world document against its pack document.
 * @see docs/39-migration-and-versioning.md §39.6
 *
 * Layer 2-equivalent: pure, no `game`, no `canvas`. The runner that walks the
 * world lives beside this and is Layer 4; this file only decides what to write.
 *
 * The compendium is the whole source of truth (spec R1). A world copy is an
 * instance of pack content plus everything the match has written to it, and the
 * whole difficulty is telling those apart -- `module/content/authored-fields.mjs`
 * is that judgement, and this file applies it.
 */

import { ownedByWorld, COOLDOWN_OWNED_BY_WORLD } from "../content/authored-fields.mjs";

/**
 * Fields that mark an item as granted during play rather than authored.
 *
 * An ability copied by Wisdom of Dún Scáith carries both. It is not in any pack
 * template, so a naive sync would delete it every time the world loaded.
 */
export const PROVENANCE_KEYS = Object.freeze(["copiedFrom", "grantedBy"]);

/**
 * The system data to write onto a world document.
 *
 * Starts from the world's own data and overlays the pack's, key by key, taking
 * the pack's value only where the pack owns the key. Neither input is mutated:
 * callers pass documents they still hold.
 *
 * @param {"actor"|"item"} kind
 * @param {object} worldSystem the world document's system source
 * @param {object} packSystem the pack document's system source
 * @returns {object} the merged system data
 */
export function reconcileSystem(kind, worldSystem, packSystem) {
  const out = { ...(worldSystem ?? {}) };

  for (const [key, value] of Object.entries(packSystem ?? {})) {
    if (ownedByWorld(kind, key)) continue;

    // `cooldown` is the one key that is half each: the pack states the clock's
    // SHAPE and the match spends it (Ch. 39, spec R2).
    if (key === "cooldown") {
      const world = worldSystem?.cooldown ?? {};
      const merged = { ...(value ?? {}) };
      for (const owned of COOLDOWN_OWNED_BY_WORLD) {
        if (world[owned] !== undefined) merged[owned] = world[owned];
      }
      out.cooldown = merged;
      continue;
    }

    out[key] = value;
  }

  return out;
}

/**
 * What to do with a document's embedded items.
 *
 * Matched by `contentId`, which is the stable name a pack document carries and
 * a Foundry id is not: a world copy has its own ids, and they must survive so
 * that anything referencing an item by id keeps working.
 *
 * @param {object[]} worldItems the world document's items, as source objects
 * @param {object[]} packItems the pack template's items, as source objects
 * @returns {{update: object[], create: object[], remove: string[], kept: string[]}}
 */
export function reconcileItems(worldItems, packItems) {
  const byContent = new Map();
  for (const item of packItems ?? []) {
    const id = item?.system?.contentId;
    if (id) byContent.set(id, item);
  }

  /** @type {object[]} */ const update = [];
  /** @type {string[]} */ const remove = [];
  /** @type {string[]} */ const kept = [];
  const seen = new Set();

  for (const held of worldItems ?? []) {
    const contentId = held?.system?.contentId ?? null;

    // Not pack content at all -- a GM's own item. Left alone.
    if (!contentId) { kept.push(held._id); continue; }

    // Granted during play. Not in any template, and not the pack's to remove.
    if (PROVENANCE_KEYS.some((k) => held.system?.[k])) { kept.push(held._id); continue; }

    const template = byContent.get(contentId);
    if (!template) { remove.push(held._id); continue; }

    seen.add(contentId);
    update.push({
      ...held,
      // The WORLD's id: a pack id here would delete and recreate the item,
      // breaking anything holding a reference to it.
      _id: held._id,
      name: template.name ?? held.name,
      img: template.img ?? held.img,
      system: reconcileSystem("item", held.system, template.system),
    });
  }

  const create = (packItems ?? []).filter((i) => {
    const id = i?.system?.contentId;
    return id && !seen.has(id);
  });

  return { update, create, remove, kept };
}
```

- [ ] **Step 4: Run the tests and the layer check**

Run: `npx vitest run test/unit/content-sync.test.mjs && node tools/check-layers.mjs`
Expected: all PASS; `Layer boundaries intact`.

- [ ] **Step 5: Run everything**

Run: `npm test && npm run lint`
Expected: all PASS; nothing else moves — this is read by nobody yet.

- [ ] **Step 6: Commit**

```bash
git add module/migration/content-sync.mjs test/unit/content-sync.test.mjs
git commit -F - <<'EOF'
feat(migration): the content reconcile, as a pure function

Given a world document and its pack document, decide what to write. Pure, so
the judgement that would corrupt a match if wrong can be tested exhaustively
without a world.

Three rules the tests pin. A field the pack does not own is never touched --
Health, contracts, positions, and the authored keys the pack only seeds. A
`cooldown` is merged key by key, because `max` is the pack's and `remaining` is
what the match has spent. And an item carrying `copiedFrom` or `grantedBy` was
granted during play: it is in no template, so a naive sync would delete Wisdom
of Dun Scaith's copies every time the world loaded.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NJXzEHEgrcNbP3ChB6tiPN
EOF
```

---

### Task 3: The backup

D39.3 calls this non-negotiable, and it must exist before anything writes to a world. Built and verified on its own, before the runner that depends on it.

**Files:**
- Create: `module/migration/backup.mjs`
- Test: live only — it writes a file through Foundry's server, which no unit test can stand in for.

**Interfaces:**
- Consumes: nothing.
- Produces: `collectWorldDocuments() → object`, `writeBackup(payload, label) → Promise<{path: string, bytes: number}>`.

- [ ] **Step 1: Write the module**

Create `module/migration/backup.mjs`:

```js
/**
 * @file The pre-migration backup.
 * @see docs/39-migration-and-versioning.md §39.2, D39.3
 *
 * Layer 4.
 *
 * > *"Before any migration, export the world's F/GT documents to a timestamped
 * > JSON file in the world directory. Non-negotiable. Migrations are the
 * > highest-risk operation the system performs and the cost of a backup is a
 * > few hundred kilobytes."*
 *
 * A real file rather than a browser download: a download is a prompt the GM can
 * dismiss, and a backup nobody kept is not a backup.
 */

/**
 * Every F/GT document in the world, as source data.
 *
 * Source, not prepared data: a migration reads what is stored, and prepared
 * data contains derived values that would restore as though they had been
 * authored.
 *
 * @returns {object}
 */
export function collectWorldDocuments() {
  return {
    takenAt: new Date().toISOString(),
    world: game.world.id,
    systemVersion: game.system.version,
    schemaVersion: game.world.flags?.fgt?.schemaVersion ?? null,
    actors: game.actors.map((a) => a.toObject()),
    items: game.items.map((i) => i.toObject()),
    scenes: game.scenes.map((s) => s.toObject()),
    combats: game.combats.map((c) => c.toObject()),
  };
}

/**
 * Write a backup into the world's own directory.
 *
 * `FilePicker.upload` puts the file where the world lives, so a GM restoring it
 * does not have to find a download. A failure here is fatal to the caller by
 * contract: `runner.mjs` aborts rather than migrating unbacked data.
 *
 * @param {object} payload
 * @param {string} label a short tag for the filename, e.g. "schema" or "sync"
 * @returns {Promise<{path: string, bytes: number}>}
 * @throws {Error} when the write fails
 */
export async function writeBackup(payload, label) {
  const json = JSON.stringify(payload, null, 2);
  const stamp = payload.takenAt.replace(/[:.]/g, "-");
  const dir = `worlds/${game.world.id}/fgt-backups`;
  const name = `${stamp}-${label}.json`;

  // Idempotent: creating a directory that exists throws, and that throw is not
  // a failure of the backup.
  try {
    await foundry.applications.apps.FilePicker.implementation.createDirectory("data", dir);
  } catch (err) {
    if (!/EEXIST|already exists/i.test(String(err?.message ?? err))) throw err;
  }

  const file = new File([json], name, { type: "application/json" });
  const result = await foundry.applications.apps.FilePicker.implementation
    .upload("data", dir, file, {}, { notify: false });
  if (!result?.path) throw new Error(`FGT | Backup upload returned no path for ${dir}/${name}`);

  return { path: result.path, bytes: json.length };
}
```

- [ ] **Step 2: Run lint and the layer check**

Run: `npm run lint`
Expected: PASS. If `FilePicker` resolves under a different path in this Foundry build, find it with:
`grep -rn "FilePicker" module/apps/*.mjs | head -3` and match whatever the codebase already uses.

- [ ] **Step 3: Verify live — this is the whole test**

Bring the world up, then:

```bash
node tools/fgt-eval.mjs "
const { collectWorldDocuments, writeBackup } = await import('/systems/fgt/module/migration/backup.mjs');
const payload = collectWorldDocuments();
const out = await writeBackup(payload, 'probe');
return JSON.stringify({ path: out.path, kb: Math.round(out.bytes / 1024),
  actors: payload.actors.length, scenes: payload.scenes.length, combats: payload.combats.length }, null, 1)"
```

Expected: a path under `worlds/fgt2026/fgt-backups/`, a non-trivial size, and counts matching the world. Then confirm the file is real and parses:

```bash
ls -la "C:/Users/isaac/AppData/Local/FoundryVTT/Data/worlds/fgt2026/fgt-backups/" | tail -3
```

If the Data path differs on this machine, find it from the world tool's output.

- [ ] **Step 4: Commit**

```bash
git add module/migration/backup.mjs
git commit -F - <<'EOF'
feat(migration): the pre-migration backup

D39.3 calls this non-negotiable, so it is built and verified before anything
that writes to a world exists.

A real file in the world's own directory rather than a browser download: a
download is a prompt the GM can dismiss, and a backup nobody kept is not a
backup. Source data rather than prepared data, because a migration reads what is
stored and prepared data would restore derived values as though authored.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NJXzEHEgrcNbP3ChB6tiPN
EOF
```

---

### Task 4: The schema version axis and the migration list

**Files:**
- Create: `module/migration/migrations.mjs`
- Create: `test/unit/migrations.test.mjs`
- Modify: `module/settings.mjs:193` (remove the setting)
- Modify: `test/unit/settings-are-read.test.mjs:38` (remove the false exception)

**Interfaces:**
- Consumes: nothing.
- Produces: `SCHEMA_VERSION: number`, `MIGRATIONS: object[]`, `pendingFrom(worldVersion) → object[]`, `applyMigration(entry, kind, source, ctx) → object`.

- [ ] **Step 1: Write the failing tests**

Create `test/unit/migrations.test.mjs`:

```js
/**
 * @file Schema migrations.
 * @see module/migration/migrations.mjs, docs/39-migration-and-versioning.md §39.2
 *
 * D39.2: migrations are pure functions over source data, unit-testable without a
 * world. They must also be IDEMPOTENT -- a runner that fails halfway will be
 * re-run, and a migration that doubles a value on the second pass is worse than
 * one that never ran.
 */

import { describe, it, expect } from "vitest";
import {
  SCHEMA_VERSION, MIGRATIONS, pendingFrom, applyMigration,
} from "../../module/migration/migrations.mjs";

describe("the schema version", () => {
  it("is a positive integer", () => {
    expect(Number.isInteger(SCHEMA_VERSION)).toBe(true);
    expect(SCHEMA_VERSION).toBeGreaterThan(0);
  });

  it("equals the highest migration target, or 1 when there are none", () => {
    // A migration list that runs past the code's version would loop; one that
    // stops short would leave data half-migrated with no record of it.
    const highest = MIGRATIONS.reduce((n, m) => Math.max(n, m.to), 1);
    expect(SCHEMA_VERSION).toBe(highest);
  });
});

describe("the migration list", () => {
  it("is strictly ascending, with no repeated target", () => {
    const targets = MIGRATIONS.map((m) => m.to);
    expect(targets).toEqual([...targets].sort((a, b) => a - b));
    expect(new Set(targets).size).toBe(targets.length);
  });

  it("describes every entry", () => {
    // The description is what the GM is shown and what the changelog quotes.
    for (const m of MIGRATIONS) {
      expect(typeof m.description).toBe("string");
      expect(m.description.length).toBeGreaterThan(0);
    }
  });

  it("declares only handler kinds the runner walks", () => {
    const known = new Set(["to", "description", "actor", "item", "effect", "scene", "combat"]);
    for (const m of MIGRATIONS) {
      for (const key of Object.keys(m)) expect(known).toContain(key);
    }
  });
});

describe("pendingFrom", () => {
  it("returns nothing when the world is current", () => {
    expect(pendingFrom(SCHEMA_VERSION)).toEqual([]);
  });

  it("returns nothing when the world is somehow ahead", () => {
    // A world opened by a newer system and then by an older one. Refusing to
    // run is right; running migrations backwards is not a thing.
    expect(pendingFrom(SCHEMA_VERSION + 5)).toEqual([]);
  });

  it("returns the entries above the world's version, in order", () => {
    const all = pendingFrom(0);
    expect(all).toEqual(MIGRATIONS);
  });
});

describe("applyMigration", () => {
  const entry = {
    to: 2,
    description: "test",
    actor: (source) => ({ ...source, system: { ...source.system, marked: true } }),
  };

  it("applies the handler for a kind it declares", () => {
    const out = applyMigration(entry, "actor", { system: { mov: 5 } }, {});
    expect(out.system.marked).toBe(true);
    expect(out.system.mov).toBe(5);
  });

  it("returns the source untouched for a kind it does not declare", () => {
    const source = { system: { x: 1 } };
    expect(applyMigration(entry, "item", source, {})).toBe(source);
  });

  it("is idempotent for every shipped migration", () => {
    // Applied twice must equal applied once. A runner that fails partway
    // through will be re-run against data some of which is already migrated.
    for (const m of MIGRATIONS) {
      for (const kind of ["actor", "item", "effect", "scene", "combat"]) {
        if (!m[kind]) continue;
        const source = { system: {} };
        const once = applyMigration(m, kind, source, { globalTurn: 0 });
        const twice = applyMigration(m, kind, once, { globalTurn: 0 });
        expect(twice).toEqual(once);
      }
    }
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run test/unit/migrations.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the list**

Create `module/migration/migrations.mjs`:

```js
/**
 * @file Schema migrations.
 * @see docs/39-migration-and-versioning.md §39.2
 *
 * Layer 1-equivalent: pure, no `game`, no `canvas`, no settings. D39.2 requires
 * migrations to be "pure functions over source data, so they are unit-testable
 * without a world" -- and the runner that walks the world lives beside this,
 * knowing nothing about what any individual migration means.
 *
 * Every handler must be IDEMPOTENT. A runner that fails partway through is
 * re-run against data some of which is already migrated, so a handler that
 * doubles a value or appends a second time is worse than one that never ran.
 * `test/unit/migrations.test.mjs` holds every shipped entry to that.
 */

/**
 * The shape of persisted data this code expects.
 *
 * Bump this beside each new entry in `MIGRATIONS`, and never separately: the
 * two are one fact written twice, and a test holds them together.
 */
export const SCHEMA_VERSION = 1;

/**
 * The ordered migrations, each declaring handlers per document type.
 *
 * ```js
 * {
 *   to: 2,
 *   description: "Split parameters into base/granted",
 *   actor(source, ctx) { ... return source; },
 * }
 * ```
 *
 * `ctx` carries what a handler cannot read from the document alone -- currently
 * `{globalTurn}`, which §39.2's own example needs to turn a remaining-tick count
 * into an absolute expiry.
 *
 * Empty today. The version axis exists so that the FIRST shape change has
 * somewhere to go; adding the machinery at that moment, under time pressure, is
 * how worlds get corrupted.
 *
 * @type {ReadonlyArray<object>}
 */
export const MIGRATIONS = Object.freeze([]);

/**
 * The migrations a world at this version still needs, in order.
 *
 * A world ahead of the code gets nothing: running migrations backwards is not a
 * thing, and refusing is better than guessing.
 *
 * @param {number} worldVersion
 * @returns {object[]}
 */
export function pendingFrom(worldVersion) {
  return MIGRATIONS.filter((m) => m.to > worldVersion && m.to <= SCHEMA_VERSION);
}

/**
 * Apply one migration's handler for one document kind.
 *
 * Returns the source unchanged -- the same object, not a copy -- when the entry
 * declares no handler for this kind, so the runner can tell "nothing to do"
 * from "rewritten identically" and skip the write.
 *
 * @param {object} entry a `MIGRATIONS` element
 * @param {"actor"|"item"|"effect"|"scene"|"combat"} kind
 * @param {object} source the document's source data
 * @param {object} ctx `{globalTurn}`
 * @returns {object}
 */
export function applyMigration(entry, kind, source, ctx) {
  const handler = entry?.[kind];
  if (typeof handler !== "function") return source;
  return handler(source, ctx ?? {});
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run test/unit/migrations.test.mjs`
Expected: PASS.

- [ ] **Step 5: Remove the setting and its false exception**

In `module/settings.mjs`, delete the line:

```js
  s("schemaVersion", { config: false, type: String, default: "" });
```

In `test/unit/settings-are-read.test.mjs`, delete from `NOT_READ_BY_CODE`:

```js
  // Written by the release stamper and read by the migration guard on load,
  // which reaches it through a variable rather than a literal.
  "schemaVersion",
```

That comment described a migration guard that had never existed. The version now lives on `world.flags.fgt.schemaVersion`, where §39.1 says it does.

- [ ] **Step 6: Run everything**

Run: `npm test && npm run lint`
Expected: all PASS. If any code reads `game.settings.get("fgt", "schemaVersion")`, it must move to the flag — but grep says nothing does:
`grep -rn "schemaVersion" module/ | grep -v migration`

- [ ] **Step 7: Commit**

```bash
git add module/migration/migrations.mjs test/unit/migrations.test.mjs module/settings.mjs test/unit/settings-are-read.test.mjs
git commit -F - <<'EOF'
feat(migration): the schema version axis, and a list to hang migrations on

`schemaVersion` was a setting with a default of "" that nothing read -- and it
sat in `settings-are-read.test.mjs`'s exception set claiming it was "read by the
migration guard on load". There was no migration guard. That exception
documented a reader which had never existed, which is the one thing that file is
for. Both are gone; the version lives on `world.flags.fgt.schemaVersion`, where
§39.1 says it does.

The list is empty. The axis exists so the FIRST shape change has somewhere to
go: adding this machinery at that moment, under pressure, is how worlds get
corrupted. Every handler must be idempotent and a test holds each shipped entry
to it, because a runner that fails partway through is re-run against data some
of which is already migrated.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NJXzEHEgrcNbP3ChB6tiPN
EOF
```

---

### Task 5: The runners

Both walkers, together: they share the version flag, the backup call and the report, and splitting them would duplicate all three.

**Files:**
- Create: `module/migration/runner.mjs`
- Modify: `module/fgt.mjs` (or wherever `Hooks.once("ready")` lives — find with `grep -rn 'Hooks.once("ready"' module/`)
- Modify: `lang/en.json`

**Interfaces:**
- Consumes: `SCHEMA_VERSION`, `pendingFrom`, `applyMigration` (Task 4); `collectWorldDocuments`, `writeBackup` (Task 3); `reconcileSystem`, `reconcileItems` (Task 2).
- Produces: `migrateWorld() → Promise<object>`, `syncContent({dryRun}) → Promise<object>`, `onReady() → Promise<void>`.

- [ ] **Step 1: Write the runner**

Create `module/migration/runner.mjs`:

```js
/**
 * @file Applying migrations and content sync to a live world.
 * @see docs/39-migration-and-versioning.md, docs/superpowers/specs/2026-09-09-migration-design.md
 *
 * Layer 4. The impure half: this walks the world and writes. Every judgement it
 * makes comes from `migrations.mjs` and `content-sync.mjs`, which are pure and
 * tested without a world.
 *
 * GM only. Two clients migrating one world at the same time is a corrupted
 * world, and Foundry gives no lock to prevent it -- so the guard is that only
 * one client is allowed to try.
 */

import { SCHEMA_VERSION, pendingFrom, applyMigration } from "./migrations.mjs";
import { collectWorldDocuments, writeBackup } from "./backup.mjs";
import { reconcileSystem, reconcileItems } from "./content-sync.mjs";

/** Where §39.1 says the schema version lives. */
const VERSION_FLAG = "schemaVersion";

/**
 * The world's recorded schema version.
 *
 * A world with none recorded is treated as CURRENT rather than as zero. This
 * ships into worlds that predate it, and replaying every future migration
 * against data that never needed them would be a fabricated history.
 *
 * @returns {number}
 */
function worldVersion() {
  const recorded = game.world.flags?.fgt?.[VERSION_FLAG];
  return Number.isInteger(recorded) ? recorded : SCHEMA_VERSION;
}

/**
 * Apply every pending schema migration, backing the world up first.
 *
 * @returns {Promise<{ran: boolean, from?: number, to?: number, touched?: number, backup?: string}>}
 */
export async function migrateWorld() {
  const from = worldVersion();
  const pending = pendingFrom(from);
  if (pending.length === 0) return { ran: false };

  // D39.3: non-negotiable, and a failed backup ABORTS. There is no
  // "continue anyway" -- migrations are the highest-risk thing this system does.
  const backup = await writeBackup(collectWorldDocuments(), "schema");

  const ctx = { globalTurn: game.combats.active?.system?.globalTurn ?? 0 };
  let touched = 0;

  for (const entry of pending) {
    for (const actor of game.actors) {
      const source = actor.toObject();
      const next = applyMigration(entry, "actor", source, ctx);
      if (next !== source) { await actor.update(next, { diff: false, recursive: false }); touched += 1; }
    }
    for (const item of game.items) {
      const source = item.toObject();
      const next = applyMigration(entry, "item", source, ctx);
      if (next !== source) { await item.update(next, { diff: false, recursive: false }); touched += 1; }
    }
    for (const scene of game.scenes) {
      const source = scene.toObject();
      const next = applyMigration(entry, "scene", source, ctx);
      if (next !== source) { await scene.update(next, { diff: false, recursive: false }); touched += 1; }
    }
    for (const combat of game.combats) {
      const source = combat.toObject();
      const next = applyMigration(entry, "combat", source, ctx);
      if (next !== source) { await combat.update(next, { diff: false, recursive: false }); touched += 1; }
    }
    console.log(`FGT | Migrated to schema ${entry.to}: ${entry.description}`);
  }

  await game.world.setFlag("fgt", VERSION_FLAG, SCHEMA_VERSION);
  return { ran: true, from, to: SCHEMA_VERSION, touched, backup: backup.path };
}

/**
 * Reconcile every world document against its pack document.
 *
 * The compendium is the whole source of truth (spec R1). A document with no
 * `contentId` is not pack content and is left entirely alone; one whose content
 * has been deleted from the packs is reported rather than mutated, because a
 * missing template is a GM's problem and not a thing to guess about.
 *
 * @param {{dryRun?: boolean}} [options]
 * @returns {Promise<{changed: object[], skipped: object[]}>}
 */
export async function syncContent({ dryRun = false } = {}) {
  const templates = await loadTemplates();
  const changed = [];
  const skipped = [];

  for (const actor of game.actors) {
    const contentId = actor.system?.contentId ?? null;
    if (!contentId) continue;

    const template = templates.get(contentId);
    if (!template) { skipped.push({ name: actor.name, contentId, why: "no template in any pack" }); continue; }

    const system = reconcileSystem("actor", actor.toObject().system, template.system);
    const items = reconcileItems(actor.items.map((i) => i.toObject()), template.items);

    const systemChanged = JSON.stringify(system) !== JSON.stringify(actor.toObject().system);
    const itemsChanged = items.create.length > 0 || items.remove.length > 0
      || items.update.some((u) => {
        const held = actor.items.get(u._id);
        return held && JSON.stringify(u.system) !== JSON.stringify(held.toObject().system);
      });
    if (!systemChanged && !itemsChanged) continue;

    changed.push({
      name: actor.name, contentId,
      system: systemChanged,
      created: items.create.map((i) => i.system.contentId),
      removed: items.remove.length,
      refreshed: items.update.length,
    });
    if (dryRun) continue;

    if (systemChanged) await actor.update({ system }, { diff: false, recursive: false });
    if (items.remove.length) await actor.deleteEmbeddedDocuments("Item", items.remove);
    if (items.update.length) await actor.updateEmbeddedDocuments("Item", items.update, { diff: false });
    if (items.create.length) await actor.createEmbeddedDocuments("Item", items.create);
  }

  return { changed, skipped };
}

/**
 * Every pack document that world content could be an instance of, by contentId.
 *
 * @returns {Promise<Map<string, {system: object, items: object[]}>>}
 */
async function loadTemplates() {
  const out = new Map();
  for (const pack of game.packs) {
    if (pack.metadata.packageName !== "fgt") continue;
    if (pack.documentName !== "Actor") continue;
    for (const doc of await pack.getDocuments()) {
      const contentId = doc.system?.contentId;
      if (!contentId) continue;
      const obj = doc.toObject();
      out.set(contentId, { system: obj.system, items: obj.items ?? [] });
    }
  }
  return out;
}

/**
 * The `ready` entry point: migrate, then sync, then say what happened.
 *
 * Order matters. A migration fixes the SHAPE of stored data and the sync then
 * reconciles its CONTENT; running the sync first would reconcile against a
 * shape the pack no longer uses.
 *
 * @returns {Promise<void>}
 */
export async function onReady() {
  if (!game.user.isGM) return;
  if (!game.users.activeGM?.isSelf) return;   // exactly one client, never two

  try {
    const migrated = await migrateWorld();
    if (migrated.ran) {
      ui.notifications.info(game.i18n.format("FGT.Migration.Ran", {
        from: migrated.from, to: migrated.to, n: migrated.touched,
      }));
      console.log(`FGT | Backup written to ${migrated.backup}`);
    }

    const synced = await syncContent();
    if (synced.changed.length > 0) {
      ui.notifications.info(game.i18n.format("FGT.Migration.Synced", { n: synced.changed.length }));
      console.log("FGT | Content sync:", synced.changed);
    }
    if (synced.skipped.length > 0) console.warn("FGT | Content sync skipped:", synced.skipped);
  } catch (err) {
    // Loud. A half-migrated world that boots quietly is worse than one that
    // refuses to, and the backup path is in the log above.
    console.error("FGT | Migration failed:", err);
    ui.notifications.error(game.i18n.localize("FGT.Migration.Failed"), { permanent: true });
  }
}
```

- [ ] **Step 2: Add the three strings**

In `lang/en.json`:

```json
  "FGT.Migration.Ran": "F/GT: migrated world data from schema {from} to {to} ({n} documents). A backup was written to the world folder.",
  "FGT.Migration.Synced": "F/GT: refreshed {n} document(s) from the compendium.",
  "FGT.Migration.Failed": "F/GT: migration failed. See the console — your world was backed up first and has not been fully migrated.",
```

- [ ] **Step 3: Call it on ready**

The hook is at `module/fgt.mjs:236` and it is **not async**:

```js
Hooks.once("ready", () => {
```

Make it `async () => {` and put the migration **first**, before `Scheduler.attach()` and the rest —
those read world data, and they must not read it half-migrated:

```js
Hooks.once("ready", async () => {
  // Ch. 39, and FIRST in this callback: the shape of stored data, then its
  // content, before anything below reads either. GM-only and single-client,
  // because two clients migrating one world is a corrupted world.
  const { onReady: migrateOnReady } = await import("./migration/runner.mjs");
  await migrateOnReady();

  // GM client only; a no-op everywhere else.
  Scheduler.attach();
  // ... the rest unchanged
```

Foundry does not await hook callbacks, so this does not block other systems'
`ready` handlers — it only orders the work inside this one. That is the standard
Foundry migration placement and the best available without a bespoke gate.

- [ ] **Step 4: Run everything**

Run: `npm test && npm run lint && node tools/check-layers.mjs`
Expected: all PASS.

- [ ] **Step 5: Verify live — dry run first**

The world is full of real data. Look before writing:

```bash
node tools/fgt-eval.mjs "
const { syncContent } = await import('/systems/fgt/module/migration/runner.mjs');
const out = await syncContent({ dryRun: true });
return JSON.stringify({ changed: out.changed.slice(0, 8), changedCount: out.changed.length,
  skipped: out.skipped.slice(0, 8), skippedCount: out.skipped.length }, null, 1)"
```

Read the output. Every entry should be something you can explain. Anything surprising — a Servant losing items, a document you expected untouched — **stop and investigate before running it for real.**

- [ ] **Step 6: Verify live — the real thing**

Capture the state that must survive, run it, compare:

```bash
node tools/fgt-eval.mjs "
const before = [...game.actors].filter(a => a.system?.contentId).map(a => ({
  n: a.name, hp: a.system.health?.value, master: a.system.masterId ?? null,
  items: a.items.size, cds: a.items.map(i => i.system?.cooldown?.remaining ?? 0).join(','),
}));
const { syncContent } = await import('/systems/fgt/module/migration/runner.mjs');
const out = await syncContent();
await new Promise(r => setTimeout(r, 1500));
const after = [...game.actors].filter(a => a.system?.contentId).map(a => ({
  n: a.name, hp: a.system.health?.value, master: a.system.masterId ?? null,
  items: a.items.size, cds: a.items.map(i => i.system?.cooldown?.remaining ?? 0).join(','),
}));
const moved = before.filter((b, i) => JSON.stringify(b) !== JSON.stringify(after[i]));
return JSON.stringify({ changed: out.changed.length, healthOrContractMoved: moved }, null, 1)"
```

Expected: `healthOrContractMoved` is **empty** except for item counts where the template genuinely added or removed one. Health, contracts and cooldowns must be identical.

- [ ] **Step 7: Verify live — it is idempotent**

Run the sync a second time. Expected: `changed: 0`. A sync that keeps finding work is a sync that is fighting itself.

- [ ] **Step 8: Document and commit**

Update `docs/39-migration-and-versioning.md`: §39.1/§39.2 (the axis and runner exist, the flag is the home), §39.6 and D39.6 (**replaced** by R1, with the reasoning), §39.9 (the checklist gains the sync step), and §7's limitation — content sync can change a Servant mid-match, so rebuild packs between sessions until rule-version pinning exists.

```bash
git add module/migration/runner.mjs module/fgt.mjs lang/en.json docs/39-migration-and-versioning.md
git commit -F - <<'EOF'
feat(migration): the runners, and the compendium becomes the source of truth

Ch. 39 D39.6 said a world copy is never auto-updated and the GM chooses from a
diff. That is replaced: the compendium is the whole source of truth, world
copies are reconciled to it on load, and the ability editor gains a way to write
authoring back to the pack source so nothing of value lives only in a world.

The shape first, then the content: a migration fixes how data is stored and the
sync then reconciles what it says, so running the sync first would reconcile
against a shape the pack no longer uses.

GM-only and single-client. Two clients migrating one world is a corrupted world
and Foundry offers no lock, so the guard is that only one client tries.

Fourteen Masters needed a hand-written script yesterday. They will not again.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NJXzEHEgrcNbP3ChB6tiPN
EOF
```

---

### Task 6: `contentVersion` in the pipeline

Small, and it earns its place: it is what lets a report say *which* version a document came from rather than only that it differed.

**Files:**
- Modify: `tools/lib/content.mjs` (`itemSystem`, `actorSystem`)
- Modify: `module/content/authored-fields.mjs`
- Modify: `module/data/actor/_shared.mjs` and `module/data/item/ability.mjs`
- Test: `test/unit/authored-fields.test.mjs`

**Interfaces:**
- Consumes: Task 1's key sets.
- Produces: `system.contentVersion: number|null` on actors and items.

- [ ] **Step 1: Declare it on the models**

In `module/data/item/ability.mjs`'s `abilityCommon()`, and in the shared actor schema (`module/data/actor/_shared.mjs` — find the shared block with `grep -n "contentId" module/data/actor/_shared.mjs`):

```js
      // Which revision of the authored content this document came from
      // (Ch. 39 §39.6). Written by the pack builder, read by the sync's report
      // so it can say what a document moved FROM rather than only that it moved.
      contentVersion: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
```

- [ ] **Step 2: Carry it through the pipeline**

In `tools/lib/content.mjs`, add to both `actorSystem()` and `itemSystem()`:

```js
    contentVersion: doc.contentVersion ?? null,
```

- [ ] **Step 3: Add it to the vocabulary**

Add `"contentVersion"` to both `AUTHORED_ACTOR_KEYS` and `AUTHORED_ITEM_KEYS` in `module/content/authored-fields.mjs`. Do **not** add it to `SEEDED_THEN_OWNED` — it is the pack's, entirely, and a world copy claiming a version the pack never issued is exactly the confusion this field exists to end.

- [ ] **Step 4: Run everything**

Run: `npm test && npm run lint`
Expected: PASS, including the drift test from Task 1, which is what will catch it if you added the key to one side only.

- [ ] **Step 5: Rebuild and verify live**

Run: `npm run validate:content && node tools/fgt-rebuild.mjs`

Then confirm a pack document carries it and the sync reports it:

```bash
node tools/fgt-eval.mjs "
const pack = game.packs.get('fgt.servants');
const idx = await pack.getIndex({ fields: ['system.contentId','system.contentVersion'] });
return JSON.stringify(idx.contents.slice(0, 5).map(e => e.system?.contentId + '@v' + (e.system?.contentVersion ?? 'null')), null, 1)"
```

Expected: every entry reads `@vnull` until content states a version — the field exists and is empty, which is correct. Author one to prove the path: add `contentVersion: 1` to `packs/_source/servants/ozymandias.yml`, rebuild, and confirm it reads `@v1`.

- [ ] **Step 6: Document and commit**

Record `contentVersion` in `docs/37-content-pipeline.md` beside `schema:`.

```bash
git add -A
git commit -F - <<'EOF'
feat(migration): contentVersion in the pipeline

§39.6 asks for it and the pipeline never carried it. It is what lets the sync's
report say which revision a document came FROM rather than only that it
differed -- the difference between "14 documents changed" and a line a GM can
act on.

The pack's entirely, never seeded: a world copy claiming a version the pack
never issued is the confusion this field exists to end.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NJXzEHEgrcNbP3ChB6tiPN
EOF
```

---

### Task 7: The way home — export to YAML

What makes R1 safe rather than lossy. Without this the ability editor's output is destroyed by the sync built in Task 5, and §29.6's SC-6 — *"a GM authors a Karna-complexity Servant in under an hour"* — becomes meaningless.

**Files:**
- Create: `module/apps/yaml-export.mjs`
- Create: `test/unit/yaml-export.test.mjs`
- Modify: `module/apps/ability-editor.mjs`
- Modify: `lang/en.json`

**`module/` cannot import `yaml`.** There are **zero** bare-specifier imports anywhere under
`module/` and no bundler in `package.json`'s scripts — browser ES modules cannot resolve `"yaml"`,
so `import { stringify } from "yaml"` throws the moment a GM presses the button. The invariant is
deliberate and this task keeps it.

So the export is **two honest steps instead of one dishonest one**: the browser writes the authored
*shape* as JSON, which needs no dependency, and a Node-side tool — where `yaml` already lives, at
`^2.6.0` — turns staged JSON into the `.yml` the loader reads. The round-trip test lives on the Node
side, where both formats are available.

**Interfaces:**
- Consumes: `AUTHORED_ITEM_KEYS`, `SEEDED_THEN_OWNED` (Task 1).
- Produces: `toAuthoredSource(item) → object` (browser, pure), `exportItem(item) → Promise<{path: string}|null>` (browser), and `tools/stage-to-yaml.mjs` (Node).

- [ ] **Step 1: Write the failing test**

Create `test/unit/yaml-export.test.mjs`:

```js
/**
 * @file Writing a document back to its pack source.
 * @see module/apps/yaml-export.mjs, docs/29-user-interface.md §29.6
 *
 * The compendium is the whole source of truth (spec R1), which is only safe
 * because authoring has somewhere to go. Without this the ability editor's
 * output is overwritten on the next load and SC-6 -- "a GM authors a
 * Karna-complexity Servant in under an hour" -- means nothing.
 */

import { describe, it, expect } from "vitest";
import { parse } from "yaml";
import { readFileSync } from "node:fs";
// The browser half is dependency-free and only produces the authored SHAPE.
import { toAuthoredSource } from "../../module/apps/yaml-export.mjs";
// The Node half turns that shape into YAML, where `yaml` is available.
import { shapeToYaml } from "../../tools/stage-to-yaml.mjs";

const itemLike = (system) => ({ name: "Test", system });

describe("toAuthoredSource", () => {
  it("keeps the authored fields", () => {
    const out = toAuthoredSource(itemLike({ contentId: "x", rank: "A", npGateRound: 3 }));
    expect(out).toMatchObject({ id: "x", rank: "A", npGateRound: 3 });
  });

  it("drops runtime state", () => {
    // A cooldown mid-tick is not content. Exporting it would author a Servant
    // that starts the game four Turns into its own clock.
    const out = toAuthoredSource(itemLike({
      contentId: "x", cooldown: { max: "3◈", remaining: 4, gatedDelay: 2 },
      timesUsed: 7, expended: true,
    }));
    expect(out.cooldown).toEqual({ max: "3◈" });
    expect(out.timesUsed).toBeUndefined();
    expect(out.expended).toBeUndefined();
  });

  it("drops empty and null fields rather than writing noise", () => {
    const out = toAuthoredSource(itemLike({ contentId: "x", npTags: [], category: null }));
    expect(out.npTags).toBeUndefined();
    expect(out.category).toBeUndefined();
  });

  it("writes the schema line the loader requires", () => {
    expect(toAuthoredSource(itemLike({ contentId: "x" })).schema).toBe(1);
  });
});

describe("shapeToYaml", () => {
  it("produces something the YAML parser reads back", () => {
    const yaml = shapeToYaml(toAuthoredSource(itemLike({ contentId: "x", rank: "A", npTags: ["antiUnit"] })));
    expect(parse(yaml)).toMatchObject({ schema: 1, id: "x", rank: "A", npTags: ["antiUnit"] });
  });
});

describe("round trip", () => {
  it("an authored file survives load -> export -> load", () => {
    // The exporter is the inverse of the loader, and this is what that means.
    const source = parse(readFileSync("packs/_source/abilities/ozymandias-imperial-privilege.yml", "utf8"));
    const asItem = itemLike({
      contentId: source.id, rank: source.rank, kind: source.kind, slug: source.slug,
      cooldown: source.cooldown, description: source.description, phases: source.phases,
      timing: source.timing,
    });
    const round = parse(shapeToYaml(toAuthoredSource(asItem)));
    expect(round.id).toBe(source.id);
    expect(round.phases).toEqual(source.phases);
    expect(round.cooldown).toEqual(source.cooldown);
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run test/unit/yaml-export.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the exporter**

Create `module/apps/yaml-export.mjs`:

```js
/**
 * @file Writing a document back to its pack source.
 * @see docs/29-user-interface.md §29.6, docs/39-migration-and-versioning.md
 *
 * Layer 4.
 *
 * The inverse of `tools/lib/content.mjs`'s loader, and the reason the
 * compendium can be the whole source of truth without that costing a GM their
 * authoring: work done in the ability editor goes back to
 * `packs/_source/**.yml`, becomes a pack change, and returns through the
 * ordinary sync.
 *
 * What it must NOT export is as important as what it must: a cooldown with four
 * Turns left on it is not content, and authoring it would ship a Servant that
 * starts the game part-way into its own clock.
 */

import { AUTHORED_ITEM_KEYS, SEEDED_THEN_OWNED } from "../content/authored-fields.mjs";

/** Cooldown fields that belong to a match rather than to the content. */
const COOLDOWN_RUNTIME = ["remaining", "regen", "gatedDelay"];

/** Runtime fields the allowlist happens to name (Ch. 39, spec R2). */
const RUNTIME = new Set([...SEEDED_THEN_OWNED.item, "expended"]);

/**
 * Is this value worth writing to a source file?
 *
 * An empty array or a null reads as a statement in YAML -- "this ability has no
 * tags" rather than "this ability says nothing about tags" -- and the loader
 * treats absence and emptiness identically. So absence is the honest form.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function worthWriting(value) {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

/**
 * A document as its pack source would state it.
 *
 * @param {object} item an ability Item, or anything with `{name, system}`
 * @returns {object}
 */
export function toAuthoredSource(item) {
  const system = item?.system ?? {};
  /** @type {Record<string, unknown>} */
  const out = { schema: 1 };

  // `contentId` is `id` in the source vocabulary -- the loader's own naming,
  // and `documentId()` derives the Foundry id from it.
  if (system.contentId) out.id = system.contentId;
  if (item?.name) out.name = item.name;

  for (const key of AUTHORED_ITEM_KEYS) {
    if (key === "contentId" || RUNTIME.has(key)) continue;

    let value = system[key];

    if (key === "cooldown" && value && typeof value === "object") {
      value = Object.fromEntries(
        Object.entries(value).filter(([k, v]) => !COOLDOWN_RUNTIME.includes(k) && worthWriting(v)),
      );
    }

    if (worthWriting(value)) out[key] = value;
  }

  return out;
}

/**
 * Stage it for the pack source, or hand it to the GM as a download.
 *
 * **JSON, not YAML.** Nothing under `module/` imports an npm package -- there
 * are zero bare-specifier imports and no bundler -- so the browser cannot reach
 * the `yaml` library, and hand-rolling an emitter for a format this full of
 * edge cases would be a bug generator. The browser writes the authored shape;
 * `tools/stage-to-yaml.mjs` turns it into the `.yml` the loader reads, on the
 * side where `yaml` already lives.
 *
 * The upload is attempted first because a staged file is one command from being
 * content -- but an install that refuses uploads must not lose the work, so the
 * download is a fallback rather than the plan.
 *
 * @param {object} item
 * @returns {Promise<{path: string}|null>}
 */
export async function exportItem(item) {
  const json = JSON.stringify(toAuthoredSource(item), null, 2);
  const name = `${item.system?.contentId ?? "ability"}.export.json`;

  try {
    const file = new File([json], name, { type: "application/json" });
    const result = await foundry.applications.apps.FilePicker.implementation
      .upload("data", "systems/fgt/packs/_staged", file, {}, { notify: false });
    if (result?.path) {
      ui.notifications.info(game.i18n.format("FGT.Export.Written", { path: result.path }));
      return { path: result.path };
    }
  } catch (err) {
    console.warn("FGT | Staging upload refused, falling back to download:", err);
  }

  foundry.utils.saveDataToFile(json, "application/json", name);
  ui.notifications.info(game.i18n.format("FGT.Export.Downloaded", { name }));
  return null;
}
```

- [ ] **Step 4: Write the Node half**

Create `tools/stage-to-yaml.mjs`:

```js
/**
 * @file Turn a staged export into pack source.
 * @see module/apps/yaml-export.mjs, docs/29-user-interface.md §29.6
 *
 * The other half of the ability editor's way home. The browser writes the
 * authored shape as JSON because nothing under `module/` may import an npm
 * package; this runs in Node, where `yaml` already lives, and produces the
 * `.yml` the content loader reads.
 *
 * Usage: `node tools/stage-to-yaml.mjs [--dir packs/_staged]`
 */

import { readdirSync, readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { stringify } from "yaml";

/**
 * One authored shape as the YAML a pack source file holds.
 *
 * @param {object} shape the object `toAuthoredSource` produced
 * @returns {string}
 */
export function shapeToYaml(shape) {
  return stringify(shape, { lineWidth: 100 });
}

/**
 * Where a document of this kind belongs under `packs/_source/`.
 *
 * Read off the shape rather than guessed from the id: an ability and a Noble
 * Phantasm both live in `abilities/`, and a Servant does not.
 *
 * @param {object} shape
 * @returns {string}
 */
export function destinationFor(shape) {
  if (shape.kind === "servant" || shape.servantClasses) return "servants";
  if (shape.kind === "summon") return "summons";
  return "abilities";
}

/** @returns {void} */
function main() {
  const dirArg = process.argv.indexOf("--dir");
  const staged = dirArg > -1 ? process.argv[dirArg + 1] : "packs/_staged";
  if (!existsSync(staged)) {
    console.log(`FGT | Nothing staged (${staged} does not exist).`);
    return;
  }

  const files = readdirSync(staged).filter((f) => f.endsWith(".export.json"));
  if (files.length === 0) {
    console.log("FGT | Nothing staged.");
    return;
  }

  for (const file of files) {
    const shape = JSON.parse(readFileSync(join(staged, file), "utf8"));
    const out = join("packs/_source", destinationFor(shape), `${shape.id}.yml`);
    writeFileSync(out, shapeToYaml(shape), "utf8");
    unlinkSync(join(staged, file));
    console.log(`FGT | ${file} -> ${out}`);
  }
  console.log(`FGT | ${files.length} staged export(s) written. Run 'npm run validate:content' next.`);
}

// Only when run directly, so the tests can import `shapeToYaml` without it
// scanning a directory.
if (process.argv[1]?.endsWith("stage-to-yaml.mjs")) main();
```

Add the script to `package.json`:

```json
    "stage:yaml": "node tools/stage-to-yaml.mjs",
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run test/unit/yaml-export.test.mjs && npm run lint`
Expected: PASS. The round-trip test is the one that matters: an authored file must
survive load → shape → YAML → load unchanged.

- [ ] **Step 6: Add the button**

In `module/apps/ability-editor.mjs`, add an action that calls `exportItem(this.#item)`. Follow whatever action pattern the file already uses — find it with `grep -n "static DEFAULT_OPTIONS" -A 15 module/apps/ability-editor.mjs`.

Add to `lang/en.json`:

```json
  "FGT.Export.Action": "Export to pack source",
  "FGT.Export.Written": "Staged at {path}. Run 'npm run stage:yaml' then rebuild packs to publish it.",
  "FGT.Export.Downloaded": "Downloaded {name}. Put it in packs/_staged/ and run 'npm run stage:yaml'.",
```

- [ ] **Step 7: Verify live — the whole round trip**

This is the task's real test, and it is the loop R1 depends on:

1. Open a Servant's sheet in the world, click ✎ on an ability, change something visible (a cooldown's `max`, say).
2. Press **Export**. Confirm a `.export.json` appears in `packs/_staged/`.
3. `npm run stage:yaml` — confirm it writes `packs/_source/abilities/<id>.yml` and clears the staging file.
4. `npm run validate:content` — it must pass, because that output is content now.
5. `node tools/fgt-rebuild.mjs`.
6. Confirm the change came back through the pack and the sync, and that the Servant's Health and cooldowns are untouched.

- [ ] **Step 8: Document and commit**

Record the export in `docs/29-user-interface.md` §29.6 and what it means for SC-6, including the
two-step shape and why: `module/` holds no npm imports, so the browser writes JSON and Node writes
YAML.

```bash
git add -A
git commit -F - <<'EOF'
feat(migration): the ability editor's way home

The compendium being the whole source of truth is only safe because authoring
has somewhere to go. Without this the editor's output is overwritten on the next
load, and §29.6's SC-6 -- "a GM authors a Karna-complexity Servant in under an
hour" -- means nothing, because the hour's work does not survive a pack rebuild.

The exporter is the inverse of the loader, and a round-trip test says so: an
authored file survives load -> export -> load unchanged.

What it refuses to export matters as much: a cooldown with four Turns left is
not content, and authoring it would ship a Servant that starts the game part-way
into its own clock.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NJXzEHEgrcNbP3ChB6tiPN
EOF
```

---

### Task 8: The whole thing, in a live world

No new code. Ch. 39's own §39.9 step 7 — *"the one teams skip and regret"* — is testing migration against a real world, and this is that.

**Files:** `docs/45-implementation-status.md`, `docs/39-migration-and-versioning.md`

- [ ] **Step 1: Prove the Master case is closed**

The bug that started this. Add a field to `packs/_source/abilities/normal-magic-crest.yml` (a `description` word will do), rebuild, reload the world, and confirm all fourteen Masters carry it **without a hand-written script**.

- [ ] **Step 2: Prove a match survives**

With a combat active and Servants damaged, mid-cooldown and contracted:

1. Record Health, contracts, cooldown remainders, Resources, `turnState` and any active toggles.
2. Rebuild packs with a real content change.
3. Reload.
4. Confirm the content change arrived **and every recorded value is unchanged.**

- [ ] **Step 3: Prove provenance survives**

Grant a copied Noble Phantasm (Wisdom of Dún Scáith), run a sync, confirm the copy is still there. This is spec R4 and the thing a naive sync destroys.

- [ ] **Step 4: Prove the backup exists**

Confirm a file in `worlds/fgt2026/fgt-backups/`, that it parses as JSON, and that its actor count matches the world.

- [ ] **Step 5: Prove it is quiet when there is nothing to do**

Reload with no pack change. Expected: no notification, no writes, no log noise. The common path must cost nothing.

- [ ] **Step 6: Write the record**

Write the `docs/45` entry in the style of the other **built** entries — naming what was measured rather than what the tests assert — and confirm §39.6/D39.6 read as replaced rather than contradicted.

- [ ] **Step 7: Commit**

```bash
git add docs/
git commit -F - <<'EOF'
docs(migration): measured in a live world

§39.9 step 7 is "the one teams skip and regret": testing migration against a
real world rather than a fixture. Fourteen Masters take a content change without
a hand-written script; a match in progress keeps its Health, contracts,
cooldowns, Resources and toggles across a pack rebuild; a Noble Phantasm copied
by Wisdom of Dun Scaith survives a sync; the backup is a real file that parses;
and a world with nothing to do says nothing at all.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NJXzEHEgrcNbP3ChB6tiPN
EOF
```

---

## Self-review

**Spec coverage.** §1 (what is wrong) → Tasks 4 and 5. §2 scope → all tasks; C deferred and named in Task 5 Step 8. R1 → Task 5. R2 → Tasks 1 and 2. R3 → Task 7. R4 → Task 2 (`reconcileItems`, provenance) and Task 8 Step 3. R5 → Task 3. §4.1 vocabulary → Task 1. §4.2 schema → Tasks 3, 4, 5. §4.3 sync → Tasks 2, 5, 6. §4.4 way home → Task 7. §5 (not built) → nothing claims a diff UI or compendium migration. §6 testing → every task, plus Task 8. §7 limitation → Task 5 Step 8. §8 chapters → Tasks 5, 6, 7, 8.

**Type consistency.** `ownedByWorld(kind, key)` is defined in Task 1 and called in Task 2. `reconcileSystem(kind, worldSystem, packSystem)` and `reconcileItems(worldItems, packItems)` are defined in Task 2 and called in Task 5 with those exact argument orders. `SEEDED_THEN_OWNED.item` is read in Tasks 2 and 7. `COOLDOWN_OWNED_BY_WORLD` is used in Task 2 and mirrored as `COOLDOWN_RUNTIME` in Task 7 — deliberately, because the exporter drops those fields while the sync preserves them, and one constant serving both would read as though they did the same thing.

**One thing an executor must not do.** Task 5 Step 5 is a dry run against a world with real data in it. Do not skip it, and do not run Step 6 until every line of the dry run's output is something you can explain. The sync writes to actors a GM has been playing with.
