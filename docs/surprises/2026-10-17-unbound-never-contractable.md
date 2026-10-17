---
id: 2026-10-17-unbound-never-contractable
found: live press
kind: two-readers-one-rule
status: fixed
reviewed: true
pattern: two-readers-one-rule
---
**Expected:** a Servant whose Master has spent its last Command Spell is Unbound: an enemy Master may
contract it on a 6, an ally may not (Ch. 32).
**Actual:** live, F2's Master of Saber at 0 Command Spells: the Contract dialog said *"Already contracted —
only Unbound and Free Servants can be."* for every Master. No Unbound Servant could ever be contracted.
**Cause:** `module/rules/contract.mjs:47 @ b0313abf` — Unbound is derived from the pools and never stored
(`cs-namespacing.mjs#isUnbound`, Ch. 33), and the Contract rule read the stored word, which only ever says
"contracted". The sheet read the derivation; the rule that needed it did not.
**Fix:** `module/rules/snapshot.mjs#annotateMasterRank @ b0313abf` derives `unbound` on the board, and
the Contract rule and dialog read it; not as `contract: "unbound"`, whose readers price an NP and run a clock
as for a Free Servant.
