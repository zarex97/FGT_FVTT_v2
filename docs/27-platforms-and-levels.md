# 27 — Platforms, levels and scene levels

## What it is

Platforms are **large Servants or structures** that carry passengers — the Hanging Gardens of Babylon at 9×9 panels, the Golden Hind, the Storm Border dimension. The system treats platforms not as special token overlays but as first-class game objects: each active platform gets its own **Scene Level** (a Foundry level in the scene), passengers ride as tokens on that level, and cross-level targeting rules encode who may shoot into a platform, out of it, and directly underneath it.

A platform's **footprint** (`{w, h}`) declares how many panels it occupies. Membership in "aboard" is not a stored list but a *consequence* — units on the platform's Scene Level are aboard, and the level itself is the record. Passengers move with the platform when it moves, survive tests when it takes damage, and scatter to the ground when it is destroyed, all ordered by the specification's exact sequence.

## Where it lives

| File | Role |
|---|---|
| `module/rules/platforms.mjs` | Verdicts and descriptors: passengers, boarding, cross-level rules, upkeep, destruction |
| `module/engine/platforms.mjs` | Operations: boarding, falling, destruction, activation |
| `module/engine/scene-levels.mjs` | Scene Level lifecycle: creating, orphans, moving units, scattering, teardown |
| `module/engine/token-footprint.mjs` | Keeping platform tokens the size their footprint declares |
| `module/engine/dimension.mjs` | The Storm Border — a pocket dimension entered and left |
| `module/apps/canvas/token.mjs` | Click targeting: only the level being viewed accepts clicks |
| `module/rules/targeting/resolve.mjs` | Step 4d: cross-level protection checks |

## How it works

### Platforms and Scene Levels

**The load-bearing decision** (`module/rules/platforms.mjs:13-17`): *"each active platform gets its own Scene Level"*. This design produces separate occupancy (passengers are read off level membership, not a stored manifest), separate targeting (cross-level rules decide who may reach across), native visual separation (platforms are drawn on their own elevation band), and fog that is independent per level.

**A platform is raised by the GM, from a player's press.** `summonPlatform` creates an Actor, a Token and a Scene Level, and a player's client can create none of them: a Level has no permission setting a Player can be given at all (the Document default is Assistant), and an Actor or a Token needs a role the GM must grant. Winged Serpent used to run on the pressing client and fail at the Level, after the Actor and Token may already have existed — an orphan. A non-attacking ability, and every Noble Phantasm that deals no damage, now runs on the GM through `OPERATIONS.useSkill` (Ch. 38): the player's client only asks, with the placement it picked, and the GM — who can write all of it — creates the platform. The platform is created with the caster's `factionId`, and the `createActor` hook (`engine/faction-ownership.mjs`) syncs its ownership on the GM's client, so its owner's player can select it. The other direct creators in `engine/` — `createStructure`, the Hanging Gardens (`hgob.mjs`), summons (`summoning.mjs`), the Storm Border (`dimension.mjs`) and a field's Region (`fields.mjs`) — are all reached from a Skill's phases, and so now only from a relayed call (#144).

A platform on the ground (level 0) has no passengers — a platform sitting at level 0 has not been activated (`module/rules/platforms.mjs:60-77`). `passengersOf` filters to units on the platform's level and excludes the platform itself. The guard against reading "everyone on the ground belongs to this platform" is documented: the Hanging Gardens' token was never assigned to its new level and therefore counted every unit in the scene as a passenger (`module/rules/platforms.mjs:61-72`).

### Raising a platform

A Noble Phantasm that summons a platform (`summonPlatform`, `module/engine/skill-use.mjs`) creates its Actor from the compendium, stamps its owner and the tick it was raised on, resolves its `inherit` stats (all but Luck, below), and places its token **at the summoner's panel**. A token is placed by its top-left panel, which for a one-panel mount was the summoner's own; a larger mount summoned from the last row or column would hang off the board, so the anchor slides back just far enough to stay on it, never so far that her panel leaves the footprint (`module/rules/platforms.mjs#summonAnchor`).

**The Quetzalcoatlus is 2×2 panels.** The sheet prints no size; the user ruled 2×2 (2026-10-01, #65) and the content authored 1×1. The compiled token takes its size from the authored `footprint` (see *Token sizing*), so the one line in `packs/_source/platforms/quetzalcoatlus.yml` is the whole of the size.

**A platform's "Luck: Shared with" is one pool with its owner's** (#162, ruled 2026-10-01). The Quetzalcoatlus's sheet says *"Luck: Shared with Quetz's"* and Drake's *"Luck: Shared with Drake"* of the Golden Hind: a Luck spent by either is gone for both. `summonPlatform` used to resolve `inherit.luck: { from: summoner }` once, at the cast, into a **copy of her maximum** on the platform's own actor, and nothing kept the two in step: every Luck Check costs 1 (`I.statDelta(<the checking unit's own id>, "luck.value", -1)`), so the pools started equal at her maximum — the mount higher than she was if she had spent Luck first — and drifted apart with every check either made. Now there is one pool and it is hers. The projection carries the authored fact as `luckFromSummoner`; `rules/platforms.mjs#luckOwnerOf` names the owner of a platform that shares, and `annotatePlatforms` reads her **current** Luck onto it (so `rollLuck` and the pre-emption check, which read the board's unit, see her pool); `engine/io.mjs#adjustStat` resolves the pool's actor for `luck.value` and `luck.max` on such a platform and writes there, which covers all three spend sites and any later one; and `summonPlatform` copies no Luck, though every other `inherit` stat keeps its copy. A Summon's `inherit` (the Kagome Spirits, Raikou's retainers) is a starting value, resolved once at placement, and is not touched. **The interface reads that pool too** (#169): the action bar's Luck row, the Luck rung's Contest button on the chat card (label, and disabled below 1) and the `luckCheck` dialog's body ask `engine/board.mjs#luckOf`, the board's number, and not the platform actor's stored `system.luck`, which is a 0 nothing keeps; `test/unit/shared-luck-readers.test.mjs` fails any `module/apps/` file that reads `system.luck` directly.

**Her Master is put on the mount, not merely beside it.** *"She is Moved onto the Quetzalcoatlus together with her Master (if her Master is next to the Quetzalcoatlus…)"*. Next to the mount means on its footprint or one panel from it, measured from the **footprint** and not from her panel (`rules/platforms.mjs#nextToFootprint`): at 2×2 a Master two panels from her can still be beside it. Level assignment changes a token's Level and never its x or y, so a Master who was only beside the mount used to ride a deck he was not standing on. `masterSeat` now lands him on a free panel of the footprint — where he stands if that is one, else the nearest — never on hers, and `summonPlatform` moves him there (forced) before the level change. A Master who is not next to it is not refused: he boards later.

**A second cast is refused while the first platform stands** (#142). `countFrom: destroyed` and `countFrom: deactivation` start no clock at the cast, and the cooldown starts from *any* end of the mount (ruled, 2026-10-01), so the cooldown cannot be what refuses a second cast while the mount is up: the refusal is its own rule. `canUseAbility` refuses `platformStands` when the board holds a platform whose content id the ability's `summonPlatform` phases name, that the caster owns and that is not defeated (`rules/platforms.mjs#standingPlatformOf`); another Servant's platform is no reason. It is derived from the phases, with no new authored key; `usageSpecFor` carries the list as `summonsPlatforms` because the use paths hand the gate that projection and not the phases. Before it, a second cast raised a second mount at her panel, moved her and her Master onto it, charged the Master's Health again, and left the upkeep sweep charging each platform on its own clock — two 25-Health tolls per 1◈. It reaches Winged Serpent and the Golden Hind's Wild Hunt; the Hanging Gardens is gated by Construction and its Home Base.

### Boarding and carrying

Boarding is a roll against the platform's declared difficulty, modified by the unit's Agility and Luck Ranks. A platform that specifies a `boarding` block states it in full — the Golden Hind rolls a ten-sided die with no relief clause — and every other platform defaults to the Hanging Gardens' rule: 1d12, target 12, reduced by rank relief and special circumstances (`module/rules/platforms.mjs:508-529`). The modifier **reduces the required value**, not the roll (`module/engine/platforms.mjs:21-23`).

**A platform may name its seats.** The Quetzalcoatlus's sheet says *"her Master can get on the Quetzalcoatlus at any time"*, and the user ruled it (2026-10-01, #65): her Master boards **freely, with no roll**, and **nobody else takes the seat** — not an enemy, and not an ally who is not her Master. The platform authors `boarding: { seats: [owner, ownerMaster] }`, a list of **roles** (the document is authored long before it has an owner, as `lockAboard` is). `rules/platforms.mjs#seatVerdict` reads it: a named role boards by Moving on, anyone else is refused `notYourSeat`, and a platform that authors no `seats` returns `null` and keeps its own roll. `boardPlatform` asks it first, before capacity, and `boardablePlatform` withholds the Board button from a Unit it refuses — the rule is the check, not the button's absence. The Hanging Gardens and the Golden Hind author no seats. Before this the mount had no `boarding` block at all, so her own Master rolled the Hanging Gardens' 1d12 for a natural 12 to board it.

A unit becomes eligible to board once it has moved (by ordinary movement) onto an active platform's footprint while still on the ground: `rules/actions.mjs`'s `board` action offers itself under exactly that condition (`module/rules/platforms.mjs#boardablePlatform`), and its handler calls `boardPlatform` (`module/engine/actions.mjs`). A GM may also call `boardPlatform` directly through `game.fgt.api.platforms`.

**A successful boarding moves the Unit to the platform's Scene Level, not merely onto its panel.** Membership is the level, so the level assignment *is* the boarding: `boardPlatform` moves the boarder with an ordinary move intent and then calls `comeAboard`, which puts it — and a Master carried up with its Servant — on the platform's level, the same step `activatePlatform` takes for its initial riders. Until 2026-09-18 it took only the move, so a Unit that passed its roll stood on the ground underneath the platform while the log recorded a success (§46.4-BD). The boarder comes up **directly above where it stood**, or on the nearest free deck panel, and a carried Master lands beside its Servant (`rules/platforms.mjs#boardingLanding`); both used to be moved to the platform's anchor corner, on the same panel (§46.4-BX). The attempt is announced in chat with its die, roll and target, and a failed roll refuses with `boardFailed` rather than a generic line (§46.4-BY).

Bringing the Master along is gated on distance: *"A boarding Servant may bring its Master if the Master was within 2 panels"*, measured against where the Servant stood **before** boarding, never against the platform's own panel (`module/rules/platforms.mjs#mayBringMaster`, `module/engine/platforms.mjs`).

A unit brought aboard stays there when the platform moves (`module/rules/platforms.mjs:100-108`): passengers move **forced**, which keeps boarding off their own movement budget and away from movement-triggered effects. Relative position is preserved so formation survives.

**Knocked Off** is opt-in per Platform (ADR 0001): a Platform authors a `knockOff` block carrying its own numbers, and one that says nothing holds its edge — the knockback simply finds no landing there. The Hanging Gardens is the only Platform in the reference set whose sheet states the ladder. Every push is planned before any is made (`rules/movement.mjs#knockbackPlan`): each Unit once, from the footprint the mover is arriving at, so a Unit is never knocked off twice for one move nor pushed into the mover's new square (§46.4-BZ). The fall's Agility Check, its outcome and any rescue are announced in chat (§46.4-CA). A Unit a knock leaves aboard -- caught by its Servant, or keeping its footing -- is still moved off the mover's footprint to the nearest free deck panel (§46.4-CC). A fall rolls the Platform's own `knockOff.damage`, and a Master who lands flips the Overpower coin as though Attacked by a Servant (§46.4-CD).

The trigger is a **knockback whose computed landing falls outside the Platform's footprint**, not a Unit merely standing on an edge panel: on a 9×9 a Unit in the middle cannot be pushed off in one step anyway, and measuring the landing handles a multi-panel shove and any Platform that is not 9×9.

The ladder, in order:

1. **The Unit's Agility Check.** On a **success** it chooses — move to the nearest unoccupied panel of the Platform **other than the one it was occupying**, or land on the Board panel directly below **taking no damage**. With no free panel aboard the choice collapses to the damage-free landing. On a **failure** it lands below and takes the Platform's authored damage.
2. **The Servant's rescue**, only for a Master that failed and stands **directly next to (1 panel)** its own contracted Servant. That Servant makes its own Agility Check; on success the Master is **not** knocked off and **stays exactly where it stood** — unlike the passed-check case, which explicitly puts the Unit somewhere else.
3. **The Master's Overpower roll**, whenever it *lands on the Board* — including when it passed its check and chose to land, and including when it has already rolled one from the initial attack.

Several Units knocked off by one move resolve **serially**, because "the nearest unoccupied panel" depends on where the previously-resolved Unit chose to go.

Leaving a Platform is a Jump, a Knocked Off, or an unboarding where the Platform allows it — never an ordinary walk. `canStopOn` refuses a step that leaves the footprint of the Platform a Unit is standing on.

### Jumping off

> *"A non-Civilian or non-Master Unit standing on an edge panel of a HGoB can Jump off the HGoB and land on a Game Board panel within its MOV; in this case, the Unit's MOV is reduced by 1."*

*"Within its MOV"* is the allowance the movement planner would spend, and `jumpVerdict`/`jumpLandings` take it as a parameter rather than computing it ([Ch. 19](19-action-economy.md)). They used to do their own `mov - movedPanels`, which read a **raw** MOV: measured live, a Slowed Servant with MOV 4 who had walked 2 had nothing left, and the Jump offered it 2 panels of reach and returned `{ok: true}`. It is refused `noMovement` now. The overstatement scaled with MOV — on a MOV 8 Servant the landing set was 56 panels where the planner allowed 12.

The voluntary counterpart to being Knocked Off, and nothing like it: no Agility Check, no damage, and the Unit chooses where it lands. Open to **Servants and Summons** only — a Master leaves by being carried or by being knocked off, and a Civilian does not leave at all. The Unit must stand on an **edge panel** (on the footprint, orthogonally adjacent to something off it), the Platform must not hold it (`canUnboard`, which is how *"Drake cannot unboard the Golden Hind"* applies here too, and how *"Bašmu cannot leave the HGoB"* does: a summon whose `boundToPlatformId` names this Platform is refused `boundToPlatform`, and a knockback holds it at the edge rather than pushing it off, [Ch. 46 §46.4-BL](46-roster-re-audit.md)), and it must have movement left. The cost is the distance travelled **plus one**, so the landings reach one panel short of what is left and a Unit with a single panel left cannot jump at all; the list used to offer the full allowance and write a `movedPanels` past the Unit's MOV, and it clips to the board's own `{iMin, iMax, jMin, jMax}` bounds, which it never read (§46.4-BW).

> *"If a Servant would Jump off the HGoB with its Master directly next to it, the Servant can choose to bring its Master with it, the Master will land next to its Servant in the same orientation. This does not count as Moving the Master."*

**Directly next to** is one panel, deliberately not the two the boarding carry uses — two clauses, two distances, kept as separate constants. The Master lands at the offset it held before the jump, and moves **forced**, which is the whole of *"does not count as Moving"*: it spends none of its own budget and fires nothing that watches movement.

### Cross-level targeting

The platform itself may always be targeted (its `hullTargeting` decides from what reach). Occupants are protected along independent axes, each decided per platform and authored in its `crossLevel` block. A platform that says nothing is transparent — `OPEN_PLATFORM` (`module/rules/platforms.mjs`) allows free targeting in, out, and into area passengers.

**One reader.** A platform's protection is read in one place: step 4d of `resolveTargets` (`module/rules/targeting/resolve.mjs`), through `rules/platforms.mjs#crossLevelLegal`. It had a second reader, `crossLevelAllows`, gated on a `board.crossLevel` map that `crossLevelRulesFor` built: redundant for `untargetable` and dead for `requiresRanged` (the branch needed `spec.isMelee`, which nothing writes). Two readers of one rule drift (Ch. 46 §46.3); both are gone, and so is `requiresBoarding`, which was declared and authored on four platforms and read by nothing (#138).

The axes:

- **Shooting IN** — the target's platform decides: `occupantTargeting` is `free`, `rangedOnly` or `forbidden`.
- **What "ranged" is** — an Attack whose Range is at least the world setting `rangedMinimumRange`, default 2 (ruled 2026-10-05, #187 reading 4). Range 1 is melee. The setting reaches the rules layer as `board.rules.rangedMinimumRange`, read by `rules/platforms.mjs#rangedMinimumRange`, for every `rangedOnly` axis: the Golden Hind's both ways and the Hanging Gardens' hull.
- **Shooting OUT** — the attacker's platform decides independently (`outboundTargeting`). A fortress that nobody shoots into may let occupants shoot out, or may not.
- **Directly beneath** — `forbidDirectlyBelow`. The Hanging Gardens forbids it; Dragon Wing Warriors overrules it by setting `allowDirectlyBelow` on the phase.
- **The deck** — an ability's own `targeting.forbidAboard`. Aerial Garden of Vanity *"cannot hit under or above the HGoB"*: under is `forbidDirectlyBelow`, above is the deck, which Dragon Wing Warriors names as *"the area of the HGoB"*. `resolve.mjs` step 4e drops a Unit standing on the caster's platform ([Ch. 46 §46.4-BR](46-roster-re-audit.md)).
- **Area passengers** — `aoePassengerFactor` and `aoeMastersImmune`, below.

**Who the protection is against, and what** (#138). The sheets that state it bar **enemies** — Semiramis: *"Enemy Units on the ground cannot target Units onboard"*, Drake: *"Enemy Units cannot target Units onboard"* — and Quetzalcoatl's bars only an **Attack**: *"cannot be targeted for an Attack"*, where the Hanging Gardens and the Golden Hind say Attacks, Skills, Spells and Noble Phantasms. The engine barred everyone from everything, so a buff or a heal from the ground onto a rider was refused. `crossLevel.protectedFrom` (`enemies` | `everyone`) and `crossLevel.protectedAgainst` (`attacks` | `anything`) say so, defaulting to the old blanket, so a platform that says nothing — the Storm Border, whose sheet states no protection wording — keeps its behaviour. The Quetzalcoatlus authors `enemies` / `attacks`; the Hanging Gardens and the Golden Hind `enemies` / `anything`. The resolution says what it is through the placement's `reach`: the attack paths pass `"attack"` (also the default, the more protected reading), the Skill paths `"effect"`.

**An area catches an occupant instead of targeting it.** An area shape (anything but a single unit or point) is what the `aoe*` axes are for: a Master of a platform with `aoeMastersImmune` is dropped (reason `aoeMastersImmune` — *"receives no damage and effects"*), a factor of 0 drops anyone aboard (the Hanging Gardens), and any other factor **keeps** the occupant and carries `platformFactor` out on the target. `declareProcesses` records it per defender on the attack spec (`platformFactors`, as `bands` is) and stage 15 multiplies it in (`platformTierModifiers`), naming the platform in the breakdown: *"Quetz receives 50% Total Damage"*, the mount (the platform itself) full damage. Area-ness comes from the spec's shape and not from `state.isAoE`, which is false for an area that catches one Unit. `aoePassengerFactor()` had no caller outside tests, so riders took 0% of an area where two sheets say 50%.

### Destruction and scattering

**The deactivation block is shared with bounded fields.** A platform's `deactivation: { byOwner, window, lockout }` is the block a bounded field carries, read by one function (`deactivationVerdict`, Ch. 28): `byOwner` and `lockout` as before, and **`window`** — `any` is *"during Quetz's Turn or at the start or end of any Round or Turn"*, and a block with none is the owner's own Turn, which the verdict answers `notOwnTurn` when it is not (#150). The Quetzalcoatlus and the Golden Hind both state `any`.

**The Golden Hind's toll is a period from its activation** (ruled 2026-10-05, #187 reading 5, replacing the design's R6). *"At the end of every full Round Golden Hind is Active"* reads as the Turns that make a Round, counted from the Turn it was raised, that Turn not counted, as every duration is: raised on Turn 25 with three Turns a Round, her Master first pays at the end of Turn 28. The platform authors `upkeep.every: "1◈"`, the Quetzalcoatlus's shape. A Master at 50 Health or less is tested when the toll falls due and the ship closes instead of charging (reading 14, `endWhenUnaffordable`). Blazing Golden Rule's Galleon Token decay stays at each Round's end: it has no activation to count from (reading 15).

**A mount that attacks for its driver attacks as her** (#187 reading 2). The Golden Hind's Attack is *"Drake's Normal Attack"*, replaced. From her own slot she is the attacker already, and the ship supplies the spec (`unit: "mount"`). When the ship token itself attacks, `engine/attack.mjs#fireDamageDealt` now runs her `damageDealt` handlers beside its own, through `turnPartnersOf(ship, board, "attack")`, so Blazing Golden Rule's *"whenever this Unit performs a Crit"* hears a Crit either way.

**A Skill-path Noble Phantasm resolves its costs before paying them** (#187). The Golden Hind is raised on the Skill path, and that path paid the ability's own costs beside the NP cost: its upkeep `goldenHindUpkeep` (`supersedes: [npCost]`) charged 0 and the NP cost charged 53 anyway. `engine/skill-use.mjs#useSkill` now passes the NP cost, the ability's costs and a standing platform's upkeep through `rules/costs.mjs#resolveCosts`, as `engine/attack.mjs#pendingCosts` always has.

**The Golden Hind cannot be affected by buffs or debuffs** (#187). Its sheet says so in the Hanging Gardens' words, and the platform authored neither rule: Beyond the Uncharted from the deck put NP DmUp, Atk Up and NP Regen on the ship. It now carries `Immunity` at `scope: debuffs` and `scope: buffs`, as the Gardens do.

**The Golden Hind's hull takes only ranged Attacks from the ground** (#187). *"Enemy Units on the ground can only Attack the Golden Hind with ranged Attacks."* The platform authored the occupants' axes and not the hull's, so a melee Attack from the ground reached the ship. It now carries `crossLevel.hullTargeting: rangedOnly`, as the Gardens do.

**A deep token stands on each panel once** (#187). A v14 token has a depth, and the 4x3 Golden Hind at depth 3 reported 36 grid offsets, each panel once per elevation layer. `rules/snapshot.mjs#gridFootprint` keeps one entry per panel, the lowest layer, which `level` reads.

**What destroys one.** A platform whose Health reaches 0 is defeated like a Unit, and a defeated platform is destroyed; one that authors `destroyedWithOwner` (the Hanging Gardens: *"destroyed when Semiramis is defeated"*) is destroyed with its owner. The applier's `defeat` case asks `io.destroyPlatformsOf`, which reads `rules/platforms.mjs#platformsDestroyedBy`. Before §46.4-CH only an effect on the owner (`deactivateOn`) or an unpaid upkeep ever destroyed a platform.

**The save and the damage are opt-in, and the Hanging Gardens' alone** (ADR 0001, #139). Only its sheet states the ladder — *"all Units on it perform either an Agility Check or a Luck Check roll… fails, takes 100 Fixed STR damage"*. The Golden Hind says only that its riders are *"randomly scattered below it"*, and Quetzalcoatl's sheet says nothing of riders when the mount falls; the user ruled (2026-10-01) that **when a mount falls, its riders just drop to the ground — no check, no damage**. A platform that states the ladder authors a `collapse` block carrying its number (`collapse: { damage: 100, component: str }`, beside `knockOff`); presence is the opt-in, and a platform that says nothing has no save and no damage — steps 1 and 2 below do not run for it, and it goes straight to the scatter. Before #139 every platform ran the ladder on every way it ended (defeat, an unpayable toll, NP Seal), so the Quetzalcoatlus's forced close — which fires exactly when her Master has 25 Health or less — could kill him.

When a platform is destroyed, the sequence is ordered and the order matters (`module/rules/platforms.mjs#destructionSequence`):

1. **Save** (a platform with a `collapse` block). Passengers roll to avoid damage from the platform's destruction: each rolls the better of an Agility or a Luck Check, and a Master within 2 panels of its Servant who passed is spared its own (`rules/platforms.mjs#destructionSaves`), all announced in one chat card. `destroyPlatform` passed no saves until §46.4-CI, so every passenger took the damage and nothing was rolled.
2. **Damage** (a platform with a `collapse` block). Passengers who failed take the block's damage (the garden's 100 fixed STR), sourced from the platform.
3. **Scatter.** *Every* passenger moves to the ground, including those who made the save — surviving the platform is not the same as staying in the air. Each lands on a random free ground panel under the footprint, no two alike (`rules/platforms.mjs#scatterPanels`, the engine's dice); until §46.4-CJ they only changed level and landed directly under where they stood. **When the footprint's free panels run out, the landing goes outward** (#140): the rest land on the nearest free ground panels by Chebyshev distance from the footprint, ring by ring, random within a ring, inside the board and never on a panel an earlier passenger took in the same call. "Free" is the same rule as under the footprint — a ground Unit holds its panels; a platform, a structure or a Unit that `sharesPanel` does not — and a board with no free ground panel at all leaves the passenger on its own. The draw used to stop at the footprint, so a small mount or an occupied footprint left the surplus where they stood, two Units on one panel; the Quetzalcoatlus *"can Move onto occupied panels"* and falls over an enemy in ordinary play. The riders of a fallen mount just drop to the ground (ruling 12).
4. **Reverse effects.** Effects the platform granted its owner are removed (`module/engine/scene-levels.mjs:335-341`).
5. **Remove bound summons.** Creatures bound to the platform go with it. Bašmu is the reference case (`module/engine/scene-levels.mjs:344-359`).
6. **Delete the level.** The Scene Level is deleted only after every token has scattered off it (`module/engine/scene-levels.mjs:249-271`), because `TokenDocument#level` is required and non-nullable and Foundry does not re-parent on delete.

This is orchestrated by `engine/platforms.mjs#destroyPlatform` (`module/engine/platforms.mjs:122-151`), which calls the rules layer for descriptors, writes intents, and then runs `teardown` to perform the Foundry side (`module/engine/scene-levels.mjs:284-291`).

### A mount its rider drives

The Quetzalcoatlus is the only platform that replaces a rider's Move, and the Golden Hind replaces Drake's Normal Attack (`replacesRiderAction`, read by `rules/platforms.mjs#actionSourceFor`). While she rides, her Move **drives** the mount and her Normal Attack **is** the mount's, with the mount's Range; she and the mount share **one** Move and **one** Attack a Turn, and a Spell spends both (ruled 2026-10-01, #143). The gate that rations her drag is `rules/movement.mjs#gateMovement`, which measures her as the mount (`moverFor`: its MOV and effects, its obstacle rules, her Turn State; her Double Move and her Riding Active's +6 carry to it, ruled 2026-10-02) rather than refusing the drag at the edge of the footprint she stands on; her Master, who rides as cargo, is still held at the edge. The one Turn Record is `turnPartnersOf`, stamped by the Attack declaration, the move tail and Riding Attack; the Range is `attackRangeOf`. Her replaced Normal Attack is the mount's in **three** places, one function each: the damage (`baseSpecFor` and `namedUnits`), the targeting preview (`previewContext` builds the same base through `normalAttackBase` and fills the same `ctx.units.mount`, so the range shown contains the total the card deals, not her own BA(STR); #167), and the origin Range is measured from (`rules/platforms.mjs#attackSourceOf` gives the mount's whole footprint and Range, and the Counter rung, the threat overlay and the targeting session all ask it; #171). Only `attacksAsPlatform` swaps anything: what she casts herself, her Spells included, is measured from her own panel. The full account, with the reading taken about Riding's Active, is in [Ch. 19](19-action-economy.md).

### Deactivating a platform

The Quetzalcoatlus's sheet says *"This NP can be deactivated during Quetz's Turn or at the start or end of any Round or Turn, but cannot be deactivated for 2◈ Turns after it was activated"*; Drake's says she can end the Golden Hind during her Turn or at the start or end of any Turn or Round. Both author `deactivation: { byOwner: true, window: any }` (the mount with `lockout: "2◈"`), and until #141 nothing let an owner use it: the bar built its End slots from `board.fields` and a platform lives in `board.units`, so the only ends were defeat, an unpayable toll, an effect on the owner, or a GM at the console (`destroyPlatform` skips every gate).

`rules/platforms.mjs#deactivatablePlatforms` lists the platforms a Unit owns that author a `byOwner` deactivation, each with `platformDeactivation`'s verdict — `deactivationVerdict` read on the platform's own `deactivation`, `activatedAt` and owner. A platform inside its lockout is listed with `reason: "locked"` and `unlocksAt`, so the bar can say when it opens; one that authors no deactivation is never listed (silence means no), and nobody else's platform is. `window: any` is no timing gate for the offer, which stands whenever the owner's bar does; pressed outside her Turn, the End is queued for that Turn's end rather than run (ruled 2026-10-02, #65, ruling 19; Ch. 28). The bar's `end:<platformId>` slot (Ch. 34) asks the GM through the typed `deactivatePlatform` operation (`net/operations.mjs`), which authorises the player who owns the Servant that owns the platform and runs `engine/platforms.mjs#deactivatePlatform`: it re-checks the verdict — **the lockout is a rule, not a hidden button** — and then calls `destroyPlatform`.

**The lockout holds off a voluntary end and nothing else** (ruled, 2026-10-01). A forced close — an unpayable toll (`engine/fields.mjs`), an effect on the owner such as NP Seal (`engine/applier.mjs`) — calls `destroyPlatform` directly and never asks it, so *"if her Master's Health is 25 or less, this NP is forcefully deactivated"* is not held off by the 2◈ lock. And every way off the board arrives at `destroyPlatform`, so the 7◈ cooldown starts from any end of the mount (`setCooldownOnDestruction`). At a Round's end the Home Base heal runs before that threshold is read, so a Master standing home can be healed past it first; ruled as intended (#65, ruling 23; Ch. 29). Her Master aboard the mount over his Home Base rows is inside it, as on the ground (#177); a Unit inside the Storm Border is in no Home Base (Ch. 29).

### Pocket dimensions

The Storm Border (and any dimension) is a platform with no ground footprint. `enterDimension` rolls for eligible enemies, moves the manifest onto a new Scene Level, and records the entry panel. `resurface` moves the manifest back to the ground, offset from where it submerged (`module/engine/dimension.mjs:221-368`). Travel distance grows by 1 panel per ⅓ turn spent inside (`module/engine/dimension.mjs:133-140`). Neither resize the manifest — passengers keep their relative positions and move as a group.

A dimension whose owner is defeated forces a Luck Check. On success the dimension resurfaces but the owner still dies. On failure, every occupant takes Erase (`module/engine/dimension.mjs:197-202`). This is not a revival and must not register as one.

### Token sizing

A platform's `footprint` (`{w, h}`) must match its token's Foundry size (`TokenDocument#width`/`#height`). Because these live in different places and nothing connects them, sizing is enforced in three layers (`module/engine/token-footprint.mjs:20-27`):

1. **Content pipeline** — `tools/lib/content.mjs` compiles the prototype token's size from the authored footprint.
2. **On token creation** — `preMoveToken` hook sizes any platform token before it enters the world.
3. **On footprint change** — `updateActor` hook pushes a footprint edit onto the prototype and every placed token.

A token whose live size drifts from its stored size (e.g. mid-animation after a resize) is re-prepared to match (`module/engine/token-footprint.mjs:187-193`).

### Which level accepts a click

Clicking a token selects it only if that token is on the level being viewed (`module/apps/canvas/token.mjs:63-86`). A single-level scene is unaffected; the filter only matters once a platform exists and creates a second level. The override applies per-token so it re-evaluates on every refresh, surviving updates that would reset it. Otherwise a 9×9 platform at high elevation would swallow every click on the board beneath it.

### What a Level separates besides targeting

A bounded field is an area on one Level (`rules/bounded-fields.mjs#contains` compares `panel.k`, §46.4-BI), and **so is a painted terrain area** (#151, Ch. 26): a ground Burning area does not reach the Units aboard a platform above it — Quetzalcoatl and her Master riding the Quetzalcoatlus over Piedra Del Sol's 7×7 — and a deck's area does not reach the ground under it. A `zone` phase stamps the caster's Level, so a stone cast while Riding paints its Burning on the deck's Level, where its field already is. An area with no Level (a hand-drawn one) is on every Level. A following area — Sol's 5×5 of Day — follows its source's Level as well as her panel, and a change of Level alone (boarding) repaints it, so the daylight comes aboard with her.

## Invariants & edge cases

1. **A platform on level 0 has no passengers.** `passengersOf` refuses this read rather than returning every unit on the board (`module/rules/platforms.mjs:60-77`).

2. **Scene Levels are stacked above the ground, not picked by content.** Two platforms that chose the same elevation band would have their tokens inferred onto each other, so `nextBand` stacks each new level above every existing one (`module/engine/scene-levels.mjs:55-58`). Elevation follows level assignment so tokens inferred by `inferLevelFromElevation` land on the right level.

3. **Every orphaned platform level whose actor is gone is cleaned up on the next activation.** Nothing else removes levels, so levels accumulate until one platform is activated in the same scene (`module/engine/scene-levels.mjs:136-189`). Orphaned tokens on those levels are brought down first, because a deleted level leaves every token on it pointing at a non-existent id.

4. **Scattering must complete before the level is deleted.** The schema constraint forces this order (`module/engine/scene-levels.mjs:13-21`), and `destroyLevel` refuses to delete a level that still holds tokens.
5. **A client viewing the deleted Level is moved off it** (#176, ruled 2026-10-02). Live, the GM viewed the Quetzalcoatlus's deck and pressed End, and the canvas was left on no scene: the ground's `visibility.levels` write redrew it, and Foundry's own move to the scene's initial Level landed in the middle of that draw. `destroyLevel` and the orphan sweep now delete the Level first and write the ground after. Every client also runs `engine/level-exit.mjs`: on `deleteLevel`, a client that was viewing it waits for the canvas to settle and views the Level its selected token landed on, or the ground with none selected (`exitLevelFor`). One rule for every deletion: a platform ending, a pocket dimension closing, a collapse.

5. **The platform's own token must be placed on its level at activation.** Called first because every other placed token is moved by the caller, and placement without the platform produces a manifesto that makes every unit in the scene a passenger (`module/engine/platforms.mjs:213-222`).

6. **Level assignment is dispatched through `displaceToken`, not a direct update.** The level and elevation are Foundry v14 `MOVEMENT_FIELDS`, so assignment through the normal path is constrained by movement legality. An explicit `action: "displace"` and `fgtForced` flag tell the movement hook to stand aside (`module/engine/scene-levels.mjs:369-410`).

8. **The Hanging Gardens is beyond effects and reactions, and is attacked from below only at range.** Its `rules` carry `Immunity` at `scope: debuffs` and `scope: buffs` (the applier blocks either polarity), a `ForbidReaction` of its own Evade, Block and Counter, and an `incoming` one taking Counter from whoever it attacks. `crossLevel.hullTargeting: rangedOnly` makes a ground attack on the platform itself ranged-only; `crossLevelLegal` used to wave any attack on a platform through. Neither mattered until §46.4-BS: the resolver's kind filter dropped every platform as "a platform", so nothing could attack the garden at all. A platform with Health to lose is now a legal target, and Bašmu's guard covers it like any ally while a Bašmu stands aboard. The file had recorded the first two as unmodelled (#68). A defender's own forbidden rungs now also reach the react rung, where Invuln's "cannot Block" had been read only by the counter check.

9. **Boarding reads the Round the boarder was attacked in.** An Ability's attack records its content id on each defender's Round Record (`roundState.attackedBy`) -- ruled by the user as the same Round, since the attack and the boarding fall on two factions' Turns and a Turn record could never be read in time (§46.4-CO); a platform names the abilities that ease boarding in `boardingReliefAfter`, and `boardPlatform` reads the record when its caller does not say (the Hanging Gardens: Dragon Wing Warriors, −2). A Servant whose Master stood within 2 panels, on the ground beside it, is asked whether to bring them; a Master already on the deck is not offered (§46.4-CB). The Board button passed neither, so both Clauses were unreachable from the interface (#68).

7. **A Platform that acts is offered a Normal Attack unless it says it has none.** Platforms are acting Units (`rules/actions.mjs#ACTING_KINDS`). The Hanging Gardens *"does not Normal Attack"* and says so with the `noNormalAttack` grant in its `rules`, the same word Pale Rider's Riding EX uses. It used to say `range.targets: 0`, which the model clamps to 1 and nothing reads, so it was offered one (#100). A Structure takes no action at all and states no target count or Base Attack.

7. **Dimension travel preserves formation.** Passengers move as an offset group, not individually (`module/engine/dimension.mjs:350-360`).

## Traps and anti-patterns

**Cross-level rules documented and unit-tested but never called.** The `crossLevelLegal` function was written and thoroughly tested (`module/rules/platforms.mjs:165-193`), and `resolveTargets` has read `board.crossLevel` since it was written. But nothing ever *supplied* it — the Hanging Gardens' Aerial Garden of Vanity hit units standing directly underneath it, measured live. **If a rule matters, something must call it** (`module/rules/platforms.mjs:144-149`). **Found and fixed by `module/rules/targeting/resolve.mjs:229-245`, which now reads the verdict and applies it.**

**Platform token placed on the ground level instead of its own.** `activatePlatform` was created, the level was assigned to the platform actor, the platform's passengers were placed on it — and the platform's own token was never moved off the ground. So the Hanging Gardens sat at elevation 0, colliding with every unit, and `passengersOf` returned 21 of 21 units in the scene. **The platform's own token must be included in the level-move call** — `activatePlatform` now places it first, before any passenger (`module/engine/platforms.mjs:206-226`).

**Orphaned levels accumulating until the scene is unplayable.** Deleting a platform actor by hand, or an activation that failed after creating a level but before populating it, left the level behind forever. A second activation would create a second orphaned level. Measured at three stray "Hanging Gardens of Babylon" levels on one scene. **Clean up every orphaned level on the next activation, and bring stranded tokens down first, because deleting a level under its tokens leaves them pointing at a non-existent id** (`module/engine/scene-levels.mjs:136-189`).

**Elevation bands miscalculated, placing passengers inside the ground.** The band calculation used `count × height`, assuming the ground was `LEVEL_HEIGHT` tall. Foundry's default ground is `{bottom: 0, top: 20}`, so the first platform landed at 10–20, inside the ground band. Tokens assigned to it at elevation 10 were inferred back down to the ground because the ground level scored 0 (interior) and the platform scored 1 (on its bottom). Measured live: a unit placed aboard stayed at elevation 0. **Calculate the next band above the highest existing `top`, not as a multiple of the default height** (`module/engine/scene-levels.mjs:34-49`).

**Passengers assigned down but not back up to a platform.** The level and elevation fields are `MOVEMENT_FIELDS`, routed through the movement pipeline. A resize that found the path impossible deleted all movement fields from the update without error, so a token could move down but never back up to a platform. `activatePlatform` was left without access to `platformId`. **Assign levels through `displaceToken` with an explicit `action: "displace"` and `fgtForced: true` flag, bypassing legality** (`module/engine/scene-levels.mjs:369-410`).

**A complete engine facility with no way to reach it.** `boardPlatform` implemented the entire
boarding sequence — the relation gate, the roll, the level move, bringing the Master — and had no
caller anywhere in the repository: no entry in `rules/actions.mjs`, no UI string, no `fgt.api`
handle. Separately, the Master-bringing branch moved the Master to the platform whenever
`bringMaster` was set, under a comment describing a distance check — *"checked against where the
Master stood, not where the Servant ended up"* — that was not in the code: no Chebyshev call, no `2`
anywhere in either platforms module. A Master anywhere on the board would have been teleported onto
the platform the moment anything ever set `bringMaster: true`; nothing ever did, which is the only
reason it went unnoticed. Same shape as [#19](https://github.com/zarex97/FGT_FVTT_v2/issues/19) — a
correct rules-layer facility no engine path reaches. Filed and fixed as
[#24](https://github.com/zarex97/FGT_FVTT_v2/issues/24): a `board` action now offers itself once a
unit has moved onto an active platform's footprint (`module/rules/platforms.mjs#boardablePlatform`),
dispatched by `module/engine/actions.mjs`, and `mayBringMaster` measures Chebyshev distance from the
Servant's pre-board panel to the Master's, exactly as the comment always said
(`module/rules/platforms.mjs#mayBringMaster`). **A comment describing a check is not the check —
grep for the literal (a distance constant, a named function call) before trusting that a rule is
enforced.**

**A Platform with edges that nothing measured.** Neither the movement validator nor the knockback
resolver knew a Platform had a boundary: `validatePath` had no footprint awareness at all, and
`knockbackPanel` looked for a free panel by scene bounds and same-level occupancy. So a passenger
could **walk** off the edge, or be **shoved** off it, and in both cases ended up at Platform
elevation standing on nothing while the match carried on. #29 was filed as "a facility with no
caller"; the facility was the smaller half.

**A descriptor field that no intent could carry.** The fall descriptor has always said
`toLevel: 0` and the descriptor-to-intent step dropped it, because `I.move` takes a path and a
forced flag and nothing else. A Unit that "fell" therefore moved horizontally and stayed at Platform
elevation. Fixed with `dropToGround`, a per-token level change beside the whole-platform
`scatterToGround`. **A descriptor is not a contract — check the step that turns it into an intent
reads every field you wrote.**

## Open questions

- **Confirmed by reading the lookup.** The reuse is explicit and two-keyed:
  `game.actors.find((a) => a.system?.contentId === platformId && a.system?.ownerId === ownerId)`,
  with `?? game.actors.get(platformId)` as a direct-id fallback, and creation only when neither hits
  (`module/engine/dimension.mjs:233-243`). Matching on **owner as well as content** is what stops two
  different owners sharing one pocket dimension, and the comment states the case it was written for:
  *"A previous submersion leaves its actor behind, so an existing one is reused rather than
  duplicated."*

- **Resolved: see Traps and anti-patterns, [#24](https://github.com/zarex97/FGT_FVTT_v2/issues/24).**
