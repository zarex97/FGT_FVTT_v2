/**
 * @file The moment the engine's listeners are all bound, as a promise.
 * @see module/engine/listeners.mjs, module/engine/scheduler-hooks.mjs
 *
 * Layer 3. `fgt.mjs`'s `ready` migrates the world before it binds the engine's
 * listeners, and that await lasts seconds once content-sync has packs to read.
 * A Turn changed inside it fired `combatTurnChange` with no listener to hear it:
 * no boundary ran, `globalTurn` stayed where it was, and the next faction
 * inherited the last one's spent Attacks (#230, found live; §46.4-JY, open since
 * #195 as "a boundary can skip right after a reload").
 *
 * So the Turn and Round hooks are bound FIRST and wait here, and the boundary
 * runs once the engine is whole instead of never.
 */

/** @type {() => void} */
let open = () => {};
const ready = new Promise((resolve) => { open = resolve; });

/**
 * Resolves once {@link markEngineReady} has run. Already-resolved for every later caller.
 *
 * @returns {Promise<void>}
 */
export function whenEngineReady() {
  return ready;
}

/** Say the engine's listeners are all bound (`listeners.mjs#attachEngineListeners`). */
export function markEngineReady() {
  open();
}
