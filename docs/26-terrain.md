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

**A painted area may be a label.** Piedra Del Sol's *"(The Piedra Del Sol area is categorized as 'Burning'.)"* is ruled a label: its clause 2 (50 Fire and Burn to enemies at the end of their own Turn) is the area's only damage, and Burning's own toll — a Burn and 25 Fixed Fire on **everyone** inside, its owner and her Master included — does not run there. A `zone` phase says `labelOnly: true`; `zonePaintArgs` hands it to `paintTerrain`, `terrainDataOf` writes it on the behaviour (`TerrainBehavior.labelOnly`, which `repaintFollowing` carries), `terrainAreasOf` projects it onto the area, and `terrainPeriodics` skips an area that carries it (`terrainAreasAt` is the area-aware lookup beside `terrainAt`). What a label keeps is everything that asks what the ground IS: `terrainAt`, `terrainEffects` (Burning's standing effects, the Water defence) and every "is this Burning" reader. Real Burning — Xiuhcoatl's on a Fortress, a Forest turned Burning by Fire, a GM-drawn area — keeps its toll, and where a labelled and a real area overlap the real one's toll runs once (#146).

**An effect a terrain puts on a Unit can last only while it stands there.** Burning's Burn *"does not expire and cannot be removed"* while the Unit is inside. The descriptor says `permanent` and `whileInside`; the intent carries `permanent: true` (no expiry — a bare `expiry: null` is only "not stated", and Burn's own 2◈ would answer it, Ch. 15), `unremovable`, and `sourceTerrain`, the type that put it there, which `io.createEffects` writes on the instance (`EffectData.sourceTerrain`). It ends on leaving, swept like a field-tied effect and for the same reason — on where the bearer stands, never on an exit event: `annotateTerrain` stops the snapshot reading an instance whose `sourceTerrain` the bearer's panel does not hold (`leftTerrainEffects`; a `labelOnly` area holds nothing), `movement-hooks.mjs` deletes the document when the Unit moves off it, and `expireTerrain` / `clearTerrain` delete the documents of everyone whose ground just went (`dropStrandedTerrainEffects`). Poison Swamp's Poison carries no `sourceTerrain`: it ends when it is cured, not when its bearer walks out (#147).

**An area can last as long as a bounded field.** Xiuhcoatl's *"that NP area and the panels directly outside it are now 'Burning' until the Fortress NP is deactivated"* is one area **per** `[Fortress]` NP (a field tagged `fortress`; `antiFortress` is not one) in or directly beside which she stands: `zonePaints` (`module/engine/skill-use.mjs`) paints each Fortress's panels and ring under its own tag and binds it to its field (`TerrainBehavior.boundToFieldId`, written by `terrainDataOf` and carried by `repaintFollowing`). `endField` calls `clearTerrainBoundTo` for the field it closes, so every close path — `deactivateField`, `expireFields`, a forced end — takes that Fortress's Burning away and no other's. Painted as one union under one tag, a second use beside another Fortress moved the one area off the first Fortress while it still stood, a use beside none left the old area where it was, and nothing ended it at all (#152).

On-entry clauses fire when a unit steps onto a panel: Lava's fixed fire damage and burn chance, Frozen's agility check, Magnetic's immobilize roll (`module/rules/terrain.mjs:322-405`). Attribute-based roll overrides work here — Magnetic against a Mechanical unit is not a roll at all (`module/rules/terrain.mjs:391-397`).

### Terrain conversions

When an attack lands, terrain can change. Fire damage converts a Forest's 3×3 (or the attack's whole area if larger) to Burning for 2 turns on a coin flip (`module/rules/terrain.mjs:432-438`). Fire damage against a unit standing on a Meadow causes the panel to revert to normal at the end of the Damage Step — the only place the system modifies map terrain a GM placed (`module/rules/terrain.mjs:443-445`).

### Following terrain

Quetzalcoatl's `Sol` creates daylight in a 5×5 around her, and the light follows her as she moves. `followsSource` tags the area, and `repaintFollowing` redraws it around her new panel after every move (`module/engine/movement-hooks.mjs:175-205`). The original expiry is carried across each repaint so the area does not renew with every step (`module/engine/terrain.mjs:197-200`).

### When a timed area ends

A painted area's `duration` is stored as an **absolute expiry tick**, like every other expiry (Ch. 04), and it ends **at the end of the Turn at that tick** — the same boundary, by the same comparison, as an effect stamped with it. `expiryReached(expiry, tick)` (`module/domain/tick.mjs`) is that comparison, and both sweeps ask it of the tick of the Turn that just ended: `scheduler.endTurn` for effects (step 6) and `expireTerrain` for areas (`engine/scheduler-hooks.mjs` hands it the same `tick`). So an area and an effect painted by one use, with one "1◈", are present through the last Turn of their life and gone at its end, together: Sol's 5×5 of Day lasts exactly as long as the Sol buff. `expireTerrain` used to be handed the *next* tick, so the daylight went at the **start** of the Turn Sol was still standing for, and "the 5×5 around Quetz is Day" was false for the last Turn of her buff (#161). A hand-drawn area carries no expiry and is never swept.

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
