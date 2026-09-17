/**
 * @file Whether this match records history at all, and what a snapshot holds.
 * @see docs/28-bounded-fields.md
 *
 * Layer 2 (rules). Pure.
 *
 * Ch. 28's load-bearing optimisation, in one function: *"`historyRecording` is
 * off by default and switched on only when an ability declaring
 * `requiresHistory: true` enters play. A match without Nursery Rhyme pays
 * nothing."*
 *
 * **The engine has never had to remember the past.** Every other ability in
 * either roster reads the present or schedules the future; The Queen's Glass
 * Game reads history, and Ch. 28 opens its design by saying so.
 */

/**
 * Does anything on this board want history recorded?
 *
 * A DEFEATED declarer still counts. The Queen's Glass Game's second effect
 * fires on Nursery's defeat and rewinds six Rounds; a gate that closed the
 * moment she died would discard the buffer one step before the clause reads it.
 *
 * @param {object} board
 * @returns {boolean}
 */
export function historyWanted(board) {
  return (board?.units ?? []).some((u) =>
    (u.abilities ?? []).some((a) => a?.requiresHistory === true));
}

/**
 * What one Unit was like at one tick.
 *
 * Ch. 28's `UnitStateSnapshot`, quoted so a reader can check the shape against
 * the chapter without leaving the file:
 *
 * ```ts
 * interface UnitStateSnapshot {
 *   globalTurn: number;
 *   stats: { health: Resource; agility: Resource; luck: Resource };
 *   parameters: Record<ParamKey, { base: string; granted: number }>;
 *   effects: EffectInstanceSnapshot[];        // full instances, not ids
 *   cooldowns: Record<string, CooldownState>;
 *   resources: Record<string, Resource>;
 *   modes: Record<string, ModeState>;
 *   // NOT included: position, facing, turn budget, contract state
 * }
 * ```
 *
 * **What is not here, and why it is not here.** Position, facing, turn budget
 * and contract state. Q45 settled it: *"The source lists 'Stats, Parameters,
 * Buffs, Debuffs, Cooldowns, and other existing effects' — not location. Units
 * are not teleported back."*
 *
 * Excluded from the BUFFER rather than filtered by the applier. That is what
 * makes the ruling cheap to keep — nothing to filter, on every restore, for
 * ever — and expensive to reverse, which is the correct asymmetry for a ruling
 * this settled.
 *
 * Effects are stored as FULL INSTANCES rather than ids, because an id alone
 * cannot restore a magnitude or an expiry, and each records the id of its
 * source so the applier can drop the orphans Ch. 28 warns about.
 *
 * @param {object} unit a board projection or a document's `system`
 * @param {number} globalTurn
 * @returns {object}
 */
export function snapshotUnit(unit, globalTurn) {
  return {
    globalTurn,
    stats: {
      health: pool(unit?.health),
      agility: pool(unit?.agility),
      luck: pool(unit?.luck),
    },
    parameters: { ...(unit?.parameters ?? {}) },
    grantedSteps: { ...(unit?.grantedSteps ?? {}) },
    baseAttackPenalty: { ...(unit?.baseAttackPenalty ?? {}) },
    effects: (unit?.effectInstances ?? []).map((e) => ({
      defId: e.defId ?? null,
      magnitude: e.magnitude ?? 0,
      npMagnitude: e.npMagnitude ?? null,
      stage: e.stage ?? 0,
      uses: e.uses ?? 0,
      expiry: e.expiry ?? null,
      appliedTick: e.appliedTick ?? null,
      // WHOSE this is. Ch. 28's own RISK: *"What must not happen is the rewind
      // restoring an effect whose source has since been removed, producing an
      // orphaned instance."* The applier can only drop such an instance if the
      // snapshot recorded who put it there.
      sourceUnitId: e.sourceUnitId ?? null,
      sourceAbilityId: e.sourceAbilityId ?? null,
      unremovable: Boolean(e.unremovable),
    })),
    cooldowns: Object.fromEntries((unit?.abilities ?? [])
      .filter((a) => a?.id)
      .map((a) => [a.id, { remaining: a.cooldownRemaining ?? a.cooldown?.remaining ?? 0 }])),
    resources: Object.fromEntries(Object.entries(unit?.resources ?? {})
      .map(([k, v]) => [k, pool(v)])),
    modes: Object.fromEntries((unit?.abilities ?? [])
      .filter((a) => a?.id && a.isMode)
      .map((a) => [a.id, { active: Boolean(a.active) }])),
  };
}

/**
 * A resource as `{value, max}`, whichever shape it arrived in.
 *
 * The board flattens some pools to a bare number and leaves others as pairs,
 * and a buffer that stored whichever it happened to be handed would restore
 * two different shapes on two different paths.
 *
 * @param {number|{value: number, max: number}|null|undefined} raw
 * @returns {{value: number, max: number}}
 */
function pool(raw) {
  if (typeof raw === "number") return { value: raw, max: raw };
  return { value: raw?.value ?? 0, max: raw?.max ?? 0 };
}

/**
 * What changed between two snapshots.
 *
 * The diffing is what keeps the buffer inside Ch. 28's ≈280 KB budget: a patch
 * that always carried everything would be a ring of full snapshots wearing a
 * disguise. Shallow per top-level key, because these are small objects and a
 * deep structural diff would cost more to compute than it saves.
 *
 * @param {object} prev
 * @param {object} next
 * @returns {object} the keys of `next` that differ
 */
export function diffSnapshots(prev, next) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [key, value] of Object.entries(next ?? {})) {
    if (JSON.stringify(prev?.[key]) !== JSON.stringify(value)) out[key] = value;
  }
  return out;
}

/**
 * Rebuild a snapshot from a base and a patch.
 *
 * @param {object} base
 * @param {object} patch
 * @returns {object}
 */
export function applyPatch(base, patch) {
  return { ...base, ...patch };
}
