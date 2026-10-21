---
id: 2026-10-20-bar-stale-after-another-unit-moves
found: live press
kind: hidden-timing-rule
status: fixed
reviewed: true
pattern: stale-render
---
**Expected:** Heracles's action bar refuses Nine Lives "Outside the Master's ZON" only while he is outside it.

**Actual:** after the GM moved his Master into range, the board on both clients read `outsideZon: false`,
and Player2's bar still greyed Nine Lives "Outside the Master's ZON — Noble Phantasms are unusable" until
the token was released and selected again.

**Cause:** the action bar (`module/apps/hud/action-bar.mjs`) re-renders on its own Unit's changes, not on
another Unit's move that changes one of its gates (his Master's position decides his ZON).

**Fix:** `module/apps/hud/action-bar.mjs#BAR_REFRESH_HOOKS @ uncommitted` — the bar re-renders on every
hook a verdict reads, any Unit's `updateToken`, `createToken` and `deleteToken` among them (#261). Pressed live
2026-10-21 in War *Gilles Audit B*: with Arjuna selected on Player2's client, the GM moved his Master into ZON and
both NP slots lit, then out again and both read "Outside the Master's ZON", with no reselect.
