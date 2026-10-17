#!/usr/bin/env node
/**
 * @file No player-facing line names a Unit by its True Name.
 * @see docs/30-concealment-and-identity.md, #235
 *
 * A concealed Servant is known to the table by its class until its identity is
 * revealed, and every card, prompt, banner and preview that names a Unit must
 * say what the table knows: `engine/public-identity.mjs#shownName` (an Actor or
 * a board unit) or `rules/identity.mjs#shownNameOf` (a board unit, in the rules
 * layer). Reading a Unit's `.name` prints the True Name.
 *
 * It slipped three times, each time fixed only where an audit looked: Arturia's
 * roll lines (#230 §46.4-NV), Proto Gil's follow-up and Enki lines (#232
 * §46.4-OJ), and Arjuna's Command Spell, boundary, periodic and revival cards
 * (#234 §46.4-OO). A CLAUDE.md lesson covered the new lines and not the old
 * ones, so the rule is enforced here instead.
 *
 * What it reads as a Unit's name: `.name` off `game.actors.get(…)` or off a
 * variable whose name says it holds a Unit (`actor`, `unit`, `defender`, …).
 * It cannot tell a Unit from an ability held in `a`, or a prompt shown to the
 * Unit's own player from a card the whole table reads, so a read that is not a
 * leak says why, on its own line:
 *
 *     name: actor.name, // fgt-name-ok: the owner's own prompt
 *
 * and a file whose every read is safe is listed in `FILES` below with its
 * reason. The point of either is the sentence: a bare marker is refused.
 */

import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

const ROOT = resolve(".");
const DIRS = ["engine", "apps", "rules"].map((d) => join(ROOT, "module", d));

/** Variables that hold a Unit, by the names the codebase gives them. */
const HOLDERS = [
  "actor", "servant", "defender", "attacker", "unit", "u", "target", "owner", "caster", "summoner",
  "victim", "bearer", "holder", "doc", "prey", "decoy", "partner", "provoker", "a", "b",
];

/** A Unit's display name, read raw. */
export const NAME_READ = new RegExp(
  String.raw`(?:game\.actors\.get\([^)]*\)\??|\b(?:${HOLDERS.join("|")})\??)\.name\b`,
);

/** Not a Unit: an ability, an item, an effect, a definition, a user. */
const NOT_A_UNIT = /\b(?:item|ability|effect|def|i|held|command|platform|field|user)\??\.name\b/;

/** Lines that are prose rather than code. */
const COMMENT = /^\s*(?:\/\/|\/\*|\*)/;

/** The marker a safe read carries, with its reason. */
const MARKER = /\/\/\s*fgt-name-ok:\s*(\S.*)$/;

/**
 * Files whose every read is safe, and why. Gated by FILE, as `check-writes`
 * is: a file that starts naming Units on cards is the conversation.
 */
const FILES = [
  { file: "rules/identity.mjs", why: "the public name's own definition reads the true one to decide" },
  { file: "rules/snapshot.mjs", why: "the projection: a unit's `name` is copied from its actor, read by everything above" },
  { file: "rules/registry.mjs", why: "effect definitions, not Units" },
  { file: "rules/cs-registry.mjs", why: "Command Spell definitions, not Units" },
  { file: "rules/np-strength.mjs", why: "ability names in the GM's balance report" },
  { file: "engine/game-log.mjs", why: "the game log, read by the GM's log viewer" },
  { file: "engine/io.mjs", why: "the log entry's summary, read by the GM's log viewer" },
  { file: "apps/log-viewer.mjs", why: "the GM's log viewer" },
  { file: "apps/ability-editor/editor.mjs", why: "the GM's authoring tool" },
  { file: "apps/actor-purge.mjs", why: "the GM's world cleanup" },
  { file: "apps/setup-wizard.mjs", why: "the GM's war setup; its names are Users" },
  { file: "apps/faction-config.mjs", why: "the GM's faction setup; its names are Users" },
  { file: "apps/actor-sheet/context.mjs", why: "a sheet renders per viewer and exempts the owner (Ch. 30)" },
];

/**
 * Every unmarked Unit-name read in one file's text.
 *
 * @param {string} text
 * @returns {Array<{line: number, expression: string, problem: string}>}
 */
export function unitNameReads(text) {
  const out = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  lines.forEach((line, n) => {
    if (COMMENT.test(line)) return;
    const code = line.replace(MARKER, "");
    const match = code.match(NAME_READ);
    if (!match || NOT_A_UNIT.test(match[0]) && !NAME_READ.test(code.replace(NOT_A_UNIT, ""))) return;
    const marker = line.match(MARKER) ?? (n > 0 ? lines[n - 1].match(MARKER) : null);
    if (marker) return;
    out.push({
      line: n + 1,
      expression: match[0],
      problem: "names a Unit by its True Name: ask `shownName` (engine/apps) or `shownNameOf` (rules), "
        + "or say why it is safe with `// fgt-name-ok: <reason>`",
    });
  });
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
  const allowed = new Set(FILES.map((f) => f.file));
  const problems = [];
  let files = 0;
  for (const dir of DIRS) {
    for await (const path of walk(dir)) {
      const rel = relative(join(ROOT, "module"), path).split(sep).join("/");
      if (allowed.has(rel)) continue;
      files++;
      for (const p of unitNameReads(await readFile(path, "utf8"))) {
        problems.push(`module/${rel}:${p.line}: \`${p.expression}\` ${p.problem}`);
      }
    }
  }
  for (const p of problems) console.error(`error    ${p}`);
  if (problems.length > 0) {
    console.error(`\nFGT | ${problems.length} Unit name(s) read raw where a player may read them.`);
    process.exitCode = 1;
    return;
  }
  console.log(`FGT | Public names intact (${files} file(s) checked, ${FILES.length} allowlisted).`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"))) {
  await main();
}
