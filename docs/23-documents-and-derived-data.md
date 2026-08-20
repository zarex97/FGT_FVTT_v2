# 23 — Documents and Derived Data

> **Implemented (Ch. 45 A5, D1).** The aura pass (§23.3) exists, as `annotateAuras` inside
> `snapshotBoard`. It is a **linear scan**, not the spatially-bucketed `AuraIndex` this chapter
> specifies — correct, and 28 units is not yet a performance problem. Collecting for all units
> against the untouched board before writing any of it back is what stops an aura feeding an
> aura, which is the property §23.3's two-pass structure is for.
>
> Four more passes now sit beside it and settle the same class of question — facts about the
> board that a unit projected alone cannot know: `annotateTerrain`, `annotateEnvironment`,
> `annotateCompulsions` and `annotatePlatforms`.
>
> One repair: `contributionsOf` passed an **empty roll-option set**, so every `self:` predicate
> was unsatisfiable. It now builds the owner's own options.
>
> Still open: cache invalidation (§23.9).

> **Implemented (§23.9).** The **spatial `AuraIndex`** is `module/rules/aura-index.mjs`, built
> inside `snapshotBoard` and consulted by `collectAuras`. It does **spatial narrowing and nothing
> else**: whether an aura's `relations` cover a recipient stays in `collectAuras`, which already
> decided it correctly, because a second relation implementation would be two answers to one
> question. `test/unit/aura-index.test.mjs` holds the indexed and linear paths against each other
> over a 24-unit board at mixed radii.
>
> The **invalidation table** is `module/rules/invalidation.mjs`, applied by
> `module/engine/invalidation-hooks.mjs`. One honest correction to this chapter: the table names a
> *snapshot cache*, and this system does not have one — `snapshotBoard` runs per resolution, from
> the documents, every time. That is deliberate, and it is why most of the staleness §23.9
> anticipates cannot occur here: you cannot serve a stale snapshot you never stored. What the
> table actually drives is the **canvas aura index**, the **overlays**, and §25.10's round-boundary
> checksum. It is still worth having for those three, because the alternative — a hand-maintained
> hook list per consumer, which is what the overlays had — goes stale silently in both directions.
>
> The row this chapter singles out is implemented as stated: **anything that changes `canAct`
> invalidates Master protection for Masters within 2 panels**, and `CAN_ACT_INVALIDATORS` carries
> the same twelve effect ids listed below.

The document subclasses, the derived-data pipeline and its ordering, the snapshot cache, and
the CRUD hooks that keep the world consistent.

---

## 23.1 The derived-data problem

Foundry's data preparation runs on every document change, on every client. For a normal system
that is cheap. For F/GT it is not:

- 28+ units, each with 10–20 abilities and 5–30 effects.
- Rule elements that read *other units* (auras, ZON, Master protection, Decoy).
- Rank comparisons, tick arithmetic, and attribute-closure computation.
- Suppression evaluated to a fixed point.

A naive implementation recomputes everything on every unit whenever any unit changes, which is
O(n²) in rule elements and would make the system unusable at full roster size.

This chapter's job is to make that fast enough while keeping it correct.

---

## 23.2 The preparation order

Foundry's sequence per document, with our insertions:

```
Actor.prepareData()
 │
 ├── prepareBaseData()                    ← system: intrinsic values
 │     • effective parameters (base + granted steps)
 │     • base-attack adjustment from granted steps
 │     • attribute closure
 │     • ability mode states
 │
 ├── prepareEmbeddedDocuments()
 │     • Items prepare
 │     • ActiveEffects prepare  →  effect.system.def resolved from the registry
 │
 ├── applyActiveEffects()                 ← core: `changes` array (we barely use it)
 │     └── FGT INSERTION: rule-element collection and application
 │           1. collect self rule elements (passives, effects, granted)
 │           2. evaluate suppression to a fixed point
 │           3. collect aura rule elements from nearby units
 │           4. build roll options
 │           5. filter by predicate
 │           6. sort by priority
 │           7. apply, in bands (Ch. 06 §6.11)
 │
 └── prepareDerivedData()                 ← system: post-effect values
       • ZON
       • contract state
       • health percentage, display values
       • cooldown readiness
       • turn-budget consumption state
```

### Why rule elements run inside `applyActiveEffects`

Because that is the hook Foundry provides between base and derived data, and it is where core
expects modifiers to land. Overriding it means `prepareDerivedData` sees a fully-modified actor,
which is what every other system assumes and what makes our derived values correct.

```js
// documents/actor.mjs
export class FGTActor extends foundry.documents.Actor {
  /** @override */
  applyActiveEffects() {
    super.applyActiveEffects();          // core `changes`, used only for cosmetics
    this._prepareRuleElements();
  }

  _prepareRuleElements() {
    const ctx = new RuleContext(this);
    this.rules = RuleCollector.collect(this, ctx);
    RuleCollector.suppress(this.rules, ctx);
    for (const band of PRIORITY_BANDS) {
      for (const re of this.rules.inBand(band)) re.apply(this, ctx);
    }
  }
}
```

---

## 23.3 The aura problem and its solution

Auras (Ch. 11 §11.6) create a cyclic dependency: unit A's derived data depends on unit B's
position and rule elements, and vice versa. If both recompute on every change, they can
ping-pong.

**DECISION.** Auras are collected from a **snapshot of the previous pass**, not from live
documents:

```js
class AuraIndex {
  #version = 0;
  #buckets = new Map();          // spatial bucket → aura entries

  /** Rebuilt only when a unit moves or its aura-bearing rules change. */
  rebuild(scene) {
    this.#buckets.clear();
    for (const token of scene.tokens) {
      const actor = token.actor;
      if (!actor?.hasAuras) continue;                        // cheap early-out
      for (const re of actor.rules.auras) {
        this.#index(token, re);
      }
    }
    this.#version++;
  }

  query(position, relation, factionId) { /* bucket lookup */ }
}
```

Three properties that make this work:

1. **`hasAuras` is a cached boolean** on each actor, so units with no auras (most of them) cost
   one property read.
2. **Spatial bucketing** — the board is divided into 4×4 panel buckets; an aura of radius r is
   indexed into every bucket it could reach. A query touches ≤ 9 buckets instead of 28 units.
3. **Version-gated rebuild** — the index rebuilds on movement and on aura-rule changes, not on
   every actor update. Health changes, cooldown ticks, and non-aura effects do not invalidate it.

The one-pass staleness this introduces is acceptable: an aura that begins applying one frame
late is invisible, and any *resolution* (combat, ability use) rebuilds the index synchronously
before building its snapshot.

**RISK.** A rule element that both grants an aura and depends on an aura could observe stale
data. `Clarity` (which doubles `Area CritUp` magnitudes it receives) is exactly that shape.
Mitigation: aura-consuming rule elements are evaluated in a **second pass** after all auras are
collected, in a dedicated priority band, and may not themselves emit auras. Enforced by the
rule-element base class.

---

## 23.4 Snapshot construction and caching

The rules layer consumes `UnitSnapshot` / `BoardSnapshot` (Ch. 03 §3.4). Building them is the
bridge between Foundry and the pure layers.

```js
export class SnapshotService {
  static #unitCache = new Map();     // actorUuid → {version, snapshot}
  static #boardCache = null;

  static unit(actor) {
    const version = actor.system._derivedVersion;
    const hit = this.#unitCache.get(actor.uuid);
    if (hit?.version === version) return hit.snapshot;
    const snapshot = buildUnitSnapshot(actor);
    this.#unitCache.set(actor.uuid, { version, snapshot });
    return snapshot;
  }

  static board({ fresh = false } = {}) {
    if (!fresh && this.#boardCache?.version === boardVersion()) return this.#boardCache.snapshot;
    const snapshot = buildBoardSnapshot(canvas.scene);
    this.#boardCache = { version: boardVersion(), snapshot };
    return snapshot;
  }
}
```

`_derivedVersion` is a counter bumped at the end of `prepareDerivedData`. `boardVersion()` is a
composite of the scene's token positions hash and the combat's `globalTurn`.

Snapshots are **frozen** (`Object.freeze`, deeply, in dev mode only) so a rules-layer bug that
tries to mutate one fails loudly rather than corrupting the document layer.

### Budget

| Operation | Target | Measured by |
|---|---|---|
| Single `UnitSnapshot` build | ≤ 0.3 ms | `test/perf/snapshot.bench.mjs` |
| Full `BoardSnapshot`, 28 units | ≤ 8 ms | same |
| Aura index rebuild, 28 units | ≤ 3 ms | same |
| Full derived-data pass, one actor | ≤ 2 ms | same |

These are not aspirational — they are asserted in the perf suite and CI fails on a 25%
regression.

---

## 23.5 `FGTActor`

```js
export class FGTActor extends foundry.documents.Actor {

  // ── Derived accessors used everywhere ──────────────────────────────────
  get isServant()  { return this.type === "servant"; }
  get isMaster()   { return this.type === "master"; }
  get isCombatUnit(){ return ["servant", "master", "summon"].includes(this.type); }

  get faction()    { return game.combat?.system.factions.find(f => f.id === this.system.factionId); }
  get controller() { /* owning user, or null for GM units */ }

  relationTo(other) { /* Ch. 04 §4.10 */ }

  // ── Ability access ─────────────────────────────────────────────────────
  get abilities()      { return this.items.filter(i => i.type === "ability"); }
  get noblePhantasms() { return this.items.filter(i => i.system.isNP); }
  ability(id)          { return this.items.get(id) ?? this.items.find(i => i.system.slug === id); }
  hasSkill(nameOrAlias){ /* checks names and countsAs aliases (Ch. 15 §15.6) */ }
  skillRank(nameOrAlias) { /* returns Rank | null */ }

  // ── Effects ────────────────────────────────────────────────────────────
  hasEffect(defId)     { return this.effects.some(e => e.system.defId === defId && !e.suppressed); }
  effectsOf(defId)     { /* … */ }
  effectFamily(family) { /* … */ }
  get canAct()         { /* the shared predicate — Ch. 16 §16.4 */ }

  // ── Mutations, all routed through the intent system ────────────────────
  async applyIntents(intents, { source } = {}) { return IntentApplier.apply(this, intents, source); }

  // ── Lifecycle ──────────────────────────────────────────────────────────
  async _preCreate(data, options, user) { /* set prototype token defaults by type */ }
  async _preUpdate(changed, options, user) { /* clamp resources, validate contracts */ }
  _onUpdate(changed, options, userId) { /* invalidate caches, fire fgt events */ }
}
```

### `_preUpdate` responsibilities

```js
async _preUpdate(changed, options, user) {
  await super._preUpdate(changed, options, user);

  // Clamp every resource to [0, max] before the write lands.
  for (const key of ["health", "agility", "luck"]) {
    const patch = changed.system?.[key];
    if (!patch) continue;
    const max = patch.max ?? this.system[key].max;
    if (patch.value !== undefined) patch.value = Math.clamp(patch.value, 0, max);
    if (patch.max !== undefined && this.system[key].value > patch.max)
      patch.value = patch.max;                                   // one-way clamp (Ch. 06 §6.1)
  }

  // Record a health delta for _onUpdate to act on.
  if (changed.system?.health?.value !== undefined) {
    options.fgt ??= {};
    options.fgt.healthDelta = changed.system.health.value - this.system.health.value;
  }
}
```

### `_onUpdate` responsibilities

```js
_onUpdate(changed, options, userId) {
  super._onUpdate(changed, options, userId);

  this.system._derivedVersion = (this.system._derivedVersion ?? 0) + 1;
  SnapshotService.invalidate(this.uuid);

  if (options.fgt?.healthDelta !== undefined) {
    Hooks.callAll("fgt.healthChanged", this, options.fgt.healthDelta, options);
    if (this.system.health.value <= 0 && !options.fgt.suppressDefeat) {
      DefeatHandler.enqueue(this, options.fgt.cause);          // GM client resolves
    }
  }

  if (changed.system?.contract) Hooks.callAll("fgt.contractChanged", this);
  if (this.hasAuras) AuraIndex.invalidate();
}
```

`DefeatHandler.enqueue` rather than an inline resolution: defeat triggers the revival priority
chain (Ch. 04 §4.13), which may itself write, and doing that inside `_onUpdate` risks reentrancy.
The handler batches on a microtask and runs on the GM client.

---

## 23.6 `FGTToken`

```js
export class FGTToken extends foundry.documents.TokenDocument {

  get facing() { return this.rotation; }
  get panels() { return this.getOccupiedGridSpaceOffsets(); }

  /** @override — validate F/GT movement legality before the move lands. */
  async _preUpdateMovement(movement, operation) {
    await super._preUpdateMovement(movement, operation);
    if (operation.fgt?.forced) return;                    // knockback, platform linkage

    const result = MovementValidator.validate(this, movement);
    if (!result.ok) {
      ui.notifications.warn(result.reason);
      return false;                                        // veto
    }
    operation.fgt = { ...operation.fgt, panelsUsed: result.panels };
  }

  _onUpdateMovement(movement, operation) {
    super._onUpdateMovement(movement, operation);
    if (operation.fgt?.forced) {
      Hooks.callAll("fgt.unitDisplaced", this, movement);
    } else {
      this.actor?.update({ "system.turnState.movedPanels":
        this.actor.system.turnState.movedPanels + (operation.fgt?.panelsUsed ?? 0) });
      Hooks.callAll("fgt.unitMoved", this, movement);
    }
    AuraIndex.invalidate();
    ZoneWatcher.recheck(this);          // ZON badges, Master protection, Decoy
  }
}
```

Using v14's `_preUpdateMovement` rather than the generic `_preUpdate` matters: it fires
specifically for the eight `MOVEMENT_FIELDS` and gives us the waypoint list, so we can validate
the *path*, not just the destination. Path validation is what enforces "cannot move through
enemy-occupied panels".

The movement **cost function** (Ch. 08 §8.3) handles reachability highlighting;
`_preUpdateMovement` is the authoritative veto, because a client can construct an update that
bypasses the cost function.

---

## 23.7 `FGTItem`

```js
export class FGTItem extends foundry.documents.Item {
  get isReady() {
    const cd = this.system.cooldown;
    if (cd.max === null) return true;
    return cd.elapsed >= cd.max.resolve(turnsPerRound());
  }

  get blockReason() {
    // Returns a human-readable reason the ability cannot be used, or null.
    // Consumed by the sheet to render the disabled tooltip (Ch. 15 §15.10).
  }

  get modeActive() { return this.system.mode.isMode && this.system.mode.active; }

  /** Rule elements contributed while this ability is present. */
  get contributedRules() {
    const out = [];
    if (this.system.hasPassive) out.push(...this.system.passiveRules);
    if (this.modeActive)        out.push(...this.system.mode.rules ?? []);
    return out.map(spec => RuleElement.create(spec, this));
  }
}
```

`contributedRules` is the hook by which abilities feed the rule engine. An ability with a
passive contributes always; a mode contributes only while active. Nothing else in the system
needs to know the difference.

---

## 23.8 `FGTEffect`

```js
export class FGTEffect extends foundry.documents.ActiveEffect {
  get def() { return CONFIG.FGT.effects.get(this.system.defId); }

  get isActive() {
    if (this.disabled) return false;
    if (this.suppressed) return false;
    const d = this.system.duration;
    const now = currentTurn() - (this.parent?.system.turnState.pausedTicks ?? 0);
    if (d.expiryTurn !== null && now > d.expiryTurn) return false;
    if (d.usesRemaining !== null && d.usesRemaining <= 0) return false;
    return true;
  }

  get contributedRules() {
    return this.isActive ? this.def.rules.map(spec => RuleElement.create(spec, this)) : [];
  }

  /** @override — status icons respect closed-info visibility. */
  get isTemporary() { return true; }

  async _preCreate(data, options, user) {
    await super._preCreate(data, options, user);
    // Stamp the absolute expiry at creation time, using the bearer's local clock.
    const tpr = turnsPerRound();
    const start = currentTurn();
    const ticks = this.system.duration.expr?.resolve(tpr) ?? null;
    this.updateSource({
      "system.duration.startTurn": start,
      "system.duration.expiryTurn": ticks === null ? null : start + ticks,
    });
  }
}
```

`suppressed` is a transient property set by the suppression pass, not a stored field
(Ch. 22 §22.7).

---

## 23.9 Cache invalidation

The hardest part of any derived-data system. Explicitly enumerated:

| Change | Invalidates |
|---|---|
| Actor system field | that actor's snapshot; board snapshot |
| Effect created/deleted/updated | bearer's snapshot; board snapshot; aura index **if** the effect grants an aura |
| Item created/deleted | bearer's snapshot; aura index if it has passive auras |
| Ability mode toggled | bearer's snapshot; aura index; **Master protection for adjacent Masters** |
| Token moved | board snapshot; aura index; ZON state for the mover and its partner; Decoy constraints |
| Token deleted | everything |
| Turn advanced | board snapshot; every actor's cooldown readiness; every effect's `isActive` |
| Round advanced | as above, plus day/night phase |
| Combat setting changed | everything (and it is locked mid-match anyway) |

The row that is easy to miss is **"ability mode toggled → Master protection"**: deactivating a
Servant's Mad Enhancement does not change its position, but if the Servant becomes unable to act
(it cannot from Mad Enhancement, but Stun can), the adjacent Master loses protection. The
general rule: **anything that changes `canAct` invalidates Master protection for Masters within
2 panels.**

```js
const CAN_ACT_INVALIDATORS = new Set([
  "stun","stop","freeze","petrify","sleep","nightmare","coma","webbed",
  "crystalfreeze","charm","confuse","berserk",
]);

Hooks.on("fgt.effectChanged", (effect) => {
  if (!CAN_ACT_INVALIDATORS.has(effect.system.defId)) return;
  for (const m of mastersWithin(effect.parent, 2)) MasterProtection.invalidate(m);
});
```

---

## 23.10 Unlinked tokens and `ActorDelta`

The prototype documented a real trap and it is worth restating:

> `isOwner` can return true (OWNER on the base actor) while the `ActorDelta` still blocks
> writes, producing *"User X lacks permission to create Item […] in parent ActorDelta […]"*.

So:

1. **Never use `game.actors.get(id)`** to resolve a combat participant. Use `fromUuid(uuid)`,
   which handles both world actors and synthetic token actors.
2. **Never treat `actor.isOwner` as a permission fast path** for writes. Route through the GM
   proxy unconditionally; the proxy short-circuits to a local call when the caller *is* the GM
   (Ch. 26).

**DECISION.** Servants and Masters are **linked** tokens by default (`actorLink: true`), set in
the prototype token defaults at `_preCreate`. There is exactly one Karna in a match, so an
unlinked copy has no benefit and only creates the delta problem. Civilians and Summons are
unlinked, since they are spawned in multiples from a template — and they are also the units
least likely to need cross-client writes.

```js
async _preCreate(data, options, user) {
  await super._preCreate(data, options, user);
  const linked = ["servant", "master", "platform", "structure"].includes(this.type);
  this.updateSource({ prototypeToken: {
    actorLink: linked,
    displayBars: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
    lockRotation: false,                       // facing lives in rotation
    disposition: CONST.TOKEN_DISPOSITIONS.NEUTRAL,   // derived per-viewer (Ch. 04 §4.10)
    sight: { enabled: true, range: this.system.detect || 0 },
  }});
}
```

---

## 23.11 Events

The system's own hook namespace, all prefixed `fgt.`. Full reference in Appendix E. The
document layer emits:

| Hook | When |
|---|---|
| `fgt.healthChanged` | Any health mutation, with the delta and cause |
| `fgt.unitDefeated` | After the revival chain resolves to death |
| `fgt.unitRevived` | A revival source fired |
| `fgt.unitMoved` / `fgt.unitDisplaced` | Voluntary vs forced movement |
| `fgt.effectApplied` / `fgt.effectRemoved` | With the removal reason |
| `fgt.contractChanged` | Any contract-state transition |
| `fgt.modeToggled` | Presence Concealment / Mad Enhancement |
| `fgt.resourceChanged` | Fragarach tokens, Proliferation, Construction |
| `fgt.cooldownChanged` | Including rate changes from NP Lock/Lag |

Rule elements subscribe through the `OnEvent` element (Ch. 24) rather than calling `Hooks.on`
directly, so subscriptions are automatically torn down when the effect expires. Manual
`Hooks.on` in content is the single easiest way to leak listeners, and the rule-element wrapper
exists to prevent it.

---

## 23.12 Summary of decisions

| # | Decision |
|---|---|
| D23.1 | Rule elements run inside an overridden `applyActiveEffects`, between base and derived data. |
| D23.2 | Auras are served from a spatially-bucketed, version-gated index, not live document reads. |
| D23.3 | Aura-consuming rule elements run in a later band and may not emit auras. |
| D23.4 | Snapshots are cached against a `_derivedVersion` counter and frozen in dev mode. |
| D23.5 | Movement is validated in `_preUpdateMovement` (path-aware), with the cost function used for highlighting. |
| D23.6 | Defeat resolution is enqueued to a GM-side handler, never run inline in `_onUpdate`. |
| D23.7 | Servants, Masters, Platforms and Structures use **linked** tokens; Civilians and Summons unlinked. |
| D23.8 | Actor resolution always uses `fromUuid`, never `game.actors.get`. |
| D23.9 | Anything that changes `canAct` invalidates Master protection within 2 panels. |
| D23.10 | Content subscribes to events through the `OnEvent` rule element, never `Hooks.on` directly. |

---

**Next:** [24 — The Rules Engine](24-rules-engine.md)
