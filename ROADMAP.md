# Contro — Roadmap

> **Status:** APPROVED by owner 2026-10-17
> Every milestone ends with a playable build the owner can try. Tasks in M2–M6 are refined into smaller tasks when their milestone starts.

## Progress

| Milestone | Status |
|---|---|
| M0 Setup | Done (M0.4 dropped 2026-10-19) |
| M1 Walking skeleton (to production) | Done: live at games.soncrant.com/contro/ |
| M2 Core feel | Done (feel signed off by the owner 2026-10-18) |
| M3 Level 1 Industrial (vertical slice) | In progress |
| M4 Level 2 Cyberpunk Corridor | Done: live 2026-10-20 (mech eased after the owner's first play) |
| M5 Level 3 Alien Hive | In progress |
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
- [x] ~~M0.4 Owner installs Tiled~~ Dropped (owner decision 2026-10-19): every map comes from the generator scripts, which are the authoring tool (ADR-C01)
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
- [x] M2.6 Movement tuning pass with the owner (jump arc, speed, fire rate). Owner played 1-1 on 2026-10-18: "Play is good"; the current numbers stay
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
- [x] M3.1 Industrial art: choose the tileset (owner picks from mockups), assemble parallax; Level 1 as **at least 5 varied sections, about 5–8 minutes including the boss** (target changed by the owner 2026-10-18; was 10–15 minutes), including at least one **multi-level ground** stretch (upper and lower paths, Contra-style) and one outdoor stretch (industrial parallax). **Shipped in slices** (owner approved 2026-10-18): each section is its own PR and its own release (1-1 first), so it can be played and commented on while the rest is built. Art chosen: option B steelworks + C for variety (2026-10-18). **1-1 The yard** done: outdoor, 180 tiles, steps up to a 4-high ledge, an upper walkway route over a lower path, three pits, 12 walkers and 4 flyers, 3 checkpoints; maps made by `tools/levels/steelworks_section.py`, parallax from Tiled image layers, and a route check (`src/logic/route.ts`) proves every pit and step is within jump reach. **1-2 The interior** done: indoors under the pack's pipes and columns (no skyline), 170 tiles, a staircase up and down, a mezzanine 5 tiles up, four walkways over pits, 16 walkers and 5 flyers, 3 checkpoints. **1-3 The rust factory** done: option C's rust bulkheads (own tileset, `tools/art/rust.py`: the v2 wall and floor, the walkway recoloured rust), 160 tiles, four pits, paired ledges, staggered walkways climbing over a pit, 18 walkers and 5 flyers, 3 checkpoints. **1-4 The gantries** done: back outside under the skyline, 170 tiles, seven narrow pits (running jumps), a 4-tile ledge climbed straight from the floor with the double jump, five walkways, 20 walkers and 6 flyers, 3 checkpoints. **1-5 The furnace hall** done: rust, 180 tiles, an upper route of ledges and walkways that link up over a lower path with pits, then a long flat floor at the end (the arena for the Level 1 boss, M3.2–M3.3) with a last rush of walkers; 26 walkers and 7 flyers, 3 checkpoints; the level-end card follows 1-5. **All 5 sections built**: the owner played them through in about 4 minutes ("felt close to long enough"); the boss fight (M3.2–M3.3) brings the level into the 5–8 minute target
- [x] M3.2 Boss framework: arena lock, health bar, phases, attack patterns, defeat (data-driven). Built: a map places a `boss` and its one-screen `arena` (validated in `src/logic/levelMap.ts`); the fight starts when the marine reaches the arena's middle: the camera stays on it and a wall closes behind him; the boss rolls in, then drives and attacks by phase (rules in `src/logic/boss.ts`, unit tested; bosses are data in `src/data/bosses.ts`); a health bar in the HUD; the exit stays shut until the boss is destroyed; dying in the fight sends the boss back and starts it again from the checkpoint before the arena; random choices use the seeded RNG
- [x] M3.3 Tank boss (design approved by the owner 2026-10-18; shipped with M3.2 in one PR). The Warped tank (128×64) at the end of 1-5: 100 hits; phase 1 drives and fires its cannon at head height (crouch or jump); below half health it drives faster, fires more often and lobs mortar shells with a blinking mark where each lands; destroyed, it goes up in a chain of big explosions (Ground Explosion art) for 5000 points, then the level-end card. Health and timings to be tuned after the owner plays it
- [x] M3.4 HUD, game over and continue (the title screen moved to M3.10). Shipped in two PRs:
  - [x] M3.4a Holding the on-screen FIRE auto-fires every 160 ms (owner approved 2026-10-18; keys and gamepad keep one shot per press); the title's controls guide gains an AIM DOWN row (M3.13)
  - [x] M3.4b Continue after game over: CONTINUE restarts the section the marine died in with full lives and the score back to zero, QUIT returns to the title; a run has 3 continues (`CONTINUE.count`; owner to confirm, since game over used to allow unlimited retries), then game over returns to the title. START shows the level's intro card; a level's end card is followed by the next level's intro card; after Level 1 a TO BE CONTINUED screen with the score, then the title, instead of starting the campaign again. Level 1's cards use the drafted story text (owner approved 2026-10-19)
- [x] M3.5 Save data (ADR-C08): the save keeps the furthest level reached (older saves read as level 1 and keep their best score; a cheated run doesn't count); once level 2 is reached the title gains a LEVEL row (left/right choose, START or fire begins there with its intro card), owner approved 2026-10-18. Volume joins the save with audio (M3.6)
- [ ] M3.6 CC0 audio: sound effects and Level 1 music. Sources approved by the owner 2026-10-19: Kenney *Sci-Fi Sounds* and *63 Digital Sound Effects* (CC0) for effects; ansimuz *Cyber Runner* (Level 1) and *Boss Fight 2* (the tank) for music (CC0). OGG plus M4A for iPhone (ADR-C06 amended). Effects for shots, hits, kills, getting hurt, dying, enemy shots, the tank's cannon and mortar, explosions, extra lives and menus; the level's music carries across its sections and switches to the boss music in the fight; SOUND ON/OFF on the pause menu, saved
- [x] M3.7 Playwright: complete Level 1 via the test hook and reach the Level 2 card. Built as `tests/e2e/level1.spec.ts`: START, both training sections, the cards, all five steelworks sections with score and cheats carried, the tank fight (frame rate recorded), its card, the end screen (Level 2 doesn't exist yet), the title. The test hook gains `fps()`; the boss fight ran at 39–46 fps headless on the loaded dev machine (load ~50), so the 60 fps check is done on a real device
- [x] M3.8 Security build check (owner approved 2026-10-18): a CI step and release-script check that fail if the production build contains the e2e test hook, inline scripts or styles, `eval`/`new Function`, `innerHTML`, or any URL to another host. It runs before every release. Built as `scripts/check_build.py` (CI build and Pages jobs, `npm run check`, `release.sh`); Phaser's 1 `Function()` and 3 `innerHTML` uses reviewed and allowed, any more fail
- [x] M3.9 Press Start 2P font (owner approved 2026-10-18): the same file and checksum as Star Destroyer, bundled and served from our origin; used for the HUD, banners and cards; CREDITS.md and the OFL licence text. Built: every text style uses `FONT` in `tuning.ts`; the game waits for the font before drawing; card lines now fit 26 characters (the 8 px font is wider than the old fallback), up to 3 lines
- [x] M3.10 Title screen with a controls guide (keyboard, gamepad, and touch once M3.11 lands), Start to play, and a link back to the portal; moved ahead of Level 1 (owner approved 2026-10-18). Built: CONTRO over the drifting corridor, START / CONTROLS / MORE GAMES, best score; the guide is generated from the real key and pad bindings (`src/logic/controls.ts`); Start on a gamepad also selects. Touch rows added with M3.11
- [x] M3.11 Phone touch controls (owner approved 2026-10-18): on-screen move, jump, fire and pause buttons on touch screens only; aiming and crouch; whole-number scaling on a phone screen. Layout mocked up for the owner first. Tested in Playwright with touch emulation. Built to the approved mockup: a fixed 8-way stick bottom-left (up aims, down crouches, diagonals), FIRE and JUMP bottom-right, pause and fullscreen (where the browser allows it) top-left; see-through, beside the 2× picture on wide phones and over its edges on narrow ones; portrait shows "turn your phone sideways" and pauses the game. The controls are page elements styled from `style.css` (CSP-safe) that feed the same action layer as keys and gamepad (`src/logic/touch.ts`, `src/systems/TouchControls.ts`); the title's guide shows a TOUCH column on touch screens
- [x] M3.12 Bullets pass through terrain (owner request 2026-10-18, as in Contra): the marine's bullets and enemy shots ignore walls, floors and catwalks, both ways, and end when they leave the view; the tank's mortar shells burst at their marked landing point instead of on the floor; the unused wall-impact art removed
- [ ] M3.13 Run and aim down (owner request 2026-10-18): down alone crouches; down + left or right runs that way aiming 45° down, on the ground and in the air (down alone in the air still drops through catwalks); derived run-down frames (`tools/art/aim.py`); the gamepad stick reads as 8 equal slices like the touch stick, so a slightly tilted down still crouches
- [x] M3.14 Enemies that run in from the screen's edge, and a walker variant (owner left it to Claude, 2026-10-18; done before Level 2 so it is built with them): maps place `spawner` points that, once in view, send a number of **runners** in from the left or right edge at an interval, landing on the ground where they appear; the runner is the walker's art tinted red, fast, one hit, 50 points, turns at walls and is removed once far off screen or down a pit (pooled); Level 1's five sections have 2–3 spawners each, some from behind, none in the boss arena

**Order** (owner approved 2026-10-18, to get a playable build in front of players sooner): M3.0 → M3.8 security build check → M3.9 font → M3.10 title screen → M3.1 Level 1 one section at a time, each released as it lands → M3.11 touch controls → M3.2 onward.

**Acceptance criteria:** the owner beats Level 1; no console errors; 60 fps during the boss fight.

## M4 — Level 2 Cyberpunk Corridor

**Demonstrable result:** Levels 1–2 playable back to back.

- [x] M4.1 Weapon pickups with unit tests. Owner decisions 2026-10-19: **two pickups, the machine gun and the spread, dropped by a blimp** the marine shoots (one shot brings it down), as in Contra's pods. The **machine gun** (issue #21) auto-fires while fire is held (every 100 ms); the **spread** fires three bullets 15° apart. A pickup replaces the rifle until the marine loses a life, carries between sections and shows after the lives in the HUD; each weapon has its own bullet limit. Art drawn by Claude and approved after four mockups: the **blimp** (`tools/art/blimp.py`: dark gunmetal hull, bronze ribs following its curve, engines, braced fins; right- and left-facing sheets so its number always reads 07) flies across in a slow wave once a map's `blimp` point is in view; its **letter** (`tools/art/letters.py`: a coloured, outlined, textured M or S) pops up, lands and is collected by walking into it. Blimps can also carry a **full-health restore** (a red cross; owner request 2026-10-19), and **every Level 1 section has two blimps**, one weapon and one health (machine gun in 1-1, 1-3, 1-4; spread in 1-2, 1-5). The **GUNNY** cheat (typed on the pause screen) steps through every weapon
- [x] M4.2 Bipedal walker enemy (art and behaviour approved by the owner 2026-10-19): the pack's bipedal unit, unchanged (7 walk frames, 80×64); it walks towards the marine once it sees him (260 px), keeps 90 px away, and every 2.4 s stops for 0.6 s and fires its cannon at head height, 29 px above its feet (crouch or jump to dodge, like the tank); 6 hits, 400 points, the tank's big explosion; rules in `src/logic/biped.ts`, unit tested. Two placed in Level 1 so it can be played now (owner, 2026-10-19): one in 1-2, one in 1-4
- [x] M4.3 Level 2: **at least 5 varied sections, about 5–8 minutes including the boss**, with props, **multi-level ground**, and a change of scenery (e.g. the Scifi lab or Synth City art). **The Neon District** (owner chose option A after mockups, 2026-10-19): corridor interiors with the cyberpunk props, outdoor rooftops under the Synth City skyline, a lab section on the sci-fi platform tiles; order 2-1 rooftops, 2-2 corridor, 2-3 rooftops (multi-level), 2-4 lab, 2-5 corridor into the mech boss. Built one section per PR, like Level 1. Tileset `tools/art/neon.py` (same rows as the steelworks one, so the section generator lays it out). **2-1 The rooftops** done: 180 tiles, four roofs with gaps, raised blocks, three walkways, 11 walkers, 3 flyers, runners, the first bipedal walker, two blimps (spread, health); Level 2's intro and end cards; Level 1's music until M4.5. **2-2 The corridor** done: the corridor's room modules chained by `tools/levels/corridor_section.py` (on top of `new_corridor_room.py`), 155 tiles, three pits under catwalks, catwalks at two heights, cryo pods, server racks and terminals as a new `props` map layer (`tools/art/props.py`), 12 walkers (three on catwalks), 3 flyers, runners, a bipedal walker, two blimps (machine gun, health). **2-3 The skyline** done: back on the rooftops on two levels, 170 tiles, a high route of raised roofs and walkways over a low route with gaps, 14 walkers, 4 flyers, runners, two bipedal walkers, two blimps (machine gun, health). **2-4 The lab** done: indoors among the cryo tanks (the neon tileset's lab wall), 170 tiles, pits under walkways, stepped platforms, 14 walkers, 4 flyers, runners, two bipedal walkers, two blimps (spread, health). **2-5 The last corridor** done: corridor modules into the mech's arena (the map's last screen), 134 tiles, two pits under catwalks, two bipedal walkers, two blimps (machine gun, health); the EXIT stays shut until the mech is destroyed. **All 5 Level 2 sections built**
- [x] M4.4 Mech boss (design approved by the owner 2026-10-19): the pack's mech (10 walk frames, 96×80, native size) in 2-5's arena. Phase 1 stomps back and forth firing a 3-shot spread from its chest light, aimed at the marine, and sends a ground shockwave at him each time it turns (jump over it); below half health it is faster and leaps onto the marine's spot (the landing marked), with a shockwave both ways on landing. 150 hits, 8000 points, the tank's chain explosion. **Eased a little** after the owner's first play ("very hard but fun", 2026-10-20): 120 hits, and in the second half the spread every 1.7 s (was 1.4 s) and the leap every 4 s (was 3.2 s). New boss rules: `spread` and `leap` attacks, `shockwaveOnTurn`, `leapArc` (unit tested); the corridor generator gains boss arenas
- [x] M4.5 Level 2 music: ansimuz's *Dark Happy World* (CC0, synthwave; owner approved 2026-10-19), OGG + M4A, loaded after the title like the other music

**Acceptance criteria:** the owner beats Level 2; pickups behave as specified and are tested.

## M5 — Level 3 Alien Hive

**Demonstrable result:** the full game is playable to the ending.

Owner decisions 2026-10-20, from mockups: **into the hive** (3-1 and 3-2 in the alien base, 3-3 to 3-5 inside the living-tissue hive, ending in the boss's chamber), the **demon in hive colours** as the boss, and the **spitting snake** as Level 3's new creature (the alien walkers, flyers, runners and bipedal walkers stay).

- [ ] M5.1 The spitting snake (`Warped/Characters/Grotto-escape-2-snake`): sits on ledges and spits at the marine, like a turret; two hits. Rules in `src/logic/`, unit tested
- [ ] M5.2 Level 3: **at least 5 varied sections, about 5–8 minutes including the boss**, including **multi-level ground**, built one section per PR like Levels 1 and 2. Tileset `tools/art/alien.py` (the alien base's bridges, same rows as the steelworks tileset). **3-1 The alien base** done: 180 tiles of bridges with five gaps between them, raised bridges, four vent walkways over the gaps, 19 walkers, 5 flyers, runners, a bipedal walker, two blimps (spread, health), in front of the base's back wall and structures; Level 3's intro card and the ending card (both approved with the story draft, 2026-10-19); Level 2's music until M5.5
- [ ] M5.3 Alien boss: the Gothicvania demon, recoloured in hive colours (acid green wings and flames), in the hive's chamber at the end of 3-5
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
