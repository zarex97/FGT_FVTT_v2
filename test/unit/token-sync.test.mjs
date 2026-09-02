/**
 * A placed token is not the sheet. These cover the two facts that must travel
 * from an actor onto its token anyway: the image every viewer sees, and the
 * number of panels it stands on.
 *
 * @see module/engine/token-image.mjs, module/engine/token-footprint.mjs
 */
import { describe, it, expect } from "vitest";
import { publicImageOf } from "../../module/engine/token-image.mjs";
import { footprintSize } from "../../module/engine/token-footprint.mjs";

const actor = (type, over = {}) => ({
  type, img: "true.png", system: { ...over },
});

describe("publicImageOf (§4.2)", () => {
  it("shows a concealed Servant's standard image", () => {
    expect(publicImageOf(actor("servant", { defaultImage: "standard.png" })))
      .toBe("standard.png");
  });

  it("shows the true portrait once the identity is revealed", () => {
    expect(publicImageOf(actor("servant", {
      defaultImage: "standard.png", identityRevealed: true,
    }))).toBe("true.png");
  });

  it("falls back to the true portrait when no standard image was authored", () => {
    expect(publicImageOf(actor("servant", {}))).toBe("true.png");
  });

  it.each(["master", "summon", "platform", "civilian", "structure"])(
    "shows %s its own portrait — only a Servant has an identity to conceal",
    (type) => {
      // `identityRevealed` is declared on `ServantData` alone, so reading
      // `defaultImage` unconditionally would pin these types' tokens to a
      // field their own sheet never displays.
      expect(publicImageOf(actor(type, { defaultImage: "standard.png" })))
        .toBe("true.png");
    },
  );
});

describe("footprintSize (§20.3)", () => {
  it("reads a platform's declared footprint", () => {
    expect(footprintSize({ system: { footprint: { w: 9, h: 9 } } }))
      .toEqual({ width: 9, height: 9 });
  });

  it("handles a non-square footprint", () => {
    expect(footprintSize({ system: { footprint: { w: 5, h: 3 } } }))
      .toEqual({ width: 5, height: 3 });
  });

  it("returns null for a unit that declares none", () => {
    expect(footprintSize({ system: {} })).toBeNull();
    expect(footprintSize(null)).toBeNull();
  });

  it("returns null rather than a nonsense size for a malformed footprint", () => {
    expect(footprintSize({ system: { footprint: { w: 0, h: 9 } } })).toBeNull();
    expect(footprintSize({ system: { footprint: { w: null, h: null } } })).toBeNull();
  });
});
