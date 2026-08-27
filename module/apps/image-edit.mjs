/**
 * @file The "click a portrait to change it" wiring every AppV2 sheet needs.
 * @see docs/29-user-interface.md §29.2
 *
 * AppV1's `FormApplication` wired an `img[data-edit]` click into a FilePicker
 * for free. `ActorSheetV2`/`ItemSheetV2` do not — an `img[data-edit="img"]`
 * with no `data-action` bound to it is inert, which is why neither the actor
 * sheet's portrait nor the ability sheet's icon could be changed: both
 * templates already carried the AppV1 markup, and nothing had carried the
 * behaviour over.
 *
 * One helper rather than one copy per sheet class, because the two call sites
 * (`FGTActorSheet`, `FGTItemSheet`) do the exact same thing to two different
 * document types.
 */

/**
 * Open a FilePicker for the field an image element names, and write the pick
 * back to the sheet's document.
 *
 * @param {object} app the sheet application; needs `.document`
 * @param {HTMLElement} target the clicked element, carrying `data-edit`
 * @returns {Promise<void>}
 */
export async function editImage(app, target) {
  const attr = target.dataset.edit;
  if (!attr) return;

  const current = foundry.utils.getProperty(app.document, attr) || "";
  const picker = new foundry.applications.apps.FilePicker.implementation({
    type: "image",
    current,
    callback: (path) => app.document.update({ [attr]: path }),
  });
  return picker.browse();
}
