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

/**
 * The base attack of a damage block.
 *
 * Three spellings reach the pipeline, and every reader used to know a different
 * subset. `damage.base` is the long form: `{sources}` or `{fixedValue}`.
 * `damage.sources` is the short one, which an aftermath has always been read
 * by and which Xiuhcoatl authored on her primary -- where the resolution read
 * `base`, failed, and fell back to one source built from `component`, so she
 * dealt the STR half of her *"Base Attack (STR) and half of Base Attack (MAG)"*
 * and lost the rest (#135). `damage.component` alone is one source, factor 1.
 *
 * One reader, used by the resolution, the card, the sheet's preview and the NP
 * ranking, so the four cannot disagree. A block that names none returns
 * `null` and the caller falls back to the Normal Attack, as it always did.
 *
 * @param {object|null|undefined} block a `damage` block, a branch, an instance or an aftermath's
 * @returns {{sources?: object[], fixedValue?: number}|null}
 */
export function damageBaseOf(block) {
  if (!block) return null;
  if (block.base) return block.base;
  if (Array.isArray(block.sources) && block.sources.length > 0) return { sources: block.sources };
  if (block.component) return { sources: [{ unit: "self", component: block.component, factor: 1 }] };
  return null;
}

/**
 * Every key a damage block (or one of its `branches` and `instances`) may carry.
 *
 * Taken from what the engine reads off the block: `buildAttackSpec` and
 * `applyDamage` through `resolvedDamage(`, the rest spread onto the attack by
 * {@link expandInstances} and read by the pipeline off `ctx.attack`. The
 * validator refuses any other (`tools/lib/content.mjs`), because a key nothing
 * reads is a Clause that does not happen and a build that says nothing
 * (#135). `drake-golden-wild-hunt.yml` recorded the one instance anybody found
 * live -- *"a top-level `sources` is ignored"* -- and never generalised it.
 *
 * @type {readonly string[]}
 */
export const DAMAGE_BLOCK_KEYS = Object.freeze([
  // what the attack is built from
  "base", "sources", "component", "multiplier", "flatBonus", "conditionalMultipliers",
  "fixed", "fixedValue", "formula", "bands",
  // what it counts as
  "element", "elementFraction", "aim", "pierce", "pierceOn",
  "ignoresMagicResistance", "ignoresDefUp", "ignoresAttackerIncreases", "isAoE",
  // how the modifiers treat it
  "bypassModifiers", "modifierSources", "excludeModifierSources", "totalModifiers",
  // what the defender may answer it with
  "unblockable", "evadableOnlyBy", "evadeModifier", "noEvadeAfterFail", "singleInjuryRoll", "skipIf",
  // how it fans out
  "repeat", "instances", "branches", "predicate", "kind",
]);
