/**
 * @file The actor sheet after FGO's Servant screen (#364 rulings 13-19).
 * @see module/apps/actor-sheet/present.mjs, module/apps/hud/present.mjs,
 *   docs/35-sheets-and-editor.md
 *
 * The faces are the live roster's: Gray carries Foundry's silhouette and an
 * authored `defaultImage` of `systems/fgt/assets/classes/assassin.webp`;
 * Medea carries her own portrait (read live, 2026-11-01).
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import {
  rankSegments, portraitCard, isBlankPortrait, parameterTiles, CLASS_ICONS, PORTRAIT_CARD_TYPES,
} from "../../module/apps/actor-sheet/present.mjs";
import { portraitBlock } from "../../module/apps/hud/present.mjs";

const SILHOUETTE = "icons/svg/mystery-man.svg";
const ASSASSIN = "systems/fgt/assets/classes/assassin.webp";

describe("rankSegments", () => {
  const filled = (rank) => rankSegments(rank).filter(Boolean).length;

  it("fills E to EX, one segment a letter", () => {
    expect(["E", "D", "C", "B", "A", "EX"].map(filled)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(rankSegments("C")).toHaveLength(6);
  });

  it("fills by the letter alone: a + is printed, never stretched", () => {
    expect(filled("A+++")).toBe(5);
    expect(filled("B-")).toBe(4);
    expect(filled("ex")).toBe(6);
  });

  it("fills nothing for a Rank off the ladder", () => {
    expect(filled("—")).toBe(0);
    expect(filled(null)).toBe(0);
    expect(filled("Q")).toBe(0);
  });

  it("is what each parameter row draws, from the Rank in force", () => {
    const [str] = parameterTiles({ str: "C" }, {}, { str: "B" });
    expect(str.segments.filter(Boolean)).toHaveLength(4);
  });
});

describe("portraitCard", () => {
  const card = (over = {}) => portraitCard({
    type: "servant", img: SILHOUETTE, defaultImage: ASSASSIN,
    classId: "assassin", className: "Assassin", name: "Gray", ...over,
  });

  it("shows the class image large when the Unit has no face of its own", () => {
    expect(card()).toMatchObject({ img: ASSASSIN, isClassIcon: true, className: "Assassin", name: "Gray" });
  });

  it("falls back to the system's icon for its class when none was authored", () => {
    expect(card({ defaultImage: null }).img).toBe(ASSASSIN);
    expect(existsSync("assets/classes/assassin.webp")).toBe(true);
  });

  it("keeps a portrait the Unit has", () => {
    expect(card({ img: "systems/fgt/assets/servants/medea.webp" }))
      .toMatchObject({ img: "systems/fgt/assets/servants/medea.webp", isClassIcon: false });
  });

  it("says the class once when the name this viewer may see is the class", () => {
    // A concealed Servant, to an opponent: "Caster", not "Caster / Caster".
    expect(card({ className: "Caster", name: "Caster" }).className).toBeNull();
  });

  it("frames the four kinds of Unit with a face, and leaves the rest a plain header", () => {
    for (const type of PORTRAIT_CARD_TYPES) expect(card({ type })).not.toBeNull();
    expect(card({ type: "platform" })).toBeNull();
    expect(card({ type: "structure" })).toBeNull();
  });

  it("guesses no icon for a class the system ships none for", () => {
    // Saver is a Servant class (`SERVANT_CLASSES`) with no file in assets/classes.
    expect(card({ defaultImage: null, classId: "saver" }).img).toBe(SILHOUETTE);
  });

  it("names only icons that ship", () => {
    for (const id of CLASS_ICONS) expect(existsSync(`assets/classes/${id}.webp`)).toBe(true);
  });
});

describe("the bar's portrait reads the same rule", () => {
  it("shows the class image for an owner whose Unit has no face", () => {
    const out = portraitBlock({ kind: "servant", identityRevealed: false }, {
      img: SILHOUETTE, defaultImage: ASSASSIN, publicName: "Assassin", trueName: "Gray", isOwner: true,
    });
    expect(out).toMatchObject({ img: ASSASSIN, name: "Gray" });
    expect(isBlankPortrait(SILHOUETTE)).toBe(true);
  });
});
