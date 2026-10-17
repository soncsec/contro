# Contro — Roadmap

> **Status:** APPROVED by owner 2026-10-17
> Every milestone ends with a playable build the owner can try. Tasks in M2–M6 are refined into smaller tasks when their milestone starts.

## Progress

| Milestone | Status |
|---|---|
| M0 Setup | In progress |
| M1 Walking skeleton (to production) | Not started |
| M2 Core feel | Not started |
| M3 Level 1 Industrial (vertical slice) | Not started |
| M4 Level 2 Cyberpunk Corridor | Not started |
| M5 Level 3 Alien Hive | Not started |
| M6 Polish and v1.0 release | Not started |

## Risks driving this order

| # | Risk | Mitigation | Addressed in |
|---|---|---|---|
| 1 | Game feel (running, jumping, shooting) is the product and is subjective | Tackled first; all numbers in `tuning.ts`; owner play-tests on staging every milestone | M1, M2 |
| 2 | Warped tilesets may not be clean grids; backgrounds have mixed sizes | Skeleton builds a real Tiled room from the corridor tileset before level design | M1 |
| 3 | Enemies and bosses have few frames (tank 4, no mech attack animation) | Attacks shown with projectiles, flashes and screen shake; proven on the tank boss | M3 |
| 4 | No up-aim art | Derived diagonal frame; aim poses are swappable data (ADR-C04) | M2 |
| 5 | Audio licensing and file size | Owner approves each CC0 source; CREDITS.md; size check in CI | M3 |
| 6 | Gamepad mappings differ between browsers | Standard mapping only; manual check in both browsers | M2, M6 |
| 7 | Setup drifts from Star Destroyer before the template exists | `TEMPLATE-NOTES.md` | M0 onward |
| 8 | Supply chain | Phaser only at runtime; exact pins at least two weeks old; audits | M0 onward |

---

## M0 — Setup

**Demonstrable result:** `soncsec/contro` exists with a protected `main`, a passing CI run, and an open portal PR claiming the slug.

- [x] M0.1 Discovery and plan; owner approved 2026-10-17
- [ ] M0.2 `git init` with `.gitignore` excluding `legacy/`; approved docs as the first commit; create `soncsec/contro` (public)
- [ ] M0.3 Branch protection on `main` matching Star Destroyer (PR required, admins included, no force pushes or deletions, conversation resolution, strict required checks once they have run); secret scanning with push protection and Dependabot alerts on
- [ ] M0.4 Owner installs Tiled (`sudo apt install tiled`)
- [ ] M0.5 Scaffold copied from Star Destroyer: Vite + TypeScript + Phaser 4.2.1 on port 5174, Prettier, ESLint, Vitest, seeded RNG with tests, a boot scene; `TEMPLATE-NOTES.md`
- [ ] M0.6 CI: repo checks and gitleaks, build and test (format, lint, typecheck, coverage, build, `npm audit`), CodeQL, Dependabot; staging deploy to GitHub Pages plus ZAP on `main`
- [ ] M0.7 PR to `soncsec/games-portal` adding the Contro card (`coming-soon`) with a card image — *owner merges*

**Acceptance criteria:** a direct push to `main` is rejected; a PR shows green CI; staging shows the boot screen; `legacy/` is not in the repo; the portal PR is open.

## M1 — Walking skeleton

**Demonstrable result:** at `games.soncrant.com/contro/` the marine runs, jumps and shoots through a cyberpunk-corridor room, kills an alien, and walks through the exit to a portrait card and a second room.

- [ ] M1.1 Asset manifest, preload scene and asset preview scene (`?scene=preview`) for marine, walking alien, bullets, impacts and corridor art; manifest test against the real PNGs; CREDITS.md
- [ ] M1.2 Slice the corridor tileset; confirm grid and resolution (ADR-C05); a test room in Tiled; map validation test
- [ ] M1.3 Level scene: tile map, collisions, parallax background, camera follow, whole-number scaling
- [ ] M1.4 Input layer (keyboard) and player movement: run, jump, gravity, coyote time (logic unit tested)
- [ ] M1.5 Forward shooting with pooled bullets, muzzle flash and wall impacts
- [ ] M1.6 Walking alien: patrol, takes 3 hits, death effect
- [ ] M1.7 Exit trigger → portrait dialogue card (data file) → second room
- [ ] M1.8 Playwright in Chromium and Firefox: boots with no console or CSP errors and no third-party requests; preview scene; run and jump with real keys; alien takes 3 hits; exit reaches room 2
- [ ] M1.9 Release scripts adapted for `contro`; release tests
- [ ] M1.10 First production release; smoke test and ZAP against production — *needs approval*

**Acceptance criteria:** the owner plays it on production and staging; CI green; Playwright passes in both browsers; no high-severity ZAP findings; rollback rehearsed.

## M2 — Core feel

**Demonstrable result:** a 60-second test segment the owner judges fun to play with keyboard or gamepad.

- [ ] M2.1 Health bar, damage, invulnerability flashes, lives, checkpoints and respawn (logic unit tested)
- [ ] M2.2 Crouch and crouch-shoot; derived diagonal-up aim frame (`tools/art/`) and aiming
- [ ] M2.3 Gamepad support (standard mapping); pause menu
- [ ] M2.4 One-way platforms, pits and falling death
- [ ] M2.5 Flying alien with dive attack; enemy projectiles
- [ ] M2.6 Movement tuning pass with the owner (jump arc, speed, fire rate)
- [ ] M2.7 Playwright: take damage, die, respawn at checkpoint

**Acceptance criteria:** the owner signs off on feel; logic coverage at least 80%; works with keyboard and a gamepad in both browsers.

## M3 — Level 1 Industrial (vertical slice)

**Demonstrable result:** Level 1 is playable from title screen to the tank boss's defeat, with sound and music.

- [ ] M3.1 Industrial art: choose the tileset, assemble parallax; full level map
- [ ] M3.2 Boss framework: arena lock, health bar, phases, attack patterns, defeat (data-driven)
- [ ] M3.3 Tank boss
- [ ] M3.4 HUD, title screen with portal link, game over and continue
- [ ] M3.5 Save data (ADR-C08)
- [ ] M3.6 CC0 audio: sound effects and Level 1 music — *sources need approval*
- [ ] M3.7 Playwright: complete Level 1 via the test hook and reach the Level 2 card

**Acceptance criteria:** the owner beats Level 1; no console errors; 60 fps during the boss fight.

## M4 — Level 2 Cyberpunk Corridor

**Demonstrable result:** Levels 1–2 playable back to back.

- [ ] M4.1 Weapon pickups (2–3 types, rules decided here) with unit tests
- [ ] M4.2 Bipedal walker enemy
- [ ] M4.3 Level 2 map with props
- [ ] M4.4 Mech boss
- [ ] M4.5 Level 2 music

**Acceptance criteria:** the owner beats Level 2; pickups behave as specified and are tested.

## M5 — Level 3 Alien Hive

**Demonstrable result:** the full game is playable to the ending.

- [ ] M5.1 Alien enemies for Level 3
- [ ] M5.2 Level 3 map
- [ ] M5.3 Alien boss (Gothicvania art, recolored)
- [ ] M5.4 Ending and credits screens
- [ ] M5.5 Level 3 music

**Acceptance criteria:** the owner beats the game; every level's data passes validation.

## M6 — Polish and v1.0 release

**Demonstrable result:** Contro v1.0 is live and listed on the portal.

- [ ] M6.1 Difficulty balance pass from owner play-tests
- [ ] M6.2 Settings: volume, fullscreen
- [ ] M6.3 Frame-rate check across all bosses; full playthrough in Chrome and Firefox with no console errors
- [ ] M6.4 Final portal card image; portal PR changing status to `live`
- [ ] M6.5 Final security review: dependencies, CodeQL, secret scan, ZAP on staging
- [ ] M6.6 Release v1.0 — *needs approval*; ZAP and smoke test on production; tag `v1.0`

**Acceptance criteria:** the owner signs off; production serves v1.0 with security headers; post-release scan clean.
