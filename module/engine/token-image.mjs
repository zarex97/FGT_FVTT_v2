/**
 * @file Keeping a Servant's token texture in sync with its concealed identity.
 * @see docs/04-units.md §4.2, docs/26-authority-and-sockets.md §26.6
 *
 * Layer 3. Foundry does not propagate an actor's `img` to a token already
 * placed on a scene — each `TokenDocument` (and `prototypeToken`) carries its
 * own `texture.src`, frozen at the moment it was created. Nothing in this
 * system ever synced the two, so changing a Servant's portrait or its
 * `defaultImage` left every placed token showing whatever it always had.
 *
 * The token is not the sheet: a placed token's texture is **one field every
 * viewer sees identically** — Foundry has no per-viewer rendering for it, and
 * building that (the shadow-actor pattern) is the exact thing Ch. 26 §26.6
 * assesses and defers to Ch. 40. So this does not attempt to show the true
 * portrait to the owner and the standard image to everyone else the way the
 * sheet does (`apps/actor-sheet/context.mjs`'s `concealed`) — it keeps the
 * token showing whichever ONE image is currently public: the standard image
 * while `identityRevealed` is unset, the true portrait once it is set. A GM
 * revealing a Servant's identity is therefore also what puts its real face on
 * the board, for everyone, in one action.
 */

export const TokenImage = {
  /** Register the hooks. Idempotent. */
  attach() {
    Hooks.on("updateActor", (actor, changes) => {
      if (actor.type !== "servant") return;
      if (!touchesWatchedPath(changes)) return;
      syncOne(actor).catch((err) => console.error("FGT | Token image sync:", err));
    });
    console.log("FGT | Token image sync attached");
  },
};

/**
 * Does this update touch `img`, `system.defaultImage`, or
 * `system.identityRevealed`?
 * @param {object} changes
 * @returns {boolean}
 */
function touchesWatchedPath(changes) {
  if ("img" in changes) return true;
  const sys = changes.system;
  return Boolean(sys && ("defaultImage" in sys || "identityRevealed" in sys));
}

/**
 * The image every viewer's canvas should currently show for this Servant.
 * @param {object} actor
 * @returns {string}
 */
export function publicImageOf(actor) {
  if (actor.system?.identityRevealed) return actor.img;
  return actor.system?.defaultImage || actor.img;
}

/**
 * Push the public image onto the prototype and every placed token.
 *
 * GM-only: `updateActor` fires on every connected client, and only the GM may
 * write another user's token. Elsewhere this is a no-op rather than a throw,
 * the same convention `engine/faction-ownership.mjs` uses.
 *
 * @param {object} actor
 * @returns {Promise<void>}
 */
async function syncOne(actor) {
  if (!game.user.isGM) return;

  const src = publicImageOf(actor);
  if (actor.prototypeToken.texture.src !== src) {
    await actor.update({ "prototypeToken.texture.src": src });
  }
  // `linked=false` -- an UNLINKED token (its own ActorDelta) is exactly the
  // shape a Servant summoned with per-instance state uses, and defaulting to
  // `linked=true` would silently skip every one of them. `document=true`
  // returns `TokenDocument`s directly rather than canvas placeables, so this
  // still finds a token on a scene nobody currently has open.
  for (const token of actor.getActiveTokens(false, true)) {
    if (token.texture.src !== src) await token.update({ "texture.src": src });
  }
}
