---
kind: role-keyed-on-type
lesson: When code asks about a role (Master, summoner, owner), ask about the relationship that confers it, never the actor's type.
landed: CLAUDE.md#Lessons
---
**Mechanism:** A role is asked as a document type. "Is this a Master?" was `type === "master"`, so a Servant holding a Contract — Medea after Rule Breaker — was nobody's Master to the Contract, the multi-Servant tax and the freeing on defeat. The type check is right for every Unit the code was written against and silently wrong for the first that fills the role another way.
**Lesson:** Ask the relationship that confers the role: a Master is whoever holds a Contract (`masterId` points at it), a summoner is whoever `summonerId` names. When a new Unit fills an old role, grep every reader of that role for a type test.
**Surprises:** [2026-10-10-rule-breaker-contract-to-her-master](../2026-10-10-rule-breaker-contract-to-her-master.md) · [2026-10-10-tax-skips-servant-master](../2026-10-10-tax-skips-servant-master.md) · [2026-10-10-freeing-skips-servant-master](../2026-10-10-freeing-skips-servant-master.md)
