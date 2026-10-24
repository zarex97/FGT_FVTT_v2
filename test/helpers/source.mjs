/**
 * @file A source scan's one reader of a function's text.
 *
 * Scans sliced a fixed number of characters after a function's header, so the
 * window's end moved with the line endings of the checkout: a CRLF checkout made
 * Drake's 5000-character slice of `fireDamageDealt` stop short of the check it
 * asserted (2026-10-24). A function is read from its header to the next
 * top-level function instead, its line endings normalised first.
 */

/**
 * The text of one top-level function, header to the next top-level function.
 *
 * @param {string} src a module's source
 * @param {string} header the start of its declaration, e.g. `"async function cutContract("`
 * @returns {string} empty when the header is not found, so a match fails out loud
 */
export function functionBody(src, header) {
  const text = String(src).replace(/\r\n/g, "\n");
  const from = text.indexOf(header);
  if (from < 0) return "";
  const rest = text.slice(from + header.length);
  const next = rest.search(/\n(?:export )?(?:async )?function[\s*]/);
  return text.slice(from, next < 0 ? undefined : from + header.length + next);
}
