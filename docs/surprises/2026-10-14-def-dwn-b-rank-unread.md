---
id: 2026-10-14-def-dwn-b-rank-unread
found: test
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** Karna's `rank: B` makes his Def Dwn the catalogue's Def Dwn (B).
**Actual:** Nothing reads `rank` on an entry. Karna and Semiramis both landed plain `defDwn`; `Def Dwn (B)` existed only as a catalogue row.
**Cause:** `packs/_source/abilities/karna-brahmastra-kundala.yml:84 @ a436802` — an authored key with no reader, and no `defDwnB` definition.
**Fix:** `packs/_source/effects/def-dwn-b.yml:1 @ 1f1b099` — a real `defDwnB`; both abilities use it, and the one-door guard refuses an entry key outside `ENTRY_KEYS`.
