/**
 * @file The Command Spell catalogue registry.
 * @see docs/17-command-spells.md §17.2
 *
 * Layer 2 (rules). Pure once loaded: `load()` is handed the documents rather
 * than going looking for them, so the lookup half is testable without a world —
 * the same shape as `EffectRegistry`.
 *
 * The catalogue is **open** by design: *"if you can think of any other use for
 * Command Spells, feel free to mention it and use it if the GM/majority of
 * players approve."* So this is a registry rather than an enum, and a command
 * added by a module lands here beside the reference set.
 */

/** @type {Map<string, object>} */
const COMMANDS = new Map();

export const CommandSpellRegistry = {
  /**
   * Populate the registry from compendium documents.
   * @param {Array<{system: object, name: string, img?: string}>} documents
   * @returns {number} how many commands were registered
   */
  load(documents) {
    COMMANDS.clear();
    for (const doc of documents ?? []) {
      const sys = doc.system ?? {};
      const id = sys.contentId;
      // A command is a document that says when it may be used. The same pack
      // could hold something else one day; this is the cheap discriminator.
      if (!id || !sys.timing) continue;
      COMMANDS.set(id, {
        id,
        name: doc.name,
        img: doc.img ?? null,
        cost: sys.cost ?? 1,
        costByMasterRank: sys.costByMasterRank ?? null,
        requirements: sys.requirements ?? [],
        timing: sys.timing ?? { window: "anyTime" },
        blockedWhen: sys.blockedWhen ?? [],
        effect: sys.effect ?? [],
        permanentConsequence: sys.permanentConsequence ?? [],
        overridesValidation: sys.overridesValidation ?? [],
        description: sys.description ?? "",
      });
    }
    return COMMANDS.size;
  },

  /** @param {string} id @returns {object|null} */
  get(id) {
    return COMMANDS.get(id) ?? null;
  },

  /** @returns {object[]} the whole catalogue, in registration order */
  all() {
    return [...COMMANDS.values()];
  },

  /** @returns {number} */
  get size() {
    return COMMANDS.size;
  },
};
