# 07 — Actor and Item schemas

## What it is

A document schema is a shape contract: it declares which fields a document may hold, what type each field is, and what constraints apply. Foundry provides `TypeDataModel`, a subclass that binds a schema to a document type and validates writes against it, and this system uses it to express the constraints of F/GT's domain.

There are five actor kinds — **Servants, Masters, Civilians, Summons, Platforms, and Structures** — and five item kinds that all Servants and Summons carry — **Abilities, Noble Phantasms, Command Spells, Master Essences, and Equipment**. Every kind has a schema that declares its own fields and composes shared fragments. Two custom DataFields validate domain meaning: `RankField` parses rank strings and rejects invalids at write time (`module/data/fields.mjs:20-36`), and `TickField` parses duration notation (`module/data/fields.mjs:44-60`). A `resourceField()` factory generates `{value, max}` pairs for Health, Agility and Luck (`module/data/fields.mjs:69-74`).

The biggest challenge the schema faces is **closure under extension**: content validators check rule element shapes at build time, so a rigid schema here would reject a rule element or field shape a module introduces. The answer is `ObjectField` — held untyped — which abandons static shape checking in favour of runtime validator clearance, a trade the system makes because content must be open and schemas cannot enumerate futures.

## Where it lives

| File | Role |
|---|---|
| `module/data/fields.mjs` | `RankField`, `TickField`, `resourceField()` — domain-specific validators |
| `module/data/actor/_shared.mjs` | `unitCommon()`, `combatantCommon()` — fields every or most unit kinds share |
| `module/data/actor/servant.mjs` | `ServantData` — the player unit with parameters and two base attacks |
| `module/data/actor/master.mjs` | `MasterData` — the player avatar with Command Spells |
| `module/data/actor/simple.mjs` | `CivilianData`, `SummonData`, `PlatformData`, `StructureData` — non-player units |
| `module/data/item/ability.mjs` | `abilityCommon()` helper, and `AbilityData`, `NoblePhantasmData`, `CommandSpellData`, `MasterEssenceData`, `EquipmentData` |
| `module/data/misc.mjs` | `EffectData`, `MatchData`, `PlayerCombatantData` — effects, matches, and turn order |
| `module/data/regions.mjs` | `TerrainBehavior`, `HomeBaseBehavior`, `NPFieldBehavior`, `PlatformBehavior` — board geometry |
| `system.json` | `documentTypes` table declares all types and assigns `htmlFields` per type |

## How it works

### Structure and composition

Every actor spreads `unitCommon()` (`module/data/actor/_shared.mjs:15`), which holds fields every unit shares: `factionId`, the three resource pools, movement range, facing, position, and rules applied directly to the unit. Servants and Summons additionally spread `combatantCommon()` (`module/data/actor/_shared.mjs:218`), which adds parameters, base attack, turn state, and sustenance.

`ServantData` (`module/data/actor/servant.mjs:15`) spreads both helpers and adds Servant-specific fields: `trueName`, `servantClasses`, `footprint`, `contract`, `masterId` and `variant` for summon branches (`module/data/actor/servant.mjs:36-90`). `MasterData` (`module/data/actor/master.mjs:10`) spreads `unitCommon()` but only three fields from `combatantCommon()` — `turnState`, `roundState`, and `baseAttack` (`module/data/actor/master.mjs:35`) — because a Master has no parameters or Sustainability. The simple types (`module/data/actor/simple.mjs:12-334`) each spread `unitCommon()` minimally: `CivilianData` is one line (`module/data/actor/simple.mjs:12-16`), `SummonData` adds expiry, relative stats, and suppressed scopes (`module/data/actor/simple.mjs:18-91`), `PlatformData` adds terrain and occupation rules (`module/data/actor/simple.mjs:93-271`), and `StructureData` adds visibility and destruction rules (`module/data/actor/simple.mjs:273-334`).

Every ability-shaped item spreads `abilityCommon()` (`module/data/item/ability.mjs:11-391`), which holds 70 fields common to Abilities, Noble Phantasms and Command Spells: targeting, phases, rule elements, cooldown shape, usage restrictions, and the three custom TickField validators. `AbilityData` and `NoblePhantasmData` both inherit this (`module/data/item/ability.mjs:393-534` and `537-593`); `CommandSpellData`, `MasterEssenceData` and `EquipmentData` each declare their own shape separately.

### Untyped fields

The schema keeps seven kinds of field untyped because a rigid shape would reject content a module contributes:

1. **Rule elements** (`rules`, `passiveRules`, `activeRules`) — checked at build time by the content validator, so runtime strictness gains nothing (`module/data/actor/_shared.mjs:36-38`, `module/data/item/ability.mjs:117-119`).
2. **Targeting** — the shape is too open for one schema to enumerate (`module/data/item/ability.mjs:115`).
3. **Phases** — each ability picks what phases it uses, which rules generate the rest (`module/data/item/ability.mjs:116`).
4. **Relative stats** (`inherit`) — Summons and Platforms state stats relative to their summoner, a shape a third module's summon type could extend (`module/data/actor/simple.mjs:36`, `module/data/actor/simple.mjs:152`).
5. **Pocket dimensions** — only Nemo's Storm Border has one, and declaring a rigid `dimension` schema would constrain future platforms (`module/data/actor/simple.mjs:126`).
6. **Field membership and geometry** — a bounded field defines its own axes, and the schema stays untyped so an NPField added by a module uses the same code (`module/data/regions.mjs:94-99`).

### Derived data and validation

The schema declares fields only. How a value is **computed** — derived from parameters via an END table, or from an effect list — is not the schema's job; that lives in `prepareBaseData` and `prepareDerivedData`. How a value is **validated** — that a rank string parses, that a duration is readable — is the schema's job, and it uses `RankField` and `TickField` to validate at write time (`module/data/fields.mjs:20-60`). A bad write throws immediately with a useful message, rather than corrupting a game far downstream.

## Invariants & edge cases

1. **`null` and zero are not the same for Health.** Health `max` is `null` when the unit is intrinsically undamageable, and `value: null` when defeated. A Master refills to 250 if `max` is null or zero; a zero-max Servant comes back at 1 before revival bonuses land (`module/data/actor/_shared.mjs:40-52`, `module/data/actor/master.mjs:74-79`).

2. **A `DataModel` silently discards a write to a path it does not declare.** No error is raised: the write appears to succeed, the read returns `undefined`, and a `?? 0` downstream turns it into a plausible wrong answer. This is the single most consequential property of this schema set — see *Traps and anti-patterns*.

3. **`foundry: null` does not mean optional.** `nullable: true` makes a field hold null as a legal value. `required: false` makes it absent. The difference matters: an effect holding `visibility: "public"` is not readable as `"ownerOnly"`, so `nullable` here means "present but unknown" (`module/data/misc.mjs:75`).

4. **`PlatformData.footprint` is `nullable: true` at the field level.** `null` means the platform has no board presence at all — Nemo's Storm Border while submerged. A non-nullable footprint would coerce that `null` into the 3×3 default and surface a submerged submarine (`module/data/actor/simple.mjs:111-114`).

## Traps and anti-patterns

**Adding a write path without declaring the schema field.** This is the trap this subsystem has
fallen into most often, and every instance was invisible until someone measured a live board. All
of the fields below are declared today; each was authored, written and read for a long time before
it was, which is why the schema files carry unusually long comments at their declaration sites.

| Field | Declared at | What its absence cost |
|---|---|---|
| `isMode`, `isAttackSkill`, `active`, `canAct`, `channel` | `module/data/item/ability.mjs:29-48`, `module/data/actor/_shared.mjs:424-432` | Toggling a mode did nothing; a damage buff on an Attack had nowhere to write |
| `baseHealth` | `module/data/actor/_shared.mjs:67` | Every Summon and Platform built from content loaded as `health: {value: 0, max: 0}` |
| `baseAttack` (Master) | `module/data/actor/_shared.mjs:224-227`, via `module/data/actor/master.mjs:35` | Every Master on every board attacked for `{str: 0, mag: 0}` |
| `itemCost`, `summonVariant`, `rules`, `itemHandling`, `aftermath` | `module/data/actor/servant.mjs:84`, `module/data/actor/_shared.mjs:106` and siblings | Authored YAML compiled into packs, then dropped on load — Summon inheritance, Semiramis's branch selection |

**Add the field to the schema in the same change as the write.** Nothing in Foundry will tell you
otherwise. The corpus validator is what catches this now (Chapter 40), and it exists because
review did not.

**Reading `nullable` as "optional".** `nullable: true` means the field may legally *hold* `null`;
`required: false` means it may be *absent*. They are different, and the difference decides whether
a missing value reads as "present but unknown" or as nothing at all
(`module/data/misc.mjs:75`). **Choose deliberately, and remember that `null` is frequently
load-bearing in this domain** — `health: null` means undamageable, not zero, and
`footprint: null` means a platform with no board presence at all
(`module/data/actor/simple.mjs:111-114`).

## Open questions

- **Why does `abilityCommon()` return an object rather than use class inheritance?** The answer is closure: `NoblePhantasmData` and `AbilityData` both use the same 70 fields but are separate classes. A factory function and spread operator beat a base class that every item would inherit from, which would bloat the type hierarchy. But the code never states this reasoning.

- **Confirmed live: untyped fields are validated at build time only.** A structurally nonsense rule —
  `{key: "NoSuchExecutorKind", nonsense: {deep: [1,2,3]}}` — was written into an item's `rules` bucket on a
  live world. It was accepted without complaint and stored back verbatim, unknown executor key and all.
  `npm run validate:content` is therefore the only thing standing between authored nonsense and the engine
  (Chapter 40), and it does not see a hand-edited world document. What the engine then does with an unknown
  key is Chapter 10's `unhandled` bucket.

- **Tested live, and the answer is the opposite of "silently keeps": it is discarded.** Writing
  `system.totallyUndeclaredField = 42` to a live actor left **no trace** — absent from the re-read, from
  `_source`, and from `toObject()` — while a declared write in the same test took normally. So there is no
  preserve-and-ignore behaviour to reason about and nothing to recover: an undeclared path is not stored at
  all. This is the sharp edge of the trap below, and it is why the corpus validator exists.

- **Relative stats have no schema constraint on which fields may be relative.** `inherit: {str: "summoner + 2"}` is valid by shape alone; whether `str` is legal for a Summon type is an authoring convention checked by the validator, not by the schema.
