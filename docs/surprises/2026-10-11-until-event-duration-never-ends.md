---
id: 2026-10-11-until-event-duration-never-ends
found: test
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** a duration authored `until <event>` ends when that event fires on its bearer. `parseTick` documents the form as "removed by an event", and Anastasia's Watermelon blinds her `until combatProcessEnd`.
**Actual:** nothing removed it. `resolveTicks` gives an `untilEvent` duration `INFINITE`, so the instance had no clock and no event reader. Anastasia's Blind would have lasted the rest of the match. Found while giving Mannanán's Crit Up a Combat-Phase length (#197 reading 3). The parser also lowercased the event name, so `combatPhaseEnd` could never have matched.
**Cause:** `module/domain/tick.mjs:230 @ 75ae578` — `untilEvent` resolves to `INFINITE`, and no module read the event back. `module/domain/tick.mjs:115 @ 75ae578` matched against the lowercased string.
**Fix:** `module/engine/effect-applier.mjs:288 @ 57c23ae` stamps `endsOn` on the instance. `EffectData` declares it, `io.createEffects` writes it, and the snapshot projects it. `module/engine/scheduler.mjs:494 @ 57c23ae` (`fireEvent`) removes the instance when its event fires. The parser keeps the event's case.
