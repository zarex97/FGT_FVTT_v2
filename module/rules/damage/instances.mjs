/**
 * @file One declaration, N differently-shaped attacks.
 * @see docs/21-combat-process.md
 * @see docs/superpowers/specs/2026-09-12-raikou-design.md Ch. 06
 *
 * Layer 2 (rules). Pure.
 */

/**
 * Every damage instance one declaration resolves as.
 *
 * `repeat: N` and `instances: [...]` are one mechanism with two spellings.
 * `repeat` has given each hit its own Combat Process — and therefore its own
 * reaction ladder — since EMIYA's *Overedge*; what it cannot do is **vary** the
 * hits, and Raikou's *Dohatsu Tenshou* varies four of them in three fields each:
 *
 * > *"deal 0.5x damage four times using Base Attack (STR), each instance of
 * > damage respectively being Lightning damage (half), Fire damage (half), Ice
 * > damage (half) and Wind damage (half)… Then, deals 3.5x damage plus 200
 * > using Base Attack (MAG)."*
 *
 * Five instances, two components, five elements and **two `kind`s** — the first
 * four are Normal Attacks and the fifth is the Noble Phantasm (R6).
 *
 * `repeat` is expanded INTO this shape rather than kept beside it, so there is
 * one path through the fan-out. The golden tests hold Overedge and Tóole
 * Fragarach byte-identical, which is what makes this a generalisation rather
 * than a rewrite.
 *
 * Declaring both is refused rather than given a precedence rule: two spellings
 * of one thing in one block is a content error, and a silent precedence is how
 * a five-hit Noble Phantasm quietly becomes a fifteen-hit one.
 *
 * @param {object|null} damage the resolved `damage` block
 * @returns {object[]} one spec per instance, in declared order
 */
export function expandInstances(damage) {
  const d = damage ?? {};
  if (d.repeat !== undefined && d.repeat !== null && Array.isArray(d.instances)) {
    throw new Error("FGT | A damage block may declare `repeat` or `instances`, not both.");
  }

  const { repeat, instances, ...shared } = d;

  if (Array.isArray(instances)) {
    // The block's own fields are the DEFAULT and an instance overrides them.
    // Dohatsu Tenshou states `component: str` once for the four and overrides
    // to `mag` on the fifth.
    return instances.map((i) => ({ ...shared, ...i }));
  }

  const n = Math.max(1, typeof repeat === "number" ? repeat : (repeat ?? 1));
  return Array.from({ length: n }, () => ({ ...shared }));
}
