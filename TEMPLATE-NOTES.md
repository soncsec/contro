# Template notes

Setup changes made in Contro that would help every game. Input for Star Destroyer's roadmap task T1 (`soncsec/game-template`, ARCHITECTURE.md ADR-C09).

| Change | Where in Contro | Why it belongs in the template |
|---|---|---|
| ESLint bans `innerHTML`, `outerHTML` and `insertAdjacentHTML` (copied from the portal) | `eslint.config.js` | Every game runs under the same CSP; the portal already enforces this |
| Shared e2e helpers (`watchPage`, `sceneKey`) in their own file | `tests/e2e/watch.ts` | Every spec needs them; Star Destroyer defines them inside one spec |
| e2e check that the canvas is scaled by a whole number | `tests/e2e/boot.spec.ts` | Pixel-art games all depend on it |
| `test:release` and the release scripts are added with M1.9, not at scaffold time | `package.json` | The template should ship them from day one |
| Asset build script that copies or packs frames from `legacy/` and writes the CREDITS.md table, with no Python packages | `tools/art/build_assets.py`, `tools/art/png.py` | Keeps credits and assets in sync and makes every asset reproducible |
| Asset preview pages by fit, so large images get their own page; e2e test walks every page | `src/scenes/AssetPreviewScene.ts` | Star Destroyer's preview has no paging |
| Keyboard input latches taps, so a key pressed and released between two frames still counts | `src/systems/KeyboardInput.ts` | Quick taps (and Playwright's `press`) were lost otherwise |
| Snapshot reports the gameplay clock (sum of frame steps) and timing tests use it, not wall-clock waits | `src/scenes/LevelScene.ts`, `tests/e2e/shooting.spec.ts` | Wall-clock timing tests flaked under load; Phaser caps frame steps after stalls |
| Screenshot scripts use their own port (4177), never Playwright's | (process) | Playwright reuses any server on its port, so a leftover server made tests run an old build |
