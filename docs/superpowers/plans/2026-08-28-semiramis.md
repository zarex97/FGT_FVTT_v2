# Semiramis — Full Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author Semiramis completely — servant, every ability, her bound summon (Bašmu), and her
platform (the Hanging Gardens of Babylon) — building whatever general-purpose engine mechanisms
her kit needs rather than deferring them, then verify the whole kit live in the `FGT_2026` world.

**Architecture:** Semiramis is the project's own stated acceptance test for "everything
structural" (docs/32). The generic engine (platforms, items, resources, effects, targeting) is
already ~60-70% ready in shape; nothing Semiramis-specific exists in `packs/_source` yet. This
plan builds the missing general engine pieces first (Phase 0-4, each independently testable and
reusable by future content), then authors her content on top (Phase 5-8), then validates end to
end (Phase 9). Every new engine piece is a **rule element** or **declarative schema field**,
matching the codebase's own convention (Ch. 24) — nothing content-specific gets hardcoded into
`module/engine` or `module/rules`.

**Tech Stack:** Foundry VTT v14, the existing rule-element pipeline (`module/rules/elements.mjs`),
YAML content compiled by `tools/build-packs.mjs`, Vitest.

**Spec:** `char_orig_sheets/Copia de Semiramis.md` (the source character sheet — authoritative for
every number). `docs/32-case-semiramis.md` (the project's own prior design pass — informative but
**not confirmed implemented**; treat every YAML shape in it as a proposal to verify against
current code, not a fact). `docs/20-platforms-and-levels.md` §20.3-§20.10 (the platform model and
the HGoB's fuller mechanical spec, including boarding/falling/destruction, and §20.10's platform
combat decisions).

## Global Constraints

- **No schema change without a reason tied to a task below.** Every new field must be consumed by
  something in this plan.
- **Layer boundary** (`tools/check-layers.mjs`): `domain → rules → engine → apps`. Rule elements
  belong in `module/rules/elements.mjs` (layer 2, pure). Anything touching `game`/`Hooks`/documents
  is layer 3 (`module/engine/`).
- **JSDoc on every exported function**, matching house style — eslint enforces it.
- **Content is YAML under `packs/_source/`**, compiled via `npm run build:packs`. Every ability,
  effect, item, and the servant/summon/platform actors themselves are content files, not code.
- **`docs/45-implementation-status.md` is the project's honesty ledger** (Done/Collected/
  Stubbed/Missing). Every new mechanism gets an entry there when it lands, following the existing
  format (see e.g. its "~~X~~ — repaired" entries).
- **Per-mechanism doc chapter also changes**, not just Ch. 45 (established convention this session:
  a bare Ch. 45 log entry without the corresponding Ch. 05/06/... update is incomplete).
- Verification commands, from the repo root: `npm test` · `npm run lint` · `npm run check:layers`
  (via lint) · `npm run check:templates` · `npm run check:manifest` · `npm run validate:content` ·
  `npm run build:packs`.
- **Live verification is required**, not optional, per the user's explicit instruction — GM user,
  world `FGT_2026`, Chrome already running with `--remote-debugging-port=9222`. Test each phase's
  mechanic live as it lands (checkpoints called out below), not only at the very end.

---

## File Structure

**Create (engine, Phase 0-4):**

| Path | Responsibility |
|---|---|
| `module/rules/elements.mjs` (extend) | New executors: `ExemptFromZon`, `PeriodicOverride`, `VulnerabilityAmplifier`, `TargetabilityModifier`, `SustainabilityModifier`, `TerritoryCreationScope`. Extend `RankShift` for the `parameters: [...]` + explicit `statDeltas` form. Extend `ApplicationChance` for `bypassChanceModifiers`. |
| `module/domain/tables.mjs` or `module/domain/dice.mjs` (extend, verify which) | `multiplyDice(formula, formula)` roll helper. |
| `module/rules/predicate.mjs` (extend) | `@count(...)` aggregate. |
| `module/rules/summon-variants.mjs` (new) | Pure: resolve a servant's `summonVariants` block against a roll, producing the override patch. |
| `module/engine/summon.mjs` (extend) | Roll and apply a summon variant as part of `prepareSummon`/`commitSummon`. |
| `module/rules/channel.mjs` (new) | Pure: channel state machine — start, tick, interrupt, restart, complete. |
| `module/engine/channel-hooks.mjs` (new) | Wires `rules/channel.mjs` to the turn scheduler and the "attack declared against self" event. |
| `module/data/actor/simple.mjs` (extend `PlatformData`) | `baseAttack`, `subZones`, `attacks`, `boarding`, `destruction`, `rebuildable`, `ownerEffects` (as item-authored rule elements, not schema — see Task 13). |
| `module/rules/targeting/vocabulary.mjs` / `resolve.mjs` (extend) | `anchor: compound`. |
| `module/engine/attack.mjs`, `module/engine/skill-use.mjs` (extend) | Confirm/complete platform-as-attacker: no facing update, no countering, `{unit: "owner"}` `BaseAttackSource`. |
| `module/engine/vision.mjs` (new) | `unitFirstSeen` event source. |
| `module/apps/canvas/dove-markers.mjs` (new) | `RevealPosition`'s canvas-layer ghost markers. |

**Create (content, Phase 5-8):**

| Path | Responsibility |
|---|---|
| `packs/_source/servants/semiramis.yml` | The servant. |
| `packs/_source/abilities/semiramis-double-summon-caster.yml` | Class skill, the DSC trigger + passives. |
| `packs/_source/abilities/semiramis-presence-concealment.yml` | Class skill (reuses the generic PC mechanism). |
| `packs/_source/abilities/semiramis-item-construction.yml` | Class skill. |
| `packs/_source/items/semiramis-poison.yml` | The transferable item. |
| `packs/_source/effects/queens-poison.yml` | The status Item Construction's item grants. |
| `packs/_source/abilities/semiramis-territory-creation.yml` | Personal skill, dual-variant. |
| `packs/_source/abilities/semiramis-divinity.yml` | Personal skill. |
| `packs/_source/abilities/semiramis-double-summon.yml` | Personal (active) skill. |
| `packs/_source/abilities/semiramis-familiar-doves.yml` | Personal skill, passive + active. |
| `packs/_source/abilities/semiramis-arrogant-kings-poison.yml` | Personal (active) skill. |
| `packs/_source/abilities/semiramis-scales-of-the-sacred-fish.yml` | Spell. |
| `packs/_source/abilities/semiramis-summoning-basmu.yml` | Spell, conditional phases. |
| `packs/_source/summons/basmu.yml` | The bound summon. |
| `packs/_source/abilities/basmu-cursed-poison-dragonfire.yml` | Bašmu's NP. |
| `packs/_source/abilities/semiramis-sikera-usum.yml` | NP. |
| `packs/_source/abilities/semiramis-hanging-gardens-of-babylon.yml` | NP — the channelled activation. |
| `packs/_source/platforms/hanging-gardens.yml` (rewrite) | The platform itself, full spec. |
| `packs/_source/effects/dove.yml`, `dsc-buff.yml`, `construction.yml` | Small unremovable-status effects the abilities above grant. |

**Modify:** `lang/en.json` (every new key), `docs/05`, `docs/06`, `docs/09`, `docs/15`, `docs/20`,
`docs/24`, `docs/32`, `docs/45`, `docs/D-servant-data-sheets.md`.

---

## Phase 0 — Independent engine primitives

Each task here is small, testable in isolation, and has no dependency on any other task in this
phase. Do them in any order; all must land before Phase 5 (content) needs them.

### Task 1: `multiplyDice` roll helper

HGoB Construction source 2: *"roll 2 six-sided dice. HGoB Construction is increased by X, where
X = the number of both six-sided die multiplied together"* — i.e. `1d6 × 1d6`, range 1-36.
Standard dice notation cannot express a product.

**Files:**
- Read first: wherever this codebase's dice formulas are evaluated today — `grep -rn "new Roll(" module/engine` and `module/domain/tables.mjs` for any existing custom-formula registration pattern (e.g. how `healthAt`/`resolveTicks`-style helpers are exposed to content). Match that pattern; do not invent a second one.
- Create/modify accordingly (likely `module/domain/dice.mjs` if no such file exists yet, else extend the existing roll-formula module).
- Test: `test/unit/dice.test.mjs` (or the existing dice test file, once located).

**Interfaces:**
- Produces: a function callable from `engine/summon.mjs`'s roll pipeline (the same one that already rolls setup lines, `rules/setup-rolls.mjs`) that resolves to a single integer, and is inspectable in the setup-plan's `formula` field for GM re-roll display (§37.6 requires every rolled line shown before commit).

- [ ] Grep for the existing roll-formula pattern; read it completely.
- [ ] Write `multiplyDice(diceA, diceB)` returning `{ total, rolls }` where `total = rollA.total * rollB.total`, following that pattern's shape (async if Foundry's `Roll` API is async there, matching `rollLine` in `engine/summon.mjs`).
- [ ] Unit test: mock/stub the two component rolls (or use the project's existing dice-mocking convention — check `test/unit/roll-table.test.mjs` for how other tests avoid real randomness) and assert the product, not the sum.
- [ ] `npm test -- dice` (or whatever the located test file is) passes.
- [ ] Commit.

### Task 2: `@count(...)` aggregate in the expression/predicate language

Familiar: Doves' active reduces Semiramis's NP cooldown by `X = number of enemy Units on the board
with the 'Dove' effect`, capped at one Round's worth of ticks.

**Files:**
- Modify: `module/rules/predicate.mjs` (read it completely first — this plan does not know its
  current grammar in enough detail to specify the exact AST node; that is this task's first step).
- Test: `test/unit/predicate.test.mjs`.

**Interfaces:**
- Produces: an expression form usable inside a `cooldown` phase's `delta` (see Task 24, Familiar:
  Doves) that evaluates to an integer given a board snapshot and a predicate over units — e.g.
  `@count(enemies where effect:dove)` or whatever syntax `predicate.mjs`'s existing grammar
  naturally extends to (do not force the docs/32 sketch's exact spelling if it does not fit the
  real grammar).

- [ ] Read `module/rules/predicate.mjs` in full.
- [ ] Add the aggregate, following the file's existing patterns for how a predicate/expression
      receives the board and the acting unit.
- [ ] Write failing tests for: zero matches, several matches, and the cap being applied by the
      *caller* (this aggregate should return a raw count; capping is the cooldown phase's job,
      per docs/32's own note "max Cooldown reduction=1◈ Turns" — do not bake the cap into the
      aggregate itself, or it becomes unusable for anything else that needs a raw count).
- [ ] Implement, make tests pass.
- [ ] Commit.

### Task 3: `bypassChanceModifiers` on `ApplicationChance`

Queen's Poison's third clause: *"a 50% chance of inflicting an additional Stage of Poison (this
50% extra chance is not affected by debuff chance increasing/reducing effects, it is a flat 50%
chance)."* `module/rules/items.mjs:10`'s own comment (per the survey) already names this as a
known future need against exactly this item — confirm that comment and read it before starting.

**Files:**
- Modify: `module/rules/elements.mjs` — the `ApplicationChance` executor (~line 805, confirmed
  present) gains a `bypassChanceModifiers` boolean passthrough field.
- Modify: wherever `applicationChances` entries are actually consumed to roll a chance — find it
  via `grep -rn "applicationChances" module/rules module/engine` — that consumer must skip
  `ApplicationChance`-derived and `Aura`-derived modifiers when the *triggering* apply call is
  flagged `bypassChanceModifiers: true`.
- Also modify: `module/engine/effect-applier.mjs`'s `applyEffect` (or wherever an `ApplyEffect`
  action's `chance` is finally rolled) to accept and honour a `bypassChanceModifiers` flag on the
  action itself — this is what Queen's Poison's `OnEvent → ApplyEffect` action needs
  (`{ key: ApplyEffect, ..., chance: 50, bypassChanceModifiers: true }`), not what the
  `ApplicationChance` element needs; the element extension above is a **different, second** use
  (an aura/passive that itself should never be diluted by other chance modifiers — check whether
  Queen's Poison actually needs both or only the `ApplyEffect`-level one; re-read the source
  clause: it is about the ONE roll for the extra Poison stage, so this is most likely
  `ApplyEffect`-level only. Verify against the source text before touching `ApplicationChance`'s
  executor at all — do not add unused surface.)
- Test: `test/unit/effect-flow.test.mjs` or `test/unit/elements.test.mjs` (find existing chance-
  roll tests first).

**Interfaces:**
- Produces: `{ key: "ApplyEffect", ..., chance: N, bypassChanceModifiers: true }` as a legal action
  shape inside an `OnEvent` handler's `then:` list.

- [ ] Read `module/rules/items.mjs` around its Semiramis-Poison comment in full.
- [ ] Grep and read every current consumer of an `ApplyEffect` action's `chance` field.
- [ ] Add the flag, write a failing test (an effect with -50% incoming chance modifiers still
      applies at the flat 50% when `bypassChanceModifiers: true`, and correctly at ~0% without it).
- [ ] Implement.
- [ ] Confirm Terror and Disorder (the two other effects docs/32 names as needing this) are not
      already broken by the change — `grep -rln "terror\|disorder" packs/_source/effects` and
      check whether either already assumes a flat chance that this task's default-off flag would
      now regress.
- [ ] Commit.

### Task 4: ~~`ExemptFromZon` rule element~~ — DROPPED, see below

**Re-scoped during execution.** `system.zonExempt` already exists as a real, stored,
already-consumed field: `module/data/actor/servant.mjs:57` declares it, and
`module/rules/zon.mjs:110` already reads `if (servant.zonExempt) return none;` with a comment
naming Semiramis directly. No rule element is needed — Task 32 (the platform) writes
`system.zonExempt = true` on the owner at activation and `false` at destruction, directly,
paired in the same lifecycle code so there is no separate "remember to revert" step.

<details><summary>Original task text, superseded</summary>

### Task 4 (original): `ExemptFromZon` rule element

HGoB ownerEffect: *"ZON does not apply to her"* while aboard.

**Files:**
- Modify: `module/rules/elements.mjs` (new executor, alongside the existing zon-adjacent
  executors — search `grep -n "Zon" module/rules/elements.mjs` for `ZonBonus` at ~line 626 as the
  sibling to place it near).
- Modify: wherever ZON exemption is currently checked — `module/rules/zon.mjs` already has at
  least one hardcoded exemption path (Semiramis aboard HGoB and her activation sequence are both
  named directly in `docs/16-relationships.md §16.9`'s "Consequences of being outside ZON" section
  and in `zon.mjs` per the earlier codebase survey in this conversation — re-read
  `module/rules/zon.mjs` for the current exemption check shape, e.g. `zonExempt` on the snapshot).
- Test: `test/unit/zon.test.mjs` (already references Semiramis in comments per the survey — read
  those comments; they may already anticipate this exact element).

**Interfaces:**
- Produces: `out.zonExempt = true` (or whatever boolean bucket `collectContributions`'s output
  object already reserves — check `snapshot.mjs`'s `zonExempt: Boolean(sys.zonExempt)` line found
  earlier in this session; this element should feed that same field via contributions rather than
  requiring a second reader).

- [ ] Read `module/rules/zon.mjs` completely, and the Semiramis-related comments in
      `test/unit/zon.test.mjs`.
- [ ] Add the `ExemptFromZon` executor: `out.suppressions.push({ scope: "zon", source })` (matching
      the existing `suppressions` bucket shape used by `ForceTarget`/`Decoy`/`WeakPoint` above it)
      — or write directly to a dedicated exemption bucket if `zon.mjs`'s consumer expects one;
      resolve this from what you read, not from this guess.
- [ ] Wire the consumer (`zon.mjs` or `snapshot.mjs`) to honour it.
- [ ] Failing test: a unit outside ZON with this element takes no ZON penalty; without it, does.
- [ ] Commit.

### Task 5: `PeriodicOverride` rule element

Sikera Ušum clause c: *"Units inflicted with Poison while within this NP area receive Poison
damage at the end of its Turn and at the end of any Turn it Acts, in addition to at the end of the
Round."* Poison's ordinary trigger is round-end only; inside this NP's zone it gains two more
triggers.

**Files:**
- Modify: `module/rules/elements.mjs` (new executor).
- Modify: `module/engine/scheduler.mjs`'s `tickPeriodics` (the function whose `amplify` helper was
  extracted in the prior sheet-redesign plan, per `test/unit/scheduler-periodic.test.mjs` — read
  both before touching this) — it must consult zone-scoped periodic-trigger overrides for a unit
  standing in the relevant zone, adding `unitTurnEnd`/`actedTurnEnd` triggers for the named effect
  id while true.
- Test: `test/unit/scheduler-periodic.test.mjs`.

**Interfaces:**
- Consumes: the zone-membership check the bounded-fields system already has
  (`module/rules/bounded-fields.mjs`, referenced heavily by Ch. 43 and Sikera Ušum's own zone
  phase — read it before implementing, since Sikera Ušum (Task 30) is itself a bounded field and
  this element rides inside its `rules:` list, gated by the same zone membership the field already
  computes).
- Produces: additional entries in whatever trigger-list `tickPeriodics` reads per periodic
  instance.

- [ ] Read `module/rules/bounded-fields.mjs` and `module/engine/scheduler.mjs`'s `tickPeriodics`
      in full.
- [ ] Add the executor and its trigger-list extension.
- [ ] Failing test: a Poison instance on a unit standing in a zone carrying this rule ticks at
      that unit's own turn-end and any acted-turn-end, in addition to round-end; outside the zone,
      only round-end.
- [ ] Commit.

### Task 6: `VulnerabilityAmplifier` rule element

Sikera Ušum clause e: units weak to Poison take double Poison damage inside the zone.

**Files:**
- Modify: `module/rules/elements.mjs` (new executor).
- Modify: the Poison damage computation in `module/engine/scheduler.mjs` (the same
  `periodicDamageFor` extracted for the sheet redesign) to apply a zone-sourced multiplier when
  `unit:weakTo:poison` (an existing or new predicate — check whether "weak to X" is already an
  existing roll-option/predicate source before adding one).

**Interfaces:**
- Produces: a multiplicative factor `periodicDamageFor` applies after its existing amplification
  (stacking with, not replacing, e.g. Deadly Poison's own doubling).

- [ ] Grep for any existing "weak to" / vulnerability predicate; read it if found, else add
      `unit:weakTo:<effectId>` as a roll-option source reading `sys.vulnerabilities` (or whatever
      the closest existing analogous field is — `sys.immunities` exists per earlier findings;
      check for a sibling `vulnerabilities` set, or whether this needs adding to `unitCommon()`).
- [ ] Add the executor and the multiplier application point.
- [ ] Failing test, then implement.
- [ ] Commit.

### Task 7: `TargetabilityModifier` rule element

Bašmu's protection: *"Enemy Units cannot Attack Semiramis or her allied Units if a Bašmu is next
to them."* An aura that changes who can be legally **targeted**, not a stat or a chance.

**Files:**
- Modify: `module/rules/elements.mjs` (new executor; note the doc comment above `Compulsion`
  at ~line 779-787 in the current file already has an orphaned JSDoc block for "being forced to
  act against a particular unit" sitting above the WRONG export — read that area carefully, there
  may be a stale/misplaced comment to clean up while you are there, but do not let that become a
  second task; fix it inline if it is a one-line move).
- Modify: `module/rules/targeting/resolve.mjs` (the actual target-legality gate) to consult a new
  `untargetable` aura-sourced set, the same way it already consults `bypassesMasterProtection`
  (found on the snapshot per this session's earlier exploration of `snapshot.mjs`).
- Test: `test/unit/targeting-boundary.test.mjs` or wherever targeting legality is tested (grep for
  `bypassesMasterProtection` in `test/unit` to find it).

**Interfaces:**
- Produces: an aura entry (reuse the existing `Aura` element's radius/relations shape — this is a
  targeting-legality aura, not a stat aura, so it likely needs its own small bucket parallel to
  `out.auras`, e.g. `out.targetingAuras`) that `resolve.mjs` expands the same way
  `rules/auras.mjs` expands stat auras (read `rules/auras.mjs`'s expansion pass before deciding
  whether to reuse it or add a sibling pass).

- [ ] Read `module/rules/targeting/resolve.mjs` and `module/rules/auras.mjs` in full.
- [ ] Add the executor, the aura expansion, and the `resolve.mjs` gate.
- [ ] Failing test: an enemy cannot legally target a protected unit while the protector aura is in
      range; can once the protector is removed/out of range.
- [ ] Commit.

### Task 8: Extend `RankShift` for the `parameters: [...]` + explicit `statDeltas` form

HGoB's owner rank-up needs FIVE parameters shifted at once with EXPLICIT, non-re-derived stat
consequences (Ch. 05 §5.6's own "DECISION: Rank-shift effects declare their stat consequences
explicitly rather than re-running derivation" — re-running would re-roll Health's dice). The
current executor (`module/rules/elements.mjs:634-652`, read this session) only handles a single
`el.parameter` or an ability-rank shift via `el.ability`. Confirmed via this session's own
investigation of Bug #1 (the granted-steps fix) — this is the SAME `RankShift` executor already
touched this session; re-read `module/rules/snapshot.mjs`'s `applyGrantedSteps` /
`annotateRegionBonus` (both added this session) before starting, since this task's output must be
consistent with how those two now apply rank shifts to a unit snapshot.

**Files:**
- Modify: `module/rules/elements.mjs:634-652` (the `RankShift` executor).
- Test: `test/unit/elements.test.mjs`.

**Interfaces:**
- Consumes: an element shape
  ```yaml
  - key: RankShift
    parameters: [str, end, agi, mag, luc]
    steps: 1
    statDeltas:
      baseAttackStr: 25
      health: { max: 500, current: 500 }
      mov: 1
      agility: { max: 2, current: 2 }
      baseAttackMag: 50
      luck: { max: 4, current: 4 }
  ```
- Produces: for EACH name in `parameters`, one `out.statDeltas.push({ stat: "parameters.<p>",
  rankShift: steps, target: null, source })` entry (same shape the single-parameter form already
  produces, so `derived.mjs`'s existing rank-shift pass — Ch. 05 §5.7, `applyStatDeltas` — needs
  no changes); PLUS, for each key in `statDeltas`, an ordinary numeric `out.statDeltas.push(...)`
  entry using the existing numeric-delta shape (`{ stat, value, alsoCurrent }` for the `{max,
  current}` pairs — reuse whatever `MOV`/health-delta elements already produce for that shape,
  found earlier in this file around the `Max HpUp`-style elements).

- [ ] Write the failing test first: an element with `parameters: [str, mag]`, `steps: 1`, and a
      `statDeltas` map produces both the two rank-shift stat deltas AND the named numeric ones,
      with `baseAttackStr`/`baseAttackMag` correctly mapped to `baseAttack.str`/`baseAttack.mag`
      paths (confirm the exact path spelling against `snapshot.mjs`'s `baseAttack: {str, mag}`
      shape).
- [ ] Implement, keeping the existing single-`el.parameter` and `el.ability` branches intact —
      this is a third branch, not a replacement.
- [ ] Run the full existing `elements.test.mjs` suite to confirm no regression to Penthesilea's
      Goddess of War (the existing `el.ability` consumer) or any content using the single-
      parameter form.
- [ ] Commit.

### Task 9: ~~`SustainabilityModifier` rule element~~ — DROPPED, see below

**Re-scoped during execution.** This session's own Bug #3 fix already built `I.setResource`
(`engine/intents.mjs`), an absolute write that resolves `sustainabilityTurns` correctly regardless
of the stored field's prior state. HGoB's "+2◈ while aboard" is implemented directly in Task 32's
activation/destruction code: resolve `resolveTicks(parseTick("2◈"), {turnsPerRound})` turns, add
to (activation) or subtract from (destruction) the current resolved remaining via `I.setResource`
— no new rule-element primitive needed.

<details><summary>Original task text, superseded</summary>

### Task 9 (original): `SustainabilityModifier` rule element

HGoB ownerEffect: *"her Sustainability is increased by 2◈ Turns"* while aboard — a flat modifier
to the AUTHORED maximum (`system.sustainability`, the ◈ expression), conditional on a state
(aboard the platform), distinct from `SustainabilityGain` (event-triggered, already exists per the
survey, e.g. "+1◈ per kill") and distinct from the per-turn drain this session's own Bug #3 fix
touched (`checkRemovals` in `scheduler.mjs`, `I.setResource`).

**Files:**
- Read first: this session's own Bug #3 fix (`module/engine/scheduler.mjs`'s `checkRemovals`,
  `module/rules/snapshot.mjs`'s `sustainabilityTurns`) — the new element must produce a
  contribution that `sustainabilityTurns`'s resolution path can fold in without reintroducing the
  null-coercion class of bug that fix closed.
- Modify: `module/rules/elements.mjs` (new executor).
- Modify: `module/rules/snapshot.mjs`'s `sustainabilityTurns` (or wherever the resolved max is
  computed) to add any active `SustainabilityModifier` deltas to the resolved ◈ expression's
  turn count before it becomes `u.sustainability`.
- Test: `test/unit/snapshot.test.mjs` (the Sustainability-adjacent describe block this session
  added is the right home for these).

**Interfaces:**
- Produces: `out.statDeltas.push({ stat: "sustainability", value: deltaInTurns, source })` — a
  distinct stat name from `sustainabilityRemaining`, so it never collides with the countdown
  mechanism; the resolved-max computation adds it, the countdown subtracts from the result exactly
  as it already does.

- [ ] Read the three files above completely.
- [ ] Failing test: a unit with an active `SustainabilityModifier` of `+2◈` resolves a max 2 turns
      higher than one without, and the countdown still correctly starts from and clamps at that
      higher number.
- [ ] Implement.
- [ ] Commit.

### Task 10: ~~`TerritoryCreationScope` rule element~~ — likely DROPPED, verify at Task 21

**Re-scoped during execution.** Likely achievable as ordinary content: two Territory-Creation-
flavored damage-modifier contributions on the SAME ability, each gated by its own zone predicate
(`self:inZone:hgob` for EX, `self:inZone:ownHomeBase` + `not self:inZone:hgob` for C), reusing
whatever mechanism Medea's existing `territory-creation.yml` already uses for the single-scope
case — no new rule element, if the predicate system already supports zone membership checks
generically (verify this at Task 21; only build a new element if it genuinely does not).

<details><summary>Original task text, superseded pending Task 21's verification</summary>

### Task 10 (original): `TerritoryCreationScope` rule element

Territory Creation's DSC-having variant: *"the effects of Territory Creation are reduced to Rank C
for her Faction's Home Base. Territory Creation — Rank: EX is only applied to the whole area of
Semiramis' Hanging Gardens of Babylon."* One ability, two simultaneously-active ranks scoped to
two different zones.

**Files:**
- Read first: whatever currently resolves Territory Creation's home-base damage bonus/reduction —
  `grep -rn "[Tt]erritory[Cc]reation" module/rules module/engine` (Medea already has one per the
  survey — `packs/_source/abilities/medea-territory-creation.yml` — read it as the working
  single-scope pattern before adding a second scope).
- Modify: `module/rules/elements.mjs` (new executor).
- Modify: whatever consumer reads Territory Creation's contribution (likely inside the damage
  pipeline, `module/rules/damage/pipeline.mjs`, or a home-base-modifier pass in
  `module/rules/environment.mjs` — the "not stack, highest rank wins" note in the source and in
  docs/32 means this needs to interoperate with however Medea's single-scope version already
  compares ranks across sources).
- Test: wherever Medea's Territory Creation is tested (`grep -rl "territoryCreation" test/unit`).

**Interfaces:**
- Produces: two independent Territory Creation contributions from ONE ability instance, each
  tagged with its own zone scope (`home base` vs `platform: hanging-gardens-of-babylon`) and rank,
  so the "does not stack, highest wins" comparison in the consumer runs per-zone rather than
  globally conflating the two.

- [ ] Read the Territory Creation consumer and Medea's existing ability file completely.
- [ ] Add the executor and extend the consumer for per-zone rank comparison.
- [ ] Failing test: Semiramis with DSC deals the EX bonus while on her HGoB and only the C bonus
      while in her ground home base; without DSC, Territory Creation is absent until the `Double
      Summon` active grants a temporary Rank C copy (this half depends on Task 23 existing —
      write this specific sub-case as a TODO-marked pending test if Task 23 is not done yet, and
      complete it when Task 23 lands. Do not skip writing the test entirely.)
- [ ] Commit.

**Phase 0 checkpoint:** `npm test && npm run lint` clean. No live-world test yet — nothing to
summon.

---

## Phase 1 — Summon-time variants

### Task 11: `summonVariants` mechanism

Every one of Semiramis's abilities branches on whether she rolled the coin heads (Double Summon:
Caster) at summon. Model as docs/32 §32.1 proposes: a **summon-time branch, resolved once and
stored**, not a runtime predicate.

**Files:**
- Create: `module/rules/summon-variants.mjs` — pure function `resolveSummonVariant(sheet, roll)`
  taking the servant's `system.summonVariants` array (parsed from content) and a resolved roll
  result, returning the chosen variant's `overrides` patch and its `id`.
- Modify: `module/rules/setup-rolls.mjs` (read `servantSetupPlan`/`resolveSetupPlan` completely
  first — this session's Bug #1 investigation already read large parts of this file) to add the
  variant roll as one more plan line, alongside the existing STR/AGI/LUC-style rolls, so
  `summon-dialog.hbs` shows it and the GM can re-roll it per-line like everything else (§37.6).
- Modify: `module/engine/summon.mjs`'s `commitSummon`/`sheetPatch` to write the chosen variant's
  `id` to a new `system.summonVariant` field and apply its `overrides` into the committed sheet
  patch (range, normalAttack, sustainability — the exact three docs/32 names, but verify against
  what Semiramis's content actually needs once Task 18 is written; do not add override keys this
  plan does not use).
- Modify: `module/data/actor/servant.mjs` — add `summonVariant: new fields.StringField({required:
  false, nullable: true, initial: null})` (the resolved id, for downstream predicates) and leave
  `summonVariants` (the plural, authored list) as a content-only concept resolved at summon time,
  NOT a stored schema field — it does not need to persist past commit.
- Modify: `module/rules/options.mjs` (wherever roll-options are built from a unit — this session
  read `rollOptionsFor` in `snapshot.mjs`'s `contributionsOf`) to add `variant:<id>` as a roll
  option sourced from `system.summonVariant`, so content can predicate on `self:variant:dsc`.
- Modify: `templates/apps/summon-dialog.hbs` to show the variant roll's result like every other
  line.
- Test: `test/unit/setup-rolls.test.mjs`, `test/unit/summon-grants.test.mjs`.

**Interfaces:**
- Consumes: content shape
  ```yaml
  summonVariants:
    - id: dsc
      roll: { formula: "1d2", on: [1] }   # verify against this codebase's actual coin-flip
                                            # convention — grep existing content for "coinFlip"
                                            # or a d2-based flip before inventing formula syntax
      grants: [semiramis-double-summon-caster]
      overrides:
        range: { panels: 3, targets: 1 }
        normalAttack: { mode: byRange, bands: [...] }
        sustainability: { base: "4◈" }
    - id: noDsc
      default: true
      overrides:
        range: { panels: 2, targets: 1 }
        normalAttack: { mode: fixed, component: str }
        sustainability: { base: "2◈" }
  ```
- Produces: `system.summonVariant: "dsc" | "noDsc"` on the committed actor; `self:variant:dsc` /
  `self:variant:noDsc` as roll options; the ability named in `grants` present on the actor from
  creation (verify whether the existing `applyGrants`/`sheetPatch` pipeline in `engine/summon.mjs`
  can attach a compendium ability at commit time, or whether this needs a new step — read that
  file's full commit path before assuming).

- [x] Grep this codebase for its actual coin-flip convention — confirmed `new Roll("1d2")`,
      "heads = roll 1", used identically by `masterSetupPlan`'s `coinFlip` mode and the sign-coin
      mechanism. No generic multi-branch `summonVariants` (plural) was built — simplified to a
      single boolean `summonVariant` (singular, `{heads, tails}`), which is all Semiramis needs
      and matches YAGNI; `grants` (conditional item attachment) was designed then dropped — her
      DSC Skill is authored unconditionally with variant-gated passives instead, which is also
      what her `Double Summon` Active's temporary grant needs anyway.
- [x] `rules/summon-variant.mjs`: `resolveSummonVariant(spec, rollTotal)`, 4 tests.
- [x] Wired into `setup-rolls.mjs` (`servantSetupPlan` prepends the line; `resolveSetupPlan`
      handles a string-mapped value) and `engine/summon.mjs`'s `sheetPatch` (writes
      `system.variant` and merges the branch's `overrides`); 3 + 3 tests in
      `summon-grants.test.mjs`/`setup-rolls.test.mjs`.
- [x] Schema fields `summonVariant`/`variant` on `ServantData`; roll option `self:variant:<id>`
      wired into both `snapshotUnit` and `contributionsOf`'s narrower self-object in
      `rules/snapshot.mjs`, plus the `EMITTABLE` allowlist in `options.mjs`; 2 tests in
      `options.test.mjs`.
- [x] Fixed a latent display bug in `apps/summon-dialog.mjs`'s `describe()`: a string-valued
      `applied` (a variant id) would have rendered "null + NaN" through the numeric-arithmetic
      formatting path.
- [x] `npm test && npm run lint` clean — 1933 tests, zero lint errors.
- [ ] Commit (deferred — committing once the servant that actually exercises this exists,
      Task 18, so the commit is a coherent, testable unit).

**Phase 1 checkpoint:** No live test yet — needs Task 18 (the actual servant file) to exercise.

---

## Phase 2 — Channelled ability kind

### Task 12: The channel kind

HGoB's activation: 3◈ turns unable to act, interrupted by being ATTACKED (not by taking damage —
even a fully-evaded attack interrupts), restart-not-cancel on interruption, cost paid only on
success, exempt from the ZON requirement a Noble Phantasm would otherwise need.

**Files:**
- Create: `module/rules/channel.mjs` — pure. `startChannel(unit, spec, tick)`,
  `onAttackDeclaredAgainst(unit, channelState)` → interrupted or not, `tickChannel(channelState,
  tick)` → still-channelling / complete, `channelRequirementsMet(unit, board, spec)`.
- Create: `module/engine/channel-hooks.mjs` — wires the pure functions to: the turn scheduler
  (`scheduler.mjs`'s `beginTurn`/`endTurn`, read both completely first) for the per-turn tick and
  completion; and the attack-declaration point in `engine/attack.mjs` (read where an attack is
  first declared against a defender, BEFORE the reaction ladder, since "attacked" not "damaged" is
  the interrupt condition — must fire even on a subsequently-evaded attack).
- Modify: `module/data/item/ability.mjs` — a `channel: { isChannelled, duration, requirements,
  exemptions, interruptedBy, onInterrupt, costTiming }` schema block, mirroring how
  `cooldown`/`targeting` are already modeled on the ability DataModel (read that file completely
  first).
- Modify: wherever "can this unit Act" is gated (`module/rules/legality.mjs` per this session's
  earlier grep of `module/rules/legality.mjs` and `module/rules/control.mjs`) so a
  channelling unit cannot take any other action.
- Modify: the turn HUD (`module/apps/hud/turn-hud.mjs`) to show the channel badge to ALL players
  (docs/32 §32.3: *"not hidden information"*) — a visible countdown/label on the channelling
  unit's HUD entry.
- Test: `test/unit/channel.test.mjs` (new).

**Interfaces:**
- Produces: `ChannelState = { abilityId, startedTick, requiredTicks, interruptedAt: number|null }`
  stored on the actor (a schema field, e.g. `system.channelState`, nullable) so it survives
  reloads and is visible to every client via the ordinary document-sync path (no bespoke socket
  needed — read `docs/26` before assuming otherwise, since this session already worked extensively
  in that chapter for the faction-ownership fix and knows its GM-proxy conventions).

- [ ] Read `module/data/item/ability.mjs`, `module/rules/legality.mjs`, `module/rules/control.mjs`,
      `module/engine/scheduler.mjs` (`beginTurn`/`endTurn`), and the attack-declaration entry point
      in `module/engine/attack.mjs` completely.
- [ ] Write `rules/channel.mjs`'s pure functions with failing tests: start → not complete before
      duration; tick to duration → complete; attacked mid-channel → interrupted, and a SECOND
      start resets fully (no partial credit); `costTiming: onSuccess` means the pure completion
      result carries a flag the caller uses to decide whether to charge the NP's Master-Health
      cost.
- [ ] Implement `rules/channel.mjs`, tests pass.
- [ ] Add the ability schema block.
- [ ] Wire `channel-hooks.mjs` to the scheduler and the attack-declaration point; a live-adjacent
      integration test using the project's existing scheduler test fixtures (`test/unit/
      scheduler.test.mjs`'s `board`/`sctx` helpers).
- [ ] Wire the legality gate and the HUD badge.
- [ ] `npm test && npm run lint` clean.
- [ ] Commit.

**Phase 2 checkpoint:** No live test yet — needs Task 31/32 (the actual HGoB activation ability
and platform) to exercise for real; if time allows, hand-build a throwaway test ability in a
scratch world scene to smoke-test the channel HUD badge and interrupt behavior before Phase 8,
since this is the single riskiest new mechanism in the whole plan and cheapest to catch problems
in now rather than after the platform is also built on top of it.

---

## Phase 3 — Platform extensions

### Task 13: `PlatformData` schema additions

Current schema (`module/data/actor/simple.mjs`, read in full this session) has `footprint`,
`capacity`, `ownerId`, `level`/`levelId`, `upkeep`, `crossLevel` — and **no** `baseAttack`,
`normalAttack`, `subZones`, `attacks`, `boarding`, `destruction`, or `rebuildable`. It does have
`unitCommon()` (health/agility/luck/mov/range/attributes) but not `combatantCommon()` (no
`parameters`, no `baseAttack`).

**Files:**
- Modify: `module/data/actor/simple.mjs`'s `PlatformData.defineSchema()`.
- Test: `test/unit/actor-fields.test.mjs` (the schema-shape test file found this session for the
  `defaultImage` field's sibling additions).

**Interfaces:**
- Produces: new fields —
  ```js
  baseAttack: new fields.SchemaField({
    str: new fields.NumberField({ required: true, integer: true, initial: 0 }),
    mag: new fields.NumberField({ required: true, integer: true, initial: 0 }),
  }),
  subZones: new fields.ArrayField(new fields.SchemaField({
    id: new fields.StringField({ blank: false }),
    shape: new fields.ObjectField(),   // matches how targeting shapes are already stored loosely
    tags: new fields.SetField(new fields.StringField({ blank: false })),
  })),
  attacks: new fields.ArrayField(new fields.ObjectField()),   // full spec lives in content, not schema — see Task 14
  boarding: new fields.SchemaField({
    formula: new fields.StringField({ initial: "1d12" }),
    successOn: new fields.NumberField({ integer: true, initial: 12 }),
    modifiers: new fields.ArrayField(new fields.ObjectField()),
  }, { required: false, nullable: true, initial: null }),
  destruction: new fields.SchemaField({
    triggers: new fields.SetField(new fields.StringField({ blank: false })),
    passengerSave: new fields.ObjectField(),
    onSaveFail: new fields.ObjectField(),
    scatter: new fields.StringField({ initial: "below" }),
    rebuildable: new fields.BooleanField({ initial: false }),
  }, { required: false, nullable: true, initial: null }),
  ```
  (Reconcile field types against `module/rules/platforms.mjs`'s existing `boardingTarget`/
  `destructionSequence` functions, read this session's survey findings — those functions ALREADY
  hardcode Semiramis's exact numbers as their defaults, so the schema's job is to make those
  numbers **authored**, not to reimplement logic those pure functions already own correctly.
  Read `module/rules/platforms.mjs` in full before writing this task's field shapes — do not
  guess the shape blind.)

- [ ] Read `module/rules/platforms.mjs` (322 lines) completely.
- [ ] Add the fields, matching what `platforms.mjs`'s existing functions actually consume.
- [ ] Failing test: a `PlatformData` instance with these fields set round-trips through
      `toObject()`/schema validation cleanly.
- [ ] Commit.

### Task 14: Platform-native attacks

docs/20 §20.10 claims `canConsume` (budget) already exempts `platform`-kind units (confirmed this
session: `module/rules/budget.mjs:93,145,153-155`). Verify — do not assume — whether the rest of
the attack pipeline (`engine/attack.mjs`, `engine/skill-use.mjs`) actually lets a platform-kind
actor be the attacker: no facing update, cannot be countered, `{unit: "owner"}` in
`BaseAttackSource` resolving to `platform.system.ownerId`'s own `baseAttack`.

**Files:**
- Read: `module/engine/attack.mjs` in full for every place it reads/writes `attacker.facing`,
  checks `canBeCountered`, or resolves a `BaseAttackSource`'s `unit` field.
- Modify accordingly, gating the facing write and counter-eligibility on `kind !== "platform"`,
  and adding the `"owner"` case to wherever `unit: "self" | "partner" | UnitRef` is currently
  resolved (this session read `docs/06 §6.7`'s `BaseAttackSource` union earlier).
- Test: extend whatever attack-pipeline test fixture already exists (`test/unit/normal-attack.
  test.mjs` or similar) with a platform-kind attacker.

**Interfaces:**
- Consumes: `PlatformData.system.ownerId` (existing field) to resolve `{unit: "owner"}`.
- Produces: a platform actor can be the `attackerId` in `engine/attack.mjs`'s existing resolution
  path without special-casing anywhere else in that file beyond the three points above.

- [ ] Read `module/engine/attack.mjs` completely for the three concerns above.
- [ ] Failing tests for each: platform attacker's facing is untouched after attacking; a platform
      attack cannot be countered even by a unit that could otherwise counter it; `{unit: "owner"}`
      resolves the platform's owner's `baseAttack.mag`.
- [ ] Implement, tests pass.
- [ ] Commit.

### Task 15: Compound targeting anchor

Dragon Wing Warriors: *"Range=4 plus the area under the HGoB and the area of the HGoB."* Aerial
Garden of Vanity (the platform attack, not the NP of the same name): *"Cannot hit under or above
the HGoB"* — the complementary case, confirming both need expressing.

**Files:**
- Read: `module/rules/targeting/vocabulary.mjs` and `module/rules/targeting/resolve.mjs`
  completely (this session has not yet opened either).
- Modify: add an `anchor: { kind: "compound", of: [...] }` shape whose resolver unions (not
  intersects) the panel sets each sub-anchor in `of` produces, and a parallel `exclude: [...]`
  modifier for the complementary case (subtracting a set rather than unioning).
- Test: `test/unit/target-region.test.mjs` or the targeting vocabulary's own test file.

**Interfaces:**
- Consumes: `{ kind: "compound", of: [{kind: withinRange, ...}, {kind: platform, platformId:
  "own", includeBelow: true}] }` and `{ kind: withinRange, ..., exclude: ["under", "above"] }`.
- Produces: a panel set for `resolve.mjs`'s existing shape-application step to consume unchanged.

- [ ] Read both targeting files completely.
- [ ] Failing tests for union and exclusion behavior in isolation from any real ability.
- [ ] Implement.
- [ ] Commit.

### Task 16: Multi-instance fixed-damage attack, one consolidated reaction prompt

Dragon Wing Warriors: `1d6+4` separate 50-fixed-STR-damage instances, each separately evadable/
blockable, but ONE Injury Roll total and ONE reaction prompt (docs/20 §20.10's own explicit
DECISION against five-plus sequential prompts).

**Files:**
- Read: `module/engine/attack.mjs`'s existing multi-hit handling (`grep -n "multihit\|multiHit"
  module/engine/attack.mjs`) — if a multi-instance shape already exists for some other ability,
  extend it; if not, this is new.
- Modify accordingly, adding `singleInjuryRoll: true` support if not already present, and a
  consolidated "Evade each hit / Block all / Do nothing" prompt per docs/20's decision, resolving
  evades in sequence server-side with the existing cascade rule (a failed evade ends evasion for
  the remaining hits — verify this cascade rule already exists elsewhere before reimplementing).
- Test: `test/unit/aoe.test.mjs` or wherever multi-hit resolution is tested.

**Interfaces:**
- Consumes: `formula: { fixed: 50, component: str, multihit: "1d6+4", perHitEvadable: true,
  perHitBlockable: true, singleInjuryRoll: true }` on a damage phase.

- [ ] Read the existing multi-hit code path completely.
- [ ] Failing test: 5-10 hits resolve from one prompt, one Injury Roll, and a failed evade partway
      through stops further evade attempts for that same attack (if the cascade rule exists) or is
      explicitly out of scope with a comment explaining why (if it does not, and building it is
      disproportionate — flag this as a decision point rather than silently skipping it).
- [ ] Implement.
- [ ] Commit.

**Phase 3 checkpoint:** `npm test && npm run lint` clean. Still no live test — Phase 8 exercises
this for real, but consider a scratch platform+ability in the live world here too, same reasoning
as Phase 2's checkpoint, if Phase 8 is more than a session away.

---

## Phase 4 — Vision-triggered marks

### Task 17: `unitFirstSeen` event and `RevealPosition`

Familiar: Doves' passive: *"Whenever Semiramis sees a Unit for the first time, the 'Dove' effect
is applied... Semiramis can see the position of all Units with 'Dove' regardless of Fog of War
(but the effect does not remove Fog of War for her)."*

**Files:**
- Read: however this codebase currently determines line-of-sight/vision for Detect (Ch. 08 §8.7,
  `module/rules/identity.mjs`'s `DETECT_BY_CLASS` this session already read, and wherever Detect
  range is actually turned into a "can this unit see that one" boolean — `grep -rn "detect"
  module/engine module/apps/canvas`).
- Create: `module/engine/vision.mjs` — fires `unitFirstSeen(seer, seenUnit)` the first time a unit
  enters another's Detect range, tracked via a per-actor "units ever seen" set (a new field or a
  flag — decide based on what already exists for similar one-time tracking, e.g. how
  `healthWatermarks` tracks history per this session's exploration of `snapshot.mjs`).
- Modify: `module/rules/elements.mjs` — `RevealPosition` executor.
- Create: `module/apps/canvas/dove-markers.mjs` — a canvas layer drawing ghost markers for
  Dove-tagged units at their last-known position, for Semiramis's controller only, WITHOUT lifting
  Foundry's fog-of-war texture (read `module/apps/canvas/overlay-layer.mjs`, already built per
  this session's `fgt.mjs` read, as the pattern for a permission-scoped custom canvas layer).
- Test: `test/unit/effect-flow.test.mjs` for the event/effect-application half (pure); the canvas
  half is not unit-testable and gets its live-world check in Phase 5's checkpoint.

**Interfaces:**
- Produces: `dove` effect application via the ordinary `OnEvent`/`ApplyEffect` path (no new
  primitive needed there — `unitFirstSeen` is just a new *event name* the existing `OnEvent`
  executor already dispatches generically, confirm this by reading `normalizeHandler` in
  `elements.mjs`, referenced earlier this session).

- [ ] Read the Detect/vision code path and `overlay-layer.mjs` completely.
- [ ] Implement the event source with a failing test: two units meeting for the first time fires
      once; a second encounter does not re-fire.
- [ ] Wire `RevealPosition` as an ordinary executor reading the marked-unit set.
- [ ] Build the canvas marker layer, scoped so only the owning player sees it (reuse
      `overlay-layer.mjs`'s permission pattern).
- [ ] `npm test && npm run lint` clean.
- [ ] Commit.

**Phase 4 checkpoint:** No live test yet — needs Task 24 (Familiar: Doves) and an actual opposing
unit on a scene to see for the first time.

---

## Session progress log (read this first before resuming)

As of this checkpoint, landed and verified (each live in `FGT_2026`, each with passing unit
tests, full suite green, lint clean):

- **Task 11 (summon variant)** — done, committed (`0ca6bef`).
- **Task 18 (servant file)** — done for the base stats/identity; abilities list is partial
  (grows as each ability below lands). Committed alongside Task 11.
- **Task 19 (Presence Concealment)** — done, reuses `class-presence-concealment` unmodified.
- **Task 20 (Item Construction / poison item / Queen's Poison)** — done, committed (`9f91584`).
  Found and fixed two real, previously-dead engine gaps along the way: the `itemGrant` ability
  phase kind did not exist (nothing let an ability CREATE an item), and `engine/items.mjs`'s
  `toIntents` never resolved a `consumeEffect`'s short-form `{id, duration}` into the
  `{defId, expiry}` shape an `applyEffect` intent needs — `[Semiramis' Poison]` was the first
  content ever to exercise that path, and it silently did nothing.
- **Task 22 (Divinity)** — done, reuses `divinity` unmodified (`{ref: divinity, rank: C}`).
- **Task 21 (Territory Creation)** — content authored and unit-tested; live-verified at the
  `collectContributions` layer (below). Found and fixed two more real gaps: `snapshotUnit` never
  projected `contentId` at all (declared on every unit type's schema, read by nothing), and
  `annotatePlatforms` only ever stamped a unit with the platform's random Foundry document id —
  useless to content, which cannot predicate on an id that does not exist until a specific world
  creates one. Added `platformContentId` (the STABLE content id) alongside it, plus a
  `self:onPlatform:<id>` roll option and a `requiresRecipient` string-equality mode in
  `rules/auras.mjs` (it only supported booleans).
- **Root-cause bug found and fixed while live-verifying Task 21**: Territory Creation's OWN
  `DamageModifier` clauses (both the EX platform half and the C home-base half — "all damage
  dealt BY this Unit is increased") were being silently dropped by `contributionsOf`, while the
  recipient-side `Aura` half kept working. Root cause: `module/rules/elements.mjs`'s
  `DEFERRED_PREFIXES` only deferred `target:`/`attack:` predicates; `self:inHomeBase` and
  `self:onPlatform:<id>` are `self:`-prefixed but are BOARD annotations
  (`annotateEnvironment`/`annotatePlatforms`, stamped only during `snapshotBoard`) that don't
  exist yet when `contributionsOf` collects with its board-blind, actor-only options set — so the
  predicate was tested immediately, answered false, and the element dropped for good, instead of
  deferring to `rules/damage/pipeline.mjs`'s later re-test against the fully-annotated board
  (the exact mechanism `target:`/`attack:` predicates already use). This is a **pre-existing bug
  affecting Medea's Territory Creation too**, not something introduced by Semiramis's content —
  `medea-territory-creation.yml`'s own Passive 1 (`predicate: ["self:inHomeBase"]`) was equally
  dead. Fixed by adding `"self:inHomeBase"` and `"self:onPlatform:"` to `DEFERRED_PREFIXES`.
  Verified: new regression test in `test/unit/elements.test.mjs`, full suite green (1947 tests),
  and live on the actual `Semiramis` actor in FGT_2026 — `contributionsOf(actor)` now returns
  both Territory Creation `DamageModifier` contributions (EX + C) with their predicates intact,
  alongside the two `Aura` contributions that already worked.

- **Task 23 (Double Summon)** — done, committed. Required real engine work, not just content:
  - **Phase-level `predicate:`** (`module/engine/skill-use.mjs`'s `runPhases`): clause 3 ("if she
    does not have DSC, gain the buff") is the first ability where only ONE of several phases is
    conditional. Gated against the caster's own options (`rollOptionsFor({attacker: unitSnapshot(actor)})`),
    same self-only scope a rule element's own `predicate` gets at collection time.
  - **`VariantOverride` rule element** (`module/rules/elements.mjs`, `module/rules/snapshot.mjs`):
    the DSC buff must grant Range/Normal Attack/Sustainability identical to the permanent 'dsc'
    variant, without re-authoring those three numbers a second time. The executor names a BRANCH
    (`heads`); `snapshotUnit` reads `sys.summonVariant.<branch>.overrides` live and merges it onto
    the projection, on top of the ordinary `sys.*` fields, whenever a temporary grant is active —
    one set of numbers serves both the permanent (`resolveSummonVariant`/`sheetPatch`, summon-time)
    and the temporary (this) path.
  - **`ResourceDelta` gained a `roll:` form** (`module/engine/scheduler.mjs`): every prior use was
    a flat `delta`; Construction's "HGoB Construction increased by 1d6 at the end of every Turn"
    needed a rolled amount, resolved through the existing `rolled()` helper `Heal` already uses.
  - **Root-cause bug found and fixed, systemic, not Semiramis-specific**: `ctx.rolls` was NEVER
    populated for `turnEnd`/`actedTurnEnd`/`turnStart`/`roundEnd`/`roundStart` in
    `module/engine/scheduler-hooks.mjs` — `scheduler.pendingRolls`'s "caller rolls" contract
    (module/engine/scheduler.mjs) was honoured for `unitDefeated` (`attack.mjs`) and NOWHERE ELSE.
    Any `OnEvent` handler with its own `roll:` firing at a Turn/Round boundary silently wrote
    nothing, indistinguishable from a working zero-magnitude effect — this would have affected any
    future content using that pattern, not just Semiramis's Construction. Fixed with a new
    `gatherRolls(pairs)` helper, called before every `scheduler.endTurn`/`beginTurn`/`endRound`/
    `beginRound` invocation.
  - **Content bug found and fixed in `semiramis-territory-creation.yml`** (authored earlier this
    session, at Task 21): both `Aura` elements (the Passive 2 wards) were missing the
    `predicate: ["self:variant:dsc"]` gate their sibling `DamageModifier` elements (Passive 1)
    already carried — so a **noDsc** Semiramis's own, unowned Territory Creation still contributed
    its Passive 2 ward auras, when clause 1's entire package ("if she has it...") should not have
    applied to her at all. Caught live: a noDsc actor's `contributionsOf(actor).auras` returned two
    stray candidates (EX + C) before the buff, when it should have returned none. Fixed by adding
    the same predicate to both Auras.
  - Verified: `test/unit/scheduler.test.mjs` (rolled `ResourceDelta`), `test/unit/snapshot.test.mjs`
    (`VariantOverride` describe block), full suite green (1953 tests), `validate:content` clean, and
    live in FGT_2026 end-to-end — a noDsc Semiramis using Double Summon gained all three effects,
    her Range/Normal Attack/Sustainability flipped to the DSC shape, `contributionsOf` showed
    exactly one `territoryCreation` aura (dscBuff's Rank C, clause 1's own contributing nothing),
    and advancing an actual Combat turn increased her `hgobConstruction` resource by a real `1d6`
    roll (0 → 4) through the newly-wired `gatherRolls` path.
- **Tasks 2, 17, 24 (`@count`, vision system, Familiar: Doves)** — done, committed. Three engine
  pieces:
  - **`countMatching` on a `cooldown` phase change** (`module/engine/skill-use.mjs`), not a new
    `@count(...)` expression syntax — the aggregate is a per-unit predicate membership test summed
    over the board, which the ORDINARY predicate grammar (`rules/predicate.mjs`) already answers
    one unit at a time. `{countMatching: {relation, requires}, maxTicks}` reuses `relationOf` and
    `testPredicate` rather than inventing a parser the language has no aggregate form for.
  - **`unitFirstSeen`** (`module/rules/identity.mjs`'s pure `newlySeenBy`, `module/engine/
    vision.mjs`'s impure `checkSightings`, hooked into `movement-hooks.mjs`'s `onMove`): symmetric
    by construction (checks every unit as a candidate seer, not only the one that moved), tracked
    via a new `seenUnitIds` SetField (`data/actor/_shared.mjs`, alongside `healthWatermarks`'s
    "question about history" pattern). Reused Queen's Poison's own `target: "victim"` /
    `ctx.victim` vocabulary (`scheduler.mjs`'s `targetsOf`) for landing the Dove effect on the SEEN
    unit rather than inventing a new `subject:` case — tried that first, found the existing
    mechanism already covers a second-party event.
  - **`RevealPosition`** (`module/rules/elements.mjs`, projected as `revealsEffect` in
    `snapshot.mjs`) and a canvas marker (`apps/canvas/overlay-layer.mjs`'s `#drawRevealedPositions`,
    added to the EXISTING always-on overlay layer rather than a new layer class — far less code
    than Task 17's original sketch, and the layer was already exactly the "permission-scoped"
    pattern to reuse). A dot at the carrier's live panel, drawn only for the viewer's controlled
    tokens, nothing else revealed — the "does not remove Fog of War" half.
  - Verified: `test/unit/identity.test.mjs` (`newlySeenBy`), full suite green (1958 tests),
    `validate:content` and `lint` clean, and live in FGT_2026 end-to-end — moved an enemy Servant
    into Semiramis's Detect range, confirmed `checkSightings` recorded it in `seenUnitIds` exactly
    once (idempotent on a second call) and applied the Dove effect to the SEEN unit; confirmed
    `contributionsOf(semiramis).revealsEffect === "dove"`; used the active clause on a 3x3 area and
    confirmed Debuff ResDwn (magnitude 30, correct ⅓◈ expiry) landed on the Dove-tagged enemy.
- **Task 25 (Arrogant King's Poison)** — done, committed. Needed two new pieces (the plan's own
  guess at Task 25 was right that this was needed, and confirmed no item-quantity cost existed
  yet): an `itemAtLeast` requirement kind (`rules/items.mjs`, gate) reading a new `items` array on
  the unit snapshot (`rules/snapshot.mjs`, keyed by stable `contentId` the same way
  `platformContentId` is), and `itemCost`/`itemCostIntents` (`engine/skill-use.mjs`) to actually
  spend it at use time — distinct from a consumed `[Semiramis' Poison]`'s own `consumeEffect`
  (Queen's Poison): this cost is on USING the ability, not on landing an item's own effect.
  Tick-expression subtraction (`"4◈-⅓◈"`) needed no engine work — already an explicit example in
  `domain/tick.mjs`'s own doc comment.
  **Found and fixed live**: `itemCost` was authored and silently dropped TWICE over — once by
  `tools/lib/content.mjs`'s explicit ability-`system` allowlist (the same class of bug
  `summonVariant` hit at Task 21: a field compiled to its schema default because nothing named it),
  and again by `data/item/ability.mjs`'s DataModel schema not declaring the field at all, so even
  the correctly-compiled compendium data was stripped the moment `Actor.create` instantiated a
  world Item from it. Both fixed; a `itemCost` survives `compileDocument` regression test added
  alongside `summonVariant`'s in `test/unit/content.test.mjs`.
  Verified: `test/unit/items.test.mjs` (`itemAtLeast`), `test/unit/content.test.mjs`, full suite
  green (1960 tests), `validate:content`/`lint` clean, and live in FGT_2026 — refused with reason
  `itemAtLeast` at 0 and at 1 held poison, succeeded at 4 (landed Poison + Def Dwn 30/40% on the
  target and correctly deducted exactly 3, leaving 1).
- **Task 26 (Scales of the Sacred Fish)** — done, committed. Needed almost no new engine work: the
  `whenAllyAttacked` reaction window (`rules/reactions.mjs`'s `allyReactions`) already exists for
  exactly this shape (EMIYA's Rho Aias is the reference case) and offered the Spell correctly with
  no changes at all. The one real gap: `engine/shield.mjs`'s `refreshShield` only knew "fill to
  full on first use" and "decay by half of current" (Rho Aias's own clause) — anything else fell
  through to whatever was left in the pool from its last use. Scales' Shield(200) needs a FRESH 200
  on every cast, so added that as the default for any ability with no `refresh.kind` specified
  (Rho Aias's own behavior unchanged, since its `first`-use branch and explicit `halfOfCurrent`
  spec are both untouched).
  Verified: `test/unit/shield.test.mjs` (`refreshShield`, 4 new tests covering first-use, repeat-
  use-refills-full, explicit decay, and no-spec), full suite green (1964 tests), `validate:content`/
  `lint` clean, and live in FGT_2026 — `allyReactions` offered the Spell when Semiramis herself was
  the (simulated) defender, using it applied the Shield effect and filled the pool to 200, and
  `absorb()` fully intercepted a 150-damage hit with no NP restriction (unlike Rho Aias).
- **Phase 5 checkpoint reached**: every non-NP/non-summon/non-platform ability of Semiramis's now
  works live — Presence Concealment (reused), Item Construction, Territory Creation, Divinity
  (reused), Double Summon, Familiar: Doves, Arrogant King's Poison, Scales of the Sacred Fish.
  Full suite green, `validate:content`/`lint` clean. Remaining work is Phase 6-9: Bašmu (spell +
  summon + NP), Sikera Ušum (her actual NP), and the entire Hanging Gardens of Babylon platform —
  by far the largest remaining scope, expected per the plan's own framing of that milestone.
- **Task 29 (Sikera Ušum, clause 1 only)** — done, committed. Clause 1 (a noDsc Semiramis, the 5x5
  area following her) is fully built and live-verified; clause 2 (the DSC/Throne-Room branch) is
  deliberately deferred to Phase 8 since the Throne Room does not exist until the Hanging Gardens
  platform does — gated off by a `predicate` requirement on `self:variant:dsc`/`noDsc`, confirmed
  refusing correctly for a DSC-variant Semiramis.
  Six real engine pieces, more than any prior task this session:
  - `self:inField:<id>` was already emittable (`rules/options.mjs`) but missing from
    `DEFERRED_PREFIXES` — the exact same collection-time bug Territory Creation hit at
    `self:inHomeBase`/`self:onPlatform:`, fixed there.
  - `ImmunityDowngrade`/`VulnerabilityAmplifier` (new)/`PeriodicOverride` (new) rule elements.
    Found along the way: `rules/bounded-fields.mjs`'s `annotateFields` used a raw dump for every
    non-stat interior rule, which worked by coincidence for `DamageModifier`-shaped rules (the
    only kind any field had ever used) but silently misrouted anything whose executor produces a
    DIFFERENT shape or a different bucket (`ImmunityDowngrade` → `suppressions`). Rewritten to run
    interior rules through the SAME `EXECUTORS` table `passiveRules` use
    (`interiorContributions`, `elements.mjs`'s `empty` now exported for it).
  - `ImmunityDowngrade` was ALSO entirely dead downstream — collected into `suppressions` since
    the day it was written, consulted by nothing. Wired into `effect-applier.mjs`'s immunity gate
    (downgrades a block to an added resist penalty) and its `chanceContribution` resist summation
    (halves a matching Poison Resist contribution for a non-immune bearer).
  - `VulnerabilityAmplifier`'s consumer: `scheduler.mjs`'s `amplify()` (previously a hardcoded
    `AMPLIFIERS` table keyed by a STANDING effect like Deadly Poison) now also multiplies for a
    unit standing in a matching field, gated on the unit ALREADY being "weak to" the effect (a
    standing marker or an existing chance-raising contribution) — the field widens an existing
    weakness, per the sheet's own wording, rather than inventing one.
  - `engine/fields.mjs`'s `runFieldEvent` (built for Unlimited Blade Works' evade-then-damage
    shape) gained an `ApplyEffect` action, a `requiresActed` filter, and an `excludeOwnerMaster`
    exclusion for clause b's "a Unit other than Semiramis or her Master." Its `runFieldEvents`
    is now also invoked at `actedTurnEnd` (`scheduler-hooks.mjs`), not just `turnStart`.
  - `tools/lib/content.mjs`'s `compileCooldown` dropped an authored `max` unconditionally in its
    object-form branch — worked for Presence Concealment (rank-table-only) but silently broke the
    first ability needing BOTH a flat max and `countFrom: deactivation`. Fixed, plus a NEW,
    genuinely generic "field closes → set its ability's cooldown from `countFrom: deactivation`"
    hook (`fields.mjs`'s `setCooldownOnDeactivation`, called from `expireFields`) — Presence
    Concealment's own version of this is hardcoded to one effect id via a `deleteActiveEffect`
    hook; this is the first version any FUTURE field-owning ability can reuse for free.
  - `engine/skill-use.mjs`'s `useSkill` never supplied `ctx.testPredicate` to `canUseAbility`, so
    the `predicate` requirement kind (`rules/items.mjs`) — present in the vocabulary since §15.4
    was implemented — refused every use that named it, unconditionally. Wired using the same
    self-only `rollOptionsFor`/`testPredicate` pattern Task 23's phase-level predicate already
    established.
  Verified: `test/unit/bounded-fields.test.mjs` (interior-rule routing, 3 new tests),
  `test/unit/effect-applier.test.mjs` (Immunity Downgrade, 4 new tests),
  `test/unit/scheduler-periodic.test.mjs` (Vulnerability Amplifier, 5 new tests),
  `test/unit/poison.test.mjs` (Periodic Override, 5 new tests), `test/unit/content.test.mjs`
  (`compileCooldown`'s `max`+`countFrom`), full suite green (1982 tests), `validate:content`/`lint`
  clean, and live in FGT_2026 — the field opened with all four axes correctly authored; clause a
  fired via `fireEvent("damageStepEnd", ...)` with a live board's options (Karna received a real
  `applyEffect` poison intent from a simulated STR Normal Attack); clause b fired via
  `runFieldEvents("actedTurnEnd")` for an acted, non-owner/non-Master enemy inside the field;
  clause c's `tickPeriodics` answered `turnEnd`, `actedTurnEnd` AND `roundEnd` for the same Poison
  instance (only `roundEnd` without the override); `contributionsOf`/`annotateFields` on Semiramis
  herself showed all three interior contributions (immunity-downgrade suppression, vulnerability
  amplifier, periodic override) correctly routed and none leaking into `modifiers`; and a DSC-
  variant Semiramis was correctly refused with reason `predicate`.
- **Tasks 7, 27, 28 (Bašmu spell/summon/NP)** — done, committed. Clause 1 of Summoning: Bašmu
  (the damage-spell branch, usable without the HGoB) is fully built and live-verified. Clause 2
  (summon a Bašmu) and its stats/NP are fully authored and `validate:content`-clean but
  deliberately NOT live-tested — Bašmu cannot exist before the HGoB does, and the two clauses'
  DIFFERENT cooldowns (2◈ vs 4◈) need a real "computed cooldown, keyed on which branch fired"
  design (Dragon Tooth Warriors' `countFrom: summonCount` shape) that Phase 8 should make, not a
  guess now.
  - **`TargetabilityModifier`** (Task 7, new): Bašmu's "enemy Units cannot Attack Semiramis or her
    allied Units if a Bašmu is next to them." An aura that changes legal targeting rather than a
    stat, so it rides through `rules/auras.mjs`'s EXISTING expansion (`Aura`'s own machinery, a
    new `key: "untargetable"` ROUTES entry) rather than a second pass — the plan's own uncertainty
    about needing a sibling pass turned out unnecessary. `rules/targeting/resolve.mjs` gained a
    new filter step reading it, checked against the caster's RELATION to the target (enemy only —
    an ally must still be able to protect/heal a Bašmu-guarded unit). Found and fixed inline: an
    orphaned JSDoc comment (`ApplicationChance`'s own description, stranded above `Compulsion`
    after some earlier edit moved the executor without its comment) was moved back to the right
    place. **Also found, left unfixed and flagged**: Medea's Dragon Tooth Warriors already has an
    equivalent-sounding `TargetingModifier mode: protectSummoner` clause that has been dead since
    it was written — `protectSummoner` is never read anywhere. Out of scope for Semiramis; noted
    here for whoever picks it up (it protects a NARROWER set — "Medea or her Master" only, not
    every ally — so it cannot just be swapped for `TargetabilityModifier`'s default relations
    without also narrowing them).
  - **`SummonData` schema** gained `boundToZoneId`/`dismissOnZoneRemoval` (Bašmu's tie to the
    HGoB) and `movesOntoOccupiedPanels`, plus `tools/lib/content.mjs`'s `actorSystem` allowlist —
    the by-now-familiar two-gate pattern (compiler AND DataModel schema) confirmed again.
  - **Knockback** ("when it Moves to any occupied panels, all Units occupying said panels are
    knocked back by 1 panel until the space is free"): a real primitive, `rules/movement.mjs`'s
    `knockbackPanel` (directional, steps along the line away from the mover until it finds a free
    panel), wired into `movement-hooks.mjs`'s `onMove` via a new `ignoresOccupancy` snapshot flag
    (`rules/movement.mjs`'s existing `ignoresBlocking` already read this generic flag; nothing had
    ever set it). `directionFrom`/`knockbackCollisionByEnd`, two low-level primitives that existed
    with no consumer at all, were not reused — this needed a directional "push until free" search,
    not what those two computed. The Hanging Gardens platform will need this exact same primitive
    for its own knockback/board-edge rules, so it is built as a general one, not Bašmu-specific.
  - **`resolveAttack` (attack.mjs) had the SAME `testPredicate` gap `useSkill` did**, found live
    testing Summoning: Bašmu's damage branch (which routes through the attack path, not `useSkill`,
    since it has a `damage` phase) — fixed the same way.
  Verified: `test/unit/targeting.test.mjs` (Bašmu's protection, 3 new tests),
  `test/unit/movement.test.mjs` (`knockbackPanel`, 5 new tests), `test/unit/content.test.mjs`
  (Bašmu's summon-specific fields), full suite green (1991 tests), `validate:content`/`lint`
  clean, and live in FGT_2026 — Summoning: Bašmu's damage branch correctly refused for a noDsc
  Semiramis, then correctly resolved a full two-defender Combat Process for a DSC one: 25%
  Magic damage landed on both AoE targets and Poison was freshly applied to the one that lacked it.
- **Not yet started:** Task 29 (Sikera Ušum's
`unitFirstSeen`/`RevealPosition` system, Task 17, not yet built), Task 25 (Arrogant King's
Poison — needs an item-quantity REQUIREMENT kind that does not exist yet in
`rules/items.mjs#meetsRequirement`, a materially-sized addition, not a one-liner), Task 26
(Scales of the Sacred Fish — genuinely novel: "an ally within 2 panels reacts when attacked"
has no existing event to hook; `attackDeclared` fires only on the attacker, not broadcast near
the defender, so this needs either a new broadcast event or an aura-style proximity mechanism,
not yet designed), Tasks 27-28 (Bašmu + its NP), Task 29 (Sikera Ušum), Tasks 4/8/9/10/12-16/30-
32 (the entire Hanging Gardens: channel kind, platform combat, the 6-source Construction
resource, and the platform's real numbers).

**Live-test debt on what IS done:** Territory Creation's platform-scoped (EX) half has still not
been exercised through an actual ATTACK ROLL live (no HGoB platform token exists yet in
FGT_2026) — only confirmed at the collection layer above. Its ground-Home-Base (C) half is now
attack-testable (no platform dependency) but hasn't been driven through a real attack yet either.
Re-verify both halves through actual damage rolls once Task 32's platform lands, or sooner via a
manual Home Base zone + attack in FGT_2026.

---

## Phase 5 — Semiramis herself: base servant and non-NP abilities

From here on, every task ends with the corresponding piece live-tested in `FGT_2026` as it lands,
not deferred to one giant test at the end — this is the highest-value checkpoint discipline for a
kit this interconnected.

### Task 18: The servant file

**Files:**
- Create: `packs/_source/servants/semiramis.yml`.
- Test: `npm run validate:content` after every subsequent content task, not just this one.

**Content** (every number from the source sheet, lines 1-32):
```yaml
name: Semiramis
type: servant
contentId: semiramis
system:
  trueName: Semiramis
  region: [mesopotamia, middleEast]
  alignment: { order: lawful, morality: neutral }
  parameters: { str: E, end: D, agi: D, mag: A, luc: A }
  attributes: [female, servant, earth, king, humanoid]
  baseHealth: 750
  mov: 4
  baseAttack: { str: 45, mag: 200 }
  sustainability: "2◈"     # overridden to "4◈" by the dsc summon variant, Task 11
  servantClasses: [caster, assassin]   # both, per the DSC passive — confirm whether both
                                        # classes should be unconditional or only under DSC;
                                        # re-read line 32 of the source sheet: "(Passive)
                                        # Semiramis is both a 'Caster' and 'Assassin' Class
                                        # Servant" is listed under the DSC ability block but
                                        # not explicitly gated to the DSC branch — check
                                        # against the DSC ability's own passive numbering
                                        # (Passive 1/2 are branch-specific, this is unnumbered
                                        # "(Passive)") and author it as unconditional
  summonVariants:
    - id: dsc
      roll: { formula: "<match this codebase's coin-flip convention, Task 11>", on: heads }
      grants: [semiramis-double-summon-caster]
      overrides:
        range: { panels: 3, targets: 1 }
        normalAttack:
          mode: byRange
          bands:
            - { maxRange: 2, spec: { mode: fixed, component: str } }
            - { maxRange: 99, spec: { mode: fixed, component: mag } }
        sustainability: { base: "4◈" }
    - id: noDsc
      default: true
      overrides:
        range: { panels: 2, targets: 1 }
        normalAttack: { mode: fixed, component: str }
        sustainability: { base: "2◈" }
```
`HGoB Construction: 0/100` (line 24) is the resource this actor carries — added in Task 30, not
here, since it depends on the region-based initial value logic that task builds.

- [ ] Write the file with every field above, resolving the two flagged uncertainties (coin-flip
      formula convention, whether Caster/Assassin class is unconditional) by reading the
      cross-referenced source, not by guessing.
- [ ] `npm run validate:content` passes with zero errors for this file (other files will still be
      missing — that is expected until later tasks land; check the validator's per-file mode if it
      has one, else confirm no NEW errors are introduced by this file specifically).
- [ ] `npm run build:packs`.
- [ ] Commit.

### Task 19: Presence Concealment (Rank C+)

Reuses the existing generic Presence Concealment mechanism (`module/rules/concealment.mjs`,
`module/engine/concealment.mjs`, confirmed built this session while investigating an unrelated
naming question) — this task is content-only: author her specific rank and the cooldown-after-
deactivation timing against whatever content shape another PC-holding servant already uses as the
working reference (`grep -rl "presenceConcealment\|presence-concealment" packs/_source/abilities`
to find one — Hassan of Serenity almost certainly has one, given her class).

**Files:**
- Create: `packs/_source/abilities/semiramis-presence-concealment.yml`.
- Read: whichever existing servant's PC ability file the grep above finds, completely, as the
  pattern.

**Content:** Rank C+, her sheet's 8 numbered clauses (lines 34-44 of the source) are the SAME
generic mechanism's clauses (compare against the reference file's clause list — if the reference
servant's PC ability already encodes all 8 generically, this task is purely the rank/cooldown
numbers; if her clause list differs in any specific, that specific becomes a real content
difference to author explicitly, not to silently drop).

- [ ] Read the reference PC ability file completely, diff its clauses against Semiramis's 8.
- [ ] Author her file, at Rank C+, cooldown "1◈ Turns after PC is deactivated" (note: this
      cooldown TIMING — starting at deactivation, not at activation — should already be how the
      reference servant's works, since PC's own general mechanism owns this; if the reference
      file does it differently, that is a pre-existing bug outside this plan's scope — note it,
      do not silently fix it here unless it blocks Semiramis specifically).
- [ ] `npm run validate:content`.
- [ ] **Live checkpoint:** summon Semiramis in `FGT_2026` (first time she exists as an actor —
      confirm her sheet renders, base stats match the source sheet, and the DSC variant resolved
      and shows on the summon dialog per Task 11's wiring). Activate Presence Concealment,
      confirm the standard concealment behavior (untargetable, block/counter gate, etc. per the
      generic mechanism) applies to her.
- [ ] Commit.

### Task 20: Item Construction, `[Semiramis' Poison]`, Queen's Poison

**Files:**
- Create: `packs/_source/abilities/semiramis-item-construction.yml` (Rank C, 1d4 roll, 2◈ cooldown).
- Create: `packs/_source/items/semiramis-poison.yml` (`transferable: true`, `transferRange: 1`,
  `transfersPerTurn: 1`, `transferFrom: [semiramis]` — confirmed built this session's survey).
- Create: `packs/_source/effects/queens-poison.yml`:
  ```yaml
  id: queensPoison
  polarity: status
  removability: { unremovable: true }
  duration: "3◈"
  rules:
    - { key: ApplicationChance, direction: outgoing, value: 30,
        predicate: ["effect:volatility:volatile"] }
    - { key: ApplicationChance, direction: incoming, value: -15,
        predicate: ["effect:volatility:volatile"] }
    - key: OnEvent
      event: damageStepEnd
      predicate: ["self:isAttacker", "attack:kind:normal", "attack:component:str"]
      then:
        - { key: ApplyEffect, target: victim, effect: { id: poison } }
        - { key: ApplyEffect, target: victim, effect: { id: poison }, chance: 50,
            bypassChanceModifiers: true }   # Task 3
        - { key: RemoveEffect, target: self, selector: { kind: byId, ids: [queensPoison] } }
  ```
- Test: `npm run validate:content`.

**Interfaces:**
- Consumes: Task 3's `bypassChanceModifiers` on the `ApplyEffect` action.

- [ ] Author all three files against the source sheet's exact numbers (lines 46-53).
- [ ] `npm run validate:content`.
- [ ] **Live checkpoint:** use Item Construction, confirm it creates the rolled number of items;
      stand Semiramis next to an allied unit and confirm the item transfers and is capped at
      once per Turn; consume it on the ally, confirm Queen's Poison applies for 3 turns and that
      a Normal Attack (STR) from that ally inflicts Poison plus, over several repeated tests
      (since it is a 50% chance), sometimes a second stage — and that Queen's Poison is removed
      after the ONE attack regardless of whether the bonus stage landed.
- [ ] Commit.

### Task 21: Territory Creation

**Files:**
- Create: `packs/_source/abilities/semiramis-territory-creation.yml`, using Task 10's
  `TerritoryCreationScope` element and Medea's ability as the pattern for the single-scope base
  case, extended with the second (HGoB) scope.
- Content: EX rank, the two Passives (6d20 damage-dealt-in-home-base; damage-taken-reduced-by-
  (3d10+30) for allies in home base) scoped to the HGoB once she has DSC and to the ground home
  base at Rank C simultaneously; the non-DSC variant's temporary Rank C via `Double Summon`'s buff
  is this ability GRANTING itself conditionally — re-read lines 55-65 of the source and decide
  whether that is better modeled as this ability being predicated on the `DSC` buff/variant
  existing at all (i.e., she has NO Territory Creation without DSC, until Double Summon grants the
  buff, at which point a GrantedAbility — confirmed existing — attaches a temporary Rank C copy of
  this same ability). Prefer that reading; it reuses `GrantedAbility` rather than inventing a
  second mechanism.
- [ ] Author the file, resolving the design question above explicitly (write a one-line comment
      in the YAML or the commit message explaining the choice, matching this codebase's own
      convention of commenting non-obvious content decisions inline).
- [ ] `npm run validate:content`.
- [ ] **Live checkpoint:** with DSC, confirm the EX bonus applies only while she is on the HGoB
      (not testable until Task 32, note as deferred) and the C bonus applies in her ground home
      base right now; without DSC (build a second test copy or force the variant), confirm no
      bonus until `Double Summon` (Task 23) is used.
- [ ] Commit.

### Task 22: Divinity (Rank C)

**Files:**
- Create: `packs/_source/abilities/semiramis-divinity.yml` — flat +30 damage dealt, including NP.
  Reuse whatever generic Divinity pattern another servant with the ability already uses (per this
  session's earlier investigation, Karna's Vasavi Shakti reads a Divinity-rank bonus table, and
  the `divine` attribute grant is generic — `grep -rl "divinity" packs/_source/abilities` for the
  simplest existing flat-bonus example, not Karna's more complex one).

- [ ] Find and read the simplest existing Divinity ability file as the pattern.
- [ ] Author hers.
- [ ] `npm run validate:content`.
- [ ] **Live checkpoint:** her damage output is +30 over the pipeline's base result on a plain
      attack.
- [ ] Commit.

### Task 23: Double Summon (Active, Rank B)

**Files:**
- Create: `packs/_source/abilities/semiramis-double-summon.yml`.
- Content (lines 70-75): NP Regen for 1◈; `Construction` effect for 1◈ (HGoB Construction +1d4+2
  at each turn end while active — reuses Task 5's `PeriodicOverride`-adjacent pattern or is simply
  a resource-gain-over-time effect, check whether the resource system (§6.10) already expresses
  "gain N per turn while this effect is active" before building something new); if she lacks DSC,
  grants the `DSC` buff for 1◈ via `GrantedAbility` targeting `semiramis-double-summon-caster`
  (Task 18's granted ability). Cooldown 4◈.
- Create: `packs/_source/effects/dsc-buff.yml`, `packs/_source/effects/construction.yml` (both
  `polarity: status`? — re-read lines 61 and 73 of the source: *"neither a buff or debuff and is
  Unremovable"* — author as status/unremovable, matching Queen's Poison's pattern from Task 20).

- [ ] Read the resource system's "gain over time while active" support (or lack of it) before
      deciding the `Construction` effect's implementation.
- [ ] Author all three files.
- [ ] `npm run validate:content`.
- [ ] **Live checkpoint:** on a non-DSC Semiramis, use Double Summon; confirm the DSC buff grants
      Double Summon: Caster's abilities for exactly 1 turn (range change, normal-attack component
      change) and that HGoB Construction increases correctly at that turn's end; confirm NP
      cooldown reduction applies at the following turn end.
- [ ] Commit.

### Task 24: Familiar: Doves (Rank D)

**Files:**
- Create: `packs/_source/abilities/semiramis-familiar-doves.yml`, using Task 17's
  `unitFirstSeen`/`RevealPosition` for the passive and Task 2's `@count(...)` for the active's
  cooldown reduction.
- Content (lines 77-79): passive as specified in Task 17's interface; active: Range 4, 3x3 AoE,
  ResDwn debuff for ⅓◈ (+30% chance of being inflicted — this modifier is ON the ResDwn
  application itself, not a separate effect; read how another debuff-with-boosted-application-
  chance ability already expresses this, likely via `ApplicationChance` scoped to this one cast
  rather than a standing aura), then NP cooldown reduced by `min(@count(enemies where
  effect:dove), ticksPerRound)`. Cooldown 2◈.

- [ ] Author the file.
- [ ] `npm run validate:content`.
- [ ] **Live checkpoint:** move an enemy unit into her Detect range for the first time in the
      scene, confirm the Dove marker appears on her canvas layer and only for her controller;
      use the active against a 3x3 area, confirm ResDwn applies with the boosted chance; confirm
      her NP cooldown drops by the correct count of Dove-marked enemies, capped correctly.
- [ ] Commit.

### Task 25: Arrogant King's Poison (Active, Rank B+)

**Files:**
- Create: `packs/_source/abilities/semiramis-arrogant-kings-poison.yml`. Costs 3
  `[Semiramis' Poison]` (an item-consumption cost — check `rules/costs.mjs`'s existing item-cost
  support, confirmed generically present per this session's `costIntents` work on Bug #3, though
  that was about health/sustainability costs specifically — verify an item-quantity cost is
  already a legal `cost.kind` before assuming). 3x3 AoE, Poison + Def Dwn (B) for 1◈ (+30%/+40%
  if NP damage received). Cooldown "4◈-⅓◈" (verify the tick-expression grammar handles subtraction
  — `module/domain/tick.mjs`, read if this is the first subtraction-bearing duration this plan
  hits).

- [ ] Verify item-quantity costs and tick-expression subtraction both already work; read the
      relevant files if unsure rather than assuming.
- [ ] Author the file.
- [ ] `npm run validate:content`.
- [ ] **Live checkpoint:** with 3+ poison items held, use it; confirm the items are consumed,
      the AoE lands Poison and Def Dwn (B) correctly, and it refuses with a clear reason below 3
      items.
- [ ] Commit.

### Task 26: Scales of the Sacred Fish (Spell)

**Files:**
- Create: `packs/_source/abilities/semiramis-scales-of-the-sacred-fish.yml`. Reactive: triggers at
  the start of a Combat Phase when she or an ally within 2 panels is Attacked; Shield(200) for 2◈.
  Cooldown 3◈. This is a Spell (Ch. 17) — reuse the command-spell-adjacent reactive-trigger pattern
  another Spell already uses (`grep -rl "kind: spell" packs/_source/abilities` for a reference).

- [ ] Find and read a reference Spell ability file completely.
- [ ] Author hers.
- [ ] `npm run validate:content`.
- [ ] **Live checkpoint:** have an ally within 2 panels get attacked; confirm the Spell triggers
      and Shield(200) applies before damage resolution.
- [ ] Commit.

**Phase 5 checkpoint:** Full `npm test && npm run lint && npm run validate:content` clean.
Semiramis exists, is summonable, and every non-NP/non-summon/non-platform ability of hers works
live. This is the single most valuable milestone to stop and confirm thoroughly before Phase 6-8's
much larger surface.

---

## Phase 6 — Bašmu

### Task 27: Summoning: Bašmu (Spell, conditional phases)

**Files:**
- Create: `packs/_source/abilities/semiramis-summoning-basmu.yml`. Usable only with DSC
  (predicate on `self:variant:dsc` OR the DSC buff — reuse whatever combined check Task 32's
  `hasDSC` helper from docs/32 §32.1 resolves to; if that helper does not exist yet as real code,
  write it now as a small predicate/roll-option and note it is shared with every DSC-gated
  ability, not reimplemented per-ability).
- Content (lines 87-105): conditional phases keyed on `self:inZone:hgob` (not usable until Task 32
  exists — this task can be authored and unit-validated now, but its "summon Bašmu" branch cannot
  be live-tested until the platform exists; the "damage spell" branch (not in HGoB) can be
  live-tested now if she has DSC without the platform built — confirm this reading of the source
  is right: clause 1 fires "if used when NOT within her HGoB", which includes "HGoB does not exist
  yet", so this branch is testable standalone).

- [ ] Author the file with both conditional branches.
- [ ] `npm run validate:content`.
- [ ] **Live checkpoint (partial):** with DSC and no HGoB built yet, use it; confirm the damage-
      spell branch (25% extra damage, inflicts Poison, 2◈ cooldown) works. Defer the summon
      branch's live test to Phase 8.
- [ ] Commit.

### Task 28: Bašmu (summon) and its NP

**Files:**
- Create: `packs/_source/summons/basmu.yml` — stats exactly as lines 91-99 (Health 1250, Agility
  14, Luck 7, MOV 5, Range 2/1, BA(STR/MAG) 150, attributes [earth, large, dragon], Normal Attack
  uses STR with 50% Poison chance), `constraints: { maxConcurrent: 1, boundToZoneId: hgob,
  dismissOnZoneRemoval: true, countsTowardTurnBudget: false, actionsPerTurn: 1,
  movesOntoOccupiedPanels: true }` — verify every one of these constraint keys against
  `module/data/actor/simple.mjs`'s actual `SummonData` schema (read this session, has
  `countsTowardBudget`/`actsOncePerTurn`/`expiresAt` already — the exact field NAMES here must
  match that schema, not docs/32's guessed names; reconcile before writing the file, and extend
  `SummonData` with `boundToZoneId`/`dismissOnZoneRemoval`/`movesOntoOccupiedPanels` if genuinely
  missing, in this same task).
- Create: `packs/_source/abilities/basmu-cursed-poison-dragonfire.yml` — `categorizedAsNP: true`,
  the knockback-on-move behavior ("when it Moves to any occupied panels, all Units occupying said
  panels are knocked back by 1 panel") is a MOVEMENT rule, not an ability rule — check whether this
  belongs on the summon's own movement-hook behavior (`module/engine/movement-hooks.mjs`, already
  read this session for the Bug #3 investigation) rather than the NP ability file.
- Create/extend: the `basmu-protection` targetability aura from Task 7's `TargetabilityModifier`.
- Test: `npm run validate:content`; the knockback-on-move behavior needs a unit test in whatever
  file covers `movement-hooks.mjs` if new code is added there.

- [ ] Reconcile `SummonData`'s schema against docs/32's proposed constraint fields; extend the
      schema in this task if fields are missing, with a failing test first.
- [ ] Author `basmu.yml` and its NP ability file.
- [ ] Decide and implement where knockback-on-move lives; test it.
- [ ] `npm run validate:content`.
- [ ] Commit. (Live checkpoint deferred to Phase 8, since Bašmu can only truly exist once the HGoB
      does — the "outside HGoB" damage-spell branch was already checkpointed in Task 27.)

**Phase 6 checkpoint:** `npm test && npm run lint && npm run validate:content` clean.

---

## Phase 7 — Sikera Ušum (NP)

### Task 29: Sikera Ušum: Arrogant King's Alcohol (Rank B+, NP, Anti-Army)

**Files:**
- Create: `packs/_source/abilities/semiramis-sikera-usum.yml`, using Task 5's `PeriodicOverride`
  and Task 6's `VulnerabilityAmplifier`, and the `ImmunityDowngrade` executor (confirmed already
  built this session's survey, `elements.mjs`).
- Content: the full conditional-zone shape from docs/32 §32.7, adapted to whatever this codebase's
  ACTUAL zone/bounded-field phase syntax is (`module/rules/bounded-fields.mjs`, read in Task 5 —
  do not assume docs/32's `kind: zone` sketch matches the real phase-kind vocabulary; check
  `handledKeys()`/the phase-kind list in `elements.mjs` or wherever phases are validated).
- Cooldown "6◈+⅓◈ Turns after the NP ends" — a duration that starts counting from the NP's END,
  not its use; verify this "cooldown starts at deactivation" pattern already exists (Presence
  Concealment's cooldown in Task 19 was the same shape — reuse whatever that resolved to).

- [ ] Read the real bounded-field/zone phase vocabulary completely before writing this ability.
- [ ] Author the file with both DSC/non-DSC branches and all five area rules (a-e from the
      source, lines 111-117).
- [ ] `npm run validate:content`.
- [ ] **Live checkpoint:** without DSC, activate it, confirm the 5x5 area follows her for 2◈ turns
      and each of the five rules fires correctly (an ally's STR normal attack inside inflicts
      Poison; a non-Semiramis/non-Master unit acting and ending its turn inside gets Poisoned; a
      Poisoned unit inside ticks at its own turn-end AND round-end; a Poison-Immune unit inside is
      downgraded to 75% Resist; a Poison-weak unit takes double Poison damage). With DSC, defer
      the Throne-Room-scoped branch's live test to Phase 8 (needs the HGoB to exist).
- [ ] Commit.

**Phase 7 checkpoint:** `npm test && npm run lint && npm run validate:content` clean.

---

## Phase 8 — The Hanging Gardens of Babylon

The largest remaining piece. Every engine primitive it needs (Tasks 4, 8, 9, 10, 12, 13, 14, 15,
16) is already built by this point — this phase is close to pure content authoring plus wiring.

### Task 30: HGoB Construction resource

**Files:**
- Modify: `packs/_source/servants/semiramis.yml` (Task 18) to add the `hgobConstruction` resource
  (§6.10's system, confirmed generic and built).
- Content, the six sources (lines 120-128 of the source sheet) plus the region multiplier —
  reconcile against docs/32 §32.2's YAML sketch, but verify `gainTriggers`' exact field names
  against `module/rules/resources.mjs` or wherever §6.10 is actually implemented (read it in
  full — this plan has not yet opened that file).
- Modify: the `gather` action (confirmed to already exist as an `ActionKind` and already routed in
  `budget.mjs:105` per the survey) to actually produce the HGoB-Construction gain — find where
  other action kinds produce their effects and add this one alongside.
- Test: `test/unit/resources.test.mjs`.

**Interfaces:**
- Consumes: Task 1's `multiplyDice` for source 2.
- Produces: `hgobConstruction` resource on Semiramis's own actor, readable by Task 31's channel
  requirement (`resourceAtLeast`).

- [ ] Read `module/rules/resources.mjs` (or wherever §6.10 lives — locate it first) completely.
- [ ] Author the resource block, wire `Gather`'s gain, wire the region-multiplier logic against
      `module/rules/environment.mjs`'s existing region-adjacency helpers (already read this
      session for Bug #1's Region-bonus work).
- [ ] Failing tests for each of the six sources plus the multiplier, using the existing resource
      test fixtures.
- [ ] `npm run validate:content`.
- [ ] **Live checkpoint:** summon her in a Middle-East-region world setting, confirm the counter
      starts at 25; use Item Construction, a non-Item-Construction Skill, and `Gather` (as
      Semiramis, as her Master, and as a third ally) each once, confirm each adds the right
      (region-doubled) amount; end a Round, confirm the `1d4+2` tick fires.
- [ ] Commit.

### Task 31: The channelled activation ability

**Files:**
- Create: `packs/_source/abilities/semiramis-hanging-gardens-of-babylon.yml`, using Task 12's
  channel kind and Task 4's `ExemptFromZon` (for the activation's own ZON exemption, distinct from
  the ownerEffect's — re-read line 130: *"Semiramis can perform the activation without being in
  her Master's ZON"* is about the ACTIVATION requirement, separate from the platform's ownerEffect
  which is about ongoing ZON exemption while aboard — two separate uses of the same element,
  confirm both are needed or whether one subsumes the other).
- Requirements: in her Faction's Home Base, `hgobConstruction >= 100`. `costTiming: onSuccess`
  (Master Health loss only on successful activation, per NP-cost rules — reuse whatever cost
  mechanism `npCost`/`costIntents` already provide, gated to fire only on the channel's success
  callback).

- [ ] Author the file.
- [ ] `npm run validate:content`.
- [ ] **Live checkpoint:** with Construction at 100 and Semiramis in her home base, activate;
      confirm she cannot act for 3 turns, confirm attacking her during that window interrupts and
      resets the counter (re-verify by starting again from 0 elapsed, not resuming), confirm a
      full uninterrupted 3-turn channel completes and only THEN charges her Master's NP-usage
      Health cost.
- [ ] Commit.

### Task 32: The platform, full authoring

**Files:**
- Rewrite: `packs/_source/platforms/hanging-gardens.yml` completely, using Tasks 4, 8, 9, 10, 13,
  14, 15, 16.
- Content: footprint 9x9 (11x11 large board, using whatever `*ByBoardSize` mechanism this plan's
  earlier tasks decided on — if no task above built a generic `*ByBoardSize` field pattern yet,
  build the minimal version needed here now, reading `module/settings.mjs`'s `boardSize` setting
  first), Health 6000/Agility 0/Luck 0/MOV 2 (3 large), `baseAttack: { unit: "owner", component:
  mag }`, `capacity: null`, the Throne Room subZone (5x5, centered), `ownerEffects` as an array of
  rule elements attached to the OWNER (Semiramis) on activation — the RankShift (Task 8),
  ExemptFromZon (Task 4), SustainabilityModifier +2◈ (Task 9), TerritoryCreationScope EX/C
  (Task 10) — verify HOW an "ownerEffect" actually gets applied: as an ActiveEffect created on the
  owner actor at `activatePlatform` time (this session's survey found `reverseOwnerEffects` already
  deletes any ActiveEffect on the owner whose `sourceUnitId === platform.id` — so the CREATE half,
  at activation, is this task's job; find `engine/platforms.mjs`'s `activatePlatform` and add it
  there if missing), the two attacks (Dragon Wing Warriors, Aerial Garden of Vanity — using Tasks
  14/15/16), boarding (1d12/12, the modifiers from lines 159-163, already hardcoded correctly in
  `rules/platforms.mjs`'s `boardingTarget` per the survey — this task supplies the AUTHORED numbers
  that function's defaults already match, closing the loop from "hardcoded" to "authored"),
  falling/jumping (verify these are `rules/platforms.mjs`'s `fallOff` per the survey, else build),
  destruction (triggers `[ownerDefeated, healthZero]`, passenger save, 100 fixed STR damage on
  fail, `dismissSummons: [basmu]` — confirmed generic already via `dismissOnZoneRemoval` from Task
  28, `rebuildable: true`, `onDestroy: reset Construction to 0`).
- Test: `test/unit/platforms.test.mjs` (34 existing tests, per the survey — extend, do not
  replace).

- [ ] Read `module/engine/platforms.mjs`'s `activatePlatform` and `module/rules/platforms.mjs`'s
      `destructionSequence`/`boardingTarget`/`fallOff` completely before writing content.
- [ ] Rewrite the platform file with every field above.
- [ ] Wire `activatePlatform`'s owner-effect application if it is not already generic (this
      session's survey found the REVERSAL generic but did not confirm the CREATION side).
- [ ] `npm run validate:content`.
- [ ] **Live checkpoint (the big one):** with the channel from Task 31 completing successfully,
      confirm: the HGoB token places where she stood, she moves to center, chosen allies board;
      her parameters/Base Attack/Health/MOV/Agility/Luck all shift exactly per lines 135-139; ZON
      no longer applies to her; Sustainability is +2◈; Territory Creation reads EX for the whole
      HGoB and C for her ground home base (revisit Task 21's deferred assertion here). Fire both
      platform attacks and confirm Dragon Wing Warriors' multi-hit/single-Injury-Roll behavior and
      Aerial Garden of Vanity's range exclusion. Have an enemy attempt boarding at various AGI/LUC
      ranks and confirm the modified target numbers. Reduce the HGoB to 0 Health (or defeat
      Semiramis) and confirm the full destruction sequence: passenger saves, scatter, owner-effect
      reversal (her stats revert), Bašmu (if summoned) is dismissed, Construction resets to 0, and
      she can begin rebuilding.
- [ ] Commit.

**Phase 8 checkpoint:** `npm test && npm run lint && npm run validate:content && npm run
check:templates && npm run check:manifest` all clean.

---

## Phase 9 — Close-out

### Task 33: Full-kit end-to-end live playtest

Not a new mechanic — a single continuous session in `FGT_2026` exercising Semiramis's ENTIRE kit
together, to catch the interaction bugs no single-ability checkpoint above would surface: DSC
variant correctness feeding every gated ability at once, Item Construction poison feeding both
Arrogant King's Poison's cost AND Queen's Poison simultaneously, the HGoB cycle running alongside
Sikera Ušum's Throne-Room-scoped branch, Bašmu existing and being dismissed correctly on HGoB
destruction mid-battle, Familiar: Doves' cooldown reduction actually shortening the HGoB
activation's own re-attempt cadence after an interruption.

- [ ] Summon her twice (force both DSC branches if the coin-flip formula allows a forced result
      for testing, else summon repeatedly until both are observed) and confirm every gated
      ability's behavior differs correctly between the two.
- [ ] Run one complete build→activate→interrupt→rebuild→activate→destroy cycle for the HGoB.
- [ ] Confirm no console errors accumulate across the whole session (per this session's own
      established verification habit: `mcp__chrome-devtools__list_console_messages` with
      `types: ["error"]`).
- [ ] Leave the world in a clean state afterward (revert any test-only actor/world-setting changes
      the same way this session's earlier bug-fix work did).

### Task 34: Docs

Per this session's own established convention (and the user's standing instruction): the specific
chapter changes, not only Ch. 45's log.

- [ ] `docs/45-implementation-status.md`: content tally becomes "9 of 29 Servants"; add every new
      engine mechanism (Tasks 1-17) as a "Done" or "~~X~~ — repaired"-style entry, matching the
      existing format this session already used twice.
- [ ] `docs/32-case-semiramis.md`: mark it as **implemented**, correcting every place its proposed
      YAML diverged from what actually got built (there will be some — this plan explicitly
      preferred real current code over the doc's sketches throughout).
- [ ] `docs/20-platforms-and-levels.md`: §20.4's HGoB section, §20.10's platform-attacks section —
      mark implemented, correct any divergence.
- [ ] `docs/05-ranks-and-parameters.md` §5.6/§5.7: the extended `RankShift` form (Task 8).
- [ ] `docs/06-stats-and-resources.md` §6.8: `SustainabilityModifier` (Task 9); §6.10: the `gather`
      action's resource-gain wiring (Task 30) if §6.10 is where resource gain triggers live.
- [ ] `docs/09-targeting.md`: the compound anchor (Task 15).
- [ ] `docs/15-abilities.md`: `bypassChanceModifiers` (Task 3), item-quantity costs if newly
      confirmed (Task 25).
- [ ] `docs/24-rules-engine.md`: every new rule-element key, in whatever table already lists them
      (this session found one at line 109 for `SustainabilityModifier`'s sibling entries).
- [ ] `docs/D-servant-data-sheets.md`: add her entry alongside the other eight.
- [ ] Final full verification: `npm test && npm run lint && npm run check:templates && npm run
      check:manifest && npm run validate:content && npm run build:packs`.
- [ ] Commit.

---

## Self-Review Notes

**Spec coverage:** every numbered mechanic in `char_orig_sheets/Copia de Semiramis.md` (lines
1-176) maps to a task above — summon-time variant (T11/T18), Presence Concealment (T19), Item
Construction (T20), Territory Creation (T21), Divinity (T22), Double Summon (T23), Familiar: Doves
(T17/T24), Arrogant King's Poison (T25), Scales of the Sacred Fish (T26), Summoning: Bašmu
(T27/T28), Sikera Ušum (T29), Hanging Gardens of Babylon in full (T4/T8/T9/T10/T12/T13/T14/T15/
T16/T30/T31/T32).

**Honesty about uncertainty:** several tasks above explicitly flag "read X before assuming Y" or
"verify against real code, not docs/32's sketch" rather than inventing precise-looking
signatures for subsystems this planning pass has not yet opened (the resource-gain-trigger
system, the bounded-field zone-phase vocabulary, the predicate/expression grammar, the dice-
formula registration pattern, the coin-flip content convention). That is deliberate: this plan is
executed by the same agent that wrote it, in one continuous session with full codebase access, so
front-loading those reads into each task's own first step is more reliable than guessing now and
having later tasks silently depend on a wrong guess.

**Placeholder scan:** no task ends in "add appropriate handling" or "similar to Task N" without
the actual content; every content task cites exact source-sheet line numbers and exact numbers.

---

**Next:** offer execution choice to the user.
