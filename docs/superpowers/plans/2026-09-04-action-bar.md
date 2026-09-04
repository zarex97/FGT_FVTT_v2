# Action Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the overflowing token HUD with a bottom-centre action bar, and make the three action kinds that have no caller (`mark`, `gather`, `ridingAttack`) reachable.

**Architecture:** A pure layer-2 registry declares every unit action with an availability predicate over a unit snapshot. A thin layer-3 dispatcher maps each id to its existing engine function. A pure view-model turns a snapshot into rows and slot states. An `ApplicationV2` renders that view-model and dispatches clicks. A drift test holds the registry against `budget.mjs`'s `ActionKind` union so a future action cannot go unreachable.

**Tech Stack:** Foundry VTT v14, `ApplicationV2` + `HandlebarsApplicationMixin`, vanilla ES modules, Handlebars, Sass, vitest.

**Spec:** `docs/superpowers/specs/2026-09-04-action-bar-design.md`

## Global Constraints

- Layer boundary `domain → rules → engine → apps`, enforced by `npm run lint` via `tools/check-layers.mjs`. `module/rules` may import only `domain` and `rules`. `module/engine` may import `domain, rules, data, documents, net`. `module/apps` may import anything.
- `module/domain` and `module/rules` must never touch Foundry globals (`game`, `canvas`, `ui`, `Hooks`).
- Every user-facing string is an i18n key in `lang/en.json`. No literal English in a template or module.
- A refusal is never a silent no-op: surface the reason.
- Tests are vitest, under `test/unit/`, and must pass with `npm test`.
- Full gate before any commit is considered done: `npm run lint && npm test && npm run check:templates`.
- Every task that changes behaviour also updates the chapter in `docs/` that describes it, not only `docs/45-implementation-status.md`.

---

### Task 1: Project the field geometry onto the snapshot's abilities

The Mark predicate must ask whether a unit owns a Noble Phantasm built by marking. The snapshot's ability entries carry `contentId` but not the field geometry, so the predicate cannot be pure without this.

**Files:**
- Modify: `module/rules/snapshot.mjs` (inside `collectAbilities`, near line 1093)
- Test: `test/unit/snapshot.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: each entry of `unit.abilities` gains `fieldGeometryKind: string|null`, read from `item.system.field.geometry.kind`.

- [ ] **Step 1: Write the failing test**

Append to `test/unit/snapshot.test.mjs`:

```js
describe("abilities carry the geometry of the field they build", () => {
  const withNP = (geometryKind) => ({
    id: "m", uuid: "Actor.m", name: "Medusa", type: "servant",
    system: { factionId: "red", range: { panels: 1, targets: 1 } },
    items: [{
      id: "np1", name: "Blood Fort Andromeda", type: "noblePhantasm",
      system: { contentId: "medusa-blood-fort-andromeda", field: { geometry: { kind: geometryKind } } },
    }],
    effects: [],
  });

  it("reports markDefined so the Mark action can be offered", () => {
    // `rules/actions.mjs` decides whether to offer Mark from the snapshot
    // alone, and cannot reach the item document to ask.
    const u = snapshotUnit(withNP("markDefined"));
    expect(u.abilities[0].fieldGeometryKind).toBe("markDefined");
    expect(u.abilities[0].contentId).toBe("medusa-blood-fort-andromeda");
  });

  it("is null for an ability that builds no field", () => {
    const u = snapshotUnit({
      id: "m", uuid: "Actor.m", name: "M", type: "servant",
      system: { factionId: "red", range: { panels: 1, targets: 1 } },
      items: [{ id: "a1", name: "Skill", type: "ability", system: {} }],
      effects: [],
    });
    expect(u.abilities[0].fieldGeometryKind).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run test/unit/snapshot.test.mjs -t "abilities carry the geometry"`
Expected: FAIL, `expected undefined to be 'markDefined'`.

- [ ] **Step 3: Add the field**

In `module/rules/snapshot.mjs`, inside `collectAbilities`'s mapped object, immediately after the `contentId:` line:

```js
      contentId: i.system?.contentId ?? null,
      // The geometry of the field this ability BUILDS, if any. `rules/actions.mjs`
      // offers the Mark action from the snapshot alone and cannot reach the item
      // document to ask -- and "markDefined" is the whole test for whether this
      // Noble Phantasm is assembled rather than cast (Ch. 43 §43.4).
      fieldGeometryKind: i.system?.field?.geometry?.kind ?? null,
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run test/unit/snapshot.test.mjs -t "abilities carry the geometry"`
Expected: PASS, 2 tests.

- [ ] **Step 5: Run the whole gate**

Run: `npm run lint && npm test`
Expected: lint clean, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add module/rules/snapshot.mjs test/unit/snapshot.test.mjs
git commit -m "Project an ability's field geometry so a pure predicate can ask about it"
```

---

### Task 2: The action registry

**Files:**
- Create: `module/rules/actions.mjs`
- Test: `test/unit/actions.test.mjs`

**Interfaces:**
- Consumes: `unit.abilities[].fieldGeometryKind` and `.contentId` from Task 1; `hasGranted`/`GRANTS` from `module/rules/granted.mjs`; `relationOf(source, unit, board)` from `module/rules/relations.mjs`.
- Produces:
  - `UNIT_ACTIONS: ReadonlyArray<{id, kind, icon, label, mode, available}>`
  - `ACTION_EXEMPT_KINDS: ReadonlyArray<string>` — the kinds billed by ability buttons, not by an Actions entry.
  - `availableActions(unit, board): Array<{id, kind, icon, label, mode, context}>`
  - `context` is `{}` for actions needing no argument, `{abilityId}` for `mark`, `{ownerId}` for `gather`.

- [ ] **Step 1: Write the failing test**

Create `test/unit/actions.test.mjs`:

```js
/**
 * @file The unit-action registry.
 * @see module/rules/actions.mjs, docs/29-user-interface.md §29.5
 *
 * Three of `budget.mjs`'s eight ActionKinds had no caller anywhere in the
 * repository when this was written: `mark`, `gather` and `ridingAttack`. Each
 * engine was complete. The registry exists so that offering an action is a
 * table entry rather than a hand-written button somebody forgets to add.
 */
import { describe, it, expect } from "vitest";
import { UNIT_ACTIONS, ACTION_EXEMPT_KINDS, availableActions } from "../../module/rules/actions.mjs";

const unit = (over = {}) => ({
  id: "u1", kind: "servant", faction: "red",
  grantedAbilities: [], abilities: [], resources: {}, ...over,
});
const board = (units = [], over = {}) => ({ units, fields: [], ...over });
const idsFor = (u, b) => availableActions(u, b).map((a) => a.id);

describe("the always-available actions", () => {
  it("offers attack, move and facing to an ordinary unit", () => {
    expect(idsFor(unit(), board([unit()]))).toEqual(
      expect.arrayContaining(["attack", "move", "facing"]),
    );
  });

  it("withholds attack from a unit that cannot make one", () => {
    // Pale Rider: "cannot perform Normal Attacks." The grant already exists
    // and `engine/attack.mjs` already refuses; the button should not be there
    // to press in the first place.
    const pale = unit({ grantedAbilities: ["noNormalAttack"] });
    expect(idsFor(pale, board([pale]))).not.toContain("attack");
    expect(idsFor(pale, board([pale]))).toContain("move");
  });
});

describe("Mark (Ch. 43 §43.4)", () => {
  const medusa = () => unit({
    abilities: [{
      id: "np1", contentId: "medusa-blood-fort-andromeda", isNP: true,
      fieldGeometryKind: "markDefined",
    }],
  });

  it("is offered to a unit whose NP is built by marking, carrying the ability id", () => {
    const found = availableActions(medusa(), board([medusa()])).find((a) => a.id === "mark");
    expect(found).toBeDefined();
    expect(found.context).toEqual({ abilityId: "np1" });
    expect(found.kind).toBe("mark");
  });

  it("is withheld once the field it builds is already open", () => {
    // "Medusa cannot place new Bloodmarks while Bloodfort Andromeda is Active."
    const b = board([medusa()], { fields: [{ id: "medusa-blood-fort-andromeda" }] });
    expect(idsFor(medusa(), b)).not.toContain("mark");
  });

  it("is withheld from a unit with no such NP", () => {
    expect(idsFor(unit(), board([unit()]))).not.toContain("mark");
  });
});

describe("Gather (Ch. 32)", () => {
  const semiramis = () => unit({ id: "s1", resources: { hgobConstruction: { value: 0, max: null } } });
  const ally = () => unit({ id: "a1", faction: "red" });
  const foe = () => unit({ id: "e1", faction: "blue" });

  it("is offered to an ALLY because of who else is on the board", () => {
    // "Semiramis or any allied Unit can perform 'Gather'." The predicate is
    // board-dependent, which is why `available` takes the board.
    const found = availableActions(ally(), board([semiramis(), ally()])).find((a) => a.id === "gather");
    expect(found).toBeDefined();
    expect(found.context).toEqual({ ownerId: "s1" });
  });

  it("is offered to Semiramis herself", () => {
    expect(idsFor(semiramis(), board([semiramis()]))).toContain("gather");
  });

  it("is withheld when the only Construction owner is an enemy", () => {
    const enemyOwner = unit({ id: "s1", faction: "blue", resources: { hgobConstruction: { value: 0 } } });
    expect(idsFor(foe() && ally(), board([enemyOwner, ally()]))).not.toContain("gather");
  });

  it("is withheld when nobody on the board has Construction", () => {
    expect(idsFor(ally(), board([ally()]))).not.toContain("gather");
  });
});

describe("Riding Attack", () => {
  it("is offered only to a unit holding the grant", () => {
    const rider = unit({ grantedAbilities: ["ridingAttack"] });
    expect(idsFor(rider, board([rider]))).toContain("ridingAttack");
    expect(idsFor(unit(), board([unit()]))).not.toContain("ridingAttack");
  });

  it("is targeted, because it needs a destination", () => {
    const rider = unit({ grantedAbilities: ["ridingAttack"] });
    const found = availableActions(rider, board([rider])).find((a) => a.id === "ridingAttack");
    expect(found.mode).toBe("targeted");
  });
});

describe("the registry's shape", () => {
  it("gives every entry an id, kind, icon, label and mode", () => {
    for (const a of UNIT_ACTIONS) {
      expect(typeof a.id).toBe("string");
      expect(typeof a.icon).toBe("string");
      expect(a.label.startsWith("FGT.")).toBe(true);
      expect(["immediate", "targeted", "dial"]).toContain(a.mode);
      expect(typeof a.available).toBe("function");
    }
  });

  it("names the kinds that are billed by ability buttons instead", () => {
    expect([...ACTION_EXEMPT_KINDS].sort()).toEqual(["np", "skill", "spell"]);
  });

  it("survives a null unit rather than throwing", () => {
    expect(availableActions(null, board())).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run test/unit/actions.test.mjs`
Expected: FAIL, cannot resolve `module/rules/actions.mjs`.

- [ ] **Step 3: Write the registry**

Create `module/rules/actions.mjs`:

```js
/**
 * @file The unit-action registry — what a selected unit may DO, as data.
 * @see docs/29-user-interface.md §29.5, docs/18-action-economy.md §18.9
 *
 * Layer 2 (rules). Pure: every predicate reads a unit snapshot and the board,
 * never a document and never a Foundry global.
 *
 * This exists because three of `rules/budget.mjs`'s eight `ActionKind`s had no
 * caller anywhere in the repository — `mark`, `gather` and `ridingAttack` —
 * while all three engines were complete. Blood Fort Andromeda could not be
 * built, Semiramis's Construction could not be fed, and no Servant could ride
 * through a line, for want of a button. A hand-written HUD is where that
 * happens; a table plus a drift test (`test/unit/actions.test.mjs`) is where it
 * cannot.
 *
 * `available` returns a CONTEXT object rather than a boolean, because two of
 * these need an argument the predicate is already computing: Mark needs the id
 * of the Noble Phantasm the Bloodmarks belong to, and Gather needs the unit
 * whose Construction it feeds. Returning `null` means "do not offer".
 */

import { hasGranted, GRANTS } from "./granted.mjs";
import { relationOf } from "./relations.mjs";

/**
 * The `ActionKind`s billed by an ability button rather than by an entry here.
 *
 * Named rather than implied so the drift test can tell "deliberately not an
 * action button" from "somebody forgot", which is the exact distinction that
 * let three actions ship unreachable.
 */
export const ACTION_EXEMPT_KINDS = Object.freeze(["skill", "np", "spell"]);

/**
 * Every action a unit may take that is not the use of an ability.
 *
 * @type {ReadonlyArray<{
 *   id: string, kind: string|null, icon: string, label: string,
 *   mode: "immediate"|"targeted"|"dial",
 *   available: (unit: object, board: object) => object|null,
 * }>}
 */
export const UNIT_ACTIONS = Object.freeze([
  {
    id: "attack",
    kind: "attack",
    icon: "fa-solid fa-khanda",
    label: "FGT.Action.Attack",
    mode: "targeted",
    // Pale Rider's Riding EX: *"cannot perform Normal Attacks."* The grant is
    // already read by `engine/attack.mjs#resolveAttack`, which refuses the
    // declaration; withholding the button means he is never invited to try.
    available: (unit) => (unit && !hasGranted(unit, GRANTS.noNormalAttack) ? {} : null),
  },
  {
    id: "move",
    kind: "move",
    icon: "fa-solid fa-shoe-prints",
    label: "FGT.Action.Move",
    mode: "targeted",
    available: (unit) => (unit ? {} : null),
  },
  {
    id: "ridingAttack",
    kind: "ridingAttack",
    icon: "fa-solid fa-horse",
    label: "FGT.Action.RidingAttack",
    mode: "targeted",
    // Permanent for Achilles, unlocked by Riding's Active for Medusa. Either
    // way the GRANT is what says it is available, which is the whole reason
    // `granted.mjs` exists rather than a name-match on the Riding skill.
    available: (unit) => (unit && hasGranted(unit, GRANTS.ridingAttack) ? {} : null),
  },
  {
    id: "mark",
    kind: "mark",
    icon: "fa-solid fa-droplet",
    label: "FGT.Action.Mark",
    mode: "immediate",
    available: (unit, board) => {
      const np = (unit?.abilities ?? []).find((a) => a.fieldGeometryKind === "markDefined");
      if (!np) return null;
      // *"Medusa cannot place new Bloodmarks while Bloodfort Andromeda is
      // Active."* The field is keyed by the ability's content id, the same key
      // `engine/marks.mjs#placeMark` uses.
      const fieldId = np.contentId ?? np.id;
      if ((board?.fields ?? []).some((f) => f.id === fieldId)) return null;
      return { abilityId: np.id };
    },
  },
  {
    id: "gather",
    kind: "gather",
    icon: "fa-solid fa-hand-holding-hand",
    label: "FGT.Action.Gather",
    mode: "immediate",
    // *"Semiramis or any allied Unit can perform 'Gather'."* Board-dependent,
    // not unit-intrinsic: this button appears on an ally's bar because of who
    // ELSE is standing on the board.
    available: (unit, board) => {
      if (!unit) return null;
      const owner = (board?.units ?? []).find(
        (u) => u.resources?.hgobConstruction && relationOf(u, unit, board) !== "enemy",
      );
      return owner ? { ownerId: owner.id } : null;
    },
  },
  {
    id: "facing",
    kind: null,
    icon: "fa-solid fa-location-arrow",
    label: "FGT.Action.Facing",
    mode: "dial",
    // §29.5 is explicit that setting facing must not end the turn, so it bills
    // no ActionKind at all.
    available: (unit) => (unit ? {} : null),
  },
]);

/**
 * The actions this unit may take right now, in registry order.
 *
 * @param {object|null} unit a unit snapshot
 * @param {object} board
 * @returns {Array<{id: string, kind: string|null, icon: string, label: string, mode: string, context: object}>}
 */
export function availableActions(unit, board) {
  if (!unit) return [];
  const out = [];
  for (const action of UNIT_ACTIONS) {
    const context = action.available(unit, board);
    if (!context) continue;
    const { id, kind, icon, label, mode } = action;
    out.push({ id, kind, icon, label, mode, context });
  }
  return out;
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run test/unit/actions.test.mjs`
Expected: PASS, 13 tests.

- [ ] **Step 5: Add the i18n keys**

In `lang/en.json`, beside the other `FGT.HUD.*` entries:

```json
  "FGT.Action.Attack": "Attack",
  "FGT.Action.Move": "Move",
  "FGT.Action.RidingAttack": "Riding Attack",
  "FGT.Action.Mark": "Mark",
  "FGT.Action.Gather": "Gather",
  "FGT.Action.Facing": "Facing",
```

- [ ] **Step 6: Run the whole gate**

Run: `npm run lint && npm test`
Expected: lint clean including `check-layers`, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add module/rules/actions.mjs test/unit/actions.test.mjs lang/en.json
git commit -m "Declare every unit action as data, with the board-dependent predicates it needs"
```

---

### Task 3: The drift test against ActionKind

The guard that makes an unreachable action a build failure rather than a discovery in play.

**Files:**
- Modify: `test/unit/actions.test.mjs`
- Modify: `module/rules/budget.mjs` (export the union as data)

**Interfaces:**
- Consumes: `UNIT_ACTIONS` and `ACTION_EXEMPT_KINDS` from Task 2.
- Produces: `ACTION_KINDS: ReadonlyArray<string>` exported from `module/rules/budget.mjs`.

- [ ] **Step 1: Write the failing test**

Append to `test/unit/actions.test.mjs`:

```js
describe("no ActionKind may go unreachable (§29.5 DA.3)", () => {
  it("gives every ActionKind either a registry entry or an explicit exemption", () => {
    // The guard that would have caught `mark`, `gather` and `ridingAttack`,
    // all three of which shipped with a complete engine and no caller. A new
    // action kind now fails the build until somebody decides how it is offered.
    const offered = new Set(UNIT_ACTIONS.map((a) => a.kind).filter(Boolean));
    const exempt = new Set(ACTION_EXEMPT_KINDS);
    const orphans = ACTION_KINDS.filter((k) => !offered.has(k) && !exempt.has(k));
    expect(orphans).toEqual([]);
  });

  it("lets no registry entry name a kind the budget does not bill", () => {
    const known = new Set(ACTION_KINDS);
    const unknown = UNIT_ACTIONS.map((a) => a.kind).filter((k) => k && !known.has(k));
    expect(unknown).toEqual([]);
  });

  it("keeps the exemptions honest", () => {
    const known = new Set(ACTION_KINDS);
    expect(ACTION_EXEMPT_KINDS.filter((k) => !known.has(k))).toEqual([]);
  });
});
```

And extend the import at the top of the file:

```js
import { ACTION_KINDS } from "../../module/rules/budget.mjs";
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run test/unit/actions.test.mjs -t "ActionKind"`
Expected: FAIL, `ACTION_KINDS` is undefined.

- [ ] **Step 3: Export the union as data**

In `module/rules/budget.mjs`, replace the bare typedef comment with a real list beside it:

```js
/**
 * Every kind of action the economy bills, as DATA rather than only a typedef.
 *
 * A typedef cannot be tested. `test/unit/actions.test.mjs` holds this against
 * `rules/actions.mjs`'s registry in both directions, which is the guard that
 * would have caught `mark`, `gather` and `ridingAttack` shipping with complete
 * engines and no caller anywhere.
 *
 * @type {ReadonlyArray<string>}
 */
export const ACTION_KINDS = Object.freeze([
  "move", "attack", "skill", "np", "spell", "ridingAttack", "gather", "mark",
]);

/**
 * @typedef {"move"|"attack"|"skill"|"np"|"spell"|"ridingAttack"|"gather"|"mark"} ActionKind
 */
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run test/unit/actions.test.mjs -t "ActionKind"`
Expected: PASS, 3 tests.

- [ ] **Step 5: Prove the guard bites**

Temporarily add `"teleport"` to `ACTION_KINDS`, run the test, and confirm the first case fails with `[ "teleport" ]`. Remove it again and confirm the suite is green.

Run: `npx vitest run test/unit/actions.test.mjs -t "unreachable"`

- [ ] **Step 6: Run the whole gate and commit**

```bash
npm run lint && npm test
git add module/rules/budget.mjs test/unit/actions.test.mjs
git commit -m "Fail the build when an action kind has no way for a player to reach it"
```

---

### Task 4: The engine dispatcher

**Files:**
- Create: `module/engine/actions.mjs`
- Test: `test/unit/actions.test.mjs` (shape only — the bodies need Foundry)

**Interfaces:**
- Consumes: `availableActions` from Task 2; `placeMark({unitId, abilityId})` from `module/engine/marks.mjs`; `gather({actorId})` from `module/engine/gather.mjs`; `performRidingAttack({unitId, destination})` from `module/engine/riding.mjs`.
- Produces: `performAction(id, {actor, token, context, destination}): Promise<{ok, reason?}>` and `ACTION_HANDLERS` (an id → handler record, exported for the shape test).

- [ ] **Step 1: Write the failing test**

Append to `test/unit/actions.test.mjs`:

```js
describe("every offered action has a handler", () => {
  it("maps each registry id to exactly one dispatcher entry", async () => {
    // The other half of the drift guard: a registry entry with no handler is a
    // button that throws, and a handler with no entry is dead code.
    const { ACTION_HANDLERS } = await import("../../module/engine/actions.mjs");
    const registry = UNIT_ACTIONS.map((a) => a.id).sort();
    expect(Object.keys(ACTION_HANDLERS).sort()).toEqual(registry);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run test/unit/actions.test.mjs -t "handler"`
Expected: FAIL, cannot resolve `module/engine/actions.mjs`.

- [ ] **Step 3: Write the dispatcher**

Create `module/engine/actions.mjs`:

```js
/**
 * @file Dispatching a unit action to the engine that performs it.
 * @see module/rules/actions.mjs, docs/29-user-interface.md §29.5
 *
 * Layer 3. One table, no rules. It exists so the bar never imports
 * `marks.mjs`, `gather.mjs` and `riding.mjs` directly, and so adding Servant
 * #47's new action touches a registry entry and a table row rather than a
 * component.
 *
 * Every handler returns the `{ok, reason}` its engine already returns. The bar
 * surfaces a refusal; nothing here swallows one.
 */

import { placeMark } from "./marks.mjs";
import { gather } from "./gather.mjs";
import { performRidingAttack } from "./riding.mjs";

/**
 * id → handler. Held against `rules/actions.mjs`'s registry by
 * `test/unit/actions.test.mjs`: an entry with no handler is a button that
 * throws, and a handler with no entry is dead code.
 *
 * @type {Record<string, (args: object) => Promise<{ok: boolean, reason?: string}>>}
 */
export const ACTION_HANDLERS = Object.freeze({
  attack: async ({ actor }) => {
    const { FGTActorSheet } = await import("../apps/index.mjs");
    await FGTActorSheet.declareAttack(actor, null);
    return { ok: true };
  },

  move: async ({ token }) => {
    Hooks.callAll("fgtEnterMovement", token);
    return { ok: true };
  },

  ridingAttack: async ({ actor, destination }) => {
    if (!destination) return { ok: false, reason: "noDestination" };
    return performRidingAttack({ unitId: actor.id, destination });
  },

  mark: async ({ actor, context }) => placeMark({ unitId: actor.id, abilityId: context.abilityId }),

  gather: async ({ actor }) => gather({ actorId: actor.id }),

  facing: async ({ actor, context }) => {
    await actor.update({ "system.facing": context.facing });
    return { ok: true };
  },
});

/**
 * Perform one action.
 *
 * @param {string} id a `UNIT_ACTIONS` id
 * @param {object} args
 * @param {object} args.actor
 * @param {object} [args.token]
 * @param {object} [args.context] whatever the registry predicate produced
 * @param {{i: number, j: number}} [args.destination] for a targeted action
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
export async function performAction(id, { actor, token = null, context = {}, destination = null }) {
  const handler = ACTION_HANDLERS[id];
  if (!handler) return { ok: false, reason: "unknownAction" };
  return handler({ actor, token, context, destination });
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run test/unit/actions.test.mjs -t "handler"`
Expected: PASS.

- [ ] **Step 5: Add the refusal strings**

In `lang/en.json`:

```json
  "FGT.Action.Refusal.unknownAction": "That action does not exist.",
  "FGT.Action.Refusal.noDestination": "Pick a destination first.",
  "FGT.Action.Refusal.notFound": "That unit is gone.",
  "FGT.Action.Refusal.unplaced": "That unit is not on the board.",
  "FGT.Action.Refusal.notGranted": "This unit has not been granted that.",
  "FGT.Action.Refusal.fieldAlreadyActive": "The field is already open, so no new Bloodmark may be placed.",
  "FGT.Action.Refusal.alreadyMarked": "This panel already carries a Bloodmark.",
  "FGT.Action.Refusal.noHgobOwner": "Nobody on this board has Construction to gather for.",
  "FGT.Action.Refusal.cannotAct": "This unit has nothing left this Turn.",
```

- [ ] **Step 6: Run the whole gate and commit**

```bash
npm run lint && npm test
git add module/engine/actions.mjs test/unit/actions.test.mjs lang/en.json
git commit -m "Dispatch a unit action to the engine that already performs it"
```

---

### Task 5: Announce a field opening or closing

The Fields row has no trigger today: nothing raises a hook when a bounded field opens or closes.

**Files:**
- Modify: `module/engine/fields.mjs`
- Test: `test/unit/field-events.test.mjs`

**Interfaces:**
- Produces: the `fgtFieldChanged` hook, `Hooks.callAll("fgtFieldChanged", {fieldId, ownerId, open})`.

- [ ] **Step 1: Find the two call sites**

Run: `grep -n "export async function openField\|export async function deactivateField" module/engine/fields.mjs`

Note the exact function names and their success paths. If the opener is named differently, use the real name in Step 3 rather than inventing one.

- [ ] **Step 2: Write the failing test**

Append to `test/unit/field-events.test.mjs`:

```js
describe("a field announces itself opening and closing", () => {
  it("names the hook the action bar listens to", async () => {
    // Nothing announced a field's lifecycle, so the bar's Fields row had no
    // trigger. Listening to Region documents instead would fire for terrain
    // and home bases too, which is why this is explicit.
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync("module/engine/fields.mjs", "utf8"));
    const raises = [...source.matchAll(/Hooks\.callAll\("fgtFieldChanged"/g)];
    expect(raises.length).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 3: Run the test and watch it fail**

Run: `npx vitest run test/unit/field-events.test.mjs -t "announces itself"`
Expected: FAIL, `0 is not greater than or equal to 2`.

- [ ] **Step 4: Raise the hook at both sites**

In `module/engine/fields.mjs`, after a field is created, and after `deactivateField` completes:

```js
  // The bar's Fields row, and anything else that cares that the board's field
  // set changed. Explicit rather than listening to Region documents, which
  // would also fire for terrain and home bases.
  Hooks.callAll("fgtFieldChanged", { fieldId, ownerId, open: true });
```

and

```js
  Hooks.callAll("fgtFieldChanged", { fieldId, ownerId, open: false });
```

Use the variable names in scope at each site; do not introduce new lookups.

- [ ] **Step 5: Run the test and watch it pass**

Run: `npx vitest run test/unit/field-events.test.mjs -t "announces itself"`
Expected: PASS.

- [ ] **Step 6: Run the whole gate and commit**

```bash
npm run lint && npm test
git add module/engine/fields.mjs test/unit/field-events.test.mjs
git commit -m "Announce a bounded field opening and closing"
```

---

### Task 6: The bar's view-model

**Files:**
- Create: `module/apps/hud/present.mjs`
- Test: `test/unit/action-bar-present.test.mjs`

**Interfaces:**
- Consumes: `availableActions` from Task 2.
- Produces:
  - `portraitBlock(unit, {img, defaultImage, publicName, trueName, isOwner})` → `{img, name, subtitle}`
  - `slotFor(ability, {verdict, cost, turnsPerRound})` → `{id, name, img, cost, cooldown, ring, disabled, reason}`
  - `rowsFor({unit, board, actions, abilities, fields, effects})` → `Array<{id, label, slots}>`, rows with no slots omitted.

- [ ] **Step 1: Write the failing test**

Create `test/unit/action-bar-present.test.mjs`:

```js
/**
 * @file The action bar's view-model.
 * @see module/apps/hud/present.mjs, docs/29-user-interface.md §29.5
 *
 * Pure, so every slot state the design names is testable without Foundry —
 * the same split `apps/actor-sheet/present.mjs` already uses.
 */
import { describe, it, expect } from "vitest";
import { portraitBlock, slotFor, rowsFor } from "../../module/apps/hud/present.mjs";

const ability = (over = {}) => ({
  id: "a1", name: "Mystic Eyes", img: "art.webp", isNP: false,
  cooldownRemaining: 0, active: false, ...over,
});

describe("portraitBlock", () => {
  const medusa = { kind: "servant", identityRevealed: false };

  it("shows the class image and the public name while concealed", () => {
    // The bar must not leak a true name to a player who selected an opponent.
    const out = portraitBlock(medusa, {
      img: "true.webp", defaultImage: "rider.webp",
      publicName: "Rider", trueName: "Medusa", isOwner: false,
    });
    expect(out).toMatchObject({ img: "rider.webp", name: "Rider" });
  });

  it("shows the true portrait to the unit's own owner", () => {
    const out = portraitBlock(medusa, {
      img: "true.webp", defaultImage: "rider.webp",
      publicName: "Rider", trueName: "Medusa", isOwner: true,
    });
    expect(out).toMatchObject({ img: "true.webp", name: "Medusa" });
  });

  it("shows the true portrait once the identity is revealed", () => {
    const out = portraitBlock({ kind: "servant", identityRevealed: true }, {
      img: "true.webp", defaultImage: "rider.webp",
      publicName: "Rider", trueName: "Medusa", isOwner: false,
    });
    expect(out.img).toBe("true.webp");
  });

  it("never conceals a non-Servant", () => {
    const out = portraitBlock({ kind: "master", identityRevealed: false }, {
      img: "k.webp", defaultImage: "mask.webp",
      publicName: "Master", trueName: "Kiritsugu", isOwner: false,
    });
    expect(out.img).toBe("k.webp");
  });
});

describe("slotFor", () => {
  it("is ready with its cost when nothing refuses it", () => {
    const s = slotFor(ability(), { verdict: { ok: true }, cost: { kind: "sustainability", amount: 1 } });
    expect(s).toMatchObject({ disabled: false, ring: null, cooldown: null });
    expect(s.cost).toEqual({ kind: "sustainability", amount: 1 });
  });

  it("shows the remaining ticks while cooling", () => {
    const s = slotFor(ability({ cooldownRemaining: 3 }), { verdict: { ok: true }, turnsPerRound: 3 });
    expect(s.cooldown).toEqual({ remaining: 3, label: "1◈" });
    expect(s.disabled).toBe(true);
  });

  it("rings a mode that is switched on", () => {
    const s = slotFor(ability({ active: true }), { verdict: { ok: true } });
    expect(s.ring).toBe("on");
  });

  it("rings a Noble Phantasm whose field is built", () => {
    const s = slotFor(ability({ isNP: true, fieldOpen: true }), { verdict: { ok: true } });
    expect(s.ring).toBe("built");
  });

  it("carries the refusal reason rather than hiding the slot", () => {
    // A dead control is how a player concludes the system is broken.
    const s = slotFor(ability(), { verdict: { ok: false, reason: "exhausted" } });
    expect(s).toMatchObject({ disabled: true, reason: "exhausted" });
  });
});

describe("rowsFor", () => {
  const base = {
    unit: { id: "u1", kind: "servant" },
    board: { units: [], fields: [] },
    actions: [{ id: "attack", icon: "i", label: "FGT.Action.Attack", mode: "targeted", context: {} }],
    abilities: [], fields: [], effects: [],
  };

  it("omits a row the unit has nothing for", () => {
    const ids = rowsFor(base).map((r) => r.id);
    expect(ids).toContain("actions");
    expect(ids).not.toContain("modes");
    expect(ids).not.toContain("np");
  });

  it("splits abilities into skills, noble phantasms and modes", () => {
    const rows = rowsFor({
      ...base,
      abilities: [
        { ...ability({ id: "s1" }), group: "skill" },
        { ...ability({ id: "n1", isNP: true }), group: "np" },
        { ...ability({ id: "m1", active: true }), group: "mode" },
      ],
    });
    const by = Object.fromEntries(rows.map((r) => [r.id, r.slots.map((s) => s.id)]));
    expect(by.skills).toEqual(["s1"]);
    expect(by.np).toEqual(["n1"]);
    expect(by.modes).toEqual(["m1"]);
  });

  it("puts the pinned row first when there are pins", () => {
    const rows = rowsFor({
      ...base,
      abilities: [{ ...ability({ id: "s1" }), group: "skill" }],
      pins: ["s1"],
    });
    expect(rows[0].id).toBe("pinned");
    expect(rows[0].slots.map((s) => s.id)).toEqual(["s1"]);
    // A pin is a shortcut, never a replacement: the ability is still in its row.
    expect(rows.find((r) => r.id === "skills").slots.map((s) => s.id)).toEqual(["s1"]);
  });

  it("ignores a pin naming an ability the unit no longer has", () => {
    const rows = rowsFor({ ...base, pins: ["gone"] });
    expect(rows.some((r) => r.id === "pinned")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run test/unit/action-bar-present.test.mjs`
Expected: FAIL, cannot resolve `module/apps/hud/present.mjs`.

- [ ] **Step 3: Write the view-model**

Create `module/apps/hud/present.mjs`:

```js
/**
 * @file The action bar's view-model.
 * @see docs/29-user-interface.md §29.5
 *
 * Layer 4, and deliberately PURE: no Foundry globals, no documents. The bar
 * renders exactly what this returns, so every state the design names is
 * testable against literals. Same split, and the same reason, as
 * `apps/actor-sheet/present.mjs`.
 */

import { ticksLabel } from "../actor-sheet/present.mjs";

/** The rows, in the order they are shown. */
const ROW_ORDER = Object.freeze(["pinned", "actions", "skills", "np", "modes", "fields", "effects"]);

/** Which row an ability's group lands in. */
const GROUP_ROW = Object.freeze({ skill: "skills", np: "np", mode: "modes" });

/**
 * The portrait block: which face and which name the viewer is entitled to.
 *
 * Mirrors `apps/actor-sheet/context.mjs`'s `portraitImg` and
 * `rules/identity.mjs#publicNameOf`. Concealment applies to an unrevealed
 * SERVANT and to nothing else, and never to the unit's own owner — the
 * concealment is from opponents, not from the player running it.
 *
 * @param {object} unit
 * @param {{img: string, defaultImage: string|null, publicName: string, trueName: string, isOwner: boolean}} view
 * @returns {{img: string, name: string, subtitle: string|null}}
 */
export function portraitBlock(unit, { img, defaultImage, publicName, trueName, isOwner }) {
  const concealed = unit?.kind === "servant" && !unit?.identityRevealed && !isOwner;
  return {
    img: concealed ? (defaultImage || img) : img,
    name: concealed ? publicName : trueName,
    subtitle: concealed ? null : (publicName === trueName ? null : publicName),
  };
}

/**
 * One slot, with every state the bar draws.
 *
 * @param {object} ability a snapshot ability entry
 * @param {object} view
 * @param {{ok: boolean, reason?: string}} view.verdict from `rules/costs.mjs#canUseAbility`
 * @param {object|null} [view.cost] from `apps/actor-sheet/present.mjs#abilityCost`
 * @param {number} [view.turnsPerRound]
 * @returns {object}
 */
export function slotFor(ability, { verdict, cost = null, turnsPerRound = 3 }) {
  const remaining = ability?.cooldownRemaining ?? 0;
  const cooldown = remaining > 0
    ? { remaining, label: ticksLabel(remaining, turnsPerRound) }
    : null;

  // A ring says "this is switched on", which is a different fact from "this is
  // unavailable" and must not be drawn as one.
  let ring = null;
  if (ability?.isNP && ability?.fieldOpen) ring = "built";
  else if (ability?.active) ring = "on";

  const refused = verdict?.ok === false;
  return {
    id: ability?.id ?? null,
    name: ability?.name ?? "",
    img: ability?.img ?? null,
    cost,
    cooldown,
    ring,
    disabled: refused || Boolean(cooldown),
    // The reason travels with the slot so the tooltip can say it. A dead
    // control with no explanation is how a player concludes the system is
    // broken (`rules/modes.mjs` states the same rule for `cannotDeactivate`).
    reason: refused ? (verdict.reason ?? "unavailable") : (cooldown ? "cooldown" : null),
  };
}

/**
 * Every row the bar shows, in order, omitting the empty ones.
 *
 * A row that would be empty is left out rather than drawn blank: a Master has
 * three rows and Medusa has seven, and an empty "Noble Phantasms" heading on a
 * Civilian is noise.
 *
 * @param {object} args
 * @param {object} args.unit
 * @param {object} args.board
 * @param {object[]} args.actions from `rules/actions.mjs#availableActions`
 * @param {object[]} args.abilities slot-shaped, each carrying a `group`
 * @param {object[]} [args.fields] slot-shaped
 * @param {object[]} [args.effects] slot-shaped
 * @param {string[]} [args.pins] ability ids
 * @returns {Array<{id: string, label: string, slots: object[]}>}
 */
export function rowsFor({ actions = [], abilities = [], fields = [], effects = [], pins = [] }) {
  /** @type {Record<string, object[]>} */
  const buckets = { pinned: [], actions: [], skills: [], np: [], modes: [], fields, effects };

  for (const action of actions) {
    buckets.actions.push({ ...action, isAction: true, id: action.id, name: action.label });
  }
  for (const ability of abilities) {
    const row = GROUP_ROW[ability.group] ?? "skills";
    buckets[row].push(ability);
  }
  // A pin is a SHORTCUT into the rows below, never a replacement, so the same
  // ability appears twice by design and nothing can be hidden by pinning.
  for (const id of pins) {
    const found = abilities.find((a) => a.id === id);
    if (found) buckets.pinned.push(found);
  }

  return ROW_ORDER
    .filter((id) => (buckets[id] ?? []).length > 0)
    .map((id) => ({ id, label: `FGT.HUD.Row.${id}`, slots: buckets[id] }));
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run test/unit/action-bar-present.test.mjs`
Expected: PASS, 13 tests.

- [ ] **Step 5: Add the row labels**

In `lang/en.json`:

```json
  "FGT.HUD.Row.pinned": "Pinned",
  "FGT.HUD.Row.actions": "Actions",
  "FGT.HUD.Row.skills": "Skills",
  "FGT.HUD.Row.np": "Noble Phantasms",
  "FGT.HUD.Row.modes": "Modes",
  "FGT.HUD.Row.fields": "Fields",
  "FGT.HUD.Row.effects": "Effects",
```

- [ ] **Step 6: Run the whole gate and commit**

```bash
npm run lint && npm test
git add module/apps/hud/present.mjs test/unit/action-bar-present.test.mjs lang/en.json
git commit -m "Build the action bar's rows and slot states as a pure view-model"
```

---

### Task 7: The bar, rendering read-only

**Files:**
- Create: `module/apps/hud/action-bar.mjs`
- Create: `templates/hud/action-bar.hbs`
- Modify: `styles/src/_apps.scss`
- Modify: `module/fgt.mjs` (attach it in `ready`)

**Interfaces:**
- Consumes: `rowsFor`, `slotFor`, `portraitBlock` from Task 6; `availableActions` from Task 2; `unitSnapshot`, `currentBoard`, `unitFrom` from `module/engine/board.mjs`; `canUseAbility` from `module/rules/costs.mjs`; `abilityCost` from `module/apps/actor-sheet/present.mjs`; `publicNameOf` from `module/rules/identity.mjs`; `classifyAbility` from `module/rules/ability-use.mjs`.
- Produces: `ActionBar` class with `static attach()`, rendering `templates/hud/action-bar.hbs`.

- [ ] **Step 1: Write the template**

Create `templates/hud/action-bar.hbs`:

```handlebars
{{!-- The action bar (§29.5). Rows wrap; nothing here has an upper bound,
      which is exactly what the token HUD column could not survive. --}}
<div class="fgt-bar">
  <div class="fgt-bar__portrait">
    <img src="{{portrait.img}}" alt="{{portrait.name}}">
    <div class="fgt-bar__identity">
      <span class="fgt-bar__name">{{portrait.name}}</span>
      {{#if portrait.subtitle}}<span class="fgt-bar__subtitle">{{portrait.subtitle}}</span>{{/if}}
    </div>
    <div class="fgt-bar__resources">
      {{#each resources as |r|}}
        <span class="fgt-bar__resource"><b>{{localize r.label}}</b> {{r.value}}{{#if r.max}} / {{r.max}}{{/if}}</span>
      {{/each}}
    </div>
  </div>

  <div class="fgt-bar__rows">
    {{#each rows as |row|}}
      <div class="fgt-bar__row" data-row="{{row.id}}">
        <span class="fgt-bar__row-label">{{localize row.label}}</span>
        <div class="fgt-bar__slots">
          {{#each row.slots as |slot|}}
            <button type="button"
                    class="fgt-slot{{#if slot.disabled}} fgt-slot--disabled{{/if}}{{#if slot.ring}} fgt-slot--{{slot.ring}}{{/if}}"
                    data-action="useSlot" data-row="{{../row.id}}" data-slot="{{slot.id}}"
                    data-tooltip="{{slot.tooltip}}">
              {{#if slot.img}}<img class="fgt-slot__art" src="{{slot.img}}" alt="">{{/if}}
              {{#if slot.icon}}<i class="fgt-slot__icon {{slot.icon}}"></i>{{/if}}
              {{#if slot.cost}}<span class="fgt-slot__cost">{{slot.cost.amount}}◈</span>{{/if}}
              {{#if slot.cooldown}}<span class="fgt-slot__cooldown">{{slot.cooldown.label}}</span>{{/if}}
            </button>
          {{/each}}
        </div>
      </div>
    {{/each}}
  </div>

  <div class="fgt-bar__turn">{{> fgt-turn-panel}}</div>
</div>
```

Note: the `fgt-turn-panel` partial arrives in Task 9. Until then, replace that last `div` with an empty `<div class="fgt-bar__turn"></div>` so the template compiles.

- [ ] **Step 2: Write the application**

Create `module/apps/hud/action-bar.mjs`:

```js
/**
 * @file The action bar — one persistent panel for the controlled unit.
 * @see docs/29-user-interface.md §29.5
 *
 * Layer 4. Replaces the token HUD column, which packed an unbounded number of
 * controls into a container Foundry sizes for about four: Medusa produced
 * twelve and it overflowed. Rows wrap here, so a Servant with three open
 * fields and two modes fits by construction.
 *
 * Thin by design. Every decision it draws comes from `hud/present.mjs`, and
 * every action it dispatches comes from `rules/actions.mjs`; this file knows
 * no rules at all.
 */

import { rowsFor, slotFor, portraitBlock } from "./present.mjs";
import { availableActions } from "../../rules/actions.mjs";
import { classifyAbility } from "../../rules/ability-use.mjs";
import { canUseAbility } from "../../rules/costs.mjs";
import { publicNameOf } from "../../rules/identity.mjs";
import { abilityCost } from "../actor-sheet/present.mjs";
import { currentBoard, unitSnapshot, unitFrom } from "../../engine/board.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class ActionBar extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "fgt-action-bar",
    classes: ["fgt", "action-bar"],
    position: { width: "auto", height: "auto" },
    window: { frame: false, positioned: false },
    actions: {},
  };

  static PARTS = {
    body: { template: "systems/fgt/templates/hud/action-bar.hbs" },
  };

  /** The controlled token this bar is showing. @type {object|null} */
  #token = null;

  /** The singleton: one selection, one bar. */
  static #instance = null;

  /**
   * Show the bar and keep it current.
   *
   * The listener list is the design's §10 verbatim. `fgt.modeToggled` is NOT
   * here: only `engine/concealment.mjs` raises it, and an ordinary toggle
   * writes `system.active`, which surfaces as `updateItem`.
   *
   * @returns {ActionBar}
   */
  static attach() {
    ActionBar.#instance ??= new ActionBar();
    const bar = ActionBar.#instance;

    const refresh = () => {
      const token = canvas.tokens?.controlled?.[0] ?? null;
      bar.#token = token?.actor?.isOwner ? token : null;
      if (bar.#token) bar.render({ force: true });
      else bar.close();
    };

    Hooks.on("controlToken", refresh);
    Hooks.on("updateActor", refresh);
    Hooks.on("updateItem", refresh);
    Hooks.on("createActiveEffect", refresh);
    Hooks.on("deleteActiveEffect", refresh);
    Hooks.on("updateCombat", refresh);
    Hooks.on("fgtBudgetChanged", refresh);
    Hooks.on("fgtFieldChanged", refresh);

    console.log("FGT | Action bar attached");
    return bar;
  }

  /** @inheritdoc */
  async _prepareContext() {
    const token = this.#token;
    const actor = token?.actor;
    if (!actor) return { rows: [], portrait: {}, resources: [] };

    // ONE snapshot per render, threaded through every builder — the same
    // discipline `actor-sheet/context.mjs` uses and for the same reason.
    const board = currentBoard();
    const snapshot = unitSnapshot(actor, token.document);
    const unit = unitFrom(board, actor) ?? snapshot;
    const turnsPerRound = game.settings.get("fgt", "turnsPerRound");

    const actions = availableActions(snapshot, board).map((a) => ({
      ...a, icon: a.icon, tooltip: game.i18n.localize(a.label),
    }));

    const abilities = [...actor.items]
      .filter((i) => i.type === "ability" || i.type === "noblePhantasm")
      .map((item) => {
        const use = classifyAbility(item);
        if (!use.clickable) return null;
        const entry = (snapshot.abilities ?? []).find((a) => a.id === item.id) ?? {};
        const verdict = canUseAbility({ ability: item.system, unit: snapshot });
        const slot = slotFor({ ...entry, img: item.img, name: item.name, active: item.system?.active },
          { verdict, cost: abilityCost(item.system?.cost, null, snapshot), turnsPerRound });
        return {
          ...slot,
          group: use.toggles ? "mode" : (entry.isNP ? "np" : "skill"),
          tooltip: slot.reason
            ? `${item.name} — ${game.i18n.localize(`FGT.Action.Refusal.${slot.reason}`)}`
            : item.name,
        };
      })
      .filter(Boolean);

    return {
      portrait: portraitBlock(snapshot, {
        img: actor.img,
        defaultImage: actor.system?.defaultImage ?? null,
        publicName: publicNameOf(unit, board, { id: game.user.id }),
        trueName: actor.name,
        isOwner: actor.isOwner,
      }),
      // `FGT.Resource.*`, which already exist. Do not invent `FGT.Sheet.Health`:
      // it is not a key this system has.
      resources: [
        { label: "FGT.Resource.health", value: snapshot.health, max: actor.system?.health?.max ?? null },
        { label: "FGT.Resource.agility", value: actor.system?.agility?.value ?? 0, max: actor.system?.agility?.max ?? null },
        { label: "FGT.Resource.luck", value: actor.system?.luck?.value ?? 0, max: actor.system?.luck?.max ?? null },
      ],
      rows: rowsFor({ unit: snapshot, board, actions, abilities }),
    };
  }
}
```

- [ ] **Step 3: Attach it**

In `module/fgt.mjs`, inside the `ready` hook beside the other HUD attachments:

```js
  ActionBar.attach();
```

with the import beside the existing `apps` imports:

```js
import { ActionBar } from "./apps/hud/action-bar.mjs";
```

- [ ] **Step 4: Add the styles**

Append to `styles/src/_apps.scss`:

```scss
// The action bar (§29.5). Anchored bottom-centre, above the macro hotbar.
.fgt-bar {
  position: fixed;
  bottom: 0.5rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 70;
  display: flex;
  align-items: stretch;
  gap: 0.75rem;
  max-width: min(1400px, 96vw);
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border-dark, #000);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.82);
  color: var(--color-text-light-highlight, #f0f0e0);

  &__portrait { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; min-width: 6rem; }
  &__portrait img { width: 4rem; height: 4rem; object-fit: cover; border-radius: 4px; }
  &__name { font-weight: 700; }
  &__subtitle { opacity: 0.75; font-size: 0.8em; }
  &__resources { display: flex; flex-direction: column; font-size: 0.75em; }

  // The whole reason this replaced a column: rows WRAP, so an unbounded
  // number of controls has somewhere to go.
  &__rows { display: flex; flex-direction: column; gap: 0.25rem; flex: 1 1 auto; min-width: 0; }
  &__row { display: flex; align-items: center; gap: 0.5rem; }
  &__row-label {
    flex: 0 0 5.5rem; text-align: right; font-size: 0.7em;
    text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.7;
  }
  &__slots { display: flex; flex-wrap: wrap; gap: 0.25rem; min-width: 0; }
  &__turn { flex: 0 0 auto; border-left: 1px solid rgba(255, 255, 255, 0.15); padding-left: 0.75rem; }
}

.fgt-slot {
  position: relative;
  width: 2.5rem; height: 2.5rem;
  padding: 0;
  border: 1px solid var(--color-border-light-tertiary, #7a7971);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
  cursor: pointer;

  &__art { width: 100%; height: 100%; object-fit: cover; border-radius: 3px; }
  &__icon { font-size: 1.1rem; }
  &__cost { position: absolute; top: 1px; left: 2px; font-size: 0.6rem; text-shadow: 0 0 3px #000; }
  &__cooldown {
    position: absolute; inset: 0;
    display: grid; place-items: center;
    background: rgba(0, 0, 0, 0.6);
    font-size: 0.7rem; font-weight: 700;
  }

  // Dimmed and struck rather than hidden: the reason is in the tooltip, and a
  // control that vanishes teaches nothing about why.
  &--disabled { opacity: 0.45; border-style: dashed; cursor: not-allowed; }
  &--on { border-color: var(--fgt-gold, #c9a227); box-shadow: 0 0 4px var(--fgt-gold, #c9a227); }
  &--built { border-color: #7ac; box-shadow: 0 0 4px #7ac; }
}
```

- [ ] **Step 5: Verify it compiles and renders**

Run: `npm run check:templates && npm run build:styles && npm run lint && npm test`
Expected: 20 templates, 0 problems; styles build; lint clean; tests pass.

Then in the world: select a token and confirm the bar appears with an Actions row and a Skills row, and that **Mark appears on Medusa**. Nothing is clickable yet.

- [ ] **Step 6: Commit**

```bash
git add module/apps/hud/action-bar.mjs templates/hud/action-bar.hbs styles/src/_apps.scss module/fgt.mjs
git commit -m "Render the action bar for the controlled unit"
```

---

### Task 8: Make the slots work

**Files:**
- Modify: `module/apps/hud/action-bar.mjs`

**Interfaces:**
- Consumes: `performAction` from Task 4.
- Produces: a `useSlot` action handler that dispatches and reports refusals.

- [ ] **Step 1: Wire the handler**

In `ActionBar.DEFAULT_OPTIONS`, replace `actions: {}` with:

```js
    actions: { useSlot: ActionBar.#onUseSlot },
```

and add the static handler to the class:

```js
  /**
   * Click a slot: an action, or an ability.
   *
   * A refusal is REPORTED. Every engine here already returns `{ok, reason}`,
   * and swallowing one is how a player concludes the system is broken.
   *
   * @this {ActionBar}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async #onUseSlot(_event, target) {
    const actor = this.#token?.actor;
    if (!actor) return;

    const row = target.dataset.row;
    const id = target.dataset.slot;

    if (row === "actions") {
      const { performAction } = await import("../../engine/actions.mjs");
      const board = currentBoard();
      const snapshot = unitSnapshot(actor, this.#token.document);
      const entry = availableActions(snapshot, board).find((a) => a.id === id);
      if (!entry) return;

      // A targeted action hands off to the canvas rather than resolving here.
      if (entry.mode === "targeted" && id !== "attack") {
        Hooks.callAll("fgtEnterMovement", this.#token);
        return;
      }
      const result = await performAction(id, { actor, token: this.#token, context: entry.context });
      if (result?.ok === false) {
        ui.notifications.warn(game.i18n.localize(`FGT.Action.Refusal.${result.reason}`));
      }
      return;
    }

    const item = actor.items.get(id);
    if (!item) return;
    const { FGTActorSheet } = await import("../index.mjs");
    if (classifyAbility(item).toggles) {
      await item.update({ "system.active": !item.system?.active });
      return;
    }
    if (classifyAbility(item).isAttack) await FGTActorSheet.declareAttack(actor, item);
    else await FGTActorSheet.useSkill(actor, item);
  }
```

- [ ] **Step 2: Verify the gate**

Run: `npm run lint && npm test && npm run check:templates`
Expected: all clean.

- [ ] **Step 3: The acceptance test, live**

In the world, with Medusa selected:

1. Click **Mark**. A Bloodmark appears on her panel and her attack is spent.
2. Move her, click Mark again, three more times, on the four corners of a 5x5.
3. On the fourth, **Blood Fort Andromeda opens**. This has never been possible.
4. Click Mark once more and confirm the refusal notification reads "The field is already open".

Record the outcome. If `placeMark` misbehaves, that is a Task 8 bug and is fixed here, not deferred.

- [ ] **Step 4: Commit**

```bash
git add module/apps/hud/action-bar.mjs
git commit -m "Dispatch slot clicks, and say why when an engine refuses"
```

---

### Task 9: Pinning

**Files:**
- Modify: `module/apps/hud/action-bar.mjs`
- Modify: `templates/hud/action-bar.hbs`

**Interfaces:**
- Produces: pins stored at `game.user.getFlag("fgt", "pins")` as `Record<actorId, string[]>`.

- [ ] **Step 1: Read the pins into the context**

In `_prepareContext`, before the return, add:

```js
    const pins = (game.user.getFlag("fgt", "pins") ?? {})[actor.id] ?? [];
```

and pass them: `rows: rowsFor({ unit: snapshot, board, actions, abilities, pins }),`

- [ ] **Step 2: Handle the right-click**

Add to the class:

```js
  /**
   * Right-click a slot to pin or unpin it.
   *
   * A USER flag, not actor data: a pin is one player's shortcut, and storing
   * it on the actor would let one player rearrange another's bar and would
   * need a socket to sync. The auto rows always show everything, so a pin can
   * never hide an ability.
   *
   * @param {string} actorId
   * @param {string} abilityId
   * @returns {Promise<void>}
   */
  async #togglePin(actorId, abilityId) {
    const all = foundry.utils.deepClone(game.user.getFlag("fgt", "pins") ?? {});
    const current = all[actorId] ?? [];
    all[actorId] = current.includes(abilityId)
      ? current.filter((id) => id !== abilityId)
      : [...current, abilityId];
    await game.user.setFlag("fgt", "pins", all);
    this.render({ force: true });
  }
```

and bind it in `_onRender`:

```js
  /** @inheritdoc */
  _onRender(context, options) {
    super._onRender(context, options);
    for (const el of this.element.querySelectorAll("[data-slot]")) {
      if (el.dataset.row === "actions") continue;
      el.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        this.#togglePin(this.#token.actor.id, el.dataset.slot);
      });
    }
  }
```

- [ ] **Step 3: Verify**

Run: `npm run lint && npm test`

Live: right-click Mystic Eyes, confirm it appears in a new Pinned row **and stays in Skills**. Right-click it in the pinned row and confirm it leaves. Reload and confirm the pin survived.

- [ ] **Step 4: Commit**

```bash
git add module/apps/hud/action-bar.mjs
git commit -m "Pin a slot to the front row, per user"
```

---

### Task 10: Absorb the turn panel

**Files:**
- Modify: `module/apps/hud/action-bar.mjs`
- Modify: `templates/hud/action-bar.hbs`
- Modify: `templates/hud/turn.hbs` (becomes a partial)
- Modify: `module/fgt.mjs`
- Delete: `module/apps/hud/turn-hud.mjs`

- [ ] **Step 1: Register the partial**

In `module/fgt.mjs`, beside the existing `loadTemplates` call, add `"fgt-turn-panel": "systems/fgt/templates/hud/turn.hbs"`.

- [ ] **Step 2: Move the context**

Copy `TurnHUD._prepareContext`'s body into a private method on `ActionBar`, and spread its result into the bar's context under `turn`. Update `templates/hud/turn.hbs` to read `turn.*` rather than the top level. Keep the three sections in their current order: faction and clock, compulsion warnings, End Turn.

The compulsion section stays the loudest element. That section is the reason the panel exists: compulsions are turn-scoped, so a player can only discover a violation after committing to it.

- [ ] **Step 3: Move the actions**

Copy `endTurn`, `panTo` and `delay` from `TurnHUD.DEFAULT_OPTIONS.actions` into `ActionBar`'s, along with their static handlers unchanged.

- [ ] **Step 4: Restore the partial in the bar template**

Change the placeholder back to `{{> fgt-turn-panel}}`.

- [ ] **Step 5: Delete the old panel**

```bash
git rm module/apps/hud/turn-hud.mjs
```

and remove its import and `TurnHUD.attach()` from `module/fgt.mjs`.

- [ ] **Step 6: Verify**

Run: `npm run lint && npm test && npm run check:templates`

Live: confirm End Turn works, the clock is right, and a compulsion warning still appears.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Fold the turn panel into the bar's right-hand end"
```

---

### Task 11: Retire the token HUD

**Files:**
- Delete: `module/apps/hud/token-hud.mjs`
- Modify: `module/fgt.mjs`
- Modify: any file importing `FACINGS` or `remainingBudget` from it

- [ ] **Step 1: Find the dependants**

Run: `grep -rn "token-hud" module test --include=*.mjs`

`FACINGS` and `remainingBudget` are exported from it. Move `FACINGS` to `module/domain/facing.mjs` if anything outside the HUD imports it; move `remainingBudget` into `action-bar.mjs` if not.

- [ ] **Step 2: Move the facing dial into the bar**

The dial becomes the `facing` slot: left-click turns 45° clockwise, right-click 45° anticlockwise, both through `performAction("facing", {context: {facing: next}})`. Reuse the rotation arithmetic from the deleted file verbatim; it is correct and §29.5 records why.

- [ ] **Step 3: Delete and unwire**

```bash
git rm module/apps/hud/token-hud.mjs
```

Remove `attachTokenHUD()` and its import from `module/fgt.mjs`. Move the `fgtOfferReshape` listener it owned into `ActionBar.attach()` unchanged.

- [ ] **Step 4: Verify**

Run: `npm run lint && npm test && npm run check:templates`

Live: right-click a token and confirm only Foundry's own controls remain. Confirm facing still turns both ways from the bar and the token chevron follows.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Retire the token HUD column that could not hold its own contents"
```

---

### Task 12: Documentation

**Files:**
- Modify: `docs/29-user-interface.md`, `docs/18-action-economy.md`, `docs/43-bounded-fields.md`, `docs/32-case-semiramis.md`, `docs/45-implementation-status.md`, `CHANGELOG.md`

- [ ] **Step 1: Rewrite §29.5 and fold in §29.4**

Replace the control table with the bar's rows, the slot states, and the registry. State plainly that the column overflowed because its contents had no upper bound. Add DA.1 through DA.8 to §29.12.

- [ ] **Step 2: §18.9**

Record that three of the eight `ActionKind`s had no caller anywhere, that all three engines were complete, and that a drift test now fails the build on a fourth.

- [ ] **Step 3: §43.4 and Ch. 32**

Mark has a control, so a `markDefined` field is playable. Gather has a control.

- [ ] **Step 4: Ch. 45 and the CHANGELOG**

Under `Corrected`, because three actions being unreachable is a defect and not a missing feature. Name Blood Fort Andromeda as the acceptance test.

- [ ] **Step 5: Commit**

```bash
git add docs CHANGELOG.md
git commit -m "Document the action bar and the three actions it made reachable"
```

---

## Self-Review

**Spec coverage.** DA.1 Task 7 and 11. DA.2 Task 2. DA.3 Task 3. DA.4 Tasks 6 and 9. DA.5 Task 9. DA.6 Task 6. DA.7 Tasks 4 and 8. DA.8 Task 10. Spec §5's registry table is Task 2; §6's layout Task 7; §7's slot states Task 6; §9 Task 10; §10's hooks Tasks 5 and 7; §12's removals Tasks 10 and 11; §13's tests throughout; §14 Task 12.

**One spec item deliberately deferred.** §10's `fgtFieldChanged` needed a call site inventory that only the implementer can do safely, so Task 5 Step 1 is a `grep` rather than a named function. That is the one place this plan tells the engineer to look rather than showing them; the alternative is naming a function that may not exist.

**Type consistency.** `availableActions` returns `{id, kind, icon, label, mode, context}` in Task 2 and is consumed with those names in Tasks 4, 7 and 8. `slotFor` returns `{id, name, img, cost, cooldown, ring, disabled, reason}` in Task 6 and is consumed with those names in Task 7's template. `ACTION_KINDS` is produced in Task 3 and consumed in Task 3's test only. `performAction(id, {actor, token, context, destination})` is produced in Task 4 and called with that shape in Task 8.

**Known risk carried from the spec.** `performRidingAttack` has never run from a UI. Task 8's live pass is the first time; expect a defect there, the way `placeMark`'s token-document panel lag was found.
