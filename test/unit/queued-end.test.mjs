/**
 * @file An End pressed outside its owner's Turn waits for that Turn's end (#65, ruling 19).
 * @see module/rules/platforms.mjs#deactivationVerdict, module/engine/queued-ends.mjs
 *
 * > *"This NP can be deactivated during Quetz's Turn or at the start or end of
 * > any Round or Turn."*
 *
 * Ruled 2026-10-02: pressed during somebody else's Turn -- the GM's slot
 * included -- the End is queued for the next boundary, and the bar says so.
 * During the owner's own Turn it ends at once. Every `window: any` block: the
 * fields, the platforms and Tenmōkaikai. Achilles's duel, which states no
 * window, falls back to his own Turn only. The engine had ended them at any
 * moment.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { deactivationVerdict } from "../../module/rules/platforms.mjs";
import { compiled, prepareFields } from "../helpers/field.mjs";
import { prepareSubjects } from "../helpers/subject.mjs";

beforeAll(async () => { await prepareSubjects(); await prepareFields(); }, 120_000);

const ask = (spec, ownTurn, over = {}) => deactivationVerdict(spec, {
  createdAt: 10, tick: 20, unitId: "q", ownerId: "q", turnsPerRound: 3, ownTurn, ...over,
});
const ANY = { byOwner: true, window: "any" };

describe("the verdict", () => {
  it("during the owner's Turn: ends now", () => {
    expect(ask(ANY, true)).toEqual({ ok: true });
  });

  it("during somebody else's Turn: allowed, and queued", () => {
    expect(ask(ANY, false)).toEqual({ ok: true, queued: true });
  });

  it("with no match running: ends now", () => {
    expect(ask(ANY, undefined)).toEqual({ ok: true });
  });

  it("a block that states no window is the owner's own Turn only", () => {
    expect(ask({ byOwner: true }, false)).toEqual({ ok: false, reason: "notOwnTurn" });
    expect(ask({ byOwner: true }, true)).toEqual({ ok: true });
  });

  it("the lockout still refuses before anything is queued", () => {
    expect(ask({ ...ANY, lockout: "2◈" }, false, { tick: 12 })).toEqual({ ok: false, reason: "locked", unlocksAt: 16 });
    expect(ask({ ...ANY, lockout: "2◈" }, false, { tick: 16 })).toEqual({ ok: true, queued: true });
  });
});

describe("the corpus", () => {
  it("every window: any block queues outside its owner's Turn", async () => {
    for (const id of ["quetz-piedra-del-sol", "jack-the-mist", "ozymandias-ramesseum-tentyris", "raikou-tenmokaikai"]) {
      const ability = await compiled(id);
      const spec = ability.system.deactivation ?? ability.system.field?.deactivation;
      expect(ask(spec, false), id).toEqual({ ok: true, queued: true });
    }
  });

  it("Achilles's duel states no window, so it is his own Turn only", async () => {
    const duel = await compiled("achilles-diatrekhon-aster-lonkhe");
    const spec = duel.system.deactivation ?? duel.system.field?.deactivation;
    expect(spec.window ?? null).toBeNull();
    expect(ask(spec, false)).toEqual({ ok: false, reason: "notOwnTurn" });
  });
});

describe("the engine", () => {
  const read = (f) => readFileSync(f, "utf8").replaceAll("\r\n", "\n");

  it("a field's End operation queues instead of ending", () => {
    const op = read("module/net/operations.mjs");
    const block = op.slice(op.indexOf("deactivateField: {"), op.indexOf("queueModeEnd: {"));
    expect(block).toMatch(/if \(verdict\.queued\) \{\s*return \{ ok: await queueEnd\(\{ kind: "field"/);
  });

  it("a platform's End queues instead of ending", () => {
    const src = read("module/engine/platforms.mjs");
    const fn = src.slice(src.indexOf("export async function deactivatePlatform"));
    expect(fn.slice(0, fn.indexOf("\n}\n"))).toMatch(/ownTurn: ownTurnOf\(platform\)[\s\S]*queueEnd\(\{ kind: "platform"/);
  });

  it("a Mode switched off outside its owner's Turn asks the GM to queue it", () => {
    expect(read("module/apps/actor-sheet/sheet.mjs")).toMatch(/FGTSocket\.request\("queueModeEnd"/);
  });

  it("the GM's slot is somebody else's Turn", () => {
    const src = read("module/engine/fields.mjs");
    const fn = src.slice(src.indexOf("export function ownTurnOf(field)"));
    expect(fn.slice(0, fn.indexOf("\n}\n"))).toMatch(/if \(acting === null\) return false;/);
  });

  it("the Turn's end pays the queue, after the end-of-Turn sequence", () => {
    const hooks = read("module/engine/scheduler-hooks.mjs");
    expect(hooks.indexOf("await payQueuedEnds(combat)")).toBeGreaterThan(hooks.indexOf('await run(scheduler.endTurn(board, ctx), "scheduler:endTurn")'));
  });

  it("the bar shows a queued End as waiting", () => {
    const bar = read("module/apps/hud/action-bar.mjs");
    expect(bar).toMatch(/FGT\.HUD\.EndQueued"/);
    expect(bar).toMatch(/FGT\.HUD\.EndQueuedNotice/);
  });
});
