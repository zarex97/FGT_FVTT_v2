/**
 * @file Finding the tokens an actor actually has on a board.
 * @see module/engine/token-image.mjs, module/engine/token-footprint.mjs
 *
 * Layer 3. Both of this file's consumers need the same list and Foundry offers
 * two flawed ways to get it, so the correction lives here once:
 *
 *  - `Actor#getActiveTokens()` passes `scenes: canvas.scene`, so it silently
 *    covers only the scene currently open. A token on any other scene keeps
 *    whatever it had until someone opens that scene and edits the actor again.
 *  - `Actor#getDependentTokens()` spans every scene — each `TokenDocument`
 *    registers itself on its base actor at initialization, and every Scene is
 *    initialized at world load — but reads an `IterableWeakSet` that a DELETED
 *    token stays in until the collector gets to it.
 *
 * The second is the right list with the first's guard applied. That guard is
 * not defensive tidying: `await token.update()` on a document its scene no
 * longer holds throws, and one ghost early in the list aborted a whole
 * sequential pass, leaving the genuinely placed token behind it unchanged.
 */

/**
 * Every live `TokenDocument` this actor has placed, across all scenes.
 *
 * A synthetic (token) actor yields its own token and nothing else, which is
 * Foundry's behaviour and the correct one: an ActorDelta speaks for exactly
 * one placement.
 *
 * @param {object} actor
 * @yields {object} a `TokenDocument`
 */
export function* placedTokensOf(actor) {
  for (const token of actor.getDependentTokens()) {
    if (token.parent?.tokens?.get(token.id) === token) yield token;
  }
}
