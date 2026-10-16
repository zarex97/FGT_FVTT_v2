---
id: 2026-10-15-two-users-one-cookie
found: tooling
kind: drive-kit
status: fixed
reviewed: true
pattern: drive-kit
---
**Expected:** the GM page (chrome-devtools) and Player1's tab (claude-in-chrome) stay two users.
**Actual:** after a reload both were Player1 ("User Player1 lacks permission to update Combat"); `fgt-eval` picked Player1's page too.
**Cause:** both tabs live in the one debug Chrome and share `localhost`'s session cookie; a reload rejoins as the last user.
**Fix:** Player1 on `http://127.0.0.1:30000`, the GM on `http://localhost:30000`: two origins, two cookies.
