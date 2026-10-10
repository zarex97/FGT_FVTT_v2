/**
 * @file SessionStart: say when enough Surprises wait for review.
 *
 * Prints one line into the session's starting context at REVIEW_AT or more
 * unreviewed records, and nothing below it.
 */

import { REVIEW_AT, unreviewed } from "./surprise-lib.mjs";

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const waiting = unreviewed(root).length;
if (waiting >= REVIEW_AT) {
  process.stdout.write(`${waiting} Surprises are waiting for review: tell the user to run /review-surprises.\n`);
}
