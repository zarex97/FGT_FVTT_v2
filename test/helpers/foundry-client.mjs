/**
 * @file The two pieces of Foundry's client layer the test world runs for real.
 * @see docs/adr/0006-tests-and-build-run-real-foundry.md, tools/lib/foundry-client-plugin.mjs
 *
 * Foundry's `client/` is mostly DOM and PIXI and does not import in Node. Two
 * corners of it touch neither, and both are things the engine leans on hard
 * enough that an imitation would be one more place to be wrong:
 *
 * - **The dice** (`client/dice/`). `new Roll(formula).evaluate()` is the real
 *   class: the real parser, the real terms, `.total`, `.formula` and
 *   `.dice[].results`. Only where each face comes from is the test's, through
 *   Foundry's own fulfillment seam (`CONFIG.Dice.fulfillment`), which calls a
 *   method's `handler(term)` once per die.
 * - **`Hooks`** (`client/helpers/hooks.mjs`). The real dispatcher: registration
 *   order, `call` stopping on `false`, `once` removed before it runs, a throwing
 *   listener caught and reported through `Hooks.onError`. Its state is static,
 *   so every world imports its own copy.
 *
 * Both need `tools/lib/foundry-client-plugin.mjs`, which vitest loads.
 */

import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { locateFoundry } from "../../tools/lib/foundry.mjs";

const clientFile = (...parts) => pathToFileURL(join(locateFoundry().path, "app", "client", ...parts)).href;

/** @type {Promise<object>|null} */
let dice = null;

/**
 * Foundry's dice module, `foundry.dice` as the client has it.
 * @returns {Promise<{Roll: Function, RollParser: Function, RollGrammar: object, MersenneTwister: Function, terms: object}>}
 */
export function loadDice() {
  dice ??= import(/* @vite-ignore */ clientFile("dice", "_module.mjs"));
  return dice;
}

/**
 * `CONFIG.Dice` as `client/config.mjs` builds it, with every face fulfilled by `face`.
 *
 * @param {object} d the dice module from {@link loadDice}
 * @param {(term: object) => number} face called once per die, with its term (`term.faces`)
 * @returns {object}
 */
export function diceConfig(d, face) {
  const t = d.terms;
  return {
    types: [t.Die, t.FateDie],
    rolls: [d.Roll],
    termTypes: {
      DiceTerm: t.DiceTerm, FunctionTerm: t.FunctionTerm, NumericTerm: t.NumericTerm,
      OperatorTerm: t.OperatorTerm, ParentheticalTerm: t.ParentheticalTerm, PoolTerm: t.PoolTerm,
      StringTerm: t.StringTerm,
    },
    terms: { c: t.Coin, d: t.Die, f: t.FateDie },
    randomUniform: d.MersenneTwister.random,
    parser: d.RollParser,
    functions: {},
    fulfillment: {
      dice: {},
      methods: { fgtWorld: { label: "FGT test world", interactive: false, handler: face } },
      defaultMethod: "fgtWorld",
    },
  };
}

let hooksCopy = 0;

/**
 * A fresh copy of Foundry's `Hooks` class, with no listeners.
 * @returns {Promise<Function>}
 */
export async function freshHooks() {
  hooksCopy += 1;
  const mod = await import(/* @vite-ignore */ `${clientFile("helpers", "hooks.mjs")}?world=${hooksCopy}`);
  return mod.default;
}
