# 31 — War Setup and Summoning

## What it is

A **faction** is an id plus a display name, not a free-text label, because two units whose faction strings differ by a typo are enemies silently and irrecoverably (`module/rules/factions.mjs:9-12`). Alliances are symmetric and reflexive, enforced rather than trusted: a roster where red allies blue but blue does not ally red is someone's half-finished edit, and the safe reading refuses every enemy contract until both factions declare it (`module/rules/factions.mjs:14-18`).

A **container** is the unit of setup — not just a Servant, but the slot it will occupy. `ServantData.classContainer` has always recorded which container a Servant holds; nothing recorded that a war HAS containers or which faction owns them. The seven core classes always have a container each; beyond that, every further slot is an `EXTRA` — a catch-all for any Servant holding no core class (`module/rules/war-setup.mjs:10-15`).

Summoning splits into **prepare → re-roll → commit**, never one shot. Every line is shown before anything is written, with per-line GM re-roll (`module/engine/summon.mjs:8-16`). Contracts form during setup when a Master is paired with a Servant, and again mid-game when one unit claims another's allegiance.

**Conjuring** is different: when a Skill summons a summon (Medea's Warriors, the Sphinxes), that is the `summon` phase, and the conjured actor may expire on a schedule. Setup happens once; summoning happens repeatedly and lives under a different set of rules.

## Where it lives

| File | Role |
|---|---|
| `module/rules/factions.mjs` | Faction roster, normalization, alliance graph derivation |
| `module/rules/war-setup.mjs` | Container roster, candidate filtering, validation |
| `module/engine/war-setup.mjs` | Building the board: scene, home bases, summoning Masters and Servants |
| `module/engine/summon.mjs` | Preparing, rolling, and committing a summon; setup line resolution |
| `module/engine/contract.mjs` | Attempting a contract; applying conquest transfers |
| `module/rules/contract.mjs` | Legal contract checks, plan generation, outcome resolution |
| `module/rules/setup-rolls.mjs`, `module/rules/setup-rolls-normal.mjs` | What to roll and how to fold the results for Servants and Masters |
| `module/rules/summon-variant.mjs` | Resolving a summon-time coin flip (Semiramis's variant branch) |
| `module/engine/summoning.mjs` | Running the `summon` phase — conjuring mid-game summons |
| `module/rules/summons.mjs` | Detecting expired conjured summons by absolute tick |
| `module/apps/setup-wizard.mjs`, `module/apps/summon-dialog.mjs` | Setup UI |

## How it works

### Factions and alliances

`normalizeFactions` reads the stored roster, dropping malformed entries and filling defaults (`module/rules/factions.mjs:43-92`). Every faction carries an `id`, `name`, `color`, `userIds` (a list, because a Great Holy Grail War is "7 players cooperating as one Faction"), and `allies` (`module/rules/factions.mjs:22-28`). Alliances are symmetrized: if red allies blue, the normalizer adds red to blue's list (`module/rules/factions.mjs:84-89`).

`alliancesOf` produces the board snapshot's alliance map: faction id → every id it counts as an ally, including itself (`module/rules/factions.mjs:106-111`). Without the faction in its own list, a unit would be an enemy of its own side.

### War shape and containers

The war's **shape** decides what containers exist. The default is `perFaction` containers per faction, typically seven (the core classes in rulebook order), beyond which every further slot is `EXTRA` (`module/rules/war-setup.mjs:91-100`). Containers may be drawn randomly or filled with a fixed choice.

`candidatesFor` returns every catalogue entry that may fill a container: core classes match by membership (Semiramis is a candidate for both Caster and Assassin), and `EXTRA` matches the complement—any Servant holding no core class (`module/rules/war-setup.mjs:103-128`). An empty candidate list produces a validation error with a reason, not a silent skip (`module/rules/war-setup.mjs:130-154`).

### Building the board

`commitWar` builds the whole war in a sequence where nothing is written until its line is logged (`module/engine/war-setup.mjs:280`). The Combat is created second, not last—the log lives on it and records the steps that precede it (`module/engine/war-setup.mjs:265-276`). The war's shape is written BEFORE the summon loop, because every path downstream reads `warRuleset()` from the Combat (`module/engine/war-setup.mjs:313-326`).

Home bases are painted as Foundry Regions with grid shapes, one per faction, tagged with `homeBase` behaviour and the faction id (`module/engine/war-setup.mjs:101-157`). Existing home-base Regions are deleted first so setting up twice on one scene leaves no stale bases (`module/engine/war-setup.mjs:126-130`).

For each container, `createMasterFor` rolls the Master's setup lines (Health, Agility, Luck, Rank, Command Spells, Base Attack MAG) off the plan returned by `plansFor(ruleset).master` (`module/engine/war-setup.mjs:213-263`). A Normal Master's ZON is looked up by container class; an Advanced Master takes the template's 2 (`module/engine/war-setup.mjs:191-193`).

`prepareSummon` readies a Servant, rolls setup lines (Health, Agility, Luck), and returns the plan WITHOUT writing (`module/engine/summon.mjs:88-108`). `commitSummon` creates the actor, applies setup line values and grants, sets the Master and faction, and records `summonedAt` for the match's global turn (`module/engine/summon.mjs:170-274`). Partners (linked groups marked `summonTogether`) are summoned in the same commit, cross-linking their `memberIds` (`module/engine/summon.mjs:250-271`).

Tokens are deployed into home bases, Servant then Master, picked from the base's free panels (`module/engine/war-setup.mjs:393-454`).

### Summon variants

A summon-time coin flip may change a Servant's shape. `resolveSummonVariant` takes the `system.summonVariant` spec and the `1d2` result (1 = heads = `heads` branch, 2 = tails = `tails` branch) and returns the branch id and its `overrides`—a system-shaped patch applied at commit (`module/rules/summon-variant.mjs:42-47`). Semiramis's Range, normal-attack component and Sustainability depend on which branch she rolled (`module/rules/summon-variant.mjs:8-14`). The branch does not attach or detach Items; conditions on Items are gated by `self:variant:<id>` instead (`module/rules/summon-variant.mjs:31-36`).

### Conjured summons

`summonPhase` runs the `summon` phase. If `spec.contentIds` is set, all are summoned in order (Raikou's clones); otherwise, `countRoll` decides how many, and `typeRoll` per summoned unit decides what, with optional "your choice" entries (`module/engine/summoning.mjs:35-80`). Placement picks free panels from a named area around the conjurer.

`expiredSummonIds` detects which conjured summons have outstayed their welcome: those with `kind: "summon"` and `expiresAt <= tick` (`module/rules/summons.mjs:40-46`). The expiry is an absolute tick, not a countdown, so it survives the unit's creation and never fails to fire (`module/rules/summons.mjs:20-22`).

### Contracts at setup

`setContract` pairs a Master with a Servant during setup, and the engine layer ensures `Servant.masterId` and `Master.servantIds` stay reciprocal (`module/engine/war-setup.mjs:373-377`).

Mid-game, `attemptContract` rolls what the plan asks for. Allied contracts to already-contracted Servants are automatic; enemy contracts depend on Independent Action rank. One failure decides the attempt, but all rolls are kept for the log (`module/engine/contract.mjs:53-74`). `conquestIntents` applies the automatic contract when a Master dies, freeing its Servants **and** contracting them to the killer in one batch so no intermediate Free state is observable (`module/engine/contract.mjs:88-105`, `module/rules/contract.mjs:179-196`).

## Invariants & edge cases

1. **Factions must be symmetric.** If red allies blue, blue must ally red. `normalizeFactions` enforces this (`module/rules/factions.mjs:84-89`).

2. **A faction's id never changes.** The name is free to change; the id is what every actor stores and must remain stable (`module/rules/factions.mjs:124-149`).

3. **Nothing is written until commit.** `prepareSummon` and `reviseSummon` leave the world untouched; `commitSummon` is the write point (`module/engine/summon.mjs:104`, `module/engine/summon.mjs:170`).

4. **Setup rolls lock at match start.** `summonedAt` records the global turn when the Servant was rolled, preventing changes to the plan afterwards (`module/engine/summon.mjs:231`, `module/rules/setup-rolls.mjs:1-20`).

5. **A summon variant's `overrides` are applied at commit, not rolled.** The coin flip decides the branch; the branch's fields are written as-is (`module/rules/summon-variant.mjs:42-47`).

6. **Conquest contracts are atomic.** Freeing and contracting are one descriptor list so no intermediate Free state exists (`module/rules/contract.mjs:188-191`).

7. **The war's Region is a world setting, not a match property.** The summon dialog asks for it; `setWarRegion` writes it so it survives the war and fuels Region-based grants live (`module/engine/summon.mjs:287-295`).

## Traps and anti-patterns

**Masters' ZON was baked into Base Attack at setup.** A Normal Master's ZON is looked up by container class, and it was once added to the Master's Base Attack during `createMasterFor`, leaving an Advanced Master's 2 to flow through derivation. Every Servant's class-based ZON radius is then derived from Base Attack, so a Servant paired with a Normal Master started with raised ZON and every attack within it at +5d10. When a war switched rulesets mid-setup, Normal Masters already created carried an inflated Base Attack that did not survive a Servant re-summon (ruled out by the commit guard at `module/engine/summon.mjs:180-189`), and Servants re-rolled against the war's new ruleset ended up with mismatched ZON. **Write ZON on the Master, not Base Attack** (`module/engine/war-setup.mjs:257-259`) — it is a Master's own property and should not flow through to a Servant's derivation.

**The Servant's Region grant was baked into setup rolls.** `grantedSteps` on the sheet reported "Master granted +1" even when the Region granted it instead. The Region's effect on RANKS is recomputed live by `baseAttackFor`, so baking it in meant every rank moved twice — once at commit and once live. A Servant on a board without a recorded Region received the rolled value at commit and zero live, then the sheet's explainer blamed a Master who never granted it. **Partition the grants: write only the Master's steps to `grantedSteps`, and recompute the Region's effect live** (`module/engine/summon.mjs:605-612`).

## Open questions

- **Confirmed: the alliance graph is computed and never shown.** `alliancesOf` has exactly two
  consumers, both internal -- the board projection (`module/engine/board.mjs:312`) and the
  concealment rules (`module/rules/concealment.mjs:87`). **No file under `module/apps/` reads it**, so
  no sheet, HUD, tooltip or tracker surfaces it. Alliances therefore decide targeting relations that a
  player can observe only by their effects. Whether that is a UX gap or a deliberate fog is a design
  question, but it is not an accident of wiring: nothing was ever built to display it.

- **Why is the Region a world setting rather than a match property?** Every war has exactly one Region, and `board.warRegion` reads it. Moving it to `Combat.system.region` would colocate it with `warType`, `ruleset`, and `difficulty` — but the Region's effect on ranks must be computed live, and a setting survives a match, which a property does not.

- **Answered: it is not atomic, and it cannot be with this ordering.** `memberIds` is cross-linked
  after every partner exists, because that is *"the only moment every actor's id exists"* --
  content names partners by **content** id and this is where they resolve to **actor** ids
  (`module/engine/summon.mjs:242-265`). A failure between the creations and the cross-link would
  therefore leave real actors holding empty `memberIds`, which reads as a group whose members do not
  know each other. The recursion guard is sound (`withPartners: false` on the inner call, or twins
  would summon each other for ever), but there is no transaction around the two phases and Foundry
  offers none. Recovering would mean re-running the cross-link, not re-summoning.

- **When does `summonedAt` matter?** Setup rolls lock at match start; a Servant created before the match starts (setup) and one created after (conquest summon) both carry `summonedAt`. The rule does not state what this timestamp guards against.
