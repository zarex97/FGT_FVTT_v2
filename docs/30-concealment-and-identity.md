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

`isConcealed` checks whether a unit carries the effect (`module/rules/concealment.mjs:44-46`). The unit hides from targeting and from certain reactions through separate pure predicates: `hiddenFromViewer` decides whether the token renders (hidden from non-allies, shown to GM, owner, and allies) (`module/rules/concealment.mjs:79-89`); `reactionsRefused` forbids block and counter to a concealed attacker whose AGI Rank is strictly lower than the defender's, and AGI Rank not Agility pool (`module/rules/concealment.mjs:108-117`). An attack that catches a concealed unit in its AoE and fails Evade flips a coin — Heads negates damage and effects but stays silent; Tails deals 50% damage and deactivates concealment (`module/rules/concealment.mjs:180-191`).

An ability can restrict concealed use, but three exceptions hold: Attack Skills, damage-dealing Spells, Noble Phantasms, and explicitly marked ability (`usableWhileConcealed`) always go through. Serenity's Shapeshift is the sole instance in the corpus, paying 20% chance to break concealment (`module/rules/concealment.mjs:209-219`, `module/rules/concealment.mjs:251-253`).

### Ending concealment

Six paths deactivate it: the Combat Process ends (attacked), a Discover roll succeeds (discovered), AoE coin came up Tails (aoe), an ability's own break chance fires (skillUse), the 2◈ expire (expired), or a player toggles it manually (manual) (`module/rules/concealment.mjs:262-269`). Every path invokes `deactivateConcealment`, which removes the effect and queues a reason for the aftermath (`module/engine/concealment.mjs:42-55`). The aftermath runs from the document hook, not the callers, so the cooldown and disclosure reach every path including the one that expires the duration `module/engine/concealment.mjs:83-105`). The skill's cooldown starts from deactivation tick, not its use, and reads from the rank table when not authored (`module/engine/concealment.mjs:232-255`).

### Secret Poison disclosure

When concealment ends, every Poison effect this unit inflicted whose `attributionHidden` flag is set becomes visible, and the running total of unattributed damage is posted to chat (`module/engine/concealment.mjs:151-185`). The damage landed on schedule — the pool never hid, only its cause did. Attribution and tally are revealed together, and the ledger is cleared (`module/engine/concealment.mjs:174-177`).

### Detect and identity

A unit's Detect range reads its class container from `DETECT_BY_CLASS` (Archer 4, Master 1), checks for an explicit sheet value that overrides it, applies stat deltas and Deafen (Deafen costs one to the minimum of 1), and applies bounded field caps (Jack's Mist caps Detect to 1 for enemies inside) (`module/rules/identity.mjs:123-148`). A Caster's range depends on standing in its own Home Base — 5 panels at home, 3 away — the sole position-dependent sight in the game (`module/rules/identity.mjs:157-163`).

Public naming returns the true name when the identity is revealed or the viewer is the owner, otherwise the class container and faction (Berserker of Red) or an explicit override (`concealedIdentity`) (`module/rules/identity.mjs:76-93`). Public image reads `defaultImage` if the Servant is unrevealed and concealed, otherwise `img` (`module/engine/public-identity.mjs:35-39`). Both are drawn from the same source (`publicIdentityOf`) so tokens and chat cards agree (`module/engine/public-identity.mjs:61-68`).

### Discover

When a concealed unit moves, `runDiscoverChecks` rolls for every enemy Servant currently within its Detect range (`module/engine/concealment.mjs:275-316`). Discover is capped: only Servants watch (not Masters), each faction gets three attempts per Turn against one concealed unit, and no Servant attempts twice in one Turn (`module/rules/identity.mjs:272-339`). Attempts are spent in order of arrival — the tick each watcher first held the target in Detect (`module/engine/concealment.mjs:352-361`). The chance draws from the concealed unit's Presence Concealment Rank (EX 0%, A 10%, B 20%, C 40%, D 60%, E 80%, ±5% per step) (`module/rules/identity.mjs:216-229`). Each roll is GM-only and silent unless it succeeds; the text states why — *"if either Player performs the roll, that would mean that they would already know there is a Unit with Active Presence Concealment in the area"* (`module/engine/concealment.mjs:268-270`).

### Vision

Detect range is written to every token's Foundry vision range (`sight.range`, in scene distance units per panel) at three points: token creation, actor edit touching Detect or class container, and unit move (for Caster's position-dependent range) (`module/engine/token-vision.mjs:42-77`). When `identityRevealed` is set or the portrait changes, the public image is synced to every token's texture and the prototype (`module/engine/token-image.mjs:44-104`).

When a unit enters another's Detect range for the first time, `checkSightings` records it in `seenUnitIds` and fires a `unitFirstSeen` event that abilities like Familiar: Doves may handle (`module/engine/vision.mjs:34-72`).

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

**Concealment not triggering visibility updates.** A Presence Concealment effect applied to a token did not prompt Foundry to check whether it should be visible to each viewer, so the Servant stayed on-screen until somebody happened to move. `canvas.perception.update` was not called when the effect was created or deleted. **Trigger a visibility pass on create and delete** by updating `canvas.perception` with `refreshVisibility: true` (`module/engine/token-vision.mjs:68-73`).

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
