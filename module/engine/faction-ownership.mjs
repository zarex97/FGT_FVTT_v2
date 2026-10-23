/**
 * @file Keeping an actor's Foundry ownership in sync with its faction assignment.
 * @see docs/38-authority.md, docs/06-units-and-stats.md
 *
 * Layer 3. `apps/faction-config.mjs` lets a GM assign a controlling player to a
 * faction and fires `fgtFactionsChanged` on the GM's own client — and nothing
 * consumed it. Ch. 38 states the design plainly: *"A player owns their own
 * Servants and Master."* Nothing made that true: `game.settings.get("fgt",
 * "factions")` held the assignment correctly, but every actor's `ownership`
 * stayed `{default: 0}` regardless of which faction it belonged to.
 *
 * The consequence reached further than an inconvenience. A player assigned to
 * a faction could not open their own Servant's sheet with real permission,
 * could not drag its token — Foundry's own permission check refuses the
 * write, a separate gate from this system's own MOV/budget legality in
 * `movement-hooks.mjs`, which still ran and still looked satisfied — and,
 * once the identity-concealment image swap existed (Ch. 06), saw the
 * standard image on their OWN sheet: `context.mjs`'s "am I exempt from
 * concealment" check reads `actor.isOwner`, which was never true for them.
 *
 * GM-only, like `setFactions` itself: only the GM may write another user's
 * ownership, so every entry point here no-ops for anyone else rather than
 * throwing — `updateActor` and `fgtFactionsChanged` both fire on every
 * connected client, not only the GM's.
 */

import { currentBoard, factions } from "./board.mjs";
import { gmControlled } from "../rules/control.mjs";
import { formOf } from "../rules/form.mjs";
import { warOfUnit, currentWar } from "./war.mjs";

export const FactionOwnership = {
  /** Register the hooks. Idempotent. */
  attach() {
    Hooks.on("fgtFactionsChanged", (rows, war) => {
      syncAll(rows, war).catch((err) => console.error("FGT | Faction ownership sync:", err));
    });
    // A Servant's faction can change after creation -- the sheet's own
    // dropdown, or a summon assigning one post-roll -- and each such change
    // needs the SAME resync a roster edit gets, for the one actor it touched.
    Hooks.on("updateActor", (actor, changes) => {
      if (changes?.system?.factionId === undefined) return;
      syncOne(actor).catch((err) => console.error("FGT | Faction ownership sync:", err));
    });
    Hooks.on("createActor", (actor) => {
      if (!actor.system?.factionId) return;
      syncOne(actor).catch((err) => console.error("FGT | Faction ownership sync:", err));
    });
    console.log("FGT | Faction ownership attached");
  },
};

/**
 * Recompute every actor's ownership from the faction roster.
 *
 * Exported so a GM can force a one-off repair on a world whose actors predate
 * this sync existing — re-saving the roster through `board.setFactions` fires
 * the same `fgtFactionsChanged` hook this already listens for, which is the
 * ordinary way to trigger it; this is here for a console-driven repair.
 *
 * @param {import("../rules/factions.mjs").Faction[]} [rows]
 * @param {object|null} [war] the War whose roster `rows` is
 * @returns {Promise<void>}
 */
export async function syncAll(rows = factions(), war = currentWar()) {
  if (!game.user.isGM) return;
  // Only this War's Units. Two Wars both have a "faction-1", and resyncing
  // every actor in the world against one War's roster handed War A's players
  // War B's Servants (and took them from War B's).
  for (const actor of game.actors) {
    const own = warOfUnit(actor);
    if (own && war && own !== war) continue;
    await syncOne(actor, rows);
  }
}

/**
 * One actor's ownership, from its own `factionId`.
 *
 * A full rewrite of every non-GM user's entry, not a patch that only adds the
 * newly-assigned owner: reassigning a faction to a different player has to
 * revoke the previous one's ownership too, or two players would both be able
 * to drive the same Servant after a `FactionConfig` change.
 *
 * @param {object} actor
 * @param {import("../rules/factions.mjs").Faction[]} [rows]
 * @returns {Promise<void>}
 */
export async function syncOne(actor, rows = factions(warOfUnit(actor) ?? currentWar())) {
  if (!game.user.isGM) return;

  // A SET of owners, not one id. While this read a singular field, six of the
  // seven players cooperating on a faction could not open their own Servant's
  // sheet or drag its token -- Foundry's own permission check refuses the
  // write, which is a separate gate from this system's MOV and budget legality
  // in `movement-hooks.mjs`, and that one still ran and still looked satisfied.
  const owners = new Set(rows.find((f) => f.id === actor.system?.factionId)?.userIds ?? []);
  const { NONE, OBSERVER, OWNER } = CONST.DOCUMENT_OWNERSHIP_LEVELS;
  // A Unit the GM drives, and every summon of it, is watched by its faction's
  // players, never driven: the Gigantic Horror's Horrors summoned after the
  // change came out owned by Player1 (#323 reading 12g, live).
  const ownerLevel = gmControlled(
    { formController: formOf(actor)?.spec?.controller ?? null, summonerId: actor.system?.summonerId ?? null },
    currentBoard(),
  ) ? OBSERVER : OWNER;

  const patch = {};
  let dirty = false;
  for (const user of game.users) {
    if (user.isGM) continue;
    const want = owners.has(user.id) ? ownerLevel : NONE;
    if ((actor.ownership?.[user.id] ?? NONE) !== want) {
      patch[user.id] = want;
      dirty = true;
    }
  }
  if (dirty) await actor.update({ ownership: patch });
}
