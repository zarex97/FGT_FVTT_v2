# Fate/Grail Tactics

The domain of F/GT — a grid-based tactical wargame of Masters, Servants and Noble Phantasms.
This file is the glossary: what each term **is**. How anything works belongs in `docs/`, not here.

Where a term names a closed set, that set lives in `module/domain/enums.mjs` and this file does not
restate it.

## The war and its participants

**Unit**:
Anything that occupies panels on the board and can be targeted. The six kinds are Servant, Master,
Civilian, Summon, Platform and Structure.
_Avoid_: token, actor, character, model

**Servant**:
A summoned heroic spirit, bound to a Master by a Contract, belonging to one of fourteen Classes.
The game's primary combatant.

**Master**:
The human participant who summons and commands a Servant, and who holds Command Spells.
A ranked non-combatant, though not a defenceless one.

**Faction**:
The side a Unit fights for. Alliances between Factions are declared, not implied.
_Avoid_: team, side, army

**Player**:
The person at the table. A Turn belongs to a Player, not to a Unit — this distinction is
load-bearing everywhere.

**Contract**:
The binding between a Master and a Servant. A Servant is Contracted, Free, or Unbound.

**Command Spell**:
A single-use authority a Master spends to compel or empower a Servant. Tracked per relationship,
not per Master.

**Holy Grail**:
The war's objective. It materialises once enough Servants have been defeated, and is then
contested.

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

**Tick** (**◈**):
The unit of duration, meaning "the number of Turns in a Round". It is a world setting, not a
constant, so every duration expressed in ◈ resolves differently between worlds.
_Avoid_: beat, tick-mark, diamond

**Phase**:
Whether the world is in Day or Night. Some abilities read it.

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
The turns that must pass before an Ability may be used again.

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

**Damage Step**:
One resolved instance of damage within a Combat Phase. One declaration may produce several.

**Rider**:
An effect an attack delivers alongside its damage, on the condition that the attack connected.

**Cover**:
A Servant taking a Noble Phantasm in place of its Master.

## Effects

**Effect**:
A named, timed change carried by a Unit.

**Effect Definition**:
The authored description of an Effect — its polarity, volatility, stacking rule and magnitude
shape. The definition is shared; what a Unit carries is an instance of it.

**Magnitude**:
How much of an Effect is applied. Distinct from its duration and from its Stage.

**Stage**:
A countdown within an Effect that decrements without removing it.

**Polarity**:
Whether an Effect is a buff, a debuff, or a neutral status. Decides who may see it by default.

**Volatility**:
Whether an Effect is non-volatile, volatile, mental or terminal. Decides what can strip it.

**Stacking**:
What a second application of the same Effect does — sum magnitudes, refresh, extend, stage, or
nothing.

**Family**:
An umbrella name for a set of Effects, so a rule can name the group rather than list it.

**Aura**:
A contribution a source expands onto the Units around it, evaluated where they stand rather than
stored on them.

**Immunity**:
A refusal to receive a named Effect at all, checked before anything is rolled.
