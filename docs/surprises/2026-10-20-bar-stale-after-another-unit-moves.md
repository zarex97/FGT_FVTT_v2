---
id: 2026-10-20-bar-stale-after-another-unit-moves
found: live press
kind: hidden-timing-rule
status: open
reviewed: true
pattern: stale-render
---
**Expected:** Heracles's action bar refuses Nine Lives "Outside the Master's ZON" only while he is outside it.

**Actual:** after the GM moved his Master into range, the board on both clients read `outsideZon: false`,
and Player2's bar still greyed Nine Lives "Outside the Master's ZON — Noble Phantasms are unusable" until
the token was released and selected again.

**Cause:** the action bar (`module/apps/hud/action-bar.mjs`) re-renders on its own Unit's changes, not on
another Unit's move that changes one of its gates (his Master's position decides his ZON).

**Fix:** open: #261. Found pressing Gilles de Rais (Saber) (#260); not his. The workaround is to reselect the token.
