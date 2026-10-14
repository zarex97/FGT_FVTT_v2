/**
 * @file The slice of Foundry's CLIENT namespace a module needs merely to be imported.
 * @see test/helpers/world.mjs, test/helpers/subject.mjs
 *
 * The test world loads Foundry's `common` layer for real (ADR-0006), and that layer
 * has no `foundry.applications`. `engine/attack.mjs` pulls in the chat card, the
 * card pulls in the HUD, and the HUD declares its window classes at module scope:
 * `class ActionBar extends HandlebarsApplicationMixin(ApplicationV2)`. So the
 * engine's largest file could not be imported by any test, and nothing in it could
 * be held to its own output.
 *
 * What is stubbed here is only the base classes those declarations extend. They
 * are the test world's own (`client-api.mjs`): a window nobody opens draws
 * nothing, and one the engine opens inside a world is shown to that world.
 */

import { installClientApi } from "./client-api.mjs";

/**
 * Give `foundry.applications.api` the base classes a module-scope `class extends`
 * needs. Safe to call more than once, and a no-op where the namespace is real.
 *
 * Call it from inside a world (`withSubjects`/`withWorld`), where `foundry` is
 * the real object, and before the first import of the module that needs it.
 *
 * @returns {void}
 */
export function installClientNamespace() {
  installClientApi();
}
