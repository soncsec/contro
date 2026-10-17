# Template notes

Setup changes made in Contro that would help every game. Input for Star Destroyer's roadmap task T1 (`soncsec/game-template`, ARCHITECTURE.md ADR-C09).

| Change | Where in Contro | Why it belongs in the template |
|---|---|---|
| ESLint bans `innerHTML`, `outerHTML` and `insertAdjacentHTML` (copied from the portal) | `eslint.config.js` | Every game runs under the same CSP; the portal already enforces this |
| Shared e2e helpers (`watchPage`, `sceneKey`) in their own file | `tests/e2e/watch.ts` | Every spec needs them; Star Destroyer defines them inside one spec |
| e2e check that the canvas is scaled by a whole number | `tests/e2e/boot.spec.ts` | Pixel-art games all depend on it |
| `test:release` and the release scripts are added with M1.9, not at scaffold time | `package.json` | The template should ship them from day one |
