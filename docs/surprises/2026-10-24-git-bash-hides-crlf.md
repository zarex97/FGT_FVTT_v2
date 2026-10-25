---
id: 2026-10-24-git-bash-hides-crlf
found: tooling
kind: assumed-shape
status: fixed
reviewed: false
---
**Expected:** `grep -c $'\r' module/engine/attack.mjs` printing 0 and `cat -A` ending lines in `$` meant the file is
LF, so an exact-text edit written with `\n` would match it.
**Actual:** Python read the same file as `\r\n`. Edits with multi-line `old` text reported "0 matches" on
`module/engine/attack.mjs` and `module/rules/platforms.mjs`, and the edits that did match wrote LF lines into CRLF
files, leaving four files with mixed endings until they were normalized.
**Cause:** Git Bash's `grep` and `cat` open files in text mode and strip the `\r`; the working copy is CRLF under
`core.autocrlf=true`, so the shell tools reported a shape the files do not have.
**Fix:** `$TEMP/fgt_edit.py` (session tool, not in the repo) reads the file as bytes, matches on LF-normalized text and
writes back in the file's own ending; the four files were rewritten whole in CRLF. Read a file's endings with Python
or `file`, never with Git Bash's `grep`/`cat`.
