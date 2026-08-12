# 39 — Migration and Versioning

A tactical match can run for weeks of real time. A system update mid-match must not corrupt it.
This chapter specifies schema versioning, data migration, and the rule-version pinning that
protects games in progress.

---

## 39.1 Three independent version axes

| Axis | Governs | Stored on |
|---|---|---|
| **System version** | The code | `system.json` |
| **Schema version** | The shape of persisted data | `world.flags.fgt.schemaVersion` |
| **Rule version** | The behaviour of the rules | `Combat.system.ruleVersion` |

They move independently. A bug fix bumps the system version only. A new field bumps the schema
version. A corrected damage-stage ordering bumps the rule version.

---

## 39.2 Schema migration

Standard Foundry practice, with one addition: migrations are **pure functions over source data**,
so they are unit-testable without a world.

```js
export const MIGRATIONS = [
  {
    to: 2,
    description: "Split parameters into base/granted",
    actor: (source) => {
      if (source.system?.parameters && !source.system.parameters.base) {
        source.system.parameters = {
          base: source.system.parameters,
          granted: { str: 0, end: 0, agi: 0, mag: 0, luc: 0 },
        };
      }
      return source;
    },
  },
  {
    to: 3,
    description: "Effects carry absolute expiry instead of remaining ticks",
    effect: (source, ctx) => {
      if (source.system?.duration?.remaining !== undefined) {
        source.system.duration.expiryTurn = ctx.globalTurn + source.system.duration.remaining;
        delete source.system.duration.remaining;
      }
      return source;
    },
  },
];
```

Each migration declares handlers per document type. The runner applies them in order, from the
world's current schema version to the code's, with a progress bar and a full log.

### The pre-migration backup

**DECISION.** Before any migration, export the world's F/GT documents to a timestamped JSON file
in the world directory. Non-negotiable. Migrations are the highest-risk operation the system
performs and the cost of a backup is a few hundred kilobytes.

### Compendium migration

Compendium packs are rebuilt from YAML (Ch. 37), so they never need migrating — a system update
ships new packs. But **world copies** of compendium documents (an imported Servant that a GM
edited) do need migrating, and they are the common case.

The migration runner therefore covers: world actors, world items, all embedded documents, scenes
(tokens, regions), the combat document, and any unlocked world compendia.

---

## 39.3 Rule version pinning

The harder problem. Consider: a match is in progress, and version 1.3 corrects the ordering of
damage stages 12 and 14. Existing effects were applied under the old ordering. Applying the new
ordering mid-match changes outcomes and may invalidate player decisions.

**DECISION.** A `Combat` document records the `ruleVersion` it started under, and **rule
behaviour is pinned to it for the life of the match**.

```js
export const RULE_VERSIONS = {
  1: { damageStageOrder: ORDER_V1, tickRounding: FLOOR_WITH_OVERRIDES, /* … */ },
  2: { damageStageOrder: ORDER_V2, tickRounding: FLOOR_WITH_OVERRIDES, /* … */ },
};

function rulesFor(combat) {
  return RULE_VERSIONS[combat?.system.ruleVersion ?? CURRENT_RULE_VERSION];
}
```

The rules layer receives its behaviour configuration from the snapshot, which carries the
version. So the pipeline is the same code with different parameters, not a fork.

### What this costs

Maintaining N rule versions forever is unsustainable. Mitigations:

1. **Rule versions are rare.** Only *behaviour* changes bump it, and most of those are bug fixes
   where the old behaviour was simply wrong.
2. **Bug fixes get a choice.** On loading a match pinned to an older rule version, the GM is
   offered an upgrade with a description of what changes:

   ```
   This match was started under rule version 1.
   Version 2 corrects: Damage Cut was being applied before Block instead of after,
   producing slightly low damage against Blocking defenders.

   [ Keep version 1 (safe — no outcomes change) ]
   [ Upgrade to version 2 (recommended for new matches) ]
   ```

3. **Old versions are retired.** After two minor releases, a rule version is dropped; matches
   still pinned to it are upgraded with a warning. Practically, no match survives that long.

---

## 39.4 What is *not* pinned

Distinguishing a rule change from a bug fix matters:

| Change | Pinned? |
|---|---|
| Damage stage reordering | Yes — outcomes change |
| A corrected rank comparison | Yes |
| An effect's magnitude corrected to match the source | Yes |
| A crash fix | No |
| A UI improvement | No |
| A performance optimization | No |
| A new rule element key | No — additive |
| A new Servant | No — additive |
| A validation warning added | No |

The test: *could this change a number or an outcome in an existing match?* If yes, it is pinned.

---

## 39.5 The dice registry and versioning

The placeholder dice formulas (Ch. 14 §14.4) are a special case. When the real `Attack+` /
`Attack−` / `Block` tables arrive from the game's author, every damage number in the game
changes.

**DECISION.** Supplying the real tables bumps the **rule version**, and existing matches keep
their placeholders unless the GM upgrades. Anything else would silently rewrite the balance of
a match in progress.

The GM settings panel shows which entries are still placeholders, and a world using any
placeholder shows a persistent (dismissible) banner. Nobody should discover after twenty rounds
that their damage numbers were provisional.

---

## 39.6 Content versioning

Content is versioned separately from code, because a Servant's balance may be tuned without a
system release.

```yaml
# packs/_source/servants/karna.yml
schema: 1
contentVersion: 3
changelog:
  - { version: 2, change: "Corrected Brahmastra to 4x/2x per the source (was 3x/2x)" }
  - { version: 3, change: "Kavacha and Kundala now survives NP Seal (Ch. 41 Q9 resolved)" }
```

A world holding an edited copy of a compendium Servant is *not* auto-updated — the GM's edits
win. Instead the compendium browser shows a badge when a world copy is behind, with a diff view
and an explicit "update" action.

This is the right default: a GM who homebrewed Karna should not lose it to a content update.

---

## 39.7 Foundry version compatibility

```json
"compatibility": { "minimum": "14", "verified": "14.364" }
```

**DECISION.** No backward compatibility with v13 or earlier. The system uses v14-only APIs
throughout — grid shape generators (Ch. 28), Scene Levels (Ch. 20), typed Combatants (Ch. 25),
`_preUpdateMovement` (Ch. 23) — and shimming them would compromise the architecture for users
who can simply update Foundry.

Forward compatibility is handled by testing against each Foundry release candidate and bumping
`verified`. The APIs we depend on most heavily are listed explicitly so a breaking change is
easy to locate:

| API | Used by | Fragility |
|---|---|---|
| `grid.get*` shape generators | Targeting | Low — new and stable |
| `Scene.levels` | Platforms | **Medium** — new in v14, may evolve |
| `TokenDocument._preUpdateMovement` | Movement validation | Low |
| `Combatant` subtypes | Turn system | Low |
| `RegionDocument#tokens` | Zones | Low |
| `TypeDataModel` lifecycle | Everything | Low — long-stable |
| `ApplicationV2` parts | All UI | Low |

Scene Levels is the one to watch, and Ch. 20's design keeps the platform abstraction thin enough
that an alternative implementation (elevation bands plus custom visibility) is a contained
change.

---

## 39.8 Deprecation policy

| Kind | Policy |
|---|---|
| Rule element key | Deprecated for two minor versions with a console warning naming the content document, then removed |
| Content field | Migrated automatically; the old form warns for two versions |
| Public API method | Deprecated for two minor versions |
| Effect id | Never removed — an alias is added instead, because ids appear in saved matches |

The last one is a hard rule. An effect id in a live match's `ActiveEffect` cannot be renamed
without a migration, and migrations of in-flight matches are exactly what we are trying to
avoid. Aliases are cheap; renames are not.

---

## 39.9 The upgrade checklist

Run on every release:

```
1. Bump system.json version
2. If any persisted shape changed → add a migration, bump schemaVersion
3. If any outcome could change → add a RULE_VERSIONS entry, bump ruleVersion
4. Rebuild packs; verify deterministic ids are unchanged for unrenamed content
5. Run the full test suite including performance budgets
6. Run the twelve-Servant playtest scenario
7. Test migration from the previous release against a saved world snapshot
8. Update the changelog with a "does this affect matches in progress?" line per entry
9. Tag and release
```

Step 7 is the one teams skip and regret. A saved world from the previous release is kept in the
repository (as a fixture, not a live world) precisely so migration can be tested in CI.

---

## 39.10 Summary of decisions

| # | Decision |
|---|---|
| D39.1 | Three independent version axes: system, schema, rule. |
| D39.2 | Migrations are pure functions over source data, unit-testable without a world. |
| D39.3 | A pre-migration backup export is mandatory. |
| D39.4 | Rule behaviour is pinned per-match; upgrades are opt-in with a described diff. |
| D39.5 | Supplying the real dice tables bumps the rule version. |
| D39.6 | World copies of content are never auto-updated; the GM is shown a diff and chooses. |
| D39.7 | No compatibility below Foundry v14; the fragile-API list is maintained explicitly. |
| D39.8 | Effect ids are never renamed, only aliased. |
| D39.9 | Migration from the previous release is tested in CI against a saved world fixture. |

---

**Next:** [40 — Roadmap](40-roadmap.md)
