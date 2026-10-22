# The Count module and the Use record: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task
> (no subagents for the build: memory `subagent-limits`). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One module answers every "how many" a sheet asks (#283, #284 Godspeed, #288's count), and one stored
record of what a use did drives its Cooldown (#285, #299, #300).

**Architecture:** `module/rules/count.mjs` is a pure Count module. It has a closed list of kinds, and becomes the
only reader of `perStack`, `countTargets`, `countMatching` and `perUnit`. `module/rules/use-record.mjs` is a pure Use
record. Both use paths fill it, and it is stored with the declaration's Process state. A Cooldown clock in
`module/engine/cooldown.mjs` starts at commit and settles once from the record. `CooldownCutBonus` and `UseFailure`
are new rule elements, each read at one door.

**Tech Stack:** Foundry VTT v13 system (ES modules), vitest against real Foundry (`FOUNDRY_PATH`, ADR-0006), YAML
packs built by `tools/build-packs.mjs`, live presses through claude-in-chrome as Player1 plus `tools/fgt-*.mjs`.

**Spec:** the grill of 2026-10-22 (Q1–Q20), recorded under *Settled rulings* below. Architecture report:
`%TEMP%/architecture-review-20261022-gaps.html`, candidates 1 and 2.

## Settled rulings

| # | Ruling |
|---|---|
| Q1 | Two branches, in order: `claude/count`, then `claude/use-record`. One tracking issue and one PR each. "Count" and "Use record" go into `CONTEXT.md`. |
| Q2 | The old spellings stay in content, and the Count module is their only reader. New kinds use `count: {of, …}`. |
| Q3 | One rule for counting stacks: the stage, else the uses, else 1. A suppressed or disabled instance counts 0. |
| Q4 | `criteria:` on the ability. Each criterion tests the declaration's targets: `atLeast`, `exactly` or `none`. Counted once per declaration. Damage, cost and cooldown read that one number. When there is one DU, "at least N DUs" is met by that one DU. |
| Q5 | `RankShift` steps can come from a Count (Godspeed). Lionheart's in-Combat shift stays open on #284. |
| Q6 | A mode's tally lives on the mode's activation. An event handler adds 1, and the mode ends at N. The paid extension stays open on #288. |
| Q7 | The Use record holds `failed`, `missed`, `evaded`, `unitsHit`, `effectsApplied`, `effectApplied:<id>`, `debuffsInflicted`, `summoned`, `criteriaMet`, `die`, `overCooldown`, `channelStarted` and `concealmentBroken`. Built readers (`@unitsHit`, `@stageDelta`, `perUnit`, Nemo's terrain stand-in) keep working. |
| Q8 | The clock starts at commit on both paths, and settles once at the declaration's end. |
| Q9 | At settle time, `branches` and `conditionalBonus` predicates also see `use:` options. Per-count additions read a Count of kind `use`. |
| Q10 | `CooldownCutBonus {kinds, extra, on: any\|natural}`, applied at the applier's one `reduce` door. |
| Q11 | A failed use still pays its budget and costs, and no clock starts. This follows Blind's precedent. |
| Q12 | `docs/model/cooldown.md`'s `bypassForCost` line becomes `keys: field.cooldownOverride`. #306 is closed as built. Lanceturia's Mana Burst is content for her own build. |
| Q13 | Count kind `parameters {vs: self, compare: gte\|belowBy, by}`, and a new option `target:healthVsSelf:gt\|lt\|eq`. |
| Q14 | The tally starts at 0 on each activation and shows "4/7" on the bar and the sheet. Reaching N ends the mode, with a card line naming the count. |
| Q15 | An attack settles after the declaration's last Process, and a Skill after its Phases. Any change made at settle is a card line. |
| Q16 | `UseFailure.then` is closed: `lockThisTurn` or `endActions`. An unknown value is refused at build time. Okita stays her own. |
| Q17 | `UseFailure {of, chance, chanceWhen, then}` is an element, not a field. `of` is `self`, or a list of `np`, `spell`, `skill` and content ids. |
| Q18 | The Use record is stored with the declaration's saved Process state, and never only in memory. |
| Q19 | Closed Count kinds: `stacks`, `targets`, `board`, `resource`, `parameters`, `criteria`, `use`, `tally`. An unknown kind is refused at build time, and refused out loud at use. |
| Q20 | No real Servant content. New kinds are proved by `test-` abilities, pressed live as Player1. Built users of the old spellings are pressed again. |

## Global Constraints

- Main checkout, on a branch off `claude/fvtt-system-design-docs-l7nhv9`. No worktree and no agents. Run `git status` before blaming a red test. `nul` is not ours.
- **Silent Drop steps** apply to every new authored key or field:
  1. Declare it on the DataModel.
  2. Add it to `AUTHORED_*_KEYS` in `module/content/authored-fields.mjs`.
  3. Give it a route in `test/unit/survival.test.mjs`.
  4. Make its reader visible to `test/unit/field-ledger.test.mjs`.
  5. Build subjects with `test/helpers/subject.mjs`.
  6. Run against real Foundry.
- Every outcome a player must know gets a card line. Every new refusal reason gets a lang string under `FGT.Ability.Refused.*`.
- A Unit named on a line goes through `publicIdentityOf`. A War Rule goes through `warRule`. The War goes through `currentWar()`.
- Docs change in the same commit as the code: the owning chapter, the `keys:` lines in `docs/model/*.md`, and `CONTEXT.md` when a term moves.
- Each task ends green. Run `npx vitest run --maxWorkers=4 --minWorkers=1` while Foundry runs (memory `suite-flakes-under-load`), then `npm run lint`, `npm run validate:content` and `npm run check:templates`. Name every failure's cause from its diff.
- Commit at the end of each task, locally. Push and open PRs only when the user says.
- Record a Surprise the moment one happens. Five are unreviewed now (the #306 one is uncommitted), so `/review-surprises` is due. Say so in the final report.
- After each `module/` edit, run `node tools/fgt-reload.mjs` before any live press (stale page = false evidence). A content change needs `node tools/fgt-rebuild.mjs`.

## Review Focus

1. **A count of zero.** `perStack` pays nothing at zero stacks, its `base` included (Kingprotea). `countTargets` pays its `base` at zero matches (Van Gogh's floor of 3). Both must survive the move unchanged. Pinned in Task 1.
2. **A Counter inside an area NP.** A Counter is its own Attack. Only the declaration's own Processes settle the declaration's clock, never the Counter's. Pinned in Task 12.
3. **A reload mid-declaration.** The record survives a GM reload between two Processes of one area NP. Pinned in Task 11's test and live press L2-5.
4. **A use on its Cooldown, or a channel.** With `overCooldown` or `channelStarted`, neither start nor settle touches the clock. Pinned in Task 12.
5. **A cut bonus on nothing.** A cut of 0 Turns, or a cut on a clock already at 0, gains no extra Turn and never goes below 0. Pinned in Task 13.

---

# Branch 1: `claude/count`

### Task 0: Housekeeping

**Files:**
- Modify: `CONTEXT.md` (add **Count**, **Use record**, **Criteria**, **Tally**)
- Modify: `docs/model/cooldown.md:37-41` (`bypassForCost` → `keys: field.cooldownOverride`, with Lanceturia as content)
- Carry: `docs/surprises/2026-10-22-issue-306-claimed-a-built-gap.md` (set **Fix** to the model line `@ <sha>`, `status: fixed`)

- [ ] **Step 1:** `git checkout -b claude/count` from `claude/fvtt-system-design-docs-l7nhv9`.
- [ ] **Step 2:** Open two tracking issues with `gh issue create`:
  - "Count module: one reader for how many". It closes #283, the Godspeed part of #284 and the count part of #288.
  - "Use record and Cooldown clock". It closes #285, #299 and #300.
- [ ] **Step 3:** On #306, comment with the `cooldownOverride` path. Point to Lanceturia's Mana Burst as her content, then close it as built. On #284 and #288, comment with what stays open (the Lionheart shift and the paid extension).
- [ ] **Step 4:** Write the four `CONTEXT.md` terms, with no implementation detail:
  - **Count**: a number a rule reads, taken from one of a closed list of sources.
  - **Use record**: what one use of an ability did.
  - **Criteria**: tests over the declaration's targets.
  - **Tally**: events counted during one activation of a mode.
- [ ] **Step 5:** Run `npx vitest run test/unit/capabilities.test.mjs`. Expected: PASS, since every `keys:` line still resolves.
- [ ] **Step 6:** Commit with the message `docs: Count and Use record terms; #306 is built (cooldownOverride)`.

### Task 1: Pin today's counting before moving it

**Files:**
- Create: `test/unit/count-characterization.test.mjs`

These tests pin the numbers each of the six readers gives **today**, through their current exports. They must pass before Task 2 and after Task 3 unchanged, except for the two Q3 cases, which are marked.

- [ ] **Step 1:** Write the tests. Use `withSubjects` and the real projection, never hand-built snapshots.
  - `stackScaled via resolveValue: 10 Proliferation stocks × 8 capped at max 80` → `80`. With 0 stocks and `base: 30` → `0`.
  - `timesOf({perStack:{effect:"proliferationStock"}})` with 7 stocks → `7`, and with `each: 3` → `2`.
  - `timesOf("@unitsHit", {event:{unitsHit:2}})` → `2`, and `"-@stageDelta"` with `stageDelta:-3` → `3`.
  - `stackTimes`, through `ACTIONS.ApplyEffect` `times: {perStack}`, with 4 stocks → 4 applications.
  - `cooldownChanges` with `perStack: {effect: curse}` on a Stage 7 Curse and `ticks: "⅓◈"` at 3 turns/Round → reduce `7`.
  - `countMatchingTurns` with 3 enemy Doves and `maxTicks: "⅓◈"` → `1`.
  - `countTargetsMagnitude({base:3, each:1, requires:[…], excludeSelf:true})` over 2 matching targets plus the caster → `5`. Over 0 matching → `3`.
  - `cooldownFor` with `perUnit: "⅔◈"` and `count: 4` at 3 turns/Round → `ticks: 8`.
  - **Q3 change, marked `// changes in Task 3`:** a staged Stage 5 effect seen by `stackTimes` → `1` today.
- [ ] **Step 2:** Run `npx vitest run test/unit/count-characterization.test.mjs`. Expected: PASS. If a figure differs, the test is wrong: read the reader and fix the figure, never the code.
- [ ] **Step 3:** Commit with the message `test: pin every count reader's figures before the Count module`.

### Task 2: The Count module

**Files:**
- Create: `module/rules/count.mjs`
- Create: `test/unit/count.test.mjs`

**Interfaces (Produces):**

```js
export const COUNT_KINDS; // frozen: ["stacks","targets","board","resource","parameters","criteria","use","tally"]
export class UnknownCountKind extends Error {}          // .kind holds the word
/** @returns {number} a non-negative integer */
export function countOf(spec, ctx);
/**
 * v: number | {count: CountSpec, per = 1, each = 1, base = 0, max?, zeroPaysNothing = false}
 * → base + per × floor(count / each), clamped to max; 0 when zeroPaysNothing and count is 0.
 */
export function countedValue(v, ctx);
/** The one stacks rule (Q3): Record<defId, number> from an actor's effects OR a snapshot's effectInstances. */
export function stacksHeld(holder);
/** Legacy spellings → canonical CountedValue, so no reader keeps its own arithmetic. */
export function fromPerStack(perStack);      // {count:{of:"stacks",effect}, per:1, each, base, zeroPaysNothing:true}
export function fromCountTargets(spec);      // {count:{of:"targets",requires,excludeSelf}, per: spec.each, base: spec.base}
export function fromCountMatching(spec);     // {count:{of:"board",relation,requires}, max: maxTicks resolved by caller}
```

`ctx` holds `{stacks, targets, casterId, board, self, refs, target, use, ability}`. Each kind reads only its own field:

| Kind | Reads |
|---|---|
| `stacks` | `ctx.stacks[spec.effect]` |
| `targets` | `ctx.targets` filtered by `requires` (`rollOptionsFor({attacker: u})`) and `excludeSelf` |
| `board` | `ctx.board.units` by `relationOf(ctx.self, u, board) === spec.relation`, then `requires` |
| `resource` | `ctx.refs.self.resources[spec.key].value` |
| `parameters` | Task 5 |
| `criteria` | `ctx.use?.criteriaMet` |
| `use` | `ctx.use?.[spec.fact]`, where `true` → 1 and a missing fact → 0 |
| `tally` | `ctx.ability?.tally ?? 0` |

- [ ] **Step 1:** Write `count.test.mjs`:
  - `COUNT_KINDS equals the eight Q19 kinds, frozen`.
  - `countOf throws UnknownCountKind naming "bogus"`. Assert `err.kind === "bogus"` and the message contains `bogus` (*passes for the wrong reason* lesson).
  - One test per kind, each with a case the kind excludes: a suppressed stack, a target failing `requires`, an ally when `relation: enemy`, a missing resource, and so on.
  - `countedValue`: `{count:{of:"stacks",effect:"x"}, per: 8, max: 80}` with 12 stacks → 80. `each: 3` with 7 → 2. `zeroPaysNothing` with 0 and base 30 → 0. A plain number → that number.
  - `stacksHeld`: a stage beats uses, uses beat 1, a suppressed instance counts 0, and a disabled one counts 0. It reads both shapes: an actor's `effects` and a snapshot's `effectInstances` (with `suppressed`).
  - `fromPerStack`, `fromCountTargets` and `fromCountMatching` give the canonical forms above.
- [ ] **Step 2:** Run the test. Expected: FAIL, because the module does not exist.
- [ ] **Step 3:** Implement `module/rules/count.mjs` (rules layer, pure, no Foundry globals). `stacksHeld` moves here from `rules/snapshot.mjs:2119` with its comment. The snapshot imports it, and no copy is left behind.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit with the message `feat(count): one Count module, closed kinds (#283)`.

### Task 3: Every legacy reader asks the Count module

**Files:**
- Modify: `module/rules/elements.mjs:416-460` (`resolveValue`/`stackScaled`: `el.count` canonical, `el.perStack` via `fromPerStack`)
- Modify: `module/rules/effect-flow.mjs:569-580` (`timesOf`: the object branch → `countedValue(fromPerStack(..))`, the `@field` string branch stays an expression)
- Modify: `module/engine/scheduler.mjs:1248,1282,1613-1635` (delete `stackTimes`; `times` objects → `countedValue(fromPerStack(...), {stacks: stacksHeld(u)})`)
- Modify: `module/engine/skill-use.mjs:1781-1846` (`cooldownChanges` perStack → `countedValue`; delete `countMatchingTurns` → `countOf(fromCountMatching(...).count, …)` with the `maxTicks` cap kept at the call site)
- Modify: `module/engine/landing.mjs:44,461-487` (`countTargets`/`perStack` magnitude → `countedValue`)
- Delete: `module/rules/effects/count-targets.mjs` (its doc comment moves into `count.mjs` above the `targets` kind)
- Modify: `module/engine/cooldown.mjs:80-83` (`perUnit` stays: it is a Use fact and moves in Task 12; for now only the arithmetic, `fractionOfRound × turnsPerRound × count`, is unchanged)
- Create: `test/unit/count-one-reader.test.mjs`
- Modify: `test/unit/count-characterization.test.mjs` (flip the marked Q3 case to `5`)

- [ ] **Step 1:** Write `count-one-reader.test.mjs`, following the pattern of `test/unit/polarity-one-reader.test.mjs`.
  - Walk `module/` with comments stripped. Any read of `.perStack`, `.countTargets` or `.countMatching` outside `rules/count.mjs` fails, unless its line carries `// fgt-count-ok: <reason>`.
  - The allowlist names `rules/authoring/*` (descriptors) and `tools/lib/content.mjs` (validator).
  - Assert the count of guarded sites is ≥ 6, so the pattern cannot quietly match nothing.
- [ ] **Step 2:** Run it. Expected: FAIL, listing the six readers.
- [ ] **Step 3:** Route each reader as the Files list says. Delete `stackTimes` and `countMatchingTurns` outright: replace, don't layer.
- [ ] **Step 4:** Run `npx vitest run test/unit/count-one-reader.test.mjs test/unit/count-characterization.test.mjs test/unit/count.test.mjs`. Expected: PASS. The Q3 case now reads 5.
- [ ] **Step 5:** Run the full suite. Expected: green. A Kingprotea, Van Gogh, Semiramis or Arturia test that moves is a regression to fix, never a figure to update.
- [ ] **Step 6:** Update the docs:
  - `docs/10-rule-elements.md`: the value funnel names the Count module.
  - `docs/16-effect-flow.md`: `times`.
  - `docs/45-case-studies.md`: one paragraph, "six readers became one".
- [ ] **Step 7:** Commit with the message `refactor(count): perStack, countTargets, countMatching read through the Count module`.

### Task 4: `count:` is authored, validated and refused out loud

**Files:**
- Modify: `module/rules/authoring/elements.mjs:56` (beside `perStack`, add `{ key: "count", type: "raw" }`)
- Modify: `module/rules/effect-flow.mjs` `ENTRY_KEYS` (add `count`, meaning "Size the magnitude by a Count: {of, …}.")
- Modify: `tools/lib/content.mjs` (validator: every `count:` object, at any depth an element, entry, phase change, cooldown or cost can hold it, names a kind in `COUNT_KINDS` and that kind's required keys)
- Modify: `module/rules/costs.mjs` (`canUseAbility`: before the other gates, walk the ability's `count:` specs; an unknown kind → `{ok:false, reason:"unknownCountKind", detail:{kind}}`)
- Modify: `lang/en.json` (`FGT.Ability.Refused.unknownCountKind`: "{name} cannot be used: it counts \"{kind}\", which the system does not know.")
- Modify: `test/unit/survival.test.mjs`, `test/unit/field-ledger.test.mjs` (route `count` like `perStack`)
- Test: `test/unit/count-validation.test.mjs`

- [ ] **Step 1:** Write the tests:
  - The validator rejects `{key: FlatDamage, value: 5, count: {of: "bogus"}}`. The error names the file, the path and `bogus`.
  - It rejects `{count:{of:"stacks"}}` with no `effect`.
  - It walks the nested places: inside `phases[].changes[]`, `cooldown.countBonus[]`, `additionalCosts[].amount` and `damage.multiplier`.
  - `canUseAbility` on an Item whose rule holds `count:{of:"bogus"}` returns `reason: "unknownCountKind"`, and the lang key exists (`game.i18n.has`).
  - The bar slot shows that reason (`apps/hud/present.mjs#slotFor`).
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement. The validator walk is written once (`countSpecsIn(doc)`), and the use gate imports it. One walker, two readers.
- [ ] **Step 4:** Run the tests, `npm run validate:content` and the suite. Expected: PASS, and 0 content errors.
- [ ] **Step 5:** Update `docs/39-authoring-vocabulary.md` (the `count:` row with all eight kinds) and `docs/model/predicate.md` / `element.md` (`keys:` lines). Commit with the message `feat(count): count: is authored, validated, and refused at use when unknown`.

### Task 5: Comparing a DU with the caster

**Files:**
- Modify: `module/rules/options.mjs:269-285` (beside `compareParameters`: `compareHealth` emits `target:healthVsSelf:gt|lt|eq`, from current Health, `domain/health.mjs#currentHealth`)
- Modify: `module/rules/facets.mjs` (facet `healthVsSelf`, closed `gt|lt|eq`, target subject only)
- Modify: `module/rules/count.mjs` (kind `parameters`)
- Modify: `lang/en.json` (facet prose and hint; hint equals the English, `facets.test.mjs:109`)
- Test: `test/unit/count.test.mjs`, `test/unit/options.test.mjs`, `test/unit/facets.test.mjs`

`parameters {vs: "self", compare: "gte"}` counts how many of `ctx.target`'s five Parameters `Rank.compare(t, self) >= 0`. `{compare: "belowBy", by: 2}` counts those at least `by` whole grades below the caster's (`Rank#stepGrade` distance, so B+ is not two grades below A). A Unit without `parameters` (a Master) counts 0.

- [ ] **Step 1:** Write the tests:
  - DU parameters `A,A,B,C,EX` vs self `B,B,B,B,B` → `gte` = 4.
  - `belowBy 2` vs self `A`: `C` counts, and `B+` and `C+` follow the grade rule (write both cases).
  - A Master → 0.
  - `target:healthVsSelf:gt` when the DU has more current Health, `lt` when less, `eq` when equal, and absent when either has no Health.
  - Facet ACCEPT `target:healthVsSelf:gt`, REJECT `self:healthVsSelf:gt`.
- [ ] **Step 2:** Run them. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run them. Expected: PASS.
- [ ] **Step 5:** Update `docs/11-predicates.md` (the option row) and `docs/model/predicate.md`. Commit with the message `feat(count): parameters count and target:healthVsSelf (#283)`.

### Task 6: Criteria (#283)

**Files:**
- Modify: `module/data/item/ability.mjs` (`criteria: ArrayField(ObjectField)`; `damage` stays an object, and `multiplier` may now be a CountedValue)
- Modify: `module/content/authored-fields.mjs` (`criteria` in `AUTHORED_ITEM_KEYS`), `test/unit/survival.test.mjs` (`ABILITY_ROUTES`: `criteria` projected by `abilityRecordOf`), `test/unit/field-ledger.test.mjs`
- Modify: `module/rules/count.mjs` (`export function criteriaMet(criteria, {targets, self, board}) → {met: number, which: number[]}`)
- Modify: `module/engine/attack.mjs`:
  - at commit, beside `cooldownFor` at :673, compute `criteriaMet` over the declaration's resolved targets and store it on **every** Process state of the declaration as `state.criteriaMet`;
  - the three `multiplier: block?.multiplier ?? 1` sites (:5671, :7468, :8918) call one new `blockMultiplier(block, state)` that resolves `countedValue(block.multiplier, {use: {criteriaMet}})`.
- Modify: `module/engine/skill-use.mjs` (a Skill with `criteria` computes it once after targeting and passes it the same way)
- Modify: `module/rules/costs.mjs#additionalCostsFor` (`amount` may be a CountedValue, resolved with `{use: {criteriaMet}}`)
- Modify: `module/engine/cooldown.mjs#cooldownFor` (new `cooldown.countBonus: [{ticks, count}]` adds `ticks × countOf(count)`; for `criteria` at commit, the number is known)
- Modify: `module/data/item/ability.mjs` cooldown schema (`countBonus: ArrayField(ObjectField)`), plus the authored keys, survival and ledger for it
- Modify: `lang/en.json` (`FGT.Criteria.Line`: "Criteria met: {met} of {total} ({which})")
- Modify: the attack card rows (one row on the declaration's first card) and the Skill card
- Test: `test/unit/criteria.test.mjs`

A criterion is `{targets: <predicate>, atLeast: n}`, `{targets: <predicate>, exactly: n}`, `{targets: <predicate>, none: true}`, or `{self: <predicate>}` for a caster-only test. `targets` is tested per DU against `rollOptionsFor({attacker: self, defender: du})`, so `target:` options are the DU's. With one DU, `atLeast: n` holds when that DU passes (Arthur's note). A criterion about DUs (`atLeast`, `exactly`, `none`) is **not met over an empty area**: "none of the DUs" needs at least one DU. That is a default reading, flagged for the user. The criterion list is closed in the validator: exactly one of `atLeast | exactly | none | self`.

The parameter count reaches the predicate grammar through options, so that grammar stays the only one. `options.mjs` emits `target:paramsVsSelf:gte:<n>` and `target:paramsVsSelf:belowBy2:<n>` for **every** `n` from 1 to the `parameters` Count, so `…:gte:3` is present whenever at least 3 hold.

- [ ] **Step 1:** Write `criteria.test.mjs`. Build an Arthur-shaped fixture ability, mirroring his six criteria, with `withSubjects` (real projection):
  1. `{targets: ["target:paramsVsSelf:gte:3"], atLeast: 2}`
  2. `{targets: [], exactly: 1}`
  3. `{targets: ["target:alignment:evil"], atLeast: 2}`
  4. `{targets: ["target:healthVsSelf:gt"], atLeast: 2}`
  5. `{targets: ["target:paramsVsSelf:belowBy2:3"], none: true}`
  6. `{targets: ["target:attribute:elemental"], none: true}`

  Assertions:
  - the options: 4 Parameters ≥ self → `gte:1` to `gte:4` present, `gte:5` absent;
  - two Evil DUs that both out-rank him → `met` includes 1 and 3;
  - one DU that is Evil → criteria 2 and 3 met (the one-DU note);
  - zero targets → 0 met, since 5 and 6 are not met vacuously;
  - damage multiplier `{base: 3, per: 0.5, count:{of:"criteria"}}` with 4 met → 5;
  - the cost amount `{base: 30, per: 5, count:{of:"criteria"}}` with 4 met → 50, superseding `npCost`;
  - `countBonus [{ticks:"½◈", count:{of:"criteria"}}]` on a `5◈` base with 4 met at 3 turns/Round → 15 + 6 = 21;
  - `state.criteriaMet` is on every Process of a 2-DU declaration (read back off the saved message flag, through `process.deserialize`);
  - the card row reads `FGT.Criteria.Line` with `met`, `total` and `which`.
- [ ] **Step 2:** Run it. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run it, then the suite. Expected: PASS.
- [ ] **Step 5:** Update the docs:
  - `docs/17-abilities.md` (criteria);
  - `docs/22-damage-pipeline.md` (`blockMultiplier`);
  - `docs/04-time-model.md` (`countBonus`);
  - `docs/model/predicate.md` (`keys: field.criteria`) and `cooldown.md`.

  Commit with the message `feat(count): criteria counted once per declaration, read by damage, cost and cooldown (#283)`.

### Task 7: `RankShift` and every element value read a Count (#284)

**Files:**
- Modify: `module/rules/elements.mjs:1538-1578` (`RankShift`: `steps` and `grades` resolve through `countedValue(el.steps, ctx)` when they are objects; a literal stays a literal; `el.max` caps the steps)
- Modify: `module/rules/elements.mjs#stackScaled` (`el.count` is the canonical `count:` on any element value; done in Task 3 for `perStack`, here for `count:`)
- Test: `test/unit/count-elements.test.mjs`

- [ ] **Step 1:** Write the tests, on the real projection, against a Servant with `resources.aria`:
  - `{key: RankShift, parameter: agi, steps: {count:{of:"resource",key:"aria"}, max: 6}}` with AGI `B` and 0, 3 and 6 Aria → `B`, `A`, `EX`. With 9 Aria → still `EX`, because of the cap.
  - `{key: MovDelta, value: 1, count:{of:"resource",key:"aria"}, each: 3}`. Note that `each` belongs on the element, as `perStack` has it. With 7 Aria → MOV +2.
  - `{key: StatDelta, stat: "agility.max", value: 1, count:{of:"resource",key:"aria"}}` with 4 → +4.
- [ ] **Step 2:** Run them. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run them. Expected: PASS.
- [ ] **Step 5:** Update `docs/10-rule-elements.md` (RankShift steps), and `docs/model/element.md` (RankShift line: Godspeed is runnable, `keys: Element.RankShift, field.count`; Lionheart stays `none (#284)`). Commit with the message `feat(count): RankShift steps and element values from a Count (#284)`.

### Task 8: A mode that ends after a count (#288)

**Files:**
- Modify: `module/data/item/ability.mjs`:
  - `endsAfter: ObjectField` — `{event, when: string[], count: number}`;
  - `tally: NumberField({integer, min 0, initial 0})`.
- Modify: authored keys, survival and ledger, for `endsAfter` (authored) and `tally` (written state: ledger only, with its writer named)
- Modify: `module/rules/modes.mjs` (`export function tallyHandler(item) → handler|null`: an `OnEvent` on `endsAfter.event`, `predicate: endsAfter.when`, `then: [{key: "TallyMode", abilityId}]`. It applies only while `item.system.active`)
- Modify: `module/rules/snapshot.mjs#contributionsOf` (the ability loop appends `tallyHandler(item)`, as `decayHandlers` does for effects)
- Modify: `module/engine/scheduler.mjs` (`ACTIONS.TallyMode`: emit `I.tallyMode(unitId, abilityId)`; at `tally + 1 >= count` also emit `I.setMode(unitId, abilityId, false, "tally")`; `ACTION_KINDS` follows)
- Modify: `module/engine/intents.mjs` (`tallyMode(unitId, abilityId)`, type, `ORDER` before `setMode`)
- Modify: `module/engine/applier.mjs` (case `tallyMode` → `io.tallyMode`; a `tallyLines` row "Chikai no Haori 4/7"; when the mode ends by `tally`, the `FGT.Mode.TallyEnded` line)
- Modify: `module/engine/io.mjs` (`tallyMode(unitId, abilityId)` increments `system.tally`; the mode writer resets `system.tally: 0` when `active` flips to true)
- Modify: `module/apps/hud/present.mjs#slotFor` (an active mode with `endsAfter` shows `tally/count`), plus the sheet context and template (`templates/actor/…` abilities row)
- Modify: `lang/en.json`:
  - `FGT.Mode.Tally`: "{mode} {tally}/{count}";
  - `FGT.Mode.TallyEnded`: "{mode} ends: {count} reached".
- Modify: `tools/lib/content.mjs` (`endsAfter.event` must be a known event name, `count` a positive integer)
- Test: `test/unit/mode-tally.test.mjs`

- [ ] **Step 1:** Write the tests. Use a Saitou-shaped fixture mode: `endsAfter: {event: attackLanded, count: 3}`, plus a Shinpachi-shaped one: `when: ["attack:crit"]`.
  - Activation resets `tally` to 0 (read back off the document).
  - Two `attackLanded` → `tally` 2, with the line "… 2/3".
  - The third ends the mode (`active false`, `endedBy "tally"`), with the line `FGT.Mode.TallyEnded`.
  - A non-crit `attackLanded` does not tally the crit mode (the excluded case).
  - An inactive mode hears nothing.
  - A Count of kind `tally` reads it.
  - Turning the mode off and on again starts at 0.
- [ ] **Step 2:** Run them. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run them, then the suite. Expected: PASS.
- [ ] **Step 5:** Update `docs/24-modes-and-control.md` (ends after a count), `docs/E-event-reference.md` (no new event, but note that `TallyMode` hears any event), `docs/model/ability.md` (`keys: field.endsAfter`; the paid extension stays `none (#288)`). Commit with the message `feat(modes): a mode ends after a tally of events (#288)`.

### Task 9: Branch 1 test content, live presses, PR

**Files:**
- Create: `packs/_source/abilities/test-count-*.yml` (one per press below, `test-` prefix, each with a `description` naming the press)
- Create: `tools/live/load-test-abilities.mjs` (a `fgt-eval` payload: reads the built YAML for the given ids and `createEmbeddedDocuments("Item", …)` on the named actor. It goes through the DataModel, so the authored input takes the real route)

Each file:
- `test-count-stage-times`: Passive. `OnEvent turnEnd` → `ApplyEffect atkUp times: {perStack: {effect: curse}}`, so a staged Curse shows its stage count.
- `test-count-criteria`: NP. A 3x3 area at Range 3, with Arthur's six criteria from Task 6. Damage multiplier `{base:3, per:0.5, count:{of:criteria}}`. Cost `{base:30, per:5}` supersedes `npCost`. Cooldown `5◈` with `countBonus ½◈ × criteria`.
- `test-count-rankshift`: Passive. RankShift AGI by Aria, max 6. MovDelta per 3 Aria.
- `test-count-tally`: Mode. `endsAfter {attackLanded, count: 2}`.
- `test-count-tally-crit`: Mode. `endsAfter {attackLanded, when: [attack:crit], count: 2}`.
- `test-count-bogus`: Skill. Holds `count:{of:"bogus"}`. It is **not** in the packs, because the build would refuse it. It is created live by eval only.
- `test-crit-certain`: an effect file, Crit Up 100 (Crit Chance +100), to stage crits.

**Live presses.** These run on world `fgt2026`, scene *Gilles Audit B*. Player1 owns **Test Jeanne d'Arc**. The enemies are **Test Jeanne d'Arc (Alter)** plus two enemy Servants placed by the GM. Log each press to `<scratchpad>/press-count.md` as `press | status | evidence`, quoting the card text. Every press below is done by **Player1** clicking the bar or the sheet. The GM only sets the board up.

| # | Press | Hits | Expect on screen |
|---|---|---|---|
| L1-1 | Kingprotea: press Huge Scale with 0, 3 and 10 stocks | `perStack` magnitude, `max`, zero pays nothing | Sheet Max Health and NP DmgRes match Task 1's figures. 10 stocks show the 80 cap |
| L1-2 | Kingprotea: Giant Monster with 4 stocks | the `times` path that replaced `stackTimes` | The card lists 4 applications |
| L1-3 | Van Gogh: Imaginary Numbers Arts with Curse Stage 7 | `perStack` on a staged effect | The card reads "Cooldown … → …", a cut of 2◈+⅓◈ |
| L1-4 | Van Gogh: De Sterrennacht on 2 allies with the Skill, 1 without | `countTargets` | Atk Up X0% is 50%: 3 + 2 |
| L1-5 | Semiramis: Familiar Doves with 2 Doved enemies | `countMatching` | The NP clock is cut by 2, and by at most 1◈ |
| L1-6 | Arturia: Excalibur hitting 2 Units | `@unitsHit` stays an expression | The card reads "Excalibur: Cooldown a → a−2" |
| L1-7 | Test Jeanne: `test-count-stage-times`, with a Stage 3 Curse applied by eval, then end the Turn | Q3's stage rule through `times` | The Turn card lists 3 Atk Up applications. Before Task 3 it would have been 1 |
| L1-8 | `test-count-criteria` on **one** Evil DU with higher Health. Before pressing, write down from both sheets which of the six should hold | criteria 2, 3, 4 and the one-DU note | The card's "Criteria met: n of 6 (…)" equals the written list, which includes 2, 3 and 4. Damage ×(3+0.5n), the Master loses 30+5n, cooldown 5◈+n×½◈ |
| L1-9 | Same NP over **two** DUs, one Evil and one Elemental. Write the expected list first | `atLeast 2` fails with only one Evil. `none` fails with the Elemental | 2, 3 and 6 are absent from the list. Both Processes' cards show the same n |
| L1-10 | Same NP over **zero** DUs, placed on empty panels | the empty-area reading | The card reads "Criteria met: 0 of 6". ×3, Master −30, cooldown 5◈ |
| L1-11 | `test-count-rankshift`: the GM sets Aria to 0, 3, 6 and 9 by eval. Player1 opens the sheet each time | `resource` kind, RankShift steps, `max`, `each` | AGI shows B, A, EX, EX. MOV shows +0, +1, +2, +3 |
| L1-12 | Turn on `test-count-tally`, then two successful Normal Attacks | tally, display, end | The bar shows "1/2", then the card reads "ends: 2 reached". The bar shows the mode off |
| L1-13 | Turn on `test-count-tally-crit`. One Attack without Crit Up, then two with `test-crit-certain` applied | the `when` qualifier | The first leaves "0/2". The next two show "1/2", then the mode ends |
| L1-14 | Turn the tally mode off and on again | reset per activation | The bar shows "0/2" |
| L1-15 | The GM creates `test-count-bogus` by eval. Player1 hovers and presses it | refused out loud | The slot is greyed. Its tooltip and the press both read the `unknownCountKind` text, naming "bogus" |

- [ ] **Step 1:** Run `npm run validate:content`. Expected: 0 errors. Then `node tools/fgt-rebuild.mjs`, since the content changed.
- [ ] **Step 2:** Bring the world up (memory `bringing-the-world-up`), and join as Player1 in a tab of its own (memory `two-tab-drive-kit`).
- [ ] **Step 3:** Load the test abilities onto Test Jeanne: `node tools/live/load-test-abilities.mjs "Test Jeanne d'Arc" test-count-…`. Place the enemies as each press needs.
- [ ] **Step 4:** Do L1-1 to L1-15 in order. Read each card on screen and log it. A press that disagrees gets a Surprise (`record-surprise`), a fix and a test, and is pressed again before moving on.
- [ ] **Step 5:** Clean up. Remove the test items and test effects, and restore Aria. Then answer any open end-of-Turn offer (memory `turn-end-dialogs-block-the-boundary`).
- [ ] **Step 6:** Run the full suite, lint, `validate:content` and `check:templates`. Commit with the message `test(count): live-press content for the Count module`. Then **stop and ask the user before pushing**: report the branch, its commits and the press table.

---

# Branch 2: `claude/use-record`

Branched off `claude/count`, after its PR merges, or stacked if the user says so.

### Task 10: The Use record module

**Files:**
- Create: `module/rules/use-record.mjs`
- Create: `test/unit/use-record.test.mjs`

**Interfaces (Produces):**

```js
export const USE_FACTS; // frozen: ["failed","missed","evaded","unitsHit","effectsApplied","debuffsInflicted",
                        //          "summoned","criteriaMet","die","overCooldown","channelStarted","concealmentBroken"]
export function emptyUseRecord({abilityId, unitId});   // {abilityId, unitId, landings: [], facts: {}}
export function noteLanding(record, {defId, polarity, outcome, targetId}); // mutates, returns record
export function noteFact(record, fact, value);         // throws on a fact not in USE_FACTS
export function mergeRecords(records);                 // one declaration's Processes → one record (landings concatenated,
                                                       // booleans OR'd, numbers: commit facts taken from the first)
/** → {failed, missed, evaded, unitsHit, effectsApplied, debuffsInflicted, summoned, criteriaMet, die, overCooldown,
 *     channelStarted, concealmentBroken, applied: Set<defId>} */
export function useFacts(record);
/** → Set: "use:failed", "use:missed", "use:evaded", "use:overCooldown", "use:channelStarted",
 *     "use:concealmentBroken", "use:applied:<defId>", "use:die:<n>" */
export function useOptions(facts);
```

`effectsApplied` counts landings with `outcome === "applied"`. `debuffsInflicted` counts those whose landed `polarity === "debuff"`, the stored value from #315 (`polarityOf`).

Definitions, settled as defaults; the user may change them on review:
- `missed` = the declaration hit no Unit (`unitsHit === 0`) for any reason. That reads Kurohime's *"misses"*.
- `evaded` = at least one DU's reaction was a successful Evade (Tamamo Goth's *"was Evaded"*).

- [ ] **Step 1:** Write the tests:
  - The empty record has every fact falsy.
  - Two applied debuffs, one resisted buff and one applied buff → `effectsApplied` 3 (Q: the resisted one is not "applied"), `debuffsInflicted` 2, and `applied` = {the three ids}.
  - `noteFact(r, "bogus")` throws, naming "bogus".
  - `mergeRecords` of 2 Process records: landings are concatenated, and `evaded` is true if either had it.
  - `useOptions` emits exactly the listed options.
  - The record round-trips through `JSON.stringify` / `JSON.parse` unchanged. The Process state is JSON (`combat-process.mjs#serialize`).
- [ ] **Step 2:** Run them. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run them. Expected: PASS.
- [ ] **Step 5:** Add the `use` subject facets to `module/rules/facets.mjs`: `failed`, `missed`, `evaded`, `overCooldown`, `channelStarted`, `concealmentBroken` (flags), `applied` (an open effect id), and `die` (a number). Add lang prose and hints, and extend `facets.test.mjs` ACCEPT/REJECT. Commit with the message `feat(use): the Use record module (#285)`.

### Task 11: Both use paths fill and store the record

**Files:**
- Modify: `module/engine/landing.mjs` (`LandingContext.useRecord`; `landEntry` and `landEffect` call `noteLanding(ctx.useRecord, {defId, polarity: def.polarity, outcome, targetId})` when present. The direct `landEffect` at `attack.mjs:8812` passes it too)
- Modify: `module/engine/skill-use.mjs#useSkill`:
  - build `emptyUseRecord` before `rollSkillFailure`;
  - note `failed`, `die`, `overCooldown`, `channelStarted`, `concealmentBroken` (from `rollConcealmentBreak`'s return), `summoned` (from `applied.summoned`) and `criteriaMet` (Task 6);
  - pass `useRecord` into `runPhases` → `landEntry`.
- Modify: `module/engine/attack.mjs`:
  - at commit (:620–:692), create the record's commit facts (`overCooldown`, `channelStarted`, `criteriaMet`, `concealmentBroken` from `payAbilityPrice`, and `failed`/`die` from Task 14) on `state.use` of **every** Process of the declaration;
  - each Process's landings write into its own `state.use`, saved with the Process message (`setFlag("fgt","process", serialize(state))`, as every other Process field is);
  - `evaded` is noted when the react rung resolves an Evade.
- Modify: `module/engine/skill-use.mjs#resolveWithoutProcess` (the same record, for window uses without a Process)
- Test: `test/unit/use-record-paths.test.mjs`

- [ ] **Step 1:** Write the tests, world-backed (`withSubjects`, `castSkill`, and `test/helpers/process.mjs` for attacks):
  - A Skill applying two 100% debuffs → its record shows `debuffsInflicted 2`.
  - An Attack Skill over 2 DUs → each Process message's `fgt.process` flag, deserialized, carries its own `use.landings`, and `mergeRecords` of the two gives the sum.
  - After a simulated reload (deserialize the stored flags into fresh state objects and drop the in-memory ones), the merged record is unchanged (Review Focus 3).
  - A use on its Cooldown carries `overCooldown: true`.
  - An Evade sets `evaded` on that Process's record only.
- [ ] **Step 2:** Run them. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run them, then the suite. Expected: PASS.
- [ ] **Step 5:** Update `docs/21-combat-process.md` (`state.use`) and `docs/15-effect-application.md` (the landing notes the record). Commit with the message `feat(use): both use paths record what a use did, stored with the Process (#285)`.

### Task 12: The Cooldown clock starts at commit and settles once

**Files:**
- Modify: `module/engine/cooldown.mjs`:
  - `cooldownFor` stays the **start** (commit time, no outcome);
  - `perUnit` moves out of it into the settle;
  - add `export function settleCooldown(ability, actorId, {unit, facts, started}) → {cooldowns: Array<{actorId, abilityId, ticks}>, delta: number}`.
- Modify: `module/engine/skill-use.mjs:194-199` (start the clock **before** `runPhases`, with the same skips as today: `channelStarted`, `overCooldown`, and a refunding failure. After phases, call `settleCooldown` and write a `set` to the settled ticks when they differ)
- Modify: `module/engine/attack.mjs`:
  - `fireAttackPerformed` (:3777): for the **declaration's** processes only (`!st.isCounter`), `mergeRecords` → `settleCooldown` → one `I.cooldown(..., "set")` when it differs, with the line on the attacker's last card (the existing `applyWithLines` path);
  - `resolveWithoutProcess` settles at its end.
- Modify: `module/data/item/ability.mjs` cooldown schema (`countBonus` from Task 6 now also accepts `count:{of:"use", fact}`)
- Modify: `lang/en.json` (`FGT.Cooldown.Settled`: "{ability}: Cooldown {before} → {after} ({why})")
- Test: `test/unit/cooldown-settle.test.mjs`

What `settleCooldown` does:
- It re-reads `branches` and `conditionalBonus` against `rollOptionsFor({attacker: unit})` ∪ `useOptions(facts)`.
- It adds `countBonus` entries (`criteria`, or `use` facts).
- It applies `perUnit` × `facts.summoned`.
- It returns no clocks when `facts.overCooldown` or `facts.channelStarted` holds, or when `facts.failed` holds with a refunding source (Review Focus 4).

- [ ] **Step 1:** Write the tests. Each one is a sheet's shape, and each has the case it excludes:
  - **Trung-shape:** `1◈ + ½◈ per use:debuffsInflicted`. With 0, 1 and 2 debuffs at 3 turns/Round → 3, 5, 6 (with ½◈ = 2 turns at 3/Round, round up per `resolveTicks`; assert the real figures).
  - **Kurohime-shape:** `branches: [{predicate:["use:missed"], max:"3◈"}, {max:"6◈"}]`. A hit → 18, a miss (0 Units hit) → 9.
  - **Tamamo Goth-shape:** `conditionalBonus [{predicate:["use:evaded"], ticks:"1◈"}]`. Evaded → +3, not evaded → +0.
  - **Sétanta-shape:** `3◈-⅓◈ + ⅓◈ per use:effectsApplied`. A resisted effect does not count.
  - **Nursery-shape:** `perUnit` with 4 summoned → 4 × ⅓◈ = 4, the same figure as Task 1's pin.
  - **Counter inside an area NP** (Review Focus 2): the Counter's Processes do not change the NP's settled clock.
  - **Mana Burst with `overCooldown`:** start and settle write nothing (`arturia-230.test.mjs` stays green).
  - **HGoB channel:** nothing is written at commit. `completeChannel` still starts it as today.
  - Each change emits `FGT.Cooldown.Settled` with `before`, `after` and `why`. No line when nothing changed.
- [ ] **Step 2:** Run them. Expected: FAIL. **Step 3:** Implement. Delete the old after-phases `cooldownIntents` call: the start moves, and nothing is layered on top.
- [ ] **Step 4:** Run them, then the full suite. Every pinned Servant test (`arturia-230`, `gilles-260-rulings`, `nemo`, `semiramis`, `medea`, `nursery`) stays green. If one moves, read why from its diff before touching it.
- [ ] **Step 5:** Update the docs:
  - `docs/04-time-model.md`: start and settle;
  - `docs/17-abilities.md`;
  - `docs/model/cooldown.md`: `byOutcome` → `keys: field.cooldown.countBonus, field.cooldown.branches (use:)`, now run.

  Commit with the message `feat(cooldown): the clock starts at commit and settles from the Use record (#285)`.

### Task 13: `CooldownCutBonus` (#299)

**Files:**
- Modify: `module/rules/authoring/elements.mjs` (`CooldownCutBonus`: fields `kinds` (multi-select `np|skill|spell`), `extra` (number), `on` (`any|natural`))
- Modify: `module/rules/elements.mjs` (executor pushes `out.cooldownCutBonus.push({kinds, extra, on, source})`; `emptyContributions` gains `cooldownCutBonus: []`)
- Modify: `module/engine/scheduler.mjs:2085-2090` (the natural countdown's intent carries `natural: true`)
- Modify: `module/engine/intents.mjs` (`cooldown(unitId, abilityId, ticks, mode, {natural} = {})`)
- Modify: `module/engine/applier.mjs:963-965` (the one door: for `mode === "reduce"` with `ticks > 0` on a clock whose `remaining > 0`, add the sum of matching bonuses. A bonus matches when the ability's class from `rules/costs.mjs#preventionActionsFor`, exported as `useClassesOf`, is in `kinds`, and `on === "any"` or the intent is `natural`)
- Modify: `module/rules/costs.mjs` (export `useClassesOf = preventionActionsFor`, with one name everywhere and no second classifier)
- Test: `test/unit/cooldown-cut-bonus.test.mjs`

- [ ] **Step 1:** Write the tests:
  - **Merlin-shape** `{kinds:[np], extra:1, on:any}`: a natural Turn on an NP at 6 → 4. A `CooldownDelta` cut of 2 → cut 3. A Skill's natural Turn → only 1 (the excluded kind).
  - **Barghest-shape** `{on: natural}`: natural → +1, a `CooldownDelta` cut → +0.
  - Review Focus 5: a cut of 0 → nothing. A clock at 1 cut by 1 with the bonus → 0, not −1. A clock at 0 → no write.
  - A `set` or an `increase` gains nothing.
  - The card line shows the real before → after (`cooldownLine`).
- [ ] **Step 2:** Run them. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run them, then the suite. Expected: PASS.
- [ ] **Step 5:** Update `docs/10-rule-elements.md` (the element row) and `docs/model/cooldown.md` (`reductionBonus` → `keys: Element.CooldownCutBonus`). Commit with the message `feat(cooldown): CooldownCutBonus at the one reduce door (#299)`.

### Task 14: `UseFailure` (#300)

**Files:**
- Modify: `module/rules/authoring/elements.mjs` (`UseFailure`: `of` (string list), `chance` (number), `chanceWhen` (list of `{predicate, chance}`), `then` (select `lockThisTurn|endActions`))
- Modify: `module/rules/elements.mjs` (executor pushes `out.useFailures.push({...el, ownerAbilityId: source.abilityId, source})`)
- Create: `module/rules/use-failure.mjs` (`export function failureFor(ability, unit, options) → {chance, then, source}|null`. The highest chance among the matching `UseFailure`s, where the first `chanceWhen` that passes replaces `chance`. `of: ["self"]` matches only `ownerAbilityId === ability.id`. Classes come from `useClassesOf`, and content ids from `contentId`)
- Modify: `module/engine/skill-use.mjs` (beside `rollSkillFailure` at :170: roll `1d100` against `failureFor`; on failure, note `failed` and `die`, pay budget and costs as Blind's path does, start no clock, run no phases, and post `FGT.UseFailure.Failed` "{name} fails: rolled {roll} vs {chance}% ({source})")
- Modify: `module/engine/attack.mjs` (the same roll at commit, after costs and before any Process opens. On failure no Process is created, and the card says so)
- Modify: `module/data/actor/_shared.mjs#turnStateField` and `module/domain/stamped-record.mjs#TURN_RECORD` (`failedAbilities: ArrayField(String)`, `actionsEnded: Boolean`; the drift test holds the two together)
- Modify: `module/rules/costs.mjs#canUseAbility` (`turnState.failedAbilities` includes the id → refused `failedThisTurn`)
- Modify: `module/rules/budget.mjs#preventedBy` (`unit.turnState?.actionsEnded` → `{prevented: true, by: "actionsEnded"}`, so every action, the bar's Move and Attack included, is refused)
- Modify: `module/rules/actions.mjs` (`acts(unit)` false while `actionsEnded`, so the bar offers nothing: an offer is a reader of the gate)
- Modify: `tools/lib/content.mjs` (`then` is closed. `of` entries are `self`, `np`, `skill`, `spell` or an existing content id)
- Modify: `lang/en.json` (`FGT.UseFailure.Failed`, `FGT.Ability.Refused.failedThisTurn`, `FGT.Budget.Prevented.actionsEnded`)
- Test: `test/unit/use-failure.test.mjs`

- [ ] **Step 1:** Write the tests:
  - **Charlotte-shape** `{of:["self"], chance:30, then:"lockThisTurn"}`, with the die stubbed through the arena's dice queue (`test/helpers/process.mjs`):
    - roll 30 → fails;
    - budget spent and costs charged;
    - no cooldown;
    - pressing it again the same Turn is refused `failedThisTurn`;
    - next Turn it is usable;
    - roll 31 → the Skill runs normally.
  - **Merlin-shape** `{of:["spell","np"], chance:10, chanceWhen:[{predicate:["self:health:belowHalf"], chance:20}], then:"endActions"}`, on a passive:
    - at full Health a roll of 15 succeeds;
    - below half a roll of 15 fails, and then Move, Attack and every Skill are refused `actionsEnded` for the rest of the Turn;
    - a plain Skill (not a Spell) never rolls (the excluded class).
  - The validator rejects `then: "stun"`, naming it.
  - Attack path: a failed NP opens no Process, pays its Master cost, starts no clock, and the card shows the die.
- [ ] **Step 2:** Run them. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run them, then the suite. Expected: PASS.
- [ ] **Step 5:** Update `docs/17-abilities.md`, `docs/19-action-economy.md` (`actionsEnded`) and `docs/model/ability.md` (#300 → `keys: Element.UseFailure`). Commit with the message `feat(use): UseFailure, rolled at the one gate; a failed use pays and starts no clock (#300)`.

### Task 15: Branch 2 test content, live presses, PR

**Files:**
- Create: `packs/_source/abilities/test-use-*.yml`, `packs/_source/effects/test-miss-certain.yml` (Blind at 100%, to stage misses) and `test-evade-certain.yml` (Dodge, to stage Evades), reusing `test-crit-certain` from Task 9

Each file:
- `test-use-trung`: Attack Skill. 2 DUs. Two 100% debuffs. Cooldown `1◈ + ½◈ per use:debuffsInflicted`.
- `test-use-trung-chance`: the same with 50% debuffs, so 0, 1 or 2 are inflicted.
- `test-use-kurohime`: NP. Branches `use:missed` 3◈, else 6◈.
- `test-use-tamamo`: NP. `conditionalBonus use:evaded +1◈`.
- `test-use-setanta`: Skill. 3 effects at 60%, cooldown `3◈-⅓◈ + ⅓◈ per use:effectsApplied`.
- `test-use-merlin-cut`: Passive. `CooldownCutBonus {kinds:[np], extra:1, on:any}`.
- `test-use-barghest-cut`: Passive. `{kinds:[np], extra:1, on:natural}`.
- `test-use-cutter`: Skill. `CooldownDelta` on its own NP, −1 Turn.
- `test-use-charlotte`: Skill. `UseFailure {of:[self], chance:100, then:lockThisTurn}` and one buff. 100% makes the press deterministic.
- `test-use-merlin-fail`: Passive. `UseFailure {of:[spell,np], chance:0, chanceWhen:[{predicate:[self:health:belowHalf], chance:100}], then:endActions}`.
- `test-use-spell` (a Spell), `test-use-plainskill` (a non-Spell Skill), `test-use-np` (an NP, 3x3 area): the targets for the failure and cut presses.

**Live presses.** The world, scene and log are as in Task 9, logged to `<scratchpad>/press-use.md`. Player1 presses everything.

| # | Press | Hits | Expect on screen |
|---|---|---|---|
| L2-1 | `test-use-trung` on 2 DUs | `debuffsInflicted` via the landing door, settle line | The card reads "Cooldown a → b (4 debuffs)". `b` equals Task 12's test figure for 4 debuffs. The bar shows `b` |
| L2-2 | `test-use-trung-chance`, pressed until a 0-debuff use and a 2-debuff use are both seen | the excluded case, settle with no change | A 0-debuff use shows no settle line and keeps the base clock |
| L2-3 | `test-use-kurohime` with `test-miss-certain` on Test Jeanne | `use:missed` branch | The card reads "Cooldown 18 → 9 (missed)" |
| L2-4 | `test-use-kurohime` without it, hitting | the excluded case | The clock stays 18 with no settle line |
| L2-5 | `test-use-tamamo` over 2 DUs, one with `test-evade-certain`. The GM **reloads** (`node tools/fgt-reload.mjs`) while the second DU's reaction prompt is open, then Player1 finishes | `evaded` per Process, merge, the stored record (Q18, Review Focus 3) | After the reload, the card reads "Cooldown … → … +1◈ (evaded)" once, on the last card |
| L2-6 | `test-use-setanta` | `effectsApplied` counts applied, not resisted | The settle names the count, and it matches the applied rows on the same card |
| L2-7 | Area NP `test-use-np` on 2 DUs, one of which **Counters** | Review Focus 2 | The NP's settle reads only the NP's Processes. The Counter's card has its own lines |
| L2-8 | Regression: Arturia Mana Burst on its Cooldown | `overCooldown` | The Master loses 20, and the clock is unchanged with no settle line |
| L2-9 | Regression: Semiramis HGoB channel | `channelStarted` | No clock at declaration. It starts when the channel completes |
| L2-10 | Regression: Nursery Rhyme Trump Soldiers with 4 summoned | `perUnit` through settle | The card reads "Cooldown … 4" (⅓◈ each). This is now a settle line |
| L2-11 | Regression: Nemo Quickfire not Countered | the `afterProcess` cooldown phase still runs | The card reads "Quickfire: Cooldown … −1◈" |
| L2-12 | `test-use-merlin-cut` held. End the Turn with `test-use-np` cooling at 6 | `on: any`, natural | The Turn card reads "Cooldown 6 → 4" |
| L2-13 | Same setup: press `test-use-cutter` | `on: any`, effect cut | "6 → 4" (1 + 1 extra) |
| L2-14 | Same setup: a Skill on cooldown at the Turn's end | the excluded `kinds` | Its clock falls by 1 only |
| L2-15 | Swap to `test-use-barghest-cut`: natural, then cutter | `on: natural` | Natural "6 → 4", cutter "4 → 3" |
| L2-16 | An NP at 1 with the Merlin bonus, at the Turn's end | Review Focus 5 | "1 → 0", never −1, and no line on the next Turn |
| L2-17 | `test-use-charlotte` | failure at 100%, the die on the card, costs paid, no clock, `lockThisTurn` | The card reads "fails: rolled N vs 100%". The budget row is spent, the slot stays off cooldown, and pressing again is refused "failed this Turn" |
| L2-18 | The next Turn: `test-use-charlotte` again | the lock lapses | The slot is usable (it fails again at 100%, and that is expected) |
| L2-19 | `test-use-merlin-fail` held at full Health: press `test-use-spell` | `chanceWhen` not met | The Spell resolves, with no failure line |
| L2-20 | The GM sets Health below half by eval. Player1 presses `test-use-spell` | `chanceWhen`, `endActions` | "fails: rolled N vs 100%". Then the bar offers no Move or Attack, and a press is refused "actionsEnded" |
| L2-21 | Same, with `test-use-plainskill` | the excluded class | No roll, and the Skill resolves |
| L2-22 | Same, with `test-use-np` (attack path) | failure before any Process | No Process card, the Master cost is paid, no clock, and the die is on the card |

- [ ] **Step 1:** Run `npm run validate:content`, then `node tools/fgt-rebuild.mjs`.
- [ ] **Step 2:** Load the test abilities as in Task 9. Place Arturia, Semiramis, Nursery Rhyme and Nemo from the compendium for L2-8 to L2-11 if they are not on the scene.
- [ ] **Step 3:** Do L2-1 to L2-22 in order. Read and log each one, and Surprise → fix → test → press again on any disagreement.
- [ ] **Step 4:** Clean up the test items, effects and Health. Answer any end-of-Turn offer.
- [ ] **Step 5:** Run the full suite, lint, `validate:content` and `check:templates`. Commit with the message `test(use): live-press content for the Use record and Cooldown clock`. Then **stop and ask the user before pushing**: report both branches, the two press tables and the unreviewed Surprise count.

---

## Self-review notes

- **Coverage:**
  - Q1: Task 0.
  - Q2 and Q3: Tasks 2–3.
  - Q4 and Q13: Tasks 5–6.
  - Q5: Task 7.
  - Q6 and Q14: Task 8.
  - Q7, Q9 and Q18: Tasks 10–11.
  - Q8 and Q15: Task 12.
  - Q10: Task 13.
  - Q11, Q16 and Q17: Task 14.
  - Q12: Task 0.
  - Q19: Tasks 2 and 4.
  - Q20: Tasks 9 and 15.
- **Live:** every new key, kind, fact, element value and refusal has a press, with its excluded case pressed too. Staging uses 100% test effects (`test-crit-certain`, `test-miss-certain`, `test-evade-certain`, chance-100 failures), so no Clause is left to a unit test (lesson *every Clause pressed or observed*).
- **Readings chosen by default, flagged for the user:**
  - `missed` = no Unit hit, and `evaded` = a successful Evade by any DU (Task 10).
  - A criterion about DUs is not met over an empty area (Task 6).
