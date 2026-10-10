/**
 * @file Stop: ask once whether a turn that hit a failure owes a Surprise record.
 *
 * Reads this turn of the transcript -- everything after the user's last prompt
 * -- and blocks the stop with a reminder only when a tool result shows a
 * failure and no Surprise file was written. `stop_hook_active` means the
 * reminder already ran this turn, so it never loops.
 */

import { readFileSync } from "node:fs";

// A failed command already sets `is_error`. The text test is for what a pipe
// hides: a test runner's own verdict, matched as it prints it, so prose that
// merely quotes a failure does not count.
const FAILURE = /^\s*(FAIL|×)\s|Test Files\s+\d+ failed|Tests\s+\d+ failed|AssertionError:|^Traceback \(most recent/m;

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8") || "{}");
} catch {
  process.exit(0);
}
if (input.stop_hook_active || !input.transcript_path) process.exit(0);

let lines = [];
try {
  lines = readFileSync(input.transcript_path, "utf8").split("\n").filter(Boolean);
} catch {
  process.exit(0);
}

/** @param {object} entry @returns {boolean} a prompt the user typed, not a tool result */
const isPrompt = (entry) => {
  if (entry.type !== "user") return false;
  const c = entry.message?.content;
  if (typeof c === "string") return true;
  return Array.isArray(c) && c.some((x) => x?.type === "text") && !c.some((x) => x?.type === "tool_result");
};

const entries = lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
let start = 0;
for (let k = entries.length - 1; k >= 0; k--) if (isPrompt(entries[k])) { start = k; break; }
const turn = entries.slice(start + 1);

const text = (x) => (typeof x === "string" ? x : Array.isArray(x) ? x.map((y) => y?.text ?? "").join("\n") : "");
// A call that touches the records themselves: reading them quotes old
// failures ("Exit code 144", "FAIL"), and the text test would take those
// quotes for a failure of this turn.
const SURPRISES = /docs\/surprises\b/;
const touchesRecords = new Set();
let failed = false;
let recorded = false;
for (const e of turn) {
  for (const part of Array.isArray(e.message?.content) ? e.message.content : []) {
    if (part?.type === "tool_use" && SURPRISES.test(JSON.stringify(part.input ?? {}))) {
      recorded = true;
      touchesRecords.add(part.id);
    }
    if (part?.type !== "tool_result") continue;
    if (part.is_error || (!touchesRecords.has(part.tool_use_id) && FAILURE.test(text(part.content)))) failed = true;
  }
}

if (failed && !recorded) {
  process.stdout.write(JSON.stringify({
    decision: "block",
    reason: "This turn hit a failure. If it showed something different from what the design or you expected, "
      + "record it with the record-surprise skill before ending the turn. If it was routine noise, end the turn as it was.",
  }));
}
