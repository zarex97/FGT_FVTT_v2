/**
 * @file Projection from Foundry documents to plain data.
 * @see docs/03-domain-overview.md §3.4
 *
 * Layer 2 (rules). Pure in the sense that matters: it takes documents as
 * **arguments** and reads their fields. It never touches a global, never
 * writes, and never awaits — so the whole rules layer downstream of it can be
 * tested with hand-built objects, which is exactly what the 253 tests do.
 *
 * A snapshot is built once per *operation* — one attack, one skill use — not
 * per predicate evaluation. Rebuilding 28 units × 30 effects for every
 * predicate would be pathological, and the memoization key is the actor's
 * `_stats.modifiedTime` plus a system-maintained `derivedVersion` counter that
 * the effect engine bumps.
 */

import { Rank } from "../domain/rank.mjs";

/**
 * @typedef {object} UnitSnapshot
 * @property {string} id
 * @property {string} kind
 * @property {import("../domain/geometry.mjs").GridOffset} panel
 * @property {number|null} health `null` means intrinsically undamageable
 */

/**
 * Project one actor into a `UnitSnapshot`.
 *
 * @param {object} actor an `FGTActor`
 * @param {object} [opts]
 * @param {object} [opts.token] the placed token, for position and facing
 * @returns {UnitSnapshot}
 */
export function snapshotUnit(actor, { token = null } = {}) {
  const sys = actor.system ?? {};
  const doc = token ?? actor.token ?? null;

  return {
    id: actor.id,
    uuid: actor.uuid,
    name: actor.name,
    kind: actor.type,
    factionId: sys.factionId ?? null,
    faction: sys.factionId ?? null,

    panel: doc ? { i: doc.y ?? 0, j: doc.x ?? 0 } : { i: 0, j: 0 },
    panels: sys.panels ?? null,
    level: doc?.elevation ?? 0,
    platformId: sys.platformId ?? null,
    facing: sys.facing ?? "n",

    // `null` is a legal health value meaning "cannot be damaged and cannot be
    // healed" — Pale Rider and the Kagome Spirits. Distinct from Invuln, which
    // is a removable buff halved against NPs.
    health: sys.health?.value ?? null,
    maxHealth: sys.health?.max ?? null,
    agility: sys.agility?.value ?? 0,
    luck: sys.luck?.value ?? 0,
    mov: sys.mov ?? 0,
    range: sys.range ?? 1,
    shield: sys.shield ?? 0,

    // `null` means the Sustainability clock does not exist for this unit
    // (Independent Action A+/EX), not that it is very large.
    sustainability: sys.sustainability ?? null,
    contract: sys.contract ?? "contracted",
    commandSpells: sys.commandSpells ?? 0,

    parameters: parseParameters(sys.parameters),
    baseAttack: { str: sys.baseAttack?.str ?? 0, mag: sys.baseAttack?.mag ?? 0 },
    attributes: [...(sys.attributes ?? [])],
    alignment: sys.alignment ?? null,

    effects: activeEffectIds(actor),
    effectInstances: effectInstances(actor),
    modifiers: collectModifiers(actor),
    abilities: collectAbilities(actor),
    eventHandlers: collectEventHandlers(actor),

    magicResistance: magicResistanceOf(actor),
    zon: sys.zon ?? null,
    zonDistance: sys.zonDistance ?? null,
    outsideZon: Boolean(sys.outsideZon),
    zones: [...(sys.zones ?? [])],
    concealed: Boolean(sys.concealed),
    canAct: sys.canAct !== false,
    acted: Boolean(sys.turnState?.acted),
  };
}

/**
 * Project the board.
 *
 * @param {object} args
 * @param {object} args.scene
 * @param {object[]} args.actors
 * @param {object} [args.settings]
 * @returns {object}
 */
export function snapshotBoard({ scene, actors, settings = {} }) {
  const units = actors.map((a) => snapshotUnit(a.actor ?? a, { token: a.token }));
  const size = settings.boardSize ?? 13;
  return {
    bounds: { iMin: 0, jMin: 0, iMax: size - 1, jMax: size - 1 },
    units,
    zones: scene?.zones ?? {},
    alliances: settings.alliances ?? {},
    roundPhase: settings.phase ?? "day",
    round: settings.round ?? 1,
    turnsPerRound: settings.turnsPerRound ?? 3,
    tick: settings.tick ?? 0,
    region: settings.region ?? null,
    crossLevel: settings.crossLevel ?? null,
    terrain: scene?.terrain ?? {},
    // Seeded so a replayed combat picks the same random targets.
    seed: settings.seed ?? 0,
  };
}

/* -------------------------------------------------------------------------- */

/**
 * @param {object} raw
 * @returns {Record<string, Rank|null>}
 */
function parseParameters(raw) {
  /** @type {Record<string, Rank|null>} */
  const out = {};
  for (const [key, value] of Object.entries(raw ?? {})) {
    out[key] = Rank.parseOrNull(value);
  }
  return out;
}

/**
 * Active, unsuppressed effect ids. Suppressed effects are deliberately absent
 * rather than flagged: every consumer wants "what is in force", and a consumer
 * that wants the full list can read `effectInstances`.
 * @param {object} actor
 * @returns {string[]}
 */
function activeEffectIds(actor) {
  return [...(actor.effects ?? [])]
    .filter((e) => !e.disabled && !e.isSuppressed)
    .map((e) => e.system?.defId ?? e.name);
}

/**
 * @param {object} actor
 * @returns {object[]}
 */
function effectInstances(actor) {
  return [...(actor.effects ?? [])]
    .filter((e) => !e.disabled)
    .map((e) => ({
      id: e.id,
      defId: e.system?.defId ?? e.name,
      magnitude: e.system?.magnitude ?? 0,
      stage: e.system?.stage ?? 0,
      uses: e.system?.uses ?? 0,
      expiry: e.system?.expiry ?? null,
      sourceUnitId: e.system?.sourceUnitId ?? null,
      suppressed: Boolean(e.isSuppressed),
    }));
}

/**
 * Flatten every rule element that contributes to damage into the modifier list
 * the pipeline consumes. Predicates are carried through unevaluated, because
 * whether a `Dmg Up` applies depends on the attack, which is not known yet.
 * @param {object} actor
 * @returns {object[]}
 */
function collectModifiers(actor) {
  /** @type {object[]} */
  const out = [];
  for (const el of actor.system?.ruleElements ?? []) {
    if (!el.key || el.suppressed) continue;
    out.push({
      key: el.modifierKey ?? el.key,
      value: el.value ?? 0,
      npValue: el.npValue,
      component: el.component ?? null,
      predicate: el.predicate ?? null,
      source: el.source ?? el.label ?? "unknown",
    });
  }
  return out;
}

/**
 * @param {object} actor
 * @returns {object[]}
 */
function collectAbilities(actor) {
  return [...(actor.items ?? [])]
    .filter((i) => i.type === "ability" || i.type === "noblePhantasm")
    .map((i) => ({
      id: i.id,
      name: i.name,
      isNP: i.type === "noblePhantasm",
      rank: Rank.parseOrNull(i.system?.rank),
      cooldownRemaining: i.system?.cooldown?.remaining ?? 0,
      regen: i.system?.cooldown?.regen ?? 0,
      categorizedAsNP: Boolean(i.system?.categorizedAsNP),
    }));
}

/**
 * @param {object} actor
 * @returns {object[]}
 */
function collectEventHandlers(actor) {
  return (actor.system?.ruleElements ?? [])
    .filter((el) => el.key === "OnEvent" && !el.suppressed)
    .map((el) => ({ event: el.event, intents: el.intents ?? [], source: el.source ?? el.label }));
}

/**
 * @param {object} actor
 * @returns {object|null}
 */
function magicResistanceOf(actor) {
  const mr = actor.system?.classSkills?.magicResistance;
  if (!mr) return null;
  if (mr.mode === "dice") return { mode: "dice", formula: mr.formula, npDiceDoubled: mr.npDiceDoubled ?? true };
  return { mode: "rank", rank: Rank.parseOrNull(mr.rank), percent: mr.percent };
}
