# 36 — Canvas Layers: Targeting, Overlays and Tokens

## What it is

The targeting layer "draws, and never decides" (`module/apps/canvas/targeting-layer.mjs:2`). Every panel it fills and every token it outlines come from `legalPlacements`, which is pure and lives in Layer 2 (`module/apps/canvas/targeting-layer.mjs:5-8`). Nothing in the layer knows what a Range is, what an anchor is, or why a placement is illegal — it asks the rules and paints the answer.

The **targeting flow** is a loop that separates aiming from resolution: a player places an area on the board, sees who that area caught (with exclusions and warnings listed), and chooses whether to commit that placement or re-aim. The area itself is a real grid-shape Region while the player is deciding, then discarded once they commit or cancel. The resolution is produced once by `validate`, and the same resolution is shown in the preview HUD, read to populate `game.user.targets` for the rest of the world, and handed to the attack flow — the preview and the reality are guaranteed to match because they read from the same function (`module/apps/canvas/targeting-layer.mjs:236-253`).

The **overlay layer** is always-on, rendering persistent board context. It draws ZON rings (green when in zone, red when outside), threat ranges, Master protection radii, platform footprints with level badges, the Grail's position and contest state, and Decoy arrows (`module/apps/canvas/overlay-layer.mjs:5-9`, `module/apps/canvas/overlay-layer.mjs:117-134`). Like the targeting layer, it reads from pure rules and draws without deciding.

**Tokens** on the canvas carry three pieces of behaviour: level-aware clicking (only the level being viewed is interactive), visibility gated by concealment, and a chevron facing marker that tracks `system.facing` (`module/apps/canvas/token.mjs:1-26`). Token rotation is locked so artwork cannot be spun independently from the facing field (`module/engine/token-rotation.mjs:9-16`), and platform footprints are kept in sync with their token size (`module/engine/token-footprint.mjs:2-27`).

## Where it lives

| File | Role |
|---|---|
| `module/apps/canvas/targeting-layer.mjs` | The targeting layer: five interaction modes, drawing legal/illegal placements |
| `module/apps/canvas/targeting-hud.mjs` | Targeting preview panel — damage range, targets, excluded units, warnings and errors |
| `module/apps/canvas/target-region.mjs` | Creating, discarding, and sweeping transient targeting regions |
| `module/apps/canvas/target-review.mjs` | Confirmation dialog: deselect caught units, re-aim, or cancel |
| `module/apps/canvas/overlay-layer.mjs` | Persistent overlays: ZON rings, threat ranges, Master protection, platform footprints, Grail, Decoy arrows |
| `module/apps/canvas/token.mjs` | Token placeable: level-aware clicking, visibility by concealment, facing chevron |
| `module/engine/token-rotation.mjs` | Locking artwork rotation on new and existing tokens |
| `module/engine/token-sync.mjs` | Finding live token documents across all scenes |
| `module/engine/token-footprint.mjs` | Synchronising platform token size with declared footprint |
| `module/rules/targeting/resolve.mjs` | The resolver that produces `legalPlacements` and `validate` |

## How it works

### Five targeting modes

The targeting session dispatches to one of five interactions based on the `anchor` type (`module/apps/canvas/targeting-layer.mjs:209-305`):

**Mode A — direction picker** (`module/apps/canvas/targeting-layer.mjs:307-352`). Four ghosts drawn at once, one for each cardinal direction, tinted green (legal) or red (illegal). Hover brings one forward, arrow keys cycle, Enter or click confirms. Used when the anchor is `selfEdgeAdjacent` — a unit places an effect at an edge-adjacent panel in one of four directions, and showing all four simultaneously means the player never has to guess or redo (`module/apps/canvas/targeting-layer.mjs:21-24`).

**Mode B — free placement** (`module/apps/canvas/targeting-layer.mjs:354-411`). The target area moves with the pointer inside a dimmed range overlay that shows where legal placements are reachable. Hover a panel to see if it is legal, Enter to confirm. Used when the anchor is `withinRange`. A legal-but-catastrophic placement (a Grail in the area) requires a second click to confirm (`module/apps/canvas/targeting-layer.mjs:394-407`).

**Mode C — unit picker** (`module/apps/canvas/targeting-layer.mjs:413-461`). Every unit in `options` is dimly highlighted on the board, the legal ones cycle with Tab, and clicking or Enter selects. Used when the anchor is `targetUnit`.

**Mode D — auto-resolve** (`module/apps/canvas/targeting-layer.mjs:300-304`). No user interaction. Used for anchors that resolve to exactly one placement (e.g. `self`).

**Mode E — freeform paint** (`module/apps/canvas/targeting-layer.mjs:64-193`). The player drags to paint panels into the footprint or shift-drags to erase. Legal panels render in the legal tint; panels outside the leash render in red and refuse paint. Legality is drawn, not enforced afterwards, so nothing can be composed that will be rejected at commit (`module/apps/canvas/targeting-layer.mjs:71-74`). Enter confirms, Escape or right-click cancels.

### The targeting preview

The HUD element opens once a targeting session starts and follows the pointer (`module/apps/canvas/targeting-hud.mjs:17-31`). It renders only for modes A, B and C — mode D has nothing to show and mode E shows only the panel count (`module/apps/canvas/targeting-hud.mjs:45-59`). The preview shows:

- **Target list:** every unit the resolution caught, with damage range if a damage callback was passed, and band number if the shape is banded (`module/apps/canvas/targeting-hud.mjs:78-79`).
- **Excluded units:** every unit standing in the area but dropped by the rules, with the reason (`module/apps/canvas/targeting-hud.mjs:85`).
- **Warnings:** legality warnings that do not prevent the placement (e.g. a Grail in the area) (`module/apps/canvas/targeting-hud.mjs:89-90`).
- **Refusals:** legality errors presented with their numbers and their kind — a refusal that a Command Spell can lift carries the offer inline (`module/apps/canvas/targeting-hud.mjs:95-103`).

### Confirmation and review

Once a placement is ready, the HUD closes and a Region is placed on the scene as a grid-shape document, so the player sees exactly what area the attack will cover (`module/apps/canvas/targeting-layer.mjs:241-245`). The region is created as `transientTarget`-flagged and swept at `ready` if any survive a disconnect (`module/apps/canvas/target-region.mjs:51-77`, `module/apps/canvas/target-region.mjs:109-120`).

If the targeting review setting is enabled, a dialog opens showing the target list and excluded units. The player can uncheck targets to deselect them, click **Confirm** to proceed, click **Re-aim** to discard the region and start over, or cancel (`module/apps/canvas/target-review.mjs:40-123`). The confirmed target list is mirrored into `game.user.targets` so modules, macros and the token health bar all agree on who was hit (`module/apps/canvas/targeting-layer.mjs:251-253`).

### Overlays and board context

The overlay layer redraws when a token is selected, hovered, or when an `fgt.invalidate` is dispatched (`module/apps/canvas/overlay-layer.mjs:86-134`). Every visual in this layer reads from pure rules and geometry:

- **ZON rings** (`module/apps/canvas/overlay-layer.mjs:224-242`): drawn around the Master of a selected or hovered Servant. Green when the Servant is in zone, red when outside. One ring per Servant when a Master is selected because each class has its own zone radius.
- **Threat ranges** (`module/apps/canvas/overlay-layer.mjs:280-290`): drawn around a hovered unit's panel, showing every panel it can reach with an attack (`module/apps/canvas/overlay-layer.mjs:289`).
- **Master protection** (`module/apps/canvas/overlay-layer.mjs:307-313`): drawn around a selected or hovered Master, showing the radius in which their Servants gain protection.
- **Platform footprints** (`module/apps/canvas/overlay-layer.mjs:147-161`): drawn with a level badge, always visible. Two platforms at different levels overlap on screen but do not interact.
- **Grail** (`module/apps/canvas/overlay-layer.mjs:173-180`): drawn when materialized, red if contested, gold if uncontested.
- **Decoy arrows** (`module/apps/canvas/overlay-layer.mjs:192-207`): drawn from a Decoy'd unit toward its source, making an otherwise invisible constraint visible.

### Token behaviours

**Level-aware clicking** (`module/apps/canvas/token.mjs:63-86`). A platform is a 9×9 token, and its hit area covers eighty other panels. The rule is: you interact with the floor you are looking at. Only tokens on the currently viewed level accept clicks; tokens on other levels are visually distinguished but not interactive (`module/apps/canvas/token.mjs:6-26`).

**Visibility by concealment** (`module/apps/canvas/token.mjs:113-128`). A unit with Presence Concealment is invisible to its enemies on the canvas. The visibility decision is made once per token per frame in the getter `isVisible`, reading the unit's faction and held effects (`module/apps/canvas/token.mjs:113-128`).

**Facing chevron** (`module/apps/canvas/token.mjs:134-219`). Every unit carries `system.facing` — one of eight compass points. A chevron is drawn on the token at the facing direction, updated whenever the actor changes or the token is redrawn. The facing field is read when an attack lands to decide whether it came from behind (`module/apps/canvas/token.mjs:135-141`).

**Rotation locked** (`module/engine/token-rotation.mjs:1-72`). Foundry's token rotation is disabled (`lockRotation: true`) for every token. The artwork cannot be spun independently from `system.facing`, which is what would make the facing field unreliable. This is enforced in three places: at compendium compile time, on `preCreateToken`, and at `ready` in a GM-side sweep (`module/engine/token-rotation.mjs:18-43`).

**Footprint synced** (`module/engine/token-footprint.mjs:32-175`). A platform's `system.footprint` (e.g. 9×9 for the Hanging Gardens) is kept in sync with the token's size in Foundry. Changing the footprint on a prototype or placed actor updates every copy's token size across all scenes. This is enforced at compendium compile time, on `preCreateToken`, and on every `updateActor` (`module/engine/token-footprint.mjs:32-72`).

## Invariants & edge cases

1. **The targeting layer decides nothing.** All decisions are made in `module/rules/targeting/resolve.mjs`, and the layer consults them synchronously via `legalPlacements` and `validate` (`module/apps/canvas/targeting-layer.mjs:27`, `module/apps/canvas/targeting-layer.mjs:213`, `module/apps/canvas/targeting-layer.mjs:236-237`).

2. **The preview and resolution are guaranteed to match.** Both read from the same `validate` call, so a unit shown in the preview and a unit that lands in the attack are the same set (`module/apps/canvas/targeting-layer.mjs:236-237`, `module/apps/canvas/targeting-layer.mjs:251-253`).

3. **Transient regions are always swept.** A region tagged `transientTarget` is discarded in a `finally` block, and any that survive a client disconnect are cleaned up by the GM at `ready` (`module/apps/canvas/target-region.mjs:51-120`).

4. **Only the viewed level is interactive.** Multi-level scenes have platforms that overlap on screen but are on different levels. Only tokens on `canvas.level.id` accept clicks (`module/apps/canvas/token.mjs:80-86`).

5. **Artwork rotation is not a choice.** Every token has `lockRotation: true` enforced, so the only way to change facing is through the dropdown in the token HUD or an actor update (`module/engine/token-rotation.mjs:36-39`).

6. **Platform tokens are always the size they declare.** A platform's token size is synced with `system.footprint` in three places, so the two never disagree. Changing the footprint on the sheet immediately resizes the token and all its copies (`module/engine/token-footprint.mjs:32-175`).

7. **Concealment is invisible to render until checked.** Presence Concealment is not a status or an effect badge; it is a getter checked on every visibility test. An enemy seeing a concealed unit sees it off-level or out of vision, never marked as concealed (`module/apps/canvas/token.mjs:113-128`).

## Traps and anti-patterns

**Overriding `_isVisible()` instead of `isVisible`.** Foundry v14 has no `_isVisible()` method — `isVisible` is a getter on `Token.prototype` and the ray-casting lives behind it in `CanvasVisibility#testVisibility`. Overriding the method that older versions had installs something nothing ever calls, which is a fix that tests green and does nothing on the board (`module/apps/canvas/token.mjs:104-108`). **Override the getter, not the method.**

**Leaving a text label in the layer's children after `clear()`.** PIXI's `Graphics#clear()` does not remove text children, so a label persists and the next refresh tries to render it again. A layer teardown did not clear the array, so every refresh threw "Cannot read properties of null (reading 'off')" and the layer stopped drawing permanently (`module/apps/canvas/overlay-layer.mjs:89-111`). **Drop and re-create text labels on each refresh, and clear the array in `_tearDown`.**

**Using `updateSource` on an existing token.**  A token exists only after creation completes. For tokens still in flight (`preCreateToken`), `updateSource` changes it before it is sent; for placed tokens, `update` is the only way. Calling `updateSource` on a placed document is an error that silently does nothing (`module/engine/token-footprint.mjs:130-136`). **Use `updateSource` only in `preCreateToken`; use `update` everywhere else.**

**Forgetting the `fgtForced` flag on MOVEMENT_FIELDS writes.** Foundry v14 counts `width`, `height`, `x`, `y`, `elevation` and `level` among `MOVEMENT_FIELDS`, so a write to any of them is routed through the movement pipeline. The movement hook refuses anything that is not an orthogonal step — a resize fails silently (no throw, no rejection, the token never changes size) without `fgtForced` to exempt it (`module/engine/token-footprint.mjs:160-172`). **Always pass `{fgtForced: true}` when resizing a token.**

**Animate a MOVEMENT_FIELDS write at your peril.** An animated movement holds the document at the size it started from until the tween ends. Growing a token looks fine and shrinking does not — Infantile Regression put a Servant's footprint back to 1×1 and left a 3×3 token standing on the board (`module/engine/token-footprint.mjs:168-170`). **Pass `{animate: false}` on any MOVEMENT_FIELDS write.**

**Reading `game.user.targets` for rules decisions.** Foundry's target set is write-only: the system populates it after an attack resolves so modules and macros agree on who was hit, but it is neither complete (a filtered selection) nor authoritative (a rules engine consulting it would be consulting player choice). **Read from the resolution, not from `game.user.targets`.**

**Driving the overlay layer with a hook instead of a session.** Overlays are selection context that changes whenever a token is selected, hovered or invalidated. The layer supplies `hover(token)` and `refresh()` for these callers to drive it with; reaching directly for the layer's state would create a second locus of truth (`module/apps/canvas/overlay-layer.mjs:74-87`). **Call `hover` and `refresh` from your hook; never mutate the layer's fields.**

## Open questions

- **No leftovers in the live world, which is evidence rather than proof.** The active scene carries
  exactly two Regions, both `homeBase`; nothing matching a targeting area survives on it. That is
  consistent with the `finally` discard and the `ready` sweep doing their job across this world's
  history. It does not exercise the case the chapter actually worries about -- a client disconnecting
  mid-decision -- which needs a second client to drop at the right moment.

- **Still open; it is a visual-composition question.** Selection draws ZON and protection, hover
  draws threat and protection for an unselected unit, and Decoy arrows draw only for selection -- so
  the overlapping cases (hovering the selected unit; hovering one unit while another is selected) are
  decided by draw order and predicate overlap rather than by an explicit rule. Reading the layer shows
  what each branch draws; it cannot show what the composite looks like. This one genuinely needs eyes
  on the canvas.

- **Why `zonStatus(unit, board)` is called on a hovered unit every refresh.** The overlay layer redraws wholesale when anything changes, which is cheap on a small board but scales poorly. Worth a measurement on a complex battlefield with many overlays.
