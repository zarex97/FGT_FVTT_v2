/**
 * @file Static checks for Handlebars templates.
 * @see docs/29-user-interface.md
 *
 * Template defects have the slowest feedback loop in the project: they are
 * invisible to ESLint, invisible to the tests, and surface as a stack trace
 * inside Foundry at render time. Two have already shipped —
 *
 *   1. `{{array …}}` and `{{upper …}}`, helpers Foundry does not register.
 *   2. `{{selectOptions players …}}` inside `{{#each}}`, where a bare name
 *      resolves against the **item** rather than the template context, so the
 *      helper received `undefined` and threw.
 *
 * — so both are checked here, statically, with no Handlebars dependency.
 */

/**
 * Every helper Foundry v14 registers, from
 * `client/applications/handlebars.mjs`. A name outside this set is either a
 * typo or a helper the system must register itself.
 */
export const FOUNDRY_HELPERS = new Set([
  "checked", "disabled", "concat", "editor", "formInput", "formGroup", "formField",
  "filePicker", "ifThen", "localize", "numberFormat", "numberInput", "object",
  "radioBoxes", "rangePicker", "selectOptions", "timeSince",
  "eq", "ne", "lt", "gt", "lte", "gte", "not", "and", "or",
]);

/** Handlebars' own built-ins, which are not in Foundry's registry. */
const BUILTINS = new Set([
  "if", "unless", "each", "with", "log", "lookup", "blockHelperMissing",
  "helperMissing", "else", "this",
]);

/**
 * Helpers that throw on `undefined` rather than rendering nothing. An argument
 * that silently resolves to `undefined` is a crash in these, so their arguments
 * are scope-checked.
 */
const STRICT_HELPERS = new Set(["selectOptions", "radioBoxes", "formGroup", "formInput"]);

/**
 * Check one template's source.
 *
 * @param {string} path for the message
 * @param {string} source
 * @returns {string[]} problems, empty when the template is sound
 */
export function checkTemplate(path, source) {
  /** @type {string[]} */
  const problems = [];
  const text = stripComments(source);

  // A stack of the block params in scope, innermost last.
  /** @type {string[][]} */
  const scopes = [];
  let depth = 0;

  const mustache = /\{\{~?([#/]?)\s*([^}]*?)~?\}\}/g;
  let match;

  while ((match = mustache.exec(text)) !== null) {
    const [, sigil, body] = match;
    const line = text.slice(0, match.index).split("\n").length;

    if (sigil === "/") {
      const name = body.trim();
      if (name === "each" || name === "with") {
        scopes.pop();
        depth--;
      }
      continue;
    }

    const tokens = tokenize(body);
    if (tokens.length === 0) continue;
    const name = tokens[0];

    if (sigil === "#") {
      if (name === "each" || name === "with") {
        scopes.push(blockParams(body));
        depth++;
      }
      continue;
    }

    // ── 1. Does the helper exist? ─────────────────────────────────────────
    // Only a multi-token mustache is a helper call; `{{foo}}` is a path.
    if (tokens.length > 1 && isBareName(name) && !BUILTINS.has(name)) {
      if (!FOUNDRY_HELPERS.has(name)) {
        problems.push(`${path}:${line}: unknown helper "${name}" — Foundry v14 does not register it`);
      }
    }

    // ── 2. Would a strict helper's argument be undefined here? ────────────
    if (!STRICT_HELPERS.has(name) || depth === 0) continue;

    const inScope = new Set(scopes.flat());
    for (const arg of tokens.slice(1)) {
      if (arg.includes("=")) continue;                 // a hash option
      if (!isBareName(arg.split(".")[0])) continue;    // a literal
      const root = arg.split(".")[0];
      if (root === "this" || inScope.has(root)) continue;

      problems.push(
        `${path}:${line}: {{${name} ${arg} …}} is inside {{#each}}, where "${root}" resolves ` +
        `against the item rather than the context. Use "@root.${arg}" or "../${arg}".`,
      );
    }
  }

  return problems;
}

/* -------------------------------------------------------------------------- */

/**
 * @param {string} source
 * @returns {string}
 */
function stripComments(source) {
  return source.replace(/\{\{!--[\s\S]*?--\}\}/g, "").replace(/\{\{![\s\S]*?\}\}/g, "");
}

/**
 * Split a mustache body into tokens, keeping quoted strings and
 * subexpressions whole.
 *
 * @param {string} body
 * @returns {string[]}
 */
function tokenize(body) {
  const tokens = [];
  let current = "";
  let quote = null;
  let parens = 0;

  for (const ch of body.trim()) {
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; current += ch; continue; }
    if (ch === "(") parens++;
    if (ch === ")") parens--;
    if (/\s/.test(ch) && parens === 0) {
      if (current) tokens.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current) tokens.push(current);
  return tokens;
}

/**
 * The names declared by `as |a b|` on a block.
 *
 * @param {string} body
 * @returns {string[]}
 */
function blockParams(body) {
  const match = /\bas\s*\|([^|]*)\|/.exec(body);
  return match ? match[1].trim().split(/\s+/).filter(Boolean) : [];
}

/**
 * Is this a plain identifier, rather than a literal, a path prefix or a
 * subexpression?
 *
 * @param {string} token
 * @returns {boolean}
 */
function isBareName(token) {
  return /^[A-Za-z_][\w-]*$/.test(token);
}
