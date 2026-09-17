# 15 — The seven-step effect application pipeline

## What it is

An effect application is a seven-step decision tree that turns a request to apply an effect into a resolved intent (or rejects the request). The order of the steps is the mechanism: immunity is checked before chance, stacking is resolved before construction, and a single failed gate stops the entire chain and records a reason for the audit trail.

Every step emits a trace entry — *"Curse resisted (rolled 78 vs 65%)"* or *"Charm blocked by Berserk"* — so the chat card never silently discards an application. The pipeline is pure; the caller supplies the chance roll, as everywhere else in the rules layer (`module/engine/effect-applier.mjs:1-12`).

## Where it lives

| File | Role |
|---|---|
| `module/engine/effect-applier.mjs` | The seven-step pipeline and the public `applyEffect` entry point |
| `module/engine/applier.mjs` | `resolveEffects` — the adapter that bridges bare intents to the full pipeline (`module/engine/applier.mjs:247-361`) |
| `module/rules/removal.mjs` | Removal resistance and the logic for buff dispel — a _deletion_ pipeline with its own stacking (`module/rules/removal.mjs:1-27`) |
| `module/rules/checks.mjs` | `applicationChance` — the function that computes landing chance at step 3 |
| Domain primitives | `currentHealth`, `parseTick`, `resolveTicks` — read by step 6 (CONSTRUCT) |

## How it works

### Entry point

The pipeline is exposed as `applyEffect()` (`module/engine/effect-applier.mjs:60-349`), which takes an effect definition, a target snapshot, and context including the chance roll. The caller must supply the roll; every step is deterministic given the roll.

For unresolved `applyEffect` intents that arrive at the applier boundary, `resolveEffects()` (`module/engine/applier.mjs:247-361`) fetches the definition, takes a snapshot of the target from the board (which includes field-scoped suppressions), rolls its own `1d100`, and calls `applyEffect`. This path exists because three call sites write effects without going through `applyWorldIntents` — the attack flow, the scheduler's boundary sequences, and the movement hook — and running the pipeline in one of them would leave the other two applying bare intents, repeating logic (`module/engine/applier.mjs:77-82`).

### Step 1: Immunity gate

A target holding a matching immunity (e.g., `Poison Immune`, `Debuff Immune`, or a scoped immunity like `vDebuffImmune`) refuses the application outright (`module/engine/effect-applier.mjs:85-102`).

The gate checks three sources: effect-specific immunity (`immune:<effectId>`), class-skill immunities carried in the target's `immunities` array, and scoped rules like *"immune to debuffs"* or *"immune to volatile debuffs"* (`module/engine/effect-applier.mjs:495-525`).

**Exception: Self/ally bypass.** A debuff with `allySelfBypassesResistance` — `Decoy` and `Decoy (Scapegoat)` — skip immunity entirely when the caster and target match or share a faction. The reasoning: Decoy is defensive and used on oneself to feed a counter; one's own Debuff Immune would otherwise block one's own tool. Steps 2 (exclusivity) and 5 (stacking) still run; only immunity and resistance (steps 1 and 3) are skipped (`module/engine/effect-applier.mjs:75-102`).

**Sikera Ušum clause d: downgrade, not refusal.** A field's `ImmunityDowngrade` suppression can downgrade `Poison Immune` to `Poison Resist`, changing step 3's resistance value rather than blocking here. The instance inherits the immunity type; the gate returns null if a downgrade covers it (`module/engine/effect-applier.mjs:87-102`).

Outcome: `passed` or `blocked`. If blocked, the chain stops; the result carries the blocking effect's name.

### Step 2: Replacement / exclusivity gate

Three checks run in sequence (`module/engine/effect-applier.mjs:104-114`):

1. **Replacement:** Does this effect replace others? `def.replaces` lists effect ids it will displace. If any are held, replace them — an intent to remove the old and an intent to apply the new. The check passes because replacement is not refusal.

2. **Blocked by:** `def.blockedBy` lists effects whose presence refuses this one outright. The gate fails if any are held.

3. **Blocks:** `def.blocks` lists effects this one refuses. If any are held, the gate fails.

4. **Mental exclusivity:** Charm, Confuse, and Berserk are mutually exclusive; any one held blocks the others (`module/engine/effect-applier.mjs:29-34`).

5. **Sleep derivatives:** `Nightmare` and `Coma` each replace `Sleep` but not each other; a unit carrying a derivative takes neither Sleep nor the other derivative (`module/engine/effect-applier.mjs:36-37`, `module/engine/effect-applier.mjs:577-584`).

Outcome: `passed`, `replace`, or `blocked`. If blocked, the chain stops with the name of the conflicting effect.

### Step 3: Chance roll

Does the effect succeed against the target's resistance? (`module/engine/effect-applier.mjs:116-170`).

The chance is computed from: the ability's stated chance (overriding the effect's `baseChance`), plus per-effect modifiers the ability declares (Medea's Atlas is the reference case: two separate `-25%` reductions that stack), plus the target's outgoing `ApplicationChance` contributions (`inflictBonus`, read from the attacker if present), minus the target's `ApplicationChance` resistances (`resist`).

Per-effect modifiers are skipped if the ability marks them bypassed (Queen's Poison's extra stage is *"flat 50%… not affected by debuff chance… effects"*) or if the caster is friendly (`module/engine/effect-applier.mjs:127-155`).

The roll is supplied in context. An automatic effect (≥100%) lands without rolling. Otherwise, the roll must be ≤ chance percent to succeed (`module/engine/effect-applier.mjs:156-170`).

Outcome: `passed` or `resisted`. The trace records the roll and all modifiers in the event it fails.

### Step 4: Prevention window

An offered prevention (`Luck Check`) pauses the application and returns a prompt intent. Only offered once per Combat Process and never against terminal effects (`module/engine/effect-applier.mjs:172-182`).

If not offered, execution continues to step 4b. If offered, the result is `noop` and intents carry a prompt request.

### Step 4b: Magnitude scale

Scales the magnitude and NP magnitude based on the target's `magnitudeScales` — passive rules like Raikou's Martial Arts Discipline (*"the magnitude of all Atk Dwn effects on Raikou is halved"*). Applied here rather than at read time so the effect chip and audit card show the scaled number the unit actually carries (`module/engine/effect-applier.mjs:184-221`).

The scale list specifies `direction` (default `"incoming"`), `effects` (specific ids), or `family` (all effects in that family). Scaling rounds down, the direction that favours the bearer (`module/engine/effect-applier.mjs:203-221`).

The NP magnitude, if present, scales with it; it is the same magnitude in a different context, not a separate unscaled figure (`module/engine/effect-applier.mjs:198-201`).

Outcome: always `passed` or `scaled` (if one or more scales applied).

### Step 5: Stacking resolution

Determines whether the effect is created, refreshed, extended, staged, or ignored (`module/engine/effect-applier.mjs:223-232`).

The stacking rule — `noneNoRefresh`, `noneRefresh`, `noneExtend`, `stage`, `magnitudeStacks`, `highestOnly`, or `count` — is read from the definition. `noneNoRefresh` is the default (`module/engine/effect-applier.mjs:596-652`).

- **`noneNoRefresh`:** If the effect is held, no-op (do not apply again). Otherwise create.
- **`noneRefresh`:** Create if absent; refresh the duration if present.
- **`noneExtend`:** Create if absent; extend the duration if present.
- **`stage`:** Increment the stage by the application's stage count (normally 1, but Serenity's Zabaniya is *"Stage 3 Poison"* in one application, rolled once not three times). Create at stage 0 if absent.
- **`magnitudeStacks`:** Create a new instance beside existing ones, summing magnitudes at read time. A max-stacks ceiling (Kingprotea: maximum 10 Proliferation stocks) returns no-op if at the ceiling.
- **`highestOnly`:** Keep only the strongest magnitude; a weaker incoming application is a no-op.
- **`count`:** Increment a charge counter (`uses`); each application adds charges specified by `def.uses` or the intent's `applyUses`.

Outcome: `create`, `refresh`, `extend`, `stage`, `replace`, `count`, or `noop`. If `noop`, the chain stops without creating.

### Step 6: Construct

Builds the effect instance document (`module/engine/effect-applier.mjs:234-286`).

**Duration & expiry:** Resolved from the authored duration (ability's override, or effect's `defaultDuration`, or `null`). A duration of `null` means no expiration; the effect is removed by a Cure, by consumption, or by its own clause. A `0` duration (thisRound) is **not** a disastrous default for "unstated" — it found one live: Poison was applied, staged to 1, and swept at the end of the round having dealt nothing. The authored duration is stored as an **absolute expiry tick**, not a countdown, so Stop's clock freeze and mid-game ◈ changes cannot corrupt it (`module/engine/effect-applier.mjs:235-255`).

Duration bonuses — e.g., Mannanán's *Tradition Carrier* (*"duration of buffs extended by ⅓◈ extra Turns"*) — are added to the tick count, not to an already-started clock. An effect with no clock is not given one (`module/engine/effect-applier.mjs:249-254`).

When step 5 resolved to `extend` (a `noneExtend` effect reapplied onto an existing instance), the new expiry is the **existing instance's expiry plus** the newly resolved duration, not `currentTick + duration` — a reapplication extends the clock already running rather than restamping it from now (`module/engine/effect-applier.mjs:245-253`).

**Terminal effects:** A `terminal` effect (Instakill, Death, Erase) emits intents rather than creating an instance. It is a consequence, not a carried state — a Health loss for Instakill (which allows Guts and Endure to react), a `defeat` intent for Death (which *"ignores all revival effects"*), or `defeat` with cause `"erase"` for Erase (which excludes the Servant from the Grail counter) (`module/engine/effect-applier.mjs:290-437`).

Outcome: always `applied` (or `noop` if stacking ruled it out earlier). The instance carries: magnitude, NP magnitude, stage, uses, expiry, applied tick, source unit/ability/field ids, polarity, volatility, unremovable flag, visibility, and attribution-hidden flag.

### Step 7: Emit

Creates removal intents for replaced effects, an event intent if the stage changed, and the `applyEffect` intent, marked `resolved: true` to prevent re-expansion at the applier boundary (`module/engine/effect-applier.mjs:288-349`).

Outcome: `applied`. The `intents` array carries every intent this application emitted.

## Invariants & edge cases

1. **Immunity is checked before chance.** Step 1 runs even when chance is 0, and chance step 3 does not re-check immunity. If both apply, immunity wins (`module/engine/effect-applier.mjs:85-170`).

2. **Replacement is checked before blocking.** A pair declaring both `replaces` and `blocks` does not refuse itself; replacement happens first (`module/engine/effect-applier.mjs:554-559`).

3. **Terminal effects never create instances.** Instakill, Death, and Erase emit intents and return. A corpse never carries an "Instakill" badge (`module/engine/effect-applier.mjs:298-301`).

4. **Magnitude scale applies to NP magnitude too.** A scale targets the magnitude, and NP magnitude is that same magnitude in a different context; both scale together (`module/engine/effect-applier.mjs:198-215`).

5. **Per-effect modifiers are skipped for friendly applications.** The self/ally bypass skips both resistance AND the ability's own declared modifiers (`module/engine/effect-applier.mjs:127-145`).

6. **Stacking actions that replace require removal intents.** `refresh`, `extend`, and `stage` must remove the old instance first; `create` and `noop` do not (`module/engine/effect-applier.mjs:313-315`, `module/engine/effect-applier.mjs:446`).

7. **A stage-change event fires only when stage actually changes.** The event carries the prior stage and the delta (`module/engine/effect-applier.mjs:336-344`).

8. **Resolved intents are not re-expanded.** An intent marked `resolved: true` is passed through by `resolveEffects`; it skips the entire pipeline (`module/engine/applier.mjs:277-278`).

## Traps and anti-patterns

**Deciding the stacking action without letting it change what follows.** Step 5 correctly resolved
`noneExtend` reapplication to `action: "extend"`, but step 6's expiry math read only the authored
duration and the current tick — `(ctx.currentTick ?? 0) + ticks` — the same formula used for
`refresh`. The two are not the same clause: `range-up.yml:11-14` reads *"does not stack, but
duration is extended if reapplied"*, and extending means adding to the clock already running, not
restamping from now. A `noneExtend` effect reapplied partway through its life lost whatever time it
had left — measured, a 6-tick instance reapplied at tick 2 landed on tick 8 (refresh's answer)
instead of tick 12 (extend's). `atk-up-trace.yml`, `suppression.yml`, and `webbed.yml` share the same
`stacking: noneExtend` and were exposed the same way. Filed and fixed as
[#23](https://github.com/zarex97/FGT_FVTT_v2/issues/23): step 6 now branches on `stack.action`,
adding the new duration to the existing instance's `expiry` when it is `"extend"`, and only falling
back to `now + duration` for a first application or any other action
(`module/engine/effect-applier.mjs:245-253`). **A stacking action decided in step 5 is a value other
steps must read, not just a label attached to the outcome.**

## Open questions

- **Resolved: seven named steps, with 4 split into a gate and a scale.** The count is a naming
  convention, not an ambiguity. Prevention (4) can return early, and when it does the magnitude
  scale (4b) does not run — which is the right order, since an application that was prevented has no
  magnitude to scale. Reading the switch confirms the sequence; there is no state in which 4b runs
  without 4 having passed.

- **Confirmed live: suppressions come from the board pass, and only from there.** Both projections
  carry a `suppressions` key, but it is the board re-pass that fills it —
  `u.suppressions = again.suppressions` (`module/rules/snapshot.mjs:877`), re-collected with field
  membership in scope. Compared directly on a live board, the board unit carries **14 keys the
  actor-only snapshot does not**, including `fields`, `terrain`, `inHomeBase`, `compulsions` and
  `decoy`. This is why `resolveEffects` builds its target from the board
  (`module/engine/applier.mjs:266-273`): an actor-only subject has no suppressions at all, which is
  how Sikera Ušum's immunity downgrade once failed to downgrade anything.

- **The immunity downgrade does not refund resistance as resistance.** Sikera Ušum clause d's downgrade adds a flat resist percent at the chance step rather than keeping the instance un-immune. An alternative reading (reducing the immunity to immunity-light) would gate slightly differently; the current reading is what the code does.

- **Seven or nine steps?** The Prevention Window (step 4) returns early, and Magnitude Scale (4b) is nested inside it. An alternative reading is 1-2-3-[4a-return]-[4b]-5-6-7, making five or six top-level steps. The code marks both and the file header claims seven, so this is the canonical reading, but an ADR would clarify the intended scope.

- **The downgrade is suppression-scoped, not field-scoped.** A field's `ImmunityDowngrade` produces suppressions at the time the target is snapshotted. A unit that moves out of the field does not lose the downgrade; the instance itself is neither field-tied nor re-annotated. This is the current behaviour; a future enhancement might tie immunity downgrades to the field's lifetime.
