---
id: 2026-10-26-luck-ruling-hid-default-difficulty
found: test
kind: claim-without-reading-the-path
status: fixed
reviewed: true
pattern: claim-without-reading-the-path
---
**Expected:** Q27 of Cú Chulainn's grill (#339) put "where the War removes Luck Checks" to the user as an edge case:
Beginner and Intermediate, a pass, *"(a), for both NPs"*. Ruled 2026-10-26 as ruling 28.
**Actual:** Built, five Gate of Skye tests failed at once: `"A scripted die was never rolled: d20 = 1."` The War
Rule `difficulty` defaults to **Intermediate**, so in every War left at its default Gate of Skye's Death and Barbed
Spear's Instakill now never land. The question never said the default was one of the two.
**Cause:** `module/domain/war-rules.mjs:73 @ cc1d8e41` — `initial: "intermediate"`. The pick was written from
`difficulty.mjs#luckChecksApply` alone, without reading the rule's default.
**Fix:** Put back to the user, who replaced ruling 28 with #339 ruling 34: an ability's own Luck Check rolls on every
difficulty. `module/engine/attack.mjs#runCheckPhase @ d3452f94` asks no difficulty; the Gate tests' Expert was
reverted.
