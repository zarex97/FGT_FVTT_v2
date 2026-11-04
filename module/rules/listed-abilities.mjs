/**
 * @file An attack's clauses keyed on the abilities its target and its user's ground carry.
 * @see docs/17-abilities.md, docs/superpowers/specs/2026-11-02-gilgamesh-clauses.md
 *
 * Layer 2 (rules). Pure: it reads what it is handed.
 *
 * Enuma Elish (#374) lists abilities by name, and each listed ability does one of
 * three things when he uses it:
 *
 *   - **An area he stands in ends** (`endsFieldsInside`). *"If Gilgamesh uses Enuma
 *     Elish while he is inside the NP area, the NP is forcefully ended."* Read at
 *     the declaration (reading 18), whoever owns the area.
 *   - **Its bearer, if hit, is sealed** (`strikeListedAbilities`, a phase). *"If the
 *     Unit with this NP is affected by Enuma Elish, it is inflicted with NP Seal
 *     (Ea) for 3◈ Turns"*: one effect naming the one ability (reading 19).
 *   - **What it caused is removed** (a row's `removesCaused`). *"Remove all effects
 *     caused by this NP from all Units on the field"*: every instance on a Unit
 *     sourced from that ability, either side (reading 20).
 *
 * A listed ability is its content id, never words inside a name (reading 30), so
 * Kama's Mara-Papiyas is not Nobunaga's Papiyas. A `tags` row is the sheet's *"other
 * abilities with Reality Marble in its name"*, which only a printed tag can hold
 * (reading 24): an area among them ends, and any other seals its bearer.
 */

/**
 * The fields a declaration ends, from where its user stands now.
 *
 * @param {{abilities?: string[], tags?: string[]}|null|undefined} spec the ability's `endsFieldsInside`
 * @param {{fields?: string[]}|null|undefined} self the user, as the board sees it
 * @param {{fields?: object[]}|null|undefined} board
 * @returns {string[]} field ids
 */
export function fieldsEndedBy(spec, self, board) {
  if (!spec) return [];
  const inside = new Set(self?.fields ?? []);
  return (board?.fields ?? [])
    .filter((f) => inside.has(f.id))
    .filter((f) => (spec.abilities ?? []).includes(f.id)
      || (f.npTags ?? []).some((t) => (spec.tags ?? []).includes(t)))
    .map((f) => f.id);
}

/**
 * Does this ability deploy an area?
 *
 * @param {object} item an ability Item
 * @returns {boolean}
 */
function deploysArea(item) {
  return Boolean(item?.system?.field);
}

/**
 * Which of a bearer's abilities a phase's rows reach, each with the row reaching it.
 *
 * @param {{rows?: object[]}} phase a `strikeListedAbilities` phase
 * @param {Iterable<object>} items the bearer's ability Items
 * @returns {Array<{item: object, row: object}>}
 */
export function struckAbilities(phase, items) {
  /** @type {Array<{item: object, row: object}>} */
  const out = [];
  for (const item of items ?? []) {
    const id = item?.system?.contentId ?? null;
    const tags = [...(item?.system?.npTags ?? [])];
    const row = (phase?.rows ?? []).find((r) => (r.abilities ?? []).includes(id)
      || (!deploysArea(item) && tags.some((t) => (r.tags ?? []).includes(t))));
    if (row) out.push({ item, row });
  }
  return out;
}

/**
 * The instances an ability has placed on these Units.
 *
 * @param {object} item the ability Item
 * @param {string} bearerId
 * @param {Array<{id: string, effectInstances?: object[]}>} units
 * @returns {Array<{unitId: string, instance: object}>}
 */
export function causedBy(item, bearerId, units) {
  const ids = new Set([item?.id, item?.system?.contentId].filter(Boolean));
  /** @type {Array<{unitId: string, instance: object}>} */
  const out = [];
  for (const unit of units ?? []) {
    for (const instance of unit.effectInstances ?? []) {
      if (instance.sourceUnitId !== bearerId) continue;
      if (ids.has(instance.sourceAbilityId) || ids.has(instance.sourceFieldId)) out.push({ unitId: unit.id, instance });
    }
  }
  return out;
}

/**
 * Is this field's ability sealed on its owner?
 *
 * Areas fall outside *"from all Units"* (#374 reading 20), so a sealed NP's area
 * stands, and its effects do nothing while the seal holds: *"negating all its
 * effects"*.
 *
 * @param {{id: string, ownerId?: string}} field
 * @param {{units?: object[]}|null|undefined} board
 * @returns {boolean}
 */
export function fieldSealed(field, board) {
  const owner = (board?.units ?? []).find((u) => u.id === field?.ownerId);
  return (owner?.effectInstances ?? []).some((e) => e.params?.sealsAbility === field.id);
}
