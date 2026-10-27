/**
 * @file The form a Unit has taken.
 * @see docs/24-modes-and-control.md, module/engine/transform.mjs
 *
 * Layer 2 (rules). Pure. Gilles (Caster)'s Gigantic Horror (#323): *"Replace
 * Gilles with the Gigantic Horror, and its new Stats are as follows"*. The same
 * Unit and the same contract (11a); its stats, Attributes and Normal Attack the
 * form's (`overrides`, read by the projection as a variant's are); and every
 * ability the sheet does not name gone (11f), its passives and its uses alike.
 */

/**
 * The form this actor has taken, and the ability that defines it, or `null`.
 *
 * @param {object} actor an Actor or its stand-in, with `system.formTaken` and `items`
 * @returns {{id: string, abilityId: string, spec: object}|null}
 */
export function formOf(actor) {
  const id = actor?.system?.formTaken ?? null;
  if (!id) return null;
  const item = [...(actor.items ?? [])].find((i) => i.system?.form?.id === id) ?? null;
  return item ? { id, abilityId: item.id, spec: item.system.form } : null;
}

/**
 * Does this ability survive the form? An ability the form keeps, or the one
 * that defines it. Anything but an ability (an Item held) is no business of
 * the form's.
 *
 * @param {object} actor
 * @param {object} item
 * @returns {boolean}
 */
export function keptByForm(actor, item) {
  const form = formOf(actor);
  // An ability that is the FORM's, and only there: Siegfried's kit on Sieg
  // (#345). Gone until that form is taken.
  const only = item?.system?.formOnly ?? null;
  if (only) return form?.id === only;
  if (!form) return true;
  if (item?.type !== "ability" && item?.type !== "noblePhantasm") return true;
  if (item.id === form.abilityId) return true;
  return (form.spec.keeps ?? []).includes(item.system?.contentId);
}

/**
 * Does this Unit hold this ability at all, now? An ability only a form holds
 * is not his until he takes it: Siegfried's seven on Sieg are not on his bar or
 * sheet, greyed or otherwise, while he is Sieg (#345). An ability his form
 * drops is still his, greyed with its reason.
 *
 * @param {object} actor
 * @param {object} item
 * @returns {boolean}
 */
export function heldNow(actor, item) {
  const only = item?.system?.formOnly ?? null;
  return !only || formOf(actor)?.id === only;
}

/**
 * Who the Unit IS while in its form: the identity a form that is another
 * Servant's sheet replaces (Siegfried on Sieg, #345 ruling 1). Its own sheet's
 * otherwise. The one reader both projections ask (`rules/snapshot.mjs`).
 *
 * @param {object} actor
 * @returns {{trueName: string|null, servantClasses: string[], alignment: object|null,
 *   region: string[], parameters: object, baseHealth: number|null}}
 */
export function formSheet(actor) {
  const sys = actor?.system ?? {};
  const o = formOf(actor)?.spec?.overrides ?? {};
  return {
    trueName: o.trueName ?? sys.trueName ?? null,
    servantClasses: [...(o.servantClasses ?? sys.servantClasses ?? [])],
    alignment: o.alignment ?? sys.alignment ?? null,
    region: [...(o.region ?? sys.region ?? [])],
    parameters: o.parameters ?? sys.parameters ?? {},
    baseHealth: o.baseHealth ?? sys.baseHealth ?? null,
  };
}

/**
 * What the form overrides in the projection, with its grown Range in.
 *
 * @param {object} actor
 * @returns {object|null} a `summonVariant`-shaped override block
 */
export function formOverrides(actor) {
  const form = formOf(actor);
  if (!form) return null;
  const o = form.spec.overrides ?? {};
  const grown = form.spec.rangeGrows ? (actor.system?.formRangeBonus ?? 0) : 0;
  return {
    ...o,
    ...(o.range ? { range: { ...o.range, panels: (o.range.panels ?? 1) + grown } } : {}),
  };
}
