/**
 * @file The Node module hooks that let Foundry's client dice import outside vitest.
 * @see tools/lib/foundry-client-plugin.mjs, test/helpers/foundry-client.mjs
 *
 * The same two jobs the vitest plugin does, for a plain `node` run such as
 * `tools/check-world.mjs`, which builds the test world too: resolve Foundry's
 * `@common/` alias to its `common/` directory, and compile the Roll grammar's
 * Peggy source on import. Registered with {@link registerFoundryClientHooks}
 * before anything imports Foundry's dice.
 */

import { register } from "node:module";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Set by `initialize`, from the data `register` passes. */
let common = null;

/** @param {{common: string}} data */
export function initialize(data) {
  common = data?.common ?? null;
}

export async function resolve(specifier, context, next) {
  if (common && specifier.startsWith("@common/")) {
    return next(pathToFileURL(join(common, specifier.slice("@common/".length))).href, context);
  }
  return next(specifier, context);
}

export async function load(url, context, next) {
  if (!url.split("?")[0].endsWith(".pegjs")) return next(url, context);
  const peggy = createRequire(import.meta.url)("peggy");
  const source = peggy.generate(readFileSync(fileURLToPath(url), "utf8"), { output: "source", format: "es" });
  const withDefault = /export\s+default/.test(source)
    ? source
    : `${source}\nexport default { parse: peg$parse, SyntaxError: peg$SyntaxError };`;
  return { format: "module", source: withDefault, shortCircuit: true };
}

/**
 * Register these hooks for the rest of this process.
 *
 * @param {string} app the Foundry copy's `app/` directory
 */
export function registerFoundryClientHooks(app) {
  register(import.meta.url, { data: { common: join(app, "common") } });
}
