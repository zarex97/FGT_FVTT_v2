/**
 * @file The attribute implication table (Ch. 02 §2.10).
 * @see docs/02-glossary.md §2.10, docs/04-units.md
 *
 * Layer 1 (domain). Pure.
 *
 * Attributes are tags other effects key off, and the source states them as an
 * *implication table* rather than as a flat list: a Human is also Humanoid and
 * a Living Human, a Servant is also a Spirit **unless** it is a Demi- or
 * Pseudo-Servant, and so on. None of it had ever been built. Every sheet in the
 * corpus authored the closure by hand, which meant two things:
 *
 *   - `spirit` appeared nowhere at all, so an effect keying on it would have
 *     missed every Servant in the game; and
 *   - `Pseudo Servant` was a word on a sheet with no consequence, because the
 *     only thing it does is *withhold* an implication nobody was applying.
 *
 * Mannanán is the Servant that makes the distinction matter — Ch. 33 opens on
 * it — so the table is transcribed here rather than restated in her file.
 *
 * `Magus` is the one entry that is not a tag-to-tag implication. Her *Sealing
 * Designation Enforcer* defines it in as many words: *"Units with the 'Magus'
 * Attribute — Masters, Casters, all Units whose Normal Attacks use Base Attack
 * (MAG)."* That reads the Unit's kind, its classes and its normal attack, so
 * the closure takes the Unit rather than only its list.
 */

/**
 * Tag-to-tag implications, applied transitively.
 *
 * Order is irrelevant — {@link closeAttributes} runs to a fixed point — but the
 * table is written in the source's own order so the two can be read side by
 * side.
 *
 * @type {ReadonlyArray<{from: string, adds: string[], unless?: string[]}>}
 */
export const IMPLICATIONS = Object.freeze([
  { from: "human", adds: ["humanoid", "livingHuman"] },
  { from: "demiServant", adds: ["human"] },
  { from: "giant", adds: ["large"] },
  { from: "demonicBeast", adds: ["nonHominidae"] },
  { from: "demon", adds: ["demonic"] },
  // "Servant ⟹ Spirit (unless Demi-Servant or Pseudo-Servant)". The exemption
  // is the whole reason Mannanán's sheet spells out `Pseudo Servant` and
  // `Living Human`: effects keying on `Spirit` miss her, and effects keying on
  // `Living Human` hit her.
  { from: "servant", adds: ["spirit"], unless: ["demiServant", "pseudoServant"] },
  { from: "servant", adds: ["hominidae"], unless: ["nonHominidae", "demonicBeast"] },
]);

/**
 * The `Magus` attribute, which is a *description* rather than a tag.
 *
 * > *"Units with the 'Magus' Attribute — Masters, Casters, all Units whose
 * > Normal Attacks use Base Attack (MAG)."*
 *
 * Deliberately not folded into {@link IMPLICATIONS}: those are closed over the
 * attribute set alone and this reads three other fields, so mixing them would
 * make the table's contract "attributes, plus whatever else the entry felt
 * like".
 *
 * @param {object} unit a `{kind, servantClasses, normalAttack}` shape — an
 *   actor's `system`, or a unit snapshot
 * @returns {boolean}
 */
export function isMagus(unit) {
  if (unit?.kind === "master") return true;
  if ([...(unit?.servantClasses ?? [])].includes("caster")) return true;
  return (unit?.normalAttack?.component ?? null) === "mag";
}

/**
 * Every attribute a Unit has, once the implication table has been closed.
 *
 * Idempotent, so it is safe to run over a list that already carries its own
 * closure — which is what every sheet authored before this existed does.
 *
 * @param {Iterable<string>} attributes the authored list
 * @param {object} [unit] `{kind, servantClasses, normalAttack}` for `Magus`
 * @returns {string[]} sorted for a stable projection across clients
 */
export function closeAttributes(attributes, unit = null) {
  const out = new Set(attributes ?? []);

  // To a fixed point: `Demi-Servant ⟹ Human ⟹ Humanoid, Living Human` is three
  // steps deep, and a single pass over the table would stop at the first.
  // Bounded by the table's own length, because each pass that changes anything
  // adds at least one member of a finite set.
  for (let pass = 0; pass <= IMPLICATIONS.length; pass++) {
    let grew = false;
    for (const rule of IMPLICATIONS) {
      if (!out.has(rule.from)) continue;
      if ((rule.unless ?? []).some((tag) => out.has(tag))) continue;
      for (const add of rule.adds) {
        if (out.has(add)) continue;
        out.add(add);
        grew = true;
      }
    }
    if (!grew) break;
  }

  if (unit && isMagus(unit)) out.add("magus");

  return [...out].sort();
}
