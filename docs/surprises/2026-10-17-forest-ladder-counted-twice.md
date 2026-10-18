---
id: 2026-10-17-forest-ladder-counted-twice
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** An escape's Luck Check carries its MAG Rank term once, and only the escape carries it: *"If the Unit is within its Home Base: −3 … MAG Rank EX: −3, A: −2…"* are the escape's modifiers.
**Actual:** Arturia's escape read *"rolled 8 (MAG A −2, namelessForest −2) = 4 vs Luck 20"*: the ladder twice.
**Cause:** `packs/_source/effects/nameless-forest.yml @ eebbb988` authored the ladder and the Home Base term as `check: luck` CheckModifiers on the marker, and `module/engine/nameless-forest.mjs#attemptForestEscape` added `escapeModifiers` on top of `checkPlan`. The marker's modifiers also reached every other Luck Check a caught Unit made.
**Fix:** `packs/_source/effects/nameless-forest.yml @ uncommitted` carries no CheckModifier; `escapeModifiers` is the one reader. `nursery-forest.test.mjs` F10–F11 read the ladder through it; `nursery-247-rulings.test.mjs` checks a caught Unit's other Luck Checks.
