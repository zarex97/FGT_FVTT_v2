---
id: 2026-10-17-jabberwock-guard-never-authored
found: retraction
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** *"Enemy Units cannot Attack Nursery or her Master if the Jabberwock are directly next to them"*, as the Trump Soldiers' identical sentence does.
**Actual:** Read for the Clause list: the Trump Soldier carries the `TargetabilityModifier`; the Jabberwock's statblock carries none. Part 2's inventory marked it FREE (J17).
**Cause:** `packs/_source/summons/jabberwock.yml @ eebbb988`: the clause was planned and never authored; the fix that converted the guards (`TargetingModifier` to `TargetabilityModifier`) walked the summons that had one.
**Fix:** `packs/_source/summons/jabberwock.yml @ 7755ebb4` carries the Trump Soldier's guard word for word.
