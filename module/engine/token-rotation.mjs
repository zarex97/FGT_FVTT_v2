/**
 * @file Every token's artwork stays upright.
 * @see docs/29-user-interface.md §29.3, docs/04-units.md §4.4
 *
 * Layer 3. F/GT tracks which way a unit faces in `system.facing` — one of
 * eight compass points, set from the token HUD's dropdown
 * (`apps/hud/token-hud.mjs`) and read by the Combat Process when it decides
 * whether an Attack lands from behind (`engine/attack.mjs`'s `facing` state).
 * Nothing in the system reads or writes Foundry's own `TokenDocument#rotation`.
 *
 * That makes an unlocked token actively misleading rather than merely unused:
 * dragging a token's rotation handle spins the ARTWORK while `system.facing`
 * stays where it was, so the picture on the board and the field the rules
 * consult point in two different directions. `lockRotation` is Foundry's
 * switch for exactly this case ("Artwork Rotation Locked" in the Token
 * configuration sheet), and every F/GT token wants it on.
 *
 * Enforced in three places for the same reason `token-footprint.mjs` is:
 *
 *  1. `tools/lib/content.mjs` compiles it onto every prototype token, so a
 *     compendium actor is already right before it is ever placed.
 *  2. `preCreateToken` here catches a token built from a prototype that
 *     predates (1), and one dropped from a stock Foundry actor.
 *  3. A GM-side sweep at `ready` repairs tokens already standing on a board,
 *     which neither of the other two can reach.
 */

/**
 * Register the hooks. Idempotent.
 */
export const TokenRotation = {
  attach() {
    // Not GM-gated: `preCreateToken` mutates the pending document in the
    // creating client's own memory before it is sent, so whoever places the
    // token has to be the one to do it.
    Hooks.on("preCreateToken", (document) => {
      if (document.lockRotation) return;
      document.updateSource({ lockRotation: true });
    });

    lockExisting().catch((err) => console.error("FGT | Token rotation lock:", err));
    console.log("FGT | Token rotation lock attached");
  },
};

/**
 * Lock every token already placed in the world.
 *
 * Every scene, not just the open one: a token on a scene nobody has opened is
 * still a token that will be looked at eventually, and this is the only pass
 * that can reach it. One `updateEmbeddedDocuments` per scene rather than one
 * per token — a world with several populated scenes is otherwise a burst of
 * dozens of socket round-trips at every load.
 *
 * `lockRotation` is not one of Foundry v14's `MOVEMENT_FIELDS`, so unlike a
 * resize (`engine/token-footprint.mjs`) this needs no `fgtForced`.
 *
 * @returns {Promise<void>}
 */
async function lockExisting() {
  if (!game.user.isGM) return;
  let locked = 0;
  for (const scene of game.scenes) {
    const updates = scene.tokens
      .filter((token) => !token.lockRotation)
      .map((token) => ({ _id: token.id, lockRotation: true }));
    if (!updates.length) continue;
    await scene.updateEmbeddedDocuments("Token", updates);
    locked += updates.length;
  }
  if (locked) console.log(`FGT | Locked artwork rotation on ${locked} existing token(s)`);
}
