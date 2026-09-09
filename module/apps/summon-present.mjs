/**
 * @file The pure half of the summon and setup dialogs.
 * @see docs/29-user-interface.md, docs/37-content-pipeline.md §37.6
 *
 * Layer 4, and deliberately touching no document and no Foundry global except
 * `game.i18n` — which is why it has tests and its callers do not. The repo
 * already splits UI this way for `actor-sheet/present.mjs` and
 * `hud/present.mjs`, and those pure halves are the ones with coverage.
 *
 * `describe` and `describeStep` live here rather than beside one dialog because
 * two dialogs now render a plan line and they must render it identically: the
 * summon dialog shows one Servant's lines, and the setup wizard shows fourteen.
 */

/**
 * One resolved line, for display.
 *
 * The arithmetic is shown, not just the result: "1000" tells a GM nothing about
 * whether to re-roll, and "18 + 2 (coin) = 20" tells them everything.
 *
 * @param {object} line
 * @returns {object}
 */
export function describe(line) {
  // A summon variant's `applied` is a BRANCH ID (`rules/summon-variant.mjs`),
  // not a number added to a base — "null + NaN" is what the arithmetic below
  // would otherwise render for it, since there is no base to add it to.
  if (typeof line.applied === "string") {
    return {
      id: line.id, label: line.label, value: line.value,
      workings: `${line.roll.formula} → ${line.applied}`,
      rollable: Boolean(line.roll), note: line.note ?? null, unrolled: Boolean(line.unrolled),
    };
  }

  const parts = [String(line.base)];
  if (line.applied !== null && line.applied !== undefined) {
    // `applied`, not `rolled`: a tails 2d100 of 87 contributes −87, and showing
    // the unsigned die would render 250 − 87 = 163 as "250 + 87".
    parts.push(`${line.applied < 0 ? "−" : "+"} ${Math.abs(line.applied)} (${line.roll.formula})`);
  }
  if (line.granted) parts.push(`+ ${line.granted} granted`);

  return {
    id: line.id,
    label: line.label,
    value: line.value,
    workings: parts.join(" "),
    rollable: Boolean(line.roll),
    note: line.note ?? null,
    // A line nobody rolled resolves to its base rather than to NaN, and says
    // so — otherwise an unrolled line is indistinguishable from a rolled zero.
    unrolled: Boolean(line.unrolled),
  };
}

/**
 * One plan step, for display. The tree in §37.6, in order.
 * @param {object} step
 * @returns {object}
 */
export function describeStep(step) {
  switch (step.kind) {
    case "rolls":
      return { label: game.i18n.localize("FGT.Summon.StepRolls"), detail: null };
    case "grant": {
      const steps = Object.entries(step.steps).map(([p, n]) => `${p.toUpperCase()} +${n}`).join(", ");
      const ba = [step.baseAttack?.str, step.baseAttack?.mag].some(Boolean)
        ? ` (BA +${step.baseAttack.str}/+${step.baseAttack.mag})`
        : ` (${game.i18n.localize("FGT.Summon.NoBA")})`;
      return { label: game.i18n.format("FGT.Summon.StepGrant", { source: step.source }), detail: steps + ba };
    }
    case "contract":
      return {
        label: game.i18n.localize("FGT.Summon.StepContract"),
        detail: game.actors.get(step.masterId)?.name ?? step.masterId,
      };
    default:
      return { label: game.i18n.localize("FGT.Summon.StepConfirm"), detail: null };
  }
}

/**
 * The catalogue rows a typed query matches, best first.
 *
 * Prefix before substring, because a GM typing `EM` means EMIYA and should not
 * have to scroll past every Servant with an M in the middle. A `<select>` of a
 * hundred Servants is not a control anyone can use at a table, and the roster
 * only grows.
 *
 * @param {Array<{contentId: string, name: string}>} catalogue
 * @param {string} query
 * @returns {Array<{contentId: string, name: string}>}
 */
export function filterCatalogue(catalogue, query) {
  const needle = String(query ?? "").trim().toLowerCase();
  if (needle === "") return [...(catalogue ?? [])];

  const prefix = [];
  const substring = [];
  for (const entry of catalogue ?? []) {
    const name = String(entry.name ?? "").toLowerCase();
    if (name.startsWith(needle)) prefix.push(entry);
    else if (name.includes(needle)) substring.push(entry);
  }
  return [...prefix, ...substring];
}
