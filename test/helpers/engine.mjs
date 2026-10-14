/**
 * @file The attack engine, imported where there is no client.
 * @see test/helpers/subject.mjs, test/helpers/world.mjs, docs/44-testing.md
 *
 * `module/engine/attack.mjs` imports the chat cards and the action bar, and the
 * action bar builds an ApplicationV2 mixin at module scope -- so under the test
 * world, which loads Foundry's data layer and not its client, the import throws
 * `foundry.applications is undefined` before a single export is reachable. That
 * is why this file's callers used to read the engine as TEXT.
 *
 * The stub is the test world's window classes (`client-api.mjs`): a mixin that
 * hands its base back, and an empty class for every other member. Nothing a
 * test reaches through it draws anything.
 */

import { installSystem } from "../../tools/lib/foundry.mjs";
import { installClientApi } from "./client-api.mjs";

/**
 * Import `module/engine/attack.mjs`, installing Foundry and the client stub
 * first.
 *
 * @returns {Promise<typeof import("../../module/engine/attack.mjs")>}
 */
export async function importAttack() {
  await installSystem();
  installClientApi();
  return import("../../module/engine/attack.mjs");
}
