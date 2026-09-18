/**
 * @file The borrow point: Foundry's real `common/` layer.
 * @see docs/adr/0006-the-world-model-borrows-foundry-and-stays-harsher.md
 *
 * `common/` is the half of Foundry that is plain ESM with no browser in it —
 * `DataModel`, the `DataField` classes, `CONST` — so it imports into Node
 * unmodified. The world model borrows it rather than imitating it, because a
 * hand-written `NumberField` is a second spelling of a large system we do not
 * own, and every divergence between the two spellings is a bug the suite is
 * blind to by construction.
 *
 * It is **not vendored**. Foundry's source is proprietary and this repo is not
 * the place for it; it lives under a developer licence in the sibling repo
 * `zarex97/foundryVTT_copy`, checked out beside this one. Git history survives
 * a visibility flip, so a copy that lands here is here for good.
 *
 * Resolution is relative to THIS file rather than the working directory, so it
 * answers the same from a test, a tool and a CI step.
 */

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** `<GitHub>/foundryVTT_copy/app/common/`, from `<GitHub>/FGT_FVTT_v2/test/helpers/`. */
const ROOT = new URL("../../../foundryVTT_copy/app/common/", import.meta.url);

if (!existsSync(fileURLToPath(ROOT))) {
  throw new Error(
    `Foundry's common layer is not at ${fileURLToPath(ROOT)}.\n`
    + "The world model runs against Foundry's real DataModel and DataField classes rather than\n"
    + "fakes of them. Clone the sibling repo beside this one:\n"
    + "    git clone git@github.com:zarex97/foundryVTT_copy.git ../foundryVTT_copy\n"
    + "See docs/adr/0006-the-world-model-borrows-foundry-and-stays-harsher.md.",
  );
}

export const abstract = await import(new URL("abstract/_module.mjs", ROOT).href);
export const fields = await import(new URL("data/fields.mjs", ROOT).href);
export const data = await import(new URL("data/_module.mjs", ROOT).href);
export const utils = await import(new URL("utils/_module.mjs", ROOT).href);
export const CONST = await import(new URL("constants.mjs", ROOT).href);
