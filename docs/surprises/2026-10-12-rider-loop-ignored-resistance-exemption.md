---
id: 2026-10-12-rider-loop-ignored-resistance-exemption
found: test
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** Kiritsugu's Mark, authored `ignoresResistanceFrom: [debuffResUp]` on its rider spec, skips Debuff Res Up when it lands; adding the same key to Zabaniya's rider phase for #199 reading 11 would skip Magic Resistance.
**Actual:** the post-damage rider loop never passed `ignoresResistanceFrom` to `applyEffect`. Only the check path did. `kiritsugu.test.mjs` asserted the authored key and nothing that read it, so the Mark has met Debuff Res Up since it was authored.
**Cause:** `module/engine/attack.mjs:4969 @ a0e227d` — the rider loop built `ctx` without the key; `applyDeclaredEffects` (the check path) was its only reader.
**Fix:** `module/engine/attack.mjs:5036 @ 50a76fe` — the rider loop reads it from the phase and from the one effect; `test/unit/serenity-199.test.mjs` proves the chance moves.
