/**
 * @file Routing a question to the player whose Unit it is about.
 * @see docs/38-authority.md, docs/23-reactions.md
 *
 * Layer 3. A GM-run resolution must not put a Servant's decision in the GM's
 * hands when the Servant belongs to somebody: almost everything the engine asks
 * — a reaction, a Luck Check offer, which abilities to copy, which allies to
 * bring aboard the Hanging Gardens — is the owner's call and is *resolved* on
 * the arbitrating client.
 *
 * This lived as a private function inside `engine/attack.mjs` and was copied
 * once into `apps/copy-dialog.mjs`. The third caller is what moved it here:
 * three readers of one rule is how a routing rule drifts into three different
 * answers about who is asked. `copy-dialog.mjs` keeps its own for now because
 * it routes from a unit **id** and sits on layer 4; its comment says so.
 */

/**
 * Ask the player who owns this actor, or answer it here when nobody does.
 *
 * `FGTSocket.ask` is the primitive, and it short-circuits to a local dialog
 * when the owner *is* this client. An unowned actor — a summon, an NPC, a
 * Servant nobody has been assigned — falls back to whoever is arbitrating,
 * because refusing outright would make the ability unusable in solo prep.
 *
 * A timeout, a dismissal or a disconnected owner resolves to **null**, and
 * every caller reads that as "declined" rather than as an error: a player
 * closing a window is the most common outcome of asking a question, and the
 * resolution must not stall because somebody walked away.
 *
 * @param {object} actor an Actor document
 * @param {object} spec a prompt spec (`module/apps/prompt.mjs`)
 * @returns {Promise<unknown>} the answer, or `null` for a decline
 */
export async function askOwner(actor, spec) {
  const owner = game.users.find((u) => u.active && !u.isGM && actor.testUserPermission(u, "OWNER"))
    ?? game.user;
  try {
    const { FGTSocket } = await import("../net/socket.mjs");
    return await FGTSocket.ask(owner.id, spec);
  } catch (err) {
    console.warn(`FGT | ${actor.name}'s window prompt was not answered:`, err);
    return null;
  }
}
