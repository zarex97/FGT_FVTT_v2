---
id: 2026-10-11-counter-shares-parent-fanout
found: live press
kind: role-keyed-on-type
status: fixed
reviewed: false
---
**Expected:** Raikou's Mana Burst as a Counter applies "Dodge to herself for ⅓◈ Turns", as it does from her bar.
**Actual:** The Counter hit Mannanán for BA 350 with "Shock (rolled 36 vs 80%)". Raikou carried no Dodge.
**Cause:** `module/engine/attack.mjs:1958 @ f15a3d1` — `siblingMessages` grouped by `groupId` alone, and a Counter shares its parent's. `isFirstOfGroup` took Mannanán's attack on Raikou as the first of the counter's group, so the counter's once-per-Phase self rider never paid. Cover and window picks read the same list.
**Fix:** `module/engine/attack.mjs:1958 @ b9884b9` — siblings share the group and the attacker.
