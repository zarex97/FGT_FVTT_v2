# A Clause a player initiates needs an interface press; one the engine fires does not

An audit proves a Clause by reaching it on a live board, and there are two ways to do that. A
**`Pressed (interface)`** is a real click on the real control, with the result read from the actor
sheet, the chat card or the game log. A **`Pressed (engine)`** drives the same function the button
calls — one layer below the mouse. We considered treating them as one level, *exercised on a board*,
and rejected it.

They are different claims. *"We drove it from the console"* and *"a player can do this"* are not the
same sentence, and only the second is what a Character Sheet promises. The gap between them is not
theoretical: it is where the flakiest failures in this system live. Scripted clicking has dropped the
canvas handshake so often that a single lethal attack once cost roughly fifteen attempts without
landing, and an Ability that resolves perfectly from `performAction` while its button does nothing is
a defect the player experiences and the engine cannot see.

So the requirement is split by who initiates. A Skill, a Noble Phantasm, an attack, a move, an
action-bar entry — anything a player presses — needs `Pressed (interface)`. A turn-end periodic, an
effect expiry, a Round boundary, a death trigger — anything the scheduler or an event fires — is
satisfied by `Pressed (engine)`, because there is no button to be broken.

## Considered options

**One level, "exercised on a board".** Simpler to record and simpler to satisfy, and it is what the
two levels would collapse to under any pressure. Rejected because it makes the distinction
decorative: if either satisfies the bar, nobody pays the fifteen-attempt cost, every Clause is filed
as engine-pressed, and the record stops carrying the one fact it was created to carry. The
distinction would survive in the vocabulary and die in practice, which is worse than not having it —
a reader would trust a word that no longer meant anything.

**Interface press for everything.** The strongest evidence, uniformly applied. Rejected because it
stalls the programme on canvas flakiness for Clauses that have no interface at all — nobody clicks a
Round boundary — and because a requirement that cannot be met becomes an excuse rather than a
standard. It would also make the flakiness invisible: an auditor blocked on a handshake would record
"could not test", not "the button is broken".

## Consequences

An audit is more expensive than it would otherwise be, and the expense lands precisely on the
Clauses a player will actually use. That is intended.

The failure mode worth naming is **silent downgrade**. Nothing in the tracker knows which kind of
Clause it is looking at, so an auditor who records `Pressed (engine)` for a Skill produces a record
that looks complete and is not. The clause list carries the Ability's timing markers for this reason
— a Clause derived from an `(Active)` marker is one a player presses — but the check is a human one,
and it is the first thing to verify when an audit's findings look thin.

The condition that would reopen this: if driving the interface becomes reliable enough that the
engine press is never the cheaper option, the two levels stop earning their separation and should
merge — into `Pressed (interface)`, not into a weaker shared level.
