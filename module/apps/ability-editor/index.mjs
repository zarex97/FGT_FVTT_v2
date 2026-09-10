/**
 * @file The ability editor's public surface.
 * @see docs/29-user-interface.md §29.6
 *
 * A directory rather than a file, for the reason `actor-sheet/` is one: the
 * editor is growing a rail, eight sections and a descriptor renderer, and
 * leaving them in one module would make it the place all of them lived.
 */

export { AbilityEditor } from "./editor.mjs";
