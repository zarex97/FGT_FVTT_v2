/**
 * @file The effect definition registry.
 * @see docs/11-effect-engine.md §11.11
 *
 * Layer 2 (rules). Pure once loaded: `load()` is handed the documents, it does
 * not go looking for them, so the lookup half is testable without a world.
 *
 * The applier takes a `def` object; something has to turn `"burn"` into that
 * object. Without this, every effect an ability tries to apply is a silent
 * no-op — the failure mode that is worse than a crash because nothing reports
 * it.
 */

/** @type {Map<string, object>} */
const DEFS = new Map();

export const EffectRegistry = {
  /**
   * Populate the registry from compendium documents.
   * @param {Array<{system: object, name: string, img?: string}>} documents
   * @returns {number} how many definitions were registered
   */
  load(documents) {
    DEFS.clear();
    for (const doc of documents ?? []) {
      const sys = doc.system ?? {};
      const id = sys.contentId ?? sys.defId;
      // Only documents that actually declare a polarity are effect definitions;
      // the same pack also holds class-skill templates.
      if (!id || !sys.polarity) continue;
      DEFS.set(id, {
        id,
        name: doc.name,
        img: doc.img ?? null,
        polarity: sys.polarity,
        volatility: sys.volatility ?? "nonVolatile",
        valence: sys.valence ?? "neither",
        stacking: sys.stacking ?? "noneNoRefresh",
        baseChance: sys.baseChance ?? 100,
        // Appendix A's Instakill/Death ladder, which chance modifiers filter on.
        severity: sys.severity ?? "normal",
        preventsAction: Boolean(sys.preventsAction),
        defaultMagnitude: sys.defaultMagnitude ?? 0,
        defaultDuration: sys.defaultDuration ?? null,
        unremovable: Boolean(sys.unremovable),
        blocks: sys.blocks ?? [],
        blockedBy: sys.blockedBy ?? [],
        periodic: sys.periodic ?? null,
        rules: sys.rules ?? [],
        coveredByDebuffImmune: sys.coveredByDebuffImmune ?? false,
        bypassesImmunity: sys.bypassesImmunity ?? false,
      });
    }
    return DEFS.size;
  },

  /**
   * @param {string} id
   * @returns {object|null}
   */
  get(id) {
    return DEFS.get(id) ?? null;
  },

  /**
   * @param {string} id
   * @returns {boolean}
   */
  has(id) {
    return DEFS.has(id);
  },

  /** @returns {object[]} */
  all() {
    return [...DEFS.values()];
  },

  /** @returns {number} */
  get size() {
    return DEFS.size;
  },

  /**
   * Report definitions that reference ids the registry does not hold.
   *
   * Run in dev mode at setup. A `blockedBy` pointing at a renamed effect is
   * exactly the kind of bug that never surfaces in play — the exclusion simply
   * stops working and nobody notices.
   *
   * @returns {{errors: string[], warnings: string[]}}
   */
  validate() {
    /** @type {string[]} */ const errors = [];
    /** @type {string[]} */ const warnings = [];
    for (const def of DEFS.values()) {
      for (const field of ["blocks", "blockedBy"]) {
        for (const id of def[field] ?? []) {
          if (!DEFS.has(id)) errors.push(`${def.id}: ${field} references unknown effect "${id}"`);
        }
      }
      for (const id of def.blockedBy ?? []) {
        const other = DEFS.get(id);
        if (other && !(other.blocks ?? []).includes(def.id) && !(other.blockedBy ?? []).includes(def.id)) {
          warnings.push(`${def.id}: blockedBy "${id}" is not reciprocated`);
        }
      }
    }
    return { errors, warnings };
  },

  /** Test seam. */
  _reset() {
    DEFS.clear();
  },
};
