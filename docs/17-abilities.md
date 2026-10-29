# 17 — Abilities: costs, requirements and timing windows

## What it is

An ability is a Skill, Spell, or Noble Phantasm a Servant can use. Using one follows a gate sequence: can this be done right now, what does it cost, what does the player choose, and what does it produce. The gate checks cost first, not last, so a player sees one clear refusal rather than a wall of text naming four problems (`module/rules/costs.mjs:14`). The timing window vocabulary — "during your Turn", "when Attacked" — is centralized with its own enumeration, because 117 of the 195 abilities in the content author them and every reader needs the same list (`module/rules/windows.mjs:1-29`).

## Where it lives

| File | Role |
|---|---|
| `module/rules/costs.mjs` | Cost kinds, gates (cooldown, expended, round, cost), and the first-refusal rule |
| `module/rules/windows.mjs` | The timing window vocabulary, and which windows have dispatchers |
| `module/engine/attack-preflight.mjs` | `attackPreflight`: every refusal a declaration can meet before it spends anything (Normal Attack ban, budget, `canUseAbility`, Master order limit, first-Round ban). Pure of the apps layer, so it can be run in a test |
| `module/rules/ability-use.mjs` | Ability classification (attack/mode/active/passive), targeting specs, and usage specs |
| `module/engine/skill-use.mjs` | The orchestration path for non-attack abilities — phases, effects, placement |
| `module/engine/cooldown.mjs` | Cooldown creation, branched cooldowns, and waiver paths |
| `module/engine/channel.mjs` | Multi-Turn ability charging for the Hanging Gardens only |
| `module/rules/np-gate.mjs` | The Noble Phantasm availability gate and essence shifts |
| `module/rules/np-scale.mjs` | NP scale comparisons for bounded fields and vulnerability tests |
| `module/engine/optional-costs.mjs` | Spending offered at timing windows rather than charged |

## How it works

### Cost kinds

Only Noble Phantasms carry costs today (`module/rules/costs.mjs:41-44`). A cost is a discriminated union naming who pays: the Master (most common), the Servant itself (when Free or Unbound with no sustainability), or the Master's sustainability clock. Free Servants whose Master has just been defeated have nobody to charge, so the cost shifts (`module/rules/costs.mjs:70-82`).

Additional per-use costs are declared on the ability itself (`module/rules/costs.mjs:111-155`). They include *"The Master's Health is reduced by 50% of its maximum value"* — sized at runtime, not on the sheet. An ability may carry multiple costs, and one cost may supersede another rather than add to it: Karna's Noble Phantasm **replaces** his Action cost rather than stacking with it, so the Master pays 50 rather than 70 (`module/rules/costs.mjs:563-604`).

A cost is checked AFTER the ruling validates it can be paid (`module/rules/costs.mjs:424-425`). Health is **strictly** greater: a Master at exactly 50 cannot pay a 50-cost NP (`module/rules/costs.mjs:523-527`).

### Gates and requirements

**A cooldown change names whose clock it moves.** `unit: target` sends a `cooldown` phase's change to the Unit it is aimed at; without it the change reaches the caster's own abilities, once per target. Protection from Ra (*"reduce their NP Cooldown"*) cut Mesektet three times for three allies and left Medea's untouched, and Serenity's Shapeshift lengthened her own clock instead of her target's (#189).

**A Master-Health requirement leaves him some Health.** `masterHealthFraction` takes `above` as well as `atLeast`: Ramesseum Tentyris asks `above: 0.5` and the Dendera Bulb `masterHealthAbove: 10`, because a cost of half, or of 10, must not empty the Master (ruled 2026-10-06, #189 reading 4). The cost check (`costs.mjs#cannotPay`) already refused a payment equal to his Health; the requirement now refuses it first, in its own words.

`canUseAbility` returns the **first** refusal, ordered by what a player can act on (`module/rules/costs.mjs:158-165`). The sequence is: **defeated** (`defeated`, "A defeated Unit cannot act." — a body on the board for the Tick before it is cleared declares nothing; a masterless Serenity whose Sustainability had run out attacked and cast in that Tick, pressed live in Wave A, `test/unit/defeated-unit-acts.test.mjs`), no match (match not started), expended (spent for the game), cooldown, field already open (`fieldAlreadyOpen`: an ability that opens a bounded field whose cooldown counts from deactivation, while that field stands — Ch. 28), exhausted (max uses), round gate, turn-within-round delay, oncePerTurn, sealed, **negated** (`negated`: an effect in the ability's `negatedBy` that its owner carries, said *"Negated by Silence"*; asked by `useSkill` alone until #244, so the bar and every offer lit what the press refused), category limit, forbidden creation, **platform stands** (a platform Noble Phantasm cannot be cast again while its platform stands: `rules/platforms.mjs#standingPlatformOf`, derived from the ability's `summonPlatform` phases, carried to the use paths as `usageSpecFor`'s `summonsPlatforms`, refused `platformStands` above the cost check — #142), oncePerRound, mutual exclusion (sameTurnExclusive, sameRoundExclusive), presence concealment, ZON, then requirements (`module/rules/costs.mjs:172-428`). Every gate but the first three is a lesser refusal than the ones above it — "on cooldown for 4 Turns" invites a player to wait, when "expended" says it is gone for the life of the match.

**An expended ability contributes nothing** (#184). `rules/snapshot.mjs#contributionsOf` drops it before its rules are collected, passives included. Akhilleus Kosmos is *"broken; all its effects are lost"*, and its shove (`ignoresOccupancy`, `Knockback`) kept walking Achilles through people after the barrier was spent; the war setup's unselected NP choice, *"unusable"*, is the same word.

**An offer asks this gate as its press does** (#244). `engine/press-gate.mjs#pressGate` is `canUseAbility` plus the Turn's budget on the path the press takes, and both `useSkill` and the attack preflight call it; `offerable` filters a window's, a rung's or a prompt's list through it with the press's own context (Ch. 23). An offer whose target is not known yet passes `selfOnly`, and only `SELF_REQUIREMENTS` are judged.

Requirements are ability-declared predicates checked at the end of this chain (`module/rules/costs.mjs:414-422`, `module/rules/items.mjs:568`). They are the long tail: stat/effect/weapon/item checks.

### Timing windows

**An exclusion names its partner.** `sameTurnExclusive` and `sameRoundExclusive` refuse with the partner's content id, and `present.mjs#abilityState` takes a `nameOf` (`abilityNamesOf(actor)`) so the bar and the sheet read *"Cannot be used on the same Turn as Monstrous Strength"* rather than *"…medusa-monstrous-strength"* (#188).

Eight timing windows exist, and only one is not offered at a moment: `ownTurn` is how the sheet button reads (`module/rules/windows.mjs:39-75`). It is **enforced**, though, by two readers (#160): `canToggleMode` for a mode, and `canUseAbility` for every other ability, which refuses with `notOwnTurn` ("Only during your Turn.") when `ownTurn` is the ability's ONLY window and the faction whose Turn is running (`gateContext().actingFactionId`) is not the one the Unit acts on (its `actingFactionId`, so a charmed Unit follows its charmer). It asks nothing when no faction's Turn is running, of an ability that names another window as well (it is used at one or the other and the gate cannot tell which), or of a use made as a Counter (`isCounter`, which is on the enemy's Turn by definition). **The other half is `windowOnly`** (#208 reading 8, ruled 2026-10-14): an ability whose windows exclude `ownTurn` (and are not `automatic`) has no sheet button, and `canUseAbility` refuses it with `windowOnly` ("Only at its own moment: it is offered when that comes.") unless the call says `atWindow`, which only the engine sets: `useSkill({atWindow})` from a reaction and from a window cast, `resolveAttack({atWindow})` for a reaction that attacks (Kiritsugu's shot), and the Noble Phantasm cancellation. A Counter is exempt, and a resumed declaration passed the gate when it was first made. **`anyMoment`** (#243 reading 9) lifts both gates for a use another ability grants at its own moment: Kiritsugu's *"Kiritsugu can use a Thaumaturgy Spell once before performing this Normal Attack"*, taken on the enemy's Turn, casts Penetration and Familiars (`ownTurn` only) and Reinforcement (window-only) there. Only the engine sets it (`offerPreAttackSpell`), and a refusal there is said (`tellReactionRefused`). **`requiresDamage` on an `applyEffects` phase** gates its riders on hurt, not hit (#243 reading 15): Mystery Bisection's *"35% chance of inflicting Instakill if damage was dealt"*, against §46.4-LI's rule for every other rider. The socket operations never carry the flag (`resolveAttack` strips it from a payload). `usedOnlyAtWindows` (`rules/windows.mjs`) names them: 14 abilities before EMIYA's Reinforcement, which lost `ownTurn` and gained `defendingPhaseStart`. Until then they were pressable from the sheet or the bar at any time (Trofa, Eye of the Mind, Rho Aias among them). The others dispatch at specific moments:

- `whenAttacked` — as a reaction inside an attacker's Combat Process (`module/rules/windows.mjs:47-50`)
- `whenAllyAttacked` — when an ally nearby is about to be hit (`module/rules/windows.mjs:52-55`)
- `damageStep` — at the start of a Damage Step, on the attacker's own attack (`module/rules/windows.mjs:57-60`). Asked **once per attack**, not once per Process (#188 reading 13): a fan-out is one Combat Phase and many Processes, and a Riding Attack through three Units asked three times, so Monstrous Strength, billed on the first, boosted one hit of the ride. The first Process to reach the window asks and records the answer, a refusal included, on its message (`windowPicks`); its siblings take the same answer without asking or paying again (`engine/attack.mjs#offerAttackerWindow`).
- `combatPhaseStart` — at the start of a Combat Phase, on the attacker's own attack (`module/rules/windows.mjs:62-65`)
- `defendingPhaseStart` — at the start of a Combat Phase the Unit is attacked in, asked of each defender after the attacker's window (#206 reading 4, `engine/attack.mjs`). Uncrowned Arms Mastership switches *"at the start of any Combat Phase"* Karna is in, attacking or defending.
- `whenTargetedByNP` — when a Noble Phantasm is declared (before any Combat Process) (`module/rules/windows.mjs:67-70`)
- `automatic` — never chosen: the engine declares the ability when its trigger fires, and it is never a button (#197). Mannanán's Fragarach Counter, declared by `engine/attack.mjs#flushAutoCounters`, sat on her bar as an Attack Skill until it named this window (`rules/ability-use.mjs#classifyUse`).

A window may be a single string or a list (`module/rules/windows.mjs:127-129`). Karna's Uncrowned Arms Mastership names `combatPhaseStart` and `defendingPhaseStart`, so it is offered at either side of a Combat Phase.

An ability whose only moment is a timing window is not a button on the sheet (`module/rules/ability-use.mjs:291-296`). Asterios's Monstrous Strength has no phases and no targeting declaration, so it is offered only at its window and pressing it does nothing.

### Ability classification

Every ability is one of five kinds (`module/rules/ability-use.mjs:220-305`):

- **attack** — opens targeting and a Combat Process, resolves damage. Anything that deals damage: a damage phase, or a damage block that deals any (a branch's `fixedValue: 0` does not). Ruled on the Semiramis audit: an ability with no damage opens no attack card, effect-only abilities included (§46.4-CK). A non-damaging Noble Phantasm is **active**, yet still costs the Attack — `countsAsAttack` holds that for every used NP, content cannot opt out, and `useSkill` bills it `np`, which NP Seal refuses — and it still answers a Counter (`rules/counter.mjs#answersACounter`), resolved through `skill-use.mjs#resolveWithoutProcess` with no ladder.
- **mode** — toggles on or off, never consumed. Switching it ON goes through `useSkill` when it is **priced on entry** (`rules/modes.mjs#pricedOnEntry`): it has phases (Mannanán's God's Holder: Possession), or it states a cooldown that starts at the use with no `countFrom` (Riding's Active, *"Cooldown: 3◈ Turns"*), so the cooldown is gated, the move pool billed and the clock started. Switching OFF is always free. Mad Enhancement is a free switch. A mode whose `activeRules` author `duration: "this turn"` (the three Riding documents) switches itself off at the end of that Turn (`endsWithTurn`, Ch. 24).
- **active** — resolves against its own targeting spec or phases when clicked. A self-buff, a utility Skill.
- **passive** — always on. A class skill with only `passiveRules`, or an Attack Skill marked passive.
- **windowed** — usable only at a timing window, no phases, no targeting. Asterios's Monstrous Strength.

**One spec for the gate.** `usageSpecFor` (`module/rules/ability-use.mjs`) is where an ability becomes what `canUseAbility` reads, for `resolveAttack`, `useSkill`, the sheet's cards and the action bar alike. It carries `isSpell`, `categorizedAs` and `creates` since #155 — Seal, Silence, Blind's Mystic Eye clause and a Storm Border's ban on creating Large Units read them — and a guard test reads the gate and fails if it names a key the spec does not write.

**`kind` is a grouping, `isSpell` is what makes a Spell.** An ability's `kind` takes one of `ABILITY_KINDS` (`classSkill`, `skill`, `noblePhantasm`, in `module/rules/authoring/ability.mjs`, which the editor's select and the content validator both read): `classSkill` cannot be copied and the sheet groups by all three. Nothing else reads it, so it decides no rule. A Spell is `isSpell: true` beside `kind: skill`: `engine/attack.mjs#abilityKind` answers `damageSpell` from the flag, and that is what routes the bill to `spell` (Seal spares it, Silence and Skill Seal refuse it) and what keeps a Spell's declared component on the attack. Quetzalcoatl's three Spells authored `kind: spell`, which nothing reads, so `isSpell` was false and they resolved as STR Normal Attacks; `validate:content` now refuses a `kind` outside the list and, for `spell`, points at `isSpell: true` (#159).

The classification matters because non-attack abilities do not open a targeting session or a Combat Process (`module/engine/skill-use.mjs:7-22`). A Skill's click uses the Unit's **Act**; an Attack's click uses both the Attack and (usually) the Act.

### Opening choices

**A choice the sheet makes at the start of the game.** An ability's `openingChoice: {off, on}` names the two labels of a mode its bearer must set before play: Karna's Uncrowned Arms Mastership, *"At the start of the game, choose either Effect 1 or 2"* (#206 reading 3). The war's build marks it due (`system.openingChoices.due`, `engine/opening-choice.mjs#markOpeningChoicesDue`), and so does a summon. The owner is asked on their own screen, free of any cost; a player's press of the mode sends `askOpeningChoice` to the GM, who asks and writes (Ch. 38). No Turn ends while one is owed: `rules/budget.mjs#canEndTurn` reads `openingChoicesOwed`, whoever's Turn it is.

**Two flags that change what a use counts as.** `countsForNPSeal: true` makes NP Seal refuse a Skill as it refuses a Noble Phantasm: Vasavi Shakti's Activation, ruled sealed by NP Seal and not by Skill Seal (#206 reading 9, `rules/costs.mjs#preventionActionFor`). `countsAsNormalAttack: true` stamps an Attack Skill's attack `asNormalAttack`, so it carries `attack:kind:normal` and every rule about Normal Attacks hears it: Mana Burst (Flames) is his Normal Attack powered up, and Vasavi's Divinity bonus reaches it (#206 reading 5, `engine/attack.mjs#buildAttackSpec`). All four Mana Bursts carry it since (ruled 2026-10-14): Raikou's, and Castor's and Pollux's, so Castor's Divine Core 5% and the Castor and Pollux buffs hear them. Both are declared on the DataModel and routed in `survival.test.mjs`. EMIYA's Overedge carries `countsAsNormalAttack` too (#208 reading 7, ruled 2026-10-14): *"2 Normal Attacks in a row"*, so each of its two swings is a Normal Attack beside its Attack Skill kind, and Clairvoyance, Reinforcement's N.Atk Up and the Circuits hear it; its own +50% and the Kanshou & Bakuya grant keep reading `attackSkill`. It is also *categorized as a Noble Phantasm*, which `attack:isNP` reports (Ch. 11). **A plain Skill is a Skill with no `category`** (reading 2): Trace, On is not a Thaumaturgy Spell and Unlimited Blade Works is not a Projection (reading 4). Tracing's pick, Magecraft's Range Up and Atk Up (Trace)'s extension read `category` and nothing else, and Silence's gate is authored on each document beside it (`negatedBy` and a `notHasEffect` requirement), so the same edit removes both: Trace, On is usable Silenced, and Unlimited Blade Works loses only its Aria gain to Silence (reading 23).

### The Riding family

Riding is one class skill authored as several documents, because a rank table gives two Servants different numbers off one document but not different passives: the shared `class-riding` (Mannanán, Nemo and Quetzalcoatl since #206), `class-riding-achilles` (gated on the Mounted stance), `class-riding-medusa`, `class-riding-drake`, `class-riding-pollux` and `class-riding-unlocks` (whose Active is a **used** ability applying the `ridingActive` status, which the granted abilities ask for), `pale-rider-riding`, and the Normal Rider's rankless `normal-riding`. The shared document and Achilles's and Pale Rider's are **modes** (`activeRules`, no phases): their Active pays a cooldown on entry and ends with the Turn (Ch. 24, #116). The card a player reads is the document's `description`, so `class-riding` prints each rule its grants switch on — the three passives in full and the Active as "the Riding table's value", because an inline `@` is not substituted and the number is the rank's (#122). The rank and the cooldown are template slots the bearer fills beside the `ref`, and a slot left unfilled fails the build (Ch. 40, #120); Pale Rider's MOV is `table: ridingMov` at his own rank EX, the same 6 his sheet prints. `class-riding-unlocks` is Drake's shape with the MOV a slot (`mov`), for the sheets that print *"Additionally, 'Double Move', 'Riding Attack', and 'Passenger Seat' can be used on this Turn"*: Karna and Raikou took the shared document, which grants the three unconditionally, and Karna rode with Riding off (#206).

### Cooldowns

A cooldown is stored as remaining Turns, counted down by the scheduler (`module/engine/cooldown.mjs:1-16`). The authored form is a tick expression (`3◈`, `5◈+⅓◈`) or, for one ability, a per-unit rate resolved against the summon count (`module/engine/cooldown.mjs:45-80`).

Cooldowns can branch on predicate: Summoning: Bašmu is `2◈` for its damage branch and `4◈` for its summon branch (`module/engine/cooldown.mjs:81-106`). First match wins, tested against the caster's options.

A cooldown may be **waived**. Scáthach's Primordial Rune Spells skip cooldown if she holds a PRS Token, and the Token is removed automatically — not offered to the player, because the sheet says "if ... while she has", not "she may" (`module/engine/cooldown.mjs:24-72`).

Cooldowns may start later: Presence Concealment's `2◈` begins "AFTER PC is deactivated", not at the use (`module/engine/cooldown.mjs:48-63`). Quetzalcoatl's mount's `7◈` begins on its defeat, not on the summon. Both have been on the schema since authoring and nothing read them until this module (`module/engine/cooldown.mjs:48-63`).

**A cooldown may grow per something counted** (`cooldown.countBonus: [{ticks, count}]`, #283): Excalibur Proto's *"5◈ Turns if no criteria are met, increases by ½◈ Turns for every criteria that is met"* is `max: 5◈` and `countBonus: [{ticks: ½◈, count: {of: criteria}}]`. The fractions are summed over the count and rounded up once, as `perUnit` is, so four ½◈ are 2◈ (`engine/cooldown.mjs#countBonusTicks`). **A step may shorten the clock** (#336): Rhongomyniad's *"Cooldown is reduced by ⅓◈ Turns for each criteria that is met"* is `max: 7◈+⅔◈` and `countBonus: [{ticks: ⅓◈, direction: down, count: {of: criteria}}]`, 23 Turns less one per criterion met. The direction is stated, never a signed span: `-⅓◈` is no ◈ span `parseTick` reads.

**An NP may be cast with an Attack it rides** (#336 ruling 2): Arturia (Lancer)'s Invisible Air, Usage 1, *"Used together with Mana Burst"*. Its window is `ridesAttack`, so it is no sheet button (`windowOnly`); an `AttackRider` element with `cast: true` and a predicate on the Attack (`attack:madeWith:lanceturia-mana-burst`) offers it at the declaration, and a yes casts it through `useSkill` at the window: its phases land on its user then, hit or miss, its clock and use are recorded, and `freeAtWindow` spends no Attack of its own. Its gate is the offer's (`pressGate`): the NP Round gate, NP Seal, its Cooldown and `sameRoundExclusive` with Strike Air. A refusal at the cast is a line (`FGT.AttackRider.CastRefused`).

**A use may fail outright** (`UseFailure {of, chance, chanceWhen, then}`, #300). `of` names `self` (the ability carrying it), a use class (`np`, `skill`, `spell`) or an ability id; the first `chanceWhen` whose predicate the user passes replaces `chance`, and the highest chance among the matching ones is rolled (`rules/use-failure.mjs#failureFor`). Both paths roll it once per use (`engine/skill-use.mjs#rollUseFailure`): a Skill before its phases, an Attack at commit after its costs and before any Process. A failed use pays its budget and its costs, starts no clock, runs nothing, and posts its die (`FGT.UseFailure.Failed`); a held roll is said too. `then: lockThisTurn` refuses the ability `failedThisTurn` until the next Turn; `then: endActions` ends every action (Ch. 19). A Counter does not roll it. `then` and `of` are closed words the build checks.

**A cooldown may read what the use did** (#320, #285): `branches` and `conditionalBonus` see the use's `use:` options (`use:missed`, `use:evaded`, `use:applied:<effect>`, `use:die:<face>`), and `countBonus` counts its facts (`{of: use, fact: debuffsInflicted}`). Kurohime's NP is `branches: [{predicate: [use:missed], max: 3◈}, {max: 6◈}]`. An Attack's clock starts at commit and settles once its Combat Phase is over (`engine/attack.mjs#settleDeclarationCooldown`); a Skill's is written once, after its phases (`engine/skill-use.mjs#cooldownIntents`). The time model is in Ch. 4.

**Criteria** (`criteria: [...]`, #283) are tests over the declaration's DUs: `{targets: <predicate>, atLeast | exactly: n}`, `{targets: <predicate>, none: true}`, or `{self: <predicate>}`. Both use paths count them once, after targeting and before the price (`rules/count.mjs#declarationCriteria`), post one card naming them (`FGT.Criteria.Line`: "Excalibur Proto: criteria met 3 of 6 (1, 5, 6)"), and hand the number to the cost (`additionalCosts[].amount` as a Count), the cooldown (`countBonus`) and, on the attack path, every Process's `state.attack.criteriaMet`, which the damage multiplier reads. With one DU, an `atLeast` criterion holds when that DU passes (Arthur's note); over an empty area no criterion about DUs holds.

**A cooldown cut is a `cooldown` phase, or a `CooldownDelta` on a handler — never a rule element in an `applyEffects` phase** (§46.4-D1, #219). An `applyEffects` phase lands EFFECTS: every reader (`engine/skill-use.mjs`, `engine/attack.mjs`) reads an entry through `rules/effect-flow.mjs#entryOf`, which answers null for one that names no effect, so `{ key: CooldownDelta, scope: np, ticks: "1◈" }` written there was dropped without a word. Castor's Mana Burst and Anastasia's Shvibzik had never turned the Noble Phantasm's clock. `tools/lib/content.mjs` now refuses the shape (the one Clause still written that way is Jabberwock's Alice Eater, `DurationDelta`, named in `PHASE_ACTIONS_STILL_DROPPED` until a phase kind moves a summon's expiry). A `CooldownDelta` whose figure is a rank table's (`table:` + `direction: down`, Self-Replenishment) carries it as `amount`, which the action now reads as `StatDelta` does; it read neither `amount` nor `direction` and set the clock to 0 at every Turn end (§46.4-D4). The build parses every cut's `ticks`, a `cooldown` phase's changes and a `CooldownDelta`'s alike (`tools/lib/content.mjs#durationFields`): a bare `"1"` built clean and threw at the press, so a Turn count is written `"1 turns"`.

**A linked group with `sharedCooldowns: byName` has one clock** (#209 reading 2, ruled 2026-10-14). A use starts the same clock on the twin's same-named ability (`engine/cooldown.mjs#sharedAcrossGroup`), and a CUT reaches both too: Self-Replenishment's 2 Turns, Mana Burst's 1◈, the Castor buff, the Divine Core's 5% (one roll, both copies), a Command Spell, and an enemy's increase alike (`#sharedCooldownIntents`, mirrored by `scheduler.mjs#CooldownDelta`, `skill-use.mjs#cooldownChanges` and `command-spells.mjs`). Both matchers ask `twinsOf`, which finds the twin by name. The per-Turn tick is not mirrored: it turns every copy by its own rate already, so mirroring it would count each Turn twice. Instead the pair ticks at ONE rate: `scheduler.mjs#advanceCooldowns` evaluates `cooldownRate` for a unit holding what either twin holds (NP Regen, NP Lag, NP Lock and Stop on one twin act on both copies; two Regens add, as on one bearer). A cut on a clock the attack path makes prints a line on the card for each copy that moved (`Name: Cooldown 18 → 15`).

### Channeling

A multi-Turn ability charging is stored on the Unit, not the ability (`module/engine/channel.mjs:38-58`). The Hanging Gardens of Babylon is the only clause using this: Semiramis cannot Act for 3◈ Turns while it charges, and any attack during that window interrupts it and forces a restart. The 3◈ counts every Turn, any faction's, from the one it began in (`channel.mjs#channelProgress`), as effect expiries and cooldowns do; it counted only her own Turns, which made it nine Rounds (§46.4-CL). The cost is **deferred** — charged only when the channel completes, not at the start (`module/engine/channel.mjs:1-20`).

A declaration interrupts every channel its targets hold, except the declarer's own (`module/rules/ability-use.mjs:202-204`). Semiramis cannot interrupt her own Hanging Gardens' channel by using it.

### The Noble Phantasm availability gate

A Noble Phantasm is not usable until a Round gate is past. The general gate is Round 6, but Assassin-classed Servants open at Round 4 (`module/rules/np-gate.mjs:31`). A Master's Essence shifts the gate early: Kaleidoscope opens it 4 Rounds earlier, so Assassin reaches Round 2 if it holds one (`module/rules/np-gate.mjs:46-48`).

An ability's gate is `isNP || categorizedAsNP` (`module/rules/np-gate.mjs:54-66`). Every other NP-scoped question uses the same predicate, so the scope is consistent. An attack asks it through `isNPAttack`, and the option `attack:kind:np` carries it, so a clause authored against Noble Phantasms hears a categorized one (ruled 2026-10-16, #208). A Servant carrying two classes takes the earliest gate (`module/rules/np-gate.mjs:74-86`).

An NP Lock that hits before the gate opens does not cause the gate to activate. Instead, the cooldown increase composits additively with the gate delay: if a lock adds 5 Turns before Round 6 opens, the NP becomes usable at Round 6 + 5 Turns extra, not at the max of the two (`module/rules/np-gate.mjs:134-151`). Additive, not `max()`, because the rule's prose and its pseudocode disagree, and the prose prevents the caster wasting a Skill.

### A mode that picks, locks and pays on its end (#253)

Yan Qing's Doppelganger is a mode with four things no mode had together.

- **It picks on entry.** A mode with phases goes through the use path when it is switched on (`pricedOnEntry`); one whose `targeting` needs a choice now opens the same targeting session a Skill does before the switch (`apps/actor-sheet/sheet.mjs#toggleMode`). Its `disguise` phase puts the chosen Unit's look on the caster (Ch. 30). `anchor.range: board` reaches any panel, and `selection.sameSizeAsCaster` keeps a footprint to the caster's size.
- **It locks the rest.** An `activeRules` `Suppress` of scope `abilityUse` with `except: [presenceConcealment]` refuses every other ability in the use gate (`abilityLocked`); a Normal Attack is no ability and is never asked.
- **It ends at any moment.** `deactivation.window: anyTime` switches it off at once on any Turn, where `any` waits for the Turn's end; never while a Combat Process is open (`inCombatProcess`, read off the recent chat messages by `combat-process.mjs#processOpenIn`).
- **Its end pays by how it ended.** Every switch off writes `endedBy`: `manual` from its owner's press, `hit` from the blow that breaks it, `forced` from any other forced switch. `onDeactivate: {manual: [phases]}` runs on the owner from `engine/scheduler-hooks.mjs#onModeEnded` (`skill-use.mjs#runDeactivationPayout`), with its own card. The deactivation clock (`countFrom: deactivation`) starts either way.

### Optional costs

A passive may offer a Unit a choice to spend a resource at a timing window (`module/engine/optional-costs.mjs:1-23`). Mannanán's Fragarach Tokens can be spent for 30% crit chance at the start of a Combat Phase. The spend is offered to both sides (attacker and defender) of the exchange, because she counts when she counters too. Refusing the offer is a real choice because the same tokens are worth something else.

A spend may also be **the attacker's own, at its Damage Step** (`timing: damageStep`), asked once per Process after the defender's reaction and before the damage is computed, so an Evade, which never reaches the Damage Step, is never asked. It may carry an `attack:` `predicate`, answered when it is offered, and **a chosen amount** (`cost.amount: chosen`): the player picks 1 up to what the Unit holds, a pool in `resources` or a stat pool by name (`agility`, `luck`). With `scalesWithSpend`, each effect's magnitude is per unit spent. Yan Qing's Ruffian is all three: *"he can spend X Agility … for every Agility point spent in this way, damage dealt is increased by 5%. Cannot be used with Noble Phantasm"* is `{timing: damageStep, cost: {resource: agility, amount: chosen}, scalesWithSpend: true, predicate: ["not:attack:kind:np"]}` buying `dmgUp` 5 until the Combat Process ends, with no cap (#253 reading 2).

An optional cost's effect goes through immunity, exclusivity, and duration extension exactly as one from a Skill does — all the same rules apply (`module/engine/optional-costs.mjs:177-182`).

**A choice on an Attack Skill is asked once** (#180). `choose` is a caster phase, so the declaration's `runCasterPhases` asks it and runs a branch's phases (`runChoice`, which shows each label localized). `engine/attack.mjs#resolveChoosePhases` asks again only for a choice with a branch carrying a per-defender rider (`applyEffects`); live, Castor's Mana Burst asked its restoration twice, the first time in raw lang keys. Test: `test/unit/choice-asked-once.test.mjs`.

### When a phase runs against the damage

On the attack path a phase runs **after** the damage unless it states `when: beforeDamage`, wherever it sits
in the list. *"First apply … Then, deals 4x damage"* needs the key: Nemo's Great Ram Nautilus and Anastasia's
Snegleta both listed their buffs and debuffs first and had them land after their own hit (#191).
`test/unit/storm-border-191.test.mjs` refuses any effect phase listed before a `damage` phase without a
`when`.

### Effect Entries

An Effect Entry is what an ability writes to give an Effect: `{id, magnitude, duration, chance, ...}` in an `applyEffects` phase, a check's `onSuccess`/`onFail`, an `aftermath`, or wrapped as `{effect: {id}, duration}`. The keys an entry may carry are one list, `rules/effect-flow.mjs#ENTRY_KEYS`: `id`, `magnitude`, `npMagnitude`, `npMagnitudeFactor`, `perStack`, `max`, `duration`, `permanent`, `unremovable`, `visibility`, `secret`, `chance`, `chancePerPanel`, `bands`, `chanceModifiers`, `bypassChanceModifiers`, `stages`, `uses`, `times`, `applications`, `predicate`, `ignoresResistanceFrom`. Every key means the same thing on a Skill, a Noble Phantasm, a handler and a field, because every one of them lands through `engine/landing.mjs` ([Ch. 15](15-effect-application.md)). Three counts differ: `stages` is one application worth N stages, `uses` is one application worth N charges, `applications` is N applications each with its own die; `times` is charges on a `count`-stacked effect and applications on any other. An entry's `predicate` narrows it to the recipients that match, asked with the caster as the board sees it. `npm run validate:content` refuses an entry key outside the list, naming its path (#342), and `test/unit/landing-one-door.test.mjs` fails on one in the corpus.

**Hundred-Faced Hassan's vocabulary (#226).** A requirement `legionAbove: {count}` (more than `count` bodies
remain, field and reserve). A `move` phase (`panels`): the owner picks a panel an ordinary walk of that many reaches,
or stays. `withdrawsFromAttack` on a reaction takes its user out of the Attack (Ch. 21). `legionCost` is a dice price
in bodies paid when the declaration's Combat Phase ends (`engine/legion.mjs#payLegionPrice`). `endsOnSkillSeal` on
Presence Concealment and Mad Enhancement ends either when Skill Seal lands, under the Revised text the War picks
(Ch. 30, Ch. 31; #260 reading 3). A phase's own `targeting` may be
`chooser: chosen`: the caster's owner picks up to `count` of the candidates, and a phase is never an Attack, so a
concealed ally is a candidate (§46.4-NO). A `heal` line prints the real change (§46.4-NN).

**Arturia's vocabulary (#230).** `cooldownOverride` lets an ability be used ON its Cooldown at a price, the clock
untouched (Mana Burst: in the ZON, the Master pays 20). `toggleWindow: any` and `oncePerTurn` on a mode (Invisible Air), which no Round gate holds (`ignoresNPGate`): the
bar asks the use gate before a switch goes on, and a passive NP on from the summon has no Round to wait for.
A `setMode` phase may `suspendFor` a span, on the Skill path and the attack path alike (`skill-use.mjs#modeIntent`). A
`transferItem` phase hands an Item whole from `self`, `master` or `target` to another, with `bind` and `lock` (Avalon).
An Aura may `lendsAbility` a slug, its bearer's own Skill, negated with it (Radiant). Requirements `besideMaster`,
`inHomeBase`, `notAttackedThisTurn`, `masterItemAtLeast`. A reaction's targeting may branch on the attack it answers
(`attack:isAoE`).

**A phase rule that is an action runs as one** (#247). `applyPhaseEffects` treated every rule without an effect entry as nothing; Alice Eater's `DurationDelta` extended no stay. A rule whose kind is in `ACTION_KINDS` is dispatched on its target and its intents applied; one that is neither logs an error. Its row says what it did (*"Stay on the board: 18 → 27 Turns left"*). **A first-time-only phase says nothing on a later use**: a spent `once` structure is skipped, and the second Jabberwock's card no longer reads *"vorpal-blade-cache — couldNotPlace"*. A Skill card's refused reasons are worded from `FGT.Skill.Reason.*`.

**"On Cooldown" is the whole Cooldown line** (#249 reading 20). Kirihanasu's Cooldown is *"3◈-⅓◈ Turns, and Danzō's
Health must have been restored back to above 75%"*, and Fubatsu and Kawarimi are barred *"if Kirihanasu is on
Cooldown"*. `rules/items.mjs#isCooling` is the one reader: the clock, or the ability's own `healthRestoredSince`
unmet (`restoredSince`, the case that requirement always read). `abilityOffCooldown` asks it, and the board projects
the gate as `restoreGate` (`snapshot.mjs#collectAbilities`). Above the fraction at any moment after the use satisfies
it; no drop is needed first (#249 reading 37).

**A refused `abilityOffCooldown` names what it waits on** (#260, live). `meetsRequirements` returns a failed
requirement's `detail` beside its kind (`rules/items.mjs#requirementDetail`), `canUseAbility` passes it on, and
`abilityState` words it `FGT.Ability.CoolingNamed`: *"Not while Prelati's Spellbook: … is on Cooldown."* It read *"An
ability it depends on is still cooling."* A refusal with no names keeps that line.

## Invariants & edge cases

1. **One refusal answers the question.** `canUseAbility` returns the first refusal in order, never all of them (`module/rules/costs.mjs:162-165`). A player pressing an ability sees one clear reason why not, not a list.

2. **Attacked by a declaration, not necessarily hit.** A Noble Phantasm that interrupts a channel fires on declaration, before any Combat Process exists (`module/engine/channel.mjs:1-20`, `module/rules/ability-use.mjs:183-196`). Semiramis interrupted mid-charge counts as Attacked.

3. **A cost may supersede rather than stack.** Mutual-exclusion costs are one-pass, not transitive: a cycle of supersession collapses to one survivor rather than none (`module/rules/costs.mjs:582-604`).

4. **Cooldowns ignore unstarted matches.** An ability used before Combat starts writes a cooldown that nothing can count down; the Servant is gone for the life of the world. Checked FIRST, above expended, because "on cooldown for 22 Turns" invites waiting for a Turn that is never coming (`module/rules/costs.mjs:177-215`). Defaulted to `true`; seven call sites all pass the real value from `gateContext`.

5. **An attack always picks a target, even a self-targeting one.** It opens a Combat Process against a defender. A self-buff's targeting session is offered only when the ability says the player chooses (`module/rules/ability-use.mjs:389-421`).

6. **Expended is above cooldown.** An ability broken for the rest of the match (Akhilleus Kosmos when shattered) is refused before cooldown is checked, because a cooldown on a broken ability is a wrong refusal — the player would wait for something that is never coming back (`module/rules/costs.mjs:234-247`).

7. **Presence Concealment refuses by category, not by list.** *"Active Skills targeting/affecting an enemy Unit(s) cannot be used"*, not a set of names. A new Skill in that category is covered without touching the code (`module/rules/costs.mjs:392-403`).

8. **Timing windows and phases are declared on the same ability.** An ability may be usable at a window AND during the owner's Turn — Medea's Argos, *"used during your Turn or when Attacked"* — and has phases (`module/rules/ability-use.mjs:293`). The two moments both happen; the phases run both times.

9. **A Skill that `categorizedAs` another IS that Skill, to every reader.** `categorizedAs` is an open tag set an ability carries (Goddess's Divine Core: `[divinity]`; Kingprotea's header says it is a Divinity *"for every clause in the game that asks"*), and `categorizedWhile` gates a tag on effects that are present. One reader holds it: `categoriesOf(unit)` in `module/rules/items.mjs`, a map from each tag to the best Rank it is held at, which `categoryRankOf`, `hasCategory` and `rollOptionsFor` all ask. So `target:skill:divinity` and `target:skillRank:divinity:gte:B` are emitted for a Divine Core holder exactly as for the class skill, and the Unit's own collection pass sees the same (its `abilities` list carries `rank`, `categorizedAs` and `categorizedWhile`). `rollOptionsFor` read each ability's slug only, so Vasavi Shakti called every Divine Core holder "Divine, no Divinity" (x2.5) while Achilles's Andreias Amarantos and Ozymandias's Ramesseum Tentyris, which read the category, counted them as Divinity (#125).

## Traps and anti-patterns

**Write a gate and never wind the clock it reads.** A mode's `toggleLock` is *"it can only be deactivated 2◈ Turns after it was activated, **and vice versa**"* — two symmetric waits off one clock that restarts on every flip. `canToggleMode` has read it correctly since it was written, and its unit tests prove it refuses either direction inside the window; they hand it a `toggledAt` directly, which is the one thing the writers were getting wrong. Both writers stamped the clock on the way ON only, so past its first 2◈ a mode was a free toggle for the rest of the match — measured live, switched off and straight back on in the same Turn with no refusal (Ch. 46 §46.4-AT). **A gate's test passing says nothing about whether anything writes the state it tests**; the seam to check is the writer, and `test/unit/io-set-mode.test.mjs` runs it rather than handing the gate a stamp.

**Checking truthiness of an empty array in a branching condition.** A plain tick cooldown is compiled to `{max: "3◈"}` with no `branches` field. The schema's `ArrayField` turns `null` into `[]` automatically, so a truthiness check passes (`[]` is truthy) and the condition enters the branch loop, matches nothing, and returns no clock. Every cooldown in the game entered this trap: measured live at 49 of 49 abilities across six authored Servants, every one infinitely reusable. The defect arrived with branched cooldowns themselves (Summoning: Bašmu is the only ability to have any), so Servants verified before the feature shipped were verified correctly and broken as soon as it landed (`module/engine/cooldown.mjs:88-98`). **Check `.length`, not truthiness, when a field can be an empty array** (`module/engine/cooldown.mjs:99`).

## Open questions

- **Resolved: additive, deliberately, and fully wired.** The code states the reasoning in situ —
  the rulebook's prose and its pseudocode disagree, the prose wins, and under `max()` an NP Lock
  spent while the target was gated anyway *"costs the caster a Skill and buys nothing, which is
  precisely the outcome this clause exists to prevent"* (`module/rules/np-gate.mjs:134-151`). The
  input is real rather than notional: `gatedDelay` is declared on the schema
  (`module/data/item/ability.mjs:97`), accumulated by the cooldown writer as
  `(existing ?? 0) + ticks` (`module/engine/io.mjs:601`), read back at
  `module/rules/costs.mjs:293`, and correctly classed as world state rather than pack state
  (`module/content/authored-fields.mjs:123`). It is zero in every world until something raises a
  cooldown early, which is why no live board shows it yet.

- **Confirmed live.** The waiver fires, pays, and falls back. `cooldownFor` was run against an
  ability declaring `cooldownWaiver: {resource: "prs", amount: 1}`: holding **2** tokens waived the
  clock and emitted `resources.prs.value: -1`; holding the **last** token did the same; holding
  **none** produced the full `12` ticks (4◈ at three turns per Round) and no spend; and omitting the
  unit snapshot entirely also produced the full clock rather than throwing. The skip and the spend
  are emitted together, which is the property that matters — *"emitting the skipped clock without the
  token spent would make Scáthach's Rune Spells free for ever"*
  (`module/engine/skill-use.mjs:1258-1260`).

- **Who chooses when an optional cost is offered?** The Unit's owner answers; the GM is the fallback. The reference set has only one Unit with an optional cost (Mannanán), tested only by its author. `FGTSocket.ask` is a socket prompt, so the latency and answer path are system-level.

**No Mana Burst rides** (ruled 2026-10-14, #206, taking back #195 reading 4). `usedWithNormalAttack` offered Raikou's Mana Burst on a Riding Attack's ride. It is gone, and `engine/riding.mjs` refuses any ability that is not itself a ride (`notARide`), so the socket cannot take one either. Her Mana Burst stays usable as a Counter, being an Attack Skill.

### Wisdom of Dún Scáith's pick (#204)

**When.** The pick falls due when the war is built (`engine/war-setup.mjs` calls `engine/copy.mjs#markCopyPicksDue`
once the field is deployed) and when a copier's token enters a war already under way (the `copyPick` engine
listener). The GM's list opens by itself, and again on the GM's load while a pick is owed. `system.copyPick` holds
`{due, poolIds}`: no Turn ends while any Unit on the board owes one (`rules/budget.mjs#copyPicksOwed`), and the pool
is the other Servants on the field at that moment, the only ones a pick or a GM's redo offers. Only the GM opens the
list from the sheet or the bar. The list is the canvas's board, so a GM looking at another scene gets no list but a
line to open the War's scene, and the offer redraws on `canvasReady` (#256, §46.4-RV).

**What a copy is.** Servants' Skills only (`copyCandidates` keeps `kind: "servant"`). A copy takes its grant's terms,
`copyGrant {slots, cooldown, exclusionSet}` with the grant's Rank (`engine/copy.mjs#copyGrantSpec`, #326): Scáthach's
two at A+ and `4◈-⅓◈`, Chiron's three at the same. They were constants in the shared reader, and the dialog's count a
default of two, so Chiron's third pick was refused; the window and the player's prompt now take the grant's own name. A
copy carries its source's use (`carriedUse`: window, targeting, damage, phases) minus its rank, cooldown,
gates, `rules` and `passiveRules`: the Active part only. Its phases still run from the source by `copiedFrom`.
Refusal reasons are one list, `domain/enums.mjs#COPY_REASONS`; `named` is a family her sheet names (Mana Burst).
A Spell is not a Skill (ruled 2026-10-14): `canCopy` refuses one with `spell`, read by `rules/costs.mjs#isSpellAbility`
(`isSpell`, or the `spell` category), the reader Silence uses. The board now projects `isSpell` for it. Medea's six
Spells were all offered; her Active Skills still are.

### Damage that is no Attack, a kill, and the windows of a Process (#330)

A `strike` phase deals damage per Unit caught with no Combat Process: `amount` is a Count (`{count: {of: stacks,
effect}, per}`), a `branch` is asked with the caster and that Unit in scope, and the damage runs the defender's half
of the pipeline (`attack.mjs#standaloneDamage`, Ch. 22) with `component`, `isNP`, `pierce`, `ignoresDefUp`. Its card
row names the figure, what was dealt and the Health. A `defeat` phase defeats outright, the caster the killer, gated
by a `targetPredicate`; a phase's `target: master` is the caster's own Master (Legend of Dracula's *"Vlad will
immediately kill his Master"* inside Wallachia). An ability may be `freeAtWindow`: billed from the bar, free at a
timing window (Kazıklı Bey's Active 2, *"counts as Vlad's Attack for the Turn if used during his Turn"*). Two keys
act on the Attack a window use sits in: `cancelsAttackWhenDefending` (Ch. 21) and `forbidsCounterWhenAttacking`.
A third, `withdrawsWhenDefending`, takes its user out of the Attack at `defendingPhaseStart`: Disengage (#339 ruling 2,
Ch. 21).

### A template with the bearer's figures, and a pick (#339)

Disengage is one Skill at three Ranks (`abilities/disengage.yml`): each bearer passes `rank`, `move`, `heal`,
`removes` and `cooldown` beside the ref, and its sheet's own `description`. A `removeEffect` phase's `pick: n` removes
only `n` of what its selector matches, its user's pick by effect, never an Unremovable one; `0` or fewer matches than
`n` takes them all, unasked (`engine/skill-use.mjs#pickedCandidates`). A `rollTable` phase's `thenChoose: true` offers,
after the dice, one more row no die chose, or none: Rune Magic's *"then, you can apply one more effect of your choice
other than the one selected by the die"* (#339 ruling 4). Both are Skill-path keys: an Attack that carries one says so
in the console and goes on without it.

### A clock put back to full, and a gate on the NPs (#328)

A cooldown change with `restart: true` sets the clock to the full length a use would start, read through
`cooldown.mjs#cooldownFor`: Flawlessness's *"NP Cooldown is Reset"*, ruled a price (ruling 13). `abilityOffCooldown`
takes `scope: np` for *"only when NP is not on Cooldown"*. A Passive on its own clock is an `OnEvent` with
`ownCooldown`: heard only off Cooldown, and starting it when it pays out (Gyakkou, ruling 10). `StatDelta` takes
`percent` of the stat as it stands: Gyakkou's 10% of her current Max Health. What a revival's `unitRevived`
handlers did is a line on its revival card, by Skill (`scheduler.mjs#revivedSaid`): *"Gyakkou: Atk Up, Invuln
(Gyakkou), Planet Olga Marie −1, Max Health −180."* A phase its `predicate` holds back says why when it names an
`unmetLine`: Unparalleled's *"is not applied: another allied Servant has already Attacked this Turn."* A
non-stacking effect's charges are its definition's `uses`; an entry's `uses` counts only under `stacking: count`.

### Teaching a copy (#326)

Wisdom of Divine Gift's second Active is a `teach` phase (`engine/teaching.mjs`). The target is the learner, any other
Servant at range 1, allied or enemy. The teacher's player picks one of his copies the learner does not hold, by source
or as a copy (`teachableCopies`); a learner who has learned from him is refused (one Skill each). The learner's
controller agrees through a `confirm` prompt, unless one player holds both; a Servant with no Master agrees through
its player. Both then carry `cannotAct` and the same `system.teaching` record for the phase's `duration` (1◈). At the
boundary it ends, `runTeachings` gives the learner a copy of the copy (`copy.mjs#grantTaughtCopy`: same source, the
copy's Rank and clock, no lock, `taughtBy`), and the teacher keeps his. It is cancelled, with a line naming the cause,
when an enemy's Attack reaches its Damage Step on either (a Block counts; `cancelTeachingOnHit` at the Process's end),
when either is defeated (the applier's `defeat` case), or when a Move parts them (`attachTeaching`, a settled
`updateToken`). Damage that is not an Attack does not.

### A phase's target, and a self-only spec that includes a partner (#209 §46.4-NA, NC)

`engine/skill-use.mjs#phaseTargets` reads three targets: `self`, `reuse` and `linkedGroup`, the caster and every other
member of its group on the board (Mana Burst's *"restore 1 Agility and 1 Luck to both"*). `targetsSelfOnly` answers false
for a spec with `selection.alsoIncludes`, so Stars of the Chief God reaches the twin. `test/unit/phase-targets.test.mjs`
walks a `choose` option's phases too.

**Three phase timings and a table on the attack path** (#232). An `applyEffects` phase with `when: activation`
lands on its caster when a scheduled Noble Phantasm is activated (Enki's *"cannot Act for 1◈"*), and never at
its landing. A `zone` phase with `when: afterPhase` paints once the Combat Phase is over, over the area the
attack resolved against (`attack.mjs#paintAfterPhase`): Enki's Waterside must not raise its own Water damage
or worsen an Evade against it. A `rollTable` phase rolls on the attack path too, once per Unit hit, each row
landing through the one door; `entries` names one table for every DU where `tables` splits it by relation.

**The gate weighs what the use will charge** (#232, §46.4-OG). An ability's own costs may replace the NP cost
(`supersedes: [npCost]`); `canUseAbility` resolves them as the payment does (`resolveCosts`) and refuses only what the
charged costs, summed per pool, cannot meet. Enki's half of the Master's maximum, not an EX Rank's 100.

**Gilles de Rais (Saber) (#260).** Four pieces any later sheet can author:

- **`cannotActivate`**, the mirror of `cannotDeactivate`: a mode no hand switches on. His Mad Enhancement starts
  off and only Prelati's Encouragement's die switches it, for good (reading 2); `rules/modes.mjs#canToggleMode`
  refuses `cannotActivate`, and the sheet shows the toggle locked.
- **A phase `chance`**, rolled once for the phase, its die on the card whichever way it falls
  (`rules/phase-chance.mjs`): a number, or `{value, perPriorUse, max, label}` read against the whole-match use count
  before this use is recorded. Prelati's 15%, +15% a use, at most 90%.
- **A `setMode` phase is a card line** (`FGT.Phase.ModeOn`/`ModeOff`): Mad Enhancement turning on was a die and nothing else.
- **`abilityAllows`**: an ability usable while another named one of its bearer's is held and that one's own
  requirements pass (`rules/items.mjs`). *"Prelati's Spellbook ... Allows the use of the Spells"*: both Summoning
  Spells, shared with the Caster, read the Saber's Spellbook's `modeActive: madEnhancement` (reading 11). The board
  projects each ability's `requirements` for it.

### A duration set by name, and a chance moved by a condition (Vlad III (Berserker), #333)

- **An `effectDuration` phase** sets or extends the clock of named effects the Unit already holds
  (`rules/effect-duration.mjs#durationChanges`): `{effects, set}` puts each at now + the span, more left or less;
  `{effects, extend}` adds the span. An effect with no expiry has no clock to move. Each change is a card line,
  *"Atk Up (Shapeshift): 7 → 3 Turns left"*. Shapeshift's Passive 2, *"their duration is reset to 1◈ Turns"*
  (ruling 5), and Legend of Dracula's step 1, *"extended by 1◈ Turns"*. The build refuses both keys or neither.
- **A phase `chance` takes `modifiers`**, `[{add, predicate}]`, each added while its predicate holds of the user:
  Bloodsucking's 100%, 80% under Mad Enhancement. The build refuses a key `phaseChance` does not read.
- **A phase's `unmetLine` on a Day Round**: Legend of Dracula's Dracula is gated `not war:phase:day` and the card says
  *"No Dracula: Legend of Dracula was used in a Day Round."*

### A held object, a substitution and a form (Gilles (Caster), #323)

- **`weakPoint.kind: object`.** Prelati's Spellbook is aimed at instead of its holder: offered at declaration to an AU
  of AGI Rank C or higher (`aimRequires.agiRankAtLeast`), never once its `destroyedMark` is on the holder. Its own
  ladder is Ch. 21's `objectResolve`. `onDestroyed` dismisses the named summons unsplit and rolls a `transform` chance
  (`engine/held-object.mjs`).
- **`reactsToAimedObject`** offers a reaction only against an Attack aimed at that object, and **`substitutes`** makes
  it pay one named ability's full clock, Move its user, summon round the panel he left and rebind the Process to the
  one on it (`engine/substitution.mjs`). `abilityOffCooldown` takes **`any: true`**: one of the named off is enough.
- **`form` and the `transform` phase.** A one-way form (`system.formTaken`): `keeps` the abilities the sheet names and
  drops every other, passives and uses alike (`rules/form.mjs#keptByForm`, refusal `goneInForm`); `pools` are written
  on taking it (`io.takeForm`); `overrides` are read as a `summonVariant` branch's are, plus MOV, Base Attack,
  Attributes (replaced), Detect (`range`) and Sustainability `none`. `controller: gm` and `rangeGrows` are Ch. 24's and
  Ch. 25's. `creates: [large]` lets a Storm Border refuse it. What a form drops is still projected, as
  `formDropped`, and a requirement that names an ability reads it (`rules/items.mjs#gatedAbilities`): the Gigantic
  Horror's Spells keep reading the Spellbook itself (11i).
- **A refusal names what holds it.** `notHasEffect` names the effect in force, `abilityAllows` the ability that does not
  allow it (`rules/items.mjs#requirementDetail`).
- **A cooldown phase with its own `targeting:` on the attack path**, once per declaration: the Spellbook's *"Reduce the
  NP Cooldown of all allied Foreigner-class Servants within a 3 panel area of himself"*
  (`attack.mjs#applyTargetedCooldown`).

### Sieg's pieces (#345)

- **A phase asked of each Unit it reaches.** `targetPredicate` is common to every phase kind now, tested with the
  caster in scope before the phase acts on that Unit (`skill-use.mjs#runPhases`); it was the `defeat` case's alone.
  `target:isSelf` holds when the Unit is the caster: Heilen's 30% on himself and 15% on another are a phase each.
- **A window cast aimed at the DU.** `windowTarget: defender` hands the Process's DU to a cast taken at a Combat
  Process window (`attack.mjs#windowPlacement`); its `targetUnit` anchor asks the Range. Knacken *"at the start of a
  Combat Phase on the DU (needs to be within Range)"*. The attacker's Phase window opens before any Process, so the
  declaration hands it its single DU; an area of several DUs leaves the cast unaimed.
- **A cut on one random member of a category.** `CooldownDelta` with `category` and `pick: random` draws one of the
  bearer's abilities of that category on its Cooldown, its form's dropped ones included; the die is `pendingRolls`'s,
  one face per candidate, and the card says it beside the clock. None on its Cooldown is a card line of its own.
  Galvanism's Straße/gehen Spell.
- **Several value gates.** An action's `whenValue` may be a list, every gate to pass: Bridal Chest's Agility rises on
  the third Round and only while it has risen fewer than 4 times.
- **A Base Attack add by expression.** `BaseAttackModifier.add` may be an `@` expression: *"Base Attack (both) by 10
  (no limit)"* per growth counted.
- **A Turn-end Mode end and a cost under a condition.** `setMode` with `atTurnEnd` queues the end (`queued-ends.mjs`);
  an `additionalCosts` entry with a `predicate` is charged only while its user stands so. Akafiloga Argrise's usage 1
  as Fafnir.
- **A splash that cannot be Countered.** A damage block's `uncounterable` closes the Counter rung for that hit, as
  `unblockable` closes Block: Blasted Tree's *"these DUs can Evade/Block, but cannot Counter"*.
- **A magnitude that falls by the Turn.** An effect's `decay: {on: turn, per: turn, steps}` steps each Turn rather
  than each Round: Def Dwn (Knacken), 50 on its Turn, 25 from that Turn's end.
- **Current Health scaled.** A `statChange` with `percentOfCurrent` takes a share of the current: Fafnir's +300%.

### Rama's pieces (#347)

- **A Normal Attack made in a method a passive grants.** `normalAttackMethod` on an ability whose press is a Normal
  Attack (`countsAsNormalAttack`, its own `targeting` and `damage`): the use gate reads it as the Normal Attack
  (`rules/costs.mjs#useClassesOf` answers `attack`), so Seal stops it and Skill Seal and NP Seal do not. With
  `oncePerRound` it is spent once a Round. Rama's five Vishnu Bhuja passives: *"Once per Round, Rama can perform a
  Normal Attack at a Range of 4. Damage dealt is reduced by 30%."* One per swing, the player's pick, never a Riding
  Attack (rulings 2b, 2d, 2f).
- **An attack's own damage-dealt figure.** A damage block's `dealtModifiers: [{value, source, predicate?}]` joins
  the stage-4 bucket beside Atk Up (Ch. 22), never a Total cut: Sudarshana's −30%, Modhaki's +20% (ruling 2e).
- **An ability held by a summon roll.** `summonGrant` names the face of a Servant's `summonGrants` that gives it
  (Ch. 31).
- **A die that breaks an ability for the game.** The scheduler action `Expend {roll, on, abilities, label}` rolls its
  die (the caller's, `pendingRolls`) and puts it on the card either way; on a face in `on` it writes `expended` on
  each named ability of the bearer (`I.expend`), which the use gate refuses. Heard on `attackPerformed`, once per
  declaration after every Process, an Evaded one too (`ofContentId`): Pinaka's d6 and its Normal Attack's d12
  (ruling 4). `attackPerformed` now rolls its handlers' dice (`attack.mjs#fireAttackPerformed`).
- **The Attack that would defeat its holder, cancelled.** `CancelsLethalAttack {resource, percentPer, oncePerGame}`
  (Ch. 10, Ch. 21): Curse of Separation.
- **A `hasSkill` requirement names its Skill.** `name` beside `abilityId`: the refusal reads "Requires Martial
  Blessing, which this Unit does not have." (`rules/items.mjs#requirementDetail`); the Skill is the one thing the Unit
  lacks, so its name cannot be read off it (found live, #347).
- **A handler's stated line is its own words on the card.** `cardLine` logs land as outcome `note`, printed whole by
  `rules/card-visibility.mjs#effectLine`; as `noop` they read "...: not applied" (found live, #347).

### Karl de Große's pieces (#351)

- **A platform up, or not.** `platformActive {contentId, name}` and `platformInactive {contentId, name}` gate on a
  platform of that content its user owns, standing, wherever the user stands: Karl Cannons *"Only usable when Carolus
  Patricius is Active"*, Auctoritas's Usage 1 *"Cannot be used if Carolus Patricius is Active"* (reading 22). The
  refusal names the platform by `name`.
- **A share of the NP price and a sum on top.** `masterHealthByNPRank` takes `factor` and `plus`: Usage 1 while
  Usage 2 is Active pays the Rank's price and half again plus 30 (`factor: 0.5, plus: 30`), under
  `self:ownsPlatform:carolus-patricius-auctoritas` (reading 28).
- **One NP, a clock per usage.** Auctoritas is two abilities, each with its own cooldown; `abilityOffCooldown` on
  each names the other and Carolus Patricius, and Carolus Patricius names both (reading 23).
- **A refusal names what it waits on, on every path.** `abilityOffCooldown` is worded `CoolingNamed` with the
  cooling ability's name by the Attack path (`attack-preflight.mjs#usageRefusal`) and the Skill path (`useSkill`
  returns the usage detail, `refusalWords` reads it), as the bar already said it (found live).
- **A damage source on an owned platform.** `{unit: "platform:<contentId>"}` reads the Base Attack of that platform
  of the attacker's, falling back to the attacker when none stands, and the breakdown says `self` then
  (`attack.mjs#namedUnits`, `pipeline.mjs` stage 1): *"uses CPA's Base Attack"*.

### Tamamo (#353)

- **A push held to the ability's own maximum.** A `cooldown` change with `capAtMax` adds at most what the printed
  Cooldown leaves: Kōnisshō's *"cannot exceed max Cooldown in this way"*. An NP running now whose clock starts at its
  end (a field open, a platform up, a Mode on) is not pushed (`skill-use.mjs#cappedPush`, reading 4).
- **The `endField` phase** ends its user's own named field at the end of this Turn, through the Turn's queue, and adds
  `cooldownBonus` to the Cooldown the field starts then: Dainisshō ends Yata no Kagami *"and its Cooldown is increased
  by an additional 1◈ Turns"* (`fields.mjs#markFieldEnd`). Run in the caster pass.
- **A Crit Chance that grows** (`critChanceGrowth: {perMiss}`): each use whose Crit coin comes up no Crit adds
  `perMiss` for the next, and a Crit resets the count (`critMisses`, written on the Item). An Evaded or Missed use
  flips no coin and counts nothing (Yata Strike, reading 19).
- **Mantra Tokens** are Scáthach's PRS Tokens by another name: `cooldownWaiver: {resource: mantra}` on Enten, Hyōten,
  Mitten and Raitei; the four lock each other through `abilityOffCooldown` over a category.
