/**
 * @file A system card's message wears the system's surface (#364).
 * @see module/apps/chat/surface.mjs, docs/37-chat-and-log.md
 *
 * The suite runs without a DOM, so the message is a stand-in for the two
 * members of `HTMLElement` the helper touches. The wiring (the
 * `renderChatMessageHTML` hook, the li it hands over) was read live.
 */
import { describe, it, expect } from "vitest";
import { markSystemCard } from "../../module/apps/chat/surface.mjs";

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
    expect([...html.classes]).toEqual(expect.arrayContaining(["fgt", "fgt-message"]));
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
