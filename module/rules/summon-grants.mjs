/**
 * @file Abilities a Servant arrives with on a coin and dice.
 * @see docs/31-war-setup-and-summoning.md, docs/13-checks-and-randomness.md
 *
 * Layer 2 (rules). Pure: it says what to roll and what the dice gave; the
 * caller rolls (`engine/summon.mjs#rollLine`).
 *
 * Rama's Vishnu Bhuja (#347):
 *
 * > *"When Rama is summoned, Flip a Coin. If Heads, roll 2 six-sided die; if
 * > Tails, roll 1 six-sided die. The number(s) rolled on the di(c)e determines
 * > which of the following additional Noble Phantasms Rama possesses during the
 * > game ... Note: If a 6 is rolled, the player can choose any of the available
 * > Noble Phantasms (that hasn't been chosen yet)."*
 *
 * Ruled 2026-10-28: two dice showing the same face, a 6 excepted, roll the
 * second again until it differs, and its result stands, a 6 included (rulings 1
 * and 14). Every 6 is a pick among the faces not yet held, asked of the player
 * as an opening choice.
 *
 * The spec, authored on the Servant as `summonGrants`:
 * `{id, label, coin: {heads, tails}, die, faces: [{face, key, label}], choose, rerollDoubles}`.
 */

/**
 * The summon-plan line for one spec. Rolled by `engine/summon.mjs#rollLine`,
 * which reads `roll.grant`.
 *
 * @param {object} spec
 * @returns {object}
 */
export function grantLine(spec) {
  return {
    id: `summonGrant:${spec.id}`,
    label: spec.label ?? spec.id,
    base: null,
    roll: { formula: `1d2 → ${diceOf(spec, 1)}d${spec.die ?? 6} / ${diceOf(spec, 2)}d${spec.die ?? 6}`, grant: spec },
    summonGrant: spec,
  };
}

/**
 * How many dice the coin calls for: `1` is heads, `2` tails, as every coin in
 * the summon plan reads it.
 *
 * @param {object} spec
 * @param {number} coin
 * @returns {number}
 */
export function diceOf(spec, coin) {
  return coin === 1 ? (spec.coin?.heads ?? 2) : (spec.coin?.tails ?? 1);
}

/**
 * Does this die roll again? A face another die already shows, unless it is the
 * face that lets the player choose (ruling 1).
 *
 * @param {object} spec
 * @param {number[]} before the dice already kept
 * @param {number} face
 * @returns {boolean}
 */
export function rollsAgain(spec, before, face) {
  return Boolean(spec.rerollDoubles) && face !== spec.choose && before.includes(face);
}

/**
 * What the dice gave: the keys held and the picks owed.
 *
 * @param {object} spec
 * @param {{coin: number, dice: number[], rerolled?: number[]}} rolled
 * @returns {{coin: number, dice: number[], rerolled: number[], keys: string[], picks: number}}
 */
export function grantOutcome(spec, { coin, dice, rerolled = [] }) {
  const keys = [];
  let picks = 0;
  for (const face of dice) {
    if (face === spec.choose) {
      picks += 1;
      continue;
    }
    const key = (spec.faces ?? []).find((f) => f.face === face)?.key ?? null;
    if (key && !keys.includes(key)) keys.push(key);
  }
  return { coin, dice: [...dice], rerolled: [...rerolled], keys, picks };
}

/**
 * The outcomes a resolved summon plan holds, by spec id.
 *
 * @param {object[]} lines resolved lines
 * @returns {Record<string, object>}
 */
export function summonGrantsResolved(lines) {
  return Object.fromEntries((lines ?? [])
    .filter((l) => l.summonGrant && l.grantOutcome)
    .map((l) => [l.summonGrant.id, l.grantOutcome]));
}

/**
 * Every face key this actor holds, from every spec.
 *
 * @param {object} actor an Actor or its system-bearing stand-in
 * @returns {Set<string>}
 */
export function grantedKeys(actor) {
  const granted = actor?.system?.summonGranted ?? {};
  return new Set(Object.values(granted).flatMap((g) => g?.keys ?? []));
}

/**
 * Does this actor hold this ability by its summon roll? An ability that names
 * no `summonGrant` is no business of this rule's.
 *
 * @param {object} actor
 * @param {object} item
 * @returns {boolean}
 */
export function grantHeld(actor, item) {
  const key = item?.system?.summonGrant ?? null;
  return !key || grantedKeys(actor).has(key);
}

/**
 * The picks this actor still owes, each with the faces it may take: every face
 * not yet held (*"that hasn't been chosen yet"*).
 *
 * @param {object} actor
 * @returns {Array<{id: string, label: string, count: number, options: Array<{key: string, label: string}>}>}
 */
export function picksOwed(actor) {
  const granted = actor?.system?.summonGranted ?? {};
  return (actor?.system?.summonGrants ?? []).flatMap((spec) => {
    const outcome = granted[spec.id];
    if (!outcome || !(outcome.picks > 0)) return [];
    const held = new Set(outcome.keys ?? []);
    const options = (spec.faces ?? []).filter((f) => !held.has(f.key)).map((f) => ({ key: f.key, label: f.label ?? f.key }));
    if (options.length === 0) return [];
    return [{ id: spec.id, label: spec.label ?? spec.id, count: Math.min(outcome.picks, options.length), options }];
  });
}

/**
 * The outcome in words, for the summon's line: "Heads: 3, 5 → Modhaki and
 * Shikhari, Pinaka".
 *
 * @param {object} spec
 * @param {object} outcome
 * @returns {string}
 */
export function describeOutcome(spec, outcome) {
  const coin = outcome.coin === 1 ? "Heads" : "Tails";
  const label = (key) => (spec.faces ?? []).find((f) => f.key === key)?.label ?? key;
  const again = (outcome.rerolled ?? []).length ? ` (rolled again: ${outcome.rerolled.join(", ")})` : "";
  const picks = outcome.picks > 0 ? `${outcome.picks} to choose` : null;
  const held = [...(outcome.keys ?? []).map(label), ...(picks ? [picks] : [])].join(", ");
  return `${coin}: ${outcome.dice.join(", ")}${again} → ${held}`;
}
