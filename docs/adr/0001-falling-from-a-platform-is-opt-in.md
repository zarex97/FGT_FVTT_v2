# Falling from a Platform is opt-in per Platform

Ch. 27 describes a Knocked Off ladder — Agility Check, the Servant's rescue of an adjacent Master,
`10*2d6` on landing, and a Master's Overpower roll — but the rulebook states it only for Semiramis'
Hanging Gardens of Babylon, and the wording is specific to that Platform. We considered making it
universal (every Platform has edges you can be shoved past) and rejected it: the Storm Border is a
pocket dimension with no ground footprint, where "the edge" is not a coherent idea, and
Quetzalcoatlus is a mount rather than a surface. So a Platform can be fallen from **only** when it
authors a `knockOff` block, and the block carries its own numbers — following the convention
`boarding` already sets, where a Platform that states its own rule states it completely. A Platform
that says nothing holds its edge: knockback finds no landing there and the Unit simply stays.

The consequence worth naming is that this default is **silent**. A future Platform that should be
dangerous will be safe until somebody authors the block, and nothing will fail to indicate it — the
same shape as the unreached-facility defects in #19, #24 and #27. If a second Platform ever gains
the rule, that is the moment to consider whether the default should flip.

## Destruction is the same decision (#139)

The Hanging Gardens' sheet also states a ladder for the Platform's **end**: every Unit on it rolls an
Agility or a Luck Check, and one that fails takes 100 Fixed STR damage. No other sheet does — the
Golden Hind says only that its riders are "randomly scattered below it", and Quetzalcoatl's sheet
says nothing of riders when the mount falls. The engine ran the garden's ladder on every Platform
that ended, which risked 100 on the Quetzalcoatlus's riders every time it did — including its forced
close, which fires exactly when her Master has 25 Health or less. The user ruled (2026-10-01) that
when a mount falls its riders just drop to the ground, with no check and no damage.

So destruction follows this ADR's own convention rather than a second one: a Platform that states
the ladder authors a `collapse` block carrying its number (`collapse: { damage: 100, component: str }`,
beside `knockOff`), and one that says nothing does not have it. It still scatters its riders; it does
not hurt them. The check itself (the better of Agility or Luck, a Master spared by a passing Servant
within 2 panels) stays the garden's rule in code.

The same consequence applies: the default is silent, and a future Platform whose sheet states a
collapse will not hurt anyone until somebody authors the block.
