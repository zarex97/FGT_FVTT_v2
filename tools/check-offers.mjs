#!/usr/bin/env node
/**
 * @file A prompt listing a Unit's abilities asks the gate their press runs.
 * @see module/engine/press-gate.mjs, docs/23-reactions.md, #244
 *
 * An offer is a reader of the use gate: a window, a reaction rung or a prompt
 * offers only what its press would let through. Each offer built its own list,
 * and the two disagreed at least eight times, each fixed only where an audit
 * looked. Four were Kiritsugu's (#243), and one of those, the free-Spell prompt,
 * was a NEW site: a behaviour test written before it could not have held it.
 * `test/unit/offer-gate-244.test.mjs` holds the known sites; this holds the
 * next one.
 *
 * What it reads as an ability offer: an `askOwner(` or `chooseFor(` call whose
 * `options:` maps a list declared in the same function from a Unit's `.items`
 * (or from a window's or a rung's ability list). That list must come from
 * `offerable(...)`. A list that is not a use (abilities to copy, cooldowns to
 * cut) says why, in the call or on the three lines above it:
 *
 *     // fgt-offer-ok: picks whose Cooldown to cut, not a use
 *
 * A bare marker is refused. A list handed in as a parameter is not followed:
 * that is the scan's known limit, and the behaviour test's to hold.
 */

import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

const ROOT = resolve(".");
const DIRS = ["engine", "apps"].map((d) => join(ROOT, "module", d));

/** The prompt helpers a Unit's player answers. */
const CALL = /\b(askOwner|chooseFor)\(/g;

/** A list built from a Unit's abilities. */
const ABILITY_LIST = /\.items\b|abilitiesAtWindow\(|reactionAbilities\(|allyReactions\(/;

/** The marker, and the reason after it. */
const MARKER = /fgt-offer-ok:([^\n]*)/;

/**
 * The text from an opening parenthesis to its match.
 *
 * @param {string} src
 * @param {number} open the index of `(`
 * @returns {string}
 */
function balanced(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "(") depth++;
    else if (src[i] === ")" && --depth === 0) return src.slice(open, i + 1);
  }
  return src.slice(open);
}

/**
 * The expression an `options:` maps, up to its `.map(`: `candidates`,
 * `owner.items.filter(...)`, `[...spells]`. `null` for a literal list.
 *
 * @param {string} call the prompt call's text
 * @returns {string|null}
 */
function mappedList(call) {
  const at = call.indexOf("options:");
  if (at < 0) return null;
  let depth = 0;
  for (let i = at + "options:".length; i < call.length; i++) {
    const ch = call[i];
    if ("([{".includes(ch)) depth++;
    else if (")]}".includes(ch)) {
      if (depth === 0) return null;
      depth--;
    } else if (depth === 0 && ch === ",") return null;
    if (depth === 0 && call.startsWith(".map(", i)) return call.slice(at + "options:".length, i);
  }
  return null;
}

/**
 * The variable an expression starts from, past an `await`, a spread or a paren.
 *
 * @param {string} expr
 * @returns {string|null}
 */
function leadingName(expr) {
  return /^\s*(?:await\s+)?(?:Promise\.all\(\s*)?[([]?\s*(?:\.\.\.\s*)?([A-Za-z_$][\w$]*)/.exec(expr)?.[1] ?? null;
}

/**
 * What a list declared in a function holds, followed through the lists it is
 * built from: `candidates = ofCategory.filter(...)` over `ofCategory =
 * owner.items...` is an ability list too.
 *
 * @param {string} body the function's text up to the prompt
 * @param {string} name the list's variable
 * @param {number} [depth]
 * @returns {"gated"|"abilities"|null} `null` when it is not an ability list
 */
function listOf(body, name, depth = 0) {
  const decl = [...body.matchAll(new RegExp(`(?:const|let)\\s+${name}\\s*=([\\s\\S]*?);\\n`, "g"))].at(-1)?.[1];
  if (!decl) return null;
  if (/\bofferable\(/.test(decl)) return "gated";
  if (ABILITY_LIST.test(decl)) return "abilities";
  if (depth >= 3) return null;
  for (const [ident] of decl.matchAll(/\b[A-Za-z_$][\w$]*\b/g)) {
    if (ident === name) continue;
    const held = listOf(body, ident, depth + 1);
    if (held) return held;
  }
  return null;
}

/**
 * Ability prompts in one file's text that no gate was asked about.
 *
 * @param {string} text a module's source
 * @returns {Array<{line: number, list: string, problem: string}>}
 */
export function abilityOffers(text) {
  const src = text.replace(/\r\n/g, "\n");
  const lines = src.split("\n");
  const out = [];
  for (const m of src.matchAll(CALL)) {
    const start = m.index;
    if (/function\s+$/.test(src.slice(Math.max(0, start - 20), start))) continue;
    const call = balanced(src, start + m[0].length - 1);
    const options = mappedList(call);
    if (!options) continue;

    // The enclosing function, from its last top-level `function` line.
    const before = src.slice(0, start);
    const fnStart = [...before.matchAll(/(?:^|\n)(?:export\s+)?(?:async\s+)?function[\s*]/g)].at(-1)?.index ?? 0;
    const body = before.slice(fnStart);
    const held = /\bofferable\(/.test(options) ? "gated"
      : ABILITY_LIST.test(options) ? "abilities"
        : listOf(body, leadingName(options) ?? "");
    if (held !== "abilities") continue;
    const list = ABILITY_LIST.test(options) ? options.trim() : (leadingName(options) ?? options.trim());

    const line = before.split("\n").length;
    const above = lines.slice(Math.max(0, line - 4), line - 1).join("\n");
    const marker = MARKER.exec(call) ?? MARKER.exec(above);
    if (marker) {
      if (marker[1].trim().split(/\s+/).filter(Boolean).length >= 2) continue;
      out.push({ line, list, problem: "has an `fgt-offer-ok` marker without a reason: say why this list is not a use" });
      continue;
    }
    out.push({
      line, list,
      problem: "lists ability Items without asking their gate: ask `offerable` (engine/press-gate.mjs), "
        + "or mark why not with `// fgt-offer-ok: <reason>`",
    });
  }
  return out;
}

/**
 * @param {string} dir
 * @returns {AsyncGenerator<string>}
 */
async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (entry.name.endsWith(".mjs")) yield path;
  }
}

async function main() {
  const problems = [];
  let files = 0;
  for (const dir of DIRS) {
    for await (const path of walk(dir)) {
      files++;
      const rel = relative(join(ROOT, "module"), path).split(sep).join("/");
      for (const p of abilityOffers(await readFile(path, "utf8"))) {
        problems.push(`module/${rel}:${p.line}: \`${p.list}\` ${p.problem}`);
      }
    }
  }
  for (const p of problems) console.error(`error    ${p}`);
  if (problems.length > 0) {
    console.error(`\nFGT | ${problems.length} ability prompt(s) offer what no gate was asked about.`);
    process.exitCode = 1;
    return;
  }
  console.log(`FGT | Ability offers gated (${files} file(s) checked).`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"))) {
  await main();
}
