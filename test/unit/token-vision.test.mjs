/**
 * @file A unit's Detect radius, as Foundry vision.
 * @see module/engine/token-vision.mjs, docs/08-board-and-geometry.md §8.7
 *
 * Ch. 8.7 decided that fog of war is Foundry's, driven by `TokenDocument.sight`,
 * and `data/actor/_shared.mjs` states outright that vision range and Detect are
 * the same number. `detectRangeOf` computed it and the class table behind it was
 * authored and tested — and nothing ever wrote the number to a token, so every
 * unit stood at Foundry's default `sight.enabled: false, range: 0`.
 *
 * On a scene with token vision on, that is not "no fog": it is a black canvas
 * with the player's own Servant invisible in the middle of it. Reported from
 * play by a player who owned a Servant and could see nothing.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { sightFor } from "../../module/engine/token-vision.mjs";

const actor = (type, system = {}) => ({ id: "a1", type, name: "X", img: "x.webp", system });

/** `sightFor` reads the scene's grid distance off the canvas global. */
function withGridDistance(distance, fn) {
  globalThis.canvas = { scene: { grid: { distance } } };
  try { return fn(); } finally { delete globalThis.canvas; }
}

beforeEach(() => { globalThis.canvas = { scene: { grid: { distance: 1 } } }; });
afterEach(() => { delete globalThis.canvas; });

describe("sightFor", () => {
  it("enables vision, which is the whole bug", () => {
    // Foundry's default is `enabled: false`. Everything else here is detail;
    // this line is the one that stops a player seeing a black screen.
    expect(sightFor(actor("servant", { classContainer: "berserker" })).sight.enabled).toBe(true);
  });

  it("gives each class container its own radius", () => {
    const range = (container) => sightFor(actor("servant", { classContainer: container })).sight.range;
    expect(range("archer")).toBe(4);
    expect(range("assassin")).toBe(4);
    expect(range("saber")).toBe(2);
    expect(range("berserker")).toBe(2);
  });

  it("sees three panels as a Caster outside its Home Base", () => {
    // The conditional entry. With no board there is no Home Base to stand in,
    // so the outside value is the honest answer rather than the generous one.
    expect(sightFor(actor("servant", { classContainer: "caster" })).sight.range).toBe(3);
  });

  it("honours an explicit Detect over the class table", () => {
    // The Golden Hind states "Detect: 4" and has no class container at all.
    expect(sightFor(actor("platform", { detect: 4 })).sight.range).toBe(4);
  });

  it("gives a Master the one panel its entry says", () => {
    expect(sightFor(actor("master", {})).sight.range).toBe(1);
  });

  it("converts panels into the scene's distance units", () => {
    // `sight.range` is in DISTANCE, not panels. Reading the panel count
    // straight into the field works by accident on a grid of distance 1 and
    // silently quarters an Archer's vision on a 5-foot grid.
    const range = withGridDistance(5, () =>
      sightFor(actor("servant", { classContainer: "archer" })).sight.range);
    expect(range).toBe(20);
  });

  it("gives nothing to a document that is not a unit", () => {
    expect(sightFor(actor("character", {}))).toBeNull();
    expect(sightFor(null)).toBeNull();
  });

  it("covers every unit type, not only Servants", () => {
    // `token-image.mjs` shipped Servant-only and had to be widened once a
    // Master's token was found stuck on an old portrait. Same mistake, so the
    // same guard.
    for (const type of ["servant", "master", "civilian", "summon", "platform", "structure"]) {
      expect(sightFor(actor(type, {}))?.sight?.enabled).toBe(true);
    }
  });
});
