---
id: 2026-10-14-shared-die-rider-unfiled
found: live press
kind: producer-without-consumer
status: fixed
reviewed: true
pattern: producer-without-consumer
---
**Expected:** After the Activation, Karna's Normal Attack shows its *"50% chance of inflicting Burn"* roll on the card, as the 25% roll showed before it.
**Actual:** His Normal Attack on Kingprotea landed Burn (applied tick 11) and the card had no Rolls entry and no Burn line.
**Cause:** `module/engine/attack.mjs:2439 @ 7333e08` — `fireDamageDealt` skipped any spec whose chance key was already rolled; Mana Burst's 25% and Vasavi's 50% are both `chance:<id>:ApplyEffect:burn`, so the second, the only one whose clause applied, was never filed.
**Fix:** `module/engine/attack.mjs:2439 @ 95b91ea` — one die per key, every spec filed when its clause applies; arena test reads "against 50%".
