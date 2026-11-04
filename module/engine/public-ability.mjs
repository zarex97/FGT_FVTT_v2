/**
 * @file What each reader of a card calls an ability, and who reads the truth.
 * @see docs/30-concealment-and-identity.md, #387
 *
 * Layer 3. The one door: `shownAbility` is what every line the table reads prints
 * for an ability, as `public-identity.mjs#shownName` is for a Unit. The message
 * holds the tag and never the real name. Each client swaps in the truth for the
 * Units it may read it for (`swapAbilityTags`, ruling 65): the GM, an open table,
 * and a Unit's OWNER, never a teammate (rulings 53, 63, 64).
 */

import { PUBLIC_TAG, publicTagOf, scrubbedText } from "../rules/public-ability.mjs";
import { isIdentityRevealed } from "../rules/identity.mjs";
import { currentWar, warRule } from "./war.mjs";

/**
 * May the table read this Unit's abilities by name? Only a Servant has an identity
 * to conceal, as on `isIdentityRevealed`, the Unit's own door (ruling 52).
 *
 * @param {object|null} actor
 * @returns {boolean}
 */
function revealed(actor) {
  return isIdentityRevealed({ kind: actor?.type, identityRevealed: actor?.system?.identityRevealed });
}

/**
 * An ability's tag in the current War, whoever holds it now.
 *
 * @param {object} item an ability Item
 * @returns {string}
 */
export function abilityTag(item) {
  return publicTagOf(item, { warId: currentWar()?.id ?? null, unitId: item?.parent?.id ?? null });
}

/**
 * What a line the whole table reads calls this ability.
 *
 * @param {object|null} item an ability Item
 * @returns {string} the tag, or the real name once its bearer is revealed
 */
export function shownAbility(item) {
  if (!item) return "";
  // An ability on no Unit, or on a Unit with nothing to conceal.
  if (!item.parent || revealed(item.parent)) return item.name; // fgt-name-ok: the public name's own fallback
  return abilityTag(item);
}

/**
 * The Rank a public line may print: none while its bearer is concealed (ruling 61).
 *
 * @param {object|null} item an ability Item
 * @returns {string|null}
 */
export function shownAbilityRank(item) {
  if (!item) return null;
  if (item.parent && !revealed(item.parent)) return null;
  return item.system?.rank ?? null;
}

/**
 * Does this viewer read this Unit's truth on a card?
 *
 * @param {object|null} actor
 * @param {object} [user]
 * @returns {boolean}
 */
export function readsTruthOf(actor, user = game.user) {
  if (!actor) return false;
  if (user?.isGM || !warRule("closedInfo")) return true;
  return Boolean(actor.testUserPermission?.(user, "OWNER"));
}

/**
 * The name a card shows this viewer for a Unit: the truth for its owner, the GM
 * and an open table, the public name for everyone else (ruling 63).
 *
 * @param {object|null} actor
 * @param {string} publicName
 * @returns {string}
 */
export function nameForViewer(actor, publicName) {
  return readsTruthOf(actor) ? actor.name : publicName; // fgt-name-ok: this viewer's own Unit, or the GM's
}

/** Tag to truth, for the viewer on this client, for the current War. */
let truths = null;

/** Forget the map: an ability came, went or changed hands. */
export function forgetAbilityTruths() {
  truths = null;
}

/**
 * Every tag this viewer may read, with what it stands for.
 *
 * @returns {Map<string, {name: string, rank: string|null}>}
 */
function truthMap() {
  const warId = currentWar()?.id ?? null;
  if (truths?.warId === warId && truths.userId === game.user?.id) return truths.map;
  const map = new Map();
  const add = (actor) => {
    if (!readsTruthOf(actor)) return;
    for (const item of actor.items ?? []) {
      if (item.type !== "ability" && item.type !== "noblePhantasm") continue;
      map.set(abilityTag(item), { name: item.name, rank: item.system?.rank ?? null }); // fgt-name-ok: this viewer's truth
    }
  };
  for (const actor of game.actors ?? []) add(actor);
  truths = { warId, userId: game.user?.id, map };
  return map;
}

/**
 * What this viewer reads for a tag, or `null` when it stays a tag.
 *
 * @param {string} tag
 * @returns {{name: string, rank: string|null}|null}
 */
export function truthOfTag(tag) {
  return truthMap().get(tag) ?? null;
}

/**
 * Swap every tag this viewer may read for its real name, in one rendered card.
 *
 * Over text nodes, so a line that escaped its string, a row and a title all pass
 * one door, and no card has to carry a marker of its own.
 *
 * @param {HTMLElement|null} root
 */
export function swapAbilityTags(root) {
  if (!root) return;
  const walker = root.ownerDocument.createTreeWalker(root, 4); // NodeFilter.SHOW_TEXT
  /** @type {Text[]} */
  const nodes = [];
  while (walker.nextNode()) if (walker.currentNode.nodeValue.search(PUBLIC_TAG) >= 0) nodes.push(walker.currentNode);
  for (const node of nodes) {
    node.nodeValue = node.nodeValue.replace(PUBLIC_TAG, (tag) => truthOfTag(tag)?.name ?? tag);
  }
}

/**
 * Every Servant's name but this one's, from the world and from the roster's pack,
 * because a sheet names Units nobody has placed.
 *
 * @param {object|null} owner
 * @returns {string[]}
 */
function everyServantName(owner) {
  const own = new Set([owner?.system?.trueName, owner?.name]); // fgt-name-ok: scrubbed out of the text
  const names = new Set();
  for (const a of game.actors ?? []) {
    if (a.type === "servant") names.add(a.system?.trueName).add(a.name); // fgt-name-ok: scrubbed out of the text
  }
  for (const entry of game.packs?.get("fgt.servants")?.index ?? []) names.add(entry.name);
  return [...names].filter((n) => n && !own.has(n));
}

/**
 * A pick list's row for an ability on another Unit (ruling 55): its tag, its Rank,
 * Active or Passive, and its text with its bearer's names removed.
 *
 * @param {object} item an ability Item, or a board record of one
 * @param {object} owner its bearer's document
 * @returns {{tag: string, rank: string, activity: string, detail: string}}
 */
export function publicRow(item, owner) {
  const held = owner?.items?.get?.(item.id) ?? item;
  const abilities = [...(owner?.items ?? [])]
    .filter((i) => (i.type === "ability" || i.type === "noblePhantasm") && i.id !== held.id)
    .map((i) => ({ id: i.system?.contentId ?? i.id, name: i.name, tag: abilityTag(i) })); // fgt-name-ok: scrubbed out of the text
  const active = !held.system?.passive && (held.system?.phases ?? []).length > 0;
  return {
    tag: abilityTag(held),
    rank: held.system?.rank ?? "—",
    activity: game.i18n.localize(active ? "FGT.Pick.Active" : "FGT.Pick.Passive"),
    detail: scrubbedText(held.system?.description ?? "", {
      names: [owner?.system?.trueName, owner?.name].filter(Boolean), // fgt-name-ok: scrubbed out of the text
      others: everyServantName(owner),
      ownName: held.name, // fgt-name-ok: scrubbed out of the text
      abilities,
    }),
  };
}
