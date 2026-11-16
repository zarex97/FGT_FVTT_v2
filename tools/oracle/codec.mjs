/**
 * @file The JSON form of an oracle case's values, for the Godot port's replay (grail-tact-godot, Ch. 15).
 *
 * JSON has no Set, no Map, no Infinity and no class instances, and the JS values the rules take and return use all
 * four. Each is written as a one-key tagged object the GDScript loader decodes:
 *
 *   Set      → {"$set": [...]}         Map → {"$map": [[k, v], ...]}
 *   Infinity → {"$num": "inf"}        -Infinity → {"$num": "-inf"}        NaN → {"$num": "nan"}
 *   Rank     → {"$rank": "A+"}
 *   a function handed in → {"$fn": [[args, result], ...]}, every call the recorded call made of it (`fnSlot`)
 *
 * Object keys keep their insertion order. An `undefined` property is left out, as JSON.stringify leaves it; an `undefined` array
 * element is written `null`. A function anywhere in a value is an error, never silently dropped: a case that holds
 * one cannot be replayed, and the exporter says which.
 */

/**
 * @param {unknown} value
 * @param {string} [at] where in the value, for the error
 * @returns {unknown} a JSON-safe value
 */
export function encode(value, at = "$", fnSlot = null) {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") {
    if (Number.isFinite(value)) return value;
    if (Number.isNaN(value)) return { $num: "nan" };
    return { $num: value > 0 ? "inf" : "-inf" };
  }
  if (value === undefined) return null;
  // A function handed in is a table of what it answered while the recorded call ran (`record-lib.mjs#recording`), when
  // the caller keeps one; anywhere else it cannot be replayed.
  if (typeof value === "function") {
    if (fnSlot) return fnSlot(value, at);
    throw new Error(`oracle codec: a function at ${at} cannot be replayed`);
  }
  if (typeof value === "bigint" || typeof value === "symbol") throw new Error(`oracle codec: a ${typeof value} at ${at}`);
  if (value instanceof Set) return { $set: [...value].map((v, i) => encode(v, `${at}[set ${i}]`, fnSlot)) };
  if (value instanceof Map) return { $map: [...value].map(([k, v], i) => [encode(k, `${at}[key ${i}]`, fnSlot), encode(v, `${at}[${String(k)}]`, fnSlot)]) };
  if (value?.constructor?.name === "Rank" && typeof value.toString === "function") return { $rank: String(value) };
  if (Array.isArray(value)) return value.map((v, i) => encode(v, `${at}[${i}]`, fnSlot));
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    throw new Error(`oracle codec: an instance of ${value.constructor?.name ?? "?"} at ${at}`);
  }
  const out = {};
  // Insertion order, not sorted: a JS reader that walks `Object.keys` answers in that order, and the replay must
  // walk the same keys in the same order (Godot keeps a Dictionary's order from the JSON text).
  for (const key of Object.keys(value)) {
    if (value[key] === undefined) continue;
    out[key] = encode(value[key], `${at}.${key}`, fnSlot);
  }
  return out;
}
