/**
 * @file Every interface reader of Luck asks the board, so a platform that shares its summoner's Luck shows hers (#169).
 * @see module/engine/board.mjs#luckOf, module/rules/snapshot.mjs#annotatePlatforms, docs/27-platforms-and-levels.md
 *
 * > *"Luck: Shared with Quetz's"* -- the Quetzalcoatlus.
 *
 * #162 made the pool one: the engine writes to the owner's actor (`engine/io.mjs#luckPoolOf`) and the projection
 * carries her CURRENT Luck on the platform's snapshot. The mount's own actor still stores a dead 0, and three
 * interface readers took that instead: the action bar's Luck row, the chat card's Luck rung (its Contest button was
 * disabled with "no Luck"), and the `luckCheck` dialog's body. The decision is in the board's number, so the
 * behavioural half builds the real projection; the guard half reads the source, because a fourth reader that goes
 * back to `actor.system.luck` is invisible to every test that does not happen to render it.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { installClientNamespace } from "../helpers/client-namespace.mjs";

beforeAll(prepareSubjects, 60_000);

const ID = { quetz: "quetzSubject0001", mount: "mountSubject0001", knight: "knightSubject001" };

/** Quetz with 20 of 20 Luck, and the mount she owns -- whose own document holds 0. */
const pair = [
  { from: "quetzalcoatl", id: ID.quetz, state: { luck: { value: 20, max: 20 } }, panel: { i: 5, j: 5, k: 1 } },
  { from: "quetzalcoatlus", id: ID.mount, state: { ownerId: ID.quetz, luck: { value: 0, max: 0 } }, panel: { i: 5, j: 5, k: 1 } },
];

/** The world's i18n answers a key with the key; the button's label is its numbers, so this one shows them. */
function withInterpolatingI18n() {
  const { i18n } = globalThis.game;
  i18n.format = (key, data) => `${key}:${JSON.stringify(data)}`;
  i18n.localize = (key) => key;
}

const prompt = (unitId) => ({ kind: "luckCheck", unitId });

describe("the Luck a platform that shares its summoner's shows", () => {
  it("is hers on the board, though its own actor holds 0", async () => {
    await withSubjects(pair, async ({ unit, world }) => {
      expect(world.actor(ID.mount).system.luck.value).toBe(0);
      expect(unit(ID.mount).luck).toBe(20);
    }, { tokens: true });
  });

  it("is what `luckOf` reads, with her maximum", async () => {
    await withSubjects(pair, async ({ board, world }) => {
      const { luckOf } = await import("../../module/engine/board.mjs");
      expect(luckOf(board, world.actor(ID.mount))).toEqual({ value: 20, max: 20 });
    }, { tokens: true });
  });

  it("enables the Luck rung's Contest button and shows her Luck", async () => {
    await withSubjects(pair, async ({ world }) => {
      installClientNamespace();
      withInterpolatingI18n();
      const { promptOptions } = await import("../../module/apps/chat/cards.mjs");
      const [contest] = promptOptions(prompt(world.actor(ID.mount).id));
      expect(contest.event).toBe("contest");
      expect(contest.disabled).toBe(false);
      expect(contest.hint).toBeNull();
      expect(contest.label).toContain('"luck":20');
    }, { tokens: true });
  });

  it("still disables Contest for a Unit that has none", async () => {
    const specs = [{ from: "heracles", id: ID.knight, state: { luck: { value: 0, max: 5 } }, panel: { i: 5, j: 5, k: 1 } }];
    await withSubjects(specs, async () => {
      installClientNamespace();
      withInterpolatingI18n();
      const { promptOptions } = await import("../../module/apps/chat/cards.mjs");
      const [contest] = promptOptions(prompt(ID.knight));
      expect(contest.disabled).toBe(true);
    }, { tokens: true });
  });
});

/* ── No `apps/` file reads the actor's Luck ───────────────────────────────── */

/** @returns {string[]} every `.mjs` file under a directory */
function sourcesUnder(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourcesUnder(path) : path.endsWith(".mjs") ? [path] : [];
  });
}

/**
 * Files under `module/apps/` allowed to read `system.luck` directly, and why. Empty on purpose: the sheet's bar
 * (`actor-sheet/context.mjs`) reads `system[key]` by a computed key, which this does not match, and edits the
 * stored number -- the sheet is where a platform's own 0 is the honest answer.
 */
const ALLOWED = new Map([]);

describe("the interface's readers of Luck", () => {
  const files = sourcesUnder("module/apps");

  it("never read `system.luck` off an actor", () => {
    const offenders = files.filter((file) => {
      if (ALLOWED.has(file.replace(/\\/g, "/"))) return false;
      const src = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
      return /system\??\.luck\b/.test(src);
    });
    expect(offenders, "ask `engine/board.mjs#luckOf` (the board's Luck), not the actor's stored number (#169)").toEqual([]);
  });

  it("go through the board for the three that showed it", () => {
    for (const file of ["module/apps/hud/action-bar.mjs", "module/apps/chat/cards.mjs", "module/apps/prompt.mjs"]) {
      const src = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
      expect(src, `${file} does not ask luckOf`).toMatch(/luckOf\(/);
    }
  });
});
