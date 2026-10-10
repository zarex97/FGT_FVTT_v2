---
id: 2026-10-10-faction-budget-swallowed-the-press
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** A slot the bar greys cannot be used. With "Servant attacks 2/2" spent, Quickfire is greyed with `Quickfire — Servant attacks exhausted (2/2)`, so clicking it does nothing but say so.
**Actual:** Clicking it opened targeting, which reported `✓ Legal — click to confirm`, and offered "Attack". Then the engine refused: `FGT | Cannot attack: Servant attacks exhausted (2/2)`. It looked like a press that silently did nothing. I first worked around it by advancing to the faction's next Turn, which skipped the defect instead of fixing it. The user called that out, #192. The 2/2 itself was honest: my staging `resetTurn` had let Nemo attack twice.
**Cause:** `templates/hud/action-bar.hbs:35 @ a238438` greys a slot with a class only, and `module/apps/hud/action-bar.mjs:380 @ a238438` `onUseSlot` never asked. The gate and the display agreed, and the click was a third reader that read neither.
**Fix:** `module/apps/hud/action-bar.mjs:383 @ uncommitted` refuses a `fgt-slot--disabled` slot first, warning with its tooltip. Live, the click showed "Quickfire — Servant attacks exhausted (2/2)" and stayed on the Token layer. `test/unit/action-bar-budget.test.mjs` reads the guard.
