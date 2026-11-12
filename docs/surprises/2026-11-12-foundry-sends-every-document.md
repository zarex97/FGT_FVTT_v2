---
id: 2026-11-12-foundry-sends-every-document
found: live press
kind: assumed-shape
status: wontfix
reviewed: true
pattern: assumed-shape
---
**Expected:** A player of another Faction cannot open, read or receive a Notebook, "by window, journal or socket" (ST.private).
**Actual:** Faction 2's Notebook journal (permission NONE) and its `intelState` flag sit in Player1's `game.journal`, as do 190 whispers not for him.
**Cause:** `module/engine/intel-store.mjs:22 @ 9225813` — Foundry delivers every world document and every message to every client; ownership gates display and writes only. The Clause promised what the platform cannot.
**Fix:** Open as a platform limit: the window, the journal sidebar and the socket refuse; a console reads it, as it reads every enemy actor. Reported to the user.
