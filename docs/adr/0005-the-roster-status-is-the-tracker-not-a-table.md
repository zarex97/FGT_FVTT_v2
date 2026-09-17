# The roster's audit status lives on the tracker; the findings register stays in the chapter

Ch. 46 carried two records of per-Servant progress — a roster-status table (§46.7) and an inverse
ledger of what had not been tested (§46.13) — and they contradicted each other. The table marked
Karna, Penthesilea and EMIYA **complete**; the ledger's own closing analysis said *"only Heracles and
Semiramis are finished by §46.1's standard"*. Three more records claimed the same fact elsewhere: two
`Status: complete` lines in Appendix D asserting a narrower predicate on two of twenty-nine Servants,
and twenty per-Servant plan files whose checkboxes track authoring rather than proof. (The README's
roster line is a count of *authored* content and is not a status claim; it stays.)

Both Ch. 46 sections are **deleted**, not corrected, and every Servant reset to `Untouched`. Progress
now lives on the issue tracker, where it is computed from each Servant's clause list rather than
maintained by hand.

The chapter's **cross-cutting findings register (§46.4) and its per-Servant case chapters are kept**,
untouched.

## Considered options

**Correct the table and keep it.** The obvious repair, and the one that recreates the problem. A
hand-maintained status table drifts against reality the moment an audit lands and nobody remembers to
update the row — which is exactly how it came to disagree with the ledger three sections below it in
the same file. Two spellings of one fact is a defect this project has paid for repeatedly; the fix is
to delete a spelling, not to synchronise them.

**Delete the whole chapter and start again.** Considered because the reset is total, and rejected on
measurement: **253 comments in the engine and test code cite §46.4 by letter**, and 88 files cite Ch.
46 sections overall. Those citations are why given lines of code look the way they do — a reader
asking "why is this guarded?" is sent to the entry that records the defect it was guarding against.
Deleting the register to tidy the chapter would orphan every one of them, which is a far larger act
of destruction than the status reset being asked for.

**Keep the ledger as history.** Rejected because an inverse ledger *is* a status record — it says
what was not tested, which is the same fact wearing a coat — and leaving it would mean the tracker
and the chapter can disagree again on day one.

## Consequences

The roster's reported progress drops from **eight Servants audited to none**, including two that were
genuinely finished. That number is smaller and true; the chapter's own analysis already said six of
the eight were not finished by its stated standard, so most of the visible drop is the correction of
a claim that was never accurate.

Two Servants will be re-audited whose audits were real. That cost is accepted: their evidence was
recorded under a vocabulary that did not distinguish a passive from a press, and their case chapters
remain readable as findings.

Section numbers 46.7 and 46.13 are left as **gaps**. Renumbering to close them would break the
citations this decision exists to protect.

What this decision does not defend against: nothing stops someone adding a status table to a doc
later, and nothing will fail when they do. The tracker holds progress; the case chapters hold
findings; a third record of either is the thing to refuse.
