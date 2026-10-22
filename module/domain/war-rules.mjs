/**
 * @file The War Rules: every choice that shapes one War, as one table.
 * @see docs/02-architecture.md, docs/31-war-setup-and-summoning.md, CONTEXT.md (War Rules)
 *
 * Layer 1: pure data, no `game`, no settings. A world holds several Wars, each on its own
 * scene and played at the same time, so a rule a world setting held hit every
 * War at once: a GM lengthening the Command Spell wait for one table lengthened
 * it for the other, and a ◈ changed for one War re-timed every duration in the
 * other (grilled 2026-10-18, `docs/superpowers/specs/2026-10-18-war-rules-clauses.md`).
 *
 * Each rule lives on the War (`MatchData`, built from this table) and the world
 * keeps the same key as a setting that only seeds the next War
 * (`engine/war.mjs#worldDefault`). One table so the schema, the world defaults,
 * the wizard, the War rules window and the migration cannot disagree on a key,
 * an initial value or which rules lock once the War has started.
 *
 * `locked`: changing it mid-war invalidates what is already stored (every
 * absolute expiry is in Ticks of the ◈; a Round gate decides when every Noble
 * Phantasm unlocks; a ruleset is a stat scale). The War rules window refuses
 * these once the War has started. The rest only decide the next press.
 */

/**
 * @typedef {object} WarRuleSpec
 * @property {string} key the field on the War and the world setting's key
 * @property {"number"|"boolean"|"string"|"roster"} type
 * @property {unknown} initial the published rule
 * @property {Record<string, string>} [choices] value → lang key
 * @property {{min?: number, max?: number, step?: number}} [range]
 * @property {boolean} [nullable]
 * @property {boolean} [locked] refused mid-war
 * @property {unknown} [legacy] what a War that never stored the rule reads (the
 *   DataModel's initial), where that differs from what a new War starts at
 * @property {boolean} [window] shown in the War rules window (default true)
 * @property {string} [name] lang key
 * @property {string} [hint] lang key
 */

/** The Classic/Revised rules' three choices (`domain/revisions.mjs`), Revised first: the default. */
const REVISION_CHOICE_LABELS = Object.freeze({
  revised: "FGT.Revision.Revised", classic: "FGT.Revision.Classic", asPrinted: "FGT.Revision.AsPrinted",
});

/** @type {ReadonlyArray<WarRuleSpec>} */
export const WAR_RULES = Object.freeze([
  {
    key: "warType", type: "string", initial: "greatHolyGrailWar", locked: true,
    choices: { greatHolyGrailWar: "FGT.WarType.Great", holyGrailWar: "FGT.WarType.Regular", custom: "FGT.WarType.Custom" },
    name: "FGT.Settings.WarType", hint: "FGT.Settings.WarTypeHint",
  },
  {
    key: "ruleset", type: "string", initial: "advanced", locked: true,
    choices: { advanced: "FGT.Ruleset.Advanced", normal: "FGT.Ruleset.Normal" },
    name: "FGT.Settings.Ruleset", hint: "FGT.Settings.RulesetHint",
  },
  {
    // `TICK_OVERRIDES` (domain/tick.mjs) only has rows for the three published
    // rulesets, so the choice is closed to them (#21).
    key: "turnsPerRound", type: "number", initial: 3, locked: true,
    choices: { 3: "FGT.TurnsPerRound.GreatHolyGrailWar", 8: "FGT.TurnsPerRound.HolyGrailWar", 15: "FGT.TurnsPerRound.Snowfield" },
    name: "FGT.Settings.TurnsPerRound", hint: "FGT.Settings.TurnsPerRoundHint",
  },
  {
    key: "boardSize", type: "number", initial: 13, locked: true,
    choices: { 13: "13 × 13", 25: "25 × 25" },
    name: "FGT.Settings.BoardSize",
  },
  {
    // The rulebook's four, and only these four. The setting once offered
    // `beginner | standard | expert` while the match accepted another list and
    // the board defaulted without consulting either: three vocabularies, none
    // of which met.
    key: "difficulty", type: "string", initial: "intermediate", locked: true,
    choices: {
      beginner: "FGT.Difficulty.Beginner", intermediate: "FGT.Difficulty.Intermediate",
      expert: "FGT.Difficulty.Expert", lunatic: "FGT.Difficulty.Lunatic",
    },
    name: "FGT.Settings.Difficulty",
  },
  {
    // `null` is a War fought in no Region, which is a value and not a gap: a
    // reader never falls through it to anything else (`engine/war-setup.mjs`
    // records the Greece-ground war that falling through produced).
    key: "region", type: "string", initial: null, nullable: true, locked: true,
    name: "FGT.Settings.Region",
  },
  {
    key: "grailThreshold", type: "number", initial: 9, range: { min: 1 },
    name: "FGT.Settings.GrailThreshold",
  },
  {
    key: "drawPolicy", type: "string", initial: "duplicates", window: false,
    choices: { duplicates: "FGT.DrawPolicy.Duplicates", unique: "FGT.DrawPolicy.Unique" },
    name: "FGT.Settings.DrawPolicy", hint: "FGT.Settings.DrawPolicyHint",
  },
  {
    key: "masterMode", type: "string", initial: "essences", locked: true,
    choices: { essences: "FGT.MasterMode.Essences", coinFlip: "FGT.MasterMode.CoinFlip", rankless: "FGT.MasterMode.Rankless" },
    name: "FGT.Settings.MasterMode",
  },
  {
    // Ch. 04's Round gates. The numbers sat in `CONFIG.FGT.gates` with no
    // reader, so a Noble Phantasm was usable in Round 1 in every world.
    key: "npGateRound", type: "number", initial: 6, range: { min: 1 }, locked: true,
    name: "FGT.Settings.NpGateRound", hint: "FGT.Settings.NpGateRoundHint",
  },
  {
    key: "npGateRoundAssassin", type: "number", initial: 4, range: { min: 1 }, locked: true,
    name: "FGT.Settings.NpGateRoundAssassin", hint: "FGT.Settings.NpGateRoundAssassinHint",
  },
  {
    // "Neither faction may Attack during Round 1." `0` switches the ban off.
    key: "noAttackRound", type: "number", initial: 1, range: { min: 0 }, locked: true,
    name: "FGT.Settings.NoAttackRound", hint: "FGT.Settings.NoAttackRoundHint",
  },
  {
    // Ch. 33: "An offer that blocks resolution indefinitely is unacceptable in
    // a game with seven players." After this many seconds the ladder goes on as
    // if the offer were declined, with a chat note.
    key: "commandSpellTimeout", type: "number", initial: 45, range: { min: 0 },
    name: "FGT.Settings.CommandSpellTimeout", hint: "FGT.Settings.CommandSpellTimeoutHint",
  },
  {
    key: "interruptTimeout", type: "number", initial: 45, range: { min: 0 },
    name: "FGT.Settings.InterruptTimeout",
  },
  {
    // Ch. 23: longer than an optional contest, because a reaction is the
    // decision a player most needs to think about.
    key: "reactionTimeout", type: "number", initial: 60, range: { min: 0 },
    name: "FGT.Settings.ReactionTimeout",
  },
  {
    // Ch. 32's Conquest spares the Servants it claims (#27): a conquered
    // Servant is Contracted from the same instant, so it never becomes Free and
    // takes none of a Free Servant's costs. True is the rule as written.
    key: "conquestSparesServants", type: "boolean", initial: true,
    name: "FGT.Settings.ConquestSparesServants", hint: "FGT.Settings.ConquestSparesServantsHint",
  },
  {
    // *"If playing without Day or Night Rounds"* (Gawain, Mozart, Bunny Lion
    // King, Melusine Ondine): a War may switch the cycle off. Read by
    // `rules/environment.mjs#roundPhase` through the board (#287, #314).
    key: "dayNightCycle", type: "boolean", initial: true,
    name: "FGT.Settings.DayNightCycle", hint: "FGT.Settings.DayNightCycleHint",
  },
  {
    // A Grand Order war switches off two rules that assume rival Masters: the
    // multi-Servant tax (Ch. 32) and Hatred of Achilles against allies (Ch. 45).
    key: "grandOrder", type: "boolean", initial: false,
    name: "FGT.Settings.GrandOrder", hint: "FGT.Settings.GrandOrderHint",
  },
  {
    // Ch. 05 clause 4, as an OPTIONAL rule: the one movement clause that
    // refuses a step onto a panel that looks empty. True: a rule as written.
    key: "masterProtection", type: "boolean", initial: true, locked: true,
    name: "FGT.Settings.MasterProtection", hint: "FGT.Settings.MasterProtectionHint",
  },
  {
    // The eight grid lines by default; a GM may hold it to rows and columns
    // (#65 ruling 18).
    key: "ridingAttackLines", type: "string", initial: "eight",
    choices: { eight: "FGT.RidingAttackLines.Eight", orthogonal: "FGT.RidingAttackLines.Orthogonal" },
    name: "FGT.Settings.RidingAttackLines", hint: "FGT.Settings.RidingAttackLinesHint",
  },
  {
    // What a "ranged Attack" is for a platform that allows only those across
    // its levels (the Golden Hind, the Hanging Gardens). 2 is #187 reading 4.
    key: "rangedMinimumRange", type: "number", initial: 2, range: { min: 2, max: 10, step: 1 },
    name: "FGT.Settings.RangedMinimumRange", hint: "FGT.Settings.RangedMinimumRangeHint",
  },
  {
    // Ch. 46 §46.4-AN: Discover attempts ONE faction gets per Turn against one
    // concealed Unit. Three is the rule as written; 0 makes concealment absolute.
    key: "discoverAttemptsPerFaction", type: "number", initial: 3, range: { min: 0, max: 10, step: 1 }, locked: true,
    name: "FGT.Settings.DiscoverAttempts", hint: "FGT.Settings.DiscoverAttemptsHint",
  },
  {
    // Ch. 38: a chat card redacted per viewer. True, because the rulebook's
    // information rules are rules rather than a house style.
    key: "closedInfo", type: "boolean", initial: true,
    name: "FGT.Settings.ClosedInfo", hint: "FGT.Settings.ClosedInfoHint",
  },
  {
    // Ch. 21. Rule 1 -- the unit a Counter was aimed at never answers it -- is
    // not configurable. This governs only a bystander an AREA Counter caught.
    // `strict`: no Counter begins as the product of a Counter, so an exchange
    // has an end a player can see from the first rung.
    key: "counterChain", type: "string", initial: "strict",
    choices: { strict: "FGT.CounterChain.Strict", collateral: "FGT.CounterChain.Collateral" },
    name: "FGT.Settings.CounterChain", hint: "FGT.Settings.CounterChainHint",
  },
  // Classic or Revised: which text of three shared Skills every bearer plays
  // (`domain/revisions.mjs`, #260 reading 3). Revised is the published rule; a
  // War that never stored one -- every War from before these rules -- reads
  // `legacy`, *As printed*, and plays on as it began (reading 3h). Locked: a
  // clock the Revised Mad Enhancement starts at a Master's death cannot be
  // taken back by a later switch (reading 3e).
  {
    key: "madEnhancementRevision", type: "string", initial: "revised", legacy: "asPrinted", locked: true,
    choices: REVISION_CHOICE_LABELS,
    name: "FGT.Settings.MadEnhancementRevision", hint: "FGT.Settings.MadEnhancementRevisionHint",
  },
  {
    key: "divinityRevision", type: "string", initial: "revised", legacy: "asPrinted", locked: true,
    choices: REVISION_CHOICE_LABELS,
    name: "FGT.Settings.DivinityRevision", hint: "FGT.Settings.DivinityRevisionHint",
  },
  {
    key: "presenceConcealmentRevision", type: "string", initial: "revised", legacy: "asPrinted", locked: true,
    choices: REVISION_CHOICE_LABELS,
    name: "FGT.Settings.PresenceConcealmentRevision", hint: "FGT.Settings.PresenceConcealmentRevisionHint",
  },
  {
    // The Faction roster. Edited by the roster editor, not the War rules
    // window: the ids in it are what every actor stores.
    key: "factions", type: "roster", initial: [], window: false,
    name: "FGT.Factions.MenuName",
  },
]);

/** Every War Rule's key. */
export const WAR_RULE_KEYS = Object.freeze(WAR_RULES.map((r) => r.key));

/**
 * @param {string} key
 * @returns {WarRuleSpec|null}
 */
export function warRuleSpec(key) {
  return WAR_RULES.find((r) => r.key === key) ?? null;
}

/** @returns {boolean} */
export function isWarRule(key) {
  return WAR_RULE_KEYS.includes(key);
}

/**
 * A fresh copy of a rule's published value, so a caller mutating a roster
 * never mutates the table.
 *
 * @param {string} key
 * @returns {unknown}
 */
export function publishedValue(key) {
  const spec = warRuleSpec(key);
  if (!spec) return undefined;
  return Array.isArray(spec.initial) ? [...spec.initial] : spec.initial;
}

/**
 * Coerce a value read from a form or a setting into the rule's type. A
 * `<select>` hands back a string for a number rule, and a `"3"` stored on the
 * War is a ◈ no Tick arithmetic accepts.
 *
 * @param {string} key
 * @param {unknown} value
 * @returns {unknown}
 */
export function coerceWarRule(key, value) {
  const spec = warRuleSpec(key);
  if (!spec) return value;
  if (spec.type === "number") {
    const n = Number(value);
    return Number.isFinite(n) ? n : publishedValue(key);
  }
  if (spec.type === "boolean") return value === true || value === "true" || value === "on";
  if (spec.type === "string") {
    if (spec.nullable && (value === "" || value === null || value === undefined)) return null;
    return value === null || value === undefined ? publishedValue(key) : String(value);
  }
  return Array.isArray(value) ? value : publishedValue(key);
}

/**
 * The rules a War's source does not hold yet, filled from `defaults`.
 *
 * "Does not hold" is the KEY being absent: a War that holds `region: null` was
 * set up in no Region and keeps it. Never overwrites, so running it twice is
 * running it once (Ch. 41's idempotence rule).
 *
 * @param {object} system a War's `system` source
 * @param {Record<string, unknown>} defaults by key, usually the world's values
 * @returns {Record<string, unknown>} only the keys that were missing
 */
export function missingWarRules(system, defaults) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of WAR_RULE_KEYS) {
    if (system && Object.hasOwn(system, key)) continue;
    out[key] = key in (defaults ?? {}) ? coerceWarRule(key, defaults[key]) : publishedValue(key);
  }
  return out;
}

/**
 * Whether a rule may change on this War now.
 *
 * @param {string} key
 * @param {{started?: boolean}|null} war
 * @returns {boolean}
 */
export function warRuleEditable(key, war) {
  const spec = warRuleSpec(key);
  if (!spec) return false;
  return !(spec.locked && war?.started);
}
