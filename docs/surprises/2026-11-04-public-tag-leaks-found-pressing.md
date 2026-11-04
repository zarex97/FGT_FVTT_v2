---
id: 2026-11-04-public-tag-leaks-found-pressing
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: false
---
**Expected:** With #387 in, its guard green and its tests passing, no card the table reads holds an ability's or a concealed Unit's real name.
**Actual:** Player1's Pixie Finger card read *"AlterEgo: Airavata King Size…: Cooldown 0 → 1"*, and a stored attack card read *"YOU Kazuradrop YOU Van Gogh"* on Player1's screen until its re-render.
**Cause:** `module/engine/skill-use.mjs:1198 @ cb28c87d` — `unitActor(id)?.items?.get(id)?.name`, a read in one chain the guard's holder list could not see. `module/apps/chat/cards.mjs:148 @ cb28c87d` — the context that re-renders per viewer also built the stored card, on the GM's client, where the GM reads the truth.
**Fix:** `tools/check-public-names.mjs @ 4941e347` — the guard reads that chain, and six sites moved to `shownAbility`. `module/apps/chat/cards.mjs @ 4941e347` — `forViewer`, set only where the card is filled on the viewer's client.
