---
id: 2026-10-20-rider-die-line-ignored-the-bonus
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** a rider's die on the card says whether the rider landed: Rock Snowball's 10% Bleed, raised to 15% by Anastasia's Fae Contract.
**Actual:** card RowTv85ag37aaT1B, die 20: *"Archer: Rock Snowball on Rider 1d100 → 20 against 10%: missed"* beside *"Bleed: resisted, rolled 20 vs 15%"*. Two verdicts for one die; a die of 11 to 15 would have read "missed" on a card that applied the Bleed.
**Cause:** `module/engine/attack.mjs:3186 @ 50eae993` — `chanceRecords` judged the die against the action's raw `chance`, while the effect's chance is decided where it lands, with the inflicter's bonus and the target's resistance (`scheduler.mjs#chanceGatePasses`, #191). The Soaked die was also labelled by its definition id, *"soaked"*.
**Fix:** `module/engine/attack.mjs#chanceRecords @ 0552085c` — the landing's own row is the verdict: *"against 10%: hit (rolled 12 vs 15%)"*, pressed live; an effect's handler is named by the effect's display name.
