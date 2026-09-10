/**
 * @file Who gets which Item sheet.
 * @see docs/29-user-interface.md §29.6
 *
 * Layer 4, but pure — no Foundry globals, so it can be tested without a world.
 *
 * **The bug this closes.** `AbilityEditor` was registered as no Item sheet at
 * all. It opened from exactly two places: the pencil on an ability card of an
 * *actor's* sheet, and `fgt.api.dialogs.AbilityEditor` in the console. So
 * **Items → Create Item → Ability** opened the plain display sheet — a name, a
 * Rank, a Cooldown, an empty description — and there was no route from a newly
 * created Item to the editor. An ability had to be OWNED by a Servant before it
 * could be authored, which inverts the order a GM works in.
 *
 * The GM/player split lives here rather than at each entry point, because there
 * are two of them (`apps/index.mjs` and `actor-sheet/sheet.mjs`) and they must
 * not be able to disagree. Its reason is the one `actor-sheet/sheet.mjs`
 * already gives: the editor writes rule elements, and a player who reorders a
 * phase has changed the ability for the whole table.
 */

/**
 * The Item **types** the editor can author.
 *
 * Three, not four. A Class Skill is not an Item type — `system.json` declares
 * `ability`, `noblePhantasm`, `commandSpell`, `masterEssence` and `equipment`,
 * and class skills are `ability` documents that happen to live in the
 * `class-skills` pack. Registering a sheet for a type that does not exist
 * throws during `init` and takes everything after it down with it, which is
 * how this list was found to be wrong: settings registration stopped running
 * and the world came up complaining that `fgt.schemaVersion` was not a
 * registered setting.
 *
 * The editor still branches its vocabulary on `kind: "classSkill"` — that is a
 * field on the ability, and a different question from the document's type.
 */
export const EDITOR_TYPES = Object.freeze([
  "ability", "noblePhantasm", "commandSpell",
]);

/**
 * @param {string} type the Item's type
 * @param {{isGM?: boolean}} user
 * @returns {"editor"|"read"}
 */
export function sheetFor(type, user) {
  return user?.isGM && EDITOR_TYPES.includes(type) ? "editor" : "read";
}
