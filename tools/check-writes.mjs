#!/usr/bin/env node
/**
 * @file Which files may write a document directly.
 * @see docs/02-architecture.md
 *
 * Ch. 02 opened by stating a **single write choke point**: *"no code anywhere
 * in the system calls `actor.update()` directly"*, and `engine/applier.mjs`'s
 * own header calls itself *"the only place in the system that writes
 * documents"*. Neither was true. `engine/io.mjs` accounts for a third of the
 * engine's document writes; the other two thirds are spread across 29 files,
 * and nothing had ever counted them.
 *
 * The claim was not wrong about anything that matters -- it was too broad. What
 * `io.mjs` is a choke point for is **unit state**: the intents a rule produces
 * about Health, effects, cooldowns, records. Three other categories of write
 * were never in that vocabulary and have no business joining it -- chat message
 * flags, the lifecycle of Scene-embedded documents, and the Combat document.
 *
 * So the rule is stated narrowly and enforced, rather than stated broadly and
 * believed. Each exception below says which category it is and why, because the
 * point of an allowlist is the sentence next to the entry -- a bare list records
 * only that something was there first.
 *
 * This deliberately gates the FILE, not the line. A file already permitted to
 * write its own Regions may write one more without argument; a file that has
 * never written a document and starts is the thing worth a conversation.
 */

import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

const ROOT = resolve(".");
const MODULE_DIR = join(ROOT, "module");

/**
 * What counts as writing a document.
 *
 * `.delete()` is deliberately absent: `Map` and `Set` carry it too, and a
 * matcher that cannot tell a document from a collection reports noise, which is
 * how a check stops being read.
 */
const WRITE = /\.(?:update|createEmbeddedDocuments|deleteEmbeddedDocuments|setFlag|unsetFlag)\(/;

/** Lines that are prose rather than code. */
const COMMENT = /^\s*(?:\/\/|\/\*|\*)/;

/**
 * Why each file outside `engine/io.mjs` may write.
 *
 * `category` is the argument; `why` is the specific one. A file here is not
 * debt -- it is a write the intent vocabulary was never meant to carry.
 */
const ALLOWED = [
  // ── The write choke point itself ─────────────────────────────────────────
  { file: "engine/io.mjs", category: "unit-state", why: "the intent applier's write adapter — the choke point Ch. 02 is about" },

  // ── Chat message flags ───────────────────────────────────────────────────
  // A Combat Process is a state machine that lives on its chat card, because
  // the card is what crosses the socket and survives a reload. This is
  // presentation and coordination state, not unit state, and routing it through
  // an intent vocabulary would be ceremony with no reader.
  { file: "engine/attack.mjs", category: "message-flag", why: "the Combat Process state machine lives on its chat card" },
  { file: "engine/command-spells.mjs", category: "message-flag", why: "the spend dialog's card state" },
  { file: "engine/await-timeout.mjs", category: "message-flag", why: "stamps when a prompt card started waiting" },

  // ── Scene-embedded document lifecycle ────────────────────────────────────
  // Regions, RegionBehaviors, Levels and Tokens are created and destroyed, not
  // patched. An intent names a Unit and a field; none of these has either.
  { file: "engine/fields.mjs", category: "scene-lifecycle", why: "Bounded Fields are Regions with Behaviours, created and torn down" },
  { file: "engine/terrain.mjs", category: "scene-lifecycle", why: "terrain areas are Regions" },
  { file: "engine/scene-levels.mjs", category: "scene-lifecycle", why: "Levels and the tokens assigned to them" },
  { file: "engine/summoning.mjs", category: "scene-lifecycle", why: "places the tokens a summon puts on the board" },
  { file: "engine/war-setup.mjs", category: "scene-lifecycle", why: "places the war's starting tokens" },
  { file: "engine/marks.mjs", category: "scene-lifecycle", why: "a Mark is a placed token; visibility rides its document" },
  { file: "engine/escape.mjs", category: "scene-lifecycle", why: "writes the RegionBehavior that holds a Unit inside a Field" },
  { file: "engine/token-vision.mjs", category: "scene-lifecycle", why: "vision is token configuration, not unit state" },
  { file: "engine/token-footprint.mjs", category: "scene-lifecycle", why: "footprint is token geometry" },
  { file: "engine/token-image.mjs", category: "scene-lifecycle", why: "token artwork" },
  { file: "engine/faction-ownership.mjs", category: "scene-lifecycle", why: "document ownership, which is permission rather than state" },

  // ── The Combat document ──────────────────────────────────────────────────
  // The clock, the turn order, the budget and the log. An intent is a thing
  // done TO a Unit; none of these is about a Unit at all.
  { file: "engine/scheduler-hooks.mjs", category: "combat-document", why: "advances the ◈ clock and claims the turn boundary" },
  { file: "engine/budget.mjs", category: "combat-document", why: "the faction action pools live on a Combat flag" },
  { file: "engine/game-log.mjs", category: "combat-document", why: "the match log, and its journal spill" },

  // ── Owner-side bookkeeping that predates the vocabulary ──────────────────
  // These are unit-state writes that never got an intent. They are the only
  // entries here that are honestly debt, and they are marked so.
  { file: "engine/channel.mjs", category: "debt", why: "channelled-ability state; no intent exists for it yet" },
  { file: "engine/shield.mjs", category: "debt", why: "shield pools, guarded by hand-rolled no-op checks" },
  { file: "engine/summon.mjs", category: "debt", why: "summon bookkeeping on the owner" },
  { file: "engine/concealment.mjs", category: "debt", why: "discovery budget and disclosure" },
  { file: "engine/copy.mjs", category: "debt", why: "rewrites a copier's embedded ability items wholesale" },
  { file: "engine/hgob.mjs", category: "debt", why: "the Garden's own base attack and owner links" },
  { file: "engine/vision.mjs", category: "debt", why: "the seen-unit set" },
  { file: "engine/skill-use.mjs", category: "debt", why: "marks an ability expended" },
  { file: "engine/movement-hooks.mjs", category: "debt", why: "strips effects a forced move invalidates" },
  { file: "engine/dimension.mjs", category: "debt", why: "platform state inside a pocket dimension" },
  { file: "engine/actions.mjs", category: "debt", why: "facing and the carry-Master toggle" },

  // ── Above the engine ─────────────────────────────────────────────────────
  // Ch. 02's claim was about rules resolving. These are not that: a person
  // editing a document through its own sheet, a Combat document managing its
  // own combatants, a migration rewriting storage, and the socket operations
  // that are the GM's side of a player's request.
  { file: "apps/actor-sheet/sheet.mjs", category: "ui-edit", why: "stance buttons and the ability editor write what a person typed" },
  { file: "apps/ability-editor/editor.mjs", category: "ui-edit", why: "the authoring surface for an ability item" },
  { file: "apps/actor-purge.mjs", category: "ui-edit", why: "the GM's cleanup tool, which deletes tokens and repairs a match" },
  { file: "apps/image-edit.mjs", category: "ui-edit", why: "token and portrait artwork" },
  { file: "apps/chat/cards.mjs", category: "ui-edit", why: "a card rewriting its own flags as it is interacted with" },
  { file: "apps/hud/action-bar.mjs", category: "ui-edit", why: "immediate toggles the bar owns" },
  { file: "apps/canvas/target-region.mjs", category: "ui-edit", why: "the targeting preview's own Region" },
  { file: "apps/canvas/targeting-hud.mjs", category: "ui-edit", why: "the targeting preview's own Region" },
  { file: "apps/canvas/targeting-layer.mjs", category: "ui-edit", why: "the targeting preview's own Region" },
  { file: "documents/combat.mjs", category: "combat-document", why: "the Combat document managing its own combatants and turn order" },
  { file: "migration/runner.mjs", category: "migration", why: "rewriting stored documents wholesale is what a migration IS" },
  { file: "net/operations.mjs", category: "socket", why: "the GM's side of a player's request; the applyIntents op still goes through io" },
];

/** @param {string} dir @returns {Promise<string[]>} */
async function walk(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (entry.name.endsWith(".mjs")) out.push(full);
  }
  return out;
}

const permitted = new Map(ALLOWED.map((e) => [e.file, e]));
/** @type {Map<string, number>} */
const found = new Map();

for (const absolute of await walk(MODULE_DIR)) {
  const rel = relative(MODULE_DIR, absolute).split(sep).join("/");
  const lines = (await readFile(absolute, "utf8")).split("\n");
  const hits = lines.filter((l) => WRITE.test(l) && !COMMENT.test(l)).length;
  if (hits > 0) found.set(rel, hits);
}

/** @type {string[]} */
const problems = [];

for (const [rel, hits] of found) {
  if (permitted.has(rel)) continue;
  problems.push(
    `${rel}: writes a document directly (${hits} site(s)), and is not in the allowlist. `
    + "Emit an intent and let engine/io.mjs write it — or, if this is a chat flag, a "
    + "Scene-embedded document or the Combat document, add it to tools/check-writes.mjs "
    + "with the category and the reason.",
  );
}

// An exception nobody needs any more is debt that was paid. Say so, so the list
// shrinks instead of ossifying -- the same discipline check-layers.mjs applies.
for (const e of ALLOWED) {
  if (!found.has(e.file)) {
    problems.push(`${e.file}: no longer writes a document — remove it from tools/check-writes.mjs.`);
  }
}

if (problems.length > 0) {
  for (const p of problems) console.error(`error    ${p}`);
  console.error(`\nFGT | ${problems.length} direct-write problem(s). See docs/02-architecture.md.`);
  process.exit(1);
}

const debt = ALLOWED.filter((e) => e.category === "debt").length;
const sites = [...found.values()].reduce((a, b) => a + b, 0);
console.log(
  `FGT | Document writes accounted for (${sites} site(s) across ${found.size} file(s); `
  + `${debt} still owed an intent).`,
);
