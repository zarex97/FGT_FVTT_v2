# 32 — Relationships, Overpower and the multi-Servant tax

## What it is

The Master–Servant relationship is the binding between a Master and one or more of its Servants. It costs the Master Health in two ways: when multiple Servants act in the same Turn (the multi-Servant tax), and when they fail to stay within the Master's Effective Servant Zone (ZON). In return, the Servant gains access to Command Spells and a shared pool of Health when contracting to an ally.

The **Overpower** mechanic governs when a Servant attacking a Master can instantly defeat it — a 50% coin flip that is reduced by the Master's defensive effects. **Underpower** applies the opposite penalty: a Master attacking a Servant risks having its damage halved on a 50% flip, reduced by the Master's offensive effects. Both are directional — neither applies when both combatants are Servants or both are Masters.

**Sustainability** is a Servant's internal clock that ticks down when it spends itself on a Noble Phantasm outside a contract. Contracted Servants draw this cost from their Master's Health instead. When a Master is defeated, its Servants become Free and begin counting down; a Servant with zero Sustainability disappears immediately, but one with `null` (no clock) persists indefinitely.

**Linked groups** are two tokens that count as one Servant for the purpose of counting Units — each member has a `unitWeight` of 0.5, so the Dioscuri acting together do not trigger the multi-Servant tax. They share a leash distance and are subject to a `linkedDeath` rule. This is a general mechanism, not a Dioscuri special case.

## Where it lives

| File | Role |
|---|---|
| `module/rules/relationships.mjs` | Overpower, Underpower, Sustainability, and the multi-Servant tax |
| `module/rules/master-rank.mjs` | Tiers (High, Low, Rankless), parameter grants, and the cheaper NP cost column |
| `module/rules/linked-group.mjs` | Group membership, partners, leash, `unitWeight`, and board annotation |
| `module/rules/zon.mjs` | ZON radius calculation, Master lookup, and outside-zone status |
| `module/rules/contract.mjs` | Contracting rules, roll requirements by Independence Action rank, conquest on kill |
| `module/engine/contract.mjs` | Contract execution — rolling, applying, and the conquest flow |
| `module/engine/io.mjs` | Writing contract state and Sustainability changes; calling `onMasterDefeated` when a Master falls |
| `module/data/actor/_shared.mjs` | `sustainability` field as a `TickField` and `sustainabilityRemaining` tracking |
| `module/settings.mjs` | `grandOrder` — a Grand Order war disables the multi-Servant tax |

## How it works

### Contracting and conquest

A Master or Caster may attempt to contract a Servant by moving adjacent and rolling against it. An ally Servant contracts automatically; an enemy Servant requires 1d6 rolls at difficulty 5+, increased to 4 rolls for Independence Action A, 3 for B, and immune (Infinity) for A+ or EX (`module/rules/contract.mjs:93-138`). A successful contract grants three Command Spells scoped to that Servant and freeing the previous Master's contract chain (`module/rules/contract.mjs:227-235`). A Caster is any Unit whose `servantClasses` holds `caster`; the rule read a `servantClass` field nothing projects, so no Caster could contract or claim a kill (#198).

When a Master is killed, its Servants become Free **and** any Servant of the killer within 2 panels of its own Master immediately contracts to the killer in a **single transaction** — ensuring no Free state is observed (`module/rules/contract.mjs`).

Conquest is decided by the defeat write path **before** anything is freed, and the ordering is correctness rather than preference: the selector claims Servants by `masterId === deadMaster.id`, and the freeing pass nulls that field as it goes, so a conquest resolved afterwards would find nobody. The killer travels on the defeat intent itself (ADR 0002); `null` means nothing killed it — a bounded field, the Nameless Forest's death roll, Sustainability running out, a linked partner's death — and those free as before, because Conquest needs a claimant and a Master who starved was killed by nobody. Only **Servants** are conquered: a Summon belongs to the Servant that summoned it and follows its summoner.

**A contracted Servant serves its new Master's side** (#190): a contract, and a Conquest, write the Master's `factionId` onto the Servant. **And a Conquest says so** (#179): a public card follows the dead Master's defeat card, naming the Servant, its new Master, the side it now fights for and the Command Spells that pass with it (*"Conquest: Assassin is now contracted to Caster and fights for Blue. Caster gains 3 Command Spell(s) usable only on Assassin."*), and a refused Conquest names its reason (`FGT.Conquest.Declined.*`). Built while the board still shows the Servants under the dead Master (`engine/io.mjs#conquestCardContent`), posted after the defeat card. Both wrote the Master alone, so Penthesilea, conquered by Karna's Master, went on fighting for the faction that had lost her. A conquered Servant never becomes Free, so none of the consequences of being Free apply to it — no mode lock, no Mad Enhancement Sustainability charge, and no instant defeat at zero Sustainability. **Conquest therefore saves a Servant that would otherwise vanish with its Master.** The world setting `conquestSparesServants` (default on) carries this; switched off, a conquered Servant pays those costs anyway, and is still never Free.

### Attacking a guarded Master

Ruled 2026-10-04 (#181): the rulebook's three cases, for every targeted Attack (Normal Attacks, Attack Skills, single-target Noble Phantasms), with `guardsOf` deciding who guards, so Pale Rider's Kagome Spirits stand in for him, he guards nobody, and a charmed Servant guards nobody. An area Noble Phantasm keeps the AoE cover rule below.

1. **A guard within 2 of the Master and within the attacker's Range**: only the guard can be targeted, and with two the attacker picks. Refused at targeting (`rules/targeting/resolve.mjs#isProtectedMaster`, through `rules/master-guard.mjs#guardsInRange`).
2. **An adjacent guard out of Range**: the Master may be targeted, and at the start of the Combat Phase the target becomes the adjacent guard nearest the attacker, the first in board order on a tie.
3. **A guard within 2, neither in Range nor adjacent**: at the start of the Combat Phase each such guard makes an Agility Check against the attacker (the contest's table, the Agility Check's own plan), nearest the Master first and on a tie nearest the attacker, until one succeeds. It moves to the free panel next to its Master nearest itself, ties nearest the attacker, and takes the Attack. A guard that cannot Move makes no check; with no free panel, no check is made.

Cases 2 and 3 run in `engine/master-guard.mjs#guardMasterTarget`, called from `declareProcesses` for a declaration whose anchor is the Master, never for a Counter (Ch. 21 has its own redirect). Each posts a public line with the rolls and logs `masterGuard`. Until now the engine refused whenever a guard stood adjacent, which is case 2's condition with case 1's answer. Test: `test/unit/master-guard.test.mjs`.

### Overpower and Underpower

`overpowerCheck` determines whether a Servant's attack on a Master can instant-defeat it: a 50% coin flip reduced by 10 for Def Up or Dmg Cut, blocked entirely by Invuln or Shield, and by Anti-Purge and Substitution, which beat Invuln (#184) (`module/rules/relationships.mjs#overpowerCheck`). `resolveOverpower` folds in a Luck Check that covers both the flip and the lethal damage that follows, making it disproportionately valuable (`module/rules/relationships.mjs:76-82`). A Master knocked off a Platform flips the same coin on landing, *"as though Attacked by a Servant"* (`engine/platforms.mjs#toIntents`, §46.4-CD). **The Master's Luck Check is offered before the flip** (ruled 2026-10-19, #111): `engine/overpower-save.mjs#offerOverpowerSave` asks the Master's player, on a Servant's Attack and on a fall alike; it costs 1 Luck whatever the d20 says, and it is not offered where the difficulty removes Luck Checks (Beginner, Intermediate), where a rule blocks them, or with no Luck. A pass stops the flip and leaves the Master at 1 Health against lethal damage. The card carries the check beside the coin: *"Overpower: Luck Check 11 vs 14, passed (Luck 14 → 13) — no flip, survives"*, or on a fail the check and then Heads or Tails. `resolveOverpower` modelled the save from the start, and nothing had ever offered it. No coin is rolled after a pass. Pressed live on both doors: Medea's Attack on a Master at 213 (*"Luck Check 11 vs 14, passed"*, left at 1 Health), and a Master knocked off the Hanging Gardens (*"makes a Luck Check against Overpower: 7 vs 19, passed. No flip. Luck 19 → 18."*).

**Any Servant's Attack on a Master flips the coin, and the card shows it** (ruled 2026-10-02, #65 ruling 21, #174). An allied Servant flips it too: Quetzalcoatl's own Xiuhcoatl splash on her own Master is a flip, so `overpowerCheck` keeps its kind test and has no relation test. The flip used to defeat a Master with nothing on the card. Now `engine/attack.mjs` stamps `result.flags.overpower` (`{roll, chance, heads, saved}`) whenever the flip applies, `rules/explain.mjs#overpowerText` words it, and `templates/chat/attack.hbs` prints it beside the Injury line: *"Overpower: Heads (23 ≤ 50) — Master defeated"*, *"Overpower: Tails (71 > 50)"*, or *"Luck Check passed — no flip, survives"*. A Master the flip defeated keeps his Health, so the Counter rung asks `system.defeated` as well as Health before it offers him a Counter (`engine/attack.mjs#counterAvailable`); pressed live, a Heads at 117 / 340 had asked him *"Counter-attack?"*.

Underpower applies when a Master attacks a Servant: 50% chance its Total Damage is halved (×0.5), reduced by 10 for Atk Up or NP Dmg Up. A Master with a suppression scoped to `underpower` cannot be underpowered at all (`module/rules/relationships.mjs:96-139`).

### Sustainability

A Free Servant spends Sustainability to use a Noble Phantasm, charged by the NP's rank: E 1◈, D 2◈, C 3◈, B 4◈, A 5◈, EX 6◈, in Turns against the clock (`module/domain/tables.mjs`; it charged the bare number, a third of the price, until #241). Contracted Servants draw this cost from their Master's Health instead; the Master does not have a Sustainability clock.

When a Master is defeated, `onMasterDefeated` frees every contracted Servant and resolves its clock. A Servant with `sustainability: null` (authored as no clock) stays indefinitely; one with `0` disappears immediately; one with a number counts down and disappears at zero (`module/rules/relationships.mjs:161-201`). If Mad Enhancement is active, the clock costs an additional 2 turns (`module/rules/relationships.mjs:194-199`). The Sustainability field is a `TickField`, stored as an expression like `"2◈"` and resolved to turns at snapshot time (`module/data/actor/_shared.mjs:290`).

### The multi-Servant tax

At the end of a Turn, if more than one Servant has Acted, the Master loses 25 Health as a loss (not damage); in the Normal ruleset, 20 per additional Servant, banned at 20 (`multiServantRule`, #241 reading 15). In a Grand
Order war neither applies; the tax and the ban both read the board's `grandOrder` (§46.4-PN). A tax that empties a
Master defeats it (`defeatsAtZero`, ruled 2026-10-17): nobody's kill, so no Conquest, and its Servants go Free. The
ban does not prevent it: a Normal Master at 21 may order three Servants, and an Advanced one may be hit between the
order and the Turn's end. The Turn-end card says the death (`turn-report.mjs`, §46.4-PP).

**A Free Servant's modes are held as they were** (Ch. 32's *"remains in whatever state it was in"*): the death writes
`modesLocked`, the snapshot projects it, and `rules/modes.mjs#canToggleMode` refuses a switch either way with
`modesLocked`, so the bar and the sheet say *"Mad Enhancement stays as it is: its Master is defeated, until a new
Contract."* `io.setContract` clears it when the Servant is contracted again. Until #333 only the sheet's badge read it,
and Vlad III (Berserker) switched Mad Enhancement off after his Master fell (live).

**A new Contract restarts the Free clock** (ruled 2026-10-17, #241): *"the number of Turns a Servant can remain on
the field before disappearing after its Master is killed"*, once per death. `io.setContract` clears
`sustainabilityRemaining` when a Free or Unbound Servant is contracted to a Master it did not serve, so the next death
reads the sheet's Sustainability, plus that Master's High Rank +1◈ or less Mad Enhancement's −2◈. Semiramis keeps her
Hanging Gardens' +2◈ while they stand (`hgob.mjs#restartedClock`). A Scáthach freed twice went Free again with what was
left of her first clock (§46.4-PQ), bypassing all reduction effects (`module/rules/relationships.mjs:236-253`). The tax is **flat**, not per-Servant — acting with five Servants costs the same 25 as acting with two. Units are counted by `unitWeight`: a Dioscuri member is 0.5, so the pair acting together does not trigger it.

A Master with 25 Health or less cannot order a second Servant to Act if one has already (`module/rules/relationships.mjs:267-279`). This prohibition is the flip side of the tax: it prevents a Master from spending to zero in the same Turn.

The `grandOrder` setting disables both the tax and the prohibition, and also disables Hatred of Achilles against allies. That last half was only a comment until #190: nothing read the setting, so Hatred reached allies in a Grand Order war. The board now carries `grandOrder`, and Hatred's compulsion declares `spareAlliesInGrandOrder`.

### Linked groups

Two Servants in a `linkedGroup` are one unit for counting purposes. Each carries `linkedGroup.memberIds`, `leash`, `linkedDeath`, `sharedCooldowns`, and `unitWeight`. `partnersOf` returns other members on the board; `partnerDistance` gives Chebyshev distance to the nearest partner, or `null` if none are present (`module/rules/linked-group.mjs:31-56`).

`leashBroken` returns true when a partner is further than the leash allows — a state that only occurs after forced displacement, since voluntary movement refuses such a panel (`module/rules/linked-group.mjs:59-76`). `annotateLinkedGroups` runs in the board snapshot pass and populates `partnerIds`, `partnerDistance`, and `leashBroken` for every unit (`module/rules/linked-group.mjs:106-125`).

When `zonSatisfaction` is `"any"`, one partner satisfying ZON satisfies both — unioned into `zonPartnerIds` so `zonStatus` can read it without change (`module/rules/linked-group.mjs:115-122`, `module/rules/zon.mjs:146-156`).

A group with `sharedCooldowns: byName` **has one clock per shared name** (#209 reading 2, ruled 2026-10-14): a use starts it on both copies, a cut by either twin — Self-Replenishment, Mana Burst, the Castor buff, the Divine Core's 5%, a Command Spell, an enemy's increase — reaches both, and the per-Turn tick runs at one rate for both, so NP Regen, NP Lag, NP Lock or Stop on one twin act on both (`engine/cooldown.mjs#sharedCooldownIntents`, `scheduler.mjs#advanceCooldowns`, Ch. 17).

A group summoned together (`summonTogether`) **shares one war slot** (#209 readings 1 and 8, ruled 2026-10-14): the Dioscuri sit in a Saber slot, Pollux drawn into it and Castor, an Avenger, arriving as her *companion* — never drawn alone, never an Avenger or `EXTRA` candidate (`rules/war-setup.mjs#catalogueEntryOf`, Ch. 31). Both carry `classContainer: saber`, so an enemy reads Saber on both until the True Names are revealed, and war setup seats the second twin on the first one's side, under the same Master and beside it (`engine/war-setup.mjs#seatPartners`, §46.4-D3).

### Legions: one Servant who is many Units

A `linkedGroup` with a `legion` block (`size > 0`) is a Servant drawn from one pool of bodies (#226, Hundred-Faced
Hassan, ruled 2026-10-16). The count is the **Master's**: `system.legions[key]` holds `size`, `remaining`,
`nextNumber`, `fieldCap`, the `template` every body is made from, and `clocks` held while no body stands. The Master's
page prints it as the sheet asks, *"Hassans: 57/100"*. Each body is a Servant actor of its own, `Hassan N` in the order
it is deployed, carrying `legionKey` and `legionNumber`; a number is never reused, and a revived body keeps its own
(reading 27). A body in reserve is not an actor: it is `remaining` less the bodies on the field
(`rules/linked-group.mjs#annotateLegions`, from `engine/board.mjs#legionPoolsOf`).

- **War setup** makes the summoned Servant body 1 and brings the Master's pick of 1 to `openingMax` into the Home Base,
  every body with the one Agility and Luck roll the summon made (readings 3, 5, 18; `engine/legion.mjs#startLegion`).
- **A Round's start**, from Round 2, offers the Master's player free panels by war type: a Great Holy Grail War, the
  Master's half; any other, within 2 panels of the Home Base (readings 4, 23; `rules/linked-group.mjs#deployPanels`,
  `engine/legion.mjs#offerLegionDeploys`). At most `fieldCap` stand at once. A new body arrives full, without Presence
  Concealment, and on the hundred's shared clocks. Only a legion in this war is offered: its holder or a living body on
  this board (#230: a Master from another war's scene was asked at every Round of Arturia's).
- **A body that falls** goes through the whole defeat chain, Guts included; one that stays down is −1 and leaves the
  board. Only the last is the Servant's defeat, for the Grail as for everything else (readings 1, 20, 21;
  `io.defeat`, `engine/legion.mjs#survivesBody`, `#bodyFell`). With none on the field and some in reserve he is alive,
  off the board, until the next Round's deploy (reading 22).
- **One Servant, many Units.** A Command Spell names one body; the Contract, a Conquest and Sustainability are the
  hundred's: a Free hundred whose Sustainability runs out ends whole (reading 17; `engine/legion.mjs#exhaustLegion`).
  ZON is checked per body.
- **Shared clocks** are `sharedCooldowns: byName` with `ownCooldowns` naming the slugs each body keeps for itself:
  Presence Concealment and Battle Retreat (reading 9). NP Regen on several bodies ticks the shared clock by the
  strongest, never the sum (`scheduler.mjs#sharedClockOf`).

## Traps and anti-patterns

**A complete, tested rule that no engine path reached.** `conquestContract` was written, documented
and unit-tested, its engine wrapper existed, and **nothing had ever called either** — so every killed
Master's Servants were simply freed, which is the *opposite* of what Ch. 32 says. The wrapper's own
docstring named the call site it was waiting for. Fixed in
[#27](https://github.com/zarex97/FGT_FVTT_v2/issues/27); same shape as #19, #24 and #28.

**Filtering on a field the step before you just rewrote.** The freeing pass selects the dead Master's
Servants with `masterId === deadMaster.id`. Conquest must run first — and conquest *writes*
`masterId` on everyone it claims, so collecting that list after it silently drops exactly the
Servants whose remaining consequences still had to be decided. Invisible while the default spares
them (they are owed nothing) and a silent skip the moment a table switches `conquestSparesServants`
off. Measured live, in the one configuration that shows it. **Collect the set you are iterating
before any step that mutates what it selects on.**

**A Master who cannot be Overpowered (#230).** A `Suppress` of scope `overpower` on the Master answers Overpower with
*does not apply* (`relationships.mjs#overpowerCheck`), as the Vorpal Blade's `underpower` does the other way: Avalon
inside a Master.

## Invariants & edge cases

**Independent Action at EX or A+ refuses Conquest** (#258 reading 12) as it refuses an enemy's Contract: a dead
Master's Servant holding it is left out of the killer's claim and goes Free, and the Conquest card says why. Rule
Breaker is neither, and takes its Contract (`conquestContract`'s `refused`).

**Whoever holds a Contract is a Master** (#193 readings 18, 21). Medea's Rule Breaker makes her the stolen Servant's Master: the Contract and three namespaced Command Spells go to her (`commandSpellsPerServant` is declared on Servants too, and `servantIds` since #258: without it Medea's side of the Contract was silently dropped, §46.4-SK), the Servant's Noble Phantasm cost is charged to her Health, the multi-Servant tax bills her, and her defeat frees or conquers her Servants. Each of those readers had tested for a `master` actor.

1. **Overpower and Underpower are directional.** Neither applies when both units are Servants or both are Masters. Zero chance and "does not apply" are different facts (`module/rules/relationships.mjs:43-46`, `module/rules/relationships.mjs:96-99`).

2. **`null` Sustainability is not zero.** A Servant with `null` has no clock and stays indefinitely; one with `0` disappears immediately (`module/rules/relationships.mjs:171-183`).

3. **The multi-Servant tax is a loss, not damage.** It bypasses every reduction effect and is tracked by `isLoss: true` in the intent (`module/rules/relationships.mjs:250-251`).

4. **Linked groups count Units, not Servants.** Two 0.5-Unit Dioscuri acting together make 1.0 Unit total, which does not exceed the "more than one" threshold (`module/rules/relationships.mjs:244-246`, `module/test/unit/relationships.test.mjs:237-240`).

4a. **A defeated Servant guards nobody.** `guardsOf` skips it, so the protection, the Counter redirect, the zone denial and the cover that read it all stop at once; a defeat leaves the token on the board (#168).

5. **Conquest happens in one transaction.** A free Servant and a new contract must be written together; no intermediate Free state is observable (`module/engine/contract.mjs:79-82`).

6. **Partner satisfaction is unioned, not intersected.** When `zonSatisfaction: "any"`, all members benefit if any partner is within ZON (`module/rules/linked-group.mjs:115-122`).

## Traps and anti-patterns

**Reading the wrong shape for Mad Enhancement's active state.** `onMasterDefeated` charged -2◈ when a field `modes: ["madEnhancement"]` was present, but no snapshot, applier or schema ever produced that shape. The snapshot projects `abilities`, each with `slug` and `active`, which is what the Servant document actually carries. **Use the shape the snapshot produces, not a hypothetical one** — a test that passes against a wrong fixture is a false green (`module/rules/relationships.mjs:194-195`, `module/test/unit/relationships.test.mjs:135-147`).

**...and then fix the caller too.** The entry above was recorded as fixed when only the *rule* had moved to `abilities`: `engine/io.mjs`, its one caller, went on building `modes` and never started building `abilities`, so the clause stayed permanently false by a second route and this chapter said otherwise. Measured live on the same Servant side by side — called the way io calls it, the function returned `setContract` and `lockModes` and nothing else; called with `abilities`, it returned those and the Sustainability charge (Ch. 46 §46.4-AS). **When a rule changes the field it reads, the sites that build that field are part of the change**, and a rule whose fixture is now right is still unreachable if its caller feeds it the old shape.

**Charging a ◈ amount against a clock measured in Turns.** The same clause carried a bare `delta: -2` against `servant.sustainability`, which the function's own guards insist is the RESOLVED clock — 6 Turns for a 2◈ Servant at three Turns to the Round. The sheet says *"reduced by 2◈ Turns"*, so the charge was a third of what it should be and a Servant survived a Master's death it should not have. **One denomination for the whole descriptor stream**: `onMasterDefeated` takes `turnsPerRound` and emits Turns, and the caller adds no arithmetic of its own — which is how the two came apart in the first place.

**Passing Sustainability as a string to `onMasterDefeated`.** The authored field is "2◈"; when passed unresolved, arithmetic like `Math.max(0, "2◈" + -2)` produces NaN, silently defeating a Free Servant with time left. **Resolve the Sustainability field through `snapshotUnit` before calling this rule** (`module/engine/io.mjs:1227`). *Fixed: io.mjs now resolves the field before passing it.*

## Open questions

- **Confirmed by the return shape.** `resolveOverpower` answers both questions in one object: a
  passed check returns `{defeated: false, survivesLethal: true}`, while a failed or absent one returns
  `{defeated: roll <= chance, survivesLethal: false}` (`module/rules/relationships.mjs:76-82`). So a
  single Luck Check both prevents the instant defeat **and** carries the unit through the lethal
  damage that would otherwise follow -- there is no second roll, and no path where one half applies
  without the other.

- **Still open, and it needs a forced displacement to settle.** The state is entered on forced
  displacement; what is untested is the return path -- whether a knockback that pushes a member back
  *inside* the leash reads as healed or stays broken. Settling it means applying a real knockback to a
  linked member in both directions, which needs a board carrying a linked pair. No such pair is on the
  live scene.

- **Why the `grandOrder` setting?** A Grand Order is a multi-Master collaboration against a single threat, where the multi-Servant tax and intra-alliance Hatred would make cooperation expensive. The setting is checked in every place these rules fire, but no narrative document exists for when and why a GM should use it.

### Cover against Gate of Skye, and the coin (#204)

`damage.noCover`: a failed shove is no Cover. The group records `{masterId: null, uncoveredMasterId}`, a line on the
board names the shove's rolls, and the Master takes its own Luck Check; no Servant takes +100%. A Master the cover
record shelters (shoved clear, or covered) is not flipped for Overpower.

**Who guards a Master** (ruled 2026-10-14, §46.4-LH): only the Servants contracted to it. `rules/relations.mjs#guardsOf`
read the whole side from the first targeting code, so Heracles shoved another Master's Master clear. Every reader
follows: the protection, both step-ins, the shove and the Counter redirect. Pale Rider's Spirits and the charmed
Servant keep their rules.

**The binding at the one door** (#209 §46.4-NI). `engine/io.mjs#defeat` defeats a `linkedDeath: ignoresRevival` Unit's
partners (cause `linkedDeath`), whatever wrote the defeat: the Sustainability sweep, Instakill, Erase, a Command Spell, a
field. The scheduler's `linkedDeathIntents` still logs the binding on the damage path; a partner already down is left. A
Unit defeated twice is counted towards the Grail and frees its Servants once; its first cause stands.

### Master content (#241)

- **An Essence follows the Contract.** Its Master holds the Essence; the Servant holds a copy, `grantedBy` its Master
  (`engine/master-essence.mjs#syncEssences`), made and removed by one hook on `system.masterId` and `system.defeated`.
  A new Contract brings the new Master's Essence; a Master's death takes it. Losing a maximum cuts the stored current
  to it and no lower; a gain mid-war raises the maximum only; the summon starts the Servant full (readings 3, 5, 6). A
  whispered line names what was gained or lost. A Master never collects its own Essence's rules.
- **A High Rank Master's +1◈ Sustainability** is added at its death, to the clock that death starts (reading 4,
  `onMasterDefeated`, netted with Mad Enhancement's −2◈ in one write).
- **A Normal Free Servant's NP** states its own price (`freeServantCost`): it disappears as the Combat Phase ends,
  with a line (`attack.mjs#freeServantAftermath`), or its Archer's and Caster's NP (a) costs 2◈. An Advanced Free
  Servant with no clock pays in its own Health and is never refused; reaching 0, it disappears at the Phase's end
  (Appendix B).
- **Kill Humans' Contract half** (reading 16): a spend that leaves the marked Servant Unbound frees it at once, with a
  line (`io.spendCommandSpells`); `canAttemptContract` and a Conquest refuse the Master who ordered it.
- **An Unbound Servant is derived, never stored** (`snapshot.mjs#annotateMasterRank`, from `isUnbound`): the
  Contract rule and dialog read the board's `unbound`, so an ally is refused and an enemy contracts it on a 6 (§46.4-PM).
- **A Contract attempt runs on the GM** (`attemptContract` socket operation): from a player's client it could not write
  the match log and failed in silence (§46.4-PG).
- **The Underpower coin is on the card**, Heads or Tails, as Overpower's (§46.4-PJ).

- **Revised Mad Enhancement's clause 5** (#260 reading 3): *"If this Servant's Master is defeated while ME is active, ME
  cannot be deactivated and its STN is reduced by 1 additional Turn at the end of every Turn."* `onMasterDefeated` takes the
  War's `revisions`: under Classic it charges the 2◈ once; under Revised it charges nothing then and writes
  `sustainabilityDecay: 1`, and `checkRemovals` takes `1 + sustainabilityDecay` at every Turn's end. The lock is the
  `lockModes` this chapter already writes.
- **The death's card** (#260, live). The Servants nobody claimed get one card, posted by `io.defeat` after the Master's
  defeat card and the Conquest's: *"Saber is Free, with 9 Turn(s) of Sustainability left."*, the modes held, and the
  clause 5 Mad Enhancement played (`FGT.Free.*`). `onMasterDefeated` names the clause it played as a `note` descriptor
  beside the write, and `freedLines` words the descriptors. Before it the death wrote the clock, the decay and the lock and
  the table read only *"No Conquest"*.
