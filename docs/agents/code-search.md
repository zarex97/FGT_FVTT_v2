# Code Search

How to find code in this repo, and how to find out what a change will break.

This repo carries **two** graphs and both are live. "The graph" names two things, which is why
this page exists: the ambiguity is the first thing to clear up.

## The two graphs

| | What it is | Reach for it when |
|---|---|---|
| **CodeGraph** | SQLite index at `.codegraph/`, kept current by a daemon that lags writes by about a second. Queried by the `codegraph_explore` MCP tool, or `codegraph explore "<query>"` from a shell. | You are about to **change a symbol**. It answers callers, call paths, blast radius and which tests cover it within N hops — and returns the **verbatim, line-numbered source**, so the answer is the code you are about to edit. |
| **graphify** | Knowledge graph at `graphify-out/`, spanning **code and prose** — 4,757 nodes over 635 files. Rebuilt by a commit hook and a watch process. Queried by `graphify explain "<node>"` and `graphify path "<A>" "<B>"`, or the `/graphify` skill for a natural-language question. | You want **shape and reach**: who imports this, how two things connect, which community or which docs a concept lives in. Cheap — a dozen lines of edges with `file:line`, and no source. |

They complement rather than overlap. `graphify explain` answers *"who touches this"* at a glance;
`codegraph_explore` answers *"…and here is the code you are about to break"*.

## The rule

**Before changing a symbol, consult a graph.** Not optional. Blast radius is the thing that is
expensive to be wrong about, and it is the thing a graph is for.

**To locate code, prefer a graph.** It is cheaper than a grep-and-read loop and it hands back
source you can edit from.

**Grep is not banned.** It is the right tool for what the graph does not model, and for disproof.

### The greps that are always correct

1. **Non-code carriers.** `templates/`, `packs/_source/` YAML, `lang/*.json`. No call edge exists
   for a Handlebars context key, an authored effect id or a localisation string. A symbol graph
   cannot see them.
2. **Proving an absence.** See below — this is the important one.
3. **Literal text.** A string, a comment, a log kind, a magic number.
4. **Verifying a graph answer** before you act destructively on it.

The principle underneath: **grep is for what the graph does not model, and for disproof.**

## A graph answer is never proof of an absence

A graph tells you what exists. It cannot tell you that *nothing* references X, because it may not
model the kind of reference that does. "No callers found" is a lead, never a verdict.

This is not theoretical. Every absence-finding in the Asterios audit and the review that followed
it was a grep, and every one was a real defect:

- `veteranBonus.noMovPenalty` — authored, compiled, **read by nobody**. A whole clause of a Noble
  Phantasm that did not happen (Ch. 46 §46.4-AR).
- `isBuff` on a rule element — two producers, no reader.
- `multiServantTax` — computed on every render of every Master's sheet and read by no template.
  `grep -rn multiServantTax templates/` is what proved it; no graph models "a Handlebars template
  reads a context key" (#44).
- `movementAllowance` — exported "for the HUD", called by nothing, and *repaired* before anyone
  noticed it was dead (#46).

If you are about to claim something is unread, **grep for it.**

## When the graph is behind

Both tools say so themselves; believe them.

- `codegraph_explore` prints *"edited since the last index sync — Read them directly"* and names
  the files. Read those files; the rest of that answer is still fresh.
- `graphify-out/GRAPH_REPORT.md` stamps the commit it was built from. Compare it to `HEAD`. If it
  is behind, treat its answer as a lead rather than proof, and `graphify update .` is free.

## When you have spent the explore budget

`codegraph_explore` reports a per-question budget — *"Explore budget: N calls for this project …
synthesize once you've used N"*. It is a nudge toward synthesis, not a hard cap, and it resets with
the question rather than with the session.

When you have spent it: **synthesise what you have, then grep for the gap.** Do not guess, and do
not keep spending calls on an area the first answers already covered.

## This binds subagents

An `Explore` or `general-purpose` dispatch is *exactly* where a broad grep happens, so the rule
has to travel with the work. Say so in the dispatch prompt, and point the agent at this page.

A rule that only the main session follows leaks the moment anything is delegated, and delegation is
when the widest searching happens.

## Precedence

A global `CLAUDE.md` may carry its own "use CodeGraph before grep" line. **For this repo, this page
supersedes it** — it is the same instinct with the second graph, the sanctioned greps and the
absence rule added.

One rule said twice is how two readings drift apart, which this codebase has paid for more than
once: a clause read off `modes` while its caller wrote `abilities`; a threshold spelled `25` on a
sheet and `MULTI_SERVANT_COST` in the rule; three spellings of "ally" in one escape clause. If this
page and another instruction disagree, this one wins inside this repo, and the other should be
thinned rather than both edited.
