# 28 — Targeting Implementation

Chapter 09 specified the targeting type system. This chapter implements it against Foundry v14,
which is unusually well suited to the job: v14 replaced `MeasuredTemplate` with **grid shape
generators**, which is exactly the primitive we need.

---

## 28.1 What v14 gives us

```js
grid.getRectangle(origin, width, height, anchor, rotation);
grid.getLine(origin, length, width, direction);
grid.getCircle(center, radius);
grid.getCone(origin, radius, direction, angle);
grid.getEllipse(center, radiusX, radiusY, rotation);
grid.getRing(center, radius, innerWidth, outerWidth);

grid.getOffset(coords);              // point → GridOffset
grid.getOffsetRange({x, y, width, height});
grid.getCenterPoint(coords);
grid.getTopLeftPoint(coords);
grid.getSnappedPoint(point, behavior);
grid.getAdjacentOffsets(coords);
grid.testAdjacency(a, b);
```

> *"The shape generators are what replaced `MeasuredTemplate` in v14: a cone or circle is now
> grid geometry that any placeable can carry as shape data."*

So a targeting shape is a **pure geometry computation**, not a document that must be created,
waited on, queried, and deleted. This eliminates the prototype's entire targeting approach —
which spawned a scene `Region` via a third-party module, waited two animation frames for
Foundry to populate `RegionDocument#tokens`, read the token set, then deleted the region through
the GM proxy — along with its external dependency and its inherent raciness.

---

## 28.2 The targeting service

```js
export class TargetingService {
  /**
   * Pure: resolve a spec to panels and units. No canvas, no documents.
   * @param {TargetSpec} spec
   * @param {UnitSnapshot} caster
   * @param {BoardSnapshot} board
   * @param {Placement} placement    anchor panel and/or direction chosen by the player
   * @returns {ResolvedTargets}
   */
  static resolve(spec, caster, board, placement) {
    const anchor = Anchors.resolve(spec.anchor, caster, board, placement);
    const panels = Shapes.expand(spec.shape, anchor, caster, board);
    const units  = Occupancy.collect(panels, board);
    return Selection.filter(units, spec.selection, spec.limits, caster, board, panels);
  }

  /** Which placements are legal? Drives the direction picker and range highlighting. */
  static legalPlacements(spec, caster, board) { /* … */ }

  /** Validate a chosen placement, returning human-readable failures. */
  static validate(spec, caster, board, placement) { /* … */ }
}
```

Entirely in L2 (pure). The canvas layer calls it; it never calls the canvas.

---

## 28.3 Shape expansion

Most shapes map directly onto grid generators; two need our own implementation.

```js
const Shapes = {
  expand(shape, anchor, caster, board) {
    switch (shape.kind) {
      case "point":  return [anchor.panel];
      case "unit":   return footprintPanels(anchor.unit);
      case "square": return this.rect(anchor, shape.size, shape.size);
      case "rect":   return this.rect(anchor, shape.w, shape.h);

      case "chebyshevRadius":
        // grid.getOffsetRange on a square bounding box IS Chebyshev on a square grid.
        return offsetRange(anchor.panel, shape.r, board.bounds);

      case "attackRange":
        return attackRangePanels(anchor.panel, shape.r, board.bounds);   // our formula, §28.4

      case "line":
        return linePanels(anchor.panel, shape.direction, shape.length, shape.width);

      case "path":
        return anchor.path;

      case "orientedRect": {
        const [w, h] = isVertical(anchor.facing)
          ? [shape.short, shape.long] : [shape.long, shape.short];
        return this.rect(anchor, w, h);
      }

      case "ring":
        return ringPanels(anchor.panel, shape.inner, shape.outer);

      case "zone":
        return board.zones.find(z => z.id === shape.zoneId)?.panels ?? [];

      case "banded":
        return this.banded(shape, anchor, caster, board);

      default: throw new FGTError("UNKNOWN_SHAPE", `Unknown targeting shape "${shape.kind}"`);
    }
  },
};
```

`throw` on an unknown shape rather than returning `[]` — principle P4. A content typo must be
loud.

### The two we implement ourselves

**`attackRange`** — the octagonal diagonal-reduction shape (Ch. 08 §8.2). No grid generator
produces it, and it is the most-used shape in the game.

```js
export function attackRangePanels(origin, R, bounds) {
  const out = [];
  for (let di = -R; di <= R; di++) {
    for (let dj = -R; dj <= R; dj++) {
      const d = Math.max(Math.abs(di), Math.abs(dj));
      const s = Math.min(Math.abs(di), Math.abs(dj));
      if (d > R) continue;
      if (R >= 3 && d === R && s >= 2) continue;     // clip the outer ring only
      const p = { i: origin.i + di, j: origin.j + dj };
      if (inBounds(p, bounds)) out.push(p);
    }
  }
  return out;
}
```

Memoized per `(R, boundsHash)` — there are at most a dozen distinct values in a match.

**`orthogonalAdjacentRect`** — the "non-diagonal direction next to" anchor (Ch. 09 §9.3). Also
not expressible with a generator, because the block is offset from the origin rather than
centred on it.

---

## 28.4 Anchor resolution

```js
const Anchors = {
  resolve(anchor, caster, board, placement) {
    switch (anchor.kind) {
      case "self":
        return { panel: centreOf(caster) };

      case "selfEdgeAdjacent": {
        const dir = anchor.direction === "chosen" ? placement.direction : anchor.direction;
        return { panel: centreOf(caster), direction: dir, mode: "edgeAdjacent" };
      }

      case "withinRange": {
        const p = placement.panel;
        const d = attackDistance(centreOf(caster), p, anchor.range);
        if (!inAttackRange(centreOf(caster), p, anchor.range.panels))
          throw new PlacementError(`Anchor is ${d} panels away; Range is ${anchor.range.panels}.`);
        if (anchor.minRange && d < anchor.minRange)
          throw new PlacementError(`Minimum Range is ${anchor.minRange}.`);
        return { panel: p };
      }

      case "targetUnit": {
        const u = board.units.get(placement.unitId);
        if (!u) throw new PlacementError("No target selected.");
        return { unit: u, panel: centreOf(u) };
      }

      case "movementPath":  return { path: placement.path };
      case "zone":          return { zoneId: anchor.zoneId };
      case "platform":      return { zoneId: platformZoneId(anchor, caster, board) };
      case "global":        return { all: true };
      case "sourceOfAttack":return { unit: board.units.get(placement.sourceId) };

      case "conditional": {
        for (const b of anchor.branches)
          if (Predicate.test(b.predicate, optionsFor(caster, board))) 
            return this.resolve(b.anchor, caster, board, placement);
        throw new PlacementError("No conditional anchor branch matched.");
      }
    }
  },
};
```

---

## 28.5 The canvas layer

A custom `InteractionLayer` renders previews. It draws; it never decides.

```js
export class TargetingLayer extends foundry.canvas.layers.InteractionLayer {
  static get layerOptions() {
    return { ...super.layerOptions, name: "fgtTargeting", zIndex: 500 };
  }

  #session = null;

  async begin(spec, caster) {
    this.#session = new TargetingSession(spec, caster);
    this.activate();
    switch (spec.anchor.kind) {
      case "selfEdgeAdjacent": return this.#directionPicker();
      case "withinRange":      return this.#freePlacement();
      case "targetUnit":       return this.#unitPicker();
      default:                 return this.#autoResolve();
    }
  }

  #render(resolved, legality) {
    this.#panels.clear();
    const colour = legality.ok ? 0x4488ff : 0xff4444;
    for (const p of resolved.panels) this.#drawPanel(p, colour, 0.25);
    for (const t of resolved.units)  this.#outlineToken(t.unitId, colour);
    this.#hud.update(resolved, legality);
  }
}
```

### Mode A — the direction picker

The most important interaction in the system (Ch. 09 §9.9).

```js
async #directionPicker() {
  const options = ["N", "E", "S", "W"].map(dir => {
    const placement = { direction: dir };
    const resolved  = TargetingService.resolve(this.#session.spec, caster, board, placement);
    const legality  = TargetingService.validate(this.#session.spec, caster, board, placement);
    return { dir, resolved, legality };
  });

  // Draw all four ghosts at once, tinted by legality.
  for (const o of options) this.#drawGhost(o.resolved.panels, o.legality.ok ? 0.12 : 0.06);

  // Hovering one brings it forward and shows its affected list.
  // Arrow keys cycle; Enter confirms; Escape cancels.
  return this.#awaitChoice(options);
}
```

All four legal placements visible simultaneously, one click to choose. No free-placement, no
rule knowledge required, no confirmation dialog. This single affordance replaces the prototype's
spawn-preview-confirm-redo loop.

### Mode B — free placement

```js
async #freePlacement() {
  const legal = TargetingService.legalPlacements(spec, caster, board);
  this.#drawRangeOverlay(legal);                       // the octagonal range, dimmed

  this.#onPointerMove = (event) => {
    const panel = canvas.grid.getOffset(event.interactionData.origin);
    const placement = { panel };
    const legality = TargetingService.validate(spec, caster, board, placement);
    const resolved = legality.ok
      ? TargetingService.resolve(spec, caster, board, placement)
      : { panels: [], units: [] };
    this.#render(resolved, legality);
  };
  // click confirms, right-click cancels
}
```

`canvas.grid.getOffset()` handles the snapping natively; no manual pixel maths.

### Mode C and D

Unit picker and subset picker, as specified in Ch. 09 §9.9. Both reuse `#render`.

---

## 28.6 The preview HUD

A floating panel beside the cursor:

```
┌─ Brahmastra Kundala ───────────────────────┐
│ 7×7 within Range 5           anchor: f7    │
├────────────────────────────────────────────┤
│ ⚔ Heracles          1,847 – 2,431          │
│      Burn 3◈ · Def Dwn (B) 1◈              │
│ ⚔ Enemy Master        412 –   545          │
│      ⚠ Overpower roll applies              │
│ ⚔ Berserker         2,104 – 2,771          │
│ ✕ Karna              excluded (self)        │
├────────────────────────────────────────────┤
│ Cost: Master loses 53 Health (Rank A+)     │
│ Also puts Mana Burst (Flames) on cooldown  │
│                                            │
│ ✓ Legal                    [ Confirm ]     │
└────────────────────────────────────────────┘
```

Every line comes from data the resolution already produced: the target list from
`ResolvedTargets`, the damage range from a speculative pipeline run with min/max roll values
(Ch. 14 §14.7), the effects from the ability's phases, the cost from its cost list, and the
cooldown side-effect from `alsoTriggers`.

The `⚠ Overpower roll applies` line is the kind of detail that converts a rules-lawyer question
into a non-event.

---

## 28.7 Speculative damage

The preview runs the real pipeline. Because it is pure and takes a pre-populated roll map
(Ch. 13 §13.3), running it with min and max roll values gives an exact range with no side
effects.

```js
function previewDamage(ability, caster, target, board) {
  const probe = computeDamage({ ...ctx, probe: true });        // which rolls are needed?
  const min = computeDamage({ ...ctx, rolls: minRolls(probe.rollsUsed) });
  const max = computeDamage({ ...ctx, rolls: maxRolls(probe.rollsUsed) });
  return { min: min.total, max: max.total };
}
```

Three pipeline calls per target. At ~0.15 ms each and twelve targets, that is ~5 ms — recomputed
only when the placement changes, which is at most once per pointer-move frame and is debounced
to 30 Hz. Comfortably within budget.

**Information safety:** in closed-info mode the preview shows only what the attacker could
legitimately estimate (their own modifiers, not the defender's hidden ones). The GM-side
computation returns a redacted range.

---

> **Implemented.** `module/rules/legality.mjs` holds the table; the targeting layer and its
> preview HUD render it. Each refusal carries its **kind**, and the three are genuinely different
> decisions: `hard` refuses, `overridable` refuses *and offers the Command Spell that would lift
> it inline*, and `confirm` does not refuse at all — the placement is legal and catastrophic, so
> the Grail takes a second deliberate click.
>
> `isBlocked` only treats an overridable refusal as lifted when the command is **actually
> available**, because offering a spend button for a command the Master cannot afford is §17.6's
> "an unusable option should never appear" failure exactly.
>
> Verdicts are ordered **hard first**: a player facing both a fixable refusal and an unfixable one
> should read the unfixable one, since spending a Command Spell on the other still leaves them
> unable to act. A test holds each message's `{placeholders}` against the `params` its table entry
> declares — a message with a placeholder nobody supplies renders a blank, which reads as a bug in
> the number rather than a missing field.

## 28.8 Legality rendering

Validation failures render inline rather than as an error after the fact:

```js
const REASONS = {
  outOfRange:      (d, r) => `Anchor is ${d} panels away; Range is ${r}.`,
  belowMinRange:   (r)    => `Minimum Range is ${r}.`,
  notInZon:        (d, z) => `Noble Phantasms require the Servant to be within its Master's ZON (${d} panels away, ZON is ${z}).`,
  civilianInArea:  ()     => `Good-aligned Servants will not use an AoE Noble Phantasm with a Civilian in range.`,
  masterHealth:    (h, c) => `The Master has ${h} Health; this Noble Phantasm costs ${c}.`,
  crossLevelMelee: ()     => `Only ranged Attacks can cross between the ground and the platform.`,
  noTargets:       ()     => `No valid targets in the selected area.`,
  grailAtRisk:     (p)    => `⚠ The Holy Grail is in this area — ${p}% chance of destroying it. ALL factions would lose.`,
};
```

Failures that a Command Spell can override render with the spend button inline
(Ch. 09 §9.6, Ch. 17 §17.4). `grailAtRisk` is a **hard confirm**, requiring a second click
even though the placement is legal (Ch. 19 §19.4).

---

> **Implemented.** `module/apps/canvas/overlay-layer.mjs` draws all seven. ZON, threat range and
> Master protection came earlier; **Decoy pull, platform footprints with their level badge, and
> the Grail area with its contest state** landed with this pass, and Home Base is native Region
> rendering as this section specifies.
>
> The platform **level badge** is the load-bearing half of that overlay: two platforms at
> different levels overlap on screen and do not interact, and nothing else on the canvas says so.
> The Decoy arrow is the one overlay that answers *"why can I not target what I want to"* — a
> Decoy constraint is otherwise invisible and silently narrows the legal target set.
>
> The refresh trigger changed with them. The overlays used to carry a hand-maintained hook list,
> which went stale in both directions; they now listen to `fgt.invalidate` and redraw only for the
> targets they actually draw from (§23.9), so a cooldown tick no longer repaints the canvas.

## 28.9 Zone overlays

A separate always-on canvas layer draws persistent context:

| Overlay | Trigger | Appearance |
|---|---|---|
| ZON | Selecting a Servant or Master | Dashed ring around the Master, in the faction colour; red when the Servant is outside |
| Threat range | Hovering an enemy | Their octagonal attack range, faint |
| Home base | Always | Region tint (native Region rendering) |
| Decoy pull | A unit is under Decoy | Arrow from the unit toward the Decoy source |
| Master protection | Hovering a Master | The 2-panel Servant radius, and whether it is currently active |
| Platform footprint | Always, when a platform exists | Outline with a level badge |
| Grail area | Grail materialized | 2-panel ring, with contest state |

These are the difference between a player planning correctly and a player discovering a rule
after they have committed. The ZON overlay in particular prevents the single most common
mistake in the game.

---

## 28.10 Keyboard and accessibility

| Key | Action |
|---|---|
| `Arrow keys` | Cycle placement options (Mode A) / nudge the anchor (Mode B) |
| `Tab` | Cycle legal targets (Mode C) |
| `Space` / `Enter` | Confirm |
| `Escape` | Cancel |
| `Shift` | Hold to show the full damage breakdown for each target |
| `Alt` | Toggle the affected-unit list expansion |

Everything reachable by mouse is reachable by keyboard. Colour is never the only signal —
legal/illegal is also conveyed by border style (solid/dashed) and by the explicit text in the
HUD.

---

## 28.11 What we deliberately do not use

| Foundry feature | Why not |
|---|---|
| `MeasuredTemplate` | Removed in v14 in favour of grid shapes |
| Scene `Region` for the *aiming loop* | Still true: a document per pointer-move is heavyweight, and a player cannot create one without the proxy. Aiming stays on the PIXI layer. **Superseded in part** — see §28.14: once a placement is committed, the area *is* drawn as a Region. |
| `game.user.targets` | Foundry's target set is a single flat set with no shape, band, or relation information. We maintain our own resolution and mirror into `user.targets` only for module compatibility. |
| Third-party targeting modules | The prototype's *Mass Edit* dependency is eliminated. `relationships.requires` stays empty. |

The `user.targets` mirroring is worth a note: we set it so that other modules and macros see
something sensible, but no F/GT code reads it. Reading it would introduce a second source of
truth.

---

## 28.12 Testing

Geometry is exhaustively testable and the tests are cheap:

- **Fixture tests** for every entry in the Ch. 09 §9.8 catalogue: given a board, a caster, and a
  placement, assert the exact panel set and unit list.
- **Count assertions** for the range shape: R=1 → 9 panels, R=2 → 25, R=3 → 37, R=4 → 61,
  R=5 → 93, R=6 → 133. (Excluded = `8R − 12` for R ≥ 3.)
- **Property tests**: `resolve()` is deterministic; every returned panel is in bounds; no unit
  appears twice; every unit's footprint intersects the panel set.
- **Regression fixtures** for each of the 24 reference declarations, so a change to shape
  expansion cannot silently alter Karna's Brahmastra Kundala.
- **Differential test**: `chebyshevRadius(r)` must equal `grid.getOffsetRange` on a square grid,
  verifying our assumption about v14's behaviour.

The last one guards against a Foundry behaviour change breaking us silently.

---

## 28.13 Summary of decisions

| # | Decision |
|---|---|
| D28.1 | Targeting uses v14 grid shape generators plus two of our own shapes; no `MeasuredTemplate`, no Regions, no external modules. |
| D28.2 | `TargetingService` is pure L2; the canvas layer draws and never decides. |
| D28.3 | Unknown shapes throw rather than returning empty. |
| D28.4 | Mode A shows all four legal directions simultaneously — one click, no dialog. |
| D28.5 | The preview runs the real damage pipeline with min/max rolls for an exact range. |
| D28.6 | Legality failures render inline with human-readable reasons and inline command-spell overrides. |
| D28.7 | Grail-endangering placements require a second explicit confirmation. |
| D28.8 | `game.user.targets` is mirrored for compatibility but never read by F/GT code. |
| D28.9 | Persistent zones use Regions. Transient targeting creates no document **while aiming**; a committed placement does, and discards it. Revised — see §28.14. |

---

## 28.14 Revision — grid-shape Regions for the committed area

`v14` added **`GridShapeData`**: a shape that is *"any arbitrary set of grid
squares, as defined by their grid offset"*. That is precisely what
`resolveTargets` already returns, which removes the geometric objection behind
D28.9 — a Region can now be a faithful drawing of the resolution rather than a
polygon approximation of it.

The other two objections were about lifecycle, not geometry, and they are
answered by *when* the document exists:

- **Racy to query** — nothing is read back. The prototype's bug was spawning a
  region and then asking it who was inside; here the units are already known,
  decided synchronously in L2 before the region exists. `RegionDocument#tokens`
  is never touched.
- **Heavyweight** — one document per *committed placement*, not per pointer
  move. Aiming stays on the PIXI layer, which is what makes it frame-rate cheap.
- **GM permission** — creation and deletion are proxied, with an authorizer that
  admits only transient, grid-shaped regions, so the operation cannot author
  permanent scenery or delete a bounded field.

Anything that survives a disconnect is swept at `ready`, which is what keeps
"documents leak" from being true of this design rather than merely unlikely.

### The confirmation step

Placing the area opens the review window (§28.6's layout, as a dialog): every
unit that will be hit, with its damage range, and **every unit the area caught
that the rules excluded, with the reason**. Three outcomes — confirm, re-aim,
cancel — and re-aim must be its own value, because an empty confirmation is
legal for an ability whose effect is not target-dependent and cancelling is
legal too, so folding re-aim into either would spend the attack or throw it
away.

Unchecking a unit narrows the attack. `placement.chosenIds` is honoured whatever
the chooser is, and can only ever *remove*: the dialog runs on the player's
client, so a crafted id naming an ally must not make that ally a target.

| # | Decision |
|---|---|
| D28.10 | The committed area is a grid-shape Region, created through the proxy, discarded in a `finally`, and swept at `ready`. |
| D28.11 | Aiming never creates a document; only a committed placement does. |
| D28.12 | The confirmation lists exclusions with reasons, and its three outcomes are distinct values. |
| D28.13 | `chosenIds` narrows and never widens. |

---

**Next:** [29 — User Interface](29-user-interface.md)
