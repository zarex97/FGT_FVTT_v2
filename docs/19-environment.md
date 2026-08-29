# 19 — Environment

The board is not neutral. Home bases heal and protect, the day/night cycle swings damage by
50% against [Dark] units, regions buff whole rosters, the Grail materializes and can be
destroyed, and the GM can inject events at will. This chapter specifies all of it.

---

> **Implemented (Ch. 45 C2).** `module/rules/environment.mjs` holds the rules; `snapshotBoard`
> runs `annotateEnvironment` and `annotateRegionBonus` beside terrain and auras; `scheduler`
> maps the Home Base descriptors and advances the Grail at round end; `MatchData` is the Grail's
> runtime owner.
>
> Two things this chapter specified that had **no runtime owner at all** until then:
> `MatchData.grailCounter` existed from the beginning with nothing incrementing or reading it,
> so the Grail could never materialize; and `MatchData.region` existed with nothing granting the
> parameter step it implies.
>
> Still GM-driven rather than automated, as §19.5 intends: the Random Event table itself. The
> one event the rulebook specifies — Civilians — **is** implemented.

## 19.1 Home Base

Each Faction owns an area at its end of the field. Five distinct effects, each with its own
conditions.

### E1 — End-of-round regeneration

> *"At the end of every Round, all Units within their Home Base restore **100 Health and 1
> Agility**; excluding Units who were involved in Combat within their Home Base during that
> Round."*

Two conditions, and the exclusion is narrower than it first reads: the unit is excluded only if
the combat happened *within the home base*. A unit that sortied out, fought, and returned still
regenerates.

```ts
interface HomeBaseResidency {
  consecutiveRounds: number;
  combatInBaseThisRound: boolean;
}
```

`combatInBaseThisRound` is set by the combat engine when a Combat Process occurs with this unit
as AU or DU and the unit's position is inside its own home base. Cleared at round start.

### E2 — Debuff cure after three rounds

> *"If a Unit affected by debuffs remains in its Home Base for **3 full Rounds**, it is cured of
> all debuffs at the end of the Round excluding Unremovable debuffs unless stated."*

Requires `consecutiveRounds >= 3`, checked at round end after E1. The counter resets to 0 the
moment the unit leaves. Note it does *not* reset on combat — only on leaving.

Whether the counter resets after firing is unstated. **DECISION.** It resets to 0 after a cure,
so a unit must sit three more rounds for another cure. Ch. 41.

### E3 — Damage reduction

> *"All damage taken by a Unit in its Home Base is reduced by **10% including NP**."*

A percentage on damage taken ⇒ it joins the additive bucket at pipeline stage 4 as a
Def Up-equivalent (Ch. 13 §13.6 makes this point with a worked correction). "Including NP" means
no reduced NP magnitude.

### E4 — Damage bonus in mutual base combat

> *"When a Unit engages in Combat with an enemy Unit within its Home Base (**both** Units have
> to be in the Home Base), all damage dealt by the Unit in its Home Base is increased by **20%;
> if NP, 10%**."*

Requires both combatants inside. Also stage 4, with an NP-reduced magnitude.

### E5 — Territory Creation amplification

Territory Creation's two passives key on home-base membership (Ch. 15 §15.6): an offensive
dice bonus when the owner is in its base (applying even to attacks *out* of the base), and a
defensive dice reduction for allies in the base.

### Additional home-base rules

| Rule | Source |
|---|---|
| The Grail never spawns in a home base | *"appear on a random panel on the field **excluding Home Bases**"* |
| `CS: Escape` teleports the pair into the home base | Command Spell |
| Nemo's Zero Sail cannot resurface into an **enemy** home base | *"onto a 5×5 panel area on the board excluding enemy Home Bases"* |
| Semiramis's HGoB *"counts as a second Home Base for Semiramis' Faction"* | HGoB |
| Semiramis must be in her home base to activate the HGoB | HGoB |
| Initial deployment is free within the home base | *"both players are allowed to freely arrange their Units within their Home Base"* |

The HGoB clause means home-base membership is `unit is inside ANY region tagged homeBase and
owned by unit's faction`, not a single-region test.

### Implementation

Foundry `Region` documents with a `fgt.homeBase` behaviour carrying `factionId`. Region
membership is computed per board snapshot (`engine/board.mjs#homeBaseZonesOf`,
`rules/snapshot.mjs#snapshotBoard`), not maintained via `tokenEnter`/`tokenExit` events — a
board-build sweep, not a running residency subscription.

**Implementation note.** `snapshotBoard` read a `scene.zones` property no Scene document has,
discarding `homeBaseZonesOf`'s own output (`currentBoard`'s `settings.zones`); `board.zones` was
`{}` for every board, always, so no unit was ever "in" a Home Base — found live activating
Semiramis's Hanging Gardens, which gates on it. The Region-membership sweep itself had a second,
independent bug: its fallback path (`panelsOfRegion`, used when
`RegionDocument#getOccupiedGridSpaceOffsets` is unavailable) called `RegionDocument#testPoint`,
which is a real method that always answers `false` in this Foundry build — containment lives on
the canvas placeable (`region.object`), not the document. Both fixed; see
`rules/snapshot.mjs#snapshotBoard` and `engine/board.mjs#panelsOfRegion`.

---

## 19.2 The Day/Night cycle

> *"When the game starts, Flip a Coin. If Heads, the first Round is 'Day'. The next Round will
> be 'Night' and so on."*
> *"During a Day Round, all damage received by Units with the '**Dark**' Attribute is increased
> by 25% including NP, while all damage dealt by Units with the 'Dark' Attribute is reduced by
> 25% including NP. Vice versa during a Night Round."*

Alternating, one flip at game start. So the phase is a pure function of the round number and
the initial flip:

```ts
function phase(round: number, startedAtDay: boolean): "day" | "night" {
  const isDay = (round % 2 === 1) === startedAtDay;
  return isDay ? "day" : "night";
}
```

The effect is symmetric and applies only to units carrying the `Dark` attribute:

| Phase | Dark unit dealing damage | Dark unit taking damage |
|---|---|---|
| Day | −25% | +25% |
| Night | +25% | −25% |

Both "including NP", so no reduced magnitude. Both join the stage 4 bucket.

**None of the 12 reference Servants carry the `Dark` attribute.** So this rule is currently
inert for the acceptance set — but it is cheap to implement (two rule elements on a built-in
`environment-core` passive) and content will eventually need it.

A `Light` counterpart is not defined in the source. Not implemented.

---

## 19.3 Region

> *"Before starting the game, if all players agree, the GM can (randomly) select a country/region
> the war would take place in. In this case, all Servants from the corresponding Region selected
> receives a **+ to all Parameters** (D to D+, B- to B, C+ to C++, etc)."*

A one-time setup modifier applied to every Servant whose `region` list includes the selected
region. Because it grants parameter *steps*, it also triggers the Base Attack adjustment
(±10 per granted step — Ch. 05 §5.6), which is why `Parameters` separates `base` from `granted`.

Regions in the reference set: Netherlands, Europe, Greece, Ireland, Moon, Mesopotamia,
Middle East, India, Japan, Far East, England, East India.

Note several Servants list **multiple** regions (Van Gogh: *"Netherlands, Europe, Greece"*;
Nemo: *"East India, Greece"*; Kiritsugu: *"Japan, Far East"*). Matching is `any`, so Van Gogh
benefits from a Greek, Dutch, or European war.

Region also interacts with Semiramis's HGoB Construction:

> *"If the Grail War's region is in a Middle East region, the HGoB Construction counter starts at
> 25 instead of 0. If the Grail War region is **directly next to** a Middle East region, the
> counter starts at 10."*
> *"If the Grail War's Region is in a Middle East region, all Construction increases are doubled
> excluding effects 1 and 2; if directly next to, all increases are increased by 2."*

"Directly next to" is a **geographic adjacency** relation between regions, which the source
does not tabulate. **DECISION.** Ship a region graph as data (`regions.json`) with a curated
adjacency list, editable by the GM. Semiramis is the only content that consumes it, but the
mechanism is general.

```json
{
  "middleEast": { "adjacent": ["mesopotamia", "egypt", "anatolia", "persia", "greece"] },
  "greece":     { "adjacent": ["anatolia", "italy", "balkans", "middleEast"] }
}
```

---

## 19.4 The Holy Grail

### Materialization

> *"After a certain number of Servants are defeated (recommended number is nine, or at least
> seven), the Holy Grail will appear on a random panel on the field excluding Home Bases."*

The threshold is a ruleset config value (default 9). The counter increments on Servant defeat
**and** disappearance, but not on `Erase`:

> *"A disappeared Servant counts towards the number of Servants needed for the Grail to
> materialize (but not if inflicted with Erase)."*

```ts
interface GrailState {
  threshold: number;
  defeatedCount: number;
  materialized: boolean;
  position: GridOffset | null;
  contest: Map<string, { unitId: string; roundsHeld: number }>;
  destroyed: boolean;
}
```

### Acquisition

> *"In order to obtain the Holy Grail, a Unit must remain on a panel next to the Grail for **1
> full Round**, without any enemy Units within the Grail Area. (Grail Area = 2 panels)"*
> *"The Grail cannot be obtained by a Unit if there are any enemy Units within the Grail Area."*

So:
- Position: Chebyshev 1 from the Grail (*"on a panel next to"*).
- Duration: one full Round.
- Condition: no enemy units within Chebyshev 2 of the Grail, for that entire Round.

Evaluated at round end. The contest map tracks each qualifying unit's consecutive rounds; any
enemy entering the Grail Area resets **all** contenders.

**Ambiguity:** if two units from *different* factions are both adjacent, each is "an enemy Unit
within the Grail Area" for the other, so neither can claim. Correct and intended — it makes the
Grail a standoff.

### Destruction

> *"If the Holy Grail is hit by an AoE NP that deals damage, it has a chance of being destroyed.
> The chance is X%, where X = the amount of damage dealt by the NP divided by 20. If the Holy
> Grail is destroyed, there are no winners. Everyone loses. (The Overseer wins?)"*

So a 1,000-damage AoE NP has a 50% chance of ending the game with no winner. A 2,000-damage NP
is a guaranteed loss for everyone.

```ts
if (attack.isNP && attack.isAoE && targetIncludesGrail && damage > 0) {
  const pct = damage / 20;
  if (chance(pct, rng)) endGame({ outcome: "grailDestroyed", winner: null });
}
```

This is a genuine trap and the targeting preview must warn about it loudly:

```
⚠ The Holy Grail is within this area.
  Estimated damage 1,847 → 92% chance of destroying the Grail.
  If the Grail is destroyed, ALL factions lose.
  [ Confirm anyway ]  [ Cancel ]
```

Requiring an explicit second confirmation. A player who destroys the Grail by accident because
the system did not tell them has been failed by the system.

### Victory conditions

Two ways to win:
1. Defeat all enemy Units.
2. Obtain the Holy Grail.

One way for everyone to lose: destroy the Grail.

```ts
function checkVictory(board: BoardSnapshot): VictoryResult | null {
  if (board.grail.destroyed) return { outcome: "noWinner" };
  const held = board.grail.contest.entries().find(([, c]) => c.roundsHeld >= 1);
  if (held) return { outcome: "grailObtained", faction: factionOf(held[1].unitId) };
  const alive = factionsWithLivingUnits(board);
  if (alive.length === 1) return { outcome: "elimination", faction: alive[0] };
  return null;
}
```

Evaluated at round end.

---

## 19.5 Random Events

> *"The GM may introduce Random Events into the game at any time whatsoever."*

Fully GM-driven. The system provides tooling, not automation:

```ts
interface RandomEvent {
  id: string;
  name: string;
  description: string;
  trigger: "manual" | "roundStart" | "roundEnd";
  weight: number;                // for the random table
  effect: Phase[];               // reuses the ability phase system
}
```

A `RollTable` of events with a "roll a random event" button on the GM's HUD, plus a manual
picker. The one event the rulebook actually specifies:

### Civilians

> *"From time to time, a Civilian may appear on the field. If a Servant Attacks a Civilian, the
> Civilian is instantly killed. The Servant restores **100 Health and 1 Agility**. (On Lunatic,
> there should always be at least **2** Civilians on the board)"*

Three mechanics:
1. **Instant death.** A Servant attacking a Civilian kills it with no damage calculation, no
   reaction, no Overpower. A distinct resolution path (Ch. 04 §4.6).
2. **Reward.** +100 Health, +1 Agility to the killer.
3. **Lunatic invariant.** The board maintains ≥2 Civilians, checked at round start and topped up
   by spawning at random unoccupied non-home-base panels.

> **Implemented:** `civilianKill`, `mayAttackCivilian` and `civiliansNeeded`. A Civilian never
> enters a Combat Process — `resolveAttack` resolves the kill before one is built, because a
> ladder whose every rung has one outcome is not a ladder. The Good-alignment refusal names the
> `Kill Humans` Command Spell as its override, and B1's `overrideValidation` is what carries it.

And the alignment restriction:

> *"Servants with the 'Good' Alignment will not kill Civilians. They will not use an AoE Noble
> Phantasm if there is a Civilian within Range. They will only kill Civilians if a Command Spell
> is used."*

Two separate prohibitions:
- Direct attack on a Civilian: refused.
- AoE NP with a Civilian in the area: refused **at placement**, with the `Kill Humans` Command
  Spell offered inline (Ch. 09 §9.6).

The second is the one with teeth. It means a Good-aligned Servant's AoE NPs are *positionally
constrained* by Civilian placement, which is exactly the tactical texture the rule is for. Of
the 12 reference Servants, the Good-aligned ones are Mannanán (Neutral Good), Scáthach
(Neutral Good), Karna (Chaotic Good), Kingprotea (Lawful Good), and Penthesilea (Lawful Good) —
five of twelve, so this rule fires often.

Heracles is `Chaotic Mad` — not Good, so unrestricted.

---

## 19.6 Terrain

> **SUPERSEDED.** This section is replaced by **[Chapter 42 — Terrain](42-terrain.md)**. The
> *Terrain Effects* document supplies 21 terrain types with full mechanics and a directional
> overlap-resolution matrix. What follows is retained only as the record of what we knew from
> the rulebook alone.

The rulebook alone defines **no terrain types**. There are no walls, no difficult terrain, no
elevation on the base board.

But three Servants reference named area types that do not otherwise exist:

> Nemo: *"When Nemo is within a '**Waterside**' or '**Imaginary Numbers Space**' area, all damage
> taken is reduced by 50; if NP, 100."* (and three more skills key on it)
> Van Gogh: *"Imaginary Numbers Arts"* (a skill name, not an area)

So `Waterside` and `Imaginary Numbers Space` are **named zone types** that a scene may contain.
`Imaginary Numbers Space` is created by Nemo's own Zero Sail; `Waterside` must be authored on
the map.

**DECISION.** Introduce a general **terrain tag** system: a `Region` may carry one or more
terrain tags, and effects predicate on `self:terrain:waterside`. Ship `waterside`,
`imaginaryNumbers`, and `throneRoom` as the initial vocabulary; the tag list is open and
GM-editable.

This costs almost nothing (a Region behaviour with a string set, plus a predicate source) and it
is the natural home for future content.

---

## 19.7 The board setup sequence

```
1. Choose ruleset          Great HGW (3 turns/round) | HGW (8) | custom
2. Choose difficulty       Beginner | Intermediate | Expert | Lunatic
3. Choose board size       13×13 | 25×25
4. Choose region           (optional) → grants +1 parameter step to matching Servants
5. Roll day/night start    coin flip
6. Master selection        (optional) draft of essences by rank quota
7. Assign Masters to Servants
8. Servant selection       d20 for pick order; d4 for how many each faction picks;
                           remainder assigned randomly by the GM
9. Run setup rolls         per Servant and per Master (Ch. 14 §14.9)
10. Deploy                 free placement within each home base
11. Roll turn order        each faction rolls; higher chooses first or second
12. Round 1 begins         NO ATTACKS PERMITTED THIS ROUND
```

Steps 1–5 and 9–12 are automated. Steps 6–8 are the draft, deferred to a later milestone
(Ch. 01 §1.4 non-goal 2), with a manual path in v1: the GM assigns Servants and essences
directly.

> **Implemented:** step 4's region choice (`MatchData.region`, granting the parameter step via
> `annotateRegionBonus`), step 5's day/night flip (`phase`, a pure function of the round number),
> and step 12's attack gate (`attacksPermitted`, refused at declaration with the rule named
> rather than surfacing as an unexplained targeting error). Difficulty is on `MatchData` and
> drives the Lunatic Civilian invariant.

Step 12's restriction — *"During the first Round, neither Player/Faction is allowed to Attack"* —
is a hard gate on all attack declarations, enforced by the ability validator with a clear
message.

---

## 19.8 The turn-order roll

> *"To determine the Turn order, both Players/Factions roll a die. The Player/Faction with the
> higher number can choose whether to go first or to go second."*

**The generalized rule** (Ch. 41 Q32, answered):

- Every faction rolls `1d100`. Highest goes first, and so on down.
- **Ties are re-rolled for the contested positions only.** If two factions tie for second, the
  tie-break roll assigns one to second and the other to third; the rest of the order is
  untouched.
- **The GM always takes the final slot.**
- **The order is re-rolled at the start of every Round.**

That last clause is a significant departure from the earlier draft, which fixed the order at
setup. Consequences:

| Affected | Change |
|---|---|
| `Combat.system.baseOrder` | Recomputed at each round start, not stored once |
| `Delay` | Still shifts a player within the *current* round's order; the shift does not persist, because next round is re-rolled from scratch |
| Planning | A player cannot rely on acting after a specific opponent next round |
| `globalTurn` arithmetic | **Unaffected** — the number of turns per round is constant, so every duration and cooldown calculation is untouched (Ch. 07 §7.8) |

The `globalTurn` design pays off again here: re-rolling *who* acts at each tick changes nothing
about *how many* ticks exist, so no duration math is disturbed.

**Implementation.** `rollTurnOrder()` runs in the round-start scheduler sequence (Ch. 07 §7.7,
step 9a), writes the new `baseOrder`, and clears expired `Delay` entries. The result is
broadcast and shown in the turn HUD with the rolled values, so nobody has to take the ordering
on trust.

---

## 19.9 Environment as rule elements

Every environmental effect in this chapter is implemented as a rule element on a built-in,
always-present `environment-core` passive item, not as engine code:

```yaml
id: environment-core
hasPassive: true
passiveRules:
  - key: DamageTakenModifier
    value: -10
    mode: percent
    includesNP: true
    predicate: ["self:inOwnHomeBase"]

  - key: DamageDealtModifier
    value: 20
    npValue: 10
    mode: percent
    predicate: ["self:inOwnHomeBase", "target:inAttackersHomeBase"]

  - key: DamageTakenModifier
    value: 25
    mode: percent
    includesNP: true
    predicate: ["self:attribute:dark", "board:phase:day"]

  - key: DamageDealtModifier
    value: -25
    mode: percent
    includesNP: true
    predicate: ["self:attribute:dark", "board:phase:day"]

  # …and the night mirrors

  - key: OnEvent
    event: roundEnd
    predicate: ["self:inOwnHomeBase", "not:self:combatInBaseThisRound"]
    then:
      - { key: StatDelta, stat: health,  delta: 100, clamp: true }
      - { key: StatDelta, stat: agility, delta: 1,   clamp: true }

  - key: OnEvent
    event: roundEnd
    predicate: ["self:homeBaseResidency:gte:3"]
    then:
      - { key: RemoveEffects, selector: { kind: all }, excludeUnremovable: true }
```

Two benefits: the environment is inspectable in the same UI as everything else, and a GM
running a variant can disable or edit individual rules without a code change.

---

## 19.10 Summary of decisions

| # | Decision |
|---|---|
| D19.1 | Home base membership tests **any** region tagged as a home base for the unit's faction (the HGoB counts as a second one). |
| D19.2 | Home base residency resets to 0 after firing a debuff cure. |
| D19.3 | Day/night phase is derived from round number and the initial flip, never stored. |
| D19.4 | Region adjacency ships as an editable data graph. |
| D19.5 | Grail destruction requires an explicit second confirmation in the targeting UI. |
| D19.6 | Terrain is a general open tag system on Regions, seeded with `waterside`, `imaginaryNumbers`, `throneRoom`. |
| D19.7 | Turn order for >2 factions: all roll d20, highest picks first, GM always last. |
| D19.8 | All environmental rules are authored rule elements on an `environment-core` passive, not engine code. |

---

**Next:** [20 — Platforms and Levels](20-platforms-and-levels.md)
