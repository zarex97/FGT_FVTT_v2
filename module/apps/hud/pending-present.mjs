/**
 * @file What the pending-decisions window lists, and in what order.
 * @see docs/27-reaction-protocol.md §27.5, docs/29-user-interface.md
 *
 * Pure. The app scans the chat log and reads the flags; this decides what is
 * shown, so the ordering and the ownership rule are testable without Foundry —
 * the same split `hud/present.mjs` uses for the action bar.
 *
 * The problem it exists for: an AoE attack already fans out to one ladder PER
 * DEFENDER. Own four units, have a Noble Phantasm catch three, and there are
 * three prompts in a scrolling log, each with a clock, and §27.5's default on
 * expiry is the option that spends nothing. Nothing answered "what is the game
 * waiting for me to do?"
 */

/**
 * Prompt kinds mapped to the localisation keys **the cards already use**.
 *
 * Reused rather than reinvented, so the window and the card can never call the
 * same rung two different things.
 */
const LABELS = Object.freeze({
  reaction: "FGT.Prompt.reaction",
  counter: "FGT.Prompt.counter",
  luckCheck: "FGT.Prompt.luckCheck",
  acceptOrEscape: "FGT.Prompt.acceptOrEscape",
  commandSpell: "FGT.Prompt.commandSpell",
});

/**
 * The rows this viewer should see, soonest deadline first.
 *
 * A row survives when the viewer owns the unit being asked, when the viewer is
 * the GM (who answers for absent players through §27.5's "decide for them"), or
 * when the viewer has a Command Spell to spend into the exchange — §17.4's
 * interrupt is the one decision that is yours on somebody else's rung.
 *
 * @param {object[]} entries already read off the messages by the app
 * @param {{id: string, isGM?: boolean}} viewer
 * @returns {Array<object>}
 */
export function pendingRowsFor(entries, viewer) {
  const rows = [];
  for (const e of entries ?? []) {
    const mine = e.owned || Boolean(viewer?.isGM);
    const spells = e.commandSpells ?? 0;
    if (!mine && spells === 0) continue;

    // A rung that is not the viewer's, surfaced only because they may spend
    // into it, is labelled for what it actually offers them.
    const kind = mine ? e.kind : "commandSpell";
    rows.push({
      messageId: e.messageId,
      unitId: e.unitId,
      unitName: e.unitName,
      unitImg: e.unitImg,
      kind,
      label: LABELS[kind] ?? "FGT.Prompt.reaction",
      countdown: e.countdown ?? null,
      expired: (e.countdown?.ms ?? null) === 0,
      isCounter: kind === "counter",
      commandSpells: spells,
    });
  }

  // Soonest clock first; anything without one goes last. A player with three
  // prompts and four seconds left on one of them should not have to find it.
  return rows.sort((a, b) => (a.countdown?.ms ?? Infinity) - (b.countdown?.ms ?? Infinity));
}
