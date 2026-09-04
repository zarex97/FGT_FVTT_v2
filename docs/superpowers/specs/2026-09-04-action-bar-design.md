# The Action Bar — replacing the token HUD

**Date:** 2026-09-04
**Status:** design, approved in chat, not yet implemented
**Chapters affected:** 29 (§29.4, §29.5), 18 (§18.9), 43 (§43.4), 32

---

## 1. The problem

The F/GT token HUD appends **one vertical column** to Foundry's own, and packs into it: a budget
pip, Attack, Move, a facing dial, up to six ability buttons, one toggle per mode, two buttons per
open bounded field, and an effect pip cluster. Foundry's HUD column is sized for roughly four
35px controls stacked beside a token.

Medusa produces twelve. The column overflows.

This is structural rather than cosmetic. The content has **no upper bound** and the container has
a fixed height, so no amount of styling fixes it: a Servant with three open fields and two modes
will always exceed whatever height is chosen. Every control is also the same anonymous glyph, so
the only way to learn what a slot does, whether it is on cooldown, or why it is refusing, is to
hover it one at a time.

## 2. What is already built and cannot be reached

Auditing the action economy for this design found that `rules/budget.mjs` defines eight
`ActionKind`s and **three of them have no caller anywhere in the repository**:

| Action | Engine entry point | Reachable today |
|---|---|---|
| `move` | `enterMovement` | yes, token HUD |
| `attack` | `declare` | yes, token HUD |
| `skill` / `np` / `spell` | ability buttons | yes, quick bar |
| **`mark`** | `engine/marks.mjs#placeMark` | **no** |
| **`gather`** | `engine/gather.mjs#gather` | **no** |
| **`ridingAttack`** | `engine/riding.mjs#performRidingAttack` | **no** |

Each of the three is complete: budget checks, turn bookkeeping, intents, chat output. `placeMark`
even detects the completed Bloodmark square and opens the field. `riding.mjs`'s own header records
that `GRANTS.ridingAttack` "has been declared since grants were written and **no engine ever read
it**" — the engine now exists and nothing offers it.

The consequence in play: **Blood Fort Andromeda cannot be built**, Semiramis's Construction cannot
be fed by Gather, and no Servant can perform a Riding Attack. Three finished subsystems are
unreachable for want of a button.

This is the same authored-and-inert shape the project keeps finding, one layer higher up. Chapter
45 records the rule-element version repeatedly; this is the action version.

## 3. Decisions

| # | Decision |
|---|---|
| DA.1 | The F/GT HUD becomes a persistent bar anchored bottom-centre for the controlled token. The token HUD keeps Foundry's own controls only. |
| DA.2 | Unit actions are declared in a **pure registry** at layer 2, not hardcoded in the view. Availability is a predicate over a unit snapshot and the board. |
| DA.3 | A drift test holds the registry against `budget.mjs`'s `ActionKind` union in both directions. A kind with no entry and no explicit exemption fails the build. |
| DA.4 | Rows are filled automatically from what the unit has, so nothing can be hidden. A per-user pinned row sits in front of them as a shortcut. |
| DA.5 | Pins are a **user flag**, not actor data. No socket path, and one player cannot rearrange another's bar. |
| DA.6 | Slot appearance is computed by a pure view-model function, so every state is unit-testable without Foundry. |
| DA.7 | A refusal is never a silent no-op. The reason rides in the tooltip and is raised as a notification on click. |
| DA.8 | The turn panel becomes the bar's right-hand segment. It stays **faction-scoped**; adjacency is not merging. |

## 4. Architecture

Four new modules, respecting `domain → rules → engine → apps` (`eslint.config.mjs`'s `ALLOWED`).

### `module/rules/actions.mjs` — layer 2, pure

The registry. One entry per unit action:

```js
{
  id: "mark",
  kind: "mark",                    // the ActionKind it bills
  icon: "fa-solid fa-droplet",
  label: "FGT.Action.Mark",
  mode: "immediate",               // "immediate" | "targeted" | "dial"
  available(unit, board) { … },    // pure predicate over the snapshot
}
```

Pure and Foundry-free, so the whole availability table is testable against literals. May import
`rules/granted.mjs` and `domain/`, which the layer rules permit.

`availableActions(unit, board)` returns the entries whose predicate holds, in registry order.

### `module/engine/actions.mjs` — layer 3

The dispatcher: action id → the existing engine function, plus the argument each one needs.
Nothing else. It exists so the view never imports `marks.mjs`, `gather.mjs` and `riding.mjs`
directly, and so adding an action touches a table rather than a component.

### `module/apps/hud/present.mjs` — layer 4, pure

Turns a unit snapshot into the bar's view-model: the rows, and for each slot its cost, cooldown
remaining, ring state, disabled flag and refusal reason. Mirrors `apps/actor-sheet/present.mjs`,
which is already the project's pattern for testable presentation.

### `module/apps/hud/action-bar.mjs` — layer 4

An `ApplicationV2` + `HandlebarsApplicationMixin`, the same base `TurnHUD` uses. Renders
`templates/hud/action-bar.hbs` from the view-model and dispatches clicks. Deliberately thin: it
should contain no rule knowledge at all.

## 5. The action registry

| id | Kind | Available when | Mode | Engine call |
|---|---|---|---|---|
| `attack` | `attack` | always, for a unit that may attack | targeted | `declare(actor, null)` |
| `move` | `move` | always | targeted | `enterMovement(token)` |
| `mark` | `mark` | the unit owns an NP whose `field.geometry.kind` is `markDefined`, and that field is not already open | immediate | `placeMark({unitId, abilityId})` |
| `gather` | `gather` | the board holds a non-enemy unit with a `hgobConstruction` resource | immediate | `gather({actorId})` |
| `ridingAttack` | `ridingAttack` | `hasGranted(unit, GRANTS.ridingAttack)` | targeted | `performRidingAttack({unitId, destination})` |
| `facing` | none | always | dial | `actor.update({"system.facing": …})` |

Two properties of this table are load-bearing.

**Gather's predicate is board-dependent, not unit-intrinsic.** *"Semiramis or any allied Unit can
perform 'Gather'"* — so the button appears on an ally's bar because of who else is on the board,
which is why `available` takes the board and not just the unit.

**Riding Attack and Move are `targeted`.** Both need a destination picked on the canvas, so the
click enters a canvas mode rather than resolving immediately. `ridingAttackPath` already decides
which lines are legal, so the mode highlights exactly the set it accepts.

`skill`, `np` and `spell` are the **exemptions** in the drift test: those are billed by ability
buttons in their own rows, not by an Actions entry.

## 6. Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              board / canvas                              │
├──────────────────────────────────────────────────────────────────────────┤
│ ┌────────┐  PINNED   [ ][ ][ ]                          │  RED FACTION   │
│ │        │  ACTIONS  [⚔][👣][✚ mark][🧭]                │  Round 3 · 2◈  │
│ │  art   │  SKILLS   [ ][ ][ ][ ][ ][ ]                 │                │
│ │        │  NP       [ ][ ]                             │  ⚠ Charmed:    │
│ └────────┘  MODES    [ ]      FIELDS [ ]                │    must attack │
│ Medusa                                                   │    Heracles    │
│ RIDER      EFFECTS  [▪ 2◈][▪ 1◈]                        │  ┌───────────┐ │
│ HP ████ 850/850   AGI 20   LUC 5   ◈ ●●○                │  │ End Turn  │ │
└──────────────────────────────────────────────────────────┴────────────────┘
   portrait block            rows (wrap)                    turn segment
```

Rows render only when the unit has that kind, so a Master shows three rows and Medusa shows
seven. Rows wrap rather than overflow, which is the whole point of the change.

**The portrait block honours concealment.** It shows `system.defaultImage` and the public name
from `rules/identity.mjs#publicNameOf` while `identityRevealed` is unset, for the same reason the
sheet and the token already do. The bar must not leak a true name to a player who selected an
opponent's token.

## 7. Slot states

Computed by `present.mjs`, rendered by the template, never decided in the view.

| State | Appearance |
|---|---|
| ready | full colour, cost badge top-left |
| cooling | darkening sweep over the icon, remaining ticks centred |
| mode on | coloured ring, `ON` marker |
| NP built | coloured ring, distinct from mode |
| unusable | dimmed, dashed border, reason in the tooltip |

Cost comes from `rules/costs.mjs`, cooldown from `system.cooldown.remaining`, usability from
`canUseAbility` — all three already exist and are already what the sheet's ability cards read.

## 8. Pinning

Right-click a slot to pin or unpin. Stored as `game.user.setFlag("fgt", "pins", {[actorId]: [id]})`.
Per-user by DA.5. The pinned row is a shortcut into the auto rows, never a replacement, so an
unpinned ability is still one row further down and can never become unreachable.

## 9. The turn segment

`turn-hud.mjs`'s three sections move into the bar's right-hand end: acting faction and clock,
compulsion warnings, and the End Turn gate. The panel stops being a separate floating window.

It keeps reading **faction** state while the rest of the bar reads the **selected unit**. These
are two scopes sitting side by side, exactly as BG3 places end-turn beside the hotbar. Merging
their data sources would be wrong: the End Turn gate is about the faction's whole budget, not
about whichever token happens to be selected.

The compulsion warnings stay the loudest element. That section is the reason the panel exists:
compulsions are turn-scoped, so a player can only discover a violation after committing to it,
and showing them from the moment they apply is what makes the rule legible.

## 10. Data flow

One `unitSnapshot` per render, threaded through every row builder, the same discipline
`actor-sheet/context.mjs` uses and for the same reason. Re-render on:

- `controlToken` — the selection changed, so the whole bar changes
- `updateActor` — facing, turn state, resources
- `updateItem` — cooldowns (`system.cooldown.remaining`) and mode state
- `createActiveEffect` / `deleteActiveEffect` — the effects row
- `updateCombat` — the clock, the acting faction, the turn gate
- `fgtBudgetChanged` — the budget pips and every cost badge, already emitted by `engine/budget.mjs`,
  and already what `turn-hud.mjs` listens to, so the turn segment keeps its current refresh path

`fgt.modeToggled` exists but is **not** the general mode signal: only `engine/concealment.mjs`
raises it. An ordinary toggle writes `system.active` and surfaces as `updateItem`, which is the
listener the mode rings must actually use.

**One signal does not exist and must be added.** Nothing announces a bounded field opening or
closing, so the Fields row has no trigger. Bounded fields are Region documents, so the cheapest
correct option is Foundry's own `createRegion` / `deleteRegion` hooks filtered to F/GT regions.
The alternative is a `fgtFieldChanged` hook raised by `engine/fields.mjs` beside the existing
`fgtOfferReshape`, which is more explicit and matches how the rest of the engine signals. Pick the
second: `fields.mjs` already raises one hook, and a Region-document listener would fire for
terrain and home bases too.

The full inventory of hooks this system already raises is in `engine/`; the six named above were
verified to exist before this spec was written, and the seventh was verified not to.

## 11. Error handling

Every dispatched action returns `{ok, reason}`. On a refusal the bar raises
`ui.notifications.warn` with the localized reason and leaves the slot dimmed with the same text in
its tooltip. Reason strings get `FGT.Action.Refusal.<reason>` keys, matching the existing
`FGT.Contract.Refusal.*` convention.

The rule this enforces is the project's own: a dead control is how a player concludes the system
is broken. `modes.mjs` already states it for `cannotDeactivate`, and this generalises it.

## 12. What is removed

- `module/apps/hud/token-hud.mjs` — deleted. Every control moves, the facing dial included.
- `module/apps/hud/turn-hud.mjs` — folded into the bar; `templates/hud/turn.hbs` becomes a part of `action-bar.hbs`.
- The `QUICK_BAR = 6` cap disappears. Rows wrap, so there is nothing to truncate.

## 13. Testing

**Unit (vitest, no Foundry):**

- `availableActions` for each registry entry, positive and negative, including Gather's
  board-dependence and Riding Attack's grant gate.
- The row builder: which rows appear for a Servant, a Master, a Summon, a Structure.
- Slot states: ready, cooling, mode on, NP built, unusable-with-reason.
- Concealment: an unrevealed Servant's portrait block yields the class image and public name.
- **The drift test (DA.3):** every `ActionKind` in `budget.mjs` has a registry entry or sits in
  an explicit exemption list, and every registry entry names a real kind.

**Live, in `fgt2026`:**

- Place four Bloodmarks with Medusa and watch Blood Fort Andromeda open. This has never been
  possible and is the acceptance test for the whole design.
- Gather with an ally of Semiramis and watch Construction rise by 3.
- Riding Attack through a line of enemies with Riding's Active up.
- A Servant with two modes, an open field and ten abilities: confirm nothing overflows.

## 14. Documentation

- **Ch. 29** — §29.5 rewritten around the bar; §29.4 folded into it; §29.12 gains DA.1–DA.8.
- **Ch. 18** — §18.9 notes that three action kinds were unreachable and now are not.
- **Ch. 43** — §43.4 notes that the Mark action has a control, so `markDefined` fields are
  playable.
- **Ch. 32** — Gather has a control.
- **Ch. 45** — the finding, and the three engines it made reachable.
- **CHANGELOG** — under `Corrected`, since three actions being unreachable is a defect, not a
  feature gap.

## 15. Risks and non-goals

**Risk: everything moves at once.** The token HUD is deleted in the same change that adds three
new actions. If that is too much in one step, the fallback is to ship the bar carrying today's
controls first and add the registry second, at the cost of a second pass over the docs.

**Risk: `performRidingAttack` has never run in a real world.** It is unit-tested and has never
been invoked from a UI. Expect the live pass to find something, the way `placeMark`'s
token-document panel bug was found.

**Non-goals.** Drag-and-drop slot arrangement, container popovers, and multi-page hotbars are all
BG3 features this design deliberately drops: a Servant has around ten abilities and they are
already typed, so the auto rows carry the whole roster without them. Bar layout is not
customisable beyond pinning.
