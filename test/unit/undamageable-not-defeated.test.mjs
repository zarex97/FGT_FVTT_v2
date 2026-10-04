/**
 * @file A Unit with no Health is never defeated by a hit (#180).
 * @see module/engine/attack.mjs#resolveDefeatOf, module/domain/health.mjs#isUndamageable
 *
 * Live: Asterios attacked Pale Rider, the hit was negated to 0 by his nature,
 * and he was defeated. `resolveDefeatOf` read his null Health as 0, so
 * `0 - 0` was "out of Health". The stale 1500 that 6376e1a removed had hidden
 * it.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { prepareSubjects } from "../helpers/subject.mjs";
import { installClientNamespace } from "../helpers/client-namespace.mjs";

beforeAll(async () => { await prepareSubjects(); installClientNamespace(); }, 60_000);

describe("resolveDefeatOf", () => {
  it("returns no defeat for a defender with null Health", async () => {
    const { defeatFromDamage } = await import("../../module/engine/attack.mjs");
    expect(await defeatFromDamage({ id: "pr", health: null })).toEqual([]);
  });
});
