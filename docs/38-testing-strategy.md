# 38 — Testing Strategy

A rules engine this size cannot be verified by playing it. This chapter specifies what is
tested, how, and — importantly — what is deliberately not.

---

## 38.1 What the architecture buys us

The Snapshot/Intent boundary (Ch. 03 §3.4) and the pure rules layer (Ch. 01 §1.7) mean that
**the hardest logic in the system is testable with plain function calls and JSON fixtures**.
No Foundry, no browser, no world, no mocking framework.

```js
import { computeDamage } from "../module/rules/damage/pipeline.mjs";
import fixture from "./fixtures/karna-brahmastra-kundala-vs-heracles.json";

test("Brahmastra Kundala against Heracles in his home base", () => {
  const result = computeDamage(fixture.context);
  expect(result.total).toBe(2071);
  expect(result.breakdown).toMatchSnapshot();
});
```

That test runs in under a millisecond and covers a 16-stage pipeline with eleven contributing
modifiers. This is the payoff for the purity constraint, and it is why the constraint is not
negotiable.

---

## 38.2 The test pyramid

```
                    ┌──────────────────┐
                    │  Manual playtest │   the twelve-Servant scenario
                    └──────────────────┘
                 ┌────────────────────────┐
                 │  Integration (headless)│   ~40 tests, need a world
                 └────────────────────────┘
            ┌──────────────────────────────────┐
            │  Golden files                    │   ~200 fixtures
            └──────────────────────────────────┘
       ┌────────────────────────────────────────────┐
       │  Property tests                            │   ~30 properties
       └────────────────────────────────────────────┘
  ┌──────────────────────────────────────────────────────┐
  │  Unit tests (L1 + L2)                                │   ~600 tests
  └──────────────────────────────────────────────────────┘
```

Roughly 850 automated tests, of which ~830 need nothing but Node.

---

## 38.3 Layer 1 — domain unit tests

Small, exhaustive, and cheap. These are the tests that catch the errors that silently corrupt
every number downstream.

### Rank algebra

```js
describe("Rank", () => {
  test.each([
    ["E-",  -1], ["E",   0], ["E+",   1],
    ["D",  100], ["C", 200], ["B-", 299], ["B", 300], ["B+", 301],
    ["A",  400], ["A+", 401], ["A++", 402], ["EX", 500],
  ])("%s has ordinal %i", (s, ord) => expect(Rank.parse(s).ordinal).toBe(ord));

  test("A++ is below EX", () =>
    expect(compare(Rank.parse("A++"), Rank.parse("EX"))).toBe(-1));

  test("Item Construction B- yields 35%", () =>
    expect(rankScaled(Rank.parse("B-"), IC_TABLE, 5)).toBe(35));   // Van Gogh's sheet

  test.each(["A+-", "F", "S", "A3", ""])("rejects %s", s =>
    expect(() => Rank.parse(s)).toThrow());
});
```

The `B- → 35%` test is the important one: it validates the model against an *authored value from
the source*, not against our own reasoning.

### Tick arithmetic

Exhaustive: every expression appearing anywhere in the reference set, crossed with
`turnsPerRound ∈ {3, 8, 15}`. About 40 × 3 = 120 assertions, each hand-verified.

```js
test.each([
  ["1◈",      3,  3], ["1◈",      8,  8], ["1◈",      15, 15],
  ["⅓◈",      3,  1], ["⅓◈",      8,  2], ["⅓◈",      15,  5],
  ["⅔◈",      3,  2], ["⅔◈",      8,  5], ["⅔◈",      15, 10],
  ["½◈",      3,  2], ["½◈",      8,  4], ["½◈",      15,  7],   // the 3-turn anomaly
  ["1◈+⅔◈",   3,  5], ["1◈+⅔◈",   8, 13], ["1◈+⅔◈",   15, 25],
  ["4◈-⅓◈",   3, 11], ["4◈-⅓◈",   8, 30], ["4◈-⅓◈",   15, 55],
  ["7◈+⅓◈",   3, 22], ["7◈+⅓◈",   8, 58], ["7◈+⅓◈",   15,110],
])("%s at %i turns/round = %i ticks", (expr, tpr, ticks) =>
  expect(TickExpr.parse(expr).resolve(tpr)).toBe(ticks));
```

Plus a **cross-check against the source's own worked example**: Van Gogh's
*"Stage 7 Curse → 2◈+⅓◈"* at 3 turns/round must equal `⅓◈ × 7 = 7` (Ch. 35 §35.5).

### Geometry

The attack-range shape gets exact panel-set fixtures and count assertions:

```js
test.each([[1, 9], [2, 25], [3, 37], [4, 57], [5, 81]])(
  "Range %i covers %i panels", (r, count) =>
    expect(attackRangePanels(ORIGIN, r, LARGE_BOUNDS)).toHaveLength(count));

test("Range 3 excludes exactly the twelve corner panels", () => {
  const set = new Set(attackRangePanels(ORIGIN, 3, LARGE_BOUNDS).map(key));
  for (const [di, dj] of [[3,2],[3,3],[2,3]])
    for (const s of signVariants(di, dj))
      expect(set.has(key(s))).toBe(false);
  expect(set.has(key({i:3, j:1}))).toBe(true);      // the boundary that IS included
});
```

Property tests for the metrics: symmetry, identity, triangle inequality, and
`chebyshev ≤ manhattan ≤ 2 × chebyshev`.

---

## 38.4 Layer 2 — rules unit tests

### The damage pipeline

**Golden fixtures.** Each is a `(context, expected)` pair with a fixed roll map.

```
test/golden/damage/
├── 001-simple-normal-attack.json
├── 002-penthesilea-vs-heracles.json          ← Ch. 13 §13.5, hand-traced
├── 003-brahmastra-kundala-home-base.json     ← Ch. 13 §13.6, hand-traced
├── 004-magic-resistance-negation.json
├── 005-magic-resistance-partial.json
├── 006-invuln-vs-np.json
├── 007-anti-purge-beats-pierce.json
├── 008-multihit-block-applied-once.json
├── 009-fixed-damage-skips-stages.json
├── 010-def-crk-excluded-from-injury-threshold.json
└── … ~120 more
```

The two hand-traced examples from Chapter 13 are fixtures 002 and 003. Every bug fix adds a
fixture. Fixtures are reviewed as carefully as code, because a wrong expected value bakes in a
bug permanently.

**Property tests** on the pipeline:

| Property | Statement |
|---|---|
| Monotonic in Atk Up | increasing any `Atk Up` never decreases the total |
| Monotonic in Def Up | increasing any `Def Up` never increases the total |
| Non-negative | no input produces a negative total |
| Component conservation | `magical + physical + fixed === total` at every stage |
| Deterministic | same context + same rolls ⇒ byte-identical result, breakdown included |
| Empty is identity | no modifiers ⇒ exactly `base × multiplier + flat` |
| Breakdown completeness | every modifier present on either unit appears in exactly one stage, or is listed as inapplicable |

The last one is the anti-silent-failure test (principle P4). It has caught more real bugs in
systems of this shape than any other single check.

### Targeting

Fixtures for all 24 declarations in the Ch. 09 §9.8 catalogue: given a board, a caster, and a
placement, assert the exact panel set and unit list.

Property tests: determinism; every returned panel in bounds; no duplicate units; every returned
unit's footprint intersects the panel set; `resolve` never mutates the snapshot (dev-mode
freezing enforces this).

### Effects

| Test | Verifies |
|---|---|
| Stacking matrix | Every `StackingRule` against reapplication, from every state |
| Mental exclusivity | The three-way Charm/Berserk/Confuse exclusion |
| Sleep family | The full replacement state machine (Ch. 10 §10.5) |
| Seared/Scald | Duration absorption and Burn blocking |
| Suppression fixed point | Terminates; a suppressor never suppresses itself |
| Terminal ladders | Item Construction's 50/25/10/0 progression |
| Transfer | Absolute expiry preserved; stages summed; `pausedTicks` rebasing |
| Removal selectors | `latest` is LIFO; `random` is uniform; statuses are never candidates |

### The combat state machine

The transition table (Ch. 12 §12.3) is tested by **exhaustive path enumeration**: every reachable
path through the ladder, asserting the terminal state.

```js
test("every ladder path terminates in damage or noDamage", () => {
  for (const path of enumeratePaths(TRANSITIONS, "declare")) {
    const terminal = path.at(-1);
    expect(["damage", "noDamage"]).toContain(stateAfterLadder(terminal));
  }
});
```

There are 14 paths. Enumerating them is cheap and it proves there is no dead end.

---

## 38.5 The scheduler

Tested with a scripted timeline fixture:

```yaml
# test/fixtures/scheduler/curse-and-expiry.yml
turnsPerRound: 3
setup:
  units:
    - { id: a, effects: [{ id: curse, stage: 2, startTurn: 4, expiry: null }] }
    - { id: b, effects: [{ id: atkUp, startTurn: 4, expiry: 7 }] }
timeline:
  - turn: 5,  expect: [{ event: curseTick, unit: a, damage: 50 }]
  - turn: 6,  expect: []
  - turn: 7,  expect: [{ event: curseTick, unit: a, damage: 50 },
                       { event: effectExpired, unit: b, effect: atkUp }]
```

Asserting the **firing log**, not the end state, so ordering bugs are caught. The ordering
assertions from Ch. 07 §7.7 — step 5 after step 4, step 2 covering all factions — are explicit
tests.

---

## 38.6 Integration tests

The ~40 tests that genuinely need Foundry, run headless with Puppeteer against a scripted world.

| Area | What is verified |
|---|---|
| Data models | Every schema round-trips; `validateJoint` rejects what it should |
| Derived data | Rule elements apply in the right order; auras resolve; suppression works end to end |
| Documents | `_preUpdate` clamps; `_preUpdateMovement` vetoes; defeat enqueues |
| Socket | A player client's request reaches the GM, is authorized, executes, and responds |
| Reaction protocol | A full ladder across two simulated clients, including a reload mid-ladder |
| Scheduler | Turn and round boundaries fire the right effects on the right client |
| Targeting | The canvas layer renders and the resolved set matches the pure computation |
| Content | Every compendium document loads and validates |

The reaction-protocol test is the most valuable and the most expensive: it scripts two browser
contexts, has one attack the other, and asserts the message chain and final state. It is slow
(~15 s) and it has caught real bugs that nothing else would.

---

## 38.7 Performance tests

Budgets from Ch. 23 §23.4, asserted with a 25% regression tolerance:

```js
bench("full board snapshot, 28 units", () => SnapshotService.board({ fresh: true }),
      { budgetMs: 8 });
bench("aura index rebuild, 28 units",   () => AuraIndex.rebuild(scene), { budgetMs: 3 });
bench("damage pipeline",                () => computeDamage(ctx),       { budgetMs: 0.5 });
bench("derived data, one actor",        () => actor.prepareData(),      { budgetMs: 2 });
bench("targeting resolve, 7x7 AoE",     () => resolve(spec, c, b, p),   { budgetMs: 1 });
```

Run in CI on a fixed runner. A regression fails the build with the before/after numbers.

---

## 38.8 The twelve-Servant playtest scenario

The manual test at the top of the pyramid, and the acceptance gate for **SC-7**.

A prepared world containing all twelve reference Servants with Masters, deployed on a 13×13
board, at Expert difficulty, 3 turns per round. A written script of ~60 actions exercising:

- every targeting shape in the catalogue,
- every class skill at least once,
- each of the three platforms activated and destroyed,
- the full reaction ladder including both Luck Check contests,
- at least three Command Spell interrupts, one at each interruptible point,
- Curse and Poison staging to stage 4+,
- a revival by each of the four revival mechanisms,
- Charm, Berserk, and Confuse control changes,
- a Grail materialization and a contested acquisition,
- a deliberate Grail-endangering AoE, cancelled at the warning.

Run before each release. Every step has an expected outcome; deviations become fixtures.

---

## 38.9 What is deliberately not tested

Stating this explicitly prevents test suites that grow without adding confidence.

| Not tested | Why |
|---|---|
| Foundry's own behaviour | It is not our code. We test *our* assumptions about it (§38.4's differential test) but not core itself. |
| Sheet rendering pixel-for-pixel | Brittle, low value. We test that context objects contain the right data. |
| Every effect definition individually | The catalogue is data; the *engine* is tested, and content is covered by validation plus the playtest. |
| Every rank × every table combination | Covered by the table-driven `rankScaled` tests; enumerating 120 effects × 7 ranks adds nothing. |
| Localization strings | Validated for existence by the content build, not by tests. |
| Network failure modes beyond timeout | Diminishing returns; the timeout path covers the practical cases. |

---

## 38.10 Test data hygiene

Fixtures are generated from the real content, not hand-written, wherever possible:

```bash
npm run fixture:capture -- --scenario "karna-vs-heracles" --seed 12345
```

captures a live resolution into a fixture with its roll map. The captured `expected` is then
**hand-verified against the rulebook** before being committed — a captured fixture that was never
checked is a regression test for current behaviour, not a correctness test, and the distinction
is recorded in the fixture's metadata:

```json
{ "verified": true, "verifiedBy": "hand-traced against Ch. 13 §13.6", "date": "2026-08-12" }
```

Unverified fixtures are allowed (they catch regressions) but are excluded from the
"correctness" suite and reported separately.

---

## 38.11 Summary of decisions

| # | Decision |
|---|---|
| D38.1 | ~830 of ~850 tests run in Node with no Foundry, enabled by the pure rules layer. |
| D38.2 | Golden fixtures for damage, with the two hand-traced chapter examples as fixtures 002 and 003. |
| D38.3 | Breakdown-completeness is a property test — the anti-silent-failure guard. |
| D38.4 | The ladder's 14 paths are exhaustively enumerated. |
| D38.5 | Scheduler tests assert the firing **log**, not the end state. |
| D38.6 | Performance budgets are asserted in CI with a 25% regression tolerance. |
| D38.7 | Fixtures record whether their expected value was hand-verified against the rules. |
| D38.8 | The twelve-Servant scenario is the release gate for SC-7. |

---

**Next:** [39 — Migration and Versioning](39-migration-and-versioning.md)
