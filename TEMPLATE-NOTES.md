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
| Parallel sessions share one machine: stop only your own server, by port (e.g. find the pid listening on 4177), never with a broad `pkill -f "vite preview"`; expect slower e2e runs while another game's suite runs | (process, NEW-GAME.md) | On 2026-10-17 Contro's Playwright server died mid-run twice while Star Destroyer's suite ran alongside; both suites pass on their own |
| Release tests never pipe into `grep -q` under `pipefail`: capture the output, then grep it | `tests/release/test_release_remote.sh` | `grep -q` exits at the first match and the writer can die of SIGPIPE, failing about 1 run in 300 (fixed in game-template #6 and games-portal #21) |
| Local test runs are limited: Playwright `workers: 2`, and long runs go through `scripts/limit-cpu.sh` (low priority with `nice`, at most 4 cores via `systemd-run --user --scope -p CPUQuota=400%`) | `playwright.config.ts`, `scripts/limit-cpu.sh` | On 2026-10-21 Contro's v1.0 release failed twice: another session's browser tests pushed the shared machine's load to 60–85 and e2e tests timed out |

## Security build check (Contro M3.8)

`scripts/check_build.py dist` fails a build that contains the e2e test hook, unexpected file types (source maps, `.env`), inline scripts or styles or event handlers, frames, `<base>`, meta refresh, CSS or HTML loading from another origin, or URLs to other hosts. It also fails on `eval`, `Function()`, `innerHTML`, `document.write` and string timers beyond the occurrences reviewed in Phaser (`ALLOWED`). It runs in CI after the build, in the Pages job, in `npm run check`, and in `release.sh` before upload. Tests: `tests/release/test_check_build.py`. Copy it with the reviewed counts for the game's own Phaser version.
