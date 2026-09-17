# 14 — Effect taxonomy, registry and families

## What it is

An **effect definition** is a data object describing one game effect — Burn, Charm, Invuln — as a polarity, a volatility, a stacking rule, and metadata the engine reads to apply or prevent it. Definitions are authored once in `packs/_source/effects/`, compiled into the compendium, and loaded into a frozen registry (`EffectRegistry`) at setup time. Without the registry, an ability that tries to apply `"burn"` is a silent no-op because the string has nowhere to become a concrete definition (`module/rules/registry.mjs:7-10`).

An **effect family** is an umbrella name for a set of effects — `Bind` covers Stun, Disable, Immobilize, Slow, Petrify, Shock, Webbed, Seal, Freeze and Crystalfreeze. Families are declared on each member rather than in a central list, so a binding effect authored tomorrow counts by saying so about itself instead of needing an edit somewhere else (`module/rules/effects/families.mjs:13-15`). Medusa's Monstrous Snake Metamorphosis was the first clause to ask about the umbrella rather than about a member, and every downstream consumer — auras, conditions, rule elements — now operates over families (`module/rules/effects/families.mjs:9-11`).

The **taxonomy** is the set of axes by which effects are classified: polarity (buff, debuff, status), volatility (nonVolatile, volatile, mental, terminal), valence (offensive, defensive, neither), and stacking rule. A fourth dimension, visibility, is stored on effect instances rather than definitions and controls who sees them on the board (`module/data/misc.mjs:75`).

## Where it lives

| File | Role |
|---|---|
| `module/rules/registry.mjs` | `EffectRegistry` — load definitions, query by id, validate references |
| `module/rules/effects/families.mjs` | Family queries: `familiesOf(def)`, `familiesPresent(ids)`, `unitHasFamily(unit, name)` |
| `module/rules/effects/count-targets.mjs` | Magnitude computed over a phase's target set, used by buffs like De Sterrennacht |
| `module/data/misc.mjs` | `EffectData` schema: the instance data (magnitude, duration, visibility, source) |
| `packs/_source/effects/*.yml` | Effect definitions: authored YAML, compiled into compendium |
| `docs/A-effect-catalogue.md` | Appendix A — reference table of all 157+ definitions and their mechanics |

## How it works

### Registry load and query

The registry is a frozen `Map` populated from compendium documents at setup. `load(documents)` walks the array, filters to entries bearing a `polarity` (which distinguishes effects from class-skill templates in the same pack), and constructs a `def` object from the `system` data (`module/rules/registry.mjs:23-82`):

```
id, name, img, polarity, volatility, valence, stacking, baseChance,
severity, preventsAction, families, suppressesOtherEffects,
defaultMagnitude, defaultDuration, unremovable, allySelfBypassesResistance,
maxStacks, blocks, blockedBy, replaces, periodic, terminal, uses,
absorbs, onRemove, rules, coveredByDebuffImmune, bypassesImmunity
```

Query methods are pure and synchronous: `get(id)` returns the `def` or `null`, `has(id)` returns boolean, `all()` returns the value list, `size` returns the count. A `validate()` call checks that `blocks`, `blockedBy`, `replaces` fields reference only known ids — run in dev mode at setup (`module/rules/registry.mjs:120-137`). It reports both errors (dangling references) and warnings (unreciprocated `blockedBy` edges).

### Families and snapshots

`familiesOf(def)` reads the declared array from a definition. `familiesPresent(effectIds, registry)` asks: given a list of active, unsuppressed effect ids, which families do they put the unit in? It walks each id, gathers families from the registry, and dedupes by insertion order (`module/rules/effects/families.mjs:41-49`).

A **suppressed** instance does not count: a Stun that is not stunning anybody is not binding them either (`module/rules/effects/families.mjs:30-32`). `unitHasFamily(unit, family, registry)` reads the projected `effectFamilies` if the snapshot has one — computed once in `snapshotUnit` and cached (`module/rules/snapshot.mjs:347`) — or falls back to deriving it from live ids if given a bare unit with no snapshot.

### Taxonomy axes

**Polarity** is one of three values (`module/data/misc.mjs:35`; see `docs/A-effect-catalogue.md` Pol column):
- `buff` — grants advantage
- `debuff` — imposes disadvantage
- `status` — neither, e.g. a countdown or a mental state

**Volatility** describes how the effect relates to damage and control (`module/rules/registry.mjs:36`; Appendix A Vol column):
- `nonVolatile` — does not remove on damage (e.g., `Atk Up`)
- `volatile` — removes on damage (e.g., `Burn`, `Stun`)
- `mental` — classified as a mental debuff, subject to mental-debuff-immune (`packs/_source/effects/charm.yml:21`)
- `terminal` — a lethal-class effect (Instakill, Death, Erase)

**Valence** captures the intent of application (`module/rules/registry.mjs:37`; Appendix A Val column):
- `offensive` — applied to enemies (e.g., `Atk Up` on self is offensive)
- `defensive` — applied to allies (e.g., `Def Up`)
- `neither` — no clear attack/defend axis

**Stacking** is the conflict rule when a unit already carries an effect (`module/rules/registry.mjs:38`; Appendix A Stack column):
- `noneNoRefresh` — a second instance is refused
- `noneRefresh` — a second instance resets the duration, does not add magnitude
- `magnitudeStacks` — instances add magnitudes (Atk Up stacks multiplicatively)
- `countStacks` — instances add uses (e.g., Endure holds a count)
- `highestOnly` — the instance with the highest magnitude is kept
- `stageStacks` — instances increase a stage counter
- `noneExtend` — a second instance extends the current duration without resetting

**Visibility** is per-instance, not per-definition (`module/data/misc.mjs:75`):
- `public` — visible on the board to everyone
- `ownerOnly` — visible to the unit's owner and GM only
- `gmOnly` — visible to GM only

## Invariants & edge cases

1. **An effect definition is authored once and immutable.** The registry is a `Map<string, object>` frozen after load and never mutated (`module/rules/registry.mjs:14-15`). Changing an effect's definition requires recompiling the compendium and restarting the world.

2. **Polarity is mandatory.** A document without a `polarity` field is not an effect; the same pack holds class-skill templates that lack it (`module/rules/registry.mjs:28-30`). The failure mode — a silent no-op — is the one worse than a crash because nothing reports it.

3. **Unknown effect ids fail the content build, not silently.** `validate-content.mjs` refuses an ability that names an unknown effect id before the compendium compiles (`docs/A-effect-catalogue.md:22-25`). A missing definition cannot reach a compendium and silently do nothing.

4. **Families are deduped on insertion order.** `familiesPresent` appends each family once; a unit carrying both `Stun` and `Petrify` is still one `Bind`, not two (`module/rules/effects/families.mjs:43-45`).

5. **Suppressed instances are not families.** A `Stun` marked as suppressed does not put the unit in `Bind` (`test/unit/effect-families.test.mjs:64-67`). This is the same reading the control subsystem takes: a Charm that is not charming is not controlling.

6. **Default magnitudes and durations flow from the definition to the instance.** A `Burn` inflicted without explicit magnitude reads `defaultMagnitude` from its definition; likewise for `defaultDuration`. The instance may override by providing an explicit value (`module/data/misc.mjs:42-49`).

7. **Visibility and attribution are instance-level.** An effect definition does not specify who sees it; each instance carries `visibility: "public"|"ownerOnly"|"gmOnly"` and `attributionHidden` (`module/data/misc.mjs:75-77`). The same `Burn` on different units may have different visibility.

8. **Reciprocal `blockedBy` is a warning, not an error.** A definition can list effects that prevent its application; the validator warns if the other effect does not list this one back, because unreciprocated gates are usually mistakes (`module/rules/registry.mjs:129-134`).

9. **`@magnitude` is not always a modifier's size, and every place it can stand has to be substituted.** A definition's rules name their instance with `"@magnitude"`, resolved by `resolveRuleValues` when the effect's rules are collected. It resolved `value` and `npValue` and nothing else — but Appendix A's on-hit riders put the magnitude on a **chance**: `Bleed Atk` is the one-line `effect: { id: bleed, chance: "@magnitude" }`, and `Terror` carries the same reference on the Stun in its `then` list. Both kept the literal string all the way to the scheduler, which gates on a number and refuses what it cannot read — so both effects were completely inert, and said nothing about it (Ch. 46 §46.4-AU). The substitution now reaches `chance` on a rule, on the effect an action applies, and on each entry of a `then` list. **Named carriers only**: a general deep walk would start rewriting predicates and effect ids that merely happen to contain the same text.

## Open questions

- **Answered, and it is a live defect — [#23](https://github.com/zarex97/FGT_FVTT_v2/issues/23).**
  The premise was wrong twice over. `noneExtend` **is** used, by four effects
  (`packs/_source/effects/range-up.yml`, `atk-up-trace.yml`, `suppression.yml`, `webbed.yml`), and
  its meaning **is** documented, at `packs/_source/effects/range-up.yml:11-14`: *"Does not stack, but
  duration is extended if reapplied."* What is missing is the behaviour. Measured live — `rangeUp`
  and `webbed` applied three times each held their expiry at **7** every time, identical to a
  `noneRefresh` control. `resolveStacking` returns `action: "extend"` correctly
  (`module/engine/effect-applier.mjs:607`), but `extend` is a *replacing* action
  (`module/engine/effect-applier.mjs:446`) and the replacement's expiry comes from the emitter
  (`module/engine/applier.mjs:351`), which computed it before knowing an instance existed. Nothing
  reads the existing instance's remaining time, so `extend` can only ever mean `now + duration` —
  which is refresh. **Today, authoring `noneExtend` gets you `noneRefresh`.**

- **Terminal effects skip the Prevention reaction but respect resistance.** They go through chance and `ApplicationChance` resistance checks like any other effect, but skip the Prevention Luck Check window and do not create a document; instead, they emit intents directly (`module/engine/effect-applier.mjs:173-174`, `module/engine/effect-applier.mjs:298-301`).

- **Resolved: the chapter references are remapped and now enforced.** The comment at `module/rules/registry.mjs:51` reads correctly today, and `tools/check-doc-refs.mjs` fails the build on any `docs/...` reference that dangles or points into `docs/plan-archive/` — across source, the authored corpus and the root configs.

- **The failure mode is silent.** An effect an ability tries to apply does not appear in the compendium, and the applier receives no definition for it. Today, the silent no-op is acceptable because `validate-content.mjs` catches the typo at build time. If a client ever gets an ability from the server whose effect id does not reach the registry, nothing surfaces the gap.
