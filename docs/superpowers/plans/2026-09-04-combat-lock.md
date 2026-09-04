# The Combat Lock — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop players acting in the middle of somebody else's Combat Process, without ever being able to freeze the table.

**Architecture:** One pure rule (`lockedBy`) decides; one engine reader (`openPrompts`) supplies it; four existing refusal sites enforce it; the action bar dims and says whose decision it is waiting on. The lock is held only by a Process **awaiting a human**, so §27.5's timeouts release it automatically.

**Tech Stack:** Foundry VTT v14, ApplicationV2, ES modules, vitest, SCSS. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-04-combat-lock-design.md`

## Global Constraints

- **Layers.** `module/domain` and `module/rules` must never touch Foundry globals (`game`, `canvas`, `ui`, `Hooks`, `ChatMessage`). `tools/check-layers.mjs` enforces this in `npm run lint`. **Layer 3 (`engine`) may not import from layer 4 (`apps`)** — this is why the pending scan moves down in Task 2.
- **Every task ends with a LIVE VISUAL check**: a screenshot, looked at. Not a DOM assertion. Three sessions in one Chrome — `mcp__chrome-devtools__new_page` with `isolatedContext: "p1"` / `"p2"`, plus the claude-in-chrome tab.
- **Canvas interaction needs real pointer events** (`mcp__claude-in-chrome__computer`). Synthetic dispatch does not reach PIXI.
- **Docs move with the code**: each task updates the chapter it changes, not only `docs/45`.
- **D3: facing is refused too.** One rule with no exceptions.
- **D5: the GM is exempt**, and out of combat nothing is enforced.
- Run `npm run lint` and `npx vitest run` before every commit. Commit messages end with the two attribution lines used on this branch.

## Baseline

`npx vitest run` is **2679 passing** at branch head (`9dc81dd`). A task that moves that number without adding tests has broken something.

## World fixtures

| Unit | Actor id | Owner | Faction | Panel `{i,j}` |
|---|---|---|---|---|
| Heracles | `SYV9LwndQdB06IBJ` | Player1 | `faction-1` | `{2,8}` |
| Medusa | `EgJ3W7GxhXkuffq4` | Player1 | `faction-1` | `{1,6}` |
| Foe Master | `7Vq3qg04Sh1ivtMr` | Player1 | `faction-1` | `{4,8}` |
| Karna (foe) | `buTLFCGAlQKOXXuy` | Player2 | `faction-2` | `{2,7}` |
| Heracles (foe) | `qtt3XUO3UkfwPWtt` | Player2 | `faction-2` | `{3,8}` |
| Dummy (test) | `80M07qU3J7CiZiTz` | Player2 | `faction-2` | `{4,9}` |
| EMIYA | `v9PrWlFwlnDteBEq` | — | — | unplaced |

Users: Gamemaster `7mB8UPGVR6alzrrT`, Player1 `yVevT9Da3egFpXeO`, Player2 `vL77HYG9fUm8uOwI`.
**`i` is the row (y/100), `j` the column (x/100).**

### Resetting between live runs

Two separate gates refuse an attack and they read differently. Clear both, as GM:

```js
await game.combat.unsetFlag("fgt", "budgets");            // "Servant attacks exhausted (2/2)"
const tick = game.combat.system.globalTurn;
const reset = { acted: false, moved: false, attacked: false, movedPanels: 0,
  moveSegments: 0, usedActiveSkill: false, mayMoveAgain: false, usedRidingAttack: false, tick };
for (const id of [/* every actor about to act */]) {
  await game.actors.get(id).update({ "system.turnState": reset });   // "already attacked this turn"
}
```

Token moves are refused by the movement hooks; pass `{ fgtForced: true }` and **retry** — a
single `doc.update` sometimes does not land, and re-issuing it does.

---

## File Structure

| File | Responsibility |
|---|---|
| `module/rules/combat-lock.mjs` *(new, pure)* | Given open prompts and a viewer: locked or not, and by whom. |
| `module/engine/pending.mjs` *(new)* | Scans chat for Processes awaiting a human. **One reader**, shared by the lock and the pending window, so they cannot disagree. |
| `module/engine/attack.mjs` | Refuse in `resolveAttack`. |
| `module/engine/skill-use.mjs` | Refuse in `useSkill`. |
| `module/engine/actions.mjs` | Refuse in `performAction` — covers the whole actions row, facing included. |
| `module/engine/movement-hooks.mjs` | Refuse in `onPreMove`. |
| `module/apps/hud/turn-panel.mjs` | Refuse `endTurn`. |
| `module/apps/hud/pending-panel.mjs` | Use the shared reader instead of its own scan. |
| `module/apps/hud/action-bar.mjs`, `present.mjs`, `templates/hud/action-bar.hbs` | Dim, and say who is being waited on. |

---

## Task 1: `lockedBy`, the pure rule

**Files:**
- Create: `module/rules/combat-lock.mjs`
- Test: `test/unit/combat-lock.test.mjs`
- Modify: `docs/18-action-economy.md`

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```js
  lockedBy(prompts, viewer) -> { locked: boolean, blockers: Array<{unitName: string, kind: string}> }
  ```
  A `prompt` is `{messageId, unitId, unitName, kind}`. `viewer` is `{id, isGM}`.

- [ ] **Step 1: Write the failing test**

Create `test/unit/combat-lock.test.mjs`:

```js
/**
 * @file Who may act while a Combat Process is waiting on somebody.
 * @see module/rules/combat-lock.mjs, docs/12-combat-process.md
 *
 * Nothing stopped a player acting in the middle of somebody else's exchange:
 * no `inFlight`, no gate, no chapter discussing one. Writes landed on a board
 * an open ladder was still reading, and Ch. 27 built the ladder as an
 * "asynchronous, multi-party, resumable negotiation" on the assumption that the
 * rest of the board holds still.
 */
import { describe, it, expect } from "vitest";
import { lockedBy } from "../../module/rules/combat-lock.mjs";

const prompt = (over = {}) => ({
  messageId: "m1", unitId: "u1", unitName: "Lancer", kind: "reaction", ...over,
});
const player = { id: "p1", isGM: false };
const gm = { id: "gm", isGM: true };

describe("lockedBy", () => {
  it("does not lock when nothing is waiting", () => {
    expect(lockedBy([], player).locked).toBe(false);
  });

  it("locks a player while any prompt is outstanding", () => {
    // "Any", deliberately: an exchange across the board still writes to the
    // board this player is about to write to.
    expect(lockedBy([prompt()], player).locked).toBe(true);
  });

  it("locks a player even when the prompt is their own", () => {
    // Being asked to react is not licence to also move. The unit owes the
    // table an answer first.
    expect(lockedBy([prompt({ unitId: "mine" })], player).locked).toBe(true);
  });

  it("never locks the GM", () => {
    // `onPreMove` already states the principle for movement: a system that
    // fights a GM setting up is a system they turn off. The GM is also the one
    // §27.5 asks to decide for absent players.
    expect(lockedBy([prompt(), prompt({ messageId: "m2" })], gm).locked).toBe(false);
  });

  it("reports every blocker, so a refusal can name one", () => {
    const out = lockedBy([
      prompt({ unitName: "Lancer", kind: "reaction" }),
      prompt({ messageId: "m2", unitName: "Rider", kind: "counter" }),
    ], player);
    expect(out.blockers).toEqual([
      { unitName: "Lancer", kind: "reaction" },
      { unitName: "Rider", kind: "counter" },
    ]);
  });

  it("gives the GM no blockers either, not just no lock", () => {
    expect(lockedBy([prompt()], gm).blockers).toEqual([]);
  });

  it("survives a missing prompt list rather than throwing", () => {
    expect(lockedBy(undefined, player).locked).toBe(false);
    expect(lockedBy(null, player).blockers).toEqual([]);
  });

  it("treats a missing viewer as a player, which is the safe reading", () => {
    // Guessing "GM" for an unknown caller would open the gate by accident.
    expect(lockedBy([prompt()], undefined).locked).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/unit/combat-lock.test.mjs`
Expected: FAIL — `Failed to resolve import "../../module/rules/combat-lock.mjs"`.

- [ ] **Step 3: Write the module**

Create `module/rules/combat-lock.mjs`:

```js
/**
 * @file Who may act while a Combat Process is waiting on somebody.
 * @see docs/12-combat-process.md, docs/27-reaction-protocol.md §27.5
 *
 * Layer 2 (rules). Pure.
 *
 * Nothing stopped a player acting in the middle of somebody else's exchange.
 * Ch. 27 built the reaction ladder as *"an asynchronous, multi-party, resumable
 * negotiation"* on the assumption that the rest of the board holds still, and
 * nothing ever made it hold still: `resolveAttack` snapshots the board at
 * declaration and the damage pipeline reads a later one, so an effect applied
 * between the two changes the arithmetic of an exchange already under way.
 *
 * **The lock is held by a Process AWAITING A HUMAN**, never by one merely
 * unfinished. That distinction is what stops this feature freezing a table: a
 * prompting rung carries §27.5's deadline, so an abandoned exchange releases on
 * its own clock, and a Process that errors mid-resolution never prompts and so
 * never holds the lock at all. Locking on "not done" would have needed a GM to
 * edit message flags by hand.
 */

/**
 * Is this viewer barred from acting, and by whom?
 *
 * The GM is exempt. `engine/movement-hooks.mjs#onPreMove` already states the
 * principle for movement — *"a GM arranging a scene is not spending a turn
 * budget, and a system that fights them while they set up is a system they turn
 * off"* — and the GM is also the one §27.5 asks to decide for absent players,
 * and the only one who can repair an exchange that has gone wrong.
 *
 * An **unknown** viewer is treated as a player. Guessing "GM" for a caller that
 * forgot to identify itself would open the gate by accident, and a gate that
 * fails open is not a gate.
 *
 * @param {Array<{unitName: string, kind: string}>} prompts every rung currently
 *   awaiting an answer, from `engine/pending.mjs#openPrompts`
 * @param {{id: string, isGM?: boolean}} [viewer]
 * @returns {{locked: boolean, blockers: Array<{unitName: string, kind: string}>}}
 */
export function lockedBy(prompts, viewer) {
  if (viewer?.isGM) return { locked: false, blockers: [] };

  const blockers = (prompts ?? []).map((p) => ({ unitName: p.unitName, kind: p.kind }));
  return { locked: blockers.length > 0, blockers };
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run test/unit/combat-lock.test.mjs`
Expected: PASS, 8 tests.

- [ ] **Step 5: Lint, including the layer check**

Run: `npm run lint`
Expected: clean, `FGT | Layer boundaries intact`.

- [ ] **Step 6: Document the rule**

In `docs/18-action-economy.md`, at the end of the chapter's opening implementation note (or
as a new note directly after the first heading if there is none), add:

```markdown
> **The combat lock.** A unit may not act while any Combat Process is waiting on a human
> (`rules/combat-lock.mjs`). The budget answers *"can this unit afford this action?"*; the
> lock answers the separate question *"is the table in the middle of resolving something?"*
> — and until it existed, the answer was always no matter what was happening.
>
> Held by a Process **awaiting a human**, never by one merely unfinished: a prompting rung
> carries §27.5's deadline and releases on its own clock, while a Process that errors
> mid-resolution never prompts and so never holds the lock. The GM is exempt, and out of
> combat nothing is enforced — the same two carve-outs `onPreMove` already makes.
```

- [ ] **Step 7: LIVE VISUAL check**

Wired to nothing yet, so the check is that the world loads and the rule answers.

1. As GM in the console:
   ```js
   const { lockedBy } = await import("/systems/fgt/module/rules/combat-lock.mjs");
   ({
     gmWithPrompt: lockedBy([{ unitName: "Lancer", kind: "reaction" }], { id: game.user.id, isGM: true }),
     playerWithPrompt: lockedBy([{ unitName: "Lancer", kind: "reaction" }], { id: "x", isGM: false }),
     nothingPending: lockedBy([], { id: "x", isGM: false }),
   });
   ```
   Expected: GM `locked: false`; player `locked: true` with one blocker; empty `locked: false`.
2. **Screenshot the canvas** and confirm the board draws.
3. `read_console_messages` with `onlyErrors: true` — expect none.

- [ ] **Step 8: Commit**

```bash
git add module/rules/combat-lock.mjs test/unit/combat-lock.test.mjs docs/18-action-economy.md
git commit -F- <<'MSG'
Who may act while the table is waiting

The lock is held by a Process AWAITING A HUMAN, never by one merely
unfinished -- that distinction is what stops it freezing a table, since a
prompting rung carries §27.5's deadline and a Process that errors
mid-resolution never prompts at all.

GM exempt, and an unknown viewer is treated as a player: a gate that fails
open is not a gate.

Pure, tested, wired to nothing yet.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014irpVJJ6kDxn1GUTvChzjr
MSG
```

---

## Task 2: The engine gate

**Files:**
- Create: `module/engine/pending.mjs`
- Modify: `module/apps/hud/pending-panel.mjs` (use the shared reader)
- Modify: `module/engine/attack.mjs`, `module/engine/skill-use.mjs`, `module/engine/actions.mjs`, `module/engine/movement-hooks.mjs`, `module/apps/hud/turn-panel.mjs`
- Modify: `lang/en.json`
- Test: `test/unit/combat-lock.test.mjs` (append the drift block)
- Modify: `docs/12-combat-process.md`

**Interfaces:**
- Consumes: `lockedBy(prompts, viewer)` (Task 1).
- Produces:
  - `openPrompts() -> Array<{messageId, unitId, unitName, kind}>` from `module/engine/pending.mjs`
  - `lockVerdict() -> {locked: boolean, blockers: Array<{unitName, kind}>, reason: string|null}` from the same file — the engine-side convenience every gate calls.

- [ ] **Step 1: Write the shared reader**

`module/apps/hud/pending-panel.mjs` currently scans chat itself. That scan must move **down
a layer**: the engine cannot import from `apps`, and the lock needs the same list. Create
`module/engine/pending.mjs`:

```js
/**
 * @file Which Combat Processes are waiting on a human.
 * @see docs/27-reaction-protocol.md §27.5, docs/12-combat-process.md
 *
 * Layer 3. **One reader, two consumers.** `rules/combat-lock.mjs` asks whether
 * the table is mid-decision, and `apps/hud/pending-panel.mjs` lists those
 * decisions for the viewer. Two scans would eventually disagree, and the
 * disagreement would be a player locked out with an empty window telling them
 * nothing is pending.
 *
 * The scan lives here rather than in the panel because layer 3 may not import
 * from layer 4.
 */

import { pendingPrompt, deserialize } from "./combat-process.mjs";
import { publicIdentityOf } from "./public-identity.mjs";
import { currentBoard } from "./board.mjs";
import { lockedBy } from "../rules/combat-lock.mjs";

/**
 * Every Combat Process currently stopped, asking somebody a question.
 *
 * Names are PUBLIC. A refusal that leaks a concealed Servant's true name would
 * hand out for free what the card beside it is carefully hiding.
 *
 * @returns {Array<{messageId: string, unitId: string, unitName: string, unitImg: string, kind: string}>}
 */
export function openPrompts() {
  const board = currentBoard();
  const out = [];

  for (const message of game.messages) {
    if (message.getFlag?.("fgt", "kind") !== "attack") continue;
    const raw = message.getFlag("fgt", "process");
    if (!raw) continue;

    let state;
    try {
      state = deserialize(raw);
    } catch {
      continue;
    }

    const prompt = pendingPrompt(state);
    if (!prompt) continue;

    const actor = prompt.unitId ? game.actors.get(prompt.unitId) : null;
    if (!actor) continue;

    const identity = publicIdentityOf(actor, board);
    out.push({
      messageId: message.id,
      unitId: actor.id,
      unitName: identity.name,
      unitImg: identity.img,
      kind: prompt.kind,
      owned: actor.isOwner,
    });
  }
  return out;
}

/**
 * The lock, for this client, right now.
 *
 * Out of combat nothing is enforced — the same carve-out `onPreMove` makes, and
 * for the same reason: a GM arranging a scene is not resolving an exchange.
 *
 * @returns {{locked: boolean, blockers: Array<{unitName: string, kind: string}>, reason: string|null}}
 */
export function lockVerdict() {
  if (!game.combats?.active?.started) return { locked: false, blockers: [], reason: null };

  const verdict = lockedBy(openPrompts(), { id: game.user?.id, isGM: game.user?.isGM });
  return { ...verdict, reason: verdict.locked ? "combatLocked" : null };
}

/**
 * The refusal sentence, naming who the table is waiting for.
 *
 * A refusal that does not say whose decision it is, is a refusal the player
 * reads as a bug — which is the same rule `rules/modes.mjs` states for
 * `cannotDeactivate` and the action bar follows for every dimmed slot.
 *
 * @param {Array<{unitName: string, kind: string}>} blockers
 * @returns {string}
 */
export function lockMessage(blockers) {
  const first = blockers?.[0];
  if (!first) return game.i18n.localize("FGT.Action.Refusal.combatLocked");

  const rung = game.i18n.localize(`FGT.Prompt.${first.kind}`);
  const one = game.i18n.format("FGT.Lock.WaitingOn", { name: first.unitName, rung });
  if ((blockers.length ?? 0) <= 1) return one;
  return `${one} ${game.i18n.format("FGT.Lock.AndMore", { n: blockers.length - 1 })}`;
}
```

- [ ] **Step 2: Point the pending window at it**

In `module/apps/hud/pending-panel.mjs`, replace the body of `rows()` so it uses the shared
reader and only adds what the *window* needs on top — the clock and the Command Spells:

```js
  rows() {
    const viewer = { id: game.user.id, isGM: game.user.isGM };
    const entries = openPrompts().map((p) => ({
      ...p,
      countdown: this.#countdown(game.messages.get(p.messageId)),
      commandSpells: this.#spendableSpells(),
    }));
    return pendingRowsFor(entries, viewer);
  }
```

Add `import { openPrompts } from "../../engine/pending.mjs";` and remove the now-unused
imports (`pendingPrompt`, `deserialize`, `publicIdentityOf`, `currentBoard`). **Keep
`windowFor`** if `#spendableSpells` is still gated on it — read the current code and preserve
whatever gate is there; the only change in this step is where the list comes from.

- [ ] **Step 3: Add the strings**

In `lang/en.json`, beside the other `FGT.Action.Refusal.*` keys:

```json
  "FGT.Action.Refusal.combatLocked": "A Combat Process is being resolved.",
  "FGT.Lock.WaitingOn": "Waiting on {name} — {rung}",
  "FGT.Lock.AndMore": "(+{n} more)",
```

- [ ] **Step 4: Gate the four engine entry points**

**`module/engine/actions.mjs`** — this one covers the whole actions row, facing included:

```js
export async function performAction(id, { actor, token = null, context = {}, destination = null }) {
  const handler = ACTION_HANDLERS[id];
  if (!handler) return { ok: false, reason: "unknownAction" };

  // §12: nothing on the bar while the table is mid-decision. Checked BEFORE the
  // dispatch, so a new action added to `ACTION_HANDLERS` is covered by
  // existing, rather than by somebody remembering.
  //
  // Facing is refused with the rest (D3). It spends nothing and ends nothing,
  // which is a real argument for exempting it -- and it is refused anyway,
  // because a lock with one carve-out invites the next, and the first thing a
  // player asks about a rule they cannot see is which parts of it are real.
  const { lockVerdict } = await import("./pending.mjs");
  const lock = lockVerdict();
  if (lock.locked) return { ok: false, reason: lock.reason, blockers: lock.blockers };

  return handler({ actor, token, context, destination });
}
```

**`module/engine/attack.mjs`** — in `resolveAttack`, directly above the existing budget
check (`if (combat?.started) { const verdict = budget.affordable(...) }`):

```js
  // §12: no declaration while the table is waiting on somebody. Above the
  // budget check for the same reason that check sits where it does -- refusals
  // are cheap and a half-resolved attack is not.
  const { lockVerdict, lockMessage } = await import("./pending.mjs");
  const lock = lockVerdict();
  if (lock.locked) throw new Error(`FGT | Cannot attack: ${lockMessage(lock.blockers)}`);
```

**`module/engine/skill-use.mjs`** — in `useSkill`, directly above the `canUseAbility` call:

```js
  const { lockVerdict } = await import("./pending.mjs");
  const lock = lockVerdict();
  if (lock.locked) return { ok: false, reason: lock.reason, blockers: lock.blockers };
```

**`module/engine/movement-hooks.mjs`** — in `onPreMove`, after the existing `forced` and
level escapes and before the path validation:

```js
  // §12. After the forced-movement and level escapes: a platform carrying its
  // passengers is displacement, not a Move, and must not be frozen by somebody
  // else's ladder.
  const lock = lockVerdict();
  if (lock.locked) {
    ui.notifications.warn(lockMessage(lock.blockers));
    return false;
  }
```

with `import { lockVerdict, lockMessage } from "./pending.mjs";` at the top — this file is
loaded at `ready` and has no import cycle with `pending.mjs`.

**`module/apps/hud/turn-panel.mjs`** — in `onEndTurn`, before the budget verdict:

```js
  const { lockVerdict, lockMessage } = await import("../../engine/pending.mjs");
  const lock = lockVerdict();
  if (lock.locked) {
    ui.notifications.warn(lockMessage(lock.blockers));
    return;
  }
```

- [ ] **Step 5: Write the drift test**

Append to `test/unit/combat-lock.test.mjs`:

```js
describe("every action path consults the lock", () => {
  // A source check, because these gates need a live Foundry to exercise. The
  // failure mode it guards is a NEW action path shipping unlocked, which is
  // invisible until two players race each other and then shows up as a damage
  // number nobody can reproduce.
  const read = (p) => readFileSync(p, "utf8");

  it("gates every unit action at `performAction`, before the dispatch", () => {
    // `performAction` is the single door for the whole actions row -- attack,
    // move, riding attack, mark, gather, facing. Gating it there means a new
    // entry in `ACTION_HANDLERS` is covered by existing.
    const source = read("module/engine/actions.mjs");
    const lockAt = source.indexOf("lockVerdict");
    const dispatchAt = source.indexOf("return handler({");
    expect(lockAt).toBeGreaterThan(-1);
    expect(dispatchAt).toBeGreaterThan(lockAt);
  });

  it("gates attacks, skills, movement and end-turn", () => {
    for (const path of [
      "module/engine/attack.mjs",
      "module/engine/skill-use.mjs",
      "module/engine/movement-hooks.mjs",
      "module/apps/hud/turn-panel.mjs",
    ]) {
      expect(read(path), path).toMatch(/lockVerdict/);
    }
  });

  it("leaves no unit action outside `performAction`", () => {
    // If a future action is dispatched from the bar directly instead of through
    // `performAction`, this catches it: the bar's slot handler must not import
    // an engine handler of its own.
    const bar = read("module/apps/hud/action-bar.mjs");
    expect(bar).toMatch(/performAction/);
    expect(bar).not.toMatch(/ACTION_HANDLERS/);
  });
});
```

Add to that file's imports: `import { readFileSync } from "node:fs";`

- [ ] **Step 6: Run everything**

Run: `npx vitest run test/unit/combat-lock.test.mjs` — expected PASS, 11 tests.
Run: `npm run lint` — expected clean. If `check-layers` reports a violation, `pending.mjs`
has imported from `apps/`; it must not.
Run: `npx vitest run` — expected 2679 + this task's new tests, nothing else moved.

- [ ] **Step 7: LIVE VISUAL check — a player is refused, the GM is not**

Three sessions. Reset budgets and turn state as GM first.

1. As **Player1**, attack Karna:
   ```js
   const { FGTSocket } = await import("/systems/fgt/module/net/socket.mjs");
   await FGTSocket.request("resolveAttack", {
     attackerId: "SYV9LwndQdB06IBJ", abilityId: null,
     placement: { unitId: "buTLFCGAlQKOXXuy", chosenIds: ["buTLFCGAlQKOXXuy"] },
   });
   ```
   Player2's reaction rung is now open. **Do not answer it.**
2. As **Player1**, try to act again and capture each refusal:
   ```js
   const { performAction } = await import("/systems/fgt/module/engine/actions.mjs");
   const { useSkill } = await import("/systems/fgt/module/engine/skill-use.mjs");
   const md = game.actors.get("EgJ3W7GxhXkuffq4");
   const skill = md.items.find(i => i.name === "Riding");
   ({
     facing: await performAction("facing", { actor: md, context: { facing: "e" } }),
     move:   await performAction("move",   { actor: md, token: md.getActiveTokens()[0] }),
     skill:  await useSkill({ actorId: md.id, abilityId: skill?.id, placement: {} }),
   });
   ```
   Expected: every one `{ ok: false, reason: "combatLocked" }`, **facing included**.
3. As the **GM**, run the same three. Expected: not refused for `combatLocked` — they may
   fail for budget or targeting reasons, which is fine and different.
4. As **Player2**, answer the rung (Block). Then repeat step 2 as Player1. Expected: no
   longer `combatLocked`.
5. **Screenshot** Player1's console output at steps 2 and 4 side by side.

- [ ] **Step 8: Document it**

In `docs/12-combat-process.md`, in the implementation note at the head of the chapter:

```markdown
> **The table holds still while a Process is waiting.** Ch. 27 built the ladder as an
> asynchronous, multi-party negotiation on the assumption that the rest of the board does
> not move under it, and nothing enforced that until `rules/combat-lock.mjs`. A player may
> not attack, move, use an ability, toggle a mode, turn, or end their turn while any Process
> is asking somebody a question. `engine/pending.mjs#openPrompts` is the single reader —
> shared with the pending-decisions window, because two scans would eventually disagree and
> the disagreement would be a player locked out by an empty window.
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -F- <<'MSG'
The table holds still while a Process is waiting

Attacks, skills, movement, every unit action and end-turn now refuse while any
Combat Process is asking somebody a question. Ch. 27 built the ladder assuming
the board holds still under it; nothing enforced that.

`performAction` is gated before its dispatch, so a new entry in ACTION_HANDLERS
is covered by existing rather than by somebody remembering -- and a drift test
asserts the ordering.

The chat scan moves down to `engine/pending.mjs` and is shared with the pending
window: two scans would eventually disagree, and the disagreement would be a
player locked out by a window telling them nothing is pending.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014irpVJJ6kDxn1GUTvChzjr
MSG
```

---

## Task 3: The bar says why

**Files:**
- Modify: `module/apps/hud/present.mjs`, `module/apps/hud/action-bar.mjs`, `templates/hud/action-bar.hbs`, `styles/src/_apps.scss`
- Test: `test/unit/action-bar-present.test.mjs` (append)
- Modify: `docs/29-user-interface.md`, `docs/45-implementation-status.md`, `CHANGELOG.md`

**Interfaces:**
- Consumes: `lockVerdict()` and `lockMessage(blockers)` (Task 2).
- Produces: no new API. The deliverable is the affordance and its verification.

- [ ] **Step 1: Write the failing presenter test**

Append to `test/unit/action-bar-present.test.mjs`:

```js
describe("slotFor while the table is locked", () => {
  const np = { id: "np1", name: "Nine Lives", img: "np.webp", isNP: true };
  const ok = { ok: true };

  it("disables every slot, whatever else it thought", () => {
    const slot = slotFor(np, { verdict: ok, locked: true });
    expect(slot.disabled).toBe(true);
    expect(slot.reason).toBe("combatLocked");
  });

  it("outranks a slot's own refusal, because the lock is the nearer cause", () => {
    // "You cannot afford this" is true and unhelpful when the real answer is
    // "it is not your moment".
    const slot = slotFor(np, { verdict: { ok: false, reason: "sustainability" }, locked: true });
    expect(slot.reason).toBe("combatLocked");
  });

  it("outranks the Counter glow too", () => {
    // A Counter rung is itself a prompt, so the bar armed for one is locked by
    // definition. The glow must not survive as a live-looking control.
    const slot = slotFor(np, { verdict: ok, counter: { isAttack: true }, locked: true });
    expect(slot.disabled).toBe(true);
    expect(slot.counter).toBe(false);
  });

  it("changes nothing when the table is free", () => {
    const slot = slotFor(np, { verdict: ok, locked: false });
    expect(slot.disabled).toBe(false);
    expect(slot.reason).toBeNull();
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run test/unit/action-bar-present.test.mjs`
Expected: FAIL — `expected false to be true` on the first case.

- [ ] **Step 3: Teach `slotFor` the lock**

In `module/apps/hud/present.mjs`, extend `slotFor`'s options and give the lock precedence
over every other state:

```js
export function slotFor(ability, { verdict, cost = null, turnsPerRound = 3, counter = null, locked = false }) {
```

and, immediately before the returned object:

```js
  // The lock outranks everything below it. "You cannot afford this" is true and
  // unhelpful when the real answer is "it is not your moment", and a Counter
  // glow on a locked bar is a control that looks live and is not.
  if (locked) {
    return {
      id: ability?.id ?? null,
      name: ability?.name ?? "",
      img: ability?.img ?? null,
      cost,
      cooldown,
      ring,
      counter: false,
      disabled: true,
      reason: "combatLocked",
    };
  }
```

- [ ] **Step 4: Run the presenter tests**

Run: `npx vitest run test/unit/action-bar-present.test.mjs`
Expected: PASS.

- [ ] **Step 5: Pass the lock into the bar, and say who**

In `module/apps/hud/action-bar.mjs`'s `_prepareContext`, near the top beside `turnsPerRound`:

```js
    const { lockVerdict, lockMessage } = await import("../../engine/pending.mjs");
    const lock = lockVerdict();
```

Pass it to each ability slot:

```js
        }, {
          verdict,
          cost: abilityCost(item.system?.cost, null, snapshot),
          turnsPerRound,
          counter: this.counter ? { isAttack: use.isAttack } : null,
          locked: lock.locked,
        });
```

Disable the actions row the same way, in the `availableActions(...).map(...)` already there:

```js
        disabled: Boolean(a.disabled) || counter === false || lock.locked,
```

and expose the banner to the template, beside `counter`:

```js
      // §12's lock. Named, not just dimmed: a refusal that does not say whose
      // decision it is waiting on is a refusal a player reads as a bug.
      lock: lock.locked ? { message: lockMessage(lock.blockers) } : null,
```

- [ ] **Step 6: Markup and style**

`templates/hud/action-bar.hbs` — beside the existing `counter.armed` banner:

```hbs
  {{#if lock}}
    <div class="fgt-actionbar__locked">{{lock.message}}</div>
  {{/if}}
```

`styles/src/_apps.scss`, inside the existing `.fgt-actionbar { … }` block beside `&__counter`:

```scss
  // §12's lock. Cool and quiet, deliberately unlike the Counter banner's gold:
  // one says "act now", the other says "not yet", and they must not be
  // mistaken for each other at a glance.
  &__locked {
    padding: 0.15rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: rgba(150, 190, 225, 0.95);
  }
```

Run: `npm run build:styles`
Run: `npx vitest run test/unit/styles.test.mjs` — the one-owner-per-class guard must stay green.

- [ ] **Step 7: Run everything**

Run: `npm run lint` — expected clean.
Run: `npx vitest run` — expected green.
Run: `npm run check:templates` — expected `0 problem(s)`.

- [ ] **Step 8: LIVE VISUAL check — the whole feature**

Three sessions, budgets reset.

**8a. The bar dims and names the blocker.**
1. As **Player1**, attack Karna (socket call as in Task 2).
2. **Screenshot Player1's screen.** Expected: every slot dimmed, and a blue-grey line
   reading **"Waiting on Lancer — Choose a reaction"**. Public name, not "Karna".
3. Hover a dimmed slot. **Screenshot** the tooltip. Expected: the lock's reason, not the
   ability's own.
4. **Screenshot the GM's screen** at the same moment. Expected: bar fully live.

**8b. It releases.**
5. As **Player2**, Block. **Screenshot Player1's screen.** Expected: the banner gone and
   every slot live again.

**8c. The interruption that must still work — the point of D4.**
6. Give EMIYA to Player1, place him within 3 panels of Heracles, and heal him:
   ```js
   const e = game.actors.get("v9PrWlFwlnDteBEq");
   await e.update({ "system.factionId": "faction-1", "ownership.yVevT9Da3egFpXeO": 3,
                    "system.health.value": e.system.health.max });
   ```
   Place his token beside Heracles by dragging it in the GM's canvas.
7. As **Player2**, attack Heracles with a Noble Phantasm (Karna's Brahmastra Kundala; clear
   its cooldown as GM first).
8. **Screenshot Player1's screen.** Expected two things at once: the bar is **locked**, and
   the card offers **Rho Aias (EMIYA)** as an option on Heracles's reaction rung.
9. Click it. **Screenshot.** Expected: it fires. This is the proof that the lock refuses the
   bar without touching anything routed through the Process — D4, which is the reason no
   exception list was built.

If Rho Aias is not offered, check the range clause: `timing.radius` is measured from the
projector to the unit in peril, and EMIYA must be within it.

- [ ] **Step 9: Documentation and changelog**

`docs/29-user-interface.md` §29.5 — add:

```markdown
> **Locked (Ch. 12).** While any Combat Process is waiting on a human, every slot dims and a
> line above the bar names the blocker: *"Waiting on Lancer — Choose a reaction"*, by public
> name. Dimmed with a reason, never hidden — the same discipline the bar already follows for
> a refused ability. The lock outranks a slot's own refusal, because *"you cannot afford
> this"* is true and unhelpful when the real answer is *"it is not your moment"*, and it
> clears the Counter glow, since a control that looks live and is not is worse than one that
> is plainly off.
>
> The pending-decisions window is on screen whenever the bar is locked, by construction —
> the same condition produces both — so a locked player can always see what the table is
> waiting for and whether any of it is theirs.
```

`docs/45-implementation-status.md` — update the Chapter 12 and Chapter 18 rows to record the
lock, and note that it is held only by a Process awaiting a human.

`CHANGELOG.md`, under `## [Unreleased]` in `### Added`:

```markdown
- **The combat lock (Ch. 12, Ch. 18).** A player may no longer attack, move, use an ability,
  toggle a mode, turn, or end their turn while any Combat Process is waiting on a human.
  Ch. 27 built the reaction ladder as an asynchronous, multi-party negotiation on the
  assumption that the rest of the board holds still under it, and **nothing enforced that** —
  `resolveAttack` snapshots the board at declaration while the damage pipeline reads a later
  one, so an effect applied in between changed the arithmetic of an exchange already under
  way.

  Held by a Process **awaiting a human**, never by one merely unfinished: a prompting rung
  carries §27.5's deadline and releases on its own clock, and a Process that errors
  mid-resolution never prompts and so never holds the lock. The GM is exempt and out of
  combat nothing is enforced, as `onPreMove` already had it.

  **No exception list was needed.** Every ability that may legitimately act during somebody
  else's Process — Rho Aias, Trofa, attacker windows, Command Spells — is already offered
  *through* the Process, as a rung option or a card button, never from the action bar. The
  bar and the sheet are exactly the surfaces with no business being live mid-exchange.
```

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -F- <<'MSG'
The bar says who the table is waiting for

Locked, every slot dims and a line names the blocker by public name. The lock
outranks a slot's own refusal -- "you cannot afford this" is true and unhelpful
when the real answer is "it is not your moment" -- and clears the Counter glow,
because a control that looks live and is not is worse than one plainly off.

Verified live that Rho Aias still fires from the defender's rung while the bar
is locked, which is the whole reason no exception list was built.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014irpVJJ6kDxn1GUTvChzjr
MSG
```

---

## Self-review against the spec

| Spec section | Task |
|---|---|
| §2 lock trigger, self-healing | 1 (`lockedBy`), 2 (`lockVerdict`'s combat guard) |
| §3 what it refuses, facing included | 2 Step 4 (all five gates) |
| §4 no exception list | Nothing to build; 3 Step 8c proves it live |
| §4 `ownTurn`/`anyTime` recorded as decoration | 1 Step 6's doc note |
| §5 GM exempt, out of combat free | 1 (`lockedBy`), 2 (`lockVerdict`) |
| §6 three layers | 1 pure, 2 engine, 3 affordance |
| §6 shared scan | 2 Steps 1–2 |
| §7 what the player sees | 3 Steps 3–6 |
| D7 refusal names the unit by public name | 2 Step 1 (`openPrompts` uses `publicIdentityOf`), 2 Step 3 (`FGT.Lock.WaitingOn`) |

**Known hazards, stated on purpose:**

1. **`pending.mjs` must not import from `apps/`.** It is layer 3 and `check-layers` will fail the build if it does. That is why the scan moves down rather than the lock reaching up.
2. **Dynamic `await import` inside `performAction` and `resolveAttack`** — these files already use that idiom to avoid import cycles (`engine/attack.mjs` imports `apps/chat/cards.mjs`, which imports back). Use it; a static import of `pending.mjs` into `attack.mjs` is likely to cycle through `board.mjs`.
3. **The lock will refuse things during your own live testing**, including the setup calls in later tasks. Answer or expire the open rung first, or run setup as the GM, who is exempt.
4. **Facing being locked is deliberate (D3)** and will look like a bug to anyone who reads only the code. The comment in `performAction` says why; do not "fix" it.
5. **Foe Master is faction-1 and Player1's** at branch head, and several tokens were moved with `fgtForced` during the previous part. Read positions off `currentBoard()` rather than trusting this table if a live check behaves oddly.
