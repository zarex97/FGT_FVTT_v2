---
id: 2026-11-01-chat-log-forced-light
found: live press
kind: assumed-shape
status: fixed
reviewed: true
pattern: assumed-shape
---
**Expected:** Once a card's message carried `fgt`, the card would take the interface's theme through `.theme-light .fgt`. That is the ruling in #364: "cards follow Foundry's interface theme". Under a dark interface it would be dark.
**Actual:** Under a dark interface, every card came out light. The marked message measured `rgb(255, 253, 247)` on `rgb(35, 32, 26)` ink. Its ancestors read `ol.chat-log.plain.themed.theme-light`, then `div#interface.themed.theme-dark`.
**Cause:** `foundryVTT_copy` 14.364 forces the chat log `themed theme-light`, because core's messages sit on parchment. I keyed the card's theme on the nearest `theme-*` class without reading one live chat message's ancestors first.
**Fix:** `styles/src/_tokens.scss` @ d635ad47. The palettes are now mixins, and `#interface.theme-dark .fgt.fgt-message` re-applies the dark one. The chat popout lies outside `#interface` and core forces it light, so it stays light.
