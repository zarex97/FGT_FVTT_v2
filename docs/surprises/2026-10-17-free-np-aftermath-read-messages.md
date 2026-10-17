---
id: 2026-10-17-free-np-aftermath-read-messages
found: live press
kind: assumed-shape
status: fixed
reviewed: true
pattern: assumed-shape
---
**Expected:** the Free Normal Saber's Noble Phantasm resolves (537) and the Saber leaves the board as its
Combat Phase ends (*"it immediately disappears after use"*, #241).
**Actual:** the NP resolved, `phaseEnded` was set, and the Saber stood on, `defeated: false`.
**Cause:** `module/engine/attack.mjs#freeServantAftermath @ b0313abf` — written against `siblings` as
Process states; the Phase's `siblings` are its chat MESSAGES, the Process on each one's flag, so
`s.attackerId` was undefined for all of them. And it asked the stored `contract` word, where the price
asked the snapshot's (no Master is Free). No arena test had walked the path.
**Fix:** same function — read each message's Process, ask Free as `costs.mjs#isFree` does; an arena test
plays a Free Normal Assassin's NP to the Phase's end.
