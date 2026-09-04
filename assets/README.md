# Shipped artwork

Images the compiled compendium entries point at. Foundry serves this directory as
`systems/fgt/assets/`, and the build (`tools/build-packs.mjs`) sets every image path at compile
time, so a file dropped here under the right name reaches the pack with no YAML edit.
See `docs/37-content-pipeline.md` §37.3.

| Directory | File name | Becomes |
|---|---|---|
| `classes/` | the class-container id: `saber`, `archer`, `lancer`, `rider`, `caster`, `assassin`, `berserker`, `ruler`, `avenger`, `alterEgo`, `foreigner`, `moonCancer`, `pretender`, `beast` | `system.defaultImage` on every Servant summoned into that container — the face the table sees until its identity is revealed, on the sheet and on the token |
| `servants/` | the Servant's content `id` (`asterios`, `jack-the-ripper`, `pale-rider`, …) | `img`, the true portrait — the compendium thumbnail, the owner's and the GM's sheet, and the token once revealed |
| `summons/`, `platforms/`, `structures/`, `masters/` | the content `id` | `img`, which these types show everywhere |

Any format Foundry accepts (`webp`, `png`, `jpg`, `jpeg`, `svg`, `gif`, `avif`); `webp` is the
one to prefer for size. One file per id: `karna.webp` and `karna.png` side by side is a build
error, not a coin flip.

An authored `img:` or `defaultImage:` in the YAML still wins over the file found here.

`npm run validate:content` warns for every unit whose file is missing, naming the path it
expected. Run it after adding a batch to catch a misspelt name.
