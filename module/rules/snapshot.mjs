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
import { NEUTRAL_FACTION } from "../domain/enums.mjs";
import { collectContributions } from "./elements.mjs";

/**
 * @typedef {object} UnitSnapshot
 * @property {string} id
 * @property {string} kind
 * @property {import("../domain/geometry.mjs").GridOffset|null} panel `null` when
 *   the unit is not placed on the board — see {@link panelOf}
 * @property {number|null} health `null` means intrinsically undamageable
 */

/**
 * Project one actor into a `UnitSnapshot`.
 *
 * @param {object} actor an `FGTActor`
 * @param {object} [opts]
 * @param {object} [opts.token] the placed token, for position and facing
 * @param {object} [opts.grid] a grid with `getOffset`, when the token's own
 *   scene cannot supply one
 * @returns {UnitSnapshot}
 */
export function snapshotUnit(actor, { token = null, grid = null } = {}) {
  const sys = actor.system ?? {};
  const doc = token ?? actor.token ?? null;
  const contributions = contributionsOf(actor);
  const panel = panelOf(doc, grid);

  return {
    id: actor.id,
    uuid: actor.uuid,
    name: actor.name,
    kind: actor.type,
    factionId: factionOf(actor, doc),
    faction: factionOf(actor, doc),

    // `null` means "not on the board", which is a different thing from "at the
    // origin". Returning {i:0,j:0} for an unplaced unit is how an attack came to
    // be measured from the top-left corner of the scene: every range check
    // failed, and nothing said why.
    panel,
    panels: sys.panels ?? footprintOf(doc, panel),
    onBoard: panel !== null,
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
    // `system.range` is a SchemaField -- `{panels, targets}` -- and every rule
    // that reads `unit.range` wants the number of panels. Handing the schema
    // object through made `range` an object that compared false against every
    // integer it met, silently, in the anchor check.
    range: sys.range?.panels ?? (typeof sys.range === "number" ? sys.range : 1),
    rangeTargets: sys.range?.targets ?? 1,
    shield: sys.shield ?? 0,

    // `null` means the Sustainability clock does not exist for this unit
    // (Independent Action A+/EX), not that it is very large.
    sustainability: sys.sustainability ?? null,
    contract: sys.contract ?? "contracted",
    commandSpells: sys.commandSpells ?? 0,

    parameters: parseParameters(sys.parameters),
    baseAttack: { str: sys.baseAttack?.str ?? 0, mag: sys.baseAttack?.mag ?? 0 },
    // Which component a normal attack draws on. The preview reads this to build
    // the same base spec the real attack will; without it a MAG attacker was
    // previewed as a STR one.
    normalAttack: {
      mode: sys.normalAttack?.mode ?? "fixed",
      component: sys.normalAttack?.component ?? "str",
    },
    // Abilities can grant attributes -- Divinity grants `divine`, which is what
    // Karna's Vasavi Shakti and Scathach's God Slayer key on.
    attributes: [...new Set([...(sys.attributes ?? []), ...contributions.attributes])],
    alignment: sys.alignment ?? null,

    effects: activeEffectIds(actor),
    effectInstances: effectInstances(actor),
    modifiers: contributions.modifiers,
    abilities: collectAbilities(actor),
    eventHandlers: contributions.eventHandlers,
    immunities: contributions.immunities,
    grantedAbilities: contributions.grantedAbilities,
    autoSucceeds: contributions.autoSucceeds,
    checkModifiers: contributions.checkModifiers,
    damageNegation: contributions.damageNegation,
    // Informational. `FGTActor#prepareDerivedData` has ALREADY folded these
    // into `mov`, `range`, `agility` and friends above -- this list is here so
    // a sheet can explain the number, not so a consumer can apply it again.
    statDeltas: contributions.statDeltas,

    magicResistance: contributions.magicResistance ?? magicResistanceOf(actor),
    zon: sys.zon ?? null,
    zonDistance: sys.zonDistance ?? null,
    outsideZon: Boolean(sys.outsideZon),
    zones: [...(sys.zones ?? [])],
    concealed: Boolean(sys.concealed),
    canAct: sys.canAct !== false,
    acted: Boolean(sys.turnState?.acted),
    turnState: {
      acted: Boolean(sys.turnState?.acted),
      moved: Boolean(sys.turnState?.moved),
      attacked: Boolean(sys.turnState?.attacked),
      movedPanels: sys.turnState?.movedPanels ?? 0,
      moveSegments: sys.turnState?.moveSegments ?? 0,
      usedActiveSkill: Boolean(sys.turnState?.usedActiveSkill),
      mayMoveAgain: Boolean(sys.turnState?.mayMoveAgain),
      usedRidingAttack: Boolean(sys.turnState?.usedRidingAttack),
    },
  };
}

/**
 * The grid offset a placed token occupies.
 *
 * A `TokenDocument`'s `x`/`y` are **pixels**, not grid offsets, and a panel is
 * `{i: row, j: column}` — so the conversion is neither a rename nor a swap, and
 * doing it by hand produced panels like `{i: 600, j: 700}` on a 13×13 board.
 *
 * The grid comes from, in order: offsets the caller already resolved, an
 * explicitly supplied grid, or the token's own scene. That last one is why this
 * works from any call site without threading `canvas` through the rules layer —
 * `TokenDocument#parent` is the Scene and `Scene#grid` is a real grid object.
 *
 * @param {object|null} doc a `TokenDocument`, or anything carrying `{x, y}`
 * @param {object|null} [grid] a grid with `getOffset(point)` and/or `size`
 * @returns {import("../domain/geometry.mjs").GridOffset|null} `null` when the
 *   unit is not on the board, or when no grid can be found to measure with
 */
export function panelOf(doc, grid = null) {
  if (!doc) return null;
  // Already a grid offset — hand-built units in tests, and any caller that has
  // done the conversion itself.
  if (Number.isInteger(doc.i) && Number.isInteger(doc.j)) return { i: doc.i, j: doc.j };
  if (!Number.isFinite(doc.x) || !Number.isFinite(doc.y)) return null;

  const g = grid ?? doc.parent?.grid ?? null;
  if (typeof g?.getOffset === "function") {
    const { i, j } = g.getOffset({ x: doc.x, y: doc.y });
    return { i, j };
  }
  const size = g?.size ?? g?.sizeX ?? null;
  if (!size) return null;
  return { i: Math.floor(doc.y / size), j: Math.floor(doc.x / size) };
}

/**
 * The panels a token covers, for units larger than 1×1.
 *
 * A token's `width`/`height` are in grid units, so a 2×2 Servant occupies four
 * panels and the occupancy step must catch it when *any* of them is in the area.
 *
 * @param {object|null} doc
 * @param {import("../domain/geometry.mjs").GridOffset|null} origin
 * @returns {import("../domain/geometry.mjs").GridOffset[]|null}
 */
function footprintOf(doc, origin) {
  if (!doc || !origin) return null;
  const w = Math.max(1, Math.round(doc.width ?? 1));
  const h = Math.max(1, Math.round(doc.height ?? 1));
  if (w === 1 && h === 1) return null;
  const out = [];
  for (let di = 0; di < h; di++) for (let dj = 0; dj < w; dj++) out.push({ i: origin.i + di, j: origin.j + dj });
  return out;
}

/**
 * The faction this unit belongs to.
 *
 * `system.factionId` is the source of truth (D4.10). Two fallbacks exist for
 * units nobody has assigned one to, because the alternative — every unit sharing
 * the `null` faction and therefore allied to every other — is a silent, total
 * failure: nothing can be targeted and nothing says why.
 *
 * 1. **Civilians are neutral by kind**, whatever their token says.
 * 2. **A deliberate token disposition stands in for a faction.** `FRIENDLY` and
 *    `NEUTRAL` are choices a user made, so they carry information. `HOSTILE` is
 *    Foundry's *default* for every new token and therefore carries none — two
 *    tokens dropped on a scene are both hostile, and reading that as "same
 *    faction, so allies" is exactly the reasoning that made a normal attack
 *    impossible. It maps to `null`, and `null` means unaffiliated: an enemy of
 *    everyone, visibly, until a Faction is set.
 *
 * Disposition is a two-sided approximation of a seven-faction model (D4.10), so
 * it is only ever a fallback and never overrides an explicit id.
 *
 * @param {object} actor
 * @param {object|null} doc the placed token
 * @returns {string|null} `null` means unaffiliated, **not** neutral
 */
function factionOf(actor, doc) {
  const explicit = actor.system?.factionId ?? null;
  if (explicit) return explicit;
  if (actor.type === "civilian") return NEUTRAL_FACTION;

  switch (doc?.disposition) {
    case 1: return "disposition:friendly";   // TOKEN_DISPOSITIONS.FRIENDLY
    case 0: return NEUTRAL_FACTION;          // TOKEN_DISPOSITIONS.NEUTRAL
    case -2: return "disposition:secret";    // TOKEN_DISPOSITIONS.SECRET
    default: return null;                    // HOSTILE, the default: no signal
  }
}

/**
 * The board's panel bounds.
 *
 * The rules say 13×13 or 25×25 and the setting says which, but the *scene* is
 * what the tokens are standing on: a 20×20 scene with `boardSize` left at 13
 * clips every panel past row 12 out of every shape, so a unit placed in the
 * lower half of the map becomes untargetable with no error anywhere. The scene
 * wins when it can answer, and the setting is the fallback.
 *
 * @param {object|null} scene
 * @param {object} settings
 * @returns {import("../domain/geometry.mjs").Bounds}
 */
function boundsFor(scene, settings) {
  const rows = scene?.dimensions?.rows ?? null;
  const columns = scene?.dimensions?.columns ?? null;
  if (Number.isFinite(rows) && Number.isFinite(columns) && rows > 0 && columns > 0) {
    return { iMin: 0, jMin: 0, iMax: Math.round(rows) - 1, jMax: Math.round(columns) - 1 };
  }
  const size = settings.boardSize ?? 13;
  return { iMin: 0, jMin: 0, iMax: size - 1, jMax: size - 1 };
}

/**
 * Project the board.
 *
 * @param {object} args
 * @param {object} args.scene
 * @param {object[]} args.actors
 * @param {object} [args.settings]
 * @param {object} [args.grid] a grid with `getOffset`, for tokens whose scene
 *   cannot supply one
 * @returns {object}
 */
export function snapshotBoard({ scene, actors, settings = {}, grid = null }) {
  const g = grid ?? scene?.grid ?? null;
  const units = actors.map((a) => snapshotUnit(a.actor ?? a, { token: a.token, grid: g }));
  return {
    bounds: boundsFor(scene, settings),
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
 * Run every rule element the actor owns and collect what it contributes.
 *
 * This is where a `{key: "FlatDamage", table: "divinity"}` on a compendium
 * document becomes `+50` in the damage pipeline. Before this existed the
 * content loaded and did nothing.
 *
 * Predicates that depend on the *attack* cannot be evaluated here — the attack
 * is not known yet — so they are carried through on the modifier and evaluated
 * inside the pipeline. Predicates that depend only on the unit's own state are
 * evaluated now.
 *
 * @param {object} actor
 * @returns {object}
 */
export function contributionsOf(actor) {
  const abilities = [...(actor.items ?? [])].map((item) => ({
    id: item.id,
    name: item.name,
    rank: item.system?.rank ?? null,
    active: item.system?.active ?? true,
    rules: item.system?.rules ?? [],
    passiveRules: item.system?.passiveRules ?? [],
    activeRules: item.system?.activeRules ?? [],
  }));

  // Effects on the actor carry rule elements too, and they are active by
  // definition -- an effect that is present is in force.
  for (const effect of actor.effects ?? []) {
    if (effect.disabled || effect.isSuppressed) continue;
    const def = effect.system?.def ?? null;
    if (!def?.rules?.length) continue;
    abilities.push({
      id: effect.id, name: effect.name, rank: null, active: true,
      rules: def.rules.map((r) => ({
        ...r,
        // "@magnitude" on an effect definition resolves against the instance.
        value: r.value === "@magnitude" ? (effect.system?.magnitude ?? 0) : r.value,
        npValue: r.npValue === "@npMagnitude" ? (effect.system?.npMagnitude ?? undefined) : r.npValue,
      })),
    });
  }

  return collectContributions(abilities, { options: new Set(), refs: { self: actor } });
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
 * @returns {object|null}
 */
function magicResistanceOf(actor) {
  const mr = actor.system?.classSkills?.magicResistance;
  if (!mr) return null;
  if (mr.mode === "dice") return { mode: "dice", formula: mr.formula, npDiceDoubled: mr.npDiceDoubled ?? true };
  return { mode: "rank", rank: Rank.parseOrNull(mr.rank), percent: mr.percent };
}
