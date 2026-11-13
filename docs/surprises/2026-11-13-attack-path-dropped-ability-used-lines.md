---
id: 2026-11-13-attack-path-dropped-ability-used-lines
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** What an NP's `abilityUsed` handlers do is said on a card, as the Skill path says it.
**Actual:** Arondight expending For Someone's Glory wrote a `cardLine` to the War log and no card printed it.
**Cause:** `module/engine/attack.mjs:1980 @ 6315e1e`: the attack path called `fireAbilityUsed` and dropped the rows it returned; `useSkill` posts them.
**Fix:** `module/engine/attack.mjs:1984 @ 0d3920a`: the rows go on a card through `postCard`; test intel-405 (source marker) and pressed live.
