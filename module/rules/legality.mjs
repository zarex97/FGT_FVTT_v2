/**
 * @file Why a placement is illegal, in words a player can act on.
 * @see docs/28-targeting-implementation.md §28.8, docs/09-targeting.md §9.6
 *
 * Layer 2 (rules). Pure — takes a refusal and its detail, returns what to show.
 *
 * §28.8's argument is that validation failures should render **inline, while
 * the player is still choosing**, rather than as an error after they commit.
 * The difference is not politeness: a refusal that names the number ("anchor is
 * 7 panels away; Range is 4") is one the player can fix by moving the cursor,
 * and a bare "illegal target" is one they fix by guessing.
 *
 * Three kinds of failure, and the distinction drives the whole interface:
 *
 *   - **hard** — nothing in the game changes this. Show it and refuse.
 *   - **overridable** — a Command Spell can lift it, so the refusal carries the
 *     command that would (Ch. 17 §17.4). The button renders inline.
 *   - **confirm** — the placement is *legal*; it is just catastrophic. The
 *     Grail is the only one, and it requires a second deliberate click.
 */

/** How a refusal is presented. */
export const LEGALITY_KINDS = Object.freeze(["hard", "overridable", "confirm"]);

/**
 * Every refusal the targeting resolver can produce, and how it renders.
 *
 * `i18n` is the message key; `params` names the detail fields the message
 * interpolates, so a caller can tell which numbers it must supply. A refusal
 * whose params are missing renders with blanks, which is why the resolver's
 * detail object and this table are checked against each other by test.
 */
export const REFUSALS = Object.freeze({
  outOfRange: { kind: "hard", i18n: "FGT.Legality.outOfRange", params: ["distance", "range"] },
  belowMinRange: { kind: "hard", i18n: "FGT.Legality.belowMinRange", params: ["minRange"] },
  // §17.4: CS: Extend Reach lifts this one.
  notInZon: {
    kind: "overridable", i18n: "FGT.Legality.notInZon",
    params: ["distance", "zon"], command: "forceNoblePhantasm",
  },
  // A Good-aligned Servant refusing is a *character* constraint, and a Command
  // Spell is exactly the thing that overrides a Servant's own judgement.
  civilianInArea: {
    kind: "overridable", i18n: "FGT.Legality.civilianInArea",
    params: [], command: "forceAction",
  },
  masterHealth: {
    kind: "overridable", i18n: "FGT.Legality.masterHealth",
    params: ["health", "cost"], command: "forceNoblePhantasm",
  },
  crossLevelMelee: { kind: "hard", i18n: "FGT.Legality.crossLevelMelee", params: [] },
  noTargets: { kind: "hard", i18n: "FGT.Legality.noTargets", params: [] },
  cooldown: { kind: "hard", i18n: "FGT.Legality.cooldown", params: ["remaining"] },
  round: { kind: "hard", i18n: "FGT.Legality.round", params: ["requiresRound", "round"] },
  // Legal, and the worst thing on the board. ALL factions lose if it breaks.
  grailAtRisk: { kind: "confirm", i18n: "FGT.Legality.grailAtRisk", params: ["chance"] },
});

/**
 * Present one refusal.
 *
 * An **unknown** reason still renders, with the raw reason as its text. A
 * refusal nobody worded is far better than a silent failure to place: the
 * player at least learns that something refused, and the reason string names
 * what to search for.
 *
 * @param {string} reason
 * @param {object} [detail]
 * @returns {{reason: string, kind: string, i18n: string, params: object, command: string|null}}
 */
export function presentRefusal(reason, detail = {}) {
  const spec = REFUSALS[reason];
  if (!spec) {
    return {
      reason, kind: "hard", i18n: "FGT.Legality.unknown",
      params: { reason }, command: null, unrecognised: true,
    };
  }

  /** @type {Record<string, unknown>} */
  const params = {};
  for (const key of spec.params) params[key] = detail[key];

  return { reason, kind: spec.kind, i18n: spec.i18n, params, command: spec.command ?? null };
}

/**
 * Present a whole verdict.
 *
 * Ordered **hard first**: a player facing both a fixable refusal and an
 * unfixable one should read the unfixable one, because spending a Command
 * Spell on the other would still leave them unable to act.
 *
 * @param {Array<{reason: string, detail?: object}>} errors
 * @returns {object[]}
 */
export function presentVerdict(errors) {
  const order = { hard: 0, overridable: 1, confirm: 2 };
  return (errors ?? [])
    .map((e) => presentRefusal(e.reason ?? e, e.detail ?? e))
    .sort((a, b) => order[a.kind] - order[b.kind]);
}

/**
 * Does this placement need a deliberate second click?
 *
 * Separate from "is it legal", because it is not the same question and
 * conflating them is how a confirm becomes a refusal — or, worse, how a
 * refusal becomes a confirm and the Grail gets destroyed by one click.
 *
 * @param {object[]} presented
 * @returns {boolean}
 */
export function needsHardConfirm(presented) {
  return (presented ?? []).some((p) => p.kind === "confirm");
}

/**
 * Is anything here blocking, once overrides are accounted for?
 *
 * @param {object[]} presented
 * @param {string[]} [availableCommands] commands the player could actually spend
 * @returns {boolean}
 */
export function isBlocked(presented, availableCommands = []) {
  return (presented ?? []).some((p) => {
    if (p.kind === "confirm") return false;
    if (p.kind === "hard") return true;
    // Overridable only counts as unblocked when the command is genuinely
    // available -- offering a spend button for a command the Master cannot
    // afford is the "unusable option should never appear" failure (§17.6).
    return !availableCommands.includes(p.command);
  });
}
