# Nursery Rhyme, Part 2 — the summons — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trump Soldiers on the board, the Jabberwock beside her, and a Vorpal Blade lying on a panel that can kill it.

**Architecture:** Two phases. Phase 1 makes the six engine changes in dependency order, each with its reader in the same task — three of them are fields that already exist on a schema and are read by nobody. Phase 2 authors the six content files and walks them on a live board.

**Tech Stack:** Foundry VTT v14, ES modules, JSDoc typing, Vitest, YAML content compiled to LevelDB packs. Layer discipline `domain → rules → engine → apps` is enforced by ESLint.

**Spec:** `docs/superpowers/specs/2026-09-16-nursery-2-summons-design.md` — read it before Task 1, **including its five correction blocks**. Three of this part's six engine changes were found by reading code the spec's first draft had called free.

## Global Constraints

- **Part 2 of 4.** It depends on **Part 1** (`nursery-rhyme.yml` must exist) and must not assume Parts 3 or 4. Her Servant file gains **two** refs here, taking it from 9 to 11.
- **Three Collected fields.** `expiresAt`, `equipped`, and `acquisitionTarget`'s missing item parameter are all present on a schema and read by nobody. Ch. 45 calls this the project's dominant defect. **Every task here lands its reader in the same commit as its writer** — a task that writes a field and stops is this plan failing in exactly the way it was written to avoid.
- **Layer boundaries.** `module/domain` and `module/rules` are pure. `npm run lint` runs `tools/check-layers.mjs`.
- **Both allowlists.** Any new authored field goes in `actorSystem()`/`itemSystem()` in `tools/lib/content.mjs` **and** `AUTHORED_ACTOR_KEYS`/`AUTHORED_ITEM_KEYS` in `module/content/authored-fields.mjs`. Six silent defaults have already shipped this way.
- **`npm test`, `npm run lint` and `npm run validate:content` must pass at every commit.**
- **Rebuilding packs needs the world shut down.** `node tools/fgt-world.mjs shutdown` → `npm run build:packs` → `launch` → rejoin.
- **The figures are the sheet's.** Trump Soldier: Health 200, Agility 10, Luck 6, MOV 4, Range 2/1, BA(STR) 75. Jabberwock: Health 1500, Agility 6, Luck 6, MOV 3, Range 2/1, BA(STR) 200.
- **Commit messages** end with:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN
  ```

---

# Phase 1 — six engine changes

---

### Task 1: A summon with a clock (E5, R7, R8 — clauses J10, J15, J18)

**Files:**
- Create: `module/rules/summons.mjs`
- Modify: `module/engine/summoning.mjs` (`placeSummons` — write `expiresAt`)
- Modify: `module/engine/scheduler.mjs` (the round-end pass — read it)
- Modify: `module/engine/applier.mjs`, `module/engine/cooldown.mjs`
- Modify: `module/content/authored-fields.mjs`, `tools/lib/content.mjs`
- Test: `test/unit/nursery-summons.test.mjs` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: a summon-spec field `duration: "<tick expression>"`, written to `summon.system.expiresAt` as an **absolute** tick; `expiredSummonIds(board, tick)` exported pure from `module/rules/summons.mjs`; and a `dismissSummon` intent that starts a `countFrom: "destroyed"` cooldown on the summoning ability.

**Why this task is first.** `expiresAt` is on `module/data/actor/simple.mjs:37` and the only thing that reads it is the actor sheet's context builder, which displays it. Nothing writes it; nothing dismisses a summon when it passes. R7's cooldown and R8's extension both have nothing to attach to until this exists.

- [ ] **Step 1: Write the failing test**

Create `test/unit/nursery-summons.test.mjs`:

```js
/**
 * @file Nursery Rhyme's summons, against her sheet.
 * @see char_orig_sheets/Copia de Nursery Rhyme.md
 *
 * Part 2 of four. Pinned to the SHEET; every `it` names the clause it holds.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { expiredSummonIds } from "../../module/rules/summons.mjs";

const summon = (id) => parse(readFileSync(`packs/_source/summons/${id}.yml`, "utf8"));
const ability = (id) => parse(readFileSync(`packs/_source/abilities/${id}.yml`, "utf8"));
const servant = (id) => parse(readFileSync(`packs/_source/servants/${id}.yml`, "utf8"));

describe("E5 - a summon that goes away on its own", () => {
  it("names a summon whose expiry has passed", () => {
    const board = { units: [
      { id: "jab", kind: "summon", expiresAt: 12 },
      { id: "soldier", kind: "summon", expiresAt: null },
      { id: "nursery", kind: "servant", expiresAt: 3 },
    ] };
    expect(expiredSummonIds(board, 12)).toEqual(["jab"]);
  });

  it("does NOT name one whose expiry is still ahead", () => {
    const board = { units: [{ id: "jab", kind: "summon", expiresAt: 13 }] };
    expect(expiredSummonIds(board, 12)).toEqual([]);
  });

  it("ignores a summon with no clock at all", () => {
    // Every summon before the Jabberwock. A Dragon Tooth Warrior stays until
    // something kills it, and must not be swept up by this pass.
    const board = { units: [{ id: "dtw", kind: "summon", expiresAt: null }] };
    expect(expiredSummonIds(board, 99999)).toEqual([]);
  });

  it("ignores a STRUCTURE carrying an expiry", () => {
    // `expiresAt` sits on the simple-actor schema, which structures and
    // platforms share. This pass dismisses summons and nothing else.
    const board = { units: [{ id: "x", kind: "structure", expiresAt: 1 }] };
    expect(expiredSummonIds(board, 99)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/nursery-summons.test.mjs`
Expected: FAIL — cannot resolve `module/rules/summons.mjs`.

- [ ] **Step 3: Write the pure pass**

Create `module/rules/summons.mjs`:

```js
/**
 * @file Summons that leave on a schedule.
 * @see docs/15-abilities.md, docs/44-case-expanded-roster.md
 *
 * Layer 2 (rules). Pure.
 *
 * Every summon in the corpus before the Jabberwock leaves for a reason other
 * than time. Basmu goes when the Hanging Gardens does; the Sphinxes and the
 * Kagome Spirits go when their field closes; the Dragon Tooth Warriors and
 * Raikou's copies never go at all.
 *
 * > *"When the Jabberwock is summoned, it disappears after 3 rounds."*
 *
 * `expiresAt` has been on the summon schema since it was written and the only
 * thing that read it was the actor sheet, which showed it. That is the shape
 * Ch. 45 calls **Collected**: right, and inert.
 *
 * An ABSOLUTE tick rather than a countdown, for the reason `data/regions.mjs`
 * states twice about its own durations: *"a countdown needs a hook that can
 * fail to fire, and an expiry cannot."*
 */

/**
 * Which summons have outstayed their welcome.
 *
 * `<=` and not `<`: an expiry of 12 means the Unit is gone once tick 12 has
 * arrived, the same convention `apps/actor-sheet/present.mjs#remainingTurns`
 * reads for every effect on a sheet.
 *
 * @param {object} board
 * @param {number} tick the world's current tick
 * @returns {string[]} unit ids to dismiss, in board order
 */
export function expiredSummonIds(board, tick) {
  return (board?.units ?? [])
    .filter((u) => u.kind === "summon")
    .filter((u) => typeof u.expiresAt === "number")
    .filter((u) => u.expiresAt <= tick)
    .map((u) => u.id);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/unit/nursery-summons.test.mjs`
Expected: PASS.

- [ ] **Step 5: Write the field**

In `module/engine/summoning.mjs#placeSummons`, after the `stamps` assignment and **before** the remembered-stats pass, add:

```js
    // *"When the Jabberwock is summoned, it disappears after 3◈ Turns."*
    //
    // Resolved to an ABSOLUTE tick here, at the one moment both halves are
    // known: the world's clock, and the stay the spec states. A countdown
    // would need a hook that can fail to fire.
    //
    // `expiresAt` has been on this schema all along with nothing writing it.
    if (spec.duration) {
      const turnsPerRound = game.settings.get("fgt", "turnsPerRound");
      const now = game.combat?.system?.globalTurn ?? 0;
      data.system.expiresAt = now + resolveTicks(parseTick(spec.duration), { turnsPerRound });
    }
```

Import `parseTick` from `../domain/tick.mjs` and `resolveTicks` from whichever module `engine/scheduler.mjs` imports it from — `grep -n "resolveTicks" module/engine/scheduler.mjs` names it.

- [ ] **Step 6: Write the reader**

In `module/engine/scheduler.mjs`'s round-end pass, beside the `fireEvent("roundEnd", ...)` at line 169, add the dismissal — **after** the event, so a handler that fires on the Jabberwock's last Round still fires:

```js
  // Summons whose stay has run out. AFTER `roundEnd` fires, so a clause on the
  // Jabberwock's last Round still runs: it is on the board for that Round, and
  // leaves at the end of it.
  //
  // `I.dismissSummon` rather than `I.defeat` — *"it disappears"* is not a
  // defeat, so it must not run the revival chain, award anything, or fire
  // `unitDefeated`.
  for (const id of expiredSummonIds(ctx.board, ctx.tick ?? 0)) {
    intents.push(I.dismissSummon(id, "expired"));
  }
```

Add the `dismissSummon` intent and its applier arm. The applier must, in this order:

1. Write the summon's stats to its summoner's `fieldSummonStats[contentId]` — the **same shape** `engine/fields.mjs:513` writes, so J18's *"its Stats will be the same as when it disappeared"* is inherited rather than re-implemented.
2. Start the summoning ability's `countFrom: "destroyed"` cooldown (J18's *"5◈ Turns after the Jabberwock disappears"*). `engine/cooldown.mjs:61` already accepts the value; the summon path simply has no caller. Model it on `engine/platforms.mjs:182`.
3. Delete the tokens, then the actor.

- [ ] **Step 7: Both allowlists**

Add `duration` to the summon-spec fields in `tools/lib/content.mjs` and to the matching list in `module/content/authored-fields.mjs`. Run `npx vitest run test/unit/authored-fields.test.mjs` — it is the test that holds the two lists together, and it has caught this omission twice.

- [ ] **Step 8: Run everything and commit**

```bash
npm test && npm run lint && npm run validate:content
git add module/rules/summons.mjs module/engine/summoning.mjs module/engine/scheduler.mjs module/engine/applier.mjs module/engine/cooldown.mjs module/content/authored-fields.mjs tools/lib/content.mjs test/unit/nursery-summons.test.mjs
git commit -F - <<'MSG'
feat(engine): a summon may leave on a schedule

"When the Jabberwock is summoned, it disappears after 3<> Turns" -- the first
summon in the corpus with a clock. Basmu goes when the Hanging Gardens does,
the Sphinxes and the Kagome Spirits when their field closes, and the Dragon
Tooth Warriors never go at all.

`expiresAt` has been on the summon schema since it was written, and the only
thing that read it was the actor sheet, which displayed it. Right, and inert --
the shape ch. 45 names as this project's dominant defect. Nothing wrote it, and
nothing dismissed a summon when it passed.

Two further clauses were waiting on it: "5<> Turns AFTER the Jabberwock
disappears" needs a moment it disappears, and Alice Eater's "3<> MORE Turns"
needs something to add to.

Dismissal is not defeat: it does not run the revival chain and does not fire
unitDefeated. It does write the summon's stats home to its summoner, so "its
Stats will be the same as when it disappeared" inherits the path Ozymandias's
Sphinxes already use.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN
MSG
```

---

### Task 2: A stay that can be extended (R8 — clause J15)

**Files:**
- Modify: `module/engine/scheduler.mjs` (a `DurationDelta` action)
- Modify: `module/engine/applier.mjs`, `module/engine/io.mjs`
- Modify: `module/rules/authoring/elements.mjs`
- Test: `test/unit/nursery-summons.test.mjs`

**Interfaces:**
- Consumes: `expiresAt`, written by Task 1.
- Produces: an action `{key: "DurationDelta", ticks: "3◈"}` that **adds** to the bearer's `expiresAt`.

- [ ] **Step 1: Write the failing test**

```js
import { dispatchForTest } from "../../module/engine/scheduler.mjs";

describe("R8 - Alice Eater extends the stay, it does not reset it", () => {
  it("adds to whatever remains", () => {
    // *"extends its period of existing on the board for 3 MORE Turns."*
    // A monster with one Turn left must end with four, not three. A test
    // starting from an expiry that has already passed proves nothing, because
    // "set" and "add" agree there.
    const intents = dispatchForTest(
      { kind: "DurationDelta", ticks: "1R" },
      { id: "jab", expiresAt: 13 },
      { tick: 12, turnsPerRound: 3 },
    );
    expect(intents[0]).toMatchObject({ unitId: "jab", kind: "durationDelta" });
    expect(intents[0].delta).toBe(3);
  });

  it("does nothing to a summon that has no clock", () => {
    // A Trump Soldier has no `expiresAt`. Adding to nothing must not GIVE it
    // a clock and quietly make a permanent summon mortal.
    const intents = dispatchForTest(
      { kind: "DurationDelta", ticks: "1R" },
      { id: "soldier", expiresAt: null },
      { tick: 12, turnsPerRound: 3 },
    );
    expect(intents).toEqual([]);
  });
});
```

Write the tick literals in the project's own ◈ notation when you author the test — they are spelled `"1R"` above only so this plan file stays plain ASCII. The Jabberwock's extension is **3◈**.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/nursery-summons.test.mjs -t "Alice Eater extends"`
Expected: FAIL — no `DurationDelta` arm.

- [ ] **Step 3: Write the action**

In `module/engine/scheduler.mjs`'s action table, beside `CooldownDelta`:

```js
  /**
   * Push a summon's departure further out.
   *
   * > *"…and extends its period of existing on the board for 3◈ **more**
   * > Turns."*
   *
   * **More**, so this ADDS. A `set` would shorten the stay of a monster that
   * had more than 3◈ left, which is the opposite of what the button is for.
   *
   * Refuses a unit with no clock rather than starting one: a Trump Soldier has
   * no `expiresAt`, and handing it one would make a permanent summon mortal.
   */
  DurationDelta: (a, u, h, c) => {
    if (typeof u.expiresAt !== "number") return [];
    const delta = resolveTicks(parseTick(a.ticks), c);
    return delta === 0 ? [] : [I.durationDelta(u.id, delta)];
  },
```

Add `I.durationDelta` and its applier arm (`system.expiresAt += delta`). Register `DurationDelta` and its `ticks` field in `module/rules/authoring/elements.mjs`.

**Note on sign.** `CooldownDelta` reads `ticks` as `-resolveTicks(...)`, because every cooldown clause in the corpus *reduces*. `DurationDelta` does not negate: *"3◈ more"* is an increase, and copying the neighbouring line would shorten the monster's stay.

- [ ] **Step 4: Run, then commit**

```bash
npm test && npm run lint
git add module/engine/scheduler.mjs module/engine/applier.mjs module/engine/io.mjs module/rules/authoring/elements.mjs test/unit/nursery-summons.test.mjs
git commit -F - <<'MSG'
feat(engine): a summon's stay may be extended

"extends its period of existing on the board for 3<> MORE Turns" -- more, so
it adds. A set would SHORTEN the stay of a monster with more than 3<> left,
which is the opposite of what the button is for.

It refuses a summon with no clock rather than starting one. A Trump Soldier has
no expiry, and handing it one would make a permanent summon mortal.

Unlike CooldownDelta beside it, this does not negate its tick expression. Every
cooldown clause in the corpus reduces; this one increases, and copying the
neighbouring line would have shortened the stay it exists to lengthen.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN
MSG
```

---

### Task 3: `damageTaken` carries what landed, and a share of it (E1, R2, R3 — clause J13)

**Files:**
- Modify: `module/engine/attack.mjs#fireDamageTaken`
- Modify: `module/engine/scheduler.mjs#eventValue`, and `StatDelta`
- Modify: `module/rules/authoring/elements.mjs`
- Test: `test/unit/nursery-summons.test.mjs`

**Interfaces:**
- Consumes: `dispatchForTest`, exported by Part 1 Task 2.
- Produces: `damageTaken` fires with `event: {amount, attackerId, isNP, isCrit}`; `eventValue(raw, event, factor)` multiplies before returning; `StatDelta` accepts a string `delta` and a `factor`.

**Two halves, and the second is invisible without the first.** `eventValue` reads its field off `ctx.event`, and `fireDamageTaken` passes no `event` at all — it passes `tick`, `turnsPerRound`, `board`, `options`, `victim` and `rolls`. So `@amount` resolves to `null` and the handler emits nothing. A `factor` alone would multiply a number that is not there.

- [ ] **Step 1: Write the failing test**

```js
describe("E1 - a share of the damage that landed", () => {
  const heal = { kind: "StatDelta", stat: "health.value", delta: "@amount", factor: 0.75 };

  it("multiplies the event's payload by the stated factor", () => {
    const intents = dispatchForTest(heal, { id: "jab" }, { event: { amount: 400 } });
    expect(intents[0]).toMatchObject({ unitId: "jab", stat: "health.value", delta: 300 });
  });

  it("reads what LANDED, not what was rolled", () => {
    // R2. The payload is `result.total` -- after every reduction. A Servant who
    // swings 1000 into a Def Up that stops 600 heals it by 300, not by 750.
    const intents = dispatchForTest(heal, { id: "jab" }, { event: { amount: 400, rolled: 1000 } });
    expect(intents[0].delta).toBe(300);
  });

  it("rounds toward zero, so a factor cannot invent a point of Health", () => {
    const intents = dispatchForTest(heal, { id: "jab" }, { event: { amount: 5 } });
    expect(intents[0].delta).toBe(3);
  });

  it("emits nothing when the event carries no payload", () => {
    // What every damageTaken handler saw before this task.
    expect(dispatchForTest(heal, { id: "jab" }, {})).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/nursery-summons.test.mjs -t "a share of the damage"`
Expected: FAIL — the factor is ignored, so the first assertion reads 400.

- [ ] **Step 3: Carry the payload**

In `module/engine/attack.mjs#fireDamageTaken` (line 2046 — confirm the signature before editing; it already receives `result`), add to the `fireEvent` context:

```js
    // WHAT LANDED, so a handler can take a share of it.
    //
    // > *"Whenever the Jabberwock receives damage from Servants, its Health is
    // > restored by 75% of the damage received."*
    //
    // `result.total` is the figure after every reduction, which is the only
    // reading of *"the damage received"*: a Servant who swings into a Def Up
    // heals it by what got through, not by what was rolled.
    //
    // This event has fired with no payload at all since it was written, so
    // `@amount` on a `damageTaken` handler resolved to null and emitted
    // nothing. `engine/applier.mjs#fireWriteEvent` is the only path that has
    // ever carried one, and its own comment says why: *"The payload IS the
    // context for a handler that asks about the change rather than about a
    // unit."*
    event: {
      amount: result?.total ?? 0,
      attackerId: state.attackerId,
      isNP: Boolean(result?.flags?.isNP ?? result?.isNP),
      isCrit: Boolean(result?.flags?.isCrit ?? result?.isCrit),
    },
```

- [ ] **Step 4: Add the factor**

```js
function eventValue(raw, event, factor = 1) {
  if (typeof raw === "number") return raw * factor;
  if (typeof raw !== "string" || !raw.includes("@")) return null;
  const negate = raw.trim().startsWith("-");
  const field = raw.replace("-", "").replace("@", "").trim();
  const value = event?.[field];
  if (typeof value !== "number") return null;
  const signed = negate ? -Math.abs(value) : value;
  // Toward zero, so a factor can never invent a point of Health -- and so a
  // negated payload rounds the same way a positive one does.
  return Math.trunc(signed * factor);
}
```

Pass `a.factor ?? 1` from both call sites. `StatDelta` reads `a.delta` as a literal today; give it the same `typeof a.delta === "string"` branch `CooldownDelta` already has, and return `[]` when the payload is absent rather than writing a zero.

- [ ] **Step 5: Register and commit**

Add `factor` to the `StatDelta` entry in `module/rules/authoring/elements.mjs`.

```bash
npm test && npm run lint
git add module/engine/attack.mjs module/engine/scheduler.mjs module/rules/authoring/elements.mjs test/unit/nursery-summons.test.mjs
git commit -F - <<'MSG'
feat(engine): damageTaken carries what landed, and a handler may take a share

Two gaps under one sentence: "its Health is restored by 75% of the damage
received".

eventValue reads its field off ctx.event, and fireDamageTaken passed no event
at all -- so `@amount` on a damageTaken handler resolved to null and the
handler emitted nothing. A factor alone would have multiplied a number that was
not there.

The payload is result.total, after every reduction, which is the only reading
of "the damage received": a Servant who swings into a Def Up heals it by what
got through, not by what was rolled.

The factor truncates toward zero, so it can never invent a point of Health.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN
MSG
```

---

### Task 4: "When Equipped" actually means it (E6 — clauses B1–B5)

**Files:**
- Modify: `module/rules/snapshot.mjs#contributionsOf`
- Test: `test/unit/nursery-summons.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `contributionsOf` skips an `equipment` item's contributions unless `system.equipped` is true.

**The second Collected field.** `EquipmentData` carries `equipped: new fields.BooleanField({ initial: false })` (`module/data/item/ability.mjs:638`), and the only reader is the actor sheet's context builder, which draws a checkbox. `contributionsOf` collects an equipment item's `rules` alongside every ability's, with **no gate on it**. Nothing has noticed because `[Semiramis' Poison]` is the only Item in the corpus and it carries no `rules` — it is a consumable with a `consumeEffect`. **The Vorpal Blade is the first Item in this system that does anything while worn.**

- [ ] **Step 1: Write the failing test**

```js
import { contributionsOf } from "../../module/rules/snapshot.mjs";

describe("E6 - an Item's rules apply only while it is Equipped", () => {
  const blade = (equipped) => ({
    id: "blade", name: "[Vorpal Blade]", type: "equipment",
    system: {
      contentId: "vorpal-blade", equipped,
      rules: [{ key: "BaseAttackModifier", component: "str", value: 50 }],
    },
  });

  it("collects them when it is worn", () => {
    const out = contributionsOf({ system: {}, items: [blade(true)], effects: [] });
    expect(baseAttackStrOf(out)).toBe(50);
  });

  it("does NOT collect them when it is merely held", () => {
    // This is what the engine did in BOTH cases before this task.
    const out = contributionsOf({ system: {}, items: [blade(false)], effects: [] });
    expect(baseAttackStrOf(out)).toBe(0);
  });

  it("leaves an ordinary ABILITY item alone", () => {
    // The gate is on the item TYPE. An ability has no `equipped` field, and
    // reading one off it would switch off every passive in the game.
    const skill = {
      id: "s", name: "Shapeshift", type: "ability",
      system: { passiveRules: [{ key: "Ward", value: 30 }] },
    };
    const out = contributionsOf({ system: {}, items: [skill], effects: [] });
    expect(wardCountOf(out)).toBeGreaterThan(0);
  });
});
```

`baseAttackStrOf` and `wardCountOf` are one-line readers over whatever buckets `contributionsOf` actually returns. Read them off `module/rules/elements.mjs` — `grep -n "out\.\(baseAttack\|ward\)" module/rules/elements.mjs` — rather than guessing. The **behaviour** under test is fixed; the field names are to be looked up.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/nursery-summons.test.mjs -t "only while it is Equipped"`
Expected: FAIL — the second assertion collects the modifier anyway.

- [ ] **Step 3: Gate it**

In `module/rules/snapshot.mjs#contributionsOf`, at the `abilities` map (line ~1308):

```js
  const abilities = [...(actor.items ?? [])]
    .filter((item) => !negated(item, actor))
    // *"When Equipped, increase the Unit's Base Attack (STR) by 50…"*
    //
    // `equipped` has been on `EquipmentData` since it was written and the only
    // thing that read it was the sheet, which draws a checkbox. An Item's rules
    // were collected from the moment it was HELD.
    //
    // Nothing noticed because `[Semiramis' Poison]` is the only Item in the
    // corpus and carries no `rules` at all -- it is a consumable with a
    // `consumeEffect`. The Vorpal Blade is the first Item that does anything
    // while worn, and every one of its five stat clauses opens with "When
    // Equipped".
    //
    // On the item TYPE, not on every item: an ability has no `equipped` field,
    // and reading one off it would switch off every passive in the game.
    .filter((item) => item.type !== "equipment" || Boolean(item.system?.equipped))
    .map((item) => ({
```

- [ ] **Step 4: Run the whole suite**

Run: `npm test`
Expected: PASS. If anything fails, it is naming an Item whose rules were silently in force — **report it**, because that is a live defect this gate has just surfaced, not a test to edit.

- [ ] **Step 5: Commit**

```bash
git add module/rules/snapshot.mjs test/unit/nursery-summons.test.mjs
git commit -F - <<'MSG'
fix(rules): "When Equipped" now means it

EquipmentData has carried `equipped` since it was written and the only thing
that read it was the actor sheet, which draws a checkbox. contributionsOf
collected an Item's rules from the moment it was HELD.

Nothing noticed because [Semiramis' Poison] is the only Item in the corpus and
it carries no rules at all -- it is a consumable with a consumeEffect. The
Vorpal Blade is the first Item in this system that does anything while worn,
and every one of its five stat clauses opens with "When Equipped".

The gate is on the item type. An ability has no `equipped` field, and reading
one off it would switch off every passive in the game.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN
MSG
```

---

### Task 5: An Item that refuses particular holders (E4 — clause B8)

**Files:**
- Modify: `module/rules/items.mjs#acquisitionTarget`
- Modify: `module/engine/items.mjs:46`, `module/engine/applier.mjs:521`
- Modify: `module/content/authored-fields.mjs`, `tools/lib/content.mjs`
- Test: `test/unit/nursery-summons.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `acquisitionTarget(unit, board, item = null)`, refusing with `reason: "barred"` when `item.barredFrom` names a role the candidate fills.

**The third Collected field, in a different key.** `acquisitionTarget` is the right seam — its own docstring calls itself *"the one seam every acquisition goes through"* and anticipates this exact day: *"the day a drop or a reward is added, it asks this and inherits the redirect for free."* Task 6 is that day. What it cannot do is refuse **this item** to **these units**: its signature is `(unit, board)` and both its refusals are properties of the unit. Pale Rider holds nothing at all; Nursery holds anything except one sword.

- [ ] **Step 1: Write the failing test**

```js
import { acquisitionTarget } from "../../module/rules/items.mjs";

describe("E4 - an Item may refuse particular holders", () => {
  const blade = { contentId: "vorpal-blade", barredFrom: { ofUnit: "nursery-rhyme", roles: ["self", "master"] } };
  const board = () => ({ units: [
    { id: "n", contentId: "nursery-rhyme", kind: "servant", masterId: "m", panel: { i: 0, j: 0 } },
    { id: "m", kind: "master", servantId: "n", panel: { i: 0, j: 1 } },
    { id: "e", contentId: "cu-chulainn", kind: "servant", masterId: "em", panel: { i: 5, j: 5 } },
  ] });

  it("refuses Nursery herself", () => {
    const b = board();
    expect(acquisitionTarget(b.units[0], b, blade)).toMatchObject({ ok: false, reason: "barred" });
  });

  it("refuses her Master", () => {
    // The clause the Blade exists for. It is designed to be carried by a
    // MASTER -- "If the Master with this Item Equipped cannot be Underpowered
    // by Servants" -- so the refusal has to name hers specifically.
    const b = board();
    expect(acquisitionTarget(b.units[1], b, blade)).toMatchObject({ ok: false, reason: "barred" });
  });

  it("allows anybody else", () => {
    const b = board();
    expect(acquisitionTarget(b.units[2], b, blade)).toMatchObject({ ok: true, unitId: "e" });
  });

  it("is unchanged when no item is named", () => {
    // The one existing caller passes two arguments and must not move.
    const b = board();
    expect(acquisitionTarget(b.units[0], b)).toMatchObject({ ok: true, unitId: "n" });
  });

  it("refuses a barred Servant BEFORE redirecting to a Master", () => {
    // Order matters. A barred Servant who redirects would otherwise hand the
    // sword straight to the second person the clause names.
    const b = board();
    b.units[0].itemHandling = "redirectToMaster";
    expect(acquisitionTarget(b.units[0], b, blade)).toMatchObject({ ok: false, reason: "barred" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/nursery-summons.test.mjs -t "refuse particular holders"`
Expected: FAIL — the first assertion returns `{ok: true}`.

- [ ] **Step 3: Extend the seam**

```js
/**
 * @param {object} unit the unit that would obtain the item
 * @param {object} board
 * @param {object} [item] the item being obtained, when the refusal is the ITEM's
 * @returns {{ok: boolean, unitId?: string, redirected?: boolean, reason?: string}}
 */
export function acquisitionTarget(unit, board, item = null) {
  if (!unit?.id) return { ok: false, reason: "notFound" };

  // A refusal that belongs to the ITEM rather than to the unit.
  //
  // > *"Cannot be obtained by Nursery or her Master."*
  //
  // Pale Rider's clause is a property of Pale Rider: he holds nothing at all.
  // This one is a property of one sword, and Nursery holds anything except it —
  // which is the point of the sword. She summons her own counter, and the
  // counter must be able to end up with somebody else.
  //
  // BEFORE the redirect, not after: a barred Servant who redirects to their
  // Master would otherwise hand the sword straight to the second person the
  // clause names.
  //
  // A ROLE PAIR against a CONTENT id, not a list of document ids: an actor id
  // is random per world and would not survive the Servant being placed twice,
  // which is the same reason `platformContentId` is keyed the way it is.
  if (item?.barredFrom && barredBy(unit, board, item.barredFrom)) {
    return { ok: false, reason: "barred" };
  }

  if (unit.itemHandling === "redirectToMaster") { /* …unchanged… */ }
  if (unit.cannotHoldItems) return { ok: false, reason: "cannotHoldItems" };
  return { ok: true, unitId: unit.id, redirected: false };
}

/**
 * Does this unit fill one of the roles an item refuses?
 *
 * @param {object} unit
 * @param {object} board
 * @param {{ofUnit: string, roles: string[]}} spec
 * @returns {boolean}
 */
function barredBy(unit, board, spec) {
  const named = (board?.units ?? []).find((u) => u.contentId === spec.ofUnit);
  if (!named) return false;
  const roles = spec.roles ?? [];
  if (roles.includes("self") && unit.id === named.id) return true;
  if (roles.includes("master") && unit.id === named.masterId) return true;
  return false;
}
```

- [ ] **Step 4: Thread the item through both call sites**

`module/engine/items.mjs:46` and `module/engine/applier.mjs:521`. Both already have the item in hand; pass it.

- [ ] **Step 5: Both allowlists**

`barredFrom` is authored on an item, so it goes in `itemSystem()` in `tools/lib/content.mjs` **and** `AUTHORED_ITEM_KEYS` in `module/content/authored-fields.mjs`.

- [ ] **Step 6: Run and commit**

```bash
npm test && npm run lint && npm run validate:content
git add module/rules/items.mjs module/engine/items.mjs module/engine/applier.mjs module/content/authored-fields.mjs tools/lib/content.mjs test/unit/nursery-summons.test.mjs
git commit -F - <<'MSG'
feat(rules): an Item may refuse particular holders

"Cannot be obtained by Nursery or her Master." acquisitionTarget was the right
seam -- its own docstring calls itself "the one seam every acquisition goes
through" and anticipates this exact day -- but its signature was (unit, board)
and both its refusals were properties of the UNIT. Pale Rider holds nothing at
all; Nursery holds anything except one sword.

A role pair against a CONTENT id, not a list of document ids: an actor id is
random per world and would not survive the Servant being placed twice.

The bar is checked BEFORE the redirect. A barred Servant who redirects to their
Master would otherwise hand the sword straight to the second person the clause
names.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN
MSG
```

---

### Task 6: An Item that lies on the floor (E3 — clause J11)

**Files:**
- Modify: `module/rules/items.mjs` (the pure pickup pass)
- Modify: `module/rules/snapshot.mjs` (project `carriesItemId` and `carriesItem`)
- Modify: `module/data/actor/simple.mjs` (`carriesItemId` on a structure)
- Modify: `module/engine/skill-use.mjs#createStructure` (`at: randomPanel`, `carriesItemId`, `once`)
- Modify: `module/engine/movement-hooks.mjs` (the pickup)
- Modify: `module/content/authored-fields.mjs`, `tools/lib/content.mjs`
- Test: `test/unit/nursery-summons.test.mjs`

**Interfaces:**
- Consumes: `acquisitionTarget(unit, board, item)` from Task 5.
- Produces: `itemPickupIntents(unit, board)` exported pure from `module/rules/items.mjs`; a `createStructure` phase accepting `at: "randomPanel"`, `carriesItemId` and `once: true`.

Every Item in the corpus is granted to a unit. **None has ever lain on the floor** — `rules/items.mjs`'s own header says *"nothing drops an item on a panel."*

- [ ] **Step 1: Write the failing test**

```js
import { itemPickupIntents } from "../../module/rules/items.mjs";

describe("E3 - an Item lying on a panel", () => {
  const board = () => ({ units: [
    { id: "cache", kind: "structure", panel: { i: 3, j: 3 },
      carriesItemId: "vorpal-blade",
      carriesItem: { contentId: "vorpal-blade", barredFrom: { ofUnit: "nursery-rhyme", roles: ["self", "master"] } } },
    { id: "e", contentId: "cu-chulainn", kind: "servant", panel: { i: 3, j: 3 } },
    { id: "n", contentId: "nursery-rhyme", kind: "servant", masterId: "m", panel: { i: 9, j: 9 } },
    { id: "m", kind: "master", servantId: "n", panel: { i: 9, j: 8 } },
  ] });

  it("hands it to a unit standing on its panel", () => {
    const b = board();
    expect(itemPickupIntents(b.units[1], b)).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "itemGrant", unitId: "e", contentId: "vorpal-blade" }),
    ]));
  });

  it("removes the cache, so it cannot be picked up twice", () => {
    const b = board();
    const out = itemPickupIntents(b.units[1], b);
    expect(out.some((i) => i.kind === "dismiss" && i.unitId === "cache")).toBe(true);
  });

  it("hands it to nobody who is standing elsewhere", () => {
    const b = board();
    expect(itemPickupIntents(b.units[2], b)).toEqual([]);
  });

  it("REFUSES Nursery standing on it, and leaves the cache there", () => {
    // The clause that matters, and it is enforced at ACQUISITION rather than in
    // this hook -- a refusal written here is a refusal a future trade or reward
    // would not inherit, which is the whole reason the seam exists.
    const b = board();
    b.units[2].panel = { i: 3, j: 3 };
    const out = itemPickupIntents(b.units[2], b);
    expect(out.some((i) => i.kind === "itemGrant")).toBe(false);
    expect(out.some((i) => i.kind === "dismiss")).toBe(false);
  });

  it("REFUSES her Master too, and still leaves it there", () => {
    const b = board();
    b.units[3].panel = { i: 3, j: 3 };
    expect(itemPickupIntents(b.units[3], b)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/nursery-summons.test.mjs -t "lying on a panel"`
Expected: FAIL — `itemPickupIntents is not a function`.

- [ ] **Step 3: Write the pure pass**

In `module/rules/items.mjs`:

```js
/**
 * The item a unit picks up by standing where it lies.
 *
 * > *"the [Vorpal Blade] Item appears on a random panel on the game board,
 * > this Item can be picked up by a Unit walking onto its panel."*
 *
 * The first item in this system that is not handed to somebody. This file's own
 * header said *"nothing drops an item on a panel"*; the Jabberwock's first
 * summoning is what changed that.
 *
 * A STRUCTURE carrying an item id, rather than a new kind of thing: structures
 * are already placed objects with panels, visibility rules and destruction
 * rules (Medusa's Bloodmarks, Quetzalcoatl's Piedra Del Sol).
 *
 * The refusal goes through `acquisitionTarget`, not through an `if` here. A
 * refusal written into the pickup is one a future trade or reward would not
 * inherit — which is the reason that seam exists at all.
 *
 * @param {object} unit the unit that just stopped moving
 * @param {object} board
 * @returns {object[]} descriptors
 */
export function itemPickupIntents(unit, board) {
  if (!unit?.panel) return [];
  const cache = (board?.units ?? []).find((u) =>
    u.kind === "structure" && u.carriesItemId
    && u.panel && u.panel.i === unit.panel.i && u.panel.j === unit.panel.j);
  if (!cache) return [];

  const to = acquisitionTarget(unit, board, cache.carriesItem ?? { contentId: cache.carriesItemId });
  // Refused: the sword stays where it lies, for somebody else to find. Not
  // consumed, not hidden — the board is unchanged.
  if (!to.ok) return [];

  return [
    { kind: "itemGrant", unitId: to.unitId, itemId: cache.carriesItemId, contentId: cache.carriesItemId, delta: 1 },
    { kind: "dismiss", unitId: cache.id, reason: "itemTaken" },
    { kind: "log", event: "itemPickedUp", itemId: cache.carriesItemId, by: to.unitId },
  ];
}
```

- [ ] **Step 4: Project the cache onto the board**

Add `carriesItemId` and `carriesItem` to the structure branch of `module/rules/snapshot.mjs`, so the pure pass can see them. `carriesItem` carries the item's `barredFrom`, resolved at snapshot time where the pack is reachable — layer 2 must not load a pack.

- [ ] **Step 5: Place it, and read it**

- `module/data/actor/simple.mjs` — `carriesItemId: new fields.StringField({ required: false, nullable: true, initial: null, blank: false })`.
- `module/engine/skill-use.mjs#createStructure` — accept `at: "randomPanel"` beside the existing `at: caster`, choosing uniformly from the scene's unoccupied walkable panels, and stamp `carriesItemId` from the phase. Also honour `once: true` by refusing a second placement of the same `structureId` by the same ability.
- `module/engine/movement-hooks.mjs` — call `itemPickupIntents` where a unit finishes a move, and apply what it returns. Find the existing hook (`grep -n "export" module/engine/movement-hooks.mjs`) rather than adding a second one.

- [ ] **Step 6: Both allowlists, then run and commit**

```bash
npm test && npm run lint && npm run validate:content
git add module/rules/items.mjs module/rules/snapshot.mjs module/data/actor/simple.mjs module/engine/skill-use.mjs module/engine/movement-hooks.mjs module/content/authored-fields.mjs tools/lib/content.mjs test/unit/nursery-summons.test.mjs
git commit -F - <<'MSG'
feat(engine): an Item may lie on a panel and be picked up

"the [Vorpal Blade] Item appears on a random panel on the game board, this Item
can be picked up by a Unit walking onto its panel."

The first item in this system that is not handed to somebody. rules/items.mjs's
own header said "nothing drops an item on a panel"; the Jabberwock's first
summoning is what changed that.

A structure carrying an item id rather than a new kind of thing -- structures
are already placed objects with panels, visibility and destruction rules.

The refusal for Nursery and her Master goes through acquisitionTarget, not
through an if in the pickup hook. A refusal written into the hook is one a
future trade or reward would not inherit, which is the reason that seam exists.
Refused, the sword stays where it lies for somebody else to find.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN
MSG
```

---

### Task 7: The Blade's one attack (E2, R4, R5 — clause B7)

**Files:**
- Modify: `module/rules/damage/pipeline.mjs` (the `replaces` supplant)
- Modify: `module/engine/applier.mjs` (write the suppression home on dismissal)
- Modify: `module/engine/summoning.mjs` (read it back)
- Test: `test/unit/nursery-summons.test.mjs`

**Interfaces:**
- Consumes: `dismissSummon` (Task 1), `fieldSummonStats` (existing), `Suppress` (existing).
- Produces: a `DamageModifier` carrying `replaces: "<stage>"` that supplants every other contribution at that stage; `fieldSummonStats[contentId].suppressions`, written on dismissal and applied by `placeSummons`.

- [ ] **Step 1: Write the failing test**

```js
describe("B7 - the Blade's one attack", () => {
  it("R4 - 3x INSTEAD of the Demonic 1.5x, not 4.5x", () => {
    // "it receives 3x damage INSTEAD OF 50% extra damage due to having the
    // 'Demonic' Attribute." Explicitly instead of. 4.5x is the reading that
    // looks right and is wrong.
    const out = totalFor({
      base: 1000,
      defenderAttributes: ["demonic"],
      mods: [
        { key: "DamageModifier", stage: "attributeBonus", value: 50 },
        { key: "DamageModifier", stage: "attributeBonus", multiplier: 3, replaces: "attributeBonus" },
      ],
    });
    expect(out).toBe(3000);
    expect(out).not.toBe(4500);
  });

  it("R4 - and the replacement still applies when nothing else is at that stage", () => {
    const out = totalFor({ base: 1000, defenderAttributes: [],
      mods: [{ key: "DamageModifier", stage: "attributeBonus", multiplier: 3, replaces: "attributeBonus" }] });
    expect(out).toBe(3000);
  });

  it("R5 - the suppression rides home on fieldSummonStats", () => {
    // The subtle half. A suppression that lives on the summon dies with the
    // summon, and the Jabberwock comes back with the Stats it had -- so the
    // Blade's sacrifice would be undone by the next summoning, which is
    // precisely the interaction the sheet spends a sentence on.
    const stored = rememberOnDismiss({
      id: "jab", contentId: "jabberwock",
      suppressions: [{ scope: "jabberwockLifesteal", permanent: true }],
      health: { value: 900, max: 1500 },
    });
    expect(stored.suppressions).toEqual([{ scope: "jabberwockLifesteal", permanent: true }]);
    expect(stored.health).toEqual({ value: 900, max: 1500 });
  });

  it("R5 - and a re-summoned Jabberwock comes back suppressed", () => {
    const data = { system: { passiveRules: [{ key: "OnEvent", slug: "jabberwockLifesteal" }] } };
    applyRememberedStats(data, { suppressions: [{ scope: "jabberwockLifesteal", permanent: true }] });
    expect(data.system.suppressedScopes).toContain("jabberwockLifesteal");
  });

  it("R5 - a NON-permanent suppression does not ride home", () => {
    // Only the Blade's is permanent. An ordinary Suppress must die with the
    // summon, or every debuff the monster ever caught would follow it back.
    const stored = rememberOnDismiss({
      id: "jab", contentId: "jabberwock",
      suppressions: [{ scope: "somethingElse", permanent: false }],
      health: { value: 900, max: 1500 },
    });
    expect(stored.suppressions ?? []).toEqual([]);
  });
});
```

`totalFor`, `rememberOnDismiss` and `applyRememberedStats` are thin helpers over the pipeline, the dismissal applier and `placeSummons`'s remembered-stats loop. Export whichever of them is not already reachable.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/nursery-summons.test.mjs -t "the Blade's one attack"`
Expected: FAIL — `replaces` is ignored, giving 4500.

- [ ] **Step 3: Implement the replacement**

In `module/rules/damage/pipeline.mjs`, at the attribute-bonus stage, a modifier carrying `replaces: "<stage>"` **supplants** every other contribution at that stage rather than summing with it:

```js
  // *"it receives 3x damage **instead of** 50% extra damage due to having the
  // 'Demonic' Attribute."*
  //
  // INSTEAD OF, so 3x and not 4.5x. Every other modifier in this pipeline
  // stacks; this is the only clause in either roster that says a figure
  // REPLACES the one that would otherwise apply, and reading it as one more
  // multiplier gives a number 50% too large that looks entirely plausible.
  //
  // The supplant is total: if two replacements ever land on one stage, the
  // later one wins, and the ordering is the pipeline's own. There is exactly
  // one today, and a second would be a rule question rather than a code one.
```

- [ ] **Step 4: Implement the permanence**

The Jabberwock's lifesteal is a `passiveRule` on its own statblock, so `RemoveEffect` cannot reach it and buff-removal is the wrong vocabulary — it is not a buff. A `Suppress {scope: "jabberwockLifesteal"}` switches it off, and the **permanence** is that the suppression is written into the summoner's `fieldSummonStats[contentId]`, which is the one place that outlives a summon.

- In the `dismissSummon` applier from Task 1, carry `suppressions` — **only the ones marked `permanent: true`** — alongside the stats.
- In `module/engine/summoning.mjs:342`, extend the loop that applies remembered *stats* to also apply remembered *suppressions*.

- [ ] **Step 5: Run and commit**

```bash
npm test && npm run lint
git add module/rules/damage/pipeline.mjs module/engine/applier.mjs module/engine/summoning.mjs test/unit/nursery-summons.test.mjs
git commit -F - <<'MSG'
feat(rules): a damage clause that replaces rather than stacks, permanently

"it receives 3x damage INSTEAD OF 50% extra damage due to having the 'Demonic'
Attribute" -- instead of, so 3x and not 4.5x. Every other modifier in this
pipeline stacks. Reading this one as one more multiplier gives a number 50% too
large that looks entirely plausible.

The permanence is the subtle half. The Jabberwock's lifesteal is a passiveRule
on its own statblock, so RemoveEffect cannot reach it and buff-removal is the
wrong vocabulary besides -- it is not a buff. And a suppression that lives on
the summon dies with the summon, while the monster comes back with the Stats it
had. So the suppression rides home on fieldSummonStats, the one place that
outlives a summon, which is precisely the interaction the sheet spends a
sentence on.

Only a suppression marked permanent rides home. An ordinary one dies with the
summon, or every debuff the monster ever caught would follow it back.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN
MSG
```

---

# Phase 2 — her content

---

### Task 8: Trump Soldiers (T1–T14, R1)

**Files:**
- Create: `packs/_source/summons/trump-soldier.yml`, `packs/_source/abilities/nursery-trump-soldiers.yml`

**Medea built this.** Every clause is a field the Dragon Tooth Warriors already carry.

- [ ] **Step 1: Write the failing test**

```js
describe("Trump Soldiers (T1-T14)", () => {
  it("T5-T10 - the statblock her sheet prints", () => {
    expect(summon("trump-soldier")).toMatchObject({
      baseHealth: 200, agility: 10, luck: 6, mov: 4,
      range: { panels: 2, targets: 1 },
      baseAttack: { str: 75, mag: 0 },
    });
  });

  it("T11/T12 - outside the budget, and once per Turn", () => {
    expect(summon("trump-soldier")).toMatchObject({ countsTowardBudget: false, actsOncePerTurn: true });
  });

  it("T13 - protects Nursery and her Master, from the SUMMON's own statblock", () => {
    // Medea's Dragon Tooth Warriors carry the identical sentence and the
    // identical rule, and its comment says why it is not a Compulsion: "a
    // Decoy-shaped rule rather than a Compulsion: it removes targets rather
    // than forcing one."
    const rule = summon("trump-soldier").passiveRules.find((r) => r.key === "TargetingModifier");
    expect(rule).toMatchObject({ mode: "protectSummoner", radius: 1, protects: ["summoner", "summonerMaster"] });
  });

  it("R1 - 1d8+4, which is 5 to 12 and never 4 or 13", () => {
    // "4d8" is the other plausible reading of a careless transcription, and it
    // is a very different swarm (4 to 32).
    const spec = ability("nursery-trump-soldiers").phases[0].spec;
    expect(spec.countRoll).toBe("1d8+4");
  });

  it("T14 - counts as her Attack, and costs a third of a Round PER soldier", () => {
    const a = ability("nursery-trump-soldiers");
    expect(a.countsAsAttack).toBe(true);
    expect(a.cooldown.countFrom).toBe("summonCount");
  });

  it("T1 - non-damaging: phases, and no damage phase", () => {
    expect(ability("nursery-trump-soldiers").phases.some((p) => p.kind === "damage")).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/unit/nursery-summons.test.mjs -t "Trump Soldiers"`
Expected: FAIL — `ENOENT`.

- [ ] **Step 3: Write the statblock**

```yaml
# Nursery Rhyme, char_orig_sheets/Copia de Nursery Rhyme.md -- conjured by
# Nursery Rhyme: Trump Soldiers.
#
# Medea's Dragon Tooth Warriors at different numbers. Every clause on this file
# is a field that summon already carries, including the protection, whose
# sentence on both sheets is word for word the same.
schema: 1
id: trump-soldier
name: "Trump Soldier"
type: summon
attributes: [summon, humanoid, fairytale]
baseHealth: 200
agility: 10
luck: 6
mov: 4
range: { panels: 2, targets: 1 }
baseAttack: { str: 75, mag: 0 }
normalAttack: { mode: fixed, component: str }
# Both clauses as properties of the summon, not as rules the engine would have
# to special-case for Nursery.
countsTowardBudget: false
actsOncePerTurn: true
passiveRules:
  # "Enemy Units cannot Attack Nursery or her Master if any Trump Soldiers are
  # directly next to them." A Decoy-shaped rule rather than a Compulsion: it
  # removes targets rather than forcing one.
  - key: TargetingModifier
    mode: protectSummoner
    radius: 1
    protects: [summoner, summonerMaster]
notes: |
  Conjured 1d8+4 at a time by Nursery Rhyme: Trump Soldiers, within a 2 panel area of Nursery.
```

- [ ] **Step 4: Write the ability**

```yaml
# Nursery Rhyme, char_orig_sheets/Copia de Nursery Rhyme.md
schema: 1
id: nursery-trump-soldiers
name: "Nursery Rhyme: Trump Soldiers"
rank: C
isNP: true
categorizedAsNP: true
npTags: [antiUnit]
kind: noblePhantasm
timing: { window: ownTurn }
# "Counts as Nursery's Attack for the Turn."
countsAsAttack: true
# "Cooldown: ⅓◈ Turns for each Trump Soldier summoned" -- not a fixed tick, and
# not known until the roll has resolved. Medea's own shape.
cooldown: { perUnit: "⅓◈", countFrom: summonCount }
description: |
  (Non-damaging) Used during your Turn. Roll an eight-sided die and add 4 to that number, Nursery
  summons that number of Trump Soldiers within a 2 panel area of herself. They do not count towards
  the number of Units that Move and/or Attack during your Turn, and the same Trump Soldier can only
  Move/Attack once per Turn. Enemy Units cannot Attack Nursery or her Master if any Trump Soldiers
  are directly next to them. Counts as Nursery's Attack for the Turn.
  Cooldown: ⅓◈ Turns for each Trump Soldier summoned.
phases:
  - kind: summon
    spec:
      # ONE d8, then +4 -- five to twelve. "4d8" is the other reading of a
      # careless transcription and is a completely different swarm.
      countRoll: "1d8+4"
      types: { 1: trump-soldier }
      placement: { shape: square, size: 5, anchor: self }
      countsTowardBudget: false
      actsOncePerTurn: true
```

Two things to **check rather than assume** before this file is done:

- **`placement`'s size.** *"within a 2 panel area"* is a Chebyshev radius of 2, which is a 5×5 square — exactly what Medea's *"within a 5x5 panel area"* authors as `{shape: square, size: 5}`. Read `freePanels` (`grep -n "placement" module/engine/summoning.mjs`) and use whichever the field means. **2 and 5 describe the same ring, and the wrong one is silently a different swarm.**
- **`typeRoll` omitted.** `summonPhase` defaults it to `"1"` (`module/engine/summoning.mjs:69`) and `types[1]` is the only soldier. Confirm that default before relying on it — a `typeRoll` that resolves to nothing summons zero soldiers and reports "0 summoned", which has happened before.

- [ ] **Step 5: Validate, test, commit**

```bash
npm run validate:content && npm test && npm run lint
git add packs/_source/summons/trump-soldier.yml packs/_source/abilities/nursery-trump-soldiers.yml test/unit/nursery-summons.test.mjs
git commit -F - <<'MSG'
feat(content): Trump Soldiers

Medea built this. Every clause is a field the Dragon Tooth Warriors already
carry, including the protection, whose sentence on both sheets is word for word
the same -- a Decoy-shaped rule rather than a Compulsion, because it removes
targets rather than forcing one.

1d8+4 is ONE d8 and then +4: five to twelve. "4d8" is the other plausible
reading of a careless transcription, and it is a completely different swarm.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN
MSG
```

---

### Task 9: The Jabberwock, and *Alice Eater* (J1–J18, R2, R3, R6, R7, R8)

**Files:**
- Create: `packs/_source/summons/jabberwock.yml`, `packs/_source/abilities/jabberwock-alice-eater.yml`, `packs/_source/abilities/nursery-jabberwock.yml`

- [ ] **Step 1: Write the failing test**

```js
describe("the Jabberwock (J1-J18)", () => {
  it("J3-J9 - the statblock, and both Attributes", () => {
    expect(summon("jabberwock")).toMatchObject({
      baseHealth: 1500, agility: 6, luck: 6, mov: 3,
      range: { panels: 2, targets: 1 },
      baseAttack: { str: 200, mag: 0 },
    });
    expect(summon("jabberwock").attributes).toEqual(expect.arrayContaining(["demonic", "giant"]));
  });

  it("J12 - walks onto occupied panels and knocks the occupants back", () => {
    expect(summon("jabberwock").movesOntoOccupiedPanels).toBe(true);
    const rule = summon("jabberwock").passiveRules.find((r) => r.key === "Knockback");
    expect(rule).toMatchObject({ distance: 1 });
  });

  it("J13/R2/R3 - heals 75% of what LANDED, from Servants only", () => {
    const rule = summon("jabberwock").passiveRules.find((r) => r.event === "damageTaken");
    expect(rule.predicate).toContain("attacker:type:servant");
    expect(rule.then[0]).toMatchObject({
      key: "StatDelta", stat: "health.value", delta: "@amount", factor: 0.75,
    });
    expect(rule.slug).toBe("jabberwockLifesteal");
  });

  it("J13/R3 - and NOT from a Master", () => {
    // Load-bearing: the Vorpal Blade is designed to be carried by a Master, so
    // a Master hitting the monster must not heal it even before the Blade's
    // own clause fires.
    const rule = summon("jabberwock").passiveRules.find((r) => r.event === "damageTaken");
    expect(testPredicate(rule.predicate, { options: new Set(["attacker:type:master"]) })).toBe(false);
  });

  it("J10 - a stay of three Rounds, on the summoning phase", () => {
    expect(ability("nursery-jabberwock").phases[0].spec.duration).toBeTruthy();
  });

  it("J11 - the Blade appears on its FIRST summoning only", () => {
    const phase = ability("nursery-jabberwock").phases.find((p) => p.kind === "createStructure");
    expect(phase).toMatchObject({ structureId: "vorpal-blade-cache", at: "randomPanel", once: true });
    expect(phase.carriesItemId).toBe("vorpal-blade");
  });

  it("J2 - summoned on a panel NEXT to her", () => {
    expect(ability("nursery-jabberwock").phases[0].spec.placement).toMatchObject({ adjacentTo: "self" });
  });

  it("J17/R6 - summoning counts as her Attack, and the monster acts outside the budget", () => {
    // R6: the clause is about the SUMMONING. Otherwise it and
    // countsTowardBudget: false would contradict each other.
    expect(ability("nursery-jabberwock").countsAsAttack).toBe(true);
    expect(summon("jabberwock").countsTowardBudget).toBe(false);
  });

  it("J18/R7 - the cooldown starts when it DISAPPEARS", () => {
    // Quetzalcoatl's mount records the defect this field exists to prevent:
    // "the mount may stand for twenty Turns and the clock has not begun."
    expect(ability("nursery-jabberwock").cooldown.countFrom).toBe("destroyed");
  });

  it("J14/J15/R8 - Alice Eater buffs it and adds to its stay", () => {
    const a = ability("jabberwock-alice-eater");
    const buff = a.phases[0].effects[0];
    expect(buff).toMatchObject({ id: "atkUp", magnitude: 50, npMagnitude: 25 });
    const extend = a.phases.find((p) => p.rules)?.rules[0];
    expect(extend.key).toBe("DurationDelta");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/unit/nursery-summons.test.mjs -t "the Jabberwock"`
Expected: FAIL — `ENOENT`.

- [ ] **Step 3: Write the monster**

```yaml
# Nursery Rhyme, char_orig_sheets/Copia de Nursery Rhyme.md -- conjured by
# Nursery Rhyme: Jabberwock.
#
# The strongest single summon in either roster: 1500 Health, BA(STR) 200, and it
# heals off 75% of everything a Servant does to it. Its counter is an Item
# Nursery herself puts on the board the first time she summons it, and which she
# is barred from picking up.
schema: 1
id: jabberwock
name: "Jabberwock"
type: summon
# `Giant` implies `Large`, which `closeAttributes` resolves -- the same
# implication Asterios carries.
attributes: [summon, demonic, giant, fairytale]
baseHealth: 1500
agility: 6
luck: 6
mov: 3
range: { panels: 2, targets: 1 }
baseAttack: { str: 200, mag: 0 }
normalAttack: { mode: fixed, component: str }
countsTowardBudget: false
actsOncePerTurn: true
# "The Jabberwock can Move to any panel, if it Moves onto an occupied panel, all
# Units occupying said panels are knocked back by 1 panel." Bašmu's pair of
# clauses exactly.
movesOntoOccupiedPanels: true
abilities:
  - { ref: jabberwock-alice-eater }
passiveRules:
  - key: Knockback
    distance: 1
    trigger: movedOnto

  # "Whenever the Jabberwock receives damage from Servants, its Health is
  # restored by 75% of the damage received."
  #
  # `@amount` is what LANDED -- `result.total`, after every reduction. A Servant
  # who swings 1000 into a Def Up that stops 600 heals it by 300.
  #
  # `attacker:type:servant` and nothing else. Masters, summons, platforms and
  # structures do not feed it, and the distinction is load-bearing: the Vorpal
  # Blade is designed to be carried by a MASTER, so a Master hitting the monster
  # does not heal it even before the Blade's own clause fires.
  #
  # `slug` is what the Blade's `Suppress` names when it removes this
  # permanently. Without one the removal would have only a random document id
  # to aim at.
  - key: OnEvent
    slug: jabberwockLifesteal
    event: damageTaken
    automatic: true
    predicate: ["attacker:type:servant"]
    then:
      - { key: StatDelta, stat: "health.value", delta: "@amount", factor: 0.75 }
notes: |
  Summoned by Nursery Rhyme: Jabberwock on a panel next to Nursery, for 3◈ Turns. Re-summoned with
  the Stats it had when it disappeared.
```

- [ ] **Step 4: Write *Alice Eater***

```yaml
# Nursery Rhyme, char_orig_sheets/Copia de Nursery Rhyme.md -- the Jabberwock's
# own Skill.
schema: 1
id: jabberwock-alice-eater
name: "Alice Eater"
kind: skill
slug: aliceEater
cooldown: "4◈"
timing: { window: ownTurn }
description: |
  Used during your Turn. Applies @effect[atkUp]{Atk Up} to itself for 1◈ Turns, all damage dealt is
  increased by 50%; if NP, 25%; and extends its period of existing on the board for 3◈ more Turns.
  Cooldown: 4◈ Turns.
phases:
  - kind: applyEffects
    target: self
    effects:
      - { id: atkUp, duration: "1◈", magnitude: 50, npMagnitude: 25 }
  - kind: applyEffects
    target: self
    rules:
      # "3◈ MORE Turns" -- additive to whatever remains. A monster with 1◈ left
      # ends with 4◈, not 3◈.
      - { key: DurationDelta, ticks: "3◈" }
```

- [ ] **Step 5: Write the summoning Noble Phantasm**

```yaml
# Nursery Rhyme, char_orig_sheets/Copia de Nursery Rhyme.md
schema: 1
id: nursery-jabberwock
name: "Nursery Rhyme: Jabberwock"
rank: C
isNP: true
categorizedAsNP: true
npTags: [antiUnit]
kind: noblePhantasm
timing: { window: ownTurn }
# R6: "Summoning it counts as Nursery's Attack for the Turn" is about the
# SUMMONING. The monster then attacks on its own, outside the budget --
# otherwise this and `countsTowardBudget: false` would contradict each other.
countsAsAttack: true
# "Cooldown: 5◈ Turns AFTER the Jabberwock disappears." Quetzalcoatl's mount
# records the defect this field exists to prevent: "the mount may stand for
# twenty Turns and the clock has not begun."
cooldown: { max: "5◈", countFrom: destroyed }
description: |
  (Non-damaging) When this NP is used, Nursery summons the Jabberwock on a panel next to her. It
  disappears after 3◈ Turns. When the Jabberwock is summoned for the first time, the [Vorpal Blade]
  Item appears on a random panel on the game board; it can be picked up by a Unit walking onto its
  panel. Summoning it counts as Nursery's Attack for the Turn. When the Jabberwock is summoned again
  after disappearing, its Stats will be the same as when it disappeared.
  Cooldown: 5◈ Turns after the Jabberwock disappears.
phases:
  - kind: summon
    spec:
      countRoll: "1"
      types: { 1: jabberwock }
      placement: { adjacentTo: self }
      # The first summon in the corpus with a clock.
      duration: "3◈"
      countsTowardBudget: false
      actsOncePerTurn: true
  # "When the Jabberwock is summoned FOR THE FIRST TIME." `once: true`, so a
  # second Blade never appears -- and so the Blade that broke is not replaced.
  - kind: createStructure
    target: self
    structureId: vorpal-blade-cache
    at: randomPanel
    carriesItemId: vorpal-blade
    once: true
```

- [ ] **Step 6: Validate, test, commit**

```bash
npm run validate:content && npm test && npm run lint
git add packs/_source/summons/jabberwock.yml packs/_source/abilities/jabberwock-alice-eater.yml packs/_source/abilities/nursery-jabberwock.yml test/unit/nursery-summons.test.mjs
git commit -F - <<'MSG'
feat(content): the Jabberwock, and Alice Eater

The strongest single summon in either roster: 1500 Health, BA(STR) 200, and it
heals off 75% of everything a Servant does to it.

The lifesteal reads what LANDED, not what was rolled, and it reads Servants
only. That second half is load-bearing: the Vorpal Blade is designed to be
carried by a Master, so a Master hitting the monster does not heal it even
before the Blade's own clause fires.

Its lifesteal carries a slug, because the Blade's suppression has to be able to
name it -- without one the removal would have only a random document id to aim
at.

The Blade appears once. A createStructure that fired on every summoning would
hand the other side a fresh sword every 5<>, which is a different game.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN
MSG
```

---

### Task 10: `[Vorpal Blade]` (B1–B8, R4, R5)

**Files:**
- Create: `packs/_source/abilities/vorpal-blade.yml`, `packs/_source/structures/vorpal-blade-cache.yml`
- Modify: `packs/_source/servants/nursery-rhyme.yml` (two refs)

- [ ] **Step 1: Write the failing test**

```js
describe("[Vorpal Blade] (B1-B8)", () => {
  const b = () => ability("vorpal-blade");

  it("is an Item, spelled the way the corpus spells one", () => {
    // `type: equipment`, which is what semiramis-poison.yml carries. Items live
    // in abilities/ and are distinguished by TYPE, not by directory.
    expect(b().type).toBe("equipment");
  });

  it("B1/B2 - +50 BA(STR), and Range reduced TO 1", () => {
    const ba = b().rules.find((r) => r.key === "BaseAttackModifier");
    expect(ba).toMatchObject({ component: "str", value: 50 });
    const range = b().rules.find((r) => r.key === "RangeDelta");
    // An ABSOLUTE, not a delta. "Range is reduced TO 1 panel" -- a Servant at
    // Range 4 ends at 1, and a -1 delta would leave them at 3.
    expect(range.set).toBe(1);
    expect(range.delta).toBeUndefined();
  });

  it("B3 - +50% Normal Attack damage to Demonic Units", () => {
    const dm = b().rules.find((r) => r.key === "DamageModifier" && r.value === 50);
    expect(dm.predicate).toEqual(expect.arrayContaining(["attack:kind:normal", "target:attribute:demonic"]));
  });

  it("B4 - and none of it reaches an NP", () => {
    // "The above Stat boosts do not affect NP & Attacks Categorized as NP."
    for (const r of b().rules.filter((x) => ["BaseAttackModifier", "DamageModifier"].includes(x.key))) {
      expect(r.npValue).toBe(0);
    }
  });

  it("B6 - a Master holding it cannot be Underpowered", () => {
    expect(b().rules.some((r) => r.key === "UnderpowerImmunity")).toBe(true);
  });

  it("B8 - barred from Nursery and her Master", () => {
    expect(b().barredFrom).toMatchObject({ ofUnit: "nursery-rhyme", roles: ["self", "master"] });
  });

  it("B7 - one attack: triple, suppress, break", () => {
    const rule = b().rules.find((r) => r.event === "damageDealt");
    expect(rule.then).toEqual(expect.arrayContaining([
      expect.objectContaining({ replaces: "attributeBonus", multiplier: 3 }),
      expect.objectContaining({ key: "Suppress", scope: "jabberwockLifesteal", permanent: true }),
      expect.objectContaining({ key: "DestroyItem" }),
    ]));
  });

  it("her Servant file gains exactly two refs, taking it from 9 to 11", () => {
    const a = servant("nursery-rhyme").abilities;
    expect(a).toContainEqual({ ref: "nursery-trump-soldiers" });
    expect(a).toContainEqual({ ref: "nursery-jabberwock" });
    expect(a).toHaveLength(11);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/unit/nursery-summons.test.mjs -t "Vorpal Blade"`
Expected: FAIL — `ENOENT`.

- [ ] **Step 3: Write the Blade**

```yaml
# Nursery Rhyme, char_orig_sheets/Copia de Nursery Rhyme.md
#
# *"One, two! One, two! And through and through, the Vorpal Blade went
# snicker-snack!"*
#
# The counter to her own monster, which she puts on the board herself the first
# time she summons it -- and cannot pick up.
#
# The SECOND Item in this corpus and the first that does anything while worn.
# `[Semiramis' Poison]` is a consumable with a `consumeEffect` and no `rules` at
# all, which is why `equipped` went unread until now.
schema: 1
id: vorpal-blade
name: "[Vorpal Blade]"
type: equipment
quantity: 1
transferable: false
# "Cannot be obtained by Nursery or her Master." A role pair against a CONTENT
# id: a Foundry actor id is random per world.
barredFrom: { ofUnit: nursery-rhyme, roles: [self, master] }
description: |
  When Equipped, increase the Unit's Base Attack (STR) by 50, but Range is reduced to 1 panel; and
  Normal Attack damage dealt to Units with the 'Demonic' Attribute is increased by 50%. The above
  Stat boosts do not affect NP & Attacks Categorized as NP. Normal Attacks with this Item Equipped
  use Base Attack (STR). A Master with this Item Equipped cannot be Underpowered by Servants.
  When the Jabberwock is Attacked by this Equipped Item, it receives 3x damage instead of 50% extra
  damage due to having the 'Demonic' Attribute, and the lifesteal effect is permanently removed from
  the Jabberwock; then the Vorpal Blade breaks and can no longer be used.
  Cannot be obtained by Nursery or her Master.
rules:
  # B1. `npValue: 0` on every one of these is B4, STATED rather than defaulted:
  # "the above Stat boosts do not affect NP & Attacks Categorized as NP" is a
  # sentence on the sheet and deserves to be visible in the file.
  - { key: BaseAttackModifier, component: str, value: 50, npValue: 0 }

  # B2. `set`, not `delta`. "Range is reduced TO 1 panel" -- a Servant at Range
  # 4 ends at 1, and a -1 delta would leave them at 3.
  - { key: RangeDelta, set: 1 }

  # B3.
  - key: DamageModifier
    stage: flat
    value: 50
    npValue: 0
    predicate: ["attack:kind:normal", "target:attribute:demonic"]

  # B5. The same override her own Note carries, here as a rule because it
  # belongs to the sword rather than to whoever swings it.
  - { key: NormalAttackComponent, component: str }

  # B6. "If the Master with this Item Equipped cannot be Underpowered by
  # Servants" -- §16.5's ×0.5, refused.
  - { key: UnderpowerImmunity }

  # B7, all three consequences at once, on one attack.
  - key: OnEvent
    event: damageDealt
    automatic: true
    predicate: ["target:contentId:jabberwock"]
    then:
      # R4. "3x INSTEAD OF 50% extra damage due to having the 'Demonic'
      # Attribute" -- explicitly instead of, so 3x and not 4.5x.
      - { key: DamageModifier, stage: attributeBonus, multiplier: 3, replaces: attributeBonus }
      # R5. Permanent, and it rides home on the summoner's `fieldSummonStats` --
      # the one place that outlives a summon. Without that, the next summoning
      # undoes the sacrifice, which is precisely the interaction the sheet
      # spends a sentence on.
      - { key: Suppress, scope: jabberwockLifesteal, permanent: true, target: victim }
      # "…then the Vorpal Blade breaks and can no longer be used."
      - { key: DestroyItem, item: vorpal-blade }
```

Three element names must be **checked, not assumed**: `NormalAttackComponent`, `UnderpowerImmunity` and `DestroyItem`. Run `grep -n "^  [A-Z][A-Za-z]*(el," module/rules/elements.mjs` and use the spelling that exists. If one genuinely does not exist, build it **with its reader** in this task rather than deferring it — a rule with no reader is the defect this whole plan is organised around.

- [ ] **Step 4: Write the cache**

```yaml
# The panel the [Vorpal Blade] lies on until somebody walks onto it.
#
# A structure rather than a new kind of thing: structures are already placed
# objects with panels, visibility rules and destruction rules. It carries the
# item and nothing else, and it is removed the moment the item is taken.
schema: 1
id: vorpal-blade-cache
name: "[Vorpal Blade]"
type: structure
carriesItemId: vorpal-blade
baseHealth: 1
notes: |
  Placed on a random panel the first time Nursery summons the Jabberwock. Picked up by any Unit that
  walks onto its panel, except Nursery and her Master.
```

- [ ] **Step 5: Add the two refs**

Append to `packs/_source/servants/nursery-rhyme.yml`'s ability list:

```yaml
  # Part 2. Two more arrive with Parts 3 and 4.
  - { ref: nursery-trump-soldiers }
  - { ref: nursery-jabberwock }
```

and update Part 1's ability-count assertion from 9 to 11 in `test/unit/nursery.test.mjs`.

- [ ] **Step 6: Validate, test, commit**

```bash
npm run validate:content && npm test && npm run lint
git add packs/_source/abilities/vorpal-blade.yml packs/_source/structures/vorpal-blade-cache.yml packs/_source/servants/nursery-rhyme.yml test/unit/nursery.test.mjs test/unit/nursery-summons.test.mjs
git commit -F - <<'MSG'
feat(content): [Vorpal Blade], and the panel it lies on

She summons her own counter. The Blade appears the first time she calls the
Jabberwock, on a random panel, and she and her Master are the two Units who
cannot pick it up.

Range is `set: 1`, not a delta: "reduced TO 1 panel" leaves a Servant at Range
4 holding a one-panel sword, and a -1 delta would leave them at 3.

Every stat rule carries npValue: 0 explicitly rather than by default, because
"the above Stat boosts do not affect NP & Attacks Categorized as NP" is a
sentence on the sheet and deserves to be visible in the file.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN
MSG
```

---

### Task 11: Documentation and the live board

**Files:**
- Modify: `docs/15-abilities.md`, `docs/16-relationships.md`, `docs/44-case-expanded-roster.md`, `docs/45-implementation-status.md`, `docs/D-servant-data-sheets.md`, `CHANGELOG.md`, `README.md`

- [ ] **Step 1: Document**

- **Ch. 15 §15.8** — Items may now lie on a panel, may refuse particular holders, and their rules apply only while Equipped. All three are new sentences in a section that said the opposite.
- **Ch. 16 §16.5** — `UnderpowerImmunity`, and the Item that grants it.
- **Ch. 44** — a Nursery Rhyme Part 2 section: the three Collected fields this part found, and why each was invisible.
- **Ch. 45** — Parts 1–2 of 4 built.
- **Appendix D** — her entry updated to 11 abilities.
- **`CHANGELOG.md`** — an `## [Unreleased]` entry naming `expiresAt`, `equipped` and the item-less `acquisitionTarget`.
- **`README.md`** — the test count.

- [ ] **Step 2: Bring the world up**

```bash
node tools/fgt-world.mjs shutdown
npm run build:packs
node tools/fgt-world.mjs launch
```

Then join as Gamemaster over CDP. Launch fails with no Foundry tab open — open one first.

- [ ] **Step 3: Confirm the content compiled**

Read the Jabberwock and the Blade out of the compendium and check that `duration`, `barredFrom`, `carriesItemId`, `slug` on the lifesteal rule, and the Blade's whole `rules` array survived the build. **This is where the last two allowlist defects were caught.**

- [ ] **Step 4: Walk the inventory**

Every clause gets an observation, not an inference.

- [ ] **R1** — a swarm of between 5 and 12, counted on the board. Summon twice; two different counts is the evidence `1d8+4` is a roll and not a constant.
- [ ] **T13** — an enemy finding Nursery **un-targetable** while a soldier stands next to her, and targetable the moment it dies.
- [ ] **T14** — her Attack spent, and a cooldown proportional to the count rolled.
- [ ] **J2** — the Jabberwock appearing **next to** her.
- [ ] **J11** — a `[Vorpal Blade]` on a random panel, and **only on the first summoning**.
- [ ] **J12** — it walking onto an occupied panel, and the occupant moving one panel.
- [ ] **J13/R2** — a Servant hitting it and its **Health going up**, by 75% of what the card says landed. Read both numbers.
- [ ] **J13/R3** — a **Master** hitting it and its Health **not** going up.
- [ ] **J10/E5** — it **gone** after 3◈. Not a field showing the right number: gone.
- [ ] **J15/R8** — *Alice Eater* used with 1◈ left, and the monster still standing after 3◈ more.
- [ ] **J18/R7** — the re-summon cooldown starting **when it vanished**, and the monster coming back at the Health it left on.
- [ ] **E3** — a unit walking onto the Blade's panel and holding it afterwards.
- [ ] **B8** — **Nursery's Master** walking onto that panel and **not** picking it up, with the Blade still lying there.
- [ ] **E6** — the Blade held-but-not-Equipped changing nothing, and the holder's Range dropping to 1 the moment it is Equipped.
- [ ] **B7/R4** — one attack with it dealing **3×**, and the card **not** also showing the Demonic +50%.
- [ ] **B7/R5** — the monster's Health **not** rising from the next Servant hit, **and still not rising after it has disappeared and been re-summoned.**

- [ ] **Step 5: Fix what the board disagrees with**

Any clause that misbehaves is a bug in this implementation, not in the sheet. Fix it, add the unit test that would have caught it, re-verify.

- [ ] **Step 6: Final commit**

```bash
npm test && npm run lint && npm run validate:content
git add -A
git commit -F - <<'MSG'
test(content): Nursery Rhyme part 2, verified on a live board

Every clause of the inventory observed rather than inferred -- including the
two a passing test cannot distinguish from a failure: a Jabberwock that is GONE
after 3<> rather than a field holding the right number, and a lifesteal that is
still absent after the monster has disappeared and come back.

[Record here what the board disagreed with, and what was fixed.]

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HLKFYmoBW84Wwh567tdpDN
MSG
```

---

## Self-review notes

**Spec coverage.** R1 Task 8; R2/R3 Tasks 3 and 9; R4/R5 Tasks 7 and 10; R6 Task 9; R7 Tasks 1 and 9; R8 Tasks 2 and 9. E1 Task 3; E2 Task 7; E3 Task 6; E4 Task 5; E5 Task 1; E6 Task 4. The 14 Trump Soldier clauses are Task 8; the 18 Jabberwock clauses are Tasks 1–3 and 9; the 8 Blade clauses are Tasks 4–7 and 10. Every row of §5's three inventories has a task.

**Task order is dependency order.** Task 2 needs Task 1's `expiresAt`; Task 6 needs Task 5's third parameter; Task 7 needs Task 1's dismissal applier; Task 9's content needs Tasks 1–3; Task 10's needs Tasks 4–7. Nothing earlier depends on anything later.

**Type consistency.** `expiredSummonIds(board, tick)` is defined in Task 1 and used only there. `DurationDelta` is defined in Task 2 and authored in Task 9 under the same spelling. `dispatchForTest` is Part 1 Task 2's export, imported here rather than redefined. The suppression scope is `jabberwockLifesteal` in Tasks 7, 9 and 10 alike; `barredFrom: {ofUnit, roles}` is the same shape in Tasks 5, 6 and 10; `carriesItemId` and `carriesItem` are the same in Tasks 6 and 10. The ability count moves 9 → 11 in Task 10, and Task 10 Step 5 updates Part 1's assertion rather than leaving two numbers disagreeing.

**Four spellings deliberately left to their task, each with a stated check and none guessable:** the `resolveTicks` import (Task 1), `contributionsOf`'s output bucket names (Task 4), `placement`'s radius-or-side (Task 8 — *"2 panel area"* and `size: 5` describe the same ring, and the wrong one is silently a different swarm), and the three element names on the Blade (Task 10). Each names the file to compare against, and Task 10 says explicitly that a missing element is built with its reader rather than deferred.

**The two verifications a green test cannot give.** J10 and R5 both have a failure mode that looks exactly like success from inside the suite: a `duration` that lands on the document while the monster stands forever, and a suppression that is correct until the monster is re-summoned. Task 11's inventory states both as observations of **absence** — a Jabberwock that is gone, a Health bar that does not move — because that is the only form of the check that can fail.
