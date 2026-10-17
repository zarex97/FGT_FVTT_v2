---
id: 2026-10-17-curse-halving-gated-on-weakness
found: live press
kind: sheet-binds-only-its-owner
status: fixed
reviewed: true
pattern: sheet-binds-only-its-owner
---
**Expected:** Channel Marker Soul's *"Curse Damage taken is halved"*: Stage 5 deals Van Gogh 63 where it deals Medea 125.
**Actual:** Both took 125 at the end of Faction 1's Turn (Van Gogh 1100 -> 975, Medea 750 -> 625), the amplifier projected on her board unit (`factor: 0.5`, "Channel Marker Soul").
**Cause:** `module/engine/scheduler.mjs:2228 @ 8d1c012f` — `amplify` multiplied a named amplifier only `if (isWeakTo(unit, defId))`: Sikera Ušum clause e's *"Units ... who are weak to Poison"*, written into the one reader every holder shares. Van Gogh is not "weak to" Curse, so her halving never applied.
**Fix:** `module/engine/scheduler.mjs` `amplify` @ 05211bb1 — the gate is the amplifier's own `ifWeak`, authored on Sikera Ušum's interior rule alone (`semiramis-sikera-usum.yml`); `rules/elements.mjs` carries it.
