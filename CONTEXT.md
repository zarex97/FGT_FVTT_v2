# Fate/Grail Tactics

The domain of F/GT — a grid-based tactical wargame of Masters, Servants and Noble Phantasms.
This file is the glossary: what each term **is**. How anything works belongs in `docs/`, not here.

Where a term names a closed set, that set lives in `module/domain/enums.mjs` and this file does not
restate it.

## The war and its participants

**War**:
One match, from setup to the Holy Grail, fought on its own Board by its own Factions under its own
War Rules. A world may hold several Wars, each on its own scene, played at the same time.
_Avoid_: match, game, campaign, combat

**War Rules**:
The choices that shape one War: its ruleset, its war type, its Round gates, its timeouts and the
like. They belong to the War; the world holds only the defaults a new War starts from.
_Avoid_: settings, world settings, options

**Unit**:
Anything that occupies panels on the board and can be targeted. The six kinds are Servant, Master,
Civilian, Summon, Platform and Structure. A rule reads a Unit as the Board sees it: with the auras,
terrain and ZON that come from where it and the others stand.
_Avoid_: token, actor, character, model

**Servant**:
A summoned heroic spirit, bound to a Master by a Contract, belonging to one of sixteen Classes.
The game's primary combatant.

**Class**:
A Servant's kind. The seven Standard Classes are Saber, Archer, Lancer, Rider, Caster, Assassin and
Berserker; every other Class is an Extra Class: Ruler, Avenger, Alter Ego, Foreigner, Moon Cancer,
Pretender, Beast, Shielder and Saver. Saber, Archer and Lancer are the Knight Classes. Only a Servant
has a Class; a Master or a Summon has none.
_Avoid_: container (a War's slot a Class fills)

**Master**:
The human participant who summons and commands a Servant, and who holds Command Spells.
A ranked non-combatant, though not a defenceless one.

**Faction**:
The side a Unit fights for, in one War. Alliances between Factions are declared, not implied.
_Avoid_: team, side, army

**Player**:
The person at the table. A Turn belongs to a Player, not to a Unit — this distinction is
load-bearing everywhere.

**Contract**:
The binding between a Master and a Servant. A Servant is Contracted, Free, or Unbound.

**Conquest**:
The Contract a Master gains over every Servant of a Master its side has just killed. The Servants
pass straight from one Contract to the other, never becoming Free on the way.
_Avoid_: capture, claim, steal, inherit

**Sustainability**:
The clock a Free Servant spends to use a Noble Phantasm, having no Master to draw the cost from.
A Contracted Servant has no clock running.
_Avoid_: upkeep, stamina, lifespan

**Command Spell**:
A single-use authority a Master spends to compel or empower a Servant. Tracked per relationship,
not per Master.

**Holy Grail**:
The war's objective. It materialises once enough Servants have been defeated, and is then
contested.

## The authored source

**Character Sheet**:
The document a Unit is designed in — its statblock, its Abilities, and every rule they state, written
as prose. It is the authority a Unit is built *from*, and the thing an audit checks a Unit *against*.
The Foundry window that displays a Unit is the **actor sheet**, which is a different thing.
_Avoid_: sheet (unqualified), statblock (that is one part of it)

**Clause**:
One statement of a rule inside a Character Sheet — a numbered item, or a sentence that states a rule
without being numbered. The atom an audit is counted in.
_Avoid_: line, bullet, rule (that is the authored element, not the prose)

**Audit**:
The Clause-by-Clause check of a Unit against its Character Sheet, on a live board. It closes when every
Clause is Observed or Pressed; a Clause only traced, or only tested, keeps it open.
_Avoid_: review, check (unqualified)

**Kin**:
Two Clauses on any sheets that state the same rule in the same or similar words, once numbers, Ranks and
the bearer's name are set aside. Kin is measured by shared word pairs, so it is a lead, not a ruling.
_Avoid_: duplicate, match (Kin is rarely exact)

**Shape**:
A kind of thing Character Sheets are built from, with its fields and the values they take: an Ability, a
Cost, a Targeting, an Effect. The Character model is the set of Shapes.
_Avoid_: type, class (both name other things here)

## The route a value travels

**Authored Key**:
A key written in the content source of a Unit, an Ability or an Effect — the form a Clause takes once
it is data rather than prose.
_Avoid_: field (unqualified), property, attribute (that is a game term)

**Route**:
The ordered places an Authored Key must pass through to reach the code that reads it. A Clause
happens only if its keys survive the whole Route.
_Avoid_: pipeline, flow, path

**Hop**:
One place on a Route that names the keys it passes on. Anything a Hop does not name goes no further.
_Avoid_: layer, stage, step

**Silent Drop**:
A Hop discarding a key it does not name, with no error. The Clause it carried simply does not happen,
so nothing fails and the defect is found only on a live board.
_Avoid_: stripped, lost, missing, pruned

**Surprise**:
An expectation that reality contradicted: the design, a test or a claim said one thing, and a live
board, a test or the user showed another. Recorded one by one, then fused into patterns.
_Avoid_: bug (a Surprise may be a wrong belief with no defect), error, failure, miss

## The board

**Panel**:
One square of the board grid, addressed as a row/column offset. The atom of position and distance.
_Avoid_: square, tile, cell, space, hex

**Board**:
The full grid a war is fought on — 13×13, or 25×25 on the Large Board.

**Facing**:
The compass direction a Unit is turned toward. Read as one of four Cones — front, right, back,
left — by every rule that cares.

**Footprint**:
The set of Panels a Unit occupies. Multi-Panel Units measure distance from any Panel they occupy,
never from a single corner.
_Avoid_: size, area, base

**Level**:
A vertical layer of the board. Ground level and the deck of a Platform are different Levels.

**Platform**:
A Unit that other Units may board and be carried by, occupying its own Level.

**Knockback**:
Forced horizontal displacement of a Unit out of a Panel another Unit has moved into. The displaced
Unit stays on its own Level.
_Avoid_: push, shove, bump

**Knocked Off**:
A Unit leaving a Platform's Footprint because Knockback would carry it past the edge. Only a
Platform that states the rule can knock a Unit off; on every other Platform the edge holds.
_Avoid_: pushed off, fell off, thrown off

**Jump**:
A Unit's voluntary departure from a Platform's edge to a Board Panel within its MOV. Open to
Servants and Summons, never to Masters or Civilians.
_Avoid_: leap, dismount, disembark, unboard

**Scattering**:
The displacement of every passenger to ground Level when a Platform is destroyed. It takes the
passengers who survived the destruction as well as those who did not.
_Avoid_: dispersal, ejection

**Home Base**:
The zone a Faction starts in and defends, placed according to the war's shape.

**ZON**:
The Effective Servant Zone — the region a Servant's presence governs.

**Terrain**:
A property of Panels, evaluated for whoever stands on them.

**Bounded Field**:
A Noble Phantasm that encloses part of the board under its own membership, interior rules, upkeep
and escape conditions.
_Avoid_: zone, area, dome, barrier

## Time

**Turn**:
One Player's opportunity to act. A Turn moves several Units; it does not belong to any one of them.

**Round**:
One Turn per Player, plus the GM's Turn.

**Tick**:
One Turn, taken as a length of time: a fraction of a Round. Every duration comes down to a whole
number of Ticks, and the match counts the Ticks that have passed since it began.
_Avoid_: beat, tick-mark

**◈**:
One Round's worth of Ticks, meaning "the number of Turns in a Round". It is a War Rule, not a
constant, so a duration written in ◈ (⅓◈, 1◈+⅔◈) comes to a different number of Ticks in each War.
_Avoid_: diamond; calling ◈ a Tick

**Moment**:
A point in the match: a Round, and how many Ticks into the match. Whatever happens at a Round's or a
Turn's end reads the Moment that ended, not the clock, which has already moved on.

**Phase**:
Whether the world is in Day or Night. The War flips a coin for its first Round, and the Rounds
alternate from there. An ability may change the Round in progress; the alternation is unaffected, so
the next Round is what it would have been. A panel can differ from its Round (a Darkness area, Sol),
and a War may play without Day and Night at all.

**Turn Record**:
What a Unit has done so far during a Turn — that it Acted, how many Panels it Moved, which Abilities
it used. Stamped with the Tick it was written at, and read as blank when that Tick has passed.
_Avoid_: turn state, action log

**Round Record**:
The same at Round scale, for exclusions a Turn cannot express.
_Avoid_: round state

## Numbers a Unit carries

**Parameter**:
One of the five rated attributes — STR, END, AGI, MAG, LUC — each carrying a Rank.

**Rank**:
A graded value from E to A with EX above it, and `+` steps within a Grade. Ranks are compared and
stepped, never averaged.

**Grade**:
The bare letter of a Rank, without its steps. `A+` and `A` share a Grade.

**Base Attack**:
A Unit's inherent attack value, in a STR component and a MAG component.

**Health**:
A Unit's damage pool. A `null` maximum means the Unit is *undamageable* — which is not the same as
being at zero.

**Resource**:
An ability-specific pool a Unit carries, with its own ceiling. Distinct from the shared stats.

**Attribute**:
A tag describing what a Unit *is* — Human, Spirit, Divine, Living Human. Attributes imply one
another; only the most specific is authored.
_Avoid_: trait, tag, type, keyword

**Class Skill**:
A capability a Servant has by virtue of its Class rather than by authoring.

**Classic** and **Revised**:
The two texts a shared Skill can have while the game's author tests a new wording. Classic is the
text most sheets print; Revised is the new one. Each War picks one of them, or *As printed*, which
lets every sheet's own text stand; the pick is a War Rule. Mad Enhancement, Divinity and Presence
Concealment have both.
_Avoid_: old version, new version, v1, v2

## Abilities

**Ability**:
Anything a Unit can deliberately do beyond moving and attacking normally.

**Noble Phantasm**:
A Servant's signature ability, gated behind a Round threshold and ranked on its own scale.
_Avoid_: NP in prose; the abbreviation is fine in tables and code

**Skill**:
An Ability that is not a Noble Phantasm and not a Normal Attack.

**Normal Attack**:
The attack any combatant may make without an Ability, drawn from Base Attack.

**Mode**:
A persistent state an Ability puts a Unit into, switched on and off, and sometimes forced.

**Stance**:
A per-action declaration, free to make but constrained to a window. Distinct from a Mode by its
lifetime.

**Cooldown**:
The turns that must pass before an Ability may be used again. It starts when the use is committed and
is settled once the use is over, from what the use did.

**Use record**:
What one use of an Ability did: whether it failed, whom it hit, what it applied and inflicted, what it
summoned and which criteria it met. One record per declaration, however many defenders it reached.
_Avoid_: use result, outcome (an Effect's landing has its own outcome)

**Criteria**:
A list of tests an Ability states about the Units it is aimed at, counted once per declaration; the
number met can size its damage, its cost and its Cooldown.

**Count**:
A number a rule reads from one of a closed list of sources: Effects held, targets, Units on the board,
a resource, Parameters compared, criteria met, a fact of the Use record, or a Mode's Tally.
_Avoid_: X (the sheets' own letter for it)

**Tally**:
The events counted during one activation of a Mode; a Mode may end when its Tally reaches a number.

**Timing Window**:
The moment at which an Ability may be used — the vocabulary that decides whether a reaction is
legal now.

## Combat

**Combat Phase**:
The whole exchange provoked by one declared attack, from declaration through to applied damage.

**Combat Process**:
The ordered sequence of named steps a Combat Phase runs through. One Process per distinct defender.

**Reaction**:
What a defender may answer an attack with — Evade, Block, Counter, or nothing.

**Counter**:
An attack made in answer to an attack. Whether a Counter may itself be Countered is a rule, not an
assumption.

**Injury Roll**:
The roll made when damage crosses a threshold, deciding a lasting consequence.

**Weak Point**:
A declared sub-attack with its own hit table, offered only when it could land.

**Attack Description**:
Everything a Clause may ask about one attack against one defender: what it is, what it carries, how
far it reaches and how it was answered. Fixed in part when the attack is declared, and completed for
each defender. The preview, the resolution and the counterfactual read the same one.
_Avoid_: attack spec, facts, context (those are its parts in code)

**Delivery**:
Whether an Attack is Ranged, Melee or Special, as its sheet states it (`{R}`, `{M}`, `{S}`, a Normal
Attack's `N.Atk Type`). The closest statement wins: one hit's, a Normal Attack's distance band's, the
Attack's. An Attack that states none is measured by its Range. Special is neither Ranged nor Melee.
_Avoid_: attack type, range type, ranged-ness

**Damage Step**:
One resolved instance of damage within a Combat Phase. One declaration may produce several.

**Rider**:
An effect an attack delivers alongside its damage, on the condition that the attack connected.

**Cover**:
A Servant taking a Noble Phantasm in place of its Master.

**Feigned Defeat**:
A defeat every other player is shown while the Unit lives on, hidden from them. No defeat rule
fires: no on-defeat Clause, no kill credit, and its Contract stands. It ends when the Unit is revealed.
_Avoid_: fake death, shadow state, survived defeat

## Effects

**Effect**:
A named, timed change carried by a Unit.

**Effect Definition**:
The authored description of an Effect — its polarity, volatility, stacking rule and magnitude
shape. The definition is shared; what a Unit carries is an instance of it.

**Effect Entry**:
What content authors to give an Effect: its id and what to apply with it — magnitude, duration,
chance, stages, uses, the conditions it waits for. Written in an ability's phases, a rider, an event
handler or a field; the same entry means the same thing wherever it is written.
_Avoid_: effect spec, rider spec

**Landing**:
Applying one Effect Entry to a Unit: its chance and its die, resistance and the exemptions from it,
stacking, the Prevention Luck Check, and the line a player sees. Every path lands an Effect the
same way.

**Prevention Luck Check**:
A Unit about to receive a debuff during a Combat Process may spend 1 Luck on a Luck Check to stop
it, once per Combat Process. Never against a terminal Effect.

**Magnitude**:
How much of an Effect is applied. Distinct from its duration and from its Stage. It may fall while
the Effect stands, with each Turn or each event its definition names; at zero the Effect ends.

**Stage**:
A countdown within an Effect that decrements without removing it.

**Pause**:
A stretch in which an Effect's duration does not count down, while a condition its definition names
holds.

**Polarity**:
Whether an Effect is a buff, a debuff, or a neutral status. Decides who may see it by default. It is
decided when the Effect lands, by its definition, by whether the bearer is an ally or an enemy of its
source, or by the entry that applies it, and it does not change after.

**Volatility**:
Whether an Effect is non-volatile, volatile, mental or terminal. Decides what can strip it.

**Stacking**:
What a second application of the same Effect does — sum magnitudes, refresh, extend, stage, or
nothing. Some Effects allow one instance on a War's whole board, alone or as one of a group: a new
one replaces the old.

**Family**:
An umbrella name for a set of Effects, so a rule can name the group rather than list it.

**Aura**:
A contribution a source expands onto the Units around it, evaluated where they stand rather than
stored on them.

**Immunity**:
A refusal to receive a named Effect at all, checked before anything is rolled.
