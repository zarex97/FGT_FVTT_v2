---
id: 2026-10-18-refused-attack-revealed-the-ghost
found: live press
kind: hidden-timing-rule
status: fixed
reviewed: false
---
**Expected:** *"…until Danzō Attacks, and her survived existence is revealed … at this point"* (#249 reading 18): an Attack she makes reveals her; one refused before it is made does not.
**Actual:** Player1 pressed Yuugao on Asterios out of Range: refused *"Berserker is out of Range (3)."*, and the public card *"Assassin was never defeated: she lives."* went out with the marker removed.
**Cause:** `module/engine/attack.mjs#resolveAttack @ dfcaa421` — the reveal ran first, so Range would be measured from the panel she steps to. Range is not a preflight gate: `resolveTargets` refuses it after, once she was already revealed.
**Fix:** `module/engine/attack.mjs#resolveAttack @ dfcaa421` — the gates and the aim run first. A legal Attack then reveals her, and is gated and aimed again from where she stands.
