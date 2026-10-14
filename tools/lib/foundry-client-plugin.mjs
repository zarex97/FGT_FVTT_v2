/**
 * @file The two things Foundry's client dice need to import under vitest.
 * @see docs/adr/0006-tests-and-build-run-real-foundry.md, test/helpers/foundry-client.mjs
 *
 * Foundry's `client/` layer is mostly unimportable in Node (DOM, PIXI), but its
 * dice (`client/dice/`) and its `Hooks` (`client/helpers/hooks.mjs`) touch
 * neither. The dice need two things Foundry's own build supplies: the
 * `@common/` alias, which its bundler resolves to `common/`, and the Roll
 * grammar, which ships as a Peggy source (`grammar.pegjs`) the bundler
 * compiles. This plugin does the same two jobs for the test runner, using the
 * `peggy` this repository pins at the copy's version.
 *
 * When the copy is missing the plugin does nothing; `tools/lib/foundry.mjs`
 * fails the first test that needs Foundry, with the message that says why.
 */

import { join } from "node:path";
import { createRequire } from "node:module";
import { locateFoundry } from "./foundry.mjs";

/**
 * @returns {import("vite").Plugin}
 */
export function foundryClientPlugin() {
  let app = null;
  try {
    app = join(locateFoundry().path, "app");
  } catch {
    app = null;
  }
  return {
    name: "fgt-foundry-client",
    config() {
      if (!app) return {};
      return { resolve: { alias: [{ find: /^@common\/(.*)$/, replacement: `${join(app, "common")}/$1` }] } };
    },
    transform(code, id) {
      if (!id.endsWith(".pegjs")) return null;
      const peggy = createRequire(import.meta.url)("peggy");
      const source = peggy.generate(code, { output: "source", format: "es" });
      // Foundry imports the grammar's default export; Peggy's ES output names
      // its exports, so the default is added when it has none.
      const withDefault = /export\s+default/.test(source)
        ? source
        : `${source}\nexport default { parse: peg$parse, SyntaxError: peg$SyntaxError };`;
      return { code: withDefault, map: null };
    },
  };
}
