/**
 * @file A bounded field's interior EVENTS — branch selection and filters.
 * @see docs/43-bounded-fields.md §43.6
 */

import { describe, it, expect } from "vitest";


describe("requiresEffect", () => {
  // The mirror of `kinds:` — a filter on what the Unit is carrying rather than
  // on what it is. Guidance of the Netherworld's discharge is the only clause
  // in the corpus that needs one.
  const spec = { event: "contact", relations: ["ally"], requiresEffect: "gotn" };

  const holds = (unit) => !spec.requiresEffect
    || (unit.effects ?? []).map((e) => e?.defId ?? e).includes(spec.requiresEffect);

  it("passes a Unit carrying the effect, as an id or an instance", () => {
    expect(holds({ effects: ["gotn"] })).toBe(true);
    expect(holds({ effects: [{ defId: "gotn" }] })).toBe(true);
  });

  it("refuses a Unit without it", () => {
    expect(holds({ effects: ["atkUp"] })).toBe(false);
    expect(holds({ effects: [] })).toBe(false);
    expect(holds({})).toBe(false);
  });
});
