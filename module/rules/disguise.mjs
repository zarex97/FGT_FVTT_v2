/**
 * @file A Disguise: a Unit that looks like another to everyone but its own.
 * @see docs/30-concealment-and-identity.md, docs/A-effect-catalogue.md
 *
 * Layer 2 (rules). Pure.
 *
 * Yan Qing's Doppelganger (#253 readings 10-14): *"Yan Qing can disguise himself
 * as any other character (figurine), including Masters and Servants. However,
 * it is only the appearance. All of Yan Qing's Parameters and Stats remain the
 * same."* Appendix A's `Disguise`: a per-viewer presentation override -- name,
 * image and disposition colour -- and no state change. Every rule sees the Unit
 * as itself; only what a person is shown changes.
 *
 * The look is carried on the `disguise` effect instance (`params`), copied off
 * the Unit it was taken from at the moment it was taken: a copy that is later
 * defeated or leaves the board leaves the disguise standing (reading 10).
 */

/** The effect that carries a Disguise. */
export const DISGUISE = "disguise";

/**
 * The look a Unit wears, or `null`.
 *
 * @param {object|null} unit a board unit (`effectInstances`)
 * @returns {{as: string, name: string, img: string, disposition: number|null}|null}
 */
export function disguiseOf(unit) {
  const instance = (unit?.effectInstances ?? []).find((e) => e.defId === DISGUISE) ?? null;
  const params = instance?.params ?? null;
  if (!params?.as) return null;
  return {
    as: params.as,
    name: params.name ?? "",
    img: params.img ?? "",
    disposition: Number.isFinite(params.disposition) ? params.disposition : null,
  };
}

/**
 * Does this viewer see through the disguise?
 *
 * Only the Unit's owner and the GM, an OWNER check: his teammates are fooled
 * too (#253 reading 11, as Danzō's Feigned Defeat, #249 reading 34).
 *
 * @param {{isGM?: boolean, isTrueOwner?: boolean}} viewer
 * @returns {boolean}
 */
export function seesTruth(viewer) {
  return Boolean(viewer?.isGM || viewer?.isTrueOwner);
}
