---
kind: qualifier-quoted-not-checked
lesson: Every qualifier a quoted clause names ("enemy", "within Range", "allied") has its own guard in the code; read the quote against the checks, not the comment.
landed: CLAUDE.md#Lessons
---
**Mechanism:** A sheet's clause is quoted in the code's comment, so it reads as built, while one of its qualifiers has no check. Jack's *"Attacked by an enemy Unit, and the AU is within Jack's Range"* checked the Range and never the enemy. Every attacker had been an enemy until Danzō's Dongyū, an ally's area, caught him and asked *"Attack first?"*. Anastasia (#258) added Watermelon's *"a Normal Attack at a Range of 1 to 2"*: the range had its guard and the kind none, so every Blind Attack in the band was a sure hit.
**Lesson:** For each quoted clause, list its qualifiers and point at the line that checks each one. A qualifier with no line is a defect waiting for the first board that breaks the assumption. Test the case the qualifier excludes, not only the one it allows.
**Surprises:** [2026-10-18-ally-area-offered-jack-preemption](../2026-10-18-ally-area-offered-jack-preemption.md) · [2026-10-20-watermelon-reached-every-attack](../2026-10-20-watermelon-reached-every-attack.md)
