# 24 — Modes, stances, compulsion and control

## What it is

Four mechanisms—modes, stances, compulsion, and control—all share one shape: something other than the owner deciding what a unit does. A **mode** is an ability that is switched rather than used, toggled on and off with rules about *when* it may toggle. A **stance** is a per-action declaration, free but constrained to certain moments. A **compulsion** forces a unit to attack a particular target (or forces a mode on). **Control** is who acts with a unit on the board—Charm transfers control without changing faction or Foundry ownership.

These four are grouped because they all answer the question "who decides what this unit does right now?" They do not share code, but they share intent: they describe constraints and transfers rather than choices.

## Where it lives

| File | Role |
|---|---|
| `module/rules/modes.mjs` | Can a mode toggle? Refuses by cannotDeactivate, toggleLock, compulsion, or ForceMode |
| `module/engine/modes.mjs` | Reconcile forced modes—switch on every mode a compulsion forces |
| `module/rules/stance.mjs` | A stance's current state, constraints, and forced defaults |
| `module/rules/compulsion.mjs` | Compute every unit's forced targets and Decoy pull |
| `module/rules/control.mjs` | Who controls a unit (resolve Charm chains) and who acts on whose Turn |
| `module/engine/faction-ownership.mjs` | Keep Foundry actor ownership in sync with faction assignments |

## How it works

### Modes and their refusals

A mode toggles on and off. `canToggleMode` (`module/rules/modes.mjs:59-146`) checks four refusals in order:

1. **No clock.** If `clockRunning` is false and the mode carries a `toggleLock`, refuse. A lockout needs a tick to measure against (`module/rules/modes.mjs:72-74`).
2. **Suspended.** A Command Spell buys a deactivation span; only switching *on* while suspended bites (`module/rules/modes.mjs:86-89`).
3. **Never.** `cannotDeactivate` on the mode forbids switching off—Heracles cannot deactivate Mad Enhancement (`module/rules/modes.mjs:91-92`).
4. **Held on.** Two sources hold a mode on: `compelledOn` (a compulsion targeting this skill) and `forcedOn` (a `ForceMode` rule whose condition is true) (`module/rules/modes.mjs:97-101`).

The last two are positional: they re-answer every time they are asked, not frozen into the snapshot.

### Forced modes and compulsions

When a compulsion's condition becomes true or a `ForceMode` rule's condition triggers, the modes they name must switch on. `reconcileForcedModes` (`module/engine/modes.mjs:60-107`) watches for these moments and writes the intents. Both sources are checked: `forcedModes` filters the unit's items for ones held by either a compulsion *or* a ForceMode rule (`module/rules/modes.mjs:212-230`).

The write bypasses `canToggleMode`—the sheet says *"immediately activated regardless of Cooldown or any other factors"* (`module/engine/modes.mjs:91-94`). The reverse is absent: when the condition lifts, nothing switches the mode off, freeing the player rather than moving their hand.

### Stances: declarations and constraints

A **stance** is not a mode. It has no duration, cooldown, or toggle lock, and a compulsion cannot force one on. What it has instead is a set of windows—moments at which switching is allowed—and a default it is forced into when it is not the unit's own Turn (`module/rules/stance.mjs:1-28`).

Achilles is the only bearer. `mayChangeStance` (`module/rules/stance.mjs:73-99`) allows changes only at the `declare` window (when Achilles acts) on his own Turn, or at transition windows named in `spec.transitions` (e.g., `combatPhaseStart`). `forcedStanceFor` (`module/rules/stance.mjs:116-121`) returns the stance Achilles must be dragged into outside his Turn—Dismounted always—or `null` if he is already there.

The window constraint is advisory; the sheet prevents Dismounting mid-Combat while Mounted unless that transition is declared.

### Compulsions and decoys

A compulsion forces a unit to attack a particular target. `annotateCompulsions` (`module/rules/compulsion.mjs:30-55`) computes every unit's compulsions every time the board is projected, checking distance and predicate against every other unit. A compulsion is **positional**—it holds while somebody is nearby and lifts the moment they are not.

`compelledTargetsOf` (`module/rules/compulsion.mjs:134-138`) returns the targets a unit *must* attack, narrowing the targeting resolver's legal set. Decoy (`module/rules/compulsion.mjs:104-122`) reverses the direction: a unit with a Decoy suppression pulls enemies toward it, constraining *their* movement (via `rules/movement.mjs`) and read by the overlay layer.

### Control and Charm

Charm transfers control without moving ownership or faction. `controllerOf` (`module/rules/control.mjs:71-82`) resolves a unit's controller, **following the chain**: if A charms B and B charms C, C answers to A's controller, not B's owner. A cycle is guarded; a charm whose source has left the board falls back to the **GM**, not to the victim's owner—a dead charmer's charm must not become a no-op.

`annotateControl` (`module/rules/control.mjs:154-160`) stamps every unit with who controls it and on whose Turn it acts. The same unit appears in the charmer's action budget but leaves its owner's, and its token keeps its original faction colour (`module/rules/control.mjs:99-107`).

### Faction ownership

Foundry's own permission system is not altered by faction assignment or Charm, so the charmer's client cannot write to a charmed unit (`module/rules/control.mjs:14-17`). Instead, all writes route through the GM proxy (Ch. 26).

Foundry **ownership** must be kept in sync with faction assignment for a player to open their own Servant's sheet or drag its token. `syncOne` (`module/engine/faction-ownership.mjs:78-100`) rewrites every non-GM user's entry in the actor's ownership map, revoking previous owners when a faction is reassigned—not a patch that only adds (`module/engine/faction-ownership.mjs:69-72`).

## Invariants & edge cases

1. **A mode with `cannotDeactivate` refuses switching off, not switching on.** `toggleLock` says "wait", `suspended` says "suspended", but `cannotDeactivate` says "never off" (`module/rules/modes.mjs:91-92`).

2. **Compulsions and ForceMode are both positional.** Both are re-answered every time, not frozen in the snapshot. A unit's snapshot carried no `forcedModeRules` field until this was fixed (`module/rules/modes.mjs:248-259`).

3. **A stance's default is enforced at the Turn boundary, not continuously.** Achilles reverts to Dismounted when it becomes an enemy's Turn, but nothing prevents a player toggling him Mounted during an enemy's Turn if they write directly to the sheet (`module/rules/stance.mjs:86-91`).

4. **Charm follows the chain, control falls back to GM, acting faction falls back to own faction.** Three different fallbacks for three different questions; the asymmetry is deliberate (`module/rules/control.mjs:71-135`).

5. **The owner's user id is projected by `annotateControl`, not written back.** The snapshot carries `unit.ownerUserId` because `controllerOf` reads it, and nothing projects it otherwise (`module/rules/control.mjs:147`).

6. **Faction ownership is a full rewrite, not a patch.** Reassigning a faction without revoking the old owner from Foundry leaves two players able to drive the same Servant (`module/engine/faction-ownership.mjs:69-72`).

## Traps and anti-patterns

**Gating a stance on a hand-built subject instead of the snapshot.** A timing window that checks a mode requirement hand-built its filter subject from loose fields—`{ items, effects, turnState, roundState }`—which lacked `stanceSpec`. `stanceOf` returned `null`, so stance-gated abilities (Achilles' Runner Comet, four of his others, Troias Tragōidia) were never offered at their one window. **Use the snapshot, which can answer every requirement question** (`module/engine/attack.mjs:5399` calls `windowSubject` from `module/rules/reactions.mjs:129`, verified live in commit 3ac39bd). Two further call sites kept the hand-built shape until an architecture review found them; see [Ch. 23](23-reactions.md), where the same literal turns out to have disabled the Round-scale exclusions entirely.

**Gating a mode toggle only at the use site, not at the toggle site.** Karna's Uncrowned Arms Mastership carries `oncePerRound`, so the sheet's toggle was rationed—on paper. `rules/costs.mjs` has always read the field, but the gate is on the *ability-use* path and this mode has no phases, so the sheet's toggle never called `useSkill`, never reached the gate, and toggled freely. **Gate mode toggles at the toggle site itself** (`module/rules/modes.mjs:123-132`) and **record every press as a use** (`module/apps/actor-sheet/sheet.mjs:198` calls `recordUse` on toggle, verified live in commit 6c4eaf3).

**Forced deactivation ignoring `cannotDeactivate`.** When Heracles' Master's Health hit its drain floor, his Mad Enhancement could be *forced* off—the health drain clause 1 has that power. But the code path that forced it off never read `cannotDeactivate`, so an ability his sheet says he can never use became pressable. **Refuse forced writes the same way voluntary ones are refused** (`module/engine/io.mjs:435`, comment at 417-434).

## Open questions

- **Must a projection carry `unit.ownerUserId` to support control?** The answer is yes, but it was never explicit. `controllerOf` reads it, and `annotateControl` must project every unit with its owner so Charm chains can be resolved. If an ownership-unaware snapshot tries to call `controllerOf`, the chain stops at the first hop. Worth an ADR on what the snapshot contract includes.

- **Do `compulsions` and `forcedModeRules` need to be separate?** Compulsions are positional checks with per-other-unit relations. ForceMode rules are condition-based and do not vary per target. Both hold modes on; functionally they are different enough that merging them gains nothing, but the conceptual line is worth stating.

- **Confirmed live: a three-link chain resolves to the root, and a cycle does not loop.** With A
  charming B and B charming C, `charmSource` reads `B -> A` and `C -> B`, and `actingFactionOf`
  returns **A's faction for all three** -- so C acts for whoever controls A, exactly as the rule
  says. A deliberate two-cycle (A charms B, B charms A) was also run: each unit falls back to its
  **own** faction rather than recursing, and nothing throws. The guard holds at both depths.

- **Confirmed by reading both sides.** `module/engine/modes.mjs` accumulates a `switched` list and
  reports what it turned on; `module/rules/stance.mjs` contains no `ChatMessage`, no notification and
  no announcement of any kind. So the asymmetry the chapter describes is real and deliberate: a mode
  that switches itself on is reported, and a forced stance is not. The reasoning stands -- an
  unexplained mode toggle reads as a bug, whereas a forced stance is the rule system doing visibly
  what the sheet says.
