# Master Redirect and Pending Decisions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement §12.8's Master redirect, and give a player one place that answers "what is the game waiting for me to do?"

**Architecture:** Part A adds one pure rule (`counterRedirect`), one targeting limit (`excludeUnitIds`), and one Process field (`counterRedirectId`) decided by the orchestrator at the counter rung — the same pattern `counterAvailable` already uses. Part B adds a pure presenter and a small ApplicationV2 that scans chat messages for prompts this viewer owns; it renders and jumps, and answers nothing itself.

**Tech Stack:** Foundry VTT v14, ApplicationV2 + HandlebarsApplicationMixin, ES modules, vitest, SCSS. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-04-master-redirect-and-pending-decisions-design.md`

## Global Constraints

- **Layers.** `module/domain` and `module/rules` must never touch Foundry globals (`game`, `canvas`, `ui`, `Hooks`, `ChatMessage`). `tools/check-layers.mjs` enforces this inside `npm run lint`.
- **Every task ends with a LIVE VISUAL check.** Not a DOM assertion — a screenshot, looked at. Three simultaneous sessions in one Chrome: `mcp__chrome-devtools__new_page` with `isolatedContext: "p1"` / `"p2"` gives each its own cookie jar; the claude-in-chrome tab is the third. Green tests are not evidence.
- **Canvas interaction needs real pointer events** (`mcp__claude-in-chrome__computer` hover/click). Synthetic `KeyboardEvent`/`PointerEvent` dispatch does not reach PIXI's targeting layer.
- **Docs move with the code.** Each task updates the chapter it changes (00–44), not only `docs/45-implementation-status.md`. CHANGELOG entries: one for Part A in Task A3, one for Part B in Task B3.
- Run `npm run lint` and `npx vitest run` before every commit. Commit messages end with the two attribution lines used throughout this branch.
- Parts A and B share no code. **Either may be executed first.** Within a part the tasks are ordered.

## Baseline

`npx vitest run` is **2650 passing** at the head of this branch (`bc65c3c`). Any task that changes that number without adding tests has broken something.

## World fixtures

| Unit | Actor id | Owner | Faction | Panel `{i,j}` |
|---|---|---|---|---|
| Heracles | `SYV9LwndQdB06IBJ` | Player1 | `faction-1` | `{1,6}` |
| Karna (foe) | `buTLFCGAlQKOXXuy` | Player2 | `faction-2` | `{2,6}` |
| Foe Master | `7Vq3qg04Sh1ivtMr` | GM | — | `{2,8}` |
| Our Master | `1DWsgIcR3dsBFAVK` | GM | — | `{11,10}` |

Users: Gamemaster `7mB8UPGVR6alzrrT`, Player1 `yVevT9Da3egFpXeO`, Player2 `vL77HYG9fUm8uOwI`.
**`i` is the row (y/100), `j` is the column (x/100).** Transposing them wastes a live run.

### Resetting between live runs

This world accumulates state. Before each live exchange, as the **GM**:

```js
await game.combat.unsetFlag("fgt", "budgets");
const tick = game.combat.system.globalTurn;
const reset = { acted: false, moved: false, attacked: false, movedPanels: 0,
  moveSegments: 0, usedActiveSkill: false, mayMoveAgain: false, usedRidingAttack: false, tick };
for (const id of [/* every actor about to act */]) {
  await game.actors.get(id).update({ "system.turnState": reset });
}
```

Two separate gates refuse an attack and they read differently: the per-unit
`system.turnState.attacked` says *"this unit has already attacked this turn"*, and the
faction pool on the Combat flag says *"Servant attacks exhausted (2/2)"*. Clear both.

`system.sustainability` is a **formatted string** (`"20◈"`); the spendable number is
`system.sustainabilityRemaining`. Setting the first alone does nothing.

---

## File Structure

| File | Responsibility |
|---|---|
| `module/rules/counter.mjs` | *(existing)* + `counterRedirect` — who a Counter is redirected to. |
| `module/rules/targeting/resolve.mjs` | *(existing)* + `limits.excludeUnitIds`. |
| `module/engine/combat-process.mjs` | *(existing)* + `counterRedirectId` on the state. |
| `module/engine/attack.mjs` | *(existing)* — decide the redirect at the rung; `runCounter` honours it. |
| `module/apps/hud/action-bar.mjs`, `module/apps/chat/cards.mjs` | *(existing)* — arm on the redirect target. |
| `module/apps/hud/pending-present.mjs` *(new)* | Pure: entries + viewer → sorted rows. |
| `module/apps/hud/pending-panel.mjs` *(new)* | The app: scan, render, hooks, jump. |
| `templates/hud/pending-panel.hbs` *(new)* | Its markup. |

---

# PART A — The Master redirect

## Task A1: `counterRedirect`, the pure rule

**Files:**
- Modify: `module/rules/counter.mjs`
- Test: `test/unit/counter-rules.test.mjs` (existing — append)
- Modify: `docs/12-combat-process.md`

**Interfaces:**
- Consumes: `guardsOf(master, board)` from `module/rules/relations.mjs`, returning the Servants that guard a Master (it already substitutes Pale Rider's Kagome Spirits and excludes Pale Rider from guarding his own Master). `chebyshev(a, b)` from `module/domain/geometry.mjs`.
- Produces: `counterRedirect(target, board) -> string|null` and `COUNTER_REDIRECT_PANELS = 2`.

- [ ] **Step 1: Write the failing test**

Append to `test/unit/counter-rules.test.mjs`:

```js
describe("counterRedirect", () => {
  // §12.8: "the Counter Attack cannot be used on the Master if its Servant is
  // within a 2 panel area of itself, the Counter Attack is redirected to that
  // Master's Servant instead."
  const master = { id: "M", kind: "master", faction: "f1", panel: { i: 5, j: 5 } };
  const servant = (id, i, j, over = {}) => ({
    id, kind: "servant", faction: "f1", panel: { i, j }, canAct: true, ...over,
  });
  const board = (units) => ({ units });

  it("redirects to a Servant standing at exactly two panels", () => {
    // The band the general §16.4 protection does NOT cover; it stops at one.
    expect(counterRedirect(master, board([master, servant("S", 5, 7)]))).toBe("S");
  });

  it("redirects to an adjacent Servant too", () => {
    expect(counterRedirect(master, board([master, servant("S", 5, 6)]))).toBe("S");
  });

  it("does not redirect past two panels", () => {
    expect(counterRedirect(master, board([master, servant("S", 5, 8)]))).toBeNull();
  });

  it("picks the NEAREST of two guards, so the answer is never arbitrary", () => {
    const units = [master, servant("far", 5, 7), servant("near", 5, 6)];
    expect(counterRedirect(master, board(units))).toBe("near");
  });

  it("ignores a guard that cannot act", () => {
    // A Stunned or Frozen Servant is not shielding anybody.
    expect(counterRedirect(master, board([master, servant("S", 5, 6, { canAct: false })]))).toBeNull();
  });

  it("ignores a Servant of another faction", () => {
    const enemy = servant("E", 5, 6, { faction: "f2" });
    expect(counterRedirect(master, board([master, enemy]))).toBeNull();
  });

  it("returns null for anything that is not a Master", () => {
    // The rule is about Masters. A Servant being countered is countered.
    const servantTarget = { id: "T", kind: "servant", faction: "f1", panel: { i: 5, j: 5 } };
    expect(counterRedirect(servantTarget, board([servantTarget, servant("S", 5, 6)]))).toBeNull();
  });

  it("returns null for a Master with no panel, rather than throwing", () => {
    expect(counterRedirect({ id: "M", kind: "master", faction: "f1" }, board([]))).toBeNull();
  });

  it("never redirects a Master to itself", () => {
    expect(counterRedirect(master, board([master]))).toBeNull();
  });
});
```

Add `counterRedirect` to that file's import from `../../module/rules/counter.mjs`.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/unit/counter-rules.test.mjs`
Expected: FAIL — `counterRedirect is not a function`.

- [ ] **Step 3: Implement it**

In `module/rules/counter.mjs`, add the imports at the top:

```js
import { guardsOf } from "./relations.mjs";
import { chebyshev } from "../domain/geometry.mjs";
```

and append:

```js
/**
 * How far a Master's Servant may stand and still absorb a Counter (§12.8).
 *
 * TWO, and deliberately not the ONE that `rules/targeting/resolve.mjs`'s
 * `isProtectedMaster` uses. That is §16.4's general protection — a Master
 * beside a Servant cannot be targeted at all, by anything. This is a different
 * rule with a wider radius that applies only to Counters, and it *retargets*
 * rather than refusing.
 */
export const COUNTER_REDIRECT_PANELS = 2;

/**
 * The unit a Counter aimed at this target must hit instead, or `null`.
 *
 * > *"If a Master performs an Attack on an enemy Unit and the enemy Unit
 * > decides to Counter, the Counter Attack cannot be used on the Master if its
 * > Servant is within a 2 panel area of itself, the Counter Attack is
 * > **redirected** to that Master's Servant instead."*
 *
 * A retarget, not a refusal: the Counter happens, against the Servant.
 *
 * `guardsOf` rather than "any Servant of that faction", because it already
 * knows the one case where that is wrong — Pale Rider's Kagome Spirits guard in
 * his place, and he does not guard his own Master at all (Ch. 16).
 *
 * The NEAREST guard, so a Master flanked by two Servants has one answer rather
 * than whichever the board happened to list first. The rule does not say which,
 * and an arbitrary answer is one that changes when a token is re-placed.
 *
 * @param {object} target the unit the Counter is aimed at
 * @param {object} board
 * @returns {string|null} the Servant's id
 */
export function counterRedirect(target, board) {
  if (target?.kind !== "master" || !target.panel) return null;

  let best = null;
  let bestDistance = Infinity;
  for (const guard of guardsOf(target, board)) {
    if (guard.id === target.id || guard.canAct === false || !guard.panel) continue;
    const distance = chebyshev(guard.panel, target.panel);
    if (distance > COUNTER_REDIRECT_PANELS || distance >= bestDistance) continue;
    best = guard.id;
    bestDistance = distance;
  }
  return best;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run test/unit/counter-rules.test.mjs`
Expected: PASS, 20 tests (11 existing + 9 new).

- [ ] **Step 5: Lint, including the layer check**

Run: `npm run lint`
Expected: clean, `FGT | Layer boundaries intact`. A boundary violation means the module reached for a Foundry global — remove it, this file stays pure.

- [ ] **Step 6: Document the rule**

In `docs/12-combat-process.md`, replace the **Master redirect** section's `**DECISION.**` paragraph — the one reading *"The redirect succeeds regardless of range, because the rule is written as an absolute protection. Ch. 41."* — with:

```markdown
**DECISION (narrowed).** The redirect makes the Servant the unit the Counter must catch,
and drops the Master from its targets entirely. The **chosen ability's reach still
applies**: the original decision said the redirect succeeds *"regardless of range"*, which
was written when a Counter was always an auto-aimed Normal Attack and has no clear meaning
now that the counterer picks an ability and aims it. An ability that cannot reach the
Servant refuses under the cursor like any other illegal aim; the player picks another or
Declines. The Master is protected either way — if the Servant cannot be reached either, the
counter hits nobody. Ch. 41.

> **Implementation note.** `rules/counter.mjs#counterRedirect`. Two panels, via `guardsOf`,
> nearest guard wins — distinct from `resolve.mjs#isProtectedMaster`, which is §16.4's
> general one-panel protection and refuses rather than retargets.
```

- [ ] **Step 7: LIVE VISUAL check**

The rule is wired to nothing yet, so the check is that the world still loads and the rule answers correctly against the real board.

1. As GM, in the console:
   ```js
   const { counterRedirect } = await import("/systems/fgt/module/rules/counter.mjs");
   const { currentBoard } = await import("/systems/fgt/module/engine/board.mjs");
   const board = currentBoard();
   const fm = board.units.find(u => u.id === "7Vq3qg04Sh1ivtMr");
   ({ foeMasterPanel: fm?.panel, redirect: counterRedirect(fm, board) });
   ```
2. **Screenshot the canvas** and confirm the board draws with no errors
   (`read_console_messages`, `onlyErrors: true`).
3. Record the returned value. Whether it is a Servant id or `null` depends on where the
   tokens are standing; what matters is that it answers without throwing and agrees with
   what the screenshot shows about who is standing near the Master.

- [ ] **Step 8: Commit**

```bash
git add module/rules/counter.mjs test/unit/counter-rules.test.mjs docs/12-combat-process.md
git commit -F- <<'MSG'
The Master redirect, as a rule

§12.8's redirect: a Counter aimed at a Master whose Servant stands within two
panels hits the Servant instead. Two panels via `guardsOf`, nearest guard wins
-- distinct from `isProtectedMaster`, which is §16.4's general one-panel
protection and refuses rather than retargets.

Pure, tested, wired to nothing yet.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014irpVJJ6kDxn1GUTvChzjr
MSG
```

---

## Task A2: `limits.excludeUnitIds`

**Files:**
- Modify: `module/rules/targeting/resolve.mjs`
- Test: `test/unit/targeting.test.mjs` (existing — append)
- Modify: `docs/09-targeting.md`

**Interfaces:**
- Consumes: the `drop(unit, reason)` recorder already inside `resolveTargets`, which pushes `{unitId, name, reason}` onto `excluded` and returns `false`.
- Produces: `spec.limits.excludeUnitIds: string[]|undefined` — the named units are removed from the target list with a recorded reason.

- [ ] **Step 1: Write the failing test**

Append to `test/unit/targeting.test.mjs`:

```js
describe("limits.excludeUnitIds", () => {
  // §12.8's redirect has two halves. `requireUnitId` is the half that says who
  // must be caught; this is the half that says who must NOT be, so a Master
  // whose Servant shields it takes nothing even from an area that covers it.
  const board = boardWith([caster, unit("master", 6, 7), unit("guard", 6, 8)]);
  const spec = (limits) => ({
    anchor: { kind: "withinRange", range: 4 },
    shape: { kind: "rect", w: 3, h: 3 },
    selection: { relations: ["enemy"], chooser: "all" },
    limits,
  });

  it("drops the named unit from the targets", () => {
    const out = resolveTargets(spec({ excludeUnitIds: ["master"] }), caster, board, { panel: at(6, 7) });
    expect(out.units.map((u) => u.unitId)).not.toContain("master");
  });

  it("keeps everything else the area caught", () => {
    const out = resolveTargets(spec({ excludeUnitIds: ["master"] }), caster, board, { panel: at(6, 7) });
    expect(out.units.map((u) => u.unitId)).toContain("guard");
  });

  it("records WHY, so the targeting preview can show it", () => {
    // A unit that silently vanishes from the preview reads as a bug. The
    // exclusion has to say the rule that caused it.
    const out = resolveTargets(spec({ excludeUnitIds: ["master"] }), caster, board, { panel: at(6, 7) });
    const row = out.excluded.find((e) => e.unitId === "master");
    expect(row).toBeTruthy();
    expect(row.reason).toMatch(/Counter is redirected/);
  });

  it("changes nothing when the limit is absent", () => {
    const out = resolveTargets(spec({}), caster, board, { panel: at(6, 7) });
    expect(out.units.map((u) => u.unitId)).toContain("master");
  });

  it("combines with requireUnitId", () => {
    // The redirect in one call: the Master out, the Servant required.
    const out = resolveTargets(
      spec({ excludeUnitIds: ["master"], requireUnitId: "guard" }), caster, board, { panel: at(6, 7) },
    );
    expect(out.errors).toEqual([]);
    expect(out.units.map((u) => u.unitId)).toEqual(["guard"]);
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run test/unit/targeting.test.mjs`
Expected: FAIL — the first case still contains `"master"`.

- [ ] **Step 3: Implement the limit**

In `module/rules/targeting/resolve.mjs`, find the §16.4 Master-protection block, which
reads roughly:

```js
  if (!limits.bypassMasterProtection && !caster.bypassesMasterProtection && isChosen) {
    const before = survivors.length;
    survivors = survivors.filter(
      (u) => !isProtectedMaster(u, caster, board) || drop(u, "a Master protected by an adjacent Servant"),
    );
    if (survivors.length < before) warnings.push("Protected Masters were excluded.");
  }
```

**Do NOT add the new filter inside that block.** It is gated on `isChosen`, so §16.4 only
refuses a *directly chosen* Master and deliberately lets an area catch one incidentally — the
comment above it explains that Cover depends on exactly that. §12.8's redirect is the
opposite: the Master must be dropped **even from an area that covers it**, because *"the
Counter Attack cannot be used on the Master"*.

So add it as its own unconditional filter, immediately **before** that block:

```js
  // §12.8's redirect, the half that says who must NOT be caught. Unconditional,
  // and deliberately NOT inside §16.4's block below: that one is gated on
  // `isChosen` so an area may still catch a protected Master incidentally,
  // which is what makes Cover work. This rule is the opposite -- the Master
  // takes nothing even from an area that covers it.
  //
  // Dropped through `drop` rather than filtered silently: a unit that vanishes
  // from the targeting preview with no explanation reads as a bug.
  const excludeIds = limits.excludeUnitIds ?? [];
  if (excludeIds.length > 0) {
    survivors = survivors.filter(
      (u) => !excludeIds.includes(u.id)
        || drop(u, "protected by its Servant; the Counter is redirected"),
    );
  }
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run test/unit/targeting.test.mjs`
Expected: PASS.

Run: `npx vitest run` — expected 2650 + the new tests, nothing else moved.

- [ ] **Step 5: Document it**

In `docs/09-targeting.md` §9.6, add to the `LimitSpec` block, beside `requireUnitId`:

```ts
  excludeUnitIds?: string[];                   // §12.8: a redirected Master
```

and extend the `requireUnitId` note below it:

```markdown
> **`excludeUnitIds`** is the other half of the same rule. §12.8's redirect both requires
> the Servant and forbids the Master, so an area Counter that covers both resolves onto the
> Servant with the Master listed in `excluded` and the reason shown in the preview.
```

- [ ] **Step 6: LIVE VISUAL check**

As **Player2** in the claude-in-chrome tab, push a spec through the live resolver:

```js
const { resolveTargets } = await import("/systems/fgt/module/rules/targeting/resolve.mjs");
const { currentBoard, unitFrom } = await import("/systems/fgt/module/engine/board.mjs");
const board = currentBoard();
const self = unitFrom(board, game.actors.get("buTLFCGAlQKOXXuy"));
const spec = {
  anchor: { kind: "withinRange", range: 5 },
  shape: { kind: "rect", w: 5, h: 5 },
  selection: { relations: ["enemy", "ally", "neutral"], chooser: "all", includeSelf: false },
  limits: { excludeUnitIds: ["SYV9LwndQdB06IBJ"] },
};
const out = resolveTargets(spec, self, board, { panel: { i: 1, j: 6 } });
({ units: out.units.map(u => u.unitId),
   excluded: out.excluded.filter(e => e.unitId === "SYV9LwndQdB06IBJ") });
```

Expected: Heracles absent from `units`, and present in `excluded` with the redirect reason.
**Screenshot the console output.**

- [ ] **Step 7: Commit**

```bash
git add module/rules/targeting/resolve.mjs test/unit/targeting.test.mjs docs/09-targeting.md
git commit -F- <<'MSG'
Targeting can exclude named units, with a reason

`limits.excludeUnitIds`, the other half of §12.8's redirect: the Master takes
nothing even from an area that covers it. Dropped through the existing `drop`
recorder so the exclusion and its reason appear in the targeting preview,
rather than filtered silently.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014irpVJJ6kDxn1GUTvChzjr
MSG
```

---

## Task A3: Wire the redirect

**Files:**
- Modify: `module/engine/combat-process.mjs` (`begin`, `beginFanOut`)
- Modify: `module/engine/attack.mjs` (the `case "counter"` rung, `runCounter`)
- Modify: `module/apps/chat/cards.mjs` (`armCounterRung`), `module/apps/hud/action-bar.mjs` (`armForCounter`, `declareCounterWith`), `module/apps/actor-sheet/sheet.mjs` (`pickPlacementFor`)
- Test: `test/unit/counter.test.mjs` (existing — append)
- Modify: `docs/12-combat-process.md`, `docs/41-open-questions.md`, `docs/45-implementation-status.md`, `CHANGELOG.md`

**Interfaces:**
- Consumes: `counterRedirect(target, board)` (A1), `limits.excludeUnitIds` (A2).
- Produces:
  - `begin({..., counterRedirectId = null})` and `beginFanOut({..., counterRedirectId = null})`
  - `ActionBar.armForCounter({ token, messageId, requiredTargetId, excludeUnitIds })`
  - `pickPlacementFor(actor, ability, { requireUnitId, excludeUnitIds })`

- [ ] **Step 1: Write the failing test**

Append to `test/unit/counter.test.mjs`:

```js
describe("the redirect travels on the Process", () => {
  it("defaults to null on every process", () => {
    expect(begin({ attackerId: "A", defenderId: "B", attack }).counterRedirectId).toBeNull();
  });

  it("is carried to every process of a fan-out", () => {
    const states = beginFanOut({
      attackerId: "A", targetIds: ["B", "C"], attack, counterRedirectId: "S",
    });
    for (const s of states) expect(s.counterRedirectId).toBe("S");
  });
});

describe("the redirect reaches the declaration", () => {
  // A source check, because the wiring lives in `engine/attack.mjs` and needs a
  // live Foundry to exercise. The property is a RULE: a Counter against a
  // shielded Master must hit the Servant and must not touch the Master, and
  // both halves have to be threaded or one silently does nothing.
  const source = readFileSync("module/engine/attack.mjs", "utf8");

  it("decides the redirect at the counter rung, beside counterAvailable", () => {
    expect(source).toMatch(/counterRedirect\(/);
  });

  it("makes the redirect target the one the Counter must catch", () => {
    expect(source).toMatch(/requiredTargetId: state\.counterRedirectId \?\? state\.attackerId/);
  });

  it("excludes the protected Master from the Counter's targets", () => {
    expect(source).toMatch(/excludeUnitIds/);
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run test/unit/counter.test.mjs`
Expected: FAIL — `counterRedirectId` is `undefined`, and the source assertions do not match.

- [ ] **Step 3: Add the field to the Process**

In `module/engine/combat-process.mjs`, add `counterRedirectId = null` to `begin`'s
destructured parameters and to the returned object, immediately after `requiredTargetId`:

```js
    // §12.8's Master redirect, decided by the orchestrator at the counter rung
    // because it needs positions. `null` when the target is not a Master, or
    // has no Servant within two panels.
    counterRedirectId,
```

Add `counterRedirectId = null` to `beginFanOut`'s parameters and pass it through in its
`begin({...})` call, beside `isCounter, requiredTargetId, counterDepth`.

- [ ] **Step 4: Decide it at the rung**

In `module/engine/attack.mjs`, the `case "counter":` block currently reads:

```js
      if (state.counterAvailable !== undefined) return process.advance(state, "done");

      const available = counterAvailable(state);
      await message.setFlag("fgt", "counter", { available });
      const marked = { ...state, counterAvailable: available };
      return available ? marked : process.advance(marked, "done");
```

Replace with:

```js
      if (state.counterAvailable !== undefined) return process.advance(state, "done");

      const available = counterAvailable(state);
      // §12.8's redirect, decided here for the same reason `counterAvailable`
      // is: it needs positions, and this file can see them while the pure
      // module cannot. Recorded once so the armed bar and the resolution cannot
      // disagree about who is being protected.
      const board = boardSnapshot();
      const redirectId = available
        ? counterRedirect(unitFrom(board, game.actors.get(state.attackerId)), board)
        : null;
      await message.setFlag("fgt", "counter", { available, redirectId });
      const marked = { ...state, counterAvailable: available, counterRedirectId: redirectId };
      return available ? marked : process.advance(marked, "done");
```

Add to the imports at the top of the file:

```js
import { counterRedirect } from "../rules/counter.mjs";
```

- [ ] **Step 5: Honour it in `runCounter`**

Still in `module/engine/attack.mjs`, inside `runCounter`, replace the `required` lookup and
the two places that name `state.attackerId` as the required target:

```js
  // §12.8: a Counter aimed at a Master whose Servant shields it hits the
  // Servant instead, and the Master takes nothing. Read off the Process rather
  // than recomputed, so this and the armed bar cannot disagree.
  const requiredId = state.counterRedirectId ?? state.attackerId;
  const excludeUnitIds = state.counterRedirectId ? [state.attackerId] : [];

  const counterer = game.actors.get(state.defenderId);
  const required = game.actors.get(requiredId);
  if (!counterer || !required) return null;
```

In the `resolveTargets` call, merge both limits:

```js
    targets = resolveTargets(
      { ...spec, limits: { ...(spec.limits ?? {}), requireUnitId: requiredId, excludeUnitIds } },
      self, board, placement,
    );
```

The no-placement default and the server-side re-check both become `requiredId`:

```js
  let targets = { units: [{ unitId: requiredId }] };
```

```js
  if (!(targets.units ?? []).some((u) => u.unitId === requiredId)) return null;
```

and the `declareProcesses` call:

```js
    requiredTargetId: state.counterRedirectId ?? state.attackerId,
```

- [ ] **Step 6: Arm the bar on the redirect target**

In `module/apps/chat/cards.mjs`, in `armCounterRung`:

```js
  ActionBar.armForCounter({
    token,
    messageId: message.id,
    // §12.8: aim at the Servant, not the Master it is shielding.
    requiredTargetId: state.counterRedirectId ?? state.attackerId,
    excludeUnitIds: state.counterRedirectId ? [state.attackerId] : [],
  });
```

In `module/apps/hud/action-bar.mjs`, `armForCounter` takes and stores the new field:

```js
  static armForCounter({ token, messageId, requiredTargetId, excludeUnitIds = [] }) {
    const bar = ActionBar.instance;
    if (!bar || !token) return;
    if (bar.counter?.messageId === messageId) return;

    token.control({ releaseOthers: true });
    bar.token = token;
    bar.counter = { messageId, requiredTargetId, excludeUnitIds };
    bar.render({ force: true });
  }
```

and `declareCounterWith` passes it on:

```js
    const placement = await pickPlacementFor(actor, item, {
      requireUnitId: armed.requiredTargetId,
      excludeUnitIds: armed.excludeUnitIds ?? [],
    });
```

In `module/apps/actor-sheet/sheet.mjs`, `pickPlacementFor` accepts and merges it:

```js
export async function pickPlacementFor(actor, ability, { requireUnitId = null, excludeUnitIds = [] } = {}) {
```

```js
  const spec = (requireUnitId || excludeUnitIds.length > 0)
    ? { ...base, limits: { ...(base.limits ?? {}), requireUnitId, excludeUnitIds } }
    : base;
```

- [ ] **Step 7: Run everything**

Run: `npx vitest run test/unit/counter.test.mjs` — expected PASS.
Run: `npm run lint` — expected clean.
Run: `npx vitest run` — expected 2650 + this part's new tests.

- [ ] **Step 8: LIVE VISUAL check — a Master attacks and is shielded**

Three sessions. Setup, as **GM**:

```js
// Give Player1 a Master with a Servant standing beside it, and heal both.
const fm = game.actors.get("7Vq3qg04Sh1ivtMr");
await fm.update({ "system.factionId": "faction-1", "ownership.yVevT9Da3egFpXeO": 3,
                  "system.health.value": 1000 });
// Heracles guards it: put him within two panels of the Master.
// Confirm the panels afterwards with `currentBoard()` rather than trusting x/y.
```

Move Heracles beside Foe Master (as GM, `token.update({x, y})` is refused by the movement
hooks — use `{ fgtForced: true }` as `engine/scene-levels.mjs` does, or place them by
dragging in the GM's own canvas).

1. As **Player1**, have **Foe Master** attack Karna.
2. As **Player2**, Block, so the ladder reaches the Counter rung.
3. **Screenshot Player2's screen.** Expected: the bar arms as before.
4. Confirm the redirect was recorded:
   ```js
   const p = JSON.parse(game.messages.contents.at(-1).getFlag("fgt", "process"));
   ({ attacker: game.actors.get(p.attackerId)?.name,
      redirect: game.actors.get(p.counterRedirectId)?.name });
   ```
   Expected: attacker **Foe Master**, redirect **Heracles**.
5. Click a glowing ability and hover over the **Master's** panel.
   **Screenshot.** Expected: the Master is listed under **NOT TARGETED** with
   *"protected by its Servant; the Counter is redirected"*, and the aim is **Illegal**
   unless the area also catches Heracles.
6. Hover so the area catches **Heracles**. **Screenshot.** Expected: **Legal**, Heracles in
   the target list, the Master still excluded.
7. Confirm and screenshot the resulting card. Expected: the counter resolves against
   Heracles; the Master's Health is unchanged.

- [ ] **Step 9: Documentation, Ch. 41, and the changelog**

`docs/45-implementation-status.md` — in the Chapter 12 row, replace
*"**Still missing: the Master redirect** — countering a Master whose Servant is within 2
panels should redirect to the Servant, and nothing implements it."* with:

```markdown
**§12.8's Master redirect is built** (`rules/counter.mjs#counterRedirect`): the Servant becomes the unit the Counter must catch and the Master is excluded from its targets. The chapter's "regardless of range" decision is narrowed — the chosen ability's reach applies, and the Master is protected either way.
```

`docs/41-open-questions.md` — add a row recording the narrowing, in the format that file
already uses for answered questions: the question is *"Does a redirected Counter ignore the
counter-attacker's range?"*, and the answer is that it does not, because the counterer now
chooses the ability and its reach is a targeting rule; the Master is protected regardless.

`CHANGELOG.md`, under `## [Unreleased]` in `### Added`:

```markdown
- **The Master redirect (Ch. 12 §12.8).** A Counter aimed at a Master whose Servant stands
  within two panels hits the **Servant** instead, and the Master takes nothing even from an
  area that covers it. Specified since the chapter was written and implemented nowhere.
  Distinct from §16.4's general protection, which is one panel, applies to every attack, and
  refuses rather than retargets. The chapter's *"regardless of range"* decision is narrowed:
  the chosen ability's reach applies, because a Counter is now a real attack declaration
  rather than an auto-aimed Normal Attack — and the Master is protected either way, since a
  counterer who cannot reach the Servant counters nobody.
```

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -F- <<'MSG'
Wire the Master redirect

A Counter aimed at a Master whose Servant stands within two panels now hits the
Servant, and the Master is dropped from the targets even when the area covers
it. Decided by the orchestrator at the counter rung and recorded as
`counterRedirectId`, so the armed bar and the resolution cannot disagree about
who is being protected.

Narrows D12.8: the chosen ability's reach still applies. "Regardless of range"
was written when a Counter was always an auto-aimed Normal Attack.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014irpVJJ6kDxn1GUTvChzjr
MSG
```

---

# PART B — The pending-decisions window

## Task B1: `pendingRowsFor`, the pure presenter

**Files:**
- Create: `module/apps/hud/pending-present.mjs`
- Test: `test/unit/pending-present.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```js
  pendingRowsFor(entries, viewer) -> Array<{
    messageId, unitId, unitName, unitImg, kind, label, countdown, expired,
    isCounter, commandSpells,
  }>
  ```
  An `entry` is `{messageId, unitId, unitName, unitImg, kind, owned, countdown, commandSpells}` — already read off a message by the app, so this half needs no Foundry.

- [ ] **Step 1: Write the failing test**

Create `test/unit/pending-present.test.mjs`:

```js
/**
 * @file What the pending-decisions window lists.
 * @see module/apps/hud/pending-present.mjs, docs/27-reaction-protocol.md §27.5
 *
 * An AoE attack already fans out to one ladder PER DEFENDER. Own four units,
 * have a Noble Phantasm catch three, and there are three prompts in a scrolling
 * log — each with a clock, and §27.5's default on expiry is the option that
 * spends nothing. Nothing in the system answered "what is waiting for me?"
 */
import { describe, it, expect } from "vitest";
import { pendingRowsFor } from "../../module/apps/hud/pending-present.mjs";

const entry = (over = {}) => ({
  messageId: "m1", unitId: "u1", unitName: "Rider", unitImg: "rider.webp",
  kind: "reaction", owned: true, countdown: null, commandSpells: 0, ...over,
});
const viewer = { id: "p1", isGM: false };

describe("pendingRowsFor", () => {
  it("lists a prompt for a unit this viewer owns", () => {
    expect(pendingRowsFor([entry()], viewer)).toHaveLength(1);
  });

  it("omits a prompt for a unit this viewer does not own", () => {
    // The window is YOUR list. Somebody else's decision is not yours to see.
    expect(pendingRowsFor([entry({ owned: false })], viewer)).toEqual([]);
  });

  it("keeps a Command Spell offer even when the rung is not the viewer's", () => {
    // §17.4's interrupt: a Master may spend into somebody else's exchange, so
    // the offer is the viewer's business even though the rung is not.
    const rows = pendingRowsFor([entry({ owned: false, commandSpells: 2 })], viewer);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("commandSpell");
  });

  it("sorts the soonest clock first", () => {
    // A player with three prompts and one about to expire should not have to
    // find it.
    const rows = pendingRowsFor([
      entry({ messageId: "slow", countdown: { ms: 40000, label: "0:40" } }),
      entry({ messageId: "urgent", countdown: { ms: 4000, label: "0:04" } }),
      entry({ messageId: "mid", countdown: { ms: 20000, label: "0:20" } }),
    ], viewer);
    expect(rows.map((r) => r.messageId)).toEqual(["urgent", "mid", "slow"]);
  });

  it("puts rows with no clock after every row that has one", () => {
    const rows = pendingRowsFor([
      entry({ messageId: "none" }),
      entry({ messageId: "timed", countdown: { ms: 30000, label: "0:30" } }),
    ], viewer);
    expect(rows.map((r) => r.messageId)).toEqual(["timed", "none"]);
  });

  it("marks an expired row so the UI can shout about it", () => {
    const rows = pendingRowsFor([entry({ countdown: { ms: 0, label: "0:00" } })], viewer);
    expect(rows[0].expired).toBe(true);
  });

  it("marks a Counter rung, which is the one that arms the bar", () => {
    expect(pendingRowsFor([entry({ kind: "counter" })], viewer)[0].isCounter).toBe(true);
    expect(pendingRowsFor([entry({ kind: "reaction" })], viewer)[0].isCounter).toBe(false);
  });

  it("gives each kind a localisable label key", () => {
    expect(pendingRowsFor([entry({ kind: "reaction" })], viewer)[0].label).toBe("FGT.Prompt.reaction");
    expect(pendingRowsFor([entry({ kind: "counter" })], viewer)[0].label).toBe("FGT.Prompt.counter");
  });

  it("returns nothing for an empty board, rather than throwing", () => {
    expect(pendingRowsFor([], viewer)).toEqual([]);
    expect(pendingRowsFor(undefined, viewer)).toEqual([]);
  });

  it("shows a GM every prompt, because the GM answers for absent players", () => {
    // §27.5's "decide for them" lives on the card; the GM needs to find it.
    expect(pendingRowsFor([entry({ owned: false })], { id: "gm", isGM: true })).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run test/unit/pending-present.test.mjs`
Expected: FAIL — `Failed to resolve import`.

- [ ] **Step 3: Write the presenter**

Create `module/apps/hud/pending-present.mjs`:

```js
/**
 * @file What the pending-decisions window lists, and in what order.
 * @see docs/27-reaction-protocol.md §27.5, docs/29-user-interface.md
 *
 * Pure. The app scans the chat log and reads the flags; this decides what is
 * shown, so the ordering and the ownership rule are testable without Foundry —
 * the same split `hud/present.mjs` uses for the action bar.
 *
 * The problem this exists for: an AoE attack already fans out to one ladder PER
 * DEFENDER. Own four units, have a Noble Phantasm catch three, and there are
 * three prompts in a scrolling log, each with a clock, and §27.5's default on
 * expiry is the option that spends nothing. Nothing answered "what is the game
 * waiting for me to do?"
 */

/** Prompt kinds, mapped to the localisation keys the cards already use. */
const LABELS = Object.freeze({
  reaction: "FGT.Prompt.reaction",
  counter: "FGT.Prompt.counter",
  luckCheck: "FGT.Prompt.luckCheck",
  acceptOrEscape: "FGT.Prompt.acceptOrEscape",
  commandSpell: "FGT.Prompt.commandSpell",
});

/**
 * The rows this viewer should see, soonest deadline first.
 *
 * A row survives when the viewer owns the unit being asked, when the viewer is
 * the GM (who answers for absent players through §27.5's "decide for them"), or
 * when the viewer has a Command Spell to spend into the exchange — §17.4's
 * interrupt is the one decision that is yours on somebody else's rung.
 *
 * @param {object[]} entries already read off the messages by the app
 * @param {{id: string, isGM?: boolean}} viewer
 * @returns {object[]}
 */
export function pendingRowsFor(entries, viewer) {
  const rows = [];
  for (const e of entries ?? []) {
    const mine = e.owned || Boolean(viewer?.isGM);
    const spells = e.commandSpells ?? 0;
    if (!mine && spells === 0) continue;

    // A rung that is not the viewer's, surfaced only because they may spend
    // into it, is labelled for what it actually offers them.
    const kind = mine ? e.kind : "commandSpell";
    rows.push({
      messageId: e.messageId,
      unitId: e.unitId,
      unitName: e.unitName,
      unitImg: e.unitImg,
      kind,
      label: LABELS[kind] ?? "FGT.Prompt.reaction",
      countdown: e.countdown ?? null,
      expired: (e.countdown?.ms ?? null) === 0,
      isCounter: kind === "counter",
      commandSpells: spells,
    });
  }

  // Soonest clock first; anything without one goes last. A player with three
  // prompts and four seconds on one of them should not have to find it.
  return rows.sort((a, b) => {
    const left = a.countdown?.ms ?? Infinity;
    const right = b.countdown?.ms ?? Infinity;
    return left - right;
  });
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run test/unit/pending-present.test.mjs`
Expected: PASS, 10 tests.

Run: `npm run lint` — expected clean.

- [ ] **Step 5: LIVE VISUAL check**

Nothing renders yet, so confirm the module loads in the world and the ordering is right on
real data shapes. As **Player2** in the claude-in-chrome tab:

```js
const { pendingRowsFor } = await import("/systems/fgt/module/apps/hud/pending-present.mjs");
pendingRowsFor([
  { messageId: "a", unitId: "u", unitName: "Lancer", unitImg: null, kind: "reaction", owned: true, countdown: { ms: 40000, label: "0:40" }, commandSpells: 0 },
  { messageId: "b", unitId: "u", unitName: "Lancer", unitImg: null, kind: "counter", owned: true, countdown: { ms: 5000, label: "0:05" }, commandSpells: 0 },
], { id: game.user.id, isGM: game.user.isGM }).map(r => [r.messageId, r.label, r.countdown?.label]);
```

Expected: `b` first. **Screenshot the console output**, and confirm the world still draws
with no errors.

- [ ] **Step 6: Commit**

```bash
git add module/apps/hud/pending-present.mjs test/unit/pending-present.test.mjs
git commit -F- <<'MSG'
What the pending-decisions window lists

Pure: entries plus a viewer become sorted rows. Your own prompts, the GM's
everything, and anyone's rung you hold a Command Spell for. Soonest clock
first, because a player with three prompts and four seconds on one of them
should not have to find it.

Renders nothing yet.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014irpVJJ6kDxn1GUTvChzjr
MSG
```

---

## Task B2: The window

**Files:**
- Create: `module/apps/hud/pending-panel.mjs`, `templates/hud/pending-panel.hbs`
- Modify: `module/fgt.mjs`, `styles/src/_apps.scss`, `lang/en.json`
- Test: `test/unit/styles.test.mjs` (existing — it runs unchanged; the new class must not collide)

**Interfaces:**
- Consumes: `pendingRowsFor` (B1); `pendingPrompt` and `deserialize` from `module/engine/combat-process.mjs`; `countdownFor` from `module/engine/await-timeout.mjs`; `publicIdentityOf` from `module/engine/public-identity.mjs`; `currentBoard` from `module/engine/board.mjs`.
- Produces: `PendingPanel.attach()`, and `PendingPanel.instance`.

- [ ] **Step 1: Write the app**

Create `module/apps/hud/pending-panel.mjs`:

```js
/**
 * @file One place that answers "what is the game waiting for me to do?"
 * @see docs/27-reaction-protocol.md §27.5, docs/29-user-interface.md
 *
 * Layer 4. Thin by construction: it scans the chat log, reads flags, and hands
 * plain entries to `pending-present.mjs`. It decides no rules and answers no
 * prompts — a row jumps to its card, where the buttons and their refusal
 * reasons already live. A second set of buttons here would be a second place to
 * keep in step with the first.
 *
 * It exists only while something is pending. A player with nothing to answer
 * has no window at all, rather than an empty panel taking up canvas.
 */

import { pendingRowsFor } from "./pending-present.mjs";
import { pendingPrompt, deserialize, windowFor } from "../../engine/combat-process.mjs";
import { countdownFor } from "../../engine/await-timeout.mjs";
import { publicIdentityOf } from "../../engine/public-identity.mjs";
import { currentBoard } from "../../engine/board.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class PendingPanel extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "fgt-pending-panel",
    classes: ["fgt", "pending-panel"],
    position: { width: "auto", height: "auto" },
    window: { frame: false, positioned: false },
    actions: { jump: PendingPanel.onJump },
  };

  static PARTS = {
    body: { template: "systems/fgt/templates/hud/pending-panel.hbs" },
  };

  /** The singleton. */
  static instance = null;

  /** The 1s tick that moves the clocks, or null. @type {number|null} */
  #tick = null;

  /** Show the panel and keep it current. Idempotent. */
  static attach() {
    if (PendingPanel.instance) return PendingPanel.instance;
    const panel = new PendingPanel();
    PendingPanel.instance = panel;

    // Debounced for the same reason the action bar's refresh is: resolving one
    // rung can raise `updateChatMessage` several times in a breath, and each
    // was otherwise a full render.
    const refresh = foundry.utils.debounce(() => panel.sync(), 80);
    Hooks.on("createChatMessage", refresh);
    Hooks.on("updateChatMessage", refresh);
    Hooks.on("deleteChatMessage", refresh);

    panel.sync();
    console.log("FGT | Pending decisions attached");
    return panel;
  }

  /**
   * Render when there is something to answer, close when there is not.
   *
   * @returns {Promise<void>}
   */
  async sync() {
    const rows = this.rows();
    if (rows.length === 0) {
      this.#stopTicking();
      if (this.rendered) await this.close();
      return;
    }
    await this.render({ force: true });
    // Only while a clock is actually shown. A timer running against a list of
    // untimed prompts is a wake-up every second for no change on screen.
    if (rows.some((r) => r.countdown)) this.#startTicking();
    else this.#stopTicking();
  }

  /** @returns {object[]} */
  rows() {
    const board = currentBoard();
    const viewer = { id: game.user.id, isGM: game.user.isGM };
    const entries = [];

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

      entries.push({
        messageId: message.id,
        unitId: actor.id,
        // PUBLIC, even in the viewer's own list. A concealed Servant's true
        // name must not leak in here from a card that is correctly hiding it.
        unitName: publicIdentityOf(actor, board).name,
        unitImg: publicIdentityOf(actor, board).img,
        kind: prompt.kind,
        owned: actor.isOwner,
        countdown: this.#countdown(message),
        commandSpells: windowFor(state) ? this.#spendableSpells() : 0,
      });
    }
    return pendingRowsFor(entries, viewer);
  }

  /**
   * The clock, with the milliseconds the ordering needs.
   *
   * `countdownFor` returns a label and an `expired` flag, which is everything a
   * CARD needs and not enough to sort by. The remaining time is recovered from
   * the label rather than by reaching into the timeout module's internals: the
   * label is the contract, and a mis-parse costs an ordering rather than a
   * decision.
   *
   * @param {object} message
   * @returns {{ms: number, label: string}|null}
   */
  #countdown(message) {
    const c = countdownFor(message);
    if (!c) return null;
    const [minutes, seconds] = String(c.label).split(":").map(Number);
    const ms = Number.isFinite(minutes) && Number.isFinite(seconds)
      ? (minutes * 60 + seconds) * 1000
      : Infinity;
    return { ms: c.expired ? 0 : ms, label: c.label };
  }

  /**
   * How many Command Spells this viewer's Masters could spend right now.
   *
   * `system.commandSpells` is a plain NumberField on `data/actor/master.mjs`,
   * not a `{value, max}` pair -- reaching for `.value` yields `undefined` and
   * silently hides every Command Spell row.
   */
  #spendableSpells() {
    return game.actors
      .filter((a) => a.type === "master" && a.isOwner)
      .reduce((sum, m) => sum + (m.system?.commandSpells ?? 0), 0);
  }

  #startTicking() {
    if (this.#tick !== null) return;
    this.#tick = window.setInterval(() => {
      if (this.rendered) this.render();
    }, 1000);
  }

  #stopTicking() {
    if (this.#tick === null) return;
    window.clearInterval(this.#tick);
    this.#tick = null;
  }

  /** @inheritdoc */
  async _prepareContext() {
    const rows = this.rows();
    return {
      rows: rows.map((r) => ({ ...r, labelText: game.i18n.localize(r.label) })),
      count: rows.length,
    };
  }

  /** @inheritdoc */
  async close(options) {
    this.#stopTicking();
    return super.close(options);
  }

  /**
   * Scroll the chat to this row's card and flash it.
   *
   * It does NOT answer the prompt. The card carries the buttons, their costs
   * and their refusal reasons; a second set here would be a second place to
   * keep in step, and the first thing to fall out of step is always the reason
   * a button is disabled.
   *
   * @this {PendingPanel}
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   */
  static async onJump(_event, target) {
    const id = target.closest("[data-message-id]")?.dataset?.messageId;
    if (!id) return;

    const el = document.querySelector(`.chat-message[data-message-id="${id}"]`);
    if (!el) {
      ui.notifications.warn(game.i18n.localize("FGT.Pending.CardNotFound"));
      return;
    }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.add("fgt-pending-flash");
    window.setTimeout(() => el.classList.remove("fgt-pending-flash"), 1200);
  }
}
```

- [ ] **Step 2: Write the template**

Create `templates/hud/pending-panel.hbs`:

```hbs
{{!-- §27.5. Exists only while something is pending; `sync` closes it otherwise,
      so there is no empty state to design. --}}
<div class="fgt-pending">
  <div class="fgt-pending__head">
    <span class="fgt-pending__title">{{localize "FGT.Pending.Title"}}</span>
    <span class="fgt-pending__count">{{count}}</span>
  </div>

  <ul class="fgt-pending__rows">
    {{#each rows as |row|}}
      <li class="fgt-pending__row{{#if row.expired}} fgt-pending__row--expired{{/if}}{{#if row.isCounter}} fgt-pending__row--counter{{/if}}"
          data-message-id="{{row.messageId}}">
        <button type="button" class="fgt-pending__jump" data-action="jump"
                data-tooltip="{{localize 'FGT.Pending.Jump'}}">
          {{#if row.unitImg}}<img class="fgt-pending__art" src="{{row.unitImg}}" alt="">{{/if}}
          <span class="fgt-pending__unit">{{row.unitName}}</span>
          <span class="fgt-pending__kind">{{row.labelText}}</span>
          {{#if row.countdown}}
            <span class="fgt-pending__clock">{{row.countdown.label}}</span>
          {{/if}}
        </button>
      </li>
    {{/each}}
  </ul>
</div>
```

- [ ] **Step 3: Strings**

In `lang/en.json`, beside the other `FGT.Prompt.*` keys:

```json
  "FGT.Pending.Title": "Awaiting you",
  "FGT.Pending.Jump": "Go to this card",
  "FGT.Pending.CardNotFound": "That card is no longer in the chat log.",
```

`FGT.Prompt.reaction`, `FGT.Prompt.luckCheck`, `FGT.Prompt.acceptOrEscape`,
`FGT.Prompt.counter` and `FGT.Prompt.commandSpell` **all already exist** (`lang/en.json`
lines 107–111) — the cards localise them today, and `pending-present.mjs` reuses those exact
keys so the window and the card can never call the same rung two different things.

- [ ] **Step 4: Styles**

In `styles/src/_apps.scss`, at top level. **`test/unit/styles.test.mjs` fails if a class is
defined in two partials**, so `fgt-pending` must be new:

```scss
// §27.5's queue. Top-right: clear of the action bar at the bottom and the
// sidebar at the right, and out of the way of the token being asked about.
.fgt-pending {
  position: fixed;
  top: 4rem;
  right: 21rem;
  z-index: 60;
  max-width: 18rem;
  padding: 0.35rem 0.4rem;
  border: 1px solid rgba(255, 214, 128, 0.4);
  border-radius: 5px;
  background: rgba(20, 18, 15, 0.88);
  font-size: 0.78rem;

  &__head { display: flex; gap: 0.4rem; align-items: baseline; padding: 0 0.2rem 0.25rem; }
  &__title { font-weight: 700; letter-spacing: 0.02em; color: rgba(255, 214, 128, 0.95); }
  &__count { margin-left: auto; opacity: 0.7; }

  &__rows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.15rem; }

  &__jump {
    display: flex; align-items: center; gap: 0.4rem;
    width: 100%; padding: 0.2rem 0.3rem;
    border: 1px solid transparent; border-radius: 3px;
    background: rgba(255, 255, 255, 0.05);
    color: inherit; text-align: left; cursor: pointer;

    &:hover { background: rgba(255, 255, 255, 0.12); }
  }

  &__art { width: 1.4rem; height: 1.4rem; object-fit: cover; border-radius: 2px; }
  &__unit { font-weight: 600; }
  &__kind { opacity: 0.75; }
  &__clock { margin-left: auto; font-variant-numeric: tabular-nums; }

  // A Counter is the rung that arms the bar, so it is worth telling apart.
  &__row--counter .fgt-pending__jump { border-color: rgba(255, 176, 32, 0.55); }
  // §27.5's default on expiry spends nothing, which is a real loss of agency.
  &__row--expired .fgt-pending__clock { color: #d9534f; font-weight: 700; }
}

// The flash a jumped-to card gets, so the eye lands on the right one.
.fgt-pending-flash {
  animation: fgt-pending-flash 1.2s ease-out;
}

@keyframes fgt-pending-flash {
  0% { box-shadow: 0 0 0 2px rgba(255, 214, 128, 0.9); }
  100% { box-shadow: 0 0 0 2px rgba(255, 214, 128, 0); }
}
```

Run: `npm run build:styles`
Run: `npx vitest run test/unit/styles.test.mjs` — expected PASS (one owner per class).

- [ ] **Step 5: Attach it**

In `module/fgt.mjs`, beside `ActionBar.attach()`:

```js
import { PendingPanel } from "./apps/hud/pending-panel.mjs";
```

```js
  // §27.5: one place that answers "what is the game waiting for me to do?" An
  // AoE already fans out to one ladder per defender, so a player with four
  // units can have three prompts in a scrolling log, each with a clock.
  PendingPanel.attach();
```

- [ ] **Step 6: Run everything**

Run: `npm run lint` — expected clean. If it reports `no-console`, add
`"module/apps/hud/pending-panel.mjs"` to the allow-list block in `eslint.config.mjs` beside
`module/apps/hud/action-bar.mjs`.
Run: `npx vitest run` — expected green.
Run: `npm run check:templates` — expected `0 problem(s)`.

- [ ] **Step 7: LIVE VISUAL check — rows appear and disappear**

Three sessions. Reset the budgets as GM first.

1. As **Player1**, attack Karna.
2. **Screenshot Player2's screen immediately.** Expected: the panel is visible top-right,
   titled "Awaiting you", with **one** row naming **Lancer** and the reaction prompt, and a
   clock counting down.
3. Wait five seconds and screenshot again. Expected: **the clock has moved.**
4. As Player2, answer the prompt (Block).
5. **Screenshot.** Expected: the row becomes the Counter rung (marked), or the panel
   disappears entirely once nothing is pending.
6. Answer or decline everything, then **screenshot**: no panel at all.
7. Check the panel does not appear for a player with nothing pending: **screenshot
   Player1's screen** during step 2. Expected: no panel (the prompt is Player2's).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -F- <<'MSG'
The pending-decisions window

One place that answers "what is the game waiting for me to do?" An AoE already
fans out to one ladder per defender, so a player with four units can have three
prompts in a scrolling log, each with a clock whose default on expiry spends
nothing.

Soonest clock first. Exists only while something is pending. Public names, even
in the viewer's own list -- a concealed Servant's true name must not leak in
here from a card that is correctly hiding it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014irpVJJ6kDxn1GUTvChzjr
MSG
```

---

## Task B3: Jumping, and the fan-out case that motivated it

**Files:**
- Modify: `module/apps/hud/pending-panel.mjs` (only if the live check finds a defect)
- Modify: `docs/27-reaction-protocol.md`, `docs/29-user-interface.md`, `docs/45-implementation-status.md`, `CHANGELOG.md`

**Interfaces:**
- Consumes: everything from B2.
- Produces: no new API. This task's deliverable is the verified behaviour and its documentation.

- [ ] **Step 1: LIVE VISUAL check — the case the window exists for**

The whole point is several prompts at once. Build it.

As **GM**, give Player2 three units standing together, and reset budgets:

```js
for (const id of ["buTLFCGAlQKOXXuy", "qtt3XUO3UkfwPWtt", "80M07qU3J7CiZiTz"]) {
  const a = game.actors.get(id);
  await a.update({ "system.factionId": "faction-2", "ownership.vL77HYG9fUm8uOwI": 3,
                   "system.health.value": a.system.health.max });
}
```

Place all three within one area (drag them together in the GM's canvas), then as
**Player1** use an area Noble Phantasm that catches all three — Medusa's Bellerophon, a
13-long line, is the one already proven to fan out. Top up her Sustainability and clear her
cooldown as GM first if refused.

1. **Screenshot Player2's screen.** Expected: **three rows**, each naming its own unit by
   its **public** name, each with its own clock, **sorted with the shortest clock first**.
2. **Zoom into the panel** and read it. Confirm the count reads 3.

- [ ] **Step 2: LIVE VISUAL check — jumping**

3. Scroll Player2's chat log to the top, so none of the three cards is in view.
4. Click the **third** row's button.
5. **Screenshot.** Expected: the log has scrolled so that row's card is centred, and the
   card is flashing with a gold outline.
6. Confirm it did **not** answer anything: the prompt's buttons are still there, unpressed.
   **Screenshot the card.**

- [ ] **Step 3: LIVE VISUAL check — concealment**

7. Confirm a row for a concealed Servant shows its **class name**, not its true name.
   Cross-check against the card's own header, which is already public:
   ```js
   const rowNames = [...document.querySelectorAll('.fgt-pending__unit')].map(e => e.textContent.trim());
   const cardAliases = game.messages.contents.slice(-3).map(m => m.speaker?.alias);
   ({ rowNames, cardAliases });
   ```
   Expected: the two agree. **Screenshot.**

- [ ] **Step 4: Fix anything the three checks found**

If a check fails, fix it in `module/apps/hud/pending-panel.mjs` and repeat that check.
Do not proceed with a failing screenshot. Record what was wrong in the commit message —
the live checks in this branch have caught three defects that no test could see, and the
record of what they were is the argument for keeping them.

- [ ] **Step 5: Documentation**

`docs/27-reaction-protocol.md` §27.5 — append:

```markdown
> **Implementation note.** §27.5's clock is per card, and a player can hold several at once:
> an AoE fans out to one ladder per defender, so owning four units and being caught by one
> Noble Phantasm means three prompts in a scrolling log. `apps/hud/pending-panel.mjs` lists
> them, soonest deadline first, and a row jumps to its card. It answers nothing itself —
> the card carries the buttons, their costs and their refusal reasons, and a second set
> would be a second place to keep in step.
```

`docs/29-user-interface.md` — add a short section describing the panel: position, that it
exists only while something is pending, that it lists the viewer's own prompts plus any rung
they hold a Command Spell for, and that names are public.

`docs/45-implementation-status.md` — update the Chapter 27 row to record the window.

`CHANGELOG.md`, under `## [Unreleased]` in `### Added`:

```markdown
- **A pending-decisions window (Ch. 27 §27.5).** One place that answers "what is the game
  waiting for me to do?" An AoE attack already fans out to one ladder per defender, so
  owning four units and being caught by one Noble Phantasm meant three prompts in a
  scrolling chat log, each with a clock whose default on expiry spends nothing. The window
  lists them soonest-deadline-first, marks the Counter rung that arms the action bar, and a
  row jumps to its card. It answers nothing itself, and it exists only while something is
  pending.
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -F- <<'MSG'
Verify the pending window against the case it exists for

Three prompts at once from one area Noble Phantasm, sorted by clock, each
jumping to its own card without answering it, and every unit named publicly so
a concealed Servant's true name does not leak into a list its own card is
hiding.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014irpVJJ6kDxn1GUTvChzjr
MSG
```

---

## Self-review against the spec

| Spec section | Task |
|---|---|
| A1 the rule, both effects | A1 (`counterRedirect`), A2 (`excludeUnitIds`), A3 (wiring) |
| A2 distinct from §16.4 | A1 Step 3's comment, A1 Step 6's doc note |
| A3 reach narrowing | A3 Step 9 (Ch. 41 + Ch. 45 + CHANGELOG) |
| A4 decided at the rung as `counterRedirectId` | A3 Steps 3–4 |
| A5 downstream readers | A3 Steps 5–6 |
| A5 automatic counters out of scope | Nothing to build; A3's doc note records the constraint that they must route through `runCounter` |
| B1 the problem | B1's file docstring, B3 Step 1's live check |
| B2 scope: card prompts only, own decisions | B1 Steps 1–3 |
| B3 row shape, ordering, public names | B1 (shape, ordering), B2 (`publicIdentityOf`), B3 Step 3 |
| B4 appears/disappears, jumps, position, refresh | B2 Steps 1–5, B3 Step 2 |
| B5 interaction with the armed bar | B2's `--counter` row class; B3 Step 1's screenshot shows both |

**Known hazards, stated on purpose:**

1. **`#countdown` parses a label.** `countdownFor` returns `{label, expired, canDecideForThem}` and no raw milliseconds. Parsing `"0:47"` back is a small indignity; the alternative is exporting the deadline from `await-timeout.mjs`, which is a wider change than this window justifies. If the label format ever changes, the ordering degrades to insertion order and nothing breaks — the comment in the code says so.
2. **Part A's live check needs tokens moved**, and `token.update({x, y})` is refused by the movement hooks. Drag them in the GM's own canvas, or pass `{ fgtForced: true }` as `engine/scene-levels.mjs` does.
3. **Foe Master is at 0 Health** at the head of this branch, killed during the previous part's live testing. A3's setup heals it; without that the counter rung never appears, because `canCounter` requires a living defender — and the failure looks like the redirect not working.
4. **§16.4's Master protection is gated on `isChosen` and §12.8's redirect must not be.** The existing block only refuses a *directly chosen* Master, on purpose, so that an area may still catch one incidentally — Cover depends on it. Putting the new exclusion inside that block would make the redirect silently do nothing for exactly the case it exists for: an area Counter that covers the Master. A2 Step 3 spells out the placement.
5. **`system.commandSpells` is a plain number**, not `{value, max}`. Reaching for `.value` yields `undefined`, and the only symptom is that Command Spell rows never appear in the window.
