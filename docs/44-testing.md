# 44 — Testing Strategy

## What it is

The system tests at three layers. **Unit tests** exercise pure domain and rules functions in isolation, and — since `test/helpers/world.mjs` — the engine layer against a modelled world. **Golden tests** pin worked examples from documentation. **Smoke tests** load a real world in real Foundry and fail if it does not come up.

The boundary enforced in chapter 02 — that `domain/` and `rules/` import nothing but each other — creates a crucial property: these two layers are testable without Foundry at all. Tests invoke them directly with hand-crafted inputs and inspect outputs.

**The engine layer used to be the hole in that.** This chapter said for most of its life that *"the application layers are slow and tied to Foundry, so they get minimal automated testing"*, and the second half was treated as a consequence of the first. `module/engine/io.mjs` — 1429 lines, every unit-state write in the game — was executed by **none** of the suite: the fake the applier injects stands in for io itself, so the seam sits above the code that holds the bugs, and `test/unit/actor-fields.test.mjs` had to reach it by reading the file as *text*. `test/helpers/world.mjs` removes that constraint by modelling the world rather than by moving the seam. What has not changed is the prescription below: engine tests stay **sparse and wiring-focused**. The pyramid was never inverted by this — it stopped having a hole at the top.

## Where it lives

| File | Role |
|---|---|
| `vitest.config.mjs` | Test runner configuration; specifies Node environment and coverage targets |
| `package.json` (scripts) | `test`, `test:watch`, `test:unit`, `test:golden` invoke vitest; `check:smoke` invokes smoke-world.mjs |
| `test/unit/*.test.mjs` | 211 unit test files, testing individual rules and domain functions |
| `test/golden/*.test.mjs` | 2 golden test files (damage, Akhilleus Kosmos authoring), pinning documentation worked examples |
| `test/fixtures/` | Small fixture files used to seed test data |
| `tools/lib/foundry.mjs` | Loads Foundry's **real** `common/` data layer from `FOUNDRY_PATH` (default `../foundryVTT_copy`) and registers this system's DataModels; fails the run when the copy is missing or is not the build `system.json` is verified on (ADR-0006) |
| `test/unit/rule-survival.test.mjs` | No normalizer or executor drops a key authored inside a rule element |
| `test/unit/survival.test.mjs` | Every Authored Key in the real corpus survives compile, DataModel and projection to a named route |
| `test/helpers/world.mjs` | A world faithful enough to run `engine/io.mjs` against — `withWorld({...}, fn)`, restoring globals in a `finally` |
| `tools/smoke-world.mjs` | Launches a real world via Chrome DevTools Protocol and fails if it does not reach `game.ready` |
| `tools/check-world.mjs` | Holds `test/helpers/world.mjs` against a live world, probe by probe (`npm run check:world`) |

## How it works

### The test pyramid

The system rests on unit tests at the base (211 test files covering domain and rules), golden tests in the middle (2 files pinning documentation), and smoke tests at the apex (real-world launch validation). This shape reflects a deliberate choice: the pure layers are testable and must be thoroughly tested; the application layers are slow, and their tests stay sparse and aimed at **wiring** — does this intent get created where it should, does this writer put the right thing in the document. That they were also *unreachable* was a separate problem, and is fixed.

### Unit tests on pure layers

`vitest.config.mjs:6` sets the environment to Node, because `domain/` and `rules/` have no Foundry globals. A test passes a plain object — a unit snapshot with only the fields a function reads — and asserts on the return value. Tests in `test/unit/` follow a naming convention: the test file mirrors the module being tested, so `module/rules/environment.mjs` is tested in `test/unit/environment.test.mjs`.

Fixtures are minimal and explicit. Board fixtures are constructed as plain objects with only the fields the function reads (`test/unit/environment.test.mjs:107`):

```javascript
const board = { zones: { baseA: { faction: "a", panels: [at(0, 0)] } }, units: [] };
```

Unit snapshots are similarly minimal:

```javascript
const resident = (over = {}) => ({
  id: "u", faction: "a", panel: at(0, 0),
  homeBase: { consecutiveRounds: 0, combatInBaseThisRound: false },
  effectInstances: [], ...over,
});
```

This sparseness makes tests fast and readable. A test that calls `endOfRoundHomeBase([resident()], board)` makes it obvious what the function reads and what it ignores (`test/unit/environment.test.mjs:114-130`).

**Engine layer testing** requires a mock because the real `io` would call `actor.update()`. `test/unit/applier.test.mjs:8-29` defines a `fakeIo` that records write calls in an array. Tests pass this fake to `applyIntents`, which routes all writes through it:

```javascript
const io = fakeIo();
await applyIntents([I.damage("a", 300), I.damage("a", 100)], { io, canWrite: ownsA });
const adjust = io.calls.filter(([n]) => n === "adjustHealth");
expect(adjust[0][2]).toBe(-400);
```

This allows the engine's orchestration logic — batching, ordering, authority routing — to be tested without Foundry. The applier's convergence hooks are guarded on `game` so tests can skip them (`module/engine/applier.mjs:120-122`). The fake is **derived from `worldIO()`'s real surface** rather than typed out; it had drifted to 17 of 35 methods, so any test emitting a `setStance` or `recordUse` intent died on `io.setStance is not a function`.

What that fake cannot tell you is what landed in the document, because it stands in for the thing that writes it. `test/helpers/world.mjs` is the other half: `withWorld({actors, tokens, combat, settings}, fn)` installs a modelled `game`/`canvas` over Foundry's **real** `foundry`/`CONST`/`CONFIG` (next section), backs every Actor, Item, ActiveEffect, Token and Combat with a real `Base*` document over this system's real DataModels, runs the prepare chain, and restores every global in a `finally`. It used to imitate the field classes, and the imitation let four Silent Drops through that Foundry does not: a write beneath a scalar field (`system.commandSpells.value`, abf8ac2), undeclared keys inside an object written to a `SchemaField`, seeded keys nothing declares, and any path on an Item, Effect, Token or Combat. `test/unit/world-loud-prune.test.mjs` holds each of them.

**The loud prune.** Every write goes through Foundry's own `updateSource`, and each path written is then read back out of `_source`. Anything that did not land exactly as asked **throws**, naming the path, what was asked and what landed: a key pruned for want of a declaration, a `NumberField` that clamped or rounded, a value reset to its initial, an `ArrayField`/`SetField` write voided by one bad element. Seeds are held to the same check, so a test cannot build its world out of keys the schema would have dropped. Foundry does every one of these silently; throwing is less faithful and is the point. Its first run found a live one: `io.defeat` writes `overlayEffect` to the token, which v14's Token does not have, so the defeat skull has never appeared (#96). A drop found in production code and not yet fixed goes on the harness's `KNOWN_DROPS`, with its issue — the write is recorded and allowed to drop so other tests can run past it — and that list may only shrink.

**A model that is subtly wrong is worse than none**, because the tests written against it encode the wrongness. `npm run check:world` (`tools/check-world.mjs`) is the answer to that: it runs the same probe against the model and against a live world over CDP and reports where they disagree. Four probes are expected to *diverge*, all of them the loud prune: an undeclared write, a clamped `NumberField`, a `BooleanField` coerced from `1`, and a `SetField` of `DocumentIdField` given non-ids — Foundry is silent on each and the model throws. They are asserted by the check, so a deliberate difference cannot quietly become an accidental one, and a Foundry upgrade that stops being silent shows up as a mismatch. Local only, like `check:smoke`.

It earned itself on its second test. `countTowardsGrail` read `!combat.system?.grailMaterialized` on the line *after* the `await combat.update()` that set it, so the guard was `true && false` on every defeat and `Hooks.callAll("fgtGrailMaterialized")` had **never fired**. Nothing could have caught that without executing io.

Test coverage reports only domain and rules (`vitest.config.mjs:10`), because a line executed in unit tests might still receive nothing from the real world. A defect hidden by test isolation cannot be caught by measuring coverage — this is the trap documented below.

### Foundry's real data layer

Most of this project's worst defects were **Silent Drops** (`CONTEXT.md`): a key discarded with no error, so the Clause it carried simply did not happen and only a live board noticed. About a dozen were Foundry's own `SchemaField` pruning a key the schema did not declare, and no test could see them while every test ran against an imitation of the field classes.

`tools/lib/foundry.mjs` removes that. `loadFoundry()` imports `app/common/server.mjs` from a checkout of the private `zarex97/foundryVTT_copy` — `common/` is pure ESM and needs only a `logger` global — and after it `globalThis.foundry` is the real namespace. `installSystem()` then registers `module/data/**` exactly as `module/fgt.mjs` does at `init`, with the `game` and `CONFIG` a Document needs to construct, so `new foundry.documents.BaseActor({type: "servant"}, {strict: true})` builds a real document over the real `ServantData`. `test/unit/foundry-loader.test.mjs` proves it for every Actor and Item type: each constructs strictly, and each prunes a key its schema does not declare.

Three rules come with it, all from ADR-0006:

- **A missing copy fails the run; it never skips.** A guard that quietly does not run is a Silent Drop of its own. Clone the copy beside this repository or set `FOUNDRY_PATH`. CI checks it out with the `FOUNDRY_SOURCE_TOKEN` secret.
- **The copy must be the verified build.** `locateFoundry` compares the copy's `major.build` with `system.json`'s `compatibility.verified` before importing anything, since cleaning rules change between releases.
- **Only `common/` is real.** The `client/` layer (DOM, PIXI, `@common` aliases) does not import in Node. The one client class `module/data` extends, `RegionBehaviorType`, is a bare `TypeDataModel` stand-in; the schemas built on it are still real. Client-side traps (the empty-diff skip before a write is sent, `_preCreate` edits that never reach the server) stay the job of lint and live probes.

Foundry v14 needs Node 24 (its own `engines`), so CI and `package.json` say so.

### The survival test

`test/unit/survival.test.mjs` holds Hop 4 of Ch. 07's Route: that what the DataModel keeps, the rules can
see. It compiles the **real** corpus, builds each Unit through the real DataModel in the test world,
prepares it and projects it with the real `snapshotUnit`, and loads each Effect definition into the real
`EffectRegistry`. Every Authored Key must then have a **route** in the test's own tables:

- **projected** (`at`) — the prepared value must be what the snapshot holds there, through a named
  transform (`range` splits into `range` and `maxTargets`; `agility` is the pool's `value`). A value that
  carries no Clause — `null`, `false`, `""`, empty — is not checked, since a default cannot be told from a
  drop.
- **read from the document** (`reader`) — the named file must still mention the key, so a reader that goes
  away takes the route with it.
- **unread** — a key found with no reader at all, owned by an issue. The count may only shrink.

A key with no route fails, naming the file and the last Hop it reached. Its first run found two: Raikou's
copies' Normal Attack `elementFraction` was dropped by the projection (fixed — it now travels beside
`element`), and Tenmōkaikai's `deactivation` window has no reader at all (#101). Reintroducing the
`requiresHistory` omission in `collectAbilities` turns it red, naming The Queen's Glass Game.

### The rule-element survival test

`test/unit/rule-survival.test.mjs` extends the survival idea one Route further, into the keys
**inside** rule elements. Every element in the real corpus — on Units, Abilities, Effects and bounded
fields' interiors — goes through the real `collectContributions` (ordering, predicate, normalization,
executor), and every phase through `effectSpecsOf`, wrapped in a Proxy that records every authored path
anything reads. A leaf nobody read, and that did not travel into the output inside an object carried
whole, fails. The context supplies one stack of everything, so a per-stock clause reads its whole
`perStack`. Class Skill templates are skipped because their embedded copies carry the real values.
Exemptions are per element type with a reason; drops found in shipped content are `KNOWN_RULE_DROPS`,
owned by #102 and #103, may only shrink, and fail as stale once fixed. An element type whose executor
cannot run without a world is printed and fails the count, rather than being skipped. Reintroducing
`r.effect ?? r` in `effectSpecsOf`, or dropping the Aura's `check`, turns it red naming the key.

### Golden tests

Golden tests serve as acceptance fixtures: if a documented worked example stops producing its documented output, either the documentation or the code is wrong. `test/golden/damage.test.mjs:1-6` states:

*"The two worked examples in docs/13-damage-pipeline.md Ch. 22 and Ch. 22 are the acceptance fixtures: if these two numbers change, either the documentation or the implementation is wrong and the diff says which."*

Each golden test supplies a complete snapshot by hand, calls the function, and asserts the result. For example, when Penthesilea attacks Heracles with specific modifiers, the damage is 409 (`test/golden/damage.test.mjs:47-69`). If someone changes the damage formula and that number shifts to 408 or 410, the test fails. The developer must then update the documentation to match, or revert the code change.

Golden tests are few (2 files) because they are expensive to write — every field in the snapshot must be correct and every expected value must match the documentation. They are most valuable for complex, deterministic calculations like damage, where the pipeline is documented with worked examples.

### Smoke tests

Smoke tests load a real world in real Foundry using Chrome DevTools Protocol, open it in a live browser, join it as a user, and wait for `game.ready`. They do not assert anything; they only verify the world comes up (`tools/smoke-world.mjs:90-100`). The purpose is catching defects that vitest cannot reach: schema mismatches in `EffectData`, hooks that throw on `setupGame`, and initialization code that assumes documents exist.

The test is invoked like so: `npm run check:smoke -- --world=fgt2026 --user=Gamemaster`. It needs two things the CI runners cannot provide (`tools/smoke-world.mjs:23-27`):

1. Foundry running and serving the world (default `http://localhost:30000`).
2. Chrome started with a debugging port: `chrome.exe --remote-debugging-port=9222`.

Smoke tests run locally before release, alongside `npm run check:release`. An uncaught exception anywhere in the launch sequence fails the run and prints its stack. This is the entire contract: **did the world come up?**

The contrast with unit tests is stark. Lint passes. All 629 tests pass. The content validator passes. But if a schema change breaks the world, nothing in vitest would catch it—only a smoke test, because only a smoke test loads a world.

## Invariants & edge cases

1. **Domain and rules layers are testable without Foundry.** They import nothing but each other, and they take no Foundry globals or documents. Tests hand them plain objects and assert on return values (`vitest.config.mjs:6-9`).

2. **A fakeIo allows engine functions to run without the world.** `applyIntents` stays exercisable by unit tests with an injected `io` and no Foundry globals, because the convergence hooks are guarded on `game` (`module/engine/applier.mjs:120-122`).

3. **Golden tests serve as acceptance fixtures.** If the worked example's output changes, the documentation or implementation must change. The test cannot pass if they disagree (`test/golden/damage.test.mjs:1-6`).

4. **Smoke tests are a local gate, not CI.** They require a running Foundry and cannot be automated in the GitHub runners (`tools/smoke-world.mjs:23-27`).

5. **Coverage reports only domain and rules.** Code executed in a unit test is not evidence of correctness; it may never be called from the real world (`vitest.config.mjs:10`).

## Traps and anti-patterns

**Unit test isolation hides missing wiring.** A function can be thoroughly unit-tested, with high coverage and every scenario passing in isolation, while nothing in the engine supplies the inputs the test injects by hand. The test proves the function is correct *given that input*, but never proves the input arrives from anywhere. This defect hides so completely that coverage tools show no gaps.

**The pattern of the trap:** A rules function reads a field (say, `x`). A unit test creates a fixture with that field set to a specific value, calls the function, and asserts the output. The test passes. But in the real engine, nothing ever writes `x` to the object. A linter cannot catch this, because `x` is a valid field. Coverage cannot catch it, because the test executed the line that reads `x`. Smoke tests might not catch it, if the match never triggers the condition that would need `x` to be non-default.

**Concrete example: GitHub issue #19.** `endOfRoundHomeBase` reads `u.homeBase.combatInBaseThisRound` to decide whether to apply Home Base effect E1 (100 Health + 1 Agility restore). The Home Base rule states: a unit in its base at round end regenerates, *unless it fought in the base this round* (`module/rules/environment.mjs:248-252`).

The unit test at `test/unit/environment.test.mjs:121-125` reads:

```javascript
it("excludes a unit that fought inside its own base this Round", () => {
  const u = resident({ homeBase: { consecutiveRounds: 0, combatInBaseThisRound: true } });
  expect(endOfRoundHomeBase([u], board).some((i) => i.kind === "heal")).toBe(false);
});
```

The test passes. The function correctly returns no heal when the flag is true.

But `combatInBaseThisRound` is never written anywhere in the engine layer. Not in any intent construction, not in any IO call, not in any scheduler sequence. The field exists only in the test's hand-crafted fixture. In a real match, `combatInBaseThisRound` is always false (the default), so E1 fires unconditionally, violating the rule. The test is green. Coverage is high. The defect is live.

**Verification:** `grep -rn 'combatInBaseThisRound' module/ test/` returns only reads in `module/rules/environment.mjs:246-249`, test setup in `test/unit/environment.test.mjs`, and nowhere in `module/engine/` with an assignment operator. The field is read and tested but never written.

**Why it is still live:** The problem is not laziness — it is architectural. The engine should track when a unit fights in its base (perhaps in the attack flow, or in the applier when damage is applied), and set the flag in an intent or IO call. But this tracking does not exist. Meanwhile, the test passes, and a developer might reasonably assume the rule is implemented.

**The mirror image: a field with writers and no readers.** The same blindness runs the other way, and it is harder to spot because everything about it looks like it works. `turnState.mayMoveAgain` was declared on the schema, projected by `turnStateAt`, recomputed by the movement hook after every move, cleared by the Riding Attack path and blanked at the turn boundary — three writers, all correct, all live. Nothing read it, ever. Riding's second segment was decided elsewhere the whole time (`module/rules/movement.mjs:63,94`). A reader with no writer silently does nothing; a writer with no reader silently costs a document write and reads as a feature. Neither the schema, the projection nor coverage can tell you which you have; only asking the question can. `turnState.servantsActed` was a third variant — a **read** of a field no schema declared and nothing wrote, so the Master sheet's multi-Servant-tax badge was permanently `0` and the one warning a Master gets about the Ch. 32 tax never appeared.

**The antidote:** Coverage tools measure lines executed, not contracts satisfied. If a rules function reads a field, integration tests or smoke tests that exercise the real world are the only gate that can catch the fact that nothing is supplying it. Unit tests that inject the value by hand prove correctness *given the input*, not that the input ever arrives. *Domain layer tests should be dense with edge cases. Engine layer tests should be sparse, but focused on wiring—does this intent get created where it should?*

## Open questions

- **Closed, in two stages, and the second stage is the interesting one.**
  [#19](https://github.com/zarex97/FGT_FVTT_v2/issues/19) stood on a complete symbol search: nothing
  anywhere wrote `combatInBaseThisRound`, so Ch. 29's E1 regeneration fired unconditionally while the
  test asserting the exclusion passed on a hand-built fixture. It has a writer now —
  `module/engine/attack.mjs:2404` marks every unit that fought inside its own base, round-stamped
  rather than tick-stamped because the check reads it at the END of the Round.

  That was not the end of it. The field was then **revived** out of stale records for as long as it had
  a writer, because `io.recordUse` re-stamped the Round while writing only `abilitiesUsed`, so a `true`
  from Round 3 read as current in Round 5 the moment the Unit used any ability at all. E1 went from
  never being withheld to being withheld from Units that had not fought. Both halves are fixed and both
  were measured live ([Ch. 18](18-items.md)). **The lesson is that "the field now has a writer" is not
  the same as "the rule now works"** — it is the point at which the field becomes capable of being
  wrong, and the first time anything downstream of it can be tested at all.

- **Why are only two golden tests documented?** The damage pipeline has worked examples in Ch. 22 and Ch. 22 that are validated by tests. Other chapters with worked examples are not similarly pinned. The scope of golden testing is underdefined.

- **Should unit tests inject `game`?** The convergence hooks guard on `game` to allow engine tests to run (`module/engine/applier.mjs:120-122`). But tests never create a mock `game` object; they rely on it being undefined. This works because the check is `if (game && callback)`, but it is fragile — a future change that removes the guard would silence no warning in tests.
