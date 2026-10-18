/**
 * @file The engine's document listeners: one list, bound by the game and by the test world.
 * @see docs/02-architecture.md, docs/44-testing.md
 *
 * Layer 3. Much of the engine runs because Foundry fired a hook: a mode
 * switched off starts its `countFrom: deactivation` cooldown (`updateItem`),
 * Presence Concealment's end discloses Secret Poison (`deleteActiveEffect`), a
 * Turn changing runs every boundary (`combatTurnChange`). These used to be
 * attached one by one in `fgt.mjs`'s `ready`, so a test could only reach them by
 * attaching its own copy, and none did: five Surprises lived in code no test
 * ever ran (Ch. 44, *Document hooks*).
 *
 * So the list lives here, in the order the game binds it, and both `fgt.mjs`
 * and `test/helpers/world.mjs` call {@link attachEngineListeners}. Listeners
 * that only draw (the action bar, the overlays, the pending panel) are not on
 * it: they are the UI's, and `fgt.mjs` binds them after these. Neither are the
 * once-at-load passes, which are not listeners.
 *
 * Order matters: Foundry runs a hook's listeners in the order they were
 * registered, and several entries listen to the same hook (`updateActor`,
 * `deleteActiveEffect`, `updateItem`).
 */

import { Scheduler } from "./scheduler-hooks.mjs";
import { markEngineReady } from "./engine-ready.mjs";
import { Hgob } from "./hgob.mjs";
import { Movement } from "./movement-hooks.mjs";
import { Terrain } from "./terrain.mjs";
import { FactionOwnership } from "./faction-ownership.mjs";
import { TokenImage } from "./token-image.mjs";
import { TokenFootprint } from "./token-footprint.mjs";
import { TokenVision } from "./token-vision.mjs";
import { TokenRotation } from "./token-rotation.mjs";
import { syncDerivedFields } from "./fields.mjs";
import { syncMarkVisibility } from "./marks.mjs";
import { attachInvalidation } from "./invalidation-hooks.mjs";
import { attachForcedModes } from "./modes.mjs";
import { attachConcealment } from "./concealment.mjs";
import { attachFeignedDefeat } from "./feigned-defeat.mjs";
import { attachCopyPick } from "./copy.mjs";
import { attachOpeningChoice } from "./opening-choice.mjs";
import { MasterEssences } from "./master-essence.mjs";

/**
 * A field's SIZE can change without anybody moving: Contagion's Active takes it
 * from 5×5 to 9×9 by applying a marker, and Doomsday Come opening takes it over
 * entirely. Movement needs no hook -- a `followsUnit` field is attached to its
 * anchor's token and Foundry translates it -- but an effect does.
 */
function attachDerivedFields() {
  for (const hook of ["createActiveEffect", "deleteActiveEffect"]) {
    Hooks.on(hook, (effect) => {
      if (effect.parent?.documentName !== "Actor") return;
      syncDerivedFields().catch((err) => console.error("FGT | Derived fields:", err));
    });
  }
}

/**
 * Ch. 28: *"Bloodmarks can only be seen from a distance of 3 cells Maximum."*
 * Presentation only, answered per viewer on every client, and re-asked whenever
 * anybody moves -- the question is positional, exactly like the aura index.
 */
function attachMarkSight() {
  Hooks.on("updateToken", (_doc, changes) => {
    if (!("x" in changes) && !("y" in changes)) return;
    syncMarkVisibility().catch((err) => console.error("FGT | Mark visibility:", err));
  });
}

/**
 * Every engine listener, in the order the game binds them.
 * @type {ReadonlyArray<{id: string, attach: () => void}>}
 */
export const ENGINE_LISTENERS = Object.freeze([
  // The Turn and Round boundaries, and a mode's end. GM client only, internally.
  { id: "scheduler", attach: () => Scheduler.attach() },
  // Semiramis's Hanging Gardens: a channel's completion and a platform's destruction.
  { id: "hgob", attach: () => Hgob.attach() },
  // Every client validates its own movement; the write is proxied as usual.
  { id: "movement", attach: () => Movement.attach() },
  // Erases a painted terrain area when the effect that painted it ends.
  { id: "terrain", attach: () => Terrain.attach() },
  // Ch. 38: "a player owns their own Servants and Master."
  { id: "factionOwnership", attach: () => FactionOwnership.attach() },
  // Ch. 06: a Servant's token shows its true portrait once its identity is revealed.
  { id: "tokenImage", attach: () => TokenImage.attach() },
  // Ch. 27: a Platform's token is the size of the footprint it declares.
  { id: "tokenFootprint", attach: () => TokenFootprint.attach() },
  // Ch. 05: a unit's Detect radius is its token's vision range.
  { id: "tokenVision", attach: () => TokenVision.attach() },
  // Facing lives in `system.facing`; a token's own rotation stays locked.
  { id: "tokenRotation", attach: () => TokenRotation.attach() },
  { id: "derivedFields", attach: attachDerivedFields },
  { id: "markSight", attach: attachMarkSight },
  // Ch. 08's invalidation table, and Ch. 25's round-boundary desync check.
  { id: "invalidation", attach: attachInvalidation },
  // Penthesilea's Hatred of Achilles: a mode nobody presses, watched positionally.
  { id: "forcedModes", attach: attachForcedModes },
  // Presence Concealment's end: its cooldown, and Secret Poison disclosed.
  { id: "concealment", attach: attachConcealment },
  { id: "feignedDefeat", attach: attachFeignedDefeat },
  // Wisdom of Dún Scáith: a copier entering a war under way owes its pick.
  { id: "copyPick", attach: attachCopyPick },
  // Uncrowned Arms Mastership: a Servant entering a war under way owes its
  // opening choice (#206 reading 3).
  { id: "openingChoice", attach: attachOpeningChoice },
  // A Master Essence's copy on its Servant follows the Contract and ends with
  // the Master (#241).
  { id: "masterEssences", attach: () => MasterEssences.attach() },
]);

/**
 * Bind the engine's listeners on the current `Hooks`.
 *
 * @param {{skip?: string[]}} [options] ids to leave unbound
 * @returns {string[]} the ids bound
 */
export function attachEngineListeners({ skip = [] } = {}) {
  const bound = [];
  for (const { id, attach } of ENGINE_LISTENERS) {
    if (skip.includes(id)) continue;
    attach();
    bound.push(id);
  }
  // A boundary heard before now has been waiting for this (`engine-ready.mjs`).
  markEngineReady();
  return bound;
}
