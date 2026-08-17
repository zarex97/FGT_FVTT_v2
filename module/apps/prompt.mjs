/**
 * @file Rendering a question asked of this user.
 * @see docs/27-reaction-protocol.md, docs/26-authority-and-sockets.md §26.2
 *
 * Layer 4. `FGTSocket.ask` hands a spec here and waits for what this returns.
 *
 * One entry point with a kind table, rather than a dialog class per question:
 * the caller is a rule that knows what it needs answered, not what the answer
 * looks like on screen, and a rule that had to import a dialog would put layer
 * 4 inside layer 2.
 *
 * Every renderer resolves to `null` on a dismissal, and every caller treats
 * `null` as "declined" rather than as an error. A player closing a window is
 * the most common outcome of asking a question, not a failure.
 */

const { DialogV2 } = foundry.applications.api;

/**
 * Show the prompt this spec describes and resolve to the answer.
 *
 * @param {object} spec
 * @param {string} spec.kind
 * @returns {Promise<unknown>}
 */
export async function renderPrompt(spec) {
  const render = RENDERERS[spec?.kind];
  if (!render) {
    // Loud: an unrecognised prompt means a rule is waiting for an answer that
    // no code can produce, and the asker will sit on it until the timeout.
    console.warn(`FGT | No renderer for prompt kind "${spec?.kind}".`);
    return null;
  }
  return render(spec);
}

/** @type {Readonly<Record<string, (spec: object) => Promise<unknown>>>} */
const RENDERERS = Object.freeze({
  /**
   * A yes/no Luck Check offer. Costs 1 Luck whether or not it succeeds, so the
   * cost is in the question — a player who is not told is being asked to spend
   * something they did not know they had bid.
   */
  luckCheck: async (spec) => {
    const unit = game.actors.get(spec.unitId);
    const confirmed = await DialogV2.confirm({
      window: { title: game.i18n.localize("FGT.Prompt.luckCheck") },
      content: `<p>${game.i18n.format("FGT.Prompt.LuckCheckBody", {
        name: unit?.name ?? game.i18n.localize("FGT.Unit"),
        check: game.i18n.localize(`FGT.Check.${spec.check ?? "generic"}`),
        luck: unit?.system?.luck?.value ?? 0,
      })}</p>`,
      rejectClose: false,
    });
    return { accepted: Boolean(confirmed) };
  },

  /**
   * Pick from a list — Scáthach's two copies, and anything later that offers a
   * curated set. `count` is enforced in the dialog rather than trusted from the
   * answer, because the answer crosses a socket.
   */
  choose: async (spec) => {
    const { ChoiceDialog } = await import("./choice-dialog.mjs");
    return ChoiceDialog.pick(spec);
  },
});
