/**
 * @file What the table calls an ability whose bearer is not revealed.
 * @see docs/30-concealment-and-identity.md, #387
 *
 * Layer 2 (rules). Pure.
 *
 * A concealed Servant is *"Archer of Red"* on a card, and the same card used to
 * print *Excalibur* beside it. So an ability has a public name too: its kind and
 * five letters and digits, as the user's *"NP-X5R76"*. Nothing is written by hand
 * and no name stays real, Class Skills included (rulings 50, 51).
 *
 * **Derived, not stored.** A tag is a hash of the War, the Unit and the ability:
 * the same for the whole War, different in the next, different on two Units who
 * hold one Skill (ruling 59). With nothing written, a Unit summoned mid-War has
 * one at once, and there is no field to drop.
 */

/** No 0, 1, I or O: a tag is read off a card by eye. */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/** A public tag, anywhere in text. Global: every use of it resets `lastIndex`. */
export const PUBLIC_TAG = /\b(?:NP|SK)-[2-9A-HJ-NP-Z]{5}\b/g;

/**
 * A stable number from a string (cyrb53), so one key is one tag on every client.
 *
 * @param {string} text
 * @returns {number} a safe integer
 */
function hashOf(text) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/**
 * An ability's kind on a card (ruling 58). A Class Skill and a Spell are `SK`:
 * the prefix says no more than a Skill was used.
 *
 * @param {object} ability an ability Item
 * @returns {"NP"|"SK"}
 */
export function tagPrefix(ability) {
  return ability?.type === "noblePhantasm" || ability?.system?.isNP || ability?.isNP ? "NP" : "SK";
}

/**
 * Which ability a tag answers for: one printed NP on two clocks is one tag, by
 * `publicTagAs` (ruling 60), and an Item with no content id is its own.
 *
 * @param {object} ability an ability Item
 * @returns {string}
 */
function tagKey(ability) {
  return ability?.system?.publicTagAs || ability?.system?.contentId || ability?.id || "";
}

/**
 * An ability's public tag in this War.
 *
 * @param {object} ability an ability Item
 * @param {{warId?: string|null, unitId?: string|null}} [where]
 * @returns {string} e.g. `NP-X5R76`
 */
export function publicTagOf(ability, { warId = null, unitId = null } = {}) {
  let n = hashOf(`${warId ?? "no-war"}|${unitId ?? ""}|${tagKey(ability)}`);
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += ALPHABET[n % ALPHABET.length];
    n = Math.floor(n / ALPHABET.length);
  }
  return `${tagPrefix(ability)}-${code}`;
}

/** @param {string} text @returns {string} */
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Replace a whole name in text, however it is cased against its neighbours:
 * *"Arturia's"* is hit, *"Arturian"* is not.
 *
 * @param {string} text
 * @param {string} name
 * @param {string} word
 * @returns {string}
 */
function replaceName(text, name, word) {
  return text.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(name)}(?![\\p{L}\\p{N}])`, "gu"), word);
}

/**
 * A pick list's text with its bearer's names removed (ruling 55).
 *
 * A Skill's text says *"Whenever Arturia…"* and names her other abilities, so
 * the list that hides the name would give it back in the line under it. Longest
 * names go first: *"Avalon: The Everdistant Utopia"* before *"Avalon"*.
 * `test/unit/public-ability-387.test.mjs` walks the roster for what is left.
 *
 * @param {string} text
 * @param {object} bearer
 * @param {string[]} [bearer.names] what the Unit is called: True Name, sheet name
 * @param {string[]} [bearer.others] every other Servant's name: *"Karna"* in a Skill names Arjuna by his rival
 * @param {string} [bearer.ownName] this ability's own name
 * @param {string|null} [bearer.rank] what a template's `@rank` reads
 * @param {Array<{id?: string, name: string, tag: string}>} [bearer.abilities] its other abilities
 * @returns {string}
 */
export function scrubbedText(text, { names = [], others = [], ownName = "", abilities = [], rank = null } = {}) {
  const byId = new Map(abilities.map((a) => [a.id, a.tag]));
  let out = String(text ?? "")
    .replace(/@ability\[([^\]]*)\]\{[^}]*\}/g, (_, id) => byId.get(id) ?? "another ability")
    .replace(/@effect\[[^\]]*\]\{([^}]*)\}/g, "$1")
    .replace(/@rank\b/g, rank ?? "its Rank");
  const swaps = [
    ...(ownName ? [{ name: ownName, word: "this Skill" }] : []),
    ...abilities.map((a) => ({ name: a.name, word: a.tag })), // fgt-name-ok: an ability, not a Unit
    // The name before its colon says as much: *"the Golden Hind"*, of *"Golden Hind: Wild Hunt"*.
    ...[ownName, ...abilities.map((a) => a.name)].filter((n) => n?.includes(":")) // fgt-name-ok: an ability, not a Unit
      .map((n) => ({ name: n.split(":")[0].trim(), word: "another ability" })),
    ...names.flatMap((n) => [n, ...String(n).split(/\s+/).filter((part) => part.length >= 4)])
      .map((name) => ({ name, word: "this Unit" })),
    ...others.map((name) => ({ name, word: "another Unit" })),
  ].filter((s) => s.name);
  for (const { name, word } of swaps.sort((a, b) => b.name.length - a.name.length)) { // fgt-name-ok: an ability, not a Unit
    out = replaceName(out, name, word);
  }
  return out;
}
