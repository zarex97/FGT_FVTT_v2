---
id: 2026-10-21-class-read-from-class-skills
found: user
kind: rule-word-read-one-way
status: fixed
reviewed: false
---
**Expected:** Filing the sixteen unbuilt sheets on the new Class trackers, I read each Servant's Class from its
Class Skills: Durga *"Saber, could be Rider"* (Magic Resistance A, Riding A), Sieg *"Archer, could be Caster"*
(Independent Action EX alone), Diarmuid *"Lancer, could be Saber"* (Magic Resistance B alone).

**Actual:** The user, 2026-10-21: *"Sieg=Caster, Durga=Archer, Diarmuid=Lancer."* Durga is neither reading I offered,
and Sieg is my second. Fifteen of the sixteen sheets print no Class at all; only Lanceturia's does, *"Arturia
(Lancer)"*.

**Cause:** `char_orig_sheets/Copia de Durga.md @ 0c3914eb` — a Class Skill is not a Class: Riding and Magic Resistance
sit on Archers, Sabers and Riders alike, and this game's sheets bend the defaults. It is the Anastasia & Viy shape
again (a Class the sheet never prints, filled in by inference), caught this time because the readings were asked.

**Fix:** the readings were put to the user before anything was filed, and the rule is now on the roster parent #264
and in ADR 0005's amendment: a sheet that prints no Class waits under *Unclassed* until the user rules it.
