---
id: 2026-11-02-release-zip-drops-nocturne-fonts
found: tooling
kind: asset-outside-the-package
status: fixed
reviewed: true
pattern: asset-outside-the-package
---
**Expected:** A released F/GT draws Grail War Nocturne as the dev world does: Cinzel and Barlow, shipped in `fonts/` (#364, c504d31f).
**Actual:** The release zip leaves `fonts/` out. "Assemble the package" copies `system.json module packs templates styles lang assets LICENSE README.md CHANGELOG.md`, and `styles/src/_fonts.scss` asks for `url("../fonts/barlow-condensed-latin-600-normal.woff2")` and 25 more. Every `@font-face` would 404, and Nocturne would fall back to the browser's faces. Found while adding the Classic look's stylesheet to the same build.
**Cause:** `.github/workflows/release.yml:87 @ bb73c849` — the copy list is written by hand; e675488e added a top-level folder and nothing named it there.
**Fix:** `.github/workflows/release.yml:87 @ cc434eee` — `fonts` joins the copy list.
