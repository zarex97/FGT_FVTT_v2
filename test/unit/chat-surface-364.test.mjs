/**
 * @file A system card's message wears the system's surface (#364).
 * @see module/apps/chat/surface.mjs, docs/37-chat-and-log.md
 *
 * The suite runs without a DOM, so the message is a stand-in for the two
 * members of `HTMLElement` the helper touches. The wiring (the
 * `renderChatMessageHTML` hook, the li it hands over) was read live.
 */
import { describe, it, expect } from "vitest";
import { markSystemCard, viewerRole } from "../../module/apps/chat/surface.mjs";

const message = (hasCard) => {
  const classes = new Set(["chat-message", "message", "flexcol"]);
  return {
    classes,
    classList: { add: (...names) => names.forEach((n) => classes.add(n)) },
    querySelector: (selector) => (selector === ".fgt-card" && hasCard ? {} : null),
  };
};

describe("markSystemCard", () => {
  it("gives a card's message the tokens and the frame's class", () => {
    const html = message(true);
    expect(markSystemCard(html)).toBe(true);
    expect([...html.classes]).toEqual(expect.arrayContaining(["fgt", "fgt-message", "themed", "theme-dark"]));
  });

  it("leaves a player's own chat line on core's parchment", () => {
    const html = message(false);
    expect(markSystemCard(html)).toBe(false);
    expect(html.classes.has("fgt")).toBe(false);
    expect(html.classes.has("fgt-message")).toBe(false);
  });

  it("ignores a hook call with no element", () => {
    expect(markSystemCard(null)).toBe(false);
  });
});

// Whose card it is, to the one reading it: the banner, the frame and the YOU.
describe("viewerRole", () => {
  it("reads a GM as the GM, whatever the GM owns", () => {
    expect(viewerRole({ isGM: true, ownsActor: true, ownsTarget: true })).toBe("gm");
  });

  it("tells the attacker, the defender and everyone else apart", () => {
    expect(viewerRole({ ownsActor: true })).toBe("attacker");
    expect(viewerRole({ ownsTarget: true })).toBe("defender");
    expect(viewerRole({})).toBe("observer");
  });

  it("reads a player who holds both sides as both", () => {
    expect(viewerRole({ ownsActor: true, ownsTarget: true })).toBe("both");
  });
});
