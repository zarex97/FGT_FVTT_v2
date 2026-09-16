/**
 * @file Summons that leave on a schedule.
 * @see docs/15-abilities.md, docs/44-case-expanded-roster.md
 *
 * Layer 2 (rules). Pure.
 *
 * Every summon in the corpus before the Jabberwock leaves for a reason other
 * than time. Bašmu goes when the Hanging Gardens does; the Sphinxes and the
 * Kagome Spirits go when their field closes; the Dragon Tooth Warriors and
 * Raikou's copies never go at all.
 *
 * > *"When the Jabberwock is summoned, it disappears after 3◈ Turns."*
 *
 * `expiresAt` has been on the summon schema (`data/actor/simple.mjs`) since it
 * was written, and the only thing that read it was the actor sheet's context
 * builder, which displayed it. That is the shape Ch. 45 calls **Collected**:
 * right, and inert. Nothing wrote it, and nothing dismissed a summon when it
 * passed.
 *
 * An ABSOLUTE tick rather than a countdown, for the reason `data/regions.mjs`
 * states twice about its own durations: *"a countdown needs a hook that can
 * fail to fire, and an expiry cannot."*
 */

/**
 * Which summons have outstayed their welcome.
 *
 * `<=` and not `<`: an expiry of 12 means the Unit is gone once tick 12 has
 * arrived, the same convention `apps/actor-sheet/present.mjs#remainingTurns`
 * reads for every effect on a sheet.
 *
 * Scoped to summons, because `expiresAt` sits on the simple-actor schema that
 * structures and platforms share. A platform with a clock is a different
 * teardown (`engine/platforms.mjs`) and must not be swept up here.
 *
 * @param {object} board
 * @param {number} tick the world's current ◈ tick
 * @returns {string[]} unit ids to dismiss, in board order
 */
export function expiredSummonIds(board, tick) {
  return (board?.units ?? [])
    .filter((u) => u.kind === "summon")
    .filter((u) => typeof u.expiresAt === "number")
    .filter((u) => u.expiresAt <= tick)
    .map((u) => u.id);
}
