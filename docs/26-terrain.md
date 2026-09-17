# 26 — Terrain

## What it is

Terrain is a property of panels, not units. A unit does not carry a "Forest" status; it is *in* a Forest, and the terrain applies while it stands there. That is what makes terrain undispellable, uncurable and unresistable (`module/rules/terrain.mjs:10-16`), and it is why moving out ends the effects instantly with no removal step — there is nothing to remove.

Mechanically, terrain is *a positional aura whose source is a region rather than a unit* (`module/rules/terrain.mjs:14`). Standing modifiers — movement penalties, evasion changes, damage reductions — are the public half, stored as effects data with optional attribute gates (`module/rules/terrain.mjs:27-30`). Periodic and event-driven clauses — Burning's inescapable Burn, the Forest→Burning coin flip, Lava's on-entry damage — are deliberately absent from the standing table because they need the scheduler and movement hooks, not a simple lookup (`module/rules/terrain.mjs:38-40`).

## Where it lives

| File | Role |
|---|---|
| `module/rules/terrain.mjs` | The catalogue (13+ types), standing effects and attribute gates, periodic clauses, on-entry effects, terrain conversions (Fire→Burning) |
| `module/engine/terrain.mjs` | Creating, finding, moving and removing terrain areas via tag; expiring areas; clearing single types |
| `module/data/regions.mjs` | `TerrainBehavior` schema — types, duration, tag, expiry, source and follow tracking |
| `module/engine/movement-hooks.mjs` | Repainting following terrain when its source moves, running field contact rules |
| `module/rules/nameless-forest.mjs` | Nursery Rhyme's death roll and escape check mechanics (pure) |
| `module/engine/nameless-forest.mjs` | Rolling and applying the death roll outcome |

## How it works

### Terrain areas

Terrain is implemented on Foundry `Region` documents, not as a panel property. Each region carries an `fgt.terrain` behaviour: `type` (one or more keys from `TERRAIN`), `duration` (expiry tick, or `null` for permanent), and `tag` (a unique key for finding it again) (`module/data/regions.mjs:26-54`). Hand-drawn map terrain has no tag, which keeps it out of every automatic sweep — only painted areas (created by effects) are keyed (`module/engine/terrain.mjs:19-23`).

`paintTerrain` creates or moves an area: `panels` are converted to Foundry shapes (rectangles at grid positions), `duration` is resolved to an absolute expiry tick, and `followsSource` tracks whether the area should redraw around its source unit each movement (`module/engine/terrain.mjs:106-144`). Repainting an existing tag *moves* it rather than adding a second area — moving every time the source does, without restarting the expiry (`module/engine/terrain.mjs:182-195`).

### Standing effects

`terrainAt` reads the types covering a panel by testing Chebyshev distance 0 against each area (`module/rules/terrain.mjs:193-201`). `terrainEffects` projects a unit's terrain effects, checking `requires` and `unless` attribute gates per effect, summing deltas when areas overlap (`module/rules/terrain.mjs:215-254`). Only standing modifiers live here — the periodic Burn, the on-entry damage, the Meadow reversion are separate (`module/rules/terrain.mjs:33-40`).

### Periodic and event clauses

Clauses fired at turn boundaries — Burning's end-of-turn damage, Poison Swamp's poison application, Eldritch's 50% stun roll — live in `PERIODICS`, keyed by terrain type. Each carries conditions like `unlessEffect` and `requiresEffect`, but no standing modifiers (`module/rules/terrain.mjs:290-320`). `terrainPeriodics` returns descriptors for every unit standing in each relevant type at the given boundary (turn start, turn end, round end); the scheduler converts them to intents (`module/rules/terrain.mjs:352-373`).

On-entry clauses fire when a unit steps onto a panel: Lava's fixed fire damage and burn chance, Frozen's agility check, Magnetic's immobilize roll (`module/rules/terrain.mjs:322-405`). Attribute-based roll overrides work here — Magnetic against a Mechanical unit is not a roll at all (`module/rules/terrain.mjs:391-397`).

### Terrain conversions

When an attack lands, terrain can change. Fire damage converts a Forest's 3×3 (or the attack's whole area if larger) to Burning for 2 turns on a coin flip (`module/rules/terrain.mjs:432-438`). Fire damage against a unit standing on a Meadow causes the panel to revert to normal at the end of the Damage Step — the only place the system modifies map terrain a GM placed (`module/rules/terrain.mjs:443-445`).

### Following terrain

Quetzalcoatl's `Sol` creates daylight in a 5×5 around her, and the light follows her as she moves. `followsSource` tags the area, and `repaintFollowing` redraws it around her new panel after every move (`module/engine/movement-hooks.mjs:175-205`). The original expiry is carried across each repaint so the area does not renew with every step (`module/engine/terrain.mjs:197-200`).

### Movement and removal

An effect that created terrain is removed when the effect expires, dispels, or is cured. The delete hook finds every region tagged with `${defId}:${unitId}` and clears them (`module/engine/terrain.mjs:40-46`). The Meadow clause removes Meadow from specific panels via type, not tag, because it acts on map terrain (`module/engine/terrain.mjs:246-267`).

## Invariants & edge cases

1. **Overlapping areas sum their effects.** Two MOV −1 areas cost two panels because they are two separate pieces of difficult ground, not one status applied twice (`module/rules/terrain.mjs:208`).

2. **Standing modifiers only.** Periodic and event-driven clauses are separate from the standing table; `terrainEffects` stays a pure lookup (`module/rules/terrain.mjs:33-40`).

3. **Hand-drawn terrain is never swept.** A Region with no `tag` is permanent map terrain and is never expired or cleared (`module/engine/terrain.mjs:21-23`, `module/engine/terrain.mjs:211-212`).

4. **Following areas carry original expiry.** Repainting passes `duration: null` because the area's expiry is already set; re-resolving it would restart the clock every time the source takes a step (`module/engine/terrain.mjs:188-190`).

## Traps and anti-patterns

**Reading `board.terrain.areas` when the board never carried one.** The rules read a `terrain.areas` array on the board snapshot, and for years nothing ever populated it (`module/rules/terrain.mjs:196`). The snapshot was created with a `terrain` field and then abandoned. Terrain is now written as Foundry Regions and read directly from the scene; the old array read was quietly correct in its conclusion (terrain was always empty) and never caught the defect — the snapshot never carried anything to read. **Terrain moved from the snapshot to Regions; the old read path was left in place and became dead code.** (Fixed: terrain now reads from Regions via `terrainBehaviors()` and `terrainAt` checks panel membership against region shapes.)

## Open questions

- **Resolved: co-existence is safe by construction.** Neither subsystem ever asks "what behaviour
  does this Region have" -- each selects its own by type. Terrain reads
  `b.type === "terrain"` (`module/engine/terrain.mjs:199`) and fields read `b.type === "npField"`,
  usually narrowed further by `fieldId` (`module/engine/fields.mjs:293`,
  `module/engine/fields.mjs:1461`). A Region carrying both is therefore read twice, independently,
  with neither reader able to see the other's behaviour. The live scene carries only `homeBase`
  Regions, so the combination is untested in practice -- but it cannot conflict by the way the
  lookups are written.

- **Why not a panel property?** Regions support non-contiguous membership, overlaps, and native `tokenEnter`/`tokenExit` hooks out of the box. A panel array would require re-implementing membership and contact callbacks.
