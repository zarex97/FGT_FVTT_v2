# 30 — Concealment, Identity, Detect and Vision

## What it is

Presence Concealment hides a Servant: from being targeted or seen on the board by non-allies, and from certain reactions. It lives as an `effect` on the unit (`module/rules/concealment.mjs:33`), carrying a duration that allows it to expire at a clock tick. The state rides the effect rather than a boolean because the skill's own clause demands it — *"the effects of Presence Concealment are neither a buff or a debuff, and are Unremovable"* — which maps to a `status` polarity with `unremovable: true` (`module/rules/concealment.mjs:16-20`).

A concealed Servant's **public identity** — the class and faction name shown on the board and in chat — differs from its true name. A unit is publicly its **class** (Berserker, Archer), optionally suffixed with its faction (Berserker of Red), until its `identityRevealed` flag is set. A concealed Servant may also override this with an explicit `concealedIdentity` (`module/rules/identity.mjs:76-93`, `module/engine/public-identity.mjs:35-68`). The public image and name apply to the token texture and every chat card that references the unit, so all viewers see the same thing — per-viewer rendering is deferred to a shadow-actor pattern (`module/engine/public-identity.mjs:8-18`).

**Detect** is the radius at which a unit may Discover a concealed one. It is set by the unit's class container (Archer sees four panels, Master sees one), modified by Deafen and bounded field caps, and written to the token's Foundry vision range on creation and edit (`module/rules/identity.mjs:29-39`, `module/engine/token-vision.mjs:96-111`). **Discover** is the attempt to find a concealed unit, rolled when it moves into a watcher's range. Only Servants watch, and each faction gets three attempts per Turn against one concealed unit, spent in order of which Servant first saw it, with no repeated attempts from the same watcher in a Turn (`module/rules/identity.mjs:240-339`).

## Where it lives

| File | Role |
|---|---|
| `module/rules/concealment.mjs` | Presence Concealment clauses as decisions: is it hiding, what reactions does it refuse, AoE outcome, ability use restrictions, break chance |
| `module/engine/concealment.mjs` | Ending concealment: all six paths, cooldown, Secret Poison disclosure, Discover checks and budget |
| `module/rules/identity.mjs` | Detect by class, identity revelation, public naming, Discover chance, attempts and the per-faction Turn budget |
| `module/engine/public-identity.mjs` | Public image and name for tokens and chat cards |
| `module/engine/vision.mjs` | Recording newly-seen units and firing `unitFirstSeen` events |
| `module/engine/token-vision.mjs` | Syncing Detect radius to Foundry token vision at creation, actor edit, and unit move |
| `module/engine/token-image.mjs` | Syncing public portrait to token texture on identity reveal or portrait change |
| `module/rules/relations.mjs` | How one Unit sees another (self, ally, enemy, neutral) |

## How it works

### Presence Concealment

`isConcealed` checks whether a unit carries the effect (`module/rules/concealment.mjs:44-46`). The unit hides from targeting and from certain reactions through separate pure predicates: `hiddenFromViewer` decides whether the token renders (hidden from non-allies, shown to GM, owner, and allies) (`module/rules/concealment.mjs:79-89`); `reactionsRefused` forbids block and counter to a concealed attacker whose AGI Rank is strictly lower than the defender's, and AGI Rank not Agility pool (`module/rules/concealment.mjs:108-117`). An attack that catches a concealed unit in its AoE and fails Evade flips a coin — Heads negates damage and effects but stays silent; Tails deals 50% damage and deactivates concealment (`module/rules/concealment.mjs:180-191`). **An area that catches her alone is still an AoE (#185).** `state.isAoE` counts distinct defenders, so a 3×3 Noble Phantasm with only Jack inside flipped no coin and landed in full. The resolver marks a concealed Unit the shape caught, rather than one a choice named, as `concealedAoE`; `declareProcesses` carries it onto that Process as `caughtConcealed`, and the coin reads either flag. A concealed Unit chosen past a waiver (`excludeConcealed: false`) was named, not caught, and gets no coin.

**Targeting a concealed Unit.** Clause 1 shuts a concealed Unit out of being targeted *"for an Attack or an enemy Unit's Skill"* — those two and nothing else. Targeting step 7 therefore drops it from a chosen or counted selection only when the ability is an Attack, or the Unit is not an ally of the caster; an allied Skill reaches it (`limits.forAttack`, `rules/ability-use.mjs#targetSpecFor`; Ch. 20 step 7). It used to drop every concealed Unit whatever its relation, so a concealed ally could not be healed or buffed by a single-target Skill (#133). The Unit's own Skills were never affected.

**Whether an ability aims at an enemy is asked of its own targeting and of every phase's** (`usageSpecFor`'s `phaseTargeting`, #243): Kiritsugu's Affection of the Holy Grail targets himself and inflicts Debuff ResDwn on all Units within 2 from a phase, and was usable concealed until clause 7 read the phase. An ability can restrict concealed use, but three exceptions hold: Attack Skills, damage-dealing Spells, Noble Phantasms, and explicitly marked ability (`usableWhileConcealed`) always go through. Serenity's Shapeshift is the sole instance in the corpus, paying 20% chance to break concealment (`module/rules/concealment.mjs:209-219`, `module/rules/concealment.mjs:251-253`). The roll is made after the Skill resolves (`engine/skill-use.mjs#rollConcealmentBreak`). A break is posted publicly; a kept roll is whispered to the GM and her owners, so the die leaves a trace without telling the enemy she is still hidden (#199, §46.4-KW).

**Whose concealment hides the aura's Poison.** The inflicter's: `concealedNow(c.bearer ?? u)` in the `ApplyEffect` action. For a `target: nearby` action `u` is each recipient, and asking it poisoned openly whenever the victim was not itself concealed (#199, §46.4-KR).

### Ending concealment

Six paths deactivate it: the Combat Process ends (attacked), a Discover roll succeeds (discovered), AoE coin came up Tails (aoe), an ability's own break chance fires (skillUse), the 2◈ expire (expired), or a player toggles it manually (manual) (`module/rules/concealment.mjs:262-269`). Every path invokes `deactivateConcealment`, which removes the effect and queues a reason for the aftermath (`module/engine/concealment.mjs:42-55`). The aftermath runs from the document hook, not the callers, so the cooldown and disclosure reach every path including the one that expires the duration `module/engine/concealment.mjs:83-105`). The skill's cooldown starts from deactivation tick, not its use, and reads from the rank table when not authored (`module/engine/concealment.mjs:232-255`).

**PC.5 ends PC once per declaration, not per Process** (#249, a Surprise). An area Attack is one declaration and
many Processes, answered at each defender's pace; `endConcealmentAfterAttack` ran as each Process closed, so a
defender who answered after the first lost PC's +100% and its Block/Counter refusal. It now waits for the
attacker's last open Process of the group (`attack.mjs#siblingStillOpen`). Jack's, Hassan's and Serenity's
concealed area Attacks all changed with it. **Only a PC Active when the Attack was declared** (ruled 2026-10-18):
the spec records `concealedAtDeclaration` once its price is paid. Danzō's Kawarimi into her own Dongyū
(Concealment) lands its C+ on her, and PC.5 no longer ends what her own Attack just gave her.

**Presence Concealment granted at a Rank** (#249 readings 2-4). Dongyū's Method 1 lands PC `C+` on every Unit in its
3x3, most of which have no Skill to read a Rank from. The instance carries it (`params: {rank, evade}`, Ch. 07), and
`rules/concealment.mjs#concealmentProfile` is the one reader of PC's numbers, instance first and Skill second: the
Evade bonus, `rules/identity.mjs#discoverChance` (whose hand-copied table is gone: a Unit with no Skill was found
100% of the time) and the cooldown. A grant lands `noneNoRefresh`, so a Unit whose own PC is Active keeps it, and
its end starts no clock on the Unit's own Skill (`onConcealmentRemoved`'s `granted`).

**A Disguise** (#253 readings 5, 10-14). Yan Qing's Doppelganger: *"Yan Qing can disguise himself as any other
character (figurine), including Masters and Servants. However, it is only the appearance."* This system has Fog of
War (`engine/token-vision.mjs`), so the sheet's no-fog fallback, PC B+, is not built. He picks any Unit on his
War's board of his own size, any side, Servants, Masters, Civilians and summons, never himself. The `disguise`
effect carries the look it copied (`params: {as, name, img, disposition}`), so a copy later defeated or gone leaves
it standing. `rules/disguise.mjs` is the reader: `disguiseOf` for the look, `seesTruth` for the viewer, true for
the GM and his owner alone (an OWNER check: teammates are fooled, as for Danzō's Feigned Defeat). The token shows
the copy's face, name and disposition colour per viewer (`apps/canvas/token.mjs`); every card, prompt and list
names the copy through `engine/public-identity.mjs`, one string every client reads. No rule reads it. Taking it is
a private card. It ends with its mode: by his press, paying Doppelganger's four rewards, or when one Attack takes
10% of his Max Health or more (`engine/disguise.mjs#noteHitOnDisguised`, summed over the Attack's hits), paying
nothing. Either way a public line says who he was.

**PC.7 per target rides on the spec** (#253, found live). `rules/concealment.mjs#veiledSpec` marks a concealed caster's
Skill spec (`selection.veiledFromEnemies`), and `rules/targeting/resolve.mjs` step 4 drops every enemy from it with
the PC reason. The use (`skill-use.mjs#resolveSkillTargets`) and the aiming session (`sheet.mjs#pickPlacementFor`)
both build their spec through it: the session had read the bare spec and called an enemy "Legal" for Doppelganger's
look, where the use refused it.

**A Rank raised by a buff** (#253 reading 4). Yan Qing's Espionage, *"Yan Qing's Presence Concealment Rank is
increased from C to A"*, is a buff carrying `RankShift {ability: presenceConcealment, to: A}`, Penthesilea's shape.
The snapshot carries the shifts the collection recorded (`abilityRankShifts`), and `concealmentProfile` reads the
Skill's Rank through `rules/elements.mjs#rankWithShifts`, live: a PC already Active reads A at once, one switched on
within the buff's 1◈ reads A, and the buff ending mid-PC drops it back to C. The cooldown after deactivation stays the
Skill's own, unshifted Rank (C's 1◈, not A's 2◈), in the profile and in `engine/concealment.mjs#cooldownTicks`.

**A break chance on an Attack is rolled on use** (#249 readings 9, 9b). `rollConcealmentBreak` ran only on the Skill
path, after the Skill; an Attack Skill never rolled it. `payAbilityPrice` rolls it now, before any Process exists,
for a declaration and for a Counter alike. Broken: PC ends (`skillUse`) and the Attack goes without it. Held: the
attack spec carries `keepsConcealment`, and PC.5 passes that Attack by, so Danzō's Funshindan leaves her concealed.

### Secret Poison disclosure

Secret Poison **explodes** at the reveal (#199 reading 10, which replaces Q47). The user's ruling: the damage applies *"the accumulated rightful deductions that it would have done if it was a normal poison"*, and only when revealed.

- **Banked, not taken.** A hidden Poison instance's tick is worked out at its real value (stage, Deadly Poison's doubling, the modifiers in force) and emitted as `bankSecret`, not `damage` (`module/engine/scheduler.mjs#tickPeriodics`). `io.bankSecret` adds it to `system.hiddenDamage[<inflicter id>]`. The victim's bar does not move, and no Round-end card names the tick.
- **The reveal.** Any end of her concealment runs `discloseSecretPoison` (`module/engine/concealment.mjs`). Every victim of hers is handled at once: hidden instances turn public, her key leaves the bank, a card per victim says what landed, then the total lands as one `damage` intent (`periodic`, `defId: poison`, no recompute). It has no breakdown, so the applier runs `defeatIfLethal` and Guts and revivals answer.
- **Pois Heal** banks a converted tick as a negative. A bank netted below zero heals at the reveal.
- **A cleanse** removes the instance, so later ticks stop. The bank lives on the actor and still lands.
- **A victim defeated first** loses its bank: `io.defeat` clears every key. Its card says so.
- **Who sees the bank.** The sheet's *Undisclosed damage* row is the GM's alone (`module/apps/actor-sheet/context.mjs`), named by inflicter. Shown to the victim's owner it would be the reveal itself.

Key by key, always: an ObjectField merges `{}` rather than replacing with it (below).

### Detect and identity

A unit's Detect range reads its class container from `DETECT_BY_CLASS` (Archer 4, Master 1), checks for an explicit sheet value that overrides it, applies stat deltas and Deafen (Deafen costs one to the minimum of 1), and applies bounded field caps (Jack's Mist caps Detect to 1 for enemies inside) (`module/rules/identity.mjs:123-148`). A Caster's range depends on standing in its own Home Base — 5 panels at home, 3 away — the sole position-dependent sight in the game (`module/rules/identity.mjs:157-163`).

Public naming returns the true name when the identity is revealed or the viewer is the owner, otherwise the class container and faction (Berserker of Red) or an explicit override (`concealedIdentity`) (`module/rules/identity.mjs:76-93`). Public image reads `defaultImage` if the Servant is unrevealed and concealed, otherwise `img` (`module/engine/public-identity.mjs:35-39`). Both are drawn from the same source (`publicIdentityOf`) so tokens and chat cards agree (`module/engine/public-identity.mjs:61-68`).

### Discover

When a concealed unit moves, `runDiscoverChecks` rolls for every enemy Servant currently within its Detect range (`module/engine/concealment.mjs:275-316`). Discover is capped: only Servants watch (not Masters), each faction gets three attempts per Turn against one concealed unit, and no Servant attempts twice in one Turn (`module/rules/identity.mjs:272-339`). Attempts are spent in order of arrival — the tick each watcher first held the target in Detect (`module/engine/concealment.mjs:352-361`). The chance draws from the concealed unit's Presence Concealment Rank (EX 0%, A 10%, B 20%, C 40%, D 60%, E 80%, ±5% per step) (`module/rules/identity.mjs:216-229`). Each roll is GM-only and silent unless it succeeds; the text states why — *"if either Player performs the roll, that would mean that they would already know there is a Unit with Active Presence Concealment in the area"* (`module/engine/concealment.mjs:268-270`).

### Vision

Detect range is written to every token's Foundry vision range (`sight.range`, in scene distance units per panel) at three points: token creation, actor edit touching Detect or class container, and unit move (for Caster's position-dependent range) (`module/engine/token-vision.mjs:42-77`). When `identityRevealed` is set or the portrait changes, the public image is synced to every token's texture and the prototype (`module/engine/token-image.mjs:44-104`).

When a unit enters another's Detect range for the first time, `checkSightings` records it in `seenUnitIds` and fires a `unitFirstSeen` event that abilities like Familiar: Doves may handle (`module/engine/vision.mjs:34-72`).

**A seventh way PC ends: `sealed` (#226).** A Presence Concealment whose reference carries
`endsOnSkillSeal` ends the moment Skill Seal lands on its bearer, through `deactivateConcealment`, so its clock starts
then. Only Hundred-Faced Hassan's sheet says so. A legion's body reads to the table as its class and number,
"Assassin 3" (`publicNameOf`).

**Through, not onto (#226 reading 28).** *"Move to any panel regardless of enemy Master-Servant positions"* lets a
concealed Unit walk through occupied panels and past a guarded Master, never end its Move on another Unit, for every
holder of Presence Concealment. `rules/movement.mjs#canStopOn` reads `STOPS_ON_OCCUPIED`, which holds Huge Scale
only; `canPassThrough` and the Master-guard check still read `IGNORES_BLOCKING`. Since `c09981e` it could stop there.

**A roll line is public too (#230).** A Process's roll records ship on the card every client reads, so their lines
name each Unit as the table knows it (`attack.mjs#shownName`, through `publicIdentityOf`): "Saber's Instinct: 50
against 70%", never the True Name under a "Lancer ⚔ Saber" header. The Master-guard line does the same
(`master-guard.mjs#shownName`): "Saber stands next to Master of Saber of Faction 1".

### A Feigned Defeat (#249)

**Kirihanasu** (Katō Danzō) is offered at an Attack's fatal hit, after every floor, to her owner alone
(`engine/feigned-defeat.mjs#offerFeignedDefeat`, window `whenFatallyHit`). Taken, nothing is written -- no damage, no
`io.defeat`, no Grail count, no kill credit, her Contract stands -- and the Process ends for her
(`damage:feigned → withdrawn`). Her phases land the `feignedDefeat` marker first, then Presence Concealment with no
expiry, then an escape Move up to her current MOV (`move` phase `panels: "@self.mov"`), which already follows the
ghost's rules.

**What the table sees** (`stageFeignedDefeat`): every player but her OWNERS, teammates included, is whispered the
same card a real defeat posts and sees a skulled stand-in body where she fell (two Tiles flagged `decoyOf`, drawn
per viewer by `apps/canvas/decoy.mjs`, cleared once a Turn passes); her token is hidden from them
(`hiddenFromViewer` reads the marker, with an OWNER fact the token now passes beside OBSERVER). Her owners and the
GM get a truth card.

**The ghost** is the marker's grants (`rules/granted.mjs`): `untouchable` (nothing but her own abilities targets,
catches or affects her, allies included, through one predicate, `rules/untouchable.mjs#untouchableBy`, asked by
targeting, auras, handler reach, `landEntry`, ally reactions, Discover and Master guards, which drop her
silently), `sharesPanels` (projected as `sharesPanel`), `ignoresTerrain`, `ignoresBoundedFields`, `offBudget`
(projected as `exemptFromBudget`, which `budget.mjs#poolFor` always read) and `selfOnlySkills` (the use gate allows
her Attacks and Skills that touch her alone).

**The reveal** (`revealFeignedDefeat`): her Attack, at its declaration, steps her off a shared panel to the
nearest free one she picks, removes the marker and the body, posts a public card, and turns her permanent PC into
an ordinary one with 2◈ from now (one batch: `removeEffect`, then `extendEffect` with `startAt`, the tick a permanent
effect's span counts from); PC.5 then ends it after the Process, unless a held Funshindan roll keeps it. A
tick that empties her bar reveals her and then defeats her for real (`io.defeat`). **Only a legal Attack reveals her
(found live).** `resolveAttack` asks the gates and aims first. Range is not a preflight gate: `resolveTargets` refuses
it. So the reveal waits for both, and the Attack is gated and aimed again from the panel she steps to. Before, a
Yuugao pressed out of Range was refused and still posted *"Assassin was never defeated: she lives."*

## Invariants & edge cases

1. **Concealment is an effect, not a boolean.** The effect carries duration, so the state can expire at a clock tick. The polarity is `status` with `unremovable: true` (`module/rules/concealment.mjs:16-20`).

2. **Only Servants are discovered, by Servants.** A Master does not roll to Discover, and a non-Servant cannot be Discovered (`module/rules/identity.mjs:287`, `module/engine/concealment.mjs:289`).

3. **Discover is per-faction per-turn.** A faction's three Discover attempts per Turn are its own; spending them buys nothing for another faction. Attempts are spent in order of arrival, not appearance, so a watcher holding the target since Turn 4 keeps its place when a second arrives on Turn 9 (`module/engine/concealment.mjs:318-361`).

4. **Concealment never breaks silently.** Every deactivation path sets a reason and logs it. The disclosure card names the source too — the unit that was concealed, not who it is (`module/engine/concealment.mjs:212-216`).

5. **The cooldown starts at deactivation, not use.** The skill's `cooldown.max` is authored or read from the rank table; it is resolved from the tick it ended, not from the tick it started (`module/engine/concealment.mjs:233-255`).

6. **Detect is never zero.** A unit always perceives at least its neighbors (minimum 1 panel), even if Deafen reduces it (`module/rules/identity.mjs:45`, `module/rules/identity.mjs:147`).

7. **Vision range is written in distance units, not panels.** A 4-panel Archer on a 5-foot grid sees 20, not 4; the written range is `panels × grid.distance` (`module/engine/token-vision.mjs:83-86`).

## Traps and anti-patterns

**Concealment hiding from everybody when the state was never true.** `unit.concealed` was a boolean projected by the snapshot, consulted by four subsystems (reactions, AoE, ability use, Discover), and written by nothing and declared by no schema, so all four asked a question whose answer was always `false`. Concealment was authored and its clauses reached the code, but the one thing it should do — hide — was never actually done. **Move the state from a projection to an effect** on the actor (`module/rules/concealment.mjs:11-14`), so removal becomes explicit and Duration becomes a property of the state itself.

**Computed Detect that was never written to tokens.** The class table `DETECT_BY_CLASS` existed and was authored (`module/rules/identity.mjs:29`), `detectRangeOf` computed the radius including stat deltas and Deafen (`module/rules/identity.mjs:123-148`), and **nothing ever wrote it to a token's Foundry vision**. Every Servant on the board sat at `sight.enabled: false, range: 0`, rendering on a scene with token vision enabled as an entire black canvas with the player's own token invisible. Found in play. **Write the radius at three points: token creation, actor edit, and unit move** (`module/engine/token-vision.mjs:42-77`).

**One question decides "seen": `rules/identity.mjs#sees`** (#185). Its Detect range, or a field of its own whose isolation says `ownerSeesInside` — Jack's Mist: *"she can see all Units within the Mist"*, ruled to hold wherever she stands. First sightings (`newlySeenBy`), Discover (`discoverAttempts`, `recordArrivals`) and the Heel's Fog of War all ask it; the canvas shows her owners every Unit inside through `seenThroughFields` in `apps/canvas/token.mjs`, never a token the GM hid.

**Concealment not triggering visibility updates.** A Presence Concealment effect applied to a token did not prompt Foundry to check whether it should be visible to each viewer, so the Servant stayed on-screen until somebody happened to move. `canvas.perception.update` was not called when the effect was created or deleted. **Trigger a visibility pass on create and delete** by updating `canvas.perception` with `refreshVision: true` (`module/engine/token-vision.mjs:68-77`), which ends in `canvas.visibility.refresh()`. It named `refreshVisibility` too, a flag Foundry v14 does not have: `update` threw on it, so no pass ran and every conceal and reveal logged an error (#185).

**Hidden Poison damages disclosed repeatedly.** The hidden damage tally on a victim (`system.hiddenDamage`) was cleared by assigning an empty object, but Foundry's ObjectField merges rather than replaces, so the assignment was a no-op. Concealment ended, damage was disclosed, concealment was activated again, damage disclosed *again*, the tally still there. **Use key-by-key deletion** with the `-=` syntax to actually clear the tally (`module/engine/concealment.mjs:174-177`).

## Open questions

- **Confirmed, and it is the rule as written rather than a gap.** `runDiscoverChecks` has exactly
  one caller -- `module/engine/movement-hooks.mjs:279`, gated on `unit.concealed` -- and the clause it
  implements is quoted directly above it: *"When **This Unit** Moves into an enemy Servant's Range
  (or Detect, if in use), it has a 5% chance of being discovered."* The subject is the concealed unit,
  so a stationary watcher receiving no roll when an enemy walks past is the clause working correctly.
  The roll is taken **after** the move is recorded, so it is measured against where the unit now
  stands. Whether the rule *should* be symmetric is a question for the game's author, not a defect.

- **Do Discover attempts scale with faction strength?** The current budget is flat (three per faction per Turn). A faction with one Servant gets three attempts; a faction with six gets three shared. The rules as written pay no attention to outnumbering, which is intentional (the cap is what prevents it), but the interaction at large tables is untested.

- **Should identity revelation be per-viewer?** Currently all viewers see the same name, because tokens and chat cards are one document every client reads identically. Per-viewer rendering would require the shadow-actor pattern, which the authority chapter defers rather than specifies. The plan-era roadmap that held the deferral has no successor, so this is genuinely undecided rather than scheduled.

**Lines the engine posts for a Unit read its public name** (#232, §46.4-OJ): Bab-ilu's follow-up offer and line, and
every Enki line, ask `publicIdentityOf` and speak through `publicSpeakerFor`.

**Four more cards ask `publicIdentityOf`** (#234, §46.4-OO): the Command Spell card (*"…Suspend Skill, on Archer's
Fated Rivals of the Mahabharata"*), the Turn and Round end cards, the periodic card and the revival card, and a
compulsion's culprits. Still reading `actor.name`: the targeting preview, the refusal banner and `dimension.mjs`'s
offers (§46.35.3).

**A guard keeps every player-facing name public** (#235). `tools/check-public-names.mjs`, run by `npm run lint`,
refuses a Unit's `.name` read raw (off `game.actors.get(…)` or a variable holding a Unit: `actor`, `unit`, `defender`,
…) anywhere in `module/engine`, `module/apps` or `module/rules`. A line names a Unit through the one reader,
`engine/public-identity.mjs#shownName` (an Actor or a board unit) or `rules/identity.mjs#shownNameOf` (a board unit, in
the rules layer), or says why its read is safe on that line or the one above: `// fgt-name-ok: <reason>` (the
Unit's own player's prompt, console text, a Master, an ability's name). A file whose every read is GM-facing is
allowlisted in the script with its reason. It slipped three times before (§46.4-NV, -OJ, -OO); the sweep that made it
green fixed the refusal banner and the targeting resolver's reasons, the targeting preview and review, the turn
panel's roster, the Dimension and Hanging Gardens offers, and the cards for an automatic Counter, a cancelled NP, an
escape, a boarding and a fall, a legion's deploy and fall, an optional cost, a forced mode, a transfer, a drag and a
summoning. Three private copies of the reader (`attack.mjs`, `master-guard.mjs`, `schedule.mjs`) fold into it.

**A row's reader is the caster's too** (#239, §46.4-OU). A Skill card's row was prefixed with its recipient's real
name and marked safe, *"a row is shown only to its recipient's controllers"*; `skillEffectsFor` shows every row to the
caster's controllers as well, so Het Gele Huis read *"Karna: Def Dwn"* to Van Gogh's player. Rows and stat lines say
`shownName`, and the guard reads `recipient`, the holder that hid it.
