/**
 * @file Which War this is, and its rules.
 * @see docs/02-architecture.md, docs/38-authority.md, CONTEXT.md (War, War Rules)
 *
 * Layer 3. A world holds several Wars, each bound to its board scene and played
 * at the same time. Every reader that asked a world setting or
 * `game.combats.active` for "the match" now asks here.
 *
 * **Which War.** The War bound to the scene this client is looking at. Each
 * War is run by a GM client viewing its scene (ruled 2026-10-18, Q14 (B)): the
 * engine reads the board off `canvas`, so the GM running a press must be
 * looking at that press's board, and then the War of `canvas.scene` is the
 * press's War too. `game.combat` is NOT that: it is whatever the combat tracker
 * happens to show (`CombatTracker#viewed`), and Foundry's
 * `CombatEncounters#active` filters on the globally ACTIVATED scene, which is
 * one scene for the whole world.
 *
 * A War from before the move has no scene (`scene: null`, global). It answers
 * for any scene that has no War of its own, so a world with one War plays
 * exactly as it did.
 *
 * **Its rules.** `warRule(key)` reads the War's own value. The world setting of
 * the same key is only the default a NEW War starts from: read here by
 * `worldDefault`, and by nothing else (`test/unit/war-rules-readers.test.mjs`).
 */

import { warRuleSpec, publishedValue, WAR_RULE_KEYS, coerceWarRule, warRuleEditable } from "../domain/war-rules.mjs";
import { revisionOf } from "../domain/revisions.mjs";

/**
 * Every War in the world.
 *
 * `game.combats.contents` live. A collection without one (a headless check)
 * offers its active and viewed matches, which is every War it has.
 *
 * @returns {object[]}
 */
export function allWars() {
  const combats = globalThis.game?.combats;
  if (!combats) return [];
  const listed = combats.contents ?? (typeof combats[Symbol.iterator] === "function" ? [...combats] : null);
  const list = listed ?? [combats.active, globalThis.game?.combat].filter(Boolean);
  return [...new Set(list)].filter((c) => !c.type || c.type === "match");
}

/**
 * The scene id a War is bound to, or `null` for a War from before the move.
 * @param {object|null} war
 * @returns {string|null}
 */
export function sceneIdOfWar(war) {
  if (!war) return null;
  const scene = war.scene ?? war._source?.scene ?? null;
  return (typeof scene === "string" ? scene : scene?.id) ?? null;
}

/**
 * One War out of several that answer for one scene: the activated one, then a
 * started one, then the newest.
 * @param {object[]} wars
 * @returns {object|null}
 */
function pick(wars) {
  if (wars.length === 0) return null;
  const active = globalThis.game?.combats?.active ?? null;
  if (active && wars.includes(active)) return active;
  return wars.find((w) => w.started) ?? wars[wars.length - 1];
}

/**
 * The War fought on this scene.
 *
 * @param {object|string|null} scene a Scene or its id
 * @returns {object|null}
 */
export function warOfScene(scene) {
  const id = typeof scene === "string" ? scene : scene?.id ?? null;
  const wars = allWars();
  const bound = id ? wars.filter((w) => sceneIdOfWar(w) === id) : [];
  if (bound.length > 0) return pick(bound);
  return pick(wars.filter((w) => !sceneIdOfWar(w)));
}

/**
 * The War this client is in: the one on the scene it is looking at.
 *
 * Falls back to the activated match when the scene has none, which is what
 * every reader here read before -- so a GM arranging a scene with no War still
 * sees the one War a world holds.
 *
 * @returns {object|null}
 */
export function currentWar() {
  const scene = globalThis.canvas?.scene ?? null;
  return (scene ? warOfScene(scene) : null) ?? globalThis.game?.combats?.active ?? null;
}

/**
 * A War by id.
 * @param {string|null} id
 * @returns {object|null}
 */
export function warById(id) {
  if (!id) return null;
  return globalThis.game?.combats?.get?.(id) ?? allWars().find((w) => w.id === id) ?? null;
}

/**
 * The War a Unit fights in: the one it was built into (`system.warId`), else
 * the one on the scene its token stands on.
 *
 * @param {object|null} actor
 * @returns {object|null}
 */
export function warOfUnit(actor) {
  if (!actor) return null;
  const own = warById(actor.system?.warId ?? null);
  if (own) return own;
  const token = actor.token ?? actor.getActiveTokens?.(false, true)?.[0] ?? null;
  const scene = token?.parent ?? token?.scene ?? null;
  return scene ? warOfScene(scene) : null;
}

/**
 * The world's default for a War Rule: what the next War starts from.
 *
 * The ONE reader of these world settings. A War never falls through to it --
 * its own value is the rule -- so changing a default changes no War in play.
 *
 * @param {string} key a War Rule's key
 * @returns {unknown}
 */
export function worldDefault(key) {
  try {
    const v = globalThis.game?.settings?.get("fgt", key);
    if (v !== undefined && !(v === "" && warRuleSpec(key)?.nullable)) return v;
  } catch {
    // A world where the setting was never registered: the published rule.
  }
  return publishedValue(key);
}

/**
 * Every War Rule's world default, by key.
 * @returns {Record<string, unknown>}
 */
export function worldDefaults() {
  return Object.fromEntries(WAR_RULE_KEYS.map((k) => [k, worldDefault(k)]));
}

/**
 * A War Rule's value for a War.
 *
 * The War's own value, always, `null` included (a War fought in no Region).
 * With no War at all -- a sheet opened in a world with none -- the default the
 * next War would start from.
 *
 * @param {string} key a War Rule's key
 * @param {object|null} [war] defaults to {@link currentWar}
 * @returns {unknown}
 */
export function warRule(key, war = currentWar()) {
  if (!warRuleSpec(key)) throw new Error(`"${key}" is not a War Rule.`);
  if (!war) return worldDefault(key);
  const system = war.system ?? {};
  const value = system[key];
  // A War that never stored a rule with a `legacy` value predates it, and reads
  // what its DataModel reads (`data/misc.mjs`): the Classic/Revised rules' *As
  // printed* (#260 reading 3h).
  if (value === undefined) return warRuleSpec(key).legacy ?? worldDefault(key);
  return value;
}

/**
 * The War's Classic/Revised rules by Skill slug, the shape
 * `domain/revisions.mjs#revisionOf` reads (`board.rules.revisions`).
 *
 * @param {object|null} [war] defaults to {@link currentWar}
 * @returns {Record<string, unknown>}
 */
export function revisionRules(war = currentWar()) {
  // Spelled out rather than mapped over `REVISION_RULES`, so each rule has a
  // reader by name (`test/unit/field-ledger.test.mjs`); `revisions-260.test`
  // holds the two lists together.
  return {
    madEnhancement: warRule("madEnhancementRevision", war),
    divinity: warRule("divinityRevision", war),
    presenceConcealment: warRule("presenceConcealmentRevision", war),
  };
}

/**
 * The text an ability plays in its bearer's War (#260 reading 3), or `null`
 * for an ability that is not a revisable Skill. The engine's door to
 * `revisionOf`; the board's is `board.rules.revisions`.
 *
 * @param {object|null} item an ability Item
 * @param {object|null} actor its bearer
 * @returns {"classic"|"revised"|null}
 */
export function itemRevision(item, actor) {
  return revisionOf(item?.system ?? null, revisionRules(warOfUnit(actor) ?? currentWar()));
}

/**
 * The description a sheet prints for this ability: the Revised wording when its
 * bearer's War plays the Revised text, else its own (#260 reading 3f).
 *
 * @param {object|null} item an ability Item
 * @param {object|null} [actor] its bearer; the item's parent when omitted
 * @returns {string}
 */
export function descriptionFor(item, actor = item?.parent ?? null) {
  const sys = item?.system ?? {};
  if (sys.descriptionRevised && itemRevision(item, actor) === "revised") return sys.descriptionRevised;
  return sys.description ?? "";
}

/**
 * The GM user who runs this War: the active GM looking at its scene.
 *
 * A War with no scene (from before the move), or no War at all, is the active
 * GM's, as every press was. A War whose scene no GM is looking at falls to the
 * active GM only when that GM is not running another War: a GM looking at War
 * B would build War A's press off War B's board.
 *
 * @param {object|null} war
 * @returns {object|null} a User
 */
export function gmForWar(war) {
  const users = globalThis.game?.users;
  const activeGM = users?.activeGM ?? null;
  const sceneId = sceneIdOfWar(war);
  if (!war || !sceneId) return activeGM;
  const gms = (users?.contents ?? (users ? [...users] : [])).filter((u) => u.isGM && u.active);
  const viewing = gms.filter((u) => u.viewedScene === sceneId);
  if (viewing.length > 0) return viewing.includes(activeGM) ? activeGM : viewing[0];
  if (!activeGM) return null;
  const other = warOfScene(activeGM.viewedScene ?? null);
  return other && other !== war && sceneIdOfWar(other) ? null : activeGM;
}

/**
 * Whether this client runs this War's GM-side work: its presses, its
 * boundaries, its reports. Exactly one client, as `activeGM.isSelf` was for a
 * world of one War.
 *
 * @param {object|null} [war] defaults to {@link currentWar}
 * @returns {boolean}
 */
export function isWarGM(war = currentWar()) {
  return Boolean(gmForWar(war)?.isSelf);
}

/**
 * Change some of one War's rules, and only that War's.
 *
 * A rule that invalidates stored state (`locked` in `rules/war-rules.mjs`)
 * is refused once the War has started, out loud: a disabled control is the
 * window's courtesy, and this is the rule.
 *
 * @param {object} war
 * @param {Record<string, unknown>} patch by key
 * @returns {Promise<{applied: string[], refused: string[]}>}
 */
export async function setWarRules(war, patch) {
  /** @type {Record<string, unknown>} */
  const update = {};
  const applied = [];
  const refused = [];
  for (const [key, raw] of Object.entries(patch ?? {})) {
    if (!warRuleSpec(key) || key === "factions") continue;
    const value = coerceWarRule(key, raw);
    if (value === war.system?.[key]) continue;
    if (!warRuleEditable(key, war)) { refused.push(key); continue; }
    update[`system.${key}`] = value;
    applied.push(key);
  }
  for (const key of refused) {
    const name = globalThis.game?.i18n?.localize(warRuleSpec(key)?.name ?? key) ?? key;
    globalThis.ui?.notifications?.warn(globalThis.game.i18n.format("FGT.WarRules.Locked", { rule: name }));
  }
  if (applied.length > 0) await war.update(update);
  return { applied, refused };
}

/**
 * Change some of the world's defaults for new Wars. No War in play changes.
 *
 * @param {Record<string, unknown>} patch by key
 * @returns {Promise<string[]>} the keys written
 */
export async function setWorldDefaults(patch) {
  const written = [];
  for (const [key, raw] of Object.entries(patch ?? {})) {
    const spec = warRuleSpec(key);
    if (!spec || key === "factions") continue;
    const value = coerceWarRule(key, raw);
    await globalThis.game.settings.set("fgt", key, value ?? "");
    written.push(key);
  }
  return written;
}
