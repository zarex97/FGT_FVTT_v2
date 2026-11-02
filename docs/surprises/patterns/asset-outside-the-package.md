---
kind: asset-outside-the-package
lesson: A folder the system loads at runtime is named in the release copy list the day it is added.
landed: none
---
**Mechanism:** The release workflow copies a hand-written list of folders into the zip. A new top-level folder the system loads at runtime (Nocturne's `fonts/`) works in every dev world, because they run from the checkout, and is missing from every release, where each `@font-face` would 404.
**Lesson:** When a change adds a top-level folder the system reads at runtime, add it to "Assemble the package" in `.github/workflows/release.yml` in the same commit. A guard that compares the list with the folders `system.json`, the stylesheets and the templates reference would catch the next one; a one-off until then.
**Surprises:** [2026-11-02-release-zip-drops-nocturne-fonts](../2026-11-02-release-zip-drops-nocturne-fonts.md)
