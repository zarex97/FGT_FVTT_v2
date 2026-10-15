---
id: 2026-10-14-refusal-named-the-fallen
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** Brahmastra Kundala aimed over the Master of Rider of Faction 2 and not the Arjuna stand-in is refused, and the line says the area must hold the rival.
**Actual:** "Refused: No legal targets: Kingprotea is defeated (and 3 more excluded)." The rival reason sat fourth in the list.
**Cause:** `module/rules/targeting/resolve.mjs:666 @ 7333e08` — the summary names the first exclusion, and the fallen come first in board order. The new reason also read badly after "is".
**Fix:** `module/rules/targeting/resolve.mjs:666 @ 95b91ea` — defeated exclusions sort last; the reason reads "in an area without the rival this attacker is bound to". Test in `karna-206-rulings.test.mjs`.
