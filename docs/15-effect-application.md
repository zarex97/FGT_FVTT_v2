# 15 — The seven-step effect application pipeline

## What it is

An effect application is a seven-step decision tree that turns a request to apply an effect into a resolved intent (or rejects the request). The order of the steps is the mechanism: immunity is checked before chance, stacking is resolved before construction, and a single failed gate stops the entire chain and records a reason for the audit trail.

Every step emits a trace entry — *"Curse resisted (rolled 78 vs 65%)"* or *"Charm blocked by Berserk"* — so the chat card never silently discards an application. The pipeline is pure; the caller supplies the chance roll, as everywhere else in the rules layer (`module/engine/effect-applier.mjs:1-12`).

## Where it lives

| File | Role |
|---|---|
| `module/engine/landing.mjs` | **Landing** — the one door every Effect Entry comes through: `landEntry` (gate, count, applications) and `landEffect` (one application). The only caller of `applyEffect` |
| `module/rules/effect-flow.mjs` | The Effect Entry: `ENTRY_KEYS`, `entryOf`, `chanceOf`, `timesOf`, `applicationsOf`, `effectGatePasses` |
| `module/engine/effect-applier.mjs` | The seven-step pipeline and the public `applyEffect` entry point |
| `module/engine/applier.mjs` | `resolveEffects` — the adapter that hands an unresolved intent to Landing; `riderOptions` — the attack's options an event rider's effect is tested against (`attackOptions`, copied onto the effect by the scheduler's `ApplyEffect` action; Ch. 11, #127) |
| `module/rules/removal.mjs` | Removal resistance and the logic for buff dispel — a _deletion_ pipeline with its own stacking (`module/rules/removal.mjs:1-27`) |
| `module/rules/checks.mjs` | `applicationChance` — the function that computes landing chance at step 3 |
| Domain primitives | `currentHealth`, `parseTick`, `resolveTicks` — read by step 6 (CONSTRUCT) |

## How it works

### Landing: one door for every path

An **Effect Entry** (CONTEXT.md) is what content authors to give an Effect, wherever it writes it: an ability's `applyEffects` phase, a check's outcome, an aftermath, a Riding self-rider, an optional cost, a handler's `ApplyEffect` action, a bounded field's interior rule. Eight paths used to each assemble `applyEffect`'s arguments, and each read a different subset of the entry: `uses` only on the intent path, `stages` not on a check's outcome, no ring or per-panel chance on a Skill, an entry `predicate` only on a Skill. About thirteen Surprises were that drift. Wave B (2026-10-14) put every path through `module/engine/landing.mjs`.

`entryOf(raw, {phase, rule})` turns any authored shape into one entry, keeping only the keys `ENTRY_KEYS` lists (the inner `effect:` wins over what is written beside it; a phase's `ignoresResistanceFrom` is merged in). `landEntry(entry, ctx, {write, reread})` then, for one recipient:

1. **Gate.** The entry's own `predicate`, asked with the caster **as the board sees it**, so a gate on where the caster stands can pass (Great Ram Nautilus's Aim only in Waterside).
2. **Count.** `applications` separate applications; `times` is charges on a `count`-stacked effect and applications on any other (`timesOf`: a number, `{perStack}`, or an event field such as Gogh's `"@stageDelta"`, taken whole). The recipient is re-read between applications, after each is written.
3. `landEffect` for each application:
   - **magnitude**, resolved once (`countTargets`, then a number or an `@` expression against the caster, with a ride's facts; `npMagnitudeFactor`);
   - **one option set** — `attack:` options only when an attack delivers the entry (or the `attackOptions` an intent carried);
   - **chance** — `chanceOf`: per panel, then the ring, then the flat chance; the distance is caster to target unless the Combat Process measured it;
   - **the die only when the chance can fail.** `applyEffect` is asked first with a die that always misses; a certain chance lands without a roll. A die a handler or a field already rolled (`rolled`) is used instead;
   - `applyEffect` with every key;
   - the **Prevention Luck Check** (below);
   - `onApply` when the instance was created (Shock's −3 current Agility, on every path now), an `effectResisted` log line when resisted, and the emitter's own expiry (`mergeEmitted`) for an intent;
   - **one summary row**, which is the line the card prints (`rules/card-visibility.mjs#effectLine`).

`landEffect` decides and does not write; `landEntry` writes through the caller's `write`, so each path keeps its own batch source. `test/unit/landing-one-door.test.mjs` fails if anything but `landing.mjs` calls `applyEffect`, if the door reads a key `ENTRY_KEYS` does not list (or misses one it lists), or if content writes an entry key outside the list. The build refuses one too, naming its path (`tools/lib/content.mjs#entryKeysAreKnown`, #342): on a phase's entry, a wrapper's `effect` and what it writes beside it, an `otherwise`, a check's outcome, an aftermath, a handler's `ApplyEffect`, and a Servant's embedded ability. Both walk entries through one walker, `effectEntriesIn`. Balmung's `countedOnly`, authored before the list held it, built clean and landed at 0.

**A field rolls one die.** A field's interior `ApplyEffect` rolls its stated chance for the field's card and forwards the die and the chance, so Landing subtracts the target's resistance from the same chance against the same die. Contagion rolled four dice for two chances and met resistance only on the second.

**The door notes what it landed.** A `LandingContext` may carry `useRecord`. `landEntry` then notes each landing on it, and each `otherwise` fallback too, as `{defId, polarity, outcome, targetId}`. The polarity is the landed one, which `landEffect` returns beside its outcome. A use's `effectsApplied` and `debuffsInflicted` are counted from these notes (#320), never from card rows.

### Entry point

**The definition the gates read is the landed one** (#315). Landing passes `applyEffect` the definition with the polarity this application decided (`rules/effect-instance.mjs#landedDefinition`, Ch. 14). It also asks `admit` for any `boardUnique` instance the landing replaces. The record `applyEffect` builds carries that polarity, and `io.createEffects` stores it.

The pipeline is exposed as `applyEffect()` (`module/engine/effect-applier.mjs`), which takes an effect definition, a target snapshot, and context including the chance roll. The caller must supply the roll; every step is deterministic given the roll. Its only caller is Landing.

For unresolved `applyEffect` intents that arrive at the applier boundary, `resolveEffects()` (`module/engine/applier.mjs`) reads the intent as an entry (`entryOfIntent`) and lands it with the target from the board (which includes field-scoped suppressions). An `until <event>` duration is the one thing besides `expiry` the intent hands the entry (`duration`, #208 reading 12): the scheduler's `ApplyEffect` stamps it, `entryOfIntent` forwards it, and the flow records `endsOn`. Removals meet at the same boundary: `resolveRemovals` pays an effect's `onRemove` for every removal but an expiry (already paid) and a refresh or replacement (Ch. 14). This path exists because three call sites write effects without going through `applyWorldIntents` — the attack flow, the scheduler's boundary sequences, and the movement hook — and running the pipeline in one of them would leave the other two applying bare intents. `applyIntents({process})` carries the Combat Process a handler's rider lands inside (`damageDealt`, `damageTaken`, `damageStepEnd`), so its target may be offered Prevention too.

**The attack path takes both subjects from the board too (#157).** `applyAbilityEffects` builds the attacker and the defender once per Combat Process with `riderSubjects(state)` (`unitFrom(boardSnapshot(), doc)`, which falls back to a standalone projection for a Unit the board has no row for), and `applyDeclaredEffects` takes its attacker from the board, so a bounded field's `ApplicationChance` and Immunity downgrade, and an aura's outgoing bonus, reach a rider: they are written only by `snapshotBoard`'s pass, which a bare `unitSnapshot` never ran. Doomsday Come's *chance of being inflicted by debuffs +50%* is the case that shows it (a 50% rider rolled at 60 is `resisted` on the bare snapshot and `applied` on the board's Unit); the same shape §46.4-AF fixed at `fireDamageStepEnd` and §46.4-AG at the intent path.

### Step 1: Immunity gate

A target holding a matching immunity (e.g., `Poison Immune`, `Debuff Immune`, or a scoped immunity like `vDebuffImmune`) refuses the application outright (`module/engine/effect-applier.mjs:85-102`).

**A counted Debuff Immune waits for the die** (#348 rulings 6, 14, 15). Jewel of the Earth's *"Debuff Immune ... 2 times"* is `debuffImmune` with `uses: 2, stacking: count`. When the only immunity refusing a debuff is a scoped one whose instance holds charges, the gate defers: a debuff whose die missed is resisted and spends nothing; one that landed, or lands for sure, is refused and spends one (`consumeUse`), the die on the card (`effect-applier.mjs#countedImmunity`). An uncounted one, or any other immunity, refuses before any die, as before.

The gate checks three sources: effect-specific immunity (`immune:<effectId>`), class-skill immunities carried in the target's `immunities` array, and scoped rules like *"immune to debuffs"* or *"immune to volatile debuffs"* (`module/engine/effect-applier.mjs:495-525`).

**A status is not a buff.** The gate refuses a *buff* under `No Buff` and under a buff-scoped immunity, a *debuff* under the debuff families, and a `polarity: status` effect under neither (`def.polarity === "buff"` is what it asks). That is how Riding's Active is *"not a buff … or prevented by an effect that prevents buffs from being applied"* for Medusa, Drake and Pollux, whose Active is a used ability that applies the `ridingActive` effect: it is authored `polarity: status` (Appendix A §A.16), and was `buff` until #119, when No Buff stopped the Active applying anything and took the grants it unlocks with it. The MovDelta's `isBuff: false` is the modifier's own declaration and is read by nobody (#103); the effect's polarity is what the gate reads. **S.Crit Up is an aura its caster holds** (ruled 2026-10-06, #132). Its *"cannot be prevented"* means it is not removed from the Units it reaches: it is removed from its holder, as an aura is ended at its source. The caster takes the `sCritUp` effect, at chance 100, and its `Aura` raises the Crit Chance of every ally within 2 panels, gained walking in and lost walking out (Ch. 12). The holder's copy carries `bypassesImmunity`, because No Buff on the holder stops nothing; each recipient's No Buff or buff Immunity refuses its share. Two sources stack. `sCritUpPollux` also reaches the linked partner, and `sCritUpStormBorder` (Journey's Guidance under Zero Sail) every ally on the Storm Border. **Rho Aias is a status** (#132): a barrier EMIYA projects, not an upgrade, so No Buff does not refuse it; it was a buff at chance 500.

**No self/ally bypass** (ruled 2026-10-06, #132). An effect from the target's own side meets its immunity, its resistance and the ability's declared modifiers like any other, and the applier's own outgoing bonus still counts. `Decoy` and `Decoy (Scapegoat)` skipped all three when self- or ally-applied (`allySelfBypassesResistance`); the key is gone from the schema, the registry and both files.

**Exception: an effect that bypasses.** `bypassesImmunity` passes every class of immunity (Debuff Immune and its scoped kin) at this gate, though not one that names the effect itself; `bypassesResistance` zeroes step 3's resistance. The 'Kiritsugu' debuff carries both: it *"ignores Debuff Resist and Debuff Immune effects"*. Neither flag was kept by the schema, and the immunity flag was read only by step 3, after this gate had already refused (#98). Debuff Immune itself gates through its rule's `scope: debuffs` and `except` list (#103).

**Sikera Ušum clause d: downgrade, not refusal.** Its other half halves a resistance that **names** Poison, and only that: a resistance to volatile debuffs or to all debuffs covers Poison and is left whole (§46.4-BH). A field's `ImmunityDowngrade` suppression can downgrade `Poison Immune` to `Poison Resist`, changing step 3's resistance value rather than blocking here. The instance inherits the immunity type; the gate returns null if a downgrade covers it (`module/engine/effect-applier.mjs:87-102`).

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

**A resistance scoped out by its source.** `ctx.ignoresResistanceFrom` names the slugs of contributions this application skips (`chanceContribution`). It is read on the check path (Medusa's Mystic Eyes) and, since #199, on the post-damage rider loop as well, from the phase or the one effect: Zabaniya's phase names `magicResistance` (*"not affected by Magic Resistance"* covers its debuffs), and Kiritsugu's Mark names `debuffResUp`. The rider loop never read it, so the Mark met Debuff Res Up from the day it was authored.

**Every caller reads the resistance off the target, and none states it.** `ctx.resist` is an override with no legitimate supplier: `applyEffect` computes `ctx.resist ?? resistanceOf(target, ...)`, and `0 ?? x` is `0`, so a caller that passes `resist: 0` switches the target's resistance off. The attack path's context (`module/engine/attack.mjs`), the Skill path's (`skillEffectContext` in `module/engine/skill-use.mjs`) and the event-rider adapter's (`resolveEffects` in `module/engine/applier.mjs`) all leave the key out. The Skill path had not: every debuff from a Skill that deals no damage (Jack's Information Erasure, Medea's Atlas, Gogh's Het Gele Huis) ignored its target's Magic Resistance, Item Construction and the rest, and a Skill that applies a debuff to its own caster now meets the caster's resistance too (#123) -- which leaves Gogh's Imaginary Numbers Arts automatic (it states `chance: 500` for exactly that) and Anastasia's Watermelon Blind automatic as well, her Fae Contract being +5 outgoing and +5 incoming. `test/unit/skill-path-resistance.test.mjs` fails on a `resist:` key anywhere in `module/engine` outside the applier.

Per-effect modifiers are skipped if the ability marks them bypassed (Queen's Poison's extra stage is *"flat 50%… not affected by debuff chance… effects"*), and never because the caster is friendly (#132).

The roll is supplied in context. An automatic effect (≥100%) lands without rolling. Otherwise, the roll must be ≤ chance percent to succeed (`module/engine/effect-applier.mjs:156-170`).

Outcome: `passed` or `resisted`. The trace records the roll and all modifiers in the event it fails.

**One chance, one die (#191).** An event handler's action-level `chance` (Nemo's 10% Slow) is rolled by `dispatch` and filed on the card; the die travels on the instance as `effect.rolled` and the applier reads it instead of rolling again, with the target's resistance and the inflicter's bonus applied to that same die. The dispatch gate leaves an `ApplyEffect`'s verdict to the application. It used to roll twice: a card reading *"1 against 10%: hit"* applied nothing.

**An entry's own predicate reads the caster as the board sees it (#191).** The Skill path tests a per-entry `predicate` against `phaseCtx.self`, the board-derived caster, so `self:terrain:*` and `self:onPlatform:*` are answerable there as they are for the phase gates and the cooldown branch. A bare snapshot left Voyager of the Storm's Waterside Atk Up unappliable.

**A resisted rider says so** (#195). The rider's chance roll is filed after its effect has resolved: a resisted application logs `effectResisted`, and the card reads *"against 50%: resisted (rolled 39 vs 30%)"*. It was filed first and read "hit" while the target's resistance turned the same die away.

### Step 4: Prevention — in Landing, not here

The **Prevention Luck Check** (CONTEXT.md) asks the target's player a question, which a pure step cannot do, so it runs in `landing.mjs#offerPrevention` after `applyEffect` returns `applied`. The step that stood here was never offered: no caller set `preventionAvailable`. Ruled 2026-10-14:

- **debuffs only**, and never a terminal effect (Instakill, Death, Erase);
- **only inside a Combat Process** (`ctx.process`), and **once per target per Process** (`state.prevented[unitId]`, kept on the Process state and serialised with it);
- the **target's owner is asked on their own screen** (`askOwner`, prompt `luckCheck` / `prevention`); a decline costs nothing;
- accepted, it **costs 1 Luck whatever the die says** and is the standard uncontested d20 `luckCheck`; a success drops the effect and the card reads *"Shock: prevented, Luck Check 1 vs 3: prevented"*, a failure lands it with the Luck spent;
- **not offered** on Beginner or Intermediate (`luckChecksApply`), with no Luck, or where Luck Checks are blocked (`luckChecksBlocked`, Achilles's duel);
- **not offered to a defeated Unit**, read off the live document (#206): a rider lands after the damage that defeated its target, and Brahmastra Kundala's riders asked an overpowered Master to spend Luck, once per rider. A GM-owned Unit's question is a local dialog with no deadline, so the Process waited on it, its card still reading *"Choose a reaction"*.

Proved in `test/unit/prevention-luck-check.test.mjs`.

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
- **`magnitudeStacks`:** Create a new instance beside existing ones, summing magnitudes at read time. A max-stacks ceiling (Kingprotea: maximum 10 Proliferation stocks) returns no-op if at the ceiling. A definition with `resetsSiblings` restarts every held instance's clock at the new one's expiry (an `extendEffect` per sibling), so they end together; the card says how many: Sita's Janaka (#348 ruling 4).
- **`highestOnly`:** Keep only the strongest magnitude; a weaker incoming application is a no-op.
- **`count`:** Increment a charge counter (`uses`); each application adds charges specified by `def.uses` or the intent's `applyUses`. The instance is **replaced** by one carrying the sum, stamped with this Turn as `appliedTick`: it used to be created beside the old one, so a second Monstrous Strength left two NP DmUp (GAO) documents counted twice, and the Turn of that use still decayed one (#198 reading 12).

Outcome: `create`, `refresh`, `extend`, `stage`, `replace`, `count`, or `noop`. If `noop`, the chain stops without creating.

### Step 6: Construct

Builds the effect instance document (`module/engine/effect-applier.mjs:234-286`).

**Duration & expiry:** Resolved from the authored duration (ability's override, or effect's `defaultDuration`, or `null`). A duration of `null` means no expiration; the effect is removed by a Cure, by consumption, or by its own clause. A `0` duration (thisRound) is **not** a disastrous default for "unstated" — it found one live: Poison was applied, staged to 1, and swept at the end of the round having dealt nothing. The authored duration is stored as an **absolute expiry tick**, not a countdown, so Stop's clock freeze and mid-game ◈ changes cannot corrupt it (`module/engine/effect-applier.mjs:235-255`).

**What an intent can say about the instance itself.** An emitted `expiry: null` means only *"nobody stated a duration"*, and the definition's `defaultDuration` answers it — so an effect with a default (Burn 2◈, Charm 1◈) emitted with `expiry: null` is an ordinary timed effect, never a permanent one. Two flags on the intent's `effect` say the rest. `permanent: true` is *"never expires"*: the flow stamps `expiry: null` whatever the definition's default is, and `mergeEmitted` (`module/engine/effect-applier.mjs`, the pure merge `resolveEffects` applies to what the flow built) does not let the intent's own expiry overwrite it. `unremovable: true` is ORed into the instance's flag, so Burn is removable in general and not while it is Piedra Del Sol's. A field's `ApplyEffect` action reads both: a `duration` the action authors as `null` is `permanent`, an absent `duration` is the definition's own, and `unremovable` is forwarded (#147). Changing what a bare `null` means would have turned every Charm and Burn emitted with `expiry: null` permanent, which is why the flag exists.

**An effect may resist its own removal** (#330 ruling 22): `removalResist` on the definition, any polarity, is taken
off the removal chance with the bearer's own (buffs only) resistance, in `rules/removal.mjs#removalPlan`; the
candidate carries it as `ownResist`. Kazıklı stacks are a debuff at `removalResist: 50`, one `count` instance, so a
removal rolls once for them all. A removal with `ignoresRemovalProtection` (Active 2 spending them) skips it.

**Invuln is a family** (#328 ruling 10): `invuln` and `invulnGyakkou` declare `families: [invuln]`, and every reader
asks `rules/effects/families.mjs#holdsFamily` (the pipeline, the ladder's collapse, Overpower). A hit spends
`spentFirstOf`'s instance, the one marked `spentFirst` before the rest. **A failed debuff may cost a price**:
`otherwise: {stats: [{stat, delta}]}` with `otherwiseOn: failed` (resisted, immune, prevented or warded, not already
held) writes the loss and a card line: Planet Olga Marie's *"if this debuff fails to be inflicted, the DU loses 2
Agility"*. Agility Loss forces the unfavourable Agility and Evade tables.

**A removal selector is matched in one place** (#326, `rules/removal.mjs#selectorMatches`): `polarity` and `valence`,
for Antares Snipe's *"all Defensive Buffs"*. The Skill and the Attack paths each kept their own polarity-only filter.
**Unremovable is the definition's or the instance's** (#198, `rules/removal.mjs#isUnremovable`). Both removal paths asked `def.unremovable ?? instance`, and the registry reports `false`, so an instance made unremovable by its intent was cleansed. **A strip removes the instance it rolled for**, not every instance of the definition: Suppression's one strip took every Proliferation stock. It posts the strip or the resist with its roll.

**Tied to where the bearer stands.** An instance may name the field (`sourceFieldId`) or the terrain type (`sourceTerrain`) that put it there, and then lives only while its bearer is inside — swept on the panel the bearer stands on, never on an exit event, which can fail to fire (Ch. 26, Ch. 28). The intent says so with `sourceFieldId` or `sourceTerrain`; `sourceTerrain` is stamped only by the terrain clauses that last *while inside* (Burning's Burn), so Poison Swamp's Poison does not end when its bearer walks out.

Duration bonuses — e.g., Mannanán's *Tradition Carrier* (*"duration of buffs extended by ⅓◈ extra Turns"*) — are added to the tick count, not to an already-started clock. An effect with no clock is not given one (`module/engine/effect-applier.mjs:249-254`).

When step 5 resolved to `extend` (a `noneExtend` effect reapplied onto an existing instance), the new expiry is the **existing instance's expiry plus** the newly resolved duration, not `currentTick + duration` — a reapplication extends the clock already running rather than restamping it from now (`module/engine/effect-applier.mjs:245-253`).

**Terminal effects:** A `terminal` effect (Instakill, Death, Erase) emits intents rather than creating an instance. It is a consequence, not a carried state — a Health loss for Instakill (which allows Guts and Endure to react), a `defeat` intent for Death (which *"ignores all revival effects"*), or `defeat` with cause `"erase"` for Erase (which excludes the Servant from the Grail counter) (`module/engine/effect-applier.mjs:290-437`).

Outcome: always `applied` (or `noop` if stacking ruled it out earlier). The instance carries: magnitude, NP magnitude, stage, uses, expiry, applied tick, source unit/ability/field ids, polarity, volatility, unremovable flag, visibility, and attribution-hidden flag.

### Step 7: Emit

Creates removal intents for replaced effects, an event intent if the stage changed, and the `applyEffect` intent, marked `resolved: true` to prevent re-expansion at the applier boundary (`module/engine/effect-applier.mjs:288-349`).

Outcome: `applied`. The `intents` array carries every intent this application emitted.

**What lands besides the effect (#226).** An Effect Entry's `otherwise` lands instead when its chance fails
(Expert's *"70% chance of applying it for ⅔◈ Turns, otherwise it is only applied for ⅓◈"*); a blocked one lands
nothing. An entry's `otherwiseOn: notLanded` widens that to every way the first did not land: resisted, blocked by
an Immunity, prevented, negated by a ward, or already held (`landing.mjs#otherwiseFires`). Katō Danzō's Harisenbon,
*"If Disable fails, inflicts Slow"*, reads the outcome and not the die (#249 reading 11); `resisted` stays the
default, so Expert's ruling holds. An unknown `otherwiseOn` throws. Its `restores` (`[{stat, delta}]`) is written as the application lands, capped at the maximum, its `delta` a number or an `@` expression resolved against the caster (Max HpUp's `0.2 * @self.baseHealth`, #345), and written after the effect it rides, so a ceiling the effect raises is the one that caps it (`afterEffects`; at full Health Max HpUp read "no change", found live): one die
decides both, so Buff ChUp raises it and No Buff stops it (Expert's *"70% chance of restoring 3 Agility ... If
successful, also apply AGL Up"*). The Skill card prints what a landing wrote (§46.4-NP).

**Three landing rules from Arturia (#230).** An `EffectMagnitudeScale` with `timing: read` scales a HELD magnitude
for as long as its rule stands and un-scales it when it goes (Invisible Air halving Crit Dwn; `snapshot.mjs#readTimeScaled`);
the applier leaves it alone. A `debuffWard` asks its holder's owner, as each debuff lands, whether to negate it, while
its uses last (the Master's Avalon, `landing.mjs#offerWard`). A `FlatDamage` may carry a `chance`, one die per strike
shared by its `chanceKey` (Excalibur's passive).

**A resistance that names its effect is read whatever that effect's polarity** (#247). `chanceContribution` skipped every contribution about a non-debuff, and the forest's marker is a status, so a Unit's Nameless Forest Resistance was collected and never subtracted. A contribution naming an `effectId` now skips the polarity filter. **An effect's `onApply` may run on every landing** (`onApplyEachLanding`): the forest's Token and its four losses are the marker's `onApply`, so the one chance that gates the marker gates them all, and a refreshed landing pays them again (`landing.mjs#landedIntents`).

## Invariants & edge cases

**The inflicter is the board's unit** (#193). Both live callers of `inflictBonusOf` — the Skill path and the event path — now hand it the board projection, auras included. A bare `unitSnapshot` carries none, so Medea's Item Construction never reached her own Spells. The chance line names the ability's own modifiers: *"rolled 69 vs 80% [target MAG B+ -25, Magic Resistance B+ -25]"*.

1. **Immunity is checked before chance.** Step 1 runs even when chance is 0, and chance step 3 does not re-check immunity. If both apply, immunity wins (`module/engine/effect-applier.mjs:85-170`).

2. **Replacement is checked before blocking.** A pair declaring both `replaces` and `blocks` does not refuse itself; replacement happens first (`module/engine/effect-applier.mjs:554-559`).

3. **Terminal effects never create instances.** Instakill, Death, and Erase emit intents and return. A corpse never carries an "Instakill" badge (`module/engine/effect-applier.mjs:298-301`).

4. **Magnitude scale applies to NP magnitude too.** A scale targets the magnitude, and NP magnitude is that same magnitude in a different context; both scale together (`module/engine/effect-applier.mjs:198-215`).

5. **Per-effect modifiers are never skipped for a friendly application** (#132). The self/ally bypass that skipped them, and the target's resistance, is gone.

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

- **Resolved: seven named steps.** Step 4 no longer runs inside `applyEffect`: Prevention moved
  to Landing (Wave B), after the pipeline has decided the effect lands, so 4b always runs.

- **Confirmed live: suppressions come from the board pass, and only from there.** Both projections
  carry a `suppressions` key, but it is the board re-pass that fills it —
  `u.suppressions = again.suppressions` (`module/rules/snapshot.mjs:877`), re-collected with field
  membership in scope. Compared directly on a live board, the board unit carries **14 keys the
  actor-only snapshot does not**, including `fields`, `terrain`, `inHomeBase`, `compulsions` and
  `decoy`. This is why `resolveEffects` builds its target from the board
  (`module/engine/applier.mjs:266-273`): an actor-only subject has no suppressions at all, which is
  how Sikera Ušum's immunity downgrade once failed to downgrade anything.

- **The immunity downgrade does not refund resistance as resistance.** Sikera Ušum clause d's downgrade adds a flat resist percent at the chance step rather than keeping the instance un-immune. An alternative reading (reducing the immunity to immunity-light) would gate slightly differently; the current reading is what the code does.

- **The downgrade is suppression-scoped, not field-scoped.** A field's `ImmunityDowngrade` produces suppressions at the time the target is snapshotted. A unit that moves out of the field does not lose the downgrade; the instance itself is neither field-tied nor re-annotated. This is the current behaviour; a future enhancement might tie immunity downgrades to the field's lifetime.

### An unstated NP figure is the full figure (#204 reading 5)

An effect instance that states no `npMagnitude` applies its full magnitude against a Noble Phantasm.
`rules/snapshot.mjs#resolveRuleValues` leaves `npValue` undefined for it, so every reader falls back to `value`;
it used to read the missing figure as 0, and Def Dwn 25% added nothing to an NP on eight Servants. The crit readers
still treat a missing NP figure as none (#131).

**"For the rest of that Turn" is `until anyTurnEnd`** (#208 §46.4-MQ). Kanshou & Bakuya's guard was ⅓◈, which outlives the
Turn when the enemy's Turn follows. `turnEnd` will not do either: it is heard by the active faction's Units alone, so a guard
landed on a Counter in the enemy's Turn would outlive that Turn and the next. Both it and Overedge author `until anyTurnEnd`.

**What one application may say about itself** (#232). An Effect Entry may state `stacking`, in place of the
definition's, and `bypassesImmunity`, `true` or a predicate. Bab-ilu's die table is the first user of both
halves of *"for debuffs which do not stack, its duration is extended instead"* (`noneExtend` on a row whose
effect refreshes) and of No Buff counted per 9 (`count`, one charge each): a No Buff with charges spends one
for every buff it stops, and one with none is the Duration-only kind it always was. Enkidu's Stun on a Divine
DU passes every immunity, one naming Stun included, and still meets resistance.

### A definition's default magnitude (#234 reading 6)

`defaultMagnitude` on an effect definition is the magnitude an entry that states none lands with
(`landing.mjs`), and the projection reads it too for an instance that carries none
(`snapshot.mjs#instanceMagnitude`). Regen is the one definition with a default, 10: its percent is
`"@magnitude"` now, so Arjuna's Awarded Hero heals 15%, Van Gogh's Regens 5% (they healed 10%, a
literal in `regen.yml`), and Pale Rider's unstated Regen 10%. A Regen landed before the change
carries 0 and reads as the default, since a 0% Regen heals nothing. A `then` action's
`percentOfMax` resolves against the instance like a chance does (`resolveRuleValues`).

### A moved effect arrives; a flat chance stays flat (#239)

**A transfer is not an infliction** (reading 6). `rules/effect-flow.mjs#transferEffect` moves an instance with its
stage and its clock, and the arrival carries `bypassChanceModifiers` and no chance of its own, so landing gives it its
base 100 with neither the mover's bonus nor the bearer's resistance. Shadow of Longing's *"then apply them to herself"*
landed at 100% less Van Gogh's 25 and 35, all or nothing, after the others' Curse was gone. An immunity still refuses
the arrival; the Curse it took is lost (6c). Each stage arriving is a stage gained, so `curseStageChanged` pays Channel
Marker Soul (6d). The caster's own instance is never a source (6a).

**A flat chance says so on the action.** Since #191 an action's `chance` is rolled by `pendingRolls` and decided where
the effect lands, against resistance and bonus. A clause whose chance *"is not modified by debuff chance or resist
effects"* states `bypassChanceModifiers`, as Queen's Poison does and Terror's Stun does now (§46.4-OW).

**What a Unit gains by its own choice lands unrolled** (#258 reading 6). Watermelon's *"Anastasia gains Blind"* states
`bypassChanceModifiers` on the phase entry: her Fae Contract is +5 both ways, so it already came to 100, but by two equal
numbers rather than by the rule.

**An event's effect may be inflicted by the other party** (#258 reading 4). An `ApplyEffect` action stamps its
handler's bearer as the source; `inflictedBy: victim` stamps the other party to the event instead. Soaked's *"a 25%
chance of being inflicted with Freeze"* hangs on its bearer's `damageTaken` and names the attacker, so the attacker's
debuff chance and the bearer's resistance meet it as they meet a rider. It rolls only on an Ice Attack that dealt
damage and carries no Freeze of its own (`not:attack:inflicts:freeze`); one that carries Freeze meets Soaked's −25
vulnerability instead, one roll at its chance plus 25.

**A named amplifier applies outright** unless it states `ifWeak` (§46.4-OR). Sikera Ušum's *"Units ... who are weak to
Poison"* is the one that does; Channel Marker Soul's *"Curse Damage taken is halved"* halves every tick. A periodic tick
is held to the Unit's `DamageFloor` for that effect (`scheduler.mjs#flooredTick`, §46.4-OS): Sunflower's Curse floors a
Curse tick at 1, which the attack pipeline's stage 16 alone did before.

### A chance raised per thing the DU holds, and a bypass of what names the effect (#351)

- **`chanceBonus {count, per}`** on an entry adds `per` for every thing a Count finds on the target, to the stated
  chance or the definition's own: True Name Discernment's NP DmDwn, *"For every NP the DU has, the chance ... is
  increased by 20%"* (`count: { of: npsHeld }`, reading 4).
- **`ignoresNamedDefences`** passes the defences that name the effect itself, and keeps the general ones: God's
  Resolution *"Ignores Stun Resist, Stun Immune, and any other effects that specifically reduce the chance of being
  inflicted with Stun"*. An immunity scoped to the effect and a resistance whose `effectId` is the effect are skipped
  (`effect-applier.mjs#findImmunity`, `chanceContribution`); Magic Resistance and Debuff Immune still hold (reading 5).
