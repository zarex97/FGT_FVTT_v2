#!/usr/bin/env node
/**
 * @file Evaluate an expression inside the running Foundry tab.
 *
 * A thin CDP shell: attach to the page already showing `/game`, run what is
 * piped in or passed as an argument, print the result as JSON.
 *
 * Exists because the document-touching layers had no unit tests — they needed a
 * live world — and every bug reported from the table so far has been in one of
 * them. `test/helpers/world.mjs` has since made `engine/io.mjs` reachable from
 * vitest, which narrows what this is for rather than removing it: a modelled
 * world answers what a writer *should* do, and this answers what the real one
 * did. `tools/check-world.mjs` holds the two against each other.
 *
 * Usage:
 *   node tools/fgt-eval.mjs "game.actors.size"
 *   echo "await something()" | node tools/fgt-eval.mjs
 *   echo "const a = game.actors.getName('X'); return a.name" | node tools/fgt-eval.mjs
 */

import { evaluate } from "./lib/cdp.mjs";

const expression = process.argv[2] ?? await new Promise((resolve) => {
  let buffer = "";
  process.stdin.on("data", (c) => { buffer += c; });
  process.stdin.on("end", () => resolve(buffer.trim()));
});

try {
  const out = await evaluate(expression);
  console.log(typeof out === "string" ? out : JSON.stringify(out));
} catch (err) {
  console.error(`FGT | ${err.message}`);
  process.exit(1);
}
