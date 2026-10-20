---
id: 2026-10-19-luck-decline-reason-never-printed
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** the Lucky Evasion rung declined on Intermediate tells the player why, as its comment says: *"a player who expected the option is owed the sentence saying why it is gone."* And a Contest pressed on Intermediate rolls nothing.
**Actual:** the reason `luckChecksRemoved` was written into the ladder's history and nothing read it: the card showed only `s24_luckyEvasion → declined` inside the collapsed Ladder. And the `contest` answer path rolled Luck and charged 1 Luck whatever the difficulty, so the only guard was a timeout declining it first.
**Cause:** `module/engine/attack.mjs:1929 @ 856a58ff` — the `contest` branch called `rollLuck` with no gate; `module/apps/chat/cards.mjs:137 @ 856a58ff` — the card context mapped history without its `detail.reason`.
**Fix:** `module/apps/chat/cards.mjs:139 @ a87324ca` — `luckClosed` lines on the card from the history's reasons, printed by `templates/chat/attack.hbs`; `module/engine/attack.mjs:1929 @ a87324ca` — the Contest press asks `closedLuckRung` first.
