/**
 * @file A channel counts every Turn, as every other ◈ clock does (#68).
 * @see module/engine/channel.mjs, docs/04-time-model.md, docs/46 §46.4-CL
 *
 * > *"Semiramis cannot Act for 3◈ Turns."*
 *
 * 1◈ is one Round, `turnsPerRound` Turns (Ch. 04), and every other ◈ clock --
 * an effect's `expiresAt`, an ability's cooldown -- counts the global Turn.
 * `advanceChannels` counted only the bearer's OWN Turns, so a 9-Turn channel
 * took nine Rounds: three times the sheet's 3◈.
 */

import { describe, it, expect } from "vitest";
import { channelProgress } from "../../module/engine/channel.mjs";

describe("channelProgress", () => {
  const channel = { startedTick: 71, ticksRequired: 9 };

  it("counts the Turn it began in and every Turn after it, whoever's", () => {
    expect(channelProgress(channel, 71)).toEqual({ elapsed: 1, complete: false });
    expect(channelProgress(channel, 75)).toEqual({ elapsed: 5, complete: false });
  });

  it("completes at the end of the ninth Turn -- three Rounds, not nine", () => {
    expect(channelProgress(channel, 79)).toEqual({ elapsed: 9, complete: true });
  });
});
