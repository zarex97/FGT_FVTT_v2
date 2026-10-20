---
id: 2026-10-19-dimension-clock-ran-on-another-war
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** with several Wars running at once (`ddf335e4`), a Storm Border submerged in War 178 at its tick 4 surfaces on War 178's clock: forced only after 2◈ of War 178's Turns.
**Actual:** while I advanced War 134 for #134, the chat log read *"The Storm Border has been in Imaginary Numbers Space for almost 2◈ Turns"* and then *"The Storm Border surfaces at (6, 6). 0 Unit(s) are back on the board."* War 178 stood at tick 5. Nemo was left on the dimension's Level, its platform gone.
**Cause:** `module/engine/dimension.mjs:829 @ 856a58ff` — `runDimensionClock(tick)` read every open dimension in the world against the tick of whichever War's Turn changed, and `warRule("turnsPerRound")` against the viewed War. The War Rules move made the War a parameter of every rule; this reader was never handed one.
**Fix:** `module/engine/dimension.mjs:836 @ a87324ca` — the War whose Turn changed is passed in, and only dimensions whose Level is on that War's scene are run, on that War's rules. Pressed live 2026-10-19: War 178's Storm Border submerged at its tick 5; War 134 then ran seven Turns (8 → 15) and the dimension stayed down, no card.
