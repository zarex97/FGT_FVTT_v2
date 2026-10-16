---
id: 2026-10-15-second-twin-seated-with-nothing
found: test
kind: assumed-shape
status: fixed
reviewed: true
pattern: assumed-shape
---
**Expected:** a war built by the setup wizard seats both Dioscuri: each on its side, under the slot's Master, with a token on the board. The audit's plan took the `commitSummon` summon-together path as "the pair arrives".
**Actual:** only the drawn Servant was seated. Calling `deployTokens` with the drawn twin, its Master and the partner placed two tokens, not three (`expected [ 'masterA', 'pollux' ] to deeply equal [ 'castor', 'masterA', 'pollux' ]`); the partner `commitSummon` brings has no Master (so Free) and no faction, and nothing wrote either.
**Cause:** `module/engine/war-setup.mjs:371 @ 7231295` — `commitWar` holds one Servant per container: `commitSummon(prepared)` returns only the drawn actor, and the faction, `classContainer`, `setContract` (`:395`) and `deployTokens` (`:405`) all act on `servants[i]` alone. `commitSummon` summons the partner with no Master (`engine/summon.mjs:255`) and leaves it for the caller. The Dioscuri are the only `summonTogether` group, so no other Servant showed it, and `commitWar` has no test.
**Fix:** `module/engine/war-setup.mjs:539 @ 3ac0ea8` — `seatPartners` writes the slot's faction and container and a Contract to the slot's Master for every `memberIds` partner, and `deployTokens` places each partner on the free panel nearest its twin before the Master. `test/unit/dioscuri-209-rulings.test.mjs` (the two "§46.4-D3" describes) fails with either removed.
