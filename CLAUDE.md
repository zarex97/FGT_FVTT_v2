# FGT_FVTT_v2

## Agent skills

### Code search

Two graphs, both live: **CodeGraph** (`.codegraph/`) for symbol impact before an edit, **graphify**
(`graphify-out/`) for shape and reach. Consult one before changing a symbol; prefer one over grep to
locate code. Grep stays correct for what a graph does not model — templates, authored content, lang
strings — and for **proving an absence**, which a graph can never do. See `docs/agents/code-search.md`.

### Issue tracker

Issues live as GitHub issues on `zarex97/FGT_FVTT_v2`, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical roles, unchanged: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
