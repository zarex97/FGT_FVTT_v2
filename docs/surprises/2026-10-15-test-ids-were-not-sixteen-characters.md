---
id: 2026-10-15-test-ids-were-not-sixteen-characters
found: test
kind: assumed-shape
status: fixed
reviewed: true
pattern: assumed-shape
---
**Expected:** an actor id of my own choosing (`anastasiaCaster00`, `jabberwockSummon1`) works as the world's actor id, as the 16-character ones the other tests use do.
**Actual:** casting a Skill that applies an effect failed with `Effect(atkUp): Foundry would not construct this ActiveEffect … sourceUnitId: must be a valid 16-character alphanumeric ID`. I read it first as the engine refusing Atk Up on a Skill and probed twice.
**Cause:** `test/unit/dioscuri-209-arena.test.mjs:68 @ 67e91e1` — both ids had 17 characters; the effect's `sourceUnitId` is a `DocumentIdField` and the world's loud prune checks it.
**Fix:** `test/unit/dioscuri-209-arena.test.mjs @ 67e91e1` — 16 characters. Count them.
