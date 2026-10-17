---
id: 2026-10-16-follow-up-line-named-the-units
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** a line Bab-ilu's additional Normal Attack posts names its Units as the table knows them, as the
attack card under it does (*"Archer ⚔ Assassin"*, #230 §46.4-NV).
**Actual:** *"Bab-ilu: Key of the King's Law To Enshrine: Proto Gil makes an additional Normal Attack on Jack the
Ripper."*, and the offer to Player1 named *"Jack the Ripper"* too; the Enki lines read the actor's name the same way.
**Cause:** `module/engine/follow-up.mjs:126 @ 2e097ec` — the new lines read `actor.name`, a second reader of
"what this Unit is called in public" beside `publicIdentityOf`.
**Fix:** `module/engine/follow-up.mjs:99 @ 2e097ec`, `module/engine/schedule.mjs:41 @ 2e097ec` — both ask
`publicIdentityOf` and speak through `publicSpeakerFor`.
