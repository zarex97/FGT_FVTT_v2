/**
 * @file The escape hatch — a closed registry of named scripts.
 * @see docs/24-rules-engine.md, docs/44-case-expanded-roster.md §44.6
 *
 * `rules/elements.mjs`'s `Script` element has promised this since it was
 * written — *"Scripts are named entries in a closed registry, never `eval`.
 * Compendia are shared, so content must not be able to execute."* — and there
 * has been nothing to promise. It collected `{event, script, source}` into
 * `eventHandlers` and **nothing read `handler.script`**.
 *
 * That is consistent rather than surprising: the corpus has zero Scripts, so
 * the hatch had never been opened. Ch. 34 and Ch. 36 both close their tallies
 * with *"Script elements: zero."*
 *
 * **CLOSED is the security property, not a style choice.** A compendium is data
 * other people wrote; a `script:` naming something outside this object runs
 * nothing and says so in the log. It does not throw — a malformed magnitude
 * must not take the whole turn down, and the same holds here — and it certainly
 * does not `eval`.
 *
 * Ch. 24's position stands: *"Scripts are the escape hatch, not the norm."*
 * Ch. 44 §44.6 budgets four across ~130 abilities. Adding a fifth entry here is
 * a design conversation, not a merge.
 */

import { rewindScript } from "./glass-game.mjs";

/**
 * Every script content may name, by name.
 * @type {Readonly<Record<string, (ctx: object) => object[]>>}
 */
export const SCRIPTS = Object.freeze({
  /**
   * *"Restoring an arbitrary historical snapshot across a unit set."*
   *
   * Ch. 44 §44.6 budgets it, and it is the only one of the four that is built.
   * Why this one is not data: every other ability in the corpus is a
   * COMPOSITION of named mechanisms. This one walks a unit set, resolves a
   * historical index, diffs two states and emits a heterogeneous batch — and it
   * has exactly one customer. A rule element generalising "rewind" from a
   * single example would be inventing a vocabulary for a shape nothing else
   * has.
   */
  "nurseryRhyme.rewind": rewindScript,
});

/**
 * Run a named script, or nothing.
 *
 * @param {string} name
 * @param {object} ctx
 * @returns {object[]} intents
 */
export function runScript(name, ctx) {
  const script = Object.prototype.hasOwnProperty.call(SCRIPTS, name) ? SCRIPTS[name] : null;
  if (typeof script !== "function") {
    // Loud but not fatal. A `script:` naming nothing is content that will do
    // less than its text says, and silence is how that goes unnoticed — but a
    // throw here would let one bad compendium entry stop a turn.
    console.warn(`FGT | No script named "${name}"; it did nothing.`);
    return [];
  }
  return script(ctx) ?? [];
}
