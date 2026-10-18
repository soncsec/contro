# Contro — Roadmap

> **Status:** APPROVED by owner 2026-10-17
> Every milestone ends with a playable build the owner can try. Tasks in M2–M6 are refined into smaller tasks when their milestone starts.

## Progress

| Milestone | Status |
|---|---|
| M0 Setup | Done except M0.4 (Tiled install) |
| M1 Walking skeleton (to production) | Done: live at games.soncrant.com/contro/ |
| M2 Core feel | In progress |
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
- [x] M0.2 `git init` with `.gitignore` excluding `legacy/`; approved docs as the first commit; create `soncsec/contro` (public)
- [x] M0.3 Branch protection on `main` matching Star Destroyer (PR required, admins included, no force pushes or deletions, conversation resolution, strict required checks once they have run); secret scanning with push protection and Dependabot alerts on. Direct push to `main` verified rejected 2026-10-17; required checks (Repo checks, Build and test, CodeQL analysis, CodeQL; strict) added after M0.6's first run
- [ ] M0.4 Owner installs Tiled (`sudo apt install tiled`)
- [x] M0.5 Scaffold copied from Star Destroyer: Vite + TypeScript + Phaser 4.2.1 on port 5174, Prettier, ESLint, Vitest, seeded RNG with tests, a boot scene; `TEMPLATE-NOTES.md`
- [x] M0.6 CI: repo checks and gitleaks, build and test (format, lint, typecheck, coverage, build, `npm audit`), CodeQL, Dependabot; staging deploy to GitHub Pages plus ZAP on `main`. Staging live at https://soncsec.github.io/contro/; first ZAP run 2026-10-17: 0 high, 5 medium, 5 low, all response headers GitHub Pages can't set (Apache sets them in production)
- [x] M0.7 PR to `soncsec/games-portal` adding the Contro card (`coming-soon`) with a card image — games-portal PR #10, merged 2026-10-17

**Acceptance criteria:** a direct push to `main` is rejected; a PR shows green CI; staging shows the boot screen; `legacy/` is not in the repo; the portal PR is open.

## M1 — Walking skeleton

**Demonstrable result:** at `games.soncrant.com/contro/` the marine runs, jumps and shoots through a cyberpunk-corridor room, kills an alien, and walks through the exit to a portrait card and a second room.

- [x] M1.1 Asset manifest, preload scene and asset preview scene (`?scene=preview`) for marine, walking alien, bullets, impacts and corridor art; manifest test against the real PNGs; CREDITS.md. Assets built from `legacy/` by `tools/art/build_assets.py` (16 files, frames packed into strips). Finding: the corridor tileset is pre-built room modules, not small tiles; checked for grid alignment in M1.2
- [x] M1.2 Slice the corridor tileset; confirm grid and resolution (ADR-C05); a test room in Tiled; map validation test. The tileset's room sections sit on a 16 px grid and are 176 px tall (320×176 confirmed). Test room `corridor-test.tmj` (71×11 tiles) made with `tools/levels/new_corridor_room.py`; `tools/levels/render_map.py` renders maps for PR screenshots. Open question for M2.4: the corridor art has no platforms
- [x] M1.3 Level scene: tile map, collisions, parallax background, camera follow, whole-number scaling. The marine's physics box (16×34) is measured from the art and mirrored when facing left (`src/logic/body.ts`); the placeholder Boot scene is gone
- [x] M1.4 Input layer (keyboard) and player movement: run, jump, gravity, coyote time (logic unit tested). Also jump buffering and short hops. Default keys: arrows or WASD to move, Space/Z/K jump, X/J fire, Esc/P pause (owner to review in play-tests)
- [x] M1.5 Forward shooting with pooled bullets, muzzle flash and wall impacts. Hold to fire every 160 ms, tap for up to every 90 ms, 8 bullets at most; bullets start at the barrel tip measured per animation frame; muzzle flash cut from the shoot frames (derived art)
- [x] M1.6 Walking alien: patrol, takes 3 hits, death effect. Patrols 48 px either side of its spawn with 0.4 s turns, flashes white when hit, explodes on death. Stats in `src/data/enemies.ts`; touching the player does no damage yet (health comes in M2.1)
- [x] M1.7 Exit trigger → portrait dialogue card (data file) → second room. Cards in `src/data/dialogue.ts` (placeholder lines for the owner to edit), room order in `src/data/campaign.ts`; room 2 leads back to room 1 for now
- [x] M1.8 Playwright in Chromium and Firefox: boots with no console or CSP errors and no third-party requests; preview scene; run and jump with real keys; alien takes 3 hits; exit reaches room 2
- [x] M1.9 Release scripts adapted for `contro`; release tests. Copied from Star Destroyer (with its one-slot identity check); `release.sh status` reached the server
- [x] M1.10 First production release; smoke test and ZAP against production — *owner gave standing approval 2026-10-17 to release each playable increment*. Released `20261017T220809Z-0dc57861` (commit 0dc5786) 2026-10-17: smoke test passed with all security headers; no console errors or third-party requests in Chromium and Firefox. Staging ZAP: 0 high. Production ZAP from outside runs with Contro's own `Production check` workflow (added here)

**Acceptance criteria:** the owner plays it on production and staging; CI green; Playwright passes in both browsers; no high-severity ZAP findings; rollback rehearsed.

## M2 — Core feel

**Demonstrable result:** a 60-second test segment the owner judges fun to play with keyboard or gamepad.

- [x] M2.1 Health bar, damage, invulnerability flashes, lives, checkpoints and respawn (logic unit tested). 4 hits per life, 3 lives, 1.5 s blinking invulnerability with knockback, checkpoint objects in the maps, game over restarts the level (proper screens in M3.4)
- [x] M2.2 Crouch and crouch-shoot; derived diagonal-up aim frame (`tools/art/`) and aiming. Down crouches (stops, can turn, 10 px shorter, shoots 9 px lower); up aims 45° standing, running and jumping. Derived sheets by `tools/art/aim.py` (arms and rifle rotated about the chest), barrel tips generated alongside
- [x] M2.3 Gamepad support (standard mapping); pause menu. A jumps, X/B fire, Start pauses, d-pad or left stick move/aim/crouch; keyboard and pad merged. Esc/P/Start open a pause menu (Resume, Restart room). Tested in browsers with a fake standard gamepad
- [x] M2.4 One-way platforms, pits and falling death. Catwalks (option C, drawn by Claude) at two heights in room 1 and one in room 2, a pit before each EXIT; down + jump drops through; a pit kills even while invulnerable and respawns at the checkpoint
- [x] M2.5 Flying alien with dive attack; enemy projectiles. Hovers and drifts around its spawn, fires slow aimed orbs (Gothicvania enemy projectile) within 220 px, and dives at the marine when he's below it, after a 0.45 s warning; 2 hits to kill. One flyer in room 1, two in room 2
- [ ] M2.6 Movement tuning pass with the owner (jump arc, speed, fire rate)
- [x] M2.7 Playwright: take damage, die, respawn at checkpoint (done with M2.1: `tests/e2e/health.spec.ts`)
- [x] M2.8 Double jump (owner request 2026-10-17, for an upcoming sprint): one extra jump in mid-air, restored on landing, also after walking off a ledge; its height in `tuning.ts`; logic unit tested and covered by Playwright. Proposed after the M2.6 tuning pass, since it changes jump heights and level layouts
- [x] M2.9 Scoring (owner request 2026-10-17): points per enemy (walker 100, flyer 200) as enemy data; score and best score in the HUD; best score saved (ADR-C08); extra lives at 20,000 and 50,000; score carries across rooms, resets on game over; logic unit tested, Playwright covers it
- [x] M2.10 Fullscreen key (owner request 2026-10-17): F toggles fullscreen; whole-number scaling recalculated for the new size
- [x] M2.11 Cheat codes (owner request 2026-10-17): entered on the pause screen; Konami code +5 lives, invincibility, invisibility, room skip (all weapons after M4); a HUD marker while any cheat is on; cheating stops the best score from being saved; code matching unit tested. Built: Konami code (keys or d-pad) +5 lives; typed IRON invincibility, GHOUL invisibility, THRU room skip (letters chosen so they never clash with game keys)
- [x] M2.12 Basic gun fires one shot per press (owner request 2026-10-17, issue #21; after M2.10 and M2.11): holding fire (keys or gamepad) fires once; each new press fires again, at most every 90 ms. Holding fire for 2 s fires exactly one shot (e2e); rule tests in `src/logic/weapon.ts`
- [x] M2.13 Health carries between sections and levels (owner request 2026-10-18): the run state carries hp like score and lives; Restart room restores the hp the section was entered with; respawns still start at full health; e2e covered
- [x] M2.14 Show the current level (owner request 2026-10-18): HUD label `level-section` (e.g. `1-2`) and a banner with the level's number and name when it starts; names and numbers are campaign data

**Acceptance criteria:** the owner signs off on feel; logic coverage at least 80%; works with keyboard and a gamepad in both browsers.

## M3 — Level 1 Industrial (vertical slice)

**Demonstrable result:** Level 1 is playable from title screen to the tank boss's defeat, with sound and music.

- [x] M3.0 Level structure (ADR-C10): a level is a sequence of sections (maps) played back to back with a checkpoint at each; dialogue cards only between levels; campaign data lists levels → sections; validation tests
- [ ] M3.1 Industrial art: choose the tileset (owner picks from mockups), assemble parallax; Level 1 as **at least 5 varied sections, 10–15 minutes**, including at least one **multi-level ground** stretch (upper and lower paths, Contra-style) and one outdoor stretch (industrial parallax). **Shipped in slices** (owner approved 2026-10-18): each section is its own PR and its own release (1-1 first), so it can be played and commented on while the rest is built
- [ ] M3.2 Boss framework: arena lock, health bar, phases, attack patterns, defeat (data-driven)
- [ ] M3.3 Tank boss
- [ ] M3.4 HUD, game over and continue (the title screen moved to M3.10)
- [ ] M3.5 Save data (ADR-C08)
- [ ] M3.6 CC0 audio: sound effects and Level 1 music — *sources need approval*
- [ ] M3.7 Playwright: complete Level 1 via the test hook and reach the Level 2 card
- [x] M3.8 Security build check (owner approved 2026-10-18): a CI step and release-script check that fail if the production build contains the e2e test hook, inline scripts or styles, `eval`/`new Function`, `innerHTML`, or any URL to another host. It runs before every release. Built as `scripts/check_build.py` (CI build and Pages jobs, `npm run check`, `release.sh`); Phaser's 1 `Function()` and 3 `innerHTML` uses reviewed and allowed, any more fail
- [x] M3.9 Press Start 2P font (owner approved 2026-10-18): the same file and checksum as Star Destroyer, bundled and served from our origin; used for the HUD, banners and cards; CREDITS.md and the OFL licence text. Built: every text style uses `FONT` in `tuning.ts`; the game waits for the font before drawing; card lines now fit 26 characters (the 8 px font is wider than the old fallback), up to 3 lines
- [x] M3.10 Title screen with a controls guide (keyboard, gamepad, and touch once M3.11 lands), Start to play, and a link back to the portal; moved ahead of Level 1 (owner approved 2026-10-18). Built: CONTRO over the drifting corridor, START / CONTROLS / MORE GAMES, best score; the guide is generated from the real key and pad bindings (`src/logic/controls.ts`); Start on a gamepad also selects. Touch rows come with M3.11
- [ ] M3.11 Phone touch controls (owner approved 2026-10-18): on-screen move, jump, fire and pause buttons on touch screens only; aiming and crouch; whole-number scaling on a phone screen. Layout mocked up for the owner first. Tested in Playwright with touch emulation

**Order** (owner approved 2026-10-18, to get a playable build in front of players sooner): M3.0 → M3.8 security build check → M3.9 font → M3.10 title screen → M3.1 Level 1 one section at a time, each released as it lands → M3.11 touch controls → M3.2 onward.

**Acceptance criteria:** the owner beats Level 1; no console errors; 60 fps during the boss fight.

## M4 — Level 2 Cyberpunk Corridor

**Demonstrable result:** Levels 1–2 playable back to back.

- [ ] M4.1 Weapon pickups (2–3 types, rules decided here) with unit tests. One is the **machine gun** (issue #21): auto-fires while fire is held, at its own rate in `tuning.ts`
- [ ] M4.2 Bipedal walker enemy
- [ ] M4.3 Level 2: **at least 5 varied sections, 10–15 minutes**, with props, **multi-level ground**, and a change of scenery (e.g. the Scifi lab or Synth City art)
- [ ] M4.4 Mech boss
- [ ] M4.5 Level 2 music

**Acceptance criteria:** the owner beats Level 2; pickups behave as specified and are tested.

## M5 — Level 3 Alien Hive

**Demonstrable result:** the full game is playable to the ending.

- [ ] M5.1 Alien enemies for Level 3
- [ ] M5.2 Level 3: **at least 5 varied sections, 10–15 minutes**, including **multi-level ground** (the alien tileset's ledges) and a change of scenery (e.g. the another-world art)
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
