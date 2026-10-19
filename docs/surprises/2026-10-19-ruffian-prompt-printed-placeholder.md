---
id: 2026-10-19-ruffian-prompt-printed-placeholder
found: live press
kind: producer-without-consumer
status: fixed
reviewed: false
---
**Expected:** Ruffian's offer reads as the card does: what each point of Agility buys.
**Actual:** Player1's dialog read "Yan Qing may spend up to 20 × Agility for +{total}% damage dealt this Combat Process." The card after it read right: "spends 7 × Agility: +35% damage dealt this Combat Process."
**Cause:** `module/engine/optional-costs.mjs#accepted @ cce1f438` — the label's `{total}` was filled only where the card is written; the prompt passed the raw label. The arena tests answered the dialog by its title and never read its text.
**Fix:** `module/engine/optional-costs.mjs#labelWith @ cce1f438` fills `{total}` for both: the prompt says one point's worth "per point spent" (`FGT.OptionalCost.PerUnit`), the card the total bought.
