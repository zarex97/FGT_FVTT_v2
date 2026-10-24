# 37 — Chat cards, the game log and card visibility

## What it is

Attack cards are the visible surface of the whole engine. The card itself is the audit record: the process state and the damage breakdown live on message flags, so a match can be replayed from its chat log alone (`module/apps/chat/cards.mjs:2-8`). That is also what lets the reaction ladder resume after a reconnect.

Cards are not documents; they are ephemeral by Foundry's design — they scroll away, get cleared, interleave with out-of-character talk. The game log is the record that survives all three, shaped from the same events but stored durably on the Combat document (`module/engine/game-log.mjs:1-12`). The log records what happened, with optional GM overrides that show both the original and changed value.

A single card is read by many viewers, and each reads a different version of the same message. The redaction is by side, not by name: a row nobody claimed is a fact about the board (a facing bonus, terrain) and stays visible to everyone — dropping it would change the arithmetic a viewer can check, which is worse than revealing it (`module/rules/card-visibility.mjs:16-19`). Two visibility modes exist: "filtered" is one message that every client renders differently (fast, simple), and "strict" creates separate whispered messages per audience (slower, actually secure) (`module/rules/card-visibility.mjs:32`).

## Where it lives

| File | Role |
|---|---|
| `module/apps/chat/cards.mjs` | Creating and updating attack cards; redacting breakdowns per viewer |
| `module/rules/card-visibility.mjs` | Computing what each viewer should see: `cardFor`, `skillEffectsFor`, `redactBreakdown` |
| `module/rules/roll-log.mjs` | Roll records: every roll, what moved it, and what replaced it |
| `module/rules/game-log.mjs` | Log entries, appending, GM overrides, export payload (rules layer) |
| `module/engine/game-log.mjs` | Writing the log, flushing to Journal, exporting (engine layer) |
| `module/rules/explain.mjs` | Rendering damage breakdown into displayable rows |
| `module/apps/log-viewer.mjs` | The game log viewer — filtering, searching, exporting, applying overrides |

## How it works

### Building and updating cards

`renderAttackCard` creates a new attack message with the card context and stores process state on message flags (`module/apps/chat/cards.mjs:26-50`). `updateAttackCard` re-renders the card when the process advances, pulling state from the message flag and refreshing the template context (`module/apps/chat/cards.mjs:57-74`). The deadline for timeouts is stored on the message itself, so two clients cannot disagree by clock drift (`module/apps/chat/cards.mjs:67-69`).

### Card visibility

`cardFor` determines what one viewer should see, given a result and their role (`module/rules/card-visibility.mjs:44-75`). The attacker and defender see the header and their own damage total; a bystander sees only the header. The breakdown is shown only to those involved; the defender learns what effects landed by name (`module/rules/card-visibility.mjs:55-67`). Each roll carries its own visibility flag; a GM-only Discover roll on a card everyone can read would give away the Assassin's panel for free, so rolls are filtered per-viewer (`module/rules/card-visibility.mjs:71`).

**A row says whose it is** (#202, #239). An attack card's effect rows carry the Unit they landed on, and a viewer
reads by name the rows of Units they control (the GM and an open table read all); a row with no Unit is the
defender's, as every row was. The rest are a count beside the names. So the attacker reads the 'Gogh' buff's Atk Up
it just gained, and the defender only that something was gained. A Skill card's rows go to the caster's controllers
and each recipient's; both name a Unit by its public name, since the caster's player reads every row.

**What a handler did is a line** (#202). `engine/applier.mjs#applyIntents` returns `lines`: what a handler's batch
landed (the landing's own summary, applied or resisted), the stages it took (`Curse: Stage 10 → 8`), the clocks it cut
(`Name: Cooldown 12 → 10`), the heals it gave (*"Lancer regains 312 Health (Legend of Dracula (Activated))."*, the
turn report's words, as given against the maximum, the source by `EffectRegistry.nameOf`; #330) and the stats it moved
(`Agility 16 → 15`), and what the handlers its writes raise did in
turn (Channel Marker Soul's cut on each Curse landing). The attack path prints them on the Process card
(`damageStepStart`, `damageDealt`, `damageTaken`, `damageStepEnd`, `attackLanded`, `attackPerformed`, and the damage
batch with its defeat: `unitFelled` and `unitKilled`), a Civilian's death under its defeat card
(`defeat-card.mjs#postLinesCard`: Ch. 06's bounty and the killer's `unitKilled`), a Skill on its
card after the phase that raised them, and a Turn's or a Round's end on its card. A Turn's end posts the periodic card
too (*"End of the Turn — Foreigner takes 63 from Curse"*), by the effect's name. **A removal a rule makes is a line** (#258): an event's `RemoveEffect` marks its intent `byRule`, and `removalLines` prints *"Soaked: removed"*, for a Day Round drying it and Fire using it up alike; an expiry is not one. A Noble Phantasm's removal phase lines each effect it took and each it could not: *"Atk Up: resisted, rolled 7 vs 0%"* under BuffRemoval ResUp (§46.4-SI).

`redactBreakdown` removes side-specific contributors but preserves the arithmetic: stage deltas and running totals stay visible so a viewer can check the numbers add up (`module/rules/card-visibility.mjs:139-155`). Contributors with no side are board facts and remain visible to everyone. `hiddenContributors` is a count rather than silence — something happened here and it was not yours (`module/rules/card-visibility.mjs:150-152`).

### The game log

Log entries are validated by kind on construction — a typo'd kind ends up invisible in the very place someone is looking for it (`module/rules/game-log.mjs:29-38`, `module/rules/game-log.mjs:56-74`). The last 200 entries live on `Combat.system.log` for quick access; older ones flush in batches of 100 to a JournalEntry (`module/engine/game-log.mjs:7-12`).

A GM override records both the original and changed value, with a required reason — an unexplained override is indistinguishable from a bug, so a log that permits one cannot be trusted (`module/rules/game-log.mjs:92-97`, `module/engine/game-log.mjs:55`). Sequence numbers are stable; an override references the entry it modified by `seq`, so renumbering on append would silently repoint every override at a different entry (`module/rules/game-log.mjs:14-16`).

### Rolls and rerolls

Every roll is recorded with raw roll, total, and modifiers (`module/rules/roll-log.mjs:25-35`). A GM re-roll keeps the original in the log — Principle P6 permits it; the log shows **both** so a re-roll passes unnoticed (`module/rules/roll-log.mjs:97-107`). A roll and everything it replaced form a chain, oldest first (`module/rules/roll-log.mjs:116-125`).

`visibleTo` filters rolls by their own visibility flag; hidden rolls are hidden for a reason — a Discover roll a player can read gives away the Assassin's panel without anyone rolling anything (`module/rules/roll-log.mjs:140-147`).

### Rolls with no attack around them

Ruled 2026-10-04 (#182): a roll no Combat Process owns still leaves a record.

- **Field events.** `engine/fields.mjs#runFieldEvent` files a `fieldEvent` log entry for every Health loss, damage, defeat, interior Evade and chance roll (`1d100` against the field's `chance`, `hit` or `missed`). `engine/scheduler-hooks.mjs` gathers one Turn end's entries from all four dispatches (`actedTurnEnd`, `turnEnd`, `anyTurnEnd`, `unitTurnEnd`) and `engine/field-report.mjs#postFieldReports` posts **one public card per field**. A contact event logs too, and its pass posts its own card, *"{field}: on contact"* (#188). Heals and stat changes the field pays are lines too: *"Medusa heals 60 Health"*, *"Medusa: Agility +1"*.
- **A rider's chance inside an attack.** `scheduler.pendingRolls` carries each chance spec's `chance` and `label`; `fireDamageDealt` files a roll record per die, and the Damage Step advances with them as `rollRecords`, so a Kagome Spirit's Death die is in the card's Rolls. The filing test takes only the hearer's `self:` facts (`rules/options.mjs#selfOptionsOf`): a bare `rollOptionsFor` also emits `attack:kind:normal` for the attack it was not given, so a Normal-Attack-only rider was filed on a Noble Phantasm, and Karna's Burn read *"hit"* on Brahmastra and applied nothing (#190). **Two specs on one die are both filed** (#206): Mana Burst's 25% and Vasavi's 50% Burn share the key `chance:<id>:ApplyEffect:burn`, and the second, the only one whose clause applied after the Activation, was skipped as already rolled, so Burn landed with no line. One die per key, and every spec whose clause applies files its record against it.
- **An effect's row on the damage card reads its name** (#260, live). A contribution from an effect carries the
  effect's id as its `note`, and the pipeline keeps the id: rolls (`rules/checks.mjs`) and stacking key on it, and
  two definitions share one display name (S.Crit Up). `rules/explain.mjs` maps an effect id to its definition's name
  at display, as `engine/turn-report.mjs` already did: *"Dmg Boost (Gilles) +30"* where a Horror's card read
  *"dmgBoostGilles"*.
- **A rolled modifier's die** (#190). Goddess of War's d4s lifted and cut Penthesilea's damage by a number nobody could see. `rules/roll-log.mjs#modifierDiceRecords` files each one the breakdown used, matched on the modifier's key and its ability (a contributor carries the key as `source` and the ability as `note`), and the Damage Step advances with them beside the riders' rolls.
- **Round-end periodic ticks.** `postPeriodicReport` reads the `periodic` damage intents `scheduler.endRound` returned, logs a `periodicTick` per tick and posts **one card**. The effect is named, never who inflicted it, so a Secret Poison stays secret.
- **Every defeat.** `io.defeat` logs `{kind: "defeat", event: "defeated", cause, killerId}` the first time a Unit falls, whatever wrote it.

Test: `test/unit/roll-records.test.mjs`.

### Export and replay

`fullLog` reads back flushed entries from the journal and returns one continuous history (`module/engine/game-log.mjs:78-87`). `exportLog` produces a self-contained JSON export with the ruleset settings, roster setup rolls, and all recorded rolls — with them replay is exact; without them it is re-simulation, which proves nothing about the bug being reported (`module/engine/game-log.mjs:100-123`).

**Whose row (#226).** A Skill card's row that landed on anyone but the caster is prefixed with that Unit's
name (§46.4-NL), shown only to its controllers, and carries what the landing wrote besides the effect (`after`, §46.4-NP). A legion's count
is announced under its Master: "Deployed Hassan 5, Hassan 6. Hassans: 100/100.", "Hassan 2 falls. Hassans:
99/100.", "Zabaniya: 4d6 = 12. 9 from the reserve, 3 removed from the field."

**What a handler or the scheduler does to a Unit is said** (#247). Logged and shown nowhere until now: the Nameless Forest's escape (*"escapes the Nameless Forest: rolled 16 (Home Base −3) = 13 vs Luck 14. Every Token is removed…"*) and its death die, in each of its three outcomes (`engine/nameless-forest.mjs#postEscape`, `#postDeathRoll`); the Glass Game's rewind, naming whom it turned back (`glass-game.mjs#postGlassGame`); an Item taken or refused (Ch. 18). A handler's batch also prints an Item it spent and a rule it took away for good (`applier.mjs#itemLines`, `#suppressionLines`), worded from `FGT.Item.Gone.<item>` and `FGT.Suppressed.<slug>` when the language file has them, never the slug. Health lines read the Unit's own document (`unitActor`, Ch. 08).

**A defeat posts a card** (#249 reading 33). `io.defeat`, the one door every defeat passes, posts a public card on
the first defeat (`engine/defeat-card.mjs#postDefeatCard`), naming the Unit and its killer by their public names,
and the structured log now carries the `defeat` entry it always wrote (`classifyLogEntry`). A Feigned Defeat shows
every player but its own the same card, whispered, so the two cannot be told apart (Ch. 30).

## Invariants & edge cases

**A Skill card names what it removed and what it rolled** (#193). A `removeEffect` phase adds a row per effect taken off (*"Burn removed"*), and a summon's row carries its dice and names (*"5 summoned (1d6 → 5; 1d4 → 4, 3, 3, 2, 1): …"*).

**The Turn-end card names the modes it ended** (#195). Beside Health changes, `turnEndCard` lists each mode a Turn-end handler switched off — *"Goō Shōrai・Tenmōkaikai ends on Raikou (Goō Shōrai・Tenmōkaikai)."* — including a handler owed `at: turnEnd`. A rider's chance line ends *"resisted (rolled … vs …%)"* when the target resisted it (Ch. 15).

1. **Process state on message flags survives reconnect.** The card IS the audit record; replaying a match means re-executing from the log, not from saved state, so the process must be readable from flags alone (`module/apps/chat/cards.mjs:2-8`).

2. **Visibility is by-side, not by-name.** A row with no side belongs to the board and is shown to everyone. Dropping it would silently change the arithmetic, which reads as a bug rather than as discretion (`module/rules/card-visibility.mjs:181-183`).

3. **Arithmetic stays visible even when contributors are redacted.** Stage delta, running total, and index stay visible so a viewer can check the numbers add up (`module/rules/card-visibility.mjs:120-124`).

4. **Sequence numbers never renumber.** Adding an override would silently repoint every earlier override at a different entry, so new entries are numbered one past the last, never renumbered (`module/rules/game-log.mjs:14-16`).

5. **A bystander learns something happened without learning what.** Effects are shown as a count; rolls are filtered; the summary is public. Silence reads as "the Skill did nothing", which is a different fact (`module/rules/card-visibility.mjs:89-90`).

## Traps and anti-patterns

**Registering a setting nobody reads.** `closedInfo` was registered in `settings.mjs` and read by nothing — a GM who turned it on or off changed no behaviour anywhere. Settings without readers are invisible configuration, and an invisible switch is not a control. **Read every setting you register, and make the code that reads it fail obviously if the setting vanishes.** (`module/settings.mjs:144-147`, `module/apps/chat/cards.mjs:175-182`, now fixed.)

**Computing a redaction and never using it.** `redactBreakdown` was computed and cached for years but never called to filter the breakdown that was displayed — the card showed the full result to everyone, including viewers who should not have seen it. The function was mathematically correct and never read, which made the defect invisible at review. **Redactors must be called at the point of rendering, and the template must receive the redacted output.** (`module/rules/card-visibility.mjs:163-164`, fixed at `module/apps/chat/cards.mjs:216`.)

**Reading a flag set before the stage that changes it.** The card's Injury line read the pipeline's `exceededInjuryThreshold`, and its Shield line read `shieldAbsorbed`. Both are set at stage 16, and a barrier absorbs after every stage. So a hit Scales of the Sacred Fish absorbed whole read *"0 · Injury Roll required"* and *"absorbed 0"*, while the engine had already decided no roll (#110). **Read the decision, not an input to it.** The Injury line now reads `flags.fgt.injury`, the `injuryCheck` verdict, and `engine/shield.mjs#landBarrier` puts the absorption on the flag with the total and the row.

**Reading a field nothing writes.** The attack card listed its riders from `state.appliedEffects`, which no code has ever written, while the engine wrote what the riders did to the message's `effects` flag. So no attack card listed an effect: Maria the Ripper's 50% Instakill, landed or resisted, was in the flags and nowhere on the card (#185). The card now reads the flag, worded by `rules/card-visibility.mjs#effectLine`: the name, the outcome when it did not land, and the roll when a chance decided it (*"Instakill (rolled 42 vs 50%)"*, *"Instakill: resisted, rolled 85 vs 50%"*). `engine/effect-applier.mjs` keeps the roll on a success too; it kept it only on a resist.

**A unit printed as the wrong kind.** The explainer's `PERCENT_SOURCES` listed `magicResistance`, whose contributions are amounts, the MAG it removed, so Rain of Light on Drake read *"−108%"* for 108 (#187).

**Filing a roll whose clause did not apply.** Drake's *"whenever this Unit performs a Crit ... 15% chance of gaining 1 Galleon Token"* rolled its die on every hit and the card printed *"68 against 15%: missed"* on attacks that did not Crit (#187). `scheduler.pendingRolls` now carries the handler's `predicate`, and `engine/attack.mjs#fireDamageDealt` files a chance roll only when it holds.

**A reason printed as a kind.** A Skill refused on the sheet's and the bar's use path printed the kind it was refused for: *"Golden Hind: Wild Hunt cannot be used: zon."* (#187). `apps/actor-sheet/sheet.mjs#refusalWords` words it from `FGT.Ability.Refused.<kind>`, which the ability cards already read: *"Outside the Master's ZON — Noble Phantasms are unusable."*

**Counting one kind of result.** A Skill card counted the effects a Skill applied and nothing else, so Surgical Procedure healed 50 and restored 1 Agility under *"No effects were applied"* (#185). A `heal` phase and a `statChange` phase now add a row each (*"Health +50"*, *"Agility +1"*, `engine/skill-use.mjs#statChangeLine`), filtered per viewer like an effect. An effect that landed on a chance shows the roll that landed it, *"Atk Up (rolled 27 vs 60%)"*, as a miss already showed its own (`effectLine`, #189): Imperial Privilege's two 60% chances showed every miss and hid every hit. A `check` phase adds its roll and what it decided (*"Agility Check 3 vs 18: success"*, *"Agility -2"*, `checkLine`), and a `cooldown` phase each ability it moved (*"Bellerophon: Cooldown 22 → 20"*, `cooldownLine`; nothing for an ability already ready). Mystic Eyes read *"No effects were applied"* over 2 Agility taken, and Blood Temple *"NP Regen"* over a 2-Turn cut (#188).

**A revival that tells nobody.** A revival was logged (`kind: revive`) and shown nowhere: Divine Protection brought Ozymandias back at 200 and the card read the 6 that felled him. `io.log` now posts `engine/revival-report.mjs#postRevival` for each one, public: *"Sphinx Queen is defeated and revived by Ramesseum Tentyris …, with 150 Health."* (#189). A rolled revival says its dice (*"Rolled: 32."*), a counted one what it spent and has left (*"Uses spent: 4; 5 left."*), and an attempt that fell short is a `reviveFailed` entry and its own line: *"God Hand: Twelve Labors could not bring Berserker back: 197 damage was left over. Rolled: 111. Uses spent: 1; 0 left."* (#256, §46.4-RZ).

**A Turn end that moved a Health bar says so** (#190). A handler fired at a Turn boundary wrote its Health change and nothing else: Mad Enhancement's *"this Servant's Master loses 30 Health at the end of every Turn it Acts"* dropped Penthesilea's Master by 30 and no card said why. A `StatDelta` from the scheduler carries its handler's `source`, and `engine/turn-report.mjs#postTurnEndReport` posts *"End of the Turn"* with one line per Health change: *"{who} loses 30 Health (Mad Enhancement)."*

**A close that tells nobody.** A field closing posted nothing, and a close for its owner's defeat was not even logged (#185). `engine/fields.mjs#endField`, which every close path reaches, logs the `deactivated` entry when its caller has not and posts `engine/field-report.mjs#fieldClosedCard`: *"The Mist: Darkened Misty Metropolis ends. Its owner ended it."* The reason is `owner`, `upkeep`, `forcedEnd`, `ownerDefeat`, `expired`, `duelDecided` or `vulnerability`, worded from `FGT.Field.Closed.<reason>`.

## Open questions

- **Open: two rolls others never see (#198, §46.4-KQ).** Territory Creation's 3d10+30 negation is on no Rolls list,
  and a Contract Servant attempt reaches only the attempter's notification. A strip's roll now posts its line.


- **Partly settled: the state is carried as a message flag, and both clients read the same document.**
  169 messages in the live world carry an `fgt.process` flag holding the full machine -- `attackerId`,
  `defenderId`, `attack`, `reaction`, `evaded`, `isAoE`, `groupId`, `isCounter`, `counterDepth`,
  `counterRedirectId`, `history` and `rolls`. Because the flag lives on the ChatMessage rather than in
  a client's memory, a reconnecting client rebuilds the card from the document instead of from
  anything that crossed a socket. `readProcess` tolerates both shapes it can arrive in, string or
  object (`module/net/operations.mjs:67-74`). What remains unexercised is a reconnect *mid-ladder*,
  which needs a client to drop between two rungs of a live exchange.

- **Confirmed self-contained; replay itself remains untested.** A live export returns
  `{format, exportedAt, systemVersion, settings, roster, entries, summary}` -- a format version, the
  system version it was produced by, the ruleset settings, the roster (3 rows here) and the entries
  (21). So the three things the claim names are all present, and the export does not depend on the
  world it came from. Whether they are *sufficient* to reproduce a match exactly is a stronger claim
  that nothing can settle today, because no replayer exists to consume the format.

- **Two visibility modes, one never chosen.** "Strict" creates separate whispered messages for security; "filtered" uses client-side rendering and is faster. The latter ships all the full result to every client that can read the flags, even those who should not see it. A compromised client or a careful look at the Foundry source could read fields the card template does not display. Most tables use "filtered" by default, making security opt-in and therefore not chosen (`module/rules/card-visibility.mjs:22-31`).

**A resource change is a row** (#204 LK). A `resource` phase adds one per key with the real numbers, *"Agility 10 → 14"*,
or *"(no change)"* when the maximum clamped it (`engine/skill-use.mjs#resourceLine`). The attack path runs the same
caster phases (`runCasterPhases`) and dropped their rows; it now posts them on a Skill card of their own, so Toole
Fragarach shows *"Fragarach Tokens 4 → 1"*.

**Rows say what moved, on whom** (#208 §46.4-MT, #209 §46.4-ND, NG). An attack card's visibility is built from its
effects when the damage was skipped (an Instakill), and the damage block shows only with a result. A handler's cooldown cut
is a row per copy (*"Name: Cooldown 7 → 6"*), its chance die is a roll record named for the clause, and the Turn-end card
names a sourced cut (*"Castor's Dioscures Tyndaridae: Cooldown −2 Turn(s) (Self-Replenishment (Mana))"*) as what it took,
read before the writes (`clocksBefore`): nothing for a clock already at 0. `damageDealt` and `damageStepEnd` file their dice
through one pair, `rollChances` and `chanceRecords`, "resisted" included, and so does `damageTaken` since #258 (it fired on `rolls: {}` before, and a chance hung there never rolled). The verdict is the landing's own row when an effect rode the die: Rock Snowball's 10% is 15% under Fae Contract, and a 12 reads *"against 10%: hit (rolled 12 vs 15%)"*, where it read "missed" beside a Bleed that landed (§46.4-SJ). A `statChange`
row reads the stat before and after, *"Luck 9 (no change)"*, and names the Unit when it is not the caster.
