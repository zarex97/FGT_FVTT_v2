/**
 * @file What a chat card is allowed to show.
 * @see module/engine/public-identity.mjs, docs/04-units.md §4.2
 *
 * A chat message is ONE document every viewer reads identically, exactly like a
 * token's texture — Foundry has no per-viewer rendering for either. So a card
 * shows the PUBLIC identity and never the true one, even to the unit's own
 * owner, because the owner's card is the same card the opponent is reading.
 *
 * The skill card showed `actor.img` and `actor.name`, so using a Skill
 * announced a concealed Servant's face and true name to the whole table.
 */
import { describe, it, expect } from "vitest";
import { publicImageOf, publicIdentityOf } from "../../module/engine/public-identity.mjs";

const servant = (over = {}) => ({
  id: "s1",
  type: "servant",
  name: "Medusa",
  img: "true-face.webp",
  system: {
    identityRevealed: false,
    defaultImage: "classes/rider.webp",
    trueName: "Medusa",
    classContainer: "rider",
    concealedIdentity: "",
    factionId: null,
    ...over,
  },
});

const board = { units: [], factions: [] };

describe("publicImageOf", () => {
  it("shows the class image for an unrevealed Servant", () => {
    expect(publicImageOf(servant())).toBe("classes/rider.webp");
  });

  it("shows the true portrait once the identity is revealed", () => {
    expect(publicImageOf(servant({ identityRevealed: true }))).toBe("true-face.webp");
  });

  it("never conceals a non-Servant", () => {
    const master = { id: "m", type: "master", name: "Kiritsugu", img: "k.webp", system: { defaultImage: "mask.webp" } };
    expect(publicImageOf(master)).toBe("k.webp");
  });

  it("falls back to the portrait when no class image was ever set", () => {
    expect(publicImageOf(servant({ defaultImage: null }))).toBe("true-face.webp");
  });
});

describe("publicIdentityOf", () => {
  it("gives a card the class image and the public name together", () => {
    // Fixing only the image would print "Medusa" beside a Rider icon, which
    // leaks exactly as much and reads as a bug besides.
    expect(publicIdentityOf(servant(), board)).toEqual({
      name: "Rider",
      img: "classes/rider.webp",
    });
  });

  it("gives the true name and portrait once revealed", () => {
    expect(publicIdentityOf(servant({ identityRevealed: true }), board)).toEqual({
      name: "Medusa",
      img: "true-face.webp",
    });
  });

  it("honours an explicit concealed identity over the class container", () => {
    const out = publicIdentityOf(servant({ concealedIdentity: "The Gorgon" }), board);
    expect(out.name).toBe("The Gorgon");
  });

  it("does NOT exempt the owner, because the card is not per-viewer", () => {
    // `publicNameOf` exempts a unit's own owner on a SHEET, where Foundry can
    // render per viewer. A chat message cannot: the owner's card is the same
    // document the opponent reads.
    expect(publicIdentityOf(servant(), board).name).toBe("Rider");
  });

  it("names a Master by its own name, having nothing to conceal", () => {
    const master = { id: "m", type: "master", name: "Kiritsugu", img: "k.webp", system: {} };
    expect(publicIdentityOf(master, board)).toEqual({ name: "Kiritsugu", img: "k.webp" });
  });
});
