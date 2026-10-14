/**
 * @file One reader of the live clock, one comparison for an expiry.
 * @see module/domain/moment.mjs, module/engine/board.mjs#currentMoment, module/domain/tick.mjs#expiryReached, docs/04-time-model.md
 *
 * About ten Surprises were the same mistake: something that runs at a Round's
 * or a Turn's end read the live clock, which had already moved on. The cure is
 * a boundary naming its Moment and handing it down. These guards keep the
 * number of places that read the clock for themselves from growing, and keep
 * the "has it expired?" comparison in one function.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { moment, NO_MOMENT } from "../../module/domain/moment.mjs";
import { expiryReached } from "../../module/domain/tick.mjs";
import { INFINITE } from "../../module/domain/enums.mjs";

/** Every `.mjs` under `module/`, with `/` separators on any checkout. */
function sources(dir = "module") {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return path.endsWith(".mjs") ? [path.replace(/\\/g, "/")] : [];
  });
}

/** Code lines only: comments stripped, CRLF or not. */
function codeLines(path) {
  const text = readFileSync(path, "utf8").replace(/\r\n/g, "\n").replace(/\/\*[\s\S]*?\*\//g, "");
  return text.split("\n").map((l) => l.replace(/\/\/.*$/, ""));
}

/**
 * A direct read of the match's clock: its Round, or its Tick (`globalTurn`),
 * or the two live readers in `engine/board.mjs`.
 */
const CLOCK_READ = /\bsystem\??\.globalTurn\b|\bcombat\??\.round\b|\bcombats\??\.active\??\.round\b|\b(?:currentTick|currentRound|nowTick)\(\)/;

/** Where the clock is allowed to be read: the Moment's own funnel, and the Combat's getter. */
const FUNNEL = new Set(["module/engine/board.mjs", "module/domain/moment.mjs", "module/documents/combat.mjs"]);

/**
 * How many lines outside the funnel read the clock themselves.
 *
 * It may only go DOWN. A new reader should take the Moment its caller names
 * (`currentBoard({moment})`, `unitSnapshot(actor, token, {moment})`), or
 * `currentMoment()` when it truly means "now". When a change removes direct
 * reads, lower this number to what the test reports.
 */
const DIRECT_CLOCK_READS = 107;

describe("the live clock", () => {
  it(`is read directly in no more than ${DIRECT_CLOCK_READS} lines outside the funnel`, () => {
    const hits = sources()
      .filter((f) => !FUNNEL.has(f))
      .flatMap((f) => codeLines(f).flatMap((l, n) => (CLOCK_READ.test(l) ? [`${f}:${n + 1}`] : [])));
    expect(hits.length, `A new direct read of the clock. Take the boundary's Moment instead:\n${hits.join("\n")}`)
      .toBeLessThanOrEqual(DIRECT_CLOCK_READS);
    expect(hits.length, `Direct clock reads fell to ${hits.length}: lower DIRECT_CLOCK_READS to it.`)
      .toBe(DIRECT_CLOCK_READS);
  });
});

describe("a Moment", () => {
  it("is a Round and a Tick, frozen", () => {
    expect(moment(9, 29)).toEqual({ round: 9, tick: 29 });
    expect(Object.isFrozen(moment(9, 29))).toBe(true);
    expect(NO_MOMENT).toEqual({ round: null, tick: null });
  });
});

describe("an expiry", () => {
  it.each([
    [null, 10, false],
    [undefined, 10, false],
    [INFINITE, 10, false],
    [9, 10, true],
    [10, 10, true],
    [11, 10, false],
    [10, undefined, false],
  ])("expiryReached(%s, %s) is %s", (expiry, tick, reached) => {
    expect(expiryReached(expiry, tick)).toBe(reached);
  });

  it("is compared in one place", () => {
    const copies = sources()
      .filter((f) => f !== "module/domain/tick.mjs")
      .flatMap((f) => codeLines(f).flatMap((l, n) => (
        /\.expiry\s*<=|expiry !== undefined && \S*expiry <=/.test(l) ? [`${f}:${n + 1}`] : [])));
    expect(copies, "Ask `domain/tick.mjs#expiryReached` instead of comparing an expiry by hand").toEqual([]);
  });
});
